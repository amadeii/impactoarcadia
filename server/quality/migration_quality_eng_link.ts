/**
 * migration_quality_eng_link.ts — Sprint 2
 *
 * Adiciona FK engineering_project_id em:
 *   - quality_samples
 *   - quality_non_conformities
 *
 * Permite rastreabilidade amostras/RNCs → projetos ENG (código IMP-YYYY-NNN).
 * Idempotente via ADD COLUMN IF NOT EXISTS.
 */

import { pool } from "../../db/index";

export async function runMigrationQualityEngLink(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Coluna em quality_samples
    await client.query(`
      ALTER TABLE quality_samples
        ADD COLUMN IF NOT EXISTS engineering_project_id VARCHAR(36)
        REFERENCES engineering_projects(id) ON DELETE SET NULL
    `);

    // Coluna em quality_non_conformities
    await client.query(`
      ALTER TABLE quality_non_conformities
        ADD COLUMN IF NOT EXISTS engineering_project_id VARCHAR(36)
        REFERENCES engineering_projects(id) ON DELETE SET NULL
    `);

    // Índices para busca por projeto
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_qs_eng_proj
        ON quality_samples(engineering_project_id)
        WHERE engineering_project_id IS NOT NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rnc_eng_proj
        ON quality_non_conformities(engineering_project_id)
        WHERE engineering_project_id IS NOT NULL
    `);

    await client.query("COMMIT");
    console.log("[migration] quality→engineering_projects link: OK");

    // Stats
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM quality_samples WHERE engineering_project_id IS NOT NULL) AS amostras_vinculadas,
        (SELECT COUNT(*) FROM quality_non_conformities WHERE engineering_project_id IS NOT NULL) AS rncs_vinculadas
    `);
    console.log("[migration] vínculos existentes:", rows[0]);

  } catch (e: any) {
    await client.query("ROLLBACK");
    console.error("[migration] Erro quality_eng_link:", e.message);
    throw e;
  } finally {
    client.release();
  }
}
