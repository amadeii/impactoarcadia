import { db } from "../db";
import {
  lancamentosFinanceiros,
  planosContas,
  type InsertLancamentoFinanceiro,
} from "@shared/schema";
import { and, eq } from "drizzle-orm";

/**
 * Import Wizard — recebe arquivo (XLSX/CSV/XML) já parseado em JSON pelo
 * frontend (papaparse / sheetjs no client) e:
 *   1. Detecta colunas via heurística + IA
 *   2. Mapeia para InsertLancamentoFinanceiro
 *   3. Categoriza cada linha sugerindo planoContaId
 *   4. Persiste em batch
 *
 * O parsing fica no front (lib leve no browser) — isso evita instalar
 * exceljs/xlsx no servidor e mantém o backend stateless.
 */

// Heurísticas de detecção de coluna por sinônimos
const SINONIMOS: Record<string, string[]> = {
  data: ["data", "data_vencimento", "vencimento", "dt_venc", "due_date"],
  valor: ["valor", "vl", "amount", "total", "preco"],
  descricao: ["descricao", "descrição", "historico", "histórico", "memo", "description"],
  favorecido: ["favorecido", "fornecedor", "cliente", "razao_social", "nome", "payee"],
  documento: ["documento", "doc", "nf", "nota", "invoice"],
  tipo: ["tipo", "natureza", "operacao", "type"],
};

export interface DetectedMapping {
  field: string;
  sourceColumn: string;
  confidence: number;
}

export function detectarMapeamento(headers: string[]): DetectedMapping[] {
  const result: DetectedMapping[] = [];
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
  for (const [field, keys] of Object.entries(SINONIMOS)) {
    let bestCol: string | null = null;
    let bestScore = 0;
    for (const h of headers) {
      const hn = norm(h);
      for (const k of keys) {
        if (hn === k) {
          if (1 > bestScore) { bestScore = 1; bestCol = h; }
        } else if (hn.includes(k)) {
          if (0.7 > bestScore) { bestScore = 0.7; bestCol = h; }
        }
      }
    }
    if (bestCol) result.push({ field, sourceColumn: bestCol, confidence: bestScore });
  }
  return result;
}

export interface ImportRow {
  [key: string]: any;
}

export interface ImportPreview {
  total: number;
  amostra: Array<Partial<InsertLancamentoFinanceiro> & { _erro?: string }>;
  mapeamento: DetectedMapping[];
}

function parseValor(v: any): number {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  // Aceita "1.234,56", "1234.56", "1234,56", "R$ 1.000,00"
  const s = String(v).replace(/[^\d,.\-]/g, "");
  const sNum = s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(/,/g, "");
  const n = Number(sNum);
  return isNaN(n) ? NaN : n;
}

