/**
 * server/control/seeds/planoContasImpacto.ts
 *
 * Seed do plano de contas operacional da Impacto Geologia.
 * Grupos 1.x (Receitas) e 2.x (Custos/Despesas) da planilha 2026.
 * Adicionados sobre o plano contábil padrão — idempotente.
 *
 * Uso: POST /api/control/clientes/:id/plano-contas/seed-engineering
 */
import { db } from "../../db";
import { planosContas } from "@shared/schema";
import { eq } from "drizzle-orm";

interface SeedItem {
  codigo: string;
  descricao: string;
  natureza: "receita" | "custo" | "despesa";
  nivel: number;
  parentCodigo?: string;
  naturezaDre?: string;
  permiteLancamento: boolean;
}

// ─── RECEITAS (grupos 1.x) ────────────────────────────────────────────────────
const RECEITAS: SeedItem[] = [
  { codigo: "REC.1.1", descricao: "Receita com Produtos",          natureza: "receita", nivel: 2, naturezaDre: "receita", permiteLancamento: false },
  { codigo: "REC.1.2", descricao: "Receita com Serviços",          natureza: "receita", nivel: 2, naturezaDre: "receita", permiteLancamento: false },
  { codigo: "REC.1.3", descricao: "Outras Receitas",               natureza: "receita", nivel: 2, naturezaDre: "receita", permiteLancamento: false },
  { codigo: "REC.1.4", descricao: "Operações Financeiras",         natureza: "receita", nivel: 2, naturezaDre: "receita", permiteLancamento: false },
  { codigo: "REC.1.5", descricao: "Receita com Locações",          natureza: "receita", nivel: 2, naturezaDre: "receita", permiteLancamento: false },
  { codigo: "REC.1.6", descricao: "Receitas Financeiras",          natureza: "receita", nivel: 2, naturezaDre: "receita", permiteLancamento: false },

  // 1.2 — Receita com Serviços
  { codigo: "REC.1.2.1",  descricao: "Diagnóstico",                natureza: "receita", nivel: 3, parentCodigo: "REC.1.2", permiteLancamento: true },
  { codigo: "REC.1.2.2",  descricao: "Licenciamento",              natureza: "receita", nivel: 3, parentCodigo: "REC.1.2", permiteLancamento: true },
  { codigo: "REC.1.2.3",  descricao: "Monitoramento",              natureza: "receita", nivel: 3, parentCodigo: "REC.1.2", permiteLancamento: true },
  { codigo: "REC.1.2.4",  descricao: "Remediação",                 natureza: "receita", nivel: 3, parentCodigo: "REC.1.2", permiteLancamento: true },
  { codigo: "REC.1.2.5",  descricao: "Remoção de Solo",            natureza: "receita", nivel: 3, parentCodigo: "REC.1.2", permiteLancamento: true },
  { codigo: "REC.1.2.6",  descricao: "Remoção de Tanque",          natureza: "receita", nivel: 3, parentCodigo: "REC.1.2", permiteLancamento: true },
  { codigo: "REC.1.2.7",  descricao: "SAFF",                       natureza: "receita", nivel: 3, parentCodigo: "REC.1.2", permiteLancamento: true },
  { codigo: "REC.1.2.8",  descricao: "Serviços Esporádicos",       natureza: "receita", nivel: 3, parentCodigo: "REC.1.2", permiteLancamento: true },
  { codigo: "REC.1.2.9",  descricao: "Previsão Vibra",             natureza: "receita", nivel: 3, parentCodigo: "REC.1.2", permiteLancamento: true },
  { codigo: "REC.1.2.10", descricao: "Previsão Faturamento",       natureza: "receita", nivel: 3, parentCodigo: "REC.1.2", permiteLancamento: true },

  // 1.3 — Outras Receitas
  { codigo: "REC.1.3.1",  descricao: "Devolução",                  natureza: "receita", nivel: 3, parentCodigo: "REC.1.3", permiteLancamento: true },
  { codigo: "REC.1.3.2",  descricao: "Devolução Consórcio",        natureza: "receita", nivel: 3, parentCodigo: "REC.1.3", permiteLancamento: true },
  { codigo: "REC.1.3.3",  descricao: "Outras Receitas Diretoria",  natureza: "receita", nivel: 3, parentCodigo: "REC.1.3", permiteLancamento: true },
  { codigo: "REC.1.3.4",  descricao: "Outros Recebimentos",        natureza: "receita", nivel: 3, parentCodigo: "REC.1.3", permiteLancamento: true },
  { codigo: "REC.1.3.5",  descricao: "Reembolso Terceiros",        natureza: "receita", nivel: 3, parentCodigo: "REC.1.3", permiteLancamento: true },
  { codigo: "REC.1.3.6",  descricao: "Venda de Materiais",         natureza: "receita", nivel: 3, parentCodigo: "REC.1.3", permiteLancamento: true },
  { codigo: "REC.1.3.7",  descricao: "Venda de Bens de Ativo",     natureza: "receita", nivel: 3, parentCodigo: "REC.1.3", permiteLancamento: true },

  // 1.4 — Operações Financeiras
  { codigo: "REC.1.4.1",  descricao: "BB Giro",                    natureza: "receita", nivel: 3, parentCodigo: "REC.1.4", permiteLancamento: true },
  { codigo: "REC.1.4.2",  descricao: "Empréstimos",                natureza: "receita", nivel: 3, parentCodigo: "REC.1.4", permiteLancamento: true },
  { codigo: "REC.1.4.3",  descricao: "Empréstimo BNDES Itaú",      natureza: "receita", nivel: 3, parentCodigo: "REC.1.4", permiteLancamento: true },
  { codigo: "REC.1.4.4",  descricao: "Estorno Compra Cartão",      natureza: "receita", nivel: 3, parentCodigo: "REC.1.4", permiteLancamento: true },
  { codigo: "REC.1.4.5",  descricao: "Estorno Tarifa",             natureza: "receita", nivel: 3, parentCodigo: "REC.1.4", permiteLancamento: true },

  // 1.5 — Locações
  { codigo: "REC.1.5.1",  descricao: "Locação Sistema de Remediação", natureza: "receita", nivel: 3, parentCodigo: "REC.1.5", permiteLancamento: true },
  { codigo: "REC.1.5.2",  descricao: "Locação de Equipamentos",    natureza: "receita", nivel: 3, parentCodigo: "REC.1.5", permiteLancamento: true },

  // 1.6 — Receitas Financeiras
  { codigo: "REC.1.6.1",  descricao: "BB Giro",                    natureza: "receita", nivel: 3, parentCodigo: "REC.1.6", permiteLancamento: true },
  { codigo: "REC.1.6.2",  descricao: "Juros de Aplicações",        natureza: "receita", nivel: 3, parentCodigo: "REC.1.6", permiteLancamento: true },
  { codigo: "REC.1.6.3",  descricao: "Juros Clientes",             natureza: "receita", nivel: 3, parentCodigo: "REC.1.6", permiteLancamento: true },
  { codigo: "REC.1.6.4",  descricao: "Rendimentos Aplicação",      natureza: "receita", nivel: 3, parentCodigo: "REC.1.6", permiteLancamento: true },
];

