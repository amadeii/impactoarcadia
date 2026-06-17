import { Router, Request, Response, NextFunction } from "express";
import { compassStorage } from "./storage";
import { crmStorage } from "../crm/storage";
import { productionStorage } from "../production/storage";
import { valuationStorage } from "../valuation/storage";
import { 
  insertTenantSchema, insertTenantUserSchema,
  insertPcClientSchema, insertPcClientContactSchema,
  insertPcProjectSchema, insertPcProjectMemberSchema,
  insertPcCanvasBlockSchema, insertPcCanvasQuestionSchema, insertPcCanvasExpectedOutputSchema,
  insertPcCanvasPdcaLinkSchema, insertPcCanvasSwotLinkSchema,
  insertPcProcessSchema, insertPcProcessStepSchema,
  insertPcSwotAnalysisSchema, insertPcSwotItemSchema, updatePcSwotItemSchema,
  insertPcCrmStageSchema, insertPcCrmLeadSchema, insertPcCrmOpportunitySchema, insertPcCrmActivitySchema,
  insertPcDeliverableSchema, insertPcTaskSchema,
  insertPcPdcaCycleSchema, insertPcPdcaActionSchema, insertPcRequirementSchema,
  insertPcReportTemplateSchema, insertPcReportConfigurationSchema, insertPcGeneratedReportSchema,
  insertPcErpModuleSchema, insertPcErpRequirementSchema, insertPcErpParameterizationTopicSchema, insertPcErpParameterizationItemSchema
} from "@shared/schema";

const router = Router();

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  next();
}

// Apply auth to all routes
router.use(requireAuth);

// Helper to get tenant ID from request header or user's first tenant
async function getTenantId(req: Request): Promise<number | null> {
  const userId = (req.user as any).id;
  const headerTenantId = req.headers["x-tenant-id"];
  if (headerTenantId) {
    const tenantId = parseInt(headerTenantId as string);
    const isMember = await compassStorage.isUserInTenant(userId, tenantId);
    return isMember ? tenantId : null;
  }
  const tenants = await compassStorage.getUserTenants(userId);
  return tenants.length > 0 ? tenants[0].id : null;
}

// Validate tenant membership
async function validateTenantMembership(userId: string, tenantId: number): Promise<boolean> {
  return await compassStorage.isUserInTenant(userId, tenantId);
}

// Helper to validate project belongs to tenant
async function validateProjectAccess(projectId: number, tenantId: number): Promise<boolean> {
  const project = await compassStorage.getProject(projectId, tenantId);
  return !!project;
}

// Helper to validate client exists (agora usando CRM centralizado)
async function validateClientAccess(clientId: number): Promise<boolean> {
  const client = await crmStorage.getClient(clientId);
  return !!client;
}

