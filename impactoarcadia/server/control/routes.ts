import type { Express } from "express";
import { db } from "../db";
import {
  planosContas, centrosCusto, contasBancarias, lancamentosFinanceiros, periodosCompetencia,
  clients, crmClients,
  tenantEmpresas,
  gruposParcelamento, templatesRecorrencia, tiposDocumento,
  orcamentosMensais,
  insertCentroCustoSchema, insertContaBancariaSchema, insertLancamentoFinanceiroSchema, insertPeriodoCompetenciaSchema,
  insertTemplateRecorrenciaSchema, insertTipoDocumentoSchema,
} from "@shared/schema";
import { and, eq, desc, asc, sql, gte, lte, inArray, or, isNull } from "drizzle-orm";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { seedPlanoContasIfNeeded } from "./seedPlanoContas";
import { attachSprint45Routes } from "./routesNovas";
import { attachCartaoRoutes } from "./routes_cartao";
import { parseValorBR } from "@shared/parse-valor";
import { getProjectedCashFlow } from "./cashFlowProjection";
import {
  createCentroCusto as svcCreateCC,
  updateCentroCusto as svcUpdateCC,
  importBulkCentrosCusto,
  calcOrcamentoUtilizado,
  type ImportRow,
} from "./centroCustoService";
import { getRateios, setRateios } from "./rateioService";
import { listRateioConfigs, upsertRateioConfig, gerarRateioAutomatico, getRelatorioRateio } from "./rateioAutoService";
import { parsePreview as parsePlanilhaPreview, confirmImport as confirmPlanilhaImport, parseOrcamentoPlanilha, parsePreviewCompleto, confirmImportCompleto } from "./planilhaImportService";
import multer from "multer";
import { pool } from "../../db/index";
import { conciliarLancamento, desconciliarLancamento, getExtratoConta } from "./conciliacaoService";
import { criarLancamentoParcelado, alterarGrupoParcelamento } from "./parcelamentoService";
import { transferirEntreContas, definirSaldoInicial } from "./transferenciasService";
import { processarRecorrencias, processarTemplate } from "./recorrenciaEngine";
import { statusCalcSql } from "./statusCalc";
import { getMatriz as orcMatriz, upsertBatch as orcUpsert, getComparativo as orcComparativo } from "./orcamentoService";
import { getFluxoCaixaMensal, getFluxoCaixaDiario } from "./fluxoCaixaService";
import { getDreComAv } from "./dreService";
import { getPmpPmr, getPmpPmrHistorico } from "./kpiAvancadoService";
import { seedPlanoContasImpacto } from "./seeds/planoContasImpacto";
import { seedCCsImpacto } from "./seeds/ccImpacto";
import { getPivot } from "./carteiraPivotService";
import { listCarteiras, aprovarLancamento, getExerciciosDisponiveis } from "./carteiraService";

// Chain padrão: precisa rodar tenantContext explicitamente porque essas rotas
// são registradas antes do app.use(tenantContext) global.
const auth = [isAuthenticated, tenantContext, requireTenant];

// Helpers ────────────────────────────────────────────────────────────────────

/**
 * Provisiona automaticamente um workspace na tabela `clients` a partir de um
 * cliente do CRM (crm_clients). O `clienteId` passado é o ID inteiro do CRM
 * convertido para string (e.g. "1", "2").
 */
async function provisionFromCRM(clienteId: string, tenantId: string | number): Promise<boolean> {
  const crmId = parseInt(clienteId, 10);
  if (isNaN(crmId)) return false;

  const [crm] = await db.select()
    .from(crmClients)
    .where(eq(crmClients.id, crmId))
    .limit(1);
  if (!crm) return false;

  // Verifica se já existe registro provisionado
  const [existing] = await db.select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clienteId))
    .limit(1);
  if (existing) return true;

  // Cria registro usando o ID do CRM como chave
  await db.insert(clients).values({
    id: clienteId,
    tenantId: String(tenantId),
    name: crm.name,
    company: crm.tradeName ?? undefined,
    cnpj: crm.cnpj ?? undefined,
    email: crm.email ?? undefined,
    phone: crm.phone ?? undefined,
    status: "ativo",
  });
  return true;
}

/**
 * Provisiona workspace na tabela `clients` a partir de tenant_empresas.
 * Chamado quando clienteId é um ID inteiro de tenant_empresas
 * (fluxo Manager Partners → Control).
 */
async function provisionFromTenantEmpresa(
  clienteId: string,
  tenantId: string | number,
): Promise<boolean> {
  const empresaId = parseInt(clienteId, 10);
  if (isNaN(empresaId)) return false;

  const [empresa] = await db.select()
    .from(tenantEmpresas)
    .where(eq(tenantEmpresas.id, empresaId))
    .limit(1);
  if (!empresa) return false;

  // Verifica se a empresa pertence ao tenant correto
  if (String(empresa.tenantId) !== String(tenantId)) return false;

  // Verifica se já existe registro provisionado na tabela clients
  const [existing] = await db.select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clienteId))
    .limit(1);
  if (existing) return true;

  // Cria na tabela clients usando o ID de tenant_empresas como PK
  await db.insert(clients).values({
    id: clienteId,
    tenantId: String(tenantId),
    name: empresa.nomeFantasia ?? empresa.razaoSocial,
    company: empresa.razaoSocial,
    cnpj: empresa.cnpj ?? undefined,
    email: empresa.email ?? undefined,
    phone: empresa.phone ?? undefined,
    status: "ativo",
  });

  console.log(`[control] Provisionado workspace para empresa ${empresa.razaoSocial} (id=${clienteId})`);
  return true;
}

async function clienteBelongsToTenant(clienteId: string, tenantId: string): Promise<boolean> {
  // 1. Verificar se já existe na tabela clients (qualquer tenantId — o workspace foi provisionado
  //    com o ID do tenant_empresas como PK, mas o tenant pode variar conforme o fluxo de acesso)
  const [c] = await db.select({ id: clients.id, tenantId: clients.tenantId })
    .from(clients)
    .where(eq(clients.id, clienteId))
    .limit(1);
  if (c) {
    // Se o tenant bate exatamente, OK imediato
    if (c.tenantId === tenantId) return true;
    // Se não bate, confirmar que o tenant_empresas desse id pertence ao tenant solicitante
    const empresaId = parseInt(clienteId, 10);
    if (!isNaN(empresaId)) {
      const [emp] = await db.select({ tenantId: tenantEmpresas.tenantId })
        .from(tenantEmpresas).where(eq(tenantEmpresas.id, empresaId)).limit(1);
      if (emp && String(emp.tenantId) === tenantId) return true;
    }
  }

  // 2. Tentar provisionar a partir de tenant_empresas (Manager Partners)
  //    Fluxo principal: clienteId = ID numérico de tenant_empresas
  const fromEmpresa = await provisionFromTenantEmpresa(clienteId, tenantId);
  if (fromEmpresa) return true;

  // 3. Fallback: tentar provisionar a partir de crmClients (fluxo legado)
  return provisionFromCRM(clienteId, tenantId);
}

async function planoContaBelongsToTenant(id: string, tenantId: string): Promise<boolean> {
  const [r] = await db.select({ id: planosContas.id }).from(planosContas)
    .where(and(eq(planosContas.id, id), eq(planosContas.tenantId, tenantId))).limit(1);
  return !!r;
}

async function centroCustoBelongsToCliente(id: string, tenantId: string, clienteId: string): Promise<boolean> {
  const [r] = await db.select({ id: centrosCusto.id }).from(centrosCusto)
    .where(and(eq(centrosCusto.id, id), eq(centrosCusto.tenantId, tenantId), eq(centrosCusto.clienteId, clienteId))).limit(1);
  return !!r;
}

async function contaBancariaBelongsToCliente(id: string, tenantId: string, clienteId: string): Promise<boolean> {
  const [r] = await db.select({ id: contasBancarias.id }).from(contasBancarias)
    .where(and(eq(contasBancarias.id, id), eq(contasBancarias.tenantId, tenantId), eq(contasBancarias.clienteId, clienteId))).limit(1);
  return !!r;
}

/** Valida cross-tenant/cross-cliente nas FKs do lançamento. */
async function validateLancamentoRefs(
  data: { planoContaId?: string | null; centroCustoId?: string | null; contaBancariaId?: string | null },
  tenantId: string,
  clienteId: string,
): Promise<string | null> {
  if (data.planoContaId && !(await planoContaBelongsToTenant(data.planoContaId, tenantId))) {
    return "Plano de conta inválido para este tenant";
  }
  if (data.centroCustoId && !(await centroCustoBelongsToCliente(data.centroCustoId, tenantId, clienteId))) {
    return "Centro de custo inválido para este cliente";
  }
  if (data.contaBancariaId && !(await contaBancariaBelongsToCliente(data.contaBancariaId, tenantId, clienteId))) {
    return "Conta bancária inválida para este cliente";
  }
  return null;
}

