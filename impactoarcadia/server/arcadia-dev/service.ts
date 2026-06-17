import { ManusIntelligence } from "../blackboard/BaseBlackboardAgent";
import { toolManager } from "../autonomous/tools/ToolManager";
import { db } from "../../db/index";
import { sql } from "drizzle-orm";

export interface DevStep {
  step: number;
  thought: string;
  tool?: string;
  toolInput?: Record<string, any>;
  toolResult?: string;
  finished?: boolean;
  planStep?: string;
  timestamp: string;
}

export interface DevTask {
  id: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  steps: DevStep[];
  plan?: string[];
  finalAnswer?: string;
  filesModified: string[];
  createdAt: string;
  completedAt?: string;
  userId: string;
}

// Phase 1: Extract a plan from the task before executing
const PLANNING_PROMPT = `Você é o Arcádia Dev, agente de desenvolvimento autônomo do Arcádia Suite.

Analise a tarefa e produza um plano de execução numerado. Seja direto e objetivo.

## FERRAMENTAS DISPONÍVEIS (parâmetros exatos)
- read_file { "path": "caminho/arquivo.ts", "startLine"?: number, "endLine"?: number }
- search_code { "query": "texto ou regex", "path"?: "diretório/", "filePattern"?: "*.ts", "maxResults"?: 50 }
- list_directory { "path": "diretório/", "recursive"?: false, "maxDepth"?: 3 }
- write_file { "path": "caminho/arquivo.ts", "content": "conteúdo completo" }
- run_command { "command": "npm run typecheck", "timeout"?: 30000 }

ATENÇÃO: search_code usa "query", NÃO "pattern".

## REGRAS
- SEMPRE leia o arquivo antes de modificar
- NUNCA modifique: shared/schema.ts, server/routes.ts, db/index.ts, shared/schemas/index.ts
- Novas schemas: shared/schemas/{modulo}.ts | Novas rotas: server/modules/{modulo}.ts
- Migrações: ALTER TABLE IF NOT EXISTS (NUNCA drizzle-kit push)
- NÃO adicione comentários ao código a menos que solicitado

## RESPOSTA (JSON puro, sem markdown)
{
  "thought": "Análise breve do que precisa ser feito",
  "plan": [
    "1. Descrição do primeiro passo",
    "2. Descrição do segundo passo",
    "3. ..."
  ]
}`;

// Phase 2: Execute each plan step
const EXECUTION_PROMPT = `Você é o Arcádia Dev, agente de desenvolvimento autônomo do Arcádia Suite.

## FERRAMENTAS (parâmetros exatos — use estes nomes de parâmetro)
- read_file { "path": "caminho/arquivo.ts" }
- search_code { "query": "texto ou regex", "path"?: "diretório/", "filePattern"?: "*.ts" }
  ⚠ ATENÇÃO: o parâmetro é "query", NÃO "pattern". Sempre use "query".
- list_directory { "path": "diretório/" }
- write_file { "path": "caminho/arquivo.ts", "content": "conteúdo completo do arquivo" }
- run_command { "command": "npm run typecheck" }

## REGRAS CRÍTICAS
1. Leia ANTES de modificar qualquer arquivo
2. NUNCA modifique: shared/schema.ts, server/routes.ts, db/index.ts
3. NÃO adicione comentários ao código a menos que pedido
4. Se uma ferramenta retornar erro, tente corrigir os parâmetros OU mude de abordagem
5. Quando o plano estiver 100% completo, retorne finished: true com answer conciso

## RESPOSTA JSON (puro, sem markdown)
Durante execução:
{
  "thought": "O que estou fazendo agora e por quê",
  "action": "nome_ferramenta",
  "action_input": { parâmetros corretos },
  "finished": false,
  "answer": null
}

Quando terminar TODOS os passos do plano:
{
  "thought": "Plano concluído.",
  "action": null,
  "action_input": null,
  "finished": true,
  "answer": "O que foi feito, direto ao ponto. Listar arquivos modificados se houver."
}`;

const tasks = new Map<string, DevTask>();

