import { db } from "../../db/index";
import { eq, and, or, desc, sql, isNull, isNotNull } from "drizzle-orm";
import {
  pcSquads,
  pcSquadMembers,
  pcSprints,
  pcWorkItems,
  pcWorkItemComments,
  pcTimesheetEntries,
  pcProjects,
  pcProjectMembers,
  pcCollaborators,
  tenantProductionSettings,
  users,
  type PcSquad,
  type InsertPcSquad,
  type PcSquadMember,
  type InsertPcSquadMember,
  type PcSprint,
  type InsertPcSprint,
  type PcWorkItem,
  type InsertPcWorkItem,
  type PcWorkItemComment,
  type InsertPcWorkItemComment,
  type PcTimesheetEntry,
  type InsertPcTimesheetEntry,
  type PcProject,
  type InsertPcProject,
  type PcProjectMember,
  type InsertPcProjectMember,
  type PcCollaborator,
  type InsertPcCollaborator,
  type TenantProductionSettings,
  type InsertTenantProductionSettings,
} from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

class ProductionStorage {
  // ========== SQUADS ==========
  async getSquads(tenantId?: number): Promise<PcSquad[]> {
    if (tenantId) {
      return db.select().from(pcSquads).where(eq(pcSquads.tenantId, tenantId)).orderBy(desc(pcSquads.createdAt));
    }
    return db.select().from(pcSquads).orderBy(desc(pcSquads.createdAt));
  }

  async getSquad(id: number): Promise<PcSquad | undefined> {
    const [squad] = await db.select().from(pcSquads).where(eq(pcSquads.id, id));
    return squad;
  }

  async createSquad(data: InsertPcSquad): Promise<PcSquad> {
    const [squad] = await db.insert(pcSquads).values(data).returning();
    return squad;
  }

  async updateSquad(id: number, data: Partial<InsertPcSquad>): Promise<PcSquad | undefined> {
    const [squad] = await db.update(pcSquads).set({ ...data, updatedAt: new Date() }).where(eq(pcSquads.id, id)).returning();
    return squad;
  }

