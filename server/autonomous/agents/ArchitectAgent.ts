/**
 * Arcadia Suite - Architect Agent
 * 
 * Agente Arquiteto: Responsável por interpretar requisitos, analisar repositórios
 * externos e criar especificações técnicas para novos módulos.
 * 
 * @author Arcadia Development Team
 * @version 1.0.0
 */

import { BaseAgent, AgentConfig, ThoughtActionObservation, AgentResult } from "./BaseAgent";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const ARCHITECT_PROMPT = `Você é o Agente Arquiteto do Arcadia Suite.

## Seu Papel
Você interpreta requisitos de negócio e cria especificações técnicas detalhadas.
Você analisa repositórios open-source para se inspirar em padrões de código.

## Suas Responsabilidades
1. Entender o que o usuário quer construir
2. Analisar repositórios externos relevantes (n8n, OpenManus, etc.)
3. Criar especificações técnicas detalhadas
4. Definir schema de banco de dados (Drizzle)
5. Definir rotas de API necessárias
6. Definir componentes de UI necessários

## Ferramentas Disponíveis
- analyze_external_repo: Analisa estrutura de repos externos
- read_external_file: Lê arquivos específicos de repos

## Formato de Saída
Sempre produza uma especificação JSON com:
{
  "moduleName": "nome-do-modulo",
  "description": "descrição",
  "schema": { "tables": [...] },
  "api": { "routes": [...] },
  "ui": { "components": [...] }
}`;

export interface ModuleSpec {
  moduleName: string;
  description: string;
  schema: {
    tables: Array<{
      name: string;
      columns: Array<{
        name: string;
        type: string;
        constraints?: string[];
      }>;
    }>;
  };
  api: {
    routes: Array<{
      method: string;
      path: string;
      description: string;
    }>;
  };
  ui: {
    components: Array<{
      name: string;
      type: string;
      description: string;
    }>;
  };
  inspiration?: {
    repository: string;
    relevantFiles: string[];
  };
}

export class ArchitectAgent extends BaseAgent {
  private spec: ModuleSpec | null = null;
  private currentTask: string = "";

  constructor() {
    const config: AgentConfig = {
      name: "Architect",
      role: "Design e Especificação",
      systemPrompt: ARCHITECT_PROMPT,
      maxIterations: 5,
      tools: ["analyze_external_repo", "read_external_file"]
    };
    super(config);
  }

  async think(input: string, context?: any): Promise<ThoughtActionObservation> {
    this.currentTask = input;

    if (this.history.length === 0) {
      const needsExternalAnalysis = this.detectExternalReference(input);
      
      if (needsExternalAnalysis) {
        return {
          thought: `O usuário quer algo inspirado em ${needsExternalAnalysis}. Preciso analisar esse repositório primeiro.`,
          action: "analyze_external_repo",
          actionInput: { repoUrl: needsExternalAnalysis }
        };
      }

      return {
        thought: "Vou criar a especificação diretamente com base no requisito.",
      };
    }

    if (this.history.length === 1 && this.history[0].observation) {
      return {
        thought: "Análise concluída. Agora vou criar a especificação do módulo.",
      };
    }

    return {
      thought: "Especificação concluída.",
    };
  }

  private detectExternalReference(input: string): string | null {
    const patterns = [
      { pattern: /n8n/i, url: "https://github.com/n8n-io/n8n" },
      { pattern: /openmanus/i, url: "https://github.com/mannaandpoem/OpenManus" },
      { pattern: /langchain/i, url: "https://github.com/langchain-ai/langchain" },
      { pattern: /dify/i, url: "https://github.com/langgenius/dify" },
      { pattern: /flowise/i, url: "https://github.com/FlowiseAI/Flowise" },
    ];

    for (const { pattern, url } of patterns) {
      if (pattern.test(input)) {
        return url;
      }
    }

    const urlMatch = input.match(/https?:\/\/github\.com\/[^\s]+/);
    if (urlMatch) {
      return urlMatch[0];
    }

    return null;
  }

  async generateOutput(): Promise<string> {
    this.spec = this.createSpecFromTask(this.currentTask);
    return JSON.stringify(this.spec, null, 2);
  }

  private createSpecFromTask(task: string): ModuleSpec {
    const moduleName = this.extractModuleName(task);
    
    return {
      moduleName,
      description: task,
      schema: {
        tables: [
          {
            name: `arc_${moduleName}`,
            columns: [
              { name: "id", type: "serial", constraints: ["PRIMARY KEY"] },
              { name: "name", type: "text", constraints: ["NOT NULL"] },
              { name: "status", type: "text", constraints: ["DEFAULT 'active'"] },
              { name: "created_at", type: "timestamp", constraints: ["DEFAULT NOW()"] },
              { name: "updated_at", type: "timestamp", constraints: ["DEFAULT NOW()"] }
            ]
          }
        ]
      },
      api: {
        routes: [
          { method: "GET", path: `/${moduleName}`, description: "Listar todos" },
          { method: "GET", path: `/${moduleName}/:id`, description: "Buscar por ID" },
          { method: "POST", path: `/${moduleName}`, description: "Criar novo" },
          { method: "PUT", path: `/${moduleName}/:id`, description: "Atualizar" },
          { method: "DELETE", path: `/${moduleName}/:id`, description: "Remover" }
        ]
      },
      ui: {
        components: [
          { name: `${this.capitalize(moduleName)}List`, type: "page", description: "Listagem com DataTable" },
          { name: `${this.capitalize(moduleName)}Form`, type: "modal", description: "Formulário de criação/edição" },
          { name: `${this.capitalize(moduleName)}Details`, type: "panel", description: "Detalhes do item" }
        ]
      },
      inspiration: this.history.length > 0 ? {
        repository: this.detectExternalReference(task) || "",
        relevantFiles: []
      } : undefined
    };
  }

  private extractModuleName(task: string): string {
    const words = task.toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 3 && !["quero", "criar", "sistema", "como", "tipo", "para"].includes(w));
    
    return words[0] || "module";
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getSpec(): ModuleSpec | null {
    return this.spec;
  }
}
