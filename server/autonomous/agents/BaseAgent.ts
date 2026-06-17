/**
 * Arcadia Suite - Base Agent
 * 
 * Classe abstrata base para todos os agentes autônomos.
 * Implementa o padrão ReAct (Reason + Act) com loop de pensamento-ação-observação.
 * 
 * @author Arcadia Development Team
 * @version 1.0.0
 */

import { toolManager, ToolResult } from "../tools";

export interface AgentConfig {
  name: string;
  role: string;
  systemPrompt: string;
  maxIterations?: number;
  tools?: string[];
}

export interface ThoughtActionObservation {
  thought: string;
  action?: string;
  actionInput?: Record<string, any>;
  observation?: string;
}

export interface AgentResult {
  success: boolean;
  output: string;
  iterations: ThoughtActionObservation[];
  error?: string;
}

export abstract class BaseAgent {
  protected name: string;
  protected role: string;
  protected systemPrompt: string;
  protected maxIterations: number;
  protected allowedTools: string[];
  protected history: ThoughtActionObservation[] = [];

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.maxIterations = config.maxIterations || 10;
    this.allowedTools = config.tools || [];
  }

  abstract think(input: string, context?: any): Promise<ThoughtActionObservation>;

  abstract generateOutput(): Promise<string>;

  protected async executeTool(toolName: string, params: Record<string, any>): Promise<ToolResult> {
    if (this.allowedTools.length > 0 && !this.allowedTools.includes(toolName)) {
      return {
        success: false,
        result: `Ferramenta '${toolName}' não permitida para este agente`,
        error: "TOOL_NOT_ALLOWED"
      };
    }

    return toolManager.execute(toolName, params);
  }

  async run(input: string, context?: any): Promise<AgentResult> {
    this.history = [];

    try {
      for (let i = 0; i < this.maxIterations; i++) {
        const tao = await this.think(input, context);
        this.history.push(tao);

        if (!tao.action) {
          const output = await this.generateOutput();
          return {
            success: true,
            output,
            iterations: this.history
          };
        }

        const toolResult = await this.executeTool(tao.action, tao.actionInput || {});
        
        this.history[this.history.length - 1].observation = toolResult.result;

        if (!toolResult.success) {
          console.log(`[${this.name}] Ferramenta falhou: ${toolResult.error}`);
        }
      }

      return {
        success: false,
        output: "Número máximo de iterações atingido",
        iterations: this.history,
        error: "MAX_ITERATIONS_REACHED"
      };
    } catch (error: any) {
      return {
        success: false,
        output: `Erro: ${error.message}`,
        iterations: this.history,
        error: error.message
      };
    }
  }

  getHistory(): ThoughtActionObservation[] {
    return this.history;
  }

  getName(): string {
    return this.name;
  }

  getRole(): string {
    return this.role;
  }
}
