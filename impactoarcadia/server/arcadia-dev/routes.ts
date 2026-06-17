import { Router, type Request, type Response } from "express";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { executeDevTask, getTask, listTasks } from "./service";
import {
  createSession, listSessions, getSession, updateSession,
  addMessage, runPlanningPhase, runExecutionPhase, runVerificationPhase,
  addKnowledgeItem, exploreCode,
} from "./sessions";

const router = Router();

// ── Legacy execute (DevCenter mode) ────────────────────────────────
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5)
      return res.status(400).json({ error: "Prompt inválido (mínimo 5 caracteres)" });
    const userId = (req.user as any)?.id || "system";
    const task = await executeDevTask(prompt.trim(), userId);
    res.json({ success: true, task });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/tasks", async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id || "system";
  res.json({ success: true, tasks: await listTasks(userId) });
});

router.get("/tasks/:id", async (req: Request, res: Response) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task não encontrada" });
  res.json({ success: true, task });
});

// ── Sessions ───────────────────────────────────────────────────────
router.get("/sessions", async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id || "system";
  res.json({ success: true, sessions: await listSessions(userId) });
});

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Nome obrigatório" });
    const userId = (req.user as any)?.id || "system";
    const session = await createSession(userId, name.trim());
    res.json({ success: true, session });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/sessions/:id", async (req: Request, res: Response) => {
  const session = await getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Sessão não encontrada" });
  res.json({ success: true, session });
});

