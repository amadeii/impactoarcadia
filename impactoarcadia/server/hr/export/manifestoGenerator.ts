// Sprint RH-4 — JSON de auditoria com hashes SHA-256 dos artefatos.

import { createHash } from "crypto";
import type { PeriodFull } from "./dominioExporter";

export interface ManifestoParams {
  period: PeriodFull;
  extratoPdf: Buffer;
  recibosPdf: Buffer;
  extratoTxt: Buffer;
  exportedAt: Date;
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function generateManifesto(params: ManifestoParams) {
  const { period, extratoPdf, recibosPdf, extratoTxt, exportedAt } = params;
  return {
    version: "1.0",
    source: "arcadia_consult",
    exportedAt: exportedAt.toISOString(),
    period: {
      id: period.id,
      competence: period.competence,
      status: period.status,
      company: { name: period.company.name, cnpj: period.company.cnpj },
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
    files: {
      extratoPdf: { size: extratoPdf.length, sha256: sha256(extratoPdf) },
      recibosPdf: { size: recibosPdf.length, sha256: sha256(recibosPdf) },
      extratoTxt: { size: extratoTxt.length, sha256: sha256(extratoTxt) },
    },
    controlTransactions: period.controlTxIds,
  };
}
