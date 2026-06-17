// Sprint C10 — G12 Pivot Cliente × Mês (e Fornecedor × Mês).
// Agrupa por `favorecido` (texto livre — schema atual de
// lancamentos_financeiros não tem pessoaId). Lançamentos sem favorecido
// caem em "Sem identificação".

import { db } from "../db";
import { sql } from "drizzle-orm";

const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export interface PivotRow {
  pessoa: string;
  meses: number[]; // 12 posições
  total: number;
  percentual: number; // % do total geral
}
export interface PivotResultado {
  ano: number;
  tipo: "receber" | "pagar";
  rows: PivotRow[];
  totalGeral: number;
  totaisMensais: number[];
  top3Concentracao: number; // % top-3 sobre total
  alertaConcentracao: boolean; // top3 > 60%
}

export async function getPivot(
  tenantId: string,
  clienteId: string,
  ano: number,
  tipo: "receber" | "pagar",
): Promise<PivotResultado> {
  const rows = await db.execute<{ favorecido: string | null; mes: number; total: string }>(sql`
    SELECT
      COALESCE(NULLIF(TRIM(lf.favorecido), ''), 'Sem identificação') AS favorecido,
      EXTRACT(MONTH FROM COALESCE(lf.data_pagamento, lf.data_vencimento))::int AS mes,
      SUM(ABS(lf.valor)) AS total
    FROM lancamentos_financeiros lf
    WHERE lf.tenant_id = ${tenantId}
      AND lf.cliente_id = ${clienteId}
      AND lf.tipo = ${tipo}
      AND lf.data_pagamento IS NOT NULL
      AND EXTRACT(YEAR FROM lf.data_pagamento) = ${ano}
    GROUP BY 1, 2
  `);

  const map = new Map<string, number[]>();
  for (const r of rows.rows) {
    const arr = map.get(r.favorecido!) ?? Array(12).fill(0);
    arr[r.mes - 1] = Number(r.total ?? 0);
    map.set(r.favorecido!, arr);
  }
  const list: PivotRow[] = Array.from(map.entries()).map(([pessoa, meses]) => ({
    pessoa,
    meses,
    total: meses.reduce((s, v) => s + v, 0),
    percentual: 0,
  }));
  list.sort((a, b) => b.total - a.total);
  const totalGeral = list.reduce((s, r) => s + r.total, 0);
  list.forEach((r) => { r.percentual = totalGeral > 0 ? +(r.total / totalGeral * 100).toFixed(2) : 0; });

  const totaisMensais = Array(12).fill(0);
  list.forEach((r) => r.meses.forEach((v, i) => totaisMensais[i] += v));

  const top3 = list.slice(0, 3).reduce((s, r) => s + r.total, 0);
  const top3Concentracao = totalGeral > 0 ? +(top3 / totalGeral * 100).toFixed(2) : 0;

  return {
    ano, tipo, rows: list, totalGeral, totaisMensais,
    top3Concentracao,
    alertaConcentracao: top3Concentracao > 60,
  };
}

export const PIVOT_MESES = MESES;
