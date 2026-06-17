export const CHECKLIST_ITEMS = [
  { code: "SOC-001", category: "Informações Gerais e Societárias", name: "Contrato Social e alterações", description: "Contrato social consolidado com todas as alterações contratuais", isBaseRequired: true },
  { code: "SOC-002", category: "Informações Gerais e Societárias", name: "Quadro societário atualizado", description: "Composição societária atual com percentuais", isBaseRequired: true },
  { code: "SOC-003", category: "Informações Gerais e Societárias", name: "Certidões negativas", description: "Certidões negativas federal, estadual e municipal", isBaseRequired: true },
  { code: "SOC-004", category: "Informações Gerais e Societárias", name: "Procurações vigentes", description: "Procurações em vigor com poderes e prazos", isBaseRequired: false },
  { code: "SOC-005", category: "Informações Gerais e Societárias", name: "Atas de assembleias/reuniões", description: "Atas dos últimos 3 anos", isBaseRequired: false },
  { code: "SOC-006", category: "Informações Gerais e Societárias", name: "Organograma da empresa", description: "Estrutura organizacional atualizada", isBaseRequired: false },
  { code: "SOC-007", category: "Informações Gerais e Societárias", name: "Histórico da empresa", description: "Breve histórico de fundação, marcos e evolução", isBaseRequired: true },
  { code: "FIN-001", category: "Dados Financeiros e Contábeis", name: "Balanço patrimonial (3 anos)", description: "Balanço patrimonial dos últimos 3 exercícios", isBaseRequired: true },
  { code: "FIN-002", category: "Dados Financeiros e Contábeis", name: "DRE (3 anos)", description: "Demonstração de resultados dos últimos 3 exercícios", isBaseRequired: true },
  { code: "FIN-003", category: "Dados Financeiros e Contábeis", name: "Fluxo de caixa (3 anos)", description: "Demonstração de fluxo de caixa dos últimos 3 exercícios", isBaseRequired: true },
  { code: "FIN-004", category: "Dados Financeiros e Contábeis", name: "Balancete mensal ano corrente", description: "Balancete mês a mês do exercício atual", isBaseRequired: true },
  { code: "FIN-005", category: "Dados Financeiros e Contábeis", name: "Relatório de contas a receber", description: "Aging de recebíveis com vencimentos", isBaseRequired: true },
  { code: "FIN-006", category: "Dados Financeiros e Contábeis", name: "Relatório de contas a pagar", description: "Aging de payables com vencimentos", isBaseRequired: true },
  { code: "FIN-007", category: "Dados Financeiros e Contábeis", name: "Posição de estoque", description: "Inventário valorizado e aging de estoque", isBaseRequired: false },
  { code: "FIN-008", category: "Dados Financeiros e Contábeis", name: "Contratos de empréstimo/financiamento", description: "Todos os contratos de dívida com condições", isBaseRequired: true },
  { code: "FIN-009", category: "Dados Financeiros e Contábeis", name: "Projeções financeiras (5 anos)", description: "Projeções de receita, custos e investimentos para 5 anos", isBaseRequired: true },
  { code: "ATF-001", category: "Ativos Físicos e Imóveis", name: "Relação de imóveis", description: "Lista de imóveis próprios com valores e documentação", isBaseRequired: false },
  { code: "ATF-002", category: "Ativos Físicos e Imóveis", name: "Laudo de avaliação de imóveis", description: "Laudos de avaliação de mercado dos imóveis", isBaseRequired: false },
  { code: "ATF-003", category: "Ativos Físicos e Imóveis", name: "Inventário de máquinas/equipamentos", description: "Lista completa de ativos fixos com valores", isBaseRequired: false },
  { code: "ATF-004", category: "Ativos Físicos e Imóveis", name: "Contratos de locação", description: "Contratos de aluguel vigentes com condições", isBaseRequired: false },
  { code: "ATI-001", category: "Ativos Intangíveis e PI", name: "Registros de marcas e patentes", description: "Certificados de registro de marcas e patentes", isBaseRequired: false },
  { code: "ATI-002", category: "Ativos Intangíveis e PI", name: "Contratos de licenciamento", description: "Contratos de licença de uso de tecnologia/software", isBaseRequired: false },
  { code: "ATI-003", category: "Ativos Intangíveis e PI", name: "Portfólio de softwares/sistemas", description: "Lista de sistemas proprietários e licenciados", isBaseRequired: false },
  { code: "ATI-004", category: "Ativos Intangíveis e PI", name: "Carteira de clientes valorizada", description: "Base de clientes com LTV e churn rate", isBaseRequired: false },
  { code: "RH-001", category: "Recursos Humanos", name: "Quadro de funcionários", description: "Lista completa de colaboradores com cargos e salários", isBaseRequired: true },
  { code: "RH-002", category: "Recursos Humanos", name: "Acordos coletivos vigentes", description: "Convenções e acordos coletivos de trabalho", isBaseRequired: false },
  { code: "RH-003", category: "Recursos Humanos", name: "Passivos trabalhistas", description: "Relatório de ações trabalhistas em curso", isBaseRequired: false },
  { code: "RH-004", category: "Recursos Humanos", name: "Plano de cargos e salários", description: "Estrutura de remuneração e benefícios", isBaseRequired: false },
  { code: "DIG-001", category: "Ativos Digitais e Sociais", name: "Métricas de redes sociais", description: "Seguidores, engajamento e alcance por plataforma", isBaseRequired: false },
  { code: "DIG-002", category: "Ativos Digitais e Sociais", name: "Analytics do site/app", description: "Métricas de tráfego, conversão e retenção", isBaseRequired: false },
  { code: "DIG-003", category: "Ativos Digitais e Sociais", name: "Base de leads/email marketing", description: "Tamanho e qualidade da base de contatos", isBaseRequired: false },
  { code: "DIG-004", category: "Ativos Digitais e Sociais", name: "Domínios e ativos digitais", description: "Lista de domínios, apps e propriedades digitais", isBaseRequired: false },
  { code: "GOV-001", category: "Governança e Compliance", name: "Políticas internas documentadas", description: "Manual de políticas e procedimentos internos", isBaseRequired: false },
  { code: "GOV-002", category: "Governança e Compliance", name: "Certificações (ISO, etc)", description: "Certificações de qualidade e compliance vigentes", isBaseRequired: false },
  { code: "GOV-003", category: "Governança e Compliance", name: "Mapa de riscos", description: "Matriz de riscos corporativos identificados", isBaseRequired: false },
  { code: "GOV-004", category: "Governança e Compliance", name: "Programa de compliance/LGPD", description: "Documentação do programa de conformidade", isBaseRequired: false },
  { code: "CTR-001", category: "Contratos e Obrigações", name: "Contratos com clientes principais", description: "Contratos dos 10 maiores clientes", isBaseRequired: true },
  { code: "CTR-002", category: "Contratos e Obrigações", name: "Contratos com fornecedores principais", description: "Contratos dos 10 maiores fornecedores", isBaseRequired: true },
  { code: "CTR-003", category: "Contratos e Obrigações", name: "Contingências judiciais", description: "Relatório de processos judiciais e contingências", isBaseRequired: true },
];

