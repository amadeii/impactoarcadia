/**
 * Arcadia Suite - Blackboard Routes
 * 
 * Rotas da API para o sistema de agentes colaborativos.
 */

import { Router, Request, Response } from "express";
import { blackboardService } from "./service";
import { agents, startAllAgents, stopAllAgents, getAgentsStatus } from "./agents";

const router = Router();

router.post("/task", async (req: Request, res: Response) => {
  try {
    const { title, description, context } = req.body;
    const userId = (req.user as any)?.id || "anonymous";

    if (!title || !description) {
      return res.status(400).json({ 
        success: false, 
        error: "Título e descrição são obrigatórios" 
      });
    }

    const mainTask = await blackboardService.createMainTask(
      title,
      description,
      userId,
      context
    );

    await blackboardService.createSubtask(
      mainTask.id,
      "Projetar solução",
      `Analisar e criar especificação para: ${description}`,
      "architect",
      [],
      { phase: "design" }
    );

    res.json({
      success: true,
      task: mainTask,
      message: "Tarefa criada. Os agentes vão processar automaticamente."
    });
  } catch (error: any) {
    console.error("[Blackboard] Erro ao criar tarefa:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/task/:id", async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    const details = await blackboardService.getTaskWithDetails(taskId);

    if (!details) {
      return res.status(404).json({ success: false, error: "Tarefa não encontrada" });
    }

    res.json({ success: true, ...details });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const tasks = await blackboardService.getRecentTasks(userId, limit);
    
    res.json({ success: true, tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/task/:id/logs", async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    const logs = await blackboardService.getTaskLogs(taskId);
    
    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/task/:id/artifacts", async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    const type = req.query.type as string;
    
    const artifacts = await blackboardService.getArtifactsForTask(taskId, type as any);
    
    res.json({ success: true, artifacts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/agents", async (_req: Request, res: Response) => {
  try {
    const status = getAgentsStatus();
    res.json({ success: true, agents: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/agents/start", async (_req: Request, res: Response) => {
  try {
    startAllAgents();
    res.json({ success: true, message: "Todos os agentes iniciados" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/agents/stop", async (_req: Request, res: Response) => {
  try {
    stopAllAgents();
    res.json({ success: true, message: "Todos os agentes parados" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await blackboardService.getStats();
    const agentsStatus = getAgentsStatus();
    
    res.json({ 
      success: true, 
      stats,
      agents: agentsStatus,
      runningAgents: agentsStatus.filter(a => a.running).length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    const allTasks = await blackboardService.getRecentTasks(undefined, 200);
    const filtered = status ? allTasks.filter(t => t.status === status) : allTasks;
    const total = filtered.length;
    const page = filtered.slice(offset, offset + limit);

    const enriched = await Promise.all(
      page.map(async (task) => {
        const details = await blackboardService.getTaskWithDetails(task.id);
        return {
          ...task,
          subtaskCount: details?.subtasks?.length || 0,
          artifactCount: details?.artifacts?.length || 0,
          logCount: details?.logs?.length || 0,
          subtasks: details?.subtasks?.map(s => ({
            id: s.id,
            title: s.title,
            status: s.status,
            assignedAgent: s.assignedAgent,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
          })) || [],
          artifacts: details?.artifacts?.map(a => ({
            id: a.id,
            type: a.type,
            name: a.name,
            createdBy: a.createdBy,
            createdAt: a.createdAt,
          })) || [],
          timeline: details?.logs?.map(l => ({
            id: l.id,
            agent: l.agentName,
            action: l.action,
            thought: l.thought,
            observation: l.observation,
            createdAt: l.createdAt,
          })) || [],
        };
      })
    );

    res.json({ success: true, tasks: enriched, total, limit, offset });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/develop", async (req: Request, res: Response) => {
  try {
    const { description, autoCommit, targetBranch, images } = req.body;
    const userId = (req.user as any)?.id || "anonymous";

    if (!description) {
      return res.status(400).json({ 
        success: false, 
        error: "Descrição é obrigatória" 
      });
    }

    const hasImages = images && Array.isArray(images) && images.length > 0;
    const enrichedDescription = hasImages
      ? `${description}\n\n[${images.length} imagem(ns) anexada(s) pelo usuário para referência visual]`
      : description;

    const mainTask = await blackboardService.createMainTask(
      `Desenvolvimento: ${description.slice(0, 50)}...`,
      enrichedDescription,
      userId,
      { 
        autoCommit: autoCommit || false, 
        targetBranch: targetBranch || "main",
        source: "dev-center",
        images: hasImages ? images.map((img: any) => ({ name: img.name })) : undefined
      }
    );

    await blackboardService.createSubtask(
      mainTask.id,
      "Projetar solução",
      enrichedDescription,
      "architect",
      [],
      { phase: "design", hasImages }
    );

    const pollResult = async (): Promise<any> => {
      const maxWait = 60000;
      const pollInterval = 1000;
      let elapsed = 0;

      while (elapsed < maxWait) {
        const details = await blackboardService.getTaskWithDetails(mainTask.id);
        
        if (details?.task.status === "completed" || details?.task.status === "failed") {
          return details;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        elapsed += pollInterval;
      }

      return await blackboardService.getTaskWithDetails(mainTask.id);
    };

    const result = await pollResult();

    res.json({
      success: result?.task?.status === "completed",
      phase: result?.task?.status,
      taskId: mainTask.id,
      spec: result?.artifacts?.find((a: any) => a.type === "spec")?.content,
      files: result?.artifacts?.filter((a: any) => a.type === "code")?.map((a: any) => ({ 
        path: a.name, 
        type: a.metadata?.type 
      })),
      validation: result?.artifacts?.find((a: any) => a.name === "validation-report.json")?.content,
      log: result?.logs?.map((l: any) => `[${l.agentName}] ${l.thought}`) || [],
      error: result?.task?.errorMessage
    });
  } catch (error: any) {
    console.error("[Blackboard] Erro no desenvolvimento:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/staged", async (_req: Request, res: Response) => {
  try {
    const allTasks = await blackboardService.getRecentTasks(undefined, 100);
    
    const stagedItems = [];
    for (const task of allTasks) {
      if (task.status !== "completed") continue;
      
      const details = await blackboardService.getTaskWithDetails(task.id);
      if (!details) continue;
      
      const stagingReport = details.artifacts?.find(
        (a: any) => a.name === "staging-report.json" && a.type === "doc"
      );
      
      if (!stagingReport?.content) continue;
      
      let report: any;
      try {
        report = JSON.parse(stagingReport.content);
      } catch { continue; }
      
      if (report.status !== "awaiting_approval") continue;
      
      const codeArtifacts = details.artifacts?.filter((a: any) => a.type === "code") || [];
      const validFiles = codeArtifacts.filter((a: any) => 
        report.stagedFiles?.includes(a.name)
      );
      
      stagedItems.push({
        taskId: task.id,
        mainTaskId: report.mainTaskId || task.parentId,
        title: report.title || task.title,
        description: task.description,
        validationScore: report.validationScore,
        stagedAt: report.stagedAt,
        files: validFiles.map((a: any) => ({
          artifactId: a.id,
          path: a.name,
          content: a.content,
          lines: (a.content || "").split("\n").length,
        })),
        blockedFiles: report.blockedFiles || [],
      });
    }
    
    res.json({ success: true, staged: stagedItems });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/publish/:taskId", async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { toolManager } = await import("../autonomous/tools");
    const { PROTECTED_FILES } = await import("./agents/ExecutorAgent");
    
    const details = await blackboardService.getTaskWithDetails(taskId);
    if (!details) {
      return res.status(404).json({ success: false, error: "Tarefa não encontrada" });
    }
    
    const stagingReport = details.artifacts?.find(
      (a: any) => a.name === "staging-report.json" && a.type === "doc"
    );
    
    if (!stagingReport?.content) {
      return res.status(400).json({ success: false, error: "Nenhum staging encontrado para esta tarefa" });
    }
    
    let report: any;
    try {
      report = JSON.parse(stagingReport.content);
    } catch {
      return res.status(400).json({ success: false, error: "Relatório de staging inválido" });
    }
    
    if (report.status !== "awaiting_approval") {
      return res.status(400).json({ success: false, error: "Tarefa já foi publicada ou descartada" });
    }
    
    const codeArtifacts = details.artifacts?.filter((a: any) => a.type === "code") || [];
    const validFiles = codeArtifacts.filter((a: any) => 
      report.stagedFiles?.includes(a.name) && !PROTECTED_FILES.includes(a.name)
    );
    
    const appliedFiles: string[] = [];
    const errors: string[] = [];
    
    for (const artifact of validFiles) {
      const result = await toolManager.execute("write_file", {
        path: artifact.name,
        content: artifact.content,
        createDirs: true,
      });
      
      if (result.success) {
        appliedFiles.push(artifact.name);
      } else {
        errors.push(`${artifact.name}: ${result.error}`);
      }
    }
    
    if (appliedFiles.length > 0) {
      const mainTask = await blackboardService.getMainTask(taskId);
      const commitMessage = `[Arcadia Publicado] ${mainTask?.title || report.title || "Alterações aprovadas"}`;
      
      await toolManager.execute("git_local_commit", {
        message: commitMessage,
        files: appliedFiles,
      });
    }
    
    report.status = "published";
    report.publishedAt = new Date().toISOString();
    report.publishedFiles = appliedFiles;
    report.publishErrors = errors.length > 0 ? errors : undefined;
    
    await blackboardService.addArtifact(
      taskId,
      "doc",
      "staging-report.json",
      JSON.stringify(report, null, 2),
      "executor"
    );
    
    res.json({
      success: true,
      applied: appliedFiles,
      errors: errors.length > 0 ? errors : undefined,
      message: `${appliedFiles.length} arquivo(s) publicado(s) com sucesso`
    });
  } catch (error: any) {
    console.error("[Blackboard] Erro ao publicar:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/discard/:taskId", async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    
    const details = await blackboardService.getTaskWithDetails(taskId);
    if (!details) {
      return res.status(404).json({ success: false, error: "Tarefa não encontrada" });
    }
    
    const stagingReport = details.artifacts?.find(
      (a: any) => a.name === "staging-report.json" && a.type === "doc"
    );
    
    if (!stagingReport?.content) {
      return res.status(400).json({ success: false, error: "Nenhum staging encontrado" });
    }
    
    let report: any;
    try {
      report = JSON.parse(stagingReport.content);
    } catch {
      return res.status(400).json({ success: false, error: "Relatório inválido" });
    }
    
    report.status = "discarded";
    report.discardedAt = new Date().toISOString();
    
    await blackboardService.addArtifact(
      taskId,
      "doc",
      "staging-report.json",
      JSON.stringify(report, null, 2),
      "executor"
    );
    
    res.json({ success: true, message: "Alterações descartadas" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
