import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Server,
  Activity,
  Cpu,
  Database,
  RefreshCw,
  Play,
  Square,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Bot,
  Gauge,
  BarChart3,
  Zap,
  FileText,
  Calculator,
  ShoppingCart,
  Clock,
  Signal,
  HardDrive,
  Workflow,
  Users,
  Brain,
  Sparkles,
  Search,
  Code,
  Terminal,
  Globe,
  Shield,
  ArrowRight,
  Layers,
  Network,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface EngineStatus {
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

interface AgentStatus {
  name: string;
  running: boolean;
  processedTasks?: number;
  errorCount?: number;
}

interface EngineRoomData {
  engines: EngineStatus[];
  agents: AgentStatus[];
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

const ENGINE_ICONS: Record<string, any> = {
  "manus-ia": Brain,
  "plus": ShoppingCart,
  "contabil": Calculator,
  "fisco": FileText,
  "bi-engine": BarChart3,
  "automation-engine": Zap,
};

const CATEGORY_COLORS: Record<string, string> = {
  erp: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  fiscal: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  data: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  automation: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  intelligence: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const STATUS_CONFIG = {
  online: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", label: "Online" },
  offline: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Offline" },
  error: { icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/10", label: "Erro" },
};

function EngineCard({ engine, onClick }: { engine: EngineStatus; onClick?: () => void }) {
  const statusConf = STATUS_CONFIG[engine.status];
  const StatusIcon = statusConf.icon;
  const EngineIcon = ENGINE_ICONS[engine.name] || Server;
  const isClickable = !!onClick;

  return (
    <Card
      data-testid={`engine-card-${engine.name}`}
      className={`bg-[#1a1a2e] border-[#2a2a4a] hover:border-[#3a3a5a] transition-all ${isClickable ? "cursor-pointer hover:shadow-lg hover:shadow-violet-500/5 hover:border-violet-500/30" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${CATEGORY_COLORS[engine.category] || "bg-gray-500/10"}`}>
              <EngineIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">{engine.displayName}</h3>
              <p className="text-xs text-gray-400">{engine.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isClickable && (
              <Badge variant="outline" className="border-violet-500/30 text-violet-400 bg-violet-500/5 text-[10px]">
                Clique para detalhes
              </Badge>
            )}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${statusConf.bg}`}>
              <StatusIcon className={`w-3.5 h-3.5 ${statusConf.color}`} />
              <span className={`text-xs font-medium ${statusConf.color}`}>{statusConf.label}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center p-2 rounded bg-[#0d0d1a]">
            <p className="text-[10px] text-gray-500 uppercase">Tipo</p>
            <p className="text-xs font-medium text-gray-300">{engine.type.toUpperCase()}</p>
          </div>
          <div className="text-center p-2 rounded bg-[#0d0d1a]">
            <p className="text-[10px] text-gray-500 uppercase">Porta</p>
            <p className="text-xs font-medium text-gray-300">{engine.port}</p>
          </div>
          <div className="text-center p-2 rounded bg-[#0d0d1a]">
            <p className="text-[10px] text-gray-500 uppercase">Resposta</p>
            <p className="text-xs font-medium text-gray-300">
              {engine.responseTime ? `${engine.responseTime}ms` : "---"}
            </p>
          </div>
        </div>

        {engine.details && engine.status === "online" && (
          <div className="mt-3 p-2 rounded bg-[#0d0d1a] border border-[#1a1a3a]">
            <p className="text-[10px] text-gray-500 uppercase mb-1">Detalhes</p>
            {engine.details.version && (
              <p className="text-xs text-gray-400">Versao: <span className="text-gray-300">{engine.details.version}</span></p>
            )}
            {engine.details.database && (
              <p className="text-xs text-gray-400">DB: <span className={engine.details.database === "connected" ? "text-green-400" : "text-red-400"}>{engine.details.database}</span></p>
            )}
            {engine.details.cache && (
              <p className="text-xs text-gray-400">Cache: <span className="text-gray-300">{engine.details.cache.entries} entradas, {engine.details.cache.hit_rate}% hit</span></p>
            )}
            {engine.details.scheduler && (
              <p className="text-xs text-gray-400">Scheduler: <span className={engine.details.scheduler.is_running ? "text-green-400" : "text-gray-500"}>{engine.details.scheduler.is_running ? "Ativo" : "Parado"}</span> ({engine.details.scheduler.active_entries} entradas)</p>
            )}
            {engine.details.workflows && engine.details.workflows.total_workflows !== undefined && (
              <p className="text-xs text-gray-400">Workflows: <span className="text-gray-300">{engine.details.workflows.total_workflows} registrados, {engine.details.workflows.total_executions} execucoes</span></p>
            )}
          </div>
        )}

        {engine.error && (
          <div className="mt-3 p-2 rounded bg-red-500/5 border border-red-500/10">
            <p className="text-xs text-red-400">{engine.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ManusStructurePanel({ open, onOpenChange, metrics }: { open: boolean; onOpenChange: (open: boolean) => void; metrics: any }) {
  const AGENTS = [
    { name: "Architect", role: "Design & Arquitetura", icon: Layers, color: "text-blue-400", bg: "bg-blue-500/10" },
    { name: "Generator", role: "Geração de Código", icon: Code, color: "text-green-400", bg: "bg-green-500/10" },
    { name: "Validator", role: "Validação TypeScript", icon: Shield, color: "text-amber-400", bg: "bg-amber-500/10" },
    { name: "Executor", role: "Execução & Staging", icon: Terminal, color: "text-red-400", bg: "bg-red-500/10" },
    { name: "Researcher", role: "Pesquisa & Contexto", icon: Search, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { name: "Evolution", role: "Aprendizado Evolutivo", icon: Sparkles, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  const TOOL_CATEGORIES = [
    { name: "Busca Semântica", count: 8, icon: Search, color: "text-violet-400" },
    { name: "Leitura/Escrita de Arquivos", count: 12, icon: FileText, color: "text-blue-400" },
    { name: "Comandos Shell", count: 6, icon: Terminal, color: "text-green-400" },
    { name: "Web Research", count: 5, icon: Globe, color: "text-cyan-400" },
    { name: "Knowledge Graph", count: 8, icon: Network, color: "text-amber-400" },
    { name: "ERP & Database", count: 10, icon: Database, color: "text-emerald-400" },
    { name: "Análise de Código", count: 7, icon: Code, color: "text-pink-400" },
  ];

  const uptime = metrics?.metrics?.uptime
    ? `${Math.floor(metrics.metrics.uptime / 3600)}h ${Math.floor((metrics.metrics.uptime % 3600) / 60)}m`
    : "---";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-[#0d0d1a] border-[#2a2a4a] text-white overflow-hidden p-0">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-indigo-600/20 border-b border-violet-500/20 p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-600/30 border border-violet-500/30">
                <Brain className="w-7 h-7 text-violet-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">Manus IA - Cérebro Central</DialogTitle>
                <DialogDescription className="text-violet-300/80">
                  Arquitetura do motor de inteligência que alimenta todos os agentes
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="text-center p-3 rounded-lg bg-[#1a1a2e]/80 border border-[#2a2a4a]">
              <p className="text-2xl font-bold text-violet-400">{metrics?.model || "GPT-4o"}</p>
              <p className="text-[10px] text-gray-400 uppercase mt-1">Modelo</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-[#1a1a2e]/80 border border-[#2a2a4a]">
              <p className="text-2xl font-bold text-white">{metrics?.metrics?.totalCalls || 0}</p>
              <p className="text-[10px] text-gray-400 uppercase mt-1">Chamadas IA</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-[#1a1a2e]/80 border border-[#2a2a4a]">
              <p className="text-2xl font-bold text-emerald-400">{((metrics?.metrics?.totalTokens || 0) / 1000).toFixed(1)}k</p>
              <p className="text-[10px] text-gray-400 uppercase mt-1">Tokens</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-[#1a1a2e]/80 border border-[#2a2a4a]">
              <p className="text-2xl font-bold text-cyan-400">{uptime}</p>
              <p className="text-[10px] text-gray-400 uppercase mt-1">Uptime</p>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[calc(90vh-220px)]">
          <div className="p-6 space-y-6">

            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-400" />
                Arquitetura: Fluxo de Inteligência
              </h3>
              <div className="relative p-4 rounded-xl bg-[#1a1a2e] border border-[#2a2a4a]">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full p-3 rounded-lg bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Brain className="w-5 h-5 text-violet-400" />
                      <span className="text-sm font-bold text-violet-300">ManusIntelligence (Singleton)</span>
                    </div>
                    <p className="text-[10px] text-gray-400">GPT-4o + ToolManager + Context Enrichment</p>
                  </div>

                  <div className="flex items-center gap-1 text-gray-500">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                    <span className="text-[10px]">generate() / think()</span>
                    <ArrowRight className="w-4 h-4 rotate-90" />
                  </div>

                  <div className="w-full p-3 rounded-lg bg-[#0d0d1a] border border-[#1a1a3a] text-center">
                    <span className="text-xs font-medium text-amber-400">enrichWithContext()</span>
                    <p className="text-[10px] text-gray-500 mt-1">ToolManager.search_code → Contexto Semântico Automático</p>
                  </div>

                  <ArrowRight className="w-4 h-4 rotate-90 text-gray-500" />

                  <div className="grid grid-cols-3 gap-2 w-full">
                    {AGENTS.map((agent) => (
                      <div key={agent.name} className={`p-2.5 rounded-lg ${agent.bg} border border-[#2a2a4a] text-center`}>
                        <agent.icon className={`w-4 h-4 ${agent.color} mx-auto mb-1`} />
                        <p className={`text-xs font-semibold ${agent.color}`}>{agent.name}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">{agent.role}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Ferramentas Disponíveis ({metrics?.capabilities?.tools || 56})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {TOOL_CATEGORIES.map((cat) => (
                  <div key={cat.name} className="p-3 rounded-lg bg-[#1a1a2e] border border-[#2a2a4a] hover:border-[#3a3a5a] transition-all">
                    <div className="flex items-center gap-2 mb-1.5">
                      <cat.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                      <span className={`text-xs font-medium ${cat.color}`}>{cat.count}</span>
                    </div>
                    <p className="text-[10px] text-gray-400">{cat.name}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Capacidades Ativas
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { name: "Cérebro Central (GPT-4o)", active: true },
                  { name: "Enriquecimento de Contexto", active: true },
                  { name: "Busca Semântica de Código", active: true },
                  { name: "Knowledge Graph", active: true },
                  { name: "Pipeline Autônomo de Dev", active: true },
                  { name: "Orquestração de 6 Agentes", active: true },
                  { name: "Leitura/Escrita de Arquivos", active: true },
                  { name: "Execução de Comandos Shell", active: true },
                  { name: "Web Research", active: true },
                  { name: "Análise de Código", active: true },
                  { name: "Validação TypeScript", active: true },
                  { name: "Memória Evolutiva", active: true },
                ].map((cap) => (
                  <div key={cap.name} className="flex items-center gap-2 p-2 rounded-lg bg-[#1a1a2e] border border-[#2a2a4a]">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-xs text-gray-300">{cap.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {metrics?.metrics?.errorCount > 0 && (
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-medium text-red-400">Erros Registrados</span>
                </div>
                <p className="text-xs text-gray-400">
                  Total: <span className="text-red-400 font-medium">{metrics.metrics.errorCount}</span>
                  {metrics.metrics.lastCallAt && (
                    <> | Última chamada: <span className="text-gray-300">{new Date(metrics.metrics.lastCallAt).toLocaleString("pt-BR")}</span></>
                  )}
                </p>
              </div>
            )}

            <div className="p-4 rounded-xl bg-[#1a1a2e] border border-[#2a2a4a]">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Network className="w-4 h-4 text-violet-400" />
                Diagrama de Fluxo
              </h3>
              <div className="font-mono text-[11px] text-gray-400 space-y-0.5 bg-[#0a0a15] p-4 rounded-lg border border-[#1a1a3a]">
                <p className="text-violet-400">{"┌──────────────────────────────────────────────────────────┐"}</p>
                <p className="text-violet-400">{"│         MANUS INTELLIGENCE  (Singleton GPT-4o)           │"}</p>
                <p className="text-violet-400">{"├──────────────────────────────────────────────────────────┤"}</p>
                <p>{"│  .generate(prompt)  →  enrichWithContext()  →  OpenAI   │"}</p>
                <p>{"│  .think(prompt)     →  enrichWithContext()  →  OpenAI   │"}</p>
                <p>{"│  .getMetrics()      →  calls, tokens, errors, uptime   │"}</p>
                <p className="text-violet-400">{"├──────────────────────────────────────────────────────────┤"}</p>
                <p className="text-amber-400">{"│  ToolManager.executeTool('search_code', query)          │"}</p>
                <p className="text-amber-400">{"│  → Contexto semântico injetado automaticamente          │"}</p>
                <p className="text-violet-400">{"├──────────────────────────────────────────────────────────┤"}</p>
                <p className="text-blue-400">{"│  Architect  ──────┐                                     │"}</p>
                <p className="text-green-400">{"│  Generator  ──────┤                                     │"}</p>
                <p className="text-amber-400">{"│  Validator  ──────┤── Todos via manusIntelligence ──►   │"}</p>
                <p className="text-red-400">{"│  Executor   ──────┤                                     │"}</p>
                <p className="text-cyan-400">{"│  Researcher ──────┤                                     │"}</p>
                <p className="text-purple-400">{"│  Evolution  ──────┘                                     │"}</p>
                <p className="text-violet-400">{"├──────────────────────────────────────────────────────────┤"}</p>
                <p className="text-emerald-400">{"│  /api/manus/health  →  Status, métricas, capacidades   │"}</p>
                <p className="text-violet-400">{"└──────────────────────────────────────────────────────────┘"}</p>
              </div>
            </div>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function AgentCard({ agent }: { agent: AgentStatus }) {
  return (
    <div data-testid={`agent-card-${agent.name}`} className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a2e] border border-[#2a2a4a]">
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${agent.running ? "bg-green-500/10" : "bg-gray-500/10"}`}>
          <Bot className={`w-4 h-4 ${agent.running ? "text-green-400" : "text-gray-500"}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-white capitalize">{agent.name}</p>
          <p className="text-xs text-gray-500">Agente XOS</p>
        </div>
      </div>
      <Badge variant="outline" className={agent.running ? "border-green-500/30 text-green-400 bg-green-500/5" : "border-gray-600 text-gray-400 bg-gray-500/5"}>
        {agent.running ? "Ativo" : "Parado"}
      </Badge>
    </div>
  );
}

function SummaryCards({ summary }: { summary: EngineRoomData["summary"] }) {
  const cards = [
    { label: "Motores Online", value: `${summary.online_engines}/${summary.total_engines}`, icon: Server, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Saude Geral", value: `${summary.health_pct}%`, icon: Activity, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Agentes Ativos", value: `${summary.running_agents}/${summary.total_agents}`, icon: Bot, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Motores Offline", value: `${summary.offline_engines}`, icon: XCircle, color: summary.offline_engines > 0 ? "text-red-400" : "text-gray-500", bg: summary.offline_engines > 0 ? "bg-red-500/10" : "bg-gray-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {cards.map((card, i) => (
        <Card key={i} data-testid={`summary-card-${i}`} className="bg-[#1a1a2e] border-[#2a2a4a]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-xs text-gray-400">{card.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function EngineRoom() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [manusOpen, setManusOpen] = useState(false);

  const { data, isLoading, isRefetching } = useQuery<EngineRoomData>({
    queryKey: ["/api/engine-room/status"],
    refetchInterval: 15000,
  });

  const { data: biMetrics } = useQuery<any>({
    queryKey: ["/api/bi-engine/metrics"],
    enabled: activeTab === "bi",
    refetchInterval: 10000,
  });

  const { data: autoMetrics } = useQuery<any>({
    queryKey: ["/api/automation-engine/metrics"],
    enabled: activeTab === "automation",
    refetchInterval: 10000,
  });

  const { data: manusMetrics } = useQuery<any>({
    queryKey: ["/api/manus/health"],
    enabled: activeTab === "manus" || manusOpen,
    refetchInterval: 10000,
  });

  const { data: llmHealth } = useQuery<{ providers: Record<string, boolean>; timestamp: string }>({
    queryKey: ["/api/llm/health"],
    enabled: activeTab === "manus",
    refetchInterval: 30000,
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

  const content = (
    <div className="min-h-screen bg-[#0d0d1a] text-white">
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
              <Cpu className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-engine-room-title">Casa de Maquinas</h1>
              <p className="text-sm text-gray-400">Painel de controle de todos os motores e agentes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <span className="text-xs text-gray-500">
                Atualizado: {new Date(data.timestamp).toLocaleTimeString("pt-BR")}
              </span>
            )}
            <Button
              data-testid="button-refresh"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefetching}
              className="border-[#2a2a4a] text-gray-300 hover:bg-[#1a1a2e]"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : data ? (
          <>
            <SummaryCards summary={data.summary} />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-[#1a1a2e] border border-[#2a2a4a] mb-4">
                <TabsTrigger value="overview" data-testid="tab-overview" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
                  <Server className="w-4 h-4 mr-1.5" /> Visao Geral
                </TabsTrigger>
                <TabsTrigger value="bi" data-testid="tab-bi" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
                  <BarChart3 className="w-4 h-4 mr-1.5" /> Motor BI
                </TabsTrigger>
                <TabsTrigger value="automation" data-testid="tab-automation" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400">
                  <Zap className="w-4 h-4 mr-1.5" /> Motor Automacao
                </TabsTrigger>
                <TabsTrigger value="manus" data-testid="tab-manus" className="data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-400">
                  <Brain className="w-4 h-4 mr-1.5" /> Manus IA
                </TabsTrigger>
                <TabsTrigger value="agents" data-testid="tab-agents" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                  <Bot className="w-4 h-4 mr-1.5" /> Agentes XOS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.engines.map((engine) => (
                    <EngineCard
                      key={engine.name}
                      engine={engine}
                      onClick={engine.name === "manus-ia" ? () => setManusOpen(true) : undefined}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="bi">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.engines.filter(e => e.name === "bi-engine").map(e => (
                    <EngineCard key={e.name} engine={e} />
                  ))}
                  {biMetrics && (
                    <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-emerald-400" /> Metricas do Motor BI
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {biMetrics.cache && (
                          <div className="p-3 rounded bg-[#0d0d1a] border border-[#1a1a3a]">
                            <p className="text-xs text-gray-500 uppercase mb-2">Cache</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-center">
                                <p className="text-lg font-bold text-white">{biMetrics.cache.entries}</p>
                                <p className="text-[10px] text-gray-500">Entradas</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-emerald-400">{biMetrics.cache.hit_rate}%</p>
                                <p className="text-[10px] text-gray-500">Hit Rate</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-white">{biMetrics.cache.hits + biMetrics.cache.misses}</p>
                                <p className="text-[10px] text-gray-500">Requisicoes</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {biMetrics.limits && (
                          <div className="p-3 rounded bg-[#0d0d1a] border border-[#1a1a3a]">
                            <p className="text-xs text-gray-500 uppercase mb-2">Limites</p>
                            <p className="text-xs text-gray-400">Max linhas: <span className="text-gray-300">{biMetrics.limits.max_rows?.toLocaleString()}</span></p>
                            <p className="text-xs text-gray-400">Timeout: <span className="text-gray-300">{biMetrics.limits.query_timeout_ms?.toLocaleString()}ms</span></p>
                            <p className="text-xs text-gray-400">Cache TTL: <span className="text-gray-300">{biMetrics.limits.cache_ttl_seconds}s</span></p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
                <div className="mt-4 p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a4a]">
                  <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Signal className="w-4 h-4 text-emerald-400" /> Capacidades do Motor BI
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {["SQL Query (read-only)", "Chart Data Generation", "Micro-BI API", "Data Analysis (Pandas)", "Aggregation Engine", "Query Cache"].map(cap => (
                      <div key={cap} className="flex items-center gap-2 p-2 rounded bg-[#0d0d1a]">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs text-gray-300">{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="automation">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.engines.filter(e => e.name === "automation-engine").map(e => (
                    <EngineCard key={e.name} engine={e} />
                  ))}
                  {autoMetrics && (
                    <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-purple-400" /> Metricas do Motor Automacao
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {autoMetrics.scheduler && (
                          <div className="p-3 rounded bg-[#0d0d1a] border border-[#1a1a3a]">
                            <p className="text-xs text-gray-500 uppercase mb-2">Scheduler</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-center">
                                <p className="text-lg font-bold text-white">{autoMetrics.scheduler.total_entries}</p>
                                <p className="text-[10px] text-gray-500">Entradas</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-white">{autoMetrics.scheduler.active_entries}</p>
                                <p className="text-[10px] text-gray-500">Ativas</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-lg font-bold ${autoMetrics.scheduler.is_running ? "text-green-400" : "text-gray-500"}`}>
                                  {autoMetrics.scheduler.is_running ? "ON" : "OFF"}
                                </p>
                                <p className="text-[10px] text-gray-500">Status</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {autoMetrics.event_bus && (
                          <div className="p-3 rounded bg-[#0d0d1a] border border-[#1a1a3a]">
                            <p className="text-xs text-gray-500 uppercase mb-2">Event Bus</p>
                            <p className="text-xs text-gray-400">Tipos de evento: <span className="text-gray-300">{autoMetrics.event_bus.total_event_types}</span></p>
                            <p className="text-xs text-gray-400">Subscribers: <span className="text-gray-300">{autoMetrics.event_bus.total_subscribers}</span></p>
                            <p className="text-xs text-gray-400">Historico: <span className="text-gray-300">{autoMetrics.event_bus.history_size} eventos</span></p>
                          </div>
                        )}
                        {autoMetrics.workflows && (
                          <div className="p-3 rounded bg-[#0d0d1a] border border-[#1a1a3a]">
                            <p className="text-xs text-gray-500 uppercase mb-2">Workflows</p>
                            <p className="text-xs text-gray-400">Registrados: <span className="text-gray-300">{autoMetrics.workflows.total_workflows}</span></p>
                            <p className="text-xs text-gray-400">Execucoes: <span className="text-gray-300">{autoMetrics.workflows.total_executions}</span></p>
                            <p className="text-xs text-gray-400">Taxa sucesso: <span className="text-emerald-400">{autoMetrics.workflows.success_rate}%</span></p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
                <div className="mt-4 p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a4a]">
                  <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-purple-400" /> Capacidades do Motor Automacao
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {["Cron Scheduler", "Event Bus", "Workflow Executor", "HTTP Actions", "SQL Queries (read-only)", "Transform & Filter"].map(cap => (
                      <div key={cap} className="flex items-center gap-2 p-2 rounded bg-[#0d0d1a]">
                        <CheckCircle className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs text-gray-300">{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="manus">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.engines.filter(e => e.name === "manus-ia").map(e => (
                    <EngineCard key={e.name} engine={e} onClick={() => setManusOpen(true)} />
                  ))}
                  <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-violet-400" /> Metricas do Manus IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {manusMetrics ? (
                        <>
                          <div className="p-3 rounded bg-[#0d0d1a] border border-[#1a1a3a]">
                            <p className="text-xs text-gray-500 uppercase mb-2">Modelo & Performance</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-center">
                                <p className="text-lg font-bold text-violet-400">{manusMetrics.model || "GPT-4o"}</p>
                                <p className="text-[10px] text-gray-500">Modelo</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-white">{manusMetrics.metrics?.totalCalls || 0}</p>
                                <p className="text-[10px] text-gray-500">Chamadas IA</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-emerald-400">{((manusMetrics.metrics?.totalTokens || 0) / 1000).toFixed(1)}k</p>
                                <p className="text-[10px] text-gray-500">Tokens</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 rounded bg-[#0d0d1a] border border-[#1a1a3a]">
                            <p className="text-xs text-gray-500 uppercase mb-2">Capacidades Ativas</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-white">{manusMetrics.capabilities?.tools || 56}</span>
                                <span className="text-xs text-gray-400">Ferramentas</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-white">{manusMetrics.capabilities?.agents || 0}</span>
                                <span className="text-xs text-gray-400">Agentes Ativos</span>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 rounded bg-[#0d0d1a] border border-[#1a1a3a]">
                            <p className="text-xs text-gray-500 uppercase mb-2">Uptime</p>
                            <p className="text-sm text-gray-300">
                              {manusMetrics.metrics?.uptime 
                                ? `${Math.floor(manusMetrics.metrics.uptime / 3600)}h ${Math.floor((manusMetrics.metrics.uptime % 3600) / 60)}m`
                                : "---"}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          <p className="text-xs">Carregando metricas...</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
                {/* Cascata LLM */}
                <div className="mt-4 p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a4a]">
                  <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-violet-400" /> Cascata de LLM
                    <span className="ml-auto text-[10px] text-gray-500">Claude → Gemini → Ollama</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        key: "anthropic",
                        label: "Claude Sonnet",
                        sub: "Anthropic — Primário",
                        tier: "1º",
                        color: "violet",
                        task: "manus:chat · manus:analysis",
                      },
                      {
                        key: "gemini",
                        label: "Gemini Pro",
                        sub: "Google — Fallback",
                        tier: "2º",
                        color: "blue",
                        task: "Se Claude indisponível",
                      },
                      {
                        key: "ollama",
                        label: "Qwen Coder",
                        sub: "Ollama — Último recurso",
                        tier: "3º",
                        color: "emerald",
                        task: "Local · zero custo",
                      },
                    ].map((p) => {
                      const healthy = llmHealth?.providers?.[p.key];
                      const colorMap: Record<string, string> = {
                        violet: "border-violet-500/30 bg-violet-500/5",
                        blue: "border-blue-500/30 bg-blue-500/5",
                        emerald: "border-emerald-500/30 bg-emerald-500/5",
                      };
                      const dotMap: Record<string, string> = {
                        violet: "bg-violet-400",
                        blue: "bg-blue-400",
                        emerald: "bg-emerald-400",
                      };
                      return (
                        <div
                          key={p.key}
                          data-testid={`llm-provider-${p.key}`}
                          className={`p-3 rounded-lg border ${colorMap[p.color]} flex flex-col gap-2`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">{p.tier} tier</span>
                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${healthy ? "bg-emerald-500/15" : llmHealth ? "bg-red-500/15" : "bg-gray-500/15"}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${healthy ? "bg-emerald-400 animate-pulse" : llmHealth ? "bg-red-400" : "bg-gray-500"}`} />
                              <span className={`text-[9px] font-medium ${healthy ? "text-emerald-400" : llmHealth ? "text-red-400" : "text-gray-500"}`}>
                                {llmHealth ? (healthy ? "Online" : "Offline") : "..."}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white">{p.label}</p>
                            <p className="text-[10px] text-gray-500">{p.sub}</p>
                          </div>
                          <p className="text-[10px] text-gray-600 border-t border-white/5 pt-1.5">{p.task}</p>
                        </div>
                      );
                    })}
                  </div>
                  {llmHealth && (
                    <p className="text-[10px] text-gray-600 mt-2 text-right">
                      Atualizado: {new Date(llmHealth.timestamp).toLocaleTimeString("pt-BR")}
                    </p>
                  )}
                  {llmHealth && !llmHealth.providers?.anthropic && !llmHealth.providers?.gemini && (
                    <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-300">
                        Nenhum provider disponível. Configure <span className="font-mono">ANTHROPIC_API_KEY</span> e/ou <span className="font-mono">GEMINI_API_KEY</span> nos Secrets do projeto.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a4a]">
                  <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-violet-400" /> Capacidades do Manus IA
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {["Claude Sonnet (Primário)", "56 Ferramentas Integradas", "Knowledge Graph", "Busca Semantica", "Pipeline de Dev Autonomo", "Orquestrador de Agentes", "Leitura/Escrita de Arquivos", "Execucao de Comandos", "Web Research", "Analise de Codigo", "Validacao TypeScript", "Memoria Evolutiva"].map(cap => (
                      <div key={cap} className="flex items-center gap-2 p-2 rounded bg-[#0d0d1a]">
                        <CheckCircle className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="text-xs text-gray-300">{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="agents">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-cyan-400" /> Agentes Autonomos XOS
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      data-testid="button-start-agents"
                      variant="outline"
                      size="sm"
                      onClick={handleStartAgents}
                      className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" /> Iniciar Todos
                    </Button>
                    <Button
                      data-testid="button-stop-agents"
                      variant="outline"
                      size="sm"
                      onClick={handleStopAgents}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Square className="w-3.5 h-3.5 mr-1" /> Parar Todos
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.agents.length > 0 ? (
                    data.agents.map((agent) => (
                      <AgentCard key={agent.name} agent={agent} />
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8 text-gray-500">
                      <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum agente registrado</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a4a]">
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-amber-400" /> Arquitetura dos Motores
              </h3>
              <div className="font-mono text-xs text-gray-400 space-y-1 bg-[#0d0d1a] p-4 rounded-lg border border-[#1a1a3a]">
                <p className="text-amber-400">{"┌─────────────────────────────────────────────────────┐"}</p>
                <p className="text-amber-400">{"│            ARCADIA SUITE - CASA DE MAQUINAS          │"}</p>
                <p className="text-amber-400">{"├─────────────────────────────────────────────────────┤"}</p>
                <p>{"│  Express.js (5000)  ─── Orquestracao + API Gateway  │"}</p>
                <p className="text-amber-400">{"├─────────────────────────────────────────────────────┤"}</p>
                <p className="text-violet-400 font-bold">{"│  Manus IA  (5000)   ─── GPT-4o + 56 Tools (Cerebro)│"}</p>
                <p className="text-amber-400">{"├─────────────────────────────────────────────────────┤"}</p>
                <p className="text-blue-400">{"│  Plus ERP (8080)    ─── Laravel/PHP - ERP Completo  │"}</p>
                <p className="text-amber-300">{"│  Contabil  (8003)   ─── FastAPI - DRE/Balancete     │"}</p>
                <p className="text-amber-300">{"│  Fiscal    (8002)   ─── FastAPI - NF-e/SEFAZ        │"}</p>
                <p className="text-emerald-400">{"│  BI Engine (8004)   ─── FastAPI - SQL/Charts/Cache  │"}</p>
                <p className="text-purple-400">{"│  Automacao (8005)   ─── FastAPI - Scheduler/Events  │"}</p>
                <p className="text-amber-400">{"├─────────────────────────────────────────────────────┤"}</p>
                <p className="text-cyan-400">{"│  XOS Agents         ─── 6 Agentes via ManusIntel.   │"}</p>
                <p className="text-amber-400">{"└─────────────────────────────────────────────────────┘"}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nao foi possivel carregar o status dos motores</p>
          </div>
        )}

        <ManusStructurePanel open={manusOpen} onOpenChange={setManusOpen} metrics={manusMetrics} />
      </div>
    </div>
  );

  return (
    <BrowserFrame>
      <ScrollArea className="h-full">
        {content}
      </ScrollArea>
    </BrowserFrame>
  );
}
