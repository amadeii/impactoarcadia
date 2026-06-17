/**
 * Arcadia Suite - Architect Agent
 * 
 * Agente responsável por analisar requisitos e criar especificações técnicas.
 * Usa o ContextIndexer para entender a estrutura do projeto.
 * 
 * @author Arcadia Development Team
 * @version 2.0.0
 */

import { BaseBlackboardAgent, type AgentConfig } from "../BaseBlackboardAgent";
import { blackboardService } from "../service";
import { type BlackboardTask } from "@shared/schema";
import { contextIndexer } from "../ContextIndexer";
import { toolManager } from "../../autonomous/tools";

const SYSTEM_PROMPT = `Você é o Agente Arquiteto do Arcadia Suite.

## Seu Papel
Você interpreta requisitos de negócio e cria especificações técnicas detalhadas para o sistema.
Você tem acesso ao contexto do projeto e pode ler arquivos existentes.

## Responsabilidades
1. Analisar a solicitação do usuário
2. Consultar estrutura existente do projeto
3. Identificar componentes necessários (tabelas, APIs, UI)
4. Criar especificação técnica detalhada
5. Considerar integração com módulos existentes

## Stack Técnico
- Backend: Express.js, TypeScript, Drizzle ORM
- Frontend: React 18, TypeScript, Tailwind CSS, shadcn/ui
- Banco: PostgreSQL
- Autenticação: Passport.js

## SISTEMA MODULAR (IMPORTANTE!)
O projeto usa um sistema modular para autonomia do Dev Center:

### Schemas (Banco de Dados)
- Criar schemas novos em: shared/schemas/{nomeModulo}.ts
- NÃO modificar shared/schema.ts (protegido)
- NÃO importar de @shared/schema (evitar referência circular)
- Usar varchar("user_id") SEM .references() para referências a tabelas do schema principal
- Importar diretamente: import { sql } from "drizzle-orm"; import { pgTable, ... } from "drizzle-orm/pg-core";
- Exportar: tabelas, insertSchemas (drizzle-zod), e types
- Prefixar tabelas com nome do módulo: bsc_objectives, fin_transactions, etc.

### Rotas (API)
- Criar rotas em: server/modules/{nomeModulo}.ts
- NÃO modificar server/routes.ts (protegido)
- Exportar default um Router do Express
- As rotas ficam automaticamente em /api/modules/{nomeModulo}
- Importar schemas do módulo: import { ... } from "@shared/schemas/{nomeModulo}"
- Importar db: import { db } from "../../db"

### Páginas (Frontend)
- Criar em: client/src/pages/{NomeModulo}.tsx
- Componentes em: client/src/components/{nomeModulo}/

## Formato de Saída (JSON)
{
  "moduleName": "nome-do-modulo",
  "description": "descrição completa",
  "schema": {
    "file": "shared/schemas/{moduleName}.ts",
    "tables": [{ "name": "tabela", "columns": [{ "name": "coluna", "type": "tipo", "constraints": [] }] }]
  },
  "api": {
    "file": "server/modules/{moduleName}.ts",
    "routes": [{ "method": "GET|POST|PUT|DELETE", "path": "/{rota}", "description": "descrição" }]
  },
  "ui": {
    "components": [{ "name": "Componente", "type": "page|modal|widget", "description": "desc", "path": "client/src/pages/{Nome}.tsx" }]
  },
  "integrations": ["módulos existentes que devem ser integrados"],
  "existingFiles": ["arquivos que precisam ser modificados"]
}`;

export class ArchitectAgent extends BaseBlackboardAgent {
  constructor() {
    const config: AgentConfig = {
      name: "architect",
      displayName: "Agente Arquiteto",
      description: "Analisa requisitos e cria especificações técnicas",
      systemPrompt: SYSTEM_PROMPT,
      capabilities: [
        "Análise de requisitos",
        "Leitura de código existente",
        "Design de schema de banco",
        "Definição de APIs REST",
        "Especificação de componentes UI"
      ],
      pollInterval: 2000
    };
    super(config);
  }

  canHandle(task: BlackboardTask): boolean {
    const context = task.context as any;
    return context?.phase === "design" || task.assignedAgent === "architect";
  }

  async process(task: BlackboardTask): Promise<void> {
    await this.log(task.id, "thinking", "Analisando projeto e requisitos...");

    const projectContext = await contextIndexer.getContextSummary();
    
    await this.log(task.id, "analyzing", "Consultando estrutura do projeto...");

    let relevantCode = "";
    const searchResult = await toolManager.execute("search_code", {
      query: task.title.split(" ").slice(0, 3).join("|"),
      maxResults: 10,
    });

    if (searchResult.success && searchResult.data?.results?.length > 0) {
      relevantCode = `\n\nCÓDIGO RELEVANTE ENCONTRADO:\n${searchResult.data.results.map((r: any) => `${r.file}:${r.line} - ${r.content}`).join("\n")}`;
    }

    const specPrompt = `TAREFA: ${task.title}

DESCRIÇÃO: ${task.description}

CONTEXTO DO PROJETO:
${projectContext}
${relevantCode}

Com base no contexto acima, crie uma especificação técnica completa em JSON seguindo o formato especificado.
Considere os módulos e schemas existentes para evitar duplicação.
Indique quais arquivos existentes precisam ser modificados.`;

    await this.log(task.id, "generating", "Criando especificação técnica...");

    const specContent = await this.generateWithAI(specPrompt);

    let parsedSpec: any;
    try {
      const jsonMatch = specContent.match(/\{[\s\S]*\}/);
      parsedSpec = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: specContent };
    } catch {
      parsedSpec = { raw: specContent, parseError: true };
    }

    await blackboardService.addArtifact(
      task.id,
      "spec",
      "specification.json",
      JSON.stringify(parsedSpec, null, 2),
      "architect",
      { version: 1, hasContext: true }
    );

    await blackboardService.addArtifact(
      task.id,
      "doc",
      "project-context.md",
      projectContext,
      "architect"
    );

    await this.log(task.id, "completed", "Especificação técnica criada com contexto do projeto");

    const mainTask = await blackboardService.getMainTask(task.id);
    if (mainTask) {
      await blackboardService.createSubtask(
        mainTask.id,
        "Gerar código",
        "Gerar código baseado na especificação do arquiteto",
        "generator",
        [task.id],
        { phase: "codegen" }
      );
    }

    await blackboardService.completeTask(task.id, "architect", { 
      spec: parsedSpec,
      hasProjectContext: true 
    });
  }
}

export const architectAgent = new ArchitectAgent();
