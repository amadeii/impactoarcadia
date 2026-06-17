/**
 * Arcádia Project Hub — Aba Timesheet
 * Sprint HUB-05
 */
import { useState, useMemo, useEffect, useRef } from "react";
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
  Timer, Plus, CheckCircle2, Clock, User,
  ChevronLeft, ChevronRight, BarChart2,
  Play, Square, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TimesheetEntry {
  id: string;
  user_id: string;
  user_name?: string;
  date: string;
  hours: number;
  billable: boolean;
  activity_type: string;
  cost_rate: number;
  billing_rate: number;
  cost_amount: number;
  billing_amount: number;
  description?: string;
  approved_at?: string;
  started_at?: string;
  ended_at?: string;
  wbs_title?: string;
  wbs_code?: string;
  task_title?: string;
}

interface Summary {
  totals: {
    total_hours: number;
    billable_hours: number;
    total_cost: number;
    total_billing: number;
    entries: number;
    approved_entries: number;
  };
  byUser: {
    user_id: string;
    user_name?: string;
    total_hours: number;
    billable_hours: number;
    total_cost: number;
    total_billing: number;
  }[];
  byActivity: { activity_type: string; total_hours: number; total_cost: number }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (v: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 }).format(v);
const fmtH = (v: number) => `${Number(v).toFixed(1)}h`;

const ACTIVITY_LABELS: Record<string, string> = {
  campo:       "Campo",
  laboratorio: "Laboratório",
  escritorio:  "Escritório",
  deslocamento:"Deslocamento",
  reuniao:     "Reunião",
  treinamento: "Treinamento",
};

const ACTIVITY_COLORS: Record<string, string> = {
  campo:       "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  laboratorio: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  escritorio:  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  deslocamento:"bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  reuniao:     "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  treinamento: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
};

// Semana a partir de segunda-feira
function getWeekDays(refDate: Date): Date[] {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(d);
    dt.setDate(d.getDate() + i);
    return dt;
  });
}

const isoDate = (d: Date) => d.toISOString().split("T")[0];
const fmtDay  = (d: Date) => d.toLocaleDateString("pt-BR", { weekday:"short", day:"2-digit" });

