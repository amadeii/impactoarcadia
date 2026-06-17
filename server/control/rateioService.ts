// Sprint C6 — Rateio de lançamentos financeiros entre múltiplos CCs.
// SUM(percentual) === 100 ± 0.01. Validação no backend (z.refine).
// Operação atômica em transação: delete antigos + insert novos.

import { db } from "../db";
import { rateiosCc, centrosCusto, lancamentosFinanceiros } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

export interface RateioInput {
  centroCustoId: string;
  percentual: number; // 0..100, 2 casas
}

export interface RateioRow {
  id: string;
  centroCustoId: string;
  centroCustoCodigo: string;
  centroCustoNome: string;
  percentual: string; // numeric vem como string
  valorRateado: string | null;
}

const TOLERANCIA = 0.01;

const rateioInputSchema = z.array(
  z.object({
    centroCustoId: z.string().min(1),
    percentual: z.number().positive().max(100),
  }),
);

/** Lista rateios de um lançamento com nome/código do CC. */
export async function getRateios(tenantId: string, lancamentoId: string): Promise<RateioRow[]> {
  const rows = await db
    .select({
      id: rateiosCc.id,
      centroCustoId: rateiosCc.centroCustoId,
      percentual: rateiosCc.percentual,
      valorRateado: rateiosCc.valorRateado,
      centroCustoCodigo: centrosCusto.codigo,
      centroCustoNome: centrosCusto.nome,
    })
    .from(rateiosCc)
    .innerJoin(centrosCusto, eq(rateiosCc.centroCustoId, centrosCusto.id))
    .where(and(eq(rateiosCc.tenantId, tenantId), eq(rateiosCc.lancamentoId, lancamentoId)));
  return rows as RateioRow[];
}

/**
 * Substitui completamente os rateios de um lançamento.
 * Se `items` vazio, apenas remove rateios existentes (lançamento volta a usar
 * `centroCustoId` direto).
 */
export async function setRateios(
  tenantId: string,
  lancamentoId: string,
  itemsRaw: any,
): Promise<{ ok: true; total: number } | { ok: false; error: string }> {
  // 1. Carrega lançamento — valida ownership e pega cliente/valor
  const [lanc] = await db.select({
    id: lancamentosFinanceiros.id,
    clienteId: lancamentosFinanceiros.clienteId,
    valor: lancamentosFinanceiros.valor,
  }).from(lancamentosFinanceiros)
    .where(and(eq(lancamentosFinanceiros.id, lancamentoId), eq(lancamentosFinanceiros.tenantId, tenantId)))
    .limit(1);
  if (!lanc) return { ok: false, error: "Lançamento não encontrado" };

  // 2. Vazio → apenas limpa
  let items: RateioInput[] = [];
  if (itemsRaw != null) {
    const parsed = rateioInputSchema.safeParse(itemsRaw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    }
    items = parsed.data;
  }

  if (items.length === 0) {
    await db.delete(rateiosCc)
      .where(and(eq(rateiosCc.tenantId, tenantId), eq(rateiosCc.lancamentoId, lancamentoId)));
    return { ok: true, total: 0 };
  }

  // 3. Valida soma = 100
  const soma = items.reduce((s, it) => s + Number(it.percentual), 0);
  if (Math.abs(soma - 100) > TOLERANCIA) {
    return { ok: false, error: `Soma dos percentuais deve ser 100% (atual: ${soma.toFixed(2)}%)` };
  }

  // 4. Valida CCs únicos
  const idsUnicos = new Set(items.map((it) => it.centroCustoId));
  if (idsUnicos.size !== items.length) {
    return { ok: false, error: "Não pode haver CCs duplicados no rateio" };
  }

  // 5. Valida CCs ∈ cliente do lançamento + ativos
  const ccs = await db.select({
    id: centrosCusto.id,
    clienteId: centrosCusto.clienteId,
    ativo: centrosCusto.ativo,
  }).from(centrosCusto)
    .where(and(eq(centrosCusto.tenantId, tenantId), inArray(centrosCusto.id, items.map((it) => it.centroCustoId))));
  if (ccs.length !== items.length) {
    return { ok: false, error: "Um ou mais CCs não foram encontrados" };
  }
  const invalido = ccs.find((c) => c.clienteId !== lanc.clienteId || c.ativo === false);
  if (invalido) {
    return { ok: false, error: "Todos os CCs devem pertencer ao mesmo cliente do lançamento e estar ativos" };
  }

  // 6. Transação: delete + insert
  const valorTotal = Number(lanc.valor);
  await db.transaction(async (tx) => {
    await tx.delete(rateiosCc)
      .where(and(eq(rateiosCc.tenantId, tenantId), eq(rateiosCc.lancamentoId, lancamentoId)));
    await tx.insert(rateiosCc).values(items.map((it) => ({
      tenantId,
      lancamentoId,
      centroCustoId: it.centroCustoId,
      percentual: String(it.percentual),
      valorRateado: ((valorTotal * it.percentual) / 100).toFixed(2),
    })));
  });

  return { ok: true, total: items.length };
}
