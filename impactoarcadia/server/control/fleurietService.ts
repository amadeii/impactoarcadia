import { db } from "../db";
import {
  lancamentosFinanceiros,
  contasBancarias,
  planosContas,
} from "@shared/schema";
import { and, eq, sql, lte } from "drizzle-orm";

/**
 * Modelo Fleuriet — diagnóstico estrutural de capital de giro.
 *
 * Conceitos:
 *   NCG  = Necessidade de Capital de Giro = AC operacional − PC operacional
 *   CGL  = Capital de Giro Líquido        = AC total − PC total
 *   ST   = Saldo de Tesouraria            = CGL − NCG
 *
 * Diagnóstico:
 *   - ST < 0 e NCG > 0  → Situação financeira FRÁGIL (efeito tesoura)
 *   - ST > 0 e NCG > 0  → Sólida
 *   - ST > 0 e NCG < 0  → Excelente liquidez
 *   - ST < 0 e NCG < 0  → Insuficiência de recursos
 *
 * Ciclo financeiro = PMR + PME − PMP
 * Ciclo operacional = PMR + PME
 *
 * Esta implementação é gerencial (baseada nos lançamentos do Control).
 * Para dados contábeis exatos, plugar o BP gerado pelo fechamentoService.
 */

export interface FleurietResult {
  data: string;
  ncg: number;
  cgl: number;
  saldoTesouraria: number;
  diagnostico: "fragil" | "solida" | "excelente" | "insuficiente";
  efeitoTesoura: boolean;
  cicloOperacional: number;
  cicloFinanceiro: number;
  detalhes: {
    contasReceber: number;
    estoque: number;
    contasPagar: number;
    disponivelBancario: number;
    emprestimosCp: number;
    pmr: number;
    pme: number;
    pmp: number;
  };
  observacoes: string[];
}

