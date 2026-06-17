/**
 * Arcadia Suite - Blackboard Service
 * 
 * Gerencia o estado compartilhado entre os agentes colaborativos.
 * Implementa o padrão Blackboard para comunicação entre agentes.
 * 
 * @author Arcadia Development Team
 * @version 1.0.0
 */

import { db } from "../../db/index";
import { 
  blackboardTasks, 
  blackboardArtifacts, 
  blackboardAgentLogs,
  type BlackboardTask,
  type BlackboardArtifact,
  type InsertBlackboardTask,
  type InsertBlackboardArtifact
} from "@shared/schema";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { EventEmitter } from "events";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "blocked";
export type TaskType = "main_task" | "subtask";
export type AgentName = "dispatcher" | "architect" | "generator" | "validator" | "executor" | "evolution" | "researcher";
export type ArtifactType = "spec" | "code" | "test" | "doc" | "config" | "analysis";

export interface TaskUpdate {
  taskId: number;
  status: TaskStatus;
  agentName: AgentName;
  result?: any;
}

class BlackboardService extends EventEmitter {
  private pollingAgents: Map<AgentName, NodeJS.Timeout> = new Map();

  async createMainTask(
    title: string, 
    description: string, 
    userId: string,
    context?: any
  ): Promise<BlackboardTask> {
    const [task] = await db.insert(blackboardTasks).values({
      type: "main_task",
      title,
      description,
      status: "pending",
      priority: 10,
      userId,
      context: context || {},
    }).returning();

    await this.logAction(task.id, "dispatcher", "created", `Nova tarefa criada: ${title}`);
    this.emit("task:created", task);
    
    return task;
  }

  async createSubtask(
    parentId: number,
    title: string,
    description: string,
    assignedAgent: AgentName,
    dependencies?: number[],
    context?: any
  ): Promise<BlackboardTask> {
    const [task] = await db.insert(blackboardTasks).values({
      type: "subtask",
      parentId,
      title,
      description,
      status: "pending",
      assignedAgent,
      dependencies: dependencies || [],
      context: context || {},
    }).returning();

    await this.logAction(task.id, assignedAgent, "created", `Subtarefa criada: ${title}`);
    this.emit("subtask:created", task);
    
    return task;
  }

  async getTask(taskId: number): Promise<BlackboardTask | null> {
    const [task] = await db.select().from(blackboardTasks).where(eq(blackboardTasks.id, taskId));
    return task || null;
  }

  async getMainTask(taskId: number): Promise<BlackboardTask | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;
    
    if (task.type === "main_task") return task;
    if (task.parentId) return this.getMainTask(task.parentId);
    
