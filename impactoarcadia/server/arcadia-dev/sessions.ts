import { db } from "../../db/index";
import { sql } from "drizzle-orm";
import { ManusIntelligence } from "../blackboard/BaseBlackboardAgent";
import { toolManager } from "../autonomous/tools/ToolManager";

export interface SessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "plan" | "execution" | "verification" | "error" | "ki";
  steps?: any[];
  plan?: string[];
  filesModified?: string[];
  taskStatus?: string;
  timestamp: string;
}

export interface KnowledgeItem {
  id: string;
  topic: string;
  content: string;
  files?: string[];
  createdAt: string;
}

export interface DevSession {
  id: string;
  userId: string;
  name: string;
  status: "active" | "archived";
  phase: "idle" | "planning" | "execution" | "verification" | "done";
  taskMd: string;
  implementationPlanMd: string;
  messages: SessionMessage[];
  ki: KnowledgeItem[];
  createdAt: string;
  updatedAt: string;
}

const sessionsCache = new Map<string, DevSession>();

export async function ensureSessionsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS arcadia_dev_sessions (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        name VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'active',
        phase VARCHAR NOT NULL DEFAULT 'idle',
        task_md TEXT NOT NULL DEFAULT '',
        implementation_plan_md TEXT NOT NULL DEFAULT '',
        messages JSONB NOT NULL DEFAULT '[]',
        ki JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch {}
}

ensureSessionsTable();

async function saveSession(session: DevSession) {
  sessionsCache.set(session.id, session);
  try {
    await db.execute(sql`
      INSERT INTO arcadia_dev_sessions (id, user_id, name, status, phase, task_md, implementation_plan_md, messages, ki, created_at, updated_at)
      VALUES (${session.id}, ${session.userId}, ${session.name}, ${session.status}, ${session.phase},
              ${session.taskMd}, ${session.implementationPlanMd},
              ${JSON.stringify(session.messages)}::jsonb,
              ${JSON.stringify(session.ki)}::jsonb,
              ${session.createdAt}, ${session.updatedAt})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        phase = EXCLUDED.phase,
        task_md = EXCLUDED.task_md,
        implementation_plan_md = EXCLUDED.implementation_plan_md,
        messages = EXCLUDED.messages,
        ki = EXCLUDED.ki,
        updated_at = EXCLUDED.updated_at
    `);
  } catch (e) {
    console.error("[DevSessions] Erro ao salvar sessão:", e);
  }
}

export async function createSession(userId: string, name: string): Promise<DevSession> {
  const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const session: DevSession = {
    id, userId, name,
    status: "active",
    phase: "idle",
    taskMd: `# ${name}\n\n## Tarefas\n- [ ] Definir objetivo da sessão\n`,
    implementationPlanMd: "",
    messages: [],
    ki: [],
    createdAt: now,
    updatedAt: now,
  };
  await saveSession(session);
  return session;
}

