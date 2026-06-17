import { Router, type Request, type Response } from "express";
import { db } from "../../db/index";
import { sql } from "drizzle-orm";

const router = Router();

// ========== CONTACTS ==========

router.get("/contacts", async (req: Request, res: Response) => {
  try {
    const { type, status, search, limit = 50, offset = 0 } = req.query;

    // SOE-04: LEFT JOIN pessoas para trazer pessoa_soe_id e nome da pessoa canônica
    let query = sql`
      SELECT xc.*, xc.pessoa_id as pessoa_soe_id,
             p.nome_fantasia as pessoa_nome_soe
      FROM xos_contacts xc
      LEFT JOIN pessoas p ON p.id = xc.pessoa_id
      WHERE 1=1
    `;

    if (type) query = sql`${query} AND xc.type = ${type}`;
    if (status) query = sql`${query} AND xc.lead_status = ${status}`;
    if (search) query = sql`${query} AND (xc.name ILIKE ${'%' + search + '%'} OR xc.email ILIKE ${'%' + search + '%'} OR xc.company ILIKE ${'%' + search + '%'})`;

    query = sql`${query} ORDER BY xc.created_at DESC LIMIT ${parseInt(limit as string)} OFFSET ${parseInt(offset as string)}`;

    const result = await db.execute(query);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

router.get("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    const result = await db.execute(sql`SELECT * FROM xos_contacts WHERE id = ${id}`);
    const contact = (result.rows || result)[0];
    
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    
    // Get related activities
    const activities = await db.execute(sql`
      SELECT * FROM xos_activities WHERE contact_id = ${id} ORDER BY created_at DESC LIMIT 10
    `);
    
    // Get related deals
    const deals = await db.execute(sql`
      SELECT d.*, s.name as stage_name FROM xos_deals d
      LEFT JOIN xos_pipeline_stages s ON d.stage_id = s.id
      WHERE d.contact_id = ${id} ORDER BY d.created_at DESC
    `);
    
    // Get related conversations
    const conversations = await db.execute(sql`
      SELECT * FROM xos_conversations WHERE contact_id = ${id} ORDER BY created_at DESC LIMIT 5
    `);
    
    res.json({
      ...contact,
      activities: activities.rows || activities,
      deals: deals.rows || deals,
      conversations: conversations.rows || conversations,
    });
  } catch (error) {
    console.error("Error fetching contact:", error);
    res.status(500).json({ error: "Failed to fetch contact" });
  }
});

router.post("/contacts", async (req: Request, res: Response) => {
  try {
    const { name, email, phone, whatsapp, type, company, position, source, tags, notes } = req.body;
    
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    const result = await db.execute(sql`
      INSERT INTO xos_contacts (name, email, phone, whatsapp, type, company, position, source, tags, notes)
      VALUES (${name}, ${email || null}, ${phone || null}, ${whatsapp || null}, ${type || 'lead'}, 
              ${company || null}, ${position || null}, ${source || 'manual'}, ${tags || null}, ${notes || null})
      RETURNING *
    `);
    
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating contact:", error);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

router.put("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    const { name, email, phone, whatsapp, type, company, position, lead_status, lead_score, tags, notes, assigned_to } = req.body;
    
    const result = await db.execute(sql`
      UPDATE xos_contacts SET
        name = COALESCE(${name}, name),
        email = COALESCE(${email}, email),
        phone = COALESCE(${phone}, phone),
        whatsapp = COALESCE(${whatsapp}, whatsapp),
        type = COALESCE(${type}, type),
        company = COALESCE(${company}, company),
        position = COALESCE(${position}, position),
        lead_status = COALESCE(${lead_status}, lead_status),
        lead_score = COALESCE(${lead_score ? parseInt(lead_score) : null}, lead_score),
        tags = COALESCE(${tags}, tags),
        notes = COALESCE(${notes}, notes),
        assigned_to = COALESCE(${assigned_to}, assigned_to),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `);
    
    res.json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error updating contact:", error);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

router.delete("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    await db.execute(sql`DELETE FROM xos_contacts WHERE id = ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

// ========== COMPANIES ==========

router.get("/companies", async (req: Request, res: Response) => {
  try {
    const { search, industry, limit = 50 } = req.query;
    
    let query = sql`SELECT * FROM xos_companies WHERE 1=1`;
    if (search) query = sql`${query} AND (name ILIKE ${'%' + search + '%'} OR domain ILIKE ${'%' + search + '%'})`;
    if (industry) query = sql`${query} AND industry = ${industry}`;
    query = sql`${query} ORDER BY created_at DESC LIMIT ${parseInt(limit as string)}`;
    
    const result = await db.execute(query);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ error: "Failed to fetch companies" });
  }
});

router.post("/companies", async (req: Request, res: Response) => {
  try {
    const { name, trade_name, document, domain, industry, size, phone, email, website, address, city, state } = req.body;
    
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    const result = await db.execute(sql`
      INSERT INTO xos_companies (name, trade_name, document, domain, industry, size, phone, email, website, address, city, state)
      VALUES (${name}, ${trade_name || null}, ${document || null}, ${domain || null}, ${industry || null}, 
              ${size || null}, ${phone || null}, ${email || null}, ${website || null}, ${address || null}, ${city || null}, ${state || null})
      RETURNING *
    `);
    
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ error: "Failed to create company" });
  }
});

// ========== PIPELINES & DEALS ==========

router.get("/pipelines", async (req: Request, res: Response) => {
  try {
    const pipelines = await db.execute(sql`
      SELECT p.*, 
        (SELECT json_agg(s ORDER BY s.sort_order) FROM xos_pipeline_stages s WHERE s.pipeline_id = p.id) as stages
      FROM xos_pipelines p
      WHERE p.is_active = true
      ORDER BY p.is_default DESC, p.name
    `);
    
    res.json(pipelines.rows || pipelines);
  } catch (error) {
    console.error("Error fetching pipelines:", error);
    res.status(500).json({ error: "Failed to fetch pipelines" });
  }
});

router.get("/deals", async (req: Request, res: Response) => {
  try {
    const { pipeline_id, stage_id, status, assigned_to } = req.query;
    
    let query = sql`
      SELECT d.*, 
        c.name as contact_name, c.email as contact_email, c.avatar_url as contact_avatar,
        co.name as company_name,
        s.name as stage_name, s.color as stage_color
      FROM xos_deals d
      LEFT JOIN xos_contacts c ON d.contact_id = c.id
      LEFT JOIN xos_companies co ON d.company_id = co.id
      LEFT JOIN xos_pipeline_stages s ON d.stage_id = s.id
      WHERE 1=1
    `;
    
    if (pipeline_id) query = sql`${query} AND d.pipeline_id = ${parseInt(pipeline_id as string)}`;
    if (stage_id) query = sql`${query} AND d.stage_id = ${parseInt(stage_id as string)}`;
    if (status) query = sql`${query} AND d.status = ${status}`;
    if (assigned_to) query = sql`${query} AND d.assigned_to = ${assigned_to}`;
    
    query = sql`${query} ORDER BY d.created_at DESC`;
    
    const result = await db.execute(query);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching deals:", error);
    res.status(500).json({ error: "Failed to fetch deals" });
  }
});

router.post("/deals", async (req: Request, res: Response) => {
  try {
    const { pipeline_id, stage_id, contact_id, company_id, title, value, expected_close_date, assigned_to, notes } = req.body;
    
    if (!title || !pipeline_id || !stage_id) {
      return res.status(400).json({ error: "Title, pipeline_id and stage_id are required" });
    }
    
    const result = await db.execute(sql`
      INSERT INTO xos_deals (pipeline_id, stage_id, contact_id, company_id, title, value, expected_close_date, assigned_to, notes)
      VALUES (${parseInt(pipeline_id)}, ${parseInt(stage_id)}, ${contact_id ? parseInt(contact_id) : null}, 
              ${company_id ? parseInt(company_id) : null}, ${title}, ${parseFloat(value) || 0}, 
              ${expected_close_date || null}, ${assigned_to || null}, ${notes || null})
      RETURNING *
    `);
    
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating deal:", error);
    res.status(500).json({ error: "Failed to create deal" });
  }
});

router.put("/deals/:id/stage", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    const { stage_id } = req.body;
    if (!stage_id) return res.status(400).json({ error: "stage_id is required" });
    
    // Check if stage is won or lost
    const stageResult = await db.execute(sql`SELECT is_won, is_lost FROM xos_pipeline_stages WHERE id = ${parseInt(stage_id)}`);
    const stage = (stageResult.rows || stageResult)[0];
    
    let status = 'open';
    let closedAt = null;
    if (stage?.is_won) {
      status = 'won';
      closedAt = sql`CURRENT_TIMESTAMP`;
    } else if (stage?.is_lost) {
      status = 'lost';
      closedAt = sql`CURRENT_TIMESTAMP`;
    }
    
    const result = await db.execute(sql`
      UPDATE xos_deals SET 
        stage_id = ${parseInt(stage_id)}, 
        status = ${status},
        closed_at = ${closedAt},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `);
    
    const deal = (result.rows || result)[0];

    // FIX-03.B: Deal ganho → papel 'cliente' na pessoa vinculada
    if (stage?.is_won && deal?.contact_id) {
      try {
        const contactResult = await db.execute(sql`SELECT pessoa_id FROM xos_contacts WHERE id = ${deal.contact_id} LIMIT 1`);
        const contact = (contactResult.rows || contactResult)[0] as any;
        if (contact?.pessoa_id) {
          const hasPapel = await db.execute(sql`
            SELECT id FROM pessoa_papeis WHERE pessoa_id = ${contact.pessoa_id} AND tipo_papel = 'cliente' LIMIT 1
          `);
          if (!((hasPapel.rows || hasPapel) as any[]).length) {
            const pessoaResult = await db.execute(sql`SELECT tenant_id FROM pessoas WHERE id = ${contact.pessoa_id} LIMIT 1`);
            const pessoa = (pessoaResult.rows || pessoaResult)[0] as any;
            if (pessoa?.tenant_id) {
              await db.execute(sql`
                INSERT INTO pessoa_papeis (pessoa_id, tipo_papel, tenant_id, created_at)
                VALUES (${contact.pessoa_id}, 'cliente', ${pessoa.tenant_id}, NOW())
                ON CONFLICT DO NOTHING
              `);
            }
          }
        }
      } catch (_) {}
    }

    res.json(deal);
  } catch (error) {
    console.error("Error updating deal stage:", error);
    res.status(500).json({ error: "Failed to update deal stage" });
  }
});