// ─── CUSTOS E DESPESAS (grupos 2.x) ──────────────────────────────────────────
const DESPESAS: SeedItem[] = [
  // Grupos (nível 2)
  { codigo: "DSP.2.1",  descricao: "Custos Projeto e Campo",             natureza: "custo",    nivel: 2, naturezaDre: "margem",   permiteLancamento: false },
  { codigo: "DSP.2.3",  descricao: "Despesas Instalações e Serviços",    natureza: "despesa",  nivel: 2, naturezaDre: "EBITDA",   permiteLancamento: false },
  { codigo: "DSP.2.4",  descricao: "Despesas com Veículos",              natureza: "despesa",  nivel: 2, naturezaDre: "EBITDA",   permiteLancamento: false },
  { codigo: "DSP.2.5",  descricao: "Despesas com Pessoal",               natureza: "despesa",  nivel: 2, naturezaDre: "EBITDA",   permiteLancamento: false },
  { codigo: "DSP.2.6",  descricao: "Deduções sobre Vendas",              natureza: "despesa",  nivel: 2, naturezaDre: "receita",  permiteLancamento: false },
  { codigo: "DSP.2.7",  descricao: "Impostos Diretos",                   natureza: "despesa",  nivel: 2, naturezaDre: "EBITDA",   permiteLancamento: false },
  { codigo: "DSP.2.8",  descricao: "Despesas Laboratório Impacto",       natureza: "custo",    nivel: 2, naturezaDre: "margem",   permiteLancamento: false },
  { codigo: "DSP.2.9",  descricao: "Despesas Manutenção Máquinas",       natureza: "despesa",  nivel: 2, naturezaDre: "EBITDA",   permiteLancamento: false },
  { codigo: "DSP.2.10", descricao: "Despesas Manutenção Equipamentos",   natureza: "despesa",  nivel: 2, naturezaDre: "EBITDA",   permiteLancamento: false },
  { codigo: "DSP.2.11", descricao: "Despesas Financeiras",               natureza: "despesa",  nivel: 2, naturezaDre: "resultado",permiteLancamento: false },
  { codigo: "DSP.2.12", descricao: "Bens Ativo Imobilizado",             natureza: "despesa",  nivel: 2, naturezaDre: "EBITDA",   permiteLancamento: false },

  // 2.1 — Projetos e Campo
  { codigo: "DSP.2.1.1",  descricao: "Análises Ambientais Água/Solo", natureza: "custo", nivel: 3, parentCodigo: "DSP.2.1", permiteLancamento: true },
  { codigo: "DSP.2.1.2",  descricao: "ART",                           natureza: "custo", nivel: 3, parentCodigo: "DSP.2.1", permiteLancamento: true },
  { codigo: "DSP.2.1.3",  descricao: "Aluguel de Equipamentos",       natureza: "custo", nivel: 3, parentCodigo: "DSP.2.1", permiteLancamento: true },
  { codigo: "DSP.2.1.4",  descricao: "Licenciamento Ambiental",       natureza: "custo", nivel: 3, parentCodigo: "DSP.2.1", permiteLancamento: true },
  { codigo: "DSP.2.1.5",  descricao: "Subcontratados",                natureza: "custo", nivel: 3, parentCodigo: "DSP.2.1", permiteLancamento: true },
  { codigo: "DSP.2.1.6",  descricao: "Fretes e Transportes",          natureza: "custo", nivel: 3, parentCodigo: "DSP.2.1", permiteLancamento: true },
  { codigo: "DSP.2.1.7",  descricao: "Hospedagem e Diárias",          natureza: "custo", nivel: 3, parentCodigo: "DSP.2.1", permiteLancamento: true },
  { codigo: "DSP.2.1.8",  descricao: "Adiantamento Campo",            natureza: "custo", nivel: 3, parentCodigo: "DSP.2.1", permiteLancamento: true },
  { codigo: "DSP.2.1.9",  descricao: "Material de Campo",             natureza: "custo", nivel: 3, parentCodigo: "DSP.2.1", permiteLancamento: true },
  { codigo: "DSP.2.1.10", descricao: "Outras Despesas de Campo",      natureza: "custo", nivel: 3, parentCodigo: "DSP.2.1", permiteLancamento: true },

  // 2.3 — Instalações
  { codigo: "DSP.2.3.1",  descricao: "Água / Esgoto",             natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.3", permiteLancamento: true },
  { codigo: "DSP.2.3.2",  descricao: "Aluguel",                   natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.3", permiteLancamento: true },
  { codigo: "DSP.2.3.3",  descricao: "Energia Elétrica",          natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.3", permiteLancamento: true },
  { codigo: "DSP.2.3.4",  descricao: "Internet e Telefonia",      natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.3", permiteLancamento: true },
  { codigo: "DSP.2.3.5",  descricao: "Limpeza e Conservação",     natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.3", permiteLancamento: true },
  { codigo: "DSP.2.3.6",  descricao: "Manutenção Predial",        natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.3", permiteLancamento: true },
  { codigo: "DSP.2.3.7",  descricao: "Licenças e Softwares",      natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.3", permiteLancamento: true },
  { codigo: "DSP.2.3.8",  descricao: "Honorários Contábeis",      natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.3", permiteLancamento: true },
  { codigo: "DSP.2.3.9",  descricao: "Material de Escritório",    natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.3", permiteLancamento: true },
  { codigo: "DSP.2.3.10", descricao: "Seguros",                   natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.3", permiteLancamento: true },
  { codigo: "DSP.2.3.11", descricao: "Outras Instalações",        natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.3", permiteLancamento: true },

  // 2.5 — Pessoal
  { codigo: "DSP.2.5.1",  descricao: "Salários e Ordenados",      natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.5", permiteLancamento: true },
  { codigo: "DSP.2.5.2",  descricao: "13° Salário",               natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.5", permiteLancamento: true },
  { codigo: "DSP.2.5.3",  descricao: "Férias",                    natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.5", permiteLancamento: true },
  { codigo: "DSP.2.5.4",  descricao: "FGTS",                      natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.5", permiteLancamento: true },
  { codigo: "DSP.2.5.5",  descricao: "INSS Patronal",             natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.5", permiteLancamento: true },
  { codigo: "DSP.2.5.6",  descricao: "Vale Refeição",             natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.5", permiteLancamento: true },
  { codigo: "DSP.2.5.7",  descricao: "Vale Transporte",           natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.5", permiteLancamento: true },
  { codigo: "DSP.2.5.8",  descricao: "Assistência Médica",        natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.5", permiteLancamento: true },
  { codigo: "DSP.2.5.9",  descricao: "Pró-labore Diretoria",      natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.5", permiteLancamento: true },
  { codigo: "DSP.2.5.10", descricao: "Adiantamentos",             natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.5", permiteLancamento: true },
  { codigo: "DSP.2.5.11", descricao: "Distribuição de Lucros",    natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.5", permiteLancamento: true },

  // 2.6 — Deduções
  { codigo: "DSP.2.6.1",  descricao: "Simples Nacional",          natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.6", permiteLancamento: true },
  { codigo: "DSP.2.6.2",  descricao: "ISS",                       natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.6", permiteLancamento: true },
  { codigo: "DSP.2.6.3",  descricao: "COFINS",                    natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.6", permiteLancamento: true },
  { codigo: "DSP.2.6.4",  descricao: "PIS",                       natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.6", permiteLancamento: true },
  { codigo: "DSP.2.6.5",  descricao: "Devoluções",                natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.6", permiteLancamento: true },

  // 2.7 — Impostos
  { codigo: "DSP.2.7.1",  descricao: "CSLL",                      natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.7", permiteLancamento: true },
  { codigo: "DSP.2.7.2",  descricao: "IRPJ",                      natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.7", permiteLancamento: true },

  // 2.11 — Financeiras
  { codigo: "DSP.2.11.1", descricao: "Juros Bancários",           natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.11", permiteLancamento: true },
  { codigo: "DSP.2.11.2", descricao: "Tarifas Bancárias",         natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.11", permiteLancamento: true },
  { codigo: "DSP.2.11.3", descricao: "IOF",                       natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.11", permiteLancamento: true },
  { codigo: "DSP.2.11.4", descricao: "Juros Cartão de Crédito",   natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.11", permiteLancamento: true },
  { codigo: "DSP.2.11.5", descricao: "Juros Empréstimos",         natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.11", permiteLancamento: true },
  { codigo: "DSP.2.11.6", descricao: "Encargos Financeiros",      natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.11", permiteLancamento: true },
  { codigo: "DSP.2.11.7", descricao: "Empréstimo BNDES Itaú",     natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.11", permiteLancamento: true },
  { codigo: "DSP.2.11.8", descricao: "Empréstimo BNDES Seguro",   natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.11", permiteLancamento: true },
  { codigo: "DSP.2.11.9", descricao: "Empréstimo Pronampe BB",    natureza: "despesa", nivel: 3, parentCodigo: "DSP.2.11", permiteLancamento: true },
];

const SEED_ENGINEERING = [...RECEITAS, ...DESPESAS];

export async function seedPlanoContasImpacto(tenantId: string): Promise<{
  created: number; skipped: number; total: number;
}> {
  const allExisting = await db.select({ codigo: planosContas.codigo, id: planosContas.id })
    .from(planosContas).where(eq(planosContas.tenantId, tenantId));

  const existingSet = new Set(allExisting.map(r => r.codigo));
  const codeToId = new Map<string, string>(allExisting.map(r => [r.codigo, r.id]));

  let created = 0;
  let skipped = 0;

  for (const nivel of [2, 3]) {
    const batch = SEED_ENGINEERING.filter(s => s.nivel === nivel);
    for (const item of batch) {
      if (existingSet.has(item.codigo)) { skipped++; continue; }

      const inserted = await db.insert(planosContas).values([{
        tenantId,
        codigo: item.codigo,
        descricao: item.descricao,
        natureza: item.natureza,
        nivel: item.nivel,
        parentId: item.parentCodigo ? codeToId.get(item.parentCodigo) ?? null : null,
        naturezaDre: item.naturezaDre ?? null,
        permiteLancamento: item.permiteLancamento,
        ativo: true,
      }])
        .onConflictDoNothing()
        .returning({ id: planosContas.id, codigo: planosContas.codigo });

      if (inserted.length > 0) {
        codeToId.set(item.codigo, inserted[0].id);
        existingSet.add(item.codigo);
        created++;
      }
    }
  }

  return { created, skipped, total: SEED_ENGINEERING.length };
}
