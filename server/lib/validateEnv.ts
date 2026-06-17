/**
 * validateEnv.ts — Sprint 1 (SEC)
 * Valida secrets obrigatórios em produção e rejeita valores padrão inseguros.
 * Chamar como PRIMEIRA instrução de server/index.ts.
 */

export function validateProductionSecrets(): void {
  if (process.env.NODE_ENV !== "production") return;

  // Variáveis obrigatórias em produção
  const required = ["SESSION_SECRET", "CRYPTO_SECRET", "DATABASE_URL"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[startup] Variáveis obrigatórias ausentes em produção: ${missing.join(", ")}\n` +
      `Configure em Coolify > Environment Variables antes de fazer deploy.`
    );
  }

  // Rejeita valores padrão conhecidos em produção
  const insecureDefaults: Record<string, string> = {
    SESSION_SECRET:   "arcadia-browser-secret-key-2024",
    CRYPTO_SECRET:    "arcadia-suite-default-secret-key-32b",
    MANAGER_PASSWORD: "gerente123",
    PROTOCOL_API_KEYS: "arcadia-dev-key",
  };

  for (const [key, defaultVal] of Object.entries(insecureDefaults)) {
    const current = process.env[key];
    if (current && current === defaultVal) {
      throw new Error(
        `[startup] ${key} está usando valor padrão inseguro em produção.\n` +
        `Gere um novo valor com: openssl rand -hex 32\n` +
        `Configure em Coolify > Environment Variables.`
      );
    }
  }
}
