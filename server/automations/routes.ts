import type { Express, Request, Response } from "express";
import { db } from "../../db/index";
import { automations, automationActions, automationLogs, scheduledTasks, insertAutomationSchema } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const automationServiceModule = async () => {
  const { automationService } = await import("./service");
  return automationService;
};

const createAutomationBodySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional().nullable(),
  triggerType: z.enum(["schedule", "webhook", "manual", "event"]),
  triggerConfig: z.record(z.any()).optional().nullable(),
  actions: z.array(z.object({
    actionType: z.string(),
    actionConfig: z.record(z.any()).optional().nullable(),
    conditionConfig: z.record(z.any()).optional().nullable(),
  })).optional(),
  schedule: z.object({
    cronExpression: z.string().optional().nullable(),
    intervalMinutes: z.number().min(1).optional().nullable(),
  }).optional(),
});

const updateAutomationBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  triggerType: z.enum(["schedule", "webhook", "manual", "event"]).optional(),
  triggerConfig: z.record(z.any()).optional().nullable(),
  isActive: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  actions: z.array(z.object({
    actionType: z.string(),
    actionConfig: z.record(z.any()).optional().nullable(),
    conditionConfig: z.record(z.any()).optional().nullable(),
  })).optional(),
  schedule: z.object({
    cronExpression: z.string().optional().nullable(),
    intervalMinutes: z.number().min(1).optional().nullable(),
  }).optional(),
});

function normalizeIsActive(value: any): string {
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  return "true";
}

