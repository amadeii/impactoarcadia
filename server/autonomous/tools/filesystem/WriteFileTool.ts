/**
 * Arcadia Suite - Write File Tool
 * Usa guardrails do BlackboardService para validação
 */

import { BaseTool, type ToolParameter, type ToolResult } from "../BaseTool";
import * as fs from "fs/promises";
import * as path from "path";
import { blackboardService } from "../../../blackboard/service";

const BLOCKED_FILES = ['package.json', 'package-lock.json', '.env', 'drizzle.config.ts'];

// Arquivos críticos que NÃO podem ser sobrescritos pelos agentes
const PROTECTED_PATHS = [
  'server/routes.ts',
  'shared/schema.ts', 
  'shared/schemas/index.ts',
  'shared/schemas/loader.ts',
  'server/modules/loader.ts',
  'client/src/App.tsx',
  'client/src/main.tsx',
  'server/index.ts',
  'server/storage.ts',
  'db/index.ts',
];

const ALLOWED_MODULE_DIRS = [
  'shared/schemas/',
  'server/modules/',
];

export class WriteFileTool extends BaseTool {
  name = "write_file";
  description = "Escreve ou cria um arquivo no projeto";
  category = "Filesystem";
  parameters: ToolParameter[] = [
    { name: "path", type: "string", description: "Caminho do arquivo relativo à raiz", required: true },
    { name: "content", type: "string", description: "Conteúdo a ser escrito", required: true },
    { name: "createDirs", type: "boolean", description: "Criar diretórios se não existirem", required: false, default: true },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const filePath = params.path as string;
    const content = params.content as string;
    const createDirs = params.createDirs !== false;

    // Usar guardrails do BlackboardService para validação de path
    const pathValidation = blackboardService.validateFilePath(filePath);
    if (!pathValidation.valid) {
      return this.formatError(`Path inválido: ${pathValidation.error}`);
    }

    // Usar guardrails do BlackboardService para validação de conteúdo
    const contentValidation = blackboardService.validateContent(content);
    if (!contentValidation.valid) {
      return this.formatError(`Conteúdo inválido: ${contentValidation.error}`);
    }

    const fileName = path.basename(filePath);
    if (BLOCKED_FILES.includes(fileName)) {
      return this.formatError(`Arquivo protegido: ${fileName}`);
    }

    if (PROTECTED_PATHS.includes(filePath)) {
      return this.formatError(`Arquivo crítico protegido - não pode ser sobrescrito: ${filePath}`);
    }

    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      
      if (!absolutePath.startsWith(process.cwd())) {
        return this.formatError("Tentativa de escrita fora do projeto");
      }

      if (createDirs) {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      }

      const existed = await fs.access(absolutePath).then(() => true).catch(() => false);
      
      await fs.writeFile(absolutePath, content, "utf-8");

      return this.formatSuccess(
        existed ? `Arquivo atualizado: ${filePath}` : `Arquivo criado: ${filePath}`,
        {
          path: filePath,
          action: existed ? "updated" : "created",
          size: content.length,
        }
      );
    } catch (error: any) {
      return this.formatError(`Erro ao escrever arquivo: ${error.message}`);
    }
  }
}
