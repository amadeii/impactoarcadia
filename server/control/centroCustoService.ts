// Sprint C6 — Service de Centros de Custo dinâmicos.
// Cobre: validação de regras (tipo=projeto exige datas, hex cor, parent do
// mesmo cliente), import em lote a partir de linhas CSV, cálculo de orçamento
// utilizado por mês considerando rateios.

import { db } from "../db";
import {
  centrosCusto, rateiosCc, lancamentosFinanceiros,
  insertCentroCustoSchema,
  type InsertCentroCusto, type CentroCusto,
} from "@shared/schema";
import { and, eq, sql, inArray } from "drizzle-orm";
import { z } from "zod";

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export interface ImportRow {
  codigo: string;
  nome: string;
  tipo?: "departamento" | "projeto" | "atividade";
  responsavel?: string | null;
  parentCodigo?: string | null;
  orcamentoAnual?: string | number | null;
  cor?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
}

export interface ImportReport {
  totalLinhas: number;
  criados: number;
  atualizados: number;
  erros: { linha: number; codigo: string; mensagem: string }[];
}

const importRowSchema = z.object({
  codigo: z.string().min(1, "código obrigatório").max(30),
  nome: z.string().min(1, "nome obrigatório").max(200),
  tipo: z.enum(["departamento", "projeto", "atividade"]).optional(),
  responsavel: z.string().max(200).optional().nullable(),
  parentCodigo: z.string().max(30).optional().nullable(),
  orcamentoAnual: z.union([z.string(), z.number()]).optional().nullable(),
  cor: z.string().regex(HEX_COLOR_RE, "cor inválida").optional().nullable(),
  dataInicio: z.string().optional().nullable(),
  dataFim: z.string().optional().nullable(),
});

/** Valida e cria um CC. Retorna { row } ou { error }. */
export async function createCentroCusto(
  tenantId: string,
  clienteId: string,
  input: any,
): Promise<{ row?: CentroCusto; error?: string }> {
  try {
    const parsed = insertCentroCustoSchema.parse({ ...input, tenantId, clienteId });
    if (parsed.parentId) {
      const ok = await parentBelongsToCliente(parsed.parentId, tenantId, clienteId);
      if (!ok) return { error: "CC pai inválido para este cliente" };
    }
    const dup = await db.select({ id: centrosCusto.id }).from(centrosCusto)
      .where(and(eq(centrosCusto.tenantId, tenantId), eq(centrosCusto.clienteId, clienteId), eq(centrosCusto.codigo, parsed.codigo)))
      .limit(1);
    if (dup.length) return { error: `Já existe um CC com código ${parsed.codigo} neste cliente` };
    const [row] = await db.insert(centrosCusto).values(parsed as any).returning();
    return { row };
  } catch (e: any) {
    if (e?.issues) return { error: e.issues.map((i: any) => i.message).join("; ") };
    return { error: e?.message ?? "Erro ao criar CC" };
  }
}

/** Patch de CC: aplica refines manualmente porque insertSchema é inteiro. */
const centroPatchSchema = z.object({
  codigo: z.string().min(1).max(30).optional(),
  nome: z.string().min(1).max(200).optional(),
  descricao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  tipo: z.enum(["departamento", "projeto", "atividade"]).optional(),
  parentId: z.string().nullable().optional(),
  responsavel: z.string().max(200).optional().nullable(),
  dataInicio: z.string().optional().nullable(),
  dataFim: z.string().optional().nullable(),
  orcamentoAnual: z.union([z.string(), z.number()]).optional().nullable()
    .transform((v) => (v == null || v === "" ? null : String(v))),
  cor: z.string().regex(HEX_COLOR_RE, "Cor inválida").optional().nullable(),
});

