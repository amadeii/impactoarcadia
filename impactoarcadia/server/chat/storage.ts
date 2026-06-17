import { db } from "../../db/index";
import { chatThreads, chatParticipants, chatMessages, users } from "@shared/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";

export const internalChatStorage = {
  async getUserThreads(userId: string) {
    const participantRows = await db
      .select({ threadId: chatParticipants.threadId })
      .from(chatParticipants)
      .where(eq(chatParticipants.userId, userId));
    
    const threadIds = participantRows.map(r => r.threadId);
    if (threadIds.length === 0) return [];
    
    const threads = await db
      .select()
      .from(chatThreads)
      .where(inArray(chatThreads.id, threadIds))
      .orderBy(desc(chatThreads.latestMessageAt));
    
    const threadsWithDetails = await Promise.all(threads.map(async (thread) => {
      const participants = await db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
        })
        .from(chatParticipants)
        .innerJoin(users, eq(chatParticipants.userId, users.id))
        .where(eq(chatParticipants.threadId, thread.id));
      
      const [lastMessage] = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.threadId, thread.id))
        .orderBy(desc(chatMessages.sentAt))
        .limit(1);
      
      const unreadCount = await this.getUnreadCount(thread.id, userId);
      
      return {
        ...thread,
        participants,
        lastMessage,
        unreadCount,
      };
    }));
    
    return threadsWithDetails;
  },

  async getThread(threadId: number) {
    const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId));
    return thread;
  },

  async getThreadParticipants(threadId: number) {
    return db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
      })
      .from(chatParticipants)
      .innerJoin(users, eq(chatParticipants.userId, users.id))
      .where(eq(chatParticipants.threadId, threadId));
  },

  async isUserInThread(userId: string, threadId: number): Promise<boolean> {
    const [participant] = await db
      .select()
      .from(chatParticipants)
      .where(and(
        eq(chatParticipants.userId, userId),
        eq(chatParticipants.threadId, threadId)
      ));
    return !!participant;
  },

  async createDirectThread(userId1: string, userId2: string) {
    const existingThread = await this.findDirectThread(userId1, userId2);
    if (existingThread) return existingThread;

    const [thread] = await db.insert(chatThreads).values({
      type: "direct",
      createdBy: userId1,
    }).returning();

    await db.insert(chatParticipants).values([
      { threadId: thread.id, userId: userId1 },
      { threadId: thread.id, userId: userId2 },
    ]);

    return thread;
  },

  async findDirectThread(userId1: string, userId2: string) {
    const user1Threads = await db
      .select({ threadId: chatParticipants.threadId })
      .from(chatParticipants)
      .where(eq(chatParticipants.userId, userId1));
    
    const user2Threads = await db
      .select({ threadId: chatParticipants.threadId })
      .from(chatParticipants)
      .where(eq(chatParticipants.userId, userId2));
    
    const user1ThreadIds = new Set(user1Threads.map(t => t.threadId));
    const commonThreadIds = user2Threads
      .filter(t => user1ThreadIds.has(t.threadId))
      .map(t => t.threadId);
    
    if (commonThreadIds.length === 0) return null;

    const [directThread] = await db
      .select()
      .from(chatThreads)
      .where(and(
        inArray(chatThreads.id, commonThreadIds),
        eq(chatThreads.type, "direct")
      ));
    
    return directThread || null;
  },

  async createGroupThread(name: string, creatorId: string, memberIds: string[]) {
    const [thread] = await db.insert(chatThreads).values({
      type: "group",
      name,
      createdBy: creatorId,
    }).returning();

    const allMemberIds = [...new Set([creatorId, ...memberIds])];
    await db.insert(chatParticipants).values(
      allMemberIds.map(userId => ({
        threadId: thread.id,
        userId,
        role: userId === creatorId ? "admin" : "member",
      }))
    );

    return thread;
  },

  async getThreadMessages(threadId: number, limit = 50, before?: number) {
    let query = db
      .select({
        id: chatMessages.id,
        threadId: chatMessages.threadId,
        senderId: chatMessages.senderId,
        body: chatMessages.body,
        messageType: chatMessages.messageType,
        status: chatMessages.status,
        sentAt: chatMessages.sentAt,
        editedAt: chatMessages.editedAt,
        senderName: users.name,
        senderUsername: users.username,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.senderId, users.id))
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(desc(chatMessages.sentAt))
      .limit(limit);

    const messages = await query;
    return messages.reverse();
  },

  async createMessage(threadId: number, senderId: string, body: string, messageType = "text") {
    const [message] = await db.insert(chatMessages).values({
      threadId,
      senderId,
      body,
      messageType,
    }).returning();

    await db.update(chatThreads)
      .set({ latestMessageAt: new Date() })
      .where(eq(chatThreads.id, threadId));

    const [sender] = await db.select({ name: users.name, username: users.username })
      .from(users)
      .where(eq(users.id, senderId));

    return {
      ...message,
      senderName: sender?.name,
      senderUsername: sender?.username,
    };
  },

  async markAsRead(threadId: number, userId: string) {
    await db.update(chatParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(
        eq(chatParticipants.threadId, threadId),
        eq(chatParticipants.userId, userId)
      ));
  },

  async getUnreadCount(threadId: number, userId: string): Promise<number> {
    const [participant] = await db
      .select({ lastReadAt: chatParticipants.lastReadAt })
      .from(chatParticipants)
      .where(and(
        eq(chatParticipants.threadId, threadId),
        eq(chatParticipants.userId, userId)
      ));
    
    if (!participant?.lastReadAt) {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatMessages)
        .where(eq(chatMessages.threadId, threadId));
      return Number(result[0]?.count || 0);
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(and(
        eq(chatMessages.threadId, threadId),
        sql`${chatMessages.sentAt} > ${participant.lastReadAt}`
      ));
    
    return Number(result[0]?.count || 0);
  },

  async getAllUsers() {
    return db.select({
      id: users.id,
      username: users.username,
      name: users.name,
    }).from(users);
  },
};
