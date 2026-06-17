/**
 * pessoaImportService.ts — Importação em massa de pessoas (CRM 2.0)
 *
 * Aceita planilha XLSX/CSV no formato da exportação legada (sheet DATAEXPORT,
 * 39 colunas, '---' como nulo) e cria/atualiza registros em `pessoas` +
 * `enderecos` + `contatos` + `pessoa_papeis` em transação atômica por linha.
 *
 * Estratégia de merge: se já existe pessoa com mesmo `cnpj_cpf` no tenant,
 * apenas atualiza dados cadastrais e adiciona papéis novos (não duplica).
 */
import * as XLSX from "xlsx";
import { db } from "./db";
import { pessoas, enderecos, contatos, pessoaPapeis } from "@shared/schema";
import { and, eq } from "drizzle-orm";

export interface ImportError {
  linha: number;
  identificacao: string;
  erro: string;
}
export interface ImportResult {
  total: number;
  criados: number;
  atualizados: number;
  papeisAdicionados: number;
  erros: ImportError[];
  duracaoMs: number;
}

// ----- Helpers de normalização -----

const VAZIOS = new Set(["", "---", "--", "null", "undefined", "n/a", "n/d"]);

function isVazio(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return VAZIOS.has(v.trim().toLowerCase());
  return false;
}

function txt(v: unknown): string | null {
  if (isVazio(v)) return null;
  return String(v).trim();
}

function txtUpper(v: unknown, max = 2): string | null {
  const s = txt(v);
  return s ? s.toUpperCase().slice(0, max) : null;
}

/** Remove tudo que não for dígito. Retorna string vazia se entrada inválida. */
export function limparDocumento(v: unknown): string {
  if (isVazio(v)) return "";
  return String(v).replace(/\D/g, "");
}

/** Valida CPF (11 dígitos) ou CNPJ (14 dígitos). Não valida dígitos verificadores. */
export function isDocumentoValido(doc: string): boolean {
  if (doc.length !== 11 && doc.length !== 14) return false;
  // Rejeita sequências triviais (00000000000, 11111111111, etc)
  if (/^(\d)\1+$/.test(doc)) return false;
  return true;
}

/**
 * Converte data do Excel (número serial) ou string ISO para 'YYYY-MM-DD'.
 * Excel epoch = 1899-12-30 (com bug de 1900). Suporta ISO, BR (dd/mm/yyyy) e número.
 */
export function converterData(v: unknown): string | null {
  if (isVazio(v)) return null;
  // Excel serial number
  if (typeof v === "number" && Number.isFinite(v) && v > 1) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const s = v.trim();
    // ISO direto
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // BR dd/mm/yyyy
    m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return null;
}

/** Normaliza CEP em string com 8 dígitos (sem máscara). */
export function normalizarCep(v: unknown): string | null {
  if (isVazio(v)) return null;
  const d = String(v).replace(/\D/g, "");
  if (d.length === 0) return null;
  return d.padStart(8, "0").slice(0, 8);
}

