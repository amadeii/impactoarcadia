import type { IConnector, SyncResult } from "../connectorHub";

/**
 * BrasilAPI — endpoint público gratuito para consulta de CNPJ, CEP, bancos.
 * Não exige credencial. Usado em formulários para auto-preenchimento.
 *
 * Docs: https://brasilapi.com.br/docs
 */

const BASE = "https://brasilapi.com.br/api";
const TIMEOUT_MS = 10_000;

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`BrasilAPI ${r.status}: ${text.slice(0, 200)}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export const brasilApiConnector: IConnector = {
  tipo: "brasil_api",
  nome: "BrasilAPI",
  descricao: "Consulta pública de CNPJ, CEP, bancos e tributos brasileiros — sem chave.",
  categoria: "publico",
  describeConfig: () => [],
  async testConnection() {
    try {
      // Pinga endpoint trivial (banco do Brasil)
      await fetchJson(`${BASE}/banks/v1/001`);
      return { ok: true, message: "BrasilAPI respondendo normalmente" };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
  async sync(_creds, params): Promise<SyncResult> {
    // O "sync" do BrasilAPI é uma consulta on-demand. Sem schedule.
    return { ok: true, count: 0, message: "BrasilAPI é consultado sob demanda (CNPJ/CEP). Use os endpoints específicos." };
  },
};

// ── Helpers usados pelas rotas para consulta on-demand ───────────────

export async function consultarCnpj(cnpj: string): Promise<{
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  natureza_juridica?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  municipio?: string;
  uf?: string;
  email?: string;
  ddd_telefone_1?: string;
  capital_social?: number;
}> {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) throw new Error("CNPJ inválido (precisa 14 dígitos)");
  return fetchJson(`${BASE}/cnpj/v1/${limpo}`);
}

export async function consultarCep(cep: string): Promise<{
  cep: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
}> {
  const limpo = cep.replace(/\D/g, "");
  if (limpo.length !== 8) throw new Error("CEP inválido (precisa 8 dígitos)");
  return fetchJson(`${BASE}/cep/v2/${limpo}`);
}
