import { pool } from "../../db/index";
import {
  cancelarNfeControlPlus,
  emitirNfeControlPlus,
  isControlPlusConfigured,
  verificarCertificadoControlPlus,
} from "../integrations/controlplusClient";
import { buscarEmitente, proximoNumeroFiscal } from "../cad/cadService";
import {
  FiscalValidator,
  FiscalResult,
  type FiscalNfeInput,
  type FiscalItemInput,
} from "./FiscalValidator";
import type { DestinatarioNfe } from "./schema_patch_pessoas";

export interface EmissaoNfeInput {
  tenantId: string;
  empresaId: number;
  userId: string;
  naturezaOperacao: string;
  tipoDocumento: 0 | 1;
  destinatario: DestinatarioNfe;
  destinatarioUf: string;
  itens: Array<{
    sequencia: number;
    codigo: string;
    descricao: string;
    ncm: string;
    cfop: string;
    unidade: string;
    quantidade: number;
    valorUnitario: number;
    desconto?: number;
    cstCsosn: string;
    cstPis?: string;
    cstCofins?: string;
    origem: number;
    percIcms?: number;
    baseCalcIcms?: number;
    valorIcms?: number;
    percPis?: number;
    percCofins?: number;
  }>;
  pagamentos?: Array<{ forma: string; valor: number }>;
  saleOrderId?: string;
  purchaseInvoiceId?: string;
}

export interface EmissaoNfeResult {
  ok: boolean;
  simulado?: boolean;
  documentoId?: string;
  chave?: string;
  protocolo?: string;
  xml?: string;
  pdf?: string;
  numero?: number;
  serie?: number;
  validacao?: ReturnType<FiscalResult["toObject"]>;
  error?: string;
}

export class FiscalAdapterV2 {
  private validator: FiscalValidator;

  constructor() {
    this.validator = new FiscalValidator();
  }

  async emitirNFe(input: EmissaoNfeInput): Promise<EmissaoNfeResult> {
    const emitenteResult = await buscarEmitente(input.tenantId, input.empresaId);
    if (!emitenteResult.ok) {
      return { ok: false, error: emitenteResult.error };
    }
    const emitente = emitenteResult.data;
    const emitenteUf = (emitente as any).uf ?? "SP";

    if (emitente.ambiente === "producao" && !emitente.plusCertificadoRef) {
      return {
        ok: false,
        error: "Certificado digital nao configurado. Acesse CAD > Fiscal > Emitentes para configurar.",
      };
    }

    const validacaoInput = this.montarFiscalNfeInput(input, emitenteUf, emitente.crt);
    const validacaoResult = this.validator.validate(validacaoInput, {
      cnpj: emitente.cnpj,
      uf: emitenteUf,
      crt: emitente.crt as 1 | 2 | 3 | 4,
      ambiente: emitente.ambiente,
    });

    if (!validacaoResult.podeEmitir) {
      return {
        ok: false,
        validacao: validacaoResult.toObject(),
        error: `Validacao fiscal falhou: ${validacaoResult.erros[0]?.mensagem}`,
      };
    }

    const numResult = await proximoNumeroFiscal(input.tenantId, input.empresaId, "nfe");
    if (!numResult.ok) {
      return { ok: false, error: numResult.error };
    }
    const { numero, serie } = numResult.data;

    const documentoId = await this.criarDocumentoFiscal({
      tenantId: input.tenantId,
      empresaId: input.empresaId,
      userId: input.userId,
      tipo: "nfe",
      numero,
      serie,
      emitenteCnpj: emitente.cnpj,
      destinatarioCnpjCpf: input.destinatario.cpf_cnpj,
      valorTotal: input.itens.reduce((s, i) => s + i.valorUnitario * i.quantidade - (i.desconto ?? 0), 0),
      saleOrderId: input.saleOrderId,
      ambiente: emitente.ambiente,
    });

    if (!isControlPlusConfigured()) {
      await this.atualizarStatusDocumento(documentoId, "simulado", `SIMUL-${numero}`);
      return {
        ok: true,
        simulado: true,
        documentoId,
        numero,
        serie,
        validacao: validacaoResult.toObject(),
        chave: `SIMUL-${Date.now()}`,
      };
    }

    const payload = this.montarPayloadControlPlus(input, emitente, numero, serie);
    try {
      await this.atualizarStatusDocumento(documentoId, "transmitindo");

      const result = await emitirNfeControlPlus(payload, input.empresaId);
      if (result.ok === false) {
        await this.atualizarStatusDocumento(documentoId, "rejeitado", undefined, undefined, undefined, result.message);
        return { ok: false, documentoId, error: result.message, validacao: validacaoResult.toObject() };
      }

      const data = this.unwrapControlPlusData(result.data);
      const chave = data?.chave ?? data?.access_key;
      const protocolo = data?.protocolo ?? data?.protocol;

      await this.atualizarStatusDocumento(documentoId, "autorizado", chave, protocolo, data?.xml);
      return {
        ok: true,
        documentoId,
        chave,
        protocolo,
        xml: data?.xml,
        pdf: data?.pdf,
        numero,
        serie,
        validacao: validacaoResult.toObject(),
      };
    } catch (err: any) {
      await this.atualizarStatusDocumento(documentoId, "rejeitado", undefined, undefined, undefined, err.message);
      return { ok: false, documentoId, error: `Erro de conexao com ControlPlus: ${err.message}` };
    }
  }

