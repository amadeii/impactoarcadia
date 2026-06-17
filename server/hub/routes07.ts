/**
 * Arcádia Project Hub — Routes HUB-07
 * Templates: GET /api/hub/form-templates
 * Records:   GET/POST/PATCH /api/hub/projects/:id/field-records
 *            POST /api/hub/field-records/:id/review
 *            GET  /api/hub/projects/:id/field-records/map  (pontos GPS)
 */
import type { Express } from "express";
import { pool } from "../../db/index";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { runHub07Migration } from "./migration07";

const auth = [isAuthenticated, tenantContext, requireTenant];

const recordSchema = z.object({
  formType:         z.string().min(1),
  wbsNodeId:        z.string().optional().nullable(),
  taskId:           z.string().optional().nullable(),
  collectedByName:  z.string().optional().nullable(),
  collectedAt:      z.string().optional().nullable(),
  latitude:         z.number().optional().nullable(),
  longitude:        z.number().optional().nullable(),
  locationName:     z.string().optional().nullable(),
  fieldData:        z.record(z.any()).default({}),
  attachments:      z.array(z.any()).optional(),
  status:           z.enum(["rascunho","submetido","revisado","aprovado","rejeitado"]).optional(),
  pointId:          z.string().optional().nullable(),
  notes:            z.string().optional().nullable(),
});

const reviewSchema = z.object({
  status:       z.enum(["revisado","aprovado","rejeitado"]),
  reviewNotes:  z.string().optional().nullable(),
});

