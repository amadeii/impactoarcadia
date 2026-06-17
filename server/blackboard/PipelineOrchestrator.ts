import { db } from "../../db/index";
import { blackboardService, type AgentName } from "./service";
import { jobQueueService } from "../governance/jobQueue";
import { governanceService } from "../governance/service";
import { xosDevPipelines, xosStagingChanges, type XosDevPipeline } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";

export type PipelinePhase = "design" | "codegen" | "validation" | "staging" | "evolution";
export type PipelineStatus = "queued" | "running" | "staging_review" | "completed" | "failed";

export interface PipelineBudget {
  maxTokens: number;
  maxTimeMs: number;
  maxCalls: number;
  usedTokens: number;
  usedTimeMs: number;
  usedCalls: number;
  exceeded: boolean;
}

export interface RunbookDecision {
  phase: string;
  agent: string;
  decision: string;
  timestamp: string;
  details?: any;
}

export interface PipelineRunbook {
  context: string;
  decisions: RunbookDecision[];
  validations: any;
  approval: any;
  deployment: any;
}

const DEFAULT_BUDGET: PipelineBudget = {
  maxTokens: 100000,
  maxTimeMs: 600000,
  maxCalls: 100,
  usedTokens: 0,
  usedTimeMs: 0,
  usedCalls: 0,
  exceeded: false,
};

const PHASE_CONFIG: Record<PipelinePhase, { agent: AgentName; next?: PipelinePhase; contextPhase: string }> = {
  design: { agent: "architect", next: "codegen", contextPhase: "design" },
  codegen: { agent: "generator", next: "validation", contextPhase: "codegen" },
  validation: { agent: "validator", next: "staging", contextPhase: "validation" },
  staging: { agent: "executor", next: "evolution", contextPhase: "deploy" },
  evolution: { agent: "evolution", contextPhase: "evolution" },
};

const ALL_PHASES: PipelinePhase[] = ["design", "codegen", "validation", "staging", "evolution"];

class PipelineOrchestrator extends EventEmitter {
  private activeMonitors: Map<number, NodeJS.Timeout> = new Map();

  async createPipeline(prompt: string, userId: string = "system", metadata?: any): Promise<XosDevPipeline> {
    const correlationId = randomUUID();
    const initialPhases: Record<string, any> = {};
    for (const phase of ALL_PHASES) {
      initialPhases[phase] = { status: "pending" };
    }

    const budget: PipelineBudget = {
      ...DEFAULT_BUDGET,
      ...(metadata?.budget || {}),
    };

    const runbook: PipelineRunbook = {
      context: prompt,
      decisions: [],
      validations: null,
      approval: null,
      deployment: null,
    };

    const [pipeline] = await db.insert(xosDevPipelines).values({
      correlationId,
      prompt,
      status: "queued",
      currentPhase: "queued",
      userId,
      phases: initialPhases,
      metadata: metadata || {},
      budget: budget as any,
      runbook: runbook as any,
    }).returning();

    await governanceService.recordAudit({
      agentName: "pipeline-orchestrator",
      action: "pipeline_created",
      target: `Pipeline #${pipeline.id}`,
      decision: "executed",
      justification: `Pipeline criado com correlationId: ${correlationId}`,
      metadata: { correlationId, pipelineId: pipeline.id },
    });

    this.emit("pipeline:created", pipeline);
    return pipeline;
  }

