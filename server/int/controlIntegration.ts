/**
 * INT-01 — controlIntegration.ts
 * Handlers e utilitários de integração SOE ↔ Control.
 */

import { pool } from "../../db/index";
import { resolveClienteControlId, findOrCreateClienteByNome } from "../control/arService";

// ── handleSaleOrderCancelledControl ──────────────────────────────────────────

export async function handleSaleOrderCancelledControl(event: any): Promise<void> {
  const { orderId, pessoaId } = event.payload;
  const tenantId = event.tenantId;

  if (!pessoaId) return;

  const { rowCount } = await pool.query(
    `UPDATE lancamentos_financeiros
     SET status    = 'cancelado',
         updatedAt = NOW()
     WHERE tenant_id       = $1
       AND origem_ref_tipo  = 'venda'
       AND origem_ref_id   LIKE $2
       AND tipo            = 'receber'
       AND status          = 'previsto'`,
    [tenantId, `${orderId}%`]
  );

  if ((rowCount ?? 0) > 0) {
    console.log(`[INT-01/CTL] ${rowCount} AR(s) cancelados para pedido ${orderId}`);
  }
}

// ── resolverOuCriarClienteControl ─────────────────────────────────────────────

/**
 * Garante que uma pessoa (cliente ou fornecedor) tem um registro em clients.
 * Necessário antes de criar lancamentos_financeiros.
 *
 * Estratégia:
 *   1. Tenta resolver por CNPJ (JOIN pessoas ↔ clients)
 *   2. Tenta resolver por legacy_client_id
 *   3. Cria registro em clients com o nome fantasia
 */
export async function resolverOuCriarClienteControl(
  pessoaId: string,
  tenantId: string
): Promise<string | null> {
  const existente = await resolveClienteControlId(pessoaId, tenantId);
  if (existente) return existente;

  const { rows: [pessoa] } = await pool.query(
    `SELECT nome_fantasia, cnpj_cpf FROM pessoas WHERE id = $1`,
    [pessoaId]
  );
  if (!pessoa) return null;

  const clienteId = await findOrCreateClienteByNome(pessoa.nome_fantasia, tenantId);
  if (!clienteId) return null;

  if (pessoa.cnpj_cpf) {
    await pool.query(
      `UPDATE clients SET cnpj = $2 WHERE id = $1 AND (cnpj IS NULL OR cnpj = '')`,
      [clienteId, pessoa.cnpj_cpf.replace(/\D/g, '')]
    );
  }

  return clienteId;
}

// ── Vincular parcela de AR com lançamento ─────────────────────────────────────

export async function vincularArParcela(
  saleOrderId:            string,
  parcela:                number,
  lancamentoFinanceiroId: string
): Promise<void> {
  await pool.query(
    `UPDATE sale_order_installments
     SET status = 'gerado_ar', lancamento_receber_id = $3
     WHERE sale_order_id = $1 AND parcela = $2`,
    [saleOrderId, parcela, lancamentoFinanceiroId]
  );
}

// ── Vincular parcela de AP com lançamento ─────────────────────────────────────

export async function vincularApParcela(
  installmentId:          string,
  lancamentoFinanceiroId: string
): Promise<void> {
  await pool.query(
    `UPDATE purchase_invoice_installments
     SET status = 'gerado_ap', lancamento_pagar_id = $2
     WHERE id = $1`,
    [installmentId, lancamentoFinanceiroId]
  );
}
