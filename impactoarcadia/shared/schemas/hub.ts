/**
 * Arcádia Project Hub — Schema Drizzle
 * Sprint HUB-01: Entidade canônica de projetos + membros
 *
 * Substitui engineering_projects e process compass projects.
 * IDs são varchar UUID (padrão do codebase).
 */

import {
  pgTable, varchar, text, integer, numeric, boolean,
  timestamp, date, jsonb, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS — entidade canônica
// ─────────────────────────────────────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),

  // Identificação
  projectCode: varchar("project_code", { length: 30 }).notNull(), // IMP-2026-001
  title: varchar("title", { length: 300 }).notNull(),
  projectType: varchar("project_type", { length: 30 }).notNull().default("consultoria"),
  // geologia | ambiental | civil | consultoria | industrial

  // Status / Ciclo de vida
  status: varchar("status", { length: 20 }).notNull().default("ativo"),
  // rascunho | ativo | pausado | concluido | cancelado
  etapa: varchar("etapa", { length: 40 }).notNull().default("planejamento"),
  // planejamento | em_execucao | monitoramento | encerramento | concluido

  // Vínculos
  clienteId: varchar("cliente_id"),           // FK → pessoas.id
  clienteNome: varchar("cliente_nome", { length: 300 }),
  clienteExternoNome: varchar("cliente_externo_nome", { length: 300 }),
  ownerId: varchar("owner_id"),              // PM responsável → usuarios
  proposalId: integer("proposal_id"),         // FK → proposta CRM de origem
  costCenterId: varchar("cost_center_id"),    // FK → centros_custo

  // Fiscal
  municipioIbge: varchar("municipio_ibge", { length: 7 }),   // para NFS-e
  taxProfileId: integer("tax_profile_id"),

  // Financeiro
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }),
  recognitionMethod: varchar("recognition_method", { length: 20 }).default("percentual"),
  // percentual | marco | horas | conclusao

  // Datas
  plannedStart: date("planned_start"),
  plannedEnd: date("planned_end"),
  actualStart: date("actual_start"),
  actualEnd: date("actual_end"),

  // Progresso
  progressPct: integer("progress_pct").default(0), // 0-100
  healthScore: varchar("health_score", { length: 10 }).default("verde"),
  // verde | amarelo | vermelho
  priority: varchar("priority", { length: 10 }).default("media"),
  // baixa | media | alta | critica
  // verde | amarelo | vermelho

  // Conteúdo livre
  description: text("description"),
  location: text("location"),
  metadata: jsonb("metadata").default({}),   // campos por project_type

  // Auditoria
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_projects_tenant").on(t.tenantId),
  index("idx_projects_status").on(t.tenantId, t.status),
  index("idx_projects_type").on(t.tenantId, t.projectType),
  index("idx_projects_cliente").on(t.tenantId, t.clienteId),
  uniqueIndex("uniq_projects_code").on(t.tenantId, t.projectCode),
]);

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT MEMBERS
// ─────────────────────────────────────────────────────────────────────────────
export const projectMembers = pgTable("project_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: varchar("user_name", { length: 200 }),
  role: varchar("role", { length: 30 }).notNull().default("tecnico"),
  // pm | tecnico | financeiro | cliente | observador
  billingRate: numeric("billing_rate", { precision: 10, scale: 2 }),   // R$/h faturável
  costRate: numeric("cost_rate", { precision: 10, scale: 2 }),          // R$/h custo
  active: boolean("active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (t) => [
  index("idx_proj_members_project").on(t.projectId),
  index("idx_proj_members_user").on(t.tenantId, t.userId),
  uniqueIndex("uniq_proj_member").on(t.projectId, t.userId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true, createdAt: true, updatedAt: true, progressPct: true, healthScore: true,
});

export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({
  id: true, joinedAt: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
