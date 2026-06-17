import {
  CALCULATION_WEIGHTS,
  SCENARIO_PROBABILITIES,
  SCENARIO_GROWTH_ADJUSTMENTS,
  MAX_GOVERNANCE_UPLIFT,
  MAX_WACC_REDUCTION,
} from "./constants";

export interface FinancialData {
  year: number;
  isProjection: number;
  revenue: number;
  grossRevenue?: number;
  cogs?: number;
  grossProfit?: number;
  operatingExpenses?: number;
  ebitda: number;
  ebit?: number;
  netIncome?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  cash?: number;
  debt?: number;
  workingCapital?: number;
  capex?: number;
  depreciation?: number;
  freeCashFlow?: number;
  cashFlowOperations?: number;
  headcount?: number;
  growthRate?: number;
}

export interface AssumptionData {
  riskFreeRate: number;
  betaUnlevered: number;
  marketPremium: number;
  countryRisk: number;
  sizePremium: number;
  specificRisk: number;
  costOfDebt: number;
  taxRate: number;
  equityRatio: number;
  debtRatio: number;
  terminalGrowth: number;
  projectionYears: number;
}

export interface GovernanceCriterion {
  currentScore: number;
  targetScore: number;
  weight: number;
  valuationImpactPct: number;
  equityImpactPct: number;
  roeImpactPct: number;
}

export interface AssetData {
  bookValue: number;
  marketValue: number;
  appraisedValue?: number;
}

export interface SectorMultiples {
  evEbitda: number;
  evRevenue: number;
}

export interface ValuationResult {
  method: string;
  enterpriseValue: number;
  equityValue: number;
  terminalValue?: number;
  netDebt: number;
  weight: number;
  details: Record<string, any>;
}

export interface SensitivityCell {
  wacc: number;
  growth: number;
  enterpriseValue: number;
  equityValue: number;
}

function n(v: any): number {
  const parsed = parseFloat(v);
  return isNaN(parsed) ? 0 : parsed;
}

export function calculateWACC(assumptions: AssumptionData): number {
  const ke =
    assumptions.riskFreeRate +
    assumptions.betaUnlevered * assumptions.marketPremium +
    assumptions.countryRisk +
    assumptions.sizePremium +
    assumptions.specificRisk;

  const kd = assumptions.costOfDebt * (1 - assumptions.taxRate);
  const wacc = ke * assumptions.equityRatio + kd * assumptions.debtRatio;
  return Math.max(wacc, 0.01);
}

export function calculateTerminalValue(
  lastFCF: number,
  wacc: number,
  terminalGrowth: number,
): number {
  if (wacc <= terminalGrowth) return lastFCF * 20;
  return (lastFCF * (1 + terminalGrowth)) / (wacc - terminalGrowth);
}

export function calculateDCF(
  projectedFCFs: number[],
  wacc: number,
  terminalGrowth: number,
  netDebt: number,
): ValuationResult {
  let pvFCFs = 0;
  const discountedFCFs: number[] = [];

  for (let i = 0; i < projectedFCFs.length; i++) {
    const discountFactor = Math.pow(1 + wacc, i + 1);
    const pv = projectedFCFs[i] / discountFactor;
    discountedFCFs.push(pv);
    pvFCFs += pv;
  }

  const lastFCF = projectedFCFs[projectedFCFs.length - 1] || 0;
  const tv = calculateTerminalValue(lastFCF, wacc, terminalGrowth);
  const pvTV = tv / Math.pow(1 + wacc, projectedFCFs.length);
  const enterpriseValue = pvFCFs + pvTV;
  const equityValue = enterpriseValue - netDebt;

  return {
    method: "dcf",
    enterpriseValue,
    equityValue,
    terminalValue: tv,
    netDebt,
    weight: 0,
    details: {
      wacc,
      terminalGrowth,
      discountedFCFs,
      pvFCFs,
      pvTerminalValue: pvTV,
    },
  };
}

export function calculateMultiples(
  ebitda: number,
  revenue: number,
  multiples: SectorMultiples,
  netDebt: number,
): { evEbitda: ValuationResult; evRevenue: ValuationResult } {
  const evByEbitda = ebitda * multiples.evEbitda;
  const evByRevenue = revenue * multiples.evRevenue;

  return {
    evEbitda: {
      method: "ev_ebitda",
      enterpriseValue: evByEbitda,
      equityValue: evByEbitda - netDebt,
      netDebt,
      weight: 0,
      details: { ebitda, multiple: multiples.evEbitda },
    },
    evRevenue: {
      method: "ev_revenue",
      enterpriseValue: evByRevenue,
      equityValue: evByRevenue - netDebt,
      netDebt,
      weight: 0,
      details: { revenue, multiple: multiples.evRevenue },
    },
  };
}

export function calculatePatrimonial(
  totalEquity: number,
  netDebt: number,
): ValuationResult {
  return {
    method: "patrimonial",
    enterpriseValue: totalEquity + netDebt,
    equityValue: totalEquity,
    netDebt,
    weight: 0,
    details: { totalEquity },
  };
}