export const GOVERNANCE_CRITERIA = [
  { code: "GC-01", name: "Conselho de Administração", category: "Corporate", weight: 8, valuationImpactPct: 3.0, equityImpactPct: 2.0, roeImpactPct: 1.5 },
  { code: "GC-02", name: "Comitê de Auditoria", category: "Corporate", weight: 7, valuationImpactPct: 2.5, equityImpactPct: 1.8, roeImpactPct: 1.2 },
  { code: "GC-03", name: "Gestão de Riscos", category: "Corporate", weight: 8, valuationImpactPct: 3.0, equityImpactPct: 2.5, roeImpactPct: 2.0 },
  { code: "GC-04", name: "Código de Ética", category: "Corporate", weight: 5, valuationImpactPct: 1.5, equityImpactPct: 1.0, roeImpactPct: 0.5 },
  { code: "GC-05", name: "Transparência e Disclosure", category: "Corporate", weight: 7, valuationImpactPct: 2.5, equityImpactPct: 2.0, roeImpactPct: 1.5 },
  { code: "GC-06", name: "ISO 27001 / Segurança da Informação", category: "IT", weight: 6, valuationImpactPct: 2.0, equityImpactPct: 1.5, roeImpactPct: 1.0 },
  { code: "GC-07", name: "SOC 2 Type II", category: "IT", weight: 5, valuationImpactPct: 1.5, equityImpactPct: 1.0, roeImpactPct: 0.8 },
  { code: "GC-08", name: "Conformidade LGPD", category: "IT", weight: 7, valuationImpactPct: 2.5, equityImpactPct: 2.0, roeImpactPct: 1.0 },
  { code: "GC-09", name: "Plano BCDR (Continuidade)", category: "IT", weight: 6, valuationImpactPct: 2.0, equityImpactPct: 1.5, roeImpactPct: 1.0 },
  { code: "GC-10", name: "Pentests e Auditorias de SI", category: "IT", weight: 4, valuationImpactPct: 1.0, equityImpactPct: 0.8, roeImpactPct: 0.5 },
  { code: "GC-11", name: "Política Ambiental", category: "ESG", weight: 5, valuationImpactPct: 1.5, equityImpactPct: 1.0, roeImpactPct: 0.5 },
  { code: "GC-12", name: "Responsabilidade Social", category: "ESG", weight: 5, valuationImpactPct: 1.5, equityImpactPct: 1.0, roeImpactPct: 0.5 },
  { code: "GC-13", name: "Relatório ESG", category: "ESG", weight: 4, valuationImpactPct: 1.0, equityImpactPct: 0.8, roeImpactPct: 0.3 },
  { code: "GC-14", name: "Diversidade e Inclusão", category: "ESG", weight: 4, valuationImpactPct: 1.0, equityImpactPct: 0.8, roeImpactPct: 0.3 },
  { code: "GC-15", name: "Auditoria Externa", category: "Financial", weight: 8, valuationImpactPct: 3.0, equityImpactPct: 2.5, roeImpactPct: 2.0 },
  { code: "GC-16", name: "Controles Internos", category: "Financial", weight: 7, valuationImpactPct: 2.5, equityImpactPct: 2.0, roeImpactPct: 1.5 },
  { code: "GC-17", name: "Planejamento Financeiro Estruturado", category: "Financial", weight: 6, valuationImpactPct: 2.0, equityImpactPct: 1.5, roeImpactPct: 1.0 },
  { code: "GC-18", name: "Plano de Carreira", category: "HR", weight: 4, valuationImpactPct: 1.0, equityImpactPct: 0.8, roeImpactPct: 0.5 },
  { code: "GC-19", name: "Sistema de Avaliação de Desempenho", category: "HR", weight: 4, valuationImpactPct: 1.0, equityImpactPct: 0.8, roeImpactPct: 0.5 },
  { code: "GC-20", name: "Programa de Compliance", category: "Legal", weight: 7, valuationImpactPct: 2.5, equityImpactPct: 2.0, roeImpactPct: 1.5 },
];

