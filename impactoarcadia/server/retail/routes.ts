import { Router, Request, Response, NextFunction } from "express";
import { db } from "../../db/index";
import { 
  retailStores, retailWarehouses, mobileDevices, deviceEvaluations,
  serviceOrders, serviceOrderItems, posSessions, posSales, posSaleItems,
  paymentPlans, paymentPlanInstallments, leaseAgreements, leasePayments,
  stockTransfers, stockTransferItems, returnExchanges, returnExchangeItems,
  deviceHistory, tradeInChecklistTemplates, tradeInChecklistItems,
  tradeInEvaluationResults, tradeInTransferDocuments,
  persons, personRoles, imeiHistory, customerCredits, finAccountsReceivable,
  retailActivityFeed, retailPaymentMethods, retailSellers, retailCommissionPlans,
  retailPriceTables, retailPromotions, retailProductTypes,
  retailSellerGoals, retailStoreGoals, retailCommissionClosures, retailCommissionClosureItems,
  retailWarehouseStock, retailStockMovements, retailProductSerials,
  retailStockTransfers, retailStockTransferItems, retailInventories, retailInventoryItems,
  products, purchaseOrders, purchaseOrderItems, suppliers,
  tenantEmpresas, tenants, type TenantFeatures,
  posCashMovements, serviceWarranties
} from "@shared/schema";
import { eq, desc, and, ilike, sql, or, asc, inArray, gte, lte, isNull, between, count, sum } from "drizzle-orm";
import { retailPlusSyncService } from "./plus-sync";

const router = Router();

const requireModule = (moduleKey: keyof TenantFeatures) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req.user as any)?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: "Tenant not identified" });
      }
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      const features = (tenant?.features as TenantFeatures) || {};
      if (!features[moduleKey]) {
        return res.status(403).json({ 
          error: `Módulo "${moduleKey}" não está ativo para este tenant`,
          moduleKey,
          action: "Ative o módulo em Admin → Módulos"
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

router.use(requireAuth);

// Helper function to log activity
async function logActivity(data: {
  activityType: string;
  entityType?: string;
  entityId?: number;
  title: string;
  description?: string;
  metadata?: any;
  severity?: string;
  createdBy?: string;
  createdByName?: string;
  tenantId?: number;
  storeId?: number;
}) {
  try {
    await db.insert(retailActivityFeed).values({
      activityType: data.activityType,
      entityType: data.entityType,
      entityId: data.entityId,
      title: data.title,
      description: data.description,
      metadata: data.metadata,
      severity: data.severity || "info",
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      tenantId: data.tenantId,
      storeId: data.storeId,
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

// ========== ACTIVITY FEED ==========
router.get("/activity-feed", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    
    // Scope by tenant if available
    let activities;
    if (tenantId) {
      activities = await db.select()
        .from(retailActivityFeed)
        .where(or(
          eq(retailActivityFeed.tenantId, tenantId),
          sql`${retailActivityFeed.tenantId} IS NULL`
        ))
        .orderBy(desc(retailActivityFeed.createdAt))
        .limit(limit);
    } else {
      activities = await db.select()
        .from(retailActivityFeed)
        .orderBy(desc(retailActivityFeed.createdAt))
        .limit(limit);
    }
    res.json(activities);
  } catch (error) {
    console.error("Error fetching activity feed:", error);
    res.status(500).json({ error: "Failed to fetch activity feed" });
  }
});

router.post("/activity-feed/mark-read", async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    
    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid ids array" });
    }
    
    // Validate all ids are numbers
    const validIds = ids.filter(id => typeof id === 'number' && Number.isInteger(id));
    if (validIds.length === 0) {
      return res.status(400).json({ error: "No valid ids provided" });
    }
    
    // Scope by tenant if available
    if (tenantId) {
      await db.update(retailActivityFeed)
        .set({ isRead: true })
        .where(and(
          inArray(retailActivityFeed.id, validIds),
          or(
            eq(retailActivityFeed.tenantId, tenantId),
            sql`${retailActivityFeed.tenantId} IS NULL`
          )
        ));
    } else {
      await db.update(retailActivityFeed)
        .set({ isRead: true })
        .where(inArray(retailActivityFeed.id, validIds));
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking activities as read:", error);
    res.status(500).json({ error: "Failed to mark activities as read" });
  }
});

// ========== FORMAS DE PAGAMENTO ==========
router.get("/payment-methods", async (req: Request, res: Response) => {
  try {
    const methods = await db.select().from(retailPaymentMethods).orderBy(asc(retailPaymentMethods.name));
    res.json(methods);
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    res.status(500).json({ error: "Failed to fetch payment methods" });
  }
});

router.post("/payment-methods", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const [method] = await db.insert(retailPaymentMethods)
      .values({ ...req.body, tenantId: user?.tenantId })
      .returning();
    res.json(method);
  } catch (error) {
    console.error("Error creating payment method:", error);
    res.status(500).json({ error: "Failed to create payment method" });
  }
});

router.put("/payment-methods/:id", async (req: Request, res: Response) => {
  try {
    const [method] = await db.update(retailPaymentMethods)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(retailPaymentMethods.id, parseInt(req.params.id)))
      .returning();
    res.json(method);
  } catch (error) {
    console.error("Error updating payment method:", error);
    res.status(500).json({ error: "Failed to update payment method" });
  }
});

router.delete("/payment-methods/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(retailPaymentMethods).where(eq(retailPaymentMethods.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    res.status(500).json({ error: "Failed to delete payment method" });
  }
});

// ========== VENDEDORES ==========
router.get("/sellers", async (req: Request, res: Response) => {
  try {
    const sellers = await db.select().from(retailSellers).orderBy(asc(retailSellers.name));
    res.json(sellers);
  } catch (error) {
    console.error("Error fetching sellers:", error);
    res.status(500).json({ error: "Failed to fetch sellers" });
  }
});

router.post("/sellers", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const [seller] = await db.insert(retailSellers)
      .values({ ...req.body, tenantId: user?.tenantId })
      .returning();
    res.json(seller);
  } catch (error) {
    console.error("Error creating seller:", error);
    res.status(500).json({ error: "Failed to create seller" });
  }
});

router.put("/sellers/:id", async (req: Request, res: Response) => {
  try {
    const [seller] = await db.update(retailSellers)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(retailSellers.id, parseInt(req.params.id)))
      .returning();
    res.json(seller);
  } catch (error) {
    console.error("Error updating seller:", error);
    res.status(500).json({ error: "Failed to update seller" });
  }
});

router.delete("/sellers/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(retailSellers).where(eq(retailSellers.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting seller:", error);
    res.status(500).json({ error: "Failed to delete seller" });
  }
});

// ========== PLANOS DE COMISSÃO ==========
router.get("/commission-plans", async (req: Request, res: Response) => {
  try {
    const plans = await db.select().from(retailCommissionPlans).orderBy(asc(retailCommissionPlans.name));
    res.json(plans);
  } catch (error) {
    console.error("Error fetching commission plans:", error);
    res.status(500).json({ error: "Failed to fetch commission plans" });
  }
});

router.post("/commission-plans", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const [plan] = await db.insert(retailCommissionPlans)
      .values({ ...req.body, tenantId: user?.tenantId })
      .returning();
    res.json(plan);
  } catch (error) {
    console.error("Error creating commission plan:", error);
    res.status(500).json({ error: "Failed to create commission plan" });
  }
});

router.put("/commission-plans/:id", async (req: Request, res: Response) => {
  try {
    const [plan] = await db.update(retailCommissionPlans)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(retailCommissionPlans.id, parseInt(req.params.id)))
      .returning();
    res.json(plan);
  } catch (error) {
    console.error("Error updating commission plan:", error);
    res.status(500).json({ error: "Failed to update commission plan" });
  }
});

router.delete("/commission-plans/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(retailCommissionPlans).where(eq(retailCommissionPlans.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting commission plan:", error);
    res.status(500).json({ error: "Failed to delete commission plan" });
  }
});

// ========== TABELAS DE PREÇO ==========
router.get("/price-tables", async (req: Request, res: Response) => {
  try {
    const tables = await db.select().from(retailPriceTables).orderBy(asc(retailPriceTables.name));
    res.json(tables);
  } catch (error) {
    console.error("Error fetching price tables:", error);
    res.status(500).json({ error: "Failed to fetch price tables" });
  }
});

router.post("/price-tables", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const [table] = await db.insert(retailPriceTables)
      .values({ ...req.body, tenantId: user?.tenantId })
      .returning();
    res.json(table);
  } catch (error) {
    console.error("Error creating price table:", error);
    res.status(500).json({ error: "Failed to create price table" });
  }
});

router.put("/price-tables/:id", async (req: Request, res: Response) => {
  try {
    const [table] = await db.update(retailPriceTables)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(retailPriceTables.id, parseInt(req.params.id)))
      .returning();
    res.json(table);
  } catch (error) {
    console.error("Error updating price table:", error);
    res.status(500).json({ error: "Failed to update price table" });
  }
});

router.delete("/price-tables/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(retailPriceTables).where(eq(retailPriceTables.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting price table:", error);
    res.status(500).json({ error: "Failed to delete price table" });
  }
});

// ========== PROMOÇÕES ==========
router.get("/promotions", async (req: Request, res: Response) => {
  try {
    const promos = await db.select().from(retailPromotions).orderBy(desc(retailPromotions.createdAt));
    res.json(promos);
  } catch (error) {
    console.error("Error fetching promotions:", error);
    res.status(500).json({ error: "Failed to fetch promotions" });
  }
});

router.post("/promotions", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const [promo] = await db.insert(retailPromotions)
      .values({ ...req.body, tenantId: user?.tenantId })
      .returning();
    res.json(promo);
  } catch (error) {
    console.error("Error creating promotion:", error);
    res.status(500).json({ error: "Failed to create promotion" });
  }
});

router.put("/promotions/:id", async (req: Request, res: Response) => {
  try {
    const [promo] = await db.update(retailPromotions)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(retailPromotions.id, parseInt(req.params.id)))
      .returning();
    res.json(promo);
  } catch (error) {
    console.error("Error updating promotion:", error);
    res.status(500).json({ error: "Failed to update promotion" });
  }
});

router.delete("/promotions/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(retailPromotions).where(eq(retailPromotions.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting promotion:", error);
    res.status(500).json({ error: "Failed to delete promotion" });
  }
});

// ========== PRODUCT TYPES (Tipos de Dispositivos e Acessórios) ==========
router.get("/product-types", async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const conditions = [];
    if (category) conditions.push(eq(retailProductTypes.category, category as string));
    
    const types = conditions.length > 0
      ? await db.select().from(retailProductTypes).where(and(...conditions)).orderBy(retailProductTypes.name)
      : await db.select().from(retailProductTypes).orderBy(retailProductTypes.name);
    res.json(types);
  } catch (error) {
    console.error("Error fetching product types:", error);
    res.status(500).json({ error: "Failed to fetch product types" });
  }
});

router.get("/product-types/:id", async (req: Request, res: Response) => {
  try {
    const [type] = await db.select().from(retailProductTypes)
      .where(eq(retailProductTypes.id, parseInt(req.params.id)));
    if (!type) return res.status(404).json({ error: "Product type not found" });
    res.json(type);
  } catch (error) {
    console.error("Error fetching product type:", error);
    res.status(500).json({ error: "Failed to fetch product type" });
  }
});

router.post("/product-types", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const [type] = await db.insert(retailProductTypes)
      .values({ ...req.body, tenantId: user?.tenantId })
      .returning();
    
    await logActivity({
      activityType: "product_type_created",
      title: `Tipo de produto criado`,
      description: `Tipo de produto "${type.name}" criado`,
      entityType: "product_type",
      entityId: type.id,
      tenantId: user?.tenantId,
      metadata: { category: type.category }
    });
    
    res.json(type);
  } catch (error) {
    console.error("Error creating product type:", error);
    res.status(500).json({ error: "Failed to create product type" });
  }
});

router.put("/product-types/:id", async (req: Request, res: Response) => {
  try {
    const [type] = await db.update(retailProductTypes)
      .set({ ...req.body, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(retailProductTypes.id, parseInt(req.params.id)))
      .returning();
    res.json(type);
  } catch (error) {
    console.error("Error updating product type:", error);
    res.status(500).json({ error: "Failed to update product type" });
  }
});

router.delete("/product-types/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(retailProductTypes).where(eq(retailProductTypes.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting product type:", error);
    res.status(500).json({ error: "Failed to delete product type" });
  }
});

// ========== STORES ==========
router.get("/stores", async (req: Request, res: Response) => {
  try {
    const stores = await db.select().from(retailStores).orderBy(desc(retailStores.createdAt));
    res.json(stores);
  } catch (error) {
    console.error("Error fetching stores:", error);
    res.status(500).json({ error: "Failed to fetch stores" });
  }
});

router.post("/stores", async (req: Request, res: Response) => {
  try {
    const [store] = await db.insert(retailStores).values(req.body).returning();
    res.json(store);
  } catch (error) {
    console.error("Error creating store:", error);
    res.status(500).json({ error: "Failed to create store" });
  }
});

router.put("/stores/:id", async (req: Request, res: Response) => {
  try {
    const [store] = await db.update(retailStores)
      .set({ ...req.body, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(retailStores.id, parseInt(req.params.id)))
      .returning();
    res.json(store);
  } catch (error) {
    console.error("Error updating store:", error);
    res.status(500).json({ error: "Failed to update store" });
  }
});

// ========== WAREHOUSES ==========
router.get("/warehouses", async (req: Request, res: Response) => {
  try {
    const warehouses = await db.select().from(retailWarehouses).orderBy(desc(retailWarehouses.createdAt));
    res.json(warehouses);
  } catch (error) {
    console.error("Error fetching warehouses:", error);
    res.status(500).json({ error: "Failed to fetch warehouses" });
  }
});

router.post("/warehouses", async (req: Request, res: Response) => {
  try {
    const [warehouse] = await db.insert(retailWarehouses).values(req.body).returning();
    res.json(warehouse);
  } catch (error) {
    console.error("Error creating warehouse:", error);
    res.status(500).json({ error: "Failed to create warehouse" });
  }
});

router.put("/warehouses/:id", async (req: Request, res: Response) => {
  try {
    const [warehouse] = await db.update(retailWarehouses)
      .set({ ...req.body, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(retailWarehouses.id, parseInt(req.params.id)))
      .returning();
    res.json(warehouse);
  } catch (error) {
    console.error("Error updating warehouse:", error);
    res.status(500).json({ error: "Failed to update warehouse" });
  }
});

router.delete("/warehouses/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(retailWarehouses).where(eq(retailWarehouses.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting warehouse:", error);
    res.status(500).json({ error: "Failed to delete warehouse" });
  }
});

// ========== WAREHOUSE STOCK (Saldos por Depósito) ==========
router.get("/warehouse-stock", async (req: Request, res: Response) => {
  try {
    const { warehouseId, productId } = req.query;
    let conditions = [];
    if (warehouseId) conditions.push(eq(retailWarehouseStock.warehouseId, parseInt(warehouseId as string)));
    if (productId) conditions.push(eq(retailWarehouseStock.productId, parseInt(productId as string)));
    
    const stock = conditions.length > 0
      ? await db.select().from(retailWarehouseStock).where(and(...conditions))
      : await db.select().from(retailWarehouseStock);
    res.json(stock);
  } catch (error) {
    console.error("Error fetching warehouse stock:", error);
    res.status(500).json({ error: "Failed to fetch warehouse stock" });
  }
});

router.get("/warehouse-stock/:warehouseId/summary", async (req: Request, res: Response) => {
  try {
    const warehouseId = parseInt(req.params.warehouseId);
    const stock = await db.select({
      id: retailWarehouseStock.id,
      productId: retailWarehouseStock.productId,
      productName: products.name,
      productCode: products.code,
      quantity: retailWarehouseStock.quantity,
      reservedQuantity: retailWarehouseStock.reservedQuantity,
      availableQuantity: retailWarehouseStock.availableQuantity,
      minStock: retailWarehouseStock.minStock,
      maxStock: retailWarehouseStock.maxStock,
      lastMovementAt: retailWarehouseStock.lastMovementAt,
    })
    .from(retailWarehouseStock)
    .leftJoin(products, eq(retailWarehouseStock.productId, products.id))
    .where(eq(retailWarehouseStock.warehouseId, warehouseId));
    res.json(stock);
  } catch (error) {
    console.error("Error fetching warehouse stock summary:", error);
    res.status(500).json({ error: "Failed to fetch warehouse stock summary" });
  }
});

// ========== STOCK MOVEMENTS (Movimentações de Estoque) ==========
router.get("/stock-movements", async (req: Request, res: Response) => {
  try {
    const { warehouseId, productId, movementType, limit = "50" } = req.query;
    let conditions = [];
    if (warehouseId) conditions.push(eq(retailStockMovements.warehouseId, parseInt(warehouseId as string)));
    if (productId) conditions.push(eq(retailStockMovements.productId, parseInt(productId as string)));
    if (movementType) conditions.push(eq(retailStockMovements.movementType, movementType as string));
    
    const movements = conditions.length > 0
      ? await db.select().from(retailStockMovements).where(and(...conditions)).orderBy(desc(retailStockMovements.createdAt)).limit(parseInt(limit as string))
      : await db.select().from(retailStockMovements).orderBy(desc(retailStockMovements.createdAt)).limit(parseInt(limit as string));
    res.json(movements);
  } catch (error) {
    console.error("Error fetching stock movements:", error);
    res.status(500).json({ error: "Failed to fetch stock movements" });
  }
});

router.post("/stock-movements", async (req: Request, res: Response) => {
  try {
    const { warehouseId, productId, movementType, operationType, quantity, unitCost, supplierId, referenceNumber, notes, serials } = req.body;
    
    // Buscar saldo atual
    let [currentStock] = await db.select().from(retailWarehouseStock)
      .where(and(
        eq(retailWarehouseStock.warehouseId, warehouseId),
        eq(retailWarehouseStock.productId, productId)
      ));
    
    const previousStock = currentStock ? parseFloat(currentStock.quantity) : 0;
    const movementQty = parseFloat(quantity);
    const newStock = movementType === "entry" || movementType === "transfer_in" 
      ? previousStock + movementQty 
      : previousStock - movementQty;
    
    // Inserir movimentação
    const [movement] = await db.insert(retailStockMovements).values({
      warehouseId,
      productId,
      movementType,
      operationType,
      quantity: quantity.toString(),
      previousStock: previousStock.toString(),
      newStock: newStock.toString(),
      unitCost: unitCost?.toString(),
      totalCost: unitCost ? (movementQty * parseFloat(unitCost)).toString() : null,
      supplierId,
      referenceNumber,
      notes,
      userId: (req.user as any)?.id,
    }).returning();
    
    // Atualizar ou criar saldo de estoque
    if (currentStock) {
      await db.update(retailWarehouseStock)
        .set({ 
          quantity: newStock.toString(),
          availableQuantity: (newStock - parseFloat(currentStock.reservedQuantity || "0")).toString(),
          lastMovementAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(retailWarehouseStock.id, currentStock.id));
    } else {
      await db.insert(retailWarehouseStock).values({
        warehouseId,
        productId,
        quantity: newStock.toString(),
        availableQuantity: newStock.toString(),
        reservedQuantity: "0",
        lastMovementAt: sql`CURRENT_TIMESTAMP`,
      });
    }
    
    // Inserir números de série/IMEI se fornecidos
    if (serials && Array.isArray(serials) && serials.length > 0) {
      const serialRecords = serials.map((s: any) => ({
        productId,
        warehouseId,
        serialNumber: s.serialNumber,
        imei: s.imei,
        imei2: s.imei2,
        status: movementType === "entry" ? "in_stock" : "sold",
        acquisitionCost: unitCost?.toString(),
        movementId: movement.id,
        purchaseNfeNumber: referenceNumber,
      }));
      await db.insert(retailProductSerials).values(serialRecords);
    }
    
    res.json(movement);
  } catch (error) {
    console.error("Error creating stock movement:", error);
    res.status(500).json({ error: "Failed to create stock movement" });
  }
});

// ========== PRODUCT SERIALS (Números de Série/IMEI) ==========
router.get("/product-serials", async (req: Request, res: Response) => {
  try {
    const { productId, warehouseId, status, search } = req.query;
    let conditions = [];
    if (productId) conditions.push(eq(retailProductSerials.productId, parseInt(productId as string)));
    if (warehouseId) conditions.push(eq(retailProductSerials.warehouseId, parseInt(warehouseId as string)));
    if (status) conditions.push(eq(retailProductSerials.status, status as string));
    if (search) {
      conditions.push(or(
        ilike(retailProductSerials.imei, `%${search}%`),
        ilike(retailProductSerials.serialNumber, `%${search}%`)
      ));
    }
    
    const serials = conditions.length > 0
      ? await db.select().from(retailProductSerials).where(and(...conditions)).orderBy(desc(retailProductSerials.createdAt))
      : await db.select().from(retailProductSerials).orderBy(desc(retailProductSerials.createdAt));
    res.json(serials);
  } catch (error) {
    console.error("Error fetching product serials:", error);
    res.status(500).json({ error: "Failed to fetch product serials" });
  }
});

router.post("/product-serials", async (req: Request, res: Response) => {
  try {
    const [serial] = await db.insert(retailProductSerials).values(req.body).returning();
    res.json(serial);
  } catch (error) {
    console.error("Error creating product serial:", error);
    res.status(500).json({ error: "Failed to create product serial" });
  }
});

router.put("/product-serials/:id", async (req: Request, res: Response) => {
  try {
    const [serial] = await db.update(retailProductSerials)
      .set({ ...req.body, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(retailProductSerials.id, parseInt(req.params.id)))
      .returning();
    res.json(serial);
  } catch (error) {
    console.error("Error updating product serial:", error);
    res.status(500).json({ error: "Failed to update product serial" });
  }
});

// ========== STOCK TRANSFERS (Transferências entre Depósitos) ==========
router.get("/stock-transfers", async (req: Request, res: Response) => {
  try {
    const { status, sourceWarehouseId, destinationWarehouseId } = req.query;
    let conditions = [];
    if (status) conditions.push(eq(retailStockTransfers.status, status as string));
    if (sourceWarehouseId) conditions.push(eq(retailStockTransfers.sourceWarehouseId, parseInt(sourceWarehouseId as string)));
    if (destinationWarehouseId) conditions.push(eq(retailStockTransfers.destinationWarehouseId, parseInt(destinationWarehouseId as string)));
    
    const transfers = conditions.length > 0
      ? await db.select().from(retailStockTransfers).where(and(...conditions)).orderBy(desc(retailStockTransfers.createdAt))
      : await db.select().from(retailStockTransfers).orderBy(desc(retailStockTransfers.createdAt));
    res.json(transfers);
  } catch (error) {
    console.error("Error fetching stock transfers:", error);
    res.status(500).json({ error: "Failed to fetch stock transfers" });
  }
});

router.get("/stock-transfers/:id", async (req: Request, res: Response) => {
  try {
    const [transfer] = await db.select().from(retailStockTransfers)
      .where(eq(retailStockTransfers.id, parseInt(req.params.id)));
    if (!transfer) return res.status(404).json({ error: "Transfer not found" });
    
    const items = await db.select({
      id: retailStockTransferItems.id,
      productId: retailStockTransferItems.productId,
      productName: products.name,
      productCode: products.code,
      requestedQuantity: retailStockTransferItems.requestedQuantity,
      transferredQuantity: retailStockTransferItems.transferredQuantity,
      receivedQuantity: retailStockTransferItems.receivedQuantity,
      notes: retailStockTransferItems.notes,
    })
    .from(retailStockTransferItems)
    .leftJoin(products, eq(retailStockTransferItems.productId, products.id))
    .where(eq(retailStockTransferItems.transferId, transfer.id));
    
    res.json({ ...transfer, items });
  } catch (error) {
    console.error("Error fetching stock transfer:", error);
    res.status(500).json({ error: "Failed to fetch stock transfer" });
  }
});

router.post("/stock-transfers", async (req: Request, res: Response) => {
  try {
    const { sourceWarehouseId, destinationWarehouseId, items, notes } = req.body;
    
    // Gerar número da transferência
    const transferNumber = `TRF-${Date.now().toString(36).toUpperCase()}`;
    
    const [transfer] = await db.insert(retailStockTransfers).values({
      sourceWarehouseId,
      destinationWarehouseId,
      transferNumber,
      notes,
      requestedBy: (req.user as any)?.id,
      status: "pending",
    }).returning();
    
    // Inserir itens da transferência
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await db.insert(retailStockTransferItems).values({
          transferId: transfer.id,
          productId: item.productId,
          requestedQuantity: item.quantity.toString(),
        });
      }
    }
    
    res.json(transfer);
  } catch (error) {
    console.error("Error creating stock transfer:", error);
    res.status(500).json({ error: "Failed to create stock transfer" });
  }
});

