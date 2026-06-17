// RH-1 — Service: colaboradores, cargos, departamentos, histórico salarial.
// Tudo escopado por tenantId. clienteId = empresa cliente da consultoria.

import { db } from "../db";
import { and, eq, desc, ilike, sql, inArray } from "drizzle-orm";
import {
  hrEmployees, hrPositions, hrDepartments, hrSalaryHistory,
  hrEmployeeAccountEntries, hrPayrollEntries, clients,
  pessoas, pessoaPapeis,
  type InsertHrEmployee, type InsertHrPosition, type InsertHrDepartment,
  type InsertHrSalaryHistory, type HrEmployee, type HrSalaryHistory,
  type InsertHrEmployeeAccountEntry, type HrEmployeeAccountEntry,
} from "@shared/schema";

/**
 * Garante que o clienteId pertence ao tenant. Lança 403 se não pertencer.
 * Necessário porque o middleware tenantContext só valida o tenantId do
 * usuário, mas o clienteId vem do request (query/body) — um tenant não
 * pode operar sobre clients de outro tenant.
 */
export async function assertClienteOfTenant(tenantId: string, clienteId: string) {
  const [c] = await db.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.id, clienteId), eq(clients.tenantId, tenantId))).limit(1);
  if (!c) {
    const err: any = new Error("Cliente não pertence ao tenant atual");
    err.status = 403;
    throw err;
  }
}

// ─── Departamentos ──────────────────────────────────────────────────────────
export async function listDepartments(tenantId: string, clienteId: string) {
  return db.select().from(hrDepartments)
    .where(and(eq(hrDepartments.tenantId, tenantId), eq(hrDepartments.clienteId, clienteId)))
    .orderBy(hrDepartments.nome);
}

export async function createDepartment(tenantId: string, input: InsertHrDepartment) {
  const [row] = await db.insert(hrDepartments).values({ ...input, tenantId }).returning();
  return row;
}

export async function updateDepartment(tenantId: string, id: string, patch: Partial<InsertHrDepartment>) {
  const [row] = await db.update(hrDepartments)
    .set(patch)
    .where(and(eq(hrDepartments.id, id), eq(hrDepartments.tenantId, tenantId)))
    .returning();
  return row ?? null;
}

export async function deleteDepartment(tenantId: string, id: string) {
  const result = await db.delete(hrDepartments)
    .where(and(eq(hrDepartments.id, id), eq(hrDepartments.tenantId, tenantId)));
  return result;
}

// ─── Cargos ─────────────────────────────────────────────────────────────────
export async function listPositions(tenantId: string, clienteId: string) {
  return db.select().from(hrPositions)
    .where(and(eq(hrPositions.tenantId, tenantId), eq(hrPositions.clienteId, clienteId)))
    .orderBy(hrPositions.nome);
}

export async function createPosition(tenantId: string, input: InsertHrPosition) {
  const [row] = await db.insert(hrPositions).values({ ...input, tenantId }).returning();
  return row;
}

export async function updatePosition(tenantId: string, id: string, patch: Partial<InsertHrPosition>) {
  const [row] = await db.update(hrPositions)
    .set(patch)
    .where(and(eq(hrPositions.id, id), eq(hrPositions.tenantId, tenantId)))
    .returning();
  return row ?? null;
}

export async function deletePosition(tenantId: string, id: string) {
  return db.delete(hrPositions)
    .where(and(eq(hrPositions.id, id), eq(hrPositions.tenantId, tenantId)));
}

// ─── Colaboradores ──────────────────────────────────────────────────────────
export type EmployeeFilters = {
  clienteId: string;
  status?: string;
  departmentId?: string;
  positionId?: string;
  search?: string;
};

