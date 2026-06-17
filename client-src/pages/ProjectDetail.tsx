/**
 * Arcádia Project Hub — Detalhe do Projeto
 * Sprint HUB-01: Header + abas (stubs — preenchidas nos sprints HUB-02 a HUB-09)
 */
import { useState, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, MoreVertical, CheckCircle2, XCircle,
  TrendingUp, Clock, PauseCircle, Pencil,
  Home, LayoutList, Kanban, DollarSign, FileText,
  MapPin, BarChart2, Timer, Receipt, History, Users,
  AlertTriangle, ChevronRight, Flag, CalendarDays, FileBarChart,
} from "lucide-react";
import { FavorecidoPicker } from "@/components/control/FavorecidoPicker";
import { QuickCreatePessoaDialog } from "@/components/control/QuickCreatePessoaDialog";
import { ViewWBS } from "./hub/ViewWBS";
import { ViewKanban } from "./hub/ViewKanban";
import { ViewOrcamento } from "./hub/ViewOrcamento";
import { ViewFaturamento } from "./hub/ViewFaturamento";
import { ViewTimesheet } from "./hub/ViewTimesheet";
import { ViewFinanceiro } from "./hub/ViewFinanceiro";
import { ViewField } from "./hub/ViewField";
import { ViewFiscal } from "./hub/ViewFiscal";
import { ViewHistorico } from "./hub/ViewHistorico";
import { ViewCalendario } from "./hub/ViewCalendario";
import { ViewRelatorios } from "./hub/ViewRelatorios";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface Project {
  id: string;
  project_code: string;
  title: string;
  project_type: string;
  status: string;
  etapa: string;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  cliente_externo_nome?: string | null;
  contract_value?: string;
  progress_pct: number;
  health_score: string;
  planned_start?: string;
  planned_end?: string;
  description?: string | null;
  location?: string | null;
  owner_id?: string;
  members?: any[];
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "home",        label: "Home",        icon: Home        },
  { id: "calendario",  label: "Calendário",  icon: CalendarDays },
  { id: "wbs",         label: "WBS",         icon: LayoutList  },
  { id: "kanban",      label: "Kanban",      icon: Kanban      },
  { id: "orcamento",   label: "Orçamento",   icon: DollarSign  },
  { id: "contrato",    label: "Faturamento", icon: FileText    },
  { id: "timesheet",   label: "Timesheet",   icon: Timer       },
  { id: "financeiro",  label: "Financeiro",  icon: BarChart2   },
  { id: "field",       label: "Field",       icon: MapPin      },
  { id: "fiscal",      label: "Fiscal",      icon: Receipt     },
  { id: "relatorios",  label: "Relatórios",  icon: FileBarChart },
  { id: "historico",   label: "Histórico",   icon: History     },
  { id: "membros",     label: "Membros",     icon: Users       },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const HEALTH_CONFIG = {
  verde:    { icon: CheckCircle2,  color: "text-green-500",  bg: "bg-green-50 dark:bg-green-950",  label: "Saudável"  },
  amarelo:  { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950", label: "Atenção"   },
  vermelho: { icon: XCircle,       color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950",       label: "Crítico"   },
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho", ativo: "Ativo", pausado: "Pausado",
  concluido: "Concluído", cancelado: "Cancelado",
};

const ETAPA_LABELS: Record<string, string> = {
  planejamento: "Planejamento", em_execucao: "Em Execução",
  monitoramento: "Monitoramento", encerramento: "Encerramento", concluido: "Concluído",
};

const TYPE_LABELS: Record<string, string> = {
  geologia: "Geologia", ambiental: "Ambiental", civil: "Civil",
  consultoria: "Consultoria", industrial: "Industrial",
};

const TYPE_COLORS_SMALL: Record<string, string> = {
  geologia:    "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  ambiental:   "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
  civil:       "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  consultoria: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200",
  industrial:  "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
};

const fmt = (v?: string | number | null) =>
  v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(v))
    : null;

// ── View Home ─────────────────────────────────────────────────────────────────
function ViewHome({ project }: { project: Project }) {
  const { data: overdueTasks = [] } = useQuery<any[]>({
    queryKey: [`/api/hub/projects/${project.id}/tasks`, "overdue"],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${project.id}/tasks?overdue=true`)
        .then(r => r.json()),
  });

  const { data: upcomingTasks = [] } = useQuery<any[]>({
    queryKey: [`/api/hub/projects/${project.id}/tasks`, "upcoming"],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${project.id}/tasks?status=todo&status=doing`)
        .then(r => r.json()),
  });

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }) : null;

  const PRIORITY_COLORS: Record<string, string> = {
    critica: "text-red-600 bg-red-50 dark:bg-red-950/30",
    alta:    "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
    media:   "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
    baixa:   "text-gray-500 bg-gray-50 dark:bg-gray-900/30",
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avanço físico</p>
          <p className="text-2xl font-bold">{project.progress_pct}%</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Contrato</p>
          <p className="text-2xl font-bold">{fmt(project.contract_value) ?? "—"}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Início</p>
          <p className="text-lg font-semibold">
            {project.planned_start
              ? new Date(project.planned_start).toLocaleDateString("pt-BR")
              : "—"}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Término</p>
          <p className="text-lg font-semibold">
            {project.planned_end
              ? new Date(project.planned_end).toLocaleDateString("pt-BR")
              : "—"}
          </p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Progresso do projeto</span>
          <span className="text-muted-foreground">{project.progress_pct}% concluído</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              project.health_score === "vermelho" ? "bg-red-500" :
              project.health_score === "amarelo"  ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${project.progress_pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Etapa: <span className="font-medium text-foreground">{ETAPA_LABELS[project.etapa] ?? project.etapa}</span>
        </p>
      </div>

      {/* ── WIDGET: Tarefas atrasadas (ALERT-01) ── */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-200 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-red-700 dark:text-red-300">
              {overdueTasks.length} tarefa{overdueTasks.length !== 1 ? "s" : ""} em atraso
            </span>
          </div>
          <div className="divide-y divide-red-100 dark:divide-red-900/40">
            {overdueTasks.slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className={cn(
                  "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0",
                  PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.media
                )}>
                  {task.priority}
                </div>
                <span className="flex-1 text-sm truncate text-red-900 dark:text-red-200">
                  {task.title}
                </span>
                {task.assignee_name && (
                  <span className="text-xs text-red-500 flex-shrink-0 hidden sm:block">
                    {task.assignee_name}
                  </span>
                )}
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex-shrink-0 tabular-nums">
                  +{task.days_overdue}d
                </span>
              </div>
            ))}
            {overdueTasks.length > 5 && (
              <div className="px-4 py-2 text-xs text-red-500 text-center">
                + {overdueTasks.length - 5} outras tarefas atrasadas — veja o Kanban
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Próximas tarefas pendentes ── */}
      {upcomingTasks.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Em execução · {upcomingTasks.filter(t => t.status === "doing").length} em andamento
            </span>
          </div>
          <div className="divide-y">
            {upcomingTasks
              .filter(t => t.due_date)
              .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
              .slice(0, 5)
              .map(task => {
                const dueDate = task.due_date ? new Date(task.due_date) : null;
                const today = new Date();
                const daysLeft = dueDate
                  ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                const urgent = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      task.status === "doing" ? "bg-teal-500" : "bg-blue-500"
                    )} />
                    <span className="flex-1 text-sm truncate">{task.title}</span>
                    {task.assignee_name && (
                      <span className="text-xs text-muted-foreground hidden sm:block flex-shrink-0">
                        {task.assignee_name}
                      </span>
                    )}
                    {dueDate && (
                      <span className={cn(
                        "text-xs flex-shrink-0 tabular-nums",
                        urgent ? "text-amber-600 font-semibold" : "text-muted-foreground"
                      )}>
                        {urgent && daysLeft === 0 ? "hoje" :
                         urgent ? `${daysLeft}d` : fmtDate(task.due_date)}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── View Membros ──────────────────────────────────────────────────────────────
function ViewMembros({ project }: { project: Project }) {
  const members = project.members ?? [];
  const ROLE_LABELS: Record<string, string> = {
    pm: "PM", tecnico: "Técnico", financeiro: "Financeiro",
    cliente: "Cliente", observador: "Observador",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{members.length} membro{members.length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="outline">
          <Users className="h-4 w-4 mr-2" /> Adicionar membro
        </Button>
      </div>
      {members.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Nenhum membro cadastrado ainda</div>
      ) : (
        <div className="bg-card border rounded-lg divide-y">
          {members.map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 p-4">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {(m.user_name ?? m.user_id ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{m.user_name ?? m.user_id}</p>
                <p className="text-xs text-muted-foreground">
                  {m.cost_rate ? `R$ ${Number(m.cost_rate).toFixed(0)}/h custo` : ""}
                  {m.billing_rate ? ` · R$ ${Number(m.billing_rate).toFixed(0)}/h faturável` : ""}
                </p>
              </div>
              <Badge variant="secondary">{ROLE_LABELS[m.role] ?? m.role}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stub para sprints futuros ─────────────────────────────────────────────────
function ViewStub({ tabLabel, sprint }: { tabLabel: string; sprint: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Clock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium mb-1">{tabLabel}</h3>
      <p className="text-sm text-muted-foreground mb-3">Implementado no sprint {sprint}</p>
      <Badge variant="outline">{sprint}</Badge>
    </div>
  );
}

// ── STATUS / TYPE maps para o select do dialog ────────────────────────────────
const STATUS_CONFIG_EDIT: Record<string, string> = {
  rascunho: "Rascunho", ativo: "Ativo", pausado: "Pausado",
  concluido: "Concluído", cancelado: "Cancelado",
};
const TYPE_LABELS_EDIT: Record<string, string> = {
  geologia: "Geologia", ambiental: "Ambiental", civil: "Civil",
  consultoria: "Consultoria", industrial: "Industrial",
};

// ── Dialog de edição inline ───────────────────────────────────────────────────
function EditDialog({
  project,
  open,
  onClose,
  onSaved,
}: {
  project: Project;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [quickCreate, setQuickCreate] = useState(false);
  const [form, setForm] = useState({
    title: project.title,
    projectType: project.project_type,
    status: project.status,
    clienteId: project.cliente_id ?? "",
    clienteNome: project.cliente_externo_nome ?? project.cliente_nome ?? "",
    contractValue: project.contract_value ?? "",
    plannedStart: project.planned_start?.slice(0, 10) ?? "",
    plannedEnd: project.planned_end?.slice(0, 10) ?? "",
    description: project.description ?? "",
    location: project.location ?? "",
  });

  const resetForm = useCallback(() => {
    setForm({
      title: project.title,
      projectType: project.project_type,
      status: project.status,
      clienteId: project.cliente_id ?? "",
      clienteNome: project.cliente_externo_nome ?? project.cliente_nome ?? "",
      contractValue: project.contract_value ?? "",
      plannedStart: project.planned_start?.slice(0, 10) ?? "",
      plannedEnd: project.planned_end?.slice(0, 10) ?? "",
      description: project.description ?? "",
      location: project.location ?? "",
    });
  }, [project]);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/hub/projects/${project.id}`, data),
    onSuccess: () => {
      toast({ title: "Projeto atualizado" });
      onSaved();
      onClose();
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) { resetForm(); onClose(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Projeto — <span className="font-mono text-sm">{project.project_code}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Título */}
            <div>
              <Label className="mb-1.5 block">Título *</Label>
              <Input value={form.title} onChange={e => set("title")(e.target.value)}
                placeholder="Título do projeto" data-testid="edit-project-title" />
            </div>

            {/* Tipo + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Tipo</Label>
                <Select value={form.projectType} onValueChange={set("projectType")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS_EDIT).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Status</Label>
                <Select value={form.status} onValueChange={set("status")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG_EDIT).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cliente via Pessoas */}
            <div>
              <Label className="mb-1.5 block">Cliente</Label>
              <FavorecidoPicker
                value={form.clienteId || undefined}
                label={form.clienteNome || undefined}
                placeholder="Buscar no cadastro de pessoas..."
                showQuickCreate
                onQuickCreate={() => setQuickCreate(true)}
                onChange={(pessoaId, pessoa) => setForm(f => ({
                  ...f,
                  clienteId: pessoaId ?? "",
                  clienteNome: pessoa?.nomeFantasia ?? "",
                }))}
              />
              {form.clienteId && (
                <p className="text-xs text-muted-foreground mt-1">Vinculado ao cadastro de pessoas ✓</p>
              )}
            </div>

            {/* Valor do contrato */}
            <div>
              <Label className="mb-1.5 block">Valor do contrato (R$)</Label>
              <Input value={form.contractValue} onChange={e => set("contractValue")(e.target.value)}
                placeholder="0.00" />
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Início planejado</Label>
                <Input type="date" value={form.plannedStart} onChange={e => set("plannedStart")(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">Término planejado</Label>
                <Input type="date" value={form.plannedEnd} onChange={e => set("plannedEnd")(e.target.value)} />
              </div>
            </div>

            {/* Localização */}
            <div>
              <Label className="mb-1.5 block">Localização</Label>
              <Input value={form.location} onChange={e => set("location")(e.target.value)}
                placeholder="Ex: Campinas – SP" />
            </div>

            {/* Descrição */}
            <div>
              <Label className="mb-1.5 block">Descrição</Label>
              <Textarea className="min-h-[80px] resize-none"
                value={form.description} onChange={e => set("description")(e.target.value)}
                placeholder="Escopo resumido do projeto..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</Button>
            <Button
              onClick={() => mutation.mutate({
                title: form.title,
                projectType: form.projectType,
                status: form.status,
                clienteId: form.clienteId || null,
                clienteNome: form.clienteNome || null,
                clienteExternoNome: form.clienteNome || null,
                contractValue: form.contractValue
                  ? parseFloat(form.contractValue.toString().replace(/[^\d,.-]/g, "").replace(",", "."))
                  : null,
                plannedStart: form.plannedStart || null,
                plannedEnd: form.plannedEnd || null,
                description: form.description || null,
                location: form.location || null,
              })}
              disabled={mutation.isPending || !form.title.trim()}
              data-testid="button-salvar-projeto-detail"
            >
              {mutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickCreatePessoaDialog
        open={quickCreate}
        onOpenChange={(v) => setQuickCreate(v)}
        onCreated={(pessoa) => {
          setForm(f => ({ ...f, clienteId: pessoa.id, clienteNome: pessoa.nomeFantasia ?? "" }));
          setQuickCreate(false);
        }}
      />
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/hub/:id");
  const projectId = params?.id;
  const [activeTab, setActiveTab] = useState("home");
  const [editOpen, setEditOpen] = useState(false);
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: [`/api/hub/projects/${projectId}`],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}`).then(r => r.json()),
    enabled: !!projectId,
  });

  const patchMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/hub/projects/${projectId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}`] }),
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Carregando projeto...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Projeto não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/hub")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Hub
        </Button>
      </div>
    );
  }

  const health = HEALTH_CONFIG[project.health_score as keyof typeof HEALTH_CONFIG] ?? HEALTH_CONFIG.verde;
  const HealthIcon = health.icon;
  const cliente = project.cliente_externo_nome ?? project.cliente_nome;

  const renderTabContent = () => {
    switch (activeTab) {
      case "home":       return <ViewHome project={project} />;
      case "membros":    return <ViewMembros project={project} />;
      case "calendario": return <ViewCalendario projectId={project.id} project={project} />;
      case "wbs":        return <ViewWBS projectId={project.id} projectType={project.project_type} />;
      case "kanban":    return <ViewKanban projectId={project.id} />;
      case "orcamento": return <ViewOrcamento projectId={project.id} />;
      case "contrato":  return <ViewFaturamento projectId={project.id} />;
      case "timesheet":  return <ViewTimesheet projectId={project.id} />;
      case "financeiro": return <ViewFinanceiro projectId={project.id} />;
      case "field":     return <ViewField projectId={project.id} projectType={project.project_type} />;
      case "fiscal":     return <ViewFiscal projectId={project.id} />;
      case "relatorios": return <ViewRelatorios projectId={project.id} />;
      case "historico":  return <ViewHistorico projectId={project.id} />;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* ── Linha 1: breadcrumb + ações — tudo numa linha ── */}
      <div className="border-b px-4 py-2 flex items-center gap-2 bg-background min-h-0">
        <button
          onClick={() => navigate("/hub")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Projetos
        </button>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <span className="font-mono text-xs text-muted-foreground flex-shrink-0">{project.project_code}</span>
        <span className="text-muted-foreground/40 text-xs">/</span>
        {/* Tipo + etapa + health inline */}
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${TYPE_COLORS_SMALL[project.project_type] ?? "bg-muted text-muted-foreground"}`}>
          {TYPE_LABELS[project.project_type] ?? project.project_type}
        </span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {ETAPA_LABELS[project.etapa] ?? project.etapa}
        </span>
        <div className={cn("flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full flex-shrink-0", health.bg)}>
          <HealthIcon className={cn("h-2.5 w-2.5", health.color)} />
          <span className={cn("text-xs", health.color)}>{health.label}</span>
        </div>
        <div className="flex-1" />
        {/* Ações compactas */}
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
          onClick={() => patchMutation.mutate({ status: project.status === "ativo" ? "pausado" : "ativo" })}>
          {project.status === "ativo"
            ? <><PauseCircle className="h-3.5 w-3.5 mr-1" /> Pausar</>
            : <><TrendingUp className="h-3.5 w-3.5 mr-1" /> Ativar</>
          }
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar projeto
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => patchMutation.mutate({ status: "concluido" })}>
              Marcar como concluído
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => patchMutation.mutate({ status: "cancelado" })}
              className="text-destructive">
              Cancelar projeto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Linha 2: título + cliente + progresso ── */}
      <div className="border-b px-4 pt-3 pb-0 bg-background">
        <div className="flex items-baseline gap-3 mb-2">
          <h1 className="text-lg font-bold leading-tight truncate flex-1">{project.title}</h1>
          {cliente && (
            <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">· {cliente}</span>
          )}
          {project.contract_value && (
            <span className="text-sm font-semibold flex-shrink-0">{fmt(project.contract_value)}</span>
          )}
        </div>

        {/* Progresso integrado */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                project.health_score === "vermelho" ? "bg-red-500" :
                project.health_score === "amarelo"  ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${project.progress_pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{project.progress_pct}%</span>
        </div>

        {/* ── Linha 3: abas ── */}
        <div className="flex gap-0 overflow-x-auto scrollbar-hide -mx-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                  "border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo da aba */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderTabContent()}
      </div>

      {/* Dialog de edição */}
      {editOpen && (
        <EditDialog
          project={project}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}`] })}
        />
      )}
    </div>
  );
}
