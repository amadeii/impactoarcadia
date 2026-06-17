import type { RequestHandler } from 'express';
import { db } from '../db/index';
import { tenantUsers, tenants } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

declare global {
  namespace Express {
    interface Request {
      tenantId?:          string | null;
      tenantRole?:        string | null;
      tenantType?:        string | null;
      tenantSegmento?:    string | null;
      isMaster?:          boolean;
      isPartner?:         boolean;
      partnerTenantId?:   string | null;
      activeEmpresaId?:   string | null;
      activeEmpresaNome?: string | null;
      activeGrupoId?:     string | null;
      activeGrupoNome?:   string | null;
      visaoConsolidada?:  boolean;
    }
  }
}

export const tenantContext: RequestHandler = async (req, _res, next) => {
  req.tenantId          = null;
  req.tenantRole        = null;
  req.tenantType        = null;
  req.tenantSegmento    = null;
  req.isMaster          = false;
  req.isPartner         = false;
  req.partnerTenantId   = null;
  req.activeEmpresaId   = null;
  req.activeEmpresaNome = null;
  req.activeGrupoId     = null;
  req.activeGrupoNome   = null;
  req.visaoConsolidada  = false;

  if (!req.isAuthenticated?.()) return next();
  const user = req.user as any;
  if (!user?.id) return next();

  try {
    // Prioridade 1: header x-tenant-id ou sessão salva
    const headerTenantId = req.headers['x-tenant-id']
      ? Number(req.headers['x-tenant-id'])
      : (req.session as any).activeTenantId
      ? Number((req.session as any).activeTenantId)
      : null;

    if (headerTenantId) {
      // Acesso direto — usuário é membro do tenant
      const [membership] = await db.select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.tenantId, headerTenantId),
          eq(tenantUsers.userId, user.id),
        ))
        .limit(1);

      if (membership) {
        const [tenant] = await db.select()
          .from(tenants)
          .where(eq(tenants.id, headerTenantId))
          .limit(1);

        if (tenant) {
          req.tenantId        = String(tenant.id);
          req.tenantRole      = membership.role;
          req.tenantType      = tenant.tenantType;
          req.tenantSegmento  = (tenant as any).segmento ?? (tenant as any).segment ?? 'generic';
          req.isMaster        = tenant.tenantType === 'master';
          req.isPartner       = tenant.tenantType === 'partner';
          return next();
        }
      }

      // Acesso via partner — verifica se o usuário é parceiro
      // e o tenant alvo é client filho deste partner
      const [partnerMembership] = await db.select({
        tenantId: tenantUsers.tenantId,
        role:     tenantUsers.role,
        type:     tenants.tenantType,
      })
        .from(tenantUsers)
        .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
        .where(and(
          eq(tenantUsers.userId, user.id),
          eq(tenants.tenantType, 'partner'),
        ))
        .limit(1);

      if (partnerMembership) {
        const [clientTenant] = await db.select()
          .from(tenants)
          .where(and(
            eq(tenants.id, headerTenantId),
            eq(tenants.parentTenantId, partnerMembership.tenantId),
          ))
          .limit(1);

        if (clientTenant) {
          req.tenantId        = String(clientTenant.id);
          req.tenantRole      = 'partner_admin';
          req.tenantType      = clientTenant.tenantType;
          req.isPartner       = true;
          req.partnerTenantId = String(partnerMembership.tenantId);
          return next();
        }
      }

      // Master pode acessar qualquer tenant
      const [masterMembership] = await db.select({
        tenantId: tenantUsers.tenantId,
        type:     tenants.tenantType,
      })
        .from(tenantUsers)
        .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
        .where(and(
          eq(tenantUsers.userId, user.id),
          eq(tenants.tenantType, 'master'),
        ))
        .limit(1);

      if (masterMembership) {
        const [targetTenant] = await db.select()
          .from(tenants)
          .where(eq(tenants.id, headerTenantId))
          .limit(1);

        if (targetTenant) {
          req.tenantId   = String(targetTenant.id);
          req.tenantRole = 'master_admin';
          req.tenantType = targetTenant.tenantType;
          req.isMaster   = true;
          return next();
        }
      }
    }

    // Prioridade 2: tenant padrão (primeiro membership do usuário)
    const [defaultMembership] = await db.select({
      tenantId: tenantUsers.tenantId,
      role:     tenantUsers.role,
      type:     tenants.tenantType,
    })
      .from(tenantUsers)
      .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
      .where(eq(tenantUsers.userId, user.id))
      .limit(1);

    if (defaultMembership) {
      req.tenantId       = String(defaultMembership.tenantId);
      req.tenantRole     = defaultMembership.role;
      req.tenantType     = defaultMembership.type;
      req.isMaster       = defaultMembership.type === 'master';
      req.isPartner      = defaultMembership.type === 'partner';
    }

    // Contexto de empresa/grupo ativo (header ou sessão)
    const headerEmpresaId = req.headers['x-empresa-id']
      ? String(req.headers['x-empresa-id'])
      : (req.session as any).activeEmpresaId
      ? String((req.session as any).activeEmpresaId)
      : null;

    const headerGrupoId = req.headers['x-grupo-id']
      ? String(req.headers['x-grupo-id'])
      : (req.session as any).activeGrupoId
      ? String((req.session as any).activeGrupoId)
      : null;

    if (req.tenantId && headerEmpresaId) {
      const empresaResult = await db.execute(
        `SELECT id, nome_fantasia, razao_social FROM tenant_empresas
         WHERE id = ${Number(headerEmpresaId)} AND tenant_id = ${Number(req.tenantId)} LIMIT 1`
      );
      const rows = (empresaResult as any).rows ?? [];
      if (rows.length > 0) {
        const emp = rows[0];
        req.activeEmpresaId   = String(emp.id);
        req.activeEmpresaNome = emp.nome_fantasia || emp.razao_social;
      }
    }

    if (req.tenantId && headerGrupoId) {
      const grupoResult = await db.execute(
        `SELECT id, nome FROM tenant_grupos
         WHERE id = ${Number(headerGrupoId)} AND tenant_id = ${Number(req.tenantId)} AND ativo = true LIMIT 1`
      );
      const rows = (grupoResult as any).rows ?? [];
      if (rows.length > 0) {
        req.activeGrupoId    = String(rows[0].id);
        req.activeGrupoNome  = rows[0].nome;
        req.visaoConsolidada = !headerEmpresaId;
      }
    }

  } catch (err: any) {
    console.error('[tenantContext] erro:', err.message);
  }

  next();
};

// ── Guards ──────────────────────────────────────────────────────
export const requireTenant: RequestHandler = (req, res, next) => {
  if (!req.tenantId) {
    return res.status(400).json({
      error: 'tenant_required',
      message: 'Envie o header x-tenant-id com o ID do tenant ativo.',
    });
  }
  next();
};

export const requirePartner: RequestHandler = (req, res, next) => {
  if (!req.isPartner && !req.isMaster) {
    return res.status(403).json({ error: 'partner_required' });
  }
  next();
};

export const requireMaster: RequestHandler = (req, res, next) => {
  if (!req.isMaster) {
    return res.status(403).json({ error: 'master_required' });
  }
  next();
};

export const requireTenantAdmin: RequestHandler = (req: any, res, next) => {
  const user = req.user as any;
  if (!user) return res.status(401).json({ error: 'unauthenticated' });
  if (user.role === 'master' || user.role === 'admin' || req.isMaster) return next();
  return res.status(403).json({ error: 'tenant_admin_required' });
};
