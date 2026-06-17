/**
 * Arcádia Project Hub — Schema HUB-06
 * Tabelas: project_allocation_rules, project_kpi_snapshots
 */
import {
  pgTable, varchar, text, numeric, boolean,
  timestamp, date, integer, index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { projects } from "./hub";

// ─────────────────────────────────────────────────────────────────────────────
// ALLOCATION RULES — rateio de custos indiretos por projeto
// ─────────────────────────────────────────────────────────────────────────────
export const projectAllocationRules = pgTable("project_allocation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),

  ruleType: varchar("rule_type", { length: 20 }).notNull(),
  // percentual | horas | receita | custo_direto | equipamento | formula

  description: varchar("description", { length: 200 }),
  driver: text("driver"),         // descrição do driver
  formula: text("formula"),       // para ruleType = formula
  percentage: numeric("percentage", { precision: 7, scale: 4 }),  // para ruleType = percentual

  costCategory: varchar("cost_category", { length: 30 }), // categoria que recebe o overhead
  planoContaId: varchar("plano_conta_id"),

  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  approvalStatus: varchar("approval_status", { length: 20 }).default("rascunho"),
  // rascunho | aprovado

  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  lastRunAt: timestamp("last_run_at"),
  lastRunAmount: numeric("last_run_amount", { precision: 15, scale: 2 }),

  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_alloc_project").on(t.projectId),
  index("idx_alloc_tenant").on(t.tenantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// KPI SNAPSHOTS — snapshots diários calculados
// ─────────────────────────────────────────────────────────────────────────────
export const projectKpiSnapshots = pgTable("project_kpi_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),
  snapshotDate: date("snapshot_date").notNull(),

  // Receita
  contractValue:     numeric("contract_value",     { precision: 15, scale: 2 }).default("0"),
  revenueBilled:     numeric("revenue_billed",     { precision: 15, scale: 2 }).default("0"),
  revenueRecognized: numeric("revenue_recognized", { precision: 15, scale: 2 }).default("0"),

  // Custo
  costPlanned:    numeric("cost_planned",    { precision: 15, scale: 2 }).default("0"),
  costActual:     numeric("cost_actual",     { precision: 15, scale: 2 }).default("0"),
  costLabor:      numeric("cost_labor",      { precision: 15, scale: 2 }).default("0"),
  costMaterial:   numeric("cost_material",   { precision: 15, scale: 2 }).default("0"),
  costThirdParty: numeric("cost_third_party",{ precision: 15, scale: 2 }).default("0"),
  costOverhead:   numeric("cost_overhead",   { precision: 15, scale: 2 }).default("0"),

  // Margem
  grossMargin: numeric("gross_margin", { precision: 15, scale: 2 }).default("0"),
  marginPct:   numeric("margin_pct",   { precision: 7, scale: 4 }).default("0"),

  // Progresso
  progressPct: integer("progress_pct").default(0),

  // EVM
  plannedValue: numeric("planned_value", { precision: 15, scale: 2 }).default("0"),
  earnedValue:  numeric("earned_value",  { precision: 15, scale: 2 }).default("0"),
  cpi: numeric("cpi", { precision: 8, scale: 4 }),
  spi: numeric("spi", { precision: 8, scale: 4 }),
  eac: numeric("eac", { precision: 15, scale: 2 }),
  variance: numeric("variance", { precision: 15, scale: 2 }).default("0"),

  // Horas
  totalHours:    numeric("total_hours",    { precision: 10, scale: 2 }).default("0"),
  billableHours: numeric("billable_hours", { precision: 10, scale: 2 }).default("0"),

  // Saúde
  healthScore: varchar("health_score", { length: 10 }).default("verde"),

  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_kpi_project_date").on(t.projectId, t.snapshotDate),
  index("idx_kpi_tenant").on(t.tenantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Zod + Types
// ─────────────────────────────────────────────────────────────────────────────
export const insertAllocationRuleSchema = createInsertSchema(projectAllocationRules).omit({
  id: true, createdAt: true, lastRunAt: true, lastRunAmount: true,
  approvedBy: true, approvedAt: true,
});

export type AllocationRule = typeof projectAllocationRules.$inferSelect;
export type KpiSnapshot    = typeof projectKpiSnapshots.$inferSelect;