    return null;
  }

  async getSubtasks(parentId: number): Promise<BlackboardTask[]> {
    return db.select()
      .from(blackboardTasks)
      .where(eq(blackboardTasks.parentId, parentId))
      .orderBy(blackboardTasks.priority);
  }

  async getPendingTasksForAgent(agentName: AgentName): Promise<BlackboardTask[]> {
    const tasks = await db.select()
      .from(blackboardTasks)
      .where(
        and(
          eq(blackboardTasks.assignedAgent, agentName),
          eq(blackboardTasks.status, "pending")
        )
      )
      .orderBy(desc(blackboardTasks.priority));

    const readyTasks: BlackboardTask[] = [];
    
    for (const task of tasks) {
      const deps = (task.dependencies as number[]) || [];
      if (deps.length === 0) {
        readyTasks.push(task);
        continue;
      }
      
      const depTasks = await Promise.all(deps.map(id => this.getTask(id)));
      const allDepsCompleted = depTasks.every(t => t?.status === "completed");
      
      if (allDepsCompleted) {
        readyTasks.push(task);
      }
    }
    
    return readyTasks;
  }

  async claimTask(taskId: number, agentName: AgentName): Promise<boolean> {
    const result = await db.update(blackboardTasks)
      .set({ 
        status: "in_progress", 
        assignedAgent: agentName,
        startedAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(blackboardTasks.id, taskId),
          eq(blackboardTasks.status, "pending")
        )
      )
      .returning();

    if (result.length > 0) {
      await this.logAction(taskId, agentName, "claimed", `Agente assumiu a tarefa`);
      this.emit("task:claimed", { taskId, agentName });
      return true;
    }
    
    return false;
  }

  async completeTask(
    taskId: number, 
    agentName: AgentName, 
    result?: any
  ): Promise<BlackboardTask> {
    const [task] = await db.update(blackboardTasks)
      .set({ 
        status: "completed", 
        result: result || {},
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(blackboardTasks.id, taskId))
      .returning();

    await this.logAction(taskId, agentName, "completed", `Tarefa concluída`);
    this.emit("task:completed", task);

    if (task.parentId) {
      await this.checkMainTaskCompletion(task.parentId);
    }
    
    return task;
  }

  async failTask(
    taskId: number, 
    agentName: AgentName, 
    errorMessage: string
  ): Promise<BlackboardTask> {
    const [task] = await db.update(blackboardTasks)
      .set({ 
        status: "failed", 
        errorMessage,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(blackboardTasks.id, taskId))
      .returning();

    await this.logAction(taskId, agentName, "failed", errorMessage);
    this.emit("task:failed", task);
    
    return task;
  }

  private async checkMainTaskCompletion(mainTaskId: number): Promise<void> {
    const subtasks = await this.getSubtasks(mainTaskId);
    const allCompleted = subtasks.every(t => t.status === "completed");
    const anyFailed = subtasks.some(t => t.status === "failed");

    if (anyFailed) {
      await db.update(blackboardTasks)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(blackboardTasks.id, mainTaskId));
      
      const [task] = await db.select().from(blackboardTasks).where(eq(blackboardTasks.id, mainTaskId));
      this.emit("maintask:failed", task);
    } else if (allCompleted && subtasks.length > 0) {
      const artifacts = await this.getArtifactsForTask(mainTaskId);
      
      await db.update(blackboardTasks)
        .set({ 
          status: "completed", 
          result: { subtasks: subtasks.length, artifacts: artifacts.length },
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(blackboardTasks.id, mainTaskId));
      
      const [task] = await db.select().from(blackboardTasks).where(eq(blackboardTasks.id, mainTaskId));
      this.emit("maintask:completed", task);
    }
  }

  async addArtifact(
    taskId: number,
    type: ArtifactType,
    name: string,
    content: string,
    createdBy: AgentName,
    metadata?: any
  ): Promise<BlackboardArtifact> {
    const mainTask = await this.getMainTask(taskId);
    const targetTaskId = mainTask?.id || taskId;

    const [artifact] = await db.insert(blackboardArtifacts).values({
      taskId: targetTaskId,
      type,
      name,
      content,
      createdBy,
      metadata: metadata || {},
    }).returning();

    await this.logAction(taskId, createdBy, "artifact_created", `Artefato criado: ${name}`);
    this.emit("artifact:created", artifact);
    
    return artifact;
  }

  async getArtifactsForTask(taskId: number, type?: ArtifactType): Promise<BlackboardArtifact[]> {
    const mainTask = await this.getMainTask(taskId);
    const targetTaskId = mainTask?.id || taskId;

    if (type) {
      return db.select()
        .from(blackboardArtifacts)
        .where(and(
          eq(blackboardArtifacts.taskId, targetTaskId),
          eq(blackboardArtifacts.type, type)
        ))
        .orderBy(desc(blackboardArtifacts.createdAt));
    }
    
    return db.select()
      .from(blackboardArtifacts)
      .where(eq(blackboardArtifacts.taskId, targetTaskId))
      .orderBy(desc(blackboardArtifacts.createdAt));
  }

  async getLatestArtifact(taskId: number, type: ArtifactType): Promise<BlackboardArtifact | null> {
    const artifacts = await this.getArtifactsForTask(taskId, type);
    return artifacts[0] || null;
  }

  async logAction(
    taskId: number | null,
    agentName: AgentName,
    action: string,
    thought: string,
    observation?: string,
    metadata?: any
  ): Promise<void> {
    await db.insert(blackboardAgentLogs).values({
      taskId,
      agentName,
      action,
      thought,
      observation,
      metadata: metadata || {},
    });
  }

  async getTaskLogs(taskId: number): Promise<any[]> {
    return db.select()
      .from(blackboardAgentLogs)
      .where(eq(blackboardAgentLogs.taskId, taskId))
      .orderBy(blackboardAgentLogs.createdAt);
  }

  async getTaskWithDetails(taskId: number): Promise<{
    task: BlackboardTask;
    subtasks: BlackboardTask[];
    artifacts: BlackboardArtifact[];
    logs: any[];
  } | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;

    const [subtasks, artifacts, logs] = await Promise.all([
      this.getSubtasks(taskId),
      this.getArtifactsForTask(taskId),
      this.getTaskLogs(taskId)
    ]);

    return { task, subtasks, artifacts, logs };
  }

  async getRecentTasks(userId?: string, limit = 20): Promise<BlackboardTask[]> {
    if (userId) {
      return db.select()
        .from(blackboardTasks)
        .where(and(
          eq(blackboardTasks.userId, userId),
          eq(blackboardTasks.type, "main_task")
        ))
        .orderBy(desc(blackboardTasks.createdAt))
        .limit(limit);
    }
    
    return db.select()
      .from(blackboardTasks)
      .where(eq(blackboardTasks.type, "main_task"))
      .orderBy(desc(blackboardTasks.createdAt))
      .limit(limit);
  }

  async getStats(): Promise<{
    totalTasks: number;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    artifactsCount: number;
  }> {
    const [tasks] = await db.select({
      total: sql<number>`count(*)`,
      pending: sql<number>`sum(case when status = 'pending' then 1 else 0 end)`,
      completed: sql<number>`sum(case when status = 'completed' then 1 else 0 end)`,
      failed: sql<number>`sum(case when status = 'failed' then 1 else 0 end)`,
    }).from(blackboardTasks);

    const [artifacts] = await db.select({
      count: sql<number>`count(*)`
    }).from(blackboardArtifacts);

    return {
      totalTasks: Number(tasks.total) || 0,
      pendingTasks: Number(tasks.pending) || 0,
      completedTasks: Number(tasks.completed) || 0,
      failedTasks: Number(tasks.failed) || 0,
      artifactsCount: Number(artifacts.count) || 0,
    };
  }

  // ============================================================
  // GUARDRAILS E POLÍTICAS DE SEGURANÇA
  // ============================================================

  private readonly MAX_RETRIES = 2;
  private readonly BLOCKED_PATHS = ["node_modules", ".git", "vendor", ".env"];
  private readonly MAX_FILE_SIZE = 100000; // 100KB

  async retryTask(taskId: number, reason: string): Promise<BlackboardTask | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;

    const context = task.context as any || {};
    const retries = context.retries || 0;

    if (retries >= this.MAX_RETRIES) {
      await this.logAction(taskId, "dispatcher", "max_retries", `Máximo de tentativas atingido (${this.MAX_RETRIES})`);
      return null;
    }

    const [updated] = await db.update(blackboardTasks)
      .set({
        status: "pending",
        errorMessage: null,
        context: { ...context, retries: retries + 1, lastRetryReason: reason },
        updatedAt: new Date(),
      })
      .where(eq(blackboardTasks.id, taskId))
      .returning();

    await this.logAction(taskId, "dispatcher", "retry", `Tarefa reiniciada (tentativa ${retries + 1}): ${reason}`);
    this.emit("task:retried", updated);

    return updated;
  }

  validateFilePath(filePath: string): { valid: boolean; error?: string } {
    for (const blocked of this.BLOCKED_PATHS) {
      if (filePath.includes(blocked)) {
        return { valid: false, error: `Caminho bloqueado: ${blocked}` };
      }
    }

    if (filePath.startsWith("/") || filePath.includes("..")) {
      return { valid: false, error: "Caminho absoluto ou traversal não permitido" };
    }

    const allowedDirs = ["client/src", "server", "shared"];
    const isAllowed = allowedDirs.some(dir => filePath.startsWith(dir));

    if (!isAllowed) {
      return { valid: false, error: `Deve estar em: ${allowedDirs.join(", ")}` };
    }

    return { valid: true };
  }

  validateContent(content: string): { valid: boolean; error?: string } {
    if (content.length > this.MAX_FILE_SIZE) {
      return { valid: false, error: `Conteúdo muito grande (máx ${this.MAX_FILE_SIZE} bytes)` };
    }

    const dangerousPatterns = [
      /process\.env\.[A-Z_]+\s*=/,
      /eval\s*\(/,
      /Function\s*\(/,
      /child_process/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return { valid: false, error: "Padrão potencialmente perigoso detectado" };
      }
    }

    return { valid: true };
  }

  async createRetrySubtask(
    mainTaskId: number,
    failedTaskId: number,
    agentName: AgentName,
    reason: string
  ): Promise<BlackboardTask> {
    const failedTask = await this.getTask(failedTaskId);
    
    return this.createSubtask(
      mainTaskId,
      `Corrigir: ${failedTask?.title || "tarefa"}`,
      `Correção necessária: ${reason}`,
      agentName,
      [],
      { phase: "retry", originalTaskId: failedTaskId, retryReason: reason }
    );
  }
}

export const blackboardService = new BlackboardService();
