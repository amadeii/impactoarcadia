/**
 * Arcádia Project Hub — Routes HUB-09
 * - GET /api/hub/projects/:id/historico — linha do tempo consolidada
 * - GET /api/engineering/projects — bridge de compatibilidade → Hub
 * - GET /api/hub/project-types — templates setoriais disponíveis
 * - POST /api/hub/projects/:id/apply-template — aplica template WBS
 */
import type { Express } from "express";
import { pool } from "../../db/index";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";

const auth = [isAuthenticated, tenantContext, requireTenant];

// ── Templates setoriais ───────────────────────────────────────────────────────
const PROJECT_TYPE_META: Record<string, {
  label: string; description: string; icon: string;
  defaultRateio: string; defaultRecognition: string;
}> = {
  geologia:    { label:"Geologia",             description:"Sondagens, monitoramento, laudos e investigações geotécnicas", icon:"Mountain",  defaultRateio:"percentual", defaultRecognition:"percentual" },
  ambiental:   { label:"Engenharia Ambiental", description:"Licenciamento, monitoramento, estudos e vistorias ambientais", icon:"Leaf",      defaultRateio:"percentual", defaultRecognition:"marco"      },
  civil:       { label:"Engenharia Civil",     description:"Projetos estruturais, obras, fiscalização e laudos",          icon:"Building",  defaultRateio:"percentual", defaultRecognition:"percentual" },
  consultoria: { label:"Consultoria",          description:"Diagnósticos, planos de ação, treinamentos e assessoria",    icon:"Briefcase", defaultRateio:"horas",      defaultRecognition:"horas"      },
  industrial:  { label:"Industrial",           description:"Projetos de implantação, comissionamento e manutenção",      icon:"Factory",   defaultRateio:"percentual", defaultRecognition:"marco"      },
};

