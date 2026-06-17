/**
 * Arcádia Project Hub — Migration HUB-03
 * Cria project_budget_versions, project_budget_lines, project_cost_events
 * Adiciona trigger: lancamentos_financeiros com projeto_id → gera cost_event
 */
import { pool } from "../../db/index";

export async function runHub03Migration(): Promise<{ ok: boolean; log: string[] }> {
  const client = await pool.connect();
  const log: string[] = [];
  try {
    await client.query("BEGIN");

    // ── project_budget_versions ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_budget_versions (
        id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id    VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id     VARCHAR NOT NULL,
        version       INTEGER NOT NULL DEFAULT 1,
        label         VARCHAR(100),
        status        VARCHAR(20) DEFAULT 'rascunho',
        total_budget  NUMERIC(15,2) DEFAULT 0,
        approved_by   VARCHAR,
        approved_at   TIMESTAMP,
        notes         TEXT,
        created_at    TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_budgetv_project ON project_budget_versions(project_id)`);
    log.push("✓ TABLE project_budget_versions");

    // ── project_budget_lines ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_budget_lines (
        id                VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        budget_version_id VARCHAR NOT NULL REFERENCES project_budget_versions(id) ON DELETE CASCADE,
        project_id        VARCHAR NOT NULL,
        tenant_id         VARCHAR NOT NULL,
        wbs_node_id       VARCHAR REFERENCES project_wbs_nodes(id) ON DELETE SET NULL,
        cost_category     VARCHAR(30) NOT NULL,
        description       VARCHAR(300),
        plano_conta_id    VARCHAR,
        quantity          NUMERIC(10,3) DEFAULT 1,
        unit              VARCHAR(20) DEFAULT 'un',
        unit_cost         NUMERIC(10,2) DEFAULT 0,
        amount            NUMERIC(15,2) NOT NULL DEFAULT 0,
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_budgetl_version  ON project_budget_lines(budget_version_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_budgetl_project  ON project_budget_lines(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_budgetl_category ON project_budget_lines(project_id, cost_category)`);
    log.push("✓ TABLE project_budget_lines");

    // ── project_cost_events ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_cost_events (
        id                      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id              VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id               VARCHAR NOT NULL,
        wbs_node_id             VARCHAR REFERENCES project_wbs_nodes(id) ON DELETE SET NULL,
        source_type             VARCHAR(20) NOT NULL,
        source_id               VARCHAR,
        cost_category           VARCHAR(30) NOT NULL,
        description             VARCHAR(300),
        amount                  NUMERIC(15,2) NOT NULL,
        event_date              DATE NOT NULL,
        control_lancamento_id   VARCHAR,
        created_at              TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_costevt_project    ON project_cost_events(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_costevt_wbs        ON project_cost_events(wbs_node_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_costevt_category   ON project_cost_events(project_id, cost_category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_costevt_lancamento ON project_cost_events(control_lancamento_id)`);
    log.push("✓ TABLE project_cost_events");

    // ── Função + Trigger: lancamentos_financeiros → cost_event ───────────────
    // Quando um lançamento do Control tem projeto_id preenchido,
    // registra automaticamente um cost_event no Hub.
    await client.query(`
      CREATE OR REPLACE FUNCTION fn_hub_lancamento_cost_event()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Só dispara quando projeto_id é preenchido e tipo é despesa/pagar
        IF NEW.projeto_id IS NOT NULL AND NEW.tipo IN ('despesa', 'pagar', 'ap') THEN
          INSERT INTO project_cost_events (
            project_id, tenant_id, source_type, source_id,
            cost_category, description, amount, event_date, control_lancamento_id
          ) VALUES (
            NEW.projeto_id,
            NEW.tenant_id,
            'lancamento_direto',
            NEW.id,
            COALESCE(
              CASE
                WHEN NEW.descricao ILIKE '%material%' THEN 'material'
                WHEN NEW.descricao ILIKE '%equip%'    THEN 'equipamento'
                WHEN NEW.descricao ILIKE '%terceiro%' THEN 'terceiros'
                ELSE 'despesa'
              END, 'despesa'
            ),
            NEW.descricao,
            NEW.valor,
            COALESCE(NEW.data_emissao, NOW()::date),
            NEW.id
          )
          ON CONFLICT DO NOTHING;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trg_hub_cost_event ON lancamentos_financeiros
    `);
    await client.query(`
      CREATE TRIGGER trg_hub_cost_event
        AFTER INSERT OR UPDATE OF projeto_id ON lancamentos_financeiros
        FOR EACH ROW
        EXECUTE FUNCTION fn_hub_lancamento_cost_event()
    `);
    log.push("✓ TRIGGER trg_hub_cost_event em lancamentos_financeiros");

    await client.query("COMMIT");
    log.push("✓ COMMIT — HUB-03 migration concluída");
    return { ok: true, log };
  } catch (err: any) {
    await client.query("ROLLBACK");
    log.push(`✗ ROLLBACK: ${err.message}`);
    return { ok: false, log };
  } finally {
    client.release();
  }
}
