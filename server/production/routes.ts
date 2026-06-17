import { Router } from "express";
import { z } from "zod";
import { productionStorage } from "./storage";
import { compassStorage } from "../compass/storage";
import {
  insertPcSquadSchema,
  insertPcSprintSchema,
  insertPcWorkItemSchema,
  insertPcWorkItemCommentSchema,
  insertPcTimesheetEntrySchema,
} from "@shared/schema";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

async function getUserTenantId(req: any): Promise<number | null> {
  const userId = req.user?.id;
  if (!userId) return null;
  
  const headerTenantId = req.headers["x-tenant-id"];
  if (headerTenantId) {
    const tenantId = parseInt(headerTenantId as string);
    const isMember = await compassStorage.isUserInTenant(userId, tenantId);
    return isMember ? tenantId : null;
  }
  
  const tenants = await compassStorage.getUserTenants(userId);
  return tenants.length > 0 ? tenants[0].id : null;
}

// ========== SQUADS ==========
router.get("/squads", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const squads = await productionStorage.getSquads(tenantId ?? undefined);
    res.json(squads);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch squads" });
  }
});

router.get("/squads/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const squad = await productionStorage.getSquad(Number(req.params.id));
    if (!squad) return res.status(404).json({ error: "Squad not found" });
    if (squad.tenantId && squad.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    res.json(squad);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch squad" });
  }
});

router.post("/squads", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const data = insertPcSquadSchema.parse({ ...req.body, tenantId });
    const squad = await productionStorage.createSquad(data);
    res.status(201).json(squad);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create squad" });
  }
});

router.patch("/squads/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getSquad(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Squad not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const data = insertPcSquadSchema.partial().parse(req.body);
    delete (data as any).tenantId;
    const squad = await productionStorage.updateSquad(Number(req.params.id), data);
    res.json(squad);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update squad" });
  }
});

router.delete("/squads/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getSquad(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Squad not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    await productionStorage.deleteSquad(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete squad" });
  }
});

// ========== SQUAD MEMBERS ==========
router.get("/squads/:id/members", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const squad = await productionStorage.getSquad(Number(req.params.id));
    if (!squad) return res.status(404).json({ error: "Squad not found" });
    if (squad.tenantId && squad.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const members = await productionStorage.getSquadMembers(Number(req.params.id));
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch squad members" });
  }
});

router.post("/squads/:id/members", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const squad = await productionStorage.getSquad(Number(req.params.id));
    if (!squad) return res.status(404).json({ error: "Squad not found" });
    if (squad.tenantId && squad.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const member = await productionStorage.addSquadMember({
      squadId: Number(req.params.id),
      userId: req.body.userId || null,
      collaboratorId: req.body.collaboratorId || null,
      memberRole: req.body.memberRole || "member",
    });
    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: "Failed to add squad member" });
  }
});

router.delete("/squads/:squadId/members/:userId", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const squad = await productionStorage.getSquad(Number(req.params.squadId));
    if (!squad) return res.status(404).json({ error: "Squad not found" });
    if (squad.tenantId && squad.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const deleted = await productionStorage.removeSquadMember(Number(req.params.squadId), req.params.userId);
    if (!deleted) return res.status(404).json({ error: "Member not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to remove squad member" });
  }
});

// ========== SPRINTS ==========
router.get("/sprints", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const sprints = await productionStorage.getSprints(tenantId ?? undefined, projectId);
    res.json(sprints);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sprints" });
  }
});

router.get("/sprints/active", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const sprint = await productionStorage.getActiveSprint(tenantId ?? undefined);
    res.json(sprint || null);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch active sprint" });
  }
});

router.get("/active-sprint", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const sprint = await productionStorage.getActiveSprint(tenantId ?? undefined);
    res.json(sprint || null);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch active sprint" });
  }
});

router.get("/my-tasks", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const user = req.user as any;
    const items = await productionStorage.getMyWorkItems(user.id as string, tenantId ?? undefined);
    res.json(items);
  } catch (error) {
    console.error("My tasks error:", error);
    res.status(500).json({ error: "Failed to fetch my tasks" });
  }
});

router.get("/sprints/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const sprint = await productionStorage.getSprint(Number(req.params.id));
    if (!sprint) return res.status(404).json({ error: "Sprint not found" });
    if (sprint.tenantId && sprint.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    res.json(sprint);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sprint" });
  }
});

