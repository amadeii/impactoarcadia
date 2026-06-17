// Sprint RH-4 — Orquestrador da exportação Domínio.
// Carrega o período completo, dispara os 4 geradores em paralelo, monta o ZIP
// e atualiza o período (status=exported, exportedAt, exportCount++).

import { db } from "../../db";
import { and, eq, sql } from "drizzle-orm";
import {
  hrPayrollPeriods, hrPayrollEntries, hrEmployees, hrPositions,
  hrDepartments, centrosCusto, clients, sociedades,
  type HrPayrollPeriod, type HrPayrollEntry, type HrEmployee,
  type HrPosition,
} from "@shared/schema";
import { generateExtratoPdf } from "./extratoPdfGenerator";
import { generateRecibosPdf } from "./recibosPdfGenerator";
import { generateExtratoTxt } from "./extratoTxtGenerator";
import { generateManifesto } from "./manifestoGenerator";
import { buildExportZip } from "./exportZip";

export interface RubricLine {
  code: string;
  description: string;
  type?: string;
  reference: string;
  value: number;
}

export interface PayrollEntryFull extends HrPayrollEntry {
  employee: HrEmployee & { position: { name: string } | null };
  costCenter: { id: string; codigo: string; nome: string } | null;
  rubrics: { earnings: RubricLine[]; discounts: RubricLine[]; informatives: RubricLine[] };
}

export interface PeriodFull {
  id: string;
  tenantId: string;
  clienteId: string;
  competence: string;             // YYYY-MM
  status: string;
  totalGross: number;
  totalDiscounts: number;
  totalNet: number;
  totalInssEmployee: number;
  totalFgts: number;
  totalIrrf: number;
  controlTxIds: string[];
  company: { name: string; cnpj: string };
  entries: PayrollEntryFull[];
}

export interface ExportResult {
  zipBuffer: Buffer;
  zipName: string;
  filesCount: number;
  totalSize: number;
  fileNames: string[];
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v ?? 0);
  return Number.isNaN(n) ? 0 : n;
}

function splitRubrics(raw: any): { earnings: RubricLine[]; discounts: RubricLine[]; informatives: RubricLine[] } {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  const earnings: RubricLine[] = [];
  const discounts: RubricLine[] = [];
  const informatives: RubricLine[] = [];
  for (const r of arr) {
    const item: RubricLine = {
      code: String(r.code ?? "").slice(0, 10),
      description: String(r.description ?? ""),
      reference: String(r.reference ?? ""),
      value: num(r.value),
      type: r.type,
    };
    const t = String(r.type ?? "").toLowerCase();
    if (t === "desconto" || t === "discount" || t === "d") discounts.push(item);
    else if (t === "informativo" || t === "informative" || t === "i") informatives.push(item);
    else earnings.push(item);
  }
  return { earnings, discounts, informatives };
}

// Carrega período + entries + colaboradores + cargos + centros de custo +
// dados da empresa (cliente + sociedade para CNPJ).
export async function loadPeriodFull(tenantId: string, periodId: string): Promise<PeriodFull> {
  const [period] = await db.select().from(hrPayrollPeriods)
    .where(and(eq(hrPayrollPeriods.id, periodId), eq(hrPayrollPeriods.tenantId, tenantId))).limit(1);
  if (!period) {
    const e: any = new Error("Período não encontrado"); e.status = 404; throw e;
  }

  // Cliente + sociedade (sociedade traz CNPJ; cliente.company traz nome fantasia).
  // IMPORTANTE: filtrar cliente por tenant também — defesa em profundidade.
  const [client] = await db.select().from(clients)
    .where(and(eq(clients.id, period.clienteId), eq(clients.tenantId, tenantId)))
    .limit(1);
  const [soc] = await db.select().from(sociedades)
    .where(and(eq(sociedades.tenantId, tenantId), eq(sociedades.clientId, period.clienteId)))
    .limit(1);

  const companyName = (soc?.razaoSocial || soc?.nomeFantasia || client?.company || client?.name || "Empresa não informada").trim();
  const companyCnpj = (soc?.cnpj || "").trim();

  // Entries com join nos dependentes.
  const rawEntries = await db.select({
    entry: hrPayrollEntries,
    employee: hrEmployees,
    positionName: hrPositions.nome,
    ccId: centrosCusto.id,
    ccCodigo: centrosCusto.codigo,
    ccNome: centrosCusto.nome,
  })
    .from(hrPayrollEntries)
    .leftJoin(hrEmployees, and(
      eq(hrPayrollEntries.employeeId, hrEmployees.id),
      eq(hrEmployees.tenantId, tenantId),
      eq(hrEmployees.clienteId, period.clienteId),
    ))
    .leftJoin(hrPositions, and(
      eq(hrEmployees.positionId, hrPositions.id),
      eq(hrPositions.tenantId, tenantId),
    ))
    .leftJoin(centrosCusto, and(
      eq(hrPayrollEntries.costCenterId, centrosCusto.id),
      eq(centrosCusto.tenantId, tenantId),
    ))
    .where(and(
      eq(hrPayrollEntries.periodId, periodId),
      eq(hrPayrollEntries.tenantId, tenantId),
    ))
    .orderBy(hrEmployees.fullName);

  const entries: PayrollEntryFull[] = rawEntries
    .filter(r => r.employee) // ignora entries órfãs
    .map(r => ({
      ...r.entry,
      employee: { ...(r.employee as HrEmployee), position: r.positionName ? { name: r.positionName } : null },
      costCenter: r.ccId ? { id: r.ccId, codigo: r.ccCodigo ?? "", nome: r.ccNome ?? "" } : null,
      rubrics: splitRubrics(r.entry.rubrics),
    }));

  return {
    id: period.id,
    tenantId: period.tenantId,
    clienteId: period.clienteId,
    competence: period.competence,
    status: period.status,
    totalGross: num(period.totalGross),
    totalDiscounts: num(period.totalDiscounts),
    totalNet: num(period.totalNet),
    totalInssEmployee: num(period.totalInssEmployee),
    totalFgts: num(period.totalFgts),
    totalIrrf: num(period.totalIrrf),
    controlTxIds: (period.controlTxIds as string[] | null) ?? [],
    company: { name: companyName, cnpj: companyCnpj },
    entries,
  };
}