  async cancelarNFe(
    tenantId: string,
    empresaId: number,
    chave: string,
    justificativa: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (justificativa.length < 15) {
      return { ok: false, error: "Justificativa deve ter ao menos 15 caracteres." };
    }

    const result = await cancelarNfeControlPlus({ chave, justificativa }, empresaId);
    if (result.ok === false) {
      return { ok: false, error: result.message ?? "Erro ao cancelar." };
    }

    await pool.query(
      "UPDATE fiscal_documentos SET status = 'cancelado', updated_at = NOW() WHERE chave_acesso = $1 AND tenant_id = $2",
      [chave, tenantId],
    );
    return { ok: true };
  }

  async verificarCertificado(empresaId: number): Promise<{
    valido: boolean;
    validoAte?: string;
    cnpj?: string;
    diasRestantes?: number;
    error?: string;
  }> {
    try {
      const result = await verificarCertificadoControlPlus(empresaId);
      if (result.ok === false) {
        return { valido: false, error: result.message };
      }

      const data = this.unwrapControlPlusData(result.data);
      if (data.valido || data.valid) {
        const validoAte = data.valido_ate ?? data.valid_until;
        const dias = validoAte ? Math.floor((new Date(validoAte).getTime() - Date.now()) / 86_400_000) : undefined;
        return { valido: true, validoAte, cnpj: data.cnpj, diasRestantes: dias };
      }

      return { valido: false, error: data.message ?? "Certificado invalido." };
    } catch (err: any) {
      return { valido: false, error: `Erro de conexao: ${err.message}` };
    }
  }

  private montarFiscalNfeInput(input: EmissaoNfeInput, ufEmitente: string, _crt: number): FiscalNfeInput {
    return {
      tipoDocumento: input.tipoDocumento,
      naturezaOperacao: input.naturezaOperacao,
      valorTotal: input.itens.reduce((s, i) => s + i.valorUnitario * i.quantidade - (i.desconto ?? 0), 0),
      destinatario: {
        tipoPessoa: input.destinatario.cpf_cnpj.replace(/\D/g, "").length === 11 ? "PF" : "PJ",
        cnpjCpf: input.destinatario.cpf_cnpj,
        nome: input.destinatario.nome,
        ie: input.destinatario.ie,
        contribuinte: input.destinatario.ind_ie_dest === 1 ? "S" : input.destinatario.ind_ie_dest === 2 ? "I" : "N",
        indIeDest: input.destinatario.ind_ie_dest,
        uf: input.destinatarioUf,
      },
      itens: input.itens.map(i => ({
        sequencia: i.sequencia,
        codigo: i.codigo,
        descricao: i.descricao,
        ncm: i.ncm,
        cfop: i.cfop,
        unidade: i.unidade,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
        valorTotal: i.valorUnitario * i.quantidade - (i.desconto ?? 0),
        desconto: i.desconto,
        cstCsosn: i.cstCsosn,
        cstPis: i.cstPis,
        cstCofins: i.cstCofins,
        origem: i.origem,
      } as FiscalItemInput)),
    };
  }

