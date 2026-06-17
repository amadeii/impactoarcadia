import { pool } from "../../db/index";

/**
 * Busca ou cria um client pelo nome do favorecido.
 * Usado como fallback quando o projeto não tem cliente CRM vinculado.
 */
export async function findOrCreateClienteByNome(
  nome: string,
  tenantId: string
): Promise<string | null> {
  if (!nome?.trim()) return null;
  try {
    const existing = await pool.query(
      `SELECT id FROM clients WHERE tenant_id = $1 AND name ILIKE $2 LIMIT 1`,
      [tenantId, nome.trim()]
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const created = await pool.query(
      `INSERT INTO clients (tenant_id, name, status)
       VALUES ($1, $2, 'ativo')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [tenantId, nome.trim()]
    );
    return created.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export interface GerarARInput {
  tenantId: string;
  clienteControlId: string;
  pessoaId?: string | null;
  favorecido?: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  planoContaId?: string | null;
  centroCustoId?: string | null;
  origemRefTipo: "os" | "nfe" | "contrato" | "venda" | "manual";
  origemRefId?: string | null;
  criadoPor?: string | null;
  observacoes?: string | null;
  parcelas?: number;
  // CTL-IMP-01 — vínculo com projeto de engenharia
  projetoId?: string | null;       // FK → engineering_projects.id
  projetoCodigo?: string | null;   // ex: IMP23195, ENG-2026-007
}

export interface GerarARResult {
  ok: boolean;
  lancamentos?: any[];
  error?: string;
  jaExiste?: boolean;
}

export async function gerarLancamentoReceber(input: GerarARInput): Promise<GerarARResult> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");

    let favorecido = input.favorecido || null;
    let pessoaId = input.pessoaId || null;

    if (pessoaId && !favorecido) {
      const pr = await db.query(
        `SELECT nome_fantasia FROM pessoas WHERE id = $1`,
        [pessoaId]
      );
      if (pr.rows[0]) favorecido = pr.rows[0].nome_fantasia;
    }

    if (input.origemRefId && input.origemRefTipo !== "manual") {
      const dup = await db.query(
        `SELECT id FROM lancamentos_financeiros
         WHERE cliente_id = $1
           AND origem_ref_tipo = $2
           AND origem_ref_id = $3
           AND tipo = 'receber'
           AND status != 'cancelado'
         LIMIT 1`,
        [input.clienteControlId, input.origemRefTipo, input.origemRefId]
      );
      if (dup.rowCount! > 0) {
        await db.query("ROLLBACK");
        return { ok: true, jaExiste: true, lancamentos: [dup.rows[0]] };
      }
    }

    let planoContaId = input.planoContaId || null;
    if (!planoContaId) {
      const pRes = await db.query(
        `SELECT id FROM planos_contas
         WHERE tenant_id = $1 AND codigo = 'REC.1.2.1' AND permite_lancamento = true
         LIMIT 1`,
        [input.tenantId]
      );
      if (!pRes.rows[0]) {
        const fb = await db.query(
          `SELECT id FROM planos_contas
           WHERE tenant_id = $1 AND natureza = 'receita' AND permite_lancamento = true
           ORDER BY codigo LIMIT 1`,
          [input.tenantId]
        );
        planoContaId = fb.rows[0]?.id ?? null;
      } else {
        planoContaId = pRes.rows[0].id;
      }
    }

    const parcelas = Math.max(1, input.parcelas || 1);
    const valorParcela = Number((input.valor / parcelas).toFixed(2));
    const lancamentos: any[] = [];

    for (let i = 0; i < parcelas; i++) {
      const vencBase = new Date(input.dataVencimento);
      vencBase.setMonth(vencBase.getMonth() + i);
      const vencimento = vencBase.toISOString().split("T")[0];

      const valor = i === parcelas - 1
        ? Number((input.valor - valorParcela * (parcelas - 1)).toFixed(2))
        : valorParcela;

      const descricao = parcelas > 1
        ? `${input.descricao} (${i + 1}/${parcelas})`
        : input.descricao;

      const r = await db.query(
        `INSERT INTO lancamentos_financeiros (
           tenant_id, cliente_id, tipo, descricao, favorecido,
           valor, data_vencimento, status, origem, origem_ref_tipo, origem_ref_id,
           plano_conta_id, centro_custo_id, pessoa_id, criado_por,
           observacoes, numero_parcela, total_parcelas,
           projeto_id, projeto_codigo
         ) VALUES ($1,$2,'receber',$3,$4,$5,$6,'previsto','integracao',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          input.tenantId,
          input.clienteControlId,
          descricao,
          favorecido,
          valor,
          vencimento,
          input.origemRefTipo,
          input.origemRefId || null,
          planoContaId,
          input.centroCustoId || null,
          pessoaId,
          input.criadoPor || null,
          input.observacoes || null,
          parcelas > 1 ? i + 1 : null,
          parcelas > 1 ? parcelas : null,
          input.projetoId   || null,
          input.projetoCodigo || null,
        ]
      );
      lancamentos.push(r.rows[0]);
    }

    await db.query("COMMIT");
    return { ok: true, lancamentos };
  } catch (e: any) {
    await db.query("ROLLBACK");
    if (e.code === "23505") {
      return { ok: true, jaExiste: true };
    }
    return { ok: false, error: e.message };
  } finally {
    db.release();
  }
}

export async function resolveClienteControlId(
  pessoaId: string,
  tenantId: string
): Promise<string | null> {
  const r = await pool.query(
    `SELECT c.id FROM clients c
     JOIN pessoas p ON p.cnpj_cpf = c.cnpj
     WHERE p.id = $1 AND c.tenant_id = $2
     LIMIT 1`,
    [pessoaId, tenantId]
  );
  if (r.rows[0]) return r.rows[0].id;

  const r2 = await pool.query(
    `SELECT c.id FROM clients c
     JOIN pessoas p ON p.legacy_client_id = c.id
     WHERE p.id = $1 AND c.tenant_id = $2
     LIMIT 1`,
    [pessoaId, tenantId]
  );
  return r2.rows[0]?.id ?? null;
}
