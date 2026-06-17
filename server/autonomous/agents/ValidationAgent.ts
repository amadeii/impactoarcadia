/**
 * Arcadia Suite - Validation Agent
 * 
 * Agente de Validação: Responsável por validar código gerado,
 * verificar erros de sintaxe e gerar testes básicos.
 * 
 * @author Arcadia Development Team
 * @version 1.0.0
 */

import { BaseAgent, AgentConfig, ThoughtActionObservation } from "./BaseAgent";
import { GeneratedFile } from "./CodeGeneratorAgent";

const VALIDATION_PROMPT = `Você é o Agente de Validação do Arcadia Suite.

## Seu Papel
Você valida código gerado e identifica problemas potenciais.
Você verifica padrões de código e boas práticas.

## Suas Responsabilidades
1. Verificar sintaxe TypeScript
2. Validar imports e dependências
3. Verificar padrões de segurança
4. Gerar testes básicos
5. Sugerir melhorias`;

export interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ValidationReport {
  overall: "pass" | "fail" | "warning";
  results: ValidationResult[];
  summary: string;
}

export class ValidationAgent extends BaseAgent {
  private files: GeneratedFile[] = [];
  private report: ValidationReport | null = null;

  constructor() {
    const config: AgentConfig = {
      name: "Validation",
      role: "Validação e Testes",
      systemPrompt: VALIDATION_PROMPT,
      maxIterations: 3,
      tools: []
    };
    super(config);
  }

  async think(input: string, context?: { files: GeneratedFile[] }): Promise<ThoughtActionObservation> {
    if (context?.files) {
      this.files = context.files;
    }

    if (this.history.length === 0) {
      return {
        thought: `Recebi ${this.files.length} arquivos para validar. Vou analisar cada um.`,
      };
    }

    return {
      thought: "Validação concluída.",
    };
  }

  async generateOutput(): Promise<string> {
    const results: ValidationResult[] = [];

    for (const file of this.files) {
      const result = this.validateFile(file);
      results.push(result);
    }

    const hasErrors = results.some(r => !r.valid);
    const hasWarnings = results.some(r => r.warnings.length > 0);

    this.report = {
      overall: hasErrors ? "fail" : hasWarnings ? "warning" : "pass",
      results,
      summary: this.generateSummary(results)
    };

    return JSON.stringify(this.report, null, 2);
  }

  private validateFile(file: GeneratedFile): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!file.content.includes("import")) {
      warnings.push("Arquivo sem imports - pode estar incompleto");
    }

    if (file.type === "routes" && !file.content.includes("try")) {
      warnings.push("Rotas sem tratamento de erro try/catch");
    }

    if (file.type === "service" && !file.content.includes("async")) {
      errors.push("Service sem métodos assíncronos");
    }

    if (file.type === "component" || file.type === "page") {
      if (!file.content.includes("data-testid")) {
        suggestions.push("Adicionar data-testid para facilitar testes");
      }
    }

    if (file.content.includes("console.log")) {
      warnings.push("Contém console.log - remover antes de produção");
    }

    if (file.content.includes("any")) {
      suggestions.push("Substituir 'any' por tipos específicos");
    }

    return {
      file: file.path,
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  private generateSummary(results: ValidationResult[]): string {
    const total = results.length;
    const valid = results.filter(r => r.valid).length;
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

    return `Validados ${total} arquivos: ${valid} OK, ${totalErrors} erros, ${totalWarnings} avisos`;
  }

  getReport(): ValidationReport | null {
    return this.report;
  }
}
