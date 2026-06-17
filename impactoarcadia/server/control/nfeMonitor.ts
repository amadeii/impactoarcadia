import cron from "node-cron";
import { db } from "../db";
import {
  conectores,
  nfesRecebidas,
  clients,
  type NfeRecebida,
} from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { decryptConfig } from "../cryptoService";
import { gerarNfesSimuladas } from "./connectors/nuvemFiscalConnector";

/**
 * NF-e Monitor — worker horário que consulta a Distribuição DFe da SEFAZ
 * via Nuvem Fiscal para cada cliente que tem o conector configurado.
 *
 * Modo SIMULADO (Sprint 5): gera NF-e sintéticas para validar fluxo.
 * Quando o usuário fornecer apiKey real, o gerarNfesSimuladas é trocado
 * por uma chamada real ao endpoint Nuvem Fiscal.
 *
 * Manifestação automática: ao receber uma NF-e nova, o monitor cria o
 * registro com status_manifestacao='ciencia' (obrigatório por lei em 30 dias).
 */

let cronStarted = false;

export function startNfeMonitor() {
  if (cronStarted) return;
  cronStarted = true;
  // A cada hora, no minuto 5
  cron.schedule("5 * * * *", async () => {
    try {
      await tickAllTenants();
    } catch (e) {
      console.error("[NfeMonitor] tick error:", e);
    }
  });
  console.log("[NfeMonitor] Iniciado (cron horário, modo SIMULADO)");
}

/** Chamável manualmente pelas rotas para forçar polling agora. */
export async function tickAllTenants(): Promise<{ tenants: number; nfesNovas: number }> {
  const ativos = await db.select().from(conectores).where(and(
    eq(conectores.tipoConector, "nuvem_fiscal"),
    eq(conectores.ativo, true),
    eq(conectores.status, "ativo"),
  ));

  let nfesNovas = 0;
  const tenantsAtingidos = new Set<string>();
  for (const c of ativos) {
    if (!c.clienteId) continue;
    const novas = await polling(c.tenantId, c.clienteId, c.id);
    nfesNovas += novas;
    tenantsAtingidos.add(c.tenantId);
  }
  return { tenants: tenantsAtingidos.size, nfesNovas };
}

/** Polling para um cliente específico. Retorna quantidade de NF-e novas. */
export async function polling(
  tenantId: string,
  clienteId: string,
  conectorId: string,
): Promise<number> {
  const [cliente] = await db.select({ id: clients.id, company: clients.company }).from(clients)
    .where(and(eq(clients.id, clienteId), eq(clients.tenantId, tenantId)))
    .limit(1);
  if (!cliente) return 0;

  // Em modo real, aqui chamamos o NuvemFiscalClient com creds descriptografadas.
  // No stub, derivamos seed determinístico do id do cliente para gerar NF-e
  // sintéticas estáveis entre execuções (cliente real ainda não tem campo CNPJ —
  // virá em uma sprint futura junto com cadastro fiscal completo).
  const seed = (cliente.company ?? cliente.id).replace(/\D/g, "").padStart(14, "0").slice(0, 14) || cliente.id.replace(/\D/g, "").padStart(14, "0").slice(0, 14);
  const nfesSimuladas = gerarNfesSimuladas(seed, 3);

  let novas = 0;
  for (const nfe of nfesSimuladas) {
    // Tenta inserir; se chave já existe, .returning() vem vazio e não conta
    try {
      const inserted = await db.insert(nfesRecebidas).values({
        tenantId,
        clienteId,
        chaveNfe: nfe.chaveNfe,
        numeroNfe: nfe.numero,
        serieNfe: nfe.serie,
        dataEmissao: nfe.dataEmissao,
        valorTotal: nfe.valorTotal.toFixed(2),
        fornecedorCnpj: nfe.fornecedorCnpj,
        fornecedorNome: nfe.fornecedorNome,
        xmlConteudo: nfe.xmlConteudo,
        statusManifestacao: "ciencia", // Manifestação automática obrigatória
        categorizacaoIa: categorizarPorAgente(nfe) as any,
      }).onConflictDoNothing().returning({ id: nfesRecebidas.id });
      if (inserted.length > 0) novas += 1;
    } catch (e) {
      // Ignora — provavelmente conflito de unique
    }
  }
  return novas;
}

/**
 * Stub de categorização do agente. Em produção, plugar Anthropic com
 * prompt que recebe o XML e devolve { planoContaSugerido, centroCustoSugerido,
 * confianca, justificativa }.
 */
function categorizarPorAgente(nfe: { fornecedorNome: string; valorTotal: number }) {
  const nome = (nfe.fornecedorNome || "").toLowerCase();
  let categoriaSugerida = "Despesas Operacionais";
  if (nome.includes("distribu")) categoriaSugerida = "Custos com Mercadoria";
  else if (nome.includes("servi")) categoriaSugerida = "Despesas com Serviços";
  return {
    categoriaSugerida,
    confianca: 0.65,
    justificativa: `Categorizado por nome do fornecedor (heurística stub). Plugue o agente IA real para análise do XML.`,
    valorTotal: nfe.valorTotal,
    propostoEm: new Date().toISOString(),
  };
}

export async function listNfesRecebidas(
  tenantId: string,
  clienteId: string,
  status?: string,
  limit = 50,
): Promise<NfeRecebida[]> {
  const conds = [
    eq(nfesRecebidas.tenantId, tenantId),
    eq(nfesRecebidas.clienteId, clienteId),
  ];
  if (status) conds.push(eq(nfesRecebidas.statusManifestacao, status));
  return db.select().from(nfesRecebidas)
    .where(and(...conds))
    .orderBy(sql`${nfesRecebidas.dataEmissao} DESC NULLS LAST`)
    .limit(limit);
}

export async function manifestarNfe(
  tenantId: string,
  nfeId: string,
  novoStatus: "ciencia" | "confirmacao" | "desconhecimento" | "nao_realizada",
): Promise<NfeRecebida | undefined> {
  const [n] = await db.update(nfesRecebidas)
    .set({ statusManifestacao: novoStatus, processadoEm: new Date() })
    .where(and(eq(nfesRecebidas.tenantId, tenantId), eq(nfesRecebidas.id, nfeId)))
    .returning();
  return n;
}
