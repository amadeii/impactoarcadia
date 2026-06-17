/**
 * Sprint C-E01 — hook que retorna o segmento ativo do tenant.
 * Segmento 'engineering' ativa: projetoId obrigatório, DRE por projeto, rateio.
 */
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TenantSegmentoInfo {
  segmento: string;
  isEngineering: boolean;
}

export function useTenantSegmento(): TenantSegmentoInfo {
  const { data } = useQuery<any>({
    queryKey: ["/api/tenant/profile"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/tenant/profile");
        return res.json();
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const segmento: string = data?.segmento ?? data?.segment ?? "generic";

  return {
    segmento,
    isEngineering: segmento === "engineering",
  };
}
