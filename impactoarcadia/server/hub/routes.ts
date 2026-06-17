/**
 * Arcádia Project Hub — Routes HUB-01
 * /api/hub/projects  — CRUD completo
 * /api/hub/projects/:id/members — membros
 * /api/hub/migrate   — executa migration (admin)
 *
 * Padrão do codebase: pool.query() + isAuthenticated + tenantContext
 */

import type { Express } from "express";
import { pool } from "../../db/index";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { runHubMigration } from "./migration";
import { runMigrationHubImp01, FASES_PROJETO } from "./migration_imp01";
import { runHub02Migration } from "./migration02";
import { runHub03Migration } from "./migration03";
import { runHub04Migration } from "./migration04";
import { runHub05Migration } from "./migration05";
import { runHub06Migration } from "./migration06";
import { registerHub02Routes } from "./routes02";
import { registerHub03Routes } from "./routes03";
import { registerHub04Routes } from "./routes04";
import { registerHub05Routes } from "./routes05";
import { registerHub06Routes } from "./routes06";
import { registerHub07Routes } from "./routes07";
import { registerHub08Routes } from "./routes08";
import { registerHub09Routes } from "./routes09";
import { runProjPriority } from "./migration_proj01";
import { runDep01Migration } from "./migration_dep01";
import { runTimer01Migration } from "./migration_timer01";
import { runNotificationJob } from "./notificationService";
import { registerReport01Routes } from "./routes_report01";

const auth = [isAuthenticated, tenantContext, requireTenant];

// ── Schemas de validação ─────────────────────────────────────────────────────
const createProjectSchema = z.object({
  title: z.string().min(1),
  projectType: z.enum(["geologia", "ambiental", "civil", "consultoria", "industrial"]).default("consultoria"),
  clienteId: z.string().optional().nullable(),
  clienteNome: z.string().optional().nullable(),
  clienteExternoNome: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  proposalId: z.number().optional().nullable(),
  costCenterId: z.string().optional().nullable(),
  municipioIbge: z.string().max(7).optional().nullable(),
  taxProfileId: z.number().optional().nullable(),
  contractValue: z.number().optional().nullable(),
  recognitionMethod: z.enum(["percentual", "marco", "horas", "conclusao"]).default("percentual"),
  plannedStart: z.string().optional().nullable(),
  plannedEnd: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

const patchProjectSchema = createProjectSchema.partial().extend({
  status:      z.enum(["rascunho", "ativo", "pausado", "concluido", "cancelado"]).optional(),
  etapa:       z.enum(["planejamento", "em_execucao", "monitoramento", "encerramento", "concluido"]).optional(),
  progressPct: z.number().min(0).max(100).optional(),
  healthScore: z.enum(["verde", "amarelo", "vermelho"]).optional(),
  priority:    z.enum(["baixa", "media", "alta", "critica"]).optional(),
  actualStart: z.string().optional().nullable(),
  actualEnd:   z.string().optional().nullable(),
});

const memberSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().optional().nullable(),
  role: z.enum(["pm", "tecnico", "financeiro", "cliente", "observador"]).default("tecnico"),
  billingRate: z.number().optional().nullable(),
  costRate: z.number().optional().nullable(),
});

// ── Gerador de código de projeto ─────────────────────────────────────────────
async function gerarProjectCode(tenantId: string, projectType: string): Promise<string> {
  const prefixos: Record<string, string> = {
    geologia:    "GEO",
    ambiental:   "AMB",
    civil:       "CIV",
    consultoria: "CON",
    industrial:  "IND",
  };
  const prefix = prefixos[projectType] ?? "PRJ";
  const year = new Date().getFullYear();

  const { rows } = await pool.query(
    `SELECT COUNT(*) as cnt FROM projects
     WHERE tenant_id = $1
       AND project_code LIKE $2`,
    [tenantId, `${prefix}-${year}-%`]
  );
  const seq = String(parseInt(rows[0].cnt) + 1).padStart(3, "0");
  return `${prefix}-${year}-${seq}`;
}

