// Sprint RH-5 — endpoints REST do Relatório Gerencial BPO.
// Auth = [isAuthenticated, tenantContext, requireTenant]. clienteId é
// validado contra o tenant antes de qualquer agregação.

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { clients } from "@shared/schema";
import {
  buildDashboard,
  costByCompany,
  costByPosition,
  costByCostCenter,
  evolution12m,
  dreWeight,
  forecastNextMonth,
  alerts,
} from "./reportService";

const auth = [isAuthenticated, tenantContext, requireTenant];

async function assertClientOfTenant(tenantId: string, clienteId: string): Promise<void> {
  const [c] = await db.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.id, clienteId), eq(clients.tenantId, tenantId)))
    .limit(1);
  if (!c) {
    const e: any = new Error("Cliente não encontrado neste tenant");
    e.status = 404; throw e;
  }
}

const handle = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
  try { await fn(req, res); }
  catch (e: any) {
    console.error("[hr:reports] erro:", e?.message || e);
    res.status(e?.status ?? 500).json({ message: e?.message ?? "Erro interno" });
  }
};

const competenceRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
function parseCompetence(v: any, fallback: string): string {
  return typeof v === "string" && competenceRegex.test(v) ? v : fallback;
}
function todayComp() {
  const dt = new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export function registerHrReportRoutes(app: Express) {
  // Dashboard consolidado: se clienteId vier, traz todos os blocos do cliente;
  // sem clienteId, retorna comparativo entre empresas do tenant.
  app.get("/api/hr/reports/dashboard", ...auth, handle(async (req, res) => {
    const competence = parseCompetence(req.query.competence, todayComp());
    const clienteId = typeof req.query.clienteId === "string" && req.query.clienteId ? req.query.clienteId : null;
    if (clienteId) await assertClientOfTenant(req.tenantId, clienteId);
    const data = await buildDashboard(req.tenantId, clienteId, competence);
    res.json(data);
  }));

  // Comparativo entre empresas do tenant (uma competência).
  app.get("/api/hr/reports/companies", ...auth, handle(async (req, res) => {
    const competence = parseCompetence(req.query.competence, todayComp());
    const data = await costByCompany(req.tenantId, competence);
    res.json({ competence, items: data });
  }));

  // Custo por cargo (de um cliente em uma competência).
  app.get("/api/hr/reports/positions", ...auth, handle(async (req, res) => {
    const competence = parseCompetence(req.query.competence, todayComp());
    const clienteId = String(req.query.clienteId || "");
    if (!clienteId) { const e: any = new Error("clienteId obrigatório"); e.status = 400; throw e; }
    await assertClientOfTenant(req.tenantId, clienteId);
    const data = await costByPosition(req.tenantId, clienteId, competence);
    res.json({ competence, clienteId, items: data });
  }));

  // Custo por centro de custo.
  app.get("/api/hr/reports/cost-centers", ...auth, handle(async (req, res) => {
    const competence = parseCompetence(req.query.competence, todayComp());
    const clienteId = String(req.query.clienteId || "");
    if (!clienteId) { const e: any = new Error("clienteId obrigatório"); e.status = 400; throw e; }
    await assertClientOfTenant(req.tenantId, clienteId);
    const data = await costByCostCenter(req.tenantId, clienteId, competence);
    res.json({ competence, clienteId, items: data });
  }));

  // Evolução 12 meses (clienteId opcional).
  app.get("/api/hr/reports/evolution", ...auth, handle(async (req, res) => {
    const competence = parseCompetence(req.query.competence, todayComp());
    const clienteId = typeof req.query.clienteId === "string" && req.query.clienteId ? req.query.clienteId : null;
    if (clienteId) await assertClientOfTenant(req.tenantId, clienteId);
    const data = await evolution12m(req.tenantId, clienteId, competence);
    res.json({ competence, clienteId, items: data });
  }));

  // Peso no DRE.
  app.get("/api/hr/reports/dre-weight", ...auth, handle(async (req, res) => {
    const competence = parseCompetence(req.query.competence, todayComp());
    const clienteId = String(req.query.clienteId || "");
    if (!clienteId) { const e: any = new Error("clienteId obrigatório"); e.status = 400; throw e; }
    await assertClientOfTenant(req.tenantId, clienteId);
    const data = await dreWeight(req.tenantId, clienteId, competence);
    res.json(data);
  }));

  // Previsão do próximo mês.
  app.get("/api/hr/reports/forecast", ...auth, handle(async (req, res) => {
    const competence = parseCompetence(req.query.competence, todayComp());
    const clienteId = String(req.query.clienteId || "");
    if (!clienteId) { const e: any = new Error("clienteId obrigatório"); e.status = 400; throw e; }
    await assertClientOfTenant(req.tenantId, clienteId);
    const data = await forecastNextMonth(req.tenantId, clienteId, competence);
    res.json(data);
  }));

  // Alertas (13° e férias vencidas).
  app.get("/api/hr/reports/alerts", ...auth, handle(async (req, res) => {
    const clienteId = String(req.query.clienteId || "");
    if (!clienteId) { const e: any = new Error("clienteId obrigatório"); e.status = 400; throw e; }
    await assertClientOfTenant(req.tenantId, clienteId);
    const data = await alerts(req.tenantId, clienteId);
    res.json(data);
  }));
}