export function registerHub09Routes(app: Express) {

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTÓRICO — linha do tempo consolidada
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/hub/projects/:id/historico", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const events: any[] = [];

      // Criação do projeto
      const { rows: [proj] } = await pool.query(
        `SELECT id, title, project_code, created_at, created_by FROM projects
         WHERE id = $1 AND tenant_id = $2`, [req.params.id, tenantId]
      );
      if (!proj) return res.status(404).json({ error: "Projeto não encontrado" });
      events.push({
        id: `proj-created-${proj.id}`, type:"project_created",
        title:`Projeto ${proj.project_code} criado`, description: proj.title,
        date: proj.created_at,
      });

      // Membros adicionados
      const { rows: members } = await pool.query(
        `SELECT user_name, role, joined_at FROM project_members
         WHERE project_id = $1 ORDER BY joined_at`, [req.params.id]
      );
      members.forEach((m: any) => {
        events.push({
          id:`member-${m.user_name}-${m.joined_at}`, type:"member_added",
          title:`${m.user_name ?? "Membro"} adicionado como ${m.role}`,
          actor: m.user_name, date: m.joined_at,
        });
      });

      // Marcos aceitos (billing milestones)
      const { rows: milestones } = await pool.query(
        `SELECT m.title, m.amount, m.accepted_at, m.status, m.ar_lancamento_id
         FROM project_billing_milestones m
         WHERE m.project_id = $1 AND m.accepted_at IS NOT NULL
         ORDER BY m.accepted_at`, [req.params.id]
      );
      milestones.forEach((m: any) => {
        events.push({
          id:`ms-${m.title}-${m.accepted_at}`, type:"milestone_accepted",
          title:`Marco aceito: ${m.title}`, amount: Number(m.amount),
          description: m.ar_lancamento_id ? "AR gerado no Control" : undefined,
          date: m.accepted_at,
        });
      });

      // NFS-e emitidas
      const { rows: nfses } = await pool.query(
        `SELECT nfse_number, amount, approved_at
         FROM project_fiscal_events
         WHERE project_id = $1 AND event_status = 'emitido' AND approved_at IS NOT NULL
         ORDER BY approved_at`, [req.params.id]
      );
      nfses.forEach((n: any) => {
        events.push({
          id:`nfse-${n.nfse_number}`, type:"nfse_emitted",
          title:`NFS-e emitida${n.nfse_number ? ` — Nº ${n.nfse_number}` : ""}`,
          amount: Number(n.amount), date: n.approved_at,
        });
      });

      // Cost events significativos (mão de obra aprovada)
      const { rows: costEvts } = await pool.query(
        `SELECT description, amount, event_date, cost_category
         FROM project_cost_events
         WHERE project_id = $1 AND source_type = 'timesheet'
         ORDER BY event_date LIMIT 50`, [req.params.id]
      );
      // Agrupa por dia para não poluir
      const tsByDay: Record<string, number> = {};
      costEvts.forEach((c: any) => {
        const raw = c.event_date instanceof Date
          ? c.event_date.toISOString()
          : String(c.event_date ?? "");
        const day = raw.split("T")[0] || "?";
        tsByDay[day] = (tsByDay[day] ?? 0) + Number(c.amount);
      });
      Object.entries(tsByDay).forEach(([day, total]) => {
        events.push({
          id:`ts-${day}`, type:"timesheet_approved",
          title:`Horas aprovadas`, description:`Custo de mão de obra: ${
            new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(total)
          }`,
          amount: total, date: `${day}T12:00:00`,
        });
      });

      // Field records aprovados
      const { rows: fieldRecs } = await pool.query(
        `SELECT form_type, point_id, reviewed_at, collected_by_name
         FROM project_field_records
         WHERE project_id = $1 AND status = 'aprovado' AND reviewed_at IS NOT NULL
         ORDER BY reviewed_at LIMIT 30`, [req.params.id]
      );
      fieldRecs.forEach((r: any) => {
        events.push({
          id:`field-${r.point_id}-${r.reviewed_at}`, type:"field_record",
          title:`Registro de campo aprovado${r.point_id ? ` — ${r.point_id}` : ""}`,
          description: r.collected_by_name,
          date: r.reviewed_at,
        });
      });

      // Orçamentos aprovados
      const { rows: budgets } = await pool.query(
        `SELECT label, total_budget, approved_at, approved_by
         FROM project_budget_versions
         WHERE project_id = $1 AND status = 'aprovado' AND approved_at IS NOT NULL
         ORDER BY approved_at`, [req.params.id]
      );
      budgets.forEach((b: any) => {
        events.push({
          id:`budget-${b.label}`, type:"budget_approved",
          title:`Orçamento aprovado: ${b.label ?? "Baseline"}`,
          amount: Number(b.total_budget), date: b.approved_at,
        });
      });

      // Ordenar por data decrescente
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      res.json(events);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATES SETORIAIS
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/hub/project-types", ...auth, async (_req, res) => {
    res.json(Object.entries(PROJECT_TYPE_META).map(([key, meta]) => ({ key, ...meta })));
  });

  // Aplicar template WBS a um projeto existente (se WBS vazia)
  app.post("/api/hub/projects/:id/apply-template", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { projectType } = req.body;
    if (!projectType) return res.status(400).json({ error: "projectType obrigatório" });
    try {
      // Verificar se WBS está vazia
      const { rows: existing } = await pool.query(
        `SELECT id FROM project_wbs_nodes WHERE project_id = $1 LIMIT 1`, [req.params.id]
      );
      if (existing.length) return res.status(409).json({ error: "WBS não está vazia" });

      // Buscar template
      const tplRes = await fetch(
        `http://localhost:${process.env.PORT ?? 5000}/api/hub/wbs-templates/${projectType}`,
        { headers: { "x-internal": "true" } }
      );
      const template = await tplRes.json();
      if (!Array.isArray(template)) return res.status(422).json({ error: "Template não encontrado" });

      // Criar nós recursivamente
      const createNode = async (node: any, parentId: string | null, orderIdx: number): Promise<void> => {
        const { rows: [created] } = await pool.query(`
          INSERT INTO project_wbs_nodes
            (project_id, tenant_id, parent_id, node_type, title, code, order_index)
          VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [req.params.id, tenantId, parentId, node.nodeType ?? "fase",
           node.title, node.code ?? null, orderIdx]
        );
        if (Array.isArray(node.children)) {
          for (let i = 0; i < node.children.length; i++) {
            await createNode(node.children[i], created.id, i);
          }
        }
      };
      for (let i = 0; i < template.length; i++) await createNode(template[i], null, i);

      res.json({ ok: true, nodesCreated: template.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BRIDGE DE COMPATIBILIDADE — /api/engineering/projects → /api/hub/projects
  // Mantém o ProjectPicker e outros componentes que ainda usam a rota antiga
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/engineering/projects", ...auth, async (req: any, res) => {
    const tenantId = req.tenantId as string;
    const { q, limit = "20" } = req.query;
    try {
      const cond = ["tenant_id = $1"];
      const params: any[] = [tenantId];
      let i = 2;
      if (q) { cond.push(`(title ILIKE $${i} OR project_code ILIKE $${i})`); params.push(`%${q}%`); i++; }
      params.push(parseInt(limit as string));
      const { rows } = await pool.query(
        `SELECT id, project_code AS numero, title AS titulo,
           title AS nome, project_code AS codigo, status, etapa,
           contract_value AS valor_contrato, progress_pct AS percentual_entregue,
           cliente_nome, cliente_id, planned_end AS data_fim
         FROM projects WHERE ${cond.join(" AND ")} AND status != 'cancelado'
         ORDER BY created_at DESC LIMIT $${i}`,
        params
      );
      res.json({ data: rows });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/engineering/projects/:id", ...auth, async (req: any, res) => {
    const tenantId = req.tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT id, project_code AS numero, title AS titulo,
           project_code AS codigo, status, etapa,
           contract_value AS valor_contrato, progress_pct AS percentual_entregue,
           cliente_nome, cliente_id, planned_end AS data_fim, planned_start AS data_inicio
         FROM projects WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Projeto não encontrado" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/engineering/stats", ...auth, async (req: any, res) => {
    const tenantId = req.tenantId as string;
    try {
      const { rows: [stats] } = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'ativo') AS ativos,
           COUNT(*) FILTER (WHERE status = 'concluido') AS concluidos,
           COUNT(*) FILTER (WHERE status = 'pausado') AS pausados,
           COALESCE(SUM(contract_value) FILTER (WHERE status = 'ativo'),0) AS valor_total_ativo
         FROM projects WHERE tenant_id = $1`,
        [tenantId]
      );
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
}
