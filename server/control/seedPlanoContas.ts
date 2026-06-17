import { db } from "../db";
import { planosContas } from "@shared/schema";
import { eq } from "drizzle-orm";

interface SeedItem {
  codigo: string;
  descricao: string;
  natureza: string;
  nivel: number;
  parentCodigo?: string;
  naturezaDre?: string;
  permiteLancamento: boolean;
}

const SEED: SeedItem[] = [
  { codigo: "1", descricao: "ATIVO", natureza: "ativo", nivel: 1, permiteLancamento: false },
  { codigo: "1.1", descricao: "Ativo Circulante", natureza: "ativo", nivel: 2, parentCodigo: "1", permiteLancamento: false },
  { codigo: "1.1.01", descricao: "Caixa e Equivalentes", natureza: "ativo", nivel: 3, parentCodigo: "1.1", naturezaDre: "fluxo", permiteLancamento: true },
  { codigo: "1.1.02", descricao: "Contas a Receber", natureza: "ativo", nivel: 3, parentCodigo: "1.1", naturezaDre: "NCG", permiteLancamento: true },
  { codigo: "1.1.03", descricao: "Estoques", natureza: "ativo", nivel: 3, parentCodigo: "1.1", naturezaDre: "NCG", permiteLancamento: true },
  { codigo: "1.1.04", descricao: "Outros Ativos Circulantes", natureza: "ativo", nivel: 3, parentCodigo: "1.1", permiteLancamento: true },
  { codigo: "1.2", descricao: "Ativo Não Circulante", natureza: "ativo", nivel: 2, parentCodigo: "1", permiteLancamento: false },
  { codigo: "1.2.01", descricao: "Imobilizado", natureza: "ativo", nivel: 3, parentCodigo: "1.2", permiteLancamento: true },
  { codigo: "1.2.02", descricao: "Intangível", natureza: "ativo", nivel: 3, parentCodigo: "1.2", permiteLancamento: true },
  { codigo: "2", descricao: "PASSIVO", natureza: "passivo", nivel: 1, permiteLancamento: false },
  { codigo: "2.1", descricao: "Passivo Circulante", natureza: "passivo", nivel: 2, parentCodigo: "2", permiteLancamento: false },
  { codigo: "2.1.01", descricao: "Fornecedores", natureza: "passivo", nivel: 3, parentCodigo: "2.1", naturezaDre: "NCG", permiteLancamento: true },
  { codigo: "2.1.02", descricao: "Obrigações Fiscais", natureza: "passivo", nivel: 3, parentCodigo: "2.1", naturezaDre: "NCG", permiteLancamento: true },
  { codigo: "2.1.03", descricao: "Obrigações Trabalhistas", natureza: "passivo", nivel: 3, parentCodigo: "2.1", naturezaDre: "NCG", permiteLancamento: true },
  { codigo: "2.1.04", descricao: "Empréstimos CP", natureza: "passivo", nivel: 3, parentCodigo: "2.1", naturezaDre: "tesouraria", permiteLancamento: true },
  { codigo: "2.1.05", descricao: "Outros Passivos Circulantes", natureza: "passivo", nivel: 3, parentCodigo: "2.1", permiteLancamento: true },
  { codigo: "2.2", descricao: "Passivo Não Circulante", natureza: "passivo", nivel: 2, parentCodigo: "2", permiteLancamento: false },
  { codigo: "2.2.01", descricao: "Empréstimos LP", natureza: "passivo", nivel: 3, parentCodigo: "2.2", permiteLancamento: true },
  { codigo: "2.3", descricao: "Patrimônio Líquido", natureza: "patrimonio_liquido", nivel: 2, parentCodigo: "2", permiteLancamento: true },
  { codigo: "3", descricao: "RECEITAS", natureza: "receita", nivel: 1, permiteLancamento: false },
  { codigo: "3.1", descricao: "Receita Bruta de Vendas/Serviços", natureza: "receita", nivel: 2, parentCodigo: "3", naturezaDre: "receita", permiteLancamento: true },
  { codigo: "3.2", descricao: "Deduções da Receita", natureza: "receita", nivel: 2, parentCodigo: "3", permiteLancamento: false },
  { codigo: "3.2.01", descricao: "Impostos sobre Receita", natureza: "receita", nivel: 3, parentCodigo: "3.2", permiteLancamento: true },
  { codigo: "3.2.02", descricao: "Devoluções e Abatimentos", natureza: "receita", nivel: 3, parentCodigo: "3.2", permiteLancamento: true },
  { codigo: "3.3", descricao: "Receita Líquida", natureza: "receita", nivel: 2, parentCodigo: "3", naturezaDre: "calculado", permiteLancamento: false },
  { codigo: "4", descricao: "CUSTOS", natureza: "custo", nivel: 1, permiteLancamento: false },
  { codigo: "4.1", descricao: "CMV / CPV / CSP", natureza: "custo", nivel: 2, parentCodigo: "4", naturezaDre: "margem", permiteLancamento: true },
  { codigo: "4.2", descricao: "Margem de Contribuição", natureza: "custo", nivel: 2, parentCodigo: "4", naturezaDre: "calculado", permiteLancamento: false },
  { codigo: "5", descricao: "DESPESAS OPERACIONAIS", natureza: "despesa", nivel: 1, permiteLancamento: false },
  { codigo: "5.1", descricao: "Despesas com Pessoal", natureza: "despesa", nivel: 2, parentCodigo: "5", naturezaDre: "EBITDA", permiteLancamento: true },
  { codigo: "5.2", descricao: "Despesas Administrativas", natureza: "despesa", nivel: 2, parentCodigo: "5", naturezaDre: "EBITDA", permiteLancamento: true },
  { codigo: "5.3", descricao: "Despesas Comerciais", natureza: "despesa", nivel: 2, parentCodigo: "5", naturezaDre: "EBITDA", permiteLancamento: true },
  { codigo: "5.4", descricao: "EBITDA", natureza: "despesa", nivel: 2, parentCodigo: "5", naturezaDre: "calculado", permiteLancamento: false },
  { codigo: "5.5", descricao: "Depreciação e Amortização", natureza: "despesa", nivel: 2, parentCodigo: "5", permiteLancamento: true },
  { codigo: "5.6", descricao: "EBIT", natureza: "despesa", nivel: 2, parentCodigo: "5", naturezaDre: "calculado", permiteLancamento: false },
  { codigo: "6", descricao: "RESULTADO FINANCEIRO", natureza: "resultado", nivel: 1, permiteLancamento: false },
  { codigo: "6.1", descricao: "Receitas Financeiras", natureza: "resultado", nivel: 2, parentCodigo: "6", permiteLancamento: true },
  { codigo: "6.2", descricao: "Despesas Financeiras", natureza: "resultado", nivel: 2, parentCodigo: "6", permiteLancamento: true },
  { codigo: "7", descricao: "RESULTADO", natureza: "resultado", nivel: 1, permiteLancamento: false },
  { codigo: "7.1", descricao: "EBT (Resultado Antes IR)", natureza: "resultado", nivel: 2, parentCodigo: "7", naturezaDre: "calculado", permiteLancamento: false },
  { codigo: "7.2", descricao: "IR e CSLL", natureza: "resultado", nivel: 2, parentCodigo: "7", permiteLancamento: true },
  { codigo: "7.3", descricao: "Lucro/Prejuízo Líquido", natureza: "resultado", nivel: 2, parentCodigo: "7", naturezaDre: "calculado", permiteLancamento: false },
];

