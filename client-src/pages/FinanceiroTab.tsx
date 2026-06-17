import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient as qc } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { DateInputBR, formatDateBR } from "@/components/ui/date-input-br";
import {
  AlertTriangle, Plus, CheckCircle2,
  Layers, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";

interface Props { pessoaId: string; }

interface ResumoFinanceiro {
  qtd_ar_aberto: string; saldo_ar: string; total_recebido: string;
  qtd_ap_aberto: string; saldo_ap: string;
  qtd_vencidos: string; valor_vencidos: string;
  proximo_vencimento?: string;
}

interface Lancamento {
  id: string; tipo: string; descricao: string; favorecido?: string;
  valor: string; data_vencimento: string; data_pagamento?: string;
  status: string; origem: string; origem_ref_tipo?: string;
  plano_conta_codigo?: string; plano_conta_descricao?: string;
  centro_custo_nome?: string;
}

interface Projeto {
  id: string; numero: string; titulo: string; etapa: string; status: string;
  valor_contrato?: string; data_fim?: string; os_numero?: string;
  ar_gerado: boolean;
}

function fmtMoeda(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    previsto: "bg-gray-100 text-gray-700",
    aprovado: "bg-blue-100 text-blue-700",
    pago: "bg-green-100 text-green-700",
    vencido: "bg-red-100 text-red-700",
    cancelado: "bg-gray-100 text-gray-400 line-through",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] || map.previsto}`}>{status}</span>;
}

function EtapaBadge({ etapa }: { etapa: string }) {
  const map: Record<string, string> = {
    venda: "bg-amber-100 text-amber-700",
    pre_projeto: "bg-amber-100 text-amber-700",
    planejamento: "bg-blue-100 text-blue-700",
    em_execucao: "bg-purple-100 text-purple-700",
    concluido: "bg-green-100 text-green-700",
    cancelado: "bg-gray-100 text-gray-500",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[etapa] || "bg-gray-100 text-gray-700"}`}>{etapa.replace("_", " ")}</span>;
}