async function ensureTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS arcadia_dev_tasks (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        prompt TEXT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'running',
        steps JSONB NOT NULL DEFAULT '[]',
        plan JSONB,
        final_answer TEXT,
        files_modified TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMPTZ
      )
    `);
    // Add plan column if migrating from old schema
    await db.execute(sql`
      ALTER TABLE arcadia_dev_tasks ADD COLUMN IF NOT EXISTS plan JSONB
    `);
  } catch {}
}

ensureTable();

async function saveTask(task: DevTask) {
  try {
    const filesArr = task.filesModified.length > 0
      ? `{${task.filesModified.map(f => `"${f.replace(/"/g, '\\"')}"`).join(",")}}`
      : "{}";
    await db.execute(sql`
      INSERT INTO arcadia_dev_tasks (id, user_id, prompt, status, steps, plan, final_answer, files_modified, created_at, completed_at)
      VALUES (${task.id}, ${task.userId}, ${task.prompt}, ${task.status},
              ${JSON.stringify(task.steps)}::jsonb,
              ${task.plan ? JSON.stringify(task.plan) : null}::jsonb,
              ${task.finalAnswer || null},
              ${filesArr}::text[],
              ${task.createdAt},
              ${task.completedAt || null})
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        steps = EXCLUDED.steps,
        plan = EXCLUDED.plan,
        final_answer = EXCLUDED.final_answer,
        files_modified = EXCLUDED.files_modified,
        completed_at = EXCLUDED.completed_at
    `);
  } catch (e) {
    console.error("[ArcadiaDev] Erro ao salvar task:", e);
  }
}

function parseJSON(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const candidate = jsonMatch[0];
    const lastBrace = candidate.lastIndexOf("}");
    return JSON.parse(candidate.slice(0, lastBrace + 1));
  }
  return JSON.parse(cleaned);
}

function buildExecutionContext(task: DevTask, history: string): string {
  const planSection = task.plan
    ? `## PLANO DE EXECUÇÃO\n${task.plan.join("\n")}\n\n## PASSOS CONCLUÍDOS: ${task.steps.filter(s => s.tool || s.finished).length} de ${task.plan.length}\n\n`
    : "";
  return `${planSection}## HISTÓRICO\n${history}\n\nContinue executando o próximo passo do plano. Se todos os passos foram concluídos, retorne finished: true.`;
}

