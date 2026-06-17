/**
 * COM-01 — comService.ts
 * Serviços de domínio do Módulo Comercial do SOE.
 */

import { pool } from "../../db/index";
import {
  withTransaction, ok, err, assertTenantId, auditLog,
  type SoeContext, type SoeResult,
} from "../soe/conventions";
import { publishEvent } from "../soe/eventBus";
import { gerarParcelas } from "../cad/cadService";
import { gerarLancamentoReceber, resolveClienteControlId } from "../control/arService";
import type { PoolClient } from "pg";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SaleOrderItemInput {
  sequencia:         number;
  produtoFiscalId?:  string;
  productId?:        number;
  descricao:         string;
  ncm?:              string;
  cfop?:             string;
  cstCsosn?:         string;
  unidade:           string;
  quantidade:        number;
  precoUnitario:     number;
  descontoItem?:     number;
  percIcms?:         number;
  baseCalcIcms?:     number;
  valorIcms?:        number;
  percPis?:          number;
  percCofins?:       number;
}

export interface CriarSaleOrderInput {
  empresaId?:             number;
  pessoaId?:              string;
  vendedorId?:            string;
  tabelaPrecoId?:         string;
  condicaoPagamentoId?:   string;
  naturezaOperacaoId?:    number;
  descontoGlobal?:        number;
  dataEntregaPrevista?:   string;
  observacaoCliente?:     string;
  observacaoInterna?:     string;
  observacaoFiscal?:      string;
  origemTipo?:            string;
  origemRefId?:           string;
  quoteId?:               string;
  itens:                  SaleOrderItemInput[];
}

// ─── Numeração atômica ────────────────────────────────────────────────────────

