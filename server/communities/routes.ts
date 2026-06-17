import type { Express, Request, Response } from "express";
import { db } from "../../db/index";
import { 
  communities, communityChannels, communityMembers, communityMessages, users
} from "@shared/schema";
import { eq, desc, and, sql as sqlQuery } from "drizzle-orm";
import { z } from "zod";

const communitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  iconEmoji: z.string().max(10).optional(),
  iconColor: z.string().max(20).optional(),
  isPrivate: z.boolean().optional(),
});

const channelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(["text", "voice", "announcement"]).optional(),
  isPrivate: z.boolean().optional(),
  projectId: z.number().optional(),
});

const messageSchema = z.object({
  content: z.string().min(1),
  replyToId: z.number().optional(),
});

async function checkMembership(userId: string, communityId: number): Promise<{ isMember: boolean; role: string | null }> {
  const [member] = await db.select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(
      eq(communityMembers.communityId, communityId),
      eq(communityMembers.userId, userId)
    ))
    .limit(1);
  return { isMember: !!member, role: member?.role || null };
}

function canModerate(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "moderator";
}

export function registerCommunityRoutes(app: Express) {
  // ========== COMMUNITIES ==========

  // List communities for current user
  app.get("/api/communities", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userId = req.user!.id;

      // Get communities where user is a member
      const memberCommunities = await db
        .select({
          id: communities.id,
          name: communities.name,
          description: communities.description,
          iconEmoji: communities.iconEmoji,
          iconColor: communities.iconColor,
          isPrivate: communities.isPrivate,
          createdAt: communities.createdAt,
          role: communityMembers.role,
          status: communityMembers.status,
        })
        .from(communities)
        .innerJoin(communityMembers, eq(communities.id, communityMembers.communityId))
        .where(eq(communityMembers.userId, userId))
        .orderBy(desc(communities.createdAt));

      res.json(memberCommunities);
    } catch (error) {
      console.error("List communities error:", error);
      res.status(500).json({ error: "Failed to list communities" });
    }
  });

  // Create community
  app.post("/api/communities", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userId = req.user!.id;
      const data = communitySchema.parse(req.body);

      const [community] = await db.insert(communities).values({
        ...data,
        createdBy: userId,
      }).returning();

      // Add creator as owner member
      await db.insert(communityMembers).values({
        communityId: community.id,
        userId,
        role: "owner",
        status: "online",
      });

      // Create default general channel
      await db.insert(communityChannels).values({
        communityId: community.id,
        name: "geral",
        description: "Canal geral da comunidade",
        type: "text",
      });

      res.status(201).json(community);
    } catch (error: any) {
      console.error("Create community error:", error);
      res.status(400).json({ error: error.message || "Failed to create community" });
    }
  });

  // Get community details with channels and members
  app.get("/api/communities/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const communityId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check membership
      const { isMember } = await checkMembership(userId, communityId);
      if (!isMember) {
        return res.status(403).json({ error: "Not a member of this community" });
      }

      const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
      if (!community) {
        return res.status(404).json({ error: "Community not found" });
      }

      const channels = await db.select().from(communityChannels)
        .where(eq(communityChannels.communityId, communityId))
        .orderBy(communityChannels.orderIndex);

      const members = await db
        .select({
          id: communityMembers.id,
          userId: communityMembers.userId,
          role: communityMembers.role,
          nickname: communityMembers.nickname,
          status: communityMembers.status,
          statusMessage: communityMembers.statusMessage,
          joinedAt: communityMembers.joinedAt,
          lastActiveAt: communityMembers.lastActiveAt,
          username: users.username,
        })
        .from(communityMembers)
        .innerJoin(users, eq(communityMembers.userId, users.id))
        .where(eq(communityMembers.communityId, communityId));

      res.json({ ...community, channels, members });
    } catch (error) {
      console.error("Get community error:", error);
      res.status(500).json({ error: "Failed to get community" });
    }
  });

  // Delete community
  app.delete("/api/communities/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const communityId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check if user is owner
      const [member] = await db.select().from(communityMembers)
        .where(and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, userId),
          eq(communityMembers.role, "owner")
        )).limit(1);

      if (!member) {
        return res.status(403).json({ error: "Only owners can delete communities" });
      }

      await db.delete(communities).where(eq(communities.id, communityId));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete community error:", error);
      res.status(500).json({ error: "Failed to delete community" });
    }
  });

  // ========== CHANNELS ==========

  // Create channel (admin+ only)
  app.post("/api/communities/:id/channels", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const communityId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check if user can moderate
      const { isMember, role } = await checkMembership(userId, communityId);
      if (!isMember || !canModerate(role)) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const data = channelSchema.parse(req.body);

      const [channel] = await db.insert(communityChannels).values({
        ...data,
        communityId,
      }).returning();

      res.status(201).json(channel);
    } catch (error: any) {
      console.error("Create channel error:", error);
      res.status(400).json({ error: error.message || "Failed to create channel" });
    }
  });

  // Delete channel (admin+ only)
  app.delete("/api/communities/:id/channels/:channelId", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const communityId = parseInt(req.params.id);
      const channelId = parseInt(req.params.channelId);
      const userId = req.user!.id;

      // Check if user can moderate
      const { isMember, role } = await checkMembership(userId, communityId);
      if (!isMember || !canModerate(role)) {
        return res.status(403).json({ error: "Permission denied" });
      }

      await db.delete(communityChannels).where(eq(communityChannels.id, channelId));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete channel error:", error);
      res.status(500).json({ error: "Failed to delete channel" });
    }
  });

  // ========== MEMBERS ==========

  // Add member to community (admin+ only)
  app.post("/api/communities/:id/members", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const communityId = parseInt(req.params.id);
      const currentUserId = req.user!.id;
      const { userId, role = "member" } = req.body;

      // Check if current user can add members
      const { isMember, role: userRole } = await checkMembership(currentUserId, communityId);
      if (!isMember || !canModerate(userRole)) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const [member] = await db.insert(communityMembers).values({
        communityId,
        userId,
        role,
        status: "offline",
      }).returning();

      res.status(201).json(member);
    } catch (error: any) {
      console.error("Add member error:", error);
      res.status(400).json({ error: error.message || "Failed to add member" });
    }
  });

  // Update member status (online/offline)
  app.patch("/api/communities/:id/members/status", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const communityId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { status, statusMessage } = req.body;

      await db.update(communityMembers)
        .set({ 
          status, 
          statusMessage,
          lastActiveAt: new Date(),
        })
        .where(and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, userId)
        ));

      res.json({ success: true });
    } catch (error) {
      console.error("Update status error:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // Remove member from community (admin+ or self-leave)
  app.delete("/api/communities/:id/members/:memberId", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const communityId = parseInt(req.params.id);
      const memberId = parseInt(req.params.memberId);
      const currentUserId = req.user!.id;

      // Get the member being removed
      const [targetMember] = await db.select()
        .from(communityMembers)
        .where(and(
          eq(communityMembers.id, memberId),
          eq(communityMembers.communityId, communityId)
        ))
        .limit(1);

      if (!targetMember) {
        return res.status(404).json({ error: "Member not found" });
      }

      // Check if current user is the target (self-leave)
      const isSelfLeave = targetMember.userId === currentUserId;

      if (!isSelfLeave) {
        // Check if current user can remove members
        const { isMember, role } = await checkMembership(currentUserId, communityId);
        if (!isMember || !canModerate(role)) {
          return res.status(403).json({ error: "Permission denied" });
        }

        // Cannot remove owner
        if (targetMember.role === "owner") {
          return res.status(403).json({ error: "Cannot remove community owner" });
        }
      }

      await db.delete(communityMembers).where(eq(communityMembers.id, memberId));
      res.json({ success: true });
    } catch (error) {
      console.error("Remove member error:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  // ========== MESSAGES ==========

  // Helper: verify channel belongs to community
  async function verifyChannelInCommunity(channelId: number, communityId: number): Promise<boolean> {
    const [channel] = await db.select()
      .from(communityChannels)
      .where(and(
        eq(communityChannels.id, channelId),
        eq(communityChannels.communityId, communityId)
      ))
      .limit(1);
    return !!channel;
  }

  // Get messages from a channel
  app.get("/api/communities/:id/channels/:channelId/messages", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const communityId = parseInt(req.params.id);
      const channelId = parseInt(req.params.channelId);
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 50;

      // Verify membership
      const { isMember } = await checkMembership(userId, communityId);
      if (!isMember) {
        return res.status(403).json({ error: "Not a member of this community" });
      }

      // Verify channel belongs to community
      const validChannel = await verifyChannelInCommunity(channelId, communityId);
      if (!validChannel) {
        return res.status(404).json({ error: "Channel not found in this community" });
      }

      const messages = await db
        .select({
          id: communityMessages.id,
          content: communityMessages.content,
          userId: communityMessages.userId,
          channelId: communityMessages.channelId,
          replyToId: communityMessages.replyToId,
          isPinned: communityMessages.isPinned,
          createdAt: communityMessages.createdAt,
          username: users.username,
        })
        .from(communityMessages)
        .innerJoin(users, eq(communityMessages.userId, users.id))
        .where(eq(communityMessages.channelId, channelId))
        .orderBy(desc(communityMessages.createdAt))
        .limit(limit);

      res.json(messages.reverse());
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Send message to a channel
  app.post("/api/communities/:id/channels/:channelId/messages", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const communityId = parseInt(req.params.id);
      const channelId = parseInt(req.params.channelId);
      const userId = req.user!.id;
      const data = messageSchema.parse(req.body);

      // Verify membership
      const { isMember } = await checkMembership(userId, communityId);
      if (!isMember) {
        return res.status(403).json({ error: "Not a member of this community" });
      }

      // Verify channel belongs to community
      const validChannel = await verifyChannelInCommunity(channelId, communityId);
      if (!validChannel) {
        return res.status(404).json({ error: "Channel not found in this community" });
      }

      const [message] = await db.insert(communityMessages).values({
        channelId,
        userId,
        content: data.content,
        replyToId: data.replyToId,
      }).returning();

      res.status(201).json(message);
    } catch (error: any) {
      console.error("Send message error:", error);
      res.status(400).json({ error: error.message || "Failed to send message" });
    }
  });

  // Delete message (owner only)
  app.delete("/api/communities/:id/channels/:channelId/messages/:messageId", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const communityId = parseInt(req.params.id);
      const channelId = parseInt(req.params.channelId);
      const messageId = parseInt(req.params.messageId);
      const userId = req.user!.id;

      // Verify membership
      const { isMember, role } = await checkMembership(userId, communityId);
      if (!isMember) {
        return res.status(403).json({ error: "Not a member of this community" });
      }

      // Verify channel belongs to community
      const validChannel = await verifyChannelInCommunity(channelId, communityId);
      if (!validChannel) {
        return res.status(404).json({ error: "Channel not found in this community" });
      }

      // Verify message exists and user can delete it
      const [message] = await db.select()
        .from(communityMessages)
        .where(eq(communityMessages.id, messageId))
        .limit(1);

      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Only message owner or moderators can delete
      if (message.userId !== userId && !canModerate(role)) {
        return res.status(403).json({ error: "Cannot delete this message" });
      }

      await db.delete(communityMessages).where(eq(communityMessages.id, messageId));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete message error:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // Get all users (for adding members)
  app.get("/api/communities/users/search", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const query = (req.query.q as string) || "";

      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
      }).from(users).limit(50);

      const filtered = query 
        ? allUsers.filter(u => 
            u.username?.toLowerCase().includes(query.toLowerCase()) ||
            u.email?.toLowerCase().includes(query.toLowerCase())
          )
        : allUsers;

      res.json(filtered);
    } catch (error) {
      console.error("Search users error:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });
}