router.patch("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const { name, status, taskMd, implementationPlanMd } = req.body;
    const session = await updateSession(req.params.id, { name, status, taskMd, implementationPlanMd });
    if (!session) return res.status(404).json({ error: "Sessão não encontrada" });
    res.json({ success: true, session });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Session workflow: PLAN → EXECUTE → VERIFY ─────────────────────
router.post("/sessions/:id/plan", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt obrigatório" });
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Sessão não encontrada" });

    await addMessage(req.params.id, { role: "user", content: prompt, type: "text" });
    const result = await runPlanningPhase(req.params.id, prompt);

    const assistantMsg = await addMessage(req.params.id, {
      role: "assistant",
      content: result.planMd,
      type: "plan",
    });

    res.json({ success: true, message: assistantMsg, plan: result.plan, taskMd: result.taskMd, planMd: result.planMd });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/sessions/:id/execute", async (req: Request, res: Response) => {
  try {
    const { prompt, planContext } = req.body;
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Sessão não encontrada" });

    const steps: any[] = [];
    const result = await runExecutionPhase(
      req.params.id,
      prompt || session.implementationPlanMd,
      planContext || session.implementationPlanMd,
      (step) => steps.push(step)
    );

    const assistantMsg = await addMessage(req.params.id, {
      role: "assistant",
      content: result.answer,
      type: "execution",
      steps: result.steps,
      filesModified: result.filesModified,
    });

    res.json({ success: true, message: assistantMsg, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/sessions/:id/verify", async (req: Request, res: Response) => {
  try {
    const { filesModified } = req.body;
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Sessão não encontrada" });

    const result = await runVerificationPhase(req.params.id, filesModified || []);

    const assistantMsg = await addMessage(req.params.id, {
      role: "assistant",
      content: result.summary,
      type: "verification",
    });

    res.json({ success: true, message: assistantMsg, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/sessions/:id/chat", async (req: Request, res: Response) => {
  try {
    const { content, role } = req.body;
    const msg = await addMessage(req.params.id, { role: role || "user", content, type: "text" });
    res.json({ success: true, message: msg });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Knowledge Items ────────────────────────────────────────────────
router.post("/sessions/:id/ki", async (req: Request, res: Response) => {
  try {
    const { topic, content, files } = req.body;
    const ki = await addKnowledgeItem(req.params.id, topic, content, files);
    res.json({ success: true, ki });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Pages / Routes Scanner ─────────────────────────────────────────
const APP_ROUTES: Array<{ path: string; component: string; category: string }> = [
  { path: "/", component: "Cockpit", category: "Core" },
  { path: "/agent", component: "Agent", category: "Core" },
  { path: "/chat", component: "Chat", category: "Core" },
  { path: "/admin", component: "Admin", category: "Core" },
  { path: "/apps", component: "AppCenter", category: "Core" },
  { path: "/engine-room", component: "EngineRoom", category: "Core" },
  { path: "/dev-center", component: "DevCenter", category: "Dev" },
  { path: "/arcadia-dev", component: "ArcadiaDevStudio", category: "Dev" },
  { path: "/xos", component: "XosCentral", category: "XOS" },
  { path: "/xos/crm", component: "XosCrm", category: "XOS" },
  { path: "/xos/inbox", component: "XosInbox", category: "XOS" },
  { path: "/xos/tickets", component: "XosTickets", category: "XOS" },
  { path: "/xos/campaigns", component: "XosCampaigns", category: "XOS" },
  { path: "/xos/automations", component: "XosAutomations", category: "XOS" },
  { path: "/xos/sites", component: "XosSites", category: "XOS" },
  { path: "/xos/governance", component: "XosGovernance", category: "XOS" },
  { path: "/xos/pipeline", component: "XosPipeline", category: "XOS" },
  { path: "/soe", component: "SOE", category: "Negócio" },
  { path: "/control", component: "Control", category: "Negócio" },
  { path: "/crm", component: "Crm", category: "Negócio" },
  { path: "/fisco", component: "Fisco", category: "Negócio" },
  { path: "/contabil", component: "Contabil", category: "Negócio" },
  { path: "/retail", component: "ArcadiaRetail", category: "Negócio" },
  { path: "/production", component: "Production", category: "Negócio" },
  { path: "/support", component: "Support", category: "Negócio" },
  { path: "/insights", component: "BiWorkspace", category: "Negócio" },
  { path: "/compass", component: "ProcessCompass", category: "Negócio" },
  { path: "/hr/colaboradores", component: "HrEmployees", category: "RH" },
  { path: "/hr/folha", component: "HrPayroll", category: "RH" },
  { path: "/hr/ponto", component: "HrTimesheet", category: "RH" },
  { path: "/hr/cargos-departamentos", component: "HrPosDept", category: "RH" },
  { path: "/hr/relatorios", component: "HrReports", category: "RH" },
  { path: "/pessoas", component: "Pessoas", category: "RH" },
  { path: "/whatsapp", component: "WhatsApp", category: "Comunicação" },
  { path: "/comunicacao", component: "XosInbox", category: "Comunicação" },
  { path: "/knowledge", component: "Knowledge", category: "IA" },
  { path: "/scientist", component: "Scientist", category: "IA" },
  { path: "/automations", component: "Automations", category: "IA" },
  { path: "/canvas", component: "Canvas", category: "Ferramentas" },
  { path: "/ide", component: "IDE", category: "Ferramentas" },
  { path: "/prompt-engine", component: "PromptEngine", category: "Ferramentas" },
  { path: "/central-apis", component: "CentralApis", category: "Ferramentas" },
  { path: "/api-hub", component: "ApiHub", category: "Ferramentas" },
  { path: "/api-tester", component: "ApiTesterPage", category: "Ferramentas" },
  { path: "/plus", component: "Plus", category: "Ferramentas" },
  { path: "/marketplace", component: "Marketplace", category: "Ferramentas" },
  { path: "/lms", component: "LMS", category: "Ferramentas" },
  { path: "/communities", component: "Communities", category: "Ferramentas" },
  { path: "/engineering", component: "EngineeringHub", category: "Ferramentas" },
  { path: "/valuation", component: "Valuation", category: "Ferramentas" },
  { path: "/quality", component: "QualityModule", category: "Ferramentas" },
  { path: "/doctype-builder", component: "DocTypeBuilder", category: "Ferramentas" },
  { path: "/page-builder", component: "PageBuilder", category: "Ferramentas" },
];

router.get("/pages", async (_req: Request, res: Response) => {
  res.json({ success: true, pages: APP_ROUTES });
});

router.post("/sessions/:id/adjust-page", async (req: Request, res: Response) => {
  try {
    const { pagePath, component, instruction } = req.body;
    if (!instruction) return res.status(400).json({ error: "Instrução obrigatória" });

    const prompt = `AJUSTE DE TELA: Página "${pagePath}" (componente: ${component})\n\nInstrução do usuário: ${instruction}\n\nAnalise o componente "${component}" e implemente o ajuste solicitado, preservando a funcionalidade existente.`;

    await addMessage(req.params.id, { role: "user", content: `[Ajuste de tela: ${pagePath}] ${instruction}`, type: "text" });

    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Sessão não encontrada" });

    const planResult = await runPlanningPhase(req.params.id, prompt);
    const assistantMsg = await addMessage(req.params.id, {
      role: "assistant",
      content: planResult.planMd,
      type: "plan",
    });

    res.json({ success: true, message: assistantMsg, plan: planResult.plan, taskMd: planResult.taskMd });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Console & Network Logs ─────────────────────────────────────────
function getLatestLogFile(prefix: string): string | null {
  try {
    const files = readdirSync("/tmp/logs")
      .filter(f => f.startsWith(prefix) && f.endsWith(".log"))
      .sort().reverse();
    return files[0] ? join("/tmp/logs", files[0]) : null;
  } catch { return null; }
}

router.get("/console-logs", async (_req: Request, res: Response) => {
  try {
    const file = getLatestLogFile("browser_console_");
    if (!file) return res.json({ success: true, logs: [] });
    const raw = readFileSync(file, "utf-8");
    const lines = raw.split("\n").filter(l => l.trim());
    const logs: any[] = [];
    let currentMethod = "log";
    for (const line of lines) {
      if (line.startsWith("Method -")) {
        currentMethod = line.replace("Method -", "").trim().replace(":", "");
      } else if (/^\d{13}/.test(line)) {
        const match = line.match(/^(\d+\.\d+)\s+-\s+(.+)$/);
        if (match) {
          const ts = parseFloat(match[1]);
          let content = match[2];
          try { content = JSON.parse(content); } catch {}
          logs.push({ ts, level: currentMethod, content: Array.isArray(content) ? content : [content] });
        }
      }
    }
    res.json({ success: true, logs: logs.slice(-100) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/server-logs", async (req: Request, res: Response) => {
  try {
    const file = getLatestLogFile("Start_application_");
    if (!file) return res.json({ success: true, logs: [] });
    const raw = readFileSync(file, "utf-8");
    const filter = (req.query.filter as string) || "";
    const lines = raw.split("\n")
      .filter(l => l.trim() && !l.includes("ECONNREFUSED") && !l.includes("indexing interaction"))
      .filter(l => !filter || l.toLowerCase().includes(filter.toLowerCase()))
      .slice(-200);
    const logs = lines.map(l => {
      const isError = /error|Error|ERROR/.test(l);
      const isWarn = /warn|WARN/.test(l);
      return { content: l, level: isError ? "error" : isWarn ? "warn" : "info" };
    });
    res.json({ success: true, logs });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/network-requests", async (_req: Request, res: Response) => {
  try {
    const file = getLatestLogFile("Start_application_");
    if (!file) return res.json({ success: true, requests: [] });
    const raw = readFileSync(file, "utf-8");
    const apiPattern = /\[express\]\s+(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s]*)\s+(\d{3})\s+in\s+(\d+)ms/g;
    const requests: any[] = [];
    let m: RegExpExecArray | null;
    while ((m = apiPattern.exec(raw)) !== null) {
      const status = parseInt(m[3]);
      requests.push({
        method: m[1],
        path: m[2],
        status,
        duration: parseInt(m[4]),
        level: status >= 500 ? "error" : status >= 400 ? "warn" : "ok",
      });
    }
    res.json({ success: true, requests: requests.slice(-100) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Code Explorer ──────────────────────────────────────────────────
router.get("/explore", async (req: Request, res: Response) => {
  try {
    const { path, type } = req.query as { path: string; type: string };
    const result = await exploreCode(path || ".", (type as any) || "dir");
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/explore/schemas", async (req: Request, res: Response) => {
  try {
    const result = await exploreCode("schemas", "schemas");
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/explore/routes", async (req: Request, res: Response) => {
  try {
    const result = await exploreCode("routes", "routes");
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
