import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, TrendingUp, DollarSign, Plus, Search, Edit, Eye,
  CheckCircle, XCircle, Clock, Send, ArrowRight, Building2, ExternalLink,
  Loader2, Calendar, Target, Rocket, BarChart3, AlertCircle, TrendingDown
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { FavorecidoPicker } from "@/components/control/FavorecidoPicker";
import { QuickCreatePessoaDialog } from "@/components/control/QuickCreatePessoaDialog";
import { Link, useLocation } from "wouter";
import { useModules } from "@/hooks/useModules";

type TabType = "dashboard" | "customers" | "proposals" | "projects" | "services" | "pipeline";

// Sprint C-E00 — tipos nativos Arcádia (sem ERPNext)
interface PessoaCliente {
  id: string;
  nomeFantasia: string;
  razaoSocial?: string;
  cnpjCpf?: string;
  tipoPessoa: string;
}

interface EngineeringProject {
  id: string;
  numero: string;
  titulo: string;
  clienteId?: string;
  clienteNome?: string;
  clienteExternoNome?: string;
  descricao?: string;
  etapa: string;
  status: string;
  valorContrato?: number;
  percentualEntregue: number;
  dataInicio?: string;
  dataFim?: string;
  osNumero?: string;
  proposalId?: number;
  createdAt: string;
}

interface FinanceiroResumo {
  valorContrato: number;
  arPrevisto: number;
  arRecebido: number;
  arPendente: number;
  despesasPrevistas: number;
  despesasPagas: number;
  despesasPendentes: number;
  margemEstimada: number | null;
  alertaCusto: "verde" | "amarelo" | "vermelho";
  historico: Array<{
    id: string;
    etapaAnterior?: string;
    etapaAtual: string;
    observacoes?: string;
    usuario_nome?: string;
    created_at: string;
  }>;
}

interface Proposal {
  id: number;
  proposalNumber: string;
  title: string;
  customerId: string;
  customerName: string;
  serviceType: string;
  status: string;
  totalValue: number;
  validUntil: string;
  createdAt: string;
}

interface EnvironmentalService {
  id: number;
  code?: string;
  name: string;
  description?: string;
  category?: string;
  basePrice?: string;
  unit?: string;
  estimatedDuration?: number;
  items?: string[];
  isActive?: number;
}

const defaultServices: EnvironmentalService[] = [
  { id: -1, code: "MON-001", name: "Monitoramento de Águas Subterrâneas", description: "Campanha de monitoramento de poços com análises laboratoriais", category: "Monitoramento", basePrice: "15000", items: ["Mobilização de equipe", "Coleta de amostras", "Análises laboratoriais", "Relatório técnico"] },
  { id: -2, code: "INV-001", name: "Investigação Confirmatória", description: "Investigação de áreas potencialmente contaminadas conforme CONAMA 420", category: "Investigação", basePrice: "45000", items: ["Sondagens", "Instalação de poços", "Coleta de amostras", "Análises laboratoriais", "Modelo conceitual", "Relatório técnico"] },
  { id: -3, code: "INV-002", name: "Investigação Detalhada", description: "Delimitação de plumas de contaminação e avaliação de risco", category: "Investigação", basePrice: "85000", items: ["Sondagens adicionais", "Poços multinível", "Slug tests", "Análises químicas", "Modelagem", "Avaliação de risco", "Relatório técnico"] },
  { id: -4, code: "REM-001", name: "Projeto de Remediação", description: "Elaboração de plano de intervenção para áreas contaminadas", category: "Remediação", basePrice: "35000", items: ["Análise de alternativas", "Dimensionamento", "Projeto executivo", "Cronograma", "Orçamento"] },
  { id: -5, code: "LIC-001", name: "Licenciamento Ambiental", description: "Elaboração de estudos para licenciamento ambiental", category: "Licenciamento", basePrice: "25000", items: ["Diagnóstico ambiental", "Estudos específicos", "Elaboração de EIA/RIMA ou RAS", "Acompanhamento CETESB"] },
];

const serviceCategories = ["Monitoramento", "Investigação", "Remediação", "Licenciamento", "Laudos", "Outros"];

