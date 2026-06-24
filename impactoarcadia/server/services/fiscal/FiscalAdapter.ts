import {
  cancelarNfeControlPlus,
  emitirNfeControlPlus,
  isControlPlusConfigured,
} from "../../integrations/controlplusClient";

interface NFeCabecalho {
  naturezaOperacao: string;
  tipoDocumento: number;
  tipoNF: number;
  destNome: string;
  destCNPJ?: string;
  destCPF?: string;
  destIE?: string;
  destEndereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    codigoMunicipio: string;
  };
}

interface NFeItem {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  icms?: {
    origem: number;
    cst: string;
    aliquota: number;
    baseCalculo: number;
    valor: number;
  };
}

interface NFeRequest {
  cabecalho: NFeCabecalho;
  itens: NFeItem[];
  pagamentos: Array<{
    forma: string;
    valor: number;
  }>;
}

interface NFCeRequest {
  cabecalho: Omit<NFeCabecalho, 'destIE'>;
  itens: NFeItem[];
  pagamentos: Array<{
    forma: string;
    valor: number;
  }>;
  cpfConsumidor?: string;
}

interface FiscalResponse {
  success: boolean;
  chave?: string;
  protocolo?: string;
  xml?: string;
  pdf?: string;
  error?: string;
  statusCode?: number;
}

class FiscalAdapter {
  private plusUrl: string;
  private apiToken: string;

  constructor() {
    this.plusUrl = process.env.PLUS_URL || '';
    this.apiToken = process.env.PLUS_API_TOKEN || '';
  }

  private async request(endpoint: string, data: any): Promise<FiscalResponse> {
    if (!this.plusUrl || !this.apiToken) {
      return {
        success: false,
        error: 'Arcádia Plus não configurado. Configure PLUS_URL e PLUS_API_TOKEN.',
        statusCode: 500
      };
    }

    try {
      const response = await fetch(`${this.plusUrl}/api/fiscal/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.message || 'Erro na emissão fiscal',
          statusCode: response.status
        };
      }

      return {
        success: true,
        chave: result.chave,
        protocolo: result.protocolo,
        xml: result.xml,
        pdf: result.pdf
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Erro de conexão com Arcádia Plus: ${error.message}`,
        statusCode: 500
      };
    }
  }

  private defaultEmpresaId(): number {
    const parsed = Number(process.env.CONTROL_PLUS_EMPRESA_ID || 1);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private toFiscalResponse(result: Awaited<ReturnType<typeof emitirNfeControlPlus>>): FiscalResponse {
    if (result.ok === false) {
      return {
        success: false,
        error: result.message,
        statusCode: result.status,
      };
    }

    const data = result.data?.data && typeof result.data.data === "object" ? result.data.data : result.data;
    return {
      success: true,
      chave: data?.chave ?? data?.access_key,
      protocolo: data?.protocolo ?? data?.protocol,
      xml: data?.xml,
      pdf: data?.pdf,
      statusCode: 200,
    };
  }

  async emitirNFe(dados: NFeRequest): Promise<FiscalResponse> {
    const result = await emitirNfeControlPlus(dados as unknown as Record<string, any>, this.defaultEmpresaId());
    return this.toFiscalResponse(result);
  }

  async emitirNFCe(dados: NFCeRequest): Promise<FiscalResponse> {
    return this.request('nfce/emitir', dados);
  }

  async consultarNFe(chave: string): Promise<FiscalResponse> {
    return this.request('nfe/consultar', { chave });
  }

  async cancelarNFe(chave: string, justificativa: string): Promise<FiscalResponse> {
    const result = await cancelarNfeControlPlus({ chave, justificativa }, this.defaultEmpresaId());
    return this.toFiscalResponse(result);
  }

  async cartaCorrecao(chave: string, correcao: string): Promise<FiscalResponse> {
    return this.request('nfe/carta-correcao', { chave, correcao });
  }

  async inutilizar(serie: number, numInicial: number, numFinal: number, justificativa: string): Promise<FiscalResponse> {
    return this.request('nfe/inutilizar', { serie, numInicial, numFinal, justificativa });
  }

  async downloadXml(chave: string): Promise<FiscalResponse> {
    return this.request('nfe/download-xml', { chave });
  }

  async downloadPdf(chave: string): Promise<FiscalResponse> {
    return this.request('nfe/download-pdf', { chave });
  }

  isConfigured(): boolean {
    return isControlPlusConfigured() || !!(this.plusUrl && this.apiToken);
  }
}

export const fiscalAdapter = new FiscalAdapter();
export type { NFeRequest, NFCeRequest, FiscalResponse };
