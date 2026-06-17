/**
 * Arcadia Suite - Evolution Agent
 * 
 * Agente responsável por aprendizado e evolução do sistema.
 * Registra padrões, melhora prompts e otimiza processos.
 * 
 * @author Arcadia Development Team
 * @version 1.0.0
 */

import { BaseBlackboardAgent, type AgentConfig } from "../BaseBlackboardAgent";
import { blackboardService } from "../service";
import { type BlackboardTask } from "@shared/schema";
import { governanceService } from "../../governance/service";
import { learningService } from "../../learning/service";

const SYSTEM_PROMPT = `Você é o Agente de Evolução do Arcadia Suite.

## Seu Papel
Você analisa execuções passadas e melhora o sistema continuamente.

## Responsabilidades
1. Identificar padrões em tarefas bem-sucedidas
2. Documentar aprendizados
3. Sugerir melhorias nos prompts dos outros agentes
4. Otimizar fluxos de trabalho

## Formato de Saída
{
  "learnings": ["aprendizado 1", "aprendizado 2"],
  "patterns": [{ "name": "padrão", "description": "desc", "frequency": 1 }],
  "improvements": [{ "agent": "nome", "suggestion": "melhoria" }],
  "summary": "resumo da evolução"
}`;

export class EvolutionAgent extends BaseBlackboardAgent {
  private proactiveTimer: NodeJS.Timeout | null = null;
  private lastProactiveRun: number = 0;
  private lastProcessedAuditId: number = 0;
  private readonly PROACTIVE_INTERVAL = 300000;
  private readonly MAX_SKILLS_PER_CYCLE = 3;

  constructor() {
    const config: AgentConfig = {
      name: "evolution",
      displayName: "Agente de Evolução",
      description: "Aprende e melhora o sistema continuamente",
      systemPrompt: SYSTEM_PROMPT,
      capabilities: [
        "Análise de padrões",
        "Documentação de aprendizados",
        "Otimização de prompts",
        "Melhoria contínua",
        "Criação automática de skills",
        "Análise proativa de auditoria"
      ],
      pollInterval: 5000
    };
    super(config);
  }

  async start(): Promise<void> {
    await super.start();
    this.startProactiveCycle();
  }

  stop(): void {
    super.stop();
    if (this.proactiveTimer) {
      clearTimeout(this.proactiveTimer);
      this.proactiveTimer = null;
    }
  }

  private startProactiveCycle(): void {
    this.proactiveTimer = setTimeout(() => this.runProactiveAnalysis(), this.PROACTIVE_INTERVAL);
  }

