// Sprint C6.1 — Conciliação atômica de lançamentos financeiros.
// Cada conciliação gera UMA linha em movimentacoes_bancarias e atualiza o
// saldoAtual da conta bancária na mesma transação. Reverter (desconciliar)
// remove a movimentação e devolve o valor ao saldo. Trocar a conta de uma
// conciliação existente reverte a antiga e aplica nova de forma atômica.

import { db } from "../db";
import {
  lancamentosFinanceiros,
  contasBancarias,
  movimentacoesBancarias,
  type MovimentacaoBancaria,
} from "@shared/schema";
import { and, eq, sql, desc, gte, lte } from "drizzle-orm";

export type ConciliarResult =
  | { ok: true; movimentacao: MovimentacaoBancaria; saldoAposConta: string }
  | { ok: false; error: string; status?: number };

/**
 * Sinal numérico do movimento conforme tipo do lançamento.
 *  - receber → entrada (+valor)
 *  - pagar   → saida   (−valor)
 */
function sinalDoLancamento(tipo: string): "entrada" | "saida" {
  return tipo === "receber" ? "entrada" : "saida";
}

function asNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(String(v));
}

/**
 * Concilia um lançamento (marca como pago) e cria a movimentação na conta
 * bancária. Idempotente para a mesma {lancamento, conta, data}.
 */
export async function conciliarLancamento(
  tenantId: string,
  lancamentoId: string,
  input: { contaBancariaId: string; dataPagamento: string; userId?: string | null },
): Promise<ConciliarResult> {
  const { contaBancariaId, dataPagamento, userId } = input;
  if (!contaBancariaId) return { ok: false, error: "Conta bancária obrigatória", status: 400 };
  if (!dataPagamento) return { ok: false, error: "Data de pagamento obrigatória", status: 400 };

  return await db.transaction(async (tx) => {
    // 1) Lança lock pelo SELECT FOR UPDATE no lançamento
    const lancRows = await tx.execute<any>(sql`
      SELECT id, tenant_id, cliente_id, tipo, descricao, valor, status, conta_bancaria_id
      FROM lancamentos_financeiros
      WHERE id = ${lancamentoId} AND tenant_id = ${tenantId}
      FOR UPDATE
    `);
    const lancRow: any = (lancRows as any).rows?.[0] ?? (lancRows as any)[0];
    if (!lancRow) return { ok: false, error: "Lançamento não encontrado", status: 404 };
    if (lancRow.status === "cancelado") return { ok: false, error: "Lançamento cancelado não pode ser conciliado", status: 400 };
    const valorLanc = asNumber(lancRow.valor);
    const tipoLanc = String(lancRow.tipo);
    const sinal = sinalDoLancamento(tipoLanc);

    // 2) Valida nova conta + lock + mesmo cliente
    const contasRows = await tx.execute<any>(sql`
      SELECT id, tenant_id, cliente_id, saldo_atual
      FROM contas_bancarias
      WHERE id = ${contaBancariaId} AND tenant_id = ${tenantId}
      FOR UPDATE
    `);
    const contaNova: any = (contasRows as any).rows?.[0] ?? (contasRows as any)[0];
    if (!contaNova) return { ok: false, error: "Conta bancária não encontrada", status: 404 };
    if (contaNova.cliente_id !== lancRow.cliente_id) {
      return { ok: false, error: "Conta bancária pertence a outro cliente", status: 400 };
    }

    // 3) Se já há movimentação para esse lançamento, reverte primeiro (mesmo no caso
    // de mudança de conta ou re-conciliação com data diferente).
    const movExistRows = await tx.execute<any>(sql`
      SELECT id, conta_bancaria_id, tipo, valor
      FROM movimentacoes_bancarias
      WHERE tenant_id = ${tenantId} AND lancamento_financeiro_id = ${lancamentoId}
      FOR UPDATE
    `);
    const movExist: any = (movExistRows as any).rows?.[0] ?? (movExistRows as any)[0];
    if (movExist) {
      const valorAntigo = asNumber(movExist.valor);
      const sinalAntigo: "entrada" | "saida" = movExist.tipo;
      const ajusteAntigo = sinalAntigo === "entrada" ? -valorAntigo : valorAntigo;
      await tx.execute(sql`
        UPDATE contas_bancarias
        SET saldo_atual = COALESCE(saldo_atual, 0) + ${ajusteAntigo}
        WHERE id = ${movExist.conta_bancaria_id} AND tenant_id = ${tenantId}
      `);
      await tx.execute(sql`
        DELETE FROM movimentacoes_bancarias
        WHERE id = ${movExist.id} AND tenant_id = ${tenantId}
      `);
    }

    // 4) Aplica novo saldo na conta nova
    const ajuste = sinal === "entrada" ? valorLanc : -valorLanc;
    const updRows = await tx.execute<any>(sql`
      UPDATE contas_bancarias
      SET saldo_atual = COALESCE(saldo_atual, 0) + ${ajuste}
      WHERE id = ${contaBancariaId} AND tenant_id = ${tenantId}
      RETURNING saldo_atual
    `);
    const updRow: any = (updRows as any).rows?.[0] ?? (updRows as any)[0];
    const saldoApos = String(updRow?.saldo_atual ?? "0");

    // 5) Atualiza lançamento (status pago + dataPagamento + contaBancariaId)
    await tx.update(lancamentosFinanceiros)
      .set({
        status: "pago",
        dataPagamento,
        contaBancariaId,
        updatedAt: new Date(),
      })
      .where(and(eq(lancamentosFinanceiros.id, lancamentoId), eq(lancamentosFinanceiros.tenantId, tenantId)));

    // 6) Insere movimentação no extrato
    const [movInserida] = await tx.insert(movimentacoesBancarias).values({
      tenantId,
      contaBancariaId,
      lancamentoId,
      data: dataPagamento,
      tipo: sinal,
      origem: "conciliacao",
      descricao: `${tipoLanc === "receber" ? "Recebimento" : "Pagamento"}: ${lancRow.descricao}`,
      valor: String(valorLanc),
      saldoApos,
    } as any).returning();

    return { ok: true, movimentacao: movInserida as any, saldoAposConta: saldoApos };
  });
}