router.put("/stock-transfers/:id/status", async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const transferId = parseInt(req.params.id);
    const userId = (req.user as any)?.id;
    
    const updateData: any = { status };
    
    if (status === "in_transit") {
      updateData.approvedBy = userId;
      updateData.approvedAt = sql`CURRENT_TIMESTAMP`;
    } else if (status === "completed") {
      updateData.completedBy = userId;
      updateData.completedAt = sql`CURRENT_TIMESTAMP`;
      
      // Processar movimentações de estoque
      const [transfer] = await db.select().from(retailStockTransfers).where(eq(retailStockTransfers.id, transferId));
      const items = await db.select().from(retailStockTransferItems).where(eq(retailStockTransferItems.transferId, transferId));
      
      for (const item of items) {
        const qty = parseFloat(item.requestedQuantity);
        
        // Saída do depósito de origem
        await db.insert(retailStockMovements).values({
          warehouseId: transfer.sourceWarehouseId,
          productId: item.productId,
          movementType: "transfer_out",
          operationType: "transfer",
          quantity: qty.toString(),
          referenceType: "transfer",
          referenceId: transferId,
          referenceNumber: transfer.transferNumber,
          userId,
        });
        
        // Entrada no depósito de destino
        await db.insert(retailStockMovements).values({
          warehouseId: transfer.destinationWarehouseId,
          productId: item.productId,
          movementType: "transfer_in",
          operationType: "transfer",
          quantity: qty.toString(),
          referenceType: "transfer",
          referenceId: transferId,
          referenceNumber: transfer.transferNumber,
          userId,
        });
        
        // Atualizar saldos
        // Origem
        const [sourceStock] = await db.select().from(retailWarehouseStock)
          .where(and(eq(retailWarehouseStock.warehouseId, transfer.sourceWarehouseId), eq(retailWarehouseStock.productId, item.productId)));
        if (sourceStock) {
          const newQty = parseFloat(sourceStock.quantity) - qty;
          await db.update(retailWarehouseStock)
            .set({ quantity: newQty.toString(), availableQuantity: newQty.toString(), lastMovementAt: sql`CURRENT_TIMESTAMP`, updatedAt: sql`CURRENT_TIMESTAMP` })
            .where(eq(retailWarehouseStock.id, sourceStock.id));
        }
        
        // Destino
        let [destStock] = await db.select().from(retailWarehouseStock)
          .where(and(eq(retailWarehouseStock.warehouseId, transfer.destinationWarehouseId), eq(retailWarehouseStock.productId, item.productId)));
        if (destStock) {
          const newQty = parseFloat(destStock.quantity) + qty;
          await db.update(retailWarehouseStock)
            .set({ quantity: newQty.toString(), availableQuantity: newQty.toString(), lastMovementAt: sql`CURRENT_TIMESTAMP`, updatedAt: sql`CURRENT_TIMESTAMP` })
            .where(eq(retailWarehouseStock.id, destStock.id));
        } else {
          await db.insert(retailWarehouseStock).values({
            warehouseId: transfer.destinationWarehouseId,
            productId: item.productId,
            quantity: qty.toString(),
            availableQuantity: qty.toString(),
            reservedQuantity: "0",
            lastMovementAt: sql`CURRENT_TIMESTAMP`,
          });
        }
      }
    }
    
    const [updated] = await db.update(retailStockTransfers)
      .set(updateData)
      .where(eq(retailStockTransfers.id, transferId))
      .returning();
    
    res.json(updated);
  } catch (error) {
    console.error("Error updating stock transfer status:", error);
    res.status(500).json({ error: "Failed to update stock transfer status" });
  }
});

// ========== INVENTORIES (Inventários) ==========
router.get("/inventories", async (req: Request, res: Response) => {
  try {
    const { warehouseId, status } = req.query;
    let conditions = [];
    if (warehouseId) conditions.push(eq(retailInventories.warehouseId, parseInt(warehouseId as string)));
    if (status) conditions.push(eq(retailInventories.status, status as string));
    
    const inventories = conditions.length > 0
      ? await db.select().from(retailInventories).where(and(...conditions)).orderBy(desc(retailInventories.createdAt))
      : await db.select().from(retailInventories).orderBy(desc(retailInventories.createdAt));
    res.json(inventories);
  } catch (error) {
    console.error("Error fetching inventories:", error);
    res.status(500).json({ error: "Failed to fetch inventories" });
  }
});

router.post("/inventories", async (req: Request, res: Response) => {
  try {
    const { warehouseId, type, notes } = req.body;
    const inventoryNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    
    const [inventory] = await db.insert(retailInventories).values({
      warehouseId,
      type: type || "full",
      inventoryNumber,
      status: "open",
      notes,
      createdBy: (req.user as any)?.id,
      startedAt: sql`CURRENT_TIMESTAMP`,
    }).returning();
    
    // Carregar itens do estoque atual para contagem
    const stock = await db.select().from(retailWarehouseStock)
      .where(eq(retailWarehouseStock.warehouseId, warehouseId));
    
    for (const item of stock) {
      await db.insert(retailInventoryItems).values({
        inventoryId: inventory.id,
        productId: item.productId,
        systemQuantity: item.quantity,
      });
    }
    
    res.json(inventory);
  } catch (error) {
    console.error("Error creating inventory:", error);
    res.status(500).json({ error: "Failed to create inventory" });
  }
});

