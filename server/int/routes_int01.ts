/**
 * INT-01 — routes_int01.ts
 * Endpoints de diagnóstico e observabilidade da integração SOE.
 */

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { pool } from "../../db/index";

const auth = [isAuthenticated, tenantContext, requireTenant];

export function registerInt01Routes(app: Express): void {

  // ── Health check — visão completa do pipeline SOE ─────────────────────────
  app.get("/api/int/health", ...auth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;

      const { rows: [eventStats] } = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending')    AS pending,
           COUNT(*) FILTER (WHERE status = 'processing') AS processing,
           COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
           COUNT(*) FILTER (WHERE status = 'dead_letter') AS dead_letter,
           COUNT(*) FILTER (WHERE status = 'processed'
             AND created_at >= NOW() - INTERVAL '1 hour') AS processed_last_hour
         FROM soe_events
         WHERE tenant_id = $1`,
        [tenantId]
      );

      const { rows: [arStats] } = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pendente')  AS parcelas_pendentes,
           COUNT(*) FILTER (WHERE status = 'gerado_ar') AS parcelas_com_ar,
           COUNT(*) FILTER (WHERE status = 'cancelado') AS parcelas_canceladas
         FROM sale_order_installments soi
         JOIN sale_orders so ON so.id = soi.sale_order_id
         WHERE so.tenant_id = $1`,
        [tenantId]
      );

      const { rows: [apStats] } = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pendente')  AS parcelas_pendentes,
           COUNT(*) FILTER (WHERE status = 'gerado_ap') AS parcelas_com_ap
         FROM purchase_invoice_installments pii
         JOIN purchase_invoice_entries pie ON pie.id = pii.purchase_invoice_id
         WHERE pie.tenant_id = $1`,
        [tenantId]
      );

      const { rows: pedidosUrgentes } = await pool.query(
        `SELECT id, numero, invoice_requested_at,
                EXTRACT(HOUR FROM NOW() - invoice_requested_at)::int AS horas_aguardando
         FROM sale_orders
         WHERE tenant_id = $1
           AND status = 'aguardando_faturamento'
           AND invoice_requested_at < NOW() - INTERVAL '20 hours'
         ORDER BY invoice_requested_at ASC LIMIT 10`,
        [tenantId]
      );

      const { rows: [manifestacaoStats] } = await pool.query(
        `SELECT COUNT(*) AS urgente
         FROM purchase_invoice_entries
         WHERE tenant_id = $1
           AND manifestacao_status = 'pendente'
           AND data_emissao < CURRENT_DATE - 25`,
        [tenantId]
      );

      const { rows: certAlertas } = await pool.query(
        `SELECT empresa_id, certificado_valido_ate,
                EXTRACT(DAY FROM (certificado_valido_ate - NOW()))::int AS dias_restantes
         FROM emitentes_fiscal
         WHERE tenant_id = $1
           AND certificado_valido_ate IS NOT NULL
           AND certificado_valido_ate <= NOW() + INTERVAL '30 days'
           AND status = 'ativo'`,
        [tenantId]
      );

      const status =
        parseInt(eventStats.dead_letter) > 0 ? 'degraded' :
        parseInt(eventStats.failed) > 5      ? 'warning'  :
        pedidosUrgentes.length > 0           ? 'warning'  :
        'healthy';

      res.json({
        ok: true,
        status,
        data: {
          eventos_soe:          eventStats,
          ar_status:            arStats,
          ap_status:            apStats,
          pedidos_urgentes:     pedidosUrgentes,
          manifestacao_urgente: parseInt(manifestacaoStats.urgente),
          certificados_alertas: certAlertas,
        }
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Ciclo de vida de um pedido — rastreabilidade completa ─────────────────
  app.get("/api/int/pedido/:orderId/ciclo", ...auth, async (req: any, res) => {
    try {
      const { orderId } = req.params;

      const { rows: [order] } = await pool.query(
        `SELECT so.id, so.numero, so.status, so.total_liquido,
                so.created_at, so.aprovado_em, so.invoice_requested_at,
                so.faturado_em, so.fiscal_doc_id,
                p.nome_fantasia AS pessoa_nome
         FROM sale_orders so
         LEFT JOIN pessoas p ON p.id = so.pessoa_id
         WHERE so.id = $1 AND so.tenant_id = $2`,
        [orderId, req.tenantId]
      );
      if (!order) return res.status(404).json({ ok: false, error: "Pedido não encontrado." });

      const { rows: parcelas } = await pool.query(
        `SELECT soi.parcela, soi.vencimento, soi.valor,
                soi.forma_pagamento, soi.status AS parcela_status,
                soi.lancamento_receber_id,
                lf.status AS ar_status, lf.data_pagamento
         FROM sale_order_installments soi
         LEFT JOIN lancamentos_financeiros lf ON lf.id = soi.lancamento_receber_id
         WHERE soi.sale_order_id = $1
         ORDER BY soi.parcela`,
        [orderId]
      );

      const { rows: eventos } = await pool.query(
        `SELECT tipo, status_de, status_para, descricao, created_at
         FROM sale_order_events
         WHERE sale_order_id = $1
         ORDER BY created_at ASC`,
        [orderId]
      );

      const { rows: docFiscal } = await pool.query(
        `SELECT id, tipo, numero, serie, chave_acesso, status, ambiente,
                valor_total, created_at
         FROM fiscal_documentos
         WHERE sale_order_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [orderId]
      );

      const { rows: soeEvents } = await pool.query(
        `SELECT event_type, status, attempts, created_at, processed_at, last_error
         FROM soe_events
         WHERE aggregate_id = $1 AND tenant_id = $2
         ORDER BY created_at ASC`,
        [orderId, req.tenantId]
      );

      res.json({
        ok: true,
        data: {
          pedido:      order,
          parcelas,
          timeline:    eventos,
          doc_fiscal:  docFiscal[0] ?? null,
          soe_eventos: soeEvents,
        }
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Ciclo de vida de uma NF-e de entrada ──────────────────────────────────
  app.get("/api/int/entrada/:entradaId/ciclo", ...auth, async (req: any, res) => {
    try {
      const { rows: [entrada] } = await pool.query(
        `SELECT e.*, p.nome_fantasia AS fornecedor_nome
         FROM purchase_invoice_entries e
         LEFT JOIN pessoas p ON p.id = e.fornecedor_pessoa_id
         WHERE e.id = $1 AND e.tenant_id = $2`,
        [req.params.entradaId, req.tenantId]
      );
      if (!entrada) return res.status(404).json({ ok: false, error: "Entrada não encontrada." });

      const { rows: parcelas } = await pool.query(
        `SELECT pii.numero_duplicata, pii.vencimento, pii.valor,
                pii.status AS parcela_status, pii.lancamento_pagar_id,
                lf.status AS ap_status, lf.data_pagamento
         FROM purchase_invoice_installments pii
         LEFT JOIN lancamentos_financeiros lf ON lf.id = pii.lancamento_pagar_id
         WHERE pii.purchase_invoice_id = $1
         ORDER BY pii.numero_duplicata`,
        [req.params.entradaId]
      );

      const { rows: movEstoque } = await pool.query(
        `SELECT tipo_movimento, quantidade, saldo_posterior,
                deposito_id, created_at
         FROM inventory_movements_core
         WHERE origem_ref_id = $1 AND tenant_id = $2
         ORDER BY created_at ASC`,
        [req.params.entradaId, req.tenantId]
      );

      const { rows: soeEvents } = await pool.query(
        `SELECT event_type, status, attempts, created_at, processed_at, last_error
         FROM soe_events
         WHERE aggregate_id = $1 AND tenant_id = $2
         ORDER BY created_at ASC`,
        [req.params.entradaId, req.tenantId]
      );

      res.json({
        ok: true,
        data: { entrada, parcelas, movimentos_estoque: movEstoque, soe_eventos: soeEvents }
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Replay de evento dead_letter ──────────────────────────────────────────
  app.post("/api/int/eventos/:eventId/replay", ...auth, async (req: any, res) => {
    if (req.tenantRole !== 'admin' && !req.isMaster) {
      return res.status(403).json({ error: "admin_required" });
    }
    await pool.query(
      `UPDATE soe_events
       SET status = 'pending', attempts = 0, last_error = NULL,
           scheduled_at = NOW(), locked_until = NULL
       WHERE id = $1 AND tenant_id = $2`,
      [req.params.eventId, req.tenantId]
    );
    res.json({ ok: true, message: "Evento recolocado na fila." });
  });

  // ── Dashboard SOE consolidado ─────────────────────────────────────────────
  app.get("/api/int/dashboard", ...auth, async (req: any, res) => {
    try {
      const tenantId = req.tenantId;

      const [comRes, compRes, estRes, fiscRes] = await Promise.all([
        pool.query(
          `SELECT
             COALESCE(SUM(total_liquido) FILTER (
               WHERE status IN ('confirmado','aguardando_faturamento','faturado','concluido')
                 AND created_at >= DATE_TRUNC('month', NOW())
             ), 0) AS vendas_mes,
             COUNT(*) FILTER (WHERE status = 'aguardando_faturamento') AS pendentes_nfe
           FROM sale_orders WHERE tenant_id = $1`,
          [tenantId]
        ),
        pool.query(
          `SELECT
             COALESCE(SUM(valor_total) FILTER (
               WHERE status = 'aprovado'
                 AND created_at >= DATE_TRUNC('month', NOW())
             ), 0) AS compras_mes,
             COUNT(*) FILTER (WHERE manifestacao_status = 'pendente'
               AND data_emissao < CURRENT_DATE - 20) AS manifestacao_urgente
           FROM purchase_invoice_entries WHERE tenant_id = $1`,
          [tenantId]
        ),
        pool.query(
          `SELECT
             COUNT(DISTINCT produto_fiscal_id) AS total_produtos_com_saldo,
             COUNT(*) FILTER (WHERE total_disponivel <= estoque_minimo
               AND estoque_minimo > 0) AS abaixo_minimo
           FROM v_saldo_consolidado WHERE tenant_id = $1`,
          [tenantId]
        ),
        pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'autorizado'
               AND created_at >= DATE_TRUNC('month', NOW())) AS nfe_autorizadas_mes,
             COUNT(*) FILTER (WHERE status IN ('montado','transmitindo')) AS pendentes_sefaz
           FROM fiscal_documentos WHERE tenant_id = $1`,
          [tenantId]
        ),
      ]);

      res.json({
        ok: true,
        data: {
          comercial: comRes.rows[0],
          compras:   compRes.rows[0],
          estoque:   estRes.rows[0],
          fiscal:    fiscRes.rows[0],
        }
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}
