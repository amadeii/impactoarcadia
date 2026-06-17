import type { Express } from "express";
import { pool } from "../db/index";
import { isAuthenticated } from "./portableAuth";
import { tenantContext, requireTenant } from "./tenantContext";
import { gerarLancamentoReceber, resolveClienteControlId } from "./control/arService";

const auth = [isAuthenticated, tenantContext, requireTenant];

export async function dispararARProjeto(
  projeto: {
    id: string;
    titulo: string;
    numero: string;          // ex: ENG-2026-007 ou IMP23195
    cliente_id?: string | null;
    cliente_nome?: string | null;
    valor_contrato?: string | null;
    data_fim?: string | null;
    os_numero?: string | null;
  },
  tenantId: string,
  userId?: string | null
): Promise<void> {
  try {
    if (!projeto.valor_contrato || parseFloat(projeto.valor_contrato) <= 0) {
      console.warn(`[arService] Projeto ${projeto.numero} sem valor_contrato — AR não gerado`);
      return;
    }

    let clienteControlId: string | null = null;
    if (projeto.cliente_id) {
      clienteControlId = await resolveClienteControlId(projeto.cliente_id, tenantId);
    }
    if (!clienteControlId) {
      const r = await pool.query(
        `SELECT id FROM clients WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`,
        [tenantId]
      );
      clienteControlId = r.rows[0]?.id ?? null;
    }
    if (!clienteControlId) {
      console.warn(`[arService] Projeto ${projeto.numero} sem clienteControlId — AR não gerado`);
      return;
    }

    let vencimento = projeto.data_fim || null;
    if (!vencimento) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      vencimento = d.toISOString().split("T")[0];
    }

    const result = await gerarLancamentoReceber({
      tenantId,
      clienteControlId,
      pessoaId: projeto.cliente_id || null,
      favorecido: projeto.cliente_nome || undefined,
      descricao: `Receita — ${projeto.numero}: ${projeto.titulo}`,
      valor: parseFloat(projeto.valor_contrato),
      dataVencimento: vencimento,
      origemRefTipo: "os",
      origemRefId: projeto.id,
      criadoPor: userId || null,
      observacoes: projeto.os_numero ? `OS: ${projeto.os_numero}` : null,
      // CTL-IMP-01 — vincula lançamento ao projeto de engenharia
      projetoId:     projeto.id,
      projetoCodigo: projeto.numero,
    });

    if (result.jaExiste) {
      console.log(`[arService] AR já existe para projeto ${projeto.numero} — ignorado`);
    } else if (result.ok) {
      console.log(`[arService] AR gerado para projeto ${projeto.numero} — R$ ${projeto.valor_contrato}`);
    } else {
      console.error(`[arService] Erro ao gerar AR para projeto ${projeto.numero}:`, result.error);
    }
  } catch (e: any) {
    console.error(`[arService] Exceção ao gerar AR projeto ${projeto.numero}:`, e.message);
  }
}

