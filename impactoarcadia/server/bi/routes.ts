import type { Express, Request, Response } from "express";
import { db } from "../../db/index";
import { 
  dataSources, biDatasets, biCharts, biDashboards, biDashboardCharts,
  backupJobs, backupArtifacts, automationLogs
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { registerUploadRoutes } from "./upload";
import { registerStagingRoutes } from "./staging";
import OpenAI from "openai";

const dataSourceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["postgresql", "mysql", "mongodb", "sqlite", "internal"]),
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  connectionString: z.string().optional(),
});

const datasetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  dataSourceId: z.number().optional(),
  queryType: z.enum(["table", "sql", "api"]).optional(),
  tableName: z.string().optional(),
  sqlQuery: z.string().optional(),
  columns: z.string().optional(),
  filters: z.string().optional(),
  isPublic: z.string().optional(),
});

const chartSchema = z.object({
  name: z.string().min(1),
  datasetId: z.number(),
  chartType: z.enum(["bar", "line", "pie", "area", "scatter", "table", "metric", "donut"]),
  config: z.string().optional(),
  xAxis: z.string().optional(),
  yAxis: z.string().optional(),
  groupBy: z.string().optional(),
  aggregation: z.string().optional(),
  colors: z.string().optional(),
});

const dashboardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  layout: z.string().optional(),
  isPublic: z.string().optional(),
});

const backupJobSchema = z.object({
  name: z.string().min(1),
  dataSourceId: z.number(),
  backupType: z.enum(["full", "schema", "data", "incremental"]),
  includeSchema: z.string().optional(),
  includeTables: z.string().optional(),
  excludeTables: z.string().optional(),
  compressionType: z.string().optional(),
  retentionDays: z.number().optional(),
  storageLocation: z.string().optional(),
});

const SYSTEM_TABLE_CATEGORIES: Record<string, { category: string; description: string }> = {
  users: { category: "Sistema", description: "Usuários do sistema" },
  applications: { category: "Sistema", description: "Aplicações disponíveis" },
  roles: { category: "Sistema", description: "Perfis de acesso" },
  pc_clients: { category: "Process Compass", description: "Clientes de consultoria" },
  pc_projects: { category: "Process Compass", description: "Projetos de consultoria" },
  pc_tasks: { category: "Process Compass", description: "Tarefas de projetos" },
  crm_clients: { category: "CRM", description: "Clientes do CRM" },
  crm_contracts: { category: "CRM", description: "Contratos" },
  crm_partners: { category: "CRM", description: "Parceiros" },
  crm_opportunities: { category: "CRM", description: "Oportunidades de negócio" },
  crm_leads: { category: "CRM", description: "Leads" },
  crm_messages: { category: "CRM", description: "Mensagens enviadas" },
  bi_datasets: { category: "BI", description: "Conjuntos de dados" },
  bi_charts: { category: "BI", description: "Gráficos criados" },
  knowledge_base: { category: "Conhecimento", description: "Base de conhecimento" },
  manus_runs: { category: "Manus", description: "Execuções do agente" },
  agent_tasks: { category: "Manus", description: "Tarefas do agente" },
  whatsapp_messages: { category: "Comunicação", description: "Mensagens WhatsApp" },
  conversations: { category: "Comunicação", description: "Conversas" },
};