export async function listEmployees(tenantId: string, f: EmployeeFilters) {
  const conds = [
    eq(hrEmployees.tenantId, tenantId),
    eq(hrEmployees.clienteId, f.clienteId),
  ];
  if (f.status && f.status !== "all") conds.push(eq(hrEmployees.status, f.status));
  if (f.departmentId) conds.push(eq(hrEmployees.departmentId, f.departmentId));
  if (f.positionId) conds.push(eq(hrEmployees.positionId, f.positionId));
  if (f.search) {
    conds.push(sql`(${hrEmployees.fullName} ILIKE ${"%" + f.search + "%"} OR ${hrEmployees.cpf} ILIKE ${"%" + f.search + "%"} OR ${hrEmployees.employeeCode} ILIKE ${"%" + f.search + "%"})`);
  }
  return db.select().from(hrEmployees).where(and(...conds)).orderBy(hrEmployees.fullName);
}

export async function getEmployee(tenantId: string, id: string): Promise<HrEmployee | null> {
  const [row] = await db.select().from(hrEmployees)
    .where(and(eq(hrEmployees.id, id), eq(hrEmployees.tenantId, tenantId))).limit(1);
  return row ?? null;
}

export async function getEmployeeWithHistory(tenantId: string, id: string) {
  const emp = await getEmployee(tenantId, id);
  if (!emp) return null;
  const history = await db.select().from(hrSalaryHistory)
    .where(and(eq(hrSalaryHistory.tenantId, tenantId), eq(hrSalaryHistory.employeeId, id)))
    .orderBy(desc(hrSalaryHistory.effectiveDate));
  return { ...emp, salaryHistory: history };
}

/**
 * Cria colaborador + primeiro registro de histórico salarial em transação.
 * Garante que todo employee tem ao menos uma linha em hr_salary_history.
 */
/**
 * Vincula colaborador ao cadastro de Pessoas: cria/reutiliza registro em `pessoas`
 * e insere papel 'colaborador' em `pessoaPapeis` (onConflictDoNothing = idempotente).
 */
async function linkToPersonRole(
  tenantId: string,
  employeeId: string,
  clienteId: string,
  employee: HrEmployee,
): Promise<void> {
  try {
    let [pessoa] = await db.select().from(pessoas)
      .where(and(eq(pessoas.tenantId, tenantId), eq(pessoas.cnpjCpf, employee.cpf)))
      .limit(1);

    if (!pessoa) {
      [pessoa] = await db.insert(pessoas).values({
        tenantId,
        tipoPessoa: "PF",
        nomeFantasia: employee.fullName,
        cnpjCpf: employee.cpf,
        status: "ativo",
      }).returning();
    }

    await db.insert(pessoaPapeis).values({
      pessoaId: pessoa.id,
      tenantId,
      tipoPapel: "colaborador",
      status: "ativo",
      metadata: {
        hrEmployeeId: employeeId,
        clienteId,
        employmentType: employee.employmentType,
        admissionDate: employee.admissionDate,
      },
    }).onConflictDoNothing();
  } catch (err) {
    console.error("[hr] linkToPersonRole error (non-fatal):", err);
  }
}

export async function createEmployee(
  tenantId: string,
  input: InsertHrEmployee,
  createdById: string | null,
): Promise<HrEmployee> {
  return db.transaction(async (tx) => {
    const [emp] = await tx.insert(hrEmployees).values({ ...input, tenantId }).returning();
    await tx.insert(hrSalaryHistory).values({
      tenantId,
      employeeId: emp.id,
      effectiveDate: emp.admissionDate,
      salary: emp.baseSalary,
      reason: "admissao",
      notes: "Salário de admissão",
      createdById: createdById ?? undefined,
    });
    return emp;
  }).then(async (emp) => {
    await linkToPersonRole(tenantId, emp.id, input.clienteId, emp);
    return emp;
  });
}

export async function updateEmployee(tenantId: string, id: string, patch: Partial<InsertHrEmployee>) {
  // Bloquear alteração de baseSalary direto — usar updateSalary().
  const safe = { ...patch };
  delete (safe as any).baseSalary;
  delete (safe as any).tenantId;
  const [row] = await db.update(hrEmployees)
    .set({ ...safe, updatedAt: new Date() })
    .where(and(eq(hrEmployees.id, id), eq(hrEmployees.tenantId, tenantId)))
    .returning();
  return row ?? null;
}