router.post("/sprints", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const body = {
      ...req.body,
      tenantId,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
    };
    const data = insertPcSprintSchema.parse(body);
    const sprint = await productionStorage.createSprint(data);
    res.status(201).json(sprint);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create sprint" });
  }
});

router.patch("/sprints/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getSprint(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Sprint not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const data = insertPcSprintSchema.partial().parse(req.body);
    delete (data as any).tenantId;
    const sprint = await productionStorage.updateSprint(Number(req.params.id), data);
    res.json(sprint);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update sprint" });
  }
});

router.delete("/sprints/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getSprint(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Sprint not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    await productionStorage.deleteSprint(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete sprint" });
  }
});

// ========== WORK ITEMS ==========
router.get("/work-items", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const filters = {
      sprintId: req.query.sprintId ? Number(req.query.sprintId) : undefined,
      projectId: req.query.projectId ? Number(req.query.projectId) : undefined,
      assigneeId: req.query.assigneeId as string | undefined,
      status: req.query.status as string | undefined,
    };
    const items = await productionStorage.getWorkItems(tenantId ?? undefined, filters);
    res.json(items);
  } catch (error) {
    console.error("Work items error:", error);
    res.status(500).json({ error: "Failed to fetch work items" });
  }
});

router.get("/work-items/backlog", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const items = await productionStorage.getBacklogItems(tenantId ?? undefined, projectId);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch backlog" });
  }
});

router.get("/work-items/my-items", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const user = req.user as any;
    const status = req.query.status as string | undefined;
    const items = await productionStorage.getMyWorkItems(user.id, tenantId ?? undefined, status);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch my work items" });
  }
});

router.get("/work-items/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const item = await productionStorage.getWorkItem(Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Work item not found" });
    if (item.tenantId && item.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch work item" });
  }
});

router.post("/work-items", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const user = req.user as any;
    const data = insertPcWorkItemSchema.parse({
      ...req.body,
      tenantId,
      createdById: user.id,
    });
    const item = await productionStorage.createWorkItem(data);
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create work item" });
  }
});

router.patch("/work-items/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getWorkItem(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Work item not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const data = insertPcWorkItemSchema.partial().parse(req.body);
    delete (data as any).tenantId;
    const item = await productionStorage.updateWorkItem(Number(req.params.id), data);
    res.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update work item" });
  }
});

router.delete("/work-items/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getWorkItem(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Work item not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    await productionStorage.deleteWorkItem(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete work item" });
  }
});

router.post("/work-items/:id/move-to-sprint", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getWorkItem(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Work item not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const sprintId = req.body.sprintId !== undefined ? Number(req.body.sprintId) : null;
    const item = await productionStorage.moveToSprint(Number(req.params.id), sprintId);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "Failed to move work item" });
  }
});

// ========== WORK ITEM COMMENTS ==========
router.get("/work-items/:id/comments", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const item = await productionStorage.getWorkItem(Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Work item not found" });
    if (item.tenantId && item.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const comments = await productionStorage.getWorkItemComments(Number(req.params.id));
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

router.post("/work-items/:id/comments", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const item = await productionStorage.getWorkItem(Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Work item not found" });
    if (item.tenantId && item.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const user = req.user as any;
    const data = insertPcWorkItemCommentSchema.parse({
      workItemId: Number(req.params.id),
      userId: user.id,
      content: req.body.content,
    });
    const comment = await productionStorage.createWorkItemComment(data);
    res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// ========== TIMESHEET ==========
router.get("/timesheets", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const filters = {
      userId: req.query.userId as string | undefined,
      projectId: req.query.projectId ? Number(req.query.projectId) : undefined,
    };
    const entries = await productionStorage.getTimesheetEntries(tenantId ?? undefined, filters);
    res.json(entries);
  } catch (error) {
    console.error("Fetch timesheet error:", error);
    res.status(500).json({ error: "Failed to fetch timesheet" });
  }
});

router.post("/timesheets", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const user = req.user as any;
    const data = insertPcTimesheetEntrySchema.parse({
      ...req.body,
      tenantId,
      userId: user.id,
    });
    const entry = await productionStorage.createTimesheetEntry(data);
    res.status(201).json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create timesheet entry" });
  }
});

router.patch("/timesheets/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getTimesheetEntry(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Entry not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const data = insertPcTimesheetEntrySchema.partial().parse(req.body);
    delete (data as any).tenantId;
    const entry = await productionStorage.updateTimesheetEntry(Number(req.params.id), data);
    res.json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update timesheet entry" });
  }
});

