// Sprint C7 — G2 Recorrência.
// Engine que materializa lançamentos a partir de templates ativos. Roda no
// cron diário (06:30) gerando 60 dias à frente; idempotente — não duplica
// o que já existe.

import { db } from "../db";
import {
  templatesRecorrencia,
  lancamentosFinanceiros,
  type TemplateRecorrencia,
} from "@shared/schema";
import { addDays, addMonths, addWeeks, addYears, format, isAfter, isBefore, isEqual, parseISO } from "date-fns";
import { and, eq, isNull, lte, or, gte, sql } from "drizzle-orm";

const HORIZONTE_DIAS = 60;

function parseDateLocal(s: string): Date {
  // Mantém no fuso local (evita off-by-one por UTC)
  return new Date(`${s}T12:00:00`);
}

/**
 * Calcula as datas de vencimento que devem existir entre `inicio` e `fim`
 * (inclusive) para o template informado. Ajusta o "diaVencimento" quando
 * frequência mensal/anual.
 */
export function calcularDatasGeracao(
  template: Pick<TemplateRecorrencia, "frequencia" | "diaVencimento" | "dataInicio" | "dataFim" | "geradasAte">,
  agora: Date,
  horizonte: Date,
): string[] {
  const datas: string[] = [];
  const inicio = template.geradasAte
    ? addDays(parseDateLocal(template.geradasAte), 1)
    : parseDateLocal(template.dataInicio);
  const limite = template.dataFim
    ? (isBefore(parseDateLocal(template.dataFim), horizonte) ? parseDateLocal(template.dataFim) : horizonte)
    : horizonte;

  const dia = Math.max(1, Math.min(28, template.diaVencimento ?? 1));

  let cursor: Date;
  switch (template.frequencia) {
    case "mensal": {
      // Primeira ocorrência mensal a partir da data de início (ajustando o dia).
      const base = parseDateLocal(template.dataInicio);
      cursor = new Date(base.getFullYear(), base.getMonth(), dia, 12, 0, 0);
      // Se já passou daquele dia no mês de início, vai pro próximo mês
      if (isBefore(cursor, base)) cursor = addMonths(cursor, 1);
      while (isBefore(cursor, inicio) || isEqual(cursor, addDays(inicio, -1))) {
        cursor = addMonths(cursor, 1);
      }
      while (!isAfter(cursor, limite)) {
        if (!isBefore(cursor, agora) || !template.geradasAte) {
          // gera mesmo retroativos quando ainda não houve geração nenhuma
        }
        datas.push(format(cursor, "yyyy-MM-dd"));
        cursor = addMonths(cursor, 1);
      }
      break;
    }
    case "anual": {
      const base = parseDateLocal(template.dataInicio);
      cursor = new Date(base.getFullYear(), base.getMonth(), dia, 12, 0, 0);
      if (isBefore(cursor, base)) cursor = addYears(cursor, 1);
      while (isBefore(cursor, inicio)) cursor = addYears(cursor, 1);
      while (!isAfter(cursor, limite)) {
        datas.push(format(cursor, "yyyy-MM-dd"));
        cursor = addYears(cursor, 1);
      }
      break;
    }
    case "quinzenal": {
      cursor = parseDateLocal(template.dataInicio);
      while (isBefore(cursor, inicio)) cursor = addWeeks(cursor, 2);
      while (!isAfter(cursor, limite)) {
        datas.push(format(cursor, "yyyy-MM-dd"));
        cursor = addWeeks(cursor, 2);
      }
      break;
    }
    case "semanal": {
      cursor = parseDateLocal(template.dataInicio);
      while (isBefore(cursor, inicio)) cursor = addWeeks(cursor, 1);
      while (!isAfter(cursor, limite)) {
        datas.push(format(cursor, "yyyy-MM-dd"));
        cursor = addWeeks(cursor, 1);
      }
      break;
    }
    default:
      throw new Error(`Frequência desconhecida: ${template.frequencia}`);
  }

  return datas;
}

/**
 * Gera lançamentos para um template específico até o horizonte.
 * Idempotente: confere por (templateRecorrenciaId, dataVencimento) antes
 * de inserir.
 */
