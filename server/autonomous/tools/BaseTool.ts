/**
 * Arcadia Suite - Base Tool Architecture
 * 
 * Classe base para todas as ferramentas do sistema autônomo.
 * Segue o padrão ReAct (Reason + Act) com design orientado a ferramentas.
 * 
 * @author Arcadia Development Team
 * @version 1.0.0
 */

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required: boolean;
  default?: any;
}

export interface ToolResult {
  success: boolean;
  result: string;
  data?: any;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
}

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract category: string;
  abstract parameters: ToolParameter[];

  abstract execute(params: Record<string, any>): Promise<ToolResult>;

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      parameters: this.parameters,
    };
  }

  validateParams(params: Record<string, any>): { valid: boolean; error?: string } {
    for (const param of this.parameters) {
      if (param.required && !(param.name in params)) {
        return {
          valid: false,
          error: `Parâmetro obrigatório ausente: ${param.name}`,
        };
      }

      if (param.name in params) {
        const value = params[param.name];
        const actualType = Array.isArray(value) ? "array" : typeof value;
        
        if (actualType !== param.type && value !== undefined && value !== null) {
          return {
            valid: false,
            error: `Tipo inválido para ${param.name}: esperado ${param.type}, recebido ${actualType}`,
          };
        }
      }
    }

    return { valid: true };
  }

  protected formatSuccess(result: string, data?: any): ToolResult {
    return { success: true, result, data };
  }

  protected formatError(error: string): ToolResult {
    return { success: false, result: error, error };
  }
}
