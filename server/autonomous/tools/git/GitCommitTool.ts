/**
 * Arcadia Suite - Git Commit Tool
 */

import { BaseTool, type ToolParameter, type ToolResult } from "../BaseTool";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class GitCommitTool extends BaseTool {
  name = "git_local_commit";
  description = "Faz commit de alterações no repositório local";
  category = "Git";
  parameters: ToolParameter[] = [
    { name: "message", type: "string", description: "Mensagem do commit", required: true },
    { name: "files", type: "array", description: "Arquivos a adicionar (ou 'all' para todos)", required: false },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const message = params.message as string;
    const files = params.files as string[] | undefined;

    if (!message || message.length < 5) {
      return this.formatError("Mensagem de commit deve ter pelo menos 5 caracteres");
    }

    try {
      if (files && files.length > 0 && files[0] !== "all") {
        for (const file of files) {
          await execAsync(`git add "${file}"`, { cwd: process.cwd() });
        }
      } else {
        await execAsync("git add -A", { cwd: process.cwd() });
      }

      const { stdout: status } = await execAsync("git status --porcelain", { cwd: process.cwd() });
      const stagedFiles = status.split("\n").filter(Boolean);

      if (stagedFiles.length === 0) {
        return this.formatSuccess("Nenhuma alteração para commit", {
          committed: false,
          reason: "no_changes",
        });
      }

      const { stdout: commitOutput } = await execAsync(
        `git commit -m "${message.replace(/"/g, '\\"')}"`,
        { cwd: process.cwd() }
      );

      const commitMatch = commitOutput.match(/\[([^\]]+)\s+([a-f0-9]+)\]/);
      const commitHash = commitMatch ? commitMatch[2] : "unknown";
      const branch = commitMatch ? commitMatch[1] : "unknown";

      return this.formatSuccess(`Commit criado: ${commitHash}`, {
        committed: true,
        hash: commitHash,
        branch,
        message,
        filesCount: stagedFiles.length,
      });
    } catch (error: any) {
      return this.formatError(`Erro no commit: ${error.message}`);
    }
  }
}
