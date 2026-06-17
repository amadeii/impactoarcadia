import { db } from "../db";
import {
  lancamentosContabeis,
  partidasContabeis,
  planosContas,
  centrosCusto,
  type LancamentoContabil,
  type InsertLancamentoContabil,
  type InsertPartidaContabil,
} from "@shared/schema";
import { and, eq, desc, inArray, sql } from "drizzle-orm";

/**
 * Contabilidade — Partidas Dobradas
 *
 * Cada lançamento contábil tem N partidas (linhas) D ou C, e a soma de
 * débitos DEVE igualar a soma de créditos. Aceita rateio por múltiplos
 * centros de custo (uma partida por centro com `rateio` em %).
 */

export type PartidaInput = Omit<InsertPartidaContabil, "tenantId" | "lancamentoContabilId">;

export interface CreateLancamentoInput {
  cabecalho: InsertLancamentoContabil;
  partidas: PartidaInput[];
}

export interface ResultadoLancamento {
  lancamento: LancamentoContabil;
  totalDebito: number;
  totalCredito: number;
  partidasCriadas: number;
}

function somatorio(partidas: PartidaInput[], tipo: "D" | "C"): number {
  return partidas
    .filter((p) => p.tipo === tipo)
    .reduce((s, p) => s + Number(p.valor ?? 0), 0);
}

/** Validação síncrona (sem DB) — usar antes de persistir. */
export function validarPartidas(partidas: PartidaInput[]): { ok: true } | { ok: false; erro: string } {
  if (!partidas || partidas.length < 2) {
    return { ok: false, erro: "Lançamento contábil exige no mínimo 2 partidas (1 débito e 1 crédito)" };
  }
  const td = somatorio(partidas, "D");
  const tc = somatorio(partidas, "C");
  if (td <= 0 || tc <= 0) {
    return { ok: false, erro: "Lançamento precisa ter ao menos um débito e um crédito com valor > 0" };
  }
  // Tolerância de 1 centavo para arredondamento
  if (Math.abs(td - tc) > 0.01) {
    return { ok: false, erro: `Débitos (${td.toFixed(2)}) ≠ Créditos (${tc.toFixed(2)}). Lançamento desbalanceado.` };
  }
  for (const p of partidas) {
    if (!["D", "C"].includes(p.tipo as string)) {
      return { ok: false, erro: `Tipo inválido em partida: ${p.tipo} (use 'D' ou 'C')` };
    }
    if (Number(p.valor) <= 0) {
      return { ok: false, erro: "Toda partida deve ter valor positivo" };
    }
    if (!p.planoContaId) {
      return { ok: false, erro: "Toda partida precisa de um plano de conta" };
    }
  }
  return { ok: true };
}

export async function createLancamento(input: CreateLancamentoInput): Promise<ResultadoLancamento> {
  const v = validarPartidas(input.partidas);
  if (!v.ok) throw new Error(v.erro);

  // Validação de ownership cross-tenant: planoContaId e centroCustoId
  // referenciados nas partidas DEVEM pertencer ao mesmo tenantId do cabeçalho.
  // Sem isso, um usuário poderia referenciar conta/CC de outro tenant via UUID.
  const tenantId = input.cabecalho.tenantId;
  const planoIds = Array.from(new Set(input.partidas.map((p) => p.planoContaId).filter(Boolean) as string[]));
  const ccIds = Array.from(new Set(input.partidas.map((p) => p.centroCustoId).filter(Boolean) as string[]));

  if (planoIds.length > 0) {
    const planos = await db.select({ id: planosContas.id }).from(planosContas)
      .where(and(eq(planosContas.tenantId, tenantId), inArray(planosContas.id, planoIds)));
    if (planos.length !== planoIds.length) {
      throw new Error("Plano de contas inválido ou de outro tenant");
    }
  }
  if (ccIds.length > 0) {
    const ccs = await db.select({ id: centrosCusto.id }).from(centrosCusto)
      .where(and(eq(centrosCusto.tenantId, tenantId), inArray(centrosCusto.id, ccIds)));
    if (ccs.length !== ccIds.length) {
      throw new Error("Centro de custo inválido ou de outro tenant");
    }
  }

  const td = somatorio(input.partidas, "D");
  const tc = somatorio(input.partidas, "C");

  return await db.transaction(async (tx) => {
    const [lanc] = await tx.insert(lancamentosContabeis).values({
      ...input.cabecalho,
      totalDebito: td.toFixed(2),
      totalCredito: tc.toFixed(2),
    }).returning();

    if (input.partidas.length > 0) {
      await tx.insert(partidasContabeis).values(input.partidas.map((p) => ({
        ...p,
        tenantId: input.cabecalho.tenantId,
        lancamentoContabilId: lanc.id,
      })));
    }

    return { lancamento: lanc, totalDebito: td, totalCredito: tc, partidasCriadas: input.partidas.length };
  });
}

