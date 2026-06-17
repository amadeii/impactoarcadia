// RH-1 — Endpoints REST do módulo RH/DP.
// Tudo escopado por tenantId via middleware tenantContext + requireTenant.

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import {
  insertHrDepartmentSchema, insertHrPositionSchema, insertHrEmployeeSchema,
  insertHrEmployeeAccountEntrySchema,
} from "@shared/schema";
import { z } from "zod";
import * as hr from "./employeesService";

const auth = [isAuthenticated, tenantContext, requireTenant];

const requireClienteQuery = (req: any, res: any): string | null => {
  const c = req.query.clienteId as string | undefined;
  if (!c) { res.status(400).json({ message: "clienteId é obrigatório" }); return null; }
  return c;
};

/**
 * Resolve clienteId do query (GET) ou body (POST) e valida que pertence ao
 * tenant antes de qualquer operação. Retorna null e responde com erro se
 * inválido — o handler deve apenas dar return.
 */
async function resolveAndAssertCliente(
  req: any, res: any, source: "query" | "body" = "query",
): Promise<string | null> {
  const c = (source === "query" ? req.query.clienteId : req.body?.clienteId) as string | undefined;
  if (!c) { res.status(400).json({ message: "clienteId é obrigatório" }); return null; }
  try { await hr.assertClienteOfTenant(req.tenantId, c); }
  catch (e: any) { res.status(e.status ?? 500).json({ message: e.message }); return null; }
  return c;
}