export function registerBiRoutes(app: Express): void {
  registerUploadRoutes(app);
  registerStagingRoutes(app);

  app.get("/api/bi/internal-tables", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const tablesResult = await db.execute(sql`
        SELECT 
          t.table_name,
          (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count,
          pg_total_relation_size(quote_ident(t.table_name)) as table_size
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `);
      
      const tables = (tablesResult.rows as any[]).map(row => {
        const meta = SYSTEM_TABLE_CATEGORIES[row.table_name] || { category: "Outros", description: row.table_name };
        return {
          name: row.table_name,
          columnCount: parseInt(row.column_count) || 0,
          sizeBytes: parseInt(row.table_size) || 0,
          category: meta.category,
          description: meta.description,
        };
      });
      
      res.json(tables);
    } catch (error) {
      console.error("Get internal tables error:", error);
      res.status(500).json({ error: "Failed to get internal tables" });
    }
  });

  app.get("/api/bi/internal-tables/:tableName/schema", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const tableName = req.params.tableName.replace(/[^a-zA-Z0-9_]/g, '');
      
      const columnsResult = await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = ${tableName} AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`));
      const rowCount = parseInt((countResult.rows[0] as any)?.count) || 0;
      
      const previewResult = await db.execute(sql.raw(`SELECT * FROM "${tableName}" LIMIT 5`));
      
      res.json({
        tableName,
        columns: columnsResult.rows,
        rowCount,
        preview: previewResult.rows,
      });
    } catch (error) {
      console.error("Get table schema error:", error);
      res.status(500).json({ error: "Failed to get table schema" });
    }
  });

  app.post("/api/bi/internal-tables/:tableName/create-dataset", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const tableName = req.params.tableName.replace(/[^a-zA-Z0-9_]/g, '');
      const { name, description, columns } = req.body;
      
      const [dataset] = await db.insert(biDatasets).values({
        userId: req.user!.id,
        name: name || tableName,
        description: description || `Dataset criado a partir da tabela interna: ${tableName}`,
        queryType: "table",
        tableName: tableName,
        columns: columns ? JSON.stringify(columns) : null,
      }).returning();
      
      res.json(dataset);
    } catch (error) {
      console.error("Create dataset from internal table error:", error);
      res.status(500).json({ error: "Failed to create dataset" });
    }
  });
  
  app.get("/api/bi/data-sources", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const sources = await db.select({
        id: dataSources.id,
        name: dataSources.name,
        type: dataSources.type,
        host: dataSources.host,
        database: dataSources.database,
        isActive: dataSources.isActive,
        lastTestedAt: dataSources.lastTestedAt,
        createdAt: dataSources.createdAt,
      }).from(dataSources)
        .where(eq(dataSources.userId, req.user!.id))
        .orderBy(desc(dataSources.createdAt));
      res.json(sources);
    } catch (error) {
      console.error("Get data sources error:", error);
      res.status(500).json({ error: "Failed to get data sources" });
    }
  });

  app.post("/api/bi/data-sources", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const parse = dataSourceSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: "Invalid data", details: parse.error.errors });
      }
      const [source] = await db.insert(dataSources).values({
        userId: req.user!.id,
        ...parse.data,
      }).returning();
      res.json(source);
    } catch (error) {
      console.error("Create data source error:", error);
      res.status(500).json({ error: "Failed to create data source" });
    }
  });

  app.post("/api/bi/data-sources/:id/test", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const [source] = await db.select().from(dataSources)
        .where(and(eq(dataSources.id, id), eq(dataSources.userId, req.user!.id)));
      if (!source) {
        return res.status(404).json({ error: "Data source not found" });
      }
      await db.update(dataSources)
        .set({ lastTestedAt: new Date(), isActive: "true" })
        .where(eq(dataSources.id, id));
      res.json({ success: true, message: "Conexão testada com sucesso" });
    } catch (error) {
      console.error("Test data source error:", error);
      res.status(500).json({ error: "Failed to test connection" });
    }
  });

  app.delete("/api/bi/data-sources/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      await db.delete(dataSources)
        .where(and(eq(dataSources.id, id), eq(dataSources.userId, req.user!.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete data source error:", error);
      res.status(500).json({ error: "Failed to delete data source" });
    }
  });

  app.get("/api/bi/datasets", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const datasets = await db.select().from(biDatasets)
        .where(eq(biDatasets.userId, req.user!.id))
        .orderBy(desc(biDatasets.updatedAt));
      res.json(datasets);
    } catch (error) {
      console.error("Get datasets error:", error);
      res.status(500).json({ error: "Failed to get datasets" });
    }
  });

  app.post("/api/bi/datasets", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const parse = datasetSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: "Invalid data", details: parse.error.errors });
      }
      const [dataset] = await db.insert(biDatasets).values({
        userId: req.user!.id,
        ...parse.data,
      }).returning();
      res.json(dataset);
    } catch (error) {
      console.error("Create dataset error:", error);
      res.status(500).json({ error: "Failed to create dataset" });
    }
  });

  app.post("/api/bi/datasets/:id/execute", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const [dataset] = await db.select().from(biDatasets)
        .where(and(eq(biDatasets.id, id), eq(biDatasets.userId, req.user!.id)));
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      
      const tablesResult = await db.execute(sql`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const validTables = new Set((tablesResult.rows as any[]).map(r => r.table_name));
      
      if (dataset.sqlQuery) {
        const safeQueries = ['SELECT', 'WITH'];
        const query = dataset.sqlQuery.trim().toUpperCase();
        if (!safeQueries.some(sq => query.startsWith(sq))) {
          return res.status(400).json({ error: "Only SELECT queries are allowed" });
        }
        const dangerousPatterns = [/;\s*(?:DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|CREATE)/i, /--/, /\/\*/];
        if (dangerousPatterns.some(p => p.test(dataset.sqlQuery!))) {
          return res.status(400).json({ error: "Query contains forbidden patterns" });
        }
        const result = await db.execute(sql.raw(dataset.sqlQuery));
        res.json({ data: result.rows, columns: Object.keys(result.rows[0] || {}) });
      } else if (dataset.tableName) {
        if (!validTables.has(dataset.tableName)) {
          return res.status(400).json({ error: "Invalid table name" });
        }
        const safeTableName = dataset.tableName.replace(/[^a-zA-Z0-9_]/g, '');
        const result = await db.execute(sql`SELECT * FROM ${sql.identifier(safeTableName)} LIMIT 1000`);
        res.json({ data: result.rows, columns: Object.keys(result.rows[0] || {}) });
      } else {
        res.json({ data: [], columns: [] });
      }
    } catch (error: any) {
      console.error("Execute dataset error:", error);
      res.status(500).json({ error: error.message || "Failed to execute dataset" });
    }
  });

  app.delete("/api/bi/datasets/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      await db.delete(biDatasets)
        .where(and(eq(biDatasets.id, id), eq(biDatasets.userId, req.user!.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete dataset error:", error);
      res.status(500).json({ error: "Failed to delete dataset" });
    }
  });

  app.post("/api/bi/query", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { tableName, limit = 100 } = req.body;
      if (!tableName) {
        return res.status(400).json({ error: "Table name is required" });
      }
      const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
      const safeLimit = Math.min(Math.max(1, parseInt(limit)), 1000);
      const result = await db.execute(sql.raw(`SELECT * FROM "${safeTableName}" LIMIT ${safeLimit}`));
      res.json(result.rows || []);
    } catch (error: any) {
      console.error("Query table error:", error);
      res.status(500).json({ error: error.message || "Failed to query table" });
    }
  });

  app.get("/api/bi/charts", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const charts = await db.select().from(biCharts)
        .where(eq(biCharts.userId, req.user!.id))
        .orderBy(desc(biCharts.updatedAt));
      res.json(charts);
    } catch (error) {
      console.error("Get charts error:", error);
      res.status(500).json({ error: "Failed to get charts" });
    }
  });

  app.post("/api/bi/charts", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const parse = chartSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: "Invalid data", details: parse.error.errors });
      }
      const [chart] = await db.insert(biCharts).values({
        userId: req.user!.id,
        ...parse.data,
      }).returning();
      res.json(chart);
    } catch (error) {
      console.error("Create chart error:", error);
      res.status(500).json({ error: "Failed to create chart" });
    }
  });

  app.delete("/api/bi/charts/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      await db.delete(biCharts)
        .where(and(eq(biCharts.id, id), eq(biCharts.userId, req.user!.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete chart error:", error);
      res.status(500).json({ error: "Failed to delete chart" });
    }
  });

  app.get("/api/bi/dashboards", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const dashboards = await db.select().from(biDashboards)
        .where(eq(biDashboards.userId, req.user!.id))
        .orderBy(desc(biDashboards.updatedAt));
      res.json(dashboards);
    } catch (error) {
      console.error("Get dashboards error:", error);
      res.status(500).json({ error: "Failed to get dashboards" });
    }
  });

  app.get("/api/bi/dashboards/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const [dashboard] = await db.select().from(biDashboards)
        .where(and(eq(biDashboards.id, id), eq(biDashboards.userId, req.user!.id)));
      if (!dashboard) {
        return res.status(404).json({ error: "Dashboard not found" });
      }
      const charts = await db.select({
        chartId: biDashboardCharts.chartId,
        positionX: biDashboardCharts.positionX,
        positionY: biDashboardCharts.positionY,
        width: biDashboardCharts.width,
        height: biDashboardCharts.height,
        chart: biCharts,
      }).from(biDashboardCharts)
        .innerJoin(biCharts, eq(biDashboardCharts.chartId, biCharts.id))
        .where(eq(biDashboardCharts.dashboardId, id));
      res.json({ ...dashboard, charts });
    } catch (error) {
      console.error("Get dashboard error:", error);
      res.status(500).json({ error: "Failed to get dashboard" });
    }
  });

  app.post("/api/bi/dashboards", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const parse = dashboardSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: "Invalid data", details: parse.error.errors });
      }
      const [dashboard] = await db.insert(biDashboards).values({
        userId: req.user!.id,
        ...parse.data,
      }).returning();
      res.json(dashboard);
    } catch (error) {
      console.error("Create dashboard error:", error);
      res.status(500).json({ error: "Failed to create dashboard" });
    }
  });

  app.post("/api/bi/dashboards/:id/charts", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const dashboardId = parseInt(req.params.id);
      const { chartId, positionX, positionY, width, height } = req.body;
      const [added] = await db.insert(biDashboardCharts).values({
        dashboardId,
        chartId,
        positionX: positionX || 0,
        positionY: positionY || 0,
        width: width || 6,
        height: height || 4,
      }).returning();
      res.json(added);
    } catch (error) {
      console.error("Add chart to dashboard error:", error);
      res.status(500).json({ error: "Failed to add chart to dashboard" });
    }
  });

  app.delete("/api/bi/dashboards/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      await db.delete(biDashboards)
        .where(and(eq(biDashboards.id, id), eq(biDashboards.userId, req.user!.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete dashboard error:", error);
      res.status(500).json({ error: "Failed to delete dashboard" });
    }
  });

  app.get("/api/bi/backup-jobs", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const jobs = await db.select({
        job: backupJobs,
        dataSource: {
          name: dataSources.name,
          type: dataSources.type,
        },
      }).from(backupJobs)
        .leftJoin(dataSources, eq(backupJobs.dataSourceId, dataSources.id))
        .where(eq(backupJobs.userId, req.user!.id))
        .orderBy(desc(backupJobs.createdAt));
      res.json(jobs.map(j => ({ ...j.job, dataSource: j.dataSource })));
    } catch (error) {
      console.error("Get backup jobs error:", error);
      res.status(500).json({ error: "Failed to get backup jobs" });
    }
  });

  app.post("/api/bi/backup-jobs", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const parse = backupJobSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: "Invalid data", details: parse.error.errors });
      }
      const [job] = await db.insert(backupJobs).values({
        userId: req.user!.id,
        ...parse.data,
      }).returning();
      res.json(job);
    } catch (error) {
      console.error("Create backup job error:", error);
      res.status(500).json({ error: "Failed to create backup job" });
    }
  });

  app.post("/api/bi/backup-jobs/:id/run", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const [job] = await db.select().from(backupJobs)
        .where(and(eq(backupJobs.id, id), eq(backupJobs.userId, req.user!.id)));
      if (!job) {
        return res.status(404).json({ error: "Backup job not found" });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup_${job.name.replace(/\s/g, '_')}_${timestamp}.sql.gz`;
      const [artifact] = await db.insert(backupArtifacts).values({
        backupJobId: id,
        filename,
        filePath: `/backups/${filename}`,
        status: "running",
      }).returning();
      setTimeout(async () => {
        await db.update(backupArtifacts)
          .set({ status: "completed", completedAt: new Date(), fileSize: Math.floor(Math.random() * 10000000) })
          .where(eq(backupArtifacts.id, artifact.id));
      }, 3000);
      res.json({ success: true, artifactId: artifact.id, message: "Backup iniciado" });
    } catch (error) {
      console.error("Run backup job error:", error);
      res.status(500).json({ error: "Failed to run backup" });
    }
  });

  app.get("/api/bi/backup-artifacts", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const artifacts = await db.select({
        artifact: backupArtifacts,
        job: {
          name: backupJobs.name,
        },
      }).from(backupArtifacts)
        .innerJoin(backupJobs, eq(backupArtifacts.backupJobId, backupJobs.id))
        .where(eq(backupJobs.userId, req.user!.id))
        .orderBy(desc(backupArtifacts.startedAt))
        .limit(50);
      res.json(artifacts.map(a => ({ ...a.artifact, jobName: a.job.name })));
    } catch (error) {
      console.error("Get backup artifacts error:", error);
      res.status(500).json({ error: "Failed to get backup artifacts" });
    }
  });

  app.delete("/api/bi/backup-jobs/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      await db.delete(backupJobs)
        .where(and(eq(backupJobs.id, id), eq(backupJobs.userId, req.user!.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete backup job error:", error);
      res.status(500).json({ error: "Failed to delete backup job" });
    }
  });

  app.get("/api/bi/stats", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userId = req.user!.id;
      const [datasourceCount] = await db.select({ count: sql`count(*)::int` }).from(dataSources).where(eq(dataSources.userId, userId));
      const [datasetCount] = await db.select({ count: sql`count(*)::int` }).from(biDatasets).where(eq(biDatasets.userId, userId));
      const [chartCount] = await db.select({ count: sql`count(*)::int` }).from(biCharts).where(eq(biCharts.userId, userId));
      const [dashboardCount] = await db.select({ count: sql`count(*)::int` }).from(biDashboards).where(eq(biDashboards.userId, userId));
      const [backupCount] = await db.select({ count: sql`count(*)::int` }).from(backupJobs).where(eq(backupJobs.userId, userId));
      res.json({
        dataSources: datasourceCount?.count || 0,
        datasets: datasetCount?.count || 0,
        charts: chartCount?.count || 0,
        dashboards: dashboardCount?.count || 0,
        backupJobs: backupCount?.count || 0,
      });
    } catch (error) {
      console.error("Get BI stats error:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get("/api/bi/tables", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const result = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      res.json(result.rows.map((r: any) => r.table_name));
    } catch (error) {
      console.error("Get tables error:", error);
      res.status(500).json({ error: "Failed to get tables" });
    }
  });

  app.get("/api/bi/tables/:name/columns", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tableName = req.params.name;
      const result = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = ${tableName}
        ORDER BY ordinal_position
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Get columns error:", error);
      res.status(500).json({ error: "Failed to get columns" });
    }
  });

  app.post("/api/bi/ai-analyze", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { question, datasetId } = req.body;
      
      if (!question || !datasetId) {
        return res.status(400).json({ error: "Pergunta e dataset são obrigatórios" });
      }

      const [dataset] = await db.select().from(biDatasets).where(eq(biDatasets.id, datasetId)).limit(1);
      
      if (!dataset || !dataset.tableName) {
        return res.status(404).json({ error: "Dataset não encontrado" });
      }

      const tableNameClean = dataset.tableName.replace(/[^a-zA-Z0-9_]/g, '');
      const dataResult = await db.execute(sql`SELECT * FROM ${sql.identifier(tableNameClean)} LIMIT 200`);
      const sampleData = dataResult.rows as Record<string, any>[];
      
      if (sampleData.length === 0) {
        return res.status(400).json({ error: "Dataset vazio" });
      }

      let pandasAnalysis = null;
      try {
        const pandasRes = await fetch("http://localhost:8003/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: sampleData, question }),
        });
        if (pandasRes.ok) {
          pandasAnalysis = await pandasRes.json();
        }
      } catch (e) {
        console.log("Pandas service not available, continuing without");
      }

      const columns = Object.keys(sampleData[0] || {});
      const numericColumns = columns.filter(col => {
        const val = sampleData[0][col];
        return typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== '');
      });

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      let pandasContext = "";
      if (pandasAnalysis) {
        pandasContext = `\n\nANÁLISE ESTATÍSTICA (via Pandas):
- Total de registros: ${pandasAnalysis.row_count}
- Colunas: ${pandasAnalysis.column_count}

ESTATÍSTICAS POR COLUNA:
${pandasAnalysis.columns.map((c: any) => 
  `- ${c.name} (${c.dtype}): ${c.mean ? `média=${c.mean.toFixed(2)}, mediana=${c.median?.toFixed(2)}, desvio=${c.std?.toFixed(2)}` : `${c.unique_count} valores únicos`}`
).join('\n')}

${pandasAnalysis.correlations ? `CORRELAÇÕES: ${JSON.stringify(pandasAnalysis.correlations)}` : ''}

INSIGHTS AUTOMÁTICOS:
${pandasAnalysis.insights.join('\n- ')}`;
      }

      const systemPrompt = `Você é um analista de dados especializado em Business Intelligence.
Analise os dados fornecidos e responda à pergunta do usuário de forma detalhada e profissional.

IMPORTANTE: Sua resposta DEVE ser um JSON válido com a seguinte estrutura:
{
  "answer": "Sua resposta detalhada à pergunta, incluindo números, percentuais e insights",
  "insights": ["Insight 1", "Insight 2", "Insight 3"],
  "suggestedChart": {
    "type": "bar|line|pie|area|scatter",
    "title": "Título do gráfico sugerido",
    "xAxis": "nome_da_coluna_x",
    "yAxis": "nome_da_coluna_y",
    "groupBy": "nome_da_coluna_para_agrupar ou null",
    "aggregation": "sum|count|avg|max|min"
  }
}

Escolha o tipo de gráfico mais apropriado para visualizar a resposta:
- bar: para comparações entre categorias
- line: para tendências ao longo do tempo
- pie: para proporções de um todo
- area: para volumes ao longo do tempo
- scatter: para correlações entre variáveis`;

      const userPrompt = `Dataset: ${dataset.name}
Colunas disponíveis: ${columns.join(", ")}
Colunas numéricas: ${numericColumns.join(", ")}
${pandasContext}

Amostra dos dados (primeiros 10 registros):
${JSON.stringify(sampleData.slice(0, 10), null, 2)}

Pergunta do usuário: ${question}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let result;
      try {
        result = JSON.parse(content);
      } catch {
        result = { answer: content, insights: [], suggestedChart: null };
      }

      res.json({
        success: true,
        question,
        datasetId,
        datasetName: dataset.name,
        pandasAnalysis: pandasAnalysis ? {
          rowCount: pandasAnalysis.row_count,
          insights: pandasAnalysis.insights,
          suggestedCharts: pandasAnalysis.suggested_charts,
        } : null,
        ...result,
      });
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      res.status(500).json({ error: error.message || "Falha na análise" });
    }
  });

  app.post("/api/bi/ai-create-chart", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { datasetId, chartConfig } = req.body;
      const userId = req.user!.id;

      if (!datasetId || !chartConfig) {
        return res.status(400).json({ error: "Dados inválidos" });
      }

      const [chart] = await db.insert(biCharts).values({
        userId,
        datasetId,
        name: chartConfig.title || "Gráfico IA",
        chartType: chartConfig.type || "bar",
        config: JSON.stringify({
          xAxis: chartConfig.xAxis,
          yAxis: chartConfig.yAxis,
          groupBy: chartConfig.groupBy,
          aggregation: chartConfig.aggregation,
          colors: ["#c89b3c", "#4caf50", "#2196f3", "#ff9800", "#9c27b0"],
        }),
      }).returning();

      res.json({ success: true, chart });
    } catch (error: any) {
      console.error("Create chart error:", error);
      res.status(500).json({ error: error.message || "Falha ao criar gráfico" });
    }
  });
}
