import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Code,
  Brain,
  Wrench,
  Shield,
  Rocket,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Filter,
  BarChart3,
  GitBranch,
  Eye,
  Layers,
  Play,
} from "lucide-react";

interface TimelineEntry {
  id: number;
  agent: string;
  action: string;
  thought: string;
  observation?: string;
  createdAt: string;
}

interface SubtaskEntry {
  id: number;
  title: string;
  status: string;
  assignedAgent: string;
  startedAt?: string;
  completedAt?: string;
}

interface ArtifactEntry {
  id: number;
  type: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

interface HistoryTask {
  id: number;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  assignedAgent?: string;
  userId?: string;
  result?: any;
  errorMessage?: string;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  subtaskCount: number;
  artifactCount: number;
  logCount: number;
  subtasks: SubtaskEntry[];
  artifacts: ArtifactEntry[];
  timeline: TimelineEntry[];
}

const AGENT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  architect: { label: "Arquiteto", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Brain },
  generator: { label: "Gerador", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Code },
  validator: { label: "Validador", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Shield },
  executor: { label: "Executor", color: "bg-green-100 text-green-700 border-green-200", icon: Rocket },
  evolution: { label: "Evolução", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: TrendingUp },
  dispatcher: { label: "Dispatcher", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Layers },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendente", color: "bg-slate-100 text-slate-600", icon: Clock },
  in_progress: { label: "Em Progresso", color: "bg-blue-100 text-blue-600", icon: Loader2 },
  completed: { label: "Concluída", color: "bg-green-100 text-green-600", icon: CheckCircle },
  failed: { label: "Falhou", color: "bg-red-100 text-red-600", icon: XCircle },
  blocked: { label: "Bloqueada", color: "bg-orange-100 text-orange-600", icon: AlertCircle },
};

