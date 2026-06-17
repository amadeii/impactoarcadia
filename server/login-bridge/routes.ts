import { Router, Request, Response } from "express";
import { createSession, getSession, syncCookies, cleanupSession, getCookieJar } from "./service";
import { Cookie } from "tough-cookie";

const router = Router();

const ALLOWED_DOMAINS = [
  "econeteditora.com.br",
  "www.econeteditora.com.br",
  "drive.google.com",
  "docs.google.com",
  "accounts.google.com",
];

function isDomainAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith("." + d)
    );
  } catch {
    return false;
  }
}

router.post("/start", async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    if (!isDomainAllowed(url)) {
      return res.status(403).json({ error: "Domain not allowed for login bridge" });
    }

    const session = createSession(req.user.id, url);
    
    res.json({
      success: true,
      sessionId: session.id,
      message: "Login bridge session created. Connect via WebSocket to start.",
    });
  } catch (error: any) {
    console.error("[LoginBridge] Start error:", error);
    res.status(500).json({ error: "Failed to start login bridge" });
  }
});

router.get("/session/:sessionId", async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.userId !== req.user!.id) {
      return res.status(403).json({ error: "Not your session" });
    }

    res.json({
      id: session.id,
      status: session.status,
      targetUrl: session.targetUrl,
      createdAt: session.createdAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get session" });
  }
});

router.post("/sync-cookies", async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { sessionId, cookies } = req.body;
    if (!sessionId || !cookies) {
      return res.status(400).json({ error: "Missing sessionId or cookies" });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.userId !== req.user!.id) {
      return res.status(403).json({ error: "Not your session" });
    }

    await syncCookies(sessionId, cookies);
    
    res.json({ success: true, message: "Cookies synced to proxy" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to sync cookies" });
  }
});

router.post("/end/:sessionId", async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.userId !== req.user!.id) {
      return res.status(403).json({ error: "Not your session" });
    }

    cleanupSession(req.params.sessionId);
    
    res.json({ success: true, message: "Session ended" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to end session" });
  }
});

router.get("/allowed-domains", (_req: Request, res: Response) => {
  res.json({ domains: ALLOWED_DOMAINS });
});

router.post("/mark-logged-in", async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { url, timestamp } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    console.log(`[LoginBridge] User ${req.user.id} marked login complete for ${url} at ${timestamp}`);
    
    res.json({ 
      success: true, 
      message: "Login marked as complete. Please refresh the app to use the new session.",
      note: "Cookies from the popup window are now active in your browser."
    });
  } catch (error: any) {
    console.error("[LoginBridge] Mark logged in error:", error);
    res.status(500).json({ error: "Failed to mark login" });
  }
});

