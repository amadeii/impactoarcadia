/**
 * Arcádia Project Hub — Routes HUB-02
 * WBS: GET/POST/PATCH/DELETE /api/hub/projects/:id/wbs
 * Tasks: GET/POST/PATCH/DELETE /api/hub/projects/:id/tasks
 * Tasks batch: PATCH /api/hub/tasks/:id/status
 */

import type { Express } from "express";
import { pool } from "../../db/index";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { runHub02Migration } from "./migration02";

const auth = [isAuthenticated, tenantContext, requireTenant];

// ── Schemas ──────────────────────────────────────────────────────────────────
const wbsNodeSchema = z.object({
  parentId:       z.string().optional().nullable(),
  nodeType:       z.enum(["fase", "pacote", "entregavel", "tarefa", "marco"]).default("tarefa"),
  title:          z.string().min(1),
  code:           z.string().optional().nullable(),
  weight:         z.number().optional().nullable(),
  progressMethod: z.enum(["manual", "tarefas", "percentual", "peso"]).default("manual"),
  plannedStart:   z.string().optional().nullable(),
  plannedEnd:     z.string().optional().nullable(),
  budgetAmount:   z.number().optional().nullable(),
  assigneeId:     z.string().optional().nullable(),
  assigneeName:   z.string().optional().nullable(),
  status:         z.enum(["pendente","em_andamento","concluido","bloqueado","cancelado"]).optional(),
  orderIndex:     z.number().optional(),
  description:    z.string().optional().nullable(),
  metadata:       z.record(z.any()).optional(),
});

const taskSchema = z.object({
  wbsNodeId:      z.string().optional().nullable(),
  title:          z.string().min(1),
  description:    z.string().optional().nullable(),
  status:         z.enum(["backlog","todo","doing","review","done","blocked"]).default("backlog"),
  priority:       z.enum(["baixa","media","alta","critica"]).default("media"),
  assigneeId:     z.string().optional().nullable(),
  assigneeName:   z.string().optional().nullable(),
  estimatedHours: z.number().optional().nullable(),
  billable:       z.boolean().optional(),
  costRate:       z.number().optional().nullable(),
  billingRate:    z.number().optional().nullable(),
  dueDate:        z.string().optional().nullable(),
  tags:           z.array(z.string()).optional(),
  checklist:      z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })).optional(),
  orderIndex:     z.number().optional(),
});

const taskPatchSchema = taskSchema.partial();

// ── Função auxiliar: recalcular progresso do nó pai ──────────────────────────
async function recalcularProgressoNoPai(projectId: string, nodeId: string) {
  // Busca filhos diretos do nó
  const { rows: filhos } = await pool.query(
    `SELECT progress_pct, weight FROM project_wbs_nodes
     WHERE parent_id = $1 AND status != 'cancelado'`,
    [nodeId]
  );
  if (!filhos.length) return;

  const totalPeso = filhos.reduce((s: number, f: any) => s + parseFloat(f.weight ?? "1"), 0);
  const progressoPonderado = filhos.reduce((s: number, f: any) => {
    return s + (f.progress_pct * parseFloat(f.weight ?? "1"));
  }, 0);
  const novoProgresso = totalPeso > 0 ? Math.round(progressoPonderado / totalPeso) : 0;

  await pool.query(
    `UPDATE project_wbs_nodes SET progress_pct = $1, updated_at = NOW() WHERE id = $2`,
    [novoProgresso, nodeId]
  );

  // Buscar pai do pai e recalcular recursivamente
  const { rows: node } = await pool.query(
    `SELECT parent_id FROM project_wbs_nodes WHERE id = $1`, [nodeId]
  );
  if (node[0]?.parent_id) {
    await recalcularProgressoNoPai(projectId, node[0].parent_id);
  }

  // Atualizar progresso raiz no projeto
  const { rows: raizes } = await pool.query(
    `SELECT progress_pct, weight FROM project_wbs_nodes
     WHERE project_id = $1 AND parent_id IS NULL AND status != 'cancelado'`,
    [projectId]
  );
  if (raizes.length) {
    const tp = raizes.reduce((s: number, r: any) => s + parseFloat(r.weight ?? "1"), 0);
    const pp = raizes.reduce((s: number, r: any) => s + r.progress_pct * parseFloat(r.weight ?? "1"), 0);
    const prog = tp > 0 ? Math.round(pp / tp) : 0;
    await pool.query(
      `UPDATE projects SET progress_pct = $1, updated_at = NOW() WHERE id = $2`,
      [prog, projectId]
    );
  }
}

