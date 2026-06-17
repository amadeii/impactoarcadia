/**
 * Arcádia Project Hub — Schema HUB-05
 * Tabela: project_timesheets
 */

import {
  pgTable, varchar, text, numeric, boolean,
  timestamp, date, index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { projects } from "./hub";
import { projectWbsNodes, projectTasks } from "./hub02";

export const projectTimesheets = pgTable("project_timesheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),
  wbsNodeId: varchar("wbs_node_id").references(() => projectWbsNodes.id, { onDelete: "set null" }),
  taskId: varchar("task_id").references(() => projectTasks.id, { onDelete: "set null" }),

  // Colaborador
  userId: varchar("user_id").notNull(),
  userName: varchar("user_name", { length: 200 }),

  // Apontamento
  date: date("date").notNull(),
  hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),
  billable: boolean("billable").default(true),
  activityType: varchar("activity_type", { length: 30 }).default("escritorio"),
  // Timer (TIMER-01) — from_time / to_time estilo ERPNext
  startedAt: timestamp("started_at"),
  endedAt:   timestamp("ended_at"),
  // hours calculado automaticamente de endedAt - startedAt quando ambos preenchidos
  // campo | laboratorio | escritorio | deslocamento | reuniao | treinamento

  // Rates (resolução: project_members → users.hourlyRate → fallback 0)
  costRate: numeric("cost_rate", { precision: 10, scale: 2 }).default("0"),
  billingRate: numeric("billing_rate", { precision: 10, scale: 2 }).default("0"),

  // Valores calculados
  costAmount: numeric("cost_amount", { precision: 12, scale: 2 }).default("0"),    // hours × cost_rate
  billingAmount: numeric("billing_amount", { precision: 12, scale: 2 }).default("0"), // hours × billing_rate

  description: text("description"),

  // Aprovação
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),

  // Bridge Control — cost_event gerado ao aprovar
  costEventId: varchar("cost_event_id"),

  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_ts_project").on(t.projectId),
  index("idx_ts_user").on(t.tenantId, t.userId),
  index("idx_ts_date").on(t.projectId, t.date),
  index("idx_ts_wbs").on(t.wbsNodeId),
  index("idx_ts_task").on(t.taskId),
  index("idx_ts_approved").on(t.projectId, t.approvedAt),
]);

export const insertTimesheetSchema = createInsertSchema(projectTimesheets).omit({
  id: true, createdAt: true, updatedAt: true,
  approvedBy: true, approvedAt: true, costEventId: true,
  costAmount: true, billingAmount: true,
});

export type Timesheet = typeof projectTimesheets.$inferSelect;
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
