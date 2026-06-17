import type { Express, Request, Response } from "express";

const COMM_ENGINE_HOST = process.env.COMM_ENGINE_HOST || "localhost";
const COMM_ENGINE_PORT = parseInt(process.env.COMM_ENGINE_PORT || "8006", 10);
const COMM_ENGINE_URL = `http://${COMM_ENGINE_HOST}:${COMM_ENGINE_PORT}`;
const COMM_ENGINE_TIMEOUT = 15000;

async function proxyToEngine(path: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COMM_ENGINE_TIMEOUT);

  try {
    const response = await fetch(`${COMM_ENGINE_URL}${path}`, {
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
      throw new Error(error.detail || `Communication Engine error: ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Communication Engine timeout");
    }
    throw err;
  }
}

export function registerCommEngineRoutes(app: Express): void {
  app.get("/api/comm/health", async (_req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/health");
      res.json({ status: "online", ...data });
    } catch (err: any) {
      res.json({
        status: "offline",
        service: "communication-engine",
        port: COMM_ENGINE_PORT,
        error: err.message,
      });
    }
  });

  app.get("/api/comm/v1/contacts", async (req: Request, res: Response) => {
    try {
      const params = new URLSearchParams(req.query as any).toString();
      const data = await proxyToEngine(`/v1/contacts${params ? "?" + params : ""}`);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/comm/v1/contacts/:id", async (req: Request, res: Response) => {
    try {
      const params = new URLSearchParams(req.query as any).toString();
      const data = await proxyToEngine(`/v1/contacts/${req.params.id}${params ? "?" + params : ""}`);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/comm/v1/threads", async (req: Request, res: Response) => {
    try {
      const params = new URLSearchParams(req.query as any).toString();
      const data = await proxyToEngine(`/v1/threads${params ? "?" + params : ""}`);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/comm/v1/threads/:origin/:id/messages", async (req: Request, res: Response) => {
    try {
      const data = await proxyToEngine(`/v1/threads/${req.params.origin}/${req.params.id}/messages`);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/comm/v1/channels", async (_req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/v1/channels");
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/comm/v1/queues", async (_req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/v1/queues");
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/comm/v1/quick-messages", async (_req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/v1/quick-messages");
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/comm/v1/stats", async (_req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/v1/stats");
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/comm/v1/events/pending", async (req: Request, res: Response) => {
    try {
      const params = new URLSearchParams(req.query as any).toString();
      const data = await proxyToEngine(`/v1/events/pending${params ? "?" + params : ""}`);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/comm/v1/events", async (req: Request, res: Response) => {
    try {
      const data = await proxyToEngine("/v1/events", {
        method: "POST",
        body: JSON.stringify(req.body),
      });
      res.status(201).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/comm/v1/events/:id/ack", async (req: Request, res: Response) => {
    try {
      const data = await proxyToEngine(`/v1/events/${req.params.id}/ack`, {
        method: "POST",
        body: JSON.stringify(req.body),
      });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/comm/v1/agent/context/:contactIdentifier", async (req: Request, res: Response) => {
    try {
      const data = await proxyToEngine(`/v1/agent/context/${encodeURIComponent(req.params.contactIdentifier)}`);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[Communication Engine Proxy] Rotas registradas -> http://localhost:" + COMM_ENGINE_PORT);
}
