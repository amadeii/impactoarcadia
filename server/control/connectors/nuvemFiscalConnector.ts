import type { IConnector, SyncResult } from "../connectorHub";

/**
 * Nuvem Fiscal — STUB ESTRUTURADO.
 *
 * Em produção: usar https://www.nuvemfiscal.com.br/docs/api — REST moderno
 * para consultar NF-e destinadas a um CNPJ via endpoint de Distribuição DFe
 * da SEFAZ. Permite manifestação automática (Ciência da Operação,
 * Confirmação, Desconhecimento, Não Realizada).
 *
 * Este stub gera NF-e sintéticas para validar fluxo do nfeMonitor.
 */

const SIMULADO = true;

export const nuvemFiscalConnector: IConnector = {
  tipo: "nuvem_fiscal",
  nome: "Nuvem Fiscal (Monitor NF-e)",
  descricao: "Monitora NF-e recebidas (destinadas ao CNPJ do cliente) via Distribuição DFe da SEFAZ.",
  categoria: "fiscal",
  describeConfig: () => [
    { name: "apiKey", label: "API Key da Nuvem Fiscal", type: "password", required: true },
    { name: "ambiente", label: "Ambiente", type: "select", required: true, options: ["producao", "homologacao"] },
  ],
  async testConnection(creds) {
    if (!creds?.apiKey) return { ok: false, message: "apiKey não configurada" };
    if (SIMULADO) return { ok: true, message: "[STUB] Nuvem Fiscal simulada OK" };
    return { ok: true };
  },
  async sync(creds, params): Promise<SyncResult> {
    if (!creds?.apiKey) return { ok: false, count: 0, message: "Sem credencial" };
    if (SIMULADO) {
      // Cliente CNPJ vem em params
      const cnpjCliente = params?.cnpj ?? "00000000000000";
      const nfes = gerarNfesSimuladas(cnpjCliente, 2);
      return {
        ok: true,
        count: nfes.length,
        message: `[STUB] ${nfes.length} NF-e simuladas para o CNPJ ${cnpjCliente}`,
        details: { nfes, simulado: true },
      };
    }
    return { ok: true, count: 0 };
  },
};

export interface NfeSimulada {
  chaveNfe: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  valorTotal: number;
  fornecedorCnpj: string;
  fornecedorNome: string;
  xmlConteudo: string;
}

/** Gera NF-e sintéticas determinísticas baseadas no CNPJ destinatário. */
export function gerarNfesSimuladas(cnpjDestinatario: string, qtd = 2): NfeSimulada[] {
  const fornecedores = [
    { cnpj: "11222333000181", nome: "Fornecedor Demo Ltda" },
    { cnpj: "44555666000172", nome: "Distribuidora Exemplo S.A." },
    { cnpj: "77888999000163", nome: "Serviços Mock ME" },
  ];
  const hoje = new Date();
  return Array.from({ length: qtd }).map((_, i) => {
    const f = fornecedores[i % fornecedores.length];
    const data = new Date(hoje.getTime() - i * 86_400_000);
    const numero = String(1000 + i);
    const chave = "35" + // SP
      data.toISOString().slice(2, 7).replace("-", "") + // AAMM
      f.cnpj +
      "55" + "001" + numero.padStart(9, "0") + "1" +
      "12345678";
    return {
      chaveNfe: chave.padEnd(44, "0").slice(0, 44),
      numero,
      serie: "1",
      dataEmissao: data.toISOString().slice(0, 10),
      valorTotal: 1000 + i * 250,
      fornecedorCnpj: f.cnpj,
      fornecedorNome: f.nome,
      xmlConteudo: `<?xml version="1.0"?><nfeProc>[STUB] NF-e ${numero} de ${f.nome} para ${cnpjDestinatario}</nfeProc>`,
    };
  });
}