  private montarPayloadControlPlus(input: EmissaoNfeInput, emitente: any, numero: number, serie: number): Record<string, any> {
    return {
      empresa_id: input.empresaId,
      ambiente: emitente.ambiente,
      numero,
      serie,
      natureza_operacao: input.naturezaOperacao,
      tipo_documento: input.tipoDocumento,
      destinatario: input.destinatario,
      itens: input.itens.map(i => ({
        codigo: i.codigo,
        descricao: i.descricao,
        ncm: i.ncm.replace(/\D/g, ""),
        cfop: i.cfop.replace(/\D/g, ""),
        unidade: i.unidade,
        quantidade: i.quantidade,
        valor_unitario: i.valorUnitario,
        desconto: i.desconto ?? 0,
        cst_csosn: i.cstCsosn,
        cst_pis: i.cstPis ?? "07",
        cst_cofins: i.cstCofins ?? "07",
        origem: i.origem,
        perc_icms: i.percIcms ?? 0,
        base_calc_icms: i.baseCalcIcms ?? (i.valorUnitario * i.quantidade),
        valor_icms: i.valorIcms ?? 0,
        perc_pis: i.percPis ?? 0,
        perc_cofins: i.percCofins ?? 0,
      })),
      pagamentos: input.pagamentos ?? [
        { forma: "17", valor: input.itens.reduce((s, i) => s + i.valorUnitario * i.quantidade, 0) },
      ],
    };
  }

  private unwrapControlPlusData(data: any): any {
    if (data && typeof data === "object" && data.data && typeof data.data === "object") {
      return data.data;
    }
    return data ?? {};
  }

  private async criarDocumentoFiscal(params: {
    tenantId: string;
    empresaId: number;
    userId: string;
    tipo: string;
    numero: number;
    serie: number;
    emitenteCnpj: string;
    destinatarioCnpjCpf: string;
    valorTotal: number;
    saleOrderId?: string;
    ambiente: string;
  }): Promise<string> {
    const { rows } = await pool.query(
      `INSERT INTO fiscal_documentos (
         tenant_id, empresa_id, tipo, numero, serie,
         emitente_cnpj, destinatario_cnpj_cpf, valor_total,
         status, ambiente, sale_order_id,
         created_by_id, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'montado',$9,$10,$11,NOW(),NOW())
       RETURNING id`,
      [
        params.tenantId,
        params.empresaId,
        params.tipo,
        params.numero,
        params.serie,
        params.emitenteCnpj,
        params.destinatarioCnpjCpf,
        params.valorTotal,
        params.ambiente,
        params.saleOrderId ?? null,
        params.userId,
      ],
    );
    return rows[0].id;
  }

  private async atualizarStatusDocumento(
    id: string,
    status: string,
    chave?: string,
    protocolo?: string,
    xml?: string,
    erro?: string,
  ): Promise<void> {
    await pool.query(
      `UPDATE fiscal_documentos
       SET status         = $2,
           chave_acesso   = COALESCE($3, chave_acesso),
           protocolo      = COALESCE($4, protocolo),
           xml_autorizado = COALESCE($5, xml_autorizado),
           ultimo_erro    = $6,
           updated_at     = NOW()
       WHERE id = $1`,
      [id, status, chave ?? null, protocolo ?? null, xml ?? null, erro ?? null],
    );
  }
}

export const fiscalAdapterV2 = new FiscalAdapterV2();