/** Normaliza telefone para string apenas-dígitos (mantém DDD). */
export function normalizarTelefone(v: unknown): string | null {
  if (isVazio(v)) return null;
  const d = String(v).replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

function isSim(v: unknown): boolean {
  if (isVazio(v)) return false;
  return String(v).trim().toUpperCase() === "SIM";
}

function num(v: unknown): number | null {
  if (isVazio(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ----- Parser principal -----

export interface ParsedRow {
  linha: number;
  raw: Record<string, any>;
  tipoPessoa: "PF" | "PJ";
  nomeFantasia: string;
  razaoSocial: string | null;
  cnpjCpf: string;
  rgIe: string | null;     // @deprecated — mantido por compat
  rg:   string | null;     // PF
  ie:   string | null;     // PJ
  contribuinte: 'S' | 'N' | 'I';
  inscricaoMunicipal: string | null;
  dataNascimentoFundacao: string | null;
  observacoes: string | null;
  // Campos comerciais (cf. cabeçalhos da planilha DATAEXPORT)
  codigoExterno: string | null;
  pessoaGrupo: string | null;
  vendedorPadrao: string | null;
  categoria: string | null;
  tabelaPreco: string | null;
  limiteCredito: string | null;          // numeric → string p/ drizzle
  periodicidadeVendaCompra: number | null;
  valorMinimoCompra: string | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    codigoMunicipio: string | null;
    uf: string | null;
    codigoUf: string | null;
    cep: string | null;
    pais: string | null;
    codigoPais: string | null;
  } | null;
  contatos: Array<{ tipo: string; valor: string; isPrincipal: number }>;
  papeis: Array<{ tipoPapel: string; metadata: Record<string, any> }>;
}

export function parseRow(raw: Record<string, any>, linha: number): ParsedRow | { linha: number; erro: string } {
  const cnpjCpf = limparDocumento(raw["CNPJ_CPF"]);
  const nomeFantasia = txt(raw["NomeFantasia"]) ?? "";
  if (!nomeFantasia) {
    return { linha, erro: "NomeFantasia vazio" };
  }
  if (!isDocumentoValido(cnpjCpf)) {
    return { linha, erro: `CNPJ/CPF inválido: '${raw["CNPJ_CPF"]}'` };
  }
  const tipoPessoa: "PF" | "PJ" = isSim(raw["PessoaFisica"]) ? "PF" : "PJ";

  // Endereço (só cria se houver pelo menos 1 campo preenchido)
  const log = txt(raw["Logradouro"]);
  const cid = txt(raw["Cidade"]);
  const cep = normalizarCep(raw["CEP"]);
  let endereco: ParsedRow["endereco"] = null;
  if (log || cid || cep) {
    endereco = {
      logradouro: log,
      numero: txt(raw["LogradouroNumero"]),
      complemento: txt(raw["Complemento"]),
      bairro: txt(raw["Bairro"]),
      cidade: cid,
      codigoMunicipio: txt(raw["CodigoMunicipio"]),
      uf: txtUpper(raw["UF"], 2),
      codigoUf: txt(raw["CodigoUF"]),
      cep,
      pais: txt(raw["Pais"]) ?? "Brasil",
      codigoPais: txt(raw["CodigoPais"]),
    };
  }

  // Contatos
  const contatosOut: ParsedRow["contatos"] = [];
  const tel = normalizarTelefone(raw["Telefone"]);
  if (tel) contatosOut.push({ tipo: "telefone", valor: tel, isPrincipal: 0 });
  const wpp = normalizarTelefone(raw["Whatsapp"]);
  if (wpp) contatosOut.push({ tipo: "whatsapp", valor: wpp, isPrincipal: 0 });
  const cel = normalizarTelefone(raw["Celular"]);
  if (cel) contatosOut.push({ tipo: "celular", valor: cel, isPrincipal: 0 });
  const email = txt(raw["Email"]);
  if (email && /@/.test(email)) {
    contatosOut.push({ tipo: "email", valor: email.toLowerCase(), isPrincipal: 1 });
  }
  const site = txt(raw["Site"]);
  if (site) contatosOut.push({ tipo: "site", valor: site, isPrincipal: 0 });

  // Papéis
  const papeis: ParsedRow["papeis"] = [];
  if (isSim(raw["Cliente"])) {
    papeis.push({
      tipoPapel: "cliente",
      metadata: {
        limiteCredito: num(raw["Limite de Crédito"]) ?? 0,
        tabelaPreco: txt(raw["TabelaPreco"]),
        vendedorPadrao: txt(raw["VendedorPadrao"]),
        categoria: txt(raw["Categoria"]),
        frequenciaCompraDias: num(raw["Periodicidade Venda/Compra(dias)"]) ?? 0,
        valorMinimoPedido: num(raw["ValorMinimoCompra"]) ?? 0,
      },
    });
  }
  if (isSim(raw["Fornecedor"])) {
    papeis.push({ tipoPapel: "fornecedor", metadata: {} });
  }
  if (isSim(raw["Colaborador"])) {
    papeis.push({
      tipoPapel: "colaborador",
      metadata: { cargo: txt(raw["Observações"]) },
    });
  }
  if (isSim(raw["Transportadora"])) {
    papeis.push({ tipoPapel: "transportadora", metadata: {} });
  }

  // FISC-01: campos separados RG (PF) e IE (PJ)
  const rg = tipoPessoa === "PF" ? txt(raw["RG"]) : null;
  let ie: string | null = null;
  if (tipoPessoa === "PJ") {
    const rawIe = txt(raw["IE"]) ?? txt(raw["Inscrição Estadual"]) ?? txt(raw["InscricaoEstadual"]);
    if (rawIe) ie = rawIe.replace(/[^0-9A-Za-z]/g, '').toUpperCase() || null;
  }
  const rgIe = rg ?? ie; // campo legado
  let contribuinte: 'S' | 'N' | 'I' = 'N';
  if (tipoPessoa === 'PJ' && ie) {
    contribuinte = ie === 'ISENTO' ? 'I' : 'S';
  }

  // Inscrição municipal (aceita variações de cabeçalho)
  const inscricaoMunicipal =
    txt(raw["IM"]) ??
    txt(raw["InscricaoMunicipal"]) ??
    txt(raw["Inscrição Municipal"]) ??
    null;

  // Código externo (preferimos "Identificador"; "Código identificador único" como fallback)
  const codigoExterno =
    txt(raw["Identificador"]) ?? txt(raw["Código identificador único"]) ?? null;

  // Numeric → string (drizzle/pg numeric exige string p/ preservar precisão)
  const limiteCreditoNum = num(raw["Limite de Crédito"]);
  const valorMinimoCompraNum = num(raw["ValorMinimoCompra"]);

  return {
    linha,
    raw,
    tipoPessoa,
    nomeFantasia,
    razaoSocial: txt(raw["RazaoSocial"]),
    cnpjCpf,
    rgIe,
    rg,
    ie,
    contribuinte,
    inscricaoMunicipal,
    dataNascimentoFundacao: converterData(raw["DataNascimentoFundacao"]),
    observacoes: txt(raw["Observações"]),
    codigoExterno,
    pessoaGrupo: txt(raw["PessoaGrupo"]),
    vendedorPadrao: txt(raw["VendedorPadrao"]),
    categoria: txt(raw["Categoria"]),
    tabelaPreco: txt(raw["TabelaPreco"]),
    limiteCredito: limiteCreditoNum != null ? String(limiteCreditoNum) : null,
    periodicidadeVendaCompra: num(raw["Periodicidade Venda/Compra(dias)"]),
    valorMinimoCompra: valorMinimoCompraNum != null ? String(valorMinimoCompraNum) : null,
    endereco,
    contatos: contatosOut,
    papeis,
  };
}

export function parsePlanilha(buffer: Buffer): { rows: any[]; sheetName: string } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  // Prioriza aba 'DATAEXPORT' (formato do export legado), com fallback p/ primeira aba.
  const sheetName =
    wb.SheetNames.find((n) => n.toUpperCase() === "DATAEXPORT") ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  return { rows, sheetName };
}

// ----- Importação -----

export async function importarPessoas(
  tenantId: string,
  buffer: Buffer,
  createdById: string | null,
): Promise<ImportResult> {
  const inicio = Date.now();
  const { rows } = parsePlanilha(buffer);
  const result: ImportResult = {
    total: rows.length,
    criados: 0,
    atualizados: 0,
    papeisAdicionados: 0,
    erros: [],
    duracaoMs: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 2; // +1 cabeçalho, +1 humano
    const parsed = parseRow(rows[i], linha);
    if ("erro" in parsed) {
      result.erros.push({
        linha,
        identificacao: String(rows[i]?.["NomeFantasia"] ?? rows[i]?.["CNPJ_CPF"] ?? "?"),
        erro: parsed.erro,
      });
      continue;
    }

    try {
      await db.transaction(async (tx) => {
        // 1. Buscar duplicidade por (tenant, cnpj_cpf)
        const existente = await tx
          .select({ id: pessoas.id })
          .from(pessoas)
          .where(and(eq(pessoas.tenantId, tenantId), eq(pessoas.cnpjCpf, parsed.cnpjCpf)))
          .limit(1);

        let pessoaId: string;
        let isNova = false;

        if (existente.length > 0) {
          // Merge: atualiza dados cadastrais (inclui campos comerciais novos)
          pessoaId = existente[0].id;
          await tx
            .update(pessoas)
            .set({
              nomeFantasia: parsed.nomeFantasia,
              razaoSocial: parsed.razaoSocial,
              tipoPessoa: parsed.tipoPessoa,
              rgIe: parsed.rgIe,
              rg: parsed.rg,
              ie: parsed.ie,
              contribuinte: parsed.contribuinte,
              inscricaoMunicipal: parsed.inscricaoMunicipal,
              dataNascimentoFundacao: parsed.dataNascimentoFundacao,
              observacoes: parsed.observacoes,
              codigoExterno: parsed.codigoExterno,
              pessoaGrupo: parsed.pessoaGrupo,
              vendedorPadrao: parsed.vendedorPadrao,
              categoria: parsed.categoria,
              tabelaPreco: parsed.tabelaPreco,
              limiteCredito: parsed.limiteCredito,
              periodicidadeVendaCompra: parsed.periodicidadeVendaCompra,
              valorMinimoCompra: parsed.valorMinimoCompra,
              updatedAt: new Date(),
              updatedById: createdById ?? undefined,
            })
            .where(eq(pessoas.id, pessoaId));
        } else {
          // Cria nova pessoa (inclui campos comerciais novos)
          const [nova] = await tx
            .insert(pessoas)
            .values({
              tenantId,
              tipoPessoa: parsed.tipoPessoa,
              nomeFantasia: parsed.nomeFantasia,
              razaoSocial: parsed.razaoSocial,
              cnpjCpf: parsed.cnpjCpf,
              rgIe: parsed.rgIe,
              rg: parsed.rg,
              ie: parsed.ie,
              contribuinte: parsed.contribuinte,
              inscricaoMunicipal: parsed.inscricaoMunicipal,
              dataNascimentoFundacao: parsed.dataNascimentoFundacao,
              observacoes: parsed.observacoes,
              codigoExterno: parsed.codigoExterno,
              pessoaGrupo: parsed.pessoaGrupo,
              vendedorPadrao: parsed.vendedorPadrao,
              categoria: parsed.categoria,
              tabelaPreco: parsed.tabelaPreco,
              limiteCredito: parsed.limiteCredito,
              periodicidadeVendaCompra: parsed.periodicidadeVendaCompra,
              valorMinimoCompra: parsed.valorMinimoCompra,
              createdById: createdById ?? undefined,
            })
            .returning({ id: pessoas.id });
          pessoaId = nova.id;
          isNova = true;

          // Endereço (só na criação inicial — merge não duplica)
          if (parsed.endereco) {
            await tx.insert(enderecos).values({
              pessoaId,
              tipo: "principal",
              isPrincipal: 1,
              ...parsed.endereco,
            });
          }

          // Contatos (idem)
          if (parsed.contatos.length > 0) {
            await tx.insert(contatos).values(
              parsed.contatos.map((c) => ({
                pessoaId,
                tipo: c.tipo,
                valor: c.valor,
                isPrincipal: c.isPrincipal,
              })),
            );
          }
        }

        // 2. Papéis: adiciona apenas os que não existem (ativos) — idempotente.
        if (parsed.papeis.length > 0) {
          const papeisAtuais = await tx
            .select({ tipoPapel: pessoaPapeis.tipoPapel })
            .from(pessoaPapeis)
            .where(
              and(
                eq(pessoaPapeis.pessoaId, pessoaId),
                eq(pessoaPapeis.status, "ativo"),
              ),
            );
          const tiposExistentes = new Set(papeisAtuais.map((p) => p.tipoPapel));
          const novos = parsed.papeis.filter((p) => !tiposExistentes.has(p.tipoPapel));
          if (novos.length > 0) {
            await tx.insert(pessoaPapeis).values(
              novos.map((p) => ({
                pessoaId,
                tenantId,
                tipoPapel: p.tipoPapel,
                metadata: p.metadata,
              })),
            );
            result.papeisAdicionados += novos.length;
          }
        }

        if (isNova) result.criados++;
        else result.atualizados++;
      });
    } catch (err: any) {
      result.erros.push({
        linha,
        identificacao: parsed.nomeFantasia || parsed.cnpjCpf,
        erro: String(err?.message ?? err),
      });
    }
  }

  result.duracaoMs = Date.now() - inicio;
  return result;
}
