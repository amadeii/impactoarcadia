/**
 * Arcádia Project Hub — Migration HUB-05
 */
import { pool } from "../../db/index";

export async function runHub05Migration(): Promise<{ ok: boolean; log: string[] }> {
  const client = await pool.connect();
  const log: string[] = [];
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_timesheets (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id      VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id       VARCHAR NOT NULL,
        wbs_node_id     VARCHAR REFERENCES project_wbs_nodes(id) ON DELETE SET NULL,
        task_id         VARCHAR REFERENCES project_tasks(id) ON DELETE SET NULL,
        user_id         VARCHAR NOT NULL,
        user_name       VARCHAR(200),
        date            DATE NOT NULL,
        hours           NUMERIC(6,2) NOT NULL,
        billable        BOOLEAN DEFAULT TRUE,
        activity_type   VARCHAR(30) DEFAULT 'escritorio',
        cost_rate       NUMERIC(10,2) DEFAULT 0,
        billing_rate    NUMERIC(10,2) DEFAULT 0,
        cost_amount     NUMERIC(12,2) DEFAULT 0,
        billing_amount  NUMERIC(12,2) DEFAULT 0,
        description     TEXT,
        approved_by     VARCHAR,
        approved_at     TIMESTAMP,
        cost_event_id   VARCHAR,
        created_by      VARCHAR,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ts_project  ON project_timesheets(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ts_user     ON project_timesheets(tenant_id, user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ts_date     ON project_timesheets(project_id, date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ts_approved ON project_timesheets(project_id, approved_at)`);
    log.push("✓ TABLE project_timesheets");
    await client.query("COMMIT");
    log.push("✓ COMMIT — HUB-05 concluída");
    return { ok: true, log };
  } catch (err: any) {
    await client.query("ROLLBACK");
    return { ok: false, log: [...log, `✗ ${err.message}`] };
  } finally {
    client.release();
  }
}