export async function updateCentroCusto(
  tenantId: string,
  id: string,
  patch: any,
): Promise<{ row?: CentroCusto; error?: string }> {
  try {
    const parsed = centroPatchSchema.parse(patch);
    // Carrega o atual para aplicar regra de tipo=projeto sobre o estado final.
    const [current] = await db.select().from(centrosCusto)
      .where(and(eq(centrosCusto.id, id), eq(centrosCusto.tenantId, tenantId))).limit(1);
    if (!current) return { error: "Centro de custo não encontrado" };
    const merged = { ...current, ...parsed };
    if (merged.tipo === "projeto" && (!merged.dataInicio || !merged.dataFim)) {
      return { error: "Centros de Custo do tipo 'projeto' exigem dataInicio e dataFim" };
    }
    if (parsed.parentId && parsed.parentId !== current.parentId) {
      const ok = await parentBelongsToCliente(parsed.parentId, tenantId, current.clienteId);
      if (!ok) return { error: "CC pai inválido para este cliente" };
      if (parsed.parentId === id) return { error: "CC não pode ser pai de si mesmo" };
    }
    const [row] = await db.update(centrosCusto).set(parsed as any)
      .where(and(eq(centrosCusto.id, id), eq(centrosCusto.tenantId, tenantId)))
      .returning();
    return { row };
  } catch (e: any) {
    if (e?.issues) return { error: e.issues.map((i: any) => i.message).join("; ") };
    return { error: e?.message ?? "Erro ao atualizar CC" };
  }
}

async function parentBelongsToCliente(parentId: string, tenantId: string, clienteId: string): Promise<boolean> {
  const [p] = await db.select({ id: centrosCusto.id }).from(centrosCusto)
    .where(and(eq(centrosCusto.id, parentId), eq(centrosCusto.tenantId, tenantId), eq(centrosCusto.clienteId, clienteId)))
    .limit(1);
  return !!p;
}

/**
 * Import em lote a partir de linhas CSV já parseadas.
 * Estratégia: upsert por (clienteId, codigo) — se existe, atualiza; se não, cria.
 * `parentCodigo` é resolvido em uma 2ª passada após todos terem sido criados,
 * para que ordem do CSV não importe.
 */
export async function importBulkCentrosCusto(
  tenantId: string,
  clienteId: string,
  rows: ImportRow[],
): Promise<ImportReport> {
  const report: ImportReport = { totalLinhas: rows.length, criados: 0, atualizados: 0, erros: [] };

  // 1ª passada: criar/atualizar sem parentId
  const existentes = await db.select({ id: centrosCusto.id, codigo: centrosCusto.codigo })
    .from(centrosCusto)
    .where(and(eq(centrosCusto.tenantId, tenantId), eq(centrosCusto.clienteId, clienteId)));
  const codigoToId = new Map<string, string>(existentes.map((e) => [e.codigo, e.id]));

  const parentResolutions: { codigo: string; parentCodigo: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 1;
    try {
      const v = importRowSchema.parse(rows[i]);
      const tipo = v.tipo ?? "departamento";
      if (tipo === "projeto" && (!v.dataInicio || !v.dataFim)) {
        report.erros.push({ linha, codigo: v.codigo, mensagem: "tipo=projeto exige dataInicio e dataFim" });
        continue;
      }
      const baseValues: any = {
        tenantId, clienteId,
        codigo: v.codigo,
        nome: v.nome,
        tipo,
        responsavel: v.responsavel ?? null,
        dataInicio: v.dataInicio ?? null,
        dataFim: v.dataFim ?? null,
        orcamentoAnual: v.orcamentoAnual == null || v.orcamentoAnual === "" ? null : String(v.orcamentoAnual),
        cor: v.cor ?? "#6366f1",
        ativo: true,
      };
      const existingId = codigoToId.get(v.codigo);
      if (existingId) {
        await db.update(centrosCusto).set(baseValues)
          .where(and(eq(centrosCusto.id, existingId), eq(centrosCusto.tenantId, tenantId)));
        report.atualizados++;
      } else {
        const [created] = await db.insert(centrosCusto).values(baseValues).returning({ id: centrosCusto.id });
        codigoToId.set(v.codigo, created.id);
        report.criados++;
      }
      if (v.parentCodigo) parentResolutions.push({ codigo: v.codigo, parentCodigo: v.parentCodigo });
    } catch (e: any) {
      const codigoOrig = rows[i]?.codigo ?? "";
      const msg = e?.issues ? e.issues.map((it: any) => it.message).join("; ") : (e?.message ?? "erro");
      report.erros.push({ linha, codigo: codigoOrig, mensagem: msg });
    }
  }

  // 2ª passada: vincular parentId
  for (const r of parentResolutions) {
    const childId = codigoToId.get(r.codigo);
    const parentId = codigoToId.get(r.parentCodigo);
    if (!childId) continue;
    if (!parentId) {
      report.erros.push({ linha: 0, codigo: r.codigo, mensagem: `parentCodigo ${r.parentCodigo} não encontrado` });
      continue;
    }
    if (parentId === childId) {
      report.erros.push({ linha: 0, codigo: r.codigo, mensagem: "CC não pode ser pai de si mesmo" });
      continue;
    }
    await db.update(centrosCusto).set({ parentId })
      .where(and(eq(centrosCusto.id, childId), eq(centrosCusto.tenantId, tenantId)));
  }

  return report;
}