export function registerHub07Routes(app: Express) {

  app.post("/api/hub/migrate07", ...auth, async (req, res) => {
    res.json(await runHub07Migration());
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  // GET todos os templates disponíveis (global + do tenant)
  app.get("/api/hub/form-templates", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { projectType } = req.query;
    try {
      const { rows } = await pool.query(
        `SELECT * FROM project_form_templates
         WHERE (tenant_id = 'global' OR tenant_id = $1)
           AND active = TRUE
           AND (project_type IS NULL OR project_type = $2 OR $2 IS NULL)
         ORDER BY project_type NULLS LAST, label`,
        [tenantId, projectType ?? null]
      );
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET schema de um template específico
  app.get("/api/hub/form-templates/:formType", ...auth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM project_form_templates WHERE form_type = $1 AND active = TRUE LIMIT 1`,
        [req.params.formType]
      );
      if (!rows[0]) return res.status(404).json({ error: "Template não encontrado" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST — criar template customizado para o tenant
  app.post("/api/hub/form-templates", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { formType, label, projectType, icon, fields } = req.body;
    if (!formType || !label || !Array.isArray(fields))
      return res.status(400).json({ error: "formType, label e fields obrigatórios" });
    try {
      const { rows } = await pool.query(`
        INSERT INTO project_form_templates (tenant_id, project_type, form_type, label, icon, fields)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (form_type) DO UPDATE
        SET label = EXCLUDED.label, icon = EXCLUDED.icon, fields = EXCLUDED.fields
        RETURNING *`,
        [tenantId, projectType ?? null, `${tenantId}_${formType}`, label, icon ?? "FileText",
         JSON.stringify(fields)]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FIELD RECORDS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET lista com filtros
  app.get("/api/hub/projects/:id/field-records", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { formType, status, from, to, pointId } = req.query;
    const cond = ["r.project_id = $1","r.tenant_id = $2"];
    const params: any[] = [req.params.id, tenantId];
    let i = 3;
    if (formType) { cond.push(`r.form_type = $${i}`);  params.push(formType); i++; }
    if (status)   { cond.push(`r.status = $${i}`);     params.push(status);   i++; }
    if (from)     { cond.push(`r.collected_at >= $${i}`); params.push(from);  i++; }
    if (to)       { cond.push(`r.collected_at <= $${i}`); params.push(to);    i++; }
    if (pointId)  { cond.push(`r.point_id ILIKE $${i}`); params.push(`%${pointId}%`); i++; }
    try {
      const { rows } = await pool.query(
        `SELECT r.*,
           t.label AS form_label,
           w.title AS wbs_title, w.code AS wbs_code
         FROM project_field_records r
         LEFT JOIN project_form_templates t ON t.form_type = r.form_type
         LEFT JOIN project_wbs_nodes w ON w.id = r.wbs_node_id
         WHERE ${cond.join(" AND ")}
         ORDER BY r.collected_at DESC NULLS LAST, r.created_at DESC`,
        params
      );

      // Resumo por status e por tipo
      const { rows: summary } = await pool.query(
        `SELECT form_type, status, COUNT(*) AS count
         FROM project_field_records
         WHERE project_id = $1 AND tenant_id = $2
         GROUP BY form_type, status`,
        [req.params.id, tenantId]
      );

      res.json({ records: rows, summary });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET pontos GPS para o mini-mapa
  app.get("/api/hub/projects/:id/field-records/map", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT id, form_type, point_id, status,
           latitude, longitude, location_name,
           collected_at, collected_by_name
         FROM project_field_records
         WHERE project_id = $1 AND tenant_id = $2
           AND latitude IS NOT NULL AND longitude IS NOT NULL
         ORDER BY collected_at DESC`,
        [req.params.id, tenantId]
      );
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET detalhe de um registro
  app.get("/api/hub/field-records/:recordId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT r.*, t.label AS form_label, t.fields AS form_fields
         FROM project_field_records r
         LEFT JOIN project_form_templates t ON t.form_type = r.form_type
         WHERE r.id = $1 AND r.tenant_id = $2`,
        [req.params.recordId, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Registro não encontrado" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST — criar registro
  app.post("/api/hub/projects/:id/field-records", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    try {
      // Próximo sequence number para o tipo de formulário neste projeto
      const { rows: seq } = await pool.query(
        `SELECT COALESCE(MAX(sequence_number),0)+1 AS next
         FROM project_field_records
         WHERE project_id = $1 AND form_type = $2`,
        [req.params.id, d.formType]
      );

      const { rows } = await pool.query(`
        INSERT INTO project_field_records
          (project_id, tenant_id, wbs_node_id, task_id, form_type,
           collected_by, collected_by_name, collected_at,
           latitude, longitude, location_name,
           field_data, attachments, status, point_id, sequence_number, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *`,
        [
          req.params.id, tenantId, d.wbsNodeId ?? null, d.taskId ?? null, d.formType,
          userId, d.collectedByName ?? null,
          d.collectedAt ?? new Date().toISOString(),
          d.latitude ?? null, d.longitude ?? null, d.locationName ?? null,
          JSON.stringify(d.fieldData),
          JSON.stringify(d.attachments ?? []),
          d.status ?? "rascunho",
          d.pointId ?? null, seq[0].next, d.notes ?? null,
        ]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PATCH — atualizar registro (apenas rascunho/submetido)
  app.patch("/api/hub/field-records/:recordId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const parsed = recordSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    const map: Record<string, any> = {
      wbs_node_id: d.wbsNodeId, task_id: d.taskId,
      collected_by_name: d.collectedByName, collected_at: d.collectedAt,
      latitude: d.latitude, longitude: d.longitude, location_name: d.locationName,
      status: d.status, point_id: d.pointId, notes: d.notes,
    };
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) { fields.push(`${col} = $${i}`); params.push(val); i++; }
    }
    if (d.fieldData !== undefined) {
      fields.push(`field_data = $${i}`); params.push(JSON.stringify(d.fieldData)); i++;
    }
    if (d.attachments !== undefined) {
      fields.push(`attachments = $${i}`); params.push(JSON.stringify(d.attachments)); i++;
    }
    if (!fields.length) return res.status(400).json({ error: "Nenhum campo" });
    fields.push(`updated_at = NOW()`);
    params.push(req.params.recordId, tenantId);
    try {
      const { rows } = await pool.query(
        `UPDATE project_field_records SET ${fields.join(",")}
         WHERE id = $${i} AND tenant_id = $${i+1}
           AND status IN ('rascunho','submetido')
         RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Não encontrado ou já aprovado" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/hub/field-records/:id/submit — submeter para revisão
  app.post("/api/hub/field-records/:recordId/submit", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `UPDATE project_field_records SET status = 'submetido', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND status = 'rascunho' RETURNING *`,
        [req.params.recordId, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Não encontrado ou já submetido" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/hub/field-records/:id/review — revisão/aprovação pelo PM
  app.post("/api/hub/field-records/:recordId/review", ...auth, async (req, res) => {
    const tenantId   = (req as any).tenantId as string;
    const userId     = (req as any).user?.id as string;
    const userName   = (req as any).user?.name as string;
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = parsed.data;
    try {
      const { rows } = await pool.query(
        `UPDATE project_field_records
         SET status = $1, reviewed_by = $2, reviewed_by_name = $3,
             reviewed_at = NOW(), review_notes = $4, updated_at = NOW()
         WHERE id = $5 AND tenant_id = $6
           AND status IN ('submetido','revisado')
         RETURNING *`,
        [d.status, userId, userName ?? null, d.reviewNotes ?? null,
         req.params.recordId, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Não encontrado" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // DELETE — apenas rascunhos
  app.delete("/api/hub/field-records/:recordId", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM project_field_records
         WHERE id = $1 AND tenant_id = $2 AND status = 'rascunho'`,
        [req.params.recordId, tenantId]
      );
      if (!rowCount) return res.status(404).json({ error: "Não encontrado ou não é rascunho" });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/hub/projects/:id/map-config ──────────────────────────────────
  app.get("/api/hub/projects/:id/map-config", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT metadata->'map_photo' AS map_photo, metadata->'map_pins' AS map_pins
         FROM projects WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Projeto não encontrado" });
      res.json({
        photo: rows[0].map_photo ?? null,
        pins: rows[0].map_pins ?? [],
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── PATCH /api/hub/projects/:id/map-config ─────────────────────────────────
  app.patch("/api/hub/projects/:id/map-config", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { photo, pins } = req.body;
    try {
      // Build nested jsonb_set expression so we can set multiple keys in one statement
      let expr = "COALESCE(metadata,'{}')";
      const vals: any[] = [];
      let idx = 1;
      if (photo !== undefined) {
        expr = `jsonb_set(${expr}, '{map_photo}', $${idx}::jsonb)`;
        vals.push(JSON.stringify(photo));
        idx++;
      }
      if (pins !== undefined) {
        expr = `jsonb_set(${expr}, '{map_pins}', $${idx}::jsonb)`;
        vals.push(JSON.stringify(pins));
        idx++;
      }
      if (!vals.length) return res.json({ ok: true });
      await pool.query(
        `UPDATE projects SET metadata = ${expr}, updated_at = NOW()
         WHERE id = $${idx} AND tenant_id = $${idx + 1}`,
        [...vals, req.params.id, tenantId]
      );
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Export PDF de um registro (placeholder — integra com skill PDF)
  app.get("/api/hub/field-records/:recordId/export", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      const { rows } = await pool.query(
        `SELECT r.*, t.label AS form_label, t.fields AS form_fields,
           p.project_code, p.title AS project_title
         FROM project_field_records r
         LEFT JOIN project_form_templates t ON t.form_type = r.form_type
         LEFT JOIN projects p ON p.id = r.project_id
         WHERE r.id = $1 AND r.tenant_id = $2`,
        [req.params.recordId, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Não encontrado" });
      // Retorna JSON estruturado para o frontend gerar PDF via react-pdf ou impressão
      res.json({
        record: rows[0],
        exportedAt: new Date().toISOString(),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
}
