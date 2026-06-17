/**
 * Arcadia Suite - GitHub Commit Tool
 * 
 * Ferramenta para fazer commits automáticos no repositório.
 */

import { BaseTool, ToolParameter, ToolResult } from "../BaseTool";
import githubService from "../../../integrations/github/service";

export class GitHubCommitTool extends BaseTool {
  name = "github_commit";
  description = "Faz commit de arquivos para o repositório GitHub do Arcadia Suite";
  category = "GitHub";
  
  parameters: ToolParameter[] = [
    {
      name: "message",
      type: "string",
      description: "Mensagem do commit (seguir convenção conventional commits)",
      required: true,
    },
    {
      name: "files",
      type: "array",
      description: "Array de objetos com path e content dos arquivos a commitar",
      required: true,
    },
    {
      name: "branch",
      type: "string",
      description: "Branch de destino (padrão: main)",
      required: false,
      default: "main",
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { message, files, branch } = params;

    if (!Array.isArray(files) || files.length === 0) {
      return this.formatError("Nenhum arquivo fornecido para commit");
    }

    const result = await githubService.commitFiles(files, message, branch || "main");

    if (result.success) {
      return this.formatSuccess(
        `✅ Commit realizado: ${result.commitUrl}`,
        { files: files.length, commitSha: result.commitSha }
      );
    } else {
      return this.formatError(result.message);
    }
  }
}