router.get("/inventories/:id", async (req: Request, res: Response) => {
  try {
    const [inventory] = await db.select().from(retailInventories)
      .where(eq(retailInventories.id, parseInt(req.params.id)));
    if (!inventory) return res.status(404).json({ error: "Inventory not found" });
    
    const items = await db.select({
      id: retailInventoryItems.id,
      productId: retailInventoryItems.productId,
      productName: products.name,
      productCode: products.code,
      systemQuantity: retailInventoryItems.systemQuantity,
      countedQuantity: retailInventoryItems.countedQuantity,
      difference: retailInventoryItems.difference,
      adjustmentApplied: retailInventoryItems.adjustmentApplied,
    })
    .from(retailInventoryItems)
    .leftJoin(products, eq(retailInventoryItems.productId, products.id))
    .where(eq(retailInventoryItems.inventoryId, inventory.id));
    
    res.json({ ...inventory, items });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

router.put("/inventories/:id/count", async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    const userId = (req.user as any)?.id;
    
    for (const item of items) {
      const countedQty = parseFloat(item.countedQuantity);
      const systemQty = parseFloat(item.systemQuantity || 0);
      
      await db.update(retailInventoryItems)
        .set({
          countedQuantity: countedQty.toString(),
          difference: (countedQty - systemQty).toString(),
          countedBy: userId,
          countedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(retailInventoryItems.id, item.id));
    }
    
    await db.update(retailInventories)
      .set({ status: "counting" })
      .where(eq(retailInventories.id, parseInt(req.params.id)));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating inventory count:", error);
    res.status(500).json({ error: "Failed to update inventory count" });
  }
});

router.put("/inventories/:id/apply", async (req: Request, res: Response) => {
  try {
    const inventoryId = parseInt(req.params.id);
    const userId = (req.user as any)?.id;
    
    const [inventory] = await db.select().from(retailInventories).where(eq(retailInventories.id, inventoryId));
    const items = await db.select().from(retailInventoryItems).where(eq(retailInventoryItems.inventoryId, inventoryId));
    
    for (const item of items) {
      if (item.countedQuantity !== null && !item.adjustmentApplied) {
        const diff = parseFloat(item.difference || "0");
        if (diff !== 0) {
          // Criar movimentação de ajuste
          await db.insert(retailStockMovements).values({
            warehouseId: inventory.warehouseId,
            productId: item.productId,
            movementType: "adjustment",
            operationType: "inventory_adjustment",
            quantity: Math.abs(diff).toString(),
            referenceType: "inventory",
            referenceId: inventoryId,
            referenceNumber: inventory.inventoryNumber,
            notes: `Ajuste de inventário: ${diff > 0 ? "+" : ""}${diff}`,
            userId,
          });
          
          // Atualizar saldo
          const [stock] = await db.select().from(retailWarehouseStock)
            .where(and(eq(retailWarehouseStock.warehouseId, inventory.warehouseId), eq(retailWarehouseStock.productId, item.productId)));
          if (stock) {
            await db.update(retailWarehouseStock)
              .set({ 
                quantity: item.countedQuantity, 
                availableQuantity: item.countedQuantity,
                lastInventoryAt: sql`CURRENT_TIMESTAMP`,
                lastMovementAt: sql`CURRENT_TIMESTAMP`,
                updatedAt: sql`CURRENT_TIMESTAMP`
              })
              .where(eq(retailWarehouseStock.id, stock.id));
          }
        }
        
        await db.update(retailInventoryItems)
          .set({ adjustmentApplied: true })
          .where(eq(retailInventoryItems.id, item.id));
      }
    }
    
    await db.update(retailInventories)
      .set({ status: "completed", completedAt: sql`CURRENT_TIMESTAMP`, completedBy: userId })
      .where(eq(retailInventories.id, inventoryId));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error applying inventory adjustments:", error);
    res.status(500).json({ error: "Failed to apply inventory adjustments" });
  }
});

// ========== MOBILE DEVICES ==========
router.get("/devices", async (req: Request, res: Response) => {
  try {
    const { search, status, storeId } = req.query;
    let query = db.select().from(mobileDevices);
    
    const conditions = [];
    if (search) {
      conditions.push(or(
        ilike(mobileDevices.imei, `%${search}%`),
        ilike(mobileDevices.brand, `%${search}%`),
        ilike(mobileDevices.model, `%${search}%`)
      ));
    }
    if (status) {
      conditions.push(eq(mobileDevices.status, status as string));
    }
    if (storeId) {
      conditions.push(eq(mobileDevices.storeId, parseInt(storeId as string)));
    }
    
    const devices = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(mobileDevices.createdAt))
      : await query.orderBy(desc(mobileDevices.createdAt));
    
    res.json(devices);
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

router.get("/devices/:id", async (req: Request, res: Response) => {
  try {
    const [device] = await db.select().from(mobileDevices)
      .where(eq(mobileDevices.id, parseInt(req.params.id)));
    if (!device) return res.status(404).json({ error: "Device not found" });
    res.json(device);
  } catch (error) {
    console.error("Error fetching device:", error);
    res.status(500).json({ error: "Failed to fetch device" });
  }
});

router.get("/devices/imei/:imei", async (req: Request, res: Response) => {
  try {
    const [device] = await db.select().from(mobileDevices)
      .where(eq(mobileDevices.imei, req.params.imei));
    if (!device) return res.status(404).json({ error: "Device not found" });
    res.json(device);
  } catch (error) {
    console.error("Error fetching device by IMEI:", error);
    res.status(500).json({ error: "Failed to fetch device" });
  }
});

router.post("/devices", async (req: Request, res: Response) => {
  try {
    if (req.body.imei) {
      const existing = await db.select({ id: mobileDevices.id }).from(mobileDevices)
        .where(eq(mobileDevices.imei, req.body.imei))
        .limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ error: "IMEI já cadastrado no sistema. Cada aparelho deve ter um IMEI único." });
      }
    }
    const [device] = await db.insert(mobileDevices).values(req.body).returning();
    await db.insert(deviceHistory).values({
      deviceId: device.id,
      imei: device.imei,
      eventType: "received",
      toLocation: req.body.storeId ? `Store ${req.body.storeId}` : `Warehouse ${req.body.warehouseId}`,
      createdBy: (req as any).user?.id
    });
    res.json(device);
  } catch (error) {
    console.error("Error creating device:", error);
    res.status(500).json({ error: "Failed to create device" });
  }
});

router.put("/devices/:id", async (req: Request, res: Response) => {
  try {
    const updateData: Record<string, any> = { ...req.body, updatedAt: sql`CURRENT_TIMESTAMP` };
    if (updateData.purchasePrice) updateData.purchasePrice = String(updateData.purchasePrice);
    if (updateData.sellingPrice) updateData.sellingPrice = String(updateData.sellingPrice);
    if (updateData.warrantyEndDate) updateData.warrantyEndDate = updateData.warrantyEndDate;
    
    const [device] = await db.update(mobileDevices)
      .set(updateData)
      .where(eq(mobileDevices.id, parseInt(req.params.id)))
      .returning();
    res.json(device);
  } catch (error) {
    console.error("Error updating device:", error);
    res.status(500).json({ error: "Failed to update device" });
  }
});

// ========== DEVICE EVALUATIONS (Trade-In) ==========
router.get("/evaluations", async (req: Request, res: Response) => {
  try {
    const evaluations = await db.select().from(deviceEvaluations)
      .orderBy(desc(deviceEvaluations.createdAt));
    res.json(evaluations);
  } catch (error) {
    console.error("Error fetching evaluations:", error);
    res.status(500).json({ error: "Failed to fetch evaluations" });
  }
});

router.post("/evaluations", async (req: Request, res: Response) => {
  try {
    console.log("Creating evaluation with body:", JSON.stringify(req.body, null, 2));
    const estimatedValue = calculateTradeInValue(req.body);
    console.log("Calculated estimatedValue:", estimatedValue);
    const [evaluation] = await db.insert(deviceEvaluations)
      .values({ ...req.body, estimatedValue })
      .returning();
    console.log("Evaluation created:", evaluation.id);
    
    // Log activity with user context
    const user = (req as any).user;
    await logActivity({
      activityType: "evaluation",
      entityType: "device_evaluation",
      entityId: evaluation.id,
      title: `Nova avaliação Trade-In: ${req.body.brand} ${req.body.model}`,
      description: `IMEI: ${req.body.imei} - Cliente: ${req.body.customerName || 'N/A'} - Valor: R$ ${estimatedValue}`,
      severity: "info",
      metadata: { brand: req.body.brand, model: req.body.model, imei: req.body.imei, estimatedValue },
      tenantId: user?.tenantId,
      storeId: req.body.storeId,
      createdBy: user?.id,
      createdByName: user?.name || user?.username
    });
    
    res.json(evaluation);
  } catch (error: any) {
    console.error("Error creating evaluation:", error);
    console.error("Error message:", error.message);
    console.error("Error details:", error.detail);
    res.status(500).json({ error: "Failed to create evaluation", message: error.message });
  }
});

router.put("/evaluations/:id/approve", async (req: Request, res: Response) => {
  try {
    const { productId } = req.body; // Produto existente para relacionar (opcional)
    
    const [evaluation] = await db.select().from(deviceEvaluations)
      .where(eq(deviceEvaluations.id, parseInt(req.params.id)));
    
    if (!evaluation) return res.status(404).json({ error: "Evaluation not found" });
    
    // Criar dispositivo com status pending_preparation e acquisitionType trade_in
    const [device] = await db.insert(mobileDevices).values({
      imei: evaluation.imei,
      brand: evaluation.brand,
      model: evaluation.model,
      color: evaluation.color || undefined,
      condition: "trade_in", // Não "used" - pode ser trade-in de produto novo
      purchasePrice: evaluation.estimatedValue,
      storeId: evaluation.storeId || undefined,
      status: "pending_preparation", // Aguardando preparação
      acquisitionType: "trade_in",
      acquisitionCost: evaluation.estimatedValue,
      relatedEvaluationId: evaluation.id,
      productId: productId || undefined, // Relacionar a produto existente
      personId: (evaluation as any).personId || undefined
    }).returning();
    
    // Criar O.S. interna de preparação/revisão
    const osNumber = `OSI-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const [serviceOrder] = await db.insert(serviceOrders).values({
      orderNumber: osNumber,
      storeId: evaluation.storeId || undefined,
      deviceId: device.id,
      imei: evaluation.imei,
      brand: evaluation.brand,
      model: evaluation.model,
      customerName: "Ordem Interna - Trade-In",
      serviceType: "internal_preparation",
      origin: "trade_in",
      issueDescription: `Preparação de aparelho Trade-In para estoque.\n\nCondições da avaliação:\n- Liga corretamente: ${evaluation.powerOn ? 'Sim' : 'Não'}\n- Problemas tela: ${evaluation.screenIssues ? 'Sim' : 'Não'}\n- Bateria: ${evaluation.batteryHealth || 'N/A'}%\n- Câmeras: ${evaluation.camerasWorking ? 'OK' : 'Verificar'}\n- Carregador: ${evaluation.hasCharger ? 'Incluso' : 'Não incluso'}\n- 3uTools OK: ${evaluation.toolsAnalysisOk ? 'Sim' : 'Não'}\n\nObservações: Realizar limpeza, teste completo, etiquetagem e liberar para estoque.`,
      isInternal: true,
      status: "open",
      priority: "normal"
    }).returning();
    
    // Atualizar dispositivo com referência à O.S.
    await db.update(mobileDevices)
      .set({ relatedServiceOrderId: serviceOrder.id })
      .where(eq(mobileDevices.id, device.id));
    
    const [updated] = await db.update(deviceEvaluations)
      .set({ 
        approved: true, 
        status: "approved",
        deviceId: device.id,
        approvedBy: (req as any).user?.id,
        updatedAt: new Date()
      })
      .where(eq(deviceEvaluations.id, parseInt(req.params.id)))
      .returning();
    
    // Buscar personId para criar o crédito - priorizar evaluation.personId
    let personId = (evaluation as any).personId || null;
    let customerCpf = null;
    
    // Se tiver personId, buscar dados da pessoa
    if (personId) {
      const [person] = await db.select().from(persons)
        .where(eq(persons.id, personId))
        .limit(1);
      if (person) {
        customerCpf = person.cpfCnpj;
      }
    } else if (evaluation.customerName) {
      // Fallback: buscar por nome se não tiver personId
      const [person] = await db.select().from(persons)
        .where(ilike(persons.fullName, evaluation.customerName))
        .limit(1);
      if (person) {
        personId = person.id;
        customerCpf = person.cpfCnpj;
      }
    }
    
    // Criar crédito do cliente se tiver personId e valor válido > 0
    let credit = null;
    const estimatedValueNum = evaluation.estimatedValue ? parseFloat(evaluation.estimatedValue) : 0;
    if (personId && estimatedValueNum > 0) {
      [credit] = await db.insert(customerCredits).values({
        storeId: evaluation.storeId || undefined,
        personId: personId,
        customerName: evaluation.customerName || "Cliente",
        customerCpf: customerCpf || undefined,
        amount: evaluation.estimatedValue!,
        remainingAmount: evaluation.estimatedValue!,
        origin: "trade_in",
        originId: evaluation.id,
        description: `Trade-In: ${evaluation.brand} ${evaluation.model} (IMEI: ${evaluation.imei})`,
        status: "active",
        createdBy: (req as any).user?.id
      }).returning();
    }
    
    // Log activity with user context
    const user = (req as any).user;
    await logActivity({
      activityType: "evaluation",
      entityType: "device_evaluation",
      entityId: evaluation.id,
      title: `Trade-In APROVADO: ${evaluation.brand} ${evaluation.model}`,
      description: `IMEI: ${evaluation.imei} - Valor: R$ ${evaluation.estimatedValue} - O.S. ${osNumber} criada`,
      severity: "success",
      metadata: { deviceId: device.id, serviceOrderId: serviceOrder.id, creditId: credit?.id },
      tenantId: user?.tenantId,
      storeId: evaluation.storeId || undefined,
      createdBy: user?.id,
      createdByName: user?.name || user?.username
    });
    
    res.json({ evaluation: updated, device, serviceOrder, credit });
  } catch (error) {
    console.error("Error approving evaluation:", error);
    res.status(500).json({ error: "Failed to approve evaluation" });
  }
});

// Update evaluation (edit checklist and value)
router.put("/evaluations/:id", async (req: Request, res: Response) => {
  try {
    const { 
      // Novo checklist completo
      powerOn, powerOnNotes,
      screenIssues, screenIssuesNotes,
      screenSpots, screenSpotsNotes,
      buttonsWorking, buttonsWorkingNotes,
      wearMarks, wearMarksNotes,
      wifiWorking, wifiWorkingNotes,
      simWorking, simWorkingNotes,
      mobileDataWorking, mobileDataWorkingNotes,
      sensorsNfcWorking, sensorsNfcWorkingNotes,
      biometricWorking, biometricWorkingNotes,
      microphonesWorking, microphonesWorkingNotes,
      earSpeakerWorking, earSpeakerWorkingNotes,
      loudspeakerWorking, loudspeakerWorkingNotes,
      chargingPortWorking, chargingPortWorkingNotes,
      camerasWorking, camerasWorkingNotes,
      flashWorking, flashWorkingNotes,
      hasCharger, hasChargerNotes,
      toolsAnalysisOk, toolsAnalysisNotes,
      batteryHealth, batteryHealthNotes,
      // Campos legados
      screenCondition, bodyCondition, overallCondition, estimatedValue,
      customerName, customerPhone, color
    } = req.body;
    
    const [evaluation] = await db.update(deviceEvaluations)
      .set({ 
        // Novo checklist
        powerOn,
        powerOnNotes,
        screenIssues,
        screenIssuesNotes,
        screenSpots,
        screenSpotsNotes,
        buttonsWorking,
        buttonsWorkingNotes,
        wearMarks,
        wearMarksNotes,
        wifiWorking,
        wifiWorkingNotes,
        simWorking,
        simWorkingNotes,
        mobileDataWorking,
        mobileDataWorkingNotes,
        sensorsNfcWorking,
        sensorsNfcWorkingNotes,
        biometricWorking,
        biometricWorkingNotes,
        microphonesWorking,
        microphonesWorkingNotes,
        earSpeakerWorking,
        earSpeakerWorkingNotes,
        loudspeakerWorking,
        loudspeakerWorkingNotes,
        chargingPortWorking,
        chargingPortWorkingNotes,
        camerasWorking,
        camerasWorkingNotes,
        flashWorking,
        flashWorkingNotes,
        hasCharger,
        hasChargerNotes,
        toolsAnalysisOk,
        toolsAnalysisNotes,
        batteryHealth,
        batteryHealthNotes,
        // Legados
        screenCondition,
        bodyCondition,
        overallCondition,
        estimatedValue: estimatedValue?.toString(),
        customerName,
        customerPhone,
        color,
        updatedAt: new Date()
      })
      .where(eq(deviceEvaluations.id, parseInt(req.params.id)))
      .returning();
    res.json(evaluation);
  } catch (error) {
    console.error("Error updating evaluation:", error);
    res.status(500).json({ error: "Failed to update evaluation" });
  }
});

router.put("/evaluations/:id/reject", async (req: Request, res: Response) => {
  try {
    const [evaluation] = await db.update(deviceEvaluations)
      .set({ 
        approved: false,
        status: "rejected",
        rejectionReason: req.body.reason,
        updatedAt: new Date()
      })
      .where(eq(deviceEvaluations.id, parseInt(req.params.id)))
      .returning();
    
    // Log activity with user context
    const user = (req as any).user;
    await logActivity({
      activityType: "evaluation",
      entityType: "device_evaluation",
      entityId: evaluation.id,
      title: `Trade-In REJEITADO: ${evaluation.brand} ${evaluation.model}`,
      description: `IMEI: ${evaluation.imei} - Motivo: ${req.body.reason || 'Não especificado'}`,
      severity: "warning",
      metadata: { reason: req.body.reason },
      tenantId: user?.tenantId,
      storeId: evaluation.storeId || undefined,
      createdBy: user?.id,
      createdByName: user?.name || user?.username
    });
    
    res.json(evaluation);
  } catch (error) {
    console.error("Error rejecting evaluation:", error);
    res.status(500).json({ error: "Failed to reject evaluation" });
  }
});

// ========== SERVICE ORDERS ==========
router.get("/service-orders", async (req: Request, res: Response) => {
  try {
    const { status, storeId } = req.query;
    let query = db.select().from(serviceOrders);
    
    const conditions = [];
    if (status) conditions.push(eq(serviceOrders.status, status as string));
    if (storeId) conditions.push(eq(serviceOrders.storeId, parseInt(storeId as string)));
    
    const orders = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(serviceOrders.createdAt))
      : await query.orderBy(desc(serviceOrders.createdAt));
    
    res.json(orders);
  } catch (error) {
    console.error("Error fetching service orders:", error);
    res.status(500).json({ error: "Failed to fetch service orders" });
  }
});

router.get("/service-orders/:id", async (req: Request, res: Response) => {
  try {
    const [order] = await db.select().from(serviceOrders)
      .where(eq(serviceOrders.id, parseInt(req.params.id)));
    if (!order) return res.status(404).json({ error: "Service order not found" });
    
    const items = await db.select().from(serviceOrderItems)
      .where(eq(serviceOrderItems.serviceOrderId, order.id));
    
    res.json({ ...order, items });
  } catch (error) {
    console.error("Error fetching service order:", error);
    res.status(500).json({ error: "Failed to fetch service order" });
  }
});

router.post("/service-orders", async (req: Request, res: Response) => {
  try {
    const orderNumber = `SO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const [order] = await db.insert(serviceOrders)
      .values({ ...req.body, orderNumber })
      .returning();
    
    if (req.body.deviceId) {
      await db.update(mobileDevices)
        .set({ status: "in_service", lastServiceDate: sql`CURRENT_DATE` })
        .where(eq(mobileDevices.id, req.body.deviceId));
    }
    
    // Log activity with user context
    const user = (req as any).user;
    await logActivity({
      activityType: "service_order",
      entityType: "service_order",
      entityId: order.id,
      title: `Nova O.S. criada: ${orderNumber}`,
      description: `${req.body.brand || ''} ${req.body.model || ''} - ${req.body.customerName || 'Cliente'} - ${req.body.serviceType || 'Serviço'}`,
      severity: "info",
      storeId: req.body.storeId,
      metadata: { orderNumber, serviceType: req.body.serviceType },
      tenantId: user?.tenantId,
      createdBy: user?.id,
      createdByName: user?.name || user?.username
    });
    
    res.json(order);
  } catch (error) {
    console.error("Error creating service order:", error);
    res.status(500).json({ error: "Failed to create service order" });
  }
});

router.put("/service-orders/:id", async (req: Request, res: Response) => {
  try {
    const partsCost = String(parseFloat(req.body.partsCost || 0));
    const laborCost = String(parseFloat(req.body.laborCost || 0));
    const totalCost = String(parseFloat(partsCost) + parseFloat(laborCost));
    
    const updatePayload: any = { ...req.body, partsCost, laborCost, totalCost, updatedAt: sql`CURRENT_TIMESTAMP` };
    if (req.body.checklistCompletedBy) {
      updatePayload.checklistCompletedAt = sql`CURRENT_TIMESTAMP`;
    }
    const [order] = await db.update(serviceOrders)
      .set(updatePayload)
      .where(eq(serviceOrders.id, parseInt(req.params.id)))
      .returning();
    
    // Auto-deduct parts from stock when OS is completed (RN-02)
    if (req.body.status === "completed" || req.body.status === "ready_pickup") {
      const items = await db.select().from(serviceOrderItems)
        .where(and(
          eq(serviceOrderItems.serviceOrderId, order.id),
          eq(serviceOrderItems.itemType, "part"),
          eq(serviceOrderItems.status, "pending")
        ));
      for (const item of items) {
        if (item.itemCode) {
          const [product] = await db.select().from(products)
            .where(eq(products.code, item.itemCode));
          if (product) {
            const newQty = Math.max(0, parseFloat(product.stockQty as string || "0") - (item.quantity || 1));
            await db.update(products)
              .set({ stockQty: String(newQty) })
              .where(eq(products.id, product.id));
          }
        }
        await db.update(serviceOrderItems)
          .set({ status: "applied" })
          .where(eq(serviceOrderItems.id, item.id));
      }
      // Auto-create warranty when OS is completed
      if (req.body.status === "completed" && order.imei) {
        const warrantyDays = order.serviceType === "repair" ? 90 : order.serviceType === "maintenance" ? 30 : 60;
        const startDate = new Date().toISOString().split('T')[0];
        const endDateObj = new Date();
        endDateObj.setDate(endDateObj.getDate() + warrantyDays);
        await db.insert(serviceWarranties).values({
          tenantId: order.tenantId,
          storeId: order.storeId,
          serviceOrderId: order.id,
          deviceId: order.deviceId,
          imei: order.imei,
          serviceType: order.serviceType || "repair",
          warrantyDays,
          startDate,
          endDate: endDateObj.toISOString().split('T')[0],
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          description: `Garantia automática - OS ${order.orderNumber}`
        });
      }
    }

    // Se a OS é de Trade-In e tem uma avaliação vinculada, atualizar o status da avaliação também
    if (order.isInternal && order.sourceEvaluationId && req.body.evaluationStatus) {
      const evaluationStatusMap: Record<string, string> = {
        "pending": "pending",
        "in_analysis": "pending", // Em análise ainda é pendente na avaliação
        "approved": "approved",
        "rejected": "rejected"
      };
      
      const newEvalStatus = evaluationStatusMap[req.body.evaluationStatus];
      if (newEvalStatus) {
        await db.update(deviceEvaluations)
          .set({ 
            status: newEvalStatus,
            estimatedValue: req.body.evaluatedValue || req.body.estimatedValue,
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(deviceEvaluations.id, order.sourceEvaluationId));
      }
    }
    
    res.json(order);
  } catch (error) {
    console.error("Error updating service order:", error);
    res.status(500).json({ error: "Failed to update service order" });
  }
});

// Concluir O.S. de preparação interna - liberar dispositivo para estoque
router.put("/service-orders/:id/complete-preparation", async (req: Request, res: Response) => {
  try {
    const { sellingPrice, notes } = req.body;
    
    // Validar sellingPrice se fornecido
    if (sellingPrice !== undefined && sellingPrice !== null && sellingPrice !== '') {
      const price = parseFloat(sellingPrice);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ error: "Preço de venda inválido" });
      }
    }
    
    const [order] = await db.select().from(serviceOrders)
      .where(eq(serviceOrders.id, parseInt(req.params.id)));
    
    if (!order) return res.status(404).json({ error: "Service order not found" });
    if (!order.isInternal) return res.status(400).json({ error: "Esta O.S. não é interna" });
    
    // Atualizar O.S. como concluída
    const [updatedOrder] = await db.update(serviceOrders)
      .set({ 
        status: "completed",
        actualCompletionDate: sql`CURRENT_DATE`,
        diagnosisNotes: notes || order.diagnosisNotes,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(serviceOrders.id, parseInt(req.params.id)))
      .returning();
    
    // Liberar dispositivo para estoque
    if (order.deviceId) {
      const updateData: any = {
        status: "in_stock",
        notes: notes || undefined,
        updatedAt: sql`CURRENT_TIMESTAMP`
      };
      
      if (sellingPrice) {
        updateData.sellingPrice = sellingPrice;
      }
      
      await db.update(mobileDevices)
        .set(updateData)
        .where(eq(mobileDevices.id, order.deviceId));
      
      // Registrar histórico
      const [device] = await db.select().from(mobileDevices)
        .where(eq(mobileDevices.id, order.deviceId));
      
      if (device) {
        await db.insert(deviceHistory).values({
          deviceId: device.id,
          imei: device.imei,
          eventType: "preparation_complete",
          fromLocation: "Preparação Trade-In",
          toLocation: `Estoque - Loja ${order.storeId || 1}`,
          referenceType: "service_order",
          referenceId: order.id,
          notes: `Preparação concluída. Dispositivo liberado para venda.`,
          createdBy: (req as any).user?.id
        });
      }
    }
    
    res.json({ order: updatedOrder, message: "Preparação concluída. Dispositivo liberado para estoque." });
  } catch (error) {
    console.error("Error completing preparation:", error);
    res.status(500).json({ error: "Failed to complete preparation" });
  }
});

router.post("/service-orders/:id/items", async (req: Request, res: Response) => {
  try {
    const quantity = parseInt(req.body.quantity || 1);
    const unitPrice = parseFloat(req.body.unitPrice);
    const totalPrice = quantity * unitPrice;
    
    const [item] = await db.insert(serviceOrderItems).values({
      ...req.body,
      serviceOrderId: parseInt(req.params.id),
      quantity,
      unitPrice,
      totalPrice
    }).returning();
    
    const items = await db.select().from(serviceOrderItems)
      .where(eq(serviceOrderItems.serviceOrderId, parseInt(req.params.id)));
    const partsCost = items.filter(i => i.itemType === 'part').reduce((sum, i) => sum + parseFloat(i.totalPrice as any), 0);
    const laborCost = items.filter(i => i.itemType === 'labor').reduce((sum, i) => sum + parseFloat(i.totalPrice as any), 0);
    
    await db.update(serviceOrders)
      .set({ partsCost: String(partsCost), laborCost: String(laborCost), totalCost: String(partsCost + laborCost), updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(serviceOrders.id, parseInt(req.params.id)));
    
    res.json(item);
  } catch (error) {
    console.error("Error adding service order item:", error);
    res.status(500).json({ error: "Failed to add item" });
  }
});

router.get("/service-orders/:id/items", async (req: Request, res: Response) => {
  try {
    const items = await db.select().from(serviceOrderItems)
      .where(eq(serviceOrderItems.serviceOrderId, parseInt(req.params.id)))
      .orderBy(desc(serviceOrderItems.createdAt));
    res.json(items);
  } catch (error) {
    console.error("Error fetching service order items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

router.delete("/service-orders/:id/items/:itemId", async (req: Request, res: Response) => {
  try {
    const serviceOrderId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    
    await db.delete(serviceOrderItems).where(
      and(
        eq(serviceOrderItems.id, itemId),
        eq(serviceOrderItems.serviceOrderId, serviceOrderId)
      )
    );
    
    const items = await db.select().from(serviceOrderItems)
      .where(eq(serviceOrderItems.serviceOrderId, serviceOrderId));
    const partsCost = items.filter(i => i.itemType === 'part').reduce((sum, i) => sum + parseFloat(i.totalPrice as any), 0);
    const laborCost = items.filter(i => i.itemType === 'labor').reduce((sum, i) => sum + parseFloat(i.totalPrice as any), 0);
    
    await db.update(serviceOrders)
      .set({ partsCost: String(partsCost), laborCost: String(laborCost), totalCost: String(partsCost + laborCost), updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(serviceOrders.id, serviceOrderId));
    
    res.json({ success: true, items });
  } catch (error) {
    console.error("Error removing service order item:", error);
    res.status(500).json({ error: "Failed to remove item" });
  }
});

// ========== POS SESSIONS ==========
router.get("/pos-sessions", async (req: Request, res: Response) => {
  try {
    const { storeId, status } = req.query;
    let query = db.select().from(posSessions);
    
    const conditions = [];
    if (storeId) conditions.push(eq(posSessions.storeId, parseInt(storeId as string)));
    if (status) conditions.push(eq(posSessions.status, status as string));
    
    const sessions = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(posSessions.createdAt))
      : await query.orderBy(desc(posSessions.createdAt));
    
    res.json(sessions);
  } catch (error) {
    console.error("Error fetching POS sessions:", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.post("/pos-sessions/open", async (req: Request, res: Response) => {
  try {
    const existingOpen = await db.select().from(posSessions)
      .where(and(
        eq(posSessions.storeId, req.body.storeId),
        eq(posSessions.cashierId, req.body.cashierId),
        eq(posSessions.status, "open")
      ));
    
    if (existingOpen.length > 0) {
      return res.json(existingOpen[0]);
    }
    
    const [session] = await db.insert(posSessions).values({
      ...req.body,
      cashierName: (req as any).user?.name || req.body.cashierName
    }).returning();
    res.json(session);
  } catch (error) {
    console.error("Error opening POS session:", error);
    res.status(500).json({ error: "Failed to open session" });
  }
});

router.put("/pos-sessions/:id/close", async (req: Request, res: Response) => {
  try {
    const sales = await db.select().from(posSales)
      .where(eq(posSales.sessionId, parseInt(req.params.id)));
    
    const totalSales = sales.filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + parseFloat(s.totalAmount as any), 0);
    const totalRefunds = sales.filter(s => s.status === 'refunded')
      .reduce((sum, s) => sum + parseFloat(s.totalAmount as any), 0);
    
    const [session] = await db.update(posSessions)
      .set({
        sessionEndTime: sql`CURRENT_TIMESTAMP`,
        closingBalance: req.body.closingBalance,
        totalSales: String(totalSales),
        totalRefunds: String(totalRefunds),
        netSales: String(totalSales - totalRefunds),
        transactionCount: sales.length,
        status: "closed"
      })
      .where(eq(posSessions.id, parseInt(req.params.id)))
      .returning();
    
    res.json(session);
  } catch (error) {
    console.error("Error closing POS session:", error);
    res.status(500).json({ error: "Failed to close session" });
  }
});

// ========== CASH MOVEMENTS (Sangria/Reforço) ==========
router.get("/cash-movements", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const tenantId = (req.user as any)?.tenantId;
    const conditions = [];
    if (sessionId) conditions.push(eq(posCashMovements.sessionId, parseInt(sessionId as string)));
    if (tenantId) conditions.push(eq(posCashMovements.tenantId, tenantId));
    const movements = conditions.length > 0
      ? await db.select().from(posCashMovements).where(and(...conditions)).orderBy(desc(posCashMovements.createdAt))
      : await db.select().from(posCashMovements).orderBy(desc(posCashMovements.createdAt));
    res.json(movements);
  } catch (error) {
    console.error("Error fetching cash movements:", error);
    res.status(500).json({ error: "Failed to fetch cash movements" });
  }
});

router.post("/cash-movements", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const [movement] = await db.insert(posCashMovements).values({
      ...req.body,
      performedBy: user?.id,
      performedByName: user?.name || user?.username,
      tenantId: user?.tenantId
    }).returning();
    res.json(movement);
  } catch (error) {
    console.error("Error creating cash movement:", error);
    res.status(500).json({ error: "Failed to create cash movement" });
  }
});

// ========== SERVICE WARRANTIES ==========
router.get("/warranties", async (req: Request, res: Response) => {
  try {
    const { imei, status, serviceOrderId } = req.query;
    const tenantId = (req.user as any)?.tenantId;
    const conditions = [];
    if (tenantId) conditions.push(eq(serviceWarranties.tenantId, tenantId));
    if (imei) conditions.push(eq(serviceWarranties.imei, imei as string));
    if (status) conditions.push(eq(serviceWarranties.status, status as string));
    if (serviceOrderId) conditions.push(eq(serviceWarranties.serviceOrderId, parseInt(serviceOrderId as string)));
    const warranties = conditions.length > 0
      ? await db.select().from(serviceWarranties).where(and(...conditions)).orderBy(desc(serviceWarranties.createdAt))
      : await db.select().from(serviceWarranties).orderBy(desc(serviceWarranties.createdAt));
    res.json(warranties);
  } catch (error) {
    console.error("Error fetching warranties:", error);
    res.status(500).json({ error: "Failed to fetch warranties" });
  }
});

router.post("/warranties", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const startDate = req.body.startDate || new Date().toISOString().split('T')[0];
    const warrantyDays = parseInt(req.body.warrantyDays || 90);
    const endDateObj = new Date(startDate);
    endDateObj.setDate(endDateObj.getDate() + warrantyDays);
    const endDate = endDateObj.toISOString().split('T')[0];
    
    const [warranty] = await db.insert(serviceWarranties).values({
      ...req.body,
      startDate,
      endDate,
      warrantyDays,
      tenantId: user?.tenantId
    }).returning();
    res.json(warranty);
  } catch (error) {
    console.error("Error creating warranty:", error);
    res.status(500).json({ error: "Failed to create warranty" });
  }
});

router.get("/warranties/check/:imei", async (req: Request, res: Response) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const today = new Date().toISOString().split('T')[0];
    const conditions = [
      eq(serviceWarranties.imei, req.params.imei),
      eq(serviceWarranties.status, "active"),
      gte(serviceWarranties.endDate, today)
    ];
    if (tenantId) conditions.push(eq(serviceWarranties.tenantId, tenantId));
    const warranties = await db.select().from(serviceWarranties)
      .where(and(...conditions))
      .orderBy(desc(serviceWarranties.endDate));
    res.json({ hasActiveWarranty: warranties.length > 0, warranties });
  } catch (error) {
    console.error("Error checking warranty:", error);
    res.status(500).json({ error: "Failed to check warranty" });
  }
});

