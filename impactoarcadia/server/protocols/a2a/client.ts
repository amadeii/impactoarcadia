// ============================================================
// A2A CLIENT - Consumidor de Agentes Externos
// Permite que o Manus chame outros agentes via protocolo A2A
// ============================================================

import type { A2AAgentCard, A2ATask, A2AMessage } from '../../../shared/models/protocols';

export interface ExternalAgent {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  agentCard?: A2AAgentCard;
  status: 'active' | 'inactive' | 'error';
  lastChecked?: string;
  description?: string;
}

// Registro de agentes externos conhecidos
const externalAgents = new Map<string, ExternalAgent>();

// Agentes padrão pré-configurados
const DEFAULT_AGENTS: ExternalAgent[] = [
  {
    id: 'arcadia-local',
    name: 'Arcadia Suite (Local)',
    url: 'http://localhost:5000',
    status: 'active',
    description: 'Instância local do Arcadia Suite para testes'
  }
];

// Inicializa agentes padrão
DEFAULT_AGENTS.forEach(agent => externalAgents.set(agent.id, agent));

/**
 * Descobre o Agent Card de um agente externo
 */
export async function discoverAgent(url: string): Promise<A2AAgentCard | null> {
  try {
    const agentCardUrl = url.replace(/\/$/, '') + '/.well-known/agent.json';
    const response = await fetch(agentCardUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      console.log(`[A2A Client] Agent card not found at ${agentCardUrl}`);
      return null;
    }
    
    return await response.json() as A2AAgentCard;
  } catch (error) {
    console.error(`[A2A Client] Error discovering agent at ${url}:`, error);
    return null;
  }
}

/**
 * Registra um novo agente externo
 */
export async function registerAgent(agent: Omit<ExternalAgent, 'agentCard' | 'lastChecked'>): Promise<ExternalAgent> {
  const agentCard = await discoverAgent(agent.url);
  
  const fullAgent: ExternalAgent = {
    ...agent,
    agentCard: agentCard || undefined,
    lastChecked: new Date().toISOString(),
    status: agentCard ? 'active' : 'error'
  };
  
  externalAgents.set(agent.id, fullAgent);
  console.log(`[A2A Client] Registered agent: ${agent.name} (${agent.id}) - Status: ${fullAgent.status}`);
  
  return fullAgent;
}

/**
 * Remove um agente externo
 */
export function unregisterAgent(agentId: string): boolean {
  return externalAgents.delete(agentId);
}

/**
 * Lista todos os agentes externos registrados
 */
export function listAgents(): ExternalAgent[] {
  return Array.from(externalAgents.values());
}

/**
 * Obtém um agente específico
 */
export function getAgent(agentId: string): ExternalAgent | null {
  return externalAgents.get(agentId) || null;
}

/**
 * Envia uma mensagem para um agente externo via A2A
 */
export async function sendMessageToAgent(
  agentId: string, 
  message: string,
  options?: { 
    timeout?: number;
    waitForCompletion?: boolean;
  }
): Promise<{ success: boolean; taskId?: string; response?: string; error?: string }> {
  const agent = externalAgents.get(agentId);
  
  if (!agent) {
    return { success: false, error: `Agent not found: ${agentId}` };
  }
  
  if (agent.status !== 'active') {
    return { success: false, error: `Agent is not active: ${agent.status}` };
  }
  
  try {
    const taskUrl = agent.url.replace(/\/$/, '') + '/api/a2a/v1/tasks';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (agent.apiKey) {
      headers['X-API-Key'] = agent.apiKey;
    }
    
    const a2aMessage: A2AMessage = {
      role: 'user',
      parts: [{ type: 'text', text: message }]
    };
    
    // Criar a tarefa
    const response = await fetch(taskUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: a2aMessage }),
      signal: AbortSignal.timeout(options?.timeout || 30000)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Failed to create task: ${response.status} - ${errorText}` };
    }
    
    const taskData = await response.json();
    const taskId = taskData.task?.id;
    
    if (!taskId) {
      return { success: false, error: 'No task ID returned' };
    }
    
    // Se não precisa esperar conclusão, retorna imediatamente
    if (!options?.waitForCompletion) {
      return { success: true, taskId };
    }
    
    // Aguarda a conclusão da tarefa (polling)
    const maxWaitTime = options?.timeout || 120000;
    const startTime = Date.now();
    const pollInterval = 1000;
    
    while (Date.now() - startTime < maxWaitTime) {
      const statusResponse = await fetch(`${taskUrl}/${taskId}`, {
        headers,
        signal: AbortSignal.timeout(5000)
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const state = statusData.task?.state;
        
        if (state === 'completed') {
          // Extrai a resposta do histórico
          const history = statusData.task?.history || [];
          const assistantMessages = history.filter((m: any) => m.role === 'assistant');
          const lastMessage = assistantMessages[assistantMessages.length - 1];
          const responseText = lastMessage?.parts?.[0]?.text || 'Task completed';
          
          return { success: true, taskId, response: responseText };
        }
        
        if (state === 'failed' || state === 'cancelled') {
          return { success: false, taskId, error: `Task ${state}` };
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    return { success: false, taskId, error: 'Task timed out' };
    
  } catch (error) {
    console.error(`[A2A Client] Error sending message to ${agentId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Verifica o status de todos os agentes
 */
export async function healthCheckAllAgents(): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  for (const [id, agent] of Array.from(externalAgents.entries())) {
    try {
      const healthUrl = agent.url.replace(/\/$/, '') + '/api/a2a/v1/health';
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(5000)
      });
      
      const isHealthy = response.ok;
      results.set(id, isHealthy);
      
      // Atualiza status do agente
      agent.status = isHealthy ? 'active' : 'error';
      agent.lastChecked = new Date().toISOString();
      
    } catch {
      results.set(id, false);
      agent.status = 'error';
      agent.lastChecked = new Date().toISOString();
    }
  }
  
  return results;
}

/**
 * Obtém estatísticas do cliente A2A
 */
export function getClientStats() {
  const agents = Array.from(externalAgents.values());
  return {
    totalAgents: agents.length,
    activeAgents: agents.filter(a => a.status === 'active').length,
    inactiveAgents: agents.filter(a => a.status === 'inactive').length,
    errorAgents: agents.filter(a => a.status === 'error').length,
    agents: agents.map(a => ({
      id: a.id,
      name: a.name,
      url: a.url,
      status: a.status,
      hasAgentCard: !!a.agentCard,
      lastChecked: a.lastChecked
    }))
  };
}