// ── Modal de lançamento ───────────────────────────────────────────────────────
// ── TimerWidget — Iniciar/Parar timer (TIMER-01) ─────────────────────────────
function TimerWidget({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [elapsed, setElapsed] = useState(0); // segundos
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activity, setActivity] = useState("escritorio");

  // Buscar timer ativo
  const { data: activeTimer, isLoading } = useQuery<any>({
    queryKey: [`timer-active-${projectId}`],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/timesheets/timer/active`)
        .then(r => r.json()),
    refetchInterval: 30000, // refetch a cada 30s para manter sincronizado
  });

  // Calcular elapsed a partir do started_at
  useEffect(() => {
    if (activeTimer?.started_at) {
      const startMs = new Date(activeTimer.started_at).getTime();
      const update = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
      update();
      intervalRef.current = setInterval(update, 1000);
    } else {
      setElapsed(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTimer?.id, activeTimer?.started_at]);

  const startMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/hub/projects/${projectId}/timesheets/timer/start`, {
        activityType: activity,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`timer-active-${projectId}`] }),
  });

  const stopMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/hub/timesheets/${activeTimer.id}/timer/stop`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`timer-active-${projectId}`] });
      qc.invalidateQueries({ queryKey: [`ts-${projectId}`] });
      qc.invalidateQueries({ queryKey: [`ts-summary-${projectId}`] });
    },
  });

  const isRunning = !!activeTimer?.started_at;

  // Formatar elapsed
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const elapsedStr = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;

  if (isLoading) return null;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border transition-all",
      isRunning
        ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
        : "bg-card border-border"
    )}>
      {/* Ícone pulsante quando rodando */}
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
        isRunning ? "bg-green-500" : "bg-muted"
      )}>
        <Timer className={cn("h-4 w-4", isRunning ? "text-white animate-pulse" : "text-muted-foreground")} />
      </div>

      {/* Display do tempo */}
      {isRunning ? (
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tabular-nums text-green-700 dark:text-green-400">
              {elapsedStr}
            </span>
            <span className="text-xs text-green-600 dark:text-green-500 capitalize">
              {activeTimer.activity_type}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Iniciado às {new Date(activeTimer.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Timer parado</span>
          <Select value={activity} onValueChange={setActivity}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTIVITY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Botão Iniciar/Parar */}
      {isRunning ? (
        <Button
          size="sm"
          variant="outline"
          className="border-green-400 text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 gap-1.5"
          onClick={() => stopMutation.mutate()}
          disabled={stopMutation.isPending}
        >
          {stopMutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Square className="h-3.5 w-3.5 fill-current" />
          }
          Parar
        </Button>
      ) : (
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
        >
          {startMutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Play className="h-3.5 w-3.5 fill-current" />
          }
          Iniciar
        </Button>
      )}
    </div>
  );
}

function NewEntryDialog({ open, onClose, projectId, defaultDate }: {
  open: boolean; onClose: () => void; projectId: string; defaultDate?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    date: defaultDate ?? isoDate(new Date()),
    hours: "1", billable: true,
    activityType: "escritorio", description: "",
    userName: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/hub/projects/${projectId}/timesheets`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`ts-${projectId}`] });
      qc.invalidateQueries({ queryKey: [`ts-summary-${projectId}`] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apontar horas</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Data</label>
              <Input type="date" value={form.date}
                onChange={e => setForm(f => ({...f, date: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Horas</label>
              <Input type="number" min="0.25" max="24" step="0.25" value={form.hours}
                onChange={e => setForm(f => ({...f, hours: e.target.value}))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tipo de atividade</label>
              <Select value={form.activityType} onValueChange={v => setForm(f => ({...f, activityType: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_LABELS).map(([v,l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Colaborador</label>
              <Input placeholder="Nome" value={form.userName}
                onChange={e => setForm(f => ({...f, userName: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <Input placeholder="O que foi feito..." value={form.description}
              onChange={e => setForm(f => ({...f, description: e.target.value}))} />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="billable" checked={form.billable}
              onChange={e => setForm(f => ({...f, billable: e.target.checked}))} className="rounded" />
            <label htmlFor="billable" className="text-sm">Horas faturáveis ao cliente</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate({
              ...form,
              hours: parseFloat(form.hours),
              userId: "current", // resolvido pelo backend via auth
              userName: form.userName || null,
            })}
            disabled={mutation.isPending || !form.hours || parseFloat(form.hours) <= 0}
          >
            {mutation.isPending ? "Salvando..." : "Apontar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Calendário semanal ────────────────────────────────────────────────────────
function WeeklyCalendar({
  entries, weekDays, projectId, onNew,
  selected, onSelect,
}: {
  entries: TimesheetEntry[];
  weekDays: Date[];
  projectId: string;
  onNew: (date: string) => void;
  selected: string[];
  onSelect: (id: string) => void;
}) {
  // Agrupa por data
  const byDate: Record<string, TimesheetEntry[]> = {};
  entries.forEach(e => {
    const d = e.date.split("T")[0];
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  });

  const totalWeek = weekDays.reduce((s, d) => {
    const day = isoDate(d);
    return s + (byDate[day] ?? []).reduce((ss, e) => ss + Number(e.hours), 0);
  }, 0);

  return (
    <div>
      {/* Header da semana */}
      <div className="grid grid-cols-8 gap-1 mb-1">
        <div className="text-xs text-muted-foreground text-center p-2">
          {fmtH(totalWeek)}<br/>
          <span className="text-[10px]">semana</span>
        </div>
        {weekDays.map(d => {
          const iso = isoDate(d);
          const isToday = iso === isoDate(new Date());
          const dayEntries = byDate[iso] ?? [];
          const dayHours = dayEntries.reduce((s, e) => s + Number(e.hours), 0);
          return (
            <div key={iso} className={cn(
              "text-center p-2 rounded-lg text-xs",
              isToday ? "bg-primary/10 border border-primary/30" : ""
            )}>
              <div className={cn("font-medium", isToday ? "text-primary" : "text-muted-foreground")}>
                {fmtDay(d)}
              </div>
              <div className={cn("font-bold text-sm mt-0.5", dayHours > 0 ? "text-foreground" : "text-muted-foreground/30")}>
                {dayHours > 0 ? fmtH(dayHours) : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid de lançamentos */}
      <div className="border rounded-lg overflow-hidden">
        {entries.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhum lançamento nesta semana
          </div>
        ) : (
          entries.map(entry => (
            <div
              key={entry.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 border-b last:border-0",
                "hover:bg-muted/40 transition-colors",
                selected.includes(entry.id) && "bg-primary/5",
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(entry.id)}
                onChange={() => onSelect(entry.id)}
                className="rounded flex-shrink-0"
                disabled={!!entry.approved_at}
              />
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                "bg-primary/10 text-primary")}>
                {(entry.user_name ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {entry.user_name ?? entry.user_id}
                  </span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full", ACTIVITY_COLORS[entry.activity_type] ?? "")}>
                    {ACTIVITY_LABELS[entry.activity_type] ?? entry.activity_type}
                  </span>
                  {!entry.billable && (
                    <span className="text-xs text-muted-foreground">(não faturável)</span>
                  )}
                </div>
                {entry.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.description}</p>
                )}
                {(entry.wbs_title || entry.task_title) && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {entry.wbs_code && <span className="font-mono mr-1">{entry.wbs_code}</span>}
                    {entry.wbs_title ?? entry.task_title}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold">{fmtH(entry.hours)}</div>
                <div className="text-xs text-muted-foreground">{fmt(entry.cost_amount)}</div>
                {entry.started_at && entry.ended_at && (
                  <div className="text-[10px] text-muted-foreground/60 tabular-nums mt-0.5">
                    {new Date(entry.started_at).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}–
                    {new Date(entry.ended_at).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                {entry.approved_at ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── ViewTimesheet principal ───────────────────────────────────────────────────
export function ViewTimesheet({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [weekRef, setWeekRef] = useState(new Date());
  const [newOpen, setNewOpen] = useState(false);
  const [newDate, setNewDate] = useState<string | undefined>();
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<"week" | "summary">("week");

  const weekDays  = useMemo(() => getWeekDays(weekRef), [weekRef]);
  const weekStart = isoDate(weekDays[0]);
  const weekEnd   = isoDate(weekDays[6]);

  const { data: entries = [], isLoading } = useQuery<TimesheetEntry[]>({
    queryKey: [`ts-${projectId}`, weekStart, weekEnd],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/timesheets?from=${weekStart}&to=${weekEnd}`)
        .then(r => r.json()),
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: [`ts-summary-${projectId}`],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/timesheets/summary`).then(r => r.json()),
    enabled: view === "summary",
  });

  const approveMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiRequest("POST", "/api/hub/timesheets/approve-batch", { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`ts-${projectId}`] });
      qc.invalidateQueries({ queryKey: [`ts-summary-${projectId}`] });
      setSelected([]);
    },
  });

  const pendingEntries = entries.filter(e => !e.approved_at);
  const pendingHours   = pendingEntries.reduce((s, e) => s + Number(e.hours), 0);

  const toggleSelect = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const selectAllPending = () =>
    setSelected(pendingEntries.map(e => e.id));

  return (
    <div className="space-y-4">
      {/* Timer widget (TIMER-01) */}
      <TimerWidget projectId={projectId} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            className={cn("text-xs px-3 py-1.5 rounded-md transition-colors",
              view === "week" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            onClick={() => setView("week")}
          >Semana</button>
          <button
            className={cn("text-xs px-3 py-1.5 rounded-md transition-colors",
              view === "summary" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            onClick={() => setView("summary")}
          >Resumo</button>
        </div>

        {view === "week" && (
          <div className="flex items-center gap-2">
            <button onClick={() => { const d = new Date(weekRef); d.setDate(d.getDate()-7); setWeekRef(d); }}
              className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium min-w-36 text-center">
              {weekDays[0].toLocaleDateString("pt-BR", { day:"2-digit", month:"short" })} —{" "}
              {weekDays[6].toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" })}
            </span>
            <button onClick={() => { const d = new Date(weekRef); d.setDate(d.getDate()+7); setWeekRef(d); }}
              className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {selected.length > 0 && (
            <Button size="sm" variant="outline"
              className="border-green-300 text-green-700"
              onClick={() => approveMutation.mutate(selected)}
              disabled={approveMutation.isPending}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Aprovar {selected.length} ({fmtH(
                entries.filter(e => selected.includes(e.id)).reduce((s,e) => s+Number(e.hours), 0)
              )})
            </Button>
          )}
          {pendingEntries.length > 0 && selected.length === 0 && (
            <Button size="sm" variant="ghost" onClick={selectAllPending}>
              Selecionar pendentes ({fmtH(pendingHours)})
            </Button>
          )}
          <Button size="sm" onClick={() => { setNewDate(undefined); setNewOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Apontar horas
          </Button>
        </div>
      </div>

      {/* View Semana */}
      {view === "week" && (
        isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <WeeklyCalendar
            entries={entries}
            weekDays={weekDays}
            projectId={projectId}
            onNew={d => { setNewDate(d); setNewOpen(true); }}
            selected={selected}
            onSelect={toggleSelect}
          />
        )
      )}

      {/* View Resumo */}
      {view === "summary" && summary && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total horas</p>
              <p className="text-2xl font-bold">{fmtH(summary.totals.total_hours)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {fmtH(summary.totals.billable_hours)} faturáveis
              </p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Custo de mão de obra</p>
              <p className="text-2xl font-bold">{fmt(summary.totals.total_cost)}</p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Faturável ao cliente</p>
              <p className="text-2xl font-bold text-primary">{fmt(summary.totals.total_billing)}</p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Aprovados</p>
              <p className="text-2xl font-bold text-green-600">
                {summary.totals.approved_entries}/{summary.totals.entries}
              </p>
            </div>
          </div>

          {/* Por colaborador */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Por colaborador
            </div>
            {summary.byUser.map(u => (
              <div key={u.user_id} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {(u.user_name ?? u.user_id)[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{u.user_name ?? u.user_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtH(u.billable_hours)} faturáveis / {fmtH(u.total_hours)} total
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{fmtH(u.total_hours)}</p>
                  <p className="text-xs text-muted-foreground">{fmt(u.total_cost)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Por tipo de atividade */}
          {summary.byActivity.length > 0 && (
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Por atividade
              </div>
              {summary.byActivity.map(a => (
                <div key={a.activity_type} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", ACTIVITY_COLORS[a.activity_type] ?? "")}>
                    {ACTIVITY_LABELS[a.activity_type] ?? a.activity_type}
                  </span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min((Number(a.total_hours)/Number(summary.totals.total_hours))*100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">{fmtH(a.total_hours)}</span>
                  <span className="text-xs text-muted-foreground w-20 text-right">{fmt(a.total_cost)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <NewEntryDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        projectId={projectId}
        defaultDate={newDate}
      />
    </div>
  );
}
