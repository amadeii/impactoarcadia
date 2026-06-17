import { db } from "../db";
import {
  conectores,
  conectoresSyncLogs,
  type Conector,
  type InsertConector,
} from "@shared/schema";
import { and, eq, desc } from "drizzle-orm";
import { encryptConfig, decryptConfig } from "../cryptoService";

import { brasilApiConnector } from "./connectors/brasilApiConnector";
import { dominioConnector } from "./connectors/dominioConnector";
import { nuvemFiscalConnector } from "./connectors/nuvemFiscalConnector";

/**
 * Hub de Conectores — registry central. Cada IConnector implementa
 * test/sync/describeConfig. O Hub cuida da persistência dos cadastros
 * (com config criptografada) e dos logs de sync.
 *
 * Sprint 4 entrega 3 conectores:
 *   - brasil_api  : real, sem credencial (endpoint público)
 *   - dominio     : stub estruturado (precisa API key do Domínio)
 *   - nuvem_fiscal: stub estruturado (precisa API key da Nuvem Fiscal)
 *
 * Sprints 6-9 vão adicionar: omie, bling, conta_azul, open_finance,
 * asaas, iugu, pipedrive, hubspot, rd_station, totvs_protheus, sap_b1,
 * quickbooks, stripe.
 */

export interface SyncResult {
  ok: boolean;
  count: number;
  message?: string;
  details?: any;
}