export function registerAutomationRoutes(app: Express): void {
  app.get("/api/automations", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userAutomations = await db.select()
        .from(automations)
        .where(eq(automations.userId, req.user!.id))
        .orderBy(desc(automations.createdAt));
      
      res.json(userAutomations);
    } catch (error) {
      console.error("Get automations error:", error);
      res.status(500).json({ error: "Failed to get automations" });
    }
  });

  app.get("/api/automations/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const automationId = parseInt(req.params.id);
      if (isNaN(automationId)) {
        return res.status(400).json({ error: "Invalid automation ID" });
      }
      
      const [automation] = await db.select()
        .from(automations)
        .where(and(eq(automations.id, automationId), eq(automations.userId, req.user!.id)));
      
      if (!automation) {
        return res.status(404).json({ error: "Automation not found" });
      }
      
      const actions = await db.select()
        .from(automationActions)
        .where(eq(automationActions.automationId, automationId))
        .orderBy(automationActions.orderIndex);
      
      const schedule = await db.select()
        .from(scheduledTasks)
        .where(eq(scheduledTasks.automationId, automationId));
      
      res.json({ ...automation, actions, schedule: schedule[0] || null });
    } catch (error) {
      console.error("Get automation error:", error);
      res.status(500).json({ error: "Failed to get automation" });
    }
  });

  app.post("/api/automations", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const parseResult = createAutomationBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: parseResult.error.errors 
        });
      }
      
      const { name, description, triggerType, triggerConfig, actions, schedule } = parseResult.data;
      
      const [automation] = await db.insert(automations).values({
        userId: req.user!.id,
        name,
        description: description ?? null,
        triggerType,
        triggerConfig: triggerConfig ? JSON.stringify(triggerConfig) : null,
        isActive: "true",
      }).returning();
      
      if (actions && actions.length > 0) {
        for (let i = 0; i < actions.length; i++) {
          await db.insert(automationActions).values({
            automationId: automation.id,
            orderIndex: i,
            actionType: actions[i].actionType,
            actionConfig: actions[i].actionConfig ? JSON.stringify(actions[i].actionConfig) : null,
            conditionConfig: actions[i].conditionConfig ? JSON.stringify(actions[i].conditionConfig) : null,
          });
        }
      }
      
      if (triggerType === "schedule" && schedule) {
        const now = new Date();
        let nextRunAt: Date | null = null;
        
        if (schedule.intervalMinutes) {
          nextRunAt = new Date(now.getTime() + schedule.intervalMinutes * 60000);
        }
        
        await db.insert(scheduledTasks).values({
          automationId: automation.id,
          cronExpression: schedule.cronExpression ?? null,
          intervalMinutes: schedule.intervalMinutes ?? null,
          nextRunAt,
          isActive: "true",
        });
      }
      
      res.json(automation);
    } catch (error) {
      console.error("Create automation error:", error);
      res.status(500).json({ error: "Failed to create automation" });
    }
  });

  app.put("/api/automations/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const automationId = parseInt(req.params.id);
      if (isNaN(automationId)) {
        return res.status(400).json({ error: "Invalid automation ID" });
      }
      
      const parseResult = updateAutomationBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: parseResult.error.errors 
        });
      }
      
      const { name, description, triggerType, triggerConfig, actions, schedule, isActive } = parseResult.data;
      
      const [existing] = await db.select()
        .from(automations)
        .where(and(eq(automations.id, automationId), eq(automations.userId, req.user!.id)));
      
      if (!existing) {
        return res.status(404).json({ error: "Automation not found" });
      }
      
      const normalizedIsActive = isActive !== undefined ? normalizeIsActive(isActive) : existing.isActive;
      
      const [updated] = await db.update(automations)
        .set({
          name: name ?? existing.name,
          description: description !== undefined ? description : existing.description,
          triggerType: triggerType ?? existing.triggerType,
          triggerConfig: triggerConfig !== undefined 
            ? (triggerConfig ? JSON.stringify(triggerConfig) : null) 
            : existing.triggerConfig,
          isActive: normalizedIsActive,
          updatedAt: new Date(),
        })
        .where(eq(automations.id, automationId))
        .returning();
      
      if (actions !== undefined) {
        await db.delete(automationActions).where(eq(automationActions.automationId, automationId));
        for (let i = 0; i < actions.length; i++) {
          await db.insert(automationActions).values({
            automationId: automationId,
            orderIndex: i,
            actionType: actions[i].actionType,
            actionConfig: actions[i].actionConfig ? JSON.stringify(actions[i].actionConfig) : null,
            conditionConfig: actions[i].conditionConfig ? JSON.stringify(actions[i].conditionConfig) : null,
          });
        }
      }
      
      const effectiveTriggerType = triggerType ?? existing.triggerType;
      if (effectiveTriggerType === "schedule") {
        await db.delete(scheduledTasks).where(eq(scheduledTasks.automationId, automationId));
        
        if (schedule) {
          const now = new Date();
          let nextRunAt: Date | null = null;
          
          if (schedule.intervalMinutes) {
            nextRunAt = new Date(now.getTime() + schedule.intervalMinutes * 60000);
          }
          
          await db.insert(scheduledTasks).values({
            automationId: automationId,
            cronExpression: schedule.cronExpression ?? null,
            intervalMinutes: schedule.intervalMinutes ?? null,
            nextRunAt,
            isActive: normalizedIsActive,
          });
        }
      } else {
        await db.delete(scheduledTasks).where(eq(scheduledTasks.automationId, automationId));
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Update automation error:", error);
      res.status(500).json({ error: "Failed to update automation" });
    }
  });

  app.delete("/api/automations/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const automationId = parseInt(req.params.id);
      if (isNaN(automationId)) {
        return res.status(400).json({ error: "Invalid automation ID" });
      }
      
      const [existing] = await db.select()
        .from(automations)
        .where(and(eq(automations.id, automationId), eq(automations.userId, req.user!.id)));
      
      if (!existing) {
        return res.status(404).json({ error: "Automation not found" });
      }
      
      await db.delete(automations).where(eq(automations.id, automationId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete automation error:", error);
      res.status(500).json({ error: "Failed to delete automation" });
    }
  });

  app.post("/api/automations/:id/run", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const automationId = parseInt(req.params.id);
      if (isNaN(automationId)) {
        return res.status(400).json({ error: "Invalid automation ID" });
      }
      
      const [automation] = await db.select()
        .from(automations)
        .where(and(eq(automations.id, automationId), eq(automations.userId, req.user!.id)));
      
      if (!automation) {
        return res.status(404).json({ error: "Automation not found" });
      }
      
      const service = await automationServiceModule();
      const result = await service.runAutomation(automationId, req.user!.id);
      res.json(result);
    } catch (error) {
      console.error("Run automation error:", error);
      res.status(500).json({ error: "Failed to run automation" });
    }
  });

  app.get("/api/automations/:id/logs", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const automationId = parseInt(req.params.id);
      if (isNaN(automationId)) {
        return res.status(400).json({ error: "Invalid automation ID" });
      }
      
      const [automation] = await db.select()
        .from(automations)
        .where(and(eq(automations.id, automationId), eq(automations.userId, req.user!.id)));
      
      if (!automation) {
        return res.status(404).json({ error: "Automation not found" });
      }
      
      const logs = await db.select()
        .from(automationLogs)
        .where(eq(automationLogs.automationId, automationId))
        .orderBy(desc(automationLogs.startedAt))
        .limit(50);
      
      res.json(logs);
    } catch (error) {
      console.error("Get automation logs error:", error);
      res.status(500).json({ error: "Failed to get logs" });
    }
  });
}
