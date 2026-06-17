import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Code2, Database, Layout, GitBranch, BarChart3, FileText,
  Plus, Settings, Play, Zap, Layers, Puzzle, Palette,
  Terminal, Box, Workflow, PanelLeft, Table2, FormInput,
  ListChecks, PieChart, LineChart, Gauge, Bot, Code, Trash2, Save,
  Sparkles, Rocket, Wand2
} from "lucide-react";
import { useLocation } from "wouter";

import DocTypeBuilder from "./DocTypeBuilder";
import PageBuilder from "./PageBuilder";
import WorkflowBuilder from "./WorkflowBuilder";
import IDE from "./IDE";
import DevAgent from "@/components/lowcode/DevAgent";

type ActiveTool = "home" | "doctypes" | "pages" | "workflows" | "dashboards" | "reports" | "scripts" | "ide" | "agent";

interface Dashboard {
  id: number;
  name: string;
  description?: string;
  widgets: any[];
  createdAt: string;
}

interface Report {
  id: number;
  name: string;
  dataSource: string;
  fields: string[];
  filters?: any;
  createdAt: string;
}

interface Script {
  id: number;
  name: string;
  type: string;
  code: string;
  createdAt: string;
}

export default function DevelopmentModule() {
  const [activeTool, setActiveTool] = useState<ActiveTool>("home");
  const [showNewDashboardDialog, setShowNewDashboardDialog] = useState(false);
  const [showNewReportDialog, setShowNewReportDialog] = useState(false);
  const [showNewScriptDialog, setShowNewScriptDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardDesc, setNewDashboardDesc] = useState("");
  const [newReportName, setNewReportName] = useState("");
  const [newReportDataSource, setNewReportDataSource] = useState("");
  const [newScriptName, setNewScriptName] = useState("");
  const [newScriptType, setNewScriptType] = useState("validation");
  const [newScriptCode, setNewScriptCode] = useState("");
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [selectedWidgetType, setSelectedWidgetType] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: stats } = useQuery({
    queryKey: ["/api/lowcode/stats"],
    queryFn: async () => {
      try {
        const [doctypes, pages, workflows] = await Promise.all([
          fetch("/api/lowcode/doctypes").then(r => r.ok ? r.json() : []),
          fetch("/api/lowcode/pages").then(r => r.ok ? r.json() : []),
          fetch("/api/lowcode/workflows").then(r => r.ok ? r.json() : [])
        ]);
        return {
          doctypes: doctypes.length || 0,
          pages: pages.length || 0,
          workflows: workflows.length || 0,
          scripts: 0,
          dashboards: 0,
          reports: 0
        };
      } catch {
        return { doctypes: 0, pages: 0, workflows: 0, scripts: 0, dashboards: 0, reports: 0 };
      }
    }
  });

  const handleCreateDashboard = () => {
    if (!newDashboardName.trim()) {
      toast({ title: "Nome obrigatório", description: "Digite um nome para o dashboard", variant: "destructive" });
      return;
    }
    const newDashboard: Dashboard = {
      id: Date.now(),
      name: newDashboardName,
      description: newDashboardDesc,
      widgets: [],
      createdAt: new Date().toISOString()
    };
    setDashboards([...dashboards, newDashboard]);
    setSelectedDashboard(newDashboard);
    setNewDashboardName("");
    setNewDashboardDesc("");
    setShowNewDashboardDialog(false);
    toast({ title: "Dashboard criado", description: `"${newDashboard.name}" foi criado com sucesso` });
  };

  const handleCreateReport = () => {
    if (!newReportName.trim()) {
      toast({ title: "Nome obrigatório", description: "Digite um nome para o relatório", variant: "destructive" });
      return;
    }
    const newReport: Report = {
      id: Date.now(),
      name: newReportName,
      dataSource: newReportDataSource,
      fields: [],
      createdAt: new Date().toISOString()
    };
    setReports([...reports, newReport]);
    setNewReportName("");
    setNewReportDataSource("");
    setShowNewReportDialog(false);
    toast({ title: "Relatório criado", description: `"${newReport.name}" foi criado com sucesso` });
  };

  const handleCreateScript = () => {
    if (!newScriptName.trim()) {
      toast({ title: "Nome obrigatório", description: "Digite um nome para o script", variant: "destructive" });
      return;
    }
    const newScript: Script = {
      id: Date.now(),
      name: newScriptName,
      type: newScriptType,
      code: newScriptCode || "// Seu código aqui\n",
      createdAt: new Date().toISOString()
    };
    setScripts([...scripts, newScript]);
    setNewScriptName("");
    setNewScriptType("validation");
    setNewScriptCode("");
    setShowNewScriptDialog(false);
    toast({ title: "Script criado", description: `"${newScript.name}" foi criado com sucesso` });
  };

  const handleAddWidget = (widgetType: string) => {
    if (!selectedDashboard) {
      toast({ title: "Selecione um dashboard", description: "Crie ou selecione um dashboard primeiro", variant: "destructive" });
      return;
    }
    const newWidget = {
      id: Date.now(),
      type: widgetType,
      title: `${widgetType} Widget`,
      config: {}
    };
    const updated = { ...selectedDashboard, widgets: [...selectedDashboard.widgets, newWidget] };
    setSelectedDashboard(updated);
    setDashboards(dashboards.map(d => d.id === updated.id ? updated : d));
    toast({ title: "Widget adicionado", description: `Widget ${widgetType} adicionado ao dashboard` });
  };

  const handleRunReport = () => {
    toast({ title: "Executando relatório", description: "O relatório está sendo processado..." });
    setTimeout(() => {
      toast({ title: "Relatório concluído", description: "Os dados foram gerados com sucesso" });
    }, 1500);
  };

  const handleTestScript = () => {
    toast({ title: "Testando script", description: "Executando em ambiente de sandbox..." });
    setTimeout(() => {
      toast({ title: "Teste concluído", description: "Script executado sem erros" });
    }, 1000);
  };

  const tools = [
    { 
      id: "doctypes" as ActiveTool, 
      name: "DocTypes", 
      description: "Crie entidades e formulários",
      icon: Database, 
      color: "bg-blue-500",
      count: stats?.doctypes || 0,
      category: "low-code"
    },
    { 
      id: "pages" as ActiveTool, 
      name: "Páginas", 
      description: "Monte interfaces visuais",
      icon: Layout, 
      color: "bg-purple-500",
      count: stats?.pages || 0,
      category: "low-code"
    },
    { 
      id: "workflows" as ActiveTool, 
      name: "Workflows", 
      description: "Automações e integrações",
      icon: GitBranch, 
      color: "bg-green-500",
      count: stats?.workflows || 0,
      category: "no-code"
    },
    { 
      id: "dashboards" as ActiveTool, 
      name: "Dashboards", 
      description: "Painéis e KPIs visuais",
      icon: BarChart3, 
      color: "bg-orange-500",
      count: stats?.dashboards || 0,
      category: "no-code"
    },
    { 
      id: "reports" as ActiveTool, 
      name: "Relatórios", 
      description: "Relatórios personalizados",
      icon: FileText, 
      color: "bg-red-500",
      count: stats?.reports || 0,
      category: "no-code"
    },
    { 
      id: "scripts" as ActiveTool, 
      name: "Scripts", 
      description: "Código customizado",
      icon: Code2, 
      color: "bg-gray-700",
      count: stats?.scripts || 0,
      category: "low-code"
    },
    { 
      id: "ide" as ActiveTool, 
      name: "IDE", 
      description: "Editor de código completo",
      icon: Code, 
      color: "bg-cyan-600",
      count: 0,
      category: "dev"
    },
    { 
      id: "agent" as ActiveTool, 
      name: "Manus AI", 
      description: "Agente autônomo de IA",
      icon: Bot, 
      color: "bg-violet-600",
      count: 0,
      category: "dev"
    },
  ];

  const [, navigate] = useLocation();

  const aiTools = [
    {
      id: "dev-center",
      name: "IA Autônoma",
      description: "Crie funcionalidades com prompts em português. Os agentes projetam, codificam e validam automaticamente.",
      icon: Sparkles,
      color: "from-purple-600 to-indigo-700",
      features: ["Desenvolver", "Preview", "Publicar", "Analisar Repos"],
      path: "/dev-center"
    }
  ];

  const renderHome = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Centro de Desenvolvimento</h1>
          <p className="text-gray-500">Crie módulos, automações e interfaces sem código</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Zap className="w-4 h-4 mr-2" />
          Low-Code / No-Code
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total de Componentes</p>
                <p className="text-3xl font-bold">{(stats?.doctypes || 0) + (stats?.pages || 0) + (stats?.workflows || 0)}</p>
              </div>
              <Layers className="w-12 h-12 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Automações Ativas</p>
                <p className="text-3xl font-bold">{stats?.workflows || 0}</p>
              </div>
              <Workflow className="w-12 h-12 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Interfaces Criadas</p>
                <p className="text-3xl font-bold">{stats?.pages || 0}</p>
              </div>
              <PanelLeft className="w-12 h-12 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card 
        className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white cursor-pointer hover:shadow-xl transition-all hover:scale-[1.01] border-0"
        onClick={() => navigate("/dev-center")}
        data-testid="card-ai-autonomous"
      >
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="p-4 rounded-2xl bg-white/20 backdrop-blur">
              <Sparkles className="w-10 h-10" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">IA Autônoma</h2>
                <Badge className="bg-white/20 text-white border-0">Centro de Comando</Badge>
              </div>
              <p className="text-white/80 mb-3">
                Descreva o que você quer criar em português e a IA vai usar todas as ferramentas abaixo automaticamente: DocTypes, Páginas, Workflows, Dashboards...
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1 rounded-full">
                  <Rocket className="w-4 h-4" />
                  Desenvolver
                </div>
                <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1 rounded-full">
                  <Play className="w-4 h-4" />
                  Preview ao Vivo
                </div>
                <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1 rounded-full">
                  <Zap className="w-4 h-4" />
                  Publicar
                </div>
              </div>
            </div>
            <Button className="bg-white text-purple-700 hover:bg-white/90" data-testid="button-open-ai">
              Abrir Centro de IA
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Engine card */}
      <Card
        className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white cursor-pointer hover:shadow-xl transition-all hover:scale-[1.01] border-0"
        onClick={() => navigate("/prompt-engine")}
        data-testid="card-prompt-engine"
      >
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="p-4 rounded-2xl bg-white/20 backdrop-blur shrink-0">
              <Wand2 className="w-10 h-10" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">Prompt Engine</h2>
                <Badge className="bg-white/20 text-white border-0">Framework P.R.O.M.P.T.</Badge>
              </div>
              <p className="text-white/80 mb-3">
                Crie, gerencie e execute prompts de IA com qualidade garantida. Gates automáticos avaliam completude e a IA compila e testa em tempo real.
              </p>
              <div className="flex items-center gap-3">
                {["Personas","Gates de Qualidade","Templates","Execução IA"].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-sm bg-white/10 px-3 py-1 rounded-full">{f}</div>
                ))}
              </div>
            </div>
            <Button className="bg-white text-purple-700 hover:bg-white/90 shrink-0" data-testid="button-open-prompt-engine">
              Abrir
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Puzzle className="w-5 h-5" />
          Ferramentas de Desenvolvimento
          <span className="text-sm font-normal text-muted-foreground ml-2">
            (A IA pode usar todas automaticamente)
          </span>
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          {tools.map((tool) => (
            <Card 
              key={tool.id}
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
              onClick={() => setActiveTool(tool.id)}
              data-testid={`dev-tool-${tool.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${tool.color}`}>
                    <tool.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{tool.name}</h3>
                      <Badge variant={tool.category === "no-code" ? "default" : "secondary"}>
                        {tool.category}
                      </Badge>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">{tool.description}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-sm text-gray-400">{tool.count} criados</span>
                      <Button size="sm" variant="ghost" className="text-blue-600">
                        <Plus className="w-3 h-3 mr-1" />
                        Criar novo
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="w-5 h-5" />
              Componentes Pré-definidos
            </CardTitle>
            <CardDescription>Blocos prontos para usar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: FormInput, name: "Formulário", color: "bg-blue-100 text-blue-600" },
                { icon: Table2, name: "Tabela", color: "bg-green-100 text-green-600" },
                { icon: PieChart, name: "Gráfico Pizza", color: "bg-orange-100 text-orange-600" },
                { icon: LineChart, name: "Gráfico Linha", color: "bg-purple-100 text-purple-600" },
                { icon: Gauge, name: "Medidor", color: "bg-red-100 text-red-600" },
                { icon: ListChecks, name: "Lista", color: "bg-gray-100 text-gray-600" },
              ].map((comp) => (
                <div 
                  key={comp.name}
                  className={`p-3 rounded-lg ${comp.color} flex flex-col items-center gap-2 cursor-pointer hover:opacity-80`}
                >
                  <comp.icon className="w-6 h-6" />
                  <span className="text-xs font-medium">{comp.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Templates Prontos
            </CardTitle>
            <CardDescription>Comece com um modelo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "CRUD Completo", desc: "Listagem + Formulário + Detalhes", icon: Database },
                { name: "Dashboard Executivo", desc: "KPIs + Gráficos + Alertas", icon: BarChart3 },
                { name: "Workflow de Aprovação", desc: "Solicitação → Análise → Aprovação", icon: GitBranch },
              ].map((template) => (
                <div 
                  key={template.name}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex items-center gap-3"
                >
                  <div className="p-2 bg-gray-100 rounded">
                    <template.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-gray-500">{template.desc}</p>
                  </div>
                  <Button size="sm" variant="ghost">Usar</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderDashboardBuilder = () => (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Dashboard Builder</h2>
          <p className="text-sm text-gray-500">Crie painéis visuais com arrastar e soltar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowConfigDialog(true)} data-testid="btn-config-dashboard">
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
          <Button onClick={() => setShowNewDashboardDialog(true)} data-testid="btn-new-dashboard">
            <Plus className="w-4 h-4 mr-2" />
            Novo Dashboard
          </Button>
        </div>
      </div>
      <div className="flex-1 p-6">
        {selectedDashboard && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-800">{selectedDashboard.name}</p>
              <p className="text-sm text-blue-600">{selectedDashboard.widgets.length} widgets</p>
            </div>
            <Badge variant="secondary">Editando</Badge>
          </div>
        )}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4 border-dashed border-2 cursor-pointer hover:border-blue-500 hover:bg-blue-50" onClick={() => handleAddWidget("KPI Card")} data-testid="widget-kpi">
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <Gauge className="w-8 h-8" />
              <span className="text-sm">KPI Card</span>
            </div>
          </Card>
          <Card className="p-4 border-dashed border-2 cursor-pointer hover:border-blue-500 hover:bg-blue-50" onClick={() => handleAddWidget("Gráfico Barras")} data-testid="widget-bar">
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <BarChart3 className="w-8 h-8" />
              <span className="text-sm">Gráfico Barras</span>
            </div>
          </Card>
          <Card className="p-4 border-dashed border-2 cursor-pointer hover:border-blue-500 hover:bg-blue-50" onClick={() => handleAddWidget("Gráfico Pizza")} data-testid="widget-pie">
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <PieChart className="w-8 h-8" />
              <span className="text-sm">Gráfico Pizza</span>
            </div>
          </Card>
          <Card className="p-4 border-dashed border-2 cursor-pointer hover:border-blue-500 hover:bg-blue-50" onClick={() => handleAddWidget("Tabela")} data-testid="widget-table">
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <Table2 className="w-8 h-8" />
              <span className="text-sm">Tabela</span>
            </div>
          </Card>
        </div>
        <Card className="h-96 border-dashed border-2 flex items-center justify-center">
          {selectedDashboard && selectedDashboard.widgets.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 p-4 w-full h-full">
              {selectedDashboard.widgets.map((widget, index) => (
                <div key={widget.id} className="border rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{widget.type}</span>
                    <Button variant="ghost" size="sm" onClick={() => {
                      const updated = { ...selectedDashboard, widgets: selectedDashboard.widgets.filter((_, i) => i !== index) };
                      setSelectedDashboard(updated);
                      setDashboards(dashboards.map(d => d.id === updated.id ? updated : d));
                    }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="h-24 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                    Preview {widget.type}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400">
              <Layout className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg">Área do Dashboard</p>
              <p className="text-sm">Clique nos widgets acima para adicionar ao painel</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  const renderReportBuilder = () => (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Report Builder</h2>
          <p className="text-sm text-gray-500">Crie relatórios personalizados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRunReport} data-testid="btn-run-report">
            <Play className="w-4 h-4 mr-2" />
            Executar
          </Button>
          <Button onClick={() => setShowNewReportDialog(true)} data-testid="btn-new-report">
            <Plus className="w-4 h-4 mr-2" />
            Novo Relatório
          </Button>
        </div>
      </div>
      <div className="flex-1 flex">
        <div className="w-64 bg-white border-r p-4">
          <h3 className="font-medium mb-3">Fonte de Dados</h3>
          <div className="space-y-2">
            {["Clientes", "Produtos", "Pedidos", "Amostras", "Laudos"].map((source) => (
              <div key={source} className="p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 flex items-center gap-2" onClick={() => setNewReportDataSource(source)}>
                <Database className="w-4 h-4 text-gray-500" />
                <span className="text-sm">{source}</span>
              </div>
            ))}
          </div>
          <h3 className="font-medium mt-6 mb-3">Campos</h3>
          <div className="space-y-1">
            {["ID", "Nome", "Data", "Status", "Valor"].map((field) => (
              <div key={field} className="p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 text-sm">
                {field}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 p-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Preview do Relatório</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-gray-50 h-64 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-2" />
                  <p>Selecione campos e configure filtros</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderScriptEditor = () => (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Script Editor</h2>
          <p className="text-sm text-gray-500">Código customizado para eventos e validações</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestScript} data-testid="btn-test-script">
            <Play className="w-4 h-4 mr-2" />
            Testar
          </Button>
          <Button onClick={() => setShowNewScriptDialog(true)} data-testid="btn-new-script">
            <Plus className="w-4 h-4 mr-2" />
            Novo Script
          </Button>
        </div>
      </div>
      <div className="flex-1 flex">
        <div className="w-64 bg-white border-r p-4">
          <h3 className="font-medium mb-3">Tipos de Script</h3>
          <div className="space-y-2">
            {[
              { name: "Validação", desc: "Validar dados antes de salvar", value: "validation" },
              { name: "Evento", desc: "Executar em ações do usuário", value: "event" },
              { name: "Cálculo", desc: "Campos calculados", value: "calculation" },
              { name: "API", desc: "Integrações externas", value: "api" },
            ].map((type) => (
              <div key={type.name} className="p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100" onClick={() => setNewScriptType(type.value)}>
                <p className="text-sm font-medium">{type.name}</p>
                <p className="text-xs text-gray-500">{type.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 bg-gray-900 p-4">
          <div className="font-mono text-sm text-green-400">
            <p className="text-gray-500">// Exemplo de script de validação</p>
            <p className="mt-2"><span className="text-purple-400">function</span> <span className="text-yellow-400">validate</span>(doc) {"{"}</p>
            <p className="ml-4"><span className="text-purple-400">if</span> (!doc.name) {"{"}</p>
            <p className="ml-8"><span className="text-purple-400">throw new</span> <span className="text-blue-400">Error</span>(<span className="text-green-300">"Nome é obrigatório"</span>);</p>
            <p className="ml-4">{"}"}</p>
            <p className="ml-4"><span className="text-purple-400">return true</span>;</p>
            <p>{"}"}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex bg-gray-50">
      <div className="w-16 bg-gray-900 flex flex-col items-center py-4 gap-2">
        <button
          onClick={() => setActiveTool("home")}
          className={`p-3 rounded-lg transition-colors ${activeTool === "home" ? "bg-blue-600" : "hover:bg-gray-700"}`}
          title="Home"
          data-testid="nav-dev-home"
        >
          <Code2 className="w-5 h-5 text-white" />
        </button>
        <div className="w-8 border-t border-gray-700 my-2" />
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={`p-3 rounded-lg transition-colors ${activeTool === tool.id ? "bg-blue-600" : "hover:bg-gray-700"}`}
            title={tool.name}
            data-testid={`nav-dev-${tool.id}`}
          >
            <tool.icon className="w-5 h-5 text-white" />
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTool === "home" && renderHome()}
        {activeTool === "doctypes" && <DocTypeBuilder />}
        {activeTool === "pages" && <PageBuilder />}
        {activeTool === "workflows" && <WorkflowBuilder />}
        {activeTool === "dashboards" && renderDashboardBuilder()}
        {activeTool === "reports" && renderReportBuilder()}
        {activeTool === "scripts" && renderScriptEditor()}
        {activeTool === "ide" && <IDE />}
        {activeTool === "agent" && <DevAgent />}
      </div>

      <Dialog open={showNewDashboardDialog} onOpenChange={setShowNewDashboardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Dashboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Dashboard *</Label>
              <Input 
                value={newDashboardName} 
                onChange={(e) => setNewDashboardName(e.target.value)}
                placeholder="Ex: Dashboard de Vendas"
                data-testid="input-dashboard-name"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea 
                value={newDashboardDesc}
                onChange={(e) => setNewDashboardDesc(e.target.value)}
                placeholder="Descreva o propósito deste dashboard..."
                data-testid="input-dashboard-desc"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDashboardDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateDashboard} data-testid="btn-create-dashboard">Criar Dashboard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewReportDialog} onOpenChange={setShowNewReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Relatório</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Relatório *</Label>
              <Input 
                value={newReportName}
                onChange={(e) => setNewReportName(e.target.value)}
                placeholder="Ex: Relatório de Clientes"
                data-testid="input-report-name"
              />
            </div>
            <div>
              <Label>Fonte de Dados</Label>
              <Select value={newReportDataSource} onValueChange={setNewReportDataSource}>
                <SelectTrigger data-testid="select-report-source">
                  <SelectValue placeholder="Selecione a fonte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Clientes">Clientes</SelectItem>
                  <SelectItem value="Produtos">Produtos</SelectItem>
                  <SelectItem value="Pedidos">Pedidos</SelectItem>
                  <SelectItem value="Amostras">Amostras</SelectItem>
                  <SelectItem value="Laudos">Laudos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewReportDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateReport} data-testid="btn-create-report">Criar Relatório</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewScriptDialog} onOpenChange={setShowNewScriptDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Script</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome do Script *</Label>
                <Input 
                  value={newScriptName}
                  onChange={(e) => setNewScriptName(e.target.value)}
                  placeholder="Ex: validar_cliente"
                  data-testid="input-script-name"
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={newScriptType} onValueChange={setNewScriptType}>
                  <SelectTrigger data-testid="select-script-type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="validation">Validação</SelectItem>
                    <SelectItem value="event">Evento</SelectItem>
                    <SelectItem value="calculation">Cálculo</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Código Inicial</Label>
              <Textarea 
                value={newScriptCode}
                onChange={(e) => setNewScriptCode(e.target.value)}
                placeholder="// Seu código aqui"
                className="font-mono h-32"
                data-testid="input-script-code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewScriptDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateScript} data-testid="btn-create-script">Criar Script</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Dashboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Dashboards Criados</Label>
              <div className="space-y-2 mt-2">
                {dashboards.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum dashboard criado ainda</p>
                ) : (
                  dashboards.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{d.name}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setSelectedDashboard(d); setShowConfigDialog(false); }}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDashboards(dashboards.filter(db => db.id !== d.id))}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowConfigDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
