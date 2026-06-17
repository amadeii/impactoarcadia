// ============================================================
// A2A SERVER - SERVICE
// Agent to Agent Protocol para comunicação entre agentes
// ============================================================

import type { 
  A2ATask, 
  A2AMessage, 
  A2AArtifact,
  A2AAgentCard,
  A2ATaskEvent,
  TaskState
} from '../../../shared/models/protocols';
import { generateTaskId, generateArtifactId } from '../../../shared/models/protocols';

// Armazenamento em memória das tarefas (em produção, usar banco de dados)
const tasks = new Map<string, A2ATask>();

// Event emitters para SSE
const taskEventListeners = new Map<string, ((event: A2ATaskEvent) => void)[]>();

/**
 * Retorna o Agent Card do Arcadia Suite
 */
export function getAgentCard(baseUrl: string): A2AAgentCard {
  return {
    name: 'Arcadia Suite Agent',
    description: 'Agente de IA empresarial com capacidades de ERP, CRM, Fiscal, Financeiro e Automação. Pode executar análises, gerar relatórios, enviar mensagens e integrar com diversos sistemas.',
    version: '1.0.0',
    url: baseUrl,
    capabilities: [
      { name: 'multi-turn', description: 'Suporta conversas de múltiplos turnos com contexto' },
      { name: 'streaming', description: 'Suporta streaming de respostas via SSE' },
      { name: 'artifacts', description: 'Pode gerar artefatos (relatórios, gráficos, arquivos)' },
      { name: 'tools', description: 'Expõe 20+ ferramentas via MCP' }
    ],
    skills: [
      {
        id: 'erp_query',
        name: 'Consulta ERP',
        description: 'Consulta dados de clientes, pedidos, estoque e financeiro',
        inputSchema: { type: 'object', properties: { entity: { type: 'string' }, filter: { type: 'string' } } }
      },
      {
        id: 'crm_query',
        name: 'Consulta CRM',
        description: 'Consulta parceiros, contratos, comissões e eventos',
        inputSchema: { type: 'object', properties: { entity: { type: 'string' }, filter: { type: 'string' } } }
      },
      {
        id: 'generate_report',
        name: 'Gerar Relatório',
        description: 'Gera relatórios estruturados em diversos formatos',
        inputSchema: { type: 'object', properties: { title: { type: 'string' }, type: { type: 'string' }, data: { type: 'string' } } }
      },
      {
        id: 'python_execute',
        name: 'Executar Python',
        description: 'Executa código Python para análises e automações',
        inputSchema: { type: 'object', properties: { code: { type: 'string' } } }
      },
      {
        id: 'web_search',
        name: 'Pesquisa Web',
        description: 'Pesquisa informações na internet',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } }
      },
      {
        id: 'semantic_search',
        name: 'Busca Semântica',
        description: 'Busca por significado na base de conhecimento',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } }
      }
    ],
    authentication: {
      type: 'api_key',
      instructions: 'Inclua o header X-API-Key com sua chave de API'
    },
    contact: {
      website: 'https://arcadia.suite'
    }
  };
}

/**
 * Cria uma nova tarefa a partir de uma mensagem
 */
export async function createTask(message: A2AMessage, metadata?: Record<string, any>): Promise<A2ATask> {
  const taskId = generateTaskId();
  const now = new Date().toISOString();

  const task: A2ATask = {
    id: taskId,
    state: 'pending',
    message,
    artifacts: [],
    history: [message],
    createdAt: now,
    updatedAt: now,
    metadata
  };

  tasks.set(taskId, task);
  emitTaskEvent(taskId, 'state_change', { state: 'pending' });

  return task;
}

/**
 * Obtém uma tarefa pelo ID
 */
export function getTask(taskId: string): A2ATask | null {
  return tasks.get(taskId) || null;
}

/**
 * Lista tarefas com paginação
 */
