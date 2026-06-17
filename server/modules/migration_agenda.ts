/**
 * DEC-AGE-01 — migration_agenda.ts
 * Sistema de Agendamento de Instalação com Disponibilidade de Equipe
 */

import { pool } from "../../db/index";

export async function runMigrationAgenda(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_instaladores (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tenant_id       VARCHAR NOT NULL,
        user_id         VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        nome            VARCHAR(100) NOT NULL,
        telefone        VARCHAR(20),
        email           VARCHAR(100),
        foto_url        VARCHAR,
        habilidades     VARCHAR[]  DEFAULT ARRAY['cortina','persiana'],
        regioes         VARCHAR[]  DEFAULT ARRAY[]::VARCHAR[],
        max_instalacoes_dia  SMALLINT NOT NULL DEFAULT 2,
        jornada_inicio  VARCHAR(5) NOT NULL DEFAULT '08:00',
        jornada_fim     VARCHAR(5) NOT NULL DEFAULT '18:00',
        status          VARCHAR(20) NOT NULL DEFAULT 'ativo',
        observacoes     TEXT,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_tenant ON cortiart_instaladores (tenant_id, status)`);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_inst_user
        ON cortiart_instaladores (tenant_id, user_id)
        WHERE user_id IS NOT NULL
    `);
    console.log("[DEC-AGE-01] cortiart_instaladores: OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_agenda_bloqueios (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tenant_id       VARCHAR NOT NULL,
        instalador_id   VARCHAR NOT NULL REFERENCES cortiart_instaladores(id) ON DELETE CASCADE,
        data_inicio     DATE NOT NULL,
        data_fim        DATE NOT NULL,
        tipo            VARCHAR(30) NOT NULL DEFAULT 'folga',
        motivo          VARCHAR(200),
        criado_por_id   VARCHAR REFERENCES users(id),
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bloq_inst_data ON cortiart_agenda_bloqueios (instalador_id, data_inicio, data_fim)`);
    console.log("[DEC-AGE-01] cortiart_agenda_bloqueios: OK");

    await client.query(`
      ALTER TABLE cortiart_os_instalacao
        ADD COLUMN IF NOT EXISTS instalador_id_fk VARCHAR REFERENCES cortiart_instaladores(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS instalador_2_id  VARCHAR REFERENCES cortiart_instaladores(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS duracao_estimada_h NUMERIC(4,1) DEFAULT 4,
        ADD COLUMN IF NOT EXISTS regiao            VARCHAR(100),
        ADD COLUMN IF NOT EXISTS cidade_instalacao VARCHAR(100),
        ADD COLUMN IF NOT EXISTS checklist_ambiente_apto  BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS checklist_produtos_ok    BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS checklist_energia_ok     BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS checklist_limpeza_ok     BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS checklist_fotos_antes    BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS checklist_fotos_depois   BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS foto_antes_url           TEXT,
        ADD COLUMN IF NOT EXISTS foto_depois_url          TEXT,
        ADD COLUMN IF NOT EXISTS confirmado_cliente       BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS confirmado_em            TIMESTAMP,
        ADD COLUMN IF NOT EXISTS whatsapp_enviado         BOOLEAN DEFAULT false
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_osint_inst_fk
        ON cortiart_os_instalacao (instalador_id_fk, data_agendamento)
        WHERE instalador_id_fk IS NOT NULL
    `);
    console.log("[DEC-AGE-01] cortiart_os_instalacao — novos campos: OK");

    await client.query(`
      CREATE OR REPLACE VIEW v_agenda_ocupacao AS
      SELECT
        i.id                           AS instalador_id,
        i.tenant_id,
        i.nome                         AS instalador_nome,
        i.max_instalacoes_dia,
        i.habilidades,
        i.regioes,
        os.data_agendamento            AS data,
        COUNT(os.id)                   AS total_os,
        i.max_instalacoes_dia - COUNT(os.id) AS vagas_restantes,
        CASE
          WHEN COUNT(os.id) >= i.max_instalacoes_dia THEN 'lotado'
          WHEN COUNT(os.id) > 0                      THEN 'parcial'
          ELSE 'livre'
        END                            AS ocupacao,
        EXISTS (
          SELECT 1 FROM cortiart_agenda_bloqueios b
          WHERE b.instalador_id = i.id
            AND os.data_agendamento BETWEEN b.data_inicio AND b.data_fim
        )                              AS bloqueado,
        ARRAY_AGG(
          json_build_object(
            'os_id',    os.id,
            'pedido_id', os.pedido_id,
            'hora',     os.hora_agendamento,
            'status',   os.status,
            'duracao',  COALESCE(os.duracao_estimada_h, 4),
            'cidade',   COALESCE(os.cidade_instalacao, os.endereco_instalacao)
          ) ORDER BY os.hora_agendamento
        )                              AS os_do_dia
      FROM cortiart_instaladores i
      LEFT JOIN cortiart_os_instalacao os
        ON os.instalador_id_fk = i.id
       AND os.status NOT IN ('cancelada', 'concluida')
      WHERE i.status = 'ativo'
      GROUP BY i.id, i.tenant_id, i.nome, i.max_instalacoes_dia,
               i.habilidades, i.regioes, os.data_agendamento
    `);
    console.log("[DEC-AGE-01] v_agenda_ocupacao: OK");

    await client.query("COMMIT");
    console.log("[DEC-AGE-01] ✅ Migration de agenda completa.");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[DEC-AGE-01] ❌ Erro:", err.message);
    throw err;
  } finally {
    client.release();
  }
}
