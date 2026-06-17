import { db } from "../db";
import {
  gruposEmpresariais,
  gruposEmpresariaisMembros,
  lancamentosFinanceiros,
  planosContas,
  clients,
  type GrupoEmpresarial,
  type InsertGrupoEmpresarial,
  type GrupoMembro,
  type InsertGrupoMembro,
} from "@shared/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

export async function listGrupos(tenantId: string): Promise<GrupoEmpresarial[]> {
  return db.select().from(gruposEmpresariais)
    .where(eq(gruposEmpresariais.tenantId, tenantId))
    .orderBy(gruposEmpresariais.nome);
}

export async function getGrupo(tenantId: string, id: string): Promise<GrupoEmpresarial | undefined> {
  const [g] = await db.select().from(gruposEmpresariais)
    .where(and(eq(gruposEmpresariais.tenantId, tenantId), eq(gruposEmpresariais.id, id)))
    .limit(1);
  return g;
}

export async function createGrupo(data: InsertGrupoEmpresarial): Promise<GrupoEmpresarial> {
  const [g] = await db.insert(gruposEmpresariais).values(data).returning();
  if (data.matrizClienteId) {
    await db.insert(gruposEmpresariaisMembros).values({
      tenantId: data.tenantId,
      grupoId: g.id,
      clienteId: data.matrizClienteId,
      papel: "matriz",
      participacao: "100.000",
    }).onConflictDoNothing();
  }
  return g;
}

export async function updateGrupo(tenantId: string, id: string, data: Partial<InsertGrupoEmpresarial>): Promise<GrupoEmpresarial | undefined> {
  const allowed: Partial<InsertGrupoEmpresarial> = {};
  for (const k of ["nome", "tipo", "matrizClienteId", "descricao", "ativo"] as const) {
    if (k in data) (allowed as any)[k] = (data as any)[k];
  }
  const [g] = await db.update(gruposEmpresariais).set(allowed)
    .where(and(eq(gruposEmpresariais.tenantId, tenantId), eq(gruposEmpresariais.id, id)))
    .returning();
  return g;
}

export async function deleteGrupo(tenantId: string, id: string): Promise<boolean> {
  const r = await db.delete(gruposEmpresariais)
    .where(and(eq(gruposEmpresariais.tenantId, tenantId), eq(gruposEmpresariais.id, id)));
  return (r as any).rowCount > 0;
}

export async function listMembros(tenantId: string, grupoId: string) {
  return db.select({
    id: gruposEmpresariaisMembros.id,
    clienteId: gruposEmpresariaisMembros.clienteId,
    papel: gruposEmpresariaisMembros.papel,
    participacao: gruposEmpresariaisMembros.participacao,
    clienteNome: clients.name,
    cnpj: clients.company,
  }).from(gruposEmpresariaisMembros)
    .leftJoin(clients, eq(clients.id, gruposEmpresariaisMembros.clienteId))
    .where(and(
      eq(gruposEmpresariaisMembros.tenantId, tenantId),
      eq(gruposEmpresariaisMembros.grupoId, grupoId),
    ));
}

export async function addMembro(data: InsertGrupoMembro): Promise<GrupoMembro> {
  const [m] = await db.insert(gruposEmpresariaisMembros).values(data).returning();
  return m;
}

export async function removeMembro(tenantId: string, grupoId: string, membroId: string): Promise<boolean> {
  const r = await db.delete(gruposEmpresariaisMembros)
    .where(and(
      eq(gruposEmpresariaisMembros.tenantId, tenantId),
      eq(gruposEmpresariaisMembros.grupoId, grupoId),
      eq(gruposEmpresariaisMembros.id, membroId),
    ));
  return (r as any).rowCount > 0;
}

/**
 * DRE consolidada de um grupo: soma valores de todos os membros, agrupando
 * por natureza_dre do plano de contas. Considera apenas lançamentos com
 * status 'pago' (regime caixa) ou 'aprovado' (regime competência) — usuário
 * escolhe por param.
 */
