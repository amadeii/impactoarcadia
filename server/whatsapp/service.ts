import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  WASocket,
  ConnectionState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import { db } from "../../db/index";
import { whatsappContacts, whatsappMessages, whatsappTickets, graphNodes, graphEdges, chatThreads, chatParticipants, chatMessages, pcCrmLeads, tenants } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { learningService } from "../learning/service";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface AutoReplyConfig {
  enabled: boolean;
  welcomeMessage: string;
  businessHours: { start: number; end: number };
  outsideHoursMessage: string;
  aiEnabled: boolean;
  maxAutoRepliesPerContact: number;
}

interface WhatsAppSession {
  socket: WASocket | null;
  qrCode: string | null;
  status: "disconnected" | "connecting" | "connected" | "qr_pending";
  phoneNumber: string | null;
}

interface IncomingMessage {
  userId: string;
  from: string;
  messageId: string;
  text: string;
  timestamp: number;
  pushName: string | null;
}

class WhatsAppService extends EventEmitter {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private authBasePath = "./whatsapp-sessions";
  private autoReplyConfigs: Map<string, AutoReplyConfig> = new Map();
  private autoReplyCount: Map<string, number> = new Map();

  constructor() {
    super();
    if (!fs.existsSync(this.authBasePath)) {
      fs.mkdirSync(this.authBasePath, { recursive: true });
    }
  }

  setAutoReplyConfig(userId: string, config: Partial<AutoReplyConfig>): void {
    const existing = this.autoReplyConfigs.get(userId) || {
      enabled: false,
      welcomeMessage: "Olá! Obrigado por entrar em contato. Em breve um atendente irá te responder.",
      businessHours: { start: 8, end: 18 },
      outsideHoursMessage: "Nosso horário de atendimento é de 8h às 18h. Deixe sua mensagem que retornaremos assim que possível.",
      aiEnabled: true,
      maxAutoRepliesPerContact: 3,
    };
    this.autoReplyConfigs.set(userId, { ...existing, ...config });
  }

  getAutoReplyConfig(userId: string): AutoReplyConfig {
    return this.autoReplyConfigs.get(userId) || {
      enabled: false,
      welcomeMessage: "Olá! Obrigado por entrar em contato. Em breve um atendente irá te responder.",
      businessHours: { start: 8, end: 18 },
      outsideHoursMessage: "Nosso horário de atendimento é de 8h às 18h. Deixe sua mensagem que retornaremos assim que possível.",
      aiEnabled: true,
      maxAutoRepliesPerContact: 3,
    };
  }