// ========== TENANTS ==========
router.get("/tenants", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tenants = await compassStorage.getUserTenants(userId);
    res.json(tenants);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tenantId = parseInt(req.params.id);
    const isMember = await validateTenantMembership(userId, tenantId);
    if (!isMember) return res.status(403).json({ error: "Acesso negado ao tenant" });
    const tenant = await compassStorage.getTenant(tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });
    res.json(tenant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/tenants", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const parsed = insertTenantSchema.parse(req.body);
    const tenant = await compassStorage.createTenant(parsed);
    await compassStorage.addUserToTenant({ tenantId: tenant.id, userId, role: "owner", isOwner: "true" });
    res.status(201).json(tenant);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tenantId = parseInt(req.params.id);
    const isMember = await validateTenantMembership(userId, tenantId);
    if (!isMember) return res.status(403).json({ error: "Acesso negado ao tenant" });
    const tenant = await compassStorage.updateTenant(tenantId, req.body);
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });
    res.json(tenant);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tenantId = parseInt(req.params.id);
    const isMember = await validateTenantMembership(userId, tenantId);
    if (!isMember) return res.status(403).json({ error: "Acesso negado ao tenant" });
    const deleted = await compassStorage.deleteTenant(tenantId);
    if (!deleted) return res.status(404).json({ error: "Tenant não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== TENANT USERS ==========
router.get("/tenants/:tenantId/users", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tenantId = parseInt(req.params.tenantId);
    const isMember = await validateTenantMembership(userId, tenantId);
    if (!isMember) return res.status(403).json({ error: "Acesso negado ao tenant" });
    const users = await compassStorage.getTenantUsers(tenantId);
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/tenants/:tenantId/users", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tenantId = parseInt(req.params.tenantId);
    const isMember = await validateTenantMembership(userId, tenantId);
    if (!isMember) return res.status(403).json({ error: "Acesso negado ao tenant" });
    const parsed = insertTenantUserSchema.parse({ ...req.body, tenantId });
    const tu = await compassStorage.addUserToTenant(parsed);
    res.status(201).json(tu);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/tenants/:tenantId/users/:userId", async (req: Request, res: Response) => {
  try {
    const currentUserId = (req.user as any).id;
    const tenantId = parseInt(req.params.tenantId);
    const isMember = await validateTenantMembership(currentUserId, tenantId);
    if (!isMember) return res.status(403).json({ error: "Acesso negado ao tenant" });
    const deleted = await compassStorage.removeUserFromTenant(tenantId, req.params.userId);
    if (!deleted) return res.status(404).json({ error: "Usuário não encontrado no tenant" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CLIENTS (usando CRM centralizado) ==========
router.get("/clients", async (req: Request, res: Response) => {
  try {
    const clients = await crmStorage.getClients();
    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/clients/:id", async (req: Request, res: Response) => {
  try {
    const client = await crmStorage.getClient(parseInt(req.params.id));
    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(client);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CLIENT CONTACTS (deprecated - contatos agora são do CRM) ==========
router.get("/clients/:clientId/contacts", async (req: Request, res: Response) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const client = await crmStorage.getClient(clientId);
    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json([]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteClientContact(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Contato não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PROJECTS ==========
router.get("/projects", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
    const projects = clientId 
      ? await compassStorage.getProjectsByClient(clientId, tenantId)
      : await compassStorage.getProjects(tenantId);
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/projects/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const project = await compassStorage.getProject(parseInt(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const parsed = insertPcProjectSchema.parse({ ...req.body, userId, tenantId });
    const project = await compassStorage.createProject(parsed);
    
    // Se for projeto de valuation, criar também na tabela valuation_projects
    if (parsed.projectType === "valuation") {
      try {
        // Buscar dados do cliente para preencher informações do valuation project
        const client = parsed.clientId ? await crmStorage.getClient(parsed.clientId) : null;
        await valuationStorage.createProject({
          tenantId,
          companyName: client?.name || parsed.name,
          cnpj: client?.cnpj || null,
          sector: client?.segment || "Serviços",
          businessModel: null,
          stage: "Growth",
          size: "Média",
          status: "draft",
          consultantId: userId,
          clientId: parsed.clientId || null,
        });
      } catch (syncError) {
        console.error("Erro ao sincronizar com valuation_projects:", syncError);
      }
    }
    
    res.status(201).json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/projects/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const project = await compassStorage.updateProject(parseInt(req.params.id), tenantId, req.body);
    if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
    res.json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/projects/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const deleted = await compassStorage.deleteProject(parseInt(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Projeto não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PROJECT MEMBERS ==========
router.get("/projects/:projectId/members", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const members = await compassStorage.getProjectMembers(projectId);
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects/:projectId/members", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const parsed = insertPcProjectMemberSchema.parse({ ...req.body, projectId });
    const member = await compassStorage.addProjectMember(parsed);
    res.status(201).json(member);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/project-members/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.removeProjectMember(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Membro não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CANVAS BLOCKS ==========
router.get("/projects/:projectId/canvas", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const blocks = await compassStorage.getCanvasBlocks(projectId);
    
    // Add question counts to each block
    const blocksWithStats = await Promise.all(blocks.map(async (block) => {
      const questions = await compassStorage.getCanvasQuestions(block.id);
      const answeredCount = questions.filter(q => q.score !== null && q.score > 0).length;
      return {
        ...block,
        questionsCount: questions.length,
        answeredCount: answeredCount,
      };
    }));
    
    res.json(blocksWithStats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects/:projectId/canvas", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const parsed = insertPcCanvasBlockSchema.parse({ ...req.body, projectId });
    const block = await compassStorage.createCanvasBlock(parsed);
    res.status(201).json(block);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/canvas/:id", async (req: Request, res: Response) => {
  try {
    const block = await compassStorage.updateCanvasBlock(parseInt(req.params.id), req.body);
    if (!block) return res.status(404).json({ error: "Bloco não encontrado" });
    res.json(block);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/canvas/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteCanvasBlock(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Bloco não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CANVAS DIAGNOSTIC QUESTIONS ==========
router.get("/canvas/:blockId/questions", async (req: Request, res: Response) => {
  try {
    const blockId = parseInt(req.params.blockId);
    const questions = await compassStorage.getCanvasQuestions(blockId);
    res.json(questions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/canvas/:blockId/questions", async (req: Request, res: Response) => {
  try {
    const blockId = parseInt(req.params.blockId);
    const parsed = insertPcCanvasQuestionSchema.parse({ ...req.body, blockId });
    const question = await compassStorage.createCanvasQuestion(parsed);
    res.status(201).json(question);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/canvas/questions/:id", async (req: Request, res: Response) => {
  try {
    const question = await compassStorage.updateCanvasQuestion(parseInt(req.params.id), req.body);
    if (!question) return res.status(404).json({ error: "Pergunta não encontrada" });
    res.json(question);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/canvas/questions/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteCanvasQuestion(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Pergunta não encontrada" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CANVAS EXPECTED OUTPUTS ==========
router.get("/canvas/:blockId/outputs", async (req: Request, res: Response) => {
  try {
    const blockId = parseInt(req.params.blockId);
    const outputs = await compassStorage.getCanvasExpectedOutputs(blockId);
    res.json(outputs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/canvas/:blockId/outputs", async (req: Request, res: Response) => {
  try {
    const blockId = parseInt(req.params.blockId);
    const parsed = insertPcCanvasExpectedOutputSchema.parse({ ...req.body, blockId });
    const output = await compassStorage.createCanvasExpectedOutput(parsed);
    res.status(201).json(output);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/canvas/outputs/:id", async (req: Request, res: Response) => {
  try {
    const output = await compassStorage.updateCanvasExpectedOutput(parseInt(req.params.id), req.body);
    if (!output) return res.status(404).json({ error: "Saída não encontrada" });
    res.json(output);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/canvas/outputs/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteCanvasExpectedOutput(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Saída não encontrada" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CANVAS PDCA LINKS ==========
router.get("/canvas/:blockId/pdca", async (req: Request, res: Response) => {
  try {
    const blockId = parseInt(req.params.blockId);
    const links = await compassStorage.getCanvasPdcaLinks(blockId);
    res.json(links);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/canvas/:blockId/pdca", async (req: Request, res: Response) => {
  try {
    const blockId = parseInt(req.params.blockId);
    const parsed = insertPcCanvasPdcaLinkSchema.parse({ ...req.body, blockId });
    const link = await compassStorage.createCanvasPdcaLink(parsed);
    res.status(201).json(link);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/canvas/pdca/:id", async (req: Request, res: Response) => {
  try {
    const link = await compassStorage.updateCanvasPdcaLink(parseInt(req.params.id), req.body);
    if (!link) return res.status(404).json({ error: "Item PDCA não encontrado" });
    res.json(link);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/canvas/pdca/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteCanvasPdcaLink(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Item PDCA não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CANVAS SWOT LINKS ==========
router.get("/canvas/:blockId/swot", async (req: Request, res: Response) => {
  try {
    const blockId = parseInt(req.params.blockId);
    const links = await compassStorage.getCanvasSwotLinks(blockId);
    res.json(links);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/canvas/:blockId/swot", async (req: Request, res: Response) => {
  try {
    const blockId = parseInt(req.params.blockId);
    const parsed = insertPcCanvasSwotLinkSchema.parse({ ...req.body, blockId });
    const link = await compassStorage.createCanvasSwotLink(parsed);
    res.status(201).json(link);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/canvas/swot/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteCanvasSwotLink(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Item SWOT não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PROCESSES ==========
router.get("/projects/:projectId/processes", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const processes = await compassStorage.getProcesses(projectId);
    res.json(processes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects/:projectId/processes", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const parsed = insertPcProcessSchema.parse({ ...req.body, projectId });
    const process = await compassStorage.createProcess(parsed);
    res.status(201).json(process);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/processes/:id", async (req: Request, res: Response) => {
  try {
    const process = await compassStorage.updateProcess(parseInt(req.params.id), req.body);
    if (!process) return res.status(404).json({ error: "Processo não encontrado" });
    res.json(process);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/processes/:id/diagram", async (req: Request, res: Response) => {
  try {
    const { diagramNodes, diagramEdges, diagramViewport } = req.body;
    const process = await compassStorage.updateProcess(parseInt(req.params.id), {
      diagramNodes,
      diagramEdges,
      diagramViewport,
    });
    if (!process) return res.status(404).json({ error: "Processo não encontrado" });
    res.json(process);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/processes/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteProcess(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Processo não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PROCESS STEPS ==========
router.get("/processes/:processId/steps", async (req: Request, res: Response) => {
  try {
    const steps = await compassStorage.getProcessSteps(parseInt(req.params.processId));
    res.json(steps);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/processes/:processId/steps", async (req: Request, res: Response) => {
  try {
    const parsed = insertPcProcessStepSchema.parse({ ...req.body, processId: parseInt(req.params.processId) });
    const step = await compassStorage.createProcessStep(parsed);
    res.status(201).json(step);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/process-steps/:id", async (req: Request, res: Response) => {
  try {
    const step = await compassStorage.updateProcessStep(parseInt(req.params.id), req.body);
    if (!step) return res.status(404).json({ error: "Etapa não encontrada" });
    res.json(step);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/process-steps/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteProcessStep(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Etapa não encontrada" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== SWOT ANALYSES ==========
router.get("/projects/:projectId/swot", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const analyses = await compassStorage.getSwotAnalyses(projectId);
    res.json(analyses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects/:projectId/swot", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const parsed = insertPcSwotAnalysisSchema.parse({ ...req.body, projectId });
    const analysis = await compassStorage.createSwotAnalysis(parsed);
    res.status(201).json(analysis);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/swot/:id", async (req: Request, res: Response) => {
  try {
    const analysis = await compassStorage.updateSwotAnalysis(parseInt(req.params.id), req.body);
    if (!analysis) return res.status(404).json({ error: "Análise não encontrada" });
    res.json(analysis);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/swot/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteSwotAnalysis(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Análise não encontrada" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== SWOT ITEMS ==========
router.get("/swot/:swotId/items", async (req: Request, res: Response) => {
  try {
    const items = await compassStorage.getSwotItems(parseInt(req.params.swotId));
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/swot/:swotId/items", async (req: Request, res: Response) => {
  try {
    const parsed = insertPcSwotItemSchema.parse({ ...req.body, swotAnalysisId: parseInt(req.params.swotId) });
    const item = await compassStorage.createSwotItem(parsed);
    res.status(201).json(item);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/swot-items/:id", async (req: Request, res: Response) => {
  try {
    const parsed = updatePcSwotItemSchema.parse(req.body);
    const item = await compassStorage.updateSwotItem(parseInt(req.params.id), parsed);
    if (!item) return res.status(404).json({ error: "Item não encontrado" });
    res.json(item);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/swot-items/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteSwotItem(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Item não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CRM STAGES ==========
router.get("/crm/stages", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const stages = await compassStorage.getCrmStages(tenantId);
    res.json(stages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/crm/stages", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const parsed = insertPcCrmStageSchema.parse({ ...req.body, userId, tenantId });
    const stage = await compassStorage.createCrmStage(parsed);
    res.status(201).json(stage);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========== CRM LEADS ==========
router.get("/crm/leads", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const leads = await compassStorage.getCrmLeads(tenantId);
    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/crm/leads", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const parsed = insertPcCrmLeadSchema.parse({ ...req.body, userId, tenantId });
    const lead = await compassStorage.createCrmLead(parsed);
    res.status(201).json(lead);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/crm/leads/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const lead = await compassStorage.updateCrmLead(parseInt(req.params.id), tenantId, req.body);
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
    res.json(lead);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/crm/leads/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const deleted = await compassStorage.deleteCrmLead(parseInt(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Lead não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CRM OPPORTUNITIES ==========
router.get("/crm/opportunities", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const opportunities = await compassStorage.getCrmOpportunities(tenantId);
    res.json(opportunities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/crm/opportunities", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const parsed = insertPcCrmOpportunitySchema.parse({ ...req.body, userId, tenantId });
    const opportunity = await compassStorage.createCrmOpportunity(parsed);
    res.status(201).json(opportunity);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/crm/opportunities/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const opportunity = await compassStorage.updateCrmOpportunity(parseInt(req.params.id), tenantId, req.body);
    if (!opportunity) return res.status(404).json({ error: "Oportunidade não encontrada" });
    res.json(opportunity);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/crm/opportunities/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const deleted = await compassStorage.deleteCrmOpportunity(parseInt(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Oportunidade não encontrada" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CRM ACTIVITIES ==========
router.get("/crm/activities", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const activities = await compassStorage.getCrmActivities(tenantId);
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/crm/activities", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const parsed = insertPcCrmActivitySchema.parse({ ...req.body, userId, tenantId });
    const activity = await compassStorage.createCrmActivity(parsed);
    res.status(201).json(activity);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========== DELIVERABLES ==========
router.get("/projects/:projectId/deliverables", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const deliverables = await compassStorage.getDeliverables(projectId);
    res.json(deliverables);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects/:projectId/deliverables", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const parsed = insertPcDeliverableSchema.parse({ ...req.body, projectId });
    const deliverable = await compassStorage.createDeliverable(parsed);
    res.status(201).json(deliverable);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/deliverables/:id", async (req: Request, res: Response) => {
  try {
    const deliverable = await compassStorage.updateDeliverable(parseInt(req.params.id), req.body);
    if (!deliverable) return res.status(404).json({ error: "Entregável não encontrado" });
    res.json(deliverable);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/deliverables/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteDeliverable(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Entregável não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== TASKS ==========
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    if (projectId && !await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const tasks = await compassStorage.getTasks(projectId);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Sem tenant associado" });
    const userId = (req.user as any).id;
    if (req.body.projectId && !await validateProjectAccess(req.body.projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const parsed = insertPcTaskSchema.parse({ ...req.body, createdById: userId });
    const task = await compassStorage.createTask(parsed);
    res.status(201).json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const task = await compassStorage.updateTask(parseInt(req.params.id), req.body);
    if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteTask(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Tarefa não encontrada" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PDCA CYCLES ==========
router.get("/pdca/overview/:projectId", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const overview = await compassStorage.getPdcaOverview(projectId);
    res.json(overview);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/pdca", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    if (projectId && !await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const cycles = await compassStorage.getPdcaCycles(tenantId, projectId);
    res.json(cycles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/pdca/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const cycle = await compassStorage.getPdcaCycle(parseInt(req.params.id), tenantId);
    if (!cycle) return res.status(404).json({ error: "Ciclo PDCA não encontrado" });
    res.json(cycle);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/pdca", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    if (req.body.projectId && !await validateProjectAccess(req.body.projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const parsed = insertPcPdcaCycleSchema.parse({ ...req.body, tenantId });
    const cycle = await compassStorage.createPdcaCycle(parsed);
    res.status(201).json(cycle);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/pdca/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const cycle = await compassStorage.updatePdcaCycle(parseInt(req.params.id), tenantId, req.body);
    if (!cycle) return res.status(404).json({ error: "Ciclo PDCA não encontrado" });
    res.json(cycle);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/pdca/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const deleted = await compassStorage.deletePdcaCycle(parseInt(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Ciclo PDCA não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PDCA ACTIONS ==========
router.get("/pdca/:cycleId/actions", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const cycleId = parseInt(req.params.cycleId);
    const cycle = await compassStorage.getPdcaCycle(cycleId, tenantId);
    if (!cycle) return res.status(404).json({ error: "Ciclo PDCA não encontrado" });
    const actions = await compassStorage.getPdcaActions(cycleId);
    res.json(actions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/pdca/:cycleId/actions", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const cycleId = parseInt(req.params.cycleId);
    const cycle = await compassStorage.getPdcaCycle(cycleId, tenantId);
    if (!cycle) return res.status(404).json({ error: "Ciclo PDCA não encontrado" });
    const parsed = insertPcPdcaActionSchema.parse({ ...req.body, cycleId });
    const action = await compassStorage.createPdcaAction(parsed);
    res.status(201).json(action);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/pdca/actions/:id", async (req: Request, res: Response) => {
  try {
    const action = await compassStorage.updatePdcaAction(parseInt(req.params.id), req.body);
    if (!action) return res.status(404).json({ error: "Ação não encontrada" });
    res.json(action);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/pdca/actions/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deletePdcaAction(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Ação não encontrada" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== REQUIREMENTS ==========
router.get("/requirements", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    if (projectId && !await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const requirements = await compassStorage.getRequirements(tenantId, projectId);
    res.json(requirements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/requirements/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const requirement = await compassStorage.getRequirement(parseInt(req.params.id), tenantId);
    if (!requirement) return res.status(404).json({ error: "Requisito não encontrado" });
    res.json(requirement);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/requirements", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    if (req.body.projectId && !await validateProjectAccess(req.body.projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const parsed = insertPcRequirementSchema.parse({ ...req.body, tenantId });
    const requirement = await compassStorage.createRequirement(parsed);
    res.status(201).json(requirement);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/requirements/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const requirement = await compassStorage.updateRequirement(parseInt(req.params.id), tenantId, req.body);
    if (!requirement) return res.status(404).json({ error: "Requisito não encontrado" });
    res.json(requirement);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/requirements/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const deleted = await compassStorage.deleteRequirement(parseInt(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Requisito não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== DASHBOARD STATS ==========
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.json({ clients: 0, projects: 0, leads: 0, opportunities: 0 });
    
    const [clients, projects] = await Promise.all([
      crmStorage.getClients(),
      compassStorage.getProjects(tenantId)
    ]);
    
    res.json({
      clients: clients.length,
      projects: projects.length,
      leads: 0,
      opportunities: 0,
      activeProjects: projects.filter(p => p.status === 'andamento').length,
      openOpportunities: 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== INTEGRATION: DIAGNOSTICS TO WORK ITEMS ==========
router.post("/insights/to-work-item", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    
    const { type, sourceId, title, description, projectId, priority = "medium" } = req.body;
    
    if (!type || !sourceId || !title) {
      return res.status(400).json({ error: "Campos obrigatórios: type, sourceId, title" });
    }
    
    const originMap: Record<string, string> = {
      swot: "diagnostic_insight",
      canvas: "diagnostic_insight",
      process: "diagnostic_insight",
      backlog: "backlog_item",
    };
    
    const workItem = await productionStorage.createWorkItem({
      tenantId,
      projectId: projectId || null,
      title,
      description: description || "",
      type: "task",
      status: "backlog",
      priority,
      origin: originMap[type] || "direct",
      originId: sourceId,
    });
    
    res.status(201).json(workItem);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/swot-analyses/:analysisId/items/:itemIndex/to-work-item", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    
    const analysisId = parseInt(req.params.analysisId);
    const itemIndex = parseInt(req.params.itemIndex);
    const swotItems = await compassStorage.getSwotItems(analysisId);
    const swotItem = swotItems[itemIndex];
    if (!swotItem) return res.status(404).json({ error: "Item SWOT não encontrado" });
    
    const typeLabels: Record<string, string> = {
      strength: "Força",
      weakness: "Fraqueza",
      opportunity: "Oportunidade",
      threat: "Ameaça",
    };
    
    const itemTitle = swotItem.title || swotItem.description.slice(0, 80);
    const priorityValue = swotItem.priorityLevel || "medium";
    
    const workItem = await productionStorage.createWorkItem({
      tenantId,
      projectId: req.body.projectId || null,
      title: `[${typeLabels[swotItem.type] || swotItem.type}] ${itemTitle}`,
      description: swotItem.description,
      type: swotItem.type === "weakness" || swotItem.type === "threat" ? "improvement" : "story",
      status: "backlog",
      priority: priorityValue,
      origin: "diagnostic_insight",
      originId: swotItem.id,
      originType: "swot_item",
    });
    
    res.status(201).json(workItem);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/canvas-blocks/:id/to-work-item", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    
    const blockId = parseInt(req.params.id);
    const block = await compassStorage.getCanvasBlock(blockId);
    if (!block) return res.status(404).json({ error: "Bloco Canvas não encontrado" });
    
    const workItem = await productionStorage.createWorkItem({
      tenantId,
      projectId: req.body.projectId || null,
      title: `[Canvas ${block.blockType}] ${block.content?.slice(0, 80) || "Item do Canvas"}`,
      description: block.content || "",
      type: "story",
      status: "backlog",
      priority: "medium",
      origin: "diagnostic_insight",
      originId: blockId,
      originType: "canvas_block",
    });
    
    res.status(201).json(workItem);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/processes/:id/to-work-items", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    
    const processId = parseInt(req.params.id);
    const process = await compassStorage.getProcess(processId);
    if (!process) return res.status(404).json({ error: "Processo não encontrado" });
    
    const steps = await compassStorage.getProcessSteps(processId);
    const workItems = [];
    
    for (const step of steps) {
      if (step.status === "improvement_needed" || step.status === "critical") {
        const workItem = await productionStorage.createWorkItem({
          tenantId,
          projectId: req.body.projectId || null,
          title: `[Melhoria de Processo] ${step.name}`,
          description: `Processo: ${process.name}\n\nEtapa: ${step.name}\n\nDescrição: ${step.description || ""}`,
          type: "improvement",
          status: "backlog",
          priority: step.status === "critical" ? "high" : "medium",
          origin: "diagnostic_insight",
          originId: step.id,
          originType: "process_step",
        });
        workItems.push(workItem);
      }
    }
    
    res.status(201).json({ created: workItems.length, workItems });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== REPORT TEMPLATES ==========
router.get("/report-templates", async (req: Request, res: Response) => {
  try {
    const templates = await compassStorage.getReportTemplates();
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/report-templates/:id", async (req: Request, res: Response) => {
  try {
    const template = await compassStorage.getReportTemplate(parseInt(req.params.id));
    if (!template) return res.status(404).json({ error: "Template não encontrado" });
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/report-templates", async (req: Request, res: Response) => {
  try {
    const parsed = insertPcReportTemplateSchema.parse(req.body);
    const template = await compassStorage.createReportTemplate(parsed);
    res.status(201).json(template);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/report-templates/:id", async (req: Request, res: Response) => {
  try {
    const template = await compassStorage.updateReportTemplate(parseInt(req.params.id), req.body);
    if (!template) return res.status(404).json({ error: "Template não encontrado" });
    res.json(template);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/report-templates/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await compassStorage.deleteReportTemplate(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Template não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== REPORT CONFIGURATIONS ==========
router.get("/report-configurations", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    const configs = await compassStorage.getReportConfigurations(tenantId, projectId);
    res.json(configs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/report-configurations/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const config = await compassStorage.getReportConfiguration(parseInt(req.params.id), tenantId);
    if (!config) return res.status(404).json({ error: "Configuração não encontrada" });
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/report-configurations", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const userId = (req.user as any).id;
    const parsed = insertPcReportConfigurationSchema.parse({ ...req.body, tenantId, createdById: userId });
    const config = await compassStorage.createReportConfiguration(parsed);
    res.status(201).json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/report-configurations/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const config = await compassStorage.updateReportConfiguration(parseInt(req.params.id), tenantId, req.body);
    if (!config) return res.status(404).json({ error: "Configuração não encontrada" });
    res.json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/report-configurations/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const deleted = await compassStorage.deleteReportConfiguration(parseInt(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Configuração não encontrada" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== GENERATED REPORTS ==========
router.get("/generated-reports", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    const reports = await compassStorage.getGeneratedReports(tenantId, projectId);
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/generated-reports/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const report = await compassStorage.getGeneratedReport(parseInt(req.params.id), tenantId);
    if (!report) return res.status(404).json({ error: "Relatório não encontrado" });
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/generated-reports", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const userId = (req.user as any).id;
    const { sections, ...body } = req.body;
    const metadata = { ...(body.metadata || {}), sections: sections || [] };
    const parsed = insertPcGeneratedReportSchema.parse({ ...body, tenantId, generatedBy: userId, status: "pending", metadata });
    const report = await compassStorage.createGeneratedReport(parsed);
    res.status(201).json(report);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/generated-reports/:id/generate", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    
    const reportId = parseInt(req.params.id);
    const report = await compassStorage.getGeneratedReport(reportId, tenantId);
    if (!report) return res.status(404).json({ error: "Relatório não encontrado" });
    
    await compassStorage.updateGeneratedReport(reportId, tenantId, { status: "generating" });
    
    const reportData = report.projectId ? await compassStorage.getProjectReportData(report.projectId) : null;
    if (!reportData) {
      await compassStorage.updateGeneratedReport(reportId, tenantId, { status: "failed" });
      return res.status(404).json({ error: "Dados do projeto não encontrados" });
    }
    
    // Get selected sections from metadata
    const sections = (report.metadata as any)?.sections || [];
    
    // Generate HTML content based on report type and selected sections
    let htmlContent = generateReportContent(report.reportType || "executive_summary", reportData, sections);
    
    await compassStorage.updateGeneratedReport(reportId, tenantId, { 
      status: "completed",
      content: htmlContent,
      updatedAt: new Date(),
    });
    
    const updatedReport = await compassStorage.getGeneratedReport(reportId, tenantId);
    res.json(updatedReport);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save edited report content
router.patch("/generated-reports/:id/content", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    
    const reportId = parseInt(req.params.id);
    const { content, name } = req.body;
    
    const updated = await compassStorage.updateGeneratedReport(reportId, tenantId, { 
      content,
      name,
      updatedAt: new Date(),
    });
    
    if (!updated) return res.status(404).json({ error: "Relatório não encontrado" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate report content
function generateReportContent(reportType: string, data: any, sections: string[] = []): string {
  const project = data.project;
  const canvasBlocks = data.canvas || [];
  const swotAnalyses = data.swot || [];
  const processes = data.processes || [];
  const requirements = data.requirements || [];
  const pdcaCycles = data.pdca || [];
  
  // If no sections specified, include all for full_diagnostic
  const includedSections = sections.length > 0 ? sections : [
    "project_info", "canvas_atual", "canvas_sistemico", "swot", "processes", "pdca", "requirements"
  ];
  
  const shouldInclude = (section: string) => includedSections.includes(section);
  
  const blockTypeLabels: Record<string, string> = {
    key_partners: "Parceiros-Chave",
    key_activities: "Atividades-Chave",
    key_resources: "Recursos-Chave",
    value_propositions: "Proposta de Valor",
    customer_relationships: "Relacionamento com Clientes",
    channels: "Canais",
    customer_segments: "Segmentos de Clientes",
    cost_structure: "Estrutura de Custos",
    revenue_streams: "Fontes de Receita",
  };
  
  let html = `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">`;
  
  // Cover Page
  html += `
    <div style="text-align: center; margin-bottom: 40px; padding: 40px 0; border-bottom: 3px solid #3b82f6;">
      <h1 style="font-size: 28px; color: #1e293b; margin-bottom: 10px;">${project?.name || "Projeto"}</h1>
      <h2 style="font-size: 20px; color: #64748b; font-weight: normal;">${
        reportType === "executive_summary" ? "Sumário Executivo" :
        reportType === "full_diagnostic" ? "Diagnóstico Completo" :
        reportType === "swot_report" ? "Análise SWOT" : "Relatório"
      }</h2>
      <p style="color: #94a3b8; margin-top: 20px;">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  `;
  
  // Project Description
  if (shouldInclude("project_info") && project?.description) {
    html += `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Descrição do Projeto</h3>
        <p style="color: #475569; line-height: 1.6;">${project.description}</p>
      </div>
    `;
  }
  
  // Canvas Blocks (for all report types) - Show all 9 BMC blocks
  const allBlockTypes = [
    "key_partners",
    "key_activities", 
    "key_resources",
    "value_propositions",
    "customer_relationships",
    "channels",
    "customer_segments",
    "cost_structure",
    "revenue_streams",
  ];
  
  // Group canvas blocks by level (intencao = atual, sistemico)
  const canvasByLevel: Record<string, any[]> = {};
  for (const block of canvasBlocks) {
    const level = block.level || "intencao";
    if (!canvasByLevel[level]) canvasByLevel[level] = [];
    canvasByLevel[level].push(block);
  }
  
  // Canvas Atual (Intenção)
  const canvasAtual = canvasByLevel["intencao"] || [];
  if (shouldInclude("canvas_atual") && canvasAtual.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Canvas BMC - Atual (Intenção)</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px;">
    `;
    
    for (const blockType of allBlockTypes) {
      const block = canvasAtual.find((b: any) => b.blockType === blockType);
      const hasContent = block && (block.content || block.title);
      html += `
        <div style="padding: 12px; background: ${hasContent ? '#f0f9ff' : '#f8fafc'}; border-radius: 8px; border: 1px solid ${hasContent ? '#3b82f6' : '#e2e8f0'}; min-height: 80px;">
          <h5 style="color: ${hasContent ? '#1e40af' : '#64748b'}; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;">${blockTypeLabels[blockType]}</h5>
          ${block ? `
            ${block.title ? `<p style="font-weight: 600; color: #334155; margin: 0 0 5px 0; font-size: 13px;">${block.title}</p>` : ""}
            <p style="color: #475569; line-height: 1.4; margin: 0; font-size: 13px;">${block.content || '<em style="color: #94a3b8;">Não preenchido</em>'}</p>
          ` : `<p style="color: #94a3b8; font-style: italic; margin: 0; font-size: 13px;">Não preenchido</p>`}
        </div>
      `;
    }
    html += `</div></div>`;
  }
  
  // Canvas Sistêmico (if exists)
  const canvasSistemico = canvasByLevel["sistemico"] || [];
  if (shouldInclude("canvas_sistemico") && canvasSistemico.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Canvas BMC - Sistêmico</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px;">
    `;
    
    for (const blockType of allBlockTypes) {
      const block = canvasSistemico.find((b: any) => b.blockType === blockType);
      const hasContent = block && (block.content || block.title);
      html += `
        <div style="padding: 12px; background: ${hasContent ? '#fef3c7' : '#f8fafc'}; border-radius: 8px; border: 1px solid ${hasContent ? '#f59e0b' : '#e2e8f0'}; min-height: 80px;">
          <h5 style="color: ${hasContent ? '#92400e' : '#64748b'}; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;">${blockTypeLabels[blockType]}</h5>
          ${block ? `
            ${block.title ? `<p style="font-weight: 600; color: #334155; margin: 0 0 5px 0; font-size: 13px;">${block.title}</p>` : ""}
            <p style="color: #475569; line-height: 1.4; margin: 0; font-size: 13px;">${block.content || '<em style="color: #94a3b8;">Não preenchido</em>'}</p>
          ` : `<p style="color: #94a3b8; font-style: italic; margin: 0; font-size: 13px;">Não preenchido</p>`}
        </div>
      `;
    }
    html += `</div></div>`;
  }
  
  // SWOT Analysis
  if (shouldInclude("swot") && swotAnalyses.length > 0) {
    const swotTypeLabels: Record<string, { label: string; color: string }> = {
      strength: { label: "Forças", color: "#22c55e" },
      weakness: { label: "Fraquezas", color: "#ef4444" },
      opportunity: { label: "Oportunidades", color: "#3b82f6" },
      threat: { label: "Ameaças", color: "#f59e0b" },
    };
    
    html += `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Análise SWOT</h3>
    `;
    
    for (const swot of swotAnalyses) {
      html += `
        <div style="margin: 15px 0;">
          <h4 style="color: #1e293b;">${swot.name || "Análise"}</h4>
          ${swot.description ? `<p style="color: #475569; margin-bottom: 15px;">${swot.description}</p>` : ""}
      `;
      
      if (swot.items && swot.items.length > 0) {
        const groupedItems: Record<string, any[]> = {};
        for (const item of swot.items) {
          const type = item.itemType || "other";
          if (!groupedItems[type]) groupedItems[type] = [];
          groupedItems[type].push(item);
        }
        
        html += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">`;
        for (const [type, items] of Object.entries(groupedItems)) {
          const typeInfo = swotTypeLabels[type] || { label: type, color: "#64748b" };
          html += `
            <div style="padding: 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid ${typeInfo.color};">
              <h5 style="color: ${typeInfo.color}; margin: 0 0 10px 0;">${typeInfo.label}</h5>
              <ul style="margin: 0; padding-left: 20px; color: #475569;">
                ${items.map((i: any) => `<li>${i.content || i.title || ""}</li>`).join("")}
              </ul>
            </div>
          `;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  
  // Processes
  if (shouldInclude("processes") && processes.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Processos Mapeados</h3>
    `;
    
    for (const process of processes) {
      html += `
        <div style="margin: 15px 0; padding: 15px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
          <h4 style="color: #1e293b; margin: 0 0 8px 0;">${process.name}</h4>
          ${process.description ? `<p style="color: #475569; margin: 0;">${process.description}</p>` : ""}
        </div>
      `;
    }
    html += `</div>`;
  }
  
  // Requirements
  if (shouldInclude("requirements") && requirements.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Requisitos</h3>
        <ul style="color: #475569; line-height: 1.8;">
    `;
    
    for (const req of requirements) {
      html += `<li><strong>${req.title}</strong>: ${req.description || ""}</li>`;
    }
    html += `</ul></div>`;
  }
  
  // PDCA Cycles
  if (shouldInclude("pdca") && pdcaCycles.length > 0) {
    const pdcaStatusLabels: Record<string, { label: string; color: string }> = {
      plan: { label: "Planejar", color: "#3b82f6" },
      do: { label: "Executar", color: "#f59e0b" },
      check: { label: "Verificar", color: "#8b5cf6" },
      act: { label: "Agir", color: "#22c55e" },
    };
    
    html += `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Ciclos PDCA</h3>
    `;
    
    for (const cycle of pdcaCycles) {
      const statusInfo = pdcaStatusLabels[cycle.status] || { label: cycle.status, color: "#64748b" };
      html += `
        <div style="margin: 15px 0; padding: 15px; background: #fefce8; border-radius: 8px; border-left: 4px solid ${statusInfo.color};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="color: #1e293b; margin: 0;">${cycle.title}</h4>
            <span style="background: ${statusInfo.color}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">${statusInfo.label}</span>
          </div>
          ${cycle.description ? `<p style="color: #475569; margin: 0;">${cycle.description}</p>` : ""}
          ${cycle.actions && cycle.actions.length > 0 ? `
            <div style="margin-top: 10px;">
              <p style="color: #64748b; font-size: 14px; margin-bottom: 5px;">Ações:</p>
              <ul style="margin: 0; padding-left: 20px; color: #475569;">
                ${cycle.actions.map((a: any) => `<li>${a.title || a.description || ""}</li>`).join("")}
              </ul>
            </div>
          ` : ""}
        </div>
      `;
    }
    html += `</div>`;
  }
  
  // Footer
  html += `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
      <p>Relatório gerado automaticamente pelo Arcádia Suite - Process Compass</p>
    </div>
  </div>`;
  
  return html;
}

router.delete("/generated-reports/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const deleted = await compassStorage.deleteGeneratedReport(parseInt(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Relatório não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== REPORT DATA AGGREGATION ==========
router.get("/projects/:id/report-data", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.id);
    const hasAccess = await validateProjectAccess(projectId, tenantId);
    if (!hasAccess) return res.status(403).json({ error: "Acesso negado ao projeto" });
    const data = await compassStorage.getProjectReportData(projectId);
    if (!data) return res.status(404).json({ error: "Projeto não encontrado" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ERP ADHERENCE ==========
router.get("/erp-modules", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const modules = await compassStorage.getErpModules(tenantId);
    res.json(modules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/erp-modules", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const parsed = insertPcErpModuleSchema.parse({ ...req.body, tenantId });
    const module = await compassStorage.createErpModule(parsed);
    res.status(201).json(module);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/erp-modules/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const module = await compassStorage.updateErpModule(parseInt(req.params.id), tenantId, req.body);
    if (!module) return res.status(404).json({ error: "Módulo não encontrado" });
    res.json(module);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/erp-modules/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const deleted = await compassStorage.deleteErpModule(parseInt(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Módulo não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ERP Requirements
router.get("/projects/:projectId/erp-requirements", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const requirements = await compassStorage.getErpRequirements(projectId);
    res.json(requirements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/projects/:projectId/erp-adherence-stats", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const stats = await compassStorage.getErpAdherenceStats(projectId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects/:projectId/erp-requirements", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const parsed = insertPcErpRequirementSchema.parse({ ...req.body, tenantId, projectId });
    const requirement = await compassStorage.createErpRequirement(parsed);
    res.status(201).json(requirement);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/erp-requirements/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const requirement = await compassStorage.updateErpRequirement(parseInt(req.params.id), tenantId, req.body);
    if (!requirement) return res.status(404).json({ error: "Requisito não encontrado" });
    res.json(requirement);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/erp-requirements/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const deleted = await compassStorage.deleteErpRequirement(parseInt(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Requisito não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ERP Parameterization Topics
router.get("/projects/:projectId/erp-parameterization", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const topics = await compassStorage.getErpParameterizationTopics(projectId);
    const topicsWithItems = await Promise.all(
      topics.map(async (topic) => ({
        ...topic,
        items: await compassStorage.getErpParameterizationItems(topic.id),
      }))
    );
    res.json(topicsWithItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects/:projectId/erp-parameterization", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    if (!await validateProjectAccess(projectId, tenantId)) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    const parsed = insertPcErpParameterizationTopicSchema.parse({ ...req.body, tenantId, projectId });
    const topic = await compassStorage.createErpParameterizationTopic(parsed);
    res.status(201).json(topic);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/erp-parameterization-topics/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const topic = await compassStorage.updateErpParameterizationTopic(parseInt(req.params.id), tenantId, req.body);
    if (!topic) return res.status(404).json({ error: "Tópico não encontrado" });
    res.json(topic);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/erp-parameterization-topics/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const deleted = await compassStorage.deleteErpParameterizationTopic(parseInt(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Tópico não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ERP Parameterization Items
router.post("/erp-parameterization-topics/:topicId/items", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const parsed = insertPcErpParameterizationItemSchema.parse({ ...req.body, topicId: parseInt(req.params.topicId) });
    const item = await compassStorage.createErpParameterizationItem(parsed);
    res.status(201).json(item);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/erp-parameterization-items/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const item = await compassStorage.updateErpParameterizationItem(parseInt(req.params.id), tenantId, req.body);
    if (!item) return res.status(404).json({ error: "Item não encontrado" });
    res.json(item);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/erp-parameterization-items/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const deleted = await compassStorage.deleteErpParameterizationItem(parseInt(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Item não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PROJECT TEAM MEMBERS ==========
router.get("/projects/:projectId/team", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    const hasAccess = await validateProjectAccess(projectId, tenantId);
    if (!hasAccess) return res.status(403).json({ error: "Acesso negado ao projeto" });
    const members = await compassStorage.getProjectTeamMembers(projectId);
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects/:projectId/team", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    const hasAccess = await validateProjectAccess(projectId, tenantId);
    if (!hasAccess) return res.status(403).json({ error: "Acesso negado ao projeto" });
    const member = await compassStorage.addProjectTeamMember({ ...req.body, projectId });
    res.status(201).json(member);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/team/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const deleted = await compassStorage.removeProjectTeamMember(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Membro não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PROJECT TASKS ==========
router.get("/projects/:projectId/tasks", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    const hasAccess = await validateProjectAccess(projectId, tenantId);
    if (!hasAccess) return res.status(403).json({ error: "Acesso negado ao projeto" });
    const tasks = await compassStorage.getProjectTasks(projectId);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects/:projectId/tasks", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    const hasAccess = await validateProjectAccess(projectId, tenantId);
    if (!hasAccess) return res.status(403).json({ error: "Acesso negado ao projeto" });
    const task = await compassStorage.createProjectTask({ ...req.body, projectId, status: "pending" });
    res.status(201).json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const task = await compassStorage.updateProjectTask(parseInt(req.params.id), req.body);
    if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========== PROJECT FILES ==========
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads", "project-files");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const projectFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});

const projectFileUpload = multer({ storage: projectFileStorage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/projects/:projectId/files", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    const hasAccess = await validateProjectAccess(projectId, tenantId);
    if (!hasAccess) return res.status(403).json({ error: "Acesso negado ao projeto" });
    const files = await compassStorage.getProjectFiles(projectId);
    res.json(files);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects/:projectId/files", projectFileUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    const hasAccess = await validateProjectAccess(projectId, tenantId);
    if (!hasAccess) return res.status(403).json({ error: "Acesso negado ao projeto" });
    
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
    
    const file = await compassStorage.createProjectFile({
      projectId,
      name: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/project-files/${req.file.filename}`,
    });
    res.status(201).json(file);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/files/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const file = await compassStorage.getProjectFile(parseInt(req.params.id));
    if (file) {
      const filePath = path.join(uploadDir, file.name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    const deleted = await compassStorage.deleteProjectFile(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Arquivo não encontrado" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PROJECT HISTORY ==========
router.get("/projects/:projectId/history", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    const hasAccess = await validateProjectAccess(projectId, tenantId);
    if (!hasAccess) return res.status(403).json({ error: "Acesso negado ao projeto" });
    const history = await compassStorage.getProjectHistory(projectId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/projects/:projectId/history", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant não encontrado" });
    const projectId = parseInt(req.params.projectId);
    const hasAccess = await validateProjectAccess(projectId, tenantId);
    if (!hasAccess) return res.status(403).json({ error: "Acesso negado ao projeto" });
    const history = await compassStorage.saveProjectHistory({ projectId, content: req.body.content });
    res.json(history);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
