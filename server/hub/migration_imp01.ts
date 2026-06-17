/**
 * HUB-IMP-01 — migration_imp01.ts
 *
 * Extensões na tabela projects para o segmento Impacto Geologia:
 *
 *   projects.codigo_externo  — código IMP (ex: IMP23195, IMP24048)
 *   projects.fase_atual      — fase do ciclo de vida do projeto
 *   projects.checklist_fases — JSON das fases com itens de checklist
 *
 * Tabela nova: project_billing_blockers
 *   Registra eventos que bloqueiam o faturamento (acesso negado ao campo,
 *   cliente não contactado, etc.) com alerta automático ao comercial/financeiro.
 */

import { pool } from "../../db/index";

// Fases do ciclo de vida de projetos de engenharia ambiental
export const FASES_PROJETO = [
  "pre_programacao",    // antes da mobilização
  "programacao",        // equipe e logística definidas
  "campo",              // execução das atividades de campo
  "laboratorio",        // amostras enviadas, aguardando laudos
  "elaboracao_relatorio", // relatório sendo produzido
  "revisao_interna",    // revisão técnica interna
  "entrega_cliente",    // entregue ao cliente para aprovação
  "aprovado",           // aprovado pelo cliente
  "faturado",           // NF emitida
  "concluido",          // processo encerrado
] as const;

export type FaseProjeto = typeof FASES_PROJETO[number];

export async function runMigrationHubImp01(): Promise<{ ok: boolean; log: string[] }> {
  const client = await pool.connect();
  const log: string[] = [];

  try {
    await client.query("BEGIN");

    // ── 1. Campos na tabela projects ─────────────────────────────────────────

    await client.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS codigo_externo   VARCHAR(30),
        ADD COLUMN IF NOT EXISTS fase_atual        VARCHAR(40) DEFAULT 'pre_programacao',
        ADD COLUMN IF NOT EXISTS checklist_fases   JSONB       DEFAULT '{}'::jsonb
    `);
    log.push("✓ ALTER TABLE projects ADD COLUMN codigo_externo + fase_atual + checklist_fases");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_proj_codigo_ext
        ON projects(tenant_id, codigo_externo)
        WHERE codigo_externo IS NOT NULL
    `);
    log.push("✓ INDEX idx_proj_codigo_ext");

    // ── 2. Tabela project_billing_blockers ───────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_billing_blockers (
        id              VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR      NOT NULL,
        project_id      VARCHAR      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tipo            VARCHAR(50)  NOT NULL, -- acesso_negado | cliente_ausente | documentacao_pendente | outro
        descricao       TEXT         NOT NULL,
        impacto_valor   NUMERIC(15,2),         -- valor de faturamento em risco
        data_evento     DATE         NOT NULL DEFAULT CURRENT_DATE,
        status          VARCHAR(20)  NOT NULL DEFAULT 'aberto', -- aberto | resolvido | cancelado
        alertado_em     TIMESTAMP,
        resolvido_em    TIMESTAMP,
        resolvido_por   VARCHAR,
        observacoes     TEXT,
        created_by      VARCHAR,
        created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);
    log.push("✓ TABLE project_billing_blockers");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_blocker_project
        ON project_billing_blockers(project_id, status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_blocker_tenant
        ON project_billing_blockers(tenant_id, status, data_evento DESC)
    `);
    log.push("✓ INDEXES project_billing_blockers");

    // ── 3. Sincroniza codigo_externo em projetos criados via engineering ──────
    // Preenche codigo_externo para projects que já têm um engineering_projects espelho
    await client.query(`
      UPDATE projects p
      SET codigo_externo = ep.numero
      FROM engineering_projects ep
      WHERE ep.hub_project_id = p.id
        AND p.codigo_externo IS NULL
        AND ep.numero IS NOT NULL
    `).catch(() => {}); // ignora se colunas ainda não existirem
    log.push("✓ backfill projects.codigo_externo a partir de engineering_projects.numero");

    await client.query("COMMIT");
    log.push("✓ COMMIT — HUB-IMP-01 concluída");
    return { ok: true, log };

  } catch (err: any) {
    await client.query("ROLLBACK");
    return { ok: false, log: [...log, `✗ ${err.message}`] };
  } finally {
    client.release();
  }
}
