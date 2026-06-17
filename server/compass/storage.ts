import { db } from "../../db/index";
import { 
  tenants, tenantUsers,
  pcClients, pcClientContacts, pcProjects, pcProjectMembers,
  pcCanvasBlocks, pcCanvasQuestions, pcCanvasExpectedOutputs, pcCanvasPdcaLinks, pcCanvasSwotLinks,
  pcProcesses, pcProcessSteps,
  pcSwotAnalyses, pcSwotItems,
  pcCrmStages, pcCrmLeads, pcCrmOpportunities, pcCrmActivities,
  pcDeliverables, pcTasks,
  pcPdcaCycles, pcPdcaActions, pcRequirements,
  valuationProjects,
  pcReportTemplates, pcReportConfigurations, pcGeneratedReports,
  pcErpModules, pcErpRequirements, pcErpParameterizationTopics, pcErpParameterizationItems,
  pcProjectTeamMembers, pcProjectTasks, pcProjectFiles, pcProjectHistory,
  type Tenant, type InsertTenant, type TenantUser, type InsertTenantUser,
  type PcClient, type InsertPcClient, type PcClientContact, type InsertPcClientContact,
  type PcProject, type InsertPcProject, type PcProjectMember, type InsertPcProjectMember,
  type PcCanvasBlock, type InsertPcCanvasBlock,
  type PcCanvasQuestion, type InsertPcCanvasQuestion,
  type PcCanvasExpectedOutput, type InsertPcCanvasExpectedOutput,
  type PcCanvasPdcaLink, type InsertPcCanvasPdcaLink,
  type PcCanvasSwotLink, type InsertPcCanvasSwotLink,
  type PcProcess, type InsertPcProcess, type PcProcessStep, type InsertPcProcessStep,
  type PcSwotAnalysis, type InsertPcSwotAnalysis, type PcSwotItem, type InsertPcSwotItem,
  type PcCrmStage, type InsertPcCrmStage, type PcCrmLead, type InsertPcCrmLead,
  type PcCrmOpportunity, type InsertPcCrmOpportunity, type PcCrmActivity, type InsertPcCrmActivity,
  type PcDeliverable, type InsertPcDeliverable, type PcTask, type InsertPcTask,
  type PcPdcaCycle, type InsertPcPdcaCycle, type PcPdcaAction, type InsertPcPdcaAction,
  type PcRequirement, type InsertPcRequirement,
  type PcReportTemplate, type InsertPcReportTemplate,
  type PcReportConfiguration, type InsertPcReportConfiguration,
  type PcGeneratedReport, type InsertPcGeneratedReport,
  type PcErpModule, type InsertPcErpModule,
  type PcErpRequirement, type InsertPcErpRequirement,
  type PcErpParameterizationTopic, type InsertPcErpParameterizationTopic,
  type PcErpParameterizationItem, type InsertPcErpParameterizationItem,
  type PcProjectTeamMember, type InsertPcProjectTeamMember,
  type PcProjectTask, type InsertPcProjectTask,
  type PcProjectFile, type InsertPcProjectFile,
  type PcProjectHistory, type InsertPcProjectHistory,
  users
} from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";

