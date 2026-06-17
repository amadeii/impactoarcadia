import { BaseTool, ToolDefinition, ToolResult } from "./BaseTool";
import { governanceService } from "../../governance/service";
import { db } from "../../../db/index";
import { xosToolRegistry } from "@shared/schema";
import { eq } from "drizzle-orm";

const WRITE_TOOLS = new Set([
  "write_file",
  "github_commit",
  "git_local_commit",
  "run_command",
]);

const READ_ONLY_TOOLS = new Set([
  "read_file",
  "list_directory",
  "search_code",
  "git_status",
  "analyze_external_repo",
  "read_external_file",
  "typecheck",
  "metaset.query",
  "metaset.list_tables",
  "metaset.table_fields",
  "metaset.list_questions",
  "metaset.list_dashboards",
  "metaset.health",
]);

interface PipelineContext {
  planMode: boolean;
  commandLog: Array<{ command: string; output: string; timestamp: string; success: boolean }>;
}

export class ToolManager {
  private tools: Map<string, BaseTool> = new Map();
  private categories: Map<string, string[]> = new Map();
  private governanceSynced: boolean = false;
  private _activePipelineId: number | null = null;
  private _pipelineContexts: Map<number, PipelineContext> = new Map();
  private _globalCommandLog: Array<{ command: string; output: string; timestamp: string; success: boolean; pipelineId?: number }> = [];

  private getPipelineContext(pipelineId?: number): PipelineContext | null {
    const id = pipelineId ?? this._activePipelineId;
    if (id === null) return null;
    if (!this._pipelineContexts.has(id)) {
      this._pipelineContexts.set(id, { planMode: false, commandLog: [] });
    }
    return this._pipelineContexts.get(id)!;
  }

  setActivePipeline(pipelineId: number | null): void {
    this._activePipelineId = pipelineId;
  }

  get activePipelineId(): number | null {
    return this._activePipelineId;
  }

  get planMode(): boolean {
    const ctx = this.getPipelineContext();
    return ctx?.planMode ?? false;
  }

  setPlanMode(enabled: boolean, pipelineId?: number): void {
    const id = pipelineId ?? this._activePipelineId;
    if (id !== null && id !== undefined) {
      const ctx = this.getPipelineContext(id);
      if (ctx) ctx.planMode = enabled;
    }
    console.log(`[ToolManager] Plan Mode pipeline=${id}: ${enabled ? "ATIVADO" : "DESATIVADO"}`);
  }

  isWriteTool(toolName: string): boolean {
    return WRITE_TOOLS.has(toolName);
  }

  getCommandLog(pipelineId?: number): typeof this._globalCommandLog {
    if (pipelineId !== undefined) {
      return this._globalCommandLog.filter(l => l.pipelineId === pipelineId);
    }
    return [...this._globalCommandLog];
  }

  clearCommandLog(pipelineId?: number): void {
    if (pipelineId !== undefined) {
      this._globalCommandLog = this._globalCommandLog.filter(l => l.pipelineId !== pipelineId);
    } else {
      this._globalCommandLog = [];
    }
  }

  addCommandLog(entry: { command: string; output: string; timestamp: string; success: boolean }): void {
    this._globalCommandLog.push({ ...entry, pipelineId: this._activePipelineId ?? undefined });
    if (this._globalCommandLog.length > 500) {
      this._globalCommandLog = this._globalCommandLog.slice(-250);
    }
  }

  cleanupPipeline(pipelineId: number): void {
    this._pipelineContexts.delete(pipelineId);
    this._globalCommandLog = this._globalCommandLog.filter(l => l.pipelineId !== pipelineId);
    if (this._activePipelineId === pipelineId) this._activePipelineId = null;
  }

