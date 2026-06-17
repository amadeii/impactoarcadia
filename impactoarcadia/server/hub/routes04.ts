/**
 * Arcádia Project Hub — Routes HUB-04
 * Contratos:  GET/POST/PATCH /api/hub/projects/:id/contracts
 * Marcos:     GET/POST/PATCH /api/hub/contracts/:id/milestones
 * Aceite:     POST /api/hub/milestones/:id/accept  → AR no Control
 * Fiscal:     GET /api/hub/projects/:id/fiscal-events
 */

import type { Express } from "express";
import { pool } from "../../db/index";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { gerarLancamentoReceber, resolveClienteControlId, findOrCreateClienteByNome } from "../control/arService";
import { runHub04Migration } from "./migration04";

const auth = [isAuthenticated, tenantContext, requireTenant];

// ── Schemas ──────────────────────────────────────────────────────────────────
const contractSchema = z.object({
  contractNumber:    z.string().optional().nullable(),
  contractType:      z.enum(["fixed_price","time_material","unit_price","cost_plus"]).default("fixed_price"),
  totalValue:        z.number().positive(),
  paymentTerms:      z.string().optional().nullable(),
  retentionPercent:  z.number().min(0).max(100).default(0),
  advancePayment:    z.number().min(0).default(0),
  recognitionMethod: z.enum(["percentual","marco","horas","conclusao"]).default("percentual"),
  status:            z.enum(["rascunho","ativo","aditado","encerrado","cancelado"]).default("ativo"),
  signedAt:          z.string().optional().nullable(),
  notes:             z.string().optional().nullable(),
});

const milestoneSchema = z.object({
  title:              z.string().min(1),
  triggerType:        z.enum(["percentual","entregavel","data","manual"]).default("manual"),
  triggerValue:       z.number().optional().nullable(),
  amount:             z.number().positive(),
  acceptanceRequired: z.boolean().default(true),
  wbsNodeId:          z.string().optional().nullable(),
  dueDate:            z.string().optional().nullable(),
  orderIndex:         z.number().optional(),
});