export interface ICompassStorage {
  // Tenants
  getTenants(): Promise<Tenant[]>;
  getTenant(id: number): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, tenant: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: number): Promise<boolean>;
  
  // Tenant Users
  getTenantUsers(tenantId: number): Promise<TenantUser[]>;
  getUserTenants(userId: string): Promise<Tenant[]>;
  isUserInTenant(userId: string, tenantId: number): Promise<boolean>;
  addUserToTenant(data: InsertTenantUser): Promise<TenantUser>;
  removeUserFromTenant(tenantId: number, userId: string): Promise<boolean>;
  
  // Clients
  getClients(tenantId: number): Promise<PcClient[]>;
  getClient(id: number, tenantId: number): Promise<PcClient | undefined>;
  createClient(client: InsertPcClient): Promise<PcClient>;
  updateClient(id: number, tenantId: number, client: Partial<InsertPcClient>): Promise<PcClient | undefined>;
  deleteClient(id: number, tenantId: number): Promise<boolean>;
  
  // Client Contacts
  getClientContacts(clientId: number): Promise<PcClientContact[]>;
  createClientContact(contact: InsertPcClientContact): Promise<PcClientContact>;
  deleteClientContact(id: number): Promise<boolean>;
  
  // Projects
  getProjects(tenantId: number): Promise<PcProject[]>;
  getProjectsByClient(clientId: number, tenantId: number): Promise<PcProject[]>;
  getProject(id: number, tenantId: number): Promise<PcProject | undefined>;
  createProject(project: InsertPcProject): Promise<PcProject>;
  updateProject(id: number, tenantId: number, project: Partial<InsertPcProject>): Promise<PcProject | undefined>;
  deleteProject(id: number, tenantId: number): Promise<boolean>;
  
  // Project Members
  getProjectMembers(projectId: number): Promise<PcProjectMember[]>;
  addProjectMember(member: InsertPcProjectMember): Promise<PcProjectMember>;
  removeProjectMember(id: number): Promise<boolean>;
  
  // Project Team Members (for production projects)
  getProjectTeamMembers(projectId: number): Promise<PcProjectTeamMember[]>;
  addProjectTeamMember(member: InsertPcProjectTeamMember): Promise<PcProjectTeamMember>;
  removeProjectTeamMember(id: number): Promise<boolean>;
  
  // Project Tasks (production project tasks)
  getProjectTasks(projectId: number): Promise<PcProjectTask[]>;
  createProjectTask(task: InsertPcProjectTask): Promise<PcProjectTask>;
  updateProjectTask(id: number, task: Partial<InsertPcProjectTask>): Promise<PcProjectTask | undefined>;
  deleteProjectTask(id: number): Promise<boolean>;
  
  // Project Files
  getProjectFiles(projectId: number): Promise<PcProjectFile[]>;
  getProjectFile(id: number): Promise<PcProjectFile | undefined>;
  createProjectFile(file: InsertPcProjectFile): Promise<PcProjectFile>;
  deleteProjectFile(id: number): Promise<boolean>;
  
  // Project History
  getProjectHistory(projectId: number): Promise<PcProjectHistory | undefined>;
  saveProjectHistory(data: InsertPcProjectHistory): Promise<PcProjectHistory>;
  
  // Canvas Blocks
  getCanvasBlocks(projectId: number): Promise<PcCanvasBlock[]>;
  getCanvasBlock(id: number): Promise<PcCanvasBlock | undefined>;
  createCanvasBlock(block: InsertPcCanvasBlock): Promise<PcCanvasBlock>;
  updateCanvasBlock(id: number, block: Partial<InsertPcCanvasBlock>): Promise<PcCanvasBlock | undefined>;
  deleteCanvasBlock(id: number): Promise<boolean>;
  
  // Canvas Diagnostic Questions
  getCanvasQuestions(blockId: number): Promise<PcCanvasQuestion[]>;
  createCanvasQuestion(question: InsertPcCanvasQuestion): Promise<PcCanvasQuestion>;
  updateCanvasQuestion(id: number, question: Partial<InsertPcCanvasQuestion>): Promise<PcCanvasQuestion | undefined>;
  deleteCanvasQuestion(id: number): Promise<boolean>;
  
  // Canvas Expected Outputs
  getCanvasExpectedOutputs(blockId: number): Promise<PcCanvasExpectedOutput[]>;
  createCanvasExpectedOutput(output: InsertPcCanvasExpectedOutput): Promise<PcCanvasExpectedOutput>;
  updateCanvasExpectedOutput(id: number, output: Partial<InsertPcCanvasExpectedOutput>): Promise<PcCanvasExpectedOutput | undefined>;
  deleteCanvasExpectedOutput(id: number): Promise<boolean>;
  
  // Canvas PDCA Links
  getCanvasPdcaLinks(blockId: number): Promise<PcCanvasPdcaLink[]>;
  createCanvasPdcaLink(link: InsertPcCanvasPdcaLink): Promise<PcCanvasPdcaLink>;
  updateCanvasPdcaLink(id: number, link: Partial<InsertPcCanvasPdcaLink>): Promise<PcCanvasPdcaLink | undefined>;
  deleteCanvasPdcaLink(id: number): Promise<boolean>;
  
  // Canvas SWOT Links
  getCanvasSwotLinks(blockId: number): Promise<PcCanvasSwotLink[]>;
  createCanvasSwotLink(link: InsertPcCanvasSwotLink): Promise<PcCanvasSwotLink>;
  deleteCanvasSwotLink(id: number): Promise<boolean>;
  
  // Processes
  getProcesses(projectId: number): Promise<PcProcess[]>;
  getProcess(id: number): Promise<PcProcess | undefined>;
  createProcess(process: InsertPcProcess): Promise<PcProcess>;
  updateProcess(id: number, process: Partial<InsertPcProcess>): Promise<PcProcess | undefined>;
  deleteProcess(id: number): Promise<boolean>;
  
  // Process Steps
  getProcessSteps(processId: number): Promise<PcProcessStep[]>;
  createProcessStep(step: InsertPcProcessStep): Promise<PcProcessStep>;
  updateProcessStep(id: number, step: Partial<InsertPcProcessStep>): Promise<PcProcessStep | undefined>;
  deleteProcessStep(id: number): Promise<boolean>;
  
  // SWOT Analyses
  getSwotAnalyses(projectId: number): Promise<PcSwotAnalysis[]>;
  getSwotAnalysis(id: number): Promise<PcSwotAnalysis | undefined>;
  createSwotAnalysis(analysis: InsertPcSwotAnalysis): Promise<PcSwotAnalysis>;
  updateSwotAnalysis(id: number, analysis: Partial<InsertPcSwotAnalysis>): Promise<PcSwotAnalysis | undefined>;
  deleteSwotAnalysis(id: number): Promise<boolean>;
  
  // SWOT Items
  getSwotItems(swotAnalysisId: number): Promise<PcSwotItem[]>;
  createSwotItem(item: InsertPcSwotItem): Promise<PcSwotItem>;
  updateSwotItem(id: number, item: Partial<InsertPcSwotItem>): Promise<PcSwotItem | undefined>;
  deleteSwotItem(id: number): Promise<boolean>;
  
  // CRM Stages
  getCrmStages(tenantId: number): Promise<PcCrmStage[]>;
  createCrmStage(stage: InsertPcCrmStage): Promise<PcCrmStage>;
  updateCrmStage(id: number, tenantId: number, stage: Partial<InsertPcCrmStage>): Promise<PcCrmStage | undefined>;
  deleteCrmStage(id: number, tenantId: number): Promise<boolean>;
  
  // CRM Leads
  getCrmLeads(tenantId: number): Promise<PcCrmLead[]>;
  getCrmLead(id: number, tenantId: number): Promise<PcCrmLead | undefined>;
  createCrmLead(lead: InsertPcCrmLead): Promise<PcCrmLead>;
  updateCrmLead(id: number, tenantId: number, lead: Partial<InsertPcCrmLead>): Promise<PcCrmLead | undefined>;
  deleteCrmLead(id: number, tenantId: number): Promise<boolean>;
  
  // CRM Opportunities
  getCrmOpportunities(tenantId: number): Promise<PcCrmOpportunity[]>;
  getCrmOpportunity(id: number, tenantId: number): Promise<PcCrmOpportunity | undefined>;
  createCrmOpportunity(opportunity: InsertPcCrmOpportunity): Promise<PcCrmOpportunity>;
  updateCrmOpportunity(id: number, tenantId: number, opportunity: Partial<InsertPcCrmOpportunity>): Promise<PcCrmOpportunity | undefined>;
  deleteCrmOpportunity(id: number, tenantId: number): Promise<boolean>;
  
  // CRM Activities
  getCrmActivities(tenantId: number): Promise<PcCrmActivity[]>;
  createCrmActivity(activity: InsertPcCrmActivity): Promise<PcCrmActivity>;
  updateCrmActivity(id: number, activity: Partial<InsertPcCrmActivity>): Promise<PcCrmActivity | undefined>;
  deleteCrmActivity(id: number): Promise<boolean>;
  
  // Deliverables
  getDeliverables(projectId: number): Promise<PcDeliverable[]>;
  createDeliverable(deliverable: InsertPcDeliverable): Promise<PcDeliverable>;
  updateDeliverable(id: number, deliverable: Partial<InsertPcDeliverable>): Promise<PcDeliverable | undefined>;
  deleteDeliverable(id: number): Promise<boolean>;
  
  // Tasks
  getTasks(projectId?: number): Promise<PcTask[]>;
  getTask(id: number): Promise<PcTask | undefined>;
  createTask(task: InsertPcTask): Promise<PcTask>;
  updateTask(id: number, task: Partial<InsertPcTask>): Promise<PcTask | undefined>;
  deleteTask(id: number): Promise<boolean>;
  
  // PDCA Cycles
  getPdcaCycles(tenantId: number, projectId?: number): Promise<PcPdcaCycle[]>;
  getPdcaCycle(id: number, tenantId: number): Promise<PcPdcaCycle | undefined>;
  createPdcaCycle(cycle: InsertPcPdcaCycle): Promise<PcPdcaCycle>;
  updatePdcaCycle(id: number, tenantId: number, cycle: Partial<InsertPcPdcaCycle>): Promise<PcPdcaCycle | undefined>;
  deletePdcaCycle(id: number, tenantId: number): Promise<boolean>;
  
  // PDCA Actions
  getPdcaActions(cycleId: number): Promise<PcPdcaAction[]>;
  createPdcaAction(action: InsertPcPdcaAction): Promise<PcPdcaAction>;
  updatePdcaAction(id: number, action: Partial<InsertPcPdcaAction>): Promise<PcPdcaAction | undefined>;
  deletePdcaAction(id: number): Promise<boolean>;
  
  // Requirements
  getRequirements(tenantId: number, projectId?: number): Promise<PcRequirement[]>;
  getRequirement(id: number, tenantId: number): Promise<PcRequirement | undefined>;
  createRequirement(requirement: InsertPcRequirement): Promise<PcRequirement>;
  updateRequirement(id: number, tenantId: number, requirement: Partial<InsertPcRequirement>): Promise<PcRequirement | undefined>;
  deleteRequirement(id: number, tenantId: number): Promise<boolean>;
  
  // PDCA Overview (aggregated from all sources)
  getPdcaOverview(projectId: number): Promise<{
    items: Array<{
      id: number;
      source: 'canvas' | 'processes' | 'swot' | 'requirements';
      title: string;
      description: string | null;
      pdcaStatus: string;
      pdcaActionPlan: string | null;
      pdcaResult: string | null;
      projectId: number;
    }>;
    stats: {
      canvas: { total: number; plan: number; do: number; check: number; act: number; done: number };
      processes: { total: number; plan: number; do: number; check: number; act: number; done: number };
      swot: { total: number; plan: number; do: number; check: number; act: number; done: number };
      requirements: { total: number; plan: number; do: number; check: number; act: number; done: number };
    };
  }>;
}

