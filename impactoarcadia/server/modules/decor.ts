import { runDecorExp07Seed } from "./decor-seed-exp07";
import { registerAgendaRoutes } from "./routes_agenda";

/**
 * Arcádia Suite — Módulo Decor
 * API REST: /api/modules/decor/*
 *
 * Rotas:
 *   GET    /pedidos              — listar pedidos (com filtros)
 *   POST   /pedidos              — criar pedido
 *   GET    /pedidos/:id          — detalhe do pedido
 *   PATCH  /pedidos/:id          — atualizar pedido
 *   DELETE /pedidos/:id          — excluir rascunho
 *   POST   /pedidos/:id/efetivar — efetivar → gera 2 AR no Control
 *   GET    /pedidos/:id/checklist
 *   PATCH  /pedidos/:id/checklist
 *   GET    /pedidos/:id/medicoes
 *   POST   /pedidos/:id/medicoes
 *   GET    /pedidos/:id/itens
 *   POST   /pedidos/:id/itens
 *   DELETE /pedidos/:id/itens/:itemId
 *   GET    /pedidos/:id/os-producao
 *   POST   /pedidos/:id/os-producao
 *   PATCH  /pedidos/:id/os-producao/:osId
 *   GET    /pedidos/:id/os-instalacao
 *   POST   /pedidos/:id/os-instalacao
 *   PATCH  /pedidos/:id/os-instalacao/:osId
 *   GET    /pedidos/:id/analise-tecnica
 *   POST   /pedidos/:id/analise-tecnica
 *   GET    /catalogo             — catálogo de tecidos/sistemas
 *   POST   /catalogo             — criar item catálogo
 *   PATCH  /catalogo/:id         — atualizar item catálogo
 *   GET    /coeficientes         — tabela de coeficientes
 *   POST   /calcular-cortina     — cálculo técnico em tempo real
 *   POST   /admin/seed-catalogo  — (re)seed catálogo + coeficientes
 *   GET    /stats                — dashboard stats
 */

import { Router } from "express";
import pg from "pg";
import { runDecorSeed } from "../seeds/decorSeed.js";
import crypto from "crypto";
import { requireSegmento } from "../middleware/requireSegmento.js";

const router = Router();

// SEG-05 — protege todas as rotas deste módulo para o segmento correto
router.use(requireSegmento("decoracao_cortinas"));

function getPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

function getTenantId(req: any): string {
  return req.session?.tenantId?.toString() ?? "1";
}

function newId(): string {
  return crypto.randomUUID();
}

// ─── Número sequencial de pedido ─────────────────────────────────────────────
async function gerarNumeroPedido(pool: pg.Pool, tenantId: string): Promise<string> {
  const ano = new Date().getFullYear();
  const res = await pool.query(
    `SELECT COUNT(*)+1 AS seq FROM cortiart_pedidos WHERE tenant_id=$1 AND EXTRACT(YEAR FROM created_at)=$2`,
    [tenantId, ano]
  );
  const seq = String(res.rows[0].seq).padStart(4, "0");
  return `CORT-${ano}-${seq}`;
}

