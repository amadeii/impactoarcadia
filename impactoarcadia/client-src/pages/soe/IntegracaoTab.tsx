import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, Clock,
  RotateCcw, TrendingUp, TrendingDown, ShoppingCart, Truck,
  Package2, FileText, Zap, AlertOctagon,
  RefreshCw, Eye
} from "lucide-react";

const api = {
  get: async (url: string) => { const r = await fetch(url, { credentials: "include" }); if (!r.ok) throw new Error("Request failed"); return r.json(); },
  post: async (url: string, data?: any) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data || {}), credentials: "include" }); if (!r.ok) throw new Error("Request failed"); return r.json(); },
};

function fmt(v: any) { return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }); }

function HealthDot({ status }: { status: string }) {
  const colors: Record<string, string> = { healthy: "bg-green-500", warning: "bg-amber-500", degraded: "bg-red-500" };
  return (
    <span className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${colors[status] || "bg-gray-400"} ${status === "healthy" ? "animate-pulse" : ""}`} />
      <span className={`text-sm font-medium ${status === "healthy" ? "text-green-700" : status === "warning" ? "text-amber-700" : "text-red-700"}`}>
        {status === "healthy" ? "Operacional" : status === "warning" ? "Atenção" : "Degradado"}
      </span>
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color = "blue", alert = false }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600",
    slate: "bg-slate-50 text-slate-600", purple: "bg-purple-50 text-purple-600",
  };
  return (
    <Card className={alert ? "border-red-200 bg-red-50/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${colors[color]}`}><Icon className="w-4 h-4" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className={`text-2xl font-bold ${alert ? "text-red-700" : ""}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegracaoTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedEntrada, setSelectedEntrada] = useState<string | null>(null);
  const [showOrderCiclo, setShowOrderCiclo] = useState(false);
  const [showEntradaCiclo, setShowEntradaCiclo] = useState(false);
  const [replayingEvent, setReplayingEvent] = useState<string | null>(null);

  const { data: health, isLoading: loadingHealth, refetch: refetchHealth } = useQuery<any>({
    queryKey: ["/api/int/health"],
    queryFn: () => api.get("/api/int/health"),
    refetchInterval: 15000,
  });

  const { data: intDashboard } = useQuery<any>({
    queryKey: ["/api/int/dashboard"],
    queryFn: () => api.get("/api/int/dashboard"),
    refetchInterval: 30000,
  });

  const { data: soeEvents } = useQuery<any>({
    queryKey: ["/api/soe/events", "dead_letter"],
    queryFn: () => api.get("/api/soe/events?status=dead_letter"),
  });

  const { data: orderCiclo } = useQuery<any>({
    queryKey: ["/api/int/pedido", selectedOrder, "ciclo"],
    queryFn: () => api.get(`/api/int/pedido/${selectedOrder}/ciclo`),
    enabled: !!selectedOrder && showOrderCiclo,
  });

  const replayMutation = useMutation({
    mutationFn: (eventId: string) => api.post(`/api/int/eventos/${eventId}/replay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/int/health"] });
      setReplayingEvent(null);
      toast({ title: "Evento recolocado na fila para reprocessamento." });
    },
    onError: (e: any) => toast({ title: "Erro no replay", description: e.message, variant: "destructive" }),
  });

  const h = health?.data || {};
  const eventos = h.eventos_soe || {};
  const arStatus = h.ar_status || {};
  const apStatus = h.ap_status || {};
  const pedidosUrgentes = h.pedidos_urgentes || [];
  const certAlertas = h.certificados_alertas || [];
  const manifestacaoUrgente = h.manifestacao_urgente || 0;
  const deadLetters = soeEvents?.data || [];

  const com = intDashboard?.data?.comercial || {};
  const comp = intDashboard?.data?.compras || {};
  const est = intDashboard?.data?.estoque || {};
  const fiscal = intDashboard?.data?.fiscal || {};

  return (
    <div className="space-y-6">
      {/* Header de status */}
      <Card>
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <HealthDot status={health?.status || "healthy"} />
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-5 text-sm">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span className="text-muted-foreground">Processados/hora:</span>
                  <strong>{eventos.processed_last_hour || 0}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="text-muted-foreground">Pendentes:</span>
                  <strong>{eventos.pending || 0}</strong>
                </span>
                {Number(eventos.failed || 0) > 0 && (
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-700 font-medium">{eventos.failed} com falha</span>
                  </span>
                )}
                {Number(eventos.dead_letter || 0) > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <XCircle className="w-4 h-4" />
                    <strong>{eventos.dead_letter} dead letter</strong>
                  </span>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetchHealth()} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Métricas do mês */}
      <div>
        <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Visão consolidada — mês atual</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard icon={ShoppingCart} label="Vendas no mês" value={`R$ ${fmt(com.vendas_mes)}`} color="green"
            sub={`${com.pendentes_nfe || 0} aguardando NF-e`} alert={Number(com.pendentes_nfe || 0) > 0} />
          <MetricCard icon={Truck} label="Compras no mês" value={`R$ ${fmt(comp.compras_mes)}`} color="blue"
            sub={`${comp.manifestacao_urgente || 0} manifest. urgente`} alert={Number(comp.manifestacao_urgente || 0) > 0} />
          <MetricCard icon={Package2} label="Produtos c/ saldo" value={est.total_produtos_com_saldo || 0} color="slate"
            sub={`${est.abaixo_minimo || 0} abaixo do mínimo`} alert={Number(est.abaixo_minimo || 0) > 0} />
          <MetricCard icon={FileText} label="NF-e autorizadas" value={fiscal.nfe_autorizadas_mes || 0} color="purple"
            sub={`${fiscal.pendentes_sefaz || 0} pendentes SEFAZ`} alert={Number(fiscal.pendentes_sefaz || 0) > 0} />
        </div>
      </div>

      {/* AR / AP */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />Contas a Receber (AR)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Parcelas com AR", val: arStatus.parcelas_com_ar || 0, color: "text-green-700" },
              { label: "Pendentes de AR", val: arStatus.parcelas_pendentes || 0, color: Number(arStatus.parcelas_pendentes || 0) > 0 ? "text-amber-700" : "text-muted-foreground" },
              { label: "Canceladas", val: arStatus.parcelas_canceladas || 0, color: "text-muted-foreground" },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className={`font-semibold ${r.color}`}>{r.val}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />Contas a Pagar (AP)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Duplicatas com AP", val: apStatus.parcelas_com_ap || 0, color: "text-green-700" },
              { label: "Pendentes de AP", val: apStatus.parcelas_pendentes || 0, color: Number(apStatus.parcelas_pendentes || 0) > 0 ? "text-amber-700" : "text-muted-foreground" },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className={`font-semibold ${r.color}`}>{r.val}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Alertas críticos */}
      {(pedidosUrgentes.length > 0 || certAlertas.length > 0 || manifestacaoUrgente > 0) && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
            <AlertOctagon className="w-4 h-4" />Alertas que requerem ação
          </p>
          {pedidosUrgentes.map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="font-medium">Pedido {p.numero}</span>
              <span className="text-amber-700">aguardando faturamento há {p.horas_aguardando}h</span>
              <Button size="sm" variant="ghost" className="ml-auto gap-1 text-xs"
                onClick={() => { setSelectedOrder(p.id); setShowOrderCiclo(true); }}>
                <Eye className="w-3 h-3" />Ver ciclo
              </Button>
            </div>
          ))}
          {certAlertas.map((c: any) => (
            <div key={c.empresa_id} className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <AlertOctagon className="w-4 h-4 text-red-600" />
              <span className="font-medium text-red-900">Certificado digital vencendo em {c.dias_restantes} dias</span>
              <span className="text-red-700 text-xs ml-auto">{new Date(c.certificado_valido_ate).toLocaleDateString("pt-BR")}</span>
            </div>
          ))}
          {manifestacaoUrgente > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <AlertOctagon className="w-4 h-4 text-red-600" />
              <span className="font-medium text-red-900">{manifestacaoUrgente} NF-e(s) sem manifestação — prazo legal próximo do vencimento</span>
            </div>
          )}
        </div>
      )}

      {/* Dead letter events */}
      {deadLetters.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <XCircle className="w-4 h-4" />Eventos dead letter — precisam de ação manual
          </p>
          <Card className="border-red-200">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de evento</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Último erro</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deadLetters.map((ev: any) => (
                    <TableRow key={ev.id} className="bg-red-50/40">
                      <TableCell className="text-sm font-mono text-red-800">{ev.event_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{ev.aggregate_type}:{ev.aggregate_id?.slice(0, 8)}...</TableCell>
                      <TableCell className="text-sm">{ev.attempts}</TableCell>
                      <TableCell className="text-xs text-red-600 max-w-xs truncate">{ev.last_error}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs border-red-300 hover:bg-red-50"
                          disabled={replayMutation.isPending && replayingEvent === ev.id}
                          onClick={() => { setReplayingEvent(ev.id); replayMutation.mutate(ev.id); }}>
                          <RotateCcw className="w-3 h-3" />Reprocessar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rastreabilidade de pedido */}
      <Dialog open={showOrderCiclo} onOpenChange={setShowOrderCiclo}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ciclo do Pedido {orderCiclo?.data?.pedido?.numero}</DialogTitle>
          </DialogHeader>
          {orderCiclo?.data && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline">{orderCiclo.data.pedido?.status}</Badge>
                <span className="text-sm text-muted-foreground">{orderCiclo.data.pedido?.pessoa_nome}</span>
                <span className="text-sm font-bold ml-auto">R$ {fmt(orderCiclo.data.pedido?.total_liquido)}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Timeline</p>
                <div className="space-y-2">
                  {(orderCiclo.data.timeline || []).map((ev: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{ev.descricao}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{new Date(ev.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {orderCiclo.data.parcelas?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Parcelas / AR</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status AR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderCiclo.data.parcelas.map((p: any) => (
                        <TableRow key={p.parcela}>
                          <TableCell>{p.parcela}/{orderCiclo.data.parcelas.length}</TableCell>
                          <TableCell>{new Date(p.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-right font-mono">R$ {fmt(p.valor)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{p.parcela_status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {orderCiclo.data.soe_eventos?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Eventos SOE</p>
                  <div className="space-y-1">
                    {orderCiclo.data.soe_eventos.map((ev: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-3 bg-muted/30 rounded">
                        {ev.status === "processed" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          : ev.status === "failed" || ev.status === "dead_letter" ? <XCircle className="w-3.5 h-3.5 text-red-600" />
                          : <Clock className="w-3.5 h-3.5 text-blue-600" />}
                        <span className="font-mono font-medium">{ev.event_type}</span>
                        <span className="text-muted-foreground ml-auto">{ev.attempts} tent.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
