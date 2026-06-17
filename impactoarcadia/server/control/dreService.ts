// Sprint C9 — G9 DRE com Análise Vertical (AV%) + coluna Previsto (vinda do C8).
// Sem schema novo: agrega lancamentos_financeiros (realizado) + orcamentos_mensais
// (previsto). AV% = valorLinha / receitaBruta * 100; receitaBruta = SUM dos
// grupos receita_bruta. Quando receitaBruta=0, retorna avPerc=null.

import { db } from "../db";
import { sql } from "drizzle-orm";

export interface DreLinha {
  grupoDre: string;
  natureza: string | null;
  realizado: number;
  previsto: number;
  avPerc: number | null;       // Análise vertical
  desvio: number;              // realizado - previsto
  desvioPerc: number | null;
  alerta: boolean;             // |desvioPerc| > threshold
}
export interface DreResultado {
  ano: number; mes: number | null;
  threshold: number;
  receitaBruta: number;
  totalCustos: number;
  totalDespesas: number;
  resultado: number;
  margemPerc: number | null;
  linhas: DreLinha[];
}

/**
 * DRE consolidado por grupo_dre (regime caixa: dataPagamento IS NOT NULL).
 * Quando mes=null, agrega o ano todo.
 */
export async function getDreComAv(
  tenantId: string,
  clienteId: string,
  ano: number,
  mes: number | null,
  threshold = 15,
): Promise<DreResultado> {
  const filtroMesReal = mes ? sql`AND EXTRACT(MONTH FROM lf.data_pagamento) = ${mes}` : sql``;
  const filtroMesPrev = mes ? sql`AND om.mes = ${mes}` : sql``;

  const realizadoRows = await db.execute<{ grupo_dre: string; natureza: string | null; total: string }>(sql`
    SELECT pc.grupo_dre, MAX(pc.natureza) AS natureza, SUM(ABS(lf.valor)) AS total
    FROM lancamentos_financeiros lf
    INNER JOIN planos_contas pc ON pc.id = lf.plano_conta_id
    WHERE lf.tenant_id = ${tenantId}
      AND lf.cliente_id = ${clienteId}
      AND pc.grupo_dre IS NOT NULL
      AND lf.data_pagamento IS NOT NULL
      AND EXTRACT(YEAR FROM lf.data_pagamento) = ${ano}
      ${filtroMesReal}
    GROUP BY pc.grupo_dre
  `);

  const previstoRows = await db.execute<{ grupo_dre: string; total: string }>(sql`
    SELECT pc.grupo_dre, SUM(om.valor_previsto) AS total
    FROM orcamentos_mensais om
    INNER JOIN planos_contas pc ON pc.id = om.plano_conta_id
    WHERE om.tenant_id = ${tenantId}
      AND om.cliente_id = ${clienteId}
      AND pc.grupo_dre IS NOT NULL
      AND om.ano = ${ano}
      ${filtroMesPrev}
    GROUP BY pc.grupo_dre
  `);

  const grupos = new Set<string>();
  realizadoRows.rows.forEach((r) => grupos.add(r.grupo_dre));
  previstoRows.rows.forEach((r) => grupos.add(r.grupo_dre));

  // Receita bruta = soma dos grupos cujo nome começa com 'receita'.
  const receitaBruta = realizadoRows.rows
    .filter((r) => r.grupo_dre === "receita_bruta" || r.grupo_dre?.startsWith("receita"))
    .reduce((s, r) => s + Number(r.total ?? 0), 0);

  const linhas: DreLinha[] = [];
  let totalCustos = 0, totalDespesas = 0;
  for (const grupoDre of Array.from(grupos).sort()) {
    const realRow = realizadoRows.rows.find((r) => r.grupo_dre === grupoDre);
    const prevRow = previstoRows.rows.find((r) => r.grupo_dre === grupoDre);
    const realizado = Number(realRow?.total ?? 0);
    const previsto = Number(prevRow?.total ?? 0);
    const avPerc = receitaBruta > 0 ? +(realizado / receitaBruta * 100).toFixed(2) : null;
    const desvio = +(realizado - previsto).toFixed(2);
    const desvioPerc = previsto > 0 ? +((realizado - previsto) / previsto * 100).toFixed(2) : null;
    const alerta = desvioPerc !== null && Math.abs(desvioPerc) > threshold;
    const natureza = realRow?.natureza ?? null;
    if (grupoDre.startsWith("cmv") || grupoDre === "custo" || natureza === "custo") totalCustos += realizado;
    else if (grupoDre.startsWith("despesas") || natureza === "despesa") totalDespesas += realizado;
    linhas.push({ grupoDre, natureza, realizado, previsto, avPerc, desvio, desvioPerc, alerta });
  }

  const resultado = +(receitaBruta - totalCustos - totalDespesas).toFixed(2);
  const margemPerc = receitaBruta > 0 ? +(resultado / receitaBruta * 100).toFixed(2) : null;

  return { ano, mes, threshold, receitaBruta, totalCustos, totalDespesas, resultado, margemPerc, linhas };
}
