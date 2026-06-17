/**
 * INT-01 — fiscalIntegration.ts
 * Handlers que fecham o ciclo fiscal do SOE.
 *
 * handleInvoiceRequested:
 *   Evento: sale_order.invoice_requested
 *   Ação:   monta payload completo, chama FiscalAdapterV2.emitirNFe()
 *           → em caso de sucesso: publica fiscal_doc.authorized
 *           → em caso de falha: registra erro + faz retry via soe_events
 *
 * handleFiscalDocAuthorized:
 *   Evento: fiscal_doc.authorized
 *   Ação:   chama marcarFaturado() no COM-01, fechando o ciclo completo
 */

import { pool } from "../../db/index";
import { fiscalAdapterV2 } from "../fisc/FiscalAdapterV2";
import { montarDestinatarioNfe } from "../fisc/schema_patch_pessoas";
import { marcarFaturado } from "../com/comService";
import { publishEventStandalone } from "../soe/eventBus";
import type { SoeContext } from "../soe/conventions";

// ── handleInvoiceRequested ────────────────────────────────────────────────────

export async function handleInvoiceRequested(event: any): Promise<void> {
  const { orderId, numero, requestedBy } = event.payload;
  const tenantId = event.tenantId;

  const { rows: [order] } = await pool.query(
    `SELECT so.*,
            p.nome_fantasia, p.razao_social, p.cnpj_cpf, p.tipo_pessoa,
            p.ie, p.contribuinte, p.consumidor_final, p.rg_ie,
            e.logradouro, e.numero AS end_numero, e.complemento,
            e.bairro, e.cidade, e.codigo_municipio, e.uf, e.cep,
            c_email.valor AS email_principal,
            c_tel.valor   AS telefone_principal,
            fn.natureza_operacao AS nat_operacao
     FROM sale_orders so
     LEFT JOIN pessoas p ON p.id = so.pessoa_id
     LEFT JOIN enderecos e ON e.pessoa_id = p.id AND e.tipo = 'principal'
     LEFT JOIN contatos c_email ON c_email.pessoa_id = p.id
       AND c_email.tipo = 'email' AND c_email.is_principal = 1
     LEFT JOIN contatos c_tel ON c_tel.pessoa_id = p.id
       AND c_tel.tipo IN ('telefone','celular') AND c_tel.is_principal = 1
     LEFT JOIN fiscal_natureza_operacao fn ON fn.id = so.natureza_operacao_id
     WHERE so.id = $1 AND so.tenant_id = $2`,
    [orderId, tenantId]
  );
  if (!order) {
    console.error(`[INT-01/FISC] Pedido ${orderId} não encontrado para emissão NF-e.`);
    return;
  }

  const { rows: itens } = await pool.query(
    `SELECT soi.*,
            COALESCE(fgt.cfop_estadual, fgt.cfop_outro_estado) AS cfop_grupo,
            fgt.cst_csosn, fgt.cst_pis_saida AS cst_pis, fgt.cst_cofins_saida AS cst_cofins,
            fgt.perc_icms, fgt.perc_pis, fgt.perc_cofins
     FROM sale_order_items soi
     LEFT JOIN produto_fiscal pf ON pf.id = soi.produto_fiscal_id
     LEFT JOIN fiscal_grupos_tributacao fgt ON fgt.id = pf.grupo_tributacao_id
     WHERE soi.sale_order_id = $1
     ORDER BY soi.sequencia`,
    [orderId]
  );

  if (!itens.length) {
    console.error(`[INT-01/FISC] Pedido ${orderId} sem itens — emissão cancelada.`);
    return;
  }

  const destinatario = montarDestinatarioNfe({
    tipoPessoa:      order.tipo_pessoa,
    nomeFantasia:    order.nome_fantasia,
    razaoSocial:     order.razao_social,
    cnpjCpf:         order.cnpj_cpf,
    ie:              order.ie,
    rgIe:            order.rg_ie,
    contribuinte:    order.contribuinte,
    consumidorFinal: order.consumidor_final,
    email:           order.email_principal,
    telefone:        order.telefone_principal,
    enderecoPrincipal: order.logradouro ? {
      logradouro:      order.logradouro,
      numero:          order.end_numero,
      complemento:     order.complemento,
      bairro:          order.bairro,
      cidade:          order.cidade,
      codigoMunicipio: order.codigo_municipio,
      uf:              order.uf,
      cep:             order.cep,
    } : null,
  });

  const destinatarioUf = order.uf ?? 'SP';

  const emissaoResult = await fiscalAdapterV2.emitirNFe({
    tenantId,
    empresaId:        order.empresa_id,
    userId:           requestedBy ?? 'system',
    naturezaOperacao: order.nat_operacao ?? 'Venda de mercadoria',
    tipoDocumento:    1,
    destinatario,
    destinatarioUf,
    itens: itens.map(i => ({
      sequencia:     i.sequencia,
      codigo:        i.produto_fiscal_id ?? String(i.product_id ?? i.sequencia),
      descricao:     i.descricao_snapshot,
      ncm:           i.ncm_snapshot ?? '',
      cfop:          i.cfop_snapshot ?? i.cfop_grupo ?? '5102',
      unidade:       i.unidade,
      quantidade:    parseFloat(i.quantidade),
      valorUnitario: parseFloat(i.preco_unitario),
      desconto:      parseFloat(i.desconto_item ?? '0'),
      cstCsosn:      i.cst_csosn_snapshot ?? i.cst_csosn ?? '',
      cstPis:        i.cst_pis_snapshot ?? i.cst_pis ?? '07',
      cstCofins:     i.cst_cofins_snapshot ?? i.cst_cofins ?? '07',
      origem:        0,
      percIcms:      parseFloat(i.perc_icms ?? '0'),
      baseCalcIcms:  parseFloat(i.base_calc_icms ?? i.total_item),
      valorIcms:     parseFloat(i.valor_icms ?? '0'),
      percPis:       parseFloat(i.perc_pis ?? '0'),
      percCofins:    parseFloat(i.perc_cofins ?? '0'),
    })),
    saleOrderId: orderId,
  });

  if (emissaoResult.ok) {
    await publishEventStandalone({
      tenantId,
      eventType:     'fiscal_doc.authorized',
      aggregateType: 'fiscal_documento',
      aggregateId:   emissaoResult.documentoId ?? orderId,
      payload: {
        documentoId: emissaoResult.documentoId,
        saleOrderId: orderId,
        chave:       emissaoResult.chave,
        protocolo:   emissaoResult.protocolo,
        numero:      emissaoResult.numero,
        serie:       emissaoResult.serie,
        simulado:    emissaoResult.simulado ?? false,
      },
      createdById: requestedBy ?? 'system',
    });
  } else {
    console.error(
      `[INT-01/FISC] Emissão NF-e falhou para pedido ${orderId}:`,
      emissaoResult.error
    );
    await pool.query(
      `UPDATE sale_orders
       SET observacao_interna = CONCAT(COALESCE(observacao_interna,''), $3),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [orderId, tenantId, `\n[NF-e ${new Date().toISOString()}] Falha na emissão: ${emissaoResult.error}`]
    );
    throw new Error(`Emissão NF-e falhou: ${emissaoResult.error}`);
  }
}

// ── handleFiscalDocAuthorized ─────────────────────────────────────────────────

export async function handleFiscalDocAuthorized(event: any): Promise<void> {
  const { documentoId, saleOrderId } = event.payload;
  const tenantId = event.tenantId;

  if (!saleOrderId) return;

  const ctx: SoeContext = {
    tenantId,
    userId: event.createdById ?? 'system',
  };

  const result = await marcarFaturado(ctx, saleOrderId, documentoId, new Date());
  if (!result.ok) {
    console.error(
      `[INT-01/FISC] Falha ao marcar pedido ${saleOrderId} como faturado:`,
      result.error
    );
  }
}
