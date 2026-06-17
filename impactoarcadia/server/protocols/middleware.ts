// ============================================================
// PROTOCOLO MIDDLEWARE - Autenticação para MCP/A2A
// ============================================================

import { Request, Response, NextFunction } from 'express';

// API Key para acesso externo aos protocolos (configurável via env)
const PROTOCOL_API_KEYS = new Set(
  (process.env.PROTOCOL_API_KEYS || 'arcadia-dev-key').split(',').map(k => k.trim())
);

/**
 * Middleware de autenticação para rotas de protocolo
 * Aceita API Key via header X-API-Key ou Authorization Bearer
 */
export function protocolAuth(req: Request, res: Response, next: NextFunction) {
  // Permitir health checks sem autenticação
  if (req.path.endsWith('/health') || req.path.endsWith('/stats') || req.path.includes('.well-known')) {
    return next();
  }

  // Lista de ferramentas também é pública (para descoberta)
  if (req.method === 'GET' && (req.path.endsWith('/tools') || req.path.match(/\/tools\/[^/]+$/))) {
    return next();
  }

  // Agent Card é público (padrão A2A para descoberta)
  if (req.path.endsWith('/agent.json')) {
    return next();
  }

  // Extrai API Key do header
  const apiKey = req.headers['x-api-key'] as string || 
                 req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key não fornecida',
      hint: 'Inclua o header X-API-Key ou Authorization: Bearer <key>'
    });
  }

  if (!PROTOCOL_API_KEYS.has(apiKey)) {
    return res.status(403).json({
      error: 'API Key inválida',
      hint: 'Verifique se a API Key está correta'
    });
  }

  // Adiciona informação de autenticação ao request
  (req as any).protocolAuth = { apiKey, authenticated: true };
  
  next();
}

/**
 * Middleware opcional que só loga (para desenvolvimento)
 * Use em vez de protocolAuth se quiser desativar auth temporariamente
 */
export function protocolAuthDev(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (apiKey) {
    console.log(`[Protocol] Authenticated request with key: ${apiKey.substring(0, 8)}...`);
  } else {
    console.log(`[Protocol] Unauthenticated request to ${req.path}`);
  }
  
  next();
}
