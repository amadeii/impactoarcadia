import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";

const STORAGE_KEY = "arcadia_grupo_selecionado";

export interface GrupoEmpresa {
  membroId: number;
  empresaId: number;
  papel: string;
  participacao: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnpj: string | null;
  tenantIdEmpresa: number | null;
  clienteId: string | null;
}

export interface GrupoCtx {
  id: number;
  nome: string;
  tipo: string | null;
  grupoControlId: string | null;
  grupo_control_id?: string | null;
  membros?: any[];
}

interface GrupoEmpresasResult {
  grupo: { id: number; nome: string; tipo: string | null; grupoControlId: string | null };
  empresas: GrupoEmpresa[];
  clienteIds: string[];
}

function loadSaved(): number | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function saveSelecionado(id: number | null) {
  try {
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  } catch {}
}

export function useGrupoEmpresarial() {
  const [selectedGrupoId, setSelectedGrupoIdState] = useState<number | null>(loadSaved);

  const setSelectedGrupoId = useCallback((id: number | null) => {
    saveSelecionado(id);
    setSelectedGrupoIdState(id);
  }, []);

  const { data: grupos = [], isLoading: gruposLoading } = useQuery<GrupoCtx[]>({
    queryKey: ["/api/admin/grupos"],
    queryFn: async () => {
      const res = await fetch("/api/admin/grupos", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: grupoCtx, isLoading: ctxLoading } = useQuery<GrupoEmpresasResult>({
    queryKey: ["/api/admin/grupos", selectedGrupoId, "empresas-clients"],
    queryFn: async () => {
      if (!selectedGrupoId) return { grupo: null, empresas: [], clienteIds: [] } as any;
      const res = await fetch(`/api/admin/grupos/${selectedGrupoId}/empresas-clients`, { credentials: "include" });
      if (!res.ok) return { grupo: null, empresas: [], clienteIds: [] } as any;
      return res.json();
    },
    enabled: !!selectedGrupoId,
    staleTime: 30_000,
  });

  const selectedGrupo = grupos.find(g => g.id === selectedGrupoId) ?? null;
  const grupoEmpresas: GrupoEmpresa[] = grupoCtx?.empresas ?? [];
  const clienteIds: string[] = grupoCtx?.clienteIds ?? [];
  const tenantIds: number[] = grupoEmpresas.map(e => e.tenantIdEmpresa).filter(Boolean) as number[];

  return {
    grupos,
    gruposLoading,
    selectedGrupoId,
    selectedGrupo,
    setSelectedGrupoId,
    grupoEmpresas,
    clienteIds,
    tenantIds,
    isLoadingCtx: ctxLoading,
    hasGrupo: !!selectedGrupoId,
  };
}
