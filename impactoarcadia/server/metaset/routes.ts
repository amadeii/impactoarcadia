import type { Express, Request, Response } from "express";
import { metasetClient } from "./client";

const METASET_HOST = process.env.METABASE_HOST || "localhost";
const METASET_PORT = parseInt(process.env.METABASE_PORT || "8088", 10);
const METASET_URL = `http://${METASET_HOST}:${METASET_PORT}`;
const ADMIN_EMAIL = process.env.METASET_ADMIN_EMAIL || "admin@arcadia.app";
const ADMIN_PASSWORD = process.env.METASET_ADMIN_PASSWORD || "Arcadia2026!BI";

export function registerMetaSetRoutes(app: Express): void {

  app.get("/api/bi/metaset/autologin", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });

      const sessionResp = await fetch(`${METASET_URL}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });

      if (!sessionResp.ok) {
        return res.status(502).json({ error: "Falha ao autenticar no MetaSet" });
      }

      const session = await sessionResp.json();
      const token = session.id;

      res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>MetaSet</title>
<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f5f7fa;}
.loading{text-align:center;color:#1f334d}.spinner{width:40px;height:40px;border:4px solid #e8ecf1;border-top-color:#c89b3c;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="loading"><div class="spinner"></div><p>Conectando ao MetaSet...</p></div>
<script>
document.cookie = "metabase.SESSION=${token}; path=/metabase; SameSite=Lax";
setTimeout(function() { window.location.href = "/metabase/"; }, 500);
</script></body></html>`);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/bi/metaset/health", async (_req: Request, res: Response) => {
    try {
      const health = await metasetClient.isHealthy();
      res.json({ service: "MetaSet", ...health });
    } catch (err: any) {
      res.json({ service: "MetaSet", online: false, error: err.message });
    }
  });

  app.get("/api/bi/metaset/tables", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const tables = await metasetClient.getTables();
      res.json(tables);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/bi/metaset/tables/:tableId/fields", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const fields = await metasetClient.getTableFields(parseInt(req.params.tableId));
      res.json(fields);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/bi/metaset/query", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const { query, limit } = req.body;
      if (!query) return res.status(400).json({ error: "Query is required" });
      const result = await metasetClient.runNativeQuery(query, limit);
      res.json(result);
    } catch (err: any) {
      res.status(err.message.includes("proibid") || err.message.includes("SELECT") ? 400 : 502).json({ error: err.message });
    }
  });

  app.get("/api/bi/metaset/questions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const questions = await metasetClient.listQuestions();
      res.json(questions);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/bi/metaset/questions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const { name, query, chartType, description } = req.body;
      if (!name || !query) return res.status(400).json({ error: "name and query are required" });
      const question = await metasetClient.createQuestion({
        name,
        queryType: "native",
        query,
        chartType,
        description,
      });
      res.json(question);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/bi/metaset/questions/:id/run", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const result = await metasetClient.runQuestion(parseInt(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.delete("/api/bi/metaset/questions/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      await metasetClient.deleteQuestion(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/bi/metaset/dashboards", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const dashboards = await metasetClient.listDashboards();
      res.json(dashboards);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/bi/metaset/dashboards", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const dashboard = await metasetClient.createDashboard({ name, description });
      res.json(dashboard);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/bi/metaset/dashboards/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const dashboard = await metasetClient.getDashboard(parseInt(req.params.id));
      res.json(dashboard);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/bi/metaset/dashboards/:id/cards", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const { questionId, x, y, width, height } = req.body;
      if (!questionId) return res.status(400).json({ error: "questionId is required" });
      await metasetClient.addQuestionToDashboard(
        parseInt(req.params.id),
        questionId,
        { x: x || 0, y: y || 0, w: width || 6, h: height || 4 }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.delete("/api/bi/metaset/dashboards/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      await metasetClient.deleteDashboard(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post("/api/bi/metaset/sync", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      await metasetClient.syncDatabase();
      res.json({ success: true, message: "Sincronização iniciada" });
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/api/bi/metaset/suggest/:tableName", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const suggestions = await metasetClient.getAutoSuggestions(req.params.tableName);
      res.json(suggestions);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  console.log("[MetaSet] Rotas do motor BI registradas em /api/bi/metaset/*");
}
