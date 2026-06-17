/**
 * Arcádia Project Hub — Aba Calendário (CAL-01)
 * 3 views: Mensal (tarefas/marcos), Semanal de Horas (timesheets), Gantt (WBS)
 * Sem dependências externas — date-fns + SVG puro
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, CalendarDays,
  BarChart2, Clock, Flag, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  addMonths, subMonths, addWeeks, subWeeks, format, isSameMonth,
  isSameDay, isToday, parseISO, differenceInDays, startOfDay,
  isWithinInterval, isBefore, isAfter,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string;
  assignee_name?: string;
  wbs_code?: string;
  days_overdue?: number;
}

interface WbsNode {
  id: string;
  title: string;
  code?: string;
  node_type: string;
  planned_start?: string;
  planned_end?: string;
  progress_pct: number;
  status: string;
  parent_id?: string;
}

interface Timesheet {
  id: string;
  user_name?: string;
  date: string;
  hours: number;
  activity_type: string;
  billable: boolean;
}

// ── Paleta ────────────────────────────────────────────────────────────────────
const PRIORITY_BG: Record<string, string> = {
  critica: "bg-red-500 text-white",
  alta:    "bg-amber-500 text-white",
  media:   "bg-blue-500 text-white",
  baixa:   "bg-gray-400 text-white",
};

const NODE_TYPE_COLORS: Record<string, string> = {
  fase:       "#7B6FE8",
  pacote:     "#4A9EE8",
  entregavel: "#2DB87C",
  tarefa:     "#8A8880",
  marco:      "#F5A623",
};

const STATUS_BAR: Record<string, string> = {
  concluido:    "#2DB87C",
  em_andamento: "#4A9EE8",
  pendente:     "#8A8880",
  bloqueado:    "#E8624A",
};

const ACTIVITY_COLORS: Record<string, string> = {
  campo:        "#F5A623",
  laboratorio:  "#7B6FE8",
  escritorio:   "#4A9EE8",
  deslocamento: "#E8624A",
  reuniao:      "#2DB87C",
  treinamento:  "#45D494",
};

const fmtShort = (d: Date) => format(d, "d", { locale: ptBR });
const fmtMonth = (d: Date) => format(d, "MMMM yyyy", { locale: ptBR });
const fmtWeek  = (d: Date) => format(d, "dd/MM", { locale: ptBR });
const fmtH     = (v: number) => `${Number(v).toFixed(1)}h`;

// ── VIEW MENSAL ───────────────────────────────────────────────────────────────
function ViewMensal({ projectId }: { projectId: string }) {
  const [month, setMonth] = useState(new Date());

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/hub/projects/${projectId}/tasks`, "calendar-all"],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/tasks`)
        .then(r => r.json()),
  });

  const { data: wbsData } = useQuery<{ flat: WbsNode[] }>({
    queryKey: [`/api/hub/projects/${projectId}/wbs`],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/wbs`)
        .then(r => r.json()),
  });

  const marcos = (wbsData?.flat ?? []).filter(n => n.node_type === "marco" && n.planned_end);

  // Indexar tarefas por due_date (YYYY-MM-DD)
  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(t => {
      if (!t.due_date) return;
      const key = t.due_date.split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  const marcosByDay = useMemo(() => {
    const map: Record<string, WbsNode[]> = {};
    marcos.forEach(m => {
      if (!m.planned_end) return;
      const key = m.planned_end.split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [marcos]);

  // Gerar dias do calendário (6 semanas)
  const calStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(calStart, i));

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="space-y-3">
      {/* Navegação */}
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(m => subMonths(m, 1))}
          className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold capitalize">{fmtMonth(month)}</h3>
        <button onClick={() => setMonth(m => addMonths(m, 1))}
          className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Cabeçalho dias da semana */}
        <div className="grid grid-cols-7 border-b">
          {weekDays.map(d => (
            <div key={d} className="py-1.5 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Células dos dias */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const key   = format(day, "yyyy-MM-dd");
            const dayTasks  = tasksByDay[key] ?? [];
            const dayMarcos = marcosByDay[key] ?? [];
            const inMonth   = isSameMonth(day, month);
            const today     = isToday(day);

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[80px] p-1 border-r border-b last:border-r-0",
                  !inMonth && "bg-muted/30",
                  today && "bg-primary/5",
                  idx % 7 === 6 && "border-r-0",
                )}
              >
                {/* Número do dia */}
                <div className={cn(
                  "text-xs font-medium mb-1 h-5 w-5 flex items-center justify-center rounded-full",
                  today && "bg-primary text-primary-foreground",
                  !inMonth && "text-muted-foreground/40",
                )}>
                  {fmtShort(day)}
                </div>

                {/* Marcos */}
                {dayMarcos.map(m => (
                  <div key={m.id} className="flex items-center gap-0.5 mb-0.5" title={m.title}>
                    <span className="text-[9px]">◆</span>
                    <span className="text-[10px] font-bold text-amber-600 truncate leading-tight">
                      {m.code} {m.title}
                    </span>
                  </div>
                ))}

                {/* Tarefas */}
                {dayTasks.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    title={`${t.title}${t.assignee_name ? ` — ${t.assignee_name}` : ""}`}
                    className={cn(
                      "text-[10px] px-1 py-0.5 rounded mb-0.5 truncate leading-tight font-medium",
                      t.days_overdue ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                      t.priority === "critica" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                      t.priority === "alta"    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    )}
                  >
                    {t.wbs_code && <span className="font-mono opacity-70">{t.wbs_code} </span>}
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[9px] text-muted-foreground pl-1">
                    +{dayTasks.length - 3} mais
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <span className="text-amber-600">◆</span> Marco
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded bg-amber-200 inline-block" /> Alta prioridade
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded bg-blue-200 inline-block" /> Normal
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded bg-red-200 inline-block" /> Atrasada
        </span>
      </div>
    </div>
  );
}

