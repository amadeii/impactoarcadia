import type { Express, Request, Response } from "express";

const BI_ENGINE_HOST = process.env.BI_ENGINE_HOST || "localhost";
const BI_ENGINE_PORT = parseInt(process.env.BI_PORT || process.env.BI_ENGINE_PORT || "8004", 10);
const BI_ENGINE_URL = `http://${BI_ENGINE_HOST}:${BI_ENGINE_PORT}`;
const BI_ENGINE_TIMEOUT = 30000;

async function proxyToEngine(path: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BI_ENGINE_TIMEOUT);

  try {
    const response = await fetch(`${BI_ENGINE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `BI Engine error: ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("BI Engine timeout");
    }
    throw err;
  }
}

export function registerBiEngineRoutes(app: Express): void {
  app.get("/api/bi-engine/health", async (_req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/health");
      res.json({ status: "online", ...data });
    } catch (err: any) {
      res.json({
        status: "offline",
        service: "bi-engine",
        port: BI_ENGINE_PORT,
        error: err.message,
      });
    }
  });

  app.get("/api/bi-engine/version", async (_req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/version");
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/bi-engine/metrics", async (_req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/metrics");
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/bi-engine/tables", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/tables");
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/bi-engine/tables/:tableName/columns", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine(`/tables/${req.params.tableName}/columns`);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/bi-engine/tables/:tableName/preview", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const limit = req.query.limit || 50;
      const data = await proxyToEngine(`/tables/${req.params.tableName}/preview?limit=${limit}`);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/bi-engine/tables/:tableName/stats", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine(`/tables/${req.params.tableName}/stats`);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/bi-engine/query", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/query", {
        method: "POST",
        body: JSON.stringify(req.body),
      });
      res.json(data);
    } catch (err: any) {
      res.status(err.message.includes("proibid") ? 400 : 502).json({ error: err.message });
    }
  });

  app.post("/api/bi-engine/chart-data", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/chart-data", {
        method: "POST",
        body: JSON.stringify(req.body),
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/bi-engine/micro-bi", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/micro-bi", {
        method: "POST",
        body: JSON.stringify(req.body),
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/bi-engine/analyze", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/analyze", {
        method: "POST",
        body: JSON.stringify(req.body),
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/bi-engine/aggregate", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/aggregate", {
        method: "POST",
        body: JSON.stringify(req.body),
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/bi-engine/cache/stats", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/cache/stats");
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/bi-engine/cache/invalidate", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/cache/invalidate", {
        method: "POST",
        body: JSON.stringify(req.body),
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  console.log(`[BI Engine Proxy] Rotas registradas -> ${BI_ENGINE_URL}`);
}
