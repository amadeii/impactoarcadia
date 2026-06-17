/**
 * CAD-01 — routes.ts
 * Endpoints REST dos Cadastros Centrais do SOE.
 *
 * Prefixo: /api/cad
 */

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { soeContextFromReq } from "../soe/conventions";
import { runMigrationCad01 } from "./migration_cad01";
import {
  criarProdutoFiscal,
  buscarProdutoFiscal,
  resolverProdutoPorCodigoFornecedor,
  criarOuAtualizarEmitente,
  buscarEmitente,
  proximoNumeroFiscal,
  resolverPreco,
  gerarParcelas,
} from "./cadService";
import { pool } from "../../db/index";

const auth = [isAuthenticated, tenantContext, requireTenant];

export function registerCad01Routes(app: Express): void {

  // ── Migration ──────────────────────────────────────────────────────────────
  app.post("/api/cad/migrate", isAuthenticated, async (req: any, res) => {
    if (!req.isMaster) return res.status(403).json({ error: "master_required" });
    try {
      await runMigrationCad01();
      res.json({ ok: true, message: "CAD-01 migration executada." });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // PRODUTO FISCAL
  // ────────────────────────────────────────────────────────────────────────────

  app.get("/api/cad/produtos", ...auth, async (req: any, res) => {
    try {
      const { search, status, ncm, page = '1', limit = '50' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let q = `SELECT pf.*, fgt.nome AS grupo_nome
               FROM produto_fiscal pf
               LEFT JOIN fiscal_grupos_tributacao fgt ON fgt.id = pf.grupo_tributacao_id
               WHERE pf.tenant_id = $1`;
      const params: any[] = [req.tenantId];

      if (status) { q += ` AND pf.status = $${params.push(status)}`; }
      if (ncm)    { q += ` AND pf.ncm = $${params.push(ncm.replace(/\D/g, ''))}`; }
      if (search) {
        const s = `%${search.toLowerCase()}%`;
        q += ` AND (LOWER(pf.codigo) LIKE $${params.push(s)}
                OR LOWER(pf.descricao) LIKE $${params.push(s)}
                OR pf.ncm LIKE $${params.push(s)})`;
      }

      q += ` ORDER BY pf.descricao ASC LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(offset)}`;

      const { rows } = await pool.query(q, params);

      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*) FROM produto_fiscal WHERE tenant_id = $1${status ? ' AND status = $2' : ''}`,
        status ? [req.tenantId, status] : [req.tenantId]
      );

      res.json({ ok: true, data: rows, total: parseInt(cnt[0].count), page: parseInt(page), limit: parseInt(limit) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/api/cad/produtos/resolver", ...auth, async (req: any, res) => {
    const { codigo, ncm, fornecedor_id } = req.query as Record<string, string>;
    const result = await resolverProdutoPorCodigoFornecedor(
      req.tenantId, codigo, ncm, fornecedor_id
    );
    res.json({ ok: true, data: result });
  });

  app.get("/api/cad/produtos/:id", ...auth, async (req: any, res) => {
    const result = await buscarProdutoFiscal(req.tenantId, req.params.id);
    if (!result.ok) return res.status(404).json(result);
    res.json(result);
  });

  app.post("/api/cad/produtos", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const result = await criarProdutoFiscal(ctx, req.body);
    if (!result.ok) return res.status(400).json(result);
    res.status(201).json(result);
  });

  app.patch("/api/cad/produtos/:id", ...auth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE produto_fiscal
         SET descricao            = COALESCE($3, descricao),
             descricao_nfe        = COALESCE($4, descricao_nfe),
             ncm                  = COALESCE($5, ncm),
             cest                 = COALESCE($6, cest),
             origem               = COALESCE($7, origem),
             grupo_tributacao_id  = COALESCE($8, grupo_tributacao_id),
             controla_lote        = COALESCE($9, controla_lote),
             preco_venda_base     = COALESCE($10, preco_venda_base),
             estoque_minimo       = COALESCE($11, estoque_minimo),
             status               = COALESCE($12, status),
             updated_by_id        = $13,
             updated_at           = NOW()
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [
          req.params.id, req.tenantId,
          req.body.descricao ?? null,
          req.body.descricaoNfe ?? null,
          req.body.ncm ? req.body.ncm.replace(/\D/g, '') : null,
          req.body.cest ? req.body.cest.replace(/\D/g, '') : null,
          req.body.origem ?? null,
          req.body.grupoTributacaoId ?? null,
          req.body.controlaLote ?? null,
          req.body.precoVendaBase ?? null,
          req.body.estoqueMinimo ?? null,
          req.body.status ?? null,
          (req.user as any)?.id ?? 'system',
        ]
      );
      if (!rows[0]) return res.status(404).json({ ok: false, error: "Produto não encontrado." });
      res.json({ ok: true, data: rows[0] });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // EMITENTES FISCAL
  // ────────────────────────────────────────────────────────────────────────────

  app.get("/api/cad/emitentes", ...auth, async (req: any, res) => {
    const { rows } = await pool.query(
      `SELECT e.*, te.nome_fantasia AS empresa_nome
       FROM emitentes_fiscal e
       JOIN tenant_empresas te ON te.id = e.empresa_id
       WHERE e.tenant_id = $1
       ORDER BY te.nome_fantasia`,
      [req.tenantId]
    );
    res.json({ ok: true, data: rows });
  });

  app.get("/api/cad/emitentes/empresa/:empresaId", ...auth, async (req: any, res) => {
    const result = await buscarEmitente(req.tenantId, parseInt(req.params.empresaId));
    if (!result.ok) return res.status(404).json(result);
    res.json(result);
  });

  app.post("/api/cad/emitentes", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const result = await criarOuAtualizarEmitente(ctx, req.body);
    if (!result.ok) return res.status(400).json(result);
    res.status(201).json(result);
  });

  app.post("/api/cad/emitentes/empresa/:empresaId/proximo-numero", ...auth, async (req: any, res) => {
    const tipo = req.body.tipo as 'nfe' | 'nfce' | 'nfse';
    if (!tipo) return res.status(400).json({ ok: false, error: "Campo 'tipo' obrigatório (nfe|nfce|nfse)." });
    const result = await proximoNumeroFiscal(req.tenantId, parseInt(req.params.empresaId), tipo);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // TABELAS DE PREÇO
  // ────────────────────────────────────────────────────────────────────────────

  app.get("/api/cad/tabelas-preco", ...auth, async (req: any, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM soe_tabelas_preco
       WHERE tenant_id = $1 AND status = 'ativo'
       ORDER BY padrao DESC, nome`,
      [req.tenantId]
    );
    res.json({ ok: true, data: rows });
  });

  app.post("/api/cad/tabelas-preco", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      const b = req.body;
      const { rows } = await pool.query(
        `INSERT INTO soe_tabelas_preco
           (tenant_id, codigo, nome, descricao, tipo_cliente, canal_venda,
            desconto_perc, markup_perc, vigencia_inicio, vigencia_fim,
            tabela_pai_id, padrao, created_by_id, updated_by_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
         RETURNING *`,
        [
          ctx.tenantId, b.codigo, b.nome, b.descricao ?? null,
          b.tipoCliente ?? null, b.canalVenda ?? null,
          b.descontoPerc ?? 0, b.markupPerc ?? 0,
          b.vigenciaInicio ?? null, b.vigenciaFim ?? null,
          b.tabelaPaiId ?? null, b.padrao ?? false,
          ctx.userId,
        ]
      );
      res.status(201).json({ ok: true, data: rows[0] });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/cad/tabelas-preco/:id/itens", ...auth, async (req: any, res) => {
    try {
      const b = req.body;
      const { rows } = await pool.query(
        `INSERT INTO soe_tabela_preco_itens
           (tabela_preco_id, produto_fiscal_id, product_id,
            preco_unitario, desconto_perc, markup_perc, unidade, quantidade_minima)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (tabela_preco_id, produto_fiscal_id) WHERE produto_fiscal_id IS NOT NULL
         DO UPDATE SET
           preco_unitario   = EXCLUDED.preco_unitario,
           desconto_perc    = EXCLUDED.desconto_perc,
           markup_perc      = EXCLUDED.markup_perc,
           quantidade_minima = EXCLUDED.quantidade_minima
         RETURNING *`,
        [
          req.params.id,
          b.produtoFiscalId ?? null,
          b.productId ?? null,
          b.precoUnitario ?? null,
          b.descontoPerc ?? null,
          b.markupPerc ?? null,
          b.unidade ?? 'UN',
          b.quantidadeMinima ?? 1,
        ]
      );
      res.status(201).json({ ok: true, data: rows[0] });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/cad/tabelas-preco/resolver-preco", ...auth, async (req: any, res) => {
    const result = await resolverPreco({ tenantId: req.tenantId, ...req.body });
    res.json({ ok: true, data: result });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // CONDIÇÕES DE PAGAMENTO
  // ────────────────────────────────────────────────────────────────────────────

  app.get("/api/cad/condicoes-pagamento", ...auth, async (req: any, res) => {
    const { rows } = await pool.query(
      `SELECT cp.*,
              COALESCE(
                json_agg(p ORDER BY p.sequencia) FILTER (WHERE p.sequencia IS NOT NULL),
                '[]'
              ) AS parcelas_config
       FROM soe_condicoes_pagamento cp
       LEFT JOIN soe_condicao_parcelas p ON p.condicao_pagamento_id = cp.id
       WHERE cp.tenant_id = $1 AND cp.status = 'ativo'
       GROUP BY cp.id
       ORDER BY cp.padrao DESC, cp.nome`,
      [req.tenantId]
    );
    res.json({ ok: true, data: rows });
  });

  app.post("/api/cad/condicoes-pagamento", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      const b = req.body;

      const { rows } = await pool.query(
        `INSERT INTO soe_condicoes_pagamento
           (tenant_id, codigo, nome, descricao, tipo,
            acrescimo_perc, desconto_perc, dias_vencimento,
            formas_aceitas, padrao, created_by_id, updated_by_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
         RETURNING *`,
        [
          ctx.tenantId, b.codigo, b.nome, b.descricao ?? null,
          b.tipo ?? 'parcelado',
          b.acrescimoPerc ?? 0, b.descontoPerc ?? 0,
          b.diasVencimento ?? 0,
          b.formasAceitas ?? ['01', '15', '17'],
          b.padrao ?? false,
          ctx.userId,
        ]
      );

      const condicao = rows[0];

      if (b.parcelas?.length > 0) {
        for (const p of b.parcelas) {
          await pool.query(
            `INSERT INTO soe_condicao_parcelas
               (condicao_pagamento_id, sequencia, dias, percentual, forma_pagamento, descricao)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [condicao.id, p.sequencia, p.dias, p.percentual, p.formaPagamento ?? null, p.descricao ?? null]
          );
        }
      }

      res.status(201).json({ ok: true, data: condicao });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/cad/condicoes-pagamento/:id/gerar-parcelas", ...auth, async (req: any, res) => {
    const { total, dataBase } = req.body;
    if (!total || isNaN(parseFloat(total))) {
      return res.status(400).json({ ok: false, error: "Campo 'total' numérico é obrigatório." });
    }
    const result = await gerarParcelas(
      req.tenantId,
      req.params.id,
      parseFloat(total),
      dataBase ? new Date(dataBase) : undefined
    );
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });
}
