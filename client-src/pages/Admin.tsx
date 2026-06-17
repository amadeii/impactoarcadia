import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState, useEffect, type ElementType } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Database,
  Plus,
  Trash2,
  Play,
  Settings,
  BookOpen,
  Link,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Zap,
  Package,
  ExternalLink,
  Search,
  Brain,
  Code,
  Network,
  Boxes,
  ArrowRight,
  MessageCircle,
  BarChart3,
  Compass,
  Handshake,
  Factory,
  Headphones,
  Calculator,
  Layers,
  Home,
  Bot,
  Globe,
  Workflow,
  Palette,
  Building2,
  Users,
  Crown,
  UserCog,
  DollarSign,
  Edit,
  ChevronDown,
  ChevronRight,
  Receipt,
  Wallet,
  Hash,
  Plug,
  Share2,
  ShoppingCart,
  FileText,
  Store,
  GraduationCap,
  Server,
  Terminal,
  Layout,
  Blocks,
  ThumbsUp,
  Shield,
  HardDrive,
  Wrench,
  ClipboardCheck,
  PenTool,
  MapPin,
  Github,
  Activity,
  Gauge,
  Signal,
  Square,
  AlertCircle,
  RefreshCw,
  Cpu,
  Sparkles,
  ArrowDown,
  Key,
  Eye,
  EyeOff,
  Save,
  TestTube2,
} from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ErpConnection {
  id: number;
  name: string;
  type: string;
  baseUrl: string;
  isActive: string;
  createdAt: string;
}

interface AgentTask {
  id: number;
  name: string;
  type: string;
  schedule: string | null;
  erpConnectionId: number | null;
  config: string | null;
  status: string | null;
  lastRun: string | null;
  nextRun: string | null;
  createdAt: string;
}

interface KnowledgeBaseEntry {
  id: number;
  title: string;
  content: string;
  author: string;
  category: string;
  source: string | null;
  createdAt: string;
}

interface LibraryPackage {
  name: string;
  version: string;
  type: string;
  category: string;
}

interface LibrariesData {
  nodejs: {
    dependencies: LibraryPackage[];
    devDependencies: LibraryPackage[];
    total: number;
  };
  python: {
    dependencies: LibraryPackage[];
    total: number;
    note?: string;
  };
}