export async function getLancamento(tenantId: string, id: string) {
  const [lanc] = await db.select().from(lancamentosContabeis)
    .where(and(eq(lancamentosContabeis.tenantId, tenantId), eq(lancamentosContabeis.id, id)))
    .limit(1);
  if (!lanc) return null;
  const partidas = await db.select({
    id: partidasContabeis.id,
    planoContaId: partidasContabeis.planoContaId,
    centroCustoId: partidasContabeis.centroCustoId,
    tipo: partidasContabeis.tipo,
    valor: partidasContabeis.valor,
    rateio: partidasContabeis.rateio,
    descricao: partidasContabeis.descricao,
    contaCodigo: planosContas.codigo,
    contaDescricao: planosContas.descricao,
  })
    .from(partidasContabeis)
    .leftJoin(planosContas, eq(planosContas.id, partidasContabeis.planoContaId))
    .where(eq(partidasContabeis.lancamentoContabilId, id))
    .orderBy(partidasContabeis.tipo, partidasContabeis.createdAt);
  return { ...lanc, partidas };
}

export async function listLancamentos(tenantId: string, clienteId: string, limit = 50) {
  return db.select().from(lancamentosContabeis)
    .where(and(
      eq(lancamentosContabeis.tenantId, tenantId),
      eq(lancamentosContabeis.clienteId, clienteId),
    ))
    .orderBy(desc(lancamentosContabeis.data), desc(lancamentosContabeis.createdAt))
    .limit(limit);
}

export async function deleteLancamento(tenantId: string, id: string): Promise<boolean> {
  const r = await db.delete(lancamentosContabeis)
    .where(and(eq(lancamentosContabeis.tenantId, tenantId), eq(lancamentosContabeis.id, id)));
  return (r as any).rowCount > 0;
}

/**
 * Razão de uma conta: lista todas as partidas (D/C) de uma conta no período.
 */
export async function razaoConta(
  tenantId: string,
  clienteId: string,
  planoContaId: string,
  ano: number,
  mes?: number,
) {
  const conds = [
    eq(partidasContabeis.tenantId, tenantId),
    eq(partidasContabeis.planoContaId, planoContaId),
    eq(lancamentosContabeis.clienteId, clienteId),
    sql`EXTRACT(YEAR FROM ${lancamentosContabeis.data}) = ${ano}`,
  ];
  if (mes) conds.push(sql`EXTRACT(MONTH FROM ${lancamentosContabeis.data}) = ${mes}`);

  return db.select({
    id: partidasContabeis.id,
    data: lancamentosContabeis.data,
    historico: lancamentosContabeis.historico,
    tipo: partidasContabeis.tipo,
    valor: partidasContabeis.valor,
    descricao: partidasContabeis.descricao,
    lancamentoId: partidasContabeis.lancamentoContabilId,
  })
    .from(partidasContabeis)
    .innerJoin(lancamentosContabeis, eq(lancamentosContabeis.id, partidasContabeis.lancamentoContabilId))
    .where(and(...conds))
    .orderBy(lancamentosContabeis.data);
}
