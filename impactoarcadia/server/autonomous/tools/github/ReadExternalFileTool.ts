/**
 * Arcadia Suite - Read External File Tool
 * 
 * Ferramenta para ler arquivos de repositórios externos.
 */

import { BaseTool, ToolParameter, ToolResult } from "../BaseTool";
import githubService from "../../../integrations/github/service";

export class ReadExternalFileTool extends BaseTool {
  name = "read_external_file";
  description = "Lê o conteúdo de um arquivo específico de um repositório GitHub externo";
  category = "GitHub";
  
  parameters: ToolParameter[] = [
    {
      name: "repoUrl",
      type: "string",
      description: "URL do repositório GitHub (ex: https://github.com/n8n-io/n8n)",
      required: true,
    },
    {
      name: "filePath",
      type: "string",
      description: "Caminho do arquivo dentro do repositório",
      required: true,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { repoUrl, filePath } = params;

    const result = await githubService.toolReadExternalFile(repoUrl, filePath);

    if (result.success) {
      return this.formatSuccess(result.result, { content: result.content });
    } else {
      return this.formatError(result.result);
    }
  }
}
