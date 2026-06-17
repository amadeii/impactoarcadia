/**
 * FISC-02 — migration_fisc02.ts
 * Cria fiscal_documentos — livro imutável de documentos fiscais emitidos.
 * Adiciona uf + codigo_municipio em emitentes_fiscal para resolução de CFOP.
 */

import { pool } from "../../db/index";

export async function runMigrationFisc02(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── fiscal_documentos ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fiscal_documentos (
        id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             VARCHAR NOT NULL,
        empresa_id            INTEGER NOT NULL,

        tipo                  VARCHAR(10) NOT NULL,
        numero                INTEGER,
        serie                 SMALLINT,
        chave_acesso          VARCHAR(44) UNIQUE,
        protocolo             VARCHAR(20),

        emitente_cnpj         VARCHAR(20) NOT NULL,
        destinatario_cnpj_cpf VARCHAR(20),
        destinatario_nome     VARCHAR(200),

        valor_total           NUMERIC(15,2),
        valor_icms            NUMERIC(15,2) DEFAULT 0,
        valor_pis             NUMERIC(15,2) DEFAULT 0,
        valor_cofins          NUMERIC(15,2) DEFAULT 0,
        valor_iss             NUMERIC(15,2) DEFAULT 0,

        ambiente              VARCHAR(20) NOT NULL DEFAULT 'homologacao',
        status                VARCHAR(30) NOT NULL DEFAULT 'montado',

        xml_autorizado        TEXT,
        pdf_danfe             TEXT,
        ultimo_erro           TEXT,

        sale_order_id         VARCHAR,
        purchase_invoice_id   VARCHAR,
        hub_fiscal_event_id   VARCHAR,
        ar_lancamento_id      VARCHAR,

        created_by_id         VARCHAR,
        cancelado_por_id      VARCHAR,
        cancelado_em          TIMESTAMP WITH TIME ZONE,
        created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fiscal_doc_tenant_tipo
        ON fiscal_documentos (tenant_id, tipo, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fiscal_doc_status
        ON fiscal_documentos (tenant_id, status)
        WHERE status NOT IN ('autorizado', 'cancelado')
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fiscal_doc_sale_order
        ON fiscal_documentos (sale_order_id)
        WHERE sale_order_id IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fiscal_doc_hub_event
        ON fiscal_documentos (hub_fiscal_event_id)
        WHERE hub_fiscal_event_id IS NOT NULL
    `);

    // ── UF em emitentes_fiscal (necessário para resolução de CFOP) ─────────
    await client.query(`
      ALTER TABLE emitentes_fiscal
        ADD COLUMN IF NOT EXISTS uf               VARCHAR(2),
        ADD COLUMN IF NOT EXISTS codigo_municipio VARCHAR(10)
    `);

    // Popular UF de emitentes_fiscal a partir de tenant_empresas
    await client.query(`
      UPDATE emitentes_fiscal ef
      SET uf               = te.uf,
          codigo_municipio = te.codigo_ibge
      FROM tenant_empresas te
      WHERE te.id = ef.empresa_id
        AND ef.uf IS NULL
        AND te.uf IS NOT NULL
    `).catch(() => {
      // tenant_empresas pode não ter uf/codigo_ibge — silencioso
    });

    await client.query("COMMIT");
    console.log("[FISC-02] Migration executada com sucesso.");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[FISC-02] Erro na migration:", err.message);
    throw err;
  } finally {
    client.release();
  }
}
