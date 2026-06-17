/**
 * Arcádia Project Hub — Migration HUB-02
 * Cria project_wbs_nodes, project_tasks, project_task_comments
 */

import { pool } from "../../db/index";

export async function runHub02Migration(): Promise<{ ok: boolean; log: string[] }> {
  const client = await pool.connect();
  const log: string[] = [];
  try {
    await client.query("BEGIN");

    // ── project_wbs_nodes ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_wbs_nodes (
        id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id       VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id        VARCHAR NOT NULL,
        parent_id        VARCHAR,
        node_type        VARCHAR(20) NOT NULL DEFAULT 'tarefa',
        title            VARCHAR(300) NOT NULL,
        code             VARCHAR(20),
        weight           NUMERIC(5,2) DEFAULT 1,
        progress_method  VARCHAR(20) DEFAULT 'manual',
        progress_pct     INTEGER DEFAULT 0,
        planned_start    DATE,
        planned_end      DATE,
        actual_start     DATE,
        actual_end       DATE,
        budget_amount    NUMERIC(15,2),
        assignee_id      VARCHAR,
        assignee_name    VARCHAR(200),
        status           VARCHAR(20) DEFAULT 'pendente',
        order_index      INTEGER DEFAULT 0,
        description      TEXT,
        metadata         JSONB DEFAULT '{}',
        created_at       TIMESTAMP DEFAULT NOW(),
        updated_at       TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wbs_project ON project_wbs_nodes(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wbs_parent  ON project_wbs_nodes(parent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wbs_tenant  ON project_wbs_nodes(tenant_id)`);
    log.push("✓ TABLE project_wbs_nodes");

    // ── project_tasks ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_tasks (
        id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id       VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        wbs_node_id      VARCHAR REFERENCES project_wbs_nodes(id) ON DELETE SET NULL,
        tenant_id        VARCHAR NOT NULL,
        title            VARCHAR(300) NOT NULL,
        description      TEXT,
        status           VARCHAR(20) NOT NULL DEFAULT 'backlog',
        priority         VARCHAR(10) DEFAULT 'media',
        assignee_id      VARCHAR,
        assignee_name    VARCHAR(200),
        estimated_hours  NUMERIC(8,2),
        actual_hours     NUMERIC(8,2) DEFAULT 0,
        billable         BOOLEAN DEFAULT TRUE,
        cost_rate        NUMERIC(10,2),
        billing_rate     NUMERIC(10,2),
        due_date         DATE,
        completed_at     TIMESTAMP,
        tags             JSONB DEFAULT '[]',
        checklist        JSONB DEFAULT '[]',
        order_index      INTEGER DEFAULT 0,
        created_by       VARCHAR,
        created_at       TIMESTAMP DEFAULT NOW(),
        updated_at       TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project  ON project_tasks(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_wbs      ON project_tasks(wbs_node_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status   ON project_tasks(project_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON project_tasks(project_id, assignee_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_tenant   ON project_tasks(tenant_id)`);
    log.push("✓ TABLE project_tasks");

    // ── project_task_comments ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_task_comments (
        id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id     VARCHAR NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
        tenant_id   VARCHAR NOT NULL,
        author_id   VARCHAR NOT NULL,
        author_name VARCHAR(200),
        content     TEXT NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_comments_task ON project_task_comments(task_id)`);
    log.push("✓ TABLE project_task_comments");

    await client.query("COMMIT");
    log.push("✓ COMMIT — HUB-02 migration concluída");
    return { ok: true, log };
  } catch (err: any) {
    await client.query("ROLLBACK");
    log.push(`✗ ROLLBACK: ${err.message}`);
    return { ok: false, log };
  } finally {
    client.release();
  }
}
