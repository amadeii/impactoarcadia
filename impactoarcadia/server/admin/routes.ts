import { Router, Request, Response } from "express";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { eq, desc, and, or, isNull, inArray, sql } from "drizzle-orm";
import { users, profiles, crmPartners, crmClients, tenants, tenantPlans, partnerClients, partnerCommissions, tenantEmpresas, tenantGrupos, tenantGrupoMembros, insertTenantSchema, insertTenantPlanSchema, insertPartnerClientSchema, insertTenantEmpresaSchema } from "@shared/schema";
import { syncGrupoToControl } from "./syncGrupoToControl";
import { db, pool } from "../../db/index";
import fs from "fs";
import path from "path";

const scryptAsync = promisify(scrypt);
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// MP-04: Sincroniza empresa (tenant_empresas) → crm_clients (Control)
async function syncEmpresaToControl(empresa: any): Promise<void> {
  try {
    if (!empresa || !empresa.tenantId) return;

    const existing = await db.select({ id: crmClients.id })
      .from(crmClients)
      .where(and(
        eq(crmClients.tenantId, empresa.tenantId),
        eq(crmClients.cnpj, empresa.cnpj ?? '')
      ))
      .limit(1);

    const payload = {
      tenantId: empresa.tenantId,
      name: empresa.razaoSocial,
      tradeName: empresa.nomeFantasia ?? null,
      cnpj: empresa.cnpj ?? null,
      email: empresa.email ?? null,
      phone: empresa.phone ?? null,
      city: empresa.cidade ?? null,
      state: empresa.uf ?? null,
      source: 'empresa_matriz',
      status: empresa.status ?? 'active',
    };

    if (existing.length > 0) {
      await db.update(crmClients)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(crmClients.id, existing[0].id));
    } else {
      await db.insert(crmClients).values(payload as any);
    }
  } catch (err: any) {
    console.warn('[syncEmpresaToControl] falhou (non-fatal):', err.message);
  }
}

const router = Router();

// Helper: Retorna IDs de tenants que o usuário pode acessar
async function getAllowedTenantIds(user: any): Promise<number[] | null> {
  // null = acesso total (master)
  if (!user.tenantId || user.tenantType === "master") return null;
  
  if (user.tenantType === "partner") {
    // Partner vê seu próprio tenant + clientes vinculados
    const clientRelations = await db.select({ clientId: partnerClients.clientId })
      .from(partnerClients)
      .where(eq(partnerClients.partnerId, user.tenantId));
    return [user.tenantId, ...clientRelations.map(r => r.clientId)];
  }
  
  // Client vê apenas seu próprio tenant
  return [user.tenantId];
}

// Helper: Verifica se usuário pode acessar um tenant específico
async function canAccessTenant(user: any, tenantId: number): Promise<boolean> {
  const allowed = await getAllowedTenantIds(user);
  if (allowed === null) return true; // Master pode tudo
  return allowed.includes(tenantId);
}

router.use((req: Request, res: Response, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  const user = req.user as any;
  if (user.role !== "admin" && user.role !== "master") {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
  }
  next();
});

