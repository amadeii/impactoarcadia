/**
 * COMP-01 — nfeParser.ts
 * Parser de XML NF-e (modelo 55) para o módulo de Compras.
 */

export interface NfeParseResult {
  cabeçalho: NfeCabecalhoParsed;
  itens:     NfeItemParsed[];
  duplicatas: NfeDuplicataParsed[];
  erros:     string[];
}

export interface NfeCabecalhoParsed {
  chaveNfe:          string;
  numeroNfe:         number;
  serieNfe:          string;
  modelo:            string;
  dataEmissao:       string;
  dataSaidaEntrada?: string;

  emitenteCnpj:  string;
  emitenteNome:  string;
  emitenteUf:    string;
  emitenteIe?:   string;

  destinatarioCnpjCpf: string;
  destinatarioNome:    string;

  valorProdutos:  number;
  valorFrete:     number;
  valorSeguro:    number;
  valorDesconto:  number;
  valorOutros:    number;
  valorIpi:       number;
  valorIcmsSt:    number;
  valorTotal:     number;

  naturezaOperacao: string;
}

export interface NfeItemParsed {
  sequencia:          number;
  codigoProdutoXml:   string;
  descricaoXml:       string;
  ncm:                string;
  cest?:              string;
  cfop:               string;
  unidade:            string;
  quantidade:         number;
  valorUnitario:      number;
  valorDesconto:      number;
  valorFrete:         number;
  valorOutros:        number;
  subTotal:           number;

  origem:             number;
  cstCsosn:           string;
  modalidadeBcIcms?:  string;
  percRedBc:          number;
  baseCalcIcms:       number;
  percIcms:           number;
  valorIcms:          number;

  baseCalcIcmsSt:     number;
  percMvaSt:          number;
  percIcmsSt:         number;
  valorIcmsSt:        number;

  cstPis?:            string;
  baseCalcPis:        number;
  percPis:            number;
  valorPis:           number;
  cstCofins?:         string;
  baseCalcCofins:     number;
  percCofins:         number;
  valorCofins:        number;

  cstIpi?:            string;
  cEnq?:              string;
  baseCalcIpi:        number;
  percIpi:            number;
  valorIpi:           number;

  lote?:              string;
  dataValidadeLote?:  string;

  infAdProd?:         string;
}

