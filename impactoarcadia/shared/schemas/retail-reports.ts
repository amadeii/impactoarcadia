import { pgTable, serial, varchar, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const retailTradeIns = pgTable("retail_trade_ins", {
  id: serial("id").primaryKey(),
  sellerId: varchar("seller_id").notNull(),
  companyId: varchar("company_id").notNull(),
  clientId: varchar("client_id").notNull(),
  tradeInDate: timestamp("trade_in_date").notNull(),
  tradeInValue: numeric("trade_in_value").notNull(),
  status: varchar("status").notNull()
});

export const insertRetailTradeInSchema = createInsertSchema(retailTradeIns).omit({ id: true });
export type RetailTradeIn = typeof retailTradeIns.$inferSelect;
export type InsertRetailTradeIn = z.infer<typeof insertRetailTradeInSchema>;