/**
 * Rotas Sprint 4 + 5 do Arcádia Control
 * Anexadas ao registerControlRoutes via attachSprint45Routes(app).
 */
import type { Express } from "express";
import { db } from "../db";
import {
  clients,
  insertGrupoEmpresarialSchema,
  insertGrupoMembroSchema,
  insertConectorSchema,
  insertRegimeTributarioSchema,
  regimeTributarioConfig,
  lancamentosFinanceiros,
  planosContas,
} from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant, requireTenantAdmin } from "../tenantContext";

import * as grupoSvc from "./grupoService";
import * as contabSvc from "./contabilidadeService";
import * as hub from "./connectorHub";
import * as imp from "./importService";
import * as ibsCbs from "./ibsCbsService";
import * as nfeMon from "./nfeMonitor";
import * as fleuriet from "./fleurietService";
import * as fechSvc from "./fechamentoService";
import { consultarCnpj, consultarCep } from "./connectors/brasilApiConnector";

const auth = [isAuthenticated, tenantContext, requireTenant];

async function clienteBelongsToTenant(clienteId: string, tenantId: string): Promise<boolean> {
  const [c] = await db.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.id, clienteId), eq(clients.tenantId, tenantId)))
    .limit(1);
  return !!c;
}

export function attachSprint45Routes(app: Express) {
  // ============================================================
  //  GRUPOS EMPRESARIAIS
  // ============================================================
  app.get("/api/control/grupos", ...auth, async (req: any, res) => {
    try {
      const list = await grupoSvc.listGrupos(req.tenantId);
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro ao listar grupos" });
    }
  });

  app.post("/api/control/grupos", ...auth, async (req: any, res) => {
    try {
      const parsed = insertGrupoEmpresarialSchema.parse({ ...req.body, tenantId: String(req.tenantId) });
      if (parsed.matrizClienteId && !(await clienteBelongsToTenant(parsed.matrizClienteId, req.tenantId))) {
        return res.status(400).json({ message: "Cliente matriz inválido" });
      }
      const g = await grupoSvc.createGrupo(parsed);
      res.status(201).json(g);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      res.status(500).json({ message: e?.message ?? "Erro ao criar grupo" });
    }
  });

  app.get("/api/control/grupos/:id", ...auth, async (req: any, res) => {
    try {
      const g = await grupoSvc.getGrupo(req.tenantId, req.params.id);
      if (!g) return res.status(404).json({ message: "Grupo não encontrado" });
      res.json(g);
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro ao buscar grupo" });
    }
  });

  app.patch("/api/control/grupos/:id", ...auth, async (req: any, res) => {
    try {
      const g = await grupoSvc.updateGrupo(req.tenantId, req.params.id, req.body);
      if (!g) return res.status(404).json({ message: "Grupo não encontrado" });
      res.json(g);
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro ao atualizar grupo" });
    }
  });

  app.delete("/api/control/grupos/:id", ...auth, async (req: any, res) => {
    try {
      const ok = await grupoSvc.deleteGrupo(req.tenantId, req.params.id);
      if (!ok) return res.status(404).json({ message: "Grupo não encontrado" });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro ao excluir grupo" });
    }
  });

  app.get("/api/control/grupos/:id/membros", ...auth, async (req: any, res) => {
    try {
      const ms = await grupoSvc.listMembros(req.tenantId, req.params.id);
      res.json(ms);
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro ao listar membros" });
    }
  });

  app.post("/api/control/grupos/:id/membros", ...auth, async (req: any, res) => {
    try {
      const parsed = insertGrupoMembroSchema.parse({ ...req.body, tenantId: String(req.tenantId), grupoId: req.params.id });
      if (!(await clienteBelongsToTenant(parsed.clienteId, req.tenantId))) {
        return res.status(400).json({ message: "Cliente inválido" });
      }
      const g = await grupoSvc.getGrupo(req.tenantId, req.params.id);
      if (!g) return res.status(404).json({ message: "Grupo não encontrado" });
      const m = await grupoSvc.addMembro(parsed);
      res.status(201).json(m);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      if (e?.code === "23505") return res.status(409).json({ message: "Cliente já é membro deste grupo" });
      res.status(500).json({ message: e?.message ?? "Erro" });
    }
  });

  app.delete("/api/control/grupos/:id/membros/:membroId", ...auth, async (req: any, res) => {
    try {
      const ok = await grupoSvc.removeMembro(req.tenantId, req.params.id, req.params.membroId);
      if (!ok) return res.status(404).json({ message: "Membro não encontrado" });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro ao remover membro" });
    }
  });

  app.get("/api/control/grupos/:id/dre", ...auth, async (req: any, res) => {
    try {
      const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
      const mes = parseInt(String(req.query.mes ?? (new Date().getMonth() + 1)), 10);
      const regime = (String(req.query.regime ?? "competencia") === "caixa" ? "caixa" : "competencia") as "caixa" | "competencia";
      const r = await grupoSvc.dreConsolidada(req.tenantId, req.params.id, ano, mes, regime);
      res.json(r);
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro DRE" });
    }
  });

  app.post("/api/control/grupos/:id/rateio", ...auth, async (req: any, res) => {
    try {
      const valor = Number(req.body?.valor ?? 0);
      if (!valor || valor <= 0) return res.status(400).json({ message: "valor é obrigatório" });
      const r = await grupoSvc.calcularRateio(req.tenantId, req.params.id, valor);
      res.json({ rateios: r, totalRateado: r.reduce((s, x) => s + x.valor, 0) });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro" });
    }
  });

  // ============================================================
  //  CONTABILIDADE — Partidas Dobradas
  // ============================================================
  const lancContabilSchema = z.object({
    cabecalho: z.object({
      clienteId: z.string(),
      data: z.string(),
      historico: z.string().min(1),
      numeroDoc: z.string().nullable().optional(),
      lote: z.string().nullable().optional(),
      origem: z.enum(["manual", "sistema", "integracao", "importacao"]).optional(),
      grupoId: z.string().nullable().optional(),
      periodoId: z.string().nullable().optional(),
      observacoes: z.string().nullable().optional(),
    }),
    partidas: z.array(z.object({
      planoContaId: z.string(),
      centroCustoId: z.string().nullable().optional(),
      tipo: z.enum(["D", "C"]),
      valor: z.union([z.string(), z.number()]).transform((v) => String(v)),
      rateio: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
      descricao: z.string().nullable().optional(),
    })).min(2),
  });

  app.post("/api/control/contabilidade/lancamentos", ...auth, async (req: any, res) => {
    try {
      const parsed = lancContabilSchema.parse(req.body);
      if (!(await clienteBelongsToTenant(parsed.cabecalho.clienteId, req.tenantId))) {
        return res.status(400).json({ message: "Cliente inválido" });
      }
      // Verifica se período não está bloqueado
      const dataLanc = new Date(parsed.cabecalho.data);
      if (await fechSvc.periodoBloqueado(req.tenantId, parsed.cabecalho.clienteId, dataLanc)) {
        return res.status(423).json({ message: "Período fechado — reabra o fechamento contábil para lançar nesta data" });
      }
      const r = await contabSvc.createLancamento({
        cabecalho: { ...parsed.cabecalho, tenantId: String(req.tenantId), criadoPor: req.user?.id ?? null } as any,
        partidas: parsed.partidas as any,
      });
      res.status(201).json(r);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      res.status(400).json({ message: e?.message ?? "Erro" });
    }
  });

  app.get("/api/control/contabilidade/lancamentos/:id", ...auth, async (req: any, res) => {
    try {
      const r = await contabSvc.getLancamento(req.tenantId, req.params.id);
      if (!r) return res.status(404).json({ message: "Lançamento não encontrado" });
      res.json(r);
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro ao buscar lançamento" });
    }
  });

  app.get("/api/control/clientes/:clienteId/contabilidade/lancamentos", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const limit = parseInt(String(req.query.limit ?? 50), 10);
      res.json(await contabSvc.listLancamentos(req.tenantId, req.params.clienteId, limit));
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro ao listar lançamentos" });
    }
  });

  app.delete("/api/control/contabilidade/lancamentos/:id", ...auth, async (req: any, res) => {
    try {
      const ok = await contabSvc.deleteLancamento(req.tenantId, req.params.id);
      if (!ok) return res.status(404).json({ message: "Lançamento não encontrado" });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro ao excluir lançamento" });
    }
  });

  app.get("/api/control/clientes/:clienteId/contabilidade/razao/:planoContaId", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);
      const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;
      res.json(await contabSvc.razaoConta(req.tenantId, req.params.clienteId, req.params.planoContaId, ano, mes));
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro ao consultar razão" });
    }
  });

  // ============================================================
  //  HUB DE CONECTORES
  // ============================================================
  app.get("/api/control/conectores/tipos", ...auth, async (_req: any, res) => {
    res.json(hub.listConnectorTypes());
  });

  app.get("/api/control/conectores/tipos/:tipo/config", ...auth, async (req: any, res) => {
    res.json(hub.describeConnector(req.params.tipo));
  });

  app.get("/api/control/conectores", ...auth, async (req: any, res) => {
    const clienteId = req.query.clienteId as string | undefined;
    if (clienteId && !(await clienteBelongsToTenant(clienteId, req.tenantId))) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }
    res.json(await hub.listConectores(req.tenantId, clienteId));
  });

  app.post("/api/control/conectores", ...auth, async (req: any, res) => {
    try {
      const { creds, ...rest } = req.body ?? {};
      const parsed = insertConectorSchema.parse({ ...rest, tenantId: String(req.tenantId) });
      if (parsed.clienteId && !(await clienteBelongsToTenant(parsed.clienteId, req.tenantId))) {
        return res.status(400).json({ message: "Cliente inválido" });
      }
      const c = await hub.createConector(parsed as any, creds ?? {});
      res.status(201).json({ ...c, configCriptografada: undefined });
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      res.status(400).json({ message: e?.message ?? "Erro" });
    }
  });

  app.patch("/api/control/conectores/:id/credenciais", ...auth, async (req: any, res) => {
    try {
      const c = await hub.updateConectorCreds(req.tenantId, req.params.id, req.body?.creds ?? {});
      if (!c) return res.status(404).json({ message: "Conector não encontrado" });
      res.json({ ...c, configCriptografada: undefined });
    } catch (e: any) {
      res.status(400).json({ message: e?.message ?? "Erro" });
    }
  });

  app.delete("/api/control/conectores/:id", ...auth, async (req: any, res) => {
    const ok = await hub.deleteConector(req.tenantId, req.params.id);
    if (!ok) return res.status(404).json({ message: "Conector não encontrado" });
    res.json({ ok: true });
  });

  app.post("/api/control/conectores/:id/test", ...auth, async (req: any, res) => {
    res.json(await hub.testConector(req.tenantId, req.params.id));
  });

  app.post("/api/control/conectores/:id/sync", ...auth, async (req: any, res) => {
    res.json(await hub.executeSync(req.tenantId, req.params.id, req.body ?? {}));
  });

  app.get("/api/control/conectores/:id/logs", ...auth, async (req: any, res) => {
    const limit = parseInt(String(req.query.limit ?? 20), 10);
    res.json(await hub.listSyncLogs(req.tenantId, req.params.id, limit));
  });

  // BrasilAPI on-demand (sem precisar de conector cadastrado)
  app.get("/api/control/brasil-api/cnpj/:cnpj", ...auth, async (req: any, res) => {
    try {
      res.json(await consultarCnpj(req.params.cnpj));
    } catch (e: any) {
      res.status(400).json({ message: e?.message ?? "Erro" });
    }
  });

  app.get("/api/control/brasil-api/cep/:cep", ...auth, async (req: any, res) => {
    try {
      res.json(await consultarCep(req.params.cep));
    } catch (e: any) {
      res.status(400).json({ message: e?.message ?? "Erro" });
    }
  });

  // ============================================================
  //  IMPORT WIZARD
  // ============================================================
  const detectSchema = z.object({ headers: z.array(z.string()) });
  app.post("/api/control/import/detectar", ...auth, async (req: any, res) => {
    try {
      const { headers } = detectSchema.parse(req.body);
      res.json({ mapeamento: imp.detectarMapeamento(headers) });
    } catch (e: any) {
      res.status(400).json({ message: e?.message ?? "Erro" });
    }
  });

  const previewSchema = z.object({
    clienteId: z.string(),
    rows: z.array(z.record(z.any())),
    mapping: z.array(z.object({ field: z.string(), sourceColumn: z.string(), confidence: z.number() })),
  });
  app.post("/api/control/import/preview", ...auth, async (req: any, res) => {
    try {
      const { clienteId, rows, mapping } = previewSchema.parse(req.body);
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(400).json({ message: "Cliente inválido" });
      }
      let mapped = imp.aplicarMapeamento(rows, mapping, { tenantId: req.tenantId, clienteId });
      mapped = await imp.categorizar(req.tenantId, mapped);
      res.json({
        total: mapped.length,
        validos: mapped.filter((r) => !r._erro).length,
        comErro: mapped.filter((r) => r._erro).length,
        amostra: mapped.slice(0, 20),
        mapeamento: mapping,
      });
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      res.status(500).json({ message: e?.message ?? "Erro" });
    }
  });

  app.post("/api/control/import/executar", ...auth, async (req: any, res) => {
    try {
      const { clienteId, rows, mapping } = previewSchema.parse(req.body);
      if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
        return res.status(400).json({ message: "Cliente inválido" });
      }
      let mapped = imp.aplicarMapeamento(rows, mapping, { tenantId: req.tenantId, clienteId });
      mapped = await imp.categorizar(req.tenantId, mapped);
      const r = await imp.executarImportacao(mapped);
      res.json(r);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      res.status(500).json({ message: e?.message ?? "Erro" });
    }
  });

  // ============================================================
  //  IBS / CBS — Sprint 5
  // ============================================================
  app.post("/api/control/ibs-cbs/calcular", ...auth, async (req: any, res) => {
    try {
      const valor = Number(req.body?.valor ?? 0);
      const ano = parseInt(String(req.body?.ano ?? new Date().getFullYear()), 10);
      const operacao = String(req.body?.operacao ?? "venda_produto");
      if (!valor || valor <= 0) return res.status(400).json({ message: "valor obrigatório" });
      if (!["venda_produto", "servico", "importacao", "exportacao"].includes(operacao)) {
        return res.status(400).json({ message: "operacao inválida" });
      }
      res.json(ibsCbs.calcularIbsCbs(valor, ano, operacao as any));
    } catch (e: any) {
      res.status(400).json({ message: e?.message ?? "Erro" });
    }
  });

  app.get("/api/control/clientes/:clienteId/painel-fiscal", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const ano = parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);

      // Busca lançamentos de receita do ano e mapeia para operações
      const linhas = await db.select({
        valor: lancamentosFinanceiros.valor,
        natureza: planosContas.natureza,
      })
        .from(lancamentosFinanceiros)
        .leftJoin(planosContas, eq(planosContas.id, lancamentosFinanceiros.planoContaId))
        .where(and(
          eq(lancamentosFinanceiros.tenantId, req.tenantId),
          eq(lancamentosFinanceiros.clienteId, req.params.clienteId),
          eq(lancamentosFinanceiros.tipo, "receber"),
          sql`EXTRACT(YEAR FROM ${lancamentosFinanceiros.dataVencimento}) = ${ano}`,
        ));

      const operacoes = linhas
        .filter((l) => l.natureza === "receita")
        .map((l) => ({ valor: Number(l.valor), tipo: "venda_produto" as const }));

      const consolidado = ibsCbs.consolidarCarga(operacoes, ano);
      res.json({ ano, ...consolidado });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro" });
    }
  });

  // Regime tributário config
  app.get("/api/control/clientes/:clienteId/regime", ...auth, async (req: any, res) => {
    if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }
    const rows = await db.select().from(regimeTributarioConfig)
      .where(and(eq(regimeTributarioConfig.tenantId, req.tenantId), eq(regimeTributarioConfig.clienteId, req.params.clienteId)))
      .orderBy(regimeTributarioConfig.ano);
    res.json(rows);
  });

  app.post("/api/control/clientes/:clienteId/regime", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const parsed = insertRegimeTributarioSchema.parse({ ...req.body, tenantId: String(req.tenantId), clienteId: req.params.clienteId });
      const [row] = await db.insert(regimeTributarioConfig).values(parsed as any)
        .onConflictDoUpdate({
          target: [regimeTributarioConfig.tenantId, regimeTributarioConfig.clienteId, regimeTributarioConfig.ano],
          set: { regime: parsed.regime, aliquotasPersonalizadas: parsed.aliquotasPersonalizadas as any },
        })
        .returning();
      res.status(201).json(row);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ message: "Dados inválidos", issues: e.issues });
      res.status(500).json({ message: e?.message ?? "Erro" });
    }
  });

  // ============================================================
  //  MONITOR NF-e — Sprint 5
  // ============================================================
  app.get("/api/control/clientes/:clienteId/nfes", ...auth, async (req: any, res) => {
    if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }
    const status = req.query.status as string | undefined;
    res.json(await nfeMon.listNfesRecebidas(req.tenantId, req.params.clienteId, status));
  });

  app.post("/api/control/nfes/:id/manifestar", ...auth, async (req: any, res) => {
    try {
      const status = String(req.body?.status ?? "");
      if (!["ciencia", "confirmacao", "desconhecimento", "nao_realizada"].includes(status)) {
        return res.status(400).json({ message: "status inválido" });
      }
      const n = await nfeMon.manifestarNfe(req.tenantId, req.params.id, status as any);
      if (!n) return res.status(404).json({ message: "NF-e não encontrada" });
      res.json(n);
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro" });
    }
  });

  app.post("/api/control/nfe-monitor/poll-now", ...auth, async (req: any, res) => {
    try {
      // Se vier clienteId, faz polling direto naquele cliente em modo demo
      // (sem exigir conector nuvem_fiscal cadastrado). Isso permite que o
      // usuário valide a tela de NF-e antes de configurar credenciais reais.
      const clienteId = req.body?.clienteId as string | undefined;
      if (clienteId) {
        if (!(await clienteBelongsToTenant(clienteId, req.tenantId))) {
          return res.status(404).json({ message: "Cliente não encontrado" });
        }
        const novas = await nfeMon.polling(req.tenantId, clienteId, "manual-demo");
        return res.json({ tenants: 1, nfesNovas: novas, modoDemo: true });
      }
      // Caminho global (sem clienteId) processa TODOS os tenants — restrito ao
      // próprio tenant_admin do tenant atual via varredura limitada.
      const role = req.user?.role ?? req.userClaims?.role;
      if (role !== "superadmin" && role !== "tenant_admin") {
        return res.status(403).json({
          message: "Polling global requer tenant_admin. Use { clienteId } para polling por cliente.",
        });
      }
      const r = await nfeMon.tickAllTenants();
      res.json(r);
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro" });
    }
  });

  // ============================================================
  //  FLEURIET — Sprint 5
  // ============================================================
  app.get("/api/control/clientes/:clienteId/fleuriet", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const dataRef = req.query.data ? new Date(String(req.query.data)) : new Date();
      res.json(await fleuriet.calcularFleuriet(req.tenantId, req.params.clienteId, dataRef));
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro" });
    }
  });

  // ============================================================
  //  FECHAMENTO — Sprint 5
  // ============================================================
  app.post("/api/control/clientes/:clienteId/fechamentos", ...auth, async (req: any, res) => {
    try {
      if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      const ano = parseInt(String(req.body?.ano ?? new Date().getFullYear()), 10);
      const mes = parseInt(String(req.body?.mes ?? (new Date().getMonth() + 1)), 10);
      const f = await fechSvc.iniciarFechamento(req.tenantId, req.params.clienteId, ano, mes, req.user?.id ?? "");
      res.status(201).json(f);
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "Erro" });
    }
  });

  app.get("/api/control/clientes/:clienteId/fechamentos/:ano/:mes", ...auth, async (req: any, res) => {
    if (!(await clienteBelongsToTenant(req.params.clienteId, req.tenantId))) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }
    const f = await fechSvc.getFechamento(req.tenantId, req.params.clienteId, parseInt(req.params.ano, 10), parseInt(req.params.mes, 10));
    if (!f) return res.status(404).json({ message: "Fechamento não encontrado" });
    res.json(f);
  });

  app.patch("/api/control/fechamentos/:id/checklist", ...auth, async (req: any, res) => {
    try {
      const itemId = String(req.body?.itemId ?? "");
      const done = !!req.body?.done;
      if (!itemId) return res.status(400).json({ message: "itemId obrigatório" });
      const f = await fechSvc.updateChecklist(req.tenantId, req.params.id, itemId, done);
      if (!f) return res.status(404).json({ message: "Fechamento não encontrado" });
      res.json(f);
    } catch (e: any) {
      res.status(400).json({ message: e?.message ?? "Erro" });
    }
  });

  app.post("/api/control/fechamentos/:id/concluir", ...auth, async (req: any, res) => {
    try {
      const f = await fechSvc.concluirFechamento(req.tenantId, req.params.id, req.user?.id ?? "");
      res.json(f);
    } catch (e: any) {
      res.status(400).json({ message: e?.message ?? "Erro ao concluir" });
    }
  });

  app.post("/api/control/fechamentos/:id/reabrir", isAuthenticated, tenantContext, requireTenant, requireTenantAdmin, async (req: any, res) => {
    try {
      const f = await fechSvc.reabrirFechamento(req.tenantId, req.params.id);
      res.json(f);
    } catch (e: any) {
      res.status(400).json({ message: e?.message ?? "Erro ao reabrir" });
    }
  });
}
