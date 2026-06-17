import { db } from "../../db/index";
import { sql } from "drizzle-orm";

const METASET_HOST = process.env.METABASE_HOST || "localhost";
const METASET_PORT = parseInt(process.env.METABASE_PORT || "8088", 10);
const METASET_URL = `http://${METASET_HOST}:${METASET_PORT}`;
const METASET_TIMEOUT = 30000;

const ADMIN_EMAIL = process.env.METASET_ADMIN_EMAIL || "admin@arcadia.app";
const ADMIN_PASSWORD = process.env.METASET_ADMIN_PASSWORD || "Arcadia2026!BI";

let sessionToken: string | null = null;
let sessionExpiry: number = 0;
let arcadiaDbId: number | null = null;

async function metasetFetch(path: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), METASET_TIMEOUT);

  try {
    const token = await getSession();
    const response = await fetch(`${METASET_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Metabase-Session": token,
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeout);

    if (response.status === 401) {
      sessionToken = null;
      sessionExpiry = 0;
      const newToken = await getSession();
      const retry = await fetch(`${METASET_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-Metabase-Session": newToken,
          ...(options.headers || {}),
        },
      });
      if (!retry.ok) {
        const err = await retry.text().catch(() => "Unknown error");
        throw new Error(`MetaSet API error ${retry.status}: ${err}`);
      }
      return await retry.json().catch(() => ({}));
    }

    if (!response.ok) {
      const err = await response.text().catch(() => "Unknown error");
      throw new Error(`MetaSet API error ${response.status}: ${err}`);
    }

    return await response.json().catch(() => ({}));
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("MetaSet timeout - motor BI indisponível");
    }
    throw err;
  }
}

