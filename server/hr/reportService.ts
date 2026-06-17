// Sprint RH-5 — Relatório Gerencial BPO.
// Consolida custos de folha por empresa/cargo/CC, evolução 12 meses,
// peso no DRE (vs Control), previsão do próximo mês e alertas (13°/férias).
// Todas as queries filtram por tenantId; clienteId é opcional (consolidação multi-empresa).

import { db } from "../db";
import { and, eq, gte, lte, inArray, sql, desc } from "drizzle-orm";
import {
  hrPayrollPeriods,
  hrPayrollEntries,
  hrEmployees,
  hrPositions,
  centrosCusto,
  clients,
  lancamentosFinanceiros,
} from "@shared/schema";

export type Competence = string; // "YYYY-MM"

const N = (v: any) => Number(v ?? 0);

function monthsBack(competence: Competence, n: number): Competence[] {
  const [y, m] = competence.split("-").map(Number);
  const out: Competence[] = [];
  // dt aponta para o último mês solicitado; iteramos n meses para trás.
  let dt = new Date(Date.UTC(y, m - 1, 1));
  for (let i = 0; i < n; i++) {
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    out.unshift(`${yy}-${mm}`);
    dt = new Date(Date.UTC(yy, dt.getUTCMonth() - 1, 1));
  }
  return out;
}

