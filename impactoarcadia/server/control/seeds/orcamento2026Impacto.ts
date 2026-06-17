/**
 * server/control/seeds/orcamento2026Impacto.ts
 *
 * Seed do orçamento 2026 da Impacto Geologia.
 * Valores extraídos das abas MetaDespesas e MetaReceitas
 * da planilha Controle_financeiro_Impacto_2026.xlsm.
 * Idempotente — ON CONFLICT DO UPDATE.
 */
import { pool } from "../../../db/index";

// Formato: [codigoPlano, Jan, Fev, Mar, Abr, Mai, Jun, Jul, Ago, Set, Out, Nov, Dez]
const ORCAMENTO_DESPESAS_2026: [string, ...number[]][] = [
  // 2.3 — Despesas Instalações e Serviços
  ["DSP.2.3.2", 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000],
  ["DSP.2.3.3", 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200],
  ["DSP.2.3.4",  800,  800,  800,  800,  800,  800,  800,  800,  800,  800,  800,  800],
  ["DSP.2.3.7", 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500],
  ["DSP.2.3.8", 3200, 3200, 3200, 3200, 3200, 3200, 3200, 3200, 3200, 3200, 3200, 3200],
  // 2.5 — Despesas com Pessoal
  ["DSP.2.5.1", 45000, 45000, 45000, 45000, 45000, 45000, 45000, 45000, 45000, 45000, 45000, 45000],
  ["DSP.2.5.4",  3600,  3600,  3600,  3600,  3600,  3600,  3600,  3600,  3600,  3600,  3600,  3600],
  ["DSP.2.5.5",  4950,  4950,  4950,  4950,  4950,  4950,  4950,  4950,  4950,  4950,  4950,  4950],
  ["DSP.2.5.6",  3000,  3000,  3000,  3000,  3000,  3000,  3000,  3000,  3000,  3000,  3000,  3000],
  // 2.6 — Deduções
  ["DSP.2.6.1",  8000,  8500,  9000,  8000,  9500, 10000,  8500,  9000,  9500, 10000,  9000,  8000],
  // 2.11 — Financeiras
  ["DSP.2.11.2",  400,   400,   400,   400,   400,   400,   400,   400,   400,   400,   400,   400],
  // 2.1 — Custos Projetos e Campo
  ["DSP.2.1.5", 15000, 18000, 20000, 16000, 22000, 25000, 18000, 20000, 22000, 25000, 20000, 15000],
  ["DSP.2.1.7",  2000,  2500,  3000,  2000,  3500,  4000,  2500,  3000,  3500,  4000,  3000,  2000],
];

export async function seedOrcamento2026(
  clienteId: string,
  tenantId: string,
): Promise<{ upserted: number; skipped: number }> {
  let upserted = 0;
  let skipped = 0;

  for (const [codigoPlano, ...mesesVals] of ORCAMENTO_DESPESAS_2026) {
    const ccRes = await pool.query(
      "SELECT id FROM planos_contas WHERE tenant_id = $1 AND codigo = $2 LIMIT 1",
      [tenantId, codigoPlano],
    );
    if (ccRes.rows.length === 0) { skipped++; continue; }
    const planoContaId = ccRes.rows[0].id;

    for (let mes = 1; mes <= 12; mes++) {
      const valor = mesesVals[mes - 1];
      if (!valor || valor === 0) continue;
      await pool.query(
        `INSERT INTO orcamentos_mensais
           (id, tenant_id, cliente_id, plano_conta_id, ano, mes, valor_previsto)
         VALUES (gen_random_uuid(), $1, $2, $3, 2026, $4, $5)
         ON CONFLICT (tenant_id, cliente_id, ano, mes, plano_conta_id)
         DO UPDATE SET valor_previsto = EXCLUDED.valor_previsto`,
        [tenantId, clienteId, planoContaId, mes, String(valor)],
      );
      upserted++;
    }
  }

  return { upserted, skipped };
}
