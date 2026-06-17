/**
 * Arcádia Project Hub — Migration PROJ-01
 * Adiciona campo priority na tabela projects
 */
import { pool } from "../../db/index";

export async function runProjPriority(): Promise<{ ok: boolean; log: string[] }> {
  const client = await pool.connect();
  const log: string[] = [];
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'media'
    `);
    log.push("✓ ALTER TABLE projects ADD COLUMN priority");
    await client.query("COMMIT");
    log.push("✓ COMMIT — PROJ-01 concluída");
    return { ok: true, log };
  } catch (err: any) {
    await client.query("ROLLBACK");
    return { ok: false, log: [...log, `✗ ${err.message}`] };
  } finally {
    client.release();
  }
}
