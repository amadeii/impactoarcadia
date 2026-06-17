/**
 * FISC-02 — FiscalValidator.ts
 * Engine de validação fiscal pré-transmissão NF-e.
 *
 * Regras: CfopRule, CstRule, ProdutoRule, IeRule, ValorRule
 */

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export interface FiscalItemInput {
  sequencia:      number;
  codigo:         string;
  descricao:      string;
  ncm:            string | null;
  cfop:           string | null;
  unidade:        string;
  quantidade:     number;
  valorUnitario:  number;
  valorTotal:     number;
  desconto?:      number;
  cstCsosn:       string | null;
  cstPis?:        string | null;
  cstCofins?:     string | null;
  origem:         number;
}

export interface FiscalDestinatarioInput {
  tipoPessoa:   'PF' | 'PJ';
  cnpjCpf:      string;
  nome:         string;
  ie?:          string | null;
  contribuinte: 'S' | 'N' | 'I';
  indIeDest:    1 | 2 | 9;
  uf:           string;
}

export interface FiscalEmitenteInput {
  cnpj:     string;
  uf:       string;
  crt:      1 | 2 | 3 | 4;
  // 1=Simples Nacional | 2=Simples Excesso | 3=Regime Normal | 4=MEI
  ambiente: 'homologacao' | 'producao';
}

export interface FiscalNfeInput {
  tipoDocumento:    0 | 1;   // 0=Entrada | 1=Saída
  naturezaOperacao: string;
  itens:            FiscalItemInput[];
  destinatario:     FiscalDestinatarioInput;
  valorTotal:       number;
  valorDesconto?:   number;
}

// ─── Resultado ────────────────────────────────────────────────────────────────

export type FiscalTipoMensagem = 'erro' | 'alerta' | 'info';
export type FiscalRisco = 'alto' | 'medio' | 'baixo';

export interface FiscalMensagem {
  tipo:     FiscalTipoMensagem;
  campo:    string;
  mensagem: string;
  sugestao: string | null;
  item?:    number | null;
}

export class FiscalResult {
  private mensagens: FiscalMensagem[] = [];

  add(
    tipo:     FiscalTipoMensagem,
    campo:    string,
    mensagem: string,
    sugestao: string | null = null,
    item:     number | null = null
  ): void {
    this.mensagens.push({ tipo, campo, mensagem, sugestao, item });
  }

  get temErro():   boolean { return this.mensagens.some(m => m.tipo === 'erro'); }
  get temAlerta(): boolean { return this.mensagens.some(m => m.tipo === 'alerta'); }

  get risco(): FiscalRisco {
    if (this.temErro)   return 'alto';
    if (this.temAlerta) return 'medio';
    return 'baixo';
  }

  get erros():   FiscalMensagem[] { return this.mensagens.filter(m => m.tipo === 'erro'); }
  get alertas(): FiscalMensagem[] { return this.mensagens.filter(m => m.tipo === 'alerta'); }
  get podeEmitir(): boolean { return !this.temErro; }

  toObject() {
    return {
      status:     this.temErro ? 'erro' : (this.temAlerta ? 'alerta' : 'ok'),
      risco:      this.risco,
      podeEmitir: this.podeEmitir,
      mensagens:  this.mensagens,
      resumo:     { erros: this.erros.length, alertas: this.alertas.length },
    };
  }
}

// ─── Interface de regra ───────────────────────────────────────────────────────

export interface FiscalRule {
  validate(nfe: FiscalNfeInput, emitente: FiscalEmitenteInput, result: FiscalResult): void;
}

// ─── Regra 1: CfopRule ────────────────────────────────────────────────────────

