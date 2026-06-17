// Sprint C8 — Orçamento mensal: matriz, upsert em lote e Realizado × Previsto.

import { db } from "../db";
import {
  orcamentosMensais,
  planosContas,
  lancamentosFinanceiros,
  type OrcamentoMensal,
} from "@shared/schema";
import { and, eq, sql, asc } from "drizzle-orm";

const DEFAULT_THRESHOLD_PCT = 15;

export interface MatrizCelula {
  mes: number;
  valor: string;
  centroCustoId: string | null;
  id: string;
}
export interface MatrizLinha {
  planoContaId: string;
  codigo: string;
  descricao: string;
  natureza: string;
  grupoDre: string | null;
  meses: Record<number, string>; // soma simples (todos os CC) para rendering principal
  detalhes: MatrizCelula[]; // opcional, p/ explosão por CC
}

export interface MatrizResposta {
  ano: number;
  contas: MatrizLinha[];
}

/**
 * Retorna a matriz contas × meses para o ano. Inclui contas analíticas
 * (permiteLancamento=true ou tipoConta='analitica') sem orçamento (zeros).
 */
export async function getMatriz(
  tenantId: string,
  clienteId: string,
  ano: number,
): Promise<MatrizResposta> {
  // 1) Contas analíticas do tenant (apenas naturezas que entram no DRE).
  const contas = await db
    .select({
      id: planosContas.id,
      codigo: planosContas.codigo,
      descricao: planosContas.descricao,
      natureza: planosContas.natureza,
      grupoDre: planosContas.grupoDre,
      tipoConta: planosContas.tipoConta,
      permiteLancamento: planosContas.permiteLancamento,
    })
    .from(planosContas)
    .where(and(eq(planosContas.tenantId, tenantId), eq(planosContas.ativo, true)))
    .orderBy(asc(planosContas.codigo));

  const analiticas = contas.filter(
    (c) => c.tipoConta === "analitica" || (c.tipoConta == null && (c.permiteLancamento ?? true)),
  );

  // 2) Orçamentos do ano (todos os CC agregados).
  const ors = await db
    .select()
    .from(orcamentosMensais)
    .where(and(
      eq(orcamentosMensais.tenantId, tenantId),
      eq(orcamentosMensais.clienteId, clienteId),
      eq(orcamentosMensais.ano, ano),
    ));

  const map = new Map<string, MatrizLinha>();
  for (const c of analiticas) {
    map.set(c.id, {
      planoContaId: c.id,
      codigo: c.codigo,
      descricao: c.descricao,
      natureza: c.natureza,
      grupoDre: c.grupoDre,
      meses: {},
      detalhes: [],
    });
  }
  for (const o of ors) {
    const linha = map.get(o.planoContaId);
    if (!linha) continue;
    const mes = o.mes;
    const atual = Number(linha.meses[mes] ?? 0);
    linha.meses[mes] = String(atual + Number(o.valorPrevisto));
    linha.detalhes.push({
      id: o.id,
      mes,
      valor: String(o.valorPrevisto),
      centroCustoId: o.centroCustoId,
    });
  }

  return { ano, contas: Array.from(map.values()) };
}

export interface UpsertItem {
  planoContaId: string;
  centroCustoId?: string | null;
  ano: number;
  mes: number;
  valorPrevisto: number | string;
  thresholdAlertaPct?: number | string | null;
}

/**
 * Upsert em lote. Idempotente via UNIQUE(tenantId, clienteId, planoContaId,
 * centroCustoId, ano, mes). Aceita valorPrevisto=0 para "limpar" a célula.
 */
export async function upsertBatch(
  tenantId: string,
  clienteId: string,
  userId: string | null,
  items: UpsertItem[],
): Promise<{ ok: true; processados: number }> {
  if (items.length === 0) return { ok: true, processados: 0 };
  await db.transaction(async (tx) => {
    for (const it of items) {
      if (it.mes < 1 || it.mes > 12) throw new Error(`Mês inválido: ${it.mes}`);
      const valor = String(Number(it.valorPrevisto));
      const cc = it.centroCustoId ?? null;
      // Faz UPDATE primeiro; se 0 linhas, INSERT. Atende ambos os índices
      // únicos parciais (com/sem CC) sem precisar declarar onConflict
      // (Drizzle não modela índices parciais em onConflict facilmente).
      const conds = [
        eq(orcamentosMensais.tenantId, tenantId),
        eq(orcamentosMensais.clienteId, clienteId),
        eq(orcamentosMensais.planoContaId, it.planoContaId),
        eq(orcamentosMensais.ano, it.ano),
        eq(orcamentosMensais.mes, it.mes),
      ];
      conds.push(
        cc === null
          ? sql`${orcamentosMensais.centroCustoId} IS NULL`
          : eq(orcamentosMensais.centroCustoId, cc),
      );
      const updated = await tx
        .update(orcamentosMensais)
        .set({
          valorPrevisto: valor,
          thresholdAlertaPct: it.thresholdAlertaPct == null ? null : String(Number(it.thresholdAlertaPct)),
          updatedAt: new Date(),
        })
        .where(and(...conds))
        .returning({ id: orcamentosMensais.id });
      if (updated.length === 0) {
        await tx.insert(orcamentosMensais).values({
          tenantId,
          clienteId,
          planoContaId: it.planoContaId,
          centroCustoId: cc,
          ano: it.ano,
          mes: it.mes,
          valorPrevisto: valor,
          thresholdAlertaPct: it.thresholdAlertaPct == null ? null : String(Number(it.thresholdAlertaPct)),
          criadoPor: userId,
        } as any);
      }
    }
  });
  return { ok: true, processados: items.length };
}