export function listTasks(page = 1, pageSize = 20): { tasks: A2ATask[]; total: number; page: number; pageSize: number } {
  const allTasks = Array.from(tasks.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const start = (page - 1) * pageSize;
  const paginatedTasks = allTasks.slice(start, start + pageSize);

  return {
    tasks: paginatedTasks,
    total: allTasks.length,
    page,
    pageSize
  };
}

/**
 * Atualiza o estado de uma tarefa
 */
export function updateTaskState(taskId: string, state: TaskState): A2ATask | null {
  const task = tasks.get(taskId);
  if (!task) return null;

  task.state = state;
  task.updatedAt = new Date().toISOString();
  tasks.set(taskId, task);

  emitTaskEvent(taskId, 'state_change', { state });

  return task;
}

/**
 * Adiciona uma mensagem ao histórico da tarefa
 */
export function addMessageToTask(taskId: string, message: A2AMessage): A2ATask | null {
  const task = tasks.get(taskId);
  if (!task) return null;

  task.history = task.history || [];
  task.history.push(message);
  task.updatedAt = new Date().toISOString();
  tasks.set(taskId, task);

  emitTaskEvent(taskId, 'message', { message });

  return task;
}

/**
 * Adiciona um artefato à tarefa
 */
export function addArtifactToTask(taskId: string, name: string, type: string, data: any): A2AArtifact | null {
  const task = tasks.get(taskId);
  if (!task) return null;

  const artifact: A2AArtifact = {
    id: generateArtifactId(),
    name,
    type,
    data,
    createdAt: new Date().toISOString()
  };

  task.artifacts = task.artifacts || [];
  task.artifacts.push(artifact);
  task.updatedAt = new Date().toISOString();
  tasks.set(taskId, task);

  emitTaskEvent(taskId, 'artifact', { artifact });

  return artifact;
}

/**
 * Cancela uma tarefa
 */
export function cancelTask(taskId: string): A2ATask | null {
  return updateTaskState(taskId, 'canceled');
}

/**
 * Processa uma tarefa usando o Arcádia Agent
 */
export async function processTask(taskId: string): Promise<A2ATask | null> {
  const task = tasks.get(taskId);
  if (!task) return null;

  // Atualiza estado para "working"
  updateTaskState(taskId, 'working');

  try {
    // Extrai o texto da mensagem
    const textPart = task.message.parts.find(p => p.type === 'text');
    const userMessage = textPart?.text || '';

    if (!userMessage) {
      updateTaskState(taskId, 'failed');
      addMessageToTask(taskId, {
        role: 'agent',
        parts: [{ type: 'text', text: 'Erro: Mensagem vazia recebida' }]
      });
      return task;
    }

    // Importa o serviço Manus dinamicamente
    const { processAgentMessage } = await import('../../manus/service');
    
    // Processa a mensagem com o agente
    const response = await processAgentMessage(userMessage, taskId);

    // Adiciona a resposta ao histórico
    addMessageToTask(taskId, {
      role: 'agent',
      parts: [{ type: 'text', text: response.output || response.answer || 'Processamento concluído' }],
      metadata: { toolsUsed: response.toolsUsed, chart: response.chart }
    });

    // Se houver gráfico, adiciona como artefato
    if (response.chart) {
      addArtifactToTask(taskId, 'Gráfico', 'chart', response.chart);
    }

    // Atualiza estado para "completed"
    updateTaskState(taskId, 'completed');

    return tasks.get(taskId) || null;
  } catch (error: any) {
    updateTaskState(taskId, 'failed');
    addMessageToTask(taskId, {
      role: 'agent',
      parts: [{ type: 'text', text: `Erro ao processar: ${error.message}` }]
    });
    return task;
  }
}

// ==================== Event System para SSE ====================

/**
 * Registra um listener para eventos de uma tarefa
 */
export function subscribeToTask(taskId: string, listener: (event: A2ATaskEvent) => void): () => void {
  if (!taskEventListeners.has(taskId)) {
    taskEventListeners.set(taskId, []);
  }
  taskEventListeners.get(taskId)!.push(listener);

  // Retorna função para cancelar inscrição
  return () => {
    const listeners = taskEventListeners.get(taskId);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  };
}

/**
 * Emite um evento para todos os listeners de uma tarefa
 */
function emitTaskEvent(taskId: string, type: A2ATaskEvent['type'], data: any): void {
  const event: A2ATaskEvent = {
    type,
    taskId,
    data,
    timestamp: new Date().toISOString()
  };

  const listeners = taskEventListeners.get(taskId);
  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Erro ao emitir evento A2A:', e);
      }
    }
  }
}

/**
 * Retorna estatísticas do servidor A2A
 */
export function getServerStats() {
  const allTasks = Array.from(tasks.values());
  
  return {
    totalTasks: allTasks.length,
    tasksByState: {
      pending: allTasks.filter(t => t.state === 'pending').length,
      working: allTasks.filter(t => t.state === 'working').length,
      completed: allTasks.filter(t => t.state === 'completed').length,
      failed: allTasks.filter(t => t.state === 'failed').length,
      canceled: allTasks.filter(t => t.state === 'canceled').length
    },
    activeListeners: Array.from(taskEventListeners.entries())
      .reduce((acc, [, listeners]) => acc + listeners.length, 0)
  };
}
