// Sprint C9 — G7/G8 Fluxo de Caixa Mensal e Diário.
// Sem schema novo: tudo agregado de lancamentos_financeiros (realizado),
// orcamentos_mensais (previsto C8) e movimentacoes_bancarias (saldo).
//
// Convenções:
// - Realizado = SUM(ABS(valor)) onde dataPagamento IS NOT NULL.
// - Sinal de entrada/saída derivado de lancamentos.tipo ('receber' | 'pagar').
// - Saldo inicial do mês = saldo bancário no fim do mês anterior, calculado
//   a partir de movimentacoes_bancarias (saldo_apos da última movimentação
//   antes da data de corte) — ou somatório saldo_inicial das contas se vazio.

import { db } from "../db";
import { and, eq, sql, desc, isNotNull, inArray } from "drizzle-orm";
import {
  lancamentosFinanceiros, planosContas, orcamentosMensais,
  contasBancarias, movimentacoesBancarias,
} from "@shared/schema";
import { getDaysInMonth } from "date-fns";

export interface FluxoMesCell { mes: number; realizado: number; previsto: number; }
export interface FluxoMensalRow { grupoDre: string; meses: FluxoMesCell[]; totalRealizado: number; totalPrevisto: number; }
export interface FluxoMensal {
  ano: number;
  contaBancariaId: string | null;
  grupos: FluxoMensalRow[];
  saldoInicialAno: number;
  saldosFinaisMes: number[]; // 12 posições: saldo final de cada mês
  totaisEntradas: number[];
  totaisSaidas: number[];
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Saldo bancário acumulado até (mas excluindo) a data informada.
 * Estratégia: para cada conta ativa do cliente,
 *  1) pega a última movimentação com data < dataCorte → usa saldo_apos;
 *  2) se não houver, usa contas_bancarias.saldo_inicial.
 * Soma todas as contas filtradas (ou só uma se contaBancariaId vier).
 */
export async function calcularSaldoAteData(
  tenantId: string,
  clienteId: string,
  dataCorte: Date, // exclusivo
  contaBancariaId?: string,
): Promise<number> {
  const contas = await db.select({
    id: contasBancarias.id,
    saldoInicial: contasBancarias.saldoInicial,
  })
    .from(contasBancarias)
    .where(and(
      eq(contasBancarias.tenantId, tenantId),
      eq(contasBancarias.clienteId, clienteId),
      eq(contasBancarias.ativo, true),
      contaBancariaId ? eq(contasBancarias.id, contaBancariaId) : sql`1=1`,
    ));

  if (contas.length === 0) return 0;
  const corte = ymd(dataCorte);
  let total = 0;
  for (const c of contas) {
    const ultima = await db.select({ saldoApos: movimentacoesBancarias.saldoApos })
      .from(movimentacoesBancarias)
      .where(and(
        eq(movimentacoesBancarias.tenantId, tenantId),
        eq(movimentacoesBancarias.contaBancariaId, c.id),
        sql`${movimentacoesBancarias.data} < ${corte}::date`,
      ))
      .orderBy(desc(movimentacoesBancarias.data), desc(movimentacoesBancarias.createdAt))
      .limit(1);
    if (ultima.length > 0 && ultima[0].saldoApos != null) {
      total += Number(ultima[0].saldoApos);
    } else {
      total += Number(c.saldoInicial ?? 0);
    }
  }
  return total;
}

/**
 * Matriz Fluxo de Caixa Mensal: grupos DRE × 12 meses (Realizado/Previsto).
 * Usa 1 query agregada para realizado e 1 para previsto.
 */
export async function getFluxoCaixaMensal(
  tenantId: string,
  clienteId: string,
  ano: number,
  contaBancariaId?: string,
): Promise<FluxoMensal> {
  // Realizado por grupoDre × mês (agrupado em uma query só para evitar N+12 queries)
  const realizadoRows = await db.execute<{ grupo_dre: string; mes: number; total: string; tipo: string }>(sql`
    SELECT
      pc.grupo_dre AS grupo_dre,
      EXTRACT(MONTH FROM lf.data_pagamento)::int AS mes,
      lf.tipo AS tipo,
      SUM(ABS(lf.valor)) AS total
    FROM lancamentos_financeiros lf
    INNER JOIN planos_contas pc ON pc.id = lf.plano_conta_id
    WHERE lf.tenant_id = ${tenantId}
      AND lf.cliente_id = ${clienteId}
      AND pc.grupo_dre IS NOT NULL
      AND lf.data_pagamento IS NOT NULL
      AND EXTRACT(YEAR FROM lf.data_pagamento) = ${ano}
      ${contaBancariaId ? sql`AND lf.conta_bancaria_id = ${contaBancariaId}` : sql``}
    GROUP BY pc.grupo_dre, EXTRACT(MONTH FROM lf.data_pagamento), lf.tipo
  `);

  const previstoRows = await db.execute<{ grupo_dre: string; mes: number; total: string }>(sql`
    SELECT pc.grupo_dre AS grupo_dre, om.mes AS mes, SUM(om.valor_previsto) AS total
    FROM orcamentos_mensais om
    INNER JOIN planos_contas pc ON pc.id = om.plano_conta_id
    WHERE om.tenant_id = ${tenantId}
      AND om.cliente_id = ${clienteId}
      AND pc.grupo_dre IS NOT NULL
      AND om.ano = ${ano}
    GROUP BY pc.grupo_dre, om.mes
  `);

  // Constrói matriz
  const gruposSet = new Set<string>();
  for (const r of realizadoRows.rows) gruposSet.add(r.grupo_dre);
  for (const r of previstoRows.rows) gruposSet.add(r.grupo_dre);
  const grupos: FluxoMensalRow[] = [];

  // Totais por mês para Entradas/Saídas (derivados de lf.tipo)
  const entradas = Array(12).fill(0);
  const saidas = Array(12).fill(0);
  for (const r of realizadoRows.rows) {
    const v = Number(r.total ?? 0);
    if (r.tipo === "receber") entradas[r.mes - 1] += v;
    else if (r.tipo === "pagar") saidas[r.mes - 1] += v;
  }

  for (const grupoDre of Array.from(gruposSet).sort()) {
    const meses: FluxoMesCell[] = [];
    let totalR = 0, totalP = 0;
    for (let m = 1; m <= 12; m++) {
      const realizado = realizadoRows.rows
        .filter((r) => r.grupo_dre === grupoDre && r.mes === m)
        .reduce((s, r) => s + Number(r.total ?? 0), 0);
      const previsto = previstoRows.rows
        .filter((r) => r.grupo_dre === grupoDre && r.mes === m)
        .reduce((s, r) => s + Number(r.total ?? 0), 0);
      meses.push({ mes: m, realizado, previsto });
      totalR += realizado;
      totalP += previsto;
    }
    grupos.push({ grupoDre, meses, totalRealizado: totalR, totalPrevisto: totalP });
  }

  // Saldo inicial do ano (1º de janeiro) e saldos finais por mês
  const saldoInicialAno = await calcularSaldoAteData(
    tenantId, clienteId, new Date(ano, 0, 1), contaBancariaId,
  );
  const saldosFinaisMes: number[] = [];
  let acumulado = saldoInicialAno;
  for (let m = 0; m < 12; m++) {
    acumulado += entradas[m] - saidas[m];
    saldosFinaisMes.push(acumulado);
  }

  return {
    ano,
    contaBancariaId: contaBancariaId ?? null,
    grupos,
    saldoInicialAno,
    saldosFinaisMes,
    totaisEntradas: entradas,
    totaisSaidas: saidas,
  };
}