export class CfopRule implements FiscalRule {
  validate(nfe: FiscalNfeInput, emitente: FiscalEmitenteInput, result: FiscalResult): void {
    const isInterestadual = nfe.destinatario.uf !== emitente.uf;
    const isSaida  = nfe.tipoDocumento === 1;
    const isEntrada = nfe.tipoDocumento === 0;

    for (const item of nfe.itens) {
      const cfop = item.cfop?.replace(/\D/g, '') ?? '';
      const seq  = item.sequencia;

      if (!cfop || cfop.length < 4) {
        result.add('erro', `cfop_item_${seq}`,
          `Item ${seq} sem CFOP informado ou incompleto.`,
          'Informe o CFOP de 4 dígitos.', seq);
        continue;
      }

      const d = cfop[0];

      if (isSaida) {
        if (!isInterestadual && d === '6') {
          result.add('alerta', `cfop_item_${seq}`,
            `Item ${seq}: CFOP interestadual (${cfop}) usado em operação interna.`,
            'Utilize CFOP iniciado em 5 para operações dentro do estado.', seq);
        }
        if (isInterestadual && d === '5') {
          result.add('erro', `cfop_item_${seq}`,
            `Item ${seq}: CFOP interno (${cfop}) usado em operação interestadual.`,
            'Utilize CFOP iniciado em 6 para operações interestaduais.', seq);
        }
        if (d === '1' || d === '2') {
          result.add('erro', `cfop_item_${seq}`,
            `Item ${seq}: CFOP de entrada (${cfop}) em NF-e de saída.`,
            'CFOPs de saída começam com 5 (estadual) ou 6 (interestadual).', seq);
        }
      }

      if (isEntrada) {
        if (!isInterestadual && d === '2') {
          result.add('alerta', `cfop_item_${seq}`,
            `Item ${seq}: CFOP interestadual (${cfop}) em entrada estadual.`,
            'Utilize CFOP iniciado em 1 para entradas do mesmo estado.', seq);
        }
        if (d === '5' || d === '6') {
          result.add('erro', `cfop_item_${seq}`,
            `Item ${seq}: CFOP de saída (${cfop}) em NF-e de entrada.`,
            'CFOPs de entrada começam com 1 (estadual) ou 2 (interestadual).', seq);
        }
      }
    }
  }
}

// ─── Regra 2: CstRule ─────────────────────────────────────────────────────────

export class CstRule implements FiscalRule {
  private isSimples(crt: number): boolean {
    return crt === 1 || crt === 2 || crt === 4;
  }

  validate(nfe: FiscalNfeInput, emitente: FiscalEmitenteInput, result: FiscalResult): void {
    for (const item of nfe.itens) {
      const cst = item.cstCsosn ?? '';
      const seq = item.sequencia;

      if (!cst) {
        result.add('erro', `cst_item_${seq}`,
          `Item ${seq} sem CST/CSOSN informado.`,
          'Preencha o CST (Regime Normal) ou CSOSN (Simples Nacional).', seq);
        continue;
      }

      if (this.isSimples(emitente.crt)) {
        if (cst === '00') {
          result.add('erro', 'cst',
            `Empresa do Simples Nacional não pode usar CST 00 — Item ${seq}.`,
            'Utilize CSOSN 102 (sem ST) ou CSOSN 500 (ST já retido).', seq);
        }
        if (cst.length === 2 && !['40', '41', '50', '60'].includes(cst)) {
          result.add('alerta', `cst_item_${seq}`,
            `Item ${seq}: CST de 2 dígitos (${cst}) pode indicar configuração errada para Simples Nacional.`,
            'Verifique se o grupo tributário está configurado para Simples Nacional.', seq);
        }
      }

      if (emitente.crt === 3) {
        if (cst.length === 3 && cst.startsWith('1')) {
          result.add('erro', 'cst',
            `Empresa do Regime Normal não pode usar CSOSN ${cst} — Item ${seq}.`,
            'Utilize CST de 2 dígitos (00, 10, 20, 40, 41, 60...).', seq);
        }
      }
    }
  }
}

// ─── Regra 3: ProdutoRule ─────────────────────────────────────────────────────

export class ProdutoRule implements FiscalRule {
  validate(_nfe: FiscalNfeInput, _emitente: FiscalEmitenteInput, result: FiscalResult): void {
    for (const item of _nfe.itens) {
      const seq = item.sequencia;

      if (!item.ncm || item.ncm.trim() === '') {
        result.add('erro', `ncm_item_${seq}`,
          `Item ${seq}: NCM não informado.`,
          'Cadastre o NCM de 8 dígitos no produto antes de emitir.', seq);
        continue;
      }

      const ncm = item.ncm.replace(/\D/g, '');
      if (ncm.length !== 8) {
        result.add('erro', `ncm_item_${seq}`,
          `Item ${seq}: NCM inválido (${item.ncm}) — deve ter 8 dígitos.`,
          'Corrija o NCM no cadastro do produto.', seq);
      }

      if (!item.descricao || item.descricao.trim().length < 5) {
        result.add('erro', `descricao_item_${seq}`,
          `Item ${seq}: Descrição ausente ou muito curta.`,
          'A descrição do produto deve ter pelo menos 5 caracteres.', seq);
      }

      if (item.quantidade <= 0) {
        result.add('erro', `quantidade_item_${seq}`,
          `Item ${seq}: Quantidade deve ser maior que zero.`, null, seq);
      }
      if (item.valorUnitario <= 0) {
        result.add('erro', `valor_item_${seq}`,
          `Item ${seq}: Valor unitário deve ser maior que zero.`, null, seq);
      }
    }
  }
}

