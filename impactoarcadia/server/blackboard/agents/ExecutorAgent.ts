/**
 * Arcadia Suite - Executor Agent
 * 
 * Agente responsável por preparar código para staging (preview).
 * NÃO aplica código diretamente - envia para área de staging
 * onde o usuário pode revisar e aprovar antes de publicar.
 * 
 * @author Arcadia Development Team
 * @version 3.0.0 - Staging Flow
 */

import { BaseBlackboardAgent, type AgentConfig } from "../BaseBlackboardAgent";
import { blackboardService } from "../service";
import { type BlackboardTask } from "@shared/schema";

const SYSTEM_PROMPT = `Você é o Agente Executor do Arcadia Suite.

## Seu Papel
Você prepara código validado para staging (preview), onde o usuário pode revisar antes de publicar.

## Processo de Staging
1. Verificar se validação passou
2. Validar caminhos dos arquivos
3. Marcar tarefa como "staged" (pronta para preview)
4. Aguardar aprovação do usuário para publicar

## IMPORTANTE
- NÃO aplique código diretamente ao projeto
- O código vai para STAGING primeiro
- O usuário decide quando publicar`;

const PROTECTED_FILES = [
  "server/routes.ts",
  "server/index.ts",
  "server/storage.ts",
  "server/db.ts",
  "shared/schema.ts",
  "shared/schemas/index.ts",
  "shared/schemas/loader.ts",
  "server/modules/loader.ts",
  "client/src/App.tsx",
  "client/src/main.tsx",
  "client/src/pages/Cockpit.tsx",
  "client/src/pages/Agent.tsx",
  "client/src/pages/ProcessCompass.tsx",
  "client/src/pages/DevCenter.tsx",
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "drizzle.config.ts",
  "db/index.ts",
];

const ALLOWED_MODULE_DIRS = [
  "shared/schemas/",
  "server/modules/",
];

export function isModuleFile(filePath: string): boolean {
  return ALLOWED_MODULE_DIRS.some(dir => filePath.startsWith(dir)) &&
         !PROTECTED_FILES.includes(filePath) &&
         !filePath.startsWith("shared/schemas/_") &&
         !filePath.startsWith("server/modules/_");
}

export class ExecutorAgent extends BaseBlackboardAgent {
  constructor() {
    const config: AgentConfig = {
      name: "executor",
      displayName: "Agente Executor",
      description: "Prepara código para staging e publicação",
      systemPrompt: SYSTEM_PROMPT,
      capabilities: [
        "Preparar código para staging",
        "Validar caminhos de arquivos",
        "Bloquear arquivos protegidos",
        "Preparar para publicação"
      ],
      pollInterval: 2000
    };
    super(config);
  }

  canHandle(task: BlackboardTask): boolean {
    const context = task.context as any;
    return context?.phase === "deploy" || task.assignedAgent === "executor";
  }

  async process(task: BlackboardTask): Promise<void> {
    await this.log(task.id, "thinking", "Preparando para staging...");

    const codeArtifacts = await blackboardService.getArtifactsForTask(task.id, "code");
    
    const allDocs = await blackboardService.getArtifactsForTask(task.id, "doc");
    const validationArtifact = allDocs.find(a => a.name === "validation-report.json");

    if (codeArtifacts.length === 0) {
      await blackboardService.failTask(task.id, "executor", "Nenhum código para aplicar");
      return;
    }

    let validation: any = { valid: false, score: 0 };
    if (validationArtifact?.content) {
      try {
        validation = JSON.parse(validationArtifact.content);
      } catch {}
    }

    if (!validation.valid || validation.score < 60) {
      await this.log(task.id, "blocked", `Validação falhou (score: ${validation.score}, valid: ${validation.valid})`);
      await blackboardService.failTask(task.id, "executor", `Código não aprovado (score: ${validation.score}) - staging bloqueado`);
      return;
    }

    await this.log(task.id, "executing", `Preparando ${codeArtifacts.length} arquivos para staging...`);

    const stagedFiles: string[] = [];
    const blockedFiles: string[] = [];
    const errors: string[] = [];

    for (const artifact of codeArtifacts) {
      const filePath = artifact.name;
      const content = artifact.content;

      if (!content) {
        errors.push(`${filePath}: conteúdo vazio`);
        continue;
      }

      if (PROTECTED_FILES.includes(filePath)) {
        blockedFiles.push(filePath);
        await this.log(task.id, "blocked", `Arquivo protegido: ${filePath} - não será incluído no staging`);
        continue;
      }

      const isValidPath = filePath.startsWith("client/src") || 
                          filePath.startsWith("server/") || 
                          filePath.startsWith("shared/");

      if (!isValidPath) {
        await this.log(task.id, "skipped", `Arquivo fora dos diretórios permitidos: ${filePath}`);
        continue;
      }

      stagedFiles.push(filePath);
    }

    if (stagedFiles.length === 0) {
      await blackboardService.failTask(task.id, "executor", `Nenhum arquivo válido para staging. Bloqueados: ${blockedFiles.join(", ")}. Erros: ${errors.join("; ")}`);
      return;
    }

    const mainTask = await blackboardService.getMainTask(task.id);

    const stagingReport = {
      action: "staging",
      status: "awaiting_approval",
      stagedFiles,
      blockedFiles,
      errors: errors.length > 0 ? errors : undefined,
      validationScore: validation.score,
      taskId: task.id,
      mainTaskId: mainTask?.id,
      title: mainTask?.title || task.title,
      stagedAt: new Date().toISOString(),
    };

    await blackboardService.addArtifact(
      task.id,
      "doc",
      "staging-report.json",
      JSON.stringify(stagingReport, null, 2),
      "executor"
    );

    await this.log(task.id, "completed", `Staging pronto: ${stagedFiles.length} arquivos aguardando aprovação no Preview`);

    if (mainTask) {
      await blackboardService.createSubtask(
        mainTask.id,
        "Registrar aprendizado",
        "Armazenar padrões aprendidos para evolução",
        "evolution",
        [task.id],
        { phase: "evolution" }
      );
    }

    await blackboardService.completeTask(task.id, "executor", stagingReport);
  }
}

export { PROTECTED_FILES };
export const executorAgent = new ExecutorAgent();
