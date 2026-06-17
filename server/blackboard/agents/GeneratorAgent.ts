/**
 * Arcadia Suite - Generator Agent
 * 
 * Agente responsável por gerar código a partir de especificações.
 * Lê arquivos existentes para manter consistência.
 * 
 * @author Arcadia Development Team
 * @version 2.0.0
 */

import { BaseBlackboardAgent, type AgentConfig } from "../BaseBlackboardAgent";
import { blackboardService } from "../service";
import { type BlackboardTask } from "@shared/schema";
import { toolManager } from "../../autonomous/tools";

const SYSTEM_PROMPT = `Você é o Agente Gerador de Código do Arcadia Suite.

## Seu Papel
Você gera código TypeScript/React de alta qualidade baseado em especificações técnicas.
Você pode ler arquivos existentes para manter consistência de estilo.

## Stack do Arcadia Suite
- Backend: Node.js, Express, TypeScript
- Frontend: React 18, TypeScript, Tailwind CSS, shadcn/ui
- Banco: PostgreSQL com Drizzle ORM
- Autenticação: Passport.js com sessões
- Estado: TanStack Query (React Query)

## Padrões de Código
1. Sempre use TypeScript com tipos estritos
2. Use componentes funcionais com hooks
3. Siga o padrão existente de rotas Express
4. Use Drizzle ORM para queries
5. Use shadcn/ui para componentes de UI
6. Adicione data-testid em elementos interativos

## SISTEMA MODULAR (IMPORTANTE!)
O projeto usa um sistema modular. SEMPRE crie arquivos nas pastas modulares:

### Schemas de Banco → shared/schemas/{nomeModulo}.ts
- NÃO modificar shared/schema.ts (protegido!)
- NÃO importar de @shared/schema (referência circular!)
- Importar: import { sql } from "drizzle-orm"; import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb, numeric } from "drizzle-orm/pg-core";
- Importar: import { createInsertSchema } from "drizzle-zod"; import { z } from "zod";
- Para referências a users: usar varchar("user_id") SEM .references()
- Prefixar tabelas: bsc_objectives, fin_transactions, etc.
- Exportar: tabelas + insertSchemas + types

### Rotas de API → server/modules/{nomeModulo}.ts
- NÃO modificar server/routes.ts (protegido!)
- Exportar default um Router do Express
- Rotas montadas automaticamente em /api/modules/{nomeModulo}
- Import db: import { db } from "../../db";
- Import schemas: import { ... } from "@shared/schemas/{nomeModulo}";

### Páginas React → client/src/pages/{NomeModulo}.tsx

## Formato de Saída
Para cada arquivo, retorne JSON:
{
  "files": [
    {
      "path": "caminho/completo/arquivo.ts",
      "content": "código completo do arquivo",
      "type": "schema|route|component|hook|util",
      "action": "create|modify"
    }
  ]
}`;

export class GeneratorAgent extends BaseBlackboardAgent {
  constructor() {
    const config: AgentConfig = {
      name: "generator",
      displayName: "Agente Gerador de Código",
      description: "Gera código TypeScript/React a partir de especificações",
      systemPrompt: SYSTEM_PROMPT,
      capabilities: [
        "Geração de schemas Drizzle",
        "Criação de rotas Express",
        "Componentes React/TypeScript",
        "Leitura de código existente",
        "Manutenção de consistência"
      ],
      pollInterval: 2000
    };
    super(config);
  }

  canHandle(task: BlackboardTask): boolean {
    const context = task.context as any;
    return context?.phase === "codegen" || task.assignedAgent === "generator";
  }

  async process(task: BlackboardTask): Promise<void> {
    await this.log(task.id, "thinking", "Buscando especificação e contexto...");

    const specArtifact = await blackboardService.getLatestArtifact(task.id, "spec");
    const contextArtifact = await blackboardService.getLatestArtifact(task.id, "doc");

    if (!specArtifact) {
      await blackboardService.failTask(task.id, "generator", "Especificação não encontrada");
      return;
    }

    let spec: any;
    try {
      spec = JSON.parse(specArtifact.content || "{}");
    } catch {
      spec = { raw: specArtifact.content };
    }

    await this.log(task.id, "reading", "Lendo arquivos de referência...");

    let schemaRef = "";
    const schemaResult = await toolManager.execute("read_file", { path: "shared/schema.ts", startLine: 1, endLine: 100 });
    if (schemaResult.success) {
      schemaRef = `\nREFERÊNCIA - shared/schema.ts (primeiras 100 linhas):\n\`\`\`typescript\n${schemaResult.data?.content?.slice(0, 2000)}\n\`\`\``;
    }

    let routesRef = "";
    const routesResult = await toolManager.execute("read_file", { path: "server/routes.ts", startLine: 1, endLine: 50 });
    if (routesResult.success) {
      routesRef = `\nREFERÊNCIA - server/routes.ts (primeiras 50 linhas):\n\`\`\`typescript\n${routesResult.data?.content?.slice(0, 1500)}\n\`\`\``;
    }

    await this.log(task.id, "generating", "Gerando código baseado na especificação...");

    const prompt = `Com base nesta especificação, gere o código completo:

ESPECIFICAÇÃO:
${JSON.stringify(spec, null, 2)}

CONTEXTO DO PROJETO:
${contextArtifact?.content?.slice(0, 2000) || "Não disponível"}

${schemaRef}
${routesRef}

Gere arquivos completos e funcionais para:
1. Schema do banco (se necessário) - CRIAR em shared/schemas/{moduleName}.ts (NÃO editar schema.ts!)
2. Rotas da API - CRIAR em server/modules/{moduleName}.ts (NÃO editar routes.ts!)
3. Componente principal React - em client/src/pages/

Retorne em formato JSON com a estrutura:
{
  "files": [
    { "path": "caminho/completo.ts", "content": "código completo", "type": "tipo", "action": "create|modify" }
  ]
}

IMPORTANTE: Gere código completo e funcional, não use placeholders ou "// TODO".`;

    try {
      const response = await this.generateWithAI(prompt);

      let files: any[] = [];
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          files = parsed.files || [];
        }
      } catch {
        files = [{
          path: `server/modules/${spec.moduleName || "generated"}/index.ts`,
          content: response,
          type: "module",
          action: "create"
        }];
      }

      for (const file of files) {
        await blackboardService.addArtifact(
          task.id,
          "code",
          file.path,
          file.content,
          "generator",
          { type: file.type, action: file.action }
        );
      }

      await this.log(task.id, "completed", `Gerados ${files.length} arquivos`);

      const mainTask = await blackboardService.getMainTask(task.id);
      if (mainTask) {
        await blackboardService.createSubtask(
          mainTask.id,
          "Validar código",
          "Validar e testar o código gerado",
          "validator",
          [task.id],
          { phase: "validation" }
        );
      }

      await blackboardService.completeTask(task.id, "generator", {
        filesGenerated: files.length,
        files: files.map(f => ({ path: f.path, type: f.type, action: f.action })),
      });
    } catch (error: any) {
      await blackboardService.failTask(task.id, "generator", error.message);
    }
  }
}

export const generatorAgent = new GeneratorAgent();
