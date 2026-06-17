/**
 * COM-01 — migration_com01.ts
 * Módulo Comercial: sale_quotes, sale_quote_items, sale_orders,
 * sale_order_items, sale_order_installments, sale_order_events, soe_numeracao
 *
 * Decisão Manus §5.3: confirmado ≠ faturado.
 * Emissão NF-e requer ação explícita (invoice_requested_at).
 */

import { pool } from "../../db/index";

export async function runMigrationCom01(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. sale_quotes ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_quotes (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR NOT NULL,
        empresa_id      INTEGER,

        numero          VARCHAR(30) NOT NULL,
        versao          SMALLINT NOT NULL DEFAULT 1,

        pessoa_id       VARCHAR REFERENCES pessoas(id) ON DELETE SET NULL,
        vendedor_id     VARCHAR REFERENCES users(id)   ON DELETE SET NULL,

        tabela_preco_id          VARCHAR REFERENCES soe_tabelas_preco(id),
        condicao_pagamento_id    VARCHAR REFERENCES soe_condicoes_pagamento(id),
        natureza_operacao_id     INTEGER,

        subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
        desconto_global NUMERIC(15,2) NOT NULL DEFAULT 0,
        total_liquido   NUMERIC(15,2) NOT NULL DEFAULT 0,

        validade        DATE,
        status          VARCHAR(20) NOT NULL DEFAULT 'rascunho',

        observacao_cliente   TEXT,
        observacao_interna   TEXT,

        origem_tipo     VARCHAR(50),
        origem_ref_id   VARCHAR(100),

        enviado_em      TIMESTAMP WITH TIME ZONE,
        aceito_em       TIMESTAMP WITH TIME ZONE,
        rejeitado_em    TIMESTAMP WITH TIME ZONE,

        convertido_em_pedido_id VARCHAR,

        created_by_id   VARCHAR REFERENCES users(id),
        updated_by_id   VARCHAR REFERENCES users(id),
        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_quote_tenant_numero
        ON sale_quotes (tenant_id, numero)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_quote_pessoa
        ON sale_quotes (tenant_id, pessoa_id, status)
    `);

    // ── 2. sale_quote_items ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_quote_items (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_id            VARCHAR NOT NULL REFERENCES sale_quotes(id) ON DELETE CASCADE,
        sequencia           SMALLINT NOT NULL,

        produto_fiscal_id   VARCHAR REFERENCES produto_fiscal(id),
        product_id          INTEGER,

        descricao_snapshot  VARCHAR(300) NOT NULL,
        unidade             VARCHAR(10) NOT NULL DEFAULT 'UN',
        quantidade          NUMERIC(15,3) NOT NULL,
        preco_unitario      NUMERIC(15,4) NOT NULL,
        desconto_item       NUMERIC(15,2) DEFAULT 0,
        total_item          NUMERIC(15,2) NOT NULL,

        ncm_snapshot        VARCHAR(10),
        cfop_snapshot       VARCHAR(4),
        cst_csosn_snapshot  VARCHAR(5),
        origem_snapshot     SMALLINT DEFAULT 0,

        UNIQUE (quote_id, sequencia)
      )
    `);

    // ── 3. sale_orders ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_orders (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR NOT NULL,
        empresa_id      INTEGER,

        numero          VARCHAR(30) NOT NULL,

        quote_id        VARCHAR REFERENCES sale_quotes(id) ON DELETE SET NULL,
        origem_tipo     VARCHAR(50) NOT NULL DEFAULT 'manual',
        origem_ref_id   VARCHAR(100),

        pessoa_id       VARCHAR REFERENCES pessoas(id) ON DELETE SET NULL,
        vendedor_id     VARCHAR REFERENCES users(id)   ON DELETE SET NULL,

        tabela_preco_id          VARCHAR REFERENCES soe_tabelas_preco(id),
        condicao_pagamento_id    VARCHAR REFERENCES soe_condicoes_pagamento(id),
        natureza_operacao_id     INTEGER,

        subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
        desconto_global NUMERIC(15,2) NOT NULL DEFAULT 0,
        total_liquido   NUMERIC(15,2) NOT NULL DEFAULT 0,

        status          VARCHAR(30) NOT NULL DEFAULT 'rascunho',

        aprovado_por_id VARCHAR REFERENCES users(id),
        aprovado_em     TIMESTAMP WITH TIME ZONE,

        invoice_requested_at TIMESTAMP WITH TIME ZONE,
        invoice_requested_by VARCHAR REFERENCES users(id),
        faturado_em          TIMESTAMP WITH TIME ZONE,
        fiscal_doc_id        VARCHAR,

        data_entrega_prevista DATE,
        data_entrega_real     DATE,
        endereco_entrega_id   VARCHAR,

        observacao_cliente   TEXT,
        observacao_interna   TEXT,
        observacao_fiscal    TEXT,

        cancelado_por_id   VARCHAR REFERENCES users(id),
        cancelado_em       TIMESTAMP WITH TIME ZONE,
        motivo_cancelamento TEXT,

        created_by_id   VARCHAR REFERENCES users(id),
        updated_by_id   VARCHAR REFERENCES users(id),
        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_order_tenant_numero
        ON sale_orders (tenant_id, numero)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_order_pessoa_status
        ON sale_orders (tenant_id, pessoa_id, status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_order_status_created
        ON sale_orders (tenant_id, status, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_order_fiscal_doc
        ON sale_orders (fiscal_doc_id) WHERE fiscal_doc_id IS NOT NULL
    `);

    // ── 4. sale_order_items ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_order_items (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_order_id       VARCHAR NOT NULL REFERENCES sale_orders(id) ON DELETE CASCADE,
        sequencia           SMALLINT NOT NULL,

        produto_fiscal_id   VARCHAR REFERENCES produto_fiscal(id),
        product_id          INTEGER,

        descricao_snapshot  VARCHAR(300) NOT NULL,
        ncm_snapshot        VARCHAR(10),
        cfop_snapshot       VARCHAR(4),
        cst_csosn_snapshot  VARCHAR(5),
        cst_pis_snapshot    VARCHAR(3),
        cst_cofins_snapshot VARCHAR(3),
        origem_snapshot     SMALLINT DEFAULT 0,
        unidade             VARCHAR(10) NOT NULL DEFAULT 'UN',

        quantidade          NUMERIC(15,3) NOT NULL,
        preco_unitario      NUMERIC(15,4) NOT NULL,
        desconto_item       NUMERIC(15,2) DEFAULT 0,
        total_item          NUMERIC(15,2) NOT NULL,

        perc_icms           NUMERIC(5,2) DEFAULT 0,
        base_calc_icms      NUMERIC(15,2) DEFAULT 0,
        valor_icms          NUMERIC(15,2) DEFAULT 0,
        perc_pis            NUMERIC(5,2) DEFAULT 0,
        valor_pis           NUMERIC(15,2) DEFAULT 0,
        perc_cofins         NUMERIC(5,2) DEFAULT 0,
        valor_cofins        NUMERIC(15,2) DEFAULT 0,

        UNIQUE (sale_order_id, sequencia)
      )
    `);

    // ── 5. sale_order_installments ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_order_installments (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_order_id   VARCHAR NOT NULL REFERENCES sale_orders(id) ON DELETE CASCADE,
        parcela         SMALLINT NOT NULL,
        total_parcelas  SMALLINT NOT NULL,
        vencimento      DATE NOT NULL,
        valor           NUMERIC(15,2) NOT NULL,
        forma_pagamento VARCHAR(3) NOT NULL DEFAULT '17',
        percentual      NUMERIC(5,2),
        status          VARCHAR(20) NOT NULL DEFAULT 'pendente',
        lancamento_receber_id  VARCHAR,
        UNIQUE (sale_order_id, parcela)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_installment_status
        ON sale_order_installments (sale_order_id, status)
    `);

    // ── 6. sale_order_events ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_order_events (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_order_id   VARCHAR NOT NULL REFERENCES sale_orders(id) ON DELETE CASCADE,
        tenant_id       VARCHAR NOT NULL,
        tipo            VARCHAR(50) NOT NULL,
        status_de       VARCHAR(30),
        status_para     VARCHAR(30),
        descricao       TEXT,
        payload         JSONB DEFAULT '{}',
        usuario_id      VARCHAR REFERENCES users(id),
        usuario_nome    VARCHAR(200),
        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_event_order
        ON sale_order_events (sale_order_id, created_at DESC)
    `);

    // ── 7. soe_numeracao ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS soe_numeracao (
        id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   VARCHAR NOT NULL,
        empresa_id  INTEGER,
        tipo        VARCHAR(30) NOT NULL,
        prefixo     VARCHAR(10) DEFAULT '',
        proximo     INTEGER NOT NULL DEFAULT 1,
        UNIQUE (tenant_id, empresa_id, tipo)
      )
    `);

    await client.query("COMMIT");
    console.log("[COM-01] Migration executada com sucesso.");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[COM-01] Erro na migration:", err.message);
    throw err;
  } finally {
    client.release();
  }
}