// ── Registro de rotas ─────────────────────────────────────────────────────────
export function registerHub02Routes(app: Express) {

  // ── Migration HUB-02 ───────────────────────────────────────────────────────
  app.post("/api/hub/migrate02", ...auth, async (req, res) => {
    const result = await runHub02Migration();
    res.json(result);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WBS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/hub/projects/:id/wbs — árvore completa
  app.get("/api/hub/projects/:id/wbs", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT n.*,
           (SELECT COUNT(*) FROM project_tasks t
            WHERE t.wbs_node_id = n.id AND t.status != 'done') AS open_tasks,
           (SELECT COUNT(*) FROM project_tasks t
            WHERE t.wbs_node_id = n.id) AS total_tasks
         FROM project_wbs_nodes n
         WHERE n.project_id = $1 AND n.tenant_id = $2
         ORDER BY n.order_index, n.code, n.created_at`,
        [req.params.id, tenantId]
      );
      // Montar árvore
      const map: Record<string, any> = {};
      rows.forEach(r => { map[r.id] = { ...r, children: [] }; });
      const tree: any[] = [];
      rows.forEach(r => {
        if (r.parent_id && map[r.parent_id]) {
          map[r.parent_id].children.push(map[r.id]);
        } else {
          tree.push(map[r.id]);
        }
      });
      res.json({ tree, flat: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hub/projects/:id/wbs
  app.post("/api/hub/projects/:id/wbs", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = wbsNodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    try {
      const { rows } = await pool.query(`
        INSERT INTO project_wbs_nodes (
          project_id, tenant_id, parent_id, node_type, title, code,
          weight, progress_method, planned_start, planned_end,
          budget_amount, assignee_id, assignee_name, status, order_index, description, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *`,
        [
          req.params.id, tenantId, d.parentId ?? null, d.nodeType, d.title, d.code ?? null,
          d.weight ?? 1, d.progressMethod, d.plannedStart ?? null, d.plannedEnd ?? null,
          d.budgetAmount ?? null, d.assigneeId ?? null, d.assigneeName ?? null,
          d.status ?? "pendente", d.orderIndex ?? 0, d.description ?? null,
          JSON.stringify(d.metadata ?? {}),
        ]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/hub/wbs/:nodeId
  app.patch("/api/hub/wbs/:nodeId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = wbsNodeSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    const map: Record<string, any> = {
      node_type: d.nodeType, title: d.title, code: d.code,
      weight: d.weight, progress_method: d.progressMethod,
      planned_start: d.plannedStart, planned_end: d.plannedEnd,
      actual_start: (d as any).actualStart, actual_end: (d as any).actualEnd,
      budget_amount: d.budgetAmount, assignee_id: d.assigneeId,
      assignee_name: d.assigneeName, status: d.status,
      order_index: d.orderIndex, description: d.description,
    };
    // progress_pct manual
    if ((req.body as any).progressPct !== undefined) {
      map.progress_pct = (req.body as any).progressPct;
    }
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) { fields.push(`${col} = $${i}`); params.push(val); i++; }
    }
    if (!fields.length) return res.status(400).json({ error: "Nenhum campo" });
    fields.push(`updated_at = NOW()`);
    params.push(req.params.nodeId, tenantId);
    try {
      const { rows } = await pool.query(
        `UPDATE project_wbs_nodes SET ${fields.join(", ")}
         WHERE id = $${i} AND tenant_id = $${i+1} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Nó não encontrado" });
      // Recalcular pai se progresso mudou
      if (rows[0].parent_id && (req.body as any).progressPct !== undefined) {
        await recalcularProgressoNoPai(rows[0].project_id, rows[0].parent_id);
      }
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/hub/wbs/:nodeId
  app.delete("/api/hub/wbs/:nodeId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      await pool.query(
        `DELETE FROM project_wbs_nodes WHERE id = $1 AND tenant_id = $2`,
        [req.params.nodeId, tenantId]
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TASKS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/hub/projects/:id/tasks
  app.get("/api/hub/projects/:id/tasks", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { status, assigneeId, wbsNodeId, priority, overdue } = req.query;
    const conditions = ["t.project_id = $1", "t.tenant_id = $2"];
    const params: any[] = [req.params.id, tenantId];
    let i = 3;
    if (status)    { conditions.push(`t.status = $${i}`);      params.push(status);    i++; }
    if (assigneeId){ conditions.push(`t.assignee_id = $${i}`); params.push(assigneeId);i++; }
    if (wbsNodeId) { conditions.push(`t.wbs_node_id = $${i}`); params.push(wbsNodeId); i++; }
    if (priority)  { conditions.push(`t.priority = $${i}`);    params.push(priority);  i++; }
    // overdue=true → tarefas com due_date no passado e não concluídas
    if (overdue === "true") {
      conditions.push(`t.due_date < CURRENT_DATE`);
      conditions.push(`t.status NOT IN ('done','blocked')`);
    }
    if (priority) { conditions.push(`t.priority = $${i}`); params.push(priority); i++; }
    try {
      const { rows } = await pool.query(
        `SELECT t.*,
           w.title AS wbs_title, w.code AS wbs_code,
           CASE
             WHEN t.due_date < CURRENT_DATE AND t.status NOT IN ('done','blocked')
             THEN CURRENT_DATE - t.due_date
             ELSE 0
           END AS days_overdue,
           (SELECT COUNT(*) FROM project_task_dependencies d
            JOIN project_tasks dep ON dep.id = d.depends_on_id
            WHERE d.task_id = t.id AND dep.status != 'done'
           )::int AS open_dependencies
         FROM project_tasks t
         LEFT JOIN project_wbs_nodes w ON w.id = t.wbs_node_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY
           CASE WHEN t.due_date < CURRENT_DATE AND t.status NOT IN ('done','blocked')
             THEN 0 ELSE 1 END,
           t.due_date ASC NULLS LAST,
           t.order_index, t.created_at`,
        params
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hub/projects/:id/tasks
  app.post("/api/hub/projects/:id/tasks", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId = (req as any).user?.id as string;
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    try {
      const { rows } = await pool.query(`
        INSERT INTO project_tasks (
          project_id, wbs_node_id, tenant_id, title, description,
          status, priority, assignee_id, assignee_name,
          estimated_hours, billable, cost_rate, billing_rate,
          due_date, tags, checklist, order_index, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING *`,
        [
          req.params.id, d.wbsNodeId ?? null, tenantId, d.title, d.description ?? null,
          d.status, d.priority, d.assigneeId ?? null, d.assigneeName ?? null,
          d.estimatedHours ?? null, d.billable ?? true, d.costRate ?? null, d.billingRate ?? null,
          d.dueDate ?? null,
          JSON.stringify(d.tags ?? []), JSON.stringify(d.checklist ?? []),
          d.orderIndex ?? 0, userId,
        ]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/hub/tasks/:taskId
  app.patch("/api/hub/tasks/:taskId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = taskPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    const map: Record<string, any> = {
      wbs_node_id: d.wbsNodeId, title: d.title, description: d.description,
      status: d.status, priority: d.priority,
      assignee_id: d.assigneeId, assignee_name: d.assigneeName,
      estimated_hours: d.estimatedHours, billable: d.billable,
      cost_rate: d.costRate, billing_rate: d.billingRate,
      due_date: d.dueDate, order_index: d.orderIndex,
    };
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) { fields.push(`${col} = $${i}`); params.push(val); i++; }
    }
    if (d.tags !== undefined) {
      fields.push(`tags = $${i}`); params.push(JSON.stringify(d.tags)); i++;
    }
    if (d.checklist !== undefined) {
      fields.push(`checklist = $${i}`); params.push(JSON.stringify(d.checklist)); i++;
    }
    // completedAt automático
    if (d.status === "done") {
      // DEP-01: validar dependências abertas
      const { rows: deps } = await pool.query(
        `SELECT d.depends_on_id, t.title, t.status
         FROM project_task_dependencies d
         JOIN project_tasks t ON t.id = d.depends_on_id
         WHERE d.task_id = $1 AND t.status != 'done'`,
        [req.params.taskId]
      );
      if (deps.length > 0) {
        return res.status(409).json({
          error: "Tarefa tem dependências não concluídas",
          blockedBy: deps.map((d: any) => ({ id: d.depends_on_id, title: d.title, status: d.status })),
        });
      }
      fields.push(`completed_at = NOW()`);
    } else if (d.status && d.status !== "done") {
      fields.push(`completed_at = NULL`);
    }
    if (!fields.length) return res.status(400).json({ error: "Nenhum campo" });
    fields.push(`updated_at = NOW()`);
    params.push(req.params.taskId, tenantId);
    try {
      const { rows } = await pool.query(
        `UPDATE project_tasks SET ${fields.join(", ")}
         WHERE id = $${i} AND tenant_id = $${i+1} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Tarefa não encontrada" });
      // Recalcular progresso do WBS se status mudou
      if (d.status && rows[0].wbs_node_id) {
        const { rows: tarefas } = await pool.query(
          `SELECT status FROM project_tasks WHERE wbs_node_id = $1 AND status != 'done' IS NOT NULL`,
          [rows[0].wbs_node_id]
        );
        const { rows: total } = await pool.query(
          `SELECT COUNT(*) FROM project_tasks WHERE wbs_node_id = $1`, [rows[0].wbs_node_id]
        );
        const { rows: done } = await pool.query(
          `SELECT COUNT(*) FROM project_tasks WHERE wbs_node_id = $1 AND status = 'done'`,
          [rows[0].wbs_node_id]
        );
        const totalN = parseInt(total[0].count);
        const doneN = parseInt(done[0].count);
        const pct = totalN > 0 ? Math.round((doneN / totalN) * 100) : 0;
        await pool.query(
          `UPDATE project_wbs_nodes SET progress_pct = $1, updated_at = NOW() WHERE id = $2`,
          [pct, rows[0].wbs_node_id]
        );
        // Propagar para cima
        const { rows: node } = await pool.query(
          `SELECT parent_id, project_id FROM project_wbs_nodes WHERE id = $1`,
          [rows[0].wbs_node_id]
        );
        if (node[0]?.parent_id) {
          await recalcularProgressoNoPai(node[0].project_id, node[0].parent_id);
        }
      }
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/hub/tasks/:taskId
  app.delete("/api/hub/tasks/:taskId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      await pool.query(
        `DELETE FROM project_tasks WHERE id = $1 AND tenant_id = $2`,
        [req.params.taskId, tenantId]
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Batch status update (Kanban drag-and-drop)
  app.patch("/api/hub/projects/:id/tasks/batch-status", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { updates } = req.body as { updates: { id: string; status: string; orderIndex?: number }[] };
    if (!Array.isArray(updates)) return res.status(400).json({ error: "updates deve ser array" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const u of updates) {
        await client.query(
          `UPDATE project_tasks SET status = $1, order_index = COALESCE($2, order_index), updated_at = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [u.status, u.orderIndex ?? null, u.id, tenantId]
        );
      }
      await client.query("COMMIT");
      res.json({ ok: true, updated: updates.length });
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // Comments
  app.get("/api/hub/tasks/:taskId/comments", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT * FROM project_task_comments
         WHERE task_id = $1 AND tenant_id = $2 ORDER BY created_at`,
        [req.params.taskId, tenantId]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/hub/tasks/:taskId/comments", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId = (req as any).user?.id as string;
    const { content, authorName } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "content obrigatório" });
    try {
      const { rows } = await pool.query(`
        INSERT INTO project_task_comments (task_id, tenant_id, author_id, author_name, content)
        VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.params.taskId, tenantId, userId, authorName ?? null, content]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Templates de WBS por project_type
  app.get("/api/hub/wbs-templates/:projectType", ...auth, async (req, res) => {
    const templates: Record<string, any[]> = {
      geologia: [
        { title: "1. Mobilização", nodeType: "fase", code: "1", children: [
          { title: "1.1 Levantamento topográfico", nodeType: "entregavel", code: "1.1" },
          { title: "1.2 Logística de campo", nodeType: "entregavel", code: "1.2" },
        ]},
        { title: "2. Execução de Campo", nodeType: "fase", code: "2", children: [
          { title: "2.1 Perfuração / sondagem", nodeType: "entregavel", code: "2.1" },
          { title: "2.2 Instalação de instrumentos", nodeType: "entregavel", code: "2.2" },
          { title: "2.3 Coleta de amostras", nodeType: "entregavel", code: "2.3" },
        ]},
        { title: "3. Análises Laboratoriais", nodeType: "fase", code: "3", children: [
          { title: "3.1 Análises físico-químicas", nodeType: "entregavel", code: "3.1" },
          { title: "3.2 Análises granulométricas", nodeType: "entregavel", code: "3.2" },
        ]},
        { title: "4. Relatórios", nodeType: "fase", code: "4", children: [
          { title: "4.1 Relatório parcial", nodeType: "entregavel", code: "4.1" },
          { title: "4.2 Relatório final", nodeType: "marco", code: "4.2" },
        ]},
      ],
      ambiental: [
        { title: "1. Diagnóstico Ambiental", nodeType: "fase", code: "1", children: [
          { title: "1.1 Levantamento de passivos", nodeType: "entregavel", code: "1.1" },
          { title: "1.2 Inventário de emissões", nodeType: "entregavel", code: "1.2" },
        ]},
        { title: "2. Monitoramento", nodeType: "fase", code: "2", children: [
          { title: "2.1 Campanha de amostragem", nodeType: "entregavel", code: "2.1" },
          { title: "2.2 Análise laboratorial", nodeType: "entregavel", code: "2.2" },
        ]},
        { title: "3. Licenciamento", nodeType: "fase", code: "3", children: [
          { title: "3.1 Documentação técnica", nodeType: "entregavel", code: "3.1" },
          { title: "3.2 Protocolo de licença", nodeType: "marco", code: "3.2" },
        ]},
      ],
      consultoria: [
        { title: "1. Diagnóstico", nodeType: "fase", code: "1", children: [
          { title: "1.1 Levantamento de dados", nodeType: "entregavel", code: "1.1" },
          { title: "1.2 Entrevistas e workshops", nodeType: "entregavel", code: "1.2" },
          { title: "1.3 Relatório diagnóstico", nodeType: "marco", code: "1.3" },
        ]},
        { title: "2. Implementação", nodeType: "fase", code: "2", children: [
          { title: "2.1 Plano de ação", nodeType: "entregavel", code: "2.1" },
          { title: "2.2 Execução das iniciativas", nodeType: "entregavel", code: "2.2" },
        ]},
        { title: "3. Encerramento", nodeType: "fase", code: "3", children: [
          { title: "3.1 Relatório final", nodeType: "entregavel", code: "3.1" },
          { title: "3.2 Apresentação executiva", nodeType: "marco", code: "3.2" },
        ]},
      ],
    };
    const template = templates[req.params.projectType] ?? templates.consultoria;
    res.json(template);
  });
}
