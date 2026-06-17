/**
 * Arcadia Suite - Autonomous Development Routes
 * 
 * Rotas da API para o sistema de desenvolvimento autônomo.
 * 
 * @author Arcadia Development Team
 * @version 1.0.0
 */

import { Router, Request, Response, NextFunction } from "express";
import { orchestrator } from "./agents";
import { toolManager } from "./tools";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      error: "Autenticação necessária",
    });
  }
  if ((req.user as any)?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Permissão negada. Apenas administradores.",
    });
  }
  next();
}

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const agents = orchestrator.getAgentStatus();
    const tools = toolManager.listTools();

    res.json({
      success: true,
      agents,
      tools: tools.map(t => ({ name: t.name, category: t.category })),
      toolCount: tools.length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: "Parâmetro 'description' é obrigatório"
      });
    }

    const result = await orchestrator.preview(description);

    res.json({
      success: true,
      spec: result.spec,
      log: result.log
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/develop", async (req: Request, res: Response) => {
  try {
    const { description, autoCommit, targetBranch } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: "Parâmetro 'description' é obrigatório"
      });
    }

    const result = await orchestrator.develop({
      description,
      autoCommit: autoCommit || false,
      targetBranch: targetBranch || "main"
    });

    res.json({
      success: result.success,
      phase: result.phase,
      spec: result.spec,
      files: result.files?.map(f => ({ path: f.path, type: f.type })),
      validation: result.validation,
      commitUrl: result.commitUrl,
      error: result.error,
      log: result.log
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/tools", async (_req: Request, res: Response) => {
  try {
    const tools = toolManager.listTools();
    const categories = toolManager.listCategories();

    res.json({
      success: true,
      categories,
      tools
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/tools/:name/execute", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const params = req.body;

    const result = await toolManager.execute(name, params);

    res.json({
      success: result.success,
      result: result.result,
      data: result.data,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
