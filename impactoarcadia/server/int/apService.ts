/**
 * INT-01 — apService.ts
 * Geração de Contas a Pagar (AP) no Control — espelho de gerarLancamentoReceber.
 *
 * ORIGENS SUPORTADAS:
 *   'compra'   → purchase_invoice.approved (COMP-01)
 *   'servico'  → futuro (contrato de serviço recorrente)
 *   'manual'   → lançamento manual sem idempotência por origemRefId
 */

import { pool } from "../../db/index";

export interface GerarAPInput {
  tenantId:           string;
  clienteControlId:   string;
  fornecedorPessoaId?: string | null;
  favorecido?:        string | null;
  descricao:          string;
  valor:              number;
  dataVencimento:     string;
  dataEmissao?:       string | null;
  documento?:         string | null;
  planoContaId?:      string | null;
  centroCustoId?:     string | null;
  origemRefTipo:      'compra' | 'servico' | 'manual';
  origemRefId?:       string | null;
  criadoPor?:         string | null;
  observacoes?:       string | null;
}

export interface GerarAPResult {
  ok:          boolean;
  lancamento?: any;
  error?:      string;
  jaExiste?:   boolean;
}

export async function gerarLancamentoPagar(input: GerarAPInput): Promise<GerarAPResult> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");

    // Resolver nome do favorecido a partir da pessoa (se não informado)
    let favorecido = input.favorecido || null;
    if (input.fornecedorPessoaId && !favorecido) {
      const pr = await db.query(
        `SELECT nome_fantasia FROM pessoas WHERE id = $1`,
        [input.fornecedorPessoaId]
      );
      if (pr.rows[0]) favorecido = pr.rows[0].nome_fantasia;
    }

    // Idempotência — mesma origem não gera duplicata
    if (input.origemRefId && input.origemRefTipo !== 'manual') {
      const dup = await db.query(
        `SELECT id FROM lancamentos_financeiros
         WHERE cliente_id      = $1
           AND origem_ref_tipo = $2
           AND origem_ref_id   = $3
           AND tipo            = 'pagar'
           AND status         != 'cancelado'
         LIMIT 1`,
        [input.clienteControlId, input.origemRefTipo, input.origemRefId]
      );
      if (dup.rowCount! > 0) {
        await db.query("ROLLBACK");
        return { ok: true, jaExiste: true, lancamento: dup.rows[0] };
      }
    }

    // Resolver plano de contas: 4.1 (CMV/CPV) → fallback primeira despesa
    let planoContaId = input.planoContaId || null;
    if (!planoContaId) {
      const pRes = await db.query(
        `SELECT id FROM planos_contas
         WHERE tenant_id = $1 AND codigo = '4.1' AND permite_lancamento = true
         LIMIT 1`,
        [input.tenantId]
      );
      if (pRes.rows[0]) {
        planoContaId = pRes.rows[0].id;
      } else {
        const fb = await db.query(
          `SELECT id FROM planos_contas
           WHERE tenant_id = $1
             AND natureza IN ('custo', 'despesa')
             AND permite_lancamento = true
           ORDER BY codigo LIMIT 1`,
          [input.tenantId]
        );
        planoContaId = fb.rows[0]?.id ?? null;
      }
    }

    const { rows: [lanc] } = await db.query(
      `INSERT INTO lancamentos_financeiros (
         tenant_id, cliente_id, tipo, descricao, favorecido,
         documento, valor, data_emissao, data_vencimento,
         status, plano_conta_id, centro_custo_id,
         origem, origem_ref_tipo, origem_ref_id,
         pessoa_id, criado_por, observacoes
       ) VALUES ($1,$2,'pagar',$3,$4,$5,$6,$7,$8,'previsto',$9,$10,'integracao',$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        input.tenantId,
        input.clienteControlId,
        input.descricao,
        favorecido,
        input.documento ?? null,
        input.valor.toFixed(2),
        input.dataEmissao ?? null,
        input.dataVencimento,
        planoContaId,
        input.centroCustoId ?? null,
        input.origemRefTipo,
        input.origemRefId ?? null,
        input.fornecedorPessoaId ?? null,
        input.criadoPor ?? null,
        input.observacoes ?? null,
      ]
    );

    await db.query("COMMIT");
    return { ok: true, lancamento: lanc };
  } catch (e: any) {
    await db.query("ROLLBACK");
    if (e.code === "23505") return { ok: true, jaExiste: true };
    return { ok: false, error: e.message };
  } finally {
    db.release();
  }
}

/**
 * Versão em lote — para NF-e com múltiplas duplicatas.
 * Todas as parcelas criadas atomicamente ou nenhuma.
 */
export async function gerarLancamentoPagarLote(
  parcelas: GerarAPInput[]
): Promise<{ ok: boolean; lancamentos: any[]; errors: string[] }> {
  const db = await pool.connect();
  const lancamentos: any[] = [];
  const errors: string[] = [];

  try {
    await db.query("BEGIN");

    for (const input of parcelas) {
      if (input.origemRefId && input.origemRefTipo !== 'manual') {
        const dup = await db.query(
          `SELECT id FROM lancamentos_financeiros
           WHERE cliente_id = $1 AND origem_ref_tipo = $2
             AND origem_ref_id = $3 AND tipo = 'pagar' AND status != 'cancelado'
           LIMIT 1`,
          [input.clienteControlId, input.origemRefTipo, input.origemRefId]
        );
        if (dup.rowCount! > 0) {
          lancamentos.push(dup.rows[0]);
          continue;
        }
      }

      let favorecido = input.favorecido || null;
      if (input.fornecedorPessoaId && !favorecido) {
        const pr = await db.query(
          `SELECT nome_fantasia FROM pessoas WHERE id = $1`,
          [input.fornecedorPessoaId]
        );
        if (pr.rows[0]) favorecido = pr.rows[0].nome_fantasia;
      }

      let planoContaId = input.planoContaId || null;
      if (!planoContaId) {
        const pRes = await db.query(
          `SELECT id FROM planos_contas
           WHERE tenant_id = $1 AND codigo = '4.1' AND permite_lancamento = true LIMIT 1`,
          [input.tenantId]
        );
        planoContaId = pRes.rows[0]?.id ?? null;
      }

      const { rows: [lanc] } = await db.query(
        `INSERT INTO lancamentos_financeiros (
           tenant_id, cliente_id, tipo, descricao, favorecido,
           documento, valor, data_emissao, data_vencimento,
           status, plano_conta_id, centro_custo_id,
           origem, origem_ref_tipo, origem_ref_id,
           pessoa_id, criado_por, observacoes
         ) VALUES ($1,$2,'pagar',$3,$4,$5,$6,$7,$8,'previsto',$9,$10,'integracao',$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          input.tenantId, input.clienteControlId,
          input.descricao, favorecido, input.documento ?? null,
          input.valor.toFixed(2), input.dataEmissao ?? null, input.dataVencimento,
          planoContaId, input.centroCustoId ?? null,
          input.origemRefTipo, input.origemRefId ?? null,
          input.fornecedorPessoaId ?? null, input.criadoPor ?? null, input.observacoes ?? null,
        ]
      );
      lancamentos.push(lanc);
    }

    await db.query("COMMIT");
    return { ok: errors.length === 0, lancamentos, errors };
  } catch (e: any) {
    await db.query("ROLLBACK");
    return { ok: false, lancamentos: [], errors: [e.message] };
  } finally {
    db.release();
  }
}
