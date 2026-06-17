// server/hr/payrollService.ts
// ──────────────────────────────────────────────────────────────────────────
// Sprint RH-2 — Service de folha de pagamento + integração Control.
// Status flow: draft → reviewed → approved (gera lancamentos_financeiros)
// → exported. Revert: approved → reviewed (cancela lancamentos no Control).

import { db } from "../db";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import {
  hrPayrollPeriods, hrPayrollEntries, hrTimesheetPeriods,
  hrEmployees, hrDepartments, lancamentosFinanceiros, planosContas,
  type InsertHrPayrollEntry, type HrPayrollEntry, type HrPayrollPeriod,
} from "@shared/schema";

// Resolve o CC do colaborador. Cascata: depto → null (sem CC).
// O Control aceita lancamentos sem CC; usuário pode ajustar manualmente depois.
export async function resolveCostCenter(
  tx: typeof db, tenantId: string, employeeId: string,
): Promise<{ departmentId: string | null; costCenterId: string | null }> {
  const [emp] = await tx.select({
    departmentId: hrEmployees.departmentId,
  }).from(hrEmployees)
    .where(and(eq(hrEmployees.id, employeeId), eq(hrEmployees.tenantId, tenantId)))
    .limit(1);
  if (!emp) throw new Error("Colaborador não encontrado");
  if (!emp.departmentId) return { departmentId: null, costCenterId: null };
  const [dept] = await tx.select({ centroCustoId: hrDepartments.centroCustoId })
    .from(hrDepartments).where(eq(hrDepartments.id, emp.departmentId)).limit(1);
  return { departmentId: emp.departmentId, costCenterId: dept?.centroCustoId ?? null };
}

// ─── Períodos ──────────────────────────────────────────────────────────────
export async function listPeriods(tenantId: string, clienteId: string, filters: { status?: string; competence?: string } = {}) {
  const where = [eq(hrPayrollPeriods.tenantId, tenantId), eq(hrPayrollPeriods.clienteId, clienteId)];
  if (filters.status) where.push(eq(hrPayrollPeriods.status, filters.status));
  if (filters.competence) where.push(eq(hrPayrollPeriods.competence, filters.competence));
  return db.select().from(hrPayrollPeriods).where(and(...where)).orderBy(desc(hrPayrollPeriods.competence));
}

export async function getPeriod(tenantId: string, id: string) {
  const [period] = await db.select().from(hrPayrollPeriods)
    .where(and(eq(hrPayrollPeriods.id, id), eq(hrPayrollPeriods.tenantId, tenantId))).limit(1);
  if (!period) return null;
  const entries = await db.select().from(hrPayrollEntries)
    .where(eq(hrPayrollEntries.periodId, id));
  return { period, entries };
}

export async function createPeriod(tenantId: string, clienteId: string, competence: string) {
  if (!/^\d{4}-\d{2}$/.test(competence)) throw new Error("competence deve ser YYYY-MM");
  const [row] = await db.insert(hrPayrollPeriods).values({
    tenantId, clienteId, competence, status: "draft", source: "manual",
  }).returning();
  return row;
}

// ─── Entries ───────────────────────────────────────────────────────────────
function assertEditable(period: HrPayrollPeriod) {
  if (period.status !== "draft" && period.status !== "reviewed") {
    const err: any = new Error(`Período em status '${period.status}' não pode ser editado`);
    err.status = 409; throw err;
  }
}

async function recalcPeriodTotals(tx: typeof db, periodId: string) {
  const rows = await tx.select().from(hrPayrollEntries).where(eq(hrPayrollEntries.periodId, periodId));
  const sumNum = (key: keyof HrPayrollEntry) =>
    rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0).toFixed(2);
  await tx.update(hrPayrollPeriods).set({
    totalGross: sumNum("totalGross"),
    totalDiscounts: sumNum("totalDiscounts"),
    totalNet: sumNum("netSalary"),
    totalInssEmployee: sumNum("inssValue"),
    totalFgts: sumNum("fgtsValue"),
    totalIrrf: sumNum("irrfValue"),
    updatedAt: new Date(),
  }).where(eq(hrPayrollPeriods.id, periodId));
}

export async function addEntry(tenantId: string, periodId: string, data: Omit<InsertHrPayrollEntry, "tenantId" | "periodId">) {
  return db.transaction(async (tx) => {
    const [period] = await tx.select().from(hrPayrollPeriods)
      .where(and(eq(hrPayrollPeriods.id, periodId), eq(hrPayrollPeriods.tenantId, tenantId))).limit(1);
    if (!period) throw new Error("Período não encontrado");
    assertEditable(period);
    const cc = await resolveCostCenter(tx as any, tenantId, data.employeeId);
    const [row] = await tx.insert(hrPayrollEntries).values({
      ...data, tenantId, periodId,
      departmentId: data.departmentId ?? cc.departmentId,
      costCenterId: data.costCenterId ?? cc.costCenterId,
    } as any).returning();
    await recalcPeriodTotals(tx as any, periodId);
    return row;
  });
}

