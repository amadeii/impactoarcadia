/**
 * FISC-01 — schema_patch_pessoas.ts
 * Funções de resolução de campos fiscais de pessoas para payload NF-e.
 */

export interface PessoaFiscalFields {
  rg:              string | null;
  ie:              string | null;
  contribuinte:    'S' | 'N' | 'I';
  consumidorFinal: 0 | 1;
  /** @deprecated usar rg (PF) ou ie (PJ) */
  rgIe:            string | null;
}

/**
 * Resolve campos fiscais de uma pessoa.
 * Compatível com registros antigos (só rgIe) e novos (rg/ie separados).
 */
export function resolverCamposFiscaisPessoa(pessoa: {
  tipoPessoa:       string;
  rgIe?:            string | null;
  rg?:              string | null;
  ie?:              string | null;
  contribuinte?:    string | null;
  consumidorFinal?: number | null;
}): PessoaFiscalFields {
  const rg = pessoa.rg ?? (pessoa.tipoPessoa === 'PF' ? (pessoa.rgIe ?? null) : null);
  const ie = pessoa.ie ?? (pessoa.tipoPessoa === 'PJ' ? (pessoa.rgIe ?? null) : null);

  return {
    rg,
    ie: ie ? ie.replace(/[^0-9A-Za-z]/g, '') : null,
    contribuinte:    (pessoa.contribuinte as 'S' | 'N' | 'I') ?? 'N',
    consumidorFinal: (pessoa.consumidorFinal as 0 | 1) ?? 1,
    rgIe:            pessoa.rgIe ?? null,
  };
}

export interface DestinatarioNfe {
  nome:             string;
  cpf_cnpj:         string;
  ie?:              string;
  ind_ie_dest:      1 | 2 | 9;
  consumidor_final: 0 | 1;
  email?:           string;
  telefone?:        string;
  endereco?: {
    logradouro:       string;
    numero:           string;
    complemento?:     string;
    bairro:           string;
    municipio:        string;
    codigo_municipio: string;
    uf:               string;
    cep:              string;
    pais?:            string;
    codigo_pais?:     string;
  };
}

/**
 * Monta o bloco <dest> do payload NF-e / NFS-e.
 */
export function montarDestinatarioNfe(pessoa: {
  tipoPessoa:        string;
  nomeFantasia:      string;
  razaoSocial?:      string | null;
  cnpjCpf:           string;
  rg?:               string | null;
  ie?:               string | null;
  rgIe?:             string | null;
  contribuinte?:     string | null;
  consumidorFinal?:  number | null;
  email?:            string | null;
  telefone?:         string | null;
  enderecoPrincipal?: {
    logradouro?:      string | null;
    numero?:          string | null;
    complemento?:     string | null;
    bairro?:          string | null;
    cidade?:          string | null;
    codigoMunicipio?: string | null;
    uf?:              string | null;
    cep?:             string | null;
    pais?:            string | null;
    codigoPais?:      string | null;
  } | null;
}): DestinatarioNfe {
  const fiscal = resolverCamposFiscaisPessoa(pessoa);

  let indIeDest: 1 | 2 | 9 = 9;
  if (pessoa.tipoPessoa === 'PJ') {
    if (fiscal.contribuinte === 'S' && fiscal.ie) indIeDest = 1;
    else if (fiscal.contribuinte === 'I') indIeDest = 2;
    else indIeDest = 9;
  }

  const dest: DestinatarioNfe = {
    nome:             pessoa.razaoSocial || pessoa.nomeFantasia,
    cpf_cnpj:         pessoa.cnpjCpf.replace(/\D/g, ''),
    ind_ie_dest:      indIeDest,
    consumidor_final: fiscal.consumidorFinal,
  };

  if (indIeDest === 1 && fiscal.ie) dest.ie = fiscal.ie;
  if (pessoa.email)    dest.email    = pessoa.email;
  if (pessoa.telefone) dest.telefone = pessoa.telefone.replace(/\D/g, '');

  const e = pessoa.enderecoPrincipal;
  if (e?.logradouro && e?.cidade && e?.uf) {
    dest.endereco = {
      logradouro:       e.logradouro,
      numero:           e.numero    ?? 'SN',
      complemento:      e.complemento ?? undefined,
      bairro:           e.bairro    ?? '',
      municipio:        e.cidade,
      codigo_municipio: e.codigoMunicipio ?? '',
      uf:               e.uf,
      cep:              (e.cep ?? '').replace(/\D/g, ''),
      pais:             e.pais      ?? 'Brasil',
      codigo_pais:      e.codigoPais ?? '1058',
    };
  }

  return dest;
}