function nextCompetence(competence: Competence): Competence {
  const [y, m] = competence.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

function todayCompetence(): Competence {
  const dt = new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Custo por empresa ────────────────────────────────────────────────────
// Agrega totalGross / encargos / net dos períodos approved+exported na competência.
export async function costByCompany(tenantId: string, competence: Competence) {
  const rows = await db.select({
    clienteId: hrPayrollPeriods.clienteId,
    clienteName: clients.name,
    company: clients.company,
    totalGross: sql<string>`COALESCE(SUM(${hrPayrollPeriods.totalGross}), 0)`,
    totalNet: sql<string>`COALESCE(SUM(${hrPayrollPeriods.totalNet}), 0)`,
    totalInss: sql<string>`COALESCE(SUM(${hrPayrollPeriods.totalInssEmployee}), 0)`,
    totalFgts: sql<string>`COALESCE(SUM(${hrPayrollPeriods.totalFgts}), 0)`,
    totalIrrf: sql<string>`COALESCE(SUM(${hrPayrollPeriods.totalIrrf}), 0)`,
  })
    .from(hrPayrollPeriods)
    .leftJoin(clients, and(
      eq(clients.id, hrPayrollPeriods.clienteId),
      eq(clients.tenantId, tenantId),
    ))
    .where(and(
      eq(hrPayrollPeriods.tenantId, tenantId),
      eq(hrPayrollPeriods.competence, competence),
      inArray(hrPayrollPeriods.status, ["approved", "exported"]),
    ))
    .groupBy(hrPayrollPeriods.clienteId, clients.name, clients.company);

  return rows.map(r => ({
    clienteId: r.clienteId,
    clienteName: r.company || r.clienteName || "—",
    totalGross: N(r.totalGross),
    totalNet: N(r.totalNet),
    totalInss: N(r.totalInss),
    totalFgts: N(r.totalFgts),
    totalIrrf: N(r.totalIrrf),
    // Estimativa de encargos patronais sobre o gross.
    encargosEstimados: N(r.totalGross) * 0.28,
  }));
}

// ─── Custo por cargo ──────────────────────────────────────────────────────
export async function costByPosition(tenantId: string, clienteId: string, competence: Competence) {
  const rows = await db.select({
    positionId: hrPositions.id,
    positionName: hrPositions.nome,
    headcount: sql<string>`COUNT(DISTINCT ${hrPayrollEntries.employeeId})`,
    totalGross: sql<string>`COALESCE(SUM(${hrPayrollEntries.totalGross}), 0)`,
    totalNet: sql<string>`COALESCE(SUM(${hrPayrollEntries.netSalary}), 0)`,
  })
    .from(hrPayrollEntries)
    .innerJoin(hrPayrollPeriods, and(
      eq(hrPayrollPeriods.id, hrPayrollEntries.periodId),
      eq(hrPayrollPeriods.tenantId, tenantId),
      eq(hrPayrollPeriods.clienteId, clienteId),
      eq(hrPayrollPeriods.competence, competence),
      inArray(hrPayrollPeriods.status, ["approved", "exported"]),
    ))
    .innerJoin(hrEmployees, and(
      eq(hrEmployees.id, hrPayrollEntries.employeeId),
      eq(hrEmployees.tenantId, tenantId),
    ))
    .leftJoin(hrPositions, and(
      eq(hrPositions.id, hrEmployees.positionId),
      eq(hrPositions.tenantId, tenantId),
    ))
    .where(eq(hrPayrollEntries.tenantId, tenantId))
    .groupBy(hrPositions.id, hrPositions.nome)
    .orderBy(desc(sql`COALESCE(SUM(${hrPayrollEntries.totalGross}), 0)`));

  return rows.map(r => ({
    positionId: r.positionId,
    positionName: r.positionName || "(Sem cargo)",
    headcount: Number(r.headcount ?? 0),
    totalGross: N(r.totalGross),
    totalNet: N(r.totalNet),
  }));
}

// ─── Custo por centro de custo ────────────────────────────────────────────
export async function costByCostCenter(tenantId: string, clienteId: string, competence: Competence) {
  const rows = await db.select({
    ccId: centrosCusto.id,
    ccCodigo: centrosCusto.codigo,
    ccNome: centrosCusto.nome,
    headcount: sql<string>`COUNT(DISTINCT ${hrPayrollEntries.employeeId})`,
    totalGross: sql<string>`COALESCE(SUM(${hrPayrollEntries.totalGross}), 0)`,
    totalNet: sql<string>`COALESCE(SUM(${hrPayrollEntries.netSalary}), 0)`,
  })
    .from(hrPayrollEntries)
    .innerJoin(hrPayrollPeriods, and(
      eq(hrPayrollPeriods.id, hrPayrollEntries.periodId),
      eq(hrPayrollPeriods.tenantId, tenantId),
      eq(hrPayrollPeriods.clienteId, clienteId),
      eq(hrPayrollPeriods.competence, competence),
      inArray(hrPayrollPeriods.status, ["approved", "exported"]),
    ))
    .leftJoin(centrosCusto, and(
      eq(centrosCusto.id, hrPayrollEntries.costCenterId),
      eq(centrosCusto.tenantId, tenantId),
    ))
    .where(eq(hrPayrollEntries.tenantId, tenantId))
    .groupBy(centrosCusto.id, centrosCusto.codigo, centrosCusto.nome)
    .orderBy(desc(sql`COALESCE(SUM(${hrPayrollEntries.totalGross}), 0)`));

  return rows.map(r => ({
    ccId: r.ccId,
    ccCodigo: r.ccCodigo,
    ccNome: r.ccNome || "(Sem CC)",
    headcount: Number(r.headcount ?? 0),
    totalGross: N(r.totalGross),
    totalNet: N(r.totalNet),
  }));
}

// ─── Evolução 12 meses ────────────────────────────────────────────────────
// Retorna sempre 12 meses (com zeros para meses sem folha aprovada).
export async function evolution12m(tenantId: string, clienteId: string | null, refCompetence: Competence) {
  const months = monthsBack(refCompetence, 12);

  const where = [
    eq(hrPayrollPeriods.tenantId, tenantId),
    inArray(hrPayrollPeriods.competence, months),
    inArray(hrPayrollPeriods.status, ["approved", "exported"]),
  ];
  if (clienteId) where.push(eq(hrPayrollPeriods.clienteId, clienteId));

  const rows = await db.select({
    competence: hrPayrollPeriods.competence,
    totalGross: sql<string>`COALESCE(SUM(${hrPayrollPeriods.totalGross}), 0)`,
    totalNet: sql<string>`COALESCE(SUM(${hrPayrollPeriods.totalNet}), 0)`,
    totalInss: sql<string>`COALESCE(SUM(${hrPayrollPeriods.totalInssEmployee}), 0)`,
    totalFgts: sql<string>`COALESCE(SUM(${hrPayrollPeriods.totalFgts}), 0)`,
  })
    .from(hrPayrollPeriods)
    .where(and(...where))
    .groupBy(hrPayrollPeriods.competence);

  const map = new Map(rows.map(r => [r.competence, r]));
  return months.map(comp => {
    const r = map.get(comp);
    return {
      competence: comp,
      totalGross: N(r?.totalGross),
      totalNet: N(r?.totalNet),
      totalInss: N(r?.totalInss),
      totalFgts: N(r?.totalFgts),
      encargosEstimados: N(r?.totalGross) * 0.28,
    };
  });
}

// ─── Peso no DRE (vs Control) ─────────────────────────────────────────────
// Compara o custo de folha do mês com o total de despesas (lancamentos pagar) do mesmo cliente/competência.
export async function dreWeight(tenantId: string, clienteId: string, competence: Competence) {
  const [y, m] = competence.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDt = new Date(Date.UTC(y, m, 0)); // último dia do mês
  const end = `${endDt.getUTCFullYear()}-${String(endDt.getUTCMonth() + 1).padStart(2, "0")}-${String(endDt.getUTCDate()).padStart(2, "0")}`;

  // Total de despesas (CP) do cliente no mês — usa COALESCE(dataPagamento, dataVencimento).
  const [despesas] = await db.select({
    total: sql<string>`COALESCE(SUM(${lancamentosFinanceiros.valor}), 0)`,
  })
    .from(lancamentosFinanceiros)
    .where(and(
      eq(lancamentosFinanceiros.tenantId, tenantId),
      eq(lancamentosFinanceiros.clienteId, clienteId),
      eq(lancamentosFinanceiros.tipo, "pagar"),
      gte(sql`COALESCE(${lancamentosFinanceiros.dataPagamento}, ${lancamentosFinanceiros.dataVencimento})`, start),
      lte(sql`COALESCE(${lancamentosFinanceiros.dataPagamento}, ${lancamentosFinanceiros.dataVencimento})`, end),
    ));

  const [folha] = await db.select({
    totalGross: sql<string>`COALESCE(SUM(${hrPayrollPeriods.totalGross}), 0)`,
    totalNet: sql<string>`COALESCE(SUM(${hrPayrollPeriods.totalNet}), 0)`,
  })
    .from(hrPayrollPeriods)
    .where(and(
      eq(hrPayrollPeriods.tenantId, tenantId),
      eq(hrPayrollPeriods.clienteId, clienteId),
      eq(hrPayrollPeriods.competence, competence),
      inArray(hrPayrollPeriods.status, ["approved", "exported"]),
    ));

  const grossFolha = N(folha?.totalGross);
  const totalDespesas = N(despesas?.total);
  const custoTotalFolha = grossFolha + grossFolha * 0.28; // gross + encargos estimados
  const peso = totalDespesas > 0 ? custoTotalFolha / totalDespesas : 0;

  return {
    competence,
    folhaGross: grossFolha,
    folhaNet: N(folha?.totalNet),
    custoTotalFolha,
    totalDespesasControl: totalDespesas,
    pesoFolhaPct: peso * 100,
  };
}

// ─── Previsão próximo mês ─────────────────────────────────────────────────
// Soma baseSalary dos colaboradores ativos + encargos estimados.
// Provisão 13°: 1/12 do salário ativo. Provisão férias: 1/12 + 1/3.
export async function forecastNextMonth(tenantId: string, clienteId: string, refCompetence: Competence) {
  const next = nextCompetence(refCompetence);

  const ativos = await db.select({
    id: hrEmployees.id,
    fullName: hrEmployees.fullName,
    baseSalary: hrEmployees.baseSalary,
  })
    .from(hrEmployees)
    .where(and(
      eq(hrEmployees.tenantId, tenantId),
      eq(hrEmployees.clienteId, clienteId),
      inArray(hrEmployees.status, ["active", "vacation"]),
    ));

  const totalBase = ativos.reduce((acc, e) => acc + N(e.baseSalary), 0);
  const encargos = totalBase * 0.28;
  const provisao13 = totalBase / 12;
  const provisaoFerias = (totalBase / 12) * (1 + 1 / 3);

  return {
    competence: next,
    headcount: ativos.length,
    totalBase,
    encargosEstimados: encargos,
    provisao13: provisao13,
    provisaoFerias: provisaoFerias,
    custoTotalProjetado: totalBase + encargos + provisao13 + provisaoFerias,
  };
}

// ─── Alertas (13° e férias vencidas) ──────────────────────────────────────
// • 13° aproximando: jan-out alerta para o ano corrente, nov-dez alerta crítico.
// • Férias vencidas: admissão > 12 meses sem registro de período de férias nos últimos 12 meses
//   (heurística baseada em hr_payroll_entries.situation = 'Férias').
export async function alerts(tenantId: string, clienteId: string) {
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1; // 1-12
  const anoAtual = hoje.getFullYear();
  const limite12mAtras = new Date(Date.UTC(anoAtual - 1, hoje.getMonth(), hoje.getDate()))
    .toISOString().slice(0, 10);

  const ativos = await db.select({
    id: hrEmployees.id,
    fullName: hrEmployees.fullName,
    admissionDate: hrEmployees.admissionDate,
    baseSalary: hrEmployees.baseSalary,
    status: hrEmployees.status,
  })
    .from(hrEmployees)
    .where(and(
      eq(hrEmployees.tenantId, tenantId),
      eq(hrEmployees.clienteId, clienteId),
      inArray(hrEmployees.status, ["active", "vacation"]),
    ));

  // Última situação 'Férias' por colaborador (qualquer competência aprovada nos últimos 14 meses).
  const employeeIds = ativos.map(e => e.id);
  const feriasRows = employeeIds.length === 0 ? [] : await db.select({
    employeeId: hrPayrollEntries.employeeId,
    competence: hrPayrollPeriods.competence,
  })
    .from(hrPayrollEntries)
    .innerJoin(hrPayrollPeriods, and(
      eq(hrPayrollPeriods.id, hrPayrollEntries.periodId),
      eq(hrPayrollPeriods.tenantId, tenantId),
      eq(hrPayrollPeriods.clienteId, clienteId),
      inArray(hrPayrollPeriods.status, ["approved", "exported"]),
    ))
    .where(and(
      eq(hrPayrollEntries.tenantId, tenantId),
      inArray(hrPayrollEntries.employeeId, employeeIds),
      eq(hrPayrollEntries.situation, "Férias"),
    ));

  const ultimaFerias = new Map<string, string>();
  for (const r of feriasRows) {
    const cur = ultimaFerias.get(r.employeeId);
    if (!cur || r.competence > cur) ultimaFerias.set(r.employeeId, r.competence);
  }

  const feriasVencidas = ativos
    .filter(e => {
      // Só vence depois de 12 meses de admissão.
      if (e.admissionDate > limite12mAtras) return false;
      const last = ultimaFerias.get(e.id);
      if (!last) return true;
      // Período aquisitivo de 12 meses: vencidas se última férias > 12 meses atrás.
      const lastDate = `${last}-01`;
      return lastDate < limite12mAtras;
    })
    .map(e => ({
      employeeId: e.id,
      fullName: e.fullName,
      admissionDate: e.admissionDate,
      ultimaFerias: ultimaFerias.get(e.id) || null,
      severity: "high" as const,
    }));

  const totalBase = ativos.reduce((acc, e) => acc + N(e.baseSalary), 0);
  const provisao13 = totalBase / 12;
  // 1ª parcela tradicional: até 30/nov; 2ª: até 20/dez.
  const decimo: { stage: string; due: string; severity: "info" | "high" | "critical" }[] = [];
  if (mesAtual >= 1 && mesAtual <= 10) {
    decimo.push({ stage: "Provisão 13° em curso", due: `${anoAtual}-11-30`, severity: "info" });
  } else if (mesAtual === 11) {
    decimo.push({ stage: "1ª parcela 13° vence em 30/nov", due: `${anoAtual}-11-30`, severity: "high" });
    decimo.push({ stage: "2ª parcela 13° vence em 20/dez", due: `${anoAtual}-12-20`, severity: "info" });
  } else if (mesAtual === 12) {
    decimo.push({ stage: "2ª parcela 13° vence em 20/dez", due: `${anoAtual}-12-20`, severity: "critical" });
  }

  return {
    feriasVencidas,
    decimo: { provisaoMensal: provisao13, alertas: decimo },
    geradoEm: new Date().toISOString(),
  };
}

// ─── Dashboard consolidado ────────────────────────────────────────────────
export async function buildDashboard(tenantId: string, clienteId: string | null, competence?: Competence) {
  const comp = competence || todayCompetence();
  if (clienteId) {
    const [byPos, byCc, evol, dre, fc, al] = await Promise.all([
      costByPosition(tenantId, clienteId, comp),
      costByCostCenter(tenantId, clienteId, comp),
      evolution12m(tenantId, clienteId, comp),
      dreWeight(tenantId, clienteId, comp),
      forecastNextMonth(tenantId, clienteId, comp),
      alerts(tenantId, clienteId),
    ]);
    return { competence: comp, clienteId, byPosition: byPos, byCostCenter: byCc, evolution: evol, dre, forecast: fc, alerts: al };
  }
  const [byCompany, evol] = await Promise.all([
    costByCompany(tenantId, comp),
    evolution12m(tenantId, null, comp),
  ]);
  return { competence: comp, clienteId: null, byCompany, evolution: evol };
}
