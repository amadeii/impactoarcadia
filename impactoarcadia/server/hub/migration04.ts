/**
 * Arcádia Project Hub — Migration HUB-04
 * Cria project_contracts, project_billing_milestones, project_fiscal_events
 */
import { pool } from "../../db/index";

export async function runHub04Migration(): Promise<{ ok: boolean; log: string[] }> {
  const client = await pool.connect();
  const log: string[] = [];
  try {
    await client.query("BEGIN");

    // ── project_contracts ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_contracts (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id          VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id           VARCHAR NOT NULL,
        contract_number     VARCHAR(60),
        contract_type       VARCHAR(20) NOT NULL DEFAULT 'fixed_price',
        total_value         NUMERIC(15,2) NOT NULL,
        payment_terms       TEXT,
        retention_percent   NUMERIC(5,2) DEFAULT 0,
        advance_payment     NUMERIC(15,2) DEFAULT 0,
        recognition_method  VARCHAR(20) DEFAULT 'percentual',
        status              VARCHAR(20) DEFAULT 'ativo',
        signed_at           DATE,
        document_path       TEXT,
        notes               TEXT,
        created_at          TIMESTAMP DEFAULT NOW(),
        updated_at          TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contracts_project ON project_contracts(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contracts_tenant  ON project_contracts(tenant_id)`);
    log.push("✓ TABLE project_contracts");

    // ── project_billing_milestones ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_billing_milestones (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id         VARCHAR NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
        project_id          VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id           VARCHAR NOT NULL,
        wbs_node_id         VARCHAR REFERENCES project_wbs_nodes(id) ON DELETE SET NULL,
        title               VARCHAR(300) NOT NULL,
        trigger_type        VARCHAR(20) DEFAULT 'manual',
        trigger_value       NUMERIC(10,2),
        amount              NUMERIC(15,2) NOT NULL,
        acceptance_required BOOLEAN DEFAULT TRUE,
        accepted_at         TIMESTAMP,
        accepted_by         VARCHAR,
        acceptance_notes    TEXT,
        status              VARCHAR(20) NOT NULL DEFAULT 'pendente',
        ar_lancamento_id    VARCHAR,
        fiscal_event_id     VARCHAR,
        due_date            DATE,
        order_index         INTEGER DEFAULT 0,
        created_at          TIMESTAMP DEFAULT NOW(),
        updated_at          TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_milestones_contract ON project_billing_milestones(contract_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_milestones_project  ON project_billing_milestones(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_milestones_status   ON project_billing_milestones(project_id, status)`);
    log.push("✓ TABLE project_billing_milestones");

    // ── project_fiscal_events ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_fiscal_events (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id      VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id       VARCHAR NOT NULL,
        milestone_id    VARCHAR,
        event_type      VARCHAR(20) DEFAULT 'nfse',
        municipio_ibge  VARCHAR(7),
        service_code    VARCHAR(10),
        tax_profile_id  INTEGER,
        amount          NUMERIC(15,2) NOT NULL,
        retention_iss   NUMERIC(12,2) DEFAULT 0,
        retention_ir    NUMERIC(12,2) DEFAULT 0,
        retention_pcc   NUMERIC(12,2) DEFAULT 0,
        competencia     DATE,
        event_status    VARCHAR(20) DEFAULT 'pendente',
        nfse_number     VARCHAR(30),
        approved_by     VARCHAR,
        approved_at     TIMESTAMP,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fiscal_project ON project_fiscal_events(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fiscal_status  ON project_fiscal_events(project_id, event_status)`);
    log.push("✓ TABLE project_fiscal_events");

    await client.query("COMMIT");
    log.push("✓ COMMIT — HUB-04 migration concluída");
    return { ok: true, log };
  } catch (err: any) {
    await client.query("ROLLBACK");
    log.push(`✗ ROLLBACK: ${err.message}`);
    return { ok: false, log };
  } finally {
    client.release();
  }
}
