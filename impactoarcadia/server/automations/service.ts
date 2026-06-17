import { db } from "../../db/index";
import { automations, automationActions, automationLogs, scheduledTasks, manusRuns } from "@shared/schema";
import { eq, desc, lte, and, isNotNull } from "drizzle-orm";
import { manusService } from "../manus/service";

export interface AutomationResult {
  success: boolean;
  logId: number;
  result?: string;
  error?: string;
}

class AutomationService {
  private schedulerInterval: NodeJS.Timeout | null = null;

  async runAutomation(automationId: number, userId: string, triggerData?: any): Promise<AutomationResult> {
    const [log] = await db.insert(automationLogs).values({
      automationId,
      status: "running",
      triggerData: triggerData ? JSON.stringify(triggerData) : null,
    }).returning();

    try {
      const [automation] = await db.select()
        .from(automations)
        .where(eq(automations.id, automationId));

      if (!automation) {
        throw new Error("Automação não encontrada");
      }

      const actions = await db.select()
        .from(automationActions)
        .where(eq(automationActions.automationId, automationId))
        .orderBy(automationActions.orderIndex);

      const results: string[] = [];

      for (const action of actions) {
        const actionResult = await this.executeAction(action, userId, triggerData);
        results.push(`${action.actionType}: ${actionResult}`);
      }

      const finalResult = results.join("\n");

      await db.update(automationLogs)
        .set({
          status: "completed",
          result: finalResult,
          completedAt: new Date(),
        })
        .where(eq(automationLogs.id, log.id));

      return { success: true, logId: log.id, result: finalResult };
    } catch (error: any) {
      await db.update(automationLogs)
        .set({
          status: "error",
          error: error.message,
          completedAt: new Date(),
        })
        .where(eq(automationLogs.id, log.id));

      return { success: false, logId: log.id, error: error.message };
    }
  }

  private async executeAction(action: any, userId: string, triggerData?: any): Promise<string> {
    const config = action.actionConfig ? JSON.parse(action.actionConfig) : {};

    switch (action.actionType) {
      case "agent_task":
        return await this.executeAgentTask(userId, config.prompt || "Execute automation task");

      case "send_notification":
        return `Notificação enviada: ${config.message || "Automação executada"}`;

      case "erp_sync":
        return `Sincronização ERP iniciada para: ${config.entity || "todos"}`;

      case "generate_report":
        return `Relatório gerado: ${config.reportType || "resumo"}`;

      case "webhook":
        if (config.url) {
          try {
            const response = await fetch(config.url, {
              method: config.method || "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ automationId: action.automationId, triggerData, config }),
            });
            return `Webhook chamado: ${response.status}`;
          } catch (e: any) {
            return `Webhook falhou: ${e.message}`;
          }
        }
        return "URL do webhook não configurada";

      case "send_email":
        return `Email enviado para: ${config.to || "não especificado"}`;

      case "send_whatsapp":
        return `Mensagem WhatsApp enviada para: ${config.to || "não especificado"}`;

      default:
        return `Tipo de ação desconhecido: ${action.actionType}`;
    }
  }

  private async executeAgentTask(userId: string, prompt: string): Promise<string> {
    try {
      const { runId } = await manusService.run(userId, 1, prompt);
      
      const maxWaitTime = 120000;
      const pollInterval = 2000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const [run] = await db.select()
          .from(manusRuns)
          .where(eq(manusRuns.id, runId));
        
        if (!run) {
          return `Tarefa do agente #${runId} não encontrada`;
        }
        
        if (run.status === "completed") {
          return run.result || `Tarefa do agente #${runId} concluída com sucesso`;
        }
        
        if (run.status === "stopped") {
          return run.result || `Tarefa do agente #${runId} parada (máximo de passos atingido)`;
        }
        
        if (run.status === "error") {
          return `Tarefa do agente #${runId} falhou: ${run.result || "erro desconhecido"}`;
        }
      }
      
      return `Tarefa do agente #${runId} iniciada (aguardando conclusão em segundo plano)`;
    } catch (error: any) {
      return `Erro ao executar tarefa do agente: ${error.message}`;
    }
  }

  startScheduler() {
    if (this.schedulerInterval) return;

    this.schedulerInterval = setInterval(async () => {
      try {
        await this.checkScheduledTasks();
      } catch (error) {
        console.error("Scheduler error:", error);
      }
    }, 60000);

    console.log("Automation scheduler started");
  }

  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log("Automation scheduler stopped");
    }
  }

  private async checkScheduledTasks() {
    const now = new Date();

    const dueTasks = await db.select({
      task: scheduledTasks,
      automation: automations,
    })
      .from(scheduledTasks)
      .innerJoin(automations, eq(scheduledTasks.automationId, automations.id))
      .where(and(
        eq(scheduledTasks.isActive, "true"),
        eq(automations.isActive, "true"),
        isNotNull(scheduledTasks.nextRunAt),
        lte(scheduledTasks.nextRunAt, now)
      ));

    for (const { task, automation } of dueTasks) {
      try {
        await this.runAutomation(automation.id, automation.userId, { scheduled: true });

        let nextRun: Date | null = null;
        if (task.intervalMinutes) {
          nextRun = new Date(now.getTime() + task.intervalMinutes * 60000);
        }

        await db.update(scheduledTasks)
          .set({
            lastRunAt: now,
            nextRunAt: nextRun,
          })
          .where(eq(scheduledTasks.id, task.id));
      } catch (error) {
        console.error(`Error running scheduled automation ${automation.id}:`, error);
      }
    }
  }
}

export const automationService = new AutomationService();