export const CANVAS_BLOCKS = [
  "key_partners",
  "key_activities",
  "key_resources",
  "value_proposition",
  "customer_relationships",
  "channels",
  "customer_segments",
  "cost_structure",
  "revenue_streams",
] as const;

export const CANVAS_BLOCK_LABELS: Record<string, string> = {
  key_partners: "Parceiros-Chave",
  key_activities: "Atividades-Chave",
  key_resources: "Recursos-Chave",
  value_proposition: "Proposta de Valor",
  customer_relationships: "Relacionamento com Clientes",
  channels: "Canais",
  customer_segments: "Segmentos de Clientes",
  cost_structure: "Estrutura de Custos",
  revenue_streams: "Fontes de Receita",
};

export const SWOT_QUADRANTS = ["strengths", "weaknesses", "opportunities", "threats"] as const;

export const PDCA_PHASES = ["plan", "do", "check", "act"] as const;

export const PDCA_ORIGIN_AREAS = [
  "governance",
  "financial",
  "operational",
  "commercial",
  "hr",
  "technology",
  "legal",
  "esg",
] as const;

export const VALUATION_METHODS = {
  dcf: "Fluxo de Caixa Descontado (DCF)",
  ev_ebitda: "Múltiplo EV/EBITDA",
  ev_revenue: "Múltiplo EV/Receita",
  patrimonial: "Patrimonial (Book Value)",
  assets: "Soma de Ativos",
} as const;

export const CALCULATION_WEIGHTS = {
  simple: { dcf: 0.50, ev_ebitda: 0.30, ev_revenue: 0.20 },
  governance: { dcf: 0.40, ev_ebitda: 0.25, ev_revenue: 0.15, patrimonial: 0.10, assets: 0.10 },
} as const;

export const SCENARIO_PROBABILITIES = {
  conservative: 0.25,
  base: 0.50,
  optimistic: 0.25,
} as const;

export const SCENARIO_GROWTH_ADJUSTMENTS = {
  conservative: -0.30,
  base: 0,
  optimistic: 0.30,
} as const;

export const MAX_GOVERNANCE_UPLIFT = 0.43;
export const MAX_WACC_REDUCTION = 0.025;