// ── VIEW SEMANAL DE HORAS ─────────────────────────────────────────────────────
function ViewSemanal({ projectId }: { projectId: string }) {
  const [weekRef, setWeekRef] = useState(new Date());

  const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(weekRef, { weekStartsOn: 1 });
  const days      = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: timesheets = [] } = useQuery<Timesheet[]>({
    queryKey: [`/api/hub/projects/${projectId}/timesheets`, format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/timesheets?from=${format(weekStart, "yyyy-MM-dd")}&to=${format(weekEnd, "yyyy-MM-dd")}`)
        .then(r => r.json()),
  });

  // Agrupar por colaborador × dia
  const byUserDay = useMemo(() => {
    const map: Record<string, Record<string, Timesheet[]>> = {};
    timesheets.forEach(ts => {
      const user = ts.user_name ?? "Sem nome";
      const day  = ts.date.split("T")[0];
      if (!map[user]) map[user] = {};
      if (!map[user][day]) map[user][day] = [];
      map[user][day].push(ts);
    });
    return map;
  }, [timesheets]);

  const users = Object.keys(byUserDay);

  // Totais por dia
  const totalByDay = useMemo(() =>
    days.map(d => {
      const key = format(d, "yyyy-MM-dd");
      return timesheets
        .filter(ts => ts.date.split("T")[0] === key)
        .reduce((s, ts) => s + Number(ts.hours), 0);
    }),
  [timesheets, days]);

  const totalSemana = timesheets.reduce((s, ts) => s + Number(ts.hours), 0);
  const billableSemana = timesheets.filter(ts => ts.billable).reduce((s, ts) => s + Number(ts.hours), 0);
  const maxHours = Math.max(...totalByDay, 1);

  return (
    <div className="space-y-4">
      {/* Navegação */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekRef(w => subWeeks(w, 1))}
          className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">
            {fmtWeek(weekStart)} — {fmtWeek(weekEnd)}
          </p>
          <p className="text-xs text-muted-foreground">
            {fmtH(totalSemana)} total · {fmtH(billableSemana)} faturáveis
          </p>
        </div>
        <button onClick={() => setWeekRef(w => addWeeks(w, 1))}
          className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Barras por dia */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-end gap-2 h-28">
          {days.map((d, i) => {
            const h = totalByDay[i];
            const pct = h > 0 ? (h / maxHours) * 100 : 0;
            const today = isToday(d);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {h > 0 ? fmtH(h) : ""}
                </span>
                <div className="w-full rounded-t-md overflow-hidden"
                  style={{ height: "72px", display: "flex", alignItems: "flex-end" }}>
                  <div
                    className={cn("w-full rounded-t-md transition-all", today ? "bg-primary" : "bg-primary/40")}
                    style={{ height: `${Math.max(pct, h > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className={cn("text-[10px] font-medium", today && "text-primary")}>
                  {format(d, "EEE", { locale: ptBR })}
                </span>
                <span className="text-[9px] text-muted-foreground">{fmtShort(d)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabela por colaborador */}
      {users.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground border rounded-lg">
          Nenhum apontamento nesta semana
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          {/* Cabeçalho */}
          <div className="grid border-b text-xs font-semibold text-muted-foreground"
            style={{ gridTemplateColumns: "160px repeat(7, 1fr) 60px" }}>
            <div className="px-3 py-2">Colaborador</div>
            {days.map(d => (
              <div key={d.toISOString()} className={cn("py-2 text-center", isToday(d) && "text-primary")}>
                {format(d, "EEE dd", { locale: ptBR })}
              </div>
            ))}
            <div className="py-2 text-center">Total</div>
          </div>

          {users.map((user, ui) => {
            const userDays = byUserDay[user];
            const userTotal = Object.values(userDays)
              .flat()
              .reduce((s, ts) => s + Number(ts.hours), 0);

            return (
              <div key={user}
                className={cn("grid border-b last:border-0 text-sm", ui % 2 === 0 ? "" : "bg-muted/20")}
                style={{ gridTemplateColumns: "160px repeat(7, 1fr) 60px" }}>
                <div className="px-3 py-2 font-medium truncate flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                    {user[0].toUpperCase()}
                  </div>
                  <span className="truncate">{user}</span>
                </div>
                {days.map(d => {
                  const key  = format(d, "yyyy-MM-dd");
                  const logs = userDays[key] ?? [];
                  const hrs  = logs.reduce((s, ts) => s + Number(ts.hours), 0);
                  return (
                    <div key={key} className="py-2 text-center">
                      {hrs > 0 ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs font-semibold tabular-nums">{fmtH(hrs)}</span>
                          <div className="flex gap-0.5">
                            {logs.slice(0, 3).map(ts => (
                              <span
                                key={ts.id}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: ACTIVITY_COLORS[ts.activity_type] ?? "#8A8880" }}
                                title={ts.activity_type}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30 text-xs">—</span>
                      )}
                    </div>
                  );
                })}
                <div className="py-2 text-center text-xs font-bold">
                  {fmtH(userTotal)}
                </div>
              </div>
            );
          })}

          {/* Linha de totais */}
          <div className="grid bg-muted/30 border-t text-xs font-bold"
            style={{ gridTemplateColumns: "160px repeat(7, 1fr) 60px" }}>
            <div className="px-3 py-2 text-muted-foreground">Total</div>
            {totalByDay.map((h, i) => (
              <div key={i} className="py-2 text-center tabular-nums">
                {h > 0 ? fmtH(h) : "—"}
              </div>
            ))}
            <div className="py-2 text-center tabular-nums">{fmtH(totalSemana)}</div>
          </div>
        </div>
      )}

      {/* Legenda de atividades */}
      <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
        {Object.entries(ACTIVITY_COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />
            {k.charAt(0).toUpperCase() + k.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── VIEW HEATMAP — Mensal de Horas (CAL-02) ───────────────────────────────────
function ViewHeatmap({ projectId }: { projectId: string }) {
  const [month, setMonth] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState<string>("all");

  const monthStart = startOfMonth(month);
  const monthEnd   = endOfMonth(month);

  const { data: timesheets = [] } = useQuery<Timesheet[]>({
    queryKey: [
      `/api/hub/projects/${projectId}/timesheets`,
      "heatmap",
      format(monthStart, "yyyy-MM-dd"),
      format(monthEnd, "yyyy-MM-dd"),
    ],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/hub/projects/${projectId}/timesheets?from=${format(monthStart, "yyyy-MM-dd")}&to=${format(monthEnd, "yyyy-MM-dd")}`
      ).then(r => r.json()),
  });

  // Colaboradores únicos
  const users = useMemo(() =>
    ["all", ...new Set(timesheets.map(ts => ts.user_name ?? "Sem nome").filter(Boolean))],
  [timesheets]);

  // Filtrar por colaborador
  const filtered = selectedUser === "all"
    ? timesheets
    : timesheets.filter(ts => (ts.user_name ?? "Sem nome") === selectedUser);

  // Horas por dia
  const hoursByDay = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(ts => {
      const key = ts.date.split("T")[0];
      map[key] = (map[key] ?? 0) + Number(ts.hours);
    });
    return map;
  }, [filtered]);

  // Atividade por dia (tipo predominante)
  const activityByDay = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    filtered.forEach(ts => {
      const key = ts.date.split("T")[0];
      if (!map[key]) map[key] = {};
      map[key][ts.activity_type] = (map[key][ts.activity_type] ?? 0) + Number(ts.hours);
    });
    const result: Record<string, string> = {};
    Object.entries(map).forEach(([day, acts]) => {
      result[day] = Object.entries(acts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    });
    return result;
  }, [filtered]);

  const maxHours = Math.max(...Object.values(hoursByDay), 1);

  // Gerar grid do mês
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days: Date[] = [];
  let cur = calStart;
  while (isBefore(cur, monthEnd) || isSameDay(cur, monthEnd) || isBefore(cur, addDays(monthEnd, 7 - monthEnd.getDay()))) {
    days.push(cur);
    cur = addDays(cur, 1);
    if (days.length > 42) break;
  }

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  // Totais do mês
  const totalHoras = Object.values(hoursByDay).reduce((s, h) => s + h, 0);
  const diasAtivos = Object.keys(hoursByDay).length;
  const mediaHoras = diasAtivos > 0 ? totalHoras / diasAtivos : 0;

  // Intensidade de cor baseada nas horas (0-100% do máximo do mês)
  const getIntensity = (hours: number): string => {
    if (hours <= 0) return "";
    const pct = hours / maxHours;
    if (pct > 0.75) return "bg-primary opacity-90";
    if (pct > 0.50) return "bg-primary opacity-60";
    if (pct > 0.25) return "bg-primary opacity-35";
    return "bg-primary opacity-20";
  };

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(m => subMonths(m, 1))}
            className="h-7 w-7 rounded border flex items-center justify-center hover:bg-muted">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-sm font-semibold min-w-32 text-center capitalize">
            {fmtMonth(month)}
          </span>
          <button onClick={() => setMonth(m => addMonths(m, 1))}
            className="h-7 w-7 rounded border flex items-center justify-center hover:bg-muted">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Filtro colaborador */}
        <select
          value={selectedUser}
          onChange={e => setSelectedUser(e.target.value)}
          className="text-xs border rounded-md px-2 py-1.5 bg-background"
        >
          {users.map(u => (
            <option key={u} value={u}>{u === "all" ? "Todos os colaboradores" : u}</option>
          ))}
        </select>

        {/* KPIs */}
        <div className="flex gap-4 ml-auto text-xs text-muted-foreground">
          <span><span className="font-bold text-foreground">{fmtH(totalHoras)}</span> no mês</span>
          <span><span className="font-bold text-foreground">{diasAtivos}</span> dias trabalhados</span>
          <span><span className="font-bold text-foreground">{fmtH(mediaHoras)}</span> média/dia</span>
        </div>
      </div>

      {/* Calendário heatmap */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {weekDays.map(d => (
            <div key={d} className="py-1.5 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const key       = format(day, "yyyy-MM-dd");
            const hours     = hoursByDay[key] ?? 0;
            const activity  = activityByDay[key];
            const inMonth   = isSameMonth(day, month);
            const todayFlag = isToday(day);
            const intensity = getIntensity(hours);
            const dotColor  = activity ? ACTIVITY_COLORS[activity] : "";

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[72px] p-1.5 border-r border-b",
                  !inMonth && "bg-muted/20",
                  todayFlag && !hours && "bg-primary/5",
                  idx % 7 === 6 && "border-r-0",
                )}
              >
                {/* Número do dia */}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full",
                    todayFlag && "bg-primary text-primary-foreground",
                    !inMonth && "text-muted-foreground/30",
                  )}>
                    {fmtShort(day)}
                  </span>
                  {/* Dot de tipo de atividade */}
                  {activity && inMonth && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: dotColor }}
                      title={activity}
                    />
                  )}
                </div>

                {/* Bloco de intensidade */}
                {hours > 0 && inMonth && (
                  <div className={cn(
                    "rounded-md flex flex-col items-center justify-center py-1.5 transition-all",
                    intensity || "bg-primary/15",
                  )}>
                    <span className="text-xs font-bold text-primary-foreground tabular-nums">
                      {fmtH(hours)}
                    </span>
                    {hours >= 6 && (
                      <span className="text-[9px] text-primary-foreground/70 capitalize">
                        {activity ?? ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Escala + legenda */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Menos</span>
          {[0.1, 0.25, 0.5, 0.75, 1.0].map((p, i) => (
            <div key={i} className="w-4 h-4 rounded bg-primary"
              style={{ opacity: 0.15 + p * 0.75 }} />
          ))}
          <span>Mais horas</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(ACTIVITY_COLORS).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ background: c }} />
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </span>
          ))}
        </div>
      </div>

      {/* Breakdown por atividade */}
      {totalHoras > 0 && (
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Distribuição por atividade
          </p>
          <div className="space-y-2">
            {Object.entries(
              filtered.reduce((acc, ts) => {
                acc[ts.activity_type] = (acc[ts.activity_type] ?? 0) + Number(ts.hours);
                return acc;
              }, {} as Record<string, number>)
            )
              .sort((a, b) => b[1] - a[1])
              .map(([act, hrs]) => (
                <div key={act} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: ACTIVITY_COLORS[act] ?? "#8A8880" }} />
                  <span className="text-xs text-muted-foreground w-24 capitalize">{act}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${(hrs / totalHoras) * 100}%`,
                        background: ACTIVITY_COLORS[act] ?? "#8A8880",
                      }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-12 text-right">
                    {fmtH(hrs)}
                  </span>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {((hrs / totalHoras) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── VIEW GANTT ────────────────────────────────────────────────────────────────
function ViewGantt({ projectId, project }: { projectId: string; project: any }) {
  const [zoom, setZoom] = useState<"mes" | "semana">("mes");

  const { data: wbsData } = useQuery<{ flat: WbsNode[] }>({
    queryKey: [`/api/hub/projects/${projectId}/wbs`],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/wbs`)
        .then(r => r.json()),
  });

  const nodes = useMemo(() =>
    (wbsData?.flat ?? [])
      .filter(n => n.planned_start && n.planned_end)
      .sort((a, b) => {
        if (a.code && b.code) return a.code.localeCompare(b.code, undefined, { numeric: true });
        return 0;
      }),
  [wbsData]);

  // Janela de tempo
  const projectStart = project.planned_start
    ? parseISO(project.planned_start)
    : (nodes[0]?.planned_start ? parseISO(nodes[0].planned_start) : new Date());
  const projectEnd = project.planned_end
    ? parseISO(project.planned_end)
    : (nodes[nodes.length - 1]?.planned_end ? parseISO(nodes[nodes.length - 1].planned_end) : addMonths(new Date(), 3));

  const totalDays = Math.max(differenceInDays(projectEnd, projectStart) + 1, 30);

  // Gerar cabeçalho de meses
  const months: { label: string; days: number; startDay: number }[] = [];
  let cur = startOfMonth(projectStart);
  while (isBefore(cur, projectEnd) || isSameDay(cur, projectEnd)) {
    const mStart = isBefore(cur, projectStart) ? projectStart : cur;
    const mEnd   = isAfter(endOfMonth(cur), projectEnd) ? projectEnd : endOfMonth(cur);
    const days   = differenceInDays(mEnd, mStart) + 1;
    const startDay = differenceInDays(mStart, projectStart);
    months.push({
      label: format(cur, "MMM yyyy", { locale: ptBR }),
      days,
      startDay,
    });
    cur = addMonths(cur, 1);
  }

  const ROW_H = 36;
  const LABEL_W = 220;
  const DAY_W = zoom === "mes" ? 12 : 20;
  const SVG_W = LABEL_W + totalDays * DAY_W;
  const SVG_H = ROW_H * (nodes.length + 1) + 30;
  const today = differenceInDays(new Date(), projectStart);

  if (nodes.length === 0) {
    return (
      <div className="text-center py-16 border rounded-lg">
        <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium mb-1">Sem dados para o Gantt</p>
        <p className="text-xs text-muted-foreground">
          Adicione datas de início e término nos itens da WBS para visualizar o Gantt
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Zoom:</span>
        <button onClick={() => setZoom("mes")}
          className={cn("text-xs px-2.5 py-1 rounded-md transition-colors",
            zoom === "mes" ? "bg-primary text-primary-foreground" : "border hover:bg-muted")}>
          Mês
        </button>
        <button onClick={() => setZoom("semana")}
          className={cn("text-xs px-2.5 py-1 rounded-md transition-colors",
            zoom === "semana" ? "bg-primary text-primary-foreground" : "border hover:bg-muted")}>
          Semana
        </button>
        <span className="text-xs text-muted-foreground ml-auto">
          {nodes.length} itens · {format(projectStart, "dd/MM/yyyy")} → {format(projectEnd, "dd/MM/yyyy")}
        </span>
      </div>

      {/* Gantt SVG */}
      <div className="border rounded-lg overflow-auto bg-card">
        <svg width={SVG_W} height={SVG_H} xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block", fontFamily: "system-ui, sans-serif" }}>

          {/* Fundo cabeçalho */}
          <rect x={0} y={0} width={SVG_W} height={30} fill="var(--muted)" />

          {/* Cabeçalho de meses */}
          {months.map((m, i) => (
            <g key={i}>
              <rect
                x={LABEL_W + m.startDay * DAY_W}
                y={0}
                width={m.days * DAY_W}
                height={30}
                fill="none"
                stroke="var(--border)"
                strokeWidth={0.5}
              />
              <text
                x={LABEL_W + m.startDay * DAY_W + (m.days * DAY_W) / 2}
                y={18}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted-foreground)"
                fontWeight={600}
                textTransform="capitalize"
              >
                {m.label}
              </text>
            </g>
          ))}

          {/* Cabeçalho coluna label */}
          <rect x={0} y={0} width={LABEL_W} height={30} fill="var(--muted)" />
          <text x={12} y={18} fontSize={10} fill="var(--muted-foreground)" fontWeight={600}>
            Item WBS
          </text>

          {/* Linha de "hoje" */}
          {today >= 0 && today <= totalDays && (
            <g>
              <line
                x1={LABEL_W + today * DAY_W}
                y1={30}
                x2={LABEL_W + today * DAY_W}
                y2={SVG_H}
                stroke="var(--primary)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.7}
              />
              <text
                x={LABEL_W + today * DAY_W + 3}
                y={42}
                fontSize={8}
                fill="var(--primary)"
                fontWeight={700}
              >
                Hoje
              </text>
            </g>
          )}

          {/* Linhas de grade horizontal */}
          {nodes.map((_, i) => (
            <line
              key={i}
              x1={0}
              y1={30 + ROW_H * (i + 1)}
              x2={SVG_W}
              y2={30 + ROW_H * (i + 1)}
              stroke="var(--border)"
              strokeWidth={0.5}
            />
          ))}

          {/* Itens WBS */}
          {nodes.map((node, i) => {
            const y     = 30 + ROW_H * i;
            const depth = (node.code?.split(".").length ?? 1) - 1;
            const nStart = parseISO(node.planned_start!);
            const nEnd   = parseISO(node.planned_end!);
            const x0     = LABEL_W + differenceInDays(nStart, projectStart) * DAY_W;
            const barW   = Math.max(differenceInDays(nEnd, nStart) + 1, 1) * DAY_W;
            const fillW  = barW * (node.progress_pct / 100);
            const color  = NODE_TYPE_COLORS[node.node_type] ?? "#8A8880";
            const barColor = STATUS_BAR[node.status] ?? color;
            const isMarco = node.node_type === "marco";

            return (
              <g key={node.id}>
                {/* Linha de fundo alternada */}
                {i % 2 === 0 && (
                  <rect x={0} y={y} width={SVG_W} height={ROW_H}
                    fill="var(--muted)" opacity={0.15} />
                )}

                {/* Label */}
                <text
                  x={12 + depth * 10}
                  y={y + ROW_H / 2 + 4}
                  fontSize={11}
                  fill="var(--foreground)"
                  fontWeight={node.node_type === "fase" ? 700 : 400}
                >
                  {node.code && (
                    <tspan fontSize={9} fill="var(--muted-foreground)" fontFamily="monospace">
                      {node.code}{" "}
                    </tspan>
                  )}
                  {node.title.length > 22 ? node.title.slice(0, 22) + "…" : node.title}
                </text>

                {/* Barra do Gantt */}
                {isMarco ? (
                  // Marco: losango
                  <polygon
                    points={`
                      ${x0 + barW / 2},${y + 6}
                      ${x0 + barW / 2 + 8},${y + ROW_H / 2}
                      ${x0 + barW / 2},${y + ROW_H - 6}
                      ${x0 + barW / 2 - 8},${y + ROW_H / 2}
                    `}
                    fill="#F5A623"
                    opacity={0.9}
                  />
                ) : (
                  <g>
                    {/* Barra total */}
                    <rect
                      x={x0}
                      y={y + 8}
                      width={barW}
                      height={ROW_H - 16}
                      rx={3}
                      fill={barColor}
                      opacity={0.25}
                    />
                    {/* Barra de progresso */}
                    {fillW > 0 && (
                      <rect
                        x={x0}
                        y={y + 8}
                        width={fillW}
                        height={ROW_H - 16}
                        rx={3}
                        fill={barColor}
                        opacity={0.85}
                      />
                    )}
                    {/* % no centro */}
                    {barW > 30 && (
                      <text
                        x={x0 + barW / 2}
                        y={y + ROW_H / 2 + 4}
                        textAnchor="middle"
                        fontSize={9}
                        fill="white"
                        fontWeight={700}
                      >
                        {node.progress_pct}%
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Borda coluna de labels */}
          <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={SVG_H}
            stroke="var(--border)" strokeWidth={1} />
        </svg>
      </div>

      {/* Legenda de tipos */}
      <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
        {Object.entries(NODE_TYPE_COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-3 h-2 rounded inline-block" style={{ background: c }} />
            {k.charAt(0).toUpperCase() + k.slice(1)}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="text-primary font-bold">|</span> Hoje
        </span>
      </div>
    </div>
  );
}

// ── ViewCalendario principal ──────────────────────────────────────────────────
export function ViewCalendario({ projectId, project }: { projectId: string; project: any }) {
  const [view, setView] = useState<"mensal" | "semanal" | "heatmap" | "gantt">("mensal");

  const VIEWS = [
    { id: "mensal",   label: "Mensal",   icon: CalendarDays, desc: "Tarefas e marcos por dia"          },
    { id: "semanal",  label: "Semanal",  icon: Clock,        desc: "Timesheets por colaborador/semana" },
    { id: "heatmap",  label: "Horas",    icon: BarChart2,    desc: "Heatmap mensal de horas trabalhadas"},
    { id: "gantt",    label: "Gantt",    icon: Flag,         desc: "Cronograma WBS com progresso"      },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Seletor de view */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {VIEWS.map(v => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors font-medium",
                view === v.id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={v.desc}
            >
              <Icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      {view === "mensal"   && <ViewMensal   projectId={projectId} />}
      {view === "semanal"  && <ViewSemanal  projectId={projectId} />}
      {view === "heatmap"  && <ViewHeatmap  projectId={projectId} />}
      {view === "gantt"    && <ViewGantt    projectId={projectId} project={project} />}
    </div>
  );
}
