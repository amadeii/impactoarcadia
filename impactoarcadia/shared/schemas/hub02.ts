/**
 * Arcádia Project Hub — Schema HUB-02
 * Tabelas: project_wbs_nodes, project_tasks, project_task_comments
 */

import {
  pgTable, varchar, text, integer, numeric, boolean,
  timestamp, date, jsonb, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { projects } from "./hub";

// ─────────────────────────────────────────────────────────────────────────────
// WBS NODES — estrutura analítica do projeto
// ─────────────────────────────────────────────────────────────────────────────
export const projectWbsNodes = pgTable("project_wbs_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),
  parentId: varchar("parent_id"),   // self-ref — null = raiz
  // Identificação
  nodeType: varchar("node_type", { length: 20 }).notNull().default("tarefa"),
  // fase | pacote | entregavel | tarefa | marco
  title: varchar("title", { length: 300 }).notNull(),
  code: varchar("code", { length: 20 }),   // ex: 1.2.3
  // Progresso
  weight: numeric("weight", { precision: 5, scale: 2 }).default("1"),
  progressMethod: varchar("progress_method", { length: 20 }).default("manual"),
  // manual | tarefas | percentual | peso
  progressPct: integer("progress_pct").default(0),
  // Datas
  plannedStart: date("planned_start"),
  plannedEnd: date("planned_end"),
  actualStart: date("actual_start"),
  actualEnd: date("actual_end"),
  // Financeiro
  budgetAmount: numeric("budget_amount", { precision: 15, scale: 2 }),
  // Responsável
  assigneeId: varchar("assignee_id"),
  assigneeName: varchar("assignee_name", { length: 200 }),
  // Status
  status: varchar("status", { length: 20 }).default("pendente"),
  // pendente | em_andamento | concluido | bloqueado | cancelado
  orderIndex: integer("order_index").default(0),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_wbs_project").on(t.projectId),
  index("idx_wbs_parent").on(t.parentId),
  index("idx_wbs_tenant").on(t.tenantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// TASKS — execução granular
// ─────────────────────────────────────────────────────────────────────────────
export const projectTasks = pgTable("project_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  wbsNodeId: varchar("wbs_node_id").references(() => projectWbsNodes.id, { onDelete: "set null" }),
  tenantId: varchar("tenant_id").notNull(),
  // Conteúdo
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  // Kanban
  status: varchar("status", { length: 20 }).notNull().default("backlog"),
  // backlog | todo | doing | review | done | blocked
  priority: varchar("priority", { length: 10 }).default("media"),
  // baixa | media | alta | critica
  // Responsável
  assigneeId: varchar("assignee_id"),
  assigneeName: varchar("assignee_name", { length: 200 }),
  // Horas
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }),
  actualHours: numeric("actual_hours", { precision: 8, scale: 2 }).default("0"),
  // Financeiro
  billable: boolean("billable").default(true),
  costRate: numeric("cost_rate", { precision: 10, scale: 2 }),
  billingRate: numeric("billing_rate", { precision: 10, scale: 2 }),
  // Datas
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  // Extras
  tags: jsonb("tags").default([]),        // string[]
  checklist: jsonb("checklist").default([]), // {id, text, done}[]
  orderIndex: integer("order_index").default(0),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_tasks_project").on(t.projectId),
  index("idx_tasks_wbs").on(t.wbsNodeId),
  index("idx_tasks_status").on(t.projectId, t.status),
  index("idx_tasks_assignee").on(t.projectId, t.assigneeId),
  index("idx_tasks_tenant").on(t.tenantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// TASK COMMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const projectTaskComments = pgTable("project_task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => projectTasks.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),
  authorId: varchar("author_id").notNull(),
  authorName: varchar("author_name", { length: 200 }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_task_comments_task").on(t.taskId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────
export const insertWbsNodeSchema = createInsertSchema(projectWbsNodes).omit({
  id: true, createdAt: true, updatedAt: true, progressPct: true,
});

export const insertTaskSchema = createInsertSchema(projectTasks).omit({
  id: true, createdAt: true, updatedAt: true, actualHours: true, completedAt: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type WbsNode = typeof projectWbsNodes.$inferSelect;
export type InsertWbsNode = z.infer<typeof insertWbsNodeSchema>;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