export async function gerarNumeroPedido(
  client:    PoolClient,
  tenantId:  string,
  tipo:      'sale_order' | 'sale_quote' | 'purchase_order',
  empresaId?: number
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO soe_numeracao (tenant_id, empresa_id, tipo, proximo)
     VALUES ($1, $2, $3, 2)
     ON CONFLICT (tenant_id, empresa_id, tipo) DO UPDATE
       SET proximo = soe_numeracao.proximo + 1
     RETURNING proximo - 1 AS numero, prefixo`,
    [tenantId, empresaId ?? null, tipo]
  );
  const { numero, prefixo } = rows[0];
  const ano = new Date().getFullYear().toString().slice(-2);
  const seq = String(numero).padStart(5, '0');
  return `${prefixo || ''}${ano}${seq}`;
}

// ─── Criar pedido ─────────────────────────────────────────────────────────────

export async function criarSaleOrder(
  ctx:   SoeContext,
  input: CriarSaleOrderInput
): Promise<SoeResult<{ id: string; numero: string }>> {
  assertTenantId(ctx.tenantId, "criarSaleOrder");

  if (!input.itens?.length) {
    return err("Pedido deve ter pelo menos 1 item.", "REQUIRED_ITEMS");
  }

  return withTransaction(async (client) => {
    const numero = await gerarNumeroPedido(
      client, ctx.tenantId, 'sale_order', input.empresaId
    );

    const subtotal = input.itens.reduce((s, i) =>
      s + i.quantidade * i.precoUnitario - (i.descontoItem ?? 0), 0
    );
    const desconto = input.descontoGlobal ?? 0;
    const totalLiquido = Math.max(0, subtotal - desconto);

    const { rows: [order] } = await client.query(
      `INSERT INTO sale_orders (
         tenant_id, empresa_id, numero, pessoa_id, vendedor_id,
         tabela_preco_id, condicao_pagamento_id, natureza_operacao_id,
         subtotal, desconto_global, total_liquido,
         data_entrega_prevista,
         observacao_cliente, observacao_interna, observacao_fiscal,
         origem_tipo, origem_ref_id, quote_id,
         status, created_by_id, updated_by_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'rascunho',$19,$19)
       RETURNING *`,
      [
        ctx.tenantId, input.empresaId ?? null, numero,
        input.pessoaId ?? null, input.vendedorId ?? null,
        input.tabelaPrecoId ?? null, input.condicaoPagamentoId ?? null,
        input.naturezaOperacaoId ?? null,
        subtotal.toFixed(2), desconto.toFixed(2), totalLiquido.toFixed(2),
        input.dataEntregaPrevista ?? null,
        input.observacaoCliente ?? null,
        input.observacaoInterna ?? null,
        input.observacaoFiscal ?? null,
        input.origemTipo ?? 'manual',
        input.origemRefId ?? null,
        input.quoteId ?? null,
        ctx.userId,
      ]
    );

    for (const item of input.itens) {
      const totalItem = item.quantidade * item.precoUnitario - (item.descontoItem ?? 0);
      await client.query(
        `INSERT INTO sale_order_items (
           sale_order_id, sequencia, produto_fiscal_id, product_id,
           descricao_snapshot, ncm_snapshot, cfop_snapshot, cst_csosn_snapshot,
           unidade, quantidade, preco_unitario, desconto_item, total_item,
           perc_icms, base_calc_icms, valor_icms, perc_pis, perc_cofins
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          order.id, item.sequencia,
          item.produtoFiscalId ?? null, item.productId ?? null,
          item.descricao,
          item.ncm ?? null, item.cfop ?? null, item.cstCsosn ?? null,
          item.unidade,
          item.quantidade, item.precoUnitario,
          item.descontoItem ?? 0, totalItem.toFixed(2),
          item.percIcms ?? 0, item.baseCalcIcms ?? totalItem,
          item.valorIcms ?? 0, item.percPis ?? 0, item.percCofins ?? 0,
        ]
      );
    }

    if (input.condicaoPagamentoId && totalLiquido > 0) {
      const parcelasResult = await gerarParcelas(
        ctx.tenantId, input.condicaoPagamentoId, totalLiquido
      );
      if (parcelasResult.ok) {
        for (const p of parcelasResult.data) {
          await client.query(
            `INSERT INTO sale_order_installments
               (sale_order_id, parcela, total_parcelas, vencimento, valor,
                forma_pagamento, percentual, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'pendente')`,
            [
              order.id, p.sequencia, parcelasResult.data.length,
              p.vencimento, p.valor.toFixed(2),
              p.formaPagamento, p.percentual,
            ]
          );
        }
      }
    }

    await registrarEventoInterno(client, {
      saleOrderId: order.id, tenantId: ctx.tenantId,
      tipo: 'status_changed', statusDe: null, statusPara: 'rascunho',
      descricao: `Pedido ${numero} criado.`, usuarioId: ctx.userId,
    });

    await auditLog(client, {
      ctx, entityType: 'sale_order', entityId: order.id,
      action: 'created', afterState: { numero, status: 'rascunho', totalLiquido },
    });

    return ok({ id: order.id, numero });
  });
}

// ─── Confirmar pedido ─────────────────────────────────────────────────────────