const acceptSchema = z.object({
  acceptanceNotes: z.string().optional().nullable(),
  // Dados para NFS-e (opcional — se preenchidos gera fiscal_event)
  municipioIbge:   z.string().optional().nullable(),
  serviceCode:     z.string().optional().nullable(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Gera AR no Control para um marco aceito.
 * Usa origemRefTipo "contrato" + origemRefId = milestone.id para idempotência.
 */
async function gerarARParaMarco(
  milestone: any, project: any, tenantId: string, userId: string | null
): Promise<string | null> {
  try {
    // Resolver clienteControlId
    let clienteControlId: string | null = null;
    if (project.cliente_id) {
      clienteControlId = await resolveClienteControlId(project.cliente_id, tenantId);
    }
    if (!clienteControlId) {
      const r = await pool.query(
        `SELECT id FROM clients WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`,
        [tenantId]
      );
      clienteControlId = r.rows[0]?.id ?? null;
    }
    // Fallback final: find-or-create client pelo nome externo do projeto
    if (!clienteControlId) {
      const nomeExterno = project.cliente_externo_nome ?? project.cliente_nome ?? null;
      if (nomeExterno) {
        clienteControlId = await findOrCreateClienteByNome(nomeExterno, tenantId);
      }
    }
    if (!clienteControlId) {
      console.warn(`[HUB-04] Marco ${milestone.id} sem clienteControlId — AR não gerado`);
      return null;
    }

    const vencimento = milestone.due_date
      ?? (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })();

    const result = await gerarLancamentoReceber({
      tenantId,
      clienteControlId,
      pessoaId: project.cliente_id || null,
      favorecido: project.cliente_nome || project.cliente_externo_nome || undefined,
      descricao: `${project.project_code} — ${milestone.title}`,
      valor: parseFloat(milestone.amount),
      dataVencimento: vencimento,
      origemRefTipo: "contrato",
      origemRefId: milestone.id,    // idempotência: uma só AR por marco
      criadoPor: userId,
      observacoes: `Marco: ${milestone.title}`,
    });

    if (result.jaExiste) {
      console.log(`[HUB-04] AR já existe para marco ${milestone.id}`);
      return result.lancamentos?.[0]?.id ?? null;
    }
    if (result.ok && result.lancamentos?.[0]) {
      return result.lancamentos[0].id;
    }
    console.error(`[HUB-04] Erro ao gerar AR:`, result.error);
    return null;
  } catch (e: any) {
    console.error(`[HUB-04] Exceção ao gerar AR:`, e.message);
    return null;
  }
}

/**
 * Gera fiscal_event para um marco aceito.
 */
async function gerarFiscalEvent(
  milestoneId: string, projectId: string, tenantId: string,
  amount: number, opts: { municipioIbge?: string; serviceCode?: string }
): Promise<string | null> {
  try {
    const { rows } = await pool.query(`
      INSERT INTO project_fiscal_events
        (project_id, tenant_id, milestone_id, event_type,
         municipio_ibge, service_code, amount, competencia, event_status)
      VALUES ($1,$2,$3,'nfse',$4,$5,$6,NOW()::date,'pendente')
      ON CONFLICT DO NOTHING
      RETURNING id`,
      [projectId, tenantId, milestoneId,
       opts.municipioIbge ?? null, opts.serviceCode ?? null, amount]
    );
    return rows[0]?.id ?? null;
  } catch (e: any) {
    console.error(`[HUB-04] Erro ao gerar fiscal_event:`, e.message);
    return null;
  }
}

// ── Registro ──────────────────────────────────────────────────────────────────
export function registerHub04Routes(app: Express) {

  // Migration
  app.post("/api/hub/migrate04", ...auth, async (req, res) => {
    const result = await runHub04Migration();
    res.json(result);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTRATOS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/hub/projects/:id/contracts
  app.get("/api/hub/projects/:id/contracts", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT c.*,
           (SELECT json_agg(m ORDER BY m.order_index, m.created_at)
            FROM project_billing_milestones m WHERE m.contract_id = c.id
           ) AS milestones,
           (SELECT COALESCE(SUM(m.amount),0) FROM project_billing_milestones m
            WHERE m.contract_id = c.id AND m.status = 'faturado'
           ) AS total_billed,
           (SELECT COALESCE(SUM(m.amount),0) FROM project_billing_milestones m
            WHERE m.contract_id = c.id AND m.status = 'recebido'
           ) AS total_received
         FROM project_contracts c
         WHERE c.project_id = $1 AND c.tenant_id = $2
         ORDER BY c.created_at DESC`,
        [req.params.id, tenantId]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hub/projects/:id/contracts
  app.post("/api/hub/projects/:id/contracts", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = contractSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    try {
      const { rows } = await pool.query(`
        INSERT INTO project_contracts
          (project_id, tenant_id, contract_number, contract_type, total_value,
           payment_terms, retention_percent, advance_payment, recognition_method,
           status, signed_at, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [req.params.id, tenantId, d.contractNumber ?? null, d.contractType, d.totalValue,
         d.paymentTerms ?? null, d.retentionPercent, d.advancePayment, d.recognitionMethod,
         d.status, d.signedAt ?? null, d.notes ?? null]
      );
      // Atualizar contract_value no projeto se maior
      await pool.query(
        `UPDATE projects SET contract_value = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3
           AND (contract_value IS NULL OR contract_value < $1)`,
        [d.totalValue, req.params.id, tenantId]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/hub/contracts/:contractId
  app.patch("/api/hub/contracts/:contractId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = contractSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    const map: Record<string, any> = {
      contract_number: d.contractNumber, contract_type: d.contractType,
      total_value: d.totalValue, payment_terms: d.paymentTerms,
      retention_percent: d.retentionPercent, advance_payment: d.advancePayment,
      recognition_method: d.recognitionMethod, status: d.status,
      signed_at: d.signedAt, notes: d.notes,
    };
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) { fields.push(`${col} = $${i}`); params.push(val); i++; }
    }
    if (!fields.length) return res.status(400).json({ error: "Nenhum campo" });
    fields.push(`updated_at = NOW()`);
    params.push(req.params.contractId, tenantId);
    try {
      const { rows } = await pool.query(
        `UPDATE project_contracts SET ${fields.join(",")}
         WHERE id = $${i} AND tenant_id = $${i+1} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Contrato não encontrado" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MARCOS DE BILLING
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/hub/contracts/:contractId/milestones
  app.get("/api/hub/contracts/:contractId/milestones", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT m.*, w.title AS wbs_title, w.code AS wbs_code
         FROM project_billing_milestones m
         LEFT JOIN project_wbs_nodes w ON w.id = m.wbs_node_id
         WHERE m.contract_id = $1 AND m.tenant_id = $2
         ORDER BY m.order_index, m.created_at`,
        [req.params.contractId, tenantId]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET todos marcos do projeto (cross-contract)
  app.get("/api/hub/projects/:id/milestones", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT m.*, c.contract_number, c.contract_type,
           w.title AS wbs_title, w.code AS wbs_code
         FROM project_billing_milestones m
         JOIN project_contracts c ON c.id = m.contract_id
         LEFT JOIN project_wbs_nodes w ON w.id = m.wbs_node_id
         WHERE m.project_id = $1 AND m.tenant_id = $2
         ORDER BY m.order_index, m.due_date, m.created_at`,
        [req.params.id, tenantId]
      );

      // KPIs de faturamento
      const totalContrato = rows.reduce((s: number, m: any) => s + parseFloat(m.amount), 0);
      const totalFaturado = rows.filter((m: any) => ["faturado","recebido"].includes(m.status))
        .reduce((s: number, m: any) => s + parseFloat(m.amount), 0);
      const totalRecebido = rows.filter((m: any) => m.status === "recebido")
        .reduce((s: number, m: any) => s + parseFloat(m.amount), 0);
      const totalPendente = rows.filter((m: any) => ["pendente","atingido"].includes(m.status))
        .reduce((s: number, m: any) => s + parseFloat(m.amount), 0);
      const totalBloqueado = rows.filter((m: any) => m.status === "bloqueado")
        .reduce((s: number, m: any) => s + parseFloat(m.amount), 0);

      res.json({ milestones: rows, kpis: {
        totalContrato, totalFaturado, totalRecebido, totalPendente, totalBloqueado,
        pctFaturado: totalContrato > 0 ? (totalFaturado / totalContrato) * 100 : 0,
      }});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hub/contracts/:contractId/milestones
  app.post("/api/hub/contracts/:contractId/milestones", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = milestoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    try {
      const { rows: c } = await pool.query(
        `SELECT project_id FROM project_contracts WHERE id = $1 AND tenant_id = $2`,
        [req.params.contractId, tenantId]
      );
      if (!c[0]) return res.status(404).json({ error: "Contrato não encontrado" });

      const { rows } = await pool.query(`
        INSERT INTO project_billing_milestones
          (contract_id, project_id, tenant_id, wbs_node_id, title,
           trigger_type, trigger_value, amount, acceptance_required, due_date, order_index)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [req.params.contractId, c[0].project_id, tenantId,
         d.wbsNodeId ?? null, d.title, d.triggerType, d.triggerValue ?? null,
         d.amount, d.acceptanceRequired, d.dueDate ?? null, d.orderIndex ?? 0]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/hub/milestones/:milestoneId
  app.patch("/api/hub/milestones/:milestoneId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = milestoneSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    const map: Record<string, any> = {
      title: d.title, trigger_type: d.triggerType, trigger_value: d.triggerValue,
      amount: d.amount, acceptance_required: d.acceptanceRequired,
      wbs_node_id: d.wbsNodeId, due_date: d.dueDate, order_index: d.orderIndex,
    };
    if ((req.body as any).status) { map.status = (req.body as any).status; }
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) { fields.push(`${col} = $${i}`); params.push(val); i++; }
    }
    if (!fields.length) return res.status(400).json({ error: "Nenhum campo" });
    fields.push(`updated_at = NOW()`);
    params.push(req.params.milestoneId, tenantId);
    try {
      const { rows } = await pool.query(
        `UPDATE project_billing_milestones SET ${fields.join(",")}
         WHERE id = $${i} AND tenant_id = $${i+1} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Marco não encontrado" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── ACEITE DO MARCO — endpoint central do HUB-04 ──────────────────────────
  // POST /api/hub/milestones/:milestoneId/accept
  // 1. Marca accepted_at / accepted_by
  // 2. Gera AR no Control via gerarLancamentoReceber
  // 3. Gera project_fiscal_event
  // 4. Atualiza status → faturado
  app.post("/api/hub/milestones/:milestoneId/accept", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;

    const parsed = acceptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Buscar marco + projeto
      const { rows: [milestone] } = await client.query(
        `SELECT m.*, p.project_code, p.cliente_id, p.cliente_nome,
                p.cliente_externo_nome, p.municipio_ibge
         FROM project_billing_milestones m
         JOIN projects p ON p.id = m.project_id
         WHERE m.id = $1 AND m.tenant_id = $2`,
        [req.params.milestoneId, tenantId]
      );
      if (!milestone) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Marco não encontrado" });
      }
      if (milestone.status === "faturado" || milestone.status === "recebido") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Marco já faturado" });
      }

      // 1. Registrar aceite
      await client.query(
        `UPDATE project_billing_milestones
         SET accepted_at = NOW(), accepted_by = $1, acceptance_notes = $2,
             status = 'atingido', updated_at = NOW()
         WHERE id = $3`,
        [userId, d.acceptanceNotes ?? null, req.params.milestoneId]
      );
      await client.query("COMMIT");

      // 2. Gerar AR (fora da transaction para não bloquear se falhar)
      const arId = await gerarARParaMarco(milestone, milestone, tenantId, userId);

      // 3. Gerar fiscal_event
      const municipioIbge = d.municipioIbge ?? milestone.municipio_ibge;
      const fiscalEventId = await gerarFiscalEvent(
        req.params.milestoneId, milestone.project_id, tenantId,
        parseFloat(milestone.amount),
        { municipioIbge, serviceCode: d.serviceCode ?? undefined }
      );

      // 4. Atualizar ids gerados + status faturado
      await pool.query(
        `UPDATE project_billing_milestones
         SET ar_lancamento_id = $1, fiscal_event_id = $2,
             status = 'faturado', updated_at = NOW()
         WHERE id = $3`,
        [arId ?? null, fiscalEventId ?? null, req.params.milestoneId]
      );

      const { rows: [updated] } = await pool.query(
        `SELECT * FROM project_billing_milestones WHERE id = $1`,
        [req.params.milestoneId]
      );

      res.json({
        milestone: updated,
        arGerado: !!arId,
        arLancamentoId: arId,
        fiscalEventGerado: !!fiscalEventId,
        fiscalEventId,
      });
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // Marcar como recebido (baixa do AR)
  app.post("/api/hub/milestones/:milestoneId/receive", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `UPDATE project_billing_milestones
         SET status = 'recebido', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2
           AND status IN ('faturado','atingido')
         RETURNING *`,
        [req.params.milestoneId, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Marco não encontrado ou status inválido" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FISCAL EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/hub/projects/:id/fiscal-events", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT f.*,
           (SELECT title FROM project_billing_milestones WHERE id = f.milestone_id) AS milestone_title
         FROM project_fiscal_events f
         WHERE f.project_id = $1 AND f.tenant_id = $2
         ORDER BY f.created_at DESC`,
        [req.params.id, tenantId]
      );
      const { rows: [totals] } = await pool.query(
        `SELECT
           COALESCE(SUM(amount),0) AS total_amount,
           COALESCE(SUM(retention_iss),0) AS total_iss,
           COALESCE(SUM(retention_ir),0) AS total_ir,
           COALESCE(SUM(retention_pcc),0) AS total_pcc
         FROM project_fiscal_events
         WHERE project_id = $1 AND tenant_id = $2 AND event_status != 'cancelado'`,
        [req.params.id, tenantId]
      );
      res.json({ events: rows, totals });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Aprovar fiscal_event (pré-emissão)
  app.post("/api/hub/fiscal-events/:eventId/approve", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    try {
      const { rows } = await pool.query(
        `UPDATE project_fiscal_events
         SET event_status = 'aprovado', approved_by = $1, approved_at = NOW()
         WHERE id = $2 AND tenant_id = $3 AND event_status = 'pendente'
         RETURNING *`,
        [userId, req.params.eventId, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Evento não encontrado" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
