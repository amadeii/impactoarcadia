/**
 * COMP-01 — compService.ts
 * Serviços de domínio do Módulo Compras do SOE.
 *
 * FLUXO:
 *   XML upload → importarNfeXml() → parseia + resolve fornecedor + resolve produtos
 *             → validarEntrada()  → FiscalValidator (adaptado para entrada)
 *             → aprovarEntrada()  → publica purchase_invoice.approved
 *                                 → EST-01 registra entrada física
 *                                 → Control gera AP por duplicata
 */

import { pool } from "../../db/index";
import {
  withTransaction, ok, err, assertTenantId, auditLog,
  type SoeContext, type SoeResult
} from "../soe/conventions";
import { publishEvent } from "../soe/eventBus";
import { parseNfeXml, validarChaveNfe, type NfeParseResult } from "./nfeParser";
import { resolverProdutoPorCodigoFornecedor } from "../cad/cadService";
import { FiscalValidator, type FiscalNfeInput } from "../fisc/FiscalValidator";
import { gerarLancamentoReceber } from "../control/arService";

const fiscalValidator = new FiscalValidator();

// ─── Importar NF-e por XML ────────────────────────────────────────────────────

export async function importarNfeXml(
  ctx:               SoeContext,
  xmlContent:        string,
  depositoDestinoId?: string
): Promise<SoeResult<{ entradaId: string; chave: string; errosParser: string[] }>> {
  assertTenantId(ctx.tenantId, "importarNfeXml");

  if (!xmlContent?.trim()) {
    return err("XML não pode ser vazio.", "REQUIRED");
  }

  const parsed = parseNfeXml(xmlContent);
  if (!parsed.cabeçalho?.chaveNfe) {
    return err(`XML inválido: ${parsed.erros.join('; ')}`, "INVALID_XML");
  }

  const chave = parsed.cabeçalho.chaveNfe;
  if (!validarChaveNfe(chave)) {
    return err(`Chave de acesso inválida: ${chave}`, "INVALID_CHAVE");
  }

  return withTransaction(async (client) => {
    // Idempotência: NF-e já importada?
    const { rows: dup } = await client.query(
      `SELECT id, status FROM purchase_invoice_entries
       WHERE tenant_id = $1 AND chave_nfe = $2`,
      [ctx.tenantId, chave]
    );
    if (dup[0]) {
      return ok({
        entradaId:   dup[0].id,
        chave,
        errosParser: [`NF-e ${chave} já foi importada (status: ${dup[0].status}).`]
      });
    }

    const cab = parsed.cabeçalho;

    // Resolver fornecedor por CNPJ
    const { rows: [fornecedorPessoa] } = await client.query(
      `SELECT id FROM pessoas
       WHERE tenant_id = $1 AND cnpj_cpf = $2 LIMIT 1`,
      [ctx.tenantId, cab.emitenteCnpj.replace(/\D/g, '')]
    );

    // Buscar relação fiscal do fornecedor
    let relacaoFiscal: any = null;
    if (fornecedorPessoa) {
      const { rows: [rel] } = await client.query(
        `SELECT * FROM relacao_fiscal_fornecedor
         WHERE tenant_id = $1 AND fornecedor_pessoa_id = $2`,
        [ctx.tenantId, fornecedorPessoa.id]
      );
      relacaoFiscal = rel;
    }

    // Inserir cabeçalho
    const { rows: [entrada] } = await client.query(
      `INSERT INTO purchase_invoice_entries (
         tenant_id, empresa_id, chave_nfe, numero_nfe, serie_nfe,
         fornecedor_cnpj, fornecedor_nome, fornecedor_pessoa_id, fornecedor_uf, fornecedor_ie,
         data_emissao, data_saida_entrada,
         valor_produtos, valor_frete, valor_seguro, valor_desconto,
         valor_outros, valor_ipi, valor_icms_st, valor_total,
         xml_original, status, manifestacao_status,
         deposito_destino_id, importado_por_id, created_by_id, updated_by_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'importado','pendente',$22,$23,$23,$23)
       RETURNING *`,
      [
        ctx.tenantId, ctx.empresaId ? parseInt(ctx.empresaId) : null,
        chave, cab.numeroNfe, cab.serieNfe,
        cab.emitenteCnpj.replace(/\D/g, ''), cab.emitenteNome,
        fornecedorPessoa?.id ?? null, cab.emitenteUf, cab.emitenteIe ?? null,
        cab.dataEmissao, cab.dataSaidaEntrada ?? null,
        cab.valorProdutos, cab.valorFrete, cab.valorSeguro, cab.valorDesconto,
        cab.valorOutros, cab.valorIpi, cab.valorIcmsSt, cab.valorTotal,
        xmlContent,
        depositoDestinoId ?? relacaoFiscal?.deposito_destino_id ?? null,
        ctx.userId,
      ]
    );

    // Inserir itens com resolução de produto
    for (const item of parsed.itens) {
      const resolucao = await resolverProdutoPorCodigoFornecedor(
        ctx.tenantId,
        item.codigoProdutoXml,
        item.ncm,
        fornecedorPessoa?.id
      );

      await client.query(
        `INSERT INTO purchase_invoice_items (
           purchase_invoice_id, sequencia,
           produto_fiscal_id, product_id,
           codigo_produto_xml, descricao_xml, ncm, cest, cfop, unidade,
           quantidade, valor_unitario, valor_desconto, valor_frete, valor_outros, sub_total,
           origem, cst_csosn, perc_red_bc, base_calc_icms, perc_icms, valor_icms,
           base_calc_icms_st, perc_mva_st, perc_icms_st, valor_icms_st,
           cst_pis, base_calc_pis, perc_pis, valor_pis,
           cst_cofins, base_calc_cofins, perc_cofins, valor_cofins,
           cst_ipi, c_enq, base_calc_ipi, perc_ipi, valor_ipi,
           lote, data_validade_lote, inf_ad_prod
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42)`,
        [
          entrada.id, item.sequencia,
          resolucao.produtoFiscalId ?? null, null,
          item.codigoProdutoXml, item.descricaoXml,
          item.ncm?.replace(/\D/g, ''), item.cest?.replace(/\D/g, '') ?? null,
          item.cfop, item.unidade,
          item.quantidade, item.valorUnitario, item.valorDesconto, item.valorFrete,
          item.valorOutros, item.subTotal,
          item.origem, item.cstCsosn,
          item.percRedBc, item.baseCalcIcms, item.percIcms, item.valorIcms,
          item.baseCalcIcmsSt, item.percMvaSt, item.percIcmsSt, item.valorIcmsSt,
          item.cstPis ?? null, item.baseCalcPis, item.percPis, item.valorPis,
          item.cstCofins ?? null, item.baseCalcCofins, item.percCofins, item.valorCofins,
          item.cstIpi ?? null, item.cEnq ?? null, item.baseCalcIpi, item.percIpi, item.valorIpi,
          item.lote ?? null, item.dataValidadeLote ?? null, item.infAdProd ?? null,
        ]
      );
    }

    // Inserir duplicatas
    for (const d of parsed.duplicatas) {
      await client.query(
        `INSERT INTO purchase_invoice_installments
           (purchase_invoice_id, numero_duplicata, vencimento, valor, status)
         VALUES ($1,$2,$3,$4,'pendente')
         ON CONFLICT (purchase_invoice_id, numero_duplicata) DO NOTHING`,
        [entrada.id, d.numeroDuplicata, d.vencimento, d.valor]
      );
    }

    // Sem duplicatas no XML → gera parcela única com vencimento + 30d
    if (parsed.duplicatas.length === 0 && cab.valorTotal > 0) {
      const venc = new Date(cab.dataEmissao);
      venc.setDate(venc.getDate() + 30);
      await client.query(
        `INSERT INTO purchase_invoice_installments
           (purchase_invoice_id, numero_duplicata, vencimento, valor, status)
         VALUES ($1,'001',$2,$3,'pendente')`,
        [entrada.id, venc.toISOString().split('T')[0], cab.valorTotal]
      );
    }

    await auditLog(client, {
      ctx, entityType: 'purchase_invoice_entry', entityId: entrada.id,
      action: 'created',
      afterState: { chaveNfe: chave, status: 'importado', valorTotal: cab.valorTotal }
    });

    return ok({
      entradaId:   entrada.id,
      chave,
      errosParser: parsed.erros,
    });
  });
}