export async function confirmarSaleOrder(
  ctx:          SoeContext,
  orderId:      string,
  aprovadoPor?: string
): Promise<SoeResult<{ id: string; numero: string }>> {
  return withTransaction(async (client) => {
    const { rows: [order] } = await client.query(
      `SELECT * FROM sale_orders WHERE id = $1 AND tenant_id = $2`,
      [orderId, ctx.tenantId]
    );
    if (!order) return err("Pedido não encontrado.", "NOT_FOUND");
    if (!['rascunho', 'em_aprovacao'].includes(order.status)) {
      return err(`Pedido não pode ser confirmado no status '${order.status}'.`, "INVALID_STATUS");
    }

    await client.query(
      `UPDATE sale_orders
       SET status          = 'confirmado',
           aprovado_por_id = $3,
           aprovado_em     = $4,
           updated_by_id   = $5,
           updated_at      = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [orderId, ctx.tenantId, aprovadoPor ?? ctx.userId, new Date(), ctx.userId]
    );

    const parcelas = await client.query(
      `SELECT * FROM sale_order_installments WHERE sale_order_id = $1 ORDER BY parcela`,
      [orderId]
    );
    await publishEvent(client, {
      tenantId:      ctx.tenantId,
      eventType:     'sale_order.confirmed',
      aggregateType: 'sale_order',
      aggregateId:   orderId,
      payload: {
        orderId, numero: order.numero,
        pessoaId:     order.pessoa_id,
        empresaId:    order.empresa_id,
        totalLiquido: parseFloat(order.total_liquido),
        parcelas:     parcelas.rows,
        condicaoPagamentoId: order.condicao_pagamento_id,
      },
      createdById: ctx.userId,
    });

    await registrarEventoInterno(client, {
      saleOrderId: orderId, tenantId: ctx.tenantId,
      tipo: 'status_changed', statusDe: order.status, statusPara: 'confirmado',
      descricao: 'Pedido confirmado.', usuarioId: ctx.userId,
    });

    await auditLog(client, {
      ctx, entityType: 'sale_order', entityId: orderId,
      action: 'status_changed',
      beforeState: { status: order.status },
      afterState:  { status: 'confirmado' },
    });

    return ok({ id: orderId, numero: order.numero });
  });
}

// ─── Solicitar faturamento (Manus §5.3) ──────────────────────────────────────

export async function solicitarFaturamento(
  ctx:     SoeContext,
  orderId: string
): Promise<SoeResult<{ id: string }>> {
  return withTransaction(async (client) => {
    const { rows: [order] } = await client.query(
      `SELECT * FROM sale_orders WHERE id = $1 AND tenant_id = $2`,
      [orderId, ctx.tenantId]
    );
    if (!order) return err("Pedido não encontrado.", "NOT_FOUND");
    if (order.status !== 'confirmado') {
      return err(
        `Faturamento só pode ser solicitado para pedidos confirmados (status atual: '${order.status}').`,
        "INVALID_STATUS"
      );
    }

    await client.query(
      `UPDATE sale_orders
       SET status               = 'aguardando_faturamento',
           invoice_requested_at = NOW(),
           invoice_requested_by = $3,
           updated_by_id        = $3,
           updated_at           = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [orderId, ctx.tenantId, ctx.userId]
    );

    await publishEvent(client, {
      tenantId:      ctx.tenantId,
      eventType:     'sale_order.invoice_requested',
      aggregateType: 'sale_order',
      aggregateId:   orderId,
      payload:       { orderId, numero: order.numero, requestedBy: ctx.userId },
      createdById:   ctx.userId,
    });

    await registrarEventoInterno(client, {
      saleOrderId: orderId, tenantId: ctx.tenantId,
      tipo: 'invoice_requested',
      statusDe: 'confirmado', statusPara: 'aguardando_faturamento',
      descricao: 'Faturamento solicitado — aguardando emissão de NF-e.',
      usuarioId: ctx.userId,
    });

    return ok({ id: orderId });
  });
}

// ─── Marcar como faturado ─────────────────────────────────────────────────────

export async function marcarFaturado(
  ctx:         SoeContext,
  orderId:     string,
  fiscalDocId: string,
  faturadoEm:  Date
): Promise<SoeResult<{ id: string }>> {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE sale_orders
       SET status        = 'faturado',
           fiscal_doc_id = $3,
           faturado_em   = $4,
           updated_by_id = $5,
           updated_at    = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [orderId, ctx.tenantId, fiscalDocId, faturadoEm, ctx.userId]
    );

    await publishEvent(client, {
      tenantId:      ctx.tenantId,
      eventType:     'sale_order.invoiced',
      aggregateType: 'sale_order',
      aggregateId:   orderId,
      payload:       { orderId, fiscalDocId },
      createdById:   ctx.userId,
    });

    await registrarEventoInterno(client, {
      saleOrderId: orderId, tenantId: ctx.tenantId,
      tipo: 'invoice_generated',
      statusDe: 'aguardando_faturamento', statusPara: 'faturado',
      descricao: `NF-e autorizada. Documento: ${fiscalDocId}.`,
      usuarioId: ctx.userId,
    });

    return ok({ id: orderId });
  });
}