router.all("/login-proxy/*", async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).send("Not authenticated - please login to Arcadia Suite first");
    }

    const targetPath = req.params[0] || "";
    const targetUrl = decodeURIComponent(targetPath);
    
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return res.status(400).send("Invalid target URL");
    }

    if (!isDomainAllowed(targetUrl)) {
      return res.status(403).send("Domain not allowed");
    }

    const cookieJar = getCookieJar(req.user.id);
    const existingCookies = await cookieJar.getCookieString(targetUrl);

    const headers: Record<string, string> = {
      "User-Agent": req.get("user-agent") || "Mozilla/5.0",
      "Accept": req.get("accept") || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": req.get("accept-language") || "pt-BR,pt;q=0.9,en;q=0.8",
    };

    if (existingCookies) {
      headers["Cookie"] = existingCookies;
    }

    const referer = req.get("referer");
    if (referer && referer.includes("/login-proxy/")) {
      const match = referer.match(/\/login-proxy\/(.+)/);
      if (match) {
        try {
          const refUrl = decodeURIComponent(match[1]);
          headers["Referer"] = refUrl;
          headers["Origin"] = new URL(refUrl).origin;
        } catch {}
      }
    }

    const contentType = req.get("content-type");
    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
      redirect: "manual",
    };

    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      if (contentType?.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams(req.body as Record<string, string>);
        fetchOptions.body = params.toString();
      } else if (contentType?.includes("application/json")) {
        fetchOptions.body = JSON.stringify(req.body);
      } else if (Buffer.isBuffer(req.body)) {
        fetchOptions.body = req.body;
      } else if (typeof req.body === "object") {
        const params = new URLSearchParams(req.body as Record<string, string>);
        fetchOptions.body = params.toString();
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    for (const cookieStr of setCookieHeaders) {
      try {
        const cookie = Cookie.parse(cookieStr);
        if (cookie) {
          await cookieJar.setCookie(cookie, targetUrl);
          console.log(`[LoginProxy] Captured cookie: ${cookie.key} for user ${req.user.id}`);
        }
      } catch (err) {
        console.error("[LoginProxy] Failed to parse cookie:", err);
      }
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (location) {
        const absoluteLocation = new URL(location, targetUrl).href;
        if (isDomainAllowed(absoluteLocation)) {
          const proxyLocation = `/api/login-bridge/login-proxy/${encodeURIComponent(absoluteLocation)}`;
          return res.redirect(response.status === 303 ? 303 : 302, proxyLocation);
        } else {
          return res.redirect(response.status, absoluteLocation);
        }
      }
    }

    res.status(response.status);
    
    const respContentType = response.headers.get("content-type") || "";
    res.setHeader("Content-Type", respContentType);

    if (respContentType.includes("text/html")) {
      let html = await response.text();
      
      const baseUrl = `${parsed.protocol}//${parsed.host}`;
      const basePath = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      
      html = html.replace(
        /(action|href|src)=["'](?!(?:https?:|data:|javascript:|#|mailto:))([^"']+)["']/gi,
        (match, attr, path) => {
          if (path.startsWith("//")) {
            const absUrl = `${parsed.protocol}${path}`;
            return `${attr}="${absUrl}"`;
          }
          let absUrl: string;
          if (path.startsWith("/")) {
            absUrl = `${baseUrl}${path}`;
          } else {
            absUrl = new URL(path, basePath).href;
          }
          if (attr.toLowerCase() === "action") {
            return `${attr}="/api/login-bridge/login-proxy/${encodeURIComponent(absUrl)}"`;
          }
          if (attr.toLowerCase() === "href" && !path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i)) {
            return `${attr}="/api/login-bridge/login-proxy/${encodeURIComponent(absUrl)}"`;
          }
          return `${attr}="${absUrl}"`;
        }
      );
      
      html = html.replace(
        /<\/body>/i,
        `<script>
          window.addEventListener('load', function() {
            document.querySelectorAll('form').forEach(function(form) {
              if (form.action && !form.action.includes('/api/login-bridge/login-proxy/')) {
                var absAction = new URL(form.action, '${basePath}').href;
                if (!absAction.startsWith('/api/')) {
                  form.action = '/api/login-bridge/login-proxy/' + encodeURIComponent(absAction);
                }
              }
            });
            document.querySelectorAll('a').forEach(function(link) {
              if (link.href && !link.href.includes('/api/login-bridge/login-proxy/') && link.href.includes('econeteditora.com.br')) {
                link.href = '/api/login-bridge/login-proxy/' + encodeURIComponent(link.href);
              }
            });
          });
        </script></body>`
      );
      
      res.send(html);
    } else if (respContentType.includes("text/css")) {
      let css = await response.text();
      const baseUrl = `${parsed.protocol}//${parsed.host}`;
      css = css.replace(
        /url\(["']?(?!(?:https?:|data:))([^"')]+)["']?\)/gi,
        (match, path) => {
          if (path.startsWith("//")) {
            return `url(${parsed.protocol}${path})`;
          }
          if (path.startsWith("/")) {
            return `url(${baseUrl}${path})`;
          }
          const absUrl = new URL(path, targetUrl).href;
          return `url(${absUrl})`;
        }
      );
      res.send(css);
    } else {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (error: any) {
    console.error("[LoginProxy] Error:", error);
    res.status(500).send("Proxy error: " + error.message);
  }
});

router.get("/check-session", async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    const cookieJar = getCookieJar(req.user.id);
    const cookies = await cookieJar.getCookies(url);
    
    const hasCookies = cookies.length > 0;
    const cookieNames = cookies.map(c => c.key);
    
    res.json({ 
      hasCookies,
      cookieCount: cookies.length,
      cookieNames,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to check session" });
  }
});

router.post("/econet-login", async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { cpf, password } = req.body;
    if (!cpf || !password) {
      return res.status(400).json({ error: "Missing cpf or password" });
    }

    const cookieJar = getCookieJar(req.user.id);
    
    const loginUrl = "https://www.econeteditora.com.br/links/login/index.php";
    
    const formData = new URLSearchParams();
    formData.append("login_ec", cpf);
    formData.append("senha_ec", password);
    formData.append("logar", "1");

    const response = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Referer": "https://www.econeteditora.com.br/novo/index.php",
        "Origin": "https://www.econeteditora.com.br",
      },
      redirect: "manual",
    });

    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    let capturedCookies = 0;
    
    for (const cookieStr of setCookieHeaders) {
      try {
        const cookie = Cookie.parse(cookieStr);
        if (cookie) {
          await cookieJar.setCookie(cookie, "https://www.econeteditora.com.br/");
          capturedCookies++;
          console.log(`[EconetLogin] Captured cookie: ${cookie.key} for user ${req.user.id}`);
        }
      } catch (err) {
        console.error("[EconetLogin] Failed to parse cookie:", err);
      }
    }

    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    const location = response.headers.get("location") || "";
    
    const isSuccess = isRedirect && !location.includes("erro") && !location.includes("login");
    
    if (isSuccess && capturedCookies > 0) {
      res.json({ 
        success: true, 
        message: "Login realizado com sucesso!",
        cookiesCaptured: capturedCookies
      });
    } else {
      const htmlBody = await response.text();
      const hasError = htmlBody.includes("inválid") || htmlBody.includes("incorret") || htmlBody.includes("erro");
      
      res.json({ 
        success: false, 
        message: hasError ? "CPF ou senha incorretos" : "Falha no login - verifique suas credenciais",
        cookiesCaptured: capturedCookies
      });
    }
  } catch (error: any) {
    console.error("[EconetLogin] Error:", error);
    res.status(500).json({ error: "Erro ao fazer login: " + error.message });
  }
});

export default router;