router.get("/profiles", async (req: Request, res: Response) => {
  try {
    const allProfiles = await db.select().from(profiles).orderBy(profiles.name);
    res.json(allProfiles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/profiles", async (req: Request, res: Response) => {
  try {
    const { name, description, type, allowedModules, status } = req.body;
    const [profile] = await db.insert(profiles).values({
      name,
      description,
      type: type || "custom",
      allowedModules: allowedModules || [],
      status: status || "active",
    }).returning();
    res.status(201).json(profile);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/profiles/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, allowedModules, status } = req.body;
    const [profile] = await db.update(profiles)
      .set({ name, description, allowedModules, status, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();
    if (!profile) return res.status(404).json({ error: "Perfil não encontrado" });
    res.json(profile);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/profiles/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    if (!profile) return res.status(404).json({ error: "Perfil não encontrado" });
    if (profile.isSystem === 1) {
      return res.status(400).json({ error: "Não é possível excluir perfis do sistema" });
    }
    await db.delete(profiles).where(eq(profiles.id, id));
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/users", async (req: Request, res: Response) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      role: users.role,
      profileId: users.profileId,
      partnerId: users.partnerId,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    }).from(users).orderBy(users.name);
    
    const usersWithProfile = await Promise.all(allUsers.map(async (user) => {
      let profile = null;
      let partner = null;
      if (user.profileId) {
        const [p] = await db.select().from(profiles).where(eq(profiles.id, user.profileId));
        profile = p;
      }
      if (user.partnerId) {
        const [pt] = await db.select().from(crmPartners).where(eq(crmPartners.id, user.partnerId));
        partner = pt;
      }
      return { ...user, profile, partner };
    }));
    
    res.json(usersWithProfile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { name, email, role, profileId, partnerId, status } = req.body;
    const [user] = await db.update(users)
      .set({ name, email, role, profileId, partnerId, status })
      .where(eq(users.id, id))
      .returning();
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/users/:id/status", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const [user] = await db.update(users)
      .set({ status })
      .where(eq(users.id, id))
      .returning();
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/partners/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const [partner] = await db.update(crmPartners)
      .set({ status, updatedAt: new Date() })
      .where(eq(crmPartners.id, id))
      .returning();
    if (!partner) return res.status(404).json({ error: "Parceiro não encontrado" });
    res.json(partner);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/clients/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const [client] = await db.update(crmClients)
      .set({ status, updatedAt: new Date() })
      .where(eq(crmClients.id, id))
      .returning();
    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(client);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const [allUsers] = await db.select({ count: db.$count(users) }).from(users);
    const [activeUsers] = await db.select({ count: db.$count(users) }).from(users).where(eq(users.status, "active"));
    const [allProfiles] = await db.select({ count: db.$count(profiles) }).from(profiles);
    const [allPartners] = await db.select({ count: db.$count(crmPartners) }).from(crmPartners);
    const [activePartners] = await db.select({ count: db.$count(crmPartners) }).from(crmPartners).where(eq(crmPartners.status, "active"));
    const [allClients] = await db.select({ count: db.$count(crmClients) }).from(crmClients);
    const [activeClients] = await db.select({ count: db.$count(crmClients) }).from(crmClients).where(eq(crmClients.status, "active"));
    
    res.json({
      users: { total: allUsers.count, active: activeUsers.count },
      profiles: { total: allProfiles.count },
      partners: { total: allPartners.count, active: activePartners.count },
      clients: { total: allClients.count, active: activeClients.count },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/libraries", async (req: Request, res: Response) => {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    
    const dependencies = Object.entries(packageJson.dependencies || {}).map(([name, version]) => ({
      name,
      version: String(version).replace(/^\^|~/, ""),
      type: "production",
      category: categorizePackage(name),
    }));
    
    const devDependencies = Object.entries(packageJson.devDependencies || {}).map(([name, version]) => ({
      name,
      version: String(version).replace(/^\^|~/, ""),
      type: "development",
      category: categorizePackage(name),
    }));
    
    res.json({
      nodejs: {
        dependencies,
        devDependencies,
        total: dependencies.length + devDependencies.length,
      },
      python: {
        dependencies: [],
        total: 0,
        note: "Python microservices planejados para próximas versões",
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function categorizePackage(name: string): string {
  if (name.includes("react") || name.includes("radix") || name.includes("tailwind")) return "UI/Frontend";
  if (name.includes("express") || name.includes("passport") || name.includes("session")) return "Backend/Auth";
  if (name.includes("drizzle") || name.includes("pg") || name.includes("connect-pg")) return "Database";
  if (name.includes("socket") || name.includes("ws") || name.includes("whatsapp")) return "Real-time/Comunicação";
  if (name.includes("openai") || name.includes("ai")) return "AI/ML";
  if (name.includes("zod") || name.includes("hook-form")) return "Validação/Forms";
  if (name.includes("vite") || name.includes("typescript") || name.includes("tsx") || name.includes("esbuild")) return "Build/Dev Tools";
  if (name.includes("lucide") || name.includes("framer")) return "Icons/Animações";
  if (name.includes("pdf") || name.includes("docx") || name.includes("csv") || name.includes("zip")) return "Documentos/Arquivos";
  if (name.includes("recharts") || name.includes("chart")) return "Visualização";
  if (name.includes("date") || name.includes("day-picker")) return "Data/Tempo";
  return "Utilitários";
}

// ==========================================
// MULTI-TENANT MANAGEMENT ROUTES
// ==========================================

// GET /api/admin/tenants - List all tenants with hierarchy
router.get("/tenants", async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const user = req.user as any;
    
    const allTenants = await db.select().from(tenants).orderBy(desc(tenants.createdAt));
    
    // Filtrar por tenant do usuário
    let filteredByAccess = allTenants;
    if (user.tenantType === "partner") {
      // Partner vê apenas seu próprio tenant e seus clientes
      const clientRelations = await db.select().from(partnerClients)
        .where(eq(partnerClients.partnerId, user.tenantId));
      const clientIds = clientRelations.map(r => r.clientId);
      filteredByAccess = allTenants.filter(t => 
        t.id === user.tenantId || clientIds.includes(t.id)
      );
    } else if (user.tenantType === "client") {
      // Client vê apenas seu próprio tenant
      filteredByAccess = allTenants.filter(t => t.id === user.tenantId);
    }
    // Master (tenantType === "master") vê todos
    
    // Filter by type if specified
    const filteredTenants = type 
      ? filteredByAccess.filter(t => t.tenantType === type)
      : filteredByAccess;
    
    // Add parent tenant info
    const tenantsWithParent = await Promise.all(filteredTenants.map(async (tenant) => {
      let parentTenant = null;
      if (tenant.parentTenantId) {
        const [parent] = await db.select().from(tenants).where(eq(tenants.id, tenant.parentTenantId));
        parentTenant = parent ? { id: parent.id, name: parent.name, tenantType: parent.tenantType } : null;
      }
      
      // Count child tenants
      const childTenants = allTenants.filter(t => t.parentTenantId === tenant.id);
      
      return { ...tenant, parentTenant, childCount: childTenants.length };
    }));
    
    res.json(tenantsWithParent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: resolve plan features for a tenant based on plan code
async function resolvePlanFeatures(planCode: string): Promise<Record<string, any> | null> {
  const [plan] = await db.select().from(tenantPlans).where(eq(tenantPlans.code, planCode));
  if (!plan || !plan.features) return null;
  return plan.features as Record<string, any>;
}

// POST /api/admin/tenants - Create new tenant
router.post("/tenants", async (req: Request, res: Response) => {
  try {
    const validated = insertTenantSchema.parse(req.body);
    
    if (validated.plan && !validated.features) {
      const planFeatures = await resolvePlanFeatures(validated.plan);
      if (planFeatures) {
        validated.features = planFeatures as any;
      }
    }
    
    const [tenant] = await db.insert(tenants).values(validated).returning();
    res.status(201).json(tenant);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/admin/tenants/:id - Update tenant
router.patch("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const user = req.user as any;
    
    if (!await canAccessTenant(user, id)) {
      return res.status(403).json({ error: "Sem permissão para modificar este tenant" });
    }
    
    const { name, email, phone, plan, status, tenantType, parentTenantId, partnerCode, commissionRate, maxUsers, maxStorageMb, features, billingEmail, trialEndsAt } = req.body;
    
    let resolvedFeatures = features;
    if (plan && !features) {
      const [currentTenant] = await db.select().from(tenants).where(eq(tenants.id, id));
      if (currentTenant && currentTenant.plan !== plan) {
        const planFeatures = await resolvePlanFeatures(plan);
        if (planFeatures) {
          resolvedFeatures = planFeatures;
        }
      }
    }
    
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (plan !== undefined) updateData.plan = plan;
    if (status !== undefined) updateData.status = status;
    if (tenantType !== undefined) updateData.tenantType = tenantType;
    if (parentTenantId !== undefined) updateData.parentTenantId = parentTenantId;
    if (partnerCode !== undefined) updateData.partnerCode = partnerCode;
    if (commissionRate !== undefined) updateData.commissionRate = commissionRate;
    if (maxUsers !== undefined) updateData.maxUsers = maxUsers;
    if (maxStorageMb !== undefined) updateData.maxStorageMb = maxStorageMb;
    if (resolvedFeatures !== undefined) updateData.features = resolvedFeatures;
    if (billingEmail !== undefined) updateData.billingEmail = billingEmail;
    if (trialEndsAt !== undefined) updateData.trialEndsAt = trialEndsAt;
    
    const [tenant] = await db.update(tenants)
      .set(updateData)
      .where(eq(tenants.id, id))
      .returning();
    
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });
    res.json(tenant);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/admin/tenants/:id - Delete tenant
router.delete("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const user = req.user as any;
    
    // Apenas master pode excluir tenants
    if (user.tenantType !== "master") {
      return res.status(403).json({ error: "Apenas master pode excluir tenants" });
    }
    
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });
    if (tenant.tenantType === "master") {
      return res.status(400).json({ error: "Não é possível excluir o tenant master" });
    }
    await db.delete(tenants).where(eq(tenants.id, id));
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/tenants/hierarchy - Get hierarchy tree
router.get("/tenants/hierarchy", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const allowedIds = await getAllowedTenantIds(user);
    
    let allTenants = await db.select().from(tenants).orderBy(tenants.name);
    
    // Filtrar por acesso do usuário
    if (allowedIds !== null) {
      allTenants = allTenants.filter(t => allowedIds.includes(t.id));
    }
    
    // Build hierarchy tree
    const buildTree = (parentId: number | null): any[] => {
      return allTenants
        .filter(t => t.parentTenantId === parentId)
        .map(t => ({
          ...t,
          children: buildTree(t.id)
        }));
    };
    
    // Start from master tenants (no parent) or user's tenant
    const hierarchy = allowedIds === null 
      ? buildTree(null) 
      : allTenants.map(t => ({ ...t, children: [] }));
    res.json(hierarchy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TENANT PLANS ROUTES
// ==========================================

// GET /api/admin/plans - List all plans
router.get("/plans", async (req: Request, res: Response) => {
  try {
    const allPlans = await db.select().from(tenantPlans).orderBy(tenantPlans.sortOrder);
    res.json(allPlans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/plans - Create new plan
router.post("/plans", async (req: Request, res: Response) => {
  try {
    const validated = insertTenantPlanSchema.parse(req.body);
    const [plan] = await db.insert(tenantPlans).values(validated).returning();
    res.status(201).json(plan);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/admin/plans/:id - Update plan
router.patch("/plans/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, maxUsers, maxStorageMb, features, monthlyPrice, yearlyPrice, trialDays, isActive, sortOrder } = req.body;
    
    const [plan] = await db.update(tenantPlans)
      .set({ name, description, maxUsers, maxStorageMb, features, monthlyPrice, yearlyPrice, trialDays, isActive, sortOrder })
      .where(eq(tenantPlans.id, id))
      .returning();
    
    if (!plan) return res.status(404).json({ error: "Plano não encontrado" });
    res.json(plan);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/admin/plans/:id - Delete plan
router.delete("/plans/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(tenantPlans).where(eq(tenantPlans.id, id));
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/plans/:id/propagate - Apply plan features to all tenants with this plan
router.post("/plans/:id/propagate", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(tenantPlans).where(eq(tenantPlans.id, id));
    if (!plan) return res.status(404).json({ error: "Plano não encontrado" });
    if (!plan.features) return res.status(400).json({ error: "Plano sem módulos definidos" });
    
    const affected = await db.update(tenants)
      .set({ features: plan.features, maxUsers: plan.maxUsers, maxStorageMb: plan.maxStorageMb, updatedAt: new Date() })
      .where(eq(tenants.plan, plan.code))
      .returning();
    
    res.json({ propagated: affected.length, planCode: plan.code });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/plans/seed - Seed default plans
router.post("/plans/seed", async (req: Request, res: Response) => {
  try {
    const existing = await db.select().from(tenantPlans);
    if (existing.length > 0) {
      return res.json({ message: "Planos já existem", count: existing.length });
    }
    
    const defaultPlans: any[] = [
      {
        code: "free",
        name: "Gratuito",
        description: "Plano básico gratuito para experimentar",
        tenantType: "client",
        maxUsers: 2,
        maxStorageMb: 500,
        monthlyPrice: 0,
        yearlyPrice: 0,
        trialDays: 14,
        sortOrder: 1,
        features: { erp: true, crm: true },
      },
      {
        code: "starter",
        name: "Starter",
        description: "Para pequenas empresas começando",
        tenantType: "client",
        maxUsers: 5,
        maxStorageMb: 2000,
        monthlyPrice: 9900,
        yearlyPrice: 99000,
        trialDays: 14,
        sortOrder: 2,
        features: { erp: true, crm: true, bi: true, fisco: true, whatsapp: true, compass: true },
      },
      {
        code: "pro",
        name: "Profissional",
        description: "Para empresas em crescimento",
        tenantType: "client",
        maxUsers: 15,
        maxStorageMb: 10000,
        monthlyPrice: 29900,
        yearlyPrice: 299000,
        trialDays: 14,
        sortOrder: 3,
        features: { erp: true, crm: true, bi: true, fisco: true, retail: true, plus: true, whatsapp: true, manus: true, cockpit: true, compass: true, support: true, biblioteca: true },
      },
      {
        code: "enterprise",
        name: "Enterprise",
        description: "Para grandes empresas",
        tenantType: "client",
        maxUsers: 100,
        maxStorageMb: 50000,
        monthlyPrice: 99900,
        yearlyPrice: 999000,
        trialDays: 30,
        sortOrder: 4,
        features: { erp: true, crm: true, bi: true, fisco: true, retail: true, plus: true, whatsapp: true, manus: true, ide: true, cockpit: true, compass: true, production: true, support: true, xosCrm: true, centralApis: true, comunidades: true, biblioteca: true },
      },
      {
        code: "partner_starter",
        name: "Parceiro Starter",
        description: "Para consultores e pequenos integradores",
        tenantType: "partner",
        maxUsers: 10,
        maxStorageMb: 5000,
        monthlyPrice: 19900,
        yearlyPrice: 199000,
        trialDays: 14,
        sortOrder: 5,
        features: { erp: true, crm: true, bi: true, fisco: true, retail: true, whatsapp: true, compass: true, support: true },
      },
      {
        code: "partner_pro",
        name: "Parceiro Pro",
        description: "Para integradores e consultorias",
        tenantType: "partner",
        maxUsers: 50,
        maxStorageMb: 25000,
        monthlyPrice: 49900,
        yearlyPrice: 499000,
        trialDays: 30,
        sortOrder: 6,
        features: { erp: true, crm: true, bi: true, fisco: true, retail: true, plus: true, whatsapp: true, manus: true, ide: true, cockpit: true, compass: true, production: true, support: true, xosCrm: true, centralApis: true, comunidades: true, biblioteca: true },
      },
    ];
    
    const created = await db.insert(tenantPlans).values(defaultPlans).returning();
    res.status(201).json({ message: "Planos criados com sucesso", count: created.length, plans: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PARTNER-CLIENT RELATIONSHIPS
// ==========================================

// GET /api/admin/partner-clients - List partner-client relationships
router.get("/partner-clients", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const allowedIds = await getAllowedTenantIds(user);
    
    let relationships = await db.select().from(partnerClients).orderBy(desc(partnerClients.startedAt));
    
    // Filtrar por acesso do usuário
    if (allowedIds !== null) {
      relationships = relationships.filter(r => 
        allowedIds.includes(r.partnerId) || allowedIds.includes(r.clientId)
      );
    }
    
    // Add partner and client info
    const withDetails = await Promise.all(relationships.map(async (rel) => {
      const [partner] = await db.select().from(tenants).where(eq(tenants.id, rel.partnerId));
      const [client] = await db.select().from(tenants).where(eq(tenants.id, rel.clientId));
      return {
        ...rel,
        partner: partner ? { id: partner.id, name: partner.name } : null,
        client: client ? { id: client.id, name: client.name } : null,
      };
    }));
    
    res.json(withDetails);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/partner-clients - Create partner-client relationship
router.post("/partner-clients", async (req: Request, res: Response) => {
  try {
    const validated = insertPartnerClientSchema.parse(req.body);
    const [relationship] = await db.insert(partnerClients).values(validated).returning();
    res.status(201).json(relationship);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// PARTNER COMMISSIONS
// ==========================================

// GET /api/admin/commissions - List all commissions
router.get("/commissions", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const allowedIds = await getAllowedTenantIds(user);
    const { partnerId, status } = req.query;
    
    let allCommissions = await db.select().from(partnerCommissions).orderBy(desc(partnerCommissions.createdAt));
    
    // Filtrar por acesso do usuário
    if (allowedIds !== null) {
      allCommissions = allCommissions.filter(c => 
        allowedIds.includes(c.partnerId) || allowedIds.includes(c.clientId)
      );
    }
    
    if (partnerId) {
      allCommissions = allCommissions.filter(c => c.partnerId === parseInt(partnerId as string));
    }
    if (status) {
      allCommissions = allCommissions.filter(c => c.status === status);
    }
    
    // Add partner and client info
    const withDetails = await Promise.all(allCommissions.map(async (comm) => {
      const [partner] = await db.select().from(tenants).where(eq(tenants.id, comm.partnerId));
      const [client] = await db.select().from(tenants).where(eq(tenants.id, comm.clientId));
      return {
        ...comm,
        partner: partner ? { id: partner.id, name: partner.name } : null,
        client: client ? { id: client.id, name: client.name } : null,
      };
    }));
    
    res.json(withDetails);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/admin/commissions/:id/approve - Approve commission
router.patch("/commissions/:id/approve", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [commission] = await db.update(partnerCommissions)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(partnerCommissions.id, id))
      .returning();
    
    if (!commission) return res.status(404).json({ error: "Comissão não encontrada" });
    res.json(commission);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/admin/commissions/:id/pay - Mark commission as paid
router.patch("/commissions/:id/pay", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { paymentReference } = req.body;
    
    const [commission] = await db.update(partnerCommissions)
      .set({ status: "paid", paidAt: new Date(), paymentReference })
      .where(eq(partnerCommissions.id, id))
      .returning();
    
    if (!commission) return res.status(404).json({ error: "Comissão não encontrada" });
    res.json(commission);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/admin/tenants/stats - Tenant statistics
router.get("/tenants/stats", async (req: Request, res: Response) => {
  try {
    const allTenants = await db.select().from(tenants);
    
    const stats = {
      total: allTenants.length,
      byType: {
        master: allTenants.filter(t => t.tenantType === "master").length,
        partner: allTenants.filter(t => t.tenantType === "partner").length,
        client: allTenants.filter(t => t.tenantType === "client").length,
      },
      byStatus: {
        active: allTenants.filter(t => t.status === "active").length,
        trial: allTenants.filter(t => t.status === "trial").length,
        suspended: allTenants.filter(t => t.status === "suspended").length,
        cancelled: allTenants.filter(t => t.status === "cancelled").length,
      }
    };
    
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== TENANT EMPRESAS (Matriz/Filiais) ==========

router.get("/empresas", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const user = req.user as any;
    
    let query;
    if (tenantId) {
      const tid = parseInt(tenantId as string);
      if (!(await canAccessTenant(user, tid))) {
        return res.status(403).json({ error: "Sem permissão para este tenant" });
      }
      query = await db.select().from(tenantEmpresas)
        .where(eq(tenantEmpresas.tenantId, tid))
        .orderBy(desc(tenantEmpresas.tipo), tenantEmpresas.razaoSocial);
    } else {
      const allowed = await getAllowedTenantIds(user);
      if (allowed) {
        query = await db.select().from(tenantEmpresas)
          .where(inArray(tenantEmpresas.tenantId, allowed))
          .orderBy(desc(tenantEmpresas.tipo), tenantEmpresas.razaoSocial);
      } else {
        query = await db.select().from(tenantEmpresas)
          .orderBy(desc(tenantEmpresas.tipo), tenantEmpresas.razaoSocial);
      }
    }
    res.json(query);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/empresas/:id", async (req: Request, res: Response) => {
  try {
    const [empresa] = await db.select().from(tenantEmpresas)
      .where(eq(tenantEmpresas.id, parseInt(req.params.id)));
    if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
    
    const user = req.user as any;
    if (!(await canAccessTenant(user, empresa.tenantId))) {
      return res.status(403).json({ error: "Sem permissão" });
    }
    res.json(empresa);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/empresas", async (req: Request, res: Response) => {
  try {
    const data = insertTenantEmpresaSchema.parse(req.body);
    const user = req.user as any;
    if (!(await canAccessTenant(user, data.tenantId))) {
      return res.status(403).json({ error: "Sem permissão para este tenant" });
    }
    const [empresa] = await db.insert(tenantEmpresas).values(data).returning();
    syncEmpresaToControl(empresa).catch(() => {});
    res.json(empresa);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/empresas/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(tenantEmpresas)
      .where(eq(tenantEmpresas.id, parseInt(req.params.id)));
    if (!existing) return res.status(404).json({ error: "Empresa não encontrada" });
    
    const user = req.user as any;
    if (!(await canAccessTenant(user, existing.tenantId))) {
      return res.status(403).json({ error: "Sem permissão" });
    }
    
    const [empresa] = await db.update(tenantEmpresas)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(tenantEmpresas.id, parseInt(req.params.id)))
      .returning();
    syncEmpresaToControl(empresa).catch(() => {});
    res.json(empresa);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/empresas/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(tenantEmpresas)
      .where(eq(tenantEmpresas.id, parseInt(req.params.id)));
    if (!existing) return res.status(404).json({ error: "Empresa não encontrada" });
    
    const user = req.user as any;
    if (!(await canAccessTenant(user, existing.tenantId))) {
      return res.status(403).json({ error: "Sem permissão" });
    }
    
    await db.delete(tenantEmpresas).where(eq(tenantEmpresas.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GRUPOS EMPRESARIAIS (tenant_grupos + tenant_grupo_membros)
// ─────────────────────────────────────────────────────────────

router.get("/grupos", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const tenantId = req.query.tenantId ? parseInt(req.query.tenantId as string) : null;
    const condition = tenantId ? eq(tenantGrupos.tenantId, tenantId) : undefined;
    const grupos = await db.select().from(tenantGrupos).where(condition).orderBy(tenantGrupos.nome);
    const membros = await db.select({
      id: tenantGrupoMembros.id,
      grupoId: tenantGrupoMembros.grupoId,
      empresaId: tenantGrupoMembros.empresaId,
      papel: tenantGrupoMembros.papel,
      participacao: tenantGrupoMembros.participacao,
      createdAt: tenantGrupoMembros.createdAt,
      razaoSocial: tenantEmpresas.razaoSocial,
      nomeFantasia: tenantEmpresas.nomeFantasia,
      cnpj: tenantEmpresas.cnpj,
    }).from(tenantGrupoMembros)
      .leftJoin(tenantEmpresas, eq(tenantGrupoMembros.empresaId, tenantEmpresas.id));
    
    const result = grupos.map(g => ({
      ...g,
      membros: membros.filter(m => m.grupoId === g.id),
    }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/grupos", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { tenantId, nome, descricao, tipo } = req.body;
    if (!tenantId || !nome) return res.status(400).json({ error: "tenantId e nome são obrigatórios" });
    if (!(await canAccessTenant(user, tenantId))) return res.status(403).json({ error: "Sem permissão" });
    const [grupo] = await db.insert(tenantGrupos).values({ tenantId, nome, descricao, tipo }).returning();
    syncGrupoToControl(grupo.id).then(r => {
      console.log(`[sync] Grupo ${grupo.id} → Control: ${r.grupoControlId} (${r.membrosSync} membros)`);
      if (r.membrosErro.length > 0) console.warn('[sync] Erros de membro:', r.membrosErro);
    }).catch(err => console.warn('[sync] syncGrupoToControl falhou (non-fatal):', err.message));
    res.json(grupo);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/grupos/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const [existing] = await db.select().from(tenantGrupos).where(eq(tenantGrupos.id, parseInt(req.params.id)));
    if (!existing) return res.status(404).json({ error: "Grupo não encontrado" });
    if (!(await canAccessTenant(user, existing.tenantId))) return res.status(403).json({ error: "Sem permissão" });
    const { nome, descricao, tipo, ativo } = req.body;
    const [grupo] = await db.update(tenantGrupos)
      .set({ nome, descricao, tipo, ativo, updatedAt: new Date() })
      .where(eq(tenantGrupos.id, existing.id))
      .returning();
    syncGrupoToControl(Number(req.params.id)).then(r => {
      console.log(`[sync] Grupo ${req.params.id} atualizado → Control: ${r.grupoControlId}`);
    }).catch(err => console.warn('[sync] re-sync falhou (non-fatal):', err.message));
    res.json(grupo);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/grupos/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const [existing] = await db.select().from(tenantGrupos).where(eq(tenantGrupos.id, parseInt(req.params.id)));
    if (!existing) return res.status(404).json({ error: "Grupo não encontrado" });
    if (!(await canAccessTenant(user, existing.tenantId))) return res.status(403).json({ error: "Sem permissão" });
    await db.delete(tenantGrupoMembros).where(eq(tenantGrupoMembros.grupoId, existing.id));
    await db.delete(tenantGrupos).where(eq(tenantGrupos.id, existing.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/grupos/:id/membros", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const grupoId = parseInt(req.params.id);
    const [grupo] = await db.select().from(tenantGrupos).where(eq(tenantGrupos.id, grupoId));
    if (!grupo) return res.status(404).json({ error: "Grupo não encontrado" });
    if (!(await canAccessTenant(user, grupo.tenantId))) return res.status(403).json({ error: "Sem permissão" });
    const { empresaId, papel, participacao } = req.body;
    if (!empresaId) return res.status(400).json({ error: "empresaId é obrigatório" });
    const [membro] = await db.insert(tenantGrupoMembros)
      .values({ tenantId: grupo.tenantId, grupoId, empresaId, papel, participacao })
      .returning();
    syncGrupoToControl(grupoId).then(r => {
      console.log(`[sync] Membro adicionado ao grupo ${grupoId} → Control: ${r.membrosSync} membros`);
    }).catch(err => console.warn('[sync] re-sync membro falhou (non-fatal):', err.message));
    res.json(membro);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/grupos/:grupoId/membros/:membroId", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const grupoId = parseInt(req.params.grupoId);
    const membroId = parseInt(req.params.membroId);
    const [grupo] = await db.select().from(tenantGrupos).where(eq(tenantGrupos.id, grupoId));
    if (!grupo) return res.status(404).json({ error: "Grupo não encontrado" });
    if (!(await canAccessTenant(user, grupo.tenantId))) return res.status(403).json({ error: "Sem permissão" });
    await db.delete(tenantGrupoMembros).where(eq(tenantGrupoMembros.id, membroId));
    syncGrupoToControl(grupoId).then(() => {
      console.log(`[sync] Membro removido → grupo ${grupoId} re-sincronizado com Control`);
    }).catch(err => console.warn('[sync] re-sync remoção falhou (non-fatal):', err.message));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/grupos/:id/empresas-clients
// Bridge universal: resolve clienteId (Control UUID) de cada empresa membro do grupo via CNPJ.
// Usado por todos os módulos SOE (HR, Contábil, Fiscal) para filtrar dados pelo grupo.
router.get("/grupos/:id/empresas-clients", async (req: Request, res: Response) => {
  try {
    const grupoId = parseInt(req.params.id);
    if (isNaN(grupoId)) return res.status(400).json({ error: "ID inválido" });

    const [grupo] = await db.select().from(tenantGrupos).where(eq(tenantGrupos.id, grupoId));
    if (!grupo) return res.status(404).json({ error: "Grupo não encontrado" });

    const membros = await db.select({
      id: tenantGrupoMembros.id,
      empresaId: tenantGrupoMembros.empresaId,
      papel: tenantGrupoMembros.papel,
      participacao: tenantGrupoMembros.participacao,
      razaoSocial: tenantEmpresas.razaoSocial,
      nomeFantasia: tenantEmpresas.nomeFantasia,
      cnpj: tenantEmpresas.cnpj,
      tenantIdEmpresa: tenantEmpresas.tenantId,
    }).from(tenantGrupoMembros)
      .leftJoin(tenantEmpresas, eq(tenantGrupoMembros.empresaId, tenantEmpresas.id))
      .where(eq(tenantGrupoMembros.grupoId, grupoId));

    // Para cada membro, buscar o clienteId no Control pelo CNPJ
    const tenantIdStr = String(grupo.tenantId);
    const result = await Promise.all(membros.map(async (m) => {
      let clienteId: string | null = null;
      if (m.cnpj) {
        const clientRes = await db.execute(
          sql`SELECT id FROM clients WHERE tenant_id = ${tenantIdStr} AND cnpj = ${m.cnpj} LIMIT 1`
        );
        clienteId = (clientRes.rows[0] as any)?.id ?? null;
      }
      return {
        membroId: m.id,
        empresaId: m.empresaId,
        papel: m.papel,
        participacao: m.participacao,
        razaoSocial: m.razaoSocial,
        nomeFantasia: m.nomeFantasia,
        cnpj: m.cnpj,
        tenantIdEmpresa: m.tenantIdEmpresa,
        clienteId,
      };
    }));

    res.json({
      grupo: { id: grupo.id, nome: grupo.nome, tipo: grupo.tipo, grupoControlId: (grupo as any).grupoControlId },
      empresas: result,
      clienteIds: result.map(r => r.clienteId).filter(Boolean) as string[],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/grupos/:id/sync", async (req: Request, res: Response) => {
  try {
    const grupoId = Number(req.params.id);
    if (isNaN(grupoId)) return res.status(400).json({ error: "ID inválido" });
    const result = await syncGrupoToControl(grupoId);
    res.json({
      ok: true,
      grupoControlId: result.grupoControlId,
      membrosSync: result.membrosSync,
      membrosErro: result.membrosErro,
      criado: result.criado,
      mensagem: result.criado ? "Grupo criado no Control com sucesso" : "Grupo atualizado no Control com sucesso",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── USR-03: Gestão de usuários do tenant ─────────────────────────────

router.get("/usuarios", async (req: any, res: Response) => {
  if (!req.isAuthenticated?.()) return res.status(401).json({ error: "Não autenticado" });
  const tenantId = req.tenantId ? Number(req.tenantId) : null;
  if (!tenantId) return res.status(400).json({ error: "tenant_required" });

  try {
    const rows = await pool.query(`
      SELECT
        u.id, u.name, u.username, u.email, u.status, u.last_login_at,
        tu.role  AS tenant_role,
        r.id     AS perfil_id,
        r.name   AS perfil_nome,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', te.id,
              'razaoSocial', te.razao_social,
              'nomeFantasia', te.nome_fantasia
            )
          ) FILTER (WHERE te.id IS NOT NULL), '[]'
        ) AS empresas
      FROM tenant_users tu
      JOIN users u ON u.id = tu.user_id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN tenant_user_empresa_access tuea
        ON tuea.user_id = u.id AND tuea.tenant_id = tu.tenant_id
      LEFT JOIN tenant_empresas te ON te.id = tuea.empresa_id
      WHERE tu.tenant_id = $1
      GROUP BY u.id, u.name, u.username, u.email, u.status, u.last_login_at, tu.role, r.id, r.name
      ORDER BY u.name
    `, [tenantId]);
    res.json(rows.rows.map((r: any) => ({ ...r, perfilNome: r.perfil_nome, tenantRole: r.tenant_role })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: resolve tenantId para o usuário admin (fallback à sua própria adesão ao tenant)
async function resolveTenantId(req: any): Promise<number | null> {
  if (req.tenantId) return Number(req.tenantId);
  // Fallback: pega o primeiro tenant do usuário logado
  const row = await pool.query(
    "SELECT tenant_id FROM tenant_users WHERE user_id = $1 ORDER BY tenant_id LIMIT 1",
    [req.user?.id]
  );
  return row.rows[0]?.tenant_id ?? null;
}

// POST /usuarios — Cadastrar novo usuário
router.post("/usuarios", async (req: any, res: Response) => {
  if (!req.isAuthenticated?.()) return res.status(401).json({ message: "Não autenticado" });

  const tenantId = await resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ message: "Tenant não identificado. Selecione uma empresa e tente novamente." });

  const { name, email, username, password, perfilId, empresasIds = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "Nome é obrigatório" });
  if (!email?.trim()) return res.status(400).json({ message: "Email é obrigatório" });
  if (!username?.trim()) return res.status(400).json({ message: "Login é obrigatório" });
  if (!password) return res.status(400).json({ message: "Senha é obrigatória" });
  if (!perfilId) return res.status(400).json({ message: "Perfil de acesso é obrigatório" });

  const client = await pool.connect();
  try {
    const hashedPassword = await hashPassword(password);

    await client.query("BEGIN");

    // Verificar se username ou email já existem
    const exists = await client.query(
      "SELECT id, username, email FROM users WHERE username = $1 OR email = $2 LIMIT 1",
      [username.trim(), email.trim()]
    );
    if (exists.rows.length > 0) {
      await client.query("ROLLBACK");
      const dup = exists.rows[0];
      const field = dup.username === username.trim() ? "Login" : "Email";
      return res.status(409).json({ message: `${field} já está em uso por outro usuário` });
    }

    const userRes = await client.query(
      `INSERT INTO users (id, name, email, username, password, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active') RETURNING id`,
      [name.trim(), email.trim(), username.trim(), hashedPassword]
    );
    const userId = userRes.rows[0].id;

    await client.query(
      "INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [tenantId, userId]
    );
    await client.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, Number(perfilId)]
    );
    for (const empresaId of empresasIds) {
      await client.query(
        "INSERT INTO tenant_user_empresa_access (tenant_id, user_id, empresa_id, created_by) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [tenantId, userId, Number(empresaId), req.user?.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ok: true, userId });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin/usuarios POST]", err.message);
    res.status(500).json({ message: "Erro interno ao cadastrar usuário: " + err.message });
  } finally {
    client.release();
  }
});

// Manter compatibilidade com rota antiga /convidar
router.post("/usuarios/convidar", async (req: any, res: Response) => {
  req.url = "/usuarios";
  return router.handle(req, res, () => {});
});

// PATCH /usuarios/:userId — Editar dados do usuário
router.patch("/usuarios/:userId", async (req: any, res: Response) => {
  if (!req.isAuthenticated?.()) return res.status(401).json({ message: "Não autenticado" });
  const { userId } = req.params;
  const { name, email, password, perfilId } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar email duplicado (excluindo o próprio usuário)
    if (email?.trim()) {
      const dup = await client.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email.trim(), userId]
      );
      if (dup.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Email já está em uso por outro usuário" });
      }
    }

    // Montar campos a atualizar
    const updates: string[] = [];
    const vals: any[] = [];
    if (name?.trim()) { updates.push(`name = $${vals.length + 1}`); vals.push(name.trim()); }
    if (email?.trim()) { updates.push(`email = $${vals.length + 1}`); vals.push(email.trim()); }
    if (password) {
      const hashed = await hashPassword(password);
      updates.push(`password = $${vals.length + 1}`);
      vals.push(hashed);
    }

    if (updates.length > 0) {
      vals.push(userId);
      await client.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = $${vals.length}`,
        vals
      );
    }

    // Atualizar perfil (role)
    if (perfilId) {
      await client.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
      await client.query(
        "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, Number(perfilId)]
      );
    }

    // Atualizar acesso por empresas (se enviado)
    if (Array.isArray(req.body.empresasIds)) {
      const tenantId = await resolveTenantId(req);
      if (tenantId) {
        await client.query(
          "DELETE FROM tenant_user_empresa_access WHERE tenant_id = $1 AND user_id = $2",
          [tenantId, userId]
        );
        for (const empresaId of req.body.empresasIds) {
          await client.query(
            "INSERT INTO tenant_user_empresa_access (tenant_id, user_id, empresa_id, created_by) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
            [tenantId, userId, Number(empresaId), req.user?.id]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin/usuarios PATCH]", err.message);
    res.status(500).json({ message: "Erro ao editar usuário: " + err.message });
  } finally {
    client.release();
  }
});

// PATCH /usuarios/:userId/status — Ativar / Inativar
router.patch("/usuarios/:userId/status", async (req: any, res: Response) => {
  if (!req.isAuthenticated?.()) return res.status(401).json({ message: "Não autenticado" });
  const { status } = req.body;
  if (!["active", "inactive"].includes(status))
    return res.status(400).json({ message: "Status inválido" });
  try {
    await db.update(users).set({ status }).where(eq(users.id, req.params.userId));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /usuarios/:userId — Remover usuário do tenant (mantém conta, remove vínculo)
router.delete("/usuarios/:userId", async (req: any, res: Response) => {
  if (!req.isAuthenticated?.()) return res.status(401).json({ message: "Não autenticado" });
  const tenantId = await resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ message: "Tenant não identificado" });
  const { userId } = req.params;

  // Proteger: não deixar o próprio usuário se excluir
  if (userId === (req.user as any)?.id) {
    return res.status(400).json({ message: "Você não pode remover sua própria conta" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM tenant_user_empresa_access WHERE tenant_id = $1 AND user_id = $2", [tenantId, userId]);
    await client.query("DELETE FROM tenant_users WHERE tenant_id = $1 AND user_id = $2", [tenantId, userId]);
    // Se o usuário não pertence a mais nenhum tenant, remove a conta também
    const remaining = await client.query("SELECT COUNT(*) FROM tenant_users WHERE user_id = $1", [userId]);
    if (Number(remaining.rows[0].count) === 0) {
      await client.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM users WHERE id = $1", [userId]);
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin/usuarios DELETE]", err.message);
    res.status(500).json({ message: "Erro ao remover usuário: " + err.message });
  } finally {
    client.release();
  }
});

router.get("/roles", async (_req: Request, res: Response) => {
  try {
    const rows = await pool.query(
      "SELECT id, name, description, is_system FROM roles ORDER BY is_system DESC, name"
    );
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── USR-04: Permissões granulares por perfil ──────────────────────────

// Todas as permissões disponíveis, agrupadas por grupo/módulo
router.get("/permissions-all", async (_req: Request, res: Response) => {
  try {
    const rows = await pool.query(`
      SELECT id, code, name, module, action,
             COALESCE(grupo, 'Geral') AS grupo,
             COALESCE(ui_key, '') AS ui_key,
             COALESCE(sort_order, 0) AS sort_order
      FROM permissions
      ORDER BY COALESCE(sort_order, 0), module, grupo, name
    `);
    res.json(rows.rows);
  } catch (err: any) {
    console.error("[admin/permissions-all]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Quais permissões um role específico tem
router.get("/roles/:id/permissions", async (req: Request, res: Response) => {
  try {
    const roleId = parseInt(req.params.id);
    if (isNaN(roleId)) return res.status(400).json({ error: "id inválido" });
    const rows = await pool.query(
      `SELECT p.code
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1`,
      [roleId]
    );
    res.json(rows.rows.map((r: any) => r.code));
  } catch (err: any) {
    console.error("[admin/roles/:id/permissions GET]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Substituir todas as permissões de um role (bulk update)
router.put("/roles/:id/permissions", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const roleId = parseInt(req.params.id);
    if (isNaN(roleId)) return res.status(400).json({ error: "id inválido" });
    const { codes = [] } = req.body as { codes: string[] };

    await client.query("BEGIN");
    await client.query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);

    if (codes.length > 0) {
      const permRows = await client.query(
        `SELECT id, code FROM permissions WHERE code = ANY($1)`,
        [codes]
      );
      for (const perm of permRows.rows) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [roleId, perm.id]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ ok: true, total: codes.length });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin/roles/:id/permissions PUT]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Editar nome/descrição de um role
router.patch("/roles/:id", async (req: Request, res: Response) => {
  try {
    const roleId = parseInt(req.params.id);
    if (isNaN(roleId)) return res.status(400).json({ error: "id inválido" });
    const { name, description } = req.body;
    const rows = await pool.query(
      `UPDATE roles SET name = COALESCE($1, name), description = COALESCE($2, description)
       WHERE id = $3 RETURNING id, name, description, is_system`,
      [name, description, roleId]
    );
    if (!rows.rows[0]) return res.status(404).json({ error: "Perfil não encontrado" });
    res.json(rows.rows[0]);
  } catch (err: any) {
    console.error("[admin/roles/:id PATCH]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Criar novo role
router.post("/roles", async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name é obrigatório" });
    const rows = await pool.query(
      `INSERT INTO roles (name, description, is_system) VALUES ($1, $2, 0) RETURNING id, name, description, is_system`,
      [name.trim(), description ?? ""]
    );
    res.status(201).json(rows.rows[0]);
  } catch (err: any) {
    console.error("[admin/roles POST]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
