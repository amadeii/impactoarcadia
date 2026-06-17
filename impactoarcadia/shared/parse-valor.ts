/**
 * Converte string monetária brasileira para number.
 * Aceita: "1.234,56" → 1234.56, "1234.56" → 1234.56, "1234,56" → 1234.56
 */
export function parseValorBR(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const s = String(v).trim();
  // Formato BR: ponto como milhares, vírgula como decimal
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s)) {
    return parseFloat(s.replace(/\./g, "").replace(",", "."));
  }
  // Já no formato JS/EN
  const n = parseFloat(s.replace(",", ".").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Formata um valor monetário para o padrão brasileiro (R$ 1.234,56).
 * Aceita string ou number.
 */
export function formatValorBR(v: unknown): string {
  const n = parseValorBR(v);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
