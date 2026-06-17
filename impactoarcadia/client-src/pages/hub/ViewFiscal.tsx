/**
 * Arcádia Project Hub — Aba Fiscal
 * Sprint HUB-08: Painel NFS-e + retenções + emissão via Control Plus
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
  Receipt, CheckCircle2, Clock, Send, XCircle,
  AlertTriangle, FileText, DollarSign, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FiscalEvent {
  id: string;
  event_type: string;
  event_status: string;
  amount: number;
  retention_iss?: number;
  retention_ir?: number;
  retention_pcc?: number;
  municipio_ibge?: string;
  service_code?: string;
  competencia?: string;
  nfse_number?: string;
  milestone_title?: string;
  approved_at?: string;
  created_at: string;
}

interface FiscalDashboard {
  byStatus: { event_status: string; count: number; total_amount: number }[];
  pendentes: FiscalEvent[];
  emitidos: FiscalEvent[];
  totais: {
    totalEmitido: number;
    totalPendente: number;
    totalIss: number;
    totalIr: number;
    totalPcc: number;
    totalRetencoes: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:2 }).format(v);
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" }) : "—";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pendente:  { label:"Pendente",  color:"text-gray-500",   icon:Clock        },
  aprovado:  { label:"Aprovado",  color:"text-blue-600",   icon:CheckCircle2 },
  emitido:   { label:"Emitido",   color:"text-green-600",  icon:Receipt      },
  cancelado: { label:"Cancelado", color:"text-red-500",    icon:XCircle      },
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

// ── Modal de emissão NFS-e ────────────────────────────────────────────────────
function EmitirNfseDialog({ open, onClose, event, projectId }: {
  open: boolean; onClose: () => void; event: FiscalEvent; projectId: string;
}) {
  const qc = useQueryClient();
  const [desc, setDesc] = useState(`Serviços de engenharia — ${event.milestone_title ?? ""}`);
  const [serviceCode, setServiceCode] = useState(event.service_code ?? "7.01");

  // Preview de retenções
  const { data: prevRetencoes } = useQuery<{ iss: number; ir: number; pcc: number; liquido: number }>({
    queryKey: ["retencoes-preview", event.amount, event.municipio_ibge],
    queryFn: () =>
      apiRequest("POST", "/api/hub/fiscal/calcular-retencoes", {
        amount: event.amount, municipioIbge: event.municipio_ibge,
      }).then(r => r.json()),
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/hub/fiscal-events/${event.id}/emit-nfse`, {
        serviceDescription: desc, serviceCode,
      }),
    onSuccess: (res) => {
      res.json().then(() => {
        qc.invalidateQueries({ queryKey: [`fiscal-dash-${projectId}`] });
        onClose();
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Emitir NFS-e
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Resumo do evento */}
          <div className="bg-muted rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{event.milestone_title ?? "Marco"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Competência: {fmtDate(event.competencia)}
                </p>
              </div>
              <p className="text-xl font-bold text-primary">{fmt(event.amount)}</p>
            </div>
          </div>

          {/* Descrição do serviço */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição do serviço</label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Código de serviço (LC 116/2003)
            </label>
            <Input value={serviceCode} onChange={e => setServiceCode(e.target.value)}
              placeholder="7.01" />
          </div>

          {/* Preview de retenções */}
          {prevRetencoes && (
            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Retenções estimadas
              </p>
              <div className="space-y-1 text-sm">
                {[
                  { label: "ISS", value: prevRetencoes.iss },
                  { label: "IR (1,5%)", value: prevRetencoes.ir },
                  { label: "PIS/COFINS/CSLL (4,65%)", value: prevRetencoes.pcc },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      ({fmt(r.value)})
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="font-semibold">Líquido a receber</span>
                  <span className="font-bold text-green-600">{fmt(prevRetencoes.liquido)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted rounded-lg p-3">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              A NFS-e será emitida via Control Plus. Se o Control Plus não estiver configurado,
              o sistema registrará no modo simulado.
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !desc}>
            {mutation.isPending ? "Emitindo..." : "Emitir NFS-e"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal registro manual de NFS-e ────────────────────────────────────────────
function RegistroManualDialog({ open, onClose, event, projectId }: {
  open: boolean; onClose: () => void; event: FiscalEvent; projectId: string;
}) {
  const qc = useQueryClient();
  const [nfseNumber, setNfseNumber] = useState("");
  const [iss, setIss] = useState("");
  const [ir, setIr] = useState("");
  const [pcc, setPcc] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/hub/fiscal-events/${event.id}/nfse`, {
        nfseNumber,
        retentionIss: iss ? Number(iss) : null,
        retentionIr: ir ? Number(ir) : null,
        retentionPcc: pcc ? Number(pcc) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`fiscal-dash-${projectId}`] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar NFS-e manualmente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Use quando a NFS-e foi emitida fora do sistema (prefeitura diretamente).
          </p>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Número da NFS-e *</label>
            <Input value={nfseNumber} onChange={e => setNfseNumber(e.target.value)}
              placeholder="000001" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium mb-1 block">ISS retido (R$)</label>
              <Input type="number" value={iss} onChange={e => setIss(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">IR retido (R$)</label>
              <Input type="number" value={ir} onChange={e => setIr(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">PCC retido (R$)</label>
              <Input type="number" value={pcc} onChange={e => setPcc(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !nfseNumber}>
            {mutation.isPending ? "Registrando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ViewFiscal principal ──────────────────────────────────────────────────────
export function ViewFiscal({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [emitirEvento, setEmitirEvento] = useState<FiscalEvent | null>(null);
  const [manualEvento, setManualEvento] = useState<FiscalEvent | null>(null);

  const { data: dash, isLoading } = useQuery<FiscalDashboard>({
    queryKey: [`fiscal-dash-${projectId}`],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/fiscal-dashboard`).then(r => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: (eventId: string) =>
      apiRequest("POST", `/api/hub/fiscal-events/${eventId}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`fiscal-dash-${projectId}`] }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, justificativa }: { id: string; justificativa: string }) =>
      apiRequest("POST", `/api/hub/fiscal-events/${id}/cancel`, { justificativa }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`fiscal-dash-${projectId}`] }),
  });

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando fiscal...</div>;
  if (!dash) return null;

  const { totais, pendentes, emitidos } = dash;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="NFS-e emitidas"    value={fmt(totais.totalEmitido)}   color="text-green-600" />
        <KpiCard label="Pendente emissão"  value={fmt(totais.totalPendente)}  color="text-amber-600" />
        <KpiCard
          label="Total retido"
          value={fmt(totais.totalRetencoes)}
          sub={`ISS: ${fmt(totais.totalIss)} · IR: ${fmt(totais.totalIr)}`}
          color="text-red-600"
        />
        <KpiCard
          label="Líquido recebido"
          value={fmt(totais.totalEmitido - totais.totalRetencoes)}
          color="text-primary"
        />
      </div>

      {/* Eventos pendentes de emissão */}
      {pendentes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Pendentes de emissão ({pendentes.length})
          </h3>
          <div className="bg-card border rounded-lg divide-y">
            {pendentes.map(evt => {
              const s = STATUS_CONFIG[evt.event_status] ?? STATUS_CONFIG.pendente;
              const Icon = s.icon;
              return (
                <div key={evt.id} className="flex items-center gap-4 px-4 py-3">
                  <Icon className={cn("h-4 w-4 flex-shrink-0", s.color)} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{evt.milestone_title ?? "Evento fiscal"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Competência: {fmtDate(evt.competencia)}
                      {evt.municipio_ibge && ` · IBGE: ${evt.municipio_ibge}`}
                    </p>
                  </div>
                  <p className="text-sm font-bold">{fmt(Number(evt.amount))}</p>
                  <Badge variant="outline" className={cn("text-xs", s.color)}>{s.label}</Badge>
                  <div className="flex gap-2">
                    {evt.event_status === "pendente" && (
                      <Button size="sm" variant="outline"
                        onClick={() => approveMutation.mutate(evt.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                      </Button>
                    )}
                    {evt.event_status === "aprovado" && (
                      <>
                        <Button size="sm" onClick={() => setEmitirEvento(evt)}>
                          <Send className="h-3.5 w-3.5 mr-1" /> Emitir NFS-e
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setManualEvento(evt)}>
                          Manual
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NFS-e emitidas */}
      {emitidos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            NFS-e emitidas ({emitidos.length})
          </h3>
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="grid grid-cols-5 gap-4 px-4 py-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <div>Marco / Serviço</div>
              <div className="text-right">Valor bruto</div>
              <div className="text-right">Retenções</div>
              <div className="text-right">Líquido</div>
              <div className="text-center">Número</div>
            </div>
            {emitidos.map(evt => {
              const retTotal = Number(evt.retention_iss ?? 0) + Number(evt.retention_ir ?? 0) + Number(evt.retention_pcc ?? 0);
              return (
                <div key={evt.id}
                  className="grid grid-cols-5 gap-4 px-4 py-3 border-b last:border-0 items-center text-sm">
                  <div>
                    <p className="font-medium">{evt.milestone_title ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(evt.approved_at)}</p>
                  </div>
                  <div className="text-right font-medium">{fmt(Number(evt.amount))}</div>
                  <div className="text-right text-red-600">{retTotal > 0 ? `(${fmt(retTotal)})` : "—"}</div>
                  <div className="text-right text-green-600 font-semibold">
                    {fmt(Number(evt.amount) - retTotal)}
                  </div>
                  <div className="text-center">
                    {evt.nfse_number ? (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {evt.nfse_number}
                      </Badge>
                    ) : "—"}
                  </div>
                </div>
              );
            })}

            {/* Totais */}
            <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-muted/30 text-sm font-semibold border-t">
              <div>Total</div>
              <div className="text-right">{fmt(totais.totalEmitido)}</div>
              <div className="text-right text-red-600">({fmt(totais.totalRetencoes)})</div>
              <div className="text-right text-green-600">{fmt(totais.totalEmitido - totais.totalRetencoes)}</div>
              <div />
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {pendentes.length === 0 && emitidos.length === 0 && (
        <div className="text-center py-16 border rounded-lg border-dashed">
          <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">Nenhum evento fiscal</p>
          <p className="text-xs text-muted-foreground">
            Os eventos fiscais são gerados automaticamente ao aceitar marcos de faturamento
          </p>
        </div>
      )}

      {/* Retenções por tipo */}
      {totais.totalRetencoes > 0 && (
        <div className="bg-card border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Detalhamento de retenções
          </h3>
          <div className="space-y-2">
            {[
              { label: "ISS (municipal)", value: totais.totalIss, pct: totais.totalEmitido > 0 ? (totais.totalIss/totais.totalEmitido)*100 : 0 },
              { label: "IR (1,5%)",       value: totais.totalIr,  pct: totais.totalEmitido > 0 ? (totais.totalIr/totais.totalEmitido)*100 : 0 },
              { label: "PIS/COFINS/CSLL", value: totais.totalPcc, pct: totais.totalEmitido > 0 ? (totais.totalPcc/totais.totalEmitido)*100 : 0 },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-36">{r.label}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full"
                    style={{ width: `${Math.min(r.pct * 5, 100)}%` }} />
                </div>
                <span className="text-sm font-medium text-red-600 w-24 text-right">
                  {fmt(r.value)}
                </span>
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {r.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modais */}
      {emitirEvento && (
        <EmitirNfseDialog
          open={!!emitirEvento}
          onClose={() => setEmitirEvento(null)}
          event={emitirEvento}
          projectId={projectId}
        />
      )}
      {manualEvento && (
        <RegistroManualDialog
          open={!!manualEvento}
          onClose={() => setManualEvento(null)}
          event={manualEvento}
          projectId={projectId}
        />
      )}
    </div>
  );
}
