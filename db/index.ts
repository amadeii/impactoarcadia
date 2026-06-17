/**
 * db/index.ts — Sprint 2 (POOL)
 *
 * Unifica pg.Client (Drizzle) e pool auxiliar em um único pg.Pool com:
 *   - max: 20 conexões (configurável via DB_POOL_MAX)
 *   - reconexão automática (pg.Pool vs pg.Client que não reconecta)
 *   - graceful shutdown em SIGTERM/SIGINT
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

// Pool único compartilhado entre Drizzle ORM e todas as queries raw
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX ?? "20"),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Drizzle usa o mesmo pool — sem conexão extra
export const db = drizzle(pool, { schema });

// Graceful shutdown — fecha conexões ao encerrar o processo
const shutdown = () => {
  pool.end().catch((e) => console.error("[db] Erro ao fechar pool:", e.message));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT",  shutdown);