router.put("/warranties/:id/claim", async (req: Request, res: Response) => {
  try {
    const [warranty] = await db.update(serviceWarranties)
      .set({ status: "claimed", claimedAt: sql`CURRENT_TIMESTAMP`, claimNotes: req.body.notes })
      .where(eq(serviceWarranties.id, parseInt(req.params.id)))
      .returning();
    res.json(warranty);
  } catch (error) {
    console.error("Error claiming warranty:", error);
    res.status(500).json({ error: "Failed to claim warranty" });
  }
});

// ========== STOCK ALERTS ==========
router.get("/stock-alerts", async (req: Request, res: Response) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const conditions = [
      eq(products.status, "active"),
      sql`CAST(${products.stockQty} AS NUMERIC) <= CAST(${products.minStock} AS NUMERIC)`,
      sql`CAST(${products.minStock} AS NUMERIC) > 0`
    ];
    if (tenantId) conditions.push(eq(products.tenantId, tenantId));
    const lowStockProducts = await db.select().from(products)
      .where(and(...conditions))
      .orderBy(asc(products.name));
    res.json(lowStockProducts);
  } catch (error) {
    console.error("Error fetching stock alerts:", error);
    res.status(500).json({ error: "Failed to fetch stock alerts" });
  }
});

// ========== REPORTS ==========
router.get("/reports/os-by-status", async (req: Request, res: Response) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    if (!tenantId) return res.status(403).json({ error: "Tenant not identified" });
    const result = await db.execute(sql`
      SELECT status, COUNT(*) as count,
        COALESCE(SUM(CAST(total_cost AS NUMERIC)), 0) as total_value
      FROM service_orders WHERE tenant_id = ${tenantId}
      GROUP BY status ORDER BY count DESC
    `);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching OS report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

router.get("/reports/os-by-technician", async (req: Request, res: Response) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    if (!tenantId) return res.status(403).json({ error: "Tenant not identified" });
    const result = await db.execute(sql`
      SELECT technician_name, 
        COUNT(*) as total_os,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status IN ('open','diagnosis','in_repair')) as in_progress,
        COALESCE(SUM(CAST(total_cost AS NUMERIC)) FILTER (WHERE status = 'completed'), 0) as total_revenue
      FROM service_orders
      WHERE technician_name IS NOT NULL AND tenant_id = ${tenantId}
      GROUP BY technician_name ORDER BY total_os DESC
    `);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching technician report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

router.get("/reports/sales-by-seller", async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const tenantId = (req.user as any)?.tenantId;
    if (!tenantId) return res.status(403).json({ error: "Tenant not identified" });
    let dateFilter = sql`TRUE`;
    if (dateFrom && dateTo) {
      dateFilter = sql`created_at >= ${dateFrom}::date AND created_at <= (${dateTo}::date + INTERVAL '1 day')`;
    } else {
      dateFilter = sql`DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days'`;
    }
    const tenantFilter = sql`AND tenant_id = ${tenantId}`;
    const result = await db.execute(sql`
      SELECT sold_by,
        COUNT(*) as total_sales,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as total_revenue,
        COALESCE(AVG(CAST(total_amount AS NUMERIC)), 0) as avg_ticket,
        COUNT(DISTINCT DATE(created_at)) as active_days
      FROM pos_sales
      WHERE status = 'completed' AND ${dateFilter} ${tenantFilter}
      GROUP BY sold_by ORDER BY total_revenue DESC
    `);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching sales report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

router.get("/reports/margin-by-imei", async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT d.id, d.brand, d.model, d.imei, d.condition,
        CAST(d.purchase_price AS NUMERIC) as cost,
        CAST(d.selling_price AS NUMERIC) as sale_price,
        CAST(d.selling_price AS NUMERIC) - CAST(d.purchase_price AS NUMERIC) as margin,
        CASE WHEN CAST(d.purchase_price AS NUMERIC) > 0 
          THEN ROUND(((CAST(d.selling_price AS NUMERIC) - CAST(d.purchase_price AS NUMERIC)) / CAST(d.purchase_price AS NUMERIC)) * 100, 2)
          ELSE 0 END as margin_percent,
        d.status
      FROM mobile_devices d
      WHERE d.purchase_price IS NOT NULL AND CAST(d.purchase_price AS NUMERIC) > 0
      ORDER BY margin DESC
    `);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching margin report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

router.get("/reports/daily-cash", async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const tenantId = (req.user as any)?.tenantId;
    if (!tenantId) return res.status(403).json({ error: "Tenant not identified" });
    const targetDate = date ? String(date) : new Date().toISOString().split('T')[0];
    const tenantFilter = sql`AND tenant_id = ${tenantId}`;
    
    const summaryResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as total_sales,
        COUNT(*) as sale_count,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE payment_method = 'cash'), 0) as cash_total,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE payment_method IN ('credit','debit')), 0) as card_total,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE payment_method = 'pix'), 0) as pix_total,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE payment_method = 'combined'), 0) as combined_total
      FROM pos_sales 
      WHERE status = 'completed' AND DATE(created_at) = ${targetDate}::date ${tenantFilter}
    `);
    
    const movementsResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(amount AS NUMERIC)) FILTER (WHERE type = 'withdrawal'), 0) as withdrawals,
        COALESCE(SUM(CAST(amount AS NUMERIC)) FILTER (WHERE type = 'reinforcement'), 0) as reinforcements
      FROM pos_cash_movements 
      WHERE DATE(created_at) = ${targetDate}::date ${tenantFilter}
    `);
    
    const salesResult = await db.execute(sql`
      SELECT id, sale_number, customer_name, total_amount, payment_method, sold_by, 
        discount_amount, subtotal, created_at, notes
      FROM pos_sales 
      WHERE status = 'completed' AND DATE(created_at) = ${targetDate}::date ${tenantFilter}
      ORDER BY created_at DESC
    `);
    
    const bySellerResult = await db.execute(sql`
      SELECT 
        sold_by,
        COUNT(*) as sale_count,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as total,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE payment_method = 'cash'), 0) as cash_total,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE payment_method IN ('credit','debit')), 0) as card_total,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE payment_method = 'credit'), 0) as credit_total,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE payment_method = 'debit'), 0) as debit_total,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE payment_method = 'pix'), 0) as pix_total,
        COALESCE(SUM(CAST(total_amount AS NUMERIC)) FILTER (WHERE payment_method = 'combined'), 0) as combined_total,
        COALESCE(SUM(CAST(discount_amount AS NUMERIC)), 0) as total_discount
      FROM pos_sales 
      WHERE status = 'completed' AND DATE(created_at) = ${targetDate}::date ${tenantFilter}
      GROUP BY sold_by
      ORDER BY total DESC
    `);
    
    const summary = (summaryResult.rows as any[])?.[0] || {};
    const movements = (movementsResult.rows as any[])?.[0] || {};
    
    res.json({
      ...summary,
      withdrawals: movements.withdrawals || 0,
      reinforcements: movements.reinforcements || 0,
      sales: salesResult.rows || [],
      bySeller: bySellerResult.rows || [],
      date: targetDate
    });
  } catch (error) {
    console.error("Error fetching daily cash report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

router.get("/reports/stock-turnover", async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT p.id, p.code, p.name, p.category,
        CAST(p.stock_qty AS NUMERIC) as current_stock,
        CAST(p.min_stock AS NUMERIC) as min_stock,
        COALESCE((SELECT COUNT(*) FROM pos_sale_items psi WHERE psi.item_code = p.code AND psi.created_at >= CURRENT_DATE - INTERVAL '30 days'), 0) as sales_30d,
        CASE WHEN CAST(p.stock_qty AS NUMERIC) > 0 
          THEN ROUND(COALESCE((SELECT COUNT(*) FROM pos_sale_items psi WHERE psi.item_code = p.code AND psi.created_at >= CURRENT_DATE - INTERVAL '30 days'), 0)::numeric / CAST(p.stock_qty AS NUMERIC), 2)
          ELSE 0 END as turnover_ratio
      FROM products p
      WHERE p.status = 'active'
      ORDER BY turnover_ratio DESC
      LIMIT 50
    `);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching stock turnover:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// ========== POS SALES ==========