router.put("/deals/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    const { title, value, notes, expected_close_date } = req.body;
    
    const result = await db.execute(sql`
      UPDATE xos_deals SET 
        title = COALESCE(${title}, title),
        value = COALESCE(${value ? parseFloat(value) : null}, value),
        notes = COALESCE(${notes}, notes),
        expected_close_date = ${expected_close_date || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `);
    
    res.json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error updating deal:", error);
    res.status(500).json({ error: "Failed to update deal" });
  }
});

router.delete("/deals/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    await db.execute(sql`DELETE FROM xos_deals WHERE id = ${id}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting deal:", error);
    res.status(500).json({ error: "Failed to delete deal" });
  }
});

// ========== CONVERSATIONS & INBOX ==========

router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const { status, channel, assigned_to, queue_id } = req.query;
    
    let query = sql`
      SELECT cv.*, 
        c.name as contact_name, c.email as contact_email, c.avatar_url as contact_avatar, c.whatsapp as contact_whatsapp,
        q.name as queue_name, q.color as queue_color,
        (SELECT content FROM xos_messages WHERE conversation_id = cv.id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM xos_conversations cv
      LEFT JOIN xos_contacts c ON cv.contact_id = c.id
      LEFT JOIN xos_queues q ON cv.queue_id = q.id
      WHERE 1=1
    `;
    
    if (status) query = sql`${query} AND cv.status = ${status}`;
    if (channel) query = sql`${query} AND cv.channel = ${channel}`;
    if (assigned_to) query = sql`${query} AND cv.assigned_to = ${assigned_to}`;
    if (queue_id) query = sql`${query} AND cv.queue_id = ${parseInt(queue_id as string)}`;
    
    query = sql`${query} ORDER BY cv.updated_at DESC LIMIT 50`;
    
    const result = await db.execute(query);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/conversations/:id/messages", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    const messages = await db.execute(sql`
      SELECT * FROM xos_messages WHERE conversation_id = ${id} ORDER BY created_at ASC
    `);
    
    res.json(messages.rows || messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ========== TICKETS ==========

router.get("/tickets", async (req: Request, res: Response) => {
  try {
    const { status, priority, assigned_to } = req.query;
    
    let query = sql`
      SELECT t.*, 
        c.name as contact_name, c.email as contact_email
      FROM xos_tickets t
      LEFT JOIN xos_contacts c ON t.contact_id = c.id
      WHERE 1=1
    `;
    
    if (status) query = sql`${query} AND t.status = ${status}`;
    if (priority) query = sql`${query} AND t.priority = ${priority}`;
    if (assigned_to) query = sql`${query} AND t.assigned_to = ${assigned_to}`;
    
    query = sql`${query} ORDER BY t.created_at DESC LIMIT 50`;
    
    const result = await db.execute(query);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.post("/tickets", async (req: Request, res: Response) => {
  try {
    const { contact_id, subject, description, category, priority } = req.body;
    
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    
    // Generate ticket number
    const ticketNumber = `TK-${Date.now().toString(36).toUpperCase()}`;
    
    const result = await db.execute(sql`
      INSERT INTO xos_tickets (ticket_number, contact_id, subject, description, category, priority)
      VALUES (${ticketNumber}, ${contact_id ? parseInt(contact_id) : null}, ${subject}, ${description || null}, ${category || null}, ${priority || 'normal'})
      RETURNING *
    `);
    
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

// ========== ACTIVITIES ==========

router.get("/activities", async (req: Request, res: Response) => {
  try {
    const { contact_id, deal_id, type, status } = req.query;
    
    let query = sql`
      SELECT a.*, 
        c.name as contact_name,
        d.title as deal_title
      FROM xos_activities a
      LEFT JOIN xos_contacts c ON a.contact_id = c.id
      LEFT JOIN xos_deals d ON a.deal_id = d.id
      WHERE 1=1
    `;
    
    if (contact_id) query = sql`${query} AND a.contact_id = ${parseInt(contact_id as string)}`;
    if (deal_id) query = sql`${query} AND a.deal_id = ${parseInt(deal_id as string)}`;
    if (type) query = sql`${query} AND a.type = ${type}`;
    if (status) query = sql`${query} AND a.status = ${status}`;
    
    query = sql`${query} ORDER BY a.due_at ASC NULLS LAST, a.created_at DESC LIMIT 50`;
    
    const result = await db.execute(query);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

router.post("/activities", async (req: Request, res: Response) => {
  try {
    const { type, title, description, due_at, contact_id, company_id, deal_id, assigned_to, priority } = req.body;
    
    if (!type || !title) return res.status(400).json({ error: "Type and title are required" });
    
    const result = await db.execute(sql`
      INSERT INTO xos_activities (type, title, description, due_at, contact_id, company_id, deal_id, assigned_to, priority)
      VALUES (${type}, ${title}, ${description || null}, ${due_at || null}, 
              ${contact_id ? parseInt(contact_id) : null}, ${company_id ? parseInt(company_id) : null},
              ${deal_id ? parseInt(deal_id) : null}, ${assigned_to || null}, ${priority || 'normal'})
      RETURNING *
    `);
    
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating activity:", error);
    res.status(500).json({ error: "Failed to create activity" });
  }
});

// ========== DASHBOARD STATS ==========

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM xos_contacts) as total_contacts,
        (SELECT COUNT(*) FROM xos_contacts WHERE type = 'lead') as total_leads,
        (SELECT COUNT(*) FROM xos_contacts WHERE type = 'customer') as total_customers,
        (SELECT COUNT(*) FROM xos_companies) as total_companies,
        (SELECT COUNT(*) FROM xos_deals WHERE status = 'open') as open_deals,
        (SELECT COUNT(*) FROM xos_deals WHERE status = 'won') as won_deals,
        (SELECT COALESCE(SUM(value), 0) FROM xos_deals WHERE status = 'open') as pipeline_value,
        (SELECT COALESCE(SUM(value), 0) FROM xos_deals WHERE status = 'won') as won_value,
        (SELECT COUNT(*) FROM xos_conversations WHERE status = 'open') as open_conversations,
        (SELECT COUNT(*) FROM xos_tickets WHERE status NOT IN ('resolved', 'closed')) as open_tickets,
        (SELECT COUNT(*) FROM xos_activities WHERE status = 'pending' AND due_at <= CURRENT_TIMESTAMP) as overdue_activities
    `);
    
    res.json((stats.rows || stats)[0]);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ========== QUEUES (FILAS) ==========