// ─── Validar entrada com FiscalValidator ──────────────────────────────────────

export async function validarEntrada(
  ctx:       SoeContext,
  entradaId: string
): Promise<SoeResult<{ podeAprovar: boolean; resultado: any }>> {
  const { rows: [entrada] } = await pool.query(
    `SELECT e.*, em.crt, em.uf AS emitente_uf
     FROM purchase_invoice_entries e
     LEFT JOIN emitentes_fiscal em ON em.empresa_id = e.empresa_id AND em.tenant_id = e.tenant_id
     WHERE e.id = $1 AND e.tenant_id = $2`,
    [entradaId, ctx.tenantId]
  );
  if (!entrada) return err("Entrada não encontrada.", "NOT_FOUND");

  const { rows: itens } = await pool.query(
    `SELECT * FROM purchase_invoice_items WHERE purchase_invoice_id = $1`,
    [entradaId]
  );

  const nfeInput: FiscalNfeInput = {
    tipoDocumento:    0,
    naturezaOperacao: 'Compra',
    valorTotal:       parseFloat(entrada.valor_total),
    destinatario: {
      tipoPessoa:   'PJ',
      cnpjCpf:      entrada.fornecedor_cnpj,
      nome:         entrada.fornecedor_nome,
      contribuinte: 'S',
      indIeDest:    1,
      uf:           entrada.fornecedor_uf ?? 'SP',
    },
    itens: itens.map((i, idx) => ({
      sequencia:     i.sequencia ?? idx + 1,
      codigo:        i.codigo_produto_xml,
      descricao:     i.descricao_xml,
      ncm:           i.ncm,
      cfop:          i.cfop,
      unidade:       i.unidade,
      quantidade:    parseFloat(i.quantidade),
      valorUnitario: parseFloat(i.valor_unitario),
      valorTotal:    parseFloat(i.sub_total),
      desconto:      parseFloat(i.valor_desconto ?? '0'),
      cstCsosn:      i.cst_csosn,
      cstPis:        i.cst_pis,
      cstCofins:     i.cst_cofins,
      origem:        i.origem ?? 0,
    })),
  };

  const emitenteInput = {
    cnpj:    entrada.fornecedor_cnpj,
    uf:      entrada.emitente_uf ?? entrada.fornecedor_uf ?? 'SP',
    crt:     (entrada.crt ?? 3) as 1 | 2 | 3 | 4,
    ambiente: 'producao' as const,
  };

  const resultado = fiscalValidator.validateToObject(nfeInput, emitenteInput);

  await pool.query(
    `INSERT INTO purchase_invoice_validation_results
       (purchase_invoice_id, status, risco, pode_aprovar, total_erros, total_alertas, mensagens)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      entradaId, resultado.status, resultado.risco,
      resultado.podeEmitir,
      resultado.resumo.erros, resultado.resumo.alertas,
      JSON.stringify(resultado.mensagens),
    ]
  );

  const novoStatus = resultado.podeEmitir ? 'validando' : 'com_divergencia';
  await pool.query(
    `UPDATE purchase_invoice_entries SET status = $2, updated_at = NOW()
     WHERE id = $1`,
    [entradaId, novoStatus]
  );

  return ok({ podeAprovar: resultado.podeEmitir, resultado });
}

// ─── Aprovar entrada ──────────────────────────────────────────────────────────

export async function aprovarEntrada(
  ctx:       SoeContext,
  entradaId: string
): Promise<SoeResult<{ entradaId: string }>> {
  return withTransaction(async (client) => {
    const { rows: [entrada] } = await client.query(
      `SELECT * FROM purchase_invoice_entries WHERE id = $1 AND tenant_id = $2`,
      [entradaId, ctx.tenantId]
    );
    if (!entrada) return err("Entrada não encontrada.", "NOT_FOUND");
    if (['aprovado', 'estornado'].includes(entrada.status)) {
      return err(`Entrada já está ${entrada.status}.`, "INVALID_STATUS");
    }

    await client.query(
      `UPDATE purchase_invoice_entries
       SET status = 'aprovado', aprovado_por_id = $3, aprovado_em = NOW(),
           updated_by_id = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [entradaId, ctx.tenantId, ctx.userId]
    );

    const { rows: itens } = await client.query(
      `SELECT pii.*, pf.codigo AS pf_codigo, pf.preco_custo AS custo_atual
       FROM purchase_invoice_items pii
       LEFT JOIN produto_fiscal pf ON pf.id = pii.produto_fiscal_id
       WHERE pii.purchase_invoice_id = $1`,
      [entradaId]
    );

    const { rows: parcelas } = await client.query(
      `SELECT * FROM purchase_invoice_installments WHERE purchase_invoice_id = $1`,
      [entradaId]
    );

    await publishEvent(client, {
      tenantId:      ctx.tenantId,
      eventType:     'purchase_invoice.approved',
      aggregateType: 'purchase_invoice_entry',
      aggregateId:   entradaId,
      payload: {
        entradaId,
        chaveNfe:           entrada.chave_nfe,
        fornecedorPessoaId: entrada.fornecedor_pessoa_id,
        empresaId:          entrada.empresa_id,
        depositoDestinoId:  entrada.deposito_destino_id,
        valorTotal:         parseFloat(entrada.valor_total),
        itens: itens.map(i => ({
          produtoFiscalId: i.produto_fiscal_id,
          productId:       i.product_id,
          quantidade:      parseFloat(i.quantidade),
          valorUnitario:   parseFloat(i.valor_unitario),
          custoUnitario:   parseFloat(i.valor_unitario),
          documentoNumero: String(entrada.numero_nfe),
          documentoChave:  entrada.chave_nfe,
        })),
        parcelas: parcelas.map(p => ({
          numeroDuplicata: p.numero_duplicata,
          vencimento:      p.vencimento,
          valor:           parseFloat(p.valor),
          installmentId:   p.id,
        })),
      },
      createdById: ctx.userId,
    });

    await auditLog(client, {
      ctx, entityType: 'purchase_invoice_entry', entityId: entradaId,
      action: 'status_changed',
      beforeState: { status: entrada.status },
      afterState:  { status: 'aprovado' },
    });

    return ok({ entradaId });
  });
}