router.get("/sales", async (req: Request, res: Response) => {
  try {
    const { sessionId, storeId, detailed, limit: limitParam, dateFrom, dateTo, soldBy } = req.query;
    let query = db.select().from(posSales);
    
    const conditions = [];
    if (sessionId) conditions.push(eq(posSales.sessionId, parseInt(sessionId as string)));
    if (storeId) conditions.push(eq(posSales.storeId, parseInt(storeId as string)));
    if (soldBy) conditions.push(eq(posSales.soldBy, soldBy as string));
    if (dateFrom) conditions.push(gte(posSales.createdAt, new Date(dateFrom as string)));
    if (dateTo) {
      const endDate = new Date(dateTo as string);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(posSales.createdAt, endDate));
    }
    
    let sales = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(posSales.createdAt)).limit(parseInt(limitParam as string) || 100)
      : await query.orderBy(desc(posSales.createdAt)).limit(parseInt(limitParam as string) || 100);
    
    // Se detailed=true, incluir contagem de itens e formas de pagamento
    if (detailed === "true") {
      const salesWithDetails = await Promise.all(sales.map(async (sale) => {
        // Buscar itens da venda
        const items = await db.select().from(posSaleItems).where(eq(posSaleItems.saleId, sale.id));
        const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        // Parse payment details para extrair métodos de pagamento
        const paymentMethods = sale.paymentDetails || [];
        
        // Buscar crédito usado (se existir no paymentDetails ou tradeInValue)
        const creditUsed = parseFloat(sale.tradeInValue || "0") + (
          Array.isArray(sale.paymentDetails) 
            ? sale.paymentDetails.reduce((sum: number, pd: any) => pd.method === "credit" ? sum + parseFloat(pd.amount || "0") : sum, 0)
            : 0
        );
        
        return {
          ...sale,
          itemCount,
          paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : [],
          creditUsed: creditUsed.toString(),
          sellerId: sale.soldBy ? parseInt(sale.soldBy) : null
        };
      }));
      
      return res.json({ sales: salesWithDetails });
    }
    
    res.json(sales);
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

router.post("/sales", async (req: Request, res: Response) => {
  try {
    console.log("[SALES] Recebendo requisição de venda:", JSON.stringify(req.body, null, 2));
    const saleNumber = `VD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { items, creditUsed, useCredits, personId, paymentMethods, subtotal, ...saleData } = req.body;
    
    // Validação server-side: verificar totais
    const subtotalAmount = parseFloat(subtotal || "0");
    const totalAmount = parseFloat(saleData.totalAmount || "0");
    const creditUsedAmount = parseFloat(creditUsed || "0");
    const discountAmount = parseFloat(saleData.discountAmount || "0");
    const tradeInValue = parseFloat(saleData.tradeInValue || "0");
    
    if (totalAmount < 0) {
      return res.status(400).json({ error: "Total da venda não pode ser negativo" });
    }
    
    // Calcular baseTotal dos itens
    const itemsTotal = items?.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.unitPrice || "0") * (item.quantity || 1));
    }, 0) || 0;
    const baseTotal = itemsTotal - discountAmount;
    
    // Validar: créditos não podem exceder o valor base da venda
    const totalCreditsUsed = tradeInValue + creditUsedAmount;
    if (totalCreditsUsed > baseTotal) {
      return res.status(400).json({ error: "Créditos excedem o valor da compra" });
    }
    
    // Validar consistência: totalAmount deve ser baseTotal - tradeInValue - creditUsed
    const expectedTotal = Math.max(0, baseTotal - totalCreditsUsed);
    if (Math.abs(totalAmount - expectedTotal) > 0.01) {
      console.log("[SALES] Inconsistência:", { totalAmount, expectedTotal, baseTotal, tradeInValue, creditUsedAmount });
      return res.status(400).json({ error: "Inconsistência nos valores da venda" });
    }
    
    // Verificar se há créditos suficientes para o cliente (tradeIn + creditUsed)
    // O tradeInValue também consome créditos da tabela customerCredits
    const totalCreditToConsume = tradeInValue + creditUsedAmount;
    if (totalCreditToConsume > 0 && personId) {
      const personCredits = await db.select().from(customerCredits)
        .where(and(
          eq(customerCredits.personId, parseInt(personId)),
          eq(customerCredits.status, "active")
        ));
      const availableCredit = personCredits.reduce((sum, c) => sum + parseFloat(c.remainingAmount || "0"), 0);
      
      if (totalCreditToConsume > availableCredit) {
        return res.status(400).json({ 
          error: `Crédito insuficiente. Disponível: R$ ${availableCredit.toFixed(2)}, Solicitado: R$ ${totalCreditToConsume.toFixed(2)}` 
        });
      }
    }
    
    // Executar tudo em uma transação para garantir atomicidade
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx.insert(posSales)
        .values({ 
          ...saleData, 
          subtotal: String(subtotalAmount),
          saleNumber, 
          soldBy: (req as any).user?.id 
        })
        .returning();
      
      // Processar uso de créditos atomicamente com a venda
      // Inclui tanto tradeInValue quanto creditUsed para evitar uso duplo
      const totalCreditToConsume = tradeInValue + creditUsedAmount;
      if (totalCreditToConsume > 0 && personId) {
        const personCredits = await tx.select().from(customerCredits)
          .where(and(
            eq(customerCredits.personId, parseInt(personId)),
            eq(customerCredits.status, "active")
          ))
          .orderBy(asc(customerCredits.createdAt)); // FIFO
        
        let remainingToUse = totalCreditToConsume;
        for (const credit of personCredits) {
          if (remainingToUse <= 0) break;
          const creditRemaining = parseFloat(credit.remainingAmount || "0");
          const toUse = Math.min(remainingToUse, creditRemaining);
          
          if (toUse > 0) {
            const newRemaining = creditRemaining - toUse;
            const newUsed = parseFloat(credit.usedAmount || "0") + toUse;
            
            await tx.update(customerCredits)
              .set({
                usedAmount: newUsed.toFixed(2),
                remainingAmount: newRemaining.toFixed(2),
                status: newRemaining <= 0 ? "used" : "active",
                usedInSaleId: sale.id,
                updatedAt: new Date()
              })
              .where(eq(customerCredits.id, credit.id));
            
            remainingToUse -= toUse;
          }
        }
      }
      
      if (items && items.length > 0) {
        for (const item of items) {
          await tx.insert(posSaleItems).values({
            ...item,
            saleId: sale.id
          });
          
          if (item.deviceId) {
            await tx.update(mobileDevices)
              .set({ 
                status: "sold", 
                soldDate: sql`CURRENT_DATE`,
                soldToCustomer: saleData.customerId
              })
              .where(eq(mobileDevices.id, item.deviceId));
            
            await tx.insert(deviceHistory).values({
              deviceId: item.deviceId,
              imei: item.imei,
              eventType: "sold",
              fromLocation: `Store ${saleData.storeId}`,
              toLocation: saleData.customerName || "Customer",
              referenceType: "sale",
              referenceId: sale.id,
              createdBy: (req as any).user?.id
            });
          }
        }
      }
      
      // Só atualiza sessão se existir
      if (sale.sessionId) {
        await tx.update(posSessions)
          .set({ 
            transactionCount: sql`transaction_count + 1`,
            totalSales: sql`total_sales + ${sale.totalAmount}`
          })
          .where(eq(posSessions.id, sale.sessionId));
      }
      
      // Gerar contas a receber por método de pagamento
      const paymentMethodLabels: Record<string, string> = {
        cash: "Dinheiro",
        credit_card: "Cartão de Crédito",
        debit_card: "Cartão de Débito",
        pix: "PIX",
        customer_credit: "Crédito Cliente"
      };
      
      if (paymentMethods && paymentMethods.length > 0) {
        for (const pm of paymentMethods) {
          if (pm.amount > 0) {
            const docNumber = `${sale.saleNumber}-${pm.method.toUpperCase()}`;
            const dueDate = pm.method === "credit_card" ? 
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : // 30 dias para crédito
              new Date(); // Imediato para outros
            
            await tx.insert(finAccountsReceivable).values({
              tenantId: (req as any).user?.tenantId || 1,
              documentNumber: docNumber,
              customerId: personId ? parseInt(personId) : null,
              customerName: saleData.customerName || "Cliente PDV",
              description: `Venda PDV ${sale.saleNumber} - ${paymentMethodLabels[pm.method] || pm.method}`,
              issueDate: sql`CURRENT_DATE`,
              dueDate: sql`${dueDate.toISOString().split('T')[0]}::date`,
              originalAmount: String(pm.amount),
              discountAmount: "0",
              interestAmount: "0",
              fineAmount: "0",
              receivedAmount: pm.method === "cash" || pm.method === "pix" || pm.method === "debit_card" ? String(pm.amount) : "0",
              remainingAmount: pm.method === "credit_card" ? String(pm.amount) : "0",
              status: pm.method === "credit_card" ? "pending" : "received",
              receivedAt: pm.method !== "credit_card" ? sql`NOW()` : null,
              salesOrderId: sale.id,
              notes: `Origem: PDV - Método: ${paymentMethodLabels[pm.method] || pm.method}`
            });
          }
        }
      }
      
      return sale;
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error creating sale:", error);
    res.status(500).json({ error: "Failed to create sale" });
  }
});

// ========== STOCK TRANSFERS ==========
router.get("/transfers", async (req: Request, res: Response) => {
  try {
    const transfers = await db.select().from(stockTransfers)
      .orderBy(desc(stockTransfers.createdAt));
    res.json(transfers);
  } catch (error) {
    console.error("Error fetching transfers:", error);
    res.status(500).json({ error: "Failed to fetch transfers" });
  }
});

router.post("/transfers", async (req: Request, res: Response) => {
  try {
    const transferNumber = `TR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { items, ...transferData } = req.body;
    
    const [transfer] = await db.insert(stockTransfers)
      .values({ ...transferData, transferNumber, totalItems: items?.length || 0 })
      .returning();
    
    if (items && items.length > 0) {
      for (const item of items) {
        await db.insert(stockTransferItems).values({
          transferId: transfer.id,
          deviceId: item.deviceId,
          imei: item.imei
        });
      }
    }
    
    res.json(transfer);
  } catch (error) {
    console.error("Error creating transfer:", error);
    res.status(500).json({ error: "Failed to create transfer" });
  }
});

router.put("/transfers/:id/approve", async (req: Request, res: Response) => {
  try {
    const [transfer] = await db.update(stockTransfers)
      .set({ status: "approved", approvedBy: (req as any).user?.id, updatedAt: new Date() })
      .where(eq(stockTransfers.id, parseInt(req.params.id)))
      .returning();
    res.json(transfer);
  } catch (error) {
    console.error("Error approving transfer:", error);
    res.status(500).json({ error: "Failed to approve transfer" });
  }
});

router.put("/transfers/:id/receive", async (req: Request, res: Response) => {
  try {
    const [transfer] = await db.select().from(stockTransfers)
      .where(eq(stockTransfers.id, parseInt(req.params.id)));
    
    const items = await db.select().from(stockTransferItems)
      .where(eq(stockTransferItems.transferId, parseInt(req.params.id)));
    
    for (const item of items) {
      await db.update(mobileDevices)
        .set({ 
          storeId: transfer.toStoreId,
          warehouseId: transfer.toWarehouseId,
          updatedAt: new Date()
        })
        .where(eq(mobileDevices.id, item.deviceId));
      
      await db.update(stockTransferItems)
        .set({ status: "received" })
        .where(eq(stockTransferItems.id, item.id));
      
      await db.insert(deviceHistory).values({
        deviceId: item.deviceId,
        imei: item.imei,
        eventType: "transferred",
        fromLocation: transfer.fromStoreId ? `Store ${transfer.fromStoreId}` : `Warehouse ${transfer.fromWarehouseId}`,
        toLocation: transfer.toStoreId ? `Store ${transfer.toStoreId}` : `Warehouse ${transfer.toWarehouseId}`,
        referenceType: "transfer",
        referenceId: transfer.id,
        createdBy: (req as any).user?.id
      });
    }
    
    const [updated] = await db.update(stockTransfers)
      .set({ 
        status: "received", 
        receivedDate: sql`CURRENT_DATE`,
        receivedBy: (req as any).user?.id,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(stockTransfers.id, parseInt(req.params.id)))
      .returning();
    
    res.json(updated);
  } catch (error) {
    console.error("Error receiving transfer:", error);
    res.status(500).json({ error: "Failed to receive transfer" });
  }
});

// ========== PDV PRODUCTS ==========
router.get("/pdv-products", async (req: Request, res: Response) => {
  try {
    const tenantId = (req.user as any)?.tenantId;
    const conditions = [
      eq(products.status, "active"),
      or(
        eq(products.trackingType, "none"),
        isNull(products.trackingType)
      )
    ];
    if (tenantId) {
      conditions.push(eq(products.tenantId, tenantId));
    }
    const allProducts = await db.select().from(products)
      .where(and(...conditions))
      .orderBy(asc(products.name));
    res.json(allProducts);
  } catch (error) {
    console.error("Error fetching PDV products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ========== DASHBOARD STATS ==========
router.get("/dashboard/stats", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    
    const devicesInStock = await db.select({ count: sql<number>`count(*)` })
      .from(mobileDevices)
      .where(eq(mobileDevices.status, "in_stock"));
    
    const openOrders = await db.select({ count: sql<number>`count(*)` })
      .from(serviceOrders)
      .where(or(eq(serviceOrders.status, "open"), eq(serviceOrders.status, "in_progress")));
    
    const todaySales = await db.select({ 
      total: sql<number>`COALESCE(SUM(total_amount), 0)`,
      count: sql<number>`count(*)`
    }).from(posSales)
      .where(sql`DATE(created_at) = CURRENT_DATE`);
    
    const pendingEvaluations = await db.select({ count: sql<number>`count(*)` })
      .from(deviceEvaluations)
      .where(eq(deviceEvaluations.status, "pending"));
    
    res.json({
      devicesInStock: devicesInStock[0]?.count || 0,
      openServiceOrders: openOrders[0]?.count || 0,
      todaySalesTotal: todaySales[0]?.total || 0,
      todaySalesCount: todaySales[0]?.count || 0,
      pendingEvaluations: pendingEvaluations[0]?.count || 0
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Helper function for trade-in value calculation
function calculateTradeInValue(evaluation: any): number {
  const baseValues: Record<string, number> = {
    "iPhone 15 Pro Max": 6000,
    "iPhone 15 Pro": 5500,
    "iPhone 15": 4500,
    "iPhone 14 Pro Max": 5000,
    "iPhone 14 Pro": 4500,
    "iPhone 14": 3500,
    "iPhone 13 Pro Max": 4000,
    "iPhone 13 Pro": 3500,
    "iPhone 13": 2800,
    "iPhone 12": 2000,
    "iPhone 11": 1500,
    "Galaxy S24 Ultra": 5500,
    "Galaxy S24+": 4500,
    "Galaxy S24": 3800,
    "Galaxy S23 Ultra": 4500,
    "Galaxy S23": 3000,
    "Galaxy S22": 2200,
    "Galaxy S21": 1800
  };
  
  const modelKey = `${evaluation.brand} ${evaluation.model}`.replace(/\s+/g, " ");
  let baseValue = baseValues[modelKey] || 1000;
  
  const conditionMultiplier: Record<string, number> = {
    excellent: 0.85,
    good: 0.70,
    fair: 0.50,
    poor: 0.30
  };
  
  let value = baseValue * (conditionMultiplier[evaluation.overallCondition] || 0.5);
  
  if (evaluation.screenCondition === "broken") value *= 0.5;
  if (evaluation.screenCondition === "cracks") value *= 0.7;
  if (evaluation.batteryHealth && evaluation.batteryHealth < 80) {
    value *= (evaluation.batteryHealth / 100);
  }
  if (evaluation.waterDamageDetected) value *= 0.3;
  if (!evaluation.chargerIncluded) value *= 0.95;
  
  return Math.round(value * 100) / 100;
}

// ========== CHECKLIST TEMPLATES ==========
router.get("/checklist/templates", async (req: Request, res: Response) => {
  try {
    const templates = await db.select().from(tradeInChecklistTemplates)
      .where(eq(tradeInChecklistTemplates.isActive, true))
      .orderBy(desc(tradeInChecklistTemplates.createdAt));
    res.json(templates);
  } catch (error) {
    console.error("Error fetching checklist templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.post("/checklist/templates", async (req: Request, res: Response) => {
  try {
    const [template] = await db.insert(tradeInChecklistTemplates)
      .values(req.body)
      .returning();
    res.json(template);
  } catch (error) {
    console.error("Error creating checklist template:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.get("/checklist/templates/:id", async (req: Request, res: Response) => {
  try {
    const [template] = await db.select().from(tradeInChecklistTemplates)
      .where(eq(tradeInChecklistTemplates.id, parseInt(req.params.id)));
    if (!template) return res.status(404).json({ error: "Template not found" });
    
    const items = await db.select().from(tradeInChecklistItems)
      .where(eq(tradeInChecklistItems.templateId, template.id))
      .orderBy(asc(tradeInChecklistItems.displayOrder));
    
    res.json({ ...template, items });
  } catch (error) {
    console.error("Error fetching template:", error);
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

router.put("/checklist/templates/:id", async (req: Request, res: Response) => {
  try {
    const [template] = await db.update(tradeInChecklistTemplates)
      .set({ ...req.body, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(tradeInChecklistTemplates.id, parseInt(req.params.id)))
      .returning();
    res.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/checklist/templates/:id", async (req: Request, res: Response) => {
  try {
    await db.update(tradeInChecklistTemplates)
      .set({ isActive: false })
      .where(eq(tradeInChecklistTemplates.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// ========== CHECKLIST ITEMS ==========
router.get("/checklist/items/:templateId", async (req: Request, res: Response) => {
  try {
    const items = await db.select().from(tradeInChecklistItems)
      .where(eq(tradeInChecklistItems.templateId, parseInt(req.params.templateId)))
      .orderBy(asc(tradeInChecklistItems.displayOrder));
    res.json(items);
  } catch (error) {
    console.error("Error fetching checklist items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

router.post("/checklist/items", async (req: Request, res: Response) => {
  try {
    const [item] = await db.insert(tradeInChecklistItems)
      .values(req.body)
      .returning();
    res.json(item);
  } catch (error) {
    console.error("Error creating checklist item:", error);
    res.status(500).json({ error: "Failed to create item" });
  }
});

router.put("/checklist/items/:id", async (req: Request, res: Response) => {
  try {
    const [item] = await db.update(tradeInChecklistItems)
      .set(req.body)
      .where(eq(tradeInChecklistItems.id, parseInt(req.params.id)))
      .returning();
    res.json(item);
  } catch (error) {
    console.error("Error updating checklist item:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
});

router.delete("/checklist/items/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(tradeInChecklistItems)
      .where(eq(tradeInChecklistItems.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting checklist item:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ========== EVALUATION RESULTS ==========
router.get("/evaluations/:id/results", async (req: Request, res: Response) => {
  try {
    const results = await db.select({
      result: tradeInEvaluationResults,
      item: tradeInChecklistItems
    }).from(tradeInEvaluationResults)
      .leftJoin(tradeInChecklistItems, eq(tradeInEvaluationResults.checklistItemId, tradeInChecklistItems.id))
      .where(eq(tradeInEvaluationResults.evaluationId, parseInt(req.params.id)));
    res.json(results);
  } catch (error) {
    console.error("Error fetching evaluation results:", error);
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

router.post("/evaluations/:id/results", async (req: Request, res: Response) => {
  try {
    const evaluationId = parseInt(req.params.id);
    const { results } = req.body;
    
    // Deletar resultados anteriores
    await db.delete(tradeInEvaluationResults)
      .where(eq(tradeInEvaluationResults.evaluationId, evaluationId));
    
    // Inserir novos resultados
    for (const result of results) {
      await db.insert(tradeInEvaluationResults).values({
        evaluationId,
        checklistItemId: result.checklistItemId,
        result: result.result,
        percentValue: result.percentValue,
        notes: result.notes
      });
    }
    
    res.json({ success: true, count: results.length });
  } catch (error) {
    console.error("Error saving evaluation results:", error);
    res.status(500).json({ error: "Failed to save results" });
  }
});

// ========== TRANSFER DOCUMENTS ==========
router.get("/transfer-documents", async (req: Request, res: Response) => {
  try {
    const { evaluationId, status } = req.query;
    let query = db.select().from(tradeInTransferDocuments);
    
    const conditions = [];
    if (evaluationId) conditions.push(eq(tradeInTransferDocuments.evaluationId, parseInt(evaluationId as string)));
    if (status) conditions.push(eq(tradeInTransferDocuments.status, status as string));
    
    const docs = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(tradeInTransferDocuments.createdAt))
      : await query.orderBy(desc(tradeInTransferDocuments.createdAt));
    
    res.json(docs);
  } catch (error) {
    console.error("Error fetching transfer documents:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

router.post("/transfer-documents", async (req: Request, res: Response) => {
  try {
    const documentNumber = `TRF-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    
    const [doc] = await db.insert(tradeInTransferDocuments)
      .values({ ...req.body, documentNumber, status: "pending_signature" })
      .returning();
    
    res.json(doc);
  } catch (error) {
    console.error("Error creating transfer document:", error);
    res.status(500).json({ error: "Failed to create document" });
  }
});

router.get("/transfer-documents/:id", async (req: Request, res: Response) => {
  try {
    const [doc] = await db.select().from(tradeInTransferDocuments)
      .where(eq(tradeInTransferDocuments.id, parseInt(req.params.id)));
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(doc);
  } catch (error) {
    console.error("Error fetching transfer document:", error);
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

router.post("/transfer-documents/:id/sign", async (req: Request, res: Response) => {
  try {
    const { customerSignature, employeeSignature, employeeName, termsAccepted } = req.body;
    
    const updateData: any = { updatedAt: sql`CURRENT_TIMESTAMP` };
    
    if (customerSignature) {
      updateData.customerSignature = customerSignature;
      updateData.customerSignedAt = sql`CURRENT_TIMESTAMP`;
    }
    
    if (employeeSignature) {
      updateData.employeeSignature = employeeSignature;
      updateData.employeeName = employeeName;
      updateData.employeeSignedAt = sql`CURRENT_TIMESTAMP`;
    }
    
    if (termsAccepted !== undefined) {
      updateData.termsAccepted = termsAccepted;
    }
    
    // Se ambas assinaturas estiverem presentes, marcar como signed
    const [doc] = await db.select().from(tradeInTransferDocuments)
      .where(eq(tradeInTransferDocuments.id, parseInt(req.params.id)));
    
    if (customerSignature && (doc?.employeeSignature || employeeSignature)) {
      updateData.status = "signed";
    } else if (employeeSignature && doc?.customerSignature) {
      updateData.status = "signed";
    }
    
    const [updated] = await db.update(tradeInTransferDocuments)
      .set(updateData)
      .where(eq(tradeInTransferDocuments.id, parseInt(req.params.id)))
      .returning();
    
    res.json(updated);
  } catch (error) {
    console.error("Error signing transfer document:", error);
    res.status(500).json({ error: "Failed to sign document" });
  }
});

router.post("/transfer-documents/:id/complete", async (req: Request, res: Response) => {
  try {
    const [doc] = await db.select().from(tradeInTransferDocuments)
      .where(eq(tradeInTransferDocuments.id, parseInt(req.params.id)));
    
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!doc.customerSignature) return res.status(400).json({ error: "Customer signature required" });
    
    // Atualizar avaliação para aprovada
    await db.update(deviceEvaluations)
      .set({ status: "approved", approved: true, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(deviceEvaluations.id, doc.evaluationId));
    
    // Atualizar documento
    const [updated] = await db.update(tradeInTransferDocuments)
      .set({ status: "completed", updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(tradeInTransferDocuments.id, parseInt(req.params.id)))
      .returning();
    
    res.json(updated);
  } catch (error) {
    console.error("Error completing transfer document:", error);
    res.status(500).json({ error: "Failed to complete document" });
  }
});

// Gerar HTML do documento para impressão/PDF
router.get("/transfer-documents/:id/html", async (req: Request, res: Response) => {
  try {
    const [doc] = await db.select().from(tradeInTransferDocuments)
      .where(eq(tradeInTransferDocuments.id, parseInt(req.params.id)));
    
    if (!doc) return res.status(404).json({ error: "Document not found" });
    
    const html = generateTransferDocumentHTML(doc);
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Error generating document HTML:", error);
    res.status(500).json({ error: "Failed to generate document" });
  }
});

function generateTransferDocumentHTML(doc: any): string {
  const formatDate = (date: any) => {
    if (!date) return new Date().toLocaleDateString("pt-BR");
    return new Date(date).toLocaleDateString("pt-BR");
  };
  
  const formatCurrency = (value: any) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(value));
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termo de Transferência de Posse - ${doc.documentNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; padding: 20px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
    .header h1 { font-size: 18px; margin-bottom: 5px; }
    .header h2 { font-size: 14px; font-weight: normal; color: #666; }
    .doc-number { text-align: right; font-size: 11px; color: #666; margin-bottom: 20px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 13px; font-weight: bold; background: #f0f0f0; padding: 8px; margin-bottom: 10px; }
    .field { display: flex; margin-bottom: 8px; }
    .field-label { width: 150px; font-weight: bold; }
    .field-value { flex: 1; border-bottom: 1px dotted #ccc; padding-bottom: 2px; }
    .terms { font-size: 10px; text-align: justify; background: #fafafa; padding: 15px; border: 1px solid #ddd; margin-bottom: 20px; }
    .terms h3 { font-size: 11px; margin-bottom: 10px; }
    .terms ol { margin-left: 20px; }
    .terms li { margin-bottom: 5px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
    .signature-box { width: 45%; text-align: center; }
    .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 5px; }
    .signature-name { font-weight: bold; }
    .signature-doc { font-size: 10px; color: #666; }
    .signature-image { max-width: 200px; max-height: 80px; margin: 10px auto; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
    .value-box { background: #e8f5e9; padding: 15px; text-align: center; margin: 20px 0; border: 2px solid #4caf50; }
    .value-box .amount { font-size: 24px; font-weight: bold; color: #2e7d32; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>TERMO DE TRANSFERÊNCIA DE POSSE</h1>
    <h2>Dispositivo Móvel - Trade-In</h2>
  </div>
  
  <div class="doc-number">
    Documento Nº: <strong>${doc.documentNumber}</strong><br>
    Data: ${formatDate(doc.createdAt)}
  </div>
  
  <div class="section">
    <div class="section-title">DADOS DO CEDENTE (PROPRIETÁRIO ANTERIOR)</div>
    <div class="field">
      <span class="field-label">Nome Completo:</span>
      <span class="field-value">${doc.customerName || ""}</span>
    </div>
    <div class="field">
      <span class="field-label">CPF:</span>
      <span class="field-value">${doc.customerCpf || ""}</span>
    </div>
    <div class="field">
      <span class="field-label">RG:</span>
      <span class="field-value">${doc.customerRg || ""}</span>
    </div>
    <div class="field">
      <span class="field-label">Telefone:</span>
      <span class="field-value">${doc.customerPhone || ""}</span>
    </div>
    <div class="field">
      <span class="field-label">E-mail:</span>
      <span class="field-value">${doc.customerEmail || ""}</span>
    </div>
    <div class="field">
      <span class="field-label">Endereço:</span>
      <span class="field-value">${doc.customerAddress || ""}</span>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">DADOS DO DISPOSITIVO</div>
    <div class="field">
      <span class="field-label">Marca:</span>
      <span class="field-value">${doc.deviceBrand}</span>
    </div>
    <div class="field">
      <span class="field-label">Modelo:</span>
      <span class="field-value">${doc.deviceModel}</span>
    </div>
    <div class="field">
      <span class="field-label">IMEI Principal:</span>
      <span class="field-value">${doc.deviceImei}</span>
    </div>
    ${doc.deviceImei2 ? `
    <div class="field">
      <span class="field-label">IMEI Secundário:</span>
      <span class="field-value">${doc.deviceImei2}</span>
    </div>
    ` : ""}
    <div class="field">
      <span class="field-label">Cor:</span>
      <span class="field-value">${doc.deviceColor || ""}</span>
    </div>
    <div class="field">
      <span class="field-label">Armazenamento:</span>
      <span class="field-value">${doc.deviceStorage || ""}</span>
    </div>
    <div class="field">
      <span class="field-label">Condição:</span>
      <span class="field-value">${doc.deviceCondition || ""}</span>
    </div>
  </div>
  
  <div class="value-box">
    <div>Valor acordado para transferência:</div>
    <div class="amount">${formatCurrency(doc.agreedValue)}</div>
    <div style="font-size: 11px; color: #666;">Forma de pagamento: ${doc.paymentMethod === "credit" ? "Crédito em conta" : doc.paymentMethod === "discount_on_purchase" ? "Desconto na compra" : "Dinheiro"}</div>
  </div>
  
  <div class="terms">
    <h3>TERMOS E CONDIÇÕES</h3>
    <ol>
      <li>O CEDENTE declara ser o legítimo proprietário do dispositivo descrito acima e que o mesmo não possui qualquer restrição de uso, pendência financeira, bloqueio por roubo/furto ou gravame de qualquer natureza.</li>
      <li>O CEDENTE declara que o dispositivo não é objeto de financiamento em andamento e não está vinculado a nenhum contrato de operadora que impeça sua transferência.</li>
      <li>O CEDENTE transfere todos os direitos de posse e propriedade do dispositivo para a empresa CESSIONÁRIA.</li>
      <li>O CEDENTE compromete-se a remover todas as contas vinculadas ao dispositivo (iCloud, Google, Samsung, etc.) antes da entrega.</li>
      <li>A CESSIONÁRIA realizou avaliação técnica do dispositivo e ambas as partes concordam com o valor acordado.</li>
      <li>O CEDENTE autoriza a CESSIONÁRIA a revender, locar ou utilizar o dispositivo da forma que melhor lhe convier.</li>
      <li>O CEDENTE assume total responsabilidade por qualquer declaração falsa prestada neste termo.</li>
    </ol>
  </div>
  
  <div class="signatures">
    <div class="signature-box">
      ${doc.customerSignature ? `<img src="${doc.customerSignature}" class="signature-image" alt="Assinatura do Cliente">` : ""}
      <div class="signature-line">
        <div class="signature-name">${doc.customerName}</div>
        <div class="signature-doc">CPF: ${doc.customerCpf || "___.___.___-__"}</div>
        <div class="signature-doc">CEDENTE</div>
      </div>
    </div>
    <div class="signature-box">
      ${doc.employeeSignature ? `<img src="${doc.employeeSignature}" class="signature-image" alt="Assinatura do Funcionário">` : ""}
      <div class="signature-line">
        <div class="signature-name">${doc.employeeName || "____________________"}</div>
        <div class="signature-doc">REPRESENTANTE DA EMPRESA</div>
        <div class="signature-doc">CESSIONÁRIA</div>
      </div>
    </div>
  </div>
  
  <div class="footer">
    <p>Documento gerado eletronicamente pelo sistema Arcádia Retail</p>
    <p>Data de geração: ${new Date().toLocaleString("pt-BR")}</p>
  </div>
</body>
</html>
`;
}

// ========== PHASE 0: PERSONS (Unified Person Registry) ==========

// List all persons with optional role filter
router.get("/persons", async (req: Request, res: Response) => {
  try {
    const { search, role, isActive } = req.query;
    
    let result = await db.select().from(persons).orderBy(desc(persons.createdAt));
    
    // Apply filters in memory for now (can be optimized later)
    if (search) {
      const searchLower = (search as string).toLowerCase();
      result = result.filter(p => 
        p.fullName.toLowerCase().includes(searchLower) ||
        (p.cpfCnpj && p.cpfCnpj.includes(search as string)) ||
        (p.email && p.email.toLowerCase().includes(searchLower)) ||
        (p.phone && p.phone.includes(search as string))
      );
    }
    
    if (isActive !== undefined) {
      result = result.filter(p => p.isActive === (isActive === "true"));
    }
    
    // If role filter, get person IDs with that role
    if (role) {
      const rolesWithType = await db.select().from(personRoles)
        .where(eq(personRoles.roleType, role as string));
      const personIdsWithRole = rolesWithType.map(r => r.personId);
      result = result.filter(p => personIdsWithRole.includes(p.id));
    }
    
    // Fetch roles for each person
    const personsWithRoles = await Promise.all(result.map(async (person) => {
      const roles = await db.select().from(personRoles)
        .where(eq(personRoles.personId, person.id));
      return { ...person, roles };
    }));
    
    res.json(personsWithRoles);
  } catch (error) {
    console.error("Error fetching persons:", error);
    res.status(500).json({ error: "Failed to fetch persons" });
  }
});

// Get single person with all roles
router.get("/persons/:id", async (req: Request, res: Response) => {
  try {
    const [person] = await db.select().from(persons)
      .where(eq(persons.id, parseInt(req.params.id)));
    
    if (!person) {
      return res.status(404).json({ error: "Person not found" });
    }
    
    const roles = await db.select().from(personRoles)
      .where(eq(personRoles.personId, person.id));
    
    res.json({ ...person, roles });
  } catch (error) {
    console.error("Error fetching person:", error);
    res.status(500).json({ error: "Failed to fetch person" });
  }
});

// Search persons by name/cpf
router.get("/persons/search", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || (q as string).length < 2) {
      return res.json([]);
    }
    
    const result = await db.select().from(persons)
      .where(or(
        ilike(persons.fullName, `%${q}%`),
        ilike(persons.cpfCnpj, `%${q}%`)
      ))
      .limit(20);
    
    // Fetch roles
    const personsWithRoles = await Promise.all(result.map(async (person) => {
      const roles = await db.select().from(personRoles)
        .where(eq(personRoles.personId, person.id));
      return { ...person, roles: roles.map(r => r.roleType) };
    }));
    
    res.json(personsWithRoles);
  } catch (error) {
    console.error("Error searching persons:", error);
    res.status(500).json({ error: "Failed to search persons" });
  }
});

// Create new person
router.post("/persons", async (req: Request, res: Response) => {
  try {
    const { roles: rolesData, ...personData } = req.body;
    
    const [person] = await db.insert(persons).values(personData).returning();
    
    // Create roles if provided
    if (rolesData && Array.isArray(rolesData) && rolesData.length > 0) {
      for (const roleData of rolesData) {
        await db.insert(personRoles).values({
          personId: person.id,
          ...roleData
        });
      }
    }
    
    // Fetch created roles
    const createdRoles = await db.select().from(personRoles)
      .where(eq(personRoles.personId, person.id));
    
    res.json({ ...person, roles: createdRoles });
  } catch (error) {
    console.error("Error creating person:", error);
    res.status(500).json({ error: "Failed to create person" });
  }
});

// Update person
router.put("/persons/:id", async (req: Request, res: Response) => {
  try {
    const { roles: rolesData, ...personData } = req.body;
    
    const [person] = await db.update(persons)
      .set({ ...personData, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(persons.id, parseInt(req.params.id)))
      .returning();
    
    res.json(person);
  } catch (error) {
    console.error("Error updating person:", error);
    res.status(500).json({ error: "Failed to update person" });
  }
});

// Add role to person
router.post("/persons/:id/roles", async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.params.id);
    
    // Check if person exists
    const [person] = await db.select().from(persons).where(eq(persons.id, personId));
    if (!person) {
      return res.status(404).json({ error: "Person not found" });
    }
    
    // Check if role already exists
    const existingRole = await db.select().from(personRoles)
      .where(and(
        eq(personRoles.personId, personId),
        eq(personRoles.roleType, req.body.roleType)
      ));
    
    if (existingRole.length > 0) {
      return res.status(400).json({ error: "Role already exists for this person" });
    }
    
    const [role] = await db.insert(personRoles).values({
      personId,
      ...req.body
    }).returning();
    
    res.json(role);
  } catch (error) {
    console.error("Error adding role:", error);
    res.status(500).json({ error: "Failed to add role" });
  }
});

// Update role
router.put("/persons/:id/roles/:roleId", async (req: Request, res: Response) => {
  try {
    const [role] = await db.update(personRoles)
      .set({ ...req.body, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(personRoles.id, parseInt(req.params.roleId)))
      .returning();
    
    res.json(role);
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

// Remove role from person
router.delete("/persons/:id/roles/:roleType", async (req: Request, res: Response) => {
  try {
    await db.delete(personRoles)
      .where(and(
        eq(personRoles.personId, parseInt(req.params.id)),
        eq(personRoles.roleType, req.params.roleType)
      ));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing role:", error);
    res.status(500).json({ error: "Failed to remove role" });
  }
});

// ========== PHASE 0: TRADE-IN FLOW (Approve → Internal OS → Stock) ==========

// Generate unique order number
function generateOrderNumber(prefix: string = "OS"): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${year}${month}${random}`;
}

// Approve Trade-In and create Internal Service Order
router.post("/evaluations/:id/approve-and-process", async (req: Request, res: Response) => {
  try {
    const evaluationId = parseInt(req.params.id);
    const { profitMargin = 30 } = req.body; // Default 30% margin
    
    // Get evaluation
    const [evaluation] = await db.select().from(deviceEvaluations)
      .where(eq(deviceEvaluations.id, evaluationId));
    
    if (!evaluation) {
      return res.status(404).json({ error: "Evaluation not found" });
    }
    
    if (evaluation.status === "approved") {
      return res.status(400).json({ error: "Evaluation already approved" });
    }
    
    // 1. Update evaluation to approved
    await db.update(deviceEvaluations)
      .set({ 
        status: "approved", 
        approved: true,
        updatedAt: sql`CURRENT_TIMESTAMP` 
      })
      .where(eq(deviceEvaluations.id, evaluationId));
    
    // 2. Create Internal Service Order for revision
    const orderNumber = generateOrderNumber("INT");
    const [serviceOrder] = await db.insert(serviceOrders).values({
      tenantId: evaluation.tenantId,
      orderNumber,
      storeId: evaluation.storeId,
      imei: evaluation.imei,
      brand: evaluation.brand,
      model: evaluation.model,
      customerName: "ORDEM INTERNA - REVISÃO",
      serviceType: "internal_review",
      issueDescription: `Revisão e manutenção de dispositivo Trade-In. Avaliação #${evaluationId}`,
      origin: "device_acquisition",
      status: "open",
      priority: "normal",
      isInternal: true,
      internalType: "revision",
      sourceEvaluationId: evaluationId,
    }).returning();
    
    // 3. Record in IMEI history
    await db.insert(imeiHistory).values({
      tenantId: evaluation.tenantId,
      deviceId: null as any,
      imei: evaluation.imei,
      action: "trade_in_approved",
      newStatus: "in_revision",
      relatedOrderId: serviceOrder.id,
      relatedOrderType: "service_order",
      relatedOrderNumber: orderNumber,
      notes: `Trade-In aprovado. Valor: R$ ${evaluation.estimatedValue}. O.S. Interna criada.`,
      createdBy: (req.user as any)?.id,
      createdByName: (req.user as any)?.name || "Sistema",
    });

    // 4. Generate customer credit if person and value are valid
    let credit = null;
    const personId = evaluation.personId;
    const estimatedValueNum = evaluation.estimatedValue ? parseFloat(evaluation.estimatedValue) : 0;
    if (personId && estimatedValueNum > 0) {
      let customerCpf = null;
      let customerName = evaluation.customerName || "Cliente";
      const [person] = await db.select().from(persons)
        .where(eq(persons.id, personId))
        .limit(1);
      if (person) {
        customerCpf = person.cpfCnpj;
        customerName = person.fullName;
      }

      [credit] = await db.insert(customerCredits).values({
        storeId: evaluation.storeId || undefined,
        personId: personId,
        customerName,
        customerCpf: customerCpf || undefined,
        amount: evaluation.estimatedValue!,
        remainingAmount: evaluation.estimatedValue!,
        origin: "trade_in",
        originId: evaluation.id,
        description: `Trade-In: ${evaluation.brand} ${evaluation.model} (IMEI: ${evaluation.imei})`,
        status: "active",
        createdBy: (req.user as any)?.id
      }).returning();

      await db.update(deviceEvaluations)
        .set({ creditGenerated: true, creditId: credit.id })
        .where(eq(deviceEvaluations.id, evaluationId));
    }
    
    res.json({
      success: true,
      message: "Trade-In aprovado e O.S. Interna criada com sucesso",
      evaluation: { ...evaluation, status: "approved" },
      serviceOrder,
      credit,
      nextStep: "Realize a revisão/manutenção do dispositivo e finalize a O.S. para entrada no estoque"
    });
  } catch (error) {
    console.error("Error processing trade-in:", error);
    res.status(500).json({ error: "Failed to process trade-in" });
  }
});

// Get full Trade-In flow status
router.get("/evaluations/:id/full-flow", async (req: Request, res: Response) => {
  try {
    const evaluationId = parseInt(req.params.id);
    
    // Get evaluation
    const [evaluation] = await db.select().from(deviceEvaluations)
      .where(eq(deviceEvaluations.id, evaluationId));
    
    if (!evaluation) {
      return res.status(404).json({ error: "Evaluation not found" });
    }
    
    // Get related internal OS
    const relatedOS = await db.select().from(serviceOrders)
      .where(eq(serviceOrders.sourceEvaluationId, evaluationId));
    
    // Get related device in stock (if exists)
    const relatedDevice = await db.select().from(mobileDevices)
      .where(eq(mobileDevices.relatedEvaluationId, evaluationId));
    
    // Get IMEI history
    const history = await db.select().from(imeiHistory)
      .where(eq(imeiHistory.imei, evaluation.imei))
      .orderBy(desc(imeiHistory.createdAt));
    
    // Determine flow status
    let flowStatus = "pending";
    let flowStep = 1;
    if (evaluation.status === "approved") {
      flowStatus = "approved";
      flowStep = 2;
    }
    if (relatedOS.length > 0 && relatedOS[0].status === "completed") {
      flowStatus = "revision_completed";
      flowStep = 3;
    }
    if (relatedDevice.length > 0) {
      flowStatus = "in_stock";
      flowStep = 4;
    }
    
    res.json({
      evaluation,
      serviceOrder: relatedOS[0] || null,
      device: relatedDevice[0] || null,
      history,
      flowStatus,
      flowStep,
      steps: [
        { step: 1, name: "Avaliação", status: "completed" },
        { step: 2, name: "Aprovação", status: flowStep >= 2 ? "completed" : "pending" },
        { step: 3, name: "Revisão (O.S.)", status: flowStep >= 3 ? "completed" : flowStep === 2 ? "in_progress" : "pending" },
        { step: 4, name: "Estoque", status: flowStep >= 4 ? "completed" : "pending" },
      ]
    });
  } catch (error) {
    console.error("Error fetching trade-in flow:", error);
    res.status(500).json({ error: "Failed to fetch trade-in flow" });
  }
});

// Finalize Internal OS and create device in stock
router.post("/service-orders/:id/finalize-internal", async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    const { profitMargin = 30, warehouseId, notes } = req.body;
    
    // Get service order
    const [serviceOrder] = await db.select().from(serviceOrders)
      .where(eq(serviceOrders.id, orderId));
    
    if (!serviceOrder) {
      return res.status(404).json({ error: "Service order not found" });
    }
    
    if (!serviceOrder.isInternal) {
      return res.status(400).json({ error: "This is not an internal service order" });
    }
    
    if (serviceOrder.status === "completed") {
      return res.status(400).json({ error: "Service order already completed" });
    }
    
    // Get original evaluation
    const [evaluation] = await db.select().from(deviceEvaluations)
      .where(eq(deviceEvaluations.id, serviceOrder.sourceEvaluationId!));
    
    if (!evaluation) {
      return res.status(400).json({ error: "Original evaluation not found" });
    }
    
    // Calculate costs
    const tradeInValue = parseFloat(evaluation.estimatedValue?.toString() || "0");
    const osCost = parseFloat(serviceOrder.totalCost?.toString() || "0");
    const acquisitionCost = tradeInValue + osCost;
    const suggestedPrice = acquisitionCost * (1 + profitMargin / 100);
    
    // 1. Update service order to completed
    await db.update(serviceOrders)
      .set({ 
        status: "completed",
        actualCompletionDate: sql`CURRENT_DATE`,
        updatedAt: sql`CURRENT_TIMESTAMP` 
      })
      .where(eq(serviceOrders.id, orderId));
    
    // 2. Create device in stock
    const [device] = await db.insert(mobileDevices).values({
      tenantId: serviceOrder.tenantId,
      imei: serviceOrder.imei,
      brand: serviceOrder.brand || evaluation.brand,
      model: serviceOrder.model || evaluation.model,
      color: evaluation.color,
      condition: "refurbished",
      warehouseId: warehouseId || null,
      storeId: serviceOrder.storeId,
      status: "in_stock",
      purchaseDate: sql`CURRENT_DATE`,
      purchasePrice: acquisitionCost.toString(),
      sellingPrice: suggestedPrice.toString(),
      acquisitionType: "trade_in",
      acquisitionCost: acquisitionCost.toString(),
      relatedEvaluationId: evaluation.id,
      relatedServiceOrderId: orderId,
      suggestedPrice: suggestedPrice.toString(),
      profitMargin: profitMargin.toString(),
      notes: notes || `Origem: Trade-In #${evaluation.id}. Revisão: O.S. ${serviceOrder.orderNumber}`,
    }).returning();
    
    // 3. Update evaluation with device reference
    await db.update(deviceEvaluations)
      .set({ deviceId: device.id, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(deviceEvaluations.id, evaluation.id));
    
    // 4. Record in IMEI history
    await db.insert(imeiHistory).values({
      tenantId: serviceOrder.tenantId,
      deviceId: device.id,
      imei: serviceOrder.imei,
      action: "stock_entry",
      previousStatus: "in_revision",
      newStatus: "in_stock",
      newLocation: warehouseId ? `Warehouse #${warehouseId}` : `Store #${serviceOrder.storeId}`,
      relatedOrderId: orderId,
      relatedOrderType: "service_order",
      relatedOrderNumber: serviceOrder.orderNumber,
      cost: acquisitionCost.toString(),
      notes: `Dispositivo entrou no estoque. Custo: R$ ${acquisitionCost.toFixed(2)}. Preço sugerido: R$ ${suggestedPrice.toFixed(2)} (margem ${profitMargin}%)`,
      createdBy: (req.user as any)?.id,
      createdByName: (req.user as any)?.name || "Sistema",
    });
    
    res.json({
      success: true,
      message: "O.S. finalizada e dispositivo adicionado ao estoque",
      device,
      costs: {
        tradeInValue,
        osCost,
        totalAcquisitionCost: acquisitionCost,
        suggestedSellingPrice: suggestedPrice,
        profitMargin: `${profitMargin}%`
      }
    });
  } catch (error) {
    console.error("Error finalizing internal OS:", error);
    res.status(500).json({ error: "Failed to finalize internal service order" });
  }
});

// ========== PHASE 0: IMEI HISTORY (Kardex) ==========

// Get IMEI history
router.get("/devices/:imei/history", async (req: Request, res: Response) => {
  try {
    const history = await db.select().from(imeiHistory)
      .where(eq(imeiHistory.imei, req.params.imei))
      .orderBy(desc(imeiHistory.createdAt));
    
    res.json(history);
  } catch (error) {
    console.error("Error fetching IMEI history:", error);
    res.status(500).json({ error: "Failed to fetch IMEI history" });
  }
});

// Get devices by origin type
router.get("/devices/by-origin/:originType", async (req: Request, res: Response) => {
  try {
    const devices = await db.select().from(mobileDevices)
      .where(eq(mobileDevices.acquisitionType, req.params.originType))
      .orderBy(desc(mobileDevices.createdAt));
    
    res.json(devices);
  } catch (error) {
    console.error("Error fetching devices by origin:", error);
    res.status(500).json({ error: "Failed to fetch devices by origin" });
  }
});

// Get stock summary by origin
router.get("/inventory/by-origin", async (req: Request, res: Response) => {
  try {
    const devices = await db.select().from(mobileDevices)
      .where(eq(mobileDevices.status, "in_stock"));
    
    // Group by origin
    const summary: Record<string, { count: number; totalValue: number; avgMargin: number }> = {};
    
    for (const device of devices) {
      const origin = device.acquisitionType || "unknown";
      if (!summary[origin]) {
        summary[origin] = { count: 0, totalValue: 0, avgMargin: 0 };
      }
      summary[origin].count++;
      summary[origin].totalValue += parseFloat(device.sellingPrice?.toString() || "0");
      summary[origin].avgMargin += parseFloat(device.profitMargin?.toString() || "0");
    }
    
    // Calculate average margins
    for (const origin in summary) {
      if (summary[origin].count > 0) {
        summary[origin].avgMargin /= summary[origin].count;
      }
    }
    
    res.json(summary);
  } catch (error) {
    console.error("Error fetching inventory by origin:", error);
    res.status(500).json({ error: "Failed to fetch inventory by origin" });
  }
});

// ========== ERPNEXT SYNC ENDPOINTS ==========
import { retailSyncService } from "./sync-service";
import * as erpnextService from "../erpnext/service";

// Check ERPNext connection status
router.get("/sync/status", async (req: Request, res: Response) => {
  try {
    const config = erpnextService.getConfig();
    if (!config.configured) {
      return res.json({ 
        connected: false, 
        message: "ERPNext não configurado. Configure as credenciais nas secrets." 
      });
    }

    const result = await erpnextService.testConnection();
    return res.json({
      connected: result.success,
      message: result.message,
      url: config.url,
    });
  } catch (error) {
    console.error("Error checking sync status:", error);
    res.status(500).json({ connected: false, message: "Erro ao verificar conexão" });
  }
});

// Sync a single person to ERPNext
router.post("/sync/persons/:id", async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.params.id);
    const result = await retailSyncService.syncPersonToERPNext(personId);
    res.json(result);
  } catch (error) {
    console.error("Error syncing person:", error);
    res.status(500).json({ success: false, error: "Failed to sync person" });
  }
});

// Sync all persons to ERPNext
router.post("/sync/persons", async (req: Request, res: Response) => {
  try {
    const result = await retailSyncService.syncAllPersonsToERPNext();
    res.json(result);
  } catch (error) {
    console.error("Error syncing all persons:", error);
    res.status(500).json({ success: false, error: "Failed to sync persons" });
  }
});

// Sync a single device to ERPNext
router.post("/sync/devices/:id", async (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(req.params.id);
    const result = await retailSyncService.syncDeviceToERPNext(deviceId);
    res.json(result);
  } catch (error) {
    console.error("Error syncing device:", error);
    res.status(500).json({ success: false, error: "Failed to sync device" });
  }
});

// Sync a service order to ERPNext
router.post("/sync/service-orders/:id", async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    const result = await retailSyncService.syncServiceOrderToERPNext(orderId);
    res.json(result);
  } catch (error) {
    console.error("Error syncing service order:", error);
    res.status(500).json({ success: false, error: "Failed to sync service order" });
  }
});

// Import customers from ERPNext
router.post("/sync/import/customers", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await retailSyncService.importCustomersFromERPNext(limit);
    res.json(result);
  } catch (error) {
    console.error("Error importing customers:", error);
    res.status(500).json({ success: false, error: "Failed to import customers" });
  }
});

// Import suppliers from ERPNext
router.post("/sync/import/suppliers", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await retailSyncService.importSuppliersFromERPNext(limit);
    res.json(result);
  } catch (error) {
    console.error("Error importing suppliers:", error);
    res.status(500).json({ success: false, error: "Failed to import suppliers" });
  }
});

// Run full sync
router.post("/sync/full", async (req: Request, res: Response) => {
  try {
    const result = await retailSyncService.runFullSync();
    res.json(result);
  } catch (error) {
    console.error("Error running full sync:", error);
    res.status(500).json({ success: false, error: "Failed to run full sync" });
  }
});

// Create stock entry in ERPNext
router.post("/sync/stock-entry", async (req: Request, res: Response) => {
  try {
    const { entryType, items, fromWarehouse, toWarehouse } = req.body;
    const result = await retailSyncService.createStockEntry(entryType, items, fromWarehouse, toWarehouse);
    res.json(result);
  } catch (error) {
    console.error("Error creating stock entry:", error);
    res.status(500).json({ success: false, error: "Failed to create stock entry" });
  }
});

// Create sales invoice in ERPNext
router.post("/sync/sales-invoice", async (req: Request, res: Response) => {
  try {
    const { customerName, items, paymentMode } = req.body;
    const result = await retailSyncService.createSalesInvoice(customerName, items, paymentMode);
    res.json(result);
  } catch (error) {
    console.error("Error creating sales invoice:", error);
    res.status(500).json({ success: false, error: "Failed to create sales invoice" });
  }
});

// ========== CUSTOMER CREDITS ==========
router.get("/credits", async (req: Request, res: Response) => {
  try {
    const { personId, status } = req.query;
    let query = db.select().from(customerCredits);
    
    const conditions = [];
    if (personId) conditions.push(eq(customerCredits.personId, parseInt(personId as string)));
    if (status) conditions.push(eq(customerCredits.status, status as string));
    
    const credits = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(customerCredits.createdAt))
      : await query.orderBy(desc(customerCredits.createdAt));
    
    res.json(credits);
  } catch (error) {
    console.error("Error fetching credits:", error);
    res.status(500).json({ error: "Failed to fetch credits" });
  }
});

router.get("/credits/by-person/:personId", async (req: Request, res: Response) => {
  try {
    const credits = await db.select().from(customerCredits)
      .where(and(
        eq(customerCredits.personId, parseInt(req.params.personId)),
        eq(customerCredits.status, "active")
      ))
      .orderBy(desc(customerCredits.createdAt));
    
    const totalAvailable = credits.reduce((sum, c) => sum + parseFloat(c.remainingAmount || "0"), 0);
    res.json({ credits, totalAvailable });
  } catch (error) {
    console.error("Error fetching credits by person:", error);
    res.status(500).json({ error: "Failed to fetch credits" });
  }
});

router.post("/credits/:id/use", async (req: Request, res: Response) => {
  try {
    const { amount, saleId } = req.body;
    const [credit] = await db.select().from(customerCredits)
      .where(eq(customerCredits.id, parseInt(req.params.id)));
    
    if (!credit) return res.status(404).json({ error: "Credit not found" });
    if (credit.status !== "active") return res.status(400).json({ error: "Credit is not active" });
    
    const remaining = parseFloat(credit.remainingAmount || "0");
    const useAmount = Math.min(parseFloat(amount), remaining);
    const newRemaining = remaining - useAmount;
    const newUsed = parseFloat(credit.usedAmount || "0") + useAmount;
    
    const [updated] = await db.update(customerCredits)
      .set({
        usedAmount: newUsed.toFixed(2),
        remainingAmount: newRemaining.toFixed(2),
        status: newRemaining <= 0 ? "used" : "active",
        usedInSaleId: saleId || undefined,
        updatedAt: new Date()
      })
      .where(eq(customerCredits.id, parseInt(req.params.id)))
      .returning();
    
    res.json({ credit: updated, amountUsed: useAmount });
  } catch (error) {
    console.error("Error using credit:", error);
    res.status(500).json({ error: "Failed to use credit" });
  }
});

router.get("/evaluations/:id", async (req: Request, res: Response) => {
  try {
    const [evaluation] = await db.select().from(deviceEvaluations)
      .where(eq(deviceEvaluations.id, parseInt(req.params.id)));
    if (!evaluation) return res.status(404).json({ error: "Evaluation not found" });
    res.json(evaluation);
  } catch (error) {
    console.error("Error fetching evaluation:", error);
    res.status(500).json({ error: "Failed to fetch evaluation" });
  }
});

// ========== PERSON HISTORY ==========
router.get("/persons/:id/sales", async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.params.id);
    const sales = await db.select().from(posSales)
      .where(eq(posSales.customerId, String(personId)))
      .orderBy(desc(posSales.createdAt));
    res.json(sales);
  } catch (error) {
    console.error("Error fetching person sales:", error);
    res.status(500).json({ error: "Failed to fetch person sales" });
  }
});

router.get("/persons/:id/services", async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.params.id);
    const services = await db.select().from(serviceOrders)
      .where(eq(serviceOrders.personId, personId))
      .orderBy(desc(serviceOrders.createdAt));
    res.json(services);
  } catch (error) {
    console.error("Error fetching person services:", error);
    res.status(500).json({ error: "Failed to fetch person services" });
  }
});

router.get("/persons/:id/trade-ins", async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.params.id);
    const tradeIns = await db.select().from(deviceEvaluations)
      .where(eq(deviceEvaluations.personId, personId))
      .orderBy(desc(deviceEvaluations.createdAt));
    res.json(tradeIns);
  } catch (error) {
    console.error("Error fetching person trade-ins:", error);
    res.status(500).json({ error: "Failed to fetch person trade-ins" });
  }
});

router.get("/persons/:id/credits", async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.params.id);
    const credits = await db.select().from(customerCredits)
      .where(eq(customerCredits.personId, personId))
      .orderBy(desc(customerCredits.createdAt));
    res.json(credits);
  } catch (error) {
    console.error("Error fetching person credits:", error);
    res.status(500).json({ error: "Failed to fetch person credits" });
  }
});

// ========== TRADE-IN WORKFLOW - STATUS UPDATES ==========

// Alterar status para "Em Análise"
router.put("/evaluations/:id/start-analysis", async (req: Request, res: Response) => {
  try {
    const [evaluation] = await db.update(deviceEvaluations)
      .set({ 
        status: "analyzing",
        diagnosisStatus: "in_progress",
        evaluatedBy: (req as any).user?.id,
        updatedAt: new Date()
      })
      .where(eq(deviceEvaluations.id, parseInt(req.params.id)))
      .returning();
    res.json(evaluation);
  } catch (error) {
    console.error("Error starting analysis:", error);
    res.status(500).json({ error: "Failed to start analysis" });
  }
});

// Buscar trade-ins ativos do cliente (para alertas no PDV)
router.get("/customer-trade-ins/:personId", async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.params.personId);
    const tradeIns = await db.select().from(deviceEvaluations)
      .where(and(
        eq(deviceEvaluations.personId, personId),
        or(
          eq(deviceEvaluations.status, "pending"),
          eq(deviceEvaluations.status, "analyzing"),
          eq(deviceEvaluations.status, "approved")
        )
      ))
      .orderBy(desc(deviceEvaluations.createdAt));
    
    // Buscar créditos disponíveis
    const credits = await db.select().from(customerCredits)
      .where(and(
        eq(customerCredits.personId, personId),
        eq(customerCredits.status, "active")
      ));
    
    const totalCredit = credits.reduce((sum, c) => sum + parseFloat(c.remainingAmount || "0"), 0);
    
    res.json({ tradeIns, credits, totalCredit });
  } catch (error) {
    console.error("Error fetching customer trade-ins:", error);
    res.status(500).json({ error: "Failed to fetch customer trade-ins" });
  }
});

// ========== MANAGER PASSWORD VERIFICATION ==========
router.post("/verify-manager-password", async (req: Request, res: Response) => {
  try {
    const { password, action } = req.body;
    // Senha de gerente padrão (deve ser configurável no futuro)
    const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD || "gerente123";
    
    if (password === MANAGER_PASSWORD) {
      res.json({ authorized: true, action });
    } else {
      res.status(401).json({ authorized: false, error: "Senha incorreta" });
    }
  } catch (error) {
    console.error("Error verifying manager password:", error);
    res.status(500).json({ error: "Failed to verify password" });
  }
});

// ========== RETURNS/REFUNDS ==========

// Buscar vendas por cliente ou IMEI para devolução
router.get("/sales-for-return", async (req: Request, res: Response) => {
  try {
    const { personId, imei, search } = req.query;
    let conditions = [];
    
    if (personId) {
      conditions.push(eq(posSales.customerId, String(personId)));
    }
    
    if (search) {
      conditions.push(or(
        ilike(posSales.customerName!, `%${search}%`),
        ilike(posSales.saleNumber!, `%${search}%`)
      ));
    }
    
    if (conditions.length === 0) {
      return res.json([]);
    }
    
    const sales = await db.select().from(posSales)
      .where(and(...conditions, eq(posSales.status, "completed")))
      .orderBy(desc(posSales.createdAt))
      .limit(20);
    
    // Para cada venda, buscar itens
    const salesWithItems = await Promise.all(sales.map(async (sale) => {
      const items = await db.select().from(posSaleItems)
        .where(eq(posSaleItems.saleId, sale.id));
      return { ...sale, items };
    }));
    
    // Filtrar por IMEI se especificado
    if (imei) {
      const filtered = salesWithItems.filter(s => 
        s.items.some((i: any) => i.imei?.toLowerCase().includes((imei as string).toLowerCase()))
      );
      return res.json(filtered);
    }
    
    res.json(salesWithItems);
  } catch (error) {
    console.error("Error fetching sales for return:", error);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

// Processar devolução e gerar crédito
router.post("/returns", async (req: Request, res: Response) => {
  try {
    const { saleId, items, reason, personId, customerName, generateCredit } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Nenhum item selecionado para devolução" });
    }
    
    // Buscar a venda original
    const [originalSale] = await db.select().from(posSales)
      .where(eq(posSales.id, saleId));
    
    if (!originalSale) {
      return res.status(404).json({ error: "Venda não encontrada" });
    }
    
    // Calcular valor total da devolução
    let totalReturn = 0;
    for (const item of items) {
      totalReturn += parseFloat(item.totalPrice || item.unitPrice || "0");
    }
    
    // Criar registro de devolução
    const returnNumber = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const [returnRecord] = await db.insert(returnExchanges).values({
      returnNumber,
      originalSaleId: saleId,
      customerId: personId?.toString(),
      customerName: customerName || originalSale.customerName,
      returnType: "return",
      reason,
      refundAmount: String(totalReturn),
      status: "processed",
      processedDate: sql`CURRENT_DATE`,
      processedBy: (req as any).user?.id
    }).returning();
    
    // Processar cada item devolvido
    for (const item of items) {
      await db.insert(returnExchangeItems).values({
        returnId: returnRecord.id,
        deviceId: item.deviceId,
        imei: item.imei,
        itemName: item.itemName,
        quantity: item.quantity || 1,
        refundAmount: String(item.totalPrice || item.unitPrice || "0"),
        reason: reason
      });
      
      // Se for dispositivo, retornar ao estoque
      if (item.deviceId) {
        await db.update(mobileDevices)
          .set({ 
            status: "in_stock",
            soldDate: null,
            soldToCustomer: null,
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(mobileDevices.id, item.deviceId));
        
        await db.insert(deviceHistory).values({
          deviceId: item.deviceId,
          imei: item.imei,
          eventType: "returned",
          fromLocation: customerName || "Cliente",
          toLocation: `Estoque - Loja ${originalSale.storeId || 1}`,
          referenceType: "return",
          referenceId: returnRecord.id,
          notes: `Devolução: ${reason || 'Sem motivo especificado'}`,
          createdBy: (req as any).user?.id
        });
      }
    }
    
    // Gerar crédito para o cliente se solicitado
    let credit = null;
    if (generateCredit && personId && totalReturn > 0) {
      [credit] = await db.insert(customerCredits).values({
        storeId: originalSale.storeId,
        personId: parseInt(personId),
        customerName: customerName || originalSale.customerName || "Cliente",
        amount: String(totalReturn),
        remainingAmount: String(totalReturn),
        origin: "refund",
        originId: returnRecord.id,
        description: `Devolução ref. Venda ${originalSale.saleNumber}`,
        status: "active",
        createdBy: (req as any).user?.id
      }).returning();
    }
    
    res.json({ 
      returnRecord, 
      credit, 
      message: credit 
        ? `Devolução processada. Crédito de R$ ${totalReturn.toFixed(2)} gerado para o cliente.`
        : "Devolução processada com sucesso."
    });
  } catch (error) {
    console.error("Error processing return:", error);
    res.status(500).json({ error: "Failed to process return" });
  }
});

// Buscar O.S. vinculada a uma avaliação Trade-In
router.get("/evaluations/:id/service-order", async (req: Request, res: Response) => {
  try {
    const evalId = parseInt(req.params.id);
    const [order] = await db.select().from(serviceOrders)
      .where(eq(serviceOrders.sourceEvaluationId, evalId));
    
    if (!order) {
      return res.status(404).json({ error: "O.S. não encontrada" });
    }
    
    res.json(order);
  } catch (error) {
    console.error("Error fetching service order for evaluation:", error);
    res.status(500).json({ error: "Failed to fetch service order" });
  }
});

// Salvar checklist na O.S.
router.put("/service-orders/:id/checklist", async (req: Request, res: Response) => {
  try {
    const { checklistData, completedBy } = req.body;
    
    const [order] = await db.update(serviceOrders)
      .set({ 
        checklistData,
        checklistCompletedAt: completedBy ? sql`CURRENT_TIMESTAMP` : null,
        checklistCompletedBy: completedBy,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(serviceOrders.id, parseInt(req.params.id)))
      .returning();
    
    res.json(order);
  } catch (error) {
    console.error("Error updating checklist:", error);
    res.status(500).json({ error: "Failed to update checklist" });
  }
});

// ========== METAS DE VENDEDOR ==========
router.get("/seller-goals", async (req: Request, res: Response) => {
  try {
    const { sellerId, storeId, month, year } = req.query;
    const conditions = [];
    if (sellerId) conditions.push(eq(retailSellerGoals.sellerId, parseInt(sellerId as string)));
    if (storeId) conditions.push(eq(retailSellerGoals.storeId, parseInt(storeId as string)));
    if (month) conditions.push(eq(retailSellerGoals.month, parseInt(month as string)));
    if (year) conditions.push(eq(retailSellerGoals.year, parseInt(year as string)));
    
    const goals = conditions.length > 0
      ? await db.select().from(retailSellerGoals).where(and(...conditions))
      : await db.select().from(retailSellerGoals);
    res.json(goals);
  } catch (error) {
    console.error("Error fetching seller goals:", error);
    res.status(500).json({ error: "Failed to fetch seller goals" });
  }
});

router.post("/seller-goals", async (req: Request, res: Response) => {
  try {
    const [goal] = await db.insert(retailSellerGoals).values(req.body).returning();
    res.status(201).json(goal);
  } catch (error) {
    console.error("Error creating seller goal:", error);
    res.status(500).json({ error: "Failed to create seller goal" });
  }
});

router.put("/seller-goals/:id", async (req: Request, res: Response) => {
  try {
    const [goal] = await db.update(retailSellerGoals)
      .set({ ...req.body, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(retailSellerGoals.id, parseInt(req.params.id)))
      .returning();
    res.json(goal);
  } catch (error) {
    console.error("Error updating seller goal:", error);
    res.status(500).json({ error: "Failed to update seller goal" });
  }
});

router.delete("/seller-goals/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(retailSellerGoals).where(eq(retailSellerGoals.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting seller goal:", error);
    res.status(500).json({ error: "Failed to delete seller goal" });
  }
});

// ========== METAS DA LOJA ==========
router.get("/store-goals", async (req: Request, res: Response) => {
  try {
    const { storeId, month, year } = req.query;
    const conditions = [];
    if (storeId) conditions.push(eq(retailStoreGoals.storeId, parseInt(storeId as string)));
    if (month) conditions.push(eq(retailStoreGoals.month, parseInt(month as string)));
    if (year) conditions.push(eq(retailStoreGoals.year, parseInt(year as string)));
    
    const goals = conditions.length > 0
      ? await db.select().from(retailStoreGoals).where(and(...conditions))
      : await db.select().from(retailStoreGoals);
    res.json(goals);
  } catch (error) {
    console.error("Error fetching store goals:", error);
    res.status(500).json({ error: "Failed to fetch store goals" });
  }
});

router.post("/store-goals", async (req: Request, res: Response) => {
  try {
    const [goal] = await db.insert(retailStoreGoals).values(req.body).returning();
    res.status(201).json(goal);
  } catch (error) {
    console.error("Error creating store goal:", error);
    res.status(500).json({ error: "Failed to create store goal" });
  }
});

router.put("/store-goals/:id", async (req: Request, res: Response) => {
  try {
    const [goal] = await db.update(retailStoreGoals)
      .set({ ...req.body, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(retailStoreGoals.id, parseInt(req.params.id)))
      .returning();
    res.json(goal);
  } catch (error) {
    console.error("Error updating store goal:", error);
    res.status(500).json({ error: "Failed to update store goal" });
  }
});

// ========== FECHAMENTO DE COMISSÃO ==========
router.get("/commission-closures", async (req: Request, res: Response) => {
  try {
    const { sellerId, storeId, status, periodType } = req.query;
    const conditions = [];
    if (sellerId) conditions.push(eq(retailCommissionClosures.sellerId, parseInt(sellerId as string)));
    if (storeId) conditions.push(eq(retailCommissionClosures.storeId, parseInt(storeId as string)));
    if (status) conditions.push(eq(retailCommissionClosures.status, status as string));
    if (periodType) conditions.push(eq(retailCommissionClosures.periodType, periodType as string));
    
    const closures = conditions.length > 0
      ? await db.select().from(retailCommissionClosures).where(and(...conditions)).orderBy(desc(retailCommissionClosures.createdAt))
      : await db.select().from(retailCommissionClosures).orderBy(desc(retailCommissionClosures.createdAt));
    res.json(closures);
  } catch (error) {
    console.error("Error fetching commission closures:", error);
    res.status(500).json({ error: "Failed to fetch commission closures" });
  }
});

router.post("/commission-closures", async (req: Request, res: Response) => {
  try {
    const [closure] = await db.insert(retailCommissionClosures).values(req.body).returning();
    res.status(201).json(closure);
  } catch (error) {
    console.error("Error creating commission closure:", error);
    res.status(500).json({ error: "Failed to create commission closure" });
  }
});

router.put("/commission-closures/:id", async (req: Request, res: Response) => {
  try {
    const [closure] = await db.update(retailCommissionClosures)
      .set({ ...req.body, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(retailCommissionClosures.id, parseInt(req.params.id)))
      .returning();
    res.json(closure);
  } catch (error) {
    console.error("Error updating commission closure:", error);
    res.status(500).json({ error: "Failed to update commission closure" });
  }
});

// Calcular comissões para período
router.post("/commission-closures/calculate", async (req: Request, res: Response) => {
  try {
    const { sellerId, storeId, periodType, periodStart, periodEnd, commissionRate } = req.body;
    
    // Buscar vendas do período
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    endDate.setHours(23, 59, 59, 999);
    
    const salesConditions = [
      gte(posSales.createdAt, startDate),
      lte(posSales.createdAt, endDate),
      eq(posSales.status, "completed")
    ];
    
    // Se sellerId, buscar vendas do vendedor específico
    let sellerName: string | undefined;
    if (sellerId) {
      const [seller] = await db.select().from(retailSellers).where(eq(retailSellers.id, sellerId));
      if (seller) {
        sellerName = seller.name;
        salesConditions.push(eq(posSales.soldBy, seller.name));
      }
    }
    
    const sales = await db.select().from(posSales).where(and(...salesConditions));
    
    // Calcular total de vendas
    const totalSales = sales.reduce((sum, s) => sum + parseFloat(s.totalAmount || "0"), 0);
    const salesCount = sales.length;
    
    // Buscar devoluções do MÊS CORRENTE (independente da data da venda original)
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    
    const currentMonthEnd = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 0);
    currentMonthEnd.setHours(23, 59, 59, 999);
    
    const returnConditions = [
      gte(returnExchanges.createdAt, currentMonthStart),
      lte(returnExchanges.createdAt, currentMonthEnd),
      eq(returnExchanges.returnType, "return"),
      eq(returnExchanges.status, "approved")
    ];
    
    const returns = await db.select().from(returnExchanges).where(and(...returnConditions));
    
    // Filtrar devoluções do vendedor se necessário (precisa cruzar com vendas originais)
    let totalReturns = 0;
    let returnsCount = 0;
    
    for (const ret of returns) {
      if (ret.originalSaleId) {
        const [originalSale] = await db.select().from(posSales).where(eq(posSales.id, ret.originalSaleId));
        if (originalSale) {
          if (!sellerName || originalSale.soldBy === sellerName) {
            totalReturns += parseFloat(ret.refundAmount || "0");
            returnsCount++;
          }
        }
      }
    }
    
    // Calcular comissão
    const netSales = totalSales - totalReturns;
    const rate = parseFloat(commissionRate || "0") / 100;
    const commissionAmount = netSales * rate;
    
    // Verificar meta para bônus
    let bonusAmount = 0;
    if (sellerId) {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const [goal] = await db.select().from(retailSellerGoals)
        .where(and(
          eq(retailSellerGoals.sellerId, sellerId),
          eq(retailSellerGoals.month, currentMonth),
          eq(retailSellerGoals.year, currentYear)
        ));
      
      if (goal && netSales >= parseFloat(goal.goalAmount)) {
        bonusAmount = parseFloat(goal.bonus || "0");
      }
    }
    
    res.json({
      sellerId,
      sellerName,
      periodType,
      periodStart,
      periodEnd,
      totalSales: totalSales.toFixed(2),
      totalReturns: totalReturns.toFixed(2),
      netSales: netSales.toFixed(2),
      commissionRate: commissionRate,
      commissionAmount: commissionAmount.toFixed(2),
      bonusAmount: bonusAmount.toFixed(2),
      totalAmount: (commissionAmount + bonusAmount).toFixed(2),
      salesCount,
      returnsCount,
      salesDetails: sales.map(s => ({ id: s.id, saleNumber: s.saleNumber, total: s.totalAmount, date: s.createdAt })),
      returnsDeducted: totalReturns > 0
    });
  } catch (error) {
    console.error("Error calculating commission:", error);
    res.status(500).json({ error: "Failed to calculate commission" });
  }
});

// Dashboard de vendas por vendedor
router.get("/commission-dashboard", async (req: Request, res: Response) => {
  try {
    const { month, year, storeId } = req.query;
    const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year as string) : new Date().getFullYear();
    
    // Calcular datas do período
    const periodStart = new Date(currentYear, currentMonth - 1, 1);
    const periodEnd = new Date(currentYear, currentMonth, 0);
    periodEnd.setHours(23, 59, 59, 999);
    
    // Buscar todos os vendedores ativos
    const sellers = await db.select().from(retailSellers).where(eq(retailSellers.isActive, true));
    
    // Buscar meta da loja
    const storeGoalConditions = [
      eq(retailStoreGoals.month, currentMonth),
      eq(retailStoreGoals.year, currentYear)
    ];
    if (storeId) storeGoalConditions.push(eq(retailStoreGoals.storeId, parseInt(storeId as string)));
    
    const [storeGoal] = await db.select().from(retailStoreGoals).where(and(...storeGoalConditions));
    
    // Buscar todas as vendas do período
    const sales = await db.select().from(posSales)
      .where(and(
        gte(posSales.createdAt, periodStart),
        lte(posSales.createdAt, periodEnd),
        eq(posSales.status, "completed")
      ));
    
    // Buscar devoluções do mês
    const returns = await db.select().from(returnExchanges)
      .where(and(
        gte(returnExchanges.createdAt, periodStart),
        lte(returnExchanges.createdAt, periodEnd),
        eq(returnExchanges.returnType, "return"),
        eq(returnExchanges.status, "approved")
      ));
    
    // Agrupar por vendedor
    const sellerStats = await Promise.all(sellers.map(async (seller) => {
      const sellerSales = sales.filter(s => s.soldBy === seller.name);
      const totalSales = sellerSales.reduce((sum, s) => sum + parseFloat(s.totalAmount || "0"), 0);
      
      // Calcular devoluções do vendedor
      let totalReturns = 0;
      for (const ret of returns) {
        if (ret.originalSaleId) {
          const [originalSale] = await db.select().from(posSales).where(eq(posSales.id, ret.originalSaleId));
          if (originalSale && originalSale.soldBy === seller.name) {
            totalReturns += parseFloat(ret.refundAmount || "0");
          }
        }
      }
      
      const netSales = totalSales - totalReturns;
      
      // Buscar meta do vendedor
      const [sellerGoal] = await db.select().from(retailSellerGoals)
        .where(and(
          eq(retailSellerGoals.sellerId, seller.id),
          eq(retailSellerGoals.month, currentMonth),
          eq(retailSellerGoals.year, currentYear)
        ));
      
      // Buscar plano de comissão
      let commissionRate = 0;
      if (seller.commissionPlanId) {
        const [plan] = await db.select().from(retailCommissionPlans).where(eq(retailCommissionPlans.id, seller.commissionPlanId));
        if (plan) {
          commissionRate = parseFloat(plan.basePercent || "0");
        }
      }
      
      const commissionAmount = netSales * (commissionRate / 100);
      const goalAmount = sellerGoal ? parseFloat(sellerGoal.goalAmount) : 0;
      const goalPercent = goalAmount > 0 ? (netSales / goalAmount) * 100 : 0;
      const metGoal = goalPercent >= 100;
      const bonus = metGoal && sellerGoal ? parseFloat(sellerGoal.bonus || "0") : 0;
      
      return {
        sellerId: seller.id,
        sellerName: seller.name,
        salesCount: sellerSales.length,
        totalSales,
        totalReturns,
        netSales,
        goalAmount,
        goalPercent: goalPercent.toFixed(1),
        metGoal,
        commissionRate,
        commissionAmount,
        bonus,
        totalCommission: commissionAmount + bonus
      };
    }));
    
    // Totais gerais
    const totalStoreSales = sales.reduce((sum, s) => sum + parseFloat(s.totalAmount || "0"), 0);
    const totalStoreReturns = returns.reduce((sum, r) => sum + parseFloat(r.refundAmount || "0"), 0);
    const netStoreSales = totalStoreSales - totalStoreReturns;
    const storeGoalAmount = storeGoal ? parseFloat(storeGoal.goalAmount) : 0;
    const storeGoalPercent = storeGoalAmount > 0 ? (netStoreSales / storeGoalAmount) * 100 : 0;
    
    res.json({
      period: { month: currentMonth, year: currentYear },
      store: {
        totalSales: totalStoreSales,
        totalReturns: totalStoreReturns,
        netSales: netStoreSales,
        goalAmount: storeGoalAmount,
        goalPercent: storeGoalPercent.toFixed(1),
        metGoal: storeGoalPercent >= 100,
        salesCount: sales.length,
        returnsCount: returns.length
      },
      sellers: sellerStats.sort((a, b) => b.netSales - a.netSales)
    });
  } catch (error) {
    console.error("Error fetching commission dashboard:", error);
    res.status(500).json({ error: "Failed to fetch commission dashboard" });
  }
});

// ========== PEDIDOS DE COMPRA ==========

// Listar pedidos de compra
router.get("/purchase-orders", async (req: Request, res: Response) => {
  try {
    const { status, supplierId, startDate, endDate, limit: queryLimit } = req.query;
    const limitNum = parseInt(queryLimit as string) || 100;
    
    let conditions: any[] = [];
    
    if (status) {
      conditions.push(eq(purchaseOrders.status, status as string));
    }
    if (supplierId) {
      conditions.push(eq(purchaseOrders.supplierId, parseInt(supplierId as string)));
    }
    if (startDate) {
      conditions.push(gte(purchaseOrders.orderDate, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(purchaseOrders.orderDate, new Date(endDate as string)));
    }
    
    const orders = conditions.length > 0
      ? await db.select().from(purchaseOrders).where(and(...conditions)).orderBy(desc(purchaseOrders.orderDate)).limit(limitNum)
      : await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.orderDate)).limit(limitNum);
    
    // Buscar itens e fornecedor para cada pedido
    const ordersWithDetails = await Promise.all(orders.map(async (order) => {
      const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, order.id));
      let supplier = null;
      if (order.supplierId) {
        const [s] = await db.select().from(suppliers).where(eq(suppliers.id, order.supplierId));
        supplier = s;
      }
      return { ...order, items, supplier };
    }));
    
    res.json(ordersWithDetails);
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    res.status(500).json({ error: "Failed to fetch purchase orders" });
  }
});

// Buscar pedido de compra por ID
router.get("/purchase-orders/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    
    if (!order) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    
    const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
    let supplier = null;
    if (order.supplierId) {
      const [s] = await db.select().from(suppliers).where(eq(suppliers.id, order.supplierId));
      supplier = s;
    }
    
    res.json({ ...order, items, supplier });
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    res.status(500).json({ error: "Failed to fetch purchase order" });
  }
});

// Criar pedido de compra
router.post("/purchase-orders", async (req: Request, res: Response) => {
  try {
    const { items, warehouseId, ...orderData } = req.body;
    const user = (req as any).user;
    
    // Gerar número do pedido
    const [lastOrder] = await db.select({ orderNumber: purchaseOrders.orderNumber })
      .from(purchaseOrders)
      .orderBy(desc(purchaseOrders.id))
      .limit(1);
    
    const lastNum = lastOrder ? parseInt(lastOrder.orderNumber.replace("PC", "")) || 0 : 0;
    const orderNumber = `PC${String(lastNum + 1).padStart(6, "0")}`;
    
    // Calcular total
    const total = items.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice));
    }, 0);
    
    // Criar pedido
    const [newOrder] = await db.insert(purchaseOrders).values({
      ...orderData,
      orderNumber,
      total: total.toString(),
      status: orderData.status || "draft"
    }).returning();
    
    // Criar itens
    for (const item of items) {
      const itemTotal = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      await db.insert(purchaseOrderItems).values({
        orderId: newOrder.id,
        productId: item.productId || null,
        productName: item.productName,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        total: itemTotal.toString()
      });
    }
    
    // Log activity
    await logActivity({
      activityType: "purchase_order_created",
      entityType: "purchase_order",
      entityId: newOrder.id,
      title: `Pedido de compra ${orderNumber} criado`,
      description: `Valor total: R$ ${total.toFixed(2)}`,
      createdBy: user?.id,
      createdByName: user?.name || user?.username,
      metadata: { orderNumber, total, itemCount: items.length, warehouseId }
    });
    
    res.status(201).json(newOrder);
  } catch (error) {
    console.error("Error creating purchase order:", error);
    res.status(500).json({ error: "Failed to create purchase order" });
  }
});

