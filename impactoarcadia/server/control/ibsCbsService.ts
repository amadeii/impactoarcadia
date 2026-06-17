/**
 * IBS/CBS — Reforma Tributária 2026.
 *
 * Cálculo paralelo durante o período de transição 2026-2033. O sistema
 * mantém o regime atual (ICMS/ISS/PIS/COFINS) e calcula IBS/CBS em paralelo
 * para que o cliente possa comparar a carga tributária e planejar.
 *
 * Alíquotas oficiais publicadas pela Receita Federal — fonte: LC 214/2025.
 * As alíquotas-piloto de 2026 são CBS 0,9% e IBS 0,1% (transição).
 * A partir de 2027 começam a substituir os tributos antigos progressivamente.
 */

export type Operacao = "venda_produto" | "servico" | "importacao" | "exportacao";
export type Regime = "simples" | "lucro_presumido" | "lucro_real" | "mei";

export interface AliquotasAno {
  cbs: number;
  ibs: number;
  // Fração ainda devida do regime antigo (1.0 = 100% antigo, 0 = totalmente migrado)
  fatorRegimeAntigo: number;
}

/** Tabela de transição 2026 → 2033 (valores em decimal: 0.009 = 0,9%) */
export const TABELA_TRANSICAO: Record<number, AliquotasAno> = {
  2026: { cbs: 0.009, ibs: 0.001, fatorRegimeAntigo: 1.00 },
  2027: { cbs: 0.088, ibs: 0.001, fatorRegimeAntigo: 0.90 },
  2028: { cbs: 0.088, ibs: 0.005, fatorRegimeAntigo: 0.80 },
  2029: { cbs: 0.088, ibs: 0.030, fatorRegimeAntigo: 0.60 },
  2030: { cbs: 0.088, ibs: 0.050, fatorRegimeAntigo: 0.40 },
  2031: { cbs: 0.088, ibs: 0.070, fatorRegimeAntigo: 0.20 },
  2032: { cbs: 0.088, ibs: 0.090, fatorRegimeAntigo: 0.10 },
  2033: { cbs: 0.088, ibs: 0.177, fatorRegimeAntigo: 0.00 },
};

/** Alíquotas aproximadas do regime antigo por operação (sem benefícios). */
const REGIME_ANTIGO: Record<Operacao, { pis: number; cofins: number; icms?: number; iss?: number }> = {
  venda_produto: { pis: 0.0165, cofins: 0.076, icms: 0.18 },
  servico: { pis: 0.0165, cofins: 0.076, iss: 0.05 },
  importacao: { pis: 0.021, cofins: 0.0965, icms: 0.18 },
  exportacao: { pis: 0, cofins: 0, icms: 0 },
};

export interface IbsCbsResult {
  ano: number;
  operacao: Operacao;
  valorBase: number;
  // Novo regime
  cbs: number;
  ibs: number;
  totalNovo: number;
  // Antigo proporcional
  pis: number;
  cofins: number;
  icms: number;
  iss: number;
  totalAntigo: number;
  // Total devido (mistura proporcional)
  totalEfetivo: number;
  // Quanto o cliente economiza (negativo = paga mais no novo)
  economia: number;
  observacoes: string[];
}

export function calcularIbsCbs(
  valorBase: number,
  ano: number,
  operacao: Operacao,
): IbsCbsResult {
  const t = TABELA_TRANSICAO[ano] ?? TABELA_TRANSICAO[2033];
  const cbs = +(valorBase * t.cbs).toFixed(2);
  const ibs = +(valorBase * t.ibs).toFixed(2);
  const totalNovo = +(cbs + ibs).toFixed(2);

  const ant = REGIME_ANTIGO[operacao];
  const pis = +(valorBase * ant.pis * t.fatorRegimeAntigo).toFixed(2);
  const cofins = +(valorBase * ant.cofins * t.fatorRegimeAntigo).toFixed(2);
  const icms = +(valorBase * (ant.icms ?? 0) * t.fatorRegimeAntigo).toFixed(2);
  const iss = +(valorBase * (ant.iss ?? 0) * t.fatorRegimeAntigo).toFixed(2);
  const totalAntigo = +(pis + cofins + icms + iss).toFixed(2);

  // Durante a transição, paga novo (fração que migrou) + antigo (fração que ficou)
  const fracaoNova = 1 - t.fatorRegimeAntigo;
  const totalEfetivo = +(totalNovo * (fracaoNova + (t.fatorRegimeAntigo > 0 ? 0 : 1)) + totalAntigo).toFixed(2);

  // Cenário hipotético: tudo no novo regime para fins de planejamento
  const totalSeFosseNovoIntegral = +(valorBase * (TABELA_TRANSICAO[2033].cbs + TABELA_TRANSICAO[2033].ibs)).toFixed(2);
  const totalSeFosseAntigoIntegral = +(valorBase * (ant.pis + ant.cofins + (ant.icms ?? 0) + (ant.iss ?? 0))).toFixed(2);
  const economia = +(totalSeFosseAntigoIntegral - totalSeFosseNovoIntegral).toFixed(2);

  const obs: string[] = [];
  if (ano <= 2026) obs.push("Período-piloto: alíquotas reduzidas (CBS 0,9% + IBS 0,1%)");
  if (ano >= 2027 && ano < 2033) obs.push(`Transição: ${(t.fatorRegimeAntigo * 100).toFixed(0)}% ainda no regime antigo`);
  if (ano >= 2033) obs.push("Regime antigo (PIS/COFINS/ICMS/ISS) totalmente substituído por IBS/CBS");
  if (operacao === "exportacao") obs.push("Exportação: imune (não tributada)");

  return {
    ano, operacao, valorBase,
    cbs, ibs, totalNovo,
    pis, cofins, icms, iss, totalAntigo,
    totalEfetivo,
    economia,
    observacoes: obs,
  };
}

/**
 * Resumo de carga tributária para um conjunto de operações em um ano.
 */
export function consolidarCarga(
  operacoes: Array<{ valor: number; tipo: Operacao }>,
  ano: number,
): {
  faturamentoBruto: number;
  totalNovo: number;
  totalAntigo: number;
  totalEfetivo: number;
  cargaPercent: number;
  porOperacao: Record<Operacao, { qtd: number; valor: number; tributos: number }>;
} {
  const acc = {
    faturamentoBruto: 0,
    totalNovo: 0,
    totalAntigo: 0,
    totalEfetivo: 0,
    porOperacao: {} as Record<string, { qtd: number; valor: number; tributos: number }>,
  };
  for (const op of operacoes) {
    const r = calcularIbsCbs(op.valor, ano, op.tipo);
    acc.faturamentoBruto += op.valor;
    acc.totalNovo += r.totalNovo;
    acc.totalAntigo += r.totalAntigo;
    acc.totalEfetivo += r.totalEfetivo;
    if (!acc.porOperacao[op.tipo]) acc.porOperacao[op.tipo] = { qtd: 0, valor: 0, tributos: 0 };
    acc.porOperacao[op.tipo].qtd += 1;
    acc.porOperacao[op.tipo].valor += op.valor;
    acc.porOperacao[op.tipo].tributos += r.totalEfetivo;
  }
  return {
    ...acc,
    cargaPercent: acc.faturamentoBruto > 0 ? +(acc.totalEfetivo / acc.faturamentoBruto * 100).toFixed(2) : 0,
    porOperacao: acc.porOperacao as any,
  };
}
