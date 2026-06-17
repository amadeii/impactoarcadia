import { tenantStore } from '../hooks/useTenant';
import { EMPRESA_CONTEXT_KEY } from '../hooks/useEmpresaContext';

/**
 * apiFetch — wrapper sobre fetch que injeta automaticamente
 * x-tenant-id, x-empresa-id e x-grupo-id em todos os requests.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const activeTenantId = tenantStore.getState().activeTenantId;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (activeTenantId) {
    headers['x-tenant-id'] = String(activeTenantId);
  }

  try {
    const stored = JSON.parse(localStorage.getItem(EMPRESA_CONTEXT_KEY) ?? '{}');
    if (stored.empresaId) headers['x-empresa-id'] = String(stored.empresaId);
    if (stored.grupoId)   headers['x-grupo-id']   = String(stored.grupoId);
  } catch {}

  return fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });
}

export async function apiGet<T = any>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}

export async function apiPost<T = any>(url: string, body?: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
  return res.json();
}
