import express, { type Request, Response, NextFunction } from "express";
import { validateProductionSecrets } from "./lib/validateEnv";
import { serveStatic } from "./static";
import { registerAllTools } from "./autonomous/tools";
import { storage } from "./storage";
import { createServer } from "http";
import { spawn } from "child_process";
import path from "path";
import { runControlMigrations } from "./control/migrations";
import { db } from "../db";
import { erpSegments } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isExternalAuthStartupError } from "./authMode";

function getStartupErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function warnExternalAuthStartupError(error: unknown): void {
  console.warn(
    "[startup] External OAuth/OIDC initialization failed; continuing without external SSO:",
    getStartupErrorMessage(error),
  );
}

process.on("unhandledRejection", (reason) => {
  if (isExternalAuthStartupError(reason)) {
    warnExternalAuthStartupError(reason);
    return;
  }

  console.error("[startup] Unhandled promise rejection:", reason);
  throw reason instanceof Error ? reason : new Error(String(reason));
});

process.on("uncaughtException", (error) => {
  if (isExternalAuthStartupError(error)) {
    warnExternalAuthStartupError(error);
    return;
  }

  console.error("[startup] Uncaught exception:", error);
  process.exit(1);
});

// Valida secrets obrigatórios — lança erro imediato se valores padrão inseguros em produção
validateProductionSecrets();

interface ManagedService {
  name: string;
  scriptPath: string;
  port: number;
  process: ReturnType<typeof spawn> | null;
  status: "running" | "stopped" | "restarting";
  startedAt: Date | null;
  restartCount: number;
  logs: string[];
}

const managedServices: Map<string, ManagedService> = new Map();
const MAX_LOG_LINES = 200;