// Atualizar status do pedido de compra
router.patch("/purchase-orders/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const user = (req as any).user;
    
    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!order) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    
    const [updated] = await db.update(purchaseOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    
    await logActivity({
      activityType: "purchase_order_status_changed",
      entityType: "purchase_order",
      entityId: id,
      title: `Pedido ${order.orderNumber} - Status alterado para ${status}`,
      createdBy: user?.id,
      createdByName: user?.name || user?.username
    });
    
    res.json(updated);
  } catch (error) {
    console.error("Error updating purchase order status:", error);
    res.status(500).json({ error: "Failed to update purchase order status" });
  }
});

// Receber pedido de compra (entrada no estoque)
router.post("/purchase-orders/:id/receive", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { warehouseId, serials } = req.body; // serials: { itemId: ["serial1", "serial2"] }
    const user = (req as any).user;
    
    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!order) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    
    if (order.status === "received") {
      return res.status(400).json({ error: "Order already received" });
    }
    
    const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
    
    // Processar entrada de cada item
    for (const item of items) {
      const quantity = parseFloat(item.quantity);
      
      // Atualizar estoque do depósito
      if (item.productId) {
        const [existingStock] = await db.select().from(retailWarehouseStock)
          .where(and(
            eq(retailWarehouseStock.warehouseId, warehouseId),
            eq(retailWarehouseStock.productId, item.productId)
          ));
        
        if (existingStock) {
          await db.update(retailWarehouseStock)
            .set({ 
              quantity: (parseFloat(existingStock.quantity) + quantity).toString(),
              updatedAt: new Date()
            })
            .where(eq(retailWarehouseStock.id, existingStock.id));
        } else {
          await db.insert(retailWarehouseStock).values({
            warehouseId,
            productId: item.productId,
            quantity: quantity.toString()
          });
        }
        
        // Criar movimentação
        await db.insert(retailStockMovements).values({
          warehouseId,
          productId: item.productId,
          movementType: "entry",
          operationType: "purchase",
          quantity: quantity.toString(),
          unitCost: item.unitPrice,
          totalCost: item.total,
          referenceType: "purchase_order",
          referenceId: order.id,
          notes: `Pedido ${order.orderNumber}`,
          userId: user?.id
        });
      }
      
      // Registrar seriais/IMEIs se fornecidos
      const itemSerials = serials?.[item.id] || [];
      for (const serial of itemSerials) {
        if (serial && serial.trim()) {
          await db.insert(retailProductSerials).values({
            warehouseId,
            productId: item.productId || 0,
            serialNumber: serial.trim(),
            status: "in_stock",
            acquisitionCost: item.unitPrice
          });
        }
      }
    }
    
    // Atualizar status do pedido
    const [updated] = await db.update(purchaseOrders)
      .set({ status: "received", updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    
    await logActivity({
      activityType: "purchase_order_received",
      entityType: "purchase_order",
      entityId: id,
      title: `Pedido ${order.orderNumber} recebido`,
      description: `${items.length} itens entrada no depósito`,
      createdBy: user?.id,
      createdByName: user?.name || user?.username,
      metadata: { warehouseId, itemCount: items.length }
    });
    
    res.json({ success: true, order: updated });
  } catch (error) {
    console.error("Error receiving purchase order:", error);
    res.status(500).json({ error: "Failed to receive purchase order" });
  }
});

