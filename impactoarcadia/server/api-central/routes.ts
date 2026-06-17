import { Router } from "express";
import { db } from "../../db";
import { sql } from "drizzle-orm";

const router = Router();

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Tabela de conexões de API (criar se não existir)
async function ensureApiConnectionsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_connections (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(50) NOT NULL,
        base_url TEXT NOT NULL,
        api_key TEXT,
        api_secret TEXT,
        headers JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'disconnected',
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_endpoints (
        id SERIAL PRIMARY KEY,
        connection_id INTEGER REFERENCES api_connections(id) ON DELETE CASCADE,
        name VARCHAR(200),
        method VARCHAR(10) NOT NULL,
        path TEXT NOT NULL,
        description TEXT,
        headers JSONB DEFAULT '{}',
        body_template TEXT,
        params JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_logs (
        id SERIAL PRIMARY KEY,
        connection_id INTEGER REFERENCES api_connections(id) ON DELETE CASCADE,
        endpoint_id INTEGER,
        method VARCHAR(10),
        url TEXT,
        request_headers JSONB,
        request_body TEXT,
        response_status INTEGER,
        response_body TEXT,
        latency_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.log("[API Central] Tables already exist or error:", e);
  }
}
ensureApiConnectionsTable();

// Listar conexões
router.get("/connections", requireAuth, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM api_connections ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Criar conexão
router.post("/connections", requireAuth, async (req, res) => {
  try {
    const { name, type, baseUrl, apiKey, apiSecret, headers } = req.body;
    if (!name || !baseUrl) {
      return res.status(400).json({ error: "Nome e URL são obrigatórios" });
    }
    
    const result = await db.execute(sql`
      INSERT INTO api_connections (name, type, base_url, api_key, api_secret, headers, status)
      VALUES (${name}, ${type || 'rest'}, ${baseUrl}, ${apiKey}, ${apiSecret}, ${JSON.stringify(headers || {})}, 'disconnected')
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar conexão
router.put("/connections/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, baseUrl, apiKey, apiSecret, headers, status } = req.body;
    
    const result = await db.execute(sql`
      UPDATE api_connections 
      SET name = COALESCE(${name}, name),
          type = COALESCE(${type}, type),
          base_url = COALESCE(${baseUrl}, base_url),
          api_key = COALESCE(${apiKey}, api_key),
          api_secret = COALESCE(${apiSecret}, api_secret),
          headers = COALESCE(${headers ? JSON.stringify(headers) : null}, headers),
          status = COALESCE(${status}, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar conexão
router.delete("/connections/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM api_connections WHERE id = ${parseInt(id)}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Listar endpoints de uma conexão
router.get("/connections/:id/endpoints", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT * FROM api_endpoints WHERE connection_id = ${parseInt(id)} ORDER BY created_at
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Criar endpoint
router.post("/connections/:id/endpoints", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, method, path, description, headers, bodyTemplate, params } = req.body;
    
    const result = await db.execute(sql`
      INSERT INTO api_endpoints (connection_id, name, method, path, description, headers, body_template, params)
      VALUES (${parseInt(id)}, ${name}, ${method}, ${path}, ${description}, ${JSON.stringify(headers || {})}, ${bodyTemplate}, ${JSON.stringify(params || [])})
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar endpoint
router.put("/endpoints/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, method, path, description, headers, bodyTemplate, params } = req.body;
    
    const result = await db.execute(sql`
      UPDATE api_endpoints 
      SET name = COALESCE(${name}, name),
          method = COALESCE(${method}, method),
          path = COALESCE(${path}, path),
          description = COALESCE(${description}, description),
          headers = COALESCE(${headers ? JSON.stringify(headers) : null}, headers),
          body_template = COALESCE(${bodyTemplate}, body_template),
          params = COALESCE(${params ? JSON.stringify(params) : null}, params)
      WHERE id = ${parseInt(id)}
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar endpoint
router.delete("/endpoints/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM api_endpoints WHERE id = ${parseInt(id)}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Executar chamada de API
router.post("/execute", requireAuth, async (req, res) => {
  try {
    const { connectionId, endpointId, method, url, headers, body } = req.body;
    
    const startTime = Date.now();
    
    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };
    
    if (body && method !== "GET") {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    
    const response = await fetch(url, fetchOptions);
    const latency = Date.now() - startTime;
    
    let responseBody: string;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      responseBody = JSON.stringify(await response.json(), null, 2);
    } else {
      responseBody = await response.text();
    }
    
    // Salvar log
    await db.execute(sql`
      INSERT INTO api_logs (connection_id, endpoint_id, method, url, request_headers, request_body, response_status, response_body, latency_ms)
      VALUES (${connectionId || null}, ${endpointId || null}, ${method}, ${url}, ${JSON.stringify(headers || {})}, ${typeof body === 'string' ? body : JSON.stringify(body)}, ${response.status}, ${responseBody}, ${latency})
    `);
    
    res.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
      latency,
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      body: `Erro ao executar requisição: ${error.message}`
    });
  }
});

// Listar logs
router.get("/logs", requireAuth, async (req, res) => {
  try {
    const { connectionId, limit = 50 } = req.query;
    
    let query;
    if (connectionId) {
      query = sql`
        SELECT * FROM api_logs 
        WHERE connection_id = ${parseInt(connectionId as string)}
        ORDER BY created_at DESC 
        LIMIT ${parseInt(limit as string)}
      `;
    } else {
      query = sql`
        SELECT * FROM api_logs 
        ORDER BY created_at DESC 
        LIMIT ${parseInt(limit as string)}
      `;
    }
    
    const result = await db.execute(query);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Testar conexão
router.post("/connections/:id/test", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connResult = await db.execute(sql`
      SELECT * FROM api_connections WHERE id = ${parseInt(id)}
    `);
    
    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: "Conexão não encontrada" });
    }
    
    const conn = connResult.rows[0] as any;
    
    const startTime = Date.now();
    const headers: Record<string, string> = conn.headers || {};
    
    if (conn.api_key) {
      headers["Authorization"] = `Bearer ${conn.api_key}`;
    }
    
    const response = await fetch(conn.base_url, {
      method: "GET",
      headers,
    });
    
    const latency = Date.now() - startTime;
    const status = response.ok ? "connected" : "error";
    
    await db.execute(sql`
      UPDATE api_connections 
      SET status = ${status}, last_sync_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
    `);
    
    res.json({
      success: response.ok,
      status,
      latency,
      httpStatus: response.status,
    });
  } catch (error: any) {
    await db.execute(sql`
      UPDATE api_connections 
      SET status = 'error'
      WHERE id = ${parseInt(req.params.id)}
    `);
    res.json({
      success: false,
      status: "error",
      error: error.message,
    });
  }
});

export default router;
