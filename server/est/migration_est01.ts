/**
 * EST-01 — migration_est01.ts
 * Estoque Core do SOE — tabelas centrais de controle de estoque.
 *
 * DECISÃO ARQUITETURAL (Parecer Manus §5.4):
 *   - saldos_produto tem 3 campos distintos: quantidade_fisica, quantidade_reservada, quantidade_disponivel
 *   - inventory_movements_core é IMUTÁVEL (append-only) — apenas movimentos físicos reais
 *   - Reservas NÃO geram movimento no livro físico — só alteram quantidade_reservada em saldos_produto
 *   - inventory_reservations controla o ciclo reserva → saída
 *
 * RELAÇÃO COM TABELAS RETAIL EXISTENTES:
 *   - retailWarehouseStock  → saldos lidos via VIEW v_warehouse_stock_compat (compat legado)
 *   - retailStockMovements  → continuam funcionando para o Retail
 *   - retailWarehouses      → mapeados para depositos via deposito_retail_id
 *
 * TABELAS CRIADAS:
 *   1. depositos                — depósitos físicos e virtuais
 *   2. saldos_produto           — saldo físico/reservado/disponível por produto×depósito×lote
 *   3. inventory_movements_core — livro imutável de movimentos físicos
 *   4. inventory_lots           — lotes com validade, fornecedor e NF-e de origem
 *   5. inventory_reservations   — reservas pendentes por pedido de venda
 */

import { pool } from "../../db/index";

