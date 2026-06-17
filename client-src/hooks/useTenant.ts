// Store simples sem zustand — usa módulo-level state + event emitter
// para evitar conflito de múltiplas cópias do React

export interface TenantInfo {
  id?: number;
  tenantId?: number;
  name: string;
  type?: string;
  tenantType?: string;
  plan?: string;
  status?: string;
  slug?: string;
  role?: string;
  _viaPartner?: number;
}

interface TenantState {
  activeTenantId: number | null;
  activeTenant:   TenantInfo | null;
  tenants:        TenantInfo[];
}

type Listener = (state: TenantState) => void;

function getStoredTenantId(): number | null {
  try {
    const v = localStorage.getItem('suite_active_tenant_id');
    return v ? Number(v) : null;
  } catch { return null; }
}

// ── Store global (módulo-level, sem React) ───────────────────────
let _state: TenantState = {
  activeTenantId: getStoredTenantId(),
  activeTenant:   null,
  tenants:        [],
};

const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach(fn => fn(_state));
}

export const tenantStore = {
  getState: () => _state,

  setActiveTenant(tenant: TenantInfo) {
    const id = tenant.tenantId ?? tenant.id ?? null;
    if (id) {
      try { localStorage.setItem('suite_active_tenant_id', String(id)); } catch {}
    }
    _state = { ..._state, activeTenantId: id, activeTenant: tenant };
    notify();
  },

  setTenants(tenants: TenantInfo[]) {
    _state = { ..._state, tenants };
    notify();
  },

  clearTenant() {
    try { localStorage.removeItem('suite_active_tenant_id'); } catch {}
    _state = { activeTenantId: null, activeTenant: null, tenants: [] };
    notify();
  },

  subscribe(fn: Listener) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};

// ── Hook React ───────────────────────────────────────────────────
import { useState, useEffect } from 'react';

export function useTenantStore() {
  const [state, setState] = useState<TenantState>(_state);

  useEffect(() => {
    // Sincroniza caso o store já tenha mudado antes de montar
    setState(_state);
    return tenantStore.subscribe(setState);
  }, []);

  return {
    ...state,
    setActiveTenant: tenantStore.setActiveTenant.bind(tenantStore),
    setTenants:      tenantStore.setTenants.bind(tenantStore),
    clearTenant:     tenantStore.clearTenant.bind(tenantStore),
  };
}