const SEED_CODIGOS = new Set(SEED.map((s) => s.codigo));

/**
 * Garante que o tenant tenha o plano de contas padrão.
 * Idempotente e safe contra concorrência:
 *  - Compara por SET de códigos (não por count)
 *  - Usa UNIQUE (tenant_id, codigo) + onConflictDoNothing
 */
export async function seedPlanoContasIfNeeded(tenantId: string): Promise<{ created: number; total: number; alreadySeeded: boolean }> {
  const existing = await db
    .select({ codigo: planosContas.codigo, id: planosContas.id })
    .from(planosContas)
    .where(eq(planosContas.tenantId, tenantId));
  const existingByCodigo = new Map(existing.map((r) => [r.codigo, r.id]));

  const allPresent = [...SEED_CODIGOS].every((c) => existingByCodigo.has(c));
  if (allPresent) {
    return { created: 0, total: existing.length, alreadySeeded: true };
  }

  const codeToId = new Map<string, string>(existingByCodigo);
  let created = 0;
  for (const nivel of [1, 2, 3]) {
    const batch = SEED.filter((s) => s.nivel === nivel && !codeToId.has(s.codigo));
    if (!batch.length) continue;
    const rows = batch.map((s) => ({
      tenantId,
      codigo: s.codigo,
      descricao: s.descricao,
      natureza: s.natureza,
      nivel: s.nivel,
      parentId: s.parentCodigo ? codeToId.get(s.parentCodigo) ?? null : null,
      naturezaDre: s.naturezaDre ?? null,
      permiteLancamento: s.permiteLancamento,
      ativo: true,
    }));
    const inserted = await db
      .insert(planosContas)
      .values(rows)
      .onConflictDoNothing({ target: [planosContas.tenantId, planosContas.codigo] })
      .returning({ id: planosContas.id, codigo: planosContas.codigo });
    for (const r of inserted) codeToId.set(r.codigo, r.id);
    created += inserted.length;

    // Re-fetch para preencher códigos que outro processo inseriu em paralelo
    const missing = batch.map((b) => b.codigo).filter((c) => !codeToId.has(c));
    if (missing.length) {
      const refetch = await db
        .select({ id: planosContas.id, codigo: planosContas.codigo })
        .from(planosContas)
        .where(eq(planosContas.tenantId, tenantId));
      for (const r of refetch) codeToId.set(r.codigo, r.id);
    }
  }
  return { created, total: codeToId.size, alreadySeeded: false };
}
