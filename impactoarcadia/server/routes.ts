import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertApplicationSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth } from "./auth";
import { isOidcDisabled, logAuthMode } from "./authMode";
import { tenantContext } from "./tenantContext";
import tenantsRouter from "./tenants/routes";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerSoeRoutes, registerErpRoutes } from "./erp/routes";
import { registerSoe00Routes } from "./soe/routes";
import { registerCad01Routes } from "./cad/routes";
import { registerFisc01Routes } from "./fisc/routes";
import { registerFisc02Routes } from "./fisc/routes_fisc02";
import { registerCom01Routes } from "./com/routes_com01";
import { registerEst01Routes } from "./est/routes_est01";
import { registerComp01Routes } from "./comp/routes_comp01";
import { registerInt01Routes } from "./int/routes_int01";
import { registerInternalChatRoutes } from "./chat/routes";
import { setupChatSocket } from "./chat/socket";
import { setupCommunitySocket } from "./communities/socket";
import { registerWhatsappRoutes } from "./whatsapp/routes";
import { registerManusRoutes } from "./manus/routes";
import { registerCustomMcpRoutes } from "./mcp/routes";
import { registerAutomationRoutes } from "./automations/routes";
import { registerAutomationEngineRoutes } from "./automations/engine-proxy";
import { registerBiRoutes } from "./bi/routes";
import { registerBiEngineRoutes } from "./bi/engine-proxy";
import { registerCommEngineRoutes } from "./communication/proxy";
import { registerLearningRoutes } from "./learning/routes";
import compassRoutes from "./compass/routes";
import productivityRoutes from "./productivity/routes";
import crmRoutes from "./crm/routes";
import adminRoutes from "./admin/routes";
import productionRoutes from "./production/routes";
import supportRoutes from "./support/routes";
import valuationRoutes from "./valuation/routes";
import ideRoutes from "./ide/routes";
import proxyRoutes from "./proxy/routes";
import loginBridgeRoutes from "./login-bridge/routes";
import emailRoutes from "./email/routes";
import apiCentralRoutes from "./api-central/routes";
import fiscoRoutes from "./fisco/routes";
import contabilRoutes from "./contabil/routes";
import peopleRoutes from "./people/routes";
import { registerFinanceiroRoutes } from "./financeiro/routes";
import { registerControlRoutes } from "./control/routes";
import { registerEngineeringRoutes } from "./engineering/routes";
import { registerHubRoutes } from "./hub/routes";
import { attachSprint45Routes } from "./control/routesNovas";
import { registerClientsRoutes } from "./clientsRoutes";
import { registerPessoasRoutes } from "./pessoasRoutes";
import { attachPessoasFinanceiroRoutes } from "./routes_pessoas_financeiro";
import { registerHrRoutes } from "./hr/routes";
import { registerHrPayrollRoutes } from "./hr/payrollRoutes";
import { registerHrImportRoutes } from "./hr/importRoutes";
import { registerHrExportRoutes } from "./hr/exportRoutes";
import { registerHrReportRoutes } from "./hr/reportRoutes";
import { registerPromptEngineRoutes } from "./prompt-engine/routes";
import { registerCommunityRoutes } from "./communities/routes";
import paraRoutes from "./para/routes";
import protocolsRoutes, { registerAgentCard } from "./protocols";
import erpnextRoutes from "./erpnext/routes";
import qualityRoutes from "./quality/routes";
import lowcodeRoutes from "./lowcode/routes";
import devAgentRoutes from "./devAgent";
import arcadiaDevRoutes from "./arcadia-dev/routes";
import retailRoutes from "./retail/routes";
import marketplaceRoutes from "./marketplace/routes";
import lmsRoutes from "./lms/routes";
import xosRoutes from "./xos/routes";
import governanceRoutes from "./governance/routes";
import { setupPlusProxy } from "./plus/proxy";
import { setupMetabaseProxy } from "./metabase/proxy";
import { registerEngineRoomRoutes } from "./engine-room/routes";
import { registerMetaSetRoutes } from "./metaset/routes";
import plusSsoRoutes from "./plus/sso";
import migrationRoutes from "./migration/routes";
import { githubRoutes } from "./integrations/github";
import autonomousRoutes from "./autonomous/routes";
import blackboardRoutes from "./blackboard/routes";
import pipelineRoutes from "./blackboard/pipelineRoutes";
import { startAllAgents } from "./blackboard/agents";
import { loadModuleRoutes } from "./modules/loader";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Sprint 3 (BOOTSTRAP) — health check público, sem auth, responde imediatamente
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  // Auth and session setup first
  setupAuth(app);
  logAuthMode();

  // Tenant context: injeta req.tenantId em todas as rotas autenticadas
  app.use(tenantContext);

  // Tenant management routes
  app.use('/api/tenants', tenantsRouter);

  const oidcDisabled = isOidcDisabled();
  
  // Arcádia Plus - Proxy registered AFTER session but BEFORE auth-protected routes
  if (oidcDisabled) {
    app.get("/api/plus/status", (_req, res) => {
      res.json({ status: "disabled", reason: "External OIDC/SSO disabled" });
    });
  } else {
    try {
      await setupPlusProxy(app);
    } catch (error: any) {
      console.warn("[startup] Plus proxy/SSO disabled after initialization failure:", error.message);
    }
  }
  
  // Metabase BI - Proxy to Metabase instance
  setupMetabaseProxy(app);
  
  registerChatRoutes(app);
  registerSoeRoutes(app);
  registerSoe00Routes(app);
  registerCad01Routes(app);
  registerFisc01Routes(app);
  registerFisc02Routes(app);
  registerCom01Routes(app);
  registerEst01Routes(app);
  registerComp01Routes(app);
  registerInt01Routes(app);
  registerInternalChatRoutes(app);
  setupChatSocket(httpServer);
  setupCommunitySocket(httpServer);
  registerWhatsappRoutes(app);
  registerManusRoutes(app);
  registerCustomMcpRoutes(app);
  registerAutomationRoutes(app);
  registerAutomationEngineRoutes(app);
  registerBiRoutes(app);
  registerBiEngineRoutes(app);
  registerMetaSetRoutes(app);
  registerCommEngineRoutes(app);
  registerLearningRoutes(app);
  app.use("/api/compass", compassRoutes);
  app.use("/api/productivity", productivityRoutes);
  app.use("/api/crm", crmRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/production", productionRoutes);
  app.use("/api/support", supportRoutes);
  app.use("/api/valuation", valuationRoutes);
  app.use("/api/ide", ideRoutes);
  app.use("/api/proxy", proxyRoutes);
  app.use("/api/login-bridge", loginBridgeRoutes);
  app.use("/api/email", emailRoutes);
  app.use("/api/api-central", apiCentralRoutes);
  app.use("/api/fisco", fiscoRoutes);
  app.use("/api/contabil", contabilRoutes);
  app.use("/api/people", peopleRoutes);
  registerFinanceiroRoutes(app);

  // Arcádia Control (Financial Controller completo)
  registerClientsRoutes(app);
  registerPessoasRoutes(app);
  attachPessoasFinanceiroRoutes(app);
  registerControlRoutes(app);
  registerEngineeringRoutes(app);
  registerHubRoutes(app);
  attachSprint45Routes(app);

  // Arcádia RH/DP (Recursos Humanos / Departamento Pessoal)
  registerHrRoutes(app);
  registerHrPayrollRoutes(app);
  registerHrImportRoutes(app);
  registerHrExportRoutes(app);
  registerHrReportRoutes(app);
  registerPromptEngineRoutes(app);
  registerCommunityRoutes(app);
  app.use("/api/para", paraRoutes);
  app.use("/api/erpnext", erpnextRoutes);
  app.use("/api/quality", qualityRoutes);
  app.use("/api/lowcode", lowcodeRoutes);
  app.use("/api/dev-agent", devAgentRoutes);
  app.use("/api/arcadia-dev", arcadiaDevRoutes);
  app.use("/api/retail", retailRoutes);
  app.use("/api/marketplace", marketplaceRoutes);
  app.use("/api/lms", lmsRoutes);
  app.use("/api/xos", xosRoutes);
  app.use("/api/governance", governanceRoutes);
  registerEngineRoomRoutes(app);
  app.use("/api/migration", migrationRoutes);
  app.use("/api/github", githubRoutes);
  app.use("/api/autonomous", autonomousRoutes);
  app.use("/api/blackboard", blackboardRoutes);
  app.use("/api/xos/pipeline", pipelineRoutes);
  
  // Auto-loader de módulos criados pelo Dev Center
  await loadModuleRoutes(app);
  
  // Iniciar os 6 agentes do Blackboard
  startAllAgents();
  
  // Central de Protocolos (MCP, A2A, AP2, UCP)
  app.use("/api", protocolsRoutes);
  registerAgentCard(app); // Agent Card na raiz (/.well-known/agent.json)
  
  // Arcádia Plus - SSO routes (proxy already registered at top)
  if (oidcDisabled) {
    app.use("/api/plus/sso", (_req, res) => {
      res.status(503).json({ error: "External OIDC/SSO disabled" });
    });
  } else {
    app.use("/api/plus/sso", plusSsoRoutes);
  }

  app.get("/api/tenants", async (_req, res) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  app.get("/api/applications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const user = req.user!;
      
      if (user.role === "admin" || user.role === "master") {
        const apps = await storage.getApplications();
        res.json(apps);
      } else {
        const apps = await storage.getUserApplications(user.id);
        res.json(apps);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  app.get("/api/applications/all", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      if (req.user?.role !== "admin" && req.user?.role !== "master") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const apps = await storage.getApplications();
      res.json(apps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  app.get("/api/applications/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const app = await storage.getApplication(req.params.id);
      if (!app) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.json(app);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch application" });
    }
  });

  app.post("/api/applications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      if (req.user?.role !== "admin" && req.user?.role !== "master") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const validated = insertApplicationSchema.parse(req.body);
      const newApp = await storage.createApplication(validated);
      
      if (newApp && req.user?.id) {
        await storage.assignApplicationToUser(req.user.id, newApp.id);
      }
      
      res.status(201).json(newApp);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create application" });
    }
  });

  app.patch("/api/applications/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      if (req.user?.role !== "admin" && req.user?.role !== "master") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const validated = insertApplicationSchema.partial().parse(req.body);
      const updated = await storage.updateApplication(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  app.delete("/api/applications/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      if (req.user?.role !== "admin" && req.user?.role !== "master") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const deleted = await storage.deleteApplication(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete application" });
    }
  });

  app.post("/api/users/:userId/applications/:appId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      if (req.user?.role !== "admin" && req.user?.role !== "master") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      await storage.assignApplicationToUser(req.params.userId, req.params.appId);
      res.status(201).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to assign application" });
    }
  });

  app.delete("/api/users/:userId/applications/:appId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      if (req.user?.role !== "admin" && req.user?.role !== "master") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      await storage.removeApplicationFromUser(req.params.userId, req.params.appId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove application access" });
    }
  });

  const { getHealthSnapshot, markUnhealthy } = await import('./llm/providerHealth');
  const { getAllProviderConfigs, saveProviderConfig } = await import('./llm/configStore');
  const { pingProvider } = await import('./llm/llmClient');

  // ── USR-02: permissões do usuário logado ─────────────────────────
  app.get("/api/auth/my-permissions", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    try {
      const { Pool } = await import("pg");
      const pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

      const userId = req.user.id;
      const tenantId = req.tenantId;

      const isAdmin =
        req.tenantRole === "owner" ||
        req.tenantRole === "admin" ||
        req.isMaster ||
        req.user?.role === "admin" ||
        req.user?.role === "master";

      if (isAdmin) {
        await pgPool.end();
        return res.json({ permissions: ["*"], empresas: null, isAdmin: true });
      }

      const perfilPerms = await pgPool.query(
        `SELECT DISTINCT p.code
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE ur.user_id = $1`,
        [userId]
      );
      const permSet = new Set<string>(perfilPerms.rows.map((r: any) => r.code));

      if (tenantId) {
        const overrides = await pgPool.query(
          `SELECT permission_code, granted
           FROM user_permission_overrides
           WHERE user_id = $1 AND tenant_id = $2`,
          [userId, tenantId]
        );
        for (const ov of overrides.rows as any[]) {
          if (ov.granted) permSet.add(ov.permission_code);
          else permSet.delete(ov.permission_code);
        }

        const restricoes = await pgPool.query(
          `SELECT empresa_id FROM tenant_user_empresa_access
           WHERE user_id = $1 AND tenant_id = $2`,
          [userId, tenantId]
        );
        const empresas = restricoes.rows.length === 0
          ? null
          : restricoes.rows.map((r: any) => r.empresa_id);

        await pgPool.end();
        return res.json({ permissions: Array.from(permSet), empresas, isAdmin: false });
      }

      await pgPool.end();
      res.json({ permissions: Array.from(permSet), empresas: null, isAdmin: false });
    } catch (e: any) {
      console.error("[my-permissions]", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── USR-01: seed manual via API ───────────────────────────────────
  app.post("/api/admin/rbac/seed", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
    if (req.user?.role !== "admin" && req.user?.role !== "master")
      return res.status(403).json({ error: "admin_required" });
    try {
      const { runRbacSeed } = await import("./seeds/rbacSeed");
      await runRbacSeed();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/llm/health', (_req, res) => {
    res.json({
      providers: getHealthSnapshot(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/llm/config', async (_req, res) => {
    try {
      const configs = await getAllProviderConfigs();
      // Mask keys: return only first 8 chars + "..."
      const safe: any = {};
      for (const [provider, cfg] of Object.entries(configs)) {
        safe[provider] = {
          ...cfg,
          apiKey: cfg.apiKey
            ? cfg.apiKey.substring(0, 8) + '••••••••••••••••'
            : null,
        };
      }
      res.json({ providers: safe, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/llm/config', async (req, res) => {
    try {
      const { provider, apiKey, baseUrl, enabled } = req.body;
      if (!['anthropic', 'gemini', 'ollama'].includes(provider)) {
        return res.status(400).json({ error: 'Provider inválido' });
      }
      await saveProviderConfig(provider, { apiKey, baseUrl, enabled });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/llm/test', async (req, res) => {
    try {
      const { provider } = req.body;
      if (!['anthropic', 'gemini', 'ollama'].includes(provider)) {
        return res.status(400).json({ error: 'Provider inválido' });
      }
      markUnhealthy(provider as any);
      const result = await pingProvider(provider as any);
      res.json({ ok: result.ok, provider, error: result.error });
    } catch (err: any) {
      res.status(500).json({ error: err.message, ok: false });
    }
  });

  return httpServer;
}
