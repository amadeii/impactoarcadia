/**
 * Sprint C-E02 + C-E04 + C-E13 — Engineering Projects API
 * Rotas nativas Arcádia para /api/engineering/projects
 * Usa pool.query() para queries parametrizadas dinâmicas.
 */
import type { Express } from "express";
import { pool } from "../../db/index";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { dispararARProjeto } from "../routes_pessoas_financeiro";

const auth = [isAuthenticated, tenantContext, requireTenant];

const projectSchema = z.object({
  titulo: z.string().min(1),
  clienteId: z.string().optional().nullable(),
  clienteNome: z.string().optional().nullable(),
  clienteExternoNome: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  etapa: z.string().optional().default("venda"),
  status: z.string().optional().default("ativo"),
  valorContrato: z.coerce.number().optional().nullable(),
  percentualEntregue: z.coerce.number().min(0).max(100).optional().default(0),
  dataInicio: z.string().optional().nullable(),
  dataFim: z.string().optional().nullable(),
  osNumero: z.string().optional().nullable(),
  proposalId: z.coerce.number().optional().nullable(),
  responsavelId: z.string().optional().nullable(),
});

const patchSchema = projectSchema.partial();

export function registerEngineeringRoutes(app: Express) {
  // ── GET /api/engineering/projects ─────────────────────────────────────
  app.get("/api/engineering/projects", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const { etapa, status, clienteId, q } = req.query as Record<string, string>;

      let where = `WHERE ep.tenant_id = $1`;
      const params: any[] = [tenantId];

      if (etapa) {
        params.push(etapa);
        where += ` AND ep.etapa = $${params.length}`;
      }
      if (status) {
        params.push(status);
        where += ` AND ep.status = $${params.length}`;
      }
      if (clienteId) {
        params.push(clienteId);
        where += ` AND ep.cliente_id = $${params.length}`;
      }
      if (q) {
        params.push(`%${q.toLowerCase()}%`);
        where += ` AND (lower(ep.titulo) LIKE $${params.length} OR lower(coalesce(ep.cliente_nome,'')) LIKE $${params.length} OR lower(ep.numero) LIKE $${params.length})`;
      }

      const result = await pool.query(`
        SELECT ep.*,
               p.nome_fantasia AS pessoa_nome
        FROM engineering_projects ep
        LEFT JOIN pessoas p ON p.id = ep.cliente_id
        ${where}
        ORDER BY ep.created_at DESC
        LIMIT 200
      `, params);

      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── GET /api/engineering/projects/:id ─────────────────────────────────
  app.get("/api/engineering/projects/:id", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const result = await pool.query(`
        SELECT ep.*, p.nome_fantasia AS pessoa_nome
        FROM engineering_projects ep
        LEFT JOIN pessoas p ON p.id = ep.cliente_id
        WHERE ep.id = $1 AND ep.tenant_id = $2
        LIMIT 1
      `, [req.params.id, tenantId]);

      if (!result.rows[0]) return res.status(404).json({ message: "Projeto não encontrado" });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── POST /api/engineering/projects ────────────────────────────────────
  app.post("/api/engineering/projects", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const data = projectSchema.parse(req.body);

      // Gera número sequencial: ENG-YYYY-NNN
      const year = new Date().getFullYear();
      const countResult = await pool.query(`
        SELECT COUNT(*)::int AS cnt FROM engineering_projects
        WHERE tenant_id = $1 AND EXTRACT(YEAR FROM created_at) = $2
      `, [tenantId, year]);
      const cnt = countResult.rows[0]?.cnt ?? 0;
      const numero = `ENG-${year}-${String(Number(cnt) + 1).padStart(3, "0")}`;

      const insertResult = await pool.query(`
        INSERT INTO engineering_projects
          (tenant_id, numero, titulo, cliente_id, cliente_nome, cliente_externo_nome,
           descricao, etapa, status, valor_contrato, percentual_entregue,
           data_inicio, data_fim, os_numero, proposal_id, responsavel_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *
      `, [
        tenantId, numero, data.titulo,
        data.clienteId ?? null, data.clienteNome ?? null, data.clienteExternoNome ?? null,
        data.descricao ?? null,
        data.etapa ?? "venda",
        data.status ?? "ativo",
        data.valorContrato ?? null,
        data.percentualEntregue ?? 0,
        data.dataInicio ?? null, data.dataFim ?? null,
        data.osNumero ?? null, data.proposalId ?? null,
        data.responsavelId ?? null,
      ]);

      const project = insertResult.rows[0];

      // FIX-01: Dual-write para tabela projects (Hub) — cria projeto espelho
      try {
        const etapaMap: Record<string, string> = {
          venda: "planejamento", pre_projeto: "planejamento",
          backlog: "planejamento", planejamento: "planejamento",
          execucao: "em_execucao", concluido: "encerramento",
        };
        const hubInsert = await pool.query(`
          INSERT INTO projects
            (tenant_id, project_code, title, project_type, status, etapa,
             cliente_id, cliente_nome, cliente_externo_nome,
             contract_value, planned_start, planned_end, proposal_id,
             owner_id, description, created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
          RETURNING id
        `, [
          tenantId, numero, data.titulo,
          "consultoria",
          data.status ?? "ativo",
          etapaMap[data.etapa ?? "venda"] ?? "planejamento",
          data.clienteId ?? null, data.clienteNome ?? null, data.clienteExternoNome ?? null,
          data.valorContrato ?? null,
          data.dataInicio ?? null, data.dataFim ?? null,
          data.proposalId ?? null, data.responsavelId ?? null,
          data.descricao ?? null, req.user?.id ?? null,
        ]);
        const hubProjectId = hubInsert.rows[0]?.id;
        if (hubProjectId) {
          await pool.query(
            `UPDATE engineering_projects SET hub_project_id = $1 WHERE id = $2`,
            [hubProjectId, project.id]
          );
          project.hub_project_id = hubProjectId;
        }
      } catch (_) {
        // Hub sync falhou silenciosamente — projeto engineering ainda criado
      }

      // Registra histórico inicial
      await pool.query(`
        INSERT INTO engineering_project_history
          (tenant_id, projeto_id, etapa_anterior, etapa_atual, observacoes, alterado_por)
        VALUES ($1,$2,NULL,$3,'Projeto criado',$4)
      `, [tenantId, project.id, data.etapa ?? "venda", req.user?.id ?? null]);

      res.status(201).json(project);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  // ── PATCH /api/engineering/projects/:id ───────────────────────────────
  app.patch("/api/engineering/projects/:id", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const data = patchSchema.parse(req.body);

      // Busca etapa atual para histórico
      const curResult = await pool.query(
        `SELECT etapa FROM engineering_projects WHERE id=$1 AND tenant_id=$2`,
        [req.params.id, tenantId]
      );
      const current = curResult.rows[0];
      if (!current) return res.status(404).json({ message: "Projeto não encontrado" });

      const sets: string[] = [];
      const params: any[] = [];

      const fieldMap: Record<string, string> = {
        titulo: "titulo", clienteId: "cliente_id", clienteNome: "cliente_nome",
        clienteExternoNome: "cliente_externo_nome", descricao: "descricao",
        etapa: "etapa", status: "status", valorContrato: "valor_contrato",
        percentualEntregue: "percentual_entregue", dataInicio: "data_inicio",
        dataFim: "data_fim", osNumero: "os_numero", responsavelId: "responsavel_id",
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if (key in data) {
          params.push((data as any)[key]);
          sets.push(`${col} = $${params.length}`);
        }
      }

      if (sets.length === 0) return res.status(400).json({ message: "Nenhum campo para atualizar" });

      sets.push(`updated_at = NOW()`);
      params.push(req.params.id, tenantId);

      const updateResult = await pool.query(`
        UPDATE engineering_projects SET ${sets.join(", ")}
        WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
        RETURNING *
      `, params);

      const updated = updateResult.rows[0];

      // Registra histórico se etapa mudou
      if (data.etapa && data.etapa !== current.etapa) {
        await pool.query(`
          INSERT INTO engineering_project_history
            (tenant_id, projeto_id, etapa_anterior, etapa_atual, observacoes, alterado_por)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [tenantId, req.params.id, current.etapa, data.etapa,
           req.body.observacoes ?? null, req.user?.id ?? null]);
      }

      // Hook AR automático ao concluir projeto
      if (data.etapa === "concluido" && current.etapa !== "concluido") {
        dispararARProjeto(updated, tenantId, req.user?.id ?? null).catch(e =>
          console.error("[arService] Falha no hook OS concluída:", e.message)
        );
      }

      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  // ── GET /api/engineering/projects/:id/history ─────────────────────────
  app.get("/api/engineering/projects/:id/history", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const result = await pool.query(`
        SELECT h.*, u.name AS usuario_nome
        FROM engineering_project_history h
        LEFT JOIN users u ON u.id::text = h.alterado_por
        WHERE h.projeto_id = $1 AND h.tenant_id = $2
        ORDER BY h.created_at ASC
      `, [req.params.id, tenantId]);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── GET /api/engineering/projects/:id/contas-receber ── C-E04 ──────────
  app.get("/api/engineering/projects/:id/contas-receber", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const result = await pool.query(`
        SELECT lf.*, pc.descricao AS plano_conta_nome, cc.nome AS centro_custo_nome
        FROM lancamentos_financeiros lf
        LEFT JOIN planos_contas pc ON pc.id = lf.plano_conta_id
        LEFT JOIN centros_custo cc ON cc.id = lf.centro_custo_id
        WHERE lf.projeto_id = $1 AND lf.tenant_id = $2 AND lf.tipo = 'receber'
        ORDER BY lf.data_vencimento ASC
      `, [req.params.id, tenantId]);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── GET /api/engineering/projects/:id/financeiro-resumo ── C-E13 ───────
  app.get("/api/engineering/projects/:id/financeiro-resumo", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const id = req.params.id;

      const [projResult, arResult, despResult, histResult] = await Promise.all([
        pool.query(
          `SELECT valor_contrato FROM engineering_projects WHERE id=$1 AND tenant_id=$2`,
          [id, tenantId]
        ),
        pool.query(`
          SELECT
            COALESCE(SUM(valor),0) AS ar_previsto,
            COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS ar_recebido
          FROM lancamentos_financeiros
          WHERE projeto_id=$1 AND tenant_id=$2 AND tipo='receber'
        `, [id, tenantId]),
        pool.query(`
          SELECT
            COALESCE(SUM(valor),0) AS despesas_previstas,
            COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS despesas_pagas
          FROM lancamentos_financeiros
          WHERE projeto_id=$1 AND tenant_id=$2 AND tipo='pagar'
        `, [id, tenantId]),
        pool.query(`
          SELECT h.*, u.name AS usuario_nome
          FROM engineering_project_history h
          LEFT JOIN users u ON u.id::text = h.alterado_por
          WHERE h.projeto_id=$1 AND h.tenant_id=$2
          ORDER BY h.created_at ASC
        `, [id, tenantId]),
      ]);

      const projeto = projResult.rows[0];
      if (!projeto) return res.status(404).json({ message: "Projeto não encontrado" });

      const ar = arResult.rows[0] ?? { ar_previsto: 0, ar_recebido: 0 };
      const desp = despResult.rows[0] ?? { despesas_previstas: 0, despesas_pagas: 0 };

      const valorContrato = Number(projeto.valor_contrato ?? 0);
      const arPrevisto = Number(ar.ar_previsto);
      const arRecebido = Number(ar.ar_recebido);
      const despesasPrevistas = Number(desp.despesas_previstas);
      const despesasPagas = Number(desp.despesas_pagas);

      const margemEstimada = valorContrato > 0
        ? ((valorContrato - despesasPrevistas) / valorContrato) * 100
        : null;
      const ratioDesp = valorContrato > 0 ? despesasPrevistas / valorContrato : 0;

      res.json({
        valorContrato,
        arPrevisto,
        arRecebido,
        arPendente: arPrevisto - arRecebido,
        despesasPrevistas,
        despesasPagas,
        despesasPendentes: despesasPrevistas - despesasPagas,
        margemEstimada: margemEstimada !== null ? Number(margemEstimada.toFixed(2)) : null,
        alertaCusto: ratioDesp > 1 ? "vermelho" : ratioDesp > 0.8 ? "amarelo" : "verde",
        historico: histResult.rows,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Sprint C-E05 — Bases de Receita por Projeto ────────────────────────
  app.get("/api/engineering/projects/:projetoId/bases-receita", ...auth, async (req: any, res) => {
    try {
      const { projetoId } = req.params;
      const tenantId: string = req.tenantId;
      const r = await pool.query(`
        SELECT * FROM engineering_projeto_bases_receita
        WHERE tenant_id=$1 AND projeto_id=$2
        ORDER BY competencia DESC, created_at DESC
      `, [tenantId, projetoId]);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/engineering/projects/:projetoId/bases-receita", ...auth, async (req: any, res) => {
    try {
      const { projetoId } = req.params;
      const tenantId: string = req.tenantId;
      const { etapa, descricao, valorPrevisto, competencia } = req.body;
      if (!descricao || valorPrevisto == null) {
        return res.status(400).json({ message: "descricao e valorPrevisto são obrigatórios" });
      }

      // Busca projeto para pegar clienteId
      const projR = await pool.query(
        `SELECT cliente_id FROM engineering_projects WHERE id=$1 AND tenant_id=$2`,
        [projetoId, tenantId]
      );
      if (!projR.rows[0]) return res.status(404).json({ message: "Projeto não encontrado" });
      const clienteId = projR.rows[0].cliente_id;

      // Insere base de receita
      const insR = await pool.query(`
        INSERT INTO engineering_projeto_bases_receita
          (tenant_id, cliente_id, projeto_id, etapa, descricao, valor_previsto, competencia, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'previsto')
        RETURNING *
      `, [tenantId, clienteId, projetoId, etapa ?? 'mobilizacao', descricao,
        valorPrevisto, competencia ?? null]);
      const base = insR.rows[0];

      // Gera lançamento a receber automaticamente
      const lancR = await pool.query(`
        INSERT INTO lancamentos_financeiros
          (tenant_id, cliente_id, tipo, descricao, valor, data_vencimento, status, projeto_id, origem)
        VALUES ($1,$2,'receber',$3,$4,$5,'previsto',$6,'automatico')
        RETURNING id
      `, [tenantId, clienteId,
        `[Base Receita] ${descricao}`,
        valorPrevisto,
        competencia ?? new Date().toISOString().slice(0, 10),
        projetoId]);

      // Vincula lançamento à base
      const lancId = lancR.rows[0]?.id;
      if (lancId) {
        await pool.query(
          `UPDATE engineering_projeto_bases_receita SET lancamento_id=$1 WHERE id=$2`,
          [lancId, base.id]
        );
        base.lancamento_id = lancId;
      }

      res.status(201).json(base);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/engineering/projects/:projetoId/bases-receita/:baseId", ...auth, async (req: any, res) => {
    try {
      const { projetoId, baseId } = req.params;
      const tenantId: string = req.tenantId;
      await pool.query(
        `DELETE FROM engineering_projeto_bases_receita WHERE id=$1 AND projeto_id=$2 AND tenant_id=$3`,
        [baseId, projetoId, tenantId]
      );
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── GET /api/engineering/stats ─────────────────────────────────────────
  app.get("/api/engineering/stats", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='ativo') AS total_ativos,
          COUNT(*) FILTER (WHERE etapa='em_execucao') AS em_execucao,
          COUNT(*) FILTER (WHERE status='concluido') AS concluidos,
          COALESCE(SUM(valor_contrato) FILTER (WHERE status='ativo'),0) AS pipeline_total
        FROM engineering_projects
        WHERE tenant_id=$1
      `, [tenantId]);
      res.json(result.rows[0] ?? {});
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
