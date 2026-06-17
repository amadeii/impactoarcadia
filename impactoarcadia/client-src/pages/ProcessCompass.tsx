import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState, useEffect } from "react";
import BpmnDiagram from "@/components/BpmnDiagram";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Target,
  TrendingUp,
  FileText,
  Plus,
  Trash2,
  Settings,
  Loader2,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  ChevronRight,
  Calendar,
  Clock,
  BarChart3,
  Briefcase,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Eye,
  CheckCircle,
  AlertCircle,
  Compass,
  Network,
  ClipboardList,
  Layers,
  Menu,
  X,
  RefreshCw,
  FileCheck,
  HelpCircle,
  Info,
  ExternalLink,
  Download,
  Lightbulb,
  Pencil,
  LayoutGrid,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ProcessDiagram } from "@/components/ProcessDiagram";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Upload, UserX, Save, CirclePlay } from "lucide-react";

interface CompassStats {
  clients: number;
  projects: number;
  leads: number;
  opportunities: number;
  activeProjects: number;
  openOpportunities: number;
}

interface PcClient {
  id: number;
  tenantId: number;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  industry: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  logoUrl: string | null;
  status: string;
  createdAt: string;
}

interface PcProject {
  id: number;
  tenantId: number;
  clientId: number;
  name: string;
  description: string | null;
  projectType: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  priority: number;
  createdAt: string;
}

interface PcCrmLead {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: string;
  createdAt: string;
}

interface PcCrmOpportunity {
  id: number;
  name: string;
  value: number;
  probability: number;
  status: string;
  expectedCloseDate: string | null;
  createdAt: string;
}

interface Tenant {
  id: number;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
}

interface PcCanvasBlock {
  id: number;
  projectId: number;
  blockType: string;
  level: string;
  title: string | null;
  content: string | null;
  notes: string | null;
  score: number;
  synthesis: string | null;
}

interface PcCanvasQuestion {
  id: number;
  blockId: number;
  question: string;
  answer: string | null;
  score: number | null;
  orderIndex: number;
}

interface PcCanvasExpectedOutput {
  id: number;
  blockId: number;
  description: string;
  completed: boolean;
  orderIndex: number;
}

interface PcCanvasPdcaLink {
  id: number;
  blockId: number;
  pdcaActionId: number;
  observation: string | null;
}

interface PcCanvasSwotLink {
  id: number;
  blockId: number;
  swotItemId: number;
}

interface PcProcess {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  category: string | null;
  owner: string | null;
  status: string;
  priority: number;
  diagramNodes?: any[];
  diagramEdges?: any[];
  diagramViewport?: { x: number; y: number; zoom: number };
}

interface PcProcessStep {
  id: number;
  processId: number;
  name: string;
  description: string | null;
  responsible: string | null;
  inputs: string | null;
  outputs: string | null;
  systems: string | null;
  duration: string | null;
  painPoints: string | null;
  suggestions: string | null;
  order: number;
}

interface PcSwotAnalysis {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  sector: string | null;
  status: string;
}

interface PcSwotItem {
  id: number;
  swotAnalysisId: number;
  type: string;
  title: string | null;
  description: string;
  impact: string;
  impactScore: number;
  priorityLevel: string;
  priority: number;
  actionPlan: string | null;
  result: string | null;
  pdcaStatus: string;
  responsible: string | null;
  dueDate: string | null;
  status: string;
}

interface PcPdcaCycle {
  id: number;
  tenantId: number;
  projectId: number | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
}

interface PdcaOverviewItem {
  id: number;
  source: 'canvas' | 'processes' | 'swot' | 'requirements';
  title: string;
  description: string | null;
  pdcaStatus: string;
  pdcaActionPlan: string | null;
  pdcaResult: string | null;
  projectId: number;
}

interface PdcaOverviewStats {
  total: number;
  plan: number;
  do: number;
  check: number;
  act: number;
  done: number;
}

interface PdcaOverview {
  items: PdcaOverviewItem[];
  stats: {
    canvas: PdcaOverviewStats;
    processes: PdcaOverviewStats;
    swot: PdcaOverviewStats;
    requirements: PdcaOverviewStats;
  };
}

interface PcPdcaAction {
  id: number;
  cycleId: number;
  phase: string;
  title: string;
  description: string | null;
  responsible: string | null;
  status: string;
  dueDate: string | null;
}

interface PcRequirement {
  id: number;
  tenantId: number;
  projectId: number | null;
  code: string | null;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  source: string | null;
  category: string | null;
  acceptanceCriteria: string | null;
  createdAt: string;
}

interface PcTeamMember {
  id: number;
  projectId: number;
  name: string;
  email: string | null;
  role: string;
  createdAt: string;
}

interface PcProjectFile {
  id: number;
  projectId: number;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

interface PcProjectTask {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  dueDate: string | null;
  createdAt: string;
}

interface PcProjectHistory {
  id: number;
  projectId: number;
  content: string;
  updatedAt: string;
}

const PDCA_PHASES = [
  { id: "plan", label: "Plan", color: "bg-blue-100 text-blue-800" },
  { id: "do", label: "Do", color: "bg-green-100 text-green-800" },
  { id: "check", label: "Check", color: "bg-yellow-100 text-yellow-800" },
  { id: "act", label: "Act", color: "bg-purple-100 text-purple-800" },
];

const REQUIREMENT_TYPES = [
  { id: "functional", label: "Funcional" },
  { id: "non_functional", label: "Não Funcional" },
  { id: "business", label: "Negócio" },
  { id: "technical", label: "Técnico" },
];

const REQUIREMENT_STATUS = [
  { id: "draft", label: "Rascunho" },
  { id: "approved", label: "Aprovado" },
  { id: "implemented", label: "Implementado" },
  { id: "verified", label: "Verificado" },
  { id: "rejected", label: "Rejeitado" },
];

const CANVAS_BLOCK_TYPES = [
  { id: "value_propositions", label: "Proposta de Valor", color: "bg-green-100 border-green-300", description: "Sentido / Propósito" },
  { id: "customer_segments", label: "Segmentos de Clientes", color: "bg-orange-100 border-orange-300", description: "Quem recebe nossa transformação" },
  { id: "channels", label: "Canais", color: "bg-yellow-100 border-yellow-300", description: "Caminhos / Pontes" },
  { id: "customer_relationships", label: "Relacionamento", color: "bg-yellow-100 border-yellow-300", description: "Forma de Amar/Servir" },
  { id: "revenue_streams", label: "Fontes de Receita", color: "bg-emerald-100 border-emerald-300", description: "Energia que sustenta o propósito" },
  { id: "key_resources", label: "Recursos-Chave", color: "bg-blue-100 border-blue-300", description: "Capacidades / Disposições" },
  { id: "key_activities", label: "Atividades-Chave", color: "bg-blue-100 border-blue-300", description: "Ações / Ritmos" },
  { id: "key_partners", label: "Parcerias-Chave", color: "bg-purple-100 border-purple-300", description: "Alianças e interdependência" },
  { id: "cost_structure", label: "Estrutura de Custos", color: "bg-red-100 border-red-300", description: "Sacrifícios / Investimentos" },
];

const CANVAS_LEVELS = [
  { id: "atual", label: "Atual", description: "Estado atual do negócio - como está hoje" },
  { id: "sistemico", label: "Sistêmico", description: "Visão sistêmica e estratégica" },
  { id: "intencao", label: "Intenção", description: "O que pretendemos fazer" },
  { id: "evidencias", label: "Evidências", description: "O que temos de concreto" },
  { id: "transformacao", label: "Transformação", description: "O que queremos mudar" },
];

const PROCESS_CATEGORIES = [
  { id: "operacional", label: "Operacional" },
  { id: "comercial", label: "Comercial" },
  { id: "administrativo", label: "Administrativo" },
  { id: "financeiro", label: "Financeiro" },
];

const SWOT_SECTORS = [
  { id: "general", label: "Geral" },
  { id: "comercial", label: "Comercial" },
  { id: "operacional", label: "Operacional" },
  { id: "financeiro", label: "Financeiro" },
  { id: "rh", label: "Recursos Humanos" },
];

const INDUSTRY_TEMPLATES: Record<string, { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }> = {
  tecnologia: {
    strengths: ["Inovação e desenvolvimento ágil", "Equipe técnica qualificada", "Escalabilidade de soluções", "Cultura de aprendizado contínuo"],
    weaknesses: ["Alta rotatividade de talentos", "Dependência de tecnologias específicas", "Custos elevados de P&D", "Documentação técnica deficiente"],
    opportunities: ["Transformação digital do mercado", "Novos nichos e verticais", "Parcerias estratégicas", "Expansão internacional"],
    threats: ["Concorrência global intensa", "Mudanças tecnológicas rápidas", "Regulamentações de dados (LGPD)", "Ataques cibernéticos"],
  },
  varejo: {
    strengths: ["Localização privilegiada", "Conhecimento do cliente local", "Variedade de produtos", "Atendimento personalizado"],
    weaknesses: ["Margens reduzidas", "Gestão de estoque complexa", "Sazonalidade de vendas", "Alto custo de aluguel"],
    opportunities: ["E-commerce e omnichannel", "Programas de fidelidade", "Novos canais de venda", "Parcerias com influenciadores"],
    threats: ["Concorrência online", "Mudanças de hábitos de consumo", "Flutuações econômicas", "Aumento de custos logísticos"],
  },
  servicos: {
    strengths: ["Expertise especializada", "Relacionamento com clientes", "Flexibilidade de entrega", "Baixo investimento inicial"],
    weaknesses: ["Dependência de pessoas-chave", "Dificuldade de escalar", "Precificação subjetiva", "Gestão de expectativas"],
    opportunities: ["Digitalização de serviços", "Novos modelos de assinatura", "Expansão de portfólio", "Certificações e especializações"],
    threats: ["Commoditização de serviços", "Novos entrantes", "Automação de processos", "Pressão por redução de preços"],
  },
  manufatura: {
    strengths: ["Capacidade produtiva instalada", "Controle de qualidade", "Economia de escala", "Expertise técnica"],
    weaknesses: ["Alto custo fixo", "Obsolescência de equipamentos", "Dependência de fornecedores", "Lead time extenso"],
    opportunities: ["Indústria 4.0 e IoT", "Novos mercados de exportação", "Sustentabilidade e ESG", "Customização em massa"],
    threats: ["Importação de produtos mais baratos", "Volatilidade de matérias-primas", "Regulamentações ambientais", "Escassez de mão de obra qualificada"],
  },
  saude: {
    strengths: ["Profissionais qualificados", "Infraestrutura especializada", "Credibilidade institucional", "Demanda constante"],
    weaknesses: ["Custos operacionais elevados", "Burocracia regulatória", "Gestão de agenda complexa", "Alta dependência de convênios"],
    opportunities: ["Telemedicina e saúde digital", "Turismo médico", "Novos tratamentos e tecnologias", "Programas preventivos"],
    threats: ["Mudanças em planos de saúde", "Judicialização", "Novas regulamentações ANVISA", "Concorrência de grandes redes"],
  },
};

const MODULE_HELP: Record<string, { title: string; description: string; tips: string[] }> = {
  canvas: {
    title: "Canvas BMC Expandido",
    description: "Diagnóstico estratégico em múltiplos níveis evolutivos para análise completa do modelo de negócio.",
    tips: [
      "Use os níveis Atual e Sistêmico para diagnóstico estratégico",
      "Cada bloco tem perguntas diagnósticas para avaliação de maturidade",
      "A maturidade geral mostra o progresso do diagnóstico",
    ],
  },
  swot: {
    title: "Análise SWOT",
    description: "Metodologia estratégica para analisar Forças, Fraquezas, Oportunidades e Ameaças do negócio.",
    tips: [
      "Use templates por indústria para acelerar sua análise",
      "Cruze forças com oportunidades para criar estratégias ofensivas (SO)",
      "Identifique ameaças que podem explorar suas fraquezas (WT)",
    ],
  },
  pdca: {
    title: "Ciclo PDCA",
    description: "Metodologia de melhoria contínua em 4 fases: Planejar (Plan), Executar (Do), Verificar (Check), Agir (Act).",
    tips: [
      "Defina métricas claras na fase Plan",
      "Documente aprendizados na fase Check",
      "Use Act para padronizar melhorias que funcionaram",
    ],
  },
  processes: {
    title: "Mapeamento de Processos",
    description: "Documentação detalhada dos processos de negócio, incluindo entradas, saídas e pontos de dor.",
    tips: [
      "Identifique os processos críticos primeiro",
      "Documente os pain points para priorizar melhorias",
      "Defina responsáveis claros para cada etapa",
    ],
  },
};

const statusColors: Record<string, string> = {
  backlog: "bg-gray-100 text-gray-800",
  diagnostico: "bg-blue-100 text-blue-800",
  andamento: "bg-yellow-100 text-yellow-800",
  revisao: "bg-purple-100 text-purple-800",
  concluido: "bg-green-100 text-green-800",
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  prospect: "bg-blue-100 text-blue-800",
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-purple-100 text-purple-800",
  converted: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
  open: "bg-blue-100 text-blue-800",
  won: "bg-green-100 text-green-800",
};

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  diagnostico: "Diagnóstico",
  andamento: "Em Andamento",
  revisao: "Revisão",
  concluido: "Concluído",
  active: "Ativo",
  inactive: "Inativo",
  prospect: "Prospecto",
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  converted: "Convertido",
  lost: "Perdido",
  open: "Aberta",
  won: "Ganha",
};

