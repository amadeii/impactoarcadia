/**
 * Arcádia Control — Rotas de Cartão Corporativo, Anexos e Workflow de Pagamento
 *
 * INSTRUÇÃO DE INTEGRAÇÃO:
 *   Em server/control/routes.ts, no final da função registerControlRoutes():
 *     import { attachCartaoRoutes } from "./routes_cartao";
 *     attachCartaoRoutes(app);
 *
 *   Em server/index.ts, adicione import para multer de storage (já existe no projeto).
 */

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import multer from "multer";
import { parse as csvParse } from "csv-parse/sync";
import { pool } from "../../db/index";

const auth = [isAuthenticated, tenantContext, requireTenant];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function parseBRL(str: string): number {
  if (!str) return 0;
  return parseFloat(String(str).replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
}

async function clienteBelongsToTenant(clienteId: string, tenantId: string): Promise<boolean> {
  const r = await pool.query(`SELECT id FROM clients WHERE id = $1 AND tenant_id = $2`, [clienteId, tenantId]);
  return r.rowCount! > 0;
}

async function cartaoBelongsToCliente(cartaoId: string, clienteId: string, tenantId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT id FROM cartoes_corporativos WHERE id = $1 AND cliente_id = $2 AND tenant_id = $3`,
    [cartaoId, clienteId, tenantId]
  );
  return r.rowCount! > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function attachCartaoRoutes(app: Express) {

  // ===========================================================================
  // ① CARTÕES CORPORATIVOS — CRUD
  // ===========================================================================

  // Listar cartões do cliente
  app.get("/api/control/clientes/:clienteId/cartoes", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      const r = await pool.query(
        `SELECT cc.*, cb.banco as conta_banco, cb.agencia as conta_agencia
         FROM cartoes_corporativos cc
         LEFT JOIN contas_bancarias cb ON cb.id = cc.conta_bancaria_id
         WHERE cc.cliente_id = $1 AND cc.tenant_id = $2
         ORDER BY cc.nome`,
        [req.params.clienteId, req.tenantId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Criar cartão
  app.post("/api/control/clientes/:clienteId/cartoes", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      const { nome, bandeira, ultimos_digitos, limite, conta_bancaria_id, portadores, observacoes } = req.body;
      if (!nome) return res.status(400).json({ message: "Nome do cartão é obrigatório" });

      const r = await pool.query(
        `INSERT INTO cartoes_corporativos
           (tenant_id, cliente_id, nome, bandeira, ultimos_digitos, limite, conta_bancaria_id, portadores, observacoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [req.tenantId, req.params.clienteId, nome, bandeira || null, ultimos_digitos || null,
         limite || null, conta_bancaria_id || null, portadores || [], observacoes || null]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Atualizar cartão
  app.patch("/api/control/cartoes/:id", ...auth, async (req: any, res) => {
    try {
      const { nome, bandeira, ultimos_digitos, limite, conta_bancaria_id, portadores, observacoes, status } = req.body;
      const r = await pool.query(
        `UPDATE cartoes_corporativos SET
           nome = COALESCE($1, nome),
           bandeira = COALESCE($2, bandeira),
           ultimos_digitos = COALESCE($3, ultimos_digitos),
           limite = COALESCE($4, limite),
           conta_bancaria_id = COALESCE($5, conta_bancaria_id),
           portadores = COALESCE($6, portadores),
           observacoes = COALESCE($7, observacoes),
           status = COALESCE($8, status),
           updated_at = NOW()
         WHERE id = $9 AND tenant_id = $10
         RETURNING *`,
        [nome, bandeira, ultimos_digitos, limite, conta_bancaria_id, portadores, observacoes, status, req.params.id, req.tenantId]
      );
      if (!r.rowCount) return res.status(404).json({ message: "Cartão não encontrado" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Excluir cartão (só sem faturas)
  app.delete("/api/control/cartoes/:id", ...auth, async (req: any, res) => {
    try {
      const faturas = await pool.query(`SELECT id FROM faturas_cartao WHERE cartao_id = $1 LIMIT 1`, [req.params.id]);
      if (faturas.rowCount! > 0) return res.status(400).json({ message: "Não é possível excluir cartão com faturas vinculadas" });
      await pool.query(`DELETE FROM cartoes_corporativos WHERE id = $1 AND tenant_id = $2`, [req.params.id, req.tenantId]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===========================================================================
  // ② FATURAS DO CARTÃO
  // ===========================================================================

  // Listar faturas de um cartão
  app.get("/api/control/cartoes/:cartaoId/faturas", ...auth, async (req: any, res) => {
    try {
      const r = await pool.query(
        `SELECT fc.*,
                (SELECT COUNT(*) FROM transacoes_cartao WHERE fatura_id = fc.id) as qtd_transacoes,
                lf.status as lancamento_status
         FROM faturas_cartao fc
         LEFT JOIN lancamentos_financeiros lf ON lf.id = fc.lancamento_ap_id
         WHERE fc.cartao_id = $1 AND fc.tenant_id = $2
         ORDER BY fc.competencia DESC`,
        [req.params.cartaoId, req.tenantId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Criar fatura (gera lançamento AP automaticamente)
  app.post("/api/control/cartoes/:cartaoId/faturas", ...auth, async (req: any, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { competencia, vencimento, valor_total, observacoes } = req.body;
      if (!competencia || !vencimento) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Competência e vencimento são obrigatórios" });
      }

      // Buscar cartão para obter cliente_id e conta_bancaria_id
      const cartaoRes = await client.query(
        `SELECT * FROM cartoes_corporativos WHERE id = $1 AND tenant_id = $2`,
        [req.params.cartaoId, req.tenantId]
      );
      if (!cartaoRes.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Cartão não encontrado" });
      }
      const cartao = cartaoRes.rows[0];

      // Verificar se já existe fatura para este cartão/competência
      const exists = await client.query(
        `SELECT id FROM faturas_cartao WHERE cartao_id = $1 AND competencia = $2`,
        [req.params.cartaoId, competencia]
      );
      if (exists.rowCount! > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Já existe fatura para este cartão nesta competência" });
      }

      // Criar lançamento AP para pagamento da fatura
      const apRes = await client.query(
        `INSERT INTO lancamentos_financeiros
           (tenant_id, cliente_id, tipo, descricao, favorecido, valor, data_vencimento,
            status, origem, conta_bancaria_id, observacoes)
         VALUES ($1,$2,'pagar',$3,$4,$5,$6,'previsto','manual',$7,$8)
         RETURNING id`,
        [
          req.tenantId, cartao.cliente_id,
          `Fatura Cartão ${cartao.nome} — ${competencia}`,
          cartao.nome,
          valor_total || 0,
          vencimento,
          cartao.conta_bancaria_id || null,
          observacoes || null
        ]
      );
      const lancamentoApId = apRes.rows[0].id;

      // Criar fatura
      const faturaRes = await client.query(
        `INSERT INTO faturas_cartao
           (tenant_id, cliente_id, cartao_id, competencia, vencimento, valor_total, lancamento_ap_id, observacoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [req.tenantId, cartao.cliente_id, req.params.cartaoId, competencia, vencimento, valor_total || 0, lancamentoApId, observacoes || null]
      );

      await client.query("COMMIT");
      res.status(201).json({ ...faturaRes.rows[0], lancamento_ap_id: lancamentoApId });
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ message: e.message });
    } finally {
      client.release();
    }
  });

  // Atualizar valor total da fatura (recalcula a partir das transações)
  app.post("/api/control/faturas/:faturaId/recalcular", ...auth, async (req: any, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const soma = await client.query(
        `SELECT COALESCE(SUM(valor), 0) as total
         FROM transacoes_cartao
         WHERE fatura_id = $1 AND tipo_transacao = 'compra'`,
        [req.params.faturaId]
      );
      const total = parseFloat(soma.rows[0].total);

      const faturaRes = await client.query(
        `UPDATE faturas_cartao SET valor_total = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3 RETURNING *`,
        [total, req.params.faturaId, req.tenantId]
      );
      if (!faturaRes.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Fatura não encontrada" });
      }

      // Atualizar lançamento AP correspondente
      if (faturaRes.rows[0].lancamento_ap_id) {
        await client.query(
          `UPDATE lancamentos_financeiros SET valor = $1, updated_at = NOW()
           WHERE id = $2 AND status NOT IN ('pago','cancelado')`,
          [total, faturaRes.rows[0].lancamento_ap_id]
        );
      }

      await client.query("COMMIT");
      res.json({ ...faturaRes.rows[0], novo_total: total });
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ message: e.message });
    } finally {
      client.release();
    }
  });

  // ===========================================================================
  // ③ TRANSAÇÕES DO CARTÃO — CRUD + CLASSIFICAÇÃO
  // ===========================================================================

  // Listar transações de uma fatura
  app.get("/api/control/faturas/:faturaId/transacoes", ...auth, async (req: any, res) => {
    try {
      const r = await pool.query(
        `SELECT tc.*,
                pc.descricao as plano_conta_descricao, pc.codigo as plano_conta_codigo,
                cc.nome as centro_custo_nome
         FROM transacoes_cartao tc
         LEFT JOIN planos_contas pc ON pc.id = tc.plano_conta_id
         LEFT JOIN centros_custo cc ON cc.id = tc.centro_custo_id
         WHERE tc.fatura_id = $1 AND tc.tenant_id = $2
         ORDER BY tc.data_transacao DESC`,
        [req.params.faturaId, req.tenantId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Criar transação manual
  app.post("/api/control/faturas/:faturaId/transacoes", ...auth, async (req: any, res) => {
    try {
      const { portador, estabelecimento, data_transacao, valor, tipo_transacao, mcc, plano_conta_id, centro_custo_id, observacoes } = req.body;
      if (!data_transacao || !valor) return res.status(400).json({ message: "Data e valor são obrigatórios" });

      const r = await pool.query(
        `INSERT INTO transacoes_cartao
           (tenant_id, fatura_id, portador, estabelecimento, data_transacao, valor,
            tipo_transacao, mcc, plano_conta_id, centro_custo_id, observacoes, origem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'manual')
         RETURNING *`,
        [req.tenantId, req.params.faturaId, portador, estabelecimento, data_transacao, valor,
         tipo_transacao || "compra", mcc || null, plano_conta_id || null, centro_custo_id || null, observacoes || null]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Classificar transação (atribuir plano de contas e centro de custo)
  app.patch("/api/control/transacoes-cartao/:id/classificar", ...auth, async (req: any, res) => {
    try {
      const { plano_conta_id, centro_custo_id, observacoes } = req.body;
      const r = await pool.query(
        `UPDATE transacoes_cartao SET
           plano_conta_id = COALESCE($1, plano_conta_id),
           centro_custo_id = COALESCE($2, centro_custo_id),
           observacoes = COALESCE($3, observacoes),
           updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5
         RETURNING *`,
        [plano_conta_id || null, centro_custo_id || null, observacoes || null, req.params.id, req.tenantId]
      );
      if (!r.rowCount) return res.status(404).json({ message: "Transação não encontrada" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Excluir transação
  app.delete("/api/control/transacoes-cartao/:id", ...auth, async (req: any, res) => {
    try {
      await pool.query(`DELETE FROM transacoes_cartao WHERE id = $1 AND tenant_id = $2`, [req.params.id, req.tenantId]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===========================================================================
  // ④ IMPORTAÇÃO CSV CAJU
  // ===========================================================================

  // Preview da importação (não persiste)
  app.post("/api/control/faturas/:faturaId/importar-caju/preview", ...auth, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });

      const content = req.file.buffer.toString("utf-8");
      const rows = csvParse(content, { delimiter: ";", columns: true, skip_empty_lines: true, trim: true });

      const preview: any[] = [];
      let ignoradas = 0;

      for (const row of rows as any[]) {
        const tipo = (row["Tipo de Transação"] || "").trim();
        // Ignorar Depósito e Resgate — apenas Compra
        if (!tipo.toLowerCase().includes("compra")) {
          ignoradas++;
          continue;
        }
        const statusTx = (row["Status da Transação"] || "").trim();
        const valorStr = (row["Valor (R$)"] || "").trim();
        const valor = parseBRL(valorStr);
        if (!valor) continue;

        preview.push({
          portador: (row["Nome do Colaborador"] || "").trim(),
          estabelecimento: (row["Nome do Estabelecimento"] || "").trim(),
          data_transacao: parseDataCaju(row["Data"] || ""),
          valor,
          tipo_transacao: "compra",
          mcc: (row["MCC"] || "").trim(),
          categoria_mcc: (row["Categoria do Estabelecimento"] || "").trim(),
          status_transacao: statusTx.toLowerCase() === "pendente" ? "pendente" : "concluida",
          origem: "caju_csv",
        });
      }

      res.json({ total: preview.length, ignoradas, preview: preview.slice(0, 50), preview_completo: preview });
    } catch (e: any) {
      res.status(400).json({ message: `Erro ao parsear CSV: ${e.message}` });
    }
  });

  // Confirmar importação Caju
  app.post("/api/control/faturas/:faturaId/importar-caju/confirmar", ...auth, async (req: any, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { transacoes } = req.body as { transacoes: any[] };
      if (!transacoes?.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Nenhuma transação enviada" });
      }

      // Verificar que a fatura pertence ao tenant
      const faturaCheck = await client.query(
        `SELECT id, cliente_id FROM faturas_cartao WHERE id = $1 AND tenant_id = $2`,
        [req.params.faturaId, req.tenantId]
      );
      if (!faturaCheck.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Fatura não encontrada" });
      }

      let importadas = 0;
      for (const tx of transacoes) {
        await client.query(
          `INSERT INTO transacoes_cartao
             (tenant_id, fatura_id, portador, estabelecimento, data_transacao, valor,
              tipo_transacao, mcc, categoria_mcc, status_transacao, origem)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            req.tenantId, req.params.faturaId,
            tx.portador, tx.estabelecimento, tx.data_transacao, tx.valor,
            tx.tipo_transacao || "compra", tx.mcc || null, tx.categoria_mcc || null,
            tx.status_transacao || "pendente", "caju_csv"
          ]
        );
        importadas++;
      }

      // Recalcular valor total da fatura
      const soma = await client.query(
        `SELECT COALESCE(SUM(valor), 0) as total FROM transacoes_cartao
         WHERE fatura_id = $1 AND tipo_transacao = 'compra'`,
        [req.params.faturaId]
      );
      const novoTotal = parseFloat(soma.rows[0].total);
      await client.query(
        `UPDATE faturas_cartao SET valor_total = $1, updated_at = NOW() WHERE id = $2`,
        [novoTotal, req.params.faturaId]
      );

      // Atualizar lançamento AP
      const fatura = (await client.query(`SELECT lancamento_ap_id FROM faturas_cartao WHERE id = $1`, [req.params.faturaId])).rows[0];
      if (fatura?.lancamento_ap_id) {
        await client.query(
          `UPDATE lancamentos_financeiros SET valor = $1, updated_at = NOW()
           WHERE id = $2 AND status NOT IN ('pago','cancelado')`,
          [novoTotal, fatura.lancamento_ap_id]
        );
      }

      await client.query("COMMIT");
      res.json({ importadas, novo_total: novoTotal });
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ message: e.message });
    } finally {
      client.release();
    }
  });

  // ===========================================================================
  // ⑤ ANEXOS DE LANÇAMENTOS
  // ===========================================================================

  // Listar anexos de um lançamento
  app.get("/api/control/lancamentos/:lancamentoId/anexos", ...auth, async (req: any, res) => {
    try {
      const r = await pool.query(
        `SELECT la.*, u.name as uploaded_por_nome
         FROM lancamento_anexos la
         LEFT JOIN users u ON u.id = la.uploaded_por
         WHERE la.lancamento_id = $1 AND la.tenant_id = $2
         ORDER BY la.created_at DESC`,
        [req.params.lancamentoId, req.tenantId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Upload de anexo (armazena localmente; em produção substituir por S3/MinIO)
  app.post("/api/control/lancamentos/:lancamentoId/anexos", ...auth, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });

      const tipo = (req.body.tipo || "documento") as string;
      const tiposValidos = ["boleto", "nota_fiscal", "contrato", "documento", "outro"];
      if (!tiposValidos.includes(tipo)) return res.status(400).json({ message: "Tipo inválido" });

      // Em produção: fazer upload para S3/MinIO e obter URL
      // Aqui: armazena como base64 em data URI (simplificado para integração)
      const base64 = req.file.buffer.toString("base64");
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;

      const r = await pool.query(
        `INSERT INTO lancamento_anexos
           (tenant_id, lancamento_id, tipo, nome_arquivo, url_storage, tamanho_bytes, mime_type, uploaded_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          req.tenantId, req.params.lancamentoId, tipo,
          req.file.originalname, dataUri, req.file.size, req.file.mimetype,
          req.user?.id || null
        ]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Excluir anexo
  app.delete("/api/control/anexos/:id", ...auth, async (req: any, res) => {
    try {
      await pool.query(`DELETE FROM lancamento_anexos WHERE id = $1 AND tenant_id = $2`, [req.params.id, req.tenantId]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===========================================================================
  // ⑥ WORKFLOW DE PAGAMENTO
  // ===========================================================================

  // Programar pagamento (Operador → envia para diretor)
  app.post("/api/control/lancamentos/:id/programar", ...auth, async (req: any, res) => {
    try {
      const r = await pool.query(
        `UPDATE lancamentos_financeiros SET
           workflow_status = 'programado',
           programado_por = $1,
           data_programacao = NOW(),
           updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3
           AND status NOT IN ('pago','cancelado')
           AND (workflow_status IS NULL OR workflow_status = 'programado')
         RETURNING *`,
        [req.user?.id || null, req.params.id, req.tenantId]
      );
      if (!r.rowCount) return res.status(400).json({ message: "Lançamento não pode ser programado" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Programar lote (múltiplos lançamentos de uma vez)
  app.post("/api/control/clientes/:clienteId/programar-lote", ...auth, async (req: any, res) => {
    try {
      const { ids } = req.body as { ids: string[] };
      if (!ids?.length) return res.status(400).json({ message: "Nenhum lançamento selecionado" });

      const placeholders = ids.map((_, i) => `$${i + 3}`).join(",");
      const r = await pool.query(
        `UPDATE lancamentos_financeiros SET
           workflow_status = 'programado',
           programado_por = $1,
           data_programacao = NOW(),
           updated_at = NOW()
         WHERE tenant_id = $2
           AND id IN (${placeholders})
           AND status NOT IN ('pago','cancelado')
         RETURNING id`,
        [req.user?.id || null, req.tenantId, ...ids]
      );
      res.json({ programados: r.rowCount, ids: r.rows.map((x: any) => x.id) });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Autorizar pagamento (Diretor)
  app.post("/api/control/lancamentos/:id/autorizar", ...auth, async (req: any, res) => {
    try {
      const r = await pool.query(
        `UPDATE lancamentos_financeiros SET
           workflow_status = 'autorizado',
           autorizado_por = $1,
           data_autorizacao = NOW(),
           updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3 AND workflow_status = 'programado'
         RETURNING *`,
        [req.user?.id || null, req.params.id, req.tenantId]
      );
      if (!r.rowCount) return res.status(400).json({ message: "Lançamento precisa estar 'programado' para ser autorizado" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Autorizar lote
  app.post("/api/control/clientes/:clienteId/autorizar-lote", ...auth, async (req: any, res) => {
    try {
      const { ids } = req.body as { ids: string[] };
      if (!ids?.length) return res.status(400).json({ message: "Nenhum lançamento selecionado" });

      const placeholders = ids.map((_, i) => `$${i + 3}`).join(",");
      const r = await pool.query(
        `UPDATE lancamentos_financeiros SET
           workflow_status = 'autorizado',
           autorizado_por = $1,
           data_autorizacao = NOW(),
           updated_at = NOW()
         WHERE tenant_id = $2 AND id IN (${placeholders}) AND workflow_status = 'programado'
         RETURNING id`,
        [req.user?.id || null, req.tenantId, ...ids]
      );
      res.json({ autorizados: r.rowCount, ids: r.rows.map((x: any) => x.id) });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Marcar como pago (Diretor — individual)
  app.post("/api/control/lancamentos/:id/marcar-pago", ...auth, async (req: any, res) => {
    try {
      const { comprovante } = req.body;
      const r = await pool.query(
        `UPDATE lancamentos_financeiros SET
           workflow_status = 'pago',
           pago_por = $1,
           data_pagamento_efetuado = NOW(),
           comprovante_pagamento = COALESCE($2, comprovante_pagamento),
           updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4 AND workflow_status = 'autorizado'
         RETURNING *`,
        [req.user?.id || null, comprovante || null, req.params.id, req.tenantId]
      );
      if (!r.rowCount) return res.status(400).json({ message: "Lançamento precisa estar 'autorizado' para ser marcado como pago" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Marcar como pago em LOTE (cria lote_pagamento)
  app.post("/api/control/clientes/:clienteId/marcar-pago-lote", ...auth, async (req: any, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { ids, data_pagamento, descricao, comprovante_url } = req.body as {
        ids: string[]; data_pagamento: string; descricao?: string; comprovante_url?: string;
      };
      if (!ids?.length) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Nenhum lançamento" }); }
      if (!data_pagamento) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Data de pagamento obrigatória" }); }

      const placeholders = ids.map((_, i) => `$${i + 3}`).join(",");
      const soma = await client.query(
        `SELECT COALESCE(SUM(valor::numeric), 0) as total, COUNT(*) as qtd
         FROM lancamentos_financeiros
         WHERE tenant_id = $1 AND id IN (${placeholders}) AND workflow_status = 'autorizado'`,
        [req.tenantId, req.user?.id || null, ...ids]
      );
      const totalValor = parseFloat(soma.rows[0].total);
      const qtd = parseInt(soma.rows[0].qtd);

      // Criar registro de lote
      const loteRes = await client.query(
        `INSERT INTO lotes_pagamento
           (tenant_id, cliente_id, descricao, data_pagamento, total_valor, qtd_lancamentos, pago_por, comprovante_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [req.tenantId, req.params.clienteId, descricao || `Lote ${data_pagamento}`, data_pagamento, totalValor, qtd, req.user?.id || null, comprovante_url || null]
      );
      const loteId = loteRes.rows[0].id;

      // Atualizar lançamentos
      const r = await client.query(
        `UPDATE lancamentos_financeiros SET
           workflow_status = 'pago',
           pago_por = $1,
           data_pagamento_efetuado = $2,
           lote_pagamento_id = $3,
           updated_at = NOW()
         WHERE tenant_id = $4 AND id IN (${placeholders}) AND workflow_status = 'autorizado'
         RETURNING id`,
        [req.user?.id || null, data_pagamento, loteId, req.tenantId, ...ids]
      );

      await client.query("COMMIT");
      res.json({ lote_id: loteId, pagos: r.rowCount, total_valor: totalValor });
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ message: e.message });
    } finally {
      client.release();
    }
  });

  // Devolver para programação (rejeitar autorização)
  app.post("/api/control/lancamentos/:id/devolver", ...auth, async (req: any, res) => {
    try {
      const r = await pool.query(
        `UPDATE lancamentos_financeiros SET
           workflow_status = NULL,
           autorizado_por = NULL,
           data_autorizacao = NULL,
           updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND workflow_status IN ('programado','autorizado')
         RETURNING *`,
        [req.params.id, req.tenantId]
      );
      if (!r.rowCount) return res.status(400).json({ message: "Lançamento não pode ser devolvido" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===========================================================================
  // ⑦ LISTAGENS ESPECIALIZADAS DO WORKFLOW
  // ===========================================================================

  // Fila de programação (Operador envia)
  app.get("/api/control/clientes/:clienteId/fila-programacao", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      const r = await pool.query(
        `SELECT lf.*,
                pc.descricao as plano_conta_descricao,
                cc.nome as centro_custo_nome,
                u.name as programado_por_nome
         FROM lancamentos_financeiros lf
         LEFT JOIN planos_contas pc ON pc.id = lf.plano_conta_id
         LEFT JOIN centros_custo cc ON cc.id = lf.centro_custo_id
         LEFT JOIN users u ON u.id = lf.programado_por
         WHERE lf.cliente_id = $1 AND lf.tenant_id = $2
           AND lf.tipo = 'pagar'
           AND lf.status NOT IN ('cancelado')
           AND (lf.workflow_status IS NULL OR lf.workflow_status = 'programado')
         ORDER BY lf.data_vencimento ASC`,
        [req.params.clienteId, req.tenantId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Fila do diretor (pendentes de autorização ou marcar como pago)
  app.get("/api/control/clientes/:clienteId/fila-diretor", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      const r = await pool.query(
        `SELECT lf.*,
                pc.descricao as plano_conta_descricao,
                cc.nome as centro_custo_nome,
                u1.name as programado_por_nome,
                u2.name as autorizado_por_nome
         FROM lancamentos_financeiros lf
         LEFT JOIN planos_contas pc ON pc.id = lf.plano_conta_id
         LEFT JOIN centros_custo cc ON cc.id = lf.centro_custo_id
         LEFT JOIN users u1 ON u1.id = lf.programado_por
         LEFT JOIN users u2 ON u2.id = lf.autorizado_por
         WHERE lf.cliente_id = $1 AND lf.tenant_id = $2
           AND lf.workflow_status IN ('programado','autorizado')
         ORDER BY lf.data_vencimento ASC`,
        [req.params.clienteId, req.tenantId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Relatório de pagamentos do dia / período (visão do diretor pós-pagamento)
  app.get("/api/control/clientes/:clienteId/relatorio-workflow", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      const { data_ini, data_fim, workflow_status } = req.query as any;
      const filtroStatus = workflow_status ? `AND lf.workflow_status = '${workflow_status}'` : "";
      const filtroData = data_ini && data_fim
        ? `AND lf.data_pagamento_efetuado::date BETWEEN '${data_ini}' AND '${data_fim}'`
        : "";

      const r = await pool.query(
        `SELECT lf.*,
                pc.descricao as plano_conta_descricao,
                cc.nome as centro_custo_nome,
                u1.name as programado_por_nome,
                u2.name as autorizado_por_nome,
                u3.name as pago_por_nome,
                u4.name as conciliado_por_nome,
                lp.descricao as lote_descricao
         FROM lancamentos_financeiros lf
         LEFT JOIN planos_contas pc ON pc.id = lf.plano_conta_id
         LEFT JOIN centros_custo cc ON cc.id = lf.centro_custo_id
         LEFT JOIN users u1 ON u1.id = lf.programado_por
         LEFT JOIN users u2 ON u2.id = lf.autorizado_por
         LEFT JOIN users u3 ON u3.id = lf.pago_por
         LEFT JOIN users u4 ON u4.id = lf.conciliado_por
         LEFT JOIN lotes_pagamento lp ON lp.id = lf.lote_pagamento_id
         WHERE lf.cliente_id = $1 AND lf.tenant_id = $2
           AND lf.workflow_status IN ('pago','conciliado')
           ${filtroStatus} ${filtroData}
         ORDER BY lf.data_pagamento_efetuado DESC`,
        [req.params.clienteId, req.tenantId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Fila de conciliação (Operador quita após pagamento do Diretor)
  app.get("/api/control/clientes/:clienteId/fila-conciliacao-workflow", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      const r = await pool.query(
        `SELECT lf.*,
                pc.descricao as plano_conta_descricao,
                u3.name as pago_por_nome
         FROM lancamentos_financeiros lf
         LEFT JOIN planos_contas pc ON pc.id = lf.plano_conta_id
         LEFT JOIN users u3 ON u3.id = lf.pago_por
         WHERE lf.cliente_id = $1 AND lf.tenant_id = $2
           AND lf.workflow_status = 'pago'
         ORDER BY lf.data_pagamento_efetuado DESC`,
        [req.params.clienteId, req.tenantId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Conciliar workflow (quitar no sistema após confirmação do pagamento)
  app.post("/api/control/lancamentos/:id/conciliar-workflow", ...auth, async (req: any, res) => {
    try {
      const { conta_bancaria_id, data_pagamento } = req.body;
      if (!conta_bancaria_id || !data_pagamento) {
        return res.status(400).json({ message: "Conta bancária e data de pagamento obrigatórios" });
      }
      const r = await pool.query(
        `UPDATE lancamentos_financeiros SET
           workflow_status = 'conciliado',
           conciliado_por = $1,
           data_conciliacao_workflow = NOW(),
           status = 'pago',
           data_pagamento = $2,
           conta_bancaria_id = $3,
           updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5 AND workflow_status = 'pago'
         RETURNING *`,
        [req.user?.id || null, data_pagamento, conta_bancaria_id, req.params.id, req.tenantId]
      );
      if (!r.rowCount) return res.status(400).json({ message: "Lançamento precisa estar 'pago' para ser conciliado" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Lotes de pagamento — listagem
  app.get("/api/control/clientes/:clienteId/lotes-pagamento", ...auth, async (req: any, res) => {
    try {
      const r = await pool.query(
        `SELECT lp.*, u.name as pago_por_nome
         FROM lotes_pagamento lp
         LEFT JOIN users u ON u.id = lp.pago_por
         WHERE lp.cliente_id = $1 AND lp.tenant_id = $2
         ORDER BY lp.data_pagamento DESC`,
        [req.params.clienteId, req.tenantId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

function parseDataCaju(dataStr: string): string {
  // Formato Caju: "20/05/2026 09:12"
  if (!dataStr) return new Date().toISOString();
  const [datePart, timePart] = dataStr.split(" ");
  if (!datePart) return new Date().toISOString();
  const [d, m, y] = datePart.split("/");
  return `${y}-${m}-${d}T${timePart || "00:00"}:00`;
}