/**
 * Reverte a conciliação de um lançamento — remove a movimentação correspondente
 * e devolve o valor ao saldo da conta. Volta lançamento para status "aprovado"
 * (preservando histórico de aprovação) ou "previsto" se nunca foi aprovado.
 */
export async function desconciliarLancamento(
  tenantId: string,
  lancamentoId: string,
): Promise<ConciliarResult | { ok: true; revertido: false }> {
  return await db.transaction(async (tx) => {
    const lancRows = await tx.execute<any>(sql`
      SELECT id, status, aprovado_em
      FROM lancamentos_financeiros
      WHERE id = ${lancamentoId} AND tenant_id = ${tenantId}
      FOR UPDATE
    `);
    const lancRow: any = (lancRows as any).rows?.[0] ?? (lancRows as any)[0];
    if (!lancRow) return { ok: false, error: "Lançamento não encontrado", status: 404 };

    const movExistRows = await tx.execute<any>(sql`
      SELECT id, conta_bancaria_id, tipo, valor
      FROM movimentacoes_bancarias
      WHERE tenant_id = ${tenantId} AND lancamento_financeiro_id = ${lancamentoId}
      FOR UPDATE
    `);
    const movExist: any = (movExistRows as any).rows?.[0] ?? (movExistRows as any)[0];

    if (movExist) {
      const valorAntigo = asNumber(movExist.valor);
      const sinalAntigo: "entrada" | "saida" = movExist.tipo;
      const ajuste = sinalAntigo === "entrada" ? -valorAntigo : valorAntigo;
      await tx.execute(sql`
        UPDATE contas_bancarias
        SET saldo_atual = COALESCE(saldo_atual, 0) + ${ajuste}
        WHERE id = ${movExist.conta_bancaria_id} AND tenant_id = ${tenantId}
      `);
      await tx.execute(sql`
        DELETE FROM movimentacoes_bancarias
        WHERE id = ${movExist.id} AND tenant_id = ${tenantId}
      `);
    }

    const novoStatus = lancRow.aprovado_em ? "aprovado" : "previsto";
    await tx.update(lancamentosFinanceiros)
      .set({ status: novoStatus, dataPagamento: null, updatedAt: new Date() })
      .where(and(eq(lancamentosFinanceiros.id, lancamentoId), eq(lancamentosFinanceiros.tenantId, tenantId)));

    return { ok: true, revertido: !!movExist } as any;
  });
}