export async function processarTemplate(template: TemplateRecorrencia, agora: Date, horizonte: Date): Promise<number> {
  const datas = calcularDatasGeracao(template, agora, horizonte);
  if (datas.length === 0) return 0;

  // Busca quais já existem
  const existentes = await db
    .select({ data: lancamentosFinanceiros.dataVencimento })
    .from(lancamentosFinanceiros)
    .where(
      and(
        eq(lancamentosFinanceiros.tenantId, template.tenantId),
        eq(lancamentosFinanceiros.templateRecorrenciaId, template.id),
      ),
    );
  const setExistentes = new Set(existentes.map((e) => e.data as unknown as string));

  const aInserir = datas
    .filter((d) => !setExistentes.has(d))
    .map((d) => ({
      tenantId: template.tenantId,
      clienteId: template.clienteId,
      tipo: template.tipo,
      descricao: template.descricao,
      favorecido: template.favorecido ?? null,
      documento: null,
      valor: template.valorFixo ? String(template.valorFixo) : "0",
      dataVencimento: d,
      status: "previsto" as const,
      planoContaId: template.planoContaId ?? null,
      centroCustoId: template.centroCustoId ?? null,
      contaBancariaId: template.contaBancariaId ?? null,
      tipoDocumentoId: template.tipoDocumentoId ?? null,
      origem: "manual" as const,
      templateRecorrenciaId: template.id,
      origemRecorrencia: true,
      observacoes: template.observacoes ?? null,
    }));

  if (aInserir.length > 0) {
    await db.insert(lancamentosFinanceiros).values(aInserir as any);
  }

  // Avança geradasAte para o limite efetivo
  const ultimaData = datas[datas.length - 1];
  await db
    .update(templatesRecorrencia)
    .set({ geradasAte: ultimaData, updatedAt: new Date() })
    .where(eq(templatesRecorrencia.id, template.id));

  return aInserir.length;
}

/**
 * Roda todos os templates ativos. Chamado pelo cron diário (sem filtro,
 * processa todos os tenants) e exposto também em rota administrativa para
 * trigger manual — neste caso DEVE receber `tenantId` para evitar que um
 * tenant dispare processamento sobre dados de outros (defesa de isolamento).
 */
export async function processarRecorrencias(tenantId?: string): Promise<{ totalTemplates: number; totalGerados: number }> {
  const agora = new Date();
  const horizonte = addDays(agora, HORIZONTE_DIAS);

  const conds = [
    eq(templatesRecorrencia.ativa, true),
    lte(templatesRecorrencia.dataInicio, format(horizonte, "yyyy-MM-dd")),
    or(
      isNull(templatesRecorrencia.dataFim),
      gte(templatesRecorrencia.dataFim, format(agora, "yyyy-MM-dd")),
    ),
  ];
  if (tenantId) conds.push(eq(templatesRecorrencia.tenantId, tenantId));

  const templates = await db
    .select()
    .from(templatesRecorrencia)
    .where(and(...conds));

  let totalGerados = 0;
  for (const t of templates) {
    try {
      totalGerados += await processarTemplate(t, agora, horizonte);
    } catch (err) {
      console.error(`[recorrencia] erro no template ${t.id}:`, err);
    }
  }

  return { totalTemplates: templates.length, totalGerados };
}

let cronStarted = false;
export function startRecorrenciaCron(): void {
  if (cronStarted) return;
  cronStarted = true;
  // Importação dinâmica para alinhar com nfeMonitor.ts
  import("node-cron").then(({ default: cron }) => {
    // 06:30 todo dia — gera 60 dias à frente
    cron.schedule("30 6 * * *", async () => {
      try {
        const r = await processarRecorrencias();
        console.log(`[recorrencia] cron: ${r.totalTemplates} templates, ${r.totalGerados} lançamentos gerados`);
      } catch (e) {
        console.error("[recorrencia] cron erro:", e);
      }
    });
    console.log("[recorrencia] cron iniciado (06:30 diário, horizonte 60d)");
  }).catch((e) => console.error("[recorrencia] não foi possível iniciar cron:", e));
}
