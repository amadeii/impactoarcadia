import { BaseBlackboardAgent, type AgentConfig } from "../BaseBlackboardAgent";
import { blackboardService } from "../service";
import { type BlackboardTask } from "@shared/schema";
import { governanceService } from "../../governance/service";
import { jobQueueService } from "../../governance/jobQueue";

const SYSTEM_PROMPT = `Você é o Agente Pesquisador do Arcadia Suite.

## Seu Papel
Você analisa repositórios externos, pesquisa soluções tecnológicas
e fornece relatórios de análise para os outros agentes.

## Responsabilidades
1. Analisar estrutura de repositórios GitHub
2. Pesquisar padrões de implementação e boas práticas
3. Comparar soluções e frameworks
4. Gerar relatórios de viabilidade técnica
5. Identificar dependências e riscos

## Formato de Saída (JSON)
{
  "findings": [{ "topic": "tema", "summary": "resumo", "relevance": "alta|média|baixa" }],
  "recommendations": ["recomendação 1", "recomendação 2"],
  "risks": ["risco 1"],
  "references": ["url ou referência"],
  "summary": "resumo geral"
}`;

export class ResearcherAgent extends BaseBlackboardAgent {
  constructor() {
    const config: AgentConfig = {
      name: "researcher",
      displayName: "Agente Pesquisador",
      description: "Pesquisa soluções, analisa repositórios e gera relatórios técnicos",
      systemPrompt: SYSTEM_PROMPT,
      capabilities: [
        "Análise de repositórios",
        "Pesquisa de soluções",
        "Comparação de frameworks",
        "Relatórios de viabilidade",
        "Identificação de riscos",
      ],
    };
    super(config);
  }

  canHandle(task: BlackboardTask): boolean {
    const context = task.context as any;
    return context?.phase === "research" || task.assignedAgent === "researcher";
  }

  async process(task: BlackboardTask): Promise<void> {
    await this.log(task.id, "info", "Iniciando pesquisa...");

    const allowed = await this.checkPolicy(
      task.type,
      task.title || "research",
      { taskId: task.id }
    );

    if (!allowed) {
      await blackboardService.failTask(task.id, "researcher", "Ação bloqueada por política de governança");
      return;
    }

    const context = task.context as any;
    const researchType = context?.researchType || "general";
    const prompt = this.buildResearchPrompt(researchType, task, context);

    await this.log(task.id, "analyzing", `Tipo de pesquisa: ${researchType}`);

    const response = await this.generateWithAI(prompt);

    let parsed: any;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: response };
    } catch {
      parsed = { raw: response, parseError: true };
    }

    await blackboardService.addArtifact(
      task.id,
      "analysis",
      "research-report.json",
      JSON.stringify(parsed, null, 2),
      "researcher",
      { researchType, version: 1 }
    );

    await governanceService.recordAudit({
      agentName: "researcher",
      action: researchType,
      target: task.title,
      decision: "executed",
      justification: "Pesquisa concluída com sucesso",
      taskId: task.id,
      output: { responseLength: response.length },
    });

    const startTime = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();
    await jobQueueService.recordAgentMetrics("researcher", {
      tasksCompleted: 1,
      avgDurationMs: Date.now() - startTime,
    });

    await blackboardService.completeTask(task.id, "researcher", parsed);
    await this.log(task.id, "completed", `Pesquisa concluída: ${parsed.summary || "relatório gerado"}`);
  }

  taskTypes(): string[] {
    return ["research", "analyze_repo", "compare_solutions", "feasibility_study"];
  }

  private buildResearchPrompt(researchType: string, task: BlackboardTask, context: any): string {
    const base = `TAREFA: ${task.title}\nDESCRIÇÃO: ${task.description || "Sem descrição"}`;

    switch (researchType) {
      case "analyze_repo":
        return `${base}
Analise o repositório: ${context?.repoUrl || context?.target || "não especificado"}
${context?.focus ? `Foco: ${context.focus}` : ""}
Forneça uma análise completa da estrutura, tecnologias, padrões de código e qualidade.`;

      case "compare_solutions":
        return `${base}
Compare as seguintes soluções/frameworks: ${JSON.stringify(context?.options || [])}
Critérios: ${context?.criteria || "performance, facilidade de uso, comunidade, documentação"}
Forneça uma comparação objetiva com recomendação.`;

      case "feasibility_study":
        return `${base}
${context?.constraints ? `Restrições: ${context.constraints}` : ""}
${context?.budget ? `Orçamento: ${context.budget}` : ""}
Analise viabilidade técnica, riscos e estimativa de esforço.`;

      default:
        return `${base}
Pesquise sobre o tema acima.
Forneça informações detalhadas, exemplos práticos e recomendações.`;
    }
  }
}

export const researcherAgent = new ResearcherAgent();