router.delete("/timesheets/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getTimesheetEntry(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Entry not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    await productionStorage.deleteTimesheetEntry(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete timesheet entry" });
  }
});

router.post("/timesheets/timer/start", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const user = req.user as any;
    const { projectId, workItemId, hourlyRate, description } = req.body;
    
    const entry = await productionStorage.createTimesheetEntry({
      tenantId,
      projectId,
      workItemId,
      userId: user.id,
      date: new Date(),
      hours: "0",
      description: description || "",
      hourlyRate: hourlyRate?.toString() || "0",
      totalCost: "0",
      status: "draft",
      timerStartedAt: new Date(),
    });
    res.status(201).json(entry);
  } catch (error) {
    console.error("Start timer error:", error);
    res.status(500).json({ error: "Failed to start timer" });
  }
});

router.post("/timesheets/timer/stop/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getTimesheetEntry(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Entry not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    if (!existing.timerStartedAt) return res.status(400).json({ error: "Timer not started" });
    
    const startTime = new Date(existing.timerStartedAt);
    const endTime = new Date();
    const hoursWorked = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const totalCost = hoursWorked * parseFloat(existing.hourlyRate || "0");
    
    const entry = await productionStorage.updateTimesheetEntry(Number(req.params.id), {
      hours: hoursWorked.toFixed(2),
      totalCost: totalCost.toFixed(2),
      timerStartedAt: null,
    });
    
    if (existing.workItemId) {
      const workItem = await productionStorage.getWorkItem(existing.workItemId);
      if (workItem) {
        const currentHours = parseFloat(workItem.actualHours || "0");
        const newHours = currentHours + hoursWorked;
        const newCost = parseFloat(workItem.totalCost || "0") + totalCost;
        await productionStorage.updateWorkItem(existing.workItemId, {
          actualHours: newHours.toFixed(2),
          totalCost: newCost.toFixed(2),
        });
      }
    }
    
    res.json(entry);
  } catch (error) {
    console.error("Stop timer error:", error);
    res.status(500).json({ error: "Failed to stop timer" });
  }
});

router.post("/timesheets/:id/submit", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getTimesheetEntry(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Entry not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    
    const entry = await productionStorage.updateTimesheetEntry(Number(req.params.id), { status: "pending" });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: "Failed to submit for approval" });
  }
});

router.post("/timesheets/:id/approve", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const user = req.user as any;
    const existing = await productionStorage.getTimesheetEntry(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Entry not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    
    const entry = await productionStorage.updateTimesheetEntry(Number(req.params.id), {
      status: "approved",
      approvedById: user.id,
      approvedAt: new Date(),
    });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: "Failed to approve" });
  }
});

router.post("/timesheets/:id/reject", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const user = req.user as any;
    const existing = await productionStorage.getTimesheetEntry(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Entry not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    
    const entry = await productionStorage.updateTimesheetEntry(Number(req.params.id), {
      status: "rejected",
      approvedById: user.id,
      approvedAt: new Date(),
    });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: "Failed to reject" });
  }
});

