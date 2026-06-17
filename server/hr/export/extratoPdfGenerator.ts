// Sprint RH-4 — PDF do Extrato Mensal (layout fiel ao Domínio).
// Página 1+: blocos por colaborador (proventos | descontos lado a lado).
// Página final: resumo por rubrica + totais + situações.

import PDFDocument from "pdfkit";
import type { PeriodFull, PayrollEntryFull, RubricLine } from "./dominioExporter";

const PAGE_BOTTOM_THRESHOLD = 760; // y limite antes de quebrar página

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtCPF(c: string): string {
  const d = (c || "").replace(/\D/g, "").padStart(11, "0").slice(0, 11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function fmtDate(d: any): string {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, dd] = s.split("-");
  return y && m && dd ? `${dd}/${m}/${y}` : s;
}
function fmtCompetence(c: string): string {
  const [y, m] = c.split("-");
  return `${m}/${y}`;
}
function pad(s: string, n: number): string {
  return (s ?? "").length > n ? (s ?? "").slice(0, n) : (s ?? "").padEnd(n, " ");
}
function padR(s: string, n: number): string {
  return (s ?? "").length > n ? (s ?? "").slice(-n) : (s ?? "").padStart(n, " ");
}

function renderHeader(doc: any, period: PeriodFull) {
  doc.font("Courier-Bold").fontSize(11)
    .text("EXTRATO MENSAL", 40, 30, { align: "center" });
  doc.font("Courier").fontSize(8)
    .text(`${period.company.name}   CNPJ: ${period.company.cnpj || "—"}`, 40, 50, { align: "center" });
  doc.text(`Competência: ${fmtCompetence(period.competence)}    Emitido em: ${new Date().toLocaleString("pt-BR")}`,
    40, 62, { align: "center" });
  doc.moveTo(40, 78).lineTo(555, 78).stroke();
  doc.y = 84;
}

function ensureSpace(doc: any, period: PeriodFull, neededLines: number) {
  const lineHeight = 9;
  if (doc.y + neededLines * lineHeight > PAGE_BOTTOM_THRESHOLD) {
    doc.addPage();
    renderHeader(doc, period);
  }
}

function renderCollaboratorBlock(doc: any, entry: PayrollEntryFull, period: PeriodFull) {
  const maxRows = Math.max(entry.rubrics.earnings.length, entry.rubrics.discounts.length);
  // Reserva espaço aproximado: 5 linhas (cabeçalho colaborador + totais) + rubricas
  ensureSpace(doc, period, 6 + maxRows);

  doc.font("Courier-Bold").fontSize(8)
    .text(`Empr.: ${pad(entry.employee.employeeCode, 6)} ${pad(entry.employee.fullName, 50)}`, 40, doc.y);
  doc.font("Courier").fontSize(7)
    .text(`Situação: ${pad(entry.situation || "Trabalhando", 14)} CPF: ${fmtCPF(entry.employee.cpf)}  Adm: ${fmtDate(entry.employee.admissionDate)}`, 40);
  doc.text(`Cargo: ${pad(entry.employee.position?.name || "", 28)} CBO: ${pad(entry.employee.cboCode || "", 8)} CC: ${pad(entry.costCenter?.codigo || "", 6)} Salário Base: ${padR(fmtBRL(Number(entry.salaryBase)), 12)}`, 40);
  doc.moveDown(0.2);

  // Cabeçalho das colunas
  doc.font("Courier-Bold").fontSize(7).text(
    `${pad("Cód", 6)}${pad("Descrição (Provento)", 30)}${padR("Ref", 8)}${padR("Valor", 12)}  ` +
    `${pad("Cód", 6)}${pad("Descrição (Desconto)", 30)}${padR("Ref", 8)}${padR("Valor", 12)}`,
    40,
  );
  doc.font("Courier").fontSize(7);

  for (let i = 0; i < maxRows; i++) {
    const e = entry.rubrics.earnings[i];
    const d = entry.rubrics.discounts[i];
    const left = e
      ? `${pad(e.code, 6)}${pad(e.description, 30)}${padR(e.reference, 8)}${padR(fmtBRL(e.value), 12)}`
      : pad("", 56);
    const right = d
      ? `${pad(d.code, 6)}${pad(d.description, 30)}${padR(d.reference, 8)}${padR(fmtBRL(d.value), 12)}`
      : "";
    doc.text(`${left}  ${right}`, 40);
  }

  doc.moveDown(0.2);
  doc.font("Courier-Bold").fontSize(7);
  doc.text(`Proventos: ${padR(fmtBRL(Number(entry.totalGross)), 12)}  Descontos: ${padR(fmtBRL(Number(entry.totalDiscounts)), 12)}  Líquido: ${padR(fmtBRL(Number(entry.netSalary)), 12)}`, 40);
  doc.text(`Base INSS: ${padR(fmtBRL(Number(entry.inssBase)), 12)}  INSS: ${padR(fmtBRL(Number(entry.inssValue)), 10)}  FGTS: ${padR(fmtBRL(Number(entry.fgtsValue)), 10)}  Base IRRF: ${padR(fmtBRL(Number(entry.irrfBase)), 12)}`, 40);
  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.3);
}

