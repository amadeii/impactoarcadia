// Sprint C11 — Alerta proativo de desvio de orçamento via Maestro IA.
// Roda diário (cron 07:30). Para cada cliente com lançamentos no mês,
// compara realizado vs previsto (orcamentos_mensais) e — se houver
// desvios > threshold — registra log e tenta gerar narrativa via
// runWithOrchestration (silenciosamente ignora se LLM indisponível).

import { db } from "../db";
import { sql } from "drizzle-orm";
import { runWithOrchestration } from "../mcp/llmOrchestrator";
import { getDreComAv } from "./dreService";

const THRESHOLD_PERC = 15;

export async function verificarDesviosOrcamento(): Promise<{
  clientesAvaliados: number;
  alertasGerados: number;
}> {
  const ano = new Date().getFullYear();
  const mes = new Date().getMonth() + 1;

  const r = await db.execute<{ tenant_id: string; cliente_id: string }>(sql`
    SELECT DISTINCT tenant_id, cliente_id
    FROM lancamentos_financeiros
    WHERE data_pagamento IS NOT NULL
      AND EXTRACT(YEAR FROM data_pagamento) = ${ano}
      AND EXTRACT(MONTH FROM data_pagamento) = ${mes}
  `);

  let alertas = 0;
  for (const row of r.rows) {
    try {
      const dre = await getDreComAv(row.tenant_id, row.cliente_id, ano, mes, THRESHOLD_PERC);
      const desvios = dre.linhas.filter((l) => l.alerta && l.previsto > 0);
      if (desvios.length === 0) continue;

      alertas++;
      const top = desvios.slice(0, 5).map((d) =>
        `• ${d.grupoDre}: real ${d.realizado.toFixed(0)} vs prev ${d.previsto.toFixed(0)} (${d.desvioPerc?.toFixed(1)}%)`,
      ).join("\n");

      // Tenta narrativa via Maestro IA — silencia falhas para não quebrar cron.
      try {
        await runWithOrchestration(
          "alerta_desvio_orcamento",
          row.tenant_id,
          { sensitivity: "internal" },
          async () => ({ ok: true, content: `Desvios detectados em ${desvios.length} grupos:\n${top}`, tokensIn: 0, tokensOut: 0 }),
        );
      } catch (_) { /* ignore */ }

      console.log(`[alertas] cliente=${row.cliente_id} desvios=${desvios.length}`);
    } catch (e: any) {
      console.warn(`[alertas] erro cliente ${row.cliente_id}:`, e?.message);
    }
  }
  return { clientesAvaliados: r.rows.length, alertasGerados: alertas };
}

let cronStarted = false;
export function startAlertasCron(): void {
  if (cronStarted) return;
  cronStarted = true;
  import("node-cron").then(({ default: cron }) => {
    cron.schedule("30 7 * * *", async () => {
      try {
        const r = await verificarDesviosOrcamento();
        console.log(`[alertas] cron: ${r.clientesAvaliados} clientes, ${r.alertasGerados} alertas`);
      } catch (e) {
        console.error("[alertas] cron erro:", e);
      }
    });
    console.log("[alertas] cron iniciado (07:30 diário, threshold 15%)");
  }).catch((e) => console.error("[alertas] não foi possível iniciar cron:", e));
}
