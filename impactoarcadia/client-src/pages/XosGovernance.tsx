import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import {
  Shield, Activity, AlertTriangle, CheckCircle, XCircle, Clock,
  Cpu, Wrench, BookOpen, FileText, BarChart3, RefreshCw,
  Layers, Eye, Play, Pause, ChevronRight, Zap, TrendingUp,
  Users, Database, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DashboardData {
  governance: {
    totalContracts: number;
    totalTools: number;
    totalSkills: number;
    totalPolicies: number;
    totalAuditEntries: number;
    recentDenials: number;
  };
  jobs: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
    total: number;
  };
  agents: Array<{
    agent: string;
    totalCompleted: number;
    totalFailed: number;
    avgDuration: number;
  }>;
  recentAudit: Array<{
    id: number;
    agentName: string;
    action: string;
    target: string;
    decision: string;
    justification: string;
    createdAt: string;
    policyId: number | null;
  }>;
  policies: Array<{
    id: number;
    name: string;
    scope: string;
    target: string;
    effect: string;
    priority: number;
    description: string;
    isActive: boolean;
  }>;
  skills: Array<{
    id: number;
    name: string;
    version: string;
    description: string;
    usageCount: number;
    successRate: number;
    status: string;
    createdBy: string;
    createdAt: string;
  }>;
}

interface Tool {
  id: number;
  name: string;
  category: string;
  description: string;
  version: string;
  isActive: boolean;
  registeredAt: string;
}

