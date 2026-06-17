import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantStore } from "./useTenant";

export interface EmpresaInfo {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  tipo: string;
}

export interface GrupoInfo {
  id: number;
  nome: string;
  tipo: string;
  totalEmpresas: number;
}

export interface EmpresaContextState {
  activeEmpresaId:   number | null;
  activeEmpresaNome: string | null;
  activeGrupoId:     number | null;
  activeGrupoNome:   string | null;
  visaoConsolidada:  boolean;
  empresas:          EmpresaInfo[];
  grupos:            GrupoInfo[];
}

export const EMPRESA_CONTEXT_KEY = "arcadia_empresa_context";

export function getStoredEmpresaContext(): { empresaId?: number; grupoId?: number } {
  try {
    const v = localStorage.getItem(EMPRESA_CONTEXT_KEY);
    return v ? JSON.parse(v) : {};
  } catch { return {}; }
}

export function useEmpresaContext() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<EmpresaContextState>({
    queryKey: ["/api/tenants/my-context"],
    queryFn: async () => {
      const stored = getStoredEmpresaContext();
      const activeTenantId = tenantStore.getState().activeTenantId;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeTenantId) headers["x-tenant-id"] = String(activeTenantId);
      if (stored.empresaId) headers["x-empresa-id"] = String(stored.empresaId);
      if (stored.grupoId)   headers["x-grupo-id"]   = String(stored.grupoId);
      const r = await fetch("/api/tenants/my-context", { credentials: "include", headers });
      if (!r.ok) throw new Error("Falha ao carregar contexto de empresa");
      return r.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  const setContextMutation = useMutation({
    mutationFn: async (ctx: { empresaId?: number | null; grupoId?: number | null }) => {
      const stored = getStoredEmpresaContext();
      const next: Record<string, number> = {};
      const newEmpresaId = ctx.empresaId !== undefined ? ctx.empresaId : stored.empresaId;
      const newGrupoId   = ctx.grupoId   !== undefined ? ctx.grupoId   : stored.grupoId;
      if (newEmpresaId) next.empresaId = newEmpresaId;
      if (newGrupoId)   next.grupoId   = newGrupoId;
      if (ctx.empresaId === null) delete next.empresaId;
      if (ctx.grupoId   === null) delete next.grupoId;
      try { localStorage.setItem(EMPRESA_CONTEXT_KEY, JSON.stringify(next)); } catch {}

      const activeTenantId = tenantStore.getState().activeTenantId;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeTenantId) headers["x-tenant-id"] = String(activeTenantId);

      const r = await fetch("/api/tenants/set-context", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(ctx),
      });
      if (!r.ok) throw new Error("Falha ao salvar contexto");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tenants/my-context"] });
      qc.invalidateQueries({ queryKey: ["/api/control"] });
      qc.invalidateQueries({ queryKey: ["/api/control/clientes"] });
    },
  });

  const setEmpresa = (empresa: EmpresaInfo | null) => {
    setContextMutation.mutate({ empresaId: empresa?.id ?? null, grupoId: null });
  };

  const setGrupo = (grupo: GrupoInfo | null) => {
    setContextMutation.mutate({ grupoId: grupo?.id ?? null, empresaId: null });
  };

  const limparContexto = () => {
    try { localStorage.removeItem(EMPRESA_CONTEXT_KEY); } catch {}
    setContextMutation.mutate({ empresaId: null, grupoId: null });
  };

  return {
    activeEmpresaId:   data?.activeEmpresaId   ?? null,
    activeEmpresaNome: data?.activeEmpresaNome ?? null,
    activeGrupoId:     data?.activeGrupoId     ?? null,
    activeGrupoNome:   data?.activeGrupoNome   ?? null,
    visaoConsolidada:  data?.visaoConsolidada  ?? false,
    empresas:          data?.empresas          ?? [],
    grupos:            data?.grupos            ?? [],
    isLoading,
    isSwitching: setContextMutation.isPending,
    setEmpresa,
    setGrupo,
    limparContexto,
  };
}