  private async generateAIResponse(message: string, contactName: string, conversationHistory: string[]): Promise<string> {
    try {
      const systemPrompt = `Você é um assistente virtual de atendimento ao cliente da empresa Arcádia Suite.
Seja educado, prestativo e objetivo. Responda em português brasileiro.
Se não souber a resposta para algo específico, diga que vai encaminhar para um atendente humano.
Mantenha respostas curtas e diretas (máximo 2-3 frases).
Nome do cliente: ${contactName}`;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
      ];

      conversationHistory.slice(-5).forEach((msg) => {
        messages.push({ role: "user", content: msg });
      });
      
      messages.push({ role: "user", content: message });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 200,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || "Obrigado pela mensagem. Um atendente irá te responder em breve.";
    } catch (error: any) {
      console.error("[WhatsApp] AI response error:", error.message);
      return "Obrigado pela mensagem. Um atendente irá te responder em breve.";
    }
  }

  private async processAutoReply(msg: IncomingMessage, contact: typeof whatsappContacts.$inferSelect): Promise<void> {
    try {
      const config = this.getAutoReplyConfig(msg.userId);
      if (!config.enabled) return;

      const contactKey = `${msg.userId}_${contact.id}`;
      const currentCount = this.autoReplyCount.get(contactKey) || 0;
      
      if (currentCount >= config.maxAutoRepliesPerContact) {
        return;
      }

      const currentHour = new Date().getHours();
      const isBusinessHours = currentHour >= config.businessHours.start && currentHour < config.businessHours.end;

      let replyText: string;

      if (!isBusinessHours) {
        replyText = config.outsideHoursMessage;
      } else if (currentCount === 0) {
        replyText = config.welcomeMessage;
      } else if (config.aiEnabled) {
        const recentMessages = await db.select().from(whatsappMessages)
          .where(and(
            eq(whatsappMessages.userId, msg.userId),
            eq(whatsappMessages.whatsappContactId, contact.id)
          ))
          .orderBy(desc(whatsappMessages.timestamp))
          .limit(5);
        
        const history = recentMessages.reverse().map(m => m.body || "");
        replyText = await this.generateAIResponse(msg.text, contact.name || contact.pushName || "Cliente", history);
      } else {
        return;
      }

      await this.sendMessage(msg.userId, msg.from, replyText);
      this.autoReplyCount.set(contactKey, currentCount + 1);

      setTimeout(() => {
        const count = this.autoReplyCount.get(contactKey) || 0;
        if (count > 0) {
          this.autoReplyCount.set(contactKey, count - 1);
        }
      }, 30 * 60 * 1000);

      console.log(`[WhatsApp] Auto-reply sent to ${contact.phoneNumber}`);
    } catch (error: any) {
      console.error("[WhatsApp] Auto-reply error:", error.message);
    }
  }

  async connect(userId: string): Promise<{ qrCode?: string; status: string }> {
    const existing = this.sessions.get(userId);
    if (existing?.status === "connected") {
      return { status: "connected" };
    }

    if (existing?.status === "connecting" || existing?.status === "qr_pending") {
      return { qrCode: existing.qrCode || undefined, status: existing.status };
    }

    const authPath = path.join(this.authBasePath, userId);
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    const session: WhatsAppSession = {
      socket: null,
      qrCode: null,
      status: "connecting",
      phoneNumber: null,
    };
    this.sessions.set(userId, session);

    try {
      const { state, saveCreds } = await useMultiFileAuthState(authPath);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Arcádia Suite", "Chrome", "1.0.0"],
      });

      session.socket = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          session.qrCode = qr;
          session.status = "qr_pending";
          this.emit("qr", { userId, qr });
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          session.status = "disconnected";
          session.qrCode = null;
          this.emit("disconnected", { userId, shouldReconnect });

          if (shouldReconnect) {
            setTimeout(() => this.connect(userId), 5000);
          } else {
            this.sessions.delete(userId);
            if (fs.existsSync(authPath)) {
              fs.rmSync(authPath, { recursive: true, force: true });
            }
          }
        }

        if (connection === "open") {
          session.status = "connected";
          session.qrCode = null;
          session.phoneNumber = sock.user?.id?.split(":")[0] || null;
          this.emit("connected", { userId, phoneNumber: session.phoneNumber });
        }
      });

      sock.ev.on("messages.upsert", async (m) => {
        const messages = m.messages;
        for (const msg of messages) {
          if (!msg.key.fromMe && msg.message) {
            const text = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         "";
            const remoteJid = msg.key.remoteJid || "";
            
            const incomingMsg: IncomingMessage = {
              userId,
              from: remoteJid,
              messageId: msg.key.id || "",
              text,
              timestamp: (msg.messageTimestamp as number) || Date.now() / 1000,
              pushName: msg.pushName || null,
            };
            
            await this.handleIncomingMessage(incomingMsg);
            this.emit("message", incomingMsg);
          }
        }
      });

      return new Promise((resolve) => {
        const checkStatus = () => {
          const s = this.sessions.get(userId);
          if (s?.status === "qr_pending" && s.qrCode) {
            resolve({ qrCode: s.qrCode, status: "qr_pending" });
          } else if (s?.status === "connected") {
            resolve({ status: "connected" });
          } else {
            setTimeout(checkStatus, 500);
          }
        };
        setTimeout(checkStatus, 1000);
      });
    } catch (error) {
      console.error("WhatsApp connection error:", error);
      session.status = "disconnected";
      throw error;
    }
  }

  private async handleIncomingMessage(msg: IncomingMessage): Promise<void> {
    try {
      const phoneNumber = msg.from.replace("@s.whatsapp.net", "").replace("@g.us", "");
      
      let [contact] = await db.select().from(whatsappContacts)
        .where(and(
          eq(whatsappContacts.userId, msg.userId),
          eq(whatsappContacts.whatsappId, msg.from)
        )).limit(1);
      
      if (!contact) {
        const [newContact] = await db.insert(whatsappContacts).values({
          userId: msg.userId,
          whatsappId: msg.from,
          phoneNumber,
          pushName: msg.pushName,
          name: msg.pushName,
        }).returning();
        contact = newContact;
      } else if (msg.pushName && msg.pushName !== contact.pushName) {
        await db.update(whatsappContacts)
          .set({ pushName: msg.pushName, name: msg.pushName })
          .where(eq(whatsappContacts.id, contact.id));
      }

      await db.insert(whatsappMessages).values({
        userId: msg.userId,
        whatsappContactId: contact.id,
        remoteJid: msg.from,
        messageId: msg.messageId,
        fromMe: "false",
        body: msg.text,
        messageType: "text",
        timestamp: new Date(msg.timestamp * 1000),
        status: "received",
      });

      let [ticket] = await db.select().from(whatsappTickets)
        .where(and(
          eq(whatsappTickets.ownerId, msg.userId),
          eq(whatsappTickets.contactId, contact.id),
          eq(whatsappTickets.status, "open")
        )).limit(1);
      
      if (!ticket) {
        const protocol = `${Date.now()}`.slice(-8);
        await db.insert(whatsappTickets).values({
          ownerId: msg.userId,
          contactId: contact.id,
          status: "open",
          lastMessage: msg.text,
          unreadCount: 1,
          protocol,
        });
      } else {
        await db.update(whatsappTickets)
          .set({ 
            lastMessage: msg.text, 
            unreadCount: (ticket.unreadCount || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(whatsappTickets.id, ticket.id));
      }

      console.log(`[WhatsApp] Message saved from ${phoneNumber}: ${msg.text.slice(0, 50)}...`);
      
      await this.saveToKnowledgeGraph(msg, contact, "inbound");
      
      this.processAutoReply(msg, contact).catch((err) => {
        console.error("[WhatsApp] Auto-reply failed:", err.message);
      });
    } catch (error) {
      console.error("[WhatsApp] Error handling incoming message:", error);
    }
  }

  private async saveToKnowledgeGraph(msg: IncomingMessage, contact: typeof whatsappContacts.$inferSelect, direction: "inbound" | "outbound"): Promise<void> {
    try {
      const [existingMessageNode] = await db.select().from(graphNodes)
        .where(and(
          eq(graphNodes.type, "whatsapp_message"),
          eq(graphNodes.externalId, msg.messageId)
        )).limit(1);
      
      if (existingMessageNode) {
        return;
      }

      const [contactNode] = await db.select().from(graphNodes)
        .where(and(
          eq(graphNodes.type, "whatsapp_contact"),
          eq(graphNodes.externalId, contact.whatsappId)
        )).limit(1);

      let contactNodeId: number;
      if (!contactNode) {
        const [newNode] = await db.insert(graphNodes).values({
          type: "whatsapp_contact",
          externalId: contact.whatsappId,
          data: {
            name: contact.name || contact.pushName || contact.phoneNumber,
            phoneNumber: contact.phoneNumber,
            pushName: contact.pushName,
            userId: msg.userId,
          },
        }).returning();
        contactNodeId = newNode.id;
      } else {
        contactNodeId = contactNode.id;
        await db.update(graphNodes)
          .set({ 
            data: { 
              ...((contactNode.data as any) || {}),
              name: contact.name || contact.pushName || contact.phoneNumber,
              pushName: contact.pushName,
              lastMessageAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(graphNodes.id, contactNodeId));
      }

      const [messageNode] = await db.insert(graphNodes).values({
        type: "whatsapp_message",
        externalId: msg.messageId,
        data: {
          body: msg.text,
          direction,
          timestamp: new Date(msg.timestamp * 1000).toISOString(),
          contactId: contact.id,
          userId: msg.userId,
        },
      }).returning();

      await db.insert(graphEdges).values({
        sourceNodeId: direction === "inbound" ? contactNodeId : messageNode.id,
        targetNodeId: direction === "inbound" ? messageNode.id : contactNodeId,
        relationshipType: direction === "inbound" ? "sent" : "sent_to",
        weight: "1",
      });

      if (msg.text && msg.text.length > 5) {
        learningService.saveInteraction({
          userId: msg.userId,
          source: "whatsapp",
          question: direction === "inbound" 
            ? `Mensagem recebida de ${contact.name || contact.phoneNumber}` 
            : `Mensagem enviada para ${contact.name || contact.phoneNumber}`,
          answer: msg.text,
          context: {
            contactId: contact.id,
            contactName: contact.name || contact.pushName,
            phoneNumber: contact.phoneNumber,
            direction,
            messageId: msg.messageId,
          },
          tags: ["whatsapp", direction, "atendimento"],
          category: "comunicacao",
        }).catch((err: any) => {
          console.log("[WhatsApp] Learning service error (non-fatal):", err.message);
        });
      }

      console.log(`[WhatsApp] Message added to knowledge graph: ${msg.messageId}`);
    } catch (error) {
      console.error("[WhatsApp] Error saving to knowledge graph:", error);
    }
  }

  async disconnect(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session?.socket) {
      await session.socket.logout();
      session.socket = null;
    }
    session && (session.status = "disconnected");
    this.sessions.delete(userId);

    const authPath = path.join(this.authBasePath, userId);
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }
  }

  getStatus(userId: string): WhatsAppSession | null {
    return this.sessions.get(userId) || null;
  }

  async sendMessage(userId: string, to: string, text: string): Promise<boolean> {
    const session = this.sessions.get(userId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("WhatsApp not connected");
    }

    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
    await session.socket.sendMessage(jid, { text });

    const phoneNumber = to.replace("@s.whatsapp.net", "").replace("@g.us", "");
    
    let [contact] = await db.select().from(whatsappContacts)
      .where(and(
        eq(whatsappContacts.userId, userId),
        eq(whatsappContacts.whatsappId, jid)
      )).limit(1);
    
    if (!contact) {
      const [newContact] = await db.insert(whatsappContacts).values({
        userId,
        whatsappId: jid,
        phoneNumber,
      }).returning();
      contact = newContact;
    }

    const sentMessageId = `sent_${Date.now()}`;
    await db.insert(whatsappMessages).values({
      userId,
      whatsappContactId: contact.id,
      remoteJid: jid,
      messageId: sentMessageId,
      fromMe: "true",
      body: text,
      messageType: "text",
      timestamp: new Date(),
      status: "sent",
    });

    const [ticket] = await db.select().from(whatsappTickets)
      .where(and(
        eq(whatsappTickets.ownerId, userId),
        eq(whatsappTickets.contactId, contact.id),
        eq(whatsappTickets.status, "open")
      )).limit(1);
    
    if (ticket) {
      await db.update(whatsappTickets)
        .set({ lastMessage: text, updatedAt: new Date() })
        .where(eq(whatsappTickets.id, ticket.id));
    }

    const outboundMsg: IncomingMessage = {
      userId,
      from: jid,
      messageId: sentMessageId,
      text,
      timestamp: Date.now() / 1000,
      pushName: null,
    };
    await this.saveToKnowledgeGraph(outboundMsg, contact, "outbound");

    return true;
  }

  async sendMedia(
    userId: string,
    ticketId: number,
    filePath: string,
    fileName: string,
    mimeType: string,
    caption?: string
  ): Promise<boolean> {
    const session = this.sessions.get(userId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("WhatsApp not connected");
    }

    const [ticket] = await db.select().from(whatsappTickets)
      .where(and(
        eq(whatsappTickets.id, ticketId),
        eq(whatsappTickets.ownerId, userId)
      )).limit(1);
    
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const [contact] = await db.select().from(whatsappContacts)
      .where(eq(whatsappContacts.id, ticket.contactId)).limit(1);
    
    if (!contact) {
      throw new Error("Contact not found");
    }

    const jid = contact.whatsappId;
    const fileBuffer = fs.readFileSync(filePath);
    
    let messageContent: any;
    let messageType: string;
    
    if (mimeType.startsWith("image/")) {
      messageType = "image";
      messageContent = { image: fileBuffer, caption: caption || undefined };
    } else if (mimeType.startsWith("video/")) {
      messageType = "video";
      messageContent = { video: fileBuffer, caption: caption || undefined };
    } else if (mimeType.startsWith("audio/")) {
      messageType = "audio";
      messageContent = { audio: fileBuffer, mimetype: mimeType, ptt: false };
    } else {
      messageType = "document";
      messageContent = { 
        document: fileBuffer, 
        fileName: fileName,
        mimetype: mimeType,
        caption: caption || undefined 
      };
    }

    await session.socket.sendMessage(jid, messageContent);

    const sentMessageId = `sent_media_${Date.now()}`;
    const displayText = caption || `📎 ${fileName}`;
    
    await db.insert(whatsappMessages).values({
      userId,
      whatsappContactId: contact.id,
      remoteJid: jid,
      messageId: sentMessageId,
      fromMe: "true",
      body: displayText,
      messageType,
      timestamp: new Date(),
      status: "sent",
    });

    await db.update(whatsappTickets)
      .set({ lastMessage: displayText, updatedAt: new Date() })
      .where(eq(whatsappTickets.id, ticketId));

    return true;
  }

  async getTickets(userId: string, status?: string): Promise<any[]> {
    const conditions = [eq(whatsappTickets.ownerId, userId)];
    if (status) {
      conditions.push(eq(whatsappTickets.status, status));
    }
    
    const tickets = await db.select({
      ticket: whatsappTickets,
      contact: whatsappContacts,
    })
      .from(whatsappTickets)
      .leftJoin(whatsappContacts, eq(whatsappTickets.contactId, whatsappContacts.id))
      .where(and(...conditions))
      .orderBy(desc(whatsappTickets.updatedAt));
    
    const result = [];
    for (const t of tickets) {
      const [lastMessage] = await db.select()
        .from(whatsappMessages)
        .where(and(
          eq(whatsappMessages.userId, userId),
          eq(whatsappMessages.whatsappContactId, t.ticket.contactId)
        ))
        .orderBy(desc(whatsappMessages.timestamp))
        .limit(1);
      
      result.push({
        ...t.ticket,
        contact: t.contact,
        lastMessage: lastMessage?.body || null,
        lastMessageFromMe: lastMessage?.fromMe || false,
      });
    }
    
    return result;
  }

  async getTicketMessages(userId: string, ticketId: number): Promise<any[]> {
    const [ticket] = await db.select().from(whatsappTickets)
      .where(and(
        eq(whatsappTickets.id, ticketId),
        eq(whatsappTickets.ownerId, userId)
      )).limit(1);
    
    if (!ticket) return [];

    const messages = await db.select().from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.userId, userId),
        eq(whatsappMessages.whatsappContactId, ticket.contactId)
      ))
      .orderBy(whatsappMessages.timestamp);
    
    return messages;
  }

  async markTicketAsRead(userId: string, ticketId: number): Promise<void> {
    await db.update(whatsappTickets)
      .set({ unreadCount: 0 })
      .where(and(
        eq(whatsappTickets.id, ticketId),
        eq(whatsappTickets.ownerId, userId)
      ));
  }

  async closeTicket(userId: string, ticketId: number): Promise<void> {
    await db.update(whatsappTickets)
      .set({ status: "closed", closedAt: new Date() })
      .where(and(
        eq(whatsappTickets.id, ticketId),
        eq(whatsappTickets.ownerId, userId)
      ));
  }

  async getContacts(userId: string): Promise<any[]> {
    return db.select().from(whatsappContacts)
      .where(eq(whatsappContacts.userId, userId))
      .orderBy(desc(whatsappContacts.createdAt));
  }

  async createContact(
    userId: string,
    data: {
      name: string;
      phone: string;
      email?: string;
      company?: string;
      isLead: boolean;
      leadSource: string;
    }
  ): Promise<{ contact: any; leadCreated: boolean; lead?: any }> {
    const phoneNumber = data.phone.replace(/\D/g, "");
    const whatsappId = `${phoneNumber}@s.whatsapp.net`;

    const [existingContact] = await db.select().from(whatsappContacts)
      .where(and(
        eq(whatsappContacts.userId, userId),
        eq(whatsappContacts.whatsappId, whatsappId)
      )).limit(1);

    let contact;
    if (existingContact) {
      [contact] = await db.update(whatsappContacts)
        .set({ name: data.name, phoneNumber })
        .where(eq(whatsappContacts.id, existingContact.id))
        .returning();
    } else {
      [contact] = await db.insert(whatsappContacts).values({
        userId,
        whatsappId,
        name: data.name,
        phoneNumber,
      }).returning();
    }

    let leadCreated = false;
    let lead = null;

    if (data.isLead) {
      const [tenant] = await db.select().from(tenants).limit(1);
      
      if (tenant) {
        [lead] = await db.insert(pcCrmLeads).values({
          tenantId: tenant.id,
          userId,
          name: data.name,
          email: data.email || null,
          phone: phoneNumber,
          company: data.company || null,
          source: data.leadSource,
          status: "new",
          notes: `Lead criado via WhatsApp`,
        }).returning();
        leadCreated = true;
      }
    }

    return { contact, leadCreated, lead };
  }

  async getAnalytics(userId: string): Promise<any> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allTickets = await db.select().from(whatsappTickets)
      .where(eq(whatsappTickets.ownerId, userId));

    const allMessages = await db.select().from(whatsappMessages)
      .where(eq(whatsappMessages.userId, userId));

    const todayTickets = allTickets.filter(t => new Date(t.createdAt) >= today);
    const weekTickets = allTickets.filter(t => new Date(t.createdAt) >= startOfWeek);
    const monthTickets = allTickets.filter(t => new Date(t.createdAt) >= startOfMonth);

    const openTickets = allTickets.filter(t => t.status === "open");
    const closedTickets = allTickets.filter(t => t.status === "closed");

    const avgResponseTimes: number[] = [];
    for (const ticket of closedTickets) {
      if (ticket.closedAt && ticket.createdAt) {
        const responseTime = new Date(ticket.closedAt).getTime() - new Date(ticket.createdAt).getTime();
        avgResponseTimes.push(responseTime);
      }
    }
    const avgResponseTime = avgResponseTimes.length > 0 
      ? avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length 
      : 0;

    const inboundMessages = allMessages.filter(m => m.fromMe === "false" || m.fromMe === false);
    const outboundMessages = allMessages.filter(m => m.fromMe === "true" || m.fromMe === true);

    const messagesPerDay: Record<string, number> = {};
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0];
      last7Days.push(key);
      messagesPerDay[key] = 0;
    }
    allMessages.forEach(m => {
      const key = new Date(m.timestamp || m.createdAt).toISOString().split('T')[0];
      if (messagesPerDay[key] !== undefined) {
        messagesPerDay[key]++;
      }
    });

    return {
      summary: {
        totalTickets: allTickets.length,
        openTickets: openTickets.length,
        closedTickets: closedTickets.length,
        totalMessages: allMessages.length,
        inboundMessages: inboundMessages.length,
        outboundMessages: outboundMessages.length,
      },
      periods: {
        today: todayTickets.length,
        week: weekTickets.length,
        month: monthTickets.length,
      },
      performance: {
        avgResponseTimeMs: Math.round(avgResponseTime),
        avgResponseTimeFormatted: this.formatDuration(avgResponseTime),
        closureRate: allTickets.length > 0 ? Math.round((closedTickets.length / allTickets.length) * 100) : 0,
      },
      chart: {
        labels: last7Days,
        data: last7Days.map(d => messagesPerDay[d]),
      },
    };
  }

  private formatDuration(ms: number): string {
    if (ms === 0) return "N/A";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  async deleteMessage(userId: string, messageId: string): Promise<boolean> {
    const session = this.sessions.get(userId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("WhatsApp not connected");
    }

    const [msg] = await db.select().from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.userId, userId),
        eq(whatsappMessages.messageId, messageId)
      )).limit(1);

    if (!msg) {
      throw new Error("Message not found");
    }

    const isOwnMessage = msg.fromMe === "true" || msg.fromMe === "1" || msg.fromMe === true || msg.fromMe === 1;
    if (!isOwnMessage) {
      throw new Error("You can only delete your own messages");
    }

    try {
      await session.socket.sendMessage(msg.remoteJid, {
        delete: {
          remoteJid: msg.remoteJid,
          fromMe: true,
          id: messageId,
          participant: undefined
        }
      });

      await db.update(whatsappMessages)
        .set({ isDeleted: 1, body: "[Mensagem apagada]" })
        .where(eq(whatsappMessages.messageId, messageId));

      return true;
    } catch (error) {
      console.error("[WhatsApp] Delete message error:", error);
      throw error;
    }
  }

  async replyToMessage(userId: string, originalMessageId: string, text: string): Promise<boolean> {
    const session = this.sessions.get(userId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("WhatsApp not connected");
    }

    const [originalMsg] = await db.select().from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.userId, userId),
        eq(whatsappMessages.messageId, originalMessageId)
      )).limit(1);

    if (!originalMsg) {
      throw new Error("Original message not found");
    }

    const [contact] = await db.select().from(whatsappContacts)
      .where(eq(whatsappContacts.id, originalMsg.whatsappContactId!)).limit(1);

    await session.socket.sendMessage(originalMsg.remoteJid, {
      text,
      contextInfo: {
        stanzaId: originalMessageId,
        participant: originalMsg.remoteJid,
        quotedMessage: { conversation: originalMsg.body || "" }
      }
    });

    const sentMessageId = `sent_${Date.now()}`;
    await db.insert(whatsappMessages).values({
      userId,
      whatsappContactId: originalMsg.whatsappContactId,
      remoteJid: originalMsg.remoteJid,
      messageId: sentMessageId,
      fromMe: "true",
      body: text,
      messageType: "text",
      timestamp: new Date(),
      status: "sent",
      quotedMessageId: originalMessageId,
      quotedBody: originalMsg.body,
    });

    return true;
  }

  async forwardMessage(userId: string, messageId: string, targetJids: string[]): Promise<boolean> {
    const session = this.sessions.get(userId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("WhatsApp not connected");
    }

    const [msg] = await db.select().from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.userId, userId),
        eq(whatsappMessages.messageId, messageId)
      )).limit(1);

    if (!msg) {
      throw new Error("Message not found");
    }

    for (const targetJid of targetJids) {
      const jid = targetJid.includes("@") ? targetJid : `${targetJid}@s.whatsapp.net`;
      
      await session.socket.sendMessage(jid, { text: msg.body || "" });

      let [contact] = await db.select().from(whatsappContacts)
        .where(and(
          eq(whatsappContacts.userId, userId),
          eq(whatsappContacts.whatsappId, jid)
        )).limit(1);

      if (!contact) {
        const phoneNumber = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
        const [newContact] = await db.insert(whatsappContacts).values({
          userId,
          whatsappId: jid,
          phoneNumber,
        }).returning();
        contact = newContact;
      }

      const sentMessageId = `fwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.insert(whatsappMessages).values({
        userId,
        whatsappContactId: contact.id,
        remoteJid: jid,
        messageId: sentMessageId,
        fromMe: "true",
        body: msg.body,
        messageType: "text",
        timestamp: new Date(),
        status: "sent",
      });
    }

    return true;
  }

  async syncContacts(userId: string): Promise<number> {
    const session = this.sessions.get(userId);
    if (!session?.socket || session.status !== "connected") {
      throw new Error("WhatsApp not connected");
    }

    try {
      const store = (session.socket as any).store;
      if (!store?.contacts) {
        return 0;
      }

      let syncedCount = 0;
      const contacts = Object.values(store.contacts) as any[];

      for (const contact of contacts) {
        if (!contact.id || contact.id.includes("@g.us")) continue;

        const [existing] = await db.select().from(whatsappContacts)
          .where(and(
            eq(whatsappContacts.userId, userId),
            eq(whatsappContacts.whatsappId, contact.id)
          )).limit(1);

        if (!existing) {
          await db.insert(whatsappContacts).values({
            userId,
            whatsappId: contact.id,
            name: contact.name || contact.notify || null,
            pushName: contact.notify || null,
            phoneNumber: contact.id.replace("@s.whatsapp.net", ""),
          });
          syncedCount++;
        } else if (contact.name || contact.notify) {
          await db.update(whatsappContacts)
            .set({ 
              name: contact.name || existing.name,
              pushName: contact.notify || existing.pushName
            })
            .where(eq(whatsappContacts.id, existing.id));
        }
      }

      return syncedCount;
    } catch (error) {
      console.error("[WhatsApp] Sync contacts error:", error);
      return 0;
    }
  }

  async searchContacts(userId: string, query: string): Promise<any[]> {
    const contacts = await db.select().from(whatsappContacts)
      .where(eq(whatsappContacts.userId, userId));

    const searchLower = query.toLowerCase();
    return contacts.filter(c => 
      (c.name && c.name.toLowerCase().includes(searchLower)) ||
      (c.pushName && c.pushName.toLowerCase().includes(searchLower)) ||
      (c.phoneNumber && c.phoneNumber.includes(query))
    );
  }

  async transferTicket(userId: string, ticketId: number, targetUserId: string, note?: string): Promise<boolean> {
    const [ticket] = await db.select().from(whatsappTickets)
      .where(and(
        eq(whatsappTickets.id, ticketId),
        eq(whatsappTickets.ownerId, userId)
      )).limit(1);

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.status !== "open") {
      throw new Error("Cannot transfer closed tickets");
    }

    await db.update(whatsappTickets)
      .set({ 
        assignedToId: targetUserId,
        updatedAt: new Date()
      })
      .where(eq(whatsappTickets.id, ticketId));

    if (note) {
      const [contact] = await db.select().from(whatsappContacts)
        .where(eq(whatsappContacts.id, ticket.contactId)).limit(1);
      
      if (contact) {
        await db.insert(whatsappMessages).values({
          userId,
          whatsappContactId: ticket.contactId,
          remoteJid: contact.whatsappId,
          messageId: `system_${Date.now()}`,
          fromMe: "true",
          body: `[Sistema] Conversa transferida. Nota: ${note}`,
          messageType: "system",
          timestamp: new Date(),
          status: "delivered",
        });
      }
    }

    console.log(`[WhatsApp] Ticket ${ticketId} transferred from ${userId} to ${targetUserId}`);
    return true;
  }

  async forwardTicketToChat(userId: string, ticketId: number, targetUserIds: string[], contextMessage?: string): Promise<{ threadId: number }> {
    const [ticket] = await db.select().from(whatsappTickets)
      .where(and(
        eq(whatsappTickets.id, ticketId),
        eq(whatsappTickets.ownerId, userId)
      )).limit(1);

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const [contact] = await db.select().from(whatsappContacts)
      .where(eq(whatsappContacts.id, ticket.contactId)).limit(1);

    const recentMessages = await db.select().from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.userId, userId),
        eq(whatsappMessages.whatsappContactId, ticket.contactId)
      ))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(5);

    const participantIds = [userId, ...targetUserIds];
    const threadName = `WhatsApp: ${contact?.name || contact?.pushName || contact?.phoneNumber || "Contato"}`;

    const [newThread] = await db.insert(chatThreads).values({
      type: "group",
      name: threadName,
    }).returning();

    for (const participantId of participantIds) {
      await db.insert(chatParticipants).values({
        threadId: newThread.id,
        participantId,
      });
    }

    let summaryText = `Conversa encaminhada do WhatsApp\n`;
    summaryText += `Contato: ${contact?.name || contact?.pushName || contact?.phoneNumber || "Desconhecido"}\n`;
    summaryText += `Telefone: ${contact?.phoneNumber || "N/A"}\n\n`;
    
    if (contextMessage) {
      summaryText += `Mensagem: ${contextMessage}\n\n`;
    }

    if (recentMessages.length > 0) {
      summaryText += `Últimas mensagens:\n`;
      for (const msg of recentMessages.reverse()) {
        const sender = msg.fromMe === "true" ? "Você" : (contact?.name || contact?.pushName || "Cliente");
        summaryText += `[${sender}]: ${msg.body || "[Mídia]"}\n`;
      }
    }

    await db.insert(chatMessages).values({
      threadId: newThread.id,
      senderId: userId,
      body: summaryText,
      messageType: "system",
    });

    console.log(`[WhatsApp] Ticket ${ticketId} forwarded to internal chat thread ${newThread.id}`);
    return { threadId: newThread.id };
  }
}

export const whatsappService = new WhatsAppService();
