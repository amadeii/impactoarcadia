// ============================================================
// MCP SERVER - SERVICE
// Model Context Protocol para exposição de ferramentas
// ============================================================

import { MANUS_TOOLS, ManusToolDef } from '../../manus/tools';
import type { McpTool, McpToolsListResponse, McpToolExecuteResponse } from '../../../shared/models/protocols';

const MCP_SERVER_INFO = {
  name: 'Arcadia Suite MCP Server',
  version: '1.0.0',
  description: 'Servidor MCP do Arcadia Suite - Expõe ferramentas do Arcádia Agent para agentes externos'
};

/**
 * Converte uma ferramenta do formato Manus para o formato MCP
 */
function toMcpTool(tool: ManusToolDef): McpTool {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, param] of Object.entries(tool.parameters)) {
    properties[key] = {
      type: param.type,
      description: param.description
    };
    if (param.required) {
      required.push(key);
    }
  }

  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties,
      required
    }
  };
}

/**
 * Lista todas as ferramentas disponíveis no formato MCP
 */
export function listTools(): McpToolsListResponse {
  const tools = MANUS_TOOLS
    .filter(tool => tool.name !== 'finish') // Exclui ferramenta interna
    .map(toMcpTool);

  return {
    tools,
    serverInfo: MCP_SERVER_INFO
  };
}

/**
 * Busca uma ferramenta pelo nome
 */
export function getTool(name: string): McpTool | null {
  const tool = MANUS_TOOLS.find(t => t.name === name);
  if (!tool || tool.name === 'finish') {
    return null;
  }
  return toMcpTool(tool);
}

/**
 * Valida os argumentos de uma ferramenta
 */
export function validateToolArguments(toolName: string, args: Record<string, any>): { valid: boolean; error?: string } {
  const tool = MANUS_TOOLS.find(t => t.name === toolName);
  if (!tool) {
    return { valid: false, error: `Ferramenta '${toolName}' não encontrada` };
  }

  // Verifica parâmetros obrigatórios
  for (const [key, param] of Object.entries(tool.parameters)) {
    if (param.required && (args[key] === undefined || args[key] === null)) {
      return { valid: false, error: `Parâmetro obrigatório '${key}' não fornecido` };
    }
  }

  return { valid: true };
}

/**
 * Executa uma ferramenta (integração com o serviço Manus)
 */
export async function executeTool(
  toolName: string, 
  args: Record<string, any>,
  executeToolFn: (name: string, args: Record<string, any>) => Promise<any>
): Promise<McpToolExecuteResponse> {
  const startTime = Date.now();

  // Valida argumentos
  const validation = validateToolArguments(toolName, args);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      executionTime: Date.now() - startTime
    };
  }

  try {
    const result = await executeToolFn(toolName, args);
    return {
      success: true,
      result,
      executionTime: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao executar ferramenta',
      executionTime: Date.now() - startTime
    };
  }
}

/**
 * Retorna estatísticas do servidor MCP
 */
export function getServerStats() {
  const tools = MANUS_TOOLS.filter(t => t.name !== 'finish');
  
  return {
    ...MCP_SERVER_INFO,
    totalTools: tools.length,
    toolCategories: {
      search: tools.filter(t => t.name.includes('search') || t.name.includes('query')).length,
      file: tools.filter(t => t.name.includes('file')).length,
      communication: tools.filter(t => t.name.includes('message') || t.name.includes('whatsapp')).length,
      analysis: tools.filter(t => t.name.includes('analyze') || t.name.includes('generate')).length,
      execution: tools.filter(t => t.name.includes('execute') || t.name.includes('shell')).length
    }
  };
}
