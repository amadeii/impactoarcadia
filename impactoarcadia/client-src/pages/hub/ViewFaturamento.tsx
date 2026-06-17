/**
 * Arcádia Project Hub — Aba Faturamento
 * Sprint HUB-04
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
  FileText, Plus, CheckCircle2, Clock, DollarSign,
  AlertTriangle, XCircle, ChevronRight, Receipt,
  TrendingUp, Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Contract {
  id: string;
  contract_number?: string;
  contract_type: string;
  total_value: number;
  retention_percent: number;
  status: string;
  milestones?: Milestone[];
  total_billed?: number;
  total_received?: number;
}

interface Milestone {
  id: string;
  title: string;
  amount: number;
  status: string;
  due_date?: string;
  accepted_at?: string;
  acceptance_required: boolean;
  ar_lancamento_id?: string;
  fiscal_event_id?: string;
  wbs_title?: string;
  wbs_code?: string;
}

interface MilestonesResponse {
  milestones: Milestone[];
  kpis: {
    totalContrato: number;
    totalFaturado: number;
    totalRecebido: number;
    totalPendente: number;
    totalBloqueado: number;
    pctFaturado: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number | string) =>
  new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 }).format(Number(v));
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" }) : "—";

const MILESTONE_STATUS: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  pendente:  { label:"Pendente",      color:"text-gray-500",  icon:Clock,        bg:"bg-gray-50 dark:bg-gray-900/30"   },
  atingido:  { label:"Atingido",      color:"text-blue-600",  icon:TrendingUp,   bg:"bg-blue-50 dark:bg-blue-900/20"   },
  faturado:  { label:"Faturado",      color:"text-purple-600",icon:Receipt,      bg:"bg-purple-50 dark:bg-purple-900/20"},
  recebido:  { label:"Recebido",      color:"text-green-600", icon:CheckCircle2, bg:"bg-green-50 dark:bg-green-900/20" },
  bloqueado: { label:"Bloqueado",     color:"text-red-600",   icon:XCircle,      bg:"bg-red-50 dark:bg-red-900/20"     },
  cancelado: { label:"Cancelado",     color:"text-gray-400",  icon:XCircle,      bg:""                                 },
};

const CONTRACT_TYPE: Record<string, string> = {
  fixed_price:   "Preço fixo",
  time_material: "T&M",
  unit_price:    "Preço unitário",
  cost_plus:     "Custo + taxa",
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={cn("text-xl font-bold", color ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ── Modal de aceite ───────────────────────────────────────────────────────────
function AceiteDialog({
  open, onClose, milestone, projectId,
}: { open: boolean; onClose: () => void; milestone: Milestone; projectId: string }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/hub/milestones/${milestone.id}/accept`, {
        acceptanceNotes: notes || null,
      }),
    onSuccess: (res) => {
      res.json().then((data) => {
        qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/milestones`] });
        qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/contracts`] });
        onClose();
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Registrar aceite do marco
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm font-medium">{milestone.title}</p>
            <p className="text-lg font-bold text-primary mt-1">{fmt(milestone.amount)}</p>
            {milestone.due_date && (
              <p className="text-xs text-muted-foreground mt-1">Vencimento: {fmtDate(milestone.due_date)}</p>
            )}
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
            O aceite irá:
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              <li>Gerar AR no Control automaticamente</li>
              <li>Criar evento fiscal para NFS-e</li>
              <li>Atualizar status para "Faturado"</li>
            </ul>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Observações (opcional)</label>
            <textarea
              className="w-full min-h-[72px] rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Condições do aceite, ressalvas..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="bg-green-600 hover:bg-green-700">
            {mutation.isPending ? "Processando..." : "Confirmar aceite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de novo contrato ────────────────────────────────────────────────────
function ContractDialog({ open, onClose, projectId }: {
  open: boolean; onClose: () => void; projectId: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    contractNumber: "", contractType: "fixed_price",
    totalValue: "", retentionPercent: "0", notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/hub/projects/${projectId}/contracts`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/contracts`] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Número</label>
              <Input value={form.contractNumber}
                onChange={e => setForm(f => ({...f, contractNumber: e.target.value}))}
                placeholder="CTR-2026-001" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tipo</label>
              <Select value={form.contractType} onValueChange={v => setForm(f => ({...f, contractType: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_TYPE).map(([v,l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Valor total (R$) *</label>
              <Input type="number" value={form.totalValue}
                onChange={e => setForm(f => ({...f, totalValue: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Retenção (%)</label>
              <Input type="number" value={form.retentionPercent}
                onChange={e => setForm(f => ({...f, retentionPercent: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Observações</label>
            <Input value={form.notes}
              onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate({
              ...form,
              totalValue: parseFloat(form.totalValue),
              retentionPercent: parseFloat(form.retentionPercent) || 0,
            })}
            disabled={mutation.isPending || !form.totalValue}
          >
            {mutation.isPending ? "Criando..." : "Criar contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de novo marco ───────────────────────────────────────────────────────
function MilestoneDialog({ open, onClose, contractId, projectId }: {
  open: boolean; onClose: () => void; contractId: string; projectId: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", amount: "", dueDate: "",
    triggerType: "manual", acceptanceRequired: true,
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/hub/contracts/${contractId}/milestones`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/milestones`] });
      qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/contracts`] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo marco de faturamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição *</label>
            <Input value={form.title}
              onChange={e => setForm(f => ({...f, title: e.target.value}))}
              placeholder="Ex: Entrega Relatório Final" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Valor (R$) *</label>
              <Input type="number" value={form.amount}
                onChange={e => setForm(f => ({...f, amount: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Vencimento</label>
              <Input type="date" value={form.dueDate}
                onChange={e => setForm(f => ({...f, dueDate: e.target.value}))} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="acceptance"
              checked={form.acceptanceRequired}
              onChange={e => setForm(f => ({...f, acceptanceRequired: e.target.checked}))}
              className="rounded"
            />
            <label htmlFor="acceptance" className="text-sm">Requer aceite formal do cliente</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate({
              ...form,
              amount: parseFloat(form.amount),
              dueDate: form.dueDate || null,
            })}
            disabled={mutation.isPending || !form.title || !form.amount}
          >
            {mutation.isPending ? "Criando..." : "Criar marco"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ViewFaturamento principal ─────────────────────────────────────────────────
export function ViewFaturamento({ projectId }: { projectId: string }) {
  const [contractOpen, setContractOpen] = useState(false);
  const [milestoneContractId, setMilestoneContractId] = useState<string | null>(null);
  const [aceiteMarco, setAceiteMarco] = useState<Milestone | null>(null);
  const qc = useQueryClient();

  const { data: contracts = [], isLoading: loadingContracts } = useQuery<Contract[]>({
    queryKey: [`/api/hub/projects/${projectId}/contracts`],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}/contracts`).then(r => r.json()),
  });

  const { data: milestonesData, isLoading: loadingMilestones } = useQuery<MilestonesResponse>({
    queryKey: [`/api/hub/projects/${projectId}/milestones`],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}/milestones`).then(r => r.json()),
  });

  const receiveMutation = useMutation({
    mutationFn: (milestoneId: string) =>
      apiRequest("POST", `/api/hub/milestones/${milestoneId}/receive`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/milestones`] });
    },
  });

  const milestones = milestonesData?.milestones ?? [];
  const kpis = milestonesData?.kpis;

  if (loadingContracts || loadingMilestones) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Carregando faturamento...</div>;
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total contratado"  value={fmt(kpis.totalContrato)} />
          <KpiCard
            label="Faturado"
            value={fmt(kpis.totalFaturado)}
            sub={fmtPct(kpis.pctFaturado)}
            color="text-purple-600"
          />
          <KpiCard label="Recebido"    value={fmt(kpis.totalRecebido)} color="text-green-600" />
          <KpiCard
            label="Pendente"
            value={fmt(kpis.totalPendente)}
            color={kpis.totalBloqueado > 0 ? "text-red-600" : "text-amber-600"}
            sub={kpis.totalBloqueado > 0 ? `${fmt(kpis.totalBloqueado)} bloqueado` : undefined}
          />
        </div>
      )}

      {/* Barra de progresso de faturamento */}
      {kpis && kpis.totalContrato > 0 && (
        <div className="bg-card border rounded-lg p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Progresso de faturamento</span>
            <span className="text-muted-foreground">{fmtPct(kpis.pctFaturado)}</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(kpis.pctFaturado, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Header + botão novo contrato */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Contratos e marcos</h3>
        <Button size="sm" onClick={() => setContractOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo contrato
        </Button>
      </div>

      {/* Sem contratos */}
      {contracts.length === 0 && (
        <div className="text-center py-16 border rounded-lg">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">Nenhum contrato cadastrado</p>
          <p className="text-xs text-muted-foreground mb-4">
            Adicione o contrato para controlar marcos e faturamento
          </p>
          <Button onClick={() => setContractOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo contrato
          </Button>
        </div>
      )}

      {/* Lista de contratos com marcos */}
      {contracts.map(contract => (
        <div key={contract.id} className="bg-card border rounded-lg overflow-hidden">
          {/* Header do contrato */}
          <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-sm font-semibold">
                  {contract.contract_number ?? "Contrato"}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {CONTRACT_TYPE[contract.contract_type] ?? contract.contract_type}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">{contract.status}</Badge>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold">{fmt(contract.total_value)}</span>
              {contract.retention_percent > 0 && (
                <span className="text-xs text-muted-foreground">
                  Retenção: {contract.retention_percent}%
                </span>
              )}
              <Button size="sm" variant="ghost"
                onClick={() => setMilestoneContractId(contract.id)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Marco
              </Button>
            </div>
          </div>

          {/* Marcos do contrato */}
          {(contract.milestones ?? []).length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhum marco — <button className="text-primary hover:underline"
                onClick={() => setMilestoneContractId(contract.id)}>adicionar</button>
            </div>
          ) : (
            (contract.milestones ?? []).map(m => {
              const s = MILESTONE_STATUS[m.status] ?? MILESTONE_STATUS.pendente;
              const Icon = s.icon;
              const canAccept = ["pendente","atingido","bloqueado"].includes(m.status);
              const canReceive = m.status === "faturado";

              return (
                <div key={m.id} className={cn(
                  "flex items-center gap-4 px-5 py-4 border-b last:border-0",
                  m.status === "bloqueado" && "bg-red-50/30 dark:bg-red-950/10",
                )}>
                  <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0", s.bg)}>
                    <Icon className={cn("h-4 w-4", s.color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {m.wbs_code && (
                        <span className="text-xs text-muted-foreground font-mono">{m.wbs_code}</span>
                      )}
                      {m.due_date && (
                        <span className="text-xs text-muted-foreground">{fmtDate(m.due_date)}</span>
                      )}
                      {m.accepted_at && (
                        <span className="text-xs text-green-600">
                          Aceito em {fmtDate(m.accepted_at)}
                        </span>
                      )}
                      {m.ar_lancamento_id && (
                        <span className="text-xs text-purple-600 flex items-center gap-1">
                          <Banknote className="h-3 w-3" /> AR gerado
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-bold">{fmt(m.amount)}</div>
                  <Badge variant="outline" className={cn("text-xs", s.color)}>{s.label}</Badge>

                  <div className="flex gap-2 flex-shrink-0">
                    {canAccept && (
                      <Button size="sm" variant="outline"
                        className="border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => setAceiteMarco(m)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aceite
                      </Button>
                    )}
                    {canReceive && (
                      <Button size="sm" variant="outline"
                        onClick={() => receiveMutation.mutate(m.id)}
                        disabled={receiveMutation.isPending}>
                        <Banknote className="h-3.5 w-3.5 mr-1" /> Recebido
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ))}

      {/* Modais */}
      <ContractDialog open={contractOpen} onClose={() => setContractOpen(false)} projectId={projectId} />

      {milestoneContractId && (
        <MilestoneDialog
          open={!!milestoneContractId}
          onClose={() => setMilestoneContractId(null)}
          contractId={milestoneContractId}
          projectId={projectId}
        />
      )}

      {aceiteMarco && (
        <AceiteDialog
          open={!!aceiteMarco}
          onClose={() => setAceiteMarco(null)}
          milestone={aceiteMarco}
          projectId={projectId}
        />
      )}
    </div>
  );
}
