import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

interface UserPermissions {
  permissions: string[];
  empresas: number[] | null;
  isAdmin: boolean;
}

export function usePermissions() {
  const { data, isLoading } = useQuery<UserPermissions>({
    queryKey: ["/api/auth/my-permissions"],
    queryFn: async () => {
      const r = await fetch("/api/auth/my-permissions", { credentials: "include" });
      if (!r.ok) return { permissions: [], empresas: null, isAdmin: false };
      return r.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const can = useCallback((code: string): boolean => {
    if (isLoading || !data) return false;
    if (data.isAdmin) return true;
    if (data.permissions.includes("*")) return true;
    return data.permissions.includes(code);
  }, [data, isLoading]);

  const canAccessEmpresa = useCallback((empresaId: number): boolean => {
    if (!data) return false;
    if (data.isAdmin) return true;
    if (!data.empresas || data.empresas.length === 0) return true;
    return data.empresas.includes(empresaId);
  }, [data]);

  return {
    can,
    canAccessEmpresa,
    isAdmin: data?.isAdmin ?? false,
    isLoading,
    permissions: data?.permissions ?? [],
  };
}