// ─── GET /pedidos ─────────────────────────────────────────────────────────────
router.get("/pedidos", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const { status, clienteId, q, limit = "50", offset = "0" } = req.query as any;

    let where = "WHERE tenant_id = $1";
    const params: any[] = [tenantId];
    let pi = 2;

    if (status) { where += ` AND status = $${pi++}`; params.push(status); }
    if (clienteId) { where += ` AND cliente_id = $${pi++}`; params.push(clienteId); }
    if (q) { where += ` AND (cliente_nome ILIKE $${pi} OR numero_pedido ILIKE $${pi})`; params.push(`%${q}%`); pi++; }

    const rows = await pool.query(
      `SELECT * FROM cortiart_pedidos ${where} ORDER BY created_at DESC LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    const total = await pool.query(`SELECT COUNT(*) FROM cortiart_pedidos ${where}`, params);

    res.json({ pedidos: rows.rows, total: parseInt(total.rows[0].count), limit: parseInt(limit), offset: parseInt(offset) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

// ─── POST /pedidos ────────────────────────────────────────────────────────────
router.post("/pedidos", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const id = newId();
    const numeroPedido = await gerarNumeroPedido(pool, tenantId);
    const { clienteNome, clienteId, clienteCpf, enderecoObra, cidadeObra, xosContactId, xosDealId, observacoes, createdBy } = req.body;

    const result = await pool.query(
      `INSERT INTO cortiart_pedidos (id, tenant_id, numero_pedido, status, cliente_id, cliente_nome, cliente_cpf,
         endereco_obra, cidade_obra, xos_contact_id, xos_deal_id, observacoes, created_by)
       VALUES ($1,$2,$3,'rascunho',$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [id, tenantId, numeroPedido, clienteId ?? null, clienteNome ?? null, clienteCpf ?? null,
       enderecoObra ?? null, cidadeObra ?? null, xosContactId ?? null, xosDealId ?? null, observacoes ?? null,
       createdBy ?? (req as any).session?.userId ?? null]
    );

    // Cria checklist inicial
    await pool.query(
      `INSERT INTO cortiart_checklist (id, pedido_id, tenant_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [newId(), id, tenantId]
    );

    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

// ─── GET /pedidos/:id ─────────────────────────────────────────────────────────
router.get("/pedidos/:id", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const pedido = await pool.query(`SELECT * FROM cortiart_pedidos WHERE id=$1 AND tenant_id=$2`, [req.params.id, tenantId]);
    if (!pedido.rows[0]) return res.status(404).json({ error: "Pedido não encontrado" });

    const [medicoes, itens, checklist, osProd, osInst, analise] = await Promise.all([
      pool.query(`SELECT * FROM cortiart_medicoes WHERE pedido_id=$1 ORDER BY created_at`, [req.params.id]),
      pool.query(`SELECT * FROM cortiart_itens_pedido WHERE pedido_id=$1 ORDER BY created_at`, [req.params.id]),
      pool.query(`SELECT * FROM cortiart_checklist WHERE pedido_id=$1`, [req.params.id]),
      pool.query(`SELECT * FROM cortiart_os_producao WHERE pedido_id=$1 ORDER BY created_at`, [req.params.id]),
      pool.query(`SELECT oi.*, inst.nome as instalador_nome, inst.telefone as instalador_fone FROM cortiart_os_instalacao oi LEFT JOIN cortiart_instaladores inst ON inst.id = oi.instalador_id_fk WHERE oi.pedido_id=$1 ORDER BY oi.created_at`, [req.params.id]),
      pool.query(`SELECT * FROM cortiart_analise_tecnica WHERE pedido_id=$1 ORDER BY created_at DESC LIMIT 20`, [req.params.id]),
    ]);

    res.json({
      ...pedido.rows[0],
      medicoes: medicoes.rows,
      itens: itens.rows,
      checklist: checklist.rows[0] ?? null,
      os_producao: osProd.rows,
      os_instalacao: osInst.rows,
      analise_tecnica: analise.rows,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

// ─── PATCH /pedidos/:id ───────────────────────────────────────────────────────
router.patch("/pedidos/:id", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const allowed = ["status","cliente_nome","cliente_id","cliente_cpf","endereco_obra","cidade_obra",
      "xos_contact_id","xos_deal_id","valor_subtotal","valor_desconto","valor_mao_obra","valor_final",
      "data_medicao","data_instalacao","data_expedicao","analise_tecnica_status","analise_tecnica_motivo",
      "analise_tecnica_responsavel","observacoes","referencia_externa","negociacao",
      // DEC-EXP-01 — campos capa e dados complementares
      "torre","apartamento","data_aniversario","vendedor_nome","horario_instalacao",
      "condicao_pagamento_id","tipo_pagamento_codigo","num_parcelas","prazo_entrega_dias","status_obra",
      "complemento","bairro","uf","cliente_fone","cliente_email"];

    const updates = Object.entries(req.body)
      .filter(([k]) => allowed.includes(k))
      .map(([k, v], i) => `${k} = $${i + 3}`)
      .join(", ");
    const values = Object.entries(req.body)
      .filter(([k]) => allowed.includes(k))
      .map(([, v]) => v);

    if (!updates) return res.status(400).json({ error: "Nenhum campo válido para atualizar" });

    const result = await pool.query(
      `UPDATE cortiart_pedidos SET ${updates}, updated_at=NOW() WHERE id=$1 AND tenant_id=$2 RETURNING *`,
      [req.params.id, tenantId, ...values]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Pedido não encontrado" });
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

// ─── DELETE /pedidos/:id ──────────────────────────────────────────────────────
router.delete("/pedidos/:id", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const check = await pool.query(`SELECT status FROM cortiart_pedidos WHERE id=$1 AND tenant_id=$2`, [req.params.id, tenantId]);
    if (!check.rows[0]) return res.status(404).json({ error: "Pedido não encontrado" });
    if (check.rows[0].status !== "rascunho") return res.status(400).json({ error: "Apenas rascunhos podem ser excluídos" });

    await pool.query(`DELETE FROM cortiart_pedidos WHERE id=$1 AND tenant_id=$2`, [req.params.id, tenantId]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

// ─── POST /pedidos/:id/efetivar ───────────────────────────────────────────────
router.post("/pedidos/:id/efetivar", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const pedidoRes = await pool.query(
      `SELECT * FROM cortiart_pedidos WHERE id=$1 AND tenant_id=$2`, [req.params.id, tenantId]
    );
    const pedido = pedidoRes.rows[0];
    if (!pedido) return res.status(404).json({ error: "Pedido não encontrado" });
    if (!["orcamento","aprovado"].includes(pedido.status)) {
      return res.status(400).json({ error: "Pedido precisa estar em status 'orcamento' ou 'aprovado' para efetivar" });
    }

    const valorTotal = parseFloat(pedido.valor_final) || 0;
    const entrada = parseFloat(req.body.percEntrada ?? "50") / 100;
    const valorEntrada = Math.round(valorTotal * entrada * 100) / 100;
    const valorSaldo = Math.round((valorTotal - valorEntrada) * 100) / 100;

    const vencEntrada = req.body.vencEntrada ?? new Date().toISOString().split("T")[0];
    const vencSaldo = req.body.vencSaldo ?? null;

    const arIds: string[] = [];

    // AR 1 — Entrada
    if (valorEntrada > 0) {
      const arId = newId();
      await pool.query(
        `INSERT INTO lancamentos_financeiros
           (id, tenant_id, tipo, descricao, valor, data_vencimento, status, origem, pedido_externo_id, pedido_externo_tipo)
         VALUES ($1,$2,'receita',$3,$4,$5,'pendente','decor',$6,'decor_pedido')`,
        [arId, tenantId, `Entrada — ${pedido.numero_pedido} (${pedido.cliente_nome ?? "cliente"})`,
         valorEntrada, vencEntrada, pedido.id]
      ).catch(() => {});
      arIds.push(arId);
    }

    // AR 2 — Saldo
    if (valorSaldo > 0) {
      const arId = newId();
      await pool.query(
        `INSERT INTO lancamentos_financeiros
           (id, tenant_id, tipo, descricao, valor, data_vencimento, status, origem, pedido_externo_id, pedido_externo_tipo)
         VALUES ($1,$2,'receita',$3,$4,$5,'pendente','decor',$6,'decor_pedido')`,
        [arId, tenantId, `Saldo — ${pedido.numero_pedido} (${pedido.cliente_nome ?? "cliente"})`,
         valorSaldo, vencSaldo, pedido.id]
      ).catch(() => {});
      arIds.push(arId);
    }

    // Atualiza status
    await pool.query(
      `UPDATE cortiart_pedidos SET status='efetivado', data_efetivacao=NOW(), updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );

    // Checklist
    await pool.query(
      `UPDATE cortiart_checklist SET orcamento_aprovado=true, pagamento_entrada=true, updated_at=NOW() WHERE pedido_id=$1`,
      [req.params.id]
    ).catch(() => {});

    res.json({ ok: true, ar_ids: arIds, valor_entrada: valorEntrada, valor_saldo: valorSaldo });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

// ─── Medições ─────────────────────────────────────────────────────────────────
router.get("/pedidos/:id/medicoes", async (req, res) => {
  const pool = getPool();
  try {
    const rows = await pool.query(`SELECT * FROM cortiart_medicoes WHERE pedido_id=$1 ORDER BY created_at`, [req.params.id]);
    res.json(rows.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.post("/pedidos/:id/medicoes", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const { ambiente, larguraVao, alturaVao, quantidadeVaos = 1, observacoes } = req.body;
    const result = await pool.query(
      `INSERT INTO cortiart_medicoes (id,pedido_id,tenant_id,ambiente,largura_vao,altura_vao,quantidade_vaos,observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [newId(), req.params.id, tenantId, ambiente, larguraVao, alturaVao, quantidadeVaos, observacoes ?? null]
    );
    await pool.query(`UPDATE cortiart_pedidos SET updated_at=NOW() WHERE id=$1`, [req.params.id]);
    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ─── Itens do pedido ──────────────────────────────────────────────────────────
router.get("/pedidos/:id/itens", async (req, res) => {
  const pool = getPool();
  try {
    const rows = await pool.query(`SELECT * FROM cortiart_itens_pedido WHERE pedido_id=$1 ORDER BY created_at`, [req.params.id]);
    res.json(rows.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.post("/pedidos/:id/itens", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const { medicaoId, tipoProduto, produto, ambiente, sistema, tecido, largura, altura,
            quantidade = 1, coeficiente, valorUnitario, valorMaoObra, outros } = req.body;

    const metragemTecido = largura && altura && coeficiente
      ? Math.round(parseFloat(largura) * parseFloat(altura) * parseFloat(coeficiente) * parseFloat(quantidade) * 1000) / 1000
      : null;
    const valorTotal = ((parseFloat(valorUnitario) || 0) + (parseFloat(valorMaoObra) || 0)) * parseFloat(quantidade);

    const result = await pool.query(
      `INSERT INTO cortiart_itens_pedido
         (id,pedido_id,medicao_id,tenant_id,tipo_produto,produto,ambiente,sistema,tecido,
          largura,altura,quantidade,metragem_tecido,coeficiente,valor_unitario,valor_mao_obra,valor_total,outros)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [newId(),req.params.id,medicaoId??null,tenantId,tipoProduto??null,produto??null,ambiente??null,
       sistema??null,tecido??null,largura??null,altura??null,quantidade,metragemTecido,
       coeficiente??null,valorUnitario??0,valorMaoObra??0,valorTotal,outros??null]
    );

    // Recalcula totais do pedido
    await pool.query(`
      UPDATE cortiart_pedidos SET
        valor_subtotal = (SELECT COALESCE(SUM(valor_total),0) FROM cortiart_itens_pedido WHERE pedido_id=$1),
        valor_mao_obra = (SELECT COALESCE(SUM(valor_mao_obra),0) FROM cortiart_itens_pedido WHERE pedido_id=$1),
        valor_final    = (SELECT COALESCE(SUM(valor_total),0)+COALESCE(SUM(valor_mao_obra),0) FROM cortiart_itens_pedido WHERE pedido_id=$1),
        updated_at=NOW()
      WHERE id=$1
    `, [req.params.id]);

    // DEC-EXP-01 — salvar campos persiana + Wave após o INSERT
    const wavePers: Record<string, any> = {};
    const wpFields = [
      "fornecedorPersiana","colecaoCor","acabamento","corPecas","altComando","ladoALado",
      "acionamento","tipoInstalacao","ladoComando",
      "divisaoA","divisaoB","modeloCortina","tecidoCodigo","tecidoLado","tecidoForroCodigo",
      "tecidoForroLadoA","tecidoForroLadoB","barraCodigo","barraObservacao","barraMedida",
      "barraDetalhes","altForro","trilhoTipo","trilhoMedida","cortineiroTipo","cortineiroFixacao",
      "altPisoTetoFolga",
      // DEC-EXP-07
      "comprimento","referenciaProduto","formatoTapete","observacaoTecnica",
    ];
    const dbMap: Record<string,string> = {
      fornecedorPersiana:"fornecedor_persiana", colecaoCor:"colecao_cor", acabamento:"acabamento",
      corPecas:"cor_pecas", altComando:"alt_comando", ladoALado:"lado_a_lado",
      acionamento:"acionamento", tipoInstalacao:"tipo_instalacao", ladoComando:"lado_comando",
      divisaoA:"divisao_a", divisaoB:"divisao_b", modeloCortina:"modelo_cortina",
      tecidoCodigo:"tecido_codigo", tecidoLado:"tecido_lado", tecidoForroCodigo:"tecido_forro_codigo",
      tecidoForroLadoA:"tecido_forro_lado_a", tecidoForroLadoB:"tecido_forro_lado_b",
      barraCodigo:"barra_codigo", barraObservacao:"barra_observacao", barraMedida:"barra_medida",
      barraDetalhes:"barra_detalhes", altForro:"alt_forro", trilhoTipo:"trilho_tipo",
      trilhoMedida:"trilho_medida", cortineiroTipo:"cortineiro_tipo",
      cortineiroFixacao:"cortineiro_fixacao", altPisoTetoFolga:"altura_piso_teto_folga",
      // DEC-EXP-07 — Outros
      comprimento:"comprimento", referenciaProduto:"referencia_produto",
      formatoTapete:"formato_tapete", observacaoTecnica:"observacao_tecnica",
    };
    wpFields.forEach(f => { if (req.body[f] !== undefined) wavePers[f] = req.body[f]; });
    if (Object.keys(wavePers).length > 0) {
      const setc = Object.keys(wavePers).map((k,i) => `${dbMap[k]}=$${i+2}`).join(",");
      const vals = Object.values(wavePers);
      await pool.query(`UPDATE cortiart_itens_pedido SET ${setc} WHERE id=$1`, [result.rows[0].id, ...vals]).catch(() => {});
    }

    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.delete("/pedidos/:id/itens/:itemId", async (req, res) => {
  const pool = getPool();
  try {
    await pool.query(`DELETE FROM cortiart_itens_pedido WHERE id=$1 AND pedido_id=$2`, [req.params.itemId, req.params.id]);
    await pool.query(`
      UPDATE cortiart_pedidos SET
        valor_subtotal = (SELECT COALESCE(SUM(valor_total),0) FROM cortiart_itens_pedido WHERE pedido_id=$1),
        valor_final    = (SELECT COALESCE(SUM(valor_total),0)+COALESCE(SUM(valor_mao_obra),0) FROM cortiart_itens_pedido WHERE pedido_id=$1),
        updated_at=NOW()
      WHERE id=$1
    `, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ─── OS Produção ──────────────────────────────────────────────────────────────
router.get("/pedidos/:id/os-producao", async (req, res) => {
  const pool = getPool();
  try {
    const rows = await pool.query(`SELECT * FROM cortiart_os_producao WHERE pedido_id=$1 ORDER BY created_at`, [req.params.id]);
    res.json(rows.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.post("/pedidos/:id/os-producao", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const { itemId, ambiente, etapa, tecidoId, metragemTecido, responsavelId, observacoes } = req.body;
    const result = await pool.query(
      `INSERT INTO cortiart_os_producao (id,pedido_id,tenant_id,item_id,ambiente,etapa,tecido_id,metragem_tecido,responsavel_id,observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [newId(),req.params.id,tenantId,itemId??null,ambiente??null,etapa??null,tecidoId??null,metragemTecido??null,responsavelId??null,observacoes??null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.patch("/pedidos/:id/os-producao/:osId", async (req, res) => {
  const pool = getPool();
  try {
    const { status, dataInicio, dataConclusao, observacoes } = req.body;
    const updates: string[] = [];
    const values: any[] = [req.params.osId];
    let pi = 2;
    if (status)        { updates.push(`status=$${pi++}`); values.push(status); }
    if (dataInicio)    { updates.push(`data_inicio=$${pi++}`); values.push(dataInicio); }
    if (dataConclusao) { updates.push(`data_conclusao=$${pi++}`); values.push(dataConclusao); }
    if (observacoes)   { updates.push(`observacoes=$${pi++}`); values.push(observacoes); }
    if (!updates.length) return res.status(400).json({ error: "Nada a atualizar" });
    const result = await pool.query(`UPDATE cortiart_os_producao SET ${updates.join(",")} WHERE id=$1 RETURNING *`, values);
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ─── OS Instalação ────────────────────────────────────────────────────────────
router.get("/pedidos/:id/os-instalacao", async (req, res) => {
  const pool = getPool();
  try {
    const rows = await pool.query(`SELECT * FROM cortiart_os_instalacao WHERE pedido_id=$1 ORDER BY created_at`, [req.params.id]);
    res.json(rows.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.post("/pedidos/:id/os-instalacao", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const { instaladorId, dataAgendamento, horaAgendamento, enderecoInstalacao, observacoes } = req.body;
    const result = await pool.query(
      `INSERT INTO cortiart_os_instalacao (id,pedido_id,tenant_id,instalador_id,data_agendamento,hora_agendamento,endereco_instalacao,observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [newId(),req.params.id,tenantId,instaladorId??null,dataAgendamento??null,horaAgendamento??null,enderecoInstalacao??null,observacoes??null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.patch("/pedidos/:id/os-instalacao/:osId", async (req, res) => {
  const pool = getPool();
  try {
    const { status, dataConclusao, termoAssinado, termoAssinadoEm, observacoes } = req.body;
    const updates: string[] = [];
    const values: any[] = [req.params.osId];
    let pi = 2;
    if (status)          { updates.push(`status=$${pi++}`); values.push(status); }
    if (dataConclusao)   { updates.push(`data_conclusao=$${pi++}`); values.push(dataConclusao); }
    if (termoAssinado !== undefined) { updates.push(`termo_assinado=$${pi++}`); values.push(termoAssinado); }
    if (termoAssinadoEm) { updates.push(`termo_assinado_em=$${pi++}`); values.push(termoAssinadoEm); }
    if (observacoes)     { updates.push(`observacoes=$${pi++}`); values.push(observacoes); }
    if (!updates.length) return res.status(400).json({ error: "Nada a atualizar" });
    const result = await pool.query(`UPDATE cortiart_os_instalacao SET ${updates.join(",")} WHERE id=$1 RETURNING *`, values);
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ─── Análise Técnica ──────────────────────────────────────────────────────────
router.get("/pedidos/:id/analise-tecnica", async (req, res) => {
  const pool = getPool();
  try {
    const rows = await pool.query(`SELECT * FROM cortiart_analise_tecnica WHERE pedido_id=$1 ORDER BY created_at DESC`, [req.params.id]);
    res.json(rows.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.post("/pedidos/:id/analise-tecnica", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const { acao, usuarioId, observacao } = req.body;
    if (!acao) return res.status(400).json({ error: "acao é obrigatório" });

    const result = await pool.query(
      `INSERT INTO cortiart_analise_tecnica (id,pedido_id,tenant_id,acao,usuario_id,observacao) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [newId(),req.params.id,tenantId,acao,usuarioId??null,observacao??null]
    );

    // Atualiza status na tabela principal
    const statusMap: Record<string,string> = {
      enviado: "analise_tecnica", analisando: "analise_tecnica",
      aprovado: "aprovado", retornado: "medicao", solicitado_info: "analise_tecnica",
    };
    if (statusMap[acao]) {
      await pool.query(
        `UPDATE cortiart_pedidos SET analise_tecnica_status=$1, analise_tecnica_data=NOW(), updated_at=NOW() WHERE id=$2`,
        [acao, req.params.id]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ─── Checklist ────────────────────────────────────────────────────────────────
router.get("/pedidos/:id/checklist", async (req, res) => {
  const pool = getPool();
  try {
    const rows = await pool.query(`SELECT * FROM cortiart_checklist WHERE pedido_id=$1`, [req.params.id]);
    res.json(rows.rows[0] ?? null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.patch("/pedidos/:id/checklist", async (req, res) => {
  const pool = getPool();
  try {
    const fields = ["medicao_ok","orcamento_aprovado","pagamento_entrada","material_recebido",
      "producao_ok","etiquetas_ok","instalacao_agendada","instalacao_concluida",
      "termo_assinado","nfe_emitida","pagamento_saldo","observacoes"];
    const updates = fields.filter(f => req.body[f] !== undefined).map((f, i) => `${f}=$${i+2}`);
    const values = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]);
    if (!updates.length) return res.status(400).json({ error: "Nada a atualizar" });
    const result = await pool.query(
      `UPDATE cortiart_checklist SET ${updates.join(",")}, updated_at=NOW() WHERE pedido_id=$1 RETURNING *`,
      [req.params.id, ...values]
    );
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ─── Catálogo ─────────────────────────────────────────────────────────────────
router.get("/catalogo", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const { categoria, status, q } = req.query as any;
    let where = `WHERE (tenant_id IS NULL OR tenant_id=$1)`;
    const params: any[] = [tenantId];
    let pi = 2;
    if (categoria) { where += ` AND categoria=$${pi++}`; params.push(categoria); }
    if (status)    { where += ` AND status_comercial=$${pi++}`; params.push(status); }
    if (q)         { where += ` AND (nome ILIKE $${pi} OR codigo ILIKE $${pi} OR colecao ILIKE $${pi})`; params.push(`%${q}%`); pi++; }
    const rows = await pool.query(`SELECT * FROM cortiart_catalogo ${where} ORDER BY categoria, nome`, params);
    res.json(rows.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.post("/catalogo", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const { codigo, nome, descricao, categoria, colecao, unidade = "m", valorUnitario = 0, statusComercial = "ativo", ncm } = req.body;
    if (!nome) return res.status(400).json({ error: "nome é obrigatório" });
    const result = await pool.query(
      `INSERT INTO cortiart_catalogo (tenant_id,codigo,nome,descricao,categoria,colecao,unidade,valor_unitario,status_comercial,ncm)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tenantId,codigo??null,nome,descricao??null,categoria??null,colecao??null,unidade,valorUnitario,statusComercial,ncm??null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.patch("/catalogo/:id", async (req, res) => {
  const pool = getPool();
  try {
    const allowed = ["codigo","nome","descricao","categoria","colecao","unidade","valor_unitario","status_comercial","data_previsao","ncm"];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k)).map(([k],i)=>`${k}=$${i+2}`);
    const values = Object.entries(req.body).filter(([k]) => allowed.includes(k)).map(([,v])=>v);
    if (!updates.length) return res.status(400).json({ error: "Nada a atualizar" });
    const result = await pool.query(
      `UPDATE cortiart_catalogo SET ${updates.join(",")}, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id, ...values]
    );
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ─── Coeficientes ─────────────────────────────────────────────────────────────
router.get("/coeficientes", async (req, res) => {
  const pool = getPool();
  try {
    const rows = await pool.query(`SELECT * FROM cortiart_coeficientes ORDER BY sistema, faixa`);
    res.json(rows.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ─── POST /calcular-cortina ───────────────────────────────────────────────────
router.post("/calcular-cortina", async (req, res) => {
  try {
    const { sistema, largura, altura, quantidade = 1 } = req.body;
    if (!sistema || !largura || !altura) return res.status(400).json({ error: "sistema, largura e altura são obrigatórios" });

    const pool = getPool();
    const faixa = parseFloat(largura) <= 1 ? "ate_1m"
      : parseFloat(largura) <= 2 ? "1m_2m"
      : parseFloat(largura) <= 3 ? "2m_3m"
      : "acima_3m";

    const coef = await pool.query(
      `SELECT coeficiente FROM cortiart_coeficientes WHERE sistema=$1 AND faixa=$2`, [sistema, faixa]
    );
    await pool.end();

    const coeficiente = coef.rows[0] ? parseFloat(coef.rows[0].coeficiente) : 2.5;
    const metragemUn = parseFloat(largura) * parseFloat(altura) * coeficiente;
    const metragemTotal = metragemUn * parseFloat(quantidade);

    res.json({ sistema, largura: parseFloat(largura), altura: parseFloat(altura), quantidade: parseFloat(quantidade),
      faixa, coeficiente, metragem_unidade: Math.round(metragemUn * 1000) / 1000, metragem_total: Math.round(metragemTotal * 1000) / 1000 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /stats ───────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const [byStatus, totals] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as total, COALESCE(SUM(valor_final),0) as valor FROM cortiart_pedidos WHERE tenant_id=$1 GROUP BY status`, [tenantId]),
      pool.query(`SELECT COUNT(*) as total, COALESCE(SUM(valor_final),0) as pipeline FROM cortiart_pedidos WHERE tenant_id=$1 AND status NOT IN ('cancelado','concluido')`, [tenantId]),
    ]);
    res.json({ por_status: byStatus.rows, total_pedidos: parseInt(totals.rows[0].total), pipeline: parseFloat(totals.rows[0].pipeline) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ─── POST /admin/seed-catalogo ────────────────────────────────────────────────
router.post("/admin/seed-catalogo", async (req, res) => {
  try {
    const result = await runDecorSeed();
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEC-07 — OS Produção: geração em lote a partir dos itens do pedido
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /pedidos/:id/os-producao/gerar
 * Lê os itens do pedido e cria uma OS por etapa de produção:
 *   talhacao → encartelamento → acabamento → controle_qualidade
 * Avança status do pedido para "producao".
 */
router.post("/pedidos/:id/os-producao/gerar", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const pedidoRes = await pool.query(
      `SELECT * FROM cortiart_pedidos WHERE id=$1 AND tenant_id=$2`, [req.params.id, tenantId]
    );
    const pedido = pedidoRes.rows[0];
    if (!pedido) return res.status(404).json({ error: "Pedido não encontrado" });
    if (!["efetivado","aprovado","producao"].includes(pedido.status)) {
      return res.status(400).json({ error: "Pedido precisa estar em 'efetivado' ou 'aprovado' para gerar OS de produção" });
    }

    const itensRes = await pool.query(
      `SELECT * FROM cortiart_itens_pedido WHERE pedido_id=$1 ORDER BY created_at`, [req.params.id]
    );
    const itens = itensRes.rows;

    // 4 etapas padrão
    const ETAPAS = ["talhacao", "encartelamento", "acabamento", "controle_qualidade"];
    const criadas: any[] = [];

    for (const item of itens) {
      for (const etapa of ETAPAS) {
        const existing = await pool.query(
          `SELECT id FROM cortiart_os_producao WHERE pedido_id=$1 AND item_id=$2 AND etapa=$3`,
          [req.params.id, item.id, etapa]
        );
        if (existing.rows.length > 0) continue; // não duplicar

        const result = await pool.query(
          `INSERT INTO cortiart_os_producao
             (id, pedido_id, tenant_id, item_id, ambiente, etapa, metragem_tecido, observacoes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [newId(), req.params.id, tenantId, item.id,
           item.ambiente ?? null, etapa,
           item.metragem_tecido ?? null,
           `Gerado automaticamente — ${item.produto ?? item.sistema ?? "item"}`]
        );
        criadas.push(result.rows[0]);
      }
    }

    // Avança status para producao
    await pool.query(
      `UPDATE cortiart_pedidos SET status='producao', updated_at=NOW() WHERE id=$1`, [req.params.id]
    );

    // Checklist
    await pool.query(
      `UPDATE cortiart_checklist SET material_recebido=true, updated_at=NOW() WHERE pedido_id=$1`, [req.params.id]
    ).catch(() => {});

    res.json({ ok: true, os_criadas: criadas.length, os: criadas });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

/**
 * PATCH /pedidos/:id/os-producao/:osId/concluir
 * Marca uma OS de produção como concluída.
 * Quando TODAS as OSs do pedido estão concluídas, avança para "instalacao".
 */
router.patch("/pedidos/:id/os-producao/:osId/concluir", async (req, res) => {
  const pool = getPool();
  try {
    await pool.query(
      `UPDATE cortiart_os_producao SET status='concluida', data_conclusao=NOW() WHERE id=$1 AND pedido_id=$2`,
      [req.params.osId, req.params.id]
    );

    // Verifica se todas estão concluídas
    const pendentes = await pool.query(
      `SELECT COUNT(*) FROM cortiart_os_producao WHERE pedido_id=$1 AND status != 'concluida'`, [req.params.id]
    );
    if (parseInt(pendentes.rows[0].count) === 0) {
      await pool.query(
        `UPDATE cortiart_pedidos SET status='instalacao', updated_at=NOW() WHERE id=$1`, [req.params.id]
      );
      await pool.query(
        `UPDATE cortiart_checklist SET producao_ok=true, etiquetas_ok=true, updated_at=NOW() WHERE pedido_id=$1`, [req.params.id]
      ).catch(() => {});
    }

    res.json({ ok: true, todas_concluidas: parseInt(pendentes.rows[0].count) === 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEC-08 — OS Instalação: geração, conclusão, liberação de AR saldo
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /pedidos/:id/os-instalacao/gerar
 * Cria OS de instalação com agendamento.
 */
router.post("/pedidos/:id/os-instalacao/gerar", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const pedidoRes = await pool.query(
      `SELECT * FROM cortiart_pedidos WHERE id=$1 AND tenant_id=$2`, [req.params.id, tenantId]
    );
    const pedido = pedidoRes.rows[0];
    if (!pedido) return res.status(404).json({ error: "Pedido não encontrado" });

    const { instaladorId, dataAgendamento, horaAgendamento, observacoes } = req.body;

    const result = await pool.query(
      `INSERT INTO cortiart_os_instalacao
         (id, pedido_id, tenant_id, instalador_id, data_agendamento, hora_agendamento, endereco_instalacao, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [newId(), req.params.id, tenantId, instaladorId ?? null,
       dataAgendamento ?? null, horaAgendamento ?? null,
       pedido.endereco_obra ?? null, observacoes ?? null]
    );

    // Marca instalação agendada no checklist
    await pool.query(
      `UPDATE cortiart_checklist SET instalacao_agendada=true, updated_at=NOW() WHERE pedido_id=$1`, [req.params.id]
    ).catch(() => {});

    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

/**
 * PATCH /pedidos/:id/os-instalacao/:osId/concluir
 * Conclui instalação → marca termo assinado, avança pedido para "concluido",
 * libera AR de saldo (muda status de 'pendente' para 'vencido' c/ data hoje).
 */
router.patch("/pedidos/:id/os-instalacao/:osId/concluir", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const { termoAssinado = true, observacoes } = req.body;

    await pool.query(
      `UPDATE cortiart_os_instalacao
       SET status='concluida', data_conclusao=NOW(), termo_assinado=$1, termo_assinado_em=NOW(), observacoes=COALESCE($2, observacoes)
       WHERE id=$3 AND pedido_id=$4`,
      [termoAssinado, observacoes ?? null, req.params.osId, req.params.id]
    );

    // Avança pedido para concluido
    await pool.query(
      `UPDATE cortiart_pedidos SET status='concluido', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, tenantId]
    );

    // Atualiza checklist
    await pool.query(
      `UPDATE cortiart_checklist SET instalacao_concluida=true, termo_assinado=$1, updated_at=NOW() WHERE pedido_id=$2`,
      [termoAssinado, req.params.id]
    ).catch(() => {});

    // Libera AR de saldo — atualiza vencimento para hoje (vence agora)
    await pool.query(
      `UPDATE lancamentos_financeiros
       SET data_vencimento=CURRENT_DATE, updated_at=NOW()
       WHERE pedido_externo_id=$1 AND pedido_externo_tipo='decor_pedido'
         AND descricao ILIKE '%saldo%' AND status='pendente' AND tenant_id=$2`,
      [req.params.id, tenantId]
    ).catch(() => {});

    res.json({ ok: true, pedido_concluido: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEC-10 — Compras: necessidade + geração de POs por fornecedor
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /pedidos/:id/necessidade-compra
 * Retorna a necessidade de compra agrupada por categoria e tecido.
 */
router.get("/pedidos/:id/necessidade-compra", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const itensRes = await pool.query(
      `SELECT i.*, c.colecao, c.ncm
       FROM cortiart_itens_pedido i
       LEFT JOIN cortiart_catalogo c ON c.codigo = i.tecido
       WHERE i.pedido_id=$1`, [req.params.id]
    );

    // Agrupa por tecido
    const agrupado: Record<string, { tecido: string; produto: string; metragem: number; colecao?: string; ncm?: string }> = {};
    for (const item of itensRes.rows) {
      const key = item.tecido ?? item.produto ?? "sem_codigo";
      if (!agrupado[key]) {
        agrupado[key] = { tecido: key, produto: item.produto ?? key, metragem: 0, colecao: item.colecao, ncm: item.ncm };
      }
      agrupado[key].metragem += parseFloat(item.metragem_tecido ?? "0");
    }

    res.json({ itens: Object.values(agrupado) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

/**
 * POST /pedidos/:id/gerar-pos
 * Gera purchase_orders agrupadas por fornecedor a partir da necessidade de compra.
 * Body: { itens: [{ tecido, metragem, fornecedor_id?, fornecedor_nome? }] }
 */
router.post("/pedidos/:id/gerar-pos", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const pedidoRes = await pool.query(
      `SELECT * FROM cortiart_pedidos WHERE id=$1 AND tenant_id=$2`, [req.params.id, tenantId]
    );
    const pedido = pedidoRes.rows[0];
    if (!pedido) return res.status(404).json({ error: "Pedido não encontrado" });

    const itens: Array<{
      tecido: string; produto: string; metragem: number;
      fornecedorId?: string; fornecedorNome?: string; valorUnitario?: number;
    }> = req.body.itens ?? [];

    if (!itens.length) return res.status(400).json({ error: "Nenhum item informado" });

    // Agrupa por fornecedor
    const porFornecedor: Record<string, typeof itens> = {};
    for (const item of itens) {
      const key = item.fornecedorId ?? item.fornecedorNome ?? "sem_fornecedor";
      if (!porFornecedor[key]) porFornecedor[key] = [];
      porFornecedor[key].push(item);
    }

    const posCriadas: any[] = [];

    for (const [, grupoItens] of Object.entries(porFornecedor)) {
      const fornecedorId = grupoItens[0].fornecedorId ?? null;
      const fornecedorNome = grupoItens[0].fornecedorNome ?? "Fornecedor";
      const valorTotal = grupoItens.reduce((s, i) => s + ((i.valorUnitario ?? 0) * i.metragem), 0);
      const poId = newId();

      // Insere no purchase_orders (usa campos disponíveis via ALTER TABLE anterior)
      await pool.query(
        `INSERT INTO purchase_orders
           (id, tenant_id, supplier_name, supplier_id, status, total_amount, notes, created_at)
         VALUES ($1,$2,$3,$4,'draft',$5,$6,NOW())
         ON CONFLICT DO NOTHING`,
        [poId, tenantId, fornecedorNome, fornecedorId,
         valorTotal,
         `PO gerada automaticamente a partir do pedido ${pedido.numero_pedido}`]
      ).catch(async () => {
        // Fallback: tabela pode ter estrutura diferente
        await pool.query(
          `INSERT INTO purchase_orders (id, tenant_id, status, notes, created_at)
           VALUES ($1,$2,'draft',$3,NOW()) ON CONFLICT DO NOTHING`,
          [poId, tenantId, `PO ${pedido.numero_pedido} — ${fornecedorNome}`]
        ).catch(() => {});
      });

      // Insere itens da PO
      for (const item of grupoItens) {
        await pool.query(
          `INSERT INTO purchase_order_items
             (id, purchase_order_id, description, quantity, unit_price, created_at)
           VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT DO NOTHING`,
          [newId(), poId, `${item.produto} (${item.tecido})`,
           item.metragem, item.valorUnitario ?? 0]
        ).catch(() => {});
      }

      posCriadas.push({ id: poId, fornecedor: fornecedorNome, itens: grupoItens.length, valor: valorTotal });
    }

    res.json({ ok: true, pos_criadas: posCriadas.length, pos: posCriadas });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEC-10 — Catálogo: lista todos os itens com estoque estimado
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /catalogo/resumo
 * Retorna catálogo com metragem comprometida em pedidos ativos.
 */
router.get("/catalogo/resumo", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const rows = await pool.query(
      `SELECT c.*,
         COALESCE((
           SELECT SUM(i.metragem_tecido)
           FROM cortiart_itens_pedido i
           JOIN cortiart_pedidos p ON p.id = i.pedido_id
           WHERE i.tecido = c.codigo
             AND p.status NOT IN ('cancelado','concluido')
             AND p.tenant_id = $1
         ), 0) AS metragem_comprometida
       FROM cortiart_catalogo c
       WHERE (c.tenant_id IS NULL OR c.tenant_id = $1)
       ORDER BY c.categoria, c.nome`,
      [tenantId]
    );
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEC-EXP-07 — Admin: seed do catálogo expandido
// ══════════════════════════════════════════════════════════════════════════════

router.post("/admin/seed-exp07", async (req, res) => {
  try {
    const result = await runDecorExp07Seed();
    res.json({ ok: true, ...result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEC-EXP-05 — Parcelas (cortiart_parcelas)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/pedidos/:id/parcelas", async (req, res) => {
  const pool = getPool();
  try {
    const rows = await pool.query(
      `SELECT p.*, l.status AS ar_status, l.data_pagamento
       FROM cortiart_parcelas p
       LEFT JOIN lancamentos_financeiros l ON l.id = p.lancamento_id
       WHERE p.pedido_id=$1 ORDER BY p.sequencia`,
      [req.params.id]
    );
    res.json(rows.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.patch("/pedidos/:id/parcelas/:parcId", async (req, res) => {
  const pool = getPool();
  try {
    const allowed = ["status","vencimento","lancamento_id","observacoes"];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k)).map(([k],i) => `${k}=$${i+2}`);
    const values  = Object.entries(req.body).filter(([k]) => allowed.includes(k)).map(([,v]) => v);
    if (!updates.length) return res.status(400).json({ error: "Nada a atualizar" });
    const result = await pool.query(
      `UPDATE cortiart_parcelas SET ${updates.join(",")} WHERE id=$1 AND pedido_id='${req.params.id}' RETURNING *`,
      [req.params.parcId, ...values]
    );
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ── POST /pedidos/:id/efetivar-v2 — N parcelas ────────────────────────────────
router.post("/pedidos/:id/efetivar-v2", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const pedidoRes = await pool.query(
      `SELECT * FROM cortiart_pedidos WHERE id=$1 AND tenant_id=$2`, [req.params.id, tenantId]
    );
    const pedido = pedidoRes.rows[0];
    if (!pedido) return res.status(404).json({ error: "Pedido não encontrado" });
    if (!["aprovado","orcamento"].includes(pedido.status)) {
      return res.status(400).json({ error: "Pedido precisa estar em aprovado ou orçamento" });
    }

    const {
      numParcelas = 2,
      tipoPagamentoCodigo = "01",
      parcelas: parcelasInput,
      percEntrada = 50,
      vencimentos,
    } = req.body;

    const valorTotal = parseFloat(pedido.valor_final || "0");
    if (valorTotal <= 0) return res.status(400).json({ error: "Pedido sem valor definido" });

    // Gera parcelas: usa input explícito ou calcula automaticamente
    const parcelasCalc: Array<{ valor: number; vencimento?: string; formaPagamento: string }> = [];
    if (parcelasInput && Array.isArray(parcelasInput) && parcelasInput.length > 0) {
      parcelasInput.forEach((p: any) => {
        parcelasCalc.push({ valor: parseFloat(p.valor), vencimento: p.vencimento, formaPagamento: tipoPagamentoCodigo });
      });
    } else {
      const n = parseInt(numParcelas) || 2;
      const base = Math.floor(valorTotal / n * 100) / 100;
      const resto = Math.round((valorTotal - base * n) * 100) / 100;
      for (let i = 0; i < n; i++) {
        const valor = i === n - 1 ? base + resto : base;
        const venc = vencimentos?.[i] ?? null;
        parcelasCalc.push({ valor, vencimento: venc, formaPagamento: tipoPagamentoCodigo });
      }
    }

    // Insere parcelas e lançamentos
    const criadas: any[] = [];
    for (let i = 0; i < parcelasCalc.length; i++) {
      const p = parcelasCalc[i];
      const parcId = newId();
      const descricao = parcelasCalc.length === 1
        ? `Pedido ${pedido.numero_pedido} — À Vista`
        : i === 0
          ? `Pedido ${pedido.numero_pedido} — Entrada (1/${parcelasCalc.length})`
          : `Pedido ${pedido.numero_pedido} — Parcela ${i+1}/${parcelasCalc.length}`;

      // Lançamento financeiro (AR)
      const lancId = newId();
      await pool.query(
        `INSERT INTO lancamentos_financeiros
           (id, tenant_id, tipo, descricao, valor, data_vencimento, status,
            pedido_externo_id, pedido_externo_tipo, cliente_id, cliente_nome)
         VALUES ($1,$2,'receita',$3,$4,$5,'pendente',$6,'decor_pedido',$7,$8)
         ON CONFLICT DO NOTHING`,
        [lancId, tenantId, descricao, p.valor, p.vencimento ?? null,
         req.params.id, pedido.cliente_id ?? null, pedido.cliente_nome ?? null]
      ).catch(() => {});

      // Parcela
      await pool.query(
        `INSERT INTO cortiart_parcelas
           (id, pedido_id, tenant_id, sequencia, total_parcelas, valor, vencimento, forma_pagamento, status, lancamento_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendente',$9)`,
        [parcId, req.params.id, tenantId, i+1, parcelasCalc.length, p.valor,
         p.vencimento ?? null, p.formaPagamento, lancId]
      );
      criadas.push({ id: parcId, sequencia: i+1, valor: p.valor, lancamento_id: lancId });
    }

    // Atualiza pedido
    await pool.query(
      `UPDATE cortiart_pedidos SET
         status='efetivado', data_efetivacao=NOW(), num_parcelas=$1,
         tipo_pagamento_codigo=$2, updated_at=NOW()
       WHERE id=$3`,
      [parcelasCalc.length, tipoPagamentoCodigo, req.params.id]
    );

    // Atualiza checklist
    await pool.query(
      `UPDATE cortiart_checklist SET pagamento_entrada=true, updated_at=NOW() WHERE pedido_id=$1`,
      [req.params.id]
    ).catch(() => {});

    res.json({ ok: true, parcelas: criadas });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEC-EXP-06 — Fornecedores de persiana por pedido (cortiart_fornecedores_pedido)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/pedidos/:id/fornecedores-pedido", async (req, res) => {
  const pool = getPool();
  try {
    const rows = await pool.query(
      `SELECT fp.*, i.ambiente, i.produto
       FROM cortiart_fornecedores_pedido fp
       LEFT JOIN cortiart_itens_pedido i ON i.id = fp.item_id
       WHERE fp.pedido_id=$1 ORDER BY fp.created_at`,
      [req.params.id]
    );
    res.json(rows.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.post("/pedidos/:id/fornecedores-pedido", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const { itemId, fornecedorNome, dataEnvio, previsaoEntrega, observacoes } = req.body;
    if (!fornecedorNome) return res.status(400).json({ error: "fornecedorNome é obrigatório" });
    const result = await pool.query(
      `INSERT INTO cortiart_fornecedores_pedido
         (id, pedido_id, item_id, tenant_id, fornecedor_nome, data_envio, status, previsao_entrega, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,'solicitado',$7,$8) RETURNING *`,
      [newId(), req.params.id, itemId??null, tenantId, fornecedorNome,
       dataEnvio??null, previsaoEntrega??null, observacoes??null]
    );
    // Marca checklist
    await pool.query(
      `UPDATE cortiart_checklist SET pedido_fornecedor_persiana=true, updated_at=NOW() WHERE pedido_id=$1`,
      [req.params.id]
    ).catch(() => {});
    res.status(201).json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

router.patch("/pedidos/:id/fornecedores-pedido/:fpId", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    const allowed = ["status","previsao_entrega","observacoes","data_envio"];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k)).map(([k],i) => `${k}=$${i+3}`);
    const values  = Object.entries(req.body).filter(([k]) => allowed.includes(k)).map(([,v]) => v);
    if (!updates.length) return res.status(400).json({ error: "Nada a atualizar" });
    const result = await pool.query(
      `UPDATE cortiart_fornecedores_pedido SET ${updates.join(",")} WHERE id=$1 AND pedido_id=$2 RETURNING *`,
      [req.params.fpId, req.params.id, ...values]
    );

    // Quando recebido, atualiza checklist
    if (req.body.status === "recebido") {
      await pool.query(
        `UPDATE cortiart_checklist SET material_persiana_recebido=true, updated_at=NOW() WHERE pedido_id=$1`,
        [req.params.id]
      ).catch(() => {});
    }
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEC-EXP-07 — Condições de Venda (cortiart_condicoes_venda)
// ══════════════════════════════════════════════════════════════════════════════

const CGV_DEFAULTS = [
  "O prazo de entrega padrão é de 30 dias corridos, contados a partir da data de efetivação do pedido e confirmação do pagamento de entrada.",
  "Atrasos ocasionados por obras no local de instalação prorrogarão automaticamente o prazo de entrega em +30 dias.",
  "A produção somente será iniciada após o pagamento de 50% do valor total. O saldo restante deverá ser pago no ato da instalação.",
  "No dia da instalação, o ambiente deverá estar limpo, com iluminação e energia disponíveis. Caso contrário, uma nova visita será agendada com custo adicional.",
  "Toda instalação hidráulica, elétrica ou de alvenaria necessária é de responsabilidade do cliente.",
  "Acordos verbais não têm validade. Todas as alterações devem ser registradas por escrito no sistema.",
  "Assistência técnica: agendamento em até 7 dias úteis; peças com prazo de até 30 dias.",
  "O cliente deve conferir todos os produtos no ato da instalação. Danos ou avarias comunicados após a conclusão da OS não serão acatados.",
  "Encolhimento de até 3% após lavagem é característica inerente dos tecidos naturais, não constituindo defeito de fabricação.",
];

// Garante que a tabela existe (idempotente)
async function ensureCondicoesVendaTable(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cortiart_condicoes_venda (
      id          VARCHAR PRIMARY KEY,
      tenant_id   VARCHAR NOT NULL DEFAULT 'default',
      sequencia   INTEGER NOT NULL,
      texto       TEXT    NOT NULL,
      ativo       BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMP DEFAULT NOW(),
      updated_at  TIMESTAMP DEFAULT NOW()
    )
  `);
}

// GET /condicoes-venda — lista cláusulas do tenant (fallback: defaults)
router.get("/condicoes-venda", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    await ensureCondicoesVendaTable(pool);
    const rows = await pool.query(
      `SELECT * FROM cortiart_condicoes_venda WHERE tenant_id=$1 AND ativo=true ORDER BY sequencia`,
      [tenantId]
    );
    if (rows.rows.length === 0) {
      // retorna defaults sem persistir
      return res.json(CGV_DEFAULTS.map((texto, i) => ({
        id: `default-${i+1}`, tenant_id: tenantId, sequencia: i+1, texto, ativo: true
      })));
    }
    res.json(rows.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// PUT /condicoes-venda/:id — atualiza texto de uma cláusula
router.put("/condicoes-venda/:id", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    await ensureCondicoesVendaTable(pool);
    const { texto, ativo } = req.body;
    const r = await pool.query(
      `UPDATE cortiart_condicoes_venda SET texto=COALESCE($1,texto), ativo=COALESCE($2,ativo), updated_at=NOW()
       WHERE id=$3 AND tenant_id=$4 RETURNING *`,
      [texto ?? null, ativo ?? null, req.params.id, tenantId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Cláusula não encontrada" });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

// POST /admin/seed-condicoes-venda — cria/recria as 9 cláusulas padrão
router.post("/admin/seed-condicoes-venda", async (req, res) => {
  const pool = getPool();
  try {
    const tenantId = getTenantId(req);
    await ensureCondicoesVendaTable(pool);
    // Limpa e recria
    await pool.query(`DELETE FROM cortiart_condicoes_venda WHERE tenant_id=$1`, [tenantId]);
    for (let i = 0; i < CGV_DEFAULTS.length; i++) {
      await pool.query(
        `INSERT INTO cortiart_condicoes_venda (id, tenant_id, sequencia, texto) VALUES ($1,$2,$3,$4)`,
        [newId(), tenantId, i+1, CGV_DEFAULTS[i]]
      );
    }
    res.json({ ok: true, total: CGV_DEFAULTS.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
  finally { await pool.end(); }
});

registerAgendaRoutes(router);

export default router;
