/**
 * Arcádia Project Hub — Routes REPORT-01
 * GET /api/hub/projects/:id/reports/delayed-tasks
 * GET /api/hub/projects/:id/reports/billing-summary
 * GET /api/hub/reports/portfolio          ← visão cross-project
 */
import type { Express } from "express";
import { pool } from "../../db/index";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";

const auth = [isAuthenticated, tenantContext, requireTenant];

export function registerReport01Routes(app: Express) {

  // ── Tarefas atrasadas — por projeto ────────────────────────────────────────
  app.get("/api/hub/projects/:id/reports/delayed-tasks", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { from, to } = req.query;

    try {
      const { rows } = await pool.query(
        `SELECT
           t.id, t.title, t.status, t.priority,
           t.due_date, t.completed_at,
           t.assignee_name, t.estimated_hours, t.actual_hours,
           w.code AS wbs_code, w.title AS wbs_title,
           -- Dias de atraso:
           -- se concluída: quantos dias após o prazo foi fechada
           -- se ainda aberta: quantos dias desde o prazo
           CASE
             WHEN t.status = 'done' AND t.completed_at IS NOT NULL AND t.due_date IS NOT NULL
               THEN (t.completed_at::date - t.due_date)
             WHEN t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE
               THEN (CURRENT_DATE - t.due_date)
             ELSE NULL
           END AS days_late,
           CASE
             WHEN t.status = 'done'   THEN 'concluida_com_atraso'
             WHEN t.due_date < CURRENT_DATE THEN 'em_atraso'
             ELSE 'no_prazo'
           END AS delay_status
         FROM project_tasks t
         LEFT JOIN project_wbs_nodes w ON w.id = t.wbs_node_id
         WHERE t.project_id = $1 AND t.tenant_id = $2
           AND t.due_date IS NOT NULL
           AND (
             -- tarefas abertas com prazo vencido
             (t.status NOT IN ('done','blocked') AND t.due_date < CURRENT_DATE)
             OR
             -- tarefas concluídas com atraso (completed_at > due_date)
             (t.status = 'done' AND t.completed_at IS NOT NULL
              AND t.completed_at::date > t.due_date)
           )
           ${from ? `AND t.due_date >= '${from}'` : ""}
           ${to   ? `AND t.due_date <= '${to}'`   : ""}
         ORDER BY
           CASE WHEN t.status != 'done' THEN 0 ELSE 1 END,
           days_late DESC NULLS LAST`,
        [req.params.id, tenantId]
      );

      // Resumo por colaborador
      const { rows: byAssignee } = await pool.query(
        `SELECT
           assignee_name,
           COUNT(*) AS total_atrasadas,
           COUNT(*) FILTER (WHERE status != 'done') AS ainda_abertas,
           ROUND(AVG(
             CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE
               THEN CURRENT_DATE - due_date ELSE 0 END
           )) AS media_dias_atraso
         FROM project_tasks
         WHERE project_id = $1 AND tenant_id = $2
           AND due_date IS NOT NULL AND due_date < CURRENT_DATE
           AND assignee_name IS NOT NULL
         GROUP BY assignee_name
         ORDER BY total_atrasadas DESC`,
        [req.params.id, tenantId]
      );

      // Resumo por prioridade
      const { rows: byPriority } = await pool.query(
        `SELECT
           priority,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status != 'done') AS abertas,
           ROUND(AVG(CASE WHEN due_date < CURRENT_DATE THEN CURRENT_DATE - due_date ELSE 0 END)) AS avg_days
         FROM project_tasks
         WHERE project_id = $1 AND tenant_id = $2
           AND due_date IS NOT NULL AND due_date < CURRENT_DATE
         GROUP BY priority
         ORDER BY CASE priority WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END`,
        [req.params.id, tenantId]
      );

      res.json({
        tasks: rows,
        summary: {
          totalAtrasadas:  rows.length,
          aindaAbertas:    rows.filter((r: any) => r.delay_status === "em_atraso").length,
          concluidasComAtraso: rows.filter((r: any) => r.delay_status === "concluida_com_atraso").length,
          maxDaysLate:     rows.reduce((m: number, r: any) => Math.max(m, Number(r.days_late ?? 0)), 0),
        },
        byAssignee,
        byPriority,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Timesheet Billing Summary — por projeto ───────────────────────────────
  app.get("/api/hub/projects/:id/reports/billing-summary", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { from, to } = req.query;

    const dateFilter = [
      from ? `AND t.date >= '${from}'` : "",
      to   ? `AND t.date <= '${to}'`   : "",
    ].join(" ");

    try {
      // Por colaborador — horas, custo e faturável
      const { rows: byUser } = await pool.query(
        `SELECT
           t.user_name,
           SUM(t.hours)::numeric AS horas_total,
           SUM(CASE WHEN t.billable THEN t.hours ELSE 0 END)::numeric AS horas_faturavel,
           SUM(t.cost_amount)::numeric AS custo_total,
           SUM(t.billing_amount)::numeric AS valor_faturavel,
           COUNT(*) AS lancamentos,
           MIN(t.date) AS primeiro_lancamento,
           MAX(t.date) AS ultimo_lancamento,
           -- Eficiência: valor faturável / custo (>1 = lucrativo)
           CASE WHEN SUM(t.cost_amount) > 0
             THEN ROUND(SUM(t.billing_amount) / SUM(t.cost_amount), 3)
             ELSE NULL END AS eficiencia
         FROM project_timesheets t
         WHERE t.project_id = $1 AND t.tenant_id = $2 ${dateFilter}
         GROUP BY t.user_name
         ORDER BY horas_total DESC`,
        [req.params.id, tenantId]
      );

      // Por tipo de atividade
      const { rows: byActivity } = await pool.query(
        `SELECT
           activity_type,
           SUM(hours)::numeric AS horas,
           SUM(CASE WHEN billable THEN hours ELSE 0 END)::numeric AS horas_faturavel,
           SUM(cost_amount)::numeric AS custo,
           SUM(billing_amount)::numeric AS faturavel,
           ROUND(100.0 * SUM(CASE WHEN billable THEN hours ELSE 0 END) / NULLIF(SUM(hours),0), 1) AS pct_faturavel
         FROM project_timesheets
         WHERE project_id = $1 AND tenant_id = $2 ${dateFilter}
         GROUP BY activity_type
         ORDER BY horas DESC`,
        [req.params.id, tenantId]
      );

      // Evolução semanal
      const { rows: weekly } = await pool.query(
        `SELECT
           DATE_TRUNC('week', date)::date AS semana,
           SUM(hours)::numeric AS horas,
           SUM(billing_amount)::numeric AS faturavel,
           SUM(cost_amount)::numeric AS custo
         FROM project_timesheets
         WHERE project_id = $1 AND tenant_id = $2 ${dateFilter}
         GROUP BY DATE_TRUNC('week', date)
         ORDER BY semana`,
        [req.params.id, tenantId]
      );

      // Totais gerais
      const { rows: [totals] } = await pool.query(
        `SELECT
           COALESCE(SUM(hours),0)::numeric AS horas_total,
           COALESCE(SUM(CASE WHEN billable THEN hours ELSE 0 END),0)::numeric AS horas_faturavel,
           COALESCE(SUM(cost_amount),0)::numeric AS custo_total,
           COALESCE(SUM(billing_amount),0)::numeric AS valor_faturavel,
           COALESCE(SUM(CASE WHEN approved_at IS NOT NULL THEN billing_amount ELSE 0 END),0)::numeric AS valor_aprovado,
           COUNT(*) AS lancamentos,
           COUNT(DISTINCT user_name) AS colaboradores
         FROM project_timesheets
         WHERE project_id = $1 AND tenant_id = $2 ${dateFilter}`,
        [req.params.id, tenantId]
      );

      // Marcos faturados vs a faturar (cross billing)
      const { rows: marcos } = await pool.query(
        `SELECT
           status,
           COUNT(*) AS quantidade,
           COALESCE(SUM(amount),0)::numeric AS valor
         FROM project_billing_milestones
         WHERE project_id = $1 AND tenant_id = $2
         GROUP BY status`,
        [req.params.id, tenantId]
      );

      res.json({ totals, byUser, byActivity, weekly, marcos });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Portfolio — visão cross-project de todos os projetos do tenant ─────────
  app.get("/api/hub/reports/portfolio", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;

    try {
      // Resumo por projeto
      const { rows: projects } = await pool.query(
        `SELECT
           p.id, p.project_code, p.title, p.project_type,
           p.status, p.health_score, p.progress_pct,
           p.planned_start, p.planned_end, p.contract_value,
           p.cliente_nome, p.cliente_externo_nome, p.priority,
           -- Tarefas
           COUNT(DISTINCT t.id) FILTER (WHERE t.status != 'done') AS tarefas_abertas,
           COUNT(DISTINCT t.id) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status != 'done') AS tarefas_atrasadas,
           -- Horas
           COALESCE(SUM(ts.hours),0)::numeric AS horas_total,
           COALESCE(SUM(ts.billing_amount),0)::numeric AS horas_faturavel,
           -- Custo real
           COALESCE(SUM(DISTINCT ce.amount),0)::numeric AS custo_real,
           -- Marcos
           COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'pendente') AS marcos_pendentes,
           COUNT(DISTINCT m.id) FILTER (WHERE m.status IN ('faturado','recebido')) AS marcos_faturados,
           COALESCE(SUM(DISTINCT m.amount) FILTER (WHERE m.status IN ('faturado','recebido')),0)::numeric AS valor_faturado
         FROM projects p
         LEFT JOIN project_tasks t ON t.project_id = p.id
         LEFT JOIN project_timesheets ts ON ts.project_id = p.id
         LEFT JOIN project_cost_events ce ON ce.project_id = p.id
         LEFT JOIN project_billing_milestones m ON m.project_id = p.id
         WHERE p.tenant_id = $1 AND p.status != 'cancelado'
         GROUP BY p.id
         ORDER BY
           CASE p.status WHEN 'ativo' THEN 1 WHEN 'pausado' THEN 2 ELSE 3 END,
           CASE p.health_score WHEN 'vermelho' THEN 1 WHEN 'amarelo' THEN 2 ELSE 3 END,
           p.planned_end ASC NULLS LAST`,
        [tenantId]
      );

      // Totais do portfólio
      const { rows: [pf] } = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'ativo') AS projetos_ativos,
           COUNT(*) FILTER (WHERE status = 'concluido') AS projetos_concluidos,
           COUNT(*) FILTER (WHERE health_score = 'vermelho') AS criticos,
           COUNT(*) FILTER (WHERE health_score = 'amarelo') AS atencao,
           COALESCE(SUM(contract_value) FILTER (WHERE status = 'ativo'),0)::numeric AS carteira_ativa,
           ROUND(AVG(progress_pct) FILTER (WHERE status = 'ativo')) AS avg_progress
         FROM projects WHERE tenant_id = $1`,
        [tenantId]
      );

      res.json({ projects, portfolio: pf });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
