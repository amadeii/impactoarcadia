/**
 * Arcádia Project Hub — Aba Orçamento
 * Sprint HUB-03
 */
import { useState } from "react";
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
  DollarSign, Plus, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, ChevronRight,
  BarChart3, Layers, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface BudgetLine {
  id: string;
  cost_category: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  amount: number;
  wbs_title?: string;
  wbs_code?: string;
}

interface BudgetVersion {
  id: string;
  version: number;
  label?: string;
  status: string;
  total_budget: number;
  approved_at?: string;
  lines?: BudgetLine[];
}

interface KpiData {
  contractValue:    number;
  totalBudget:      number;
  actualCost:       number;
  progressPct:      number;
  cpi:              number | null;
  spi:              number | null;
  eac:              number;
  variance:         number;
  variancePct:      number;
  revenueRecognized:number;
  grossMargin:      number;
  marginPct:        number;
  healthScore:      string;
  byCategory: { cost_category: string; total: string }[];
}

interface BudgetData {
  versions: BudgetVersion[];
  costSummary: { cost_category: string; actual: string; events: number }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const CATEGORY_LABELS: Record<string, string> = {
  mao_obra:    "Mão de Obra",
  material:    "Materiais",
  terceiros:   "Terceiros",
  equipamento: "Equipamentos",
  despesa:     "Despesas",
  overhead:    "Overhead",
};

const CATEGORY_COLORS: Record<string, string> = {
  mao_obra:    "bg-purple-500",
  material:    "bg-blue-500",
  terceiros:   "bg-teal-500",
  equipamento: "bg-amber-500",
  despesa:     "bg-orange-500",
  overhead:    "bg-gray-400",
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, alert }: {
  label: string; value: string; sub?: string; color?: string; alert?: boolean;
}) {
  return (
    <div className={cn(
      "bg-card border rounded-lg p-4",
      alert && "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30"
    )}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={cn("text-xl font-bold", color ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ── Linha de categoria ────────────────────────────────────────────────────────
function CategoryRow({
  category, planned, actual,
}: { category: string; planned: number; actual: number }) {
  const pct     = planned > 0 ? (actual / planned) * 100 : 0;
  const variance = planned - actual;
  const overBudget = actual > planned;
  const barColor = pct > 100 ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-primary";
  const label = CATEGORY_LABELS[category] ?? category;
  const dotColor = CATEGORY_COLORS[category] ?? "bg-gray-400";

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", dotColor)} />
      <div className="w-32 flex-shrink-0">
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="w-28 text-right text-sm text-muted-foreground flex-shrink-0">
        {fmt(planned)}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-10 text-right">{fmtPct(pct)}</span>
        </div>
      </div>
      <div className="w-28 text-right text-sm flex-shrink-0">
        <span className={overBudget ? "text-red-600 font-semibold" : "text-foreground"}>
          {fmt(actual)}
        </span>
      </div>
      <div className={cn("w-28 text-right text-sm font-semibold flex-shrink-0",
        variance >= 0 ? "text-green-600" : "text-red-600")}>
        {variance >= 0 ? "+" : ""}{fmt(variance)}
      </div>
      {overBudget && <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
    </div>
  );
}

// ── Modal de nova linha de orçamento ──────────────────────────────────────────
function AddLineDialog({ open, onClose, versionId, tenantId }: {
  open: boolean; onClose: () => void; versionId: string; tenantId?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    costCategory: "mao_obra", description: "",
    quantity: "1", unit: "un", unitCost: "0",
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/hub/budget/${versionId}/lines`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget"] });
      onClose();
    },
  });

  const amount = (parseFloat(form.quantity) || 0) * (parseFloat(form.unitCost) || 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova linha de orçamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Categoria</label>
              <Select value={form.costCategory} onValueChange={v => setForm(f => ({...f, costCategory: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Unidade</label>
              <Select value={form.unit} onValueChange={v => setForm(f => ({...f, unit: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["un","h","kg","km","dia","m","m2","m3","l"].map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <Input value={form.description}
              onChange={e => setForm(f => ({...f, description: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Quantidade</label>
              <Input type="number" value={form.quantity}
                onChange={e => setForm(f => ({...f, quantity: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Custo unitário (R$)</label>
              <Input type="number" value={form.unitCost}
                onChange={e => setForm(f => ({...f, unitCost: e.target.value}))} />
            </div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <span className="text-sm text-muted-foreground">Total: </span>
            <span className="text-lg font-bold">{fmt(amount)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate({
              costCategory: form.costCategory,
              description: form.description || null,
              quantity: parseFloat(form.quantity) || 1,
              unit: form.unit,
              unitCost: parseFloat(form.unitCost) || 0,
            })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ViewOrcamento principal ───────────────────────────────────────────────────
export function ViewOrcamento({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [addLineOpen, setAddLineOpen] = useState(false);

  const { data: budgetData, isLoading: loadingBudget } = useQuery<BudgetData>({
    queryKey: ["budget", projectId],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}/budget`).then(r => r.json()),
  });

  const { data: kpis, isLoading: loadingKpis } = useQuery<KpiData>({
    queryKey: ["kpis", projectId],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}/kpis`).then(r => r.json()),
  });

  const createVersionMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/hub/projects/${projectId}/budget`, {
      label: "Baseline", status: "rascunho",
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget", projectId] }),
  });

  const approveMutation = useMutation({
    mutationFn: (versionId: string) =>
      apiRequest("PATCH", `/api/hub/budget/${versionId}`, { status: "aprovado" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget", projectId] }),
  });

  const versions = budgetData?.versions ?? [];
  const costSummary = budgetData?.costSummary ?? [];
  const approvedVersion = versions.find(v => v.status === "aprovado");
  const draftVersion    = versions.find(v => v.status === "rascunho");
  const activeVersion   = approvedVersion ?? draftVersion ?? versions[0];

  if (loadingBudget || loadingKpis) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Carregando orçamento...</div>;
  }

  // Montar mapa planned vs actual por categoria
  const plannedByCategory: Record<string, number> = {};
  if (activeVersion?.lines) {
    for (const line of activeVersion.lines) {
      plannedByCategory[line.cost_category] = (plannedByCategory[line.cost_category] ?? 0) + Number(line.amount);
    }
  }
  const actualByCategory: Record<string, number> = {};
  for (const s of costSummary) {
    actualByCategory[s.cost_category] = Number(s.actual);
  }
  const allCategories = [...new Set([
    ...Object.keys(plannedByCategory),
    ...Object.keys(actualByCategory),
  ])];

  const totalBudget = kpis?.totalBudget ?? 0;
  const actualCost  = kpis?.actualCost  ?? 0;
  const budgetUsedPct = totalBudget > 0 ? (actualCost / totalBudget) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Orçamento aprovado" value={fmt(totalBudget)} />
          <KpiCard
            label="Custo realizado"
            value={fmt(actualCost)}
            sub={`${fmtPct(budgetUsedPct)} do orçamento`}
            color={budgetUsedPct > 100 ? "text-red-600" : budgetUsedPct > 85 ? "text-amber-600" : "text-foreground"}
            alert={budgetUsedPct > 85}
          />
          <KpiCard
            label="Saldo disponível"
            value={fmt(totalBudget - actualCost)}
            color={(totalBudget - actualCost) < 0 ? "text-red-600" : "text-green-600"}
          />
          <KpiCard
            label="EAC (projeção ao término)"
            value={fmt(kpis.eac)}
            sub={kpis.cpi ? `CPI: ${kpis.cpi.toFixed(2)}` : undefined}
            color={kpis.eac > totalBudget ? "text-amber-600" : "text-foreground"}
          />
        </div>
      )}

      {/* KPIs EVM */}
      {kpis && (kpis.cpi !== null || kpis.spi !== null) && (
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            label="CPI — Eficiência de custo"
            value={kpis.cpi?.toFixed(2) ?? "—"}
            sub={kpis.cpi ? (kpis.cpi >= 1 ? "Abaixo do orçamento" : "Acima do orçamento") : undefined}
            color={kpis.cpi ? (kpis.cpi >= 1 ? "text-green-600" : "text-red-600") : undefined}
          />
          <KpiCard
            label="SPI — Eficiência de prazo"
            value={kpis.spi?.toFixed(2) ?? "—"}
            sub={kpis.spi ? (kpis.spi >= 1 ? "No prazo" : "Atraso") : undefined}
            color={kpis.spi ? (kpis.spi >= 0.95 ? "text-green-600" : kpis.spi >= 0.85 ? "text-amber-600" : "text-red-600") : undefined}
          />
          <KpiCard
            label="Margem bruta"
            value={fmtPct(kpis.marginPct)}
            sub={`${fmt(kpis.grossMargin)}`}
            color={kpis.marginPct > 20 ? "text-green-600" : kpis.marginPct > 0 ? "text-amber-600" : "text-red-600"}
          />
        </div>
      )}

      {/* Versão ativa + ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Versão ativa:</span>
          {activeVersion ? (
            <Badge variant={activeVersion.status === "aprovado" ? "default" : "secondary"}>
              {activeVersion.label ?? `v${activeVersion.version}`}
              {activeVersion.status === "aprovado" ? " ✓" : " (rascunho)"}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">Nenhuma versão</span>
          )}
        </div>
        <div className="flex gap-2">
          {!activeVersion && (
            <Button size="sm" onClick={() => createVersionMutation.mutate()}
              disabled={createVersionMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Criar orçamento
            </Button>
          )}
          {activeVersion && activeVersion.status === "rascunho" && (
            <Button size="sm" variant="outline"
              onClick={() => approveMutation.mutate(activeVersion.id)}
              disabled={approveMutation.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar baseline
            </Button>
          )}
          {activeVersion && (
            <Button size="sm" onClick={() => setAddLineOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar linha
            </Button>
          )}
        </div>
      </div>

      {/* Tabela comparativa planejado vs real */}
      {allCategories.length > 0 ? (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b text-xs text-muted-foreground font-medium uppercase tracking-wide">
            <div className="w-2.5" />
            <div className="w-32">Categoria</div>
            <div className="w-28 text-right">Planejado</div>
            <div className="flex-1">Consumo</div>
            <div className="w-28 text-right">Realizado</div>
            <div className="w-28 text-right">Variação</div>
            <div className="w-4" />
          </div>
          {allCategories.map(cat => (
            <div key={cat} className="px-4">
              <CategoryRow
                category={cat}
                planned={plannedByCategory[cat] ?? 0}
                actual={actualByCategory[cat] ?? 0}
              />
            </div>
          ))}
          {/* Total */}
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-t font-semibold text-sm">
            <div className="w-2.5" />
            <div className="w-32">Total</div>
            <div className="w-28 text-right">{fmt(totalBudget)}</div>
            <div className="flex-1" />
            <div className="w-28 text-right">{fmt(actualCost)}</div>
            <div className={cn("w-28 text-right",
              (totalBudget - actualCost) >= 0 ? "text-green-600" : "text-red-600")}>
              {fmt(totalBudget - actualCost)}
            </div>
            <div className="w-4" />
          </div>
        </div>
      ) : (
        <div className="text-center py-16 border rounded-lg">
          <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">Sem linhas de orçamento</p>
          <p className="text-xs text-muted-foreground mb-4">
            Crie um orçamento e adicione as categorias de custo do projeto
          </p>
          {!activeVersion && (
            <Button onClick={() => createVersionMutation.mutate()}>
              <Plus className="h-4 w-4 mr-1" /> Criar orçamento
            </Button>
          )}
        </div>
      )}

      {/* Histórico de versões */}
      {versions.length > 1 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">
            Versões anteriores
          </p>
          <div className="flex gap-2 flex-wrap">
            {versions.filter(v => v.status === "substituido").map(v => (
              <Badge key={v.id} variant="outline" className="text-xs">
                {v.label ?? `v${v.version}`} — substituído
              </Badge>
            ))}
          </div>
        </div>
      )}

      {activeVersion && (
        <AddLineDialog
          open={addLineOpen}
          onClose={() => setAddLineOpen(false)}
          versionId={activeVersion.id}
        />
      )}
    </div>
  );
}