  async startPipeline(pipelineId: number): Promise<XosDevPipeline> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} não encontrado`);

    const mainTask = await blackboardService.createMainTask(
      `Pipeline #${pipelineId}: ${pipeline.prompt.slice(0, 80)}`,
      pipeline.prompt,
      pipeline.userId || "system",
      { pipelineId, source: "pipeline-orchestrator", correlationId: pipeline.correlationId }
    );

    await this.updatePipeline(pipelineId, {
      status: "running",
      currentPhase: "design",
      mainTaskId: mainTask.id,
      startedAt: new Date(),
    });

    await this.addRunbookDecision(pipelineId, "init", "orchestrator", "Pipeline iniciado", { mainTaskId: mainTask.id });
    await this.startPhase(pipelineId, mainTask.id, "design");
    this.monitorPipeline(pipelineId, mainTask.id);

    const updated = await this.getPipeline(pipelineId);
    this.emit("pipeline:started", updated);
    return updated!;
  }

  private async startPhase(pipelineId: number, mainTaskId: number, phase: PipelinePhase): Promise<void> {
    const config = PHASE_CONFIG[phase];
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) return;

    const budgetCheck = await this.checkBudget(pipelineId);
    if (!budgetCheck.ok) {
      await this.failPipeline(pipelineId, `Budget excedido: ${budgetCheck.reason}`);
      return;
    }

    const subtask = await blackboardService.createSubtask(
      mainTaskId,
      `[Pipeline #${pipelineId}] Fase: ${phase}`,
      `Executar fase "${phase}" do pipeline para: ${pipeline.prompt}`,
      config.agent,
      [],
      { phase: config.contextPhase, pipelineId, correlationId: pipeline.correlationId }
    );

    const phases = (pipeline.phases as Record<string, any>) || {};
    phases[phase] = { status: "running", taskId: subtask.id, startedAt: new Date().toISOString() };

    await this.updatePipeline(pipelineId, {
      currentPhase: phase,
      phases,
    });

    await this.addRunbookDecision(pipelineId, phase, config.agent, `Fase ${phase} iniciada`, { taskId: subtask.id });
    await this.trackBudgetCall(pipelineId);

    this.emit("pipeline:phase_started", { pipelineId, phase, taskId: subtask.id, correlationId: pipeline.correlationId });
  }

  private monitorPipeline(pipelineId: number, mainTaskId: number): void {
    if (this.activeMonitors.has(pipelineId)) return;

    const interval = setInterval(async () => {
      try {
        await this.checkPhaseProgress(pipelineId, mainTaskId);
      } catch (error) {
        console.error(`[PipelineOrchestrator] Erro no monitor #${pipelineId}:`, error);
      }
    }, 3000);

    this.activeMonitors.set(pipelineId, interval);
  }

  private stopMonitor(pipelineId: number): void {
    const interval = this.activeMonitors.get(pipelineId);
    if (interval) {
      clearInterval(interval);
      this.activeMonitors.delete(pipelineId);
    }
  }

  private async checkPhaseProgress(pipelineId: number, mainTaskId: number): Promise<void> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline || pipeline.status === "completed" || pipeline.status === "failed") {
      this.stopMonitor(pipelineId);
      return;
    }

    const budgetCheck = await this.checkBudget(pipelineId);
    if (!budgetCheck.ok) {
      await this.failPipeline(pipelineId, `Budget excedido: ${budgetCheck.reason}`);
      return;
    }

    const currentPhase = pipeline.currentPhase;
    if (!currentPhase || currentPhase === "queued") return;

    const phases = (pipeline.phases as Record<string, any>) || {};
    const phaseData = phases[currentPhase];
    if (!phaseData?.taskId) return;

    const task = await blackboardService.getTask(phaseData.taskId);
    if (!task) return;

    await this.trackBudgetTime(pipelineId);

    if (task.status === "completed") {
      phases[currentPhase] = {
        ...phaseData,
        status: "completed",
        completedAt: new Date().toISOString(),
        result: task.result,
      };

      await this.updatePipeline(pipelineId, { phases });
      await this.addRunbookDecision(pipelineId, currentPhase, PHASE_CONFIG[currentPhase as PipelinePhase]?.agent || "unknown", `Fase ${currentPhase} concluída`, task.result);
      this.emit("pipeline:phase_completed", { pipelineId, phase: currentPhase, correlationId: pipeline.correlationId });

      if (currentPhase === "staging") {
        await this.handleStagingComplete(pipelineId, mainTaskId);
        return;
      }

      if (currentPhase === "validation") {
        const validationResult = task.result as any;
        await this.updateRunbookValidation(pipelineId, validationResult);
      }

      const config = PHASE_CONFIG[currentPhase as PipelinePhase];
      if (config?.next) {
        await this.startPhase(pipelineId, mainTaskId, config.next);
      } else {
        await this.completePipeline(pipelineId);
      }
    } else if (task.status === "failed") {
      phases[currentPhase] = {
        ...phaseData,
        status: "failed",
        completedAt: new Date().toISOString(),
      };

      await this.failPipeline(pipelineId, task.errorMessage || `Falha na fase ${currentPhase}`, phases);
    }
  }

  private async handleStagingComplete(pipelineId: number, mainTaskId: number): Promise<void> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) return;

    const details = await blackboardService.getTaskWithDetails(mainTaskId);
    if (!details) return;

    const codeArtifacts = details.artifacts?.filter((a: any) => a.type === "code") || [];

    for (const artifact of codeArtifacts) {
      let originalContent: string | null = null;
      try {
        const { toolManager } = await import("../autonomous/tools");
        const readResult = await toolManager.execute("read_file", { path: artifact.name });
        if (readResult.success && readResult.data?.content) {
          originalContent = readResult.data.content;
        }
      } catch {}

      await db.insert(xosStagingChanges).values({
        pipelineId,
        taskId: mainTaskId,
        correlationId: pipeline.correlationId,
        filePath: artifact.name,
        content: artifact.content || "",
        originalContent,
        action: originalContent ? "modify" : "create",
        status: "pending",
      });
    }

    if (codeArtifacts.length > 0) {
      await this.updatePipeline(pipelineId, {
        status: "staging_review",
        currentPhase: "staging",
      });
      await this.addRunbookDecision(pipelineId, "staging", "executor", `${codeArtifacts.length} arquivos aguardando revisão`);
      this.emit("pipeline:staging_ready", { pipelineId, files: codeArtifacts.length, correlationId: pipeline.correlationId });
    } else {
      await this.startPhase(pipelineId, mainTaskId, "evolution");
    }
  }

  async approveStagingChanges(pipelineId: number, reviewedBy: string = "user", selectedFiles?: string[]): Promise<{ applied: string[]; errors: string[]; skipped: string[] }> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) {
      throw new Error("Pipeline não encontrado");
    }

    const changes = await db.select().from(xosStagingChanges)
      .where(eq(xosStagingChanges.pipelineId, pipelineId));

    let pendingChanges = changes.filter(c => c.status === "pending");

    if (pendingChanges.length === 0) {
      throw new Error("Nenhuma mudança pendente para aprovar");
    }
    const applied: string[] = [];
    const errors: string[] = [];
    const skipped: string[] = [];

    if (selectedFiles && selectedFiles.length > 0) {
      const selected = pendingChanges.filter(c => selectedFiles.includes(c.filePath));
      pendingChanges = selected;
    }

    const sortedPending = [...pendingChanges].sort((a, b) => b.id - a.id);
    const fileMap = new Map<string, typeof pendingChanges[0]>();
    const duplicateIds: number[] = [];
    for (const change of sortedPending) {
      if (fileMap.has(change.filePath)) {
        duplicateIds.push(change.id);
      } else {
        fileMap.set(change.filePath, change);
      }
    }

    if (duplicateIds.length > 0) {
      for (const dupId of duplicateIds) {
        await db.update(xosStagingChanges).set({
          status: "applied",
          reviewedBy,
          reviewedAt: new Date(),
          appliedAt: new Date(),
        }).where(eq(xosStagingChanges.id, dupId));
      }
    }

    const uniqueChanges = Array.from(fileMap.values());

    const { toolManager } = await import("../autonomous/tools");
    const { PROTECTED_FILES } = await import("./agents/ExecutorAgent");

    for (const change of uniqueChanges) {
      if (PROTECTED_FILES.includes(change.filePath)) {
        errors.push(`${change.filePath}: arquivo protegido`);
        await db.update(xosStagingChanges).set({
          status: "failed",
          reviewedBy,
          reviewedAt: new Date(),
        }).where(eq(xosStagingChanges.id, change.id));
        const dupsForProtected = sortedPending.filter(c => c.filePath === change.filePath && c.id !== change.id);
        for (const dup of dupsForProtected) {
          await db.update(xosStagingChanges).set({ status: "failed", reviewedBy, reviewedAt: new Date() })
            .where(eq(xosStagingChanges.id, dup.id));
        }
        continue;
      }

      const result = await toolManager.execute("write_file", {
        path: change.filePath,
        content: change.content,
        createDirs: true,
      });

      if (result.success) {
        applied.push(change.filePath);
        await db.update(xosStagingChanges).set({
          status: "applied",
          reviewedBy,
          reviewedAt: new Date(),
          appliedAt: new Date(),
        }).where(eq(xosStagingChanges.id, change.id));
      } else {
        errors.push(`${change.filePath}: ${result.error}`);
        await db.update(xosStagingChanges).set({
          status: "failed",
          reviewedBy,
          reviewedAt: new Date(),
        }).where(eq(xosStagingChanges.id, change.id));
      }
    }

    const schemaFiles = applied.filter(f => f.startsWith("shared/schemas/") && f.endsWith(".ts"));
    if (schemaFiles.length > 0) {
      try {
        const { registerAndMigrate } = await import("../modules/migrator");
        for (const schemaFile of schemaFiles) {
          const moduleName = schemaFile.replace("shared/schemas/", "").replace(".ts", "");
          if (moduleName && moduleName !== "index" && moduleName !== "loader" && !moduleName.startsWith("_")) {
            const migResult = await registerAndMigrate(moduleName);
            if (migResult.success) {
              console.log(`[Pipeline] Módulo ${moduleName}: schema registrado${migResult.migrationApplied ? " + migração aplicada" : ""}`);
            } else {
              errors.push(`Migração ${moduleName}: ${migResult.error}`);
            }
          }
        }
      } catch (migError: any) {
        console.error("[Pipeline] Erro no migrator:", migError.message);
      }
    }

    if (applied.length > 0) {
      await toolManager.execute("git_local_commit", {
        message: `[Pipeline #${pipelineId}] ${pipeline.prompt.slice(0, 60)}`,
        files: applied,
      });
    }

    await this.updateRunbookApproval(pipelineId, { reviewedBy, applied, errors, skipped, approvedAt: new Date().toISOString() });
    await this.addRunbookDecision(pipelineId, "approval", reviewedBy, `Aprovado: ${applied.length} arquivos`, { applied, errors, skipped });

    await governanceService.recordAudit({
      agentName: reviewedBy,
      action: "staging_approved",
      target: `Pipeline #${pipelineId}`,
      decision: "approved",
      justification: `${applied.length} arquivos aplicados, ${errors.length} erros, ${skipped.length} ignorados`,
      metadata: { correlationId: pipeline.correlationId, pipelineId },
    });

    const remainingPending = await this.getPendingStagingCount(pipelineId);
    if (remainingPending === 0 && (pipeline.status === "staging_review" || pipeline.status === "running")) {
      if (pipeline.mainTaskId && pipeline.status === "staging_review") {
        await this.startPhase(pipelineId, pipeline.mainTaskId, "evolution");
        await this.updatePipeline(pipelineId, { status: "running", currentPhase: "evolution" });
      } else {
        await this.updatePipeline(pipelineId, { status: "completed" });
      }
    }

    this.emit("pipeline:staging_approved", { pipelineId, applied, errors, skipped, correlationId: pipeline.correlationId });

    return { applied, errors, skipped };
  }

  async rollbackPipeline(pipelineId: number, rolledBackBy: string = "user"): Promise<{ restored: string[]; errors: string[] }> {
    const changes = await db.select().from(xosStagingChanges)
      .where(eq(xosStagingChanges.pipelineId, pipelineId));

    const appliedChanges = changes.filter(c => c.status === "applied" && c.originalContent !== null);
    const restored: string[] = [];
    const errors: string[] = [];

    const { toolManager } = await import("../autonomous/tools");

    for (const change of appliedChanges) {
      try {
        if (change.originalContent) {
          const result = await toolManager.execute("write_file", {
            path: change.filePath,
            content: change.originalContent,
          });
          if (result.success) {
            restored.push(change.filePath);
            await db.update(xosStagingChanges).set({
              status: "rolled_back",
              rolledBackAt: new Date(),
            }).where(eq(xosStagingChanges.id, change.id));
          } else {
            errors.push(`${change.filePath}: ${result.error}`);
          }
        } else if (change.action === "create") {
          restored.push(change.filePath);
          await db.update(xosStagingChanges).set({
            status: "rolled_back",
            rolledBackAt: new Date(),
          }).where(eq(xosStagingChanges.id, change.id));
        }
      } catch (err: any) {
        errors.push(`${change.filePath}: ${err.message}`);
      }
    }

    if (restored.length > 0) {
      await toolManager.execute("git_local_commit", {
        message: `[Rollback Pipeline #${pipelineId}] Revertido por ${rolledBackBy}`,
        files: restored,
      });
    }

    await this.updatePipeline(pipelineId, { status: "failed", error: `Rollback executado por ${rolledBackBy}` });
    await this.addRunbookDecision(pipelineId, "rollback", rolledBackBy, `Rollback: ${restored.length} arquivos restaurados`, { restored, errors });

    await governanceService.recordAudit({
      agentName: rolledBackBy,
      action: "pipeline_rollback",
      target: `Pipeline #${pipelineId}`,
      decision: "executed",
      justification: `${restored.length} arquivos restaurados ao estado original`,
      metadata: { correlationId: (await this.getPipeline(pipelineId))?.correlationId, pipelineId },
    });

    this.emit("pipeline:rolled_back", { pipelineId, restored, errors });
    return { restored, errors };
  }

  async rejectStagingChanges(pipelineId: number, reviewedBy: string = "user"): Promise<void> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) {
      throw new Error("Pipeline não encontrado");
    }

    await db.update(xosStagingChanges).set({
      status: "rejected",
      reviewedBy,
      reviewedAt: new Date(),
    }).where(eq(xosStagingChanges.pipelineId, pipelineId));

    await this.updatePipeline(pipelineId, {
      status: "failed",
      error: "Alterações rejeitadas pelo usuário",
    });

    await this.addRunbookDecision(pipelineId, "rejection", reviewedBy, "Alterações rejeitadas pelo usuário");

    this.stopMonitor(pipelineId);
    this.emit("pipeline:staging_rejected", { pipelineId });
  }

  private async completePipeline(pipelineId: number): Promise<void> {
    const pipeline = await this.getPipeline(pipelineId);
    const elapsed = pipeline?.startedAt ? Date.now() - new Date(pipeline.startedAt).getTime() : 0;

    await this.addRunbookDecision(pipelineId, "completion", "orchestrator", `Pipeline concluído em ${Math.round(elapsed / 1000)}s`);

    await this.updatePipeline(pipelineId, {
      status: "completed",
      completedAt: new Date(),
    });

    this.stopMonitor(pipelineId);
    this.emit("pipeline:completed", { pipelineId, correlationId: pipeline?.correlationId });
  }

  private async failPipeline(pipelineId: number, error: string, phases?: Record<string, any>): Promise<void> {
    const updateData: any = { status: "failed", error };
    if (phases) updateData.phases = phases;

    await this.updatePipeline(pipelineId, updateData);
    await this.addRunbookDecision(pipelineId, "failure", "orchestrator", `Pipeline falhou: ${error}`);

    const pipeline = await this.getPipeline(pipelineId);
    this.emit("pipeline:failed", { pipelineId, error, correlationId: pipeline?.correlationId });
    this.stopMonitor(pipelineId);
  }

  private async checkBudget(pipelineId: number): Promise<{ ok: boolean; reason?: string }> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline?.budget) return { ok: true };

    const budget = pipeline.budget as PipelineBudget;
    if (budget.exceeded) return { ok: false, reason: "Budget já foi excedido anteriormente" };

    const elapsed = pipeline.startedAt ? Date.now() - new Date(pipeline.startedAt).getTime() : 0;

    if (elapsed > budget.maxTimeMs) {
      await this.markBudgetExceeded(pipelineId, budget);
      return { ok: false, reason: `Tempo máximo excedido: ${Math.round(elapsed / 1000)}s > ${Math.round(budget.maxTimeMs / 1000)}s` };
    }

    if (budget.usedCalls >= budget.maxCalls) {
      await this.markBudgetExceeded(pipelineId, budget);
      return { ok: false, reason: `Limite de chamadas excedido: ${budget.usedCalls} >= ${budget.maxCalls}` };
    }

    return { ok: true };
  }

  private async trackBudgetCall(pipelineId: number): Promise<void> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline?.budget) return;

    const budget = pipeline.budget as PipelineBudget;
    budget.usedCalls = (budget.usedCalls || 0) + 1;

    await this.updatePipeline(pipelineId, { budget: budget as any });
  }

  private async trackBudgetTime(pipelineId: number): Promise<void> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline?.budget || !pipeline.startedAt) return;

    const budget = pipeline.budget as PipelineBudget;
    budget.usedTimeMs = Date.now() - new Date(pipeline.startedAt).getTime();

    await this.updatePipeline(pipelineId, { budget: budget as any });
  }

  private async markBudgetExceeded(pipelineId: number, budget: PipelineBudget): Promise<void> {
    budget.exceeded = true;
    await this.updatePipeline(pipelineId, { budget: budget as any });
    await this.addRunbookDecision(pipelineId, "budget", "orchestrator", "Budget excedido - pipeline interrompido", budget);
  }

  private async addRunbookDecision(pipelineId: number, phase: string, agent: string, decision: string, details?: any): Promise<void> {
    try {
      const pipeline = await this.getPipeline(pipelineId);
      if (!pipeline) return;

      const runbook = (pipeline.runbook as PipelineRunbook) || { context: "", decisions: [], validations: null, approval: null, deployment: null };
      runbook.decisions = runbook.decisions || [];
      runbook.decisions.push({
        phase,
        agent,
        decision,
        timestamp: new Date().toISOString(),
        details,
      });

      await this.updatePipeline(pipelineId, { runbook: runbook as any });
    } catch {}
  }

  private async updateRunbookValidation(pipelineId: number, validation: any): Promise<void> {
    try {
      const pipeline = await this.getPipeline(pipelineId);
      if (!pipeline) return;

      const runbook = (pipeline.runbook as PipelineRunbook) || { context: "", decisions: [], validations: null, approval: null, deployment: null };
      runbook.validations = validation;

      await this.updatePipeline(pipelineId, { runbook: runbook as any });
    } catch {}
  }

  private async updateRunbookApproval(pipelineId: number, approval: any): Promise<void> {
    try {
      const pipeline = await this.getPipeline(pipelineId);
      if (!pipeline) return;

      const runbook = (pipeline.runbook as PipelineRunbook) || { context: "", decisions: [], validations: null, approval: null, deployment: null };
      runbook.approval = approval;

      await this.updatePipeline(pipelineId, { runbook: runbook as any });
    } catch {}
  }

  async getPipeline(pipelineId: number): Promise<XosDevPipeline | null> {
    const [pipeline] = await db.select().from(xosDevPipelines)
      .where(eq(xosDevPipelines.id, pipelineId));
    return pipeline || null;
  }

  async getPipelineRunbook(pipelineId: number): Promise<PipelineRunbook | null> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline?.runbook) return null;
    return pipeline.runbook as PipelineRunbook;
  }

  async getPipelineWithDetails(pipelineId: number): Promise<any> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) return null;

    const staging = await db.select().from(xosStagingChanges)
      .where(eq(xosStagingChanges.pipelineId, pipelineId));

    let taskDetails = null;
    if (pipeline.mainTaskId) {
      taskDetails = await blackboardService.getTaskWithDetails(pipeline.mainTaskId);
    }

    return {
      pipeline,
      staging,
      task: taskDetails?.task,
      subtasks: taskDetails?.subtasks || [],
      artifacts: taskDetails?.artifacts || [],
      logs: taskDetails?.logs || [],
    };
  }

  async getRecentPipelines(limit: number = 20): Promise<XosDevPipeline[]> {
    return db.select().from(xosDevPipelines)
      .orderBy(sql`created_at DESC`)
      .limit(limit);
  }

  async getStagingChanges(pipelineId: number): Promise<any[]> {
    return db.select().from(xosStagingChanges)
      .where(eq(xosStagingChanges.pipelineId, pipelineId));
  }

  async getPendingStagingCount(pipelineId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(xosStagingChanges)
      .where(sql`${xosStagingChanges.pipelineId} = ${pipelineId} AND ${xosStagingChanges.status} = 'pending'`);
    return Number(result[0]?.count || 0);
  }

  private async updatePipeline(pipelineId: number, data: Partial<XosDevPipeline>): Promise<void> {
    await db.update(xosDevPipelines).set(data as any)
      .where(eq(xosDevPipelines.id, pipelineId));
  }

  registerJobHandlers(): void {
    for (const [phase, _config] of Object.entries(PHASE_CONFIG)) {
      jobQueueService.registerHandler(`pipeline_${phase}`, async (job) => {
        try {
          const { pipelineId, mainTaskId } = job.payload as any;
          await this.startPhase(pipelineId, mainTaskId, phase as PipelinePhase);
          return { success: true, data: { phase, pipelineId } };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      });
    }
    console.log("[PipelineOrchestrator] Job handlers registrados para todas as fases");
  }
}

export const pipelineOrchestrator = new PipelineOrchestrator();