// ─── Regra 4: IeRule (bloqueador rejeição 561/562) ────────────────────────────

export class IeRule implements FiscalRule {
  validate(nfe: FiscalNfeInput, _emitente: FiscalEmitenteInput, result: FiscalResult): void {
    const dest = nfe.destinatario;

    const cnpjCpf = dest.cnpjCpf.replace(/\D/g, '');
    if (!cnpjCpf || (cnpjCpf.length !== 11 && cnpjCpf.length !== 14)) {
      result.add('erro', 'cpf_cnpj_destinatario',
        `CNPJ/CPF do destinatário ausente ou inválido (${dest.cnpjCpf || 'vazio'}).`,
        'Preencha o documento fiscal do cliente na tela de Pessoas.');
    }

    if (dest.contribuinte === 'S' && (!dest.ie || dest.ie.trim() === '')) {
      result.add('erro', 'ie_destinatario',
        `Destinatário marcado como contribuinte ICMS mas sem Inscrição Estadual.`,
        'Informe a IE do destinatário ou altere o campo Contribuinte para N (Não contribuinte).');
    }

    if (dest.contribuinte === 'S' && dest.ie && dest.indIeDest !== 1) {
      result.add('alerta', 'ind_ie_dest',
        `indIeDest (${dest.indIeDest}) inconsistente com contribuinte=S e IE preenchida.`,
        'O indicador da IE do destinatário deve ser 1 quando há IE informada.');
    }

    if (nfe.tipoDocumento === 1 && dest.tipoPessoa === 'PJ' && !dest.uf) {
      result.add('erro', 'uf_destinatario',
        'UF do destinatário não informada — necessária para resolver CFOP interestadual.',
        'Cadastre o endereço principal do cliente.');
    }
  }
}

// ─── Regra 5: ValorRule ───────────────────────────────────────────────────────

export class ValorRule implements FiscalRule {
  private readonly TOLERANCIA = 0.02;

  validate(nfe: FiscalNfeInput, _emitente: FiscalEmitenteInput, result: FiscalResult): void {
    if (nfe.itens.length === 0) {
      result.add('erro', 'itens', 'NF-e sem itens.', 'Adicione pelo menos um item.');
      return;
    }

    const somaItens = nfe.itens.reduce((acc, i) => acc + i.valorTotal - (i.desconto ?? 0), 0);
    const diff = Math.abs(somaItens - nfe.valorTotal);
    if (diff > this.TOLERANCIA) {
      result.add('erro', 'valor_total',
        `Total da NF-e (R$ ${nfe.valorTotal.toFixed(2)}) não confere com a soma dos itens (R$ ${somaItens.toFixed(2)}).`,
        `Diferença de R$ ${diff.toFixed(2)}. Verifique descontos e totais.`);
    }

    if (nfe.valorTotal <= 0) {
      result.add('erro', 'valor_total', 'Valor total da NF-e deve ser maior que zero.', null);
    }
  }
}

// ─── FiscalValidator principal ────────────────────────────────────────────────

export class FiscalValidator {
  private rules: FiscalRule[];

  constructor(customRules?: FiscalRule[]) {
    this.rules = customRules ?? [
      new CfopRule(),
      new CstRule(),
      new ProdutoRule(),
      new IeRule(),
      new ValorRule(),
    ];
  }

  validate(nfe: FiscalNfeInput, emitente: FiscalEmitenteInput): FiscalResult {
    const result = new FiscalResult();
    for (const rule of this.rules) {
      rule.validate(nfe, emitente, result);
    }
    return result;
  }

  validateToObject(nfe: FiscalNfeInput, emitente: FiscalEmitenteInput) {
    return this.validate(nfe, emitente).toObject();
  }
}

export const fiscalValidator = new FiscalValidator();
