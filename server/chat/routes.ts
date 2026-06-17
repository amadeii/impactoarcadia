import type { Express, Request, Response } from "express";
import { internalChatStorage } from "./storage";

export function registerInternalChatRoutes(app: Express): void {
  app.get("/api/chat/threads", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const threads = await internalChatStorage.getUserThreads(req.user!.id);
      res.json(threads);
    } catch (error) {
      console.error("Error fetching threads:", error);
      res.status(500).json({ error: "Failed to fetch threads" });
    }
  });

  app.get("/api/chat/threads/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const threadId = parseInt(req.params.id);
      const userId = req.user!.id;

      const isParticipant = await internalChatStorage.isUserInThread(userId, threadId);
      if (!isParticipant) {
        return res.status(403).json({ error: "Access denied" });
      }

      const thread = await internalChatStorage.getThread(threadId);
      const participants = await internalChatStorage.getThreadParticipants(threadId);
      const messages = await internalChatStorage.getThreadMessages(threadId);

      res.json({ ...thread, participants, messages });
    } catch (error) {
      console.error("Error fetching thread:", error);
      res.status(500).json({ error: "Failed to fetch thread" });
    }
  });

  app.post("/api/chat/threads/direct", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { userId: targetUserId } = req.body;
      if (!targetUserId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const thread = await internalChatStorage.createDirectThread(req.user!.id, targetUserId);
      res.status(201).json(thread);
    } catch (error) {
      console.error("Error creating direct thread:", error);
      res.status(500).json({ error: "Failed to create thread" });
    }
  });

  app.post("/api/chat/threads/group", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { name, memberIds } = req.body;
      if (!name || !memberIds || !Array.isArray(memberIds)) {
        return res.status(400).json({ error: "name and memberIds are required" });
      }

      const thread = await internalChatStorage.createGroupThread(name, req.user!.id, memberIds);
      res.status(201).json(thread);
    } catch (error) {
      console.error("Error creating group thread:", error);
      res.status(500).json({ error: "Failed to create group" });
    }
  });

  app.get("/api/chat/threads/:id/messages", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const threadId = parseInt(req.params.id);
      const userId = req.user!.id;

      const isParticipant = await internalChatStorage.isUserInThread(userId, threadId);
      if (!isParticipant) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await internalChatStorage.getThreadMessages(threadId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/chat/threads/:id/messages", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const threadId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { body } = req.body;

      if (!body || !body.trim()) {
        return res.status(400).json({ error: "Message body is required" });
      }

      const isParticipant = await internalChatStorage.isUserInThread(userId, threadId);
      if (!isParticipant) {
        return res.status(403).json({ error: "Access denied" });
      }

      const message = await internalChatStorage.createMessage(threadId, userId, body);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.post("/api/chat/threads/:id/read", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const threadId = parseInt(req.params.id);
      const userId = req.user!.id;

      await internalChatStorage.markAsRead(threadId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking as read:", error);
      res.status(500).json({ error: "Failed to mark as read" });
    }
  });

  app.get("/api/chat/users", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const allUsers = await internalChatStorage.getAllUsers();
      const otherUsers = allUsers.filter(u => u.id !== req.user!.id);
      res.json(otherUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
}
