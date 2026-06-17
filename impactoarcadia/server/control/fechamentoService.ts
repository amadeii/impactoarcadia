import { db } from "../db";
import {
  fechamentosContabeis,
  periodosCompetencia,
  lancamentosFinanceiros,
  lancamentosContabeis,
  planosContas,
  type FechamentoContabil,
  type InsertFechamentoContabil,
} from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * Fechamento Contábil — workflow guiado por checklist com bloqueio de período.
 *
 * Fluxo:
 *   1. iniciarFechamento → cria registro 'em_andamento' com checklist default
 *   2. updateChecklist  → marca itens como completos
 *   3. concluirFechamento → marca como 'concluido' e bloqueia o período
 *      (periodo_competencia.status = 'fechado')
 *   4. reabrirFechamento → desbloqueia (apenas tenant_admin)
 *
 * Ao concluir, gera um snapshot de BP e DRE no `observacoes` (JSON resumido).
 */

const CHECKLIST_DEFAULT = [
  { id: "conciliacao_bancaria", label: "Conciliação bancária", done: false },
  { id: "lancamentos_pendentes", label: "Sem lançamentos pendentes", done: false },
  { id: "ajuste_estoque", label: "Ajuste de estoque", done: false },
  { id: "depreciacao", label: "Depreciação calculada", done: false },
  { id: "provisoes", label: "Provisões registradas", done: false },
  { id: "razao_revisado", label: "Razão revisado", done: false },
];

export async function iniciarFechamento(
  tenantId: string,
  clienteId: string,
  ano: number,
  mes: number,
  iniciadoPor: string,
): Promise<FechamentoContabil> {
  // Idempotente: se já existe, retorna existente
  const [existente] = await db.select().from(fechamentosContabeis)
    .where(and(
      eq(fechamentosContabeis.tenantId, tenantId),
      eq(fechamentosContabeis.clienteId, clienteId),
      eq(fechamentosContabeis.ano, ano),
      eq(fechamentosContabeis.mes, mes),
    ))
    .limit(1);
  if (existente) return existente;

  const [f] = await db.insert(fechamentosContabeis).values({
    tenantId,
    clienteId,
    ano,
    mes,
    status: "em_andamento",
    checklist: CHECKLIST_DEFAULT as any,
    iniciadoPor,
  }).returning();
  return f;
}

export async function getFechamento(
  tenantId: string,
  clienteId: string,
  ano: number,
  mes: number,
): Promise<FechamentoContabil | undefined> {
  const [f] = await db.select().from(fechamentosContabeis)
    .where(and(
      eq(fechamentosContabeis.tenantId, tenantId),
      eq(fechamentosContabeis.clienteId, clienteId),
      eq(fechamentosContabeis.ano, ano),
      eq(fechamentosContabeis.mes, mes),
    ))
    .limit(1);
  return f;
}

export async function updateChecklist(
  tenantId: string,
  fechamentoId: string,
  itemId: string,
  done: boolean,
): Promise<FechamentoContabil | undefined> {
  const [atual] = await db.select().from(fechamentosContabeis)
    .where(and(eq(fechamentosContabeis.tenantId, tenantId), eq(fechamentosContabeis.id, fechamentoId)))
    .limit(1);
  if (!atual) return undefined;
  if (atual.status === "concluido") {
    throw new Error("Fechamento já concluído — reabra antes de editar");
  }
  const lista = (Array.isArray(atual.checklist) ? atual.checklist : CHECKLIST_DEFAULT) as Array<{ id: string; label: string; done: boolean }>;
  const novo = lista.map((i) => (i.id === itemId ? { ...i, done } : i));
  const [u] = await db.update(fechamentosContabeis)
    .set({ checklist: novo as any })
    .where(eq(fechamentosContabeis.id, fechamentoId))
    .returning();
  return u;
}

