import { db } from "../../db/index";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  paraProjects, paraAreas, paraResources, paraTasks, paraArchive,
  InsertParaProject, InsertParaArea, InsertParaResource, InsertParaTask, InsertParaArchive,
  ParaProject, ParaArea, ParaResource, ParaTask, ParaArchive
} from "@shared/schema";

export const paraStorage = {
  // ========== PROJECTS ==========
  async getProjects(userId: string, status?: string): Promise<ParaProject[]> {
    const conditions = [eq(paraProjects.userId, userId)];
    if (status) conditions.push(eq(paraProjects.status, status));
    return db.select().from(paraProjects).where(and(...conditions)).orderBy(desc(paraProjects.createdAt));
  },

  async getProject(id: number, userId: string): Promise<ParaProject | undefined> {
    const [project] = await db.select().from(paraProjects).where(and(eq(paraProjects.id, id), eq(paraProjects.userId, userId)));
    return project;
  },

  async createProject(data: InsertParaProject): Promise<ParaProject> {
    const [project] = await db.insert(paraProjects).values(data).returning();
    return project;
  },

  async updateProject(id: number, userId: string, data: Partial<InsertParaProject>): Promise<ParaProject | undefined> {
    const [project] = await db.update(paraProjects).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(paraProjects.id, id), eq(paraProjects.userId, userId))).returning();
    return project;
  },

  async deleteProject(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(paraProjects).where(and(eq(paraProjects.id, id), eq(paraProjects.userId, userId)));
    return result.rowCount > 0;
  },

  // ========== AREAS ==========
  async getAreas(userId: string, status?: string): Promise<ParaArea[]> {
    const conditions = [eq(paraAreas.userId, userId)];
    if (status) conditions.push(eq(paraAreas.status, status));
    return db.select().from(paraAreas).where(and(...conditions)).orderBy(desc(paraAreas.createdAt));
  },

  async getArea(id: number, userId: string): Promise<ParaArea | undefined> {
    const [area] = await db.select().from(paraAreas).where(and(eq(paraAreas.id, id), eq(paraAreas.userId, userId)));
    return area;
  },

  async createArea(data: InsertParaArea): Promise<ParaArea> {
    const [area] = await db.insert(paraAreas).values(data).returning();
    return area;
  },

  async updateArea(id: number, userId: string, data: Partial<InsertParaArea>): Promise<ParaArea | undefined> {
    const [area] = await db.update(paraAreas).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(paraAreas.id, id), eq(paraAreas.userId, userId))).returning();
    return area;
  },

  async deleteArea(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(paraAreas).where(and(eq(paraAreas.id, id), eq(paraAreas.userId, userId)));
    return result.rowCount > 0;
  },

  // ========== RESOURCES ==========
  async getResources(userId: string, filters?: { projectId?: number; areaId?: number; status?: string }): Promise<ParaResource[]> {
    const conditions = [eq(paraResources.userId, userId)];
    if (filters?.projectId) conditions.push(eq(paraResources.projectId, filters.projectId));
    if (filters?.areaId) conditions.push(eq(paraResources.areaId, filters.areaId));
    if (filters?.status) conditions.push(eq(paraResources.status, filters.status));
    return db.select().from(paraResources).where(and(...conditions)).orderBy(desc(paraResources.createdAt));
  },

  async getResource(id: number, userId: string): Promise<ParaResource | undefined> {
    const [resource] = await db.select().from(paraResources).where(and(eq(paraResources.id, id), eq(paraResources.userId, userId)));
    return resource;
  },

  async createResource(data: InsertParaResource): Promise<ParaResource> {
    const [resource] = await db.insert(paraResources).values(data).returning();
    return resource;
  },

  async updateResource(id: number, userId: string, data: Partial<InsertParaResource>): Promise<ParaResource | undefined> {
    const [resource] = await db.update(paraResources).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(paraResources.id, id), eq(paraResources.userId, userId))).returning();
    return resource;
  },

  async deleteResource(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(paraResources).where(and(eq(paraResources.id, id), eq(paraResources.userId, userId)));
    return result.rowCount > 0;
  },

  // ========== TASKS (Tríade do Tempo) ==========
  async getTasks(userId: string, filters?: { projectId?: number; areaId?: number; triadCategory?: string; status?: string }): Promise<ParaTask[]> {
    const conditions = [eq(paraTasks.userId, userId)];
    if (filters?.projectId) conditions.push(eq(paraTasks.projectId, filters.projectId));
    if (filters?.areaId) conditions.push(eq(paraTasks.areaId, filters.areaId));
    if (filters?.triadCategory) conditions.push(eq(paraTasks.triadCategory, filters.triadCategory));
    if (filters?.status) conditions.push(eq(paraTasks.status, filters.status));
    return db.select().from(paraTasks).where(and(...conditions)).orderBy(desc(paraTasks.createdAt));
  },

  async getTask(id: number, userId: string): Promise<ParaTask | undefined> {
    const [task] = await db.select().from(paraTasks).where(and(eq(paraTasks.id, id), eq(paraTasks.userId, userId)));
    return task;
  },

  async createTask(data: InsertParaTask): Promise<ParaTask> {
    const [task] = await db.insert(paraTasks).values(data).returning();
    return task;
  },

  async updateTask(id: number, userId: string, data: Partial<InsertParaTask>): Promise<ParaTask | undefined> {
    const [task] = await db.update(paraTasks).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(paraTasks.id, id), eq(paraTasks.userId, userId))).returning();
    return task;
  },

  async completeTask(id: number, userId: string): Promise<ParaTask | undefined> {
    const [task] = await db.update(paraTasks).set({ status: "completed", completedAt: sql`CURRENT_TIMESTAMP`, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(paraTasks.id, id), eq(paraTasks.userId, userId))).returning();
    return task;
  },

  async deleteTask(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(paraTasks).where(and(eq(paraTasks.id, id), eq(paraTasks.userId, userId)));
    return result.rowCount > 0;
  },

  // Estatísticas da Tríade do Tempo
  async getTriadStats(userId: string): Promise<{ importante: number; urgente: number; circunstancial: number }> {
    const tasks = await db.select().from(paraTasks)
      .where(and(eq(paraTasks.userId, userId), eq(paraTasks.status, "pending")));
    
    return {
      importante: tasks.filter(t => t.triadCategory === "importante").length,
      urgente: tasks.filter(t => t.triadCategory === "urgente").length,
      circunstancial: tasks.filter(t => t.triadCategory === "circunstancial").length,
    };
  },

  // ========== ARCHIVE ==========
  async getArchive(userId: string): Promise<ParaArchive[]> {
    return db.select().from(paraArchive).where(eq(paraArchive.userId, userId)).orderBy(desc(paraArchive.archivedAt));
  },

  async archiveItem(data: InsertParaArchive): Promise<ParaArchive> {
    const [item] = await db.insert(paraArchive).values(data).returning();
    return item;
  },

  async restoreFromArchive(id: number, userId: string): Promise<ParaArchive | undefined> {
    const [item] = await db.select().from(paraArchive).where(and(eq(paraArchive.id, id), eq(paraArchive.userId, userId)));
    if (!item) return undefined;
    await db.delete(paraArchive).where(eq(paraArchive.id, id));
    return item;
  },

  async deleteFromArchive(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(paraArchive).where(and(eq(paraArchive.id, id), eq(paraArchive.userId, userId)));
    return result.rowCount > 0;
  },

  // Dashboard stats
  async getDashboard(userId: string) {
    const [projects, areas, resources, tasks, triadStats] = await Promise.all([
      this.getProjects(userId, "active"),
      this.getAreas(userId, "active"),
      this.getResources(userId, { status: "active" }),
      this.getTasks(userId, { status: "pending" }),
      this.getTriadStats(userId),
    ]);

    return {
      projectCount: projects.length,
      areaCount: areas.length,
      resourceCount: resources.length,
      pendingTaskCount: tasks.length,
      triadStats,
      recentProjects: projects.slice(0, 5),
      recentAreas: areas.slice(0, 5),
      upcomingTasks: tasks.filter((t: ParaTask) => t.dueDate).sort((a: ParaTask, b: ParaTask) => 
        new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
      ).slice(0, 10),
    };
  },
};
