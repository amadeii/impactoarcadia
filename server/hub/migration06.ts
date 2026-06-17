/**
 * Arcádia Project Hub — Migration HUB-06
 */
import { pool } from "../../db/index";

export async function runHub06Migration(): Promise<{ ok: boolean; log: string[] }> {
  const client = await pool.connect();
  const log: string[] = [];
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_allocation_rules (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id      VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id       VARCHAR NOT NULL,
        rule_type       VARCHAR(20) NOT NULL,
        description     VARCHAR(200),
        driver          TEXT,
        formula         TEXT,
        percentage      NUMERIC(7,4),
        cost_category   VARCHAR(30),
        plano_conta_id  VARCHAR,
        effective_from  DATE,
        effective_to    DATE,
        approval_status VARCHAR(20) DEFAULT 'rascunho',
        approved_by     VARCHAR,
        approved_at     TIMESTAMP,
        last_run_at     TIMESTAMP,
        last_run_amount NUMERIC(15,2),
        active          BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alloc_project ON project_allocation_rules(project_id)`);
    log.push("✓ TABLE project_allocation_rules");

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_kpi_snapshots (
        id                VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id        VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id         VARCHAR NOT NULL,
        snapshot_date     DATE NOT NULL,
        contract_value    NUMERIC(15,2) DEFAULT 0,
        revenue_billed    NUMERIC(15,2) DEFAULT 0,
        revenue_recognized NUMERIC(15,2) DEFAULT 0,
        cost_planned      NUMERIC(15,2) DEFAULT 0,
        cost_actual       NUMERIC(15,2) DEFAULT 0,
        cost_labor        NUMERIC(15,2) DEFAULT 0,
        cost_material     NUMERIC(15,2) DEFAULT 0,
        cost_third_party  NUMERIC(15,2) DEFAULT 0,
        cost_overhead     NUMERIC(15,2) DEFAULT 0,
        gross_margin      NUMERIC(15,2) DEFAULT 0,
        margin_pct        NUMERIC(7,4) DEFAULT 0,
        progress_pct      INTEGER DEFAULT 0,
        planned_value     NUMERIC(15,2) DEFAULT 0,
        earned_value      NUMERIC(15,2) DEFAULT 0,
        cpi               NUMERIC(8,4),
        spi               NUMERIC(8,4),
        eac               NUMERIC(15,2),
        variance          NUMERIC(15,2) DEFAULT 0,
        total_hours       NUMERIC(10,2) DEFAULT 0,
        billable_hours    NUMERIC(10,2) DEFAULT 0,
        health_score      VARCHAR(10) DEFAULT 'verde',
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_kpi_project_date ON project_kpi_snapshots(project_id, snapshot_date)`);
    log.push("✓ TABLE project_kpi_snapshots");

    await client.query("COMMIT");
    log.push("✓ COMMIT — HUB-06 concluída");
    return { ok: true, log };
  } catch (err: any) {
    await client.query("ROLLBACK");
    return { ok: false, log: [...log, `✗ ${err.message}`] };
  } finally {
    client.release();
  }
}
