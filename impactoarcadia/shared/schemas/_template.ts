/**
 * TEMPLATE - Exemplo de schema modular para o Dev Center
 * 
 * Copie este arquivo e renomeie para criar um novo módulo.
 * Exemplo: shared/schemas/bsc.ts
 * 
 * REGRAS:
 * 1. Importe sql, pgTable, etc. de drizzle-orm/pg-core
 * 2. Importe createInsertSchema de drizzle-zod e z de zod
 * 3. Exporte tabelas, insertSchemas e types
 * 4. Use prefixo do módulo nas tabelas (ex: bsc_objectives)
 * 5. NÃO importe de @shared/schema (evitar referência circular)
 *    Para referências a users, use varchar("user_id") sem .references()
 *    A referência será feita via SQL no banco
 * 
 * IMPORTANTE:
 * - Referências a tabelas do schema principal (users, tenants, etc)
 *   devem usar varchar/integer SEM .references() para evitar imports circulares
 * - Adicione comentários indicando a tabela referenciada
 */

/*
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABELAS ===

export const exemploItems = pgTable("exemplo_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // ref: users.id
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// === INSERT SCHEMAS ===

export const insertExemploItemSchema = createInsertSchema(exemploItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// === TYPES ===

export type ExemploItem = typeof exemploItems.$inferSelect;
export type InsertExemploItem = z.infer<typeof insertExemploItemSchema>;
*/
