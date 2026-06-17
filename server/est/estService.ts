/**
 * EST-01 — estService.ts
 * Serviços de domínio do Estoque Core do SOE.
 */

import { pool } from "../../db/index";
import { withTransaction, ok, err, assertTenantId, type SoeResult } from "../soe/conventions";
import { publishEvent } from "../soe/eventBus";
import { atualizarCustoMedio } from "../cad/cadService";
import type { PoolClient } from "pg";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MovimentoInput {
  tenantId:         string;
  depositoId:       string;
  produtoFiscalId?: string;
  productId?:       number;
  lotId?:           string;
  quantidade:       number;
  custoUnitario?:   number;
  origemTipo?:      string;
  origemRefId?:     string;
  documentoNumero?: string;
  documentoChave?:  string;
  justificativa?:   string;
  criadoPorId?:     string;
}

export interface ReservaInput {
  tenantId:         string;
  depositoId:       string;
  produtoFiscalId?: string;
  productId?:       number;
  saleOrderId:      string;
  saleOrderItemId?: string;
  quantidade:       number;
}

// ─── Movimento físico (entrada) ───────────────────────────────────────────────

export async function registrarEntrada(
  input: MovimentoInput
): Promise<SoeResult<{ movimentoId: string; saldoNovo: number }>> {
  if (input.quantidade <= 0) {
    return err("Quantidade de entrada deve ser positiva.", "INVALID_QTY");
  }
  return _registrarMovimento('entrada', input);
}

// ─── Movimento físico (saída) ─────────────────────────────────────────────────

export async function registrarSaida(
  input: MovimentoInput
): Promise<SoeResult<{ movimentoId: string; saldoNovo: number }>> {
  if (input.quantidade <= 0) {
    return err("Quantidade de saída deve ser positiva.", "INVALID_QTY");
  }
  return _registrarMovimento('saida', input);
}

// ─── Núcleo do movimento físico ───────────────────────────────────────────────

