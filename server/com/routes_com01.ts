/**
 * COM-01 — routes_com01.ts
 * Endpoints REST do Módulo Comercial.
 */

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { pool } from "../../db/index";
import { soeContextFromReq } from "../soe/conventions";
import { runMigrationCom01 } from "./migration_com01";
import {
  criarSaleOrder, confirmarSaleOrder, solicitarFaturamento,
  cancelarSaleOrder, converterQuoteEmOrder,
} from "./comService";
import { gerarParcelas } from "../cad/cadService";

const auth = [isAuthenticated, tenantContext, requireTenant];

export function registerCom01Routes(app: Express): void {

  // ── Migration (master only) ────────────────────────────────────────────────
  app.post("/api/com/migrate", isAuthenticated, async (req: any, res) => {
    if (!req.isMaster) return res.status(403).json({ error: "master_required" });
    try {
      await runMigrationCom01();
      res.json({ ok: true, message: "COM-01 migration executada." });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PEDIDOS DE VENDA — sale_orders
  // ════════════════════════════════════════════════════════════════════════════

  // GET /api/com/pedidos
  app.get("/api/com/pedidos", ...auth, async (req: any, res) => {
    try {
      const {
        status, pessoaId, vendedorId, search,
        page = '1', limit = '50', dataInicio, dataFim,
      } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let q = `
        SELECT so.*,
               p.nome_fantasia AS pessoa_nome,
               u.first_name || ' ' || u.last_name AS vendedor_nome,
               COUNT(soi.id) AS qtd_itens
        FROM sale_orders so
        LEFT JOIN pessoas p ON p.id = so.pessoa_id
        LEFT JOIN users u   ON u.id = so.vendedor_id
        LEFT JOIN sale_order_items soi ON soi.sale_order_id = so.id
        WHERE so.tenant_id = $1`;
      const params: any[] = [req.tenantId];

      if (status)     q += ` AND so.status = $${params.push(status)}`;
      if (pessoaId)   q += ` AND so.pessoa_id = $${params.push(pessoaId)}`;
      if (vendedorId) q += ` AND so.vendedor_id = $${params.push(vendedorId)}`;
      if (dataInicio) q += ` AND so.created_at >= $${params.push(dataInicio)}`;
      if (dataFim)    q += ` AND so.created_at <= $${params.push(dataFim + 'T23:59:59Z')}`;
      if (search) {
        q += ` AND (so.numero ILIKE $${params.push('%' + search + '%')}
               OR p.nome_fantasia ILIKE $${params.push('%' + search + '%')})`;
      }

      q += ` GROUP BY so.id, p.nome_fantasia, u.first_name, u.last_name`;
      q += ` ORDER BY so.created_at DESC`;
      q += ` LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(offset)}`;

      const { rows } = await pool.query(q, params);
      res.json({ ok: true, data: rows, page: parseInt(page), limit: parseInt(limit) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /api/com/pedidos/:id
  app.get("/api/com/pedidos/:id", ...auth, async (req: any, res) => {
    try {
      const { rows: [order] } = await pool.query(
        `SELECT so.*,
                p.nome_fantasia AS pessoa_nome,
                p.cnpj_cpf, p.ie, p.contribuinte, p.tipo_pessoa,
                u.first_name || ' ' || u.last_name AS vendedor_nome,
                tp.nome AS tabela_preco_nome,
                cp.nome AS condicao_pagamento_nome
         FROM sale_orders so
         LEFT JOIN pessoas p ON p.id = so.pessoa_id
         LEFT JOIN users u   ON u.id = so.vendedor_id
         LEFT JOIN soe_tabelas_preco tp ON tp.id = so.tabela_preco_id
         LEFT JOIN soe_condicoes_pagamento cp ON cp.id = so.condicao_pagamento_id
         WHERE so.id = $1 AND so.tenant_id = $2`,
        [req.params.id, req.tenantId]
      );
      if (!order) return res.status(404).json({ ok: false, error: "Pedido não encontrado." });

      const { rows: itens } = await pool.query(
        `SELECT soi.*, pf.codigo AS produto_codigo
         FROM sale_order_items soi
         LEFT JOIN produto_fiscal pf ON pf.id = soi.produto_fiscal_id
         WHERE soi.sale_order_id = $1 ORDER BY soi.sequencia`,
        [req.params.id]
      );
      const { rows: parcelas } = await pool.query(
        `SELECT * FROM sale_order_installments WHERE sale_order_id = $1 ORDER BY parcela`,
        [req.params.id]
      );
      const { rows: eventos } = await pool.query(
        `SELECT * FROM sale_order_events WHERE sale_order_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [req.params.id]
      );

      res.json({ ok: true, data: { ...order, itens, parcelas, eventos } });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/com/pedidos
  app.post("/api/com/pedidos", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const result = await criarSaleOrder(ctx, req.body);
    if (!result.ok) return res.status(400).json(result);
    res.status(201).json(result);
  });

  // PATCH /api/com/pedidos/:id
  app.patch("/api/com/pedidos/:id", ...auth, async (req: any, res) => {
    try {
      const b = req.body;
      const { rows: [order] } = await pool.query(
        `SELECT status FROM sale_orders WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId]
      );
      if (!order) return res.status(404).json({ ok: false, error: "Pedido não encontrado." });
      if (!['rascunho', 'em_aprovacao'].includes(order.status)) {
        return res.status(409).json({
          ok: false,
          error: `Pedido no status '${order.status}' não pode ser editado.`
        });
      }

      await pool.query(
        `UPDATE sale_orders
         SET pessoa_id             = COALESCE($3, pessoa_id),
             vendedor_id           = COALESCE($4, vendedor_id),
             tabela_preco_id       = COALESCE($5, tabela_preco_id),
             condicao_pagamento_id = COALESCE($6, condicao_pagamento_id),
             desconto_global       = COALESCE($7, desconto_global),
             data_entrega_prevista = COALESCE($8, data_entrega_prevista),
             observacao_cliente    = COALESCE($9, observacao_cliente),
             observacao_interna    = COALESCE($10, observacao_interna),
             observacao_fiscal     = COALESCE($11, observacao_fiscal),
             updated_by_id         = $12,
             updated_at            = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [
          req.params.id, req.tenantId,
          b.pessoaId ?? null, b.vendedorId ?? null,
          b.tabelaPrecoId ?? null, b.condicaoPagamentoId ?? null,
          b.descontoGlobal ?? null, b.dataEntregaPrevista ?? null,
          b.observacaoCliente ?? null, b.observacaoInterna ?? null,
          b.observacaoFiscal ?? null,
          (req.user as any)?.id ?? 'system',
        ]
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/com/pedidos/:id/confirmar
  app.post("/api/com/pedidos/:id/confirmar", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const result = await confirmarSaleOrder(ctx, req.params.id);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  // POST /api/com/pedidos/:id/solicitar-faturamento
  app.post("/api/com/pedidos/:id/solicitar-faturamento", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const result = await solicitarFaturamento(ctx, req.params.id);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  // POST /api/com/pedidos/:id/cancelar
  app.post("/api/com/pedidos/:id/cancelar", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const { motivo } = req.body;
    const result = await cancelarSaleOrder(ctx, req.params.id, motivo);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  // POST /api/com/pedidos/:id/parcelas/recalcular
  app.post("/api/com/pedidos/:id/parcelas/recalcular", ...auth, async (req: any, res) => {
    try {
      const { rows: [order] } = await pool.query(
        `SELECT * FROM sale_orders WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId]
      );
      if (!order) return res.status(404).json({ ok: false, error: "Pedido não encontrado." });

      const condicaoId = req.body.condicaoPagamentoId ?? order.condicao_pagamento_id;
      if (!condicaoId) {
        return res.status(400).json({ ok: false, error: "Condição de pagamento não informada." });
      }

      const parcelasResult = await gerarParcelas(
        req.tenantId, condicaoId,
        parseFloat(order.total_liquido),
        req.body.dataBase ? new Date(req.body.dataBase) : undefined
      );
      if (!parcelasResult.ok) return res.status(400).json(parcelasResult);

      await pool.query(
        `DELETE FROM sale_order_installments WHERE sale_order_id = $1 AND status = 'pendente'`,
        [req.params.id]
      );
      for (const p of parcelasResult.data) {
        await pool.query(
          `INSERT INTO sale_order_installments
             (sale_order_id, parcela, total_parcelas, vencimento, valor, forma_pagamento, percentual)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [req.params.id, p.sequencia, parcelasResult.data.length,
           p.vencimento, p.valor.toFixed(2), p.formaPagamento, p.percentual]
        );
      }

      if (req.body.condicaoPagamentoId) {
        await pool.query(
          `UPDATE sale_orders SET condicao_pagamento_id = $2 WHERE id = $1`,
          [req.params.id, req.body.condicaoPagamentoId]
        );
      }

      res.json({ ok: true, data: parcelasResult.data });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ORÇAMENTOS — sale_quotes
  // ════════════════════════════════════════════════════════════════════════════

  // GET /api/com/orcamentos
  app.get("/api/com/orcamentos", ...auth, async (req: any, res) => {
    try {
      const { status, pessoaId, page = '1', limit = '50' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let q = `SELECT sq.*, p.nome_fantasia AS pessoa_nome
               FROM sale_quotes sq
               LEFT JOIN pessoas p ON p.id = sq.pessoa_id
               WHERE sq.tenant_id = $1`;
      const params: any[] = [req.tenantId];

      if (status)   q += ` AND sq.status = $${params.push(status)}`;
      if (pessoaId) q += ` AND sq.pessoa_id = $${params.push(pessoaId)}`;

      q += ` ORDER BY sq.created_at DESC LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(offset)}`;
      const { rows } = await pool.query(q, params);
      res.json({ ok: true, data: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/com/orcamentos
  app.post("/api/com/orcamentos", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      const b = req.body;

      const { rows: [numRow] } = await pool.query(
        `INSERT INTO soe_numeracao (tenant_id, empresa_id, tipo, proximo)
         VALUES ($1, $2, 'sale_quote', 2)
         ON CONFLICT (tenant_id, empresa_id, tipo)
         DO UPDATE SET proximo = soe_numeracao.proximo + 1
         RETURNING proximo - 1 AS numero`,
        [ctx.tenantId, b.empresaId ?? null]
      );
      const ano = new Date().getFullYear().toString().slice(-2);
      const numero = `ORC${ano}${String(numRow.numero).padStart(5, '0')}`;

      const subtotal = (b.itens ?? []).reduce((s: number, i: any) =>
        s + i.quantidade * i.precoUnitario - (i.descontoItem ?? 0), 0
      );
      const totalLiquido = Math.max(0, subtotal - (b.descontoGlobal ?? 0));

      const { rows: [quote] } = await pool.query(
        `INSERT INTO sale_quotes (
           tenant_id, empresa_id, numero, pessoa_id, vendedor_id,
           tabela_preco_id, condicao_pagamento_id, natureza_operacao_id,
           subtotal, desconto_global, total_liquido, validade,
           observacao_cliente, observacao_interna,
           origem_tipo, origem_ref_id,
           created_by_id, updated_by_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
         RETURNING *`,
        [
          ctx.tenantId, b.empresaId ?? null, numero,
          b.pessoaId ?? null, b.vendedorId ?? null,
          b.tabelaPrecoId ?? null, b.condicaoPagamentoId ?? null, b.naturezaOperacaoId ?? null,
          subtotal.toFixed(2), (b.descontoGlobal ?? 0).toFixed(2), totalLiquido.toFixed(2),
          b.validade ?? null,
          b.observacaoCliente ?? null, b.observacaoInterna ?? null,
          b.origemTipo ?? 'manual', b.origemRefId ?? null,
          ctx.userId,
        ]
      );

      for (const item of (b.itens ?? [])) {
        await pool.query(
          `INSERT INTO sale_quote_items (
             quote_id, sequencia, produto_fiscal_id, product_id,
             descricao_snapshot, ncm_snapshot, cfop_snapshot, cst_csosn_snapshot,
             unidade, quantidade, preco_unitario, desconto_item, total_item
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            quote.id, item.sequencia, item.produtoFiscalId ?? null, item.productId ?? null,
            item.descricao, item.ncm ?? null, item.cfop ?? null, item.cstCsosn ?? null,
            item.unidade, item.quantidade, item.precoUnitario,
            item.descontoItem ?? 0,
            (item.quantidade * item.precoUnitario - (item.descontoItem ?? 0)).toFixed(2),
          ]
        );
      }

      res.status(201).json({ ok: true, data: { id: quote.id, numero } });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // POST /api/com/orcamentos/:id/aceitar — marca aceito e converte em pedido
  app.post("/api/com/orcamentos/:id/aceitar", ...auth, async (req: any, res) => {
    try {
      await pool.query(
        `UPDATE sale_quotes SET status = 'aceito', aceito_em = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId]
      );
      const ctx = soeContextFromReq(req);
      const result = await converterQuoteEmOrder(ctx, req.params.id);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Dashboard comercial ────────────────────────────────────────────────────
  app.get("/api/com/dashboard", ...auth, async (req: any, res) => {
    try {
      const { rows: [resumo] } = await pool.query(
        `SELECT
           COUNT(*)                                                    AS total_pedidos,
           COUNT(*) FILTER (WHERE status = 'rascunho')                AS rascunhos,
           COUNT(*) FILTER (WHERE status = 'confirmado')              AS confirmados,
           COUNT(*) FILTER (WHERE status = 'aguardando_faturamento')  AS aguardando_faturamento,
           COUNT(*) FILTER (WHERE status = 'faturado')                AS faturados,
           COUNT(*) FILTER (WHERE status = 'cancelado')               AS cancelados,
           COALESCE(SUM(total_liquido) FILTER (
             WHERE status IN ('confirmado','aguardando_faturamento','faturado')
               AND created_at >= DATE_TRUNC('month', NOW())
           ), 0)                                                       AS faturamento_mes,
           COALESCE(SUM(total_liquido) FILTER (
             WHERE status IN ('confirmado','aguardando_faturamento')
           ), 0)                                                       AS pipeline_valor
         FROM sale_orders WHERE tenant_id = $1`,
        [req.tenantId]
      );

      const { rows: urgentes } = await pool.query(
        `SELECT so.id, so.numero, so.invoice_requested_at,
                p.nome_fantasia AS pessoa_nome, so.total_liquido
         FROM sale_orders so
         LEFT JOIN pessoas p ON p.id = so.pessoa_id
         WHERE so.tenant_id = $1
           AND so.status = 'aguardando_faturamento'
           AND so.invoice_requested_at < NOW() - INTERVAL '20 hours'
         ORDER BY so.invoice_requested_at ASC`,
        [req.tenantId]
      );

      res.json({ ok: true, data: { resumo, alertas: { urgentes_faturamento: urgentes } } });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}
