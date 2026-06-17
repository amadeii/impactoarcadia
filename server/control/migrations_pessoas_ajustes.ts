/**
 * migrations_pessoas_ajustes.ts
 *
 * P1: metadata JSONB em pessoa_papeis (campo já existe — sem DDL extra)
 * P2: tabela pessoa_grupos + FK pessoas.grupo_id
 * P3: campos label + observacao em contatos
 */
import type { PoolClient } from "pg";

export async function runPessoasAjustesMigrations(client: PoolClient): Promise<void> {
  console.log("[migration-pessoas-ajustes] Iniciando...");

  // ── P1: coluna metadata em pessoa_papeis (JSONB) ──────────────────────────
  await client.query(`ALTER TABLE pessoa_papeis ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`).catch(() => {});
  await client.query(`ALTER TABLE pessoa_papeis ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
  console.log("[migration-pessoas-ajustes] pessoa_papeis: metadata + updated_at OK");

  // ── P3: campos label + observacao em contatos ─────────────────────────────
  await client.query(`ALTER TABLE contatos ADD COLUMN IF NOT EXISTS label VARCHAR(60)`).catch(() => {});
  await client.query(`ALTER TABLE contatos ADD COLUMN IF NOT EXISTS observacao TEXT`).catch(() => {});
  console.log("[migration-pessoas-ajustes] contatos: label + observacao OK");

  // ── P2: tabela pessoa_grupos ──────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS pessoa_grupos (
      id        VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id VARCHAR NOT NULL,
      nome      VARCHAR(100) NOT NULL,
      descricao TEXT,
      cor       VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, nome)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_pessoa_grupos_tenant ON pessoa_grupos(tenant_id)`);

  // FK opcional: pessoas.grupo_id aponta para pessoa_grupos
  await client.query(`ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS grupo_id VARCHAR REFERENCES pessoa_grupos(id) ON DELETE SET NULL`).catch(() => {});
  console.log("[migration-pessoas-ajustes] pessoa_grupos + pessoas.grupo_id OK");

  // Seeds básicos (idempotentes) — roda para todos os tenants existentes
  await client.query(`
    INSERT INTO pessoa_grupos (tenant_id, nome, descricao)
    SELECT t.id, g.nome, g.descricao
    FROM (VALUES
      ('Cliente Estratégico', 'Contas-chave com relacionamento de longo prazo'),
      ('Cliente Recorrente',  'Clientes com contratos recorrentes ativos'),
      ('Cliente Eventual',    'Clientes sem contrato ativo'),
      ('Fornecedor Crítico',  'Fornecedor sem substituto imediato'),
      ('Fornecedor Homologado','Fornecedor aprovado no processo de qualificação'),
      ('Prospect',            'Potencial cliente ainda em negociação')
    ) AS g(nome, descricao)
    CROSS JOIN tenants t
    WHERE t.id IS NOT NULL
    ON CONFLICT (tenant_id, nome) DO NOTHING
  `).catch(() => {});

  console.log("[migration-pessoas-ajustes] ✅ OK");
}
