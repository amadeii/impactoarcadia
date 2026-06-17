// Sprint RH-3 — orquestrador do pipeline de importação Domínio.
// Combina: extract → classify → parse → match → preview store → confirm.
// Preview tem TTL de 2h (limpo via cron).

import { db } from "../../db";
import { and, eq, lt, sql } from "drizzle-orm";
import {
  hrImportPreviews, hrPayrollPeriods, hrPayrollEntries, hrRubricMappings,
  lancamentosFinanceiros, planosContas,
  type HrImportPreview,
} from "@shared/schema";
import { extractPdfText } from "./pdfExtractor";
import {
  classifyDocument, extractCnpj, extractCompetence, brCompetenceToIso,
  type DominioDocType,
} from "./documentClassifier";
import { parseExtratoMensal, type ExtratoData } from "./dominioParser";
import { matchCollaborators, type MatchResult } from "./employeeMatcher";

const PREVIEW_TTL_HOURS = 2;

export interface UploadResult {
  docType: DominioDocType;
  competence: string | null;        // YYYY-MM
  competenceLabel: string | null;   // MM/AAAA
  cnpj: string | null;
  rawText: string;
  pageCount: number;
}

// Etapas 1-2: extrai texto e classifica. Não consome LLM.
export async function uploadAndClassify(buffer: Buffer): Promise<UploadResult> {
  const rawText = await extractPdfText(buffer);
  const docType = classifyDocument(rawText);
  const cnpj = extractCnpj(rawText);
  const compBR = extractCompetence(rawText);
  const competence = compBR ? brCompetenceToIso(compBR) : null;
  const pageCount = rawText.split("--- PÁGINA ---").length;
  return { docType, competence, competenceLabel: compBR, cnpj, rawText, pageCount };
}

// Etapas 3-5: parser IA + match + persistência do preview.
export async function buildPreview(input: {
  tenantId: string;
  clienteId: string;
  createdBy: string | null;
  sourceFile: string;
  rawText: string;
}): Promise<{ previewId: string; data: ExtratoData; matches: MatchResult[]; warnings: string[] }> {
  const { tenantId, clienteId, createdBy, sourceFile, rawText } = input;

  // 3. parser
  const data = await parseExtratoMensal(rawText, tenantId);

  // 4. match / auto-create
  const matches = await matchCollaborators(data.collaborators, tenantId, clienteId, createdBy);

  // Validação: período já existe em status approved/exported? Bloqueio leve
  // — alerta no preview, decisão final na confirmação.
  const competence = brCompetenceToIso(data.competence) || data.competence;
  const warnings: string[] = [];
  const sumNet = data.collaborators.reduce((s, c) => s + Number(c.netSalary || 0), 0);
  if (Math.abs(sumNet - Number(data.totalNet || 0)) > 1.0) {
    warnings.push(
      `Inconsistência: total líquido do extrato (${Number(data.totalNet).toFixed(2)}) ` +
      `difere da soma dos colaboradores (${sumNet.toFixed(2)})`,
    );
  }
  const conflicts = matches.filter(m => m.matchType === "conflict");
  if (conflicts.length) warnings.push(`${conflicts.length} colaborador(es) com conflito de nome ou CPF inválido`);
  const created = matches.filter(m => m.matchType === "auto_created");
  if (created.length) warnings.push(`${created.length} colaborador(es) criado(s) automaticamente`);

  const [existing] = await db.select({ id: hrPayrollPeriods.id, status: hrPayrollPeriods.status })
    .from(hrPayrollPeriods)
    .where(and(eq(hrPayrollPeriods.tenantId, tenantId), eq(hrPayrollPeriods.clienteId, clienteId), eq(hrPayrollPeriods.competence, competence))).limit(1);
  if (existing) {
    warnings.push(`Já existe um período '${competence}' (status=${existing.status}) — a confirmação substituirá apenas se estiver em draft/reviewed`);
  }

  // 5. salva preview
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_HOURS * 3600 * 1000);
  const [row] = await db.insert(hrImportPreviews).values({
    tenantId, clienteId,
    competence,
    sourceFile: sourceFile.slice(0, 500),
    docType: "extrato_mensal",
    rawText,
    extractedData: data as any,
    matchResults: matches as any,
    status: "pending",
    validationErrors: { warnings } as any,
    expiresAt,
    createdBy: createdBy ?? null,
  } as any).returning();

  return { previewId: row.id, data, matches, warnings };
}

