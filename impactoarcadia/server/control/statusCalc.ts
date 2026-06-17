// Sprint C7 — G6 — Status calculado virtual (sem coluna no banco).
// Reutilizado em GETs de lançamentos/recorrências/parcelamento.

import { sql } from "drizzle-orm";
import { lancamentosFinanceiros } from "@shared/schema";

/**
 * Fragmento SQL que calcula o status efetivo de um lançamento em tempo real:
 *   - 'pago'        → tem dataPagamento
 *   - 'cancelado'   → status persistido = cancelado
 *   - 'atrasado'    → vencimento < CURRENT_DATE
 *   - 'vence_hoje'  → vencimento entre hoje e hoje+3 dias (alerta amarelo)
 *   - 'em_dia'      → caso contrário
 *
 * Não persistimos esse valor em coluna; sempre recalculamos no SELECT
 * para garantir que o status acompanhe a passagem dos dias sem job.
 */
export const statusCalcSql = sql<string>`
  CASE
    WHEN ${lancamentosFinanceiros.dataPagamento} IS NOT NULL THEN 'pago'
    WHEN ${lancamentosFinanceiros.status} = 'cancelado' THEN 'cancelado'
    WHEN ${lancamentosFinanceiros.dataVencimento} < CURRENT_DATE THEN 'atrasado'
    WHEN ${lancamentosFinanceiros.dataVencimento} <= CURRENT_DATE + INTERVAL '3 days' THEN 'vence_hoje'
    ELSE 'em_dia'
  END
`;
