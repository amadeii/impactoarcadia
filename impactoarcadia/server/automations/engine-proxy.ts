import type { Express, Request, Response } from "express";

const AUTO_ENGINE_HOST = process.env.AUTOMATION_ENGINE_HOST || "localhost";
const AUTO_ENGINE_PORT = parseInt(process.env.AUTOMATION_PORT || process.env.AUTOMATION_ENGINE_PORT || "8005", 10);
const AUTO_ENGINE_URL = `http://${AUTO_ENGINE_HOST}:${AUTO_ENGINE_PORT}`;
const AUTO_ENGINE_TIMEOUT = 30000;

async function proxyToEngine(path: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTO_ENGINE_TIMEOUT);

  try {
    const response = await fetch(`${AUTO_ENGINE_URL}${path}`, {
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
      throw new Error(error.detail || `Automation Engine error: ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Automation Engine timeout");
    }
    throw err;
  }
}

export function registerAutomationEngineRoutes(app: Express): void {
  app.get("/api/automation-engine/health", async (_req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/health");
      res.json({ status: "online", ...data });
    } catch (err: any) {
      res.json({
        status: "offline",
        service: "automation-engine",
        port: AUTO_ENGINE_PORT,
        error: err.message,
      });
    }
  });

  app.get("/api/automation-engine/version", async (_req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/version");
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/automation-engine/metrics", async (_req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/metrics");
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/automation-engine/scheduler/entries", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/scheduler/entries");
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/automation-engine/scheduler/entries", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/scheduler/entries", {
        method: "POST",
        body: JSON.stringify(req.body),
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.delete("/api/automation-engine/scheduler/entries/:entryId", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine(`/scheduler/entries/${req.params.entryId}`, {
        method: "DELETE",
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/automation-engine/scheduler/start", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/scheduler/start", { method: "POST" });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/automation-engine/scheduler/stop", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/scheduler/stop", { method: "POST" });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/automation-engine/events/emit", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const { event_type, payload } = req.body;
      const data = await proxyToEngine(`/events/emit?event_type=${encodeURIComponent(event_type)}`, {
        method: "POST",
        body: JSON.stringify(payload || {}),
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/automation-engine/events/subscribe", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const { event_type, handler_id, config } = req.body;
      const data = await proxyToEngine(`/events/subscribe?event_type=${encodeURIComponent(event_type)}&handler_id=${encodeURIComponent(handler_id)}`, {
        method: "POST",
        body: JSON.stringify(config || {}),
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/automation-engine/events/subscribers", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const eventType = req.query.event_type ? `?event_type=${encodeURIComponent(req.query.event_type as string)}` : "";
      const data = await proxyToEngine(`/events/subscribers${eventType}`);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/automation-engine/events/history", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const params = new URLSearchParams();
      if (req.query.limit) params.set("limit", req.query.limit as string);
      if (req.query.event_type) params.set("event_type", req.query.event_type as string);
      const data = await proxyToEngine(`/events/history?${params.toString()}`);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/automation-engine/events/types", async (req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/events/types");
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/automation-engine/workflows/register", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/workflows/register", {
        method: "POST",
        body: JSON.stringify(req.body),
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/automation-engine/workflows", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine("/workflows");
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/automation-engine/workflows/:workflowId", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine(`/workflows/${req.params.workflowId}`);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/automation-engine/workflows/:workflowId/execute", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine(`/workflows/${req.params.workflowId}/execute`, {
        method: "POST",
        body: JSON.stringify(req.body),
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/automation-engine/workflows/:workflowId/executions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine(`/workflows/${req.params.workflowId}/executions?limit=${req.query.limit || 50}`);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/automation-engine/executions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const data = await proxyToEngine(`/executions?limit=${req.query.limit || 50}`);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/automation-engine/cron/validate", async (req: Request, res: Response) => {
    try {
      const { expression } = req.body;
      const data = await proxyToEngine(`/cron/validate?expression=${encodeURIComponent(expression)}`, {
        method: "POST",
      });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  console.log(`[Automation Engine Proxy] Rotas registradas -> ${AUTO_ENGINE_URL}`);
}
