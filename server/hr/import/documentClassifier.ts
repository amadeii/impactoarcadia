// Sprint RH-3 — classificação heurística de documentos do Domínio.
// Não consome LLM: avalia palavras-chave do texto extraído.

export type DominioDocType = "extrato_mensal" | "recibo" | "ponto" | "unknown";

export function classifyDocument(text: string): DominioDocType {
  const t = text.toUpperCase();
  if (t.includes("EXTRATO MENSAL") && (t.includes("LÍQUIDO GERAL") || t.includes("LIQUIDO GERAL"))) {
    return "extrato_mensal";
  }
  if (t.includes("FOLHA DE PONTO") && (t.includes("QUADRO DE HORÁRIOS") || t.includes("QUADRO DE HORARIOS"))) {
    return "ponto";
  }
  if (t.includes("FOLHA MENSAL") && (t.includes("VALOR LÍQUIDO") || t.includes("VALOR LIQUIDO"))) {
    return "recibo";
  }
  return "unknown";
}

// Extrai CNPJ do extrato (padrão BR XX.XXX.XXX/XXXX-XX).
// Usado para validar empresa selecionada vs. PDF.
export function extractCnpj(text: string): string | null {
  const m = text.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
  return m ? m[1] : null;
}

// Extrai competência no padrão MM/AAAA.
export function extractCompetence(text: string): string | null {
  const m = text.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/);
  return m ? `${m[1]}/${m[2]}` : null;
}

// Converte MM/AAAA para YYYY-MM (formato interno).
export function brCompetenceToIso(c: string): string | null {
  const m = c.match(/^(\d{2})\/(\d{4})$/);
  return m ? `${m[2]}-${m[1]}` : null;
}
