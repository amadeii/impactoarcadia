// Sprint C11 — G18 Nome amigável de conta bancária.
// Usa apelido se preenchido; senão monta "Banco Agencia Conta".

export interface ContaLike {
  apelido?: string | null;
  banco?: string;
  agencia?: string | null;
  conta?: string | null;
}

export function getDisplayName(c: ContaLike | null | undefined): string {
  if (!c) return "—";
  if (c.apelido && c.apelido.trim()) return c.apelido;
  return [c.banco, c.agencia, c.conta].filter(Boolean).join(" ").trim() || "(sem nome)";
}

export default function ContaDisplayName({ conta, className }: { conta: ContaLike | null | undefined; className?: string }) {
  return <span className={className} data-testid="text-conta-display">{getDisplayName(conta)}</span>;
}
