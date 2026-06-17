import { BaseBlackboardAgent, type AgentConfig } from "../BaseBlackboardAgent";
import { blackboardService } from "../service";
import { type BlackboardTask } from "@shared/schema";
import { toolManager } from "../../autonomous/tools";

const SYSTEM_PROMPT = `Você é o Agente Validador do Arcadia Suite.

## Seu Papel
Você valida código gerado executando verificações reais de TypeScript e análise de qualidade.

## Verificações Realizadas (Quality Gates)
1. Gate 1: Verificação de tipos TypeScript (tsc --noEmit)
2. Gate 2: Análise de sintaxe e estrutura (lint)
3. Gate 3: Verificação de imports e dependências
4. Gate 4: Identificação de problemas de segurança

## Critérios de Aprovação
- Score >= 60: Código aprovado para deploy
- Score < 60: Código rejeitado, volta para correção

## Formato de Saída
{
  "valid": true/false,
  "score": 0-100,
  "gates": { "typescript": true/false, "lint": true/false, "security": true/false },
  "typeErrors": [],
  "lintErrors": [],
  "warnings": [],
  "summary": "resumo"
}`;

interface QualityGateResult {
  name: string;
  passed: boolean;
  errors: Array<{ file: string; line: number; message: string }>;
  warnings: Array<{ file: string; line: number; message: string }>;
  score: number;
}

export class ValidatorAgent extends BaseBlackboardAgent {
  constructor() {
    const config: AgentConfig = {
      name: "validator",
      displayName: "Agente Validador",
      description: "Valida código com TypeScript check real e quality gates",
      systemPrompt: SYSTEM_PROMPT,
      capabilities: [
        "Verificação TypeScript",
        "Quality Gates",
        "Análise de tipos",
        "Lint check",
        "Detecção de erros",
        "Score de qualidade"
      ],
      pollInterval: 2000
    };
    super(config);
  }

  private checkTypescriptSyntax(content: string, filePath: string): Array<{ file: string; line: number; message: string }> {
    const errors: Array<{ file: string; line: number; message: string }> = [];
    const lines = content.split("\n");
    
    let braceCount = 0;
    let parenCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      const cleanLine = line.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, "");
      braceCount += (cleanLine.match(/{/g) || []).length - (cleanLine.match(/}/g) || []).length;
      parenCount += (cleanLine.match(/\(/g) || []).length - (cleanLine.match(/\)/g) || []).length;
      
      if (line.includes("import") && !line.includes("from") && !line.includes("type")) {
        if (line.trim().startsWith("import") && !line.includes("{")) {
          errors.push({ file: filePath, line: lineNum, message: "Import incompleto" });
        }
      }
      
