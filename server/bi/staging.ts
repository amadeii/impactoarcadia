import type { Express, Request, Response } from "express";
import { db } from "../../db/index";
import { stagedTables, stagingMappings, migrationJobs, erpConnections } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function registerStagingRoutes(app: Express): void {
  app.get("/api/staging/tables", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const tables = await db
        .select()
        .from(stagedTables)
        .where(eq(stagedTables.userId, req.user!.id))
        .orderBy(desc(stagedTables.createdAt));

      res.json(tables);
    } catch (error: any) {
      console.error("Get staged tables error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staging/tables/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [table] = await db
        .select()
        .from(stagedTables)
        .where(and(eq(stagedTables.id, parseInt(req.params.id)), eq(stagedTables.userId, req.user!.id)));

      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.json(table);
    } catch (error: any) {
      console.error("Get staged table error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staging/tables/:id/data", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [table] = await db
        .select()
        .from(stagedTables)
        .where(and(eq(stagedTables.id, parseInt(req.params.id)), eq(stagedTables.userId, req.user!.id)));

      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const safeTableName = table.tableName.replace(/[^a-zA-Z0-9_]/g, "");
      const result = await db.execute(sql.raw(`SELECT * FROM "${safeTableName}" LIMIT ${limit} OFFSET ${offset}`));
      const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as total FROM "${safeTableName}"`));

      res.json({
        data: result.rows,
        total: parseInt((countResult.rows[0] as any).total),
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("Get staged table data error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/staging/tables/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [table] = await db
        .select()
        .from(stagedTables)
        .where(and(eq(stagedTables.id, parseInt(req.params.id)), eq(stagedTables.userId, req.user!.id)));

      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      try {
        const safeTableName = table.tableName.replace(/[^a-zA-Z0-9_]/g, "");
        await db.execute(sql.raw(`DROP TABLE IF EXISTS "${safeTableName}"`));
      } catch {}

      await db.delete(stagedTables).where(eq(stagedTables.id, parseInt(req.params.id)));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete staged table error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/staging/tables/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { name, targetErp, description, status } = req.body;

      const [updated] = await db
        .update(stagedTables)
        .set({
          name: name,
          targetErp: targetErp,
          description: description,
          status: status,
          updatedAt: new Date(),
        })
        .where(and(eq(stagedTables.id, parseInt(req.params.id)), eq(stagedTables.userId, req.user!.id)))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Update staged table error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staging/mappings", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const stagedTableId = req.query.stagedTableId
        ? parseInt(req.query.stagedTableId as string)
        : undefined;

      const userTables = await db
        .select({ id: stagedTables.id })
        .from(stagedTables)
        .where(eq(stagedTables.userId, req.user!.id));
      
      const userTableIds = userTables.map(t => t.id);
      
      if (userTableIds.length === 0) {
        return res.json([]);
      }

      const allMappings = await db
        .select()
        .from(stagingMappings)
        .orderBy(desc(stagingMappings.createdAt));
      
      let mappings = allMappings.filter(m => 
        m.stagedTableId && userTableIds.includes(m.stagedTableId)
      );
      
      if (stagedTableId) {
        if (!userTableIds.includes(stagedTableId)) {
          return res.status(403).json({ error: "Access denied" });
        }
        mappings = mappings.filter(m => m.stagedTableId === stagedTableId);
      }

      res.json(mappings);
    } catch (error: any) {
      console.error("Get mappings error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/staging/mappings", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { stagedTableId, name, targetErp, targetEntity, fieldMappings, filters, transformations } = req.body;

      const [table] = await db
        .select()
        .from(stagedTables)
        .where(and(eq(stagedTables.id, stagedTableId), eq(stagedTables.userId, req.user!.id)));

      if (!table) {
        return res.status(403).json({ error: "Access denied to this staged table" });
      }

      const [mapping] = await db
        .insert(stagingMappings)
        .values({
          stagedTableId,
          name,
          targetErp,
          targetEntity,
          fieldMappings: JSON.stringify(fieldMappings),
          filters: filters ? JSON.stringify(filters) : null,
          transformations: transformations ? JSON.stringify(transformations) : null,
        })
        .returning();

      await db
        .update(stagedTables)
        .set({ status: "mapped", targetErp })
        .where(eq(stagedTables.id, stagedTableId));

      res.json(mapping);
    } catch (error: any) {
      console.error("Create mapping error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/staging/mappings/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [mapping] = await db
        .select()
        .from(stagingMappings)
        .where(eq(stagingMappings.id, parseInt(req.params.id)));

      if (!mapping || !mapping.stagedTableId) {
        return res.status(404).json({ error: "Mapping not found" });
      }

      const [table] = await db
        .select()
        .from(stagedTables)
        .where(and(eq(stagedTables.id, mapping.stagedTableId), eq(stagedTables.userId, req.user!.id)));

      if (!table) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.delete(stagingMappings).where(eq(stagingMappings.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete mapping error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staging/jobs", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const jobs = await db
        .select()
        .from(migrationJobs)
        .where(eq(migrationJobs.userId, req.user!.id))
        .orderBy(desc(migrationJobs.createdAt));

      res.json(jobs);
    } catch (error: any) {
      console.error("Get migration jobs error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/staging/jobs", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { stagedTableId, mappingId, erpConnectionId } = req.body;

      const [table] = await db
        .select()
        .from(stagedTables)
        .where(and(eq(stagedTables.id, stagedTableId), eq(stagedTables.userId, req.user!.id)));
      
      if (!table) {
        return res.status(403).json({ error: "Access denied to this staged table" });
      }

      const [job] = await db
        .insert(migrationJobs)
        .values({
          userId: req.user!.id,
          stagedTableId,
          mappingId,
          erpConnectionId,
          totalRecords: table.rowCount || 0,
          status: "pending",
        })
        .returning();

      res.json(job);
    } catch (error: any) {
      console.error("Create migration job error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/staging/jobs/:id/run", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [job] = await db
        .select()
        .from(migrationJobs)
        .where(and(eq(migrationJobs.id, parseInt(req.params.id)), eq(migrationJobs.userId, req.user!.id)));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      await db
        .update(migrationJobs)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(migrationJobs.id, job.id));

      res.json({ success: true, message: "Migration job started" });
    } catch (error: any) {
      console.error("Run migration job error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staging/erp-targets", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const erpTargets = [
        {
          id: "plus",
          name: "Arcadia Plus",
          entities: ["clientes", "produtos", "pedidos", "estoque", "financeiro", "fiscal"],
        },
        {
          id: "next",
          name: "Arcadia Next",
          entities: ["clientes", "produtos", "servicos", "contratos", "ordens_servico", "financeiro"],
        },
        {
          id: "totvs",
          name: "TOTVS Protheus",
          entities: ["SA1_CLIENTES", "SB1_PRODUTOS", "SC5_PEDIDOS", "SE1_TITULOS", "SF1_NOTAS"],
        },
        {
          id: "sap",
          name: "SAP Business One",
          entities: ["BusinessPartners", "Items", "Orders", "Invoices", "JournalEntries"],
        },
      ];

      res.json(erpTargets);
    } catch (error: any) {
      console.error("Get ERP targets error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/staging/stats", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const tables = await db.select().from(stagedTables).where(eq(stagedTables.userId, req.user!.id));
      const mappings = await db.select().from(stagingMappings);
      const jobs = await db.select().from(migrationJobs).where(eq(migrationJobs.userId, req.user!.id));

      const stats = {
        totalTables: tables.length,
        totalRecords: tables.reduce((sum, t) => sum + (t.rowCount || 0), 0),
        mappedTables: tables.filter((t) => t.status === "mapped").length,
        pendingMigrations: jobs.filter((j) => j.status === "pending").length,
        completedMigrations: jobs.filter((j) => j.status === "completed").length,
        bySourceType: tables.reduce((acc: Record<string, number>, t) => {
          acc[t.sourceType] = (acc[t.sourceType] || 0) + 1;
          return acc;
        }, {}),
        byTargetErp: tables.reduce((acc: Record<string, number>, t) => {
          if (t.targetErp) acc[t.targetErp] = (acc[t.targetErp] || 0) + 1;
          return acc;
        }, {}),
      };

      res.json(stats);
    } catch (error: any) {
      console.error("Get staging stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
