/**
 * Arcadia Suite - Blackboard Agents Index
 * 
 * Exporta todos os agentes colaborativos do sistema.
 */

import { architectAgent } from "./ArchitectAgent";
import { generatorAgent } from "./GeneratorAgent";
import { validatorAgent } from "./ValidatorAgent";
import { executorAgent } from "./ExecutorAgent";
import { evolutionAgent } from "./EvolutionAgent";
import { researcherAgent } from "./ResearcherAgent";

export const agents = {
  architect: architectAgent,
  generator: generatorAgent,
  validator: validatorAgent,
  executor: executorAgent,
  evolution: evolutionAgent,
  researcher: researcherAgent,
};

export function startAllAgents(): void {
  console.log("[Blackboard] Iniciando todos os agentes...");
  
  architectAgent.start();
  generatorAgent.start();
  validatorAgent.start();
  executorAgent.start();
  evolutionAgent.start();
  researcherAgent.start();
  
  console.log("[Blackboard] Todos os 6 agentes estão ativos");
}

export function stopAllAgents(): void {
  console.log("[Blackboard] Parando todos os agentes...");
  
  architectAgent.stop();
  generatorAgent.stop();
  validatorAgent.stop();
  executorAgent.stop();
  evolutionAgent.stop();
  researcherAgent.stop();
}

export function getAgentsStatus(): Array<{ name: string; running: boolean; capabilities: string[] }> {
  return [
    architectAgent.getStatus(),
    generatorAgent.getStatus(),
    validatorAgent.getStatus(),
    executorAgent.getStatus(),
    evolutionAgent.getStatus(),
    researcherAgent.getStatus(),
  ];
}

export { architectAgent, generatorAgent, validatorAgent, executorAgent, evolutionAgent, researcherAgent };
