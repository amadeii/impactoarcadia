import express from "express";
import cors from "cors";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const app = express();
const PORT = 8006;

app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comm_channels (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      type VARCHAR(30) NOT NULL,
      name VARCHAR(200) NOT NULL,
      identifier VARCHAR(200),
      status VARCHAR(30) DEFAULT 'disconnected',
      config JSONB,
      greeting_message TEXT,
      out_of_hours_message TEXT,
      schedules JSONB,
      source_ref VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      last_connected_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comm_contacts (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      type VARCHAR(30) DEFAULT 'lead',
      name VARCHAR(200) NOT NULL,
      email VARCHAR(200),
      phone VARCHAR(50),
      whatsapp VARCHAR(50),
      avatar_url TEXT,
      company VARCHAR(200),
      trade_name VARCHAR(200),
      cnpj VARCHAR(20),
      position VARCHAR(100),
      website VARCHAR(300),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(50),
      country VARCHAR(50) DEFAULT 'Brasil',
      segment VARCHAR(100),
      tags TEXT[],
      custom_fields JSONB,
      lead_score INTEGER DEFAULT 0,
      lead_status VARCHAR(30) DEFAULT 'new',
      source VARCHAR(50),
      source_details TEXT,
      assigned_to VARCHAR,
      primary_contact_name VARCHAR(200),
      primary_contact_email VARCHAR(200),
      primary_contact_phone VARCHAR(50),
      notes TEXT,
      last_contact_at TIMESTAMP,
      converted_at TIMESTAMP,
      xos_contact_id INTEGER,
      crm_client_id INTEGER,
      crm_lead_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comm_threads (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      contact_id INTEGER REFERENCES comm_contacts(id),
      channel_id INTEGER REFERENCES comm_channels(id),
      channel VARCHAR(30) NOT NULL,
      external_id VARCHAR(200),
      status VARCHAR(20) DEFAULT 'open',
      priority VARCHAR(20) DEFAULT 'normal',
      subject VARCHAR(300),
      assigned_to VARCHAR,
      queue_id INTEGER,
      tags TEXT[],
      metadata JSONB,
      messages_count INTEGER DEFAULT 0,
      unread_count INTEGER DEFAULT 0,
      first_response_at TIMESTAMP,
      last_message_at TIMESTAMP,
      resolved_at TIMESTAMP,
      satisfaction_score INTEGER,
      satisfaction_comment TEXT,
      xos_conversation_id INTEGER,
      crm_thread_id INTEGER,
      whatsapp_ticket_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comm_messages (
      id SERIAL PRIMARY KEY,
      thread_id INTEGER REFERENCES comm_threads(id) ON DELETE CASCADE NOT NULL,
      channel_id INTEGER REFERENCES comm_channels(id),
      direction VARCHAR(10) NOT NULL,
      sender_type VARCHAR(20) NOT NULL,
      sender_id VARCHAR,
      sender_name VARCHAR(200),
      content TEXT,
      content_type VARCHAR(30) DEFAULT 'text',
      media_url TEXT,
      media_type VARCHAR(30),
      attachments JSONB,
      metadata JSONB,
      external_id VARCHAR(200),
      status VARCHAR(20) DEFAULT 'sent',
      is_from_agent BOOLEAN DEFAULT false,
      read_at TIMESTAMP,
      delivered_at TIMESTAMP,
      xos_message_id INTEGER,
      crm_message_id INTEGER,
      whatsapp_message_id INTEGER,
      email_message_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comm_queues (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      name VARCHAR(100) NOT NULL,
      color VARCHAR(20) DEFAULT 'blue',
      greeting_message TEXT,
      out_of_hours_message TEXT,
      schedules JSONB,
      auto_assign BOOLEAN DEFAULT false,
      assignment_method VARCHAR(20) DEFAULT 'round_robin',
      order_priority INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      xos_queue_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comm_queue_members (
      id SERIAL PRIMARY KEY,
      queue_id INTEGER REFERENCES comm_queues(id) ON DELETE CASCADE NOT NULL,
      user_id VARCHAR NOT NULL,
      role VARCHAR(20) DEFAULT 'agent',
      is_available BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comm_quick_messages (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      shortcode VARCHAR(50) NOT NULL,
      title VARCHAR(200),
      content TEXT NOT NULL,
      media_url TEXT,
      media_type VARCHAR(30),
      category VARCHAR(50),
      scope VARCHAR(20) DEFAULT 'company',
      user_id VARCHAR,
      variables TEXT[],
      usage_count INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comm_events (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      type VARCHAR(50) NOT NULL,
      entity_type VARCHAR(30) NOT NULL,
      entity_id INTEGER NOT NULL,
      data JSONB,
      processed_by_kg BOOLEAN DEFAULT false,
      processed_by_agents BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_comm_threads_status ON comm_threads(status);
    CREATE INDEX IF NOT EXISTS idx_comm_threads_channel ON comm_threads(channel);
    CREATE INDEX IF NOT EXISTS idx_comm_threads_contact ON comm_threads(contact_id);
    CREATE INDEX IF NOT EXISTS idx_comm_threads_assigned ON comm_threads(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_comm_messages_thread ON comm_messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_comm_messages_created ON comm_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_comm_contacts_type ON comm_contacts(type);
    CREATE INDEX IF NOT EXISTS idx_comm_contacts_email ON comm_contacts(email);
    CREATE INDEX IF NOT EXISTS idx_comm_contacts_whatsapp ON comm_contacts(whatsapp);
    CREATE INDEX IF NOT EXISTS idx_comm_events_type ON comm_events(type);
    CREATE INDEX IF NOT EXISTS idx_comm_events_processed ON comm_events(processed_by_kg);
  `);
  console.log("[Communication Engine] Tables and indexes ensured");
}

// ==================== HEALTH ====================

app.get("/health", async (_req, res) => {
  try {
    const dbResult = await pool.query("SELECT 1");
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM comm_contacts) as contacts,
        (SELECT COUNT(*) FROM comm_threads) as threads,
        (SELECT COUNT(*) FROM comm_messages) as messages,
        (SELECT COUNT(*) FROM comm_channels) as channels,
        (SELECT COUNT(*) FROM comm_events WHERE processed_by_kg = false) as pending_events
    `);
    const stats = counts.rows[0];
    res.json({
      status: "ok",
      service: "communication-engine",
      version: "1.0.0",
      database: dbResult.rows.length > 0 ? "connected" : "error",
      stats,
      uptime: process.uptime(),
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", error: error.message });
  }
});

// ==================== UNIFIED CONTACTS ====================

app.get("/v1/contacts", async (req, res) => {
  try {
    const { type, search, limit = "50", offset = "0" } = req.query;

    const xosContacts = await query(`
      SELECT id, name, email, phone, whatsapp, company, type, lead_status, lead_score,
             source, assigned_to, tags, avatar_url, position, city, state, notes,
             last_contact_at, created_at, updated_at,
             'xos' as origin, id as xos_contact_id, NULL::int as crm_client_id, NULL::int as crm_lead_id
      FROM xos_contacts
      WHERE ($1::text IS NULL OR type = $1)
        AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%' OR company ILIKE '%' || $2 || '%')
      ORDER BY updated_at DESC
    `, [type || null, search || null]);

    const crmClients = await query(`
      SELECT id, name, email, phone, NULL as whatsapp, NULL as company, 'customer' as type,
             status as lead_status, 0 as lead_score, source, NULL as assigned_to,
             NULL as tags, NULL as avatar_url, NULL as position, city, state, notes,
             NULL as last_contact_at, created_at, updated_at,
             'crm_client' as origin, NULL::int as xos_contact_id, id as crm_client_id, NULL::int as crm_lead_id
      FROM crm_clients
      WHERE ($1::text IS NULL OR $1 = 'customer')
        AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%')
      ORDER BY updated_at DESC
    `, [type || null, search || null]);

    const crmLeads = await query(`
      SELECT id, name, email, phone, NULL as whatsapp, company, 'lead' as type,
             status as lead_status, 0 as lead_score, source, assigned_to,
             tags, NULL as avatar_url, position, NULL as city, NULL as state, notes,
             NULL as last_contact_at, created_at, updated_at,
             'crm_lead' as origin, NULL::int as xos_contact_id, NULL::int as crm_client_id, id as crm_lead_id
      FROM crm_leads
      WHERE ($1::text IS NULL OR $1 = 'lead')
        AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%' OR company ILIKE '%' || $2 || '%')
      ORDER BY updated_at DESC
    `, [type || null, search || null]);

    const all = [...xosContacts, ...crmClients, ...crmLeads]
      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
      .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      data: all,
      total: xosContacts.length + crmClients.length + crmLeads.length,
      sources: {
        xos_contacts: xosContacts.length,
        crm_clients: crmClients.length,
        crm_leads: crmLeads.length,
      },
    });
  } catch (error: any) {
    console.error("[Contacts]", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/v1/contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { origin } = req.query;

    let contact;
    if (origin === "crm_client") {
      const rows = await query("SELECT *, 'crm_client' as origin FROM crm_clients WHERE id = $1", [id]);
      contact = rows[0];
    } else if (origin === "crm_lead") {
      const rows = await query("SELECT *, 'crm_lead' as origin FROM crm_leads WHERE id = $1", [id]);
      contact = rows[0];
    } else {
      const rows = await query("SELECT *, 'xos' as origin FROM xos_contacts WHERE id = $1", [id]);
      contact = rows[0];
    }

    if (!contact) return res.status(404).json({ error: "Contact not found" });

    const threads = await query(`
      SELECT * FROM xos_conversations WHERE contact_id = $1
      UNION ALL
      SELECT ct.* FROM crm_threads ct
      WHERE ct.contact_phone = $2 OR ct.contact_email = $3
      ORDER BY updated_at DESC LIMIT 10
    `, [contact.id, contact.phone, contact.email]).catch(() => []);

    res.json({ contact, threads, origin: contact.origin });
  } catch (error: any) {
    console.error("[Contact Detail]", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== UNIFIED THREADS (CONVERSATIONS) ====================

app.get("/v1/threads", async (req, res) => {
  try {
    const { status, channel, limit = "50", offset = "0" } = req.query;

    const xosConvs = await query(`
      SELECT cv.id, cv.channel, cv.status, cv.priority, cv.subject,
             cv.assigned_to, cv.messages_count, cv.created_at, cv.updated_at,
             c.name as contact_name, c.email as contact_email, c.whatsapp as contact_whatsapp, c.avatar_url as contact_avatar,
             (SELECT content FROM xos_messages WHERE conversation_id = cv.id ORDER BY created_at DESC LIMIT 1) as last_message,
             'xos' as origin, cv.id as xos_conversation_id, NULL::int as crm_thread_id, NULL::int as whatsapp_ticket_id
      FROM xos_conversations cv
      LEFT JOIN xos_contacts c ON cv.contact_id = c.id
      WHERE ($1::text IS NULL OR cv.status = $1)
        AND ($2::text IS NULL OR cv.channel = $2)
      ORDER BY cv.updated_at DESC
    `, [status || null, channel || null]);

    const crmThreads = await query(`
      SELECT t.id, 
             CASE WHEN ch.type IS NOT NULL THEN ch.type ELSE 'chat' END as channel,
             t.status, t.priority, NULL as subject,
             t.assigned_to_id as assigned_to, t.unread_count as messages_count,
             t.created_at, t.updated_at,
             t.contact_name, t.contact_email, NULL as contact_whatsapp, NULL as contact_avatar,
             (SELECT content FROM crm_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message,
             'crm' as origin, NULL::int as xos_conversation_id, t.id as crm_thread_id, NULL::int as whatsapp_ticket_id
      FROM crm_threads t
      LEFT JOIN crm_channels ch ON t.channel_id = ch.id
      WHERE ($1::text IS NULL OR t.status = $1)
        AND ($2::text IS NULL OR ch.type = $2)
      ORDER BY t.updated_at DESC
    `, [status || null, channel || null]);

    const whatsappTickets = await query(`
      SELECT t.id, 'whatsapp' as channel,
             t.status, 'normal' as priority, NULL as subject,
             NULL as assigned_to, t.unread_count as messages_count,
             t.created_at, t.updated_at,
             COALESCE(c.name, c.push_name, c.phone_number) as contact_name,
             NULL as contact_email, c.phone_number as contact_whatsapp, NULL as contact_avatar,
             (SELECT body FROM whatsapp_messages WHERE ticket_id = t.id ORDER BY timestamp DESC LIMIT 1) as last_message,
             'whatsapp' as origin, NULL::int as xos_conversation_id, NULL::int as crm_thread_id, t.id as whatsapp_ticket_id
      FROM whatsapp_tickets t
      LEFT JOIN whatsapp_contacts c ON t.contact_id = c.id
      WHERE ($1::text IS NULL OR t.status = $1)
        AND ($2::text IS NULL OR $2 = 'whatsapp')
      ORDER BY t.updated_at DESC
    `, [status || null, channel || null]);

    const all = [...xosConvs, ...crmThreads, ...whatsappTickets]
      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
      .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      data: all,
      total: xosConvs.length + crmThreads.length + whatsappTickets.length,
      sources: {
        xos_conversations: xosConvs.length,
        crm_threads: crmThreads.length,
        whatsapp_tickets: whatsappTickets.length,
      },
    });
  } catch (error: any) {
    console.error("[Threads]", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/v1/threads/:origin/:id/messages", async (req, res) => {
  try {
    const { origin, id } = req.params;
    let messages: any[] = [];

    if (origin === "xos") {
      messages = await query(`
        SELECT id, direction, sender_type, sender_name, content, content_type,
               attachments, external_id, read_at, delivered_at, created_at,
               'xos' as origin
        FROM xos_messages WHERE conversation_id = $1 ORDER BY created_at ASC
      `, [id]);
    } else if (origin === "crm") {
      messages = await query(`
        SELECT id, direction, 
               CASE WHEN is_from_agent = 'true' THEN 'bot' ELSE CASE WHEN direction = 'outbound' THEN 'user' ELSE 'contact' END END as sender_type,
               NULL as sender_name, content, type as content_type,
               NULL as attachments, external_id, NULL as read_at, NULL as delivered_at, created_at,
               'crm' as origin
        FROM crm_messages WHERE thread_id = $1 ORDER BY created_at ASC
      `, [id]);
    } else if (origin === "whatsapp") {
      messages = await query(`
        SELECT id, CASE WHEN from_me = 1 THEN 'outbound' ELSE 'inbound' END as direction,
               CASE WHEN from_me = 1 THEN 'user' ELSE 'contact' END as sender_type,
               NULL as sender_name, body as content, message_type as content_type,
               NULL as attachments, message_id as external_id, NULL as read_at, NULL as delivered_at, timestamp as created_at,
               'whatsapp' as origin
        FROM whatsapp_messages WHERE ticket_id = $1 ORDER BY timestamp ASC
      `, [id]);
    }

    res.json({ data: messages, origin, threadId: id });
  } catch (error: any) {
    console.error("[Messages]", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== UNIFIED CHANNELS ====================

app.get("/v1/channels", async (_req, res) => {
  try {
    const crmCh = await query(`
      SELECT id, type, name, identifier, status, last_connected_at, created_at,
             'crm_channels' as origin
      FROM crm_channels ORDER BY created_at DESC
    `);

    const whatsappSessions = await query(`
      SELECT id, 'whatsapp' as type, session_name as name, phone_number as identifier,
             status, connected_at as last_connected_at, created_at,
             'whatsapp_sessions' as origin
      FROM whatsapp_sessions ORDER BY created_at DESC
    `).catch(() => []);

    const emailAccounts = await query(`
      SELECT id, 'email' as type, COALESCE(display_name, email) as name, email as identifier,
             status, NULL as last_connected_at, created_at,
             'email_accounts' as origin
      FROM email_accounts ORDER BY created_at DESC
    `).catch(() => []);

    res.json({
      data: [...crmCh, ...whatsappSessions, ...emailAccounts],
      sources: {
        crm_channels: crmCh.length,
        whatsapp_sessions: whatsappSessions.length,
        email_accounts: emailAccounts.length,
      },
    });
  } catch (error: any) {
    console.error("[Channels]", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== UNIFIED QUEUES ====================

app.get("/v1/queues", async (_req, res) => {
  try {
    const xosQueues = await query(`
      SELECT q.*, 
        (SELECT COUNT(*) FROM xos_conversations WHERE status = 'open') as open_threads,
        'xos' as origin
      FROM xos_queues q WHERE q.is_active = true ORDER BY q.order_priority
    `);
    res.json({ data: xosQueues });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== UNIFIED QUICK MESSAGES ====================

app.get("/v1/quick-messages", async (_req, res) => {
  try {
    const xosQm = await query(`
      SELECT id, shortcode, title, content, media_url, media_type, scope, usage_count, created_at,
             'xos' as origin
      FROM xos_quick_messages ORDER BY usage_count DESC
    `);

    const crmQm = await query(`
      SELECT id, shortcut as shortcode, title, content, media_url, NULL as media_type,
             CASE WHEN is_global = 'true' THEN 'company' ELSE 'personal' END as scope,
             0 as usage_count, created_at,
             'crm' as origin
      FROM crm_quick_messages ORDER BY created_at DESC
    `);

    res.json({ data: [...xosQm, ...crmQm] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STATS (for agents/dashboard) ====================

app.get("/v1/stats", async (_req, res) => {
  try {
    const stats = await query(`
      SELECT
        (SELECT COUNT(*) FROM xos_contacts) + (SELECT COUNT(*) FROM crm_clients) + (SELECT COUNT(*) FROM crm_leads) as total_contacts,
        (SELECT COUNT(*) FROM xos_contacts WHERE type = 'lead') + (SELECT COUNT(*) FROM crm_leads) as total_leads,
        (SELECT COUNT(*) FROM xos_contacts WHERE type = 'customer') + (SELECT COUNT(*) FROM crm_clients) as total_customers,
        (SELECT COUNT(*) FROM xos_conversations WHERE status = 'open') as open_conversations_xos,
        (SELECT COUNT(*) FROM crm_threads WHERE status = 'open') as open_threads_crm,
        (SELECT COUNT(*) FROM whatsapp_tickets WHERE status = 'open') as open_whatsapp,
        (SELECT COUNT(*) FROM xos_tickets WHERE status IN ('open', 'pending', 'in_progress')) as open_tickets,
        (SELECT COUNT(*) FROM xos_messages) + (SELECT COUNT(*) FROM crm_messages) + (SELECT COUNT(*) FROM whatsapp_messages) as total_messages,
        (SELECT COUNT(*) FROM comm_events WHERE processed_by_kg = false) as pending_kg_events
    `);

    const row = stats[0] || {};
    res.json({
      contacts: {
        total: parseInt(row.total_contacts || "0"),
        leads: parseInt(row.total_leads || "0"),
        customers: parseInt(row.total_customers || "0"),
      },
      threads: {
        open: parseInt(row.open_conversations_xos || "0") + parseInt(row.open_threads_crm || "0") + parseInt(row.open_whatsapp || "0"),
        bySource: {
          xos: parseInt(row.open_conversations_xos || "0"),
          crm: parseInt(row.open_threads_crm || "0"),
          whatsapp: parseInt(row.open_whatsapp || "0"),
        },
      },
      tickets: { open: parseInt(row.open_tickets || "0") },
      messages: { total: parseInt(row.total_messages || "0") },
      intelligence: { pendingEvents: parseInt(row.pending_kg_events || "0") },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== EVENTS (for Knowledge Graph / Agents) ====================

app.get("/v1/events/pending", async (req, res) => {
  try {
    const { limit = "100" } = req.query;
    const events = await query(`
      SELECT * FROM comm_events 
      WHERE processed_by_kg = false 
      ORDER BY created_at ASC 
      LIMIT $1
    `, [parseInt(limit as string)]);
    res.json({ data: events, count: events.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/v1/events/:id/ack", async (req, res) => {
  try {
    const { id } = req.params;
    const { processor } = req.body; // "kg" or "agents"
    const field = processor === "agents" ? "processed_by_agents" : "processed_by_kg";
    await query(`UPDATE comm_events SET ${field} = true WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/v1/events", async (req, res) => {
  try {
    const { type, entityType, entityId, data, tenantId } = req.body;
    const result = await query(`
      INSERT INTO comm_events (tenant_id, type, entity_type, entity_id, data)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [tenantId || 1, type, entityType, entityId, JSON.stringify(data || {})]);
    res.status(201).json(result[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== AGENT CONTEXT ENDPOINT ====================

app.get("/v1/agent/context/:contactIdentifier", async (req, res) => {
  try {
    const { contactIdentifier } = req.params;

    const contacts = await query(`
      SELECT * FROM xos_contacts 
      WHERE phone = $1 OR whatsapp = $1 OR email = $1 OR name ILIKE '%' || $1 || '%'
      LIMIT 5
    `, [contactIdentifier]);

    const crmClients = await query(`
      SELECT * FROM crm_clients
      WHERE phone = $1 OR email = $1 OR name ILIKE '%' || $1 || '%'
      LIMIT 5
    `, [contactIdentifier]);

    const threads: any[] = [];
    for (const contact of contacts) {
      const convs = await query(`
        SELECT cv.*, 
          (SELECT content FROM xos_messages WHERE conversation_id = cv.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM xos_conversations cv WHERE cv.contact_id = $1 ORDER BY cv.updated_at DESC LIMIT 5
      `, [contact.id]);
      threads.push(...convs.map((c: any) => ({ ...c, origin: "xos" })));
    }

    const tickets = await query(`
      SELECT t.* FROM xos_tickets t
      JOIN xos_contacts c ON t.contact_id = c.id
      WHERE c.phone = $1 OR c.whatsapp = $1 OR c.email = $1
      ORDER BY t.created_at DESC LIMIT 5
    `, [contactIdentifier]).catch(() => []);

    const deals = await query(`
      SELECT d.*, s.name as stage_name FROM xos_deals d
      LEFT JOIN xos_pipeline_stages s ON d.stage_id = s.id
      JOIN xos_contacts c ON d.contact_id = c.id
      WHERE c.phone = $1 OR c.whatsapp = $1 OR c.email = $1
      ORDER BY d.updated_at DESC LIMIT 5
    `, [contactIdentifier]).catch(() => []);

    res.json({
      contacts: [...contacts.map((c: any) => ({ ...c, origin: "xos" })), ...crmClients.map((c: any) => ({ ...c, origin: "crm" }))],
      threads,
      tickets,
      deals,
      summary: {
        totalContacts: contacts.length + crmClients.length,
        openThreads: threads.filter((t: any) => t.status === "open").length,
        openTickets: tickets.filter((t: any) => ["open", "pending", "in_progress"].includes(t.status)).length,
        activeDeals: deals.filter((d: any) => d.status === "active" || d.status === "negotiation").length,
      },
    });
  } catch (error: any) {
    console.error("[Agent Context]", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== START ====================

async function start() {
  console.log("[Communication Engine] Iniciando na porta " + PORT + "...");
  await ensureTables();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Communication Engine] Rodando em http://0.0.0.0:${PORT}`);
    console.log("[Communication Engine] Endpoints:");
    console.log("  GET  /health");
    console.log("  GET  /v1/contacts");
    console.log("  GET  /v1/contacts/:id");
    console.log("  GET  /v1/threads");
    console.log("  GET  /v1/threads/:origin/:id/messages");
    console.log("  GET  /v1/channels");
    console.log("  GET  /v1/queues");
    console.log("  GET  /v1/quick-messages");
    console.log("  GET  /v1/stats");
    console.log("  GET  /v1/events/pending");
    console.log("  POST /v1/events");
    console.log("  POST /v1/events/:id/ack");
    console.log("  GET  /v1/agent/context/:contactIdentifier");
  });
}

start().catch(console.error);
