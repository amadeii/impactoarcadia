// server/hr/payrollRoutes.ts
// ──────────────────────────────────────────────────────────────────────────
// Sprint RH-2 — Endpoints REST de folha de pagamento + folha de ponto.
// 14 endpoints, todos sob /api/hr. Auth via [isAuthenticated, tenantContext, requireTenant].
// Validação de cliente×tenant em toda entrada externa via assertClienteOfTenant.

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { z } from "zod";
import {
  insertHrPayrollPeriodSchema, insertHrPayrollEntrySchema, insertHrTimesheetPeriodSchema,
} from "@shared/schema";
import * as svc from "./payrollService";
import { assertClienteOfTenant } from "./employeesService";

const auth = [isAuthenticated, tenantContext, requireTenant];

async function assertCliente(req: any, res: any, source: "query" | "body" = "query"): Promise<string | null> {
  const c = (source === "query" ? req.query.clienteId : req.body?.clienteId) as string | undefined;
  if (!c) { res.status(400).json({ message: "clienteId é obrigatório" }); return null; }
  try { await assertClienteOfTenant(req.tenantId, c); }
  catch (e: any) { res.status(e.status ?? 500).json({ message: e.message }); return null; }
  return c;
}

// Garante que o período pertence ao tenant antes de operações que recebem só periodId.
async function loadPeriodOr404(req: any, res: any, periodId: string) {
  const p = await svc.getPeriod(req.tenantId, periodId);
  if (!p) { res.status(404).json({ message: "Período não encontrado" }); return null; }
  return p;
}

const createPeriodSchema = z.object({
  clienteId: z.string().uuid(),
  competence: z.string().regex(/^\d{4}-\d{2}$/, "competence deve ser YYYY-MM"),
});

// `tenantId` e `periodId` são adicionados pelo handler.
const entryInputSchema = insertHrPayrollEntrySchema.omit({ tenantId: true, periodId: true });

const handle = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
  try { await fn(req, res); }
  catch (e: any) { res.status(e.status ?? 500).json({ message: e.message ?? "Erro interno" }); }
};

export function registerHrPayrollRoutes(app: Express) {
  // ─── Períodos ──────────────────────────────────────────────────────────
  app.get("/api/hr/payroll", ...auth, handle(async (req, res) => {
    const clienteId = await assertCliente(req, res, "query"); if (!clienteId) return;
    const rows = await svc.listPeriods(req.tenantId, clienteId, {
      status: req.query.status as string | undefined,
      competence: req.query.competence as string | undefined,
    });
    res.json(rows);
  }));

  app.post("/api/hr/payroll", ...auth, handle(async (req, res) => {
    const parsed = createPeriodSchema.parse(req.body);
    await assertClienteOfTenant(req.tenantId, parsed.clienteId);
    const row = await svc.createPeriod(req.tenantId, parsed.clienteId, parsed.competence);
    res.status(201).json(row);
  }));

  app.get("/api/hr/payroll/:id", ...auth, handle(async (req, res) => {
    const p = await loadPeriodOr404(req, res, req.params.id); if (!p) return;
    res.json(p);
  }));

  app.get("/api/hr/payroll/:id/summary", ...auth, handle(async (req, res) => {
    const s = await svc.getSummary(req.tenantId, req.params.id);
    if (!s) return res.status(404).json({ message: "Período não encontrado" });
    res.json(s);
  }));

  // ─── Entries ──────────────────────────────────────────────────────────
  app.post("/api/hr/payroll/:id/entries", ...auth, handle(async (req, res) => {
    const periodId = req.params.id;
    const p = await loadPeriodOr404(req, res, periodId); if (!p) return;
    const parsed = entryInputSchema.parse(req.body);
    const row = await svc.addEntry(req.tenantId, periodId, parsed as any);
    res.status(201).json(row);
  }));

  app.put("/api/hr/payroll/:id/entries/:entryId", ...auth, handle(async (req, res) => {
    const periodId = req.params.id;
    const p = await loadPeriodOr404(req, res, periodId); if (!p) return;
    const parsed = entryInputSchema.partial().parse(req.body);
    const row = await svc.updateEntry(req.tenantId, periodId, req.params.entryId, parsed as any);
    res.json(row);
  }));

  app.delete("/api/hr/payroll/:id/entries/:entryId", ...auth, handle(async (req, res) => {
    const periodId = req.params.id;
    const p = await loadPeriodOr404(req, res, periodId); if (!p) return;
    await svc.deleteEntry(req.tenantId, periodId, req.params.entryId);
    res.status(204).end();
  }));

  // ─── Status transitions ───────────────────────────────────────────────
  app.post("/api/hr/payroll/:id/review", ...auth, handle(async (req, res) => {
    res.json(await svc.reviewPeriod(req.tenantId, req.params.id));
  }));

  app.post("/api/hr/payroll/:id/approve", ...auth, handle(async (req, res) => {
    const userId = (req.user as any)?.claims?.sub ?? (req.user as any)?.id ?? null;
    res.json(await svc.approvePeriod(req.tenantId, req.params.id, userId));
  }));

  app.post("/api/hr/payroll/:id/revert", ...auth, handle(async (req, res) => {
    res.json(await svc.revertApproval(req.tenantId, req.params.id));
  }));

  // ─── Timesheet ────────────────────────────────────────────────────────
  app.get("/api/hr/timesheet", ...auth, handle(async (req, res) => {
    const clienteId = await assertCliente(req, res, "query"); if (!clienteId) return;
    const rows = await svc.listTimesheets(req.tenantId, clienteId, {
      employeeId: req.query.employeeId as string | undefined,
    });
    res.json(rows);
  }));

  app.post("/api/hr/timesheet", ...auth, handle(async (req, res) => {
    const parsed = insertHrTimesheetPeriodSchema.omit({ tenantId: true }).parse(req.body);
    await assertClienteOfTenant(req.tenantId, parsed.clienteId);
    const row = await svc.createTimesheet(req.tenantId, parsed);
    res.status(201).json(row);
  }));

  app.put("/api/hr/timesheet/:id", ...auth, handle(async (req, res) => {
    const patch = insertHrTimesheetPeriodSchema.partial().omit({ tenantId: true }).parse(req.body);
    res.json(await svc.updateTimesheet(req.tenantId, req.params.id, patch));
  }));

  app.get("/api/hr/timesheet/:id/entries", ...auth, handle(async (req, res) => {
    const ts = await svc.getTimesheet(req.tenantId, req.params.id);
    if (!ts) return res.status(404).json({ message: "Folha de ponto não encontrada" });
    res.json(ts.entries ?? []);
  }));
}
