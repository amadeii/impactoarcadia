/**
 * FISC-02 — routes_fisc02.ts
 * Endpoints REST: validação NF-e, emissão, cancelamento, documentos, dashboard fiscal.
 */

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { pool } from "../../db/index";
import { runMigrationFisc02 } from "./migration_fisc02";
import { FiscalValidator } from "./FiscalValidator";
import { fiscalAdapterV2 } from "./FiscalAdapterV2";
import { buscarEmitente } from "../cad/cadService";
import { soeContextFromReq } from "../soe/conventions";

const auth = [isAuthenticated, tenantContext, requireTenant];
const validator = new FiscalValidator();

export function registerFisc02Routes(app: Express): void {

  // ── Migration (master only) ────────────────────────────────────────────────
  app.post("/api/fisc/migrate-fisc02", isAuthenticated, async (req: any, res) => {
    if (!req.isMaster) return res.status(403).json({ error: "master_required" });
    try {
      await runMigrationFisc02();
      res.json({ ok: true, message: "FISC-02 migration executada." });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── POST /api/fisc/validar — valida payload NF-e sem transmitir ───────────
  app.post("/api/fisc/validar", ...auth, async (req: any, res) => {
    try {
      const { nfe, empresaId } = req.body;
      if (!nfe || !empresaId) {
        return res.status(400).json({ ok: false, error: "nfe e empresaId são obrigatórios." });
      }

      const emitenteResult = await buscarEmitente(req.tenantId, parseInt(empresaId));
      if (!emitenteResult.ok) {
        return res.status(404).json({ ok: false, error: emitenteResult.error });
      }
      const emitente = emitenteResult.data;

      const result = validator.validateToObject(nfe, {
        cnpj:     emitente.cnpj,
        uf:       (emitente as any).uf ?? 'SP',
        crt:      emitente.crt as 1 | 2 | 3 | 4,
        ambiente: emitente.ambiente,
      });

      res.json({ ok: true, data: result });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── POST /api/fisc/nfe/emitir ─────────────────────────────────────────────
  app.post("/api/fisc/nfe/emitir", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      const result = await fiscalAdapterV2.emitirNFe({
        tenantId: ctx.tenantId,
        userId:   ctx.userId,
        ...req.body,
      });
      if (!result.ok) return res.status(422).json(result);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── POST /api/fisc/nfe/:chave/cancelar ────────────────────────────────────
  app.post("/api/fisc/nfe/:chave/cancelar", ...auth, async (req: any, res) => {
    const { justificativa, empresaId } = req.body;
    const result = await fiscalAdapterV2.cancelarNFe(
      req.tenantId, parseInt(empresaId), req.params.chave, justificativa
    );
    if (!result.ok) return res.status(422).json(result);
    res.json(result);
  });

  // ── GET /api/fisc/emitentes/:empresaId/certificado ────────────────────────
  app.get("/api/fisc/emitentes/:empresaId/certificado", ...auth, async (req: any, res) => {
    const result = await fiscalAdapterV2.verificarCertificado(parseInt(req.params.empresaId));
    res.json({ ok: true, data: result });
  });

  // ── GET /api/fisc/documentos — lista com filtros ──────────────────────────
  app.get("/api/fisc/documentos", ...auth, async (req: any, res) => {
    try {
      const {
        tipo, status, page = '1', limit = '50', dataInicio, dataFim,
      } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let q = `SELECT * FROM fiscal_documentos WHERE tenant_id = $1`;
      const params: any[] = [req.tenantId];

      if (tipo)       q += ` AND tipo = $${params.push(tipo)}`;
      if (status)     q += ` AND status = $${params.push(status)}`;
      if (dataInicio) q += ` AND created_at >= $${params.push(dataInicio)}`;
      if (dataFim)    q += ` AND created_at <= $${params.push(dataFim + 'T23:59:59Z')}`;

      q += ` ORDER BY created_at DESC LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(offset)}`;

      const { rows } = await pool.query(q, params);
      res.json({ ok: true, data: rows, page: parseInt(page), limit: parseInt(limit) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── GET /api/fisc/documentos/:id — detalhe ────────────────────────────────
  app.get("/api/fisc/documentos/:id", ...auth, async (req: any, res) => {
    const { rows: [doc] } = await pool.query(
      `SELECT * FROM fiscal_documentos WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (!doc) return res.status(404).json({ ok: false, error: "Documento não encontrado." });
    res.json({ ok: true, data: doc });
  });

  // ── GET /api/fisc/dashboard ───────────────────────────────────────────────
  app.get("/api/fisc/dashboard", ...auth, async (req: any, res) => {
    try {
      const { rows: [resumo] } = await pool.query(
        `SELECT
           COUNT(*)                                        AS total,
           COUNT(*) FILTER (WHERE status = 'autorizado')  AS autorizados,
           COUNT(*) FILTER (WHERE status = 'rejeitado')   AS rejeitados,
           COUNT(*) FILTER (WHERE status = 'cancelado')   AS cancelados,
           COUNT(*) FILTER (WHERE status = 'simulado')    AS simulados,
           COUNT(*) FILTER (WHERE status IN ('montado','transmitindo')) AS pendentes,
           COALESCE(SUM(valor_total) FILTER (
             WHERE status = 'autorizado'
               AND created_at >= DATE_TRUNC('month', NOW())
           ), 0)                                          AS valor_mes_atual
         FROM fiscal_documentos WHERE tenant_id = $1`,
        [req.tenantId]
      );

      const { rows: certAlertas } = await pool.query(
        `SELECT e.empresa_id, te.nome_fantasia, e.certificado_valido_ate,
                EXTRACT(DAY FROM (e.certificado_valido_ate - NOW())) AS dias_restantes
         FROM emitentes_fiscal e
         JOIN tenant_empresas te ON te.id = e.empresa_id
         WHERE e.tenant_id = $1
           AND e.certificado_valido_ate IS NOT NULL
           AND e.certificado_valido_ate <= NOW() + INTERVAL '30 days'
           AND e.status = 'ativo'`,
        [req.tenantId]
      );

      res.json({
        ok: true,
        data: { resumo, alertas: { certificados_vencendo: certAlertas } }
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}
