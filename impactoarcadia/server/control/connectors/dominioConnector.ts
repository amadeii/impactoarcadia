import type { IConnector, SyncResult } from "../connectorHub";

/**
 * Domínio Sistemas — STUB ESTRUTURADO.
 *
 * Em produção: usar a API REST do Domínio (https://www.dominioatendimento.com)
 * para puxar lançamentos contábeis classificados pela contabilidade do cliente.
 *
 * Este stub simula o sync devolvendo um payload sintético determinístico
 * baseado nas params, para permitir validar UI e fluxo de logs sem credenciais.
 * Quando o usuário fornecer apiKey real, basta trocar `simulado: true` por
 * uma chamada `fetch` ao endpoint do Domínio.
 */

const SIMULADO = true;

export const dominioConnector: IConnector = {
  tipo: "dominio",
  nome: "Domínio Sistemas",
  descricao: "Importa lançamentos classificados do Domínio Sistemas (escritório contábil).",
  categoria: "erp",
  describeConfig: () => [
    { name: "apiKey", label: "API Key do Domínio", type: "password", required: true, placeholder: "Token fornecido pela contabilidade" },
    { name: "codigoEmpresa", label: "Código da Empresa no Domínio", type: "text", required: true, placeholder: "Ex: 12345" },
    { name: "endpoint", label: "URL Base (opcional)", type: "url", required: false, placeholder: "https://api.dominiosistemas.com.br" },
  ],
  async testConnection(creds) {
    if (!creds?.apiKey) return { ok: false, message: "apiKey não configurada" };
    if (!creds?.codigoEmpresa) return { ok: false, message: "codigoEmpresa não configurado" };
    if (SIMULADO) {
      return { ok: true, message: "[STUB] Conexão simulada OK. Plugue a API real em dominioConnector.ts." };
    }
    // TODO real: fetch ${endpoint}/empresas/${codigoEmpresa} com Bearer apiKey
    return { ok: true };
  },
  async sync(creds, params): Promise<SyncResult> {
    if (!creds?.apiKey || !creds?.codigoEmpresa) {
      return { ok: false, count: 0, message: "Conector incompleto (apiKey + codigoEmpresa obrigatórios)" };
    }
    if (SIMULADO) {
      const desde = params?.desde ?? "ultimo_mes";
      // Payload sintético que ilustra a estrutura esperada
      const lancamentos = [
        { data: "2026-04-01", historico: "Honorários contábeis", debito: "Despesas Administrativas", credito: "Bancos C/C", valor: 1500 },
        { data: "2026-04-05", historico: "Receita de prestação de serviços", debito: "Clientes", credito: "Receita de Serviços", valor: 12000 },
        { data: "2026-04-10", historico: "Pagamento de aluguel", debito: "Despesas com Aluguel", credito: "Bancos C/C", valor: 4500 },
      ];
      return {
        ok: true,
        count: lancamentos.length,
        message: `[STUB] ${lancamentos.length} lançamentos simulados (período: ${desde}). Plugue a API real para dados verdadeiros.`,
        details: { lancamentos, simulado: true },
      };
    }
    // TODO real
    return { ok: true, count: 0 };
  },
};
