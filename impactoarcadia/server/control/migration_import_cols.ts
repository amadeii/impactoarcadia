/**
 * CTL-IMPORT-01 — migration_import_cols.ts
 *
 * Adiciona colunas auxiliares em lancamentos_financeiros para armazenar
 * dados brutos da importação da planilha, usados para matching posterior
 * com plano de contas, contas bancárias e pessoas.
 */

import { pool } from "../../db/index";

export async function runMigrationImportCols(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE lancamentos_financeiros
        ADD COLUMN IF NOT EXISTS plano_conta_raw    VARCHAR(200),
        ADD COLUMN IF NOT EXISTS conta_bancaria_raw VARCHAR(100),
        ADD COLUMN IF NOT EXISTS parceiro           VARCHAR(100),
        ADD COLUMN IF NOT EXISTS tipo_lancamento    VARCHAR(50),
        ADD COLUMN IF NOT EXISTS data_documento     DATE,
        ADD COLUMN IF NOT EXISTS documento          VARCHAR(100),
        ADD COLUMN IF NOT EXISTS data_liquidacao    DATE,
        ADD COLUMN IF NOT EXISTS origem             VARCHAR(50) DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS valor_parcela      NUMERIC(15,2)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lanc_origem
        ON lancamentos_financeiros(tenant_id, cliente_id, origem)
        WHERE origem = 'import_planilha'
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lanc_projeto_codigo
        ON lancamentos_financeiros(tenant_id, projeto_codigo)
        WHERE projeto_codigo IS NOT NULL
    `);

    await client.query("COMMIT");
    console.log("[CTL-IMPORT-01] colunas de importação: OK");
  } catch (e: any) {
    await client.query("ROLLBACK");
    console.warn("[CTL-IMPORT-01] migration warning:", e.message);
  } finally {
    client.release();
  }
}
