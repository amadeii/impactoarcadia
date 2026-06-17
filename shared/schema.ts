import { sql } from "drizzle-orm";
import { pgTable, text, varchar, primaryKey, serial, integer, smallint, timestamp, numeric, jsonb, boolean, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-exportar schemas modulares criados pelo Dev Center
export * from "./schemas/index";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  role: text("role").default("user"),
  profileId: integer("profile_id"),
  partnerId: integer("partner_id"),
  collaboratorType: text("collaborator_type"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).default("0"),
  skills: text("skills").array(),
  status: text("status").default("active"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  type: text("type").notNull().default("custom"),
  allowedModules: text("allowed_modules").array(),
  isSystem: integer("is_system").default(0),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, createdAt: true, updatedAt: true });
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
  profileId: true,
  partnerId: true,
  status: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  icon: text("icon").notNull(),
  status: text("status").notNull(),
  url: text("url"),
  description: text("description"),
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
});

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applications.$inferSelect;

export const userApplications = pgTable("user_applications", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.applicationId] }),
}));

export const insertUserApplicationSchema = createInsertSchema(userApplications);
export type InsertUserApplication = z.infer<typeof insertUserApplicationSchema>;
export type UserApplication = typeof userApplications.$inferSelect;

// ========== RBAC - Roles & Permissions ==========
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isSystem: integer("is_system").default(0), // 1 = system role (admin, user), can't be deleted
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g., "compass.clients.read", "agent.chat.write"
  name: text("name").notNull(),
  description: text("description"),
  module: text("module").notNull(), // agent, compass, insights, manus, whatsapp, admin
  action: text("action").notNull(), // read, write, delete, admin
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}));

export const userRoles = pgTable("user_roles", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
}));

// Module access control - which modules each user can access
export const moduleAccess = pgTable("module_access", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  module: text("module").notNull(), // home, agent, compass, insights, manus, whatsapp, admin
  canAccess: integer("can_access").default(1), // 1 = yes, 0 = no
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// External application permissions
export const externalAppPermissions = pgTable("external_app_permissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  appName: text("app_name").notNull(), // e.g., "erp_arcadia", "erp_totvs", "whatsapp"
  appUrl: text("app_url"),
  canAccess: integer("can_access").default(1),
  apiKeyId: text("api_key_id"), // reference to stored API key
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true });
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true });
export const insertRolePermissionSchema = createInsertSchema(rolePermissions);
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ assignedAt: true });
export const insertModuleAccessSchema = createInsertSchema(moduleAccess).omit({ id: true, createdAt: true });
export const insertExternalAppPermissionSchema = createInsertSchema(externalAppPermissions).omit({ id: true, createdAt: true });

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type ModuleAccess = typeof moduleAccess.$inferSelect;
export type InsertModuleAccess = z.infer<typeof insertModuleAccessSchema>;
export type ExternalAppPermission = typeof externalAppPermissions.$inferSelect;
export type InsertExternalAppPermission = z.infer<typeof insertExternalAppPermissionSchema>;

// ========== PRODUCTIVITY HUB - Pages & Blocks (Notion-style) ==========
export const workspacePages = pgTable("workspace_pages", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"), // for nested pages
  title: text("title").notNull().default("Sem título"),
  icon: text("icon"), // emoji or icon name
  coverImage: text("cover_image"),
  isPublic: integer("is_public").default(0),
  isFavorite: integer("is_favorite").default(0),
  isArchived: integer("is_archived").default(0),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const pageBlocks = pgTable("page_blocks", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => workspacePages.id, { onDelete: "cascade" }),
  parentBlockId: integer("parent_block_id"), // for nested blocks
  type: text("type").notNull(), // text, heading1, heading2, heading3, bullet, numbered, todo, toggle, quote, callout, divider, code, image, table, embed, link_preview
  content: text("content"), // JSON content based on type
  properties: text("properties"), // JSON for additional properties (checked, collapsed, etc.)
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Bidirectional links between pages/blocks
export const pageLinks = pgTable("page_links", {
  id: serial("id").primaryKey(),
  sourcePageId: integer("source_page_id").notNull().references(() => workspacePages.id, { onDelete: "cascade" }),
  targetPageId: integer("target_page_id").notNull().references(() => workspacePages.id, { onDelete: "cascade" }),
  blockId: integer("block_id").references(() => pageBlocks.id, { onDelete: "cascade" }), // optional: which block contains the link
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== WIDGETS & DASHBOARD ==========
export const dashboardWidgets = pgTable("dashboard_widgets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // tasks, calendar, recent_activity, quick_notes, weather, clock, pomodoro, favorites, inbox
  title: text("title"),
  config: text("config"), // JSON configuration
  position: text("position"), // JSON {x, y, w, h} for grid layout
  isVisible: integer("is_visible").default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== QUICK NOTES (Scratch Pad) ==========
export const quickNotes = pgTable("quick_notes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isPinned: integer("is_pinned").default(0),
  color: text("color"), // for visual distinction
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== UNIFIED INBOX / ACTIVITY FEED ==========
export const activityFeed = pgTable("activity_feed", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id").references(() => users.id), // who performed the action
  type: text("type").notNull(), // created, updated, deleted, mentioned, assigned, completed, commented
  module: text("module").notNull(), // compass, agent, insights, manus, whatsapp, workspace
  entityType: text("entity_type").notNull(), // client, project, task, page, conversation, etc.
  entityId: text("entity_id").notNull(),
  entityTitle: text("entity_title"),
  description: text("description"),
  metadata: text("metadata"), // JSON for additional context
  isRead: integer("is_read").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== FAVORITES / BOOKMARKS ==========
export const userFavorites = pgTable("user_favorites", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  entityTitle: text("entity_title"),
  entityIcon: text("entity_icon"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== COMMAND HISTORY (for command palette) ==========
export const commandHistory = pgTable("command_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  command: text("command").notNull(),
  frequency: integer("frequency").default(1),
  lastUsedAt: timestamp("last_used_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertWorkspacePageSchema = createInsertSchema(workspacePages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPageBlockSchema = createInsertSchema(pageBlocks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPageLinkSchema = createInsertSchema(pageLinks).omit({ id: true, createdAt: true });
export const insertDashboardWidgetSchema = createInsertSchema(dashboardWidgets).omit({ id: true, createdAt: true });
export const insertQuickNoteSchema = createInsertSchema(quickNotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivityFeedSchema = createInsertSchema(activityFeed).omit({ id: true, createdAt: true });
export const insertUserFavoriteSchema = createInsertSchema(userFavorites).omit({ id: true, createdAt: true });
export const insertCommandHistorySchema = createInsertSchema(commandHistory).omit({ id: true, lastUsedAt: true });

export type WorkspacePage = typeof workspacePages.$inferSelect;
export type InsertWorkspacePage = z.infer<typeof insertWorkspacePageSchema>;
export type PageBlock = typeof pageBlocks.$inferSelect;
export type InsertPageBlock = z.infer<typeof insertPageBlockSchema>;
export type PageLink = typeof pageLinks.$inferSelect;
export type InsertPageLink = z.infer<typeof insertPageLinkSchema>;
export type DashboardWidget = typeof dashboardWidgets.$inferSelect;
export type InsertDashboardWidget = z.infer<typeof insertDashboardWidgetSchema>;
export type QuickNote = typeof quickNotes.$inferSelect;
export type InsertQuickNote = z.infer<typeof insertQuickNoteSchema>;
export type ActivityFeedEntry = typeof activityFeed.$inferSelect;
export type InsertActivityFeedEntry = z.infer<typeof insertActivityFeedSchema>;
export type UserFavorite = typeof userFavorites.$inferSelect;
export type InsertUserFavorite = z.infer<typeof insertUserFavoriteSchema>;
export type CommandHistoryEntry = typeof commandHistory.$inferSelect;
export type InsertCommandHistoryEntry = z.infer<typeof insertCommandHistorySchema>;

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  interactionId: integer("interaction_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull(),
  category: text("category").notNull(),
  source: text("source"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).omit({
  id: true,
  createdAt: true,
});

export type KnowledgeBaseEntry = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBaseEntry = z.infer<typeof insertKnowledgeBaseSchema>;

export const chatAttachments = pgTable("chat_attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => messages.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileContent: text("file_content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertChatAttachmentSchema = createInsertSchema(chatAttachments).omit({
  id: true,
  createdAt: true,
});

export type ChatAttachment = typeof chatAttachments.$inferSelect;
export type InsertChatAttachment = z.infer<typeof insertChatAttachmentSchema>;

export const erpConnections = pgTable("erp_connections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  username: text("username"),
  password: text("password"),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertErpConnectionSchema = createInsertSchema(erpConnections).omit({
  id: true,
  createdAt: true,
});

export type ErpConnection = typeof erpConnections.$inferSelect;
export type InsertErpConnection = z.infer<typeof insertErpConnectionSchema>;

export const agentTasks = pgTable("agent_tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  schedule: text("schedule"),
  erpConnectionId: integer("erp_connection_id").references(() => erpConnections.id, { onDelete: "cascade" }),
  config: text("config"),
  status: text("status").default("active"),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAgentTaskSchema = createInsertSchema(agentTasks).omit({
  id: true,
  createdAt: true,
  lastRun: true,
  nextRun: true,
});

export type AgentTask = typeof agentTasks.$inferSelect;
export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;

export const taskExecutions = pgTable("task_executions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => agentTasks.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  result: text("result"),
  error: text("error"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertTaskExecutionSchema = createInsertSchema(taskExecutions).omit({
  id: true,
  startedAt: true,
});

export type TaskExecution = typeof taskExecutions.$inferSelect;
export type InsertTaskExecution = z.infer<typeof insertTaskExecutionSchema>;

export const chatThreads = pgTable("chat_threads", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("direct"),
  name: text("name"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  latestMessageAt: timestamp("latest_message_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const chatParticipants = pgTable("chat_participants", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("member"),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastReadAt: timestamp("last_read_at"),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  messageType: text("message_type").default("text"),
  status: text("status").default("sent"),
  sentAt: timestamp("sent_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  editedAt: timestamp("edited_at"),
});

export const whatsappSessions = pgTable("whatsapp_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionData: text("session_data"),
  status: text("status").default("disconnected"),
  phoneNumber: text("phone_number"),
  lastSync: timestamp("last_sync"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const whatsappContacts = pgTable("whatsapp_contacts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  whatsappId: text("whatsapp_id").notNull(),
  name: text("name"),
  pushName: text("push_name"),
  phoneNumber: text("phone_number"),
  profilePicUrl: text("profile_pic_url"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  whatsappContactId: integer("whatsapp_contact_id").references(() => whatsappContacts.id, { onDelete: "cascade" }),
  remoteJid: text("remote_jid").notNull(),
  messageId: text("message_id").notNull(),
  fromMe: text("from_me").default("false"),
  body: text("body"),
  messageType: text("message_type").default("text"),
  timestamp: timestamp("timestamp").notNull(),
  status: text("status").default("received"),
  quotedMessageId: text("quoted_message_id"),
  quotedBody: text("quoted_body"),
  isDeleted: integer("is_deleted").default(0),
  isEdited: integer("is_edited").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertChatThreadSchema = createInsertSchema(chatThreads).omit({ id: true, createdAt: true });
export const insertChatParticipantSchema = createInsertSchema(chatParticipants).omit({ id: true, joinedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, sentAt: true });
// WhatsApp Queues (Filas de Atendimento)
export const whatsappQueues = pgTable("whatsapp_queues", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").default("#10B981"),
  greeting: text("greeting"),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// WhatsApp Tickets (Atendimentos)
export const whatsappTickets = pgTable("whatsapp_tickets", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull().references(() => whatsappContacts.id, { onDelete: "cascade" }),
  queueId: integer("queue_id").references(() => whatsappQueues.id, { onDelete: "set null" }),
  assignedToId: varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").default("open"),
  lastMessage: text("last_message"),
  unreadCount: integer("unread_count").default(0),
  protocol: text("protocol"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertWhatsappSessionSchema = createInsertSchema(whatsappSessions).omit({ id: true, createdAt: true });
export const insertWhatsappContactSchema = createInsertSchema(whatsappContacts).omit({ id: true, createdAt: true });
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({ id: true, createdAt: true });
export const insertWhatsappQueueSchema = createInsertSchema(whatsappQueues).omit({ id: true, createdAt: true });
export const insertWhatsappTicketSchema = createInsertSchema(whatsappTickets).omit({ id: true, createdAt: true, updatedAt: true });

export type ChatThread = typeof chatThreads.$inferSelect;
export type InsertChatThread = z.infer<typeof insertChatThreadSchema>;
export type ChatParticipant = typeof chatParticipants.$inferSelect;
export type InsertChatParticipant = z.infer<typeof insertChatParticipantSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type WhatsappSession = typeof whatsappSessions.$inferSelect;
export type InsertWhatsappSession = z.infer<typeof insertWhatsappSessionSchema>;
export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappQueue = typeof whatsappQueues.$inferSelect;
export type InsertWhatsappQueue = z.infer<typeof insertWhatsappQueueSchema>;
export type WhatsappTicket = typeof whatsappTickets.$inferSelect;
export type InsertWhatsappTicket = z.infer<typeof insertWhatsappTicketSchema>;

export const manusRuns = pgTable("manus_runs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  status: text("status").default("running"),
  result: text("result"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

export const manusSteps = pgTable("manus_steps", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull().references(() => manusRuns.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  thought: text("thought"),
  tool: text("tool"),
  toolInput: text("tool_input"),
  toolOutput: text("tool_output"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertManusRunSchema = createInsertSchema(manusRuns).omit({ id: true, createdAt: true });
export const insertManusStepSchema = createInsertSchema(manusSteps).omit({ id: true, createdAt: true });

export type ManusRun = typeof manusRuns.$inferSelect;
export type InsertManusRun = z.infer<typeof insertManusRunSchema>;
export type ManusStep = typeof manusSteps.$inferSelect;
export type InsertManusStep = z.infer<typeof insertManusStepSchema>;

// ========== Custom MCP Servers ==========
export const customMcpServers = pgTable("custom_mcp_servers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  transportType: text("transport_type").notNull().default("http"), // http, stdio
  serverUrl: text("server_url"), // For HTTP transport
  command: text("command"), // For STDIO transport
  args: text("args").array(), // For STDIO transport
  iconUrl: text("icon_url"),
  description: text("description"),
  customHeaders: jsonb("custom_headers"), // {key: value} for HTTP headers
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCustomMcpServerSchema = createInsertSchema(customMcpServers).omit({ id: true, createdAt: true, updatedAt: true });
export type CustomMcpServer = typeof customMcpServers.$inferSelect;
export type InsertCustomMcpServer = z.infer<typeof insertCustomMcpServerSchema>;

export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull(),
  triggerConfig: text("trigger_config"),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const automationActions = pgTable("automation_actions", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").notNull().references(() => automations.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  actionType: text("action_type").notNull(),
  actionConfig: text("action_config"),
  conditionConfig: text("condition_config"),
});

export const automationLogs = pgTable("automation_logs", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").notNull().references(() => automations.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  triggerData: text("trigger_data"),
  result: text("result"),
  error: text("error"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

export const scheduledTasks = pgTable("scheduled_tasks", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").references(() => automations.id, { onDelete: "cascade" }),
  cronExpression: text("cron_expression"),
  intervalMinutes: integer("interval_minutes"),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  isActive: text("is_active").default("true"),
});

export const insertAutomationSchema = createInsertSchema(automations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAutomationActionSchema = createInsertSchema(automationActions).omit({ id: true });
export const insertAutomationLogSchema = createInsertSchema(automationLogs).omit({ id: true, startedAt: true });
export const insertScheduledTaskSchema = createInsertSchema(scheduledTasks).omit({ id: true });

export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type AutomationAction = typeof automationActions.$inferSelect;
export type InsertAutomationAction = z.infer<typeof insertAutomationActionSchema>;
export type AutomationLog = typeof automationLogs.$inferSelect;
export type InsertAutomationLog = z.infer<typeof insertAutomationLogSchema>;
export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type InsertScheduledTask = z.infer<typeof insertScheduledTaskSchema>;

export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  host: text("host"),
  port: integer("port"),
  database: text("database"),
  username: text("username"),
  password: text("password"),
  connectionString: text("connection_string"),
  isActive: text("is_active").default("true"),
  lastTestedAt: timestamp("last_tested_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const biDatasets = pgTable("bi_datasets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dataSourceId: integer("data_source_id").references(() => dataSources.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  queryType: text("query_type").default("table"),
  tableName: text("table_name"),
  sqlQuery: text("sql_query"),
  columns: text("columns"),
  filters: text("filters"),
  isPublic: text("is_public").default("false"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const biCharts = pgTable("bi_charts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  datasetId: integer("dataset_id").references(() => biDatasets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  chartType: text("chart_type").notNull(),
  config: text("config"),
  xAxis: text("x_axis"),
  yAxis: text("y_axis"),
  groupBy: text("group_by"),
  aggregation: text("aggregation"),
  colors: text("colors"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const biDashboards = pgTable("bi_dashboards", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  layout: text("layout"),
  isPublic: text("is_public").default("false"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const biDashboardCharts = pgTable("bi_dashboard_charts", {
  id: serial("id").primaryKey(),
  dashboardId: integer("dashboard_id").notNull().references(() => biDashboards.id, { onDelete: "cascade" }),
  chartId: integer("chart_id").notNull().references(() => biCharts.id, { onDelete: "cascade" }),
  positionX: integer("position_x").default(0),
  positionY: integer("position_y").default(0),
  width: integer("width").default(6),
  height: integer("height").default(4),
});

export const backupJobs = pgTable("backup_jobs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dataSourceId: integer("data_source_id").references(() => dataSources.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  backupType: text("backup_type").notNull(),
  includeSchema: text("include_schema").default("true"),
  includeTables: text("include_tables"),
  excludeTables: text("exclude_tables"),
  compressionType: text("compression_type").default("gzip"),
  retentionDays: integer("retention_days").default(30),
  storageLocation: text("storage_location"),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const backupArtifacts = pgTable("backup_artifacts", {
  id: serial("id").primaryKey(),
  backupJobId: integer("backup_job_id").references(() => backupJobs.id, { onDelete: "cascade" }),
  automationLogId: integer("automation_log_id").references(() => automationLogs.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  checksum: text("checksum"),
  status: text("status").default("pending"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
});

// Data Staging for ERP Migration
export const stagedTables = pgTable("staged_tables", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(), // sql, mongodb, csv, json, zip
  sourceFile: text("source_file"),
  tableName: text("table_name").notNull(), // actual DB table name (staged_*)
  columns: text("columns"), // JSON array of column definitions
  rowCount: integer("row_count").default(0),
  status: text("status").default("ready"), // ready, mapped, migrating, migrated, error
  targetErp: text("target_erp"), // plus, next, totvs, sap
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const stagingMappings = pgTable("staging_mappings", {
  id: serial("id").primaryKey(),
  stagedTableId: integer("staged_table_id").references(() => stagedTables.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetErp: text("target_erp").notNull(), // plus, next, totvs, sap
  targetEntity: text("target_entity").notNull(), // customers, products, orders, etc.
  fieldMappings: text("field_mappings").notNull(), // JSON: {sourceField: targetField, transform?}
  filters: text("filters"), // JSON: conditions to filter data
  transformations: text("transformations"), // JSON: data transformations
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const etlMigrationJobs = pgTable("etl_migration_jobs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  stagedTableId: integer("staged_table_id").references(() => stagedTables.id, { onDelete: "cascade" }),
  mappingId: integer("mapping_id").references(() => stagingMappings.id, { onDelete: "cascade" }),
  erpConnectionId: integer("erp_connection_id").references(() => erpConnections.id, { onDelete: "set null" }),
  status: text("status").default("pending"), // pending, running, completed, failed, cancelled
  totalRecords: integer("total_records").default(0),
  processedRecords: integer("processed_records").default(0),
  successRecords: integer("success_records").default(0),
  errorRecords: integer("error_records").default(0),
  errorLog: text("error_log"), // JSON array of errors
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDataSourceSchema = createInsertSchema(dataSources).omit({ id: true, createdAt: true });
export const insertBiDatasetSchema = createInsertSchema(biDatasets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBiChartSchema = createInsertSchema(biCharts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBiDashboardSchema = createInsertSchema(biDashboards).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBiDashboardChartSchema = createInsertSchema(biDashboardCharts).omit({ id: true });
export const insertBackupJobSchema = createInsertSchema(backupJobs).omit({ id: true, createdAt: true });
export const insertBackupArtifactSchema = createInsertSchema(backupArtifacts).omit({ id: true, startedAt: true });
export const insertStagedTableSchema = createInsertSchema(stagedTables).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStagingMappingSchema = createInsertSchema(stagingMappings).omit({ id: true, createdAt: true });
export const insertEtlMigrationJobSchema = createInsertSchema(etlMigrationJobs).omit({ id: true, createdAt: true });

export type DataSource = typeof dataSources.$inferSelect;
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type BiDataset = typeof biDatasets.$inferSelect;
export type InsertBiDataset = z.infer<typeof insertBiDatasetSchema>;
export type BiChart = typeof biCharts.$inferSelect;
export type InsertBiChart = z.infer<typeof insertBiChartSchema>;
export type BiDashboard = typeof biDashboards.$inferSelect;
export type InsertBiDashboard = z.infer<typeof insertBiDashboardSchema>;
export type BiDashboardChart = typeof biDashboardCharts.$inferSelect;
export type InsertBiDashboardChart = z.infer<typeof insertBiDashboardChartSchema>;
export type BackupJob = typeof backupJobs.$inferSelect;
export type InsertBackupJob = z.infer<typeof insertBackupJobSchema>;
export type BackupArtifact = typeof backupArtifacts.$inferSelect;
export type InsertBackupArtifact = z.infer<typeof insertBackupArtifactSchema>;
export type StagedTable = typeof stagedTables.$inferSelect;
export type InsertStagedTable = z.infer<typeof insertStagedTableSchema>;
export type StagingMapping = typeof stagingMappings.$inferSelect;
export type InsertStagingMapping = z.infer<typeof insertStagingMappingSchema>;
export type EtlMigrationJob = typeof etlMigrationJobs.$inferSelect;
export type InsertEtlMigrationJob = z.infer<typeof insertEtlMigrationJobSchema>;

// ==========================================
// MULTI-TENANCY (SaaS) - Hierarquia Master/Partner/Client
// ==========================================

// Tipo de features disponíveis por tenant/plano
export type TenantFeatures = {
  ide: boolean;
  ideMode: 'none' | 'no-code' | 'low-code' | 'pro-code';
  whatsapp: boolean;
  whatsappSessions: number;
  crm: boolean;
  erp: boolean;
  bi: boolean;
  manus: boolean;
  manusTools: string[];
  centralApis: boolean;
  centralApisManage: boolean;
  comunidades: boolean;
  maxChannels: number;
  biblioteca: boolean;
  bibliotecaPublish: boolean;
  suporteN3: boolean;
  retail: boolean;
  plus: boolean;
  fisco: boolean;
  cockpit: boolean;
  compass: boolean;
  production: boolean;
  support: boolean;
  xosCrm: boolean;
};

// Tenants (Master/Parceiros/Clientes)
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  email: text("email"),
  phone: text("phone"),
  logoUrl: text("logo_url"),
  plan: text("plan").default("free"), // free, starter, pro, enterprise, partner_starter, partner_pro
  status: text("status").default("active"), // active, suspended, cancelled, trial
  settings: text("settings"), // JSON for tenant-specific settings
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  // Hierarquia de tenants
  tenantType: text("tenant_type").default("client"), // master, partner, client
  parentTenantId: integer("parent_tenant_id"), // Self-reference para hierarquia (parceiro ou master)
  // Informações de parceiro
  partnerCode: text("partner_code"), // Código único do parceiro
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }), // % de comissão (para parceiros)
  // Limites do plano
  maxUsers: integer("max_users").default(5),
  maxStorageMb: integer("max_storage_mb").default(1000),
  features: jsonb("features").$type<TenantFeatures>(),
  // Billing
  billingEmail: text("billing_email"),
  trialEndsAt: timestamp("trial_ends_at"),
  // Contato comercial
  commercialContact: text("commercial_contact"),
  commercialPhone: text("commercial_phone"),
  // Dados empresariais (unificado com CRM)
  cnpj: text("cnpj"),
  tradeName: text("trade_name"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  segment: text("segment"),
  notes: text("notes"),
  source: text("source"),
});

// Empresas do Tenant (Matriz + Filiais)
export const tenantEmpresas = pgTable("tenant_empresas", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  cnpj: text("cnpj").notNull(),
  ie: text("ie"),
  im: text("im"),
  email: text("email"),
  phone: text("phone"),
  tipo: text("tipo").default("filial"), // matriz, filial
  status: text("status").default("active"), // active, inactive
  cep: text("cep"),
  logradouro: text("logradouro"),
  numero: text("numero"),
  complemento: text("complemento"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  uf: text("uf"),
  codigoIbge: text("codigo_ibge"),
  // Fiscal
  regimeTributario: text("regime_tributario"), // simples, presumido, real
  certificadoDigitalId: integer("certificado_digital_id"),
  ambienteFiscal: text("ambiente_fiscal").default("homologacao"), // producao, homologacao
  serieNfe: integer("serie_nfe").default(1),
  serieNfce: integer("serie_nfce").default(1),
  // Perfil de segmento de negócio
  segmento: text("segmento"), // code do segmento (varejo_geral, engenharia_ambiental, etc.)
  // Plus ERP link
  plusEmpresaId: integer("plus_empresa_id"),
  // Metadata
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Grupos Empresariais (Manager Partners)
export const tenantGrupos = pgTable("tenant_grupos", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  tipo: text("tipo").default("grupo_simples"), // grupo_simples | holding | franquia
  ativo: boolean("ativo").default(true),
  grupoControlId: varchar("grupo_control_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  index("idx_tenant_grupos_tenant").on(t.tenantId),
]);

export const tenantGrupoMembros = pgTable("tenant_grupo_membros", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  grupoId: integer("grupo_id").notNull().references(() => tenantGrupos.id, { onDelete: "cascade" }),
  empresaId: integer("empresa_id").notNull().references(() => tenantEmpresas.id, { onDelete: "cascade" }),
  papel: text("papel").default("associada"), // matriz | associada | filial | cliente_externo
  participacao: numeric("participacao", { precision: 6, scale: 3 }).default("100.000"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  index("idx_tenant_grupo_membros_grupo").on(t.grupoId),
  uniqueIndex("uq_tenant_grupo_empresa").on(t.grupoId, t.empresaId),
]);

export type TenantGrupo = typeof tenantGrupos.$inferSelect;
export type TenantGrupoMembro = typeof tenantGrupoMembros.$inferSelect;

// Tenant Users (Membership)
export const tenantUsers = pgTable("tenant_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("member"), // owner, admin, member
  isOwner: text("is_owner").default("false"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Planos disponíveis
export const tenantPlans = pgTable("tenant_plans", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // free, starter, pro, enterprise, partner_starter, partner_pro
  name: text("name").notNull(),
  description: text("description"),
  tenantType: text("tenant_type").notNull(), // master, partner, client
  maxUsers: integer("max_users").default(5),
  maxStorageMb: integer("max_storage_mb").default(1000),
  features: jsonb("features").$type<TenantFeatures>(),
  monthlyPrice: integer("monthly_price").default(0), // em centavos
  yearlyPrice: integer("yearly_price").default(0), // em centavos
  trialDays: integer("trial_days").default(14),
  isActive: text("is_active").default("true"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Relacionamento Parceiro-Cliente
export const partnerClients = pgTable("partner_clients", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }), // Override do rate padrão do parceiro
  status: text("status").default("active"), // active, suspended, ended
  notes: text("notes"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  endedAt: timestamp("ended_at"),
});

// Comissões dos Parceiros
export const partnerCommissions = pgTable("partner_commissions", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  referenceMonth: text("reference_month").notNull(), // "2026-01"
  clientPlanCode: text("client_plan_code"),
  clientPlanValue: integer("client_plan_value").notNull(), // Valor do plano em centavos
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull(),
  commissionValue: integer("commission_value").notNull(), // Valor da comissão em centavos
  status: text("status").default("pending"), // pending, approved, paid, cancelled
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  paymentReference: text("payment_reference"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTenantUserSchema = createInsertSchema(tenantUsers).omit({ id: true, createdAt: true });
export const insertTenantPlanSchema = createInsertSchema(tenantPlans).omit({ id: true, createdAt: true });
export const insertPartnerClientSchema = createInsertSchema(partnerClients).omit({ id: true, startedAt: true });
export const insertPartnerCommissionSchema = createInsertSchema(partnerCommissions).omit({ id: true, createdAt: true });
export const insertTenantEmpresaSchema = createInsertSchema(tenantEmpresas).omit({ id: true, createdAt: true, updatedAt: true });

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type TenantUser = typeof tenantUsers.$inferSelect;
export type InsertTenantUser = z.infer<typeof insertTenantUserSchema>;
export type TenantPlan = typeof tenantPlans.$inferSelect;
export type InsertTenantPlan = z.infer<typeof insertTenantPlanSchema>;
export type PartnerClient = typeof partnerClients.$inferSelect;
export type InsertPartnerClient = z.infer<typeof insertPartnerClientSchema>;
export type PartnerCommission = typeof partnerCommissions.$inferSelect;
export type InsertPartnerCommission = z.infer<typeof insertPartnerCommissionSchema>;
export type TenantEmpresa = typeof tenantEmpresas.$inferSelect;
export type InsertTenantEmpresa = z.infer<typeof insertTenantEmpresaSchema>;

// ==========================================
// PROCESS COMPASS - CONSULTING BACK-OFFICE
// ==========================================

// Consulting Clients
export const pcClients = pgTable("pc_clients", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  industry: text("industry"),
  website: text("website"),
  address: text("address"),
  notes: text("notes"),
  logoUrl: text("logo_url"),
  status: text("status").default("active"), // active, inactive, prospect
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Client Contacts
export const pcClientContacts = pgTable("pc_client_contacts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => pcClients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  phone: text("phone"),
  isPrimary: text("is_primary").default("false"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Consulting Projects
export const pcProjects = pgTable("pc_projects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => crmClients.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  projectType: text("project_type").default("consultoria").notNull(),
  prodType: text("prod_type").default("internal"),
  clientName: text("client_name"),
  compassProjectId: integer("compass_project_id"),
  history: text("history"),
  status: text("status").default("backlog").notNull(),
  managerId: varchar("manager_id").references(() => users.id),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  priority: integer("priority").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Project Team Members (Squad por Projeto)
export const pcProjectMembers = pgTable("pc_project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => pcProjects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  collaboratorId: integer("collaborator_id"),
  role: text("role").default("member"), // product_owner, tech_lead, member
  isExternal: integer("is_external").default(0), // 1 = colaborador externo
  assignedAt: timestamp("assigned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Project Activity History
export const pcProjectActivities = pgTable("pc_project_activities", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => pcProjects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  activityType: text("activity_type").notNull(), // note, milestone, status_change, meeting, discovery, decision
  title: text("title").notNull(),
  description: text("description"),
  metadata: text("metadata"), // JSON for additional data
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Canvas Blocks (9 BMC blocks with 4 evolutionary levels)
export const pcCanvasBlocks = pgTable("pc_canvas_blocks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => pcProjects.id, { onDelete: "cascade" }),
  blockType: text("block_type").notNull(), // key_partners, key_activities, key_resources, value_propositions, customer_relationships, channels, customer_segments, cost_structure, revenue_streams
  level: text("level").default("intencao").notNull(), // intencao, evidencias, sistemico, transformacao
  title: text("title"),
  content: text("content"),
  notes: text("notes"),
  synthesis: text("synthesis"), // Síntese do bloco
  score: integer("score").default(0), // 0-100 completion score
  status: text("status").default("pending"), // pending, in_progress, completed
  pdcaStatus: text("pdca_status").default("plan"), // plan, do, check, act, done
  pdcaActionPlan: text("pdca_action_plan"),
  pdcaResult: text("pdca_result"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Canvas Diagnostic Questions (perguntas de diagnóstico)
export const pcCanvasQuestions = pgTable("pc_canvas_questions", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").notNull().references(() => pcCanvasBlocks.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer"),
  score: integer("score").default(0), // 0-10 score
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Canvas Expected Outputs (Saídas Esperadas)
export const pcCanvasExpectedOutputs = pgTable("pc_canvas_expected_outputs", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").notNull().references(() => pcCanvasBlocks.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Canvas PDCA Links (items PDCA vinculados ao canvas)
export const pcCanvasPdcaLinks = pgTable("pc_canvas_pdca_links", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").notNull().references(() => pcCanvasBlocks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  pdcaStatus: text("pdca_status").default("plan"), // plan, do, check, act, done
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Canvas SWOT Links (items SWOT vinculados ao canvas)
export const pcCanvasSwotLinks = pgTable("pc_canvas_swot_links", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").notNull().references(() => pcCanvasBlocks.id, { onDelete: "cascade" }),
  swotItemId: integer("swot_item_id").references(() => pcSwotItems.id, { onDelete: "cascade" }),
  title: text("title"),
  type: text("type"), // strength, weakness, opportunity, threat
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Business Processes
export const pcProcesses = pgTable("pc_processes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => pcProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // operacional, comercial, administrativo, financeiro
  owner: text("owner"),
  status: text("status").default("draft"), // draft, mapped, optimizing, implemented
  priority: integer("priority").default(0),
  orderIndex: integer("order_index").default(0),
  diagramNodes: jsonb("diagram_nodes").$type<any[]>().default([]),
  diagramEdges: jsonb("diagram_edges").$type<any[]>().default([]),
  diagramViewport: jsonb("diagram_viewport").$type<{ x: number; y: number; zoom: number }>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Project Team Members (for production projects)
export const pcProjectTeamMembers = pgTable("pc_project_team_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => pcProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Project Tasks (production project tasks)
export const pcProjectTasks = pgTable("pc_project_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => pcProjects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("pending").notNull(), // pending, in_progress, completed
  priority: text("priority").default("medium").notNull(), // low, medium, high
  assignedTo: text("assigned_to"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Project Files
export const pcProjectFiles = pgTable("pc_project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => pcProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Project History (rich text content)
export const pcProjectHistory = pgTable("pc_project_history", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => pcProjects.id, { onDelete: "cascade" }).unique(),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Process Steps
export const pcProcessSteps = pgTable("pc_process_steps", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").notNull().references(() => pcProcesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  responsible: text("responsible"),
  inputs: text("inputs"),
  outputs: text("outputs"),
  systems: text("systems"), // JSON array of systems used
  duration: text("duration"),
  painPoints: text("pain_points"),
  improvements: text("improvements"),
  orderIndex: integer("order_index").default(0),
  status: text("status").default("active"), // active, bottleneck, optimized
  pdcaStatus: text("pdca_status").default("plan"), // plan, do, check, act, done
  pdcaActionPlan: text("pdca_action_plan"),
  pdcaResult: text("pdca_result"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// SWOT Analyses
export const pcSwotAnalyses = pgTable("pc_swot_analyses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => pcProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  sector: text("sector"), // general, comercial, operacional, financeiro, rh
  analysisDate: timestamp("analysis_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  status: text("status").default("draft"), // draft, completed, archived
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// SWOT Items
export const pcSwotItems = pgTable("pc_swot_items", {
  id: serial("id").primaryKey(),
  swotAnalysisId: integer("swot_analysis_id").notNull().references(() => pcSwotAnalyses.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // strength, weakness, opportunity, threat
  title: text("title"), // título do item
  description: text("description").notNull(),
  impact: text("impact").default("medium"), // low, medium, high
  impactScore: integer("impact_score").default(3), // 1-5 numeric scale
  priorityLevel: text("priority_level").default("medium"), // baixa, média, alta, crítica
  priority: integer("priority").default(0), // ordering priority
  actionPlan: text("action_plan"), // plano de ação PDCA
  result: text("result"), // resultado/verificação do PDCA
  pdcaStatus: text("pdca_status").default("plan"), // plan, do, check, act, done
  responsible: text("responsible"),
  dueDate: timestamp("due_date"),
  status: text("status").default("identified"), // identified, analyzing, action_planned, resolved
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CRM Pipeline Stages
export const pcCrmStages = pgTable("pc_crm_stages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3b82f6"),
  orderIndex: integer("order_index").default(0),
  isDefault: text("is_default").default("false"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CRM Leads
export const pcCrmLeads = pgTable("pc_crm_leads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  source: text("source"), // website, referral, cold_call, event, social
  status: text("status").default("new"), // new, contacted, qualified, converted, lost
  notes: text("notes"),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  convertedToClientId: integer("converted_to_client_id").references(() => pcClients.id),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CRM Opportunities
export const pcCrmOpportunities = pgTable("pc_crm_opportunities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => pcClients.id),
  leadId: integer("lead_id").references(() => pcCrmLeads.id),
  stageId: integer("stage_id").references(() => pcCrmStages.id),
  name: text("name").notNull(),
  description: text("description"),
  value: integer("value").default(0), // Estimated value in cents
  probability: integer("probability").default(50), // 0-100
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  status: text("status").default("open"), // open, won, lost
  lostReason: text("lost_reason"),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CRM Activities
export const pcCrmActivities = pgTable("pc_crm_activities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  opportunityId: integer("opportunity_id").references(() => pcCrmOpportunities.id, { onDelete: "cascade" }),
  leadId: integer("lead_id").references(() => pcCrmLeads.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => pcClients.id),
  type: text("type").notNull(), // call, email, meeting, note, task
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  isCompleted: text("is_completed").default("false"),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Deliverables
export const pcDeliverables = pgTable("pc_deliverables", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => pcProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type"), // document, presentation, report, model, template
  dueDate: timestamp("due_date"),
  status: text("status").default("pending"), // pending, in_progress, review, completed
  fileUrl: text("file_url"),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

// Tasks
export const pcTasks = pgTable("pc_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }),
  deliverableId: integer("deliverable_id").references(() => pcDeliverables.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("todo"), // todo, in_progress, review, done
  priority: text("priority").default("medium"), // low, medium, high, urgent
  dueDate: timestamp("due_date"),
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

// PDCA Cycles
export const pcPdcaCycles = pgTable("pc_pdca_cycles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("plan"), // plan, do, check, act, completed
  priority: text("priority").default("medium"), // low, medium, high
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

// PDCA Actions (items within each phase)
export const pcPdcaActions = pgTable("pc_pdca_actions", {
  id: serial("id").primaryKey(),
  cycleId: integer("cycle_id").notNull().references(() => pcPdcaCycles.id, { onDelete: "cascade" }),
  phase: text("phase").notNull(), // plan, do, check, act
  title: text("title").notNull(),
  description: text("description"),
  responsible: text("responsible"),
  status: text("status").default("pending"), // pending, in_progress, completed
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Requirements
export const pcRequirements = pgTable("pc_requirements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }),
  code: text("code"), // REQ-001, etc
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").default("functional"), // functional, non_functional, business, technical
  priority: text("priority").default("medium"), // low, medium, high, critical
  status: text("status").default("draft"), // draft, approved, implemented, verified, rejected
  source: text("source"), // stakeholder, regulation, contract
  category: text("category"), // usability, performance, security, integration
  acceptanceCriteria: text("acceptance_criteria"),
  pdcaStatus: text("pdca_status").default("plan"), // plan, do, check, act, done
  pdcaActionPlan: text("pdca_action_plan"),
  pdcaResult: text("pdca_result"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ==========================================
// CRM EXPANDIDO - ARCÁDIA CRM
// ==========================================

// Partners (Parceiros de Canal)
export const crmPartners = pgTable("crm_partners", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  cnpj: text("cnpj"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  type: text("type").notNull(), // referral, solution, technology, service
  tier: text("tier").default("partner"), // partner, certified, premier
  status: text("status").default("pending"), // pending, active, suspended, inactive
  contractStartDate: timestamp("contract_start_date"),
  contractEndDate: timestamp("contract_end_date"),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactPhone: text("primary_contact_phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Partner Certifications (Certificações de Parceiros)
export const crmPartnerCertifications = pgTable("crm_partner_certifications", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => crmPartners.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id), // Profissional certificado
  certificationName: text("certification_name").notNull(), // sales_professional, technical_consultant
  certificationDate: timestamp("certification_date").notNull(),
  expirationDate: timestamp("expiration_date"),
  score: integer("score"),
  status: text("status").default("active"), // active, expired, revoked
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Partner Performance (Métricas de Performance)
export const crmPartnerPerformance = pgTable("crm_partner_performance", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => crmPartners.id, { onDelete: "cascade" }),
  period: text("period").notNull(), // 2026-01, 2026-Q1, 2026
  periodType: text("period_type").notNull(), // monthly, quarterly, yearly
  arrGenerated: integer("arr_generated").default(0),
  newClients: integer("new_clients").default(0),
  certifiedProfessionals: integer("certified_professionals").default(0),
  npsAverage: integer("nps_average"),
  casesPublished: integer("cases_published").default(0),
  portalUsageRate: integer("portal_usage_rate").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Contracts (Contratos SaaS e Serviços)
export const crmContracts = pgTable("crm_contracts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => pcClients.id),
  partnerId: integer("partner_id").references(() => crmPartners.id),
  opportunityId: integer("opportunity_id").references(() => pcCrmOpportunities.id),
  contractNumber: text("contract_number"),
  type: text("type").notNull(), // saas_subscription, implementation, customization, consulting
  status: text("status").default("draft"), // draft, pending_approval, active, completed, cancelled
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  monthlyValue: integer("monthly_value").default(0),
  totalValue: integer("total_value").default(0),
  paymentTerms: text("payment_terms"),
  billingCycle: text("billing_cycle").default("monthly"), // monthly, quarterly, yearly
  autoRenew: text("auto_renew").default("true"),
  signedAt: timestamp("signed_at"),
  signedBy: text("signed_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Revenue Schedule (Cronograma de Receita Recorrente)
export const crmRevenueSchedule = pgTable("crm_revenue_schedule", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => crmContracts.id, { onDelete: "cascade" }),
  month: integer("month").notNull(), // 1, 2, 3...
  dueDate: timestamp("due_date").notNull(),
  value: integer("value").notNull(),
  status: text("status").default("pending"), // pending, invoiced, paid, overdue
  invoiceNumber: text("invoice_number"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Commission Rules (Regras de Comissionamento)
export const crmCommissionRules = pgTable("crm_commission_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  revenueType: text("revenue_type").notNull(), // recurring, services
  saleScenario: text("sale_scenario").notNull(), // direct, referral
  role: text("role"), // sdr, ae, sales_leader, partner
  monthRangeStart: integer("month_range_start"), // 1, 6
  monthRangeEnd: integer("month_range_end"), // 5, null (perpetuo)
  percentage: integer("percentage").notNull(), // 500 = 5.00%
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Commission Calculations (Cálculos de Comissão)
export const crmCommissions = pgTable("crm_commissions", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => crmContracts.id, { onDelete: "cascade" }),
  revenueScheduleId: integer("revenue_schedule_id").references(() => crmRevenueSchedule.id),
  ruleId: integer("rule_id").references(() => crmCommissionRules.id),
  partnerId: integer("partner_id").references(() => crmPartners.id),
  userId: varchar("user_id").references(() => users.id),
  role: text("role"), // partner, sdr, ae, sales_leader
  baseValue: integer("base_value").notNull(),
  percentage: integer("percentage").notNull(),
  commissionValue: integer("commission_value").notNull(),
  period: text("period").notNull(), // 2026-01
  status: text("status").default("pending"), // pending, approved, paid
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Communication Channels (Canais de Comunicação - WhatsApp, Email)
export const crmChannels = pgTable("crm_channels", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // whatsapp, email, sms
  name: text("name").notNull(),
  identifier: text("identifier"), // phone number, email address
  status: text("status").default("disconnected"), // connected, disconnected, connecting
  sessionData: text("session_data"),
  qrCode: text("qr_code"),
  lastConnectedAt: timestamp("last_connected_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Communication Threads (Conversas)
export const crmThreads = pgTable("crm_threads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").references(() => crmChannels.id),
  clientId: integer("client_id").references(() => pcClients.id),
  leadId: integer("lead_id").references(() => pcCrmLeads.id),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  contactName: text("contact_name"),
  status: text("status").default("open"), // open, pending, resolved, closed
  priority: text("priority").default("normal"), // low, normal, high, urgent
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  queueId: integer("queue_id"),
  lastMessageAt: timestamp("last_message_at"),
  unreadCount: integer("unread_count").default(0),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Messages (Mensagens)
export const crmMessages = pgTable("crm_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => crmThreads.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").references(() => crmChannels.id),
  direction: text("direction").notNull(), // inbound, outbound
  type: text("type").default("text"), // text, image, audio, video, document
  content: text("content"),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  externalId: text("external_id"), // ID da mensagem no WhatsApp
  status: text("status").default("sent"), // pending, sent, delivered, read, failed
  sentById: varchar("sent_by_id").references(() => users.id),
  isFromAgent: text("is_from_agent").default("false"), // Enviada pelo Agente IA
  metadata: text("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Quick Messages (Mensagens Rápidas/Templates)
export const crmQuickMessages = pgTable("crm_quick_messages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  shortcut: text("shortcut").notNull(), // /ola, /preco
  title: text("title").notNull(),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  category: text("category"),
  isGlobal: text("is_global").default("false"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Campaigns (Campanhas de Mensagens)
export const crmCampaigns = pgTable("crm_campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").references(() => crmChannels.id),
  name: text("name").notNull(),
  description: text("description"),
  messageContent: text("message_content").notNull(),
  mediaUrl: text("media_url"),
  status: text("status").default("draft"), // draft, scheduled, running, paused, completed
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalContacts: integer("total_contacts").default(0),
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  readCount: integer("read_count").default(0),
  failedCount: integer("failed_count").default(0),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Campaign Contacts (Contatos da Campanha)
export const crmCampaignContacts = pgTable("crm_campaign_contacts", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => crmCampaigns.id, { onDelete: "cascade" }),
  phone: text("phone"),
  email: text("email"),
  name: text("name"),
  status: text("status").default("pending"), // pending, sent, delivered, read, failed
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  errorMessage: text("error_message"),
});

// Calendar Events (Eventos de Calendário)
export const crmEvents = pgTable("crm_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  opportunityId: integer("opportunity_id").references(() => pcCrmOpportunities.id),
  leadId: integer("lead_id").references(() => pcCrmLeads.id),
  clientId: integer("client_id").references(() => pcClients.id),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").default("meeting"), // meeting, call, task, reminder
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at"),
  allDay: text("all_day").default("false"),
  location: text("location"),
  meetingLink: text("meeting_link"),
  googleEventId: text("google_event_id"),
  attendees: text("attendees").array(),
  reminders: text("reminders"),
  status: text("status").default("scheduled"), // scheduled, completed, cancelled
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Google Calendar Tokens (Tokens OAuth do Google)
export const crmGoogleTokens = pgTable("crm_google_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CRM Products/Services (Produtos e Serviços)
export const crmProducts = pgTable("crm_products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("service"), // product, service
  category: text("category"),
  price: integer("price").default(0), // Price in cents
  currency: text("currency").default("BRL"),
  unit: text("unit").default("unit"), // unit, hour, month, project
  isActive: text("is_active").default("true"),
  sku: text("sku"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CRM Clients (Clientes do CRM)
export const crmClients = pgTable("crm_clients", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  cnpj: text("cnpj"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  segment: text("segment"),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactPhone: text("primary_contact_phone"),
  notes: text("notes"),
  status: text("status").default("active"), // active, inactive, churned
  source: text("source"), // lead, partner, direct, referral
  convertedFromLeadId: integer("converted_from_lead_id"),
  convertedFromPartnerId: integer("converted_from_partner_id"),
  partnerId: integer("partner_id"), // Parceiro associado ao cliente
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CRM Sales Pipeline Stages (Estágios do Funil de Vendas)
export const crmPipelineStages = pgTable("crm_pipeline_stages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3b82f6"),
  orderIndex: integer("order_index").default(0),
  probability: integer("probability").default(50), // Default win probability 0-100
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CRM Leads (Leads do CRM Arcádia)
export const crmLeads = pgTable("crm_leads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  position: text("position"),
  source: text("source"), // website, referral, linkedin, event, other
  status: text("status").default("new"), // new, contacted, qualified, unqualified, converted
  notes: text("notes"),
  tags: text("tags").array(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CRM Opportunities (Oportunidades de Venda)
export const crmOpportunities = pgTable("crm_opportunities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  leadId: integer("lead_id").references(() => crmLeads.id),
  partnerId: integer("partner_id").references(() => crmPartners.id),
  stageId: integer("stage_id").references(() => crmPipelineStages.id),
  name: text("name").notNull(),
  description: text("description"),
  value: integer("value").default(0), // Value in cents
  currency: text("currency").default("BRL"),
  probability: integer("probability").default(50), // 0-100
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  status: text("status").default("open"), // open, won, lost
  lossReason: text("loss_reason"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  approvalStatus: text("approval_status").default("pending"), // pending, approved, rejected
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  processCompassProjectId: integer("process_compass_project_id"),
  billingStatus: text("billing_status").default("none"), // none, pending, invoiced, paid
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CRM Opportunity Products (Produtos vinculados a oportunidades)
export const crmOpportunityProducts = pgTable("crm_opportunity_products", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunity_id").notNull().references(() => crmOpportunities.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => crmProducts.id),
  quantity: integer("quantity").default(1),
  unitPrice: integer("unit_price").default(0), // Price at time of sale
  discount: integer("discount").default(0), // Discount percentage
  total: integer("total").default(0), // Total in cents
});

// CRM Proposals (Propostas Comerciais)
export const crmProposals = pgTable("crm_proposals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  opportunityId: integer("opportunity_id").references(() => crmOpportunities.id, { onDelete: "set null" }),
  clientId: integer("client_id").references(() => crmClients.id, { onDelete: "set null" }),
  customerName: text("customer_name"),
  customerId: varchar("customer_id"),
  code: text("code"),
  title: text("title").notNull(),
  description: text("description"),
  version: integer("version").default(1),
  status: text("status").default("draft"), // draft, sent, viewed, accepted, rejected, expired
  validUntil: timestamp("valid_until"),
  totalValue: integer("total_value").default(0), // Total in cents
  currency: text("currency").default("BRL"),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CRM Proposal Items (Itens da Proposta)
export const crmProposalItems = pgTable("crm_proposal_items", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull().references(() => crmProposals.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => crmProducts.id),
  itemType: text("item_type").default("product"), // product, service, custom
  name: text("name").notNull(),
  description: text("description"),
  quantity: integer("quantity").default(1),
  unitPrice: integer("unit_price").default(0),
  discount: integer("discount").default(0),
  total: integer("total").default(0),
  orderIndex: integer("order_index").default(0),
});

// CRM Contract Milestones (Marcos de Entrega do Contrato)
export const crmContractMilestones = pgTable("crm_contract_milestones", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => crmContracts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  completedDate: timestamp("completed_date"),
  status: text("status").default("pending"), // pending, in_progress, completed, delayed
  deliverables: text("deliverables"),
  billingAmount: integer("billing_amount").default(0), // Amount in cents to bill on completion
  billingStatus: text("billing_status").default("pending"), // pending, invoiced, paid
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Opportunity Registration (Registro de Oportunidades - Proteção 90 dias)
export const crmOpportunityRegistrations = pgTable("crm_opportunity_registrations", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => crmPartners.id),
  opportunityId: integer("opportunity_id").notNull().references(() => pcCrmOpportunities.id),
  registeredAt: timestamp("registered_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  expiresAt: timestamp("expires_at").notNull(), // registeredAt + 90 dias
  status: text("status").default("active"), // active, expired, converted
  notes: text("notes"),
});

// Insert Schemas for Process Compass
export const insertPcClientSchema = createInsertSchema(pcClients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPcClientContactSchema = createInsertSchema(pcClientContacts).omit({ id: true, createdAt: true });
export const insertPcProjectSchema = createInsertSchema(pcProjects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPcProjectMemberSchema = createInsertSchema(pcProjectMembers).omit({ id: true, assignedAt: true });
export const insertPcProjectActivitySchema = createInsertSchema(pcProjectActivities).omit({ id: true, createdAt: true });
export const insertPcCanvasBlockSchema = createInsertSchema(pcCanvasBlocks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPcCanvasQuestionSchema = createInsertSchema(pcCanvasQuestions).omit({ id: true, createdAt: true });
export const insertPcCanvasExpectedOutputSchema = createInsertSchema(pcCanvasExpectedOutputs).omit({ id: true, createdAt: true });
export const insertPcCanvasPdcaLinkSchema = createInsertSchema(pcCanvasPdcaLinks).omit({ id: true, createdAt: true });
export const insertPcCanvasSwotLinkSchema = createInsertSchema(pcCanvasSwotLinks).omit({ id: true, createdAt: true });
export const insertPcProcessSchema = createInsertSchema(pcProcesses).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPcProcessStepSchema = createInsertSchema(pcProcessSteps).omit({ id: true, createdAt: true });
export const insertPcSwotAnalysisSchema = createInsertSchema(pcSwotAnalyses).omit({ id: true, createdAt: true, updatedAt: true, analysisDate: true });
export const insertPcSwotItemSchema = createInsertSchema(pcSwotItems).omit({ id: true, createdAt: true });
export const updatePcSwotItemSchema = insertPcSwotItemSchema.partial();
export const insertPcCrmStageSchema = createInsertSchema(pcCrmStages).omit({ id: true, createdAt: true });
export const insertPcCrmLeadSchema = createInsertSchema(pcCrmLeads).omit({ id: true, createdAt: true, updatedAt: true, convertedAt: true });
export const insertPcCrmOpportunitySchema = createInsertSchema(pcCrmOpportunities).omit({ id: true, createdAt: true, updatedAt: true, actualCloseDate: true });
export const insertPcCrmActivitySchema = createInsertSchema(pcCrmActivities).omit({ id: true, createdAt: true, completedAt: true });
export const insertPcDeliverableSchema = createInsertSchema(pcDeliverables).omit({ id: true, createdAt: true, completedAt: true });
export const insertPcTaskSchema = createInsertSchema(pcTasks).omit({ id: true, createdAt: true, completedAt: true });
export const insertPcPdcaCycleSchema = createInsertSchema(pcPdcaCycles).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const insertPcPdcaActionSchema = createInsertSchema(pcPdcaActions).omit({ id: true, createdAt: true, completedAt: true });
export const insertPcRequirementSchema = createInsertSchema(pcRequirements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPcProjectTeamMemberSchema = createInsertSchema(pcProjectTeamMembers).omit({ id: true, createdAt: true });
export const insertPcProjectTaskSchema = createInsertSchema(pcProjectTasks).omit({ id: true, createdAt: true });
export const insertPcProjectFileSchema = createInsertSchema(pcProjectFiles).omit({ id: true, createdAt: true });
export const insertPcProjectHistorySchema = createInsertSchema(pcProjectHistory).omit({ id: true, updatedAt: true });

// Types for Process Compass
export type PcClient = typeof pcClients.$inferSelect;
export type InsertPcClient = z.infer<typeof insertPcClientSchema>;
export type PcClientContact = typeof pcClientContacts.$inferSelect;
export type InsertPcClientContact = z.infer<typeof insertPcClientContactSchema>;
export type PcProject = typeof pcProjects.$inferSelect;
export type InsertPcProject = z.infer<typeof insertPcProjectSchema>;
export type PcProjectMember = typeof pcProjectMembers.$inferSelect;
export type InsertPcProjectMember = z.infer<typeof insertPcProjectMemberSchema>;
export type PcProjectActivity = typeof pcProjectActivities.$inferSelect;
export type InsertPcProjectActivity = z.infer<typeof insertPcProjectActivitySchema>;
export type PcCanvasBlock = typeof pcCanvasBlocks.$inferSelect;
export type InsertPcCanvasBlock = z.infer<typeof insertPcCanvasBlockSchema>;
export type PcCanvasQuestion = typeof pcCanvasQuestions.$inferSelect;
export type InsertPcCanvasQuestion = z.infer<typeof insertPcCanvasQuestionSchema>;
export type PcCanvasExpectedOutput = typeof pcCanvasExpectedOutputs.$inferSelect;
export type InsertPcCanvasExpectedOutput = z.infer<typeof insertPcCanvasExpectedOutputSchema>;
export type PcCanvasPdcaLink = typeof pcCanvasPdcaLinks.$inferSelect;
export type InsertPcCanvasPdcaLink = z.infer<typeof insertPcCanvasPdcaLinkSchema>;
export type PcCanvasSwotLink = typeof pcCanvasSwotLinks.$inferSelect;
export type InsertPcCanvasSwotLink = z.infer<typeof insertPcCanvasSwotLinkSchema>;
export type PcProcess = typeof pcProcesses.$inferSelect;
export type InsertPcProcess = z.infer<typeof insertPcProcessSchema>;
export type PcProcessStep = typeof pcProcessSteps.$inferSelect;
export type InsertPcProcessStep = z.infer<typeof insertPcProcessStepSchema>;
export type PcSwotAnalysis = typeof pcSwotAnalyses.$inferSelect;
export type InsertPcSwotAnalysis = z.infer<typeof insertPcSwotAnalysisSchema>;
export type PcSwotItem = typeof pcSwotItems.$inferSelect;
export type InsertPcSwotItem = z.infer<typeof insertPcSwotItemSchema>;
export type PcCrmStage = typeof pcCrmStages.$inferSelect;
export type InsertPcCrmStage = z.infer<typeof insertPcCrmStageSchema>;
export type PcCrmLead = typeof pcCrmLeads.$inferSelect;
export type InsertPcCrmLead = z.infer<typeof insertPcCrmLeadSchema>;
export type PcCrmOpportunity = typeof pcCrmOpportunities.$inferSelect;
export type InsertPcCrmOpportunity = z.infer<typeof insertPcCrmOpportunitySchema>;
export type PcCrmActivity = typeof pcCrmActivities.$inferSelect;
export type InsertPcCrmActivity = z.infer<typeof insertPcCrmActivitySchema>;
export type PcDeliverable = typeof pcDeliverables.$inferSelect;
export type InsertPcDeliverable = z.infer<typeof insertPcDeliverableSchema>;
export type PcTask = typeof pcTasks.$inferSelect;
export type InsertPcTask = z.infer<typeof insertPcTaskSchema>;
export type PcPdcaCycle = typeof pcPdcaCycles.$inferSelect;
export type InsertPcPdcaCycle = z.infer<typeof insertPcPdcaCycleSchema>;
export type PcPdcaAction = typeof pcPdcaActions.$inferSelect;
export type InsertPcPdcaAction = z.infer<typeof insertPcPdcaActionSchema>;
export type PcRequirement = typeof pcRequirements.$inferSelect;
export type InsertPcRequirement = z.infer<typeof insertPcRequirementSchema>;
export type PcProjectTeamMember = typeof pcProjectTeamMembers.$inferSelect;
export type InsertPcProjectTeamMember = z.infer<typeof insertPcProjectTeamMemberSchema>;
export type PcProjectTask = typeof pcProjectTasks.$inferSelect;
export type InsertPcProjectTask = z.infer<typeof insertPcProjectTaskSchema>;
export type PcProjectFile = typeof pcProjectFiles.$inferSelect;
export type InsertPcProjectFile = z.infer<typeof insertPcProjectFileSchema>;
export type PcProjectHistory = typeof pcProjectHistory.$inferSelect;
export type InsertPcProjectHistory = z.infer<typeof insertPcProjectHistorySchema>;

// ==========================================
// Insert Schemas for Arcádia CRM
// ==========================================
export const insertCrmPartnerSchema = createInsertSchema(crmPartners).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmPartnerCertificationSchema = createInsertSchema(crmPartnerCertifications).omit({ id: true, createdAt: true });
export const insertCrmPartnerPerformanceSchema = createInsertSchema(crmPartnerPerformance).omit({ id: true, createdAt: true });
export const insertCrmContractSchema = createInsertSchema(crmContracts).omit({ id: true, createdAt: true, updatedAt: true, signedAt: true });
export const insertCrmRevenueScheduleSchema = createInsertSchema(crmRevenueSchedule).omit({ id: true, createdAt: true, paidAt: true });
export const insertCrmCommissionRuleSchema = createInsertSchema(crmCommissionRules).omit({ id: true, createdAt: true });
export const insertCrmCommissionSchema = createInsertSchema(crmCommissions).omit({ id: true, createdAt: true, paidAt: true });
export const insertCrmChannelSchema = createInsertSchema(crmChannels).omit({ id: true, createdAt: true, updatedAt: true, lastConnectedAt: true });
export const insertCrmThreadSchema = createInsertSchema(crmThreads).omit({ id: true, createdAt: true, updatedAt: true, lastMessageAt: true });
export const insertCrmMessageSchema = createInsertSchema(crmMessages).omit({ id: true, createdAt: true });
export const insertCrmQuickMessageSchema = createInsertSchema(crmQuickMessages).omit({ id: true, createdAt: true });
export const insertCrmCampaignSchema = createInsertSchema(crmCampaigns).omit({ id: true, createdAt: true, startedAt: true, completedAt: true });
export const insertCrmCampaignContactSchema = createInsertSchema(crmCampaignContacts).omit({ id: true, sentAt: true, deliveredAt: true, readAt: true });
export const insertCrmEventSchema = createInsertSchema(crmEvents).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const insertCrmGoogleTokenSchema = createInsertSchema(crmGoogleTokens).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmOpportunityRegistrationSchema = createInsertSchema(crmOpportunityRegistrations).omit({ id: true, registeredAt: true });
export const insertCrmProductSchema = createInsertSchema(crmProducts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmClientSchema = createInsertSchema(crmClients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmPipelineStageSchema = createInsertSchema(crmPipelineStages).omit({ id: true, createdAt: true });
export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({ id: true, createdAt: true, updatedAt: true, convertedAt: true });
export const insertCrmOpportunitySchema = createInsertSchema(crmOpportunities).omit({ id: true, createdAt: true, updatedAt: true, actualCloseDate: true });
export const insertCrmOpportunityProductSchema = createInsertSchema(crmOpportunityProducts).omit({ id: true });
export const insertCrmProposalSchema = createInsertSchema(crmProposals).omit({ id: true, createdAt: true, updatedAt: true, sentAt: true, viewedAt: true, acceptedAt: true, rejectedAt: true });
export const insertCrmProposalItemSchema = createInsertSchema(crmProposalItems).omit({ id: true });
export const insertCrmContractMilestoneSchema = createInsertSchema(crmContractMilestones).omit({ id: true, createdAt: true, completedDate: true });

// Types for Arcádia CRM
export type CrmPartner = typeof crmPartners.$inferSelect;
export type InsertCrmPartner = z.infer<typeof insertCrmPartnerSchema>;
export type CrmPartnerCertification = typeof crmPartnerCertifications.$inferSelect;
export type InsertCrmPartnerCertification = z.infer<typeof insertCrmPartnerCertificationSchema>;
export type CrmPartnerPerformance = typeof crmPartnerPerformance.$inferSelect;
export type InsertCrmPartnerPerformance = z.infer<typeof insertCrmPartnerPerformanceSchema>;
export type CrmContract = typeof crmContracts.$inferSelect;
export type InsertCrmContract = z.infer<typeof insertCrmContractSchema>;
export type CrmRevenueSchedule = typeof crmRevenueSchedule.$inferSelect;
export type InsertCrmRevenueSchedule = z.infer<typeof insertCrmRevenueScheduleSchema>;
export type CrmCommissionRule = typeof crmCommissionRules.$inferSelect;
export type InsertCrmCommissionRule = z.infer<typeof insertCrmCommissionRuleSchema>;
export type CrmCommission = typeof crmCommissions.$inferSelect;
export type InsertCrmCommission = z.infer<typeof insertCrmCommissionSchema>;
export type CrmChannel = typeof crmChannels.$inferSelect;
export type InsertCrmChannel = z.infer<typeof insertCrmChannelSchema>;
export type CrmThread = typeof crmThreads.$inferSelect;
export type InsertCrmThread = z.infer<typeof insertCrmThreadSchema>;
export type CrmMessage = typeof crmMessages.$inferSelect;
export type InsertCrmMessage = z.infer<typeof insertCrmMessageSchema>;
export type CrmQuickMessage = typeof crmQuickMessages.$inferSelect;
export type InsertCrmQuickMessage = z.infer<typeof insertCrmQuickMessageSchema>;
export type CrmCampaign = typeof crmCampaigns.$inferSelect;
export type InsertCrmCampaign = z.infer<typeof insertCrmCampaignSchema>;
export type CrmCampaignContact = typeof crmCampaignContacts.$inferSelect;
export type InsertCrmCampaignContact = z.infer<typeof insertCrmCampaignContactSchema>;
export type CrmEvent = typeof crmEvents.$inferSelect;
export type InsertCrmEvent = z.infer<typeof insertCrmEventSchema>;
export type CrmGoogleToken = typeof crmGoogleTokens.$inferSelect;
export type InsertCrmGoogleToken = z.infer<typeof insertCrmGoogleTokenSchema>;
export type CrmOpportunityRegistration = typeof crmOpportunityRegistrations.$inferSelect;
export type InsertCrmOpportunityRegistration = z.infer<typeof insertCrmOpportunityRegistrationSchema>;
export type CrmProduct = typeof crmProducts.$inferSelect;
export type InsertCrmProduct = z.infer<typeof insertCrmProductSchema>;
export type CrmClient = typeof crmClients.$inferSelect;
export type InsertCrmClient = z.infer<typeof insertCrmClientSchema>;
export type CrmPipelineStage = typeof crmPipelineStages.$inferSelect;
export type InsertCrmPipelineStage = z.infer<typeof insertCrmPipelineStageSchema>;
export type CrmLead = typeof crmLeads.$inferSelect;
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;
export type CrmOpportunity = typeof crmOpportunities.$inferSelect;
export type InsertCrmOpportunity = z.infer<typeof insertCrmOpportunitySchema>;
export type CrmOpportunityProduct = typeof crmOpportunityProducts.$inferSelect;
export type InsertCrmOpportunityProduct = z.infer<typeof insertCrmOpportunityProductSchema>;
export type CrmProposal = typeof crmProposals.$inferSelect;
export type InsertCrmProposal = z.infer<typeof insertCrmProposalSchema>;
export type CrmProposalItem = typeof crmProposalItems.$inferSelect;
export type InsertCrmProposalItem = z.infer<typeof insertCrmProposalItemSchema>;
export type CrmContractMilestone = typeof crmContractMilestones.$inferSelect;
export type InsertCrmContractMilestone = z.infer<typeof insertCrmContractMilestoneSchema>;

// ========== CRM - Frappe ERPNext/CRM Connector ==========
export const crmFrappeConnectors = pgTable("crm_frappe_connectors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret").notNull(),
  frappeUser: text("frappe_user"),
  defaultCompany: text("default_company"),
  targetSystem: text("target_system").default("erpnext"),
  syncMode: text("sync_mode").default("manual"),
  syncEntities: text("sync_entities").array(),
  lastSyncAt: timestamp("last_sync_at"),
  status: text("status").default("inactive"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const crmFrappeMappings = pgTable("crm_frappe_mappings", {
  id: serial("id").primaryKey(),
  connectorId: integer("connector_id").notNull().references(() => crmFrappeConnectors.id, { onDelete: "cascade" }),
  localEntity: text("local_entity").notNull(),
  frappeDoctype: text("frappe_doctype").notNull(),
  fieldMappings: text("field_mappings"),
  statusMappings: text("status_mappings"),
  syncDirection: text("sync_direction").default("push"),
  isEnabled: integer("is_enabled").default(1),
});

export const crmSyncLogs = pgTable("crm_sync_logs", {
  id: serial("id").primaryKey(),
  connectorId: integer("connector_id").notNull().references(() => crmFrappeConnectors.id, { onDelete: "cascade" }),
  syncType: text("sync_type").notNull(),
  entity: text("entity"),
  recordsProcessed: integer("records_processed").default(0),
  recordsSuccess: integer("records_success").default(0),
  recordsFailed: integer("records_failed").default(0),
  status: text("status").notNull(),
  errorDetails: text("error_details"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertCrmFrappeConnectorSchema = createInsertSchema(crmFrappeConnectors).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCrmFrappeMappingSchema = createInsertSchema(crmFrappeMappings).omit({ id: true });
export const insertCrmSyncLogSchema = createInsertSchema(crmSyncLogs).omit({ id: true, startedAt: true });

export type CrmFrappeConnector = typeof crmFrappeConnectors.$inferSelect;
export type InsertCrmFrappeConnector = z.infer<typeof insertCrmFrappeConnectorSchema>;
export type CrmFrappeMapping = typeof crmFrappeMappings.$inferSelect;
export type InsertCrmFrappeMapping = z.infer<typeof insertCrmFrappeMappingSchema>;
export type CrmSyncLog = typeof crmSyncLogs.$inferSelect;
export type InsertCrmSyncLog = z.infer<typeof insertCrmSyncLogSchema>;

// ==========================================
// MÓDULO DE PRODUÇÃO - CENTRAL DE PRODUÇÃO
// ==========================================

// Squads (Equipes de Produção)
export const pcSquads = pgTable("pc_squads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  leaderId: varchar("leader_id").references(() => users.id),
  productOwnerId: varchar("product_owner_id"),
  techLeadId: varchar("tech_lead_id"),
  color: text("color").default("#3b82f6"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Squad Members (supports users and external collaborators)
export const pcSquadMembers = pgTable("pc_squad_members", {
  id: serial("id").primaryKey(),
  squadId: integer("squad_id").notNull().references(() => pcSquads.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  collaboratorId: varchar("collaborator_id"),
  memberRole: text("member_role").default("member"),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Sprints
export const pcSprints = pgTable("pc_sprints", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }),
  squadId: integer("squad_id").references(() => pcSquads.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  goal: text("goal"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").default("planning"),
  velocity: integer("velocity"),
  completedPoints: integer("completed_points").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Work Items (Backlog Unificado)
export const pcWorkItems = pgTable("pc_work_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }),
  sprintId: integer("sprint_id").references(() => pcSprints.id, { onDelete: "set null" }),
  parentId: integer("parent_id"),
  code: text("code"),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("task"),
  origin: text("origin").default("direct"),
  originId: integer("origin_id"),
  originType: text("origin_type"),
  status: text("status").default("backlog"),
  priority: text("priority").default("medium"),
  storyPoints: integer("story_points"),
  effortScore: integer("effort_score"),
  estimatedHours: numeric("estimated_hours", { precision: 10, scale: 2 }),
  actualHours: numeric("actual_hours", { precision: 10, scale: 2 }),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }),
  dueDate: timestamp("due_date"),
  assigneeId: varchar("assignee_id").references(() => users.id),
  createdById: varchar("created_by_id").references(() => users.id),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

// Work Item Comments
export const pcWorkItemComments = pgTable("pc_work_item_comments", {
  id: serial("id").primaryKey(),
  workItemId: integer("work_item_id").notNull().references(() => pcWorkItems.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Timesheet Entries
export const pcTimesheetEntries = pgTable("pc_timesheet_entries", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  workItemId: integer("work_item_id").references(() => pcWorkItems.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }),
  sprintId: integer("sprint_id").references(() => pcSprints.id, { onDelete: "set null" }),
  userId: varchar("user_id").references(() => users.id),
  collaboratorId: integer("collaborator_id"),
  date: timestamp("date").notNull(),
  hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),
  description: text("description"),
  billable: integer("billable").default(1),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }),
  status: text("status").default("draft"), // draft, pending, approved, rejected
  timerStartedAt: timestamp("timer_started_at"),
  approvedById: varchar("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Tenant Production Settings (configurações comerciais)
export const tenantProductionSettings = pgTable("tenant_production_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }).unique(),
  timesheetRequiresApproval: integer("timesheet_requires_approval").default(0),
  timesheetAllowTimer: integer("timesheet_allow_timer").default(1),
  defaultHourlyRate: numeric("default_hourly_rate", { precision: 10, scale: 2 }).default("0"),
  workHoursPerDay: numeric("work_hours_per_day", { precision: 4, scale: 2 }).default("8"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTenantProductionSettingsSchema = createInsertSchema(tenantProductionSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type TenantProductionSettings = typeof tenantProductionSettings.$inferSelect;
export type InsertTenantProductionSettings = z.infer<typeof insertTenantProductionSettingsSchema>;

// ==========================================
// MÓDULO DE SUPORTE - TICKETS E ATENDIMENTO
// ==========================================

// Support Tickets
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => crmClients.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "set null" }),
  code: text("code"),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("general"),
  priority: text("priority").default("medium"),
  status: text("status").default("open"),
  channel: text("channel").default("portal"),
  assigneeId: varchar("assignee_id").references(() => users.id),
  createdById: varchar("created_by_id").references(() => users.id),
  workItemId: integer("work_item_id").references(() => pcWorkItems.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  firstResponseAt: timestamp("first_response_at"),
  closedAt: timestamp("closed_at"),
  slaDeadline: timestamp("sla_deadline"),
  satisfaction: integer("satisfaction"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Support Conversations
export const supportConversations = pgTable("support_conversations", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  senderType: text("sender_type").notNull(),
  content: text("content").notNull(),
  isAiGenerated: integer("is_ai_generated").default(0),
  aiModel: text("ai_model"),
  attachments: text("attachments").array(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Knowledge Base Articles
export const supportKnowledgeBase = pgTable("support_knowledge_base", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  tags: text("tags").array(),
  status: text("status").default("published"),
  viewCount: integer("view_count").default(0),
  helpfulCount: integer("helpful_count").default(0),
  authorId: varchar("author_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Collaborators (Freelancers, Programmers, Consultants)
export const pcCollaborators = pgTable("pc_collaborators", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  type: text("type").notNull().default("programador"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).default("0"),
  skills: text("skills").array(),
  status: text("status").default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert Schemas
export const insertPcSquadSchema = createInsertSchema(pcSquads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPcSquadMemberSchema = createInsertSchema(pcSquadMembers).omit({ id: true, joinedAt: true });
export const insertPcSprintSchema = createInsertSchema(pcSprints).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPcWorkItemSchema = createInsertSchema(pcWorkItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPcWorkItemCommentSchema = createInsertSchema(pcWorkItemComments).omit({ id: true, createdAt: true });
export const insertPcTimesheetEntrySchema = createInsertSchema(pcTimesheetEntries).omit({ id: true, createdAt: true });
export const insertPcCollaboratorSchema = createInsertSchema(pcCollaborators).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupportConversationSchema = createInsertSchema(supportConversations).omit({ id: true, createdAt: true });
export const insertSupportKnowledgeBaseSchema = createInsertSchema(supportKnowledgeBase).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type PcSquad = typeof pcSquads.$inferSelect;
export type InsertPcSquad = z.infer<typeof insertPcSquadSchema>;
export type PcSquadMember = typeof pcSquadMembers.$inferSelect;
export type InsertPcSquadMember = z.infer<typeof insertPcSquadMemberSchema>;
export type PcSprint = typeof pcSprints.$inferSelect;
export type InsertPcSprint = z.infer<typeof insertPcSprintSchema>;
export type PcWorkItem = typeof pcWorkItems.$inferSelect;
export type InsertPcWorkItem = z.infer<typeof insertPcWorkItemSchema>;
export type PcWorkItemComment = typeof pcWorkItemComments.$inferSelect;
export type InsertPcWorkItemComment = z.infer<typeof insertPcWorkItemCommentSchema>;
export type PcTimesheetEntry = typeof pcTimesheetEntries.$inferSelect;
export type InsertPcTimesheetEntry = z.infer<typeof insertPcTimesheetEntrySchema>;
export type PcCollaborator = typeof pcCollaborators.$inferSelect;
export type InsertPcCollaborator = z.infer<typeof insertPcCollaboratorSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportConversation = typeof supportConversations.$inferSelect;
export type InsertSupportConversation = z.infer<typeof insertSupportConversationSchema>;
export type SupportKnowledgeBase = typeof supportKnowledgeBase.$inferSelect;
export type InsertSupportKnowledgeBase = z.infer<typeof insertSupportKnowledgeBaseSchema>;

// ==========================================
// MÓDULO DE RELATÓRIOS - COMPASS REPORTS
// ==========================================

// Report Templates (tipos de relatórios disponíveis)
export const pcReportTemplates = pgTable("pc_report_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  templateType: text("template_type").notNull(), // executive_summary, full_diagnostic, swot_report, process_analysis, canvas_report, erp_adherence, custom
  sections: jsonb("sections").$type<string[]>().default([]),
  isDefault: integer("is_default").default(0),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Report Configurations (configurações salvas por projeto)
export const pcReportConfigurations = pgTable("pc_report_configurations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }),
  templateId: integer("template_id").references(() => pcReportTemplates.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  sections: jsonb("sections").$type<string[]>().default([]),
  sectionOptions: jsonb("section_options").$type<Record<string, any>>().default({}),
  layoutOptions: jsonb("layout_options").$type<{
    showCoverPage?: boolean;
    showTableOfContents?: boolean;
    showPageNumbers?: boolean;
    orientation?: 'portrait' | 'landscape';
    logoUrl?: string;
    primaryColor?: string;
  }>().default({}),
  filters: jsonb("filters").$type<{
    dateRange?: { start?: string; end?: string };
    canvasLevels?: string[];
    swotTypes?: string[];
    processVariants?: string[];
  }>().default({}),
  lastGeneratedAt: timestamp("last_generated_at"),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Generated Reports (histórico de relatórios gerados)
export const pcGeneratedReports = pgTable("pc_generated_reports", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  configurationId: integer("configuration_id").references(() => pcReportConfigurations.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  reportType: text("report_type"),
  content: text("content"), // HTML content for editing
  format: text("format").notNull().default("pdf"), // pdf, docx, html
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  status: text("status").default("pending"), // pending, generating, completed, failed
  generatedBy: varchar("generated_by").references(() => users.id),
  generatedAt: timestamp("generated_at"),
  updatedAt: timestamp("updated_at"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
});

// Insert Schemas for Reports
export const insertPcReportTemplateSchema = createInsertSchema(pcReportTemplates).omit({ id: true, createdAt: true });
export const insertPcReportConfigurationSchema = createInsertSchema(pcReportConfigurations).omit({ id: true, createdAt: true, updatedAt: true, lastGeneratedAt: true });
export const insertPcGeneratedReportSchema = createInsertSchema(pcGeneratedReports).omit({ id: true, generatedAt: true });

// Types for Reports
export type PcReportTemplate = typeof pcReportTemplates.$inferSelect;
export type InsertPcReportTemplate = z.infer<typeof insertPcReportTemplateSchema>;
export type PcReportConfiguration = typeof pcReportConfigurations.$inferSelect;
export type InsertPcReportConfiguration = z.infer<typeof insertPcReportConfigurationSchema>;
export type PcGeneratedReport = typeof pcGeneratedReports.$inferSelect;
export type InsertPcGeneratedReport = z.infer<typeof insertPcGeneratedReportSchema>;

// ==========================================
// ERP ADHERENCE MODULE - ERP Implementation Assessment
// ==========================================

// ERP Modules catalog (for organizing requirements by ERP module)
export const pcErpModules = pgTable("pc_erp_modules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // Operacional, Financeiro, RH, etc.
  isActive: integer("is_active").default(1),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ERP Requirements (for ERP implementation assessment)
export const pcErpRequirements = pgTable("pc_erp_requirements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }).notNull(),
  processId: integer("process_id").references(() => pcProcesses.id, { onDelete: "set null" }),
  erpModuleId: integer("erp_module_id").references(() => pcErpModules.id, { onDelete: "set null" }),
  requirement: text("requirement").notNull(),
  description: text("description"),
  erpModule: text("erp_module"), // Financeiro, Contabil, Faturamento, Compras, Estoque, Producao, RH, CRM
  adherenceStatus: text("adherence_status").default("nao_atendido"), // nativo, configuravel, customizavel, nao_atendido
  priority: text("priority").default("media"), // alta, media, baixa
  customizationNotes: text("customization_notes"),
  estimatedEffort: text("estimated_effort"), // hours/days
  processRedesignRequired: integer("process_redesign_required").default(0), // 0 = no, 1 = yes
  pdcaStatus: text("pdca_status").default("plan"), // plan, do, check, act, done
  recommendation: text("recommendation"),
  actionDueDate: timestamp("action_due_date"),
  actionAssigneeId: varchar("action_assignee_id").references(() => users.id),
  actionResult: text("action_result"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ERP Parameterization Topics (checklist groups for ERP configuration)
export const pcErpParameterizationTopics = pgTable("pc_erp_parameterization_topics", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  erpModule: text("erp_module"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ERP Parameterization Items (checklist items within topics)
export const pcErpParameterizationItems = pgTable("pc_erp_parameterization_items", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").references(() => pcErpParameterizationTopics.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isCompleted: integer("is_completed").default(0), // 0 = no, 1 = yes
  completedAt: timestamp("completed_at"),
  completedById: varchar("completed_by_id").references(() => users.id),
  notes: text("notes"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert Schemas for ERP Adherence
export const insertPcErpModuleSchema = createInsertSchema(pcErpModules).omit({ id: true, createdAt: true });
export const insertPcErpRequirementSchema = createInsertSchema(pcErpRequirements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPcErpParameterizationTopicSchema = createInsertSchema(pcErpParameterizationTopics).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPcErpParameterizationItemSchema = createInsertSchema(pcErpParameterizationItems).omit({ id: true, createdAt: true, updatedAt: true });

// Types for ERP Adherence
export type PcErpModule = typeof pcErpModules.$inferSelect;
export type InsertPcErpModule = z.infer<typeof insertPcErpModuleSchema>;
export type PcErpRequirement = typeof pcErpRequirements.$inferSelect;
export type InsertPcErpRequirement = z.infer<typeof insertPcErpRequirementSchema>;
export type PcErpParameterizationTopic = typeof pcErpParameterizationTopics.$inferSelect;
export type InsertPcErpParameterizationTopic = z.infer<typeof insertPcErpParameterizationTopicSchema>;
export type PcErpParameterizationItem = typeof pcErpParameterizationItems.$inferSelect;
export type InsertPcErpParameterizationItem = z.infer<typeof insertPcErpParameterizationItemSchema>;

// ==========================================
// VALUATION MODULE - Business Valuation
// ==========================================

// Valuation Projects
export const valuationProjects = pgTable("valuation_projects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  cnpj: text("cnpj"),
  sector: text("sector").notNull(),
  businessModel: text("business_model"),
  stage: text("stage").notNull(),
  size: text("size").notNull(),
  projectType: text("project_type").default("simple"),
  status: text("status").default("draft"),
  consultantId: varchar("consultant_id").references(() => users.id),
  clientUserId: varchar("client_user_id").references(() => users.id),
  clientId: integer("client_id").references(() => crmClients.id, { onDelete: "set null" }),
  valuationRangeMin: numeric("valuation_range_min"),
  valuationRangeMax: numeric("valuation_range_max"),
  finalValue: numeric("final_value"),
  currentValuation: numeric("current_valuation"),
  projectedValuation: numeric("projected_valuation"),
  governanceScore: numeric("governance_score"),
  checklistProgress: numeric("checklist_progress"),
  currency: text("currency").default("BRL"),
  baseDate: timestamp("base_date"),
  valuationObjective: text("valuation_objective"),
  foundingYear: integer("founding_year"),
  city: text("city"),
  state: text("state"),
  legalNature: text("legal_nature"),
  reportUrl: text("report_url"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Valuation Financial Inputs (historical and projected data)
export const valuationInputs = pgTable("valuation_inputs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  isProjection: integer("is_projection").default(0),
  periodType: text("period_type").default("annual"),
  grossRevenue: numeric("gross_revenue"),
  revenue: numeric("revenue"),
  cogs: numeric("cogs"),
  grossProfit: numeric("gross_profit"),
  operatingExpenses: numeric("operating_expenses"),
  ebitda: numeric("ebitda"),
  ebit: numeric("ebit"),
  netIncome: numeric("net_income"),
  totalAssets: numeric("total_assets"),
  totalLiabilities: numeric("total_liabilities"),
  totalEquity: numeric("total_equity"),
  cash: numeric("cash"),
  debt: numeric("debt"),
  workingCapital: numeric("working_capital"),
  capex: numeric("capex"),
  depreciation: numeric("depreciation"),
  cashFlowOperations: numeric("cash_flow_operations"),
  freeCashFlow: numeric("free_cash_flow"),
  headcount: integer("headcount"),
  source: text("source").default("manual"),
  arr: numeric("arr"),
  mrr: numeric("mrr"),
  churnRate: numeric("churn_rate"),
  ltv: numeric("ltv"),
  cac: numeric("cac"),
  gmv: numeric("gmv"),
  tpv: numeric("tpv"),
  takeRate: numeric("take_rate"),
  growthRate: numeric("growth_rate"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Valuation Assumptions (macro and company-specific)
export const valuationAssumptions = pgTable("valuation_assumptions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  value: numeric("value"),
  unit: text("unit"),
  source: text("source"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Valuation Calculations (results from each methodology)
export const valuationCalculations = pgTable("valuation_calculations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  weight: numeric("weight"),
  enterpriseValue: numeric("enterprise_value"),
  equityValue: numeric("equity_value"),
  assumptions: jsonb("assumptions"),
  sensitivityMatrix: jsonb("sensitivity_matrix"),
  details: jsonb("details"),
  version: integer("version").default(1),
  status: text("status").default("draft"),
  calculatedAt: timestamp("calculated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  calculatedBy: varchar("calculated_by").references(() => users.id),
});

// Valuation Maturity Scores (qualitative analysis)
export const valuationMaturityScores = pgTable("valuation_maturity_scores", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  dimension: text("dimension").notNull(),
  score: integer("score"),
  maxScore: integer("max_score").default(100),
  benchmark: integer("benchmark"),
  responses: jsonb("responses"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Valuation Cap Table (shareholder structure)
export const valuationCapTable = pgTable("valuation_cap_table", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  shareholderName: text("shareholder_name").notNull(),
  shareholderType: text("shareholder_type"),
  shareClass: text("share_class").default("common"),
  sharesOwned: integer("shares_owned"),
  percentageOwned: numeric("percentage_owned"),
  investmentAmount: numeric("investment_amount"),
  liquidationPreference: numeric("liquidation_preference"),
  vestingSchedule: text("vesting_schedule"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Valuation M&A Transactions
export const valuationTransactions = pgTable("valuation_transactions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  phase: text("phase").notNull(),
  targetCloseDate: timestamp("target_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  dealValue: numeric("deal_value"),
  status: text("status").default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Valuation Data Room Documents
export const valuationDocuments = pgTable("valuation_documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  transactionId: integer("transaction_id").references(() => valuationTransactions.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  folder: text("folder"),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  accessLevel: text("access_level").default("view_only"),
  watermark: integer("watermark").default(0),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  viewCount: integer("view_count").default(0),
  downloadCount: integer("download_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Valuation Document Access Log
export const valuationDocumentLogs = pgTable("valuation_document_logs", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => valuationDocuments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Valuation Business Model Canvas
export const valuationCanvas = pgTable("valuation_canvas", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  block: text("block").notNull(),
  content: text("content"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Valuation Agent Insights (AI suggestions)
export const valuationAgentInsights = pgTable("valuation_agent_insights", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  confidence: numeric("confidence"),
  source: text("source"),
  status: text("status").default("pending"),
  appliedAt: timestamp("applied_at"),
  appliedBy: varchar("applied_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== VALUATION GOVERNANCE ==========
export const valuationGovernance = pgTable("valuation_governance", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  criterionCode: text("criterion_code").notNull(),
  criterionName: text("criterion_name").notNull(),
  category: text("category").notNull(),
  currentScore: integer("current_score").default(0),
  targetScore: integer("target_score").default(10),
  weight: numeric("weight"),
  valuationImpactPct: numeric("valuation_impact_pct"),
  equityImpactPct: numeric("equity_impact_pct"),
  roeImpactPct: numeric("roe_impact_pct"),
  priority: text("priority").default("medium"),
  implementationQuarter: text("implementation_quarter"),
  implementationCost: numeric("implementation_cost"),
  status: text("status").default("not_started"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== VALUATION PDCA ==========
export const valuationPdca = pgTable("valuation_pdca", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  governanceCriterionId: integer("governance_criterion_id").references(() => valuationGovernance.id),
  title: text("title").notNull(),
  originArea: text("origin_area").notNull(),
  phase: text("phase").notNull().default("plan"),
  status: text("status").default("not_started"),
  priority: text("priority").default("medium"),
  description: text("description"),
  expectedResult: text("expected_result"),
  actualResult: text("actual_result"),
  improvementScore: integer("improvement_score"),
  heatMapValue: numeric("heat_map_value"),
  responsible: text("responsible"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== VALUATION SWOT ==========
export const valuationSwot = pgTable("valuation_swot", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  quadrant: text("quadrant").notNull(),
  item: text("item").notNull(),
  impact: text("impact").default("medium"),
  valuationRelevance: integer("valuation_relevance").default(0),
  governanceRelevance: integer("governance_relevance").default(0),
  linkedPdcaId: integer("linked_pdca_id").references(() => valuationPdca.id),
  valuationImpactPct: numeric("valuation_impact_pct"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== VALUATION RESULTS ==========
export const valuationResults = pgTable("valuation_results", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  scenario: text("scenario").notNull(),
  method: text("method").notNull(),
  enterpriseValue: numeric("enterprise_value"),
  equityValue: numeric("equity_value"),
  terminalValue: numeric("terminal_value"),
  netDebt: numeric("net_debt"),
  roe: numeric("roe"),
  roa: numeric("roa"),
  weight: numeric("weight"),
  calculationDetails: jsonb("calculation_details"),
  calculatedAt: timestamp("calculated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== VALUATION ASSETS ==========
export const valuationAssets = pgTable("valuation_assets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  assetType: text("asset_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  bookValue: numeric("book_value"),
  marketValue: numeric("market_value"),
  appraisedValue: numeric("appraised_value"),
  depreciationRate: numeric("depreciation_rate"),
  acquisitionDate: timestamp("acquisition_date"),
  status: text("status").default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== VALUATION REPORTS ==========
export const valuationReports = pgTable("valuation_reports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull(),
  format: text("format").notNull(),
  fileUrl: text("file_url"),
  generatedAt: timestamp("generated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  generatedBy: varchar("generated_by").references(() => users.id),
  version: integer("version").default(1),
  isCurrent: integer("is_current").default(1),
});

// ========== VALUATION AI LOG ==========
export const valuationAiLog = pgTable("valuation_ai_log", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  triggerSource: text("trigger_source").notNull(),
  inputSummary: text("input_summary"),
  outputSummary: text("output_summary"),
  fullResponse: jsonb("full_response"),
  confidence: numeric("confidence"),
  tokensUsed: integer("tokens_used"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert Schemas - Valuation (new tables)
export const insertValuationGovernanceSchema = createInsertSchema(valuationGovernance).omit({ id: true, createdAt: true });
export const insertValuationPdcaSchema = createInsertSchema(valuationPdca).omit({ id: true, createdAt: true, updatedAt: true });
export const insertValuationSwotSchema = createInsertSchema(valuationSwot).omit({ id: true, createdAt: true });
export const insertValuationResultSchema = createInsertSchema(valuationResults).omit({ id: true, calculatedAt: true });
export const insertValuationAssetSchema = createInsertSchema(valuationAssets).omit({ id: true, createdAt: true });
export const insertValuationReportSchema = createInsertSchema(valuationReports).omit({ id: true, generatedAt: true });
export const insertValuationAiLogSchema = createInsertSchema(valuationAiLog).omit({ id: true, createdAt: true });

// Types - Valuation (new tables)
export type ValuationGovernanceEntry = typeof valuationGovernance.$inferSelect;
export type InsertValuationGovernance = z.infer<typeof insertValuationGovernanceSchema>;
export type ValuationPdcaEntry = typeof valuationPdca.$inferSelect;
export type InsertValuationPdca = z.infer<typeof insertValuationPdcaSchema>;
export type ValuationSwotEntry = typeof valuationSwot.$inferSelect;
export type InsertValuationSwot = z.infer<typeof insertValuationSwotSchema>;
export type ValuationResultEntry = typeof valuationResults.$inferSelect;
export type InsertValuationResult = z.infer<typeof insertValuationResultSchema>;
export type ValuationAssetEntry = typeof valuationAssets.$inferSelect;
export type InsertValuationAsset = z.infer<typeof insertValuationAssetSchema>;
export type ValuationReportEntry = typeof valuationReports.$inferSelect;
export type InsertValuationReport = z.infer<typeof insertValuationReportSchema>;
export type ValuationAiLogEntry = typeof valuationAiLog.$inferSelect;
export type InsertValuationAiLog = z.infer<typeof insertValuationAiLogSchema>;

// Insert Schemas - Valuation (original tables)
export const insertValuationProjectSchema = createInsertSchema(valuationProjects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertValuationInputSchema = createInsertSchema(valuationInputs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertValuationAssumptionSchema = createInsertSchema(valuationAssumptions).omit({ id: true, createdAt: true });
export const insertValuationCalculationSchema = createInsertSchema(valuationCalculations).omit({ id: true, calculatedAt: true });
export const insertValuationMaturityScoreSchema = createInsertSchema(valuationMaturityScores).omit({ id: true, createdAt: true });
export const insertValuationCapTableSchema = createInsertSchema(valuationCapTable).omit({ id: true, createdAt: true });
export const insertValuationTransactionSchema = createInsertSchema(valuationTransactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertValuationDocumentSchema = createInsertSchema(valuationDocuments).omit({ id: true, createdAt: true });
export const insertValuationDocumentLogSchema = createInsertSchema(valuationDocumentLogs).omit({ id: true, createdAt: true });
export const insertValuationCanvasSchema = createInsertSchema(valuationCanvas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertValuationAgentInsightSchema = createInsertSchema(valuationAgentInsights).omit({ id: true, createdAt: true });

// Types - Valuation
export type ValuationProject = typeof valuationProjects.$inferSelect;
export type InsertValuationProject = z.infer<typeof insertValuationProjectSchema>;
export type ValuationInput = typeof valuationInputs.$inferSelect;
export type InsertValuationInput = z.infer<typeof insertValuationInputSchema>;
export type ValuationAssumption = typeof valuationAssumptions.$inferSelect;
export type InsertValuationAssumption = z.infer<typeof insertValuationAssumptionSchema>;
export type ValuationCalculation = typeof valuationCalculations.$inferSelect;
export type InsertValuationCalculation = z.infer<typeof insertValuationCalculationSchema>;
export type ValuationMaturityScore = typeof valuationMaturityScores.$inferSelect;
export type InsertValuationMaturityScore = z.infer<typeof insertValuationMaturityScoreSchema>;
export type ValuationCapTableEntry = typeof valuationCapTable.$inferSelect;
export type InsertValuationCapTableEntry = z.infer<typeof insertValuationCapTableSchema>;
export type ValuationTransaction = typeof valuationTransactions.$inferSelect;
export type InsertValuationTransaction = z.infer<typeof insertValuationTransactionSchema>;
export type ValuationDocument = typeof valuationDocuments.$inferSelect;
export type InsertValuationDocument = z.infer<typeof insertValuationDocumentSchema>;
export type ValuationDocumentLog = typeof valuationDocumentLogs.$inferSelect;
export type InsertValuationDocumentLog = z.infer<typeof insertValuationDocumentLogSchema>;
export type ValuationCanvas = typeof valuationCanvas.$inferSelect;
export type InsertValuationCanvas = z.infer<typeof insertValuationCanvasSchema>;
export type ValuationAgentInsight = typeof valuationAgentInsights.$inferSelect;
export type InsertValuationAgentInsight = z.infer<typeof insertValuationAgentInsightSchema>;

// ========== VALUATION CHECKLIST ==========
// Checklist categories for valuation data collection
export const valuationChecklistCategories = pgTable("valuation_checklist_categories", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").default(0),
  icon: text("icon"),
  segmentFilter: text("segment_filter"), // null = all, or comma-separated: "technology,fintech,ecommerce,industry,agro"
});

// Checklist items template
export const valuationChecklistItems = pgTable("valuation_checklist_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => valuationChecklistCategories.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  format: text("format"), // PDF, XLSX, Texto, Formulário Online
  isRequired: integer("is_required").default(1),
  orderIndex: integer("order_index").default(0),
  segmentFilter: text("segment_filter"), // null = all, or specific segments
  agentPrompt: text("agent_prompt"), // AI prompt to assist this item
});

// Project checklist progress
export const valuationChecklistProgress = pgTable("valuation_checklist_progress", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => valuationChecklistItems.id, { onDelete: "cascade" }),
  status: text("status").default("pending"), // pending, in_progress, completed, not_applicable
  notes: text("notes"),
  documentId: integer("document_id").references(() => valuationDocuments.id),
  dataJson: text("data_json"), // structured data for form items
  agentAnalysis: text("agent_analysis"), // AI interpretation of submitted data
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Checklist attachments
export const valuationChecklistAttachments = pgTable("valuation_checklist_attachments", {
  id: serial("id").primaryKey(),
  progressId: integer("progress_id").notNull().references(() => valuationChecklistProgress.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas - Valuation Checklist
export const insertValuationChecklistCategorySchema = createInsertSchema(valuationChecklistCategories).omit({ id: true });
export const insertValuationChecklistItemSchema = createInsertSchema(valuationChecklistItems).omit({ id: true });
export const insertValuationChecklistProgressSchema = createInsertSchema(valuationChecklistProgress).omit({ id: true, createdAt: true, updatedAt: true });
export const insertValuationChecklistAttachmentSchema = createInsertSchema(valuationChecklistAttachments).omit({ id: true, createdAt: true });

// Types - Valuation Checklist
export type ValuationChecklistCategory = typeof valuationChecklistCategories.$inferSelect;
export type InsertValuationChecklistCategory = z.infer<typeof insertValuationChecklistCategorySchema>;
export type ValuationChecklistItem = typeof valuationChecklistItems.$inferSelect;
export type InsertValuationChecklistItem = z.infer<typeof insertValuationChecklistItemSchema>;
export type ValuationChecklistProgress = typeof valuationChecklistProgress.$inferSelect;
export type InsertValuationChecklistProgress = z.infer<typeof insertValuationChecklistProgressSchema>;
export type ValuationChecklistAttachment = typeof valuationChecklistAttachments.$inferSelect;
export type InsertValuationChecklistAttachment = z.infer<typeof insertValuationChecklistAttachmentSchema>;

// ========== SECTOR ANALYSIS ==========

// Category weights for sector analysis
export const valuationCategoryWeights = pgTable("valuation_category_weights", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  segment: text("segment").notNull(), // industry, services, retail, technology, etc.
  categoryCode: text("category_code").notNull(), // general, financial, operational, etc.
  weight: integer("weight").notNull().default(10), // percentage weight (0-100)
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Sector benchmarks for comparison
export const valuationSectorBenchmarks = pgTable("valuation_sector_benchmarks", {
  id: serial("id").primaryKey(),
  segment: text("segment").notNull(),
  indicatorCode: text("indicator_code").notNull(), // ebitda_margin, revenue_growth, etc.
  indicatorName: text("indicator_name").notNull(),
  minValue: numeric("min_value"),
  maxValue: numeric("max_value"),
  avgValue: numeric("avg_value"),
  topQuartile: numeric("top_quartile"),
  unit: text("unit"), // %, x, days, etc.
  source: text("source"),
  year: integer("year"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Sector analysis results
export const valuationSectorScores = pgTable("valuation_sector_scores", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  overallScore: integer("overall_score"), // 0-100
  categoryScores: jsonb("category_scores"), // {categoryCode: score}
  indicatorScores: jsonb("indicator_scores"), // detailed indicator results
  strengths: text("strengths").array(),
  weaknesses: text("weaknesses").array(),
  recommendations: text("recommendations").array(),
  analysisNotes: text("analysis_notes"),
  calculatedBy: varchar("calculated_by").references(() => users.id),
  calculatedAt: timestamp("calculated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas - Sector Analysis
export const insertValuationCategoryWeightSchema = createInsertSchema(valuationCategoryWeights).omit({ id: true, createdAt: true, updatedAt: true });
export const insertValuationSectorBenchmarkSchema = createInsertSchema(valuationSectorBenchmarks).omit({ id: true, createdAt: true });
export const insertValuationSectorScoreSchema = createInsertSchema(valuationSectorScores).omit({ id: true, createdAt: true });

// Types - Sector Analysis
export type ValuationCategoryWeight = typeof valuationCategoryWeights.$inferSelect;
export type InsertValuationCategoryWeight = z.infer<typeof insertValuationCategoryWeightSchema>;
export type ValuationSectorBenchmark = typeof valuationSectorBenchmarks.$inferSelect;
export type InsertValuationSectorBenchmark = z.infer<typeof insertValuationSectorBenchmarkSchema>;
export type ValuationSectorScore = typeof valuationSectorScores.$inferSelect;
export type InsertValuationSectorScore = z.infer<typeof insertValuationSectorScoreSchema>;

// ========== BUSINESS MODEL CANVAS ==========

// Business Model Canvas blocks (expanded structure)
export const valuationCanvasBlocks = pgTable("valuation_canvas_blocks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  blockType: text("block_type").notNull(), // value_proposition, customer_segments, channels, etc.
  title: text("title"),
  items: text("items").array(), // list of items in this block
  notes: text("notes"),
  orderIndex: integer("order_index").default(0),
  metadata: jsonb("metadata"), // additional data like colors, icons
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Canvas snapshots for versioning
export const valuationCanvasSnapshots = pgTable("valuation_canvas_snapshots", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => valuationProjects.id, { onDelete: "cascade" }),
  name: text("name"),
  canvasData: jsonb("canvas_data").notNull(), // full canvas state
  consistencyScore: integer("consistency_score"), // 0-100
  consistencyNotes: text("consistency_notes").array(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas - Canvas
export const insertValuationCanvasBlockSchema = createInsertSchema(valuationCanvasBlocks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertValuationCanvasSnapshotSchema = createInsertSchema(valuationCanvasSnapshots).omit({ id: true, createdAt: true });

// Types - Canvas
export type ValuationCanvasBlock = typeof valuationCanvasBlocks.$inferSelect;
export type InsertValuationCanvasBlock = z.infer<typeof insertValuationCanvasBlockSchema>;
export type ValuationCanvasSnapshot = typeof valuationCanvasSnapshots.$inferSelect;
export type InsertValuationCanvasSnapshot = z.infer<typeof insertValuationCanvasSnapshotSchema>;


// ========== GRAFO DE CONHECIMENTO ==========

// Nodes do grafo de conhecimento
export const graphNodes = pgTable("graph_nodes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  type: varchar("type", { length: 256 }).notNull(), // contact, message, project, email, document, etc.
  externalId: varchar("external_id", { length: 512 }), // ID do sistema externo
  data: jsonb("data").notNull(), // dados do nó
  embedding: text("embedding"), // embedding vector serializado (opcional, ChromaDB usa externamente)
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Edges (relacionamentos) do grafo
export const graphEdges = pgTable("graph_edges", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").references(() => graphNodes.id, { onDelete: "cascade" }).notNull(),
  targetId: integer("target_id").references(() => graphNodes.id, { onDelete: "cascade" }).notNull(),
  relation: varchar("relation", { length: 256 }).notNull(), // has_message, mentions, belongs_to, sent_by, etc.
  weight: numeric("weight").default("1.0"), // força do relacionamento
  metadata: jsonb("metadata"), // dados adicionais do relacionamento
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas - Grafo
export const insertGraphNodeSchema = createInsertSchema(graphNodes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGraphEdgeSchema = createInsertSchema(graphEdges).omit({ id: true, createdAt: true });

// Types - Grafo
export type GraphNode = typeof graphNodes.$inferSelect;
export type InsertGraphNode = z.infer<typeof insertGraphNodeSchema>;
export type GraphEdge = typeof graphEdges.$inferSelect;
export type InsertGraphEdge = z.infer<typeof insertGraphEdgeSchema>;

// ========== EVENTOS DE CONHECIMENTO (COLLECTOR) ==========

// Eventos brutos coletados pelo KnowledgeCollector
export const learningEvents = pgTable("learning_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  sessionId: varchar("session_id", { length: 256 }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  module: varchar("module", { length: 100 }).notNull(),
  data: jsonb("data"),
  url: text("url"),
  timeSpent: integer("time_spent"),
  isProcessed: integer("is_processed").default(0),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertLearningEventSchema = createInsertSchema(learningEvents).omit({ id: true, createdAt: true });
export type LearningEvent = typeof learningEvents.$inferSelect;
export type InsertLearningEvent = z.infer<typeof insertLearningEventSchema>;

// ========== REPOSITÓRIO DE APRENDIZADO (INTERAÇÕES) ==========

// Armazena todas as interações do chat e agente para aprendizado
export const learnedInteractions = pgTable("learned_interactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  source: varchar("source", { length: 50 }).notNull(), // 'agent_chat', 'manus_agent', 'support_chat', 'whatsapp'
  sessionId: varchar("session_id", { length: 256 }), // para agrupar conversas
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  context: jsonb("context"), // contexto adicional (ferramentas usadas, dados consultados)
  toolsUsed: text("tools_used").array(), // ferramentas usadas para responder
  dataSourcesAccessed: text("data_sources_accessed").array(), // fontes de dados consultadas
  confidence: numeric("confidence", { precision: 5, scale: 2 }), // confiança da resposta (0-100)
  feedback: varchar("feedback", { length: 20 }), // 'positive', 'negative', 'neutral'
  category: varchar("category", { length: 100 }), // categoria inferida da pergunta
  tags: text("tags").array(), // tags para busca
  isIndexed: integer("is_indexed").default(0), // se já foi indexado no ChromaDB
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Padrões aprendidos pelo Cientista
export const learnedPatterns = pgTable("learned_patterns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  patternType: varchar("pattern_type", { length: 50 }).notNull(), // 'correlation', 'trend', 'anomaly', 'rule', 'template'
  sourceDataset: varchar("source_dataset", { length: 256 }), // dataset que originou o padrão
  sourceTable: varchar("source_table", { length: 256 }), // tabela que originou
  pattern: jsonb("pattern").notNull(), // definição do padrão
  confidence: numeric("confidence", { precision: 5, scale: 2 }), // confiança (0-100)
  usageCount: integer("usage_count").default(0), // quantas vezes foi aplicado
  lastUsedAt: timestamp("last_used_at"),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Código gerado pelo Cientista
export const generatedCode = pgTable("generated_code", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  language: varchar("language", { length: 20 }).notNull().default("python"), // 'python', 'sql', 'javascript'
  codeType: varchar("code_type", { length: 50 }).notNull(), // 'analysis', 'automation', 'transformation', 'report'
  code: text("code").notNull(),
  parameters: jsonb("parameters"), // parâmetros esperados
  generatedFrom: varchar("generated_from", { length: 256 }), // prompt ou dataset que originou
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas - Aprendizado
export const insertLearnedInteractionSchema = createInsertSchema(learnedInteractions).omit({ id: true, createdAt: true });
export const insertLearnedPatternSchema = createInsertSchema(learnedPatterns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGeneratedCodeSchema = createInsertSchema(generatedCode).omit({ id: true, createdAt: true });

// Types - Aprendizado
export type LearnedInteraction = typeof learnedInteractions.$inferSelect;
export type InsertLearnedInteraction = z.infer<typeof insertLearnedInteractionSchema>;
export type LearnedPattern = typeof learnedPatterns.$inferSelect;
export type InsertLearnedPattern = z.infer<typeof insertLearnedPatternSchema>;
export type GeneratedCode = typeof generatedCode.$inferSelect;
export type InsertGeneratedCode = z.infer<typeof insertGeneratedCodeSchema>;

// ==========================================
// EMAIL MODULE - Unified Email Communication
// ==========================================

export const emailAccounts = pgTable("email_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").references(() => tenants.id),
  email: varchar("email", { length: 256 }).notNull(),
  password: text("password"),
  displayName: varchar("display_name", { length: 256 }),
  provider: varchar("provider", { length: 50 }).default("gmail"),
  imapHost: varchar("imap_host", { length: 256 }),
  imapPort: integer("imap_port").default(993),
  smtpHost: varchar("smtp_host", { length: 256 }),
  smtpPort: integer("smtp_port").default(587),
  status: varchar("status", { length: 50 }).default("disconnected"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const emailFolders = pgTable("email_folders", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 256 }).notNull(),
  type: varchar("type", { length: 50 }).default("custom"),
  unreadCount: integer("unread_count").default(0),
  totalCount: integer("total_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const emailMessages = pgTable("email_messages", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => emailFolders.id),
  messageId: varchar("message_id", { length: 512 }),
  threadId: varchar("thread_id", { length: 512 }),
  fromAddress: varchar("from_address", { length: 256 }).notNull(),
  fromName: varchar("from_name", { length: 256 }),
  toAddresses: text("to_addresses").array(),
  ccAddresses: text("cc_addresses").array(),
  bccAddresses: text("bcc_addresses").array(),
  subject: text("subject"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  snippet: text("snippet"),
  isRead: integer("is_read").default(0),
  isStarred: integer("is_starred").default(0),
  hasAttachments: integer("has_attachments").default(0),
  labels: text("labels").array(),
  replyToId: integer("reply_to_id"),
  receivedAt: timestamp("received_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const emailAttachments = pgTable("email_attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => emailMessages.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 512 }).notNull(),
  mimeType: varchar("mime_type", { length: 256 }),
  size: integer("size"),
  contentId: varchar("content_id", { length: 256 }),
  storagePath: text("storage_path"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert Schemas - Email
export const insertEmailAccountSchema = createInsertSchema(emailAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailFolderSchema = createInsertSchema(emailFolders).omit({ id: true, createdAt: true });
export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({ id: true, createdAt: true, updatedAt: true });

// Types - Email
export type EmailAccount = typeof emailAccounts.$inferSelect;
export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;
export type EmailFolder = typeof emailFolders.$inferSelect;
export type InsertEmailFolder = z.infer<typeof insertEmailFolderSchema>;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;

// ========== ARCÁDIA ERP - DocTypes Nativos ==========

// Meta-tabela que define a estrutura dos DocTypes
export const doctypes = pgTable("doctypes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  module: varchar("module", { length: 100 }).default("Core"),
  label: varchar("label", { length: 200 }).notNull(),
  description: text("description"),
  isSingle: integer("is_single").default(0), // 0 = list, 1 = single record
  isSubmittable: integer("is_submittable").default(0), // 0 = no, 1 = yes (has workflow)
  isChild: integer("is_child").default(0), // 0 = standalone, 1 = child table
  parentDoctype: varchar("parent_doctype", { length: 100 }),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  trackChanges: integer("track_changes").default(1),
  permissions: jsonb("permissions").$type<Record<string, string[]>>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Campos de cada DocType
export const doctypeFields = pgTable("doctype_fields", {
  id: serial("id").primaryKey(),
  doctypeId: integer("doctype_id").notNull().references(() => doctypes.id, { onDelete: "cascade" }),
  fieldname: varchar("fieldname", { length: 100 }).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  fieldtype: varchar("fieldtype", { length: 50 }).notNull(), // Data, Int, Currency, Link, Select, Table, Text, etc
  options: text("options"), // For Link: target doctype, For Select: options list
  defaultValue: text("default_value"),
  description: text("description"),
  reqd: integer("reqd").default(0), // required
  unique: integer("unique").default(0),
  inListView: integer("in_list_view").default(0),
  inStandardFilter: integer("in_standard_filter").default(0),
  hidden: integer("hidden").default(0),
  readOnly: integer("read_only").default(0),
  idx: integer("idx").default(0), // order
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Registros dinâmicos (dados reais de cada DocType)
export const doctypeRecords = pgTable("doctype_records", {
  id: serial("id").primaryKey(),
  doctypeName: varchar("doctype_name", { length: 100 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(), // unique identifier within doctype
  tenantId: integer("tenant_id").references(() => tenants.id),
  ownerId: varchar("owner_id").references(() => users.id),
  data: jsonb("data").$type<Record<string, any>>().notNull(),
  docstatus: integer("docstatus").default(0), // 0=Draft, 1=Submitted, 2=Cancelled
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== Configuração de Segmentos ERP ==========

// Segmentos de Negócio
export const erpSegments = pgTable("erp_segments", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(), // comercial, industria, distribuidor, ecommerce, foodservice
  description: text("description"),
  modules: text("modules").array(), // módulos habilitados para este segmento
  features: jsonb("features").$type<Record<string, boolean>>(), // funcionalidades específicas
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Configuração do Tenant (empresa)
export const erpConfig = pgTable("erp_config", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).unique(),
  segmentId: integer("segment_id").references(() => erpSegments.id),
  companyName: varchar("company_name", { length: 256 }),
  tradeName: varchar("trade_name", { length: 256 }),
  taxId: varchar("tax_id", { length: 20 }), // CNPJ
  stateRegistration: varchar("state_registration", { length: 50 }), // Inscrição Estadual
  cityRegistration: varchar("city_registration", { length: 50 }), // Inscrição Municipal
  taxRegime: varchar("tax_regime", { length: 50 }), // simples, lucro_presumido, lucro_real
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 256 }),
  website: varchar("website", { length: 256 }),
  logoUrl: text("logo_url"),
  // Integrações
  erpnextUrl: varchar("erpnext_url", { length: 512 }),
  erpnextEnabled: integer("erpnext_enabled").default(0),
  // Módulos ativos
  modulesCrm: integer("modules_crm").default(1),
  modulesSales: integer("modules_sales").default(1),
  modulesPurchases: integer("modules_purchases").default(1),
  modulesStock: integer("modules_stock").default(1),
  modulesFinance: integer("modules_finance").default(1),
  modulesAccounting: integer("modules_accounting").default(0),
  modulesProduction: integer("modules_production").default(0),
  modulesProjects: integer("modules_projects").default(0),
  modulesHr: integer("modules_hr").default(0),
  modulesServiceOrder: integer("modules_service_order").default(0),
  // Parametrizações
  defaultCurrency: varchar("default_currency", { length: 10 }).default("BRL"),
  decimalPlaces: integer("decimal_places").default(2),
  fiscalDocumentSeries: varchar("fiscal_document_series", { length: 10 }).default("1"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertErpSegmentSchema = createInsertSchema(erpSegments).omit({ id: true, createdAt: true });
export type ErpSegment = typeof erpSegments.$inferSelect;
export type InsertErpSegment = z.infer<typeof insertErpSegmentSchema>;

export const insertErpConfigSchema = createInsertSchema(erpConfig).omit({ id: true, createdAt: true, updatedAt: true });
export type ErpConfig = typeof erpConfig.$inferSelect;
export type InsertErpConfig = z.infer<typeof insertErpConfigSchema>;

// ========== DocTypes de Negócio Pré-definidos ==========

// Clientes
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  type: varchar("type", { length: 50 }).default("company"), // company, individual
  taxId: varchar("tax_id", { length: 50 }), // CPF/CNPJ
  email: varchar("email", { length: 256 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  country: varchar("country", { length: 100 }).default("Brasil"),
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }).default("0"),
  paymentTerms: integer("payment_terms").default(30), // days
  status: varchar("status", { length: 50 }).default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Fornecedores
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  taxId: varchar("tax_id", { length: 50 }),
  email: varchar("email", { length: 256 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  country: varchar("country", { length: 100 }).default("Brasil"),
  paymentTerms: integer("payment_terms").default(30),
  status: varchar("status", { length: 50 }).default("active"),
  notes: text("notes"),
  // Campos de Homologação ISO 17025
  isHomologated: integer("is_homologated").default(0),
  homologationDate: timestamp("homologation_date"),
  homologationExpiry: timestamp("homologation_expiry"),
  homologationStatus: varchar("homologation_status", { length: 50 }), // pending, approved, expired, blocked
  certifications: text("certifications").array(), // ISO 17025, ISO 9001, etc.
  qualityScore: integer("quality_score"), // 0-100
  lastAuditDate: timestamp("last_audit_date"),
  nextAuditDate: timestamp("next_audit_date"),
  blockedForPurchase: integer("blocked_for_purchase").default(0),
  blockReason: text("block_reason"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Produtos
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  unit: varchar("unit", { length: 20 }).default("UN"),
  costPrice: numeric("cost_price", { precision: 15, scale: 2 }).default("0"),
  salePrice: numeric("sale_price", { precision: 15, scale: 2 }).default("0"),
  stockQty: numeric("stock_qty", { precision: 15, scale: 3 }).default("0"),
  minStock: numeric("min_stock", { precision: 15, scale: 3 }).default("0"),
  barcode: varchar("barcode", { length: 50 }),
  ncm: varchar("ncm", { length: 20 }), // Brazilian tax code
  taxGroupId: integer("tax_group_id").references(() => fiscalGruposTributacao.id), // Grupo tributário
  status: varchar("status", { length: 50 }).default("active"),
  imageUrl: text("image_url"),
  requiresSerialTracking: boolean("requires_serial_tracking").default(false),
  trackingType: varchar("tracking_type", { length: 20 }).default("none"), // none, imei, serial
  defaultBrand: varchar("default_brand", { length: 50 }),
  defaultModel: varchar("default_model", { length: 100 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Pedidos de Venda
export const salesOrders = pgTable("sales_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  orderDate: timestamp("order_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deliveryDate: timestamp("delivery_date"),
  status: varchar("status", { length: 50 }).default("draft"), // draft, confirmed, delivered, cancelled
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  tax: numeric("tax", { precision: 15, scale: 2 }).default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).default("0"),
  paymentMethod: varchar("payment_method", { length: 50 }),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Itens do Pedido
export const salesOrderItems = pgTable("sales_order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id),
  productName: varchar("product_name", { length: 256 }).notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
});

// Pedidos de Compra
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  orderDate: timestamp("order_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  expectedDate: timestamp("expected_date"),
  status: varchar("status", { length: 50 }).default("draft"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  tax: numeric("tax", { precision: 15, scale: 2 }).default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).default("0"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Itens do Pedido de Compra
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id),
  productName: varchar("product_name", { length: 256 }).notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
});

// ========== Insert Schemas - ERP ==========
export const insertDoctypeSchema = createInsertSchema(doctypes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDoctypeFieldSchema = createInsertSchema(doctypeFields).omit({ id: true, createdAt: true });
export const insertDoctypeRecordSchema = createInsertSchema(doctypeRecords).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSalesOrderSchema = createInsertSchema(salesOrders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSalesOrderItemSchema = createInsertSchema(salesOrderItems).omit({ id: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({ id: true });

// ========== Types - ERP ==========
export type Doctype = typeof doctypes.$inferSelect;
export type InsertDoctype = z.infer<typeof insertDoctypeSchema>;
export type DoctypeField = typeof doctypeFields.$inferSelect;
export type InsertDoctypeField = z.infer<typeof insertDoctypeFieldSchema>;
export type DoctypeRecord = typeof doctypeRecords.$inferSelect;
export type InsertDoctypeRecord = z.infer<typeof insertDoctypeRecordSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type InsertSalesOrder = z.infer<typeof insertSalesOrderSchema>;
export type SalesOrderItem = typeof salesOrderItems.$inferSelect;
export type InsertSalesOrderItem = z.infer<typeof insertSalesOrderItemSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;

// ========== ARCÁDIA FISCO - Motor Fiscal ==========

// Tabela NCM (Nomenclatura Comum do Mercosul)
export const fiscalNcms = pgTable("fiscal_ncms", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 10 }).notNull().unique(),
  descricao: text("descricao").notNull(),
  aliqIpi: numeric("aliq_ipi", { precision: 5, scale: 2 }).default("0"),
  aliqImport: numeric("aliq_import", { precision: 5, scale: 2 }).default("0"),
  unidadeTributavel: varchar("unidade_tributavel", { length: 10 }),
  exTipi: varchar("ex_tipi", { length: 3 }),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Tabela CEST (Código Especificador da Substituição Tributária)
export const fiscalCests = pgTable("fiscal_cests", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 9 }).notNull().unique(),
  descricao: text("descricao").notNull(),
  ncmInicio: varchar("ncm_inicio", { length: 10 }),
  ncmFim: varchar("ncm_fim", { length: 10 }),
  segmento: varchar("segmento", { length: 100 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Tabela CFOP (Código Fiscal de Operações e Prestações)
export const fiscalCfops = pgTable("fiscal_cfops", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 4 }).notNull().unique(),
  descricao: text("descricao").notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // entrada, saida
  natureza: varchar("natureza", { length: 50 }), // venda, compra, devolucao, transferencia, etc
  geraCredito: integer("gera_credito").default(0),
  geraDebito: integer("gera_debito").default(0),
  movimentaEstoque: integer("movimenta_estoque").default(1),
  aplicacao: text("aplicacao"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Grupos de Tributação (padrão de impostos vinculado a NCM)
export const fiscalGruposTributacao = pgTable("fiscal_grupos_tributacao", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  nome: varchar("nome", { length: 100 }).notNull(),
  descricao: text("descricao"),
  ncm: varchar("ncm", { length: 10 }),
  cest: varchar("cest", { length: 9 }),
  
  // ICMS
  cstCsosn: varchar("cst_csosn", { length: 5 }),
  percIcms: numeric("perc_icms", { precision: 5, scale: 2 }).default("0"),
  percRedBc: numeric("perc_red_bc", { precision: 5, scale: 2 }).default("0"),
  modBcSt: varchar("mod_bc_st", { length: 5 }),
  percMvaSt: numeric("perc_mva_st", { precision: 5, scale: 2 }).default("0"),
  percIcmsSt: numeric("perc_icms_st", { precision: 5, scale: 2 }).default("0"),
  percRedBcSt: numeric("perc_red_bc_st", { precision: 5, scale: 2 }).default("0"),
  
  // PIS/COFINS
  cstPis: varchar("cst_pis", { length: 3 }),
  percPis: numeric("perc_pis", { precision: 5, scale: 2 }).default("0"),
  cstCofins: varchar("cst_cofins", { length: 3 }),
  percCofins: numeric("perc_cofins", { precision: 5, scale: 2 }).default("0"),
  
  // IPI
  cstIpi: varchar("cst_ipi", { length: 3 }),
  percIpi: numeric("perc_ipi", { precision: 5, scale: 2 }).default("0"),
  cEnq: varchar("c_enq", { length: 3 }),
  
  // CFOPs
  cfopEstadual: varchar("cfop_estadual", { length: 4 }),
  cfopOutroEstado: varchar("cfop_outro_estado", { length: 4 }),
  cfopEntradaEstadual: varchar("cfop_entrada_estadual", { length: 4 }),
  cfopEntradaOutroEstado: varchar("cfop_entrada_outro_estado", { length: 4 }),
  
  // Benefício Fiscal
  codigoBeneficioFiscal: varchar("codigo_beneficio_fiscal", { length: 20 }),
  
  // Reforma Tributária (IBS/CBS) - Lei Complementar 214/2025
  cstIbsCbs: varchar("cst_ibs_cbs", { length: 5 }),
  classeTribIbsCbs: varchar("classe_trib_ibs_cbs", { length: 10 }),
  percIbsUf: numeric("perc_ibs_uf", { precision: 5, scale: 2 }).default("0"),
  percIbsMun: numeric("perc_ibs_mun", { precision: 5, scale: 2 }).default("0"),
  percCbs: numeric("perc_cbs", { precision: 5, scale: 2 }).default("0"),
  percDif: numeric("perc_dif", { precision: 5, scale: 2 }).default("0"),
  
  padrao: integer("padrao").default(0),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Natureza de Operação
export const fiscalNaturezaOperacao = pgTable("fiscal_natureza_operacao", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  codigo: varchar("codigo", { length: 20 }),
  descricao: varchar("descricao", { length: 200 }).notNull(),
  
  // CSTs
  cstCsosn: varchar("cst_csosn", { length: 5 }),
  cstPis: varchar("cst_pis", { length: 3 }),
  cstCofins: varchar("cst_cofins", { length: 3 }),
  cstIpi: varchar("cst_ipi", { length: 3 }),
  
  // CFOPs
  cfopEstadual: varchar("cfop_estadual", { length: 4 }),
  cfopOutroEstado: varchar("cfop_outro_estado", { length: 4 }),
  cfopEntradaEstadual: varchar("cfop_entrada_estadual", { length: 4 }),
  cfopEntradaOutroEstado: varchar("cfop_entrada_outro_estado", { length: 4 }),
  
  // Alíquotas
  percIcms: numeric("perc_icms", { precision: 5, scale: 2 }).default("0"),
  percPis: numeric("perc_pis", { precision: 5, scale: 2 }).default("0"),
  percCofins: numeric("perc_cofins", { precision: 5, scale: 2 }).default("0"),
  percIpi: numeric("perc_ipi", { precision: 5, scale: 2 }).default("0"),
  
  sobrescreverCfop: integer("sobrescrever_cfop").default(0),
  movimentarEstoque: integer("movimentar_estoque").default(1),
  padrao: integer("padrao").default(0),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Certificados Digitais
export const fiscalCertificados = pgTable("fiscal_certificados", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  nome: varchar("nome", { length: 100 }).notNull(),
  tipo: varchar("tipo", { length: 5 }).notNull(), // A1, A3
  cnpj: varchar("cnpj", { length: 20 }).notNull(),
  razaoSocial: varchar("razao_social", { length: 200 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  validoAte: timestamp("valido_ate"),
  arquivo: text("arquivo"), // path ou base64 criptografado
  senha: text("senha"), // criptografada
  ambiente: varchar("ambiente", { length: 20 }).default("homologacao"), // homologacao, producao
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Configurações Fiscais por Tenant
export const fiscalConfiguracoes = pgTable("fiscal_configuracoes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).unique(),
  
  // Emitente
  cnpj: varchar("cnpj", { length: 20 }),
  ie: varchar("ie", { length: 20 }),
  im: varchar("im", { length: 20 }),
  cnae: varchar("cnae", { length: 10 }),
  crt: varchar("crt", { length: 2 }), // 1-Simples, 2-Simples Excesso, 3-Normal
  
  // Série NF-e/NFC-e
  serieNfe: integer("serie_nfe").default(1),
  serieNfce: integer("serie_nfce").default(1),
  proximoNumNfe: integer("proximo_num_nfe").default(1),
  proximoNumNfce: integer("proximo_num_nfce").default(1),
  
  // NFC-e
  cscId: varchar("csc_id", { length: 10 }),
  cscToken: varchar("csc_token", { length: 50 }),
  
  // Ambiente
  ambiente: varchar("ambiente", { length: 20 }).default("homologacao"),
  certificadoId: integer("certificado_id").references(() => fiscalCertificados.id),
  
  // Horários de funcionamento (para auto-resposta fora do horário)
  horarioInicio: varchar("horario_inicio", { length: 5 }),
  horarioFim: varchar("horario_fim", { length: 5 }),
  
  // Configurações gerais
  enviarEmailAutomatico: integer("enviar_email_automatico").default(0),
  imprimirDanfeAutomatico: integer("imprimir_danfe_automatico").default(0),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Notas Fiscais (NF-e / NFC-e)
export const fiscalNotas = pgTable("fiscal_notas", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  
  // Identificação
  modelo: varchar("modelo", { length: 3 }).notNull(), // 55 = NF-e, 65 = NFC-e
  serie: integer("serie").notNull(),
  numero: integer("numero").notNull(),
  chave: varchar("chave", { length: 44 }),
  naturezaOperacao: varchar("natureza_operacao", { length: 100 }),
  
  // Datas
  dataEmissao: timestamp("data_emissao").notNull(),
  dataSaida: timestamp("data_saida"),
  
  // Tipo
  tipoOperacao: varchar("tipo_operacao", { length: 5 }), // 0=Entrada, 1=Saída
  tipoEmissao: varchar("tipo_emissao", { length: 5 }).default("1"), // 1=Normal
  finalidade: varchar("finalidade", { length: 5 }).default("1"), // 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
  consumidorFinal: varchar("consumidor_final", { length: 5 }).default("0"),
  presencaComprador: varchar("presenca_comprador", { length: 5 }).default("1"),
  
  // Destinatário
  destinatarioId: integer("destinatario_id"),
  destinatarioTipo: varchar("destinatario_tipo", { length: 20 }), // customer, supplier
  destinatarioDoc: varchar("destinatario_doc", { length: 20 }),
  destinatarioNome: varchar("destinatario_nome", { length: 200 }),
  
  // Totais
  valorProdutos: numeric("valor_produtos", { precision: 15, scale: 2 }).default("0"),
  valorFrete: numeric("valor_frete", { precision: 15, scale: 2 }).default("0"),
  valorSeguro: numeric("valor_seguro", { precision: 15, scale: 2 }).default("0"),
  valorDesconto: numeric("valor_desconto", { precision: 15, scale: 2 }).default("0"),
  valorOutros: numeric("valor_outros", { precision: 15, scale: 2 }).default("0"),
  valorTotal: numeric("valor_total", { precision: 15, scale: 2 }).default("0"),
  
  // Impostos totais
  valorIcms: numeric("valor_icms", { precision: 15, scale: 2 }).default("0"),
  valorIcmsSt: numeric("valor_icms_st", { precision: 15, scale: 2 }).default("0"),
  valorPis: numeric("valor_pis", { precision: 15, scale: 2 }).default("0"),
  valorCofins: numeric("valor_cofins", { precision: 15, scale: 2 }).default("0"),
  valorIpi: numeric("valor_ipi", { precision: 15, scale: 2 }).default("0"),
  
  // Reforma Tributária
  valorIbsUf: numeric("valor_ibs_uf", { precision: 15, scale: 2 }).default("0"),
  valorIbsMun: numeric("valor_ibs_mun", { precision: 15, scale: 2 }).default("0"),
  valorCbs: numeric("valor_cbs", { precision: 15, scale: 2 }).default("0"),
  
  // Status SEFAZ
  status: varchar("status", { length: 30 }).default("rascunho"), // rascunho, pendente, autorizada, rejeitada, cancelada, inutilizada
  codigoStatus: varchar("codigo_status", { length: 10 }),
  motivoStatus: text("motivo_status"),
  protocolo: varchar("protocolo", { length: 50 }),
  dataAutorizacao: timestamp("data_autorizacao"),
  
  // XMLs
  xmlEnvio: text("xml_envio"),
  xmlRetorno: text("xml_retorno"),
  xmlAutorizado: text("xml_autorizado"),
  
  // Pedido origem
  pedidoOrigemId: integer("pedido_origem_id"),
  pedidoOrigemTipo: varchar("pedido_origem_tipo", { length: 20 }), // salesOrder, purchaseOrder
  
  informacoesAdicionais: text("informacoes_adicionais"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Itens da Nota Fiscal
export const fiscalNotaItens = pgTable("fiscal_nota_itens", {
  id: serial("id").primaryKey(),
  notaId: integer("nota_id").notNull().references(() => fiscalNotas.id, { onDelete: "cascade" }),
  
  // Produto
  produtoId: integer("produto_id"),
  codigo: varchar("codigo", { length: 60 }),
  descricao: varchar("descricao", { length: 256 }).notNull(),
  ncm: varchar("ncm", { length: 10 }),
  cest: varchar("cest", { length: 9 }),
  cfop: varchar("cfop", { length: 4 }),
  unidade: varchar("unidade", { length: 10 }),
  
  // Quantidades e valores
  quantidade: numeric("quantidade", { precision: 15, scale: 4 }).notNull(),
  valorUnitario: numeric("valor_unitario", { precision: 15, scale: 4 }).notNull(),
  valorDesconto: numeric("valor_desconto", { precision: 15, scale: 2 }).default("0"),
  valorTotal: numeric("valor_total", { precision: 15, scale: 2 }).notNull(),
  
  // ICMS
  origem: varchar("origem", { length: 2 }),
  cstCsosn: varchar("cst_csosn", { length: 5 }),
  bcIcms: numeric("bc_icms", { precision: 15, scale: 2 }).default("0"),
  percIcms: numeric("perc_icms", { precision: 5, scale: 2 }).default("0"),
  valorIcms: numeric("valor_icms", { precision: 15, scale: 2 }).default("0"),
  
  // ST
  bcIcmsSt: numeric("bc_icms_st", { precision: 15, scale: 2 }).default("0"),
  percIcmsSt: numeric("perc_icms_st", { precision: 5, scale: 2 }).default("0"),
  valorIcmsSt: numeric("valor_icms_st", { precision: 15, scale: 2 }).default("0"),
  
  // PIS
  cstPis: varchar("cst_pis", { length: 3 }),
  bcPis: numeric("bc_pis", { precision: 15, scale: 2 }).default("0"),
  percPis: numeric("perc_pis", { precision: 5, scale: 2 }).default("0"),
  valorPis: numeric("valor_pis", { precision: 15, scale: 2 }).default("0"),
  
  // COFINS
  cstCofins: varchar("cst_cofins", { length: 3 }),
  bcCofins: numeric("bc_cofins", { precision: 15, scale: 2 }).default("0"),
  percCofins: numeric("perc_cofins", { precision: 5, scale: 2 }).default("0"),
  valorCofins: numeric("valor_cofins", { precision: 15, scale: 2 }).default("0"),
  
  // IPI
  cstIpi: varchar("cst_ipi", { length: 3 }),
  bcIpi: numeric("bc_ipi", { precision: 15, scale: 2 }).default("0"),
  percIpi: numeric("perc_ipi", { precision: 5, scale: 2 }).default("0"),
  valorIpi: numeric("valor_ipi", { precision: 15, scale: 2 }).default("0"),
  
  // Reforma Tributária
  cstIbsCbs: varchar("cst_ibs_cbs", { length: 5 }),
  valorIbsUf: numeric("valor_ibs_uf", { precision: 15, scale: 2 }).default("0"),
  valorIbsMun: numeric("valor_ibs_mun", { precision: 15, scale: 2 }).default("0"),
  valorCbs: numeric("valor_cbs", { precision: 15, scale: 2 }).default("0"),
  
  ordem: integer("ordem").default(1),
});

// Eventos Fiscais (cancelamento, carta de correção, etc)
export const fiscalEventos = pgTable("fiscal_eventos", {
  id: serial("id").primaryKey(),
  notaId: integer("nota_id").notNull().references(() => fiscalNotas.id, { onDelete: "cascade" }),
  tipoEvento: varchar("tipo_evento", { length: 10 }).notNull(), // 110111=Cancelamento, 110110=CCe
  sequencia: integer("sequencia").default(1),
  descricao: text("descricao"),
  justificativa: text("justificativa"),
  protocolo: varchar("protocolo", { length: 50 }),
  dataEvento: timestamp("data_evento"),
  status: varchar("status", { length: 30 }),
  xmlEvento: text("xml_evento"),
  xmlRetorno: text("xml_retorno"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// IBPT - Carga Tributária por NCM
export const fiscalIbpt = pgTable("fiscal_ibpt", {
  id: serial("id").primaryKey(),
  ncm: varchar("ncm", { length: 10 }).notNull(),
  exTipi: varchar("ex_tipi", { length: 3 }),
  tabela: varchar("tabela", { length: 3 }), // 0, 1, 2
  aliqNac: numeric("aliq_nac", { precision: 5, scale: 2 }).default("0"),
  aliqImp: numeric("aliq_imp", { precision: 5, scale: 2 }).default("0"),
  aliqEst: numeric("aliq_est", { precision: 5, scale: 2 }).default("0"),
  aliqMun: numeric("aliq_mun", { precision: 5, scale: 2 }).default("0"),
  vigenciaInicio: timestamp("vigencia_inicio"),
  vigenciaFim: timestamp("vigencia_fim"),
  versao: varchar("versao", { length: 20 }),
});

// ========== Insert Schemas - Arcádia Fisco ==========
export const insertFiscalNcmSchema = createInsertSchema(fiscalNcms).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFiscalCestSchema = createInsertSchema(fiscalCests).omit({ id: true, createdAt: true });
export const insertFiscalCfopSchema = createInsertSchema(fiscalCfops).omit({ id: true, createdAt: true });
export const insertFiscalGrupoTributacaoSchema = createInsertSchema(fiscalGruposTributacao).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFiscalNaturezaOperacaoSchema = createInsertSchema(fiscalNaturezaOperacao).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFiscalCertificadoSchema = createInsertSchema(fiscalCertificados).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFiscalConfiguracaoSchema = createInsertSchema(fiscalConfiguracoes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFiscalNotaSchema = createInsertSchema(fiscalNotas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFiscalNotaItemSchema = createInsertSchema(fiscalNotaItens).omit({ id: true });
export const insertFiscalEventoSchema = createInsertSchema(fiscalEventos).omit({ id: true, createdAt: true });
export const insertFiscalIbptSchema = createInsertSchema(fiscalIbpt).omit({ id: true });

// ========== Types - Arcádia Fisco ==========
export type FiscalNcm = typeof fiscalNcms.$inferSelect;
export type InsertFiscalNcm = z.infer<typeof insertFiscalNcmSchema>;
export type FiscalCest = typeof fiscalCests.$inferSelect;
export type InsertFiscalCest = z.infer<typeof insertFiscalCestSchema>;
export type FiscalCfop = typeof fiscalCfops.$inferSelect;
export type InsertFiscalCfop = z.infer<typeof insertFiscalCfopSchema>;
export type FiscalGrupoTributacao = typeof fiscalGruposTributacao.$inferSelect;
export type InsertFiscalGrupoTributacao = z.infer<typeof insertFiscalGrupoTributacaoSchema>;
export type FiscalNaturezaOperacao = typeof fiscalNaturezaOperacao.$inferSelect;
export type InsertFiscalNaturezaOperacao = z.infer<typeof insertFiscalNaturezaOperacaoSchema>;
export type FiscalCertificado = typeof fiscalCertificados.$inferSelect;
export type InsertFiscalCertificado = z.infer<typeof insertFiscalCertificadoSchema>;
export type FiscalConfiguracao = typeof fiscalConfiguracoes.$inferSelect;
export type InsertFiscalConfiguracao = z.infer<typeof insertFiscalConfiguracaoSchema>;
export type FiscalNota = typeof fiscalNotas.$inferSelect;
export type InsertFiscalNota = z.infer<typeof insertFiscalNotaSchema>;
export type FiscalNotaItem = typeof fiscalNotaItens.$inferSelect;
export type InsertFiscalNotaItem = z.infer<typeof insertFiscalNotaItemSchema>;
export type FiscalEvento = typeof fiscalEventos.$inferSelect;
export type InsertFiscalEvento = z.infer<typeof insertFiscalEventoSchema>;
export type FiscalIbpt = typeof fiscalIbpt.$inferSelect;
export type InsertFiscalIbpt = z.infer<typeof insertFiscalIbptSchema>;

// ========== ARCÁDIA CONTÁBIL - Motor de Contabilidade ==========

// Plano de Contas
export const contabilPlanoContas = pgTable("contabil_plano_contas", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  descricao: varchar("descricao", { length: 200 }).notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // ativo, passivo, patrimonio, receita, despesa
  natureza: varchar("natureza", { length: 10 }).notNull(), // devedora, credora
  nivel: integer("nivel").default(1),
  contaPai: integer("conta_pai"),
  aceitaLancamento: integer("aceita_lancamento").default(1),
  codigoReduzido: varchar("codigo_reduzido", { length: 10 }),
  status: varchar("status", { length: 20 }).default("ativo"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Centros de Custo
export const contabilCentrosCusto = pgTable("contabil_centros_custo", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  descricao: varchar("descricao", { length: 200 }).notNull(),
  tipo: varchar("tipo", { length: 20 }), // custo, lucro, investimento
  centroPai: integer("centro_pai"),
  responsavel: varchar("responsavel"),
  status: varchar("status", { length: 20 }).default("ativo"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Lançamentos Contábeis (Diário)
export const contabilLancamentos = pgTable("contabil_lancamentos", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  numero: varchar("numero", { length: 20 }),
  dataLancamento: timestamp("data_lancamento").notNull(),
  dataCompetencia: timestamp("data_competencia"),
  tipoDocumento: varchar("tipo_documento", { length: 50 }), // nfe, nfse, recibo, folha, manual
  numeroDocumento: varchar("numero_documento", { length: 50 }),
  historico: text("historico").notNull(),
  valor: numeric("valor", { precision: 15, scale: 2 }).notNull(),
  origem: varchar("origem", { length: 50 }), // fisco, people, manual, erp
  origemId: integer("origem_id"),
  status: varchar("status", { length: 20 }).default("pendente"), // pendente, conferido, fechado
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Partidas do Lançamento (Débito/Crédito)
export const contabilPartidas = pgTable("contabil_partidas", {
  id: serial("id").primaryKey(),
  lancamentoId: integer("lancamento_id").notNull().references(() => contabilLancamentos.id, { onDelete: "cascade" }),
  contaId: integer("conta_id").notNull().references(() => contabilPlanoContas.id),
  centroCustoId: integer("centro_custo_id").references(() => contabilCentrosCusto.id),
  tipo: varchar("tipo", { length: 10 }).notNull(), // debito, credito
  valor: numeric("valor", { precision: 15, scale: 2 }).notNull(),
  historico: text("historico"),
});

// Períodos Contábeis
export const contabilPeriodos = pgTable("contabil_periodos", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(),
  dataInicio: timestamp("data_inicio").notNull(),
  dataFim: timestamp("data_fim").notNull(),
  status: varchar("status", { length: 20 }).default("aberto"), // aberto, fechado
  fechadoPor: varchar("fechado_por").references(() => users.id),
  fechadoEm: timestamp("fechado_em"),
});

// Configurações de Lançamento Automático
export const contabilConfigLancamento = pgTable("contabil_config_lancamento", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  origem: varchar("origem", { length: 50 }).notNull(), // nfe_entrada, nfe_saida, folha, etc
  descricao: varchar("descricao", { length: 200 }),
  contaDebito: integer("conta_debito").references(() => contabilPlanoContas.id),
  contaCredito: integer("conta_credito").references(() => contabilPlanoContas.id),
  centroCusto: integer("centro_custo").references(() => contabilCentrosCusto.id),
  historicoTemplate: text("historico_template"),
  ativo: integer("ativo").default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Saldos de Contas (cache para performance)
export const contabilSaldos = pgTable("contabil_saldos", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  contaId: integer("conta_id").notNull().references(() => contabilPlanoContas.id),
  centroCustoId: integer("centro_custo_id").references(() => contabilCentrosCusto.id),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(),
  saldoAnterior: numeric("saldo_anterior", { precision: 15, scale: 2 }).default("0"),
  debitos: numeric("debitos", { precision: 15, scale: 2 }).default("0"),
  creditos: numeric("creditos", { precision: 15, scale: 2 }).default("0"),
  saldoAtual: numeric("saldo_atual", { precision: 15, scale: 2 }).default("0"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== ARCÁDIA PEOPLE - Motor de RH ==========

// Cargos
export const peopleCargos = pgTable("people_cargos", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  codigo: varchar("codigo", { length: 20 }),
  nome: varchar("nome", { length: 100 }).notNull(),
  descricao: text("descricao"),
  cbo: varchar("cbo", { length: 10 }), // Classificação Brasileira de Ocupações
  nivel: varchar("nivel", { length: 50 }), // junior, pleno, senior, gerente, diretor
  departamento: varchar("departamento", { length: 100 }),
  salarioBase: numeric("salario_base", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 20 }).default("ativo"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Departamentos
export const peopleDepartamentos = pgTable("people_departamentos", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  codigo: varchar("codigo", { length: 20 }),
  nome: varchar("nome", { length: 100 }).notNull(),
  centroCustoId: integer("centro_custo_id").references(() => contabilCentrosCusto.id),
  gerente: varchar("gerente"),
  departamentoPai: integer("departamento_pai"),
  status: varchar("status", { length: 20 }).default("ativo"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Funcionários
export const peopleFuncionarios = pgTable("people_funcionarios", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  userId: varchar("user_id").references(() => users.id),
  matricula: varchar("matricula", { length: 20 }),
  nome: varchar("nome", { length: 200 }).notNull(),
  cpf: varchar("cpf", { length: 14 }),
  rg: varchar("rg", { length: 20 }),
  dataNascimento: timestamp("data_nascimento"),
  sexo: varchar("sexo", { length: 1 }),
  estadoCivil: varchar("estado_civil", { length: 20 }),
  nacionalidade: varchar("nacionalidade", { length: 50 }),
  naturalidade: varchar("naturalidade", { length: 100 }),
  nomeMae: varchar("nome_mae", { length: 200 }),
  nomePai: varchar("nome_pai", { length: 200 }),
  
  // Contato
  email: varchar("email", { length: 200 }),
  telefone: varchar("telefone", { length: 20 }),
  celular: varchar("celular", { length: 20 }),
  
  // Endereço
  cep: varchar("cep", { length: 10 }),
  logradouro: varchar("logradouro", { length: 200 }),
  numero: varchar("numero", { length: 20 }),
  complemento: varchar("complemento", { length: 100 }),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }),
  uf: varchar("uf", { length: 2 }),
  
  // Documentos Trabalhistas
  pis: varchar("pis", { length: 20 }),
  ctps: varchar("ctps", { length: 20 }),
  ctpsSerie: varchar("ctps_serie", { length: 10 }),
  ctpsUf: varchar("ctps_uf", { length: 2 }),
  
  // Dados Bancários
  banco: varchar("banco", { length: 10 }),
  agencia: varchar("agencia", { length: 10 }),
  conta: varchar("conta", { length: 20 }),
  tipoConta: varchar("tipo_conta", { length: 20 }),
  chavePix: varchar("chave_pix", { length: 100 }),
  
  // Vínculo
  cargoId: integer("cargo_id").references(() => peopleCargos.id),
  departamentoId: integer("departamento_id").references(() => peopleDepartamentos.id),
  dataAdmissao: timestamp("data_admissao"),
  dataDemissao: timestamp("data_demissao"),
  tipoContrato: varchar("tipo_contrato", { length: 20 }), // clt, pj, estagio, temporario
  jornadaTrabalho: varchar("jornada_trabalho", { length: 20 }), // 44h, 40h, 36h, 30h
  salario: numeric("salario", { precision: 15, scale: 2 }),
  
  // eSocial
  matriculaEsocial: varchar("matricula_esocial", { length: 30 }),
  categoriaEsocial: varchar("categoria_esocial", { length: 5 }),
  
  status: varchar("status", { length: 20 }).default("ativo"),
  foto: text("foto"),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Dependentes
export const peopleDependentes = pgTable("people_dependentes", {
  id: serial("id").primaryKey(),
  funcionarioId: integer("funcionario_id").notNull().references(() => peopleFuncionarios.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 200 }).notNull(),
  cpf: varchar("cpf", { length: 14 }),
  dataNascimento: timestamp("data_nascimento"),
  parentesco: varchar("parentesco", { length: 30 }), // filho, conjuge, pai, mae
  irrf: integer("irrf").default(0), // deduz no IRRF
  salarioFamilia: integer("salario_familia").default(0),
  planoSaude: integer("plano_saude").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Eventos de Folha (Proventos e Descontos)
export const peopleEventosFolha = pgTable("people_eventos_folha", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  codigo: varchar("codigo", { length: 10 }).notNull(),
  nome: varchar("nome", { length: 100 }).notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // provento, desconto
  natureza: varchar("natureza", { length: 20 }), // fixo, variavel, proporcional
  incidencias: jsonb("incidencias"), // { inss: true, irrf: true, fgts: true }
  formula: text("formula"),
  contaDebito: integer("conta_debito").references(() => contabilPlanoContas.id),
  contaCredito: integer("conta_credito").references(() => contabilPlanoContas.id),
  status: varchar("status", { length: 20 }).default("ativo"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Folha de Pagamento (Cabeçalho)
export const peopleFolhaPagamento = pgTable("people_folha_pagamento", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  competencia: varchar("competencia", { length: 7 }).notNull(), // YYYY-MM
  tipo: varchar("tipo", { length: 20 }).notNull(), // mensal, ferias, 13_1, 13_2, rescisao
  dataCalculo: timestamp("data_calculo"),
  dataPagamento: timestamp("data_pagamento"),
  totalBruto: numeric("total_bruto", { precision: 15, scale: 2 }).default("0"),
  totalDescontos: numeric("total_descontos", { precision: 15, scale: 2 }).default("0"),
  totalLiquido: numeric("total_liquido", { precision: 15, scale: 2 }).default("0"),
  totalInss: numeric("total_inss", { precision: 15, scale: 2 }).default("0"),
  totalIrrf: numeric("total_irrf", { precision: 15, scale: 2 }).default("0"),
  totalFgts: numeric("total_fgts", { precision: 15, scale: 2 }).default("0"),
  status: varchar("status", { length: 20 }).default("aberta"), // aberta, calculada, fechada, paga
  contabilizado: integer("contabilizado").default(0),
  lancamentoContabilId: integer("lancamento_contabil_id").references(() => contabilLancamentos.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Folha de Pagamento (Itens por Funcionário)
export const peopleFolhaItens = pgTable("people_folha_itens", {
  id: serial("id").primaryKey(),
  folhaId: integer("folha_id").notNull().references(() => peopleFolhaPagamento.id, { onDelete: "cascade" }),
  funcionarioId: integer("funcionario_id").notNull().references(() => peopleFuncionarios.id),
  salarioBase: numeric("salario_base", { precision: 15, scale: 2 }),
  diasTrabalhados: integer("dias_trabalhados"),
  horasExtras50: numeric("horas_extras_50", { precision: 10, scale: 2 }).default("0"),
  horasExtras100: numeric("horas_extras_100", { precision: 10, scale: 2 }).default("0"),
  horasNoturnas: numeric("horas_noturnas", { precision: 10, scale: 2 }).default("0"),
  faltas: integer("faltas").default(0),
  atrasos: numeric("atrasos", { precision: 10, scale: 2 }).default("0"),
  totalProventos: numeric("total_proventos", { precision: 15, scale: 2 }).default("0"),
  totalDescontos: numeric("total_descontos", { precision: 15, scale: 2 }).default("0"),
  totalLiquido: numeric("total_liquido", { precision: 15, scale: 2 }).default("0"),
  baseInss: numeric("base_inss", { precision: 15, scale: 2 }).default("0"),
  valorInss: numeric("valor_inss", { precision: 15, scale: 2 }).default("0"),
  baseIrrf: numeric("base_irrf", { precision: 15, scale: 2 }).default("0"),
  valorIrrf: numeric("valor_irrf", { precision: 15, scale: 2 }).default("0"),
  baseFgts: numeric("base_fgts", { precision: 15, scale: 2 }).default("0"),
  valorFgts: numeric("valor_fgts", { precision: 15, scale: 2 }).default("0"),
});

// Detalhes dos Eventos na Folha
export const peopleFolhaEventos = pgTable("people_folha_eventos", {
  id: serial("id").primaryKey(),
  folhaItemId: integer("folha_item_id").notNull().references(() => peopleFolhaItens.id, { onDelete: "cascade" }),
  eventoId: integer("evento_id").notNull().references(() => peopleEventosFolha.id),
  referencia: numeric("referencia", { precision: 10, scale: 2 }), // horas, dias, percentual
  valor: numeric("valor", { precision: 15, scale: 2 }).notNull(),
});

// Férias
export const peopleFerias = pgTable("people_ferias", {
  id: serial("id").primaryKey(),
  funcionarioId: integer("funcionario_id").notNull().references(() => peopleFuncionarios.id, { onDelete: "cascade" }),
  periodoAquisitivoInicio: timestamp("periodo_aquisitivo_inicio").notNull(),
  periodoAquisitivoFim: timestamp("periodo_aquisitivo_fim").notNull(),
  diasDireito: integer("dias_direito").default(30),
  diasGozados: integer("dias_gozados").default(0),
  diasVendidos: integer("dias_vendidos").default(0),
  dataInicio: timestamp("data_inicio"),
  dataFim: timestamp("data_fim"),
  valorFerias: numeric("valor_ferias", { precision: 15, scale: 2 }),
  valorTerco: numeric("valor_terco", { precision: 15, scale: 2 }),
  valorAbono: numeric("valor_abono", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 20 }).default("pendente"), // pendente, programada, em_gozo, concluida
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Ponto / Frequência
export const peoplePonto = pgTable("people_ponto", {
  id: serial("id").primaryKey(),
  funcionarioId: integer("funcionario_id").notNull().references(() => peopleFuncionarios.id, { onDelete: "cascade" }),
  data: timestamp("data").notNull(),
  entrada1: varchar("entrada1", { length: 5 }),
  saida1: varchar("saida1", { length: 5 }),
  entrada2: varchar("entrada2", { length: 5 }),
  saida2: varchar("saida2", { length: 5 }),
  horasTrabalhadas: numeric("horas_trabalhadas", { precision: 10, scale: 2 }),
  horasExtras: numeric("horas_extras", { precision: 10, scale: 2 }),
  horasNoturnas: numeric("horas_noturnas", { precision: 10, scale: 2 }),
  atraso: numeric("atraso", { precision: 10, scale: 2 }),
  falta: integer("falta").default(0),
  justificativa: text("justificativa"),
  status: varchar("status", { length: 20 }).default("normal"), // normal, falta, atestado, folga
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Benefícios
export const peopleBeneficios = pgTable("people_beneficios", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  codigo: varchar("codigo", { length: 20 }),
  nome: varchar("nome", { length: 100 }).notNull(),
  tipo: varchar("tipo", { length: 30 }), // vt, vr, va, plano_saude, plano_odonto, seguro_vida
  fornecedor: varchar("fornecedor", { length: 100 }),
  valorEmpresa: numeric("valor_empresa", { precision: 15, scale: 2 }),
  valorFuncionario: numeric("valor_funcionario", { precision: 15, scale: 2 }),
  percentualDesconto: numeric("percentual_desconto", { precision: 5, scale: 2 }),
  eventoDescontoId: integer("evento_desconto_id").references(() => peopleEventosFolha.id),
  status: varchar("status", { length: 20 }).default("ativo"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Funcionário x Benefícios
export const peopleFuncionarioBeneficios = pgTable("people_funcionario_beneficios", {
  id: serial("id").primaryKey(),
  funcionarioId: integer("funcionario_id").notNull().references(() => peopleFuncionarios.id, { onDelete: "cascade" }),
  beneficioId: integer("beneficio_id").notNull().references(() => peopleBeneficios.id),
  dataInicio: timestamp("data_inicio"),
  dataFim: timestamp("data_fim"),
  valorPersonalizado: numeric("valor_personalizado", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 20 }).default("ativo"),
});

// Tabelas de Cálculo (INSS, IRRF, Salário Família)
export const peopleTabelasCalculo = pgTable("people_tabelas_calculo", {
  id: serial("id").primaryKey(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // inss, irrf, salario_familia
  vigencia: timestamp("vigencia").notNull(),
  faixaInicio: numeric("faixa_inicio", { precision: 15, scale: 2 }).notNull(),
  faixaFim: numeric("faixa_fim", { precision: 15, scale: 2 }),
  aliquota: numeric("aliquota", { precision: 5, scale: 2 }),
  deducao: numeric("deducao", { precision: 15, scale: 2 }),
  valor: numeric("valor", { precision: 15, scale: 2 }),
});

// ========== Insert Schemas - Arcádia Contábil ==========
export const insertContabilPlanoContasSchema = createInsertSchema(contabilPlanoContas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContabilCentroCustoSchema = createInsertSchema(contabilCentrosCusto).omit({ id: true, createdAt: true });
export const insertContabilLancamentoSchema = createInsertSchema(contabilLancamentos).omit({ id: true, createdAt: true });
export const insertContabilPartidaSchema = createInsertSchema(contabilPartidas).omit({ id: true });
export const insertContabilPeriodoSchema = createInsertSchema(contabilPeriodos).omit({ id: true });
export const insertContabilConfigLancamentoSchema = createInsertSchema(contabilConfigLancamento).omit({ id: true, createdAt: true });
export const insertContabilSaldoSchema = createInsertSchema(contabilSaldos).omit({ id: true, updatedAt: true });

// ========== Types - Arcádia Contábil ==========
export type ContabilPlanoContas = typeof contabilPlanoContas.$inferSelect;
export type InsertContabilPlanoContas = z.infer<typeof insertContabilPlanoContasSchema>;
export type ContabilCentroCusto = typeof contabilCentrosCusto.$inferSelect;
export type InsertContabilCentroCusto = z.infer<typeof insertContabilCentroCustoSchema>;
export type ContabilLancamento = typeof contabilLancamentos.$inferSelect;
export type InsertContabilLancamento = z.infer<typeof insertContabilLancamentoSchema>;
export type ContabilPartida = typeof contabilPartidas.$inferSelect;
export type InsertContabilPartida = z.infer<typeof insertContabilPartidaSchema>;
export type ContabilPeriodo = typeof contabilPeriodos.$inferSelect;
export type InsertContabilPeriodo = z.infer<typeof insertContabilPeriodoSchema>;
export type ContabilConfigLancamento = typeof contabilConfigLancamento.$inferSelect;
export type InsertContabilConfigLancamento = z.infer<typeof insertContabilConfigLancamentoSchema>;
export type ContabilSaldo = typeof contabilSaldos.$inferSelect;
export type InsertContabilSaldo = z.infer<typeof insertContabilSaldoSchema>;

// ========== Insert Schemas - Arcádia People ==========
export const insertPeopleCargoSchema = createInsertSchema(peopleCargos).omit({ id: true, createdAt: true });
export const insertPeopleDepartamentoSchema = createInsertSchema(peopleDepartamentos).omit({ id: true, createdAt: true });
export const insertPeopleFuncionarioSchema = createInsertSchema(peopleFuncionarios).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPeopleDependenteSchema = createInsertSchema(peopleDependentes).omit({ id: true, createdAt: true });
export const insertPeopleEventoFolhaSchema = createInsertSchema(peopleEventosFolha).omit({ id: true, createdAt: true });
export const insertPeopleFolhaPagamentoSchema = createInsertSchema(peopleFolhaPagamento).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPeopleFolhaItemSchema = createInsertSchema(peopleFolhaItens).omit({ id: true });
export const insertPeopleFolhaEventoSchema = createInsertSchema(peopleFolhaEventos).omit({ id: true });
export const insertPeopleFeriasSchema = createInsertSchema(peopleFerias).omit({ id: true, createdAt: true });
export const insertPeoplePontoSchema = createInsertSchema(peoplePonto).omit({ id: true, createdAt: true });
export const insertPeopleBeneficioSchema = createInsertSchema(peopleBeneficios).omit({ id: true, createdAt: true });
export const insertPeopleFuncionarioBeneficioSchema = createInsertSchema(peopleFuncionarioBeneficios).omit({ id: true });
export const insertPeopleTabelaCalculoSchema = createInsertSchema(peopleTabelasCalculo).omit({ id: true });

// ========== Types - Arcádia People ==========
export type PeopleCargo = typeof peopleCargos.$inferSelect;
export type InsertPeopleCargo = z.infer<typeof insertPeopleCargoSchema>;
export type PeopleDepartamento = typeof peopleDepartamentos.$inferSelect;
export type InsertPeopleDepartamento = z.infer<typeof insertPeopleDepartamentoSchema>;
export type PeopleFuncionario = typeof peopleFuncionarios.$inferSelect;
export type InsertPeopleFuncionario = z.infer<typeof insertPeopleFuncionarioSchema>;
export type PeopleDependente = typeof peopleDependentes.$inferSelect;
export type InsertPeopleDependente = z.infer<typeof insertPeopleDependenteSchema>;
export type PeopleEventoFolha = typeof peopleEventosFolha.$inferSelect;
export type InsertPeopleEventoFolha = z.infer<typeof insertPeopleEventoFolhaSchema>;
export type PeopleFolhaPagamento = typeof peopleFolhaPagamento.$inferSelect;
export type InsertPeopleFolhaPagamento = z.infer<typeof insertPeopleFolhaPagamentoSchema>;
export type PeopleFolhaItem = typeof peopleFolhaItens.$inferSelect;
export type InsertPeopleFolhaItem = z.infer<typeof insertPeopleFolhaItemSchema>;
export type PeopleFolhaEvento = typeof peopleFolhaEventos.$inferSelect;
export type InsertPeopleFolhaEvento = z.infer<typeof insertPeopleFolhaEventoSchema>;
export type PeopleFerias = typeof peopleFerias.$inferSelect;
export type InsertPeopleFerias = z.infer<typeof insertPeopleFeriasSchema>;
export type PeoplePonto = typeof peoplePonto.$inferSelect;
export type InsertPeoplePonto = z.infer<typeof insertPeoplePontoSchema>;
export type PeopleBeneficio = typeof peopleBeneficios.$inferSelect;
export type InsertPeopleBeneficio = z.infer<typeof insertPeopleBeneficioSchema>;
export type PeopleFuncionarioBeneficio = typeof peopleFuncionarioBeneficios.$inferSelect;
export type InsertPeopleFuncionarioBeneficio = z.infer<typeof insertPeopleFuncionarioBeneficioSchema>;
export type PeopleTabelaCalculo = typeof peopleTabelasCalculo.$inferSelect;
export type InsertPeopleTabelaCalculo = z.infer<typeof insertPeopleTabelaCalculoSchema>;

// ========================================
// ARCÁDIA FINANCEIRO - Financial Management
// ========================================

// Contas Bancárias
export const finBankAccounts = pgTable("fin_bank_accounts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  bankCode: varchar("bank_code", { length: 10 }),
  bankName: varchar("bank_name", { length: 100 }),
  agency: varchar("agency", { length: 20 }),
  accountNumber: varchar("account_number", { length: 30 }),
  accountDigit: varchar("account_digit", { length: 5 }),
  accountType: varchar("account_type", { length: 50 }).default("checking"),
  initialBalance: numeric("initial_balance", { precision: 15, scale: 2 }).default("0"),
  currentBalance: numeric("current_balance", { precision: 15, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Meios de Pagamento
export const finPaymentMethods = pgTable("fin_payment_methods", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  defaultBankAccountId: integer("default_bank_account_id").references(() => finBankAccounts.id),
  fee: numeric("fee", { precision: 5, scale: 2 }).default("0"),
  daysToReceive: integer("days_to_receive").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Planos de Pagamento
export const finPaymentPlans = pgTable("fin_payment_plans", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  installments: integer("installments").default(1),
  intervalDays: integer("interval_days").default(30),
  firstDueDays: integer("first_due_days").default(30),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0"),
  interestPercent: numeric("interest_percent", { precision: 5, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Categorias de Fluxo de Caixa
export const finCashFlowCategories = pgTable("fin_cash_flow_categories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  parentId: integer("parent_id"),
  contabilAccountId: integer("contabil_account_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Contas a Pagar
export const finAccountsPayable = pgTable("fin_accounts_payable", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  documentNumber: varchar("document_number", { length: 100 }),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  supplierName: varchar("supplier_name", { length: 256 }),
  categoryId: integer("category_id").references(() => finCashFlowCategories.id),
  description: text("description"),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  originalAmount: numeric("original_amount", { precision: 15, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 15, scale: 2 }).default("0"),
  interestAmount: numeric("interest_amount", { precision: 15, scale: 2 }).default("0"),
  fineAmount: numeric("fine_amount", { precision: 15, scale: 2 }).default("0"),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).default("0"),
  remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  paymentMethodId: integer("payment_method_id").references(() => finPaymentMethods.id),
  bankAccountId: integer("bank_account_id").references(() => finBankAccounts.id),
  paidAt: timestamp("paid_at"),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Contas a Receber
export const finAccountsReceivable = pgTable("fin_accounts_receivable", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  documentNumber: varchar("document_number", { length: 100 }),
  customerId: integer("customer_id").references(() => customers.id),
  customerName: varchar("customer_name", { length: 256 }),
  categoryId: integer("category_id").references(() => finCashFlowCategories.id),
  description: text("description"),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  originalAmount: numeric("original_amount", { precision: 15, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 15, scale: 2 }).default("0"),
  interestAmount: numeric("interest_amount", { precision: 15, scale: 2 }).default("0"),
  fineAmount: numeric("fine_amount", { precision: 15, scale: 2 }).default("0"),
  receivedAmount: numeric("received_amount", { precision: 15, scale: 2 }).default("0"),
  remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  paymentMethodId: integer("payment_method_id").references(() => finPaymentMethods.id),
  bankAccountId: integer("bank_account_id").references(() => finBankAccounts.id),
  receivedAt: timestamp("received_at"),
  salesOrderId: integer("sales_order_id").references(() => salesOrders.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Transações Financeiras
export const finTransactions = pgTable("fin_transactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  bankAccountId: integer("bank_account_id").references(() => finBankAccounts.id).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  categoryId: integer("category_id").references(() => finCashFlowCategories.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 15, scale: 2 }),
  transactionDate: date("transaction_date").notNull(),
  description: text("description"),
  documentNumber: varchar("document_number", { length: 100 }),
  payableId: integer("payable_id").references(() => finAccountsPayable.id),
  receivableId: integer("receivable_id").references(() => finAccountsReceivable.id),
  transferFromId: integer("transfer_from_id"),
  transferToId: integer("transfer_to_id"),
  reconciled: boolean("reconciled").default(false),
  reconciledAt: timestamp("reconciled_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== Insert Schemas - Arcádia Financeiro ==========
export const insertFinBankAccountSchema = createInsertSchema(finBankAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFinPaymentMethodSchema = createInsertSchema(finPaymentMethods).omit({ id: true, createdAt: true });
export const insertFinPaymentPlanSchema = createInsertSchema(finPaymentPlans).omit({ id: true, createdAt: true });
export const insertFinCashFlowCategorySchema = createInsertSchema(finCashFlowCategories).omit({ id: true, createdAt: true });
export const insertFinAccountsPayableSchema = createInsertSchema(finAccountsPayable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFinAccountsReceivableSchema = createInsertSchema(finAccountsReceivable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFinTransactionSchema = createInsertSchema(finTransactions).omit({ id: true, createdAt: true });

// ========== Types - Arcádia Financeiro ==========
export type FinBankAccount = typeof finBankAccounts.$inferSelect;
export type InsertFinBankAccount = z.infer<typeof insertFinBankAccountSchema>;
export type FinPaymentMethod = typeof finPaymentMethods.$inferSelect;
export type InsertFinPaymentMethod = z.infer<typeof insertFinPaymentMethodSchema>;
export type FinPaymentPlan = typeof finPaymentPlans.$inferSelect;
export type InsertFinPaymentPlan = z.infer<typeof insertFinPaymentPlanSchema>;
export type FinCashFlowCategory = typeof finCashFlowCategories.$inferSelect;
export type InsertFinCashFlowCategory = z.infer<typeof insertFinCashFlowCategorySchema>;
export type FinAccountsPayable = typeof finAccountsPayable.$inferSelect;
export type InsertFinAccountsPayable = z.infer<typeof insertFinAccountsPayableSchema>;
export type FinAccountsReceivable = typeof finAccountsReceivable.$inferSelect;
export type InsertFinAccountsReceivable = z.infer<typeof insertFinAccountsReceivableSchema>;
export type FinTransaction = typeof finTransactions.$inferSelect;
export type InsertFinTransaction = z.infer<typeof insertFinTransactionSchema>;

// ========== COMUNIDADES (Discord-like) ==========

// Comunidades (workspaces/servidores)
export const communities = pgTable("communities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  iconEmoji: varchar("icon_emoji", { length: 10 }).default("🏢"),
  iconColor: varchar("icon_color", { length: 20 }).default("#3b82f6"),
  isPrivate: boolean("is_private").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Canais de uma comunidade
export const communityChannels = pgTable("community_channels", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").references(() => communities.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).default("text"), // text, voice, announcement
  isPrivate: boolean("is_private").default(false),
  orderIndex: integer("order_index").default(0),
  projectId: integer("project_id"), // vinculação opcional com projeto
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Membros de uma comunidade
export const communityMembers = pgTable("community_members", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").references(() => communities.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 20 }).default("member"), // owner, admin, moderator, member
  nickname: varchar("nickname", { length: 100 }),
  status: varchar("status", { length: 20 }).default("offline"), // online, away, busy, offline
  statusMessage: varchar("status_message", { length: 200 }),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastActiveAt: timestamp("last_active_at"),
});

// Mensagens em canais
export const communityMessages = pgTable("community_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => communityChannels.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  replyToId: integer("reply_to_id"),
  isPinned: boolean("is_pinned").default(false),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas - Comunidades
export const insertCommunitySchema = createInsertSchema(communities).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCommunityChannelSchema = createInsertSchema(communityChannels).omit({ id: true, createdAt: true });
export const insertCommunityMemberSchema = createInsertSchema(communityMembers).omit({ id: true, joinedAt: true });
export const insertCommunityMessageSchema = createInsertSchema(communityMessages).omit({ id: true, createdAt: true });

// Types - Comunidades
export type Community = typeof communities.$inferSelect;
export type InsertCommunity = z.infer<typeof insertCommunitySchema>;
export type CommunityChannel = typeof communityChannels.$inferSelect;
export type InsertCommunityChannel = z.infer<typeof insertCommunityChannelSchema>;
export type CommunityMember = typeof communityMembers.$inferSelect;
export type InsertCommunityMember = z.infer<typeof insertCommunityMemberSchema>;
export type CommunityMessage = typeof communityMessages.$inferSelect;
export type InsertCommunityMessage = z.infer<typeof insertCommunityMessageSchema>;

// ========================================
// MÓDULO PARA - Produtividade Pessoal
// ========================================

// Projetos PARA - Metas com prazo definido
export const paraProjects = pgTable("para_projects", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  // Tipo do projeto: personal (Kanban pessoal) ou production (link para módulo Produção)
  projectType: varchar("project_type", { length: 20 }).default("personal"), // personal, production
  // ID do projeto de produção vinculado (quando projectType = "production")
  productionProjectId: integer("production_project_id"),
  status: varchar("status", { length: 20 }).default("active"), // active, completed, archived
  color: varchar("color", { length: 20 }).default("#3b82f6"),
  icon: varchar("icon", { length: 50 }),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  progress: integer("progress").default(0), // 0-100
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Áreas PARA - Responsabilidades contínuas
export const paraAreas = pgTable("para_areas", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }).default("#10b981"),
  status: varchar("status", { length: 20 }).default("active"), // active, archived
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Recursos PARA - Materiais de referência
export const paraResources = pgTable("para_resources", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).default("link"), // link, document, note, bookmark
  url: text("url"),
  content: text("content"),
  tags: text("tags").array(),
  projectId: integer("project_id").references(() => paraProjects.id, { onDelete: "set null" }),
  areaId: integer("area_id").references(() => paraAreas.id, { onDelete: "set null" }),
  status: varchar("status", { length: 20 }).default("active"), // active, archived
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Tarefas PARA com Tríade do Tempo
export const paraTasks = pgTable("para_tasks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  projectId: integer("project_id").references(() => paraProjects.id, { onDelete: "set null" }),
  areaId: integer("area_id").references(() => paraAreas.id, { onDelete: "set null" }),
  // Tríade do Tempo: importante, urgente, circunstancial
  triadCategory: varchar("triad_category", { length: 20 }).default("importante").notNull(),
  status: varchar("status", { length: 20 }).default("pending"), // pending, in_progress, completed, cancelled
  priority: integer("priority").default(0), // 0=baixa, 1=média, 2=alta
  dueDate: timestamp("due_date"),
  reminderAt: timestamp("reminder_at"),
  estimatedMinutes: integer("estimated_minutes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Arquivo PARA - Itens arquivados para consulta futura
export const paraArchive = pgTable("para_archive", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  originalType: varchar("original_type", { length: 20 }).notNull(), // project, area, resource, task
  originalId: integer("original_id").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  metadata: jsonb("metadata"), // Dados originais do item
  archivedAt: timestamp("archived_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas - PARA
export const insertParaProjectSchema = createInsertSchema(paraProjects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertParaAreaSchema = createInsertSchema(paraAreas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertParaResourceSchema = createInsertSchema(paraResources).omit({ id: true, createdAt: true, updatedAt: true });
export const insertParaTaskSchema = createInsertSchema(paraTasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertParaArchiveSchema = createInsertSchema(paraArchive).omit({ id: true, archivedAt: true });

// Types - PARA
export type ParaProject = typeof paraProjects.$inferSelect;
export type InsertParaProject = z.infer<typeof insertParaProjectSchema>;
export type ParaArea = typeof paraAreas.$inferSelect;
export type InsertParaArea = z.infer<typeof insertParaAreaSchema>;
export type ParaResource = typeof paraResources.$inferSelect;
export type InsertParaResource = z.infer<typeof insertParaResourceSchema>;
export type ParaTask = typeof paraTasks.$inferSelect;
export type InsertParaTask = z.infer<typeof insertParaTaskSchema>;
export type ParaArchive = typeof paraArchive.$inferSelect;
export type InsertParaArchive = z.infer<typeof insertParaArchiveSchema>;

// ========== MÓDULO QUALIDADE - Engenharia Ambiental ==========

// Controle de Amostras (RF-QC01)
export const qualitySamples = pgTable("quality_samples", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }),
  sampleCode: varchar("sample_code", { length: 50 }).notNull(),
  sampleType: varchar("sample_type", { length: 100 }), // água, solo, ar, sedimento, efluente
  collectionDate: timestamp("collection_date"),
  collectionLocation: text("collection_location"),
  collectionResponsible: varchar("collection_responsible", { length: 256 }),
  collectionMethod: varchar("collection_method", { length: 100 }),
  preservationMethod: varchar("preservation_method", { length: 100 }),
  laboratoryId: integer("laboratory_id").references(() => suppliers.id),
  sentToLabDate: timestamp("sent_to_lab_date"),
  labReceptionDate: timestamp("lab_reception_date"),
  expectedResultDate: timestamp("expected_result_date"),
  actualResultDate: timestamp("actual_result_date"),
  status: varchar("status", { length: 50 }).default("coletada"), // coletada, enviada, em_analise, resultado_recebido, aprovada, reprovada
  observations: text("observations"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Laudos Laboratoriais (RF-QC01)
export const qualityLabReports = pgTable("quality_lab_reports", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  sampleId: integer("sample_id").references(() => qualitySamples.id, { onDelete: "cascade" }),
  reportNumber: varchar("report_number", { length: 100 }),
  laboratoryId: integer("laboratory_id").references(() => suppliers.id),
  issueDate: timestamp("issue_date"),
  receptionDate: timestamp("reception_date"),
  parameters: jsonb("parameters").$type<Array<{ name: string; value: string; unit: string; limit?: string; status?: string }>>(),
  conclusion: text("conclusion"),
  status: varchar("status", { length: 50 }).default("recebido"), // recebido, em_analise, aprovado, reprovado, pendente_reanálise
  fileUrl: text("file_url"),
  observations: text("observations"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Controle de Não Conformidades - RNC (RF-QC03)
export const qualityNonConformities = pgTable("quality_non_conformities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "set null" }),
  rncNumber: varchar("rnc_number", { length: 50 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).default("nao_conformidade"), // nao_conformidade, acao_corretiva, oportunidade_melhoria
  source: varchar("source", { length: 100 }), // auditoria_interna, auditoria_externa, reclamacao_cliente, processo, fornecedor
  severity: varchar("severity", { length: 20 }).default("media"), // baixa, media, alta, critica
  detectedBy: varchar("detected_by", { length: 256 }),
  detectedAt: timestamp("detected_at"),
  rootCause: text("root_cause"),
  immediateAction: text("immediate_action"),
  correctiveAction: text("corrective_action"),
  preventiveAction: text("preventive_action"),
  responsibleId: varchar("responsible_id").references(() => users.id),
  dueDate: timestamp("due_date"),
  closedAt: timestamp("closed_at"),
  closedBy: varchar("closed_by").references(() => users.id),
  verificationDate: timestamp("verification_date"),
  verifiedBy: varchar("verified_by").references(() => users.id),
  effectivenessVerified: integer("effectiveness_verified").default(0),
  status: varchar("status", { length: 50 }).default("aberta"), // aberta, em_tratamento, pendente_verificacao, fechada, cancelada
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Gestão de Documentos da Qualidade - QMS (RF-QC02)
export const qualityDocuments = pgTable("quality_documents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  documentCode: varchar("document_code", { length: 50 }).notNull(), // FT-xx, PG-xx, IT-xx
  title: varchar("title", { length: 256 }).notNull(),
  type: varchar("type", { length: 50 }), // formulario, procedimento, instrucao, manual, registro
  category: varchar("category", { length: 100 }), // qualidade, operacional, administrativo, tecnico
  version: varchar("version", { length: 20 }).default("01"),
  revisionNumber: integer("revision_number").default(0),
  status: varchar("status", { length: 50 }).default("vigente"), // rascunho, em_revisao, aprovado, vigente, obsoleto
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"),
  nextReviewDate: timestamp("next_review_date"),
  author: varchar("author", { length: 256 }),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  fileUrl: text("file_url"),
  description: text("description"),
  keywords: text("keywords").array(),
  accessLevel: varchar("access_level", { length: 20 }).default("interno"), // publico, interno, restrito, confidencial
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Histórico de Revisões de Documentos
export const qualityDocumentRevisions = pgTable("quality_document_revisions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => qualityDocuments.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 20 }),
  revisionNumber: integer("revision_number"),
  changeDescription: text("change_description"),
  revisedBy: varchar("revised_by").references(() => users.id),
  revisedAt: timestamp("revised_at").default(sql`CURRENT_TIMESTAMP`),
  fileUrl: text("file_url"),
});

// Formulários de Campo Digitais (RF-OP03)
export const qualityFieldForms = pgTable("quality_field_forms", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "cascade" }),
  formType: varchar("form_type", { length: 100 }).notNull(), // plano_amostragem, pt, monitoramento_pocos, ficha_campo
  formCode: varchar("form_code", { length: 50 }),
  title: varchar("title", { length: 256 }),
  collectionDate: timestamp("collection_date"),
  location: text("location"),
  coordinates: varchar("coordinates", { length: 100 }),
  responsibleId: varchar("responsible_id").references(() => users.id),
  teamMembers: text("team_members").array(),
  weatherConditions: varchar("weather_conditions", { length: 100 }),
  formData: jsonb("form_data").$type<Record<string, any>>(), // Dados dinâmicos do formulário
  photos: text("photos").array(),
  signature: text("signature"),
  status: varchar("status", { length: 50 }).default("rascunho"), // rascunho, preenchido, revisado, aprovado
  syncedAt: timestamp("synced_at"), // Para suporte offline
  observations: text("observations"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Matriz de Treinamentos (FT-57)
export const qualityTrainingMatrix = pgTable("quality_training_matrix", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  employeeId: varchar("employee_id").references(() => users.id),
  trainingName: varchar("training_name", { length: 256 }).notNull(),
  trainingType: varchar("training_type", { length: 100 }), // obrigatorio, complementar, reciclagem
  provider: varchar("provider", { length: 256 }),
  completedDate: timestamp("completed_date"),
  expiryDate: timestamp("expiry_date"),
  certificateUrl: text("certificate_url"),
  hours: integer("hours"),
  status: varchar("status", { length: 50 }).default("pendente"), // pendente, em_andamento, concluido, vencido
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Prestação de Contas / Despesas de Campo (RF-AF05)
export const fieldExpenses = pgTable("field_expenses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  projectId: integer("project_id").references(() => pcProjects.id, { onDelete: "set null" }),
  expenseCode: varchar("expense_code", { length: 50 }),
  responsibleId: varchar("responsible_id").references(() => users.id),
  expenseDate: timestamp("expense_date"),
  category: varchar("category", { length: 100 }), // hospedagem, alimentacao, combustivel, transporte, material, outros
  description: text("description"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }), // cartao_corporativo, dinheiro, reembolso
  cardId: varchar("card_id", { length: 50 }), // ID do cartão CAJU
  receiptUrl: text("receipt_url"),
  costCenter: varchar("cost_center", { length: 100 }),
  status: varchar("status", { length: 50 }).default("pendente"), // pendente, aprovado_lider, aprovado_financeiro, pago, rejeitado
  approvedByLeader: varchar("approved_by_leader").references(() => users.id),
  approvedByLeaderAt: timestamp("approved_by_leader_at"),
  approvedByFinance: varchar("approved_by_finance").references(() => users.id),
  approvedByFinanceAt: timestamp("approved_by_finance_at"),
  rejectionReason: text("rejection_reason"),
  observations: text("observations"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas - Qualidade
export const insertQualitySampleSchema = createInsertSchema(qualitySamples).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQualityLabReportSchema = createInsertSchema(qualityLabReports).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQualityNonConformitySchema = createInsertSchema(qualityNonConformities).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQualityDocumentSchema = createInsertSchema(qualityDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQualityFieldFormSchema = createInsertSchema(qualityFieldForms).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQualityTrainingMatrixSchema = createInsertSchema(qualityTrainingMatrix).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFieldExpenseSchema = createInsertSchema(fieldExpenses).omit({ id: true, createdAt: true, updatedAt: true });

// Types - Qualidade
export type QualitySample = typeof qualitySamples.$inferSelect;
export type InsertQualitySample = z.infer<typeof insertQualitySampleSchema>;
export type QualityLabReport = typeof qualityLabReports.$inferSelect;
export type InsertQualityLabReport = z.infer<typeof insertQualityLabReportSchema>;
export type QualityNonConformity = typeof qualityNonConformities.$inferSelect;
export type InsertQualityNonConformity = z.infer<typeof insertQualityNonConformitySchema>;
export type QualityDocument = typeof qualityDocuments.$inferSelect;
export type InsertQualityDocument = z.infer<typeof insertQualityDocumentSchema>;
export type QualityFieldForm = typeof qualityFieldForms.$inferSelect;
export type InsertQualityFieldForm = z.infer<typeof insertQualityFieldFormSchema>;
export type QualityTrainingMatrix = typeof qualityTrainingMatrix.$inferSelect;
export type InsertQualityTrainingMatrix = z.infer<typeof insertQualityTrainingMatrixSchema>;
export type FieldExpense = typeof fieldExpenses.$inferSelect;
export type InsertFieldExpense = z.infer<typeof insertFieldExpenseSchema>;

// ==========================================
// SERVIÇOS AMBIENTAIS - Catálogo de Serviços
// ==========================================
export const environmentalServices = pgTable("environmental_services", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  code: varchar("code", { length: 50 }),
  name: text("name").notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // Monitoramento, Investigação, Remediação, Licenciamento, Consultoria
  basePrice: numeric("base_price", { precision: 15, scale: 2 }),
  unit: varchar("unit", { length: 50 }).default("projeto"), // projeto, campanha, hora, metro
  estimatedDuration: integer("estimated_duration"), // dias
  items: text("items").array(), // itens inclusos no serviço
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertEnvironmentalServiceSchema = createInsertSchema(environmentalServices).omit({ id: true, createdAt: true, updatedAt: true });
export type EnvironmentalService = typeof environmentalServices.$inferSelect;
export type InsertEnvironmentalService = z.infer<typeof insertEnvironmentalServiceSchema>;

// ==========================================
// ARCÁDIA LOW-CODE - Sistema de Metadados
// ==========================================

// DocTypes - Define tipos de dados/entidades customizáveis
export const arcDocTypes = pgTable("arc_doctypes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(), // Nome técnico (snake_case): controle_ponto
  label: varchar("label", { length: 200 }).notNull(), // Nome exibição: Controle de Ponto
  module: varchar("module", { length: 100 }), // Módulo pai: hrm, qualidade, comercial
  description: text("description"),
  icon: varchar("icon", { length: 50 }).default("FileText"), // Lucide icon name
  color: varchar("color", { length: 20 }).default("blue"),
  isSubmittable: boolean("is_submittable").default(false), // Requer workflow de aprovação
  isChild: boolean("is_child").default(false), // É tabela filho de outro doctype
  parentDocType: integer("parent_doctype_id"),
  isSingle: boolean("is_single").default(false), // Apenas um registro (configurações)
  isTree: boolean("is_tree").default(false), // Estrutura hierárquica
  trackChanges: boolean("track_changes").default(true),
  allowImport: boolean("allow_import").default(true),
  allowExport: boolean("allow_export").default(true),
  hasWebView: boolean("has_web_view").default(true), // Gerar página automaticamente
  permissions: jsonb("permissions").$type<{ role: string; read: boolean; write: boolean; delete: boolean; }[]>(),
  hooks: jsonb("hooks").$type<{ event: string; script: string; }[]>(), // before_save, after_save, validate
  status: varchar("status", { length: 20 }).default("active"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Fields - Define campos de cada DocType
export const arcFields = pgTable("arc_fields", {
  id: serial("id").primaryKey(),
  docTypeId: integer("doctype_id").references(() => arcDocTypes.id, { onDelete: "cascade" }).notNull(),
  fieldName: varchar("field_name", { length: 100 }).notNull(), // Nome técnico: data_entrada
  label: varchar("label", { length: 200 }).notNull(), // Label: Data de Entrada
  fieldType: varchar("field_type", { length: 50 }).notNull(), // text, number, date, datetime, select, link, table, etc.
  options: text("options"), // Para select: opções separadas por \n; Para link: nome do DocType relacionado
  defaultValue: text("default_value"),
  mandatory: boolean("mandatory").default(false),
  unique: boolean("unique").default(false),
  readOnly: boolean("read_only").default(false),
  hidden: boolean("hidden").default(false),
  inListView: boolean("in_list_view").default(false), // Exibir na listagem
  inFilter: boolean("in_filter").default(false), // Usar como filtro
  searchable: boolean("searchable").default(false),
  sortOrder: integer("sort_order").default(0),
  section: varchar("section", { length: 100 }), // Agrupamento visual
  column: integer("column").default(1), // 1 ou 2 (layout em colunas)
  width: varchar("width", { length: 20 }), // full, half, third
  placeholder: text("placeholder"),
  helpText: text("help_text"),
  validation: jsonb("validation").$type<{ min?: number; max?: number; pattern?: string; message?: string; }>(),
  depends_on: text("depends_on"), // Expressão para exibição condicional
  fetchFrom: text("fetch_from"), // Auto-preencher de link: customer.customer_name
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Pages - Define páginas customizadas
export const arcPages = pgTable("arc_pages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(), // Nome técnico: dashboard_vendas
  title: varchar("title", { length: 200 }).notNull(), // Título: Dashboard de Vendas
  route: varchar("route", { length: 200 }).notNull(), // /app/vendas-dashboard
  pageType: varchar("page_type", { length: 50 }).default("page"), // page, form, list, report, dashboard
  docType: integer("doctype_id").references(() => arcDocTypes.id), // Se for form/list de um DocType
  icon: varchar("icon", { length: 50 }),
  module: varchar("module", { length: 100 }),
  isPublic: boolean("is_public").default(false),
  roles: text("roles").array(), // Roles que podem acessar
  layout: jsonb("layout").$type<any>(), // Configuração do layout (widgets, posições)
  script: text("script"), // Script customizado (JS)
  style: text("style"), // CSS customizado
  status: varchar("status", { length: 20 }).default("active"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Layouts - Templates de layout reutilizáveis
export const arcLayouts = pgTable("arc_layouts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  layoutType: varchar("layout_type", { length: 50 }).default("form"), // form, list, dashboard, report
  config: jsonb("config").$type<any>().notNull(), // Configuração JSON do layout
  isDefault: boolean("is_default").default(false),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Widgets - Componentes reutilizáveis para páginas
export const arcWidgets = pgTable("arc_widgets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  widgetType: varchar("widget_type", { length: 50 }).notNull(), // chart, table, kpi, form, list, custom
  category: varchar("category", { length: 50 }), // dashboard, report, form
  icon: varchar("icon", { length: 50 }),
  config: jsonb("config").$type<any>(), // Configuração específica do widget
  dataSource: jsonb("data_source").$type<{ type: string; doctype?: string; query?: string; endpoint?: string; }>(),
  isSystem: boolean("is_system").default(false),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Scripts - Scripts customizados para automações
export const arcScripts = pgTable("arc_scripts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  docTypeId: integer("doctype_id").references(() => arcDocTypes.id),
  scriptType: varchar("script_type", { length: 50 }).notNull(), // client, server, form, list, report
  triggerEvent: varchar("trigger_event", { length: 50 }), // before_save, after_save, on_load, validate
  script: text("script").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Workflows - Automações visuais no-code
export const arcWorkflows = pgTable("arc_workflows", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  nodes: jsonb("nodes").$type<any[]>().default([]),
  status: varchar("status", { length: 50 }).default("draft"), // draft, active, inactive, deleted
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas e types
export const insertArcDocTypeSchema = createInsertSchema(arcDocTypes).omit({ id: true, createdAt: true, updatedAt: true });
export type ArcDocType = typeof arcDocTypes.$inferSelect;
export type InsertArcDocType = z.infer<typeof insertArcDocTypeSchema>;

export const insertArcFieldSchema = createInsertSchema(arcFields).omit({ id: true, createdAt: true });
export type ArcField = typeof arcFields.$inferSelect;
export type InsertArcField = z.infer<typeof insertArcFieldSchema>;

export const insertArcPageSchema = createInsertSchema(arcPages).omit({ id: true, createdAt: true, updatedAt: true });
export type ArcPage = typeof arcPages.$inferSelect;
export type InsertArcPage = z.infer<typeof insertArcPageSchema>;

export const insertArcLayoutSchema = createInsertSchema(arcLayouts).omit({ id: true, createdAt: true });
export type ArcLayout = typeof arcLayouts.$inferSelect;
export type InsertArcLayout = z.infer<typeof insertArcLayoutSchema>;

export const insertArcWidgetSchema = createInsertSchema(arcWidgets).omit({ id: true, createdAt: true });
export type ArcWidget = typeof arcWidgets.$inferSelect;
export type InsertArcWidget = z.infer<typeof insertArcWidgetSchema>;

export const insertArcScriptSchema = createInsertSchema(arcScripts).omit({ id: true, createdAt: true, updatedAt: true });
export type ArcScript = typeof arcScripts.$inferSelect;
export type InsertArcScript = z.infer<typeof insertArcScriptSchema>;

export const insertArcWorkflowSchema = createInsertSchema(arcWorkflows).omit({ id: true, createdAt: true, updatedAt: true });
export type ArcWorkflow = typeof arcWorkflows.$inferSelect;
export type InsertArcWorkflow = z.infer<typeof insertArcWorkflowSchema>;

// ========== ARCÁDIA RETAIL - LOJA E ASSISTÊNCIA DE CELULARES ==========

// Stores - Lojas da rede de franquia
export const retailStores = pgTable("retail_stores", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  storeType: varchar("store_type", { length: 50 }).default("store"), // holding, distributor, store
  parentStoreId: integer("parent_store_id"),
  warehouseId: integer("warehouse_id"),
  cnpj: varchar("cnpj", { length: 20 }),
  legalName: varchar("legal_name", { length: 200 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 100 }),
  managerId: varchar("manager_id"),
  posEnabled: boolean("pos_enabled").default(true),
  serviceEnabled: boolean("service_enabled").default(true),
  leaseEnabled: boolean("lease_enabled").default(false),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Warehouses - Depósitos/Armazéns
export const retailWarehouses = pgTable("retail_warehouses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  storeId: integer("store_id").references(() => retailStores.id), // Opcional - pode ser depósito central
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 30 }).default("store"), // store, central, transit, virtual
  parentStoreId: integer("parent_store_id").references(() => retailStores.id),
  isMainWarehouse: boolean("is_main_warehouse").default(false),
  isDefault: boolean("is_default").default(false),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  phone: varchar("phone", { length: 20 }),
  responsibleId: varchar("responsible_id").references(() => users.id),
  managerId: varchar("manager_id"),
  isActive: boolean("is_active").default(true),
  allowNegativeStock: boolean("allow_negative_stock").default(false),
  visibleToAllCompanies: boolean("visible_to_all_companies").default(true), // Visível para todo o grupo
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Mobile Devices - Celulares com IMEI
export const mobileDevices = pgTable("mobile_devices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  productId: integer("product_id").references(() => products.id),
  imei: varchar("imei", { length: 20 }).notNull(),
  imei2: varchar("imei2", { length: 20 }),
  brand: varchar("brand", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  color: varchar("color", { length: 50 }),
  storage: varchar("storage", { length: 20 }),
  ram: varchar("ram", { length: 20 }),
  condition: varchar("condition", { length: 20 }).default("new"), // new, refurbished, used
  purchaseDate: date("purchase_date"),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }),
  warrantyExpiry: date("warranty_expiry"),
  warehouseId: integer("warehouse_id").references(() => retailWarehouses.id),
  storeId: integer("store_id").references(() => retailStores.id),
  status: varchar("status", { length: 20 }).default("in_stock"), // in_stock, sold, in_service, returned, damaged, leased
  soldDate: date("sold_date"),
  soldToCustomer: varchar("sold_to_customer"),
  lastServiceDate: date("last_service_date"),
  notes: text("notes"),
  // Campos de Origem/Aquisição (Phase 0)
  acquisitionType: varchar("acquisition_type", { length: 20 }).default("purchase"), // trade_in, purchase, consignment, internal_transfer
  acquisitionCost: numeric("acquisition_cost", { precision: 12, scale: 2 }),
  relatedEvaluationId: integer("related_evaluation_id"), // Link com avaliação Trade-In
  relatedServiceOrderId: integer("related_service_order_id"), // Link com O.S. de revisão
  personId: integer("person_id"), // Referência à pessoa unificada (fornecedor/cliente origem)
  suggestedPrice: numeric("suggested_price", { precision: 12, scale: 2 }), // Preço sugerido baseado em margem
  profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }), // Margem de lucro configurada
  // ERPNext Sync Fields
  erpnextItemCode: varchar("erpnext_item_code", { length: 140 }),
  erpnextSerialNo: varchar("erpnext_serial_no", { length: 140 }),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Device Evaluations - Avaliação de Trade-In
export const deviceEvaluations = pgTable("device_evaluations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  storeId: integer("store_id").references(() => retailStores.id),
  imei: varchar("imei", { length: 20 }).notNull(),
  brand: varchar("brand", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  color: varchar("color", { length: 50 }),
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name", { length: 200 }),
  customerPhone: varchar("customer_phone", { length: 20 }),
  personId: integer("person_id"), // Referência à pessoa unificada
  evaluationDate: date("evaluation_date").default(sql`CURRENT_DATE`),
  // Checklist completo de avaliação
  powerOn: boolean("power_on").default(true), // Aparelho liga corretamente
  powerOnNotes: text("power_on_notes"),
  screenIssues: boolean("screen_issues").default(false), // Avarias, travamentos ou toque fantasma
  screenIssuesNotes: text("screen_issues_notes"),
  screenSpots: boolean("screen_spots").default(false), // Manchas na tela
  screenSpotsNotes: text("screen_spots_notes"),
  buttonsWorking: boolean("buttons_working").default(true), // Botões funcionando
  buttonsWorkingNotes: text("buttons_working_notes"),
  wearMarks: boolean("wear_marks").default(false), // Marcas de uso
  wearMarksNotes: text("wear_marks_notes"),
  wifiWorking: boolean("wifi_working").default(true), // Wi-Fi funcionando
  wifiWorkingNotes: text("wifi_working_notes"),
  simWorking: boolean("sim_working").default(true), // Chip funcionando
  simWorkingNotes: text("sim_working_notes"),
  mobileDataWorking: boolean("mobile_data_working").default(true), // 4G/5G funcionando
  mobileDataWorkingNotes: text("mobile_data_working_notes"),
  sensorsNfcWorking: boolean("sensors_nfc_working").default(true), // Sensores funcionando / NFC
  sensorsNfcWorkingNotes: text("sensors_nfc_working_notes"),
  biometricWorking: boolean("biometric_working").default(true), // Face ID / Touch ID funcionando
  biometricWorkingNotes: text("biometric_working_notes"),
  microphonesWorking: boolean("microphones_working").default(true), // Microfones funcionando
  microphonesWorkingNotes: text("microphones_working_notes"),
  earSpeakerWorking: boolean("ear_speaker_working").default(true), // Áudio auricular funcionando
  earSpeakerWorkingNotes: text("ear_speaker_working_notes"),
  loudspeakerWorking: boolean("loudspeaker_working").default(true), // Áudio alto-falante funcionando
  loudspeakerWorkingNotes: text("loudspeaker_working_notes"),
  chargingPortWorking: boolean("charging_port_working").default(true), // Entrada de carregamento funcionando
  chargingPortWorkingNotes: text("charging_port_working_notes"),
  camerasWorking: boolean("cameras_working").default(true), // Câmeras funcionando / Manchas
  camerasWorkingNotes: text("cameras_working_notes"),
  flashWorking: boolean("flash_working").default(true), // Flash funcionando
  flashWorkingNotes: text("flash_working_notes"),
  hasCharger: boolean("has_charger").default(false), // Possui carregador
  hasChargerNotes: text("has_charger_notes"),
  toolsAnalysisOk: boolean("tools_analysis_ok").default(true), // Análise pelo 3uTools OK
  toolsAnalysisNotes: text("tools_analysis_notes"),
  batteryHealth: integer("battery_health"), // Saúde da Bateria 0-100%
  batteryHealthNotes: text("battery_health_notes"),
  // Campos legados mantidos para compatibilidade
  screenCondition: varchar("screen_condition", { length: 20 }),
  bodyCondition: varchar("body_condition", { length: 20 }),
  overallCondition: varchar("overall_condition", { length: 20 }),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
  approved: boolean("approved").default(false),
  rejectionReason: text("rejection_reason"),
  evaluatedBy: varchar("evaluated_by"),
  approvedBy: varchar("approved_by"),
  deviceId: integer("device_id").references(() => mobileDevices.id), // Quando aprovado, cria dispositivo
  status: varchar("status", { length: 20 }).default("pending"), // pending, analyzing, approved, rejected
  diagnosisStatus: varchar("diagnosis_status", { length: 20 }).default("pending"), // pending, in_progress, completed
  checklistData: jsonb("checklist_data"), // Dados completos do checklist de avaliação
  linkedServiceOrderId: integer("linked_service_order_id"), // O.S. de diagnóstico vinculada
  maintenanceOrderId: integer("maintenance_order_id"), // O.S. de manutenção interna após aprovação
  acquisitionValue: numeric("acquisition_value", { precision: 12, scale: 2 }), // Valor final de aquisição (pode ser diferente do estimado)
  creditGenerated: boolean("credit_generated").default(false), // Se já gerou crédito para o cliente
  creditId: integer("credit_id"), // ID do crédito gerado
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Service Orders - Ordens de Serviço
export const serviceOrders = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  orderNumber: varchar("order_number", { length: 20 }).notNull(),
  storeId: integer("store_id").references(() => retailStores.id),
  deviceId: integer("device_id").references(() => mobileDevices.id),
  imei: varchar("imei", { length: 20 }).notNull(),
  brand: varchar("brand", { length: 50 }),
  model: varchar("model", { length: 100 }),
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name", { length: 200 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }),
  customerEmail: varchar("customer_email", { length: 100 }),
  personId: integer("person_id"), // Referência à pessoa unificada
  serviceType: varchar("service_type", { length: 50 }).default("repair"), // repair, maintenance, internal_review, diagnostic
  issueDescription: text("issue_description").notNull(),
  diagnosisNotes: text("diagnosis_notes"),
  origin: varchar("origin", { length: 50 }).default("customer_request"), // customer_request, device_acquisition, warranty
  assignedTo: varchar("assigned_to"),
  technicianName: varchar("technician_name", { length: 200 }),
  technicianPersonId: integer("technician_person_id"), // Referência ao técnico (pessoa)
  partsCost: numeric("parts_cost", { precision: 12, scale: 2 }).default("0"),
  laborCost: numeric("labor_cost", { precision: 12, scale: 2 }).default("0"),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).default("0"),
  expectedCompletionDate: date("expected_completion_date"),
  actualCompletionDate: date("actual_completion_date"),
  paymentStatus: varchar("payment_status", { length: 20 }).default("pending"), // pending, paid, partial
  status: varchar("status", { length: 20 }).default("open"), // open, diagnosis, quote, pending_approval, approved, rejected, in_repair, waiting_parts, quality_check, ready_pickup, completed, cancelled
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent
  // Campos para O.S. Interna (Phase 0)
  isInternal: boolean("is_internal").default(false), // true = O.S. interna (revisão trade-in)
  internalType: varchar("internal_type", { length: 30 }), // revision, cleaning, maintenance, quality_check, trade_in_diagnosis, trade_in_maintenance
  sourceEvaluationId: integer("source_evaluation_id"), // Link com avaliação Trade-In que originou esta O.S.
  evaluationStatus: varchar("evaluation_status", { length: 30 }).default("pending"), // pending, in_analysis, approved, rejected
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }), // Valor estimado inicial
  evaluatedValue: numeric("evaluated_value", { precision: 12, scale: 2 }), // Valor avaliado final
  // Campos de Checklist unificado
  checklistData: jsonb("checklist_data"), // Dados do checklist de avaliação/diagnóstico
  checklistCompletedAt: timestamp("checklist_completed_at"), // Quando o checklist foi finalizado
  checklistCompletedBy: varchar("checklist_completed_by"), // Quem finalizou o checklist
  // ERPNext Sync Fields
  erpnextDocType: varchar("erpnext_doc_type", { length: 50 }), // Maintenance Visit, Work Order, etc.
  erpnextDocName: varchar("erpnext_doc_name", { length: 140 }),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Service Order Items - Peças/Serviços da OS
export const serviceOrderItems = pgTable("service_order_items", {
  id: serial("id").primaryKey(),
  serviceOrderId: integer("service_order_id").references(() => serviceOrders.id).notNull(),
  productId: integer("product_id").references(() => products.id),
  itemType: varchar("item_type", { length: 20 }).default("part"), // part, labor, accessory
  itemCode: varchar("item_code", { length: 50 }),
  itemName: varchar("item_name", { length: 200 }).notNull(),
  quantity: integer("quantity").default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"), // pending, applied, removed
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// POS Sessions - Sessões de Caixa
export const posSessions = pgTable("pos_sessions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  storeId: integer("store_id").references(() => retailStores.id).notNull(),
  cashierId: varchar("cashier_id").notNull(),
  cashierName: varchar("cashier_name", { length: 200 }),
  sessionStartTime: timestamp("session_start_time").default(sql`CURRENT_TIMESTAMP`).notNull(),
  sessionEndTime: timestamp("session_end_time"),
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).default("0"),
  closingBalance: numeric("closing_balance", { precision: 12, scale: 2 }),
  totalSales: numeric("total_sales", { precision: 12, scale: 2 }).default("0"),
  totalRefunds: numeric("total_refunds", { precision: 12, scale: 2 }).default("0"),
  netSales: numeric("net_sales", { precision: 12, scale: 2 }).default("0"),
  cashPayments: numeric("cash_payments", { precision: 12, scale: 2 }).default("0"),
  cardPayments: numeric("card_payments", { precision: 12, scale: 2 }).default("0"),
  pixPayments: numeric("pix_payments", { precision: 12, scale: 2 }).default("0"),
  otherPayments: numeric("other_payments", { precision: 12, scale: 2 }).default("0"),
  transactionCount: integer("transaction_count").default(0),
  status: varchar("status", { length: 20 }).default("open"), // open, closed, reconciled
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// POS Sales - Vendas do PDV
export const posSales = pgTable("pos_sales", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  sessionId: integer("session_id").references(() => posSessions.id),
  storeId: integer("store_id").references(() => retailStores.id).notNull(),
  saleNumber: varchar("sale_number", { length: 20 }).notNull(),
  saleType: varchar("sale_type", { length: 20 }).default("direct_sale"), // direct_sale, lease_to_own
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name", { length: 200 }),
  customerPhone: varchar("customer_phone", { length: 20 }),
  customerCpf: varchar("customer_cpf", { length: 14 }),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).default("0"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0"),
  tradeInValue: numeric("trade_in_value", { precision: 12, scale: 2 }).default("0"),
  tradeInEvaluationId: integer("trade_in_evaluation_id").references(() => deviceEvaluations.id),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }), // cash, debit, credit, pix, combined
  paymentDetails: jsonb("payment_details").$type<any>(),
  installments: integer("installments").default(1),
  paymentPlanId: integer("payment_plan_id"),
  status: varchar("status", { length: 20 }).default("completed"), // pending, completed, cancelled, refunded
  soldBy: varchar("sold_by"),
  notes: text("notes"),
  plusVendaId: integer("plus_venda_id"),
  plusNfeChave: varchar("plus_nfe_chave", { length: 60 }),
  plusSyncStatus: varchar("plus_sync_status", { length: 20 }).default("pending"), // pending, synced, error, not_applicable
  plusSyncError: text("plus_sync_error"),
  plusSyncedAt: timestamp("plus_synced_at"),
  empresaId: integer("empresa_id").references(() => tenantEmpresas.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// POS Sale Items - Itens da Venda
export const posSaleItems = pgTable("pos_sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").references(() => posSales.id).notNull(),
  itemType: varchar("item_type", { length: 20 }).default("product"), // product, device, accessory, service
  itemCode: varchar("item_code", { length: 50 }),
  itemName: varchar("item_name", { length: 200 }).notNull(),
  imei: varchar("imei", { length: 20 }),
  deviceId: integer("device_id").references(() => mobileDevices.id),
  quantity: integer("quantity").default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).default("0"),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Payment Plans - Planos de Pagamento/Parcelamento
export const paymentPlans = pgTable("payment_plans", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  saleId: integer("sale_id").references(() => posSales.id),
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name", { length: 200 }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  downPayment: numeric("down_payment", { precision: 12, scale: 2 }).default("0"),
  remainingAmount: numeric("remaining_amount", { precision: 12, scale: 2 }).notNull(),
  numberOfInstallments: integer("number_of_installments").notNull(),
  installmentAmount: numeric("installment_amount", { precision: 12, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).default("0"),
  firstInstallmentDate: date("first_installment_date").notNull(),
  paidInstallments: integer("paid_installments").default(0),
  totalPaid: numeric("total_paid", { precision: 12, scale: 2 }).default("0"),
  status: varchar("status", { length: 20 }).default("active"), // active, completed, defaulted, cancelled
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Payment Plan Installments - Parcelas do Plano
export const paymentPlanInstallments = pgTable("payment_plan_installments", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").references(() => paymentPlans.id).notNull(),
  installmentNumber: integer("installment_number").notNull(),
  dueDate: date("due_date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default("0"),
  paidDate: date("paid_date"),
  paymentMethod: varchar("payment_method", { length: 50 }),
  status: varchar("status", { length: 20 }).default("pending"), // pending, paid, overdue, cancelled
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Lease Agreements - Contratos de Locação com Opção de Compra
export const leaseAgreements = pgTable("lease_agreements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  storeId: integer("store_id").references(() => retailStores.id),
  agreementNumber: varchar("agreement_number", { length: 20 }).notNull(),
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name", { length: 200 }).notNull(),
  customerCpf: varchar("customer_cpf", { length: 14 }),
  customerPhone: varchar("customer_phone", { length: 20 }),
  deviceId: integer("device_id").references(() => mobileDevices.id).notNull(),
  imei: varchar("imei", { length: 20 }).notNull(),
  leaseStartDate: date("lease_start_date").notNull(),
  leaseEndDate: date("lease_end_date").notNull(),
  numberOfMonths: integer("number_of_months").notNull(),
  monthlyPayment: numeric("monthly_payment", { precision: 12, scale: 2 }).notNull(),
  totalLeaseCost: numeric("total_lease_cost", { precision: 12, scale: 2 }).notNull(),
  purchaseOptionAvailable: boolean("purchase_option_available").default(true),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
  purchasePriceIncludesPaidRent: boolean("purchase_price_includes_paid_rent").default(false),
  rentCreditPercent: numeric("rent_credit_percent", { precision: 5, scale: 2 }).default("50"),
  paidMonths: integer("paid_months").default(0),
  totalPaid: numeric("total_paid", { precision: 12, scale: 2 }).default("0"),
  status: varchar("status", { length: 20 }).default("active"), // active, completed, purchased, cancelled, defaulted
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Lease Payments - Pagamentos de Locação
export const leasePayments = pgTable("lease_payments", {
  id: serial("id").primaryKey(),
  leaseId: integer("lease_id").references(() => leaseAgreements.id).notNull(),
  paymentNumber: integer("payment_number").notNull(),
  dueDate: date("due_date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default("0"),
  paidDate: date("paid_date"),
  paymentMethod: varchar("payment_method", { length: 50 }),
  status: varchar("status", { length: 20 }).default("pending"), // pending, paid, overdue
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Stock Transfers - Transferências de Estoque entre Lojas
export const stockTransfers = pgTable("stock_transfers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  transferNumber: varchar("transfer_number", { length: 20 }).notNull(),
  fromWarehouseId: integer("from_warehouse_id").references(() => retailWarehouses.id),
  fromStoreId: integer("from_store_id").references(() => retailStores.id),
  toWarehouseId: integer("to_warehouse_id").references(() => retailWarehouses.id),
  toStoreId: integer("to_store_id").references(() => retailStores.id),
  requestedDate: date("requested_date").default(sql`CURRENT_DATE`),
  shippedDate: date("shipped_date"),
  receivedDate: date("received_date"),
  trackingNumber: varchar("tracking_number", { length: 100 }),
  totalItems: integer("total_items").default(0),
  requestedBy: varchar("requested_by"),
  approvedBy: varchar("approved_by"),
  receivedBy: varchar("received_by"),
  status: varchar("status", { length: 20 }).default("draft"), // draft, submitted, approved, in_transit, received, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Stock Transfer Items - Itens da Transferência
export const stockTransferItems = pgTable("stock_transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").references(() => stockTransfers.id).notNull(),
  deviceId: integer("device_id").references(() => mobileDevices.id).notNull(),
  imei: varchar("imei", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"), // pending, shipped, received
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Return/Exchange - Devoluções e Trocas
export const returnExchanges = pgTable("return_exchanges", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  storeId: integer("store_id").references(() => retailStores.id),
  returnNumber: varchar("return_number", { length: 20 }).notNull(),
  originalSaleId: integer("original_sale_id").references(() => posSales.id),
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name", { length: 200 }),
  returnType: varchar("return_type", { length: 20 }).default("return"), // return, exchange
  reason: text("reason"),
  refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }).default("0"),
  refundMethod: varchar("refund_method", { length: 50 }),
  processedBy: varchar("processed_by"),
  returnDate: date("return_date").default(sql`CURRENT_DATE`),
  processedDate: date("processed_date"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, approved, rejected, processed
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Return Exchange Items - Itens da Devolução
export const returnExchangeItems = pgTable("return_exchange_items", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id").references(() => returnExchanges.id).notNull(),
  itemCode: varchar("item_code", { length: 50 }),
  itemName: varchar("item_name", { length: 200 }).notNull(),
  quantity: integer("quantity").default(1),
  imei: varchar("imei", { length: 20 }),
  deviceId: integer("device_id").references(() => mobileDevices.id),
  reason: text("reason"),
  refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Device History - Histórico de Movimentação do IMEI
export const deviceHistory = pgTable("device_history", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => mobileDevices.id).notNull(),
  imei: varchar("imei", { length: 20 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // received, transferred, sold, returned, service_in, service_out, leased, purchased
  eventDate: timestamp("event_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  fromLocation: varchar("from_location", { length: 100 }),
  toLocation: varchar("to_location", { length: 100 }),
  referenceType: varchar("reference_type", { length: 50 }), // sale, transfer, service_order, lease
  referenceId: integer("reference_id"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== RETAIL CADASTROS ==========

// Formas de Pagamento e Taxas
export const retailPaymentMethods = pgTable("retail_payment_methods", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(), // cash, debit, credit, pix, boleto, financing
  brand: varchar("brand", { length: 50 }), // visa, mastercard, elo, amex, hipercard
  feePercent: numeric("fee_percent", { precision: 5, scale: 2 }).default("0"),
  fixedFee: numeric("fixed_fee", { precision: 12, scale: 2 }).default("0"),
  installmentsMax: integer("installments_max").default(1),
  installmentFees: jsonb("installment_fees").$type<{installments: number; feePercent: number}[]>(),
  daysToReceive: integer("days_to_receive").default(1),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Vendedores
export const retailSellers = pgTable("retail_sellers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  personId: integer("person_id").references(() => persons.id),
  code: varchar("code", { length: 20 }),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  storeId: integer("store_id").references(() => retailStores.id),
  commissionPlanId: integer("commission_plan_id"),
  hireDate: date("hire_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Planos de Comissão
export const retailCommissionPlans = pgTable("retail_commission_plans", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 30 }).notNull(), // fixed, percent, tiered, per_product
  baseValue: numeric("base_value", { precision: 12, scale: 2 }).default("0"),
  basePercent: numeric("base_percent", { precision: 5, scale: 2 }).default("0"),
  rules: jsonb("rules").$type<any>(), // Regras específicas (tiers, produtos, categorias)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Metas de Vendedor
export const retailSellerGoals = pgTable("retail_seller_goals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  sellerId: integer("seller_id").references(() => retailSellers.id),
  storeId: integer("store_id").references(() => retailStores.id),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  goalAmount: numeric("goal_amount", { precision: 14, scale: 2 }).notNull(),
  goalType: varchar("goal_type", { length: 20 }).default("sales"), // sales, units, margin
  achievedAmount: numeric("achieved_amount", { precision: 14, scale: 2 }).default("0"),
  achievedPercent: numeric("achieved_percent", { precision: 5, scale: 2 }).default("0"),
  bonus: numeric("bonus", { precision: 12, scale: 2 }).default("0"), // bônus por atingir meta
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Meta da Loja
export const retailStoreGoals = pgTable("retail_store_goals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  storeId: integer("store_id").references(() => retailStores.id),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  goalAmount: numeric("goal_amount", { precision: 14, scale: 2 }).notNull(),
  achievedAmount: numeric("achieved_amount", { precision: 14, scale: 2 }).default("0"),
  achievedPercent: numeric("achieved_percent", { precision: 5, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Fechamento de Comissão
export const retailCommissionClosures = pgTable("retail_commission_closures", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  storeId: integer("store_id").references(() => retailStores.id),
  sellerId: integer("seller_id").references(() => retailSellers.id),
  periodType: varchar("period_type", { length: 20 }).notNull(), // daily, monthly, custom
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  totalSales: numeric("total_sales", { precision: 14, scale: 2 }).default("0"),
  totalReturns: numeric("total_returns", { precision: 14, scale: 2 }).default("0"), // devoluções deduzidas
  netSales: numeric("net_sales", { precision: 14, scale: 2 }).default("0"), // vendas líquidas
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).default("0"),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).default("0"),
  bonusAmount: numeric("bonus_amount", { precision: 12, scale: 2 }).default("0"), // bônus por meta
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0"), // comissão + bônus
  salesCount: integer("sales_count").default(0),
  returnsCount: integer("returns_count").default(0),
  status: varchar("status", { length: 20 }).default("open"), // open, closed, paid
  closedAt: timestamp("closed_at"),
  closedBy: integer("closed_by"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Itens do Fechamento (vendas incluídas)
export const retailCommissionClosureItems = pgTable("retail_commission_closure_items", {
  id: serial("id").primaryKey(),
  closureId: integer("closure_id").references(() => retailCommissionClosures.id).notNull(),
  saleId: integer("sale_id").references(() => posSales.id),
  returnId: integer("return_id").references(() => returnExchanges.id),
  itemType: varchar("item_type", { length: 20 }).notNull(), // sale, return
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  commission: numeric("commission", { precision: 12, scale: 2 }).default("0"),
  originalDate: timestamp("original_date"), // data original da venda (para devoluções)
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Tabelas de Preço
export const retailPriceTables = pgTable("retail_price_tables", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 20 }),
  description: text("description"),
  customerType: varchar("customer_type", { length: 50 }), // retail, wholesale, vip, employee
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0"),
  markupPercent: numeric("markup_percent", { precision: 5, scale: 2 }).default("0"),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Preços por Tabela (preços específicos por produto/tabela)
export const retailPriceTableItems = pgTable("retail_price_table_items", {
  id: serial("id").primaryKey(),
  priceTableId: integer("price_table_id").references(() => retailPriceTables.id).notNull(),
  productId: integer("product_id"),
  deviceId: integer("device_id").references(() => mobileDevices.id),
  productCode: varchar("product_code", { length: 50 }),
  customPrice: numeric("custom_price", { precision: 12, scale: 2 }),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Promoções
export const retailPromotions = pgTable("retail_promotions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 30 }).notNull(), // percent_off, fixed_off, buy_x_get_y, bundle
  discountValue: numeric("discount_value", { precision: 12, scale: 2 }),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }),
  applyTo: varchar("apply_to", { length: 30 }).default("all"), // all, category, product, brand
  applyToIds: jsonb("apply_to_ids").$type<number[]>(),
  priceTableId: integer("price_table_id").references(() => retailPriceTables.id),
  minQuantity: integer("min_quantity").default(1),
  maxQuantity: integer("max_quantity"),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Tipos de Produtos (Dispositivos e Acessórios) com atributos fiscais
export const retailProductTypes = pgTable("retail_product_types", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 30 }).notNull(), // device, accessory, part, service
  
  // Controle de série/IMEI
  requiresImei: boolean("requires_imei").default(false),
  requiresSerial: boolean("requires_serial").default(false),
  
  // Atributos fiscais padrão
  ncm: varchar("ncm", { length: 10 }),
  cest: varchar("cest", { length: 9 }),
  origem: integer("origem").default(0), // 0=Nacional, 1=Estrangeira importação direta, 2=Estrangeira adquirida mercado interno, etc.
  
  // CST/CSOSN ICMS
  cstIcms: varchar("cst_icms", { length: 3 }), // 00, 10, 20, 30, 40, 41, 50, 51, 60, 70, 90
  csosn: varchar("csosn", { length: 3 }), // 101, 102, 103, 201, 202, 203, 300, 400, 500, 900 (Simples Nacional)
  
  // CFOPs padrão
  cfopVendaEstadual: varchar("cfop_venda_estadual", { length: 4 }).default("5102"),
  cfopVendaInterestadual: varchar("cfop_venda_interestadual", { length: 4 }).default("6102"),
  cfopDevolucaoEstadual: varchar("cfop_devolucao_estadual", { length: 4 }).default("1202"),
  cfopDevolucaoInterestadual: varchar("cfop_devolucao_interestadual", { length: 4 }).default("2202"),
  
  // Alíquotas padrão (pode ser sobrescrito pelo grupo tributário)
  aliqIcms: numeric("aliq_icms", { precision: 5, scale: 2 }),
  aliqPis: numeric("aliq_pis", { precision: 5, scale: 4 }).default("0.65"),
  aliqCofins: numeric("aliq_cofins", { precision: 5, scale: 4 }).default("3.00"),
  aliqIpi: numeric("aliq_ipi", { precision: 5, scale: 2 }).default("0"),
  
  // Reforma Tributária - IBS e CBS (Substituem PIS/COFINS/ICMS gradualmente)
  classTribIbs: varchar("class_trib_ibs", { length: 20 }), // Classificação tributária IBS
  aliqIbs: numeric("aliq_ibs", { precision: 5, scale: 2 }), // Alíquota IBS (estados/municípios)
  classTribCbs: varchar("class_trib_cbs", { length: 20 }), // Classificação tributária CBS
  aliqCbs: numeric("aliq_cbs", { precision: 5, scale: 2 }), // Alíquota CBS (federal)
  
  // Vínculo com grupo tributário (fallback)
  taxGroupId: integer("tax_group_id").references(() => fiscalGruposTributacao.id),
  
  // Unidade de medida padrão
  unidadeMedida: varchar("unidade_medida", { length: 6 }).default("UN"),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Aquisições (Compras/Trade-In prontos para estoque)
export const retailAcquisitions = pgTable("retail_acquisitions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  acquisitionNumber: varchar("acquisition_number", { length: 20 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(), // trade_in, purchase, consignment
  sourceEvaluationId: integer("source_evaluation_id").references(() => deviceEvaluations.id),
  sourceServiceOrderId: integer("source_service_order_id").references(() => serviceOrders.id),
  deviceId: integer("device_id").references(() => mobileDevices.id),
  imei: varchar("imei", { length: 20 }),
  brand: varchar("brand", { length: 50 }),
  model: varchar("model", { length: 100 }),
  condition: varchar("condition", { length: 30 }),
  acquisitionCost: numeric("acquisition_cost", { precision: 12, scale: 2 }).default("0"),
  repairCost: numeric("repair_cost", { precision: 12, scale: 2 }).default("0"),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).default("0"),
  suggestedPrice: numeric("suggested_price", { precision: 12, scale: 2 }),
  finalPrice: numeric("final_price", { precision: 12, scale: 2 }),
  linkedProductId: integer("linked_product_id"),
  linkedDeviceId: integer("linked_device_id").references(() => mobileDevices.id),
  status: varchar("status", { length: 30 }).default("pending"), // pending, ready_for_stock, in_stock, sold
  notes: text("notes"),
  processedBy: varchar("processed_by"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== GESTÃO DE DEPÓSITOS E ESTOQUE ==========

// Saldos de Estoque por Depósito
export const retailWarehouseStock = pgTable("retail_warehouse_stock", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").references(() => retailWarehouses.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 4 }).default("0").notNull(),
  reservedQuantity: numeric("reserved_quantity", { precision: 12, scale: 4 }).default("0"),
  availableQuantity: numeric("available_quantity", { precision: 12, scale: 4 }).default("0"),
  minStock: numeric("min_stock", { precision: 12, scale: 4 }),
  maxStock: numeric("max_stock", { precision: 12, scale: 4 }),
  lastMovementAt: timestamp("last_movement_at"),
  lastInventoryAt: timestamp("last_inventory_at"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Transferências entre Depósitos
export const retailStockTransfers = pgTable("retail_stock_transfers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  transferNumber: varchar("transfer_number", { length: 20 }).notNull(),
  sourceWarehouseId: integer("source_warehouse_id").references(() => retailWarehouses.id).notNull(),
  destinationWarehouseId: integer("destination_warehouse_id").references(() => retailWarehouses.id).notNull(),
  status: varchar("status", { length: 30 }).default("pending"), // pending, in_transit, completed, cancelled
  notes: text("notes"),
  requestedBy: varchar("requested_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  completedBy: varchar("completed_by").references(() => users.id),
  requestedAt: timestamp("requested_at").default(sql`CURRENT_TIMESTAMP`),
  approvedAt: timestamp("approved_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Itens da Transferência
export const retailStockTransferItems = pgTable("retail_stock_transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").references(() => retailStockTransfers.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  requestedQuantity: numeric("requested_quantity", { precision: 12, scale: 4 }).notNull(),
  transferredQuantity: numeric("transferred_quantity", { precision: 12, scale: 4 }),
  receivedQuantity: numeric("received_quantity", { precision: 12, scale: 4 }),
  notes: text("notes"),
});

// Números de Série/IMEI por Item de Transferência
export const retailTransferSerials = pgTable("retail_transfer_serials", {
  id: serial("id").primaryKey(),
  transferItemId: integer("transfer_item_id").references(() => retailStockTransferItems.id).notNull(),
  serialId: integer("serial_id").references(() => retailProductSerials.id).notNull(),
});

// Movimentações de Estoque
export const retailStockMovements = pgTable("retail_stock_movements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  warehouseId: integer("warehouse_id").references(() => retailWarehouses.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  movementType: varchar("movement_type", { length: 30 }).notNull(), // entry, exit, transfer_in, transfer_out, adjustment, inventory, return
  operationType: varchar("operation_type", { length: 50 }), // purchase, sale, manual_entry, trade_in, devolution, inventory_adjustment
  quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
  previousStock: numeric("previous_stock", { precision: 12, scale: 4 }),
  newStock: numeric("new_stock", { precision: 12, scale: 4 }),
  unitCost: numeric("unit_cost", { precision: 12, scale: 4 }),
  totalCost: numeric("total_cost", { precision: 12, scale: 4 }),
  referenceType: varchar("reference_type", { length: 50 }), // purchase_order, sale, transfer, adjustment, nfe
  referenceId: integer("reference_id"),
  referenceNumber: varchar("reference_number", { length: 50 }), // NF número, pedido, etc.
  supplierId: integer("supplier_id").references(() => persons.id),
  notes: text("notes"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Números de Série/IMEI dos Produtos
export const retailProductSerials = pgTable("retail_product_serials", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  productId: integer("product_id").references(() => products.id).notNull(),
  warehouseId: integer("warehouse_id").references(() => retailWarehouses.id),
  serialNumber: varchar("serial_number", { length: 50 }),
  imei: varchar("imei", { length: 20 }),
  imei2: varchar("imei2", { length: 20 }), // Segundo IMEI para celulares dual-SIM
  status: varchar("status", { length: 30 }).default("in_stock"), // in_stock, reserved, sold, returned, defective, in_transit
  acquisitionCost: numeric("acquisition_cost", { precision: 12, scale: 4 }),
  salePrice: numeric("sale_price", { precision: 12, scale: 4 }),
  soldPrice: numeric("sold_price", { precision: 12, scale: 4 }),
  movementId: integer("movement_id").references(() => retailStockMovements.id), // Movimento de entrada
  saleMovementId: integer("sale_movement_id"), // Movimento de saída/venda
  purchaseNfeNumber: varchar("purchase_nfe_number", { length: 50 }),
  saleNfeNumber: varchar("sale_nfe_number", { length: 50 }),
  customerId: integer("customer_id").references(() => persons.id), // Cliente que comprou
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Inventários
export const retailInventories = pgTable("retail_inventories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  warehouseId: integer("warehouse_id").references(() => retailWarehouses.id).notNull(),
  inventoryNumber: varchar("inventory_number", { length: 20 }).notNull(),
  type: varchar("type", { length: 30 }).default("full"), // full, partial, cyclic
  status: varchar("status", { length: 30 }).default("open"), // open, counting, adjusting, completed, cancelled
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  completedBy: varchar("completed_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Itens do Inventário
export const retailInventoryItems = pgTable("retail_inventory_items", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id").references(() => retailInventories.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  systemQuantity: numeric("system_quantity", { precision: 12, scale: 4 }),
  countedQuantity: numeric("counted_quantity", { precision: 12, scale: 4 }),
  difference: numeric("difference", { precision: 12, scale: 4 }),
  adjustmentApplied: boolean("adjustment_applied").default(false),
  countedBy: varchar("counted_by").references(() => users.id),
  countedAt: timestamp("counted_at"),
  notes: text("notes"),
});

// Feed de Atividades
export const retailActivityFeed = pgTable("retail_activity_feed", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  storeId: integer("store_id").references(() => retailStores.id),
  activityType: varchar("activity_type", { length: 50 }).notNull(), // sale, trade_in, service_order, stock_in, stock_out, evaluation, price_change, customer
  entityType: varchar("entity_type", { length: 50 }), // pos_sale, device_evaluation, service_order, mobile_device, person
  entityId: integer("entity_id"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata").$type<any>(),
  severity: varchar("severity", { length: 20 }).default("info"), // info, success, warning, error
  createdBy: varchar("created_by"),
  createdByName: varchar("created_by_name", { length: 200 }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Relatórios Personalizados
export const retailReports = pgTable("retail_reports", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 30 }).default("custom"), // sales, inventory, commissions, financial, custom
  query: text("query"),
  filters: jsonb("filters").$type<any>(),
  columns: jsonb("columns").$type<{field: string; label: string; type: string}[]>(),
  isSystem: boolean("is_system").default(false),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas e types para Retail
export const insertRetailStoreSchema = createInsertSchema(retailStores).omit({ id: true, createdAt: true, updatedAt: true });
export type RetailStore = typeof retailStores.$inferSelect;
export type InsertRetailStore = z.infer<typeof insertRetailStoreSchema>;

export const insertRetailWarehouseSchema = createInsertSchema(retailWarehouses).omit({ id: true, createdAt: true });
export type RetailWarehouse = typeof retailWarehouses.$inferSelect;
export type InsertRetailWarehouse = z.infer<typeof insertRetailWarehouseSchema>;

export const insertMobileDeviceSchema = createInsertSchema(mobileDevices).omit({ id: true, createdAt: true, updatedAt: true });
export type MobileDevice = typeof mobileDevices.$inferSelect;
export type InsertMobileDevice = z.infer<typeof insertMobileDeviceSchema>;

export const insertDeviceEvaluationSchema = createInsertSchema(deviceEvaluations).omit({ id: true, createdAt: true, updatedAt: true });
export type DeviceEvaluation = typeof deviceEvaluations.$inferSelect;
export type InsertDeviceEvaluation = z.infer<typeof insertDeviceEvaluationSchema>;

export const insertServiceOrderSchema = createInsertSchema(serviceOrders).omit({ id: true, createdAt: true, updatedAt: true });
export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = z.infer<typeof insertServiceOrderSchema>;

export const insertServiceOrderItemSchema = createInsertSchema(serviceOrderItems).omit({ id: true, createdAt: true });
export type ServiceOrderItem = typeof serviceOrderItems.$inferSelect;
export type InsertServiceOrderItem = z.infer<typeof insertServiceOrderItemSchema>;

export const insertPosSessionSchema = createInsertSchema(posSessions).omit({ id: true, createdAt: true });
export type PosSession = typeof posSessions.$inferSelect;
export type InsertPosSession = z.infer<typeof insertPosSessionSchema>;

export const insertPosSaleSchema = createInsertSchema(posSales).omit({ id: true, createdAt: true });
export type PosSale = typeof posSales.$inferSelect;
export type InsertPosSale = z.infer<typeof insertPosSaleSchema>;

export const insertPosSaleItemSchema = createInsertSchema(posSaleItems).omit({ id: true, createdAt: true });
export type PosSaleItem = typeof posSaleItems.$inferSelect;
export type InsertPosSaleItem = z.infer<typeof insertPosSaleItemSchema>;

export const insertPaymentPlanSchema = createInsertSchema(paymentPlans).omit({ id: true, createdAt: true, updatedAt: true });
export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type InsertPaymentPlan = z.infer<typeof insertPaymentPlanSchema>;

export const insertPaymentPlanInstallmentSchema = createInsertSchema(paymentPlanInstallments).omit({ id: true, createdAt: true });
export type PaymentPlanInstallment = typeof paymentPlanInstallments.$inferSelect;
export type InsertPaymentPlanInstallment = z.infer<typeof insertPaymentPlanInstallmentSchema>;

export const insertLeaseAgreementSchema = createInsertSchema(leaseAgreements).omit({ id: true, createdAt: true, updatedAt: true });
export type LeaseAgreement = typeof leaseAgreements.$inferSelect;
export type InsertLeaseAgreement = z.infer<typeof insertLeaseAgreementSchema>;

export const insertLeasePaymentSchema = createInsertSchema(leasePayments).omit({ id: true, createdAt: true });
export type LeasePayment = typeof leasePayments.$inferSelect;
export type InsertLeasePayment = z.infer<typeof insertLeasePaymentSchema>;

export const insertStockTransferSchema = createInsertSchema(stockTransfers).omit({ id: true, createdAt: true, updatedAt: true });
export type StockTransfer = typeof stockTransfers.$inferSelect;
export type InsertStockTransfer = z.infer<typeof insertStockTransferSchema>;

export const insertStockTransferItemSchema = createInsertSchema(stockTransferItems).omit({ id: true, createdAt: true });
export type StockTransferItem = typeof stockTransferItems.$inferSelect;
export type InsertStockTransferItem = z.infer<typeof insertStockTransferItemSchema>;

export const insertReturnExchangeSchema = createInsertSchema(returnExchanges).omit({ id: true, createdAt: true });
export type ReturnExchange = typeof returnExchanges.$inferSelect;
export type InsertReturnExchange = z.infer<typeof insertReturnExchangeSchema>;

export const insertReturnExchangeItemSchema = createInsertSchema(returnExchangeItems).omit({ id: true, createdAt: true });
export type ReturnExchangeItem = typeof returnExchangeItems.$inferSelect;
export type InsertReturnExchangeItem = z.infer<typeof insertReturnExchangeItemSchema>;

export const insertDeviceHistorySchema = createInsertSchema(deviceHistory).omit({ id: true, createdAt: true });
export type DeviceHistory = typeof deviceHistory.$inferSelect;
export type InsertDeviceHistory = z.infer<typeof insertDeviceHistorySchema>;

// Trade-In Checklist Templates - Modelos de Checklist para Avaliação
export const tradeInChecklistTemplates = pgTable("trade_in_checklist_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  deviceCategory: varchar("device_category", { length: 50 }).default("smartphone"), // smartphone, tablet, laptop, smartwatch
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Trade-In Checklist Items - Itens do Checklist
export const tradeInChecklistItems = pgTable("trade_in_checklist_items", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => tradeInChecklistTemplates.id).notNull(),
  category: varchar("category", { length: 50 }).notNull(), // visual, funcional, acessorios, documentacao
  itemName: varchar("item_name", { length: 100 }).notNull(),
  itemDescription: text("item_description"),
  evaluationType: varchar("evaluation_type", { length: 20 }).default("condition"), // condition, boolean, percentage, text
  options: text("options"), // JSON array de opções para tipo condition: ["perfeito","bom","regular","ruim"]
  impactOnValue: numeric("impact_on_value", { precision: 5, scale: 2 }).default("0"), // % de impacto no valor
  isRequired: boolean("is_required").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Trade-In Evaluation Results - Resultados da Avaliação por Item
export const tradeInEvaluationResults = pgTable("trade_in_evaluation_results", {
  id: serial("id").primaryKey(),
  evaluationId: integer("evaluation_id").references(() => deviceEvaluations.id).notNull(),
  checklistItemId: integer("checklist_item_id").references(() => tradeInChecklistItems.id).notNull(),
  result: varchar("result", { length: 50 }), // valor selecionado (perfeito, bom, etc) ou true/false
  percentValue: integer("percent_value"), // para tipo percentage
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Trade-In Transfer Documents - Documentos de Transferência de Posse
export const tradeInTransferDocuments = pgTable("trade_in_transfer_documents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  storeId: integer("store_id").references(() => retailStores.id),
  evaluationId: integer("evaluation_id").references(() => deviceEvaluations.id).notNull(),
  documentNumber: varchar("document_number", { length: 30 }).notNull(),
  // Dados do Cedente (Cliente)
  customerName: varchar("customer_name", { length: 200 }).notNull(),
  customerCpf: varchar("customer_cpf", { length: 14 }),
  customerRg: varchar("customer_rg", { length: 20 }),
  customerAddress: text("customer_address"),
  customerPhone: varchar("customer_phone", { length: 20 }),
  customerEmail: varchar("customer_email", { length: 100 }),
  // Dados do Dispositivo
  deviceBrand: varchar("device_brand", { length: 50 }).notNull(),
  deviceModel: varchar("device_model", { length: 100 }).notNull(),
  deviceImei: varchar("device_imei", { length: 20 }).notNull(),
  deviceImei2: varchar("device_imei2", { length: 20 }),
  deviceColor: varchar("device_color", { length: 50 }),
  deviceStorage: varchar("device_storage", { length: 20 }),
  deviceCondition: varchar("device_condition", { length: 50 }),
  // Valores
  agreedValue: numeric("agreed_value", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }), // credit, cash, discount_on_purchase
  // Assinatura Digital
  customerSignature: text("customer_signature"), // Base64 da assinatura
  customerSignedAt: timestamp("customer_signed_at"),
  employeeSignature: text("employee_signature"),
  employeeName: varchar("employee_name", { length: 200 }),
  employeeSignedAt: timestamp("employee_signed_at"),
  // Termos
  termsAccepted: boolean("terms_accepted").default(false),
  // Status
  status: varchar("status", { length: 20 }).default("draft"), // draft, pending_signature, signed, completed, cancelled
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTradeInChecklistTemplateSchema = createInsertSchema(tradeInChecklistTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type TradeInChecklistTemplate = typeof tradeInChecklistTemplates.$inferSelect;
export type InsertTradeInChecklistTemplate = z.infer<typeof insertTradeInChecklistTemplateSchema>;

export const insertTradeInChecklistItemSchema = createInsertSchema(tradeInChecklistItems).omit({ id: true, createdAt: true });
export type TradeInChecklistItem = typeof tradeInChecklistItems.$inferSelect;
export type InsertTradeInChecklistItem = z.infer<typeof insertTradeInChecklistItemSchema>;

export const insertTradeInEvaluationResultSchema = createInsertSchema(tradeInEvaluationResults).omit({ id: true, createdAt: true });
export type TradeInEvaluationResult = typeof tradeInEvaluationResults.$inferSelect;
export type InsertTradeInEvaluationResult = z.infer<typeof insertTradeInEvaluationResultSchema>;

export const insertTradeInTransferDocumentSchema = createInsertSchema(tradeInTransferDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export type TradeInTransferDocument = typeof tradeInTransferDocuments.$inferSelect;
export type InsertTradeInTransferDocument = z.infer<typeof insertTradeInTransferDocumentSchema>;

// POS Cash Movements - Sangria e Reforço de Caixa
export const posCashMovements = pgTable("pos_cash_movements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  sessionId: integer("session_id").references(() => posSessions.id).notNull(),
  storeId: integer("store_id").references(() => retailStores.id).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // withdrawal (sangria), reinforcement (reforço)
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason"),
  performedBy: varchar("performed_by"),
  performedByName: varchar("performed_by_name", { length: 200 }),
  authorizedBy: varchar("authorized_by"),
  authorizedByName: varchar("authorized_by_name", { length: 200 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPosCashMovementSchema = createInsertSchema(posCashMovements).omit({ id: true, createdAt: true });
export type PosCashMovement = typeof posCashMovements.$inferSelect;
export type InsertPosCashMovement = z.infer<typeof insertPosCashMovementSchema>;

// Service Warranties - Garantias de Serviço vinculadas à OS e IMEI
export const serviceWarranties = pgTable("service_warranties", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  storeId: integer("store_id").references(() => retailStores.id),
  serviceOrderId: integer("service_order_id").references(() => serviceOrders.id).notNull(),
  deviceId: integer("device_id").references(() => mobileDevices.id),
  imei: varchar("imei", { length: 20 }),
  serviceType: varchar("service_type", { length: 50 }).notNull(),
  warrantyDays: integer("warranty_days").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  customerName: varchar("customer_name", { length: 200 }),
  customerPhone: varchar("customer_phone", { length: 20 }),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("active"), // active, expired, claimed, voided
  claimedAt: timestamp("claimed_at"),
  claimNotes: text("claim_notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertServiceWarrantySchema = createInsertSchema(serviceWarranties).omit({ id: true, createdAt: true });
export type ServiceWarranty = typeof serviceWarranties.$inferSelect;
export type InsertServiceWarranty = z.infer<typeof insertServiceWarrantySchema>;

// Customer Credits - Créditos de Cliente (Trade-In, Devoluções, etc.)
export const customerCredits = pgTable("customer_credits", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  storeId: integer("store_id").references(() => retailStores.id),
  personId: integer("person_id").notNull(), // Referência à pessoa unificada
  customerName: varchar("customer_name", { length: 200 }).notNull(),
  customerCpf: varchar("customer_cpf", { length: 20 }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  usedAmount: numeric("used_amount", { precision: 12, scale: 2 }).default("0"),
  remainingAmount: numeric("remaining_amount", { precision: 12, scale: 2 }).notNull(),
  origin: varchar("origin", { length: 50 }).notNull(), // trade_in, refund, bonus, promotion
  originId: integer("origin_id"), // ID da avaliação, devolução, etc.
  description: text("description"),
  expiresAt: timestamp("expires_at"), // Validade do crédito (null = não expira)
  status: varchar("status", { length: 20 }).default("active"), // active, used, expired, cancelled
  usedInSaleId: integer("used_in_sale_id"), // Referência à venda onde foi usado
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCustomerCreditSchema = createInsertSchema(customerCredits).omit({ id: true, createdAt: true, updatedAt: true });
export type CustomerCredit = typeof customerCredits.$inferSelect;
export type InsertCustomerCredit = z.infer<typeof insertCustomerCreditSchema>;

// ========== PHASE 0: UNIFIED PERSON REGISTRY ==========

// Persons - Cadastro Unificado de Pessoas (pode ter múltiplos papéis)
export const persons = pgTable("persons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  cpfCnpj: varchar("cpf_cnpj", { length: 20 }),
  rgIe: varchar("rg_ie", { length: 30 }), // RG ou Inscrição Estadual
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  phone2: varchar("phone2", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  address: text("address"),
  addressNumber: varchar("address_number", { length: 20 }),
  complement: varchar("complement", { length: 100 }),
  neighborhood: varchar("neighborhood", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  country: varchar("country", { length: 50 }).default("Brasil"),
  birthDate: date("birth_date"),
  gender: varchar("gender", { length: 20 }), // male, female, other, not_specified
  notes: text("notes"),
  photoUrl: text("photo_url"),
  isActive: boolean("is_active").default(true),
  // ERPNext Sync Fields
  erpnextCustomerId: varchar("erpnext_customer_id", { length: 140 }),
  erpnextSupplierId: varchar("erpnext_supplier_id", { length: 140 }),
  erpnextEmployeeId: varchar("erpnext_employee_id", { length: 140 }),
  // Plus Sync Fields
  plusClienteId: integer("plus_cliente_id"),
  plusFornecedorId: integer("plus_fornecedor_id"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Person Roles - Papéis da Pessoa (uma pessoa pode ter múltiplos papéis)
export const personRoles = pgTable("person_roles", {
  id: serial("id").primaryKey(),
  personId: integer("person_id").references(() => persons.id, { onDelete: "cascade" }).notNull(),
  roleType: varchar("role_type", { length: 30 }).notNull(), // customer, supplier, employee, technician, partner, sales_rep
  // Campos específicos por papel - Cliente
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }),
  paymentTerms: varchar("payment_terms", { length: 50 }), // cash, 7_days, 14_days, 30_days, etc.
  customerSince: date("customer_since"),
  // Campos específicos - Fornecedor
  supplierCode: varchar("supplier_code", { length: 30 }),
  supplierCategory: varchar("supplier_category", { length: 50 }), // devices, parts, accessories
  leadTime: integer("lead_time"), // Dias para entrega
  minOrderValue: numeric("min_order_value", { precision: 12, scale: 2 }),
  // Campos específicos - Colaborador/Técnico
  employeeCode: varchar("employee_code", { length: 30 }),
  department: varchar("department", { length: 50 }),
  position: varchar("position", { length: 100 }),
  hireDate: date("hire_date"),
  terminationDate: date("termination_date"),
  salary: numeric("salary", { precision: 12, scale: 2 }),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
  // Campos específicos - Técnico
  specializations: text("specializations").array(), // ['iphone', 'samsung', 'xiaomi', 'software', 'hardware']
  certifications: text("certifications").array(),
  avgRepairTime: integer("avg_repair_time"), // Minutos
  qualityScore: numeric("quality_score", { precision: 5, scale: 2 }), // 0-100
  // Status e Metadados
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// IMEI History - Histórico/Kardex de Movimentações do IMEI
export const imeiHistory = pgTable("imei_history", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  deviceId: integer("device_id").references(() => mobileDevices.id).notNull(),
  imei: varchar("imei", { length: 20 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(), 
  // Ações: entry, sale, return, transfer, repair_start, repair_end, trade_in_approved, internal_os_created, stock_entry, quality_check
  previousStatus: varchar("previous_status", { length: 50 }),
  newStatus: varchar("new_status", { length: 50 }),
  previousLocation: varchar("previous_location", { length: 100 }), // Warehouse/Store anterior
  newLocation: varchar("new_location", { length: 100 }), // Warehouse/Store novo
  relatedOrderId: integer("related_order_id"), // ID da OS, Venda, Transferência
  relatedOrderType: varchar("related_order_type", { length: 30 }), // service_order, sale, transfer, evaluation
  relatedOrderNumber: varchar("related_order_number", { length: 30 }),
  cost: numeric("cost", { precision: 12, scale: 2 }), // Custo associado à movimentação
  notes: text("notes"),
  createdBy: varchar("created_by"), // User ID
  createdByName: varchar("created_by_name", { length: 200 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Schemas e Types - Persons
export const insertPersonSchema = createInsertSchema(persons).omit({ id: true, createdAt: true, updatedAt: true });
export type Person = typeof persons.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;

export const insertPersonRoleSchema = createInsertSchema(personRoles).omit({ id: true, createdAt: true, updatedAt: true });
export type PersonRole = typeof personRoles.$inferSelect;
export type InsertPersonRole = z.infer<typeof insertPersonRoleSchema>;

export const insertImeiHistorySchema = createInsertSchema(imeiHistory).omit({ id: true, createdAt: true });
export type ImeiHistory = typeof imeiHistory.$inferSelect;
export type InsertImeiHistory = z.infer<typeof insertImeiHistorySchema>;

// ========== MARKETPLACE DE MÓDULOS ==========

// Catálogo de Módulos disponíveis no Arcádia Suite
export const marketplaceModules = pgTable("marketplace_modules", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(), // fisco, retail, lms, bi, whatsapp, etc.
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  longDescription: text("long_description"),
  category: varchar("category", { length: 50 }).notNull(), // core, business, intelligence, communication, segment
  icon: varchar("icon", { length: 100 }), // Lucide icon name
  color: varchar("color", { length: 20 }), // Tailwind color class
  imageUrl: text("image_url"),
  price: numeric("price", { precision: 12, scale: 2 }).default("0"), // Preço mensal
  setupFee: numeric("setup_fee", { precision: 12, scale: 2 }).default("0"), // Taxa de implantação
  features: text("features").array(), // Lista de funcionalidades
  dependencies: text("dependencies").array(), // Módulos que este depende
  route: varchar("route", { length: 100 }), // Rota principal do módulo (ex: /fisco, /lms)
  apiEndpoint: varchar("api_endpoint", { length: 200 }), // Endpoint da API do módulo
  version: varchar("version", { length: 20 }).default("1.0.0"),
  isCore: boolean("is_core").default(false), // Módulos core são obrigatórios
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false), // Destaque no marketplace
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Assinaturas de Módulos por Empresa (Tenant)
export const moduleSubscriptions = pgTable("module_subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  moduleId: integer("module_id").references(() => marketplaceModules.id, { onDelete: "cascade" }).notNull(),
  status: varchar("status", { length: 20 }).default("active"), // active, suspended, cancelled, trial
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // null = sem data de término
  trialEndsAt: timestamp("trial_ends_at"), // Se em trial
  price: numeric("price", { precision: 12, scale: 2 }), // Preço negociado (pode ser diferente do catálogo)
  discount: numeric("discount", { precision: 5, scale: 2 }).default("0"), // Desconto percentual
  billingCycle: varchar("billing_cycle", { length: 20 }).default("monthly"), // monthly, yearly, custom
  autoRenew: boolean("auto_renew").default(true),
  notes: text("notes"),
  activatedBy: varchar("activated_by"), // User ID
  activatedAt: timestamp("activated_at"),
  cancelledBy: varchar("cancelled_by"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Histórico de uso/consumo de módulos (para métricas e billing)
export const moduleUsage = pgTable("module_usage", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => moduleSubscriptions.id, { onDelete: "cascade" }).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  moduleCode: varchar("module_code", { length: 50 }).notNull(),
  period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
  usageCount: integer("usage_count").default(0), // Acessos/execuções
  apiCalls: integer("api_calls").default(0),
  storageUsedMb: numeric("storage_used_mb", { precision: 12, scale: 2 }).default("0"),
  documentsGenerated: integer("documents_generated").default(0), // NFes, relatórios, etc.
  activeUsers: integer("active_users").default(0),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Schemas e Types - Marketplace
export const insertMarketplaceModuleSchema = createInsertSchema(marketplaceModules).omit({ id: true, createdAt: true, updatedAt: true });
export type MarketplaceModule = typeof marketplaceModules.$inferSelect;
export type InsertMarketplaceModule = z.infer<typeof insertMarketplaceModuleSchema>;

export const insertModuleSubscriptionSchema = createInsertSchema(moduleSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type ModuleSubscription = typeof moduleSubscriptions.$inferSelect;
export type InsertModuleSubscription = z.infer<typeof insertModuleSubscriptionSchema>;

export const insertModuleUsageSchema = createInsertSchema(moduleUsage).omit({ id: true, createdAt: true });
export type ModuleUsage = typeof moduleUsage.$inferSelect;
export type InsertModuleUsage = z.infer<typeof insertModuleUsageSchema>;

// ========== XOS - Experience Operating System ==========

// Contatos XOS (Leads, Clientes, Parceiros)
export const xosContacts = pgTable("xos_contacts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).default("lead"), // lead, customer, partner, supplier
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  avatarUrl: text("avatar_url"),
  company: varchar("company", { length: 200 }),
  position: varchar("position", { length: 100 }),
  tags: text("tags").array(),
  customFields: jsonb("custom_fields").$type<Record<string, any>>(),
  leadScore: integer("lead_score").default(0),
  leadStatus: varchar("lead_status", { length: 30 }).default("new"), // new, contacted, qualified, proposal, negotiation, won, lost
  source: varchar("source", { length: 50 }), // website, whatsapp, manual, import, referral
  sourceDetails: text("source_details"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  lastContactAt: timestamp("last_contact_at"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  country: varchar("country", { length: 50 }).default("Brasil"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Empresas XOS (Contas B2B)
export const xosCompanies = pgTable("xos_companies", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  tradeName: varchar("trade_name", { length: 200 }),
  document: varchar("document", { length: 20 }), // CNPJ
  domain: varchar("domain", { length: 200 }),
  industry: varchar("industry", { length: 100 }),
  size: varchar("size", { length: 30 }), // micro, small, medium, large, enterprise
  employees: integer("employees"),
  annualRevenue: numeric("annual_revenue", { precision: 18, scale: 2 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 200 }),
  website: varchar("website", { length: 300 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  country: varchar("country", { length: 50 }).default("Brasil"),
  logoUrl: text("logo_url"),
  tags: text("tags").array(),
  customFields: jsonb("custom_fields").$type<Record<string, any>>(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Pipelines de Vendas
export const xosPipelines = pgTable("xos_pipelines", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 30 }).default("sales"), // sales, support, onboarding, custom
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Estágios do Pipeline
export const xosPipelineStages = pgTable("xos_pipeline_stages", {
  id: serial("id").primaryKey(),
  pipelineId: integer("pipeline_id").references(() => xosPipelines.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }),
  sortOrder: integer("sort_order").default(0),
  probability: integer("probability").default(0), // 0-100%
  isWon: boolean("is_won").default(false),
  isLost: boolean("is_lost").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Deals/Oportunidades
export const xosDeals = pgTable("xos_deals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  pipelineId: integer("pipeline_id").references(() => xosPipelines.id).notNull(),
  stageId: integer("stage_id").references(() => xosPipelineStages.id).notNull(),
  contactId: integer("contact_id").references(() => xosContacts.id),
  companyId: integer("company_id").references(() => xosCompanies.id),
  title: varchar("title", { length: 200 }).notNull(),
  value: numeric("value", { precision: 18, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  expectedCloseDate: date("expected_close_date"),
  actualCloseDate: date("actual_close_date"),
  probability: integer("probability").default(0),
  status: varchar("status", { length: 20 }).default("open"), // open, won, lost
  lostReason: text("lost_reason"),
  wonReason: text("won_reason"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  tags: text("tags").array(),
  customFields: jsonb("custom_fields").$type<Record<string, any>>(),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  closedAt: timestamp("closed_at"),
});

// Conversas Omnichannel
export const xosConversations = pgTable("xos_conversations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").references(() => xosContacts.id),
  channel: varchar("channel", { length: 30 }).notNull(), // whatsapp, chat, email, instagram, facebook
  channelId: varchar("channel_id", { length: 100 }), // ID externo do canal
  status: varchar("status", { length: 20 }).default("open"), // open, pending, resolved, closed
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent
  subject: varchar("subject", { length: 300 }),
  assignedTo: varchar("assigned_to").references(() => users.id),
  tags: text("tags").array(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  firstResponseAt: timestamp("first_response_at"),
  resolvedAt: timestamp("resolved_at"),
  satisfactionScore: integer("satisfaction_score"), // 1-5
  satisfactionComment: text("satisfaction_comment"),
  messagesCount: integer("messages_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Mensagens
export const xosMessages = pgTable("xos_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => xosConversations.id, { onDelete: "cascade" }).notNull(),
  direction: varchar("direction", { length: 10 }).notNull(), // inbound, outbound
  senderType: varchar("sender_type", { length: 20 }).notNull(), // contact, user, bot
  senderId: varchar("sender_id"), // ID do remetente
  senderName: varchar("sender_name", { length: 200 }),
  content: text("content"),
  contentType: varchar("content_type", { length: 30 }).default("text"), // text, image, file, audio, video, location
  attachments: jsonb("attachments").$type<Array<{ url: string; type: string; name: string }>>(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  externalId: varchar("external_id", { length: 200 }), // ID no canal externo
  readAt: timestamp("read_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Tickets de Suporte
export const xosTickets = pgTable("xos_tickets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").references(() => xosContacts.id),
  conversationId: integer("conversation_id").references(() => xosConversations.id),
  ticketNumber: varchar("ticket_number", { length: 20 }).notNull(),
  subject: varchar("subject", { length: 300 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent
  status: varchar("status", { length: 30 }).default("open"), // open, pending, in_progress, waiting_customer, resolved, closed
  assignedTo: varchar("assigned_to").references(() => users.id),
  tags: text("tags").array(),
  slaDueAt: timestamp("sla_due_at"),
  firstResponseAt: timestamp("first_response_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  satisfactionScore: integer("satisfaction_score"),
  satisfactionComment: text("satisfaction_comment"),
  customFields: jsonb("custom_fields").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Campanhas de Marketing
export const xosCampaigns = pgTable("xos_campaigns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 30 }).notNull(), // email, sms, whatsapp, push
  status: varchar("status", { length: 20 }).default("draft"), // draft, scheduled, running, paused, completed, cancelled
  segmentQuery: jsonb("segment_query").$type<Record<string, any>>(), // Filtro de contatos
  templateId: integer("template_id"),
  content: text("content"),
  subject: varchar("subject", { length: 300 }),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  stats: jsonb("stats").$type<{
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  }>(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Automações
export const xosAutomations = pgTable("xos_automations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(), // contact_created, deal_stage_changed, form_submitted, etc
  triggerConfig: jsonb("trigger_config").$type<Record<string, any>>(),
  actions: jsonb("actions").$type<Array<{ type: string; config: Record<string, any> }>>(),
  conditions: jsonb("conditions").$type<Array<{ field: string; operator: string; value: any }>>(),
  isActive: boolean("is_active").default(true),
  executionCount: integer("execution_count").default(0),
  lastExecutedAt: timestamp("last_executed_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Atividades (Tarefas, Ligações, Reuniões)
export const xosActivities = pgTable("xos_activities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 30 }).notNull(), // task, call, meeting, email, note
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, in_progress, completed, cancelled
  priority: varchar("priority", { length: 20 }).default("normal"),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  contactId: integer("contact_id").references(() => xosContacts.id),
  companyId: integer("company_id").references(() => xosCompanies.id),
  dealId: integer("deal_id").references(() => xosDeals.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  outcome: text("outcome"),
  duration: integer("duration"), // minutos
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== NOVAS TABELAS XOS (Fase 1-3) ==========

// Filas de Atendimento
export const xosQueues = pgTable("xos_queues", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("blue"),
  greetingMessage: text("greeting_message"),
  outOfHoursMessage: text("out_of_hours_message"),
  schedules: jsonb("schedules").$type<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>(),
  orderPriority: integer("order_priority").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Usuários por Fila (N:N)
export const xosQueueUsers = pgTable("xos_queue_users", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").references(() => xosQueues.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Notas Internas (visíveis só para equipe)
export const xosInternalNotes = pgTable("xos_internal_notes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id").references(() => xosConversations.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").references(() => xosContacts.id, { onDelete: "cascade" }),
  ticketId: integer("ticket_id").references(() => xosTickets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  userName: varchar("user_name", { length: 200 }),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Mensagens Rápidas (atalhos como /preco, /horario)
export const xosQuickMessages = pgTable("xos_quick_messages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  shortcode: varchar("shortcode", { length: 50 }).notNull(), // /preco, /horario
  title: varchar("title", { length: 200 }),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type", { length: 30 }), // image, file, audio
  scope: varchar("scope", { length: 20 }).default("company"), // personal, team, company
  userId: varchar("user_id").references(() => users.id),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Mensagens Agendadas
export const xosScheduledMessages = pgTable("xos_scheduled_messages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").references(() => xosContacts.id),
  conversationId: integer("conversation_id").references(() => xosConversations.id),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type", { length: 30 }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, sent, failed, cancelled
  errorMessage: text("error_message"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Tracking de Conversa (tempos e métricas)
export const xosConversationTracking = pgTable("xos_conversation_tracking", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => xosConversations.id, { onDelete: "cascade" }).notNull(),
  queueId: integer("queue_id").references(() => xosQueues.id),
  queuedAt: timestamp("queued_at"),
  firstResponseAt: timestamp("first_response_at"),
  assignedAt: timestamp("assigned_at"),
  chatbotEndedAt: timestamp("chatbot_ended_at"),
  humanStartedAt: timestamp("human_started_at"),
  resolvedAt: timestamp("resolved_at"),
  ratedAt: timestamp("rated_at"),
  ratingScore: integer("rating_score"), // 1-5
  ratingComment: text("rating_comment"),
  totalDurationSeconds: integer("total_duration_seconds"),
  responseTimeSeconds: integer("response_time_seconds"),
});

// Conexões WhatsApp (para multi-número)
export const xosWhatsappConnections = pgTable("xos_whatsapp_connections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }),
  status: varchar("status", { length: 30 }).default("disconnected"), // connected, disconnected, qr_pending
  qrCode: text("qr_code"),
  sessionData: jsonb("session_data"),
  greetingMessage: text("greeting_message"),
  farewellMessage: text("farewell_message"),
  completionMessage: text("completion_message"),
  ratingMessage: text("rating_message"),
  outOfHoursMessage: text("out_of_hours_message"),
  ticketExpiresMinutes: integer("ticket_expires_minutes").default(1440), // 24h
  inactiveMessage: text("inactive_message"),
  isDefault: boolean("is_default").default(false),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Link WhatsApp <-> Fila
export const xosWhatsappQueueLinks = pgTable("xos_whatsapp_queue_links", {
  id: serial("id").primaryKey(),
  whatsappId: integer("whatsapp_id").references(() => xosWhatsappConnections.id, { onDelete: "cascade" }).notNull(),
  queueId: integer("queue_id").references(() => xosQueues.id, { onDelete: "cascade" }).notNull(),
});

// Schemas e Types - XOS
export const insertXosContactSchema = createInsertSchema(xosContacts).omit({ id: true, createdAt: true, updatedAt: true });
export type XosContact = typeof xosContacts.$inferSelect;
export type InsertXosContact = z.infer<typeof insertXosContactSchema>;

export const insertXosCompanySchema = createInsertSchema(xosCompanies).omit({ id: true, createdAt: true, updatedAt: true });
export type XosCompany = typeof xosCompanies.$inferSelect;
export type InsertXosCompany = z.infer<typeof insertXosCompanySchema>;

export const insertXosPipelineSchema = createInsertSchema(xosPipelines).omit({ id: true, createdAt: true, updatedAt: true });
export type XosPipeline = typeof xosPipelines.$inferSelect;
export type InsertXosPipeline = z.infer<typeof insertXosPipelineSchema>;

export const insertXosPipelineStageSchema = createInsertSchema(xosPipelineStages).omit({ id: true, createdAt: true });
export type XosPipelineStage = typeof xosPipelineStages.$inferSelect;
export type InsertXosPipelineStage = z.infer<typeof insertXosPipelineStageSchema>;

export const insertXosDealSchema = createInsertSchema(xosDeals).omit({ id: true, createdAt: true, updatedAt: true });
export type XosDeal = typeof xosDeals.$inferSelect;
export type InsertXosDeal = z.infer<typeof insertXosDealSchema>;

export const insertXosConversationSchema = createInsertSchema(xosConversations).omit({ id: true, createdAt: true, updatedAt: true });
export type XosConversation = typeof xosConversations.$inferSelect;
export type InsertXosConversation = z.infer<typeof insertXosConversationSchema>;

export const insertXosMessageSchema = createInsertSchema(xosMessages).omit({ id: true, createdAt: true });
export type XosMessage = typeof xosMessages.$inferSelect;
export type InsertXosMessage = z.infer<typeof insertXosMessageSchema>;

export const insertXosTicketSchema = createInsertSchema(xosTickets).omit({ id: true, createdAt: true, updatedAt: true });
export type XosTicket = typeof xosTickets.$inferSelect;
export type InsertXosTicket = z.infer<typeof insertXosTicketSchema>;

export const insertXosCampaignSchema = createInsertSchema(xosCampaigns).omit({ id: true, createdAt: true, updatedAt: true });
export type XosCampaign = typeof xosCampaigns.$inferSelect;
export type InsertXosCampaign = z.infer<typeof insertXosCampaignSchema>;

export const insertXosAutomationSchema = createInsertSchema(xosAutomations).omit({ id: true, createdAt: true, updatedAt: true });
export type XosAutomation = typeof xosAutomations.$inferSelect;
export type InsertXosAutomation = z.infer<typeof insertXosAutomationSchema>;

export const insertXosActivitySchema = createInsertSchema(xosActivities).omit({ id: true, createdAt: true, updatedAt: true });
export type XosActivity = typeof xosActivities.$inferSelect;
export type InsertXosActivity = z.infer<typeof insertXosActivitySchema>;

// Types - Novas tabelas XOS
export const insertXosQueueSchema = createInsertSchema(xosQueues).omit({ id: true, createdAt: true, updatedAt: true });
export type XosQueue = typeof xosQueues.$inferSelect;
export type InsertXosQueue = z.infer<typeof insertXosQueueSchema>;

export const insertXosInternalNoteSchema = createInsertSchema(xosInternalNotes).omit({ id: true, createdAt: true });
export type XosInternalNote = typeof xosInternalNotes.$inferSelect;
export type InsertXosInternalNote = z.infer<typeof insertXosInternalNoteSchema>;

export const insertXosQuickMessageSchema = createInsertSchema(xosQuickMessages).omit({ id: true, createdAt: true, updatedAt: true });
export type XosQuickMessage = typeof xosQuickMessages.$inferSelect;
export type InsertXosQuickMessage = z.infer<typeof insertXosQuickMessageSchema>;

export const insertXosScheduledMessageSchema = createInsertSchema(xosScheduledMessages).omit({ id: true, createdAt: true });
export type XosScheduledMessage = typeof xosScheduledMessages.$inferSelect;
export type InsertXosScheduledMessage = z.infer<typeof insertXosScheduledMessageSchema>;

export type XosConversationTracking = typeof xosConversationTracking.$inferSelect;
export type XosWhatsappConnection = typeof xosWhatsappConnections.$inferSelect;

// ============================================================
// MÓDULO DE MIGRAÇÃO DE DADOS
// ============================================================

export const migrationJobs = pgTable("migration_jobs", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  sourceType: varchar("source_type", { length: 50 }).notNull(), // mongodb, mysql, csv, json
  sourceSystem: varchar("source_system", { length: 100 }), // nome do sistema de origem
  status: varchar("status", { length: 30 }).default("pending"), // pending, analyzing, mapping, importing, completed, failed
  fileName: varchar("file_name", { length: 500 }),
  fileSize: integer("file_size"),
  totalRecords: integer("total_records").default(0),
  importedRecords: integer("imported_records").default(0),
  failedRecords: integer("failed_records").default(0),
  skippedRecords: integer("skipped_records").default(0),
  analysisResult: jsonb("analysis_result"), // resultado da análise do backup
  mappingConfig: jsonb("mapping_config"), // configuração de mapeamento de campos
  importConfig: jsonb("import_config"), // opções de importação
  errorLog: text("error_log"),
  storeId: integer("store_id"),
  tenantId: integer("tenant_id"),
  createdBy: varchar("created_by", { length: 255 }),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const migrationMappings = pgTable("migration_mappings", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => migrationJobs.id, { onDelete: "cascade" }).notNull(),
  sourceEntity: varchar("source_entity", { length: 100 }).notNull(), // ex: DtoPessoa
  targetEntity: varchar("target_entity", { length: 100 }).notNull(), // ex: customers
  fieldMappings: jsonb("field_mappings").notNull(), // { "CNPJ_CPF": "cpf_cnpj", "Nome": "name", ... }
  transformations: jsonb("transformations"), // funções de transformação
  filters: jsonb("filters"), // filtros a aplicar
  isEnabled: boolean("is_enabled").default(true),
  priority: integer("priority").default(0), // ordem de execução
  recordCount: integer("record_count").default(0),
  importedCount: integer("imported_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const migrationLogs = pgTable("migration_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => migrationJobs.id, { onDelete: "cascade" }).notNull(),
  mappingId: integer("mapping_id").references(() => migrationMappings.id, { onDelete: "set null" }),
  level: varchar("level", { length: 20 }).default("info"), // info, warning, error, success
  message: text("message").notNull(),
  sourceId: varchar("source_id", { length: 100 }), // ID original do registro
  targetId: varchar("target_id", { length: 100 }), // ID do registro criado
  details: jsonb("details"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const migrationTemplates = pgTable("migration_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  sourceType: varchar("source_type", { length: 50 }).notNull(),
  sourceSystem: varchar("source_system", { length: 100 }),
  mappings: jsonb("mappings").notNull(), // templates de mapeamento pré-definidos
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertMigrationJobSchema = createInsertSchema(migrationJobs).omit({ id: true, createdAt: true, updatedAt: true });
export type MigrationJob = typeof migrationJobs.$inferSelect;
export type InsertMigrationJob = z.infer<typeof insertMigrationJobSchema>;

export const insertMigrationMappingSchema = createInsertSchema(migrationMappings).omit({ id: true, createdAt: true });
export type MigrationMapping = typeof migrationMappings.$inferSelect;
export type InsertMigrationMapping = z.infer<typeof insertMigrationMappingSchema>;

export const insertMigrationLogSchema = createInsertSchema(migrationLogs).omit({ id: true, createdAt: true });
export type MigrationLog = typeof migrationLogs.$inferSelect;
export type InsertMigrationLog = z.infer<typeof insertMigrationLogSchema>;

export const insertMigrationTemplateSchema = createInsertSchema(migrationTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type MigrationTemplate = typeof migrationTemplates.$inferSelect;
export type InsertMigrationTemplate = z.infer<typeof insertMigrationTemplateSchema>;

// ============================================================
// BLACKBOARD - SISTEMA DE AGENTES COLABORATIVOS
// ============================================================

export const blackboardTasks = pgTable("blackboard_tasks", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id"),
  type: varchar("type", { length: 50 }).notNull(), // main_task, subtask
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 30 }).default("pending"), // pending, in_progress, completed, failed, blocked
  priority: integer("priority").default(5), // 1-10
  assignedAgent: varchar("assigned_agent", { length: 100 }), // architect, generator, validator, executor, evolution
  dependencies: jsonb("dependencies"), // IDs de tarefas que precisam ser concluídas primeiro
  context: jsonb("context"), // Contexto adicional da tarefa
  result: jsonb("result"), // Resultado da execução
  errorMessage: text("error_message"),
  userId: varchar("user_id", { length: 255 }),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const blackboardArtifacts = pgTable("blackboard_artifacts", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => blackboardTasks.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // spec, code, test, doc, config
  name: varchar("name", { length: 255 }).notNull(),
  content: text("content"),
  metadata: jsonb("metadata"),
  version: integer("version").default(1),
  createdBy: varchar("created_by", { length: 100 }), // qual agente criou
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const blackboardAgentLogs = pgTable("blackboard_agent_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => blackboardTasks.id, { onDelete: "cascade" }),
  agentName: varchar("agent_name", { length: 100 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(), // thinking, executing, completed, error
  thought: text("thought"),
  observation: text("observation"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertBlackboardTaskSchema = createInsertSchema(blackboardTasks).omit({ id: true, createdAt: true, updatedAt: true });
export type BlackboardTask = typeof blackboardTasks.$inferSelect;
export type InsertBlackboardTask = z.infer<typeof insertBlackboardTaskSchema>;

export const insertBlackboardArtifactSchema = createInsertSchema(blackboardArtifacts).omit({ id: true, createdAt: true });
export type BlackboardArtifact = typeof blackboardArtifacts.$inferSelect;
export type InsertBlackboardArtifact = z.infer<typeof insertBlackboardArtifactSchema>;

export const insertBlackboardAgentLogSchema = createInsertSchema(blackboardAgentLogs).omit({ id: true, createdAt: true });
export type BlackboardAgentLog = typeof blackboardAgentLogs.$inferSelect;
export type InsertBlackboardAgentLog = z.infer<typeof insertBlackboardAgentLogSchema>;

export const xosContractRegistry = pgTable("xos_contract_registry", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  action: varchar("action", { length: 255 }).notNull(),
  description: text("description"),
  inputSchema: jsonb("input_schema"),
  outputSchema: jsonb("output_schema"),
  requiredPermissions: text("required_permissions").array(),
  category: varchar("category", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const xosToolRegistry = pgTable("xos_tool_registry", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  paramsSchema: jsonb("params_schema"),
  version: varchar("version", { length: 50 }).default("1.0.0"),
  allowedAgents: text("allowed_agents").array(),
  isActive: boolean("is_active").default(true).notNull(),
  registeredAt: timestamp("registered_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const xosSkillRegistry = pgTable("xos_skill_registry", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  version: varchar("version", { length: 50 }).notNull(),
  description: text("description"),
  steps: jsonb("steps"),
  tools: text("tools").array(),
  inputSchema: jsonb("input_schema"),
  outputSchema: jsonb("output_schema"),
  status: varchar("status", { length: 30 }).default("active"),
  createdBy: varchar("created_by", { length: 100 }),
  usageCount: integer("usage_count").default(0),
  successRate: integer("success_rate").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const xosPolicyRules = pgTable("xos_policy_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  scope: varchar("scope", { length: 50 }).notNull(),
  target: varchar("target", { length: 255 }).notNull(),
  effect: varchar("effect", { length: 10 }).notNull(),
  conditions: jsonb("conditions"),
  priority: integer("priority").default(100),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const xosAuditTrail = pgTable("xos_audit_trail", {
  id: serial("id").primaryKey(),
  correlationId: text("correlation_id"),
  agentName: varchar("agent_name", { length: 100 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  target: varchar("target", { length: 500 }),
  decision: varchar("decision", { length: 30 }).notNull(),
  justification: text("justification"),
  input: jsonb("input"),
  output: jsonb("output"),
  taskId: integer("task_id"),
  policyId: integer("policy_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertContractRegistrySchema = createInsertSchema(xosContractRegistry).omit({ id: true, createdAt: true, updatedAt: true });
export type XosContract = typeof xosContractRegistry.$inferSelect;
export type InsertXosContract = z.infer<typeof insertContractRegistrySchema>;

export const insertToolRegistrySchema = createInsertSchema(xosToolRegistry).omit({ id: true, registeredAt: true });
export type XosTool = typeof xosToolRegistry.$inferSelect;
export type InsertXosTool = z.infer<typeof insertToolRegistrySchema>;

export const insertSkillRegistrySchema = createInsertSchema(xosSkillRegistry).omit({ id: true, createdAt: true });
export type XosSkill = typeof xosSkillRegistry.$inferSelect;
export type InsertXosSkill = z.infer<typeof insertSkillRegistrySchema>;

export const insertPolicyRuleSchema = createInsertSchema(xosPolicyRules).omit({ id: true, createdAt: true });
export type XosPolicyRule = typeof xosPolicyRules.$inferSelect;
export type InsertXosPolicyRule = z.infer<typeof insertPolicyRuleSchema>;

export const insertAuditTrailSchema = createInsertSchema(xosAuditTrail).omit({ id: true, createdAt: true });
export type XosAuditEntry = typeof xosAuditTrail.$inferSelect;
export type InsertXosAuditEntry = z.infer<typeof insertAuditTrailSchema>;

export const xosJobQueue = pgTable("xos_job_queue", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  priority: integer("priority").default(50),
  status: text("status").notNull().default("pending"),
  assignedAgent: text("assigned_agent"),
  payload: jsonb("payload"),
  result: jsonb("result"),
  error: text("error"),
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").default("system"),
  parentJobId: integer("parent_job_id"),
  metadata: jsonb("metadata"),
});

export const insertJobQueueSchema = createInsertSchema(xosJobQueue).omit({ id: true, createdAt: true, startedAt: true, completedAt: true });
export type XosJob = typeof xosJobQueue.$inferSelect;
export type InsertXosJob = z.infer<typeof insertJobQueueSchema>;

export const xosAgentMetrics = pgTable("xos_agent_metrics", {
  id: serial("id").primaryKey(),
  agentName: text("agent_name").notNull(),
  period: text("period").notNull(),
  tasksCompleted: integer("tasks_completed").default(0),
  tasksFailed: integer("tasks_failed").default(0),
  avgDurationMs: integer("avg_duration_ms"),
  skillsCreated: integer("skills_created").default(0),
  policiesTriggered: integer("policies_triggered").default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertAgentMetricsSchema = createInsertSchema(xosAgentMetrics).omit({ id: true, createdAt: true });
export type XosAgentMetric = typeof xosAgentMetrics.$inferSelect;
export type InsertXosAgentMetric = z.infer<typeof insertAgentMetricsSchema>;

export const xosDevPipelines = pgTable("xos_dev_pipelines", {
  id: serial("id").primaryKey(),
  correlationId: text("correlation_id").notNull().default(sql`gen_random_uuid()`),
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("queued"),
  currentPhase: text("current_phase").default("queued"),
  mainTaskId: integer("main_task_id"),
  userId: text("user_id").default("system"),
  phases: jsonb("phases").$type<Record<string, { status: string; taskId?: number; startedAt?: string; completedAt?: string; result?: any }>>(),
  metadata: jsonb("metadata"),
  error: text("error"),
  budget: jsonb("budget").$type<{ maxTokens: number; maxTimeMs: number; maxCalls: number; usedTokens: number; usedTimeMs: number; usedCalls: number; exceeded: boolean }>(),
  runbook: jsonb("runbook").$type<{ context: string; decisions: Array<{ phase: string; agent: string; decision: string; timestamp: string }>; validations: any; approval: any; deployment: any }>(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertDevPipelineSchema = createInsertSchema(xosDevPipelines).omit({ id: true, createdAt: true, startedAt: true, completedAt: true });
export type XosDevPipeline = typeof xosDevPipelines.$inferSelect;
export type InsertXosDevPipeline = z.infer<typeof insertDevPipelineSchema>;

export const xosStagingChanges = pgTable("xos_staging_changes", {
  id: serial("id").primaryKey(),
  pipelineId: integer("pipeline_id"),
  taskId: integer("task_id"),
  correlationId: text("correlation_id"),
  filePath: text("file_path").notNull(),
  content: text("content").notNull(),
  originalContent: text("original_content"),
  diff: text("diff"),
  action: text("action").default("create"),
  status: text("status").notNull().default("pending"),
  validationScore: integer("validation_score"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  appliedAt: timestamp("applied_at"),
  rolledBackAt: timestamp("rolled_back_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertStagingChangeSchema = createInsertSchema(xosStagingChanges).omit({ id: true, createdAt: true, reviewedAt: true, appliedAt: true });
export type XosStagingChange = typeof xosStagingChanges.$inferSelect;
export type InsertXosStagingChange = z.infer<typeof insertStagingChangeSchema>;

// ========================================================================
// MOTOR DE COMUNICAÇÃO - Tabelas Canônicas (comm_*)
// Unifica xos_*, crm_*, whatsapp_*, email_* preservando regras de negócio
// ========================================================================

export const commChannels = pgTable("comm_channels", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 30 }).notNull(), // whatsapp, email, chat, instagram, facebook, telegram, sms, phone
  name: varchar("name", { length: 200 }).notNull(),
  identifier: varchar("identifier", { length: 200 }), // phone, email address, page id
  status: varchar("status", { length: 30 }).default("disconnected"), // connected, disconnected, connecting, error
  config: jsonb("config").$type<Record<string, any>>(), // channel-specific settings
  greetingMessage: text("greeting_message"),
  outOfHoursMessage: text("out_of_hours_message"),
  schedules: jsonb("schedules").$type<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>(),
  sourceRef: varchar("source_ref", { length: 50 }), // "crm_channels:5" or "whatsapp_sessions:1"
  isActive: boolean("is_active").default(true),
  lastConnectedAt: timestamp("last_connected_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const commContacts = pgTable("comm_contacts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 30 }).default("lead"), // lead, customer, partner, supplier
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  avatarUrl: text("avatar_url"),
  company: varchar("company", { length: 200 }),
  tradeName: varchar("trade_name", { length: 200 }),
  cnpj: varchar("cnpj", { length: 20 }),
  position: varchar("position", { length: 100 }),
  website: varchar("website", { length: 300 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  country: varchar("country", { length: 50 }).default("Brasil"),
  segment: varchar("segment", { length: 100 }),
  tags: text("tags").array(),
  customFields: jsonb("custom_fields").$type<Record<string, any>>(),
  leadScore: integer("lead_score").default(0),
  leadStatus: varchar("lead_status", { length: 30 }).default("new"),
  source: varchar("source", { length: 50 }),
  sourceDetails: text("source_details"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  primaryContactName: varchar("primary_contact_name", { length: 200 }),
  primaryContactEmail: varchar("primary_contact_email", { length: 200 }),
  primaryContactPhone: varchar("primary_contact_phone", { length: 50 }),
  notes: text("notes"),
  lastContactAt: timestamp("last_contact_at"),
  convertedAt: timestamp("converted_at"),
  xosContactId: integer("xos_contact_id"), // ref to xos_contacts.id
  crmClientId: integer("crm_client_id"), // ref to crm_clients.id
  crmLeadId: integer("crm_lead_id"), // ref to crm_leads.id
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const commThreads = pgTable("comm_threads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").references(() => commContacts.id),
  channelId: integer("channel_id").references(() => commChannels.id),
  channel: varchar("channel", { length: 30 }).notNull(), // whatsapp, email, chat, etc
  externalId: varchar("external_id", { length: 200 }), // ID in external channel
  status: varchar("status", { length: 20 }).default("open"), // open, pending, resolved, closed
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent
  subject: varchar("subject", { length: 300 }),
  assignedTo: varchar("assigned_to").references(() => users.id),
  queueId: integer("queue_id"),
  tags: text("tags").array(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  messagesCount: integer("messages_count").default(0),
  unreadCount: integer("unread_count").default(0),
  firstResponseAt: timestamp("first_response_at"),
  lastMessageAt: timestamp("last_message_at"),
  resolvedAt: timestamp("resolved_at"),
  satisfactionScore: integer("satisfaction_score"),
  satisfactionComment: text("satisfaction_comment"),
  xosConversationId: integer("xos_conversation_id"), // ref to xos_conversations.id
  crmThreadId: integer("crm_thread_id"), // ref to crm_threads.id
  whatsappTicketId: integer("whatsapp_ticket_id"), // ref to whatsapp_tickets.id
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const commMessages = pgTable("comm_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").references(() => commThreads.id, { onDelete: "cascade" }).notNull(),
  channelId: integer("channel_id").references(() => commChannels.id),
  direction: varchar("direction", { length: 10 }).notNull(), // inbound, outbound
  senderType: varchar("sender_type", { length: 20 }).notNull(), // contact, user, bot, system
  senderId: varchar("sender_id"),
  senderName: varchar("sender_name", { length: 200 }),
  content: text("content"),
  contentType: varchar("content_type", { length: 30 }).default("text"), // text, image, file, audio, video, location, template
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type", { length: 30 }),
  attachments: jsonb("attachments").$type<Array<{ url: string; type: string; name: string }>>(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  externalId: varchar("external_id", { length: 200 }),
  status: varchar("status", { length: 20 }).default("sent"), // pending, sent, delivered, read, failed
  isFromAgent: boolean("is_from_agent").default(false),
  readAt: timestamp("read_at"),
  deliveredAt: timestamp("delivered_at"),
  xosMessageId: integer("xos_message_id"), // ref to xos_messages.id
  crmMessageId: integer("crm_message_id"), // ref to crm_messages.id
  whatsappMessageId: integer("whatsapp_message_id"), // ref to whatsapp_messages.id
  emailMessageId: integer("email_message_id"), // ref to email_messages.id
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const commQueues = pgTable("comm_queues", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("blue"),
  greetingMessage: text("greeting_message"),
  outOfHoursMessage: text("out_of_hours_message"),
  schedules: jsonb("schedules").$type<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>(),
  autoAssign: boolean("auto_assign").default(false),
  assignmentMethod: varchar("assignment_method", { length: 20 }).default("round_robin"), // round_robin, least_busy, manual
  orderPriority: integer("order_priority").default(0),
  isActive: boolean("is_active").default(true),
  xosQueueId: integer("xos_queue_id"), // ref to xos_queues.id
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const commQueueMembers = pgTable("comm_queue_members", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").references(() => commQueues.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role", { length: 20 }).default("agent"), // agent, supervisor
  isAvailable: boolean("is_available").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const commQuickMessages = pgTable("comm_quick_messages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  shortcode: varchar("shortcode", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type", { length: 30 }),
  category: varchar("category", { length: 50 }),
  scope: varchar("scope", { length: 20 }).default("company"), // personal, team, company
  userId: varchar("user_id").references(() => users.id),
  variables: text("variables").array(), // {nome}, {empresa}, {ticket}
  usageCount: integer("usage_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ========== LLM Provider Configs ==========
export const llmProviderConfigs = pgTable("llm_provider_configs", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 50 }).notNull().unique(), // anthropic, gemini, ollama
  apiKey: text("api_key"),
  baseUrl: text("base_url"),
  enabled: boolean("enabled").default(true),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertLlmProviderConfigSchema = createInsertSchema(llmProviderConfigs).omit({ id: true, updatedAt: true });
export type LlmProviderConfig = typeof llmProviderConfigs.$inferSelect;
export type InsertLlmProviderConfig = z.infer<typeof insertLlmProviderConfigSchema>;

export const commEvents = pgTable("comm_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // message_received, message_sent, thread_created, thread_closed, contact_created, ticket_created, sla_breach
  entityType: varchar("entity_type", { length: 30 }).notNull(), // thread, message, contact, ticket, channel
  entityId: integer("entity_id").notNull(),
  data: jsonb("data").$type<Record<string, any>>(),
  processedByKg: boolean("processed_by_kg").default(false), // indexed in Knowledge Graph?
  processedByAgents: boolean("processed_by_agents").default(false), // consumed by agents?
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});


// ============================================================
// ARCÁDIA CONTROL + PESSOAS — Schema (auto-merged)
// ============================================================

// ─────────────────────────────────────────────────────────────
// BLOCO 1 — CONTROL (planos_contas, centros_custo, contas_bancarias,
// lancamentos_financeiros + grupos_parcelamento + templates_recorrencia +
// tipos_documento + periodos_competencia + insertSchemas + types)
// linhas 3195–3595 do schema original
// ─────────────────────────────────────────────────────────────
//           lancamentos_financeiros, periodos_competencia
//  Plano de contas é por TENANT (compartilhado).
//  Demais tabelas são por CLIENTE (CRM).
// =====================================================================

export const planosContas = pgTable("planos_contas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  codigo: varchar("codigo", { length: 30 }).notNull(),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  // ativo|passivo|patrimonio_liquido|receita|custo|despesa|resultado
  natureza: varchar("natureza", { length: 30 }).notNull(),
  nivel: integer("nivel").notNull().default(1),
  parentId: varchar("parent_id"),
  // Tag DRE/Fluxo/Fleuriet (ex: 'EBITDA', 'NCG', 'tesouraria', 'fluxo', 'calculado')
  naturezaDre: varchar("natureza_dre", { length: 30 }),
  permiteLancamento: boolean("permite_lancamento").default(true),
  ativo: boolean("ativo").default(true),
  // Sprint C6 — compatibilidade com balancete Domínio (5 níveis)
  // Código no padrão CFC: '3.2.2.04.0027' (até 5 segmentos)
  codigoCfc: varchar("codigo_cfc", { length: 30 }),
  // 'sintetica' (agrupadora, não recebe lançamento) | 'analitica' (folha, recebe)
  // Quando definido, sobrepõe `permiteLancamento` para validação dura.
  tipoConta: varchar("tipo_conta", { length: 15 }),
  // Grupo DRE para alimentar relatório:
  // 'receita_bruta'|'deducoes'|'cmv'|'despesas_pessoal'|'despesas_gerais'
  // |'despesas_financeiras'|'resultado_financeiro'|'outras'
  grupoDre: varchar("grupo_dre", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_planos_contas_tenant").on(t.tenantId),
  uniqueIndex("planos_contas_tenant_codigo_uniq").on(t.tenantId, t.codigo),
  index("idx_planos_contas_codigo_cfc").on(t.tenantId, t.codigoCfc),
]);

// Sprint C6 — Centros de Custo dinâmicos. Tipos: departamento (permanente),
// projeto (com data início/fim), atividade (semi-permanente).
// `parentId` permite hierarquia (CC pai/filho) — FK self-referencial declarada
// inline com any-cast para evitar circular declaration.
export const centrosCusto = pgTable("centros_custo", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  codigo: varchar("codigo", { length: 30 }).notNull(),
  nome: varchar("nome", { length: 200 }).notNull(),
  descricao: text("descricao"),
  ativo: boolean("ativo").default(true),
  // Sprint C6 — campos novos
  tipo: varchar("tipo", { length: 20 }).notNull().default("departamento"),
  // 'departamento' | 'projeto' | 'atividade'
  parentId: varchar("parent_id"),
  // FK lógica para centros_custo.id; sem .references() (self-ref / circular)
  responsavel: varchar("responsavel", { length: 200 }),
  dataInicio: date("data_inicio"),
  dataFim: date("data_fim"),
  orcamentoAnual: numeric("orcamento_anual", { precision: 15, scale: 2 }),
  cor: varchar("cor", { length: 7 }).default("#6366f1"),
  // Sprint C-E07 — campos Engineering
  marcaRateio: boolean("marca_rateio").default(false),
  centroCustoRaiz: boolean("centro_custo_raiz").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_centros_custo_tenant_cliente").on(t.tenantId, t.clienteId),
  index("idx_centros_custo_parent").on(t.parentId),
  index("idx_centros_custo_tipo").on(t.tenantId, t.tipo),
]);

// Sprint C6 — Rateio de lançamentos financeiros entre múltiplos CCs.
// SUM(percentual) DEVE = 100 ± 0.01 (validado no service em transação).
// Se vazio, lançamento usa centroCustoId direto. Se houver linhas,
// elas têm precedência (centroCustoId pode ficar null).
export const rateiosCc = pgTable("rateios_cc", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  lancamentoId: varchar("lancamento_financeiro_id").notNull().references(() => lancamentosFinanceiros.id, { onDelete: "cascade" }),
  centroCustoId: varchar("centro_custo_id").notNull().references(() => centrosCusto.id),
  percentual: numeric("percentual", { precision: 5, scale: 2 }).notNull(),
  valorRateado: numeric("valor_rateado", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_rateios_cc_lanc").on(t.lancamentoId),
  index("idx_rateios_cc_tenant_cc").on(t.tenantId, t.centroCustoId),
]);

export const contasBancarias = pgTable("contas_bancarias", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 200 }).notNull(),
  banco: varchar("banco", { length: 100 }),
  agencia: varchar("agencia", { length: 20 }),
  conta: varchar("conta", { length: 30 }),
  // cc | poupanca | caixa | carteira | outro
  tipo: varchar("tipo", { length: 20 }).notNull().default("cc"),
  saldoInicial: numeric("saldo_inicial", { precision: 15, scale: 2 }).default("0"),
  saldoAtual: numeric("saldo_atual", { precision: 15, scale: 2 }).default("0"),
  ativo: boolean("ativo").default(true),
  // Reservado para Sprint 4 (consolidação por grupo)
  grupoId: varchar("grupo_id"),
  // Sprint C10/C11 — apelido amigável (ex: 'Itaú Principal'), responsável
  // (titular de carteira corporativa, ex: 'Caju - Amanda')
  apelido: varchar("apelido", { length: 100 }),
  responsavelId: varchar("responsavel_id"),
  // CTL-01 — Sub-contas de cartão corporativo por colaborador
  parentContaId: varchar("parent_conta_id"),   // ID da conta mãe (ex: Caju institucional)
  pessoaId: varchar("pessoa_id"),              // Colaborador vinculado (ex: Daniel, Eder)
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_contas_bancarias_tenant_cliente").on(t.tenantId, t.clienteId),
]);

export const lancamentosFinanceiros = pgTable("lancamentos_financeiros", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  // pagar | receber
  tipo: varchar("tipo", { length: 10 }).notNull(),
  descricao: varchar("descricao", { length: 500 }).notNull(),
  favorecido: varchar("favorecido", { length: 300 }),
  documento: varchar("documento", { length: 80 }),
  valor: numeric("valor", { precision: 15, scale: 2 }).notNull(),
  dataEmissao: date("data_emissao"),
  dataVencimento: date("data_vencimento").notNull(),
  dataPagamento: date("data_pagamento"),
  // previsto | aprovado | pago | vencido | cancelado | inadimplente
  status: varchar("status", { length: 20 }).notNull().default("previsto"),
  planoContaId: varchar("plano_conta_id").references(() => planosContas.id),
  centroCustoId: varchar("centro_custo_id").references(() => centrosCusto.id),
  contaBancariaId: varchar("conta_bancaria_id").references(() => contasBancarias.id),
  // manual | ia | integracao | importacao
  origem: varchar("origem", { length: 20 }).notNull().default("manual"),
  criadoPorIa: boolean("criado_por_ia").default(false),
  criadoPor: varchar("criado_por").references(() => users.id),
  aprovadoPor: varchar("aprovado_por").references(() => users.id),
  aprovadoEm: timestamp("aprovado_em"),
  observacoes: text("observacoes"),
  // Reservado para Sprint 4
  grupoId: varchar("grupo_id"),
  // Sprint 3 Recovery: vínculo bidirecional com parcela de acordo
  // (FK criada via SQL na migration; Drizzle não declara `.references` pra evitar circular import)
  recoveryInstallmentId: varchar("recovery_installment_id"),
  // Sprint C7 — G1 Parcelamento: vínculo com grupo + posição da parcela
  grupoParcelamentoId: varchar("grupo_parcelamento_id"),
  numeroParcela: integer("numero_parcela"),
  totalParcelas: integer("total_parcelas"),
  // Sprint C7 — G2 Recorrência: vínculo com template gerador
  templateRecorrenciaId: varchar("template_recorrencia_id"),
  origemRecorrencia: boolean("origem_recorrencia").default(false),
  // Sprint C7 — G11 Tipo de Documento parametrizável
  tipoDocumentoId: varchar("tipo_documento_id"),
  // Sprint C-E03 — vínculo com projeto de engenharia
  projetoId: varchar("projeto_id"),
  osNumero: varchar("os_numero", { length: 50 }),
  pessoaId: varchar("pessoa_id"),
  // CTL-02 — AR enriquecida: código legado, parceiro/canal, tipo de recorrência
  projetoCodigo: varchar("projeto_codigo", { length: 50 }),   // ex: IMP23195
  parceiro: varchar("parceiro", { length: 100 }),              // ex: Vibra, Direto, SAF
  tipoRecorrenciaAr: varchar("tipo_recorrencia_ar", { length: 30 }), // Avulso | Parcelas | Recorrente
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_lanc_tenant_cliente").on(t.tenantId, t.clienteId),
  index("idx_lanc_status").on(t.tenantId, t.status),
  index("idx_lanc_vencimento").on(t.tenantId, t.dataVencimento),
  index("idx_lanc_tipo").on(t.tenantId, t.tipo),
  index("idx_lanc_recovery_installment").on(t.recoveryInstallmentId),
  index("idx_lanc_grupo_parcelamento").on(t.grupoParcelamentoId),
  index("idx_lanc_template_recorrencia").on(t.templateRecorrenciaId),
  index("idx_lanc_projeto").on(t.projetoId),
  index("idx_lanc_parceiro").on(t.parceiro),
]);

// =====================================================================
//  Sprint C7 — G1 Parcelamento, G2 Recorrência, G11 Tipos de Documento
// =====================================================================

// Grupo de parcelamento — vincula N lançamentos (numeroParcela 1..N)
export const gruposParcelamento = pgTable("grupos_parcelamento", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  // 'pagar' | 'receber'
  tipo: varchar("tipo", { length: 10 }).notNull(),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  totalParcelas: integer("total_parcelas").notNull(),
  valorTotal: numeric("valor_total", { precision: 15, scale: 2 }).notNull(),
  planoContaId: varchar("plano_conta_id").references(() => planosContas.id),
  centroCustoId: varchar("centro_custo_id").references(() => centrosCusto.id),
  tipoDocumentoId: varchar("tipo_documento_id"),
  favorecido: varchar("favorecido", { length: 300 }),
  observacoes: text("observacoes"),
  criadoPor: varchar("criado_por").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_grupos_parcel_tenant_cliente").on(t.tenantId, t.clienteId),
]);

// Template de recorrência — gera lançamentos automaticamente via cron diário
export const templatesRecorrencia = pgTable("templates_recorrencia", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  // 'pagar' | 'receber'
  tipo: varchar("tipo", { length: 10 }).notNull(),
  // 'mensal' | 'quinzenal' | 'semanal' | 'anual'
  frequencia: varchar("frequencia", { length: 20 }).notNull(),
  // 1..28 para mensal/anual
  diaVencimento: integer("dia_vencimento"),
  // null = valor variável (usuário ajusta na geração)
  valorFixo: numeric("valor_fixo", { precision: 15, scale: 2 }),
  planoContaId: varchar("plano_conta_id").references(() => planosContas.id),
  centroCustoId: varchar("centro_custo_id").references(() => centrosCusto.id),
  contaBancariaId: varchar("conta_bancaria_id").references(() => contasBancarias.id),
  tipoDocumentoId: varchar("tipo_documento_id"),
  favorecido: varchar("favorecido", { length: 300 }),
  dataInicio: date("data_inicio").notNull(),
  // null = recorrência indefinida
  dataFim: date("data_fim"),
  ativa: boolean("ativa").notNull().default(true),
  // última data até a qual o cron já gerou ocorrências (avança para frente)
  geradasAte: date("geradas_ate"),
  observacoes: text("observacoes"),
  criadoPor: varchar("criado_por").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_templates_rec_tenant_cliente").on(t.tenantId, t.clienteId),
  index("idx_templates_rec_ativa").on(t.tenantId, t.ativa),
]);

// Tipos de documento parametrizáveis (NF-e, Boleto, PIX, etc.)
// tenantId='__global__' = seed da plataforma (visível a todos os tenants em leitura)
// tenantId=<real>      = customizado pelo tenant
export const tiposDocumento = pgTable("tipos_documento", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  nome: varchar("nome", { length: 100 }).notNull(),
  icone: varchar("icone", { length: 50 }).default("file"),
  ativo: boolean("ativo").notNull().default(true),
  ordem: integer("ordem").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_tipos_doc_tenant").on(t.tenantId),
  uniqueIndex("uniq_tipos_doc_tenant_nome").on(t.tenantId, t.nome),
]);

export const periodosCompetencia = pgTable("periodos_competencia", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(),
  // aberto | em_revisao | fechado
  status: varchar("status", { length: 20 }).notNull().default("aberto"),
  fechadoPor: varchar("fechado_por").references(() => users.id),
  fechadoEm: timestamp("fechado_em"),
  observacoes: text("observacoes"),
  grupoId: varchar("grupo_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_periodos_tenant_cliente").on(t.tenantId, t.clienteId),
  uniqueIndex("uniq_periodo_cliente_mes").on(t.tenantId, t.clienteId, t.ano, t.mes),
]);

// Sprint C6.1 — Extrato bancário: cada movimento (origem conciliação de
// lançamento, ajuste manual ou saldo inicial) gera 1 linha aqui. saldoApos
// é calculado no service (saldoAtual da conta após este movimento) e fica
// congelado para fins de extrato/auditoria. Quando uma conciliação é
// revertida, a linha correspondente é deletada e o saldo da conta volta.
export const movimentacoesBancarias = pgTable("movimentacoes_bancarias", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  contaBancariaId: varchar("conta_bancaria_id").notNull().references(() => contasBancarias.id, { onDelete: "cascade" }),
  // Pode ser null (ajuste manual ou saldo inicial).
  lancamentoId: varchar("lancamento_financeiro_id"),
  data: date("data_movimentacao").notNull(),
  // entrada (recebimento, ajuste positivo, saldo inicial) | saida (pagamento, ajuste negativo)
  tipo: varchar("tipo", { length: 10 }).notNull(),
  // conciliacao | desconciliacao | ajuste_manual | saldo_inicial | transferencia | manual
  origem: varchar("origem", { length: 50 }).notNull().default("manual"),
  descricao: varchar("descricao", { length: 500 }).notNull(),
  valor: numeric("valor", { precision: 15, scale: 2 }).notNull(),
  saldoApos: numeric("saldo_apos", { precision: 15, scale: 2 }),
  conciliado: boolean("conciliado").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_mov_banc_tenant_conta_data").on(t.tenantId, t.contaBancariaId, t.data),
]);

export const insertMovimentacaoBancariaSchema = createInsertSchema(movimentacoesBancarias).omit({ id: true, createdAt: true, saldoApos: true });
export type MovimentacaoBancaria = typeof movimentacoesBancarias.$inferSelect;
export type InsertMovimentacaoBancaria = z.infer<typeof insertMovimentacaoBancariaSchema>;

export const insertPlanoContaSchema = createInsertSchema(planosContas).omit({ id: true, createdAt: true });
// Sprint C6 — refine: tipo='projeto' exige dataInicio E dataFim; cor deve ser hex válido.
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
export const insertCentroCustoSchema = createInsertSchema(centrosCusto)
  .omit({ id: true, createdAt: true })
  .refine(
    (d) => d.tipo !== "projeto" || (!!d.dataInicio && !!d.dataFim),
    { message: "Centros de Custo do tipo 'projeto' exigem dataInicio e dataFim", path: ["dataInicio"] },
  )
  .refine(
    (d) => !d.cor || HEX_COLOR_RE.test(d.cor),
    { message: "Cor deve ser hex no formato #RRGGBB", path: ["cor"] },
  )
  .refine(
    (d) => ["departamento", "projeto", "atividade"].includes(d.tipo ?? "departamento"),
    { message: "Tipo deve ser departamento, projeto ou atividade", path: ["tipo"] },
  );
export const insertRateioCcSchema = createInsertSchema(rateiosCc).omit({ id: true, createdAt: true, valorRateado: true });
export const insertContaBancariaSchema = createInsertSchema(contasBancarias).omit({ id: true, createdAt: true, saldoAtual: true });
export const insertLancamentoFinanceiroSchema = createInsertSchema(lancamentosFinanceiros).omit({ id: true, createdAt: true, updatedAt: true, aprovadoPor: true, aprovadoEm: true });
export const insertPeriodoCompetenciaSchema = createInsertSchema(periodosCompetencia).omit({ id: true, createdAt: true, fechadoPor: true, fechadoEm: true });

// Sprint C7
export const insertGrupoParcelamentoSchema = createInsertSchema(gruposParcelamento).omit({ id: true, createdAt: true });
export const insertTemplateRecorrenciaSchema = createInsertSchema(templatesRecorrencia).omit({ id: true, createdAt: true, updatedAt: true, geradasAte: true });
export const insertTipoDocumentoSchema = createInsertSchema(tiposDocumento).omit({ id: true, createdAt: true });

// =====================================================================
//  Sprint C8 — Orçamento mensal por conta (Realizado × Previsto)
//  Cobertura do gap G3 da planilha Impacto (MetaReceitas/MetaDespesas).
// =====================================================================
export const orcamentosMensais = pgTable("orcamentos_mensais", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planoContaId: varchar("plano_conta_id").notNull().references(() => planosContas.id, { onDelete: "cascade" }),
  // null = orçamento da conta sem rateio por CC
  centroCustoId: varchar("centro_custo_id").references(() => centrosCusto.id, { onDelete: "cascade" }),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(), // 1..12
  valorPrevisto: numeric("valor_previsto", { precision: 15, scale: 2 }).notNull().default("0"),
  // Threshold de desvio em pontos percentuais para alertar (ex: 15 = 15%).
  // Quando null usa o default do cliente (env LLM_DESVIO_DEFAULT_PCT ou 15).
  thresholdAlertaPct: numeric("threshold_alerta_pct", { precision: 5, scale: 2 }),
  observacoes: text("observacoes"),
  criadoPor: varchar("criado_por").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_orcamentos_tenant_cliente_ano").on(t.tenantId, t.clienteId, t.ano),
  // UNIQUE garante upsert por chave natural. Como Postgres trata NULL como
  // distinto, usamos COALESCE via expressão para fazer "centroCusto opcional"
  // funcionar como single row — por isso há também um índice parcial abaixo.
  uniqueIndex("uniq_orcamento_mensal_full")
    .on(t.tenantId, t.clienteId, t.planoContaId, t.centroCustoId, t.ano, t.mes)
    .where(sql`${t.centroCustoId} IS NOT NULL`),
  uniqueIndex("uniq_orcamento_mensal_sem_cc")
    .on(t.tenantId, t.clienteId, t.planoContaId, t.ano, t.mes)
    .where(sql`${t.centroCustoId} IS NULL`),
]);

export const insertOrcamentoMensalSchema = createInsertSchema(orcamentosMensais).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type OrcamentoMensal = typeof orcamentosMensais.$inferSelect;
export type InsertOrcamentoMensal = z.infer<typeof insertOrcamentoMensalSchema>;

export type PlanoConta = typeof planosContas.$inferSelect;
export type InsertPlanoConta = z.infer<typeof insertPlanoContaSchema>;
export type CentroCusto = typeof centrosCusto.$inferSelect;
export type InsertCentroCusto = z.infer<typeof insertCentroCustoSchema>;
export type RateioCc = typeof rateiosCc.$inferSelect;
export type InsertRateioCc = z.infer<typeof insertRateioCcSchema>;
export type ContaBancaria = typeof contasBancarias.$inferSelect;
export type InsertContaBancaria = z.infer<typeof insertContaBancariaSchema>;
export type LancamentoFinanceiro = typeof lancamentosFinanceiros.$inferSelect;
export type InsertLancamentoFinanceiro = z.infer<typeof insertLancamentoFinanceiroSchema>;
export type PeriodoCompetencia = typeof periodosCompetencia.$inferSelect;
export type InsertPeriodoCompetencia = z.infer<typeof insertPeriodoCompetenciaSchema>;

// Sprint C7
export type GrupoParcelamento = typeof gruposParcelamento.$inferSelect;
export type InsertGrupoParcelamento = z.infer<typeof insertGrupoParcelamentoSchema>;
export type TemplateRecorrencia = typeof templatesRecorrencia.$inferSelect;
export type InsertTemplateRecorrencia = z.infer<typeof insertTemplateRecorrenciaSchema>;
export type TipoDocumento = typeof tiposDocumento.$inferSelect;
export type InsertTipoDocumento = z.infer<typeof insertTipoDocumentoSchema>;

// =====================================================================
//  ARCÁDIA CONTROL — Sprint 4 + 5: Base contábil expandida
//  Grupos/Filiais, Partidas Dobradas, Hub de Conectores, Import,
//  IBS/CBS, Monitor NF-e, Fleuriet, Fechamento, Retenções
// =====================================================================

// ── Grupos empresariais (matriz / filiais / holdings) ───────────────
export const gruposEmpresariais = pgTable("grupos_empresariais", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  nome: varchar("nome", { length: 300 }).notNull(),
  // grupo_simples | holding | franquia | rede
  tipo: varchar("tipo", { length: 30 }).notNull().default("grupo_simples"),
  matrizClienteId: varchar("matriz_cliente_id").references(() => clients.id, { onDelete: "set null" }),
  descricao: text("descricao"),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_grupos_empresariais_tenant").on(t.tenantId),
]);

export const gruposEmpresariaisMembros = pgTable("grupos_empresariais_membros", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  grupoId: varchar("grupo_id").notNull().references(() => gruposEmpresariais.id, { onDelete: "cascade" }),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  // matriz | filial | controlada | coligada
  papel: varchar("papel", { length: 20 }).notNull().default("filial"),
  participacao: numeric("participacao", { precision: 6, scale: 3 }).default("100.000"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_grupos_membros_tenant_grupo").on(t.tenantId, t.grupoId),
  uniqueIndex("uniq_grupo_cliente").on(t.grupoId, t.clienteId),
]);


// ─────────────────────────────────────────────────────────────
// BLOCO 2 — CONTABILIDADE + CONECTORES + NF-e (lancamentos_contabeis,
// fechamentos_contabeis, conectores, conectores_sync_logs, nfes_recebidas)
// linhas 3597–3780 do schema original
// ─────────────────────────────────────────────────────────────
export const lancamentosContabeis = pgTable("lancamentos_contabeis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  grupoId: varchar("grupo_id"),
  data: date("data").notNull(),
  historico: text("historico").notNull(),
  numeroDoc: varchar("numero_doc", { length: 80 }),
  lote: varchar("lote", { length: 80 }),
  // pendente | conferido | lancado | estornado
  status: varchar("status", { length: 20 }).notNull().default("pendente"),
  // manual | sistema | integracao | importacao
  origem: varchar("origem", { length: 20 }).notNull().default("manual"),
  totalDebito: numeric("total_debito", { precision: 15, scale: 2 }).notNull().default("0"),
  totalCredito: numeric("total_credito", { precision: 15, scale: 2 }).notNull().default("0"),
  periodoId: varchar("periodo_id").references(() => periodosCompetencia.id),
  criadoPor: varchar("criado_por").references(() => users.id),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_lanc_contabeis_tenant_cliente").on(t.tenantId, t.clienteId),
  index("idx_lanc_contabeis_data").on(t.tenantId, t.data),
]);

export const partidasContabeis = pgTable("partidas_contabeis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  lancamentoContabilId: varchar("lancamento_contabil_id").notNull().references(() => lancamentosContabeis.id, { onDelete: "cascade" }),
  planoContaId: varchar("plano_conta_id").notNull().references(() => planosContas.id),
  centroCustoId: varchar("centro_custo_id").references(() => centrosCusto.id),
  // D | C
  tipo: varchar("tipo", { length: 1 }).notNull(),
  valor: numeric("valor", { precision: 15, scale: 2 }).notNull(),
  // Para rateio: 100% por padrão
  rateio: numeric("rateio", { precision: 6, scale: 3 }).default("100.000"),
  descricao: text("descricao"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_partidas_lanc").on(t.lancamentoContabilId),
  index("idx_partidas_tenant_conta").on(t.tenantId, t.planoContaId),
]);

// ── Hub de Conectores ────────────────────────────────────────────────
export const conectores = pgTable("conectores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  // Pode ser por cliente (ERP do cliente) ou por tenant (BrasilAPI compartilhada)
  clienteId: varchar("cliente_id").references(() => clients.id, { onDelete: "cascade" }),
  // brasil_api | dominio | nuvem_fiscal | omie | bling | conta_azul | open_finance | asaas | iugu | pipedrive | hubspot | rd_station | totvs_protheus | sap_b1 | quickbooks | stripe
  tipoConector: varchar("tipo_conector", { length: 40 }).notNull(),
  nome: varchar("nome", { length: 200 }).notNull(),
  // Config criptografada (chaves API, OAuth tokens, endpoints customizados)
  configCriptografada: text("config_criptografada"),
  // ativo | inativo | erro | nao_configurado
  status: varchar("status", { length: 20 }).notNull().default("nao_configurado"),
  ultimaSincronizacao: timestamp("ultima_sincronizacao"),
  ultimoErro: text("ultimo_erro"),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_conectores_tenant").on(t.tenantId),
  index("idx_conectores_tenant_tipo").on(t.tenantId, t.tipoConector),
]);

export const conectoresSyncLogs = pgTable("conectores_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  conectorId: varchar("conector_id").notNull().references(() => conectores.id, { onDelete: "cascade" }),
  iniciadoEm: timestamp("iniciado_em").defaultNow(),
  finalizadoEm: timestamp("finalizado_em"),
  // sucesso | erro | em_andamento
  status: varchar("status", { length: 20 }).notNull().default("em_andamento"),
  registrosProcessados: integer("registros_processados").default(0),
  mensagem: text("mensagem"),
  payloadResumo: jsonb("payload_resumo"),
}, (t) => [
  index("idx_sync_logs_tenant_conector").on(t.tenantId, t.conectorId),
]);

// ── NF-e recebidas (Sprint 5 — Monitor) ──────────────────────────────
export const nfesRecebidas = pgTable("nfes_recebidas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  chaveNfe: varchar("chave_nfe", { length: 44 }).notNull(),
  numeroNfe: varchar("numero_nfe", { length: 20 }),
  serieNfe: varchar("serie_nfe", { length: 5 }),
  dataEmissao: date("data_emissao"),
  valorTotal: numeric("valor_total", { precision: 15, scale: 2 }),
  fornecedorCnpj: varchar("fornecedor_cnpj", { length: 14 }),
  fornecedorNome: varchar("fornecedor_nome", { length: 300 }),
  xmlConteudo: text("xml_conteudo"),
  // pendente | ciencia | confirmacao | desconhecimento | nao_realizada
  statusManifestacao: varchar("status_manifestacao", { length: 30 }).notNull().default("pendente"),
  categorizacaoIa: jsonb("categorizacao_ia"),
  lancamentoFinanceiroId: varchar("lancamento_financeiro_id").references(() => lancamentosFinanceiros.id, { onDelete: "set null" }),
  processadoEm: timestamp("processado_em"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_nfes_tenant_cliente").on(t.tenantId, t.clienteId),
  uniqueIndex("uniq_nfe_chave_cliente").on(t.clienteId, t.chaveNfe),
]);

// ── Fechamento contábil (Sprint 5) ──────────────────────────────────
export const fechamentosContabeis = pgTable("fechamentos_contabeis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(),
  // em_andamento | concluido | reaberto
  status: varchar("status", { length: 20 }).notNull().default("em_andamento"),
  checklist: jsonb("checklist"),
  iniciadoPor: varchar("iniciado_por").references(() => users.id),
  iniciadoEm: timestamp("iniciado_em").defaultNow(),
  concluidoPor: varchar("concluido_por").references(() => users.id),
  concluidoEm: timestamp("concluido_em"),
  observacoes: text("observacoes"),
}, (t) => [
  uniqueIndex("uniq_fechamento_cliente_periodo").on(t.tenantId, t.clienteId, t.ano, t.mes),
]);

// ── Regime tributário por cliente / ano (Sprint 5 — IBS/CBS) ────────
export const regimeTributarioConfig = pgTable("regime_tributario_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  ano: integer("ano").notNull(),
  // simples | lucro_presumido | lucro_real | mei
  regime: varchar("regime", { length: 30 }).notNull(),
  aliquotasPersonalizadas: jsonb("aliquotas_personalizadas"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  uniqueIndex("uniq_regime_cliente_ano").on(t.tenantId, t.clienteId, t.ano),
]);

// ── Retenções (Sprint 5 — IRRF/PIS/COFINS/CSLL/INSS/ISS) ─────────────
export const retencoes = pgTable("retencoes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  lancamentoFinanceiroId: varchar("lancamento_financeiro_id").notNull().references(() => lancamentosFinanceiros.id, { onDelete: "cascade" }),
  // irrf | pis | cofins | csll | inss | iss | ibs | cbs
  tipo: varchar("tipo", { length: 10 }).notNull(),
  aliquota: numeric("aliquota", { precision: 6, scale: 4 }).notNull(),
  baseCalculo: numeric("base_calculo", { precision: 15, scale: 2 }).notNull(),
  valorRetido: numeric("valor_retido", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_retencoes_lanc").on(t.lancamentoFinanceiroId),
]);

// Insert schemas + types
export const insertGrupoEmpresarialSchema = createInsertSchema(gruposEmpresariais).omit({ id: true, createdAt: true });
export const insertGrupoMembroSchema = createInsertSchema(gruposEmpresariaisMembros).omit({ id: true, createdAt: true });
export const insertLancamentoContabilSchema = createInsertSchema(lancamentosContabeis).omit({ id: true, createdAt: true, updatedAt: true, totalDebito: true, totalCredito: true });
export const insertPartidaContabilSchema = createInsertSchema(partidasContabeis).omit({ id: true, createdAt: true });
export const insertConectorSchema = createInsertSchema(conectores).omit({ id: true, createdAt: true, ultimaSincronizacao: true, ultimoErro: true });
export const insertConectorSyncLogSchema = createInsertSchema(conectoresSyncLogs).omit({ id: true, iniciadoEm: true, finalizadoEm: true });
export const insertNfeRecebidaSchema = createInsertSchema(nfesRecebidas).omit({ id: true, createdAt: true, processadoEm: true });
export const insertFechamentoContabilSchema = createInsertSchema(fechamentosContabeis).omit({ id: true, iniciadoEm: true, concluidoEm: true, concluidoPor: true });
export const insertRegimeTributarioSchema = createInsertSchema(regimeTributarioConfig).omit({ id: true, createdAt: true });
export const insertRetencaoSchema = createInsertSchema(retencoes).omit({ id: true, createdAt: true });

export type GrupoEmpresarial = typeof gruposEmpresariais.$inferSelect;
export type InsertGrupoEmpresarial = z.infer<typeof insertGrupoEmpresarialSchema>;
export type GrupoMembro = typeof gruposEmpresariaisMembros.$inferSelect;
export type InsertGrupoMembro = z.infer<typeof insertGrupoMembroSchema>;
export type LancamentoContabil = typeof lancamentosContabeis.$inferSelect;
export type InsertLancamentoContabil = z.infer<typeof insertLancamentoContabilSchema>;
export type PartidaContabil = typeof partidasContabeis.$inferSelect;
export type InsertPartidaContabil = z.infer<typeof insertPartidaContabilSchema>;
export type Conector = typeof conectores.$inferSelect;
export type InsertConector = z.infer<typeof insertConectorSchema>;
export type ConectorSyncLog = typeof conectoresSyncLogs.$inferSelect;
export type InsertConectorSyncLog = z.infer<typeof insertConectorSyncLogSchema>;
export type NfeRecebida = typeof nfesRecebidas.$inferSelect;
export type InsertNfeRecebida = z.infer<typeof insertNfeRecebidaSchema>;
export type FechamentoContabil = typeof fechamentosContabeis.$inferSelect;
export type InsertFechamentoContabil = z.infer<typeof insertFechamentoContabilSchema>;
export type RegimeTributario = typeof regimeTributarioConfig.$inferSelect;
export type InsertRegimeTributario = z.infer<typeof insertRegimeTributarioSchema>;
export type Retencao = typeof retencoes.$inferSelect;
export type InsertRetencao = z.infer<typeof insertRetencaoSchema>;

// ─────────────────────────────────────────────────────────────
// BLOCO 3 — PESSOAS (pessoas, enderecos, contatos, pessoa_papeis +
// relations + insertSchemas + types)
// linhas 4516–4680 do schema original
// ─────────────────────────────────────────────────────────────
// ============================================================================
// MÓDULO PESSOAS (CRM 2.0) — Cadastro centralizado de relacionamentos
// Sprint 1: Fundação. Tenant-scoped, com múltiplos papéis (cliente, fornecedor,
// colaborador, transportadora, credor) por pessoa via tabela pessoa_papeis.
// ============================================================================

export const pessoas = pgTable("pessoas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),

  // 'PF' (pessoa física) | 'PJ' (pessoa jurídica)
  tipoPessoa: varchar("tipo_pessoa", { length: 2 }).notNull(),
  nomeFantasia: varchar("nome_fantasia", { length: 255 }).notNull(),
  razaoSocial: varchar("razao_social", { length: 255 }),
  // CPF (11 dígitos) ou CNPJ (14 dígitos), apenas dígitos
  cnpjCpf: varchar("cnpj_cpf", { length: 20 }).notNull(),
  // DEPRECIADO — mantido por compatibilidade até FISC-05. Usar rg (PF) ou ie (PJ).
  rgIe: varchar("rg_ie", { length: 30 }),

  // FISC-01: campos fiscais separados
  rg:              varchar("rg",  { length: 20 }),
  ie:              varchar("ie",  { length: 30 }),
  // S = Contribuinte ICMS | N = Não contribuinte | I = Isento
  contribuinte:    varchar("contribuinte", { length: 1 }).default("N"),
  // 1 = Consumidor final (B2C) | 0 = Não (B2B / revenda)
  consumidorFinal: smallint("consumidor_final").default(1),

  inscricaoMunicipal: varchar("inscricao_municipal", { length: 30 }),

  dataNascimentoFundacao: date("data_nascimento_fundacao"),

  // 'ativo' | 'inativo' | 'bloqueado'
  status: varchar("status", { length: 20 }).default("ativo").notNull(),
  observacoes: text("observacoes"),

  // ----- Campos comerciais (cf. planilha DATAEXPORT) -----
  // Identificador externo do sistema de origem (ex.: ERP, CRM legado, planilha)
  codigoExterno: varchar("codigo_externo", { length: 100 }),
  // Grupo / segmento de cadastro (ex.: VIP, Atacado, Revenda)
  pessoaGrupo: varchar("pessoa_grupo", { length: 100 }),
  // Vendedor responsável (texto livre — pode virar FK depois)
  vendedorPadrao: varchar("vendedor_padrao", { length: 150 }),
  categoria: varchar("categoria", { length: 100 }),
  tabelaPreco: varchar("tabela_preco", { length: 100 }),
  // Limite de crédito em R$ (decimal 14,2)
  limiteCredito: numeric("limite_credito", { precision: 14, scale: 2 }),
  // Periodicidade de compra/venda em dias (média histórica)
  periodicidadeVendaCompra: integer("periodicidade_venda_compra"),
  // Valor mínimo de pedido/compra (R$)
  valorMinimoCompra: numeric("valor_minimo_compra", { precision: 14, scale: 2 }),

  // Vínculo com o cadastro legado (clients.id) para idempotência da migração
  // e para resolver redirects de URLs antigas /clientes/:legacyId → /pessoas/:novoId
  legacyClientId: varchar("legacy_client_id"),
  // P2: grupo por FK para pessoa_grupos
  grupoId: varchar("grupo_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdById: varchar("created_by_id"),
  updatedById: varchar("updated_by_id"),
}, (t) => ({
  // Unicidade de documento por tenant (evita duplicidade na importação)
  uqPessoaTenantCnpj: uniqueIndex("uq_pessoa_tenant_cnpj").on(t.tenantId, t.cnpjCpf),
  // Unicidade de vínculo com o cadastro legado por tenant (idempotência)
  uqPessoaTenantLegacy: uniqueIndex("uq_pessoa_tenant_legacy").on(t.tenantId, t.legacyClientId),
  idxPessoaTenantStatus: index("idx_pessoa_tenant_status").on(t.tenantId, t.status),
  idxPessoaTenantNome: index("idx_pessoa_tenant_nome").on(t.tenantId, t.nomeFantasia),
}));

export const enderecos = pgTable("enderecos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pessoaId: varchar("pessoa_id").references(() => pessoas.id, { onDelete: "cascade" }).notNull(),
  // 'principal' | 'cobranca' | 'entrega' | 'outro'
  tipo: varchar("tipo", { length: 20 }).default("principal").notNull(),
  logradouro: varchar("logradouro", { length: 255 }),
  numero: varchar("numero", { length: 60 }),
  complemento: varchar("complemento", { length: 200 }),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }),
  codigoMunicipio: varchar("codigo_municipio", { length: 10 }),
  uf: varchar("uf", { length: 2 }),
  codigoUf: varchar("codigo_uf", { length: 5 }),
  cep: varchar("cep", { length: 10 }),
  pais: varchar("pais", { length: 50 }).default("Brasil"),
  codigoPais: varchar("codigo_pais", { length: 10 }),
  isPrincipal: integer("is_principal").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxEnderecoPessoa: index("idx_endereco_pessoa").on(t.pessoaId),
}));

export const contatos = pgTable("contatos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pessoaId: varchar("pessoa_id").references(() => pessoas.id, { onDelete: "cascade" }).notNull(),
  // 'telefone' | 'celular' | 'whatsapp' | 'email' | 'site'
  tipo: varchar("tipo", { length: 20 }).notNull(),
  valor: varchar("valor", { length: 255 }).notNull(),
  isPrincipal: integer("is_principal").default(0),
  isValidado: integer("is_validado").default(0),
  ultimoBounce: timestamp("ultimo_bounce"),
  bounceCount: integer("bounce_count").default(0),
  // P3: identificador de departamento e nota livre por contato
  label: varchar("label", { length: 60 }),
  observacao: text("observacao"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxContatoPessoa: index("idx_contato_pessoa").on(t.pessoaId),
  idxContatoTipoValor: index("idx_contato_tipo_valor").on(t.tipo, t.valor),
  // Garante "no máximo 1 principal por (pessoa, tipo)" no nível do banco
  uqContatoPrincipalTipo: uniqueIndex("uq_contato_principal_tipo")
    .on(t.pessoaId, t.tipo)
    .where(sql`is_principal = 1`),
}));

export const pessoaPapeis = pgTable("pessoa_papeis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pessoaId: varchar("pessoa_id").references(() => pessoas.id, { onDelete: "cascade" }).notNull(),
  tenantId: varchar("tenant_id").notNull(),
  // 'cliente' | 'fornecedor' | 'colaborador' | 'transportadora' | 'credor' | 'prospect' | 'parceiro'
  tipoPapel: varchar("tipo_papel", { length: 30 }).notNull(),
  // 'ativo' | 'inativo' | 'pendente'
  status: varchar("status", { length: 20 }).default("ativo").notNull(),
  dataInicio: date("data_inicio").defaultNow(),
  dataFim: date("data_fim"),
  // metadata flexível por tipo de papel — ex.:
  //   cliente:    { limiteCredito, tabelaPreco, vendedorPadrao, categoria, frequenciaCompraDias, valorMinimoPedido }
  //   fornecedor: { prazoMedioPagamento, tipoFornecimento, ratingQualidade, ratingPrazo, isCritico }
  //   colaborador:{ cargo, departamento, dataAdmissao, salario, tipoContratacao, gestorId, skills }
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  // Garante "no máximo 1 papel ativo por (pessoa, tipo)" — evita 2x cliente
  uqPessoaPapelAtivo: uniqueIndex("uq_pessoa_papel_ativo")
    .on(t.pessoaId, t.tipoPapel)
    .where(sql`status = 'ativo'`),
  idxPapelTenantTipo: index("idx_papel_tenant_tipo").on(t.tenantId, t.tipoPapel),
}));

// ----- Insert schemas (Zod) -----
export const insertPessoaSchema = createInsertSchema(pessoas).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  // cnpjCpf é nullable no DB — permitir vazio/nulo no insert
  cnpjCpf: z.string().optional().nullable(),
  // FISC-01: campos fiscais com validação
  rg:              z.string().max(20).optional().nullable(),
  ie:              z.string().max(30).optional().nullable(),
  contribuinte:    z.enum(["S", "N", "I"]).optional().default("N"),
  consumidorFinal: z.number().int().min(0).max(1).optional().default(1),
});
export const insertEnderecoSchema = createInsertSchema(enderecos).omit({
  id: true, createdAt: true,
});
export const insertContatoSchema = createInsertSchema(contatos).omit({
  id: true, createdAt: true, ultimoBounce: true, bounceCount: true,
});
export const insertPessoaPapelSchema = createInsertSchema(pessoaPapeis).omit({
  id: true, createdAt: true, updatedAt: true,
});

// ----- Types -----
export type Pessoa = typeof pessoas.$inferSelect;
export type InsertPessoa = z.infer<typeof insertPessoaSchema>;
export type Endereco = typeof enderecos.$inferSelect;
export type InsertEndereco = z.infer<typeof insertEnderecoSchema>;
export type Contato = typeof contatos.$inferSelect;
export type InsertContato = z.infer<typeof insertContatoSchema>;
export type PessoaPapel = typeof pessoaPapeis.$inferSelect;
export type InsertPessoaPapel = z.infer<typeof insertPessoaPapelSchema>;

// ----- Relations -----
export const pessoasRelations = relations(pessoas, ({ many }) => ({
  enderecos: many(enderecos),
  contatos: many(contatos),
  papeis: many(pessoaPapeis),
}));
export const enderecosRelations = relations(enderecos, ({ one }) => ({
  pessoa: one(pessoas, { fields: [enderecos.pessoaId], references: [pessoas.id] }),
}));
export const contatosRelations = relations(contatos, ({ one }) => ({
  pessoa: one(pessoas, { fields: [contatos.pessoaId], references: [pessoas.id] }),
}));
export const pessoaPapeisRelations = relations(pessoaPapeis, ({ one }) => ({
  pessoa: one(pessoas, { fields: [pessoaPapeis.pessoaId], references: [pessoas.id] }),
}));



// ============================================================
// ARCÁDIA RH/DP — Schema (auto-merged)
// ============================================================

export const hrDepartments = pgTable("hr_departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 100 }).notNull(),
  centroCustoId: varchar("centro_custo_id").references(() => centrosCusto.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxTenantCliente: index("idx_hr_departments_tenant_cliente").on(t.tenantId, t.clienteId),
}));

export const hrPositions = pgTable("hr_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 100 }).notNull(),
  cboCode: varchar("cbo_code", { length: 10 }),
  // junior | pleno | senior | specialist
  level: varchar("level", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxTenantCliente: index("idx_hr_positions_tenant_cliente").on(t.tenantId, t.clienteId),
}));

export const hrEmployees = pgTable("hr_employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  employeeCode: varchar("employee_code", { length: 20 }).notNull(),
  fullName: varchar("full_name", { length: 200 }).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull(),
  rg: varchar("rg", { length: 20 }),
  ctpsNumber: varchar("ctps_number", { length: 20 }),
  ctpsSeries: varchar("ctps_series", { length: 10 }),
  admissionDate: date("admission_date").notNull(),
  terminationDate: date("termination_date"),
  // active | vacation | leave | terminated
  status: varchar("status", { length: 20 }).notNull().default("active"),
  positionId: varchar("position_id").notNull().references(() => hrPositions.id),
  departmentId: varchar("department_id").references(() => hrDepartments.id, { onDelete: "set null" }),
  workLocation: varchar("work_location", { length: 100 }),
  // clt | pj | apprentice | intern
  employmentType: varchar("employment_type", { length: 20 }).notNull().default("clt"),
  baseSalary: numeric("base_salary", { precision: 12, scale: 2 }).notNull(),
  monthlyHours: integer("monthly_hours").notNull().default(220),
  workSchedule: jsonb("work_schedule"),
  cboCode: varchar("cbo_code", { length: 10 }),
  pisPasep: varchar("pis_pasep", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxTenantCliente: index("idx_hr_employees_tenant_cliente").on(t.tenantId, t.clienteId),
  idxStatus: index("idx_hr_employees_tenant_status").on(t.tenantId, t.status),
  uqEmpCodigo: uniqueIndex("uq_hr_employees_cliente_codigo").on(t.clienteId, t.employeeCode),
  uqCpfCliente: uniqueIndex("uq_hr_employees_cliente_cpf").on(t.clienteId, t.cpf),
}));

export const hrSalaryHistory = pgTable("hr_salary_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  employeeId: varchar("employee_id").notNull().references(() => hrEmployees.id, { onDelete: "cascade" }),
  effectiveDate: date("effective_date").notNull(),
  salary: numeric("salary", { precision: 12, scale: 2 }).notNull(),
  // admissao | reajuste | promocao | acordo | outro
  reason: varchar("reason", { length: 50 }).notNull().default("admissao"),
  notes: varchar("notes", { length: 300 }),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxEmployee: index("idx_hr_salary_employee").on(t.employeeId, t.effectiveDate),
}));

export const insertHrDepartmentSchema = createInsertSchema(hrDepartments).omit({ id: true, createdAt: true });
export const insertHrPositionSchema = createInsertSchema(hrPositions).omit({ id: true, createdAt: true });
export const insertHrEmployeeSchema = createInsertSchema(hrEmployees).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHrSalaryHistorySchema = createInsertSchema(hrSalaryHistory).omit({ id: true, createdAt: true });

export type HrDepartment = typeof hrDepartments.$inferSelect;
export type InsertHrDepartment = z.infer<typeof insertHrDepartmentSchema>;
export type HrPosition = typeof hrPositions.$inferSelect;
export type InsertHrPosition = z.infer<typeof insertHrPositionSchema>;
export type HrEmployee = typeof hrEmployees.$inferSelect;
export type InsertHrEmployee = z.infer<typeof insertHrEmployeeSchema>;
export type HrSalaryHistory = typeof hrSalaryHistory.$inferSelect;
export type InsertHrSalaryHistory = z.infer<typeof insertHrSalaryHistorySchema>;

// ─── Conta Corrente do Colaborador ──────────────────────────────────────────
// Lançamentos individuais de vales, salários, adiantamentos, repasses, bônus
// e ajustes. Saldo é calculado: SUM(credit) - SUM(debit).
//   credit = a pagar ao colaborador (salário, bônus, férias, 13º, repasse a fazer)
//   debit  = já pago / abate (vale, adiantamento, desconto, repasse efetuado)
export const hrEmployeeAccountEntries = pgTable("hr_employee_account_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  employeeId: varchar("employee_id").notNull().references(() => hrEmployees.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  // credit | debit
  direction: varchar("direction", { length: 10 }).notNull(),
  // salario | vale | adiantamento | repasse | bonus | comissao | ferias | decimo_terceiro | desconto | ajuste | outro
  category: varchar("category", { length: 30 }).notNull(),
  description: varchar("description", { length: 300 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  // pendente | pago | conciliado
  status: varchar("status", { length: 20 }).notNull().default("pendente"),
  paymentMethod: varchar("payment_method", { length: 30 }),
  referenceMonth: varchar("reference_month", { length: 7 }), // YYYY-MM
  payrollEntryId: varchar("payroll_entry_id").references(() => hrPayrollEntries.id, { onDelete: "set null" }),
  controlTxId: varchar("control_tx_id"),
  notes: varchar("notes", { length: 500 }),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxEmployee: index("idx_hr_emp_account_employee").on(t.employeeId, t.date),
  idxTenant: index("idx_hr_emp_account_tenant").on(t.tenantId),
}));

export const insertHrEmployeeAccountEntrySchema = createInsertSchema(hrEmployeeAccountEntries).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type HrEmployeeAccountEntry = typeof hrEmployeeAccountEntries.$inferSelect;
export type InsertHrEmployeeAccountEntry = z.infer<typeof insertHrEmployeeAccountEntrySchema>;

// ─── Sprint RH-2 ────────────────────────────────────────────────────────────
// Folha de pagamento + integração Control. clienteId = empresa cliente do BPO.
// Status: draft → reviewed → approved (gera lancamentos_financeiros) → exported.

export const hrPayrollPeriods = pgTable("hr_payroll_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  competence: varchar("competence", { length: 7 }).notNull(), // YYYY-MM
  // draft | reviewed | approved | exported
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  // manual | dominio_import
  source: varchar("source", { length: 20 }).notNull().default("manual"),
  totalGross: numeric("total_gross", { precision: 14, scale: 2 }).notNull().default("0"),
  totalDiscounts: numeric("total_discounts", { precision: 14, scale: 2 }).notNull().default("0"),
  totalNet: numeric("total_net", { precision: 14, scale: 2 }).notNull().default("0"),
  totalInssEmployee: numeric("total_inss_employee", { precision: 14, scale: 2 }).notNull().default("0"),
  totalFgts: numeric("total_fgts", { precision: 14, scale: 2 }).notNull().default("0"),
  totalIrrf: numeric("total_irrf", { precision: 14, scale: 2 }).notNull().default("0"),
  // Lista de IDs de lancamentos_financeiros gerados no approve (JSONB array de strings,
  // múltiplos quando há rateio por CC). Limpada no revert.
  controlTxIds: jsonb("control_tx_ids"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  // Sprint RH-4 — auditoria de exportações Domínio.
  exportedAt: timestamp("exported_at"),
  exportCount: integer("export_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxTenantCliente: index("idx_hr_payroll_periods_tenant_cliente").on(t.tenantId, t.clienteId),
  uqClienteCompet: uniqueIndex("uq_hr_payroll_periods_cliente_compet").on(t.clienteId, t.competence),
}));

export const hrPayrollEntries = pgTable("hr_payroll_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  periodId: varchar("period_id").notNull().references(() => hrPayrollPeriods.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => hrEmployees.id),
  // Snapshots resolvidos no momento do lançamento (não seguem mudanças futuras).
  departmentId: varchar("department_id"),
  costCenterId: varchar("cost_center_id"),
  salaryBase: numeric("salary_base", { precision: 12, scale: 2 }).notNull(),
  totalGross: numeric("total_gross", { precision: 12, scale: 2 }).notNull().default("0"),
  totalDiscounts: numeric("total_discounts", { precision: 12, scale: 2 }).notNull().default("0"),
  netSalary: numeric("net_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  inssBase: numeric("inss_base", { precision: 12, scale: 2 }).default("0"),
  inssValue: numeric("inss_value", { precision: 12, scale: 2 }).default("0"),
  fgtsBase: numeric("fgts_base", { precision: 12, scale: 2 }).default("0"),
  fgtsValue: numeric("fgts_value", { precision: 12, scale: 2 }).default("0"),
  irrfBase: numeric("irrf_base", { precision: 12, scale: 2 }).default("0"),
  irrfValue: numeric("irrf_value", { precision: 12, scale: 2 }).default("0"),
  // Trabalhando | Férias | Atestado | Afastamento | Outros
  situation: varchar("situation", { length: 50 }).default("Trabalhando"),
  // Array de rubricas: [{ code, description, type: 'provento'|'desconto', reference, value }]
  rubrics: jsonb("rubrics"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxPeriod: index("idx_hr_payroll_entries_period").on(t.periodId),
  idxEmployee: index("idx_hr_payroll_entries_employee").on(t.employeeId),
  uqPeriodEmployee: uniqueIndex("uq_hr_payroll_entries_period_employee").on(t.periodId, t.employeeId),
}));

export const hrTimesheetPeriods = pgTable("hr_timesheet_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => hrEmployees.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  // manual | dominio_import
  source: varchar("source", { length: 20 }).notNull().default("manual"),
  scheduledHours: numeric("scheduled_hours", { precision: 7, scale: 2 }).default("0"),
  workedHours: numeric("worked_hours", { precision: 7, scale: 2 }).default("0"),
  absenceHours: numeric("absence_hours", { precision: 7, scale: 2 }).default("0"),
  overtimeHours: numeric("overtime_hours", { precision: 7, scale: 2 }).default("0"),
  bankBalance: numeric("bank_balance", { precision: 7, scale: 2 }).default("0"),
  absentDays: integer("absent_days").default(0),
  // Array de registros diários:
  // { date, dayOfWeek, type: 'normal'|'holiday'|'absence'|'medical'|'vacation',
  //   in1, out1, in2, out2, worked, scheduled, balance, note }
  entries: jsonb("entries"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxTenantCliente: index("idx_hr_timesheet_tenant_cliente").on(t.tenantId, t.clienteId),
  idxEmployee: index("idx_hr_timesheet_employee").on(t.employeeId, t.periodStart),
}));

export const insertHrPayrollPeriodSchema = createInsertSchema(hrPayrollPeriods).omit({
  id: true, createdAt: true, updatedAt: true, approvedAt: true, approvedBy: true,
  controlTxIds: true, exportedAt: true, exportCount: true,
});
export const insertHrPayrollEntrySchema = createInsertSchema(hrPayrollEntries).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertHrTimesheetPeriodSchema = createInsertSchema(hrTimesheetPeriods).omit({
  id: true, createdAt: true,
});

export type HrPayrollPeriod = typeof hrPayrollPeriods.$inferSelect;
export type InsertHrPayrollPeriod = z.infer<typeof insertHrPayrollPeriodSchema>;
export type HrPayrollEntry = typeof hrPayrollEntries.$inferSelect;
export type InsertHrPayrollEntry = z.infer<typeof insertHrPayrollEntrySchema>;
export type HrTimesheetPeriod = typeof hrTimesheetPeriods.$inferSelect;
export type InsertHrTimesheetPeriod = z.infer<typeof insertHrTimesheetPeriodSchema>;

// ─── Sprint RH-3 ────────────────────────────────────────────────────────────
// Parser IA — importação automática do Extrato Mensal Domínio.
// hr_import_previews: cache temporário do preview (TTL 2h) entre o parse e

// ─── hr_import_previews + hr_rubric_mappings (Sprint RH-3) ──────────────────
export const hrImportPreviews = pgTable("hr_import_previews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clienteId: varchar("cliente_id").notNull(),
  tipo: varchar("tipo", { length: 30 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  rawText: text("raw_text"),
  parsedData: jsonb("parsed_data"),
  validationErrors: jsonb("validation_errors"),
  createdBy: varchar("created_by").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxTenantCliente: index("idx_hr_import_previews_tenant").on(t.tenantId, t.clienteId),
}));

export const hrRubricMappings = pgTable("hr_rubric_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  dominioCode: varchar("dominio_code", { length: 10 }).notNull(),
  dominioDesc: varchar("dominio_desc", { length: 300 }),
  arcadiaRubrica: varchar("arcadia_rubrica", { length: 100 }).notNull(),
  tipo: varchar("tipo", { length: 10 }).notNull().default("desconto"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxTenant: index("idx_hr_rubric_tenant").on(t.tenantId),
  uniqCode: uniqueIndex("uq_hr_rubric_tenant_code").on(t.tenantId, t.dominioCode),
}));

export const insertHrImportPreviewSchema = createInsertSchema(hrImportPreviews).omit({ id: true, createdAt: true, expiresAt: true });
export const insertHrRubricMappingSchema = createInsertSchema(hrRubricMappings).omit({ id: true, createdAt: true });
export type HrImportPreview = typeof hrImportPreviews.$inferSelect;
export type InsertHrImportPreview = z.infer<typeof insertHrImportPreviewSchema>;
export type HrRubricMapping = typeof hrRubricMappings.$inferSelect;
export type InsertHrRubricMapping = z.infer<typeof insertHrRubricMappingSchema>;

// ─── Tabela clients (empresas gerenciadas pelo Control) ──────────────────────
// Cada "client" é uma empresa cujas finanças/RH são gerenciadas pelo tenant.
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  company: varchar("company", { length: 300 }),
  cnpj: varchar("cnpj", { length: 18 }),
  email: varchar("email", { length: 300 }),
  phone: varchar("phone", { length: 30 }),
  status: varchar("status", { length: 20 }).notNull().default("ativo"),
  regime: varchar("regime", { length: 30 }),
  responsavel: varchar("responsavel", { length: 200 }),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxTenant: index("idx_clients_tenant").on(t.tenantId),
  idxTenantStatus: index("idx_clients_tenant_status").on(t.tenantId, t.status),
  uniqCnpj: uniqueIndex("uniq_clients_tenant_cnpj").on(t.tenantId, t.cnpj),
}));

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

// ─── Sociedades (dados empresariais para exportação Domínio) ─────────────────
export const sociedades = pgTable("sociedades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  razaoSocial: varchar("razao_social", { length: 300 }).notNull(),
  nomeFantasia: varchar("nome_fantasia", { length: 300 }),
  cnpj: varchar("cnpj", { length: 18 }),
  inscricaoEstadual: varchar("inscricao_estadual", { length: 30 }),
  inscricaoMunicipal: varchar("inscricao_municipal", { length: 30 }),
  cep: varchar("cep", { length: 10 }),
  logradouro: varchar("logradouro", { length: 300 }),
  numero: varchar("numero", { length: 20 }),
  complemento: varchar("complemento", { length: 100 }),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }),
  estado: varchar("estado", { length: 2 }),
  email: varchar("email", { length: 300 }),
  telefone: varchar("telefone", { length: 30 }),
  regimeTributario: varchar("regime_tributario", { length: 30 }),
  codigoDominio: varchar("codigo_dominio", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxTenant: index("idx_sociedades_tenant").on(t.tenantId),
  uniqClientId: uniqueIndex("uq_sociedades_client_id").on(t.tenantId, t.clientId),
}));

export const insertSociedadeSchema = createInsertSchema(sociedades).omit({ id: true, createdAt: true, updatedAt: true });
export type Sociedade = typeof sociedades.$inferSelect;
export type InsertSociedade = z.infer<typeof insertSociedadeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT ENGINE — Tabelas
// ─────────────────────────────────────────────────────────────────────────────
export const pePersonas = pgTable("pe_personas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  role: varchar("role", { length: 100 }),
  systemPrompt: text("system_prompt"),
  tone: varchar("tone", { length: 50 }),
  domain: varchar("domain", { length: 100 }),
  avatar: varchar("avatar", { length: 10 }).default("🤖"),
  color: varchar("color", { length: 20 }).default("#6366f1"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({ idxTenant: index("idx_pe_personas_tenant").on(t.tenantId) }));

export const pePrompts = pgTable("pe_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 30 }).default("draft"),
  personaId: varchar("persona_id"),
  objetivo: text("objetivo"),
  roteiro: jsonb("roteiro"),
  modeloSaida: jsonb("modelo_saida"),
  publico: text("publico"),
  tom: varchar("tom", { length: 50 }),
  contexto: text("contexto"),
  restricoes: text("restricoes"),
  exemplos: jsonb("exemplos"),
  gates: jsonb("gates").default({}),
  gateScore: integer("gate_score").default(0),
  editorContent: jsonb("editor_content"),
  compiledPrompt: text("compiled_prompt"),
  variables: jsonb("variables"),
  publishAs: varchar("publish_as", { length: 30 }),
  tags: text("tags").array(),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxTenant: index("idx_pe_prompts_tenant").on(t.tenantId),
  idxUser: index("idx_pe_prompts_user").on(t.userId),
}));

export const peTemplates = pgTable("pe_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  icon: varchar("icon", { length: 10 }).default("📄"),
  promptData: jsonb("prompt_data").notNull(),
  isSystem: boolean("is_system").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const peExecutions = pgTable("pe_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promptId: varchar("prompt_id").notNull(),
  userId: varchar("user_id").notNull(),
  inputVariables: jsonb("input_variables"),
  compiledPrompt: text("compiled_prompt"),
  output: text("output"),
  model: varchar("model", { length: 100 }),
  tokensUsed: integer("tokens_used"),
  durationMs: integer("duration_ms"),
  status: varchar("status", { length: 30 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPePersonaSchema = createInsertSchema(pePersonas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPePromptSchema = createInsertSchema(pePrompts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPeTemplateSchema = createInsertSchema(peTemplates).omit({ id: true, createdAt: true });
export const insertPeExecutionSchema = createInsertSchema(peExecutions).omit({ id: true, createdAt: true });

export type PePersona = typeof pePersonas.$inferSelect;
export type InsertPePersona = z.infer<typeof insertPePersonaSchema>;
export type PePrompt = typeof pePrompts.$inferSelect;
export type InsertPePrompt = z.infer<typeof insertPePromptSchema>;
export type PeTemplate = typeof peTemplates.$inferSelect;
export type PeExecution = typeof peExecutions.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT ENGINE — Agentes Especializados (extensão de pe_personas)
// Campos adicionais via migração SQL; aqui declaramos tabela auxiliar de
// conversas de agentes para manter histórico por sessão.
// ─────────────────────────────────────────────────────────────────────────────
export const peAgentChats = pgTable("pe_agent_chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personaSlug: varchar("persona_slug", { length: 100 }).notNull(),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  messages: jsonb("messages").default([]),
  title: varchar("title", { length: 300 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({ idxSlug: index("idx_pe_agent_chats_slug").on(t.personaSlug, t.tenantId) }));

export const insertPeAgentChatSchema = createInsertSchema(peAgentChats).omit({ id: true, createdAt: true, updatedAt: true });
export type PeAgentChat = typeof peAgentChats.$inferSelect;

// =====================================================================
//  Sprint C-E02 — Engineering Projects (tabela nativa Arcádia)
//  Regra: projetos NASCEM no CommercialEnv; nunca pelo Control.
//  engineering_projects é FK usada pelo Control em lancamentos_financeiros.
// =====================================================================
export const engineeringProjects = pgTable("engineering_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  // Número sequencial: ENG-YYYY-NNN
  numero: varchar("numero", { length: 30 }).notNull(),
  titulo: varchar("titulo", { length: 300 }).notNull(),
  // FK lógica para pessoas.id (cliente interno / parceiro)
  clienteId: varchar("cliente_id"),
  clienteNome: varchar("cliente_nome", { length: 300 }),
  // Vibra = cliente externo — nunca no rateio
  clienteExternoNome: varchar("cliente_externo_nome", { length: 300 }),
  descricao: text("descricao"),
  // venda | pre_projeto | backlog_tecnico | planejamento | em_execucao | concluido | cancelado
  etapa: varchar("etapa", { length: 40 }).notNull().default("venda"),
  // ativo | pausado | cancelado | concluido
  status: varchar("status", { length: 20 }).notNull().default("ativo"),
  valorContrato: numeric("valor_contrato", { precision: 15, scale: 2 }),
  percentualEntregue: integer("percentual_entregue").default(0),
  dataInicio: date("data_inicio"),
  dataFim: date("data_fim"),
  osNumero: varchar("os_numero", { length: 50 }),
  // FK opcional para proposta CRM de origem
  proposalId: integer("proposal_id"),
  responsavelId: varchar("responsavel_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_eng_proj_tenant").on(t.tenantId),
  index("idx_eng_proj_etapa").on(t.tenantId, t.etapa),
  index("idx_eng_proj_cliente").on(t.tenantId, t.clienteId),
  uniqueIndex("uniq_eng_proj_numero").on(t.tenantId, t.numero),
]);

export const engineeringProjectHistory = pgTable("engineering_project_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  projetoId: varchar("projeto_id").notNull(),
  etapaAnterior: varchar("etapa_anterior", { length: 40 }),
  etapaAtual: varchar("etapa_atual", { length: 40 }).notNull(),
  observacoes: text("observacoes"),
  alteradoPor: varchar("alterado_por"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_eng_hist_projeto").on(t.projetoId),
]);

export const insertEngineeringProjectSchema = createInsertSchema(engineeringProjects).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertEngineeringProjectHistorySchema = createInsertSchema(engineeringProjectHistory).omit({
  id: true, createdAt: true,
});

export type EngineeringProject = typeof engineeringProjects.$inferSelect;
export type InsertEngineeringProject = z.infer<typeof insertEngineeringProjectSchema>;
export type EngineeringProjectHistory = typeof engineeringProjectHistory.$inferSelect;