      if (line.trim() === "export" || line.trim() === "export default") {
        errors.push({ file: filePath, line: lineNum, message: "Export sem conteúdo" });
      }
    }
    
    if (braceCount !== 0) {
      errors.push({ file: filePath, line: lines.length, message: `Chaves desbalanceadas (${braceCount > 0 ? "faltando }" : "extra }"})` });
    }
    if (parenCount !== 0) {
      errors.push({ file: filePath, line: lines.length, message: `Parênteses desbalanceados` });
    }
    
    return errors;
  }

  private runLintGate(content: string, filePath: string): QualityGateResult {
    const errors: Array<{ file: string; line: number; message: string }> = [];
    const warnings: Array<{ file: string; line: number; message: string }> = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (line.includes("console.log") && !filePath.includes("test")) {
        warnings.push({ file: filePath, line: lineNum, message: "console.log em código de produção" });
      }

      if (line.includes("// TODO") || line.includes("// FIXME") || line.includes("// HACK")) {
        warnings.push({ file: filePath, line: lineNum, message: "Comentário TODO/FIXME/HACK encontrado" });
      }

      if (/\bany\b/.test(line) && !line.includes("//") && !line.includes("*")) {
        if (line.includes(": any") || line.includes("as any")) {
          warnings.push({ file: filePath, line: lineNum, message: "Uso de 'any' detectado - considere tipagem específica" });
        }
      }

      if (line.includes("eval(")) {
        errors.push({ file: filePath, line: lineNum, message: "Uso de eval() é proibido por segurança" });
      }

      if (line.includes("innerHTML") && !filePath.includes(".test.")) {
        warnings.push({ file: filePath, line: lineNum, message: "innerHTML pode causar XSS - use textContent ou sanitize" });
      }

      if (line.length > 200) {
        warnings.push({ file: filePath, line: lineNum, message: "Linha muito longa (>200 caracteres)" });
      }

      if (/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/.test(line)) {
        warnings.push({ file: filePath, line: lineNum, message: "Catch vazio - trate ou registre o erro" });
      }
    }

    if (content.includes("password") || content.includes("secret") || content.includes("api_key")) {
      if (content.includes("= \"") || content.includes("= '")) {
        const match = content.match(/(password|secret|api_key)\s*=\s*["'][^"']+["']/i);
        if (match) {
          errors.push({ file: filePath, line: 0, message: "Possível credencial hardcoded detectada" });
        }
      }
    }

    const errorPenalty = errors.length * 20;
    const warningPenalty = warnings.length * 3;
    const score = Math.max(0, 100 - errorPenalty - warningPenalty);

    return {
      name: "lint",
      passed: errors.length === 0,
      errors,
      warnings,
      score,
    };
  }

  private runSecurityGate(content: string, filePath: string): QualityGateResult {
    const errors: Array<{ file: string; line: number; message: string }> = [];
    const warnings: Array<{ file: string; line: number; message: string }> = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (/require\s*\(\s*[^'"]*\+/.test(line) || /require\s*\(\s*`/.test(line)) {
        errors.push({ file: filePath, line: lineNum, message: "Dynamic require detectado - risco de injeção de código" });
      }

      if (line.includes("exec(") || line.includes("execSync(")) {
        if (!filePath.includes("RunCommandTool") && !filePath.includes("TypeCheckTool")) {
          warnings.push({ file: filePath, line: lineNum, message: "Uso de exec/execSync - verificar sanitização de input" });
        }
      }

      if (line.includes("dangerouslySetInnerHTML")) {
        warnings.push({ file: filePath, line: lineNum, message: "dangerouslySetInnerHTML detectado - garantir sanitização" });
      }

      if (/process\.env\.\w+/.test(line) && line.includes("console")) {
        errors.push({ file: filePath, line: lineNum, message: "Possível exposição de variável de ambiente em log" });
      }
    }

    const score = Math.max(0, 100 - (errors.length * 25) - (warnings.length * 5));

    return {
      name: "security",
      passed: errors.length === 0,
      errors,
      warnings,
      score,
    };
  }

  canHandle(task: BlackboardTask): boolean {
    const context = task.context as any;
    return context?.phase === "validation" || task.assignedAgent === "validator";
  }

  async process(task: BlackboardTask): Promise<void> {
    await this.log(task.id, "thinking", "Iniciando validação com quality gates...");

    const codeArtifacts = await blackboardService.getArtifactsForTask(task.id, "code");

    if (codeArtifacts.length === 0) {
      await blackboardService.failTask(task.id, "validator", "Nenhum código para validar");
      return;
    }

    await this.log(task.id, "validating", `Executando quality gates em ${codeArtifacts.length} arquivos...`);

    const allGates: QualityGateResult[] = [];
    const allTypeErrors: Array<{ file: string; line: number; message: string }> = [];

    for (const artifact of codeArtifacts) {
      const content = artifact.content || "";
      const filePath = artifact.name;
      
      const pathValidation = blackboardService.validateFilePath(filePath);
      if (!pathValidation.valid) {
        allTypeErrors.push({ file: filePath, line: 0, message: `Path inválido: ${pathValidation.error}` });
        continue;
      }
      
      const contentValidation = blackboardService.validateContent(content);
      if (!contentValidation.valid) {
        allTypeErrors.push({ file: filePath, line: 0, message: `Conteúdo inválido: ${contentValidation.error}` });
        continue;
      }
      
      const syntaxErrors = this.checkTypescriptSyntax(content, filePath);
      allTypeErrors.push(...syntaxErrors);

      const lintResult = this.runLintGate(content, filePath);
      allGates.push(lintResult);

      const securityResult = this.runSecurityGate(content, filePath);
      allGates.push(securityResult);
    }
    
    const typeCheckResult = await toolManager.execute("typecheck", {});
    const repoErrors = typeCheckResult.data?.errors || [];

    const typeGate: QualityGateResult = {
      name: "typescript",
      passed: allTypeErrors.length === 0 && repoErrors.length <= 5,
      errors: [...allTypeErrors, ...repoErrors.slice(0, 10)],
      warnings: [],
      score: Math.max(0, 100 - (allTypeErrors.length * 15) - (repoErrors.length * 5)),
    };
    allGates.unshift(typeGate);

    const codeContent = codeArtifacts.map(a => `\n--- ${a.name} ---\n${a.content?.slice(0, 1000)}`).join("\n\n");
    const allErrors = [...allTypeErrors, ...repoErrors.slice(0, 10)];

    const analysisPrompt = `Analise este código TypeScript/React e identifique problemas:

${codeContent.slice(0, 3000)}

Erros encontrados na validação:
${allErrors.slice(0, 10).map((e: any) => `- ${e.file}:${e.line} - ${e.message}`).join("\n") || "Nenhum erro encontrado"}

Retorne JSON: { "issues": [{"severity": "error|warning", "message": "desc"}], "suggestions": [], "codeQuality": 0-100 }`;

    let aiAnalysis: any = { issues: [], suggestions: [], codeQuality: 80 };
    
    try {
      const response = await this.generateWithAI(analysisPrompt);
      const parsed = JSON.parse(response);
      aiAnalysis = {
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        codeQuality: typeof parsed.codeQuality === 'number' ? parsed.codeQuality : 80
      };
    } catch {}

    const gateScores = allGates.map(g => g.score);
    const avgGateScore = gateScores.length > 0 ? gateScores.reduce((a, b) => a + b, 0) / gateScores.length : 80;

    const totalErrors = allGates.reduce((sum, g) => sum + g.errors.length, 0);
    const totalWarnings = allGates.reduce((sum, g) => sum + g.warnings.length, 0);

    let score = Math.round((avgGateScore + (aiAnalysis.codeQuality || 80)) / 2);
    score = Math.max(0, Math.min(100, score));

    const gatesSummary: Record<string, boolean> = {};
    const uniqueGates = new Map<string, boolean>();
    for (const gate of allGates) {
      const current = uniqueGates.get(gate.name);
      uniqueGates.set(gate.name, current === undefined ? gate.passed : current && gate.passed);
    }
    uniqueGates.forEach((passed, name) => { gatesSummary[name] = passed; });

    const validation = {
      valid: score >= 60,
      score,
      gates: gatesSummary,
      typeErrors: allErrors.slice(0, 20),
      lintErrors: allGates.filter(g => g.name === "lint").flatMap(g => g.errors).slice(0, 20),
      securityIssues: allGates.filter(g => g.name === "security").flatMap(g => g.errors).slice(0, 10),
      issues: aiAnalysis.issues || [],
      suggestions: aiAnalysis.suggestions || [],
      warnings: allGates.flatMap(g => g.warnings).slice(0, 20),
      gateDetails: allGates.map(g => ({ name: g.name, passed: g.passed, score: g.score, errorCount: g.errors.length, warningCount: g.warnings.length })),
      summary: score >= 60 
        ? `Código aprovado (score ${score}). Gates: ${Object.entries(gatesSummary).map(([k, v]) => `${k}:${v ? "OK" : "FALHA"}`).join(", ")}. ${totalErrors} erros, ${totalWarnings} avisos.`
        : `Código reprovado (score ${score}). Gates falhados: ${Object.entries(gatesSummary).filter(([_, v]) => !v).map(([k]) => k).join(", ")}. ${totalErrors} erros.`,
    };

    await blackboardService.addArtifact(
      task.id,
      "doc",
      "validation-report.json",
      JSON.stringify(validation, null, 2),
      "validator"
    );

    await this.log(task.id, "completed", `Validação: score ${score}, ${validation.valid ? "APROVADO" : "REPROVADO"}. Gates: ${JSON.stringify(gatesSummary)}`);

    const mainTask = await blackboardService.getMainTask(task.id);

    if (mainTask) {
      if (validation.valid) {
        await blackboardService.createSubtask(
          mainTask.id,
          "Executar deploy",
          "Aplicar código validado ao projeto",
          "executor",
          [task.id],
          { phase: "deploy" }
        );
      } else {
        await this.log(task.id, "blocked", "Código reprovado - deploy bloqueado");
      }
    }

    await blackboardService.completeTask(task.id, "validator", validation);
  }
}

export const validatorAgent = new ValidatorAgent();
