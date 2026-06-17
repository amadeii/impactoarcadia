import { Router, Request, Response, NextFunction } from "express";
import { paraStorage } from "./storage";
import { insertParaProjectSchema, insertParaAreaSchema, insertParaResourceSchema, insertParaTaskSchema } from "@shared/schema";

const router = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  next();
}

router.use(requireAuth);

// ========== DASHBOARD ==========
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const dashboard = await paraStorage.getDashboard(userId);
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PROJECTS ==========
router.get("/projects", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const status = req.query.status as string | undefined;
    const projects = await paraStorage.getProjects(userId, status);
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/projects/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const project = await paraStorage.getProject(id, userId);
    if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/projects", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const parsed = insertParaProjectSchema.parse({ ...req.body, userId });
    const project = await paraStorage.createProject(parsed);
    res.status(201).json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/projects/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const project = await paraStorage.updateProject(id, userId, req.body);
    if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
    res.json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/projects/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const deleted = await paraStorage.deleteProject(id, userId);
    if (!deleted) return res.status(404).json({ error: "Projeto não encontrado" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== AREAS ==========
router.get("/areas", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const status = req.query.status as string | undefined;
    const areas = await paraStorage.getAreas(userId, status);
    res.json(areas);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/areas/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const area = await paraStorage.getArea(id, userId);
    if (!area) return res.status(404).json({ error: "Área não encontrada" });
    res.json(area);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/areas", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const parsed = insertParaAreaSchema.parse({ ...req.body, userId });
    const area = await paraStorage.createArea(parsed);
    res.status(201).json(area);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/areas/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const area = await paraStorage.updateArea(id, userId, req.body);
    if (!area) return res.status(404).json({ error: "Área não encontrada" });
    res.json(area);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/areas/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const deleted = await paraStorage.deleteArea(id, userId);
    if (!deleted) return res.status(404).json({ error: "Área não encontrada" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== RESOURCES ==========
router.get("/resources", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const filters = {
      projectId: req.query.projectId ? parseInt(req.query.projectId as string) : undefined,
      areaId: req.query.areaId ? parseInt(req.query.areaId as string) : undefined,
      status: req.query.status as string | undefined,
    };
    const resources = await paraStorage.getResources(userId, filters);
    res.json(resources);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/resources/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const resource = await paraStorage.getResource(id, userId);
    if (!resource) return res.status(404).json({ error: "Recurso não encontrado" });
    res.json(resource);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/resources", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const parsed = insertParaResourceSchema.parse({ ...req.body, userId });
    const resource = await paraStorage.createResource(parsed);
    res.status(201).json(resource);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/resources/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const resource = await paraStorage.updateResource(id, userId, req.body);
    if (!resource) return res.status(404).json({ error: "Recurso não encontrado" });
    res.json(resource);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/resources/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const deleted = await paraStorage.deleteResource(id, userId);
    if (!deleted) return res.status(404).json({ error: "Recurso não encontrado" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== TASKS (Tríade do Tempo) ==========
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const filters = {
      projectId: req.query.projectId ? parseInt(req.query.projectId as string) : undefined,
      areaId: req.query.areaId ? parseInt(req.query.areaId as string) : undefined,
      triadCategory: req.query.triadCategory as string | undefined,
      status: req.query.status as string | undefined,
    };
    const tasks = await paraStorage.getTasks(userId, filters);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/tasks/triad-stats", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const stats = await paraStorage.getTriadStats(userId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const task = await paraStorage.getTask(id, userId);
    if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const parsed = insertParaTaskSchema.parse({ ...req.body, userId });
    const task = await paraStorage.createTask(parsed);
    res.status(201).json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const task = await paraStorage.updateTask(id, userId, req.body);
    if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/tasks/:id/complete", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const task = await paraStorage.completeTask(id, userId);
    if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const deleted = await paraStorage.deleteTask(id, userId);
    if (!deleted) return res.status(404).json({ error: "Tarefa não encontrada" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ARCHIVE ==========
router.get("/archive", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const archive = await paraStorage.getArchive(userId);
    res.json(archive);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/archive/:id/restore", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const item = await paraStorage.restoreFromArchive(id, userId);
    if (!item) return res.status(404).json({ error: "Item não encontrado" });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/archive/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const id = parseInt(req.params.id);
    const deleted = await paraStorage.deleteFromArchive(id, userId);
    if (!deleted) return res.status(404).json({ error: "Item não encontrado" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