export function calculateAssetValue(
  assets: AssetData[],
  netDebt: number,
): ValuationResult {
  const totalMarket = assets.reduce(
    (sum, a) => sum + (a.appraisedValue || a.marketValue || a.bookValue || 0),
    0,
  );
  return {
    method: "assets",
    enterpriseValue: totalMarket,
    equityValue: totalMarket - netDebt,
    netDebt,
    weight: 0,
    details: {
      totalAssetValue: totalMarket,
      assetCount: assets.length,
    },
  };
}

export function calculateGovernanceImpact(criteria: GovernanceCriterion[]): {
  currentScore: number;
  projectedScore: number;
  valuationUplift: number;
  waccReduction: number;
  equityImpact: number;
  roeImpact: number;
} {
  if (!criteria.length)
    return {
      currentScore: 0,
      projectedScore: 0,
      valuationUplift: 0,
      waccReduction: 0,
      equityImpact: 0,
      roeImpact: 0,
    };

  const totalWeight = criteria.reduce((s, c) => s + n(c.weight), 0);
  if (totalWeight === 0)
    return {
      currentScore: 0,
      projectedScore: 0,
      valuationUplift: 0,
      waccReduction: 0,
      equityImpact: 0,
      roeImpact: 0,
    };

  let currentWeighted = 0;
  let projectedWeighted = 0;
  let valuationImpact = 0;
  let equityImpact = 0;
  let roeImpact = 0;

  for (const c of criteria) {
    const w = n(c.weight) / totalWeight;
    currentWeighted += n(c.currentScore) * w;
    projectedWeighted += n(c.targetScore) * w;
    const improvement = (n(c.targetScore) - n(c.currentScore)) / 10;
    valuationImpact += improvement * (n(c.valuationImpactPct) / 100);
    equityImpact += improvement * (n(c.equityImpactPct) / 100);
    roeImpact += improvement * (n(c.roeImpactPct) / 100);
  }

  const uplift = Math.min(valuationImpact, MAX_GOVERNANCE_UPLIFT);
  const scoreImprovement = (projectedWeighted - currentWeighted) / 10;
  const waccRed = Math.min(scoreImprovement * MAX_WACC_REDUCTION, MAX_WACC_REDUCTION);

  return {
    currentScore: currentWeighted,
    projectedScore: projectedWeighted,
    valuationUplift: uplift,
    waccReduction: waccRed,
    equityImpact,
    roeImpact,
  };
}

export function generateProjections(
  historicalData: FinancialData[],
  assumptions: Partial<AssumptionData>,
  years: number = 5,
): FinancialData[] {
  const sorted = historicalData
    .filter((d) => !d.isProjection)
    .sort((a, b) => a.year - b.year);

  if (sorted.length === 0) return [];

  const last = sorted[sorted.length - 1];
  let revenueGrowth = 0;
  if (sorted.length >= 2) {
    const first = sorted[0];
    const n_years = last.year - first.year;
    if (n_years > 0 && n(first.revenue) > 0) {
      revenueGrowth = Math.pow(n(last.revenue) / n(first.revenue), 1 / n_years) - 1;
    }
  }
  if (revenueGrowth <= 0) revenueGrowth = 0.05;

  const ebitdaMargin = n(last.revenue) > 0 ? n(last.ebitda) / n(last.revenue) : 0.15;
  const netMargin = n(last.revenue) > 0 ? n(last.netIncome) / n(last.revenue) : 0.08;
  const capexRatio = n(last.revenue) > 0 ? Math.abs(n(last.capex)) / n(last.revenue) : 0.05;
  const deprRatio = n(last.revenue) > 0 ? n(last.depreciation) / n(last.revenue) : 0.03;

  const projections: FinancialData[] = [];
  let prevRevenue = n(last.revenue);

  for (let i = 1; i <= years; i++) {
    const revenue = prevRevenue * (1 + revenueGrowth);
    const ebitda = revenue * ebitdaMargin;
    const depreciation = revenue * deprRatio;
    const ebit = ebitda - depreciation;
    const netIncome = revenue * netMargin;
    const capex = revenue * capexRatio;
    const wcChange = (revenue - prevRevenue) * 0.1;
    const fcf = ebitda - capex - wcChange;

    projections.push({
      year: last.year + i,
      isProjection: 1,
      revenue,
      ebitda,
      ebit,
      netIncome,
      capex,
      depreciation,
      freeCashFlow: fcf,
      totalEquity: n(last.totalEquity) * Math.pow(1.05, i),
      totalAssets: n(last.totalAssets) * Math.pow(1.03, i),
      totalLiabilities: n(last.totalLiabilities),
      cash: n(last.cash) * Math.pow(1.02, i),
      debt: n(last.debt) * 0.95,
      workingCapital: n(last.workingCapital) + wcChange,
      growthRate: revenueGrowth,
    });

    prevRevenue = revenue;
  }

  return projections;
}

