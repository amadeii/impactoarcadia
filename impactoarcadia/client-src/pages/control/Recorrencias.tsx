// Sprint C7 — G2 Recorrência (UI).
// Página de gerenciamento de templates de recorrência de um cliente.
// Cron diário (06:30) materializa lançamentos 60 dias à frente; aqui o
// usuário também pode forçar processamento imediato via botão.

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FavorecidoPicker } from "@/components/control/FavorecidoPicker";
import { QuickCreatePessoaDialog } from "@/components/control/QuickCreatePessoaDialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInputBR, formatDateBR } from "@/components/ui/date-input-br";
import { ArrowLeft, Plus, Repeat, RefreshCw, Trash2 } from "lucide-react";

interface Cliente { id: string; name: string; }
interface Template {
  id: string;
  descricao: string;
  tipo: "pagar" | "receber";
  frequencia: "mensal" | "quinzenal" | "semanal" | "anual";
  diaVencimento?: number | null;
  valorFixo?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  ativa: boolean;
  geradasAte?: string | null;
  favorecido?: string | null;
  observacoes?: string | null;
  // C-E10
  projetoId?: string | null;
  aplicarRateio?: boolean;
  tipoValor?: string;
  valorMinimo?: string | null;
  valorMaximo?: string | null;
}

const NONE = "__none__";
const formatBRL = (v?: string | number | null) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
};

