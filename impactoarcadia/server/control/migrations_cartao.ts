/**
 * Arcádia Control — Migrações Sprint Cartão Corporativo + Anexos + Workflow
 * Adicionar ao final de runControlMigrations() em server/control/migrations.ts
 *
 * INSTRUÇÃO DE INTEGRAÇÃO:
 *   No arquivo server/control/migrations.ts, dentro de runControlMigrations(),
 *   adicione a chamada: await runCartaoMigrations(client);
 *   E importe: import { runCartaoMigrations } from "./migrations_cartao";
 */

import type { PoolClient } from "pg";

export async function runCartaoMigrations(client: PoolClient): Promise<void> {
  console.log("[migration-cartao] Iniciando migrações de cartão corporativo...");

  // ─────────────────────────────────────────────────────────────────────────
  // 1. CARTÕES CORPORATIVOS
  // ─────────────────────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS cartoes_corporativos (
      id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id       VARCHAR NOT NULL,
      cliente_id      VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      nome            VARCHAR(200) NOT NULL,
      bandeira        VARCHAR(50),
      ultimos_digitos VARCHAR(4),
      limite          NUMERIC(15,2),
      conta_bancaria_id VARCHAR REFERENCES contas_bancarias(id) ON DELETE SET NULL,
      portadores      TEXT[],
      observacoes     TEXT,
      status          VARCHAR(20) NOT NULL DEFAULT 'ativo',
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_cartoes_tenant_cliente ON cartoes_corporativos(tenant_id, cliente_id)`);
  console.log("[migration-cartao] cartoes_corporativos: OK");

  // ─────────────────────────────────────────────────────────────────────────
  // 2. FATURAS DO CARTÃO
  // ─────────────────────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS faturas_cartao (
      id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id           VARCHAR NOT NULL,
      cliente_id          VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      cartao_id           VARCHAR NOT NULL REFERENCES cartoes_corporativos(id) ON DELETE CASCADE,
      competencia         VARCHAR(7) NOT NULL,
      vencimento          DATE NOT NULL,
      valor_total         NUMERIC(15,2) NOT NULL DEFAULT 0,
      status              VARCHAR(20) NOT NULL DEFAULT 'aberta',
      lancamento_ap_id    VARCHAR REFERENCES lancamentos_financeiros(id) ON DELETE SET NULL,
      observacoes         TEXT,
      created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cartao_id, competencia)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_faturas_tenant_cliente ON faturas_cartao(tenant_id, cliente_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_faturas_cartao ON faturas_cartao(cartao_id, competencia)`);
  console.log("[migration-cartao] faturas_cartao: OK");

  // ─────────────────────────────────────────────────────────────────────────
  // 3. TRANSAÇÕES DO CARTÃO
  // ─────────────────────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS transacoes_cartao (
      id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id           VARCHAR NOT NULL,
      fatura_id           VARCHAR NOT NULL REFERENCES faturas_cartao(id) ON DELETE CASCADE,
      portador            VARCHAR(200),
      estabelecimento     VARCHAR(300),
      data_transacao      TIMESTAMP NOT NULL,
      valor               NUMERIC(15,2) NOT NULL,
      tipo_transacao      VARCHAR(30) NOT NULL DEFAULT 'compra',
      mcc                 VARCHAR(10),
      categoria_mcc       VARCHAR(100),
      status_transacao    VARCHAR(30) NOT NULL DEFAULT 'pendente',
      plano_conta_id      VARCHAR REFERENCES planos_contas(id) ON DELETE SET NULL,
      centro_custo_id     VARCHAR REFERENCES centros_custo(id) ON DELETE SET NULL,
      observacoes         TEXT,
      origem              VARCHAR(20) NOT NULL DEFAULT 'manual',
      created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_transacoes_fatura ON transacoes_cartao(fatura_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_transacoes_tenant ON transacoes_cartao(tenant_id)`);
  console.log("[migration-cartao] transacoes_cartao: OK");

  // ─────────────────────────────────────────────────────────────────────────
  // 4. ANEXOS DE LANÇAMENTOS
  // ─────────────────────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS lancamento_anexos (
      id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id           VARCHAR NOT NULL,
      lancamento_id       VARCHAR NOT NULL REFERENCES lancamentos_financeiros(id) ON DELETE CASCADE,
      tipo                VARCHAR(30) NOT NULL DEFAULT 'documento',
      nome_arquivo        VARCHAR(500) NOT NULL,
      url_storage         TEXT NOT NULL,
      tamanho_bytes       INTEGER,
      mime_type           VARCHAR(100),
      uploaded_por        VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_anexos_lancamento ON lancamento_anexos(lancamento_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_anexos_tenant ON lancamento_anexos(tenant_id)`);
  console.log("[migration-cartao] lancamento_anexos: OK");

  // ─────────────────────────────────────────────────────────────────────────
  // 5. CAMPOS DE WORKFLOW EM lancamentos_financeiros
  // ─────────────────────────────────────────────────────────────────────────
  await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(20)`).catch(() => {});
  await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS programado_por VARCHAR REFERENCES users(id) ON DELETE SET NULL`).catch(() => {});
  await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS data_programacao TIMESTAMP`).catch(() => {});
  await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS autorizado_por VARCHAR REFERENCES users(id) ON DELETE SET NULL`).catch(() => {});
  await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS data_autorizacao TIMESTAMP`).catch(() => {});
  await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS pago_por VARCHAR REFERENCES users(id) ON DELETE SET NULL`).catch(() => {});
  await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS data_pagamento_efetuado TIMESTAMP`).catch(() => {});
  await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS conciliado_por VARCHAR REFERENCES users(id) ON DELETE SET NULL`).catch(() => {});
  await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS data_conciliacao_workflow TIMESTAMP`).catch(() => {});
  await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS comprovante_pagamento TEXT`).catch(() => {});
  console.log("[migration-cartao] lancamentos_financeiros workflow cols: OK");

  // ─────────────────────────────────────────────────────────────────────────
  // 6. LOTES DE PAGAMENTO (para marcar N lançamentos como pago de uma vez)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS lotes_pagamento (
      id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id       VARCHAR NOT NULL,
      cliente_id      VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      descricao       VARCHAR(500),
      data_pagamento  DATE NOT NULL,
      total_valor     NUMERIC(15,2) NOT NULL DEFAULT 0,
      qtd_lancamentos INTEGER NOT NULL DEFAULT 0,
      pago_por        VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      comprovante_url TEXT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lotes_tenant_cliente ON lotes_pagamento(tenant_id, cliente_id)`);
  await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS lote_pagamento_id VARCHAR REFERENCES lotes_pagamento(id) ON DELETE SET NULL`).catch(() => {});
  console.log("[migration-cartao] lotes_pagamento: OK");

  console.log("[migration-cartao] ✅ Migrações de cartão concluídas com sucesso");
}