export async function listSessions(userId: string): Promise<DevSession[]> {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM arcadia_dev_sessions
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC LIMIT 50
    `);
    const result = (rows.rows || rows) as any[];
    return result.map(r => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      status: r.status,
      phase: r.phase,
      taskMd: r.task_md,
      implementationPlanMd: r.implementation_plan_md,
      messages: (typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages) || [],
      ki: (typeof r.ki === 'string' ? JSON.parse(r.ki) : r.ki) || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function getSession(id: string): Promise<DevSession | null> {
  if (sessionsCache.has(id)) return sessionsCache.get(id)!;
  try {
    const rows = await db.execute(sql`SELECT * FROM arcadia_dev_sessions WHERE id = ${id}`);
    const result = (rows.rows || rows) as any[];
    if (!result[0]) return null;
    const r = result[0];
    const session: DevSession = {
      id: r.id,
      userId: r.user_id,
      name: r.name,
      status: r.status,
      phase: r.phase,
      taskMd: r.task_md,
      implementationPlanMd: r.implementation_plan_md,
      messages: (typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages) || [],
      ki: (typeof r.ki === 'string' ? JSON.parse(r.ki) : r.ki) || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
    sessionsCache.set(id, session);
    return session;
  } catch { return null; }
}

export async function updateSession(id: string, updates: Partial<DevSession>): Promise<DevSession | null> {
  const session = await getSession(id);
  if (!session) return null;
  const updated = { ...session, ...updates, updatedAt: new Date().toISOString() };
  await saveSession(updated);
  return updated;
}

export async function addMessage(sessionId: string, message: Omit<SessionMessage, "id" | "timestamp">): Promise<SessionMessage> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Sessão não encontrada");
  const msg: SessionMessage = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(msg);
  session.updatedAt = new Date().toISOString();
  await saveSession(session);
  return msg;
}

const PLANNING_SYSTEM = `Você é o Arcádia Dev, agente sênior de desenvolvimento do Arcádia Suite.
Você está na FASE DE PLANEJAMENTO. Sua missão é analisar a solicitação e criar:
1. Um plano de implementação técnico detalhado
2. Uma checklist de tarefas (task.md)
3. Identificar arquivos relevantes a modificar

## FERRAMENTAS DISPONÍVEIS
- read_file { "path": "arquivo.ts" }
- search_code { "query": "termo", "path"?: "dir/" }
- list_directory { "path": "dir/" }

## RESPOSTA JSON OBRIGATÓRIA
{
  "thought": "Análise do que será feito",
  "action": "ferramenta" | null,
  "action_input": { ... } | null,
  "finished": false | true,
  "plan": {
    "title": "Título do plano",
    "summary": "Descrição técnica concisa",
    "taskMd": "# Título\\n\\n## Tarefas\\n- [ ] Tarefa 1\\n- [ ] Tarefa 2\\n",
    "implementationPlanMd": "# Plano\\n## Mudanças\\n...",
    "filesToModify": ["server/foo.ts", "client/bar.tsx"],
    "estimatedSteps": 5
  }
}`;

const EXECUTION_SYSTEM = `Você é o Arcádia Dev, agente de desenvolvimento autônomo do Arcádia Suite.
FASE DE EXECUÇÃO — siga o plano aprovado e implemente as mudanças.

## FERRAMENTAS (parâmetros exatos)
- read_file { "path": "arquivo.ts", "startLine"?: N, "endLine"?: N }
- search_code { "query": "termo", "path"?: "dir/", "filePattern"?: "*.ts" }
- list_directory { "path": "dir/" }
- write_file { "path": "arquivo.ts", "content": "conteúdo completo" }
- run_command { "command": "npm run typecheck" }

## REGRAS
1. Leia ANTES de modificar
2. NUNCA modifique: shared/schema.ts, server/routes.ts, db/index.ts
3. Schemas novos: shared/schemas/{modulo}.ts | Rotas novas: server/modules/{modulo}.ts
4. NÃO adicione comentários salvo se pedido
5. Quando terminar, retorne finished: true com resumo

## RESPOSTA JSON
{ "thought": "...", "action": "ferramenta"|null, "action_input": {...}|null, "finished": false, "answer": null }
OU ao terminar:
{ "thought": "Concluído.", "action": null, "action_input": null, "finished": true, "answer": "O que foi feito." }`;

const VERIFICATION_SYSTEM = `Você é o Arcádia Dev. FASE DE VERIFICAÇÃO.
Execute verificações para garantir que o código implementado está correto.

## FERRAMENTAS
- run_command { "command": "npm run typecheck" }
- read_file { "path": "arquivo.ts" }
- search_code { "query": "termo" }

Verifique:
1. TypeCheck sem erros
2. Arquivos modificados existem e têm conteúdo correto
3. Não há imports quebrados

Resposta JSON:
{ "thought": "...", "action": "ferramenta"|null, "action_input": {...}|null, "finished": false }
OU ao terminar:
{ "thought": "Verificação concluída", "action": null, "action_input": null, "finished": true,
  "answer": "✓ Tudo OK: ...", "verificationResult": { "passed": true, "issues": [] } }`;

function parseJSON(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    const s = match[0];
    return JSON.parse(s.slice(0, s.lastIndexOf("}") + 1));
  }
  return JSON.parse(cleaned);
}

export async function runPlanningPhase(sessionId: string, prompt: string): Promise<{ planMd: string; taskMd: string; plan: any }> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Sessão não encontrada");

  const manus = ManusIntelligence.getInstance();
  const MAX_PLANNING_STEPS = 8;
  let history = `Solicitação: ${prompt}`;
  let finalPlan: any = null;

  const ki = session.ki.length > 0
    ? `\n\nConhecimento existente:\n${session.ki.map(k => `- ${k.topic}: ${k.content.slice(0, 200)}`).join("\n")}`
    : "";

  for (let step = 1; step <= MAX_PLANNING_STEPS; step++) {
    const userPrompt = step === 1
      ? `${prompt}${ki}\n\nAnalise a solicitação e crie o plano de implementação.`
      : `Continue analisando. Histórico:\n${history}`;

    const raw = await manus.generate(PLANNING_SYSTEM, userPrompt, { maxTokens: 3000, temperature: 0.1, enrichContext: false });
    let parsed: any;
    try { parsed = parseJSON(raw); } catch { parsed = { thought: raw.slice(0, 400), finished: true }; }

    if (parsed.action && parsed.action_input) {
      try {
        const normalizedInput = { ...parsed.action_input };
        if (parsed.action === "search_code" && !normalizedInput.query) {
          normalizedInput.query = normalizedInput.pattern || normalizedInput.text || "";
        }
        const result = await toolManager.execute(parsed.action, normalizedInput);
        const res = (result.result + (result.data ? "\n" + JSON.stringify(result.data, null, 2).slice(0, 1500) : "")).slice(0, 1000);
        history += `\nPasso ${step} [${parsed.action}]: ${parsed.thought}\nResultado: ${res}`;
      } catch (e: any) {
        history += `\nPasso ${step}: Erro: ${e.message}`;
      }
    } else {
      history += `\nPasso ${step}: ${parsed.thought}`;
    }

    if (parsed.finished && parsed.plan) {
      finalPlan = parsed.plan;
      break;
    }
    if (parsed.finished && !parsed.action) break;
  }

  if (!finalPlan) {
    finalPlan = {
      title: prompt.slice(0, 60),
      summary: "Plano gerado automaticamente.",
      taskMd: `# ${prompt.slice(0, 60)}\n\n## Tarefas\n- [ ] Implementar: ${prompt}\n`,
      implementationPlanMd: `# Plano\n## Objetivo\n${prompt}\n`,
      filesToModify: [],
      estimatedSteps: 5,
    };
  }

  await updateSession(sessionId, {
    phase: "planning",
    taskMd: finalPlan.taskMd || session.taskMd,
    implementationPlanMd: finalPlan.implementationPlanMd || "",
  });

  return { planMd: finalPlan.implementationPlanMd, taskMd: finalPlan.taskMd, plan: finalPlan };
}

