// Sprint RH-4 — TXT colunar posicional reimportável no Domínio.
// Cada linha tem campos de largura fixa. Encoding latin1 (padrão Domínio).
// Tipos de linha: L (lote), H (header colaborador), D (detalhe rubrica), T (totalizador).

import type { PeriodFull } from "./dominioExporter";

function pad(s: string, n: number): string {
  s = String(s ?? "");
  return s.length > n ? s.slice(0, n) : s.padEnd(n, " ");
}
function padN(s: string, n: number): string {
  s = String(s ?? "");
  return s.length > n ? s.slice(-n) : s.padStart(n, "0");
}
function padNRef(s: string, n: number): string {
  s = String(s ?? "");
  return s.length > n ? s.slice(-n) : s.padStart(n, " ");
}
function clean(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function fmtBRLFixed(value: any, width: number): string {
  const n = typeof value === "string" ? parseFloat(value) : Number(value ?? 0);
  return Math.round((Number.isNaN(n) ? 0 : n) * 100).toString().padStart(width, "0");
}
function fmtDDMMAAAA(d: any): string {
  if (!d) return "01010001";
  const s = String(d).slice(0, 10);
  const [y, m, dd] = s.split("-");
  return y && m && dd ? `${dd}${m}${y}` : "01010001";
}

export function generateExtratoTxt(period: PeriodFull): Buffer {
  const lines: string[] = [];
  const yyyy = period.competence.slice(0, 4);
  const mm = period.competence.slice(5, 7);
  const mmaaaa = `${mm}${yyyy}`;
  const cnpjClean = (period.company.cnpj || "").replace(/\D/g, "").padStart(14, "0").slice(0, 14);
  const emittedAt = new Date();
  const ddmmaaaa = `${String(emittedAt.getDate()).padStart(2, "0")}${String(emittedAt.getMonth() + 1).padStart(2, "0")}${emittedAt.getFullYear()}`;

  // L = cabeçalho do lote
  lines.push(
    "L" +
    cnpjClean +
    mmaaaa +
    ddmmaaaa +
    padN(String(period.entries.length), 5) +
    pad(clean(period.company.name).toUpperCase(), 60),
  );

  for (const entry of period.entries) {
    const cpf = (entry.employee.cpf || "").replace(/\D/g, "").padStart(11, "0").slice(0, 11);
    const empCode = padN(String(entry.employee.employeeCode || "0"), 4);

    // H = header do colaborador
    lines.push(
      "H" +
      empCode +
      cpf +
      mmaaaa +
      pad(clean(entry.situation || "Trabalhando"), 20) +
      pad(clean(entry.employee.fullName), 40) +
      pad(clean(entry.employee.position?.name || ""), 30) +
      fmtDDMMAAAA(entry.employee.admissionDate) +
      fmtBRLFixed(entry.salaryBase, 12) +
      padN(String(entry.employee.monthlyHours ?? 220), 4),
    );

    // D = detalhe de rubrica
    const all = [
      ...entry.rubrics.earnings.map(r => ({ ...r, tipo: "P" })),
      ...entry.rubrics.discounts.map(r => ({ ...r, tipo: "D" })),
      ...entry.rubrics.informatives.map(r => ({ ...r, tipo: "I" })),
    ];
    for (const r of all) {
      lines.push(
        "D" +
        empCode +
        cpf +
        mmaaaa +
        padN(r.code || "0", 6) +
        padNRef(r.reference || "", 8) +
        fmtBRLFixed(r.value, 12) +
        r.tipo,
      );
    }
  }

  // T = totalizador
  lines.push(
    "T" +
    padN(String(period.entries.length), 5) +
    fmtBRLFixed(period.totalGross, 14) +
    fmtBRLFixed(period.totalDiscounts, 14) +
    fmtBRLFixed(period.totalNet, 14) +
    fmtBRLFixed(period.totalInssEmployee, 14) +
    fmtBRLFixed(period.totalFgts, 14),
  );

  return Buffer.from(lines.join("\r\n") + "\r\n", "latin1");
}
