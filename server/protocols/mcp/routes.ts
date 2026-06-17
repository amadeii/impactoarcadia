// ============================================================
// MCP SERVER - ROUTES
// Endpoints REST para o Model Context Protocol
// ============================================================

import { Router, Request, Response } from 'express';
import * as mcpService from './service';

const router = Router();

/**
 * GET /mcp/v1/tools
 * Lista todas as ferramentas disponíveis
 */
router.get('/tools', (req: Request, res: Response) => {
  try {
    const response = mcpService.listTools();
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /mcp/v1/tools/:name
 * Retorna detalhes de uma ferramenta específica
 */
router.get('/tools/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const tool = mcpService.getTool(name);
    
    if (!tool) {
      return res.status(404).json({ error: `Ferramenta '${name}' não encontrada` });
    }
    
    res.json({ tool });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /mcp/v1/tools/:name/execute
 * Executa uma ferramenta com os argumentos fornecidos
 */
router.post('/tools/:name/execute', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { arguments: args = {} } = req.body;

    // Verifica se a ferramenta existe
    const tool = mcpService.getTool(name);
    if (!tool) {
      return res.status(404).json({ error: `Ferramenta '${name}' não encontrada` });
    }

    // Importa dinamicamente o executor do Manus para evitar dependência circular
    const { executeToolForMcp } = await import('../../manus/service');
    
    const result = await mcpService.executeTool(name, args, executeToolForMcp);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro interno ao executar ferramenta' 
    });
  }
});

/**
 * GET /mcp/v1/stats
 * Retorna estatísticas do servidor MCP
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = mcpService.getServerStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /mcp/v1/health
 * Health check do servidor MCP
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    protocol: 'MCP',
    version: '1.0.0'
  });
});

export default router;