  private async runProactiveAnalysis(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const now = Date.now();
      if (now - this.lastProactiveRun < this.PROACTIVE_INTERVAL) return;
      this.lastProactiveRun = now;

      const [auditTrail, govStats, patterns] = await Promise.all([
        governanceService.getAuditTrail(30),
        governanceService.getGovernanceStats(),
        learningService.getActivePatterns(),
      ]);

      const newAuditEntries = auditTrail.filter(a => a.id > this.lastProcessedAuditId);
      if (newAuditEntries.length > 0) {
        this.lastProcessedAuditId = Math.max(...newAuditEntries.map(a => a.id));
      }

      if (newAuditEntries.length === 0 && patterns.length === 0) {
        console.log(`[Evolution] Nenhum dado novo para analisar.`);
        return;
      }

      const deniedActions = newAuditEntries.filter(a => a.decision === "denied");
      const executedActions = newAuditEntries.filter(a => a.decision === "executed" || a.decision === "allowed");

      if (deniedActions.length >= 3) {
        const agentDenials: Record<string, number> = {};
        for (const d of deniedActions) {
          agentDenials[d.agentName] = (agentDenials[d.agentName] || 0) + 1;
        }
        const topOffender = Object.entries(agentDenials).sort((a, b) => b[1] - a[1])[0];
        if (topOffender && topOffender[1] >= 2) {
          console.log(`[Evolution] Alerta: agente "${topOffender[0]}" teve ${topOffender[1]} ações bloqueadas recentemente`);
        }
      }

      let skillsCreated = 0;
      const existingSkills = await governanceService.getSkills("active");
      const existingSkillKeys = new Set(existingSkills.map(s => {
        const meta = s.steps as any;
        return meta?.sourceAction || meta?.sourcePattern || s.name;
      }));

      if (executedActions.length >= 5 && skillsCreated < this.MAX_SKILLS_PER_CYCLE) {
        const actionPatterns: Record<string, number> = {};
        for (const a of executedActions) {
          actionPatterns[a.action] = (actionPatterns[a.action] || 0) + 1;
        }

        const repeatedActions = Object.entries(actionPatterns)
          .filter(([_, count]) => count >= 3)
          .sort((a, b) => b[1] - a[1]);

        for (const [action, count] of repeatedActions) {
          if (skillsCreated >= this.MAX_SKILLS_PER_CYCLE) break;
          const skillKey = `auto:${action}`;
          if (existingSkillKeys.has(skillKey)) continue;

          const relatedAudits = executedActions.filter(a => a.action === action);
          const tools = Array.from(new Set(relatedAudits.map(a => a.action)));

          await governanceService.createSkill({
            name: `Auto: ${action} (${count}x)`,
            version: "1.0.0",
            description: `Skill detectada automaticamente pelo Evolution Agent. Ação "${action}" executada ${count} vezes recentemente.`,
            steps: {
              sourceAction: skillKey,
              samples: relatedAudits.slice(0, 3).map(a => ({
                action: a.action,
                target: a.target,
                agent: a.agentName,
              })),
            },
            tools,
            createdBy: "evolution-agent",
          });

          existingSkillKeys.add(skillKey);
          skillsCreated++;
          console.log(`[Evolution] Skill criada automaticamente: "${action}" (${count} execuções)`);
        }
      }

      if (patterns.length > 0 && skillsCreated < this.MAX_SKILLS_PER_CYCLE) {
        for (const pattern of patterns.slice(0, 3)) {
          if (skillsCreated >= this.MAX_SKILLS_PER_CYCLE) break;
          const skillKey = `pattern:${pattern.id}`;
          if (existingSkillKeys.has(skillKey)) continue;
          if (pattern.patternType !== "trend") continue;

          await governanceService.createSkill({
            name: `Padrão: ${pattern.name.slice(0, 60)}`,
            version: "1.0.0",
            description: `Convertido do padrão de aprendizado: ${pattern.description || pattern.name}`,
            steps: {
              sourcePattern: skillKey,
              patternData: pattern.pattern,
            },
            tools: [],
            createdBy: "evolution-agent",
          });

          existingSkillKeys.add(skillKey);
          skillsCreated++;
          console.log(`[Evolution] Padrão convertido em skill: "${pattern.name}"`);
        }
      }

      console.log(`[Evolution] Análise proativa concluída. Novos audits: ${newAuditEntries.length}, Padrões: ${patterns.length}, Skills criadas: ${skillsCreated}`);
    } catch (error: any) {
      console.error(`[Evolution] Erro na análise proativa:`, error.message);
    }

    if (this.isRunning) {
      this.proactiveTimer = setTimeout(() => this.runProactiveAnalysis(), this.PROACTIVE_INTERVAL);
    }
  }

  canHandle(task: BlackboardTask): boolean {
    const context = task.context as any;
    return context?.phase === "evolution" || task.assignedAgent === "evolution";
  }

  async process(task: BlackboardTask): Promise<void> {
    await this.log(task.id, "analyzing", "Analisando execução para aprendizado...");

    const allArtifacts = await blackboardService.getArtifactsForTask(task.id);
    const logs = await blackboardService.getTaskLogs(task.id);

    const analysisContext = {
      artifacts: allArtifacts.map(a => ({ name: a.name, type: a.type })),
      logCount: logs.length,
      phases: logs.map(l => l.action).filter((v, i, a) => a.indexOf(v) === i)
    };

    const prompt = `Analise esta execução e extraia aprendizados:

CONTEXTO:
${JSON.stringify(analysisContext, null, 2)}

ARTEFATOS:
${allArtifacts.slice(0, 3).map(a => `- ${a.name}: ${a.content?.slice(0, 300)}...`).join('\n')}

Identifique:
1. O que funcionou bem
2. O que pode ser melhorado
3. Padrões reutilizáveis

Retorne JSON: { "learnings": [], "patterns": [], "improvements": [], "summary": "" }`;

    try {
      const response = await this.generateWithAI(prompt);
      
      let evolution: any;
      try {
        evolution = JSON.parse(response);
      } catch {
        evolution = {
          learnings: ["Execução concluída com sucesso"],
          patterns: [],
          improvements: [],
          summary: response
        };
      }

      await blackboardService.addArtifact(
        task.id,
        "doc",
        "evolution-report.json",
        JSON.stringify(evolution, null, 2),
        "evolution"
      );

      await this.log(task.id, "completed", `Aprendizado registrado: ${evolution.learnings.length} insights`);
      
      await blackboardService.completeTask(task.id, "evolution", evolution);
    } catch (error: any) {
      await blackboardService.failTask(task.id, "evolution", error.message);
    }
  }
}

export const evolutionAgent = new EvolutionAgent();