function startPythonService(name: string, scriptPath: string, port: number) {
  const existing = managedServices.get(name);

  const pythonProcess = spawn("python", [scriptPath], {
    env: { ...process.env, [`${name.toUpperCase()}_PORT`]: String(port) },
    stdio: ["pipe", "pipe", "pipe"],
    cwd: process.cwd(),
  });

  const service: ManagedService = {
    name,
    scriptPath,
    port,
    process: pythonProcess,
    status: "running",
    startedAt: new Date(),
    restartCount: existing ? existing.restartCount : 0,
    logs: existing ? existing.logs : [],
  };

  const pushLog = (line: string) => {
    service.logs.push(`[${new Date().toISOString()}] ${line}`);
    if (service.logs.length > MAX_LOG_LINES) {
      service.logs = service.logs.slice(-MAX_LOG_LINES);
    }
  };

  pythonProcess.stdout?.on("data", (data) => {
    const msg = data.toString().trim();
    console.log(`[${name}] ${msg}`);
    pushLog(`[stdout] ${msg}`);
  });

  pythonProcess.stderr?.on("data", (data) => {
    const msg = data.toString().trim();
    console.error(`[${name}] ${msg}`);
    pushLog(`[stderr] ${msg}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`[${name}] Process exited with code ${code}`);
    pushLog(`Process exited with code ${code}`);
    if (service.status === "stopped" || service.status === "restarting") {
      service.process = null;
      return;
    }
    service.process = null;
    if (code !== 0) {
      service.status = "restarting";
      service.restartCount++;
      console.log(`[${name}] Restarting in 5 seconds...`);
      setTimeout(() => startPythonService(name, scriptPath, port), 5000);
    } else {
      service.status = "stopped";
    }
  });

  managedServices.set(name, service);
  return pythonProcess;
}

function restartManagedService(name: string): boolean {
  const service = managedServices.get(name);
  if (!service) return false;

  if (service.process) {
    service.status = "restarting";
    const proc = service.process;
    service.process = null;
    proc.kill("SIGTERM");
    setTimeout(() => {
      try { proc.kill("SIGKILL"); } catch {}
      startPythonService(service.name, service.scriptPath, service.port);
    }, 2000);
  } else {
    startPythonService(service.name, service.scriptPath, service.port);
  }
  return true;
}

function stopManagedService(name: string): boolean {
  const service = managedServices.get(name);
  if (!service || !service.process) return false;
  service.status = "stopped";
  const proc = service.process;
  service.process = null;
  proc.kill("SIGTERM");
  setTimeout(() => {
    try { proc.kill("SIGKILL"); } catch {}
  }, 3000);
  return true;
}

function getManagedServiceInfo(name: string) {
  const service = managedServices.get(name);
  if (!service) return null;
  return {
    name: service.name,
    port: service.port,
    status: service.status,
    startedAt: service.startedAt?.toISOString() || null,
    restartCount: service.restartCount,
    uptime: service.startedAt ? Math.round((Date.now() - service.startedAt.getTime()) / 1000) : 0,
    logLines: service.logs.length,
  };
}

function getManagedServiceLogs(name: string, lines = 50): string[] {
  const service = managedServices.get(name);
  if (!service) return [];
  return service.logs.slice(-lines);
}

function startNodeService(name: string, scriptPath: string, port: number) {
  const existing = managedServices.get(name);

  const service: ManagedService = {
    name,
    scriptPath,
    port,
    process: null,
    status: "running",
    startedAt: new Date(),
    restartCount: existing?.restartCount || 0,
    logs: existing?.logs || [],
  };

  const pushLog = (msg: string) => {
    service.logs.push(`[${new Date().toISOString()}] ${msg}`);
    if (service.logs.length > MAX_LOG_LINES) service.logs.splice(0, service.logs.length - MAX_LOG_LINES);
  };

  const nodeProcess = spawn("npx", ["tsx", scriptPath], {
    env: { ...process.env, PORT: port.toString() },
    stdio: ["pipe", "pipe", "pipe"],
  });

  service.process = nodeProcess;
  pushLog(`Node service started (PID: ${nodeProcess.pid})`);

  nodeProcess.stdout?.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) {
      console.log(`[${name}] ${msg}`);
      pushLog(msg);
    }
  });

  nodeProcess.stderr?.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) {
      console.error(`[${name}] ${msg}`);
      pushLog(`[stderr] ${msg}`);
    }
  });

  nodeProcess.on("close", (code) => {
    console.log(`[${name}] Process exited with code ${code}`);
    pushLog(`Process exited with code ${code}`);
    if (service.status === "stopped" || service.status === "restarting") {
      service.process = null;
      return;
    }
    service.process = null;
    if (code !== 0) {
      service.status = "restarting";
      service.restartCount++;
      console.log(`[${name}] Restarting in 5 seconds...`);
      setTimeout(() => startNodeService(name, scriptPath, port), 5000);
    } else {
      service.status = "stopped";
    }
  });

  managedServices.set(name, service);
  return nodeProcess;
}

export { managedServices, restartManagedService, stopManagedService, getManagedServiceInfo, getManagedServiceLogs, startNodeService };

// Sprint 3 (BOOTSTRAP): spawns movidos para APÓS httpServer.listen (ver fim do bloco async abaixo)
// startPythonService("contabil", ...8003);
// startPythonService("bi", ...8004);
// startPythonService("automation", ...8005);
// startNodeService("communication", ...8006);

function startShellService(name: string, scriptPath: string, port: number) {
  const existing = managedServices.get(name);

  const service: ManagedService = {
    name,
    scriptPath,
    port,
    process: null,
    status: "running",
    startedAt: new Date(),
    restartCount: existing?.restartCount || 0,
    logs: existing?.logs || [],
  };

  const pushLog = (msg: string) => {
    service.logs.push(`[${new Date().toISOString()}] ${msg}`);
    if (service.logs.length > MAX_LOG_LINES) service.logs.splice(0, service.logs.length - MAX_LOG_LINES);
  };

  const shellProcess = spawn("bash", [scriptPath], {
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
  });

  service.process = shellProcess;
  pushLog(`Shell service started (PID: ${shellProcess.pid})`);

  shellProcess.stdout?.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) {
      console.log(`[${name}] ${msg}`);
      pushLog(msg);
    }
  });

  shellProcess.stderr?.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) {
      console.error(`[${name}] ${msg}`);
      pushLog(`[stderr] ${msg}`);
    }
  });

  shellProcess.on("close", (code) => {
    console.log(`[${name}] Process exited with code ${code}`);
    pushLog(`Process exited with code ${code}`);
    if (service.status === "stopped" || service.status === "restarting") {
      service.process = null;
      return;
    }
    service.process = null;
    if (code !== 0) {
      service.status = "restarting";
      service.restartCount++;
      console.log(`[${name}] Restarting in 10 seconds...`);
      setTimeout(() => startShellService(name, scriptPath, port), 10000);
    } else {
      service.status = "stopped";
    }
  });

  managedServices.set(name, service);
  return shellProcess;
}


// Sprint 3 (BOOTSTRAP): executa fn sem derrubar o processo principal se falhar
function safeInit(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve().then(fn).catch((e: any) =>
    console.warn(`[startup] ${name} (não crítico):`, e.message)
  );
}

const app = express();
const httpServer = createServer(app);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Plus proxy is configured in server/plus/proxy.ts via setupPlusProxy
// It's registered after session middleware to enable SSO authentication

(async () => {
  // Migrações idempotentes do Control + Pessoas + HR
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await runControlMigrations(pool);
    await pool.end();
  } catch (e: any) {
    console.warn("[startup] Control migrations warning:", e.message);
  }

  // Sprint 2 — FK quality_samples + quality_non_conformities → engineering_projects
  try {
    const { runMigrationQualityEngLink } = await import("./quality/migration_quality_eng_link");
    await runMigrationQualityEngLink();
  } catch (e: any) {
    console.warn("[startup] Quality eng-link migration warning:", e.message);
  }

  // CTL-IMP-01 — projeto_id + projeto_codigo em lancamentos_financeiros
  try {
    const { runMigrationCtlImp01 } = await import("./control/migration_ctl_imp01");
    await runMigrationCtlImp01();
  } catch (e: any) {
    console.warn("[startup] CTL-IMP-01 migration warning:", e.message);
  }

  // HUB-IMP-01 — codigo_externo + fase_atual + checklist_fases + project_billing_blockers
  try {
    const { runMigrationHubImp01 } = await import("./hub/migration_imp01");
    const r = await runMigrationHubImp01();
    if (!r.ok) console.warn("[startup] HUB-IMP-01 warnings:", r.log.filter(l => l.startsWith("✗")));
    else console.log("[startup] HUB-IMP-01: OK");
  } catch (e: any) {
    console.warn("[startup] HUB-IMP-01 migration warning:", e.message);
  }

  // CTL-IMPORT-01 — colunas auxiliares de importação em lancamentos_financeiros
  try {
    const { runMigrationImportCols } = await import("./control/migration_import_cols");
    await runMigrationImportCols();
  } catch (e: any) {
    console.warn("[startup] CTL-IMPORT-01 migration warning:", e.message);
  }

  // Seed master user if not exists
  try {
    const { scrypt, randomBytes } = await import("crypto");
    const { promisify } = await import("util");
    const scryptAsync = promisify(scrypt);
    const existingAdmin = await storage.getUserByUsername("admin");
    if (!existingAdmin) {
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync("admin", salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
        name: "Administrador Master",
        email: "admin@arcadia.suite",
        role: "master",
        status: "active",
      });
      console.log("[Seed] Usuário master 'admin' criado com sucesso");
    }
  } catch (e: any) {
    console.log("[Seed] Verificação de usuário master:", e.message);
  }

  // USR-01: RBAC seed — 8 perfis + 50 permissões (idempotente)
  try {
    const { runRbacSeed } = await import("./seeds/rbacSeed");
    await runRbacSeed();
    console.log('[startup] RBAC seed concluído');
  } catch (e: any) {
    console.warn('[startup] RBAC seed aviso:', e.message);
  }

  // Auto-seed perfis de segmento se não existirem
  try {
    const existing = await db.select().from(erpSegments).limit(1);
    if (existing.length === 0) {
      const defaultSegments = [
        { code: "varejo_geral", name: "Varejo Geral", category: "comercial", description: "Supermercados, farmácias, lojas em geral", modules: ["vendas", "estoque", "financeiro", "fisco"] as string[] },
        { code: "assistencia_tecnica", name: "Assistência Técnica", category: "comercial", description: "Serviços de manutenção e reparo", modules: ["os", "vendas", "estoque", "financeiro"] as string[], features: { ordemServico: true } },
        { code: "autopecas", name: "Autopeças", category: "comercial", description: "Loja de autopeças com ou sem serviços", modules: ["vendas", "estoque", "financeiro", "fisco"] as string[], features: { catalogoPecas: true } },
        { code: "engenharia", name: "Engenharia/Projetos", category: "comercial", description: "Empresas de engenharia e consultoria", modules: ["projetos", "financeiro", "crm"] as string[], features: { timesheet: true } },
        { code: "engenharia_ambiental", name: "Engenharia Ambiental e Serviços", category: "servicos", description: "Geologia, Meio Ambiente, Consultoria Ambiental - ISO 17025", modules: ["projetos", "qualidade", "crm", "vendas", "financeiro", "fisco", "rh"] as string[], features: { controleAmostras: true, laudosLaboratoriais: true, rncAcoesCorretivas: true, qmsDocumentos: true, iso17025: true, propostaProjeto: true } },
        { code: "laboratorio_analises", name: "Laboratório de Análises", category: "servicos", description: "Laboratórios de análises químicas, ambientais e clínicas", modules: ["qualidade", "vendas", "financeiro", "fisco"] as string[], features: { gestaoAmostras: true, laudos: true, acreditacao: true } },
        { code: "industria_quimica", name: "Indústria Química", category: "industria", description: "Produção de produtos químicos", modules: ["producao", "estoque", "vendas", "financeiro", "fisco"] as string[], features: { rastreabilidade: true, formulas: true } },
        { code: "industria_alimentos", name: "Indústria de Alimentos", category: "industria", description: "Produção de alimentos e bebidas", modules: ["producao", "estoque", "vendas", "financeiro", "fisco"] as string[], features: { fichaTecnica: true, validade: true } },
        { code: "industria_metalurgica", name: "Indústria Metalúrgica", category: "industria", description: "Produção metalúrgica e mecânica", modules: ["producao", "estoque", "vendas", "financeiro", "fisco"] as string[], features: { ordemProducao: true, bom: true } },
        { code: "distribuidor_atacado", name: "Distribuidor/Atacadista", category: "distribuidor", description: "Distribuição e atacado", modules: ["vendas", "estoque", "logistica", "financeiro", "fisco"] as string[], features: { logistica: true, tabelasPreco: true } },
        { code: "transportadora", name: "Transportadora", category: "distribuidor", description: "Transporte de cargas", modules: ["logistica", "financeiro", "fisco"] as string[], features: { cte: true, mdfe: true, rastreamento: true } },
        { code: "ecommerce_b2c", name: "E-commerce B2C", category: "ecommerce", description: "Venda online para consumidor final", modules: ["vendas", "estoque", "financeiro", "fisco"] as string[], features: { marketplace: true, logisticaReversa: true } },
        { code: "ecommerce_b2b", name: "E-commerce B2B", category: "ecommerce", description: "Venda online para empresas", modules: ["vendas", "estoque", "financeiro", "crm", "fisco"] as string[], features: { catalogoPersonalizado: true } },
        { code: "restaurante", name: "Restaurante", category: "foodservice", description: "Restaurantes e bares", modules: ["vendas", "estoque", "financeiro"] as string[], features: { mesas: true, comandas: true, fichaTecnica: true } },
        { code: "delivery", name: "Delivery/Lanchonete", category: "foodservice", description: "Delivery e fast food", modules: ["vendas", "estoque", "financeiro"] as string[], features: { delivery: true, ifood: true } },
        { code: "padaria", name: "Padaria/Confeitaria", category: "foodservice", description: "Panificação e confeitaria", modules: ["producao", "vendas", "estoque", "financeiro"] as string[], features: { producaoDiaria: true } },
        { code: "decoracao_cortinas", name: "Decoração, Cortinas e Persianaria", category: "servicos", description: "Lojas de decoração sob medida — cortinas, persianas, papel de parede, tapetes, bandôs.", modules: ["crm", "vendas", "financeiro", "fisco", "rh", "pedidos_tecnicos", "configurador", "estoque", "compras"] as string[], features: { configuradorProduto: true, calculadoraMedidas: true, osProducaoAtelie: true, osInstalacao: true, etiquetasPecas: true, checklistOperacional: true, termoRecebimento: true, guiasImpressao: true, catalogoDisponibilidade: true, analiseTecnica: true, clienteFinal: true, especificador: true, engineering: false, quality: false, iso17025: false, controleAmostras: false, propostaProjeto: false, prestacaoContasCampo: false, matrizTreinamentos: false, rncAcoesCorretivas: false, laudosLaboratoriais: false, formulariosDigitais: false } },
      ];
      for (const seg of defaultSegments) {
        await db.insert(erpSegments).values(seg as any).onConflictDoNothing();
      }
      console.log(`[Seed] ${defaultSegments.length} perfis de segmento criados`);
    }
  } catch (e: any) {
    console.warn("[Seed] Aviso ao seed de segmentos:", e.message);
  }

  try {
    const { registerRoutes } = await import("./routes");
    await registerRoutes(httpServer, app);
  } catch (error) {
    if (!isExternalAuthStartupError(error)) {
      throw error;
    }

    warnExternalAuthStartupError(error);
    app.get("/api/plus/status", (_req, res) => {
      res.json({ status: "disabled", reason: "External OAuth/OIDC initialization failed" });
    });
    app.use("/api/plus/sso", (_req, res) => {
      res.status(503).json({ error: "External OAuth/OIDC unavailable" });
    });
  }

  await registerAllTools();

  const { startHealthProbe } = await import('./llm');
  startHealthProbe();

  const { jobQueueService } = await import("./governance/jobQueue");
  const { pipelineOrchestrator } = await import("./blackboard/PipelineOrchestrator");
  pipelineOrchestrator.registerJobHandlers();
  jobQueueService.startProcessing();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Crons do Control — alertas orçamentários (07:30) e NF-e Monitor (1h)
  try {
    const cron = (await import("node-cron")).default;
    const { verificarDesviosOrcamento } = await import("./control/alertasService");
    const { runNfeMonitor } = await import("./control/nfeMonitor");
    cron.schedule("30 7 * * *", async () => {
      console.log("[control-cron] verificando desvios orçamentários...");
      await verificarDesviosOrcamento().catch(console.error);
    }, { timezone: "America/Sao_Paulo" });
    cron.schedule("0 * * * *", async () => {
      await runNfeMonitor().catch(console.error);
    }, { timezone: "America/Sao_Paulo" });
    console.log("[control-cron] alertas + nfe monitor agendados");
  } catch (e: any) {
    console.warn("[control-cron] crons não registrados:", e.message);
  }

  // Hub — notificações diárias às 08h (NOTIF-01) + KPI snapshots às 02h
  try {
    const cron = (await import("node-cron")).default;
    const { runNotificationJob } = await import("./hub/notificationService");
    const { runDailyKpiJob }     = await import("./hub/kpiEngine");
    cron.schedule("0 8 * * *", async () => {
      console.log("[hub-cron] notificações diárias...");
      const r = await runNotificationJob().catch((e: any) => ({ error: e.message }));
      console.log("[hub-cron] notif:", r);
    }, { timezone: "America/Sao_Paulo" });
    cron.schedule("0 2 * * *", async () => {
      console.log("[hub-cron] KPI snapshots...");
      const r = await runDailyKpiJob().catch((e: any) => ({ error: e.message }));
      console.log("[hub-cron] kpi:", r);
    }, { timezone: "America/Sao_Paulo" });
    console.log("[hub-cron] notificações + kpi agendados");
  } catch (e: any) {
    console.warn("[hub-cron] crons não registrados:", e.message);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  // SOE-00 — EventWorker (outbox transacional de eventos de domínio) — crítico, mantém sem safeInit
  const { startEventWorker } = await import("./soe/eventBus");
  startEventWorker();

  // INT-01 — registro central de todos os consumers de eventos SOE — crítico
  const { registerAllSoeHandlers } = await import("./int/intHandlers");
  registerAllSoeHandlers();

  // Sprint 3 (BOOTSTRAP): serviços auxiliares após HTTP estar online
  // Falha individual não derruba o servidor
  safeInit("Python contabil",    () => startPythonService("contabil",   path.join(process.cwd(), "server/python/contabil_service.py"),  8003));
  safeInit("Python BI",          () => startPythonService("bi",         path.join(process.cwd(), "server/python/bi_engine.py"),         8004));
  safeInit("Python automation",  () => startPythonService("automation", path.join(process.cwd(), "server/python/automation_engine.py"), 8005));
  safeInit("Node communication", () => startNodeService("communication", path.join(process.cwd(), "server/communication/engine.ts"),    8006));
})();
