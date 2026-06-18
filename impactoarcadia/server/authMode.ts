const LOCAL_AUTH_MODES = new Set(["local", "disabled", "disable", "off", "demo", "none"]);
const EXTERNAL_AUTH_MODES = new Set(["external", "oidc", "oauth", "sso", "replit"]);

function envFlagEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value || "").trim().toLowerCase());
}

export function getAuthMode(): string {
  return (process.env.AUTH_MODE || "local").trim().toLowerCase();
}

export function isExternalAuthMode(): boolean {
  return EXTERNAL_AUTH_MODES.has(getAuthMode());
}

export function isLocalAuthMode(): boolean {
  const mode = getAuthMode();
  return LOCAL_AUTH_MODES.has(mode) || !isExternalAuthMode();
}

export function isOidcDisabled(): boolean {
  if (envFlagEnabled(process.env.DISABLE_OIDC)) return true;
  return !isExternalAuthMode();
}

export function logAuthMode(): void {
  const mode = getAuthMode();
  if (isOidcDisabled()) {
    console.log(`[auth] AUTH_MODE=${mode}; external OIDC/SSO disabled; using local authentication`);
  } else {
    console.log(`[auth] AUTH_MODE=${mode}; external OIDC/SSO enabled`);
  }
}

export function isExternalAuthStartupError(error: unknown): boolean {
  const err = error as {
    message?: string;
    code?: string;
    stack?: string;
    status?: string | number;
    server?: string;
  };
  const text = [
    err?.message,
    err?.code,
    err?.stack,
    err?.status,
    err?.server,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    "openid-client",
    "performdiscovery",
    "oauth_response_is_not_conform",
    "oauth",
    "oidc",
    "openid",
    "issuer",
    "client_id",
    "client_secret",
    "replit",
  ].some((needle) => text.includes(needle));
}