interface Job {
  id: number;
  type: string;
  priority: number;
  status: string;
  assignedAgent: string | null;
  payload: any;
  result: any;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: string;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function DecisionBadge({ decision }: { decision: string }) {
  const variants: Record<string, { color: string; icon: any }> = {
    allowed: { color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle },
    executed: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Play },
    denied: { color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
    logged: { color: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: Eye },
  };
  const v = variants[decision] || variants.logged;
  const Icon = v.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${v.color}`} data-testid={`badge-decision-${decision}`}>
      <Icon className="w-3 h-3" />
      {decision}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    dead_letter: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${colors[status] || colors.pending}`} data-testid={`badge-status-${status}`}>
      {status}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, subtitle, trend }: {
  title: string;
  value: number | string;
  icon: any;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="bg-[#1a1a2e] border-[#2a2a4a]" data-testid={`stat-card-${title}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${trend === "down" ? "bg-red-500/10" : "bg-indigo-500/10"}`}>
            <Icon className={`w-5 h-5 ${trend === "down" ? "text-red-400" : "text-indigo-400"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function XosGovernance() {
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/governance/dashboard"],
    refetchInterval: 15000,
  });

  const { data: tools = [] } = useQuery<Tool[]>({
    queryKey: ["/api/governance/tools"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/governance/jobs"],
    refetchInterval: 10000,
  });

  const { data: agentsData } = useQuery<{ success: boolean; agents: Array<{ name: string; running: boolean; capabilities: string[] }> }>({
    queryKey: ["/api/blackboard/agents"],
  });
  const agentsStatus = agentsData?.agents || [];

  const gov = dashboard?.governance;
  const jobStats = dashboard?.jobs;

  const content = (
    <div className="min-h-screen bg-[#0f0f23] text-white">
      <div className="border-b border-[#2a2a4a] bg-[#1a1a2e]/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-indigo-400" />
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-page-title">XOS Governance</h1>
              <p className="text-xs text-gray-400">Camada de governança autônoma do Arcádia Suite</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-green-500/30 text-green-400" data-testid="badge-status-online">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
              Online
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="border-[#2a2a4a] text-gray-300 hover:bg-[#2a2a4a]"
              onClick={() => queryClient.invalidateQueries()}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 pt-4">
        <TabsList className="bg-[#1a1a2e] border border-[#2a2a4a] mb-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="policies" data-testid="tab-policies">Políticas</TabsTrigger>
          <TabsTrigger value="tools" data-testid="tab-tools">Ferramentas</TabsTrigger>
          <TabsTrigger value="skills" data-testid="tab-skills">Skills</TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">Job Queue</TabsTrigger>
          <TabsTrigger value="agents" data-testid="tab-agents">Agentes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Políticas" value={gov?.totalPolicies || 0} icon={Shield} subtitle="Regras ativas" />
            <StatCard title="Ferramentas" value={gov?.totalTools || 0} icon={Wrench} subtitle="Registradas" />
            <StatCard title="Skills" value={gov?.totalSkills || 0} icon={BookOpen} subtitle="Auto-criadas" />
            <StatCard title="Audit Entries" value={gov?.totalAuditEntries || 0} icon={FileText} subtitle="Total registrado" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Jobs Pendentes" value={jobStats?.pending || 0} icon={Clock} subtitle="Na fila" />
            <StatCard title="Processando" value={jobStats?.processing || 0} icon={Cpu} subtitle="Em execução" />
            <StatCard title="Concluídos" value={jobStats?.completed || 0} icon={CheckCircle} subtitle="Total" trend="up" />
            <StatCard title="Bloqueios 24h" value={gov?.recentDenials || 0} icon={AlertTriangle} subtitle="Ações negadas" trend={gov?.recentDenials ? "down" : "neutral"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Atividade Recente
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto">
                <div className="space-y-2">
                  {(dashboard?.recentAudit || []).slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-2 rounded-lg bg-[#0f0f23]/50 hover:bg-[#0f0f23]" data-testid={`audit-entry-${entry.id}`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <DecisionBadge decision={entry.decision} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white truncate">{entry.action}</p>
                          <p className="text-xs text-gray-500 truncate">{entry.agentName} • {entry.target?.slice(0, 40)}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{formatDate(entry.createdAt)}</span>
                    </div>
                  ))}
                  {(!dashboard?.recentAudit || dashboard.recentAudit.length === 0) && (
                    <p className="text-sm text-gray-500 text-center py-4">Nenhuma atividade registrada</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Performance dos Agentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(dashboard?.agents || []).map((agent) => (
                    <div key={agent.agent} className="p-3 rounded-lg bg-[#0f0f23]/50" data-testid={`agent-metric-${agent.agent}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white capitalize">{agent.agent}</span>
                        <span className="text-xs text-gray-400">{agent.avgDuration}ms avg</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-green-400">{agent.totalCompleted}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-red-400" />
                          <span className="text-xs text-red-400">{agent.totalFailed}</span>
                        </div>
                        <div className="flex-1 bg-[#2a2a4a] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-indigo-500 rounded-full"
                            style={{
                              width: `${agent.totalCompleted + agent.totalFailed > 0
                                ? (agent.totalCompleted / (agent.totalCompleted + agent.totalFailed)) * 100
                                : 0}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!dashboard?.agents || dashboard.agents.length === 0) && (
                    <p className="text-sm text-gray-500 text-center py-4">Nenhuma métrica registrada ainda</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-300">Trilha de Auditoria Completa</CardTitle>
              <CardDescription className="text-xs text-gray-500">Registro imutável de todas as ações do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {(dashboard?.recentAudit || []).map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[100px_80px_1fr_1fr_150px] gap-2 items-center p-2 rounded hover:bg-[#0f0f23]/50 text-xs" data-testid={`audit-row-${entry.id}`}>
                    <span className="text-gray-400 font-mono">#{entry.id}</span>
                    <DecisionBadge decision={entry.decision} />
                    <div className="min-w-0">
                      <span className="text-white truncate block">{entry.agentName}</span>
                      <span className="text-gray-500 truncate block">{entry.action}</span>
                    </div>
                    <span className="text-gray-400 truncate">{entry.target?.slice(0, 50) || "-"}</span>
                    <span className="text-gray-500 text-right">{formatDate(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <div className="grid gap-3">
            {(dashboard?.policies || []).map((policy) => (
              <Card key={policy.id} className="bg-[#1a1a2e] border-[#2a2a4a]" data-testid={`policy-card-${policy.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${policy.effect === "deny" ? "bg-red-500/10" : "bg-green-500/10"}`}>
                        <Shield className={`w-4 h-4 ${policy.effect === "deny" ? "text-red-400" : "text-green-400"}`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-white">{policy.name}</h3>
                        <p className="text-xs text-gray-400 mt-1">{policy.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs border-[#2a2a4a] text-gray-400">
                            {policy.scope}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-[#2a2a4a] text-gray-400">
                            target: {policy.target}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-[#2a2a4a] text-gray-400">
                            prioridade: {policy.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Badge className={policy.effect === "deny" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}>
                      {policy.effect}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tools.map((tool) => (
              <Card key={tool.id} className="bg-[#1a1a2e] border-[#2a2a4a]" data-testid={`tool-card-${tool.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Wrench className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">{tool.name}</h3>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{tool.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs border-[#2a2a4a] text-gray-400">
                          v{tool.version}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${tool.isActive ? "border-green-500/20 text-green-400" : "border-red-500/20 text-red-400"}`}>
                          {tool.isActive ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="skills" className="space-y-4">
          {(dashboard?.skills || []).length === 0 ? (
            <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
              <CardContent className="p-8 text-center">
                <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-300">Nenhuma skill criada ainda</h3>
                <p className="text-xs text-gray-500 mt-1">O EvolutionAgent criará skills automaticamente à medida que padrões forem detectados</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {(dashboard?.skills || []).map((skill) => (
                <Card key={skill.id} className="bg-[#1a1a2e] border-[#2a2a4a]" data-testid={`skill-card-${skill.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Zap className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-white">{skill.name}</h3>
                          <p className="text-xs text-gray-400 mt-1">{skill.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-gray-500">Uso: {skill.usageCount || 0}x</span>
                            <span className="text-xs text-gray-500">Taxa: {skill.successRate || 0}%</span>
                            <span className="text-xs text-gray-500">Por: {skill.createdBy}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs border-[#2a2a4a] text-gray-400">
                        v{skill.version}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <StatCard title="Pendentes" value={jobStats?.pending || 0} icon={Clock} />
            <StatCard title="Processando" value={jobStats?.processing || 0} icon={Cpu} />
            <StatCard title="Concluídos" value={jobStats?.completed || 0} icon={CheckCircle} trend="up" />
            <StatCard title="Falhos" value={jobStats?.failed || 0} icon={XCircle} trend={jobStats?.failed ? "down" : "neutral"} />
            <StatCard title="Dead Letter" value={jobStats?.deadLetter || 0} icon={AlertTriangle} trend={jobStats?.deadLetter ? "down" : "neutral"} />
          </div>

          <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-300">Fila de Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum job na fila</p>
              ) : (
                <div className="space-y-1">
                  {jobs.map((job) => (
                    <div key={job.id} className="grid grid-cols-[60px_100px_80px_1fr_100px_120px] gap-2 items-center p-2 rounded hover:bg-[#0f0f23]/50 text-xs" data-testid={`job-row-${job.id}`}>
                      <span className="text-gray-400 font-mono">#{job.id}</span>
                      <span className="text-white truncate">{job.type}</span>
                      <StatusBadge status={job.status} />
                      <span className="text-gray-400 truncate">{job.assignedAgent || "-"}</span>
                      <span className="text-gray-500">{job.attempts}/{job.maxAttempts}</span>
                      <span className="text-gray-500 text-right">{formatDate(job.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agentsStatus.map((agent, idx) => (
              <Card key={idx} className="bg-[#1a1a2e] border-[#2a2a4a]" data-testid={`agent-card-${idx}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${agent.running ? "bg-green-500/10" : "bg-gray-500/10"}`}>
                        <Cpu className={`w-4 h-4 ${agent.running ? "text-green-400" : "text-gray-400"}`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-white">{agent.name}</h3>
                      </div>
                    </div>
                    <Badge className={agent.running ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}>
                      {agent.running ? "Ativo" : "Parado"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map((cap, i) => (
                      <Badge key={i} variant="outline" className="text-xs border-[#2a2a4a] text-gray-400">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  return <BrowserFrame>{content}</BrowserFrame>;
}
