/**
 * Arcadia Suite - Git Status Tool
 */

import { BaseTool, type ToolParameter, type ToolResult } from "../BaseTool";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class GitStatusTool extends BaseTool {
  name = "git_status";
  description = "Mostra o status atual do repositório Git";
  category = "Git";
  parameters: ToolParameter[] = [];

  async execute(_params: Record<string, any>): Promise<ToolResult> {
    try {
      const { stdout: status } = await execAsync("git status --porcelain", {
        cwd: process.cwd(),
        timeout: 10000,
      });

      const { stdout: branch } = await execAsync("git branch --show-current", {
        cwd: process.cwd(),
        timeout: 5000,
      });

      const files = status.split("\n").filter(Boolean).map(line => ({
        status: line.substring(0, 2).trim(),
        file: line.substring(3),
      }));

      const staged = files.filter(f => ['A', 'M', 'D', 'R'].includes(f.status[0]));
      const unstaged = files.filter(f => ['M', 'D', '?'].includes(f.status[1] || f.status[0]));

      return this.formatSuccess(`Branch: ${branch.trim()}, ${files.length} arquivos alterados`, {
        branch: branch.trim(),
        staged: staged.length,
        unstaged: unstaged.length,
        files,
      });
    } catch (error: any) {
      return this.formatError(`Erro ao obter status: ${error.message}`);
    }
  }
}
