import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Github, 
  Settings, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  GitBranch, 
  GitCommit, 
  FolderSearch,
  FileCode,
  Zap,
  Bot,
  ExternalLink,
  Sparkles,
  Play,
  Eye,
  Paperclip,
  X,
  FileText,
  Upload,
  RotateCcw,
  History,
  Monitor,
  Rocket,
  RefreshCw,
  Smartphone,
  Tablet,
  Globe,
  Code2,
  Layers,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Layout,
  LayoutGrid,
  Clock,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Cpu,
  Shield,
  Brain,
  Undo2,
  BookOpen,
  Gauge,
  ShieldCheck,
  AlertTriangle,
  CheckSquare,
  Square,
  Fingerprint,
  PanelLeft
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DevHistory from "@/components/DevHistory";


const FILE_TO_ROUTE_MAP: Record<string, string> = {
  "Cockpit": "/",
  "Home": "/",
  "Agent": "/agent",
  "Admin": "/admin",
  "Chat": "/chat",
  "WhatsApp": "/whatsapp",
  "XosInbox": "/comunicacao",
  "Automations": "/automations",
  "BiWorkspace": "/insights",
  "ProcessCompass": "/compass",
  "Crm": "/crm",
  "Production": "/production",
  "Support": "/support",
  "Valuation": "/valuation",
  "Canvas": "/canvas",
  "IDE": "/ide",
  "Scientist": "/scientist",
  "Knowledge": "/knowledge",
  "CentralApis": "/central-apis",
  "ApiTesterPage": "/api-tester",
  "ApiHub": "/api-hub",
  "Fisco": "/fisco",
  "People": "/hr",
  "Contabil": "/contabil",
  "SOE": "/soe",
  "Financeiro": "/control",
  "Communities": "/communities",
  "QualityModule": "/quality",
  "CommercialEnv": "/commercial-env",
  "FieldOperations": "/field-ops",
  "TechnicalModule": "/technical",
  "SuppliersPortal": "/suppliers",
  "NPSSurvey": "/nps",
  "EngineeringHub": "/engineering",
  "DevelopmentModule": "/development",
  "ArcadiaRetail": "/retail",
  "Plus": "/plus",
  "SuperAdmin": "/super-admin",
  "Marketplace": "/marketplace",
  "LMS": "/lms",
  "AppCenter": "/apps",
  "XosCentral": "/xos",
  "XosCrm": "/xos/crm",
  "XosTickets": "/xos/tickets",
  "XosCampaigns": "/xos/campaigns",
  "XosAutomations": "/xos/automations",
  "XosSites": "/xos/sites",
  "DocTypeBuilder": "/doctype-builder",
  "PageBuilder": "/page-builder",
  "Migration": "/migration",
  "DevCenter": "/dev-center",
};

function getRouteFromFilePath(filePath: string): string | null {
  const fileName = filePath.split("/").pop()?.replace(/\.(tsx|ts|jsx|js)$/, "") || "";
  if (FILE_TO_ROUTE_MAP[fileName]) return FILE_TO_ROUTE_MAP[fileName];
  
  const pathParts = filePath.toLowerCase();
  if (pathParts.includes("/xos/")) {
    if (pathParts.includes("crm")) return "/xos/crm";
    if (pathParts.includes("inbox")) return "/comunicacao";
    if (pathParts.includes("ticket")) return "/xos/tickets";
    if (pathParts.includes("campaign")) return "/xos/campaigns";
    if (pathParts.includes("automation")) return "/xos/automations";
    if (pathParts.includes("site")) return "/xos/sites";
    return "/xos";
  }
  if (pathParts.includes("pages/")) {
    const match = Object.entries(FILE_TO_ROUTE_MAP).find(([key]) => 
      fileName.toLowerCase().includes(key.toLowerCase())
    );
    if (match) return match[1];
  }
  if (pathParts.includes("components/")) {
    const parentFolder = filePath.split("/").slice(-2, -1)[0];
    if (parentFolder && parentFolder !== "components") {
      const match = Object.entries(FILE_TO_ROUTE_MAP).find(([key]) => 
        parentFolder.toLowerCase().includes(key.toLowerCase())
      );
      if (match) return match[1];
    }
  }
  
  return null;
}

const SYSTEM_MODULES = [
  { category: "Core", modules: [
    { name: "Cockpit", path: "/", icon: "🏠", desc: "Painel principal" },
    { name: "Manus (Agente IA)", path: "/agent", icon: "🤖", desc: "Assistente autônomo" },
    { name: "Admin", path: "/admin", icon: "⚙️", desc: "Administração geral" },
    { name: "Super Admin", path: "/super-admin", icon: "🔐", desc: "Administração avançada" },
  ]},
  { category: "Comunicação", modules: [
    { name: "Chat Interno", path: "/chat", icon: "💬", desc: "Mensagens internas" },
    { name: "WhatsApp", path: "/whatsapp", icon: "📱", desc: "Integração WhatsApp" },
    { name: "XOS Inbox", path: "/comunicacao", icon: "📥", desc: "Caixa de entrada unificada" },
    { name: "XOS CRM", path: "/xos/crm", icon: "👥", desc: "Gestão de relacionamentos" },
    { name: "XOS Tickets", path: "/xos/tickets", icon: "🎫", desc: "Tickets de suporte" },
    { name: "XOS Campanhas", path: "/xos/campaigns", icon: "📣", desc: "Campanhas de marketing" },
  ]},
  { category: "Negócios", modules: [
    { name: "SOE", path: "/soe", icon: "🏢", desc: "Sistema Operacional Empresarial" },
    { name: "Control (Financeiro)", path: "/control", icon: "💹", desc: "DRE, fluxo de caixa, orçamento" },
    { name: "Fisco", path: "/fisco", icon: "📋", desc: "Motor fiscal NF-e" },
    { name: "Contábil", path: "/contabil", icon: "📊", desc: "Contabilidade" },
    { name: "Retail", path: "/retail", icon: "🛒", desc: "Varejo e PDV" },
    { name: "Plus (ERP Laravel)", path: "/plus", icon: "🔷", desc: "ERP completo" },
    { name: "Fornecedores", path: "/suppliers", icon: "🏭", desc: "Portal de fornecedores" },
  ]},
  { category: "Pessoas & Operações", modules: [
    { name: "Pessoas", path: "/pessoas", icon: "👥", desc: "Cadastro unificado PF/PJ" },
    { name: "RH / DP", path: "/hr", icon: "👤", desc: "Recursos humanos e folha" },
    { name: "Qualidade", path: "/quality", icon: "✅", desc: "Gestão de qualidade" },
    { name: "Produção", path: "/production", icon: "🔧", desc: "Produção industrial" },
    { name: "Operações de Campo", path: "/field-ops", icon: "📍", desc: "Operações externas" },
    { name: "Engenharia", path: "/engineering", icon: "⚡", desc: "Hub de engenharia" },
    { name: "Técnico", path: "/technical", icon: "🔩", desc: "Módulo técnico" },
  ]},
  { category: "Inteligência & BI", modules: [
    { name: "Insights (BI)", path: "/insights", icon: "📈", desc: "Business Intelligence" },
    { name: "Scientist", path: "/scientist", icon: "🔬", desc: "Análise de dados com IA" },
    { name: "Knowledge Graph", path: "/knowledge", icon: "🧠", desc: "Grafo de conhecimento" },
    { name: "Valuation", path: "/valuation", icon: "💎", desc: "Avaliação empresarial" },
    { name: "NPS", path: "/nps", icon: "⭐", desc: "Pesquisa de satisfação" },
  ]},
  { category: "Plataforma", modules: [
    { name: "IDE", path: "/ide", icon: "🖥️", desc: "Ambiente de desenvolvimento" },
    { name: "Dev Center", path: "/dev-center", icon: "🚀", desc: "Centro de desenvolvimento" },
    { name: "Pipeline XOS", path: "/xos/pipeline", icon: "🔄", desc: "Pipeline autônomo" },
    { name: "Governança XOS", path: "/xos/governance", icon: "🛡️", desc: "Políticas e auditoria" },
    { name: "Automações", path: "/automations", icon: "⚡", desc: "Motor de automações" },
    { name: "XOS Automações", path: "/xos/automations", icon: "🤖", desc: "Automações XOS" },
    { name: "Central APIs", path: "/central-apis", icon: "🔌", desc: "Central de APIs" },
    { name: "API Hub", path: "/api-hub", icon: "🌐", desc: "Hub de APIs" },
    { name: "API Tester", path: "/api-tester", icon: "🧪", desc: "Testador de APIs" },
  ]},
  { category: "Apps & Marketplace", modules: [
    { name: "App Center", path: "/apps", icon: "📦", desc: "Central de aplicativos" },
    { name: "Marketplace", path: "/marketplace", icon: "🏪", desc: "Marketplace" },
    { name: "LMS", path: "/lms", icon: "📚", desc: "Plataforma de ensino" },
    { name: "Comunidades", path: "/communities", icon: "🌍", desc: "Comunidades" },
    { name: "Suporte", path: "/support", icon: "🎧", desc: "Central de suporte" },
  ]},
  { category: "Construtores", modules: [
    { name: "Page Builder", path: "/page-builder", icon: "🎨", desc: "Construtor de páginas" },
    { name: "DocType Builder", path: "/doctype-builder", icon: "📝", desc: "Construtor de doctypes" },
    { name: "Canvas", path: "/canvas", icon: "🖼️", desc: "Canvas visual" },
    { name: "Compass", path: "/compass", icon: "🧭", desc: "Bússola de processos" },
    { name: "XOS Sites", path: "/xos/sites", icon: "🌐", desc: "Construtor de sites" },
  ]},
];