async function _registrarMovimento(
  direcao: 'entrada' | 'saida',
  input:   MovimentoInput
): Promise<SoeResult<{ movimentoId: string; saldoNovo: number }>> {
  assertTenantId(input.tenantId, "_registrarMovimento");

  return withTransaction(async (client) => {
    const saldoAtual = await _buscarOuCriarSaldo(client, input);
    const quantFisica = parseFloat(saldoAtual.quantidade_fisica ?? '0');
    const qtd = input.quantidade;

    if (direcao === 'saida') {
      const deposito = await client.query(
        `SELECT permite_estoque_negativo FROM depositos WHERE id = $1`,
        [input.depositoId]
      );
      const permiteNeg = deposito.rows[0]?.permite_estoque_negativo ?? false;
      if (!permiteNeg && quantFisica < qtd) {
        return err(
          `Saldo insuficiente. Disponível: ${quantFisica}, Solicitado: ${qtd}.`,
          "INSUFFICIENT_STOCK"
        );
      }
    }

    const saldoAnterior = quantFisica;
    const saldoNovo = direcao === 'entrada' ? quantFisica + qtd : quantFisica - qtd;

    const { rows: [mov] } = await client.query(
      `INSERT INTO inventory_movements_core (
         tenant_id, deposito_id, produto_fiscal_id, product_id, lot_id,
         tipo_movimento, origem_tipo, origem_ref_id,
         quantidade, custo_unitario,
         saldo_anterior, saldo_posterior,
         documento_numero, documento_chave,
         criado_por_id, justificativa
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        input.tenantId, input.depositoId,
        input.produtoFiscalId ?? null, input.productId ?? null, input.lotId ?? null,
        input.origemTipo ?? (direcao === 'entrada' ? 'entrada_manual' : 'saida_manual'),
        input.origemTipo ?? null, input.origemRefId ?? null,
        direcao === 'entrada' ? qtd : -qtd,
        input.custoUnitario ?? null,
        saldoAnterior, saldoNovo,
        input.documentoNumero ?? null, input.documentoChave ?? null,
        input.criadoPorId ?? null, input.justificativa ?? null,
      ]
    );

    await client.query(
      `UPDATE saldos_produto
       SET quantidade_fisica  = $3,
           custo_medio        = CASE WHEN $4::numeric > 0
                                     THEN $4 ELSE custo_medio END,
           last_movement_at   = NOW(),
           updated_at         = NOW()
       WHERE deposito_id = $1
         AND COALESCE(produto_fiscal_id,'') = COALESCE($2::varchar,'')
         AND COALESCE(product_id, -1) = COALESCE($5::integer, -1)
         AND lot_id IS NOT DISTINCT FROM $6`,
      [
        input.depositoId,
        input.produtoFiscalId ?? null,
        saldoNovo,
        input.custoUnitario ?? null,
        input.productId ?? null,
        input.lotId ?? null,
      ]
    );

    if (direcao === 'entrada' && input.custoUnitario && input.produtoFiscalId) {
      await atualizarCustoMedio(
        input.produtoFiscalId, input.tenantId,
        saldoAnterior, parseFloat(saldoAtual.custo_medio ?? '0'),
        qtd, input.custoUnitario
      );
    }

    if (input.lotId) {
      const campo = direcao === 'entrada' ? 'quantidade_entrada' : 'quantidade_saida';
      await client.query(
        `UPDATE inventory_lots SET ${campo} = ${campo} + $2, updated_at = NOW()
         WHERE id = $1`,
        [input.lotId, qtd]
      );
    }

    await publishEvent(client, {
      tenantId:      input.tenantId,
      eventType:     direcao === 'entrada' ? 'stock.entry_posted' : 'stock.exit_posted',
      aggregateType: 'inventory_movement',
      aggregateId:   mov.id,
      payload:       {
        movimentoId:      mov.id,
        depositoId:       input.depositoId,
        produtoFiscalId:  input.produtoFiscalId,
        productId:        input.productId,
        quantidade:       direcao === 'entrada' ? qtd : -qtd,
        saldoNovo,
        origemTipo:       input.origemTipo,
        origemRefId:      input.origemRefId,
      },
      createdById: input.criadoPorId,
    });

    if (direcao === 'saida' && input.produtoFiscalId) {
      const { rows: [pf] } = await client.query(
        `SELECT estoque_minimo FROM produto_fiscal WHERE id = $1`,
        [input.produtoFiscalId]
      );
      if (pf && saldoNovo <= parseFloat(pf.estoque_minimo ?? '0')) {
        await publishEvent(client, {
          tenantId:      input.tenantId,
          eventType:     'stock.low_balance',
          aggregateType: 'produto_fiscal',
          aggregateId:   input.produtoFiscalId,
          payload:       {
            produtoFiscalId: input.produtoFiscalId,
            saldoAtual: saldoNovo,
            estoqueMinimo: parseFloat(pf.estoque_minimo),
          },
          createdById: input.criadoPorId,
        });
      }
    }

    return ok({ movimentoId: mov.id, saldoNovo });
  });
}

// ─── Reserva (não é movimento físico) ────────────────────────────────────────

export async function criarReserva(
  input: ReservaInput
): Promise<SoeResult<{ reservaId: string }>> {
  return withTransaction(async (client) => {
    const saldo = await _buscarSaldoRaw(client, input);
    const disponivel = parseFloat(saldo?.quantidade_disponivel ?? '0');

    if (disponivel < input.quantidade) {
      return err(
        `Saldo disponível insuficiente para reserva. Disponível: ${disponivel}, Necessário: ${input.quantidade}.`,
        "INSUFFICIENT_STOCK"
      );
    }

    const { rows: [res] } = await client.query(
      `INSERT INTO inventory_reservations
         (tenant_id, deposito_id, produto_fiscal_id, product_id, lot_id,
          sale_order_id, sale_order_item_id, quantidade, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ativa')
       RETURNING id`,
      [
        input.tenantId, input.depositoId,
        input.produtoFiscalId ?? null, input.productId ?? null, null,
        input.saleOrderId, input.saleOrderItemId ?? null,
        input.quantidade,
      ]
    );

    await client.query(
      `UPDATE saldos_produto
       SET quantidade_reservada = quantidade_reservada + $3, updated_at = NOW()
       WHERE deposito_id = $1
         AND COALESCE(produto_fiscal_id,'') = COALESCE($2::varchar,'')`,
      [input.depositoId, input.produtoFiscalId ?? null, input.quantidade]
    );

    return ok({ reservaId: res.id });
  });
}

export async function liberarReserva(
  tenantId:    string,
  saleOrderId: string
): Promise<void> {
  await withTransaction(async (client) => {
    const { rows: reservas } = await client.query(
      `SELECT * FROM inventory_reservations
       WHERE sale_order_id = $1 AND tenant_id = $2 AND status = 'ativa'`,
      [saleOrderId, tenantId]
    );

    for (const r of reservas) {
      await client.query(
        `UPDATE saldos_produto
         SET quantidade_reservada = GREATEST(0, quantidade_reservada - $3),
             updated_at = NOW()
         WHERE deposito_id = $1
           AND COALESCE(produto_fiscal_id,'') = COALESCE($2::varchar,'')`,
        [r.deposito_id, r.produto_fiscal_id, r.quantidade]
      );
    }

    await client.query(
      `UPDATE inventory_reservations
       SET status = 'cancelada', cancelado_em = NOW()
       WHERE sale_order_id = $1 AND tenant_id = $2 AND status = 'ativa'`,
      [saleOrderId, tenantId]
    );

    return ok(null);
  });
}

export async function converterReservasEmSaida(
  tenantId:    string,
  saleOrderId: string,
  userId?:     string
): Promise<void> {
  const { rows: reservas } = await pool.query(
    `SELECT * FROM inventory_reservations
     WHERE sale_order_id = $1 AND tenant_id = $2 AND status = 'ativa'`,
    [saleOrderId, tenantId]
  );

  for (const r of reservas) {
    const result = await registrarSaida({
      tenantId,
      depositoId:      r.deposito_id,
      produtoFiscalId: r.produto_fiscal_id,
      productId:       r.product_id,
      lotId:           r.lot_id,
      quantidade:      parseFloat(r.quantidade),
      origemTipo:      'saida_venda',
      origemRefId:     saleOrderId,
      criadoPorId:     userId,
    });

    if (result.ok) {
      await pool.query(
        `UPDATE inventory_reservations
         SET status = 'convertida', convertido_em = NOW(), movement_id = $2
         WHERE id = $1`,
        [r.id, result.data.movimentoId]
      );
      await pool.query(
        `UPDATE saldos_produto
         SET quantidade_reservada = GREATEST(0, quantidade_reservada - $3),
             updated_at = NOW()
         WHERE deposito_id = $1
           AND COALESCE(produto_fiscal_id,'') = COALESCE($2::varchar,'')`,
        [r.deposito_id, r.produto_fiscal_id, parseFloat(r.quantidade)]
      );
    }
  }
}

// ─── Consultas de saldo ───────────────────────────────────────────────────────

export async function buscarSaldo(
  tenantId:         string,
  depositoId:       string,
  produtoFiscalId?: string,
  productId?:       number
): Promise<{
  quantidadeFisica:    number;
  quantidadeReservada: number;
  quantidadeDisponivel: number;
  custoMedio:          number;
} | null> {
  const { rows: [row] } = await pool.query(
    `SELECT * FROM saldos_produto
     WHERE deposito_id = $1
       AND tenant_id = $2
       AND (
         ($3::varchar IS NOT NULL AND produto_fiscal_id = $3)
         OR ($4::integer IS NOT NULL AND product_id = $4)
       )
     LIMIT 1`,
    [depositoId, tenantId, produtoFiscalId ?? null, productId ?? null]
  );
  if (!row) return null;
  return {
    quantidadeFisica:    parseFloat(row.quantidade_fisica),
    quantidadeReservada: parseFloat(row.quantidade_reservada),
    quantidadeDisponivel: parseFloat(row.quantidade_disponivel),
    custoMedio:          parseFloat(row.custo_medio ?? '0'),
  };
}

export async function buscarSaldoConsolidado(
  tenantId:        string,
  produtoFiscalId: string
): Promise<{ totalFisico: number; totalDisponivel: number; totalReservado: number }> {
  const { rows: [row] } = await pool.query(
    `SELECT
       SUM(quantidade_fisica)    AS total_fisico,
       SUM(quantidade_disponivel) AS total_disponivel,
       SUM(quantidade_reservada) AS total_reservado
     FROM saldos_produto
     WHERE tenant_id = $1 AND produto_fiscal_id = $2`,
    [tenantId, produtoFiscalId]
  );
  return {
    totalFisico:     parseFloat(row?.total_fisico     ?? '0'),
    totalDisponivel: parseFloat(row?.total_disponivel ?? '0'),
    totalReservado:  parseFloat(row?.total_reservado  ?? '0'),
  };
}

// ─── Consumers de eventos SOE ─────────────────────────────────────────────────

export async function handleSaleOrderConfirmed_Est(event: any): Promise<void> {
  const { orderId, empresaId } = event.payload;
  const tenantId = event.tenantId;

  const { rows: [deposito] } = await pool.query(
    `SELECT id FROM depositos
     WHERE tenant_id = $1
       AND (empresa_id = $2 OR empresa_id IS NULL)
       AND padrao = true AND status = 'ativo'
     ORDER BY empresa_id DESC NULLS LAST
     LIMIT 1`,
    [tenantId, empresaId ?? null]
  );
  if (!deposito) return;

  const { rows: itens } = await pool.query(
    `SELECT * FROM sale_order_items WHERE sale_order_id = $1`,
    [orderId]
  );

  for (const item of itens) {
    if (!item.produto_fiscal_id && !item.product_id) continue;

    const reservaResult = await criarReserva({
      tenantId,
      depositoId:      deposito.id,
      produtoFiscalId: item.produto_fiscal_id,
      productId:       item.product_id,
      saleOrderId:     orderId,
      saleOrderItemId: item.id,
      quantidade:      parseFloat(item.quantidade),
    });

    if (!reservaResult.ok) {
      console.warn(`[EST-01] Reserva falhou para item ${item.id}: ${reservaResult.error}`);
    }
  }
}

export async function handleSaleOrderInvoiced(event: any): Promise<void> {
  await converterReservasEmSaida(
    event.tenantId, event.payload.orderId, event.createdById
  );
}

export async function handleSaleOrderCancelled_Est(event: any): Promise<void> {
  await liberarReserva(event.tenantId, event.payload.orderId);
}

export async function handlePurchaseInvoiceApproved_Est(event: any): Promise<void> {
  const { entradaId, itens, depositoId } = event.payload;
  const tenantId = event.tenantId;

  for (const item of (itens ?? [])) {
    if (!item.produtoFiscalId && !item.productId) continue;
    await registrarEntrada({
      tenantId,
      depositoId: depositoId ?? '',
      produtoFiscalId: item.produtoFiscalId,
      productId:       item.productId,
      quantidade:      parseFloat(item.quantidade),
      custoUnitario:   item.custoUnitario ? parseFloat(item.custoUnitario) : undefined,
      origemTipo:      'entrada_compra',
      origemRefId:     entradaId,
      documentoNumero: item.documentoNumero,
      documentoChave:  item.documentoChave,
    });
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function _buscarOuCriarSaldo(
  client: PoolClient,
  input: { tenantId: string; depositoId: string; produtoFiscalId?: string; productId?: number; lotId?: string }
): Promise<any> {
  const { rows } = await client.query(
    `SELECT * FROM saldos_produto
     WHERE deposito_id = $1
       AND tenant_id = $2
       AND COALESCE(produto_fiscal_id,'') = COALESCE($3::varchar,'')
       AND COALESCE(product_id, -1) = COALESCE($4::integer, -1)
       AND lot_id IS NOT DISTINCT FROM $5
     FOR UPDATE`,
    [input.depositoId, input.tenantId,
     input.produtoFiscalId ?? null, input.productId ?? null, input.lotId ?? null]
  );
  if (rows[0]) return rows[0];

  await client.query(
    `INSERT INTO saldos_produto
       (tenant_id, deposito_id, produto_fiscal_id, product_id, lot_id,
        quantidade_fisica, quantidade_reservada, custo_medio)
     VALUES ($1,$2,$3,$4,$5,0,0,0)
     ON CONFLICT DO NOTHING`,
    [input.tenantId, input.depositoId,
     input.produtoFiscalId ?? null, input.productId ?? null, input.lotId ?? null]
  );

  const { rows: r2 } = await client.query(
    `SELECT * FROM saldos_produto
     WHERE deposito_id = $1 AND tenant_id = $2
       AND COALESCE(produto_fiscal_id,'') = COALESCE($3::varchar,'')
       AND COALESCE(product_id, -1) = COALESCE($4::integer, -1)
       AND lot_id IS NOT DISTINCT FROM $5
     FOR UPDATE`,
    [input.depositoId, input.tenantId,
     input.produtoFiscalId ?? null, input.productId ?? null, input.lotId ?? null]
  );
  return r2[0];
}

async function _buscarSaldoRaw(client: PoolClient, input: any): Promise<any> {
  const { rows } = await client.query(
    `SELECT * FROM saldos_produto
     WHERE deposito_id = $1 AND tenant_id = $2
       AND COALESCE(produto_fiscal_id,'') = COALESCE($3::varchar,'')
     FOR UPDATE`,
    [input.depositoId, input.tenantId, input.produtoFiscalId ?? null]
  );
  return rows[0] ?? null;
}
