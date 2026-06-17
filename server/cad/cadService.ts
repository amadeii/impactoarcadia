/**
 * CAD-01 — cadService.ts
 * Serviços de domínio dos Cadastros Centrais do SOE.
 */

import { pool } from "../../db/index";
import { withTransaction, ok, err, assertTenantId, isValidNcm, isValidCnpj } from "../soe/conventions";
import type { SoeContext, SoeResult } from "../soe/conventions";
import { auditLog } from "../soe/conventions";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ProdutoFiscal {
  id: string;
  tenantId: string;
  codigo: string;
  descricao: string;
  descricaoNfe: string | null;
  unidade: string;
  ncm: string | null;
  cest: string | null;
  origem: number;
  grupoTributacaoId: number | null;
  controlaLote: boolean;
  controlaSerial: boolean;
  precoCusto: string;
  custoMedio: string;
  precoVendaBase: string;
  estoqueMinimo: string;
  status: string;
  productId: number | null;
}

export interface EmitenteFiscal {
  id: string;
  tenantId: string;
  empresaId: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  ie: string | null;
  im: string | null;
  cnaePrincipal: string | null;
  crt: number;
  ambiente: 'homologacao' | 'producao';
  serieNfe: number;
  serieNfce: number;
  serieNfse: number;
  proximoNumNfe: number;
  proximoNumNfce: number;
  plusCertificadoRef: string | null;
  certificadoCnpj: string | null;
  certificadoSerial: string | null;
  certificadoValidoAte: Date | null;
  certificadoTipo: string;
  status: string;
}

export interface ParcelaGerada {
  sequencia: number;
  vencimento: string;
  valor: number;
  formaPagamento: string;
  percentual: number;
}

// ─── PRODUTO FISCAL ──────────────────────────────────────────────────────────

export interface CriarProdutoFiscalInput {
  codigo: string;
  descricao: string;
  descricaoNfe?: string;
  unidade?: string;
  ncm?: string;
  cest?: string;
  origem?: number;
  grupoTributacaoId?: number;
  controlaLote?: boolean;
  controlaSerial?: boolean;
  precoVendaBase?: number;
  estoqueMinimo?: number;
  categoria?: string;
  marca?: string;
  modelo?: string;
  productId?: number;
  externoIdPlus?: string;
}

export async function criarProdutoFiscal(
  ctx: SoeContext,
  input: CriarProdutoFiscalInput
): Promise<SoeResult<ProdutoFiscal>> {
  assertTenantId(ctx.tenantId, "criarProdutoFiscal");

  if (input.ncm && !isValidNcm(input.ncm)) {
    return err(`NCM inválido: '${input.ncm}'. Deve ter 8 dígitos.`, "INVALID_NCM");
  }
  if (!input.codigo?.trim()) {
    return err("Campo 'codigo' é obrigatório.", "REQUIRED_FIELD");
  }
  if (!input.descricao?.trim()) {
    return err("Campo 'descricao' é obrigatório.", "REQUIRED_FIELD");
  }

  return withTransaction(async (client) => {
    const dup = await client.query(
      `SELECT id FROM produto_fiscal WHERE tenant_id = $1 AND codigo = $2`,
      [ctx.tenantId, input.codigo.trim()]
    );
    if (dup.rowCount! > 0) {
      return err(`Produto com código '${input.codigo}' já existe neste tenant.`, "DUPLICATE_CODE");
    }

    const { rows } = await client.query(
      `INSERT INTO produto_fiscal (
         tenant_id, codigo, descricao, descricao_nfe, unidade,
         ncm, cest, origem, grupo_tributacao_id,
         controla_lote, controla_serial,
         preco_venda_base, estoque_minimo,
         categoria, marca, modelo,
         product_id, externo_id_plus,
         created_by_id, updated_by_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19)
       RETURNING *`,
      [
        ctx.tenantId,
        input.codigo.trim(),
        input.descricao.trim(),
        input.descricaoNfe?.trim() ?? null,
        input.unidade ?? 'UN',
        input.ncm ? input.ncm.replace(/\D/g, '') : null,
        input.cest ? input.cest.replace(/\D/g, '') : null,
        input.origem ?? 0,
        input.grupoTributacaoId ?? null,
        input.controlaLote ?? false,
        input.controlaSerial ?? false,
        input.precoVendaBase ?? 0,
        input.estoqueMinimo ?? 0,
        input.categoria ?? null,
        input.marca ?? null,
        input.modelo ?? null,
        input.productId ?? null,
        input.externoIdPlus ?? null,
        ctx.userId,
      ]
    );

    await auditLog(client, {
      ctx,
      entityType: 'produto_fiscal',
      entityId:   rows[0].id,
      action:     'created',
      afterState: rows[0],
    });

    return ok(mapProdutoFiscal(rows[0]));
  });
}

