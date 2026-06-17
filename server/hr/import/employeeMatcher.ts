// Sprint RH-3 — match e auto-criação de colaboradores a partir do extrato.
// Match por CPF (chave forte). Quando ausente, cria hr_employees com
// needsReview=true para complementação posterior.

import { db } from "../../db";
import { and, eq, ilike } from "drizzle-orm";
import {
  hrEmployees, hrPositions, hrSalaryHistory, hrDepartments,
  type HrEmployee,
} from "@shared/schema";
import type { CollaboratorExtracted } from "./dominioParser";

export interface MatchResult {
  extracted: CollaboratorExtracted;
  matchType: "matched" | "auto_created" | "conflict";
  employeeId: string;
  isNew: boolean;
  needsReview: boolean;
  resolvedDepartmentId: string | null;
  resolvedCostCenterId: string | null;
  warnings: string[];
}

// Bigram-based similarity (0..1). Suficiente para detectar divergências de
// nome significativas sem dependência externa.
export function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const g1 = grams(x), g2 = grams(y);
  let inter = 0;
  g1.forEach(g => { if (g2.has(g)) inter++; });
  return (2 * inter) / (g1.size + g2.size);
}

function parseBRDate(s: string): string {
  const m = s?.match?.(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return new Date().toISOString().slice(0, 10);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function cleanCpf(s: string): string {
  return (s || "").replace(/[^0-9]/g, "");
}

async function resolveOrCreatePosition(
  tenantId: string, clienteId: string, cargo: string, cbo: string,
): Promise<string> {
  const nome = (cargo || "Não informado").trim().slice(0, 100);
  const [existing] = await db.select().from(hrPositions)
    .where(and(
      eq(hrPositions.tenantId, tenantId),
      eq(hrPositions.clienteId, clienteId),
      ilike(hrPositions.nome, nome),
    )).limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(hrPositions).values({
    tenantId, clienteId, nome, cboCode: cbo || null,
  } as any).returning();
  return created.id;
}

// Tenta resolver depto pelo nome extraído do Domínio. Não cria — depto é
// opcional e o usuário pode atribuir depois.
async function findDepartmentByName(
  tenantId: string, clienteId: string, nome: string,
): Promise<{ id: string; centroCustoId: string | null } | null> {
  if (!nome) return null;
  const [d] = await db.select({ id: hrDepartments.id, centroCustoId: hrDepartments.centroCustoId })
    .from(hrDepartments)
    .where(and(
      eq(hrDepartments.tenantId, tenantId),
      eq(hrDepartments.clienteId, clienteId),
      ilike(hrDepartments.nome, nome),
    )).limit(1);
  return d ?? null;
}

async function autoCreateEmployee(
  tenantId: string, clienteId: string, collab: CollaboratorExtracted,
  createdById: string | null,
): Promise<HrEmployee> {
  const positionId = await resolveOrCreatePosition(tenantId, clienteId, collab.cargo, collab.cboCargo);
  const dept = await findDepartmentByName(tenantId, clienteId, collab.department);
  const baseSalary = Number(collab.salaryBase || 0).toFixed(2);
  const monthlyHours = Number(collab.monthlyHours || 220);
  const admissionDate = parseBRDate(collab.admissionDate);
  const cpf = cleanCpf(collab.cpf);

  const [emp] = await db.insert(hrEmployees).values({
    tenantId, clienteId,
    employeeCode: String(collab.employeeCode || cpf.slice(-6) || `IMP-${Date.now()}`).slice(0, 20),
    fullName: collab.fullName.slice(0, 200),
    cpf,
    admissionDate,
    status: "active",
    positionId,
    departmentId: dept?.id ?? null,
    employmentType: "clt",
    baseSalary,
    monthlyHours,
    cboCode: collab.cboCargo || null,
    needsReview: true,
  } as any).returning();

  await db.insert(hrSalaryHistory).values({
    tenantId,
    employeeId: emp.id,
    effectiveDate: admissionDate,
    salary: baseSalary,
    reason: "admissao",
    notes: "Criado automaticamente via importação Domínio",
    createdById: createdById ?? null,
  } as any);

  return emp;
}

export async function matchCollaborators(
  collaborators: CollaboratorExtracted[],
  tenantId: string,
  clienteId: string,
  createdById: string | null,
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  for (const collab of collaborators) {
    const cpf = cleanCpf(collab.cpf);
    const warnings: string[] = [];

    if (!cpf || cpf.length !== 11) {
      warnings.push("CPF ausente ou inválido — colaborador ignorado");
      // Não cria sem CPF — bloquearia a unique constraint.
      results.push({
        extracted: collab,
        matchType: "conflict",
        employeeId: "",
        isNew: false,
        needsReview: true,
        resolvedDepartmentId: null,
        resolvedCostCenterId: null,
        warnings,
      });
      continue;
    }

    const [existing] = await db.select().from(hrEmployees)
      .where(and(
        eq(hrEmployees.tenantId, tenantId),
        eq(hrEmployees.clienteId, clienteId),
        eq(hrEmployees.cpf, cpf),
      )).limit(1);

    if (existing) {
      const sim = nameSimilarity(existing.fullName, collab.fullName);
      const matchType: MatchResult["matchType"] = sim < 0.7 ? "conflict" : "matched";
      if (matchType === "conflict") {
        warnings.push(`Nome do extrato ('${collab.fullName}') diverge do cadastro ('${existing.fullName}')`);
      }
      // Resolve CC pelo depto do colaborador existente.
      let costCenterId: string | null = null;
      if (existing.departmentId) {
        const [d] = await db.select({ centroCustoId: hrDepartments.centroCustoId })
          .from(hrDepartments).where(eq(hrDepartments.id, existing.departmentId)).limit(1);
        costCenterId = d?.centroCustoId ?? null;
      }
      results.push({
        extracted: collab,
        matchType,
        employeeId: existing.id,
        isNew: false,
        needsReview: matchType === "conflict",
        resolvedDepartmentId: existing.departmentId ?? null,
        resolvedCostCenterId: costCenterId,
        warnings,
      });
      continue;
    }

    // Auto-criação.
    try {
      const created = await autoCreateEmployee(tenantId, clienteId, collab, createdById);
      const dept = created.departmentId
        ? await db.select({ centroCustoId: hrDepartments.centroCustoId })
            .from(hrDepartments).where(eq(hrDepartments.id, created.departmentId)).limit(1)
        : [];
      results.push({
        extracted: collab,
        matchType: "auto_created",
        employeeId: created.id,
        isNew: true,
        needsReview: true,
        resolvedDepartmentId: created.departmentId ?? null,
        resolvedCostCenterId: dept[0]?.centroCustoId ?? null,
        warnings: ["Colaborador criado automaticamente — verifique os dados cadastrais"],
      });
    } catch (err: any) {
      results.push({
        extracted: collab,
        matchType: "conflict",
        employeeId: "",
        isNew: false,
        needsReview: true,
        resolvedDepartmentId: null,
        resolvedCostCenterId: null,
        warnings: [`Falha ao criar colaborador: ${err?.message || err}`],
      });
    }
  }
  return results;
}
