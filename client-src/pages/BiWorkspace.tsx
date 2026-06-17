import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Database,
  BarChart3,
  FileText,
  Plus,
  Play,
  Trash2,
  Settings,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  HardDrive,
  Table,
  PieChart,
  LineChart,
  TrendingUp,
  Activity,
  Archive,
  Download,
  RefreshCw,
  Search,
  Filter,
  Upload,
  FileSpreadsheet,
  GripVertical,
  ArrowRight,
  Columns,
  Layers,
  FileArchive,
  MapPin,
  Send,
  Eye,
  Save,
  Bot,
  X,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BiStats {
  dataSources: number;
  datasets: number;
  charts: number;
  dashboards: number;
  backupJobs: number;
}

interface DataSource {
  id: number;
  name: string;
  type: string;
  host: string;
  database: string;
  isActive: string;
  lastTestedAt: string | null;
  createdAt: string;
}

interface Dataset {
  id: number;
  name: string;
  description: string | null;
  queryType: string;
  tableName: string | null;
  sqlQuery: string | null;
  createdAt: string;
}

interface BiChart {
  id: number;
  name: string;
  chartType: string;
  datasetId: number;
  createdAt: string;
}

interface BiDashboard {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

interface BackupJob {
  id: number;
  name: string;
  backupType: string;
  dataSource: { name: string; type: string } | null;
  isActive: string;
  createdAt: string;
}

interface BackupArtifact {
  id: number;
  filename: string;
  fileSize: number | null;
  status: string;
  jobName: string;
  startedAt: string;
  completedAt: string | null;
}

interface StagedTable {
  id: number;
  name: string;
  sourceType: string;
  sourceFile: string | null;
  tableName: string;
  columns: string | null;
  rowCount: number;
  status: string;
  targetErp: string | null;
  description: string | null;
  createdAt: string;
}

interface StagingStats {
  totalTables: number;
  totalRecords: number;
  mappedTables: number;
  pendingMigrations: number;
  completedMigrations: number;
  bySourceType: Record<string, number>;
  byTargetErp: Record<string, number>;
}

interface ErpTarget {
  id: string;
  name: string;
  entities: string[];
}

async function fetchStats(): Promise<BiStats> {
  const res = await fetch("/api/bi/stats", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

async function fetchDataSources(): Promise<DataSource[]> {
  const res = await fetch("/api/bi/data-sources", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchDatasets(): Promise<Dataset[]> {
  const res = await fetch("/api/bi/datasets", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchCharts(): Promise<BiChart[]> {
  const res = await fetch("/api/bi/charts", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchDashboards(): Promise<BiDashboard[]> {
  const res = await fetch("/api/bi/dashboards", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchBackupJobs(): Promise<BackupJob[]> {
  const res = await fetch("/api/bi/backup-jobs", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchBackupArtifacts(): Promise<BackupArtifact[]> {
  const res = await fetch("/api/bi/backup-artifacts", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchTables(): Promise<string[]> {
  const res = await fetch("/api/bi/tables", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchStagedTables(): Promise<StagedTable[]> {
  const res = await fetch("/api/staging/tables", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchStagingStats(): Promise<StagingStats> {
  const res = await fetch("/api/staging/stats", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchErpTargets(): Promise<ErpTarget[]> {
  const res = await fetch("/api/staging/erp-targets", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function OverviewTab() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["bi-stats"], queryFn: fetchStats });
  const { data: artifacts = [] } = useQuery({ queryKey: ["backup-artifacts"], queryFn: fetchBackupArtifacts });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#c89b3c]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-[#1f334d] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-500/20">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.dataSources || 0}</p>
              <p className="text-xs text-white/50">Fontes de Dados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1f334d] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-full bg-purple-500/20">
              <Table className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.datasets || 0}</p>
              <p className="text-xs text-white/50">Datasets</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1f334d] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-500/20">
              <BarChart3 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.charts || 0}</p>
              <p className="text-xs text-white/50">Gráficos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1f334d] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-full bg-[#c89b3c]/20">
              <LayoutDashboard className="w-5 h-5 text-[#c89b3c]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.dashboards || 0}</p>
              <p className="text-xs text-white/50">Dashboards</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1f334d] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-full bg-orange-500/20">
              <Archive className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.backupJobs || 0}</p>
              <p className="text-xs text-white/50">Backups</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="bg-[#1f334d] border-[#c89b3c]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#c89b3c]" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {artifacts.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {a.status === "completed" ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : a.status === "running" ? (
                      <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-white/70">{a.jobName}</span>
                  </div>
                  <span className="text-white/40">{formatBytes(a.fileSize)}</span>
                </div>
              ))}
              {artifacts.length === 0 && (
                <p className="text-white/40 text-center py-4">Nenhuma atividade recente</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f334d] border-[#c89b3c]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#c89b3c]" />
              Início Rápido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-white/70 border-white/10 hover:bg-white/5">
                <Database className="w-4 h-4 mr-2" /> Conectar Fonte de Dados
              </Button>
              <Button variant="outline" className="w-full justify-start text-white/70 border-white/10 hover:bg-white/5">
                <FileText className="w-4 h-4 mr-2" /> Criar Nova Consulta
              </Button>
              <Button variant="outline" className="w-full justify-start text-white/70 border-white/10 hover:bg-white/5">
                <BarChart3 className="w-4 h-4 mr-2" /> Criar Gráfico
              </Button>
              <Button variant="outline" className="w-full justify-start text-white/70 border-white/10 hover:bg-white/5">
                <Archive className="w-4 h-4 mr-2" /> Configurar Backup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface InternalTable {
  name: string;
  columnCount: number;
  sizeBytes: number;
  category: string;
  description: string;
}

function DataSourcesTab() {
  const queryClient = useQueryClient();
  const { data: sources = [], isLoading } = useQuery({ queryKey: ["data-sources"], queryFn: fetchDataSources });
  const { data: internalTables = [] } = useQuery<InternalTable[]>({
    queryKey: ["internal-tables"],
    queryFn: async () => {
      const res = await fetch("/api/bi/internal-tables", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("postgresql");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [database, setDatabase] = useState("");
  const [activeSourceType, setActiveSourceType] = useState<"external" | "internal">("internal");
  const [searchInternal, setSearchInternal] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/bi/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-sources"] });
      queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
      setShowAdd(false);
      setName("");
      setHost("");
      setPort("");
      setDatabase("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/bi/data-sources/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-sources"] });
      queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/bi/data-sources/${id}/test`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-sources"] });
    },
  });

  const createDatasetFromTable = useMutation({
    mutationFn: async (tableName: string) => {
      const res = await fetch(`/api/bi/internal-tables/${tableName}/create-dataset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tableName }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
    },
  });

  const categories = ["all", ...Array.from(new Set(internalTables.map(t => t.category)))];
  const filteredTables = internalTables.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchInternal.toLowerCase()) || 
                          t.description.toLowerCase().includes(searchInternal.toLowerCase());
    const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#c89b3c]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium text-white">Fontes de Dados</h2>
          <div className="flex bg-[#162638] rounded-lg p-1">
            <button
              onClick={() => setActiveSourceType("internal")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeSourceType === "internal" ? "bg-[#c89b3c] text-[#1f334d]" : "text-white/70 hover:text-white"}`}
            >
              <Table className="w-4 h-4 inline mr-1" /> Tabelas Internas
            </button>
            <button
              onClick={() => setActiveSourceType("external")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeSourceType === "external" ? "bg-[#c89b3c] text-[#1f334d]" : "text-white/70 hover:text-white"}`}
            >
              <Database className="w-4 h-4 inline mr-1" /> Conexões Externas
            </button>
          </div>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d]" data-testid="add-datasource">
              <Plus className="w-4 h-4 mr-2" /> Nova Fonte
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1f334d] border-[#c89b3c]/30 text-white">
            <DialogHeader>
              <DialogTitle className="text-[#c89b3c]">Nova Fonte de Dados</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-white/70 mb-1 block">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#162638] border-white/20 text-white" />
              </div>
              <div>
                <label className="text-sm text-white/70 mb-1 block">Tipo</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="bg-[#162638] border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#162638] border-white/20">
                    <SelectItem value="postgresql" className="text-white">PostgreSQL</SelectItem>
                    <SelectItem value="mysql" className="text-white">MySQL</SelectItem>
                    <SelectItem value="mongodb" className="text-white">MongoDB</SelectItem>
                    <SelectItem value="internal" className="text-white">Banco Interno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-white/70 mb-1 block">Host</label>
                  <Input value={host} onChange={(e) => setHost(e.target.value)} className="bg-[#162638] border-white/20 text-white" />
                </div>
                <div>
                  <label className="text-sm text-white/70 mb-1 block">Porta</label>
                  <Input value={port} onChange={(e) => setPort(e.target.value)} type="number" className="bg-[#162638] border-white/20 text-white" />
                </div>
              </div>
              <div>
                <label className="text-sm text-white/70 mb-1 block">Banco de Dados</label>
                <Input value={database} onChange={(e) => setDatabase(e.target.value)} className="bg-[#162638] border-white/20 text-white" />
              </div>
              <Button
                onClick={() => createMutation.mutate({ name, type, host, port: port ? parseInt(port) : undefined, database })}
                disabled={!name || createMutation.isPending}
                className="w-full bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d]"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {activeSourceType === "internal" ? (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Buscar tabelas..."
                value={searchInternal}
                onChange={(e) => setSearchInternal(e.target.value)}
                className="pl-10 bg-[#162638] border-white/20 text-white"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48 bg-[#162638] border-white/20 text-white">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent className="bg-[#162638] border-white/20">
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat} className="text-white">
                    {cat === "all" ? "Todas as categorias" : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Card className="bg-[#162638] border-[#c89b3c]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[#c89b3c] flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                Repositório de Dados do Sistema ({filteredTables.length} tabelas)
              </CardTitle>
              <p className="text-xs text-white/50">
                Todos os dados do sistema disponíveis para análise pelo Cientista e Agente Manus
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-1">
                  {filteredTables.map((table, idx) => (
                    <div
                      key={`${table.name}-${idx}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-[#c89b3c]/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#c89b3c]/10">
                          <Table className="w-4 h-4 text-[#c89b3c]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{table.name}</p>
                          <p className="text-xs text-white/50">{table.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-white/60 border-white/20 text-xs">
                          {table.category}
                        </Badge>
                        <span className="text-xs text-white/40">{table.columnCount} cols</span>
                        <Button
                          size="sm"
                          onClick={() => createDatasetFromTable.mutate(table.name)}
                          disabled={createDatasetFromTable.isPending}
                          className="bg-[#c89b3c]/20 hover:bg-[#c89b3c]/30 text-[#c89b3c] text-xs"
                        >
                          {createDatasetFromTable.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-3 h-3 mr-1" /> Criar Dataset
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {sources.length === 0 ? (
            <Card className="bg-[#1f334d] border-[#c89b3c]/20">
              <CardContent className="p-8 text-center">
                <Database className="w-12 h-12 text-[#c89b3c]/50 mx-auto mb-4" />
                <p className="text-white/50">Nenhuma fonte de dados externa configurada</p>
                <p className="text-xs text-white/30 mt-2">Clique em "Nova Fonte" para conectar um banco externo</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {sources.map((source) => (
                <Card key={source.id} className="bg-[#1f334d] border-[#c89b3c]/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${source.type === "mongodb" ? "bg-green-500/20" : source.type === "mysql" ? "bg-blue-500/20" : "bg-purple-500/20"}`}>
                          <Database className={`w-5 h-5 ${source.type === "mongodb" ? "text-green-400" : source.type === "mysql" ? "text-blue-400" : "text-purple-400"}`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{source.name}</h3>
                          <p className="text-sm text-white/50">{source.type.toUpperCase()} - {source.host || "localhost"}</p>
                        </div>
                      </div>
                      <Badge variant={source.isActive === "true" ? "default" : "secondary"} className={source.isActive === "true" ? "bg-green-500/20 text-green-400" : ""}>
                        {source.isActive === "true" ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testMutation.mutate(source.id)}
                        disabled={testMutation.isPending}
                        className="text-white/70 border-white/10"
                      >
                        {testMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        <span className="ml-1">Testar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(source.id)}
                        className="text-red-400 border-red-400/20 hover:bg-red-400/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DatasetCard({ dataset, onDelete }: { dataset: Dataset; onDelete: () => void }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const runAIAction = async (action: string) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    const prompts: Record<string, string> = {
      analyze: `[ANÁLISE BI] Dataset: "${dataset.name}" (ID: ${dataset.id}), Tabela: ${dataset.tableName || 'N/A'}
INSTRUÇÕES: Use bi_execute_query com datasetId ${dataset.id} para obter os dados. Analise estatísticas descritivas, identifique padrões e gere um resumo executivo com insights.`,
      chart: `[GRÁFICO BI] Dataset: "${dataset.name}" (ID: ${dataset.id}), Tabela: ${dataset.tableName || 'N/A'}
INSTRUÇÕES: Primeiro use bi_execute_query com datasetId ${dataset.id} para obter os dados. Depois use bi_create_chart para criar um gráfico apropriado.`,
      patterns: `[PADRÕES BI] Dataset: "${dataset.name}" (ID: ${dataset.id}), Tabela: ${dataset.tableName || 'N/A'}
INSTRUÇÕES: Use bi_execute_query com datasetId ${dataset.id} para obter os dados. Identifique correlações, tendências e anomalias.`,
    };

    try {
      const res = await fetch("/api/manus/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompts[action] }),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Falha");
      const { runId } = await res.json();

      let attempts = 0;
      while (attempts < 60) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`/api/manus/runs/${runId}`, { credentials: "include" });
        const run = await statusRes.json();
        
        if (run.status === 'completed' || run.status === 'stopped') {
          const lastStep = run.steps?.[run.steps.length - 1];
          setAnalysisResult(lastStep?.toolOutput || run.result || "Análise concluída.");
          queryClient.invalidateQueries({ queryKey: ["bi-charts"] });
          queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
          break;
        }
        attempts++;
      }
    } catch (error) {
      setAnalysisResult("Erro ao processar. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="bg-[#1f334d] border-[#c89b3c]/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              {dataset.queryType === "sql" ? <FileText className="w-5 h-5 text-purple-400" /> : <Table className="w-5 h-5 text-purple-400" />}
            </div>
            <div>
              <h3 className="font-medium text-white">{dataset.name}</h3>
              <p className="text-sm text-white/50">{dataset.queryType === "sql" ? "SQL Query" : dataset.tableName}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-red-400 border-red-400/20 hover:bg-red-400/10">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => runAIAction('analyze')}
            disabled={isAnalyzing}
            className="text-[#c89b3c] border-[#c89b3c]/30 hover:bg-[#c89b3c]/10"
          >
            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
            Analisar com IA
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => runAIAction('chart')}
            disabled={isAnalyzing}
            className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
          >
            <BarChart3 className="w-3 h-3 mr-1" /> Criar Gráfico
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => runAIAction('patterns')}
            disabled={isAnalyzing}
            className="text-green-400 border-green-400/30 hover:bg-green-400/10"
          >
            <Search className="w-3 h-3 mr-1" /> Detectar Padrões
          </Button>
        </div>

        {isAnalyzing && (
          <div className="mt-3 p-3 bg-white/5 rounded-lg flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-[#c89b3c] animate-spin" />
            <span className="text-white/70 text-sm">Analisando dados...</span>
          </div>
        )}

        {analysisResult && !isAnalyzing && (
          <div className="mt-3 p-3 bg-white/5 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#c89b3c] text-xs font-medium">Resultado da Análise</span>
              <button onClick={() => setAnalysisResult(null)} className="text-white/50 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
            <pre className="text-white/80 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">{analysisResult}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DataAssistant({ datasets }: { datasets: Dataset[] }) {
  const [question, setQuestion] = useState("");
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Array<{
    type: 'user' | 'assistant';
    content: string;
    insights?: string[];
    suggestedChart?: any;
    datasetName?: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const askQuestion = async () => {
    if (!question.trim() || !selectedDatasetId) return;

    const selectedDataset = datasets.find(d => d.id === selectedDatasetId);
    const userMessage = { type: 'user' as const, content: question };
    setMessages(prev => [...prev, userMessage]);
    setQuestion("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/bi/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, datasetId: selectedDatasetId }),
        credentials: "include",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errData.error || "Falha na análise");
      }
      
      const data = await res.json();

      setMessages(prev => [...prev, {
        type: 'assistant',
        content: data.answer || "Análise concluída.",
        insights: data.insights,
        suggestedChart: data.suggestedChart,
        datasetName: data.datasetName,
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: `Desculpe, ocorreu um erro: ${error.message || "Tente novamente."}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const createChart = async (suggestedChart: any) => {
    if (!selectedDatasetId || !suggestedChart) return;

    try {
      const res = await fetch("/api/bi/ai-create-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDatasetId, chartConfig: suggestedChart }),
        credentials: "include",
      });

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["bi-charts"] });
        queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
      }
    } catch (error) {
      console.error("Error creating chart:", error);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-[#1f334d] to-[#0f1a2a] border-[#c89b3c]/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#c89b3c]" />
          Assistente de Dados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select 
            value={selectedDatasetId?.toString() || ""} 
            onValueChange={(v) => setSelectedDatasetId(parseInt(v))}
          >
            <SelectTrigger className="bg-white/10 border-white/20 text-white flex-1">
              <SelectValue placeholder="Selecione um dataset" />
            </SelectTrigger>
            <SelectContent className="z-[9999] bg-[#1f334d] border-[#c89b3c]/30">
              {datasets.length === 0 ? (
                <div className="p-2 text-white/50 text-sm">Nenhum dataset disponível</div>
              ) : (
                datasets.map((d) => (
                  <SelectItem 
                    key={d.id} 
                    value={d.id.toString()}
                    className="text-white hover:bg-[#c89b3c]/20 focus:bg-[#c89b3c]/20"
                  >
                    {d.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-64 bg-black/20 rounded-lg p-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/40 text-sm">
              <MessageSquare className="w-8 h-8 mb-2" />
              <p>Faça uma pergunta sobre seus dados</p>
              <p className="text-xs mt-1">Ex: "Qual é o total de vendas por cidade?"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 ${
                    msg.type === 'user' 
                      ? 'bg-[#c89b3c] text-black' 
                      : 'bg-white/10 text-white'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    
                    {msg.insights && msg.insights.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <p className="text-xs font-medium mb-1 text-[#c89b3c]">Insights:</p>
                        <ul className="text-xs space-y-1">
                          {msg.insights.map((insight, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-[#c89b3c]">•</span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {msg.suggestedChart && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <Button 
                          size="sm" 
                          onClick={() => createChart(msg.suggestedChart)}
                          className="bg-[#c89b3c] hover:bg-[#d4a94a] text-black text-xs"
                        >
                          <BarChart3 className="w-3 h-3 mr-1" />
                          Criar Gráfico: {msg.suggestedChart.title || msg.suggestedChart.type}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 rounded-lg p-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#c89b3c]" />
                    <span className="text-white/70 text-sm">Analisando...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            placeholder="Faça uma pergunta sobre os dados..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && askQuestion()}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            disabled={!selectedDatasetId || isLoading}
          />
          <Button 
            onClick={askQuestion}
            disabled={!question.trim() || !selectedDatasetId || isLoading}
            className="bg-[#c89b3c] hover:bg-[#d4a94a] text-black"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const CHART_COLORS = ['#c89b3c', '#1f334d', '#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4'];

function ChartViewer({ chart, datasets }: { chart: BiChart; datasets: Dataset[] }) {
  const dataset = datasets.find((d: Dataset) => d.id === chart.datasetId);
  const tableName = dataset?.tableName;
  
  const { data: chartData = [], isLoading } = useQuery({
    queryKey: ["chart-data", chart.id, tableName],
    queryFn: async () => {
      if (!tableName) return [];
      const res = await fetch(`/api/bi/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName, limit: 50 }),
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tableName,
  });

  const config = chart.config ? JSON.parse(chart.config) : {};
  const xAxis = config.xAxis || chart.xAxis || Object.keys(chartData[0] || {})[0];
  const yAxis = config.yAxis || chart.yAxis || Object.keys(chartData[0] || {})[1];

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#c89b3c]" />
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="h-48 flex items-center justify-center bg-[#1f334d]/5 rounded-lg">
        <p className="text-[#1f334d]/40 text-sm">Sem dados disponíveis</p>
      </div>
    );
  }

  const processedData = chartData.map((row: Record<string, unknown>) => {
    const numValue = typeof row[yAxis] === 'string' 
      ? parseFloat(String(row[yAxis]).replace(/[^\d.-]/g, '')) || 0
      : Number(row[yAxis]) || 0;
    return { ...row, [yAxis]: numValue };
  });

  const renderChart = () => {
    switch (chart.chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey={xAxis} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey={yAxis} fill="#c89b3c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <RechartsLineChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey={xAxis} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey={yAxis} stroke="#c89b3c" strokeWidth={2} dot={{ fill: '#c89b3c' }} />
            </RechartsLineChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <RechartsPieChart>
              <Pie
                data={processedData}
                dataKey={yAxis}
                nameKey={xAxis}
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ name }) => name}
              >
                {processedData.map((_: unknown, index: number) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey={xAxis} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey={yAxis} stroke="#c89b3c" fill="#c89b3c" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey={xAxis} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey={yAxis} fill="#c89b3c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return <div className="mt-2">{renderChart()}</div>;
}

function ChartsTab() {
  const queryClient = useQueryClient();
  const { data: charts = [], isLoading } = useQuery({ queryKey: ["bi-charts"], queryFn: fetchCharts });
  const { data: datasets = [] } = useQuery({ queryKey: ["datasets"], queryFn: fetchDatasets });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/bi/charts/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bi-charts"] });
      queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
    },
  });

  const getDatasetName = (datasetId: number | null) => {
    if (!datasetId) return "N/A";
    const dataset = datasets.find((d: Dataset) => d.id === datasetId);
    return dataset?.name || `Dataset #${datasetId}`;
  };

  const getChartIcon = (type: string) => {
    switch (type) {
      case "bar": return <BarChart3 className="w-5 h-5" />;
      case "line": return <LineChart className="w-5 h-5" />;
      case "pie": return <PieChart className="w-5 h-5" />;
      case "area": return <TrendingUp className="w-5 h-5" />;
      default: return <BarChart3 className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#c89b3c]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-[#1f334d]">Gráficos Criados</h2>
        <Badge variant="outline" className="bg-[#1f334d]/10">{charts.length} gráficos</Badge>
      </div>

      {charts.length === 0 ? (
        <Card className="border-dashed border-2 border-[#1f334d]/20">
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-[#1f334d]/30 mb-4" />
            <p className="text-[#1f334d]/60">Nenhum gráfico criado ainda.</p>
            <p className="text-sm text-[#1f334d]/40 mt-2">
              Use o assistente de IA para criar gráficos automaticamente a partir dos seus dados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {charts.map((chart: BiChart) => (
            <Card key={chart.id} className="bg-white border border-[#1f334d]/10 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#1f334d] rounded-lg text-[#c89b3c]">
                      {getChartIcon(chart.chartType)}
                    </div>
                    <div>
                      <CardTitle className="text-base text-[#1f334d]">{chart.name}</CardTitle>
                      <p className="text-xs text-[#1f334d]/50">{getDatasetName(chart.datasetId)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(chart.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ChartViewer chart={chart} datasets={datasets} />
                <div className="pt-3 mt-3 border-t border-[#1f334d]/10 flex items-center justify-between">
                  <Badge className="bg-[#c89b3c]/20 text-[#c89b3c]">{chart.chartType}</Badge>
                  <p className="text-xs text-[#1f334d]/40">
                    {new Date(chart.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DatasetsTab() {
  const queryClient = useQueryClient();
  const { data: datasets = [], isLoading } = useQuery({ queryKey: ["datasets"], queryFn: fetchDatasets });
  const { data: tables = [] } = useQuery({ queryKey: ["tables"], queryFn: fetchTables });
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [queryType, setQueryType] = useState("table");
  const [tableName, setTableName] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/bi/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
      setShowAdd(false);
      setName("");
      setTableName("");
      setSqlQuery("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/bi/datasets/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#c89b3c]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white">Datasets / Consultas</h2>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d]" data-testid="add-dataset">
              <Plus className="w-4 h-4 mr-2" /> Novo Dataset
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1f334d] border-[#c89b3c]/30 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#c89b3c]">Novo Dataset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-white/70 mb-1 block">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#162638] border-white/20 text-white" />
              </div>
              <div>
                <label className="text-sm text-white/70 mb-1 block">Tipo</label>
                <Select value={queryType} onValueChange={setQueryType}>
                  <SelectTrigger className="bg-[#162638] border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#162638] border-white/20">
                    <SelectItem value="table" className="text-white">Tabela</SelectItem>
                    <SelectItem value="sql" className="text-white">SQL Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {queryType === "table" ? (
                <div>
                  <label className="text-sm text-white/70 mb-1 block">Tabela</label>
                  <Select value={tableName} onValueChange={setTableName}>
                    <SelectTrigger className="bg-[#162638] border-white/20 text-white">
                      <SelectValue placeholder="Selecione uma tabela" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#162638] border-white/20 max-h-60">
                      {tables.map((t) => (
                        <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <label className="text-sm text-white/70 mb-1 block">Query SQL</label>
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    placeholder="SELECT * FROM..."
                    className="w-full h-32 bg-[#162638] border border-white/20 rounded-lg p-2.5 text-white text-sm font-mono placeholder:text-white/40 focus:outline-none focus:border-[#c89b3c] resize-none"
                  />
                </div>
              )}
              <Button
                onClick={() => createMutation.mutate({ name, queryType, tableName: queryType === "table" ? tableName : undefined, sqlQuery: queryType === "sql" ? sqlQuery : undefined })}
                disabled={!name || createMutation.isPending}
                className="w-full bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d]"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Dataset"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          {datasets.length === 0 ? (
            <Card className="bg-[#1f334d] border-[#c89b3c]/20">
              <CardContent className="p-8 text-center">
                <Table className="w-12 h-12 text-[#c89b3c]/50 mx-auto mb-4" />
                <p className="text-white/50">Nenhum dataset criado</p>
              </CardContent>
            </Card>
          ) : (
            datasets.map((ds) => (
              <DatasetCard key={ds.id} dataset={ds} onDelete={() => deleteMutation.mutate(ds.id)} />
            ))
          )}
        </div>
        
        <DataAssistant datasets={datasets} />
      </div>
    </div>
  );
}

function BackupsTab() {
  const queryClient = useQueryClient();
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ["backup-jobs"], queryFn: fetchBackupJobs });
  const { data: artifacts = [] } = useQuery({ queryKey: ["backup-artifacts"], queryFn: fetchBackupArtifacts });
  const { data: sources = [] } = useQuery({ queryKey: ["data-sources"], queryFn: fetchDataSources });
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [dataSourceId, setDataSourceId] = useState("");
  const [backupType, setBackupType] = useState("full");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/bi/backup-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backup-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
      setShowAdd(false);
      setName("");
      setDataSourceId("");
    },
  });

  const runMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/bi/backup-jobs/${id}/run`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backup-artifacts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/bi/backup-jobs/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backup-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#c89b3c]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white">Backups de Banco de Dados</h2>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d]" data-testid="add-backup">
              <Plus className="w-4 h-4 mr-2" /> Novo Backup
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1f334d] border-[#c89b3c]/30 text-white">
            <DialogHeader>
              <DialogTitle className="text-[#c89b3c]">Configurar Backup</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-white/70 mb-1 block">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#162638] border-white/20 text-white" />
              </div>
              <div>
                <label className="text-sm text-white/70 mb-1 block">Fonte de Dados</label>
                <Select value={dataSourceId} onValueChange={setDataSourceId}>
                  <SelectTrigger className="bg-[#162638] border-white/20 text-white">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#162638] border-white/20">
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()} className="text-white">{s.name} ({s.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-white/70 mb-1 block">Tipo de Backup</label>
                <Select value={backupType} onValueChange={setBackupType}>
                  <SelectTrigger className="bg-[#162638] border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#162638] border-white/20">
                    <SelectItem value="full" className="text-white">Completo (Dados + Schema)</SelectItem>
                    <SelectItem value="data" className="text-white">Apenas Dados</SelectItem>
                    <SelectItem value="schema" className="text-white">Apenas Schema</SelectItem>
                    <SelectItem value="incremental" className="text-white">Incremental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => createMutation.mutate({ name, dataSourceId: parseInt(dataSourceId), backupType })}
                disabled={!name || !dataSourceId || createMutation.isPending}
                className="w-full bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d]"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Job de Backup"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">Jobs Configurados</h3>
          {jobs.length === 0 ? (
            <Card className="bg-[#1f334d] border-[#c89b3c]/20">
              <CardContent className="p-6 text-center">
                <Archive className="w-10 h-10 text-[#c89b3c]/50 mx-auto mb-3" />
                <p className="text-white/50 text-sm">Nenhum job de backup</p>
              </CardContent>
            </Card>
          ) : (
            jobs.map((job) => (
              <Card key={job.id} className="bg-[#1f334d] border-[#c89b3c]/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-500/20">
                        <HardDrive className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{job.name}</h3>
                        <p className="text-sm text-white/50">{job.dataSource?.name || "N/A"} - {job.backupType}</p>
                      </div>
                    </div>
                    <Badge variant={job.isActive === "true" ? "default" : "secondary"} className={job.isActive === "true" ? "bg-green-500/20 text-green-400" : ""}>
                      {job.isActive === "true" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={() => runMutation.mutate(job.id)} disabled={runMutation.isPending} className="text-white/70 border-white/10">
                      {runMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      <span className="ml-1">Executar</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(job.id)} className="text-red-400 border-red-400/20 hover:bg-red-400/10">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">Histórico de Backups</h3>
          <ScrollArea className="h-80">
            {artifacts.length === 0 ? (
              <Card className="bg-[#1f334d] border-[#c89b3c]/20">
                <CardContent className="p-6 text-center">
                  <Download className="w-10 h-10 text-[#c89b3c]/50 mx-auto mb-3" />
                  <p className="text-white/50 text-sm">Nenhum backup realizado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {artifacts.map((a) => (
                  <Card key={a.id} className="bg-[#162638] border-white/5">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {a.status === "completed" ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : a.status === "running" ? (
                          <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <div>
                          <p className="text-sm text-white">{a.jobName}</p>
                          <p className="text-xs text-white/40">{new Date(a.startedAt).toLocaleString("pt-BR")}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-white/70">{formatBytes(a.fileSize)}</p>
                        {a.status === "completed" && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-[#c89b3c] hover:text-[#d4a94a]">
                            <Download className="w-3 h-3 mr-1" /> Download
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function UploadTab() {
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [tableName, setTableName] = useState("");
  const [columnMappings, setColumnMappings] = useState<any[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  const [zipPrefix, setZipPrefix] = useState("");
  const [selectedZipFiles, setSelectedZipFiles] = useState<string[]>([]);
  const [selectedSqlTables, setSelectedSqlTables] = useState<string[]>([]);
  const [sqlPrefix, setSqlPrefix] = useState("");

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/bi/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: (data) => {
      console.log("[BI Upload] Response:", data);
      setUploadedFile(data);
      if (data.isZip) {
        setZipPrefix(data.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_"));
        setSelectedZipFiles(data.files.map((f: any) => f.name));
      } else if (data.isSql) {
        setSqlPrefix(data.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_"));
        setSelectedSqlTables(data.tables?.slice(0, 10) || []);
      } else if (data.isExcel || data.headers) {
        setTableName(data.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_"));
        const headers = data.headers || [];
        console.log("[BI Upload] Excel/CSV headers:", headers);
        if (headers.length === 0) {
          console.warn("[BI Upload] No headers found in file");
        }
        setColumnMappings(
          headers.map((h: string) => ({
            originalName: h,
            name: h.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase(),
            type: "text",
            include: true,
          }))
        );
      } else {
        setTableName(data.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_"));
        setColumnMappings([]);
      }
    },
  });

  const sqlImportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bi/upload/sql-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filepath: uploadedFile.filepath,
          selectedTables: selectedSqlTables,
          targetPrefix: sqlPrefix,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "SQL import failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
      setUploadedFile(null);
      setSqlPrefix("");
      setSelectedSqlTables([]);
    },
  });

  const zipImportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bi/upload/zip-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filepath: uploadedFile.filepath,
          selectedFiles: selectedZipFiles,
          targetPrefix: zipPrefix,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("ZIP import failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staged-tables"] });
      queryClient.invalidateQueries({ queryKey: ["staging-stats"] });
      queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
      setUploadedFile(null);
      setZipPrefix("");
      setSelectedZipFiles([]);
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bi/upload/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filepath: uploadedFile.filepath,
          tableName,
          headers: columnMappings.filter((c) => c.include),
          fileType: uploadedFile.fileType,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Import failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setUploadedFile(null);
      setColumnMappings([]);
      setTableName("");
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadMutation.mutate(e.target.files[0]);
    }
  };

  const handleColumnDragStart = (index: number) => setDraggedColumn(index);
  const handleColumnDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedColumn !== null && draggedColumn !== index) {
      const newMappings = [...columnMappings];
      const [removed] = newMappings.splice(draggedColumn, 1);
      newMappings.splice(index, 0, removed);
      setColumnMappings(newMappings);
      setDraggedColumn(index);
    }
  };
  const handleColumnDragEnd = () => setDraggedColumn(null);

  const updateColumn = (index: number, field: string, value: any) => {
    const newMappings = [...columnMappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setColumnMappings(newMappings);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white">Upload de Dados</h2>
      </div>

      {!uploadedFile ? (
        <Card
          className={`bg-[#1f334d] border-2 border-dashed transition-colors ${
            isDragging ? "border-[#c89b3c] bg-[#c89b3c]/10" : "border-white/20"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="p-12 text-center">
            {uploadMutation.isPending ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-[#c89b3c] animate-spin" />
                <p className="text-white/70">Processando arquivo...</p>
              </div>
            ) : (
              <>
                <FileSpreadsheet className="w-16 h-16 text-[#c89b3c]/50 mx-auto mb-4" />
                <p className="text-white text-lg mb-2">Arraste e solte seu arquivo aqui</p>
                <p className="text-white/50 mb-4">ou</p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.txt,.json,.zip,.sql,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  <Button className="bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d]" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" /> Selecionar Arquivo
                    </span>
                  </Button>
                </label>
                <p className="text-white/40 text-sm mt-4">Formatos suportados: CSV, TXT, JSON, SQL, ZIP, Excel (.xlsx, .xls)</p>
                <p className="text-white/30 text-xs mt-1">Arquivos ZIP podem conter backups SQL ou exportações MongoDB</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : uploadedFile.isZip ? (
        <div className="space-y-6">
          <Card className="bg-[#1f334d] border-[#c89b3c]/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileArchive className="w-5 h-5 text-[#c89b3c]" />
                {uploadedFile.filename}
                <Badge className="ml-2 bg-blue-500/20 text-blue-400">{uploadedFile.summary}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-white/70 mb-1 block">Prefixo para Tabelas Staging</label>
                <Input
                  value={zipPrefix}
                  onChange={(e) => setZipPrefix(e.target.value)}
                  className="bg-[#162638] border-white/20 text-white max-w-md"
                  placeholder="ex: migração_2024"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1f334d] border-[#c89b3c]/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#c89b3c]" />
                Conteúdo do ZIP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {uploadedFile.files.map((file: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#162638] border border-white/10"
                  >
                    <input
                      type="checkbox"
                      checked={selectedZipFiles.includes(file.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedZipFiles([...selectedZipFiles, file.name]);
                        } else {
                          setSelectedZipFiles(selectedZipFiles.filter(f => f !== file.name));
                        }
                      }}
                      className="rounded border-white/30"
                    />
                    {file.type === "sql" && <FileArchive className="w-4 h-4 text-blue-400" />}
                    {(file.type === "mongodb" || file.type === "bson") && <Database className="w-4 h-4 text-green-400" />}
                    {file.type === "csv" && <FileSpreadsheet className="w-4 h-4 text-purple-400" />}
                    {file.type === "unknown" && <FileText className="w-4 h-4 text-gray-400" />}
                    <div className="flex-1">
                      <p className="text-white">{file.name}</p>
                      <p className="text-white/50 text-sm">
                        {file.type === "sql" && file.tables?.length > 0 && `Tabelas: ${file.tables.join(", ")}`}
                        {file.type === "mongodb" && file.collections?.length > 0 && `Coleções: ${file.collections.map((c: any) => `${c.name} (${c.documents?.length || c.count || 0})`).join(", ")}`}
                        {file.type === "bson" && `${file.documentCount || 0} documentos MongoDB`}
                        {file.type === "csv" && `Tipo: CSV/TXT`}
                        {file.type === "unknown" && `Tipo não suportado`}
                      </p>
                    </div>
                    <Badge className={
                      file.type === "sql" ? "bg-blue-500/20 text-blue-400" :
                      (file.type === "mongodb" || file.type === "bson") ? "bg-green-500/20 text-green-400" :
                      file.type === "csv" ? "bg-purple-500/20 text-purple-400" :
                      "bg-gray-500/20 text-gray-400"
                    }>
                      {file.type === "bson" ? "MONGODB/BSON" : file.type.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              onClick={() => {
                setUploadedFile(null);
                setZipPrefix("");
                setSelectedZipFiles([]);
              }}
              variant="outline"
              className="text-white/70 border-white/20"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => zipImportMutation.mutate()}
              disabled={selectedZipFiles.length === 0 || !zipPrefix || zipImportMutation.isPending}
              className="bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d]"
            >
              {zipImportMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Importar para Staging ({selectedZipFiles.length} arquivos)
            </Button>
          </div>
        </div>
      ) : uploadedFile.isSql ? (
        <div className="space-y-6">
          <Card className="bg-[#1f334d] border-[#c89b3c]/30 border-2">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-[#c89b3c]" />
                {uploadedFile.filename}
                <Badge className="ml-2 bg-blue-500/20 text-blue-400">{uploadedFile.tableCount} tabelas</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-white/70 mb-1 block">Prefixo para Tabelas</label>
                <Input
                  value={sqlPrefix}
                  onChange={(e) => setSqlPrefix(e.target.value)}
                  className="bg-[#162638] border-white/20 text-white max-w-md"
                  placeholder="ex: erp_backup"
                />
              </div>
              <div>
                <label className="text-sm text-white/70 mb-2 block">
                  Selecione as tabelas para importar ({selectedSqlTables.length} de {uploadedFile.tables?.length || 0})
                </label>
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSqlTables(uploadedFile.tables || [])}
                    className="text-white/70 border-white/20"
                  >
                    Selecionar Todas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSqlTables([])}
                    className="text-white/70 border-white/20"
                  >
                    Limpar Seleção
                  </Button>
                </div>
                <ScrollArea className="h-64 border border-white/10 rounded-lg p-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {(uploadedFile.tables || []).map((table: string) => (
                      <div
                        key={table}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          selectedSqlTables.includes(table)
                            ? "bg-[#c89b3c]/20 border border-[#c89b3c]/50"
                            : "bg-[#162638] border border-white/10 hover:border-white/30"
                        }`}
                        onClick={() => {
                          if (selectedSqlTables.includes(table)) {
                            setSelectedSqlTables(selectedSqlTables.filter(t => t !== table));
                          } else {
                            setSelectedSqlTables([...selectedSqlTables, table]);
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSqlTables.includes(table)}
                          onChange={() => {}}
                          className="rounded border-white/30"
                        />
                        <span className="text-white/80 text-sm truncate">{table}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              onClick={() => {
                setUploadedFile(null);
                setSqlPrefix("");
                setSelectedSqlTables([]);
              }}
              variant="outline"
              className="text-white/70 border-white/20"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => sqlImportMutation.mutate()}
              disabled={selectedSqlTables.length === 0 || !sqlPrefix || sqlImportMutation.isPending}
              className="bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d]"
            >
              {sqlImportMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              Importar {selectedSqlTables.length} Tabelas
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="bg-[#1f334d] border-[#c89b3c]/30 border-2">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#c89b3c]" />
                  {uploadedFile.filename}
                  <Badge className="ml-2 bg-green-500/20 text-green-400">{uploadedFile.rowCount} registros</Badge>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setUploadedFile(null);
                      setColumnMappings([]);
                      setTableName("");
                    }}
                    variant="outline"
                    size="sm"
                    className="text-white/70 border-white/20"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => importMutation.mutate()}
                    disabled={!tableName || importMutation.isPending}
                    size="sm"
                    className="bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d] font-semibold px-6"
                    data-testid="button-import-data"
                  >
                    {importMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Salvar e Importar
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-white/70 mb-1 block">Nome da Tabela</label>
                <Input
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="bg-[#162638] border-white/20 text-white max-w-md"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1f334d] border-[#c89b3c]/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Columns className="w-5 h-5 text-[#c89b3c]" />
                Mapeamento de Colunas
                <span className="text-sm font-normal text-white/50 ml-2">(arraste para reordenar)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {columnMappings.map((col, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handleColumnDragStart(index)}
                    onDragOver={(e) => handleColumnDragOver(e, index)}
                    onDragEnd={handleColumnDragEnd}
                    className={`flex items-center gap-3 p-3 rounded-lg bg-[#162638] border ${
                      draggedColumn === index ? "border-[#c89b3c]" : "border-white/10"
                    } cursor-grab active:cursor-grabbing`}
                  >
                    <GripVertical className="w-4 h-4 text-white/40" />
                    <input
                      type="checkbox"
                      checked={col.include}
                      onChange={(e) => updateColumn(index, "include", e.target.checked)}
                      className="rounded border-white/30"
                    />
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-xs text-white/40 block mb-1">Original</span>
                        <span className="text-white/70">{col.originalName}</span>
                      </div>
                      <div>
                        <span className="text-xs text-white/40 block mb-1">Nome</span>
                        <Input
                          value={col.name}
                          onChange={(e) => updateColumn(index, "name", e.target.value)}
                          className="h-8 bg-[#1f334d] border-white/20 text-white text-sm"
                        />
                      </div>
                      <div>
                        <span className="text-xs text-white/40 block mb-1">Tipo</span>
                        <Select value={col.type} onValueChange={(v) => updateColumn(index, "type", v)}>
                          <SelectTrigger className="h-8 bg-[#1f334d] border-white/20 text-white text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#162638] border-white/20">
                            <SelectItem value="text" className="text-white">Texto</SelectItem>
                            <SelectItem value="integer" className="text-white">Inteiro</SelectItem>
                            <SelectItem value="decimal" className="text-white">Decimal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1f334d] border-[#c89b3c]/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Table className="w-5 h-5 text-[#c89b3c]" />
                Prévia dos Dados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      {columnMappings
                        .filter((c) => c.include)
                        .map((col, i) => (
                          <th key={i} className="text-left py-2 px-3 text-white/70 font-medium">
                            {col.name}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(uploadedFile.preview || []).slice(0, 5).map((row: any, i: number) => (
                      <tr key={i} className="border-b border-white/5">
                        {columnMappings
                          .filter((c) => c.include)
                          .map((col, j) => (
                            <td key={j} className="py-2 px-3 text-white/60">
                              {row[col.originalName] || "-"}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StagingTab() {
  const queryClient = useQueryClient();
  const { data: stagedTables = [], isLoading } = useQuery({ queryKey: ["staged-tables"], queryFn: fetchStagedTables });
  const { data: stats } = useQuery({ queryKey: ["staging-stats"], queryFn: fetchStagingStats });
  const { data: erpTargets = [] } = useQuery({ queryKey: ["erp-targets"], queryFn: fetchErpTargets });
  const [selectedTable, setSelectedTable] = useState<StagedTable | null>(null);
  const [viewingData, setViewingData] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/staging/tables/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staged-tables"] });
      queryClient.invalidateQueries({ queryKey: ["staging-stats"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/staging/tables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staged-tables"] });
    },
  });

  const viewData = async (table: StagedTable) => {
    try {
      const res = await fetch(`/api/staging/tables/${table.id}/data?limit=50`, { credentials: "include" });
      if (res.ok) {
        const result = await res.json();
        setTableData(result.data);
        setSelectedTable(table);
        setViewingData(true);
      }
    } catch {}
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "sql": return <FileArchive className="w-4 h-4 text-blue-400" />;
      case "mongodb": return <Database className="w-4 h-4 text-green-400" />;
      case "csv": return <FileSpreadsheet className="w-4 h-4 text-purple-400" />;
      case "json": return <FileText className="w-4 h-4 text-yellow-400" />;
      default: return <Layers className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ready: "bg-blue-500/20 text-blue-400",
      mapped: "bg-purple-500/20 text-purple-400",
      migrating: "bg-yellow-500/20 text-yellow-400",
      migrated: "bg-green-500/20 text-green-400",
      error: "bg-red-500/20 text-red-400",
    };
    const labels: Record<string, string> = {
      ready: "Pronto",
      mapped: "Mapeado",
      migrating: "Migrando",
      migrated: "Migrado",
      error: "Erro",
    };
    return <Badge className={colors[status] || "bg-gray-500/20 text-gray-400"}>{labels[status] || status}</Badge>;
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#c89b3c]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-[#1f334d] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-500/20">
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.totalTables || 0}</p>
              <p className="text-xs text-white/50">Tabelas Staging</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1f334d] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-full bg-purple-500/20">
              <Table className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.totalRecords?.toLocaleString() || 0}</p>
              <p className="text-xs text-white/50">Total de Registros</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1f334d] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-500/20">
              <MapPin className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.mappedTables || 0}</p>
              <p className="text-xs text-white/50">Mapeados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1f334d] border-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-full bg-[#c89b3c]/20">
              <Send className="w-5 h-5 text-[#c89b3c]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.completedMigrations || 0}</p>
              <p className="text-xs text-white/50">Migrações Completas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#1f334d] border-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#c89b3c]" />
              Tabelas em Staging
            </CardTitle>
            <p className="text-white/50 text-sm">
              Faça upload de arquivos ZIP na aba Upload para importar dados
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {stagedTables.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma tabela em staging</p>
              <p className="text-sm mt-1">Faça upload de arquivos ZIP/SQL/JSON para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stagedTables.map((table) => (
                <div
                  key={table.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {getSourceIcon(table.sourceType)}
                    <div>
                      <p className="text-white font-medium">{table.name}</p>
                      <p className="text-white/50 text-sm">
                        {table.tableName} • {table.rowCount.toLocaleString()} registros
                        {table.sourceFile && ` • ${table.sourceFile}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(table.status)}
                    {table.targetErp && (
                      <Badge className="bg-[#c89b3c]/20 text-[#c89b3c]">
                        {erpTargets.find(e => e.id === table.targetErp)?.name || table.targetErp}
                      </Badge>
                    )}
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => viewData(table)}
                        className="text-white/60 hover:text-white hover:bg-white/10"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Select
                        value={table.targetErp || ""}
                        onValueChange={(value) => updateMutation.mutate({ id: table.id, data: { targetErp: value } })}
                      >
                        <SelectTrigger className="w-32 h-8 bg-white/5 border-white/10 text-white text-xs">
                          <SelectValue placeholder="Destino ERP" />
                        </SelectTrigger>
                        <SelectContent>
                          {erpTargets.map((erp) => (
                            <SelectItem key={erp.id} value={erp.id}>{erp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(table.id)}
                        className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewingData} onOpenChange={setViewingData}>
        <DialogContent className="max-w-4xl bg-[#1f334d] border-[#c89b3c]/20">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Table className="w-5 h-5 text-[#c89b3c]" />
              {selectedTable?.name} - Dados
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            {tableData.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {Object.keys(tableData[0]).filter(k => k !== "id").map((key) => (
                      <th key={key} className="text-left py-2 px-3 text-white/70 font-medium">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {Object.entries(row).filter(([k]) => k !== "id").map(([k, v], j) => (
                        <td key={j} className="py-2 px-3 text-white/60 max-w-[200px] truncate">
                          {String(v || "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Card className="bg-[#1f334d] border-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-[#c89b3c]" />
            Sistemas ERP Suportados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {erpTargets.map((erp) => (
              <div key={erp.id} className="p-4 rounded-lg bg-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-[#c89b3c]" />
                  <span className="text-white font-medium">{erp.name}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {erp.entities.map((entity) => (
                    <Badge key={entity} variant="outline" className="text-white/50 border-white/20 text-xs">
                      {entity}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface BiMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CoPilotDataset {
  id: number;
  name: string;
  tableName?: string | null;
  description?: string | null;
}

function BiCoPilot({ isOpen, onClose, datasets }: { isOpen: boolean; onClose: () => void; datasets: CoPilotDataset[] }) {
  const [messages, setMessages] = useState<BiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<CoPilotDataset | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'actions'>('actions');
  const queryClient = useQueryClient();

  const runAction = async (actionPrompt: string) => {
    setActiveTab('chat');
    setMessages(prev => [...prev, { role: 'user', content: actionPrompt }]);
    setIsLoading(true);

    try {
      const contextInfo = selectedDataset 
        ? `[CONTEXTO BI AUTOMÁTICO - USE ESTES DADOS DIRETAMENTE, NÃO PEÇA CONFIGURAÇÃO:
Dataset selecionado: "${selectedDataset.name}" (ID: ${selectedDataset.id})
Tabela: ${selectedDataset.tableName || 'N/A'}
IMPORTANTE: Execute a análise diretamente usando bi_execute_query ou bi_get_dataset_data. NÃO peça ao usuário para configurar fontes de dados.]

`
        : `[CONTEXTO BI: ${datasets.length} datasets disponíveis. Use bi_list_datasets para ver todos. NÃO peça configuração manual.]

`;

      const res = await fetch("/api/manus/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: contextInfo + actionPrompt }),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Falha na requisição");
      const { runId } = await res.json();

      let attempts = 0;
      const maxAttempts = 60;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`/api/manus/runs/${runId}`, { credentials: "include" });
        const run = await statusRes.json();
        
        if (run.status === 'completed' || run.status === 'stopped') {
          const lastStep = run.steps?.[run.steps.length - 1];
          const response = lastStep?.toolOutput || run.result || "Análise concluída.";
          setMessages(prev => [...prev, { role: 'assistant', content: response }]);
          queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
          queryClient.invalidateQueries({ queryKey: ["bi-datasets"] });
          queryClient.invalidateQueries({ queryKey: ["bi-charts"] });
          break;
        }
        attempts++;
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erro ao processar. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    runAction(userMessage);
  };

  const quickActions = [
    { icon: "📊", label: "Resumo Executivo", prompt: "Faça um resumo executivo completo dos dados, incluindo principais métricas e insights" },
    { icon: "🔍", label: "Detectar Padrões", prompt: "Analise os dados e detecte padrões, tendências e anomalias importantes" },
    { icon: "📈", label: "Criar Gráfico", prompt: "Crie um gráfico apropriado para visualizar os principais dados" },
    { icon: "📋", label: "Estatísticas", prompt: "Calcule estatísticas descritivas: média, mediana, desvio padrão, mínimo e máximo" },
    { icon: "💡", label: "Insights de Negócio", prompt: "Gere insights de negócio acionáveis baseados na análise dos dados" },
    { icon: "📉", label: "Análise de Tendência", prompt: "Faça uma análise de tendência temporal dos dados, se aplicável" },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[480px] h-[650px] bg-[#1f334d] rounded-xl shadow-2xl border border-[#c89b3c]/30 flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b border-[#c89b3c]/20">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#c89b3c] to-[#a07830]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-medium">Co-Piloto BI</h3>
            <p className="text-white/50 text-xs">Análise inteligente integrada</p>
          </div>
        </div>
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          data-testid="button-close-bi-copilot"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Dataset Selector */}
      <div className="p-3 border-b border-[#c89b3c]/20 bg-white/5">
        <label className="text-white/50 text-xs block mb-1">Dataset para análise:</label>
        <select 
          value={selectedDataset?.id || ""}
          onChange={(e) => {
            const ds = datasets.find(d => d.id === Number(e.target.value));
            setSelectedDataset(ds || null);
          }}
          className="w-full bg-[#1f334d] border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:border-[#c89b3c] focus:outline-none"
        >
          <option value="">Todos os datasets ({datasets.length})</option>
          {datasets.map(ds => (
            <option key={ds.id} value={ds.id}>{ds.name}</option>
          ))}
        </select>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-[#c89b3c]/20">
        <button
          onClick={() => setActiveTab('actions')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'actions' ? 'text-[#c89b3c] border-b-2 border-[#c89b3c]' : 'text-white/50 hover:text-white'}`}
        >
          ⚡ Ações Rápidas
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'chat' ? 'text-[#c89b3c] border-b-2 border-[#c89b3c]' : 'text-white/50 hover:text-white'}`}
        >
          💬 Chat
        </button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {activeTab === 'actions' ? (
          <div className="space-y-3">
            <p className="text-white/60 text-xs mb-3">
              {selectedDataset 
                ? `Clique para analisar: "${selectedDataset.name}"`
                : "Selecione um dataset acima ou clique para análise geral"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => runAction(action.prompt)}
                  disabled={isLoading}
                  className="p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#c89b3c]/50 transition-all text-left disabled:opacity-50"
                >
                  <span className="text-xl block mb-1">{action.icon}</span>
                  <span className="text-white text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-4 mt-4 bg-white/5 rounded-lg">
                <Loader2 className="w-5 h-5 text-[#c89b3c] animate-spin" />
                <span className="text-white/70 text-sm">Processando análise...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Bot className="w-10 h-10 text-[#c89b3c]/50 mx-auto mb-2" />
                <p className="text-white/60 text-sm">Envie uma pergunta ou use as Ações Rápidas</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] p-3 rounded-lg text-sm ${
                  msg.role === 'user' 
                    ? 'bg-[#c89b3c] text-[#1f334d]' 
                    : 'bg-white/10 text-white'
                }`}>
                  <pre className="whitespace-pre-wrap font-sans text-xs">{msg.content}</pre>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/10 p-3 rounded-lg flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[#c89b3c] animate-spin" />
                  <span className="text-white/70 text-sm">Analisando...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t border-[#c89b3c]/20">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre seus dados..."
            className="flex-1 bg-white/5 border-white/20 text-white placeholder:text-white/40 resize-none text-sm"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button 
            onClick={sendMessage} 
            disabled={!input.trim() || isLoading}
            className="bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d] self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function BiAssistant({ isOpen, onClose, context }: { isOpen: boolean; onClose: () => void; context: string }) {
  const [messages, setMessages] = useState<BiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const contextPrompt = context 
        ? `[Contexto BI: ${context}]\n\n${userMessage}`
        : userMessage;

      const res = await fetch("/api/manus/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: contextPrompt }),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Falha na requisição");
      const { runId } = await res.json();

      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`/api/manus/runs/${runId}`, { credentials: "include" });
        const run = await statusRes.json();
        
        if (run.status === 'completed' || run.status === 'stopped') {
          const lastStep = run.steps?.[run.steps.length - 1];
          const response = lastStep?.toolOutput || run.result || "Análise concluída.";
          setMessages(prev => [...prev, { role: 'assistant', content: response }]);
          queryClient.invalidateQueries({ queryKey: ["bi-stats"] });
          queryClient.invalidateQueries({ queryKey: ["data-sources"] });
          queryClient.invalidateQueries({ queryKey: ["bi-datasets"] });
          queryClient.invalidateQueries({ queryKey: ["bi-charts"] });
          break;
        }
        attempts++;
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erro ao processar solicitação. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[420px] h-[600px] bg-[#1f334d] rounded-xl shadow-2xl border border-[#c89b3c]/30 flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b border-[#c89b3c]/20">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-[#c89b3c]/20">
            <Sparkles className="w-5 h-5 text-[#c89b3c]" />
          </div>
          <div>
            <h3 className="text-white font-medium">Cientista de Dados IA</h3>
            <p className="text-white/50 text-xs">Análise inteligente de dados</p>
          </div>
        </div>
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          data-testid="button-close-bi-assistant"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 text-[#c89b3c]/50 mx-auto mb-3" />
              <p className="text-white/70 text-sm mb-2">Olá! Sou seu Cientista de Dados IA.</p>
              <p className="text-white/50 text-xs mb-4">Posso ajudar a analisar dados, criar gráficos e descobrir insights.</p>
              <div className="space-y-2">
                <button 
                  onClick={() => setInput("Mostrar estatísticas do BI")}
                  className="w-full text-left text-xs p-2 rounded bg-white/5 text-white/70 hover:bg-white/10"
                >
                  📊 Mostrar estatísticas do BI
                </button>
                <button 
                  onClick={() => setInput("Listar tabelas disponíveis no banco")}
                  className="w-full text-left text-xs p-2 rounded bg-white/5 text-white/70 hover:bg-white/10"
                >
                  📋 Listar tabelas do banco de dados
                </button>
                <button 
                  onClick={() => setInput("Criar um dataset com dados de parceiros")}
                  className="w-full text-left text-xs p-2 rounded bg-white/5 text-white/70 hover:bg-white/10"
                >
                  ➕ Criar dataset de parceiros
                </button>
                <button 
                  onClick={() => setInput("Detectar padrões nos dados de contratos")}
                  className="w-full text-left text-xs p-2 rounded bg-white/5 text-white/70 hover:bg-white/10"
                >
                  🔍 Detectar padrões nos dados
                </button>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                msg.role === 'user' 
                  ? 'bg-[#c89b3c] text-[#1f334d]' 
                  : 'bg-white/10 text-white'
              }`}>
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 p-3 rounded-lg flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#c89b3c] animate-spin" />
                <span className="text-white/70 text-sm">Analisando...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-[#c89b3c]/20">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre seus dados..."
            className="flex-1 bg-white/5 border-white/20 text-white placeholder:text-white/40 resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button 
            onClick={sendMessage} 
            disabled={!input.trim() || isLoading}
            className="bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d] self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BiWorkspace() {
  const [activeTab, setActiveTab] = useState("overview");
  const [assistantOpen, setAssistantOpen] = useState(false);
  
  const { data: stats } = useQuery({ queryKey: ["bi-stats"], queryFn: fetchStats });
  const { data: dataSources = [] } = useQuery({ queryKey: ["data-sources"], queryFn: fetchDataSources });
  const { data: datasets = [] } = useQuery({ queryKey: ["bi-datasets"], queryFn: fetchDatasets });

  const buildContext = () => {
    const parts = [];
    parts.push(`Aba ativa: ${activeTab}`);
    if (stats) {
      parts.push(`Estatísticas: ${stats.dataSources} fontes de dados, ${stats.datasets} datasets, ${stats.charts} gráficos, ${stats.dashboards} dashboards`);
    }
    if (dataSources.length > 0) {
      parts.push(`Fontes configuradas: ${dataSources.map((d: DataSource) => d.name).join(', ')}`);
    }
    if (datasets.length > 0) {
      parts.push(`Datasets disponíveis: ${datasets.map((d: Dataset) => `${d.name} (ID:${d.id})`).join(', ')}`);
    }
    return parts.join('. ');
  };

  return (
    <BrowserFrame>
      <div className="min-h-full bg-gradient-to-br from-[#f5f7fa] to-[#e8ecf1]">
        <div className="bg-[#1f334d] border-b border-[#c89b3c]/20 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-light text-white" style={{ fontFamily: 'Georgia, serif' }}>
                <span className="italic text-[#c89b3c]">Arcádia</span> Insights
              </h1>
              <p className="text-white/50 text-sm">Plataforma de Business Intelligence</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="text-white/70 border-white/20 hover:bg-white/5">
                <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-[#1f334d] border border-[#c89b3c]/20 p-1">
              <TabsTrigger value="overview" className="data-[state=active]:bg-[#c89b3c] data-[state=active]:text-[#1f334d] text-white/70">
                <LayoutDashboard className="w-4 h-4 mr-2" /> Visão Geral
              </TabsTrigger>
              <TabsTrigger value="datasources" className="data-[state=active]:bg-[#c89b3c] data-[state=active]:text-[#1f334d] text-white/70">
                <Database className="w-4 h-4 mr-2" /> Fontes de Dados
              </TabsTrigger>
              <TabsTrigger value="upload" className="data-[state=active]:bg-[#c89b3c] data-[state=active]:text-[#1f334d] text-white/70">
                <Upload className="w-4 h-4 mr-2" /> Upload
              </TabsTrigger>
              <TabsTrigger value="datasets" className="data-[state=active]:bg-[#c89b3c] data-[state=active]:text-[#1f334d] text-white/70">
                <FileText className="w-4 h-4 mr-2" /> Consultas
              </TabsTrigger>
              <TabsTrigger value="charts" className="data-[state=active]:bg-[#c89b3c] data-[state=active]:text-[#1f334d] text-white/70">
                <BarChart3 className="w-4 h-4 mr-2" /> Gráficos
              </TabsTrigger>
              <TabsTrigger value="backups" className="data-[state=active]:bg-[#c89b3c] data-[state=active]:text-[#1f334d] text-white/70">
                <Archive className="w-4 h-4 mr-2" /> Backups
              </TabsTrigger>
              <TabsTrigger value="staging" className="data-[state=active]:bg-[#c89b3c] data-[state=active]:text-[#1f334d] text-white/70">
                <Layers className="w-4 h-4 mr-2" /> Staging
              </TabsTrigger>
              <TabsTrigger value="advanced" className="data-[state=active]:bg-[#c89b3c] data-[state=active]:text-[#1f334d] text-white/70">
                <Settings className="w-4 h-4 mr-2" /> MetaSet
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              <OverviewTab />
            </TabsContent>
            <TabsContent value="datasources" className="mt-0">
              <DataSourcesTab />
            </TabsContent>
            <TabsContent value="upload" className="mt-0">
              <UploadTab />
            </TabsContent>
            <TabsContent value="datasets" className="mt-0">
              <DatasetsTab />
            </TabsContent>
            <TabsContent value="charts" className="mt-0">
              <ChartsTab />
            </TabsContent>
            <TabsContent value="backups" className="mt-0">
              <BackupsTab />
            </TabsContent>
            <TabsContent value="staging" className="mt-0">
              <StagingTab />
            </TabsContent>
            <TabsContent value="advanced" className="mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1f334d]">MetaSet - Motor de BI</h2>
                    <p className="text-sm text-gray-500">Acesso completo para criação manual de consultas SQL, gráficos e dashboards</p>
                  </div>
                  <a
                    href="/api/bi/metaset/autologin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#1f334d] text-white rounded-lg hover:bg-[#2a4466] transition-colors text-sm"
                    data-testid="link-open-metaset-external"
                  >
                    <ArrowRight className="w-4 h-4" /> Abrir em Nova Aba
                  </a>
                </div>
                <div className="rounded-xl overflow-hidden border border-[#c89b3c]/20 bg-white shadow-sm" style={{ height: 'calc(100vh - 320px)' }}>
                  <iframe
                    src="/api/bi/metaset/autologin"
                    className="w-full h-full border-0"
                    title="MetaSet - Arcádia Insights"
                    data-testid="iframe-metaset-advanced"
                    allow="fullscreen"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Floating AI Co-Pilot Button */}
      {!assistantOpen && (
        <button
          onClick={() => setAssistantOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-[#c89b3c] to-[#a07830] hover:from-[#d4a94a] hover:to-[#b08840] rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-40"
          data-testid="button-open-bi-copilot"
        >
          <Sparkles className="w-7 h-7 text-white" />
        </button>
      )}

      {/* AI Co-Pilot Panel */}
      <BiCoPilot 
        isOpen={assistantOpen} 
        onClose={() => setAssistantOpen(false)} 
        datasets={datasets.map((d: Dataset) => ({ id: d.id, name: d.name, tableName: d.tableName, description: d.description }))}
      />
    </BrowserFrame>
  );
}