export async function getPreview(tenantId: string, id: string): Promise<HrImportPreview | null> {
  const [row] = await db.select().from(hrImportPreviews)
    .where(and(eq(hrImportPreviews.id, id), eq(hrImportPreviews.tenantId, tenantId))).limit(1);
  if (!row) return null;
  if (row.expiresAt && row.expiresAt < new Date() && row.status !== "confirmed") {
    return { ...row, status: "expired" };
  }
  return row;
}

export async function updatePreview(
  tenantId: string, id: string,
  patch: { matchResults?: MatchResult[]; extractedData?: ExtratoData; status?: string },
): Promise<HrImportPreview | null> {
  const current = await getPreview(tenantId, id);
  if (!current) return null;
  if (current.status === "confirmed") {
    const e: any = new Error("Preview já confirmado — não pode ser editado");
    e.status = 409; throw e;
  }
  if (current.status === "expired") {
    const e: any = new Error("Preview expirado — refaça a importação");
    e.status = 410; throw e;
  }
  const [row] = await db.update(hrImportPreviews).set({
    ...(patch.matchResults !== undefined ? { matchResults: patch.matchResults as any } : {}),
    ...(patch.extractedData !== undefined ? { extractedData: patch.extractedData as any } : {}),
    ...(patch.status ? { status: patch.status } : {}),
    updatedAt: new Date(),
  } as any).where(and(eq(hrImportPreviews.id, id), eq(hrImportPreviews.tenantId, tenantId))).returning();
  return row;
}

export async function deletePreview(tenantId: string, id: string): Promise<boolean> {
  const result = await db.delete(hrImportPreviews)
    .where(and(eq(hrImportPreviews.id, id), eq(hrImportPreviews.tenantId, tenantId)));
  return ((result as any).rowCount ?? 0) > 0;
}

