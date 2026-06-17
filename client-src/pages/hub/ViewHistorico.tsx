/**
 * Arcádia Project Hub — Aba Histórico
 * Sprint HUB-09: Linha do tempo consolidada de todos os eventos do projeto
 */
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle2, DollarSign, Clock, FileText,
  MapPin, Users, BarChart2, Receipt, AlertTriangle,
  Edit, TrendingUp, Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  actor?: string;
  amount?: number;
  status?: string;
  date: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 }).format(v);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", {
    day:"2-digit", month:"short", year:"numeric",
    hour:"2-digit", minute:"2-digit",
  });

const EVENT_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  project_created:   { icon:Flag,        color:"text-purple-600", bg:"bg-purple-100 dark:bg-purple-900/40", label:"Projeto criado" },
  status_changed:    { icon:Edit,        color:"text-blue-600",   bg:"bg-blue-100 dark:bg-blue-900/40",    label:"Status alterado" },
  milestone_accepted:{ icon:CheckCircle2,color:"text-green-600",  bg:"bg-green-100 dark:bg-green-900/40",  label:"Marco aceito" },
  ar_generated:      { icon:DollarSign,  color:"text-teal-600",   bg:"bg-teal-100 dark:bg-teal-900/40",    label:"AR gerado" },
  nfse_emitted:      { icon:Receipt,     color:"text-indigo-600", bg:"bg-indigo-100 dark:bg-indigo-900/40",label:"NFS-e emitida" },
  cost_event:        { icon:TrendingUp,  color:"text-amber-600",  bg:"bg-amber-100 dark:bg-amber-900/40",  label:"Custo registrado" },
  timesheet_approved:{ icon:Clock,       color:"text-orange-600", bg:"bg-orange-100 dark:bg-orange-900/40",label:"Horas aprovadas" },
  field_record:      { icon:MapPin,      color:"text-rose-600",   bg:"bg-rose-100 dark:bg-rose-900/40",    label:"Registro de campo" },
  member_added:      { icon:Users,       color:"text-cyan-600",   bg:"bg-cyan-100 dark:bg-cyan-900/40",    label:"Membro adicionado" },
  kpi_alert:         { icon:AlertTriangle,color:"text-red-600",   bg:"bg-red-100 dark:bg-red-900/40",      label:"Alerta KPI" },
  budget_approved:   { icon:BarChart2,   color:"text-violet-600", bg:"bg-violet-100 dark:bg-violet-900/40",label:"Orçamento aprovado" },
  contract_signed:   { icon:FileText,    color:"text-emerald-600",bg:"bg-emerald-100 dark:bg-emerald-900/40",label:"Contrato assinado" },
};

// ── ViewHistorico ─────────────────────────────────────────────────────────────
export function ViewHistorico({ projectId }: { projectId: string }) {
  const { data: events = [], isLoading } = useQuery<TimelineEvent[]>({
    queryKey: [`historico-${projectId}`],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/historico`).then(r => r.json()),
  });

  if (isLoading)
    return <div className="py-8 text-center text-sm text-muted-foreground">Carregando histórico...</div>;

  if (events.length === 0)
    return (
      <div className="text-center py-16">
        <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium mb-1">Histórico vazio</p>
        <p className="text-xs text-muted-foreground">
          Os eventos do projeto aparecerão aqui conforme as ações forem realizadas
        </p>
      </div>
    );

  // Agrupar por data (dia)
  const byDay: Record<string, TimelineEvent[]> = {};
  events.forEach(e => {
    const day = new Date(e.date).toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(e);
  });

  return (
    <div className="space-y-6">
      {Object.entries(byDay).map(([day, dayEvents]) => (
        <div key={day}>
          {/* Separador de data */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2">
              {day}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Eventos do dia */}
          <div className="space-y-3 pl-2">
            {dayEvents.map((evt, idx) => {
              const conf = EVENT_CONFIG[evt.type] ?? EVENT_CONFIG.status_changed;
              const Icon = conf.icon;
              const isLast = idx === dayEvents.length - 1;

              return (
                <div key={evt.id} className="flex gap-4">
                  {/* Linha + ícone */}
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                      conf.bg,
                    )}>
                      <Icon className={cn("h-4 w-4", conf.color)} />
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-border mt-1 min-h-4" />}
                  </div>

                  {/* Conteúdo */}
                  <div className={cn("flex-1 pb-3", !isLast && "border-b border-transparent")}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{evt.title}</p>
                        {evt.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{evt.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {evt.actor && (
                            <span className="text-xs text-muted-foreground">{evt.actor}</span>
                          )}
                          <span className="text-xs text-muted-foreground/60">
                            {new Date(evt.date).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
                          </span>
                        </div>
                      </div>
                      {evt.amount && evt.amount > 0 && (
                        <span className="text-sm font-semibold text-foreground flex-shrink-0">
                          {fmt(evt.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
