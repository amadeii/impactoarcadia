/**
 * Arcádia Suite — Módulo Decor
 * DEC-07 — OS Produção: gerenciamento de etapas (talhação, encartelamento, acabamento, controle)
 * Componente embeddable no DecorPedidoDetalhe OU página standalone /decor/os-producao/:pedidoId
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Scissors, CheckCircle2, Clock, PlayCircle, AlertCircle, Plus, Loader2, Wrench } from "lucide-react";

const ETAPAS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  talhacao:           { label: "Talhação",            icon: Scissors,       color: "bg-red-400" },
  encartelamento:     { label: "Encartelamento",       icon: Clock,          color: "bg-yellow-400" },
  acabamento:         { label: "Acabamento",           icon: Wrench,         color: "bg-blue-400" },
  controle_qualidade: { label: "Controle Qualidade",   icon: CheckCircle2,   color: "bg-green-400" },
};

const STATUS_OS: Record<string, { label: string; color: string; icon: any }> = {
  pendente:     { label: "Pendente",      color: "bg-gray-400",   icon: Clock },
  em_andamento: { label: "Em andamento",  color: "bg-yellow-500", icon: PlayCircle },
  concluida:    { label: "Concluída",     color: "bg-green-500",  icon: CheckCircle2 },
  bloqueada:    { label: "Bloqueada",     color: "bg-red-500",    icon: AlertCircle },
};

interface Props {
  pedidoId: string;
  pedidoStatus: string;
  onGerado?: () => void;
}

export function OsProducaoPanel({ pedidoId, pedidoStatus, onGerado }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editOs, setEditOs] = useState<any>(null);
  const [showIniciar, setShowIniciar] = useState<any>(null);

  const { data: osLista, isLoading } = useQuery<any[]>({
    queryKey: ["/api/modules/decor/os-producao", pedidoId],
    queryFn: () => apiRequest("GET", `/api/modules/decor/pedidos/${pedidoId}/os-producao`).then(r => r.json()),
    enabled: !!pedidoId,
  });

  const gerarLote = useMutation({
    mutationFn: () => apiRequest("POST", `/api/modules/decor/pedidos/${pedidoId}/os-producao/gerar`),
    onSuccess: (d: any) => {
      toast({ title: "OS geradas!", description: `${d.os_criadas} OS criadas — status avançado para Produção` });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/os-producao", pedidoId] });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", pedidoId] });
      onGerado?.();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const concluir = useMutation({
    mutationFn: (osId: string) => apiRequest("PATCH", `/api/modules/decor/pedidos/${pedidoId}/os-producao/${osId}/concluir`),
    onSuccess: (d: any) => {
      toast({ title: "OS concluída!", description: d.todas_concluidas ? "Todas as OSs concluídas — pedido avançado para Instalação!" : "OS marcada como concluída" });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/os-producao", pedidoId] });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", pedidoId] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const iniciarOs = useMutation({
    mutationFn: ({ osId, obs }: any) => apiRequest("PATCH", `/api/modules/decor/pedidos/${pedidoId}/os-producao/${osId}`, { status: "em_andamento", observacoes: obs }),
    onSuccess: () => {
      toast({ title: "OS iniciada" });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/os-producao", pedidoId] });
      setShowIniciar(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const osPorEtapa: Record<string, any[]> = {};
  for (const os of osLista ?? []) {
    if (!osPorEtapa[os.etapa]) osPorEtapa[os.etapa] = [];
    osPorEtapa[os.etapa].push(os);
  }

  const totalConcluidas = (osLista ?? []).filter(o => o.status === "concluida").length;
  const totalOs = (osLista ?? []).length;

  return (
    <div className="space-y-4">
      {/* Header + ações */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">Ordens de Serviço — Produção (Ateliê)</h3>
          {totalOs > 0 && (
            <p className="text-sm text-muted-foreground">{totalConcluidas}/{totalOs} etapas concluídas</p>
          )}
        </div>
        {["efetivado","aprovado"].includes(pedidoStatus) && (
          <Button
            size="sm"
            onClick={() => gerarLote.mutate()}
            disabled={gerarLote.isPending}
            className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
            data-testid="btn-gerar-os-lote"
          >
            {gerarLote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
            Gerar OSs em lote
          </Button>
        )}
      </div>

      {/* Barra de progresso */}
      {totalOs > 0 && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-cyan-500 h-2 rounded-full transition-all"
            style={{ width: `${(totalConcluidas / totalOs) * 100}%` }}
          />
        </div>
      )}

      {isLoading && <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

      {!isLoading && totalOs === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            <Scissors className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhuma OS de produção criada ainda.</p>
            {["efetivado","aprovado"].includes(pedidoStatus) && (
              <p className="text-xs mt-1">Clique em "Gerar OSs em lote" para criar automaticamente a partir dos itens do pedido.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grid por etapa */}
      {!isLoading && totalOs > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(ETAPAS_CONFIG).map(([etapa, cfg]) => {
            const lista = osPorEtapa[etapa] ?? [];
            const Icon = cfg.icon;
            return (
              <Card key={etapa}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${cfg.color}`} />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {cfg.label}
                    <Badge variant="outline" className="ml-auto">{lista.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lista.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma OS nesta etapa</p>
                  )}
                  {lista.map((os: any) => {
                    const stCfg = STATUS_OS[os.status] ?? STATUS_OS["pendente"];
                    const StIcon = stCfg.icon;
                    return (
                      <div key={os.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30" data-testid={`os-prod-${os.id}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{os.ambiente ?? `Item ${os.item_id?.slice(-4)}`}</p>
                          {os.metragem_tecido && (
                            <p className="text-xs text-muted-foreground">{parseFloat(os.metragem_tecido).toFixed(2)}m de tecido</p>
                          )}
                        </div>
                        <Badge className={`${stCfg.color} text-white text-xs py-0 h-5`}>
                          <StIcon className="h-3 w-3 mr-1" />{stCfg.label}
                        </Badge>
                        {os.status === "pendente" && (
                          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setShowIniciar(os)} data-testid={`btn-iniciar-os-${os.id}`}>
                            Iniciar
                          </Button>
                        )}
                        {os.status === "em_andamento" && (
                          <Button size="sm" className="h-6 px-2 text-xs bg-green-500 hover:bg-green-600 text-white" onClick={() => concluir.mutate(os.id)} disabled={concluir.isPending} data-testid={`btn-concluir-os-${os.id}`}>
                            Concluir
                          </Button>
                        )}
                        {os.status === "concluida" && (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog iniciar OS */}
      <Dialog open={!!showIniciar} onOpenChange={() => setShowIniciar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Iniciar OS — {ETAPAS_CONFIG[showIniciar?.etapa]?.label}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Confirma início da etapa para: <strong>{showIniciar?.ambiente ?? "item"}</strong>?</p>
            {showIniciar?.metragem_tecido && (
              <p>Metragem: <strong>{parseFloat(showIniciar.metragem_tecido).toFixed(2)}m</strong></p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIniciar(null)}>Cancelar</Button>
            <Button onClick={() => showIniciar && iniciarOs.mutate({ osId: showIniciar.id, obs: null })} disabled={iniciarOs.isPending} data-testid="btn-confirmar-iniciar-os">
              {iniciarOs.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar Início
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
