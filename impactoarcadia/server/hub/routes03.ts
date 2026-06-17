/**
 * Arcádia Project Hub — Routes HUB-03
 * Orçamento: GET/POST/PATCH /api/hub/projects/:id/budget
 * Linhas:    GET/POST/PATCH/DELETE /api/hub/budget/:versionId/lines
 * Custos:    GET /api/hub/projects/:id/cost-events
 *            POST /api/hub/projects/:id/cost-events (manual)
 * KPIs:      GET /api/hub/projects/:id/kpis
 */

import type { Express } from "express";
import { pool } from "../../db/index";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { runHub03Migration } from "./migration03";

const auth = [isAuthenticated, tenantContext, requireTenant];

const CATEGORIES = ["mao_obra","material","terceiros","equipamento","despesa","overhead"] as const;

const budgetVersionSchema = z.object({
  label:  z.string().optional().nullable(),
  status: z.enum(["rascunho","aprovado","substituido"]).optional(),
  notes:  z.string().optional().nullable(),
});

const budgetLineSchema = z.object({
  wbsNodeId:    z.string().optional().nullable(),
  costCategory: z.enum(CATEGORIES),
  description:  z.string().optional().nullable(),
  planoContaId: z.string().optional().nullable(),
  quantity:     z.number().default(1),
  unit:         z.string().default("un"),
  unitCost:     z.number().default(0),
});

const costEventSchema = z.object({
  wbsNodeId:    z.string().optional().nullable(),
  sourceType:   z.string().default("manual"),
  sourceId:     z.string().optional().nullable(),
  costCategory: z.enum(CATEGORIES),
  description:  z.string().optional().nullable(),
  amount:       z.number().positive(),
  eventDate:    z.string(),
  controlLancamentoId: z.string().optional().nullable(),
});

