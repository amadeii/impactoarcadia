import { CookieJar, Cookie } from "tough-cookie";

interface BridgeSession {
  id: string;
  userId: string;
  targetUrl: string;
  status: "initializing" | "active" | "completed" | "error";
  cookies: string[];
  createdAt: Date;
  lastActivity: Date;
}

const sessions = new Map<string, BridgeSession>();
const userCookieJars = new Map<string, CookieJar>();

export function getCookieJar(userId: string): CookieJar {
  if (!userCookieJars.has(userId)) {
    userCookieJars.set(userId, new CookieJar());
  }
  return userCookieJars.get(userId)!;
}

export function createSession(userId: string, targetUrl: string): BridgeSession {
  const sessionId = `bridge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  const session: BridgeSession = {
    id: sessionId,
    userId,
    targetUrl,
    status: "initializing",
    cookies: [],
    createdAt: new Date(),
    lastActivity: new Date(),
  };
  
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): BridgeSession | undefined {
  return sessions.get(sessionId);
}

export function updateSession(sessionId: string, updates: Partial<BridgeSession>): void {
  const session = sessions.get(sessionId);
  if (session) {
    Object.assign(session, updates, { lastActivity: new Date() });
  }
}

export async function syncCookies(sessionId: string, cookies: Array<{name: string, value: string, domain: string, path: string}>): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;
  
  const cookieJar = getCookieJar(session.userId);
  
  for (const c of cookies) {
    try {
      const cookieStr = `${c.name}=${c.value}; Domain=${c.domain}; Path=${c.path}`;
      const cookie = Cookie.parse(cookieStr);
      if (cookie) {
        await cookieJar.setCookie(cookie, session.targetUrl);
      }
    } catch (err) {
      console.error("[LoginBridge] Failed to sync cookie:", c.name, err);
    }
  }
  
  session.status = "completed";
  console.log(`[LoginBridge] Synced ${cookies.length} cookies for session ${sessionId}`);
}

export function cleanupSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function cleanupOldSessions(): void {
  const maxAge = 30 * 60 * 1000;
  const now = Date.now();
  
  for (const [id, session] of sessions) {
    if (now - session.lastActivity.getTime() > maxAge) {
      sessions.delete(id);
    }
  }
}

setInterval(cleanupOldSessions, 5 * 60 * 1000);