export async function executeDevTask(prompt: string, userId: string): Promise<DevTask> {
  const id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const task: DevTask = {
    id, prompt, userId, status: "running",
    steps: [], filesModified: [],
    createdAt: new Date().toISOString(),
  };
  tasks.set(id, task);
  await saveTask(task);

  const manus = ManusIntelligence.getInstance();
  const MAX_STEPS = 16;

  // ── Phase 1: Planning ──────────────────────────────────────────────
  try {
    const planRaw = await manus.generate(
      PLANNING_PROMPT,
      `Tarefa: ${prompt}`,
      { maxTokens: 1500, temperature: 0.1, enrichContext: false }
    );
    const planParsed = parseJSON(planRaw);
    task.plan = planParsed.plan || [];

    const planStep: DevStep = {
      step: 0,
      thought: planParsed.thought || "Plano criado.",
      planStep: "Planejamento",
      finished: false,
      timestamp: new Date().toISOString(),
    };
    task.steps.push(planStep);
    await saveTask(task);
  } catch (e: any) {
    console.error("[ArcadiaDev] Erro na fase de planejamento:", e.message);
    task.plan = [`1. ${prompt}`];
  }

  // ── Phase 2: Execution ─────────────────────────────────────────────
  let history = `Tarefa original: ${prompt}\n\nPlano:\n${(task.plan || []).join("\n")}`;
  let consecutiveNoTool = 0;
  const recentErrors: string[] = [];

  for (let stepNum = 1; stepNum <= MAX_STEPS; stepNum++) {
    const userPrompt = buildExecutionContext(task, history);

    let raw = "";
    try {
      raw = await manus.generate(EXECUTION_PROMPT, userPrompt, {
        maxTokens: 4000, temperature: 0.1, enrichContext: false,
      });
    } catch (e: any) {
      task.steps.push({
        step: stepNum, thought: `Erro ao chamar IA: ${e.message}`,
        finished: true, timestamp: new Date().toISOString(),
      });
      task.status = "failed";
      task.completedAt = new Date().toISOString();
      await saveTask(task);
      return task;
    }

    let parsed: any;
    try {
      parsed = parseJSON(raw);
    } catch {
      const hasFinished = /\bfinished["\s:]+true/i.test(raw);
      parsed = { thought: raw.slice(0, 500), finished: hasFinished, answer: raw.slice(0, 800) };
    }

    const currentPlanStep = task.plan?.[stepNum - 1] || undefined;
    const devStep: DevStep = {
      step: stepNum,
      thought: parsed.thought || "",
      tool: parsed.action || undefined,
      toolInput: parsed.action_input || undefined,
      finished: parsed.finished || false,
      planStep: currentPlanStep,
      timestamp: new Date().toISOString(),
    };

    if (parsed.action && parsed.action_input) {
      consecutiveNoTool = 0;
      try {
        const result = await toolManager.execute(parsed.action, parsed.action_input);
        let toolResultStr = result.result || "";
        if (result.data && typeof result.data === "object") {
          try {
            const dataStr = JSON.stringify(result.data, null, 2);
            toolResultStr += "\n" + (dataStr.length < 3000 ? dataStr : dataStr.slice(0, 3000) + "...(truncado)");
          } catch {}
        }
        if (!toolResultStr && result.error) toolResultStr = result.error;
        devStep.toolResult = toolResultStr.trim();

        if (parsed.action === "write_file" && parsed.action_input?.path) {
          if (!task.filesModified.includes(parsed.action_input.path)) {
            task.filesModified.push(parsed.action_input.path);
          }
        }

        // Track repeated errors to detect stuck loops
        if (toolResultStr.toLowerCase().includes("parâmetro obrigatório") ||
            toolResultStr.toLowerCase().includes("inválido") ||
            toolResultStr.toLowerCase().includes("erro")) {
          recentErrors.push(`${parsed.action}:${toolResultStr.slice(0, 80)}`);
        } else {
          recentErrors.length = 0;
        }

        const truncated = devStep.toolResult
          ? devStep.toolResult.slice(0, 600) + (devStep.toolResult.length > 600 ? "\n...(truncado)" : "")
          : "";
        history += `\n\nPasso ${stepNum} [${parsed.action}]:\n${parsed.thought}\nResultado: ${truncated}`;

        // Auto-finish if same error repeats 3+ times
        if (recentErrors.length >= 3) {
          const lastErr = recentErrors[recentErrors.length - 1];
          const sameErr = recentErrors.filter(e => e === lastErr).length;
          if (sameErr >= 3) {
            task.steps.push(devStep);
            task.status = "completed";
            task.finalAnswer = `Não foi possível completar: ferramenta '${parsed.action}' retornou erro repetidamente. Verifique os parâmetros necessários.`;
            task.completedAt = new Date().toISOString();
            await saveTask(task);
            return task;
          }
        }
      } catch (e: any) {
        devStep.toolResult = `ERRO: ${e.message}`;
        history += `\n\nPasso ${stepNum}: Erro ao executar ${parsed.action}: ${e.message}`;
      }
    } else {
      consecutiveNoTool++;
      history += `\n\nPasso ${stepNum} [pensamento]:\n${parsed.thought}`;
      // Auto-finish if model stops calling tools (task done or stuck)
      if (!parsed.finished && consecutiveNoTool >= 2) {
        parsed.finished = true;
        parsed.answer = parsed.thought;
      }
    }

    task.steps.push(devStep);
    await saveTask(task);

    if (parsed.finished) {
      task.status = "completed";
      task.finalAnswer = parsed.answer || parsed.thought;
      task.completedAt = new Date().toISOString();
      await saveTask(task);
      return task;
    }
  }

  task.status = "completed";
  task.finalAnswer = "Tarefa concluída (limite de passos atingido).";
  task.completedAt = new Date().toISOString();
  await saveTask(task);
  return task;
}

export function getTask(id: string): DevTask | undefined {
  return tasks.get(id);
}

export async function listTasks(userId: string, limit = 20): Promise<any[]> {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM arcadia_dev_tasks WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT ${limit}
    `);
    return (rows.rows || rows) as any[];
  } catch {
    return [];
  }
}