export default function Recorrencias() {
  const [location] = useLocation();
  const clienteId = location.split('/').filter(Boolean)[1] ?? '';
  const { toast } = useToast();
  const [openNovo, setOpenNovo] = useState(false);

  const { data: clientes = [] } = useQuery<Cliente[]>({ queryKey: ["/api/clients"] });
  const cliente = clientes.find((c) => c.id === clienteId);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/control/clientes", clienteId, "templates-recorrencia"],
    enabled: !!clienteId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "templates-recorrencia"] });
    queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "lancamentos"] });
    queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "overview"] });
  };

  const toggleAtiva = useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) =>
      apiRequest("PATCH", `/api/control/templates-recorrencia/${id}`, { ativa }),
    onSuccess: () => invalidate(),
  });

  const inativar = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/control/templates-recorrencia/${id}`),
    onSuccess: () => { toast({ title: "Template inativado" }); invalidate(); },
  });

  const processar = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/control/templates-recorrencia/processar`);
      return await r.json();
    },
    onSuccess: (r: any) => {
      toast({ title: "Processamento concluído", description: `${r.totalGerados ?? 0} lançamento(s) gerado(s)` });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-recorrencias">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/control/${clienteId}`}>
          <Button variant="ghost" size="sm" data-testid="button-back-control">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Repeat className="h-6 w-6 text-primary" /> Recorrências
          </h1>
          <p className="text-sm text-muted-foreground">{cliente?.name ?? ""} — geração automática 60 dias à frente, todo dia às 06:30</p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => processar.mutate()}
          disabled={processar.isPending}
          data-testid="button-processar-agora"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${processar.isPending ? "animate-spin" : ""}`} />
          Processar agora
        </Button>
        <NovoTemplateDialog clienteId={clienteId!} open={openNovo} onOpenChange={setOpenNovo} onCreated={invalidate} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates ativos e inativos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum template cadastrado. Crie um para automatizar lançamentos recorrentes.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead className="text-right">Valor fixo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Geradas até</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id} data-testid={`row-template-${t.id}`}>
                    <TableCell className="font-medium">
                      {t.descricao}
                      {t.favorecido && <div className="text-xs text-muted-foreground">{t.favorecido}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.tipo === "pagar" ? "destructive" : "default"}>{t.tipo}</Badge>
                    </TableCell>
                    <TableCell><Badge variant="outline">{t.frequencia}</Badge></TableCell>
                    <TableCell className="text-sm">{t.diaVencimento ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatBRL(t.valorFixo)}</TableCell>
                    <TableCell className="text-sm">{formatDateBR(t.dataInicio)}</TableCell>
                    <TableCell className="text-sm">{t.dataFim ? formatDateBR(t.dataFim) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.geradasAte ? formatDateBR(t.geradasAte) : "—"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={t.ativa}
                        onCheckedChange={(v) => toggleAtiva.mutate({ id: t.id, ativa: v })}
                        data-testid={`switch-ativa-${t.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { if (confirm("Inativar este template? Lançamentos já gerados serão preservados.")) inativar.mutate(t.id); }}
                        data-testid={`button-inativar-${t.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────── Dialog de criação de template
function NovoTemplateDialog({
  clienteId, open, onOpenChange, onCreated,
}: { clienteId: string; open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<"pagar" | "receber">("pagar");
  const [descricao, setDescricao] = useState("");
  const [favorecido, setFavorecido] = useState("");
  const [pessoaId, setPessoaId] = useState<string>("");
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [frequencia, setFrequencia] = useState<"mensal" | "quinzenal" | "semanal" | "anual">("mensal");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [valorFixo, setValorFixo] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState("");
  const [planoContaId, setPlanoContaId] = useState<string>(NONE);
  const [centroCustoId, setCentroCustoId] = useState<string>(NONE);
  const [contaBancariaId, setContaBancariaId] = useState<string>(NONE);
  const [tipoDocumentoId, setTipoDocumentoId] = useState<string>(NONE);
  const [observacoes, setObservacoes] = useState("");
  // C-E10: projeto + rateio
  const [projetoId, setProjetoId] = useState<string>(NONE);
  const [aplicarRateio, setAplicarRateio] = useState(false);

  const { data: planos = [] } = useQuery<any[]>({ queryKey: ["/api/control/planos-contas"], enabled: open });
  const { data: centros = [] } = useQuery<any[]>({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"], enabled: open });
  const { data: contas = [] } = useQuery<any[]>({ queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"], enabled: open });
  const { data: tiposDoc = [] } = useQuery<any[]>({ queryKey: ["/api/control/tipos-documento"], enabled: open });
  const { data: projetos = [] } = useQuery<any[]>({ queryKey: ["/api/engineering/projects"], enabled: open });

  const reset = () => {
    setTipo("pagar"); setDescricao(""); setFavorecido(""); setPessoaId(""); setFrequencia("mensal");
    setDiaVencimento("10"); setValorFixo("");
    setDataInicio(new Date().toISOString().slice(0, 10)); setDataFim("");
    setPlanoContaId(NONE); setCentroCustoId(NONE); setContaBancariaId(NONE); setTipoDocumentoId(NONE);
    setObservacoes(""); setProjetoId(NONE); setAplicarRateio(false);
  };

  const criar = useMutation({
    mutationFn: async () => {
      const payload: any = {
        tipo, descricao, frequencia,
        diaVencimento: ["mensal", "anual"].includes(frequencia) ? Number(diaVencimento) || 1 : null,
        valorFixo: valorFixo ? String(Number(valorFixo)) : null,
        dataInicio,
        dataFim: dataFim || null,
        favorecido: favorecido || null,
        pessoaId: pessoaId || null,
        planoContaId: planoContaId === NONE ? null : planoContaId,
        centroCustoId: centroCustoId === NONE ? null : centroCustoId,
        contaBancariaId: contaBancariaId === NONE ? null : contaBancariaId,
        tipoDocumentoId: tipoDocumentoId === NONE ? null : tipoDocumentoId,
        observacoes: observacoes || null,
        projetoId: projetoId === NONE ? null : projetoId,
        aplicarRateio,
      };
      return await apiRequest("POST", `/api/control/clientes/${clienteId}/templates-recorrencia`, payload);
    },
    onSuccess: () => {
      toast({ title: "Template criado", description: "As primeiras ocorrências foram geradas." });
      reset();
      onOpenChange(false);
      onCreated();
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha", variant: "destructive" }),
  });

  const podeSubmeter = !!descricao && !!dataInicio;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button data-testid="button-novo-template"><Plus className="h-4 w-4 mr-1" /> Novo template</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo template de recorrência</DialogTitle></DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger data-testid="select-template-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagar">A pagar</SelectItem>
                <SelectItem value="receber">A receber</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Frequência</Label>
            <Select value={frequencia} onValueChange={(v) => setFrequencia(v as any)}>
              <SelectTrigger data-testid="select-template-freq"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="quinzenal">Quinzenal</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} data-testid="input-template-descricao" />
          </div>

          <div>
            <Label>Favorecido / Pagador</Label>
            <FavorecidoPicker
              value={pessoaId || undefined}
              label={favorecido || undefined}
              onChange={(id, p) => { setPessoaId(id ?? ""); setFavorecido(p?.nomeFantasia ?? ""); }}
              onQuickCreate={() => setShowQuickCreate(true)}
              placeholder="Buscar pessoa ou empresa..."
              data-testid="favorecido-picker-recorrencia"
            />
            <QuickCreatePessoaDialog
              open={showQuickCreate}
              onOpenChange={setShowQuickCreate}
              papelPadrao="fornecedor"
              onCreated={(p) => { setPessoaId(p.id); setFavorecido(p.nomeFantasia); setShowQuickCreate(false); }}
            />
          </div>

          <div>
            <Label>Valor fixo (R$) — opcional</Label>
            <Input type="number" step="0.01" value={valorFixo} onChange={(e) => setValorFixo(e.target.value)} data-testid="input-template-valor" />
          </div>

          {(frequencia === "mensal" || frequencia === "anual") && (
            <div>
              <Label>Dia de vencimento (1–28)</Label>
              <Input type="number" min={1} max={28} value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} data-testid="input-template-dia" />
            </div>
          )}

          <div>
            <Label>Início</Label>
            <DateInputBR value={dataInicio} onChange={setDataInicio} data-testid="input-template-inicio" />
          </div>

          <div>
            <Label>Fim (opcional)</Label>
            <DateInputBR value={dataFim} onChange={setDataFim} data-testid="input-template-fim" />
          </div>

          <div>
            <Label>Tipo de documento</Label>
            <Select value={tipoDocumentoId} onValueChange={setTipoDocumentoId}>
              <SelectTrigger data-testid="select-template-tipo-doc"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {tiposDoc.map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Plano de contas</Label>
            <Select value={planoContaId} onValueChange={setPlanoContaId}>
              <SelectTrigger data-testid="select-template-plano"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {planos.filter((p: any) => p.permiteLancamento).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.descricao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Centro de custo</Label>
            <Select value={centroCustoId} onValueChange={setCentroCustoId}>
              <SelectTrigger data-testid="select-template-centro"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {centros.filter((c: any) => c.ativo).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Conta bancária</Label>
            <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
              <SelectTrigger data-testid="select-template-conta"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {contas.filter((c: any) => c.ativo).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.banco}{c.conta ? ` • ${c.conta}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} data-testid="input-template-obs" />
          </div>

          {/* C-E10: Projeto + Rateio Automático */}
          <div>
            <Label>Projeto (opcional)</Label>
            <Select value={projetoId} onValueChange={setProjetoId}>
              <SelectTrigger data-testid="select-template-projeto"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {projetos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.numero} — {p.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 pt-5">
            <Switch
              checked={aplicarRateio}
              onCheckedChange={setAplicarRateio}
              data-testid="switch-aplicar-rateio"
            />
            <div>
              <Label className="text-sm">Rateio Automático</Label>
              <p className="text-xs text-muted-foreground">Ao gerar lançamentos, aplicar motor Impacto/SAF</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={!podeSubmeter || criar.isPending} data-testid="button-template-salvar">
            {criar.isPending ? "Salvando..." : "Criar template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
