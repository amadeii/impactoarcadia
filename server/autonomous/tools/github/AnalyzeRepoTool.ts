/**
 * Arcadia Suite - Analyze External Repository Tool
 * 
 * Ferramenta para analisar repositórios externos e extrair estrutura.
 */

import { BaseTool, ToolParameter, ToolResult } from "../BaseTool";
import githubService from "../../../integrations/github/service";

export class AnalyzeRepoTool extends BaseTool {
  name = "analyze_external_repo";
  description = "Analisa a estrutura de um repositório GitHub externo para inspiração e implementação";
  category = "GitHub";
  
  parameters: ToolParameter[] = [
    {
      name: "repoUrl",
      type: "string",
      description: "URL do repositório GitHub (ex: https://github.com/n8n-io/n8n)",
      required: true,
    },
    {
      name: "focusPaths",
      type: "array",
      description: "Caminhos específicos para focar a análise (ex: ['packages/core/src'])",
      required: false,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { repoUrl, focusPaths } = params;

    const result = await githubService.toolAnalyzeExternalRepo(repoUrl, focusPaths);

    if (result.success) {
      return this.formatSuccess(result.result, result.data);
    } else {
      return this.formatError(result.result);
    }
  }
}
