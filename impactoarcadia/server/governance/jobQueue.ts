import { db } from "../../db/index";
import {
  xosJobQueue,
  xosAgentMetrics,
  type XosJob,
  type InsertXosJob,
  type XosAgentMetric,
} from "@shared/schema";
import { eq, desc, and, sql, lte, isNull, asc } from "drizzle-orm";

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

class JobQueueService {
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 10000;
  private jobHandlers: Map<string, (job: XosJob) => Promise<JobResult>> = new Map();

  registerHandler(type: string, handler: (job: XosJob) => Promise<JobResult>): void {
    this.jobHandlers.set(type, handler);
    console.log(`[JobQueue] Handler registrado para tipo: ${type}`);
  }

  async enqueue(job: InsertXosJob): Promise<XosJob> {
    const [created] = await db.insert(xosJobQueue).values({
      ...job,
      status: "pending",
      attempts: 0,
    }).returning();
    console.log(`[JobQueue] Job #${created.id} enfileirado: ${created.type}`);
    return created;
  }

  async enqueueMany(jobs: InsertXosJob[]): Promise<XosJob[]> {
    if (jobs.length === 0) return [];
    const created = await db.insert(xosJobQueue).values(
      jobs.map(j => ({ ...j, status: "pending", attempts: 0 }))
    ).returning();
    console.log(`[JobQueue] ${created.length} jobs enfileirados em lote`);
    return created;
  }

