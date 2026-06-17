/**
 * Arcadia Suite - Run Command Tool
 */

import { BaseTool, type ToolParameter, type ToolResult } from "../BaseTool";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const ALLOWED_COMMANDS = [
  'npm run',
  'npx',
  'tsc',
  'node',
  'git status',
  'git diff',
  'git log',
  'git add',
  'git commit',
  'ls',
  'cat',
  'head',
  'tail',
  'grep',
  'find',
  'wc',
];

const BLOCKED_COMMANDS = ['rm', 'rmdir', 'mv', 'cp', 'chmod', 'chown', 'sudo', 'curl', 'wget', 'ssh'];

export class RunCommandTool extends BaseTool {
  name = "run_command";
  description = "Executa um comando shell seguro no projeto";
  category = "Command";
  parameters: ToolParameter[] = [
    { name: "command", type: "string", description: "Comando a executar", required: true },
    { name: "timeout", type: "number", description: "Timeout em ms (máx 60000)", required: false, default: 30000 },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const command = params.command as string;
    const timeout = Math.min(params.timeout as number || 30000, 60000);

    const isAllowed = ALLOWED_COMMANDS.some(allowed => command.startsWith(allowed));
    if (!isAllowed) {
      return this.formatError(`Comando não permitido. Comandos permitidos: ${ALLOWED_COMMANDS.join(", ")}`);
    }

    const isBlocked = BLOCKED_COMMANDS.some(blocked => command.includes(blocked));
    if (isBlocked) {
      return this.formatError("Comando bloqueado por segurança");
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout,
        maxBuffer: 1024 * 1024,
      });

      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : "");

      return this.formatSuccess(`Comando executado: ${command}`, {
        command,
        output: output.slice(0, 10000),
        truncated: output.length > 10000,
      });
    } catch (error: any) {
      if (error.killed) {
        return this.formatError(`Comando excedeu o timeout de ${timeout}ms`);
      }
      return this.formatError(`Erro: ${error.message}\n${error.stderr || ""}`);
    }
  }
}
