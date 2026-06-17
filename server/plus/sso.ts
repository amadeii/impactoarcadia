import { Router, Request, Response } from "express";
import crypto from "crypto";

const router = Router();

function getSsoSecret(): string {
  const secret = process.env.SSO_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SSO_SECRET must be set with at least 32 characters");
  }
  return secret;
}

function generateSsoToken(user: any): { token: string; signature: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  
  const tokenData = {
    sub: user.id,
    username: user.username,
    email: user.email || `${user.username}@arcadia.local`,
    name: user.name || user.username,
    role: user.role,
    iss: "arcadia-suite",
    aud: "arcadia-plus",
    iat: timestamp,
    exp: timestamp + 300,
    nonce,
  };
  
  const token = Buffer.from(JSON.stringify(tokenData)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSsoSecret())
    .update(token + timestamp)
    .digest("hex");
  
  return { token, signature, timestamp };
}

router.get("/redirect", (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.redirect("/auth");
  }
  
  const { token, signature, timestamp } = generateSsoToken(req.user);
  
  // Check for stored redirect destination
  const plusRedirect = (req.session as any).plusRedirect;
  if (plusRedirect) {
    delete (req.session as any).plusRedirect;
  }
  
  // Add redirect_to parameter if we have a destination
  const redirectParam = plusRedirect ? `&redirect_to=${encodeURIComponent(plusRedirect)}` : '';
  const ssoUrl = `/plus/sso/login?token=${encodeURIComponent(token)}&sig=${signature}&ts=${timestamp}${redirectParam}`;
  
  res.redirect(ssoUrl);
});

router.get("/token", (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const { token, signature, timestamp } = generateSsoToken(req.user);
  
  res.json({
    token,
    signature,
    timestamp,
    redirectUrl: `/plus/sso/login?token=${encodeURIComponent(token)}&sig=${signature}&ts=${timestamp}`,
  });
});

// Direct auto-login via fetch to Laravel and proxy response
router.get("/auto-login", async (req: Request, res: Response) => {
  try {
    const PLUS_HOST = process.env.PLUS_HOST || "localhost";
    const PLUS_PORT = process.env.PLUS_PORT || "8080";
    
    // Forward request to Laravel auto-login
    const response = await fetch(`http://${PLUS_HOST}:${PLUS_PORT}/auto-login`, {
      redirect: "manual",
      headers: {
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    
    // Get Laravel session cookies
    const setCookies = response.headers.getSetCookie();
    
    // Forward cookies to client
    for (const cookie of setCookies) {
      res.setHeader("Set-Cookie", cookie);
    }
    
    // If Laravel redirects, follow manually and proxy the result
    const location = response.headers.get("location");
    if (location) {
      // Follow the redirect
      const homeResponse = await fetch(`http://${PLUS_HOST}:${PLUS_PORT}${location.replace(/^http:\/\/[^/]+/, '')}`, {
        headers: {
          "Cookie": setCookies.join("; "),
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      
      let html = await homeResponse.text();
      
      // Rewrite URLs to use /plus prefix
      html = html.replace(/href="\//g, 'href="/plus/');
      html = html.replace(/src="\//g, 'src="/plus/');
      html = html.replace(/action="\//g, 'action="/plus/');
      html = html.replace(/url\('\//g, "url('/plus/");
      html = html.replace(/url\("\//g, 'url("/plus/');
      
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } else {
      const html = await response.text();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    }
  } catch (error: any) {
    console.error("[Plus SSO] Auto-login error:", error);
    res.status(502).json({ 
      error: "Failed to connect to Arcádia Plus",
      message: error.message 
    });
  }
});

export default router;