export async function buscarProdutoFiscal(
  tenantId: string,
  id: string
): Promise<SoeResult<ProdutoFiscal & { tributacaoUf?: any[] }>> {
  const { rows } = await pool.query(
    `SELECT pf.*,
            fgt.nome AS grupo_tributacao_nome,
            fgt.cfop_estadual, fgt.cfop_outro_estado,
            fgt.cst_csosn, fgt.perc_icms, fgt.perc_pis, fgt.perc_cofins
     FROM produto_fiscal pf
     LEFT JOIN fiscal_grupos_tributacao fgt ON fgt.id = pf.grupo_tributacao_id
     WHERE pf.id = $1 AND pf.tenant_id = $2`,
    [id, tenantId]
  );
  if (!rows[0]) return err("Produto fiscal não encontrado.", "NOT_FOUND");

  const tributacaoUf = await pool.query(
    `SELECT * FROM produto_fiscal_tributacao_uf
     WHERE produto_fiscal_id = $1 AND (vigencia_fim IS NULL OR vigencia_fim >= CURRENT_DATE)
     ORDER BY uf_destino`,
    [id]
  );

  return ok({ ...mapProdutoFiscal(rows[0]), tributacaoUf: tributacaoUf.rows });
}

export async function resolverProdutoPorCodigoFornecedor(
  tenantId: string,
  codigoNoXml: string,
  ncm: string,
  fornecedorPessoaId?: string
): Promise<{ produtoFiscalId: string | null; confianca: 'exato' | 'ncm' | 'nenhum' }> {
  const { rows: exact } = await pool.query(
    `SELECT id FROM produto_fiscal
     WHERE tenant_id = $1 AND (codigo = $2 OR externo_id_plus = $2) AND status = 'ativo'
     LIMIT 1`,
    [tenantId, codigoNoXml]
  );
  if (exact[0]) return { produtoFiscalId: exact[0].id, confianca: 'exato' };

  if (ncm) {
    const { rows: byNcm } = await pool.query(
      `SELECT id FROM produto_fiscal
       WHERE tenant_id = $1 AND ncm = $2 AND status = 'ativo'`,
      [tenantId, ncm.replace(/\D/g, '')]
    );
    if (byNcm.length === 1) return { produtoFiscalId: byNcm[0].id, confianca: 'ncm' };
  }

  return { produtoFiscalId: null, confianca: 'nenhum' };
}

export async function atualizarCustoMedio(
  produtoFiscalId: string,
  tenantId: string,
  saldoAtual: number,
  custoAtual: number,
  qtdEntrada: number,
  custoEntrada: number
): Promise<void> {
  const totalQtd = saldoAtual + qtdEntrada;
  if (totalQtd <= 0) return;
  const novoCusto = ((saldoAtual * custoAtual) + (qtdEntrada * custoEntrada)) / totalQtd;

  await pool.query(
    `UPDATE produto_fiscal
     SET custo_medio = $1, preco_custo = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3`,
    [novoCusto.toFixed(4), produtoFiscalId, tenantId]
  );
}

// ─── EMITENTE FISCAL ─────────────────────────────────────────────────────────

export interface CriarEmitenteInput {
  empresaId: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  ie?: string;
  im?: string;
  cnaePrincipal?: string;
  crt?: 1 | 2 | 3 | 4;
  ambiente?: 'homologacao' | 'producao';
  serieNfe?: number;
  serieNfse?: number;
  plusCertificadoRef?: string;
  certificadoCnpj?: string;
  certificadoSerial?: string;
  certificadoValidoAte?: Date;
}

