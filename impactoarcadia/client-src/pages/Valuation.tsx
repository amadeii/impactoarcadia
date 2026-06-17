import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Building2, TrendingUp, Calculator, PieChart, FileText,
  BarChart3, DollarSign, Calendar, MoreHorizontal, Trash2,
  ChevronRight, Users, Target, Bot, Send, Loader2, Upload,
  ClipboardCheck, CheckCircle2, Circle, AlertCircle, Sparkles, ChevronDown, Download, X,
  Layers, RefreshCw, Shield, Compass, Zap, ArrowUpRight, ArrowDownRight,
  Grid3X3, Activity, Award, Flame, Search
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";

const sectors = ["Tecnologia", "Varejo", "Indústria", "Serviços", "Agronegócio", "Saúde", "Educação", "Financeiro", "Imobiliário", "Logística"];
const stages = ["Startup", "Growth", "Mature", "Turnaround", "Exit"];
const sizes = ["Micro", "Pequena", "Média", "Grande"];
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function fmt(v: string | number | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!n && n !== 0) return "-";
  if (Math.abs(n) >= 1e6) return `R$ ${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `R$ ${(n / 1e3).toFixed(1)}K`;
  return `R$ ${n.toFixed(2)}`;
}

function pct(v: string | number | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!n && n !== 0) return "-";
  return `${n.toFixed(1)}%`;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiPost(url: string, body: any) {
  return apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function apiPatch(url: string, body: any) {
  return apiFetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function apiDelete(url: string) {
  return apiFetch(url, { method: "DELETE" });
}

export default function Valuation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [agentMessages, setAgentMessages] = useState<{ role: string; content: string }[]>([]);
  const [agentInput, setAgentInput] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [newInputOpen, setNewInputOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "analyzing" | "review">("upload");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<any[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [swotNewItem, setSwotNewItem] = useState({ quadrant: "strengths", item: "", impact: "medium" });
  const [pdcaNewItem, setPdcaNewItem] = useState({ title: "", originArea: "governance", priority: "medium", description: "" });
  const [assetNewItem, setAssetNewItem] = useState({ assetType: "physical", name: "", bookValue: "", marketValue: "" });
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const [newProject, setNewProject] = useState({
    companyName: "", cnpj: "", sector: "", businessModel: "", stage: "Growth",
    size: "Média", projectType: "simple", notes: "", clientId: null as number | null,
  });

  const [newInput, setNewInput] = useState({
    year: new Date().getFullYear(), isProjection: 0, revenue: "", grossProfit: "",
    ebitda: "", ebit: "", netIncome: "", totalAssets: "", totalLiabilities: "",
    totalEquity: "", cash: "", debt: "", freeCashFlow: "", capex: "",
  });

  const pid = selectedProject?.id;
  const base = `/api/valuation/projects/${pid}`;

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/valuation/projects"],
    queryFn: () => apiFetch("/api/valuation/projects").catch(() => []),
  });

  const { data: inputs = [] } = useQuery<any[]>({
    queryKey: ["val-inputs", pid],
    queryFn: () => apiFetch(`${base}/inputs`),
    enabled: !!pid,
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["val-summary", pid],
    queryFn: () => apiFetch(`${base}/summary`).catch(() => null),
    enabled: !!pid,
  });

  const { data: results = [] } = useQuery<any[]>({
    queryKey: ["val-results", pid],
    queryFn: () => apiFetch(`${base}/results`).catch(() => []),
    enabled: !!pid,
  });

  const { data: governance = [] } = useQuery<any[]>({
    queryKey: ["val-governance", pid],
    queryFn: () => apiFetch(`${base}/governance`).catch(() => []),
    enabled: !!pid,
  });

  const { data: swotItems = [] } = useQuery<any[]>({
    queryKey: ["val-swot", pid],
    queryFn: () => apiFetch(`${base}/swot`).catch(() => []),
    enabled: !!pid,
  });

  const { data: pdcaItems = [] } = useQuery<any[]>({
    queryKey: ["val-pdca", pid],
    queryFn: () => apiFetch(`${base}/pdca`).catch(() => []),
    enabled: !!pid,
  });

  const { data: assets = [] } = useQuery<any[]>({
    queryKey: ["val-assets", pid],
    queryFn: () => apiFetch(`${base}/assets`).catch(() => []),
    enabled: !!pid,
  });

  const { data: aiLogs = [] } = useQuery<any[]>({
    queryKey: ["val-ai-feed", pid],
    queryFn: () => apiFetch(`${base}/ai-feed`).catch(() => []),
    enabled: !!pid,
  });

  const { data: canvasBlocks = [] } = useQuery<any[]>({
    queryKey: ["val-canvas", pid],
    queryFn: () => apiFetch(`${base}/canvas`).catch(() => []),
    enabled: !!pid,
  });

  const { data: checklistProgress = [], refetch: refetchProgress } = useQuery<any[]>({
    queryKey: ["val-checklist", pid],
    queryFn: () => apiFetch(`${base}/checklist`).catch(() => []),
    enabled: !!pid,
  });

  const { data: checklistCategories = [] } = useQuery<any[]>({
    queryKey: ["val-cl-cats"],
    queryFn: () => apiFetch("/api/valuation/checklist/categories").catch(() => []),
    enabled: !!pid,
  });

  const { data: checklistItems = [] } = useQuery<any[]>({
    queryKey: ["val-cl-items"],
    queryFn: () => apiFetch("/api/valuation/checklist/items").catch(() => []),
    enabled: !!pid,
  });

  const filteredProjects = useMemo(() => {
    if (!projectSearch) return projects;
    const s = projectSearch.toLowerCase();
    return projects.filter((p: any) => p.companyName?.toLowerCase().includes(s) || p.sector?.toLowerCase().includes(s));
  }, [projects, projectSearch]);

  const inv = (...keys: string[]) => keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k, pid] }));
  const invAll = () => inv("val-inputs", "val-results", "val-summary", "val-governance", "val-swot", "val-pdca", "val-assets", "val-ai-feed", "val-canvas", "val-checklist");

  const createProject = useMutation({
    mutationFn: (data: typeof newProject) => apiPost("/api/valuation/projects", data),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuation/projects"] });
      setNewProjectOpen(false);
      setNewProject({ companyName: "", cnpj: "", sector: "", businessModel: "", stage: "Growth", size: "Média", projectType: "simple", notes: "", clientId: null });
      toast({ title: "Projeto criado com sucesso" });
    },
  });

  const deleteProject = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/valuation/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuation/projects"] });
      setSelectedProject(null);
      toast({ title: "Projeto excluído" });
    },
  });

  const createInput = useMutation({
    mutationFn: (data: typeof newInput) => apiPost(`${base}/inputs`, data),
    onSuccess: () => {
      inv("val-inputs", "val-summary");
      setNewInputOpen(false);
      toast({ title: "Dados financeiros adicionados" });
    },
  });

  const runCalculation = async () => {
    if (!pid) return;
    setCalculating(true);
    try {
      await apiPost(`${base}/calculate`, {});
      invAll();
      toast({ title: "Cálculo de valuation concluído" });
    } catch { toast({ title: "Erro no cálculo", variant: "destructive" }); }
    finally { setCalculating(false); }
  };

  const initGovernance = async () => {
    if (!pid) return;
    try {
      await apiPost(`${base}/governance/initialize`, {});
      inv("val-governance");
      toast({ title: "Governança inicializada com 20 critérios" });
    } catch { toast({ title: "Erro ao inicializar governança", variant: "destructive" }); }
  };

  const updateGovScore = async (criterionId: number, currentScore: number) => {
    try {
      await apiPatch(`${base}/governance/${criterionId}`, { currentScore });
      inv("val-governance", "val-summary");
    } catch { toast({ title: "Erro ao atualizar", variant: "destructive" }); }
  };

  const generateSwot = async () => {
    if (!pid) return;
    try {
      await apiPost(`${base}/swot/generate`, {});
      inv("val-swot", "val-ai-feed");
      toast({ title: "SWOT gerado com IA" });
    } catch { toast({ title: "Erro ao gerar SWOT", variant: "destructive" }); }
  };

  const addSwotItem = async () => {
    if (!pid || !swotNewItem.item) return;
    try {
      await apiPost(`${base}/swot`, swotNewItem);
      inv("val-swot");
      setSwotNewItem({ quadrant: "strengths", item: "", impact: "medium" });
    } catch { toast({ title: "Erro ao adicionar", variant: "destructive" }); }
  };

  const deleteSwotItem = async (itemId: number) => {
    try {
      await apiDelete(`${base}/swot/${itemId}`);
      inv("val-swot");
    } catch {}
  };

  const addPdcaItem = async () => {
    if (!pid || !pdcaNewItem.title) return;
    try {
      await apiPost(`${base}/pdca`, pdcaNewItem);
      inv("val-pdca");
      setPdcaNewItem({ title: "", originArea: "governance", priority: "medium", description: "" });
    } catch { toast({ title: "Erro ao adicionar", variant: "destructive" }); }
  };

  const updatePdcaPhase = async (itemId: number, phase: string) => {
    try {
      await apiPatch(`${base}/pdca/${itemId}`, { phase });
      inv("val-pdca");
    } catch {}
  };

  const deletePdcaItem = async (itemId: number) => {
    try {
      await apiDelete(`${base}/pdca/${itemId}`);
      inv("val-pdca");
    } catch {}
  };

  const addAsset = async () => {
    if (!pid || !assetNewItem.name) return;
    try {
      await apiPost(`${base}/assets`, assetNewItem);
      inv("val-assets");
      setAssetNewItem({ assetType: "physical", name: "", bookValue: "", marketValue: "" });
    } catch { toast({ title: "Erro ao adicionar", variant: "destructive" }); }
  };

  const deleteAsset = async (id: number) => {
    try {
      await apiDelete(`${base}/assets/${id}`);
      inv("val-assets");
    } catch {}
  };

  const generateReport = async (type: string) => {
    if (!pid) return;
    setReportGenerating(true);
    try {
      const data = await apiPost(`${base}/reports/generate`, { reportType: type, format: "html" });
      setReportContent(data.content || "");
      setShowReport(true);
      toast({ title: "Relatório gerado" });
    } catch { toast({ title: "Erro ao gerar relatório", variant: "destructive" }); }
    finally { setReportGenerating(false); }
  };

  const sendAgentMessage = async () => {
    if (!agentInput.trim() || !pid) return;
    setAgentMessages(prev => [...prev, { role: "user", content: agentInput }]);
    setAgentInput("");
    setAgentLoading(true);
    try {
      const data = await apiPost(`${base}/ai-chat`, { message: agentInput });
      setAgentMessages(prev => [...prev, { role: "assistant", content: data.reply || "Sem resposta" }]);
      inv("val-ai-feed");
    } catch {
      setAgentMessages(prev => [...prev, { role: "assistant", content: "Erro ao conectar com o assistente." }]);
    } finally { setAgentLoading(false); }
  };

  const initChecklist = async () => {
    if (!pid) return;
    try {
      await apiFetch(`${base}/checklist/initialize`, { method: "POST" });
      refetchProgress();
      toast({ title: "Checklist inicializado" });
    } catch { toast({ title: "Erro ao inicializar", variant: "destructive" }); }
  };

  const updateChecklistItem = async (itemId: number, status: string) => {
    try {
      await apiFetch(`${base}/checklist/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      refetchProgress();
    } catch {}
  };

  const generateProjections = async () => {
    if (!pid) return;
    try {
      await apiPost(`${base}/projections`, { years: 5 });
      inv("val-inputs", "val-summary");
      toast({ title: "Projeções geradas (5 anos)" });
    } catch { toast({ title: "Erro ao gerar projeções", variant: "destructive" }); }
  };

  const handleImportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pid) return;
    setImportFile(file);
    setImportStep("analyzing");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${base}/import-financial`, { method: "POST", body: formData, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setImportedData(data.rows || []);
        setImportStep("review");
      } else { setImportStep("upload"); toast({ title: "Erro ao processar", variant: "destructive" }); }
    } catch { setImportStep("upload"); }
  };

  const saveImportedData = async () => {
    if (!pid || !importedData.length) return;
    for (const row of importedData) {
      await apiPost(`${base}/inputs`, row);
    }
    inv("val-inputs", "val-summary");
    setImportOpen(false);
    setImportStep("upload");
    setImportedData([]);
    toast({ title: `${importedData.length} anos importados` });
  };

  const govCategories = useMemo(() => {
    const cats: Record<string, any[]> = {};
    governance.forEach((g: any) => {
      if (!cats[g.category]) cats[g.category] = [];
      cats[g.category].push(g);
    });
    return cats;
  }, [governance]);

  const govRadarData = useMemo(() => {
    return Object.entries(govCategories).map(([cat, items]) => {
      const avg = items.reduce((s: number, i: any) => s + (i.currentScore || 0), 0) / items.length;
      const avgTarget = items.reduce((s: number, i: any) => s + (i.targetScore || 10), 0) / items.length;
      return { category: cat, current: avg, target: avgTarget };
    });
  }, [govCategories]);

  const historicalInputs = useMemo(() => inputs.filter((i: any) => !i.isProjection).sort((a: any, b: any) => a.year - b.year), [inputs]);
  const projectedInputs = useMemo(() => inputs.filter((i: any) => i.isProjection).sort((a: any, b: any) => a.year - b.year), [inputs]);

  const financialChartData = useMemo(() => {
    return inputs.sort((a: any, b: any) => a.year - b.year).map((i: any) => ({
      year: i.year,
      receita: parseFloat(i.revenue || "0") / 1e6,
      ebitda: parseFloat(i.ebitda || "0") / 1e6,
      lucro: parseFloat(i.netIncome || "0") / 1e6,
      fcf: parseFloat(i.freeCashFlow || "0") / 1e6,
      isProjection: !!i.isProjection,
    }));
  }, [inputs]);

  const baseResults = useMemo(() => results.filter((r: any) => r.scenario === "base"), [results]);

  const methodPieData = useMemo(() => {
    return baseResults.map((r: any) => ({
      name: { dcf: "DCF", ev_ebitda: "EV/EBITDA", ev_revenue: "EV/Receita", patrimonial: "Patrimonial", assets: "Ativos" }[r.method] || r.method,
      value: parseFloat(r.enterpriseValue || "0") / 1e6,
    }));
  }, [baseResults]);

  const scenarioBarData = useMemo(() => {
    const scenarios: Record<string, number> = {};
    results.forEach((r: any) => {
      if (!scenarios[r.scenario]) scenarios[r.scenario] = 0;
      scenarios[r.scenario] += parseFloat(r.enterpriseValue || "0") * parseFloat(r.weight || "0");
    });
    return Object.entries(scenarios).map(([s, v]) => ({
      scenario: { conservative: "Conservador", base: "Base", optimistic: "Otimista" }[s] || s,
      valor: v / 1e6,
    }));
  }, [results]);

  const pdcaHeatMap = useMemo(() => {
    const areas = ["governance", "financial", "operational", "commercial", "hr", "technology", "legal", "esg"];
    const priorities = ["critical", "high", "medium", "low"];
    const map: Record<string, number> = {};
    pdcaItems.forEach((p: any) => {
      const key = `${p.originArea}-${p.priority}`;
      map[key] = (map[key] || 0) + 1;
    });
    return { areas, priorities, map };
  }, [pdcaItems]);

  return (
    <BrowserFrame title="Valuation" url="/compass/valuation">
      <div className="flex h-full" data-testid="valuation-page">
        {/* Sidebar */}
        <div className="w-72 border-r bg-muted/30 flex flex-col">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm flex items-center gap-1">
                <Building2 className="h-4 w-4" /> Projetos
              </h3>
              <Button size="sm" variant="outline" onClick={() => setNewProjectOpen(true)} data-testid="button-new-project">
                <Plus className="h-3 w-3 mr-1" /> Novo
              </Button>
            </div>
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2 top-2.5 text-muted-foreground" />
              <Input placeholder="Buscar..." className="h-8 text-xs pl-7" value={projectSearch} onChange={e => setProjectSearch(e.target.value)} data-testid="input-project-search" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filteredProjects.map((p: any) => (
              <div
                key={p.id}
                className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition ${selectedProject?.id === p.id ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                onClick={() => { setSelectedProject(p); setActiveTab("overview"); }}
                data-testid={`card-project-${p.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{p.companyName}</span>
                  <Badge variant="outline" className="text-[10px]">{p.projectType === "governance" ? "Gov" : "Simples"}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{p.sector}</span>
                  <span className="text-xs text-muted-foreground">|</span>
                  <span className="text-xs text-muted-foreground">{p.size}</span>
                </div>
                {p.currentValuation && (
                  <p className="text-xs text-primary mt-1 font-medium">{fmt(p.currentValuation)}</p>
                )}
              </div>
            ))}
            {filteredProjects.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">Nenhum projeto encontrado</div>
            )}
          </ScrollArea>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedProject ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h2 className="text-lg font-semibold mb-1">Módulo de Valuation</h2>
                <p className="text-sm text-muted-foreground mb-4">Selecione um projeto ou crie um novo para começar</p>
                <Button onClick={() => setNewProjectOpen(true)} data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-1" /> Novo Projeto
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b px-4 py-2 flex items-center justify-between bg-background">
                <div>
                  <h2 className="font-semibold">{selectedProject.companyName}</h2>
                  <p className="text-xs text-muted-foreground">{selectedProject.sector} | {selectedProject.size} | {selectedProject.stage}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={calculating ? "secondary" : "default"} onClick={runCalculation} disabled={calculating} data-testid="button-calculate">
                    {calculating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Calculator className="h-3 w-3 mr-1" />}
                    {calculating ? "Calculando..." : "Calcular Valuation"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAgentPanel(!showAgentPanel)} data-testid="button-agent-toggle">
                    <Bot className="h-3 w-3 mr-1" /> Agente IA
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => generateReport("executive")} data-testid="menu-report-executive">Relatório Executivo</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generateReport("technical")} data-testid="menu-report-technical">Relatório Técnico</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteProject.mutate(selectedProject.id)} data-testid="menu-delete-project">Excluir Projeto</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-auto">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <TabsList className="mx-4 mt-2 justify-start flex-wrap h-auto gap-1">
                      <TabsTrigger value="overview" className="text-xs" data-testid="tab-overview"><Target className="h-3 w-3 mr-1" />Visão Geral</TabsTrigger>
                      <TabsTrigger value="checklist" className="text-xs" data-testid="tab-checklist"><ClipboardCheck className="h-3 w-3 mr-1" />Checklist</TabsTrigger>
                      <TabsTrigger value="financials" className="text-xs" data-testid="tab-financials"><DollarSign className="h-3 w-3 mr-1" />Financeiro</TabsTrigger>
                      <TabsTrigger value="governance" className="text-xs" data-testid="tab-governance"><Shield className="h-3 w-3 mr-1" />Governança</TabsTrigger>
                      <TabsTrigger value="swot" className="text-xs" data-testid="tab-swot"><Compass className="h-3 w-3 mr-1" />SWOT</TabsTrigger>
                      <TabsTrigger value="canvas" className="text-xs" data-testid="tab-canvas"><Grid3X3 className="h-3 w-3 mr-1" />Canvas</TabsTrigger>
                      <TabsTrigger value="pdca" className="text-xs" data-testid="tab-pdca"><Activity className="h-3 w-3 mr-1" />PDCA</TabsTrigger>
                      <TabsTrigger value="analysis" className="text-xs" data-testid="tab-analysis"><BarChart3 className="h-3 w-3 mr-1" />Análise</TabsTrigger>
                      <TabsTrigger value="assets" className="text-xs" data-testid="tab-assets"><Layers className="h-3 w-3 mr-1" />Ativos</TabsTrigger>
                      <TabsTrigger value="documents" className="text-xs" data-testid="tab-documents"><FileText className="h-3 w-3 mr-1" />Documentos</TabsTrigger>
                    </TabsList>

                    <ScrollArea className="flex-1 px-4 pb-4">
                      {/* ===== OVERVIEW TAB ===== */}
                      <TabsContent value="overview" className="mt-3 space-y-4">
                        <div className="grid grid-cols-4 gap-3">
                          <Card className="p-4" data-testid="card-checklist-progress">
                            <div className="flex items-center gap-2 mb-2">
                              <ClipboardCheck className="h-4 w-4 text-blue-500" />
                              <span className="text-xs text-muted-foreground">Progresso</span>
                            </div>
                            <p className="text-2xl font-bold">{summary?.checklist?.progress || 0}%</p>
                            <Progress value={summary?.checklist?.progress || 0} className="mt-2" />
                            <p className="text-xs text-muted-foreground mt-1">{summary?.checklist?.completed || 0}/{summary?.checklist?.total || 0} itens</p>
                          </Card>
                          <Card className="p-4" data-testid="card-current-valuation">
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="h-4 w-4 text-green-500" />
                              <span className="text-xs text-muted-foreground">Valuation Atual</span>
                            </div>
                            <p className="text-2xl font-bold">{fmt(summary?.valuation?.currentEV)}</p>
                            <p className="text-xs text-muted-foreground mt-1">Enterprise Value</p>
                          </Card>
                          <Card className="p-4" data-testid="card-projected-valuation">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="h-4 w-4 text-emerald-500" />
                              <span className="text-xs text-muted-foreground">Valuation Projetado</span>
                            </div>
                            <p className="text-2xl font-bold">{fmt(summary?.valuation?.projectedEV)}</p>
                            <p className="text-xs text-muted-foreground mt-1">Com melhorias de governança</p>
                          </Card>
                          <Card className="p-4" data-testid="card-value-creation">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="h-4 w-4 text-amber-500" />
                              <span className="text-xs text-muted-foreground">Criação de Valor</span>
                            </div>
                            <p className="text-2xl font-bold">
                              {summary?.valuation?.creationPct ? `+${summary.valuation.creationPct}%` : "-"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{fmt(summary?.valuation?.creationOfValue)}</p>
                          </Card>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <Card className="p-4">
                            <h3 className="font-medium text-sm mb-3 flex items-center gap-2"><Shield className="h-4 w-4" /> Governança</h3>
                            {summary?.governance ? (
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Score Atual</span>
                                  <span className="font-semibold">{summary.governance.currentScore}/10</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Score Projetado</span>
                                  <span className="font-semibold">{summary.governance.projectedScore}/10</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Uplift Potencial</span>
                                  <span className="font-semibold text-green-600">+{summary.governance.uplift}%</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Redução WACC</span>
                                  <span className="font-semibold text-green-600">-{summary.governance.waccReduction}%</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-sm text-muted-foreground mb-2">Governança não inicializada</p>
                                <Button size="sm" onClick={initGovernance} data-testid="button-init-gov-overview">Inicializar 20 Critérios</Button>
                              </div>
                            )}
                          </Card>

                          <Card className="p-4">
                            <h3 className="font-medium text-sm mb-3 flex items-center gap-2"><Bot className="h-4 w-4" /> Feed do Agente IA</h3>
                            {aiLogs.length > 0 ? (
                              <div className="space-y-2 max-h-48 overflow-auto">
                                {aiLogs.slice(0, 5).map((log: any) => (
                                  <div key={log.id} className="flex items-start gap-2 text-xs">
                                    <Badge variant="outline" className="text-[10px] shrink-0">
                                      {log.eventType === "calculation" ? "Calc" : log.eventType === "chat" ? "Chat" : log.eventType === "swot_generation" ? "SWOT" : log.eventType}
                                    </Badge>
                                    <span className="text-muted-foreground truncate">{log.outputSummary}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ação registrada</p>
                            )}
                          </Card>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <Card className="p-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Compass className="h-4 w-4 text-blue-500" />
                              <span>SWOT</span>
                              <Badge variant="secondary" className="ml-auto">{summary?.swot?.total || 0}</Badge>
                            </div>
                          </Card>
                          <Card className="p-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Activity className="h-4 w-4 text-orange-500" />
                              <span>PDCA</span>
                              <Badge variant="secondary" className="ml-auto">{summary?.pdca?.completed || 0}/{summary?.pdca?.total || 0}</Badge>
                            </div>
                          </Card>
                          <Card className="p-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Layers className="h-4 w-4 text-purple-500" />
                              <span>Ativos</span>
                              <Badge variant="secondary" className="ml-auto">{fmt(summary?.assets?.totalMarketValue)}</Badge>
                            </div>
                          </Card>
                        </div>
                      </TabsContent>

                      {/* ===== CHECKLIST TAB ===== */}
                      <TabsContent value="checklist" className="mt-3 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">Checklist de Documentos</h3>
                          <Button size="sm" onClick={initChecklist} data-testid="button-init-checklist">
                            <RefreshCw className="h-3 w-3 mr-1" /> Inicializar
                          </Button>
                        </div>
                        {checklistCategories.length > 0 ? (
                          checklistCategories.map((cat: any) => {
                            const catItems = checklistItems.filter((i: any) => i.categoryId === cat.id);
                            const completed = catItems.filter((i: any) => {
                              const prog = checklistProgress.find((p: any) => p.itemId === i.id);
                              return prog?.status === "uploaded" || prog?.status === "completed";
                            }).length;
                            return (
                              <Card key={cat.id} className="p-3">
                                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}>
                                  <div className="flex items-center gap-2">
                                    <ChevronDown className={`h-4 w-4 transition ${expandedCategory === cat.id ? "rotate-0" : "-rotate-90"}`} />
                                    <span className="font-medium text-sm">{cat.name}</span>
                                    <Badge variant="secondary" className="text-xs">{completed}/{catItems.length}</Badge>
                                  </div>
                                  <Progress value={catItems.length > 0 ? (completed / catItems.length) * 100 : 0} className="w-24" />
                                </div>
                                {expandedCategory === cat.id && (
                                  <div className="mt-3 space-y-2 ml-6">
                                    {catItems.map((item: any) => {
                                      const prog = checklistProgress.find((p: any) => p.itemId === item.id);
                                      const st = prog?.status || "pending";
                                      return (
                                        <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                                          <div className="flex items-center gap-2">
                                            {st === "uploaded" || st === "completed" ? (
                                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            ) : st === "not_available" ? (
                                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                                            ) : (
                                              <Circle className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span className={st === "uploaded" || st === "completed" ? "line-through text-muted-foreground" : ""}>{item.title}</span>
                                          </div>
                                          <Select value={st} onValueChange={(v) => updateChecklistItem(item.id, v)}>
                                            <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="pending">Pendente</SelectItem>
                                              <SelectItem value="uploaded">Enviado</SelectItem>
                                              <SelectItem value="not_available">Não disponível</SelectItem>
                                              <SelectItem value="deferred">Adiado</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </Card>
                            );
                          })
                        ) : (
                          <Card className="p-8 text-center">
                            <ClipboardCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">Clique em "Inicializar" para criar o checklist</p>
                          </Card>
                        )}
                      </TabsContent>

                      {/* ===== FINANCIALS TAB ===== */}
                      <TabsContent value="financials" className="mt-3 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">Dados Financeiros</h3>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={generateProjections} data-testid="button-gen-projections">
                              <Sparkles className="h-3 w-3 mr-1" /> Gerar Projeções
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import-data">
                              <Upload className="h-3 w-3 mr-1" /> Importar
                            </Button>
                            <Button size="sm" onClick={() => setNewInputOpen(true)} data-testid="button-add-input">
                              <Plus className="h-3 w-3 mr-1" /> Adicionar Ano
                            </Button>
                          </div>
                        </div>

                        {financialChartData.length > 0 && (
                          <Card className="p-4">
                            <h4 className="text-sm font-medium mb-3">Evolução Financeira (R$ Milhões)</h4>
                            <ResponsiveContainer width="100%" height={250}>
                              <AreaChart data={financialChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="year" />
                                <YAxis />
                                <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}M`} />
                                <Legend />
                                <Area type="monotone" dataKey="receita" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" name="Receita" />
                                <Area type="monotone" dataKey="ebitda" fill="#10b981" fillOpacity={0.1} stroke="#10b981" name="EBITDA" />
                                <Area type="monotone" dataKey="lucro" fill="#f59e0b" fillOpacity={0.1} stroke="#f59e0b" name="Lucro Líquido" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </Card>
                        )}

                        <Card className="p-4">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left">
                                  <th className="py-2 pr-4">Ano</th>
                                  <th className="py-2 pr-4">Tipo</th>
                                  <th className="py-2 pr-4 text-right">Receita</th>
                                  <th className="py-2 pr-4 text-right">EBITDA</th>
                                  <th className="py-2 pr-4 text-right">Lucro Líquido</th>
                                  <th className="py-2 pr-4 text-right">Ativos</th>
                                  <th className="py-2 pr-4 text-right">PL</th>
                                  <th className="py-2 pr-4 text-right">FCF</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inputs.sort((a: any, b: any) => a.year - b.year).map((i: any) => (
                                  <tr key={i.id} className={`border-b ${i.isProjection ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`} data-testid={`row-input-${i.id}`}>
                                    <td className="py-2 pr-4 font-medium">{i.year}</td>
                                    <td className="py-2 pr-4"><Badge variant={i.isProjection ? "secondary" : "default"} className="text-[10px]">{i.isProjection ? "Projeção" : "Histórico"}</Badge></td>
                                    <td className="py-2 pr-4 text-right">{fmt(i.revenue)}</td>
                                    <td className="py-2 pr-4 text-right">{fmt(i.ebitda)}</td>
                                    <td className="py-2 pr-4 text-right">{fmt(i.netIncome)}</td>
                                    <td className="py-2 pr-4 text-right">{fmt(i.totalAssets)}</td>
                                    <td className="py-2 pr-4 text-right">{fmt(i.totalEquity)}</td>
                                    <td className="py-2 pr-4 text-right">{fmt(i.freeCashFlow)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Card>
                      </TabsContent>

                      {/* ===== GOVERNANCE TAB ===== */}
                      <TabsContent value="governance" className="mt-3 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">Governança Corporativa</h3>
                          {governance.length === 0 && (
                            <Button size="sm" onClick={initGovernance} data-testid="button-init-governance">
                              <Shield className="h-3 w-3 mr-1" /> Inicializar 20 Critérios
                            </Button>
                          )}
                        </div>

                        {governance.length > 0 && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <Card className="p-4">
                                <h4 className="text-sm font-medium mb-3">Radar de Governança</h4>
                                <ResponsiveContainer width="100%" height={250}>
                                  <RadarChart data={govRadarData}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                                    <PolarRadiusAxis domain={[0, 10]} />
                                    <Radar name="Atual" dataKey="current" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                                    <Radar name="Meta" dataKey="target" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                                    <Legend />
                                  </RadarChart>
                                </ResponsiveContainer>
                              </Card>
                              <Card className="p-4">
                                <h4 className="text-sm font-medium mb-3">Impacto por Categoria</h4>
                                <ResponsiveContainer width="100%" height={250}>
                                  <BarChart data={govRadarData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                                    <YAxis domain={[0, 10]} />
                                    <Tooltip />
                                    <Bar dataKey="current" fill="#ef4444" name="Atual" />
                                    <Bar dataKey="target" fill="#10b981" name="Meta" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </Card>
                            </div>

                            {Object.entries(govCategories).map(([cat, items]) => (
                              <Card key={cat} className="p-4">
                                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                  <Award className="h-4 w-4" /> {cat}
                                  <Badge variant="secondary" className="ml-auto">
                                    {(items.reduce((s: number, i: any) => s + (i.currentScore || 0), 0) / items.length).toFixed(1)}/10
                                  </Badge>
                                </h4>
                                <div className="space-y-3">
                                  {items.map((g: any) => (
                                    <div key={g.id} className="flex items-center gap-4" data-testid={`governance-${g.id}`}>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{g.criterionName}</p>
                                        <p className="text-xs text-muted-foreground">Impacto: {g.valuationImpactPct}% no valuation</p>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs w-6 text-right">{g.currentScore || 0}</span>
                                        <input
                                          type="range"
                                          min="0"
                                          max="10"
                                          value={g.currentScore || 0}
                                          onChange={(e) => updateGovScore(g.id, parseInt(e.target.value))}
                                          className="w-32 accent-primary"
                                          data-testid={`slider-gov-${g.id}`}
                                        />
                                        <span className="text-xs w-6">/10</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </Card>
                            ))}
                          </>
                        )}
                        {governance.length === 0 && (
                          <Card className="p-12 text-center">
                            <Shield className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground mb-2">Nenhum critério de governança configurado</p>
                            <p className="text-xs text-muted-foreground">Inicialize para avaliar 20 critérios em 6 categorias</p>
                          </Card>
                        )}
                      </TabsContent>

                      {/* ===== SWOT TAB ===== */}
                      <TabsContent value="swot" className="mt-3 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">Análise SWOT</h3>
                          <Button size="sm" onClick={generateSwot} data-testid="button-gen-swot">
                            <Sparkles className="h-3 w-3 mr-1" /> Gerar com IA
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {(["strengths", "weaknesses", "opportunities", "threats"] as const).map((q) => {
                            const labels = { strengths: "Forças", weaknesses: "Fraquezas", opportunities: "Oportunidades", threats: "Ameaças" };
                            const colors = { strengths: "bg-green-50 border-green-200 dark:bg-green-950/20", weaknesses: "bg-red-50 border-red-200 dark:bg-red-950/20", opportunities: "bg-blue-50 border-blue-200 dark:bg-blue-950/20", threats: "bg-orange-50 border-orange-200 dark:bg-orange-950/20" };
                            const icons = { strengths: <ArrowUpRight className="h-4 w-4 text-green-600" />, weaknesses: <ArrowDownRight className="h-4 w-4 text-red-600" />, opportunities: <TrendingUp className="h-4 w-4 text-blue-600" />, threats: <AlertCircle className="h-4 w-4 text-orange-600" /> };
                            const items = swotItems.filter((s: any) => s.quadrant === q);
                            return (
                              <Card key={q} className={`p-4 border ${colors[q]}`} data-testid={`swot-quadrant-${q}`}>
                                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">{icons[q]} {labels[q]}</h4>
                                <div className="space-y-2">
                                  {items.map((item: any) => (
                                    <div key={item.id} className="flex items-start justify-between text-sm bg-background/60 rounded p-2">
                                      <div>
                                        <p>{item.item}</p>
                                        <div className="flex gap-2 mt-1">
                                          <Badge variant="outline" className="text-[10px]">Impacto: {item.impact}</Badge>
                                          <Badge variant="outline" className="text-[10px]">Val: {item.valuationRelevance}/10</Badge>
                                        </div>
                                      </div>
                                      <Button size="sm" variant="ghost" onClick={() => deleteSwotItem(item.id)} className="h-6 w-6 p-0">
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                  {items.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item</p>}
                                </div>
                              </Card>
                            );
                          })}
                        </div>

                        <Card className="p-4">
                          <h4 className="text-sm font-medium mb-3">Adicionar Item</h4>
                          <div className="flex gap-2">
                            <Select value={swotNewItem.quadrant} onValueChange={v => setSwotNewItem({ ...swotNewItem, quadrant: v })}>
                              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="strengths">Forças</SelectItem>
                                <SelectItem value="weaknesses">Fraquezas</SelectItem>
                                <SelectItem value="opportunities">Oportunidades</SelectItem>
                                <SelectItem value="threats">Ameaças</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input placeholder="Descreva o item..." value={swotNewItem.item} onChange={e => setSwotNewItem({ ...swotNewItem, item: e.target.value })} className="flex-1" data-testid="input-swot-item" />
                            <Select value={swotNewItem.impact} onValueChange={v => setSwotNewItem({ ...swotNewItem, impact: v })}>
                              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Baixo</SelectItem>
                                <SelectItem value="medium">Médio</SelectItem>
                                <SelectItem value="high">Alto</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" onClick={addSwotItem} data-testid="button-add-swot"><Plus className="h-3 w-3" /></Button>
                          </div>
                        </Card>
                      </TabsContent>

                      {/* ===== CANVAS TAB ===== */}
                      <TabsContent value="canvas" className="mt-3 space-y-4">
                        <h3 className="font-medium">Canvas Dual (Atual vs Projetado)</h3>
                        <div className="grid grid-cols-3 gap-3" style={{ gridTemplateRows: "auto auto auto" }}>
                          {["key_partners", "key_activities", "value_proposition", "customer_relationships", "customer_segments",
                            "key_resources", "channels", "cost_structure", "revenue_streams"].map((blockType) => {
                            const labels: Record<string, string> = {
                              key_partners: "Parceiros-Chave", key_activities: "Atividades-Chave",
                              key_resources: "Recursos-Chave", value_proposition: "Proposta de Valor",
                              customer_relationships: "Relacionamento", channels: "Canais",
                              customer_segments: "Segmentos", cost_structure: "Estrutura de Custos",
                              revenue_streams: "Fontes de Receita",
                            };
                            const block = canvasBlocks.find((b: any) => b.blockType === blockType);
                            return (
                              <Card key={blockType} className="p-3" data-testid={`canvas-block-${blockType}`}>
                                <h5 className="text-xs font-medium mb-2 text-primary">{labels[blockType]}</h5>
                                <div className="text-xs text-muted-foreground min-h-[40px]">
                                  {block?.items?.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-0.5">
                                      {(block.items as string[]).slice(0, 4).map((item: string, i: number) => (
                                        <li key={i}>{item}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="italic">Clique para editar</span>
                                  )}
                                </div>
                                {block?.score !== undefined && (
                                  <div className="mt-2 flex items-center gap-1">
                                    <span className="text-[10px]">Score:</span>
                                    <Badge variant="secondary" className="text-[10px]">{block.score}/10</Badge>
                                  </div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      </TabsContent>

                      {/* ===== PDCA TAB ===== */}
                      <TabsContent value="pdca" className="mt-3 space-y-4">
                        <h3 className="font-medium">PDCA - Melhoria Contínua</h3>

                        <Card className="p-4">
                          <h4 className="text-sm font-medium mb-3">Mapa de Calor</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  <th className="text-left py-1 pr-2">Área</th>
                                  {["critical", "high", "medium", "low"].map(p => (
                                    <th key={p} className="text-center py-1 px-2 capitalize">{p}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {pdcaHeatMap.areas.map(area => (
                                  <tr key={area}>
                                    <td className="py-1 pr-2 capitalize font-medium">{area}</td>
                                    {pdcaHeatMap.priorities.map(pri => {
                                      const count = pdcaHeatMap.map[`${area}-${pri}`] || 0;
                                      const bg = count === 0 ? "bg-gray-100 dark:bg-gray-800" :
                                        count <= 1 ? "bg-green-200 dark:bg-green-800" :
                                        count <= 2 ? "bg-yellow-200 dark:bg-yellow-800" :
                                        "bg-red-200 dark:bg-red-800";
                                      return (
                                        <td key={pri} className="text-center py-1 px-2">
                                          <span className={`inline-block w-8 h-8 rounded flex items-center justify-center ${bg}`}>
                                            {count || ""}
                                          </span>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Card>

                        <div className="grid grid-cols-4 gap-3">
                          {(["plan", "do", "check", "act"] as const).map(phase => {
                            const phaseLabels = { plan: "Planejar", do: "Executar", check: "Verificar", act: "Agir" };
                            const phaseColors = { plan: "border-blue-300", do: "border-yellow-300", check: "border-green-300", act: "border-purple-300" };
                            const items = pdcaItems.filter((p: any) => p.phase === phase);
                            return (
                              <Card key={phase} className={`p-3 border-t-4 ${phaseColors[phase]}`} data-testid={`pdca-phase-${phase}`}>
                                <h5 className="text-sm font-medium mb-2">{phaseLabels[phase]} ({items.length})</h5>
                                <div className="space-y-2 min-h-[100px]">
                                  {items.map((item: any) => (
                                    <div key={item.id} className="bg-muted/50 rounded p-2 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{item.title}</span>
                                        <div className="flex gap-1">
                                          {phase !== "act" && (
                                            <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => updatePdcaPhase(item.id, phase === "plan" ? "do" : phase === "do" ? "check" : "act")}>
                                              <ChevronRight className="h-3 w-3" />
                                            </Button>
                                          )}
                                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => deletePdcaItem(item.id)}>
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                      <Badge variant="outline" className="text-[9px] mt-1">{item.originArea} | {item.priority}</Badge>
                                    </div>
                                  ))}
                                </div>
                              </Card>
                            );
                          })}
                        </div>

                        <Card className="p-4">
                          <h4 className="text-sm font-medium mb-3">Nova Ação PDCA</h4>
                          <div className="grid grid-cols-4 gap-2">
                            <Input placeholder="Título da ação" value={pdcaNewItem.title} onChange={e => setPdcaNewItem({ ...pdcaNewItem, title: e.target.value })} data-testid="input-pdca-title" />
                            <Select value={pdcaNewItem.originArea} onValueChange={v => setPdcaNewItem({ ...pdcaNewItem, originArea: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["governance", "financial", "operational", "commercial", "hr", "technology", "legal", "esg"].map(a => (
                                  <SelectItem key={a} value={a}>{a}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={pdcaNewItem.priority} onValueChange={v => setPdcaNewItem({ ...pdcaNewItem, priority: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="critical">Crítica</SelectItem>
                                <SelectItem value="high">Alta</SelectItem>
                                <SelectItem value="medium">Média</SelectItem>
                                <SelectItem value="low">Baixa</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button onClick={addPdcaItem} data-testid="button-add-pdca"><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                          </div>
                        </Card>
                      </TabsContent>

                      {/* ===== ANALYSIS / BI TAB ===== */}
                      <TabsContent value="analysis" className="mt-3 space-y-4">
                        <h3 className="font-medium">Dashboard de Análise</h3>

                        {results.length === 0 ? (
                          <Card className="p-12 text-center">
                            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground mb-2">Execute o cálculo de valuation para ver análises</p>
                            <Button onClick={runCalculation} disabled={calculating} data-testid="button-calc-analysis">
                              <Calculator className="h-4 w-4 mr-1" /> Calcular Valuation
                            </Button>
                          </Card>
                        ) : (
                          <>
                            <div className="grid grid-cols-3 gap-4">
                              <Card className="p-4">
                                <h4 className="text-sm font-medium mb-3">Decomposição por Método (Base)</h4>
                                <ResponsiveContainer width="100%" height={200}>
                                  <RePieChart>
                                    <Pie data={methodPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: R$ ${value.toFixed(1)}M`}>
                                      {methodPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}M`} />
                                  </RePieChart>
                                </ResponsiveContainer>
                              </Card>

                              <Card className="p-4">
                                <h4 className="text-sm font-medium mb-3">Cenários</h4>
                                <ResponsiveContainer width="100%" height={200}>
                                  <BarChart data={scenarioBarData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="scenario" />
                                    <YAxis />
                                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}M`} />
                                    <Bar dataKey="valor" fill="#3b82f6" name="EV (R$ M)" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </Card>

                              <Card className="p-4">
                                <h4 className="text-sm font-medium mb-3">Resultados por Método</h4>
                                <div className="space-y-2">
                                  {baseResults.map((r: any, i: number) => {
                                    const methodLabel: Record<string, string> = { dcf: "DCF", ev_ebitda: "EV/EBITDA", ev_revenue: "EV/Receita", patrimonial: "Patrimonial", assets: "Ativos" };
                                    return (
                                      <div key={i} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                          <span>{methodLabel[r.method] || r.method}</span>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-medium">{fmt(r.enterpriseValue)}</p>
                                          <p className="text-xs text-muted-foreground">Peso: {(parseFloat(r.weight || "0") * 100).toFixed(0)}%</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </Card>
                            </div>

                            {financialChartData.length > 0 && (
                              <Card className="p-4">
                                <h4 className="text-sm font-medium mb-3">Projeção de FCF (R$ Milhões)</h4>
                                <ResponsiveContainer width="100%" height={200}>
                                  <LineChart data={financialChartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="year" />
                                    <YAxis />
                                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}M`} />
                                    <Legend />
                                    <Line type="monotone" dataKey="fcf" stroke="#8b5cf6" name="FCF" strokeWidth={2} />
                                    <Line type="monotone" dataKey="ebitda" stroke="#10b981" name="EBITDA" strokeDasharray="5 5" />
                                  </LineChart>
                                </ResponsiveContainer>
                              </Card>
                            )}
                          </>
                        )}
                      </TabsContent>

                      {/* ===== ASSETS TAB ===== */}
                      <TabsContent value="assets" className="mt-3 space-y-4">
                        <h3 className="font-medium">Inventário de Ativos</h3>

                        {assets.length > 0 && (
                          <div className="grid grid-cols-3 gap-3">
                            <Card className="p-4">
                              <p className="text-xs text-muted-foreground">Valor Contábil Total</p>
                              <p className="text-xl font-bold">{fmt(assets.reduce((s: number, a: any) => s + parseFloat(a.bookValue || "0"), 0).toString())}</p>
                            </Card>
                            <Card className="p-4">
                              <p className="text-xs text-muted-foreground">Valor de Mercado Total</p>
                              <p className="text-xl font-bold">{fmt(assets.reduce((s: number, a: any) => s + parseFloat(a.marketValue || "0"), 0).toString())}</p>
                            </Card>
                            <Card className="p-4">
                              <p className="text-xs text-muted-foreground">Total de Ativos</p>
                              <p className="text-xl font-bold">{assets.length}</p>
                            </Card>
                          </div>
                        )}

                        <Card className="p-4">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left">
                                  <th className="py-2">Nome</th>
                                  <th className="py-2">Tipo</th>
                                  <th className="py-2 text-right">Valor Contábil</th>
                                  <th className="py-2 text-right">Valor de Mercado</th>
                                  <th className="py-2">Status</th>
                                  <th className="py-2"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {assets.map((a: any) => (
                                  <tr key={a.id} className="border-b" data-testid={`row-asset-${a.id}`}>
                                    <td className="py-2 font-medium">{a.name}</td>
                                    <td className="py-2"><Badge variant="outline" className="text-xs">{a.assetType}</Badge></td>
                                    <td className="py-2 text-right">{fmt(a.bookValue)}</td>
                                    <td className="py-2 text-right">{fmt(a.marketValue)}</td>
                                    <td className="py-2"><Badge variant="secondary" className="text-xs">{a.status}</Badge></td>
                                    <td className="py-2"><Button size="sm" variant="ghost" onClick={() => deleteAsset(a.id)}><Trash2 className="h-3 w-3" /></Button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Card>

                        <Card className="p-4">
                          <h4 className="text-sm font-medium mb-3">Adicionar Ativo</h4>
                          <div className="grid grid-cols-5 gap-2">
                            <Select value={assetNewItem.assetType} onValueChange={v => setAssetNewItem({ ...assetNewItem, assetType: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="physical">Físico</SelectItem>
                                <SelectItem value="intangible">Intangível</SelectItem>
                                <SelectItem value="digital">Digital</SelectItem>
                                <SelectItem value="social">Social</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input placeholder="Nome" value={assetNewItem.name} onChange={e => setAssetNewItem({ ...assetNewItem, name: e.target.value })} data-testid="input-asset-name" />
                            <Input placeholder="Valor contábil" type="number" value={assetNewItem.bookValue} onChange={e => setAssetNewItem({ ...assetNewItem, bookValue: e.target.value })} />
                            <Input placeholder="Valor mercado" type="number" value={assetNewItem.marketValue} onChange={e => setAssetNewItem({ ...assetNewItem, marketValue: e.target.value })} />
                            <Button onClick={addAsset} data-testid="button-add-asset"><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                          </div>
                        </Card>
                      </TabsContent>

                      {/* ===== DOCUMENTS TAB ===== */}
                      <TabsContent value="documents" className="mt-3 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">Data Room</h3>
                          <Button size="sm" variant="outline" data-testid="button-upload-doc">
                            <Upload className="h-3 w-3 mr-1" /> Upload
                          </Button>
                        </div>
                        <Card className="p-12 text-center">
                          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                          <p className="text-muted-foreground">Arraste documentos aqui ou clique em Upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PDFs, planilhas, demonstrativos financeiros</p>
                        </Card>
                      </TabsContent>
                    </ScrollArea>
                  </Tabs>
                </div>

                {/* Agent Panel */}
                {showAgentPanel && (
                  <div className="w-80 border-l flex flex-col bg-muted/10">
                    <div className="p-3 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Consultor IA</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setShowAgentPanel(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 p-3">
                      <div className="space-y-3">
                        {agentMessages.length === 0 && (
                          <div className="text-center py-6">
                            <Sparkles className="h-6 w-6 mx-auto text-primary mb-2" />
                            <p className="text-xs text-muted-foreground">Pergunte sobre valuation, premissas, governança...</p>
                          </div>
                        )}
                        {agentMessages.map((msg, i) => (
                          <div key={i} className={`text-sm p-2 rounded ${msg.role === "user" ? "bg-primary/10 ml-4" : "bg-muted mr-4"}`}>
                            {msg.content}
                          </div>
                        ))}
                        {agentLoading && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Pensando...
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                    <div className="p-3 border-t">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Pergunte ao consultor..."
                          value={agentInput}
                          onChange={e => setAgentInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && sendAgentMessage()}
                          className="text-sm"
                          data-testid="input-agent-message"
                        />
                        <Button size="sm" onClick={sendAgentMessage} disabled={agentLoading} data-testid="button-send-agent">
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* New Project Dialog */}
        <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Projeto de Valuation</DialogTitle>
              <DialogDescription>Configure as informações básicas do projeto</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome da Empresa</Label>
                  <Input value={newProject.companyName} onChange={e => setNewProject({ ...newProject, companyName: e.target.value })} data-testid="input-company-name" />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input value={newProject.cnpj} onChange={e => setNewProject({ ...newProject, cnpj: e.target.value })} data-testid="input-cnpj" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Setor</Label>
                  <Select value={newProject.sector} onValueChange={v => setNewProject({ ...newProject, sector: v })}>
                    <SelectTrigger data-testid="select-sector"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Porte</Label>
                  <Select value={newProject.size} onValueChange={v => setNewProject({ ...newProject, size: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{sizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Estágio</Label>
                  <Select value={newProject.stage} onValueChange={v => setNewProject({ ...newProject, stage: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Projeto</Label>
                  <Select value={newProject.projectType} onValueChange={v => setNewProject({ ...newProject, projectType: v })}>
                    <SelectTrigger data-testid="select-project-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simples (DCF + Múltiplos)</SelectItem>
                      <SelectItem value="governance">Governança (Completo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Modelo de Negócio</Label>
                <Input value={newProject.businessModel} onChange={e => setNewProject({ ...newProject, businessModel: e.target.value })} placeholder="Ex: SaaS B2B, Marketplace, Varejo Físico" />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={newProject.notes} onChange={e => setNewProject({ ...newProject, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewProjectOpen(false)}>Cancelar</Button>
              <Button onClick={() => createProject.mutate(newProject)} disabled={!newProject.companyName || !newProject.sector} data-testid="button-save-project">
                Criar Projeto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Input Dialog */}
        <Dialog open={newInputOpen} onOpenChange={setNewInputOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Adicionar Dados Financeiros</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ano</Label>
                  <Input type="number" value={newInput.year} onChange={e => setNewInput({ ...newInput, year: parseInt(e.target.value) })} data-testid="input-fin-year" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={newInput.isProjection.toString()} onValueChange={v => setNewInput({ ...newInput, isProjection: parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Histórico</SelectItem>
                      <SelectItem value="1">Projeção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {[
                ["revenue", "Receita Líquida"], ["ebitda", "EBITDA"], ["netIncome", "Lucro Líquido"],
                ["totalAssets", "Ativo Total"], ["totalEquity", "Patrimônio Líquido"],
                ["debt", "Dívida"], ["cash", "Caixa"], ["freeCashFlow", "FCF"], ["capex", "CAPEX"]
              ].map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input type="number" value={(newInput as any)[key]} onChange={e => setNewInput({ ...newInput, [key]: e.target.value })} placeholder="R$" />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewInputOpen(false)}>Cancelar</Button>
              <Button onClick={() => createInput.mutate(newInput)} data-testid="button-save-input">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar Dados Financeiros</DialogTitle>
            </DialogHeader>
            {importStep === "upload" && (
              <div className="text-center py-6">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm mb-3">Envie uma planilha Excel ou CSV</p>
                <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportUpload} data-testid="input-import-file" />
              </div>
            )}
            {importStep === "analyzing" && (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
                <p className="text-sm">Analisando arquivo com IA...</p>
              </div>
            )}
            {importStep === "review" && (
              <div>
                <p className="text-sm mb-2">{importedData.length} anos detectados</p>
                <div className="max-h-48 overflow-auto border rounded p-2 text-xs">
                  {importedData.map((r: any, i: number) => (
                    <div key={i} className="flex justify-between py-1 border-b">
                      <span>{r.year}</span>
                      <span>Receita: {fmt(r.revenue)}</span>
                      <span>EBITDA: {fmt(r.ebitda)}</span>
                    </div>
                  ))}
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => { setImportStep("upload"); setImportedData([]); }}>Voltar</Button>
                  <Button onClick={saveImportedData} data-testid="button-confirm-import">Confirmar Importação</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Report Preview Dialog */}
        <Dialog open={showReport} onOpenChange={setShowReport}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Relatório de Valuation</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: reportContent }} />
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReport(false)}>Fechar</Button>
              <Button onClick={() => {
                const blob = new Blob([reportContent], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `relatorio-valuation-${selectedProject?.companyName || "projeto"}.html`;
                a.click();
              }} data-testid="button-download-report">
                <Download className="h-3 w-3 mr-1" /> Download HTML
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </BrowserFrame>
  );
}