// Etapa 6: confirma — em transação atômica, cria período + entries + lançamentos
// no Control. Reaproveita o agrupamento por (CC × tipo) do payrollService.
export async function confirmImport(
  tenantId: string, previewId: string, approvedBy: string | null,
): Promise<{ periodId: string; entryCount: number; controlTxIds: string[] }> {
  const preview = await getPreview(tenantId, previewId);
  if (!preview) throw new Error("Preview não encontrado");
  if (preview.status === "confirmed") {
    const e: any = new Error("Preview já confirmado");
    e.status = 409; throw e;
  }
  if (preview.status === "expired") {
    const e: any = new Error("Preview expirado");
    e.status = 410; throw e;
  }
  const data = preview.extractedData as ExtratoData | null;
  const matches = preview.matchResults as MatchResult[] | null;
  if (!data || !matches?.length) throw new Error("Preview sem dados extraídos");

  const competence = preview.competence;
  const compLabel = (() => {
    const [y, m] = competence.split("-");
    return `${m}/${y}`;
  })();
  const dueDate = (() => {
    const [y, m] = competence.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  })();

  return db.transaction(async (tx) => {
    // Verifica se já existe período aprovado/exportado — bloqueia.
    const [existing] = await tx.select().from(hrPayrollPeriods)
      .where(and(
        eq(hrPayrollPeriods.tenantId, tenantId),
        eq(hrPayrollPeriods.clienteId, preview.clienteId),
        eq(hrPayrollPeriods.competence, competence),
      )).limit(1);
    if (existing && (existing.status === "approved" || existing.status === "exported")) {
      const e: any = new Error(`Período ${competence} já foi aprovado anteriormente — reverta antes de reimportar`);
      e.status = 409; throw e;
    }

    let periodId: string;
    if (existing) {
      // Substitui entries do período em draft/reviewed. Defensivamente cancela
      // quaisquer lançamentos do Control que tenham ficado órfãos (cenário
      // raro: revert parcial / falha anterior). Em fluxo normal draft/reviewed
      // não tem controlTxIds (revert os zera), mas garantimos integridade.
      const orphanIds = (existing.controlTxIds as string[] | null) ?? [];
      if (orphanIds.length > 0) {
        const { inArray } = await import("drizzle-orm");
        await tx.update(lancamentosFinanceiros)
          .set({ status: "cancelado", updatedAt: new Date() })
          .where(and(
            eq(lancamentosFinanceiros.tenantId, tenantId),
            inArray(lancamentosFinanceiros.id, orphanIds),
          ));
      }
      await tx.delete(hrPayrollEntries).where(eq(hrPayrollEntries.periodId, existing.id));
      periodId = existing.id;
    } else {
      const [created] = await tx.insert(hrPayrollPeriods).values({
        tenantId,
        clienteId: preview.clienteId,
        competence,
        status: "draft",
        source: "dominio_import",
      } as any).returning();
      periodId = created.id;
    }

    // Insere entries a partir dos matches válidos (employeeId não vazio).
    const valid = matches.filter(m => m.employeeId);
    let inserted = 0;
    for (const m of valid) {
      const c = m.extracted;
      const rubrics = [
        ...(c.earnings || []).map(r => ({ ...r, type: "provento" })),
        ...(c.discounts || []).map(r => ({ ...r, type: "desconto" })),
        ...(c.informatives || []).map(r => ({ ...r, type: "informativo" })),
      ];
      await tx.insert(hrPayrollEntries).values({
        tenantId, periodId,
        employeeId: m.employeeId,
        departmentId: m.resolvedDepartmentId ?? undefined,
        costCenterId: m.resolvedCostCenterId ?? undefined,
        salaryBase: Number(c.salaryBase || 0).toFixed(2),
        totalGross: Number(c.totalGross || 0).toFixed(2),
        totalDiscounts: Number(c.totalDiscounts || 0).toFixed(2),
        netSalary: Number(c.netSalary || 0).toFixed(2),
        inssBase: Number(c.inssBase || 0).toFixed(2),
        inssValue: Number(c.inssValue || 0).toFixed(2),
        fgtsBase: Number(c.fgtsBase || 0).toFixed(2),
        fgtsValue: Number(c.fgtsValue || 0).toFixed(2),
        irrfBase: Number(c.irrfBase || 0).toFixed(2),
        irrfValue: Number(c.irrfValue || 0).toFixed(2),
        situation: c.situation || "Trabalhando",
        rubrics: rubrics as any,
      } as any);
      inserted++;
    }

    // Recalcula totais do período.
    const allEntries = await tx.select().from(hrPayrollEntries).where(eq(hrPayrollEntries.periodId, periodId));
    const sum = (key: keyof typeof allEntries[number]) =>
      allEntries.reduce((acc, r) => acc + Number((r as any)[key] ?? 0), 0).toFixed(2);

    // Aprova: gera lançamentos no Control agrupados por (CC × tipo).
    const groups = new Map<string, typeof allEntries>();
    for (const e of allEntries) {
      const k = e.costCenterId ?? "__none__";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(e);
    }

    const TYPES: Array<{ key: "netSalary" | "inssValue" | "fgtsValue" | "irrfValue"; label: string; codigo: string }> = [
      { key: "netSalary", label: "Salários",        codigo: "5.1.01" },
      { key: "inssValue", label: "INSS Empregados", codigo: "5.1.02" },
      { key: "fgtsValue", label: "FGTS",            codigo: "5.1.03" },
      { key: "irrfValue", label: "IRRF Retido",     codigo: "5.1.04" },
    ];

    const txIds: string[] = [];
    for (const [ccKey, ccEntries] of Array.from(groups.entries())) {
      const ccId = ccKey === "__none__" ? null : ccKey;
      for (const t of TYPES) {
        const total = ccEntries.reduce((acc, r) => acc + Number((r as any)[t.key] ?? 0), 0);
        if (total <= 0) continue;
        const [pc] = await tx.select({ id: planosContas.id }).from(planosContas)
          .where(and(eq(planosContas.tenantId, tenantId), eq(planosContas.codigo, t.codigo))).limit(1);
        const [lanc] = await tx.insert(lancamentosFinanceiros).values({
          tenantId,
          clienteId: preview.clienteId,
          tipo: "pagar",
          descricao: `Folha ${compLabel} — ${t.label} (Domínio)`,
          valor: total.toFixed(2),
          dataVencimento: dueDate,
          status: "previsto",
          planoContaId: pc?.id ?? undefined,
          centroCustoId: ccId ?? undefined,
          origem: "integracao",
          criadoPor: approvedBy ?? undefined,
          observacoes: `Importado do Domínio (preview ${previewId}) — ${ccEntries.length} colaborador(es)`,
        } as any).returning();
        txIds.push(lanc.id);
      }
    }

    await tx.update(hrPayrollPeriods).set({
      status: "approved",
      source: "dominio_import",
      totalGross: sum("totalGross"),
      totalDiscounts: sum("totalDiscounts"),
      totalNet: sum("netSalary"),
      totalInssEmployee: sum("inssValue"),
      totalFgts: sum("fgtsValue"),
      totalIrrf: sum("irrfValue"),
      controlTxIds: txIds as any,
      approvedAt: new Date(),
      approvedBy: approvedBy ?? undefined,
      updatedAt: new Date(),
    } as any).where(eq(hrPayrollPeriods.id, periodId));

    await tx.update(hrImportPreviews).set({
      status: "confirmed", updatedAt: new Date(),
    }).where(eq(hrImportPreviews.id, previewId));

    return { periodId, entryCount: inserted, controlTxIds: txIds };
  });
}

