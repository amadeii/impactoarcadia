/**
 * Arcadia Suite - Code Generator Agent
 * 
 * Agente Gerador de Código: Responsável por gerar código TypeScript/React
 * com base nas especificações do Agente Arquiteto.
 * 
 * @author Arcadia Development Team
 * @version 1.0.0
 */

import { BaseAgent, AgentConfig, ThoughtActionObservation } from "./BaseAgent";
import { ModuleSpec } from "./ArchitectAgent";

const CODEGEN_PROMPT = `Você é o Agente Gerador de Código do Arcadia Suite.

## Seu Papel
Você transforma especificações técnicas em código funcional.
Você segue os padrões de código do Arcadia Suite.

## Padrões de Código
- Backend: Express.js + TypeScript + Drizzle ORM
- Frontend: React + TypeScript + Tailwind + shadcn/ui
- Banco: PostgreSQL
- Estrutura: server/modules/{nome}/ e client/src/pages/{Nome}.tsx

## Suas Responsabilidades
1. Gerar schema Drizzle para o banco de dados
2. Gerar rotas Express com CRUD completo
3. Gerar componentes React com UI moderna
4. Seguir convenções de código existentes`;

export interface GeneratedFile {
  path: string;
  content: string;
  type: "schema" | "routes" | "service" | "component" | "page";
}

export interface CodeGenResult {
  files: GeneratedFile[];
  summary: string;
}

export class CodeGeneratorAgent extends BaseAgent {
  private generatedFiles: GeneratedFile[] = [];
  private spec: ModuleSpec | null = null;

  constructor() {
    const config: AgentConfig = {
      name: "CodeGenerator",
      role: "Geração de Código",
      systemPrompt: CODEGEN_PROMPT,
      maxIterations: 3,
      tools: ["github_commit", "read_external_file"]
    };
    super(config);
  }

  async think(input: string, context?: { spec: ModuleSpec }): Promise<ThoughtActionObservation> {
    if (context?.spec) {
      this.spec = context.spec;
    }

    if (this.history.length === 0) {
      return {
        thought: `Recebi a especificação do módulo '${this.spec?.moduleName}'. Vou gerar o código.`,
      };
    }

    return {
      thought: "Código gerado com sucesso.",
    };
  }

  async generateOutput(): Promise<string> {
    if (!this.spec) {
      return JSON.stringify({ error: "Nenhuma especificação fornecida" });
    }

    this.generatedFiles = [];

    this.generateSchema();
    this.generateRoutes();
    this.generateService();
    this.generatePage();

    const result: CodeGenResult = {
      files: this.generatedFiles,
      summary: `Gerados ${this.generatedFiles.length} arquivos para o módulo '${this.spec.moduleName}'`
    };

    return JSON.stringify(result, null, 2);
  }

  private generateSchema(): void {
    if (!this.spec) return;

    const tableName = this.spec.schema.tables[0]?.name || `arc_${this.spec.moduleName}`;
    const columns = this.spec.schema.tables[0]?.columns || [];

    const columnDefs = columns.map(col => {
      let def = `  ${col.name}: `;
      switch (col.type) {
        case "serial": def += `serial("${col.name}")`;break;
        case "text": def += `text("${col.name}")`; break;
        case "timestamp": def += `timestamp("${col.name}")`; break;
        case "integer": def += `integer("${col.name}")`; break;
        case "boolean": def += `boolean("${col.name}")`; break;
        default: def += `text("${col.name}")`;
      }
      if (col.constraints?.includes("PRIMARY KEY")) def += ".primaryKey()";
      if (col.constraints?.includes("NOT NULL")) def += ".notNull()";
      if (col.constraints?.some(c => c.startsWith("DEFAULT"))) {
        const defaultVal = col.constraints.find(c => c.startsWith("DEFAULT"))?.replace("DEFAULT ", "");
        if (defaultVal === "NOW()") def += ".defaultNow()";
        else if (defaultVal) def += `.default("${defaultVal.replace(/'/g, "")}")`;
      }
      return def;
    }).join(",\n");

    const content = `import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ${tableName} = pgTable("${tableName}", {
${columnDefs}
});

export const insert${this.capitalize(this.spec.moduleName)}Schema = createInsertSchema(${tableName}).omit({ id: true, created_at: true, updated_at: true });
export type Insert${this.capitalize(this.spec.moduleName)} = z.infer<typeof insert${this.capitalize(this.spec.moduleName)}Schema>;
export type ${this.capitalize(this.spec.moduleName)} = typeof ${tableName}.$inferSelect;
`;

    this.generatedFiles.push({
      path: `shared/modules/${this.spec.moduleName}/schema.ts`,
      content,
      type: "schema"
    });
  }

  private generateRoutes(): void {
    if (!this.spec) return;

    const content = `import { Router, Request, Response } from "express";
import { ${this.spec.moduleName}Service } from "./service";

const router = Router();
const service = new ${this.capitalize(this.spec.moduleName)}Service();

router.get("/", async (req: Request, res: Response) => {
  try {
    const items = await service.findAll();
    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const item = await service.findById(parseInt(req.params.id));
    if (!item) {
      return res.status(404).json({ success: false, error: "Não encontrado" });
    }
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const item = await service.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const item = await service.update(parseInt(req.params.id), req.body);
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await service.delete(parseInt(req.params.id));
    res.json({ success: true, message: "Removido com sucesso" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
`;

    this.generatedFiles.push({
      path: `server/modules/${this.spec.moduleName}/routes.ts`,
      content,
      type: "routes"
    });
  }

  private generateService(): void {
    if (!this.spec) return;

    const tableName = this.spec.schema.tables[0]?.name || `arc_${this.spec.moduleName}`;

    const content = `import { db } from "../../db";
import { ${tableName} } from "../../../shared/modules/${this.spec.moduleName}/schema";
import { eq } from "drizzle-orm";

export class ${this.capitalize(this.spec.moduleName)}Service {
  async findAll() {
    return db.select().from(${tableName});
  }

  async findById(id: number) {
    const results = await db.select().from(${tableName}).where(eq(${tableName}.id, id));
    return results[0] || null;
  }

  async create(data: any) {
    const results = await db.insert(${tableName}).values(data).returning();
    return results[0];
  }

  async update(id: number, data: any) {
    const results = await db.update(${tableName}).set(data).where(eq(${tableName}.id, id)).returning();
    return results[0];
  }

  async delete(id: number) {
    await db.delete(${tableName}).where(eq(${tableName}.id, id));
  }
}
`;

    this.generatedFiles.push({
      path: `server/modules/${this.spec.moduleName}/service.ts`,
      content,
      type: "service"
    });
  }

  private generatePage(): void {
    if (!this.spec) return;

    const componentName = this.capitalize(this.spec.moduleName);

    const content = `import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2 } from "lucide-react";

export default function ${componentName}Page() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/${this.spec.moduleName}"],
    queryFn: async () => {
      const res = await fetch("/api/${this.spec.moduleName}", { credentials: "include" });
      return res.json();
    }
  });

  return (
    <BrowserFrame>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">${componentName}</h1>
          <Button data-testid="button-create">
            <Plus className="w-4 h-4 mr-2" /> Novo
          </Button>
        </div>

        <Input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="input-search"
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.data?.map((item: any) => (
              <Card key={item.id} data-testid={\`card-item-\${item.id}\`}>
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.status}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </BrowserFrame>
  );
}
`;

    this.generatedFiles.push({
      path: `client/src/pages/${componentName}Module.tsx`,
      content,
      type: "page"
    });
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getGeneratedFiles(): GeneratedFile[] {
    return this.generatedFiles;
  }
}
