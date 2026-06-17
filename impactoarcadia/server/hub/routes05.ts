/**
 * Arcádia Project Hub — Routes HUB-05
 * GET/POST   /api/hub/projects/:id/timesheets
 * PATCH      /api/hub/timesheets/:id
 * DELETE     /api/hub/timesheets/:id
 * POST       /api/hub/timesheets/approve-batch   — aprovação em lote → cost_event
 * GET        /api/hub/projects/:id/timesheets/summary
 */
import type { Express } from "express";
import { pool } from "../../db/index";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { runHub05Migration } from "./migration05";

const auth = [isAuthenticated, tenantContext, requireTenant];

const ACTIVITY_TYPES = ["campo","laboratorio","escritorio","deslocamento","reuniao","treinamento"] as const;

const tsSchema = z.object({
  wbsNodeId:    z.string().optional().nullable(),
  taskId:       z.string().optional().nullable(),
  userId:       z.string().min(1),
  userName:     z.string().optional().nullable(),
  date:         z.string(),
  hours:        z.number().positive().max(24).optional(), // opcional quando timer preenchido
  billable:     z.boolean().default(true),
  activityType: z.enum(ACTIVITY_TYPES).default("escritorio"),
  description:  z.string().optional().nullable(),
  // TIMER-01 — from_time / to_time
  startedAt:    z.string().optional().nullable(),  // ISO datetime
  endedAt:      z.string().optional().nullable(),
  // rates opcionais — se não vier, resolve de project_members → users
  costRate:     z.number().min(0).optional().nullable(),
  billingRate:  z.number().min(0).optional().nullable(),
});

/** Resolve cost_rate e billing_rate para um colaborador em um projeto */
async function resolveRates(
  userId: string, projectId: string, tenantId: string,
  overrideCost?: number | null, overrideBilling?: number | null,
): Promise<{ costRate: number; billingRate: number }> {
  // 1. Override explícito
  if (overrideCost !== null && overrideCost !== undefined &&
      overrideBilling !== null && overrideBilling !== undefined) {
    return { costRate: overrideCost, billingRate: overrideBilling };
  }
  // 2. project_members
  const { rows: member } = await pool.query(
    `SELECT cost_rate, billing_rate FROM project_members
     WHERE project_id = $1 AND user_id = $2 AND active = TRUE LIMIT 1`,
    [projectId, userId]
  );
  if (member[0]) {
    return {
      costRate: overrideCost ?? parseFloat(member[0].cost_rate ?? "0"),
      billingRate: overrideBilling ?? parseFloat(member[0].billing_rate ?? "0"),
    };
  }
  // 3. users.hourlyRate como cost_rate
  const { rows: user } = await pool.query(
    `SELECT hourly_rate FROM users WHERE id = $1 LIMIT 1`, [userId]
  );
  const cr = parseFloat(user[0]?.hourly_rate ?? "0");
  return {
    costRate: overrideCost ?? cr,
    billingRate: overrideBilling ?? cr,
  };
}

