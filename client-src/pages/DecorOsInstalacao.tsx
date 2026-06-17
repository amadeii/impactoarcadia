/**
 * Arcádia Suite — Módulo Decor
 * DEC-08 — OS Instalação: agendamento, término, termo digital, AR saldo
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Wrench, CheckCircle2, Clock, Plus, Loader2, Calendar,
  FileCheck, DollarSign, AlertCircle
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pendente:     { label: "Pendente",     color: "bg-gray-400",   icon: Clock },
  agendada:     { label: "Agendada",     color: "bg-blue-500",   icon: Calendar },
  em_andamento: { label: "Em execução",  color: "bg-yellow-500", icon: Wrench },
  concluida:    { label: "Concluída",    color: "bg-green-500",  icon: CheckCircle2 },
  cancelada:    { label: "Cancelada",    color: "bg-red-500",    icon: AlertCircle },
};

interface Props {
  pedidoId: string;
  pedidoStatus: string;
  clienteNome?: string;
  enderecoObra?: string;
  onConcluida?: () => void;
}

function AgendarDialog({ pedidoId, enderecoObra, open, onClose }: {
  pedidoId: string; enderecoObra?: string; open: boolean; onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({
    instaladorId: "", instalador2Id: "",
    dataAgendamento: "", horaAgendamento: "08:00",
    duracaoH: "4", observacoes: "",
  });

  const { data: instaladores = [] } = useQuery<any[]>({
    queryKey: ["/api/modules/decor/instaladores"],
    queryFn: () => apiRequest("GET", "/api/modules/decor/instaladores").then((r: any) => r.json?.() ?? r),
    enabled: open,
  });

  const criar = useMutation({
    mutationFn: () => apiRequest("POST", `/api/modules/decor/pedidos/${pedidoId}/os-instalacao/agendar`, {
      instaladorId: (f.instaladorId && f.instaladorId !== "_none") ? f.instaladorId : undefined,
      instalador2Id: (f.instalador2Id && f.instalador2Id !== "_none") ? f.instalador2Id : undefined,
      data: f.dataAgendamento,
      hora: f.horaAgendamento,
      duracaoH: parseFloat(f.duracaoH),
      observacoes: f.observacoes || undefined,
    }),
    onSuccess: () => {
      toast({ title: "OS de instalação agendada!" });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/os-instalacao", pedidoId] });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", pedidoId] });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/agenda"] });
      onClose();
    },
    onError: (e: any) => {
      const err = e as any;
      if (err?.conflito) {
        toast({ title: err.mensagem, description: err.podeForcar ? "Você pode forçar pelo módulo Agenda." : undefined, variant: "destructive" });
      } else {
        toast({ title: "Erro", description: e.message, variant: "destructive" });
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Agendar Instalação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Instalador principal</Label>
            <Select value={f.instaladorId} onValueChange={v => setF(p => ({ ...p, instaladorId: v }))}>
              <SelectTrigger data-testid="input-inst-responsavel">
                <SelectValue placeholder="A definir..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">A definir</SelectItem>
                {(instaladores as any[]).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">2º Instalador (opcional)</Label>
            <Select value={f.instalador2Id} onValueChange={v => setF(p => ({ ...p, instalador2Id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhum</SelectItem>
                {(instaladores as any[]).filter((i: any) => i.id !== f.instaladorId).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={f.dataAgendamento} onChange={e => setF(p => ({ ...p, dataAgendamento: e.target.value }))} data-testid="input-inst-data" />
            </div>
            <div>
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={f.horaAgendamento} onChange={e => setF(p => ({ ...p, horaAgendamento: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Duração estimada (h)</Label>
            <Input type="number" step="0.5" min="1" max="12" value={f.duracaoH}
              onChange={e => setF(p => ({ ...p, duracaoH: e.target.value }))} />
          </div>
          {enderecoObra && (
            <div className="px-2 py-1.5 bg-muted/50 rounded text-xs text-muted-foreground">
              📍 {enderecoObra}
            </div>
          )}
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={f.observacoes} onChange={e => setF(p => ({ ...p, observacoes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={!f.dataAgendamento || criar.isPending} data-testid="btn-agendar-instalacao">
            {criar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConcluirDialog({ pedidoId, os, open, onClose, onConcluida }: {
  pedidoId: string; os: any; open: boolean; onClose: () => void; onConcluida?: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [obs, setObs] = useState("");
  const [termoAssinado, setTermoAssinado] = useState(true);

  const concluir = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/modules/decor/pedidos/${pedidoId}/os-instalacao/${os.id}/concluir`, { termoAssinado, observacoes: obs }),
    onSuccess: () => {
      toast({ title: "Instalação concluída!", description: "AR de saldo liberado — pedido marcado como concluído" });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/os-instalacao", pedidoId] });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", pedidoId] });
      onConcluida?.();
      onClose();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Concluir Instalação</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg space-y-1 text-sm">
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <DollarSign className="h-4 w-4" /> Ao concluir:
            </div>
            <ul className="text-xs text-green-700 list-disc list-inside space-y-0.5">
              <li>AR de saldo será liberado para cobrança</li>
              <li>Pedido avançará para status "Concluído"</li>
              <li>Checklist será marcado automaticamente</li>
            </ul>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="termo" checked={termoAssinado} onChange={e => setTermoAssinado(e.target.checked)} className="h-4 w-4" />
            <label htmlFor="termo" className="text-sm flex items-center gap-1.5">
              <FileCheck className="h-4 w-4 text-green-500" /> Termo de aceite assinado pelo cliente
            </label>
          </div>
          <div>
            <Label className="text-xs">Observações da instalação</Label>
            <Textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Pendências, observações finais..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => concluir.mutate()} disabled={concluir.isPending} data-testid="btn-concluir-instalacao">
            {concluir.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar Conclusão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OsInstalacaoPanel({ pedidoId, pedidoStatus, enderecoObra, onConcluida }: Props) {
  const [showAgendar, setShowAgendar] = useState(false);
  const [showConcluir, setShowConcluir] = useState<any>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: osLista, isLoading } = useQuery<any[]>({
    queryKey: ["/api/modules/decor/os-instalacao", pedidoId],
    queryFn: () => apiRequest("GET", `/api/modules/decor/pedidos/${pedidoId}/os-instalacao`).then(r => r.json()),
    enabled: !!pedidoId,
  });

  const iniciar = useMutation({
    mutationFn: (osId: string) => apiRequest("PATCH", `/api/modules/decor/pedidos/${pedidoId}/os-instalacao/${osId}`, { status: "em_andamento" }),
    onSuccess: () => { toast({ title: "Instalação iniciada" }); qc.invalidateQueries({ queryKey: ["/api/modules/decor/os-instalacao", pedidoId] }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Ordens de Serviço — Instalação</h3>
        {["instalacao","producao","efetivado"].includes(pedidoStatus) && (
          <Button size="sm" onClick={() => setShowAgendar(true)} className="gap-2" data-testid="btn-agendar-os">
            <Plus className="h-4 w-4" /> Agendar Instalação
          </Button>
        )}
      </div>

      {isLoading && <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

      {!isLoading && !osLista?.length && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhuma OS de instalação criada.</p>
            {["instalacao","producao"].includes(pedidoStatus) && (
              <p className="text-xs mt-1">Agende a instalação para criar a OS.</p>
            )}
          </CardContent>
        </Card>
      )}

      {(osLista ?? []).map((os: any) => {
        const cfg = STATUS_CONFIG[os.status] ?? STATUS_CONFIG["pendente"];
        const Icon = cfg.icon;
        return (
          <Card key={os.id} data-testid={`os-inst-${os.id}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-teal-500" />
                  <div>
                    <p className="font-medium text-sm">
                      {os.instalador_id ? `Instalador: ${os.instalador_id}` : "Instalador a definir"}
                    </p>
                    {os.data_agendamento && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(os.data_agendamento).toLocaleDateString("pt-BR")}
                        {os.hora_agendamento && ` às ${os.hora_agendamento}`}
                      </p>
                    )}
                  </div>
                </div>
                <Badge className={`${cfg.color} text-white`}>
                  <Icon className="h-3 w-3 mr-1" />{cfg.label}
                </Badge>
              </div>

              {os.endereco_instalacao && (
                <p className="text-xs text-muted-foreground">📍 {os.endereco_instalacao}</p>
              )}

              {os.observacoes && <p className="text-xs text-muted-foreground italic">"{os.observacoes}"</p>}

              {os.termo_assinado && (
                <div className="flex items-center gap-1.5 text-xs text-green-600">
                  <FileCheck className="h-3.5 w-3.5" /> Termo de aceite assinado
                  {os.termo_assinado_em && ` em ${new Date(os.termo_assinado_em).toLocaleDateString("pt-BR")}`}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {os.status === "agendada" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => iniciar.mutate(os.id)} disabled={iniciar.isPending} data-testid={`btn-iniciar-inst-${os.id}`}>
                    <Wrench className="h-3 w-3" /> Iniciar instalação
                  </Button>
                )}
                {os.status === "em_andamento" && (
                  <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowConcluir(os)} data-testid={`btn-concluir-btn-${os.id}`}>
                    <CheckCircle2 className="h-3 w-3" /> Concluir + Liberar saldo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <AgendarDialog pedidoId={pedidoId} enderecoObra={enderecoObra} open={showAgendar} onClose={() => setShowAgendar(false)} />
      <ConcluirDialog pedidoId={pedidoId} os={showConcluir} open={!!showConcluir} onClose={() => setShowConcluir(null)} onConcluida={onConcluida} />
    </div>
  );
}
