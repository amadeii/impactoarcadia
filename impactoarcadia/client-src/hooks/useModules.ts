/**
 * SEG-01 — Hook que retorna quais módulos estão ativos para o tenant.
 * Lê erpConfig e deriva flags booleanos de visibilidade de navegação.
 * SEG-05 — Expandido com flags do segmento decoracao_cortinas + isolamento bidirecional.
 */
import { useQuery } from "@tanstack/react-query";

export interface TenantModules {
  // Core SOE — sempre ativos
  control: boolean;
  hr: boolean;
  fisco: boolean;
  contabil: boolean;
  soe: boolean;
  crm: boolean;

  // Segmento engenharia_ambiental
  engineering: boolean;
  quality: boolean;
  fieldOps: boolean;
  iso17025: boolean;
  controleAmostras: boolean;
  propostaProjeto: boolean;

  // Outros segmentos genéricos
  suppliers: boolean;
  retail: boolean;
  production: boolean;

  // Segmento decoracao_cortinas
  pedidosTecnicos: boolean;
  configurador: boolean;
  catalogoDecoracao: boolean;
  osAtelie: boolean;
  osInstalacao: boolean;
  etiquetasDecoracao: boolean;

  // Segmento ativo (código string, ex: "engenharia_ambiental")
  segment: string;

  // Visibilidade de nav por segmento
  showSupporte: boolean;
  showCompass: boolean;
}

const DEFAULTS: TenantModules = {
  control: true, hr: true, fisco: true, contabil: true, soe: true, crm: true,
  engineering: false, quality: false, fieldOps: false,
  iso17025: false, controleAmostras: false, propostaProjeto: false,
  suppliers: false, retail: false, production: false,
  pedidosTecnicos: false, configurador: false, catalogoDecoracao: false,
  osAtelie: false, osInstalacao: false, etiquetasDecoracao: false,
  segment: "",
  showSupporte: true,
  showCompass: true,
};

function mapConfigToModules(config: any): TenantModules {
  if (!config) return DEFAULTS;

  const f: Record<string, boolean> = config.featuresJson ?? config.features_json ?? {};
  const mods: string[] = config.activeModules ?? config.active_modules ?? [];
  const seg: string = config.segmento ?? config.segment ?? "";

  const mod = (...keys: string[]) => keys.some(k => mods.includes(k) || !!f[k]);

  return {
    // Core
    control:  (config.modulesFinance    ?? 1) !== 0,
    hr:       (config.modulesHr         ?? 0) !== 0,
    fisco:    (config.modulesSales      ?? 1) !== 0,
    contabil: (config.modulesAccounting ?? 0) !== 0,
    soe:      true,
    crm:      (config.modulesCrm       ?? 1) !== 0,

    // Engenharia ambiental — desativados para decoracao_cortinas
    engineering: (mod("projetos", "engineering") || (config.modulesProjects ?? 0) !== 0) && seg !== "decoracao_cortinas",
    quality:     (mod("qualidade") || !!f.iso17025 || !!f.laudosLaboratoriais) && seg !== "decoracao_cortinas",
    fieldOps:    (mod("campo") || !!f.prestacaoContasCampo || (config.modulesServiceOrder ?? 0) !== 0) && seg !== "decoracao_cortinas",
    iso17025:         !!f.iso17025 && seg !== "decoracao_cortinas",
    controleAmostras: !!f.controleAmostras && seg !== "decoracao_cortinas",
    propostaProjeto:  !!f.propostaProjeto && seg !== "decoracao_cortinas",

    // Genéricos
    suppliers:   mod("fornecedores", "compras") || (config.modulesPurchases ?? 1) !== 0,
    retail:      (mod("retail", "estoque") || (config.modulesStock ?? 1) !== 0) && seg !== "decoracao_cortinas",
    production:  (mod("producao") || (config.modulesProduction ?? 0) !== 0) && seg !== "decoracao_cortinas",

    // Decoração/Cortinas — só ativo neste segmento
    pedidosTecnicos:    seg === "decoracao_cortinas" && mod("pedidos_tecnicos"),
    configurador:       seg === "decoracao_cortinas" && (!!f.configuradorProduto || !!f.configuradorCortinas || mod("configurador")),
    catalogoDecoracao:  seg === "decoracao_cortinas" && (!!f.catalogoDisponibilidade || !!f.catalogoTecidos),
    osAtelie:           seg === "decoracao_cortinas" && (!!f.osProducaoAtelie || !!f.osProd),
    osInstalacao:       seg === "decoracao_cortinas" && !!f.osInstalacao,
    etiquetasDecoracao: seg === "decoracao_cortinas" && !!f.etiquetasPecas,

    // Segmento ativo
    segment: seg,

    // Visibilidade por segmento
    showSupporte: seg !== "engenharia_ambiental",
    showCompass:  seg !== "engenharia_ambiental",
  };
}

export function useModules(): TenantModules {
  const { data: config } = useQuery({
    queryKey: ["/api/erp/config"],
    queryFn: async () => {
      const res = await fetch("/api/erp/config", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  return mapConfigToModules(config);
}