export interface ConfigField {
  name: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface IConnector {
  tipo: string;
  nome: string;
  descricao: string;
  /** Categorias para a UI agrupar: 'fiscal' | 'erp' | 'banco' | 'crm' | 'cobranca' | 'comunicacao' | 'publico' */
  categoria: "fiscal" | "erp" | "banco" | "crm" | "cobranca" | "comunicacao" | "publico";
  describeConfig(): ConfigField[];
  testConnection(creds: Record<string, any>): Promise<{ ok: boolean; message?: string }>;
  sync(creds: Record<string, any>, params?: Record<string, any>): Promise<SyncResult>;
}

const REGISTRY: Record<string, IConnector> = {
  brasil_api: brasilApiConnector,
  dominio: dominioConnector,
  nuvem_fiscal: nuvemFiscalConnector,
};

export function listConnectorTypes(): Array<Omit<IConnector, "describeConfig" | "testConnection" | "sync">> {
  return Object.values(REGISTRY).map((c) => ({
    tipo: c.tipo,
    nome: c.nome,
    descricao: c.descricao,
    categoria: c.categoria,
  }));
}

export function getConnectorImpl(tipo: string): IConnector | undefined {
  return REGISTRY[tipo];
}

export function describeConnector(tipo: string): ConfigField[] {
  return REGISTRY[tipo]?.describeConfig() ?? [];
}

// ── Persistência (cadastros e logs) ─────────────────────────────────

export async function listConectores(tenantId: string, clienteId?: string): Promise<Conector[]> {
  const conds = [eq(conectores.tenantId, tenantId)];
  if (clienteId) conds.push(eq(conectores.clienteId, clienteId));
  return db.select().from(conectores).where(and(...conds)).orderBy(desc(conectores.createdAt));
}

export async function getConector(tenantId: string, id: string): Promise<Conector | undefined> {
  const [c] = await db.select().from(conectores)
    .where(and(eq(conectores.tenantId, tenantId), eq(conectores.id, id)))
    .limit(1);
  return c;
}

export async function createConector(
  data: Omit<InsertConector, "configCriptografada" | "status">,
  creds: Record<string, any>,
): Promise<Conector> {
  const impl = REGISTRY[data.tipoConector];
  if (!impl) throw new Error(`Conector desconhecido: ${data.tipoConector}`);
  const encrypted = creds && Object.keys(creds).length > 0 ? encryptConfig(creds) : null;
  const [c] = await db.insert(conectores).values({
    ...data,
    configCriptografada: encrypted,
    status: encrypted ? "ativo" : "nao_configurado",
  }).returning();
  return c;
}

export async function updateConectorCreds(
  tenantId: string,
  id: string,
  creds: Record<string, any>,
): Promise<Conector | undefined> {
  const encrypted = encryptConfig(creds);
  const [c] = await db.update(conectores)
    .set({ configCriptografada: encrypted, status: "ativo", ultimoErro: null })
    .where(and(eq(conectores.tenantId, tenantId), eq(conectores.id, id)))
    .returning();
  return c;
}

export async function deleteConector(tenantId: string, id: string): Promise<boolean> {
  const r = await db.delete(conectores)
    .where(and(eq(conectores.tenantId, tenantId), eq(conectores.id, id)));
  return (r as any).rowCount > 0;
}

async function loadCreds(c: Conector): Promise<Record<string, any>> {
  if (!c.configCriptografada) return {};
  try {
    return decryptConfig(c.configCriptografada);
  } catch (e: any) {
    throw new Error(`Falha ao descriptografar credenciais: ${e?.message ?? e}`);
  }
}

export async function testConector(tenantId: string, id: string): Promise<{ ok: boolean; message?: string }> {
  const c = await getConector(tenantId, id);
  if (!c) return { ok: false, message: "Conector não encontrado" };
  const impl = REGISTRY[c.tipoConector];
  if (!impl) return { ok: false, message: `Tipo não suportado: ${c.tipoConector}` };
  const creds = await loadCreds(c);
  const r = await impl.testConnection(creds);
  await db.update(conectores)
    .set({
      status: r.ok ? "ativo" : "erro",
      ultimoErro: r.ok ? null : (r.message ?? "Erro desconhecido"),
    })
    .where(eq(conectores.id, id));
  return r;
}

export async function executeSync(
  tenantId: string,
  id: string,
  params?: Record<string, any>,
): Promise<SyncResult> {
  const c = await getConector(tenantId, id);
  if (!c) return { ok: false, count: 0, message: "Conector não encontrado" };
  const impl = REGISTRY[c.tipoConector];
  if (!impl) return { ok: false, count: 0, message: `Tipo não suportado: ${c.tipoConector}` };

  const [log] = await db.insert(conectoresSyncLogs).values({
    tenantId,
    conectorId: id,
    status: "em_andamento",
    registrosProcessados: 0,
  }).returning();

  try {
    const creds = await loadCreds(c);
    const result = await impl.sync(creds, params);
    await db.update(conectoresSyncLogs).set({
      status: result.ok ? "sucesso" : "erro",
      finalizadoEm: new Date(),
      registrosProcessados: result.count,
      mensagem: result.message ?? null,
      payloadResumo: (result.details ?? null) as any,
    }).where(eq(conectoresSyncLogs.id, log.id));
    await db.update(conectores).set({
      ultimaSincronizacao: new Date(),
      status: result.ok ? "ativo" : "erro",
      ultimoErro: result.ok ? null : (result.message ?? "Erro na sincronização"),
    }).where(eq(conectores.id, id));
    return result;
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await db.update(conectoresSyncLogs).set({
      status: "erro",
      finalizadoEm: new Date(),
      mensagem: msg,
    }).where(eq(conectoresSyncLogs.id, log.id));
    await db.update(conectores).set({
      status: "erro",
      ultimoErro: msg,
    }).where(eq(conectores.id, id));
    return { ok: false, count: 0, message: msg };
  }
}

export async function listSyncLogs(tenantId: string, conectorId: string, limit = 20) {
  return db.select().from(conectoresSyncLogs)
    .where(and(
      eq(conectoresSyncLogs.tenantId, tenantId),
      eq(conectoresSyncLogs.conectorId, conectorId),
    ))
    .orderBy(desc(conectoresSyncLogs.iniciadoEm))
    .limit(limit);
}
