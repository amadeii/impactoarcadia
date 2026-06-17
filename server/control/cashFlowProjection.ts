/**
 * cashFlowProjection.ts — Sprint 3 Recovery
 *
 * Projeção mês a mês do caixa de um cliente do Control:
 *   saldoInicial (soma saldoAtual contas_bancarias)
 *   + entradas (lancamentos tipo='receber' com vencimento no mês, status != cancelado)
 *   - saídas   (lancamentos tipo='pagar'   com vencimento no mês, status != cancelado)
 *   = saldoFinal
 *
 * O guard `canReleaseToControl` é usado pelo módulo Recovery antes de liberar
 * uma parcela para o Control. Garante que liberar não estoura o buffer mínimo
 * de caixa configurado (default 15%).
 */
import { db } from "../db";
import { contasBancarias, lancamentosFinanceiros } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

export interface CashFlowMonth {
  month: string; // YYYY-MM
  openingBalance: number;
  inflows: number;
  outflows: number;
  closingBalance: number;
}

function ymKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  return r;
}

/**
 * Retorna projeção a partir do mês corrente por `monthsAhead` meses.
 * Inclui o mês corrente como índice 0.
 */
export async function getProjectedCashFlow(
  tenantId: string,
  clienteId: string,
  monthsAhead = 6,
): Promise<CashFlowMonth[]> {
  if (monthsAhead < 1) monthsAhead = 1;
  if (monthsAhead > 24) monthsAhead = 24;

  // 1) Saldo inicial: soma saldoAtual de todas contas ativas do cliente
  const [bal] = await db
    .select({ total: sql<string>`COALESCE(SUM(${contasBancarias.saldoAtual}), 0)` })
    .from(contasBancarias)
    .where(and(
      eq(contasBancarias.tenantId, tenantId),
      eq(contasBancarias.clienteId, clienteId),
      eq(contasBancarias.ativo, true),
    ));
  const initial = Number(bal?.total ?? 0);

  // 2) Agrupa lançamentos não cancelados por mês de vencimento
  const rows = await db.execute(sql`
    SELECT
      to_char(data_vencimento, 'YYYY-MM') AS ym,
      tipo,
      COALESCE(SUM(valor), 0)::numeric AS total
    FROM lancamentos_financeiros
    WHERE tenant_id = ${tenantId}
      AND cliente_id = ${clienteId}
      AND status NOT IN ('cancelado', 'pago')
      AND data_vencimento >= date_trunc('month', CURRENT_DATE)
    GROUP BY 1, 2
  `);
  const dataRows = (rows as any).rows ?? rows;

  const map = new Map<string, { in: number; out: number }>();
  for (const r of dataRows as Array<{ ym: string; tipo: string; total: string | number }>) {
    if (!r.ym) continue;
    const cur = map.get(r.ym) ?? { in: 0, out: 0 };
    const v = Number(r.total ?? 0);
    if (r.tipo === "receber") cur.in += v;
    else if (r.tipo === "pagar") cur.out += v;
    map.set(r.ym, cur);
  }

  // 3) Monta série
  const today = new Date();
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const result: CashFlowMonth[] = [];
  let opening = initial;
  for (let i = 0; i < monthsAhead; i++) {
    const month = addMonths(cursor, i);
    const key = ymKey(month);
    const flows = map.get(key) ?? { in: 0, out: 0 };
    const closing = opening + flows.in - flows.out;
    result.push({
      month: key,
      openingBalance: round2(opening),
      inflows: round2(flows.in),
      outflows: round2(flows.out),
      closingBalance: round2(closing),
    });
    opening = closing;
  }
  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface CashFlowGuardResult {
  ok: boolean;
  reason?: string;
  projectedBalance: number;
  bufferRequired: number;
  monthEvaluated: string;
}

/**
 * Avalia se liberar uma parcela de `valor` com vencimento `dueDate` mantém o
 * caixa do mês correspondente acima do buffer mínimo (default 15%).
 *
 * Retorna {ok:true} se a projeção do mês alvo (após adicionar o pagamento)
 * permanecer >= buffer% do saldo do mês. Caso contrário ok:false com motivo.
 */
export async function canReleaseToControl(
  tenantId: string,
  clienteId: string,
  dueDate: string | Date,
  valor: number,
  bufferPct = 0.15,
): Promise<CashFlowGuardResult> {
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const today = new Date();
  // Calcula meses entre hoje e o vencimento
  const monthsAhead = Math.max(1,
    (due.getUTCFullYear() - today.getUTCFullYear()) * 12 +
    (due.getUTCMonth() - today.getUTCMonth()) + 1,
  );
  const series = await getProjectedCashFlow(tenantId, clienteId, Math.min(monthsAhead, 24));
  const targetKey = ymKey(new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), 1)));
  const target = series.find((s) => s.month === targetKey) ?? series[series.length - 1];

  // Caixa projetado já desconta payables existentes; aqui simulamos liberar mais um
  const projectedAfterRelease = target.closingBalance - valor;
  // Buffer = max(0, closingBalance) * pct. Se saldo já é negativo, qualquer
  // saída adicional bloqueia (buffer 0 mas projectedAfterRelease também negativo).
  const bufferRequired = round2(Math.max(0, target.closingBalance) * bufferPct);

  if (projectedAfterRelease >= bufferRequired) {
    return {
      ok: true,
      projectedBalance: round2(projectedAfterRelease),
      bufferRequired,
      monthEvaluated: target.month,
    };
  }
  return {
    ok: false,
    reason: `Caixa projetado para ${target.month} (R$ ${target.closingBalance.toFixed(2)}) ` +
      `não suporta a parcela de R$ ${valor.toFixed(2)} mantendo o buffer mínimo de ${(bufferPct * 100).toFixed(0)}% ` +
      `(R$ ${bufferRequired.toFixed(2)}).`,
    projectedBalance: round2(projectedAfterRelease),
    bufferRequired,
    monthEvaluated: target.month,
  };
}