router.get("/queues", async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT q.*, 
        (SELECT COUNT(*) FROM xos_queue_users qu WHERE qu.queue_id = q.id AND qu.is_active = true) as users_count,
        (SELECT COUNT(*) FROM xos_conversations c WHERE c.queue_id = q.id AND c.status = 'open') as open_conversations
      FROM xos_queues q 
      WHERE q.is_active = true 
      ORDER BY q.order_priority
    `);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching queues:", error);
    res.status(500).json({ error: "Failed to fetch queues" });
  }
});

router.post("/queues", async (req: Request, res: Response) => {
  try {
    const { name, color, greetingMessage, outOfHoursMessage, schedules, orderPriority } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    const result = await db.execute(sql`
      INSERT INTO xos_queues (name, color, greeting_message, out_of_hours_message, schedules, order_priority)
      VALUES (${name}, ${color || 'blue'}, ${greetingMessage || null}, ${outOfHoursMessage || null}, 
              ${schedules ? JSON.stringify(schedules) : null}, ${orderPriority || 0})
      RETURNING *
    `);
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating queue:", error);
    res.status(500).json({ error: "Failed to create queue" });
  }
});

// ========== INTERNAL NOTES (NOTAS INTERNAS) ==========

router.get("/notes", async (req: Request, res: Response) => {
  try {
    const { conversationId, contactId, ticketId } = req.query;
    
    let query = sql`SELECT * FROM xos_internal_notes WHERE 1=1`;
    if (conversationId) query = sql`${query} AND conversation_id = ${parseInt(conversationId as string)}`;
    if (contactId) query = sql`${query} AND contact_id = ${parseInt(contactId as string)}`;
    if (ticketId) query = sql`${query} AND ticket_id = ${parseInt(ticketId as string)}`;
    query = sql`${query} ORDER BY is_pinned DESC, created_at DESC`;
    
    const result = await db.execute(query);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching notes:", error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

router.post("/notes", async (req: Request, res: Response) => {
  try {
    const { conversationId, contactId, ticketId, content, userName } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });
    
    const result = await db.execute(sql`
      INSERT INTO xos_internal_notes (conversation_id, contact_id, ticket_id, content, user_name)
      VALUES (${conversationId || null}, ${contactId || null}, ${ticketId || null}, ${content}, ${userName || 'Usuário'})
      RETURNING *
    `);
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating note:", error);
    res.status(500).json({ error: "Failed to create note" });
  }
});

router.delete("/notes/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await db.execute(sql`DELETE FROM xos_internal_notes WHERE id = ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    res.status(500).json({ error: "Failed to delete note" });
  }
});