function SystemOverviewTab() {
  const [selectedModule, setSelectedModule] = useState<string>("/");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(SYSTEM_MODULES.map(c => c.category)));

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const currentModule = SYSTEM_MODULES.flatMap(c => c.modules).find(m => m.path === selectedModule);

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
      <Card className="w-80 flex-shrink-0 flex flex-col">
        <CardHeader className="py-3 border-b bg-gradient-to-r from-slate-800 to-slate-700">
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" /> Mapa do Sistema
          </CardTitle>
          <CardDescription className="text-white/60 text-xs">
            {SYSTEM_MODULES.reduce((acc, c) => acc + c.modules.length, 0)} módulos disponíveis
          </CardDescription>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {SYSTEM_MODULES.map((cat) => (
              <div key={cat.category}>
                <button
                  onClick={() => toggleCategory(cat.category)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded"
                  data-testid={`category-${cat.category}`}
                >
                  {expandedCategories.has(cat.category) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {cat.category}
                  <Badge variant="outline" className="ml-auto text-[9px] h-4">{cat.modules.length}</Badge>
                </button>
                {expandedCategories.has(cat.category) && (
                  <div className="ml-2 space-y-0.5">
                    {cat.modules.map((mod) => (
                      <button
                        key={mod.path}
                        onClick={() => setSelectedModule(mod.path)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${
                          selectedModule === mod.path
                            ? "bg-blue-100 text-blue-800 font-medium"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                        data-testid={`module-${mod.path.replace(/\//g, '-')}`}
                      >
                        <span className="text-sm">{mod.icon}</span>
                        <div className="flex-1 text-left min-w-0">
                          <div className="truncate">{mod.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{mod.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="py-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                {currentModule ? `${currentModule.icon} ${currentModule.name}` : "Preview do Sistema"}
              </CardTitle>
              <CardDescription className="text-xs">
                {currentModule?.desc || "Selecione um módulo para visualizar"} — <span className="font-mono text-blue-600">{selectedModule}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
                <Button variant={previewDevice === "desktop" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewDevice("desktop")} data-testid="btn-sys-desktop">
                  <Monitor className="w-3 h-3" />
                </Button>
                <Button variant={previewDevice === "tablet" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewDevice("tablet")} data-testid="btn-sys-tablet">
                  <Tablet className="w-3 h-3" />
                </Button>
                <Button variant={previewDevice === "mobile" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewDevice("mobile")} data-testid="btn-sys-mobile">
                  <Smartphone className="w-3 h-3" />
                </Button>
              </div>
              <Button variant="outline" size="sm" className="h-7" onClick={() => {
                const iframe = document.getElementById("system-preview-iframe") as HTMLIFrameElement;
                if (iframe) iframe.src = iframe.src;
              }} data-testid="btn-sys-refresh">
                <RefreshCw className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" className="h-7" onClick={() => window.open(selectedModule, "_blank")} data-testid="btn-sys-external">
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-2">
          <div className={`h-full bg-gray-100 rounded-lg overflow-hidden border mx-auto transition-all ${
            previewDevice === "desktop" ? "w-full" :
            previewDevice === "tablet" ? "max-w-[768px]" :
            "max-w-[375px]"
          }`}>
            <iframe
              id="system-preview-iframe"
              src={selectedModule}
              className="w-full h-full bg-white"
              title="System Preview"
              data-testid="iframe-system-preview"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StagingPreviewTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("/");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [activeFileForPreview, setActiveFileForPreview] = useState<string | null>(null);

  const { data: stagedData, isLoading: loadingStaged, refetch: refetchStaged } = useQuery({
    queryKey: ["/api/blackboard/staged"],
    queryFn: async () => {
      const res = await fetch("/api/blackboard/staged", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar staging");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const publishMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const res = await apiRequest("POST", `/api/blackboard/publish/${taskId}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Publicado com sucesso!",
        description: `${data.applied?.length || 0} arquivo(s) aplicados ao projeto`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/blackboard/staged"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao publicar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const res = await apiRequest("POST", `/api/blackboard/discard/${taskId}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Descartado",
        description: "As alterações foram descartadas",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/blackboard/staged"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao descartar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stagedItems = stagedData?.staged || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-purple-900">1. Desenvolver</p>
                <p className="text-xs text-purple-700">Os agentes criam e validam o código</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100">
                <Eye className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-blue-900">2. Revisar & Testar</p>
                <p className="text-xs text-blue-700">Veja os arquivos e teste no preview</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100">
                <Rocket className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-900">3. Publicar</p>
                <p className="text-xs text-green-700">Aprove para aplicar ao projeto</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-600" />
                Alterações Pendentes
              </CardTitle>
              <CardDescription>
                {stagedItems.length === 0 
                  ? "Nenhuma alteração aguardando aprovação" 
                  : `${stagedItems.length} alteração(ões) aguardando sua aprovação`}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchStaged()} data-testid="btn-refresh-staged">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loadingStaged ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
            </div>
          ) : stagedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mb-3" />
              <h3 className="font-semibold text-lg mb-1">Tudo limpo!</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Não há alterações pendentes. Use a aba "Desenvolver" para criar novas funcionalidades — elas aparecerão aqui para sua aprovação.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {stagedItems.map((item: any) => (
                <Card key={item.taskId} className="border-l-4 border-l-amber-400" data-testid={`staged-item-${item.taskId}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm">{item.title}</h4>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px]">
                            <FileCode className="w-3 h-3 mr-1" />
                            {item.files?.length || 0} arquivo(s)
                          </Badge>
                          {item.validationScore && (
                            <Badge variant="outline" className={`text-[10px] ${
                              item.validationScore >= 80 ? "border-green-300 text-green-700" : "border-amber-300 text-amber-700"
                            }`}>
                              Score: {item.validationScore}
                            </Badge>
                          )}
                          {item.blockedFiles?.length > 0 && (
                            <Badge variant="outline" className="text-[10px] border-red-300 text-red-700">
                              {item.blockedFiles.length} protegido(s)
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {item.stagedAt ? new Date(item.stagedAt).toLocaleString("pt-BR") : ""}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-3 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
                          disabled={discardMutation.isPending}
                          onClick={() => discardMutation.mutate(item.taskId)}
                          data-testid={`btn-discard-${item.taskId}`}
                        >
                          {discardMutation.isPending ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          Descartar
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-green-600 hover:bg-green-700"
                          disabled={publishMutation.isPending}
                          onClick={() => publishMutation.mutate(item.taskId)}
                          data-testid={`btn-publish-${item.taskId}`}
                        >
                          {publishMutation.isPending ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Rocket className="w-3 h-3 mr-1" />
                          )}
                          Publicar
                        </Button>
                      </div>
                    </div>

                    {item.files?.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {item.files.map((file: any) => {
                          const detectedRoute = getRouteFromFilePath(file.path);
                          const fileKey = `${item.taskId}-${file.artifactId}`;
                          const isExpanded = expandedCode === fileKey;
                          return (
                          <div key={file.artifactId} className={`border rounded-lg overflow-hidden transition-all ${activeFileForPreview === fileKey ? "ring-2 ring-blue-400 border-blue-300" : ""}`}>
                            <div className="flex items-center bg-slate-50 hover:bg-slate-100 transition-colors">
                              <button
                                className="flex-1 flex items-center justify-between px-3 py-2 text-left"
                                onClick={() => {
                                  const newKey = isExpanded ? null : fileKey;
                                  setExpandedCode(newKey);
                                  if (newKey) {
                                    setActiveFileForPreview(newKey);
                                    if (detectedRoute) {
                                      setPreviewUrl(detectedRoute);
                                      const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement;
                                      if (iframe) iframe.src = detectedRoute;
                                    }
                                    const previewSection = document.getElementById("preview-section");
                                    if (previewSection) {
                                      previewSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                    }
                                  } else {
                                    setActiveFileForPreview(null);
                                  }
                                }}
                                data-testid={`btn-toggle-file-${file.artifactId}`}
                              >
                                <div className="flex items-center gap-2">
                                  <FileCode className="w-3.5 h-3.5 text-blue-500" />
                                  <span className="text-xs font-mono font-medium">{file.path}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-[10px]">{file.lines} linhas</Badge>
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                </div>
                              </button>
                              {detectedRoute && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        className="px-2 py-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors mr-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewUrl(detectedRoute);
                                          setActiveFileForPreview(fileKey);
                                          const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement;
                                          if (iframe) iframe.src = detectedRoute;
                                          const previewSection = document.getElementById("preview-section");
                                          if (previewSection) {
                                            previewSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                          }
                                        }}
                                        data-testid={`btn-preview-file-${file.artifactId}`}
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <p className="text-xs">Ver no preview: {detectedRoute}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            {isExpanded && (
                              <div>
                                {detectedRoute ? (
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border-t border-blue-100">
                                    <Eye className="w-3 h-3 text-blue-500" />
                                    <span className="text-[10px] text-blue-700">Preview navegou para <span className="font-mono font-bold">{detectedRoute}</span></span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-t border-slate-200">
                                    <Code2 className="w-3 h-3 text-slate-400" />
                                    <span className="text-[10px] text-slate-500">Arquivo de suporte - preview mantido na rota atual</span>
                                  </div>
                                )}
                                <ScrollArea className="max-h-[300px]">
                                  <pre className="p-3 text-[11px] bg-slate-900 text-slate-100 overflow-x-auto">
                                    <code>{file.content}</code>
                                  </pre>
                                </ScrollArea>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}

                    {item.blockedFiles?.length > 0 && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-[10px] font-medium text-red-700 mb-1">Arquivos protegidos (não serão alterados):</p>
                        <div className="flex flex-wrap gap-1">
                          {item.blockedFiles.map((f: string) => (
                            <Badge key={f} variant="outline" className="text-[9px] border-red-300 text-red-600 font-mono">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="preview-section">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" /> Preview ao Vivo
              </CardTitle>
              <CardDescription>
                {activeFileForPreview 
                  ? <>Navegando para <span className="font-mono font-bold text-blue-600">{previewUrl}</span></>
                  : "Visualize e teste a aplicação atual"
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
                <Button
                  variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPreviewDevice("desktop")}
                  data-testid="button-device-desktop"
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button
                  variant={previewDevice === "tablet" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPreviewDevice("tablet")}
                  data-testid="button-device-tablet"
                >
                  <Tablet className="w-4 h-4" />
                </Button>
                <Button
                  variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPreviewDevice("mobile")}
                  data-testid="button-device-mobile"
                >
                  <Smartphone className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement;
                  if (iframe) iframe.src = iframe.src;
                }}
                data-testid="button-refresh-preview"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <Input
                value={previewUrl}
                onChange={(e: any) => setPreviewUrl(e.target.value)}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                placeholder="/"
                data-testid="input-preview-url"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => window.open(previewUrl, "_blank")}
              data-testid="button-open-external"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
          <div 
            className={`relative bg-gray-100 rounded-lg overflow-hidden border-2 border-dashed border-gray-300 mx-auto transition-all ${
              previewDevice === "desktop" ? "w-full h-[500px]" :
              previewDevice === "tablet" ? "w-[768px] h-[500px]" :
              "w-[375px] h-[667px]"
            }`}
          >
            <iframe
              id="preview-iframe"
              src={previewUrl}
              className="w-full h-full bg-white"
              title="Preview"
              data-testid="iframe-preview"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const PHASE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  design: { label: "Arquitetura", icon: Cpu, color: "text-blue-400" },
  codegen: { label: "Geração de Código", icon: FileCode, color: "text-green-400" },
  validation: { label: "Validação", icon: Shield, color: "text-yellow-400" },
  staging: { label: "Staging", icon: Eye, color: "text-purple-400" },
  evolution: { label: "Evolução", icon: Brain, color: "text-pink-400" },
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  queued: { label: "Na Fila", color: "bg-gray-600" },
  running: { label: "Executando", color: "bg-blue-600" },
  staging_review: { label: "Aguardando Aprovação", color: "bg-yellow-600" },
  completed: { label: "Concluído", color: "bg-green-600" },
  failed: { label: "Falhou", color: "bg-red-600" },
};

function BudgetMeter({ budget }: { budget: any }) {
  if (!budget) return null;
  const timePercent = Math.min(100, Math.round((budget.usedTimeMs / budget.maxTimeMs) * 100));
  const callsPercent = Math.min(100, Math.round((budget.usedCalls / budget.maxCalls) * 100));
  return (
    <Card className="bg-zinc-900 border-zinc-800" data-testid="budget-meter">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
          <Gauge className="w-4 h-4" /> Budget
          {budget.exceeded && <Badge className="bg-red-600 text-[10px]">Excedido</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>Tempo</span>
            <span>{Math.round(budget.usedTimeMs / 1000)}s / {Math.round(budget.maxTimeMs / 1000)}s</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${timePercent > 80 ? "bg-red-500" : timePercent > 50 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${timePercent}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>Chamadas</span>
            <span>{budget.usedCalls} / {budget.maxCalls}</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${callsPercent > 80 ? "bg-red-500" : callsPercent > 50 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${callsPercent}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RunbookView({ pipelineId }: { pipelineId: number }) {
  const { data } = useQuery<any>({ queryKey: [`/api/xos/pipeline/${pipelineId}/runbook`], refetchInterval: 10000 });
  const runbook = data?.runbook;
  if (!runbook) return <p className="text-sm text-zinc-500 text-center py-4">Nenhum runbook disponível ainda</p>;
  return (
    <div className="space-y-4" data-testid="runbook-view">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Contexto</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-zinc-300">{runbook.context}</p></CardContent>
      </Card>
      {runbook.decisions?.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Decisões ({runbook.decisions.length})</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {runbook.decisions.map((d: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-zinc-800/50 rounded text-xs">
                    <Badge variant="outline" className="text-[10px] shrink-0">{d.phase}</Badge>
                    <span className="text-zinc-500">{d.agent}:</span>
                    <span className="text-zinc-300 flex-1">{d.decision}</span>
                    <span className="text-zinc-600 text-[10px] shrink-0">{new Date(d.timestamp).toLocaleTimeString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      {runbook.validations && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Validação
              <Badge className={runbook.validations.valid ? "bg-green-600" : "bg-red-600"}>Score: {runbook.validations.score}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {runbook.validations.gates && (
              <div className="flex gap-2 flex-wrap">
                {Object.entries(runbook.validations.gates).map(([gate, passed]: [string, any]) => (
                  <Badge key={gate} className={passed ? "bg-green-600/20 text-green-400 border border-green-600/50" : "bg-red-600/20 text-red-400 border border-red-600/50"}>
                    {passed ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}{gate}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {runbook.approval && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Aprovação</CardTitle></CardHeader>
          <CardContent className="text-xs text-zinc-300 space-y-1">
            <p>Revisado por: {runbook.approval.reviewedBy}</p>
            <p>Arquivos aplicados: {runbook.approval.applied?.length || 0}</p>
            {runbook.approval.errors?.length > 0 && <p className="text-red-400">Erros: {runbook.approval.errors.join(", ")}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PipelineTimeline({ phases }: { phases: Record<string, any> | null }) {
  if (!phases) return null;
  const phaseOrder = ["design", "codegen", "validation", "staging", "evolution"];
  return (
    <div className="flex items-center gap-1 w-full" data-testid="pipeline-timeline">
      {phaseOrder.map((phase, idx) => {
        const data = phases[phase] || { status: "pending" };
        const config = PHASE_LABELS[phase];
        const Icon = config.icon;
        const isActive = data.status === "running";
        const isComplete = data.status === "completed";
        const isFailed = data.status === "failed";
        return (
          <div key={phase} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg flex-1 transition-all ${isActive ? "bg-blue-500/20 border border-blue-500/50 shadow-lg shadow-blue-500/10" : ""} ${isComplete ? "bg-green-500/10 border border-green-500/30" : ""} ${isFailed ? "bg-red-500/10 border border-red-500/30" : ""} ${data.status === "pending" ? "bg-zinc-800/50 border border-zinc-700/30" : ""}`} data-testid={`phase-${phase}`}>
              {isActive ? <Loader2 className={`w-4 h-4 ${config.color} animate-spin`} /> : isComplete ? <CheckCircle className="w-4 h-4 text-green-400" /> : isFailed ? <XCircle className="w-4 h-4 text-red-400" /> : <Icon className="w-4 h-4 text-zinc-500" />}
              <span className={`text-xs font-medium ${isActive ? config.color : isComplete ? "text-green-400" : "text-zinc-500"}`}>{config.label}</span>
            </div>
            {idx < phaseOrder.length - 1 && <ChevronRight className={`w-4 h-4 mx-1 shrink-0 ${isComplete ? "text-green-400" : "text-zinc-600"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function InlinePipelineTracker({ pipelineId, onExpand }: { pipelineId: number; onExpand?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data: details, isLoading, isError } = useQuery<any>({ queryKey: [`/api/xos/pipeline/${pipelineId}`], refetchInterval: 3000 });
  const pipeline = details?.pipeline;
  const phases = pipeline?.phases;
  const staging = details?.staging || [];
  const phaseOrder = ["design", "codegen", "validation", "staging", "evolution"];

  const currentPhase = phaseOrder.find(p => phases?.[p]?.status === "running") || pipeline?.currentPhase;
  const isFinished = pipeline?.status === "completed" || pipeline?.status === "failed";
  const hasPending = staging.some((s: any) => s.status === "pending");
  const elapsedTime = pipeline?.budget?.usedTimeMs ? Math.round(pipeline.budget.usedTimeMs / 1000) : 0;

  if (isLoading) {
    return (
      <div className="w-full rounded-lg border bg-white p-3 flex items-center gap-2" data-testid={`inline-pipeline-${pipelineId}`}>
        <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
        <span className="text-sm text-gray-500">Pipeline #{pipelineId}...</span>
      </div>
    );
  }

  if (isError || !pipeline) {
    return (
      <div className="w-full rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2" data-testid={`inline-pipeline-${pipelineId}`}>
        <XCircle className="w-4 h-4 text-red-400" />
        <span className="text-sm text-red-600">Pipeline #{pipelineId} — erro ao carregar</span>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border bg-white overflow-hidden" data-testid={`inline-pipeline-${pipelineId}`}>
      <div className="px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-gray-800">#{pipelineId}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            pipeline?.status === "completed" ? "bg-green-100 text-green-700" :
            pipeline?.status === "failed" ? "bg-red-100 text-red-700" :
            pipeline?.status === "staging_review" ? "bg-yellow-100 text-yellow-700" :
            "bg-blue-100 text-blue-700"
          }`}>
            {pipeline?.status === "running" ? "Executando" :
             pipeline?.status === "completed" ? "Concluído" :
             pipeline?.status === "failed" ? "Falhou" :
             pipeline?.status === "staging_review" ? "Revisão" :
             pipeline?.status}
          </span>
          {!isFinished && currentPhase && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {PHASE_LABELS[currentPhase]?.label || currentPhase}
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{elapsedTime}s</span>
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-gray-100 rounded" data-testid={`btn-expand-pipeline-${pipelineId}`}>
            {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
        </div>

        <p className="text-xs text-gray-500 line-clamp-1 mb-2">{pipeline?.prompt?.replace(/^\[MODO (?:PLANEJAMENTO|EXECUÇÃO)\].*?Solicitação:\s*/s, "")}</p>

        <div className="flex items-center gap-1">
          {phaseOrder.map((phase) => {
            const data = phases?.[phase] || { status: "pending" };
            const isActive = data.status === "running";
            const isComplete = data.status === "completed";
            const isFailed = data.status === "failed";
            return (
              <div key={phase} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full h-1.5 rounded-full ${
                  isActive ? "bg-blue-400 animate-pulse" :
                  isComplete ? "bg-green-400" :
                  isFailed ? "bg-red-400" :
                  "bg-gray-200"
                }`} />
                <span className={`text-[9px] leading-none ${
                  isActive ? "text-blue-600 font-medium" :
                  isComplete ? "text-green-600" :
                  isFailed ? "text-red-500" :
                  "text-gray-300"
                }`}>{PHASE_LABELS[phase]?.label?.split(" ")[0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {hasPending && (
        <div className="px-4 py-2 bg-yellow-50 border-t flex items-center justify-between">
          <span className="text-xs text-yellow-700">{staging.filter((s: any) => s.status === "pending").length} arquivo(s) para revisar</span>
          <Button size="sm" variant="outline" className="h-6 text-xs border-yellow-400 text-yellow-700 hover:bg-yellow-100" onClick={() => { if (onExpand) onExpand(); }} data-testid={`btn-review-pipeline-${pipelineId}`}>
            Revisar
          </Button>
        </div>
      )}

      {expanded && (
        <div className="border-t px-4 py-3 bg-gray-50 space-y-2">
          {phaseOrder.map((phase) => {
            const data = phases?.[phase];
            if (!data || data.status === "pending") return null;
            return (
              <div key={phase} className="text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-medium ${data.status === "completed" ? "text-green-700" : data.status === "failed" ? "text-red-600" : "text-blue-700"}`}>
                    {PHASE_LABELS[phase]?.label}
                  </span>
                  {data.duration && <span className="text-gray-400">{Math.round(data.duration / 1000)}s</span>}
                </div>
                {data.thought && <p className="text-gray-500 line-clamp-2 ml-2">{data.thought}</p>}
                {data.error && <p className="text-red-500 ml-2">{data.error}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PipelinePreviewPanel() {
  const [previewUrl, setPreviewUrl] = useState("/");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-zinc-300 flex items-center gap-2"><Monitor className="w-4 h-4" /> Preview ao Vivo do Sistema</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1">
              <Button variant={previewDevice === "desktop" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewDevice("desktop")} data-testid="btn-pp-desktop"><Monitor className="w-3 h-3" /></Button>
              <Button variant={previewDevice === "tablet" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewDevice("tablet")} data-testid="btn-pp-tablet"><Tablet className="w-3 h-3" /></Button>
              <Button variant={previewDevice === "mobile" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewDevice("mobile")} data-testid="btn-pp-mobile"><Smartphone className="w-3 h-3" /></Button>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { const iframe = document.getElementById("pipeline-preview-iframe") as HTMLIFrameElement; if (iframe) iframe.src = iframe.src; }} data-testid="btn-pp-refresh"><RefreshCw className="w-3 h-3" /></Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => window.open(previewUrl, "_blank")} data-testid="btn-pp-external"><ExternalLink className="w-3 h-3" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
          <Globe className="w-4 h-4 text-zinc-500" />
          <Input value={previewUrl} onChange={(e: any) => setPreviewUrl(e.target.value)} onKeyDown={(e: any) => { if (e.key === "Enter") { const iframe = document.getElementById("pipeline-preview-iframe") as HTMLIFrameElement; if (iframe) iframe.src = previewUrl; } }} className="border-0 bg-transparent p-0 h-auto text-sm text-zinc-300 focus-visible:ring-0 font-mono" placeholder="/" data-testid="input-pp-url" />
        </div>
        <div className={`bg-zinc-950 rounded-lg overflow-hidden border border-zinc-700 mx-auto transition-all ${previewDevice === "desktop" ? "w-full h-[500px]" : previewDevice === "tablet" ? "max-w-[768px] h-[500px]" : "max-w-[375px] h-[667px]"}`}>
          <iframe id="pipeline-preview-iframe" src={previewUrl} className="w-full h-full bg-white" title="Pipeline Preview" data-testid="iframe-pipeline-preview" />
        </div>
      </CardContent>
    </Card>
  );
}

function InlineDiffViewer({ original, modified }: { original: string; modified: string }) {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const maxLines = Math.max(origLines.length, modLines.length, 200);
  const displayLines = Math.min(maxLines, 200);
  
  const diffLines: { type: "same" | "add" | "remove" | "modify"; lineNum: number; origLine?: string; modLine?: string }[] = [];
  
  for (let i = 0; i < displayLines; i++) {
    const orig = origLines[i];
    const mod = modLines[i];
    if (orig === undefined && mod !== undefined) {
      diffLines.push({ type: "add", lineNum: i + 1, modLine: mod });
    } else if (orig !== undefined && mod === undefined) {
      diffLines.push({ type: "remove", lineNum: i + 1, origLine: orig });
    } else if (orig === mod) {
      diffLines.push({ type: "same", lineNum: i + 1, origLine: orig, modLine: mod });
    } else {
      diffLines.push({ type: "modify", lineNum: i + 1, origLine: orig, modLine: mod });
    }
  }
  
  return (
    <ScrollArea className="h-72">
      <div className="grid grid-cols-2 text-[11px] font-mono" data-testid="inline-diff-viewer">
        <div className="border-r border-zinc-800">
          <div className="px-3 py-1 bg-red-950/30 text-red-400 text-[10px] border-b border-zinc-800 sticky top-0 z-10">Original</div>
          {diffLines.map((line, idx) => (
            <div
              key={`orig-${idx}`}
              className={`px-3 py-0.5 flex ${
                line.type === "remove" ? "bg-red-950/40 text-red-300" :
                line.type === "modify" ? "bg-yellow-950/30 text-yellow-200" :
                line.type === "add" ? "bg-zinc-900/50 text-zinc-600" :
                "text-zinc-400"
              }`}
            >
              <span className="text-zinc-600 w-8 shrink-0 text-right pr-2 select-none">{line.lineNum}</span>
              <span className="whitespace-pre-wrap break-all">{line.type === "add" ? "" : (line.origLine || "")}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="px-3 py-1 bg-green-950/30 text-green-400 text-[10px] border-b border-zinc-800 sticky top-0 z-10">Modificado</div>
          {diffLines.map((line, idx) => (
            <div
              key={`mod-${idx}`}
              className={`px-3 py-0.5 flex ${
                line.type === "add" ? "bg-green-950/40 text-green-300" :
                line.type === "modify" ? "bg-green-950/30 text-green-200" :
                line.type === "remove" ? "bg-zinc-900/50 text-zinc-600" :
                "text-zinc-400"
              }`}
            >
              <span className="text-zinc-600 w-8 shrink-0 text-right pr-2 select-none">{line.lineNum}</span>
              <span className="whitespace-pre-wrap break-all">{line.type === "remove" ? "" : (line.modLine || "")}</span>
            </div>
          ))}
        </div>
      </div>
      {maxLines > 200 && <div className="p-2 text-center text-xs text-zinc-500">... mostrando primeiras 200 linhas de {maxLines}</div>}
    </ScrollArea>
  );
}

function PipelineReviewPanelV2({ pipelineId, changes, onAction }: { pipelineId: number; changes: any[]; onAction: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("/");
  const [showPreview, setShowPreview] = useState(true);
  const allPending = changes.filter(c => c.status === "pending");
  const pendingMap = new Map<string, any>();
  for (const c of allPending) { pendingMap.set(c.filePath, c); }
  const pendingChanges = Array.from(pendingMap.values());
  useEffect(() => { setSelectedFiles(new Set(pendingChanges.map(c => c.filePath))); }, [changes.length]);
  const toggleFile = (filePath: string) => { setSelectedFiles(prev => { const next = new Set(prev); if (next.has(filePath)) next.delete(filePath); else next.add(filePath); return next; }); };
  const approveMutation = useMutation({
    mutationFn: async () => {
      const files = Array.from(selectedFiles);
      const body: any = {};
      if (files.length < pendingChanges.length) body.selectedFiles = files;
      const res = await apiRequest("POST", `/api/xos/pipeline/${pipelineId}/approve`, body);
      return res.json();
    },
    onSuccess: (data: any) => {
      const applied = data.applied?.length || 0;
      const errs = data.errors?.length || 0;
      toast({ title: `${applied} arquivo(s) aplicado(s)${errs > 0 ? `, ${errs} erro(s)` : ""}`, variant: errs > 0 ? "destructive" : "default" });
      queryClient.invalidateQueries({ queryKey: ["/api/xos/pipeline"] });
      queryClient.invalidateQueries({ queryKey: [`/api/xos/pipeline/${pipelineId}`] });
      onAction();
      const iframe = document.getElementById("review-preview-iframe") as HTMLIFrameElement;
      if (iframe) setTimeout(() => { iframe.src = iframe.src; }, 1500);
    },
    onError: (err: any) => { toast({ title: "Erro ao aprovar", description: err.message, variant: "destructive" }); },
  });
  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/xos/pipeline/${pipelineId}/reject`),
    onSuccess: () => { toast({ title: "Alterações rejeitadas" }); queryClient.invalidateQueries({ queryKey: ["/api/xos/pipeline"] }); queryClient.invalidateQueries({ queryKey: [`/api/xos/pipeline/${pipelineId}`] }); onAction(); },
    onError: (err: any) => { toast({ title: "Erro ao rejeitar", description: err.message, variant: "destructive" }); },
  });
  const detectRoute = (filePath: string) => {
    const pageMatch = filePath.match(/pages\/(\w+)\.tsx/);
    if (pageMatch) {
      const name = pageMatch[1];
      const routeMap: Record<string, string> = { BiWorkspace: "/insights", Cockpit: "/", Agent: "/agent", Fisco: "/fisco", SOE: "/soe", Financeiro: "/control", People: "/hr", Pessoas: "/pessoas", XosPipeline: "/xos/pipeline", DevCenter: "/dev-center", Admin: "/admin", Chat: "/chat", Tickets: "/tickets", CommCenter: "/comm", ApiHub: "/api-hub", AppCenter: "/apps", MetabaseProxyPage: "/insights", ProxyPage: "/insights", CommercialEnv: "/commercial" };
      return routeMap[name] || "/";
    }
    if (filePath.includes("server/routes")) return "/";
    if (filePath.includes("modules/")) return "/apps";
    return null;
  };
  useEffect(() => { if (pendingChanges.length > 0) { const firstRoute = pendingChanges.map(c => detectRoute(c.filePath)).find(r => r !== null); if (firstRoute && previewUrl === "/") setPreviewUrl(firstRoute); } }, [pendingChanges.length]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-yellow-300 flex items-center gap-2"><Eye className="w-4 h-4" /> Revisão de Código — {pendingChanges.length} arquivo(s) pendente(s)</h3>
        <Button variant="outline" size="sm" className="h-7 border-zinc-700 text-zinc-400" onClick={() => setShowPreview(!showPreview)} data-testid="btn-toggle-preview-v2"><PanelLeft className="w-3 h-3 mr-1" /> {showPreview ? "Esconder" : "Mostrar"} Preview</Button>
      </div>
      <div className={`flex gap-4 ${showPreview ? "" : "flex-col"}`}>
        <div className={`space-y-3 ${showPreview ? "w-1/2" : "w-full"}`}>
          {pendingChanges.map((change: any) => {
            const isSelected = selectedFiles.has(change.filePath);
            const isExpanded = expandedFile === change.filePath;
            const route = detectRoute(change.filePath);
            return (
              <div key={change.id} className={`border rounded-lg overflow-hidden transition-all ${isSelected ? "border-yellow-500/50" : "border-zinc-700/50 opacity-60"}`}>
                <div className="bg-zinc-800 px-3 py-2 flex items-center gap-2">
                  <button onClick={() => toggleFile(change.filePath)} className="shrink-0" data-testid={`toggle-review-v2-${change.id}`}>{isSelected ? <CheckSquare className="w-4 h-4 text-yellow-400" /> : <Square className="w-4 h-4 text-zinc-600" />}</button>
                  <FileCode className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-xs font-mono text-zinc-300 truncate flex-1">{change.filePath}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{change.action || (change.originalContent ? "modify" : "create")}</Badge>
                  {route && showPreview && <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-blue-400" onClick={() => setPreviewUrl(route)} data-testid={`nav-preview-v2-${change.id}`}><Monitor className="w-3 h-3 mr-1" /> Preview</Button>}
                  <button onClick={() => setExpandedFile(isExpanded ? null : change.filePath)} className="shrink-0" data-testid={`expand-review-v2-${change.id}`}><ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} /></button>
                </div>
                {isExpanded && (
                  <div className="bg-zinc-950">
                    {change.originalContent ? (
                      <InlineDiffViewer original={change.originalContent} modified={change.content || ""} />
                    ) : (
                      <ScrollArea className="h-60">
                        <pre className="p-3 text-xs text-zinc-300 font-mono whitespace-pre-wrap">{change.content?.slice(0, 5000) || ""}{(change.content?.length || 0) > 5000 && "\n\n... (truncado)"}</pre>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex gap-3 pt-2">
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || selectedFiles.size === 0} className="bg-green-600 hover:bg-green-700 flex-1" data-testid="btn-approve-review-v2">
              {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ThumbsUp className="w-4 h-4 mr-2" />}
              Aprovar {selectedFiles.size < pendingChanges.length ? `${selectedFiles.size} Selecionado(s)` : `Todos (${pendingChanges.length})`}
            </Button>
            <Button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending} variant="destructive" data-testid="btn-reject-review-v2">
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ThumbsDown className="w-4 h-4 mr-2" />}Rejeitar
            </Button>
          </div>
        </div>
        {showPreview && (
          <div className="w-1/2">
            <Card className="bg-zinc-900 border-zinc-800 h-full">
              <CardHeader className="py-2 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs text-zinc-400 flex items-center gap-2"><Monitor className="w-3 h-3" /> Preview — <span className="font-mono text-blue-400">{previewUrl}</span></CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { const iframe = document.getElementById("review-preview-iframe") as HTMLIFrameElement; if (iframe) iframe.src = iframe.src; }} data-testid="btn-review-pp-refresh"><RefreshCw className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(previewUrl, "_blank")} data-testid="btn-review-pp-external"><ExternalLink className="w-3 h-3" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-2"><div className="bg-zinc-950 rounded-lg overflow-hidden border border-zinc-700 h-[400px]"><iframe id="review-preview-iframe" src={previewUrl} className="w-full h-full bg-white" title="Review Preview" data-testid="iframe-review-preview-v2" /></div></CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineDetail({ pipelineId }: { pipelineId: number }) {
  const [streamData, setStreamData] = useState<any>(null);
  const [detailTab, setDetailTab] = useState("timeline");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: details, refetch } = useQuery<any>({ queryKey: [`/api/xos/pipeline/${pipelineId}`], refetchInterval: 5000 });
  useEffect(() => {
    const es = new EventSource(`/api/xos/pipeline/${pipelineId}/stream`);
    es.addEventListener("status", (e) => { try { setStreamData(JSON.parse(e.data)); } catch {} });
    es.addEventListener("phase_started", () => refetch());
    es.addEventListener("phase_completed", () => refetch());
    es.addEventListener("staging_ready", () => refetch());
    es.addEventListener("completed", () => refetch());
    es.addEventListener("failed", () => refetch());
    es.addEventListener("rolled_back", () => refetch());
    return () => es.close();
  }, [pipelineId, refetch]);
  const rollbackMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/xos/pipeline/${pipelineId}/rollback`),
    onSuccess: async (res) => { const data = await res.json(); toast({ title: `Rollback: ${data.restored?.length || 0} arquivo(s) restaurado(s)` }); queryClient.invalidateQueries({ queryKey: ["/api/xos/pipeline"] }); refetch(); },
    onError: (err: any) => { toast({ title: "Erro no rollback", description: err.message, variant: "destructive" }); },
  });
  const pipeline = details?.pipeline;
  const phases = streamData?.phases || pipeline?.phases;
  const statusInfo = STATUS_BADGES[pipeline?.status || "queued"];
  const hasAppliedChanges = details?.staging?.some((s: any) => s.status === "applied");
  const pendingStagingCount = details?.staging?.filter((s: any) => s.status === "pending").length || 0;
  const hasPendingChanges = pendingStagingCount > 0;
  useEffect(() => { if (hasPendingChanges && detailTab === "timeline") setDetailTab("review"); if (!hasPendingChanges && detailTab === "review") setDetailTab("timeline"); }, [hasPendingChanges]);
  return (
    <div className="space-y-4" data-testid={`pipeline-detail-${pipelineId}`}>
      {pipeline && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                Pipeline #{pipeline.id}
                {pipeline.correlationId && <span className="text-[10px] text-zinc-600 font-mono flex items-center gap-1"><Fingerprint className="w-3 h-3" /> {pipeline.correlationId.slice(0, 8)}</span>}
              </h3>
              <p className="text-sm text-zinc-400 mt-1">{pipeline.prompt}</p>
            </div>
            <div className="flex items-center gap-2">
              {hasAppliedChanges && (
                <Button variant="outline" size="sm" onClick={() => rollbackMutation.mutate()} disabled={rollbackMutation.isPending} className="border-red-500/50 text-red-400 hover:bg-red-500/10" data-testid="btn-rollback">
                  {rollbackMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Undo2 className="w-3 h-3 mr-1" />}Rollback
                </Button>
              )}
              <Badge className={statusInfo?.color || "bg-gray-600"}>{statusInfo?.label || pipeline.status}</Badge>
            </div>
          </div>
          <PipelineTimeline phases={phases} />
          <BudgetMeter budget={streamData?.budget || pipeline?.budget} />
          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList className="bg-zinc-900 border border-zinc-800">
              <TabsTrigger value="timeline" className="data-[state=active]:bg-zinc-700" data-testid="subtab-timeline"><Clock className="w-3 h-3 mr-1" /> Timeline</TabsTrigger>
              {hasPendingChanges && <TabsTrigger value="review" className="data-[state=active]:bg-yellow-600" data-testid="subtab-review"><Eye className="w-3 h-3 mr-1" /> Revisar & Aprovar<Badge className="bg-yellow-500 text-[9px] ml-1 h-4 px-1">{pendingStagingCount}</Badge></TabsTrigger>}
              <TabsTrigger value="preview" className="data-[state=active]:bg-zinc-700" data-testid="subtab-preview"><Monitor className="w-3 h-3 mr-1" /> Preview</TabsTrigger>
              <TabsTrigger value="runbook" className="data-[state=active]:bg-zinc-700" data-testid="subtab-runbook"><BookOpen className="w-3 h-3 mr-1" /> Runbook</TabsTrigger>
              <TabsTrigger value="artifacts" className="data-[state=active]:bg-zinc-700" data-testid="subtab-artifacts"><FileCode className="w-3 h-3 mr-1" /> Artefatos</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-3 space-y-4">
              {hasPendingChanges && (
                <Card className="bg-yellow-500/10 border-yellow-500/30 cursor-pointer hover:bg-yellow-500/15 transition-colors" onClick={() => setDetailTab("review")} data-testid="card-goto-review">
                  <CardContent className="py-4 flex items-center gap-3">
                    <Eye className="w-5 h-5 text-yellow-400" />
                    <div className="flex-1"><p className="text-sm font-medium text-yellow-300">{pendingStagingCount} arquivo(s) aguardando sua aprovação</p><p className="text-xs text-zinc-400">Clique para revisar o código e ver o preview ao vivo</p></div>
                    <ArrowRight className="w-4 h-4 text-yellow-400" />
                  </CardContent>
                </Card>
              )}
              {pipeline.error && <Card className="bg-red-500/5 border-red-500/30"><CardContent className="py-3 flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /><p className="text-sm text-red-400">{pipeline.error}</p></CardContent></Card>}
              {details?.logs?.length > 0 && (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Log dos Agentes</CardTitle></CardHeader>
                  <CardContent><ScrollArea className="h-48"><div className="space-y-1">{details.logs.map((log: any, idx: number) => (<div key={idx} className="flex items-start gap-2 text-xs"><Badge variant="outline" className="text-[10px] shrink-0">{log.agentName}</Badge><span className="text-zinc-400">{log.action}:</span><span className="text-zinc-300">{log.thought}</span></div>))}</div></ScrollArea></CardContent>
                </Card>
              )}
            </TabsContent>
            {hasPendingChanges && <TabsContent value="review" className="mt-3"><PipelineReviewPanelV2 pipelineId={pipelineId} changes={details?.staging || []} onAction={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["/api/xos/pipeline"] }); }} /></TabsContent>}
            <TabsContent value="preview" className="mt-3"><PipelinePreviewPanel /></TabsContent>
            <TabsContent value="runbook" className="mt-3"><RunbookView pipelineId={pipelineId} /></TabsContent>
            <TabsContent value="artifacts" className="mt-3">
              {details?.artifacts?.length > 0 ? (
                <Card className="bg-zinc-900 border-zinc-800"><CardContent className="pt-4"><div className="space-y-1">{details.artifacts.map((a: any) => (<div key={a.id} className="flex items-center gap-2 text-xs p-2 bg-zinc-800/50 rounded"><FileCode className="w-3 h-3 text-zinc-500" /><span className="text-zinc-300 font-mono">{a.name}</span><Badge variant="outline" className="text-[10px]">{a.type}</Badge><span className="text-zinc-500 ml-auto">{a.createdBy}</span></div>))}</div></CardContent></Card>
              ) : <p className="text-sm text-zinc-500 text-center py-4">Nenhum artefato gerado ainda</p>}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function PolicyTestsPanel() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const runTests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/governance/policy-tests");
      const data = await res.json();
      setResults(data);
      toast({ title: data.failed === 0 ? "Todos os testes passaram!" : `${data.failed} teste(s) falharam`, variant: data.failed === 0 ? "default" : "destructive" });
    } catch (err: any) { toast({ title: "Erro ao executar testes", variant: "destructive" }); }
    setLoading(false);
  };
  return (
    <Card className="bg-zinc-900 border-zinc-800" data-testid="policy-tests-panel">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-zinc-400 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Policy Tests</CardTitle>
        <Button variant="outline" size="sm" onClick={runTests} disabled={loading} data-testid="btn-run-policy-tests"><Play className="w-3 h-3 mr-1" /> Executar Testes</Button>
      </CardHeader>
      {results && (
        <CardContent>
          <div className="flex items-center gap-4 mb-3 text-sm">
            <Badge className="bg-green-600">{results.passed} passaram</Badge>
            {results.failed > 0 && <Badge className="bg-red-600">{results.failed} falharam</Badge>}
            <span className="text-xs text-zinc-500">Total: {results.total}</span>
          </div>
          <ScrollArea className="h-48"><div className="space-y-1">{results.results?.map((r: any, idx: number) => (<div key={idx} className={`flex items-start gap-2 p-2 rounded text-xs ${r.passed ? "bg-green-500/5" : "bg-red-500/10"}`}>{r.passed ? <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 shrink-0" /> : <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />}<div><span className="text-zinc-300">{r.description}</span>{!r.passed && <p className="text-red-400 mt-0.5">Esperado: {r.expected ? "permitido" : "bloqueado"}, Recebido: {r.actual ? "permitido" : "bloqueado"}</p>}</div></div>))}</div></ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}

function AgentTerminal() {
  const { data } = useQuery<any>({
    queryKey: ["/api/xos/pipeline/agent-terminal"],
    refetchInterval: 3000,
  });
  const logs = data?.logs || [];
  const terminalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className="mt-3">
      <CardHeader className="py-2 px-4 bg-gray-900 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-green-400 font-mono ml-2">Terminal do Agente</span>
          <Badge className="bg-gray-700 text-gray-300 text-[10px] ml-auto">{logs.length} comandos</Badge>
        </div>
      </CardHeader>
      <div
        ref={terminalRef}
        className="bg-gray-950 text-green-400 font-mono text-xs p-4 rounded-b-lg max-h-[300px] overflow-y-auto"
        data-testid="agent-terminal-output"
      >
        {logs.length === 0 ? (
          <div className="text-gray-600 flex items-center gap-2">
            <span className="animate-pulse">_</span> Aguardando comandos do agente...
          </div>
        ) : (
          logs.map((log: any, idx: number) => (
            <div key={idx} className="mb-3 border-b border-gray-800 pb-2 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString("pt-BR")}</span>
                <span className={log.success ? "text-green-500" : "text-red-500"}>
                  {log.success ? "✓" : "✗"}
                </span>
              </div>
              <div className="text-blue-400 mb-1">$ {log.command}</div>
              {log.output && (
                <pre className="text-gray-400 whitespace-pre-wrap text-[11px] max-h-[100px] overflow-y-auto">{log.output.slice(0, 2000)}</pre>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export default function DevCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [testRepoUrl, setTestRepoUrl] = useState("https://github.com/n8n-io/n8n");
  const [testFilePath, setTestFilePath] = useState("package.json");
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  
  const [autoCommit, setAutoCommit] = useState(false);
  const [targetBranch, setTargetBranch] = useState("main");
  const [attachedImages, setAttachedImages] = useState<{ name: string; base64: string; preview: string }[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [agentMode, setAgentMode] = useState<"plan" | "act" | "arcadia-dev">("act");
  const [planContext, setPlanContext] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [arcadiaDevRunning, setArcadiaDevRunning] = useState(false);

  const [selectedPipeline, setSelectedPipeline] = useState<number | null>(null);
  const [pipelineAttachedFiles, setPipelineAttachedFiles] = useState<{ name: string; content: string; type: string }[]>([]);
  const [pipelinePlanObjective, setPipelinePlanObjective] = useState("");
  const [pipelinePlanRefs, setPipelinePlanRefs] = useState("");
  const [showPipelinePlan, setShowPipelinePlan] = useState(false);
  const pipelineFileInputRef = useRef<HTMLInputElement>(null);

  const { data: pipelinesData, refetch: refetchPipelines } = useQuery<any>({
    queryKey: ["/api/xos/pipeline"],
    refetchInterval: 10000,
  });

  const createPipelineMutation = useMutation({
    mutationFn: async (promptText: string) => {
      const res = await apiRequest("POST", "/api/xos/pipeline", { prompt: promptText });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Pipeline iniciado!" });
      setSelectedPipeline(data.pipeline.id);
      queryClient.invalidateQueries({ queryKey: ["/api/xos/pipeline"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar pipeline", description: err.message, variant: "destructive" });
    },
  });

  const pipelines = pipelinesData?.pipelines || [];
  const runningPipelineCount = pipelines.filter((p: any) => p.status === "running").length;
  const stagingPipelineCount = pipelines.filter((p: any) => p.status === "staging_review" || p.hasPendingChanges).length;

  const loadedPipelineIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (pipelines.length === 0) return;
    const activePipelines = pipelines.filter((p: any) =>
      (p.status === "running" || p.status === "staging_review" || p.hasPendingChanges) &&
      !loadedPipelineIdsRef.current.has(p.id)
    );
    if (activePipelines.length > 0) {
      activePipelines.forEach((p: any) => loadedPipelineIdsRef.current.add(p.id));
      const pipelineMsgs: ChatMessage[] = activePipelines.map((p: any) => ({
        id: `pipeline-restore-${p.id}`,
        role: "assistant" as const,
        content: `Pipeline #${p.id}`,
        timestamp: new Date(p.createdAt || Date.now()),
        type: "pipeline" as const,
        pipelineId: p.id,
      }));
      setChatMessages(prev => {
        const existingPipelineIds = prev.filter(m => m.type === "pipeline").map(m => m.pipelineId);
        const existingSet = new Set(existingPipelineIds);
        const newMsgs = pipelineMsgs.filter(m => !existingSet.has(m.pipelineId));
        return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
      });
    }
  }, [pipelines]);

  const handlePipelineFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = await Promise.all(
      Array.from(files).map(async (f) => {
        const content = await f.text();
        return { name: f.name, content: content.slice(0, 50000), type: f.type };
      })
    );
    setPipelineAttachedFiles(prev => [...prev, ...newFiles]);
    if (pipelineFileInputRef.current) pipelineFileInputRef.current.value = "";
  };


  interface DevStep {
    step: number;
    thought: string;
    tool?: string;
    toolInput?: Record<string, any>;
    toolResult?: string;
    finished?: boolean;
    timestamp: string;
  }

  interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    type?: "text" | "spec" | "code" | "error" | "success" | "pipeline" | "review" | "arcadia-dev";
    data?: any;
    images?: { name: string; base64: string; preview: string }[];
    pipelineId?: number;
    devSteps?: DevStep[];
    devFilesModified?: string[];
    devPlan?: string[];
  }
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Descreva o que deseja criar. Os agentes vão projetar, codificar e validar automaticamente.",
      timestamp: new Date(),
      type: "text"
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const { data: repoInfo, isLoading: loadingInfo, error: infoError } = useQuery({
    queryKey: ["/api/github/info"],
    queryFn: async () => {
      const res = await fetch("/api/github/info", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao conectar");
      return res.json();
    },
    retry: false
  });

  const { data: branches, isLoading: loadingBranches } = useQuery({
    queryKey: ["/api/github/branches"],
    queryFn: async () => {
      const res = await fetch("/api/github/branches", { credentials: "include" });
      if (!res.ok) return { branches: [] };
      return res.json();
    },
    enabled: !!repoInfo?.success,
    retry: false
  });

  const analyzeMutation = useMutation({
    mutationFn: async (repoUrl: string) => {
      const res = await apiRequest("POST", "/api/github/analyze", { repoUrl });
      return res.json();
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      toast({
        title: "Análise concluída",
        description: `Repositório ${data.data?.repository || "analisado"} com sucesso`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na análise",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const readFileMutation = useMutation({
    mutationFn: async ({ repoUrl, filePath }: { repoUrl: string; filePath: string }) => {
      const res = await apiRequest("POST", "/api/github/read-external", { repoUrl, filePath });
      return res.json();
    },
    onSuccess: (data) => {
      setFileContent(data.content || null);
      toast({
        title: data.success ? "Arquivo lido" : "Erro",
        description: data.result,
        variant: data.success ? "default" : "destructive"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao ler arquivo",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  
  const processImageFile = (file: File): Promise<{ name: string; base64: string; preview: string }> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Arquivo não é uma imagem"));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error("Imagem muito grande. Máximo 10MB."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve({ name: file.name, base64, preview: base64 });
      };
      reader.onerror = () => reject(new Error("Erro ao ler imagem"));
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    try {
      const newImages = await Promise.all(
        Array.from(files).map(f => processImageFile(f))
      );
      setAttachedImages(prev => [...prev, ...newImages]);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItems = Array.from(items).filter(item => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    try {
      const newImages = await Promise.all(
        imageItems.map(item => {
          const file = item.getAsFile();
          if (!file) throw new Error("Erro ao processar imagem colada");
          return processImageFile(file);
        })
      );
      setAttachedImages(prev => [...prev, ...newImages]);
      toast({ title: "Imagem colada", description: `${newImages.length} imagem(ns) anexada(s)` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendChat = () => {
    if (!chatInput.trim() && attachedImages.length === 0) return;
    
    let fullPrompt = chatInput;
    if (pipelinePlanObjective) fullPrompt = `[Objetivo: ${pipelinePlanObjective}]\n\n${fullPrompt}`;
    if (pipelinePlanRefs) fullPrompt = `${fullPrompt}\n\n--- REFERÊNCIAS ---\n${pipelinePlanRefs}`;
    if (pipelineAttachedFiles.length > 0) fullPrompt = `${fullPrompt}\n\n--- ARQUIVOS ANEXADOS ---\n${pipelineAttachedFiles.map(f => `[${f.name}]\n${f.content.slice(0, 10000)}`).join("\n\n")}`;
    if (attachedImages.length > 0) fullPrompt = `${fullPrompt}\n\n[Imagens anexadas: ${attachedImages.map(img => img.name).join(", ")}]`;
    
    const msgContent = attachedImages.length > 0 
      ? `${attachedImages.map(img => `[img ${img.name}]`).join(" ")}\n\n${chatInput}`.trim()
      : chatInput;
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", content: msgContent, timestamp: new Date(), type: "text", images: attachedImages.length > 0 ? [...attachedImages] : undefined };
    setChatMessages(prev => [...prev, userMsg]);

    setChatInput("");
    setAttachedImages([]);
    setPipelineAttachedFiles([]);
    setPipelinePlanObjective("");
    setPipelinePlanRefs("");
    setShowPipelinePlan(false);

    if (agentMode === "arcadia-dev") {
      const thinkingId = `thinking-${Date.now()}`;
      const thinkingMsg: ChatMessage = { id: thinkingId, role: "assistant", content: "⚡ Arcádia Dev analisando e executando...", timestamp: new Date(), type: "text" };
      setChatMessages(prev => [...prev, thinkingMsg]);
      setArcadiaDevRunning(true);

      fetch("/api/arcadia-dev/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt }),
      })
        .then(res => res.json())
        .then(data => {
          setArcadiaDevRunning(false);
          if (data.success && data.task) {
            const devMsg: ChatMessage = {
              id: `arcadia-dev-${data.task.id}`,
              role: "assistant",
              content: data.task.finalAnswer || "Tarefa concluída.",
              timestamp: new Date(),
              type: "arcadia-dev",
              devSteps: data.task.steps,
              devFilesModified: data.task.filesModified,
              devPlan: data.task.plan,
            };
            setChatMessages(prev => [...prev.filter(m => m.id !== thinkingId), devMsg]);
          } else {
            const errMsg: ChatMessage = { id: `error-${Date.now()}`, role: "assistant", content: `Erro: ${data.error || "Falha ao executar"}`, timestamp: new Date(), type: "error" };
            setChatMessages(prev => [...prev.filter(m => m.id !== thinkingId), errMsg]);
          }
        })
        .catch(err => {
          setArcadiaDevRunning(false);
          const errMsg: ChatMessage = { id: `error-${Date.now()}`, role: "assistant", content: `Erro: ${err.message}`, timestamp: new Date(), type: "error" };
          setChatMessages(prev => [...prev.filter(m => m.id !== thinkingId), errMsg]);
        });
      return;
    }

    const modeLabel = agentMode === "plan" ? "Analisando projeto e gerando plano..." : "Iniciando pipeline autônomo com 6 agentes...";
    const thinkingMsg: ChatMessage = { id: `thinking-${Date.now()}`, role: "assistant", content: modeLabel, timestamp: new Date(), type: "text" };
    setChatMessages(prev => [...prev, thinkingMsg]);
    
    fetch("/api/xos/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        prompt: fullPrompt, 
        mode: agentMode,
        planContext: (agentMode === "act" && planContext) ? planContext : undefined,
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.pipeline) {
          setSelectedPipeline(data.pipeline.id);
          const pipelineMsg: ChatMessage = { id: `pipeline-${data.pipeline.id}`, role: "assistant", content: `Pipeline #${data.pipeline.id} iniciado`, timestamp: new Date(), type: "pipeline", pipelineId: data.pipeline.id };
          setChatMessages(prev => [...prev.filter(m => !m.id.startsWith("thinking")), pipelineMsg]);
        } else {
          const errorMsg: ChatMessage = { id: `error-${Date.now()}`, role: "assistant", content: `Erro: ${data.error || "Falha ao criar pipeline"}`, timestamp: new Date(), type: "error" };
          setChatMessages(prev => [...prev.filter(m => !m.id.startsWith("thinking")), errorMsg]);
        }
      })
      .catch(err => {
        const errorMsg: ChatMessage = { id: `error-${Date.now()}`, role: "assistant", content: `Erro: ${err.message}`, timestamp: new Date(), type: "error" };
        setChatMessages(prev => [...prev.filter(m => !m.id.startsWith("thinking")), errorMsg]);
      });
  };

  const [commitMessage, setCommitMessage] = useState("");
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const commitMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/github/commit", { 
        message, 
        files: [],
        branch: targetBranch 
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Commit realizado!" : "Erro",
        description: data.success ? "Alterações salvas no GitHub" : data.error,
        variant: data.success ? "default" : "destructive"
      });
      setShowCommitDialog(false);
      setCommitMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro no commit",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const isConnected = repoInfo?.success === true;

  return (
    <BrowserFrame>
      <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
            <Code2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Centro de Desenvolvimento</h1>
            <p className="text-muted-foreground">
              Crie, teste e publique funcionalidades com agentes de IA autônomos
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={!isConnected}
                    data-testid="button-history"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Histórico de commits</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={!isConnected}
                    data-testid="button-sync"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sincronizar</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="h-8 px-3 bg-blue-500 hover:bg-blue-600"
                    disabled={!isConnected || commitMutation.isPending}
                    onClick={() => setShowCommitDialog(true)}
                    data-testid="button-commit"
                  >
                    {commitMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fazer commit</TooltipContent>
              </Tooltip>
            </div>

            {loadingInfo ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
              </Badge>
            ) : isConnected ? (
              <Badge className="bg-green-500 flex items-center gap-1" data-testid="status-connected">
                <CheckCircle className="w-3 h-3" /> Conectado
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1" data-testid="status-disconnected">
                <XCircle className="w-3 h-3" /> Não configurado
              </Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue="develop" className="space-y-4">
          <TabsList>
            <TabsTrigger value="develop" data-testid="tab-develop" className="relative">
              <Sparkles className="w-4 h-4 mr-2" /> Desenvolver
              {runningPipelineCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
              {stagingPipelineCount > 0 && <span className="absolute -top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full" />}
            </TabsTrigger>
            <TabsTrigger value="status" data-testid="tab-status">
              <Settings className="w-4 h-4 mr-2" /> Status
            </TabsTrigger>
            <TabsTrigger value="analyze" data-testid="tab-analyze">
              <FolderSearch className="w-4 h-4 mr-2" /> Analisar Repos
            </TabsTrigger>
            <TabsTrigger value="tools" data-testid="tab-tools">
              <Bot className="w-4 h-4 mr-2" /> Ferramentas
            </TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system">
              <LayoutGrid className="w-4 h-4 mr-2" /> Sistema
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-preview">
              <Monitor className="w-4 h-4 mr-2" /> Preview & Aprovar
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="w-4 h-4 mr-2" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="develop" className="space-y-0">
            <Card className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
              <CardHeader className="border-b py-3 px-4">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-600" />
                  <CardTitle className="text-sm font-semibold">Dev Agent</CardTitle>
                  {createPipelineMutation.isPending && (
                    <span className="text-xs text-amber-500 flex items-center gap-1 ml-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> criando...
                    </span>
                  )}
                </div>
              </CardHeader>
              
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                      data-testid={`chat-message-${msg.id}`}
                    >
                      {msg.type === "pipeline" && msg.pipelineId ? (
                        <InlinePipelineTracker pipelineId={msg.pipelineId} />
                      ) : msg.type === "arcadia-dev" ? (
                        <div className="w-full max-w-[90%]">
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white">
                              <Zap className="w-4 h-4" />
                              <span className="text-sm font-semibold">Arcádia Dev</span>
                              <Badge className="ml-auto bg-emerald-900 text-emerald-100 text-[10px]">
                                {(msg.devSteps?.filter(s => s.step > 0) || []).length} passos
                              </Badge>
                            </div>
                            {/* Plan checklist */}
                            {msg.devPlan && msg.devPlan.length > 0 && (
                              <div className="px-3 py-2 border-b border-emerald-200 bg-emerald-50/80">
                                <p className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">Plano de execução</p>
                                <div className="space-y-1">
                                  {msg.devPlan.map((planItem, idx) => {
                                    const stepsDone = (msg.devSteps?.filter(s => s.step > 0 && s.tool) || []).length;
                                    const done = idx < stepsDone;
                                    const active = idx === stepsDone;
                                    return (
                                      <div key={idx} className={`flex items-start gap-1.5 text-[11px] ${done ? "text-emerald-700" : active ? "text-gray-800 font-medium" : "text-gray-400"}`}>
                                        <span className="mt-0.5 shrink-0">
                                          {done ? "✓" : active ? "▶" : "○"}
                                        </span>
                                        <span className={done ? "line-through opacity-70" : ""}>{planItem}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {/* Execution steps */}
                            {msg.devSteps && msg.devSteps.filter(s => s.step > 0).length > 0 && (
                              <div className="px-3 py-2 space-y-1.5 max-h-[200px] overflow-y-auto">
                                {msg.devSteps.filter(s => s.step > 0).map((step) => (
                                  <div key={step.step} className="text-[11px]">
                                    {step.tool ? (
                                      <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-emerald-700 font-mono font-bold">{step.tool}</span>
                                          {step.toolInput && (
                                            <span className="text-gray-500 truncate max-w-[220px]">
                                              {step.toolInput.path || step.toolInput.pattern || step.toolInput.command || ""}
                                            </span>
                                          )}
                                        </div>
                                        {step.toolResult && (
                                          <div className="text-gray-500 pl-3 border-l-2 border-emerald-200 line-clamp-2">
                                            {step.toolResult.slice(0, 140)}{step.toolResult.length > 140 ? "…" : ""}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-gray-500 italic truncate">{step.thought.slice(0, 100)}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Files modified */}
                            {msg.devFilesModified && msg.devFilesModified.length > 0 && (
                              <div className="px-3 py-2 border-t border-emerald-200 flex flex-wrap gap-1">
                                <span className="text-[10px] text-emerald-700 font-semibold w-full">Arquivos modificados</span>
                                {msg.devFilesModified.map((f) => (
                                  <Badge key={f} variant="outline" className="text-[10px] border-emerald-400 text-emerald-700">
                                    <FileCode className="w-2.5 h-2.5 mr-1" />{f.split("/").pop()}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {/* Final answer */}
                            <div className="px-4 py-3 border-t border-emerald-200 bg-white">
                              <p className="text-sm whitespace-pre-wrap text-gray-800">{msg.content}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Avatar className={`h-8 w-8 ${msg.role === "user" ? "bg-blue-500" : "bg-purple-600"}`}>
                            <AvatarFallback className="text-white text-xs">
                              {msg.role === "user" ? "EU" : "IA"}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              msg.role === "user"
                                ? "bg-blue-500 text-white rounded-tr-sm"
                                : msg.type === "error"
                                ? "bg-red-50 border border-red-200 text-red-800 rounded-tl-sm"
                                : msg.type === "success"
                                ? "bg-green-50 border border-green-200 text-green-800 rounded-tl-sm"
                                : msg.type === "spec"
                                ? "bg-purple-50 border border-purple-200 rounded-tl-sm"
                                : msg.type === "code"
                                ? "bg-gray-900 text-gray-100 font-mono text-sm rounded-tl-sm"
                                : "bg-gray-100 rounded-tl-sm"
                            }`}
                          >
                            {msg.images && msg.images.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {msg.images.map((img, idx) => (
                                  <img 
                                    key={idx}
                                    src={img.preview}
                                    alt={img.name}
                                    className="max-w-[200px] max-h-[150px] rounded-lg border border-white/20 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => window.open(img.preview, "_blank")}
                                    data-testid={`chat-image-${msg.id}-${idx}`}
                                  />
                                ))}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                            <p className={`text-xs mt-1 ${msg.role === "user" ? "text-blue-100" : "text-gray-400"}`}>
                              {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              
              <div className="border-t p-3 bg-gray-50/80 rounded-b-lg space-y-2">
                {(attachedImages.length > 0 || pipelineAttachedFiles.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {attachedImages.map((img, idx) => (
                      <div key={`img-${idx}`} className="relative group">
                        <img src={img.preview} alt={img.name} className="w-12 h-12 object-cover rounded border" data-testid={`attached-image-${idx}`} />
                        <button onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`remove-image-${idx}`}><X className="w-2.5 h-2.5" /></button>
                      </div>
                    ))}
                    {pipelineAttachedFiles.map((f, idx) => (
                      <div key={`file-${idx}`} className="flex items-center gap-1 px-2 py-1 bg-white rounded border text-[10px] text-gray-600">
                        <FileText className="w-3 h-3 text-blue-500" />
                        <span className="truncate max-w-[80px]">{f.name}</span>
                        <button onClick={() => setPipelineAttachedFiles(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><X className="w-2.5 h-2.5" /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  <input type="file" ref={imageInputRef} onChange={handleImageSelect} accept="image/*" multiple className="hidden" data-testid="input-image-file" />
                  <input type="file" ref={pipelineFileInputRef} onChange={handlePipelineFileSelect} accept=".pdf,.txt,.csv,.docx,.json,.md" multiple className="hidden" data-testid="input-pipeline-file-unified" />
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => imageInputRef.current?.click()} disabled={createPipelineMutation.isPending} title="Imagem" data-testid="button-attach-image">
                      <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => pipelineFileInputRef.current?.click()} disabled={createPipelineMutation.isPending} title="Arquivo" data-testid="button-attach-file-unified">
                      <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Descreva o que deseja criar..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                    onPaste={handlePaste}
                    disabled={createPipelineMutation.isPending}
                    className="flex-1 min-h-[38px] max-h-[100px] resize-none text-sm"
                    rows={1}
                    data-testid="input-chat"
                  />
                  <Button
                    onClick={handleSendChat}
                    disabled={(!chatInput.trim() && attachedImages.length === 0) || createPipelineMutation.isPending || arcadiaDevRunning}
                    className={`self-end shrink-0 ${
                      agentMode === "arcadia-dev"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : agentMode === "plan"
                        ? "bg-amber-500 hover:bg-amber-600"
                        : "bg-purple-600 hover:bg-purple-700"
                    }`}
                    data-testid="button-send-chat"
                  >
                    {arcadiaDevRunning || createPipelineMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : agentMode === "arcadia-dev"
                      ? <Zap className="w-4 h-4" />
                      : agentMode === "plan"
                      ? <BookOpen className="w-4 h-4" />
                      : <Rocket className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  <div className="flex items-center bg-white rounded border p-0.5 gap-0.5" data-testid="mode-toggle">
                    <button onClick={() => setAgentMode("plan")} className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${agentMode === "plan" ? "bg-amber-500 text-white" : "text-gray-400 hover:text-gray-600"}`} data-testid="btn-plan-mode">Planejar</button>
                    <button onClick={() => setAgentMode("act")} className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${agentMode === "act" ? "bg-purple-500 text-white" : "text-gray-400 hover:text-gray-600"}`} data-testid="btn-act-mode">Executar</button>
                    <button onClick={() => setAgentMode("arcadia-dev")} className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-0.5 ${agentMode === "arcadia-dev" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-gray-600"}`} data-testid="btn-arcadia-dev-mode">⚡ Dev</button>
                  </div>
                  {planContext && agentMode === "act" && <span className="text-amber-500">plano carregado</span>}
                  {agentMode === "arcadia-dev" && <span className="text-emerald-600 font-medium">Arcádia Dev — corrije bugs e implementa direto no código</span>}
                  <a href="/arcadia-dev" className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium hover:bg-emerald-100 transition-colors" data-testid="link-arcadia-dev-studio">
                    <ExternalLink className="w-3 h-3" /> Studio
                  </a>
                  <button onClick={() => setShowTerminal(!showTerminal)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${showTerminal ? "bg-gray-800 text-green-400" : "hover:text-gray-600"}`} data-testid="btn-toggle-terminal">
                    <Monitor className="w-3 h-3" /> terminal
                  </button>
                  <button onClick={() => setShowPipelinePlan(!showPipelinePlan)} className="hover:text-gray-600 transition-colors" data-testid="btn-toggle-plan-unified">
                    + contexto
                  </button>
                </div>

                {showPipelinePlan && (
                  <div className="space-y-1.5 p-2 bg-white rounded border">
                    <Input value={pipelinePlanObjective} onChange={(e) => setPipelinePlanObjective(e.target.value)} placeholder="Objetivo (opcional)" className="text-xs h-7" data-testid="input-plan-objective-unified" />
                    <Textarea value={pipelinePlanRefs} onChange={(e) => setPipelinePlanRefs(e.target.value)} placeholder="Referências, specs..." className="text-xs min-h-[40px] resize-none" data-testid="input-plan-refs-unified" />
                  </div>
                )}
              </div>
            </Card>

            {showTerminal && <AgentTerminal />}
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Github className="w-5 h-5" /> Repositório
                  </CardTitle>
                  <CardDescription>
                    Repositório configurado para commits automáticos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isConnected ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Nome:</span>
                        <span className="font-medium">{repoInfo.repository?.fullName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Branch padrão:</span>
                        <Badge variant="outline">{repoInfo.repository?.defaultBranch}</Badge>
                      </div>
                      <Button variant="outline" className="w-full mt-2" asChild data-testid="link-github-repo">
                        <a href={repoInfo.repository?.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" /> Abrir no GitHub
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <XCircle className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Configure o GITHUB_TOKEN nas variáveis de ambiente para habilitar
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="w-5 h-5" /> Branches
                  </CardTitle>
                  <CardDescription>
                    Branches disponíveis no repositório
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isConnected && branches?.branches ? (
                    <ScrollArea className="h-32">
                      <div className="space-y-1">
                        {branches.branches.map((branch: string, idx: number) => (
                          <div key={branch} className="flex items-center gap-2 text-sm" data-testid={`text-branch-${idx}`}>
                            <GitBranch className="w-3 h-3 text-muted-foreground" />
                            <span>{branch}</span>
                            {branch === repoInfo.repository?.defaultBranch && (
                              <Badge variant="secondary" className="text-xs">default</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {loadingBranches ? "Carregando..." : "Não disponível"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Configuração</CardTitle>
                <CardDescription>
                  Variáveis de ambiente necessárias para a integração
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>GITHUB_TOKEN</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="password" 
                          value={isConnected ? "••••••••••••••••" : ""} 
                          disabled 
                          data-testid="input-token"
                        />
                        {isConnected ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>GITHUB_OWNER</Label>
                      <Input 
                        value={isConnected ? repoInfo.repository?.fullName?.split("/")[0] || "" : "JonasRodriguesPachceo"} 
                        disabled 
                        data-testid="input-owner"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>GITHUB_REPO</Label>
                      <Input 
                        value={isConnected ? repoInfo.repository?.name || "" : "ArcadiaSuite-"} 
                        disabled 
                        data-testid="input-repo"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Para configurar, adicione estas variáveis na aba "Secrets" do Replit ou no arquivo .env
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analyze" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderSearch className="w-5 h-5" /> Analisar Repositório Externo
                </CardTitle>
                <CardDescription>
                  Analise repositórios open-source (n8n, OpenManus, etc.) para inspiração
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://github.com/n8n-io/n8n"
                    value={testRepoUrl}
                    onChange={(e) => setTestRepoUrl(e.target.value)}
                    data-testid="input-repo-url"
                  />
                  <Button 
                    onClick={() => analyzeMutation.mutate(testRepoUrl)}
                    disabled={analyzeMutation.isPending}
                    data-testid="button-analyze"
                  >
                    {analyzeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FolderSearch className="w-4 h-4" />
                    )}
                    Analisar
                  </Button>
                </div>

                {analysisResult?.success && (
                  <div className="bg-muted rounded-lg p-4" data-testid="result-analysis">
                    <h4 className="font-medium mb-2">Resultado da Análise</h4>
                    <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-64" data-testid="text-analysis-summary">
                      {analysisResult.data?.summary || analysisResult.result}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="w-5 h-5" /> Ler Arquivo Externo
                </CardTitle>
                <CardDescription>
                  Leia arquivos específicos de repositórios externos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    placeholder="https://github.com/owner/repo"
                    value={testRepoUrl}
                    onChange={(e) => setTestRepoUrl(e.target.value)}
                    data-testid="input-file-repo"
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="caminho/do/arquivo.ts"
                      value={testFilePath}
                      onChange={(e) => setTestFilePath(e.target.value)}
                      data-testid="input-file-path"
                    />
                    <Button 
                      onClick={() => readFileMutation.mutate({ repoUrl: testRepoUrl, filePath: testFilePath })}
                      disabled={readFileMutation.isPending}
                      data-testid="button-read-file"
                    >
                      {readFileMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileCode className="w-4 h-4" />
                      )}
                      Ler
                    </Button>
                  </div>
                </div>

                {fileContent && (
                  <ScrollArea className="h-64 bg-muted rounded-lg p-4">
                    <pre className="text-xs whitespace-pre-wrap">
                      {fileContent}
                    </pre>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GitCommit className="w-5 h-5 text-green-500" /> github_commit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Faz commit automático de arquivos para o repositório
                  </p>
                  <div className="text-xs bg-muted rounded p-2">
                    <code>{"github_commit(message, files[], branch?)"}</code>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FolderSearch className="w-5 h-5 text-blue-500" /> analyze_external_repo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Analisa estrutura de repositórios externos para inspiração
                  </p>
                  <div className="text-xs bg-muted rounded p-2">
                    <code>{"analyze_external_repo(repoUrl, focusPaths?)"}</code>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileCode className="w-5 h-5 text-purple-500" /> read_external_file
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Lê conteúdo de arquivos de projetos open-source
                  </p>
                  <div className="text-xs bg-muted rounded p-2">
                    <code>{"read_external_file(repoUrl, filePath)"}</code>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" /> Fluxo de Desenvolvimento Autônomo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex flex-col items-center gap-1 text-center p-2">
                    <div className="p-2 rounded-full bg-blue-100">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                    <span>Requisição</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex flex-col items-center gap-1 text-center p-2">
                    <div className="p-2 rounded-full bg-purple-100">
                      <FolderSearch className="w-4 h-4 text-purple-600" />
                    </div>
                    <span>Análise</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex flex-col items-center gap-1 text-center p-2">
                    <div className="p-2 rounded-full bg-orange-100">
                      <FileCode className="w-4 h-4 text-orange-600" />
                    </div>
                    <span>Leitura</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex flex-col items-center gap-1 text-center p-2">
                    <div className="p-2 rounded-full bg-green-100">
                      <GitCommit className="w-4 h-4 text-green-600" />
                    </div>
                    <span>Commit</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-0">
            <SystemOverviewTab />
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <StagingPreviewTab />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader className="border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-lg py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-full">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Histórico de Desenvolvimento</CardTitle>
                    <CardDescription className="text-white/70">
                      Todas as solicitações e tarefas executadas pelos agentes autônomos
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <DevHistory embedded onContinueTask={(taskTitle: string) => {
                  setChatInput(`Continuar tarefa: ${taskTitle}`);
                  const tabEl = document.querySelector('[data-testid="tab-develop"]') as HTMLElement;
                  if (tabEl) tabEl.click();
                }} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {showCommitDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCommit className="w-5 h-5" /> Fazer Commit
                </CardTitle>
                <CardDescription>
                  Descreva as alterações para salvar no GitHub
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Ex: Adiciona módulo de valuation SOTP..."
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="min-h-24"
                  data-testid="textarea-commit-message"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowCommitDialog(false)}
                    data-testid="button-cancel-commit"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => commitMutation.mutate(commitMessage)}
                    disabled={!commitMessage.trim() || commitMutation.isPending}
                    data-testid="button-confirm-commit"
                  >
                    {commitMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Commit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      </TooltipProvider>
    </BrowserFrame>
  );
}