export async function updateEntry(tenantId: string, periodId: string, entryId: string, patch: Partial<InsertHrPayrollEntry>) {
  return db.transaction(async (tx) => {
    const [period] = await tx.select().from(hrPayrollPeriods)
      .where(and(eq(hrPayrollPeriods.id, periodId), eq(hrPayrollPeriods.tenantId, tenantId))).limit(1);
    if (!period) throw new Error("Período não encontrado");
    assertEditable(period);
    const [row] = await tx.update(hrPayrollEntries)
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(and(eq(hrPayrollEntries.id, entryId), eq(hrPayrollEntries.periodId, periodId), eq(hrPayrollEntries.tenantId, tenantId)))
      .returning();
    if (!row) throw new Error("Lançamento não encontrado");
    await recalcPeriodTotals(tx as any, periodId);
    return row;
  });
}

export async function deleteEntry(tenantId: string, periodId: string, entryId: string) {
  return db.transaction(async (tx) => {
    const [period] = await tx.select().from(hrPayrollPeriods)
      .where(and(eq(hrPayrollPeriods.id, periodId), eq(hrPayrollPeriods.tenantId, tenantId))).limit(1);
    if (!period) throw new Error("Período não encontrado");
    assertEditable(period);
    await tx.delete(hrPayrollEntries)
      .where(and(eq(hrPayrollEntries.id, entryId), eq(hrPayrollEntries.periodId, periodId), eq(hrPayrollEntries.tenantId, tenantId)));
    await recalcPeriodTotals(tx as any, periodId);
  });
}

// ─── Status transitions ───────────────────────────────────────────────────
export async function reviewPeriod(tenantId: string, id: string) {
  const [period] = await db.select().from(hrPayrollPeriods)
    .where(and(eq(hrPayrollPeriods.id, id), eq(hrPayrollPeriods.tenantId, tenantId))).limit(1);
  if (!period) throw new Error("Período não encontrado");
  if (period.status !== "draft") throw new Error(`Só rascunhos podem ser revisados (atual: ${period.status})`);
  const [updated] = await db.update(hrPayrollPeriods)
    .set({ status: "reviewed", updatedAt: new Date() })
    .where(eq(hrPayrollPeriods.id, id)).returning();
  return updated;
}

// Resolve planoContaId por código (best-effort). Usado para etiquetar despesa
// na DRE. Retorna null se o tenant não tiver o código cadastrado.
async function findPlanoContaByCodigo(tx: typeof db, tenantId: string, codigo: string): Promise<string | null> {
  const [pc] = await tx.select({ id: planosContas.id }).from(planosContas)
    .where(and(eq(planosContas.tenantId, tenantId), eq(planosContas.codigo, codigo))).limit(1);
  return pc?.id ?? null;
}

function lastDayOfMonth(competence: string): string {
  const [y, m] = competence.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)); // dia 0 do mês seguinte = último do atual
  return d.toISOString().slice(0, 10);
}

function competenceLabel(competence: string): string {
  const [y, m] = competence.split("-");
  return `${m}/${y}`;
}

// Aprova o período em transação:
//  1. Agrupa entries por (CC × tipo de despesa)
//  2. Cria 1 lancamento_financeiro por grupo (4 tipos × N CCs distintos)
//  3. Salva lista de IDs em controlTxIds
//  4. Avança status para 'approved'
export async function approvePeriod(tenantId: string, id: string, approvedById: string | null) {
  return db.transaction(async (tx) => {
    const [period] = await tx.select().from(hrPayrollPeriods)
      .where(and(eq(hrPayrollPeriods.id, id), eq(hrPayrollPeriods.tenantId, tenantId))).limit(1);
    if (!period) throw new Error("Período não encontrado");
    if (period.status !== "reviewed") throw new Error(`Só períodos revisados podem ser aprovados (atual: ${period.status})`);

    const entries = await tx.select().from(hrPayrollEntries).where(eq(hrPayrollEntries.periodId, id));
    if (entries.length === 0) throw new Error("Período sem lançamentos — adicione colaboradores antes de aprovar");

    const dueDate = lastDayOfMonth(period.competence);
    const compLabel = competenceLabel(period.competence);

    // Agrupa por costCenterId (null vira '__none__' para chaveamento)
    const groups = new Map<string, typeof entries>();
    for (const e of entries) {
      const k = e.costCenterId ?? "__none__";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(e);
    }

    const TYPES: Array<{
      key: "netSalary" | "inssValue" | "fgtsValue" | "irrfValue";
      label: string; codigo: string;
    }> = [
      { key: "netSalary", label: "Salários",        codigo: "5.1.01" },
      { key: "inssValue", label: "INSS Empregados", codigo: "5.1.02" },
      { key: "fgtsValue", label: "FGTS",            codigo: "5.1.03" },
      { key: "irrfValue", label: "IRRF Retido",     codigo: "5.1.04" },
    ];

    const txIds: string[] = [];
    for (const [ccKey, ccEntries] of Array.from(groups.entries())) {
      const ccId = ccKey === "__none__" ? null : ccKey;
      for (const t of TYPES) {
        const total = ccEntries.reduce((acc: number, r: typeof entries[number]) => acc + Number(r[t.key] ?? 0), 0);
        if (total <= 0) continue;
        const planoContaId = await findPlanoContaByCodigo(tx as any, tenantId, t.codigo);
        const [lanc] = await tx.insert(lancamentosFinanceiros).values({
          tenantId,
          clienteId: period.clienteId,
          tipo: "pagar",
          descricao: `Folha ${compLabel} — ${t.label}`,
          valor: total.toFixed(2),
          dataVencimento: dueDate,
          status: "previsto",
          planoContaId: planoContaId ?? undefined,
          centroCustoId: ccId ?? undefined,
          origem: "integracao",
          criadoPor: approvedById ?? undefined,
          observacoes: `Gerado pela folha (período ${id}) — ${ccEntries.length} colaborador(es)`,
        } as any).returning();
        txIds.push(lanc.id);
      }
    }

    const [updated] = await tx.update(hrPayrollPeriods).set({
      status: "approved",
      controlTxIds: txIds,
      approvedAt: new Date(),
      approvedBy: approvedById ?? undefined,
      updatedAt: new Date(),
    }).where(eq(hrPayrollPeriods.id, id)).returning();

    return { period: updated, generatedTxIds: txIds };
  });
}

