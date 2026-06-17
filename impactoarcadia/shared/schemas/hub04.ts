/**
 * Arcádia Project Hub — Schema HUB-04
 * Tabelas: project_contracts, project_billing_milestones, project_fiscal_events
 */

import {
  pgTable, varchar, text, integer, numeric, boolean,
  timestamp, date, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { projects } from "./hub";
import { projectWbsNodes } from "./hub02";

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────
export const projectContracts = pgTable("project_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),

  contractNumber: varchar("contract_number", { length: 60 }),
  contractType: varchar("contract_type", { length: 20 }).notNull().default("fixed_price"),
  // fixed_price | time_material | unit_price | cost_plus

  totalValue: numeric("total_value", { precision: 15, scale: 2 }).notNull(),
  paymentTerms: text("payment_terms"),
  retentionPercent: numeric("retention_percent", { precision: 5, scale: 2 }).default("0"),
  advancePayment: numeric("advance_payment", { precision: 15, scale: 2 }).default("0"),
  recognitionMethod: varchar("recognition_method", { length: 20 }).default("percentual"),
  // percentual | marco | horas | conclusao

  status: varchar("status", { length: 20 }).default("ativo"),
  // rascunho | ativo | aditado | encerrado | cancelado

  signedAt: date("signed_at"),
  documentPath: text("document_path"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_contracts_project").on(t.projectId),
  index("idx_contracts_tenant").on(t.tenantId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// BILLING MILESTONES — gatilhos de faturamento
// ─────────────────────────────────────────────────────────────────────────────
export const projectBillingMilestones = pgTable("project_billing_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull()
    .references(() => projectContracts.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),
  wbsNodeId: varchar("wbs_node_id")
    .references(() => projectWbsNodes.id, { onDelete: "set null" }),

  title: varchar("title", { length: 300 }).notNull(),
  triggerType: varchar("trigger_type", { length: 20 }).default("manual"),
  // percentual | entregavel | data | manual
  triggerValue: numeric("trigger_value", { precision: 10, scale: 2 }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),

  acceptanceRequired: boolean("acceptance_required").default(true),
  acceptedAt: timestamp("accepted_at"),
  acceptedBy: varchar("accepted_by"),
  acceptanceNotes: text("acceptance_notes"),

  status: varchar("status", { length: 20 }).notNull().default("pendente"),
  // pendente | atingido | faturado | recebido | bloqueado | cancelado

  // Bridge Control
  arLancamentoId: varchar("ar_lancamento_id"),   // ID em lancamentos_financeiros
  // Bridge Fiscal
  fiscalEventId: varchar("fiscal_event_id"),

  dueDate: date("due_date"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_milestones_contract").on(t.contractId),
  index("idx_milestones_project").on(t.projectId),
  index("idx_milestones_status").on(t.projectId, t.status),
]);

// ─────────────────────────────────────────────────────────────────────────────
// FISCAL EVENTS — integração com Arcádia Fiscal / NFS-e
// ─────────────────────────────────────────────────────────────────────────────
export const projectFiscalEvents = pgTable("project_fiscal_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull(),
  milestoneId: varchar("milestone_id"),

  eventType: varchar("event_type", { length: 20 }).default("nfse"),
  // nfse | retencao | ajuste | cancelamento

  municipioIbge: varchar("municipio_ibge", { length: 7 }),
  serviceCode: varchar("service_code", { length: 10 }),   // código LC 116
  taxProfileId: integer("tax_profile_id"),

  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  retentionIss: numeric("retention_iss", { precision: 12, scale: 2 }).default("0"),
  retentionIr: numeric("retention_ir", { precision: 12, scale: 2 }).default("0"),
  retentionPcc: numeric("retention_pcc", { precision: 12, scale: 2 }).default("0"),

  competencia: date("competencia"),
  eventStatus: varchar("event_status", { length: 20 }).default("pendente"),
  // pendente | aprovado | emitido | cancelado

  nfseNumber: varchar("nfse_number", { length: 30 }),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_fiscal_project").on(t.projectId),
  index("idx_fiscal_status").on(t.projectId, t.eventStatus),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────
export const insertContractSchema = createInsertSchema(projectContracts).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertMilestoneSchema = createInsertSchema(projectBillingMilestones).omit({
  id: true, createdAt: true, updatedAt: true,
  acceptedAt: true, acceptedBy: true, arLancamentoId: true, fiscalEventId: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type ProjectContract = typeof projectContracts.$inferSelect;
export type BillingMilestone = typeof projectBillingMilestones.$inferSelect;
export type FiscalEvent = typeof projectFiscalEvents.$inferSelect;