export interface ComparativoLinha {
  planoContaId: string;
  codigo: string;
  conta: string;
  natureza: string;
  grupoDre: string | null;
  previsto: number;
  realizado: number;
  desvio: number; // realizado - previsto
  desvioPerc: number | null; // % | null se previsto=0
  alerta: boolean; // |desvioPerc| > threshold
  threshold: number;
}

/**
 * Comparativo Realizado × Previsto. Realizado = SUM dos lançamentos com
 * status='pago' no período (data_pagamento dentro do mês/ano).
 *
 * - Se mes vier (1..12): retorna apenas o mês.
 * - Caso contrário: retorna o acumulado do ano.
 */
export async function getComparativo(
  tenantId: string,
  clienteId: string,
  ano: number,
  mes: number | null,
  thresholdDefaultPct: number = DEFAULT_THRESHOLD_PCT,
): Promise<{ ano: number; mes: number | null; threshold: number; linhas: ComparativoLinha[] }> {
  // Janela de datas
  const monthExpr = mes
    ? sql`AND EXTRACT(MONTH FROM data_pagamento)::int = ${mes}`
    : sql``;
  const previstoFilter = mes
    ? and(eq(orcamentosMensais.ano, ano), eq(orcamentosMensais.mes, mes))
    : eq(orcamentosMensais.ano, ano);

  // Previsto agregado por planoContaId
  const previstoRows = await db
    .select({
      planoContaId: orcamentosMensais.planoContaId,
      total: sql<string>`COALESCE(SUM(${orcamentosMensais.valorPrevisto}), 0)`,
      maxThreshold: sql<string | null>`MAX(${orcamentosMensais.thresholdAlertaPct})`,
    })
    .from(orcamentosMensais)
    .where(and(
      eq(orcamentosMensais.tenantId, tenantId),
      eq(orcamentosMensais.clienteId, clienteId),
      previstoFilter as any,
    ))
    .groupBy(orcamentosMensais.planoContaId);

  const previstoMap = new Map<string, { total: number; threshold: number | null }>();
  for (const r of previstoRows) {
    previstoMap.set(r.planoContaId, {
      total: Number(r.total),
      threshold: r.maxThreshold == null ? null : Number(r.maxThreshold),
    });
  }

  // Realizado agregado por planoContaId (lançamentos pagos no período)
  const realizadoRows = await db.execute(sql`
    SELECT plano_conta_id AS plano_conta_id,
           COALESCE(SUM(valor), 0)::text AS total
      FROM lancamentos_financeiros
     WHERE tenant_id = ${tenantId}
       AND cliente_id = ${clienteId}
       AND status = 'pago'
       AND data_pagamento IS NOT NULL
       AND EXTRACT(YEAR FROM data_pagamento)::int = ${ano}
       ${monthExpr}
       AND plano_conta_id IS NOT NULL
     GROUP BY plano_conta_id
  `);
  const realizadoMap = new Map<string, number>();
  for (const r of realizadoRows.rows as any[]) {
    realizadoMap.set(r.plano_conta_id, Number(r.total));
  }

  // Une com plano de contas para resolver nomes
  const ids = new Set<string>([...previstoMap.keys(), ...realizadoMap.keys()]);
  if (ids.size === 0) return { ano, mes, threshold: thresholdDefaultPct, linhas: [] };

  const contas = await db
    .select({
      id: planosContas.id,
      codigo: planosContas.codigo,
      descricao: planosContas.descricao,
      natureza: planosContas.natureza,
      grupoDre: planosContas.grupoDre,
    })
    .from(planosContas)
    .where(and(eq(planosContas.tenantId, tenantId)));
  const contaMap = new Map(contas.map((c) => [c.id, c]));

  const linhas: ComparativoLinha[] = [];
  for (const id of ids) {
    const c = contaMap.get(id);
    if (!c) continue;
    const previsto = previstoMap.get(id)?.total ?? 0;
    const realizado = realizadoMap.get(id) ?? 0;
    const desvio = realizado - previsto;
    const desvioPerc = previsto === 0 ? null : (desvio / previsto) * 100;
    const threshold = previstoMap.get(id)?.threshold ?? thresholdDefaultPct;
    const alerta = desvioPerc !== null && Math.abs(desvioPerc) > threshold;
    linhas.push({
      planoContaId: id,
      codigo: c.codigo,
      conta: c.descricao,
      natureza: c.natureza,
      grupoDre: c.grupoDre,
      previsto,
      realizado,
      desvio,
      desvioPerc,
      alerta,
      threshold,
    });
  }
  // Ordena por código de conta
  linhas.sort((a, b) => a.codigo.localeCompare(b.codigo));
  return { ano, mes, threshold: thresholdDefaultPct, linhas };
}
