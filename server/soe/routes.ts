/**
 * SOE-00 — routes.ts
 * Registra as rotas administrativas do SOE e inicializa o EventWorker.
 *
 * Adicionar em server/routes.ts:
 *   import { registerSoe00Routes } from "./soe/routes";
 *   registerSoe00Routes(app);
 *
 * E no bootstrap do servidor (server/index.ts), após o listen:
 *   import { startEventWorker } from "./soe/eventBus";
 *   startEventWorker();
 */

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { runMigrationSoe00 } from "./migration_soe00";
import {
  getPendingEvents,
  getEventsForAggregate,
  replayEvent,
} from "./eventBus";

const auth = [isAuthenticated, tenantContext, requireTenant];

export function registerSoe00Routes(app: Express): void {

  // ── Executa a migration SOE-00 manualmente (idempotente) ──────────────────
  // Normalmente executada no deploy. Este endpoint permite reexecução segura.
  app.post("/api/soe/migrate", isAuthenticated, async (req: any, res) => {
    // Apenas masters podem rodar migrations
    if (!req.isMaster) {
      return res.status(403).json({ error: "master_required" });
    }
    try {
      await runMigrationSoe00();
      res.json({ ok: true, message: "SOE-00 migration executada." });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Lista eventos por status (observabilidade) ────────────────────────────
  app.get("/api/soe/events", ...auth, async (req: any, res) => {
    try {
      const status = (req.query.status as any) ?? "pending";
      const events = await getPendingEvents(req.tenantId, status, 100);
      res.json({ ok: true, data: events });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Lista eventos de uma entidade específica ──────────────────────────────
  app.get("/api/soe/events/:aggregateType/:aggregateId", ...auth, async (req: any, res) => {
    try {
      const { aggregateType, aggregateId } = req.params;
      const events = await getEventsForAggregate(
        req.tenantId, aggregateType, aggregateId
      );
      res.json({ ok: true, data: events });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Reprocessa evento (dead_letter recovery) ──────────────────────────────
  app.post("/api/soe/events/:eventId/replay", ...auth, async (req: any, res) => {
    if (!req.isMaster && req.tenantRole !== "admin") {
      return res.status(403).json({ error: "admin_required" });
    }
    try {
      await replayEvent(req.params.eventId);
      res.json({ ok: true, message: "Evento recolocado na fila." });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}