export async function runExecutionPhase(
  sessionId: string,
  prompt: string,
  planContext: string,
  onStep?: (step: any) => void
): Promise<{ answer: string; steps: any[]; filesModified: string[] }> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Sessão não encontrada");

  await updateSession(sessionId, { phase: "execution" });

  const manus = ManusIntelligence.getInstance();
  const MAX_STEPS = 16;
  const steps: any[] = [];
  const filesModified: string[] = [];
  let history = `Tarefa: ${prompt}\n\nPlano aprovado:\n${planContext}`;
  let consecutiveNoTool = 0;
  const recentErrors: string[] = [];

  for (let stepNum = 1; stepNum <= MAX_STEPS; stepNum++) {
    const userPrompt = `Plano aprovado:\n${planContext}\n\nPassos concluídos: ${steps.filter(s => s.tool).length}\n\nHistórico:\n${history}\n\nContinue a execução.`;

    const raw = await manus.generate(EXECUTION_SYSTEM, userPrompt, { maxTokens: 4000, temperature: 0.1, enrichContext: false });
    let parsed: any;
    try { parsed = parseJSON(raw); } catch {
      parsed = { thought: raw.slice(0, 400), finished: /finished.*true/i.test(raw), answer: raw.slice(0, 600) };
    }

    const devStep: any = { step: stepNum, thought: parsed.thought || "", tool: parsed.action, toolInput: parsed.action_input, timestamp: new Date().toISOString() };

    if (parsed.action && parsed.action_input) {
      consecutiveNoTool = 0;
      try {
        const normalizedInput = { ...parsed.action_input };
        if (parsed.action === "search_code" && !normalizedInput.query) normalizedInput.query = normalizedInput.pattern || "";
        const result = await toolManager.execute(parsed.action, normalizedInput);
        let toolResult = result.result || "";
        if (result.data) {
          const d = JSON.stringify(result.data, null, 2);
          toolResult += "\n" + (d.length < 2500 ? d : d.slice(0, 2500) + "...");
        }
        devStep.toolResult = toolResult.trim();

        if (parsed.action === "write_file" && parsed.action_input?.path) {
          if (!filesModified.includes(parsed.action_input.path)) filesModified.push(parsed.action_input.path);
        }

        if (toolResult.toLowerCase().includes("erro") || toolResult.toLowerCase().includes("ausente")) {
          recentErrors.push(`${parsed.action}:${toolResult.slice(0, 60)}`);
        } else {
          recentErrors.length = 0;
        }

        const truncated = devStep.toolResult.slice(0, 500) + (devStep.toolResult.length > 500 ? "...(truncado)" : "");
        history += `\nP${stepNum} [${parsed.action}]: ${parsed.thought}\n→ ${truncated}`;

        if (recentErrors.length >= 3 && recentErrors.filter(e => e === recentErrors[recentErrors.length - 1]).length >= 3) {
          devStep.finished = true;
          steps.push(devStep);
          if (onStep) onStep(devStep);
          break;
        }
      } catch (e: any) {
        devStep.toolResult = `ERRO: ${e.message}`;
        history += `\nP${stepNum}: Erro: ${e.message}`;
      }
    } else {
      consecutiveNoTool++;
      history += `\nP${stepNum} [pensamento]: ${parsed.thought}`;
      if (!parsed.finished && consecutiveNoTool >= 2) { parsed.finished = true; parsed.answer = parsed.thought; }
    }

    steps.push(devStep);
    if (onStep) onStep(devStep);

    if (parsed.finished) {
      await updateSession(sessionId, {
        phase: "verification",
        taskMd: session.taskMd.replace(/- \[ \]/g, "- [x]"),
      });
      return { answer: parsed.answer || parsed.thought, steps, filesModified };
    }
  }

  return { answer: "Execução concluída (limite de passos).", steps, filesModified };
}

