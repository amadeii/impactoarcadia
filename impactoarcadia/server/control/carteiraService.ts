// Sprint C10 — G13 Carteiras corporativas (cartões nominais ex.: Caju).
// Modeladas como contas_bancarias com tipo='carteira' e responsavelId
// apontando para um colaborador (texto livre via apelido por enquanto).
// Sem schema novo — apenas filtros e operações sobre extratos existentes.

import { db } from "../db";
import { and, eq, sql } from "drizzle-orm";
import {
  contasBancarias, lancamentosFinanceiros,
} from "@shared/schema";

export interface CarteiraResumo {
  id: string;
  apelido: string | null;
  banco: string;
  responsavelId: string | null;
  saldoAtual: number;
  pendentes: number; // lançamentos sem aprovação
  totalGastoMes: number;
}

export async function listCarteiras(tenantId: string, clienteId: string): Promise<CarteiraResumo[]> {
  const carteiras = await db.select()
    .from(contasBancarias)
    .where(and(
      eq(contasBancarias.tenantId, tenantId),
      eq(contasBancarias.clienteId, clienteId),
      eq(contasBancarias.tipo, "carteira"),
      eq(contasBancarias.ativo, true),
    ));

  const out: CarteiraResumo[] = [];
  for (const c of carteiras) {
    const stats = await db.execute<{ pendentes: number; gasto_mes: string }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'previsto' OR status = 'aprovado')::int AS pendentes,
        COALESCE(SUM(CASE WHEN status='pago' AND date_trunc('month', data_pagamento::timestamp) = date_trunc('month', now())
                          THEN ABS(valor) ELSE 0 END), 0) AS gasto_mes
      FROM lancamentos_financeiros
      WHERE tenant_id = ${tenantId} AND cliente_id = ${clienteId}
        AND conta_bancaria_id = ${c.id}
    `);
    const s = stats.rows[0] ?? { pendentes: 0, gasto_mes: "0" };
    out.push({
      id: c.id,
      apelido: c.apelido,
      banco: c.banco,
      responsavelId: c.responsavelId,
      saldoAtual: Number(c.saldoAtual ?? 0),
      pendentes: Number(s.pendentes ?? 0),
      totalGastoMes: Number(s.gasto_mes ?? 0),
    });
  }
  return out;
}

/**
 * Aprova ou rejeita um lançamento da carteira. Aprovação muda status
 * para 'aprovado'; rejeição cancela e adiciona observação.
 */
export async function aprovarLancamento(
  tenantId: string, lancamentoId: string,
  acao: "aprovar" | "rejeitar", motivo?: string,
): Promise<{ ok: boolean }> {
  const novoStatus = acao === "aprovar" ? "aprovado" : "cancelado";
  const obs = acao === "rejeitar" ? `[Rejeitado pelo gestor] ${motivo ?? ""}`.trim() : null;
  await db.update(lancamentosFinanceiros)
    .set({
      status: novoStatus,
      ...(obs ? { observacoes: obs } : {}),
      updatedAt: new Date(),
    })
    .where(and(
      eq(lancamentosFinanceiros.tenantId, tenantId),
      eq(lancamentosFinanceiros.id, lancamentoId),
    ));
  return { ok: true };
}

export async function getExerciciosDisponiveis(
  tenantId: string, clienteId: string,
): Promise<number[]> {
  const r = await db.execute<{ ano: number }>(sql`
    SELECT DISTINCT EXTRACT(YEAR FROM data_vencimento)::int AS ano
    FROM lancamentos_financeiros
    WHERE tenant_id = ${tenantId} AND cliente_id = ${clienteId}
      AND data_vencimento IS NOT NULL
    UNION
    SELECT DISTINCT EXTRACT(YEAR FROM data_pagamento)::int AS ano
    FROM lancamentos_financeiros
    WHERE tenant_id = ${tenantId} AND cliente_id = ${clienteId}
      AND data_pagamento IS NOT NULL
    ORDER BY ano DESC
  `);
  const anos = r.rows.map((x) => Number(x.ano)).filter((n) => n > 1900 && n < 2200);
  if (anos.length === 0) anos.push(new Date().getFullYear());
  return anos;
}
