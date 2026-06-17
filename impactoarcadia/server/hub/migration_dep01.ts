/**
 * Arcádia Project Hub — Migration DEP-01
 * Cria tabela project_task_dependencies
 */
import { pool } from "../../db/index";

export async function runDep01Migration(): Promise<{ ok: boolean; log: string[] }> {
  const client = await pool.connect();
  const log: string[] = [];
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_task_dependencies (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id         VARCHAR NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
        depends_on_id   VARCHAR NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
        tenant_id       VARCHAR NOT NULL,
        created_at      TIMESTAMP DEFAULT NOW(),
        UNIQUE(task_id, depends_on_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_dep_task ON project_task_dependencies(task_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_dep_depends ON project_task_dependencies(depends_on_id)
    `);
    log.push("✓ TABLE project_task_dependencies");
    await client.query("COMMIT");
    log.push("✓ COMMIT — DEP-01 concluída");
    return { ok: true, log };
  } catch (err: any) {
    await client.query("ROLLBACK");
    return { ok: false, log: [...log, `✗ ${err.message}`] };
  } finally {
    client.release();
  }
}