export function registerHub05Routes(app: Express) {

  app.post("/api/hub/migrate05", ...auth, async (req, res) => {
    res.json(await runHub05Migration());
  });

  // GET /api/hub/projects/:id/timesheets
  app.get("/api/hub/projects/:id/timesheets", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { userId, from, to, approved, wbsNodeId } = req.query;
    const cond = ["t.project_id = $1","t.tenant_id = $2"];
    const params: any[] = [req.params.id, tenantId];
    let i = 3;
    if (userId)    { cond.push(`t.user_id = $${i}`);      params.push(userId);    i++; }
    if (from)      { cond.push(`t.date >= $${i}`);         params.push(from);      i++; }
    if (to)        { cond.push(`t.date <= $${i}`);         params.push(to);        i++; }
    if (wbsNodeId) { cond.push(`t.wbs_node_id = $${i}`);  params.push(wbsNodeId); i++; }
    if (approved === "true")  cond.push(`t.approved_at IS NOT NULL`);
    if (approved === "false") cond.push(`t.approved_at IS NULL`);
    try {
      const { rows } = await pool.query(
        `SELECT t.*,
           w.title AS wbs_title, w.code AS wbs_code,
           tk.title AS task_title
         FROM project_timesheets t
         LEFT JOIN project_wbs_nodes w  ON w.id  = t.wbs_node_id
         LEFT JOIN project_tasks     tk ON tk.id = t.task_id
         WHERE ${cond.join(" AND ")}
         ORDER BY t.date DESC, t.created_at DESC`,
        params
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/hub/projects/:id/timesheets/summary
  app.get("/api/hub/projects/:id/timesheets/summary", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      // Por colaborador
      const { rows: byUser } = await pool.query(
        `SELECT user_id, user_name,
           SUM(hours)::numeric AS total_hours,
           SUM(CASE WHEN billable THEN hours ELSE 0 END)::numeric AS billable_hours,
           SUM(cost_amount)::numeric AS total_cost,
           SUM(billing_amount)::numeric AS total_billing,
           COUNT(*) AS entries,
           MAX(date) AS last_entry
         FROM project_timesheets
         WHERE project_id = $1 AND tenant_id = $2
         GROUP BY user_id, user_name ORDER BY total_hours DESC`,
        [req.params.id, tenantId]
      );
      // Por WBS
      const { rows: byWbs } = await pool.query(
        `SELECT t.wbs_node_id, w.title AS wbs_title, w.code AS wbs_code,
           SUM(t.hours)::numeric AS total_hours,
           SUM(t.cost_amount)::numeric AS total_cost
         FROM project_timesheets t
         LEFT JOIN project_wbs_nodes w ON w.id = t.wbs_node_id
         WHERE t.project_id = $1 AND t.tenant_id = $2
         GROUP BY t.wbs_node_id, w.title, w.code ORDER BY total_hours DESC`,
        [req.params.id, tenantId]
      );
      // Por tipo de atividade
      const { rows: byActivity } = await pool.query(
        `SELECT activity_type,
           SUM(hours)::numeric AS total_hours,
           SUM(cost_amount)::numeric AS total_cost
         FROM project_timesheets
         WHERE project_id = $1 AND tenant_id = $2
         GROUP BY activity_type ORDER BY total_hours DESC`,
        [req.params.id, tenantId]
      );
      // Totais gerais
      const { rows: [totals] } = await pool.query(
        `SELECT
           COALESCE(SUM(hours),0)::numeric          AS total_hours,
           COALESCE(SUM(CASE WHEN billable THEN hours ELSE 0 END),0)::numeric AS billable_hours,
           COALESCE(SUM(cost_amount),0)::numeric    AS total_cost,
           COALESCE(SUM(billing_amount),0)::numeric AS total_billing,
           COUNT(*) AS entries,
           SUM(CASE WHEN approved_at IS NOT NULL THEN 1 ELSE 0 END) AS approved_entries
         FROM project_timesheets
         WHERE project_id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]
      );
      res.json({ totals, byUser, byWbs, byActivity });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hub/projects/:id/timesheets
  app.post("/api/hub/projects/:id/timesheets", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    const parsed = tsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;

    // TIMER-01: calcular hours do intervalo se started_at e ended_at fornecidos
    let hours = d.hours;
    if (!hours && d.startedAt && d.endedAt) {
      const diff = (new Date(d.endedAt).getTime() - new Date(d.startedAt).getTime()) / (1000 * 3600);
      hours = Math.round(diff * 100) / 100; // 2 casas decimais
    }
    if (!hours || hours <= 0) {
      return res.status(400).json({ error: "Informe horas ou started_at + ended_at" });
    }

    try {
      const { costRate, billingRate } = await resolveRates(
        d.userId, req.params.id, tenantId, d.costRate, d.billingRate
      );
      const costAmount    = hours * costRate;
      const billingAmount = d.billable ? hours * billingRate : 0;

      const { rows } = await pool.query(`
        INSERT INTO project_timesheets
          (project_id, tenant_id, wbs_node_id, task_id, user_id, user_name,
           date, hours, billable, activity_type,
           cost_rate, billing_rate, cost_amount, billing_amount,
           description, started_at, ended_at, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING *`,
        [req.params.id, tenantId, d.wbsNodeId ?? null, d.taskId ?? null,
         d.userId, d.userName ?? null, d.date, hours, d.billable, d.activityType,
         costRate, billingRate, costAmount, billingAmount,
         d.description ?? null,
         d.startedAt ?? null, d.endedAt ?? null,
         userId]
      );

      // Atualizar actual_hours na tarefa
      if (d.taskId) {
        await pool.query(
          `UPDATE project_tasks
           SET actual_hours = (
             SELECT COALESCE(SUM(hours),0) FROM project_timesheets WHERE task_id = $1
           ), updated_at = NOW()
           WHERE id = $1`,
          [d.taskId]
        );
      }
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // TIMER-01: POST iniciar timer — cria registro com started_at=NOW, sem ended_at
  app.post("/api/hub/projects/:id/timesheets/timer/start", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    const { activityType = "escritorio", description, taskId, wbsNodeId, userName } = req.body;

    try {
      // Verificar se já tem timer ativo para este projeto/usuário
      const { rows: active } = await pool.query(
        `SELECT id FROM project_timesheets
         WHERE project_id = $1 AND tenant_id = $2
           AND (user_id = $3 OR user_name = $4)
           AND started_at IS NOT NULL AND ended_at IS NULL`,
        [req.params.id, tenantId, userId, userName ?? ""]
      );
      if (active.length > 0) {
        return res.status(409).json({
          error: "Timer já em execução",
          timerId: active[0].id,
        });
      }

      const now = new Date().toISOString();
      const today = now.split("T")[0];

      const { rows } = await pool.query(`
        INSERT INTO project_timesheets
          (project_id, tenant_id, wbs_node_id, task_id, user_id, user_name,
           date, hours, billable, activity_type, description,
           started_at, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7, 0, true, $8, $9, $10, $5)
        RETURNING *`,
        [req.params.id, tenantId, wbsNodeId ?? null, taskId ?? null,
         userId, userName ?? null, today, activityType,
         description ?? null, now]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // TIMER-01: POST parar timer — define ended_at e calcula hours
  app.post("/api/hub/timesheets/:id/timer/stop", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { description } = req.body;

    try {
      const { rows: [ts] } = await pool.query(
        `SELECT * FROM project_timesheets
         WHERE id = $1 AND tenant_id = $2 AND started_at IS NOT NULL AND ended_at IS NULL`,
        [req.params.id, tenantId]
      );
      if (!ts) return res.status(404).json({ error: "Timer não encontrado ou já parado" });

      const now   = new Date();
      const diff  = (now.getTime() - new Date(ts.started_at).getTime()) / (1000 * 3600);
      const hours = Math.max(Math.round(diff * 100) / 100, 0.01);

      const { costRate, billingRate } = await resolveRates(ts.user_id, ts.project_id, tenantId);
      const costAmount    = hours * parseFloat(ts.cost_rate    || costRate.toString());
      const billingAmount = hours * parseFloat(ts.billing_rate || billingRate.toString());

      const { rows } = await pool.query(
        `UPDATE project_timesheets
         SET ended_at = $1, hours = $2,
             cost_amount = $3, billing_amount = $4,
             description = COALESCE($5, description),
             updated_at = NOW()
         WHERE id = $6 AND tenant_id = $7 RETURNING *`,
        [now.toISOString(), hours, costAmount, billingAmount,
         description ?? null, req.params.id, tenantId]
      );

      // Atualizar actual_hours na tarefa
      if (rows[0].task_id) {
        await pool.query(
          `UPDATE project_tasks SET actual_hours = (
             SELECT COALESCE(SUM(hours),0) FROM project_timesheets WHERE task_id = $1
           ), updated_at = NOW() WHERE id = $1`,
          [rows[0].task_id]
        );
      }
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // TIMER-01: GET timer ativo do usuário no projeto
  app.get("/api/hub/projects/:id/timesheets/timer/active", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    try {
      const { rows } = await pool.query(
        `SELECT * FROM project_timesheets
         WHERE project_id = $1 AND tenant_id = $2
           AND user_id = $3 AND started_at IS NOT NULL AND ended_at IS NULL
         ORDER BY started_at DESC LIMIT 1`,
        [req.params.id, tenantId, userId]
      );
      res.json(rows[0] ?? null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/hub/timesheets/:id
  app.patch("/api/hub/timesheets/:id", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = tsSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    const map: Record<string, any> = {
      wbs_node_id: d.wbsNodeId, task_id: d.taskId, date: d.date, hours: d.hours,
      billable: d.billable, activity_type: d.activityType, description: d.description,
    };
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) { fields.push(`${col} = $${i}`); params.push(val); i++; }
    }
    // Recalcular amounts se horas mudaram
    if (d.hours !== undefined) {
      fields.push(
        `cost_amount = $${i} * cost_rate`,
        `billing_amount = CASE WHEN billable THEN $${i} * billing_rate ELSE 0 END`,
      );
      params.push(d.hours); i++;
    }
    if (!fields.length) return res.status(400).json({ error: "Nenhum campo" });
    fields.push(`updated_at = NOW()`);
    params.push(req.params.id, tenantId);
    try {
      const { rows } = await pool.query(
        `UPDATE project_timesheets SET ${fields.join(",")}
         WHERE id = $${i} AND tenant_id = $${i+1} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Registro não encontrado" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE
  app.delete("/api/hub/timesheets/:id", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `DELETE FROM project_timesheets
         WHERE id = $1 AND tenant_id = $2 AND approved_at IS NULL RETURNING task_id`,
        [req.params.id, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Não encontrado ou já aprovado" });
      if (rows[0].task_id) {
        await pool.query(
          `UPDATE project_tasks SET actual_hours = (
             SELECT COALESCE(SUM(hours),0) FROM project_timesheets WHERE task_id = $1
           ), updated_at = NOW() WHERE id = $1`,
          [rows[0].task_id]
        );
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hub/timesheets/approve-batch
  // Aprova lista de IDs → gera cost_event de mão de obra por colaborador/dia
  app.post("/api/hub/timesheets/approve-batch", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: "ids obrigatório" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const approved: string[] = [];
      for (const id of ids) {
        const { rows: [ts] } = await client.query(
          `UPDATE project_timesheets
           SET approved_by = $1, approved_at = NOW(), updated_at = NOW()
           WHERE id = $2 AND tenant_id = $3 AND approved_at IS NULL
           RETURNING *`,
          [userId, id, tenantId]
        );
        if (!ts) continue;
        approved.push(id);

        // Gerar cost_event de mão de obra
        const { rows: [evt] } = await client.query(`
          INSERT INTO project_cost_events
            (project_id, tenant_id, wbs_node_id, source_type, source_id,
             cost_category, description, amount, event_date)
          VALUES ($1,$2,$3,'timesheet',$4,'mao_obra',$5,$6,$7)
          RETURNING id`,
          [ts.project_id, tenantId, ts.wbs_node_id ?? null, ts.id,
           `Horas — ${ts.user_name ?? ts.user_id} (${ts.activity_type})`,
           ts.cost_amount, ts.date]
        );
        // Linkar cost_event de volta
        await client.query(
          `UPDATE project_timesheets SET cost_event_id = $1 WHERE id = $2`,
          [evt.id, ts.id]
        );
        // Atualizar actual_hours na tarefa
        if (ts.task_id) {
          await client.query(
            `UPDATE project_tasks SET actual_hours = (
               SELECT COALESCE(SUM(hours),0) FROM project_timesheets
               WHERE task_id = $1 AND approved_at IS NOT NULL
             ), updated_at = NOW() WHERE id = $1`,
            [ts.task_id]
          );
        }
      }
      await client.query("COMMIT");
      res.json({ ok: true, approved: approved.length, ids: approved });
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });
}