// Reverte aprovação: cancela TODOS os lancamentos gerados (não apenas o
// primeiro — fix de tech debt do spec) e volta status para 'reviewed'.
export async function revertApproval(tenantId: string, id: string) {
  return db.transaction(async (tx) => {
    const [period] = await tx.select().from(hrPayrollPeriods)
      .where(and(eq(hrPayrollPeriods.id, id), eq(hrPayrollPeriods.tenantId, tenantId))).limit(1);
    if (!period) throw new Error("Período não encontrado");
    if (period.status !== "approved") throw new Error(`Só períodos aprovados podem ser revertidos (atual: ${period.status})`);
    const ids = (period.controlTxIds as string[] | null) ?? [];
    if (ids.length > 0) {
      await tx.update(lancamentosFinanceiros)
        .set({ status: "cancelado", updatedAt: new Date() })
        .where(and(
          eq(lancamentosFinanceiros.tenantId, tenantId),
          inArray(lancamentosFinanceiros.id, ids),
        ));
    }
    const [updated] = await tx.update(hrPayrollPeriods).set({
      status: "reviewed",
      controlTxIds: null,
      approvedAt: null,
      approvedBy: null,
      updatedAt: new Date(),
    }).where(eq(hrPayrollPeriods.id, id)).returning();
    return { period: updated, cancelledTxIds: ids };
  });
}

// Resumo: totais por tipo e por CC (para o painel lateral).
export async function getSummary(tenantId: string, id: string) {
  const [period] = await db.select().from(hrPayrollPeriods)
    .where(and(eq(hrPayrollPeriods.id, id), eq(hrPayrollPeriods.tenantId, tenantId))).limit(1);
  if (!period) return null;
  const entries = await db.select().from(hrPayrollEntries).where(eq(hrPayrollEntries.periodId, id));
  const byCc: Record<string, { gross: number; net: number; inss: number; fgts: number; irrf: number; count: number }> = {};
  for (const e of entries) {
    const k = e.costCenterId ?? "__none__";
    const b = (byCc[k] ??= { gross: 0, net: 0, inss: 0, fgts: 0, irrf: 0, count: 0 });
    b.gross += Number(e.totalGross); b.net += Number(e.netSalary);
    b.inss += Number(e.inssValue); b.fgts += Number(e.fgtsValue);
    b.irrf += Number(e.irrfValue); b.count += 1;
  }
  return { period, byCostCenter: byCc, employeeCount: entries.length };
}

// ─── Timesheet (folha de ponto manual) ────────────────────────────────────
export async function listTimesheets(tenantId: string, clienteId: string, filters: { employeeId?: string } = {}) {
  const where = [eq(hrTimesheetPeriods.tenantId, tenantId), eq(hrTimesheetPeriods.clienteId, clienteId)];
  if (filters.employeeId) where.push(eq(hrTimesheetPeriods.employeeId, filters.employeeId));
  return db.select().from(hrTimesheetPeriods).where(and(...where)).orderBy(desc(hrTimesheetPeriods.periodStart));
}

export async function getTimesheet(tenantId: string, id: string) {
  const [row] = await db.select().from(hrTimesheetPeriods)
    .where(and(eq(hrTimesheetPeriods.id, id), eq(hrTimesheetPeriods.tenantId, tenantId))).limit(1);
  return row ?? null;
}

export async function createTimesheet(tenantId: string, data: any) {
  const [row] = await db.insert(hrTimesheetPeriods).values({ ...data, tenantId }).returning();
  return row;
}

export async function updateTimesheet(tenantId: string, id: string, patch: any) {
  const [row] = await db.update(hrTimesheetPeriods).set(patch)
    .where(and(eq(hrTimesheetPeriods.id, id), eq(hrTimesheetPeriods.tenantId, tenantId))).returning();
  if (!row) throw new Error("Folha de ponto não encontrada");
  return row;
}