/**
 * Calcula valor utilizado de um CC em um mês considerando:
 * - lançamentos com `centroCustoId` direto (sem rateio): valor inteiro
 * - lançamentos rateados: soma dos `valorRateado` das linhas do CC
 * Considera apenas status=`pago` para "realizado" (default).
 */
export async function calcOrcamentoUtilizado(
  tenantId: string,
  clienteId: string,
  ccId: string,
  ano: number,
  mes: number,
  status: string[] = ["pago"],
): Promise<{ utilizado: number; lancamentos: number }> {
  const dataIni = new Date(Date.UTC(ano, mes - 1, 1)).toISOString().slice(0, 10);
  const dataFim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);

  // Direto
  const directos = await db.execute(sql`
    SELECT COALESCE(SUM(valor)::numeric, 0) AS total, COUNT(*)::int AS qtd
    FROM lancamentos_financeiros
    WHERE tenant_id = ${tenantId}
      AND cliente_id = ${clienteId}
      AND centro_custo_id = ${ccId}
      AND data_vencimento BETWEEN ${dataIni} AND ${dataFim}
      AND status = ANY(${status as any})
      AND id NOT IN (SELECT lancamento_id FROM rateios_cc WHERE tenant_id = ${tenantId})
  `);
  const dRow: any = (directos as any).rows?.[0] ?? (directos as any)[0] ?? {};
  const totalDirect = Number(dRow.total ?? 0);
  const qtdDirect = Number(dRow.qtd ?? 0);

  // Rateados — defesa em profundidade: filtra tenant_id em ambas as tabelas.
  const rateados = await db.execute(sql`
    SELECT COALESCE(SUM(r.valor_rateado)::numeric, 0) AS total, COUNT(*)::int AS qtd
    FROM rateios_cc r
    JOIN lancamentos_financeiros l ON l.id = r.lancamento_id
    WHERE r.tenant_id = ${tenantId}
      AND l.tenant_id = ${tenantId}
      AND r.centro_custo_id = ${ccId}
      AND l.cliente_id = ${clienteId}
      AND l.data_vencimento BETWEEN ${dataIni} AND ${dataFim}
      AND l.status = ANY(${status as any})
  `);
  const rRow: any = (rateados as any).rows?.[0] ?? (rateados as any)[0] ?? {};
  const totalRateado = Number(rRow.total ?? 0);
  const qtdRateado = Number(rRow.qtd ?? 0);

  return { utilizado: totalDirect + totalRateado, lancamentos: qtdDirect + qtdRateado };
}