export async function runMigrationEst01(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ─────────────────────────────────────────────────────────────────────────
    // 1. depositos
    // Substitui retailWarehouses como entidade central.
    // retailWarehouses é mantido — deposito_retail_id faz o vínculo.
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS depositos (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR NOT NULL,
        empresa_id      INTEGER,

        codigo          VARCHAR(20) NOT NULL,
        nome            VARCHAR(200) NOT NULL,
        descricao       TEXT,

        tipo            VARCHAR(30) NOT NULL DEFAULT 'fisico',

        logradouro      VARCHAR(200),
        cidade          VARCHAR(100),
        uf              VARCHAR(2),

        permite_estoque_negativo  BOOLEAN NOT NULL DEFAULT false,
        visivel_todos_empresas    BOOLEAN NOT NULL DEFAULT true,
        padrao                    BOOLEAN NOT NULL DEFAULT false,

        responsavel_id  VARCHAR REFERENCES users(id),

        deposito_retail_id  INTEGER,

        status          VARCHAR(20) NOT NULL DEFAULT 'ativo',

        created_by_id   VARCHAR REFERENCES users(id),
        updated_by_id   VARCHAR REFERENCES users(id),
        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_deposito_tenant_codigo
        ON depositos (tenant_id, codigo)
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_deposito_padrao
        ON depositos (tenant_id)
        WHERE padrao = true AND status = 'ativo'
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. inventory_lots — lotes com rastreabilidade completa
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_lots (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           VARCHAR NOT NULL,
        produto_fiscal_id   VARCHAR NOT NULL REFERENCES produto_fiscal(id),
        deposito_id         VARCHAR REFERENCES depositos(id),

        numero_lote         VARCHAR(50) NOT NULL,
        data_fabricacao     DATE,
        data_validade       DATE,

        fornecedor_pessoa_id    VARCHAR REFERENCES pessoas(id),
        purchase_invoice_id     VARCHAR,
        chave_nfe_origem        VARCHAR(44),
        numero_nfe_origem       INTEGER,

        quantidade_entrada  NUMERIC(15,3) NOT NULL DEFAULT 0,
        quantidade_saida    NUMERIC(15,3) NOT NULL DEFAULT 0,
        saldo_lote          NUMERIC(15,3) GENERATED ALWAYS AS
                              (quantidade_entrada - quantidade_saida) STORED,

        status              VARCHAR(20) NOT NULL DEFAULT 'ativo',

        observacao          TEXT,

        created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

        UNIQUE (tenant_id, produto_fiscal_id, numero_lote)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lot_validade
        ON inventory_lots (data_validade)
        WHERE data_validade IS NOT NULL AND status = 'ativo'
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lot_produto
        ON inventory_lots (tenant_id, produto_fiscal_id, status)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. saldos_produto — posição atual de estoque (UPSERT a cada movimento)
    //
    // Decisão Manus §5.4: 3 campos separados:
    //   quantidade_fisica    = estoque real (só alterado por movimentos físicos)
    //   quantidade_reservada = reservas de pedidos confirmados (sem NF-e ainda)
    //   quantidade_disponivel = calculado: fisica - reservada
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS saldos_produto (
        id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             VARCHAR NOT NULL,
        deposito_id           VARCHAR NOT NULL REFERENCES depositos(id),
        produto_fiscal_id     VARCHAR REFERENCES produto_fiscal(id),
        product_id            INTEGER,
        lot_id                VARCHAR REFERENCES inventory_lots(id),

        quantidade_fisica     NUMERIC(15,3) NOT NULL DEFAULT 0,
        quantidade_reservada  NUMERIC(15,3) NOT NULL DEFAULT 0,
        quantidade_disponivel NUMERIC(15,3) GENERATED ALWAYS AS
                                (quantidade_fisica - quantidade_reservada) STORED,

        custo_medio           NUMERIC(15,4) DEFAULT 0,
        valor_total_estoque   NUMERIC(15,2) GENERATED ALWAYS AS
                                (quantidade_fisica * custo_medio) STORED,

        last_movement_at      TIMESTAMP WITH TIME ZONE,
        last_inventory_at     TIMESTAMP WITH TIME ZONE,

        updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_saldo_deposito_pf_lot
        ON saldos_produto (deposito_id, produto_fiscal_id, COALESCE(lot_id, ''))
        WHERE produto_fiscal_id IS NOT NULL
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_saldo_deposito_product_legacy
        ON saldos_produto (deposito_id, product_id)
        WHERE product_id IS NOT NULL AND produto_fiscal_id IS NULL AND lot_id IS NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_saldo_tenant_produto
        ON saldos_produto (tenant_id, produto_fiscal_id)
        WHERE produto_fiscal_id IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_saldo_baixo
        ON saldos_produto (tenant_id, quantidade_disponivel)
        WHERE quantidade_disponivel < 5
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. inventory_movements_core — livro imutável de movimentos físicos
    //
    // REGRA: NUNCA UPDATE, NUNCA DELETE. Somente INSERT.
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements_core (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR NOT NULL,
        deposito_id     VARCHAR NOT NULL REFERENCES depositos(id),
        produto_fiscal_id VARCHAR REFERENCES produto_fiscal(id),
        product_id      INTEGER,
        lot_id          VARCHAR REFERENCES inventory_lots(id),

        tipo_movimento  VARCHAR(40) NOT NULL,

        origem_tipo     VARCHAR(50),
        origem_ref_id   VARCHAR(100),

        quantidade      NUMERIC(15,3) NOT NULL,
        custo_unitario  NUMERIC(15,4),
        custo_total     NUMERIC(15,2) GENERATED ALWAYS AS
                          (ABS(quantidade) * COALESCE(custo_unitario, 0)) STORED,

        saldo_anterior  NUMERIC(15,3),
        saldo_posterior NUMERIC(15,3),

        documento_numero  VARCHAR(50),
        documento_chave   VARCHAR(44),

        criado_por_id   VARCHAR REFERENCES users(id),
        justificativa   TEXT,

        inventory_id    VARCHAR,

        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mov_tenant_produto
        ON inventory_movements_core (tenant_id, produto_fiscal_id, created_at DESC)
        WHERE produto_fiscal_id IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mov_deposito_data
        ON inventory_movements_core (deposito_id, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mov_origem
        ON inventory_movements_core (origem_tipo, origem_ref_id)
        WHERE origem_ref_id IS NOT NULL
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 5. inventory_reservations — reservas por pedido (não são movimentos físicos)
    //
    // Ciclo: sale_order.confirmed → reserva criada (saldo_reservado++)
    //        sale_order.invoiced  → reserva convertida em movimento saida_venda
    //        sale_order.cancelled → reserva cancelada (saldo_reservado--)
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_reservations (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           VARCHAR NOT NULL,
        deposito_id         VARCHAR NOT NULL REFERENCES depositos(id),
        produto_fiscal_id   VARCHAR REFERENCES produto_fiscal(id),
        product_id          INTEGER,
        lot_id              VARCHAR REFERENCES inventory_lots(id),

        sale_order_id       VARCHAR NOT NULL,
        sale_order_item_id  VARCHAR,

        quantidade          NUMERIC(15,3) NOT NULL,

        status              VARCHAR(20) NOT NULL DEFAULT 'ativa',

        reservado_em        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        convertido_em       TIMESTAMP WITH TIME ZONE,
        cancelado_em        TIMESTAMP WITH TIME ZONE,

        movement_id         VARCHAR REFERENCES inventory_movements_core(id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reserva_order
        ON inventory_reservations (sale_order_id, status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reserva_produto
        ON inventory_reservations (tenant_id, produto_fiscal_id, status)
        WHERE status = 'ativa'
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 6. est_inventarios — inventários periódicos
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS est_inventarios (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR NOT NULL,
        deposito_id     VARCHAR NOT NULL REFERENCES depositos(id),

        numero          VARCHAR(30) NOT NULL,
        tipo            VARCHAR(20) NOT NULL DEFAULT 'completo',
        status          VARCHAR(20) NOT NULL DEFAULT 'aberto',

        iniciado_em     TIMESTAMP WITH TIME ZONE,
        concluido_em    TIMESTAMP WITH TIME ZONE,
        observacao      TEXT,

        criado_por_id    VARCHAR REFERENCES users(id),
        concluido_por_id VARCHAR REFERENCES users(id),

        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS est_inventario_itens (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        inventario_id       VARCHAR NOT NULL REFERENCES est_inventarios(id) ON DELETE CASCADE,
        produto_fiscal_id   VARCHAR REFERENCES produto_fiscal(id),
        product_id          INTEGER,
        lot_id              VARCHAR REFERENCES inventory_lots(id),

        quantidade_sistema  NUMERIC(15,3),
        quantidade_contada  NUMERIC(15,3),
        diferenca           NUMERIC(15,3) GENERATED ALWAYS AS
                              (COALESCE(quantidade_contada,0) - COALESCE(quantidade_sistema,0)) STORED,

        ajuste_aplicado     BOOLEAN NOT NULL DEFAULT false,
        contado_por_id      VARCHAR REFERENCES users(id),
        contado_em          TIMESTAMP WITH TIME ZONE,
        observacao          TEXT
      )
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW v_saldo_consolidado — saldo total por produto (todos os depósitos)
    // ─────────────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE VIEW v_saldo_consolidado AS
      SELECT
        s.tenant_id,
        COALESCE(s.produto_fiscal_id::text, s.product_id::text) AS produto_key,
        s.produto_fiscal_id,
        s.product_id,
        COALESCE(pf.codigo, p.code)        AS produto_codigo,
        COALESCE(pf.descricao, p.name)     AS produto_descricao,
        COALESCE(pf.unidade, p.unit)       AS unidade,
        SUM(s.quantidade_fisica)           AS total_fisico,
        SUM(s.quantidade_reservada)        AS total_reservado,
        SUM(s.quantidade_disponivel)       AS total_disponivel,
        AVG(s.custo_medio)                 AS custo_medio,
        SUM(s.valor_total_estoque)         AS valor_total,
        COALESCE(pf.estoque_minimo,
                 p.min_stock::numeric, 0)  AS estoque_minimo,
        MAX(s.last_movement_at)            AS ultimo_movimento
      FROM saldos_produto s
      LEFT JOIN produto_fiscal pf ON pf.id = s.produto_fiscal_id
      LEFT JOIN products p        ON p.id  = s.product_id
      GROUP BY
        s.tenant_id,
        COALESCE(s.produto_fiscal_id::text, s.product_id::text),
        s.produto_fiscal_id, s.product_id,
        pf.codigo, p.code, pf.descricao, p.name,
        pf.unidade, p.unit, pf.estoque_minimo, p.min_stock
    `);

    await client.query("COMMIT");
    console.log("[EST-01] Migration executada com sucesso.");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[EST-01] Erro na migration:", err.message);
    throw err;
  } finally {
    client.release();
  }
}