export async function calcularFleuriet(
  tenantId: string,
  clienteId: string,
  dataReferencia: Date = new Date(),
): Promise<FleurietResult> {
  const dataStr = dataReferencia.toISOString().slice(0, 10);

  // Contas a receber em aberto (operacional)
  const [{ total: receber } = { total: "0" }] = await db.select({
    total: sql<string>`COALESCE(SUM(${lancamentosFinanceiros.valor}), 0)`,
  })
    .from(lancamentosFinanceiros)
    .where(and(
      eq(lancamentosFinanceiros.tenantId, tenantId),
      eq(lancamentosFinanceiros.clienteId, clienteId),
      eq(lancamentosFinanceiros.tipo, "receber"),
      sql`${lancamentosFinanceiros.status} IN ('previsto', 'aprovado', 'vencido', 'inadimplente')`,
      lte(lancamentosFinanceiros.dataVencimento, sql`(CURRENT_DATE + INTERVAL '90 days')`),
    ));

  // Contas a pagar em aberto (operacional)
  const [{ total: pagar } = { total: "0" }] = await db.select({
    total: sql<string>`COALESCE(SUM(${lancamentosFinanceiros.valor}), 0)`,
  })
    .from(lancamentosFinanceiros)
    .where(and(
      eq(lancamentosFinanceiros.tenantId, tenantId),
      eq(lancamentosFinanceiros.clienteId, clienteId),
      eq(lancamentosFinanceiros.tipo, "pagar"),
      sql`${lancamentosFinanceiros.status} IN ('previsto', 'aprovado', 'vencido')`,
      lte(lancamentosFinanceiros.dataVencimento, sql`(CURRENT_DATE + INTERVAL '90 days')`),
    ));

  // Disponível bancário
  const [{ total: disponivel } = { total: "0" }] = await db.select({
    total: sql<string>`COALESCE(SUM(${contasBancarias.saldoAtual}), 0)`,
  })
    .from(contasBancarias)
    .where(and(
      eq(contasBancarias.tenantId, tenantId),
      eq(contasBancarias.clienteId, clienteId),
      eq(contasBancarias.ativo, true),
    ));

  // Estoque e empréstimos curto prazo: estimativa por tag naturezaDre
  const [{ total: estoque } = { total: "0" }] = await db.select({
    total: sql<string>`COALESCE(SUM(${lancamentosFinanceiros.valor}), 0)`,
  })
    .from(lancamentosFinanceiros)
    .leftJoin(planosContas, eq(planosContas.id, lancamentosFinanceiros.planoContaId))
    .where(and(
      eq(lancamentosFinanceiros.tenantId, tenantId),
      eq(lancamentosFinanceiros.clienteId, clienteId),
      eq(planosContas.naturezaDre, "estoque"),
    ));

  const [{ total: emprestimos } = { total: "0" }] = await db.select({
    total: sql<string>`COALESCE(SUM(${lancamentosFinanceiros.valor}), 0)`,
  })
    .from(lancamentosFinanceiros)
    .leftJoin(planosContas, eq(planosContas.id, lancamentosFinanceiros.planoContaId))
    .where(and(
      eq(lancamentosFinanceiros.tenantId, tenantId),
      eq(lancamentosFinanceiros.clienteId, clienteId),
      eq(planosContas.naturezaDre, "emprestimo_cp"),
    ));

  const contasReceber = Number(receber ?? 0);
  const contasPagarOp = Number(pagar ?? 0);
  const disponivelBancario = Number(disponivel ?? 0);
  const estoqueV = Number(estoque ?? 0);
  const emprestimosCp = Number(emprestimos ?? 0);

  // AC operacional = clientes + estoque
  const acOperacional = contasReceber + estoqueV;
  // PC operacional = fornecedores
  const pcOperacional = contasPagarOp;
  // AC total = AC operacional + disponibilidades
  const acTotal = acOperacional + disponivelBancario;
  // PC total = PC operacional + empréstimos curto prazo
  const pcTotal = pcOperacional + emprestimosCp;

  const ncg = +(acOperacional - pcOperacional).toFixed(2);
  const cgl = +(acTotal - pcTotal).toFixed(2);
  const saldoTesouraria = +(cgl - ncg).toFixed(2);

  let diagnostico: FleurietResult["diagnostico"];
  if (saldoTesouraria < 0 && ncg > 0) diagnostico = "fragil";
  else if (saldoTesouraria > 0 && ncg > 0) diagnostico = "solida";
  else if (saldoTesouraria > 0 && ncg < 0) diagnostico = "excelente";
  else diagnostico = "insuficiente";

  // Estimativa simples de prazos médios (em dias) — base mensal de 30
  const pmr = contasReceber > 0 && acOperacional > 0 ? 30 : 0;
  const pme = estoqueV > 0 ? 30 : 0;
  const pmp = contasPagarOp > 0 ? 30 : 0;

  const observacoes: string[] = [];
  if (diagnostico === "fragil") {
    observacoes.push("⚠️ Efeito tesoura: NCG cresce mais rápido que CGL. Renegociar prazos com fornecedores e antecipar recebíveis.");
  }
  if (saldoTesouraria < 0 && Math.abs(saldoTesouraria) > acOperacional * 0.3) {
    observacoes.push("Risco de insolvência no curto prazo — déficit de tesouraria > 30% do giro operacional");
  }
  if (diagnostico === "excelente") {
    observacoes.push("Liquidez folgada — considerar aplicações financeiras ou expansão");
  }

  return {
    data: dataStr,
    ncg,
    cgl,
    saldoTesouraria,
    diagnostico,
    efeitoTesoura: diagnostico === "fragil",
    cicloOperacional: pmr + pme,
    cicloFinanceiro: pmr + pme - pmp,
    detalhes: {
      contasReceber,
      estoque: estoqueV,
      contasPagar: contasPagarOp,
      disponivelBancario,
      emprestimosCp,
      pmr, pme, pmp,
    },
    observacoes,
  };
}
