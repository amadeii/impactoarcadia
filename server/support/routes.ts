import { Router } from "express";
import { z } from "zod";
import { supportStorage } from "./storage";
import { productionStorage } from "../production/storage";
import { compassStorage } from "../compass/storage";
import OpenAI from "openai";
import {
  insertSupportTicketSchema,
  insertSupportConversationSchema,
  insertSupportKnowledgeBaseSchema,
} from "@shared/schema";

const router = Router();

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

async function getUserTenantId(req: any): Promise<number | null> {
  const userId = req.user?.id;
  if (!userId) return null;
  
  const headerTenantId = req.headers["x-tenant-id"];
  if (headerTenantId) {
    const tenantId = parseInt(headerTenantId as string);
    const isMember = await compassStorage.isUserInTenant(userId, tenantId);
    return isMember ? tenantId : null;
  }
  
  const tenants = await compassStorage.getUserTenants(userId);
  return tenants.length > 0 ? tenants[0].id : null;
}

// ========== TICKETS ==========
router.get("/tickets", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const filters = {
      status: req.query.status as string | undefined,
      assigneeId: req.query.assigneeId as string | undefined,
      clientId: req.query.clientId ? Number(req.query.clientId) : undefined,
    };
    const tickets = await supportStorage.getTickets(tenantId ?? undefined, filters);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.get("/tickets/my", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const user = req.user as any;
    const tickets = await supportStorage.getMyTickets(user.id, tenantId ?? undefined);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch my tickets" });
  }
});

router.get("/tickets/open", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const tickets = await supportStorage.getOpenTickets(tenantId ?? undefined);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch open tickets" });
  }
});

router.get("/tickets/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const ticket = await supportStorage.getTicket(Number(req.params.id));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.tenantId && ticket.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

router.post("/tickets", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const user = req.user as any;
    const data = insertSupportTicketSchema.parse({
      ...req.body,
      tenantId,
      createdById: user.id,
    });
    const ticket = await supportStorage.createTicket(data);
    res.status(201).json(ticket);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

router.patch("/tickets/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await supportStorage.getTicket(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Ticket not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const data = insertSupportTicketSchema.partial().parse(req.body);
    delete (data as any).tenantId;
    const ticket = await supportStorage.updateTicket(Number(req.params.id), data);
    res.json(ticket);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

router.delete("/tickets/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await supportStorage.getTicket(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Ticket not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    await supportStorage.deleteTicket(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

router.post("/tickets/:id/create-work-item", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const ticket = await supportStorage.getTicket(Number(req.params.id));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.tenantId && ticket.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    
    const user = req.user as any;
    const workItem = await productionStorage.createWorkItem({
      tenantId: ticket.tenantId,
      projectId: ticket.projectId,
      title: `[Ticket ${ticket.code}] ${ticket.title}`,
      description: ticket.description,
      type: "task",
      origin: "support",
      originId: ticket.id,
      originType: "ticket",
      priority: ticket.priority || "medium",
      createdById: user.id,
    });
    
    await supportStorage.updateTicket(ticket.id, { workItemId: workItem.id } as any);
    
    res.status(201).json(workItem);
  } catch (error) {
    res.status(500).json({ error: "Failed to create work item from ticket" });
  }
});

// ========== CONVERSATIONS ==========
router.get("/tickets/:id/conversations", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const ticket = await supportStorage.getTicket(Number(req.params.id));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.tenantId && ticket.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const conversations = await supportStorage.getConversations(Number(req.params.id));
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.post("/tickets/:id/conversations", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const ticket = await supportStorage.getTicket(Number(req.params.id));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.tenantId && ticket.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const user = req.user as any;
    const data = insertSupportConversationSchema.parse({
      ticketId: Number(req.params.id),
      userId: user.id,
      senderType: req.body.senderType || "agent",
      content: req.body.content,
    });
    const conversation = await supportStorage.createConversation(data);
    res.status(201).json(conversation);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.post("/tickets/:id/ai-response", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const ticket = await supportStorage.getTicket(Number(req.params.id));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.tenantId && ticket.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    
    const conversations = await supportStorage.getConversations(ticket.id);
    const kbArticles = await supportStorage.getKnowledgeBaseArticles(ticket.tenantId ?? undefined);
    
    const conversationHistory = conversations.map(c => ({
      role: c.senderType === "customer" ? "user" : "assistant",
      content: c.content,
    }));
    
    const kbContext = kbArticles.slice(0, 5).map(a => `${a.title}: ${a.content.slice(0, 500)}`).join("\n\n");
    
    const systemPrompt = `Você é o Arcádia Agent, assistente de suporte técnico inteligente do Arcádia Suite.
Responda de forma profissional, clara e objetiva.
Use a base de conhecimento fornecida quando relevante.

Ticket: ${ticket.title}
Categoria: ${ticket.category}
Prioridade: ${ticket.priority}

Base de Conhecimento Relevante:
${kbContext}

Instruções:
- Seja cordial e profissional
- Ofereça soluções práticas
- Se não souber a resposta, sugira escalar para um especialista
- Use português brasileiro`;

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory as any,
        { role: "user", content: req.body.question || "Por favor, me ajude com esse ticket." },
      ],
      max_tokens: 1000,
    });
    
    const aiContent = response.choices[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";
    
    const aiConversation = await supportStorage.createAiResponse(ticket.id, aiContent, "gpt-4o");
    
    res.json(aiConversation);
  } catch (error) {
    console.error("AI response error:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

// ========== KNOWLEDGE BASE ==========
router.get("/knowledge-base", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const category = req.query.category as string | undefined;
    const articles = await supportStorage.getKnowledgeBaseArticles(tenantId ?? undefined, category);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch knowledge base" });
  }
});

router.get("/knowledge-base/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const article = await supportStorage.getKnowledgeBaseArticle(Number(req.params.id));
    if (!article) return res.status(404).json({ error: "Article not found" });
    if (article.tenantId && article.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    
    await supportStorage.incrementArticleViewCount(article.id);
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

router.post("/knowledge-base", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const user = req.user as any;
    const data = insertSupportKnowledgeBaseSchema.parse({
      ...req.body,
      tenantId,
      authorId: user.id,
    });
    const article = await supportStorage.createKnowledgeBaseArticle(data);
    res.status(201).json(article);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create article" });
  }
});

router.patch("/knowledge-base/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await supportStorage.getKnowledgeBaseArticle(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Article not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    const data = insertSupportKnowledgeBaseSchema.partial().parse(req.body);
    delete (data as any).tenantId;
    const article = await supportStorage.updateKnowledgeBaseArticle(Number(req.params.id), data);
    res.json(article);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update article" });
  }
});

router.delete("/knowledge-base/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const existing = await supportStorage.getKnowledgeBaseArticle(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Article not found" });
    if (existing.tenantId && existing.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    await supportStorage.deleteKnowledgeBaseArticle(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete article" });
  }
});

router.post("/knowledge-base/:id/helpful", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const article = await supportStorage.getKnowledgeBaseArticle(Number(req.params.id));
    if (!article) return res.status(404).json({ error: "Article not found" });
    if (article.tenantId && article.tenantId !== tenantId) return res.status(403).json({ error: "Access denied" });
    await supportStorage.incrementArticleHelpfulCount(Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark as helpful" });
  }
});

// ========== STATISTICS ==========
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const stats = await supportStorage.getSupportStats(tenantId ?? undefined);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