function buildZipName(period: PeriodFull): string {
  const cnpjClean = (period.company.cnpj || "SEMCNPJ").replace(/[^0-9A-Z]/gi, "");
  const yyyymm = period.competence.replace("-", "");
  const ts = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 13);
  return `ARCADIA_EXPORT_${cnpjClean}_${yyyymm}_${ts}.zip`;
}

function buildFileBaseNames(period: PeriodFull): { extratoPdf: string; extratoTxt: string; recibosPdf: string; manifesto: string } {
  const cnpjClean = (period.company.cnpj || "SEMCNPJ").replace(/[^0-9A-Z]/gi, "");
  const yyyymm = period.competence.replace("-", "");
  return {
    extratoPdf: `extrato_${yyyymm}_${cnpjClean}.pdf`,
    extratoTxt: `extrato_${yyyymm}_${cnpjClean}.txt`,
    recibosPdf: `recibos_${yyyymm}_${cnpjClean}.pdf`,
    manifesto: `manifesto_${yyyymm}_${cnpjClean}.json`,
  };
}

export async function exportPeriodo(tenantId: string, periodId: string): Promise<ExportResult> {
  const period = await loadPeriodFull(tenantId, periodId);
  if (period.entries.length === 0) {
    const e: any = new Error("Período sem colaboradores — nada a exportar");
    e.status = 422; throw e;
  }

  const [extratoPdf, recibosPdf, extratoTxt] = await Promise.all([
    generateExtratoPdf(period),
    generateRecibosPdf(period),
    Promise.resolve(generateExtratoTxt(period)),
  ]);

  const manifesto = generateManifesto({ period, extratoPdf, recibosPdf, extratoTxt, exportedAt: new Date() });
  const manifestoBuf = Buffer.from(JSON.stringify(manifesto, null, 2), "utf-8");

  const names = buildFileBaseNames(period);
  const zipBuffer = await buildExportZip({
    [names.extratoPdf]: extratoPdf,
    [names.extratoTxt]: extratoTxt,
    [names.recibosPdf]: recibosPdf,
    [names.manifesto]: manifestoBuf,
  });

  // Atualiza período: status=exported (idempotente), exportedAt, exportCount++.
  await db.update(hrPayrollPeriods)
    .set({
      status: "exported",
      exportedAt: new Date(),
      exportCount: sql`${hrPayrollPeriods.exportCount} + 1`,
      updatedAt: new Date(),
    } as any)
    .where(and(eq(hrPayrollPeriods.id, periodId), eq(hrPayrollPeriods.tenantId, tenantId)));

  return {
    zipBuffer,
    zipName: buildZipName(period),
    filesCount: 4,
    totalSize: zipBuffer.length,
    fileNames: Object.values(names),
  };
}

// Variantes que retornam só um arquivo (para preview e downloads parciais).
export async function generateOnly(
  tenantId: string,
  periodId: string,
  kind: "extratoPdf" | "recibosPdf" | "extratoTxt",
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const period = await loadPeriodFull(tenantId, periodId);
  const names = buildFileBaseNames(period);
  if (kind === "extratoPdf") {
    return { buffer: await generateExtratoPdf(period), filename: names.extratoPdf, contentType: "application/pdf" };
  }
  if (kind === "recibosPdf") {
    return { buffer: await generateRecibosPdf(period), filename: names.recibosPdf, contentType: "application/pdf" };
  }
  return { buffer: generateExtratoTxt(period), filename: names.extratoTxt, contentType: "text/plain; charset=iso-8859-1" };
}

export async function buildPreviewManifesto(tenantId: string, periodId: string) {
  const period = await loadPeriodFull(tenantId, periodId);
  // Manifesto "seco" (sem hashes dos arquivos — só o que conseguimos sem gerar nada).
  return {
    period: {
      id: period.id,
      competence: period.competence,
      status: period.status,
      company: period.company,
    },
    totals: {
      collaborators: period.entries.length,
      totalGross: period.totalGross,
      totalDiscounts: period.totalDiscounts,
      totalNet: period.totalNet,
      totalInss: period.totalInssEmployee,
      totalFgts: period.totalFgts,
      totalIrrf: period.totalIrrf,
    },
    controlTransactions: period.controlTxIds,
    collaborators: period.entries.map(e => ({
      id: e.employee.id,
      code: e.employee.employeeCode,
      name: e.employee.fullName,
      cpf: e.employee.cpf,
      situation: e.situation,
      totalGross: num(e.totalGross),
      netSalary: num(e.netSalary),
    })),
    warnings: [
      ...(period.company.cnpj ? [] : ["Empresa cliente não tem CNPJ cadastrado em Sociedades — exportação usará marcador 'SEMCNPJ'"]),
      ...(period.status !== "approved" && period.status !== "exported"
        ? [`Período em status '${period.status}' — recomendado aprovar antes de exportar`]
        : []),
    ],
  };
}