// ─── Registrar manifestação DF-e ─────────────────────────────────────────────

export type TipoManifestacao = 'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao_realizado';

export async function registrarManifestacao(
  ctx:       SoeContext,
  entradaId: string,
  tipo:      TipoManifestacao
): Promise<SoeResult<{ ok: boolean; mensagem?: string }>> {
  const { rows: [entrada] } = await pool.query(
    `SELECT * FROM purchase_invoice_entries WHERE id = $1 AND tenant_id = $2`,
    [entradaId, ctx.tenantId]
  );
  if (!entrada) return err("Entrada não encontrada.", "NOT_FOUND");

  const plusUrl   = process.env.PLUS_URL   || '';
  const plusToken = process.env.PLUS_API_TOKEN || '';

  if (plusUrl && plusToken) {
    try {
      const response = await fetch(`${plusUrl}/api/dfe/manifestar`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${plusToken}`,
          'X-Empresa-Id':  String(entrada.empresa_id ?? 1),
        },
        body: JSON.stringify({ chave_nfe: entrada.chave_nfe, tipo_evento: tipo }),
      });
      const result = await response.json();
      if (!result.success && !result.ok) {
        return err(result.message ?? 'Erro ao manifestar no Control Plus.', 'PLUS_ERROR');
      }
    } catch (e: any) {
      return err(`Erro de conexão com Control Plus: ${e.message}`, 'CONNECTION_ERROR');
    }
  }

  await pool.query(
    `UPDATE purchase_invoice_entries
     SET manifestacao_status = $3, manifestacao_em = NOW(),
         manifestacao_usuario_id = $4, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [entradaId, ctx.tenantId, tipo, ctx.userId]
  );

  return ok({
    ok: true,
    mensagem: !plusUrl ? `Manifestação registrada localmente (Control Plus não configurado).` : undefined,
  });
}

// ─── Consumer: purchase_invoice.approved → gerar AP ──────────────────────────

export async function handlePurchaseInvoiceApproved_Comp(event: any): Promise<void> {
  const { entradaId, fornecedorPessoaId, parcelas, valorTotal } = event.payload;
  const tenantId = event.tenantId;

  if (!parcelas?.length || !fornecedorPessoaId) return;

  try {
    const { resolveClienteControlId } = await import('../control/arService');
    const clienteControlId = await resolveClienteControlId(fornecedorPessoaId, tenantId);
    if (!clienteControlId) return;

    const { rows: [entrada] } = await pool.query(
      `SELECT numero_nfe, chave_nfe FROM purchase_invoice_entries WHERE id = $1`,
      [entradaId]
    );

    for (const parcela of parcelas) {
      const apResult = await gerarLancamentoReceber({
        tenantId,
        clienteControlId,
        pessoaId:       fornecedorPessoaId,
        descricao:      `Compra NF-e ${entrada?.numero_nfe ?? ''} — dup ${parcela.numeroDuplicata}`,
        valor:          parseFloat(parcela.valor),
        dataVencimento: parcela.vencimento,
        origemRefTipo:  'venda',
        origemRefId:    `${entradaId}-dup-${parcela.numeroDuplicata}`,
        criadoPor:      event.createdById ?? 'system',
      });

      if (apResult.ok && apResult.lancamentos?.[0]) {
        await pool.query(
          `UPDATE purchase_invoice_installments
           SET status = 'gerado_ap', lancamento_pagar_id = $2
           WHERE id = $3`,
          [
            apResult.lancamentos[0].id,
            apResult.lancamentos[0].id,
            parcela.installmentId,
          ]
        );
      }
    }
  } catch (e: any) {
    console.error(`[COMP-01] Erro ao gerar AP para entrada ${entradaId}:`, e.message);
    throw e;
  }
}