/**
 * Retorna o extrato (movimentações) de uma conta bancária num período,
 * mais o saldo inicial e final calculado.
 */
export async function getExtratoConta(
  tenantId: string,
  contaBancariaId: string,
  filtros: { dataIni?: string; dataFim?: string } = {},
): Promise<{
  conta: { id: string; banco: string; saldoInicial: string; saldoAtual: string };
  movimentacoes: Array<MovimentacaoBancaria & { lancamentoDescricao?: string | null }>;
  totalEntradas: number;
  totalSaidas: number;
}> {
  const [conta] = await db.select({
    id: contasBancarias.id,
    banco: contasBancarias.banco,
    saldoInicial: contasBancarias.saldoInicial,
    saldoAtual: contasBancarias.saldoAtual,
  }).from(contasBancarias)
    .where(and(eq(contasBancarias.id, contaBancariaId), eq(contasBancarias.tenantId, tenantId)))
    .limit(1);
  if (!conta) throw new Error("Conta bancária não encontrada");

  const conditions = [
    eq(movimentacoesBancarias.tenantId, tenantId),
    eq(movimentacoesBancarias.contaBancariaId, contaBancariaId),
  ];
  if (filtros.dataIni) conditions.push(gte(movimentacoesBancarias.data, filtros.dataIni));
  if (filtros.dataFim) conditions.push(lte(movimentacoesBancarias.data, filtros.dataFim));

  const movs = await db.select({
    id: movimentacoesBancarias.id,
    tenantId: movimentacoesBancarias.tenantId,
    contaBancariaId: movimentacoesBancarias.contaBancariaId,
    lancamentoId: movimentacoesBancarias.lancamentoId,
    data: movimentacoesBancarias.data,
    tipo: movimentacoesBancarias.tipo,
    origem: movimentacoesBancarias.origem,
    descricao: movimentacoesBancarias.descricao,
    valor: movimentacoesBancarias.valor,
    saldoApos: movimentacoesBancarias.saldoApos,
    createdAt: movimentacoesBancarias.createdAt,
    lancamentoDescricao: lancamentosFinanceiros.descricao,
  }).from(movimentacoesBancarias)
    .leftJoin(lancamentosFinanceiros, eq(movimentacoesBancarias.lancamentoId, lancamentosFinanceiros.id))
    .where(and(...conditions))
    .orderBy(desc(movimentacoesBancarias.data), desc(movimentacoesBancarias.createdAt));

  let totalEntradas = 0;
  let totalSaidas = 0;
  for (const m of movs) {
    const v = asNumber(m.valor);
    if (m.tipo === "entrada") totalEntradas += v; else totalSaidas += v;
  }

  return {
    conta: {
      id: conta.id,
      banco: conta.banco,
      saldoInicial: String(conta.saldoInicial ?? "0"),
      saldoAtual: String(conta.saldoAtual ?? "0"),
    },
    movimentacoes: movs as any,
    totalEntradas,
    totalSaidas,
  };
}
