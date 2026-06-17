// Sprint C9 — G10 PMP / PMR (Prazo Médio de Pagamento e Recebimento).
// PMP = SUM(dias * valor) / SUM(valor) sobre lançamentos pagos do tipo 'pagar'.
//   onde dias = (dataPagamento - dataEmissao) e dataEmissao IS NOT NULL.
// PMR = mesmo cálculo para tipo 'receber'.
// Retorna null gracioso quando não há lançamentos elegíveis.

import { db } from "../db";
import { sql } from "drizzle-orm";

export interface PmpPmrPeriodo {
  ano: number; mes: number | null;
  pmp: number | null;   // dias
  pmr: number | null;   // dias
  countPagar: number;
  countReceber: number;
  status: "saudavel" | "pressao" | "neutro" | "indisponivel";
}

async function calcularMedia(
  tenantId: string, clienteId: string, ano: number, mes: number | null,
  tipo: "pagar" | "receber",
): Promise<{ media: number | null; count: number }> {
  const filtroMes = mes ? sql`AND EXTRACT(MONTH FROM lf.data_pagamento) = ${mes}` : sql``;
  const r = await db.execute<{ media: string | null; count: number }>(sql`
    SELECT
      CASE WHEN SUM(ABS(lf.valor)) > 0
           THEN SUM((lf.data_pagamento - lf.data_emissao) * ABS(lf.valor)) / SUM(ABS(lf.valor))
           ELSE NULL END AS media,
      COUNT(*)::int AS count
    FROM lancamentos_financeiros lf
    WHERE lf.tenant_id = ${tenantId}
      AND lf.cliente_id = ${clienteId}
      AND lf.tipo = ${tipo}
      AND lf.data_pagamento IS NOT NULL
      AND lf.data_emissao IS NOT NULL
      AND lf.data_pagamento >= lf.data_emissao
      AND EXTRACT(YEAR FROM lf.data_pagamento) = ${ano}
      ${filtroMes}
  `);
  const row = r.rows[0];
  if (!row || row.count === 0 || row.media == null) return { media: null, count: row?.count ?? 0 };
  return { media: +Number(row.media).toFixed(1), count: Number(row.count) };
}

export async function getPmpPmr(
  tenantId: string, clienteId: string, ano: number, mes: number | null,
): Promise<PmpPmrPeriodo> {
  const [pp, pr] = await Promise.all([
    calcularMedia(tenantId, clienteId, ano, mes, "pagar"),
    calcularMedia(tenantId, clienteId, ano, mes, "receber"),
  ]);
  let status: PmpPmrPeriodo["status"] = "indisponivel";
  if (pp.media !== null && pr.media !== null) {
    if (pr.media < pp.media) status = "saudavel";
    else if (pr.media > pp.media) status = "pressao";
    else status = "neutro";
  }
  return {
    ano, mes,
    pmp: pp.media, pmr: pr.media,
    countPagar: pp.count, countReceber: pr.count,
    status,
  };
}

/**
 * Histórico mensal de PMP/PMR para gráfico (default 6 meses retrocedendo).
 */
export async function getPmpPmrHistorico(
  tenantId: string, clienteId: string, mesesRetroativos = 6,
): Promise<Array<PmpPmrPeriodo & { label: string }>> {
  const hoje = new Date();
  const out: Array<PmpPmrPeriodo & { label: string }> = [];
  for (let i = mesesRetroativos - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;
    const r = await getPmpPmr(tenantId, clienteId, ano, mes);
    out.push({ ...r, label: `${String(mes).padStart(2, "0")}/${ano}` });
  }
  return out;
}
