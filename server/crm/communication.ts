import { db } from "../../db/index";
import { eq, and, desc, sql } from "drizzle-orm";
import { whatsappService } from "../whatsapp/service";
import {
  crmChannels,
  crmThreads,
  crmMessages,
  crmQuickMessages,
  type InsertCrmThread,
  type InsertCrmMessage,
  type CrmChannel,
  type CrmThread,
  type CrmMessage,
} from "@shared/schema";

export class CommunicationService {
  private whatsappBridge: any = null;

  setWhatsAppBridge(bridge: any): void {
    this.whatsappBridge = bridge;
  }

  async connectWhatsAppChannel(channelId: number, tenantId: number, channelName: string): Promise<CrmChannel> {
    const sessionKey = `channel_${channelId}`;
    
    const [existing] = await db.select().from(crmChannels)
      .where(eq(crmChannels.id, channelId));
    
    if (existing) {
      const result = await whatsappService.connect(sessionKey);
      const status = result.status === "connected" ? "connected" : 
                     result.status === "qr_pending" ? "pending_qr" : "disconnected";
      
      if (this.whatsappBridge) {
        this.whatsappBridge.bindChannel(existing.id, sessionKey);
      }
      
      const [updated] = await db.update(crmChannels)
        .set({ 
          status, 
          qrCode: result.qrCode || null,
          sessionData: sessionKey,
          lastConnectedAt: status === "connected" ? new Date() : existing.lastConnectedAt,
          updatedAt: new Date()
        })
        .where(eq(crmChannels.id, existing.id))
        .returning();
      
      return updated;
    }
    
    const result = await whatsappService.connect(sessionKey);
    const status = result.status === "connected" ? "connected" : 
                   result.status === "qr_pending" ? "pending_qr" : "disconnected";
    
    const [channel] = await db.insert(crmChannels).values({
      tenantId,
      type: "whatsapp",
      name: channelName,
      status,
      sessionData: sessionKey,
      qrCode: result.qrCode || null,
      lastConnectedAt: status === "connected" ? new Date() : null,
    }).returning();
    
    if (this.whatsappBridge) {
      this.whatsappBridge.bindChannel(channel.id, sessionKey);
    }
    
    return channel;
  }

  async connectNewWhatsAppChannel(tenantId: number, channelName: string): Promise<CrmChannel> {
    const [channel] = await db.insert(crmChannels).values({
      tenantId,
      type: "whatsapp",
      name: channelName,
      status: "disconnected",
    }).returning();
    
    return this.connectWhatsAppChannel(channel.id, tenantId, channelName);
  }

  async disconnectWhatsAppChannel(channelId: number): Promise<void> {
    const [channel] = await db.select().from(crmChannels).where(eq(crmChannels.id, channelId));
    if (!channel) return;
    
    const sessionKey = channel.sessionData || `channel_${channelId}`;
    await whatsappService.disconnect(sessionKey);
    
    if (this.whatsappBridge) {
      this.whatsappBridge.unbindChannel(channelId);
    }
    
    await db.update(crmChannels)
      .set({ status: "disconnected", qrCode: null, updatedAt: new Date() })
      .where(eq(crmChannels.id, channelId));
  }
  
  async sendWhatsAppMessage(channelId: number, to: string, text: string): Promise<boolean> {
    const [channel] = await db.select().from(crmChannels).where(eq(crmChannels.id, channelId));
    if (!channel || channel.status !== "connected") {
      throw new Error("WhatsApp channel not connected");
    }
    
    const sessionKey = channel.sessionData || `channel_${channelId}`;
    return whatsappService.sendMessage(sessionKey, to, text);
  }

  async getOrCreateThread(
    channelId: number, 
    contactPhone?: string, 
    contactEmail?: string,
    contactName?: string,
    clientId?: number,
    leadId?: number
  ): Promise<CrmThread> {
    const [channel] = await db.select().from(crmChannels).where(eq(crmChannels.id, channelId));
    if (!channel) throw new Error("Channel not found");

    const conditions = [eq(crmThreads.channelId, channelId)];
    if (contactPhone) conditions.push(eq(crmThreads.contactPhone, contactPhone));
    if (contactEmail) conditions.push(eq(crmThreads.contactEmail, contactEmail));

    const [existing] = await db.select().from(crmThreads).where(and(...conditions));
    if (existing) return existing;

    const [thread] = await db.insert(crmThreads).values({
      tenantId: channel.tenantId,
      channelId,
      contactPhone,
      contactEmail,
      contactName,
      clientId,
      leadId,
      status: "open",
      priority: "normal",
      lastMessageAt: new Date(),
    }).returning();

    return thread;
  }

