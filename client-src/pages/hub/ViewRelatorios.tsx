/**
 * Arcádia Project Hub — Aba Relatórios (REPORT-01)
 * 1. Tarefas Atrasadas — delayed tasks com dias de atraso calculados
 * 2. Timesheet Billing Summary — horas, custo, faturável por colaborador e atividade
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, Clock, DollarSign, Users,
  TrendingUp, TrendingDown, BarChart2,
  Download, Filter,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = (v: number | string) =>
  new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 }).format(Number(v));
const fmtH = (v: number | string) => `${Number(v).toFixed(1)}h`;
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" }) : "—";

const PRIORITY_COLORS: Record<string, string> = {
  critica: "text-red-600 bg-red-50 dark:bg-red-950/30",
  alta:    "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  media:   "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  baixa:   "text-gray-500 bg-gray-50 dark:bg-gray-900/30",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  backlog:   { label:"Backlog",        color:"text-gray-500" },
  todo:      { label:"A fazer",        color:"text-blue-500" },
  doing:     { label:"Em andamento",   color:"text-teal-500" },
  review:    { label:"Revisão",        color:"text-amber-500" },
  done:      { label:"Concluído",      color:"text-green-500" },
  blocked:   { label:"Bloqueado",      color:"text-red-500" },
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color?: string; icon?: any;
}) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className={cn("text-2xl font-bold", color ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ── RELATÓRIO 1: Tarefas Atrasadas ────────────────────────────────────────────
function RelDelayedTasks({ projectId }: { projectId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to)   params.set("to", to);

  const { data, isLoading } = useQuery<any>({
    queryKey: [`report-delayed-${projectId}`, from, to],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/reports/delayed-tasks?${params}`)
        .then(r => r.json()),
  });

  const tasks      = data?.tasks ?? [];
  const summary    = data?.summary ?? {};
  const byAssignee = data?.byAssignee ?? [];
  const byPriority = data?.byPriority ?? [];

  // CSV export
  const exportCsv = () => {
    const rows = [
      ["Tarefa","Status","Prioridade","Prazo","Dias Atraso","Responsável","WBS"],
      ...tasks.map((t: any) => [
        t.title, t.status, t.priority,
        fmtDate(t.due_date), t.days_late ?? "—",
        t.assignee_name ?? "—", t.wbs_code ?? "—",
      ]),
    ];
    const csv = rows.map(r => r.map(String).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url;
    a.download = `tarefas_atrasadas_${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Prazo entre:
        </div>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 w-36 text-xs" />
        <span className="text-xs text-muted-foreground">e</span>
        <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 w-36 text-xs" />
        <Button size="sm" variant="outline" onClick={exportCsv} className="ml-auto gap-1.5">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total atrasadas"
          value={String(summary.totalAtrasadas ?? 0)}
          color="text-red-600"
          icon={AlertTriangle}
        />
        <KpiCard
          label="Ainda abertas"
          value={String(summary.aindaAbertas ?? 0)}
          color={summary.aindaAbertas > 0 ? "text-red-600" : "text-green-600"}
          icon={Clock}
        />
        <KpiCard
          label="Concluídas com atraso"
          value={String(summary.concluidasComAtraso ?? 0)}
          color="text-amber-600"
        />
        <KpiCard
          label="Maior atraso"
          value={summary.maxDaysLate ? `${summary.maxDaysLate}d` : "—"}
          color={summary.maxDaysLate > 14 ? "text-red-600" : "text-amber-600"}
        />
      </div>

      {/* Gráfico por prioridade */}
      {byPriority.length > 0 && (
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Por prioridade
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={byPriority} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="priority" type="category" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v: number) => `${v} tarefas`} />
              <Bar dataKey="abertas"  name="Abertas"  fill="#EF4444" radius={[0,3,3,0]} />
              <Bar dataKey="total" name="Total" fill="#94A3B8" radius={[0,3,3,0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela de tarefas */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <AlertTriangle className="h-10 w-10 mx-auto text-green-500 mb-3" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Nenhuma tarefa atrasada
          </p>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="grid border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            style={{ gridTemplateColumns: "2fr 80px 80px 90px 80px 120px 60px" }}>
            {["Tarefa","Prioridade","Status","Prazo","Atraso","Responsável","WBS"].map(h => (
              <div key={h} className="px-3 py-2">{h}</div>
            ))}
          </div>
          {tasks.map((task: any, i: number) => {
            const open = task.delay_status === "em_atraso";
            return (
              <div key={task.id}
                className={cn(
                  "grid border-b last:border-0 text-sm items-center",
                  i % 2 !== 0 && "bg-muted/20",
                  open && "bg-red-50/30 dark:bg-red-950/10",
                )}
                style={{ gridTemplateColumns: "2fr 80px 80px 90px 80px 120px 60px" }}>
                <div className="px-3 py-2.5 truncate font-medium">{task.title}</div>
                <div className="px-3 py-2.5">
                  <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                    PRIORITY_COLORS[task.priority] ?? "")}>
                    {task.priority}
                  </span>
                </div>
                <div className="px-3 py-2.5">
                  <span className={cn("text-xs", STATUS_LABEL[task.status]?.color)}>
                    {STATUS_LABEL[task.status]?.label ?? task.status}
                  </span>
                </div>
                <div className="px-3 py-2.5 text-xs text-muted-foreground">
                  {fmtDate(task.due_date)}
                </div>
                <div className={cn("px-3 py-2.5 text-xs font-bold tabular-nums",
                  task.days_late > 14 ? "text-red-600" :
                  task.days_late > 7  ? "text-amber-600" : "text-orange-500")}>
                  {task.days_late ? `+${task.days_late}d` : "—"}
                </div>
                <div className="px-3 py-2.5 text-xs truncate text-muted-foreground">
                  {task.assignee_name ?? "—"}
                </div>
                <div className="px-3 py-2.5 text-[10px] font-mono text-muted-foreground">
                  {task.wbs_code ?? "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Por colaborador */}
      {byAssignee.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Por responsável
          </div>
          {byAssignee.map((a: any) => (
            <div key={a.assignee_name}
              className="flex items-center gap-4 px-4 py-2.5 border-b last:border-0 text-sm">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                {a.assignee_name[0].toUpperCase()}
              </div>
              <span className="flex-1 truncate">{a.assignee_name}</span>
              <span className="text-xs text-red-600 font-semibold">
                {a.total_atrasadas} atrasadas
              </span>
              <span className="text-xs text-muted-foreground">
                {a.ainda_abertas} abertas
              </span>
              <span className="text-xs text-muted-foreground">
                média {a.media_dias_atraso}d
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── RELATÓRIO 2: Timesheet Billing Summary ────────────────────────────────────
function RelBillingSummary({ projectId }: { projectId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to)   params.set("to", to);

  const { data, isLoading } = useQuery<any>({
    queryKey: [`report-billing-${projectId}`, from, to],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/reports/billing-summary?${params}`)
        .then(r => r.json()),
  });

  const totals     = data?.totals     ?? {};
  const byUser     = data?.byUser     ?? [];
  const byActivity = data?.byActivity ?? [];
  const weekly     = data?.weekly     ?? [];
  const marcos     = data?.marcos     ?? [];

  const totalFaturado = marcos.filter((m: any) =>
    ["faturado","recebido"].includes(m.status)
  ).reduce((s: number, m: any) => s + Number(m.valor), 0);

  const exportCsv = () => {
    const rows = [
      ["Colaborador","Horas Total","Horas Faturáveis","Custo","Valor Faturável","Eficiência"],
      ...byUser.map((u: any) => [
        u.user_name ?? "—",
        Number(u.horas_total).toFixed(2),
        Number(u.horas_faturavel).toFixed(2),
        Number(u.custo_total).toFixed(2),
        Number(u.valor_faturavel).toFixed(2),
        u.eficiencia ?? "—",
      ]),
    ];
    const csv = rows.map(r => r.map(String).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url;
    a.download = `billing_summary_${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Período:
        </div>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 w-36 text-xs" />
        <span className="text-xs text-muted-foreground">a</span>
        <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 w-36 text-xs" />
        <Button size="sm" variant="outline" onClick={exportCsv} className="ml-auto gap-1.5">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Horas totais"
          value={fmtH(totals.horas_total ?? 0)}
          sub={`${totals.colaboradores ?? 0} colaboradores`}
          icon={Clock}
        />
        <KpiCard
          label="Horas faturáveis"
          value={fmtH(totals.horas_faturavel ?? 0)}
          sub={totals.horas_total > 0
            ? `${((totals.horas_faturavel / totals.horas_total) * 100).toFixed(0)}% do total`
            : undefined}
          color="text-primary"
          icon={TrendingUp}
        />
        <KpiCard
          label="Valor faturável (T&M)"
          value={fmt(totals.valor_faturavel ?? 0)}
          sub={`Custo: ${fmt(totals.custo_total ?? 0)}`}
          icon={DollarSign}
        />
        <KpiCard
          label="Marcos faturados"
          value={fmt(totalFaturado)}
          sub={`${marcos.filter((m: any) => m.status === "recebido").reduce((s: number, m: any) => s + Number(m.valor), 0) > 0 ? fmt(marcos.filter((m: any) => m.status === "recebido").reduce((s: number, m: any) => s + Number(m.valor), 0)) + " recebido" : "nenhum recebido"}`}
          color="text-green-600"
          icon={TrendingUp}
        />
      </div>

      {/* Evolução semanal */}
      {weekly.length > 1 && (
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Evolução semanal
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weekly.map((w: any) => ({
              semana: new Date(w.semana).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }),
              Horas:  Number(w.horas),
              Faturável: Number(w.faturavel),
              Custo:  Number(w.custo),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="h" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="r" orientation="right" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, name: string) =>
                name === "Horas" ? fmtH(v) : fmt(v)} />
              <Legend />
              <Line yAxisId="h" type="monotone" dataKey="Horas"     stroke="#4A9EE8" strokeWidth={2} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="Faturável" stroke="#2DB87C" strokeWidth={2} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="Custo"     stroke="#E8624A" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Por colaborador */}
      {byUser.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="grid border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            style={{ gridTemplateColumns: "1.5fr 80px 80px 100px 100px 70px" }}>
            {["Colaborador","Horas","Fat.","Custo","Faturável","Efic."].map(h => (
              <div key={h} className="px-3 py-2">{h}</div>
            ))}
          </div>
          {byUser.map((u: any, i: number) => {
            const efic = Number(u.eficiencia ?? 0);
            return (
              <div key={u.user_name}
                className={cn("grid items-center border-b last:border-0 text-sm",
                  i % 2 !== 0 && "bg-muted/20")}
                style={{ gridTemplateColumns: "1.5fr 80px 80px 100px 100px 70px" }}>
                <div className="px-3 py-2.5 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                    {(u.user_name ?? "?")[0].toUpperCase()}
                  </div>
                  <span className="truncate text-sm">{u.user_name ?? "—"}</span>
                </div>
                <div className="px-3 py-2.5 text-xs tabular-nums">{fmtH(u.horas_total)}</div>
                <div className="px-3 py-2.5 text-xs tabular-nums text-primary">{fmtH(u.horas_faturavel)}</div>
                <div className="px-3 py-2.5 text-xs tabular-nums text-red-600">{fmt(u.custo_total)}</div>
                <div className="px-3 py-2.5 text-xs tabular-nums text-green-600 font-semibold">{fmt(u.valor_faturavel)}</div>
                <div className={cn("px-3 py-2.5 text-xs font-bold tabular-nums",
                  efic >= 1.2 ? "text-green-600" :
                  efic >= 1.0 ? "text-teal-600"  :
                  efic > 0    ? "text-amber-600"  : "text-muted-foreground")}>
                  {efic > 0 ? `${efic.toFixed(2)}x` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Por atividade */}
      {byActivity.length > 0 && (
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Por tipo de atividade
          </p>
          <div className="space-y-2">
            {byActivity.map((a: any) => {
              const pctFat = Number(a.pct_faturavel ?? 0);
              return (
                <div key={a.activity_type} className="flex items-center gap-3">
                  <span className="text-xs capitalize text-muted-foreground w-24">{a.activity_type}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/40 rounded-full relative overflow-hidden"
                      style={{ width: `${(Number(a.horas) / Number(byActivity[0]?.horas || 1)) * 100}%` }}>
                      <div className="absolute inset-y-0 left-0 bg-primary rounded-full"
                        style={{ width: `${pctFat}%` }} />
                    </div>
                  </div>
                  <span className="text-xs tabular-nums w-10 text-right">{fmtH(a.horas)}</span>
                  <span className="text-xs text-muted-foreground w-8 text-right">{pctFat.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ViewRelatorios principal ──────────────────────────────────────────────────
export function ViewRelatorios({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<"delayed" | "billing">("delayed");

  return (
    <div className="space-y-4">
      {/* Seletor de relatório */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setReport("delayed")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-md transition-colors font-medium",
            report === "delayed"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Tarefas Atrasadas
        </button>
        <button
          onClick={() => setReport("billing")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-md transition-colors font-medium",
            report === "billing"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <DollarSign className="h-3.5 w-3.5" />
          Billing Summary
        </button>
      </div>

      {report === "delayed" && <RelDelayedTasks projectId={projectId} />}
      {report === "billing" && <RelBillingSummary projectId={projectId} />}
    </div>
  );
}
