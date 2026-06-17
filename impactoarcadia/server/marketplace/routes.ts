import { Router, type Request, type Response } from "express";
import { db } from "../../db/index";
import { marketplaceModules, moduleSubscriptions, tenants } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const router = Router();

router.get("/modules", async (req: Request, res: Response) => {
  try {
    const modules = await db
      .select()
      .from(marketplaceModules)
      .where(eq(marketplaceModules.isActive, true))
      .orderBy(marketplaceModules.sortOrder);
    res.json(modules);
  } catch (error) {
    console.error("Error fetching modules:", error);
    res.status(500).json({ error: "Failed to fetch modules" });
  }
});

router.get("/modules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [module] = await db
      .select()
      .from(marketplaceModules)
      .where(eq(marketplaceModules.id, parseInt(id)));
    
    if (!module) {
      return res.status(404).json({ error: "Module not found" });
    }
    res.json(module);
  } catch (error) {
    console.error("Error fetching module:", error);
    res.status(500).json({ error: "Failed to fetch module" });
  }
});

router.post("/modules", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const [module] = await db
      .insert(marketplaceModules)
      .values(data)
      .returning();
    res.status(201).json(module);
  } catch (error) {
    console.error("Error creating module:", error);
    res.status(500).json({ error: "Failed to create module" });
  }
});

router.put("/modules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const [module] = await db
      .update(marketplaceModules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(marketplaceModules.id, parseInt(id)))
      .returning();
    res.json(module);
  } catch (error) {
    console.error("Error updating module:", error);
    res.status(500).json({ error: "Failed to update module" });
  }
});

router.delete("/modules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db
      .delete(marketplaceModules)
      .where(eq(marketplaceModules.id, parseInt(id)));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting module:", error);
    res.status(500).json({ error: "Failed to delete module" });
  }
});

router.get("/subscriptions", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    
    const baseQuery = db
      .select({
        subscription: moduleSubscriptions,
        module: marketplaceModules,
        tenant: tenants,
      })
      .from(moduleSubscriptions)
      .leftJoin(marketplaceModules, eq(moduleSubscriptions.moduleId, marketplaceModules.id))
      .leftJoin(tenants, eq(moduleSubscriptions.tenantId, tenants.id));
    
    const subscriptions = tenantId 
      ? await baseQuery.where(eq(moduleSubscriptions.tenantId, parseInt(tenantId as string))).orderBy(desc(moduleSubscriptions.createdAt))
      : await baseQuery.orderBy(desc(moduleSubscriptions.createdAt));
    
    res.json(subscriptions);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

router.post("/subscriptions", async (req: Request, res: Response) => {
  try {
    const { tenantId, moduleId, price, trialDays } = req.body;
    
    const existingSubscription = await db
      .select()
      .from(moduleSubscriptions)
      .where(
        and(
          eq(moduleSubscriptions.tenantId, tenantId),
          eq(moduleSubscriptions.moduleId, moduleId),
          eq(moduleSubscriptions.status, 'active')
        )
      );
    
    if (existingSubscription.length > 0) {
      return res.status(400).json({ error: "Subscription already exists" });
    }
    
    const startDate = new Date();
    const trialEndsAt = trialDays ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null;
    
    const [subscription] = await db
      .insert(moduleSubscriptions)
      .values({
        tenantId,
        moduleId,
        price: price || null,
        startDate: startDate.toISOString().split('T')[0],
        status: trialDays ? 'trial' : 'active',
        trialEndsAt,
        activatedAt: new Date(),
      })
      .returning();
    
    res.status(201).json(subscription);
  } catch (error) {
    console.error("Error creating subscription:", error);
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

router.put("/subscriptions/:id/cancel", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const [subscription] = await db
      .update(moduleSubscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(moduleSubscriptions.id, parseInt(id)))
      .returning();
    
    res.json(subscription);
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const [modulesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(marketplaceModules)
      .where(eq(marketplaceModules.isActive, true));
    
    const [subscriptionsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(moduleSubscriptions)
      .where(eq(moduleSubscriptions.status, 'active'));
    
    const [mrr] = await db
      .select({ total: sql<number>`COALESCE(SUM(price), 0)` })
      .from(moduleSubscriptions)
      .where(eq(moduleSubscriptions.status, 'active'));
    
    res.json({
      totalModules: modulesCount?.count || 0,
      activeSubscriptions: subscriptionsCount?.count || 0,
      mrr: mrr?.total || 0,
    });
  } catch (error) {
    console.error("Error fetching marketplace stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