const ETAPA_LABELS: Record<string, string> = {
  venda: "Venda",
  pre_projeto: "Pré-Projeto",
  backlog_tecnico: "Backlog Técnico",
  planejamento: "Planejamento",
  em_execucao: "Em Execução",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const ETAPA_COLORS: Record<string, string> = {
  venda: "bg-blue-500",
  pre_projeto: "bg-purple-500",
  backlog_tecnico: "bg-yellow-500",
  planejamento: "bg-orange-500",
  em_execucao: "bg-green-500",
  concluido: "bg-gray-500",
  cancelado: "bg-red-500",
};

const statusColors: Record<string, string> = {
  rascunho: "bg-gray-500", enviada: "bg-blue-500", aprovada: "bg-green-500",
  recusada: "bg-red-500", ativo: "bg-green-500", pausado: "bg-yellow-500",
  cancelado: "bg-red-500", concluido: "bg-gray-600",
};

const api = {
  get: (url: string) => apiRequest("GET", url).then(r => r.json()),
  post: (url: string, data: any) => apiRequest("POST", url, data).then(r => r.json()),
  put: (url: string, data: any) => apiRequest("PUT", url, data).then(r => r.json()),
  patch: (url: string, data: any) => apiRequest("PATCH", url, data).then(r => r.json()),
  delete: (url: string) => apiRequest("DELETE", url).then(r => r.json()),
};

export default function CommercialEnv() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const modules = useModules();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showQuickCreatePessoa, setShowQuickCreatePessoa] = useState(false);
  const [selectedProject, setSelectedProject] = useState<EngineeringProject | null>(null);
  const [selectedService, setSelectedService] = useState<EnvironmentalService | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [selectedClienteNome, setSelectedClienteNome] = useState<string>("");
  const [editingService, setEditingService] = useState<EnvironmentalService | null>(null);
  const [newItems, setNewItems] = useState("");
  // C-E02: form new project
  const [newProjectClienteId, setNewProjectClienteId] = useState<string | null>(null);
  const [newProjectClienteNome, setNewProjectClienteNome] = useState<string>("");
  // FIX-02: pré-preenchimento a partir de proposta aprovada
  const [prefillProject, setPrefillProject] = useState<{
    titulo?: string; valorContrato?: string; dataFim?: string; proposalId?: number;
  } | null>(null);

  // Sprint C-E00: clientes da tabela nativa pessoas (nunca ERPNext)
  const { data: pessoasClientes = [], isLoading: loadingClientes } = useQuery<PessoaCliente[]>({
    queryKey: ["/api/pessoas", "papel=cliente"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/pessoas?papel=cliente&limit=100");
        return Array.isArray(res) ? res : (res.data ?? []);
      } catch {
        return [];
      }
    },
  });

  // Sprint C-E00: projetos da tabela nativa engineering_projects (nunca ERPNext)
  const { data: engineeringProjects = [], isLoading: loadingProjects, refetch: refetchProjects } = useQuery<EngineeringProject[]>({
    queryKey: ["/api/engineering/projects"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/engineering/projects");
        return Array.isArray(res) ? res : (res.data ?? []);
      } catch {
        return [];
      }
    },
  });

  const { data: proposals = [], refetch: refetchProposals } = useQuery<Proposal[]>({
    queryKey: ["/api/crm/proposals"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/crm/proposals");
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
  });

  const { data: dbServices = [], isLoading: loadingServices, refetch: refetchServices } = useQuery<EnvironmentalService[]>({
    queryKey: ["/api/quality/services"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/quality/services");
        return res.data ?? [];
      } catch {
        return [];
      }
    },
  });

  // Sprint C-E13: financeiro do projeto selecionado
  const { data: projectFinancial } = useQuery<FinanceiroResumo>({
    queryKey: ["/api/engineering/projects", selectedProject?.id, "financeiro-resumo"],
    queryFn: async () => {
      if (!selectedProject?.id) throw new Error("no project");
      return api.get(`/api/engineering/projects/${selectedProject.id}/financeiro-resumo`);
    },
    enabled: !!selectedProject?.id && showProjectDialog,
  });

  const allServices = dbServices.length > 0 ? dbServices : defaultServices;

  // Mutations
  const createProposalMutation = useMutation({
    mutationFn: async (data: any) => api.post("/api/crm/proposals", data),
    onSuccess: () => {
      toast({ title: "Proposta criada com sucesso" });
      refetchProposals();
      setShowProposalDialog(false);
    },
    onError: () => toast({ title: "Erro ao criar proposta", variant: "destructive" }),
  });

  // Sprint C-E02: criar projeto nativo
  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => api.post("/api/engineering/projects", data),
    onSuccess: (proj) => {
      toast({ title: `Projeto ${proj.numero} criado com sucesso` });
      queryClient.invalidateQueries({ queryKey: ["/api/engineering/projects"] });
      setShowNewProjectDialog(false);
      setNewProjectClienteId(null);
      setNewProjectClienteNome("");
      setPrefillProject(null);
      // FIX-01.D: redirecionar para o Hub quando hub_project_id disponível
      if (proj.hub_project_id) {
        navigate(`/hub/${proj.hub_project_id}`);
      }
    },
    onError: (e: any) => toast({ title: "Erro ao criar projeto", description: e.message, variant: "destructive" }),
  });

  // Sprint C-E02: atualizar etapa do projeto
  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      api.patch(`/api/engineering/projects/${id}`, data),
    onSuccess: () => {
      toast({ title: "Projeto atualizado" });
      queryClient.invalidateQueries({ queryKey: ["/api/engineering/projects"] });
      setShowProjectDialog(false);
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar projeto", description: e.message, variant: "destructive" }),
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: any) => api.post("/api/quality/services", data),
    onSuccess: () => {
      toast({ title: "Serviço criado com sucesso" });
      refetchServices();
      setShowServiceDialog(false);
      setEditingService(null);
    },
    onError: () => toast({ title: "Erro ao criar serviço", variant: "destructive" }),
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => api.put(`/api/quality/services/${id}`, data),
    onSuccess: () => {
      toast({ title: "Serviço atualizado com sucesso" });
      refetchServices();
      setShowServiceDialog(false);
      setEditingService(null);
    },
    onError: () => toast({ title: "Erro ao atualizar serviço", variant: "destructive" }),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/quality/services/${id}`),
    onSuccess: () => {
      toast({ title: "Serviço excluído" });
      refetchServices();
    },
    onError: () => toast({ title: "Erro ao excluir serviço", variant: "destructive" }),
  });

  const handleSaveService = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemsArray = newItems.split("\n").filter(i => i.trim());
    const data = {
      code: formData.get("code") as string,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      basePrice: formData.get("basePrice") as string,
      unit: formData.get("unit") as string,
      estimatedDuration: Number(formData.get("estimatedDuration")) || null,
      items: itemsArray.length > 0 ? itemsArray : null,
      isActive: 1,
    };
    if (editingService && editingService.id > 0) {
      updateServiceMutation.mutate({ id: editingService.id, data });
    } else {
      createServiceMutation.mutate(data);
    }
  };

  const getStatusBadge = (status: string) => {
    const color = statusColors[status] || "bg-gray-500";
    const label = ETAPA_LABELS[status] ?? status.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
    return <Badge className={`${color} text-white`}>{label}</Badge>;
  };

  const getEtapaBadge = (etapa: string) => {
    const color = ETAPA_COLORS[etapa] ?? "bg-gray-500";
    return <Badge className={`${color} text-white`}>{ETAPA_LABELS[etapa] ?? etapa}</Badge>;
  };

  // Computed
  const filteredClientes = pessoasClientes.filter(c =>
    c.nomeFantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.razaoSocial ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cnpjCpf ?? "").includes(searchTerm)
  );

  const activeProjects = engineeringProjects.filter(p => p.status === "ativo");
  const completedProjects = engineeringProjects.filter(p => p.status === "concluido");
  const totalPipeline = engineeringProjects
    .filter(p => p.status === "ativo")
    .reduce((s, p) => s + (Number(p.valorContrato) || 0), 0);

  const etapaStages = ["venda", "pre_projeto", "backlog_tecnico", "planejamento", "em_execucao"];

  return (
    <BrowserFrame>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-blue-600" />
              Comercial — Engenharia Ambiental
            </h1>
            <p className="text-muted-foreground">
              Propostas, clientes e pipeline de projetos — dados nativos Arcádia
            </p>
          </div>
          <Button onClick={() => setShowNewProjectDialog(true)} data-testid="btn-new-project">
            <Plus className="h-4 w-4 mr-2" /> Novo Projeto
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList className="h-12">
            <TabsTrigger value="dashboard" className="gap-2" data-testid="tab-commercial-dashboard">
              <BarChart3 className="h-4 w-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2" data-testid="tab-erp-customers">
              <Building2 className="h-4 w-4" /> Clientes
            </TabsTrigger>
            <TabsTrigger value="proposals" className="gap-2" data-testid="tab-proposals">
              <FileText className="h-4 w-4" /> Propostas
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2" data-testid="tab-sales-orders">
              <Rocket className="h-4 w-4" /> Projetos
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2" data-testid="tab-services">
              <Target className="h-4 w-4" /> Serviços
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-2" data-testid="tab-pipeline">
              <TrendingUp className="h-4 w-4" /> Pipeline
            </TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{pessoasClientes.length}</div>
                  <p className="text-xs text-muted-foreground">Total na base nativa</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Projetos Ativos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">{activeProjects.length}</div>
                  <p className="text-xs text-muted-foreground">Em andamento</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Projetos Concluídos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{completedProjects.length}</div>
                  <p className="text-xs text-muted-foreground">Finalizados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    {totalPipeline.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                  <p className="text-xs text-muted-foreground">Valor em projetos ativos</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Projetos Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Etapa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {engineeringProjects.slice(0, 5).map((proj) => (
                        <TableRow key={proj.id}>
                          <TableCell className="font-medium">{proj.numero}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{proj.clienteNome ?? "-"}</TableCell>
                          <TableCell>{proj.valorContrato ? Number(proj.valorContrato).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}</TableCell>
                          <TableCell>{getEtapaBadge(proj.etapa)}</TableCell>
                        </TableRow>
                      ))}
                      {engineeringProjects.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                            Nenhum projeto criado. Clique em "Novo Projeto" para começar.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Serviços Mais Vendidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {allServices.slice(0, 4).map((service) => (
                      <div key={service.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{service.name}</p>
                          <p className="text-xs text-muted-foreground">{service.category}</p>
                        </div>
                        <Badge variant="outline">
                          {Number(service.basePrice ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── CLIENTES ──────────────────────────────────────────────────── */}
          <TabsContent value="customers" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar clientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                  data-testid="search-customers"
                />
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="h-9 px-3 flex items-center">
                  <Building2 className="h-4 w-4 mr-1" /> {pessoasClientes.length} clientes
                </Badge>
                <Button asChild variant="outline" size="sm">
                  <Link href="/pessoas">
                    <ExternalLink className="h-4 w-4 mr-2" /> Gerenciar Cadastros
                  </Link>
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {loadingClientes ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome / Fantasia</TableHead>
                        <TableHead>Razão Social</TableHead>
                        <TableHead>CNPJ/CPF</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClientes.map((cliente) => (
                        <TableRow key={cliente.id} data-testid={`row-cliente-${cliente.id}`}>
                          <TableCell className="font-medium">{cliente.nomeFantasia}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{cliente.razaoSocial ?? "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{cliente.cnpjCpf ?? "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{cliente.tipoPessoa === "J" ? "PJ" : "PF"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedClienteId(cliente.id);
                                setSelectedClienteNome(cliente.nomeFantasia);
                                setShowProposalDialog(true);
                              }}
                            >
                              <FileText className="h-4 w-4 mr-1" /> Nova Proposta
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredClientes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            {pessoasClientes.length === 0
                              ? "Nenhum cliente cadastrado. Acesse Pessoas para cadastrar."
                              : "Nenhum cliente encontrado para a busca."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PROPOSTAS ─────────────────────────────────────────────────── */}
          <TabsContent value="proposals" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Propostas Comerciais</h2>
              <Button onClick={() => setShowProposalDialog(true)} data-testid="btn-new-proposal">
                <Plus className="h-4 w-4 mr-2" /> Nova Proposta
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposals.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.proposalNumber || `PROP-${p.id}`}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.title}</TableCell>
                        <TableCell>{p.customerName || "-"}</TableCell>
                        <TableCell>{p.serviceType || "-"}</TableCell>
                        <TableCell>{(p.totalValue || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                        <TableCell>{getStatusBadge(p.status || "rascunho")}</TableCell>
                        <TableCell className="text-right">
                          {p.status === "aprovada" && (
                            <Button
                              size="sm"
                              variant="default"
                              className="mr-1 h-7 text-xs"
                              onClick={() => {
                                setPrefillProject({
                                  titulo: p.title,
                                  valorContrato: p.totalValue ? String(p.totalValue) : "",
                                  dataFim: p.validUntil?.slice(0, 10) ?? "",
                                  proposalId: p.id,
                                });
                                setNewProjectClienteId(p.customerId ?? null);
                                setNewProjectClienteNome(p.customerName ?? "");
                                setShowNewProjectDialog(true);
                              }}
                              data-testid={`btn-iniciar-projeto-${p.id}`}
                            >
                              <Rocket className="h-3 w-3 mr-1" /> Iniciar Projeto
                            </Button>
                          )}
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon"><Send className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {proposals.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhuma proposta cadastrada. Clique em "Nova Proposta" para começar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PROJETOS ──────────────────────────────────────────────────── */}
          <TabsContent value="projects" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Projetos de Engenharia</h2>
                <p className="text-sm text-muted-foreground">Fluxo: Venda → Pré-Projeto → Backlog → Planejamento → Execução</p>
              </div>
              <Button onClick={() => setShowNewProjectDialog(true)} data-testid="btn-new-project-tab">
                <Plus className="h-4 w-4 mr-2" /> Novo Projeto
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
              {etapaStages.map((etapa) => (
                <Card key={etapa} className={`border-l-4 border-l-${ETAPA_COLORS[etapa]?.replace("bg-", "")}`}>
                  <CardContent className="pt-4 pb-2">
                    <p className="text-2xl font-bold">
                      {engineeringProjects.filter(p => p.etapa === etapa && p.status === "ativo").length}
                    </p>
                    <p className="text-xs text-muted-foreground">{ETAPA_LABELS[etapa]}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="p-0">
                {loadingProjects ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead>Etapa</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {engineeringProjects.map((proj) => (
                        <TableRow key={proj.id} data-testid={`row-project-${proj.id}`}>
                          <TableCell className="font-medium">{proj.numero}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{proj.titulo}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{proj.clienteNome ?? "-"}</TableCell>
                          <TableCell>
                            {proj.valorContrato
                              ? Number(proj.valorContrato).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500" style={{ width: `${proj.percentualEntregue ?? 0}%` }} />
                              </div>
                              <span className="text-xs">{proj.percentualEntregue ?? 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{getEtapaBadge(proj.etapa)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setSelectedProject(proj); setShowProjectDialog(true); }}
                              data-testid={`btn-manage-project-${proj.id}`}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {engineeringProjects.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhum projeto criado. Clique em "Novo Projeto" para começar.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SERVIÇOS ──────────────────────────────────────────────────── */}
          <TabsContent value="services" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Catálogo de Serviços — Engenharia Ambiental</h2>
              <Button data-testid="btn-new-service" onClick={() => { setEditingService(null); setNewItems(""); setShowServiceDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo Serviço
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allServices.map((service) => (
                <Card key={service.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{service.category}</Badge>
                      {service.basePrice && (
                        <span className="text-lg font-bold text-green-600">
                          {Number(service.basePrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-base">{service.name}</CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {service.items && service.items.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground mb-2">Itens inclusos:</p>
                        <ul className="text-xs space-y-1">
                          {service.items.map((item, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <div className="flex gap-2 mt-4">
                      {service.id > 0 && (
                        <Button variant="outline" size="sm" onClick={() => { setEditingService(service); setNewItems(service.items?.join("\n") || ""); setShowServiceDialog(true); }}>
                          <Edit className="h-3 w-3 mr-1" /> Editar
                        </Button>
                      )}
                      <Button size="sm" onClick={() => { setSelectedService(service); setShowProposalDialog(true); }}>
                        Criar Proposta
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── PIPELINE ──────────────────────────────────────────────────── */}
          <TabsContent value="pipeline" className="space-y-4">
            <h2 className="text-lg font-semibold">Pipeline de Vendas</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-t-4 border-t-gray-400">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Prospecção</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">R$ 0,00</p>
                </CardContent>
              </Card>
              <Card className="border-t-4 border-t-blue-400">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Proposta Enviada</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{proposals.filter((p: any) => p.status === "enviada").length}</div>
                  <p className="text-xs text-muted-foreground">Em negociação</p>
                </CardContent>
              </Card>
              <Card className="border-t-4 border-t-yellow-400">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Em Execução</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeProjects.filter(p => p.etapa === "em_execucao").length}</div>
                  <p className="text-xs text-muted-foreground">
                    {activeProjects.filter(p => p.etapa === "em_execucao").reduce((s, p) => s + (Number(p.valorContrato) || 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-t-4 border-t-green-400">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Concluído</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completedProjects.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {completedProjects.reduce((s, p) => s + (Number(p.valorContrato) || 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Fluxo: Proposta → Projeto</CardTitle>
                <CardDescription>Workflow de conversão comercial para Engenharia Ambiental</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  {[
                    { icon: FileText, label: "Proposta", color: "bg-blue-100", iconColor: "text-blue-600" },
                    { icon: Send, label: "Negociação", color: "bg-yellow-100", iconColor: "text-yellow-600" },
                    { icon: CheckCircle, label: "Aprovação", color: "bg-purple-100", iconColor: "text-purple-600" },
                    { icon: DollarSign, label: "Pedido", color: "bg-orange-100", iconColor: "text-orange-600" },
                    { icon: Rocket, label: "Projeto", color: "bg-green-100", iconColor: "text-green-600" },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className={`w-16 h-16 rounded-full ${step.color} flex items-center justify-center`}>
                          <step.icon className={`h-8 w-8 ${step.iconColor}`} />
                        </div>
                        <span className="text-sm mt-2">{step.label}</span>
                      </div>
                      {i < 4 && <ArrowRight className="h-6 w-6 text-gray-400 mx-2" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* ── DIALOG: NOVA PROPOSTA ─────────────────────────────────────── */}
        <Dialog open={showProposalDialog} onOpenChange={setShowProposalDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova Proposta Comercial</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createProposalMutation.mutate({
                title: formData.get("title") as string,
                opportunityId: null,
                status: "rascunho",
                validUntil: formData.get("validUntil") as string,
                totalValue: selectedService?.basePrice || Number(formData.get("totalValue")) || 0,
                notes: formData.get("notes") as string,
                customerName: selectedClienteNome || undefined,
              });
            }}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select
                      value={selectedClienteId}
                      onValueChange={(v) => {
                        setSelectedClienteId(v);
                        const c = pessoasClientes.find(p => p.id === v);
                        setSelectedClienteNome(c?.nomeFantasia ?? "");
                      }}
                    >
                      <SelectTrigger data-testid="select-proposal-cliente">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {pessoasClientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nomeFantasia}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Serviço</Label>
                    <Select
                      value={selectedService?.id?.toString()}
                      onValueChange={(v) => setSelectedService(allServices.find(s => s.id.toString() === v) || null)}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                      <SelectContent>
                        {allServices.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Título da Proposta *</Label>
                  <Input
                    id="title" name="title"
                    placeholder="Ex: Monitoramento Semestral — Cliente X"
                    defaultValue={selectedService ? `${selectedService.name} — ${selectedClienteNome}` : ""}
                    required
                  />
                </div>

                {selectedService && (
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{selectedService.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{selectedService.description}</p>
                      {selectedService.items && selectedService.items.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {selectedService.items.map((item, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>
                          ))}
                        </div>
                      )}
                      {selectedService.basePrice && (
                        <p className="mt-3 text-lg font-bold text-green-600">
                          Valor base: {Number(selectedService.basePrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalValue">Valor Total (R$)</Label>
                    <Input id="totalValue" name="totalValue" type="number" defaultValue={selectedService?.basePrice || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validUntil">Válida até</Label>
                    <Input id="validUntil" name="validUntil" type="date" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea id="notes" name="notes" placeholder="Condições especiais, escopo adicional..." />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowProposalDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={createProposalMutation.isPending}>
                  {createProposalMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Criar Proposta
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── DIALOG: NOVO PROJETO (C-E02) ──────────────────────────────── */}
        <Dialog open={showNewProjectDialog} onOpenChange={(v) => { setShowNewProjectDialog(v); if (!v) setPrefillProject(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                {prefillProject ? "Iniciar Projeto a partir de Proposta" : "Novo Projeto de Engenharia"}
              </DialogTitle>
            </DialogHeader>
            <form key={prefillProject?.proposalId ?? "new"} onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createProjectMutation.mutate({
                titulo: fd.get("titulo") as string,
                clienteId: newProjectClienteId ?? undefined,
                clienteNome: newProjectClienteNome || undefined,
                descricao: fd.get("descricao") as string || undefined,
                valorContrato: fd.get("valorContrato") ? Number(fd.get("valorContrato")) : undefined,
                dataInicio: fd.get("dataInicio") as string || undefined,
                dataFim: fd.get("dataFim") as string || undefined,
                osNumero: fd.get("osNumero") as string || undefined,
                proposalId: prefillProject?.proposalId ?? undefined,
                etapa: "venda",
                status: "ativo",
              });
            }}>
              <div className="space-y-4 py-2">
                {prefillProject && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    Dados pré-preenchidos da proposta aprovada
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="titulo">Título do Projeto *</Label>
                  <Input id="titulo" name="titulo" placeholder="Ex: Monitoramento de Águas — Petrobras SP"
                    defaultValue={prefillProject?.titulo ?? ""}
                    required data-testid="input-project-titulo" />
                </div>

                <div className="space-y-2">
                  <Label>Cliente (Pessoa Jurídica / Física)</Label>
                  <FavorecidoPicker
                    value={newProjectClienteId ?? undefined}
                    label={newProjectClienteNome}
                    onChange={(id, pessoa) => {
                      setNewProjectClienteId(id);
                      setNewProjectClienteNome(pessoa?.nomeFantasia ?? "");
                    }}
                    placeholder="Buscar cliente..."
                    tipos={["cliente"]}
                    showQuickCreate
                    onQuickCreate={() => setShowQuickCreatePessoa(true)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valorContrato">Valor do Contrato (R$)</Label>
                    <Input id="valorContrato" name="valorContrato" type="number" step="0.01" placeholder="0,00"
                      defaultValue={prefillProject?.valorContrato ?? ""}
                      data-testid="input-project-valor" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="osNumero">Nº OS / Pedido</Label>
                    <Input id="osNumero" name="osNumero" placeholder="Ex: OS-2026-001" data-testid="input-project-os" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataInicio">Data de Início</Label>
                    <Input id="dataInicio" name="dataInicio" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataFim">Previsão de Fim</Label>
                    <Input id="dataFim" name="dataFim" type="date"
                      defaultValue={prefillProject?.dataFim ?? ""} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição / Escopo</Label>
                  <Textarea id="descricao" name="descricao" placeholder="Descreva o escopo do projeto..." rows={3} />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setShowNewProjectDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={createProjectMutation.isPending} data-testid="btn-create-project-submit">
                  {createProjectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Criar Projeto
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── DIALOG: EDITAR SERVIÇO ────────────────────────────────────── */}
        <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingService ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveService}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Código</Label>
                    <Input id="code" name="code" placeholder="Ex: MON-001" defaultValue={editingService?.code || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select name="category" defaultValue={editingService?.category || "Monitoramento"}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {serviceCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Serviço *</Label>
                  <Input id="name" name="name" placeholder="Ex: Monitoramento de Águas Subterrâneas" defaultValue={editingService?.name || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" name="description" defaultValue={editingService?.description || ""} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="basePrice">Valor Base (R$)</Label>
                    <Input id="basePrice" name="basePrice" type="number" step="0.01" defaultValue={editingService?.basePrice || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidade</Label>
                    <Input id="unit" name="unit" placeholder="campanha" defaultValue={editingService?.unit || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedDuration">Duração (dias)</Label>
                    <Input id="estimatedDuration" name="estimatedDuration" type="number" defaultValue={editingService?.estimatedDuration || ""} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Itens Inclusos (um por linha)</Label>
                  <Textarea
                    value={newItems}
                    onChange={(e) => setNewItems(e.target.value)}
                    placeholder={"Mobilização de equipe\nColeta de amostras\nAnálises laboratoriais\nRelatório técnico"}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowServiceDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={createServiceMutation.isPending || updateServiceMutation.isPending}>
                  {(createServiceMutation.isPending || updateServiceMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingService ? "Salvar" : "Criar Serviço"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── DIALOG: GERENCIAR PROJETO (C-E13 financeiro) ─────────────── */}
        <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                {selectedProject?.numero} — {selectedProject?.titulo}
              </DialogTitle>
            </DialogHeader>
            {selectedProject && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <span className="text-sm text-muted-foreground">Cliente</span>
                    <p className="font-medium">{selectedProject.clienteNome ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Valor Contrato</span>
                    <p className="font-medium text-green-600">
                      {selectedProject.valorContrato
                        ? Number(selectedProject.valorContrato).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "—"}
                    </p>
                  </div>
                  {selectedProject.osNumero && (
                    <div>
                      <span className="text-sm text-muted-foreground">Nº OS</span>
                      <p className="font-medium">{selectedProject.osNumero}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-muted-foreground">Status</span>
                    <p>{getStatusBadge(selectedProject.status)}</p>
                  </div>
                </div>

                {/* Sprint C-E12: link "Ver no Control" */}
                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/control">
                      <ExternalLink className="h-4 w-4 mr-2" /> Ver no Control
                    </Link>
                  </Button>
                </div>

                {/* Fluxo de Etapas */}
                <div className="space-y-2">
                  <Label>Fluxo do Projeto</Label>
                  <div className="flex items-center gap-1 flex-wrap">
                    {etapaStages.map((etapa, idx) => {
                      const stages = etapaStages;
                      const currentIdx = stages.indexOf(selectedProject.etapa);
                      const isActive = idx <= currentIdx;
                      return (
                        <div key={etapa} className="flex items-center">
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${isActive ? `${ETAPA_COLORS[etapa]} text-white` : "bg-gray-200 text-gray-600"}`}>
                            {ETAPA_LABELS[etapa]}
                          </div>
                          {idx < stages.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Avançar etapa para</Label>
                    <Select
                      defaultValue={selectedProject.etapa}
                      onValueChange={(val) => setSelectedProject({ ...selectedProject, etapa: val })}
                    >
                      <SelectTrigger data-testid="select-project-stage">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {etapaStages.map(e => (
                          <SelectItem key={e} value={e}>{ETAPA_LABELS[e]}</SelectItem>
                        ))}
                        <SelectItem value="concluido">Concluído</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectObs">Observações da alteração</Label>
                    <Textarea id="projectObs" placeholder="Motivo da mudança de etapa..." rows={2} />
                  </div>
                </div>

                {/* Sprint C-E13: Situação Financeira em Tempo Real */}
                {projectFinancial && (
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">Situação Financeira</h3>
                      {projectFinancial.alertaCusto === "vermelho" && (
                        <Badge className="bg-red-500 text-white text-xs">Custo acima do orçamento</Badge>
                      )}
                      {projectFinancial.alertaCusto === "amarelo" && (
                        <Badge className="bg-yellow-500 text-white text-xs">Custo próximo do limite</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">AR Previsto</p>
                        <p className="font-bold text-sm text-blue-600">
                          {projectFinancial.arPrevisto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">AR Recebido</p>
                        <p className="font-bold text-sm text-green-600">
                          {projectFinancial.arRecebido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      </div>
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Despesas</p>
                        <p className={`font-bold text-sm ${projectFinancial.alertaCusto === "vermelho" ? "text-red-600" : "text-orange-600"}`}>
                          {projectFinancial.despesasPrevistas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      </div>
                    </div>

                    {projectFinancial.margemEstimada !== null && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                        {projectFinancial.margemEstimada >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span>Margem estimada: <strong>{projectFinancial.margemEstimada.toFixed(1)}%</strong></span>
                      </div>
                    )}

                    {/* Timeline de etapas */}
                    {projectFinancial.historico.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Timeline de Etapas</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {projectFinancial.historico.map((h) => (
                            <div key={h.id} className="flex items-center gap-2 text-xs p-2 bg-muted/30 rounded">
                              <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-muted-foreground">{new Date(h.created_at).toLocaleDateString("pt-BR")}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <Badge className={`${ETAPA_COLORS[h.etapaAtual] ?? "bg-gray-500"} text-white text-xs py-0`}>
                                {ETAPA_LABELS[h.etapaAtual] ?? h.etapaAtual}
                              </Badge>
                              {h.observacoes && <span className="text-muted-foreground truncate">{h.observacoes}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowProjectDialog(false)}>Fechar</Button>
                  <Button
                    onClick={() => {
                      const obs = (document.getElementById("projectObs") as HTMLTextAreaElement)?.value;
                      updateProjectMutation.mutate({
                        id: selectedProject.id,
                        data: { etapa: selectedProject.etapa, observacoes: obs },
                      });
                    }}
                    disabled={updateProjectMutation.isPending}
                    data-testid="btn-save-project"
                  >
                    {updateProjectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Salvar Alterações
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── DIALOG: CADASTRO RÁPIDO DE PESSOA (C-E12) ────────────────── */}
        <QuickCreatePessoaDialog
          open={showQuickCreatePessoa}
          onOpenChange={setShowQuickCreatePessoa}
          papelPadrao="cliente"
          onCreated={(pessoa) => {
            setNewProjectClienteId(pessoa.id);
            setNewProjectClienteNome(pessoa.nomeFantasia);
          }}
        />
      </div>
    </BrowserFrame>
  );
}
