/**
 * Arcádia Project Hub — KPI Engine HUB-06
 * Calcula e persiste snapshots de KPI para um projeto.
 * Chamado pelo job diário e sob demanda.
 */
import { pool } from "../../db/index";

export interface KpiResult {
  projectId: string;
  snapshotDate: string;
  contractValue: number;
  revenueBilled: number;
  revenueRecognized: number;
  costPlanned: number;
  costActual: number;
  costLabor: number;
  costMaterial: number;
  costThirdParty: number;
  costOverhead: number;
  grossMargin: number;
  marginPct: number;
  progressPct: number;
  plannedValue: number;
  earnedValue: number;
  cpi: number | null;
  spi: number | null;
  eac: number | null;
  variance: number;
  totalHours: number;
  billableHours: number;
  healthScore: string;
  byCategory: { category: string; actual: number }[];
}

export async function calcularKpis(projectId: string, tenantId: string): Promise<KpiResult> {
  // ── Projeto base ──────────────────────────────────────────────────────────
  const { rows: [p] } = await pool.query(
    `SELECT id, contract_value, progress_pct, planned_start, planned_end
     FROM projects WHERE id = $1 AND tenant_id = $2`,
    [projectId, tenantId]
  );

  // ── Orçamento aprovado ────────────────────────────────────────────────────
  const { rows: [bv] } = await pool.query(
    `SELECT COALESCE(total_budget,0) AS total_budget
     FROM project_budget_versions
     WHERE project_id = $1 AND tenant_id = $2 AND status = 'aprovado'
     ORDER BY version DESC LIMIT 1`,
    [projectId, tenantId]
  );

  // ── Custos reais por categoria ────────────────────────────────────────────
  const { rows: costRows } = await pool.query(
    `SELECT cost_category, COALESCE(SUM(amount),0)::numeric AS total
     FROM project_cost_events
     WHERE project_id = $1 AND tenant_id = $2
     GROUP BY cost_category`,
    [projectId, tenantId]
  );
  const byCat: Record<string, number> = {};
  costRows.forEach((r: any) => { byCat[r.cost_category] = Number(r.total); });
  const costActual     = Object.values(byCat).reduce((s, v) => s + v, 0);
  const costLabor      = byCat["mao_obra"]     ?? 0;
  const costMaterial   = byCat["material"]     ?? 0;
  const costThirdParty = byCat["terceiros"]    ?? 0;
  const costOverhead   = byCat["overhead"]     ?? 0;

  // ── Receita faturada (marcos faturados/recebidos no Control) ──────────────
  const { rows: [billedRow] } = await pool.query(
    `SELECT COALESCE(SUM(l.valor),0) AS billed
     FROM lancamentos_financeiros l
     WHERE l.projeto_id = $1 AND l.tenant_id = $2
       AND l.tipo = 'receber'
       AND l.status IN ('pago','aprovado')`,
    [projectId, tenantId]
  );

  // ── Horas ─────────────────────────────────────────────────────────────────
  const { rows: [hoursRow] } = await pool.query(
    `SELECT COALESCE(SUM(hours),0)::numeric AS total,
            COALESCE(SUM(CASE WHEN billable THEN hours ELSE 0 END),0)::numeric AS billable
     FROM project_timesheets
     WHERE project_id = $1 AND tenant_id = $2`,
    [projectId, tenantId]
  );

  // ── Cálculos EVM ──────────────────────────────────────────────────────────
  const contractValue    = Number(p?.contract_value  ?? 0);
  const costPlanned      = Number(bv?.total_budget ?? 0);
  const progressPct      = p?.progress_pct ?? 0;
  const revenueBilled    = Number(billedRow.billed);
  const revenueRecognized = contractValue * (progressPct / 100);

  const plannedValue = costPlanned * (progressPct / 100);
  const earnedValue  = costPlanned * (progressPct / 100);
  const cpi = costActual > 0 ? earnedValue / costActual : null;
  const eac = cpi && cpi > 0 ? costPlanned / cpi : costActual > 0 ? costActual : null;
  const variance = costPlanned - costActual;

  // SPI baseado em dias decorridos vs progresso esperado
  let spi: number | null = null;
  if (p?.planned_start && p?.planned_end) {
    const start = new Date(p.planned_start).getTime();
    const end   = new Date(p.planned_end).getTime();
    const now   = Date.now();
    const elapsed = Math.max(0, now - start);
    const total   = end - start;
    const expectedPct = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
    spi = expectedPct > 0 ? progressPct / expectedPct : null;
  }

  // ── Margem ────────────────────────────────────────────────────────────────
  const grossMargin = revenueRecognized - costActual;
  const marginPct   = revenueRecognized > 0 ? (grossMargin / revenueRecognized) * 100 : 0;

  // ── Health score ──────────────────────────────────────────────────────────
  let healthScore = "verde";
  if ((cpi !== null && cpi < 0.85) || (spi !== null && spi < 0.80)) healthScore = "vermelho";
  else if ((cpi !== null && cpi < 0.95) || (spi !== null && spi < 0.90)) healthScore = "amarelo";

  return {
    projectId,
    snapshotDate: new Date().toISOString().split("T")[0],
    contractValue, revenueBilled, revenueRecognized,
    costPlanned, costActual, costLabor, costMaterial, costThirdParty, costOverhead,
    grossMargin, marginPct, progressPct,
    plannedValue, earnedValue, cpi, spi, eac, variance,
    totalHours:    Number(hoursRow.total),
    billableHours: Number(hoursRow.billable),
    healthScore,
    byCategory: costRows.map((r: any) => ({ category: r.cost_category, actual: Number(r.total) })),
  };
}

