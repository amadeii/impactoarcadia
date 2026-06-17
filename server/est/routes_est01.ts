/**
 * EST-01 — routes_est01.ts
 * Endpoints REST do Estoque Core.
 */

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { pool } from "../../db/index";
import { soeContextFromReq } from "../soe/conventions";
import {
  registrarEntrada, registrarSaida,
  buscarSaldo, buscarSaldoConsolidado,
  criarReserva, liberarReserva,
} from "./estService";

const auth = [isAuthenticated, tenantContext, requireTenant];

export function registerEst01Routes(app: Express): void {

  // ════════════════════════════════════════════════════════════════════════════
  // DEPÓSITOS
  // ════════════════════════════════════════════════════════════════════════════

  app.get("/api/est/depositos", ...auth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT d.*, te.nome_fantasia AS empresa_nome,
                u.first_name || ' ' || u.last_name AS responsavel_nome
         FROM depositos d
         LEFT JOIN tenant_empresas te ON te.id = d.empresa_id
         LEFT JOIN users u ON u.id = d.responsavel_id
         WHERE d.tenant_id = $1 AND d.status = 'ativo'
         ORDER BY d.padrao DESC, d.nome`,
        [req.tenantId]
      );
      res.json({ ok: true, data: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/est/depositos", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      const b = req.body;
      const { rows: [dep] } = await pool.query(
        `INSERT INTO depositos (
           tenant_id, empresa_id, codigo, nome, descricao, tipo,
           logradouro, cidade, uf, permite_estoque_negativo,
           visivel_todos_empresas, padrao, responsavel_id,
           deposito_retail_id, created_by_id, updated_by_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
         RETURNING *`,
        [
          ctx.tenantId, b.empresaId ?? null, b.codigo, b.nome,
          b.descricao ?? null, b.tipo ?? 'fisico',
          b.logradouro ?? null, b.cidade ?? null, b.uf ?? null,
          b.permiteEstoqueNegativo ?? false,
          b.visivelTodosEmpresas ?? true,
          b.padrao ?? false,
          b.responsavelId ?? null,
          b.depositoRetailId ?? null,
          ctx.userId,
        ]
      );
      res.status(201).json({ ok: true, data: dep });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.patch("/api/est/depositos/:id", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      const b = req.body;
      const { rows: [dep] } = await pool.query(
        `UPDATE depositos SET
           nome = COALESCE($3, nome),
           descricao = COALESCE($4, descricao),
           tipo = COALESCE($5, tipo),
           permite_estoque_negativo = COALESCE($6, permite_estoque_negativo),
           padrao = COALESCE($7, padrao),
           status = COALESCE($8, status),
           updated_by_id = $9, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [
          req.params.id, ctx.tenantId,
          b.nome ?? null, b.descricao ?? null, b.tipo ?? null,
          b.permiteEstoqueNegativo ?? null, b.padrao ?? null,
          b.status ?? null, ctx.userId,
        ]
      );
      if (!dep) return res.status(404).json({ ok: false, error: "Depósito não encontrado." });
      res.json({ ok: true, data: dep });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SALDOS
  // ════════════════════════════════════════════════════════════════════════════

  app.get("/api/est/saldos", ...auth, async (req: any, res) => {
    try {
      const { search, abaixoMinimo, page = '1', limit = '50' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let q = `SELECT * FROM v_saldo_consolidado WHERE tenant_id = $1`;
      const params: any[] = [req.tenantId];

      if (abaixoMinimo === 'true') {
        q += ` AND total_disponivel <= estoque_minimo`;
      }
      if (search) {
        q += ` AND (LOWER(produto_descricao) LIKE $${params.push('%' + search.toLowerCase() + '%')}
               OR LOWER(produto_codigo) LIKE $${params.push('%' + search.toLowerCase() + '%')})`;
      }

      q += ` ORDER BY produto_descricao LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(offset)}`;
      const { rows } = await pool.query(q, params);
      res.json({ ok: true, data: rows, page: parseInt(page), limit: parseInt(limit) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/api/est/saldos/:produtoFiscalId", ...auth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT s.*, d.nome AS deposito_nome, d.codigo AS deposito_codigo
         FROM saldos_produto s
         JOIN depositos d ON d.id = s.deposito_id
         WHERE s.tenant_id = $1 AND s.produto_fiscal_id = $2
         ORDER BY d.padrao DESC, d.nome`,
        [req.tenantId, req.params.produtoFiscalId]
      );
      const consolidado = await buscarSaldoConsolidado(req.tenantId, req.params.produtoFiscalId);
      res.json({ ok: true, data: { porDeposito: rows, consolidado } });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // MOVIMENTOS
  // ════════════════════════════════════════════════════════════════════════════

  app.post("/api/est/movimentos/entrada", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const b = req.body;
    const result = await registrarEntrada({
      tenantId:        ctx.tenantId,
      depositoId:      b.depositoId,
      produtoFiscalId: b.produtoFiscalId,
      productId:       b.productId,
      lotId:           b.lotId,
      quantidade:      parseFloat(b.quantidade),
      custoUnitario:   b.custoUnitario ? parseFloat(b.custoUnitario) : undefined,
      origemTipo:      b.origemTipo ?? 'entrada_manual',
      origemRefId:     b.origemRefId,
      documentoNumero: b.documentoNumero,
      justificativa:   b.justificativa,
      criadoPorId:     ctx.userId,
    });
    if (!result.ok) return res.status(400).json(result);
    res.status(201).json(result);
  });

  app.post("/api/est/movimentos/saida", ...auth, async (req: any, res) => {
    const ctx = soeContextFromReq(req);
    const b = req.body;
    const result = await registrarSaida({
      tenantId:        ctx.tenantId,
      depositoId:      b.depositoId,
      produtoFiscalId: b.produtoFiscalId,
      productId:       b.productId,
      quantidade:      parseFloat(b.quantidade),
      origemTipo:      b.origemTipo ?? 'saida_manual',
      origemRefId:     b.origemRefId,
      justificativa:   b.justificativa,
      criadoPorId:     ctx.userId,
    });
    if (!result.ok) return res.status(400).json(result);
    res.status(201).json(result);
  });

  app.get("/api/est/movimentos", ...auth, async (req: any, res) => {
    try {
      const {
        produtoFiscalId, depositoId, tipoMovimento,
        dataInicio, dataFim, page = '1', limit = '100'
      } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let q = `
        SELECT m.*,
               d.nome AS deposito_nome,
               COALESCE(pf.descricao, p.name) AS produto_descricao,
               u.first_name || ' ' || u.last_name AS usuario_nome
        FROM inventory_movements_core m
        LEFT JOIN depositos d       ON d.id = m.deposito_id
        LEFT JOIN produto_fiscal pf ON pf.id = m.produto_fiscal_id
        LEFT JOIN products p        ON p.id = m.product_id
        LEFT JOIN users u           ON u.id = m.criado_por_id
        WHERE m.tenant_id = $1`;
      const params: any[] = [req.tenantId];

      if (produtoFiscalId) q += ` AND m.produto_fiscal_id = $${params.push(produtoFiscalId)}`;
      if (depositoId)      q += ` AND m.deposito_id = $${params.push(depositoId)}`;
      if (tipoMovimento)   q += ` AND m.tipo_movimento = $${params.push(tipoMovimento)}`;
      if (dataInicio)      q += ` AND m.created_at >= $${params.push(dataInicio)}`;
      if (dataFim)         q += ` AND m.created_at <= $${params.push(dataFim + 'T23:59:59Z')}`;

      q += ` ORDER BY m.created_at DESC LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(offset)}`;
      const { rows } = await pool.query(q, params);
      res.json({ ok: true, data: rows, page: parseInt(page), limit: parseInt(limit) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // LOTES
  // ════════════════════════════════════════════════════════════════════════════

  app.get("/api/est/lotes", ...auth, async (req: any, res) => {
    try {
      const { produtoFiscalId, status, vencendoEm } = req.query as Record<string, string>;
      let q = `SELECT l.*, pf.descricao AS produto_descricao, d.nome AS deposito_nome
               FROM inventory_lots l
               LEFT JOIN produto_fiscal pf ON pf.id = l.produto_fiscal_id
               LEFT JOIN depositos d ON d.id = l.deposito_id
               WHERE l.tenant_id = $1`;
      const params: any[] = [req.tenantId];

      if (produtoFiscalId) q += ` AND l.produto_fiscal_id = $${params.push(produtoFiscalId)}`;
      if (status)          q += ` AND l.status = $${params.push(status)}`;
      if (vencendoEm)      q += ` AND l.data_validade <= $${params.push(vencendoEm)}`;

      q += ` ORDER BY l.data_validade ASC NULLS LAST, l.numero_lote`;
      const { rows } = await pool.query(q, params);
      res.json({ ok: true, data: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/est/lotes", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      const b = req.body;
      const { rows: [lot] } = await pool.query(
        `INSERT INTO inventory_lots
           (tenant_id, produto_fiscal_id, deposito_id, numero_lote,
            data_fabricacao, data_validade, fornecedor_pessoa_id,
            quantidade_entrada)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          ctx.tenantId, b.produtoFiscalId, b.depositoId, b.numeroLote,
          b.dataFabricacao ?? null, b.dataValidade ?? null,
          b.fornecedorPessoaId ?? null,
          b.quantidadeEntrada ?? 0,
        ]
      );
      res.status(201).json({ ok: true, data: lot });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // INVENTÁRIO
  // ════════════════════════════════════════════════════════════════════════════

  app.post("/api/est/inventarios", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      const b = req.body;

      const { rows: [numRow] } = await pool.query(
        `INSERT INTO soe_numeracao (tenant_id, empresa_id, tipo, proximo)
         VALUES ($1, null, 'inventario', 2)
         ON CONFLICT (tenant_id, empresa_id, tipo)
         DO UPDATE SET proximo = soe_numeracao.proximo + 1
         RETURNING proximo - 1 AS num`,
        [ctx.tenantId]
      );
      const numero = `INV${new Date().getFullYear().toString().slice(-2)}${String(numRow.num).padStart(4, '0')}`;

      const { rows: [inv] } = await pool.query(
        `INSERT INTO est_inventarios
           (tenant_id, deposito_id, numero, tipo, status, criado_por_id)
         VALUES ($1,$2,$3,$4,'aberto',$5)
         RETURNING *`,
        [ctx.tenantId, b.depositoId, numero, b.tipo ?? 'completo', ctx.userId]
      );

      const { rows: saldos } = await pool.query(
        `SELECT * FROM saldos_produto
         WHERE deposito_id = $1 AND tenant_id = $2 AND quantidade_fisica > 0`,
        [b.depositoId, ctx.tenantId]
      );

      for (const s of saldos) {
        await pool.query(
          `INSERT INTO est_inventario_itens
             (inventario_id, produto_fiscal_id, product_id, lot_id, quantidade_sistema)
           VALUES ($1,$2,$3,$4,$5)`,
          [inv.id, s.produto_fiscal_id, s.product_id, s.lot_id, s.quantidade_fisica]
        );
      }

      res.status(201).json({ ok: true, data: { ...inv, totalItens: saldos.length } });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/api/est/inventarios", ...auth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT i.*, d.nome AS deposito_nome,
                u.first_name || ' ' || u.last_name AS criado_por_nome
         FROM est_inventarios i
         LEFT JOIN depositos d ON d.id = i.deposito_id
         LEFT JOIN users u ON u.id = i.criado_por_id
         WHERE i.tenant_id = $1
         ORDER BY i.created_at DESC`,
        [req.tenantId]
      );
      res.json({ ok: true, data: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/api/est/inventarios/:id", ...auth, async (req: any, res) => {
    try {
      const { rows: [inv] } = await pool.query(
        `SELECT i.*, d.nome AS deposito_nome
         FROM est_inventarios i
         LEFT JOIN depositos d ON d.id = i.deposito_id
         WHERE i.id = $1 AND i.tenant_id = $2`,
        [req.params.id, req.tenantId]
      );
      if (!inv) return res.status(404).json({ ok: false, error: "Inventário não encontrado." });

      const { rows: itens } = await pool.query(
        `SELECT ii.*,
                COALESCE(pf.descricao, p.name) AS produto_descricao,
                COALESCE(pf.codigo, p.code) AS produto_codigo,
                u.first_name || ' ' || u.last_name AS contado_por_nome
         FROM est_inventario_itens ii
         LEFT JOIN produto_fiscal pf ON pf.id = ii.produto_fiscal_id
         LEFT JOIN products p ON p.id = ii.product_id
         LEFT JOIN users u ON u.id = ii.contado_por_id
         WHERE ii.inventario_id = $1
         ORDER BY produto_descricao`,
        [req.params.id]
      );

      res.json({ ok: true, data: { ...inv, itens } });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.patch("/api/est/inventarios/:id/itens/:itemId", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);
      await pool.query(
        `UPDATE est_inventario_itens
         SET quantidade_contada = $3,
             contado_por_id = $4, contado_em = NOW(),
             observacao = $5
         WHERE id = $2 AND inventario_id = $1`,
        [
          req.params.id, req.params.itemId,
          req.body.quantidadeContada,
          ctx.userId,
          req.body.observacao ?? null,
        ]
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/est/inventarios/:id/aplicar-ajustes", ...auth, async (req: any, res) => {
    try {
      const ctx = soeContextFromReq(req);

      const { rows: [inv] } = await pool.query(
        `SELECT * FROM est_inventarios WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, ctx.tenantId]
      );
      if (!inv) return res.status(404).json({ ok: false, error: "Inventário não encontrado." });
      if (inv.status !== 'em_ajuste' && inv.status !== 'aberto') {
        return res.status(409).json({ ok: false, error: "Inventário não está em ajuste." });
      }

      const { rows: itens } = await pool.query(
        `SELECT * FROM est_inventario_itens
         WHERE inventario_id = $1
           AND quantidade_contada IS NOT NULL
           AND diferenca != 0
           AND ajuste_aplicado = false`,
        [req.params.id]
      );

      let ajustados = 0;
      for (const item of itens) {
        const diff = parseFloat(item.diferenca);
        if (diff === 0) continue;

        if (diff > 0) {
          await registrarEntrada({
            tenantId: ctx.tenantId, depositoId: inv.deposito_id,
            produtoFiscalId: item.produto_fiscal_id, productId: item.product_id,
            quantidade: diff, origemTipo: 'inventario_ajuste',
            origemRefId: inv.id, justificativa: `Ajuste inventário ${inv.numero}`,
            criadoPorId: ctx.userId,
          });
        } else {
          await registrarSaida({
            tenantId: ctx.tenantId, depositoId: inv.deposito_id,
            produtoFiscalId: item.produto_fiscal_id, productId: item.product_id,
            quantidade: Math.abs(diff), origemTipo: 'inventario_ajuste',
            origemRefId: inv.id, justificativa: `Ajuste inventário ${inv.numero}`,
            criadoPorId: ctx.userId,
          });
        }

        await pool.query(
          `UPDATE est_inventario_itens SET ajuste_aplicado = true WHERE id = $1`,
          [item.id]
        );
        ajustados++;
      }

      await pool.query(
        `UPDATE est_inventarios
         SET status = 'concluido', concluido_em = NOW(), concluido_por_id = $2
         WHERE id = $1`,
        [req.params.id, ctx.userId]
      );

      res.json({ ok: true, data: { ajustados } });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DASHBOARD DE ESTOQUE
  // ════════════════════════════════════════════════════════════════════════════

  app.get("/api/est/dashboard", ...auth, async (req: any, res) => {
    try {
      const { rows: [resumo] } = await pool.query(
        `SELECT
           COUNT(DISTINCT produto_fiscal_id) AS total_produtos,
           COUNT(DISTINCT deposito_id)        AS total_depositos,
           COALESCE(SUM(valor_total), 0)      AS valor_total_estoque,
           COUNT(*) FILTER (WHERE total_disponivel <= estoque_minimo
             AND estoque_minimo > 0)          AS produtos_abaixo_minimo
         FROM v_saldo_consolidado
         WHERE tenant_id = $1`,
        [req.tenantId]
      );

      const { rows: lotesVencendo } = await pool.query(
        `SELECT l.numero_lote, l.data_validade, pf.descricao AS produto,
                l.saldo_lote,
                EXTRACT(DAY FROM (l.data_validade - NOW())) AS dias_restantes
         FROM inventory_lots l
         JOIN produto_fiscal pf ON pf.id = l.produto_fiscal_id
         WHERE l.tenant_id = $1
           AND l.status = 'ativo'
           AND l.data_validade <= NOW() + INTERVAL '30 days'
           AND l.saldo_lote > 0
         ORDER BY l.data_validade ASC
         LIMIT 20`,
        [req.tenantId]
      );

      const { rows: abaixoMinimo } = await pool.query(
        `SELECT produto_codigo, produto_descricao, unidade,
                total_disponivel, estoque_minimo,
                total_disponivel - estoque_minimo AS diferenca
         FROM v_saldo_consolidado
         WHERE tenant_id = $1
           AND estoque_minimo > 0
           AND total_disponivel <= estoque_minimo
         ORDER BY diferenca ASC
         LIMIT 20`,
        [req.tenantId]
      );

      res.json({
        ok: true,
        data: {
          resumo,
          alertas: {
            lotes_vencendo: lotesVencendo,
            abaixo_minimo:  abaixoMinimo,
          }
        }
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}
