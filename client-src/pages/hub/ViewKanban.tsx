/**
 * Arcádia Project Hub — Aba Kanban
 * Sprint HUB-02: Board por status, drag visual sem lib externa
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Clock, AlertTriangle, CheckCircle2,
  Calendar, User, Tag, CheckSquare, MoreHorizontal, Link,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee_name?: string;
  estimated_hours?: number;
  actual_hours?: number;
  due_date?: string;
  wbs_title?: string;
  wbs_code?: string;
  tags?: string[];
  checklist?: { id: string; text: string; done: boolean }[];
  order_index: number;
}

// ── Configs ──────────────────────────────────────────────────────────────────
const COLUMNS: { id: string; label: string; color: string; bg: string; headerBg: string }[] = [
  { id: "backlog",  label: "Backlog",      color: "text-gray-600 dark:text-gray-400",  bg: "bg-gray-100/80 dark:bg-gray-900/40",    headerBg: "bg-gray-200/80 dark:bg-gray-800/60" },
  { id: "todo",     label: "A fazer",      color: "text-blue-700 dark:text-blue-400",  bg: "bg-blue-50/80 dark:bg-blue-950/40",     headerBg: "bg-blue-100/80 dark:bg-blue-900/50" },
  { id: "doing",    label: "Em andamento", color: "text-teal-700 dark:text-teal-400",  bg: "bg-teal-50/80 dark:bg-teal-950/40",     headerBg: "bg-teal-100/80 dark:bg-teal-900/50" },
  { id: "review",   label: "Revisão",      color: "text-amber-700 dark:text-amber-400",bg: "bg-amber-50/80 dark:bg-amber-950/40",   headerBg: "bg-amber-100/80 dark:bg-amber-900/50" },
  { id: "done",     label: "Concluído",    color: "text-green-700 dark:text-green-400",bg: "bg-green-50/80 dark:bg-green-950/40",   headerBg: "bg-green-100/80 dark:bg-green-900/50" },
  { id: "blocked",  label: "Bloqueado",    color: "text-red-700 dark:text-red-400",    bg: "bg-red-50/80 dark:bg-red-950/40",       headerBg: "bg-red-100/80 dark:bg-red-900/50" },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
  baixa:   { label: "Baixa",   color: "text-gray-500",  border: "border-l-gray-300 dark:border-l-gray-600",   bg: "bg-gray-50/50 dark:bg-gray-900/10"   },
  media:   { label: "Média",   color: "text-blue-600",  border: "border-l-blue-400 dark:border-l-blue-500",   bg: "bg-blue-50/30 dark:bg-blue-900/10"   },
  alta:    { label: "Alta",    color: "text-amber-600", border: "border-l-amber-400 dark:border-l-amber-500", bg: "bg-amber-50/30 dark:bg-amber-900/10" },
  critica: { label: "Crítica", color: "text-red-600",   border: "border-l-red-500 dark:border-l-red-600",     bg: "bg-red-50/30 dark:bg-red-900/10"     },
};

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }) : null;

const isOverdue = (d?: string) =>
  d ? new Date(d) < new Date() : false;

// ── Card de tarefa ────────────────────────────────────────────────────────────
function TaskCard({
  task, onDragStart, onClick,
}: {
  task: Task;
  onDragStart: (taskId: string) => void;
  onClick: (task: Task) => void;
}) {
  const pConf = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.media;
  const overdue = isOverdue(task.due_date) && task.status !== "done";
  const checkTotal = task.checklist?.length ?? 0;
  const checkDone = task.checklist?.filter(c => c.done).length ?? 0;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      onClick={() => onClick(task)}
      className={cn(
        "bg-card border border-l-[3px] rounded-lg p-3 cursor-grab active:cursor-grabbing",
        "hover:shadow-sm transition-all select-none",
        pConf.border,
        pConf.bg,
        task.status === "blocked" && "border-red-200 dark:border-red-900",
      )}
    >
      {/* Badge de prioridade + WBS + dias de atraso — linha topo */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
          task.priority === "critica" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
          task.priority === "alta"    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" :
          task.priority === "media"   ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
          "bg-muted text-muted-foreground"
        )}>
          {pConf.label}
        </span>
        <div className="flex items-center gap-1.5">
          {/* Badge de dependências bloqueantes (DEP-01) */}
          {(task as any).open_dependencies > 0 && (
            <span className="text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 px-1.5 py-0.5 rounded flex items-center gap-0.5"
              title={`${(task as any).open_dependencies} dependência(s) não concluída(s)`}>
              <Link className="h-2.5 w-2.5" />
              {(task as any).open_dependencies}
            </span>
          )}
          {/* Badge de atraso (ALERT-01) */}
          {(task as any).days_overdue > 0 && (
            <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              +{(task as any).days_overdue}d
            </span>
          )}
          {task.wbs_code && (
            <span className="text-[10px] text-muted-foreground font-mono">{task.wbs_code}</span>
          )}
        </div>
      </div>

      {/* Título */}
      <p className={cn(
        "text-sm font-semibold leading-snug mb-2",
        task.status === "done" && "line-through text-muted-foreground",
      )}>
        {task.title}
      </p>

      {/* Tags */}
      {(task.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags!.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">

          {/* Checklist */}
          {checkTotal > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <CheckSquare className="h-3 w-3" />
              {checkDone}/{checkTotal}
            </span>
          )}

          {/* Horas */}
          {task.estimated_hours && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {task.estimated_hours}h
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Data */}
          {task.due_date && (
            <span className={cn("flex items-center gap-0.5 text-xs", overdue ? "text-red-500" : "text-muted-foreground")}>
              <Calendar className="h-3 w-3" />
              {fmtDate(task.due_date)}
            </span>
          )}

          {/* Assignee */}
          {task.assignee_name && (
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
              {task.assignee_name[0].toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal de tarefa ───────────────────────────────────────────────────────────
function TaskDialog({
  open, onClose, projectId, task,
}: {
  open: boolean; onClose: () => void; projectId: string; task?: Task;
}) {
  const qc = useQueryClient();
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "backlog",
    priority: task?.priority ?? "media",
    assigneeName: task?.assignee_name ?? "",
    estimatedHours: task?.estimated_hours?.toString() ?? "",
    dueDate: task?.due_date ?? "",
  });

  // DEP-01: dependências existentes
  const { data: dependencies = [] } = useQuery<any[]>({
    queryKey: [`task-deps-${task?.id}`],
    queryFn: () => apiRequest("GET", `/api/hub/tasks/${task!.id}/dependencies`).then(r => r.json()),
    enabled: isEdit && !!task?.id,
  });

  // Todas as tarefas do projeto para o seletor
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/hub/projects/${projectId}/tasks`, "all-for-deps"],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}/tasks`).then(r => r.json()),
    enabled: open,
  });

  const addDepMutation = useMutation({
    mutationFn: (dependsOnId: string) =>
      apiRequest("POST", `/api/hub/tasks/${task!.id}/dependencies`, { dependsOnId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`task-deps-${task?.id}`] }),
  });

  const removeDepMutation = useMutation({
    mutationFn: (dependsOnId: string) =>
      apiRequest("DELETE", `/api/hub/tasks/${task!.id}/dependencies/${dependsOnId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`task-deps-${task?.id}`] }),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit
      ? apiRequest("PATCH", `/api/hub/tasks/${task!.id}`, data)
      : apiRequest("POST", `/api/hub/projects/${projectId}/tasks`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/tasks`] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/hub/tasks/${task!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/tasks`] });
      onClose();
    },
  });

  const handleSubmit = () => {
    mutation.mutate({
      ...form,
      estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
      assigneeName: form.assigneeName || null,
      dueDate: form.dueDate || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Título *</label>
            <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <textarea
              className="w-full min-h-[72px] rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.description}
              onChange={e => setForm(f => ({...f, description: e.target.value}))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Prioridade</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({...f, priority: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([v,c]) => (
                    <SelectItem key={v} value={v}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Responsável</label>
              <Input placeholder="Nome" value={form.assigneeName}
                onChange={e => setForm(f => ({...f, assigneeName: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Horas est.</label>
              <Input type="number" placeholder="0" value={form.estimatedHours}
                onChange={e => setForm(f => ({...f, estimatedHours: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Prazo</label>
              <Input type="date" value={form.dueDate}
                onChange={e => setForm(f => ({...f, dueDate: e.target.value}))} />
            </div>
          </div>

          {/* DEP-01: Dependências (só em modo edição) */}
          {isEdit && (
            <div>
              <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Link className="h-3.5 w-3.5 text-muted-foreground" />
                Depende de
              </label>
              {/* Lista de dependências atuais */}
              {dependencies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {dependencies.map((dep: any) => (
                    <span key={dep.depends_on_id}
                      className={cn(
                        "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border",
                        dep.status === "done"
                          ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
                          : "bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400"
                      )}>
                      <Link className="h-2.5 w-2.5" />
                      {dep.title.length > 24 ? dep.title.slice(0, 24) + "…" : dep.title}
                      {dep.status !== "done" && <span className="opacity-60">({dep.status})</span>}
                      <button
                        onClick={() => removeDepMutation.mutate(dep.depends_on_id)}
                        className="ml-0.5 opacity-50 hover:opacity-100 text-xs"
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
              {/* Seletor para adicionar dependência */}
              <Select
                value=""
                onValueChange={(v) => { if (v) addDepMutation.mutate(v); }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="+ Adicionar dependência..." />
                </SelectTrigger>
                <SelectContent>
                  {allTasks
                    .filter(t => t.id !== task?.id && !dependencies.find((d: any) => d.depends_on_id === t.id))
                    .map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.wbs_code && <span className="font-mono text-muted-foreground mr-1">{t.wbs_code}</span>}
                        {t.title.length > 40 ? t.title.slice(0, 40) + "…" : t.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}>
              Excluir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || !form.title.trim()}>
            {mutation.isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ViewKanban principal ──────────────────────────────────────────────────────
export function ViewKanban({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | undefined>();
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: [`/api/hub/projects/${projectId}/tasks`],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}/tasks`).then(r => r.json()),
  });

  const batchMutation = useMutation({
    mutationFn: (updates: any[]) =>
      apiRequest("PATCH", `/api/hub/projects/${projectId}/tasks/batch-status`, { updates }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/tasks`] }),
  });

  const filteredTasks = tasks.filter(t => {
    if (filterAssignee && !t.assignee_name?.toLowerCase().includes(filterAssignee.toLowerCase())) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const handleDrop = (colId: string) => {
    if (!dragTaskId || !dragOverCol) return;
    const task = tasks.find(t => t.id === dragTaskId);
    if (!task || task.status === colId) return;
    batchMutation.mutate([{ id: dragTaskId, status: colId }]);
    setDragTaskId(null);
    setDragOverCol(null);
  };

  const assignees = [...new Set(tasks.map(t => t.assignee_name).filter(Boolean))] as string[];

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando tarefas...</div>;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <Input
          className="w-44"
          placeholder="Filtrar responsável"
          value={filterAssignee}
          onChange={e => setFilterAssignee(e.target.value)}
        />
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {Object.entries(PRIORITY_CONFIG).map(([v,c]) => (
              <SelectItem key={v} value={v}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setEditTask(undefined); setTaskOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova tarefa
          </Button>
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-3 overflow-x-auto pb-2 flex-1">
        {COLUMNS.map(col => {
          const colTasks = filteredTasks
            .filter(t => t.status === col.id)
            .sort((a, b) => a.order_index - b.order_index);
          const isDragOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className={cn(
                "flex flex-col flex-shrink-0 w-64 rounded-lg transition-colors",
                isDragOver ? "ring-2 ring-primary" : "",
              )}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.id)}
            >
              {/* Header da coluna */}
              <div className={cn("flex items-center justify-between px-3 py-2 rounded-t-lg", col.headerBg)}>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-bold uppercase tracking-wider", col.color)}>
                    {col.label}
                  </span>
                  <span className="text-xs bg-background/70 px-1.5 py-0.5 rounded-full text-muted-foreground">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setEditTask(undefined);
                    setTaskOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Cards */}
              <div className={cn(
                "flex-1 flex flex-col gap-2 p-2 rounded-b-lg min-h-24",
                col.bg,
                isDragOver && "bg-primary/5",
              )}>
                {colTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onDragStart={(id) => setDragTaskId(id)}
                    onClick={(t) => { setEditTask(t); setTaskOpen(true); }}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground/50">Arraste aqui</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        projectId={projectId}
        task={editTask}
      />
    </div>
  );
}
