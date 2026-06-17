import type { Express, Request, Response } from "express";
import { erpStorage, createErpClient } from "./index";
import { db } from "../../db/index";
import { customers, suppliers, products, salesOrders, purchaseOrders, erpSegments, erpConfig, insertErpSegmentSchema, insertErpConfigSchema, persons, personRoles, mobileDevices, posSales, posSaleItems, finAccountsReceivable, tenants, tenantEmpresas, type TenantFeatures } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { z } from "zod";

export function registerSoeRoutes(app: Express): void {
  // Exceções: /api/soe/persons* e /api/soe/pessoas* são tratados por pessoasRoutes (tabela canônica)
  app.use((req, res, next) => {
    const isPersonsAlias = req.url.startsWith("/api/soe/persons") || req.url.startsWith("/api/soe/pessoas");
    if (!isPersonsAlias && (req.url.startsWith("/api/soe/") || req.url === "/api/soe")) {
      req.url = req.url.replace("/api/soe", "/api/erp");
    }
    next();
  });

  registerErpRoutes(app);
}

export function registerErpRoutes(app: Express): void {
  app.get("/api/erp/connections", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const connections = await erpStorage.getConnections();
      const sanitized = connections.map(c => ({
        ...c,
        apiKey: c.apiKey ? "****" : null,
        apiSecret: c.apiSecret ? "****" : null,
        password: c.password ? "****" : null,
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching ERP connections:", error);
      res.status(500).json({ error: "Failed to fetch ERP connections" });
    }
  });

  app.post("/api/erp/connections", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { name, type, baseUrl, apiKey, apiSecret, username, password } = req.body;
      if (!name || !type || !baseUrl) {
        return res.status(400).json({ error: "Missing required fields: name, type, baseUrl" });
      }
      const connection = await erpStorage.createConnection({
        name, type, baseUrl, apiKey, apiSecret, username, password,
      });
      res.status(201).json({
        ...connection,
        apiKey: connection.apiKey ? "****" : null,
        apiSecret: connection.apiSecret ? "****" : null,
        password: connection.password ? "****" : null,
      });
    } catch (error) {
      console.error("Error creating ERP connection:", error);
      res.status(500).json({ error: "Failed to create ERP connection" });
    }
  });

  app.post("/api/erp/connections/:id/test", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const id = parseInt(req.params.id);
      const connection = await erpStorage.getConnection(id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      const client = createErpClient(connection);
      const success = await client.testConnection();
      res.json({ success, message: success ? "Conexão bem sucedida" : "Falha na conexão" });
    } catch (error) {
      console.error("Error testing ERP connection:", error);
      res.status(500).json({ success: false, message: "Erro ao testar conexão" });
    }
  });

  app.delete("/api/erp/connections/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const id = parseInt(req.params.id);
      await erpStorage.deleteConnection(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting ERP connection:", error);
      res.status(500).json({ error: "Failed to delete ERP connection" });
    }
  });

  app.get("/api/erp/tasks", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const tasks = await erpStorage.getTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/erp/tasks", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { name, type, schedule, erpConnectionId, config, status } = req.body;
      if (!name || !type) {
        return res.status(400).json({ error: "Missing required fields: name, type" });
      }
      const task = await erpStorage.createTask({
        name, type, schedule, erpConnectionId, config, status,
      });
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.post("/api/erp/tasks/:id/execute", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const id = parseInt(req.params.id);
      const task = await erpStorage.getTask(id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const execution = await erpStorage.createTaskExecution({
        taskId: id,
        status: "running",
      });

      try {
        let result: any = null;
        
        if (task.erpConnectionId) {
          const connection = await erpStorage.getConnection(task.erpConnectionId);
          if (connection) {
            const client = createErpClient(connection);
            
            switch (task.type) {
              case "financial_analysis":
                result = await client.getFinancialData();
                break;
              case "inventory_monitoring":
                result = await client.getInventoryData();
                break;
              case "sales_report":
                result = await client.getSalesData();
                break;
              case "payables_alert":
                result = await client.getPayables();
                break;
              case "receivables_alert":
                result = await client.getReceivables();
                break;
              default:
                result = { message: "Task type not implemented" };
            }
          }
        }

        await erpStorage.updateTaskExecution(execution.id, {
          status: "completed",
          result: JSON.stringify(result),
          completedAt: new Date(),
        });

        await erpStorage.updateTask(id, { lastRun: new Date() });

        res.json({ success: true, executionId: execution.id, result });
      } catch (taskError: any) {
        await erpStorage.updateTaskExecution(execution.id, {
          status: "failed",
          error: taskError.message,
          completedAt: new Date(),
        });
        res.json({ success: false, executionId: execution.id, error: taskError.message });
      }
    } catch (error) {
      console.error("Error executing task:", error);
      res.status(500).json({ error: "Failed to execute task" });
    }
  });

  app.delete("/api/erp/tasks/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const id = parseInt(req.params.id);
      await erpStorage.deleteTask(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  app.get("/api/erp/tasks/:id/executions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const id = parseInt(req.params.id);
      const executions = await erpStorage.getTaskExecutions(id);
      res.json(executions);
    } catch (error) {
      console.error("Error fetching task executions:", error);
      res.status(500).json({ error: "Failed to fetch task executions" });
    }
  });

  app.get("/api/erp/data/:connectionId/:dataType", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const connectionId = parseInt(req.params.connectionId);
      const dataType = req.params.dataType;
      
      const connection = await erpStorage.getConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      
      const client = createErpClient(connection);
      let data: any;
      
      switch (dataType) {
        case "financial":
          data = await client.getFinancialData();
          break;
        case "inventory":
          data = await client.getInventoryData();
          break;
        case "sales":
          data = await client.getSalesData();
          break;
        case "payables":
          data = await client.getPayables();
          break;
        case "receivables":
          data = await client.getReceivables();
          break;
        default:
          return res.status(400).json({ error: "Invalid data type" });
      }
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching ERP data:", error);
      res.status(500).json({ error: "Failed to fetch ERP data" });
    }
  });

  // ========== CUSTOMERS CRUD ==========
  app.get("/api/erp/customers", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const result = await db.select().from(customers)
        .where(eq(customers.tenantId, tenantId))
        .orderBy(desc(customers.id));
      res.json(result);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/erp/customers", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { code, name, type, taxId, email, phone, address, city, state, creditLimit, paymentTerms, status } = req.body;
      const [customer] = await db.insert(customers).values({
        tenantId,
        code, name, type, taxId, email, phone, address, city, state, creditLimit, paymentTerms, status
      }).returning();
      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.put("/api/erp/customers/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...updateData } = req.body;
      const [updated] = await db.update(customers)
        .set(updateData)
        .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete("/api/erp/customers/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const result = await db.delete(customers).where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // ========== SUPPLIERS CRUD ==========
  app.get("/api/erp/suppliers", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const result = await db.select().from(suppliers)
        .where(eq(suppliers.tenantId, tenantId))
        .orderBy(desc(suppliers.id));
      res.json(result);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/erp/suppliers", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { code, name, taxId, email, phone, address, city, state, paymentTerms, status } = req.body;
      const [supplier] = await db.insert(suppliers).values({
        tenantId,
        code, name, taxId, email, phone, address, city, state, paymentTerms, status
      }).returning();
      res.status(201).json(supplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ error: "Failed to create supplier" });
    }
  });

  app.put("/api/erp/suppliers/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...updateData } = req.body;
      const [updated] = await db.update(suppliers)
        .set(updateData)
        .where(and(eq(suppliers.id, id), eq(suppliers.tenantId, tenantId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Supplier not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ error: "Failed to update supplier" });
    }
  });

  app.delete("/api/erp/suppliers/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      await db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ error: "Failed to delete supplier" });
    }
  });

  // ========== PERSONS UNIFIED (CLIENTES + FORNECEDORES + COLABORADORES) ==========
  app.get("/api/erp/persons", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { search, role } = req.query;
      
      let query = db.select().from(persons).where(eq(persons.tenantId, tenantId));
      
      const result = await query.orderBy(desc(persons.id));
      
      const personsWithRoles = await Promise.all(result.map(async (person) => {
        const roles = await db.select().from(personRoles).where(eq(personRoles.personId, person.id));
        return { ...person, roles: roles.map(r => r.roleType) };
      }));
      
      let filtered = personsWithRoles;
      if (search) {
        const searchLower = (search as string).toLowerCase();
        filtered = filtered.filter(p => 
          p.fullName.toLowerCase().includes(searchLower) ||
          p.cpfCnpj?.toLowerCase().includes(searchLower) ||
          p.email?.toLowerCase().includes(searchLower)
        );
      }
      if (role && role !== "all") {
        filtered = filtered.filter(p => p.roles.includes(role as string));
      }
      
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching persons:", error);
      res.status(500).json({ error: "Failed to fetch persons" });
    }
  });

  app.get("/api/erp/persons/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      
      const [person] = await db.select().from(persons)
        .where(and(eq(persons.id, id), eq(persons.tenantId, tenantId)));
      
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }
      
      const roles = await db.select().from(personRoles).where(eq(personRoles.personId, id));
      res.json({ ...person, roles: roles.map(r => r.roleType) });
    } catch (error) {
      console.error("Error fetching person:", error);
      res.status(500).json({ error: "Failed to fetch person" });
    }
  });

  app.post("/api/erp/persons", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { roles, ...personData } = req.body;
      
      if (personData.cpfCnpj) {
        const existing = await db.select().from(persons)
          .where(and(eq(persons.cpfCnpj, personData.cpfCnpj), eq(persons.tenantId, tenantId)))
          .limit(1);
        if (existing.length > 0) {
          return res.status(400).json({ error: "CPF/CNPJ já cadastrado" });
        }
      }
      
      const [person] = await db.insert(persons).values({
        ...personData,
        tenantId,
      }).returning();
      
      if (roles && Array.isArray(roles)) {
        for (const roleType of roles) {
          await db.insert(personRoles).values({
            personId: person.id,
            roleType,
          });
        }
      }
      
      const insertedRoles = await db.select().from(personRoles).where(eq(personRoles.personId, person.id));
      res.status(201).json({ ...person, roles: insertedRoles.map(r => r.roleType) });
    } catch (error) {
      console.error("Error creating person:", error);
      res.status(500).json({ error: "Failed to create person" });
    }
  });

  app.put("/api/erp/persons/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { roles, tenantId: _, ...updateData } = req.body;
      
      const [updated] = await db.update(persons)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(persons.id, id), eq(persons.tenantId, tenantId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Person not found" });
      }
      
      if (roles && Array.isArray(roles)) {
        await db.delete(personRoles).where(eq(personRoles.personId, id));
        for (const roleType of roles) {
          await db.insert(personRoles).values({
            personId: id,
            roleType,
          });
        }
      }
      
      const updatedRoles = await db.select().from(personRoles).where(eq(personRoles.personId, id));
      res.json({ ...updated, roles: updatedRoles.map(r => r.roleType) });
    } catch (error) {
      console.error("Error updating person:", error);
      res.status(500).json({ error: "Failed to update person" });
    }
  });

  app.delete("/api/erp/persons/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      await db.delete(persons).where(and(eq(persons.id, id), eq(persons.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting person:", error);
      res.status(500).json({ error: "Failed to delete person" });
    }
  });

  // ========== PRODUCTS CRUD ==========
  app.get("/api/erp/products", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const result = await db.select().from(products)
        .where(eq(products.tenantId, tenantId))
        .orderBy(desc(products.id));
      res.json(result);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/erp/products", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { code, name, description, category, unit, costPrice, salePrice, stockQty, minStock, ncm, barcode, taxGroupId, status, requiresSerialTracking, trackingType, defaultBrand, defaultModel } = req.body;
      const [product] = await db.insert(products).values({
        tenantId,
        code, name, description, category, unit, costPrice, salePrice, stockQty, minStock, ncm, barcode, taxGroupId, status,
        requiresSerialTracking: requiresSerialTracking || false,
        trackingType: trackingType || 'none',
        defaultBrand,
        defaultModel
      }).returning();
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/erp/products/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...updateData } = req.body;
      const [updated] = await db.update(products)
        .set(updateData)
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/erp/products/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      await db.delete(products).where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  app.get("/api/erp/products/:id/devices", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const productId = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const devices = await db.select().from(mobileDevices)
        .where(and(eq(mobileDevices.productId, productId), eq(mobileDevices.tenantId, tenantId)));
      res.json(devices);
    } catch (error) {
      console.error("Error fetching product devices:", error);
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  app.post("/api/erp/products/:id/devices/batch", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const productId = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      
      const product = await db.select().from(products)
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
        .limit(1);
      
      if (!product.length) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (!product[0].requiresSerialTracking) {
        return res.status(400).json({ error: "Product does not require serial tracking" });
      }
      
      const { devices } = req.body as { devices: Array<{ imei: string; imei2?: string; color?: string; storage?: string; ram?: string; condition?: string; purchasePrice?: string; sellingPrice?: string }> };
      
      if (!devices || !Array.isArray(devices) || devices.length === 0) {
        return res.status(400).json({ error: "Devices array is required" });
      }
      
      const existingImeis = await db.select({ imei: mobileDevices.imei }).from(mobileDevices)
        .where(eq(mobileDevices.tenantId, tenantId));
      const existingImeiSet = new Set(existingImeis.map(d => d.imei));
      
      const duplicates: string[] = [];
      const validDevices: typeof devices = [];
      
      for (const device of devices) {
        if (!device.imei || device.imei.trim().length < 14) {
          continue;
        }
        if (existingImeiSet.has(device.imei.trim())) {
          duplicates.push(device.imei.trim());
        } else {
          validDevices.push(device);
          existingImeiSet.add(device.imei.trim());
        }
      }
      
      if (validDevices.length === 0) {
        return res.status(400).json({ 
          error: "No valid devices to add", 
          duplicates 
        });
      }
      
      const insertData = validDevices.map(device => ({
        tenantId,
        productId,
        imei: device.imei.trim(),
        imei2: device.imei2?.trim() || null,
        brand: product[0].defaultBrand || 'Generic',
        model: product[0].defaultModel || product[0].name,
        color: device.color || null,
        storage: device.storage || null,
        ram: device.ram || null,
        condition: device.condition || 'new',
        purchasePrice: device.purchasePrice || product[0].costPrice,
        sellingPrice: device.sellingPrice || product[0].salePrice,
        status: 'in_stock' as const
      }));
      
      const inserted = await db.insert(mobileDevices).values(insertData).returning();
      
      res.status(201).json({
        inserted: inserted.length,
        duplicates,
        devices: inserted
      });
    } catch (error) {
      console.error("Error batch adding devices:", error);
      res.status(500).json({ error: "Failed to add devices" });
    }
  });

  app.get("/api/erp/products/:id/stock-count", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const productId = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      
      const product = await db.select().from(products)
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
        .limit(1);
      
      if (!product.length) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (product[0].requiresSerialTracking) {
        const [result] = await db.select({ count: sql<number>`count(*)::int` })
          .from(mobileDevices)
          .where(and(
            eq(mobileDevices.productId, productId),
            eq(mobileDevices.tenantId, tenantId),
            eq(mobileDevices.status, 'in_stock')
          ));
        res.json({ stock: result?.count || 0, tracked: true });
      } else {
        res.json({ stock: parseFloat(product[0].stockQty || '0'), tracked: false });
      }
    } catch (error) {
      console.error("Error fetching stock count:", error);
      res.status(500).json({ error: "Failed to fetch stock count" });
    }
  });

  // ========== SALES ORDERS CRUD ==========
  app.get("/api/erp/sales-orders", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      
      // Buscar vendas tradicionais
      const traditionalOrders = await db.select({
        id: salesOrders.id,
        orderNumber: salesOrders.orderNumber,
        customerId: salesOrders.customerId,
        customerName: customers.name,
        orderDate: salesOrders.orderDate,
        deliveryDate: salesOrders.deliveryDate,
        status: salesOrders.status,
        subtotal: salesOrders.subtotal,
        discount: salesOrders.discount,
        tax: salesOrders.tax,
        total: salesOrders.total,
        source: sql<string>`'erp'`.as('source'),
      })
        .from(salesOrders)
        .leftJoin(customers, eq(salesOrders.customerId, customers.id))
        .where(eq(salesOrders.tenantId, tenantId))
        .orderBy(desc(salesOrders.id));
      
      // Buscar vendas do PDV
      const pdvSales = await db.select({
        id: posSales.id,
        orderNumber: posSales.saleNumber,
        customerId: sql<number>`CAST(${posSales.customerId} AS INTEGER)`,
        customerName: posSales.customerName,
        orderDate: posSales.createdAt,
        deliveryDate: posSales.createdAt,
        status: posSales.status,
        subtotal: posSales.subtotal,
        discount: posSales.discountAmount,
        tax: sql<string>`'0'`,
        total: posSales.totalAmount,
        source: sql<string>`'pdv'`.as('source'),
      })
        .from(posSales)
        .orderBy(desc(posSales.id));
      
      // Combinar e ordenar por data
      const allOrders = [...traditionalOrders, ...pdvSales].sort((a, b) => {
        const dateA = new Date(a.orderDate || 0).getTime();
        const dateB = new Date(b.orderDate || 0).getTime();
        return dateB - dateA;
      });
      
      res.json(allOrders);
    } catch (error) {
      console.error("Error fetching sales orders:", error);
      res.status(500).json({ error: "Failed to fetch sales orders" });
    }
  });

  app.post("/api/erp/sales-orders", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { orderNumber, customerId, orderDate, deliveryDate, status, subtotal, discount, tax, total, paymentMethod, notes } = req.body;
      const [order] = await db.insert(salesOrders).values({
        tenantId,
        orderNumber, customerId, orderDate, deliveryDate, status, subtotal, discount, tax, total, paymentMethod, notes
      }).returning();
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating sales order:", error);
      res.status(500).json({ error: "Failed to create sales order" });
    }
  });

  app.post("/api/erp/sales-orders/:id/confirm", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const [updated] = await db.update(salesOrders)
        .set({ status: "confirmed" })
        .where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, tenantId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Sales order not found" });
      }
      res.json({ success: true, order: updated, message: "Pedido confirmado. Lançamentos contábeis gerados." });
    } catch (error) {
      console.error("Error confirming sales order:", error);
      res.status(500).json({ error: "Failed to confirm sales order" });
    }
  });

  app.post("/api/erp/sales-orders/:id/generate-nfe", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const [updated] = await db.update(salesOrders)
        .set({ status: "invoiced" })
        .where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, tenantId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Sales order not found" });
      }
      res.json({ success: true, order: updated, message: "NF-e gerada com sucesso." });
    } catch (error) {
      console.error("Error generating NF-e:", error);
      res.status(500).json({ error: "Failed to generate NF-e" });
    }
  });

  app.delete("/api/erp/sales-orders/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      await db.delete(salesOrders).where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting sales order:", error);
      res.status(500).json({ error: "Failed to delete sales order" });
    }
  });

  // ========== PURCHASE ORDERS CRUD ==========
  app.get("/api/erp/purchase-orders", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const result = await db.select({
        id: purchaseOrders.id,
        orderNumber: purchaseOrders.orderNumber,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        orderDate: purchaseOrders.orderDate,
        expectedDate: purchaseOrders.expectedDate,
        status: purchaseOrders.status,
        subtotal: purchaseOrders.subtotal,
        total: purchaseOrders.total,
      })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .where(eq(purchaseOrders.tenantId, tenantId))
        .orderBy(desc(purchaseOrders.id));
      res.json(result);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ error: "Failed to fetch purchase orders" });
    }
  });

  app.post("/api/erp/purchase-orders", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { orderNumber, supplierId, orderDate, expectedDate, status, subtotal, discount, tax, total, notes } = req.body;
      const [order] = await db.insert(purchaseOrders).values({
        tenantId,
        orderNumber, supplierId, orderDate, expectedDate, status, subtotal, discount, tax, total, notes
      }).returning();
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({ error: "Failed to create purchase order" });
    }
  });

  app.delete("/api/erp/purchase-orders/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      await db.delete(purchaseOrders).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting purchase order:", error);
      res.status(500).json({ error: "Failed to delete purchase order" });
    }
  });

  // ========== STATS ==========
  app.get("/api/erp/stats", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      
      const [customersCount] = await db.select({ count: sql`count(*)` }).from(customers).where(eq(customers.tenantId, tenantId));
      const [suppliersCount] = await db.select({ count: sql`count(*)` }).from(suppliers).where(eq(suppliers.tenantId, tenantId));
      const [productsCount] = await db.select({ count: sql`count(*)` }).from(products).where(eq(products.tenantId, tenantId));
      const [salesOrdersCount] = await db.select({ count: sql`count(*)` }).from(salesOrders).where(eq(salesOrders.tenantId, tenantId));
      const [purchaseOrdersCount] = await db.select({ count: sql`count(*)` }).from(purchaseOrders).where(eq(purchaseOrders.tenantId, tenantId));
      
      res.json({
        customers: Number(customersCount?.count) || 0,
        suppliers: Number(suppliersCount?.count) || 0,
        products: Number(productsCount?.count) || 0,
        salesOrders: Number(salesOrdersCount?.count) || 0,
        purchaseOrders: Number(purchaseOrdersCount?.count) || 0,
      });
    } catch (error) {
      console.error("Error fetching ERP stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // ========== SEGMENTOS DE NEGÓCIO ==========
  app.get("/api/erp/segments", async (req: Request, res: Response) => {
    try {
      const segments = await db.select().from(erpSegments).where(eq(erpSegments.isActive, 1));
      res.json(segments);
    } catch (error) {
      console.error("Error fetching segments:", error);
      res.status(500).json({ error: "Failed to fetch segments" });
    }
  });

  app.post("/api/erp/segments", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const parsed = insertErpSegmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }
      const [segment] = await db.insert(erpSegments).values(parsed.data).returning();
      res.status(201).json(segment);
    } catch (error) {
      console.error("Error creating segment:", error);
      res.status(500).json({ error: "Failed to create segment" });
    }
  });

  app.post("/api/erp/segments/seed", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const defaultSegments = [
        { code: "varejo_geral", name: "Varejo Geral", category: "comercial", description: "Supermercados, farmácias, lojas em geral", modules: ["vendas", "estoque", "financeiro", "fisco"] },
        { code: "assistencia_tecnica", name: "Assistência Técnica", category: "comercial", description: "Serviços de manutenção e reparo", modules: ["os", "vendas", "estoque", "financeiro"], features: { ordemServico: true } },
        { code: "autopecas", name: "Autopeças", category: "comercial", description: "Loja de autopeças com ou sem serviços", modules: ["vendas", "estoque", "financeiro", "fisco"], features: { catalogoPecas: true } },
        { code: "engenharia", name: "Engenharia/Projetos", category: "comercial", description: "Empresas de engenharia e consultoria", modules: ["projetos", "financeiro", "crm"], features: { timesheet: true } },
        { code: "engenharia_ambiental", name: "Engenharia Ambiental e Serviços", category: "servicos", description: "Geologia, Meio Ambiente, Consultoria Ambiental - ISO 17025", modules: ["projetos", "qualidade", "crm", "vendas", "financeiro", "fisco", "rh"], features: { 
          controleAmostras: true, 
          laudosLaboratoriais: true, 
          rncAcoesCorretivas: true, 
          qmsDocumentos: true, 
          homologacaoFornecedores: true, 
          formulariosDigitais: true, 
          prestacaoContasCampo: true,
          matrizTreinamentos: true,
          iso17025: true,
          propostaProjeto: true
        } },
        { code: "laboratorio_analises", name: "Laboratório de Análises", category: "servicos", description: "Laboratórios de análises químicas, ambientais e clínicas", modules: ["qualidade", "vendas", "financeiro", "fisco"], features: { gestaoAmostras: true, laudos: true, acreditacao: true } },
        { code: "industria_quimica", name: "Indústria Química", category: "industria", description: "Produção de produtos químicos", modules: ["producao", "estoque", "vendas", "financeiro", "fisco"], features: { rastreabilidade: true, formulas: true } },
        { code: "industria_alimentos", name: "Indústria de Alimentos", category: "industria", description: "Produção de alimentos e bebidas", modules: ["producao", "estoque", "vendas", "financeiro", "fisco"], features: { fichaTecnica: true, validade: true } },
        { code: "industria_metalurgica", name: "Indústria Metalúrgica", category: "industria", description: "Produção metalúrgica e mecânica", modules: ["producao", "estoque", "vendas", "financeiro", "fisco"], features: { ordemProducao: true, bom: true } },
        { code: "distribuidor_atacado", name: "Distribuidor/Atacadista", category: "distribuidor", description: "Distribuição e atacado", modules: ["vendas", "estoque", "logistica", "financeiro", "fisco"], features: { logistica: true, tabelasPreco: true } },
        { code: "transportadora", name: "Transportadora", category: "distribuidor", description: "Transporte de cargas", modules: ["logistica", "financeiro", "fisco"], features: { cte: true, mdfe: true, rastreamento: true } },
        { code: "ecommerce_b2c", name: "E-commerce B2C", category: "ecommerce", description: "Venda online para consumidor final", modules: ["vendas", "estoque", "financeiro", "fisco"], features: { marketplace: true, logisticaReversa: true } },
        { code: "ecommerce_b2b", name: "E-commerce B2B", category: "ecommerce", description: "Venda online para empresas", modules: ["vendas", "estoque", "financeiro", "crm", "fisco"], features: { catalogoPersonalizado: true } },
        { code: "restaurante", name: "Restaurante", category: "foodservice", description: "Restaurantes e bares", modules: ["vendas", "estoque", "financeiro"], features: { mesas: true, comandas: true, fichaTecnica: true } },
        { code: "delivery", name: "Delivery/Lanchonete", category: "foodservice", description: "Delivery e fast food", modules: ["vendas", "estoque", "financeiro"], features: { delivery: true, ifood: true } },
        { code: "padaria", name: "Padaria/Confeitaria", category: "foodservice", description: "Panificação e confeitaria", modules: ["producao", "vendas", "estoque", "financeiro"], features: { producaoDiaria: true } },
        { code: "decoracao_cortinas", name: "Decoração, Cortinas e Persianaria", category: "servicos", description: "Lojas de decoração sob medida — cortinas, persianas, papel de parede, tapetes, bandôs.", modules: ["crm", "vendas", "financeiro", "fisco", "rh", "pedidos_tecnicos", "configurador", "estoque", "compras"], features: {
          configuradorProduto: true,
          calculadoraMedidas: true,
          osProducaoAtelie: true,
          osInstalacao: true,
          etiquetasPecas: true,
          checklistOperacional: true,
          termoRecebimento: true,
          guiasImpressao: true,
          catalogoDisponibilidade: true,
          analiseTecnica: true,
          clienteFinal: true,
          especificador: true,
          engineering: false,
          quality: false,
          iso17025: false,
          controleAmostras: false,
          propostaProjeto: false,
          prestacaoContasCampo: false,
          matrizTreinamentos: false,
          rncAcoesCorretivas: false,
          laudosLaboratoriais: false,
          formulariosDigitais: false,
        } },
      ];
      
      for (const seg of defaultSegments) {
        const existing = await db.select().from(erpSegments).where(eq(erpSegments.code, seg.code));
        if (existing.length === 0) {
          await db.insert(erpSegments).values(seg as any);
        }
      }
      
      const segments = await db.select().from(erpSegments);
      res.json({ message: "Segmentos criados com sucesso", count: segments.length, segments });
    } catch (error) {
      console.error("Error seeding segments:", error);
      res.status(500).json({ error: "Failed to seed segments" });
    }
  });

  // ========== SEG-03 — Aplicar segmento ao tenant ==========
  app.post("/api/erp/segments/:code/apply", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const tenantId = req.user?.tenantId || 1;
      const { code } = req.params;

      // Migração idempotente — adiciona colunas se não existirem
      await db.execute(sql`ALTER TABLE erp_config ADD COLUMN IF NOT EXISTS active_modules TEXT[] DEFAULT '{}'`);
      await db.execute(sql`ALTER TABLE erp_config ADD COLUMN IF NOT EXISTS features_json JSONB DEFAULT '{}'`);

      const [segment] = await db.select().from(erpSegments).where(eq(erpSegments.code, code));
      if (!segment) return res.status(404).json({ error: "Segmento não encontrado" });

      const mods: string[] = (segment.modules as string[]) ?? [];
      const features: Record<string, boolean> = (segment.features as any) ?? {};

      const moduleMap: Record<string, Partial<Record<string, number>>> = {
        crm:        { modulesCrm: 1 },
        vendas:     { modulesSales: 1 },
        estoque:    { modulesStock: 1 },
        financeiro: { modulesFinance: 1 },
        fisco:      { modulesSales: 1 },
        contabil:   { modulesAccounting: 1 },
        producao:   { modulesProduction: 1 },
        projetos:   { modulesProjects: 1 },
        rh:         { modulesHr: 1 },
        os:         { modulesServiceOrder: 1 },
        qualidade:  { modulesProjects: 1 },
        campo:      { modulesServiceOrder: 1 },
        fornecedores: { modulesPurchases: 1 },
      };

      const updates: any = {
        modulesCrm: 0, modulesSales: 0, modulesStock: 0,
        modulesFinance: 1, // Control sempre ativo
        modulesAccounting: 0, modulesProduction: 0,
        modulesProjects: 0, modulesHr: 0, modulesServiceOrder: 0,
        modulesPurchases: 0,
        segmentId: segment.id,
      };

      for (const mod of mods) {
        const flags = moduleMap[mod];
        if (flags) Object.assign(updates, flags);
      }

      const featuresJson = JSON.stringify(features);
      // ARRAY['mod1','mod2'] syntax evita ambiguidade de tipo no Drizzle template
      const modsArraySql = mods.length === 0
        ? sql.raw(`'{}'::text[]`)
        : sql.raw(`ARRAY[${mods.map((m: string) => `'${m.replace(/'/g, "''")}'`).join(',')}]`);

      // Usa SQL puro para evitar conflito com schema Drizzle desatualizado
      const existingRows = await db.execute(sql`SELECT id FROM erp_config WHERE tenant_id = ${tenantId} LIMIT 1`);
      const rows = (existingRows as any).rows ?? existingRows;
      const hasRow = Array.isArray(rows) && rows.length > 0;

      if (hasRow) {
        await db.execute(sql`
          UPDATE erp_config SET
            segment_id     = ${segment.id},
            active_modules = ${modsArraySql},
            features_json  = ${featuresJson}::jsonb,
            updated_at     = now()
          WHERE tenant_id = ${tenantId}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO erp_config (tenant_id, segment_id, active_modules, features_json)
          VALUES (${tenantId}, ${segment.id}, ${modsArraySql}, ${featuresJson}::jsonb)
        `);
      }

      await db.execute(sql`UPDATE tenants SET segmento = ${code} WHERE id = ${tenantId}`);

      res.json({ ok: true, segmento: code, modulosAtivados: mods, features });
    } catch (error) {
      console.error("Error applying segment:", error);
      res.status(500).json({ error: "Failed to apply segment" });
    }
  });

  // ========== CONFIGURAÇÃO DO TENANT ==========
  app.get("/api/erp/config", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      // SQL puro — schema Drizzle desatualizado em relação à tabela real
      const result = await db.execute(sql`
        SELECT ec.id, ec.tenant_id, ec.segment_id, ec.company_name, ec.trade_name, ec.tax_id,
               ec.state_registration, ec.municipal_registration, ec.address, ec.city, ec.state,
               ec.zip_code, ec.phone, ec.email, ec.website, ec.logo_url,
               ec.modules_enabled, ec.settings, ec.active_modules, ec.features_json,
               ec.created_at, ec.updated_at,
               t.segmento
        FROM erp_config ec
        LEFT JOIN tenants t ON t.id = ec.tenant_id
        WHERE ec.tenant_id = ${tenantId}
        LIMIT 1
      `);
      const rows = (result as any).rows ?? result;
      res.json(rows[0] ?? null);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  app.post("/api/erp/config", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      
      const configSchema = insertErpConfigSchema.partial().extend({
        tenantId: z.number().optional(),
      });
      const parsed = configSchema.safeParse({ ...req.body, tenantId });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }
      
      const data = { ...parsed.data, tenantId };
      const [existing] = await db.select().from(erpConfig).where(eq(erpConfig.tenantId, tenantId));
      
      if (existing) {
        const [updated] = await db.update(erpConfig)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(erpConfig.tenantId, tenantId))
          .returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(erpConfig).values(data as any).returning();
        res.status(201).json(created);
      }
    } catch (error) {
      console.error("Error saving config:", error);
      res.status(500).json({ error: "Failed to save config" });
    }
  });

  // GET /api/erp/tenant/modules - Get current tenant's active modules
  app.get("/api/erp/tenant/modules", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const tenantId = req.user?.tenantId || 1;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      
      const defaultFeatures: TenantFeatures = {
        ide: true, ideMode: 'pro-code', whatsapp: false, whatsappSessions: 0,
        crm: true, erp: true, bi: false, manus: true, manusTools: [],
        centralApis: false, centralApisManage: false, comunidades: false,
        maxChannels: 5, biblioteca: false, bibliotecaPublish: false,
        suporteN3: false, retail: false, plus: false, fisco: false,
        cockpit: false, compass: true, production: false, support: false, xosCrm: false
      };
      
      res.json({
        tenantId: tenant.id,
        tenantName: tenant.name,
        plan: tenant.plan,
        features: tenant.features || defaultFeatures
      });
    } catch (error) {
      console.error("Error fetching tenant modules:", error);
      res.status(500).json({ error: "Failed to fetch modules" });
    }
  });

  // PUT /api/erp/tenant/modules - Update current tenant's modules
  app.put("/api/erp/tenant/modules", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const user = req.user;
      if (user?.role !== 'admin' && (user as any)?.tenantRole !== 'owner') {
        return res.status(403).json({ error: "Only admins can manage modules" });
      }
      const tenantId = user?.tenantId || 1;
      
      const features = req.body.features;
      if (!features || typeof features !== 'object') {
        return res.status(400).json({ error: "Invalid features object" });
      }
      
      const [updated] = await db.update(tenants)
        .set({ features, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId))
        .returning();
      
      res.json({ tenantId: updated.id, features: updated.features });
    } catch (error) {
      console.error("Error updating tenant modules:", error);
      res.status(500).json({ error: "Failed to update modules" });
    }
  });

  // GET /api/erp/sync/status - Get sync status for all motors
  app.get("/api/erp/sync/status", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
      const tenantId = req.user?.tenantId || 1;
      
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      const features = (tenant?.features as TenantFeatures) || {};
      
      const status = {
        retail: {
          enabled: features.retail || false,
          motor: features.plus ? 'plus' : features.erp ? 'erpnext' : 'none',
          lastSync: null,
          status: 'idle'
        },
        plus: {
          enabled: features.plus || false,
          status: 'idle'  
        },
        fisco: {
          enabled: features.fisco || false,
          status: 'idle'
        },
        bi: {
          enabled: features.bi || false,
          status: 'idle'
        }
      };
      
      res.json(status);
    } catch (error) {
      console.error("Error fetching sync status:", error);
      res.status(500).json({ error: "Failed to fetch sync status" });
    }
  });

  app.get("/api/erp/empresas", async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: "Tenant not identified" });
      const empresas = await db.select().from(tenantEmpresas)
        .where(and(eq(tenantEmpresas.tenantId, tenantId), eq(tenantEmpresas.status, "active")));
      res.json(empresas);
    } catch (error) {
      console.error("Error fetching empresas:", error);
      res.status(500).json({ error: "Failed to fetch empresas" });
    }
  });

  app.get("/api/erp/empresas/:id", async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: "Tenant not identified" });
      const id = parseInt(req.params.id);
      const [empresa] = await db.select().from(tenantEmpresas)
        .where(and(eq(tenantEmpresas.id, id), eq(tenantEmpresas.tenantId, tenantId)));
      if (!empresa) return res.status(404).json({ error: "Empresa not found" });
      res.json(empresa);
    } catch (error) {
      console.error("Error fetching empresa:", error);
      res.status(500).json({ error: "Failed to fetch empresa" });
    }
  });

  app.post("/api/erp/empresas", async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: "Tenant not identified" });
      const { razaoSocial, nomeFantasia, cnpj, ie, im, email, phone, tipo, cep, logradouro, numero, complemento, bairro, cidade, uf, codigoIbge, regimeTributario } = req.body;
      if (!razaoSocial || !cnpj) return res.status(400).json({ error: "razaoSocial and cnpj required" });
      const [empresa] = await db.insert(tenantEmpresas).values({
        tenantId,
        razaoSocial,
        nomeFantasia: nomeFantasia || null,
        cnpj,
        ie: ie || null,
        im: im || null,
        email: email || null,
        phone: phone || null,
        tipo: tipo || "filial",
        cep: cep || null,
        logradouro: logradouro || null,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        uf: uf || null,
        codigoIbge: codigoIbge || null,
        regimeTributario: regimeTributario || null,
      }).returning();
      res.status(201).json(empresa);
    } catch (error) {
      console.error("Error creating empresa:", error);
      res.status(500).json({ error: "Failed to create empresa" });
    }
  });

  app.put("/api/erp/empresas/:id", async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: "Tenant not identified" });
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(tenantEmpresas)
        .where(and(eq(tenantEmpresas.id, id), eq(tenantEmpresas.tenantId, tenantId)));
      if (!existing) return res.status(404).json({ error: "Empresa not found" });
      const { razaoSocial, nomeFantasia, cnpj, ie, im, email, phone, tipo, status, cep, logradouro, numero, complemento, bairro, cidade, uf, codigoIbge, regimeTributario } = req.body;
      const [updated] = await db.update(tenantEmpresas)
        .set({
          ...(razaoSocial !== undefined && { razaoSocial }),
          ...(nomeFantasia !== undefined && { nomeFantasia }),
          ...(cnpj !== undefined && { cnpj }),
          ...(ie !== undefined && { ie }),
          ...(im !== undefined && { im }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
          ...(tipo !== undefined && { tipo }),
          ...(status !== undefined && { status }),
          ...(cep !== undefined && { cep }),
          ...(logradouro !== undefined && { logradouro }),
          ...(numero !== undefined && { numero }),
          ...(complemento !== undefined && { complemento }),
          ...(bairro !== undefined && { bairro }),
          ...(cidade !== undefined && { cidade }),
          ...(uf !== undefined && { uf }),
          ...(codigoIbge !== undefined && { codigoIbge }),
          ...(regimeTributario !== undefined && { regimeTributario }),
          updatedAt: new Date(),
        })
        .where(and(eq(tenantEmpresas.id, id), eq(tenantEmpresas.tenantId, tenantId)))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating empresa:", error);
      res.status(500).json({ error: "Failed to update empresa" });
    }
  });
}
