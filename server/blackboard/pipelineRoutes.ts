import { Router, Request, Response } from "express";
import { pipelineOrchestrator } from "./PipelineOrchestrator";
import { toolManager } from "../autonomous/tools/ToolManager";
import { z } from "zod";

const router = Router();

const createPipelineSchema = z.object({
  prompt: z.string().min(5, "O prompt deve ter pelo menos 5 caracteres"),
  mode: z.enum(["plan", "act"]).optional().default("act"),
  planContext: z.string().nullish(),
  metadata: z.record(z.any()).optional(),
  budget: z.object({
    maxTokens: z.number().optional(),
    maxTimeMs: z.number().optional(),
    maxCalls: z.number().optional(),
  }).optional(),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = createPipelineSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const mode = parsed.data.mode || "act";
    const userId = (req.user as any)?.id || "anonymous";
    const metadata = { 
      ...(parsed.data.metadata || {}), 
      budget: parsed.data.budget,
      mode,
      planContext: parsed.data.planContext || null,
    };

    let prompt = parsed.data.prompt;
    if (mode === "plan") {
      prompt = `[MODO PLANEJAMENTO] Analise o projeto e gere um plano detalhado de implementação. NÃO modifique arquivos. Use apenas ferramentas de leitura (read_file, search_code, list_directory). Gere um documento implementation_plan.md com:\n1. Análise do estado atual\n2. Arquivos que precisam ser criados/modificados\n3. Estratégia passo-a-passo\n4. Dependências e riscos\n\nSolicitação: ${prompt}`;
    } else if (parsed.data.planContext) {
      prompt = `[MODO EXECUÇÃO] Siga o plano de implementação abaixo e execute as mudanças:\n\n--- PLANO ---\n${parsed.data.planContext}\n--- FIM DO PLANO ---\n\nSolicitação original: ${prompt}`;
    }

    const pipeline = await pipelineOrchestrator.createPipeline(prompt, userId, metadata);
    
    toolManager.setActivePipeline(pipeline.id);
    toolManager.setPlanMode(mode === "plan", pipeline.id);
    
    const started = await pipelineOrchestrator.startPipeline(pipeline.id);

    res.json({ success: true, pipeline: started, mode });
  } catch (error: any) {
    console.error("[Pipeline] Erro ao criar:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/agent-terminal", async (req: Request, res: Response) => {
  try {
    const pipelineId = req.query.pipelineId ? parseInt(req.query.pipelineId as string) : undefined;
    const logs = toolManager.getCommandLog(pipelineId);
    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/mode", async (req: Request, res: Response) => {
  const pipelineId = req.query.pipelineId ? parseInt(req.query.pipelineId as string) : undefined;
  if (pipelineId !== undefined) {
    toolManager.setActivePipeline(pipelineId);
  }
  res.json({ success: true, planMode: toolManager.planMode, activePipeline: toolManager.activePipelineId });
});

router.post("/mode", async (req: Request, res: Response) => {
  const { mode, pipelineId } = req.body;
  if (mode !== "plan" && mode !== "act") {
    return res.status(400).json({ success: false, error: "Mode must be 'plan' or 'act'" });
  }
  const pid = pipelineId ? parseInt(pipelineId) : undefined;
  toolManager.setPlanMode(mode === "plan", pid);
  res.json({ success: true, mode, planMode: toolManager.planMode });
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const pipelines = await pipelineOrchestrator.getRecentPipelines(limit);
    const enriched = await Promise.all(pipelines.map(async (p: any) => {
      const pendingCount = await pipelineOrchestrator.getPendingStagingCount(p.id);
      return { ...p, hasPendingChanges: pendingCount > 0, pendingStagingCount: pendingCount };
    }));
    res.json({ success: true, pipelines: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const details = await pipelineOrchestrator.getPipelineWithDetails(id);
    if (!details) {
      return res.status(404).json({ success: false, error: "Pipeline não encontrado" });
    }
    res.json({ success: true, ...details });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:id/staging", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const changes = await pipelineOrchestrator.getStagingChanges(id);
    res.json({ success: true, changes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:id/runbook", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const runbook = await pipelineOrchestrator.getPipelineRunbook(id);
    if (!runbook) {
      return res.status(404).json({ success: false, error: "Runbook não encontrado" });
    }
    res.json({ success: true, runbook });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const approveSchema = z.object({
  selectedFiles: z.array(z.string()).optional(),
});

router.post("/:id/approve", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = approveSchema.safeParse(req.body);
    const selectedFiles = parsed.success ? parsed.data.selectedFiles : undefined;
    const reviewedBy = (req.user as any)?.id || "user";
    const result = await pipelineOrchestrator.approveStagingChanges(id, reviewedBy, selectedFiles);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const reviewedBy = (req.user as any)?.id || "user";
    await pipelineOrchestrator.rejectStagingChanges(id, reviewedBy);
    res.json({ success: true, message: "Alterações rejeitadas" });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/:id/rollback", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const rolledBackBy = (req.user as any)?.id || "user";
    const result = await pipelineOrchestrator.rollbackPipeline(id, rolledBackBy);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/:id/stream", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onPhaseStarted = (d: any) => { if (d.pipelineId === id) sendEvent("phase_started", d); };
  const onPhaseCompleted = (d: any) => { if (d.pipelineId === id) sendEvent("phase_completed", d); };
  const onStagingReady = (d: any) => { if (d.pipelineId === id) sendEvent("staging_ready", d); };
  const onCompleted = (d: any) => { if (d.pipelineId === id) sendEvent("completed", d); };
  const onFailed = (d: any) => { if (d.pipelineId === id) sendEvent("failed", d); };
  const onRolledBack = (d: any) => { if (d.pipelineId === id) sendEvent("rolled_back", d); };

  pipelineOrchestrator.on("pipeline:phase_started", onPhaseStarted);
  pipelineOrchestrator.on("pipeline:phase_completed", onPhaseCompleted);
  pipelineOrchestrator.on("pipeline:staging_ready", onStagingReady);
  pipelineOrchestrator.on("pipeline:completed", onCompleted);
  pipelineOrchestrator.on("pipeline:failed", onFailed);
  pipelineOrchestrator.on("pipeline:rolled_back", onRolledBack);

  const pollInterval = setInterval(async () => {
    try {
      const pipeline = await pipelineOrchestrator.getPipeline(id);
      if (pipeline) {
        sendEvent("status", {
          status: pipeline.status,
          phase: pipeline.currentPhase,
          phases: pipeline.phases,
          budget: pipeline.budget,
          correlationId: pipeline.correlationId,
        });
      }
    } catch {}
  }, 5000);

  const initialPipeline = await pipelineOrchestrator.getPipeline(id);
  if (initialPipeline) {
    sendEvent("status", {
      status: initialPipeline.status,
      phase: initialPipeline.currentPhase,
      phases: initialPipeline.phases,
      budget: initialPipeline.budget,
      correlationId: initialPipeline.correlationId,
    });
  }

  req.on("close", () => {
    clearInterval(pollInterval);
    pipelineOrchestrator.off("pipeline:phase_started", onPhaseStarted);
    pipelineOrchestrator.off("pipeline:phase_completed", onPhaseCompleted);
    pipelineOrchestrator.off("pipeline:staging_ready", onStagingReady);
    pipelineOrchestrator.off("pipeline:completed", onCompleted);
    pipelineOrchestrator.off("pipeline:failed", onFailed);
    pipelineOrchestrator.off("pipeline:rolled_back", onRolledBack);
  });
});

router.get("/modules/status", async (_req: Request, res: Response) => {
  try {
    const { getModuleStatus, listModuleSchemas } = await import("../modules/migrator");
    const { getLoadedModules } = await import("../modules/loader");

    const status = await getModuleStatus();
    const schemas = await listModuleSchemas();
    const loadedRoutes = getLoadedModules();

    res.json({
      success: true,
      modules: status,
      registeredSchemas: schemas,
      loadedRoutes,
      allowedPaths: {
        schemas: "shared/schemas/{moduleName}.ts",
        routes: "server/modules/{moduleName}.ts",
        pages: "client/src/pages/{ModuleName}.tsx",
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