export async function criarOuAtualizarEmitente(
  ctx: SoeContext,
  input: CriarEmitenteInput
): Promise<SoeResult<EmitenteFiscal>> {
  assertTenantId(ctx.tenantId, "criarOuAtualizarEmitente");

  const cnpj = input.cnpj.replace(/\D/g, '');
  if (!isValidCnpj(cnpj)) {
    return err(`CNPJ inválido: '${input.cnpj}'.`, "INVALID_CNPJ");
  }

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO emitentes_fiscal (
         tenant_id, empresa_id, cnpj, razao_social, nome_fantasia,
         ie, im, cnae_principal, crt, ambiente,
         serie_nfe, serie_nfse,
         plus_certificado_ref, certificado_cnpj, certificado_serial,
         certificado_valido_ate,
         created_by_id, updated_by_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
       ON CONFLICT (tenant_id, empresa_id) WHERE status = 'ativo'
       DO UPDATE SET
         cnpj                    = EXCLUDED.cnpj,
         razao_social            = EXCLUDED.razao_social,
         nome_fantasia           = EXCLUDED.nome_fantasia,
         ie                      = EXCLUDED.ie,
         im                      = EXCLUDED.im,
         cnae_principal          = EXCLUDED.cnae_principal,
         crt                     = EXCLUDED.crt,
         ambiente                = EXCLUDED.ambiente,
         serie_nfe               = EXCLUDED.serie_nfe,
         serie_nfse              = EXCLUDED.serie_nfse,
         plus_certificado_ref    = EXCLUDED.plus_certificado_ref,
         certificado_cnpj        = EXCLUDED.certificado_cnpj,
         certificado_serial      = EXCLUDED.certificado_serial,
         certificado_valido_ate  = EXCLUDED.certificado_valido_ate,
         updated_by_id           = EXCLUDED.updated_by_id,
         updated_at              = NOW()
       RETURNING *`,
      [
        ctx.tenantId, input.empresaId,
        cnpj, input.razaoSocial.trim(),
        input.nomeFantasia?.trim() ?? null,
        input.ie?.replace(/\D/g, '') ?? null,
        input.im?.replace(/\D/g, '') ?? null,
        input.cnaePrincipal ?? null,
        input.crt ?? 1,
        input.ambiente ?? 'homologacao',
        input.serieNfe ?? 1,
        input.serieNfse ?? 1,
        input.plusCertificadoRef ?? null,
        input.certificadoCnpj?.replace(/\D/g, '') ?? null,
        input.certificadoSerial ?? null,
        input.certificadoValidoAte ?? null,
        ctx.userId,
      ]
    );

    await auditLog(client, {
      ctx,
      entityType: 'emitente_fiscal',
      entityId:   rows[0].id,
      action:     'updated',
      afterState: { ...rows[0], cnpj: '***' },
    });

    return ok(mapEmitente(rows[0]));
  });
}

export async function buscarEmitente(
  tenantId: string,
  empresaId: number
): Promise<SoeResult<EmitenteFiscal>> {
  const { rows } = await pool.query(
    `SELECT * FROM emitentes_fiscal
     WHERE tenant_id = $1 AND empresa_id = $2 AND status = 'ativo'
     LIMIT 1`,
    [tenantId, empresaId]
  );
  if (!rows[0]) return err(
    `Emitente fiscal não configurado para empresa ${empresaId}. Configure em CAD > Fiscal.`,
    "EMITENTE_NOT_FOUND"
  );
  return ok(mapEmitente(rows[0]));
}

export async function proximoNumeroFiscal(
  tenantId: string,
  empresaId: number,
  tipo: 'nfe' | 'nfce' | 'nfse'
): Promise<SoeResult<{ numero: number; serie: number }>> {
  const campo = tipo === 'nfe' ? 'proximo_num_nfe'
              : tipo === 'nfce' ? 'proximo_num_nfce'
              : null;

  if (!campo) return err('NFS-e: número gerenciado pelo município via Control Plus.', 'NFSE_NUM_EXTERNAL');

  const { rows } = await pool.query(
    `UPDATE emitentes_fiscal
     SET ${campo} = ${campo} + 1, updated_at = NOW()
     WHERE tenant_id = $1 AND empresa_id = $2 AND status = 'ativo'
     RETURNING ${campo} - 1 AS numero,
               CASE WHEN $3 = 'nfe' THEN serie_nfe ELSE serie_nfce END AS serie`,
    [tenantId, empresaId, tipo]
  );
  if (!rows[0]) return err("Emitente não encontrado.", "NOT_FOUND");
  return ok({ numero: rows[0].numero, serie: rows[0].serie });
}

// ─── TABELA DE PREÇO ─────────────────────────────────────────────────────────

export interface ResolverPrecoInput {
  tenantId:         string;
  produtoFiscalId?: string;
  productId?:       number;
  tabelaPrecoId?:   string;
  quantidade?:      number;
}

export interface PrecoResolvido {
  precoUnitario: number;
  origem: 'item_tabela' | 'desconto_global' | 'base';
  tabelaId: string | null;
}

export async function resolverPreco(
  input: ResolverPrecoInput
): Promise<PrecoResolvido> {
  if (input.tabelaPrecoId) {
    const cond = input.produtoFiscalId
      ? `pti.produto_fiscal_id = $3`
      : `pti.product_id = $3`;
    const val = input.produtoFiscalId ?? input.productId;
    const qtd = input.quantidade ?? 1;

    const { rows } = await pool.query(
      `SELECT pti.preco_unitario, pti.desconto_perc, pti.markup_perc,
              pf.preco_venda_base, pf.preco_custo,
              tp.desconto_perc AS tabela_desconto, tp.markup_perc AS tabela_markup
       FROM soe_tabela_preco_itens pti
       JOIN soe_tabelas_preco tp ON tp.id = pti.tabela_preco_id
       LEFT JOIN produto_fiscal pf ON pf.id = pti.produto_fiscal_id
       WHERE pti.tabela_preco_id = $1
         AND ${cond}
         AND (pti.quantidade_minima IS NULL OR pti.quantidade_minima <= $4)
         AND (pti.vigencia_fim IS NULL OR pti.vigencia_fim >= CURRENT_DATE)
         AND tp.status = 'ativo'
       ORDER BY pti.quantidade_minima DESC NULLS LAST
       LIMIT 1`,
      [input.tabelaPrecoId, input.tenantId, val, qtd]
    );

    if (rows[0]) {
      const r = rows[0];
      if (r.preco_unitario != null) {
        return { precoUnitario: parseFloat(r.preco_unitario), origem: 'item_tabela', tabelaId: input.tabelaPrecoId };
      }
      const base = parseFloat(r.preco_venda_base ?? 0);
      if (r.desconto_perc != null) {
        const preco = base * (1 - parseFloat(r.desconto_perc) / 100);
        return { precoUnitario: Math.max(0, preco), origem: 'item_tabela', tabelaId: input.tabelaPrecoId };
      }
      if (r.markup_perc != null) {
        const custo = parseFloat(r.preco_custo ?? 0);
        const preco = custo * (1 + parseFloat(r.markup_perc) / 100);
        return { precoUnitario: Math.max(0, preco), origem: 'item_tabela', tabelaId: input.tabelaPrecoId };
      }
      if (r.tabela_desconto != null) {
        const preco = base * (1 - parseFloat(r.tabela_desconto) / 100);
        return { precoUnitario: Math.max(0, preco), origem: 'desconto_global', tabelaId: input.tabelaPrecoId };
      }
    }
  }

  if (input.produtoFiscalId) {
    const { rows } = await pool.query(
      `SELECT preco_venda_base FROM produto_fiscal WHERE id = $1 AND tenant_id = $2`,
      [input.produtoFiscalId, input.tenantId]
    );
    if (rows[0]) {
      return { precoUnitario: parseFloat(rows[0].preco_venda_base ?? 0), origem: 'base', tabelaId: null };
    }
  }

  return { precoUnitario: 0, origem: 'base', tabelaId: null };
}

// ─── CONDIÇÃO DE PAGAMENTO ────────────────────────────────────────────────────

export async function gerarParcelas(
  tenantId: string,
  condicaoId: string,
  total: number,
  dataBase?: Date
): Promise<SoeResult<ParcelaGerada[]>> {
  const { rows: condicao } = await pool.query(
    `SELECT cp.*, array_agg(
       json_build_object(
         'sequencia', p.sequencia,
         'dias', p.dias,
         'percentual', p.percentual,
         'forma_pagamento', p.forma_pagamento
       ) ORDER BY p.sequencia
     ) AS parcelas_config
     FROM soe_condicoes_pagamento cp
     LEFT JOIN soe_condicao_parcelas p ON p.condicao_pagamento_id = cp.id
     WHERE cp.id = $1 AND cp.tenant_id = $2 AND cp.status = 'ativo'
     GROUP BY cp.id`,
    [condicaoId, tenantId]
  );

  if (!condicao[0]) return err("Condição de pagamento não encontrada.", "NOT_FOUND");

  const c = condicao[0];
  const base = dataBase ?? new Date();
  const parcelas: ParcelaGerada[] = [];

  if (c.tipo === 'a_vista') {
    const venc = new Date(base);
    venc.setDate(venc.getDate() + (c.dias_vencimento ?? 0));
    return ok([{
      sequencia: 1,
      vencimento: venc.toISOString().split('T')[0],
      valor: roundCurrency(total),
      formaPagamento: (c.formas_aceitas?.[0]) ?? '01',
      percentual: 100,
    }]);
  }

  const configs = (c.parcelas_config ?? []).filter((p: any) => p.sequencia != null);
  if (configs.length === 0) return err("Condição parcelada sem parcelas configuradas.", "MISSING_PARCELAS");

  let acumulado = 0;
  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    const venc = new Date(base);
    venc.setDate(venc.getDate() + cfg.dias);

    const isLast = i === configs.length - 1;
    const valor = isLast
      ? roundCurrency(total - acumulado)
      : roundCurrency(total * cfg.percentual / 100);

    acumulado += valor;
    parcelas.push({
      sequencia: cfg.sequencia,
      vencimento: venc.toISOString().split('T')[0],
      valor,
      formaPagamento: cfg.forma_pagamento ?? (c.formas_aceitas?.[0]) ?? '15',
      percentual: cfg.percentual,
    });
  }

  return ok(parcelas);
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function roundCurrency(v: number): number {
  return Math.round(v * 100) / 100;
}

function mapProdutoFiscal(row: any): ProdutoFiscal {
  return {
    id:                row.id,
    tenantId:          row.tenant_id,
    codigo:            row.codigo,
    descricao:         row.descricao,
    descricaoNfe:      row.descricao_nfe,
    unidade:           row.unidade,
    ncm:               row.ncm,
    cest:              row.cest,
    origem:            row.origem,
    grupoTributacaoId: row.grupo_tributacao_id,
    controlaLote:      row.controla_lote,
    controlaSerial:    row.controla_serial,
    precoCusto:        row.preco_custo,
    custoMedio:        row.custo_medio,
    precoVendaBase:    row.preco_venda_base,
    estoqueMinimo:     row.estoque_minimo,
    status:            row.status,
    productId:         row.product_id,
  };
}

function mapEmitente(row: any): EmitenteFiscal {
  return {
    id:                    row.id,
    tenantId:              row.tenant_id,
    empresaId:             row.empresa_id,
    cnpj:                  row.cnpj,
    razaoSocial:           row.razao_social,
    nomeFantasia:          row.nome_fantasia,
    ie:                    row.ie,
    im:                    row.im,
    cnaePrincipal:         row.cnae_principal,
    crt:                   row.crt,
    ambiente:              row.ambiente,
    serieNfe:              row.serie_nfe,
    serieNfce:             row.serie_nfce,
    serieNfse:             row.serie_nfse,
    proximoNumNfe:         row.proximo_num_nfe,
    proximoNumNfce:        row.proximo_num_nfce,
    plusCertificadoRef:    row.plus_certificado_ref,
    certificadoCnpj:       row.certificado_cnpj,
    certificadoSerial:     row.certificado_serial,
    certificadoValidoAte:  row.certificado_valido_ate,
    certificadoTipo:       row.certificado_tipo,
    status:                row.status,
  };
}