  async deleteSquad(id: number): Promise<boolean> {
    const result = await db.delete(pcSquads).where(eq(pcSquads.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== SQUAD MEMBERS ==========
  async getSquadMembers(squadId: number): Promise<(PcSquadMember & { userName?: string; collaboratorType?: string | null; hourlyRate?: string | null })[]> {
    const results = await db
      .select({
        id: pcSquadMembers.id,
        squadId: pcSquadMembers.squadId,
        userId: pcSquadMembers.userId,
        memberRole: pcSquadMembers.memberRole,
        joinedAt: pcSquadMembers.joinedAt,
        userName: users.name,
        collaboratorType: users.collaboratorType,
        hourlyRate: users.hourlyRate,
      })
      .from(pcSquadMembers)
      .leftJoin(users, eq(pcSquadMembers.userId, users.id))
      .where(eq(pcSquadMembers.squadId, squadId));
    return results as any;
  }

  async addSquadMember(data: InsertPcSquadMember): Promise<PcSquadMember> {
    const [member] = await db.insert(pcSquadMembers).values(data).returning();
    return member;
  }

  async removeSquadMember(squadId: number, userId: string): Promise<boolean> {
    const result = await db.delete(pcSquadMembers).where(
      and(eq(pcSquadMembers.squadId, squadId), eq(pcSquadMembers.userId, userId))
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ========== SPRINTS ==========
  async getSprints(tenantId?: number, projectId?: number): Promise<(PcSprint & { projectName?: string })[]> {
    const conditions = [];
    if (tenantId) conditions.push(eq(pcSprints.tenantId, tenantId));
    if (projectId) conditions.push(eq(pcSprints.projectId, projectId));
    
    const results = await db
      .select({
        id: pcSprints.id,
        tenantId: pcSprints.tenantId,
        projectId: pcSprints.projectId,
        squadId: pcSprints.squadId,
        name: pcSprints.name,
        goal: pcSprints.goal,
        startDate: pcSprints.startDate,
        endDate: pcSprints.endDate,
        status: pcSprints.status,
        velocity: pcSprints.velocity,
        completedPoints: pcSprints.completedPoints,
        createdAt: pcSprints.createdAt,
        updatedAt: pcSprints.updatedAt,
        projectName: pcProjects.name,
      })
      .from(pcSprints)
      .leftJoin(pcProjects, eq(pcSprints.projectId, pcProjects.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(pcSprints.startDate), desc(pcSprints.createdAt));
    
    return results as any;
  }

  async getActiveSprint(tenantId?: number): Promise<PcSprint | undefined> {
    const conditions = [eq(pcSprints.status, "active")];
    if (tenantId) conditions.push(eq(pcSprints.tenantId, tenantId));
    
    const [sprint] = await db.select().from(pcSprints).where(and(...conditions)).limit(1);
    return sprint;
  }

  async getSprint(id: number): Promise<PcSprint | undefined> {
    const [sprint] = await db.select().from(pcSprints).where(eq(pcSprints.id, id));
    return sprint;
  }

  async createSprint(data: InsertPcSprint): Promise<PcSprint> {
    const [sprint] = await db.insert(pcSprints).values(data).returning();
    return sprint;
  }

  async updateSprint(id: number, data: Partial<InsertPcSprint>): Promise<PcSprint | undefined> {
    const [sprint] = await db.update(pcSprints).set({ ...data, updatedAt: new Date() }).where(eq(pcSprints.id, id)).returning();
    return sprint;
  }

  async deleteSprint(id: number): Promise<boolean> {
    const result = await db.delete(pcSprints).where(eq(pcSprints.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== WORK ITEMS ==========
  async getWorkItems(tenantId?: number, filters?: { sprintId?: number; projectId?: number; assigneeId?: string; status?: string }): Promise<PcWorkItem[]> {
    const conditions = [];
    if (tenantId) conditions.push(eq(pcWorkItems.tenantId, tenantId));
    if (filters?.sprintId) conditions.push(eq(pcWorkItems.sprintId, filters.sprintId));
    if (filters?.projectId) conditions.push(eq(pcWorkItems.projectId, filters.projectId));
    if (filters?.assigneeId) conditions.push(eq(pcWorkItems.assigneeId, filters.assigneeId));
    if (filters?.status) conditions.push(eq(pcWorkItems.status, filters.status));
    
    if (conditions.length > 0) {
      return db.select().from(pcWorkItems).where(and(...conditions)).orderBy(desc(pcWorkItems.createdAt));
    }
    return db.select().from(pcWorkItems).orderBy(desc(pcWorkItems.createdAt));
  }

  async getBacklogItems(tenantId?: number, projectId?: number): Promise<PcWorkItem[]> {
    const conditions = [isNull(pcWorkItems.sprintId)];
    if (tenantId) conditions.push(eq(pcWorkItems.tenantId, tenantId));
    if (projectId) conditions.push(eq(pcWorkItems.projectId, projectId));
    
    return db.select().from(pcWorkItems).where(and(...conditions)).orderBy(desc(pcWorkItems.createdAt));
  }

  async getMyWorkItems(userId: string, tenantId?: number, status?: string): Promise<PcWorkItem[]> {
    const conditions = [eq(pcWorkItems.assigneeId, userId)];
    if (tenantId) conditions.push(eq(pcWorkItems.tenantId, tenantId));
    if (status) conditions.push(eq(pcWorkItems.status, status));
    
    return db.select().from(pcWorkItems).where(and(...conditions)).orderBy(desc(pcWorkItems.createdAt));
  }

  async getWorkItem(id: number): Promise<PcWorkItem | undefined> {
    const [item] = await db.select().from(pcWorkItems).where(eq(pcWorkItems.id, id));
    return item;
  }

  async createWorkItem(data: InsertPcWorkItem): Promise<PcWorkItem> {
    const [item] = await db.insert(pcWorkItems).values(data).returning();
    return item;
  }

  async updateWorkItem(id: number, data: Partial<InsertPcWorkItem>): Promise<PcWorkItem | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.status === "done" && !data.completedAt) {
      updateData.completedAt = new Date();
    }
    const [item] = await db.update(pcWorkItems).set(updateData).where(eq(pcWorkItems.id, id)).returning();
    return item;
  }

  async deleteWorkItem(id: number): Promise<boolean> {
    const result = await db.delete(pcWorkItems).where(eq(pcWorkItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async moveToSprint(workItemId: number, sprintId: number | null): Promise<PcWorkItem | undefined> {
    return this.updateWorkItem(workItemId, { sprintId });
  }

  // ========== WORK ITEM COMMENTS ==========
  async getWorkItemComments(workItemId: number): Promise<PcWorkItemComment[]> {
    return db.select().from(pcWorkItemComments).where(eq(pcWorkItemComments.workItemId, workItemId)).orderBy(pcWorkItemComments.createdAt);
  }

  async createWorkItemComment(data: InsertPcWorkItemComment): Promise<PcWorkItemComment> {
    const [comment] = await db.insert(pcWorkItemComments).values(data).returning();
    return comment;
  }

  async deleteWorkItemComment(id: number): Promise<boolean> {
    const result = await db.delete(pcWorkItemComments).where(eq(pcWorkItemComments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== TIMESHEET ==========
  async getTimesheetEntries(tenantId?: number, filters?: { userId?: string; projectId?: number; startDate?: Date; endDate?: Date }): Promise<PcTimesheetEntry[]> {
    const conditions = [];
    if (tenantId) conditions.push(eq(pcTimesheetEntries.tenantId, tenantId));
    if (filters?.userId) conditions.push(eq(pcTimesheetEntries.userId, filters.userId));
    if (filters?.projectId) conditions.push(eq(pcTimesheetEntries.projectId, filters.projectId));
    
    if (conditions.length > 0) {
      return db.select().from(pcTimesheetEntries).where(and(...conditions)).orderBy(desc(pcTimesheetEntries.date));
    }
    return db.select().from(pcTimesheetEntries).orderBy(desc(pcTimesheetEntries.date));
  }

  async getTimesheetEntry(id: number): Promise<PcTimesheetEntry | undefined> {
    const [entry] = await db.select().from(pcTimesheetEntries).where(eq(pcTimesheetEntries.id, id));
    return entry;
  }

  async createTimesheetEntry(data: InsertPcTimesheetEntry): Promise<PcTimesheetEntry> {
    const [entry] = await db.insert(pcTimesheetEntries).values(data).returning();
    return entry;
  }

  async updateTimesheetEntry(id: number, data: Partial<InsertPcTimesheetEntry>): Promise<PcTimesheetEntry | undefined> {
    const [entry] = await db.update(pcTimesheetEntries).set(data).where(eq(pcTimesheetEntries.id, id)).returning();
    return entry;
  }

  async deleteTimesheetEntry(id: number): Promise<boolean> {
    const result = await db.delete(pcTimesheetEntries).where(eq(pcTimesheetEntries.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== STATISTICS ==========
  async getProductionStats(tenantId?: number, userId?: string): Promise<any> {
    const conditions = [];
    if (tenantId) conditions.push(eq(pcWorkItems.tenantId, tenantId));
    if (userId) conditions.push(eq(pcWorkItems.assigneeId, userId));

    const allItems = await this.getWorkItems(tenantId, userId ? { assigneeId: userId } : undefined);
    const activeSprint = await this.getActiveSprint(tenantId);
    
    const stats = {
      totalItems: allItems.length,
      backlog: allItems.filter(i => i.status === "backlog").length,
      inProgress: allItems.filter(i => i.status === "in_progress").length,
      review: allItems.filter(i => i.status === "review").length,
      done: allItems.filter(i => i.status === "done").length,
      activeSprint: activeSprint ? {
        id: activeSprint.id,
        name: activeSprint.name,
        endDate: activeSprint.endDate,
      } : null,
    };
    
    return stats;
  }

  // ========== PROJECTS ==========
  async getProjects(tenantId?: number): Promise<any[]> {
    const conditions = [];
    if (tenantId) conditions.push(eq(pcProjects.tenantId, tenantId));
    conditions.push(eq(pcProjects.projectType, "programacao"));
    
    const projects = conditions.length > 0 
      ? await db.select().from(pcProjects).where(and(...conditions)).orderBy(desc(pcProjects.createdAt))
      : await db.select().from(pcProjects).orderBy(desc(pcProjects.createdAt));
    
    return projects.map(p => ({
      ...p,
      type: p.prodType || (p.clientId ? "external" : "internal"),
    }));
  }

  async getProject(id: number): Promise<PcProject | undefined> {
    const [project] = await db.select().from(pcProjects).where(eq(pcProjects.id, id));
    return project;
  }

  async createProject(data: any): Promise<PcProject> {
    const projectData = {
      tenantId: data.tenantId,
      name: data.name,
      description: data.description,
      projectType: "programacao",
      prodType: data.type || "internal",
      clientId: data.clientId || null,
      clientName: data.clientName || null,
      compassProjectId: data.compassProjectId || null,
      status: data.status || "active",
      userId: data.userId || "system",
    };
    const [project] = await db.insert(pcProjects).values(projectData).returning();
    return project;
  }

  async updateProject(id: number, data: Partial<InsertPcProject>): Promise<PcProject | undefined> {
    const [project] = await db.update(pcProjects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pcProjects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(pcProjects).where(eq(pcProjects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== COLLABORATORS ==========
  async getCollaborators(): Promise<any[]> {
    const result = await db.select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      phone: users.phone,
      collaboratorType: users.collaboratorType,
      hourlyRate: users.hourlyRate,
      skills: users.skills,
      status: users.status,
      createdAt: users.createdAt,
    }).from(users).where(isNotNull(users.collaboratorType)).orderBy(desc(users.createdAt));
    return result;
  }

  async createCollaborator(data: {
    name: string;
    username: string;
    email?: string;
    phone?: string;
    collaboratorType: string;
    hourlyRate?: string;
    skills?: string[];
    password: string;
  }): Promise<any> {
    const hashedPassword = await hashPassword(data.password);
    const [user] = await db.insert(users).values({
      username: data.username,
      password: hashedPassword,
      name: data.name,
      email: data.email,
      phone: data.phone,
      collaboratorType: data.collaboratorType,
      hourlyRate: data.hourlyRate || "0",
      skills: data.skills || [],
      role: "user",
      status: "active",
    }).returning();
    const { password, ...collaborator } = user;
    return collaborator;
  }

  async updateCollaborator(id: string, data: Partial<{
    name: string;
    email: string;
    phone: string;
    collaboratorType: string;
    hourlyRate: string;
    skills: string[];
    status: string;
  }>): Promise<any | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    if (!user) return undefined;
    const { password, ...collaborator } = user;
    return collaborator;
  }

  async deleteCollaborator(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== PROJECT SQUAD MEMBERS ==========
  async getProjectMembers(projectId: number): Promise<any[]> {
    const results = await db
      .select({
        id: pcProjectMembers.id,
        projectId: pcProjectMembers.projectId,
        userId: pcProjectMembers.userId,
        collaboratorId: pcProjectMembers.collaboratorId,
        role: pcProjectMembers.role,
        isExternal: pcProjectMembers.isExternal,
        assignedAt: pcProjectMembers.assignedAt,
        userName: users.name,
        userEmail: users.email,
        userHourlyRate: users.hourlyRate,
      })
      .from(pcProjectMembers)
      .leftJoin(users, eq(pcProjectMembers.userId, users.id))
      .where(eq(pcProjectMembers.projectId, projectId));
    
    // For external collaborators, fetch their info from pcCollaborators
    const enrichedResults = await Promise.all(results.map(async (member) => {
      if (member.isExternal === 1 && member.collaboratorId) {
        const [collaborator] = await db.select().from(pcCollaborators).where(eq(pcCollaborators.id, member.collaboratorId));
        return {
          ...member,
          collaboratorName: collaborator?.name,
          collaboratorEmail: collaborator?.email,
          collaboratorHourlyRate: collaborator?.hourlyRate,
          collaboratorType: collaborator?.type,
        };
      }
      return member;
    }));
    
    return enrichedResults;
  }

  async addProjectMember(data: InsertPcProjectMember): Promise<PcProjectMember> {
    const [member] = await db.insert(pcProjectMembers).values(data).returning();
    return member;
  }

  async updateProjectMemberRole(id: number, role: string): Promise<PcProjectMember | undefined> {
    const [member] = await db.update(pcProjectMembers).set({ role }).where(eq(pcProjectMembers.id, id)).returning();
    return member;
  }

  async removeProjectMember(id: number): Promise<boolean> {
    const result = await db.delete(pcProjectMembers).where(eq(pcProjectMembers.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== EXTERNAL COLLABORATORS ==========
  async getExternalCollaborators(tenantId?: number): Promise<PcCollaborator[]> {
    if (tenantId) {
      return db.select().from(pcCollaborators).where(eq(pcCollaborators.tenantId, tenantId)).orderBy(desc(pcCollaborators.createdAt));
    }
    return db.select().from(pcCollaborators).orderBy(desc(pcCollaborators.createdAt));
  }

  async getExternalCollaborator(id: number): Promise<PcCollaborator | undefined> {
    const [collaborator] = await db.select().from(pcCollaborators).where(eq(pcCollaborators.id, id));
    return collaborator;
  }

  async createExternalCollaborator(data: InsertPcCollaborator): Promise<PcCollaborator> {
    const [collaborator] = await db.insert(pcCollaborators).values(data).returning();
    return collaborator;
  }

  async updateExternalCollaborator(id: number, data: Partial<InsertPcCollaborator>): Promise<PcCollaborator | undefined> {
    const [collaborator] = await db.update(pcCollaborators).set({ ...data, updatedAt: new Date() }).where(eq(pcCollaborators.id, id)).returning();
    return collaborator;
  }

  async deleteExternalCollaborator(id: number): Promise<boolean> {
    const result = await db.delete(pcCollaborators).where(eq(pcCollaborators.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== TENANT PRODUCTION SETTINGS ==========
  async getTenantSettings(tenantId: number): Promise<TenantProductionSettings | undefined> {
    const [settings] = await db.select().from(tenantProductionSettings).where(eq(tenantProductionSettings.tenantId, tenantId));
    return settings;
  }

  async upsertTenantSettings(tenantId: number, data: Partial<InsertTenantProductionSettings>): Promise<TenantProductionSettings> {
    const existing = await this.getTenantSettings(tenantId);
    if (existing) {
      const [settings] = await db.update(tenantProductionSettings).set({ ...data, updatedAt: new Date() }).where(eq(tenantProductionSettings.tenantId, tenantId)).returning();
      return settings;
    }
    const [settings] = await db.insert(tenantProductionSettings).values({ tenantId, ...data }).returning();
    return settings;
  }
}

export const productionStorage = new ProductionStorage();