export function sensitivityAnalysis(
  baseFCFs: number[],
  baseWACC: number,
  baseGrowth: number,
  netDebt: number,
  gridSize: number = 5,
): SensitivityCell[] {
  const cells: SensitivityCell[] = [];
  const step = 0.01;
  const halfGrid = Math.floor(gridSize / 2);

  for (let wi = -halfGrid; wi <= halfGrid; wi++) {
    for (let gi = -halfGrid; gi <= halfGrid; gi++) {
      const wacc = baseWACC + wi * step;
      const growth = baseGrowth + gi * step * 0.5;
      if (wacc <= growth || wacc <= 0) continue;

      const result = calculateDCF(baseFCFs, wacc, growth, netDebt);
      cells.push({
        wacc,
        growth,
        enterpriseValue: result.enterpriseValue,
        equityValue: result.equityValue,
      });
    }
  }

  return cells;
}

export function runFullValuation(params: {
  financials: FinancialData[];
  assumptions: AssumptionData;
  multiples: SectorMultiples;
  assets?: AssetData[];
  governanceCriteria?: GovernanceCriterion[];
  projectType: "simple" | "governance";
  scenario: "conservative" | "base" | "optimistic";
}): {
  results: ValuationResult[];
  weightedEV: number;
  weightedEquity: number;
  governanceImpact?: ReturnType<typeof calculateGovernanceImpact>;
} {
  const {
    financials,
    assumptions,
    multiples,
    assets,
    governanceCriteria,
    projectType,
    scenario,
  } = params;

  const projected = financials.filter((f) => f.isProjection).sort((a, b) => a.year - b.year);
  const historical = financials.filter((f) => !f.isProjection).sort((a, b) => a.year - b.year);
  const lastHistorical = historical[historical.length - 1];

  const growthAdj = SCENARIO_GROWTH_ADJUSTMENTS[scenario];
  const adjustedFCFs = projected.map((f) => {
    const base = n(f.freeCashFlow);
    return base * (1 + growthAdj);
  });

  const netDebt = lastHistorical
    ? n(lastHistorical.debt) - n(lastHistorical.cash)
    : 0;

  let wacc = calculateWACC(assumptions);

  let govImpact: ReturnType<typeof calculateGovernanceImpact> | undefined;
  if (projectType === "governance" && governanceCriteria?.length) {
    govImpact = calculateGovernanceImpact(governanceCriteria);
    wacc = Math.max(wacc - govImpact.waccReduction, 0.01);
  }

  const weights = CALCULATION_WEIGHTS[projectType];
  const results: ValuationResult[] = [];

  if (adjustedFCFs.length > 0) {
    const dcf = calculateDCF(adjustedFCFs, wacc, assumptions.terminalGrowth, netDebt);
    dcf.weight = weights.dcf;
    results.push(dcf);
  }

  const lastEbitda = lastHistorical ? n(lastHistorical.ebitda) : 0;
  const lastRevenue = lastHistorical ? n(lastHistorical.revenue) : 0;

  if (lastEbitda > 0) {
    const { evEbitda, evRevenue } = calculateMultiples(lastEbitda, lastRevenue, multiples, netDebt);
    evEbitda.weight = weights.ev_ebitda;
    evRevenue.weight = weights.ev_revenue;
    results.push(evEbitda, evRevenue);
  }

  if (projectType === "governance") {
    const gWeights = weights as typeof CALCULATION_WEIGHTS.governance;
    if (lastHistorical) {
      const patri = calculatePatrimonial(n(lastHistorical.totalEquity), netDebt);
      patri.weight = gWeights.patrimonial;
      results.push(patri);
    }
    if (assets?.length) {
      const assetVal = calculateAssetValue(assets, netDebt);
      assetVal.weight = gWeights.assets;
      results.push(assetVal);
    }
  }

  let weightedEV = 0;
  let weightedEquity = 0;
  const totalWeight = results.reduce((s, r) => s + r.weight, 0);

  for (const r of results) {
    const normalizedWeight = totalWeight > 0 ? r.weight / totalWeight : 0;
    weightedEV += r.enterpriseValue * normalizedWeight;
    weightedEquity += r.equityValue * normalizedWeight;
  }

  if (govImpact && govImpact.valuationUplift > 0) {
    const projectedEV = weightedEV * (1 + govImpact.valuationUplift);
    const projectedEquity = weightedEquity * (1 + govImpact.valuationUplift);
    return {
      results,
      weightedEV: projectedEV,
      weightedEquity: projectedEquity,
      governanceImpact: govImpact,
    };
  }

  return { results, weightedEV, weightedEquity, governanceImpact: govImpact };
}

export function calculateScenarioWeighted(
  scenarioResults: { scenario: string; ev: number; equity: number }[],
): { weightedEV: number; weightedEquity: number } {
  let wEV = 0;
  let wEq = 0;
  for (const s of scenarioResults) {
    const prob = SCENARIO_PROBABILITIES[s.scenario as keyof typeof SCENARIO_PROBABILITIES] || 0;
    wEV += s.ev * prob;
    wEq += s.equity * prob;
  }
  return { weightedEV: wEV, weightedEquity: wEq };
}