export function registerHub03Routes(app: Express) {

  // Migration
  app.post("/api/hub/migrate03", ...auth, async (req, res) => {
    const result = await runHub03Migration();
    res.json(result);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUDGET VERSIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/hub/projects/:id/budget — lista versões + linhas da ativa
  app.get("/api/hub/projects/:id/budget", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows: versions } = await pool.query(
        `SELECT v.*,
           (SELECT json_agg(l ORDER BY l.cost_category, l.created_at)
            FROM project_budget_lines l WHERE l.budget_version_id = v.id
           ) AS lines
         FROM project_budget_versions v
         WHERE v.project_id = $1 AND v.tenant_id = $2
         ORDER BY v.version DESC`,
        [req.params.id, tenantId]
      );

      // Resumo de custos reais (cost_events)
      const { rows: costSummary } = await pool.query(
        `SELECT cost_category,
           SUM(amount) AS actual,
           COUNT(*) AS events
         FROM project_cost_events
         WHERE project_id = $1 AND tenant_id = $2
         GROUP BY cost_category`,
        [req.params.id, tenantId]
      );

      res.json({ versions, costSummary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hub/projects/:id/budget — criar versão
  app.post("/api/hub/projects/:id/budget", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    const parsed   = budgetVersionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Próxima versão
      const { rows: last } = await client.query(
        `SELECT COALESCE(MAX(version),0)+1 AS next FROM project_budget_versions
         WHERE project_id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]
      );
      const version = last[0].next;
      const label = d.label ?? (version === 1 ? "Baseline" : `Revisão ${version - 1}`);

      // Se aprovando, marcar anterior como substituída
      if (d.status === "aprovado") {
        await client.query(
          `UPDATE project_budget_versions SET status = 'substituido'
           WHERE project_id = $1 AND tenant_id = $2 AND status = 'aprovado'`,
          [req.params.id, tenantId]
        );
      }

      const { rows } = await client.query(`
        INSERT INTO project_budget_versions (project_id, tenant_id, version, label, status, notes, approved_by, approved_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          req.params.id, tenantId, version, label,
          d.status ?? "rascunho", d.notes ?? null,
          d.status === "aprovado" ? userId : null,
          d.status === "aprovado" ? new Date() : null,
        ]
      );
      await client.query("COMMIT");
      res.status(201).json(rows[0]);
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // PATCH /api/hub/budget/:versionId — aprovar / atualizar
  app.patch("/api/hub/budget/:versionId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    const parsed   = budgetVersionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (d.label  !== undefined) { fields.push(`label = $${i}`);  params.push(d.label);  i++; }
    if (d.status !== undefined) { fields.push(`status = $${i}`); params.push(d.status); i++; }
    if (d.notes  !== undefined) { fields.push(`notes = $${i}`);  params.push(d.notes);  i++; }
    if (d.status === "aprovado") {
      fields.push(`approved_by = $${i}`, `approved_at = $${i+1}`);
      params.push(userId, new Date()); i += 2;
    }
    if (!fields.length) return res.status(400).json({ error: "Nenhum campo" });
    params.push(req.params.versionId, tenantId);
    try {
      // Marcar anterior como substituída ao aprovar
      if (d.status === "aprovado") {
        const { rows: v } = await pool.query(
          `SELECT project_id FROM project_budget_versions WHERE id = $1`, [req.params.versionId]
        );
        if (v[0]) {
          await pool.query(
            `UPDATE project_budget_versions SET status = 'substituido'
             WHERE project_id = $1 AND tenant_id = $2 AND status = 'aprovado' AND id != $3`,
            [v[0].project_id, tenantId, req.params.versionId]
          );
        }
      }
      const { rows } = await pool.query(
        `UPDATE project_budget_versions SET ${fields.join(",")}
         WHERE id = $${i} AND tenant_id = $${i+1} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Versão não encontrada" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Clonar versão (para revisão)
  app.post("/api/hub/budget/:versionId/clone", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: src } = await client.query(
        `SELECT * FROM project_budget_versions WHERE id = $1 AND tenant_id = $2`,
        [req.params.versionId, tenantId]
      );
      if (!src[0]) return res.status(404).json({ error: "Versão não encontrada" });

      const { rows: last } = await client.query(
        `SELECT COALESCE(MAX(version),0)+1 AS next FROM project_budget_versions
         WHERE project_id = $1 AND tenant_id = $2`,
        [src[0].project_id, tenantId]
      );
      const newVersion = last[0].next;

      const { rows: newV } = await client.query(`
        INSERT INTO project_budget_versions (project_id, tenant_id, version, label, status, notes)
        VALUES ($1,$2,$3,$4,'rascunho',$5) RETURNING *`,
        [src[0].project_id, tenantId, newVersion, `Revisão ${newVersion - 1}`, src[0].notes]
      );

      // Clonar linhas
      const { rows: lines } = await client.query(
        `SELECT * FROM project_budget_lines WHERE budget_version_id = $1`, [src[0].id]
      );
      for (const l of lines) {
        await client.query(`
          INSERT INTO project_budget_lines
            (budget_version_id, project_id, tenant_id, wbs_node_id, cost_category,
             description, plano_conta_id, quantity, unit, unit_cost, amount)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [newV[0].id, l.project_id, tenantId, l.wbs_node_id, l.cost_category,
           l.description, l.plano_conta_id, l.quantity, l.unit, l.unit_cost, l.amount]
        );
      }
      await client.query("COMMIT");
      res.status(201).json(newV[0]);
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUDGET LINES
  // ═══════════════════════════════════════════════════════════════════════════

  // GET linhas de uma versão
  app.get("/api/hub/budget/:versionId/lines", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT l.*, w.title AS wbs_title, w.code AS wbs_code
         FROM project_budget_lines l
         LEFT JOIN project_wbs_nodes w ON w.id = l.wbs_node_id
         WHERE l.budget_version_id = $1 AND l.tenant_id = $2
         ORDER BY l.cost_category, l.created_at`,
        [req.params.versionId, tenantId]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST linha
  app.post("/api/hub/budget/:versionId/lines", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = budgetLineSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const amount = d.quantity * d.unitCost;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Buscar project_id da versão
      const { rows: v } = await client.query(
        `SELECT project_id FROM project_budget_versions WHERE id = $1 AND tenant_id = $2`,
        [req.params.versionId, tenantId]
      );
      if (!v[0]) return res.status(404).json({ error: "Versão não encontrada" });

      const { rows } = await client.query(`
        INSERT INTO project_budget_lines
          (budget_version_id, project_id, tenant_id, wbs_node_id, cost_category,
           description, plano_conta_id, quantity, unit, unit_cost, amount)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [req.params.versionId, v[0].project_id, tenantId, d.wbsNodeId ?? null,
         d.costCategory, d.description ?? null, d.planoContaId ?? null,
         d.quantity, d.unit, d.unitCost, amount]
      );
      // Atualizar total da versão
      await client.query(
        `UPDATE project_budget_versions
         SET total_budget = (SELECT COALESCE(SUM(amount),0) FROM project_budget_lines WHERE budget_version_id = $1)
         WHERE id = $1`,
        [req.params.versionId]
      );
      await client.query("COMMIT");
      res.status(201).json(rows[0]);
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // PATCH linha
  app.patch("/api/hub/budget/lines/:lineId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = budgetLineSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    const map: Record<string, any> = {
      wbs_node_id: d.wbsNodeId, cost_category: d.costCategory,
      description: d.description, plano_conta_id: d.planoContaId,
      quantity: d.quantity, unit: d.unit, unit_cost: d.unitCost,
    };
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) { fields.push(`${col} = $${i}`); params.push(val); i++; }
    }
    // Recalcular amount
    fields.push(`amount = COALESCE($${i}, quantity) * COALESCE($${i+1}, unit_cost)`);
    params.push(d.quantity ?? null, d.unitCost ?? null); i += 2;
    params.push(req.params.lineId, tenantId);
    try {
      const { rows } = await pool.query(
        `UPDATE project_budget_lines SET ${fields.join(",")}
         WHERE id = $${i} AND tenant_id = $${i+1} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Linha não encontrada" });
      // Atualizar total da versão
      await pool.query(
        `UPDATE project_budget_versions
         SET total_budget = (SELECT COALESCE(SUM(amount),0) FROM project_budget_lines WHERE budget_version_id = $1)
         WHERE id = $1`,
        [rows[0].budget_version_id]
      );
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE linha
  app.delete("/api/hub/budget/lines/:lineId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `DELETE FROM project_budget_lines WHERE id = $1 AND tenant_id = $2 RETURNING budget_version_id`,
        [req.params.lineId, tenantId]
      );
      if (rows[0]) {
        await pool.query(
          `UPDATE project_budget_versions
           SET total_budget = (SELECT COALESCE(SUM(amount),0) FROM project_budget_lines WHERE budget_version_id = $1)
           WHERE id = $1`,
          [rows[0].budget_version_id]
        );
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COST EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/hub/projects/:id/cost-events
  app.get("/api/hub/projects/:id/cost-events", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { category, from, to } = req.query;
    const conditions = ["e.project_id = $1", "e.tenant_id = $2"];
    const params: any[] = [req.params.id, tenantId];
    let i = 3;
    if (category) { conditions.push(`e.cost_category = $${i}`); params.push(category); i++; }
    if (from)     { conditions.push(`e.event_date >= $${i}`);   params.push(from);     i++; }
    if (to)       { conditions.push(`e.event_date <= $${i}`);   params.push(to);       i++; }
    try {
      const { rows } = await pool.query(
        `SELECT e.*, w.title AS wbs_title, w.code AS wbs_code
         FROM project_cost_events e
         LEFT JOIN project_wbs_nodes w ON w.id = e.wbs_node_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY e.event_date DESC, e.created_at DESC`,
        params
      );
      // Agregação por categoria
      const { rows: summary } = await pool.query(
        `SELECT cost_category, SUM(amount) AS total, COUNT(*) AS events
         FROM project_cost_events
         WHERE project_id = $1 AND tenant_id = $2
         GROUP BY cost_category ORDER BY total DESC`,
        [req.params.id, tenantId]
      );
      res.json({ events: rows, summary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST manual
  app.post("/api/hub/projects/:id/cost-events", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = costEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    try {
      const { rows } = await pool.query(`
        INSERT INTO project_cost_events
          (project_id, tenant_id, wbs_node_id, source_type, source_id,
           cost_category, description, amount, event_date, control_lancamento_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [req.params.id, tenantId, d.wbsNodeId ?? null, d.sourceType, d.sourceId ?? null,
         d.costCategory, d.description ?? null, d.amount, d.eventDate,
         d.controlLancamentoId ?? null]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KPIs — calculados sob demanda
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/hub/projects/:id/kpis", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      // Projeto base
      const { rows: [p] } = await pool.query(
        `SELECT id, contract_value, progress_pct, planned_start, planned_end
         FROM projects WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]
      );
      if (!p) return res.status(404).json({ error: "Projeto não encontrado" });

      // Orçamento aprovado
      const { rows: [budget] } = await pool.query(
        `SELECT COALESCE(total_budget, 0) AS total_budget
         FROM project_budget_versions
         WHERE project_id = $1 AND tenant_id = $2 AND status = 'aprovado'
         ORDER BY version DESC LIMIT 1`,
        [req.params.id, tenantId]
      );

      // Custo real total
      const { rows: [costs] } = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS actual_cost
         FROM project_cost_events WHERE project_id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]
      );

      // Custo por categoria
      const { rows: byCategory } = await pool.query(
        `SELECT cost_category, COALESCE(SUM(amount),0) AS total
         FROM project_cost_events WHERE project_id = $1 AND tenant_id = $2
         GROUP BY cost_category`,
        [req.params.id, tenantId]
      );

      const contractValue  = parseFloat(p.contract_value  ?? "0");
      const totalBudget    = parseFloat(budget?.total_budget ?? "0");
      const actualCost     = parseFloat(costs.actual_cost);
      const progressPct    = p.progress_pct ?? 0;

      // EVM
      const plannedValue  = totalBudget * (progressPct / 100);
      const earnedValue   = totalBudget * (progressPct / 100);
      const cpi           = actualCost > 0 ? earnedValue / actualCost : null;
      const eac           = cpi && cpi > 0 ? totalBudget / cpi : actualCost;
      const variance      = totalBudget - actualCost;

      // Progresso prazo
      let spi: number | null = null;
      if (p.planned_start && p.planned_end) {
        const start   = new Date(p.planned_start).getTime();
        const end     = new Date(p.planned_end).getTime();
        const now     = Date.now();
        const elapsed = Math.max(0, now - start);
        const total   = end - start;
        const timeElapsedPct = total > 0 ? (elapsed / total) * 100 : 0;
        spi = timeElapsedPct > 0 ? progressPct / timeElapsedPct : null;
      }

      // Margem
      const revenueRecognized = contractValue * (progressPct / 100);
      const grossMargin       = revenueRecognized - actualCost;
      const marginPct         = revenueRecognized > 0 ? (grossMargin / revenueRecognized) * 100 : 0;

      // Health score automático
      let healthScore = "verde";
      if ((cpi !== null && cpi < 0.85) || (spi !== null && spi < 0.8)) healthScore = "vermelho";
      else if ((cpi !== null && cpi < 0.95) || (spi !== null && spi < 0.9)) healthScore = "amarelo";

      // Atualizar health no projeto
      await pool.query(
        `UPDATE projects SET health_score = $1, updated_at = NOW() WHERE id = $2`,
        [healthScore, req.params.id]
      );

      res.json({
        contractValue, totalBudget, actualCost, progressPct,
        plannedValue, earnedValue, cpi, spi, eac,
        variance, variancePct: totalBudget > 0 ? (variance / totalBudget) * 100 : 0,
        revenueRecognized, grossMargin, marginPct,
        healthScore,
        byCategory,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