// ========== PROJECTS ==========
router.get("/projects", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const projects = await productionStorage.getProjects(tenantId ?? undefined);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/projects", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    
    const { name, description, type, clientId, compassProjectId } = req.body;
    
    let clientName = null;
    if (clientId) {
      const { crmStorage } = await import("../crm/storage");
      const client = await crmStorage.getClient(clientId);
      clientName = client?.name;
    }
    
    const user = req.user as any;
    const project = await productionStorage.createProject({
      tenantId,
      name,
      description,
      type: type || "internal",
      clientId: clientId || null,
      clientName,
      compassProjectId: compassProjectId || null,
      status: "active",
      userId: user?.id || "system",
    });
    res.status(201).json(project);
  } catch (error) {
    console.error("Create project error:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.get("/projects/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const project = await productionStorage.getProject(Number(req.params.id));
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (project.tenantId && project.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.patch("/projects/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getProject(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Project not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const project = await productionStorage.updateProject(Number(req.params.id), req.body);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await productionStorage.getProject(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Project not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    await productionStorage.deleteProject(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ========== STATISTICS ==========
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const user = req.user as any;
    const stats = await productionStorage.getProductionStats(tenantId ?? undefined, user.id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ========== COLLABORATORS (Users with collaboratorType) ==========
router.get("/collaborators", requireAuth, async (req, res) => {
  try {
    const collaborators = await productionStorage.getCollaborators();
    res.json(collaborators);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch collaborators" });
  }
});

router.post("/collaborators", requireAuth, async (req, res) => {
  try {
    const { name, username, email, phone, collaboratorType, hourlyRate, skills, password } = req.body;
    if (!name || !username || !collaboratorType) {
      return res.status(400).json({ error: "Name, username and collaborator type are required" });
    }
    const collaborator = await productionStorage.createCollaborator({
      name,
      username,
      email,
      phone,
      collaboratorType,
      hourlyRate: hourlyRate || "0",
      skills: skills || [],
      password: password || "temp123",
    });
    res.status(201).json(collaborator);
  } catch (error: any) {
    console.error("Create collaborator error:", error);
    res.status(500).json({ error: error.message || "Failed to create collaborator" });
  }
});

router.patch("/collaborators/:id", requireAuth, async (req, res) => {
  try {
    const collaborator = await productionStorage.updateCollaborator(req.params.id, req.body);
    if (!collaborator) return res.status(404).json({ error: "Collaborator not found" });
    res.json(collaborator);
  } catch (error) {
    res.status(500).json({ error: "Failed to update collaborator" });
  }
});

router.delete("/collaborators/:id", requireAuth, async (req, res) => {
  try {
    await productionStorage.deleteCollaborator(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete collaborator" });
  }
});

// ========== PROJECT SQUAD MEMBERS ==========
router.get("/projects/:id/members", requireAuth, async (req, res) => {
  try {
    const members = await productionStorage.getProjectMembers(Number(req.params.id));
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch project members" });
  }
});

router.post("/projects/:id/members", requireAuth, async (req, res) => {
  try {
    const { userId, collaboratorId, role, isExternal } = req.body;
    if (!userId && !collaboratorId) {
      return res.status(400).json({ error: "Either userId or collaboratorId is required" });
    }
    const member = await productionStorage.addProjectMember({
      projectId: Number(req.params.id),
      userId: userId || null,
      collaboratorId: collaboratorId || null,
      role: role || "member",
      isExternal: isExternal || 0,
    });
    res.status(201).json(member);
  } catch (error: any) {
    console.error("Add project member error:", error);
    res.status(500).json({ error: error.message || "Failed to add project member" });
  }
});

router.patch("/projects/:projectId/members/:memberId", requireAuth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "Role is required" });
    const member = await productionStorage.updateProjectMemberRole(Number(req.params.memberId), role);
    if (!member) return res.status(404).json({ error: "Member not found" });
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: "Failed to update member role" });
  }
});

router.delete("/projects/:projectId/members/:memberId", requireAuth, async (req, res) => {
  try {
    await productionStorage.removeProjectMember(Number(req.params.memberId));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to remove project member" });
  }
});

// ========== EXTERNAL COLLABORATORS ==========
router.get("/external-collaborators", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const collaborators = await productionStorage.getExternalCollaborators(tenantId ?? undefined);
    res.json(collaborators);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch external collaborators" });
  }
});

router.post("/external-collaborators", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const { name, email, phone, type, hourlyRate, skills, notes } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required" });
    }
    const collaborator = await productionStorage.createExternalCollaborator({
      tenantId,
      name,
      email,
      phone,
      type,
      hourlyRate: hourlyRate || "0",
      skills: skills || [],
      notes,
    });
    res.status(201).json(collaborator);
  } catch (error: any) {
    console.error("Create external collaborator error:", error);
    res.status(500).json({ error: error.message || "Failed to create external collaborator" });
  }
});

router.patch("/external-collaborators/:id", requireAuth, async (req, res) => {
  try {
    const collaborator = await productionStorage.updateExternalCollaborator(Number(req.params.id), req.body);
    if (!collaborator) return res.status(404).json({ error: "External collaborator not found" });
    res.json(collaborator);
  } catch (error) {
    res.status(500).json({ error: "Failed to update external collaborator" });
  }
});

router.delete("/external-collaborators/:id", requireAuth, async (req, res) => {
  try {
    await productionStorage.deleteExternalCollaborator(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete external collaborator" });
  }
});

// ========== TENANT PRODUCTION SETTINGS ==========
router.get("/settings", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const settings = await productionStorage.getTenantSettings(tenantId);
    res.json(settings || { tenantId, timesheetRequiresApproval: 0, timesheetAllowTimer: 1, defaultHourlyRate: "0", workHoursPerDay: "8" });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/settings", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const settings = await productionStorage.upsertTenantSettings(tenantId, req.body);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