const lancUpdateSchema = z.object({
  tipo: z.enum(["pagar", "receber"]).optional(),
  descricao: z.string().min(1).optional(),
  favorecido: z.string().optional().nullable(),
  documento: z.string().optional().nullable(),
  valor: z.union([z.number(), z.string()]).optional(),
  dataEmissao: z.string().optional().nullable(),
  dataVencimento: z.string().optional(),
  dataPagamento: z.string().optional().nullable(),
  status: z.enum(["previsto", "aprovado", "pago", "vencido", "cancelado", "inadimplente"]).optional(),
  planoContaId: z.string().optional().nullable(),
  centroCustoId: z.string().optional().nullable(),
  contaBancariaId: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

// centroPatchSchema removido — validação agora vive em centroCustoService.updateCentroCusto
// para que regras de tipo=projeto (datas obrigatórias) e parent (mesmo cliente) sejam centralizadas.

const contaBancariaPatchSchema = z.object({
  banco: z.string().min(1).max(150).optional(),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
  tipo: z.enum(["cc", "cp", "investimento"]).optional(),
  saldoInicial: z.union([z.number(), z.string()]).optional(),
  saldoAtual: z.union([z.number(), z.string()]).optional(),
  ativo: z.boolean().optional(),
});

export function registerControlRoutes(app: Express) {
  // ────────── Workspace bootstrap (seed do plano de contas)
  app.post("/api/control/bootstrap", ...auth, async (req: any, res) => {
    try {
      const r = await seedPlanoContasIfNeeded(req.tenantId);
      res.json(r);
    } catch (e: any) {
      console.error("[control] bootstrap:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── CTL-04: Seed Plano de Contas Engineering (Impacto) ───────────────────────
  app.post("/api/control/clientes/:clienteId/plano-contas/seed-engineering", ...auth, async (req: any, res) => {
    try {
      const result = await seedPlanoContasImpacto(req.tenantId);
      res.json({
        ok: true,
        mensagem: `Plano de contas: ${result.created} criados, ${result.skipped} já existiam`,
        ...result,
      });
    } catch (e: any) {
      console.error("[control] seed-plano-contas:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── CTL-04: Seed CCs Série 1100 Engineering (Impacto) ───────────────────────
  app.post("/api/control/clientes/:clienteId/centros-custo/seed-engineering", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const result = await seedCCsImpacto(clienteId, req.tenantId);
      res.json({
        ok: true,
        mensagem: `CCs: ${result.created} criados, ${result.skipped} já existiam`,
        criados: result.created,
        existentes: result.skipped,
        ...result,
      });
    } catch (e: any) {
      console.error("[control] seed-ccs:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ────────── Plano de Contas (compartilhado por tenant)
  app.get("/api/control/planos-contas", ...auth, async (req: any, res) => {
    const rows = await db.select().from(planosContas)
      .where(eq(planosContas.tenantId, req.tenantId))
      .orderBy(asc(planosContas.codigo));
    res.json(rows);
  });

  // Cria conta no plano (CRUD completo)
  const planoCreateSchema = z.object({
    codigo: z.string().trim().min(1).max(30),
    descricao: z.string().trim().min(1).max(300),
    natureza: z.enum(["ativo", "passivo", "patrimonio_liquido", "receita", "custo", "despesa", "resultado"]),
    nivel: z.number().int().min(1).max(8).default(1),
    parentId: z.string().optional().nullable(),
    naturezaDre: z.string().max(30).optional().nullable(),
    permiteLancamento: z.boolean().default(true),
    ativo: z.boolean().default(true),
    // Sprint C6 — extensão Domínio CFC / DRE
    codigoCfc: z.string().max(30).optional().nullable(),
    tipoConta: z.enum(["sintetica", "analitica"]).optional().nullable(),
    grupoDre: z.string().max(50).optional().nullable(),
  });
  app.post("/api/control/planos-contas", ...auth, async (req: any, res) => {
    try {
      const parsed = planoCreateSchema.parse(req.body);
      // Valida parent (se houver) — precisa estar no mesmo tenant
      if (parsed.parentId && !(await planoContaBelongsToTenant(parsed.parentId, req.tenantId))) {
        return res.status(400).json({ message: "Conta pai inválida para este tenant" });
      }
      // Verifica unicidade do código
      const [existe] = await db.select({ id: planosContas.id }).from(planosContas)
        .where(and(eq(planosContas.tenantId, req.tenantId), eq(planosContas.codigo, parsed.codigo)))
        .limit(1);
      if (existe) return res.status(409).json({ message: `Código '${parsed.codigo}' já existe` });

      const [row] = await db.insert(planosContas).values({
        tenantId: String(req.tenantId),
        codigo: parsed.codigo,
        descricao: parsed.descricao,
        natureza: parsed.natureza,
        nivel: parsed.nivel,
        parentId: parsed.parentId ?? null,
        naturezaDre: parsed.naturezaDre ?? null,
        permiteLancamento: parsed.permiteLancamento,
        ativo: parsed.ativo,
        // Sprint C6
        codigoCfc: parsed.codigoCfc ?? null,
        tipoConta: parsed.tipoConta ?? null,
        grupoDre: parsed.grupoDre ?? null,
      }).returning();
      res.status(201).json(row);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      console.error("[control] plano create:", e);
      res.status(500).json({ message: e.message });
    }
  });

  const planoPatchSchema = planoCreateSchema.partial();
  app.patch("/api/control/planos-contas/:id", ...auth, async (req: any, res) => {
    try {
      const { id } = req.params;
      if (!(await planoContaBelongsToTenant(id, req.tenantId))) return res.status(404).json({ message: "Conta não encontrada" });
      const parsed = planoPatchSchema.parse(req.body);

      // Bloqueia auto-referência (parent = self) e ciclo direto
      if (parsed.parentId === id) return res.status(400).json({ message: "Conta não pode ser pai dela mesma" });
      if (parsed.parentId) {
        if (!(await planoContaBelongsToTenant(parsed.parentId, req.tenantId))) {
          return res.status(400).json({ message: "Conta pai inválida para este tenant" });
        }
        // Detecta ciclo: caminhar para cima a partir do novo parent procurando por id
        let cursor: string | null = parsed.parentId;
        const visitados = new Set<string>();
        while (cursor) {
          if (cursor === id) return res.status(400).json({ message: "Atribuir esse pai criaria um ciclo na hierarquia" });
          if (visitados.has(cursor)) break;
          visitados.add(cursor);
          const [p] = await db.select({ parentId: planosContas.parentId }).from(planosContas)
            .where(and(eq(planosContas.id, cursor), eq(planosContas.tenantId, req.tenantId))).limit(1);
          cursor = (p?.parentId as string | null) ?? null;
        }
      }

      // Se mudar codigo, valida unicidade
      if (parsed.codigo) {
        const [conflito] = await db.select({ id: planosContas.id }).from(planosContas)
          .where(and(eq(planosContas.tenantId, req.tenantId), eq(planosContas.codigo, parsed.codigo)))
          .limit(1);
        if (conflito && conflito.id !== id) return res.status(409).json({ message: `Código '${parsed.codigo}' já existe` });
      }

      const update: any = {};
      for (const k of Object.keys(parsed) as (keyof typeof parsed)[]) {
        const v = parsed[k];
        if (v !== undefined) update[k] = v;
      }
      const [row] = await db.update(planosContas).set(update)
        .where(and(eq(planosContas.id, id), eq(planosContas.tenantId, req.tenantId)))
        .returning();
      res.json(row);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      console.error("[control] plano patch:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/control/planos-contas/:id", ...auth, async (req: any, res) => {
    try {
      const { id } = req.params;
      if (!(await planoContaBelongsToTenant(id, req.tenantId))) return res.status(404).json({ message: "Conta não encontrada" });

      // Não pode excluir se houver lançamentos referenciando
      const [usado] = await db.select({ c: sql<number>`count(*)::int` }).from(lancamentosFinanceiros)
        .where(and(eq(lancamentosFinanceiros.tenantId, req.tenantId), eq(lancamentosFinanceiros.planoContaId, id)));
      if (Number(usado?.c || 0) > 0) {
        return res.status(409).json({ message: `Existem ${usado.c} lançamentos vinculados — desative ao invés de excluir` });
      }
      // Não pode excluir se tiver filhos
      const [filhos] = await db.select({ c: sql<number>`count(*)::int` }).from(planosContas)
        .where(and(eq(planosContas.tenantId, req.tenantId), eq(planosContas.parentId, id)));
      if (Number(filhos?.c || 0) > 0) {
        return res.status(409).json({ message: `Conta possui ${filhos.c} sub-contas — exclua ou re-aloque os filhos primeiro` });
      }

      await db.delete(planosContas).where(and(eq(planosContas.id, id), eq(planosContas.tenantId, req.tenantId)));
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[control] plano delete:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // Contagem de uso (lançamentos por conta) — para a UI mostrar quanto cada conta movimentou
  app.get("/api/control/planos-contas/uso", ...auth, async (req: any, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT plano_conta_id AS id, COUNT(*)::int AS qtd, COALESCE(SUM(valor),0)::float AS total
        FROM lancamentos_financeiros
        WHERE tenant_id = ${req.tenantId} AND plano_conta_id IS NOT NULL
        GROUP BY plano_conta_id
      `);
      res.json(rows.rows);
    } catch (e: any) {
      console.error("[control] plano uso:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ────────── Workspace overview por cliente (KPIs do dashboard)
  app.get("/api/control/clientes/:clienteId/overview", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });

      const today = new Date().toISOString().slice(0, 10);
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      const agg = await db.execute(sql`
        WITH base AS (
          SELECT tipo, status, valor, data_vencimento, data_pagamento
          FROM lancamentos_financeiros
          WHERE tenant_id = ${req.tenantId} AND cliente_id = ${clienteId}
        )
        SELECT
          COALESCE(SUM(CASE WHEN tipo='pagar' AND status NOT IN ('pago','cancelado') AND data_vencimento <= ${today} THEN valor ELSE 0 END),0) AS a_pagar_vencidos,
          COALESCE(SUM(CASE WHEN tipo='pagar' AND status NOT IN ('pago','cancelado') AND data_vencimento BETWEEN ${today} AND ${in7} THEN valor ELSE 0 END),0) AS a_pagar_7d,
          COALESCE(SUM(CASE WHEN tipo='pagar' AND status NOT IN ('pago','cancelado') AND data_vencimento BETWEEN ${today} AND ${in30} THEN valor ELSE 0 END),0) AS a_pagar_30d,
          COALESCE(SUM(CASE WHEN tipo='receber' AND status NOT IN ('pago','cancelado') AND data_vencimento <= ${today} THEN valor ELSE 0 END),0) AS a_receber_vencidos,
          COALESCE(SUM(CASE WHEN tipo='receber' AND status NOT IN ('pago','cancelado') AND data_vencimento BETWEEN ${today} AND ${in7} THEN valor ELSE 0 END),0) AS a_receber_7d,
          COALESCE(SUM(CASE WHEN tipo='receber' AND status NOT IN ('pago','cancelado') AND data_vencimento BETWEEN ${today} AND ${in30} THEN valor ELSE 0 END),0) AS a_receber_30d,
          COALESCE(SUM(CASE WHEN status='pago' AND tipo='pagar' AND date_trunc('month', data_pagamento::timestamp) = date_trunc('month', now()) THEN valor ELSE 0 END),0) AS pago_mes,
          COALESCE(SUM(CASE WHEN status='pago' AND tipo='receber' AND date_trunc('month', data_pagamento::timestamp) = date_trunc('month', now()) THEN valor ELSE 0 END),0) AS recebido_mes,
          COUNT(*) FILTER (WHERE status='previsto') AS pendentes_aprovacao,
          COUNT(*) AS total_lancamentos
        FROM base;
      `);
      const k = (agg.rows[0] || {}) as any;

      const sal = await db.execute(sql`
        SELECT COALESCE(SUM(saldo_atual),0) AS saldo_total, COUNT(*) AS contas
        FROM contas_bancarias
        WHERE tenant_id = ${req.tenantId} AND cliente_id = ${clienteId} AND ativo = true;
      `);
      const s = (sal.rows[0] || {}) as any;

      res.json({
        aPagarVencidos: Number(k.a_pagar_vencidos || 0),
        aPagar7d: Number(k.a_pagar_7d || 0),
        aPagar30d: Number(k.a_pagar_30d || 0),
        aReceberVencidos: Number(k.a_receber_vencidos || 0),
        aReceber7d: Number(k.a_receber_7d || 0),
        aReceber30d: Number(k.a_receber_30d || 0),
        pagoMes: Number(k.pago_mes || 0),
        recebidoMes: Number(k.recebido_mes || 0),
        pendentesAprovacao: Number(k.pendentes_aprovacao || 0),
        totalLancamentos: Number(k.total_lancamentos || 0),
        saldoBancarioTotal: Number(s.saldo_total || 0),
        totalContasBancarias: Number(s.contas || 0),
      });
    } catch (e: any) {
      console.error("[control] overview:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── CTL-07: Dashboard Executivo Completo ─────────────────────────────────────
  app.get("/api/control/clientes/:clienteId/dashboard-completo", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const tenantId = req.tenantId;
      const meses = Math.max(1, Math.min(24, parseInt(String(req.query.meses ?? "1"), 10)));

      // ── Contas bancárias com saldo ──────────────────────────────────────────
      const contasRows = await db.select({
        id:           contasBancarias.id,
        banco:        contasBancarias.banco,
        agencia:      contasBancarias.agencia,
        conta:        contasBancarias.conta,
        tipo:         contasBancarias.tipo,
        saldoAtual:   contasBancarias.saldoAtual,
        saldoInicial: contasBancarias.saldoInicial,
        ativo:        contasBancarias.ativo,
      }).from(contasBancarias)
        .where(and(
          eq(contasBancarias.tenantId, tenantId),
          eq(contasBancarias.clienteId, clienteId),
          eq(contasBancarias.ativo, true),
        ))
        .orderBy(asc(contasBancarias.banco));

      // ── Corte de data para top clientes/fornecedores ────────────────────────
      const dataCorte = new Date();
      dataCorte.setMonth(dataCorte.getMonth() - meses);
      const dataCorteStr = dataCorte.toISOString().slice(0, 10);

      // ── Top clientes (por AR recebido no período) ───────────────────────────
      const topClientesRows = await db.execute(sql`
        SELECT
          COALESCE(favorecido, 'Sem identificação') AS nome,
          pessoa_id,
          SUM(valor)  AS total,
          COUNT(*)    AS qtd_lancamentos,
          AVG(CASE
            WHEN data_pagamento IS NOT NULL AND data_emissao IS NOT NULL
            THEN EXTRACT(DAY FROM data_pagamento::timestamp - data_emissao::timestamp)
            ELSE NULL
          END)::numeric(6,1) AS pmr_dias
        FROM lancamentos_financeiros
        WHERE tenant_id   = ${tenantId}
          AND cliente_id  = ${clienteId}
          AND tipo        = 'receber'
          AND status      = 'pago'
          AND data_pagamento >= ${dataCorteStr}
        GROUP BY favorecido, pessoa_id
        ORDER BY total DESC
        LIMIT 10
      `);

      // ── Top fornecedores (por AP pago no período) ───────────────────────────
      const topFornecedoresRows = await db.execute(sql`
        SELECT
          COALESCE(favorecido, 'Sem identificação') AS nome,
          pessoa_id,
          SUM(valor)  AS total,
          COUNT(*)    AS qtd_lancamentos
        FROM lancamentos_financeiros
        WHERE tenant_id   = ${tenantId}
          AND cliente_id  = ${clienteId}
          AND tipo        = 'pagar'
          AND status      = 'pago'
          AND data_pagamento >= ${dataCorteStr}
        GROUP BY favorecido, pessoa_id
        ORDER BY total DESC
        LIMIT 10
      `);

      // ── Resumo orçamento do mês atual ───────────────────────────────────────
      const hoje = new Date();
      const anoAtual  = hoje.getFullYear();
      const mesAtual  = hoje.getMonth() + 1;

      const orcRows = await db.execute(sql`
        SELECT
          COALESCE(SUM(o.valor_previsto::numeric), 0) AS previsto,
          COALESCE(SUM(
            CASE WHEN l.status = 'pago' THEN l.valor::numeric ELSE 0 END
          ), 0) AS realizado
        FROM orcamentos_mensais o
        LEFT JOIN lancamentos_financeiros l ON
              l.tenant_id     = o.tenant_id
          AND l.cliente_id    = ${clienteId}
          AND l.plano_conta_id = o.plano_conta_id
          AND EXTRACT(YEAR  FROM l.data_pagamento::timestamp) = ${anoAtual}
          AND EXTRACT(MONTH FROM l.data_pagamento::timestamp) = ${mesAtual}
          AND l.status = 'pago'
          AND l.tipo   = 'pagar'
        WHERE o.tenant_id = ${tenantId}
          AND o.ano       = ${anoAtual}
          AND o.mes       = ${mesAtual}
      `);

      const orc      = ((orcRows.rows ?? orcRows as any)[0] || {}) as any;
      const previsto  = Number(orc.previsto  || 0);
      const realizado = Number(orc.realizado || 0);
      const desvio    = previsto > 0 ? (realizado - previsto) / previsto * 100 : null;

      // ── CTL-03-D: alertas por grupo (desvio > 10%) ──────────────────────
      const alertasOrc = await pool.query(`
        SELECT
          COALESCE(p.grupo_dre, p.natureza, 'Outros') AS grupo,
          SUM(o.valor_previsto::numeric)               AS previsto,
          COALESCE(SUM(
            CASE WHEN l.status IN ('pago','recebido') THEN l.valor::numeric ELSE 0 END
          ), 0)                                        AS realizado
        FROM orcamentos_mensais o
        JOIN planos_contas p ON p.id = o.plano_conta_id
        LEFT JOIN lancamentos_financeiros l ON
          l.plano_conta_id = o.plano_conta_id
          AND l.cliente_id = o.cliente_id
          AND EXTRACT(YEAR  FROM l.data_pagamento::timestamp) = o.ano
          AND EXTRACT(MONTH FROM l.data_pagamento::timestamp) = o.mes
          AND l.status IN ('pago','recebido')
        WHERE o.tenant_id  = $1
          AND o.cliente_id = $2
          AND o.ano        = $3
          AND o.mes        = $4
        GROUP BY COALESCE(p.grupo_dre, p.natureza, 'Outros')
        HAVING SUM(o.valor_previsto::numeric) > 0
      `, [tenantId, clienteId, anoAtual, mesAtual]);

      const alertasOrcamento = (alertasOrc.rows as any[])
        .map((r: any) => {
          const prev = Number(r.previsto);
          const real = Number(r.realizado);
          const desv = prev > 0 ? (real - prev) / prev * 100 : 0;
          return { grupo: r.grupo, previsto: prev, realizado: real, desvio: desv };
        })
        .filter((r) => Math.abs(r.desvio) > 10)
        .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio));

      res.json({
        contas: contasRows.map(c => ({
          ...c,
          saldoAtual:   Number(c.saldoAtual   || 0),
          saldoInicial: Number(c.saldoInicial  || 0),
        })),
        topClientes: (topClientesRows.rows ?? topClientesRows as any).map((r: any) => ({
          nome:           String(r.nome ?? "Sem identificação"),
          pessoaId:       r.pessoa_id ?? null,
          total:          Number(r.total || 0),
          qtdLancamentos: Number(r.qtd_lancamentos || 0),
          pmrDias:        r.pmr_dias != null ? Number(r.pmr_dias) : null,
        })),
        topFornecedores: (topFornecedoresRows.rows ?? topFornecedoresRows as any).map((r: any) => ({
          nome:           String(r.nome ?? "Sem identificação"),
          pessoaId:       r.pessoa_id ?? null,
          total:          Number(r.total || 0),
          qtdLancamentos: Number(r.qtd_lancamentos || 0),
        })),
        orcamentoMes:      { previsto, realizado, desvio, mes: mesAtual, ano: anoAtual },
        alertasOrcamento,
      });
    } catch (e: any) {
      console.error("[control] dashboard-completo:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ────────── Projeção de caixa (Sprint 3 Recovery)
  app.get("/api/control/clientes/:clienteId/cash-flow-projection", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const months = Math.max(1, Math.min(24, Number(req.query.months ?? 6)));
      const series = await getProjectedCashFlow(req.tenantId, clienteId, months);
      res.json({ series, months });
    } catch (e: any) {
      console.error("[control] cash-flow-projection:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ────────── Lançamentos Financeiros
  app.get("/api/control/clientes/:clienteId/lancamentos", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
      const { tipo, status, dataIni, dataFim, q, campoData } = req.query as any;

      const filters: any[] = [
        eq(lancamentosFinanceiros.tenantId, req.tenantId),
        eq(lancamentosFinanceiros.clienteId, clienteId),
      ];
      if (tipo && (tipo === "pagar" || tipo === "receber")) filters.push(eq(lancamentosFinanceiros.tipo, tipo));
      if (status) filters.push(eq(lancamentosFinanceiros.status, status));

      // Campo de data para o intervalo (vencimento padrão; permite emissao ou pagamento)
      const colMap: Record<string, any> = {
        vencimento: lancamentosFinanceiros.dataVencimento,
        emissao: lancamentosFinanceiros.dataEmissao,
        pagamento: lancamentosFinanceiros.dataPagamento,
      };
      const dataCol = colMap[String(campoData || "vencimento")] ?? lancamentosFinanceiros.dataVencimento;
      if (dataIni) filters.push(gte(dataCol, dataIni));
      if (dataFim) filters.push(lte(dataCol, dataFim));
      if (q) filters.push(sql`(${lancamentosFinanceiros.descricao} ILIKE ${"%" + q + "%"} OR ${lancamentosFinanceiros.favorecido} ILIKE ${"%" + q + "%"} OR ${lancamentosFinanceiros.documento} ILIKE ${"%" + q + "%"})`);

      // Sprint C7 — G6: status calculado virtual (pago/cancelado/atrasado/vence_hoje/em_dia)
      const rows = await db.select({
        id: lancamentosFinanceiros.id,
        tenantId: lancamentosFinanceiros.tenantId,
        clienteId: lancamentosFinanceiros.clienteId,
        tipo: lancamentosFinanceiros.tipo,
        descricao: lancamentosFinanceiros.descricao,
        favorecido: lancamentosFinanceiros.favorecido,
        documento: lancamentosFinanceiros.documento,
        valor: lancamentosFinanceiros.valor,
        dataEmissao: lancamentosFinanceiros.dataEmissao,
        dataVencimento: lancamentosFinanceiros.dataVencimento,
        dataPagamento: lancamentosFinanceiros.dataPagamento,
        status: lancamentosFinanceiros.status,
        statusCalc: statusCalcSql.as("status_calc"),
        planoContaId: lancamentosFinanceiros.planoContaId,
        centroCustoId: lancamentosFinanceiros.centroCustoId,
        contaBancariaId: lancamentosFinanceiros.contaBancariaId,
        origem: lancamentosFinanceiros.origem,
        criadoPorIa: lancamentosFinanceiros.criadoPorIa,
        criadoPor: lancamentosFinanceiros.criadoPor,
        aprovadoPor: lancamentosFinanceiros.aprovadoPor,
        aprovadoEm: lancamentosFinanceiros.aprovadoEm,
        observacoes: lancamentosFinanceiros.observacoes,
        grupoId: lancamentosFinanceiros.grupoId,
        recoveryInstallmentId: lancamentosFinanceiros.recoveryInstallmentId,
        grupoParcelamentoId: lancamentosFinanceiros.grupoParcelamentoId,
        numeroParcela: lancamentosFinanceiros.numeroParcela,
        totalParcelas: lancamentosFinanceiros.totalParcelas,
        templateRecorrenciaId: lancamentosFinanceiros.templateRecorrenciaId,
        origemRecorrencia: lancamentosFinanceiros.origemRecorrencia,
        tipoDocumentoId: lancamentosFinanceiros.tipoDocumentoId,
        createdAt: lancamentosFinanceiros.createdAt,
        updatedAt: lancamentosFinanceiros.updatedAt,
        // Workflow de pagamentos (coluna adicionada por migration)
        workflowStatus: sql<string | null>`"lancamentos_financeiros"."workflow_status"`,
      }).from(lancamentosFinanceiros)
        .where(and(...filters))
        .orderBy(asc(lancamentosFinanceiros.dataVencimento), desc(lancamentosFinanceiros.createdAt))
        .limit(500);
      res.json(rows);
    } catch (e: any) {
      console.error("[control] lancamentos list:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/control/clientes/:clienteId/lancamentos", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
      const userId = req.user?.claims?.sub || req.user?.id;
      // Normaliza campos de data: string vazia → null (PostgreSQL rejeita "")
      const bodyNorm = {
        ...req.body,
        dataEmissao: req.body.dataEmissao || null,
        dataPagamento: req.body.dataPagamento || null,
        tenantId: String(req.tenantId),
        clienteId,
        criadoPor: userId,
      };
      const parsed = insertLancamentoFinanceiroSchema.parse(bodyNorm);
      // Cross-tenant FK validation
      const fkErr = await validateLancamentoRefs(parsed as any, String(req.tenantId), clienteId);
      if (fkErr) return res.status(400).json({ message: fkErr });

      const [row] = await db.insert(lancamentosFinanceiros).values(parsed as any).returning();
      res.status(201).json(row);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      console.error("[control] lancamento create:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ────────── Import em massa de lançamentos (CSV/Planilha)
  // Recebe array de linhas com codigos (não IDs) para os FKs. Faz lookup
  // por código no contexto do tenant/cliente e cria tudo em uma transação.
  app.post("/api/control/clientes/:clienteId/lancamentos/import-massa", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const userId = req.user?.claims?.sub || req.user?.id;

      const linhaSchema = z.object({
        tipo: z.enum(["pagar", "receber"]),
        status: z.enum(["previsto", "aprovado", "pago"]).optional().default("previsto"),
        descricao: z.string().min(1).max(500),
        favorecido: z.string().optional().nullable(),
        documento: z.string().optional().nullable(),
        valor: z.union([z.number(), z.string()]).transform((v) => {
          const n = parseValorBR(v);
          if (!Number.isFinite(n) || n <= 0) throw new Error("Valor inválido");
          return n;
        }),
        dataEmissao: z.string().optional().nullable(),
        dataVencimento: z.string().min(8),
        planoContaCodigo: z.string().optional().nullable(),
        centroCustoCodigo: z.string().optional().nullable(),
        contaBancariaBanco: z.string().optional().nullable(),
        observacoes: z.string().optional().nullable(),
      });
      const bodySchema = z.object({ linhas: z.array(z.any()).min(1).max(2000) });
      const { linhas } = bodySchema.parse(req.body);

      // Pré-carrega lookups (em batch) para evitar N+1
      const [planos, centros, contas] = await Promise.all([
        db.select({ id: planosContas.id, codigo: planosContas.codigo, permite: planosContas.permiteLancamento })
          .from(planosContas).where(eq(planosContas.tenantId, req.tenantId)),
        db.select({ id: centrosCusto.id, codigo: centrosCusto.codigo })
          .from(centrosCusto).where(and(eq(centrosCusto.tenantId, req.tenantId), eq(centrosCusto.clienteId, clienteId))),
        db.select({ id: contasBancarias.id, banco: contasBancarias.banco })
          .from(contasBancarias).where(and(eq(contasBancarias.tenantId, req.tenantId), eq(contasBancarias.clienteId, clienteId))),
      ]);
      const mapPlano = new Map(planos.map((p) => [String(p.codigo).trim(), p]));
      const mapCentro = new Map(centros.map((c) => [String(c.codigo).trim(), c.id]));
      const mapConta = new Map(contas.map((c) => [String(c.banco).trim().toLowerCase(), c.id]));

      // Valida e normaliza cada linha (sem persistir ainda)
      const validas: any[] = [];
      const erros: { linha: number; motivo: string }[] = [];
      linhas.forEach((raw: any, idx: number) => {
        try {
          const r = linhaSchema.parse(raw);
          let planoContaId: string | null = null;
          if (r.planoContaCodigo) {
            const p = mapPlano.get(String(r.planoContaCodigo).trim());
            if (!p) throw new Error(`Plano de conta '${r.planoContaCodigo}' não encontrado`);
            if (p.permite === false) throw new Error(`Plano '${r.planoContaCodigo}' é sintético (não permite lançamento)`);
            planoContaId = p.id;
          }
          let centroCustoId: string | null = null;
          if (r.centroCustoCodigo) {
            const id = mapCentro.get(String(r.centroCustoCodigo).trim());
            if (!id) throw new Error(`Centro de custo '${r.centroCustoCodigo}' não encontrado`);
            centroCustoId = id;
          }
          let contaBancariaId: string | null = null;
          if (r.contaBancariaBanco) {
            const id = mapConta.get(String(r.contaBancariaBanco).trim().toLowerCase());
            if (!id) throw new Error(`Conta bancária '${r.contaBancariaBanco}' não encontrada`);
            contaBancariaId = id;
          }
          validas.push({
            tenantId: String(req.tenantId),
            clienteId,
            tipo: r.tipo,
            status: r.status ?? "previsto",
            descricao: r.descricao,
            favorecido: r.favorecido ?? null,
            documento: r.documento ?? null,
            valor: String(r.valor),
            dataEmissao: r.dataEmissao || null,
            dataVencimento: r.dataVencimento,
            planoContaId,
            centroCustoId,
            contaBancariaId,
            observacoes: r.observacoes ?? null,
            origem: "importacao",
            criadoPor: userId,
          });
        } catch (e: any) {
          const msg = e?.issues?.[0]?.message || e?.message || "Linha inválida";
          erros.push({ linha: idx + 2, motivo: msg }); // +2 = 1 (1-based) + 1 (header)
        }
      });

      if (validas.length === 0) {
        return res.status(400).json({ message: "Nenhuma linha válida para importar", erros });
      }

      // Insere tudo em transação — atômico (ou tudo ou nada nas válidas)
      const inseridas = await db.transaction(async (tx) => {
        return await tx.insert(lancamentosFinanceiros).values(validas).returning({ id: lancamentosFinanceiros.id });
      });

      res.status(201).json({
        criados: inseridas.length,
        totalLinhas: linhas.length,
        erros,
      });
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Body inválido", issues: e.issues });
      console.error("[control] import-massa:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/control/lancamentos/:id", ...auth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      // Normaliza campos de data: string vazia → null
      const bodyNorm = {
        ...req.body,
        dataEmissao: req.body.dataEmissao || null,
        dataPagamento: req.body.dataPagamento || null,
      };
      const patch = lancUpdateSchema.parse(bodyNorm);

      // Buscar lançamento atual para validar FKs E detectar transições de status
      // que precisam passar pelo conciliacaoService (saldo + extrato).
      const [current] = await db.select({
        clienteId: lancamentosFinanceiros.clienteId,
        status: lancamentosFinanceiros.status,
      })
        .from(lancamentosFinanceiros)
        .where(and(eq(lancamentosFinanceiros.id, req.params.id), eq(lancamentosFinanceiros.tenantId, req.tenantId)))
        .limit(1);
      if (!current) return res.status(404).json({ message: "Lançamento não encontrado" });

      const fkErr = await validateLancamentoRefs(patch, req.tenantId, current.clienteId);
      if (fkErr) return res.status(400).json({ message: fkErr });

      // Sprint C6.1 — Conciliação: se PATCH leva o lançamento para status="pago"
      // (ou já está pago e está mudando conta/data), delega ao service para que
      // saldo da conta seja atualizado e extrato gerado atomicamente.
      // ORDEM IMPORTANTE: aplicamos os campos não-conciliação ANTES de chamar
      // o service, para que valor/tipo/descricao novos sejam refletidos no
      // extrato e no cálculo do saldo.
      const transicaoParaPago = patch.status === "pago" && current.status !== "pago";
      const reconciliando = current.status === "pago" && (patch.contaBancariaId !== undefined || patch.dataPagamento !== undefined);
      if (transicaoParaPago || reconciliando) {
        const contaBancariaId = patch.contaBancariaId ?? undefined;
        if (!contaBancariaId) return res.status(400).json({ message: "Conta bancária obrigatória para conciliação" });
        const dataPagamento = patch.dataPagamento ?? new Date().toISOString().slice(0, 10);
        // 1) Aplica primeiro os campos não-conciliação (valor, tipo, descricao,
        //    favorecido, planoContaId, etc) — assim o service usa os novos valores.
        const { status, contaBancariaId: _c, dataPagamento: _d, ...rest } = patch;
        if (Object.keys(rest).length > 0) {
          await db.update(lancamentosFinanceiros)
            .set({ ...rest, updatedAt: new Date() } as any)
            .where(and(eq(lancamentosFinanceiros.id, req.params.id), eq(lancamentosFinanceiros.tenantId, req.tenantId)));
        }
        // 2) Concilia (lê o lançamento já atualizado, calcula saldo + extrato)
        const r = await conciliarLancamento(req.tenantId, req.params.id, { contaBancariaId, dataPagamento, userId });
        if (!r.ok) return res.status(r.status ?? 400).json({ message: r.error });
        const [row] = await db.select().from(lancamentosFinanceiros)
          .where(and(eq(lancamentosFinanceiros.id, req.params.id), eq(lancamentosFinanceiros.tenantId, req.tenantId)));
        return res.json(row);
      }

      // Saindo de "pago" para outro status → desconciliar (reverte saldo + extrato)
      // ORDEM: desconcilia primeiro (usa valor antigo do extrato para devolver
      // saldo correto), depois aplica novo valor/tipo se vier no mesmo PATCH.
      if (current.status === "pago" && patch.status && patch.status !== "pago") {
        const r = await desconciliarLancamento(req.tenantId, req.params.id);
        if ("ok" in r && !r.ok) return res.status(r.status ?? 400).json({ message: r.error });
        // O service já mudou status para "aprovado"/"previsto"; aplica restante do patch
        const { status, dataPagamento: _d, ...rest } = patch;
        const finalStatus = status; // permite override (ex: cancelado)
        await db.update(lancamentosFinanceiros)
          .set({ ...rest, ...(finalStatus ? { status: finalStatus } : {}), updatedAt: new Date() } as any)
          .where(and(eq(lancamentosFinanceiros.id, req.params.id), eq(lancamentosFinanceiros.tenantId, req.tenantId)));
        const [row] = await db.select().from(lancamentosFinanceiros)
          .where(and(eq(lancamentosFinanceiros.id, req.params.id), eq(lancamentosFinanceiros.tenantId, req.tenantId)));
        return res.json(row);
      }

      const update: any = { ...patch, updatedAt: new Date() };
      if (patch.status === "aprovado") {
        update.aprovadoPor = userId;
        update.aprovadoEm = new Date();
      }
      const [row] = await db.update(lancamentosFinanceiros)
        .set(update)
        .where(and(eq(lancamentosFinanceiros.id, req.params.id), eq(lancamentosFinanceiros.tenantId, req.tenantId)))
        .returning();
      res.json(row);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      console.error("[control] lancamento patch:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/control/lancamentos/:id/aprovar", ...auth, async (req: any, res) => {
    const userId = req.user?.claims?.sub || req.user?.id;
    const [row] = await db.update(lancamentosFinanceiros)
      .set({ status: "aprovado", aprovadoPor: userId, aprovadoEm: new Date(), updatedAt: new Date() })
      .where(and(eq(lancamentosFinanceiros.id, req.params.id), eq(lancamentosFinanceiros.tenantId, req.tenantId)))
      .returning();
    if (!row) return res.status(404).json({ message: "Lançamento não encontrado" });
    res.json(row);
  });

  // Sprint C6.1 — endpoint dedicado de conciliação (cria extrato + atualiza saldo)
  const conciliarSchema = z.object({
    contaBancariaId: z.string().min(1),
    // Aceita YYYY-MM-DD (formato ISO usado em todo o módulo Control)
    dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  });
  app.post("/api/control/lancamentos/:id/conciliar", ...auth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { contaBancariaId, dataPagamento } = conciliarSchema.parse(req.body);
      const r = await conciliarLancamento(req.tenantId, req.params.id, { contaBancariaId, dataPagamento, userId });
      if (!r.ok) return res.status(r.status ?? 400).json({ message: r.error });
      res.json(r);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      console.error("[control] conciliar:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/control/lancamentos/:id/desconciliar", ...auth, async (req: any, res) => {
    try {
      const r: any = await desconciliarLancamento(req.tenantId, req.params.id);
      if (r && "ok" in r && r.ok === false) return res.status(r.status ?? 400).json({ message: r.error });
      res.json(r);
    } catch (e: any) {
      console.error("[control] desconciliar:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/control/lancamentos/:id/pagar", ...auth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const dataPagamento = (req.body?.dataPagamento as string) || new Date().toISOString().slice(0, 10);
      const contaBancariaId = req.body?.contaBancariaId as string | undefined;
      // Se conta foi informada → roda conciliação completa (saldo + extrato);
      // se não, mantém comportamento legado (só muda status — útil em fluxos
      // onde a conciliação é feita depois).
      if (contaBancariaId) {
        const r = await conciliarLancamento(req.tenantId, req.params.id, { contaBancariaId, dataPagamento, userId });
        if (!r.ok) return res.status(r.status ?? 400).json({ message: r.error });
        return res.json(r);
      }
      const [row] = await db.update(lancamentosFinanceiros)
        .set({ status: "pago", dataPagamento, updatedAt: new Date() })
        .where(and(eq(lancamentosFinanceiros.id, req.params.id), eq(lancamentosFinanceiros.tenantId, req.tenantId)))
        .returning();
      if (!row) return res.status(404).json({ message: "Lançamento não encontrado" });
      res.json(row);
    } catch (e: any) {
      console.error("[control] pagar:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // Sprint C6.1 — Extrato bancário
  app.get("/api/control/contas-bancarias/:id/extrato", ...auth, async (req: any, res) => {
    try {
      const dataIni = req.query.inicio as string | undefined;
      const dataFim = req.query.fim as string | undefined;
      const data = await getExtratoConta(req.tenantId, req.params.id, { dataIni, dataFim });
      res.json(data);
    } catch (e: any) {
      // Distingue conta não encontrada (404) de erro interno (500)
      if (typeof e?.message === "string" && e.message.includes("não encontrada")) {
        return res.status(404).json({ message: e.message });
      }
      console.error("[control] extrato:", e);
      res.status(500).json({ message: e?.message ?? "Erro ao carregar extrato" });
    }
  });

  app.delete("/api/control/lancamentos/:id", ...auth, async (req: any, res) => {
    try {
      const r = await db.delete(lancamentosFinanceiros)
        .where(and(eq(lancamentosFinanceiros.id, req.params.id), eq(lancamentosFinanceiros.tenantId, req.tenantId)))
        .returning({ id: lancamentosFinanceiros.id });
      if (!r.length) return res.status(404).json({ message: "Lançamento não encontrado" });
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[lancamentos DELETE]", e?.message);
      res.status(500).json({ message: e?.message ?? "Erro ao excluir lançamento" });
    }
  });

  // ────────── Centros de Custo
  app.get("/api/control/clientes/:clienteId/centros-custo", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
      const rows = await db.select().from(centrosCusto)
        .where(and(eq(centrosCusto.tenantId, req.tenantId), eq(centrosCusto.clienteId, clienteId)))
        .orderBy(asc(centrosCusto.codigo));
      res.json(rows);
    } catch (e: any) {
      console.error("[CC GET]", e?.message);
      res.status(500).json({ message: e?.message ?? "Erro ao buscar centros de custo" });
    }
  });

  app.post("/api/control/clientes/:clienteId/centros-custo", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const result = await svcCreateCC(req.tenantId, clienteId, req.body);
      if (result.error) return res.status(400).json({ message: result.error });
      res.status(201).json(result.row);
    } catch (e: any) {
      console.error("[CC POST]", e?.message);
      res.status(500).json({ message: e?.message ?? "Erro ao criar centro de custo" });
    }
  });

  app.patch("/api/control/centros-custo/:id", ...auth, async (req: any, res) => {
    const result = await svcUpdateCC(req.tenantId, req.params.id, req.body);
    if (result.error) {
      const code = result.error === "Centro de custo não encontrado" ? 404 : 400;
      return res.status(code).json({ message: result.error });
    }
    res.json(result.row);
  });

  app.delete("/api/control/centros-custo/:id", ...auth, async (req: any, res) => {
    // Bloqueia delete se houver lançamentos (FK ON DELETE RESTRICT por padrão)
    // ou rateios apontando para o CC.
    try {
      const [{ count }] = await db.execute(sql`
        SELECT (
          (SELECT COUNT(*) FROM lancamentos_financeiros WHERE centro_custo_id = ${req.params.id} AND tenant_id = ${req.tenantId})
          + (SELECT COUNT(*) FROM rateios_cc WHERE centro_custo_id = ${req.params.id} AND tenant_id = ${req.tenantId})
        )::int AS count
      `).then((r: any) => r.rows ?? r);
      if (count > 0) {
        return res.status(409).json({ message: `Centro de custo possui ${count} lançamento(s)/rateio(s) vinculado(s). Inative-o em vez de excluir.` });
      }
      const r = await db.delete(centrosCusto)
        .where(and(eq(centrosCusto.id, req.params.id), eq(centrosCusto.tenantId, req.tenantId)))
        .returning({ id: centrosCusto.id });
      if (!r.length) return res.status(404).json({ message: "Centro de custo não encontrado" });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro ao excluir CC" });
    }
  });

  // Sprint C6 — Import em lote de Centros de Custo. Body: { rows: ImportRow[] }
  app.post("/api/control/clientes/:clienteId/centros-custo/import", ...auth, async (req: any, res) => {
    const { clienteId } = req.params;
    if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }
    const rows: ImportRow[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ message: "Nenhuma linha enviada" });
    if (rows.length > 1000) return res.status(400).json({ message: "Máximo de 1000 linhas por import" });
    const report = await importBulkCentrosCusto(req.tenantId, clienteId, rows);
    res.json(report);
  });

  // Sprint C-E07 — Seed 100 CCs série 1100 (padrão Engineering Ambiental)
  app.post("/api/control/clientes/:clienteId/centros-custo/seed-engineering", ...auth, async (req: any, res) => {
    const { clienteId } = req.params;
    if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }
    const blocos: Array<{ codigo: string; nome: string; raiz: boolean; rateio: boolean }> = [
      { codigo: "1100", nome: "ADMINISTRATIVO E GERAL", raiz: true, rateio: false },
      { codigo: "1101", nome: "Salários e Encargos — Administrativo", raiz: false, rateio: true },
      { codigo: "1102", nome: "Aluguel e Condomínio", raiz: false, rateio: true },
      { codigo: "1103", nome: "Energia Elétrica", raiz: false, rateio: true },
      { codigo: "1104", nome: "Água e Saneamento", raiz: false, rateio: true },
      { codigo: "1105", nome: "Telefone e Internet", raiz: false, rateio: true },
      { codigo: "1106", nome: "Limpeza e Conservação", raiz: false, rateio: true },
      { codigo: "1107", nome: "Segurança Patrimonial", raiz: false, rateio: true },
      { codigo: "1108", nome: "Manutenção Predial", raiz: false, rateio: true },
      { codigo: "1109", nome: "Outros — Administrativo", raiz: false, rateio: false },
      { codigo: "1110", nome: "RECURSOS HUMANOS", raiz: true, rateio: false },
      { codigo: "1111", nome: "Salários — RH", raiz: false, rateio: false },
      { codigo: "1112", nome: "Benefícios (VT, VR, Plano Saúde)", raiz: false, rateio: false },
      { codigo: "1113", nome: "FGTS e Encargos Sociais", raiz: false, rateio: false },
      { codigo: "1114", nome: "Treinamento e Capacitação", raiz: false, rateio: false },
      { codigo: "1115", nome: "Recrutamento e Seleção", raiz: false, rateio: false },
      { codigo: "1116", nome: "EPIs e Uniformes", raiz: false, rateio: false },
      { codigo: "1117", nome: "Medicina do Trabalho", raiz: false, rateio: false },
      { codigo: "1118", nome: "Seguro de Vida", raiz: false, rateio: false },
      { codigo: "1119", nome: "Outros — RH", raiz: false, rateio: false },
      { codigo: "1120", nome: "FROTA E LOGÍSTICA", raiz: true, rateio: false },
      { codigo: "1121", nome: "Combustível", raiz: false, rateio: false },
      { codigo: "1122", nome: "Manutenção Veicular", raiz: false, rateio: false },
      { codigo: "1123", nome: "Seguro de Veículos", raiz: false, rateio: false },
      { codigo: "1124", nome: "Licenciamento e IPVA", raiz: false, rateio: false },
      { codigo: "1125", nome: "Aluguel de Veículos / Fretamento", raiz: false, rateio: false },
      { codigo: "1126", nome: "Pedágios e Estacionamentos", raiz: false, rateio: false },
      { codigo: "1127", nome: "Depreciação — Frota", raiz: false, rateio: false },
      { codigo: "1128", nome: "GPS e Rastreamento", raiz: false, rateio: false },
      { codigo: "1129", nome: "Outros — Frota", raiz: false, rateio: false },
      { codigo: "1130", nome: "LABORATÓRIO E ANÁLISES", raiz: true, rateio: false },
      { codigo: "1131", nome: "Reagentes e Consumíveis", raiz: false, rateio: false },
      { codigo: "1132", nome: "Manutenção de Equipamentos Lab.", raiz: false, rateio: false },
      { codigo: "1133", nome: "Calibração e Metrologia", raiz: false, rateio: false },
      { codigo: "1134", nome: "Subcontratação de Análises", raiz: false, rateio: false },
      { codigo: "1135", nome: "Descarte de Resíduos", raiz: false, rateio: false },
      { codigo: "1136", nome: "Gases Industriais", raiz: false, rateio: false },
      { codigo: "1137", nome: "Acreditação (INMETRO/ISO 17025)", raiz: false, rateio: false },
      { codigo: "1138", nome: "Vidraria e Materiais", raiz: false, rateio: false },
      { codigo: "1139", nome: "Outros — Laboratório", raiz: false, rateio: false },
      { codigo: "1140", nome: "CAMPO E MOBILIZAÇÃO", raiz: true, rateio: false },
      { codigo: "1141", nome: "Diárias e Hospedagem", raiz: false, rateio: false },
      { codigo: "1142", nome: "Passagens Aéreas e Terrestres", raiz: false, rateio: false },
      { codigo: "1143", nome: "Alimentação em Campo", raiz: false, rateio: false },
      { codigo: "1144", nome: "Aluguel de Equipamentos de Campo", raiz: false, rateio: false },
      { codigo: "1145", nome: "Subcontratados de Campo", raiz: false, rateio: false },
      { codigo: "1146", nome: "Materiais de Coleta e Amostragem", raiz: false, rateio: false },
      { codigo: "1147", nome: "EPI Campo", raiz: false, rateio: false },
      { codigo: "1148", nome: "Serviços de Apoio (Barco, Guia)", raiz: false, rateio: false },
      { codigo: "1149", nome: "Outros — Campo", raiz: false, rateio: false },
      { codigo: "1150", nome: "TECNOLOGIA E TI", raiz: true, rateio: true },
      { codigo: "1151", nome: "Licenças de Software", raiz: false, rateio: true },
      { codigo: "1152", nome: "Servidores e Hospedagem (Cloud)", raiz: false, rateio: true },
      { codigo: "1153", nome: "Suporte de TI", raiz: false, rateio: true },
      { codigo: "1154", nome: "Hardware e Periféricos", raiz: false, rateio: true },
      { codigo: "1155", nome: "Backup e Segurança Digital", raiz: false, rateio: true },
      { codigo: "1156", nome: "Domínios e Certificados SSL", raiz: false, rateio: false },
      { codigo: "1157", nome: "Software GIS e CAD", raiz: false, rateio: false },
      { codigo: "1158", nome: "ERP / Sistemas de Gestão", raiz: false, rateio: false },
      { codigo: "1159", nome: "Outros — TI", raiz: false, rateio: false },
      { codigo: "1160", nome: "FINANCEIRO E TRIBUTÁRIO", raiz: true, rateio: false },
      { codigo: "1161", nome: "Contabilidade e Auditoria", raiz: false, rateio: false },
      { codigo: "1162", nome: "Honorários Jurídicos", raiz: false, rateio: false },
      { codigo: "1163", nome: "IOF e Tarifas Bancárias", raiz: false, rateio: false },
      { codigo: "1164", nome: "Seguros em Geral", raiz: false, rateio: false },
      { codigo: "1165", nome: "Imposto de Renda (PJ)", raiz: false, rateio: false },
      { codigo: "1166", nome: "ISS / Tributos Municipais", raiz: false, rateio: false },
      { codigo: "1167", nome: "Simples Nacional / PIS / COFINS", raiz: false, rateio: false },
      { codigo: "1168", nome: "Certificação Digital e Cartório", raiz: false, rateio: false },
      { codigo: "1169", nome: "Outros — Financeiro", raiz: false, rateio: false },
      { codigo: "1170", nome: "PROJETOS E LICENCIAMENTO", raiz: true, rateio: false },
      { codigo: "1171", nome: "Licenciamento Ambiental (LIC)", raiz: false, rateio: false },
      { codigo: "1172", nome: "Estudos de Impacto (EIA/RIMA)", raiz: false, rateio: false },
      { codigo: "1173", nome: "Monitoramento Ambiental", raiz: false, rateio: false },
      { codigo: "1174", nome: "Remediação de Solo/Água", raiz: false, rateio: false },
      { codigo: "1175", nome: "Geotécnica e Sondagem", raiz: false, rateio: false },
      { codigo: "1176", nome: "Topografia e Cartografia", raiz: false, rateio: false },
      { codigo: "1177", nome: "Consultoria Especializada", raiz: false, rateio: false },
      { codigo: "1178", nome: "ART/RRT Profissional", raiz: false, rateio: false },
      { codigo: "1179", nome: "Outros — Projetos", raiz: false, rateio: false },
      { codigo: "1180", nome: "COMERCIAL E MARKETING", raiz: true, rateio: false },
      { codigo: "1181", nome: "Material Gráfico e Publicidade", raiz: false, rateio: false },
      { codigo: "1182", nome: "Website e Marketing Digital", raiz: false, rateio: false },
      { codigo: "1183", nome: "Participação em Feiras e Eventos", raiz: false, rateio: false },
      { codigo: "1184", nome: "Comissão de Vendas", raiz: false, rateio: false },
      { codigo: "1185", nome: "Representação Comercial", raiz: false, rateio: false },
      { codigo: "1186", nome: "Brindes e Relações Institucionais", raiz: false, rateio: false },
      { codigo: "1187", nome: "Licitações e Editais", raiz: false, rateio: false },
      { codigo: "1188", nome: "CRM e Automação de Vendas", raiz: false, rateio: false },
      { codigo: "1189", nome: "Outros — Comercial", raiz: false, rateio: false },
      { codigo: "1190", nome: "RECEITAS E FATURAMENTO", raiz: true, rateio: false },
      { codigo: "1191", nome: "Receita de Projetos de Engenharia", raiz: false, rateio: false },
      { codigo: "1192", nome: "Receita de Análises Laboratoriais", raiz: false, rateio: false },
      { codigo: "1193", nome: "Receita de Consultoria", raiz: false, rateio: false },
      { codigo: "1194", nome: "Receita de Monitoramento", raiz: false, rateio: false },
      { codigo: "1195", nome: "Receita de Treinamentos", raiz: false, rateio: false },
      { codigo: "1196", nome: "Receita de Licenciamento Ambiental", raiz: false, rateio: false },
      { codigo: "1197", nome: "Juros e Rendimentos Financeiros", raiz: false, rateio: false },
      { codigo: "1198", nome: "Outras Receitas", raiz: false, rateio: false },
      { codigo: "1199", nome: "Deduções e Devoluções", raiz: false, rateio: false },
    ];
    let criados = 0; let existentes = 0;
    for (const cc of blocos) {
      const exists = await pool.query(
        `SELECT id FROM centros_custo WHERE tenant_id=$1 AND cliente_id=$2 AND codigo=$3`,
        [req.tenantId, clienteId, cc.codigo]
      );
      if (exists.rows.length > 0) { existentes++; continue; }
      await pool.query(
        `INSERT INTO centros_custo (id, tenant_id, cliente_id, codigo, nome, ativo, marca_rateio, centro_custo_raiz)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,true,$5,$6)`,
        [req.tenantId, clienteId, cc.codigo, cc.nome, cc.rateio, cc.raiz]
      );
      criados++;
    }
    res.json({ ok: true, criados, existentes, total: blocos.length });
  });

  // Sprint C6 — Orçamento utilizado de um CC em um mês.
  app.get("/api/control/clientes/:clienteId/centros-custo/:ccId/orcamento", ...auth, async (req: any, res) => {
    const { clienteId, ccId } = req.params;
    if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }
    if (!(await centroCustoBelongsToCliente(ccId, req.tenantId, clienteId))) {
      return res.status(404).json({ message: "Centro de custo não encontrado" });
    }
    const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
    const mes = parseInt(String(req.query.mes ?? new Date().getMonth() + 1), 10);
    if (isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12) {
      return res.status(400).json({ message: "ano/mes inválidos" });
    }
    const data = await calcOrcamentoUtilizado(req.tenantId, clienteId, ccId, ano, mes);
    res.json({ ano, mes, ...data });
  });

  // Sprint C6 — Rateios de lançamento financeiro
  app.get("/api/control/lancamentos/:lancamentoId/rateios", ...auth, async (req: any, res) => {
    // Valida ownership do lançamento
    const [lanc] = await db.select({ id: lancamentosFinanceiros.id })
      .from(lancamentosFinanceiros)
      .where(and(eq(lancamentosFinanceiros.id, req.params.lancamentoId), eq(lancamentosFinanceiros.tenantId, req.tenantId)))
      .limit(1);
    if (!lanc) return res.status(404).json({ message: "Lançamento não encontrado" });
    const rows = await getRateios(req.tenantId, req.params.lancamentoId);
    res.json(rows);
  });

  app.put("/api/control/lancamentos/:lancamentoId/rateios", ...auth, async (req: any, res) => {
    const result = await setRateios(req.tenantId, req.params.lancamentoId, req.body?.items ?? []);
    if (!result.ok) {
      const code = result.error === "Lançamento não encontrado" ? 404 : 400;
      return res.status(code).json({ message: result.error });
    }
    res.json(result);
  });

  // ────────── Contas Bancárias
  app.get("/api/control/clientes/:clienteId/contas-bancarias", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
      const rows = await db.select().from(contasBancarias)
        .where(and(eq(contasBancarias.tenantId, req.tenantId), eq(contasBancarias.clienteId, clienteId)))
        .orderBy(asc(contasBancarias.banco));
      res.json(rows);
    } catch (e: any) {
      console.error("[contas-bancarias GET]", e?.message);
      res.status(500).json({ message: e?.message ?? "Erro ao buscar contas bancárias" });
    }
  });

  app.post("/api/control/clientes/:clienteId/contas-bancarias", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
      const body = { ...req.body, tenantId: String(req.tenantId), clienteId };
      // "nome" é obrigatório no DB — usar banco como fallback se não informado
      if (!body.nome) body.nome = body.banco || "Conta";
      const parsed = insertContaBancariaSchema.parse(body);
      const saldoInicial = parsed.saldoInicial ?? "0";
      const [row] = await db.insert(contasBancarias).values({ ...parsed, saldoAtual: saldoInicial }).returning();
      res.status(201).json(row);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/control/contas-bancarias/:id", ...auth, async (req: any, res) => {
    try {
      const patch = contaBancariaPatchSchema.parse(req.body);
      const [row] = await db.update(contasBancarias).set(patch as any)
        .where(and(eq(contasBancarias.id, req.params.id), eq(contasBancarias.tenantId, req.tenantId)))
        .returning();
      if (!row) return res.status(404).json({ message: "Conta bancária não encontrada" });
      res.json(row);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/control/contas-bancarias/:id", ...auth, async (req: any, res) => {
    try {
      const r = await db.delete(contasBancarias)
        .where(and(eq(contasBancarias.id, req.params.id), eq(contasBancarias.tenantId, req.tenantId)))
        .returning({ id: contasBancarias.id });
      if (!r.length) return res.status(404).json({ message: "Conta bancária não encontrada" });
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[contas-bancarias DELETE]", e?.message);
      res.status(500).json({ message: e?.message ?? "Erro ao excluir conta bancária" });
    }
  });

  // ────────── Relatório de Pagamentos (por período)
  app.get("/api/control/clientes/:clienteId/relatorio-pagamentos", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
      const periodo = (req.query.periodo as string) || "semana";
      const today = new Date();
      let dataIni = new Date();
      const dataFim = new Date();
      if (periodo === "dia") {
        dataIni = today;
      } else if (periodo === "semana") {
        dataIni = new Date(Date.now() - 0);
        dataFim.setDate(dataFim.getDate() + 7);
      } else {
        dataIni = today;
        dataFim.setDate(dataFim.getDate() + 30);
      }
      const ini = dataIni.toISOString().slice(0, 10);
      const fim = dataFim.toISOString().slice(0, 10);

      const rows = await db.select({
        id: lancamentosFinanceiros.id,
        tipo: lancamentosFinanceiros.tipo,
        descricao: lancamentosFinanceiros.descricao,
        favorecido: lancamentosFinanceiros.favorecido,
        valor: lancamentosFinanceiros.valor,
        dataVencimento: lancamentosFinanceiros.dataVencimento,
        status: lancamentosFinanceiros.status,
      }).from(lancamentosFinanceiros)
        .where(and(
          eq(lancamentosFinanceiros.tenantId, req.tenantId),
          eq(lancamentosFinanceiros.clienteId, clienteId),
          gte(lancamentosFinanceiros.dataVencimento, ini),
          lte(lancamentosFinanceiros.dataVencimento, fim),
          inArray(lancamentosFinanceiros.status, ["previsto", "aprovado", "vencido"]),
        ))
        .orderBy(asc(lancamentosFinanceiros.dataVencimento));

      const totalPagar = rows.filter((r) => r.tipo === "pagar").reduce((s, r) => s + Number(r.valor), 0);
      const totalReceber = rows.filter((r) => r.tipo === "receber").reduce((s, r) => s + Number(r.valor), 0);

      res.json({ periodo, dataIni: ini, dataFim: fim, totalPagar, totalReceber, saldoLiquido: totalReceber - totalPagar, lancamentos: rows });
    } catch (e: any) {
      console.error("[control] relatorio:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ────────── Períodos de Competência
  app.get("/api/control/clientes/:clienteId/periodos", ...auth, async (req: any, res) => {
    const { clienteId } = req.params;
    if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
    const rows = await db.select().from(periodosCompetencia)
      .where(and(eq(periodosCompetencia.tenantId, req.tenantId), eq(periodosCompetencia.clienteId, clienteId)))
      .orderBy(desc(periodosCompetencia.ano), desc(periodosCompetencia.mes));
    res.json(rows);
  });

  app.post("/api/control/clientes/:clienteId/periodos", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
      const parsed = insertPeriodoCompetenciaSchema.parse({ ...req.body, tenantId: String(req.tenantId), clienteId });
      const [row] = await db.insert(periodosCompetencia).values(parsed as any).returning();
      res.status(201).json(row);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      if (e?.code === "23505") return res.status(409).json({ message: "Período já cadastrado" });
      res.status(500).json({ message: e.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Sprint C7 — G1 Parcelamento
  // ────────────────────────────────────────────────────────────────────
  const parcelarSchema = z.object({
    tipo: z.enum(["pagar", "receber"]),
    descricao: z.string().min(1).max(300),
    valor: z.coerce.number().positive("Valor deve ser maior que zero"),
    parcelas: z.coerce.number().int().min(2, "Mínimo 2 parcelas").max(360, "Máximo 360 parcelas"),
    primeiroVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
    planoContaId: z.string().nullable().optional(),
    centroCustoId: z.string().nullable().optional(),
    tipoDocumentoId: z.string().nullable().optional(),
    favorecido: z.string().nullable().optional(),
    documento: z.string().nullable().optional(),
    observacoes: z.string().nullable().optional(),
  });

  app.post("/api/control/clientes/:clienteId/lancamentos-parcelado", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const userId = req.user?.claims?.sub || req.user?.id || null;
      const input = parcelarSchema.parse(req.body);
      const fkErr = await validateLancamentoRefs(
        { planoContaId: input.planoContaId, centroCustoId: input.centroCustoId, contaBancariaId: null },
        req.tenantId,
        clienteId,
      );
      if (fkErr) return res.status(400).json({ message: fkErr });
      const r = await criarLancamentoParcelado(req.tenantId, clienteId, userId, input);
      res.status(201).json({ ok: true, grupoId: r.grupo.id, totalCriado: r.lancamentos.length });
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      console.error("[control] parcelar:", e);
      res.status(400).json({ message: e?.message ?? "Erro ao criar parcelamento" });
    }
  });

  app.get("/api/control/grupos-parcelamento/:id", ...auth, async (req: any, res) => {
    const [grupo] = await db.select().from(gruposParcelamento)
      .where(and(eq(gruposParcelamento.id, req.params.id), eq(gruposParcelamento.tenantId, req.tenantId)))
      .limit(1);
    if (!grupo) return res.status(404).json({ message: "Grupo não encontrado" });
    const parcelas = await db.select({
      id: lancamentosFinanceiros.id,
      numeroParcela: lancamentosFinanceiros.numeroParcela,
      totalParcelas: lancamentosFinanceiros.totalParcelas,
      valor: lancamentosFinanceiros.valor,
      dataVencimento: lancamentosFinanceiros.dataVencimento,
      dataPagamento: lancamentosFinanceiros.dataPagamento,
      status: lancamentosFinanceiros.status,
      statusCalc: statusCalcSql.as("status_calc"),
    }).from(lancamentosFinanceiros)
      .where(and(
        eq(lancamentosFinanceiros.grupoParcelamentoId, req.params.id),
        eq(lancamentosFinanceiros.tenantId, req.tenantId),
      ))
      .orderBy(asc(lancamentosFinanceiros.numeroParcela));
    res.json({ grupo, parcelas });
  });

  const grupoPatchSchema = z.object({
    descricao: z.string().min(1).optional(),
    planoContaId: z.string().nullable().optional(),
    centroCustoId: z.string().nullable().optional(),
    tipoDocumentoId: z.string().nullable().optional(),
    favorecido: z.string().nullable().optional(),
  });
  app.patch("/api/control/grupos-parcelamento/:id", ...auth, async (req: any, res) => {
    try {
      const changes = grupoPatchSchema.parse(req.body);
      const r = await alterarGrupoParcelamento(req.tenantId, req.params.id, changes);
      res.json(r);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      res.status(500).json({ message: e?.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Sprint C7 — G2 Recorrência (CRUD de templates + trigger manual)
  // ────────────────────────────────────────────────────────────────────
  app.get("/api/control/clientes/:clienteId/templates-recorrencia", ...auth, async (req: any, res) => {
    const { clienteId } = req.params;
    if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }
    const rows = await db.select().from(templatesRecorrencia)
      .where(and(
        eq(templatesRecorrencia.tenantId, req.tenantId),
        eq(templatesRecorrencia.clienteId, clienteId),
      ))
      .orderBy(desc(templatesRecorrencia.ativa), asc(templatesRecorrencia.descricao));
    res.json(rows);
  });

  app.post("/api/control/clientes/:clienteId/templates-recorrencia", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const userId = req.user?.claims?.sub || req.user?.id || null;
      // valorFixo é decimal no schema (string esperada). Aceitamos number do
      // frontend e convertemos antes do parse.
      const body = { ...req.body };
      if (body.valorFixo !== undefined && body.valorFixo !== null) {
        body.valorFixo = String(body.valorFixo);
      }
      const parsed = insertTemplateRecorrenciaSchema.parse({
        ...body,
        tenantId: String(req.tenantId),
        clienteId,
        criadoPor: userId,
      });
      const fkErr = await validateLancamentoRefs(
        { planoContaId: (parsed as any).planoContaId, centroCustoId: (parsed as any).centroCustoId, contaBancariaId: (parsed as any).contaBancariaId },
        req.tenantId,
        clienteId,
      );
      if (fkErr) return res.status(400).json({ message: fkErr });
      const [row] = await db.insert(templatesRecorrencia).values(parsed as any).returning();
      // Já gera as primeiras ocorrências sem esperar o cron
      try { await processarTemplate(row, new Date(), new Date(Date.now() + 60 * 86400000)); } catch (e) { console.error("[control] geração inicial template:", e); }
      res.status(201).json(row);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      res.status(500).json({ message: e?.message });
    }
  });

  const templatePatchSchema = z.object({
    descricao: z.string().min(1).optional(),
    valorFixo: z.union([z.number(), z.string()]).nullable().optional(),
    diaVencimento: z.coerce.number().int().min(1).max(28).nullable().optional(),
    frequencia: z.enum(["mensal", "quinzenal", "semanal", "anual"]).optional(),
    planoContaId: z.string().nullable().optional(),
    centroCustoId: z.string().nullable().optional(),
    contaBancariaId: z.string().nullable().optional(),
    tipoDocumentoId: z.string().nullable().optional(),
    favorecido: z.string().nullable().optional(),
    dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    ativa: z.boolean().optional(),
    observacoes: z.string().nullable().optional(),
  });
  app.patch("/api/control/templates-recorrencia/:id", ...auth, async (req: any, res) => {
    try {
      const patch = templatePatchSchema.parse(req.body);
      const setObj: Record<string, any> = { ...patch, updatedAt: new Date() };
      if (patch.valorFixo !== undefined && patch.valorFixo !== null) {
        setObj.valorFixo = String(patch.valorFixo);
      }
      const [row] = await db.update(templatesRecorrencia).set(setObj as any)
        .where(and(eq(templatesRecorrencia.id, req.params.id), eq(templatesRecorrencia.tenantId, req.tenantId)))
        .returning();
      if (!row) return res.status(404).json({ message: "Template não encontrado" });
      res.json(row);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      res.status(500).json({ message: e?.message });
    }
  });

  app.delete("/api/control/templates-recorrencia/:id", ...auth, async (req: any, res) => {
    // Soft-disable: apenas inativa para preservar lançamentos já gerados
    const [row] = await db.update(templatesRecorrencia)
      .set({ ativa: false, updatedAt: new Date() })
      .where(and(eq(templatesRecorrencia.id, req.params.id), eq(templatesRecorrencia.tenantId, req.tenantId)))
      .returning({ id: templatesRecorrencia.id });
    if (!row) return res.status(404).json({ message: "Template não encontrado" });
    res.json({ ok: true, inativado: true });
  });

  app.post("/api/control/templates-recorrencia/processar", ...auth, async (req: any, res) => {
    try {
      // Sprint C7 — defesa de isolamento: rota manual sempre escopada ao tenant
      // do chamador (cron continua processando todos via processarRecorrencias()).
      const r = await processarRecorrencias(req.tenantId);
      res.json(r);
    } catch (e: any) {
      res.status(500).json({ message: e?.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Sprint C7 — G4 Transferência entre contas
  // ────────────────────────────────────────────────────────────────────
  const transfSchema = z.object({
    origemId: z.string().min(1),
    destinoId: z.string().min(1),
    valor: z.coerce.number().positive("Valor deve ser maior que zero"),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    descricao: z.string().min(1).max(300),
  });
  app.post("/api/control/clientes/:clienteId/transferencias", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const input = transfSchema.parse(req.body);
      const userId = req.user?.claims?.sub || req.user?.id || null;
      const r = await transferirEntreContas(req.tenantId, clienteId, userId, input);
      res.status(201).json(r);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      console.error("[control] transferencia:", e);
      res.status(400).json({ message: e?.message ?? "Erro na transferência" });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Sprint C7 — G5 Saldo inicial com data
  // ────────────────────────────────────────────────────────────────────
  const saldoInicialSchema = z.object({
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    valor: z.coerce.number(),
  });
  app.post("/api/control/contas-bancarias/:id/saldo-inicial", ...auth, async (req: any, res) => {
    try {
      const input = saldoInicialSchema.parse(req.body);
      const userId = req.user?.claims?.sub || req.user?.id || null;
      const r = await definirSaldoInicial(req.tenantId, req.params.id, userId, input);
      res.json(r);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      console.error("[control] saldo-inicial:", e);
      res.status(400).json({ message: e?.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Sprint C7 — G11 Tipos de Documento
  // ────────────────────────────────────────────────────────────────────
  // Lista tipos do tenant + tipos globais (__global__) — todos ativos
  app.get("/api/control/tipos-documento", ...auth, async (req: any, res) => {
    const rows = await db.select().from(tiposDocumento)
      .where(and(
        eq(tiposDocumento.ativo, true),
        or(
          eq(tiposDocumento.tenantId, req.tenantId),
          eq(tiposDocumento.tenantId, "__global__"),
        ),
      ))
      .orderBy(asc(tiposDocumento.ordem), asc(tiposDocumento.nome));
    res.json(rows);
  });

  app.post("/api/control/tipos-documento", ...auth, async (req: any, res) => {
    try {
      const parsed = insertTipoDocumentoSchema.parse({
        ...req.body,
        tenantId: String(req.tenantId),
      });
      const [row] = await db.insert(tiposDocumento).values(parsed as any).returning();
      res.status(201).json(row);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      if (e?.code === "23505") return res.status(409).json({ message: "Já existe tipo com este nome" });
      res.status(500).json({ message: e?.message });
    }
  });

  app.patch("/api/control/tipos-documento/:id", ...auth, async (req: any, res) => {
    try {
      // Não permite editar tipos globais (__global__)
      const [row] = await db.update(tiposDocumento)
        .set({ ativo: req.body?.ativo, nome: req.body?.nome, icone: req.body?.icone })
        .where(and(eq(tiposDocumento.id, req.params.id), eq(tiposDocumento.tenantId, req.tenantId)))
        .returning();
      if (!row) return res.status(404).json({ message: "Tipo não encontrado (globais não podem ser editados)" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e?.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Sprint C8 — Orçamento mensal (Realizado × Previsto)
  // ────────────────────────────────────────────────────────────────────
  app.get("/api/control/clientes/:clienteId/orcamento", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
      if (isNaN(ano) || ano < 2000 || ano > 2100) return res.status(400).json({ message: "ano inválido" });
      const data = await orcMatriz(req.tenantId, clienteId, ano);
      res.json(data);
    } catch (e: any) {
      console.error("[control] orcamento matriz:", e);
      res.status(500).json({ message: e?.message });
    }
  });

  const orcamentoBatchSchema = z.object({
    items: z.array(z.object({
      planoContaId: z.string().min(1),
      centroCustoId: z.string().nullable().optional(),
      ano: z.coerce.number().int().min(2000).max(2100),
      mes: z.coerce.number().int().min(1).max(12),
      valorPrevisto: z.union([z.number(), z.string()]),
      thresholdAlertaPct: z.union([z.number(), z.string()]).nullable().optional(),
    })).max(2000),
  });
  app.post("/api/control/clientes/:clienteId/orcamento", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const { items } = orcamentoBatchSchema.parse(req.body);
      // Valida ownership de planoContaId/centroCustoId via FK indireta (tenant)
      // — usamos um IN simples no plano_conta
      if (items.length === 0) return res.json({ ok: true, processados: 0 });
      const planoIds = Array.from(new Set(items.map((i) => i.planoContaId)));
      const planos = await db.select({ id: planosContas.id }).from(planosContas)
        .where(and(inArray(planosContas.id, planoIds), eq(planosContas.tenantId, req.tenantId)));
      if (planos.length !== planoIds.length) {
        return res.status(400).json({ message: "Algum planoContaId não pertence ao tenant" });
      }
      // Valida ownership de centroCustoId (tenant+cliente) — só os não-nulos.
      const ccIds = Array.from(new Set(items.map((i) => i.centroCustoId).filter(Boolean) as string[]));
      if (ccIds.length > 0) {
        const ccs = await db.select({ id: centrosCusto.id }).from(centrosCusto)
          .where(and(
            inArray(centrosCusto.id, ccIds),
            eq(centrosCusto.tenantId, req.tenantId),
            eq(centrosCusto.clienteId, clienteId),
          ));
        if (ccs.length !== ccIds.length) {
          return res.status(400).json({ message: "Algum centroCustoId não pertence ao cliente/tenant" });
        }
      }
      const userId = req.user?.claims?.sub || req.user?.id || null;
      const r = await orcUpsert(req.tenantId, clienteId, userId, items as any);
      res.json(r);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      console.error("[control] orcamento upsert:", e);
      res.status(500).json({ message: e?.message });
    }
  });

  app.get("/api/control/clientes/:clienteId/orcamento/comparativo", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
      const mesRaw = req.query.mes ? parseInt(String(req.query.mes), 10) : null;
      const mes = mesRaw && mesRaw >= 1 && mesRaw <= 12 ? mesRaw : null;
      const threshold = req.query.threshold ? Number(req.query.threshold) : 15;
      if (isNaN(ano)) return res.status(400).json({ message: "ano inválido" });
      const data = await orcComparativo(req.tenantId, clienteId, ano, mes, threshold);
      res.json(data);
    } catch (e: any) {
      console.error("[control] orcamento comparativo:", e);
      res.status(500).json({ message: e?.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Sprint C9 — G7/G8 Fluxo de Caixa, G9 DRE com AV%, G10 PMP/PMR
  // ────────────────────────────────────────────────────────────────────
  app.get("/api/control/clientes/:clienteId/fluxo-caixa-mensal", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
      const conta = req.query.conta ? String(req.query.conta) : undefined;
      if (isNaN(ano) || ano < 2000 || ano > 2100) return res.status(400).json({ message: "ano inválido" });
      const data = await getFluxoCaixaMensal(req.tenantId, clienteId, ano, conta);
      res.json(data);
    } catch (e: any) {
      console.error("[control] fluxo-caixa-mensal:", e);
      res.status(500).json({ message: e?.message });
    }
  });

  app.get("/api/control/clientes/:clienteId/fluxo-caixa-diario", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
      const mes = parseInt(String(req.query.mes ?? (new Date().getMonth() + 1)), 10);
      const conta = req.query.conta ? String(req.query.conta) : undefined;
      if (isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ message: "ano/mes inválido" });
      }
      const data = await getFluxoCaixaDiario(req.tenantId, clienteId, ano, mes, conta);
      res.json(data);
    } catch (e: any) {
      console.error("[control] fluxo-caixa-diario:", e);
      res.status(500).json({ message: e?.message });
    }
  });

  app.get("/api/control/clientes/:clienteId/dre", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
      const mesRaw = req.query.mes ? parseInt(String(req.query.mes), 10) : null;
      const mes = mesRaw && mesRaw >= 1 && mesRaw <= 12 ? mesRaw : null;
      const threshold = req.query.threshold ? Number(req.query.threshold) : 15;
      if (isNaN(ano)) return res.status(400).json({ message: "ano inválido" });
      const data = await getDreComAv(req.tenantId, clienteId, ano, mes, threshold);
      res.json(data);
    } catch (e: any) {
      console.error("[control] dre:", e);
      res.status(500).json({ message: e?.message });
    }
  });

  app.get("/api/control/clientes/:clienteId/pmp-pmr", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
      const mesRaw = req.query.mes ? parseInt(String(req.query.mes), 10) : null;
      const mes = mesRaw && mesRaw >= 1 && mesRaw <= 12 ? mesRaw : null;
      const data = await getPmpPmr(req.tenantId, clienteId, ano, mes);
      res.json(data);
    } catch (e: any) {
      console.error("[control] pmp-pmr:", e);
      res.status(500).json({ message: e?.message });
    }
  });

  app.get("/api/control/clientes/:clienteId/pmp-pmr/historico", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const meses = Math.max(2, Math.min(24, Number(req.query.meses ?? 6)));
      const data = await getPmpPmrHistorico(req.tenantId, clienteId, meses);
      res.json({ historico: data });
    } catch (e: any) {
      console.error("[control] pmp-pmr historico:", e);
      res.status(500).json({ message: e?.message });
    }
  });

  // ── CTL-02: AR por cliente com PMR calculado ──────────────────────────
  app.get("/api/control/clientes/:clienteId/ar-por-cliente", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const meses = Math.max(1, Math.min(12, Number(req.query.meses ?? 3)));

      // Agrupa AR por favorecido/pessoaId com PMR calculado
      const rows = await db.execute(sql`
        SELECT
          COALESCE(pessoa_id, 'sem_pessoa') AS pessoa_id,
          COALESCE(favorecido, 'Não identificado') AS favorecido,
          COUNT(*) AS total_lancamentos,
          SUM(valor::numeric) AS total_valor,
          -- PMR = média ponderada (data_pagamento - data_vencimento) para pagos
          ROUND(
            AVG(
              CASE WHEN status = 'pago' AND data_pagamento IS NOT NULL
                THEN (data_pagamento - data_vencimento)
              END
            )
          , 1) AS pmr_dias,
          COUNT(CASE WHEN status = 'pago' THEN 1 END) AS pagos,
          COUNT(CASE WHEN status IN ('previsto','aprovado') THEN 1 END) AS pendentes,
          COUNT(CASE WHEN status IN ('vencido','inadimplente') THEN 1 END) AS vencidos,
          MAX(parceiro) AS parceiro
        FROM lancamentos_financeiros
        WHERE tenant_id = ${req.tenantId}
          AND cliente_id = ${clienteId}
          AND tipo = 'receber'
          AND created_at >= NOW() - (${meses} || ' months')::interval
        GROUP BY COALESCE(pessoa_id, 'sem_pessoa'), COALESCE(favorecido, 'Não identificado')
        ORDER BY total_valor DESC
        LIMIT 50
      `);

      res.json({ clientes: rows.rows ?? rows, meses });
    } catch (e: any) {
      console.error("[control] ar-por-cliente:", e);
      res.status(500).json({ message: e?.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Sprint C10 — G12 Pivot, G13 Carteiras, G14 Exercícios fiscais
  // ────────────────────────────────────────────────────────────────────
  app.get("/api/control/clientes/:clienteId/pivot-clientes", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
      const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
      const data = await getPivot(req.tenantId, clienteId, ano, "receber");
      res.json(data);
    } catch (e: any) { console.error("[control] pivot-clientes:", e); res.status(500).json({ message: e?.message }); }
  });

  app.get("/api/control/clientes/:clienteId/pivot-fornecedores", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
      const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
      const data = await getPivot(req.tenantId, clienteId, ano, "pagar");
      res.json(data);
    } catch (e: any) { console.error("[control] pivot-fornecedores:", e); res.status(500).json({ message: e?.message }); }
  });

  app.get("/api/control/clientes/:clienteId/exercicios", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
      const anos = await getExerciciosDisponiveis(req.tenantId, clienteId);
      res.json({ anos });
    } catch (e: any) { console.error("[control] exercicios:", e); res.status(500).json({ message: e?.message }); }
  });

  app.get("/api/control/clientes/:clienteId/carteiras", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) return res.status(404).json({ message: "Cliente não encontrado" });
      const data = await listCarteiras(req.tenantId, clienteId);
      res.json({ carteiras: data });
    } catch (e: any) { console.error("[control] carteiras:", e); res.status(500).json({ message: e?.message }); }
  });

  app.post("/api/control/lancamentos/:id/aprovar", ...auth, async (req: any, res) => {
    try {
      const acao = String(req.body?.acao ?? "aprovar") === "rejeitar" ? "rejeitar" : "aprovar";
      const motivo = req.body?.motivo ? String(req.body.motivo) : undefined;
      const r = await aprovarLancamento(req.tenantId, req.params.id, acao, motivo);
      res.json(r);
    } catch (e: any) { console.error("[control] aprovar lancamento:", e); res.status(500).json({ message: e?.message }); }
  });

  // ────────────────────────────────────────────────────────────────────
  // Sprint C11 — G17 Templates CSV para download
  // ────────────────────────────────────────────────────────────────────
  const TEMPLATES: Record<string, { headers: string[]; rows: string[][] }> = {
    clientes: {
      headers: ["nome", "cpf_cnpj", "email", "telefone", "endereco"],
      rows: [
        ["Maria Silva", "123.456.789-00", "maria@email.com", "11 91234-5678", "Rua A, 100"],
        ["Empresa ACME LTDA", "12.345.678/0001-90", "contato@acme.com", "11 4002-8922", "Av Paulista, 1000"],
      ],
    },
    fornecedores: {
      headers: ["nome", "cnpj", "email", "telefone", "banco", "agencia", "conta"],
      rows: [
        ["Fornecedor Exemplo SA", "98.765.432/0001-10", "vendas@fornecedor.com", "11 3000-1000", "Itaú", "1234", "56789-0"],
      ],
    },
    centros_custo: {
      headers: ["codigo", "nome", "tipo", "responsavel"],
      rows: [
        ["CC-01", "Administração", "departamento", "João"],
        ["CC-08", "Projeto Diagnóstico", "projeto", "Pedro"],
      ],
    },
    plano_contas: {
      headers: ["codigo_cfc", "descricao", "tipo", "grupo_dre"],
      rows: [
        ["3.2.2.01.0001", "Salários", "analitica", "despesas_pessoal"],
        ["3.1.1.01.0001", "Receita de Serviços", "analitica", "receita_bruta"],
      ],
    },
    lancamentos_historico: {
      headers: ["tipo", "descricao", "valor", "vencimento", "data_pagamento", "plano_conta", "cc"],
      rows: [
        ["pagar", "Aluguel Maio", "5000.00", "2026-05-05", "2026-05-05", "3.2.2.03.0001", "CC-01"],
        ["receber", "NF 1234 Cliente Maria", "8500.00", "2026-05-10", "2026-05-12", "3.1.1.01.0001", "CC-08"],
      ],
    },
  };
  function csvEscape(v: string): string {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }
  app.get("/api/control/templates/:tipo", ...auth, async (req: any, res) => {
    const t = TEMPLATES[req.params.tipo];
    if (!t) return res.status(404).json({ message: "Template não encontrado" });
    const lines = [t.headers.join(","), ...t.rows.map((r) => r.map(csvEscape).join(","))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=template_${req.params.tipo}.csv`);
    res.send("\uFEFF" + lines.join("\n") + "\n");
  });

  // Sprints 4 + 5: Grupos, Contabilidade, Conectores, Import, IBS/CBS,
  // Painel Fiscal, Fleuriet, Fechamento e Monitor NF-e
  attachSprint45Routes(app);

  // ══════════════════════════════════════════════════════════════════════════
  // Sprint C-E08 — Motor de Rateio Automático
  // ══════════════════════════════════════════════════════════════════════════
  {
    app.get("/api/control/clientes/:clienteId/rateio-configs", ...auth, async (req: any, res) => {
      try {
        const data = await listRateioConfigs(req.tenantId);
        res.json(data);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/control/clientes/:clienteId/rateio-configs", ...auth, async (req: any, res) => {
      try {
        const { centroCustoId, criterio, percentualImpacto, percentualSaf, observacoes, ativo } = req.body;
        if (!centroCustoId) return res.status(400).json({ message: "centroCustoId obrigatório" });
        if (Math.abs((percentualImpacto ?? 0) + (percentualSaf ?? 0) - 100) > 0.1) {
          return res.status(400).json({ message: "Soma dos percentuais deve ser 100%" });
        }
        const data = await upsertRateioConfig(req.tenantId, { centroCustoId, criterio, percentualImpacto, percentualSaf, observacoes, ativo });
        res.json(data);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/control/clientes/:clienteId/rateio-configs/seed-impacto", ...auth, async (req: any, res) => {
      try {
        const { clienteId } = req.params;
        const { seedRateioImpacto } = await import("./rateioAutoService");
        const result = await seedRateioImpacto(pool, clienteId);
        res.json({
          ok: true,
          mensagem: `Seed concluído: ${result.criados} criados, ${result.atualizados} atualizados`,
          ...result,
        });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post("/api/control/lancamentos/:lancamentoId/gerar-rateio", ...auth, async (req: any, res) => {
      try {
        const result = await gerarRateioAutomatico(req.tenantId, req.params.lancamentoId);
        res.json(result);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.get("/api/control/clientes/:clienteId/relatorio-rateio", ...auth, async (req: any, res) => {
      try {
        const ano = parseInt(req.query.ano ?? String(new Date().getFullYear()));
        const mes = parseInt(req.query.mes ?? String(new Date().getMonth() + 1));
        const data = await getRelatorioRateio(req.tenantId, req.params.clienteId, ano, mes);
        res.json(data);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Sprint C-E05 — Bases de Receita (via control — lista por clienteId)
  // ══════════════════════════════════════════════════════════════════════════
  {
    app.get("/api/control/clientes/:clienteId/bases-receita", ...auth, async (req: any, res) => {
      try {
        const { projetoId } = req.query;
        let q = `
          SELECT br.*, ep.numero AS projeto_numero, ep.titulo AS projeto_titulo
          FROM engineering_projeto_bases_receita br
          LEFT JOIN engineering_projects ep ON ep.id = br.projeto_id
          WHERE br.tenant_id = $1 AND br.cliente_id = $2
        `;
        const params: any[] = [req.tenantId, req.params.clienteId];
        if (projetoId) { q += ` AND br.projeto_id = $3`; params.push(projetoId); }
        q += ` ORDER BY br.competencia DESC, br.created_at DESC`;
        const r = await pool.query(q, params);
        res.json(r.rows);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Sprint C-E06 — DRE por Projeto
  // ══════════════════════════════════════════════════════════════════════════
  {
    app.get("/api/control/clientes/:clienteId/dre-projetos", ...auth, async (req: any, res) => {
      try {
        const { competencia, projetoId } = req.query;
        const [anoStr, mesStr] = (competencia ?? new Date().toISOString().slice(0,7)).split("-");
        const ano = parseInt(anoStr);
        const mes = parseInt(mesStr);

        let projetoFilter = "";
        const params: any[] = [req.tenantId, req.params.clienteId, ano, mes];
        if (projetoId) { projetoFilter = ` AND l.projeto_id = $5`; params.push(projetoId); }

        const r = await pool.query(`
          SELECT
            ep.id AS projeto_id,
            ep.numero AS projeto_numero,
            ep.titulo AS projeto_titulo,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo='receber' AND l.status IN ('pago','aprovado') AND pc.grupo_dre ILIKE '%receita%'), 0) AS receita_bruta,
            0 AS deducoes,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo='receber' AND l.status IN ('pago','aprovado') AND pc.grupo_dre ILIKE '%receita%'), 0) AS receita_liquida,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo='pagar' AND l.status IN ('pago','aprovado') AND (pc.grupo_dre ILIKE '%custo%' OR pc.grupo_dre ILIKE '%cmv%')), 0) AS custos_diretos,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo='receber' AND l.status IN ('pago','aprovado') AND pc.grupo_dre ILIKE '%receita%'), 0)
              - COALESCE(SUM(l.valor) FILTER (WHERE l.tipo='pagar' AND l.status IN ('pago','aprovado') AND (pc.grupo_dre ILIKE '%custo%' OR pc.grupo_dre ILIKE '%cmv%')), 0) AS margem_bruta,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo='pagar' AND l.status IN ('pago','aprovado') AND pc.grupo_dre ILIKE '%despesa%'), 0) AS despesas_operacionais,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo='receber' AND l.status IN ('pago','aprovado')), 0)
              - COALESCE(SUM(l.valor) FILTER (WHERE l.tipo='pagar' AND l.status IN ('pago','aprovado')), 0) AS resultado
          FROM engineering_projects ep
          LEFT JOIN lancamentos_financeiros l ON (l.projeto_id = ep.id OR l.projeto_id = ep.hub_project_id)
            AND l.tenant_id = $1
            AND EXTRACT(YEAR FROM l.data_vencimento) = $3
            AND EXTRACT(MONTH FROM l.data_vencimento) = $4
            ${projetoFilter}
          LEFT JOIN planos_contas pc ON pc.id = l.plano_conta_id
          WHERE ep.tenant_id = $1
            AND (ep.cliente_id = $2 OR $2 = '')
            AND ep.status != 'cancelado'
          GROUP BY ep.id, ep.numero, ep.titulo
          ORDER BY ep.numero
        `, params);

        const rows = r.rows.map((row: any) => ({
          ...row,
          receita_bruta: Number(row.receita_bruta),
          deducoes: Number(row.deducoes),
          receita_liquida: Number(row.receita_liquida),
          custos_diretos: Number(row.custos_diretos),
          margem_bruta: Number(row.margem_bruta),
          margem_bruta_pct: Number(row.receita_bruta) > 0
            ? Number((Number(row.margem_bruta) / Number(row.receita_bruta) * 100).toFixed(2))
            : null,
          despesas_operacionais: Number(row.despesas_operacionais),
          resultado: Number(row.resultado),
          margem_resultado_pct: Number(row.receita_bruta) > 0
            ? Number((Number(row.resultado) / Number(row.receita_bruta) * 100).toFixed(2))
            : null,
        }));

        res.json(rows);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Sprint C-E09 — Grupo Econômico: DRE consolidado + Fluxo de Caixa
  // ══════════════════════════════════════════════════════════════════════════
  {
    app.get("/api/control/grupos/:grupoId/dre-consolidado", ...auth, async (req: any, res) => {
      try {
        const { ano, mes } = req.query;
        const anoN = parseInt(ano ?? String(new Date().getFullYear()));
        const mesN = parseInt(mes ?? "0");

        // Busca grupo + membros
        const grupoR = await pool.query(
          `SELECT g.*, gm.cliente_id, gm.papel
           FROM grupos_empresariais g
           LEFT JOIN grupos_empresariais_membros gm ON gm.grupo_id = g.id
           WHERE g.id=$1 AND g.tenant_id=$2`,
          [req.params.grupoId, req.tenantId]
        );
        if (!grupoR.rows[0]) return res.status(404).json({ message: "Grupo não encontrado" });

        const grupoNome = grupoR.rows[0].nome;
        const clienteIds = [...new Set(grupoR.rows.map((r: any) => r.cliente_id).filter(Boolean))];

        if (clienteIds.length === 0) return res.json({
          grupoId: req.params.grupoId, grupoNome, periodo: `${anoN}/${mesN}`,
          receita_bruta: 0, resultado: 0, margem_pct: null,
          linhas: [], eliminacoes_total: 0,
        });

        const mesFilter = mesN > 0
          ? `AND EXTRACT(MONTH FROM l.data_vencimento) = ${mesN}`
          : "";

        const r = await pool.query(`
          SELECT
            COALESCE(pc.grupo_dre, 'outros') AS grupo_dre,
            l.empresa_rateio,
            l.tipo,
            SUM(l.valor) AS total
          FROM lancamentos_financeiros l
          LEFT JOIN planos_contas pc ON pc.id = l.plano_conta_id
          WHERE l.tenant_id = $1
            AND l.cliente_id = ANY($2::varchar[])
            AND l.status IN ('pago','aprovado')
            AND EXTRACT(YEAR FROM l.data_vencimento) = $3
            ${mesFilter}
            AND l.tipo_lancamento != 'rateio'
          GROUP BY pc.grupo_dre, l.empresa_rateio, l.tipo
        `, [req.tenantId, clienteIds, anoN]);

        // Agrupa por grupo_dre, separando por empresa_rateio
        const map = new Map<string, { impacto: number; saf: number }>();
        let receitaBruta = 0;
        let totalCustos = 0;
        let totalDespesas = 0;

        for (const row of r.rows) {
          const gd = row.grupo_dre ?? "outros";
          if (!map.has(gd)) map.set(gd, { impacto: 0, saf: 0 });
          const entry = map.get(gd)!;
          const val = Number(row.total);
          const empresa = row.empresa_rateio;
          const sinal = row.tipo === "receber" ? 1 : -1;
          if (empresa === "impacto") entry.impacto += val * sinal;
          else if (empresa === "saf") entry.saf += val * sinal;
          else entry.impacto += val * sinal; // sem rateio vai para impacto

          if (gd.includes("receita")) receitaBruta += val;
          else if (gd.includes("custo") || gd.includes("cmv")) totalCustos += val;
          else if (gd.includes("despesa")) totalDespesas += val;
        }

        // Eliminações intercompany (lançamentos origem_rateio)
        const elimR = await pool.query(`
          SELECT COALESCE(SUM(valor),0) AS total
          FROM lancamentos_financeiros
          WHERE tenant_id=$1 AND cliente_id=ANY($2::varchar[]) AND tipo_lancamento='rateio'
            AND EXTRACT(YEAR FROM data_vencimento)=$3
        `, [req.tenantId, clienteIds, anoN]);
        const eliminacoesTotal = Number(elimR.rows[0]?.total ?? 0);

        const linhas = Array.from(map.entries()).map(([grupo_dre, vals]) => ({
          grupo_dre,
          impacto: vals.impacto,
          saf: vals.saf,
          eliminacoes: 0,
          consolidado: vals.impacto + vals.saf,
        }));

        const resultado = receitaBruta - totalCustos - totalDespesas;
        const margemPct = receitaBruta > 0 ? Number((resultado / receitaBruta * 100).toFixed(2)) : null;

        res.json({
          grupoId: req.params.grupoId, grupoNome,
          periodo: `${anoN}/${mesN > 0 ? mesN : "todos"}`,
          receita_bruta: receitaBruta, resultado, margem_pct: margemPct,
          linhas, eliminacoes_total: eliminacoesTotal,
        });
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.get("/api/control/grupos/:grupoId/fluxo-caixa-consolidado", ...auth, async (req: any, res) => {
      try {
        const ano = parseInt(req.query.ano ?? String(new Date().getFullYear()));

        const grupoR = await pool.query(
          `SELECT gm.cliente_id FROM grupos_empresariais_membros gm
           JOIN grupos_empresariais g ON g.id=gm.grupo_id
           WHERE gm.grupo_id=$1 AND g.tenant_id=$2`,
          [req.params.grupoId, req.tenantId]
        );
        const clienteIds = grupoR.rows.map((r: any) => r.cliente_id).filter(Boolean);
        if (clienteIds.length === 0) return res.json([]);

        const r = await pool.query(`
          SELECT
            TO_CHAR(data_vencimento, 'MM/YYYY') AS mes,
            EXTRACT(MONTH FROM data_vencimento) AS mes_num,
            COALESCE(SUM(valor) FILTER (WHERE tipo='receber' AND empresa_rateio='impacto'), 0) AS impacto_entrada,
            COALESCE(SUM(valor) FILTER (WHERE tipo='pagar'   AND empresa_rateio='impacto'), 0) AS impacto_saida,
            COALESCE(SUM(valor) FILTER (WHERE tipo='receber' AND empresa_rateio='saf'), 0) AS saf_entrada,
            COALESCE(SUM(valor) FILTER (WHERE tipo='pagar'   AND empresa_rateio='saf'), 0) AS saf_saida
          FROM lancamentos_financeiros
          WHERE tenant_id=$1
            AND cliente_id=ANY($2::varchar[])
            AND status IN ('pago','aprovado')
            AND tipo_lancamento != 'rateio'
            AND EXTRACT(YEAR FROM data_vencimento)=$3
          GROUP BY mes, mes_num
          ORDER BY mes_num
        `, [req.tenantId, clienteIds, ano]);

        res.json(r.rows.map((row: any) => ({
          mes: row.mes,
          impacto_entrada: Number(row.impacto_entrada),
          impacto_saida: Number(row.impacto_saida),
          saf_entrada: Number(row.saf_entrada),
          saf_saida: Number(row.saf_saida),
          consolidado_liquido: Number(row.impacto_entrada) - Number(row.impacto_saida)
            + Number(row.saf_entrada) - Number(row.saf_saida),
        })));
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CTL-03-C — Seed orçamento 2026 Impacto
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/control/clientes/:clienteId/orcamento/seed-2026", ...auth, async (req: any, res) => {
    try {
      const { clienteId } = req.params;
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId)))
        return res.status(404).json({ message: "Cliente não encontrado" });
      const { seedOrcamento2026 } = await import("./seeds/orcamento2026Impacto");
      const result = await seedOrcamento2026(clienteId, req.tenantId);
      res.json({
        ok: true,
        mensagem: `${result.upserted} valores inseridos/atualizados (${result.skipped} contas não encontradas)`,
        ...result,
      });
    } catch (e: any) {
      console.error("[control] seed-orcamento-2026:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CTL-03-B — Import planilha MetaDespesas/MetaReceitas (Impacto .xlsm)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const uploadOrc = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

    app.post("/api/control/clientes/:clienteId/orcamento/import-planilha", ...auth, uploadOrc.single("file"), async (req: any, res) => {
      try {
        const { clienteId } = req.params;
        const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
        if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
        if (!(await clienteBelongsToTenant(clienteId, req.tenantId)))
          return res.status(404).json({ message: "Cliente não encontrado" });

        const itens = parseOrcamentoPlanilha(req.file.buffer as Buffer, ano);

        const contas = await db
          .select({ id: planosContas.id, descricao: planosContas.descricao, codigo: planosContas.codigo })
          .from(planosContas)
          .where(and(eq(planosContas.tenantId, req.tenantId), eq(planosContas.ativo, true)));

        const contaDescMap = new Map(contas.map((c) => [c.descricao.toLowerCase().trim(), c.id]));
        const contaCodMap  = new Map(contas.map((c) => [c.codigo, c.id]));

        let matched = 0;
        let skipped = 0;
        const upserts: any[] = [];

        for (const item of itens) {
          const planoContaId =
            contaDescMap.get(item.descricao.toLowerCase().trim()) ??
            contaCodMap.get(`DSP.${item.grupoCodigo}`) ??
            contaCodMap.get(`REC.${item.grupoCodigo}`);
          if (!planoContaId) { skipped++; continue; }
          for (const [mesStr, valor] of Object.entries(item.meses)) {
            upserts.push({
              tenantId:       req.tenantId,
              clienteId,
              planoContaId,
              ano,
              mes:            Number(mesStr),
              valorPrevisto:  String(valor),
              centroCustoId:  null,
            });
          }
          matched++;
        }

        if (upserts.length > 0) {
          await db.insert(orcamentosMensais).values(upserts).onConflictDoUpdate({
            target: [
              orcamentosMensais.tenantId,
              orcamentosMensais.clienteId,
              orcamentosMensais.planoContaId,
              orcamentosMensais.ano,
              orcamentosMensais.mes,
            ],
            set: { valorPrevisto: sql`EXCLUDED.valor_previsto` },
          });
        }

        res.json({
          ok: true,
          itensEncontrados:  itens.length,
          matched,
          skipped,
          valoresUpsertados: upserts.length,
        });
      } catch (e: any) {
        console.error("[control] import-orcamento-planilha:", e);
        res.status(500).json({ message: e.message });
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Sprint C-E11 — Import Planilha
  // ══════════════════════════════════════════════════════════════════════════
  {
    const uploadPlanilha = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

    app.post("/api/control/clientes/:clienteId/import-planilha/preview", ...auth, uploadPlanilha.single("file"), async (req: any, res) => {
      try {
        if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
        const preview = parsePlanilhaPreview(req.file.buffer);
        res.json(preview);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    app.post("/api/control/clientes/:clienteId/import-planilha/confirm", ...auth, async (req: any, res) => {
      try {
        const { preview } = req.body;
        if (!preview) return res.status(400).json({ message: "Preview obrigatório" });
        const result = await confirmPlanilhaImport(req.tenantId, req.params.clienteId, preview, req.user?.id);
        res.json(result);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    // CTL-IMPORT-01: Preview COMPLETO (inclui lançamentos AR/AP + saldos iniciais)
    app.post("/api/control/clientes/:clienteId/import-planilha/preview-completo", ...auth, uploadPlanilha.single("file"), async (req: any, res) => {
      try {
        if (!req.file?.buffer) return res.status(400).json({ message: "Arquivo obrigatório" });
        const preview = parsePreviewCompleto(req.file.buffer);
        res.json(preview);
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });

    // CTL-IMPORT-01: Confirm COMPLETO (importa lançamentos + cadastros + saldos)
    app.post("/api/control/clientes/:clienteId/import-planilha/confirm-completo", ...auth, async (req: any, res) => {
      try {
        const { preview } = req.body;
        if (!preview) return res.status(400).json({ message: "Preview obrigatório" });
        const result = await confirmImportCompleto(req.tenantId, req.params.clienteId, preview, req.user?.id);
        res.json({ ...result, message: `${result.total} registros importados com sucesso` });
      } catch (e: any) { res.status(500).json({ message: e.message }); }
    });
  }

  attachCartaoRoutes(app);
}