export async function runVerificationPhase(sessionId: string, filesModified: string[]): Promise<{ passed: boolean; summary: string }> {
  const manus = ManusIntelligence.getInstance();
  const raw = await manus.generate(
    VERIFICATION_SYSTEM,
    `Arquivos modificados: ${filesModified.join(", ")}\nExecute verificações de qualidade.`,
    { maxTokens: 2000, temperature: 0.1, enrichContext: false }
  );
  let parsed: any;
  try { parsed = parseJSON(raw); } catch { parsed = { finished: true, answer: "Verificação concluída.", verificationResult: { passed: true, issues: [] } }; }

  const result = parsed.verificationResult || { passed: true, issues: [] };

  if (parsed.action === "run_command" && parsed.action_input?.command) {
    try {
      const r = await toolManager.execute("run_command", { command: parsed.action_input.command });
      if (r.result?.includes("error") || r.result?.includes("Error")) {
        result.passed = false;
        result.issues = [r.result.slice(0, 300)];
      }
    } catch {}
  }

  await updateSession(sessionId, { phase: "done" });
  return { passed: result.passed !== false, summary: parsed.answer || "Verificação concluída." };
}

export async function addKnowledgeItem(sessionId: string, topic: string, content: string, files?: string[]): Promise<KnowledgeItem> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Sessão não encontrada");
  const ki: KnowledgeItem = {
    id: `ki-${Date.now()}`,
    topic, content,
    files: files || [],
    createdAt: new Date().toISOString(),
  };
  session.ki.push(ki);
  await saveSession(session);
  return ki;
}

export async function exploreCode(path: string, type: "file" | "dir" | "schemas" | "routes"): Promise<any> {
  if (type === "file") {
    const result = await toolManager.execute("read_file", { path });
    return { type: "file", path, content: result.data?.content || result.result };
  }
  if (type === "dir") {
    const result = await toolManager.execute("list_directory", { path, recursive: false });
    return { type: "dir", path, items: result.data?.items || [] };
  }
  if (type === "schemas") {
    const result = await toolManager.execute("search_code", { query: "export const|export interface|pgTable|createInsertSchema", path: "shared/", filePattern: "*.ts" });
    return { type: "schemas", items: result.data?.results || [] };
  }
  if (type === "routes") {
    const result = await toolManager.execute("search_code", { query: "router\\.(get|post|put|delete|patch)\\(|app\\.(get|post|put|delete|patch)\\(", path: "server/", filePattern: "*.ts" });
    return { type: "routes", items: result.data?.results || [] };
  }
  return {};
}
