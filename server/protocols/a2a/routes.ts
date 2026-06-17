// ============================================================
// A2A SERVER - ROUTES
// Endpoints REST para o Agent to Agent Protocol
// ============================================================

import { Router, Request, Response } from 'express';
import * as a2aService from './service';
import * as a2aClient from './client';

const router = Router();

/**
 * GET /.well-known/agent.json
 * Retorna o Agent Card do Arcadia Suite
 * (Padrão A2A para descoberta de agentes)
 */
router.get('/agent.json', (req: Request, res: Response) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const agentCard = a2aService.getAgentCard(baseUrl);
    res.json(agentCard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /a2a/v1/tasks
 * Cria uma nova tarefa (SendMessage)
 */
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { message, taskId, metadata } = req.body;

    if (!message || !message.parts || !Array.isArray(message.parts)) {
      return res.status(400).json({ 
        error: 'Mensagem inválida. Formato esperado: { message: { parts: [{ type: "text", text: "..." }] } }' 
      });
    }

    // Se taskId fornecido, continua conversa existente
    if (taskId) {
      const existingTask = a2aService.getTask(taskId);
      if (!existingTask) {
        return res.status(404).json({ error: `Tarefa '${taskId}' não encontrada` });
      }

      // Adiciona mensagem ao histórico
      a2aService.addMessageToTask(taskId, { ...message, role: 'user' });
      
      // Processa a mensagem de forma assíncrona
      a2aService.processTask(taskId).catch(console.error);
      
      return res.status(202).json({ task: a2aService.getTask(taskId) });
    }

    // Cria nova tarefa
    const task = await a2aService.createTask({ ...message, role: 'user' }, metadata);

    // Processa a tarefa de forma assíncrona
    a2aService.processTask(task.id).catch(console.error);

    // Retorna imediatamente com status 202 (Accepted)
    res.status(202).json({ task });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /a2a/v1/tasks/:id
 * Obtém o status de uma tarefa
 */
router.get('/tasks/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = a2aService.getTask(id);
    
    if (!task) {
      return res.status(404).json({ error: `Tarefa '${id}' não encontrada` });
    }
    
    res.json({ task });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /a2a/v1/tasks
 * Lista todas as tarefas com paginação
 */
router.get('/tasks', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    
    const result = a2aService.listTasks(page, pageSize);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /a2a/v1/tasks/:id/cancel
 * Cancela uma tarefa
 */
router.post('/tasks/:id/cancel', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = a2aService.cancelTask(id);
    
    if (!task) {
      return res.status(404).json({ error: `Tarefa '${id}' não encontrada` });
    }
    
    res.json({ task });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /a2a/v1/tasks/:id/stream
 * Stream de eventos da tarefa via Server-Sent Events (SSE)
 */
router.get('/tasks/:id/stream', (req: Request, res: Response) => {
  const { id } = req.params;
  const task = a2aService.getTask(id);

  if (!task) {
    return res.status(404).json({ error: `Tarefa '${id}' não encontrada` });
  }

  // Configura headers para SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Envia evento inicial com estado atual
  res.write(`data: ${JSON.stringify({ type: 'initial', task })}\n\n`);

  // Registra listener para eventos
  const unsubscribe = a2aService.subscribeToTask(id, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    
    // Se a tarefa terminou, fecha a conexão
    if (event.type === 'state_change' && 
        ['completed', 'failed', 'canceled'].includes(event.data.state)) {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    }
  });

  // Cleanup quando a conexão é fechada
  req.on('close', () => {
    unsubscribe();
  });
});

/**
 * GET /a2a/v1/stats
 * Retorna estatísticas do servidor A2A
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = a2aService.getServerStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /a2a/v1/health
 * Health check do servidor A2A
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    protocol: 'A2A',
    version: '1.0.0'
  });
});

// ============================================================
// ROTAS DO CLIENTE A2A (para gerenciar agentes externos)
// ============================================================

/**
 * GET /a2a/v1/agents
 * Lista todos os agentes externos registrados
 */
router.get('/agents', (req: Request, res: Response) => {
  try {
    const agents = a2aClient.listAgents();
    const stats = a2aClient.getClientStats();
    res.json({ agents, stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /a2a/v1/agents
 * Registra um novo agente externo
 */
router.post('/agents', async (req: Request, res: Response) => {
  try {
    const { id, name, url, apiKey, description } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ error: 'Nome e URL são obrigatórios' });
    }
    
    const agent = await a2aClient.registerAgent({
      id: id || name.toLowerCase().replace(/\s+/g, '-'),
      name,
      url,
      apiKey,
      description,
      status: 'inactive'
    });
    
    res.status(201).json({ agent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /a2a/v1/agents/:id
 * Obtém detalhes de um agente específico
 */
router.get('/agents/:id', (req: Request, res: Response) => {
  try {
    const agent = a2aClient.getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }
    res.json({ agent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /a2a/v1/agents/:id
 * Remove um agente externo
 */
router.delete('/agents/:id', (req: Request, res: Response) => {
  try {
    const removed = a2aClient.unregisterAgent(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }
    res.json({ success: true, message: 'Agente removido' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /a2a/v1/agents/:id/message
 * Envia mensagem para um agente externo
 */
router.post('/agents/:id/message', async (req: Request, res: Response) => {
  try {
    const { message, waitForCompletion = true, timeout = 120000 } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }
    
    const result = await a2aClient.sendMessageToAgent(req.params.id, message, {
      waitForCompletion,
      timeout
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /a2a/v1/agents/discover
 * Descobre o Agent Card de uma URL
 */
router.post('/agents/discover', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }
    
    const agentCard = await a2aClient.discoverAgent(url);
    
    if (!agentCard) {
      return res.status(404).json({ error: 'Agent Card não encontrado' });
    }
    
    res.json({ agentCard });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /a2a/v1/agents/health-check
 * Verifica a saúde de todos os agentes
 */
router.post('/agents/health-check', async (req: Request, res: Response) => {
  try {
    const results = await a2aClient.healthCheckAllAgents();
    const healthStatus: Record<string, boolean> = {};
    results.forEach((healthy, id) => {
      healthStatus[id] = healthy;
    });
    res.json({ results: healthStatus });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