export interface NfeDuplicataParsed {
  numeroDuplicata: string;
  vencimento:      string;
  valor:           number;
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseNfeXml(xmlContent: string): NfeParseResult {
  const erros: string[] = [];

  try {
    const chaveMatch = xmlContent.match(/chNFe[>= ]["']?(\d{44})/);
    if (!chaveMatch) {
      return { cabeçalho: {} as any, itens: [], duplicatas: [], erros: ['chave de acesso não encontrada no XML'] };
    }

    const cabecalho = parseCabecalho(xmlContent, erros);
    const itens = parseItens(xmlContent, erros);
    const duplicatas = parseDuplicatas(xmlContent);

    return { cabeçalho: cabecalho, itens, duplicatas, erros };
  } catch (e: any) {
    return {
      cabeçalho: {} as any,
      itens: [],
      duplicatas: [],
      erros: [`Erro ao processar XML: ${e.message}`]
    };
  }
}

function parseCabecalho(xml: string, erros: string[]): NfeCabecalhoParsed {
  const g = (tag: string, fallback = ''): string => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
    return m ? m[1].trim() : fallback;
  };
  const gn = (tag: string): number => parseFloat(g(tag, '0')) || 0;

  const chaveMatch = xml.match(/Id="NFe(\d{44})"/);
  const chaveNfe = chaveMatch ? chaveMatch[1] : g('chNFe');

  if (!chaveNfe || chaveNfe.length !== 44) {
    erros.push('Chave de acesso inválida ou não encontrada.');
  }

  return {
    chaveNfe,
    numeroNfe:         parseInt(g('nNF', '0')),
    serieNfe:          g('serie'),
    modelo:            g('mod', '55'),
    dataEmissao:       g('dhEmi').split('T')[0] || g('dEmi'),
    dataSaidaEntrada:  (g('dhSaiEnt') || g('dSaiEnt') || '').split('T')[0] || undefined,

    emitenteCnpj:  g('emit > CNPJ') || extractTagInSection(xml, 'emit', 'CNPJ'),
    emitenteNome:  g('xNome') || extractTagInSection(xml, 'emit', 'xNome'),
    emitenteUf:    extractTagInSection(xml, 'emit', 'UF') || extractTagInSection(xml, 'enderEmit', 'UF'),
    emitenteIe:    extractTagInSection(xml, 'emit', 'IE') || undefined,

    destinatarioCnpjCpf: extractTagInSection(xml, 'dest', 'CNPJ') || extractTagInSection(xml, 'dest', 'CPF'),
    destinatarioNome:    extractTagInSection(xml, 'dest', 'xNome'),

    valorProdutos: gn('vProd'),
    valorFrete:    gn('vFrete'),
    valorSeguro:   gn('vSeg'),
    valorDesconto: gn('vDesc'),
    valorOutros:   gn('vOutro'),
    valorIpi:      gn('vIPI'),
    valorIcmsSt:   gn('vST'),
    valorTotal:    gn('vNF'),

    naturezaOperacao: g('natOp'),
  };
}

function parseItens(xml: string, erros: string[]): NfeItemParsed[] {
  const itens: NfeItemParsed[] = [];

  const detRegex = /<det\s[^>]*nItem="(\d+)"[^>]*>([\s\S]*?)<\/det>/g;
  let match: RegExpExecArray | null;

  while ((match = detRegex.exec(xml)) !== null) {
    const sequencia = parseInt(match[1]);
    const det = match[2];

    const g = (tag: string, fallback = ''): string => {
      const m = det.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`));
      return m ? m[1].trim() : fallback;
    };
    const gn = (tag: string): number => parseFloat(g(tag, '0')) || 0;

    const loteMatch = det.match(/<rastro>[\s\S]*?<nLote>([^<]*)<\/nLote>[\s\S]*?<dVal>([^<]*)<\/dVal>/);

    itens.push({
      sequencia,
      codigoProdutoXml: g('cProd'),
      descricaoXml:     g('xProd'),
      ncm:              g('NCM').replace(/\D/g, ''),
      cest:             g('CEST').replace(/\D/g, '') || undefined,
      cfop:             g('CFOP'),
      unidade:          g('uCom') || g('uTrib'),
      quantidade:       parseFloat(g('qCom') || g('qTrib') || '0'),
      valorUnitario:    parseFloat(g('vUnCom') || g('vUnTrib') || '0'),
      valorDesconto:    gn('vDesc'),
      valorFrete:       gn('vFrete'),
      valorOutros:      gn('vOutro'),
      subTotal:         gn('vProd'),

      origem:          parseInt(g('orig', '0')),
      cstCsosn:        g('CST') || g('CSOSN'),
      modalidadeBcIcms: g('modBC') || undefined,
      percRedBc:       gn('pRedBC'),
      baseCalcIcms:    gn('vBC'),
      percIcms:        gn('pICMS'),
      valorIcms:       gn('vICMS'),

      baseCalcIcmsSt:  gn('vBCST'),
      percMvaSt:       gn('pMVAST'),
      percIcmsSt:      gn('pICMSST'),
      valorIcmsSt:     gn('vICMSST'),

      cstPis:          g('CST', '') || undefined,
      baseCalcPis:     gn('vBCPIS') || gn('vBC'),
      percPis:         gn('pPIS'),
      valorPis:        gn('vPIS'),
      cstCofins:       undefined,
      baseCalcCofins:  gn('vBCCOFINS') || gn('vBC'),
      percCofins:      gn('pCOFINS'),
      valorCofins:     gn('vCOFINS'),

      cstIpi:          g('cST') || undefined,
      cEnq:            g('cEnq') || undefined,
      baseCalcIpi:     gn('vBCIPI') || gn('vBC'),
      percIpi:         gn('pIPI'),
      valorIpi:        gn('vIPI'),

      lote:            loteMatch?.[1] || undefined,
      dataValidadeLote: loteMatch?.[2] || undefined,
      infAdProd:       g('infAdProd') || undefined,
    });
  }

  if (itens.length === 0) {
    erros.push('Nenhum item encontrado no XML. Verifique se é uma NF-e válida.');
  }

  return itens;
}

function parseDuplicatas(xml: string): NfeDuplicataParsed[] {
  const dups: NfeDuplicataParsed[] = [];
  const dupRegex = /<dup>([\s\S]*?)<\/dup>/g;
  let match: RegExpExecArray | null;

  while ((match = dupRegex.exec(xml)) !== null) {
    const dup = match[1];
    const g = (tag: string): string => {
      const m = dup.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`));
      return m ? m[1].trim() : '';
    };
    const nDup  = g('nDup') || '001';
    const dVenc = g('dVenc');
    const valor = parseFloat(g('vDup') || '0');

    if (dVenc && valor > 0) {
      dups.push({ numeroDuplicata: nDup, vencimento: dVenc, valor });
    }
  }

  return dups;
}

function extractTagInSection(xml: string, section: string, tag: string): string {
  const secMatch = xml.match(new RegExp(`<${section}[^>]*>([\\s\\S]*?)<\\/${section}>`));
  if (!secMatch) return '';
  const sec = secMatch[1];
  const tagMatch = sec.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  return tagMatch ? tagMatch[1].trim() : '';
}

// ─── Validação básica da chave de acesso NF-e ─────────────────────────────────

export function validarChaveNfe(chave: string): boolean {
  const c = chave.replace(/\D/g, '');
  if (c.length !== 44) return false;

  let sum = 0;
  let mult = 2;
  for (let i = 42; i >= 0; i--) {
    sum += parseInt(c[i]) * mult;
    mult = mult === 9 ? 2 : mult + 1;
  }
  const resto = sum % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === parseInt(c[43]);
}
