export type ControlPlusResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; data: any };

type RequestMethod = "GET" | "POST";

interface ControlPlusRequestOptions {
  method?: RequestMethod;
  body?: Record<string, any>;
}

function getBaseUrl(): string {
  return (process.env.CONTROL_PLUS_URL || "").trim().replace(/\/+$/, "");
}

function getToken(): string {
  return (process.env.CONTROL_PLUS_SUPERADMIN_TOKEN || "").trim();
}

function getTimeoutMs(): number {
  const parsed = Number(process.env.CONTROL_PLUS_TIMEOUT_MS || "15000");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
}

function normalizeEmpresaId(empresaId?: number | string | null): number {
  const value = Number(empresaId ?? process.env.CONTROL_PLUS_EMPRESA_ID ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function errorMessageFromData(data: any, fallback: string): string {
  if (data && typeof data === "object") {
    return data.message || data.error || data.detail || fallback;
  }
  if (typeof data === "string" && data.trim()) return data;
  return fallback;
}

async function parseJsonResponse(response: Response): Promise<{ valid: true; data: any } | { valid: false; data: string }> {
  const text = await response.text();
  if (!text) return { valid: true, data: null };

  try {
    return { valid: true, data: JSON.parse(text) };
  } catch {
    return { valid: false, data: text };
  }
}

async function controlPlusRequest<T = any>(
  path: string,
  options: ControlPlusRequestOptions = {},
): Promise<ControlPlusResult<T>> {
  const baseUrl = getBaseUrl();
  const token = getToken();

  if (!baseUrl || !token) {
    return {
      ok: false,
      status: 0,
      message: "ControlPlus not configured",
      data: null,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const parsed = await parseJsonResponse(response);
    if (!parsed.valid) {
      return {
        ok: false,
        status: response.status,
        message: "Invalid JSON response from ControlPlus",
        data: parsed.data,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: errorMessageFromData(parsed.data, `ControlPlus HTTP ${response.status}`),
        data: parsed.data,
      };
    }

    return { ok: true, data: parsed.data as T };
  } catch (error: any) {
    const timedOut = error?.name === "AbortError";
    return {
      ok: false,
      status: timedOut ? 408 : 0,
      message: timedOut ? "ControlPlus request timed out" : error?.message || "ControlPlus connection error",
      data: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function isControlPlusConfigured(): boolean {
  return Boolean(getBaseUrl() && getToken());
}

export async function controlPlusHealth(): Promise<ControlPlusResult> {
  return controlPlusRequest("/api/health");
}

export async function syncUserToControlPlus(input: {
  nome: string;
  email: string;
  senha: string;
  empresaId?: number | string | null;
}): Promise<ControlPlusResult> {
  return controlPlusRequest("/api/v1/usuarios/store", {
    method: "POST",
    body: {
      nome: input.nome,
      email: input.email,
      senha: input.senha,
      empresa_id: normalizeEmpresaId(input.empresaId),
    },
  });
}

export async function emitirNfeControlPlus(
  payload: Record<string, any>,
  empresaId?: number | string | null,
): Promise<ControlPlusResult> {
  const normalizedEmpresaId = normalizeEmpresaId(empresaId ?? payload?.empresa_id);
  return controlPlusRequest("/api/fiscal/nfe/emitir", {
    method: "POST",
    body: {
      ...payload,
      empresa_id: payload?.empresa_id ?? normalizedEmpresaId,
    },
  });
}

export async function cancelarNfeControlPlus(
  payload: Record<string, any>,
  empresaId?: number | string | null,
): Promise<ControlPlusResult> {
  const normalizedEmpresaId = normalizeEmpresaId(empresaId ?? payload?.empresa_id);
  return controlPlusRequest("/api/fiscal/nfe/cancelar", {
    method: "POST",
    body: {
      ...payload,
      empresa_id: payload?.empresa_id ?? normalizedEmpresaId,
    },
  });
}

export async function verificarCertificadoControlPlus(
  empresaId?: number | string | null,
): Promise<ControlPlusResult> {
  const normalizedEmpresaId = normalizeEmpresaId(empresaId);
  return controlPlusRequest(`/api/fiscal/certificado/verificar?empresa_id=${encodeURIComponent(String(normalizedEmpresaId))}`);
}