export default function FinanceiroTab({ pessoaId }: Props) {
  const { toast } = useToast();
  const [dialogGerarAR, setDialogGerarAR] = useState(false);
  const [projetoSelecionado, setProjetoSelecionado] = useState<Projeto | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const [formDescricao, setFormDescricao] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formVencimento, setFormVencimento] = useState("");
  const [formParcelas, setFormParcelas] = useState("1");
  const [formObs, setFormObs] = useState("");
  const [formOrigemRefTipo, setFormOrigemRefTipo] = useState("manual");
  const [formOrigemRefId, setFormOrigemRefId] = useState("");

  const { data, isLoading } = useQuery<{
    resumo: ResumoFinanceiro;
    lancamentos: Lancamento[];
    projetos: Projeto[];
  }>({
    queryKey: ["pessoa-financeiro", pessoaId],
    queryFn: () =>
      fetch(`/api/pessoas/${pessoaId}/financeiro`, { credentials: "include" }).then(r => r.json()),
    enabled: !!pessoaId,
  });

  const mutGerarAR = useMutation({
    mutationFn: (payload: any) =>
      fetch(`/api/control/pessoas/${pessoaId}/gerar-ar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }).then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || "Erro");
        return d;
      }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["pessoa-financeiro", pessoaId] });
      setDialogGerarAR(false);
      setProjetoSelecionado(null);
      resetForm();
      toast({ title: `A/R gerado — ${d.lancamentos?.length} lançamento(s)` });
    },
    onError: (e: any) => {
      if (e.message?.includes("409") || e.message?.includes("já existe")) {
        toast({ title: "AR já existe para esta origem" });
      } else {
        toast({ title: "Erro ao gerar A/R", description: e.message, variant: "destructive" });
      }
    },
  });

  const mutGerarARProjeto = useMutation({
    mutationFn: ({ projetoId, payload }: { projetoId: string; payload: any }) =>
      fetch(`/api/control/projetos/${projetoId}/gerar-ar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }).then(async r => {
        const d = await r.json();
        if (r.status === 409) return { jaExiste: true };
        if (!r.ok) throw new Error(d.message || "Erro");
        return d;
      }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["pessoa-financeiro", pessoaId] });
      setProjetoSelecionado(null);
      setDialogGerarAR(false);
      if ((d as any).jaExiste) {
        toast({ title: "AR já existia para este projeto" });
      } else {
        toast({ title: "A/R gerado com sucesso" });
      }
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function resetForm() {
    setFormDescricao(""); setFormValor(""); setFormVencimento("");
    setFormParcelas("1"); setFormObs("");
    setFormOrigemRefTipo("manual"); setFormOrigemRefId("");
  }

  function abrirDialogProjeto(p: Projeto) {
    setProjetoSelecionado(p);
    setFormDescricao(`Receita — ${p.numero}: ${p.titulo}`);
    setFormValor(p.valor_contrato || "");
    setFormVencimento(p.data_fim || "");
    setFormOrigemRefTipo("os");
    setFormOrigemRefId(p.id);
    setDialogGerarAR(true);
  }

  const resumo = data?.resumo;
  const lancamentos = (data?.lancamentos || []).filter(l =>
    filtroTipo === "todos" ? true : l.tipo === filtroTipo
  );
  const projetos = data?.projetos || [];

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Carregando dados financeiros...</p>;

  return (
    <div className="space-y-4">

      {/* ── CARDS DE RESUMO ── */}
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">A Receber (aberto)</span>
              </div>
              <p className="text-lg font-semibold text-green-700">{fmtMoeda(resumo.saldo_ar)}</p>
              <p className="text-xs text-muted-foreground">{resumo.qtd_ar_aberto} lançamentos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
                <span className="text-xs text-muted-foreground">Total recebido</span>
              </div>
              <p className="text-lg font-semibold text-teal-700">{fmtMoeda(resumo.total_recebido)}</p>
              <p className="text-xs text-muted-foreground">histórico</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Vencidos</span>
              </div>
              <p className="text-lg font-semibold text-red-600">{fmtMoeda(resumo.valor_vencidos)}</p>
              <p className="text-xs text-muted-foreground">{resumo.qtd_vencidos} em atraso</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpCircle className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">A Pagar (aberto)</span>
              </div>
              <p className="text-lg font-semibold text-amber-700">{fmtMoeda(resumo.saldo_ap)}</p>
              <p className="text-xs text-muted-foreground">{resumo.qtd_ap_aberto} lançamentos</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── PROJETOS DE ENGENHARIA ── */}
      {projetos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" /> Projetos de Engenharia vinculados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº / Título</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Contrato</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>AR</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projetos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{p.numero}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.titulo}</p>
                    </TableCell>
                    <TableCell><EtapaBadge etapa={p.etapa} /></TableCell>
                    <TableCell className="text-right text-sm">
                      {p.valor_contrato ? fmtMoeda(p.valor_contrato) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.data_fim ? formatDateBR(p.data_fim) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {p.ar_gerado
                        ? <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Gerado</span>
                        : <span className="text-xs text-muted-foreground">Não gerado</span>
                      }
                    </TableCell>
                    <TableCell>
                      {!p.ar_gerado && (
                        <Button size="sm" variant="outline" onClick={() => abrirDialogProjeto(p)}>
                          <Plus className="h-3 w-3 mr-1" /> Gerar AR
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── LANÇAMENTOS ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4" /> Lançamentos financeiros
          </CardTitle>
          <div className="flex gap-2">
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="receber">A receber</SelectItem>
                <SelectItem value="pagar">A pagar</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => { resetForm(); setProjetoSelecionado(null); setDialogGerarAR(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Gerar A/R
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lancamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum lançamento nos últimos/próximos 90 dias.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Plano</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lancamentos.map(l => (
                    <TableRow key={l.id} className={l.status === "vencido" ? "bg-red-50/30" : ""}>
                      <TableCell className="text-sm max-w-[200px] truncate">{l.descricao}</TableCell>
                      <TableCell>
                        {l.tipo === "receber"
                          ? <span className="text-xs text-green-700 flex items-center gap-0.5"><ArrowDownCircle className="h-3 w-3" /> receber</span>
                          : <span className="text-xs text-red-600 flex items-center gap-0.5"><ArrowUpCircle className="h-3 w-3" /> pagar</span>
                        }
                      </TableCell>
                      <TableCell className="text-sm">{formatDateBR(l.data_vencimento)}</TableCell>
                      <TableCell className="text-right font-medium text-sm">{fmtMoeda(l.valor)}</TableCell>
                      <TableCell><StatusBadge status={l.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.origem_ref_tipo
                          ? <Badge variant="outline" className="text-xs">{l.origem_ref_tipo}</Badge>
                          : l.origem}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.plano_conta_codigo ? `${l.plano_conta_codigo}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── DIALOG GERAR AR ── */}
      <Dialog open={dialogGerarAR} onOpenChange={v => { setDialogGerarAR(v); if (!v) { setProjetoSelecionado(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {projetoSelecionado ? `Gerar A/R — ${projetoSelecionado.numero}` : "Gerar A Receber"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Descrição *</label>
              <Input value={formDescricao} onChange={e => setFormDescricao(e.target.value)}
                placeholder="Ex: Receita projeto XYZ" className="mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Valor (R$) *</label>
                <Input type="number" step="0.01" value={formValor} onChange={e => setFormValor(e.target.value)}
                  placeholder="0,00" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Parcelas</label>
                <Select value={formParcelas} onValueChange={setFormParcelas}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,10,12].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Vencimento {parseInt(formParcelas) > 1 ? "(1ª parcela)" : ""} *</label>
              <DateInputBR value={formVencimento} onChange={setFormVencimento} className="mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Origem</label>
                <Select value={formOrigemRefTipo} onValueChange={setFormOrigemRefTipo}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="os">OS / Projeto</SelectItem>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="nfe">NF-e</SelectItem>
                    <SelectItem value="venda">Venda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formOrigemRefTipo !== "manual" && (
                <div>
                  <label className="text-sm font-medium">ID referência</label>
                  <Input value={formOrigemRefId} onChange={e => setFormOrigemRefId(e.target.value)}
                    placeholder="ID do doc." className="mt-1" />
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Observações</label>
              <Textarea value={formObs} onChange={e => setFormObs(e.target.value)} rows={2} className="mt-1" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogGerarAR(false); setProjetoSelecionado(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              disabled={!formDescricao || !formValor || !formVencimento || mutGerarAR.isPending || mutGerarARProjeto.isPending}
              onClick={() => {
                const payload = {
                  descricao: formDescricao,
                  valor: formValor,
                  dataVencimento: formVencimento,
                  parcelas: formParcelas,
                  origemRefTipo: formOrigemRefTipo,
                  origemRefId: formOrigemRefId || undefined,
                  observacoes: formObs || undefined,
                };
                if (projetoSelecionado) {
                  mutGerarARProjeto.mutate({ projetoId: projetoSelecionado.id, payload });
                } else {
                  mutGerarAR.mutate(payload);
                }
              }}
            >
              {(mutGerarAR.isPending || mutGerarARProjeto.isPending) ? "Gerando..." : `Gerar A/R${parseInt(formParcelas) > 1 ? ` (${formParcelas}x)` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
