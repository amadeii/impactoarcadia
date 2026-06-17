/**
 * Arcádia Project Hub — Schema HUB-07
 * Tabelas: project_field_records, project_form_templates
 */
import {
  pgTable, varchar, text, numeric, integer, boolean,
  timestamp, date, jsonb, index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { projects } from "./hub";
import { projectWbsNodes, projectTasks } from "./hub02";

// ─────────────────────────────────────────────────────────────────────────────
// FORM TEMPLATES — schemas de formulário por tipo (JSONB)
// ─────────────────────────────────────────────────────────────────────────────
export const projectFormTemplates = pgTable("project_form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  projectType: varchar("project_type", { length: 30 }),   // null = global
  formType: varchar("form_type", { length: 40 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 30 }).default("FileText"),
  fields: jsonb("fields").notNull().default([]),
  // [{id, label, type, required, options?, unit?, placeholder?}]
  // type: text | number | select | multiselect | date | coords | photo | textarea | boolean
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_form_tmpl_tenant").on(t.tenantId),
  index("idx_form_tmpl_type").on(t.projectType),
]);

// ─────────────────────────────────────────────────────────────────────────────
// FIELD RECORDS — registros de campo digitalizados
// ─────────────────────────────────────────────────────────────────────────────
export const projectFieldRecords = pgTable("project_field_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),
  wbsNodeId: varchar("wbs_node_id").references(() => projectWbsNodes.id, { onDelete: "set null" }),
  taskId: varchar("task_id").references(() => projectTasks.id, { onDelete: "set null" }),

  formType: varchar("form_type", { length: 40 }).notNull(),
  // sondagem_spt | coleta_agua | ficha_campo | diario_obra | laudo_analise | vistoria

  // Coleta
  collectedBy: varchar("collected_by"),
  collectedByName: varchar("collected_by_name", { length: 200 }),
  collectedAt: timestamp("collected_at"),

  // GPS
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  locationName: varchar("location_name", { length: 200 }),

  // Dados do formulário (JSONB flexível)
  fieldData: jsonb("field_data").notNull().default({}),

  // Arquivos: paths ou base64 pequeno (fotos comprimidas)
  attachments: jsonb("attachments").default([]),
  // [{id, name, type, url?, base64?, size, createdAt}]

  // Workflow de aprovação
  status: varchar("status", { length: 20 }).notNull().default("rascunho"),
  // rascunho | submetido | revisado | aprovado | rejeitado

  reviewedBy: varchar("reviewed_by"),
  reviewedByName: varchar("reviewed_by_name", { length: 200 }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),

  // Identificação do ponto
  pointId: varchar("point_id", { length: 50 }),  // PM-01, SP-03, etc.
  sequenceNumber: integer("sequence_number"),

  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_field_project").on(t.projectId),
  index("idx_field_form_type").on(t.projectId, t.formType),
  index("idx_field_status").on(t.projectId, t.status),
  index("idx_field_collected").on(t.projectId, t.collectedAt),
  index("idx_field_tenant").on(t.tenantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Zod + Types
// ─────────────────────────────────────────────────────────────────────────────
export const insertFieldRecordSchema = createInsertSchema(projectFieldRecords).omit({
  id: true, createdAt: true, updatedAt: true,
  reviewedBy: true, reviewedByName: true, reviewedAt: true,
});

export type FieldRecord      = typeof projectFieldRecords.$inferSelect;
export type FormTemplate     = typeof projectFormTemplates.$inferSelect;
export type InsertFieldRecord = z.infer<typeof insertFieldRecordSchema>;
