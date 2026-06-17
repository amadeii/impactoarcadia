/**
 * CTL-IMP-01 — migration_ctl_imp01.ts
 *
 * Garante que lancamentos_financeiros tem as colunas:
 *   projeto_id     VARCHAR — FK → engineering_projects.id (ON DELETE SET NULL)
 *   projeto_codigo VARCHAR — código legível: IMP23195, ENG-2026-007
 *
 * Os campos já existem no schema Drizzle (projetoId / projetoCodigo)
 * mas podem não ter sido criados em bancos antigos. Migration idempotente.
 */

import { pool } from "../../db/index";

export async function runMigrationCtlImp01(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Colunas em lancamentos_financeiros
    await client.query(`
      ALTER TABLE lancamentos_financeiros
        ADD COLUMN IF NOT EXISTS projeto_id     VARCHAR(36),
        ADD COLUMN IF NOT EXISTS projeto_codigo VARCHAR(50)
    `);

    // FK opcional — SAVEPOINT para não abortar a transação principal se falhar
    await client.query("SAVEPOINT fk_eng_proj");
    try {
      const { rows: tbls } = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'engineering_projects' LIMIT 1`
      );
      const { rows: fks } = await client.query(
        `SELECT 1 FROM information_schema.table_constraints
         WHERE constraint_name = 'fk_lanc_eng_proj'
           AND table_name = 'lancamentos_financeiros' LIMIT 1`
      );
      if (tbls.length > 0 && fks.length === 0) {
        await client.query(`
          ALTER TABLE lancamentos_financeiros
            ADD CONSTRAINT fk_lanc_eng_proj
            FOREIGN KEY (projeto_id)
            REFERENCES engineering_projects(id) ON DELETE SET NULL
        `);
      }
      await client.query("RELEASE SAVEPOINT fk_eng_proj");
    } catch {
      await client.query("ROLLBACK TO SAVEPOINT fk_eng_proj");
      await client.query("RELEASE SAVEPOINT fk_eng_proj");
    }

    // Índices para busca por projeto no Control
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lanc_projeto_id
        ON lancamentos_financeiros(tenant_id, projeto_id)
        WHERE projeto_id IS NOT NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lanc_projeto_codigo
        ON lancamentos_financeiros(tenant_id, projeto_codigo)
        WHERE projeto_codigo IS NOT NULL
    `);

    await client.query("COMMIT");
    console.log("[CTL-IMP-01] lancamentos_financeiros.projeto_id + projeto_codigo: OK");

    // Stats
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE projeto_id IS NOT NULL)     AS com_projeto_id,
        COUNT(*) FILTER (WHERE projeto_codigo IS NOT NULL) AS com_projeto_codigo,
        COUNT(*) AS total
      FROM lancamentos_financeiros
    `);
    console.log("[CTL-IMP-01] stats:", rows[0]);

  } catch (e: any) {
    await client.query("ROLLBACK");
    console.error("[CTL-IMP-01] Erro:", e.message);
    throw e;
  } finally {
    client.release();
  }
}
