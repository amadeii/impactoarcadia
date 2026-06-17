/**
 * Arcadia Suite - Orchestrator Agent
 * 
 * Orquestrador: Coordena o fluxo de trabalho entre todos os agentes,
 * gerenciando o pipeline de desenvolvimento autônomo.
 * 
 * @author Arcadia Development Team
 * @version 1.0.0
 */

import { ArchitectAgent, ModuleSpec } from "./ArchitectAgent";
import { CodeGeneratorAgent, GeneratedFile, CodeGenResult } from "./CodeGeneratorAgent";
import { ValidationAgent, ValidationReport } from "./ValidationAgent";
import { toolManager } from "../tools";

export interface DevelopmentRequest {
  description: string;
  autoCommit?: boolean;
  targetBranch?: string;
}

export interface DevelopmentResult {
  success: boolean;
  phase: "design" | "codegen" | "validation" | "commit" | "complete";
  spec?: ModuleSpec;
  files?: GeneratedFile[];
  validation?: ValidationReport | null;
  commitUrl?: string;
  error?: string;
  log: string[];
}

export class OrchestratorAgent {
  private architect: ArchitectAgent;
  private codeGenerator: CodeGeneratorAgent;
  private validator: ValidationAgent;
  private log: string[] = [];

  constructor() {
    this.architect = new ArchitectAgent();
    this.codeGenerator = new CodeGeneratorAgent();
    this.validator = new ValidationAgent();
  }

  private addLog(message: string): void {
    const timestamp = new Date().toISOString();
    this.log.push(`[${timestamp}] ${message}`);
    console.log(`[Orchestrator] ${message}`);
  }

  async develop(request: DevelopmentRequest): Promise<DevelopmentResult> {
    this.log = [];
    this.addLog(`Iniciando desenvolvimento: "${request.description}"`);

    try {
      this.addLog("Fase 1: Design (Agente Arquiteto)");
      const architectResult = await this.architect.run(request.description);
      
      if (!architectResult.success) {
        return {
          success: false,
          phase: "design",
          error: architectResult.output,
          log: this.log
        };
      }

      const spec = this.architect.getSpec();
      if (!spec) {
        return {
          success: false,
          phase: "design",
          error: "Arquiteto não gerou especificação",
          log: this.log
        };
      }
      this.addLog(`Especificação criada para módulo: ${spec.moduleName}`);

      this.addLog("Fase 2: Geração de Código (Agente CodeGen)");
      const codeGenResult = await this.codeGenerator.run(request.description, { spec });
      
      if (!codeGenResult.success) {
        return {
          success: false,
          phase: "codegen",
          spec,
          error: codeGenResult.output,
          log: this.log
        };
      }

      const files = this.codeGenerator.getGeneratedFiles();
      this.addLog(`Gerados ${files.length} arquivos`);

      this.addLog("Fase 3: Validação (Agente Validator)");
      const validationResult = await this.validator.run("validate", { files });
      
      const validation = this.validator.getReport();
      if (validation?.overall === "fail") {
        this.addLog(`Validação falhou: ${validation.summary}`);
        return {
          success: false,
          phase: "validation",
          spec,
          files,
          validation,
          error: validation.summary,
          log: this.log
        };
      }
      this.addLog(`Validação: ${validation?.summary}`);

      if (request.autoCommit) {
        this.addLog("Fase 4: Commit Automático");
        
        const commitFiles = files.map(f => ({
          path: f.path,
          content: f.content
        }));

        const commitResult = await toolManager.execute("github_commit", {
          message: `feat(${spec.moduleName}): adiciona módulo ${spec.moduleName} - gerado automaticamente`,
          files: commitFiles,
          branch: request.targetBranch || "main"
        });

        if (!commitResult.success) {
          this.addLog(`Commit falhou: ${commitResult.error}`);
          return {
            success: false,
            phase: "commit",
            spec,
            files,
            validation,
            error: commitResult.error,
            log: this.log
          };
        }

        this.addLog(`Commit realizado com sucesso`);
        return {
          success: true,
          phase: "complete",
          spec,
          files,
          validation,
          commitUrl: commitResult.data?.commitUrl,
          log: this.log
        };
      }

      this.addLog("Desenvolvimento concluído (sem commit automático)");
      return {
        success: true,
        phase: "complete",
        spec,
        files,
        validation,
        log: this.log
      };

    } catch (error: any) {
      this.addLog(`Erro: ${error.message}`);
      return {
        success: false,
        phase: "design",
        error: error.message,
        log: this.log
      };
    }
  }

  async preview(description: string): Promise<{ spec: ModuleSpec | null; log: string[] }> {
    this.log = [];
    this.addLog(`Preview: "${description}"`);

    const result = await this.architect.run(description);
    const spec = this.architect.getSpec();

    return { spec, log: this.log };
  }

  getAgentStatus(): { name: string; role: string }[] {
    return [
      { name: this.architect.getName(), role: this.architect.getRole() },
      { name: this.codeGenerator.getName(), role: this.codeGenerator.getRole() },
      { name: this.validator.getName(), role: this.validator.getRole() }
    ];
  }
}

export const orchestrator = new OrchestratorAgent();
