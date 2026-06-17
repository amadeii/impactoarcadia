import { db } from "../../db/index";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  supportTickets,
  supportConversations,
  supportKnowledgeBase,
  type SupportTicket,
  type InsertSupportTicket,
  type SupportConversation,
  type InsertSupportConversation,
  type SupportKnowledgeBase,
  type InsertSupportKnowledgeBase,
} from "@shared/schema";

class SupportStorage {
  // ========== TICKETS ==========
  async getTickets(tenantId?: number, filters?: { status?: string; assigneeId?: string; clientId?: number }): Promise<SupportTicket[]> {
    const conditions = [];
    if (tenantId) conditions.push(eq(supportTickets.tenantId, tenantId));
    if (filters?.status) conditions.push(eq(supportTickets.status, filters.status));
    if (filters?.assigneeId) conditions.push(eq(supportTickets.assigneeId, filters.assigneeId));
    if (filters?.clientId) conditions.push(eq(supportTickets.clientId, filters.clientId));
    
    if (conditions.length > 0) {
      return db.select().from(supportTickets).where(and(...conditions)).orderBy(desc(supportTickets.createdAt));
    }
    return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  }

  async getMyTickets(userId: string, tenantId?: number): Promise<SupportTicket[]> {
    const conditions = [eq(supportTickets.assigneeId, userId)];
    if (tenantId) conditions.push(eq(supportTickets.tenantId, tenantId));
    return db.select().from(supportTickets).where(and(...conditions)).orderBy(desc(supportTickets.createdAt));
  }

  async getOpenTickets(tenantId?: number): Promise<SupportTicket[]> {
    const conditions = [eq(supportTickets.status, "open")];
    if (tenantId) conditions.push(eq(supportTickets.tenantId, tenantId));
    return db.select().from(supportTickets).where(and(...conditions)).orderBy(desc(supportTickets.createdAt));
  }

  async getTicket(id: number): Promise<SupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return ticket;
  }

  async createTicket(data: InsertSupportTicket): Promise<SupportTicket> {
    const code = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const [ticket] = await db.insert(supportTickets).values({ ...data, code }).returning();
    return ticket;
  }

  async updateTicket(id: number, data: Partial<InsertSupportTicket>): Promise<SupportTicket | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.status === "resolved" && !data.resolvedAt) {
      updateData.resolvedAt = new Date();
    }
    if (data.status === "closed" && !data.closedAt) {
      updateData.closedAt = new Date();
    }
    const [ticket] = await db.update(supportTickets).set(updateData).where(eq(supportTickets.id, id)).returning();
    return ticket;
  }

  async deleteTicket(id: number): Promise<boolean> {
    const result = await db.delete(supportTickets).where(eq(supportTickets.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== CONVERSATIONS ==========
  async getConversations(ticketId: number): Promise<SupportConversation[]> {
    return db.select().from(supportConversations).where(eq(supportConversations.ticketId, ticketId)).orderBy(supportConversations.createdAt);
  }

  async createConversation(data: InsertSupportConversation): Promise<SupportConversation> {
    const [conversation] = await db.insert(supportConversations).values(data).returning();
    
    const ticket = await this.getTicket(data.ticketId);
    if (ticket && !ticket.firstResponseAt && data.senderType === "agent") {
      await this.updateTicket(data.ticketId, { firstResponseAt: new Date() } as any);
    }
    
    return conversation;
  }

  async createAiResponse(ticketId: number, content: string, model: string): Promise<SupportConversation> {
    return this.createConversation({
      ticketId,
      senderType: "ai",
      content,
      isAiGenerated: 1,
      aiModel: model,
    });
  }

  // ========== KNOWLEDGE BASE ==========
  async getKnowledgeBaseArticles(tenantId?: number, category?: string): Promise<SupportKnowledgeBase[]> {
    const conditions = [eq(supportKnowledgeBase.status, "published")];
    if (tenantId) conditions.push(eq(supportKnowledgeBase.tenantId, tenantId));
    if (category) conditions.push(eq(supportKnowledgeBase.category, category));
    
    return db.select().from(supportKnowledgeBase).where(and(...conditions)).orderBy(desc(supportKnowledgeBase.updatedAt));
  }

  async getKnowledgeBaseArticle(id: number): Promise<SupportKnowledgeBase | undefined> {
    const [article] = await db.select().from(supportKnowledgeBase).where(eq(supportKnowledgeBase.id, id));
    return article;
  }

  async createKnowledgeBaseArticle(data: InsertSupportKnowledgeBase): Promise<SupportKnowledgeBase> {
    const [article] = await db.insert(supportKnowledgeBase).values(data).returning();
    return article;
  }

  async updateKnowledgeBaseArticle(id: number, data: Partial<InsertSupportKnowledgeBase>): Promise<SupportKnowledgeBase | undefined> {
    const [article] = await db.update(supportKnowledgeBase).set({ ...data, updatedAt: new Date() }).where(eq(supportKnowledgeBase.id, id)).returning();
    return article;
  }

  async deleteKnowledgeBaseArticle(id: number): Promise<boolean> {
    const result = await db.delete(supportKnowledgeBase).where(eq(supportKnowledgeBase.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async incrementArticleViewCount(id: number): Promise<void> {
    await db.update(supportKnowledgeBase).set({ viewCount: sql`view_count + 1` }).where(eq(supportKnowledgeBase.id, id));
  }

  async incrementArticleHelpfulCount(id: number): Promise<void> {
    await db.update(supportKnowledgeBase).set({ helpfulCount: sql`helpful_count + 1` }).where(eq(supportKnowledgeBase.id, id));
  }

  // ========== STATISTICS ==========
  async getSupportStats(tenantId?: number): Promise<any> {
    const allTickets = await this.getTickets(tenantId);
    
    const stats = {
      total: allTickets.length,
      open: allTickets.filter(t => t.status === "open").length,
      inProgress: allTickets.filter(t => t.status === "in_progress").length,
      resolved: allTickets.filter(t => t.status === "resolved").length,
      closed: allTickets.filter(t => t.status === "closed").length,
      avgSatisfaction: allTickets.filter(t => t.satisfaction).reduce((sum, t) => sum + (t.satisfaction || 0), 0) / (allTickets.filter(t => t.satisfaction).length || 1),
    };
    
    return stats;
  }
}

export const supportStorage = new SupportStorage();