async function getSession(): Promise<string> {
  if (sessionToken && Date.now() < sessionExpiry) {
    return sessionToken;
  }

  const response = await fetch(`${METASET_URL}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!response.ok) {
    throw new Error("Falha ao autenticar no motor BI");
  }

  const data = await response.json();
  sessionToken = data.id;
  sessionExpiry = Date.now() + 12 * 60 * 60 * 1000;
  return sessionToken!;
}

async function ensureDbId(): Promise<number> {
  if (arcadiaDbId) return arcadiaDbId;

  const databases = await metasetFetch("/api/database");
  const dbs = databases.data || databases;
  const arcadiaDb = (Array.isArray(dbs) ? dbs : []).find(
    (d: any) => d.engine === "postgres" && d.name !== "Sample Database"
  );

  if (arcadiaDb) {
    arcadiaDbId = arcadiaDb.id;
    return arcadiaDbId!;
  }

  const created = await metasetFetch("/api/database", {
    method: "POST",
    body: JSON.stringify({
      engine: "postgres",
      name: "Arcádia Suite",
      details: {
        host: process.env.PGHOST,
        port: parseInt(process.env.PGPORT || "5432"),
        dbname: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        ssl: false,
      },
      is_full_sync: true,
      auto_run_queries: true,
    }),
  });

  arcadiaDbId = created.id;
  return arcadiaDbId!;
}

export const metasetClient = {
  async isHealthy(): Promise<{ online: boolean; version?: string }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${METASET_URL}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { online: true, version: data.version || "unknown" };
      }
      return { online: false };
    } catch {
      return { online: false };
    }
  },

  async getTables(): Promise<Array<{ id: number; name: string; schema: string; dbId: number; entityType: string }>> {
    const dbId = await ensureDbId();
    const data = await metasetFetch(`/api/database/${dbId}/metadata?include_hidden=false`);
    const tables = (data.tables || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      schema: t.schema || "public",
      dbId: t.db_id || dbId,
      entityType: t.entity_type || "entity",
      fields: (t.fields || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.database_type || f.base_type,
        semanticType: f.semantic_type,
      })),
    }));
    return tables;
  },

  async getTableFields(tableId: number): Promise<any[]> {
    const data = await metasetFetch(`/api/table/${tableId}/query_metadata`);
    return (data.fields || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      displayName: f.display_name,
      type: f.database_type || f.base_type,
      semanticType: f.semantic_type,
      tableId: f.table_id,
    }));
  },

  async runNativeQuery(queryStr: string, limit?: number): Promise<{ columns: string[]; rows: any[][]; rowCount: number }> {
    const dbId = await ensureDbId();
    const safeQueries = ["SELECT", "WITH", "EXPLAIN"];
    const upper = queryStr.trim().toUpperCase();
    if (!safeQueries.some(sq => upper.startsWith(sq))) {
      throw new Error("Apenas consultas SELECT são permitidas");
    }

    const dangerous = [/;\s*(?:DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|CREATE)/i, /--/, /\/\*/];
    if (dangerous.some(p => p.test(queryStr))) {
      throw new Error("Consulta contém padrões proibidos");
    }

    const finalQuery = limit ? `${queryStr.replace(/;\s*$/, "")} LIMIT ${limit}` : queryStr;

    const data = await metasetFetch("/api/dataset", {
      method: "POST",
      body: JSON.stringify({
        database: dbId,
        type: "native",
        native: { query: finalQuery },
      }),
    });

    const cols = (data.data?.cols || []).map((c: any) => c.name);
    const rows = data.data?.rows || [];
    return { columns: cols, rows, rowCount: data.data?.rows_truncated ? rows.length : (data.row_count || rows.length) };
  },

  async createQuestion(params: {
    name: string;
    description?: string;
    queryType: "native" | "structured";
    query: string;
    chartType?: string;
  }): Promise<{ id: number; name: string }> {
    const dbId = await ensureDbId();
    const display = params.chartType || "table";

    let datasetQuery: any;
    if (params.queryType === "native") {
      datasetQuery = {
        database: dbId,
        type: "native",
        native: { query: params.query },
      };
    } else {
      datasetQuery = {
        database: dbId,
        type: "native",
        native: { query: params.query },
      };
    }

    const card = await metasetFetch("/api/card", {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        description: params.description || "",
        display,
        dataset_query: datasetQuery,
        visualization_settings: {},
      }),
    });

    return { id: card.id, name: card.name };
  },

  async listQuestions(): Promise<Array<{ id: number; name: string; display: string; description?: string; createdAt: string }>> {
    const cards = await metasetFetch("/api/card");
    return (Array.isArray(cards) ? cards : []).map((c: any) => ({
      id: c.id,
      name: c.name,
      display: c.display,
      description: c.description,
      createdAt: c.created_at,
    }));
  },

  async runQuestion(questionId: number): Promise<{ columns: string[]; rows: any[][]; rowCount: number }> {
    const data = await metasetFetch(`/api/card/${questionId}/query`, { method: "POST" });
    const cols = (data.data?.cols || []).map((c: any) => c.name);
    const rows = data.data?.rows || [];
    return { columns: cols, rows, rowCount: rows.length };
  },

  async deleteQuestion(questionId: number): Promise<void> {
    await metasetFetch(`/api/card/${questionId}`, { method: "DELETE" });
  },

  async createDashboard(params: {
    name: string;
    description?: string;
  }): Promise<{ id: number; name: string }> {
    const dashboard = await metasetFetch("/api/dashboard", {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        description: params.description || "",
      }),
    });
    return { id: dashboard.id, name: dashboard.name };
  },

  async listDashboards(): Promise<Array<{ id: number; name: string; description?: string; createdAt: string }>> {
    const dashboards = await metasetFetch("/api/dashboard");
    return (Array.isArray(dashboards) ? dashboards : []).map((d: any) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      createdAt: d.created_at,
    }));
  },

  async addQuestionToDashboard(dashboardId: number, questionId: number, position?: { x: number; y: number; w: number; h: number }): Promise<void> {
    const pos = position || { x: 0, y: 0, w: 6, h: 4 };
    await metasetFetch(`/api/dashboard/${dashboardId}`, {
      method: "PUT",
      body: JSON.stringify({
        dashcards: [{
          card_id: questionId,
          row: pos.y,
          col: pos.x,
          size_x: pos.w,
          size_y: pos.h,
        }],
      }),
    });
  },

  async getDashboard(dashboardId: number): Promise<any> {
    return await metasetFetch(`/api/dashboard/${dashboardId}`);
  },

  async deleteDashboard(dashboardId: number): Promise<void> {
    await metasetFetch(`/api/dashboard/${dashboardId}`, { method: "DELETE" });
  },

  async syncDatabase(): Promise<void> {
    const dbId = await ensureDbId();
    await metasetFetch(`/api/database/${dbId}/sync_schema`, { method: "POST" });
  },

  async getAutoSuggestions(tableName: string): Promise<{ suggestedCharts: string[]; suggestedQueries: string[] }> {
    try {
      const result = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = ${tableName} AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      const columns = result.rows as Array<{ column_name: string; data_type: string }>;

      const numericCols = columns.filter(c =>
        ["integer", "bigint", "numeric", "real", "double precision"].includes(c.data_type)
      );
      const dateCols = columns.filter(c =>
        ["timestamp", "timestamp without time zone", "timestamp with time zone", "date"].includes(c.data_type)
      );
      const textCols = columns.filter(c =>
        ["text", "character varying", "varchar"].includes(c.data_type)
      );

      const suggestedCharts: string[] = [];
      const suggestedQueries: string[] = [];

      if (numericCols.length > 0 && dateCols.length > 0) {
        suggestedCharts.push("line", "area");
        suggestedQueries.push(
          `SELECT ${dateCols[0].column_name}::date, SUM(${numericCols[0].column_name}) FROM ${tableName} GROUP BY 1 ORDER BY 1`
        );
      }

      if (numericCols.length > 0 && textCols.length > 0) {
        suggestedCharts.push("bar", "pie");
        suggestedQueries.push(
          `SELECT ${textCols[0].column_name}, SUM(${numericCols[0].column_name}) as total FROM ${tableName} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`
        );
      }

      if (numericCols.length >= 2) {
        suggestedCharts.push("scatter");
        suggestedQueries.push(
          `SELECT ${numericCols[0].column_name}, ${numericCols[1].column_name} FROM ${tableName} LIMIT 500`
        );
      }

      suggestedQueries.push(`SELECT COUNT(*) as total FROM ${tableName}`);
      suggestedQueries.push(`SELECT * FROM ${tableName} LIMIT 100`);

      return { suggestedCharts, suggestedQueries };
    } catch {
      return { suggestedCharts: ["table"], suggestedQueries: [`SELECT * FROM ${tableName} LIMIT 100`] };
    }
  },

  getUrl(): string {
    return METASET_URL;
  },

  getPort(): number {
    return METASET_PORT;
  },
};