function aggregateRubrics(period: PeriodFull) {
  const map = new Map<string, { code: string; description: string; type: "P" | "D" | "I"; refSum: number; valueSum: number }>();
  for (const e of period.entries) {
    const groups: Array<{ list: RubricLine[]; type: "P" | "D" | "I" }> = [
      { list: e.rubrics.earnings, type: "P" },
      { list: e.rubrics.discounts, type: "D" },
      { list: e.rubrics.informatives, type: "I" },
    ];
    for (const g of groups) {
      for (const r of g.list) {
        const k = `${g.type}:${r.code}`;
        const cur = map.get(k);
        const refNum = parseFloat(String(r.reference || "0").replace(",", ".")) || 0;
        if (cur) { cur.refSum += refNum; cur.valueSum += r.value; }
        else map.set(k, { code: r.code, description: r.description, type: g.type, refSum: refNum, valueSum: r.value });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
}

function renderSummaryPage(doc: any, period: PeriodFull) {
  doc.font("Courier-Bold").fontSize(11).text("RESUMO POR RUBRICA", 40, doc.y, { align: "center" });
  doc.moveDown(0.5);

  // Cabeçalho da tabela
  doc.font("Courier-Bold").fontSize(8).text(
    `${pad("Cód", 6)}${pad("Descrição", 36)}${padR("Ref. Total", 12)}${padR("Valor Total", 14)}  Tipo`,
    40,
  );
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.font("Courier").fontSize(7);
  for (const r of aggregateRubrics(period)) {
    ensureSpace(doc, period, 1);
    doc.text(
      `${pad(r.code, 6)}${pad(r.description, 36)}${padR(r.refSum.toFixed(2), 12)}${padR(fmtBRL(r.valueSum), 14)}  ${r.type}`,
      40,
    );
  }

  // Totais consolidados
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.font("Courier-Bold").fontSize(8);
  doc.text(`Total de Vencimentos: ${padR(fmtBRL(period.totalGross), 14)}`, 40);
  doc.text(`Total de Descontos:   ${padR(fmtBRL(period.totalDiscounts), 14)}`, 40);
  doc.text(`Líquido Geral:        ${padR(fmtBRL(period.totalNet), 14)}`, 40);
  doc.moveDown(0.3);
  doc.font("Courier").fontSize(7);
  doc.text(`Total INSS Empregados: ${padR(fmtBRL(period.totalInssEmployee), 14)}`, 40);
  doc.text(`Total FGTS:            ${padR(fmtBRL(period.totalFgts), 14)}`, 40);
  doc.text(`Total IRRF Retido:     ${padR(fmtBRL(period.totalIrrf), 14)}`, 40);

  // Situações
  const sit = new Map<string, number>();
  for (const e of period.entries) sit.set(e.situation || "Trabalhando", (sit.get(e.situation || "Trabalhando") ?? 0) + 1);
  doc.moveDown(0.5);
  doc.font("Courier-Bold").fontSize(8).text(`Situações (${period.entries.length} colaboradores):`, 40);
  doc.font("Courier").fontSize(7);
  Array.from(sit.entries()).forEach(([k, v]) => {
    doc.text(`  • ${pad(k, 30)} ${padR(String(v), 4)}`, 40);
  });
}

export async function generateExtratoPdf(period: PeriodFull): Promise<Buffer> {
  const doc: any = new PDFDocument({ size: "A4", margins: { top: 40, bottom: 40, left: 40, right: 40 } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const ended: Promise<Buffer> = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  renderHeader(doc, period);
  for (const entry of period.entries) renderCollaboratorBlock(doc, entry, period);

  doc.addPage();
  renderHeader(doc, period);
  renderSummaryPage(doc, period);

  doc.end();
  return ended;
}
