/**
 * Arcadia Suite - Search Code Tool
 */

import { BaseTool, type ToolParameter, type ToolResult } from "../BaseTool";
import * as fs from "fs/promises";
import * as path from "path";

const SEARCH_DIRS = ['client/src', 'server', 'shared'];
const SEARCH_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html'];
const BLOCKED_DIRS = ['node_modules', '.git', 'dist', 'build'];

export class SearchCodeTool extends BaseTool {
  name = "search_code";
  description = "Busca por texto ou padrão no código do projeto";
  category = "Filesystem";
  parameters: ToolParameter[] = [
    { name: "query", type: "string", description: "Texto ou regex a buscar", required: true },
    { name: "path", type: "string", description: "Diretório para buscar (opcional)", required: false },
    { name: "filePattern", type: "string", description: "Padrão de arquivo (ex: *.tsx)", required: false },
    { name: "maxResults", type: "number", description: "Máximo de resultados", required: false, default: 50 },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const query = (params.query || params.pattern || params.text || params.search) as string;
    const searchPath = params.path as string || "";
    const maxResults = params.maxResults as number || 50;

    try {
      const regex = new RegExp(query, "gi");
      const results: any[] = [];
      
      const dirsToSearch = searchPath ? [searchPath] : SEARCH_DIRS;

      for (const dir of dirsToSearch) {
        await this.searchInDir(path.resolve(process.cwd(), dir), regex, results, maxResults);
        if (results.length >= maxResults) break;
      }

      return this.formatSuccess(`Encontrados ${results.length} resultados para "${query}"`, {
        query,
        results: results.slice(0, maxResults),
        totalFound: results.length,
      });
    } catch (error: any) {
      return this.formatError(`Erro na busca: ${error.message}`);
    }
  }

  private async searchInDir(dirPath: string, regex: RegExp, results: any[], maxResults: number): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) return;
        if (BLOCKED_DIRS.includes(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.searchInDir(fullPath, regex, results, maxResults);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (!SEARCH_EXTENSIONS.includes(ext)) continue;

          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) return;
              
              if (regex.test(lines[i])) {
                results.push({
                  file: path.relative(process.cwd(), fullPath),
                  line: i + 1,
                  content: lines[i].trim().slice(0, 200),
                });
              }
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
}
