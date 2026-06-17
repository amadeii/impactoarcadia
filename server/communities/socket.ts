import { Server as HttpServer, IncomingMessage } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { db } from "../../db/index";
import { communityMembers, communityMessages, communityChannels, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { sessionMiddleware } from "../auth";
import passport from "passport";

interface CommunityUser {
  id: string;
  username: string;
  socketId: string;
  status: "online" | "away" | "busy" | "offline";
}

interface AuthenticatedRequest extends IncomingMessage {
  user?: { id: string; username: string };
  session?: any;
}

const communityUsers = new Map<string, CommunityUser>();
const userSockets = new Map<string, Set<string>>();

async function checkMembership(userId: string, communityId: number): Promise<boolean> {
  const [member] = await db.select()
    .from(communityMembers)
    .where(and(
      eq(communityMembers.communityId, communityId),
      eq(communityMembers.userId, userId)
    ))
    .limit(1);
  return !!member;
}

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

async function updateMemberStatus(userId: string, status: "online" | "away" | "busy" | "offline") {
  await db.update(communityMembers)
    .set({ 
      status,
      lastActiveAt: new Date(),
    })
    .where(eq(communityMembers.userId, userId));
}

export function setupCommunitySocket(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    path: "/community-socket",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Use Express session middleware with Socket.io
  io.engine.use(sessionMiddleware);
  io.engine.use(passport.initialize());
  io.engine.use(passport.session());

  io.on("connection", (socket: Socket) => {
    console.log("Community socket connected:", socket.id);

    // Get authenticated user from session
    const req = socket.request as AuthenticatedRequest;
    const sessionUser = req.user;
    
    // Reject unauthenticated connections
    if (!sessionUser || !sessionUser.id) {
      console.log("Community socket: Unauthenticated connection rejected");
      socket.emit("error", { message: "Not authenticated" });
      socket.disconnect();
      return;
    }

    // Store user info in socket data immediately (server-side only)
    socket.data.userId = sessionUser.id;
    socket.data.username = sessionUser.username;

    socket.on("user:join", async () => {
      const id = socket.data.userId;
      const username = socket.data.username;
      
      // User is already authenticated via session
      communityUsers.set(id, { id, username, socketId: socket.id, status: "online" });
      
      if (!userSockets.has(id)) {
        userSockets.set(id, new Set());
      }
      userSockets.get(id)!.add(socket.id);

      await updateMemberStatus(id, "online");

      io.emit("user:status", { userId: id, username, status: "online" });
      
      socket.emit("users:online", Array.from(communityUsers.values()).map(u => ({
        userId: u.id,
        username: u.username,
        status: u.status,
      })));
    });

    socket.on("channel:join", async (data: { communityId: number; channelId: number }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      const isMember = await checkMembership(userId, data.communityId);
      if (!isMember) {
        socket.emit("error", { message: "Not a member of this community" });
        return;
      }

      // Verify channel belongs to community
      const validChannel = await verifyChannelInCommunity(data.channelId, data.communityId);
      if (!validChannel) {
        socket.emit("error", { message: "Channel not found in this community" });
        return;
      }

      const roomName = `channel:${data.channelId}`;
      socket.join(roomName);
      socket.data.currentChannel = data.channelId;
      socket.data.currentCommunity = data.communityId;

      socket.to(roomName).emit("user:joined_channel", {
        userId,
        username: socket.data.username,
        channelId: data.channelId,
      });
    });

    socket.on("channel:leave", (data: { channelId: number }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      const roomName = `channel:${data.channelId}`;
      socket.leave(roomName);

      socket.to(roomName).emit("user:left_channel", {
        userId,
        username: socket.data.username,
        channelId: data.channelId,
      });
    });

    socket.on("message:send", async (data: { channelId: number; content: string; replyToId?: number }) => {
      const userId = socket.data.userId;
      const communityId = socket.data.currentCommunity;
      const currentChannel = socket.data.currentChannel;
      if (!userId || !communityId) return;

      // Verify user is sending to the channel they joined
      if (data.channelId !== currentChannel) {
        socket.emit("error", { message: "Cannot send to this channel" });
        return;
      }

      try {
        const isMember = await checkMembership(userId, communityId);
        if (!isMember) {
          socket.emit("error", { message: "Not a member" });
          return;
        }

        // Verify channel belongs to community
        const validChannel = await verifyChannelInCommunity(data.channelId, communityId);
        if (!validChannel) {
          socket.emit("error", { message: "Channel not found in this community" });
          return;
        }

        const [message] = await db.insert(communityMessages).values({
          channelId: data.channelId,
          userId,
          content: data.content,
          replyToId: data.replyToId,
        }).returning();

        const [user] = await db.select({ username: users.username })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const fullMessage = {
          ...message,
          username: user?.username || "Unknown",
        };

        io.to(`channel:${data.channelId}`).emit("message:new", fullMessage);

        await updateMemberStatus(userId, "online");
      } catch (error) {
        console.error("Error sending community message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("message:edit", async (data: { messageId: number; content: string }) => {
      const userId = socket.data.userId;
      const communityId = socket.data.currentCommunity;
      const currentChannel = socket.data.currentChannel;
      if (!userId || !communityId) return;

      try {
        // Verify membership
        const isMember = await checkMembership(userId, communityId);
        if (!isMember) {
          socket.emit("error", { message: "Not a member" });
          return;
        }

        const [existingMessage] = await db.select()
          .from(communityMessages)
          .where(eq(communityMessages.id, data.messageId))
          .limit(1);

        if (!existingMessage) {
          socket.emit("error", { message: "Message not found" });
          return;
        }

        // Verify message is in current channel
        if (existingMessage.channelId !== currentChannel) {
          socket.emit("error", { message: "Cannot edit message from another channel" });
          return;
        }

        // Only message owner can edit
        if (existingMessage.userId !== userId) {
          socket.emit("error", { message: "Cannot edit this message" });
          return;
        }

        await db.update(communityMessages)
          .set({ 
            content: data.content,
            editedAt: new Date(),
          })
          .where(eq(communityMessages.id, data.messageId));

        io.to(`channel:${existingMessage.channelId}`).emit("message:edited", {
          messageId: data.messageId,
          content: data.content,
          editedAt: new Date(),
        });
      } catch (error) {
        console.error("Error editing message:", error);
        socket.emit("error", { message: "Failed to edit message" });
      }
    });

    socket.on("message:delete", async (data: { messageId: number }) => {
      const userId = socket.data.userId;
      const communityId = socket.data.currentCommunity;
      const currentChannel = socket.data.currentChannel;
      if (!userId || !communityId) return;

      try {
        // Verify membership and get role
        const [member] = await db.select({ role: communityMembers.role })
          .from(communityMembers)
          .where(and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, userId)
          ))
          .limit(1);

        if (!member) {
          socket.emit("error", { message: "Not a member" });
          return;
        }

        const [existingMessage] = await db.select()
          .from(communityMessages)
          .where(eq(communityMessages.id, data.messageId))
          .limit(1);

        if (!existingMessage) {
          socket.emit("error", { message: "Message not found" });
          return;
        }

        // Verify message is in current channel
        if (existingMessage.channelId !== currentChannel) {
          socket.emit("error", { message: "Cannot delete message from another channel" });
          return;
        }

        // Only message owner or moderators can delete
        const canModerate = member.role === "owner" || member.role === "admin" || member.role === "moderator";
        if (existingMessage.userId !== userId && !canModerate) {
          socket.emit("error", { message: "Cannot delete this message" });
          return;
        }

        await db.delete(communityMessages).where(eq(communityMessages.id, data.messageId));

        io.to(`channel:${existingMessage.channelId}`).emit("message:deleted", {
          messageId: data.messageId,
        });
      } catch (error) {
        console.error("Error deleting message:", error);
        socket.emit("error", { message: "Failed to delete message" });
      }
    });

    socket.on("typing:start", (data: { channelId: number }) => {
      const userId = socket.data.userId;
      if (!userId) return;
      
      socket.to(`channel:${data.channelId}`).emit("typing:update", {
        channelId: data.channelId,
        userId,
        username: socket.data.username,
        isTyping: true,
      });
    });

    socket.on("typing:stop", (data: { channelId: number }) => {
      const userId = socket.data.userId;
      if (!userId) return;
      
      socket.to(`channel:${data.channelId}`).emit("typing:update", {
        channelId: data.channelId,
        userId,
        username: socket.data.username,
        isTyping: false,
      });
    });

    socket.on("status:update", async (data: { status: "online" | "away" | "busy" | "offline"; statusMessage?: string }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      const user = communityUsers.get(userId);
      if (user) {
        user.status = data.status;
        communityUsers.set(userId, user);
      }

      await updateMemberStatus(userId, data.status);

      io.emit("user:status", {
        userId,
        username: socket.data.username,
        status: data.status,
        statusMessage: data.statusMessage,
      });
    });

    socket.on("disconnect", async () => {
      const userId = socket.data.userId;
      if (userId) {
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
            communityUsers.delete(userId);
            await updateMemberStatus(userId, "offline");
            io.emit("user:status", { userId, status: "offline" });
          }
        }
      }
      console.log("Community socket disconnected:", socket.id);
    });
  });

  return io;
}
