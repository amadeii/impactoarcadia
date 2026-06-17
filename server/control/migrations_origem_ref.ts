import type { PoolClient } from "pg";

export async function runOrigemRefMigrations(client: PoolClient): Promise<void> {
  console.log("[migration-origem-ref] Iniciando...");

  await client.query(`
    ALTER TABLE lancamentos_financeiros
      ADD COLUMN IF NOT EXISTS origem_ref_id   VARCHAR,
      ADD COLUMN IF NOT EXISTS origem_ref_tipo VARCHAR(30)
  `).catch(() => {});

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lanc_origem_ref
      ON lancamentos_financeiros(origem_ref_tipo, origem_ref_id)
      WHERE origem_ref_id IS NOT NULL
  `).catch(() => {});

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_lanc_origem_ref_receber
      ON lancamentos_financeiros(cliente_id, origem_ref_tipo, origem_ref_id)
      WHERE tipo = 'receber' AND status != 'cancelado'
        AND origem_ref_id IS NOT NULL
  `).catch(() => {});

  console.log("[migration-origem-ref] ✅ OK");
}