// ─── Cancelar pedido ──────────────────────────────────────────────────────────

export async function cancelarSaleOrder(
  ctx:     SoeContext,
  orderId: string,
  motivo:  string
): Promise<SoeResult<{ id: string }>> {
  if (!motivo?.trim()) {
    return err("Motivo de cancelamento é obrigatório.", "REQUIRED_FIELD");
  }

  return withTransaction(async (client) => {
    const { rows: [order] } = await client.query(
      `SELECT * FROM sale_orders WHERE id = $1 AND tenant_id = $2`,
      [orderId, ctx.tenantId]
    );
    if (!order) return err("Pedido não encontrado.", "NOT_FOUND");
    if (['faturado', 'cancelado', 'concluido'].includes(order.status)) {
      return err(`Pedido no status '${order.status}' não pode ser cancelado.`, "INVALID_STATUS");
    }

    await client.query(
      `UPDATE sale_orders
       SET status              = 'cancelado',
           cancelado_por_id    = $3,
           cancelado_em        = NOW(),
           motivo_cancelamento = $4,
           updated_by_id       = $3,
           updated_at          = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [orderId, ctx.tenantId, ctx.userId, motivo]
    );

    await client.query(
      `UPDATE sale_order_installments SET status = 'cancelado'
       WHERE sale_order_id = $1 AND status = 'pendente'`,
      [orderId]
    );

    await publishEvent(client, {
      tenantId:      ctx.tenantId,
      eventType:     'sale_order.cancelled',
      aggregateType: 'sale_order',
      aggregateId:   orderId,
      payload:       { orderId, numero: order.numero, motivo, pessoaId: order.pessoa_id },
      createdById:   ctx.userId,
    });

    await registrarEventoInterno(client, {
      saleOrderId: orderId, tenantId: ctx.tenantId,
      tipo: 'cancelled', statusDe: order.status, statusPara: 'cancelado',
      descricao: `Pedido cancelado. Motivo: ${motivo}`,
      usuarioId: ctx.userId, payload: { motivo },
    });

    return ok({ id: orderId });
  });
}

// ─── Converter orçamento em pedido ────────────────────────────────────────────

export async function converterQuoteEmOrder(
  ctx:     SoeContext,
  quoteId: string
): Promise<SoeResult<{ orderId: string; numero: string }>> {
  return withTransaction(async (client) => {
    const { rows: [quote] } = await client.query(
      `SELECT * FROM sale_quotes WHERE id = $1 AND tenant_id = $2`,
      [quoteId, ctx.tenantId]
    );
    if (!quote) return err("Orçamento não encontrado.", "NOT_FOUND");
    if (quote.status !== 'aceito') {
      return err(
        `Orçamento no status '${quote.status}' — apenas aceitos podem ser convertidos.`,
        "INVALID_STATUS"
      );
    }
    if (quote.convertido_em_pedido_id) {
      return err("Orçamento já foi convertido em pedido.", "ALREADY_CONVERTED");
    }

    const { rows: quoteItems } = await client.query(
      `SELECT * FROM sale_quote_items WHERE quote_id = $1 ORDER BY sequencia`,
      [quoteId]
    );

    const numero = await gerarNumeroPedido(client, ctx.tenantId, 'sale_order', quote.empresa_id);

    const { rows: [order] } = await client.query(
      `INSERT INTO sale_orders (
         tenant_id, empresa_id, numero, quote_id, origem_tipo, origem_ref_id,
         pessoa_id, vendedor_id, tabela_preco_id, condicao_pagamento_id,
         natureza_operacao_id, subtotal, desconto_global, total_liquido,
         observacao_cliente, observacao_interna,
         status, created_by_id, updated_by_id
       ) VALUES ($1,$2,$3,$4,'sale_quote',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'rascunho',$15,$15)
       RETURNING *`,
      [
        ctx.tenantId, quote.empresa_id, numero, quoteId,
        quote.pessoa_id, quote.vendedor_id,
        quote.tabela_preco_id, quote.condicao_pagamento_id, quote.natureza_operacao_id,
        quote.subtotal, quote.desconto_global, quote.total_liquido,
        quote.observacao_cliente, quote.observacao_interna,
        ctx.userId,
      ]
    );

    for (const qi of quoteItems) {
      await client.query(
        `INSERT INTO sale_order_items (
           sale_order_id, sequencia, produto_fiscal_id, product_id,
           descricao_snapshot, ncm_snapshot, cfop_snapshot, cst_csosn_snapshot,
           unidade, quantidade, preco_unitario, desconto_item, total_item
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          order.id, qi.sequencia, qi.produto_fiscal_id, qi.product_id,
          qi.descricao_snapshot, qi.ncm_snapshot, qi.cfop_snapshot, qi.cst_csosn_snapshot,
          qi.unidade, qi.quantidade, qi.preco_unitario, qi.desconto_item, qi.total_item,
        ]
      );
    }

    await client.query(
      `UPDATE sale_quotes SET convertido_em_pedido_id = $2, updated_at = NOW() WHERE id = $1`,
      [quoteId, order.id]
    );

    return ok({ orderId: order.id, numero });
  });
}

