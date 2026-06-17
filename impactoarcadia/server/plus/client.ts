const PLUS_PORT = process.env.PLUS_PORT || 8080;
const PLUS_BASE_URL = `http://localhost:${PLUS_PORT}`;

export interface PlusApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function plusFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  empresaId?: number
): Promise<PlusApiResponse<T>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers as Record<string, string> || {}),
    };
    if (empresaId) {
      headers["X-Empresa-Id"] = String(empresaId);
    }

    const response = await fetch(`${PLUS_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`,
      };
    }

    return { success: true, data };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Erro de conexão com Plus",
    };
  }
}

export interface PlusCliente {
  id?: number;
  razao_social: string;
  nome_fantasia?: string;
  cpf_cnpj?: string;
  ie?: string;
  telefone?: string;
  celular?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

export interface PlusProduto {
  id?: number;
  nome: string;
  referencia?: string;
  valor_venda: number;
  NCM?: string;
  unidade?: string;
  estoque_atual?: number;
  codigo_barras?: string;
  categoria_id?: number;
}

export interface PlusVenda {
  id?: number;
  cliente_id?: number;
  natureza_operacao_id?: number;
  valor_total: number;
  desconto?: number;
  forma_pagamento?: string;
  observacao?: string;
  itens: PlusVendaItem[];
  faturar?: {
    forma_pagamento: string;
    valor: number;
    parcelas?: number;
  }[];
}

export interface PlusVendaItem {
  produto_id: number;
  quantidade: number;
  valor_unitario: number;
  desconto?: number;
  valor_total: number;
}

export interface PlusContaReceber {
  id?: number;
  cliente_id?: number;
  venda_id?: number;
  data_vencimento: string;
  valor: number;
  valor_recebido?: number;
  status?: string;
  forma_pagamento?: string;
  observacao?: string;
}

export interface PlusEstoqueMovimento {
  produto_id: number;
  tipo: "entrada" | "saida";
  quantidade: number;
  valor_unitario?: number;
  observacao?: string;
}

export interface PlusNFeData {
  venda_id?: number;
  cliente_id?: number;
  natureza_operacao?: string;
  itens: Array<{
    produto_id: number;
    quantidade: number;
    valor_unitario: number;
    ncm?: string;
    cfop?: string;
  }>;
  pagamentos?: Array<{
    forma: string;
    valor: number;
  }>;
}

export const plusClient = {
  async getDashboardData(empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/graficos/dados-cards", {}, empresaId);
  },

  async getVendasMes(empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/graficos/grafico-vendas-mes", {}, empresaId);
  },

  async getComprasMes(empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/graficos/grafico-compras-mes", {}, empresaId);
  },

  async getGraficoMes(empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/graficos/grafico-mes", {}, empresaId);
  },

  async getContasReceber(empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/graficos/grafico-conta-receber", {}, empresaId);
  },

  async getContasPagar(empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/graficos/grafico-conta-pagar", {}, empresaId);
  },

  async getContasEmpresa(empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/contas-empresa", {}, empresaId);
  },

  async healthCheck(): Promise<PlusApiResponse> {
    return plusFetch("/api/health");
  },

  // ========================================
  // CLIENTES
  // ========================================

  async listarClientes(empresaId?: number, page = 1): Promise<PlusApiResponse<PlusCliente[]>> {
    return plusFetch(`/api/clientes?page=${page}`, {}, empresaId);
  },

  async criarCliente(data: PlusCliente, empresaId?: number): Promise<PlusApiResponse<PlusCliente>> {
    return plusFetch("/api/clientes", {
      method: "POST",
      body: JSON.stringify(data),
    }, empresaId);
  },

  async atualizarCliente(id: number, data: Partial<PlusCliente>, empresaId?: number): Promise<PlusApiResponse<PlusCliente>> {
    return plusFetch(`/api/clientes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }, empresaId);
  },

  async buscarCliente(id: number, empresaId?: number): Promise<PlusApiResponse<PlusCliente>> {
    return plusFetch(`/api/clientes/${id}`, {}, empresaId);
  },

  // ========================================
  // FORNECEDORES
  // ========================================

  async listarFornecedores(empresaId?: number, page = 1): Promise<PlusApiResponse> {
    return plusFetch(`/api/fornecedores?page=${page}`, {}, empresaId);
  },

  async criarFornecedor(data: any, empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/fornecedores", {
      method: "POST",
      body: JSON.stringify(data),
    }, empresaId);
  },

  // ========================================
  // PRODUTOS
  // ========================================

  async listarProdutos(empresaId?: number, page = 1): Promise<PlusApiResponse<PlusProduto[]>> {
    return plusFetch(`/api/produtos?page=${page}`, {}, empresaId);
  },

  async criarProduto(data: PlusProduto, empresaId?: number): Promise<PlusApiResponse<PlusProduto>> {
    return plusFetch("/api/produtos", {
      method: "POST",
      body: JSON.stringify(data),
    }, empresaId);
  },

  async atualizarProduto(id: number, data: Partial<PlusProduto>, empresaId?: number): Promise<PlusApiResponse<PlusProduto>> {
    return plusFetch(`/api/produtos/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }, empresaId);
  },