function parseData(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  // dd/mm/yyyy
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    const [_, d, mo, y] = m1;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export function aplicarMapeamento(
  rows: ImportRow[],
  mapping: DetectedMapping[],
  defaults: { tenantId: string; clienteId: string },
): Array<Partial<InsertLancamentoFinanceiro> & { _erro?: string }> {
  const map = new Map(mapping.map((m) => [m.field, m.sourceColumn]));
  return rows.map((r) => {
    const out: Partial<InsertLancamentoFinanceiro> & { _erro?: string } = {
      tenantId: defaults.tenantId,
      clienteId: defaults.clienteId,
      origem: "importacao",
      status: "previsto",
    };
    if (map.has("data")) {
      const d = parseData(r[map.get("data")!]);
      if (d) out.dataVencimento = d;
    }
    if (map.has("valor")) {
      const v = parseValor(r[map.get("valor")!]);
      if (!isNaN(v)) out.valor = String(Math.abs(v));
    }
    if (map.has("descricao")) out.descricao = String(r[map.get("descricao")!] ?? "").slice(0, 500);
    if (map.has("favorecido")) out.favorecido = String(r[map.get("favorecido")!] ?? "").slice(0, 300);
    if (map.has("documento")) out.documento = String(r[map.get("documento")!] ?? "").slice(0, 80);
    if (map.has("tipo")) {
      const t = String(r[map.get("tipo")!] ?? "").toLowerCase();
      out.tipo = t.includes("rec") ? "receber" : "pagar";
    } else if (out.valor) {
      // Se não há coluna tipo, infere por sinal do valor original
      const orig = map.has("valor") ? parseValor(r[map.get("valor")!]) : NaN;
      out.tipo = orig < 0 ? "pagar" : "receber";
    }
    if (!out.descricao || !out.valor || !out.dataVencimento || !out.tipo) {
      out._erro = "Linha incompleta — descrição, valor, vencimento e tipo são obrigatórios";
    }
    return out;
  });
}

export async function categorizar(
  tenantId: string,
  rows: Array<Partial<InsertLancamentoFinanceiro>>,
): Promise<Array<Partial<InsertLancamentoFinanceiro>>> {
  // Heurística simples: casa pelo plano de contas usando palavras-chave da
  // descrição/favorecido. Em produção, plugar Anthropic para casos complexos.
  const contas = await db.select({
    id: planosContas.id,
    codigo: planosContas.codigo,
    descricao: planosContas.descricao,
    natureza: planosContas.natureza,
  })
    .from(planosContas)
    .where(and(eq(planosContas.tenantId, tenantId), eq(planosContas.ativo, true)));

  function escolherConta(linha: Partial<InsertLancamentoFinanceiro>): string | null {
    const txt = `${linha.descricao ?? ""} ${linha.favorecido ?? ""}`.toLowerCase();
    if (!txt.trim()) return null;
    const naturezaAlvo = linha.tipo === "receber" ? "receita" : "despesa";
    const candidatas = contas.filter((c) => c.natureza === naturezaAlvo);
    let melhor: { id: string; score: number } | null = null;
    for (const c of candidatas) {
      const desc = c.descricao.toLowerCase();
      const palavras = desc.split(/\s+/).filter((p) => p.length > 3);
      let score = 0;
      for (const p of palavras) {
        if (txt.includes(p)) score += 1;
      }
      if (score > 0 && (!melhor || score > melhor.score)) melhor = { id: c.id, score };
    }
    return melhor?.id ?? null;
  }

  return rows.map((r) => ({ ...r, planoContaId: escolherConta(r) ?? r.planoContaId }));
}

export async function executarImportacao(
  rows: Array<Partial<InsertLancamentoFinanceiro> & { _erro?: string }>,
): Promise<{ importados: number; ignorados: number; erros: string[] }> {
  const validas = rows.filter((r) => !r._erro && r.descricao && r.valor && r.dataVencimento && r.tipo && r.tenantId && r.clienteId);
  const ignoradas = rows.length - validas.length;
  const erros = rows.filter((r) => r._erro).map((r) => r._erro!).slice(0, 20);

  if (validas.length === 0) return { importados: 0, ignorados: ignoradas, erros };

  const insertRows = validas.map((r) => ({
    tenantId: r.tenantId!,
    clienteId: r.clienteId!,
    tipo: r.tipo!,
    descricao: r.descricao!,
    favorecido: r.favorecido ?? null,
    documento: r.documento ?? null,
    valor: r.valor!,
    dataVencimento: r.dataVencimento!,
    dataEmissao: r.dataEmissao ?? null,
    status: "previsto",
    origem: "importacao",
    criadoPorIa: false,
    planoContaId: r.planoContaId ?? null,
    centroCustoId: r.centroCustoId ?? null,
    contaBancariaId: r.contaBancariaId ?? null,
    grupoId: r.grupoId ?? null,
  })) as InsertLancamentoFinanceiro[];

  await db.insert(lancamentosFinanceiros).values(insertRows);
  return { importados: insertRows.length, ignorados: ignoradas, erros };
}
