// Sprint RH-4 — endpoints REST do exportador Domínio.
// Auth = [isAuthenticated, tenantContext, requireTenant]. Validação de
// tenant via assertPeriodOfTenant (período → cliente → tenant).

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { hrPayrollPeriods } from "@shared/schema";
import { exportPeriodo, generateOnly, buildPreviewManifesto } from "./export/dominioExporter";

const auth = [isAuthenticated, tenantContext, requireTenant];

async function assertPeriodOfTenant(tenantId: string, periodId: string): Promise<void> {
  const [p] = await db.select({ id: hrPayrollPeriods.id }).from(hrPayrollPeriods)
    .where(and(eq(hrPayrollPeriods.id, periodId), eq(hrPayrollPeriods.tenantId, tenantId)))
    .limit(1);
  if (!p) {
    const e: any = new Error("Período não encontrado neste tenant");
    e.status = 404; throw e;
  }
}

const handle = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
  try { await fn(req, res); }
  catch (e: any) {
    console.error("[hr:export] erro:", e?.message || e);
    res.status(e?.status ?? 500).json({ message: e?.message ?? "Erro interno" });
  }
};

export function registerHrExportRoutes(app: Express) {
  // Preview (manifesto seco) antes de gerar o ZIP.
  app.get("/api/hr/export/:periodId/preview", ...auth, handle(async (req, res) => {
    await assertPeriodOfTenant(req.tenantId, req.params.periodId);
    const data = await buildPreviewManifesto(req.tenantId, req.params.periodId);
    res.json(data);
  }));

  // ZIP completo — gera os 4 arquivos e envia como download.
  app.post("/api/hr/export/:periodId", ...auth, handle(async (req, res) => {
    await assertPeriodOfTenant(req.tenantId, req.params.periodId);
    const result = await exportPeriodo(req.tenantId, req.params.periodId);
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.zipName}"`,
      "Content-Length": String(result.zipBuffer.length),
      "X-Export-Files": String(result.filesCount),
    });
    res.send(result.zipBuffer);
  }));

  // Downloads parciais — para visualização inline no frontend.
  const single = (kind: "extratoPdf" | "recibosPdf" | "extratoTxt") =>
    handle(async (req: any, res: any) => {
      await assertPeriodOfTenant(req.tenantId, req.params.periodId);
      const out = await generateOnly(req.tenantId, req.params.periodId, kind);
      res.set({
        "Content-Type": out.contentType,
        "Content-Disposition": `inline; filename="${out.filename}"`,
        "Content-Length": String(out.buffer.length),
      });
      res.send(out.buffer);
    });
  app.get("/api/hr/export/:periodId/extrato-pdf", ...auth, single("extratoPdf"));
  app.get("/api/hr/export/:periodId/recibos-pdf", ...auth, single("recibosPdf"));
  app.get("/api/hr/export/:periodId/extrato-txt", ...auth, single("extratoTxt"));
}
