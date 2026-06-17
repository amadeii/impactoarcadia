/**
 * COMP-01 — migration_comp01.ts
 * Módulo Compras do SOE — ciclo completo de entrada de NF-e.
 *
 * TABELAS CRIADAS:
 *   1. purchase_invoice_entries        — cabeçalho da NF-e de entrada
 *   2. purchase_invoice_items          — itens fiscais do XML
 *   3. purchase_invoice_installments   — parcelas/duplicatas (geram AP)
 *   4. purchase_invoice_validation_results — resultado do FiscalValidator
 *   5. purchase_conferences            — conferência física dos itens
 *   6. purchase_conference_items       — itens conferidos vs XML
 *   7. relacao_fiscal_fornecedor       — CFOP/CST padrão por fornecedor
 */

import { pool } from "../../db/index";

export async function runMigrationComp01(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. purchase_invoice_entries — cabeçalho da NF-e de entrada
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoice_entries (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR NOT NULL,
        empresa_id      INTEGER,

        chave_nfe       VARCHAR(44) NOT NULL,
        numero_nfe      INTEGER,
        serie_nfe       VARCHAR(3),
        modelo          VARCHAR(2) DEFAULT '55',

        fornecedor_cnpj      VARCHAR(20) NOT NULL,
        fornecedor_nome      VARCHAR(300),
        fornecedor_pessoa_id VARCHAR REFERENCES pessoas(id) ON DELETE SET NULL,
        fornecedor_uf        VARCHAR(2),
        fornecedor_ie        VARCHAR(30),

        data_emissao        DATE,
        data_saida_entrada  DATE,

        valor_produtos  NUMERIC(15,2) DEFAULT 0,
        valor_frete     NUMERIC(15,2) DEFAULT 0,
        valor_seguro    NUMERIC(15,2) DEFAULT 0,
        valor_desconto  NUMERIC(15,2) DEFAULT 0,
        valor_outros    NUMERIC(15,2) DEFAULT 0,
        valor_ipi       NUMERIC(15,2) DEFAULT 0,
        valor_icms_st   NUMERIC(15,2) DEFAULT 0,
        valor_total     NUMERIC(15,2) NOT NULL DEFAULT 0,

        xml_original    TEXT,

        status          VARCHAR(30) NOT NULL DEFAULT 'importado',

        manifestacao_status     VARCHAR(30) DEFAULT 'pendente',
        manifestacao_em         TIMESTAMP WITH TIME ZONE,
        manifestacao_usuario_id VARCHAR REFERENCES users(id),

        nfe_recebida_id          VARCHAR,
        purchase_order_id        VARCHAR,
        purchase_order_legacy_id INTEGER,

        deposito_destino_id VARCHAR REFERENCES depositos(id),

        aprovado_por_id  VARCHAR REFERENCES users(id),
        aprovado_em      TIMESTAMP WITH TIME ZONE,
        recusado_por_id  VARCHAR REFERENCES users(id),
        recusado_em      TIMESTAMP WITH TIME ZONE,
        motivo_recusa    TEXT,

        importado_por_id VARCHAR REFERENCES users(id),
        created_by_id    VARCHAR REFERENCES users(id),
        updated_by_id    VARCHAR REFERENCES users(id),
        created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_invoice_chave_tenant
        ON purchase_invoice_entries (tenant_id, chave_nfe)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_invoice_status
        ON purchase_invoice_entries (tenant_id, status, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_invoice_fornecedor
        ON purchase_invoice_entries (tenant_id, fornecedor_pessoa_id, data_emissao DESC)
        WHERE fornecedor_pessoa_id IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_invoice_manifestacao
        ON purchase_invoice_entries (tenant_id, manifestacao_status)
        WHERE manifestacao_status = 'pendente'
    `);

    // 2. purchase_invoice_items — itens fiscais do XML
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoice_items (
        id                      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        purchase_invoice_id     VARCHAR NOT NULL
                                  REFERENCES purchase_invoice_entries(id) ON DELETE CASCADE,
        sequencia               SMALLINT NOT NULL,

        produto_fiscal_id       VARCHAR REFERENCES produto_fiscal(id),
        product_id              INTEGER,

        codigo_produto_xml      VARCHAR(60),
        descricao_xml           VARCHAR(120) NOT NULL,
        ncm                     VARCHAR(10),
        cest                    VARCHAR(9),
        cfop                    VARCHAR(4),
        unidade                 VARCHAR(10),
        quantidade              NUMERIC(15,4) NOT NULL,
        valor_unitario          NUMERIC(15,10) NOT NULL,
        valor_desconto          NUMERIC(15,2) DEFAULT 0,
        valor_frete             NUMERIC(15,2) DEFAULT 0,
        valor_outros            NUMERIC(15,2) DEFAULT 0,
        sub_total               NUMERIC(15,2) NOT NULL,

        origem                  SMALLINT DEFAULT 0,
        cst_csosn               VARCHAR(5),
        modalidade_bc_icms      VARCHAR(2),
        perc_red_bc             NUMERIC(5,2) DEFAULT 0,
        base_calc_icms          NUMERIC(15,2) DEFAULT 0,
        perc_icms               NUMERIC(5,2) DEFAULT 0,
        valor_icms              NUMERIC(15,2) DEFAULT 0,

        base_calc_icms_st       NUMERIC(15,2) DEFAULT 0,
        perc_mva_st             NUMERIC(5,2) DEFAULT 0,
        perc_icms_st            NUMERIC(5,2) DEFAULT 0,
        valor_icms_st           NUMERIC(15,2) DEFAULT 0,

        cst_pis                 VARCHAR(3),
        base_calc_pis           NUMERIC(15,2) DEFAULT 0,
        perc_pis                NUMERIC(5,2) DEFAULT 0,
        valor_pis               NUMERIC(15,2) DEFAULT 0,
        cst_cofins              VARCHAR(3),
        base_calc_cofins        NUMERIC(15,2) DEFAULT 0,
        perc_cofins             NUMERIC(5,2) DEFAULT 0,
        valor_cofins            NUMERIC(15,2) DEFAULT 0,

        cst_ipi                 VARCHAR(3),
        c_enq                   VARCHAR(3),
        base_calc_ipi           NUMERIC(15,2) DEFAULT 0,
        perc_ipi                NUMERIC(5,2) DEFAULT 0,
        valor_ipi               NUMERIC(15,2) DEFAULT 0,

        lote                    VARCHAR(50),
        data_validade_lote      DATE,

        inf_ad_prod             TEXT,

        divergencia_quantidade  NUMERIC(15,4) DEFAULT 0,
        divergencia_preco       NUMERIC(15,2) DEFAULT 0,
        tem_divergencia         BOOLEAN GENERATED ALWAYS AS
                                  (ABS(COALESCE(divergencia_quantidade,0)) > 0.001
                                   OR ABS(COALESCE(divergencia_preco,0)) > 0.01) STORED,

        UNIQUE (purchase_invoice_id, sequencia)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pi_item_produto
        ON purchase_invoice_items (produto_fiscal_id)
        WHERE produto_fiscal_id IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pi_item_sem_produto
        ON purchase_invoice_items (purchase_invoice_id)
        WHERE produto_fiscal_id IS NULL AND product_id IS NULL
    `);

    // 3. purchase_invoice_installments — duplicatas/parcelas (geram AP)
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoice_installments (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        purchase_invoice_id VARCHAR NOT NULL
                              REFERENCES purchase_invoice_entries(id) ON DELETE CASCADE,
        numero_duplicata    VARCHAR(20) NOT NULL,
        vencimento          DATE NOT NULL,
        valor               NUMERIC(15,2) NOT NULL,
        status              VARCHAR(20) NOT NULL DEFAULT 'pendente',
        lancamento_pagar_id VARCHAR,
        UNIQUE (purchase_invoice_id, numero_duplicata)
      )
    `);

    // 4. purchase_invoice_validation_results — resultado do FiscalValidator
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoice_validation_results (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        purchase_invoice_id VARCHAR NOT NULL
                              REFERENCES purchase_invoice_entries(id) ON DELETE CASCADE,
        validado_em         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        status              VARCHAR(10) NOT NULL,
        risco               VARCHAR(10) NOT NULL,
        pode_aprovar        BOOLEAN NOT NULL,
        total_erros         INTEGER DEFAULT 0,
        total_alertas       INTEGER DEFAULT 0,
        mensagens           JSONB NOT NULL DEFAULT '[]'
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_piv_invoice
        ON purchase_invoice_validation_results (purchase_invoice_id)
    `);

    // 5. purchase_conferences — conferência física
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_conferences (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           VARCHAR NOT NULL,
        purchase_invoice_id VARCHAR NOT NULL
                              REFERENCES purchase_invoice_entries(id) ON DELETE CASCADE,
        status              VARCHAR(20) NOT NULL DEFAULT 'aberta',
        conferido_por_id    VARCHAR REFERENCES users(id),
        iniciado_em         TIMESTAMP WITH TIME ZONE,
        concluido_em        TIMESTAMP WITH TIME ZONE,
        observacao          TEXT,
        created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    // 6. purchase_conference_items — itens conferidos vs XML
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_conference_items (
        id                       VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        conference_id            VARCHAR NOT NULL
                                   REFERENCES purchase_conferences(id) ON DELETE CASCADE,
        purchase_invoice_item_id VARCHAR NOT NULL
                                   REFERENCES purchase_invoice_items(id),
        qtd_xml                  NUMERIC(15,4) NOT NULL,
        qtd_conferida            NUMERIC(15,4),
        diferenca                NUMERIC(15,4) GENERATED ALWAYS AS
                                   (COALESCE(qtd_conferida,0) - qtd_xml) STORED,
        tem_divergencia          BOOLEAN GENERATED ALWAYS AS
                                   (ABS(COALESCE(qtd_conferida,0) - qtd_xml) > 0.001) STORED,
        observacao               TEXT,
        conferido_em             TIMESTAMP WITH TIME ZONE
      )
    `);

    // 7. relacao_fiscal_fornecedor — CFOP/CST padrão por fornecedor
    await client.query(`
      CREATE TABLE IF NOT EXISTS relacao_fiscal_fornecedor (
        id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            VARCHAR NOT NULL,
        fornecedor_pessoa_id VARCHAR NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,

        cfop_entrada_estadual       VARCHAR(4),
        cfop_entrada_interestadual  VARCHAR(4),
        cst_csosn_entrada           VARCHAR(5),
        cst_pis_entrada             VARCHAR(3),
        cst_cofins_entrada          VARCHAR(3),

        condicao_pagamento_id  VARCHAR REFERENCES soe_condicoes_pagamento(id),
        deposito_destino_id    VARCHAR REFERENCES depositos(id),

        tolerancia_qtd_perc    NUMERIC(5,2) DEFAULT 0,
        tolerancia_preco_perc  NUMERIC(5,2) DEFAULT 0,

        observacao  TEXT,
        created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

        UNIQUE (tenant_id, fornecedor_pessoa_id)
      )
    `);

    await client.query("COMMIT");
    console.log("[COMP-01] Migration executada com sucesso.");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[COMP-01] Erro na migration:", err.message);
    throw err;
  } finally {
    client.release();
  }
}