// Rubricas — CRUD simples.
export async function listRubricMappings(tenantId: string) {
  return db.select().from(hrRubricMappings)
    .where(eq(hrRubricMappings.tenantId, tenantId))
    .orderBy(hrRubricMappings.dominioCode);
}

export async function upsertRubricMapping(tenantId: string, data: {
  dominioCode: string; dominioDescription?: string; type: string; category: string;
  affectsControl?: boolean;
}) {
  const result = await db.execute(sql`
    INSERT INTO hr_rubric_mappings
      (tenant_id, dominio_code, dominio_description, type, category, affects_control, is_system)
    VALUES (${tenantId}, ${data.dominioCode}, ${data.dominioDescription ?? null},
            ${data.type}, ${data.category}, ${data.affectsControl ?? true}, false)
    ON CONFLICT (tenant_id, dominio_code) DO UPDATE
      SET dominio_description = EXCLUDED.dominio_description,
          type = EXCLUDED.type,
          category = EXCLUDED.category,
          affects_control = EXCLUDED.affects_control
    RETURNING *
  `);
  return (result as any).rows?.[0];
}

export async function deleteRubricMapping(tenantId: string, id: string) {
  const result = await db.delete(hrRubricMappings)
    .where(and(eq(hrRubricMappings.id, id), eq(hrRubricMappings.tenantId, tenantId)));
  return ((result as any).rowCount ?? 0) > 0;
}

// Limpeza de previews expirados — chamada pelo cron.
export async function cleanupExpiredPreviews(): Promise<number> {
  const result = await db.delete(hrImportPreviews)
    .where(and(lt(hrImportPreviews.expiresAt, new Date()), sql`status <> 'confirmed'`));
  return (result as any).rowCount ?? 0;
}
