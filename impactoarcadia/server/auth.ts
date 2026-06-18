import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import type { Express } from "express";
import session from "express-session";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import type { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {
      tenantId?: number;
    }
  }
}

const scryptAsync = promisify(scrypt);
let authRegistered = false;

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;

  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  if (hashedBuf.length !== suppliedBuf.length) return false;

  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function getSessionCookieSecure(): boolean | "auto" {
  const value = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value || "")) return true;
  if (["0", "false", "no", "off"].includes(value || "")) return false;
  return process.env.NODE_ENV === "production" ? "auto" : false;
}

const sessionSettings: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || "arcadia-browser-secret-key-2024",
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore,
  cookie: {
    secure: getSessionCookieSecure(),
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },
};

export const sessionMiddleware = session(sessionSettings);

export function setupAuth(app: Express) {
  if (authRegistered) return;
  authRegistered = true;

  app.set("trust proxy", 1);
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, null);

      const enrichedUser = await storage.getEnrichedUser(user);
      return done(null, enrichedUser);
    } catch (error) {
      return done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        username,
        password: await hashPassword(password),
      });

      req.login(user, async (err) => {
        if (err) return next(err);
        try {
          const enrichedUser = await storage.getEnrichedUser(user);
          return res.status(201).json(enrichedUser);
        } catch (error) {
          return next(error);
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    try {
      const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      req.login(user, async (err) => {
        if (err) return next(err);
        try {
          const enrichedUser = await storage.getEnrichedUser(user);
          return res.status(200).json(enrichedUser);
        } catch (error) {
          return next(error);
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    const destroySession = () => {
      if (!req.session) {
        return res.status(200).json({ ok: true });
      }

      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie("connect.sid");
        return res.status(200).json({ ok: true });
      });
    };

    req.logout((err) => {
      if (err) return next(err);
      destroySession();
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    return res.json(req.user);
  });
}
