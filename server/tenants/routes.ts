import { Router } from 'express';
import { db } from '../../db/index';
import { tenants, tenantUsers, tenantEmpresas, tenantGrupos, tenantGrupoMembros, users } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { tenantContext, requireTenant, requirePartner } from '../tenantContext';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

function generateTempPassword(): string {
  return randomBytes(6).toString('hex') + randomBytes(6).toString('hex');
}

function getModulesForPlan(plan: string): string[] {
  const map: Record<string, string[]> = {
    free:             ['xos', 'crm'],
    starter:          ['xos', 'crm', 'financeiro', 'production'],
    pro:              ['xos', 'crm', 'financeiro', 'production', 'rh', 'bi', 'valuation'],
    enterprise:       ['xos', 'crm', 'financeiro', 'production', 'rh', 'bi', 'valuation', 'governance', 'fisco', 'retail'],
    partner_starter:  ['xos', 'crm', 'financeiro', 'rh', 'bi', 'valuation'],
    partner_pro:      ['xos', 'crm', 'financeiro', 'rh', 'bi', 'valuation', 'governance', 'fisco'],
  };
  return map[plan] ?? map['starter'];
}

async function notifyConsultNewTenant(data: any): Promise<void> {
  if (!process.env.CONSULT_MCP_URL) return;
  await fetch(`${process.env.CONSULT_MCP_URL}/mcp/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-suite-secret': process.env.CONSULT_MCP_SECRET ?? '',
    },
    body: JSON.stringify({ tool: 'suite_tenant_created', params: data }),
    signal: AbortSignal.timeout(5000),
  });
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated?.()) return res.status(401).json({ error: 'Não autenticado' });
  next();
}

const router = Router();

// ── GET /api/tenants/mine ────────────────────────────────────────
// Lista todos os tenants que o usuário autenticado pode acessar
router.get('/mine', requireAuth, async (req, res) => {
  const user = req.user as any;
  try {
    const memberships = await db.select({
      tenantId: tenantUsers.tenantId,
      role:     tenantUsers.role,
      name:     tenants.name,
      type:     tenants.tenantType,
      plan:     tenants.plan,
      status:   tenants.status,
      slug:     tenants.slug,
    })
      .from(tenantUsers)
      .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
      .where(eq(tenantUsers.userId, user.id));

    // Se for partner ou master, incluir clients filhos
    const partnerTenants = memberships.filter(m => m.type === 'partner' || m.type === 'master');
    let clientTenants: any[] = [];

    for (const pt of partnerTenants) {
      const clients = await db.select().from(tenants)
        .where(eq(tenants.parentTenantId, pt.tenantId));
      clientTenants.push(...clients.map(c => ({
        tenantId: c.id,
        name:     c.name,
        type:     c.tenantType,
        plan:     c.plan,
        status:   c.status,
        slug:     c.slug,
        role:     'partner_admin',
        _viaPartner: pt.tenantId,
      })));
    }

    // Deduplicar (remove clients que o usuário já tem membership direta)
    const directIds = new Set(memberships.map(m => m.tenantId));
    const uniqueClients = clientTenants.filter(c => !directIds.has(c.tenantId));

    res.json({ tenants: [...memberships, ...uniqueClients] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tenants/switch ─────────────────────────────────────
// Troca o tenant ativo sem re-login
router.post('/switch', requireAuth, async (req, res) => {
  const { tenantId } = req.body;
  const user = req.user as any;

  if (!tenantId) return res.status(400).json({ error: 'tenantId obrigatório' });

  try {
    // Verificar acesso direto
    const [direct] = await db.select()
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.userId, user.id),
        eq(tenantUsers.tenantId, tenantId),
      ))
      .limit(1);

    if (!direct) {
      // Verificar acesso via partner parent
      const [target] = await db.select().from(tenants)
        .where(eq(tenants.id, tenantId)).limit(1);

      if (!target?.parentTenantId) {
        return res.status(403).json({ error: 'Acesso negado a este tenant' });
      }

      const [partnerMembership] = await db.select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, user.id),
          eq(tenantUsers.tenantId, target.parentTenantId),
        ))
        .limit(1);

      if (!partnerMembership) {
        // Verificar se é master
        const masterMemberships = await db.select({
          type: tenants.tenantType,
        })
          .from(tenantUsers)
          .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
          .where(and(
            eq(tenantUsers.userId, user.id),
            eq(tenants.tenantType, 'master'),
          ))
          .limit(1);

        if (masterMemberships.length === 0) {
          return res.status(403).json({ error: 'Acesso negado a este tenant' });
        }
      }
    }

    // Salvar na sessão
    (req.session as any).activeTenantId = tenantId;
    await req.session.save();

    const [tenant] = await db.select().from(tenants)
      .where(eq(tenants.id, tenantId)).limit(1);

    res.json({ success: true, tenant });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tenants/provision ──────────────────────────────────
// Cria tenant + usuário admin automaticamente
router.post('/provision', requireAuth, requirePartner, async (req, res) => {
  const {
    name, slug, email, plan, tenantType,
    parentTenantId, modules, adminName,
    cnpj, razaoSocial, nomeFantasia,
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'name e email são obrigatórios' });
  }

  try {
    let createdTenant: any;
    let createdUser: any;
    let activatedModules: string[] = [];

    await db.transaction(async (tx) => {
      // 1. Criar o tenant
      const [tenant] = await tx.insert(tenants).values({
        name,
        slug: slug ?? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        email,
        plan:           plan ?? 'starter',
        status:         'active',
        tenantType:     tenantType ?? 'client',
        parentTenantId: parentTenantId ?? (req.tenantId ?? undefined),
      }).returning();

      createdTenant = tenant;

      // 2. Criar usuário admin do tenant
      const tempPassword = generateTempPassword();
      const hashedPw = await hashPassword(tempPassword);

      const [adminUser] = await tx.insert(users).values({
        username: email,
        email,
        name:     adminName ?? name,
        password: hashedPw,
        role:     'admin',
        status:   'active',
      } as any).returning();

      createdUser = { ...adminUser, tempPassword };

      // 3. Vincular usuário ao tenant como owner
      await tx.insert(tenantUsers).values({
        tenantId: tenant.id,
        userId:   adminUser.id,
        role:     'owner',
        isOwner:  'true',
      });

      // 4. Ativar módulos do plano via features JSONB
      activatedModules = modules ?? getModulesForPlan(plan ?? 'starter');
      const features: Record<string, boolean | number | string> = {};
      for (const mod of activatedModules) {
        features[mod] = true;
      }
      await tx.update(tenants)
        .set({ features: features as any })
        .where(eq(tenants.id, tenant.id));

      // 5. Criar empresa matriz automaticamente se CNPJ informado (MP-05)
      if (cnpj) {
        await tx.insert(tenantEmpresas).values({
          tenantId: tenant.id,
          razaoSocial: razaoSocial ?? name,
          nomeFantasia: nomeFantasia ?? null,
          cnpj,
          tipo: 'matriz',
          status: 'active',
          email: email ?? null,
          ambienteFiscal: 'homologacao',
          serieNfe: 1,
          serieNfce: 1,
        } as any);
      }
    });

    // 6. Notificar Consult (fire-and-forget)
    notifyConsultNewTenant({
      tenantId:   createdTenant.id,
      tenantName: name,
      plan,
      tenantType,
    }).catch(console.warn);

    res.status(201).json({
      tenant:    createdTenant,
      adminUser: {
        id:          createdUser.id,
        email,
        tempPassword: createdUser.tempPassword,
      },
      modulesActivated: activatedModules,
    });
  } catch (err: any) {
    console.error('[tenants/provision] erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tenants/clients ──────────────────────────────────────
// Lista os tenants-cliente gerenciados pelo tenant ativo (partner ou master)
router.get('/clients', requireAuth, async (req, res) => {
  const user = req.user as any;
  try {
    // Determinar o tenant ativo (parceiro/master) via sessão
    const activeTenantId: number | null =
      (req.session as any).activeTenantId
        ? Number((req.session as any).activeTenantId)
        : null;

    if (!activeTenantId) {
      return res.status(400).json({ error: 'Nenhum tenant ativo na sessão' });
    }

    // Verificar se o usuário tem acesso a esse tenant
    const [membership] = await db.select()
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.tenantId, activeTenantId),
        eq(tenantUsers.userId, user.id),
      ))
      .limit(1);

    if (!membership) {
      return res.status(403).json({ error: 'Acesso negado ao tenant' });
    }

    // Buscar todos os tenants-cliente filhos deste tenant
    const clientTenants = await db.select({
      id:            tenants.id,
      name:          tenants.name,
      tradeName:     tenants.tradeName,
      cnpj:          tenants.cnpj,
      email:         tenants.email,
      phone:         tenants.phone,
      segment:       tenants.segment,
      status:        tenants.status,
      plan:          tenants.plan,
      tenantType:    tenants.tenantType,
      slug:          tenants.slug,
      createdAt:     tenants.createdAt,
    })
      .from(tenants)
      .where(eq(tenants.parentTenantId, activeTenantId))
      .orderBy(tenants.name);

    res.json(clientTenants);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tenants/list ─────────────────────────────────────────
// Lista todos tenants (master only)
router.get('/list', requireAuth, async (req, res) => {
  try {
    const allTenants = await db.select().from(tenants)
      .orderBy(tenants.createdAt);
    res.json({ tenants: allTenants });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tenants/set-context ────────────────────────────────
// Salva empresa/grupo ativo na sessão
router.post('/set-context', requireAuth, tenantContext, async (req, res) => {
  const { empresaId, grupoId } = req.body;
  if (empresaId !== undefined) (req.session as any).activeEmpresaId = empresaId ?? null;
  if (grupoId   !== undefined) (req.session as any).activeGrupoId   = grupoId   ?? null;
  await new Promise<void>((resolve, reject) =>
    req.session.save((err: any) => err ? reject(err) : resolve())
  );
  res.json({ ok: true, activeEmpresaId: empresaId, activeGrupoId: grupoId });
});

// ── GET /api/tenants/my-context ───────────────────────────────────
// Retorna empresas e grupos disponíveis + contexto ativo
router.get('/my-context', requireAuth, tenantContext, async (req: any, res) => {
  const tenantId = req.tenantId ? Number(req.tenantId) : null;
  if (!tenantId) return res.json({
    activeEmpresaId: null, activeEmpresaNome: null,
    activeGrupoId: null, activeGrupoNome: null,
    visaoConsolidada: false, empresas: [], grupos: [],
  });

  try {
    const empresas = await db.select({
      id:           tenantEmpresas.id,
      razaoSocial:  tenantEmpresas.razaoSocial,
      nomeFantasia: tenantEmpresas.nomeFantasia,
      cnpj:         tenantEmpresas.cnpj,
      tipo:         tenantEmpresas.tipo,
      status:       tenantEmpresas.status,
    })
      .from(tenantEmpresas)
      .where(and(
        eq(tenantEmpresas.tenantId, tenantId),
        sql`${tenantEmpresas.status} != 'inactive'`,
      ));

    const gruposRaw = await db
      .select({
        id:     tenantGrupos.id,
        nome:   tenantGrupos.nome,
        tipo:   tenantGrupos.tipo,
      })
      .from(tenantGrupos)
      .where(and(
        eq(tenantGrupos.tenantId, tenantId),
        eq(tenantGrupos.ativo, true),
      ));

    const grupos = await Promise.all(gruposRaw.map(async (g) => {
      const membros = await db.select({ id: tenantGrupoMembros.id })
        .from(tenantGrupoMembros)
        .where(eq(tenantGrupoMembros.grupoId, g.id));
      return { ...g, totalEmpresas: membros.length };
    }));

    res.json({
      activeEmpresaId:   req.activeEmpresaId   ?? null,
      activeEmpresaNome: req.activeEmpresaNome ?? null,
      activeGrupoId:     req.activeGrupoId     ?? null,
      activeGrupoNome:   req.activeGrupoNome   ?? null,
      visaoConsolidada:  req.visaoConsolidada  ?? false,
      empresas,
      grupos,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tenants/:id/members ─────────────────────────────────
router.get('/:id/members', requireAuth, async (req, res) => {
  try {
    const members = await db.select({
      id:       tenantUsers.id,
      userId:   tenantUsers.userId,
      role:     tenantUsers.role,
      isOwner:  tenantUsers.isOwner,
      username: users.username,
      name:     users.name,
      email:    users.email,
    })
      .from(tenantUsers)
      .innerJoin(users, eq(users.id, tenantUsers.userId))
      .where(eq(tenantUsers.tenantId, Number(req.params.id)));
    res.json({ members });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
