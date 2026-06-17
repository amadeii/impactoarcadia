import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { internalChatStorage } from "./storage";

interface SocketUser {
  id: string;
  username: string;
  socketId: string;
}

const onlineUsers = new Map<string, SocketUser>();
const userSockets = new Map<string, Set<string>>();

export function setupChatSocket(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("user:join", async (userData: { id: string; username: string }) => {
      const { id, username } = userData;
      
      onlineUsers.set(id, { id, username, socketId: socket.id });
      
      if (!userSockets.has(id)) {
        userSockets.set(id, new Set());
      }
      userSockets.get(id)!.add(socket.id);

      socket.data.userId = id;

      const threads = await internalChatStorage.getUserThreads(id);
      threads.forEach(thread => {
        socket.join(`thread:${thread.id}`);
      });

      io.emit("user:online", { userId: id, username });
      
      socket.emit("users:online", Array.from(onlineUsers.values()).map(u => ({
        userId: u.id,
        username: u.username,
      })));
    });

    socket.on("message:send", async (data: { threadId: number; body: string }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      try {
        const isParticipant = await internalChatStorage.isUserInThread(userId, data.threadId);
        if (!isParticipant) return;

        const message = await internalChatStorage.createMessage(data.threadId, userId, data.body);
        
        io.to(`thread:${data.threadId}`).emit("message:new", message);
      } catch (error) {
        console.error("Error sending message via socket:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("typing:start", (data: { threadId: number }) => {
      const userId = socket.data.userId;
      if (!userId) return;
      
      socket.to(`thread:${data.threadId}`).emit("typing:update", {
        threadId: data.threadId,
        userId,
        isTyping: true,
      });
    });

    socket.on("typing:stop", (data: { threadId: number }) => {
      const userId = socket.data.userId;
      if (!userId) return;
      
      socket.to(`thread:${data.threadId}`).emit("typing:update", {
        threadId: data.threadId,
        userId,
        isTyping: false,
      });
    });

    socket.on("thread:join", (threadId: number) => {
      socket.join(`thread:${threadId}`);
    });

    socket.on("thread:read", async (threadId: number) => {
      const userId = socket.data.userId;
      if (!userId) return;
      
      await internalChatStorage.markAsRead(threadId, userId);
    });

    socket.on("disconnect", () => {
      const userId = socket.data.userId;
      if (userId) {
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
            onlineUsers.delete(userId);
            io.emit("user:offline", { userId });
          }
        }
      }
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
}