// ========== QUICK MESSAGES (MENSAGENS RÁPIDAS) ==========

router.get("/quick-messages", async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    let query = sql`SELECT * FROM xos_quick_messages WHERE 1=1`;
    if (search) query = sql`${query} AND (shortcode ILIKE ${'%' + search + '%'} OR title ILIKE ${'%' + search + '%'} OR content ILIKE ${'%' + search + '%'})`;
    query = sql`${query} ORDER BY usage_count DESC, shortcode`;
    
    const result = await db.execute(query);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching quick messages:", error);
    res.status(500).json({ error: "Failed to fetch quick messages" });
  }
});

router.post("/quick-messages", async (req: Request, res: Response) => {
  try {
    const { shortcode, title, content, mediaUrl, mediaType, scope } = req.body;
    if (!shortcode || !content) return res.status(400).json({ error: "Shortcode and content required" });
    
    const result = await db.execute(sql`
      INSERT INTO xos_quick_messages (shortcode, title, content, media_url, media_type, scope)
      VALUES (${shortcode}, ${title || null}, ${content}, ${mediaUrl || null}, ${mediaType || null}, ${scope || 'company'})
      RETURNING *
    `);
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating quick message:", error);
    res.status(500).json({ error: "Failed to create quick message" });
  }
});

