import { db } from "../../../db/index";
import { conversations, messages, knowledgeBase, chatAttachments } from "@shared/schema";
import { eq, desc, ilike, or } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: number): Promise<typeof conversations.$inferSelect | undefined>;
  getUserConversations(userId: string): Promise<(typeof conversations.$inferSelect)[]>;
  createConversation(userId: string, title: string): Promise<typeof conversations.$inferSelect>;
  updateConversation(id: number, title: string): Promise<typeof conversations.$inferSelect | undefined>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<(typeof messages.$inferSelect)[]>;
  createMessage(conversationId: number, role: string, content: string, interactionId?: number): Promise<typeof messages.$inferSelect>;
  updateMessageInteractionId(messageId: number, interactionId: number): Promise<void>;
  searchKnowledgeBase(query: string): Promise<(typeof knowledgeBase.$inferSelect)[]>;
  getAllKnowledgeBase(): Promise<(typeof knowledgeBase.$inferSelect)[]>;
  createKnowledgeBaseEntry(entry: { title: string; content: string; author: string; category: string; source?: string }): Promise<typeof knowledgeBase.$inferSelect>;
  deleteKnowledgeBaseEntry(id: number): Promise<void>;
  createAttachment(messageId: number | null, fileName: string, fileType: string, fileContent: string): Promise<typeof chatAttachments.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  },

  async getUserConversations(userId: string) {
    return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.createdAt));
  },

  async createConversation(userId: string, title: string) {
    const [conversation] = await db.insert(conversations).values({ userId, title }).returning();
    return conversation;
  },

  async updateConversation(id: number, title: string) {
    const [conversation] = await db.update(conversations).set({ title }).where(eq(conversations.id, id)).returning();
    return conversation;
  },

  async deleteConversation(id: number) {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },

  async getMessagesByConversation(conversationId: number) {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  },

  async createMessage(conversationId: number, role: string, content: string, interactionId?: number) {
    const [message] = await db.insert(messages).values({ conversationId, role, content, interactionId }).returning();
    return message;
  },

  async updateMessageInteractionId(messageId: number, interactionId: number) {
    await db.update(messages).set({ interactionId }).where(eq(messages.id, messageId));
  },

  async searchKnowledgeBase(query: string) {
    const searchTerms = query.toLowerCase().split(" ").filter(t => t.length > 2);
    if (searchTerms.length === 0) return [];
    
    const results = await db.select().from(knowledgeBase).where(
      or(
        ...searchTerms.map(term => ilike(knowledgeBase.title, `%${term}%`)),
        ...searchTerms.map(term => ilike(knowledgeBase.content, `%${term}%`)),
        ...searchTerms.map(term => ilike(knowledgeBase.category, `%${term}%`))
      )
    );
    return results;
  },

  async getAllKnowledgeBase() {
    return db.select().from(knowledgeBase).orderBy(desc(knowledgeBase.createdAt));
  },

  async createKnowledgeBaseEntry(entry: { title: string; content: string; author: string; category: string; source?: string }) {
    const [result] = await db.insert(knowledgeBase).values(entry).returning();
    return result;
  },

  async deleteKnowledgeBaseEntry(id: number) {
    await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
  },

  async createAttachment(messageId: number | null, fileName: string, fileType: string, fileContent: string) {
    const [attachment] = await db.insert(chatAttachments).values({ messageId, fileName, fileType, fileContent }).returning();
    return attachment;
  },
};