const updateSalarySchema = z.object({
  salary: z.string().regex(/^\d+(\.\d{1,2})?$/, "salário inválido"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida (YYYY-MM-DD)"),
  reason: z.enum(["admissao", "reajuste", "promocao", "acordo", "outro"]).default("reajuste"),
  notes: z.string().max(300).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["active", "vacation", "leave", "terminated"]),
  terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function registerHrRoutes(app: Express) {
  // ─── Departamentos ────────────────────────────────────────────────────────
  app.get("/api/hr/departments", ...auth, async (req: any, res) => {
    try {
      const clienteId = await resolveAndAssertCliente(req, res, "query"); if (!clienteId) return;
      res.json(await hr.listDepartments(req.tenantId, clienteId));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/hr/departments", ...auth, async (req: any, res) => {
    try {
      const parsed = insertHrDepartmentSchema.omit({ tenantId: true } as any).parse(req.body) as any;
      await hr.assertClienteOfTenant(req.tenantId, parsed.clienteId);
      const row = await hr.createDepartment(req.tenantId, { ...parsed, tenantId: req.tenantId });
      res.status(201).json(row);
    } catch (e: any) { res.status(e.status ?? 400).json({ message: e.message }); }
  });

  app.patch("/api/hr/departments/:id", ...auth, async (req: any, res) => {
    try {
      const patch = insertHrDepartmentSchema.partial().omit({ tenantId: true } as any).parse(req.body);
      const row = await hr.updateDepartment(req.tenantId, req.params.id, patch);
      if (!row) return res.status(404).json({ message: "Departamento não encontrado" });
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/hr/departments/:id", ...auth, async (req: any, res) => {
    try { await hr.deleteDepartment(req.tenantId, req.params.id); res.status(204).send(); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Cargos ───────────────────────────────────────────────────────────────
  app.get("/api/hr/positions", ...auth, async (req: any, res) => {
    try {
      const clienteId = await resolveAndAssertCliente(req, res, "query"); if (!clienteId) return;
      res.json(await hr.listPositions(req.tenantId, clienteId));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/hr/positions", ...auth, async (req: any, res) => {
    try {
      const parsed = insertHrPositionSchema.omit({ tenantId: true } as any).parse(req.body) as any;
      await hr.assertClienteOfTenant(req.tenantId, parsed.clienteId);
      const row = await hr.createPosition(req.tenantId, { ...parsed, tenantId: req.tenantId });
      res.status(201).json(row);
    } catch (e: any) { res.status(e.status ?? 400).json({ message: e.message }); }
  });

  app.patch("/api/hr/positions/:id", ...auth, async (req: any, res) => {
    try {
      const patch = insertHrPositionSchema.partial().omit({ tenantId: true } as any).parse(req.body);
      const row = await hr.updatePosition(req.tenantId, req.params.id, patch);
      if (!row) return res.status(404).json({ message: "Cargo não encontrado" });
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/hr/positions/:id", ...auth, async (req: any, res) => {
    try { await hr.deletePosition(req.tenantId, req.params.id); res.status(204).send(); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Colaboradores ────────────────────────────────────────────────────────
  app.get("/api/hr/employees", ...auth, async (req: any, res) => {
    try {
      const clienteId = await resolveAndAssertCliente(req, res, "query"); if (!clienteId) return;
      res.json(await hr.listEmployees(req.tenantId, {
        clienteId,
        status: req.query.status as string | undefined,
        departmentId: req.query.departmentId as string | undefined,
        positionId: req.query.positionId as string | undefined,
        search: req.query.search as string | undefined,
      }));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/hr/employees/counts", ...auth, async (req: any, res) => {
    try {
      const clienteId = await resolveAndAssertCliente(req, res, "query"); if (!clienteId) return;
      res.json(await hr.getEmployeeCounts(req.tenantId, clienteId));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/hr/employees/:id", ...auth, async (req: any, res) => {
    try {
      const row = await hr.getEmployeeWithHistory(req.tenantId, req.params.id);
      if (!row) return res.status(404).json({ message: "Colaborador não encontrado" });
      res.json(row);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/hr/employees", ...auth, async (req: any, res) => {
    try {
      const parsed = insertHrEmployeeSchema.omit({ tenantId: true } as any).parse(req.body) as any;
      await hr.assertClienteOfTenant(req.tenantId, parsed.clienteId);
      const row = await hr.createEmployee(
        req.tenantId,
        { ...parsed, tenantId: req.tenantId },
        req.user?.claims?.sub ?? null,
      );
      res.status(201).json(row);
    } catch (e: any) { res.status(e.status ?? 400).json({ message: e.message }); }
  });

  app.patch("/api/hr/employees/:id", ...auth, async (req: any, res) => {
    try {
      const patch = insertHrEmployeeSchema.partial().omit({ tenantId: true } as any).parse(req.body);
      const row = await hr.updateEmployee(req.tenantId, req.params.id, patch);
      if (!row) return res.status(404).json({ message: "Colaborador não encontrado" });
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.put("/api/hr/employees/:id/salary", ...auth, async (req: any, res) => {
    try {
      const data = updateSalarySchema.parse(req.body);
      const result = await hr.updateSalary(
        req.tenantId, req.params.id, data, req.user?.claims?.sub ?? null,
      );
      res.json(result);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.put("/api/hr/employees/:id/status", ...auth, async (req: any, res) => {
    try {
      const data = updateStatusSchema.parse(req.body);
      const row = await hr.updateStatus(req.tenantId, req.params.id, data.status, data.terminationDate);
      if (!row) return res.status(404).json({ message: "Colaborador não encontrado" });
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/hr/employees/:id/salary-history", ...auth, async (req: any, res) => {
    try {
      res.json(await hr.listSalaryHistory(req.tenantId, req.params.id));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/hr/employees/:id", ...auth, async (req: any, res) => {
    try {
      const emp = await hr.getEmployee(req.tenantId, req.params.id);
      if (!emp) return res.status(404).json({ message: "Colaborador não encontrado" });
      await hr.assertClienteOfTenant(req.tenantId, emp.clienteId);
      const result = await hr.deleteEmployee(req.tenantId, req.params.id);
      res.json(result);
    } catch (e: any) { res.status(e.status ?? 500).json({ message: e.message }); }
  });

  // ─── Conta Corrente do Colaborador ────────────────────────────────────────
  app.get("/api/hr/employees/:id/account-entries", ...auth, async (req: any, res) => {
    try {
      const emp = await hr.getEmployee(req.tenantId, req.params.id);
      if (!emp) return res.status(404).json({ message: "Colaborador não encontrado" });
      await hr.assertClienteOfTenant(req.tenantId, emp.clienteId);
      res.json(await hr.listAccountEntries(req.tenantId, req.params.id, {
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        category: req.query.category as string | undefined,
        status: req.query.status as string | undefined,
      }));
    } catch (e: any) { res.status(e.status ?? 500).json({ message: e.message }); }
  });

  app.get("/api/hr/employees/:id/account-summary", ...auth, async (req: any, res) => {
    try {
      const emp = await hr.getEmployee(req.tenantId, req.params.id);
      if (!emp) return res.status(404).json({ message: "Colaborador não encontrado" });
      await hr.assertClienteOfTenant(req.tenantId, emp.clienteId);
      res.json(await hr.getAccountSummary(req.tenantId, req.params.id));
    } catch (e: any) { res.status(e.status ?? 500).json({ message: e.message }); }
  });

  app.post("/api/hr/employees/:id/account-entries", ...auth, async (req: any, res) => {
    try {
      const emp = await hr.getEmployee(req.tenantId, req.params.id);
      if (!emp) return res.status(404).json({ message: "Colaborador não encontrado" });
      await hr.assertClienteOfTenant(req.tenantId, emp.clienteId);
      const parsed = insertHrEmployeeAccountEntrySchema
        .omit({ tenantId: true, employeeId: true } as any)
        .parse(req.body);
      const row = await hr.createAccountEntry(
        req.tenantId, req.params.id, parsed as any,
        req.user?.claims?.sub ?? null,
      );
      res.status(201).json(row);
    } catch (e: any) { res.status(e.status ?? 400).json({ message: e.message }); }
  });

  app.patch("/api/hr/employees/:id/account-entries/:entryId", ...auth, async (req: any, res) => {
    try {
      const emp = await hr.getEmployee(req.tenantId, req.params.id);
      if (!emp) return res.status(404).json({ message: "Colaborador não encontrado" });
      await hr.assertClienteOfTenant(req.tenantId, emp.clienteId);
      const patch = insertHrEmployeeAccountEntrySchema.partial()
        .omit({ tenantId: true, employeeId: true } as any).parse(req.body);
      const row = await hr.updateAccountEntry(req.tenantId, req.params.id, req.params.entryId, patch);
      if (!row) return res.status(404).json({ message: "Lançamento não encontrado" });
      res.json(row);
    } catch (e: any) { res.status(e.status ?? 400).json({ message: e.message }); }
  });

  app.delete("/api/hr/employees/:id/account-entries/:entryId", ...auth, async (req: any, res) => {
    try {
      const emp = await hr.getEmployee(req.tenantId, req.params.id);
      if (!emp) return res.status(404).json({ message: "Colaborador não encontrado" });
      await hr.assertClienteOfTenant(req.tenantId, emp.clienteId);
      res.json(await hr.deleteAccountEntry(req.tenantId, req.params.id, req.params.entryId));
    } catch (e: any) { res.status(e.status ?? 500).json({ message: e.message }); }
  });
}