/**
 * Reajuste salarial: insere linha em hrSalaryHistory + atualiza baseSalary.
 * Em transação para manter consistência.
 */
export async function updateSalary(
  tenantId: string,
  employeeId: string,
  data: { salary: string; effectiveDate: string; reason: string; notes?: string },
  createdById: string | null,
) {
  return db.transaction(async (tx) => {
    const [emp] = await tx.select().from(hrEmployees)
      .where(and(eq(hrEmployees.id, employeeId), eq(hrEmployees.tenantId, tenantId)))
      .limit(1);
    if (!emp) throw new Error("Colaborador não encontrado");
    const [hist] = await tx.insert(hrSalaryHistory).values({
      tenantId,
      employeeId,
      effectiveDate: data.effectiveDate,
      salary: data.salary,
      reason: data.reason,
      notes: data.notes,
      createdById: createdById ?? undefined,
    }).returning();
    const [updated] = await tx.update(hrEmployees)
      .set({ baseSalary: data.salary, updatedAt: new Date() })
      .where(and(eq(hrEmployees.id, employeeId), eq(hrEmployees.tenantId, tenantId)))
      .returning();
    return { employee: updated, history: hist };
  });
}

export async function updateStatus(
  tenantId: string,
  id: string,
  status: string,
  terminationDate?: string,
) {
  const patch: any = { status, updatedAt: new Date() };
  if (status === "terminated" && terminationDate) patch.terminationDate = terminationDate;
  if (status === "active") patch.terminationDate = null;
  const [row] = await db.update(hrEmployees)
    .set(patch)
    .where(and(eq(hrEmployees.id, id), eq(hrEmployees.tenantId, tenantId)))
    .returning();
  return row ?? null;
}

export async function listSalaryHistory(tenantId: string, employeeId: string): Promise<HrSalaryHistory[]> {
  return db.select().from(hrSalaryHistory)
    .where(and(eq(hrSalaryHistory.tenantId, tenantId), eq(hrSalaryHistory.employeeId, employeeId)))
    .orderBy(desc(hrSalaryHistory.effectiveDate));
}

/**
 * Exclui colaborador. Bloqueia se houver lançamentos de folha (mesmo em
 * período draft) — preserva integridade histórica. Para "remover da
 * operação" sem perder o passado, o usuário deve usar updateStatus(terminated).
 */
export async function deleteEmployee(tenantId: string, id: string) {
  const emp = await getEmployee(tenantId, id);
  if (!emp) {
    const err: any = new Error("Colaborador não encontrado");
    err.status = 404;
    throw err;
  }
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(hrPayrollEntries).where(eq(hrPayrollEntries.employeeId, id));
  if (count > 0) {
    const err: any = new Error(
      "Colaborador possui lançamentos em folha — desligue (status 'terminated') em vez de excluir",
    );
    err.status = 409;
    throw err;
  }
  await db.delete(hrEmployees)
    .where(and(eq(hrEmployees.id, id), eq(hrEmployees.tenantId, tenantId)));
  return { ok: true };
}

// ─── Conta Corrente do Colaborador ──────────────────────────────────────────
export type AccountEntryFilters = {
  from?: string;
  to?: string;
  category?: string;
  status?: string;
};

export async function listAccountEntries(
  tenantId: string, employeeId: string, f: AccountEntryFilters = {},
) {
  const conds = [
    eq(hrEmployeeAccountEntries.tenantId, tenantId),
    eq(hrEmployeeAccountEntries.employeeId, employeeId),
  ];
  if (f.from) conds.push(sql`${hrEmployeeAccountEntries.date} >= ${f.from}`);
  if (f.to) conds.push(sql`${hrEmployeeAccountEntries.date} <= ${f.to}`);
  if (f.category && f.category !== "all") conds.push(eq(hrEmployeeAccountEntries.category, f.category));
  if (f.status && f.status !== "all") conds.push(eq(hrEmployeeAccountEntries.status, f.status));
  return db.select().from(hrEmployeeAccountEntries)
    .where(and(...conds))
    .orderBy(desc(hrEmployeeAccountEntries.date), desc(hrEmployeeAccountEntries.createdAt));
}

