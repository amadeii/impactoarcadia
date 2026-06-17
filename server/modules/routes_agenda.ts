/**
 * DEC-AGE-01 — routes_agenda.ts
 * Endpoints do sistema de agendamento de instalação.
 */

import { Router } from "express";
import pg from "pg";
import crypto from "crypto";
import { runMigrationAgenda } from "./migration_agenda";
import { runSeedInstaladores } from "./seed_instaladores";

function getPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}
function getTenantId(req: any): string {
  return req.session?.tenantId?.toString() ?? "1";
}
function newId(): string {
  return crypto.randomUUID();
}

export function registerAgendaRoutes(router: Router): void {

  router.post("/admin/migrate-agenda", async (req, res) => {
    try {
      await runMigrationAgenda();
      res.json({ ok: true, message: "DEC-AGE-01 migration executada." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/admin/seed-agenda", async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const result = await runSeedInstaladores(tenantId);
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Instaladores ──────────────────────────────────────────────────────────

  router.get("/instaladores", async (req, res) => {
    const pool = getPool();
    try {
      const tenantId = getTenantId(req);
      const { status = "ativo", habilidade } = req.query as Record<string, string>;

      let q = `
        SELECT i.*,
               u.username AS user_login,
               COUNT(os.id) FILTER (
                 WHERE os.data_agendamento >= CURRENT_DATE
                   AND os.status NOT IN ('cancelada','concluida')
               ) AS os_proximos_7_dias
        FROM cortiart_instaladores i
        LEFT JOIN users u ON u.id = i.user_id
        LEFT JOIN cortiart_os_instalacao os ON os.instalador_id_fk = i.id
        WHERE i.tenant_id = $1`;
      const params: any[] = [tenantId];
      if (status) { q += ` AND i.status = $${params.push(status)}`; }
      if (habilidade) { q += ` AND $${params.push(habilidade)} = ANY(i.habilidades)`; }
      q += ` GROUP BY i.id, u.username ORDER BY i.nome`;

      const { rows } = await pool.query(q, params);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  router.post("/instaladores", async (req, res) => {
    const pool = getPool();
    try {
      const tenantId = getTenantId(req);
      const { userId, nome, telefone, email, fotoUrl, habilidades, regioes, maxInstalacoesDia, jornadaInicio, jornadaFim, observacoes } = req.body;
      if (!nome) return res.status(400).json({ error: "nome é obrigatório" });

      const { rows } = await pool.query(
        `INSERT INTO cortiart_instaladores
           (id, tenant_id, user_id, nome, telefone, email, foto_url,
            habilidades, regioes, max_instalacoes_dia, jornada_inicio, jornada_fim, observacoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [newId(), tenantId, userId ?? null, nome, telefone ?? null, email ?? null, fotoUrl ?? null,
         habilidades ?? ['cortina', 'persiana'], regioes ?? [],
         maxInstalacoesDia ?? 2, jornadaInicio ?? '08:00', jornadaFim ?? '18:00', observacoes ?? null]
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  router.patch("/instaladores/:id", async (req, res) => {
    const pool = getPool();
    try {
      const tenantId = getTenantId(req);
      const allowed = ["nome","telefone","email","foto_url","habilidades","regioes","max_instalacoes_dia","jornada_inicio","jornada_fim","status","observacoes"];
      const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));
      if (!entries.length) return res.status(400).json({ error: "Nada a atualizar" });
      const updates = entries.map(([k], i) => `${k} = $${i + 3}`).join(", ");
      const values = entries.map(([, v]) => v);
      const { rows } = await pool.query(
        `UPDATE cortiart_instaladores SET ${updates}, updated_at=NOW() WHERE id=$1 AND tenant_id=$2 RETURNING *`,
        [req.params.id, tenantId, ...values]
      );
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  router.get("/instaladores/:id/bloqueios", async (req, res) => {
    const pool = getPool();
    try {
      const { rows } = await pool.query(
        `SELECT * FROM cortiart_agenda_bloqueios WHERE instalador_id = $1 AND data_fim >= CURRENT_DATE ORDER BY data_inicio`,
        [req.params.id]
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  router.post("/instaladores/:id/bloqueios", async (req, res) => {
    const pool = getPool();
    try {
      const tenantId = getTenantId(req);
      const { dataInicio, dataFim, tipo, motivo } = req.body;
      if (!dataInicio) return res.status(400).json({ error: "dataInicio é obrigatório" });
      const { rows } = await pool.query(
        `INSERT INTO cortiart_agenda_bloqueios (id, tenant_id, instalador_id, data_inicio, data_fim, tipo, motivo)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [newId(), tenantId, req.params.id, dataInicio, dataFim ?? dataInicio, tipo ?? 'folga', motivo ?? null]
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  router.delete("/instaladores/:id/bloqueios/:bid", async (req, res) => {
    const pool = getPool();
    try {
      await pool.query(
        `DELETE FROM cortiart_agenda_bloqueios WHERE id = $1 AND instalador_id = $2`,
        [req.params.bid, req.params.id]
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  // ── Disponibilidade ───────────────────────────────────────────────────────

  router.get("/agenda/disponibilidade", async (req, res) => {
    const pool = getPool();
    try {
      const tenantId = getTenantId(req);
      const { dataInicio, dataFim, habilidade, regiao } = req.query as Record<string, string>;
      const inicio = dataInicio ?? new Date().toISOString().split("T")[0];
      const fim    = dataFim ?? (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })();

      const params: any[] = [inicio, fim, tenantId];
      let habFilter = "";
      let regFilter = "";
      if (habilidade) { params.push(habilidade); habFilter = `AND $${params.length} = ANY(i.habilidades)`; }
      if (regiao)     { params.push(regiao);      regFilter = `AND $${params.length} = ANY(i.regioes)`; }

      const q = `
        WITH serie AS (
          SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS data
        ),
        instaladores_ativos AS (
          SELECT i.* FROM cortiart_instaladores i
          WHERE i.tenant_id = $3 AND i.status = 'ativo' ${habFilter} ${regFilter}
        ),
        ocupacao AS (
          SELECT os.instalador_id_fk, os.data_agendamento::date AS data, COUNT(*) AS total_os,
            ARRAY_AGG(json_build_object(
              'os_id', os.id, 'pedido_id', os.pedido_id,
              'hora', os.hora_agendamento, 'status', os.status,
              'duracao', COALESCE(os.duracao_estimada_h, 4),
              'cidade', COALESCE(os.cidade_instalacao, os.endereco_instalacao)
            ) ORDER BY os.hora_agendamento) AS os_do_dia
          FROM cortiart_os_instalacao os
          WHERE os.instalador_id_fk IS NOT NULL AND os.status NOT IN ('cancelada','concluida')
            AND os.data_agendamento BETWEEN $1::date AND $2::date
          GROUP BY os.instalador_id_fk, os.data_agendamento::date
        ),
        bloqueios AS (
          SELECT b.instalador_id, b.data_inicio, b.data_fim
          FROM cortiart_agenda_bloqueios b
          WHERE b.data_fim >= $1::date AND b.data_inicio <= $2::date
        )
        SELECT s.data, i.id AS instalador_id, i.nome AS instalador_nome,
          i.habilidades, i.regioes, i.max_instalacoes_dia,
          COALESCE(o.total_os, 0) AS total_os,
          GREATEST(0, i.max_instalacoes_dia - COALESCE(o.total_os, 0)) AS vagas_restantes,
          CASE
            WHEN EXISTS (SELECT 1 FROM bloqueios bl WHERE bl.instalador_id = i.id
                         AND s.data BETWEEN bl.data_inicio AND bl.data_fim) THEN 'bloqueado'
            WHEN COALESCE(o.total_os, 0) >= i.max_instalacoes_dia THEN 'lotado'
            WHEN COALESCE(o.total_os, 0) > 0 THEN 'parcial'
            ELSE 'livre'
          END AS ocupacao,
          COALESCE(o.os_do_dia, '{}') AS os_do_dia
        FROM serie s
        CROSS JOIN instaladores_ativos i
        LEFT JOIN ocupacao o ON o.instalador_id = i.id AND o.data = s.data
        ORDER BY s.data, i.nome`;

      const { rows } = await pool.query(q, params);
      const porData: Record<string, any[]> = {};
      for (const row of rows) {
        const d = row.data instanceof Date ? row.data.toISOString().split("T")[0] : String(row.data).split("T")[0];
        if (!porData[d]) porData[d] = [];
        porData[d].push(row);
      }
      res.json({ ok: true, data: porData, total_dias: Object.keys(porData).length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  router.get("/agenda/semanal", async (req, res) => {
    const pool = getPool();
    try {
      const tenantId = getTenantId(req);
      const { dataInicio } = req.query as Record<string, string>;
      const inicio = dataInicio ?? new Date().toISOString().split("T")[0];
      const fim = (() => {
        const d = new Date(inicio + "T12:00:00");
        d.setDate(d.getDate() + 6);
        return d.toISOString().split("T")[0];
      })();

      const { rows } = await pool.query(
        `SELECT os.*, i.nome AS instalador_nome, i.habilidades AS instalador_habilidades,
                i2.nome AS instalador_2_nome,
                p.numero_pedido, p.cliente_nome, p.endereco_obra, p.cidade_obra,
                p.torre, p.apartamento, p.valor_final,
                (SELECT ARRAY_AGG(DISTINCT tipo_produto) FROM cortiart_itens_pedido WHERE pedido_id = p.id) AS tipos_produto
         FROM cortiart_os_instalacao os
         JOIN cortiart_pedidos p ON p.id = os.pedido_id
         LEFT JOIN cortiart_instaladores i  ON i.id  = os.instalador_id_fk
         LEFT JOIN cortiart_instaladores i2 ON i2.id = os.instalador_2_id
         WHERE p.tenant_id = $1 AND os.data_agendamento BETWEEN $2 AND $3
           AND os.status NOT IN ('cancelada')
         ORDER BY os.data_agendamento, os.hora_agendamento, i.nome`,
        [tenantId, inicio, fim]
      );
      res.json({ ok: true, data: rows, periodo: { inicio, fim } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  router.get("/agenda/mensal", async (req, res) => {
    const pool = getPool();
    try {
      const tenantId = getTenantId(req);
      const hoje = new Date();
      const ano = parseInt((req.query.ano as string) ?? String(hoje.getFullYear()));
      const mes = parseInt((req.query.mes as string) ?? String(hoje.getMonth() + 1));
      const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const fim    = new Date(ano, mes, 0).toISOString().split("T")[0];

      const { rows } = await pool.query(
        `SELECT os.data_agendamento::date AS data, COUNT(os.id) AS total_os,
                COUNT(DISTINCT os.instalador_id_fk) AS instaladores_alocados,
                ARRAY_AGG(DISTINCT os.status) AS statuses
         FROM cortiart_os_instalacao os
         JOIN cortiart_pedidos p ON p.id = os.pedido_id
         WHERE p.tenant_id = $1 AND os.data_agendamento BETWEEN $2 AND $3
           AND os.status NOT IN ('cancelada')
         GROUP BY os.data_agendamento::date ORDER BY data`,
        [tenantId, inicio, fim]
      );
      res.json({ ok: true, data: rows, ano, mes });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  // ── Agendar com validação ─────────────────────────────────────────────────

  router.post("/pedidos/:id/os-instalacao/agendar", async (req, res) => {
    const pool = getPool();
    try {
      const tenantId = getTenantId(req);
      const { instaladorId, instalador2Id, data, hora, duracaoH = 4, cidadeInstalacao, regiao, observacoes, forcarAgendamento = false } = req.body;
      if (!data) return res.status(400).json({ error: "data é obrigatório" });

      const pedidoRes = await pool.query(
        `SELECT * FROM cortiart_pedidos WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]
      );
      if (!pedidoRes.rows[0]) return res.status(404).json({ error: "Pedido não encontrado" });
      const pedido = pedidoRes.rows[0];

      if (instaladorId && !forcarAgendamento) {
        const { rows: bloq } = await pool.query(
          `SELECT 1 FROM cortiart_agenda_bloqueios
           WHERE instalador_id = $1 AND $2::date BETWEEN data_inicio AND data_fim`,
          [instaladorId, data]
        );
        if (bloq.length > 0) {
          return res.status(409).json({ ok: false, conflito: "bloqueio", mensagem: "Instalador está bloqueado nesta data (férias/folga)." });
        }
        const { rows: inst } = await pool.query(
          `SELECT i.max_instalacoes_dia, COUNT(os.id) AS total_os
           FROM cortiart_instaladores i
           LEFT JOIN cortiart_os_instalacao os
             ON os.instalador_id_fk = i.id AND os.data_agendamento::date = $2::date
             AND os.status NOT IN ('cancelada','concluida')
           WHERE i.id = $1 GROUP BY i.max_instalacoes_dia`,
          [instaladorId, data]
        );
        if (inst[0] && parseInt(inst[0].total_os) >= parseInt(inst[0].max_instalacoes_dia)) {
          return res.status(409).json({
            ok: false, conflito: "lotado", podeForcar: true,
            mensagem: `Instalador já tem ${inst[0].total_os} OS neste dia (máx: ${inst[0].max_instalacoes_dia}).`,
          });
        }
      }

      const osExistente = await pool.query(
        `SELECT id FROM cortiart_os_instalacao WHERE pedido_id = $1 AND status NOT IN ('cancelada','concluida') LIMIT 1`,
        [req.params.id]
      );

      let osId: string;
      if (osExistente.rows[0]) {
        osId = osExistente.rows[0].id;
        await pool.query(
          `UPDATE cortiart_os_instalacao
           SET instalador_id_fk=$2, instalador_2_id=$3, data_agendamento=$4,
               hora_agendamento=$5, duracao_estimada_h=$6, cidade_instalacao=$7,
               regiao=$8, endereco_instalacao=COALESCE($9, endereco_instalacao),
               observacoes=COALESCE($10, observacoes), status='agendada', updated_at=NOW()
           WHERE id = $1`,
          [osId, instaladorId ?? null, instalador2Id ?? null, data, hora ?? '08:00', duracaoH,
           cidadeInstalacao ?? pedido.cidade_obra ?? null, regiao ?? null,
           pedido.endereco_obra ?? null, observacoes ?? null]
        );
      } else {
        osId = newId();
        await pool.query(
          `INSERT INTO cortiart_os_instalacao
             (id, pedido_id, tenant_id, instalador_id_fk, instalador_2_id,
              data_agendamento, hora_agendamento, duracao_estimada_h,
              cidade_instalacao, regiao, endereco_instalacao, observacoes, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'agendada')`,
          [osId, req.params.id, tenantId, instaladorId ?? null, instalador2Id ?? null,
           data, hora ?? '08:00', duracaoH, cidadeInstalacao ?? pedido.cidade_obra ?? null,
           regiao ?? null, pedido.endereco_obra ?? null, observacoes ?? null]
        );
      }

      await pool.query(
        `UPDATE cortiart_pedidos
         SET status = CASE WHEN status IN ('efetivado','producao') THEN 'instalacao' ELSE status END,
             data_instalacao = $2, horario_instalacao = $3, updated_at = NOW()
         WHERE id = $1`,
        [req.params.id, data, hora ?? 'A COMBINAR']
      );
      await pool.query(
        `UPDATE cortiart_checklist SET instalacao_agendada = true, updated_at = NOW() WHERE pedido_id = $1`,
        [req.params.id]
      ).catch(() => {});

      const { rows: [os] } = await pool.query(
        `SELECT os.*, i.nome AS instalador_nome FROM cortiart_os_instalacao os
         LEFT JOIN cortiart_instaladores i ON i.id = os.instalador_id_fk WHERE os.id = $1`,
        [osId]
      );
      res.status(201).json({ ok: true, data: os });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  router.patch("/pedidos/:id/os-instalacao/:osId/checklist", async (req, res) => {
    const pool = getPool();
    try {
      const campos = [
        "checklist_ambiente_apto","checklist_produtos_ok","checklist_energia_ok",
        "checklist_limpeza_ok","checklist_fotos_antes","checklist_fotos_depois",
        "confirmado_cliente","foto_antes_url","foto_depois_url","whatsapp_enviado",
      ];
      const entries = campos.filter(f => req.body[f] !== undefined);
      if (!entries.length) return res.status(400).json({ error: "Nada a atualizar" });
      const updates = entries.map((f, i) => `${f} = $${i + 2}`).join(", ");
      const values  = entries.map(f => req.body[f]);
      const extra   = req.body.confirmado_cliente === true ? ", confirmado_em = NOW()" : "";
      const { rows } = await pool.query(
        `UPDATE cortiart_os_instalacao SET ${updates}${extra}, updated_at=NOW()
         WHERE id = $1 AND pedido_id = $2 RETURNING *`,
        [req.params.osId, req.params.id, ...values]
      );
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });
}