// ─── Consumer: sale_order.confirmed → gerar AR no Control ────────────────────

export async function handleSaleOrderConfirmed(event: any): Promise<void> {
  const { orderId, pessoaId, totalLiquido, parcelas, numero } = event.payload;
  const tenantId = event.tenantId;

  if (!parcelas?.length || totalLiquido <= 0) return;
  if (!pessoaId) return;

  try {
    const clienteControlId = await resolveClienteControlId(pessoaId, tenantId);
    if (!clienteControlId) return;

    for (const parcela of parcelas) {
      const arResult = await gerarLancamentoReceber({
        tenantId,
        clienteControlId,
        pessoaId,
        descricao:      `Venda ${numero} — parcela ${parcela.parcela}/${parcela.total_parcelas}`,
        valor:           parseFloat(parcela.valor),
        dataVencimento:  parcela.vencimento,
        origemRefTipo:   'venda',
        origemRefId:     `${orderId}-p${parcela.parcela}`,
        criadoPor:       event.createdById ?? 'system',
      });

      if (arResult.ok && arResult.lancamentos?.[0]) {
        await pool.query(
          `UPDATE sale_order_installments
           SET status = 'gerado_ar', lancamento_receber_id = $2
           WHERE sale_order_id = $3 AND parcela = $4`,
          [
            arResult.lancamentos[0].id,
            arResult.lancamentos[0].id,
            orderId,
            parcela.parcela,
          ]
        );
      }
    }
  } catch (e: any) {
    console.error(`[COM-01] Erro ao gerar AR para pedido ${orderId}:`, e.message);
    throw e;
  }
}

// ─── Helper interno ───────────────────────────────────────────────────────────

async function registrarEventoInterno(
  client: PoolClient,
  params: {
    saleOrderId: string;
    tenantId:    string;
    tipo:        string;
    statusDe?:   string | null;
    statusPara?: string | null;
    descricao?:  string;
    usuarioId?:  string;
    payload?:    Record<string, any>;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO sale_order_events
       (sale_order_id, tenant_id, tipo, status_de, status_para, descricao, payload, usuario_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      params.saleOrderId, params.tenantId, params.tipo,
      params.statusDe ?? null, params.statusPara ?? null,
      params.descricao ?? null,
      JSON.stringify(params.payload ?? {}),
      params.usuarioId ?? null,
    ]
  );
}