export async function getAccountSummary(tenantId: string, employeeId: string) {
  const rows = await db.select({
    direction: hrEmployeeAccountEntries.direction,
    category: hrEmployeeAccountEntries.category,
    total: sql<string>`COALESCE(SUM(${hrEmployeeAccountEntries.amount}), 0)`,
  }).from(hrEmployeeAccountEntries)
    .where(and(
      eq(hrEmployeeAccountEntries.tenantId, tenantId),
      eq(hrEmployeeAccountEntries.employeeId, employeeId),
    ))
    .groupBy(hrEmployeeAccountEntries.direction, hrEmployeeAccountEntries.category);

  let totalCredit = 0, totalDebit = 0;
  const byCategory: Record<string, number> = {};
  for (const r of rows) {
    const v = parseFloat(r.total);
    if (r.direction === "credit") totalCredit += v;
    else totalDebit += v;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + (r.direction === "credit" ? v : -v);
  }
  return {
    totalCredit: totalCredit.toFixed(2),
    totalDebit: totalDebit.toFixed(2),
    saldo: (totalCredit - totalDebit).toFixed(2),
    byCategory,
  };
}

export async function createAccountEntry(
  tenantId: string, employeeId: string,
  input: Omit<InsertHrEmployeeAccountEntry, "tenantId" | "employeeId">,
  createdById: string | null,
): Promise<HrEmployeeAccountEntry> {
  const emp = await getEmployee(tenantId, employeeId);
  if (!emp) { const e: any = new Error("Colaborador não encontrado"); e.status = 404; throw e; }
  const [row] = await db.insert(hrEmployeeAccountEntries).values({
    ...input, tenantId, employeeId,
    createdById: createdById ?? undefined,
  }).returning();
  return row;
}

export async function updateAccountEntry(
  tenantId: string, employeeId: string, entryId: string,
  patch: Partial<InsertHrEmployeeAccountEntry>,
) {
  const safe: any = { ...patch };
  delete safe.tenantId; delete safe.employeeId;
  const [row] = await db.update(hrEmployeeAccountEntries)
    .set({ ...safe, updatedAt: new Date() })
    .where(and(
      eq(hrEmployeeAccountEntries.id, entryId),
      eq(hrEmployeeAccountEntries.tenantId, tenantId),
      eq(hrEmployeeAccountEntries.employeeId, employeeId),
    ))
    .returning();
  return row ?? null;
}

export async function deleteAccountEntry(tenantId: string, employeeId: string, entryId: string) {
  await db.delete(hrEmployeeAccountEntries)
    .where(and(
      eq(hrEmployeeAccountEntries.id, entryId),
      eq(hrEmployeeAccountEntries.tenantId, tenantId),
      eq(hrEmployeeAccountEntries.employeeId, employeeId),
    ));
  return { ok: true };
}

// ─── Contagens (KPIs simples) ───────────────────────────────────────────────
export async function getEmployeeCounts(tenantId: string, clienteId: string) {
  const rows = await db.select({
    status: hrEmployees.status,
    count: sql<number>`count(*)::int`,
  }).from(hrEmployees)
    .where(and(eq(hrEmployees.tenantId, tenantId), eq(hrEmployees.clienteId, clienteId)))
    .groupBy(hrEmployees.status);
  const out: Record<string, number> = { active: 0, vacation: 0, leave: 0, terminated: 0, total: 0 };
  for (const r of rows) {
    out[r.status] = r.count;
    if (r.status !== "terminated") out.total += r.count;
  }
  return out;
}
