/**
 * Arcádia Project Hub — Aba Financeiro
 * Sprint HUB-06: DRE por projeto + histórico KPI + rateio gerencial
 * HUB-IMP-01: sub-aba Bloqueadores de Faturamento
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart2, TrendingUp, TrendingDown, Minus,
  RefreshCw, Plus, CheckCircle2, AlertTriangle,
  XCircle, Clock, Ban, UserX, FileWarning, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DreData {
  receita_contratada:  number;
  receita_faturada:    number;
  receita_reconhecida: number;
  custo_mao_obra:      number;
  custo_material:      number;
  custo_terceiros:     number;
  custo_overhead:      number;
  custo_total:         number;
  margem_bruta:        number;
  margem_bruta_pct:    number;
  horas_total:         number;
  horas_faturavel:     number;
  cpi:                 number | null;
  spi:                 number | null;
  eac:                 number | null;
  health_score:        string;
  custo_por_categoria: { cost_category: string; actual: string }[];
}

interface SnapshotData {
  snapshots: any[];
  last: any;
  trend: { cpi: number; margin: number; cost: number } | null;
}

interface AllocationRule {
  id: string;
  rule_type: string;
  description?: string;
  percentage?: number;
  cost_category?: string;
  approval_status: string;
  active: boolean;
}

interface BillingBlocker {
  id: string;
  tipo: string;
  descricao: string;
  impacto_valor: string | null;
  data_evento: string;
  status: "aberto" | "resolvido" | "cancelado";
  alertado_em: string | null;
  resolvido_em: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
}

// ── Constantes bloqueadores ───────────────────────────────────────────────────
const BLOCKER_TIPOS: Record<string, { label: string; icon: any; color: string }> = {
  acesso_negado:          { label: "Acesso negado ao campo",  icon: Ban,         color: "text-red-600 bg-red-50 dark:bg-red-950/30" },
  cliente_ausente:        { label: "Cliente ausente",         icon: UserX,       color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
  documentacao_pendente:  { label: "Documentação pendente",   icon: FileWarning, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
  outro:                  { label: "Outro motivo",            icon: HelpCircle,  color: "text-gray-600 bg-gray-50 dark:bg-gray-950/30" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt    = (v: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtH   = (v: number) => `${Number(v).toFixed(1)}h`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR");

const CATEGORY_LABELS: Record<string, string> = {
  mao_obra:"Mão de Obra", material:"Materiais", terceiros:"Terceiros",
  equipamento:"Equipamentos", despesa:"Despesas", overhead:"Overhead",
};

const RULE_TYPE_LABELS: Record<string, string> = {
  percentual:"% sobre custos diretos", horas:"% sobre custo de horas",
  receita:"% sobre receita faturada", custo_direto:"Custo direto apurado",
  equipamento:"Horas/km de equipamento", formula:"Fórmula customizada",
};

function TrendBadge({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const positive = inverse ? value < 0 : value > 0;
  const neutral = Math.abs(value) < 0.001;
  if (neutral) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  return positive
    ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
    : <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
}

// ── DRE Line ─────────────────────────────────────────────────────────────────
function DreLine({ label, value, sub, indent = 0, highlight = false, separator = false, negative = false }: {
  label: string; value: number; sub?: string;
  indent?: number; highlight?: boolean; separator?: boolean; negative?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between py-2 px-4",
      separator && "border-t border-b border-border my-1",
      highlight && "font-semibold bg-muted/30",
    )} style={{ paddingLeft: `${indent * 16 + 16}px` }}>
      <span className={cn("text-sm", !highlight && "text-muted-foreground")}>{label}</span>
      <div className="text-right">
        <span className={cn("text-sm", highlight && "font-bold",
          negative && value > 0 ? "text-red-600" : value < 0 ? "text-red-600" : value > 0 ? "text-foreground" : "text-muted-foreground"
        )}>
          {negative && value > 0 ? `(${fmt(value)})` : fmt(Math.abs(value))}
        </span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ── Modal nova regra de rateio ────────────────────────────────────────────────
function AllocationDialog({ open, onClose, projectId }: {
  open: boolean; onClose: () => void; projectId: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    ruleType: "percentual", description: "",
    percentage: "5", costCategory: "overhead",
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/hub/projects/${projectId}/allocation-rules`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`alloc-${projectId}`] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova regra de rateio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo de rateio</label>
            <Select value={form.ruleType} onValueChange={v => setForm(f => ({...f, ruleType: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(RULE_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <Input value={form.description}
              onChange={e => setForm(f => ({...f, description: e.target.value}))}
              placeholder="Ex: Overhead administrativo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Percentual (%)</label>
              <Input type="number" min="0" max="100" step="0.1" value={form.percentage}
                onChange={e => setForm(f => ({...f, percentage: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Categoria de custo</label>
              <Select value={form.costCategory} onValueChange={v => setForm(f => ({...f, costCategory: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate({
              ruleType: form.ruleType,
              description: form.description || null,
              percentage: parseFloat(form.percentage),
              costCategory: form.costCategory,
            })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Criando..." : "Criar regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal novo bloqueador de faturamento ──────────────────────────────────────
function BlockerDialog({ open, onClose, projectId }: {
  open: boolean; onClose: () => void; projectId: string;
}) {
  const qc = useQueryClient();
  const EMPTY = { tipo: "acesso_negado", descricao: "", impactoValor: "", dataEvento: new Date().toISOString().slice(0,10), observacoes: "" };
  const [form, setForm] = useState(EMPTY);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/hub/projects/${projectId}/billing-blockers`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`blockers-${projectId}`] });
      setForm(EMPTY);
      onClose();
    },
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Registrar bloqueador de faturamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Tipo */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo do bloqueador</label>
            <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BLOCKER_TIPOS).map(([v, { label }]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Descrição <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={form.descricao}
              onChange={e => set("descricao", e.target.value)}
              placeholder="Descreva o que impediu o avanço do faturamento..."
              rows={3}
            />
          </div>

          {/* Impacto + Data lado a lado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Valor em risco (R$)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.impactoValor}
                onChange={e => set("impactoValor", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Data do evento</label>
              <Input
                type="date"
                value={form.dataEvento}
                onChange={e => set("dataEvento", e.target.value)}
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Observações adicionais</label>
            <Textarea
              value={form.observacoes}
              onChange={e => set("observacoes", e.target.value)}
              placeholder="Contatos tentados, próximos passos, etc."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!form.descricao.trim()) return;
              mutation.mutate({
                tipo: form.tipo,
                descricao: form.descricao.trim(),
                impactoValor: form.impactoValor ? parseFloat(form.impactoValor) : null,
                dataEvento: form.dataEvento,
                observacoes: form.observacoes.trim() || null,
              });
            }}
            disabled={mutation.isPending || !form.descricao.trim()}
          >
            {mutation.isPending ? "Registrando..." : "Registrar bloqueador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de resolução ────────────────────────────────────────────────────────
function ResolveDialog({ blocker, onClose }: {
  blocker: BillingBlocker | null; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [obs, setObs] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("PATCH", `/api/hub/billing-blockers/${blocker!.id}/resolve`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [/blockers-/] });
      setObs("");
      onClose();
    },
  });

  return (
    <Dialog open={!!blocker} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Resolver bloqueador
          </DialogTitle>
        </DialogHeader>

        {blocker && (
          <div className="space-y-3 py-1">
            {/* Resumo do bloqueador */}
            <div className="bg-muted/40 rounded-lg p-3 text-sm">
              <p className="font-medium">{BLOCKER_TIPOS[blocker.tipo]?.label ?? blocker.tipo}</p>
              <p className="text-muted-foreground mt-1">{blocker.descricao}</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Como foi resolvido?</label>
              <Textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Descreva a ação que desbloqueou o faturamento..."
                rows={3}
                autoFocus
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate({ observacoes: obs.trim() || null })}
            disabled={mutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {mutation.isPending ? "Resolvendo..." : "Confirmar resolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Card de bloqueador ────────────────────────────────────────────────────────
function BlockerCard({ blocker, onResolve }: {
  blocker: BillingBlocker;
  onResolve: (b: BillingBlocker) => void;
}) {
  const cfg = BLOCKER_TIPOS[blocker.tipo] ?? BLOCKER_TIPOS.outro;
  const Icon = cfg.icon;
  const isOpen = blocker.status === "aberto";

  return (
    <div className={cn(
      "border rounded-lg p-4 space-y-2 transition-opacity",
      !isOpen && "opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("p-1.5 rounded-md flex-shrink-0", cfg.color)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{cfg.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmtDate(blocker.data_evento)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {blocker.impacto_valor && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">
              {fmt(Number(blocker.impacto_valor))} em risco
            </span>
          )}
          <Badge
            variant={isOpen ? "destructive" : "secondary"}
            className="text-xs"
          >
            {isOpen ? "Aberto" : blocker.status === "resolvido" ? "Resolvido" : "Cancelado"}
          </Badge>
        </div>
      </div>

      {/* Descrição */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {blocker.descricao}
      </p>

      {/* Resolução */}
      {blocker.status === "resolvido" && blocker.observacoes && (
        <div className="flex items-start gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-2.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-green-700 dark:text-green-400">Resolvido: </span>
            <span className="text-green-700 dark:text-green-400">{blocker.observacoes}</span>
            {blocker.resolvido_em && (
              <span className="text-green-600/70 ml-1">
                ({fmtDate(blocker.resolvido_em)})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Ação */}
      {isOpen && (
        <div className="pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
            onClick={() => onResolve(blocker)}
          >
            <CheckCircle2 className="h-3 w-3 mr-1.5" />
            Marcar como resolvido
          </Button>
        </div>
      )}
    </div>
  );
}

// ── ViewFinanceiro principal ──────────────────────────────────────────────────
export function ViewFinanceiro({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dre" | "historico" | "rateio" | "bloqueadores">("dre");
  const [allocOpen,   setAllocOpen]   = useState(false);
  const [blockerOpen, setBlockerOpen] = useState(false);
  const [resolving,   setResolving]   = useState<BillingBlocker | null>(null);
  const [showAll,     setShowAll]     = useState(false);

  const { data: dre, isLoading: loadingDre } = useQuery<DreData>({
    queryKey: [`dre-${projectId}`],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}/dre`).then(r => r.json()),
  });

  const { data: snapData } = useQuery<SnapshotData>({
    queryKey: [`snap-${projectId}`],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}/snapshots?days=60`).then(r => r.json()),
    enabled: tab === "historico",
  });

  const { data: rules = [] } = useQuery<AllocationRule[]>({
    queryKey: [`alloc-${projectId}`],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}/allocation-rules`).then(r => r.json()),
    enabled: tab === "rateio",
  });

  const { data: blockersRes, isLoading: loadingBlockers } = useQuery<{ data: BillingBlocker[] }>({
    queryKey: [`blockers-${projectId}`, showAll],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/billing-blockers${showAll ? "" : "?status=aberto"}`)
        .then(r => r.json()),
    enabled: tab === "bloqueadores",
  });
  const blockers = blockersRes?.data ?? [];
  const openCount = blockers.filter(b => b.status === "aberto").length;

  const snapshotMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/hub/projects/${projectId}/snapshots`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`dre-${projectId}`] });
      qc.invalidateQueries({ queryKey: [`snap-${projectId}`] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (ruleId: string) =>
      apiRequest("PATCH", `/api/hub/allocation-rules/${ruleId}`, { approvalStatus: "aprovado" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`alloc-${projectId}`] }),
  });

  if (loadingDre) return <div className="py-8 text-center text-sm text-muted-foreground">Calculando DRE...</div>;

  const d = dre;

  const SUBTABS = [
    { id: "dre",          label: "DRE"         },
    { id: "historico",    label: "Histórico KPI"},
    { id: "rateio",       label: "Rateio"       },
    { id: "bloqueadores", label: openCount > 0
        ? `Bloqueadores (${openCount})`
        : "Bloqueadores",
    },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {SUBTABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-1.5 text-xs rounded-md transition-colors font-medium whitespace-nowrap",
                tab === t.id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
                t.id === "bloqueadores" && openCount > 0 && tab !== "bloqueadores"
                  && "text-red-600 dark:text-red-400"
              )}>
              {t.label}
            </button>
          ))}
        </div>
        {tab !== "bloqueadores" && (
          <Button size="sm" variant="ghost" onClick={() => snapshotMutation.mutate()}
            disabled={snapshotMutation.isPending}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", snapshotMutation.isPending && "animate-spin")} />
            Atualizar
          </Button>
        )}
        {tab === "bloqueadores" && (
          <Button size="sm" onClick={() => setBlockerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Registrar bloqueador
          </Button>
        )}
      </div>

      {/* ── DRE ── */}
      {tab === "dre" && d && (
        <div className="space-y-4">
          {/* KPIs rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Receita reconhecida</p>
              <p className="text-xl font-bold text-primary">{fmt(d.receita_reconhecida)}</p>
              <p className="text-xs text-muted-foreground mt-1">Faturada: {fmt(d.receita_faturada)}</p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Custo total</p>
              <p className="text-xl font-bold">{fmt(d.custo_total)}</p>
            </div>
            <div className={cn("border rounded-lg p-4",
              d.margem_bruta_pct > 20 ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800" :
              d.margem_bruta_pct > 0  ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" :
              "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800")}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Margem bruta</p>
              <p className={cn("text-xl font-bold",
                d.margem_bruta_pct > 0 ? "text-green-700 dark:text-green-400" : "text-red-700")}>
                {fmtPct(d.margem_bruta_pct)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{fmt(d.margem_bruta)}</p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">CPI / SPI</p>
              <p className="text-xl font-bold">
                {d.cpi?.toFixed(2) ?? "—"} / {d.spi?.toFixed(2) ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {fmtH(d.horas_faturavel)} fat. / {fmtH(d.horas_total)} total
              </p>
            </div>
          </div>

          {/* DRE vertical */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="text-sm font-semibold">Demonstrativo de Resultado — Projeto</h3>
            </div>
            <DreLine label="Receita contratada"  value={d.receita_contratada} />
            <DreLine label="Receita faturada"    value={d.receita_faturada}   indent={1} />
            <DreLine label="Receita reconhecida" value={d.receita_reconhecida} indent={1}
              sub="Método: % de avanço físico" highlight />
            <DreLine label="Custo mão de obra"   value={d.custo_mao_obra}   indent={1} negative />
            <DreLine label="Custo materiais"     value={d.custo_material}   indent={1} negative />
            <DreLine label="Custo terceiros"     value={d.custo_terceiros}  indent={1} negative />
            <DreLine label="Custo overhead"      value={d.custo_overhead}   indent={1} negative />
            <DreLine label="(-) Custo total"     value={d.custo_total}      negative separator highlight />
            <DreLine label="= Margem Bruta"      value={d.margem_bruta}
              sub={fmtPct(d.margem_bruta_pct)}  highlight separator />
            {d.eac !== null && (
              <DreLine label="EAC (projeção ao término)" value={d.eac} indent={1}
                sub={`Variação: ${fmt(d.custo_total - (d.eac ?? 0))}`} />
            )}
          </div>
        </div>
      )}

      {/* ── Histórico KPI ── */}
      {tab === "historico" && snapData && (
        <div className="space-y-4">
          {snapData.trend && (
            <div className="flex gap-3">
              {[
                { label: "Tendência CPI",    val: snapData.trend.cpi,    fmt: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(3)}`, inv: false },
                { label: "Tendência margem", val: snapData.trend.margin, fmt: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}pp`, inv: false },
                { label: "Variação custo",   val: snapData.trend.cost,   fmt: (v: number) => fmt(Math.abs(v)), inv: true },
              ].map(({ label, val, fmt: f, inv }) => (
                <div key={label} className="bg-card border rounded-lg p-4 flex items-center gap-3 flex-1">
                  <TrendBadge value={val} inverse={inv} />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold">{f(val)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {snapData.snapshots.length > 1 ? (
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Evolução — últimos 60 dias
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={snapData.snapshots.map((s: any) => ({
                  date: new Date(s.snapshot_date).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }),
                  Custo: Number(s.cost_actual),
                  Receita: Number(s.revenue_recognized),
                  Margem: Number(s.gross_margin),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="Receita" stroke="#4A9EE8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Custo"   stroke="#E8624A" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Margem"  stroke="#2DB87C" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-muted-foreground border rounded-lg">
              Dados insuficientes — gere snapshots diários para visualizar o histórico
              <div className="mt-3">
                <Button size="sm" onClick={() => snapshotMutation.mutate()}>
                  Gerar snapshot agora
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Rateio ── */}
      {tab === "rateio" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Regras de rateio de custos indiretos (overhead) para este projeto
            </p>
            <Button size="sm" onClick={() => setAllocOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova regra
            </Button>
          </div>

          {rules.length === 0 ? (
            <div className="text-center py-16 border rounded-lg border-dashed">
              <p className="text-sm text-muted-foreground mb-3">Nenhuma regra de rateio configurada</p>
              <Button size="sm" onClick={() => setAllocOpen(true)}>Adicionar primeira regra</Button>
            </div>
          ) : (
            <div className="bg-card border rounded-lg divide-y">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{rule.description ?? RULE_TYPE_LABELS[rule.rule_type]}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {RULE_TYPE_LABELS[rule.rule_type]}
                      {rule.percentage ? ` — ${rule.percentage}%` : ""}
                      {rule.cost_category ? ` → ${CATEGORY_LABELS[rule.cost_category] ?? rule.cost_category}` : ""}
                    </p>
                  </div>
                  <Badge variant={rule.approval_status === "aprovado" ? "default" : "secondary"}>
                    {rule.approval_status === "aprovado" ? "Aprovado" : "Rascunho"}
                  </Badge>
                  {rule.approval_status !== "aprovado" && (
                    <Button size="sm" variant="outline"
                      onClick={() => approveMutation.mutate(rule.id)}
                      disabled={approveMutation.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            Regras aprovadas são aplicadas automaticamente no cálculo do DRE do projeto e
            nos snapshots diários de KPI.
          </div>
        </div>
      )}

      {/* ── Bloqueadores de Faturamento ── */}
      {tab === "bloqueadores" && (
        <div className="space-y-4">

          {/* Resumo de risco */}
          {blockers.filter(b => b.status === "aberto").length > 0 && (() => {
            const abertos = blockers.filter(b => b.status === "aberto");
            const totalRisco = abertos.reduce((s, b) => s + Number(b.impacto_valor ?? 0), 0);
            return (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                      {abertos.length} bloqueador{abertos.length > 1 ? "es" : ""} aberto{abertos.length > 1 ? "s" : ""}
                    </p>
                    {totalRisco > 0 && (
                      <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                        {fmt(totalRisco)} em valor de faturamento em risco
                      </p>
                    )}
                  </div>
                  <Clock className="h-4 w-4 text-red-400" />
                </div>
              </div>
            );
          })()}

          {/* Filtro histórico */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAll(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
            >
              {showAll ? "Mostrar apenas abertos" : "Ver histórico completo"}
            </button>
            <span className="text-xs text-muted-foreground">
              {blockers.length} registro{blockers.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Lista */}
          {loadingBlockers ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : blockers.length === 0 ? (
            <div className="text-center py-16 border rounded-lg border-dashed space-y-3">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-400" />
              <div>
                <p className="text-sm font-medium">Nenhum bloqueador registrado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Registre aqui eventos que impedem ou atrasam o faturamento do projeto
                </p>
              </div>
              <Button size="sm" onClick={() => setBlockerOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Registrar primeiro bloqueador
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {blockers.map(b => (
                <BlockerCard key={b.id} blocker={b} onResolve={setResolving} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      <AllocationDialog
        open={allocOpen}
        onClose={() => setAllocOpen(false)}
        projectId={projectId}
      />
      <BlockerDialog
        open={blockerOpen}
        onClose={() => setBlockerOpen(false)}
        projectId={projectId}
      />
      <ResolveDialog
        blocker={resolving}
        onClose={() => setResolving(null)}
      />
    </div>
  );
}
