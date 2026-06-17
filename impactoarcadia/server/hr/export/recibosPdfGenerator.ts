// Sprint RH-4 — PDF dos Recibos individuais (1 colaborador por página, 2 vias).

import PDFDocument from "pdfkit";
import type { PeriodFull, PayrollEntryFull, RubricLine } from "./dominioExporter";

function fmtBRL(v: number): string {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function renderRecibo(doc: any, entry: PayrollEntryFull, period: PeriodFull, via: "original" | "cópia", startY: number) {
  doc.font("Courier-Bold").fontSize(9)
    .text(period.company.name.toUpperCase(), 40, startY, { width: 515, align: "center" });
  doc.font("Courier").fontSize(7).text(
    `CNPJ: ${period.company.cnpj || "—"}   CC: ${entry.costCenter?.codigo || ""}   Folha Mensal — ${fmtCompetence(period.competence)}   (${via})`,
    40, doc.y, { width: 515, align: "center" },
  );
  doc.moveDown(0.3);
  doc.text(`Código: ${pad(entry.employee.employeeCode, 6)}  Nome: ${entry.employee.fullName}`, 40);
  doc.text(`CBO: ${pad(entry.employee.cboCode || "", 8)}  Cargo: ${pad(entry.employee.position?.name || "", 24)}  Admissão: ${fmtDate(entry.employee.admissionDate)}  Salário Base: ${fmtBRL(Number(entry.salaryBase))}`, 40);
  doc.text(`CPF: ${fmtCPF(entry.employee.cpf)}   Tipo: Mensalista   Horas Mês: ${entry.employee.monthlyHours ?? 220}`, 40);
  doc.moveDown(0.2);

  // Cabeçalho da tabela de rubricas
  doc.font("Courier-Bold").fontSize(7).text(
    `${pad("Cód", 6)}${pad("Descrição", 32)}${padR("Ref", 8)}${padR("Vencimentos", 14)}${padR("Descontos", 14)}`,
    40,
  );
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();

  doc.font("Courier").fontSize(7);
  const all: Array<RubricLine & { col: "earning" | "discount" }> = [
    ...entry.rubrics.earnings.map(r => ({ ...r, col: "earning" as const })),
    ...entry.rubrics.discounts.map(r => ({ ...r, col: "discount" as const })),
  ];
  for (const r of all) {
    const venc = r.col === "earning" ? padR(fmtBRL(r.value), 14) : pad("", 14);
    const desc = r.col === "discount" ? padR(fmtBRL(r.value), 14) : pad("", 14);
    doc.text(`${pad(r.code, 6)}${pad(r.description, 32)}${padR(r.reference, 8)}${venc}${desc}`, 40);
  }

  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.font("Courier-Bold").fontSize(7).text(
    `Total Vencimentos: ${padR(fmtBRL(Number(entry.totalGross)), 12)}   Total Descontos: ${padR(fmtBRL(Number(entry.totalDiscounts)), 12)}   Valor Líquido: ${padR(fmtBRL(Number(entry.netSalary)), 12)}`,
    40,
  );
  doc.text(
    `Sal. Contr. INSS: ${padR(fmtBRL(Number(entry.inssBase)), 12)}   FGTS: ${padR(fmtBRL(Number(entry.fgtsValue)), 10)}   Base IRRF: ${padR(fmtBRL(Number(entry.irrfBase)), 12)}`,
    40,
  );
  doc.moveDown(0.3);
  doc.font("Courier").fontSize(7).text("Declaro ter recebido a importância líquida discriminada neste recibo.", 40);
  doc.text("_____/_____/_________   __________________________________", 40);
  doc.text(`Data                    Assinatura do Funcionário  (${via})`, 40);
}

export async function generateRecibosPdf(period: PeriodFull): Promise<Buffer> {
  const doc: any = new PDFDocument({ size: "A4", margins: { top: 30, bottom: 30, left: 40, right: 40 } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const ended: Promise<Buffer> = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  for (let i = 0; i < period.entries.length; i++) {
    if (i > 0) doc.addPage();
    const entry = period.entries[i];

    // Via 1 (original)
    renderRecibo(doc, entry, period, "original", 30);

    // Linha tracejada divisória
    const midY = doc.page.height / 2;
    doc.dash(3, { space: 3 }).moveTo(40, midY).lineTo(555, midY).stroke();
    doc.undash();

    // Via 2 (cópia)
    renderRecibo(doc, entry, period, "cópia", midY + 10);
  }

  doc.end();
  return ended;
}