export async function dreConsolidada(
  tenantId: string,
  grupoId: string,
  ano: number,
  mes: number,
  regime: "caixa" | "competencia" = "competencia",
): Promise<{ membros: number; receitas: number; custos: number; despesas: number; resultado: number; detalhes: any[] }> {
  const membros = await db.select({ clienteId: gruposEmpresariaisMembros.clienteId })
    .from(gruposEmpresariaisMembros)
    .where(and(
      eq(gruposEmpresariaisMembros.tenantId, tenantId),
      eq(gruposEmpresariaisMembros.grupoId, grupoId),
    ));
  const clienteIds = membros.map((m) => m.clienteId);
  if (clienteIds.length === 0) {
    return { membros: 0, receitas: 0, custos: 0, despesas: 0, resultado: 0, detalhes: [] };
  }

  // Mês alvo via SQL string para portabilidade
  const dataField = regime === "caixa" ? lancamentosFinanceiros.dataPagamento : lancamentosFinanceiros.dataVencimento;
  const statusFiltro = regime === "caixa" ? "pago" : null;

  const linhas = await db.select({
    natureza: planosContas.natureza,
    naturezaDre: planosContas.naturezaDre,
    codigo: planosContas.codigo,
    descricao: planosContas.descricao,
    total: sql<string>`COALESCE(SUM(${lancamentosFinanceiros.valor}), 0)`.as("total"),
  })
    .from(lancamentosFinanceiros)
    .leftJoin(planosContas, eq(planosContas.id, lancamentosFinanceiros.planoContaId))
    .where(and(
      eq(lancamentosFinanceiros.tenantId, tenantId),
      inArray(lancamentosFinanceiros.clienteId, clienteIds),
      sql`EXTRACT(YEAR FROM ${dataField}) = ${ano}`,
      sql`EXTRACT(MONTH FROM ${dataField}) = ${mes}`,
      ...(statusFiltro ? [eq(lancamentosFinanceiros.status, statusFiltro)] : []),
    ))
    .groupBy(planosContas.natureza, planosContas.naturezaDre, planosContas.codigo, planosContas.descricao);

  let receitas = 0, custos = 0, despesas = 0;
  for (const l of linhas) {
    const v = Number(l.total ?? 0);
    if (l.natureza === "receita") receitas += v;
    else if (l.natureza === "custo") custos += v;
    else if (l.natureza === "despesa") despesas += v;
  }
  const resultado = receitas - custos - despesas;

  return {
    membros: clienteIds.length,
    receitas,
    custos,
    despesas,
    resultado,
    detalhes: linhas.map((l) => ({ ...l, total: Number(l.total ?? 0) })),
  };
}

/**
 * Rateio: dado um lançamento da matriz, gera lançamentos correspondentes nos
 * filiais proporcionalmente à participacao registrada em grupos_empresariais_membros.
 * Retorna os lançamentos criados (sem persistir — quem persiste é a route).
 */
export async function calcularRateio(
  tenantId: string,
  grupoId: string,
  valorTotal: number,
): Promise<Array<{ clienteId: string; valor: number; participacao: number }>> {
  const ms = await db.select({
    clienteId: gruposEmpresariaisMembros.clienteId,
    participacao: gruposEmpresariaisMembros.participacao,
    papel: gruposEmpresariaisMembros.papel,
  })
    .from(gruposEmpresariaisMembros)
    .where(and(
      eq(gruposEmpresariaisMembros.tenantId, tenantId),
      eq(gruposEmpresariaisMembros.grupoId, grupoId),
    ));
  // Excluir matriz do rateio (ela já tem o lançamento original)
  const filiais = ms.filter((m) => m.papel !== "matriz");
  const totalParticipacao = filiais.reduce((s, m) => s + Number(m.participacao ?? 0), 0);
  if (totalParticipacao === 0) return [];
  return filiais.map((m) => ({
    clienteId: m.clienteId,
    participacao: Number(m.participacao ?? 0),
    valor: +(valorTotal * Number(m.participacao ?? 0) / totalParticipacao).toFixed(2),
  }));
}
