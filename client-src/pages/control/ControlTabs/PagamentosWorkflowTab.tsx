/**
 * PagamentosWorkflowTab.tsx — Aba de Workflow de Pagamentos no ControlDetalhe
 *
 * INSTRUÇÃO DE INTEGRAÇÃO em client/src/pages/ControlDetalhe.tsx:
 *   1. import PagamentosWorkflowTab from "./control/ControlTabs/PagamentosWorkflowTab";
 *   2. Adicionar TabsTrigger:
 *      <TabsTrigger value="workflow-pagamento">
 *        <Workflow className="h-4 w-4 mr-1"/>Pgtos
 *      </TabsTrigger>
 *   3. Adicionar TabsContent:
 *      <TabsContent value="workflow-pagamento">
 *        <PagamentosWorkflowTab clienteId={clienteId} />
 *      </TabsContent>
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { DateInputBR, formatDateBR } from "@/components/ui/date-input-br";
import {
  Send, CheckCircle2, Banknote, RefreshCw, ArrowRight, Users,
  AlertTriangle, ClipboardList, Layers, Lock, Filter,
} from "lucide-react";

interface Props { clienteId: string; }

interface Lancamento {
  id: string; descricao: string; favorecido?: string; valor: string;
  data_vencimento: string; data_pagamento?: string; status: string;
  tipo: string; plano_conta_descricao?: string; centro_custo_nome?: string;
  workflow_status?: string;
  programado_por_nome?: string; data_programacao?: string;
  autorizado_por_nome?: string; data_autorizacao?: string;
  pago_por_nome?: string; data_pagamento_efetuado?: string;
  conciliado_por_nome?: string; lote_descricao?: string;
}

interface ContaBancaria { id: string; banco: string; agencia?: string; conta?: string; }

function fmtMoeda(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function WFBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    programado: "bg-blue-100 text-blue-800 border-blue-200",
    autorizado: "bg-amber-100 text-amber-800 border-amber-200",
    pago: "bg-green-100 text-green-800 border-green-200",
    conciliado: "bg-teal-100 text-teal-800 border-teal-200",
  };
  const labels: Record<string, string> = {
    programado: "Programado", autorizado: "Autorizado", pago: "Pago", conciliado: "Conciliado",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
      {labels[status] || status}
    </span>
  );
}

export default function PagamentosWorkflowTab({ clienteId }: Props) {
  const { toast } = useToast();
  const [abaAtiva, setAbaAtiva] = useState("programacao");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [dialogLote, setDialogLote] = useState(false);
  const [dialogConciliar, setDialogConciliar] = useState<Lancamento | null>(null);
  const [dataPagamentoLote, setDataPagamentoLote] = useState("");
  const [descricaoLote, setDescricaoLote] = useState("");
  const [contaConciliar, setContaConciliar] = useState("");
  const [dataConciliar, setDataConciliar] = useState("");
  const [filtroVencDe, setFiltroVencDe] = useState("");
  const [filtroVencAte, setFiltroVencAte] = useState("");

  // Queries
  const { data: filaProgramacao = [], refetch: refetchProg } = useQuery<Lancamento[]>({
    queryKey: ["fila-programacao", clienteId],
    queryFn: () => apiRequest("GET", `/api/control/clientes/${clienteId}/fila-programacao`).then(r => r.json()),
  });

  const { data: filaDiretor = [], refetch: refetchDiretor } = useQuery<Lancamento[]>({
    queryKey: ["fila-diretor", clienteId],
    queryFn: () => apiRequest("GET", `/api/control/clientes/${clienteId}/fila-diretor`).then(r => r.json()),
  });

  const { data: filaConciliacao = [], refetch: refetchConcil } = useQuery<Lancamento[]>({
    queryKey: ["fila-conciliacao-workflow", clienteId],
    queryFn: () => apiRequest("GET", `/api/control/clientes/${clienteId}/fila-conciliacao-workflow`).then(r => r.json()),
  });

  const { data: relatorio = [] } = useQuery<Lancamento[]>({
    queryKey: ["relatorio-workflow", clienteId, filtroVencDe, filtroVencAte],
    queryFn: () => apiRequest("GET",
      `/api/control/clientes/${clienteId}/relatorio-workflow?${filtroVencDe ? `data_ini=${filtroVencDe}&` : ""}${filtroVencAte ? `data_fim=${filtroVencAte}` : ""}`
    ).then(r => r.json()),
    enabled: abaAtiva === "relatorio",
  });

  const { data: contas = [] } = useQuery<ContaBancaria[]>({
    queryKey: ["contas-bancarias", clienteId],
    queryFn: () => apiRequest("GET", `/api/control/clientes/${clienteId}/contas-bancarias`).then(r => r.json()),
  });

  // Mutations
  const mutProgramar = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/control/lancamentos/${id}/programar`, {}).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fila-programacao", clienteId] }); toast({ title: "Enviado para pagamento" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mutProgramarLote = useMutation({
    mutationFn: (ids: string[]) => apiRequest("POST", `/api/control/clientes/${clienteId}/programar-lote`, { ids }).then(r => r.json()),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["fila-programacao", clienteId] });
      setSelecionados(new Set());
      toast({ title: `${d.programados} lançamentos programados` });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mutAutorizar = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/control/lancamentos/${id}/autorizar`, {}).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fila-diretor", clienteId] }); toast({ title: "Pagamento autorizado" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mutAutorizarLote = useMutation({
    mutationFn: (ids: string[]) => apiRequest("POST", `/api/control/clientes/${clienteId}/autorizar-lote`, { ids }).then(r => r.json()),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["fila-diretor", clienteId] });
      setSelecionados(new Set());
      toast({ title: `${d.autorizados} lançamentos autorizados` });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mutMarcarPago = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/control/lancamentos/${id}/marcar-pago`, {}).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fila-diretor", clienteId] }); toast({ title: "Marcado como pago" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mutPagarLote = useMutation({
    mutationFn: ({ ids, data_pagamento, descricao }: any) =>
      apiRequest("POST", `/api/control/clientes/${clienteId}/marcar-pago-lote`, { ids, data_pagamento, descricao }).then(r => r.json()),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["fila-diretor", clienteId] });
      qc.invalidateQueries({ queryKey: ["fila-conciliacao-workflow", clienteId] });
      setSelecionados(new Set()); setDialogLote(false);
      toast({ title: `Lote criado — ${d.pagos} pagamentos de ${fmtMoeda(d.total_valor)}` });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mutDevolver = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/control/lancamentos/${id}/devolver`, {}).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fila-diretor", clienteId] });
      qc.invalidateQueries({ queryKey: ["fila-programacao", clienteId] });
      toast({ title: "Devolvido para programação" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mutConciliarWorkflow = useMutation({
    mutationFn: ({ id, conta_bancaria_id, data_pagamento }: any) =>
      apiRequest("POST", `/api/control/lancamentos/${id}/conciliar-workflow`, { conta_bancaria_id, data_pagamento }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fila-conciliacao-workflow", clienteId] });
      qc.invalidateQueries({ queryKey: ["relatorio-workflow", clienteId] });
      setDialogConciliar(null);
      toast({ title: "Quitado e conciliado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function toggleSel(id: string) {
    setSelecionados(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function toggleAll(lista: Lancamento[]) {
    if (selecionados.size === lista.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(lista.map(l => l.id)));
    }
  }

  const totalSelecionados = (lista: Lancamento[]) =>
    lista.filter(l => selecionados.has(l.id)).reduce((s, l) => s + parseFloat(l.valor || "0"), 0);

  // ── COLUNA DESCRICAO ────────────────────────────────────────────────────────
  function ColunaDesc({ l }: { l: Lancamento }) {
    return (
      <div>
        <p className="text-sm font-medium">{l.descricao}</p>
        {l.favorecido && <p className="text-xs text-muted-foreground">{l.favorecido}</p>}
        {l.plano_conta_descricao && <p className="text-xs text-muted-foreground">{l.plano_conta_descricao}</p>}
        {l.centro_custo_nome && <p className="text-xs text-muted-foreground">{l.centro_custo_nome}</p>}
      </div>
    );
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* PIPELINE VISUAL */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="font-medium">{filaProgramacao.filter(l => !l.workflow_status).length}</span>
              <span>a programar</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full border border-blue-300">
              <Send className="h-3.5 w-3.5" />
              <span className="font-medium">{filaProgramacao.filter(l => l.workflow_status === "programado").length}</span>
              <span>programados</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full border border-amber-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-medium">{filaDiretor.filter(l => l.workflow_status === "autorizado").length}</span>
              <span>autorizados</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1.5 rounded-full border border-green-300">
              <Banknote className="h-3.5 w-3.5" />
              <span className="font-medium">{filaConciliacao.length}</span>
              <span>aguardando quitação</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={abaAtiva} onValueChange={v => { setAbaAtiva(v); setSelecionados(new Set()); }}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="programacao">
            <ClipboardList className="h-4 w-4 mr-1" />
            Programação
            {filaProgramacao.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{filaProgramacao.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="diretor">
            <Users className="h-4 w-4 mr-1" />
            Diretor Financeiro
            {filaDiretor.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{filaDiretor.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="conciliacao">
            <Lock className="h-4 w-4 mr-1" />
            Quitação
            {filaConciliacao.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{filaConciliacao.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="relatorio">
            <Layers className="h-4 w-4 mr-1" />
            Relatório
          </TabsTrigger>
        </TabsList>

        {/* ── ABA PROGRAMAÇÃO ── */}
        <TabsContent value="programacao" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Lançamentos a pagar — selecione e envie para o diretor
                </CardTitle>
                <div className="flex gap-2">
                  {selecionados.size > 0 && (
                    <>
                      <span className="text-sm text-muted-foreground self-center">
                        {selecionados.size} sel. · {fmtMoeda(totalSelecionados(filaProgramacao))}
                      </span>
                      <Button size="sm" onClick={() => mutProgramarLote.mutate(Array.from(selecionados))}>
                        <Send className="h-4 w-4 mr-1" />
                        Enviar {selecionados.size} para pagamento
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filaProgramacao.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum lançamento pendente de programação.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selecionados.size === filaProgramacao.length && filaProgramacao.length > 0}
                          onCheckedChange={() => toggleAll(filaProgramacao)}
                        />
                      </TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filaProgramacao.map(l => (
                      <TableRow key={l.id} className={selecionados.has(l.id) ? "bg-blue-50/40" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selecionados.has(l.id)}
                            onCheckedChange={() => toggleSel(l.id)}
                          />
                        </TableCell>
                        <TableCell><ColunaDesc l={l} /></TableCell>
                        <TableCell className="text-sm">{formatDateBR(l.data_vencimento)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtMoeda(l.valor)}</TableCell>
                        <TableCell><WFBadge status={l.workflow_status} /></TableCell>
                        <TableCell>
                          {!l.workflow_status && (
                            <Button size="sm" variant="outline" onClick={() => mutProgramar.mutate(l.id)}>
                              <Send className="h-3 w-3 mr-1" /> Enviar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA DIRETOR FINANCEIRO ── */}
        <TabsContent value="diretor" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Pagamentos — Autorizar e marcar como pago
                </CardTitle>
                <div className="flex gap-2">
                  {selecionados.size > 0 && (
                    <>
                      <span className="text-sm text-muted-foreground self-center">
                        {selecionados.size} sel. · {fmtMoeda(totalSelecionados(filaDiretor))}
                      </span>
                      <Button size="sm" variant="outline"
                        onClick={() => mutAutorizarLote.mutate(Array.from(selecionados).filter(id => filaDiretor.find(l => l.id === id)?.workflow_status === "programado"))}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Autorizar selecionados
                      </Button>
                      <Button size="sm"
                        onClick={() => setDialogLote(true)}>
                        <Banknote className="h-3 w-3 mr-1" /> Pagar selecionados em lote
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filaDiretor.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum lançamento aguardando autorização ou pagamento.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selecionados.size === filaDiretor.length && filaDiretor.length > 0}
                          onCheckedChange={() => toggleAll(filaDiretor)}
                        />
                      </TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Programado por</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filaDiretor.map(l => (
                      <TableRow key={l.id} className={selecionados.has(l.id) ? "bg-amber-50/40" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selecionados.has(l.id)}
                            onCheckedChange={() => toggleSel(l.id)}
                          />
                        </TableCell>
                        <TableCell><ColunaDesc l={l} /></TableCell>
                        <TableCell className="text-sm">{formatDateBR(l.data_vencimento)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtMoeda(l.valor)}</TableCell>
                        <TableCell><WFBadge status={l.workflow_status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.programado_por_nome || "—"}
                          {l.data_programacao && (
                            <span className="block">{new Date(l.data_programacao).toLocaleDateString("pt-BR")}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {l.workflow_status === "programado" && (
                              <>
                                <Button size="sm" variant="outline" className="text-amber-700 border-amber-300"
                                  onClick={() => mutAutorizar.mutate(l.id)}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Autorizar
                                </Button>
                                <Button size="sm" variant="ghost" className="text-muted-foreground"
                                  onClick={() => mutDevolver.mutate(l.id)}>
                                  Devolver
                                </Button>
                              </>
                            )}
                            {l.workflow_status === "autorizado" && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700"
                                onClick={() => mutMarcarPago.mutate(l.id)}>
                                <Banknote className="h-3 w-3 mr-1" /> Pago
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA QUITAÇÃO (CONCILIAÇÃO WORKFLOW) ── */}
        <TabsContent value="conciliacao" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Quitação — confirmar pagamentos e conciliar no sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filaConciliacao.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum lançamento aguardando quitação.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Pago por</TableHead>
                      <TableHead>Data pagto</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filaConciliacao.map(l => (
                      <TableRow key={l.id}>
                        <TableCell><ColunaDesc l={l} /></TableCell>
                        <TableCell className="text-sm">{formatDateBR(l.data_vencimento)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtMoeda(l.valor)}</TableCell>
                        <TableCell className="text-xs">{l.pago_por_nome || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {l.data_pagamento_efetuado
                            ? new Date(l.data_pagamento_efetuado).toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline"
                            onClick={() => {
                              setDialogConciliar(l);
                              setDataConciliar(l.data_pagamento_efetuado
                                ? new Date(l.data_pagamento_efetuado).toISOString().split("T")[0]
                                : new Date().toISOString().split("T")[0]);
                            }}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Quitar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA RELATÓRIO ── */}
        <TabsContent value="relatorio" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Relatório de pagamentos realizados
                </CardTitle>
                <div className="flex gap-2 items-center">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <DateInputBR value={filtroVencDe} onChange={setFiltroVencDe} placeholder="De" className="w-36" />
                  <DateInputBR value={filtroVencAte} onChange={setFiltroVencAte} placeholder="Até" className="w-36" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {relatorio.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum pagamento no período.
                </p>
              ) : (
                <>
                  <div className="flex gap-4 mb-4 text-sm">
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Total pago</p>
                      <p className="font-semibold text-green-700">
                        {fmtMoeda(relatorio.reduce((s, l) => s + parseFloat(l.valor || "0"), 0))}
                      </p>
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Qtd. lançamentos</p>
                      <p className="font-semibold">{relatorio.length}</p>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Programado</TableHead>
                        <TableHead>Autorizado</TableHead>
                        <TableHead>Pago por</TableHead>
                        <TableHead>Data pagto</TableHead>
                        <TableHead>Conciliado</TableHead>
                        <TableHead>Lote</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatorio.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="text-sm">
                            <p className="font-medium">{l.descricao}</p>
                            {l.favorecido && <p className="text-xs text-muted-foreground">{l.favorecido}</p>}
                          </TableCell>
                          <TableCell className="text-right font-medium">{fmtMoeda(l.valor)}</TableCell>
                          <TableCell><WFBadge status={l.workflow_status} /></TableCell>
                          <TableCell className="text-xs">{l.programado_por_nome || "—"}</TableCell>
                          <TableCell className="text-xs">{l.autorizado_por_nome || "—"}</TableCell>
                          <TableCell className="text-xs">{l.pago_por_nome || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {l.data_pagamento_efetuado
                              ? new Date(l.data_pagamento_efetuado).toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{l.conciliado_por_nome || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.lote_descricao || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG PAGAR EM LOTE */}
      <Dialog open={dialogLote} onOpenChange={setDialogLote}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4" /> Pagamento em Lote
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {selecionados.size} lançamento(s) selecionados · {fmtMoeda(totalSelecionados(filaDiretor))}
            </p>
            <div>
              <label className="text-sm font-medium">Data de pagamento *</label>
              <DateInputBR value={dataPagamentoLote} onChange={setDataPagamentoLote} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição do lote</label>
              <Input
                value={descricaoLote}
                onChange={e => setDescricaoLote(e.target.value)}
                placeholder={`Pagamentos ${new Date().toLocaleDateString("pt-BR")}`}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogLote(false)}>Cancelar</Button>
            <Button
              disabled={!dataPagamentoLote || mutPagarLote.isPending}
              onClick={() => mutPagarLote.mutate({
                ids: Array.from(selecionados).filter(id => filaDiretor.find(l => l.id === id)?.workflow_status === "autorizado"),
                data_pagamento: dataPagamentoLote,
                descricao: descricaoLote || undefined,
              })}
            >
              {mutPagarLote.isPending ? "Processando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG QUITAR (CONCILIAR WORKFLOW) */}
      <Dialog open={!!dialogConciliar} onOpenChange={v => !v && setDialogConciliar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Quitar Lançamento
            </DialogTitle>
          </DialogHeader>
          {dialogConciliar && (
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="font-medium">{dialogConciliar.descricao}</p>
                <p className="text-muted-foreground">{fmtMoeda(dialogConciliar.valor)}</p>
                {dialogConciliar.pago_por_nome && (
                  <p className="text-xs mt-1">Pago por: {dialogConciliar.pago_por_nome}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Conta bancária *</label>
                <Select value={contaConciliar} onValueChange={setContaConciliar}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                  <SelectContent>
                    {contas.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.banco}{c.agencia ? ` ag.${c.agencia}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Data do pagamento *</label>
                <DateInputBR value={dataConciliar} onChange={setDataConciliar} className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogConciliar(null)}>Cancelar</Button>
            <Button
              disabled={!contaConciliar || !dataConciliar || mutConciliarWorkflow.isPending}
              onClick={() => mutConciliarWorkflow.mutate({
                id: dialogConciliar!.id,
                conta_bancaria_id: contaConciliar,
                data_pagamento: dataConciliar,
              })}
            >
              {mutConciliarWorkflow.isPending ? "Quitando..." : "Confirmar Quitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