// ── Registro de rotas ────────────────────────────────────────────────────────
export function registerHubRoutes(app: Express) {

  // ── Migration ──────────────────────────────────────────────────────────────
  app.post("/api/hub/migrate", ...auth, async (req, res) => {
    const result = await runHubMigration();
    res.json(result);
  });

  // ── GET /api/hub/projects — lista com filtros ──────────────────────────────
  app.get("/api/hub/projects", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { q, status, projectType, ownerId, clienteId, limit = "50", offset = "0" } = req.query;

    try {
      const conditions: string[] = ["p.tenant_id = $1"];
      const params: any[] = [tenantId];
      let i = 2;

      if (q) {
        conditions.push(`(p.title ILIKE $${i} OR p.project_code ILIKE $${i} OR p.cliente_nome ILIKE $${i})`);
        params.push(`%${q}%`); i++;
      }
      if (status) { conditions.push(`p.status = $${i}`); params.push(status); i++; }
      if (projectType) { conditions.push(`p.project_type = $${i}`); params.push(projectType); i++; }
      if (ownerId) { conditions.push(`p.owner_id = $${i}`); params.push(ownerId); i++; }
      if (clienteId) { conditions.push(`p.cliente_id = $${i}`); params.push(clienteId); i++; }

      const where = conditions.join(" AND ");
      params.push(parseInt(limit as string), parseInt(offset as string));

      const { rows } = await pool.query(`
        SELECT
          p.*,
          (SELECT COUNT(*) FROM project_members pm
           WHERE pm.project_id = p.id AND pm.active = TRUE) AS member_count
        FROM projects p
        WHERE ${where}
        ORDER BY p.created_at DESC
        LIMIT $${i} OFFSET $${i + 1}
      `, params);

      const { rows: total } = await pool.query(
        `SELECT COUNT(*) FROM projects p WHERE ${where}`,
        params.slice(0, -2)
      );

      res.json({ data: rows, total: parseInt(total[0].count) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/hub/projects/:id — detalhe ───────────────────────────────────
  app.get("/api/hub/projects/:id", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT p.*,
           (SELECT json_agg(m ORDER BY m.role)
            FROM project_members m WHERE m.project_id = p.id AND m.active = TRUE
           ) AS members
         FROM projects p
         WHERE p.id = $1 AND p.tenant_id = $2`,
        [req.params.id, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Projeto não encontrado" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/hub/projects — criar ────────────────────────────────────────
  app.post("/api/hub/projects", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId = (req as any).user?.id as string;

    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const d = parsed.data;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const projectCode = await gerarProjectCode(tenantId, d.projectType);

      const { rows } = await client.query(`
        INSERT INTO projects (
          tenant_id, project_code, title, project_type,
          cliente_id, cliente_nome, cliente_externo_nome,
          owner_id, proposal_id, cost_center_id,
          municipio_ibge, tax_profile_id, contract_value, recognition_method,
          planned_start, planned_end, description, location, metadata,
          created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        ) RETURNING *`,
        [
          tenantId, projectCode, d.title, d.projectType,
          d.clienteId ?? null, d.clienteNome ?? null, d.clienteExternoNome ?? null,
          d.ownerId ?? userId, d.proposalId ?? null, d.costCenterId ?? null,
          d.municipioIbge ?? null, d.taxProfileId ?? null,
          d.contractValue ?? null, d.recognitionMethod,
          d.plannedStart ?? null, d.plannedEnd ?? null,
          d.description ?? null, d.location ?? null,
          JSON.stringify(d.metadata ?? {}), userId,
        ]
      );

      // Adicionar PM como membro automaticamente
      if (d.ownerId || userId) {
        await client.query(`
          INSERT INTO project_members (project_id, tenant_id, user_id, role)
          VALUES ($1, $2, $3, 'pm')
          ON CONFLICT (project_id, user_id) DO NOTHING`,
          [rows[0].id, tenantId, d.ownerId ?? userId]
        );
      }

      await client.query("COMMIT");
      res.status(201).json(rows[0]);
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ── PATCH /api/hub/projects/:id — atualizar ───────────────────────────────
  app.patch("/api/hub/projects/:id", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;

    const parsed = patchProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const d = parsed.data;
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;

    const map: Record<string, any> = {
      title: d.title, project_type: d.projectType, status: d.status, etapa: d.etapa,
      cliente_id: d.clienteId, cliente_nome: d.clienteNome, cliente_externo_nome: d.clienteExternoNome,
      owner_id: d.ownerId, proposal_id: d.proposalId, cost_center_id: d.costCenterId,
      municipio_ibge: d.municipioIbge, tax_profile_id: d.taxProfileId,
      contract_value: d.contractValue, recognition_method: d.recognitionMethod,
      planned_start: d.plannedStart, planned_end: d.plannedEnd,
      actual_start: d.actualStart, actual_end: d.actualEnd,
      progress_pct: d.progressPct, health_score: d.healthScore,
      priority: d.priority,
      description: d.description, location: d.location,
    };

    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) { fields.push(`${col} = $${i}`); params.push(val); i++; }
    }
    if (d.metadata !== undefined) {
      fields.push(`metadata = $${i}`); params.push(JSON.stringify(d.metadata)); i++;
    }
    if (!fields.length) return res.status(400).json({ error: "Nenhum campo para atualizar" });

    fields.push(`updated_at = NOW()`);
    params.push(req.params.id, tenantId);

    try {
      const { rows } = await pool.query(
        `UPDATE projects SET ${fields.join(", ")}
         WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Projeto não encontrado" });
      const updated = rows[0];

      // ENG-SYNC-01 — propaga status/etapa de volta para engineering_projects
      if (updated.id && (d.status !== undefined || d.etapa !== undefined)) {
        const ENG_ETAPA_MAP: Record<string, string> = {
          planejamento:   "pre_projeto",
          em_execucao:    "execucao",
          monitoramento:  "execucao",
          encerramento:   "concluido",
          concluido:      "concluido",
        };
        const engSets: string[] = ["updated_at = NOW()"];
        const engParams: any[] = [updated.id];
        if (d.status !== undefined) { engParams.push(d.status); engSets.push(`status = $${engParams.length}`); }
        if (d.etapa !== undefined) {
          const engEtapa = ENG_ETAPA_MAP[d.etapa] ?? d.etapa;
          engParams.push(engEtapa); engSets.push(`etapa = $${engParams.length}`);
        }
        await pool.query(
          `UPDATE engineering_projects SET ${engSets.join(", ")}
           WHERE hub_project_id = $1`,
          engParams
        ).catch((e: any) =>
          console.warn("[ENG-SYNC-01] sync Hub→engineering_projects falhou:", e.message)
        );
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE /api/hub/projects/:id ──────────────────────────────────────────
  app.delete("/api/hub/projects/:id", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM projects WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]
      );
      if (!rowCount) return res.status(404).json({ error: "Projeto não encontrado" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── MEMBERS ───────────────────────────────────────────────────────────────

  // GET /api/hub/projects/:id/members
  app.get("/api/hub/projects/:id/members", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT * FROM project_members
         WHERE project_id = $1 AND tenant_id = $2 AND active = TRUE
         ORDER BY role, joined_at`,
        [req.params.id, tenantId]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hub/projects/:id/members
  app.post("/api/hub/projects/:id/members", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = memberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    try {
      const { rows } = await pool.query(`
        INSERT INTO project_members (project_id, tenant_id, user_id, user_name, role, billing_rate, cost_rate)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (project_id, user_id)
        DO UPDATE SET role = EXCLUDED.role, user_name = EXCLUDED.user_name,
          billing_rate = EXCLUDED.billing_rate, cost_rate = EXCLUDED.cost_rate, active = TRUE
        RETURNING *`,
        [req.params.id, tenantId, d.userId, d.userName ?? null, d.role, d.billingRate ?? null, d.costRate ?? null]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/hub/projects/:id/members/:userId
  app.delete("/api/hub/projects/:id/members/:userId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      await pool.query(
        `UPDATE project_members SET active = FALSE
         WHERE project_id = $1 AND user_id = $2 AND tenant_id = $3`,
        [req.params.id, req.params.userId, tenantId]
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Redirect legacy routes ─────────────────────────────────────────────────
  // Mantém compatibilidade — o frontend vai migrando gradualmente
  app.get("/api/engineering/projects-legacy", ...auth, async (req, res) => {
    res.json({ message: "Migrado para /api/hub/projects", redirect: "/api/hub/projects" });
  });

  registerHub02Routes(app);
  registerHub03Routes(app);
  registerHub04Routes(app);
  registerHub05Routes(app);
  registerHub06Routes(app);
  registerHub07Routes(app);
  registerHub08Routes(app);
  registerHub09Routes(app);
  registerReport01Routes(app);

  // PROJ-01 — priority no projeto
  app.post("/api/hub/migrate-priority", ...auth, async (req, res) => {
    res.json(await runProjPriority());
  });

  // DEP-01 — dependências entre tarefas
  app.post("/api/hub/migrate-dep01", ...auth, async (req, res) => {
    res.json(await runDep01Migration());
  });

  // GET dependências de uma tarefa
  app.get("/api/hub/tasks/:taskId/dependencies", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT d.depends_on_id, t.title, t.status, t.priority, t.due_date
         FROM project_task_dependencies d
         JOIN project_tasks t ON t.id = d.depends_on_id
         WHERE d.task_id = $1 AND d.tenant_id = $2`,
        [req.params.taskId, tenantId]
      );
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST adicionar dependência
  app.post("/api/hub/tasks/:taskId/dependencies", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { dependsOnId } = req.body;
    if (!dependsOnId) return res.status(400).json({ error: "dependsOnId obrigatório" });
    if (dependsOnId === req.params.taskId)
      return res.status(400).json({ error: "Tarefa não pode depender de si mesma" });
    try {
      await pool.query(
        `INSERT INTO project_task_dependencies (task_id, depends_on_id, tenant_id)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [req.params.taskId, dependsOnId, tenantId]
      );
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // DELETE remover dependência
  app.delete("/api/hub/tasks/:taskId/dependencies/:dependsOnId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      await pool.query(
        `DELETE FROM project_task_dependencies
         WHERE task_id = $1 AND depends_on_id = $2 AND tenant_id = $3`,
        [req.params.taskId, req.params.dependsOnId, tenantId]
      );
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // TIMER-01 — migration
  app.post("/api/hub/migrate-timer01", ...auth, async (req, res) => {
    res.json(await runTimer01Migration());
  });

  // NOTIF-01 — endpoints de notificações in-app
  // GET /api/hub/notifications — lista não lidas do usuário
  app.get("/api/hub/notifications", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    const { unread, limit = "30" } = req.query;
    try {
      // Garantir tabela existe
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hub_notifications (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR NOT NULL, user_id VARCHAR NOT NULL,
          project_id VARCHAR, type VARCHAR(40) NOT NULL,
          title VARCHAR(300) NOT NULL, body TEXT,
          entity_id VARCHAR, entity_type VARCHAR(30),
          read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_notif_user ON hub_notifications(tenant_id, user_id, read);
      `);

      const cond = ["n.tenant_id = $1", "n.user_id = $2"];
      const params: any[] = [tenantId, userId];
      if (unread === "true") cond.push("n.read = FALSE");
      params.push(parseInt(limit as string));

      const { rows } = await pool.query(
        `SELECT n.*, p.project_code, p.title AS project_title
         FROM hub_notifications n
         LEFT JOIN projects p ON p.id = n.project_id
         WHERE ${cond.join(" AND ")}
         ORDER BY n.created_at DESC LIMIT $${params.length}`,
        params
      );
      const { rows: [cnt] } = await pool.query(
        `SELECT COUNT(*) AS unread FROM hub_notifications
         WHERE tenant_id = $1 AND user_id = $2 AND read = FALSE`,
        [tenantId, userId]
      );
      res.json({ notifications: rows, unreadCount: parseInt(cnt.unread) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/hub/notifications/:id/read — marcar como lida
  app.patch("/api/hub/notifications/:id/read", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    try {
      await pool.query(
        `UPDATE hub_notifications SET read = TRUE
         WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
        [req.params.id, tenantId, userId]
      );
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/hub/notifications/read-all — marcar todas como lidas
  app.patch("/api/hub/notifications/read-all", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    try {
      await pool.query(
        `UPDATE hub_notifications SET read = TRUE
         WHERE tenant_id = $1 AND user_id = $2 AND read = FALSE`,
        [tenantId, userId]
      );
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/hub/notifications/run-job — disparo manual (admin/dev)
  app.post("/api/hub/notifications/run-job", ...auth, async (req, res) => {
    try {
      const result = await runNotificationJob();
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── HUB-IMP-01: Migration ─────────────────────────────────────────────────
  app.post("/api/hub/migrate-imp01", ...auth, async (req, res) => {
    res.json(await runMigrationHubImp01());
  });

  // ── HUB-IMP-01: Fases do projeto ─────────────────────────────────────────

  // GET /api/hub/projects/:id/fase — retorna fase atual + checklist
  app.get("/api/hub/projects/:id/fase", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT id, project_code, title, fase_atual, checklist_fases, codigo_externo
         FROM projects
         WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Projeto não encontrado" });
      res.json({ ...rows[0], fases_disponiveis: FASES_PROJETO });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/hub/projects/:id/fase — avança/retrocede fase
  app.patch("/api/hub/projects/:id/fase", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { fase, checklistUpdate } = req.body;

    if (!fase || !FASES_PROJETO.includes(fase)) {
      return res.status(400).json({ error: `Fase inválida. Válidas: ${FASES_PROJETO.join(", ")}` });
    }

    try {
      const sets: string[] = ["fase_atual = $2", "updated_at = NOW()"];
      const params: any[] = [req.params.id, fase];

      if (checklistUpdate && typeof checklistUpdate === "object") {
        params.push(JSON.stringify(checklistUpdate));
        sets.push(`checklist_fases = checklist_fases || $${params.length}::jsonb`);
      }

      params.push(tenantId);
      const { rows } = await pool.query(
        `UPDATE projects SET ${sets.join(", ")}
         WHERE id = $1 AND tenant_id = $${params.length} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Projeto não encontrado" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/hub/projects/:id/codigo-externo — vincula código IMP ao projeto
  app.patch("/api/hub/projects/:id/codigo-externo", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { codigoExterno } = req.body;

    if (!codigoExterno?.trim()) {
      return res.status(400).json({ error: "codigoExterno obrigatório" });
    }
    try {
      const { rows } = await pool.query(
        `UPDATE projects SET codigo_externo = $2, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $3 RETURNING id, project_code, titulo, codigo_externo`,
        [req.params.id, codigoExterno.trim(), tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Projeto não encontrado" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── HUB-IMP-01: Bloqueadores de faturamento ───────────────────────────────

  // GET /api/hub/projects/:id/billing-blockers
  app.get("/api/hub/projects/:id/billing-blockers", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { status } = req.query;
    try {
      const cond = ["project_id = $1", "tenant_id = $2"];
      const params: any[] = [req.params.id, tenantId];
      if (status) { params.push(status); cond.push(`status = $${params.length}`); }

      const { rows } = await pool.query(
        `SELECT * FROM project_billing_blockers
         WHERE ${cond.join(" AND ")}
         ORDER BY data_evento DESC`,
        params
      );
      res.json({ data: rows });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/hub/projects/:id/billing-blockers — registra bloqueador
  app.post("/api/hub/projects/:id/billing-blockers", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    const { tipo, descricao, impactoValor, dataEvento, observacoes } = req.body;

    if (!tipo || !descricao) {
      return res.status(400).json({ error: "tipo e descricao obrigatórios" });
    }

    const TIPOS_VALIDOS = ["acesso_negado", "cliente_ausente", "documentacao_pendente", "outro"];
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: `tipo inválido. Válidos: ${TIPOS_VALIDOS.join(", ")}` });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO project_billing_blockers
           (tenant_id, project_id, tipo, descricao, impacto_valor,
            data_evento, created_by, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [tenantId, req.params.id, tipo, descricao,
         impactoValor || null, dataEvento || new Date().toISOString().slice(0, 10),
         userId, observacoes || null]
      );
      const blocker = rows[0];

      // Registra notificação automática no Hub para o owner do projeto
      await pool.query(
        `INSERT INTO hub_notifications
           (tenant_id, project_id, user_id, type, title, message)
         SELECT $1, $2, owner_id, 'billing_blocker',
                'Bloqueador de faturamento registrado',
                $3
         FROM projects
         WHERE id = $2 AND owner_id IS NOT NULL`,
        [tenantId, req.params.id,
         `[${tipo.replace("_", " ").toUpperCase()}] ${descricao.slice(0, 120)}`]
      ).catch(() => {}); // notificação é best-effort

      res.status(201).json({ data: blocker });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/hub/billing-blockers/:id/resolve — marca bloqueador como resolvido
  app.patch("/api/hub/billing-blockers/:id/resolve", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    const { observacoes } = req.body;

    try {
      const { rows } = await pool.query(
        `UPDATE project_billing_blockers
         SET status = 'resolvido', resolvido_em = NOW(), resolvido_por = $3,
             observacoes = COALESCE($4, observacoes), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [req.params.id, tenantId, userId, observacoes || null]
      );
      if (!rows[0]) return res.status(404).json({ error: "Bloqueador não encontrado" });
      res.json({ data: rows[0] });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/hub/billing-blockers — todos os bloqueadores abertos do tenant
  app.get("/api/hub/billing-blockers", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT b.*, p.project_code, p.title AS project_title, p.codigo_externo
         FROM project_billing_blockers b
         JOIN projects p ON p.id = b.project_id
         WHERE b.tenant_id = $1 AND b.status = 'aberto'
         ORDER BY b.data_evento DESC`,
        [tenantId]
      );
      res.json({ data: rows, total: rows.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
}