  getToolsForMode(mode: "plan" | "act"): ToolDefinition[] {
    if (mode === "act") return this.listTools();
    return this.listTools().filter(t => !WRITE_TOOLS.has(t.name));
  }

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);

    const categoryTools = this.categories.get(tool.category) || [];
    categoryTools.push(tool.name);
    this.categories.set(tool.category, categoryTools);

    console.log(`[ToolManager] Ferramenta registrada: ${tool.name} (${tool.category})`);
  }

  async syncWithGovernance(): Promise<void> {
    if (this.governanceSynced) return;
    try {
      const toolDefs = this.listTools().map(t => ({
        name: t.name,
        description: t.description,
        category: t.name.split('.')[0] || 'general',
      }));
      await governanceService.syncToolsFromManager(toolDefs);
      this.governanceSynced = true;
    } catch (error) {
      console.error("[ToolManager] Erro ao sincronizar com governança:", error);
    }
  }

  unregister(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) return false;

    this.tools.delete(toolName);

    const categoryTools = this.categories.get(tool.category);
    if (categoryTools) {
      const index = categoryTools.indexOf(toolName);
      if (index > -1) {
        categoryTools.splice(index, 1);
      }
    }

    return true;
  }

  get(toolName: string): BaseTool | undefined {
    return this.tools.get(toolName);
  }

  private async checkRBAC(toolName: string, agentName: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const [toolRecord] = await db.select().from(xosToolRegistry)
        .where(eq(xosToolRegistry.name, toolName));

      if (!toolRecord) return { allowed: true };

      const allowedAgents = toolRecord.allowedAgents as string[] | null;
      if (!allowedAgents || allowedAgents.length === 0) return { allowed: true };

      if (allowedAgents.includes(agentName) || allowedAgents.includes("*")) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: `Agente "${agentName}" não tem permissão para usar "${toolName}". Agentes permitidos: ${allowedAgents.join(", ")}`,
      };
    } catch {
      return { allowed: true };
    }
  }

  async execute(toolName: string, params: Record<string, any>, agentName?: string): Promise<ToolResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        result: `Ferramenta não encontrada: ${toolName}`,
        error: `TOOL_NOT_FOUND: ${toolName}`,
      };
    }

    if (this.planMode && WRITE_TOOLS.has(toolName)) {
      return {
        success: false,
        result: `[PLAN MODE] Ferramenta "${toolName}" bloqueada. Em modo planejamento, apenas ferramentas de leitura são permitidas. Analise o código e gere um plano detalhado.`,
        error: `PLAN_MODE_BLOCKED: ${toolName}`,
      };
    }

    if (agentName) {
      const rbacCheck = await this.checkRBAC(toolName, agentName);
      if (!rbacCheck.allowed) {
        return {
          success: false,
          result: `RBAC: ${rbacCheck.reason}`,
          error: `RBAC_DENIED: ${toolName}`,
        };
      }

      const target = params.path || params.file || params.command || toolName;
      const policy = await governanceService.evaluatePolicy(agentName, toolName, target, params);
      if (!policy.allowed) {
        return {
          success: false,
          result: `Bloqueado pela governança: ${policy.reason}`,
          error: `GOVERNANCE_DENIED: ${policy.matchedPolicyName || 'unknown'}`,
        };
      }
    }

    // Normalize common param aliases before validation
    const normalizedParams = { ...params };
    if (toolName === "search_code") {
      if (!normalizedParams.query && (normalizedParams.pattern || normalizedParams.text || normalizedParams.search)) {
        normalizedParams.query = normalizedParams.pattern || normalizedParams.text || normalizedParams.search;
      }
    }

    const validation = tool.validateParams(normalizedParams);
    if (!validation.valid) {
      return {
        success: false,
        result: validation.error || "Parâmetros inválidos",
        error: validation.error,
      };
    }

    try {
      const startTime = Date.now();
      const result = await tool.execute(normalizedParams);
      const duration = Date.now() - startTime;

      console.log(`[ToolManager] ${toolName} executado em ${duration}ms`);

      if (toolName === "run_command" || toolName === "typecheck") {
        this.addCommandLog({
          command: params.command || toolName,
          output: result.result?.slice(0, 5000) || "",
          timestamp: new Date().toISOString(),
          success: result.success,
        });
      }

      if (agentName) {
        await governanceService.recordAudit({
          agentName,
          action: toolName,
          target: params.path || params.file || toolName,
          decision: result.success ? "executed" : "failed",
          justification: result.success ? `Executado com sucesso em ${duration}ms` : result.error,
          input: params,
          output: { success: result.success, duration },
        });
      }

      return result;
    } catch (error: any) {
      console.error(`[ToolManager] Erro ao executar ${toolName}:`, error);
      return {
        success: false,
        result: `Erro ao executar ferramenta: ${error.message}`,
        error: error.message,
      };
    }
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getDefinition());
  }

  listToolsByCategory(category: string): ToolDefinition[] {
    const toolNames = this.categories.get(category) || [];
    return toolNames
      .map((name) => this.tools.get(name)?.getDefinition())
      .filter((def): def is ToolDefinition => def !== undefined);
  }

  listCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  getToolsForPrompt(): string {
    const lines: string[] = [];
    lines.push("## Ferramentas Disponíveis\n");

    for (const category of this.listCategories()) {
      lines.push(`### ${category}\n`);
      
      const tools = this.listToolsByCategory(category);
      for (const tool of tools) {
        lines.push(`#### ${tool.name}`);
        lines.push(`${tool.description}\n`);
        lines.push("**Parâmetros:**");
        
        for (const param of tool.parameters) {
          const required = param.required ? "(obrigatório)" : "(opcional)";
          lines.push(`- \`${param.name}\` (${param.type}) ${required}: ${param.description}`);
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  getToolCount(): number {
    return this.tools.size;
  }
}

export const toolManager = new ToolManager();
