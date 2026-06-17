import { useQuery } from "@tanstack/react-query";

export type TenantFeatures = {
  ide: boolean;
  ideMode: 'none' | 'no-code' | 'low-code' | 'pro-code';
  whatsapp: boolean;
  whatsappSessions: number;
  crm: boolean;
  erp: boolean;
  bi: boolean;
  manus: boolean;
  manusTools: string[];
  centralApis: boolean;
  centralApisManage: boolean;
  comunidades: boolean;
  maxChannels: number;
  biblioteca: boolean;
  bibliotecaPublish: boolean;
  suporteN3: boolean;
  retail: boolean;
  plus: boolean;
  fisco: boolean;
  cockpit: boolean;
  compass: boolean;
  production: boolean;
  support: boolean;
  xosCrm: boolean;
};

const defaultFeatures: TenantFeatures = {
  ide: true, ideMode: 'pro-code', whatsapp: false, whatsappSessions: 0,
  crm: true, erp: true, bi: false, manus: true, manusTools: [],
  centralApis: false, centralApisManage: false, comunidades: false,
  maxChannels: 5, biblioteca: false, bibliotecaPublish: false,
  suporteN3: false, retail: false, plus: false, fisco: false,
  cockpit: false, compass: true, production: false, support: false, xosCrm: false
};

export function useTenantFeatures() {
  const { data, isLoading } = useQuery({
    queryKey: ["tenant-modules"],
    queryFn: async () => {
      const res = await fetch("/api/soe/tenant/modules", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tenant modules");
      return res.json();
    },
    staleTime: 60000,
    retry: 1
  });

  const features: TenantFeatures = { ...defaultFeatures, ...(data?.features || {}) };

  return {
    features,
    isLoading,
    plan: data?.plan as string | undefined,
    isEnabled: (key: keyof TenantFeatures) => !!features[key],
  };
}