export class CompassStorage implements ICompassStorage {
  // ========== TENANTS ==========
  async getTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants).orderBy(asc(tenants.name));
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant;
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [newTenant] = await db.insert(tenants).values(tenant).returning();
    return newTenant;
  }

  async updateTenant(id: number, tenant: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants).set({ ...tenant, updatedAt: new Date() }).where(eq(tenants.id, id)).returning();
    return updated;
  }

  async deleteTenant(id: number): Promise<boolean> {
    const result = await db.delete(tenants).where(eq(tenants.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== TENANT USERS ==========
  async getTenantUsers(tenantId: number): Promise<TenantUser[]> {
    return await db.select().from(tenantUsers).where(eq(tenantUsers.tenantId, tenantId));
  }

  async getUserTenants(userId: string): Promise<Tenant[]> {
    const result = await db.select({ tenant: tenants })
      .from(tenantUsers)
      .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
      .where(eq(tenantUsers.userId, userId));
    return result.map(r => r.tenant);
  }

  async isUserInTenant(userId: string, tenantId: number): Promise<boolean> {
    const [membership] = await db.select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)));
    return !!membership;
  }

  async addUserToTenant(data: InsertTenantUser): Promise<TenantUser> {
    const [tu] = await db.insert(tenantUsers).values(data).returning();
    return tu;
  }

  async removeUserFromTenant(tenantId: number, userId: string): Promise<boolean> {
    const result = await db.delete(tenantUsers).where(
      and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId))
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== CLIENTS ==========
  async getClients(tenantId: number): Promise<PcClient[]> {
    return await db.select().from(pcClients).where(eq(pcClients.tenantId, tenantId)).orderBy(asc(pcClients.name));
  }

  async getClient(id: number, tenantId: number): Promise<PcClient | undefined> {
    const [client] = await db.select().from(pcClients).where(
      and(eq(pcClients.id, id), eq(pcClients.tenantId, tenantId))
    );
    return client;
  }

  async createClient(client: InsertPcClient): Promise<PcClient> {
    const [newClient] = await db.insert(pcClients).values(client).returning();
    return newClient;
  }

  async updateClient(id: number, tenantId: number, client: Partial<InsertPcClient>): Promise<PcClient | undefined> {
    const [updated] = await db.update(pcClients)
      .set({ ...client, updatedAt: new Date() })
      .where(and(eq(pcClients.id, id), eq(pcClients.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteClient(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(pcClients).where(
      and(eq(pcClients.id, id), eq(pcClients.tenantId, tenantId))
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== CLIENT CONTACTS ==========
  async getClientContacts(clientId: number): Promise<PcClientContact[]> {
    return await db.select().from(pcClientContacts).where(eq(pcClientContacts.clientId, clientId));
  }

  async createClientContact(contact: InsertPcClientContact): Promise<PcClientContact> {
    const [newContact] = await db.insert(pcClientContacts).values(contact).returning();
    return newContact;
  }

  async deleteClientContact(id: number): Promise<boolean> {
    const result = await db.delete(pcClientContacts).where(eq(pcClientContacts.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== PROJECTS ==========
  async getProjects(tenantId: number): Promise<PcProject[]> {
    return await db.select().from(pcProjects).where(eq(pcProjects.tenantId, tenantId)).orderBy(desc(pcProjects.createdAt));
  }

  async getProjectsByClient(clientId: number, tenantId: number): Promise<PcProject[]> {
    return await db.select().from(pcProjects).where(
      and(eq(pcProjects.clientId, clientId), eq(pcProjects.tenantId, tenantId))
    ).orderBy(desc(pcProjects.createdAt));
  }

  async getProject(id: number, tenantId: number): Promise<PcProject | undefined> {
    const [project] = await db.select().from(pcProjects).where(
      and(eq(pcProjects.id, id), eq(pcProjects.tenantId, tenantId))
    );
    return project;
  }

  async createProject(project: InsertPcProject): Promise<PcProject> {
    const [newProject] = await db.insert(pcProjects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, tenantId: number, project: Partial<InsertPcProject>): Promise<PcProject | undefined> {
    const [updated] = await db.update(pcProjects)
      .set({ ...project, updatedAt: new Date() })
      .where(and(eq(pcProjects.id, id), eq(pcProjects.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteProject(id: number, tenantId: number): Promise<boolean> {
    const [project] = await db.select().from(pcProjects).where(
      and(eq(pcProjects.id, id), eq(pcProjects.tenantId, tenantId))
    );
    
    if (!project) return false;
    
    if (project.projectType === "valuation" && project.clientId) {
      await db.delete(valuationProjects).where(
        and(
          eq(valuationProjects.tenantId, tenantId),
          eq(valuationProjects.clientId, project.clientId)
        )
      );
    }
    
    const result = await db.delete(pcProjects).where(
      and(eq(pcProjects.id, id), eq(pcProjects.tenantId, tenantId))
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== PROJECT MEMBERS ==========
  async getProjectMembers(projectId: number): Promise<PcProjectMember[]> {
    return await db.select().from(pcProjectMembers).where(eq(pcProjectMembers.projectId, projectId));
  }

  async addProjectMember(member: InsertPcProjectMember): Promise<PcProjectMember> {
    const [newMember] = await db.insert(pcProjectMembers).values(member).returning();
    return newMember;
  }

  async removeProjectMember(id: number): Promise<boolean> {
    const result = await db.delete(pcProjectMembers).where(eq(pcProjectMembers.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== CANVAS BLOCKS ==========
  async getCanvasBlocks(projectId: number): Promise<PcCanvasBlock[]> {
    return await db.select().from(pcCanvasBlocks).where(eq(pcCanvasBlocks.projectId, projectId));
  }

  async getCanvasBlock(id: number): Promise<PcCanvasBlock | undefined> {
    const [block] = await db.select().from(pcCanvasBlocks).where(eq(pcCanvasBlocks.id, id));
    return block;
  }

  async createCanvasBlock(block: InsertPcCanvasBlock): Promise<PcCanvasBlock> {
    const [newBlock] = await db.insert(pcCanvasBlocks).values(block).returning();
    return newBlock;
  }

  async updateCanvasBlock(id: number, block: Partial<InsertPcCanvasBlock>): Promise<PcCanvasBlock | undefined> {
    const [updated] = await db.update(pcCanvasBlocks)
      .set({ ...block, updatedAt: new Date() })
      .where(eq(pcCanvasBlocks.id, id))
      .returning();
    return updated;
  }

  async deleteCanvasBlock(id: number): Promise<boolean> {
    const result = await db.delete(pcCanvasBlocks).where(eq(pcCanvasBlocks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== CANVAS DIAGNOSTIC QUESTIONS ==========
  async getCanvasQuestions(blockId: number): Promise<PcCanvasQuestion[]> {
    return await db.select().from(pcCanvasQuestions).where(eq(pcCanvasQuestions.blockId, blockId)).orderBy(asc(pcCanvasQuestions.orderIndex));
  }

  async createCanvasQuestion(question: InsertPcCanvasQuestion): Promise<PcCanvasQuestion> {
    const [created] = await db.insert(pcCanvasQuestions).values(question).returning();
    return created;
  }

  async updateCanvasQuestion(id: number, question: Partial<InsertPcCanvasQuestion>): Promise<PcCanvasQuestion | undefined> {
    const [updated] = await db.update(pcCanvasQuestions).set(question).where(eq(pcCanvasQuestions.id, id)).returning();
    return updated;
  }

  async deleteCanvasQuestion(id: number): Promise<boolean> {
    const result = await db.delete(pcCanvasQuestions).where(eq(pcCanvasQuestions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== CANVAS EXPECTED OUTPUTS ==========
  async getCanvasExpectedOutputs(blockId: number): Promise<PcCanvasExpectedOutput[]> {
    return await db.select().from(pcCanvasExpectedOutputs).where(eq(pcCanvasExpectedOutputs.blockId, blockId)).orderBy(asc(pcCanvasExpectedOutputs.orderIndex));
  }

  async createCanvasExpectedOutput(output: InsertPcCanvasExpectedOutput): Promise<PcCanvasExpectedOutput> {
    const [created] = await db.insert(pcCanvasExpectedOutputs).values(output).returning();
    return created;
  }

  async updateCanvasExpectedOutput(id: number, output: Partial<InsertPcCanvasExpectedOutput>): Promise<PcCanvasExpectedOutput | undefined> {
    const [updated] = await db.update(pcCanvasExpectedOutputs).set(output).where(eq(pcCanvasExpectedOutputs.id, id)).returning();
    return updated;
  }

  async deleteCanvasExpectedOutput(id: number): Promise<boolean> {
    const result = await db.delete(pcCanvasExpectedOutputs).where(eq(pcCanvasExpectedOutputs.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== CANVAS PDCA LINKS ==========
  async getCanvasPdcaLinks(blockId: number): Promise<PcCanvasPdcaLink[]> {
    return await db.select().from(pcCanvasPdcaLinks).where(eq(pcCanvasPdcaLinks.blockId, blockId));
  }

  async createCanvasPdcaLink(link: InsertPcCanvasPdcaLink): Promise<PcCanvasPdcaLink> {
    const [created] = await db.insert(pcCanvasPdcaLinks).values(link).returning();
    return created;
  }

  async updateCanvasPdcaLink(id: number, link: Partial<InsertPcCanvasPdcaLink>): Promise<PcCanvasPdcaLink | undefined> {
    const [updated] = await db.update(pcCanvasPdcaLinks).set(link).where(eq(pcCanvasPdcaLinks.id, id)).returning();
    return updated;
  }

  async deleteCanvasPdcaLink(id: number): Promise<boolean> {
    const result = await db.delete(pcCanvasPdcaLinks).where(eq(pcCanvasPdcaLinks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== CANVAS SWOT LINKS ==========
  async getCanvasSwotLinks(blockId: number): Promise<PcCanvasSwotLink[]> {
    return await db.select().from(pcCanvasSwotLinks).where(eq(pcCanvasSwotLinks.blockId, blockId));
  }

  async createCanvasSwotLink(link: InsertPcCanvasSwotLink): Promise<PcCanvasSwotLink> {
    const [created] = await db.insert(pcCanvasSwotLinks).values(link).returning();
    return created;
  }

  async deleteCanvasSwotLink(id: number): Promise<boolean> {
    const result = await db.delete(pcCanvasSwotLinks).where(eq(pcCanvasSwotLinks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== PROCESSES ==========
  async getProcesses(projectId: number): Promise<PcProcess[]> {
    return await db.select().from(pcProcesses).where(eq(pcProcesses.projectId, projectId)).orderBy(asc(pcProcesses.orderIndex));
  }

  async getProcess(id: number): Promise<PcProcess | undefined> {
    const [process] = await db.select().from(pcProcesses).where(eq(pcProcesses.id, id));
    return process;
  }

  async createProcess(process: InsertPcProcess): Promise<PcProcess> {
    const [newProcess] = await db.insert(pcProcesses).values(process).returning();
    return newProcess;
  }

  async updateProcess(id: number, process: Partial<InsertPcProcess>): Promise<PcProcess | undefined> {
    const [updated] = await db.update(pcProcesses)
      .set({ ...process, updatedAt: new Date() })
      .where(eq(pcProcesses.id, id))
      .returning();
    return updated;
  }

  async deleteProcess(id: number): Promise<boolean> {
    const result = await db.delete(pcProcesses).where(eq(pcProcesses.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== PROCESS STEPS ==========
  async getProcessSteps(processId: number): Promise<PcProcessStep[]> {
    return await db.select().from(pcProcessSteps).where(eq(pcProcessSteps.processId, processId)).orderBy(asc(pcProcessSteps.orderIndex));
  }

  async createProcessStep(step: InsertPcProcessStep): Promise<PcProcessStep> {
    const [newStep] = await db.insert(pcProcessSteps).values(step).returning();
    return newStep;
  }

  async updateProcessStep(id: number, step: Partial<InsertPcProcessStep>): Promise<PcProcessStep | undefined> {
    const [updated] = await db.update(pcProcessSteps).set(step).where(eq(pcProcessSteps.id, id)).returning();
    return updated;
  }

  async deleteProcessStep(id: number): Promise<boolean> {
    const result = await db.delete(pcProcessSteps).where(eq(pcProcessSteps.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== SWOT ANALYSES ==========
  async getSwotAnalyses(projectId: number): Promise<PcSwotAnalysis[]> {
    return await db.select().from(pcSwotAnalyses).where(eq(pcSwotAnalyses.projectId, projectId)).orderBy(desc(pcSwotAnalyses.createdAt));
  }

  async getSwotAnalysis(id: number): Promise<PcSwotAnalysis | undefined> {
    const [analysis] = await db.select().from(pcSwotAnalyses).where(eq(pcSwotAnalyses.id, id));
    return analysis;
  }

  async createSwotAnalysis(analysis: InsertPcSwotAnalysis): Promise<PcSwotAnalysis> {
    const [newAnalysis] = await db.insert(pcSwotAnalyses).values(analysis).returning();
    return newAnalysis;
  }

  async updateSwotAnalysis(id: number, analysis: Partial<InsertPcSwotAnalysis>): Promise<PcSwotAnalysis | undefined> {
    const [updated] = await db.update(pcSwotAnalyses)
      .set({ ...analysis, updatedAt: new Date() })
      .where(eq(pcSwotAnalyses.id, id))
      .returning();
    return updated;
  }

  async deleteSwotAnalysis(id: number): Promise<boolean> {
    const result = await db.delete(pcSwotAnalyses).where(eq(pcSwotAnalyses.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== SWOT ITEMS ==========
  async getSwotItems(swotAnalysisId: number): Promise<PcSwotItem[]> {
    return await db.select().from(pcSwotItems).where(eq(pcSwotItems.swotAnalysisId, swotAnalysisId)).orderBy(desc(pcSwotItems.priority));
  }

  async createSwotItem(item: InsertPcSwotItem): Promise<PcSwotItem> {
    const [newItem] = await db.insert(pcSwotItems).values(item).returning();
    return newItem;
  }

  async updateSwotItem(id: number, item: Partial<InsertPcSwotItem>): Promise<PcSwotItem | undefined> {
    const [updated] = await db.update(pcSwotItems).set(item).where(eq(pcSwotItems.id, id)).returning();
    return updated;
  }

  async deleteSwotItem(id: number): Promise<boolean> {
    const result = await db.delete(pcSwotItems).where(eq(pcSwotItems.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== CRM STAGES ==========
  async getCrmStages(tenantId: number): Promise<PcCrmStage[]> {
    return await db.select().from(pcCrmStages).where(eq(pcCrmStages.tenantId, tenantId)).orderBy(asc(pcCrmStages.orderIndex));
  }

  async createCrmStage(stage: InsertPcCrmStage): Promise<PcCrmStage> {
    const [newStage] = await db.insert(pcCrmStages).values(stage).returning();
    return newStage;
  }

  async updateCrmStage(id: number, tenantId: number, stage: Partial<InsertPcCrmStage>): Promise<PcCrmStage | undefined> {
    const [updated] = await db.update(pcCrmStages)
      .set(stage)
      .where(and(eq(pcCrmStages.id, id), eq(pcCrmStages.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteCrmStage(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(pcCrmStages).where(
      and(eq(pcCrmStages.id, id), eq(pcCrmStages.tenantId, tenantId))
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== CRM LEADS ==========
  async getCrmLeads(tenantId: number): Promise<PcCrmLead[]> {
    return await db.select().from(pcCrmLeads).where(eq(pcCrmLeads.tenantId, tenantId)).orderBy(desc(pcCrmLeads.createdAt));
  }

  async getCrmLead(id: number, tenantId: number): Promise<PcCrmLead | undefined> {
    const [lead] = await db.select().from(pcCrmLeads).where(
      and(eq(pcCrmLeads.id, id), eq(pcCrmLeads.tenantId, tenantId))
    );
    return lead;
  }

  async createCrmLead(lead: InsertPcCrmLead): Promise<PcCrmLead> {
    const [newLead] = await db.insert(pcCrmLeads).values(lead).returning();
    return newLead;
  }

  async updateCrmLead(id: number, tenantId: number, lead: Partial<InsertPcCrmLead>): Promise<PcCrmLead | undefined> {
    const [updated] = await db.update(pcCrmLeads)
      .set({ ...lead, updatedAt: new Date() })
      .where(and(eq(pcCrmLeads.id, id), eq(pcCrmLeads.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteCrmLead(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(pcCrmLeads).where(
      and(eq(pcCrmLeads.id, id), eq(pcCrmLeads.tenantId, tenantId))
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== CRM OPPORTUNITIES ==========
  async getCrmOpportunities(tenantId: number): Promise<PcCrmOpportunity[]> {
    return await db.select().from(pcCrmOpportunities).where(eq(pcCrmOpportunities.tenantId, tenantId)).orderBy(desc(pcCrmOpportunities.createdAt));
  }

  async getCrmOpportunity(id: number, tenantId: number): Promise<PcCrmOpportunity | undefined> {
    const [opp] = await db.select().from(pcCrmOpportunities).where(
      and(eq(pcCrmOpportunities.id, id), eq(pcCrmOpportunities.tenantId, tenantId))
    );
    return opp;
  }

  async createCrmOpportunity(opportunity: InsertPcCrmOpportunity): Promise<PcCrmOpportunity> {
    const [newOpp] = await db.insert(pcCrmOpportunities).values(opportunity).returning();
    return newOpp;
  }

  async updateCrmOpportunity(id: number, tenantId: number, opportunity: Partial<InsertPcCrmOpportunity>): Promise<PcCrmOpportunity | undefined> {
    const [updated] = await db.update(pcCrmOpportunities)
      .set({ ...opportunity, updatedAt: new Date() })
      .where(and(eq(pcCrmOpportunities.id, id), eq(pcCrmOpportunities.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteCrmOpportunity(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(pcCrmOpportunities).where(
      and(eq(pcCrmOpportunities.id, id), eq(pcCrmOpportunities.tenantId, tenantId))
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== CRM ACTIVITIES ==========
  async getCrmActivities(tenantId: number): Promise<PcCrmActivity[]> {
    return await db.select().from(pcCrmActivities).where(eq(pcCrmActivities.tenantId, tenantId)).orderBy(desc(pcCrmActivities.createdAt));
  }

  async createCrmActivity(activity: InsertPcCrmActivity): Promise<PcCrmActivity> {
    const [newActivity] = await db.insert(pcCrmActivities).values(activity).returning();
    return newActivity;
  }

  async updateCrmActivity(id: number, activity: Partial<InsertPcCrmActivity>): Promise<PcCrmActivity | undefined> {
    const [updated] = await db.update(pcCrmActivities).set(activity).where(eq(pcCrmActivities.id, id)).returning();
    return updated;
  }

  async deleteCrmActivity(id: number): Promise<boolean> {
    const result = await db.delete(pcCrmActivities).where(eq(pcCrmActivities.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== DELIVERABLES ==========
  async getDeliverables(projectId: number): Promise<PcDeliverable[]> {
    return await db.select().from(pcDeliverables).where(eq(pcDeliverables.projectId, projectId)).orderBy(desc(pcDeliverables.createdAt));
  }

  async createDeliverable(deliverable: InsertPcDeliverable): Promise<PcDeliverable> {
    const [newDeliverable] = await db.insert(pcDeliverables).values(deliverable).returning();
    return newDeliverable;
  }

  async updateDeliverable(id: number, deliverable: Partial<InsertPcDeliverable>): Promise<PcDeliverable | undefined> {
    const [updated] = await db.update(pcDeliverables).set(deliverable).where(eq(pcDeliverables.id, id)).returning();
    return updated;
  }

  async deleteDeliverable(id: number): Promise<boolean> {
    const result = await db.delete(pcDeliverables).where(eq(pcDeliverables.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== TASKS ==========
  async getTasks(projectId?: number): Promise<PcTask[]> {
    if (projectId) {
      return await db.select().from(pcTasks).where(eq(pcTasks.projectId, projectId)).orderBy(desc(pcTasks.createdAt));
    }
    return await db.select().from(pcTasks).orderBy(desc(pcTasks.createdAt));
  }

  async getTask(id: number): Promise<PcTask | undefined> {
    const [task] = await db.select().from(pcTasks).where(eq(pcTasks.id, id));
    return task;
  }

  async createTask(task: InsertPcTask): Promise<PcTask> {
    const [newTask] = await db.insert(pcTasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: number, task: Partial<InsertPcTask>): Promise<PcTask | undefined> {
    const [updated] = await db.update(pcTasks).set(task).where(eq(pcTasks.id, id)).returning();
    return updated;
  }

  async deleteTask(id: number): Promise<boolean> {
    const result = await db.delete(pcTasks).where(eq(pcTasks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== PDCA CYCLES ==========
  async getPdcaCycles(tenantId: number, projectId?: number): Promise<PcPdcaCycle[]> {
    if (projectId) {
      return await db.select().from(pcPdcaCycles)
        .where(and(eq(pcPdcaCycles.tenantId, tenantId), eq(pcPdcaCycles.projectId, projectId)))
        .orderBy(desc(pcPdcaCycles.createdAt));
    }
    return await db.select().from(pcPdcaCycles)
      .where(eq(pcPdcaCycles.tenantId, tenantId))
      .orderBy(desc(pcPdcaCycles.createdAt));
  }

  async getPdcaCycle(id: number, tenantId: number): Promise<PcPdcaCycle | undefined> {
    const [cycle] = await db.select().from(pcPdcaCycles)
      .where(and(eq(pcPdcaCycles.id, id), eq(pcPdcaCycles.tenantId, tenantId)));
    return cycle;
  }

  async createPdcaCycle(cycle: InsertPcPdcaCycle): Promise<PcPdcaCycle> {
    const [newCycle] = await db.insert(pcPdcaCycles).values(cycle).returning();
    return newCycle;
  }

  async updatePdcaCycle(id: number, tenantId: number, cycle: Partial<InsertPcPdcaCycle>): Promise<PcPdcaCycle | undefined> {
    const [updated] = await db.update(pcPdcaCycles)
      .set({ ...cycle, updatedAt: new Date() })
      .where(and(eq(pcPdcaCycles.id, id), eq(pcPdcaCycles.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deletePdcaCycle(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(pcPdcaCycles)
      .where(and(eq(pcPdcaCycles.id, id), eq(pcPdcaCycles.tenantId, tenantId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== PDCA ACTIONS ==========
  async getPdcaActions(cycleId: number): Promise<PcPdcaAction[]> {
    return await db.select().from(pcPdcaActions)
      .where(eq(pcPdcaActions.cycleId, cycleId))
      .orderBy(asc(pcPdcaActions.createdAt));
  }

  async createPdcaAction(action: InsertPcPdcaAction): Promise<PcPdcaAction> {
    const [newAction] = await db.insert(pcPdcaActions).values(action).returning();
    return newAction;
  }

  async updatePdcaAction(id: number, action: Partial<InsertPcPdcaAction>): Promise<PcPdcaAction | undefined> {
    const [updated] = await db.update(pcPdcaActions).set(action).where(eq(pcPdcaActions.id, id)).returning();
    return updated;
  }

  async deletePdcaAction(id: number): Promise<boolean> {
    const result = await db.delete(pcPdcaActions).where(eq(pcPdcaActions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== REQUIREMENTS ==========
  async getRequirements(tenantId: number, projectId?: number): Promise<PcRequirement[]> {
    if (projectId) {
      return await db.select().from(pcRequirements)
        .where(and(eq(pcRequirements.tenantId, tenantId), eq(pcRequirements.projectId, projectId)))
        .orderBy(desc(pcRequirements.createdAt));
    }
    return await db.select().from(pcRequirements)
      .where(eq(pcRequirements.tenantId, tenantId))
      .orderBy(desc(pcRequirements.createdAt));
  }

  async getRequirement(id: number, tenantId: number): Promise<PcRequirement | undefined> {
    const [req] = await db.select().from(pcRequirements)
      .where(and(eq(pcRequirements.id, id), eq(pcRequirements.tenantId, tenantId)));
    return req;
  }

  async createRequirement(requirement: InsertPcRequirement): Promise<PcRequirement> {
    const [newReq] = await db.insert(pcRequirements).values(requirement).returning();
    return newReq;
  }

  async updateRequirement(id: number, tenantId: number, requirement: Partial<InsertPcRequirement>): Promise<PcRequirement | undefined> {
    const [updated] = await db.update(pcRequirements)
      .set({ ...requirement, updatedAt: new Date() })
      .where(and(eq(pcRequirements.id, id), eq(pcRequirements.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteRequirement(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(pcRequirements)
      .where(and(eq(pcRequirements.id, id), eq(pcRequirements.tenantId, tenantId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ========== PDCA OVERVIEW ==========
  async getPdcaOverview(projectId: number): Promise<{
    items: Array<{
      id: number;
      source: 'canvas' | 'processes' | 'swot' | 'requirements';
      title: string;
      description: string | null;
      pdcaStatus: string;
      pdcaActionPlan: string | null;
      pdcaResult: string | null;
      projectId: number;
    }>;
    stats: {
      canvas: { total: number; plan: number; do: number; check: number; act: number; done: number };
      processes: { total: number; plan: number; do: number; check: number; act: number; done: number };
      swot: { total: number; plan: number; do: number; check: number; act: number; done: number };
      requirements: { total: number; plan: number; do: number; check: number; act: number; done: number };
    };
  }> {
    const countByStatus = (items: { pdcaStatus: string | null }[]) => {
      const result = { total: items.length, plan: 0, do: 0, check: 0, act: 0, done: 0 };
      items.forEach(item => {
        const status = item.pdcaStatus || 'plan';
        if (status === 'plan') result.plan++;
        else if (status === 'do') result.do++;
        else if (status === 'check') result.check++;
        else if (status === 'act') result.act++;
        else if (status === 'done') result.done++;
      });
      return result;
    };

    // Get Canvas blocks with PDCA tracking
    const canvasBlocks = await db.select().from(pcCanvasBlocks)
      .where(eq(pcCanvasBlocks.projectId, projectId));

    // Get Process steps with bottlenecks/pain points
    const processStepsList = await db.select({
      step: pcProcessSteps,
      processName: pcProcesses.name,
    })
      .from(pcProcessSteps)
      .innerJoin(pcProcesses, eq(pcProcessSteps.processId, pcProcesses.id))
      .where(eq(pcProcesses.projectId, projectId));

    // Get SWOT items with action plans
    const swotItemsList = await db.select({
      item: pcSwotItems,
      analysisName: pcSwotAnalyses.name,
    })
      .from(pcSwotItems)
      .innerJoin(pcSwotAnalyses, eq(pcSwotItems.swotAnalysisId, pcSwotAnalyses.id))
      .where(eq(pcSwotAnalyses.projectId, projectId));

    // Get Requirements
    const requirementsList = await db.select().from(pcRequirements)
      .where(eq(pcRequirements.projectId, projectId));

    // Build unified items list
    const items: Array<{
      id: number;
      source: 'canvas' | 'processes' | 'swot' | 'requirements';
      title: string;
      description: string | null;
      pdcaStatus: string;
      pdcaActionPlan: string | null;
      pdcaResult: string | null;
      projectId: number;
    }> = [];

    // Add Canvas items
    canvasBlocks.forEach(block => {
      items.push({
        id: block.id,
        source: 'canvas',
        title: block.title || block.blockType,
        description: block.content,
        pdcaStatus: block.pdcaStatus || 'plan',
        pdcaActionPlan: block.pdcaActionPlan,
        pdcaResult: block.pdcaResult,
        projectId,
      });
    });

    // Add Process items
    processStepsList.forEach(({ step, processName }) => {
      items.push({
        id: step.id,
        source: 'processes',
        title: `${processName}: ${step.name}`,
        description: step.painPoints || step.description,
        pdcaStatus: step.pdcaStatus || 'plan',
        pdcaActionPlan: step.pdcaActionPlan,
        pdcaResult: step.pdcaResult,
        projectId,
      });
    });

    // Add SWOT items
    swotItemsList.forEach(({ item, analysisName }) => {
      items.push({
        id: item.id,
        source: 'swot',
        title: item.title || item.description,
        description: item.description,
        pdcaStatus: item.pdcaStatus || 'plan',
        pdcaActionPlan: item.actionPlan,
        pdcaResult: item.result,
        projectId,
      });
    });

    // Add Requirements
    requirementsList.forEach(req => {
      items.push({
        id: req.id,
        source: 'requirements',
        title: req.title,
        description: req.description,
        pdcaStatus: req.pdcaStatus || 'plan',
        pdcaActionPlan: req.pdcaActionPlan,
        pdcaResult: req.pdcaResult,
        projectId,
      });
    });

    return {
      items,
      stats: {
        canvas: countByStatus(canvasBlocks),
        processes: countByStatus(processStepsList.map(p => ({ pdcaStatus: p.step.pdcaStatus }))),
        swot: countByStatus(swotItemsList.map(s => ({ pdcaStatus: s.item.pdcaStatus }))),
        requirements: countByStatus(requirementsList),
      },
    };
  }

  // ========== REPORT TEMPLATES ==========
  async getReportTemplates(): Promise<PcReportTemplate[]> {
    return await db.select().from(pcReportTemplates).where(eq(pcReportTemplates.isActive, 1)).orderBy(asc(pcReportTemplates.name));
  }

  async getReportTemplate(id: number): Promise<PcReportTemplate | undefined> {
    const [template] = await db.select().from(pcReportTemplates).where(eq(pcReportTemplates.id, id));
    return template;
  }

  async createReportTemplate(template: InsertPcReportTemplate): Promise<PcReportTemplate> {
    const [created] = await db.insert(pcReportTemplates).values(template).returning();
    return created;
  }

  async updateReportTemplate(id: number, template: Partial<InsertPcReportTemplate>): Promise<PcReportTemplate | undefined> {
    const [updated] = await db.update(pcReportTemplates).set(template).where(eq(pcReportTemplates.id, id)).returning();
    return updated;
  }

  async deleteReportTemplate(id: number): Promise<boolean> {
    const [deleted] = await db.delete(pcReportTemplates).where(eq(pcReportTemplates.id, id)).returning();
    return !!deleted;
  }

  // ========== REPORT CONFIGURATIONS ==========
  async getReportConfigurations(tenantId: number, projectId?: number): Promise<PcReportConfiguration[]> {
    if (projectId) {
      return await db.select().from(pcReportConfigurations)
        .where(and(eq(pcReportConfigurations.tenantId, tenantId), eq(pcReportConfigurations.projectId, projectId)))
        .orderBy(desc(pcReportConfigurations.createdAt));
    }
    return await db.select().from(pcReportConfigurations)
      .where(eq(pcReportConfigurations.tenantId, tenantId))
      .orderBy(desc(pcReportConfigurations.createdAt));
  }

  async getReportConfiguration(id: number, tenantId: number): Promise<PcReportConfiguration | undefined> {
    const [config] = await db.select().from(pcReportConfigurations)
      .where(and(eq(pcReportConfigurations.id, id), eq(pcReportConfigurations.tenantId, tenantId)));
    return config;
  }

  async createReportConfiguration(config: InsertPcReportConfiguration): Promise<PcReportConfiguration> {
    const [created] = await db.insert(pcReportConfigurations).values(config).returning();
    return created;
  }

  async updateReportConfiguration(id: number, tenantId: number, config: Partial<InsertPcReportConfiguration>): Promise<PcReportConfiguration | undefined> {
    const [updated] = await db.update(pcReportConfigurations)
      .set({ ...config, updatedAt: new Date() })
      .where(and(eq(pcReportConfigurations.id, id), eq(pcReportConfigurations.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteReportConfiguration(id: number, tenantId: number): Promise<boolean> {
    const [deleted] = await db.delete(pcReportConfigurations)
      .where(and(eq(pcReportConfigurations.id, id), eq(pcReportConfigurations.tenantId, tenantId)))
      .returning();
    return !!deleted;
  }

  // ========== GENERATED REPORTS ==========
  async getGeneratedReports(tenantId: number, projectId?: number): Promise<PcGeneratedReport[]> {
    if (projectId) {
      return await db.select().from(pcGeneratedReports)
        .where(and(eq(pcGeneratedReports.tenantId, tenantId), eq(pcGeneratedReports.projectId, projectId)))
        .orderBy(desc(pcGeneratedReports.generatedAt));
    }
    return await db.select().from(pcGeneratedReports)
      .where(eq(pcGeneratedReports.tenantId, tenantId))
      .orderBy(desc(pcGeneratedReports.generatedAt));
  }

  async getGeneratedReport(id: number, tenantId: number): Promise<PcGeneratedReport | undefined> {
    const [report] = await db.select().from(pcGeneratedReports)
      .where(and(eq(pcGeneratedReports.id, id), eq(pcGeneratedReports.tenantId, tenantId)));
    return report;
  }

  async createGeneratedReport(report: InsertPcGeneratedReport): Promise<PcGeneratedReport> {
    const [created] = await db.insert(pcGeneratedReports).values(report).returning();
    return created;
  }

  async updateGeneratedReport(id: number, tenantId: number, report: Partial<InsertPcGeneratedReport>): Promise<PcGeneratedReport | undefined> {
    const [updated] = await db.update(pcGeneratedReports)
      .set(report)
      .where(and(eq(pcGeneratedReports.id, id), eq(pcGeneratedReports.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteGeneratedReport(id: number, tenantId: number): Promise<boolean> {
    const [deleted] = await db.delete(pcGeneratedReports)
      .where(and(eq(pcGeneratedReports.id, id), eq(pcGeneratedReports.tenantId, tenantId)))
      .returning();
    return !!deleted;
  }

  // ========== REPORT DATA AGGREGATION ==========
  async getProjectReportData(projectId: number) {
    const project = await this.getProjectById(projectId);
    if (!project) return null;

    const [canvasBlocks, processes, swotAnalyses, requirements, pdcaCycles] = await Promise.all([
      this.getCanvasBlocks(projectId),
      this.getProcesses(projectId),
      this.getSwotAnalyses(projectId),
      this.getRequirements(projectId),
      this.getPdcaCycles(projectId),
    ]);

    // Get process steps for each process
    const processesWithSteps = await Promise.all(
      processes.map(async (process) => ({
        ...process,
        steps: await this.getProcessSteps(process.id),
      }))
    );

    // Get SWOT items for each analysis
    const swotWithItems = await Promise.all(
      swotAnalyses.map(async (analysis) => ({
        ...analysis,
        items: await this.getSwotItems(analysis.id),
      }))
    );

    // Get PDCA actions for each cycle
    const pdcaWithActions = await Promise.all(
      pdcaCycles.map(async (cycle) => ({
        ...cycle,
        actions: await this.getPdcaActions(cycle.id),
      }))
    );

    // Get canvas questions for each block
    const canvasWithQuestions = await Promise.all(
      canvasBlocks.map(async (block) => ({
        ...block,
        questions: await this.getCanvasQuestions(block.id),
        expectedOutputs: await this.getCanvasExpectedOutputs(block.id),
      }))
    );

    return {
      project,
      canvas: canvasWithQuestions,
      processes: processesWithSteps,
      swot: swotWithItems,
      requirements,
      pdca: pdcaWithActions,
    };
  }

  private async getProjectById(projectId: number): Promise<PcProject | undefined> {
    const [project] = await db.select().from(pcProjects).where(eq(pcProjects.id, projectId));
    return project;
  }

  // ========== ERP ADHERENCE ==========
  async getErpModules(tenantId: number): Promise<PcErpModule[]> {
    return await db.select().from(pcErpModules)
      .where(eq(pcErpModules.tenantId, tenantId))
      .orderBy(asc(pcErpModules.orderIndex));
  }

  async createErpModule(module: InsertPcErpModule): Promise<PcErpModule> {
    const [created] = await db.insert(pcErpModules).values(module).returning();
    return created;
  }

  async updateErpModule(id: number, tenantId: number, module: Partial<InsertPcErpModule>): Promise<PcErpModule | undefined> {
    const [updated] = await db.update(pcErpModules)
      .set(module)
      .where(and(eq(pcErpModules.id, id), eq(pcErpModules.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteErpModule(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(pcErpModules)
      .where(and(eq(pcErpModules.id, id), eq(pcErpModules.tenantId, tenantId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getErpRequirements(projectId: number): Promise<PcErpRequirement[]> {
    return await db.select().from(pcErpRequirements)
      .where(eq(pcErpRequirements.projectId, projectId))
      .orderBy(desc(pcErpRequirements.createdAt));
  }

  async getErpRequirement(id: number): Promise<PcErpRequirement | undefined> {
    const [requirement] = await db.select().from(pcErpRequirements).where(eq(pcErpRequirements.id, id));
    return requirement;
  }

  async createErpRequirement(requirement: InsertPcErpRequirement): Promise<PcErpRequirement> {
    const [created] = await db.insert(pcErpRequirements).values(requirement).returning();
    return created;
  }

  async updateErpRequirement(id: number, tenantId: number, requirement: Partial<InsertPcErpRequirement>): Promise<PcErpRequirement | undefined> {
    const [updated] = await db.update(pcErpRequirements)
      .set({ ...requirement, updatedAt: new Date() })
      .where(and(eq(pcErpRequirements.id, id), eq(pcErpRequirements.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteErpRequirement(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(pcErpRequirements).where(and(eq(pcErpRequirements.id, id), eq(pcErpRequirements.tenantId, tenantId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getErpParameterizationTopics(projectId: number): Promise<PcErpParameterizationTopic[]> {
    return await db.select().from(pcErpParameterizationTopics)
      .where(eq(pcErpParameterizationTopics.projectId, projectId))
      .orderBy(asc(pcErpParameterizationTopics.orderIndex));
  }

  async createErpParameterizationTopic(topic: InsertPcErpParameterizationTopic): Promise<PcErpParameterizationTopic> {
    const [created] = await db.insert(pcErpParameterizationTopics).values(topic).returning();
    return created;
  }

  async updateErpParameterizationTopic(id: number, tenantId: number, topic: Partial<InsertPcErpParameterizationTopic>): Promise<PcErpParameterizationTopic | undefined> {
    const [updated] = await db.update(pcErpParameterizationTopics)
      .set({ ...topic, updatedAt: new Date() })
      .where(and(eq(pcErpParameterizationTopics.id, id), eq(pcErpParameterizationTopics.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteErpParameterizationTopic(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(pcErpParameterizationTopics).where(and(eq(pcErpParameterizationTopics.id, id), eq(pcErpParameterizationTopics.tenantId, tenantId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getErpParameterizationItems(topicId: number): Promise<PcErpParameterizationItem[]> {
    return await db.select().from(pcErpParameterizationItems)
      .where(eq(pcErpParameterizationItems.topicId, topicId))
      .orderBy(asc(pcErpParameterizationItems.orderIndex));
  }

  async createErpParameterizationItem(item: InsertPcErpParameterizationItem): Promise<PcErpParameterizationItem> {
    const [created] = await db.insert(pcErpParameterizationItems).values(item).returning();
    return created;
  }

  async updateErpParameterizationItem(id: number, tenantId: number, item: Partial<InsertPcErpParameterizationItem>): Promise<PcErpParameterizationItem | undefined> {
    const [existingItem] = await db.select().from(pcErpParameterizationItems).where(eq(pcErpParameterizationItems.id, id));
    if (!existingItem) return undefined;
    const [topic] = await db.select().from(pcErpParameterizationTopics).where(eq(pcErpParameterizationTopics.id, existingItem.topicId));
    if (!topic || topic.tenantId !== tenantId) return undefined;
    const [updated] = await db.update(pcErpParameterizationItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(pcErpParameterizationItems.id, id))
      .returning();
    return updated;
  }

  async deleteErpParameterizationItem(id: number, tenantId: number): Promise<boolean> {
    const [existingItem] = await db.select().from(pcErpParameterizationItems).where(eq(pcErpParameterizationItems.id, id));
    if (!existingItem) return false;
    const [topic] = await db.select().from(pcErpParameterizationTopics).where(eq(pcErpParameterizationTopics.id, existingItem.topicId));
    if (!topic || topic.tenantId !== tenantId) return false;
    const result = await db.delete(pcErpParameterizationItems).where(eq(pcErpParameterizationItems.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getErpAdherenceStats(projectId: number): Promise<{total: number; nativo: number; configuravel: number; customizavel: number; naoAtendido: number}> {
    const requirements = await this.getErpRequirements(projectId);
    const stats = {
      total: requirements.length,
      nativo: requirements.filter(r => r.adherenceStatus === "nativo").length,
      configuravel: requirements.filter(r => r.adherenceStatus === "configuravel").length,
      customizavel: requirements.filter(r => r.adherenceStatus === "customizavel").length,
      naoAtendido: requirements.filter(r => r.adherenceStatus === "nao_atendido").length,
    };
    return stats;
  }

  // Project Team Members
  async getProjectTeamMembers(projectId: number): Promise<PcProjectTeamMember[]> {
    return db.select().from(pcProjectTeamMembers).where(eq(pcProjectTeamMembers.projectId, projectId)).orderBy(desc(pcProjectTeamMembers.createdAt));
  }

  async addProjectTeamMember(member: InsertPcProjectTeamMember): Promise<PcProjectTeamMember> {
    const [created] = await db.insert(pcProjectTeamMembers).values(member).returning();
    return created;
  }

  async removeProjectTeamMember(id: number): Promise<boolean> {
    const result = await db.delete(pcProjectTeamMembers).where(eq(pcProjectTeamMembers.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Project Tasks
  async getProjectTasks(projectId: number): Promise<PcProjectTask[]> {
    return db.select().from(pcProjectTasks).where(eq(pcProjectTasks.projectId, projectId)).orderBy(desc(pcProjectTasks.createdAt));
  }

  async createProjectTask(task: InsertPcProjectTask): Promise<PcProjectTask> {
    const [created] = await db.insert(pcProjectTasks).values(task).returning();
    return created;
  }

  async updateProjectTask(id: number, task: Partial<InsertPcProjectTask>): Promise<PcProjectTask | undefined> {
    const [updated] = await db.update(pcProjectTasks).set(task).where(eq(pcProjectTasks.id, id)).returning();
    return updated;
  }

  async deleteProjectTask(id: number): Promise<boolean> {
    const result = await db.delete(pcProjectTasks).where(eq(pcProjectTasks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Project Files
  async getProjectFiles(projectId: number): Promise<PcProjectFile[]> {
    return db.select().from(pcProjectFiles).where(eq(pcProjectFiles.projectId, projectId)).orderBy(desc(pcProjectFiles.createdAt));
  }

  async getProjectFile(id: number): Promise<PcProjectFile | undefined> {
    const [file] = await db.select().from(pcProjectFiles).where(eq(pcProjectFiles.id, id));
    return file;
  }

  async createProjectFile(file: InsertPcProjectFile): Promise<PcProjectFile> {
    const [created] = await db.insert(pcProjectFiles).values(file).returning();
    return created;
  }

  async deleteProjectFile(id: number): Promise<boolean> {
    const result = await db.delete(pcProjectFiles).where(eq(pcProjectFiles.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Project History
  async getProjectHistory(projectId: number): Promise<PcProjectHistory | undefined> {
    const [history] = await db.select().from(pcProjectHistory).where(eq(pcProjectHistory.projectId, projectId));
    return history;
  }

  async saveProjectHistory(data: InsertPcProjectHistory): Promise<PcProjectHistory> {
    const existing = await this.getProjectHistory(data.projectId);
    if (existing) {
      const [updated] = await db.update(pcProjectHistory)
        .set({ content: data.content, updatedAt: new Date() })
        .where(eq(pcProjectHistory.projectId, data.projectId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(pcProjectHistory).values(data).returning();
      return created;
    }
  }
}

export const compassStorage = new CompassStorage();