export function attachPessoasFinanceiroRoutes(app: Express) {

  // GET /api/pessoas/:id/financeiro
  app.get("/api/pessoas/:id/financeiro", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const pessoaId = req.params.id;

      const pRes = await pool.query(
        `SELECT id, nome_fantasia, cnpj_cpf FROM pessoas WHERE id = $1 AND tenant_id = $2`,
        [pessoaId, tenantId]
      );
      if (!pRes.rows[0]) return res.status(404).json({ message: "Pessoa não encontrada" });

      const resumo = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE tipo='receber' AND status NOT IN ('pago','cancelado')) AS qtd_ar_aberto,
           COALESCE(SUM(valor::numeric) FILTER (WHERE tipo='receber' AND status NOT IN ('pago','cancelado')), 0) AS saldo_ar,
           COALESCE(SUM(valor::numeric) FILTER (WHERE tipo='receber' AND status='pago'), 0) AS total_recebido,
           COUNT(*) FILTER (WHERE tipo='pagar' AND status NOT IN ('pago','cancelado')) AS qtd_ap_aberto,
           COALESCE(SUM(valor::numeric) FILTER (WHERE tipo='pagar' AND status NOT IN ('pago','cancelado')), 0) AS saldo_ap,
           COUNT(*) FILTER (WHERE tipo='receber' AND status NOT IN ('pago','cancelado') AND data_vencimento < CURRENT_DATE) AS qtd_vencidos,
           COALESCE(SUM(valor::numeric) FILTER (WHERE tipo='receber' AND status NOT IN ('pago','cancelado') AND data_vencimento < CURRENT_DATE), 0) AS valor_vencidos,
           MAX(data_vencimento) FILTER (WHERE tipo='receber' AND status NOT IN ('pago','cancelado')) AS proximo_vencimento
         FROM lancamentos_financeiros
         WHERE pessoa_id = $1 AND tenant_id = $2`,
        [pessoaId, tenantId]
      );

      const lancamentos = await pool.query(
        `SELECT lf.id, lf.tipo, lf.descricao, lf.favorecido, lf.valor,
                lf.data_vencimento, lf.data_pagamento, lf.status,
                lf.origem, lf.origem_ref_tipo, lf.origem_ref_id,
                lf.plano_conta_id,
                pc.descricao AS plano_conta_descricao, pc.codigo AS plano_conta_codigo,
                cc.nome AS centro_custo_nome,
                lf.created_at
         FROM lancamentos_financeiros lf
         LEFT JOIN planos_contas pc ON pc.id = lf.plano_conta_id
         LEFT JOIN centros_custo cc ON cc.id = lf.centro_custo_id
         WHERE lf.pessoa_id = $1 AND lf.tenant_id = $2
           AND lf.data_vencimento BETWEEN CURRENT_DATE - INTERVAL '90 days'
                                      AND CURRENT_DATE + INTERVAL '90 days'
         ORDER BY lf.data_vencimento DESC
         LIMIT 100`,
        [pessoaId, tenantId]
      );

      const projetos = await pool.query(
        `SELECT ep.id, ep.numero, ep.titulo, ep.etapa, ep.status,
                ep.valor_contrato, ep.data_fim, ep.os_numero,
                EXISTS(
                  SELECT 1 FROM lancamentos_financeiros
                  WHERE origem_ref_tipo = 'os' AND origem_ref_id = ep.id
                    AND tipo = 'receber' AND status != 'cancelado'
                ) AS ar_gerado
         FROM engineering_projects ep
         WHERE ep.cliente_id = $1 AND ep.tenant_id = $2
         ORDER BY ep.created_at DESC
         LIMIT 30`,
        [pessoaId, tenantId]
      ).catch(() => ({ rows: [] }));

      res.json({
        resumo: resumo.rows[0],
        lancamentos: lancamentos.rows,
        projetos: projetos.rows,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/control/pessoas/:pessoaId/gerar-ar
  app.post("/api/control/pessoas/:pessoaId/gerar-ar", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const pessoaId = req.params.pessoaId;

      const {
        descricao,
        valor,
        dataVencimento,
        origemRefTipo = "manual",
        origemRefId,
        planoContaId,
        centroCustoId,
        observacoes,
        parcelas,
      } = req.body;

      if (!descricao) return res.status(400).json({ message: "Descrição obrigatória" });
      if (!valor || parseFloat(valor) <= 0) return res.status(400).json({ message: "Valor inválido" });
      if (!dataVencimento) return res.status(400).json({ message: "Data de vencimento obrigatória" });

      const pRes = await pool.query(
        `SELECT id, nome_fantasia FROM pessoas WHERE id = $1 AND tenant_id = $2`,
        [pessoaId, tenantId]
      );
      if (!pRes.rows[0]) return res.status(404).json({ message: "Pessoa não encontrada" });

      // Opção B: resolve clienteControlId automaticamente
      let clienteControlId = req.body.clienteControlId;
      if (!clienteControlId) {
        clienteControlId = await resolveClienteControlId(pessoaId, tenantId);
      }
      if (!clienteControlId) {
        const r = await pool.query(
          `SELECT id FROM clients WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`,
          [tenantId]
        );
        clienteControlId = r.rows[0]?.id ?? null;
      }
      if (!clienteControlId) {
        return res.status(400).json({ message: "Não foi possível resolver a empresa financeira. Contate o suporte." });
      }

      const result = await gerarLancamentoReceber({
        tenantId,
        clienteControlId,
        pessoaId,
        favorecido: pRes.rows[0].nome_fantasia,
        descricao,
        valor: parseFloat(valor),
        dataVencimento,
        origemRefTipo,
        origemRefId: origemRefId || null,
        planoContaId: planoContaId || null,
        centroCustoId: centroCustoId || null,
        criadoPor: req.user?.id || null,
        observacoes: observacoes || null,
        parcelas: parcelas ? parseInt(parcelas) : 1,
      });

      if (!result.ok) return res.status(500).json({ message: result.error });
      if (result.jaExiste) return res.status(409).json({ message: "AR já existe para esta origem", jaExiste: true });

      res.status(201).json({ lancamentos: result.lancamentos });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/control/projetos/:projetoId/gerar-ar
  app.post("/api/control/projetos/:projetoId/gerar-ar", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;

      const pRes = await pool.query(
        `SELECT * FROM engineering_projects WHERE id = $1 AND tenant_id = $2`,
        [req.params.projetoId, tenantId]
      );
      if (!pRes.rows[0]) return res.status(404).json({ message: "Projeto não encontrado" });

      const projeto = pRes.rows[0];

      const { valor, dataVencimento, parcelas, planoContaId, centroCustoId, observacoes } = req.body;

      const valorFinal = valor ? parseFloat(valor) : parseFloat(projeto.valor_contrato || "0");
      if (!valorFinal || valorFinal <= 0) {
        return res.status(400).json({ message: "Projeto sem valor_contrato. Informe o valor." });
      }

      let clienteId = req.body.clienteControlId;
      if (!clienteId && projeto.cliente_id) {
        clienteId = await resolveClienteControlId(projeto.cliente_id, tenantId);
      }
      if (!clienteId) {
        const r = await pool.query(
          `SELECT id FROM clients WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`,
          [tenantId]
        );
        clienteId = r.rows[0]?.id;
      }
      if (!clienteId) return res.status(400).json({ message: "Não foi possível resolver o cliente Control" });

      let vencimento = dataVencimento || projeto.data_fim;
      if (!vencimento) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        vencimento = d.toISOString().split("T")[0];
      }

      const result = await gerarLancamentoReceber({
        tenantId,
        clienteControlId: clienteId,
        pessoaId: projeto.cliente_id || null,
        favorecido: projeto.cliente_nome || undefined,
        descricao: `Receita — ${projeto.numero}: ${projeto.titulo}`,
        valor: valorFinal,
        dataVencimento: vencimento,
        origemRefTipo: "os",
        origemRefId: projeto.id,
        planoContaId: planoContaId || null,
        centroCustoId: centroCustoId || null,
        criadoPor: req.user?.id || null,
        observacoes: observacoes || (projeto.os_numero ? `OS: ${projeto.os_numero}` : null),
        parcelas: parcelas ? parseInt(parcelas) : 1,
      });

      if (!result.ok) return res.status(500).json({ message: result.error });
      if (result.jaExiste) return res.status(409).json({ message: "AR já existe para este projeto", jaExiste: true });

      res.status(201).json({ lancamentos: result.lancamentos, projeto });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
