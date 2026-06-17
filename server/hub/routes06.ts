/**
 * Arcádia Project Hub — Routes HUB-06
 * Rateio:   GET/POST/PATCH /api/hub/projects/:id/allocation-rules
 * DRE:      GET /api/hub/projects/:id/dre
 * Snapshots:GET /api/hub/projects/:id/snapshots
 * Job:      POST /api/hub/kpi-job (admin — disparo manual)
 */
import type { Express } from "express";
import { pool } from "../../db/index";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { runHub06Migration } from "./migration06";
import { calcularKpis, persistirSnapshot, runDailyKpiJob } from "./kpiEngine";

const auth = [isAuthenticated, tenantContext, requireTenant];

const allocationSchema = z.object({
  ruleType:      z.enum(["percentual","horas","receita","custo_direto","equipamento","formula"]),
  description:   z.string().optional().nullable(),
  driver:        z.string().optional().nullable(),
  formula:       z.string().optional().nullable(),
  percentage:    z.number().min(0).max(100).optional().nullable(),
  costCategory:  z.string().optional().nullable(),
  planoContaId:  z.string().optional().nullable(),
  effectiveFrom: z.string().optional().nullable(),
  effectiveTo:   z.string().optional().nullable(),
  approvalStatus:z.enum(["rascunho","aprovado"]).optional(),
  active:        z.boolean().optional(),
});