const ARTIFACT_ICONS: Record<string, any> = {
  spec: FileText,
  code: Code,
  test: Shield,
  doc: FileText,
  config: Wrench,
  analysis: BarChart3,
};

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(start?: string, end?: string) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}min`;
}

function TaskCard({ task, onContinueTask }: { task: HistoryTask; onContinueTask?: (title: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<"timeline" | "subtasks" | "artifacts">("timeline");

  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const duration = formatDuration(task.startedAt || task.createdAt, task.completedAt);

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md" data-testid={`history-task-${task.id}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="shrink-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusCfg.color}`}>
            <StatusIcon className="h-4 w-4" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{task.title}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">#{task.id}</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{task.description}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          {duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {duration}
            </span>
          )}
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" /> {task.subtaskCount}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" /> {task.artifactCount}
          </span>
          <span className="text-[10px]">{formatDate(task.createdAt)}</span>
          {onContinueTask && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2 ml-1 border-purple-300 text-purple-600 hover:bg-purple-50"
              onClick={(e) => {
                e.stopPropagation();
                onContinueTask(task.title);
              }}
              data-testid={`btn-continue-task-${task.id}`}
            >
              <Play className="h-3 w-3 mr-1" /> Continuar
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t">
          {task.errorMessage && (
            <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <strong>Erro:</strong> {task.errorMessage}
            </div>
          )}

          <div className="flex border-b mx-4 mt-2">
            {[
              { key: "timeline" as const, label: "Timeline", count: task.logCount },
              { key: "subtasks" as const, label: "Subtarefas", count: task.subtaskCount },
              { key: "artifacts" as const, label: "Artefatos", count: task.artifactCount },
            ].map(tab => (
              <button
                key={tab.key}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeSection === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveSection(tab.key)}
                data-testid={`tab-${tab.key}-${task.id}`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeSection === "timeline" && (
              <div className="space-y-1">
                {task.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro na timeline</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                    {task.timeline.map((entry, idx) => {
                      const agentCfg = AGENT_CONFIG[entry.agent] || AGENT_CONFIG.dispatcher;
                      const AgentIcon = agentCfg.icon;
                      return (
                        <div key={entry.id || idx} className="relative pl-10 pb-3">
                          <div className={`absolute left-2 top-1 w-5 h-5 rounded-full flex items-center justify-center border ${agentCfg.color}`}>
                            <AgentIcon className="h-2.5 w-2.5" />
                          </div>
                          <div className="bg-muted/30 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-[10px] ${agentCfg.color}`}>
                                  {agentCfg.label}
                                </Badge>
                                <span className="text-[10px] font-medium text-muted-foreground uppercase">{entry.action}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{formatDate(entry.createdAt)}</span>
                            </div>
                            <p className="text-xs text-foreground">{entry.thought}</p>
                            {entry.observation && (
                              <p className="text-[11px] text-muted-foreground mt-1 italic border-l-2 border-muted pl-2">
                                {entry.observation.length > 200 ? entry.observation.slice(0, 200) + "…" : entry.observation}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeSection === "subtasks" && (
              <div className="space-y-2">
                {task.subtasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma subtarefa</p>
                ) : (
                  task.subtasks.map(sub => {
                    const subStatus = STATUS_CONFIG[sub.status] || STATUS_CONFIG.pending;
                    const SubIcon = subStatus.icon;
                    const agentCfg = AGENT_CONFIG[sub.assignedAgent] || AGENT_CONFIG.dispatcher;
                    const AgentIcon = agentCfg.icon;
                    const subDuration = formatDuration(sub.startedAt, sub.completedAt);
                    return (
                      <div key={sub.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className={`w-7 h-7 rounded flex items-center justify-center ${subStatus.color}`}>
                          <SubIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sub.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className={`text-[10px] ${agentCfg.color}`}>
                              <AgentIcon className="h-2.5 w-2.5 mr-1" />
                              {agentCfg.label}
                            </Badge>
                            {subDuration && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" /> {subDuration}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge className={`text-[10px] ${subStatus.color}`}>{subStatus.label}</Badge>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeSection === "artifacts" && (
              <div className="space-y-2">
                {task.artifacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum artefato gerado</p>
                ) : (
                  task.artifacts.map(art => {
                    const ArtIcon = ARTIFACT_ICONS[art.type] || FileText;
                    const agentCfg = AGENT_CONFIG[art.createdBy] || AGENT_CONFIG.dispatcher;
                    return (
                      <div key={art.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                          <ArtIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{art.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px]">{art.type}</Badge>
                            <Badge variant="outline" className={`text-[10px] ${agentCfg.color}`}>
                              {agentCfg.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{formatDate(art.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

interface DevHistoryProps {
  embedded?: boolean;
  onContinueTask?: (taskTitle: string) => void;
}

export default function DevHistory({ embedded, onContinueTask }: DevHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["/api/blackboard/history", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", pageSize.toString());
      params.set("offset", (page * pageSize).toString());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/blackboard/history?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar histórico");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["/api/blackboard/stats"],
    queryFn: async () => {
      const res = await fetch("/api/blackboard/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar stats");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const tasks: HistoryTask[] = historyData?.tasks || [];
  const stats = statsData?.stats;
  const agents = statsData?.agents || [];

  return (
    <div className={`space-y-4 ${embedded ? "" : "p-4"}`} data-testid="dev-history">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats?.totalTasks || 0, color: "text-foreground", bgColor: "bg-muted/50" },
          { label: "Pendentes", value: stats?.pendingTasks || 0, color: "text-amber-600", bgColor: "bg-amber-50" },
          { label: "Concluídas", value: stats?.completedTasks || 0, color: "text-green-600", bgColor: "bg-green-50" },
          { label: "Falhas", value: stats?.failedTasks || 0, color: "text-red-600", bgColor: "bg-red-50" },
          { label: "Artefatos", value: stats?.artifactsCount || 0, color: "text-blue-600", bgColor: "bg-blue-50" },
        ].map(stat => (
          <Card key={stat.label} className={`${stat.bgColor}`}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agentes Status */}
      {agents.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Agentes:</span>
          {agents.map((agent: any) => {
            const cfg = AGENT_CONFIG[agent.name] || AGENT_CONFIG.dispatcher;
            return (
              <Badge key={agent.name} variant="outline" className={`text-[10px] ${cfg.color}`}>
                <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${agent.running ? "bg-green-500" : "bg-slate-400"}`} />
                {cfg.label}
                {agent.tasksProcessed > 0 && ` (${agent.tasksProcessed})`}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Filtros e ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {[
            { key: "all", label: "Todas" },
            { key: "completed", label: "Concluídas" },
            { key: "failed", label: "Falhas" },
            { key: "in_progress", label: "Em Progresso" },
            { key: "pending", label: "Pendentes" },
          ].map(f => (
            <Button
              key={f.key}
              variant={statusFilter === f.key ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setStatusFilter(f.key); setPage(0); }}
              data-testid={`filter-${f.key}`}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} data-testid="btn-refresh-history">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Lista de Tarefas */}
      <ScrollArea className={embedded ? "h-[calc(100vh-380px)]" : "h-[calc(100vh-300px)]"}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Carregando histórico...</span>
          </div>
        ) : tasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Eye className="h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="font-semibold text-lg mb-1">Nenhuma tarefa encontrada</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                As tarefas executadas pelos agentes autônomos aparecerão aqui com todos os detalhes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 pr-2">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} onContinueTask={onContinueTask} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Pagination */}
      {(historyData?.total || 0) > pageSize && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, historyData?.total || 0)} de {historyData?.total || 0}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              data-testid="btn-prev-page"
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={(page + 1) * pageSize >= (historyData?.total || 0)}
              onClick={() => setPage(p => p + 1)}
              data-testid="btn-next-page"
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
