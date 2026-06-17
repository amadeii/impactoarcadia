/**
 * Arcadia Suite - Tools Registry
 * 
 * Registro central de todas as ferramentas disponíveis para os agentes.
 */

import { toolManager } from "./ToolManager";
import { GitHubCommitTool, AnalyzeRepoTool, ReadExternalFileTool } from "./github";
import { ReadFileTool, WriteFileTool, ListDirectoryTool, SearchCodeTool } from "./filesystem";
import { RunCommandTool, TypeCheckTool } from "./command";
import { GitStatusTool, GitCommitTool } from "./git";
import {
  MetaSetQueryTool,
  MetaSetListTablesTool,
  MetaSetTableFieldsTool,
  MetaSetCreateQuestionTool,
  MetaSetRunQuestionTool,
  MetaSetListQuestionsTool,
  MetaSetCreateDashboardTool,
  MetaSetListDashboardsTool,
  MetaSetAddToDashboardTool,
  MetaSetSuggestAnalysisTool,
  MetaSetSyncTool,
  MetaSetHealthTool,
} from "./metaset";

export async function registerAllTools(): Promise<void> {
  console.log("[Tools] Registrando ferramentas...");

  toolManager.register(new GitHubCommitTool());
  toolManager.register(new AnalyzeRepoTool());
  toolManager.register(new ReadExternalFileTool());

  toolManager.register(new ReadFileTool());
  toolManager.register(new WriteFileTool());
  toolManager.register(new ListDirectoryTool());
  toolManager.register(new SearchCodeTool());

  toolManager.register(new RunCommandTool());
  toolManager.register(new TypeCheckTool());

  toolManager.register(new GitStatusTool());
  toolManager.register(new GitCommitTool());

  toolManager.register(new MetaSetQueryTool());
  toolManager.register(new MetaSetListTablesTool());
  toolManager.register(new MetaSetTableFieldsTool());
  toolManager.register(new MetaSetCreateQuestionTool());
  toolManager.register(new MetaSetRunQuestionTool());
  toolManager.register(new MetaSetListQuestionsTool());
  toolManager.register(new MetaSetCreateDashboardTool());
  toolManager.register(new MetaSetListDashboardsTool());
  toolManager.register(new MetaSetAddToDashboardTool());
  toolManager.register(new MetaSetSuggestAnalysisTool());
  toolManager.register(new MetaSetSyncTool());
  toolManager.register(new MetaSetHealthTool());

  console.log(`[Tools] ${toolManager.getToolCount()} ferramentas registradas.`);

  await toolManager.syncWithGovernance();
}

export { toolManager, ToolManager } from "./ToolManager";
export { BaseTool } from "./BaseTool";
export type { ToolParameter, ToolResult, ToolDefinition } from "./BaseTool";
