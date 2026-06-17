/**
 * COMP-01 — routes_comp01.ts
 * Endpoints REST do Módulo Compras.
 */

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { pool } from "../../db/index";
import { soeContextFromReq } from "../soe/conventions";
import {
  importarNfeXml, validarEntrada, aprovarEntrada,
  registrarManifestacao, type TipoManifestacao,
} from "./compService";

const auth = [isAuthenticated, tenantContext, requireTenant];

export function registerComp01Routes(app: Express): void {

  // ════════════════════════════════════════════════════════════════════════════
  // ENTRADAS DE NF-E
  // ════════════════════════════════════════════════════════════════════════════

  app.get("/api/comp/entradas", ...auth, async (req: any, res) => {
    try {
      const {
        status, fornecedorId, dataInicio, dataFim,
        manifestacao, page = '1', limit = '50'
      } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let q = `
        SELECT e.*,
               p.nome_fantasia AS fornecedor_nome_pessoa,
               d.nome AS deposito_nome,
               (SELECT COUNT(*) FROM purchase_invoice_items WHERE purchase_invoice_id = e.id) AS qtd_itens,
               (SELECT COUNT(*) FROM purchase_invoice_items WHERE purchase_invoice_id = e.id
                  AND produto_fiscal_id IS NULL AND product_id IS NULL) AS itens_sem_produto
        FROM purchase_invoice_entries e
        LEFT JOIN pessoas p ON p.id = e.fornecedor_pessoa_id
        LEFT JOIN depositos d ON d.id = e.deposito_destino_id
        WHERE e.tenant_id = $1`;
      const params: any[] = [req.tenantId];

      if (status)       q += ` AND e.status = $${params.push(status)}`;
      if (fornecedorId)  q += ` AND e.fornecedor_pessoa_id = $${params.push(fornecedorId)}`;
      if (dataInicio)   q += ` AND e.data_emissao >= $${params.push(dataInicio)}`;
      if (dataFim)      q += ` AND e.data_emissao <= $${params.push(dataFim)}`;
      if (manifestacao)  q += ` AND e.manifestacao_status = $${params.push(manifestacao)}`;

      q += ` ORDER BY e.created_at DESC LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(offset)}`;

      const { rows } = await pool.query(q, params);
      res.json({ ok: true, data: rows, page: parseInt(page), limit: parseInt(limit) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/api/comp/entradas/:id", ...auth, async (req: any, res) => {
    try {
      const { rows: [entrada] } = await pool.query(
        `SELECT e.*, p.nome_fantasia AS fornecedor_nome_pessoa, d.nome AS deposito_nome
         FROM purchase_invoice_entries e
         LEFT JOIN pessoas p ON p.id = e.fornecedor_pessoa_id
         LEFT JOIN depositos d ON d.id = e.deposito_destino_id
         WHERE e.id = $1 AND e.tenant_id = $2`,
        [req.params.id, req.tenantId]
      );
      if (!entrada) return res.status(404).json({ ok: false, error: "Entrada não encontrada." });

      const { rows: itens } = await pool.query(
        `SELECT pii.*, pf.descricao AS produto_descricao_cadastro, pf.codigo AS produto_codigo_cadastro
         FROM purchase_invoice_items pii
         LEFT JOIN produto_fiscal pf ON pf.id = pii.produto_fiscal_id
         WHERE pii.purchase_invoice_id = $1
         ORDER BY pii.sequencia`,
        [req.params.id]
      );

      const { rows: parcelas } = await pool.query(
        `SELECT * FROM purchase_invoice_installments
         WHERE purchase_invoice_id = $1 ORDER BY numero_duplicata`,
        [req.params.id]
      );

      const { rows: [validacao] } = await pool.query(
        `SELECT * FROM purchase_invoice_validation_results
         WHERE purchase_invoice_id = $1 ORDER BY validado_em DESC LIMIT 1`,
        [req.params.id]
      );

      res.json({ ok: true, data: { ...entrada, itens, parcelas, validacao } });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/comp/entradas/importar-xml — importa NF-e por upload de XML
  app.post("/api/comp/entradas/importar-xml", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const { xml, depositoDestinoId } = req.body;
    if (!xml) return res.status(400).json({ ok: false, error: "Campo 'xml' é obrigatório." });

    const result = await importarNfeXml(ctx, xml, depositoDestinoId);
    if (!result.ok) return res.status(400).json(result);
    res.status(201).json(result);
  });

  // POST /api/comp/entradas/importar-chave — importa pela chave (busca XML no Control Plus)
  app.post("/api/comp/entradas/importar-chave", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      const { chaveNfe, depositoDestinoId } = req.body;

      if (!chaveNfe || chaveNfe.replace(/\D/g, '').length !== 44) {
        return res.status(400).json({ ok: false, error: "Chave de acesso inválida (deve ter 44 dígitos)." });
      }

      const plusUrl   = process.env.PLUS_URL || process.env.CONTROL_PLUS_URL || '';
      const plusToken = process.env.PLUS_API_TOKEN || process.env.CONTROL_PLUS_SUPERADMIN_TOKEN || '';

      if (!plusUrl || !plusToken) {
        return res.status(422).json({
          ok: false,
          error: 'Control Plus não configurado. Use /importar-xml para importar o XML diretamente.'
        });
      }

      const response = await fetch(`${plusUrl}/api/nfe/download-xml`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${plusToken}`,
        },
        body: JSON.stringify({ chave: chaveNfe.replace(/\D/g, '') }),
      });
      const data = await response.json();

      if (!data.xml) {
        return res.status(422).json({ ok: false, error: data.message ?? 'XML não encontrado no Control Plus.' });
      }

      const result = await importarNfeXml(ctx, data.xml, depositoDestinoId);
      if (!result.ok) return res.status(400).json(result);
      res.status(201).json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/comp/entradas/:id/validar", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const result = await validarEntrada(ctx, req.params.id);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  app.patch("/api/comp/entradas/:id", ...auth, async (req: any, res) => {
    try {
      const b = req.body;
      await pool.query(
        `UPDATE purchase_invoice_entries
         SET deposito_destino_id = COALESCE($3, deposito_destino_id),
             updated_by_id = $4, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId, b.depositoDestinoId ?? null, (req.user as any)?.id ?? 'system']
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // PATCH /api/comp/entradas/:id/itens/:itemId/vincular-produto
  app.patch("/api/comp/entradas/:id/itens/:itemId/vincular-produto", ...auth, async (req: any, res) => {
    try {
      const { produtoFiscalId, productId } = req.body;
      await pool.query(
        `UPDATE purchase_invoice_items
         SET produto_fiscal_id = $3, product_id = $4
         WHERE id = $2 AND purchase_invoice_id = $1`,
        [req.params.id, req.params.itemId, produtoFiscalId ?? null, productId ?? null]
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/comp/entradas/:id/aprovar", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const result = await aprovarEntrada(ctx, req.params.id);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  app.post("/api/comp/entradas/:id/recusar", ...auth, async (req: any, res) => {
    try {
      const { motivo } = req.body;
      if (!motivo?.trim()) {
        return res.status(400).json({ ok: false, error: "Motivo de recusa é obrigatório." });
      }
      await pool.query(
        `UPDATE purchase_invoice_entries
         SET status = 'recusado', recusado_por_id = $3, recusado_em = NOW(),
             motivo_recusa = $4, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId, (req.user as any)?.id, motivo]
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/comp/entradas/:id/manifestar", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const { tipo } = req.body as { tipo: TipoManifestacao };
    const tiposValidos = ['ciencia', 'confirmacao', 'desconhecimento', 'nao_realizado'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ ok: false, error: `Tipo inválido. Use: ${tiposValidos.join(', ')}` });
    }
    const result = await registrarManifestacao(ctx, req.params.id, tipo);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CONFERÊNCIA
  // ════════════════════════════════════════════════════════════════════════════

  app.post("/api/comp/entradas/:id/conferencia", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      const { rows: [conf] } = await pool.query(
        `INSERT INTO purchase_conferences
           (tenant_id, purchase_invoice_id, status, conferido_por_id, iniciado_em)
         VALUES ($1,$2,'em_andamento',$3,NOW())
         RETURNING *`,
        [ctx.tenantId, req.params.id, ctx.userId]
      );

      const { rows: itens } = await pool.query(
        `SELECT * FROM purchase_invoice_items WHERE purchase_invoice_id = $1`,
        [req.params.id]
      );
      for (const item of itens) {
        await pool.query(
          `INSERT INTO purchase_conference_items (conference_id, purchase_invoice_item_id, qtd_xml)
           VALUES ($1,$2,$3)`,
          [conf.id, item.id, item.quantidade]
        );
      }

      res.status(201).json({ ok: true, data: conf });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.patch("/api/comp/conferencias/:id/itens/:itemId", ...auth, async (req: any, res) => {
    try {
      await pool.query(
        `UPDATE purchase_conference_items
         SET qtd_conferida = $3, observacao = $4, conferido_em = NOW()
         WHERE id = $2 AND conference_id = $1`,
        [req.params.id, req.params.itemId, req.body.qtdConferida, req.body.observacao ?? null]
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/comp/conferencias/:id/concluir", ...auth, async (req: any, res) => {
    try {
      const { rows: [itens] } = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE tem_divergencia = true) AS com_div,
                COUNT(*) AS total
         FROM purchase_conference_items WHERE conference_id = $1`,
        [req.params.id]
      );
      const hasDivergencia = parseInt(itens.com_div) > 0;
      const novoStatus = hasDivergencia ? 'com_divergencia' : 'concluida';

      await pool.query(
        `UPDATE purchase_conferences SET status = $2, concluido_em = NOW() WHERE id = $1`,
        [req.params.id, novoStatus]
      );

      res.json({ ok: true, data: { status: novoStatus, divergencias: parseInt(itens.com_div) } });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RELAÇÃO FISCAL DO FORNECEDOR
  // ════════════════════════════════════════════════════════════════════════════

  app.get("/api/comp/relacao-fiscal/:fornecedorPessoaId", ...auth, async (req: any, res) => {
    try {
      const { rows: [rel] } = await pool.query(
        `SELECT * FROM relacao_fiscal_fornecedor
         WHERE tenant_id = $1 AND fornecedor_pessoa_id = $2`,
        [req.tenantId, req.params.fornecedorPessoaId]
      );
      res.json({ ok: true, data: rel ?? null });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/comp/relacao-fiscal", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      const b = req.body;
      const { rows: [rel] } = await pool.query(
        `INSERT INTO relacao_fiscal_fornecedor
           (tenant_id, fornecedor_pessoa_id, cfop_entrada_estadual, cfop_entrada_interestadual,
            cst_csosn_entrada, cst_pis_entrada, cst_cofins_entrada,
            condicao_pagamento_id, deposito_destino_id,
            tolerancia_qtd_perc, tolerancia_preco_perc, observacao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (tenant_id, fornecedor_pessoa_id) DO UPDATE SET
           cfop_entrada_estadual      = EXCLUDED.cfop_entrada_estadual,
           cfop_entrada_interestadual = EXCLUDED.cfop_entrada_interestadual,
           cst_csosn_entrada          = EXCLUDED.cst_csosn_entrada,
           condicao_pagamento_id      = EXCLUDED.condicao_pagamento_id,
           deposito_destino_id        = EXCLUDED.deposito_destino_id,
           tolerancia_qtd_perc        = EXCLUDED.tolerancia_qtd_perc,
           tolerancia_preco_perc      = EXCLUDED.tolerancia_preco_perc,
           updated_at                 = NOW()
         RETURNING *`,
        [
          ctx.tenantId, b.fornecedorPessoaId,
          b.cfopEntradaEstadual ?? null, b.cfopEntradaInterestadual ?? null,
          b.cstCsosnEntrada ?? null, b.cstPisEntrada ?? null, b.cstCofinsEntrada ?? null,
          b.condicaoPagamentoId ?? null, b.depositoDestinoId ?? null,
          b.toleranciaQtdPerc ?? 0, b.toleranciaPrecoPerc ?? 0, b.observacao ?? null,
        ]
      );
      res.status(201).json({ ok: true, data: rel });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DASHBOARD DE COMPRAS
  // ════════════════════════════════════════════════════════════════════════════

  app.get("/api/comp/dashboard", ...auth, async (req: any, res) => {
    try {
      const { rows: [resumo] } = await pool.query(
        `SELECT
           COUNT(*)                                            AS total_entradas,
           COUNT(*) FILTER (WHERE status = 'importado')       AS importadas,
           COUNT(*) FILTER (WHERE status = 'com_divergencia') AS com_divergencia,
           COUNT(*) FILTER (WHERE status = 'aprovado')        AS aprovadas,
           COUNT(*) FILTER (WHERE status = 'recusado')        AS recusadas,
           COUNT(*) FILTER (WHERE manifestacao_status = 'pendente'
             AND data_emissao < CURRENT_DATE - 25)            AS manifestacao_urgente,
           COALESCE(SUM(valor_total) FILTER (
             WHERE status = 'aprovado'
               AND created_at >= DATE_TRUNC('month', NOW())
           ), 0)                                              AS volume_compras_mes
         FROM purchase_invoice_entries
         WHERE tenant_id = $1`,
        [req.tenantId]
      );

      const { rows: manifestacaoPendente } = await pool.query(
        `SELECT e.id, e.chave_nfe, e.fornecedor_nome, e.data_emissao, e.valor_total,
                CURRENT_DATE - e.data_emissao::date AS dias_sem_manifestacao
         FROM purchase_invoice_entries e
         WHERE e.tenant_id = $1
           AND e.manifestacao_status = 'pendente'
           AND e.data_emissao < CURRENT_DATE - 20
         ORDER BY e.data_emissao ASC
         LIMIT 20`,
        [req.tenantId]
      );

      const { rows: [semProduto] } = await pool.query(
        `SELECT COUNT(*) AS total
         FROM purchase_invoice_items pii
         JOIN purchase_invoice_entries e ON e.id = pii.purchase_invoice_id
         WHERE e.tenant_id = $1
           AND e.status NOT IN ('recusado', 'estornado')
           AND pii.produto_fiscal_id IS NULL
           AND pii.product_id IS NULL`,
        [req.tenantId]
      );

      res.json({
        ok: true,
        data: {
          resumo,
          alertas: {
            manifestacao_pendente: manifestacaoPendente,
            itens_sem_produto:     parseInt(semProduto.total),
          }
        }
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}
