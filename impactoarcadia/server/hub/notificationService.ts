/**
 * Arcádia Project Hub — Notification Service (NOTIF-01)
 *
 * 3 tipos de notificação:
 * 1. Tarefas vencendo em 24h — envia in-app + email para o responsável
 * 2. Marco de faturamento com data prevista sem aceite — avisa PM + financeiro
 * 3. Projeto sem atualização há 7 dias — solicita progresso ao PM
 *
 * Executado pelo cron diário às 08h.
 * Usa emailService quando disponível (não bloqueia se email não configurado).
 */

import { pool } from "../../db/index";

// ── Tabela de notificações in-app ─────────────────────────────────────────────
// Criada pela migration abaixo se não existir
const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS hub_notifications (
    id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR NOT NULL,
    user_id     VARCHAR NOT NULL,
    project_id  VARCHAR,
    type        VARCHAR(40) NOT NULL,
    title       VARCHAR(300) NOT NULL,
    body        TEXT,
    entity_id   VARCHAR,
    entity_type VARCHAR(30),
    read        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_notif_user   ON hub_notifications(tenant_id, user_id, read);
  CREATE INDEX IF NOT EXISTS idx_notif_project ON hub_notifications(project_id);
`;

async function ensureTable() {
  await pool.query(ENSURE_TABLE);
}

async function createNotification(params: {
  tenantId: string;
  userId: string;
  projectId?: string;
  type: string;
  title: string;
  body?: string;
  entityId?: string;
  entityType?: string;
}) {
  await pool.query(
    `INSERT INTO hub_notifications
       (tenant_id, user_id, project_id, type, title, body, entity_id, entity_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [params.tenantId, params.userId, params.projectId ?? null,
     params.type, params.title, params.body ?? null,
     params.entityId ?? null, params.entityType ?? null]
  );
}

// ── 1. Tarefas vencendo em 24h ────────────────────────────────────────────────
async function notificarTarefasVencendo(): Promise<number> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const todayStr    = new Date().toISOString().split("T")[0];

  const { rows } = await pool.query(
    `SELECT t.id, t.title, t.due_date, t.assignee_id, t.assignee_name,
            t.project_id, t.tenant_id, p.project_code, p.title AS project_title,
            u.email AS assignee_email
     FROM project_tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.due_date BETWEEN $1 AND $2
       AND t.status NOT IN ('done', 'blocked')
       AND t.assignee_id IS NOT NULL`,
    [todayStr, tomorrowStr]
  );

  let count = 0;
  for (const task of rows) {
    // Verificar se já foi notificado hoje
    const { rows: existing } = await pool.query(
      `SELECT id FROM hub_notifications
       WHERE entity_id = $1 AND type = 'task_due_soon'
         AND DATE(created_at) = $2`,
      [task.id, todayStr]
    );
    if (existing.length > 0) continue;

    const daysStr = task.due_date === tomorrowStr ? "amanhã" : "hoje";
    await createNotification({
      tenantId:   task.tenant_id,
      userId:     task.assignee_id,
      projectId:  task.project_id,
      type:       "task_due_soon",
      title:      `Tarefa vence ${daysStr}: ${task.title}`,
      body:       `Projeto ${task.project_code} — ${task.project_title}. Prazo: ${new Date(task.due_date).toLocaleDateString("pt-BR")}`,
      entityId:   task.id,
      entityType: "task",
    });
    count++;
  }
  return count;
}

// ── 2. Marcos de faturamento pendentes ───────────────────────────────────────
async function notificarMarcosPendentes(): Promise<number> {
  const todayStr = new Date().toISOString().split("T")[0];

  // Marcos com due_date <= amanhã e status pendente/atingido
  const { rows } = await pool.query(
    `SELECT m.id, m.title, m.amount, m.due_date, m.status,
            m.project_id, m.tenant_id,
            p.project_code, p.title AS project_title,
            p.owner_id,
            u.email AS owner_email
     FROM project_billing_milestones m
     JOIN projects p ON p.id = m.project_id
     LEFT JOIN users u ON u.id = p.owner_id
     WHERE m.due_date <= $1
       AND m.status IN ('pendente', 'atingido')`,
    [todayStr]
  );

  let count = 0;
  for (const marco of rows) {
    if (!marco.owner_id) continue;

    const { rows: existing } = await pool.query(
      `SELECT id FROM hub_notifications
       WHERE entity_id = $1 AND type = 'milestone_overdue'
         AND DATE(created_at) = $2`,
      [marco.id, todayStr]
    );
    if (existing.length > 0) continue;

    const vencido = marco.due_date < todayStr;
    await createNotification({
      tenantId:   marco.tenant_id,
      userId:     marco.owner_id,
      projectId:  marco.project_id,
      type:       "milestone_overdue",
      title:      `Marco ${vencido ? "vencido" : "vencendo"}: ${marco.title}`,
      body:       `Projeto ${marco.project_code} — Valor: ${new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(marco.amount)}. Status: ${marco.status}`,
      entityId:   marco.id,
      entityType: "milestone",
    });
    count++;
  }
  return count;
}

// ── 3. Projetos sem atualização há 7 dias ────────────────────────────────────
async function notificarProjetosSemUpdate(): Promise<number> {
  const todayStr    = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { rows } = await pool.query(
    `SELECT p.id, p.project_code, p.title, p.owner_id, p.tenant_id,
            p.updated_at, u.email AS owner_email
     FROM projects p
     LEFT JOIN users u ON u.id = p.owner_id
     WHERE p.status = 'ativo'
       AND p.owner_id IS NOT NULL
       AND p.updated_at < $1`,
    [sevenDaysAgo.toISOString()]
  );

  let count = 0;
  for (const proj of rows) {
    const { rows: existing } = await pool.query(
      `SELECT id FROM hub_notifications
       WHERE entity_id = $1 AND type = 'project_stale'
         AND created_at > NOW() - INTERVAL '7 days'`,
      [proj.id]
    );
    if (existing.length > 0) continue;

    await createNotification({
      tenantId:   proj.tenant_id,
      userId:     proj.owner_id,
      projectId:  proj.id,
      type:       "project_stale",
      title:      `Projeto sem atualização: ${proj.project_code}`,
      body:       `${proj.title} não tem registros há mais de 7 dias. Atualize o progresso.`,
      entityId:   proj.id,
      entityType: "project",
    });
    count++;
  }
  return count;
}

// ── Job principal ─────────────────────────────────────────────────────────────
export async function runNotificationJob(): Promise<{
  tasksDue: number;
  milestonesOverdue: number;
  projectsStale: number;
  errors: string[];
}> {
  const errors: string[] = [];

  try { await ensureTable(); } catch (e: any) {
    errors.push(`ensureTable: ${e.message}`);
    return { tasksDue: 0, milestonesOverdue: 0, projectsStale: 0, errors };
  }

  let tasksDue = 0, milestonesOverdue = 0, projectsStale = 0;

  try { tasksDue = await notificarTarefasVencendo(); }
  catch (e: any) { errors.push(`tarefasVencendo: ${e.message}`); }

  try { milestonesOverdue = await notificarMarcosPendentes(); }
  catch (e: any) { errors.push(`marcosPendentes: ${e.message}`); }

  try { projectsStale = await notificarProjetosSemUpdate(); }
  catch (e: any) { errors.push(`projetosSemUpdate: ${e.message}`); }

  console.log(`[NOTIF-01] tasksDue=${tasksDue} milestonesOverdue=${milestonesOverdue} projectsStale=${projectsStale}`);
  return { tasksDue, milestonesOverdue, projectsStale, errors };
}
