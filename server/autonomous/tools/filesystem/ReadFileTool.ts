/**
 * Arcadia Suite - Read File Tool
 */

import { BaseTool, type ToolParameter, type ToolResult } from "../BaseTool";
import * as fs from "fs/promises";
import * as path from "path";

const ALLOWED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.sql', '.py', '.php'];
const BLOCKED_PATHS = ['node_modules', '.git', 'dist', 'build', '.next', 'vendor'];

export class ReadFileTool extends BaseTool {
  name = "read_file";
  description = "Lê o conteúdo de um arquivo do projeto";
  category = "Filesystem";
  parameters: ToolParameter[] = [
    { name: "path", type: "string", description: "Caminho do arquivo relativo à raiz do projeto", required: true },
    { name: "startLine", type: "number", description: "Linha inicial (opcional)", required: false },
    { name: "endLine", type: "number", description: "Linha final (opcional)", required: false },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const filePath = params.path as string;
    const startLine = params.startLine as number | undefined;
    const endLine = params.endLine as number | undefined;

    if (BLOCKED_PATHS.some(blocked => filePath.includes(blocked))) {
      return this.formatError(`Acesso negado ao caminho: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return this.formatError(`Extensão não permitida: ${ext}`);
    }

    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      
      if (!absolutePath.startsWith(process.cwd())) {
        return this.formatError("Tentativa de acesso fora do projeto");
      }

      const content = await fs.readFile(absolutePath, "utf-8");
      const lines = content.split("\n");

      let result = lines;
      if (startLine !== undefined && endLine !== undefined) {
        result = lines.slice(startLine - 1, endLine);
      } else if (startLine !== undefined) {
        result = lines.slice(startLine - 1);
      }

      return this.formatSuccess(`Arquivo lido: ${filePath} (${result.length} linhas)`, {
        path: filePath,
        content: result.join("\n"),
        totalLines: lines.length,
        linesReturned: result.length,
      });
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return this.formatError(`Arquivo não encontrado: ${filePath}`);
      }
      return this.formatError(`Erro ao ler arquivo: ${error.message}`);
    }
  }
}