// Excluir pedido de compra (apenas rascunhos)
router.delete("/purchase-orders/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const user = (req as any).user;
    
    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!order) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    
    if (order.status !== "draft") {
      return res.status(400).json({ error: "Only draft orders can be deleted" });
    }
    
    // Excluir itens
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
    
    // Excluir pedido
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
    
    await logActivity({
      activityType: "purchase_order_deleted",
      entityType: "purchase_order",
      entityId: id,
      title: `Pedido ${order.orderNumber} excluído`,
      createdBy: user?.id,
      createdByName: user?.name || user?.username
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting purchase order:", error);
    res.status(500).json({ error: "Failed to delete purchase order" });
  }
});

// ========== DEVOLUÇÕES E CRÉDITOS ==========

// Listar devoluções
router.get("/returns", async (req: Request, res: Response) => {
  try {
    const { status, customerId, limit: queryLimit } = req.query;
    const limitNum = parseInt(queryLimit as string) || 100;
    
    let conditions: any[] = [];
    if (status) conditions.push(eq(returnExchanges.status, status as string));
    if (customerId) conditions.push(eq(returnExchanges.customerId, customerId as string));
    
    const returns = conditions.length > 0
      ? await db.select().from(returnExchanges).where(and(...conditions)).orderBy(desc(returnExchanges.createdAt)).limit(limitNum)
      : await db.select().from(returnExchanges).orderBy(desc(returnExchanges.createdAt)).limit(limitNum);
    
    // Buscar itens de cada devolução
    const returnsWithItems = await Promise.all(returns.map(async (ret) => {
      const items = await db.select().from(returnExchangeItems).where(eq(returnExchangeItems.returnId, ret.id));
      return { ...ret, items };
    }));
    
    res.json(returnsWithItems);
  } catch (error) {
    console.error("Error fetching returns:", error);
    res.status(500).json({ error: "Failed to fetch returns" });
  }
});

