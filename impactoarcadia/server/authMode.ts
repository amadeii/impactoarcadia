export function isLocalAuthMode(): boolean {
  return process.env.AUTH_MODE?.toLowerCase() === "local";
}

export function isOidcDisabled(): boolean {
  return isLocalAuthMode() || process.env.DISABLE_OIDC === "true";
}

export function logAuthMode(): void {
  if (isOidcDisabled()) {
    console.log("[auth] External OIDC/SSO disabled; using local authentication");
  }
}