export async function concluirFechamento(
  tenantId: string,
  fechamentoId: string,
  concluidoPor: string,
): Promise<FechamentoContabil> {
  const [atual] = await db.select().from(fechamentosContabeis)
    .where(and(eq(fechamentosContabeis.tenantId, tenantId), eq(fechamentosContabeis.id, fechamentoId)))
    .limit(1);
  if (!atual) throw new Error("Fechamento não encontrado");
  if (atual.status === "concluido") return atual;

  const lista = (Array.isArray(atual.checklist) ? atual.checklist : []) as Array<{ done: boolean }>;
  const pendentes = lista.filter((i) => !i.done).length;
  if (pendentes > 0) {
    throw new Error(`Checklist incompleto: ${pendentes} itens pendentes`);
  }

  // Gera snapshot resumido
  const snapshot = await gerarSnapshot(tenantId, atual.clienteId, atual.ano, atual.mes);

  return await db.transaction(async (tx) => {
    const [f] = await tx.update(fechamentosContabeis).set({
      status: "concluido",
      concluidoPor,
      concluidoEm: new Date(),
      observacoes: JSON.stringify(snapshot),
    }).where(eq(fechamentosContabeis.id, fechamentoId)).returning();

    // Bloqueia (ou cria) o período de competência
    const [periodo] = await tx.select().from(periodosCompetencia)
      .where(and(
        eq(periodosCompetencia.tenantId, tenantId),
        eq(periodosCompetencia.clienteId, atual.clienteId),
        eq(periodosCompetencia.ano, atual.ano),
        eq(periodosCompetencia.mes, atual.mes),
      ))
      .limit(1);
    if (periodo) {
      await tx.update(periodosCompetencia).set({
        status: "fechado",
        fechadoPor: concluidoPor,
        fechadoEm: new Date(),
      }).where(eq(periodosCompetencia.id, periodo.id));
    } else {
      await tx.insert(periodosCompetencia).values({
        tenantId,
        clienteId: atual.clienteId,
        ano: atual.ano,
        mes: atual.mes,
        status: "fechado",
        fechadoPor: concluidoPor,
        fechadoEm: new Date(),
      });
    }
    return f;
  });
}

export async function reabrirFechamento(
  tenantId: string,
  fechamentoId: string,
): Promise<FechamentoContabil> {
  const [f] = await db.update(fechamentosContabeis)
    .set({ status: "reaberto", concluidoEm: null, concluidoPor: null })
    .where(and(eq(fechamentosContabeis.tenantId, tenantId), eq(fechamentosContabeis.id, fechamentoId)))
    .returning();
  if (!f) throw new Error("Fechamento não encontrado");

  await db.update(periodosCompetencia).set({
    status: "aberto",
    fechadoPor: null,
    fechadoEm: null,
  }).where(and(
    eq(periodosCompetencia.tenantId, tenantId),
    eq(periodosCompetencia.clienteId, f.clienteId),
    eq(periodosCompetencia.ano, f.ano),
    eq(periodosCompetencia.mes, f.mes),
  ));
  return f;
}

/** Verifica se um período está bloqueado para novos lançamentos. */
export async function periodoBloqueado(
  tenantId: string,
  clienteId: string,
  data: Date,
): Promise<boolean> {
  const ano = data.getFullYear();
  const mes = data.getMonth() + 1;
  const [p] = await db.select({ status: periodosCompetencia.status })
    .from(periodosCompetencia)
    .where(and(
      eq(periodosCompetencia.tenantId, tenantId),
      eq(periodosCompetencia.clienteId, clienteId),
      eq(periodosCompetencia.ano, ano),
      eq(periodosCompetencia.mes, mes),
    ))
    .limit(1);
  return p?.status === "fechado";
}

async function gerarSnapshot(tenantId: string, clienteId: string, ano: number, mes: number) {
  // BP/DRE simplificado por natureza
  const linhas = await db.select({
    natureza: planosContas.natureza,
    total: sql<string>`COALESCE(SUM(${lancamentosFinanceiros.valor}), 0)`,
  })
    .from(lancamentosFinanceiros)
    .leftJoin(planosContas, eq(planosContas.id, lancamentosFinanceiros.planoContaId))
    .where(and(
      eq(lancamentosFinanceiros.tenantId, tenantId),
      eq(lancamentosFinanceiros.clienteId, clienteId),
      sql`EXTRACT(YEAR FROM ${lancamentosFinanceiros.dataVencimento}) = ${ano}`,
      sql`EXTRACT(MONTH FROM ${lancamentosFinanceiros.dataVencimento}) = ${mes}`,
    ))
    .groupBy(planosContas.natureza);

  const map: Record<string, number> = {};
  for (const l of linhas) map[l.natureza ?? "indef"] = Number(l.total ?? 0);

  return {
    geradoEm: new Date().toISOString(),
    competencia: `${String(mes).padStart(2, "0")}/${ano}`,
    receitas: map.receita ?? 0,
    custos: map.custo ?? 0,
    despesas: map.despesa ?? 0,
    resultado: (map.receita ?? 0) - (map.custo ?? 0) - (map.despesa ?? 0),
    ativos: map.ativo ?? 0,
    passivos: map.passivo ?? 0,
    pl: map.patrimonio_liquido ?? 0,
  };
}