async function fetchConnections(): Promise<ErpConnection[]> {
  const response = await fetch("/api/soe/connections", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch connections");
  return response.json();
}

async function fetchTasks(): Promise<AgentTask[]> {
  const response = await fetch("/api/soe/tasks", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch tasks");
  return response.json();
}

async function fetchKnowledgeBase(): Promise<KnowledgeBaseEntry[]> {
  const response = await fetch("/api/knowledge-base", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch knowledge base");
  return response.json();
}

async function fetchLibraries(): Promise<LibrariesData> {
  const response = await fetch("/api/admin/libraries", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch libraries");
  return response.json();
}

export default function Admin() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("connections");

  const [newConnection, setNewConnection] = useState({
    name: "",
    type: "arcadia_plus",
    baseUrl: "",
    apiKey: "",
    apiSecret: "",
  });

  const [newTask, setNewTask] = useState({
    name: "",
    type: "financial_analysis",
    schedule: "",
    erpConnectionId: "",
  });

  const [newKbEntry, setNewKbEntry] = useState({
    title: "",
    content: "",
    author: "",
    category: "tributacao",
    source: "",
  });

  const { data: connections = [], isLoading: loadingConnections } = useQuery({
    queryKey: ["erp-connections"],
    queryFn: fetchConnections,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["erp-tasks"],
    queryFn: fetchTasks,
  });

  const { data: knowledgeBase = [], isLoading: loadingKb } = useQuery({
    queryKey: ["knowledge-base"],
    queryFn: fetchKnowledgeBase,
  });

  const { data: libraries, isLoading: loadingLibraries } = useQuery({
    queryKey: ["admin-libraries"],
    queryFn: fetchLibraries,
  });

  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("all");

  const createConnectionMutation = useMutation({
    mutationFn: async (data: typeof newConnection) => {
      const response = await fetch("/api/soe/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create connection");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-connections"] });
      setNewConnection({ name: "", type: "arcadia_plus", baseUrl: "", apiKey: "", apiSecret: "" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/soe/connections/${id}/test`, {
        method: "POST",
        credentials: "include",
      });
      return response.json();
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/soe/connections/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-connections"] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof newTask) => {
      const response = await fetch("/api/soe/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          erpConnectionId: data.erpConnectionId ? parseInt(data.erpConnectionId) : null,
        }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-tasks"] });
      setNewTask({ name: "", type: "financial_analysis", schedule: "", erpConnectionId: "" });
    },
  });

  const executeTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/soe/tasks/${id}/execute`, {
        method: "POST",
        credentials: "include",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/soe/tasks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-tasks"] });
    },
  });

  const createKbMutation = useMutation({
    mutationFn: async (data: typeof newKbEntry) => {
      const response = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create knowledge base entry");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      setNewKbEntry({ title: "", content: "", author: "", category: "tributacao", source: "" });
    },
  });

  const deleteKbMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/knowledge-base/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
    },
  });

  const taskTypes = [
    { value: "financial_analysis", label: "Análise Financeira" },
    { value: "inventory_monitoring", label: "Monitoramento de Estoque" },
    { value: "sales_report", label: "Relatório de Vendas" },
    { value: "payables_alert", label: "Alertas de Contas a Pagar" },
    { value: "receivables_alert", label: "Alertas de Contas a Receber" },
  ];

  const kbCategories = [
    { value: "tributacao", label: "Tributação" },
    { value: "juridico", label: "Jurídico" },
    { value: "contabil", label: "Contábil" },
    { value: "financeiro", label: "Financeiro" },
    { value: "processos", label: "Processos" },
    { value: "politicas", label: "Políticas" },
  ];

  return (
    <BrowserFrame>
      <div className="h-full w-full bg-slate-50 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">Administração</h1>
              <p className="text-slate-500 text-sm">Gerencie conexões SOE, tarefas e base de conhecimento</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="connections" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Conexões SOE
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Tarefas Autônomas
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Base de Conhecimento
              </TabsTrigger>
              <TabsTrigger value="libraries" className="flex items-center gap-2" data-testid="tab-libraries">
                <Package className="w-4 h-4" />
                Bibliotecas
              </TabsTrigger>
              <TabsTrigger value="modules" className="flex items-center gap-2" data-testid="tab-modules">
                <Boxes className="w-4 h-4" />
                Módulos
              </TabsTrigger>
              <TabsTrigger value="machine-house" className="flex items-center gap-2" data-testid="tab-machine-house">
                <Factory className="w-4 h-4" />
                Casa de Máquinas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="connections">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Nova Conexão Motor</CardTitle>
                    <CardDescription>Conecte ao Arcádia Plus ou ERPNext</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Nome da Conexão</Label>
                      <Input
                        value={newConnection.name}
                        onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                        placeholder="Ex: Produção Arcadia Plus"
                        data-testid="input-connection-name"
                      />
                    </div>
                    <div>
                      <Label>Tipo de Motor</Label>
                      <Select
                        value={newConnection.type}
                        onValueChange={(value) => setNewConnection({ ...newConnection, type: value })}
                      >
                        <SelectTrigger data-testid="select-erp-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="arcadia_plus">Arcadia Plus (REST API)</SelectItem>
                          <SelectItem value="arcadia_next">ERPNext (Frappe)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>URL Base da API</Label>
                      <Input
                        value={newConnection.baseUrl}
                        onChange={(e) => setNewConnection({ ...newConnection, baseUrl: e.target.value })}
                        placeholder="https://api.arcadiaplus.com.br"
                        data-testid="input-base-url"
                      />
                    </div>
                    <div>
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={newConnection.apiKey}
                        onChange={(e) => setNewConnection({ ...newConnection, apiKey: e.target.value })}
                        placeholder="Sua chave de API"
                        data-testid="input-api-key"
                      />
                    </div>
                    <div>
                      <Label>API Secret</Label>
                      <Input
                        type="password"
                        value={newConnection.apiSecret}
                        onChange={(e) => setNewConnection({ ...newConnection, apiSecret: e.target.value })}
                        placeholder="Seu secret"
                        data-testid="input-api-secret"
                      />
                    </div>
                    <Button
                      onClick={() => createConnectionMutation.mutate(newConnection)}
                      disabled={createConnectionMutation.isPending || !newConnection.name || !newConnection.baseUrl}
                      className="w-full"
                      data-testid="button-create-connection"
                    >
                      {createConnectionMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Criar Conexão
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Conexões Ativas</CardTitle>
                    <CardDescription>{connections.length} conexões configuradas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      {loadingConnections ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : connections.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          Nenhuma conexão configurada
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {connections.map((conn) => (
                            <div
                              key={conn.id}
                              className="p-4 bg-slate-50 rounded-lg border"
                              data-testid={`connection-${conn.id}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Link className="w-4 h-4 text-primary" />
                                  <span className="font-medium">{conn.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => testConnectionMutation.mutate(conn.id)}
                                    disabled={testConnectionMutation.isPending}
                                    data-testid={`test-connection-${conn.id}`}
                                  >
                                    {testConnectionMutation.isPending ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Play className="w-3 h-3" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteConnectionMutation.mutate(conn.id)}
                                    data-testid={`delete-connection-${conn.id}`}
                                  >
                                    <Trash2 className="w-3 h-3 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                              <div className="text-xs text-slate-500 space-y-1">
                                <div>Tipo: {conn.type === "arcadia_plus" ? "Arcádia Plus" : "ERPNext"}</div>
                                <div className="truncate">URL: {conn.baseUrl}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tasks">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Nova Tarefa Autônoma</CardTitle>
                    <CardDescription>Configure tarefas que o agente executará automaticamente</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Nome da Tarefa</Label>
                      <Input
                        value={newTask.name}
                        onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                        placeholder="Ex: Análise Diária de Balanço"
                        data-testid="input-task-name"
                      />
                    </div>
                    <div>
                      <Label>Tipo de Tarefa</Label>
                      <Select
                        value={newTask.type}
                        onValueChange={(value) => setNewTask({ ...newTask, type: value })}
                      >
                        <SelectTrigger data-testid="select-task-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {taskTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Conexão Motor</Label>
                      <Select
                        value={newTask.erpConnectionId}
                        onValueChange={(value) => setNewTask({ ...newTask, erpConnectionId: value })}
                      >
                        <SelectTrigger data-testid="select-task-connection">
                          <SelectValue placeholder="Selecione uma conexão" />
                        </SelectTrigger>
                        <SelectContent>
                          {connections.map((conn) => (
                            <SelectItem key={conn.id} value={conn.id.toString()}>
                              {conn.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Agendamento (opcional)</Label>
                      <Input
                        value={newTask.schedule}
                        onChange={(e) => setNewTask({ ...newTask, schedule: e.target.value })}
                        placeholder="Ex: 0 8 * * * (diário às 8h)"
                        data-testid="input-task-schedule"
                      />
                    </div>
                    <Button
                      onClick={() => createTaskMutation.mutate(newTask)}
                      disabled={createTaskMutation.isPending || !newTask.name}
                      className="w-full"
                      data-testid="button-create-task"
                    >
                      {createTaskMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Criar Tarefa
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tarefas Configuradas</CardTitle>
                    <CardDescription>{tasks.length} tarefas ativas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      {loadingTasks ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : tasks.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          Nenhuma tarefa configurada
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {tasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-4 bg-slate-50 rounded-lg border"
                              data-testid={`task-${task.id}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-amber-500" />
                                  <span className="font-medium">{task.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => executeTaskMutation.mutate(task.id)}
                                    disabled={executeTaskMutation.isPending}
                                    data-testid={`execute-task-${task.id}`}
                                  >
                                    {executeTaskMutation.isPending ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Play className="w-3 h-3" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteTaskMutation.mutate(task.id)}
                                    data-testid={`delete-task-${task.id}`}
                                  >
                                    <Trash2 className="w-3 h-3 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                              <div className="text-xs text-slate-500 space-y-1">
                                <div>Tipo: {taskTypes.find(t => t.value === task.type)?.label || task.type}</div>
                                {task.lastRun && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Última execução: {new Date(task.lastRun).toLocaleString("pt-BR")}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="knowledge">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Novo Documento</CardTitle>
                    <CardDescription>Adicione conhecimento à Inteligência Arcádia Business</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Título</Label>
                      <Input
                        value={newKbEntry.title}
                        onChange={(e) => setNewKbEntry({ ...newKbEntry, title: e.target.value })}
                        placeholder="Ex: Guia de ICMS para Comércio Eletrônico"
                        data-testid="input-kb-title"
                      />
                    </div>
                    <div>
                      <Label>Autor</Label>
                      <Input
                        value={newKbEntry.author}
                        onChange={(e) => setNewKbEntry({ ...newKbEntry, author: e.target.value })}
                        placeholder="Ex: Dr. João Silva"
                        data-testid="input-kb-author"
                      />
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select
                        value={newKbEntry.category}
                        onValueChange={(value) => setNewKbEntry({ ...newKbEntry, category: value })}
                      >
                        <SelectTrigger data-testid="select-kb-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {kbCategories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Fonte (opcional)</Label>
                      <Input
                        value={newKbEntry.source}
                        onChange={(e) => setNewKbEntry({ ...newKbEntry, source: e.target.value })}
                        placeholder="Ex: Decreto 1234/2024"
                        data-testid="input-kb-source"
                      />
                    </div>
                    <div>
                      <Label>Conteúdo</Label>
                      <Textarea
                        value={newKbEntry.content}
                        onChange={(e) => setNewKbEntry({ ...newKbEntry, content: e.target.value })}
                        placeholder="Conteúdo completo do documento..."
                        rows={8}
                        data-testid="input-kb-content"
                      />
                    </div>
                    <Button
                      onClick={() => createKbMutation.mutate(newKbEntry)}
                      disabled={createKbMutation.isPending || !newKbEntry.title || !newKbEntry.content || !newKbEntry.author}
                      className="w-full"
                      data-testid="button-create-kb"
                    >
                      {createKbMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Adicionar Documento
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Inteligência Arcádia Business</CardTitle>
                    <CardDescription>{knowledgeBase.length} documentos na base</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      {loadingKb ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : knowledgeBase.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          Nenhum documento na base
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {knowledgeBase.map((entry) => (
                            <div
                              key={entry.id}
                              className="p-4 bg-slate-50 rounded-lg border"
                              data-testid={`kb-entry-${entry.id}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-primary" />
                                  <span className="font-medium">{entry.title}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteKbMutation.mutate(entry.id)}
                                  data-testid={`delete-kb-${entry.id}`}
                                >
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </Button>
                              </div>
                              <div className="text-xs text-slate-500 space-y-1">
                                <div>Autor: {entry.author}</div>
                                <div>Categoria: {kbCategories.find(c => c.value === entry.category)?.label || entry.category}</div>
                                {entry.source && <div>Fonte: {entry.source}</div>}
                                <div className="mt-2 text-slate-600 line-clamp-2">{entry.content}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="libraries">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Bibliotecas do Sistema</h2>
                    <p className="text-sm text-slate-500">
                      {libraries?.nodejs?.total ?? 0} pacotes Node.js instalados
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Buscar biblioteca..."
                        value={librarySearch}
                        onChange={(e) => setLibrarySearch(e.target.value)}
                        className="pl-9 w-64"
                        data-testid="input-library-search"
                      />
                    </div>
                    <Select value={libraryFilter} onValueChange={setLibraryFilter}>
                      <SelectTrigger className="w-40" data-testid="select-library-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="production">Produção</SelectItem>
                        <SelectItem value="development">Desenvolvimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5 text-green-600" />
                        Node.js - Produção
                      </CardTitle>
                      <CardDescription>
                        {libraries?.nodejs?.dependencies?.length ?? 0} dependências de produção
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        {loadingLibraries ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(libraries?.nodejs?.dependencies ?? [])
                              .filter(pkg => 
                                librarySearch === "" || 
                                pkg.name.toLowerCase().includes(librarySearch.toLowerCase())
                              )
                              .filter(pkg => libraryFilter === "all" || libraryFilter === "production")
                              .map((pkg) => (
                                <div
                                  key={pkg.name}
                                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors"
                                  data-testid={`lib-${pkg.name}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <Package className="h-4 w-4 text-slate-500" />
                                    <div>
                                      <div className="font-medium text-sm">{pkg.name}</div>
                                      <div className="text-xs text-slate-500">{pkg.category}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                      v{pkg.version}
                                    </Badge>
                                    <a
                                      href={`https://www.npmjs.com/package/${pkg.name}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-slate-400 hover:text-primary"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-600" />
                        Node.js - Desenvolvimento
                      </CardTitle>
                      <CardDescription>
                        {libraries?.nodejs?.devDependencies?.length ?? 0} dependências de desenvolvimento
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        {loadingLibraries ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(libraries?.nodejs?.devDependencies ?? [])
                              .filter(pkg => 
                                librarySearch === "" || 
                                pkg.name.toLowerCase().includes(librarySearch.toLowerCase())
                              )
                              .filter(pkg => libraryFilter === "all" || libraryFilter === "development")
                              .map((pkg) => (
                                <div
                                  key={pkg.name}
                                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors"
                                  data-testid={`lib-dev-${pkg.name}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <Package className="h-4 w-4 text-slate-500" />
                                    <div>
                                      <div className="font-medium text-sm">{pkg.name}</div>
                                      <div className="text-xs text-slate-500">{pkg.category}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-600">
                                      v{pkg.version}
                                    </Badge>
                                    <a
                                      href={`https://www.npmjs.com/package/${pkg.name}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-slate-400 hover:text-primary"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5 text-yellow-600" />
                      Python Microservices
                    </CardTitle>
                    <CardDescription>
                      {libraries?.python?.note ?? "Bibliotecas Python para processamento avançado"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-slate-400">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">Planejado para próximas versões</p>
                      <p className="text-sm mt-2">
                        Microserviços Python para: Blockchain/Web3, Cálculos Financeiros, ML/AI, RPA Contábil
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="modules">
              <ModulesSection />
            </TabsContent>

            <TabsContent value="machine-house">
              <MachineHouseSection />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </BrowserFrame>
  );
}

type ModuleCategory = {
  id: string;
  name: string;
  modules: SystemModule[];
};

type SystemModule = {
  id: string;
  name: string;
  description: string;
  icon: ElementType;
  color: string;
  path: string;
  status: "active" | "coming_soon";
  features: string[];
};

function ModulesSection() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: tenantModules } = useQuery({
    queryKey: ["tenant-modules"],
    queryFn: async () => {
      const res = await fetch("/api/soe/tenant/modules", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    }
  });

  const toggleModule = useMutation({
    mutationFn: async ({ moduleKey, enabled }: { moduleKey: string; enabled: boolean }) => {
      const currentFeatures = tenantModules?.features || {};
      const updatedFeatures = { ...currentFeatures, [moduleKey]: enabled };
      const res = await fetch("/api/soe/tenant/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ features: updatedFeatures })
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-modules"] })
  });

  const moduleToFeatureKey: Record<string, string> = {
    'agent': 'manus', 'scientist': 'manus', 'knowledge': 'manus',
    'automations': 'manus', 'mcp': 'centralApis', 'a2a': 'centralApis',
    'xos-inbox': 'xosCrm', 'chat': 'comunidades', 'communities': 'comunidades',
    'xos': 'xosCrm', 'nps': 'crm',
    'crm': 'crm', 'compass': 'compass', 'production': 'production',
    'support': 'support', 'valuation': 'bi',
    'fisco': 'fisco', 'contabil': 'fisco', 'people': 'erp',
    'soe': 'erp', 'financeiro': 'erp',
    'retail': 'retail', 'plus': 'plus', 'marketplace': 'erp',
    'insights': 'bi', 'central-apis': 'centralApis',
    'ide': 'ide', 'canvas': 'ide', 'api-hub': 'centralApis',
    'api-tester': 'centralApis', 'doctype-builder': 'ide',
    'page-builder': 'ide', 'dev-center': 'ide', 'engineering': 'erp',
    'lms': 'biblioteca',
    'field-ops': 'erp', 'quality': 'erp', 'technical': 'retail',
    'suppliers': 'erp',
    'admin': 'erp', 'home': 'erp', 'migration': 'erp', 'super-admin': 'erp'
  };

  const categories: ModuleCategory[] = [
    {
      id: "intelligence",
      name: "🧠 Inteligência & IA",
      modules: [
        {
          id: "agent",
          name: "Arcádia Agent",
          description: "Assistente de IA conversacional com acesso a todas as ferramentas e conhecimento do sistema",
          icon: Bot,
          color: "from-violet-500 to-purple-600",
          path: "/agent",
          status: "active",
          features: ["Chat IA", "Ferramentas integradas", "Contexto do negócio", "Execução de tarefas"]
        },
        {
          id: "scientist",
          name: "Módulo Cientista",
          description: "Inteligência Central com auto-programação - gera código automaticamente, detecta padrões e aprende com o uso",
          icon: Brain,
          color: "from-purple-500 to-pink-500",
          path: "/scientist",
          status: "active",
          features: ["Geração de código", "Detecção de padrões", "Sugestões automáticas", "Aprendizado contínuo"]
        },
        {
          id: "knowledge",
          name: "Grafo de Conhecimento",
          description: "Todos os dados do negócio conectados em um grafo navegável com busca semântica",
          icon: Network,
          color: "from-emerald-500 to-teal-500",
          path: "/knowledge",
          status: "active",
          features: ["Nós e relações", "Busca semântica", "Visualização", "ChromaDB embeddings"]
        },
        {
          id: "automations",
          name: "Automações",
          description: "Workflows automatizados, agendamentos e execução autônoma de tarefas",
          icon: Workflow,
          color: "from-amber-500 to-orange-500",
          path: "/automations",
          status: "active",
          features: ["Workflows BPMN", "Agendamentos", "Triggers", "Aprovações"]
        },
        {
          id: "mcp",
          name: "MCP Server",
          description: "Model Context Protocol - expõe 56 ferramentas do Arcádia para agentes externos via API",
          icon: Plug,
          color: "from-cyan-500 to-blue-600",
          path: "/api-hub?module=mcp",
          status: "active",
          features: ["56 ferramentas", "JSON-RPC", "Descoberta automática", "Integração com IA"]
        },
        {
          id: "a2a",
          name: "A2A Protocol",
          description: "Agent to Agent Protocol - comunicação bidirecional entre agentes de IA com streaming",
          icon: Share2,
          color: "from-pink-500 to-violet-600",
          path: "/api-hub?module=a2a",
          status: "active",
          features: ["Agent Card", "Multi-turn", "SSE Streaming", "Artefatos"]
        }
      ]
    },
    {
      id: "communication",
      name: "💬 Comunicação",
      modules: [
        {
          id: "xos-inbox",
          name: "XOS Inbox",
          description: "Central Omnichannel de Atendimento - WhatsApp, Email e Chat Web unificados",
          icon: MessageCircle,
          color: "from-green-500 to-emerald-600",
          path: "/xos/inbox",
          status: "active",
          features: ["WhatsApp Business", "Email IMAP/SMTP", "Filas de Atendimento", "Notas Internas", "Mensagens Rápidas"]
        },
        {
          id: "chat",
          name: "Chat Interno (Equipe)",
          description: "Comunicação em tempo real entre membros da equipe interna",
          icon: MessageCircle,
          color: "from-blue-400 to-blue-600",
          path: "/chat",
          status: "active",
          features: ["Mensagens instantâneas", "Status online", "Notificações", "Histórico"]
        },
        {
          id: "communities",
          name: "Comunidades",
          description: "Servidores estilo Discord com canais temáticos, presença online e chat em tempo real para equipes",
          icon: Hash,
          color: "from-indigo-500 to-purple-600",
          path: "/communities",
          status: "active",
          features: ["Servidores", "Canais", "Presença online", "Chat em tempo real", "Permissões por cargo"]
        },
        {
          id: "xos",
          name: "XOS Central",
          description: "Experience Operating System - Central de Marketing, Vendas e Atendimento Omnichannel",
          icon: Layers,
          color: "from-blue-600 to-indigo-600",
          path: "/xos",
          status: "active",
          features: ["CRM", "Inbox", "Tickets", "Campanhas", "Automações", "Sites"]
        },
        {
          id: "nps",
          name: "Pesquisa NPS",
          description: "Net Promoter Score e pesquisas de satisfação do cliente",
          icon: ThumbsUp,
          color: "from-emerald-600 to-teal-600",
          path: "/nps",
          status: "active",
          features: ["NPS", "CSAT", "Pesquisas", "Relatórios"]
        }
      ]
    },
    {
      id: "business",
      name: "💼 Negócios & Gestão",
      modules: [
        {
          id: "crm",
          name: "Arcádia CRM",
          description: "Gestão completa de clientes, parceiros, leads e pipeline de vendas",
          icon: Handshake,
          color: "from-pink-500 to-rose-500",
          path: "/crm",
          status: "active",
          features: ["Clientes", "Parceiros", "Pipeline", "Contratos"]
        },
        {
          id: "compass",
          name: "Process Compass",
          description: "Gestão de projetos e tarefas com metodologias ágeis e Kanban",
          icon: Compass,
          color: "from-indigo-500 to-blue-600",
          path: "/compass",
          status: "active",
          features: ["Projetos", "Tarefas", "Sprints", "Kanban"]
        },
        {
          id: "production",
          name: "Produção",
          description: "Gestão de squads, sprints e entregas da equipe de desenvolvimento",
          icon: Factory,
          color: "from-slate-500 to-zinc-600",
          path: "/production",
          status: "active",
          features: ["Squads", "Sprints", "Story Points", "Burndown"]
        },
        {
          id: "support",
          name: "Suporte",
          description: "Sistema de tickets de suporte e atendimento ao cliente",
          icon: Headphones,
          color: "from-cyan-500 to-sky-500",
          path: "/support",
          status: "active",
          features: ["Tickets", "SLA", "Base de conhecimento", "Relatórios"]
        },
        {
          id: "valuation",
          name: "Valuation",
          description: "Ferramentas de avaliação financeira e análise de valor empresarial",
          icon: Calculator,
          color: "from-yellow-500 to-amber-500",
          path: "/valuation",
          status: "active",
          features: ["DCF", "Múltiplos", "Comparáveis", "Relatórios"]
        },
        {
          id: "fisco",
          name: "Arcádia Fisco",
          description: "Motor fiscal centralizado para compliance tributário brasileiro - NF-e, NFC-e, NCM, CFOP e Reforma Tributária IBS/CBS",
          icon: Receipt,
          color: "from-emerald-600 to-emerald-800",
          path: "/fisco",
          status: "active",
          features: ["NCM/CEST", "Grupos Tributários", "NF-e/NFC-e", "IBS/CBS", "Certificados A1"]
        },
        {
          id: "contabil",
          name: "Arcádia Contábil",
          description: "Motor contábil centralizado com plano de contas, lançamentos, centros de custo, DRE, Balanço e SPED ECD",
          icon: Calculator,
          color: "from-green-500 to-teal-600",
          path: "/contabil",
          status: "active",
          features: ["Plano de Contas", "Lançamentos", "DRE", "Balanço", "SPED ECD"]
        },
        {
          id: "pessoas",
          name: "Pessoas & RH",
          description: "Cadastro unificado PF/PJ com papéis (cliente, fornecedor, colaborador) e RH/DP completo",
          icon: Users,
          color: "from-blue-500 to-indigo-600",
          path: "/pessoas",
          status: "active",
          features: ["Cadastro PF/PJ", "Papéis unificados", "Folha de Pagamento", "eSocial", "FGTS"]
        },
        {
          id: "soe",
          name: "Arcádia SOE",
          description: "Sistema Operacional Empresarial - Kernel de negócios com clientes, fornecedores, produtos, pedidos",
          icon: Building2,
          color: "from-purple-500 to-violet-600",
          path: "/soe",
          status: "active",
          features: ["Clientes", "Fornecedores", "Produtos", "Vendas", "Compras"]
        },
        {
          id: "financeiro",
          name: "Arcádia Financeiro",
          description: "Gestão financeira completa: contas a pagar/receber, fluxo de caixa, controle bancário e meios de pagamento",
          icon: Wallet,
          color: "from-green-600 to-emerald-700",
          path: "/control",
          status: "active",
          features: ["Contas a Pagar", "Contas a Receber", "Fluxo de Caixa", "Bancos", "Transferências"]
        },
        {
          id: "retail",
          name: "Arcádia Retail",
          description: "PDV, vendas e gestão de lojas com frente de caixa moderna",
          icon: Store,
          color: "from-orange-500 to-red-500",
          path: "/retail",
          status: "active",
          features: ["PDV", "Vendas", "Caixa", "Estoque", "Clientes"]
        },
        {
          id: "plus",
          name: "Arcádia Plus",
          description: "ERP completo em Laravel com NF-e, NFC-e, PDV, Cardápio Digital e integrações com iFood, Mercado Livre e WooCommerce",
          icon: HardDrive,
          color: "from-violet-600 to-purple-600",
          path: "/plus",
          status: "active",
          features: ["NF-e/NFC-e", "PDV", "Cardápio Digital", "iFood", "Mercado Livre"]
        },
        {
          id: "marketplace",
          name: "Marketplace",
          description: "Loja de módulos, templates e extensões do Arcádia Suite",
          icon: ShoppingCart,
          color: "from-purple-500 to-pink-500",
          path: "/marketplace",
          status: "active",
          features: ["Módulos", "Templates", "Extensões", "Integrações"]
        }
      ]
    },
    {
      id: "analytics",
      name: "📊 Dados & Analytics",
      modules: [
        {
          id: "insights",
          name: "Arcádia Insights",
          description: "Business Intelligence com dashboards, relatórios e análise de dados",
          icon: BarChart3,
          color: "from-blue-500 to-indigo-600",
          path: "/insights",
          status: "active",
          features: ["Dashboards", "Gráficos", "SQL Editor", "Datasets"]
        },
        {
          id: "central-apis",
          name: "Central de APIs",
          description: "Catálogo de integrações com SEFAZ, bancos, marketplaces e mais",
          icon: Globe,
          color: "from-teal-500 to-cyan-600",
          path: "/central-apis",
          status: "active",
          features: ["SEFAZ NFe/NFSe", "Open Banking", "Marketplaces", "Documentação"]
        }
      ]
    },
    {
      id: "development",
      name: "🛠️ Desenvolvimento",
      modules: [
        {
          id: "ide",
          name: "IDE Integrada",
          description: "Ambiente de desenvolvimento completo com Monaco Editor, suportando 4 modos: Auto-Code, Full-Code, Low-Code e No-Code",
          icon: Code,
          color: "from-cyan-500 to-blue-500",
          path: "/ide",
          status: "active",
          features: ["Monaco Editor", "Terminal integrado", "Gerenciador de arquivos", "Execução Python/Node.js"]
        },
        {
          id: "canvas",
          name: "Canvas",
          description: "Editor visual para criação de fluxogramas, diagramas e workflows",
          icon: Palette,
          color: "from-rose-400 to-pink-500",
          path: "/canvas",
          status: "active",
          features: ["Drag & Drop", "Formas", "Conectores", "Exportação"]
        },
        {
          id: "api-hub",
          name: "API Hub",
          description: "Central de APIs com documentação, playground e testes",
          icon: Server,
          color: "from-blue-600 to-indigo-600",
          path: "/api-hub",
          status: "active",
          features: ["Documentação", "Playground", "MCP", "A2A"]
        },
        {
          id: "api-tester",
          name: "API Tester",
          description: "Testador de APIs com requisições HTTP e WebSocket",
          icon: Terminal,
          color: "from-green-600 to-emerald-600",
          path: "/api-tester",
          status: "active",
          features: ["REST", "WebSocket", "Headers", "Body"]
        },
        {
          id: "doctype-builder",
          name: "DocType Builder",
          description: "Construtor visual de tipos de documento e formulários",
          icon: Blocks,
          color: "from-orange-600 to-amber-600",
          path: "/doctype-builder",
          status: "active",
          features: ["DocTypes", "Campos", "Validações", "Layouts"]
        },
        {
          id: "page-builder",
          name: "Page Builder",
          description: "Construtor visual de páginas e interfaces",
          icon: Layout,
          color: "from-pink-600 to-rose-600",
          path: "/page-builder",
          status: "active",
          features: ["Páginas", "Componentes", "Templates", "Responsivo"]
        },
        {
          id: "dev-center",
          name: "Centro de Desenvolvimento",
          description: "Crie, teste e publique funcionalidades com agentes de IA autônomos. Inclui preview ao vivo e deploy.",
          icon: Code,
          color: "from-purple-600 to-indigo-700",
          path: "/dev-center",
          status: "active",
          features: ["Desenvolver", "Preview", "Publicar", "Analisar Repos"]
        },
        {
          id: "engineering",
          name: "Engineering Hub",
          description: "Hub de engenharia e projetos técnicos ambientais",
          icon: PenTool,
          color: "from-indigo-600 to-blue-600",
          path: "/engineering",
          status: "active",
          features: ["Projetos", "Laudos", "Amostras", "ISO 17025"]
        }
      ]
    },
    {
      id: "education",
      name: "🎓 Educação",
      modules: [
        {
          id: "lms",
          name: "Arcádia LMS",
          description: "Sistema de Gestão de Aprendizagem com cursos, trilhas e certificações",
          icon: GraduationCap,
          color: "from-indigo-500 to-purple-500",
          path: "/lms",
          status: "active",
          features: ["Cursos", "Trilhas", "Certificados", "Gamificação"]
        }
      ]
    },
    {
      id: "operations",
      name: "🔧 Operações",
      modules: [
        {
          id: "field-ops",
          name: "Operações de Campo",
          description: "Gestão de equipes em campo com formulários digitais e GPS",
          icon: MapPin,
          color: "from-lime-500 to-green-500",
          path: "/field-ops",
          status: "active",
          features: ["Formulários", "GPS", "Fotos", "Assinaturas"]
        },
        {
          id: "quality",
          name: "Qualidade ISO",
          description: "Gestão da qualidade e conformidade ISO 17025 para laboratórios",
          icon: ClipboardCheck,
          color: "from-teal-500 to-cyan-500",
          path: "/quality",
          status: "active",
          features: ["Amostras", "Laudos", "RNC", "Auditorias"]
        },
        {
          id: "technical",
          name: "Assistência Técnica",
          description: "Ordens de serviço, manutenção e gestão de técnicos",
          icon: Wrench,
          color: "from-slate-600 to-gray-600",
          path: "/technical",
          status: "active",
          features: ["Ordens de Serviço", "Técnicos", "Peças", "Garantia"]
        },
        {
          id: "suppliers",
          name: "Portal Fornecedores",
          description: "Gestão de fornecedores, homologação e pedidos de compra",
          icon: Package,
          color: "from-amber-500 to-yellow-500",
          path: "/suppliers",
          status: "active",
          features: ["Fornecedores", "Homologação", "Compras", "Cotações"]
        }
      ]
    },
    {
      id: "admin",
      name: "⚙️ Administração",
      modules: [
        {
          id: "admin",
          name: "Painel Admin",
          description: "Configurações do sistema, usuários, permissões e integrações SOE",
          icon: Settings,
          color: "from-gray-500 to-slate-600",
          path: "/admin",
          status: "active",
          features: ["Usuários", "Permissões", "Conexões SOE", "Bibliotecas"]
        },
        {
          id: "home",
          name: "Dashboard Home",
          description: "Visão geral do sistema com atalhos rápidos e atividades recentes",
          icon: Home,
          color: "from-blue-400 to-sky-500",
          path: "/",
          status: "active",
          features: ["Atalhos", "Atividades", "Notas rápidas", "Favoritos"]
        },
        {
          id: "migration",
          name: "Migração XOS",
          description: "Importação de dados de sistemas legados - MongoDB, CSV, JSON para Plus/Retail",
          icon: Database,
          color: "from-cyan-600 to-teal-600",
          path: "/migration",
          status: "active",
          features: ["Upload", "Análise", "Mapeamento", "Importação", "Multi-tenant"]
        },
        {
          id: "super-admin",
          name: "Super Admin",
          description: "Painel master com gestão de tenants, planos e configurações globais",
          icon: Shield,
          color: "from-red-600 to-rose-600",
          path: "/super-admin",
          status: "active",
          features: ["Tenants", "Planos", "Usuários", "Configurações"]
        }
      ]
    }
  ];

  const allModules = categories.flatMap(cat => cat.modules);
  const activeModules = allModules.filter(m => m.status === "active");

  const filteredCategories = categories.map(cat => ({
    ...cat,
    modules: cat.modules.filter(m => {
      const matchesSearch = !searchQuery || 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.features.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = !selectedCategory || cat.id === selectedCategory;
      return matchesSearch && matchesCategory;
    })
  })).filter(cat => cat.modules.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Módulos do Sistema</h2>
          <p className="text-muted-foreground text-sm">
            Todos os módulos do Arcádia Suite em um só lugar
          </p>
        </div>
        <Badge variant="outline" className="text-emerald-600 border-emerald-500">
          {activeModules.length} ativos
        </Badge>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Buscar módulos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-modules"
          />
        </div>
        <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}>
          <SelectTrigger className="w-full md:w-[220px]" data-testid="select-category-filter">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-8">
        {filteredCategories.map((category) => (
          <div key={category.id}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {category.name}
              <Badge variant="secondary" className="text-xs">{category.modules.length}</Badge>
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {category.modules.map((module) => {
                const IconComponent = module.icon;
                return (
                  <Card
                    key={module.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer group"
                    onClick={() => setLocation(module.path)}
                    data-testid={`module-card-${module.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${module.color}`}>
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                        {(() => {
                          const featureKey = moduleToFeatureKey[module.id];
                          const isEnabled = featureKey ? (tenantModules?.features?.[featureKey] ?? false) : true;
                          const coreModules = ['admin', 'home', 'soe'];
                          const isCore = coreModules.includes(module.id);
                          return !isCore ? (
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => {
                                if (featureKey) {
                                  toggleModule.mutate({ moduleKey: featureKey, enabled: checked });
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`switch-module-${module.id}`}
                            />
                          ) : (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-500 text-xs">Core</Badge>
                          );
                        })()}
                      </div>
                      <CardTitle className="text-base mt-3 group-hover:text-primary transition-colors">
                        {module.name}
                      </CardTitle>
                      <CardDescription className="text-xs line-clamp-2">
                        {module.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-1 mb-3">
                        {module.features.slice(0, 3).map((feature, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {feature}
                          </Badge>
                        ))}
                        {module.features.length > 3 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            +{module.features.length - 3}
                          </Badge>
                        )}
                      </div>
                      <Button 
                        className="w-full h-8 text-xs group-hover:bg-primary group-hover:text-white transition-colors"
                        variant="outline"
                        size="sm"
                        data-testid={`button-open-${module.id}`}
                      >
                        Acessar
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-12">
          <Boxes className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-700">Nenhum módulo encontrado</h3>
          <p className="text-slate-500 text-sm">Tente ajustar os filtros ou termos de busca</p>
        </div>
      )}
    </div>
  );
}

interface MHEngineStatus {
  name: string;
  displayName: string;
  type: string;
  port: number;
  category: string;
  description: string;
  status: "online" | "offline" | "error";
  responseTime?: number;
  details?: any;
  error?: string;
}

interface MHAgentStatus {
  name: string;
  running: boolean;
  processedTasks?: number;
  errorCount?: number;
}

interface MHEngineRoomData {
  engines: MHEngineStatus[];
  agents: MHAgentStatus[];
  summary: {
    total_engines: number;
    online_engines: number;
    offline_engines: number;
    health_pct: number;
    total_agents: number;
    running_agents: number;
  };
  timestamp: string;
}

const MH_ENGINE_ICONS: Record<string, ElementType> = {
  "manus-ia": Brain,
  "plus": ShoppingCart,
  "contabil": Calculator,
  "fisco": FileText,
  "bi-engine": BarChart3,
  "automation-engine": Zap,
};

const MH_CATEGORY_COLORS: Record<string, string> = {
  erp: "bg-blue-50 text-blue-600 border-blue-200",
  fiscal: "bg-amber-50 text-amber-600 border-amber-200",
  data: "bg-emerald-50 text-emerald-600 border-emerald-200",
  automation: "bg-purple-50 text-purple-600 border-purple-200",
  intelligence: "bg-cyan-50 text-cyan-600 border-cyan-200",
};

function MHEngineCard({ engine, onRefresh, onClick }: { engine: MHEngineStatus; onRefresh: () => void; onClick?: () => void }) {
  const EngineIcon = MH_ENGINE_ICONS[engine.name] || Server;
  const catColor = MH_CATEGORY_COLORS[engine.category] || "bg-gray-50 text-gray-600 border-gray-200";
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [serviceInfo, setServiceInfo] = useState<any>(null);
  const isClickable = !!onClick;

  const MANAGED_ENGINES = ["contabil", "bi-engine", "automation-engine"];
  const isManaged = MANAGED_ENGINES.includes(engine.name);

  const handleAction = async (action: "restart" | "stop" | "start") => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/engine-room/engine/${engine.name}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || `Erro ao ${action}`);
      }
      setTimeout(onRefresh, 3000);
    } catch (err) {
      alert(`Erro de conexão ao ${action}`);
    } finally {
      setTimeout(() => setActionLoading(null), 2000);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const [logsRes, infoRes] = await Promise.all([
        fetch(`/api/engine-room/engine/${engine.name}/logs?lines=80`, { credentials: "include" }),
        fetch(`/api/engine-room/engine/${engine.name}/info`, { credentials: "include" }),
      ]);
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
      if (infoRes.ok) {
        const data = await infoRes.json();
        setServiceInfo(data);
      }
    } catch {}
    setLogsLoading(false);
  };

  const toggleLogs = () => {
    if (!showLogs) fetchLogs();
    setShowLogs(!showLogs);
  };

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <Card
      data-testid={`engine-card-${engine.name}`}
      className={`hover:shadow-md transition-all ${isClickable ? "cursor-pointer hover:shadow-lg hover:border-violet-300 ring-0 hover:ring-1 hover:ring-violet-200" : ""}`}
      onClick={isClickable ? onClick : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${catColor}`}>
              <EngineIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{engine.displayName}</h3>
              <p className="text-xs text-muted-foreground">{engine.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isClickable && (
              <Badge variant="outline" className="border-violet-300 text-violet-600 bg-violet-50 text-[10px]">
                Ver estrutura
              </Badge>
            )}
            <Badge variant={engine.status === "online" ? "default" : "destructive"} className={engine.status === "online" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : engine.status === "error" ? "bg-amber-100 text-amber-700 border-amber-200" : ""}>
              <div className={`w-2 h-2 rounded-full mr-1.5 ${engine.status === "online" ? "bg-emerald-500" : engine.status === "error" ? "bg-amber-500" : "bg-red-500"}`} />
              {engine.status === "online" ? "Online" : engine.status === "error" ? "Erro" : "Offline"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center p-2 rounded bg-slate-50">
            <p className="text-[10px] text-muted-foreground uppercase">Tipo</p>
            <p className="text-xs font-medium">{engine.type.toUpperCase()}</p>
          </div>
          <div className="text-center p-2 rounded bg-slate-50">
            <p className="text-[10px] text-muted-foreground uppercase">Porta</p>
            <p className="text-xs font-medium">{engine.port}</p>
          </div>
          <div className="text-center p-2 rounded bg-slate-50">
            <p className="text-[10px] text-muted-foreground uppercase">Resposta</p>
            <p className="text-xs font-medium">
              {engine.responseTime ? `${engine.responseTime}ms` : "---"}
            </p>
          </div>
        </div>

        {engine.details && engine.status === "online" && (
          <div className="mt-3 p-2 rounded bg-slate-50 border">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Detalhes</p>
            {engine.details.version && (
              <p className="text-xs text-muted-foreground">Versão: <span className="font-medium text-foreground">{engine.details.version}</span></p>
            )}
            {engine.details.database && (
              <p className="text-xs text-muted-foreground">DB: <span className={`font-medium ${engine.details.database === "connected" ? "text-emerald-600" : "text-red-600"}`}>{engine.details.database}</span></p>
            )}
            {engine.details.cache && (
              <p className="text-xs text-muted-foreground">Cache: <span className="font-medium text-foreground">{engine.details.cache.entries} entradas, {engine.details.cache.hit_rate}% hit</span></p>
            )}
            {engine.details.scheduler && (
              <p className="text-xs text-muted-foreground">Scheduler: <span className={`font-medium ${engine.details.scheduler.is_running ? "text-emerald-600" : "text-muted-foreground"}`}>{engine.details.scheduler.is_running ? "Ativo" : "Parado"}</span> ({engine.details.scheduler.active_entries} entradas)</p>
            )}
            {engine.details.workflows && engine.details.workflows.total_workflows !== undefined && (
              <p className="text-xs text-muted-foreground">Workflows: <span className="font-medium text-foreground">{engine.details.workflows.total_workflows} registrados, {engine.details.workflows.total_executions} execuções</span></p>
            )}
          </div>
        )}

        {engine.error && (
          <div className="mt-3 p-2 rounded bg-red-50 border border-red-200">
            <p className="text-xs text-red-600">{engine.error}</p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          {isManaged && (
            <>
              {engine.status === "online" || engine.status === "error" ? (
                <>
                  <Button
                    data-testid={`button-restart-${engine.name}`}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={() => handleAction("restart")}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "restart" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                    Reiniciar
                  </Button>
                  <Button
                    data-testid={`button-stop-${engine.name}`}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => handleAction("stop")}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "stop" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Square className="w-3 h-3 mr-1" />}
                    Parar
                  </Button>
                </>
              ) : (
                <Button
                  data-testid={`button-start-${engine.name}`}
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => handleAction("start")}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "start" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                  Iniciar
                </Button>
              )}
              <Button
                data-testid={`button-logs-${engine.name}`}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={toggleLogs}
              >
                <FileText className="w-3 h-3 mr-1" />
                Logs
              </Button>
            </>
          )}
          {!isManaged && engine.name !== "plus" && (
            <span className="text-xs text-muted-foreground italic">Motor externo - sem controle direto</span>
          )}
          {!isManaged && engine.name === "plus" && (
            <Button
              data-testid="button-open-plus-panel"
              variant="outline"
              size="sm"
              className="flex-1 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => window.open('/plus', '_blank')}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Abrir Painel Plus
            </Button>
          )}
        </div>

        {showLogs && isManaged && (
          <div className="mt-3 border rounded-lg overflow-hidden">
            {serviceInfo && (
              <div className="p-2 bg-slate-100 border-b flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">Uptime: <span className="font-medium text-foreground">{formatUptime(serviceInfo.uptime || 0)}</span></span>
                <span className="text-muted-foreground">Restarts: <span className="font-medium text-foreground">{serviceInfo.restartCount || 0}</span></span>
                <span className="text-muted-foreground">Status: <span className={`font-medium ${serviceInfo.status === "running" ? "text-emerald-600" : "text-red-600"}`}>{serviceInfo.status}</span></span>
                <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={fetchLogs} disabled={logsLoading}>
                  <RefreshCw className={`w-3 h-3 mr-1 ${logsLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
            )}
            <div className="bg-gray-900 text-gray-200 p-3 max-h-48 overflow-y-auto font-mono text-[11px] leading-relaxed">
              {logsLoading ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Carregando logs...
                </div>
              ) : logs.length > 0 ? (
                logs.map((line, i) => (
                  <div key={i} className={`${line.includes("[stderr]") ? "text-red-400" : line.includes("[stdout]") ? "text-green-300" : "text-gray-300"}`}>
                    {line}
                  </div>
                ))
              ) : (
                <span className="text-gray-500">Nenhum log disponível</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── LLM Config Panel ─────────────────────────────────────────────
const PROVIDERS = [
  {
    key: 'anthropic',
    label: 'Anthropic (Claude)',
    icon: '🟣',
    placeholder: 'sk-ant-api03-...',
    hasBaseUrl: false,
    docs: 'https://console.anthropic.com/settings/keys',
  },
  {
    key: 'gemini',
    label: 'Google Gemini',
    icon: '🔵',
    placeholder: 'AIzaSy...',
    hasBaseUrl: false,
    docs: 'https://aistudio.google.com/app/apikey',
  },
  {
    key: 'ollama',
    label: 'Ollama (Local)',
    icon: '⚫',
    placeholder: '(sem chave necessária)',
    hasBaseUrl: true,
    docs: 'https://ollama.com',
  },
] as const;

type ProviderKey = 'anthropic' | 'gemini' | 'ollama';

interface ProviderFormState {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
}

function LLMConfigPanel({ llmHealth }: { llmHealth?: { providers: Record<string, boolean>; timestamp: string } }) {
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState<Record<ProviderKey, boolean>>({ anthropic: false, gemini: false, ollama: false });
  const [form, setForm] = useState<Record<ProviderKey, ProviderFormState>>({
    anthropic: { apiKey: '', baseUrl: '', enabled: true },
    gemini:    { apiKey: '', baseUrl: '', enabled: true },
    ollama:    { apiKey: '', baseUrl: '', enabled: true },
  });
  const [saving, setSaving]   = useState<ProviderKey | null>(null);
  const [testing, setTesting] = useState<ProviderKey | null>(null);
  const [testResult, setTestResult] = useState<Record<ProviderKey, { ok: boolean; error?: string } | null>>({ anthropic: null, gemini: null, ollama: null });

  const { data: llmConfig } = useQuery<{ providers: Record<string, any>; timestamp: string }>({
    queryKey: ["/api/llm/config"],
    refetchOnWindowFocus: false,
  });

  const handleSave = async (provider: ProviderKey) => {
    setSaving(provider);
    try {
      await fetch('/api/llm/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, ...form[provider] }),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/llm/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/llm/health'] });
      setForm(f => ({ ...f, [provider]: { ...f[provider], apiKey: '' } }));
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (provider: ProviderKey) => {
    setTesting(provider);
    setTestResult(r => ({ ...r, [provider]: null }));
    try {
      const res = await fetch('/api/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      setTestResult(r => ({ ...r, [provider]: { ok: json.ok, error: json.error } }));
      queryClient.invalidateQueries({ queryKey: ['/api/llm/health'] });
    } finally {
      setTesting(null);
    }
  };

  const toggleShow = (p: ProviderKey) => setShowKey(s => ({ ...s, [p]: !s[p] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Key className="w-4 h-4 text-violet-600" />
        <h3 className="text-sm font-semibold text-slate-800">Configuração de Provedores de IA</h3>
        <Badge variant="outline" className="text-xs ml-auto">
          Chaves salvas no banco de dados (criptografadas por ambiente)
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3">
        Insira suas chaves de API abaixo. Elas ficam salvas no banco de dados do sistema e têm prioridade sobre as variáveis de ambiente. Deixe em branco para usar a variável de ambiente já configurada.
      </p>

      {PROVIDERS.map(({ key, label, icon, placeholder, hasBaseUrl, docs }) => {
        const p = key as ProviderKey;
        const healthOk = llmHealth?.providers?.[p];
        const configInfo = llmConfig?.providers?.[p];
        const maskedKey = configInfo?.apiKey;
        const source: string = configInfo?.source ?? 'none';
        const testOk = testResult[p];

        return (
          <Card key={p} className={`border-2 transition-colors ${healthOk ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {source === 'database' ? 'Chave salva no banco' : source === 'environment' ? 'Usando variável de ambiente' : 'Sem chave configurada'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {testOk?.ok === true  && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">✓ Conectado</Badge>}
                  {testOk?.ok === false && <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">✗ Falhou</Badge>}
                  <div className={`w-2.5 h-2.5 rounded-full ${healthOk ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </div>
              </div>
              {/* Erro detalhado do teste */}
              {testOk?.ok === false && testOk?.error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 font-mono break-all">
                  {testOk.error}
                </div>
              )}

              {/* Chave atual (mascarada) */}
              {maskedKey && (
                <div className="text-xs text-slate-500 font-mono bg-slate-100 rounded px-2 py-1">
                  Atual: {maskedKey}
                </div>
              )}

              {/* Campo de nova chave */}
              {p !== 'ollama' && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      data-testid={`input-${p}-apikey`}
                      type={showKey[p] ? 'text' : 'password'}
                      placeholder={maskedKey ? 'Digite para substituir a chave atual' : placeholder}
                      value={form[p].apiKey}
                      onChange={e => setForm(f => ({ ...f, [p]: { ...f[p], apiKey: e.target.value } }))}
                      className="pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow(p)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showKey[p] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    data-testid={`button-save-${p}`}
                    size="sm"
                    onClick={() => handleSave(p)}
                    disabled={!form[p].apiKey || saving === p}
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {saving === p ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span className="ml-1">Salvar</span>
                  </Button>
                </div>
              )}

              {/* Base URL para Ollama */}
              {hasBaseUrl && (
                <div className="flex gap-2">
                  <Input
                    data-testid={`input-${p}-baseurl`}
                    placeholder="http://ollama:11434/v1 (padrão)"
                    value={form[p].baseUrl}
                    onChange={e => setForm(f => ({ ...f, [p]: { ...f[p], baseUrl: e.target.value } }))}
                    className="font-mono text-xs"
                  />
                  <Button
                    data-testid={`button-save-${p}`}
                    size="sm"
                    onClick={() => handleSave(p)}
                    disabled={saving === p}
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {saving === p ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span className="ml-1">Salvar</span>
                  </Button>
                </div>
              )}

              {/* Botão de teste */}
              <div className="flex items-center justify-between pt-1">
                <a href={docs} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Obter chave
                </a>
                <Button
                  data-testid={`button-test-${p}`}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTest(p)}
                  disabled={testing === p}
                  className="text-xs border-slate-300"
                >
                  {testing === p
                    ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Testando...</>
                    : <><TestTube2 className="w-3 h-3 mr-1" /> Testar Conexão</>
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Cascata ativa */}
      {llmHealth && (
        <div className="p-3 bg-slate-50 border rounded-lg">
          <p className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-500" /> Cascata LLM Ativa
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {(['anthropic', 'gemini', 'ollama'] as ProviderKey[]).map((p, i) => {
              const ok = llmHealth.providers?.[p];
              return (
                <div key={p} className="flex items-center gap-1">
                  {i > 0 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                    ok ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {p}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            O sistema tenta os provedores em ordem. Se Claude falhar, usa Gemini. Se Gemini falhar, usa Ollama.
          </p>
        </div>
      )}
    </div>
  );
}

function MachineHouseSection() {
  const queryClient = useQueryClient();
  const [mhTab, setMhTab] = useState("overview");
  const [manusOpen, setManusOpen] = useState(false);

  const { data: engineData, isLoading: engineLoading, isRefetching, isError } = useQuery<MHEngineRoomData>({
    queryKey: ["/api/engine-room/status"],
    refetchInterval: 15000,
  });

  const { data: biMetrics } = useQuery<any>({
    queryKey: ["/api/bi-engine/metrics"],
    enabled: mhTab === "bi",
    refetchInterval: 10000,
  });

  const { data: manusMetrics } = useQuery<any>({
    queryKey: ["/api/manus/health"],
    enabled: manusOpen,
    refetchInterval: 10000,
  });

  const { data: llmHealth } = useQuery<{ providers: Record<string, boolean>; timestamp: string }>({
    queryKey: ["/api/llm/health"],
    refetchInterval: 30000,
  });

  const { data: autoMetrics } = useQuery<any>({
    queryKey: ["/api/automation-engine/metrics"],
    enabled: mhTab === "automation",
    refetchInterval: 10000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/engine-room/status"] });
  };

  const handleStartAgents = async () => {
    try {
      await fetch("/api/engine-room/agents/start", { method: "POST", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/engine-room/status"] });
    } catch {}
  };

  const handleStopAgents = async () => {
    try {
      await fetch("/api/engine-room/agents/stop", { method: "POST", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/engine-room/status"] });
    } catch {}
  };

  const handleOpenPlus = (path: string = '') => {
    window.open(`/plus${path}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-orange-600" />
                Casa de Máquinas
              </CardTitle>
              <CardDescription>
                Painel de controle de todos os motores e agentes do sistema
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {engineData && (
                <span className="text-xs text-muted-foreground">
                  Atualizado: {new Date(engineData.timestamp).toLocaleTimeString("pt-BR")}
                </span>
              )}
              <Button
                data-testid="button-refresh-engines"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefetching}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isRefetching ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {engineLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : engineData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-emerald-50 border-emerald-200">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100">
                      <Server className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-emerald-700">{engineData.summary.online_engines}/{engineData.summary.total_engines}</p>
                      <p className="text-xs text-emerald-600">Motores Online</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-cyan-50 border-cyan-200">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-100">
                      <Activity className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-cyan-700">{engineData.summary.health_pct}%</p>
                      <p className="text-xs text-cyan-600">Saúde Geral</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <Bot className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-purple-700">{engineData.summary.running_agents}/{engineData.summary.total_agents}</p>
                      <p className="text-xs text-purple-600">Agentes Ativos</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className={engineData.summary.offline_engines > 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${engineData.summary.offline_engines > 0 ? "bg-red-100" : "bg-slate-100"}`}>
                      <XCircle className={`w-4 h-4 ${engineData.summary.offline_engines > 0 ? "text-red-600" : "text-slate-400"}`} />
                    </div>
                    <div>
                      <p className={`text-xl font-bold ${engineData.summary.offline_engines > 0 ? "text-red-700" : "text-slate-500"}`}>{engineData.summary.offline_engines}</p>
                      <p className={`text-xs ${engineData.summary.offline_engines > 0 ? "text-red-600" : "text-slate-400"}`}>Motores Offline</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs value={mhTab} onValueChange={setMhTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="overview" data-testid="mh-tab-overview">
                    <Server className="w-4 h-4 mr-1.5" /> Visão Geral
                  </TabsTrigger>
                  <TabsTrigger value="bi" data-testid="mh-tab-bi">
                    <BarChart3 className="w-4 h-4 mr-1.5" /> Motor BI
                  </TabsTrigger>
                  <TabsTrigger value="automation" data-testid="mh-tab-automation">
                    <Zap className="w-4 h-4 mr-1.5" /> Motor Automação
                  </TabsTrigger>
                  <TabsTrigger value="agents" data-testid="mh-tab-agents">
                    <Bot className="w-4 h-4 mr-1.5" /> Agentes XOS
                  </TabsTrigger>
                  <TabsTrigger value="plus" data-testid="mh-tab-plus">
                    <ShoppingCart className="w-4 h-4 mr-1.5" /> Arcádia Plus
                  </TabsTrigger>
                  <TabsTrigger value="llm" data-testid="mh-tab-llm">
                    <Key className="w-4 h-4 mr-1.5" /> Provedores LLM
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {engineData.engines.map((engine) => (
                      <MHEngineCard
                        key={engine.name}
                        engine={engine}
                        onRefresh={handleRefresh}
                        onClick={engine.name === "manus-ia" ? () => setManusOpen(true) : undefined}
                      />
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="bi">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {engineData.engines.filter(e => e.name === "bi-engine").map(e => (
                      <MHEngineCard key={e.name} engine={e} onRefresh={handleRefresh} />
                    ))}
                    {biMetrics && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Gauge className="w-4 h-4 text-emerald-600" /> Métricas do Motor BI
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {biMetrics.cache && (
                            <div className="p-3 rounded bg-slate-50 border">
                              <p className="text-xs text-muted-foreground uppercase mb-2">Cache</p>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="text-center">
                                  <p className="text-lg font-bold">{biMetrics.cache.entries}</p>
                                  <p className="text-[10px] text-muted-foreground">Entradas</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-emerald-600">{biMetrics.cache.hit_rate}%</p>
                                  <p className="text-[10px] text-muted-foreground">Hit Rate</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold">{biMetrics.cache.hits + biMetrics.cache.misses}</p>
                                  <p className="text-[10px] text-muted-foreground">Requisições</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {biMetrics.limits && (
                            <div className="p-3 rounded bg-slate-50 border">
                              <p className="text-xs text-muted-foreground uppercase mb-2">Limites</p>
                              <p className="text-xs text-muted-foreground">Max linhas: <span className="font-medium text-foreground">{biMetrics.limits.max_rows?.toLocaleString()}</span></p>
                              <p className="text-xs text-muted-foreground">Timeout: <span className="font-medium text-foreground">{biMetrics.limits.query_timeout_ms?.toLocaleString()}ms</span></p>
                              <p className="text-xs text-muted-foreground">Cache TTL: <span className="font-medium text-foreground">{biMetrics.limits.cache_ttl_seconds}s</span></p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  <div className="mt-4 p-4 rounded-lg bg-slate-50 border">
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Signal className="w-4 h-4 text-emerald-600" /> Capacidades do Motor BI
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {["SQL Query (read-only)", "Chart Data Generation", "Micro-BI API", "Data Analysis (Pandas)", "Aggregation Engine", "Query Cache"].map(cap => (
                        <div key={cap} className="flex items-center gap-2 p-2 rounded bg-white border">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-xs">{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="automation">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {engineData.engines.filter(e => e.name === "automation-engine").map(e => (
                      <MHEngineCard key={e.name} engine={e} onRefresh={handleRefresh} />
                    ))}
                    {autoMetrics && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Gauge className="w-4 h-4 text-purple-600" /> Métricas do Motor Automação
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {autoMetrics.scheduler && (
                            <div className="p-3 rounded bg-slate-50 border">
                              <p className="text-xs text-muted-foreground uppercase mb-2">Scheduler</p>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="text-center">
                                  <p className="text-lg font-bold">{autoMetrics.scheduler.total_entries}</p>
                                  <p className="text-[10px] text-muted-foreground">Entradas</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold">{autoMetrics.scheduler.active_entries}</p>
                                  <p className="text-[10px] text-muted-foreground">Ativas</p>
                                </div>
                                <div className="text-center">
                                  <p className={`text-lg font-bold ${autoMetrics.scheduler.is_running ? "text-emerald-600" : "text-muted-foreground"}`}>
                                    {autoMetrics.scheduler.is_running ? "ON" : "OFF"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">Status</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {autoMetrics.event_bus && (
                            <div className="p-3 rounded bg-slate-50 border">
                              <p className="text-xs text-muted-foreground uppercase mb-2">Event Bus</p>
                              <p className="text-xs text-muted-foreground">Tipos de evento: <span className="font-medium text-foreground">{autoMetrics.event_bus.total_event_types}</span></p>
                              <p className="text-xs text-muted-foreground">Subscribers: <span className="font-medium text-foreground">{autoMetrics.event_bus.total_subscribers}</span></p>
                              <p className="text-xs text-muted-foreground">Histórico: <span className="font-medium text-foreground">{autoMetrics.event_bus.history_size} eventos</span></p>
                            </div>
                          )}
                          {autoMetrics.workflows && (
                            <div className="p-3 rounded bg-slate-50 border">
                              <p className="text-xs text-muted-foreground uppercase mb-2">Workflows</p>
                              <p className="text-xs text-muted-foreground">Registrados: <span className="font-medium text-foreground">{autoMetrics.workflows.total_workflows}</span></p>
                              <p className="text-xs text-muted-foreground">Execuções: <span className="font-medium text-foreground">{autoMetrics.workflows.total_executions}</span></p>
                              <p className="text-xs text-muted-foreground">Taxa sucesso: <span className="font-medium text-emerald-600">{autoMetrics.workflows.success_rate}%</span></p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  <div className="mt-4 p-4 rounded-lg bg-slate-50 border">
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-purple-600" /> Capacidades do Motor Automação
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {["Cron Scheduler", "Event Bus", "Workflow Executor", "HTTP Actions", "SQL Queries (read-only)", "Transform & Filter"].map(cap => (
                        <div key={cap} className="flex items-center gap-2 p-2 rounded bg-white border">
                          <CheckCircle className="w-3.5 h-3.5 text-purple-500" />
                          <span className="text-xs">{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="agents">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Bot className="w-4 h-4 text-cyan-600" /> Agentes Autônomos XOS
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        data-testid="button-start-agents"
                        variant="outline"
                        size="sm"
                        onClick={handleStartAgents}
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Iniciar Todos
                      </Button>
                      <Button
                        data-testid="button-stop-agents"
                        variant="outline"
                        size="sm"
                        onClick={handleStopAgents}
                        className="border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <Square className="w-3.5 h-3.5 mr-1" /> Parar Todos
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {engineData.agents.length > 0 ? (
                      engineData.agents.map((agent) => (
                        <div key={agent.name} data-testid={`agent-card-${agent.name}`} className="flex items-center justify-between p-3 rounded-lg bg-white border hover:shadow-sm transition-all">
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg ${agent.running ? "bg-emerald-100" : "bg-slate-100"}`}>
                              <Bot className={`w-4 h-4 ${agent.running ? "text-emerald-600" : "text-slate-400"}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium capitalize">{agent.name}</p>
                              <p className="text-xs text-muted-foreground">Agente XOS</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={agent.running ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-300 text-slate-500 bg-slate-50"}>
                            {agent.running ? "Ativo" : "Parado"}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-8 text-muted-foreground">
                        <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum agente registrado</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="plus">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          engineData.engines.find(e => e.name === "plus")?.status === "online" ? "bg-emerald-500" : "bg-red-500"
                        }`} />
                        <div>
                          <h4 className="font-medium">Status do Engine Plus</h4>
                          <p className="text-sm text-muted-foreground">
                            {engineData.engines.find(e => e.name === "plus")?.status === "online" ? "Plus está rodando na porta 8080" : "Plus offline"}
                          </p>
                        </div>
                      </div>
                      <Button onClick={() => handleOpenPlus()} variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Abrir Painel Plus
                      </Button>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Módulos do Engine</h4>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <div data-testid="link-plus-nfe" onClick={() => handleOpenPlus('/nfe')} className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-red-300 hover:bg-red-50 transition-colors cursor-pointer">
                          <div className="p-2 bg-red-100 rounded">
                            <Receipt className="w-5 h-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Motor Fiscal</p>
                            <p className="text-xs text-muted-foreground">NF-e, NFC-e, CT-e, MDF-e</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-400 ml-auto" />
                        </div>
                        <div data-testid="link-plus-caixa" onClick={() => handleOpenPlus('/caixa')} className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer">
                          <div className="p-2 bg-blue-100 rounded">
                            <ShoppingCart className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">PDV / Caixa</p>
                            <p className="text-xs text-muted-foreground">Ponto de venda</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-400 ml-auto" />
                        </div>
                        <div data-testid="link-plus-vendas" onClick={() => handleOpenPlus('/vendas')} className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-emerald-300 hover:bg-emerald-50 transition-colors cursor-pointer">
                          <div className="p-2 bg-emerald-100 rounded">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Vendas</p>
                            <p className="text-xs text-muted-foreground">Pedidos e orçamentos</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-400 ml-auto" />
                        </div>
                        <div data-testid="link-plus-produtos" onClick={() => handleOpenPlus('/produtos')} className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors cursor-pointer">
                          <div className="p-2 bg-orange-100 rounded">
                            <Package className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Produtos</p>
                            <p className="text-xs text-muted-foreground">Estoque, lotes, IMEI</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-400 ml-auto" />
                        </div>
                        <div data-testid="link-plus-clientes" onClick={() => handleOpenPlus('/clientes')} className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-pointer">
                          <div className="p-2 bg-purple-100 rounded">
                            <Users className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Clientes</p>
                            <p className="text-xs text-muted-foreground">Cadastro de clientes</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-400 ml-auto" />
                        </div>
                        <div data-testid="link-plus-fornecedores" onClick={() => handleOpenPlus('/fornecedores')} className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-colors cursor-pointer">
                          <div className="p-2 bg-teal-100 rounded">
                            <Building2 className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Fornecedores</p>
                            <p className="text-xs text-muted-foreground">Cadastro de fornecedores</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-400 ml-auto" />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="llm">
                  <LLMConfigPanel llmHealth={llmHealth} />
                </TabsContent>
              </Tabs>

              <div className="p-4 rounded-lg bg-slate-50 border">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-orange-600" /> Arquitetura dos Motores
                </h3>
                <div className="font-mono text-xs text-muted-foreground space-y-1 bg-white p-4 rounded-lg border">
                  <p>Express (5000) &lt;--proxy--&gt; Plus/Laravel (8080)</p>
                  <p>Express (5000) &lt;--proxy--&gt; Contábil/FastAPI (8003)</p>
                  <p>Express (5000) &lt;--proxy--&gt; Fisco/FastAPI (8002)</p>
                  <p>Express (5000) &lt;--proxy--&gt; BI Engine/FastAPI (8004)</p>
                  <p>Express (5000) &lt;--proxy--&gt; Automation/FastAPI (8005)</p>
                  <p className="text-orange-600 mt-2">Casa de Máquinas: /api/engine-room/*</p>
                </div>
              </div>
            </>
          ) : isError ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-engine-error">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
              <p className="text-sm font-medium text-red-600">Erro ao carregar status dos motores</p>
              <p className="text-xs mt-1">Verifique se a API /api/engine-room/status está acessível</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-1" /> Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Não foi possível carregar o status dos motores</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={manusOpen} onOpenChange={setManusOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 border border-violet-200">
                <Brain className="w-7 h-7 text-violet-600" />
              </div>
              <div>
                <DialogTitle className="text-xl">Manus IA - Cérebro Central</DialogTitle>
                <DialogDescription>
                  Arquitetura do motor de inteligência que alimenta todos os agentes
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-3 mt-2">
            <div className="text-center p-3 rounded-lg bg-violet-50 border border-violet-200">
              <p className="text-xl font-bold text-violet-600">{manusMetrics?.model || "GPT-4o"}</p>
              <p className="text-[10px] text-muted-foreground uppercase mt-1">Modelo</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-slate-50 border">
              <p className="text-xl font-bold">{manusMetrics?.metrics?.totalCalls || 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase mt-1">Chamadas IA</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-xl font-bold text-emerald-600">{((manusMetrics?.metrics?.totalTokens || 0) / 1000).toFixed(1)}k</p>
              <p className="text-[10px] text-muted-foreground uppercase mt-1">Tokens</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-cyan-50 border border-cyan-200">
              <p className="text-xl font-bold text-cyan-600">
                {manusMetrics?.metrics?.uptime
                  ? `${Math.floor(manusMetrics.metrics.uptime / 3600)}h ${Math.floor((manusMetrics.metrics.uptime % 3600) / 60)}m`
                  : "---"}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase mt-1">Uptime</p>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-600" />
              Arquitetura: Fluxo de Inteligência
            </h3>
            <div className="relative p-4 rounded-xl bg-slate-50 border">
              <div className="flex flex-col items-center gap-2">
                <div className="w-full p-3 rounded-lg bg-gradient-to-r from-violet-100 to-purple-100 border border-violet-200 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Brain className="w-5 h-5 text-violet-600" />
                    <span className="text-sm font-bold text-violet-700">ManusIntelligence (Singleton)</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">GPT-4o + ToolManager + Context Enrichment</p>
                </div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <ArrowDown className="w-4 h-4" />
                  <span className="text-[10px]">generate() / think()</span>
                  <ArrowDown className="w-4 h-4" />
                </div>

                <div className="w-full p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                  <span className="text-xs font-medium text-amber-700">enrichWithContext()</span>
                  <p className="text-[10px] text-muted-foreground mt-1">ToolManager.search_code → Contexto Semântico Automático</p>
                </div>

                <ArrowDown className="w-4 h-4 text-muted-foreground" />

                <div className="grid grid-cols-3 gap-2 w-full">
                  {[
                    { name: "Architect", role: "Design & Arquitetura", icon: Layers, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
                    { name: "Generator", role: "Geração de Código", icon: Code, color: "text-green-600", bg: "bg-green-50 border-green-200" },
                    { name: "Validator", role: "Validação TypeScript", icon: Shield, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                    { name: "Executor", role: "Execução & Staging", icon: Terminal, color: "text-red-600", bg: "bg-red-50 border-red-200" },
                    { name: "Researcher", role: "Pesquisa & Contexto", icon: Search, color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-200" },
                    { name: "Evolution", role: "Aprendizado Evolutivo", icon: Sparkles, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
                  ].map((agent) => (
                    <div key={agent.name} className={`p-2.5 rounded-lg border ${agent.bg} text-center`}>
                      <agent.icon className={`w-4 h-4 ${agent.color} mx-auto mb-1`} />
                      <p className={`text-xs font-semibold ${agent.color}`}>{agent.name}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{agent.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              Ferramentas Disponíveis ({manusMetrics?.capabilities?.tools || 56})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { name: "Busca Semântica", count: 8, icon: Search, color: "text-violet-600" },
                { name: "Arquivos", count: 12, icon: FileText, color: "text-blue-600" },
                { name: "Comandos Shell", count: 6, icon: Terminal, color: "text-green-600" },
                { name: "Web Research", count: 5, icon: Globe, color: "text-cyan-600" },
                { name: "Knowledge Graph", count: 8, icon: Network, color: "text-amber-600" },
                { name: "ERP & Database", count: 10, icon: Database, color: "text-emerald-600" },
                { name: "Análise de Código", count: 7, icon: Code, color: "text-pink-600" },
              ].map((cat) => (
                <div key={cat.name} className="p-3 rounded-lg bg-slate-50 border hover:border-slate-300 transition-all">
                  <div className="flex items-center gap-2 mb-1.5">
                    <cat.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                    <span className={`text-xs font-medium ${cat.color}`}>{cat.count}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{cat.name}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Capacidades Ativas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                "Cérebro Central (GPT-4o)",
                "Enriquecimento de Contexto",
                "Busca Semântica de Código",
                "Knowledge Graph",
                "Pipeline Autônomo de Dev",
                "Orquestração de 6 Agentes",
                "Leitura/Escrita de Arquivos",
                "Execução de Comandos Shell",
                "Web Research",
                "Análise de Código",
                "Validação TypeScript",
                "Memória Evolutiva",
              ].map((cap) => (
                <div key={cap} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-xs">{cap}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-slate-50 border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Network className="w-4 h-4 text-violet-600" />
              Diagrama de Fluxo
            </h3>
            <div className="font-mono text-[11px] text-slate-600 space-y-0.5 bg-white p-4 rounded-lg border">
              <p className="text-violet-600">{"┌──────────────────────────────────────────────────────────┐"}</p>
              <p className="text-violet-600">{"│         MANUS INTELLIGENCE  (Singleton GPT-4o)           │"}</p>
              <p className="text-violet-600">{"├──────────────────────────────────────────────────────────┤"}</p>
              <p>{"│  .generate(prompt)  →  enrichWithContext()  →  OpenAI   │"}</p>
              <p>{"│  .think(prompt)     →  enrichWithContext()  →  OpenAI   │"}</p>
              <p>{"│  .getMetrics()      →  calls, tokens, errors, uptime   │"}</p>
              <p className="text-violet-600">{"├──────────────────────────────────────────────────────────┤"}</p>
              <p className="text-amber-600">{"│  ToolManager.executeTool('search_code', query)          │"}</p>
              <p className="text-amber-600">{"│  → Contexto semântico injetado automaticamente          │"}</p>
              <p className="text-violet-600">{"├──────────────────────────────────────────────────────────┤"}</p>
              <p className="text-blue-600">{"│  Architect  ──────┐                                     │"}</p>
              <p className="text-green-600">{"│  Generator  ──────┤                                     │"}</p>
              <p className="text-amber-600">{"│  Validator  ──────┤── Todos via manusIntelligence ──►   │"}</p>
              <p className="text-red-600">{"│  Executor   ──────┤                                     │"}</p>
              <p className="text-cyan-600">{"│  Researcher ──────┤                                     │"}</p>
              <p className="text-purple-600">{"│  Evolution  ──────┘                                     │"}</p>
              <p className="text-violet-600">{"├──────────────────────────────────────────────────────────┤"}</p>
              <p className="text-emerald-600">{"│  /api/manus/health  →  Status, métricas, capacidades   │"}</p>
              <p className="text-violet-600">{"└──────────────────────────────────────────────────────────┘"}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