router.put("/quick-messages/:id/use", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    const result = await db.execute(sql`
      UPDATE xos_quick_messages SET usage_count = usage_count + 1 WHERE id = ${id} RETURNING *
    `);
    res.json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error updating quick message:", error);
    res.status(500).json({ error: "Failed to update quick message" });
  }
});

// ========== CONVERSATION TRANSFER ==========

router.put("/conversations/:id/transfer", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    const { queueId, assignedTo } = req.body;
    
    const result = await db.execute(sql`
      UPDATE xos_conversations SET
        queue_id = COALESCE(${queueId ? parseInt(queueId) : null}, queue_id),
        assigned_to = COALESCE(${assignedTo || null}, assigned_to),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `);
    res.json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error transferring conversation:", error);
    res.status(500).json({ error: "Failed to transfer conversation" });
  }
});

// ========== SCHEDULED MESSAGES ==========

router.get("/scheduled-messages", async (req: Request, res: Response) => {
  try {
    const { contactId, status } = req.query;
    let query = sql`SELECT sm.*, c.name as contact_name FROM xos_scheduled_messages sm
      LEFT JOIN xos_contacts c ON sm.contact_id = c.id WHERE 1=1`;
    if (contactId) query = sql`${query} AND sm.contact_id = ${parseInt(contactId as string)}`;
    if (status) query = sql`${query} AND sm.status = ${status}`;
    query = sql`${query} ORDER BY sm.scheduled_at`;
    
    const result = await db.execute(query);
    res.json(result.rows || result);
  } catch (error) {
    console.error("Error fetching scheduled messages:", error);
    res.status(500).json({ error: "Failed to fetch scheduled messages" });
  }
});

router.post("/scheduled-messages", async (req: Request, res: Response) => {
  try {
    const { contactId, conversationId, content, scheduledAt, mediaUrl, mediaType } = req.body;
    if (!content || !scheduledAt) return res.status(400).json({ error: "Content and scheduledAt required" });
    
    const result = await db.execute(sql`
      INSERT INTO xos_scheduled_messages (contact_id, conversation_id, content, scheduled_at, media_url, media_type)
      VALUES (${contactId || null}, ${conversationId || null}, ${content}, ${scheduledAt}, ${mediaUrl || null}, ${mediaType || null})
      RETURNING *
    `);
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating scheduled message:", error);
    res.status(500).json({ error: "Failed to create scheduled message" });
  }
});

router.delete("/scheduled-messages/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await db.execute(sql`UPDATE xos_scheduled_messages SET status = 'cancelled' WHERE id = ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error cancelling scheduled message:", error);
    res.status(500).json({ error: "Failed to cancel scheduled message" });
  }
});

export default router;
