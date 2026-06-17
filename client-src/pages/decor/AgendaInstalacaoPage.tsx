/**
 * DEC-AGE-01 — AgendaInstalacaoPage.tsx
 * Agenda de Instalação — calendário semanal com disponibilidade da equipe.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ChevronLeft, ChevronRight, Plus, User,
  MapPin, Clock, Phone, Settings, CalendarDays, Loader2
} from "lucide-react";
import {
  startOfWeek, addWeeks, subWeeks, addDays,
  format, isToday, parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const api = {
  get:  (url: string)            => apiRequest("GET",   url).then((r: any) => r.json?.() ?? r),
  post: (url: string, body: any) => apiRequest("POST",  url, body).then((r: any) => r.json?.() ?? r),
  patch:(url: string, body: any) => apiRequest("PATCH", url, body).then((r: any) => r.json?.() ?? r),
};

function fmt(d: Date)    { return format(d, "yyyy-MM-dd"); }
function fmtBr(s: string){ try { return format(parseISO(s), "dd/MM", { locale: ptBR }); } catch { return s; } }
function diaSemana(d: Date) { return format(d, "EEE", { locale: ptBR }).replace(".", ""); }

const OCUPACAO_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  livre:     { bg: "bg-green-50  border-green-200",  text: "text-green-700",  label: "Livre"     },
  parcial:   { bg: "bg-amber-50  border-amber-200",  text: "text-amber-700",  label: "Parcial"   },
  lotado:    { bg: "bg-red-50    border-red-200",     text: "text-red-700",    label: "Lotado"    },
  bloqueado: { bg: "bg-gray-100  border-gray-300",    text: "text-gray-500",   label: "Bloqueado" },
};

const STATUS_OS: Record<string, { bg: string; label: string }> = {
  agendada:     { bg: "bg-blue-500",   label: "Agendada"    },
  em_andamento: { bg: "bg-yellow-500", label: "Em execução" },
  concluida:    { bg: "bg-green-500",  label: "Concluída"   },
  pendente:     { bg: "bg-gray-400",   label: "Pendente"    },
};

export default function AgendaInstalacaoPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [semanaBase, setSemanaBase]         = useState(new Date());
  const [viewMode, setViewMode]             = useState<"semanal" | "instaladores">("semanal");
  const [showAgendar, setShowAgendar]       = useState<{ pedidoId?: string; data?: string } | null>(null);
  const [showInstalador, setShowInstalador] = useState(false);
  const [osDetalhe, setOsDetalhe]           = useState<any>(null);

  const dias = useMemo(() => {
    const ini = startOfWeek(semanaBase, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(ini, i));
  }, [semanaBase]);

  const dataInicio = fmt(dias[0]);
  const dataFim    = fmt(dias[6]);

  const { data: semanal, isLoading: loadSemanal } = useQuery<any>({
    queryKey: ["/api/modules/decor/agenda/semanal", dataInicio],
    queryFn:  () => api.get(`/api/modules/decor/agenda/semanal?dataInicio=${dataInicio}`),
  });

  const { data: disponibilidade } = useQuery<any>({
    queryKey: ["/api/modules/decor/agenda/disponibilidade", dataInicio, dataFim],
    queryFn:  () => api.get(`/api/modules/decor/agenda/disponibilidade?dataInicio=${dataInicio}&dataFim=${dataFim}`),
    enabled: viewMode === "instaladores",
  });

  const { data: instaladores = [] } = useQuery<any[]>({
    queryKey: ["/api/modules/decor/instaladores"],
    queryFn:  () => api.get("/api/modules/decor/instaladores"),
  });

  const osPorDia = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const d of dias) m[fmt(d)] = [];
    for (const os of (semanal?.data ?? [])) {
      const d = os.data_agendamento
        ? (os.data_agendamento.includes("T") ? os.data_agendamento.split("T")[0] : os.data_agendamento)
        : null;
      if (d && m[d]) m[d].push(os);
    }
    return m;
  }, [semanal, dias]);

  const agendarMutation = useMutation({
    mutationFn: (body: any) =>
      api.post(`/api/modules/decor/pedidos/${body.pedidoId}/os-instalacao/agendar`, body),
    onSuccess: () => {
      toast({ title: "Instalação agendada!" });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/agenda"] });
      setShowAgendar(null);
    },
    onError: (e: any) => {
      if (e?.conflito) {
        toast({ title: e.mensagem, description: e.podeForcar ? "Você pode forçar o agendamento." : undefined, variant: "destructive" });
      } else {
        toast({ title: "Erro ao agendar", description: e.message, variant: "destructive" });
      }
    },
  });

  return (
    <BrowserFrame title="Agenda de Instalação">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setSemanaBase(d => subWeeks(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="font-semibold text-sm">{fmtBr(dataInicio)} — {fmtBr(dataFim)}</p>
            <p className="text-xs text-muted-foreground">{format(dias[0], "MMMM yyyy", { locale: ptBR })}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setSemanaBase(d => addWeeks(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSemanaBase(new Date())} className="text-xs">Hoje</Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button onClick={() => setViewMode("semanal")}
              className={`px-3 py-1.5 ${viewMode === "semanal" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              Por dia
            </button>
            <button onClick={() => setViewMode("instaladores")}
              className={`px-3 py-1.5 ${viewMode === "instaladores" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              Por instalador
            </button>
          </div>
          <Button size="sm" onClick={() => setShowInstalador(true)} variant="outline" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Equipe
          </Button>
          <Button size="sm" onClick={() => setShowAgendar({})} className="gap-1.5">
            <Plus className="h-4 w-4" /> Agendar
          </Button>
        </div>
      </div>

      {/* View: Por dia */}
      {viewMode === "semanal" && (
        <div className="grid grid-cols-7 gap-1.5">
          {dias.map(dia => {
            const key = fmt(dia);
            const osHoje = osPorDia[key] ?? [];
            const ehHoje = isToday(dia);
            return (
              <div key={key} className={`flex flex-col gap-1.5 min-h-48 rounded-xl border p-2
                ${ehHoje ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                <div className={`text-center pb-1.5 border-b ${ehHoje ? "border-primary/30" : "border-border"}`}>
                  <p className={`text-xs font-medium uppercase tracking-wide ${ehHoje ? "text-primary" : "text-muted-foreground"}`}>
                    {diaSemana(dia)}
                  </p>
                  <p className={`text-lg font-bold ${ehHoje ? "text-primary" : ""}`}>{format(dia, "d")}</p>
                  <button onClick={() => setShowAgendar({ data: key })}
                    className="mt-0.5 w-full text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-0.5">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                {loadSemanal && (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!loadSemanal && osHoje.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">—</p>
                  </div>
                )}
                {osHoje.map((os: any) => {
                  const stConf = STATUS_OS[os.status] ?? STATUS_OS["pendente"];
                  return (
                    <button key={os.id} onClick={() => setOsDetalhe(os)}
                      className="w-full text-left rounded-lg border p-2 hover:shadow-sm transition-shadow bg-background"
                      data-testid={`os-card-${os.id}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stConf.bg}`} />
                        <span className="text-xs font-mono font-medium truncate">{os.numero_pedido}</span>
                      </div>
                      <p className="text-xs font-medium truncate">{os.cliente_nome}</p>
                      {os.instalador_nome && (
                        <p className="text-xs text-muted-foreground flex items-center gap-0.5 mt-0.5">
                          <User className="h-3 w-3" />
                          <span className="truncate">{os.instalador_nome}</span>
                        </p>
                      )}
                      {os.hora_agendamento && (
                        <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />{os.hora_agendamento}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* View: Por instalador */}
      {viewMode === "instaladores" && (
        <div className="space-y-3">
          {instaladores.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum instalador cadastrado.</p>
              <Button size="sm" className="mt-3" onClick={() => setShowInstalador(true)}>Cadastrar equipe</Button>
            </CardContent></Card>
          )}
          {instaladores.map((inst: any) => (
            <Card key={inst.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{inst.nome}</p>
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        {inst.habilidades?.map((h: string) => (
                          <Badge key={h} variant="outline" className="text-xs px-1.5 py-0">{h}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  {inst.telefone && (
                    <a href={`tel:${inst.telefone}`} className="text-muted-foreground hover:text-primary">
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-7 gap-1">
                  {dias.map(dia => {
                    const key = fmt(dia);
                    const dispData = disponibilidade?.data?.[key];
                    const instData = dispData?.find((d: any) => d.instalador_id === inst.id);
                    const ocupacao = instData?.ocupacao ?? "livre";
                    const cfg = OCUPACAO_CONFIG[ocupacao];
                    const osCount = instData?.total_os ?? 0;
                    return (
                      <button key={key}
                        onClick={() => setShowAgendar({ data: key })}
                        disabled={ocupacao === "bloqueado"}
                        className={`rounded-lg border p-2 text-center transition-all ${cfg.bg}
                          ${ocupacao !== "bloqueado" ? "hover:shadow cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                        title={`${cfg.label} — ${osCount}/${inst.max_instalacoes_dia}`}>
                        <p className="text-xs text-muted-foreground">{format(dia, "EEE", { locale: ptBR }).replace(".", "")}</p>
                        <p className="text-sm font-semibold">{format(dia, "d")}</p>
                        <p className={`text-xs font-medium mt-0.5 ${cfg.text}`}>
                          {ocupacao === "bloqueado" ? "—" : `${osCount}/${inst.max_instalacoes_dia}`}
                        </p>
                        {osCount > 0 && (
                          <div className="flex justify-center gap-0.5 mt-1">
                            {Array.from({ length: Math.min(osCount, 3) }).map((_, i) => (
                              <span key={i} className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: Detalhes de uma OS */}
      <Dialog open={!!osDetalhe} onOpenChange={() => setOsDetalhe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Instalação — Pedido {osDetalhe?.numero_pedido}</DialogTitle>
          </DialogHeader>
          {osDetalhe && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <p className="font-medium">{osDetalhe.cliente_nome}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Data / Hora</Label>
                  <p className="font-medium">
                    {osDetalhe.data_agendamento
                      ? format(parseISO(osDetalhe.data_agendamento), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                    {osDetalhe.hora_agendamento && ` às ${osDetalhe.hora_agendamento}`}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Instalador</Label>
                  <p className="font-medium">{osDetalhe.instalador_nome ?? "A definir"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge className={`${STATUS_OS[osDetalhe.status]?.bg ?? "bg-gray-400"} text-white text-xs`}>
                    {STATUS_OS[osDetalhe.status]?.label ?? osDetalhe.status}
                  </Badge>
                </div>
              </div>
              {(osDetalhe.cidade_obra || osDetalhe.endereco_obra) && (
                <div className="flex items-start gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p className="text-xs">
                    {osDetalhe.endereco_obra}
                    {osDetalhe.torre && ` — Torre ${osDetalhe.torre}`}
                    {osDetalhe.apartamento && ` AP ${osDetalhe.apartamento}`}
                    {osDetalhe.cidade_obra && `, ${osDetalhe.cidade_obra}`}
                  </p>
                </div>
              )}
              {osDetalhe.tipos_produto?.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {osDetalhe.tipos_produto.filter(Boolean).map((t: string) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              )}
              {osDetalhe.observacoes && (
                <p className="text-xs italic text-muted-foreground">"{osDetalhe.observacoes}"</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOsDetalhe(null)}>Fechar</Button>
            {osDetalhe && (
              <Button size="sm" onClick={() => { window.location.href = `/decor/pedidos/${osDetalhe.pedido_id}`; }}>
                Abrir pedido →
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Agendar nova OS */}
      <Dialog open={!!showAgendar} onOpenChange={() => setShowAgendar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Agendar Instalação</DialogTitle></DialogHeader>
          <AgendarForm
            instaladores={instaladores}
            dataDefault={showAgendar?.data ?? ""}
            pedidoIdDefault={showAgendar?.pedidoId ?? ""}
            onConfirm={(body) => agendarMutation.mutate(body)}
            loading={agendarMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: Gerenciar equipe */}
      <Dialog open={showInstalador} onOpenChange={setShowInstalador}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Equipe de Instalação</DialogTitle></DialogHeader>
          <GerenciarEquipe
            instaladores={instaladores}
            onSaved={() => qc.invalidateQueries({ queryKey: ["/api/modules/decor/instaladores"] })}
          />
        </DialogContent>
      </Dialog>
    </BrowserFrame>
  );
}

// ── AgendarForm ───────────────────────────────────────────────────────────────

function AgendarForm({ instaladores, dataDefault, pedidoIdDefault, onConfirm, loading }: {
  instaladores: any[]; dataDefault: string; pedidoIdDefault: string;
  onConfirm: (body: any) => void; loading: boolean;
}) {
  const [pedidoId, setPedidoId]           = useState(pedidoIdDefault);
  const [instaladorId, setInstaladorId]   = useState("");
  const [instalador2Id, setInstalador2Id] = useState("");
  const [data, setData]                   = useState(dataDefault || new Date().toISOString().split("T")[0]);
  const [hora, setHora]                   = useState("08:00");
  const [duracao, setDuracao]             = useState("4");
  const [cidade, setCidade]               = useState("");
  const [obs, setObs]                     = useState("");

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">ID ou número do pedido *</Label>
        <Input value={pedidoId} onChange={e => setPedidoId(e.target.value)}
          placeholder="ID do pedido Decor..." data-testid="input-agenda-pedido-id" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Data *</Label>
          <Input type="date" value={data} onChange={e => setData(e.target.value)} data-testid="input-agenda-data" />
        </div>
        <div>
          <Label className="text-xs">Horário</Label>
          <Input type="time" value={hora} onChange={e => setHora(e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Instalador principal</Label>
        <Select value={instaladorId} onValueChange={setInstaladorId}>
          <SelectTrigger data-testid="select-agenda-instalador">
            <SelectValue placeholder="Selecionar instalador..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">A definir</SelectItem>
            {instaladores.map((i: any) => (
              <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">2º Instalador (opcional)</Label>
        <Select value={instalador2Id} onValueChange={setInstalador2Id}>
          <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Nenhum</SelectItem>
            {instaladores.filter((i: any) => i.id !== instaladorId).map((i: any) => (
              <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Duração estimada (h)</Label>
          <Input type="number" step="0.5" min="1" max="12" value={duracao} onChange={e => setDuracao(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Cidade</Label>
          <Input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: Piçarras" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Observações</Label>
        <Textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Recados para o instalador..." />
      </div>
      <Button className="w-full"
        onClick={() => onConfirm({ pedidoId, instaladorId: (instaladorId && instaladorId !== "_none") ? instaladorId : undefined, instalador2Id: (instalador2Id && instalador2Id !== "_none") ? instalador2Id : undefined, data, hora, duracaoH: parseFloat(duracao), cidadeInstalacao: cidade || undefined, observacoes: obs || undefined })}
        disabled={!pedidoId || !data || loading}
        data-testid="btn-confirmar-agendamento">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarDays className="h-4 w-4 mr-2" />}
        Confirmar agendamento
      </Button>
    </div>
  );
}

// ── GerenciarEquipe ───────────────────────────────────────────────────────────

function GerenciarEquipe({ instaladores, onSaved }: { instaladores: any[]; onSaved: () => void }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nome: "", telefone: "", habilidades: "cortina,persiana",
    regioes: "", maxInstalacoesDia: "2", jornadaInicio: "08:00", jornadaFim: "18:00",
  });

  const criarMutation = useMutation({
    mutationFn: (body: any) => api.post("/api/modules/decor/instaladores", body),
    onSuccess: () => {
      toast({ title: "Instalador cadastrado!" }); onSaved(); setShowForm(false);
      setForm({ nome: "", telefone: "", habilidades: "cortina,persiana", regioes: "", maxInstalacoesDia: "2", jornadaInicio: "08:00", jornadaFim: "18:00" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const inativarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/modules/decor/instaladores/${id}`, { status: "inativo" }),
    onSuccess: () => { toast({ title: "Instalador inativado" }); onSaved(); },
  });

  return (
    <div className="space-y-4">
      {instaladores.map((i: any) => (
        <Card key={i.id}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{i.nome}</p>
              <p className="text-xs text-muted-foreground">{i.telefone || "Sem telefone"}</p>
              <div className="flex gap-1 mt-1 flex-wrap">
                {i.habilidades?.map((h: string) => <Badge key={h} variant="outline" className="text-xs px-1.5 py-0">{h}</Badge>)}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-muted-foreground">Máx/dia</p>
              <p className="font-bold text-sm">{i.max_instalacoes_dia}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => inativarMutation.mutate(i.id)}
              className="text-muted-foreground hover:text-red-600 text-xs">
              Inativar
            </Button>
          </CardContent>
        </Card>
      ))}
      {!showForm && (
        <Button variant="outline" className="w-full gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Adicionar instalador
        </Button>
      )}
      {showForm && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Novo instalador</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} data-testid="input-inst-nome" />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Habilidades (separadas por vírgula)</Label>
              <Input value={form.habilidades} onChange={e => setForm(f => ({ ...f, habilidades: e.target.value }))} placeholder="cortina,persiana,tapete" />
            </div>
            <div>
              <Label className="text-xs">Regiões (separadas por vírgula)</Label>
              <Input value={form.regioes} onChange={e => setForm(f => ({ ...f, regioes: e.target.value }))} placeholder="Piçarras,Balneário Camboriú" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Máx OS/dia</Label>
                <Input type="number" min="1" max="8" value={form.maxInstalacoesDia} onChange={e => setForm(f => ({ ...f, maxInstalacoesDia: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="time" value={form.jornadaInicio} onChange={e => setForm(f => ({ ...f, jornadaInicio: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={form.jornadaFim} onChange={e => setForm(f => ({ ...f, jornadaFim: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button className="flex-1" disabled={!form.nome || criarMutation.isPending}
                onClick={() => criarMutation.mutate({
                  nome: form.nome, telefone: form.telefone || undefined,
                  habilidades: form.habilidades.split(",").map((s: string) => s.trim()).filter(Boolean),
                  regioes: form.regioes.split(",").map((s: string) => s.trim()).filter(Boolean),
                  maxInstalacoesDia: parseInt(form.maxInstalacoesDia),
                  jornadaInicio: form.jornadaInicio, jornadaFim: form.jornadaFim,
                })}>
                {criarMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
