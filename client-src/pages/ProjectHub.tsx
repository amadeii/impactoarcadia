/**
 * Arcádia Project Hub — Lista de Projetos
 * Sprint HUB-01 + Edit + ClientePicker
 */
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  FolderKanban, Plus, Search, MoreVertical, Pencil,
  TrendingUp, Calendar, Users, AlertTriangle,
  CheckCircle2, Clock, PauseCircle, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FavorecidoPicker } from "@/components/control/FavorecidoPicker";
import { QuickCreatePessoaDialog } from "@/components/control/QuickCreatePessoaDialog";

// ── Types ─────────────────────────────────────────────────────────────────────
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
  owner_id?: string;
  contract_value?: string;
  progress_pct: number;
  health_score: string;
  priority?: string;
  planned_start?: string;
  planned_end?: string;
  description?: string | null;
  location?: string | null;
  member_count?: number;
  created_at: string;
}

interface ProjectsResponse { data: Project[]; total: number; }

// ── Helpers visuais ───────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  geologia: "Geologia", ambiental: "Ambiental", civil: "Civil",
  consultoria: "Consultoria", industrial: "Industrial",
};
const TYPE_COLORS: Record<string, string> = {
  geologia:    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  ambiental:   "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  civil:       "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  consultoria: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  industrial:  "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};
const HEALTH_CONFIG = {
  verde:    { icon: CheckCircle2,  color: "text-green-500",  border: "border-l-green-500",  bg: "",                              label: "Saudável" },
  amarelo:  { icon: AlertTriangle, color: "text-yellow-500", border: "border-l-yellow-400", bg: "dark:bg-yellow-950/10",         label: "Atenção"  },
  vermelho: { icon: XCircle,       color: "text-red-500",    border: "border-l-red-500",    bg: "bg-red-50/40 dark:bg-red-950/20", label: "Crítico"  },
};
const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  rascunho:  { icon: Clock,        color: "text-gray-400",   label: "Rascunho"  },
  ativo:     { icon: TrendingUp,   color: "text-green-500",  label: "Ativo"     },
  pausado:   { icon: PauseCircle,  color: "text-yellow-500", label: "Pausado"   },
  concluido: { icon: CheckCircle2, color: "text-blue-500",   label: "Concluído" },
  cancelado: { icon: XCircle,      color: "text-red-500",    label: "Cancelado" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  baixa:   { label: "Baixa",   color: "text-gray-500",   dot: "bg-gray-400" },
  media:   { label: "Média",   color: "text-blue-600",   dot: "bg-blue-500" },
  alta:    { label: "Alta",    color: "text-amber-600",  dot: "bg-amber-500" },
  critica: { label: "Crítica", color: "text-red-600",    dot: "bg-red-500" },
};

const fmt = (v?: string | number | null) =>
  v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(v))
    : "—";

// ── Form state compartilhado ──────────────────────────────────────────────────
interface ProjectFormState {
  title: string;
  projectType: string;
  clienteId: string;
  clienteNome: string;
  contractValue: string;
  plannedStart: string;
  plannedEnd: string;
  description: string;
  location: string;
  status: string;
  priority: string;
}

const EMPTY_FORM: ProjectFormState = {
  title: "", projectType: "consultoria",
  clienteId: "", clienteNome: "",
  contractValue: "", plannedStart: "", plannedEnd: "",
  description: "", location: "", status: "rascunho",
  priority: "media",
};

