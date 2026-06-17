import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { whatsappService } from "./service";

const uploadDir = path.join(process.cwd(), "uploads", "whatsapp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 64 * 1024 * 1024 }, // 64MB limit
});

export function registerWhatsappRoutes(app: Express): void {
  app.post("/api/whatsapp/connect", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const result = await whatsappService.connect(userId);
      res.json(result);
    } catch (error) {
      console.error("WhatsApp connect error:", error);
      res.status(500).json({ error: "Failed to connect to WhatsApp" });
    }
  });

  app.post("/api/whatsapp/disconnect", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      await whatsappService.disconnect(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("WhatsApp disconnect error:", error);
      res.status(500).json({ error: "Failed to disconnect from WhatsApp" });
    }
  });

  app.get("/api/whatsapp/status", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const session = whatsappService.getStatus(userId);
      
      if (!session) {
        return res.json({ status: "disconnected", qrCode: null, phoneNumber: null });
      }
      
      res.json({
        status: session.status,
        qrCode: session.qrCode,
        phoneNumber: session.phoneNumber,
      });
    } catch (error) {
      console.error("WhatsApp status error:", error);
      res.status(500).json({ error: "Failed to get WhatsApp status" });
    }
  });

  app.post("/api/whatsapp/send", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const { to, message } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({ error: "to and message are required" });
      }
      
      await whatsappService.sendMessage(userId, to, message);
      res.json({ success: true });
    } catch (error) {
      console.error("WhatsApp send error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.get("/api/whatsapp/tickets", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const status = req.query.status as string | undefined;
      const tickets = await whatsappService.getTickets(userId, status);
      res.json(tickets);
    } catch (error) {
      console.error("WhatsApp tickets error:", error);
      res.status(500).json({ error: "Failed to get tickets" });
    }
  });

  app.get("/api/whatsapp/tickets/:id/messages", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const ticketId = parseInt(req.params.id);
      const messages = await whatsappService.getTicketMessages(userId, ticketId);
      res.json(messages);
    } catch (error) {
      console.error("WhatsApp ticket messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  app.post("/api/whatsapp/tickets/:id/read", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const ticketId = parseInt(req.params.id);
      await whatsappService.markTicketAsRead(userId, ticketId);
      res.json({ success: true });
    } catch (error) {
      console.error("WhatsApp mark read error:", error);
      res.status(500).json({ error: "Failed to mark as read" });
    }
  });

  app.post("/api/whatsapp/tickets/:id/close", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const ticketId = parseInt(req.params.id);
      await whatsappService.closeTicket(userId, ticketId);
      res.json({ success: true });
    } catch (error) {
      console.error("WhatsApp close ticket error:", error);
      res.status(500).json({ error: "Failed to close ticket" });
    }
  });

  app.post("/api/whatsapp/tickets/:id/send", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const ticketId = parseInt(req.params.id);
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "message is required" });
      }

      const tickets = await whatsappService.getTickets(userId);
      const ticket = tickets.find(t => t.id === ticketId);
      
      if (!ticket || !ticket.contact) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      await whatsappService.sendMessage(userId, ticket.contact.whatsappId, message);
      res.json({ success: true });
    } catch (error) {
      console.error("WhatsApp send to ticket error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.get("/api/whatsapp/contacts", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const contacts = await whatsappService.getContacts(userId);
      res.json(contacts);
    } catch (error) {
      console.error("WhatsApp contacts error:", error);
      res.status(500).json({ error: "Failed to get contacts" });
    }
  });

  app.get("/api/whatsapp/auto-reply/config", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const config = whatsappService.getAutoReplyConfig(userId);
      res.json(config);
    } catch (error) {
      console.error("WhatsApp auto-reply config error:", error);
      res.status(500).json({ error: "Failed to get auto-reply config" });
    }
  });

  app.post("/api/whatsapp/auto-reply/config", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const config = req.body;
      whatsappService.setAutoReplyConfig(userId, config);
      res.json({ success: true, config: whatsappService.getAutoReplyConfig(userId) });
    } catch (error) {
      console.error("WhatsApp set auto-reply config error:", error);
      res.status(500).json({ error: "Failed to set auto-reply config" });
    }
  });

  app.get("/api/whatsapp/analytics", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const analytics = await whatsappService.getAnalytics(userId);
      res.json(analytics);
    } catch (error) {
      console.error("WhatsApp analytics error:", error);
      res.status(500).json({ error: "Failed to get analytics" });
    }
  });

  app.delete("/api/whatsapp/messages/:messageId", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const { messageId } = req.params;
      await whatsappService.deleteMessage(userId, messageId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("WhatsApp delete message error:", error);
      res.status(500).json({ error: error.message || "Failed to delete message" });
    }
  });

  app.post("/api/whatsapp/messages/:messageId/reply", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const { messageId } = req.params;
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "text is required" });
      }
      
      await whatsappService.replyToMessage(userId, messageId, text);
      res.json({ success: true });
    } catch (error: any) {
      console.error("WhatsApp reply message error:", error);
      res.status(500).json({ error: error.message || "Failed to reply to message" });
    }
  });

  app.post("/api/whatsapp/messages/:messageId/forward", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const { messageId } = req.params;
      const { targetJids } = req.body;
      
      if (!targetJids || !Array.isArray(targetJids) || targetJids.length === 0) {
        return res.status(400).json({ error: "targetJids array is required" });
      }
      
      await whatsappService.forwardMessage(userId, messageId, targetJids);
      res.json({ success: true });
    } catch (error: any) {
      console.error("WhatsApp forward message error:", error);
      res.status(500).json({ error: error.message || "Failed to forward message" });
    }
  });

  app.post("/api/whatsapp/contacts/sync", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const count = await whatsappService.syncContacts(userId);
      res.json({ success: true, syncedCount: count });
    } catch (error: any) {
      console.error("WhatsApp sync contacts error:", error);
      res.status(500).json({ error: error.message || "Failed to sync contacts" });
    }
  });

  app.post("/api/whatsapp/contacts", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const { name, phone, email, company, isLead, leadSource } = req.body;
      
      if (!name || !phone) {
        return res.status(400).json({ error: "name and phone are required" });
      }
      
      const result = await whatsappService.createContact(userId, {
        name,
        phone,
        email,
        company,
        isLead: isLead === true,
        leadSource: leadSource || "whatsapp",
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("WhatsApp create contact error:", error);
      res.status(500).json({ error: error.message || "Failed to create contact" });
    }
  });

  app.get("/api/whatsapp/contacts/search", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const query = req.query.q as string || "";
      
      if (!query) {
        const contacts = await whatsappService.getContacts(userId);
        return res.json(contacts);
      }
      
      const contacts = await whatsappService.searchContacts(userId, query);
      res.json(contacts);
    } catch (error: any) {
      console.error("WhatsApp search contacts error:", error);
      res.status(500).json({ error: error.message || "Failed to search contacts" });
    }
  });

  app.post("/api/whatsapp/tickets/:id/transfer", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const ticketId = parseInt(req.params.id);
      const { targetUserId, note } = req.body;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "targetUserId is required" });
      }
      
      await whatsappService.transferTicket(userId, ticketId, targetUserId, note);
      res.json({ success: true });
    } catch (error: any) {
      console.error("WhatsApp transfer ticket error:", error);
      res.status(500).json({ error: error.message || "Failed to transfer ticket" });
    }
  });

  app.post("/api/whatsapp/tickets/:id/forward-to-chat", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const ticketId = parseInt(req.params.id);
      const { targetUserIds, contextMessage } = req.body;
      
      if (!targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
        return res.status(400).json({ error: "targetUserIds array is required" });
      }
      
      const result = await whatsappService.forwardTicketToChat(userId, ticketId, targetUserIds, contextMessage);
      res.json({ success: true, threadId: result.threadId });
    } catch (error: any) {
      console.error("WhatsApp forward to chat error:", error);
      res.status(500).json({ error: error.message || "Failed to forward to chat" });
    }
  });

  app.post("/api/whatsapp/tickets/:id/send-media", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const ticketId = parseInt(req.params.id);
      const caption = req.body.caption as string | undefined;
      
      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }
      
      const filePath = req.file.path;
      const fileName = req.file.originalname;
      const mimeType = req.file.mimetype;
      
      await whatsappService.sendMedia(userId, ticketId, filePath, fileName, mimeType, caption);
      
      fs.unlinkSync(filePath);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("WhatsApp send media error:", error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: error.message || "Failed to send media" });
    }
  });
}
