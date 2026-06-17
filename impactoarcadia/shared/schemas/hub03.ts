/**
 * Arcádia Project Hub — Schema HUB-03
 * Tabelas: project_budget_versions, project_budget_lines, project_cost_events
 */

import {
  pgTable, varchar, text, integer, numeric, boolean,
  timestamp, date, jsonb, index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { projects } from "./hub";
import { projectWbsNodes } from "./hub02";

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET VERSIONS — orçamentos versionados (baseline, revisões)
// ─────────────────────────────────────────────────────────────────────────────
export const projectBudgetVersions = pgTable("project_budget_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),
  version: integer("version").notNull().default(1),   // 1 = baseline
  label: varchar("label", { length: 100 }),            // "Baseline aprovado", "Rev.1 pós-aditivo"
  status: varchar("status", { length: 20 }).default("rascunho"),
  // rascunho | aprovado | substituido
  totalBudget: numeric("total_budget", { precision: 15, scale: 2 }).default("0"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_budgetv_project").on(t.projectId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET LINES — linhas por categoria × WBS
// ─────────────────────────────────────────────────────────────────────────────
export const projectBudgetLines = pgTable("project_budget_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  budgetVersionId: varchar("budget_version_id").notNull()
    .references(() => projectBudgetVersions.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull(),
  tenantId: varchar("tenant_id").notNull(),
  wbsNodeId: varchar("wbs_node_id")
    .references(() => projectWbsNodes.id, { onDelete: "set null" }),
  // Classificação
  costCategory: varchar("cost_category", { length: 30 }).notNull(),
  // mao_obra | material | terceiros | equipamento | despesa | overhead
  description: varchar("description", { length: 300 }),
  planoContaId: varchar("plano_conta_id"),   // FK → planosContas
  // Valores
  quantity: numeric("quantity", { precision: 10, scale: 3 }).default("1"),
  unit: varchar("unit", { length: 20 }).default("un"),  // h, un, kg, km, dia
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).default("0"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  // amount = quantity × unit_cost (calculado no insert/update)
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_budgetl_version").on(t.budgetVersionId),
  index("idx_budgetl_project").on(t.projectId),
  index("idx_budgetl_category").on(t.projectId, t.costCategory),
]);

// ─────────────────────────────────────────────────────────────────────────────
// COST EVENTS — barramento transacional operação → Control
// ─────────────────────────────────────────────────────────────────────────────
export const projectCostEvents = pgTable("project_cost_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),
  wbsNodeId: varchar("wbs_node_id")
    .references(() => projectWbsNodes.id, { onDelete: "set null" }),
  // Origem
  sourceType: varchar("source_type", { length: 20 }).notNull(),
  // timesheet | expense | purchase | equipment | material | lancamento_direto
  sourceId: varchar("source_id"),   // ID da entidade de origem
  // Classificação
  costCategory: varchar("cost_category", { length: 30 }).notNull(),
  // mao_obra | material | terceiros | equipamento | despesa | overhead
  description: varchar("description", { length: 300 }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  eventDate: date("event_date").notNull(),
  // Bridge com Control
  controlLancamentoId: varchar("control_lancamento_id"),  // ID em lancamentos_financeiros
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_costevt_project").on(t.projectId),
  index("idx_costevt_wbs").on(t.wbsNodeId),
  index("idx_costevt_category").on(t.projectId, t.costCategory),
  index("idx_costevt_source").on(t.sourceType, t.sourceId),
  index("idx_costevt_lancamento").on(t.controlLancamentoId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────
export const insertBudgetVersionSchema = createInsertSchema(projectBudgetVersions).omit({
  id: true, createdAt: true, totalBudget: true,
});
export const insertBudgetLineSchema = createInsertSchema(projectBudgetLines).omit({
  id: true, createdAt: true,
});
export const insertCostEventSchema = createInsertSchema(projectCostEvents).omit({
  id: true, createdAt: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type BudgetVersion = typeof projectBudgetVersions.$inferSelect;
export type BudgetLine    = typeof projectBudgetLines.$inferSelect;
export type CostEvent     = typeof projectCostEvents.$inferSelect;