  async claimJob(agentName: string, types?: string[]): Promise<XosJob | null> {
    const now = new Date();
    let typeFilter = sql`TRUE`;
    if (types && types.length > 0) {
      typeFilter = sql`${xosJobQueue.type} IN (${sql.join(types.map(t => sql`${t}`), sql`, `)})`;
    }

    const claimed = await db.execute(sql`
      UPDATE xos_job_queue
      SET status = 'processing',
          assigned_agent = ${agentName},
          started_at = ${now},
          attempts = COALESCE(attempts, 0) + 1
      WHERE id = (
        SELECT id FROM xos_job_queue
        WHERE status = 'pending'
          AND (scheduled_at IS NULL OR scheduled_at <= ${now})
          AND ${typeFilter}
        ORDER BY priority ASC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);

    const rows = (claimed as any).rows || claimed;
    if (!rows || rows.length === 0) return null;

    return rows[0] as XosJob;
  }

  async completeJob(jobId: number, result: JobResult): Promise<void> {
    await db.update(xosJobQueue).set({
      status: result.success ? "completed" : "failed",
      result: result.data || null,
      error: result.error || null,
      completedAt: new Date(),
    }).where(eq(xosJobQueue.id, jobId));
  }

  async retryJob(jobId: number): Promise<boolean> {
    const [job] = await db.select().from(xosJobQueue).where(eq(xosJobQueue.id, jobId));
    if (!job) return false;
    if ((job.attempts || 0) >= (job.maxAttempts || 3)) {
      await db.update(xosJobQueue).set({ status: "dead_letter" }).where(eq(xosJobQueue.id, jobId));
      return false;
    }
    await db.update(xosJobQueue).set({
      status: "pending",
      assignedAgent: null,
      startedAt: null,
      error: null,
    }).where(eq(xosJobQueue.id, jobId));
    return true;
  }

  async getJobs(status?: string, limit: number = 50): Promise<XosJob[]> {
    if (status) {
      return db.select().from(xosJobQueue)
        .where(eq(xosJobQueue.status, status))
        .orderBy(desc(xosJobQueue.createdAt))
        .limit(limit);
    }
    return db.select().from(xosJobQueue)
      .orderBy(desc(xosJobQueue.createdAt))
      .limit(limit);
  }

  async getJobStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
    total: number;
  }> {
    const [stats] = await db.select({
      pending: sql<number>`count(*) filter (where status = 'pending')`,
      processing: sql<number>`count(*) filter (where status = 'processing')`,
      completed: sql<number>`count(*) filter (where status = 'completed')`,
      failed: sql<number>`count(*) filter (where status = 'failed')`,
      deadLetter: sql<number>`count(*) filter (where status = 'dead_letter')`,
      total: sql<number>`count(*)`,
    }).from(xosJobQueue);

    return {
      pending: Number(stats.pending),
      processing: Number(stats.processing),
      completed: Number(stats.completed),
      failed: Number(stats.failed),
      deadLetter: Number(stats.deadLetter),
      total: Number(stats.total),
    };
  }

  async cancelJob(jobId: number): Promise<void> {
    await db.update(xosJobQueue).set({ status: "cancelled", completedAt: new Date() }).where(eq(xosJobQueue.id, jobId));
  }

  async recordAgentMetrics(agentName: string, metrics: {
    tasksCompleted?: number;
    tasksFailed?: number;
    avgDurationMs?: number;
    skillsCreated?: number;
    policiesTriggered?: number;
    metadata?: any;
  }): Promise<void> {
    const period = new Date().toISOString().slice(0, 13);
    await db.insert(xosAgentMetrics).values({
      agentName,
      period,
      ...metrics,
    });
  }

  async getAgentMetrics(agentName?: string, limit: number = 100): Promise<XosAgentMetric[]> {
    if (agentName) {
      return db.select().from(xosAgentMetrics)
        .where(eq(xosAgentMetrics.agentName, agentName))
        .orderBy(desc(xosAgentMetrics.createdAt))
        .limit(limit);
    }
    return db.select().from(xosAgentMetrics)
      .orderBy(desc(xosAgentMetrics.createdAt))
      .limit(limit);
  }

  async getAgentSummary(): Promise<Array<{
    agent: string;
    totalCompleted: number;
    totalFailed: number;
    avgDuration: number;
  }>> {
    const rows = await db.select({
      agent: xosAgentMetrics.agentName,
      totalCompleted: sql<number>`coalesce(sum(${xosAgentMetrics.tasksCompleted}), 0)`,
      totalFailed: sql<number>`coalesce(sum(${xosAgentMetrics.tasksFailed}), 0)`,
      avgDuration: sql<number>`coalesce(avg(${xosAgentMetrics.avgDurationMs}), 0)`,
    }).from(xosAgentMetrics)
      .groupBy(xosAgentMetrics.agentName);

    return rows.map(r => ({
      agent: r.agent,
      totalCompleted: Number(r.totalCompleted),
      totalFailed: Number(r.totalFailed),
      avgDuration: Math.round(Number(r.avgDuration)),
    }));
  }

  async cleanupOldJobs(daysOld: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 86400000);
    const result = await db.delete(xosJobQueue)
      .where(and(
        sql`${xosJobQueue.status} IN ('completed', 'cancelled', 'dead_letter')`,
        lte(xosJobQueue.completedAt, cutoff),
      ));
    return 0;
  }

  startProcessing(): void {
    if (this.processingInterval) return;
    this.processingInterval = setInterval(async () => {
      try {
        await this.processNextJobs();
      } catch (error: any) {
        console.error("[JobQueue] Erro no processamento:", error.message);
      }
    }, this.POLL_INTERVAL);
    console.log("[JobQueue] Processamento automático iniciado (intervalo: 10s)");
  }

  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log("[JobQueue] Processamento automático parado");
    }
  }

  private async processNextJobs(): Promise<void> {
    const handlerTypes = Array.from(this.jobHandlers.keys());
    if (handlerTypes.length === 0) return;

    for (let i = 0; i < 5; i++) {
      const job = await this.claimJob("job-processor", handlerTypes);
      if (!job) break;

      const handler = this.jobHandlers.get(job.type);
      if (!handler) continue;

      try {
        const result = await handler(job);
        await this.completeJob(job.id, result);
      } catch (error: any) {
        const canRetry = (job.attempts || 0) < (job.maxAttempts || 3);
        await db.update(xosJobQueue).set({
          status: canRetry ? "pending" : "dead_letter",
          error: error.message,
          assignedAgent: null,
          completedAt: canRetry ? null : new Date(),
        }).where(eq(xosJobQueue.id, job.id));
      }
    }
  }
}

export const jobQueueService = new JobQueueService();
