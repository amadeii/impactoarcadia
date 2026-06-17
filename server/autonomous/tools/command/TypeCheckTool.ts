/**
 * Arcadia Suite - TypeScript Check Tool
 */

import { BaseTool, type ToolParameter, type ToolResult } from "../BaseTool";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class TypeCheckTool extends BaseTool {
  name = "typecheck";
  description = "Executa verificação de tipos TypeScript no projeto";
  category = "Command";
  parameters: ToolParameter[] = [
    { name: "path", type: "string", description: "Arquivo ou diretório a verificar (opcional)", required: false },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const targetPath = params.path as string || "";

    try {
      const command = targetPath 
        ? `npx tsc --noEmit ${targetPath}` 
        : "npx tsc --noEmit";

      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 120000,
        maxBuffer: 2 * 1024 * 1024,
      });

      return this.formatSuccess("TypeScript: Sem erros de tipo", {
        success: true,
        errors: [],
        output: stdout,
      });
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      const errors = this.parseErrors(output);

      return this.formatSuccess(`TypeScript: ${errors.length} erro(s) encontrado(s)`, {
        success: false,
        errors,
        output: output.slice(0, 5000),
      });
    }
  }

  private parseErrors(output: string): any[] {
    const errors: any[] = [];
    const lines = output.split("\n");
    const errorRegex = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.+)$/;

    for (const line of lines) {
      const match = line.match(errorRegex);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          code: match[4],
          message: match[5],
        });
      }
    }

    return errors;
  }
}
