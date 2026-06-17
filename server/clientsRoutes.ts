// Rotas CRUD para /api/clients — empresas gerenciadas pelo Control
import type { Express } from "express";
import { db } from "./db";
import { clients, insertClientSchema } from "@shared/schema";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { isAuthenticated } from "./portableAuth";
import { tenantContext, requireTenant } from "./tenantContext";
import { z } from "zod";

const auth = [isAuthenticated, tenantContext, requireTenant];

export function registerClientsRoutes(app: Express) {
  // GET /api/clients — lista clientes do tenant com filtros opcionais
  app.get("/api/clients", ...auth, async (req: any, res) => {
    try {
      const { search, status } = req.query as Record<string, string>;
      const tenantId: string = req.tenantId;

      let rows = await db.select().from(clients)
        .where(eq(clients.tenantId, tenantId))
        .orderBy(desc(clients.createdAt));

      if (status) rows = rows.filter(r => r.status === status);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(r =>
          r.name.toLowerCase().includes(q) ||
          (r.company ?? "").toLowerCase().includes(q) ||
          (r.cnpj ?? "").includes(q)
        );
      }

      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/clients/:id
  app.get("/api/clients/:id", ...auth, async (req: any, res) => {
    try {
      const [row] = await db.select().from(clients)
        .where(and(eq(clients.id, req.params.id), eq(clients.tenantId, req.tenantId)))
        .limit(1);
      if (!row) return res.status(404).json({ message: "Cliente não encontrado" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/clients
  app.post("/api/clients", ...auth, async (req: any, res) => {
    try {
      const body = insertClientSchema.parse({ ...req.body, tenantId: req.tenantId });
      const [row] = await db.insert(clients).values(body).returning();
      res.status(201).json(row);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/clients/:id
  app.patch("/api/clients/:id", ...auth, async (req: any, res) => {
    try {
      const partial = insertClientSchema.partial().parse(req.body);
      const [row] = await db.update(clients)
        .set({ ...partial, updatedAt: new Date() })
        .where(and(eq(clients.id, req.params.id), eq(clients.tenantId, req.tenantId)))
        .returning();
      if (!row) return res.status(404).json({ message: "Cliente não encontrado" });
      res.json(row);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/clients/:id
  app.delete("/api/clients/:id", ...auth, async (req: any, res) => {
    try {
      const [row] = await db.delete(clients)
        .where(and(eq(clients.id, req.params.id), eq(clients.tenantId, req.tenantId)))
        .returning({ id: clients.id });
      if (!row) return res.status(404).json({ message: "Cliente não encontrado" });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