// Criar devolução com geração de crédito
router.post("/returns", async (req: Request, res: Response) => {
  try {
    const { items, generateCredit, creditExpirationDays, ...returnData } = req.body;
    const user = (req as any).user;
    
    // Gerar número da devolução
    const [lastReturn] = await db.select({ returnNumber: returnExchanges.returnNumber })
      .from(returnExchanges)
      .orderBy(desc(returnExchanges.id))
      .limit(1);
    
    const lastNum = lastReturn ? parseInt(lastReturn.returnNumber.replace("DEV", "")) || 0 : 0;
    const returnNumber = `DEV${String(lastNum + 1).padStart(6, "0")}`;
    
    // Criar devolução
    const [newReturn] = await db.insert(returnExchanges).values({
      ...returnData,
      returnNumber,
      processedBy: user?.name || user?.username,
      status: "approved"
    }).returning();
    
    // Criar itens da devolução
    let totalRefund = 0;
    for (const item of items || []) {
      const itemTotal = parseFloat(item.quantity || 1) * parseFloat(item.unitPrice || "0");
      totalRefund += itemTotal;
      await db.insert(returnExchangeItems).values({
        returnId: newReturn.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: parseInt(item.quantity) || 1,
        imei: item.imei,
        deviceId: item.deviceId,
        reason: item.reason,
        refundAmount: itemTotal.toString()
      });
    }
    
    // Atualizar valor total da devolução
    await db.update(returnExchanges)
      .set({ refundAmount: totalRefund.toString() })
      .where(eq(returnExchanges.id, newReturn.id));
    
    // Gerar crédito para o cliente se solicitado
    let credit = null;
    if (generateCredit && returnData.customerId && totalRefund > 0) {
      // Buscar dados do cliente
      const [customer] = await db.select().from(persons).where(eq(persons.id, parseInt(returnData.customerId)));
      
      const expiresAt = creditExpirationDays 
        ? new Date(Date.now() + creditExpirationDays * 24 * 60 * 60 * 1000)
        : null;
      
      const [newCredit] = await db.insert(customerCredits).values({
        personId: parseInt(returnData.customerId),
        customerName: customer?.fullName || returnData.customerName || "Cliente",
        customerCpf: customer?.cpfCnpj || null,
        amount: totalRefund.toString(),
        usedAmount: "0",
        remainingAmount: totalRefund.toString(),
        origin: "refund",
        originId: newReturn.id,
        description: `Crédito de devolução ${returnNumber}`,
        expiresAt,
        status: "active",
        createdBy: user?.name || user?.username
      }).returning();
      
      credit = newCredit;
    }
    
    await logActivity({
      activityType: "return_created",
      entityType: "return",
      entityId: newReturn.id,
      title: `Devolução ${returnNumber} registrada`,
      description: `Valor: R$ ${totalRefund.toFixed(2)}${credit ? " - Crédito gerado" : ""}`,
      createdBy: user?.id,
      createdByName: user?.name || user?.username
    });
    
    res.status(201).json({ return: { ...newReturn, refundAmount: totalRefund }, credit });
  } catch (error) {
    console.error("Error creating return:", error);
    res.status(500).json({ error: "Failed to create return" });
  }
});

// Listar créditos de um cliente
router.get("/customer-credits/:personId", async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.params.personId);
    
    const credits = await db.select().from(customerCredits)
      .where(eq(customerCredits.personId, personId))
      .orderBy(desc(customerCredits.createdAt));
    
    // Calcular saldo total disponível
    const activeCredits = credits.filter(c => c.status === "active");
    const totalAvailable = activeCredits.reduce((sum, c) => sum + parseFloat(c.remainingAmount || "0"), 0);
    
    res.json({ credits, totalAvailable });
  } catch (error) {
    console.error("Error fetching customer credits:", error);
    res.status(500).json({ error: "Failed to fetch customer credits" });
  }
});

// Obter comprovante de crédito
router.get("/customer-credits/:creditId/receipt", async (req: Request, res: Response) => {
  try {
    const creditId = parseInt(req.params.creditId);
    
    const [credit] = await db.select().from(customerCredits).where(eq(customerCredits.id, creditId));
    if (!credit) {
      return res.status(404).json({ error: "Credit not found" });
    }
    
    // Buscar dados do cliente
    const [customer] = await db.select().from(persons).where(eq(persons.id, credit.personId));
    
    // Buscar dados da origem (se for devolução)
    let originData = null;
    if (credit.origin === "refund" && credit.originId) {
      const [returnData] = await db.select().from(returnExchanges).where(eq(returnExchanges.id, credit.originId));
      originData = returnData;
    }
    
    res.json({
      credit,
      customer,
      originData,
      receiptData: {
        title: "COMPROVANTE DE CRÉDITO",
        creditNumber: `CR${String(credit.id).padStart(6, "0")}`,
        customerName: credit.customerName,
        customerCpf: credit.customerCpf,
        amount: credit.amount,
        remainingAmount: credit.remainingAmount,
        origin: credit.origin === "refund" ? "Devolução" : 
                credit.origin === "trade_in" ? "Trade-In" :
                credit.origin === "bonus" ? "Bonificação" : "Promoção",
        originNumber: originData?.returnNumber || null,
        createdAt: credit.createdAt,
        expiresAt: credit.expiresAt,
        status: credit.status
      }
    });
  } catch (error) {
    console.error("Error fetching credit receipt:", error);
    res.status(500).json({ error: "Failed to fetch credit receipt" });
  }
});

// Usar crédito em uma venda
router.post("/customer-credits/:creditId/use", async (req: Request, res: Response) => {
  try {
    const creditId = parseInt(req.params.creditId);
    const { amount, saleId } = req.body;
    const user = (req as any).user;
    
    const [credit] = await db.select().from(customerCredits).where(eq(customerCredits.id, creditId));
    if (!credit) {
      return res.status(404).json({ error: "Credit not found" });
    }
    
    if (credit.status !== "active") {
      return res.status(400).json({ error: "Credit is not active" });
    }
    
    const remaining = parseFloat(credit.remainingAmount || "0");
    const useAmount = Math.min(parseFloat(amount), remaining);
    
    if (useAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    
    const newRemaining = remaining - useAmount;
    const newUsed = parseFloat(credit.usedAmount || "0") + useAmount;
    const newStatus = newRemaining <= 0 ? "used" : "active";
    
    const [updated] = await db.update(customerCredits)
      .set({
        usedAmount: newUsed.toString(),
        remainingAmount: newRemaining.toString(),
        status: newStatus,
        usedInSaleId: saleId || null,
        updatedAt: new Date()
      })
      .where(eq(customerCredits.id, creditId))
      .returning();
    
    await logActivity({
      activityType: "credit_used",
      entityType: "customer_credit",
      entityId: creditId,
      title: `Crédito utilizado: R$ ${useAmount.toFixed(2)}`,
      description: `Cliente: ${credit.customerName}`,
      createdBy: user?.id,
      createdByName: user?.name || user?.username
    });
    
    res.json({ credit: updated, amountUsed: useAmount });
  } catch (error) {
    console.error("Error using credit:", error);
    res.status(500).json({ error: "Failed to use credit" });
  }
});

// ========== PLUS ERP SYNC ROUTES ==========

const plusSync = retailPlusSyncService;

router.get("/plus/status", async (req: Request, res: Response) => {
  try {
    const status = await plusSync.getPlusStatus();
    res.json(status);
  } catch (error) {
    console.error("Error checking Plus status:", error);
    res.status(500).json({ error: "Failed to check Plus connection" });
  }
});

router.post("/plus/sync/customers", requireModule("plus"), async (req: Request, res: Response) => {
  try {
    const { tenantId, empresaId } = req.body;
    if (!tenantId) return res.status(400).json({ error: "tenantId required" });
    const result = await plusSync.syncAllPersonsToPlus(tenantId, empresaId);
    res.json(result);
  } catch (error) {
    console.error("Error syncing customers to Plus:", error);
    res.status(500).json({ error: "Failed to sync customers" });
  }
});

router.post("/plus/sync/sales", requireModule("plus"), async (req: Request, res: Response) => {
  try {
    const { saleId } = req.body;
    if (!saleId) return res.status(400).json({ error: "saleId required" });
    const result = await plusSync.syncSaleToPlus(saleId);
    res.json(result);
  } catch (error) {
    console.error("Error syncing sale to Plus:", error);
    res.status(500).json({ error: "Failed to sync sale" });
  }
});

router.post("/plus/sync/nfe", requireModule("plus"), async (req: Request, res: Response) => {
  try {
    const { saleId, tipo } = req.body;
    if (!saleId) return res.status(400).json({ error: "saleId required" });
    const result = await plusSync.emitirNFeSale(saleId, tipo || "nfce");
    res.json(result);
  } catch (error) {
    console.error("Error emitting NF-e:", error);
    res.status(500).json({ error: "Failed to emit NF-e" });
  }
});

router.post("/plus/import/customers", requireModule("plus"), async (req: Request, res: Response) => {
  try {
    const { tenantId, empresaId } = req.body;
    if (!tenantId) return res.status(400).json({ error: "tenantId required" });
    const result = await plusSync.importClientesFromPlus(tenantId, empresaId);
    res.json(result);
  } catch (error) {
    console.error("Error importing customers from Plus:", error);
    res.status(500).json({ error: "Failed to import customers" });
  }
});

router.post("/plus/import/products", requireModule("plus"), async (req: Request, res: Response) => {
  try {
    const { tenantId, empresaId } = req.body;
    if (!tenantId) return res.status(400).json({ error: "tenantId required" });
    const result = await plusSync.importProdutosFromPlus(tenantId, empresaId);
    res.json(result);
  } catch (error) {
    console.error("Error importing products from Plus:", error);
    res.status(500).json({ error: "Failed to import products" });
  }
});

router.get("/plus/empresas", async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.query.tenantId as string) || 1;
    const empresas = await db.select().from(tenantEmpresas)
      .where(and(eq(tenantEmpresas.tenantId, tenantId), eq(tenantEmpresas.status, "active")));
    res.json(empresas);
  } catch (error) {
    console.error("Error fetching empresas:", error);
    res.status(500).json({ error: "Failed to fetch empresas" });
  }
});

router.post("/plus/empresas", async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.body.tenantId as string) || 1;
    const { razaoSocial, nomeFantasia, cnpj, tipo } = req.body;
    if (!razaoSocial || !cnpj) return res.status(400).json({ error: "razaoSocial and cnpj required" });
    const [empresa] = await db.insert(tenantEmpresas).values({
      tenantId,
      razaoSocial,
      nomeFantasia: nomeFantasia || razaoSocial,
      cnpj,
      tipo: tipo || "matriz",
      status: "active",
    }).returning();
    res.json(empresa);
  } catch (error) {
    console.error("Error creating empresa:", error);
    res.status(500).json({ error: "Failed to create empresa" });
  }
});

router.post("/plus/empresas/:id/bind", async (req: Request, res: Response) => {
  try {
    const empresaLocalId = parseInt(req.params.id);
    const { plusEmpresaId } = req.body;
    if (!plusEmpresaId) return res.status(400).json({ error: "plusEmpresaId required" });

    const [updated] = await db.update(tenantEmpresas)
      .set({ plusEmpresaId })
      .where(eq(tenantEmpresas.id, empresaLocalId))
      .returning();
    
    res.json(updated);
  } catch (error) {
    console.error("Error binding empresa to Plus:", error);
    res.status(500).json({ error: "Failed to bind empresa" });
  }
});

export default router;