  async buscarProduto(id: number, empresaId?: number): Promise<PlusApiResponse<PlusProduto>> {
    return plusFetch(`/api/produtos/${id}`, {}, empresaId);
  },

  // ========================================
  // VENDAS
  // ========================================

  async listarVendas(empresaId?: number, page = 1, filtros?: Record<string, string>): Promise<PlusApiResponse> {
    const params = new URLSearchParams({ page: String(page), ...filtros });
    return plusFetch(`/api/vendas?${params}`, {}, empresaId);
  },

  async criarVenda(data: PlusVenda, empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/vendas", {
      method: "POST",
      body: JSON.stringify(data),
    }, empresaId);
  },

  async buscarVenda(id: number, empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch(`/api/vendas/${id}`, {}, empresaId);
  },

  async cancelarVenda(id: number, empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch(`/api/vendas/${id}/cancelar`, {
      method: "POST",
    }, empresaId);
  },

  // ========================================
  // ESTOQUE
  // ========================================

  async consultarEstoque(empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/estoque", {}, empresaId);
  },

  async movimentarEstoque(data: PlusEstoqueMovimento, empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/estoque/movimentar", {
      method: "POST",
      body: JSON.stringify(data),
    }, empresaId);
  },

  async ajustarEstoque(produtoId: number, quantidade: number, empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch(`/api/estoque/ajustar`, {
      method: "POST",
      body: JSON.stringify({ produto_id: produtoId, quantidade }),
    }, empresaId);
  },

  // ========================================
  // CONTAS A RECEBER
  // ========================================

  async listarContasReceber(empresaId?: number, filtros?: Record<string, string>): Promise<PlusApiResponse<PlusContaReceber[]>> {
    const params = filtros ? `?${new URLSearchParams(filtros)}` : "";
    return plusFetch(`/api/contas-receber${params}`, {}, empresaId);
  },

  async criarContaReceber(data: PlusContaReceber, empresaId?: number): Promise<PlusApiResponse<PlusContaReceber>> {
    return plusFetch("/api/contas-receber", {
      method: "POST",
      body: JSON.stringify(data),
    }, empresaId);
  },

  async receberConta(id: number, data: { valor_recebido: number; data_recebimento: string }, empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch(`/api/contas-receber/${id}/receber`, {
      method: "POST",
      body: JSON.stringify(data),
    }, empresaId);
  },

  // ========================================
  // CONTAS A PAGAR
  // ========================================

  async listarContasPagar(empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/contas-pagar", {}, empresaId);
  },

  // ========================================
  // FISCAL - NF-e / NFC-e
  // ========================================

  async emitirNFe(dados: PlusNFeData, empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/nfe/emitir", {
      method: "POST",
      body: JSON.stringify(dados),
    }, empresaId);
  },

  async emitirNFCe(dados: PlusNFeData, empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/nfce/emitir", {
      method: "POST",
      body: JSON.stringify(dados),
    }, empresaId);
  },

  async consultarNFe(chave: string, empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/nfe/consultar", {
      method: "POST",
      body: JSON.stringify({ chave }),
    }, empresaId);
  },

  async listarNFes(empresaId?: number, page = 1): Promise<PlusApiResponse> {
    return plusFetch(`/api/nfe?page=${page}`, {}, empresaId);
  },

  // ========================================
  // EMPRESAS
  // ========================================

  async listarEmpresas(): Promise<PlusApiResponse> {
    return plusFetch("/api/empresas");
  },

  async buscarEmpresa(id: number): Promise<PlusApiResponse> {
    return plusFetch(`/api/empresas/${id}`);
  },

  // ========================================
  // NATUREZAS DE OPERAÇÃO
  // ========================================

  async listarNaturezasOperacao(empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/natureza-operacao", {}, empresaId);
  },

  // ========================================
  // CATEGORIAS
  // ========================================

  async listarCategorias(empresaId?: number): Promise<PlusApiResponse> {
    return plusFetch("/api/categorias", {}, empresaId);
  },
};

export default plusClient;
