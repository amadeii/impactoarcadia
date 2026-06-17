// ============================================================
// ARCADIA SUITE - CENTRAL DE PROTOCOLOS
// Ponto de entrada para todos os protocolos de interoperabilidade
// ============================================================

import { Router, Request, Response } from 'express';
import mcpRoutes from './mcp/routes';
import a2aRoutes from './a2a/routes';
import * as a2aService from './a2a/service';
import { protocolAuth } from './middleware';

const router = Router();

// ==================== MCP Routes (com autenticação) ====================
router.use('/mcp/v1', protocolAuth, mcpRoutes);

// ==================== A2A Routes (com autenticação) ====================
router.use('/a2a/v1', protocolAuth, a2aRoutes);

// ==================== Status Geral (público) ====================
router.get('/protocols/status', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    protocols: {
      mcp: {
        version: '1.0.0',
        status: 'active',
        endpoint: '/mcp/v1'
      },
      a2a: {
        version: '1.0.0',
        status: 'active',
        endpoint: '/a2a/v1'
      },
      ap2: {
        version: '0.0.0',
        status: 'planned',
        endpoint: '/ap2/v1'
      },
      ucp: {
        version: '0.0.0',
        status: 'planned',
        endpoint: '/ucp/v1'
      }
    },
    documentation: {
      mcp: 'https://modelcontextprotocol.io',
      a2a: 'https://google.github.io/A2A'
    }
  });
});

// Agent Card no caminho padrão .well-known (público)
export function registerAgentCard(app: any) {
  app.get('/.well-known/agent.json', (req: Request, res: Response) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const agentCard = a2aService.getAgentCard(baseUrl);
    res.json(agentCard);
  });
}

export default router;