export interface DiarioLancamento {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  status: string;
  pago: boolean;
  contaBancariaId: string | null;
}
export interface DiarioDia {
  dia: number;
  data: string;
  entradas: number;
  saidas: number;
  saldoDia: number;
  saldoAcumulado: number;
  isHoje: boolean;
  lancamentos: DiarioLancamento[];
}
export interface FluxoDiario {
  ano: number; mes: number;
  contaBancariaId: string | null;
  saldoInicial: number;
  dias: DiarioDia[];
}

/**
 * Fluxo de Caixa Diário: tabela dia a dia do mês.
 * Lançamentos agrupados por COALESCE(dataPagamento, dataVencimento).
 * Saldo inicial = saldo bancário ao fim do mês anterior.
 */
export async function getFluxoCaixaDiario(
  tenantId: string,
  clienteId: string,
  ano: number,
  mes: number,
  contaBancariaId?: string,
): Promise<FluxoDiario> {
  if (mes < 1 || mes > 12) throw new Error("Mês inválido");
  const diasNoMes = getDaysInMonth(new Date(ano, mes - 1));
  const saldoInicial = await calcularSaldoAteData(
    tenantId, clienteId, new Date(ano, mes - 1, 1), contaBancariaId,
  );

  const inicio = ymd(new Date(ano, mes - 1, 1));
  const fim = ymd(new Date(ano, mes - 1, diasNoMes));

  const lancamentos = await db.execute<{
    id: string; descricao: string; valor: string; tipo: string; status: string;
    conta_bancaria_id: string | null; data_ref: string; pago: boolean;
  }>(sql`
    SELECT
      lf.id, lf.descricao, lf.valor, lf.tipo, lf.status, lf.conta_bancaria_id,
      COALESCE(lf.data_pagamento, lf.data_vencimento)::text AS data_ref,
      (lf.data_pagamento IS NOT NULL) AS pago
    FROM lancamentos_financeiros lf
    WHERE lf.tenant_id = ${tenantId}
      AND lf.cliente_id = ${clienteId}
      AND lf.status != 'cancelado'
      AND COALESCE(lf.data_pagamento, lf.data_vencimento) BETWEEN ${inicio}::date AND ${fim}::date
      ${contaBancariaId ? sql`AND lf.conta_bancaria_id = ${contaBancariaId}` : sql``}
    ORDER BY data_ref ASC, lf.tipo ASC
  `);

  const hojeStr = ymd(new Date());
  const dias: DiarioDia[] = [];
  let acumulado = saldoInicial;
  for (let d = 1; d <= diasNoMes; d++) {
    const dataStr = ymd(new Date(ano, mes - 1, d));
    const linhasDia = lancamentos.rows.filter((l) => l.data_ref === dataStr);
    let entradas = 0, saidas = 0;
    const lancs: DiarioLancamento[] = linhasDia.map((l) => {
      const v = Math.abs(Number(l.valor));
      if (l.tipo === "receber") entradas += v;
      else if (l.tipo === "pagar") saidas += v;
      return {
        id: l.id, descricao: l.descricao, valor: v,
        tipo: l.tipo, status: l.status, pago: !!l.pago,
        contaBancariaId: l.conta_bancaria_id,
      };
    });
    const saldoDia = entradas - saidas;
    acumulado += saldoDia;
    dias.push({
      dia: d, data: dataStr,
      entradas, saidas, saldoDia, saldoAcumulado: acumulado,
      isHoje: dataStr === hojeStr,
      lancamentos: lancs,
    });
  }

  return { ano, mes, contaBancariaId: contaBancariaId ?? null, saldoInicial, dias };
}
