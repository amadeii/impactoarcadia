/**
 * Arcadia Suite - List Directory Tool
 */

import { BaseTool, type ToolParameter, type ToolResult } from "../BaseTool";
import * as fs from "fs/promises";
import * as path from "path";

const BLOCKED_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'vendor', '__pycache__'];

export class ListDirectoryTool extends BaseTool {
  name = "list_directory";
  description = "Lista arquivos e pastas de um diretório";
  category = "Filesystem";
  parameters: ToolParameter[] = [
    { name: "path", type: "string", description: "Caminho do diretório", required: true },
    { name: "recursive", type: "boolean", description: "Listar recursivamente", required: false, default: false },
    { name: "maxDepth", type: "number", description: "Profundidade máxima (se recursivo)", required: false, default: 3 },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const dirPath = params.path as string || ".";
    const recursive = params.recursive as boolean || false;
    const maxDepth = params.maxDepth as number || 3;

    try {
      const absolutePath = path.resolve(process.cwd(), dirPath);
      
      if (!absolutePath.startsWith(process.cwd())) {
        return this.formatError("Acesso fora do projeto não permitido");
      }

      const items = await this.listDir(absolutePath, recursive, maxDepth, 0);

      return this.formatSuccess(`Listados ${items.length} itens em ${dirPath}`, {
        path: dirPath,
        items,
        count: items.length,
      });
    } catch (error: any) {
      return this.formatError(`Erro ao listar diretório: ${error.message}`);
    }
  }

  private async listDir(dirPath: string, recursive: boolean, maxDepth: number, depth: number): Promise<any[]> {
    const items: any[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (BLOCKED_DIRS.includes(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

        const relativePath = path.relative(process.cwd(), path.join(dirPath, entry.name));
        
        if (entry.isDirectory()) {
          items.push({ name: entry.name, type: "directory", path: relativePath });
          
          if (recursive && depth < maxDepth) {
            const children = await this.listDir(
              path.join(dirPath, entry.name),
              recursive,
              maxDepth,
              depth + 1
            );
            items.push(...children);
          }
        } else {
          const stats = await fs.stat(path.join(dirPath, entry.name));
          items.push({
            name: entry.name,
            type: "file",
            path: relativePath,
            size: stats.size,
          });
        }
      }
    } catch (error) {
      // Ignore permission errors
    }

    return items;
  }
}
