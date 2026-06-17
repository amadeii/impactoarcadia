import type { Express, Request, Response } from "express";
import { manusService } from "./service";

export function registerManusRoutes(app: Express): void {
  const handleManusRun = async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { prompt, attachedFiles, conversationHistory } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const tenantId = req.tenantId ?? 1;
      const result = await manusService.run(req.user!.id, tenantId, prompt, attachedFiles, conversationHistory);
      res.json(result);
    } catch (error) {
      console.error("Manus run error:", error);
      res.status(500).json({ error: "Failed to start agent" });
    }
  };

  app.post("/api/manus/run", handleManusRun);
  app.post("/api/manus/start", handleManusRun);

  app.get("/api/manus/runs/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const runId = parseInt(req.params.id);
      const run = await manusService.getRun(runId);
      
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }
      
      if (run.userId !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(run);
    } catch (error) {
      console.error("Manus get run error:", error);
      res.status(500).json({ error: "Failed to get run" });
    }
  });

  app.get("/api/manus/runs", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const runs = await manusService.getUserRuns(req.user!.id);
      res.json(runs);
    } catch (error) {
      console.error("Manus get runs error:", error);
      res.status(500).json({ error: "Failed to get runs" });
    }
  });
}
