import { Express, Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { startLaravelServer } from "./launcher";

const PLUS_HOST = process.env.PLUS_HOST || "localhost";
const PLUS_PORT = parseInt(process.env.PLUS_PORT || "8080", 10);
const PLUS_TIMEOUT = parseInt(process.env.PLUS_TIMEOUT || "60000", 10);
const AUTO_START = process.env.PLUS_AUTO_START !== "false";

export async function setupPlusProxy(app: Express): Promise<void> {
  const plusTarget = `http://${PLUS_HOST}:${PLUS_PORT}`;
  
  if (AUTO_START) {
    await startLaravelServer();
  }
  
  // Simple transparent proxy - only rewrite Location headers
  const plusProxy = createProxyMiddleware({
    target: plusTarget,
    changeOrigin: true,
    timeout: PLUS_TIMEOUT,
    proxyTimeout: PLUS_TIMEOUT,
    pathRewrite: (path: string) => {
      const rewritten = path.replace(/^\/plus/, "");
      // /plus or /plus/ -> send /empresas directly (Laravel's actual home page)
      if (rewritten === "" || rewritten === "/") {
        return "/empresas";
      }
      // /plus/home -> send /empresas directly (avoids redirect chain)
      if (rewritten === "/home") {
        return "/empresas";
      }
      return rewritten;
    },
    on: {
      error: (err, req, res) => {
        console.error("[Plus Proxy] Error:", err.message);
        if (res && typeof (res as Response).status === "function") {
          (res as Response).status(502).json({
            error: "Arcádia Plus não disponível",
            message: `Laravel não está rodando em ${plusTarget}`
          });
        }
      },
      proxyReq: (proxyReq, req) => {
        console.log(`[Plus Proxy] ${req.method} ${req.url} -> ${plusTarget}`);
        const forwardedHost = req.headers['x-forwarded-host'];
        const host = (typeof forwardedHost === 'string' ? forwardedHost : req.headers.host) || 'localhost';
        const forwardedProto = req.headers['x-forwarded-proto'];
        const proto = (typeof forwardedProto === 'string' ? forwardedProto : 'https');
        proxyReq.setHeader('X-Forwarded-Host', host);
        proxyReq.setHeader('X-Forwarded-Proto', proto);
        proxyReq.setHeader('X-Forwarded-Prefix', '/plus');
      },
      proxyRes: (proxyRes) => {
        const location = proxyRes.headers["location"];
        if (location && typeof location === "string") {
          let newLocation = location;
          newLocation = newLocation.replace(`http://${PLUS_HOST}:${PLUS_PORT}`, "/plus");
          newLocation = newLocation.replace(/http:\/\/localhost:8080/g, "/plus");
          if (newLocation.startsWith("/") && !newLocation.startsWith("/plus")) {
            newLocation = "/plus" + newLocation;
          }
          // Keep user at /plus instead of redirecting to /plus/empresas
          if (newLocation === "/plus/empresas" || newLocation === "/plus/home") {
            newLocation = "/plus";
          }
          proxyRes.headers["location"] = newLocation;
        }
      },
    },
  });

  // All Plus routes go through simple proxy (including auto-login)
  // Laravel handles its own authentication via /plus/auto-login
  app.use("/plus", plusProxy);

  // Status check - Laravel redirects (302) count as online
  app.get("/api/plus/status", async (_req: Request, res: Response) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${plusTarget}/`, {
        signal: controller.signal,
        redirect: "manual"
      });
      clearTimeout(timeout);
      
      const isRedirect = response.status >= 300 && response.status < 400;
      if (response.ok || isRedirect) {
        res.json({ 
          status: "online", 
          host: PLUS_HOST,
          port: PLUS_PORT,
          app: "Arcadia Plus",
          version: "Laravel"
        });
      } else {
        res.json({ status: "error", host: PLUS_HOST, port: PLUS_PORT, httpStatus: response.status });
      }
    } catch (err: any) {
      res.json({ 
        status: "offline", 
        host: PLUS_HOST,
        port: PLUS_PORT,
        error: err.name === 'AbortError' ? 'timeout' : err.message
      });
    }
  });

  console.log(`[Plus Proxy] Configurado: /plus -> ${plusTarget}`);
}