// ── Formulário de Projeto ─────────────────────────────────────────────────────
function ProjectFormFields({
  form, onChange, isEdit, onQuickCreate,
}: {
  form: ProjectFormState;
  onChange: (f: ProjectFormState) => void;
  isEdit?: boolean;
  onQuickCreate: () => void;
}) {
  const set = (key: keyof ProjectFormState) => (val: string) =>
    onChange({ ...form, [key]: val });

  return (
    <div className="space-y-4 py-2">
      {/* Título */}
      <div>
        <Label className="mb-1.5 block">Título *</Label>
        <Input
          placeholder="Ex: Monitoramento Hidrogeológico — Fazenda Santa Cruz"
          value={form.title}
          onChange={e => set("title")(e.target.value)}
          data-testid="input-project-title"
        />
      </div>

      {/* Tipo + Prioridade + Status */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="mb-1.5 block">Tipo</Label>
          <Select value={form.projectType} onValueChange={set("projectType")}>
            <SelectTrigger data-testid="select-project-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">Prioridade</Label>
          <Select value={form.priority ?? "media"} onValueChange={set("priority")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_CONFIG).map(([v, c]) => (
                <SelectItem key={v} value={v}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isEdit && (
          <div>
            <Label className="mb-1.5 block">Status</Label>
            <Select value={form.status} onValueChange={set("status")}>
              <SelectTrigger data-testid="select-project-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                  <SelectItem key={v} value={v}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!isEdit && (
          <div>
            <Label className="mb-1.5 block">Valor do contrato</Label>
            <Input
              placeholder="R$ 0"
              value={form.contractValue}
              onChange={e => set("contractValue")(e.target.value)}
              data-testid="input-contract-value"
            />
          </div>
        )}
      </div>

      {/* Cliente via Pessoas */}
      <div>
        <Label className="mb-1.5 block">Cliente</Label>
        <FavorecidoPicker
          value={form.clienteId || undefined}
          label={form.clienteNome || undefined}
          placeholder="Buscar no cadastro de pessoas..."
          showQuickCreate
          onQuickCreate={onQuickCreate}
          onChange={(pessoaId, pessoa) => onChange({
            ...form,
            clienteId: pessoaId ?? "",
            clienteNome: pessoa?.nomeFantasia ?? "",
          })}
        />
        {form.clienteId && (
          <p className="text-xs text-muted-foreground mt-1">
            Vinculado ao cadastro de pessoas ✓
          </p>
        )}
      </div>

      {/* Valor do contrato (só no edit) */}
      {isEdit && (
        <div>
          <Label className="mb-1.5 block">Valor do contrato (R$)</Label>
          <Input
            placeholder="0.00"
            value={form.contractValue}
            onChange={e => set("contractValue")(e.target.value)}
            data-testid="input-contract-value"
          />
        </div>
      )}

      {/* Datas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Início planejado</Label>
          <Input type="date" value={form.plannedStart}
            onChange={e => set("plannedStart")(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1.5 block">Término planejado</Label>
          <Input type="date" value={form.plannedEnd}
            onChange={e => set("plannedEnd")(e.target.value)} />
        </div>
      </div>

      {/* Localização */}
      <div>
        <Label className="mb-1.5 block">Localização / Município</Label>
        <Input
          placeholder="Ex: Campinas – SP"
          value={form.location}
          onChange={e => set("location")(e.target.value)}
        />
      </div>

      {/* Descrição */}
      <div>
        <Label className="mb-1.5 block">Descrição</Label>
        <Textarea
          className="min-h-[80px] resize-none"
          placeholder="Escopo resumido do projeto..."
          value={form.description}
          onChange={e => set("description")(e.target.value)}
        />
      </div>
    </div>
  );
}

// ── Modal Criar Projeto ───────────────────────────────────────────────────────
function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<ProjectFormState>(EMPTY_FORM);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hub/projects", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hub/projects"] });
      toast({ title: "Projeto criado com sucesso" });
      onClose();
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast({ title: "Erro ao criar projeto", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    mutation.mutate({
      title: form.title,
      projectType: form.projectType,
      clienteId: form.clienteId || null,
      clienteNome: form.clienteNome || null,
      contractValue: form.contractValue
        ? parseFloat(form.contractValue.replace(/[^\d,.-]/g, "").replace(",", "."))
        : null,
      plannedStart: form.plannedStart || null,
      plannedEnd: form.plannedEnd || null,
      description: form.description || null,
      location: form.location || null,
      priority: form.priority || "media",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              Novo Projeto
            </DialogTitle>
          </DialogHeader>

          <ProjectFormFields
            form={form}
            onChange={setForm}
            onQuickCreate={() => setQuickCreateOpen(true)}
          />

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending || !form.title.trim()}
              data-testid="button-criar-projeto"
            >
              {mutation.isPending ? "Criando..." : "Criar projeto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickCreatePessoaDialog
        open={quickCreateOpen}
        onOpenChange={(v) => setQuickCreateOpen(v)}
        onCreated={(pessoa) => {
          setForm(f => ({
            ...f,
            clienteId: pessoa.id,
            clienteNome: pessoa.nomeFantasia ?? "",
          }));
          setQuickCreateOpen(false);
        }}
      />
    </>
  );
}

// ── Modal Editar Projeto ──────────────────────────────────────────────────────
function EditProjectDialog({
  project,
  open,
  onClose,
}: {
  project: Project;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const [form, setForm] = useState<ProjectFormState>(() => ({
    title: project.title,
    projectType: project.project_type,
    clienteId: project.cliente_id ?? "",
    clienteNome: project.cliente_externo_nome ?? project.cliente_nome ?? "",
    contractValue: project.contract_value ?? "",
    plannedStart: project.planned_start?.slice(0, 10) ?? "",
    plannedEnd: project.planned_end?.slice(0, 10) ?? "",
    description: project.description ?? "",
    location: project.location ?? "",
    status: project.status,
  }));

  // Re-sincroniza quando o projeto muda (re-abre)
  const resetForm = useCallback(() => {
    setForm({
      title: project.title,
      projectType: project.project_type,
      clienteId: project.cliente_id ?? "",
      clienteNome: project.cliente_externo_nome ?? project.cliente_nome ?? "",
      contractValue: project.contract_value ?? "",
      plannedStart: project.planned_start?.slice(0, 10) ?? "",
      plannedEnd: project.planned_end?.slice(0, 10) ?? "",
      description: project.description ?? "",
      location: project.location ?? "",
      status: project.status,
    });
  }, [project]);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/hub/projects/${project.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hub/projects"] });
      qc.invalidateQueries({ queryKey: [`/api/hub/projects/${project.id}`] });
      toast({ title: "Projeto atualizado" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    mutation.mutate({
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
    });
  };

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

          <ProjectFormFields
            form={form}
            onChange={setForm}
            isEdit
            onQuickCreate={() => setQuickCreateOpen(true)}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending || !form.title.trim()}
              data-testid="button-salvar-projeto"
            >
              {mutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickCreatePessoaDialog
        open={quickCreateOpen}
        onOpenChange={(v) => setQuickCreateOpen(v)}
        onCreated={(pessoa) => {
          setForm(f => ({
            ...f,
            clienteId: pessoa.id,
            clienteNome: pessoa.nomeFantasia ?? "",
          }));
          setQuickCreateOpen(false);
        }}
      />
    </>
  );
}

// ── Card de Projeto ───────────────────────────────────────────────────────────
function ProjectCard({
  project,
  onClick,
  onEdit,
}: {
  project: Project;
  onClick: () => void;
  onEdit: () => void;
}) {
  const health = HEALTH_CONFIG[project.health_score as keyof typeof HEALTH_CONFIG] ?? HEALTH_CONFIG.verde;
  const HealthIcon = health.icon;
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.ativo;
  const StatusIcon = status.icon;
  const cliente = project.cliente_externo_nome ?? project.cliente_nome ?? "—";

  return (
    <div className={cn(
      "group relative bg-card border border-l-[3px] rounded-lg p-5 hover:shadow-sm transition-all",
      health.border,
      health.bg,
    )}>
      {/* Botão de edição no hover */}
      <button
        onClick={e => { e.stopPropagation(); onEdit(); }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted"
        title="Editar projeto"
        data-testid={`button-edit-project-${project.id}`}
      >
        <MoreVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Conteúdo clicável */}
      <div onClick={onClick} className="cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3 pr-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{project.project_code}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[project.project_type] ?? ""}`}>
                {TYPE_LABELS[project.project_type] ?? project.project_type}
              </span>
              {/* Badge de prioridade do projeto (PROJ-01) */}
              {project.priority && project.priority !== "media" && (() => {
                const pc = PRIORITY_CONFIG[project.priority];
                return pc ? (
                  <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${pc.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                    {pc.label}
                  </span>
                ) : null;
              })()}
            </div>
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {project.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 truncate">{cliente}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            <div className={cn("flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full",
              project.health_score === "vermelho" ? "bg-red-100 dark:bg-red-900/40" :
              project.health_score === "amarelo"  ? "bg-yellow-100 dark:bg-yellow-900/40" : ""
            )}>
              <HealthIcon className={`h-3 w-3 ${health.color}`} />
              {project.health_score !== "verde" && (
                <span className={`text-[10px] font-medium ${health.color}`}>{health.label}</span>
              )}
            </div>
            <StatusIcon className={`h-4 w-4 ${status.color}`} />
          </div>
        </div>

        {/* Progresso */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Avanço</span>
            <span className="font-medium">{project.progress_pct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${project.progress_pct}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {project.contract_value && (
              <span className="font-medium text-foreground">{fmt(project.contract_value)}</span>
            )}
            {project.planned_end && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(project.planned_end).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          {project.member_count != null && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {project.member_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ProjectHub() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (typeFilter !== "all") params.set("projectType", typeFilter);

  const { data, isLoading } = useQuery<ProjectsResponse>({
    queryKey: ["/api/hub/projects", search, statusFilter, typeFilter],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects?${params.toString()}`).then(r => r.json()),
  });

  const projects = data?.data ?? [];
  const total = data?.total ?? 0;

  const ativos   = projects.filter(p => p.status === "ativo").length;
  const criticos = projects.filter(p => p.health_score === "vermelho").length;
  const atencao  = projects.filter(p => p.health_score === "amarelo").length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Project Hub</h1>
              <p className="text-sm text-muted-foreground">{total} projeto{total !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-novo-projeto">
            <Plus className="h-4 w-4 mr-2" /> Novo Projeto
          </Button>
        </div>

        {/* KPIs */}
        <div className="flex gap-4 mb-4">
          <div className="text-sm">
            <span className="font-semibold text-green-600">{ativos}</span>
            <span className="text-muted-foreground ml-1">ativos</span>
          </div>
          {atencao > 0 && (
            <div className="text-sm">
              <span className="font-semibold text-yellow-600">{atencao}</span>
              <span className="text-muted-foreground ml-1">em atenção</span>
            </div>
          )}
          {criticos > 0 && (
            <div className="text-sm">
              <span className="font-semibold text-red-600">{criticos}</span>
              <span className="text-muted-foreground ml-1">críticos</span>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar projeto, código ou cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search-projects"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                <SelectItem key={v} value={v}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de projetos */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">Nenhum projeto encontrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search || statusFilter !== "all" || typeFilter !== "all"
                ? "Tente ajustar os filtros"
                : "Crie o primeiro projeto do Hub"}
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo Projeto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => navigate(`/hub/${p.id}`)}
                onEdit={() => setEditProject(p)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {editProject && (
        <EditProjectDialog
          project={editProject}
          open={!!editProject}
          onClose={() => setEditProject(null)}
        />
      )}
    </div>
  );
}