export function registerHub06Routes(app: Express) {

  // Migration
  app.post("/api/hub/migrate06", ...auth, async (req, res) => {
    res.json(await runHub06Migration());
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ALLOCATION RULES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/hub/projects/:id/allocation-rules", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT * FROM project_allocation_rules
         WHERE project_id = $1 AND tenant_id = $2 ORDER BY created_at`,
        [req.params.id, tenantId]
      );
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/hub/projects/:id/allocation-rules", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = allocationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    try {
      const { rows } = await pool.query(`
        INSERT INTO project_allocation_rules
          (project_id, tenant_id, rule_type, description, driver, formula,
           percentage, cost_category, plano_conta_id, effective_from, effective_to, approval_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [req.params.id, tenantId, d.ruleType, d.description ?? null, d.driver ?? null,
         d.formula ?? null, d.percentage ?? null, d.costCategory ?? null,
         d.planoContaId ?? null, d.effectiveFrom ?? null, d.effectiveTo ?? null,
         d.approvalStatus ?? "rascunho"]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/hub/allocation-rules/:ruleId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    const parsed = allocationSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    const map: Record<string, any> = {
      rule_type: d.ruleType, description: d.description, driver: d.driver,
      formula: d.formula, percentage: d.percentage, cost_category: d.costCategory,
      plano_conta_id: d.planoContaId, effective_from: d.effectiveFrom,
      effective_to: d.effectiveTo, approval_status: d.approvalStatus, active: d.active,
    };
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) { fields.push(`${col} = $${i}`); params.push(val); i++; }
    }
    if (d.approvalStatus === "aprovado") {
      fields.push(`approved_by = $${i}`, `approved_at = $${i+1}`);
      params.push(userId, new Date()); i += 2;
    }
    if (!fields.length) return res.status(400).json({ error: "Nenhum campo" });
    params.push(req.params.ruleId, tenantId);
    try {
      const { rows } = await pool.query(
        `UPDATE project_allocation_rules SET ${fields.join(",")}
         WHERE id = $${i} AND tenant_id = $${i+1} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Regra não encontrada" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Simular rateio (sem persistir)
  app.post("/api/hub/allocation-rules/:ruleId/simulate", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows: [rule] } = await pool.query(
        `SELECT * FROM project_allocation_rules WHERE id = $1 AND tenant_id = $2`,
        [req.params.ruleId, tenantId]
      );
      if (!rule) return res.status(404).json({ error: "Regra não encontrada" });

      let amount = 0;
      switch (rule.rule_type) {
        case "percentual": {
          // % sobre custos diretos do projeto
          const { rows: [c] } = await pool.query(
            `SELECT COALESCE(SUM(amount),0) AS total FROM project_cost_events
             WHERE project_id = $1 AND tenant_id = $2 AND cost_category != 'overhead'`,
            [rule.project_id, tenantId]
          );
          amount = Number(c.total) * (Number(rule.percentage) / 100);
          break;
        }
        case "horas": {
          // % sobre total de horas do projeto multiplicado pela taxa média
          const { rows: [h] } = await pool.query(
            `SELECT COALESCE(SUM(cost_amount),0) AS total FROM project_timesheets
             WHERE project_id = $1 AND tenant_id = $2 AND approved_at IS NOT NULL`,
            [rule.project_id, tenantId]
          );
          amount = Number(h.total) * (Number(rule.percentage ?? 10) / 100);
          break;
        }
        case "receita": {
          const { rows: [r] } = await pool.query(
            `SELECT COALESCE(SUM(l.valor),0) AS total FROM lancamentos_financeiros l
             WHERE l.projeto_id = $1 AND l.tenant_id = $2 AND l.tipo = 'receber'
               AND l.status IN ('pago','aprovado')`,
            [rule.project_id, tenantId]
          );
          amount = Number(r.total) * (Number(rule.percentage ?? 5) / 100);
          break;
        }
        default: amount = 0;
      }
      res.json({ ruleId: rule.id, ruleType: rule.rule_type, simulatedAmount: amount });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DRE POR PROJETO — integra Control + cost_events + rateio
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/hub/projects/:id/dre", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const kpi = await calcularKpis(req.params.id, tenantId);

      // Custos por categoria para o DRE
      const { rows: costDetail } = await pool.query(
        `SELECT cost_category,
           COALESCE(SUM(amount),0)::numeric AS actual,
           COUNT(*) AS events
         FROM project_cost_events
         WHERE project_id = $1 AND tenant_id = $2
         GROUP BY cost_category ORDER BY actual DESC`,
        [req.params.id, tenantId]
      );

      // Lançamentos do Control por grupo_dre
      const { rows: controlLanc } = await pool.query(
        `SELECT
           COALESCE(pc.grupo_dre, pc.natureza, 'Outros') AS grupo,
           l.tipo,
           COALESCE(SUM(l.valor),0)::numeric AS total
         FROM lancamentos_financeiros l
         LEFT JOIN planos_contas pc ON pc.id = l.plano_conta_id
         WHERE l.projeto_id = $1 AND l.tenant_id = $2
           AND l.status IN ('pago','aprovado')
         GROUP BY COALESCE(pc.grupo_dre, pc.natureza, 'Outros'), l.tipo
         ORDER BY grupo, l.tipo`,
        [req.params.id, tenantId]
      );

      const dre = {
        receita_contratada:  kpi.contractValue,
        receita_faturada:    kpi.revenueBilled,
        receita_reconhecida: kpi.revenueRecognized,
        custo_mao_obra:      kpi.costLabor,
        custo_material:      kpi.costMaterial,
        custo_terceiros:     kpi.costThirdParty,
        custo_overhead:      kpi.costOverhead,
        custo_total:         kpi.costActual,
        margem_bruta:        kpi.grossMargin,
        margem_bruta_pct:    kpi.marginPct,
        horas_total:         kpi.totalHours,
        horas_faturavel:     kpi.billableHours,
        cpi:                 kpi.cpi,
        spi:                 kpi.spi,
        eac:                 kpi.eac,
        health_score:        kpi.healthScore,
        custo_por_categoria: costDetail,
        lancamentos_control: controlLanc,
      };

      res.json(dre);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KPI SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET histórico de snapshots
  app.get("/api/hub/projects/:id/snapshots", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { days = "30" } = req.query;
    try {
      const { rows } = await pool.query(
        `SELECT * FROM project_kpi_snapshots
         WHERE project_id = $1 AND tenant_id = $2
           AND snapshot_date >= NOW() - INTERVAL '${parseInt(days as string)} days'
         ORDER BY snapshot_date ASC`,
        [req.params.id, tenantId]
      );
      // Último snapshot + tendência
      const last  = rows[rows.length - 1] ?? null;
      const prev  = rows[rows.length - 2] ?? null;
      const trend = last && prev ? {
        cpi:    Number(last.cpi) - Number(prev.cpi ?? 0),
        margin: Number(last.margin_pct) - Number(prev.margin_pct ?? 0),
        cost:   Number(last.cost_actual) - Number(prev.cost_actual ?? 0),
      } : null;
      res.json({ snapshots: rows, last, trend });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST — gerar snapshot sob demanda
  app.post("/api/hub/projects/:id/snapshots", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const kpi = await persistirSnapshot(req.params.id, tenantId);
      res.json(kpi);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/hub/kpi-job — disparar job manualmente (admin)
  app.post("/api/hub/kpi-job", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const result = await runDailyKpiJob(tenantId);
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Portfolio: todos os projetos com último snapshot
  app.get("/api/hub/portfolio", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT
           p.id, p.project_code, p.title, p.project_type,
           p.status, p.progress_pct, p.health_score,
           p.planned_end, p.contract_value,
           p.cliente_nome, p.cliente_externo_nome,
           s.cost_actual, s.revenue_recognized, s.gross_margin,
           s.margin_pct, s.cpi, s.spi, s.total_hours,
           s.snapshot_date
         FROM projects p
         LEFT JOIN LATERAL (
           SELECT * FROM project_kpi_snapshots
           WHERE project_id = p.id
           ORDER BY snapshot_date DESC LIMIT 1
         ) s ON true
         WHERE p.tenant_id = $1 AND p.status != 'cancelado'
         ORDER BY p.created_at DESC`,
        [tenantId]
      );
      const totals = {
        totalProjects:   rows.length,
        activeProjects:  rows.filter((r: any) => r.status === "ativo").length,
        totalContrato:   rows.reduce((s: number, r: any) => s + Number(r.contract_value ?? 0), 0),
        totalMargin:     rows.reduce((s: number, r: any) => s + Number(r.gross_margin ?? 0), 0),
        avgCpi:          rows.filter((r: any) => r.cpi).reduce((s: number, r: any, _: any, a: any[]) =>
                           s + Number(r.cpi) / a.length, 0),
        criticos:        rows.filter((r: any) => r.health_score === "vermelho").length,
        atencao:         rows.filter((r: any) => r.health_score === "amarelo").length,
      };
      res.json({ projects: rows, totals });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
}
