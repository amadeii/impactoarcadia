/**
 * Arcádia Project Hub — Migration HUB-01
 * Cria tabelas projects e project_members de forma idempotente.
 * Executar via: POST /api/hub/migrate (admin only)
 */

import { pool } from "../../db/index";

export async function runHubMigration(): Promise<{ ok: boolean; log: string[] }> {
  const client = await pool.connect();
  const log: string[] = [];

  try {
    await client.query("BEGIN");

    // ── projects ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           VARCHAR NOT NULL,
        project_code        VARCHAR(30) NOT NULL,
        title               VARCHAR(300) NOT NULL,
        project_type        VARCHAR(30) NOT NULL DEFAULT 'consultoria',
        status              VARCHAR(20) NOT NULL DEFAULT 'ativo',
        etapa               VARCHAR(40) NOT NULL DEFAULT 'planejamento',
        cliente_id          VARCHAR,
        cliente_nome        VARCHAR(300),
        cliente_externo_nome VARCHAR(300),
        owner_id            VARCHAR,
        proposal_id         INTEGER,
        cost_center_id      VARCHAR,
        municipio_ibge      VARCHAR(7),
        tax_profile_id      INTEGER,
        contract_value      NUMERIC(15,2),
        recognition_method  VARCHAR(20) DEFAULT 'percentual',
        planned_start       DATE,
        planned_end         DATE,
        actual_start        DATE,
        actual_end          DATE,
        progress_pct        INTEGER DEFAULT 0,
        health_score        VARCHAR(10) DEFAULT 'verde',
        description         TEXT,
        location            TEXT,
        metadata            JSONB DEFAULT '{}',
        created_by          VARCHAR,
        created_at          TIMESTAMP DEFAULT NOW(),
        updated_at          TIMESTAMP DEFAULT NOW()
      )
    `);
    log.push("✓ TABLE projects");

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_projects_code
        ON projects(tenant_id, project_code)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(tenant_id, status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(tenant_id, project_type)
    `);
    log.push("✓ INDEXES projects");

    // ── project_members ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id  VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id   VARCHAR NOT NULL,
        user_id     VARCHAR NOT NULL,
        user_name   VARCHAR(200),
        role        VARCHAR(30) NOT NULL DEFAULT 'tecnico',
        billing_rate NUMERIC(10,2),
        cost_rate   NUMERIC(10,2),
        active      BOOLEAN DEFAULT TRUE,
        joined_at   TIMESTAMP DEFAULT NOW()
      )
    `);
    log.push("✓ TABLE project_members");

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_proj_member
        ON project_members(project_id, user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_proj_members_project
        ON project_members(project_id)
    `);
    log.push("✓ INDEXES project_members");

    // ── seed: tipos de projeto ───────────────────────────────────────────────
    // (sem tabela separada por ora — projectType é enum varchar)
    // registrado em metadata apenas como referência futura

    await client.query("COMMIT");
    log.push("✓ COMMIT — HUB-01 migration concluída");
    return { ok: true, log };

  } catch (err: any) {
    await client.query("ROLLBACK");
    log.push(`✗ ROLLBACK: ${err.message}`);
    return { ok: false, log };
  } finally {
    client.release();
  }
}