/** Persiste snapshot e atualiza health_score no projeto */
export async function persistirSnapshot(projectId: string, tenantId: string): Promise<KpiResult> {
  const kpi = await calcularKpis(projectId, tenantId);
  const today = kpi.snapshotDate;

  await pool.query(`
    INSERT INTO project_kpi_snapshots (
      project_id, tenant_id, snapshot_date,
      contract_value, revenue_billed, revenue_recognized,
      cost_planned, cost_actual, cost_labor, cost_material, cost_third_party, cost_overhead,
      gross_margin, margin_pct, progress_pct,
      planned_value, earned_value, cpi, spi, eac, variance,
      total_hours, billable_hours, health_score
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
    )
    ON CONFLICT DO NOTHING`,
    [
      projectId, tenantId, today,
      kpi.contractValue, kpi.revenueBilled, kpi.revenueRecognized,
      kpi.costPlanned, kpi.costActual, kpi.costLabor, kpi.costMaterial,
      kpi.costThirdParty, kpi.costOverhead,
      kpi.grossMargin, kpi.marginPct, kpi.progressPct,
      kpi.plannedValue, kpi.earnedValue, kpi.cpi, kpi.spi, kpi.eac, kpi.variance,
      kpi.totalHours, kpi.billableHours, kpi.healthScore,
    ]
  );

  // Atualizar health_score e progress no projeto
  await pool.query(
    `UPDATE projects SET health_score = $1, updated_at = NOW() WHERE id = $2`,
    [kpi.healthScore, projectId]
  );

  return kpi;
}

/** Job diário — calcula snapshot para todos os projetos ativos */
export async function runDailyKpiJob(tenantId?: string): Promise<{ processed: number; errors: number }> {
  const filter = tenantId ? `AND tenant_id = '${tenantId}'` : "";
  const { rows: projetos } = await pool.query(
    `SELECT id, tenant_id FROM projects WHERE status = 'ativo' ${filter}`
  );
  let processed = 0, errors = 0;
  for (const p of projetos) {
    try {
      await persistirSnapshot(p.id, p.tenant_id);
      processed++;
    } catch (e) {
      errors++;
      console.error(`[KPI Job] Erro projeto ${p.id}:`, e);
    }
  }
  return { processed, errors };
}
