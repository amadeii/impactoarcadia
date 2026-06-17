/**
 * FISC-01 — migration_fisc01.ts
 * Separação de rg_ie em dois campos distintos na tabela pessoas.
 */

import { pool } from "../../db/index";

export async function runMigrationFisc01(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE pessoas
        ADD COLUMN IF NOT EXISTS rg               VARCHAR(20),
        ADD COLUMN IF NOT EXISTS ie               VARCHAR(30),
        ADD COLUMN IF NOT EXISTS contribuinte     VARCHAR(1) DEFAULT 'N',
        ADD COLUMN IF NOT EXISTS consumidor_final SMALLINT  DEFAULT 1
    `);

    // PF: rg_ie → rg
    await client.query(`
      UPDATE pessoas
      SET rg = rg_ie
      WHERE tipo_pessoa = 'PF'
        AND rg_ie IS NOT NULL AND rg_ie != ''
        AND rg IS NULL
    `);

    // PJ: rg_ie → ie (normaliza)
    await client.query(`
      UPDATE pessoas
      SET ie = REGEXP_REPLACE(rg_ie, '[^0-9A-Za-z]', '', 'g')
      WHERE tipo_pessoa = 'PJ'
        AND rg_ie IS NOT NULL AND rg_ie != ''
        AND ie IS NULL
    `);

    // PJ com IE → contribuinte = 'S'
    await client.query(`
      UPDATE pessoas
      SET contribuinte = 'S'
      WHERE tipo_pessoa = 'PJ'
        AND ie IS NOT NULL AND ie != ''
        AND ie NOT IN ('ISENTO', 'isento', 'Isento', 'ISE', 'EX')
        AND contribuinte = 'N'
    `);

    // PJ com IE = ISENTO → contribuinte = 'I'
    await client.query(`
      UPDATE pessoas
      SET contribuinte = 'I'
      WHERE tipo_pessoa = 'PJ'
        AND ie IS NOT NULL
        AND ie ILIKE 'isento'
        AND contribuinte = 'N'
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pessoas_ie
        ON pessoas (tenant_id, ie)
        WHERE ie IS NOT NULL AND ie != ''
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pessoas_rg
        ON pessoas (tenant_id, rg)
        WHERE rg IS NOT NULL AND rg != ''
    `);

    await client.query("COMMIT");
    console.log("[FISC-01] Migration executada com sucesso.");

    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE tipo_pessoa = 'PF' AND rg IS NOT NULL) AS pf_com_rg,
        COUNT(*) FILTER (WHERE tipo_pessoa = 'PJ' AND ie IS NOT NULL) AS pj_com_ie,
        COUNT(*) FILTER (WHERE tipo_pessoa = 'PJ' AND contribuinte = 'S') AS pj_contribuinte,
        COUNT(*) FILTER (WHERE tipo_pessoa = 'PJ' AND ie IS NULL)     AS pj_sem_ie
      FROM pessoas
    `);
    console.log("[FISC-01] Estatísticas:", stats[0]);
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[FISC-01] Erro na migration:", err.message);
    throw err;
  } finally {
    client.release();
  }
}