export default function ProcessCompass() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [projectDetailTab, setProjectDetailTab] = useState("overview");
  const [activeValuationSubTab, setActiveValuationSubTab] = useState("overview");
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [showNewTenantDialog, setShowNewTenantDialog] = useState(false);
  const [showNewProcessDialog, setShowNewProcessDialog] = useState(false);
  const [showNewSwotDialog, setShowNewSwotDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedCanvasLevel, setSelectedCanvasLevel] = useState("atual");
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);
  const [processView, setProcessView] = useState<"steps" | "diagram">("steps");
  const [selectedSwotId, setSelectedSwotId] = useState<number | null>(null);
  const [editingBlock, setEditingBlock] = useState<PcCanvasBlock | null>(null);
  const [canvasDialogTab, setCanvasDialogTab] = useState("content");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newOutputText, setNewOutputText] = useState("");
  const [newProcessCategory, setNewProcessCategory] = useState("");
  const [newSwotSector, setNewSwotSector] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedIndustryTemplate, setSelectedIndustryTemplate] = useState<string | null>(null);
  const [showModuleHelp, setShowModuleHelp] = useState<string | null>(null);
  const [showNewPdcaDialog, setShowNewPdcaDialog] = useState(false);
  const [showNewRequirementDialog, setShowNewRequirementDialog] = useState(false);
  const [newReqTitle, setNewReqTitle] = useState("");
  const [newReqDescription, setNewReqDescription] = useState("");
  const [newReqType, setNewReqType] = useState("functional");
  const [newReqPriority, setNewReqPriority] = useState("medium");
  const [showValuationProjectDialog, setShowValuationProjectDialog] = useState(false);
  const [showEditProjectDialog, setShowEditProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<PcProject | null>(null);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<PcProject | null>(null);
  const [selectedPdcaId, setSelectedPdcaId] = useState<number | null>(null);
  const [editingSwotItem, setEditingSwotItem] = useState<PcSwotItem | null>(null);
  const [swotItemEditTab, setSwotItemEditTab] = useState("details");
  const [swotPdcaStatus, setSwotPdcaStatus] = useState("plan");
  const [pdcaPhaseFilter, setPdcaPhaseFilter] = useState<string>("all");
  const [pdcaSourceFilter, setPdcaSourceFilter] = useState<string>("all");
  const [showReportConfigModal, setShowReportConfigModal] = useState(false);
  const [showProcessDiagramDialog, setShowProcessDiagramDialog] = useState(false);
  const [diagramProcessId, setDiagramProcessId] = useState<number | null>(null);
  const [showTeamMemberDialog, setShowTeamMemberDialog] = useState(false);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showFileUploadDialog, setShowFileUploadDialog] = useState(false);
  const [projectHistoryContent, setProjectHistoryContent] = useState("");
  const [historyIsSaving, setHistoryIsSaving] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [showReportEditorDialog, setShowReportEditorDialog] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [reportContent, setReportContent] = useState("");
  const [reportName, setReportName] = useState("");
  const [reportIsSaving, setReportIsSaving] = useState(false);
  const [reportConfigTemplate, setReportConfigTemplate] = useState("full_diagnostic");
  const [reportConfigSections, setReportConfigSections] = useState<string[]>([
    "project_info", "history", "canvas_atual", "swot", "processes", "pdca", "tasks", "requirements"
  ]);
  const queryClient = useQueryClient();

  const REPORT_SECTIONS = [
    { id: "project_info", label: "Informações do Projeto", description: "Dados básicos do projeto e cliente", icon: "building" },
    { id: "history", label: "História do Projeto", description: "Contexto, evolução e documentação do projeto", icon: "book" },
    { id: "canvas_atual", label: "Canvas BMC - Atual", description: "Business Model Canvas nível Atual (Intenção)", icon: "layout" },
    { id: "canvas_sistemico", label: "Canvas BMC - Sistêmico", description: "Business Model Canvas nível Sistêmico", icon: "layout" },
    { id: "swot", label: "Análise SWOT", description: "Forças, Fraquezas, Oportunidades e Ameaças", icon: "grid" },
    { id: "processes", label: "Processos", description: "Mapeamento de processos de negócio", icon: "workflow" },
    { id: "pdca", label: "Plano PDCA Consolidado", description: "Ciclos de melhoria contínua", icon: "refresh" },
    { id: "deliverables", label: "Entregas", description: "Entregáveis e marcos do projeto", icon: "package" },
    { id: "tasks", label: "Tarefas", description: "Atividades e responsáveis", icon: "check" },
    { id: "requirements", label: "Requisitos ERP", description: "Requisitos de aderência ao ERP", icon: "database" },
  ];

  const toggleReportSection = (sectionId: string) => {
    setReportConfigSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  const { data: stats, isLoading: statsLoading } = useQuery<CompassStats>({
    queryKey: ["/api/compass/stats"],
  });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/compass/tenants"],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<PcClient[]>({
    queryKey: ["/api/compass/clients"],
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<PcProject[]>({
    queryKey: ["/api/compass/projects"],
  });

  const { data: canvasBlocks = [] } = useQuery<PcCanvasBlock[]>({
    queryKey: ["/api/compass/projects", selectedProjectId, "canvas"],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/canvas`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: canvasQuestions = [] } = useQuery<PcCanvasQuestion[]>({
    queryKey: ["/api/compass/canvas", editingBlock?.id, "questions"],
    queryFn: async () => {
      if (!editingBlock?.id) return [];
      const res = await fetch(`/api/compass/canvas/${editingBlock.id}/questions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!editingBlock?.id,
  });

  const { data: canvasOutputs = [] } = useQuery<PcCanvasExpectedOutput[]>({
    queryKey: ["/api/compass/canvas", editingBlock?.id, "outputs"],
    queryFn: async () => {
      if (!editingBlock?.id) return [];
      const res = await fetch(`/api/compass/canvas/${editingBlock.id}/outputs`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!editingBlock?.id,
  });

  const { data: canvasPdcaLinks = [] } = useQuery<PcCanvasPdcaLink[]>({
    queryKey: ["/api/compass/canvas", editingBlock?.id, "pdca"],
    queryFn: async () => {
      if (!editingBlock?.id) return [];
      const res = await fetch(`/api/compass/canvas/${editingBlock.id}/pdca`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!editingBlock?.id,
  });

  const { data: canvasSwotLinks = [] } = useQuery<PcCanvasSwotLink[]>({
    queryKey: ["/api/compass/canvas", editingBlock?.id, "swot"],
    queryFn: async () => {
      if (!editingBlock?.id) return [];
      const res = await fetch(`/api/compass/canvas/${editingBlock.id}/swot`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!editingBlock?.id,
  });

  const { data: processes = [] } = useQuery<PcProcess[]>({
    queryKey: ["/api/compass/projects", selectedProjectId, "processes"],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/processes`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: processSteps = [] } = useQuery<PcProcessStep[]>({
    queryKey: ["/api/compass/processes", selectedProcessId, "steps"],
    queryFn: async () => {
      if (!selectedProcessId) return [];
      const res = await fetch(`/api/compass/processes/${selectedProcessId}/steps`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProcessId,
  });

  const { data: swotAnalyses = [] } = useQuery<PcSwotAnalysis[]>({
    queryKey: ["/api/compass/projects", selectedProjectId, "swot"],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/swot`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: swotItems = [] } = useQuery<PcSwotItem[]>({
    queryKey: ["/api/compass/swot", selectedSwotId, "items"],
    queryFn: async () => {
      if (!selectedSwotId) return [];
      const res = await fetch(`/api/compass/swot/${selectedSwotId}/items`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSwotId,
  });

  const { data: pdcaCycles = [] } = useQuery<PcPdcaCycle[]>({
    queryKey: ["/api/compass/pdca", selectedProjectId],
    queryFn: async () => {
      const url = selectedProjectId 
        ? `/api/compass/pdca?projectId=${selectedProjectId}` 
        : `/api/compass/pdca`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: pdcaOverview } = useQuery<PdcaOverview>({
    queryKey: ["/api/compass/pdca/overview", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return { items: [], stats: { canvas: { total: 0, plan: 0, do: 0, check: 0, act: 0, done: 0 }, processes: { total: 0, plan: 0, do: 0, check: 0, act: 0, done: 0 }, swot: { total: 0, plan: 0, do: 0, check: 0, act: 0, done: 0 }, requirements: { total: 0, plan: 0, do: 0, check: 0, act: 0, done: 0 } } };
      const res = await fetch(`/api/compass/pdca/overview/${selectedProjectId}`, { credentials: "include" });
      if (!res.ok) return { items: [], stats: { canvas: { total: 0, plan: 0, do: 0, check: 0, act: 0, done: 0 }, processes: { total: 0, plan: 0, do: 0, check: 0, act: 0, done: 0 }, swot: { total: 0, plan: 0, do: 0, check: 0, act: 0, done: 0 }, requirements: { total: 0, plan: 0, do: 0, check: 0, act: 0, done: 0 } } };
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  // Valuation-specific queries for the integrated tab
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  
  const { data: valuationSectorAnalysis } = useQuery<any>({
    queryKey: ["/api/valuation/projects", selectedProjectId, "sector-analysis"],
    queryFn: async () => {
      const res = await fetch(`/api/valuation/projects/${selectedProjectId}/sector-analysis`);
      return res.json();
    },
    enabled: !!selectedProjectId && selectedProject?.projectType === "valuation",
  });

  const { data: valuationChecklist = [] } = useQuery<any[]>({
    queryKey: ["/api/valuation/projects", selectedProjectId, "checklist"],
    queryFn: async () => {
      const res = await fetch(`/api/valuation/projects/${selectedProjectId}/checklist`);
      return res.json();
    },
    enabled: !!selectedProjectId && selectedProject?.projectType === "valuation",
  });

  const { data: valuationCanvasBlocks = [] } = useQuery<any[]>({
    queryKey: ["/api/valuation/projects", selectedProjectId, "valuation-canvas"],
    queryFn: async () => {
      const res = await fetch(`/api/valuation/projects/${selectedProjectId}/canvas`);
      return res.json();
    },
    enabled: !!selectedProjectId && selectedProject?.projectType === "valuation",
  });

  const { data: generatedReports = [] } = useQuery<any[]>({
    queryKey: ["/api/compass/generated-reports", selectedProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/compass/generated-reports?projectId=${selectedProjectId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: projectTeamMembers = [] } = useQuery<PcTeamMember[]>({
    queryKey: ["/api/compass/projects", selectedProjectId, "team"],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/team`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: projectTasks = [] } = useQuery<PcProjectTask[]>({
    queryKey: ["/api/compass/projects", selectedProjectId, "tasks"],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/tasks`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: projectFiles = [] } = useQuery<PcProjectFile[]>({
    queryKey: ["/api/compass/projects", selectedProjectId, "files"],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/files`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: projectHistory } = useQuery<PcProjectHistory>({
    queryKey: ["/api/compass/projects", selectedProjectId, "history"],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/history`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  useEffect(() => {
    if (projectHistory?.content) {
      setProjectHistoryContent(projectHistory.content);
    } else {
      setProjectHistoryContent("");
    }
  }, [projectHistory]);

  const generateReportMutation = useMutation({
    mutationFn: async ({ projectId, name, templateType, format, sections }: { projectId: number; name: string; templateType: string; format: string; sections?: string[] }) => {
      const res = await fetch("/api/compass/generated-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, name, reportType: templateType, format, status: "pending", sections }),
      });
      if (!res.ok) throw new Error("Falha ao criar relatório");
      const report = await res.json();
      const generateRes = await fetch(`/api/compass/generated-reports/${report.id}/generate`, {
        method: "POST",
        credentials: "include",
      });
      return generateRes.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/generated-reports"] });
      toast.success("Relatório gerado com sucesso!");
      if (data && data.content) {
        setEditingReport(data);
        setReportName(data.name || "");
        setReportContent(data.content || "");
        setShowReportEditorDialog(true);
      }
    },
    onError: () => {
      toast.error("Erro ao gerar relatório");
    },
  });

  const handleQuickReport = (templateType: string) => {
    if (!selectedProjectId) return;
    const templateNames: Record<string, string> = {
      executive_summary: "Sumário Executivo",
      full_diagnostic: "Diagnóstico Completo",
      swot_report: "Análise SWOT",
    };
    const project = projects.find(p => p.id === selectedProjectId);
    const reportName = `${templateNames[templateType] || templateType} - ${project?.name || "Projeto"}`;
    generateReportMutation.mutate({ projectId: selectedProjectId, name: reportName, templateType, format: "pdf" });
  };

  const openReportEditor = async (report: any) => {
    setEditingReport(report);
    setReportName(report.name || "");
    setReportContent(report.content || "");
    setShowReportEditorDialog(true);
  };

  const saveReportContent = async () => {
    if (!editingReport) return;
    setReportIsSaving(true);
    try {
      const res = await fetch(`/api/compass/generated-reports/${editingReport.id}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: reportContent, name: reportName }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      queryClient.invalidateQueries({ queryKey: ["/api/compass/generated-reports"] });
      toast.success("Relatório salvo com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar relatório");
    } finally {
      setReportIsSaving(false);
    }
  };

  const exportReportAsPDF = async () => {
    if (!reportContent) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${reportName}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; }
            }
            body { font-family: 'Segoe UI', Arial, sans-serif; }
          </style>
        </head>
        <body>${reportContent}</body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const initializeValuationChecklistMutation = useMutation({
    mutationFn: async () => {
      const segment = selectedProject?.name?.includes("Indústria") ? "industry" : 
                     selectedProject?.name?.includes("Serviços") ? "services" : 
                     selectedProject?.name?.includes("Varejo") ? "retail" : 
                     selectedProject?.name?.includes("Tecnologia") ? "technology" : "general";
      const res = await fetch(`/api/valuation/projects/${selectedProjectId}/checklist/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ segment }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuation/projects", selectedProjectId, "checklist"] });
    },
  });

  const VALUATION_CANVAS_BLOCKS = [
    { id: "customer_segments", label: "Segmentos de Clientes", description: "Para quem criamos valor?" },
    { id: "value_proposition", label: "Proposta de Valor", description: "Que valor entregamos?" },
    { id: "channels", label: "Canais", description: "Como alcançamos nossos clientes?" },
    { id: "customer_relationships", label: "Relacionamento", description: "Como nos relacionamos?" },
    { id: "revenue_streams", label: "Fontes de Receita", description: "Como geramos receita?" },
    { id: "key_resources", label: "Recursos Principais", description: "Quais recursos são essenciais?" },
    { id: "key_activities", label: "Atividades Principais", description: "O que fazemos de mais importante?" },
    { id: "key_partnerships", label: "Parcerias Principais", description: "Quem são nossos parceiros?" },
    { id: "cost_structure", label: "Estrutura de Custos", description: "Quais são nossos custos?" },
  ];

  const getValuationBlockData = (blockType: string) => {
    if (!Array.isArray(valuationCanvasBlocks)) return undefined;
    return valuationCanvasBlocks.find((b: any) => b.blockType === blockType);
  };

  const getValuationScoreLevel = (score: number) => {
    if (score >= 80) return { label: "Excelente", color: "text-emerald-600" };
    if (score >= 60) return { label: "Bom", color: "text-blue-600" };
    if (score >= 40) return { label: "Intermediário", color: "text-yellow-600" };
    return { label: "Inicial", color: "text-red-600" };
  };
  
  const { data: pdcaActions = [] } = useQuery<PcPdcaAction[]>({
    queryKey: ["/api/compass/pdca", selectedPdcaId, "actions"],
    queryFn: async () => {
      if (!selectedPdcaId) return [];
      const res = await fetch(`/api/compass/pdca/${selectedPdcaId}/actions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPdcaId,
  });

  const { data: requirements = [] } = useQuery<PcRequirement[]>({
    queryKey: ["/api/compass/requirements", selectedProjectId],
    queryFn: async () => {
      const url = selectedProjectId 
        ? `/api/compass/requirements?projectId=${selectedProjectId}` 
        : `/api/compass/requirements`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: { name: string; slug?: string }) => {
      const res = await fetch("/api/compass/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar organização");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compass/stats"] });
      setShowNewTenantDialog(false);
    },
  });

  const { data: crmPartners = [] } = useQuery<any[]>({
    queryKey: ["/api/crm/partners"],
    queryFn: async () => {
      const res = await fetch("/api/crm/partners", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar cliente");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compass/stats"] });
      setShowNewClientDialog(false);
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; clientId: number; description?: string; status?: string; projectType?: string }) => {
      const res = await fetch("/api/compass/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar projeto");
      return res.json();
    },
    onSuccess: (createdProject: PcProject) => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compass/stats"] });
      setShowNewProjectDialog(false);
      setSelectedProjectId(createdProject.id);
      setProjectDetailTab("overview");
      setActiveTab("project-detail");
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: { id: number; name?: string; description?: string; status?: string }) => {
      const res = await fetch(`/api/compass/projects/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao atualizar projeto");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects"] });
      toast.success("Projeto atualizado com sucesso");
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const res = await fetch(`/api/compass/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao excluir projeto");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compass/stats"] });
      toast.success("Projeto excluído com sucesso");
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: { name: string; email?: string; phone?: string; company?: string; source?: string }) => {
      const res = await fetch("/api/compass/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compass/stats"] });
      setShowNewLeadDialog(false);
    },
  });

  const upsertCanvasBlockMutation = useMutation({
    mutationFn: async (data: { id?: number; blockType: string; level: string; title?: string; content?: string; notes?: string; score?: number; synthesis?: string }) => {
      if (data.id) {
        const res = await fetch(`/api/compass/canvas/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Falha ao atualizar bloco");
        return res.json();
      } else {
        const res = await fetch(`/api/compass/projects/${selectedProjectId}/canvas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Falha ao criar bloco");
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "canvas"] });
      setEditingBlock(null);
    },
  });

  const addCanvasQuestionMutation = useMutation({
    mutationFn: async (data: { question: string; orderIndex: number }) => {
      if (!editingBlock?.id) throw new Error("Bloco não selecionado");
      const res = await fetch(`/api/compass/canvas/${editingBlock.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar pergunta");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/canvas", editingBlock?.id, "questions"] });
      setNewQuestionText("");
    },
  });

  const updateCanvasQuestionMutation = useMutation({
    mutationFn: async (data: { id: number; answer?: string; score?: number }) => {
      const res = await fetch(`/api/compass/canvas/questions/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: data.answer, score: data.score }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao atualizar pergunta");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/canvas", editingBlock?.id, "questions"] });
    },
  });

  const deleteCanvasQuestionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/compass/canvas/questions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao excluir pergunta");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/canvas", editingBlock?.id, "questions"] });
    },
  });

  const addCanvasOutputMutation = useMutation({
    mutationFn: async (data: { description: string; orderIndex: number }) => {
      if (!editingBlock?.id) throw new Error("Bloco não selecionado");
      const res = await fetch(`/api/compass/canvas/${editingBlock.id}/outputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar saída");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/canvas", editingBlock?.id, "outputs"] });
      setNewOutputText("");
    },
  });

  const deleteCanvasOutputMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/compass/canvas/outputs/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao excluir saída");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/canvas", editingBlock?.id, "outputs"] });
    },
  });

  const addTeamMemberMutation = useMutation({
    mutationFn: async (data: { name: string; email?: string; role: string }) => {
      if (!selectedProjectId) throw new Error("Projeto não selecionado");
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao adicionar membro");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "team"] });
      setShowTeamMemberDialog(false);
      toast.success("Membro adicionado com sucesso");
    },
    onError: () => {
      toast.error("Erro ao adicionar membro");
    },
  });

  const removeTeamMemberMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/compass/team/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao remover membro");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "team"] });
      toast.success("Membro removido");
    },
  });

  const addProjectTaskMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; priority: string; assignedTo?: string; dueDate?: string }) => {
      if (!selectedProjectId) throw new Error("Projeto não selecionado");
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar tarefa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "tasks"] });
      setShowNewTaskDialog(false);
      toast.success("Tarefa criada com sucesso");
    },
    onError: () => {
      toast.error("Erro ao criar tarefa");
    },
  });

  const updateProjectTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PcProjectTask> }) => {
      const res = await fetch(`/api/compass/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao atualizar tarefa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "tasks"] });
    },
  });

  const uploadProjectFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedProjectId) throw new Error("Projeto não selecionado");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao fazer upload");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "files"] });
      setShowFileUploadDialog(false);
      toast.success("Arquivo enviado com sucesso");
    },
    onError: () => {
      toast.error("Erro ao enviar arquivo");
    },
  });

  const deleteProjectFileMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/compass/files/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao excluir arquivo");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "files"] });
      toast.success("Arquivo excluído");
    },
  });

  const saveProjectHistoryMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedProjectId) throw new Error("Projeto não selecionado");
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/history`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao salvar histórico");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "history"] });
      toast.success("Histórico salvo com sucesso");
      setHistoryIsSaving(false);
    },
    onError: () => {
      toast.error("Erro ao salvar histórico");
      setHistoryIsSaving(false);
    },
  });

  const createProcessMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; category?: string; owner?: string }) => {
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/processes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar processo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "processes"] });
      setShowNewProcessDialog(false);
    },
  });

  const createSwotAnalysisMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; sector?: string }) => {
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/swot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar análise SWOT");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "swot"] });
      setShowNewSwotDialog(false);
    },
  });

  const createSwotItemMutation = useMutation({
    mutationFn: async (data: { type: string; description: string; impact?: string; actionPlan?: string }) => {
      const res = await fetch(`/api/compass/swot/${selectedSwotId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar item SWOT");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/swot", selectedSwotId, "items"] });
    },
  });

  const updateSwotItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PcSwotItem> }) => {
      const res = await fetch(`/api/compass/swot-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao atualizar item SWOT");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/swot", selectedSwotId, "items"] });
      setEditingSwotItem(null);
      toast.success("Item SWOT atualizado com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteSwotItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/compass/swot-items/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao excluir item SWOT");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/swot", selectedSwotId, "items"] });
      toast.success("Item SWOT excluído com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const createPdcaCycleMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; projectId?: number; priority?: string }) => {
      const res = await fetch("/api/compass/pdca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar ciclo PDCA");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/pdca"] });
      setShowNewPdcaDialog(false);
    },
  });

  const createPdcaActionMutation = useMutation({
    mutationFn: async (data: { phase: string; title: string; description?: string; responsible?: string }) => {
      const res = await fetch(`/api/compass/pdca/${selectedPdcaId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar ação PDCA");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/pdca", selectedPdcaId, "actions"] });
    },
  });

  const createRequirementMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; type?: string; priority?: string; projectId?: number }) => {
      const res = await fetch("/api/compass/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar requisito");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/requirements"] });
      setShowNewRequirementDialog(false);
      setNewReqTitle("");
      setNewReqDescription("");
      setNewReqType("functional");
      setNewReqPriority("medium");
    },
  });

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.clients || 0}</div>
            <p className="text-xs text-muted-foreground">clientes cadastrados</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              Projetos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.projects || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.activeProjects || 0} em andamento</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.leads || 0}</div>
            <p className="text-xs text-muted-foreground">leads no funil</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.opportunities || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.openOpportunities || 0} abertas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Projetos Recentes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab("projects")}>
              Ver todos <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderKanban className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum projeto ainda</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => setShowNewProjectDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Criar Projeto
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.slice(0, 5).map(project => (
                  <div 
                    key={project.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" 
                    data-testid={`project-item-${project.id}`}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setProjectDetailTab("overview");
                      setActiveTab("project-detail");
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{project.name}</p>
                        {project.projectType && project.projectType !== "consultoria" && (
                          <Badge variant="outline" className={
                            project.projectType === "valuation" ? "border-emerald-500 text-emerald-600" :
                            project.projectType === "programacao" ? "border-purple-500 text-purple-600" : ""
                          }>
                            {project.projectType === "valuation" ? "Valuation" : 
                             project.projectType === "programacao" ? "Dev" : project.projectType}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {clients.find(c => c.id === project.clientId)?.name || "Cliente"}
                      </p>
                    </div>
                    <Badge className={statusColors[project.status] || "bg-gray-100"}>
                      {statusLabels[project.status] || project.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">CRM e Vendas</CardTitle>
            <a href="/crm">
              <Button variant="ghost" size="sm">
                Abrir CRM <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </a>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Gerencie leads, oportunidades e clientes</p>
              <a href="/crm">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                >
                  <ExternalLink className="h-4 w-4 mr-1" /> Acessar Arcádia CRM
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Links Section */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-indigo-600" />
            Integrações e Ferramentas
          </CardTitle>
          <CardDescription>Acesse módulos complementares do Arcádia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a href="/insights" className="block p-4 bg-white rounded-lg border hover:shadow-md transition-shadow group" data-testid="link-insights">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-blue-600 transition-colors">Arcádia Insights</p>
                  <p className="text-xs text-muted-foreground">Dashboards e análises BI</p>
                </div>
              </div>
            </a>
            <a href="/" className="block p-4 bg-white rounded-lg border hover:shadow-md transition-shadow group" data-testid="link-erp">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <Network className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-green-600 transition-colors">Conexões ERP</p>
                  <p className="text-xs text-muted-foreground">Integrações de sistemas</p>
                </div>
              </div>
            </a>
            <a href="/agent" className="block p-4 bg-white rounded-lg border hover:shadow-md transition-shadow group" data-testid="link-agent">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-amber-600 transition-colors">Arcádia Agent</p>
                  <p className="text-xs text-muted-foreground">Assistente IA empresarial</p>
                </div>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      {tenants.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Configure sua Organização</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Para começar a usar o Process Compass, você precisa criar uma organização (consultoria) primeiro.
            </p>
            <Button onClick={() => setShowNewTenantDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Criar Organização
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderClients = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar clientes..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="search-clients"
          />
        </div>
        <Button onClick={() => setShowNewClientDialog(true)} data-testid="btn-new-client">
          <Plus className="h-4 w-4 mr-2" /> Novo Cliente
        </Button>
      </div>

      {clientsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum cliente encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm ? "Tente uma busca diferente" : "Adicione seu primeiro cliente para começar"}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowNewClientDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar Cliente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => (
            <Card key={client.id} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`client-card-${client.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{client.name}</CardTitle>
                      {client.company && (
                        <CardDescription>{client.company}</CardDescription>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" /> Ver Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {client.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.industry && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      <span>{client.industry}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <Badge className={statusColors[client.status] || "bg-gray-100"}>
                    {statusLabels[client.status] || client.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {projects.filter(p => p.clientId === client.id).length} projetos
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderProjects = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar projetos..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="search-projects"
          />
        </div>
        <Button onClick={() => setShowNewProjectDialog(true)} disabled={clients.length === 0} data-testid="btn-new-project">
          <Plus className="h-4 w-4 mr-2" /> Novo Projeto
        </Button>
      </div>

      {projectsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum projeto encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              {clients.length === 0 
                ? "Adicione um cliente primeiro para criar projetos"
                : searchTerm ? "Tente uma busca diferente" : "Crie seu primeiro projeto de consultoria"}
            </p>
            {clients.length > 0 && !searchTerm && (
              <Button onClick={() => setShowNewProjectDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Criar Projeto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map(project => {
            const client = clients.find(c => c.id === project.clientId);
            return (
              <Card 
                key={project.id} 
                className="hover:shadow-md transition-shadow cursor-pointer" 
                data-testid={`project-card-${project.id}`}
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setProjectDetailTab("overview");
                  setActiveTab("project-detail");
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FolderKanban className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{project.name}</h3>
                          {project.projectType && project.projectType !== "consultoria" && (
                            <Badge variant="outline" className={
                              project.projectType === "valuation" ? "border-emerald-500 text-emerald-600" :
                              project.projectType === "programacao" ? "border-purple-500 text-purple-600" : ""
                            }>
                              {project.projectType === "valuation" ? "Valuation" : 
                               project.projectType === "programacao" ? "Dev" : project.projectType}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {client?.name || "Cliente"}
                        </p>
                        {project.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[project.status] || "bg-gray-100"}>
                        {statusLabels[project.status] || project.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => { setSelectedProjectId(project.id); setActiveTab("canvas"); }}>
                            <Target className="h-4 w-4 mr-2" /> Canvas
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedProjectId(project.id); setActiveTab("processes"); }}>
                            <Network className="h-4 w-4 mr-2" /> Processos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedProjectId(project.id); setActiveTab("swot"); }}>
                            <Layers className="h-4 w-4 mr-2" /> SWOT
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedProjectId(project.id); setActiveTab("pdca"); }}>
                            <RefreshCw className="h-4 w-4 mr-2" /> PDCA
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setEditingProject(project); setShowEditProjectDialog(true); }}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => { setProjectToDelete(project); setShowDeleteProjectConfirm(true); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {(project.startDate || project.dueDate) && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
                      {project.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Início: {new Date(project.startDate).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {project.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Prazo: {new Date(project.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderProjectDetail = () => {
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return null;
    const client = clients.find(c => c.id === project.clientId);
    const projectCanvasBlocks = canvasBlocks.filter(b => b.projectId === selectedProjectId);
    const projectProcesses = processes.filter(p => p.projectId === selectedProjectId);
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => { setActiveTab("projects"); setSelectedProjectId(null); }}
              data-testid="btn-back-projects"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <Badge className={statusColors[project.status] || "bg-gray-100"}>
                  {statusLabels[project.status] || project.status}
                </Badge>
                {project.projectType && project.projectType !== "consultoria" && (
                  <Badge variant="outline" className={
                    project.projectType === "valuation" ? "border-emerald-500 text-emerald-600" :
                    project.projectType === "programacao" ? "border-purple-500 text-purple-600" : ""
                  }>
                    {project.projectType === "valuation" ? "Valuation" : 
                     project.projectType === "programacao" ? "Dev" : project.projectType}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3" />
                {client?.name || "Cliente"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { setEditingProject(project); setShowEditProjectDialog(true); }}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
            <Button onClick={() => setProjectDetailTab("canvas")}>
              <Target className="h-4 w-4 mr-2" /> Abrir Canvas
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projectCanvasBlocks.length}</p>
                <p className="text-sm text-muted-foreground">Blocos Canvas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Network className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projectProcesses.length}</p>
                <p className="text-sm text-muted-foreground">Processos</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Tarefas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-lg font-medium">{project.dueDate ? new Date(project.dueDate).toLocaleDateString('pt-BR') : "Sem prazo"}</p>
                <p className="text-sm text-muted-foreground">Data limite</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={projectDetailTab} onValueChange={setProjectDetailTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="history">História</TabsTrigger>
            <TabsTrigger value="team">Equipe</TabsTrigger>
            <TabsTrigger value="canvas">Canvas</TabsTrigger>
            <TabsTrigger value="processes">Processos</TabsTrigger>
            <TabsTrigger value="tasks">Tarefas</TabsTrigger>
            <TabsTrigger value="files">Arquivos</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
            {project.projectType === "valuation" && (
              <TabsTrigger value="valuation">Valuation</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Sobre o Projeto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Descrição</Label>
                  <p className="mt-1">{project.description || "Nenhuma descrição adicionada"}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Data de Início</Label>
                    <p className="mt-1">{project.startDate ? new Date(project.startDate).toLocaleDateString('pt-BR') : "Não definida"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Data Limite</Label>
                    <p className="mt-1">{project.dueDate ? new Date(project.dueDate).toLocaleDateString('pt-BR') : "Não definida"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>História do Projeto</CardTitle>
                <Button 
                  onClick={() => {
                    setHistoryIsSaving(true);
                    saveProjectHistoryMutation.mutate(projectHistoryContent);
                  }}
                  disabled={historyIsSaving}
                  data-testid="btn-save-history"
                >
                  {historyIsSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Documente a história, evolução e decisões importantes do projeto. Use formatação rica, adicione imagens, links e vídeos.
                </p>
                <RichTextEditor
                  content={projectHistoryContent}
                  onChange={setProjectHistoryContent}
                  placeholder="Escreva a história do projeto aqui..."
                  className="min-h-[300px]"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Equipe do Projeto</CardTitle>
                <Button onClick={() => setShowTeamMemberDialog(true)} data-testid="btn-add-team-member">
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Membro
                </Button>
              </CardHeader>
              <CardContent>
                {projectTeamMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Nenhum membro na equipe</h3>
                    <p className="text-muted-foreground text-center">Adicione membros para gerenciar a equipe do projeto</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectTeamMembers.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`team-member-${member.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.email && (
                            <span className="text-sm text-muted-foreground">{member.email}</span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTeamMemberMutation.mutate(member.id)}
                            data-testid={`btn-remove-member-${member.id}`}
                          >
                            <UserX className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="canvas" className="mt-4">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {CANVAS_LEVELS.map(level => (
                  <Button
                    key={level.id}
                    variant={selectedCanvasLevel === level.id ? "default" : "outline"}
                    onClick={() => setSelectedCanvasLevel(level.id)}
                    className="flex-1 min-w-[120px]"
                    data-testid={`btn-level-${level.id}`}
                  >
                    <div className="text-center">
                      <div className="font-medium text-sm">{level.label}</div>
                      <div className="text-xs opacity-70 hidden sm:block">{level.description}</div>
                    </div>
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {CANVAS_BLOCK_TYPES.map(blockType => {
                  const block = projectCanvasBlocks.find(b => b.blockType === blockType.id && b.level === selectedCanvasLevel);
                  return (
                    <Card 
                      key={blockType.id} 
                      className={`cursor-pointer hover:shadow-md transition-shadow border-2 ${blockType.color}`}
                      onClick={() => {
                        if (block) {
                          setEditingBlock(block);
                        } else {
                          setEditingBlock({ id: 0, projectId: selectedProjectId!, blockType: blockType.id, level: selectedCanvasLevel, title: null, content: null, notes: null, score: 0, synthesis: null });
                        }
                      }}
                      data-testid={`canvas-block-${blockType.id}`}
                    >
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm">{blockType.label}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        {block ? (
                          <div className="space-y-1">
                            {block.title && <p className="font-medium text-sm">{block.title}</p>}
                            <p className="text-xs text-muted-foreground line-clamp-3">{block.content || "Clique para adicionar"}</p>
                            <div className="flex items-center gap-1 mt-2">
                              <div className="h-1 flex-1 bg-gray-200 rounded">
                                <div className="h-1 bg-primary rounded" style={{ width: `${block.score}%` }} />
                              </div>
                              <span className="text-xs">{block.score}%</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Clique para adicionar</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="processes" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Processos</CardTitle>
                <Button onClick={() => setShowNewProcessDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Novo Processo
                </Button>
              </CardHeader>
              <CardContent>
                {projectProcesses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Network className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Nenhum processo mapeado</h3>
                    <p className="text-muted-foreground text-center">Comece a mapear os processos do projeto</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectProcesses.map(process => (
                      <Card key={process.id} className="p-4" data-testid={`card-process-${process.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{process.name}</p>
                            <p className="text-sm text-muted-foreground">{process.category || "Sem categoria"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>{process.status}</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDiagramProcessId(process.id);
                                setShowProcessDiagramDialog(true);
                              }}
                              data-testid={`btn-diagram-${process.id}`}
                            >
                              <Network className="h-4 w-4 mr-1" /> Diagrama
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Tarefas</CardTitle>
                <Button onClick={() => setShowNewTaskDialog(true)} data-testid="btn-new-task">
                  <Plus className="h-4 w-4 mr-2" /> Nova Tarefa
                </Button>
              </CardHeader>
              <CardContent>
                {projectTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Nenhuma tarefa</h3>
                    <p className="text-muted-foreground text-center">Adicione tarefas para acompanhar o progresso</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectTasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`task-${task.id}`}>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={task.status === "completed"}
                            onCheckedChange={(checked) => {
                              updateProjectTaskMutation.mutate({
                                id: task.id,
                                data: { status: checked ? "completed" : "pending" }
                              });
                            }}
                            data-testid={`checkbox-task-${task.id}`}
                          />
                          <div>
                            <p className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-sm text-muted-foreground">{task.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={task.priority === "high" ? "destructive" : task.priority === "medium" ? "default" : "secondary"}>
                            {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Média" : "Baixa"}
                          </Badge>
                          {task.assignedTo && (
                            <span className="text-sm text-muted-foreground">{task.assignedTo}</span>
                          )}
                          {task.dueDate && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Arquivos</CardTitle>
                <label>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        uploadProjectFileMutation.mutate(file);
                      }
                    }}
                    data-testid="input-file-upload"
                  />
                  <Button asChild>
                    <span>
                      {uploadProjectFileMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload
                    </span>
                  </Button>
                </label>
              </CardHeader>
              <CardContent>
                {projectFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Nenhum arquivo</h3>
                    <p className="text-muted-foreground text-center">Faça upload de arquivos relacionados ao projeto</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`file-${file.id}`}>
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{file.originalName}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB - {new Date(file.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => window.open(file.url, '_blank')} data-testid={`btn-download-${file.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteProjectFileMutation.mutate(file.id)}
                            data-testid={`btn-delete-file-${file.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Relatórios do Projeto</CardTitle>
                  <Button onClick={() => setShowReportConfigModal(true)} data-testid="btn-new-report">
                    <Plus className="h-4 w-4 mr-2" /> Gerar Relatório
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card className="p-4 cursor-pointer hover:border-primary transition-colors" onClick={() => handleQuickReport("executive_summary")}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Sumário Executivo</p>
                          <p className="text-xs text-muted-foreground">Visão geral rápida</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4 cursor-pointer hover:border-primary transition-colors" onClick={() => handleQuickReport("full_diagnostic")}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <ClipboardList className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Diagnóstico Completo</p>
                          <p className="text-xs text-muted-foreground">Todos os dados</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4 cursor-pointer hover:border-primary transition-colors" onClick={() => handleQuickReport("swot_report")}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <LayoutGrid className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">Análise SWOT</p>
                          <p className="text-xs text-muted-foreground">Forças e fraquezas</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                  
                  <h4 className="font-medium mb-3">Relatórios Gerados</h4>
                  {!generatedReports?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum relatório gerado ainda</p>
                      <p className="text-sm">Clique em "Gerar Relatório" para criar um novo</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {generatedReports.map((report: any) => (
                        <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{report.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(report.createdAt).toLocaleDateString('pt-BR')} - {report.format?.toUpperCase()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {report.status === "completed" && report.fileUrl && (
                              <Button variant="outline" size="sm" onClick={() => window.open(report.fileUrl, '_blank')}>
                                <Download className="h-4 w-4 mr-1" /> Baixar
                              </Button>
                            )}
                            {report.status === "generating" && (
                              <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando...</Badge>
                            )}
                            {report.status === "failed" && (
                              <Badge variant="destructive">Falhou</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {project.projectType === "valuation" && (
            <TabsContent value="valuation" className="mt-4">
              <div className="space-y-4">
                <Tabs value={activeValuationSubTab} onValueChange={setActiveValuationSubTab}>
                  <TabsList className="flex-wrap">
                    <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                    <TabsTrigger value="checklist">Checklist</TabsTrigger>
                    <TabsTrigger value="sector">Análise Setorial</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="p-4">
                        <p className="text-sm text-muted-foreground">Checklist</p>
                        <p className="text-2xl font-bold">
                          {Array.isArray(valuationChecklist) ? valuationChecklist.filter((c: any) => c.status === "completed").length : 0}/{Array.isArray(valuationChecklist) ? valuationChecklist.length : 0}
                        </p>
                        <p className="text-xs text-muted-foreground">itens completos</p>
                      </Card>
                      <Card className="p-4">
                        <p className="text-sm text-muted-foreground">Score Setorial</p>
                        <p className="text-2xl font-bold">{valuationSectorAnalysis?.latest?.overallScore || "--"}%</p>
                        <p className="text-xs text-muted-foreground">
                          {valuationSectorAnalysis?.latest?.overallScore 
                            ? getValuationScoreLevel(valuationSectorAnalysis.latest.overallScore).label 
                            : "Não calculado"}
                        </p>
                      </Card>
                      <Card className="p-4 cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/canvas")}>
                        <p className="text-sm text-muted-foreground">Canvas</p>
                        <p className="text-2xl font-bold text-primary">Abrir</p>
                        <p className="text-xs text-muted-foreground">Módulo Centralizado</p>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="checklist" className="mt-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Checklist de Coleta de Dados</CardTitle>
                        {(!Array.isArray(valuationChecklist) || valuationChecklist.length === 0) && (
                          <Button 
                            onClick={() => initializeValuationChecklistMutation.mutate()}
                            disabled={initializeValuationChecklistMutation.isPending}
                            data-testid="btn-initialize-valuation-checklist"
                          >
                            {initializeValuationChecklistMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4 mr-2" />
                            )}
                            Inicializar Checklist
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent>
                        {!Array.isArray(valuationChecklist) || valuationChecklist.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12">
                            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">Clique em "Inicializar Checklist" para começar</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                              <div className="flex-1">
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Progresso</span>
                                  <span>{valuationChecklist.filter((c: any) => c.status === "completed").length} de {valuationChecklist.length}</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full">
                                  <div 
                                    className="h-2 bg-primary rounded-full transition-all"
                                    style={{ width: `${(valuationChecklist.filter((c: any) => c.status === "completed").length / valuationChecklist.length) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="sector" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Análise Setorial</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {valuationSectorAnalysis?.latest ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="h-24 w-24 rounded-full border-4 border-primary flex items-center justify-center">
                                <span className="text-2xl font-bold">{valuationSectorAnalysis.latest.overallScore}%</span>
                              </div>
                              <div>
                                <p className="font-medium">{getValuationScoreLevel(valuationSectorAnalysis.latest.overallScore).label}</p>
                                <p className="text-sm text-muted-foreground">Score geral da análise setorial</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12">
                            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">Análise setorial não realizada</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  </Tabs>

                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <Button onClick={() => { setActiveTab("valuation"); }} variant="outline" className="w-full">
                      <TrendingUp className="h-4 w-4 mr-2" /> Abrir Módulo Valuation Completo
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    );
  };

  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const renderSidebar = () => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between px-3 py-2 mb-4">
        <div className="flex items-center gap-2">
          <Compass className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Process Compass</span>
        </div>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <Button
        variant={activeTab === "dashboard" ? "secondary" : "ghost"}
        className="w-full justify-start"
        onClick={() => handleNavClick("dashboard")}
        data-testid="nav-dashboard"
      >
        <LayoutDashboard className="h-4 w-4 mr-2" />
        Dashboard
      </Button>
      
      <Button
        variant={activeTab === "clients" ? "secondary" : "ghost"}
        className="w-full justify-start"
        onClick={() => handleNavClick("clients")}
        data-testid="nav-clients"
      >
        <Users className="h-4 w-4 mr-2" />
        Clientes
      </Button>
      
      <Button
        variant={activeTab === "projects" ? "secondary" : "ghost"}
        className="w-full justify-start"
        onClick={() => handleNavClick("projects")}
        data-testid="nav-projects"
      >
        <FolderKanban className="h-4 w-4 mr-2" />
        Projetos
      </Button>
      
      <div className="pt-4 border-t mt-4">
        <p className="px-3 text-xs font-medium text-muted-foreground mb-2">FERRAMENTAS</p>
        <Button
          variant={activeTab === "canvas" ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => handleNavClick("canvas")}
          data-testid="nav-canvas"
        >
          <Target className="h-4 w-4 mr-2" />
          Canvas
        </Button>
        <Button
          variant={activeTab === "processes" ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => handleNavClick("processes")}
          data-testid="nav-processes"
        >
          <Network className="h-4 w-4 mr-2" />
          Processos
        </Button>
        <Button
          variant={activeTab === "swot" ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => handleNavClick("swot")}
          data-testid="nav-swot"
        >
          <Layers className="h-4 w-4 mr-2" />
          SWOT
        </Button>
        <Button
          variant={activeTab === "pdca" ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => handleNavClick("pdca")}
          data-testid="nav-pdca"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          PDCA
        </Button>
        <Button
          variant={activeTab === "requirements" ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => handleNavClick("requirements")}
          data-testid="nav-requirements"
        >
          <FileCheck className="h-4 w-4 mr-2" />
          Requisitos
        </Button>
        <Button
          variant={activeTab === "valuation" ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => handleNavClick("valuation")}
          data-testid="nav-valuation"
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Valuation
        </Button>
      </div>
      
      <div className="pt-4 border-t mt-4">
        <Button
          variant={activeTab === "settings" ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => handleNavClick("settings")}
          data-testid="nav-settings"
        >
          <Settings className="h-4 w-4 mr-2" />
          Configurações
        </Button>
      </div>
    </div>
  );

  return (
    <BrowserFrame>
      <div className="flex h-full bg-background relative">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden" 
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar - hidden on mobile, slide-in when open */}
        <div className={`
          fixed md:relative inset-y-0 left-0 z-50
          w-64 border-r bg-background md:bg-muted/30 
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          {renderSidebar()}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Mobile header */}
          <div className="md:hidden flex items-center gap-3 p-4 border-b">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} data-testid="btn-mobile-menu">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              <span className="font-semibold">Process Compass</span>
            </div>
          </div>
          
          <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-background min-h-full">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "clients" && renderClients()}
          {activeTab === "projects" && renderProjects()}
          {activeTab === "project-detail" && renderProjectDetail()}
          {activeTab === "canvas" && (
            <TooltipProvider>
            <div className="space-y-4">
              <Alert className="bg-blue-50 border-blue-200">
                <Lightbulb className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Dica:</strong> {MODULE_HELP.canvas.tips[0]}
                </AlertDescription>
              </Alert>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold">Canvas de Diagnóstico</h2>
                    <p className="text-sm md:text-base text-muted-foreground">Business Model Canvas expandido</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold">{MODULE_HELP.canvas.title}</p>
                      <p className="text-sm">{MODULE_HELP.canvas.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => navigate("/canvas")} data-testid="btn-open-canvas-module">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Módulo Canvas
                  </Button>
                  <Select value={selectedProjectId?.toString() || ""} onValueChange={(v) => setSelectedProjectId(v ? parseInt(v) : null)}>
                    <SelectTrigger className="w-full md:w-64" data-testid="select-project-canvas">
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!selectedProjectId ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Target className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Selecione um Projeto</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      Escolha um projeto acima para acessar o Business Model Canvas.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {CANVAS_LEVELS.map(level => (
                      <Button
                        key={level.id}
                        variant={selectedCanvasLevel === level.id ? "default" : "outline"}
                        onClick={() => setSelectedCanvasLevel(level.id)}
                        className="flex-1 min-w-[120px]"
                        data-testid={`btn-level-${level.id}`}
                      >
                        <div className="text-center">
                          <div className="font-medium text-sm">{level.label}</div>
                          <div className="text-xs opacity-70 hidden sm:block">{level.description}</div>
                        </div>
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {CANVAS_BLOCK_TYPES.map(blockType => {
                      const block = canvasBlocks.find(b => b.blockType === blockType.id && b.level === selectedCanvasLevel);
                      return (
                        <Card 
                          key={blockType.id} 
                          className={`cursor-pointer hover:shadow-md transition-shadow border-2 ${blockType.color}`}
                          onClick={() => {
                            if (block) {
                              setEditingBlock(block);
                            } else {
                              setEditingBlock({ id: 0, projectId: selectedProjectId, blockType: blockType.id, level: selectedCanvasLevel, title: null, content: null, notes: null, score: 0, synthesis: null });
                            }
                          }}
                          data-testid={`canvas-block-${blockType.id}`}
                        >
                          <CardHeader className="p-3 pb-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {block ? (
                                  block.score > 70 ? (
                                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                      <CheckCircle className="h-3 w-3 text-green-600" />
                                    </div>
                                  ) : block.score > 30 ? (
                                    <div className="w-5 h-5 rounded-full bg-yellow-100 flex items-center justify-center">
                                      <AlertCircle className="h-3 w-3 text-yellow-600" />
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                      <AlertCircle className="h-3 w-3 text-red-600" />
                                    </div>
                                  )
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                                    <AlertCircle className="h-3 w-3 text-gray-400" />
                                  </div>
                                )}
                                <CardTitle className="text-sm">{blockType.label}</CardTitle>
                              </div>
                              {block && (block as any).questionsCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {(block as any).answeredCount || 0}/{(block as any).questionsCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{blockType.description || ""}</p>
                          </CardHeader>
                          <CardContent className="p-3 pt-0">
                            {block ? (
                              <div className="space-y-1">
                                {block.title && <p className="font-medium text-sm">{block.title}</p>}
                                <p className="text-xs text-muted-foreground line-clamp-2">{block.content || "Clique para adicionar"}</p>
                                <div className="flex items-center gap-1 mt-2">
                                  <div className="h-1.5 flex-1 bg-gray-200 rounded">
                                    <div 
                                      className={`h-1.5 rounded transition-all ${
                                        block.score > 70 ? "bg-green-500" : 
                                        block.score > 30 ? "bg-yellow-500" : "bg-red-500"
                                      }`} 
                                      style={{ width: `${block.score}%` }} 
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Clique para adicionar</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}

              <Dialog open={!!editingBlock} onOpenChange={(open) => { 
                if (!open) { 
                  setEditingBlock(null); 
                  setCanvasDialogTab("content");
                  setNewQuestionText("");
                  setNewOutputText("");
                } 
              }}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      {CANVAS_BLOCK_TYPES.find(b => b.id === editingBlock?.blockType)?.label} - {CANVAS_LEVELS.find(l => l.id === editingBlock?.level)?.label}
                    </DialogTitle>
                  </DialogHeader>

                  {(() => {
                    const questionsWithScores = canvasQuestions.filter(q => q.score !== null);
                    const avgScore = questionsWithScores.length > 0 
                      ? Math.round(questionsWithScores.reduce((sum, q) => sum + (q.score || 0), 0) / questionsWithScores.length * 10)
                      : 0;
                    return (
                      <div className="flex items-center gap-4 px-1 py-2 border-b">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-1">Maturidade ({questionsWithScores.length}/{canvasQuestions.length} perguntas)</div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 bg-gray-200 rounded">
                              <div className="h-2 bg-primary rounded transition-all" style={{ width: `${avgScore}%` }} />
                            </div>
                            <span className="text-sm font-medium w-10">{avgScore}%</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Saídas</div>
                          <span className="text-sm font-medium">{canvasOutputs.filter(o => o.completed).length}/{canvasOutputs.length}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <Tabs value={canvasDialogTab} onValueChange={setCanvasDialogTab} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="content">Conteúdo</TabsTrigger>
                      <TabsTrigger value="questions">Diagnóstico ({canvasQuestions.length})</TabsTrigger>
                      <TabsTrigger value="outputs">Saídas ({canvasOutputs.length})</TabsTrigger>
                    </TabsList>

                    <ScrollArea className="flex-1 pr-4">
                      <TabsContent value="content" className="mt-4 space-y-4">
                        <form id="canvas-block-form" onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          upsertCanvasBlockMutation.mutate({
                            id: editingBlock?.id || undefined,
                            blockType: editingBlock?.blockType || "",
                            level: editingBlock?.level || "",
                            title: formData.get("title") as string,
                            content: formData.get("content") as string,
                            notes: formData.get("notes") as string,
                            synthesis: formData.get("synthesis") as string,
                            score: parseInt(formData.get("score") as string) || 0,
                          });
                        }}>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="block-title">Título</Label>
                              <Input id="block-title" name="title" defaultValue={editingBlock?.title || ""} placeholder="Título do bloco" data-testid="input-block-title" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="block-content">Descrição</Label>
                              <Textarea id="block-content" name="content" defaultValue={editingBlock?.content || ""} placeholder="Descreva este elemento do canvas..." rows={4} data-testid="input-block-content" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="block-synthesis" className="flex items-center gap-2">
                                Síntese Diagnóstica
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Resumo consolidado das descobertas e análises para este bloco</p>
                                  </TooltipContent>
                                </Tooltip>
                              </Label>
                              <Textarea id="block-synthesis" name="synthesis" defaultValue={editingBlock?.synthesis || ""} placeholder="Síntese das análises e descobertas..." rows={3} data-testid="input-block-synthesis" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="block-notes">Notas Adicionais</Label>
                              <Textarea id="block-notes" name="notes" defaultValue={editingBlock?.notes || ""} placeholder="Observações..." rows={2} data-testid="input-block-notes" />
                            </div>
                            <input type="hidden" name="score" value={(() => {
                              const questionsWithScores = canvasQuestions.filter(q => q.score !== null);
                              return questionsWithScores.length > 0 
                                ? Math.round(questionsWithScores.reduce((sum, q) => sum + (q.score || 0), 0) / questionsWithScores.length * 10)
                                : editingBlock?.score || 0;
                            })()} />
                          </div>
                        </form>
                      </TabsContent>

                      <TabsContent value="questions" className="mt-4 space-y-4">
                        {!editingBlock?.id ? (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Salve o bloco primeiro para adicionar perguntas diagnósticas.
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <>
                            <div className="flex gap-2">
                              <Input 
                                placeholder="Nova pergunta diagnóstica..." 
                                value={newQuestionText}
                                onChange={(e) => setNewQuestionText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && newQuestionText.trim()) {
                                    e.preventDefault();
                                    addCanvasQuestionMutation.mutate({ 
                                      question: newQuestionText.trim(), 
                                      orderIndex: canvasQuestions.length 
                                    });
                                  }
                                }}
                                data-testid="input-new-question"
                              />
                              <Button 
                                type="button" 
                                disabled={!newQuestionText.trim() || addCanvasQuestionMutation.isPending}
                                onClick={() => {
                                  if (newQuestionText.trim()) {
                                    addCanvasQuestionMutation.mutate({ 
                                      question: newQuestionText.trim(), 
                                      orderIndex: canvasQuestions.length 
                                    });
                                  }
                                }}
                              >
                                {addCanvasQuestionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              </Button>
                            </div>

                            {canvasQuestions.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>Nenhuma pergunta diagnóstica cadastrada</p>
                                <p className="text-sm">Adicione perguntas para avaliar este bloco</p>
                              </div>
                            ) : (
                              <Accordion type="multiple" className="space-y-2">
                                {canvasQuestions.map((question, idx) => (
                                  <AccordionItem key={question.id} value={`q-${question.id}`} className="border rounded-lg px-3">
                                    <AccordionTrigger className="py-3 hover:no-underline">
                                      <div className="flex items-center gap-3 flex-1 text-left">
                                        <span className="text-muted-foreground text-sm font-normal">{idx + 1}.</span>
                                        <span className="flex-1 text-sm">{question.question}</span>
                                        <Badge variant={question.score !== null ? "default" : "outline"} className="mr-2">
                                          {question.score !== null ? `${question.score}/10` : "—"}
                                        </Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-3 space-y-3">
                                      <div className="space-y-2">
                                        <Label className="text-xs">Resposta / Observações</Label>
                                        <Textarea 
                                          key={`answer-${question.id}-${question.answer || ''}`}
                                          placeholder="Responda ou faça observações sobre esta pergunta..."
                                          defaultValue={question.answer || ""}
                                          rows={2}
                                          onBlur={(e) => {
                                            if (e.target.value !== (question.answer || "")) {
                                              updateCanvasQuestionMutation.mutate({ id: question.id, answer: e.target.value });
                                            }
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Pontuação (0-10)</Label>
                                        <div className="flex items-center gap-3">
                                          <Slider
                                            value={[question.score ?? 0]}
                                            onValueChange={([value]) => {
                                              updateCanvasQuestionMutation.mutate({ id: question.id, score: value });
                                            }}
                                            max={10}
                                            step={1}
                                            className="flex-1"
                                          />
                                          <span className="w-8 text-center font-medium">{question.score ?? 0}</span>
                                        </div>
                                      </div>
                                      <div className="flex justify-end">
                                        <Button 
                                          type="button" 
                                          variant="ghost" 
                                          size="sm" 
                                          className="text-destructive hover:text-destructive"
                                          onClick={() => deleteCanvasQuestionMutation.mutate(question.id)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                                        </Button>
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            )}
                          </>
                        )}
                      </TabsContent>

                      <TabsContent value="outputs" className="mt-4 space-y-4">
                        {!editingBlock?.id ? (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Salve o bloco primeiro para adicionar saídas esperadas.
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <>
                            <div className="flex gap-2">
                              <Input 
                                placeholder="Nova saída esperada..." 
                                value={newOutputText}
                                onChange={(e) => setNewOutputText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && newOutputText.trim()) {
                                    e.preventDefault();
                                    addCanvasOutputMutation.mutate({ 
                                      description: newOutputText.trim(), 
                                      orderIndex: canvasOutputs.length 
                                    });
                                  }
                                }}
                                data-testid="input-new-output"
                              />
                              <Button 
                                type="button" 
                                disabled={!newOutputText.trim() || addCanvasOutputMutation.isPending}
                                onClick={() => {
                                  if (newOutputText.trim()) {
                                    addCanvasOutputMutation.mutate({ 
                                      description: newOutputText.trim(), 
                                      orderIndex: canvasOutputs.length 
                                    });
                                  }
                                }}
                              >
                                {addCanvasOutputMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              </Button>
                            </div>

                            {canvasOutputs.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <FileCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>Nenhuma saída esperada cadastrada</p>
                                <p className="text-sm">Defina os entregáveis para este bloco</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {canvasOutputs.map((output) => (
                                  <div key={output.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                                    <Checkbox 
                                      checked={output.completed}
                                      disabled
                                    />
                                    <span className={`flex-1 text-sm ${output.completed ? 'line-through text-muted-foreground' : ''}`}>
                                      {output.description}
                                    </span>
                                    <Button 
                                      type="button" 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => deleteCanvasOutputMutation.mutate(output.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </TabsContent>
                    </ScrollArea>
                  </Tabs>

                  <DialogFooter className="border-t pt-4 mt-4">
                    <Button type="button" variant="outline" onClick={() => setEditingBlock(null)}>Fechar</Button>
                    <Button type="submit" form="canvas-block-form" disabled={upsertCanvasBlockMutation.isPending} data-testid="btn-save-block">
                      {upsertCanvasBlockMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar Bloco
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            </TooltipProvider>
          )}
          {activeTab === "processes" && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">Mapeamento de Processos</h2>
                  <p className="text-sm md:text-base text-muted-foreground">Mapeie os processos de negócio</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Select value={selectedProjectId?.toString() || ""} onValueChange={(v) => { setSelectedProjectId(v ? parseInt(v) : null); setSelectedProcessId(null); }}>
                    <SelectTrigger className="w-full md:w-64" data-testid="select-project-processes">
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProjectId && (
                    <Button onClick={() => setShowNewProcessDialog(true)} data-testid="btn-new-process">
                      <Plus className="h-4 w-4 mr-2" /> Novo Processo
                    </Button>
                  )}
                </div>
              </div>

              {!selectedProjectId ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Network className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Selecione um Projeto</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      Escolha um projeto acima para mapear seus processos.
                    </p>
                  </CardContent>
                </Card>
              ) : processes.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Network className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Nenhum processo mapeado</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-4">
                      Comece mapeando os processos de negócio deste cliente.
                    </p>
                    <Button onClick={() => setShowNewProcessDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Criar Primeiro Processo
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="col-span-1 space-y-2">
                    <h3 className="font-semibold text-sm text-muted-foreground mb-2">PROCESSOS</h3>
                    {processes.map(process => (
                      <Card 
                        key={process.id} 
                        className={`cursor-pointer hover:shadow-md transition-shadow ${selectedProcessId === process.id ? 'ring-2 ring-primary' : ''}`}
                        onClick={() => setSelectedProcessId(process.id)}
                        data-testid={`process-card-${process.id}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{process.name}</p>
                              <p className="text-xs text-muted-foreground">{PROCESS_CATEGORIES.find(c => c.id === process.category)?.label || process.category}</p>
                            </div>
                            <Badge variant="outline">{process.status}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="col-span-2">
                    {selectedProcessId ? (
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>{processes.find(p => p.id === selectedProcessId)?.name}</CardTitle>
                              <CardDescription>{processes.find(p => p.id === selectedProcessId)?.description}</CardDescription>
                            </div>
                            <div className="flex items-center border rounded-lg overflow-hidden">
                              <button
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${processView === "steps" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => setProcessView("steps")}
                                data-testid="btn-view-steps"
                              >
                                Etapas
                              </button>
                              <button
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${processView === "diagram" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => setProcessView("diagram")}
                                data-testid="btn-view-diagram"
                              >
                                Diagrama BPMN
                              </button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {processView === "steps" ? (
                            <>
                              <h4 className="font-semibold mb-3">Etapas do Processo</h4>
                              {processSteps.length === 0 ? (
                                <p className="text-muted-foreground text-sm">Nenhuma etapa cadastrada ainda.</p>
                              ) : (
                                <div className="space-y-2">
                                  {processSteps.sort((a, b) => a.order - b.order).map((step, idx) => (
                                    <div key={step.id} className="flex items-start gap-3 p-3 border rounded-lg">
                                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-medium text-sm">
                                        {idx + 1}
                                      </div>
                                      <div className="flex-1">
                                        <p className="font-medium">{step.name}</p>
                                        {step.description && <p className="text-sm text-muted-foreground">{step.description}</p>}
                                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                          {step.responsible && <span>Responsável: {step.responsible}</span>}
                                          {step.duration && <span>Duração: {step.duration}</span>}
                                        </div>
                                        {step.painPoints && (
                                          <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                                            <strong>Ponto de dor:</strong> {step.painPoints}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="h-[500px]">
                              <BpmnDiagram
                                processName={processes.find(p => p.id === selectedProcessId)?.name}
                                onSave={(data) => {
                                  console.log("BPMN saved:", data);
                                }}
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="border-dashed h-full">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                          <ClipboardList className="h-12 w-12 text-muted-foreground mb-3" />
                          <p className="text-muted-foreground">Selecione um processo para ver detalhes</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              </div>
          )}
          {activeTab === "swot" && (
            <TooltipProvider>
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <Lightbulb className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Dica:</strong> {MODULE_HELP.swot.tips[0]}
                </AlertDescription>
              </Alert>
              
              {/* Industry Templates Selector */}
              <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-purple-600" />
                    Templates por Indústria
                  </CardTitle>
                  <CardDescription>Selecione um setor para ver sugestões de análise SWOT</CardDescription>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(INDUSTRY_TEMPLATES).map(industry => (
                      <Button
                        key={industry}
                        variant={selectedIndustryTemplate === industry ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedIndustryTemplate(selectedIndustryTemplate === industry ? null : industry)}
                        data-testid={`btn-template-${industry}`}
                      >
                        {industry.charAt(0).toUpperCase() + industry.slice(1)}
                      </Button>
                    ))}
                  </div>
                  {selectedIndustryTemplate && INDUSTRY_TEMPLATES[selectedIndustryTemplate] && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-2 bg-green-100 rounded">
                        <strong className="text-green-800">Forças:</strong>
                        <ul className="mt-1 space-y-1">
                          {INDUSTRY_TEMPLATES[selectedIndustryTemplate].strengths.slice(0, 2).map((s, i) => (
                            <li key={i} className="text-green-700">• {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-2 bg-red-100 rounded">
                        <strong className="text-red-800">Fraquezas:</strong>
                        <ul className="mt-1 space-y-1">
                          {INDUSTRY_TEMPLATES[selectedIndustryTemplate].weaknesses.slice(0, 2).map((s, i) => (
                            <li key={i} className="text-red-700">• {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-2 bg-blue-100 rounded">
                        <strong className="text-blue-800">Oportunidades:</strong>
                        <ul className="mt-1 space-y-1">
                          {INDUSTRY_TEMPLATES[selectedIndustryTemplate].opportunities.slice(0, 2).map((s, i) => (
                            <li key={i} className="text-blue-700">• {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-2 bg-orange-100 rounded">
                        <strong className="text-orange-800">Ameaças:</strong>
                        <ul className="mt-1 space-y-1">
                          {INDUSTRY_TEMPLATES[selectedIndustryTemplate].threats.slice(0, 2).map((s, i) => (
                            <li key={i} className="text-orange-700">• {s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold">Análise SWOT</h2>
                    <p className="text-sm md:text-base text-muted-foreground">Análises SWOT setoriais</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold">{MODULE_HELP.swot.title}</p>
                      <p className="text-sm">{MODULE_HELP.swot.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Select value={selectedProjectId?.toString() || ""} onValueChange={(v) => { setSelectedProjectId(v ? parseInt(v) : null); setSelectedSwotId(null); }}>
                    <SelectTrigger className="w-full md:w-64" data-testid="select-project-swot">
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProjectId && (
                    <Button onClick={() => setShowNewSwotDialog(true)} data-testid="btn-new-swot">
                      <Plus className="h-4 w-4 mr-2" /> Nova Análise
                    </Button>
                  )}
                </div>
              </div>

              {!selectedProjectId ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Layers className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Selecione um Projeto</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      Escolha um projeto acima para realizar análises SWOT.
                    </p>
                  </CardContent>
                </Card>
              ) : swotAnalyses.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Layers className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Nenhuma análise SWOT</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-4">
                      Crie análises SWOT para diferentes setores do negócio.
                    </p>
                    <Button onClick={() => setShowNewSwotDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Criar Primeira Análise
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    {swotAnalyses.map(analysis => (
                      <Button
                        key={analysis.id}
                        variant={selectedSwotId === analysis.id ? "default" : "outline"}
                        onClick={() => setSelectedSwotId(analysis.id)}
                        data-testid={`swot-tab-${analysis.id}`}
                      >
                        {analysis.name}
                        <Badge variant="secondary" className="ml-2">
                          {SWOT_SECTORS.find(s => s.id === analysis.sector)?.label || analysis.sector}
                        </Badge>
                      </Button>
                    ))}
                  </div>

                  {selectedSwotId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="bg-green-50 border-green-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-green-800 flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" />
                            Forças
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {swotItems.filter(i => i.type === "strength").map(item => (
                              <div 
                                key={item.id} 
                                className="p-2 bg-white rounded border cursor-pointer hover:bg-green-100 transition-colors" 
                                data-testid={`swot-item-${item.id}`}
                                onClick={() => { setEditingSwotItem(item); setSwotItemEditTab("details"); setSwotPdcaStatus(item.pdcaStatus || "plan"); }}
                              >
                                <p className="text-sm font-medium">{item.title || item.description}</p>
                                {item.title && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs">{item.priorityLevel || "média"}</Badge>
                                  {item.impactScore && <Badge variant="secondary" className="text-xs">Impacto: {item.impactScore}/5</Badge>}
                                  {item.pdcaStatus && item.pdcaStatus !== "plan" && (
                                    <Badge className="text-xs bg-blue-100 text-blue-800">PDCA: {item.pdcaStatus}</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                            <Button variant="ghost" size="sm" className="w-full" onClick={() => createSwotItemMutation.mutate({ type: "strength", description: "Nova força", impact: "medium" })}>
                              <Plus className="h-4 w-4 mr-1" /> Adicionar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-red-50 border-red-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-red-800 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Fraquezas
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {swotItems.filter(i => i.type === "weakness").map(item => (
                              <div 
                                key={item.id} 
                                className="p-2 bg-white rounded border cursor-pointer hover:bg-red-100 transition-colors" 
                                data-testid={`swot-item-${item.id}`}
                                onClick={() => { setEditingSwotItem(item); setSwotItemEditTab("details"); setSwotPdcaStatus(item.pdcaStatus || "plan"); }}
                              >
                                <p className="text-sm font-medium">{item.title || item.description}</p>
                                {item.title && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs">{item.priorityLevel || "média"}</Badge>
                                  {item.impactScore && <Badge variant="secondary" className="text-xs">Impacto: {item.impactScore}/5</Badge>}
                                  {item.pdcaStatus && item.pdcaStatus !== "plan" && (
                                    <Badge className="text-xs bg-blue-100 text-blue-800">PDCA: {item.pdcaStatus}</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                            <Button variant="ghost" size="sm" className="w-full" onClick={() => createSwotItemMutation.mutate({ type: "weakness", description: "Nova fraqueza", impact: "medium" })}>
                              <Plus className="h-4 w-4 mr-1" /> Adicionar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-blue-50 border-blue-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-blue-800 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Oportunidades
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {swotItems.filter(i => i.type === "opportunity").map(item => (
                              <div 
                                key={item.id} 
                                className="p-2 bg-white rounded border cursor-pointer hover:bg-blue-100 transition-colors" 
                                data-testid={`swot-item-${item.id}`}
                                onClick={() => { setEditingSwotItem(item); setSwotItemEditTab("details"); setSwotPdcaStatus(item.pdcaStatus || "plan"); }}
                              >
                                <p className="text-sm font-medium">{item.title || item.description}</p>
                                {item.title && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs">{item.priorityLevel || "média"}</Badge>
                                  {item.impactScore && <Badge variant="secondary" className="text-xs">Impacto: {item.impactScore}/5</Badge>}
                                  {item.pdcaStatus && item.pdcaStatus !== "plan" && (
                                    <Badge className="text-xs bg-blue-100 text-blue-800">PDCA: {item.pdcaStatus}</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                            <Button variant="ghost" size="sm" className="w-full" onClick={() => createSwotItemMutation.mutate({ type: "opportunity", description: "Nova oportunidade", impact: "medium" })}>
                              <Plus className="h-4 w-4 mr-1" /> Adicionar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-yellow-50 border-yellow-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-yellow-800 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Ameaças
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {swotItems.filter(i => i.type === "threat").map(item => (
                              <div 
                                key={item.id} 
                                className="p-2 bg-white rounded border cursor-pointer hover:bg-yellow-100 transition-colors" 
                                data-testid={`swot-item-${item.id}`}
                                onClick={() => { setEditingSwotItem(item); setSwotItemEditTab("details"); setSwotPdcaStatus(item.pdcaStatus || "plan"); }}
                              >
                                <p className="text-sm font-medium">{item.title || item.description}</p>
                                {item.title && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs">{item.priorityLevel || "média"}</Badge>
                                  {item.impactScore && <Badge variant="secondary" className="text-xs">Impacto: {item.impactScore}/5</Badge>}
                                  {item.pdcaStatus && item.pdcaStatus !== "plan" && (
                                    <Badge className="text-xs bg-blue-100 text-blue-800">PDCA: {item.pdcaStatus}</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                            <Button variant="ghost" size="sm" className="w-full" onClick={() => createSwotItemMutation.mutate({ type: "threat", description: "Nova ameaça", impact: "medium" })}>
                              <Plus className="h-4 w-4 mr-1" /> Adicionar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}

              <Dialog open={showNewSwotDialog} onOpenChange={(open) => { setShowNewSwotDialog(open); if (!open) setNewSwotSector(""); }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Análise SWOT</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    createSwotAnalysisMutation.mutate({
                      name: formData.get("name") as string,
                      description: formData.get("description") as string,
                      sector: newSwotSector || undefined,
                    });
                  }}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="swot-name">Nome da Análise</Label>
                        <Input id="swot-name" name="name" required placeholder="Ex: Análise Comercial Q1" data-testid="input-swot-name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="swot-description">Descrição</Label>
                        <Textarea id="swot-description" name="description" placeholder="Descreva o contexto desta análise..." data-testid="input-swot-description" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="swot-sector">Setor</Label>
                        <Select value={newSwotSector} onValueChange={setNewSwotSector}>
                          <SelectTrigger data-testid="select-swot-sector">
                            <SelectValue placeholder="Selecione um setor" />
                          </SelectTrigger>
                          <SelectContent>
                            {SWOT_SECTORS.map(sector => (
                              <SelectItem key={sector.id} value={sector.id}>{sector.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowNewSwotDialog(false)}>Cancelar</Button>
                      <Button type="submit" disabled={createSwotAnalysisMutation.isPending} data-testid="btn-submit-swot">
                        {createSwotAnalysisMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Criar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={!!editingSwotItem} onOpenChange={(open) => { if (!open) setEditingSwotItem(null); }}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Edit className="h-5 w-5" />
                      Editar Item SWOT
                      {editingSwotItem && (
                        <Badge variant="outline" className="ml-2">
                          {editingSwotItem.type === "strength" ? "Força" :
                           editingSwotItem.type === "weakness" ? "Fraqueza" :
                           editingSwotItem.type === "opportunity" ? "Oportunidade" : "Ameaça"}
                        </Badge>
                      )}
                    </DialogTitle>
                  </DialogHeader>
                  {editingSwotItem && (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const impactScoreVal = parseInt(formData.get("impactScore") as string) || 3;
                      const impactMap: Record<number, string> = { 1: "low", 2: "low", 3: "medium", 4: "high", 5: "high" };
                      updateSwotItemMutation.mutate({
                        id: editingSwotItem.id,
                        data: {
                          title: formData.get("title") as string || null,
                          description: formData.get("description") as string,
                          impact: impactMap[impactScoreVal] || "medium",
                          priorityLevel: formData.get("priorityLevel") as string,
                          impactScore: impactScoreVal,
                          actionPlan: formData.get("actionPlan") as string || null,
                          result: formData.get("result") as string || null,
                          pdcaStatus: formData.get("pdcaStatus") as string,
                          responsible: formData.get("responsible") as string || null,
                        },
                      });
                    }}>
                      <Tabs value={swotItemEditTab} onValueChange={setSwotItemEditTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                          <TabsTrigger value="details" data-testid="tab-swot-details">
                            <FileText className="h-4 w-4 mr-2" />
                            Detalhes
                          </TabsTrigger>
                          <TabsTrigger value="pdca" data-testid="tab-swot-pdca">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Ciclo PDCA
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="details" className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="swot-item-title">Título</Label>
                            <Input 
                              id="swot-item-title" 
                              name="title" 
                              defaultValue={editingSwotItem.title || ""} 
                              placeholder="Título curto do item"
                              data-testid="input-swot-item-title"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="swot-item-description">Descrição *</Label>
                            <Textarea 
                              id="swot-item-description" 
                              name="description" 
                              defaultValue={editingSwotItem.description} 
                              required
                              placeholder="Descreva detalhadamente este item..."
                              rows={4}
                              data-testid="input-swot-item-description"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="swot-item-priority">Prioridade</Label>
                              <Select name="priorityLevel" defaultValue={editingSwotItem.priorityLevel || "medium"}>
                                <SelectTrigger data-testid="select-swot-item-priority">
                                  <SelectValue placeholder="Selecione a prioridade" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="baixa">Baixa</SelectItem>
                                  <SelectItem value="medium">Média</SelectItem>
                                  <SelectItem value="alta">Alta</SelectItem>
                                  <SelectItem value="critica">Crítica</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="swot-item-impact">Impacto (1-5)</Label>
                              <Select name="impactScore" defaultValue={String(editingSwotItem.impactScore || 3)}>
                                <SelectTrigger data-testid="select-swot-item-impact">
                                  <SelectValue placeholder="Nível de impacto" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 - Muito Baixo</SelectItem>
                                  <SelectItem value="2">2 - Baixo</SelectItem>
                                  <SelectItem value="3">3 - Moderado</SelectItem>
                                  <SelectItem value="4">4 - Alto</SelectItem>
                                  <SelectItem value="5">5 - Muito Alto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="swot-item-responsible">Responsável</Label>
                            <Input 
                              id="swot-item-responsible" 
                              name="responsible" 
                              defaultValue={editingSwotItem.responsible || ""} 
                              placeholder="Quem é responsável por este item?"
                              data-testid="input-swot-item-responsible"
                            />
                          </div>
                        </TabsContent>

                        <TabsContent value="pdca" className="space-y-4">
                          <div className="space-y-2">
                            <Label>Status do Ciclo PDCA</Label>
                            <input type="hidden" name="pdcaStatus" value={swotPdcaStatus} />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={swotPdcaStatus === "plan" ? "default" : "outline"}
                                className={swotPdcaStatus === "plan" ? "bg-blue-600 hover:bg-blue-700" : ""}
                                onClick={() => setSwotPdcaStatus("plan")}
                                data-testid="btn-pdca-plan"
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Planejar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={swotPdcaStatus === "do" ? "default" : "outline"}
                                className={swotPdcaStatus === "do" ? "bg-orange-500 hover:bg-orange-600" : "text-orange-600 border-orange-300"}
                                onClick={() => setSwotPdcaStatus("do")}
                                data-testid="btn-pdca-do"
                              >
                                <CirclePlay className="h-4 w-4 mr-1" />
                                Executar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={swotPdcaStatus === "check" ? "default" : "outline"}
                                className={swotPdcaStatus === "check" ? "bg-purple-600 hover:bg-purple-700" : "text-purple-600 border-purple-300"}
                                onClick={() => setSwotPdcaStatus("check")}
                                data-testid="btn-pdca-check"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Verificar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={swotPdcaStatus === "act" ? "default" : "outline"}
                                className={swotPdcaStatus === "act" ? "bg-amber-500 hover:bg-amber-600" : "text-amber-600 border-amber-300"}
                                onClick={() => setSwotPdcaStatus("act")}
                                data-testid="btn-pdca-act"
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Agir
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={swotPdcaStatus === "done" ? "default" : "outline"}
                                className={swotPdcaStatus === "done" ? "bg-green-600 hover:bg-green-700" : "text-green-600 border-green-300"}
                                onClick={() => setSwotPdcaStatus("done")}
                                data-testid="btn-pdca-done"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Concluído
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="swot-item-action-plan">Plano de Ação</Label>
                            <Textarea 
                              id="swot-item-action-plan" 
                              name="actionPlan" 
                              defaultValue={editingSwotItem.actionPlan || ""} 
                              placeholder="Descreva as ações necessárias para tratar este item..."
                              rows={4}
                              data-testid="input-swot-item-action-plan"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="swot-item-result">Resultado / Verificação</Label>
                            <Textarea 
                              id="swot-item-result" 
                              name="result" 
                              defaultValue={editingSwotItem.result || ""} 
                              placeholder="Documente os resultados obtidos e lições aprendidas..."
                              rows={4}
                              data-testid="input-swot-item-result"
                            />
                          </div>
                        </TabsContent>
                      </Tabs>

                      <DialogFooter className="mt-6 flex justify-between">
                        <Button 
                          type="button" 
                          variant="destructive" 
                          disabled={deleteSwotItemMutation.isPending}
                          onClick={() => {
                            if (confirm("Tem certeza que deseja excluir este item?")) {
                              deleteSwotItemMutation.mutate(editingSwotItem.id, {
                                onSuccess: () => setEditingSwotItem(null),
                              });
                            }
                          }}
                          data-testid="btn-delete-swot-item"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </Button>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={() => setEditingSwotItem(null)}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={updateSwotItemMutation.isPending} data-testid="btn-save-swot-item">
                            {updateSwotItemMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Salvar
                          </Button>
                        </div>
                      </DialogFooter>
                    </form>
                  )}
                </DialogContent>
              </Dialog>
            </div>
            </TooltipProvider>
          )}
          {activeTab === "pdca" && (
            <TooltipProvider>
            <div className="space-y-4">
              <Alert className="bg-amber-50 border-amber-200">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>Dica:</strong> {MODULE_HELP.pdca.tips[0]}
                </AlertDescription>
              </Alert>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div>
                    <h2 className="text-2xl font-bold">PDCA</h2>
                    <p className="text-muted-foreground">Gerencie ciclos de melhoria contínua</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold">{MODULE_HELP.pdca.title}</p>
                      <p className="text-sm">{MODULE_HELP.pdca.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={selectedProjectId?.toString() || "all"} onValueChange={(v) => setSelectedProjectId(v === "all" ? null : parseInt(v))}>
                    <SelectTrigger className="w-full md:w-[200px]" data-testid="select-pdca-project">
                      <SelectValue placeholder="Todos os projetos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os projetos</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setShowNewPdcaDialog(true)} data-testid="btn-new-pdca">
                    <Plus className="h-4 w-4 mr-2" /> Novo Ciclo
                  </Button>
                </div>
              </div>

              {!selectedProjectId ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <RefreshCw className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Selecione um Projeto</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      Escolha um projeto acima para visualizar e gerenciar itens do ciclo PDCA.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const allItems = pdcaOverview?.items || [];
                    const sourceFilteredItems = allItems.filter(item => pdcaSourceFilter === "all" || item.source === pdcaSourceFilter);
                    const phaseFilteredItems = allItems.filter(item => pdcaPhaseFilter === "all" || item.pdcaStatus?.toLowerCase() === pdcaPhaseFilter);
                    
                    const countByPhase = (phase: string) => sourceFilteredItems.filter(item => item.pdcaStatus?.toLowerCase() === phase).length;
                    const countBySource = (source: string) => phaseFilteredItems.filter(item => item.source === source).length;
                    
                    return (
                      <>
                        {/* Phase filter tabs */}
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { id: "all", label: "Todos", count: sourceFilteredItems.length },
                            { id: "plan", label: "Plan", count: countByPhase("plan") },
                            { id: "do", label: "Do", count: countByPhase("do") },
                            { id: "check", label: "Check", count: countByPhase("check") },
                            { id: "act", label: "Act", count: countByPhase("act") },
                            { id: "done", label: "Done", count: countByPhase("done") },
                          ].map(phase => (
                            <Button
                              key={phase.id}
                              variant={pdcaPhaseFilter === phase.id ? "default" : "outline"}
                              size="sm"
                              onClick={() => setPdcaPhaseFilter(phase.id)}
                              data-testid={`pdca-phase-${phase.id}`}
                            >
                              {phase.label} ({phase.count})
                            </Button>
                          ))}
                        </div>

                        {/* Source filter tabs */}
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { id: "all", label: "Todos", icon: Layers, count: phaseFilteredItems.length },
                            { id: "canvas", label: "Canvas", icon: Target, count: countBySource("canvas") },
                            { id: "processes", label: "Processos", icon: Network, count: countBySource("processes") },
                            { id: "swot", label: "SWOT", icon: TrendingUp, count: countBySource("swot") },
                            { id: "requirements", label: "Requisitos", icon: FileCheck, count: countBySource("requirements") },
                          ].map(source => (
                            <Button
                              key={source.id}
                              variant={pdcaSourceFilter === source.id ? "secondary" : "ghost"}
                              size="sm"
                              onClick={() => setPdcaSourceFilter(source.id)}
                              data-testid={`pdca-source-${source.id}`}
                            >
                              <source.icon className="h-4 w-4 mr-1" />
                              {source.label} ({source.count})
                            </Button>
                          ))}
                        </div>
                      </>
                    );
                  })()}

                  {/* Progress bars by source */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { id: "canvas", label: "Canvas", stats: pdcaOverview?.stats?.canvas },
                      { id: "processes", label: "Processos", stats: pdcaOverview?.stats?.processes },
                      { id: "swot", label: "SWOT", stats: pdcaOverview?.stats?.swot },
                      { id: "requirements", label: "Requisitos", stats: pdcaOverview?.stats?.requirements },
                    ].map(source => {
                      const total = source.stats?.total || 0;
                      const done = source.stats?.done || 0;
                      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <Card key={source.id} className="p-3">
                          <p className="text-sm font-medium">{source.label}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{done}/{total} concluídos</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${percent}%` }} />
                          </div>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Items list */}
                  <div className="space-y-2">
                    {(() => {
                      const filteredItems = (pdcaOverview?.items || [])
                        .filter(item => pdcaPhaseFilter === "all" || item.pdcaStatus?.toLowerCase() === pdcaPhaseFilter)
                        .filter(item => pdcaSourceFilter === "all" || item.source === pdcaSourceFilter);
                      
                      if (filteredItems.length === 0) {
                        return (
                          <Card>
                            <CardContent className="flex flex-col items-center justify-center py-8">
                              <p className="text-muted-foreground">
                                {(pdcaOverview?.items || []).length === 0 
                                  ? "Nenhum item PDCA encontrado para este projeto."
                                  : "Nenhum item encontrado para os filtros selecionados."}
                              </p>
                              <p className="text-sm text-muted-foreground mt-2">
                                {(pdcaOverview?.items || []).length === 0 
                                  ? "Adicione itens no Canvas, Processos, SWOT ou Requisitos para gerenciá-los aqui."
                                  : "Tente alterar os filtros de fase ou origem."}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      }
                      
                      return filteredItems.map(item => {
                        const status = item.pdcaStatus?.toLowerCase() || "plan";
                        return (
                          <Card key={`${item.source}-${item.id}`} className="p-4" data-testid={`pdca-item-${item.source}-${item.id}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {item.source === "canvas" ? "Canvas" : 
                                     item.source === "processes" ? "Processo" : 
                                     item.source === "swot" ? "SWOT" : "Requisito"}
                                  </Badge>
                                  <Badge className={
                                    status === "plan" ? "bg-blue-100 text-blue-800" :
                                    status === "do" ? "bg-green-100 text-green-800" :
                                    status === "check" ? "bg-yellow-100 text-yellow-800" :
                                    status === "act" ? "bg-purple-100 text-purple-800" :
                                    status === "done" ? "bg-gray-200 text-gray-800" :
                                    "bg-gray-100 text-gray-800"
                                  }>
                                    {status.toUpperCase()}
                                  </Badge>
                                </div>
                                <h4 className="font-medium">{item.title}</h4>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                                )}
                                {item.pdcaActionPlan && (
                                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                                    <strong>Plano:</strong> {item.pdcaActionPlan}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <Dialog open={showNewPdcaDialog} onOpenChange={setShowNewPdcaDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Ciclo PDCA</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    createPdcaCycleMutation.mutate({
                      title: formData.get("title") as string,
                      description: formData.get("description") as string || undefined,
                      projectId: selectedProjectId || undefined,
                    });
                  }}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="pdca-title">Título</Label>
                        <Input id="pdca-title" name="title" required placeholder="Ex: Otimização do processo de vendas" data-testid="input-pdca-title" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pdca-description">Descrição</Label>
                        <Textarea id="pdca-description" name="description" placeholder="Descreva o objetivo deste ciclo..." data-testid="input-pdca-description" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowNewPdcaDialog(false)}>Cancelar</Button>
                      <Button type="submit" disabled={createPdcaCycleMutation.isPending} data-testid="btn-submit-pdca">
                        {createPdcaCycleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Criar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            </TooltipProvider>
          )}
          {activeTab === "requirements" && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">Requisitos</h2>
                  <p className="text-muted-foreground">Gerencie requisitos de projetos</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={selectedProjectId?.toString() || "all"} onValueChange={(v) => setSelectedProjectId(v === "all" ? null : parseInt(v))}>
                    <SelectTrigger className="w-full md:w-[200px]" data-testid="select-req-project">
                      <SelectValue placeholder="Todos os projetos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os projetos</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setShowNewRequirementDialog(true)} data-testid="btn-new-requirement">
                    <Plus className="h-4 w-4 mr-2" /> Novo Requisito
                  </Button>
                </div>
              </div>

              {requirements.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileCheck className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Nenhum requisito</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-4">
                      Crie requisitos para documentar as necessidades do projeto.
                    </p>
                    <Button onClick={() => setShowNewRequirementDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Criar Primeiro Requisito
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {requirements.map(req => (
                    <Card key={req.id} data-testid={`requirement-${req.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            {req.code && <Badge variant="outline">{req.code}</Badge>}
                            <CardTitle className="text-lg">{req.title}</CardTitle>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={req.priority === 'critical' ? 'bg-red-100 text-red-800' : req.priority === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}>
                              {req.priority}
                            </Badge>
                            <Badge variant="secondary">
                              {REQUIREMENT_TYPES.find(t => t.id === req.type)?.label || req.type}
                            </Badge>
                            <Badge variant="outline">
                              {REQUIREMENT_STATUS.find(s => s.id === req.status)?.label || req.status}
                            </Badge>
                          </div>
                        </div>
                        {req.description && <CardDescription>{req.description}</CardDescription>}
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}

              <Dialog open={showNewRequirementDialog} onOpenChange={setShowNewRequirementDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Requisito</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!newReqTitle.trim()) return;
                    createRequirementMutation.mutate({
                      title: newReqTitle,
                      description: newReqDescription || undefined,
                      type: newReqType,
                      priority: newReqPriority,
                      projectId: selectedProjectId || undefined,
                    });
                  }}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="req-title">Título</Label>
                        <Input 
                          id="req-title" 
                          value={newReqTitle}
                          onChange={(e) => setNewReqTitle(e.target.value)}
                          required 
                          placeholder="Ex: Sistema deve permitir login com email" 
                          data-testid="input-req-title" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="req-description">Descrição</Label>
                        <Textarea 
                          id="req-description" 
                          value={newReqDescription}
                          onChange={(e) => setNewReqDescription(e.target.value)}
                          placeholder="Descreva o requisito em detalhes..." 
                          data-testid="input-req-description" 
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="req-type">Tipo</Label>
                          <Select value={newReqType} onValueChange={setNewReqType}>
                            <SelectTrigger data-testid="select-req-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {REQUIREMENT_TYPES.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="req-priority">Prioridade</Label>
                          <Select value={newReqPriority} onValueChange={setNewReqPriority}>
                            <SelectTrigger data-testid="select-req-priority">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Baixa</SelectItem>
                              <SelectItem value="medium">Média</SelectItem>
                              <SelectItem value="high">Alta</SelectItem>
                              <SelectItem value="critical">Crítica</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowNewRequirementDialog(false)}>Cancelar</Button>
                      <Button type="submit" disabled={createRequirementMutation.isPending || !newReqTitle.trim()} data-testid="btn-submit-requirement">
                        {createRequirementMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Criar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
          {activeTab === "settings" && (
            <Card>
              <CardHeader>
                <CardTitle>Configurações</CardTitle>
                <CardDescription>Gerencie sua organização e preferências</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Organização Atual</p>
                    <p className="text-sm text-muted-foreground">
                      {tenants[0]?.name || "Nenhuma organização"}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setShowNewTenantDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Nova Organização
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {activeTab === "valuation" && (
            <ValuationSection tenantId={tenants[0]?.id} />
          )}
        </div>
        </div>
      </div>

      <Dialog open={showNewTenantDialog} onOpenChange={setShowNewTenantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Organização</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createTenantMutation.mutate({
              name: formData.get("name") as string,
              slug: formData.get("slug") as string || undefined,
            });
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Nome da Organização</Label>
                <Input id="tenant-name" name="name" placeholder="Ex: Minha Consultoria" required data-testid="input-tenant-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-slug">Identificador (opcional)</Label>
                <Input id="tenant-slug" name="slug" placeholder="minha-consultoria" data-testid="input-tenant-slug" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewTenantDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTenantMutation.isPending} data-testid="btn-submit-tenant">
                {createTenantMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const partnerValue = formData.get("partnerId");
            createClientMutation.mutate({
              name: formData.get("name"),
              tradeName: formData.get("tradeName") || undefined,
              cnpj: formData.get("cnpj") || undefined,
              email: formData.get("email") || undefined,
              phone: formData.get("phone") || undefined,
              segment: formData.get("segment") || undefined,
              primaryContactName: formData.get("contactName") || undefined,
              primaryContactEmail: formData.get("contactEmail") || undefined,
              primaryContactPhone: formData.get("contactPhone") || undefined,
              partnerId: partnerValue && partnerValue !== "none" ? Number(partnerValue) : undefined,
              source: partnerValue && partnerValue !== "none" ? "partner" : "direct",
              status: "active"
            });
          }} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="clientName">Razão Social *</Label>
                <Input id="clientName" name="name" required data-testid="input-client-name" />
              </div>
              <div>
                <Label htmlFor="tradeName">Nome Fantasia</Label>
                <Input id="tradeName" name="tradeName" data-testid="input-client-tradename" />
              </div>
              <div>
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" name="cnpj" data-testid="input-client-cnpj" />
              </div>
              <div>
                <Label htmlFor="clientEmail">Email</Label>
                <Input id="clientEmail" name="email" type="email" data-testid="input-client-email" />
              </div>
              <div>
                <Label htmlFor="clientPhone">Telefone</Label>
                <Input id="clientPhone" name="phone" data-testid="input-client-phone" />
              </div>
              <div>
                <Label htmlFor="segment">Segmento</Label>
                <Select name="segment">
                  <SelectTrigger data-testid="select-client-segment">
                    <SelectValue placeholder="Selecione um segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Tecnologia</SelectItem>
                    <SelectItem value="retail">Varejo</SelectItem>
                    <SelectItem value="industry">Indústria</SelectItem>
                    <SelectItem value="services">Serviços</SelectItem>
                    <SelectItem value="healthcare">Saúde</SelectItem>
                    <SelectItem value="education">Educação</SelectItem>
                    <SelectItem value="finance">Financeiro</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="partnerId">Parceiro Associado</Label>
                <Select name="partnerId">
                  <SelectTrigger data-testid="select-client-partner">
                    <SelectValue placeholder="Sem parceiro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem parceiro</SelectItem>
                    {crmPartners.map((partner: any) => (
                      <SelectItem key={partner.id} value={String(partner.id)}>
                        {partner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="font-medium mb-3">Contato Principal</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="contactName">Nome do Contato</Label>
                  <Input id="contactName" name="contactName" data-testid="input-client-contact-name" />
                </div>
                <div>
                  <Label htmlFor="contactEmail">Email do Contato</Label>
                  <Input id="contactEmail" name="contactEmail" type="email" data-testid="input-client-contact-email" />
                </div>
                <div>
                  <Label htmlFor="contactPhone">Telefone do Contato</Label>
                  <Input id="contactPhone" name="contactPhone" data-testid="input-client-contact-phone" />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createClientMutation.isPending} data-testid="btn-submit-client">
              {createClientMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cadastrar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const projectType = formData.get("projectType") as string;
            
            createProjectMutation.mutate({
              name: formData.get("name") as string,
              clientId: parseInt(formData.get("clientId") as string),
              description: formData.get("description") as string || undefined,
              status: formData.get("status") as string || "backlog",
              projectType: projectType,
            });
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="project-type">Tipo de Projeto</Label>
                <Select name="projectType" defaultValue="consultoria">
                  <SelectTrigger data-testid="select-project-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultoria">Consultoria</SelectItem>
                    <SelectItem value="valuation">Valuation</SelectItem>
                    <SelectItem value="programacao">Programação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-name">Nome do Projeto</Label>
                <Input id="project-name" name="name" placeholder="Ex: Diagnóstico Empresarial" required data-testid="input-project-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-client">Cliente</Label>
                <Select name="clientId" required>
                  <SelectTrigger data-testid="select-project-client">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Descrição</Label>
                <Textarea id="project-description" name="description" placeholder="Descreva o escopo do projeto..." rows={3} data-testid="input-project-description" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-status">Status Inicial</Label>
                <Select name="status" defaultValue="backlog">
                  <SelectTrigger data-testid="select-project-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="diagnostico">Diagnóstico</SelectItem>
                    <SelectItem value="andamento">Em Andamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewProjectDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createProjectMutation.isPending} data-testid="btn-submit-project">
                {createProjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={showEditProjectDialog} onOpenChange={(open) => {
        setShowEditProjectDialog(open);
        if (!open) setEditingProject(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Projeto</DialogTitle>
          </DialogHeader>
          {editingProject && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              updateProjectMutation.mutate({
                id: editingProject.id,
                name: formData.get("name") as string,
                description: formData.get("description") as string || undefined,
                status: formData.get("status") as string,
              }, {
                onSuccess: () => {
                  setShowEditProjectDialog(false);
                  setEditingProject(null);
                }
              });
            }}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-project-name">Nome do Projeto</Label>
                  <Input 
                    id="edit-project-name" 
                    name="name" 
                    defaultValue={editingProject.name}
                    required 
                    data-testid="input-edit-project-name" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-project-description">Descrição</Label>
                  <Textarea 
                    id="edit-project-description" 
                    name="description" 
                    defaultValue={editingProject.description || ""}
                    rows={3} 
                    data-testid="input-edit-project-description" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-project-status">Status</Label>
                  <Select name="status" defaultValue={editingProject.status}>
                    <SelectTrigger data-testid="select-edit-project-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backlog">Backlog</SelectItem>
                      <SelectItem value="diagnostico">Diagnóstico</SelectItem>
                      <SelectItem value="andamento">Em Andamento</SelectItem>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setShowEditProjectDialog(false);
                  setEditingProject(null);
                }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateProjectMutation.isPending} data-testid="btn-update-project">
                  {updateProjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={showDeleteProjectConfirm} onOpenChange={(open) => {
        setShowDeleteProjectConfirm(open);
        if (!open) setProjectToDelete(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Projeto</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Tem certeza que deseja excluir o projeto <strong>{projectToDelete?.name}</strong>?
            </p>
            <p className="text-sm text-destructive mt-2">
              Esta ação não pode ser desfeita. Todos os dados relacionados ao projeto serão removidos.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setShowDeleteProjectConfirm(false);
              setProjectToDelete(null);
            }}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              disabled={deleteProjectMutation.isPending}
              onClick={() => {
                if (projectToDelete) {
                  deleteProjectMutation.mutate(projectToDelete.id, {
                    onSuccess: () => {
                      setShowDeleteProjectConfirm(false);
                      setProjectToDelete(null);
                    }
                  });
                }
              }}
              data-testid="btn-confirm-delete-project"
            >
              {deleteProjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createLeadMutation.mutate({
              name: formData.get("name") as string,
              email: formData.get("email") as string || undefined,
              phone: formData.get("phone") as string || undefined,
              company: formData.get("company") as string || undefined,
              source: formData.get("source") as string || undefined,
            });
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="lead-name">Nome</Label>
                <Input id="lead-name" name="name" placeholder="Nome do contato" required data-testid="input-lead-name" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-email">Email</Label>
                  <Input id="lead-email" name="email" type="email" placeholder="email@exemplo.com" data-testid="input-lead-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-phone">Telefone</Label>
                  <Input id="lead-phone" name="phone" placeholder="(11) 99999-9999" data-testid="input-lead-phone" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-company">Empresa</Label>
                  <Input id="lead-company" name="company" placeholder="Nome da empresa" data-testid="input-lead-company" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-source">Origem</Label>
                  <Select name="source">
                    <SelectTrigger data-testid="select-lead-source">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Indicação</SelectItem>
                      <SelectItem value="cold_call">Cold Call</SelectItem>
                      <SelectItem value="event">Evento</SelectItem>
                      <SelectItem value="social">Redes Sociais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewLeadDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createLeadMutation.isPending} data-testid="btn-submit-lead">
                {createLeadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Global Dialogs for Project Details */}
      <Dialog open={showTeamMemberDialog} onOpenChange={(open) => {
        setShowTeamMemberDialog(open);
        if (!open) setNewMemberRole("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            if (!newMemberRole) {
              toast.error("Selecione uma função");
              return;
            }
            addTeamMemberMutation.mutate({
              name: formData.get("name") as string,
              email: formData.get("email") as string || undefined,
              role: newMemberRole,
            });
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="member-name">Nome</Label>
                <Input id="member-name" name="name" required placeholder="Nome do membro" data-testid="input-member-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-email">Email (opcional)</Label>
                <Input id="member-email" name="email" type="email" placeholder="email@exemplo.com" data-testid="input-member-email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-role">Função</Label>
                <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                  <SelectTrigger data-testid="select-member-role">
                    <SelectValue placeholder="Selecione uma função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gerente">Gerente de Projeto</SelectItem>
                    <SelectItem value="analista">Analista</SelectItem>
                    <SelectItem value="desenvolvedor">Desenvolvedor</SelectItem>
                    <SelectItem value="designer">Designer</SelectItem>
                    <SelectItem value="consultor">Consultor</SelectItem>
                    <SelectItem value="stakeholder">Stakeholder</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTeamMemberDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={addTeamMemberMutation.isPending || !newMemberRole} data-testid="btn-submit-member">
                {addTeamMemberMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewTaskDialog} onOpenChange={(open) => {
        setShowNewTaskDialog(open);
        if (!open) setNewTaskPriority("medium");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            addProjectTaskMutation.mutate({
              title: formData.get("title") as string,
              description: formData.get("description") as string || undefined,
              priority: newTaskPriority,
              assignedTo: formData.get("assignedTo") as string || undefined,
              dueDate: formData.get("dueDate") as string || undefined,
            });
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Título</Label>
                <Input id="task-title" name="title" required placeholder="Título da tarefa" data-testid="input-task-title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-description">Descrição (opcional)</Label>
                <Textarea id="task-description" name="description" placeholder="Descreva a tarefa..." data-testid="input-task-description" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-priority">Prioridade</Label>
                <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                  <SelectTrigger data-testid="select-task-priority">
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-assignedTo">Responsável (opcional)</Label>
                <Input id="task-assignedTo" name="assignedTo" placeholder="Nome do responsável" data-testid="input-task-assigned" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-dueDate">Data limite (opcional)</Label>
                <Input id="task-dueDate" name="dueDate" type="date" data-testid="input-task-dueDate" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewTaskDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={addProjectTaskMutation.isPending} data-testid="btn-submit-task">
                {addProjectTaskMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Tarefa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Global Process Dialogs */}
      <Dialog open={showNewProcessDialog} onOpenChange={(open) => { setShowNewProcessDialog(open); if (!open) setNewProcessCategory(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Processo</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createProcessMutation.mutate({
              name: formData.get("name") as string,
              description: formData.get("description") as string,
              category: newProcessCategory || undefined,
              owner: formData.get("owner") as string,
            });
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="process-name">Nome do Processo</Label>
                <Input id="process-name" name="name" required placeholder="Ex: Processo de Vendas" data-testid="input-process-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="process-description">Descrição</Label>
                <Textarea id="process-description" name="description" placeholder="Descreva o processo..." data-testid="input-process-description" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="process-category">Categoria</Label>
                <Select value={newProcessCategory} onValueChange={setNewProcessCategory}>
                  <SelectTrigger data-testid="select-process-category">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCESS_CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="process-owner">Responsável</Label>
                <Input id="process-owner" name="owner" placeholder="Nome do responsável" data-testid="input-process-owner" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewProcessDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={createProcessMutation.isPending} data-testid="btn-submit-process">
                {createProcessMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showProcessDiagramDialog} onOpenChange={setShowProcessDiagramDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Diagrama de Processo: {processes.find((p: PcProcess) => p.id === diagramProcessId)?.name}
            </DialogTitle>
          </DialogHeader>
          <ProcessDiagram
            key={diagramProcessId}
            initialNodes={processes.find((p: PcProcess) => p.id === diagramProcessId)?.diagramNodes || []}
            initialEdges={processes.find((p: PcProcess) => p.id === diagramProcessId)?.diagramEdges || []}
            initialViewport={processes.find((p: PcProcess) => p.id === diagramProcessId)?.diagramViewport}
            onSave={async (nodes, edges, viewport) => {
              if (!diagramProcessId) return;
              try {
                const res = await fetch(`/api/compass/processes/${diagramProcessId}/diagram`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ diagramNodes: nodes, diagramEdges: edges, diagramViewport: viewport }),
                });
                if (res.ok) {
                  toast.success("Diagrama salvo com sucesso!");
                  queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "processes"] });
                } else {
                  toast.error("Erro ao salvar diagrama");
                }
              } catch (error) {
                toast.error("Erro ao salvar diagrama");
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Report Configuration Modal */}
      <Dialog open={showReportConfigModal} onOpenChange={setShowReportConfigModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Configurar Relatório</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {reportConfigTemplate === "executive_summary" ? "Sumário Executivo" : 
               reportConfigTemplate === "full_diagnostic" ? "Diagnóstico Completo" : 
               "Análise SWOT"} - {selectedProject?.name || "Projeto"}
            </p>
          </DialogHeader>
          
          <div className="grid grid-cols-3 gap-6 py-4">
            {/* Left - Section Selection */}
            <div className="col-span-2 space-y-4">
              <div>
                <h4 className="font-medium mb-2">Seções do Relatório</h4>
                <p className="text-sm text-muted-foreground mb-4">Selecione as seções que deseja incluir</p>
              </div>
              
              <div className="space-y-2">
                {REPORT_SECTIONS.map(section => (
                  <div 
                    key={section.id}
                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      reportConfigSections.includes(section.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleReportSection(section.id)}
                  >
                    <Checkbox 
                      checked={reportConfigSections.includes(section.id)}
                      onCheckedChange={() => toggleReportSection(section.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{section.label}</p>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Right - Summary */}
            <div className="space-y-4">
              <Card className="p-4">
                <h4 className="font-medium mb-3">Resumo</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Template</p>
                    <p className="font-medium">
                      {reportConfigTemplate === "executive_summary" ? "Sumário Executivo" : 
                       reportConfigTemplate === "full_diagnostic" ? "Diagnóstico Completo" : 
                       "Análise SWOT"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Seções selecionadas</p>
                    <p className="font-medium">{reportConfigSections.length} de {REPORT_SECTIONS.length}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {reportConfigSections.map(sectionId => {
                      const section = REPORT_SECTIONS.find(s => s.id === sectionId);
                      return section ? (
                        <Badge key={sectionId} variant="secondary" className="text-xs">
                          {section.label}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              </Card>
              
              <Button 
                className="w-full" 
                onClick={() => {
                  if (!selectedProjectId) return;
                  const templateNames: Record<string, string> = {
                    executive_summary: "Sumário Executivo",
                    full_diagnostic: "Diagnóstico Completo",
                    swot_report: "Análise SWOT",
                  };
                  const project = projects.find(p => p.id === selectedProjectId);
                  const name = `${templateNames[reportConfigTemplate] || reportConfigTemplate} - ${project?.name || "Projeto"}`;
                  generateReportMutation.mutate({ 
                    projectId: selectedProjectId, 
                    name, 
                    templateType: reportConfigTemplate, 
                    format: "pdf",
                    sections: reportConfigSections
                  });
                  setShowReportConfigModal(false);
                }}
                disabled={reportConfigSections.length === 0 || generateReportMutation.isPending}
                data-testid="btn-generate-configured-report"
              >
                {generateReportMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Eye className="h-4 w-4 mr-2" /> Visualizar Relatório
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  toast.success("Configuração salva!");
                }}
                data-testid="btn-save-report-config"
              >
                <Save className="h-4 w-4 mr-2" /> Salvar Configuração
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Editor Modal */}
      <Dialog open={showReportEditorDialog} onOpenChange={setShowReportEditorDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Input 
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="text-lg font-semibold border-none shadow-none px-0 focus-visible:ring-0"
                  placeholder="Nome do relatório..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportReportAsPDF}>
                  <FileText className="h-4 w-4 mr-1" /> PDF
                </Button>
                <Button 
                  size="sm" 
                  onClick={saveReportContent}
                  disabled={reportIsSaving}
                >
                  {reportIsSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto border rounded-lg mt-4">
            <div 
              className="min-h-[500px] p-6 prose prose-sm max-w-none"
              style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
            >
              {reportContent ? (
                <div 
                  contentEditable
                  dangerouslySetInnerHTML={{ __html: reportContent }}
                  onBlur={(e) => setReportContent(e.currentTarget.innerHTML)}
                  className="outline-none focus:outline-none min-h-full"
                  style={{ 
                    lineHeight: 1.6,
                  }}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum conteúdo gerado ainda</p>
                  <p className="text-sm">Gere um relatório para visualizar e editar aqui</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </BrowserFrame>
  );
}

// Valuation Section Component
function ValuationSection({ tenantId }: { tenantId?: number }) {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showValuationProjectDialog, setShowValuationProjectDialog] = useState(false);
  const [activeValuationTab, setActiveValuationTab] = useState("overview");
  
  const { data: valuationProjects = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/valuation/projects"],
    queryFn: async () => {
      const res = await fetch("/api/valuation/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    enabled: !!tenantId,
  });

  // Auto-select first project when data loads
  useEffect(() => {
    if (valuationProjects.length > 0 && !selectedProject) {
      setSelectedProject(valuationProjects[0]);
    }
  }, [valuationProjects, selectedProject]);

  const { data: crmClients = [] } = useQuery<any[]>({
    queryKey: ["/api/valuation/crm-clients"],
    queryFn: async () => {
      const res = await fetch("/api/valuation/crm-clients");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId,
  });

  const { data: sectorAnalysis } = useQuery<any>({
    queryKey: ["/api/valuation/projects", selectedProject?.id, "sector-analysis"],
    queryFn: async () => {
      const res = await fetch(`/api/valuation/projects/${selectedProject.id}/sector-analysis`);
      return res.json();
    },
    enabled: !!selectedProject?.id,
  });

  const { data: canvasBlocks = [] } = useQuery<any[]>({
    queryKey: ["/api/valuation/projects", selectedProject?.id, "canvas"],
    queryFn: async () => {
      const res = await fetch(`/api/valuation/projects/${selectedProject.id}/canvas`);
      return res.json();
    },
    enabled: !!selectedProject?.id,
  });

  const { data: checklistProgress = [] } = useQuery<any[]>({
    queryKey: ["/api/valuation/projects", selectedProject?.id, "checklist"],
    queryFn: async () => {
      const res = await fetch(`/api/valuation/projects/${selectedProject.id}/checklist`);
      return res.json();
    },
    enabled: !!selectedProject?.id,
  });

  const { data: checklistCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/valuation/checklist/categories", selectedProject?.sector],
    queryFn: async () => {
      const segment = selectedProject?.sector === "Indústria" ? "industry" : 
                     selectedProject?.sector === "Serviços" ? "services" : 
                     selectedProject?.sector === "Varejo" ? "retail" : 
                     selectedProject?.sector === "Tecnologia" ? "technology" : "general";
      const res = await fetch(`/api/valuation/checklist/categories?segment=${segment}`);
      return res.json();
    },
    enabled: !!selectedProject?.id,
  });

  const { data: checklistItems = [] } = useQuery<any[]>({
    queryKey: ["/api/valuation/checklist/items", selectedProject?.sector],
    queryFn: async () => {
      const segment = selectedProject?.sector === "Indústria" ? "industry" : 
                     selectedProject?.sector === "Serviços" ? "services" : 
                     selectedProject?.sector === "Varejo" ? "retail" : 
                     selectedProject?.sector === "Tecnologia" ? "technology" : "general";
      const res = await fetch(`/api/valuation/checklist/items?segment=${segment}`);
      return res.json();
    },
    enabled: !!selectedProject?.id,
  });

  const { data: financialInputs = [] } = useQuery<any[]>({
    queryKey: ["/api/valuation/projects", selectedProject?.id, "inputs"],
    queryFn: async () => {
      const res = await fetch(`/api/valuation/projects/${selectedProject.id}/inputs`);
      return res.json();
    },
    enabled: !!selectedProject?.id,
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/valuation/projects", selectedProject?.id, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/valuation/projects/${selectedProject.id}/documents`);
      return res.json();
    },
    enabled: !!selectedProject?.id,
  });

  const calculateSectorMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/valuation/projects/${selectedProject.id}/sector-analysis/calculate`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuation/projects", selectedProject?.id, "sector-analysis"] });
    },
  });

  const createValuationProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/valuation/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuation/projects"] });
      setShowValuationProjectDialog(false);
    },
  });

  const saveCanvasBlock = useMutation({
    mutationFn: async ({ blockType, data }: { blockType: string; data: any }) => {
      const res = await fetch(`/api/valuation/projects/${selectedProject.id}/canvas/${blockType}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuation/projects", selectedProject?.id, "canvas"] });
    },
  });

  const initializeChecklistMutation = useMutation({
    mutationFn: async () => {
      const segment = selectedProject?.sector === "Indústria" ? "industry" : 
                     selectedProject?.sector === "Serviços" ? "services" : 
                     selectedProject?.sector === "Varejo" ? "retail" : 
                     selectedProject?.sector === "Tecnologia" ? "technology" : "general";
      const res = await fetch(`/api/valuation/projects/${selectedProject.id}/checklist/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ segment }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuation/projects", selectedProject?.id, "checklist"] });
    },
  });

  const updateChecklistItemMutation = useMutation({
    mutationFn: async ({ itemId, status, notes, value }: { itemId: number; status: string; notes?: string; value?: string }) => {
      const res = await fetch(`/api/valuation/projects/${selectedProject.id}/checklist/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, notes, value }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuation/projects", selectedProject?.id, "checklist"] });
    },
  });

  const saveFinancialInputMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/valuation/projects/${selectedProject.id}/inputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          value: parseFloat(data.value) || 0,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuation/projects", selectedProject?.id, "inputs"] });
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", "other");
      const res = await fetch(`/api/valuation/projects/${selectedProject.id}/documents/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuation/projects", selectedProject?.id, "documents"] });
    },
  });

  const [showFinancialDialog, setShowFinancialDialog] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const CANVAS_BLOCKS = [
    { id: "customer_segments", label: "Segmentos de Clientes", description: "Para quem criamos valor?" },
    { id: "value_proposition", label: "Proposta de Valor", description: "Que valor entregamos?" },
    { id: "channels", label: "Canais", description: "Como alcançamos nossos clientes?" },
    { id: "customer_relationships", label: "Relacionamento", description: "Como nos relacionamos?" },
    { id: "revenue_streams", label: "Fontes de Receita", description: "Como geramos receita?" },
    { id: "key_resources", label: "Recursos Principais", description: "Quais recursos são essenciais?" },
    { id: "key_activities", label: "Atividades Principais", description: "O que fazemos de mais importante?" },
    { id: "key_partnerships", label: "Parcerias Principais", description: "Quem são nossos parceiros?" },
    { id: "cost_structure", label: "Estrutura de Custos", description: "Quais são nossos custos?" },
  ];

  const getBlockData = (blockType: string) => {
    return canvasBlocks.find((b: any) => b.blockType === blockType);
  };

  const getScoreLevel = (score: number) => {
    if (score >= 80) return { label: "Excelente", color: "text-emerald-600" };
    if (score >= 60) return { label: "Bom", color: "text-blue-600" };
    if (score >= 40) return { label: "Intermediário", color: "text-yellow-600" };
    return { label: "Inicial", color: "text-red-600" };
  };

  if (!tenantId) {
    return (
      <Card className="p-8 text-center">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Crie uma organização primeiro para acessar o módulo de Valuation</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Valuation
          </h2>
          <p className="text-muted-foreground">Avaliação de empresas e análise setorial</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Projects List */}
        <Card className="lg:col-span-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Projetos de Valuation</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="p-4 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : valuationProjects.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Nenhum projeto de valuation
                </div>
              ) : (
                <div className="divide-y">
                  {valuationProjects.map((project: any) => (
                    <div
                      key={project.id}
                      className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedProject?.id === project.id ? "bg-muted" : ""
                      }`}
                      onClick={() => setSelectedProject(project)}
                      data-testid={`valuation-project-${project.id}`}
                    >
                      <p className="font-medium text-sm truncate">{project.companyName}</p>
                      <p className="text-xs text-muted-foreground">{project.sector}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {project.status || "Em andamento"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Project Details */}
        <div className="lg:col-span-3">
          {selectedProject ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedProject.companyName}</CardTitle>
                    <CardDescription>{selectedProject.sector} | {selectedProject.size}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeValuationTab} onValueChange={setActiveValuationTab}>
                  <TabsList className="mb-4 flex-wrap">
                    <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                    <TabsTrigger value="checklist">Checklist</TabsTrigger>
                    <TabsTrigger value="financial">Financeiro</TabsTrigger>
                    <TabsTrigger value="documents">Documentos</TabsTrigger>
                    <TabsTrigger value="sector">Análise Setorial</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="p-4">
                        <p className="text-sm text-muted-foreground">Checklist</p>
                        <p className="text-2xl font-bold">
                          {checklistProgress.filter((c: any) => c.status === "completed").length}/{checklistProgress.length}
                        </p>
                        <p className="text-xs text-muted-foreground">itens completos</p>
                      </Card>
                      <Card className="p-4">
                        <p className="text-sm text-muted-foreground">Score Setorial</p>
                        <p className="text-2xl font-bold">{sectorAnalysis?.latest?.overallScore || "--"}%</p>
                        <p className="text-xs text-muted-foreground">
                          {sectorAnalysis?.latest?.overallScore 
                            ? getScoreLevel(sectorAnalysis.latest.overallScore).label 
                            : "Não calculado"}
                        </p>
                      </Card>
                      <Card className="p-4">
                        <p className="text-sm text-muted-foreground">Canvas</p>
                        <p className="text-2xl font-bold">{canvasBlocks.length}/9</p>
                        <p className="text-xs text-muted-foreground">blocos preenchidos</p>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="checklist">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Checklist de Coleta de Dados</h3>
                        {checklistProgress.length === 0 && (
                          <Button 
                            onClick={() => initializeChecklistMutation.mutate()}
                            disabled={initializeChecklistMutation.isPending}
                            data-testid="btn-initialize-checklist"
                          >
                            {initializeChecklistMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4 mr-2" />
                            )}
                            Inicializar Checklist
                          </Button>
                        )}
                      </div>

                      {checklistProgress.length === 0 ? (
                        <Card className="p-8 text-center">
                          <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-muted-foreground">Clique em "Inicializar Checklist" para começar</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            O checklist será criado com base no setor da empresa
                          </p>
                        </Card>
                      ) : (
                        <div className="space-y-3">
                          {/* Progress Bar */}
                          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                            <div className="flex-1">
                              <div className="flex justify-between text-sm mb-1">
                                <span>Progresso</span>
                                <span>{checklistProgress.filter((c: any) => c.status === "completed").length} de {checklistProgress.length}</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${(checklistProgress.filter((c: any) => c.status === "completed").length / checklistProgress.length) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Checklist Items */}
                          <Accordion type="multiple" value={expandedCategories} onValueChange={setExpandedCategories}>
                            {checklistCategories.map((category: any) => {
                              const categoryItems = checklistProgress.filter((p: any) => 
                                checklistItems.find((i: any) => i.id === p.itemId && i.categoryId === category.id)
                              );
                              const completedCount = categoryItems.filter((p: any) => p.status === "completed").length;
                              
                              return (
                                <AccordionItem key={category.id} value={String(category.id)}>
                                  <AccordionTrigger className="hover:no-underline">
                                    <div className="flex items-center gap-3 w-full">
                                      <div className="flex-1 text-left">
                                        <span className="font-medium">{category.name}</span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                          ({completedCount}/{categoryItems.length})
                                        </span>
                                      </div>
                                      {category.weight && (
                                        <Badge variant="outline" className="text-xs">
                                          Peso: {category.weight}%
                                        </Badge>
                                      )}
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="space-y-2 pl-4">
                                      {checklistItems
                                        .filter((item: any) => item.categoryId === category.id)
                                        .map((item: any) => {
                                          const progress = checklistProgress.find((p: any) => p.itemId === item.id);
                                          const isCompleted = progress?.status === "completed";
                                          
                                          return (
                                            <div 
                                              key={item.id} 
                                              className={`p-3 border rounded-lg ${isCompleted ? "bg-emerald-50 border-emerald-200" : "bg-background"}`}
                                            >
                                              <div className="flex items-start gap-3">
                                                <Checkbox
                                                  checked={isCompleted}
                                                  onCheckedChange={(checked) => {
                                                    updateChecklistItemMutation.mutate({
                                                      itemId: item.id,
                                                      status: checked ? "completed" : "pending",
                                                      notes: progress?.notes,
                                                      value: progress?.value,
                                                    });
                                                  }}
                                                  data-testid={`checklist-item-${item.id}`}
                                                />
                                                <div className="flex-1">
                                                  <p className={`text-sm ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                                                    {item.name}
                                                  </p>
                                                  {item.description && (
                                                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                                                  )}
                                                  {item.required && (
                                                    <Badge variant="destructive" className="text-xs mt-1">Obrigatório</Badge>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="financial">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Dados Financeiros</h3>
                        <Button onClick={() => setShowFinancialDialog(true)} data-testid="btn-add-financial">
                          <Plus className="h-4 w-4 mr-2" /> Adicionar Dados
                        </Button>
                      </div>

                      {financialInputs.length === 0 ? (
                        <Card className="p-8 text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-muted-foreground">Nenhum dado financeiro cadastrado</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Adicione receitas, custos, EBITDA e outros indicadores
                          </p>
                        </Card>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-4 gap-3 text-sm font-medium text-muted-foreground border-b pb-2">
                            <span>Indicador</span>
                            <span>Período</span>
                            <span className="text-right">Valor</span>
                            <span>Fonte</span>
                          </div>
                          {financialInputs.map((input: any) => (
                            <div key={input.id} className="grid grid-cols-4 gap-3 text-sm py-2 border-b">
                              <span className="font-medium">{input.inputType}</span>
                              <span>{input.period}</span>
                              <span className="text-right font-mono">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(input.value))}
                              </span>
                              <Badge variant="outline" className="text-xs w-fit">{input.source || "Manual"}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="documents">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Documentos e Anexos</h3>
                        <label htmlFor="file-upload">
                          <input
                            id="file-upload"
                            type="file"
                            className="hidden"
                            accept=".pdf,.xls,.xlsx,.csv,.json,.xml,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadDocumentMutation.mutate(file);
                            }}
                            data-testid="input-file-upload"
                          />
                          <Button asChild disabled={uploadDocumentMutation.isPending}>
                            <span>
                              {uploadDocumentMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4 mr-2" />
                              )}
                              Upload
                            </span>
                          </Button>
                        </label>
                      </div>

                      {documents.length === 0 ? (
                        <Card className="p-8 text-center">
                          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-muted-foreground">Nenhum documento anexado</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Faça upload de demonstrativos, contratos e outros documentos
                          </p>
                        </Card>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {documents.map((doc: any) => (
                            <Card key={doc.id} className="p-3 flex items-center gap-3" data-testid={`document-${doc.id}`}>
                              <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{doc.name}</p>
                                <p className="text-xs text-muted-foreground">{doc.folder || doc.fileType}</p>
                              </div>
                              <Button variant="ghost" size="icon" asChild>
                                <a href={`/api/valuation/projects/${selectedProject.id}/documents/${doc.id}/download`} download>
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="sector">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Análise Setorial com Pesos</h3>
                        <Button 
                          onClick={() => calculateSectorMutation.mutate()}
                          disabled={calculateSectorMutation.isPending}
                          data-testid="btn-calculate-sector"
                        >
                          {calculateSectorMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Calcular Análise
                        </Button>
                      </div>

                      {sectorAnalysis?.latest ? (
                        <div className="grid grid-cols-2 gap-6">
                          {/* Score Circular */}
                          <Card className="p-6 bg-slate-900 text-white">
                            <p className="text-sm text-slate-400 mb-4">Score Geral de Maturidade</p>
                            <div className="flex items-center justify-center">
                              <div className="relative w-40 h-40">
                                <svg className="w-40 h-40 transform -rotate-90">
                                  <circle
                                    cx="80"
                                    cy="80"
                                    r="70"
                                    fill="none"
                                    stroke="#334155"
                                    strokeWidth="12"
                                  />
                                  <circle
                                    cx="80"
                                    cy="80"
                                    r="70"
                                    fill="none"
                                    stroke="#eab308"
                                    strokeWidth="12"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(sectorAnalysis.latest.overallScore / 100) * 440} 440`}
                                  />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-4xl font-bold">{sectorAnalysis.latest.overallScore}</span>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 text-center">
                              <p className="font-medium text-lg">{getScoreLevel(sectorAnalysis.latest.overallScore).label}</p>
                              <p className="text-sm text-slate-400">
                                {sectorAnalysis.latest.overallScore >= 60 
                                  ? "A empresa possui processos definidos" 
                                  : "A empresa carece de otimização"}
                              </p>
                            </div>
                          </Card>

                          {/* Pontos fortes/fracos */}
                          <div className="space-y-4">
                            {sectorAnalysis.latest.strengths?.length > 0 && (
                              <Card className="p-4">
                                <p className="font-medium text-sm text-emerald-600 mb-2 flex items-center gap-1">
                                  <CheckCircle className="h-4 w-4" /> Pontos Fortes
                                </p>
                                <ul className="space-y-1 text-sm">
                                  {sectorAnalysis.latest.strengths.map((s: string, i: number) => (
                                    <li key={i} className="text-muted-foreground">• {s}</li>
                                  ))}
                                </ul>
                              </Card>
                            )}
                            {sectorAnalysis.latest.weaknesses?.length > 0 && (
                              <Card className="p-4">
                                <p className="font-medium text-sm text-red-600 mb-2 flex items-center gap-1">
                                  <AlertCircle className="h-4 w-4" /> Pontos de Atenção
                                </p>
                                <ul className="space-y-1 text-sm">
                                  {sectorAnalysis.latest.weaknesses.map((w: string, i: number) => (
                                    <li key={i} className="text-muted-foreground">• {w}</li>
                                  ))}
                                </ul>
                              </Card>
                            )}
                            {sectorAnalysis.latest.recommendations?.length > 0 && (
                              <Card className="p-4">
                                <p className="font-medium text-sm text-blue-600 mb-2 flex items-center gap-1">
                                  <Lightbulb className="h-4 w-4" /> Recomendações
                                </p>
                                <ul className="space-y-1 text-sm">
                                  {sectorAnalysis.latest.recommendations.map((r: string, i: number) => (
                                    <li key={i} className="text-muted-foreground">• {r}</li>
                                  ))}
                                </ul>
                              </Card>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Card className="p-8 text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-muted-foreground">Clique em "Calcular Análise" para gerar o score setorial</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            A análise considera o progresso do checklist, dados financeiros e maturidade
                          </p>
                        </Card>
                      )}
                    </div>
                  </TabsContent>

                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center h-full flex items-center justify-center">
              <div>
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Selecione um projeto para ver os detalhes</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Valuation Project Dialog */}
      <Dialog open={showValuationProjectDialog} onOpenChange={setShowValuationProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Projeto de Valuation</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createValuationProjectMutation.mutate({
              companyName: formData.get("companyName"),
              sector: formData.get("sector"),
              size: formData.get("size"),
              stage: formData.get("stage") || "Growth",
              clientId: formData.get("clientId") ? Number(formData.get("clientId")) : undefined,
            });
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Cliente (CRM)</Label>
                <Select name="clientId">
                  <SelectTrigger data-testid="select-valuation-client">
                    <SelectValue placeholder="Selecione um cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {crmClients.map((client: any) => (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input name="companyName" placeholder="Nome da empresa" required data-testid="input-valuation-company" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select name="sector">
                    <SelectTrigger data-testid="select-valuation-sector">
                      <SelectValue placeholder="Setor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Indústria">Indústria</SelectItem>
                      <SelectItem value="Serviços">Serviços</SelectItem>
                      <SelectItem value="Varejo">Varejo</SelectItem>
                      <SelectItem value="Tecnologia">Tecnologia</SelectItem>
                      <SelectItem value="Agronegócio">Agronegócio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Porte</Label>
                  <Select name="size">
                    <SelectTrigger data-testid="select-valuation-size">
                      <SelectValue placeholder="Porte..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Micro">Micro</SelectItem>
                      <SelectItem value="Pequena">Pequena</SelectItem>
                      <SelectItem value="Média">Média</SelectItem>
                      <SelectItem value="Grande">Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowValuationProjectDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createValuationProjectMutation.isPending} data-testid="btn-create-valuation-project">
                {createValuationProjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Projeto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Financial Input Dialog */}
      <Dialog open={showFinancialDialog} onOpenChange={setShowFinancialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Dados Financeiros</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            saveFinancialInputMutation.mutate({
              inputType: formData.get("inputType"),
              period: formData.get("period"),
              value: formData.get("value"),
              source: formData.get("source") || "manual",
            });
            setShowFinancialDialog(false);
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Indicador</Label>
                <Select name="inputType">
                  <SelectTrigger data-testid="select-financial-type">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="gross_revenue">Receita Bruta</SelectItem>
                    <SelectItem value="net_revenue">Receita Líquida</SelectItem>
                    <SelectItem value="cogs">Custo (CMV)</SelectItem>
                    <SelectItem value="gross_profit">Lucro Bruto</SelectItem>
                    <SelectItem value="operating_expenses">Despesas Operacionais</SelectItem>
                    <SelectItem value="ebitda">EBITDA</SelectItem>
                    <SelectItem value="net_income">Lucro Líquido</SelectItem>
                    <SelectItem value="total_assets">Ativos Totais</SelectItem>
                    <SelectItem value="total_liabilities">Passivos Totais</SelectItem>
                    <SelectItem value="equity">Patrimônio Líquido</SelectItem>
                    <SelectItem value="working_capital">Capital de Giro</SelectItem>
                    <SelectItem value="capex">CAPEX</SelectItem>
                    <SelectItem value="debt">Dívida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select name="period">
                    <SelectTrigger data-testid="select-financial-period">
                      <SelectValue placeholder="Período..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2023">2023</SelectItem>
                      <SelectItem value="2022">2022</SelectItem>
                      <SelectItem value="2021">2021</SelectItem>
                      <SelectItem value="2020">2020</SelectItem>
                      <SelectItem value="TTM">Últimos 12 meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fonte</Label>
                  <Select name="source">
                    <SelectTrigger data-testid="select-financial-source">
                      <SelectValue placeholder="Fonte..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="erp">ERP</SelectItem>
                      <SelectItem value="excel">Planilha</SelectItem>
                      <SelectItem value="accounting">Contabilidade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input 
                  name="value" 
                  type="number" 
                  step="0.01"
                  placeholder="0,00" 
                  required 
                  data-testid="input-financial-value" 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowFinancialDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveFinancialInputMutation.isPending} data-testid="btn-save-financial">
                {saveFinancialInputMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
