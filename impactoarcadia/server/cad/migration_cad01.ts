/**
 * CAD-01 — Migration dos Cadastros Centrais do SOE
 *
 * Cria as tabelas mestres que todos os módulos transacionais (COM, COMP, EST, FISC)
 * consomem. Deve ser executada após SOE-00.
 *
 * Tabelas criadas:
 *   1. produto_fiscal              — extensão fiscal de products (padrão Hub)
 *   2. produto_fiscal_tributacao_uf — alíquotas específicas por produto × UF
 *   3. emitentes_fiscal            — dados fiscais da empresa emissora (sem PFX no banco)
 *   4. soe_tabelas_preco           — tabelas de preço centrais (padrão Hub)
 *   5. soe_tabela_preco_itens      — preços por produto/tabela
 *   6. soe_condicoes_pagamento     — condições de pagamento (geram parcelas)
 *   7. soe_condicao_parcelas       — configuração de cada parcela da condição
 *
 * Além disso, atualiza a VIEW v_products (criada em SOE-00) para enriquecer
 * com campos de produto_fiscal.
 *
 * REGRAS: idempotente, sem DROP, reexecutável sem efeito colateral.
 */

import { pool } from "../../db/index";

export async function runMigrationCad01(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ─────────────────────────────────────────────────────────────────────────
    // 1. produto_fiscal
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS produto_fiscal (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR NOT NULL,
        empresa_id      INTEGER,

        product_id      INTEGER,

        codigo          VARCHAR(50)           NOT NULL,
        descricao       VARCHAR(300)          NOT NULL,
        descricao_nfe   VARCHAR(120),
        unidade         VARCHAR(10)           NOT NULL DEFAULT 'UN',
        codigo_barras   VARCHAR(60),

        ncm             VARCHAR(10),
        cest            VARCHAR(9),
        origem          SMALLINT              NOT NULL DEFAULT 0,

        grupo_tributacao_id INTEGER,

        controla_lote         BOOLEAN NOT NULL DEFAULT false,
        controla_serial       BOOLEAN NOT NULL DEFAULT false,
        unidade_tributavel    VARCHAR(10),
        fator_conversao       NUMERIC(15,6) DEFAULT 1,

        preco_custo           NUMERIC(15,4) DEFAULT 0,
        custo_medio           NUMERIC(15,4) DEFAULT 0,
        preco_venda_base      NUMERIC(15,4) DEFAULT 0,

        estoque_minimo        NUMERIC(15,3) DEFAULT 0,
        estoque_maximo        NUMERIC(15,3),
        ponto_reposicao       NUMERIC(15,3) DEFAULT 0,

        categoria             VARCHAR(100),
        subcategoria          VARCHAR(100),
        marca                 VARCHAR(100),
        modelo                VARCHAR(100),

        externo_id_plus       VARCHAR(100),
        externo_id_erp        VARCHAR(100),

        status                VARCHAR(20) NOT NULL DEFAULT 'ativo',

        created_by_id         VARCHAR,
        updated_by_id         VARCHAR,
        created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_produto_fiscal_tenant_codigo
        ON produto_fiscal (tenant_id, codigo)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_produto_fiscal_ncm
        ON produto_fiscal (ncm) WHERE ncm IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_produto_fiscal_product_id
        ON produto_fiscal (product_id) WHERE product_id IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_produto_fiscal_tenant_status
        ON produto_fiscal (tenant_id, status)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. produto_fiscal_tributacao_uf
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS produto_fiscal_tributacao_uf (
        id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             VARCHAR NOT NULL,
        produto_fiscal_id     VARCHAR NOT NULL
                                REFERENCES produto_fiscal(id) ON DELETE CASCADE,
        uf_destino            CHAR(2) NOT NULL,
        cfop_saida            VARCHAR(4),
        cfop_entrada          VARCHAR(4),
        cst_csosn             VARCHAR(5),
        perc_icms             NUMERIC(5,2) DEFAULT 0,
        perc_red_bc           NUMERIC(5,2) DEFAULT 0,
        perc_mva_st           NUMERIC(5,2) DEFAULT 0,
        perc_icms_st          NUMERIC(5,2) DEFAULT 0,
        observacao            TEXT,
        vigencia_inicio       DATE,
        vigencia_fim          DATE,
        created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_prod_trib_uf
        ON produto_fiscal_tributacao_uf (produto_fiscal_id, uf_destino)
        WHERE vigencia_fim IS NULL
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. emitentes_fiscal
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS emitentes_fiscal (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR NOT NULL,
        empresa_id      INTEGER NOT NULL,

        cnpj            VARCHAR(20) NOT NULL,
        razao_social    VARCHAR(200) NOT NULL,
        nome_fantasia   VARCHAR(200),
        ie              VARCHAR(20),
        im              VARCHAR(20),
        cnae_principal  VARCHAR(10),

        crt             SMALLINT NOT NULL DEFAULT 1,
        ambiente        VARCHAR(20) NOT NULL DEFAULT 'homologacao',

        serie_nfe       SMALLINT NOT NULL DEFAULT 1,
        serie_nfce      SMALLINT NOT NULL DEFAULT 1,
        serie_nfse      SMALLINT NOT NULL DEFAULT 1,
        proximo_num_nfe   INTEGER NOT NULL DEFAULT 1,
        proximo_num_nfce  INTEGER NOT NULL DEFAULT 1,

        csc_id          VARCHAR(10),
        csc_token       VARCHAR(50),

        plus_certificado_ref    VARCHAR(200),
        certificado_cnpj        VARCHAR(20),
        certificado_serial      VARCHAR(100),
        certificado_valido_ate  TIMESTAMP WITH TIME ZONE,
        certificado_tipo        VARCHAR(5) DEFAULT 'A1',

        enviar_email_automatico    BOOLEAN DEFAULT false,
        imprimir_danfe_automatico  BOOLEAN DEFAULT false,

        status          VARCHAR(20) NOT NULL DEFAULT 'ativo',

        created_by_id   VARCHAR,
        updated_by_id   VARCHAR,
        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_emitente_empresa
        ON emitentes_fiscal (tenant_id, empresa_id)
        WHERE status = 'ativo'
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_emitente_cnpj
        ON emitentes_fiscal (cnpj)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. soe_tabelas_preco
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS soe_tabelas_preco (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR NOT NULL,
        empresa_id      INTEGER,

        codigo          VARCHAR(20) NOT NULL,
        nome            VARCHAR(100) NOT NULL,
        descricao       TEXT,

        tipo_cliente    VARCHAR(50),
        canal_venda     VARCHAR(50),

        desconto_perc   NUMERIC(5,2) DEFAULT 0,
        markup_perc     NUMERIC(5,2) DEFAULT 0,

        vigencia_inicio DATE,
        vigencia_fim    DATE,

        tabela_pai_id   VARCHAR REFERENCES soe_tabelas_preco(id),

        padrao          BOOLEAN NOT NULL DEFAULT false,
        status          VARCHAR(20) NOT NULL DEFAULT 'ativo',

        created_by_id   VARCHAR,
        updated_by_id   VARCHAR,
        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_soe_tabela_preco_codigo
        ON soe_tabelas_preco (tenant_id, codigo)
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_soe_tabela_preco_padrao
        ON soe_tabelas_preco (tenant_id)
        WHERE padrao = true AND status = 'ativo'
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 5. soe_tabela_preco_itens
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS soe_tabela_preco_itens (
        id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tabela_preco_id       VARCHAR NOT NULL
                                REFERENCES soe_tabelas_preco(id) ON DELETE CASCADE,
        produto_fiscal_id     VARCHAR REFERENCES produto_fiscal(id),
        product_id            INTEGER,

        preco_unitario        NUMERIC(15,4),
        desconto_perc         NUMERIC(5,2),
        markup_perc           NUMERIC(5,2),

        unidade               VARCHAR(10),
        quantidade_minima     NUMERIC(15,3) DEFAULT 1,

        vigencia_inicio       DATE,
        vigencia_fim          DATE,

        created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tabela_preco_item_pf
        ON soe_tabela_preco_itens (tabela_preco_id, produto_fiscal_id)
        WHERE produto_fiscal_id IS NOT NULL
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tabela_preco_item_legacy
        ON soe_tabela_preco_itens (tabela_preco_id, product_id)
        WHERE product_id IS NOT NULL
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 6. soe_condicoes_pagamento
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS soe_condicoes_pagamento (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR NOT NULL,

        codigo          VARCHAR(20) NOT NULL,
        nome            VARCHAR(100) NOT NULL,
        descricao       TEXT,

        tipo            VARCHAR(30) NOT NULL DEFAULT 'parcelado',
        acrescimo_perc  NUMERIC(5,2) DEFAULT 0,
        desconto_perc   NUMERIC(5,2) DEFAULT 0,
        dias_vencimento INTEGER DEFAULT 0,

        formas_aceitas  VARCHAR[]  DEFAULT ARRAY['01','15','17'],

        padrao          BOOLEAN NOT NULL DEFAULT false,
        status          VARCHAR(20) NOT NULL DEFAULT 'ativo',

        created_by_id   VARCHAR,
        updated_by_id   VARCHAR,
        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_soe_condicao_codigo
        ON soe_condicoes_pagamento (tenant_id, codigo)
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_soe_condicao_padrao
        ON soe_condicoes_pagamento (tenant_id)
        WHERE padrao = true AND status = 'ativo'
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 7. soe_condicao_parcelas
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS soe_condicao_parcelas (
        id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        condicao_pagamento_id VARCHAR NOT NULL
                                REFERENCES soe_condicoes_pagamento(id) ON DELETE CASCADE,
        sequencia             SMALLINT NOT NULL,
        dias                  INTEGER  NOT NULL,
        percentual            NUMERIC(5,2) NOT NULL,
        forma_pagamento       VARCHAR(3),
        descricao             VARCHAR(100),

        UNIQUE (condicao_pagamento_id, sequencia)
      )
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // Atualiza VIEW v_products para enriquecer com produto_fiscal
    // DROP + CREATE porque OR REPLACE não aceita mudança de tipo de coluna
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`DROP VIEW IF EXISTS v_products`);
    await client.query(`
      CREATE VIEW v_products AS
      SELECT
        p.id,
        p.tenant_id,
        p.code,
        p.name,
        p.description,
        p.category,
        p.unit,
        p.cost_price,
        p.sale_price,
        p.stock_qty,
        p.min_stock,
        p.barcode,
        COALESCE(pf.ncm, p.ncm)           AS ncm,
        COALESCE(pf.grupo_tributacao_id,
                 p.tax_group_id)           AS tax_group_id,
        p.status,
        p.image_url,
        p.requires_serial_tracking,
        p.tracking_type,
        p.default_brand,
        p.default_model,
        pf.cest,
        pf.origem,
        pf.id                              AS produto_fiscal_id,
        pf.controla_lote,
        pf.descricao_nfe,
        pf.unidade_tributavel,
        pf.custo_medio,
        pf.estoque_minimo,
        p.created_at,
        p.updated_at
      FROM products p
      LEFT JOIN produto_fiscal pf ON pf.product_id = p.id
    `);

    await client.query("COMMIT");
    console.log("[CAD-01] Migration executada com sucesso.");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[CAD-01] Erro na migration:", err.message);
    throw err;
  } finally {
    client.release();
  }
}