  async sendMessage(
    threadId: number,
    content: string,
    sentById: string,
    type: string = "text",
    channelType: "whatsapp" | "email" = "whatsapp"
  ): Promise<CrmMessage> {
    const [thread] = await db.select().from(crmThreads).where(eq(crmThreads.id, threadId));
    if (!thread) throw new Error("Thread not found");

    const [channel] = await db.select().from(crmChannels).where(eq(crmChannels.id, thread.channelId!));
    if (!channel) throw new Error("Channel not found");

    if (channelType === "whatsapp" && thread.contactPhone) {
      await this.sendWhatsAppMessage(channel.id, thread.contactPhone, content);
    }

    const [message] = await db.insert(crmMessages).values({
      threadId,
      channelId: channel.id,
      direction: "outgoing",
      type,
      content,
      status: "sent",
      sentById,
    }).returning();

    await db.update(crmThreads)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(crmThreads.id, threadId));

    return message;
  }

  async receiveMessage(
    channelId: number,
    contactPhone: string,
    contactName: string | null,
    content: string,
    externalId?: string,
    type: string = "text"
  ): Promise<CrmMessage> {
    const thread = await this.getOrCreateThread(channelId, contactPhone, undefined, contactName || undefined);

    const [message] = await db.insert(crmMessages).values({
      threadId: thread.id,
      channelId,
      direction: "incoming",
      type,
      content,
      externalId,
      status: "received",
    }).returning();

    await db.update(crmThreads)
      .set({ 
        lastMessageAt: new Date(), 
        unreadCount: sql`${crmThreads.unreadCount} + 1`,
        updatedAt: new Date() 
      })
      .where(eq(crmThreads.id, thread.id));

    return message;
  }

  async markThreadRead(threadId: number): Promise<void> {
    await db.update(crmThreads)
      .set({ unreadCount: 0, updatedAt: new Date() })
      .where(eq(crmThreads.id, threadId));
  }

  async assignThread(threadId: number, assignedToId: string): Promise<void> {
    await db.update(crmThreads)
      .set({ assignedToId, updatedAt: new Date() })
      .where(eq(crmThreads.id, threadId));
  }

  async closeThread(threadId: number): Promise<void> {
    await db.update(crmThreads)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(crmThreads.id, threadId));
  }

  async reopenThread(threadId: number): Promise<void> {
    await db.update(crmThreads)
      .set({ status: "open", updatedAt: new Date() })
      .where(eq(crmThreads.id, threadId));
  }

  async getQuickMessages(tenantId?: number, userId?: string): Promise<any[]> {
    const conditions = [];
    if (tenantId) conditions.push(eq(crmQuickMessages.tenantId, tenantId));
    if (userId) conditions.push(eq(crmQuickMessages.userId, userId));
    
    if (conditions.length > 0) {
      return db.select().from(crmQuickMessages).where(and(...conditions));
    }
    return db.select().from(crmQuickMessages);
  }

  async createQuickMessage(
    tenantId: number | undefined,
    userId: string | undefined,
    shortcut: string,
    title: string,
    content: string,
    category?: string,
    isGlobal: boolean = false
  ): Promise<any> {
    const [quickMessage] = await db.insert(crmQuickMessages).values({
      tenantId,
      userId,
      shortcut,
      title,
      content,
      category,
      isGlobal: isGlobal ? "true" : "false",
    }).returning();
    
    return quickMessage;
  }

  async getThreadStats(tenantId?: number): Promise<any> {
    const openCount = await db.select({ count: sql<number>`count(*)` })
      .from(crmThreads)
      .where(tenantId 
        ? and(eq(crmThreads.tenantId, tenantId), eq(crmThreads.status, "open"))
        : eq(crmThreads.status, "open")
      );
    
    const unassignedCount = await db.select({ count: sql<number>`count(*)` })
      .from(crmThreads)
      .where(tenantId
        ? and(eq(crmThreads.tenantId, tenantId), eq(crmThreads.status, "open"), sql`${crmThreads.assignedToId} IS NULL`)
        : and(eq(crmThreads.status, "open"), sql`${crmThreads.assignedToId} IS NULL`)
      );

    return {
      openThreads: Number(openCount[0]?.count || 0),
      unassignedThreads: Number(unassignedCount[0]?.count || 0),
    };
  }
}

export const communicationService = new CommunicationService();
