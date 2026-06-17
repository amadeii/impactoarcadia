/**
 * CartaoTab.tsx — Aba de Cartão Corporativo no ControlDetalhe
 *
 * INSTRUÇÃO DE INTEGRAÇÃO em client/src/pages/ControlDetalhe.tsx:
 *   1. import CartaoTab from "./control/ControlTabs/CartaoTab";
 *   2. Adicionar TabsTrigger:
 *      <TabsTrigger value="cartao"><CreditCard className="h-4 w-4 mr-1"/>Cartão</TabsTrigger>
 *   3. Adicionar TabsContent:
 *      <TabsContent value="cartao"><CartaoTab clienteId={clienteId} /></TabsContent>
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import {
  CreditCard, Plus, Pencil, Trash2, Upload, RefreshCw, CheckCircle2,
  Building, ChevronRight, AlertTriangle, FileSpreadsheet, X, Eye,
} from "lucide-react";
import { DateInputBR, formatDateBR } from "@/components/ui/date-input-br";

interface CartaoTabProps { clienteId: string; }

interface Cartao {
  id: string; nome: string; bandeira?: string; ultimos_digitos?: string;
  limite?: string; status: string; portadores?: string[];
  conta_banco?: string; conta_bancaria_id?: string;
}

interface Fatura {
  id: string; cartao_id: string; competencia: string; vencimento: string;
  valor_total: string; status: string; lancamento_ap_id?: string;
  qtd_transacoes?: string; lancamento_status?: string;
}

interface Transacao {
  id: string; portador?: string; estabelecimento?: string; data_transacao: string;
  valor: string; mcc?: string; categoria_mcc?: string; status_transacao: string;
  plano_conta_id?: string; plano_conta_descricao?: string; plano_conta_codigo?: string;
  centro_custo_id?: string; centro_custo_nome?: string; tipo_transacao: string;
}

interface ContaBancaria { id: string; banco: string; agencia?: string; conta?: string; }
interface PlanoConta { id: string; codigo: string; descricao: string; }
interface CentroCusto { id: string; codigo: string; nome: string; }

const schemaCartao = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  bandeira: z.string().optional(),
  ultimos_digitos: z.string().max(4).optional(),
  limite: z.string().optional(),
  conta_bancaria_id: z.string().optional(),
  portadores: z.string().optional(),
  observacoes: z.string().optional(),
});

const schemaFatura = z.object({
  competencia: z.string().min(7, "Competência obrigatória (YYYY-MM)"),
  vencimento: z.string().min(1, "Vencimento obrigatório"),
  valor_total: z.string().optional(),
  observacoes: z.string().optional(),
});

function fmtMoeda(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function wfBadge(s: string | null | undefined) {
  if (!s) return null;
  const map: Record<string, { label: string; color: string }> = {
    programado: { label: "Programado", color: "bg-blue-100 text-blue-800" },
    autorizado: { label: "Autorizado", color: "bg-amber-100 text-amber-800" },
    pago: { label: "Pago", color: "bg-green-100 text-green-800" },
    conciliado: { label: "Conciliado", color: "bg-teal-100 text-teal-800" },
  };
  const m = map[s] || { label: s, color: "bg-gray-100 text-gray-800" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.color}`}>{m.label}</span>;
}

export default function CartaoTab({ clienteId }: CartaoTabProps) {
  const { toast } = useToast();
  const [selectedCartao, setSelectedCartao] = useState<Cartao | null>(null);
  const [selectedFatura, setSelectedFatura] = useState<Fatura | null>(null);
  const [dialogCartao, setDialogCartao] = useState(false);
  const [dialogFatura, setDialogFatura] = useState(false);
  const [dialogImport, setDialogImport] = useState(false);
  const [editCartao, setEditCartao] = useState<Cartao | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [classifDialog, setClassifDialog] = useState<Transacao | null>(null);
  const [classifPlano, setClassifPlano] = useState("");
  const [classifCC, setClassifCC] = useState("");

  // Queries
  const { data: cartoes = [], isLoading: loadingCartoes } = useQuery<Cartao[]>({
    queryKey: ["cartoes", clienteId],
    queryFn: () => apiRequest("GET", `/api/control/clientes/${clienteId}/cartoes`).then(r => r.json()),
  });

  const { data: faturas = [], isLoading: loadingFaturas } = useQuery<Fatura[]>({
    queryKey: ["faturas", selectedCartao?.id],
    queryFn: () => apiRequest("GET", `/api/control/cartoes/${selectedCartao!.id}/faturas`).then(r => r.json()),
    enabled: !!selectedCartao,
  });

  const { data: transacoes = [] } = useQuery<Transacao[]>({
    queryKey: ["transacoes", selectedFatura?.id],
    queryFn: () => apiRequest("GET", `/api/control/faturas/${selectedFatura!.id}/transacoes`).then(r => r.json()),
    enabled: !!selectedFatura,
  });

  const { data: contas = [] } = useQuery<ContaBancaria[]>({
    queryKey: ["contas-bancarias", clienteId],
    queryFn: () => apiRequest("GET", `/api/control/clientes/${clienteId}/contas-bancarias`).then(r => r.json()),
  });

  const { data: planos = [] } = useQuery<PlanoConta[]>({
    queryKey: ["planos-contas"],
    queryFn: () => apiRequest("GET", `/api/control/planos-contas`).then(r => r.json()),
  });

  const { data: centros = [] } = useQuery<CentroCusto[]>({
    queryKey: ["centros-custo", clienteId],
    queryFn: () => apiRequest("GET", `/api/control/clientes/${clienteId}/centros-custo`).then(r => r.json()),
  });

  // Mutations
  const mutCartao = useMutation({
    mutationFn: (data: any) => editCartao
      ? apiRequest("PATCH", `/api/control/cartoes/${editCartao.id}`, data).then(r => r.json())
      : apiRequest("POST", `/api/control/clientes/${clienteId}/cartoes`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cartoes", clienteId] });
      setDialogCartao(false); setEditCartao(null);
      toast({ title: editCartao ? "Cartão atualizado" : "Cartão criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mutFatura = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/control/cartoes/${selectedCartao!.id}/faturas`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faturas", selectedCartao?.id] });
      setDialogFatura(false);
      toast({ title: "Fatura criada com lançamento AP" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mutRecalcular = useMutation({
    mutationFn: (faturaId: string) =>
      apiRequest("POST", `/api/control/faturas/${faturaId}/recalcular`, {}).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faturas", selectedCartao?.id] });
      toast({ title: "Total da fatura recalculado" });
    },
  });

  const mutClassificar = useMutation({
    mutationFn: ({ id, plano_conta_id, centro_custo_id }: any) =>
      apiRequest("PATCH", `/api/control/transacoes-cartao/${id}/classificar`, { plano_conta_id, centro_custo_id }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transacoes", selectedFatura?.id] });
      setClassifDialog(null);
      toast({ title: "Transação classificada" });
    },
  });

  const mutConfirmarImport = useMutation({
    mutationFn: (transacoes: any[]) =>
      apiRequest("POST", `/api/control/faturas/${selectedFatura!.id}/importar-caju/confirmar`, { transacoes }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["transacoes", selectedFatura?.id] });
      qc.invalidateQueries({ queryKey: ["faturas", selectedCartao?.id] });
      setDialogImport(false); setCsvPreview([]); setCsvFile(null);
      toast({ title: `${data.importadas} transações importadas`, description: `Novo total: ${fmtMoeda(data.novo_total)}` });
    },
    onError: (e: any) => toast({ title: "Erro na importação", description: e.message, variant: "destructive" }),
  });

  const mutDeleteTransacao = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/control/transacoes-cartao/${id}`, {}).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transacoes", selectedFatura?.id] });
      toast({ title: "Transação removida" });
    },
  });

  // Forms
  const formCartao = useForm({ resolver: zodResolver(schemaCartao), defaultValues: { nome: "", bandeira: "", ultimos_digitos: "", limite: "", conta_bancaria_id: "", portadores: "", observacoes: "" } });
  const formFatura = useForm({ resolver: zodResolver(schemaFatura), defaultValues: { competencia: "", vencimento: "", valor_total: "", observacoes: "" } });

  function openEditCartao(c: Cartao) {
    setEditCartao(c);
    formCartao.reset({
      nome: c.nome, bandeira: c.bandeira || "", ultimos_digitos: c.ultimos_digitos || "",
      limite: c.limite || "", conta_bancaria_id: c.conta_bancaria_id || "",
      portadores: (c.portadores || []).join(", "), observacoes: "",
    });
    setDialogCartao(true);
  }

  async function handleCsvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setLoadingCsv(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/control/faturas/${selectedFatura!.id}/importar-caju/preview`, {
        method: "POST", body: fd, credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setCsvPreview(data.preview_completo || []);
      toast({ title: `${data.total} transações encontradas`, description: `${data.ignoradas} ignoradas (depósitos/resgates)` });
    } catch (ex: any) {
      toast({ title: "Erro no CSV", description: ex.message, variant: "destructive" });
    } finally {
      setLoadingCsv(false);
    }
  }

  function submitCartao(values: any) {
    const portadores = values.portadores
      ? values.portadores.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    mutCartao.mutate({ ...values, portadores });
  }

  const totalTransacoes = transacoes.reduce((s, t) => s + (t.tipo_transacao === "compra" ? parseFloat(t.valor || "0") : 0), 0);
  const naoClassificadas = transacoes.filter(t => !t.plano_conta_id && t.tipo_transacao === "compra").length;

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* CARTÕES */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" /> Cartões Corporativos
          </CardTitle>
          <Button size="sm" onClick={() => { setEditCartao(null); formCartao.reset(); setDialogCartao(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Cartão
          </Button>
        </CardHeader>
        <CardContent>
          {loadingCartoes ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : cartoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cartoes.map(c => (
                <div
                  key={c.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${selectedCartao?.id === c.id ? "border-primary bg-primary/5" : "hover:border-border"}`}
                  onClick={() => { setSelectedCartao(c); setSelectedFatura(null); }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{c.nome}</p>
                      {c.bandeira && <p className="text-xs text-muted-foreground">{c.bandeira}{c.ultimos_digitos ? ` ···· ${c.ultimos_digitos}` : ""}</p>}
                      {c.limite && <p className="text-xs text-muted-foreground">Limite: {fmtMoeda(c.limite)}</p>}
                      {c.conta_banco && <p className="text-xs text-muted-foreground">Conta: {c.conta_banco}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEditCartao(c); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Badge variant={c.status === "ativo" ? "default" : "secondary"} className="text-xs">{c.status}</Badge>
                    </div>
                  </div>
                  {c.portadores && c.portadores.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Portadores: {c.portadores.join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* FATURAS */}
      {selectedCartao && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ChevronRight className="h-4 w-4" />
              Faturas — {selectedCartao.nome}
            </CardTitle>
            <Button size="sm" onClick={() => { formFatura.reset(); setDialogFatura(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Fatura
            </Button>
          </CardHeader>
          <CardContent>
            {loadingFaturas ? (
              <p className="text-sm text-muted-foreground">Carregando faturas...</p>
            ) : faturas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma fatura para este cartão.</p>
            ) : (
              <div className="overflow-y-auto max-h-56 rounded border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lanç. AP</TableHead>
                      <TableHead>Transações</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faturas.map(f => (
                      <TableRow
                        key={f.id}
                        className={`cursor-pointer ${selectedFatura?.id === f.id ? "bg-primary/5" : "hover:bg-muted/30"}`}
                        onClick={() => setSelectedFatura(f)}
                      >
                        <TableCell className="font-medium">{f.competencia}</TableCell>
                        <TableCell>{formatDateBR(f.vencimento)}</TableCell>
                        <TableCell className="text-right">{fmtMoeda(f.valor_total)}</TableCell>
                        <TableCell>
                          <Badge variant={f.status === "aberta" ? "outline" : "default"}>{f.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {f.lancamento_status && (
                            <Badge variant={f.lancamento_status === "pago" ? "default" : "outline"} className="text-xs">
                              {f.lancamento_status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{f.qtd_transacoes || 0}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Recalcular total"
                            onClick={e => { e.stopPropagation(); mutRecalcular.mutate(f.id); }}>
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TRANSAÇÕES DA FATURA */}
      {selectedFatura && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4" />
                Transações — Fatura {selectedFatura.competencia}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Total: {fmtMoeda(totalTransacoes)}
                {naoClassificadas > 0 && (
                  <span className="ml-2 text-amber-600 flex items-center gap-1 inline-flex">
                    <AlertTriangle className="h-3 w-3" /> {naoClassificadas} sem classificação
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDialogImport(true)}>
                <Upload className="h-4 w-4 mr-1" /> Importar Caju CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {transacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma transação. Importe o CSV do Caju ou adicione manualmente.</p>
            ) : (
              <div className="overflow-y-auto max-h-80 rounded border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Portador</TableHead>
                      <TableHead>Estabelecimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>MCC</TableHead>
                      <TableHead>Plano de Contas</TableHead>
                      <TableHead>Centro Custo</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transacoes.map(t => (
                      <TableRow key={t.id} className={!t.plano_conta_id && t.tipo_transacao === "compra" ? "bg-amber-50/30" : ""}>
                        <TableCell className="text-xs">{new Date(t.data_transacao).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-sm">{t.portador || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">{t.estabelecimento || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{fmtMoeda(t.valor)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.mcc || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {t.plano_conta_descricao
                            ? <span className="text-green-700">{t.plano_conta_codigo} — {t.plano_conta_descricao}</span>
                            : <span className="text-amber-600">Não classificado</span>
                          }
                        </TableCell>
                        <TableCell className="text-xs">{t.centro_custo_nome || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Classificar"
                              onClick={() => { setClassifDialog(t); setClassifPlano(t.plano_conta_id || ""); setClassifCC(t.centro_custo_id || ""); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Remover"
                              onClick={() => mutDeleteTransacao.mutate(t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* DIALOG NOVO/EDITAR CARTÃO */}
      <Dialog open={dialogCartao} onOpenChange={setDialogCartao}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editCartao ? "Editar Cartão" : "Novo Cartão Corporativo"}</DialogTitle>
          </DialogHeader>
          <Form {...formCartao}>
            <form onSubmit={formCartao.handleSubmit(submitCartao)} className="space-y-3">
              <FormField control={formCartao.control} name="nome" render={({ field }) => (
                <FormItem><FormLabel>Nome do cartão *</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: Caju Eder Mendes" /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={formCartao.control} name="bandeira" render={({ field }) => (
                  <FormItem><FormLabel>Bandeira</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Visa">Visa</SelectItem>
                        <SelectItem value="Mastercard">Mastercard</SelectItem>
                        <SelectItem value="Elo">Elo</SelectItem>
                        <SelectItem value="Caju">Caju</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage /></FormItem>
                )} />
                <FormField control={formCartao.control} name="ultimos_digitos" render={({ field }) => (
                  <FormItem><FormLabel>Últimos 4 dígitos</FormLabel>
                    <FormControl><Input {...field} maxLength={4} placeholder="0000" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={formCartao.control} name="limite" render={({ field }) => (
                  <FormItem><FormLabel>Limite (R$)</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.01" placeholder="0,00" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
                <FormField control={formCartao.control} name="conta_bancaria_id" render={({ field }) => (
                  <FormItem><FormLabel>Conta bancária</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.banco}{c.agencia ? ` ag.${c.agencia}` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={formCartao.control} name="portadores" render={({ field }) => (
                <FormItem><FormLabel>Portadores (separados por vírgula)</FormLabel>
                  <FormControl><Input {...field} placeholder="João Silva, Maria Santos" /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={formCartao.control} name="observacoes" render={({ field }) => (
                <FormItem><FormLabel>Observações</FormLabel>
                  <FormControl><Textarea {...field} rows={2} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogCartao(false)}>Cancelar</Button>
                <Button type="submit" disabled={mutCartao.isPending}>
                  {mutCartao.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DIALOG NOVA FATURA */}
      <Dialog open={dialogFatura} onOpenChange={setDialogFatura}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Fatura — {selectedCartao?.nome}</DialogTitle>
          </DialogHeader>
          <Form {...formFatura}>
            <form onSubmit={formFatura.handleSubmit((v) => mutFatura.mutate(v))} className="space-y-3">
              <FormField control={formFatura.control} name="competencia" render={({ field }) => (
                <FormItem><FormLabel>Competência (YYYY-MM) *</FormLabel>
                  <FormControl><Input {...field} placeholder="2026-05" /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={formFatura.control} name="vencimento" render={({ field }) => (
                <FormItem><FormLabel>Vencimento *</FormLabel>
                  <FormControl>
                    <DateInputBR value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={formFatura.control} name="valor_total" render={({ field }) => (
                <FormItem><FormLabel>Valor estimado (R$)</FormLabel>
                  <FormControl><Input {...field} type="number" step="0.01" placeholder="0,00" /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={formFatura.control} name="observacoes" render={({ field }) => (
                <FormItem><FormLabel>Observações</FormLabel>
                  <FormControl><Textarea {...field} rows={2} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <p className="text-xs text-muted-foreground">
                Será criado automaticamente um lançamento AP para pagamento desta fatura.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogFatura(false)}>Cancelar</Button>
                <Button type="submit" disabled={mutFatura.isPending}>
                  {mutFatura.isPending ? "Criando..." : "Criar Fatura"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DIALOG IMPORTAR CAJU CSV */}
      <Dialog open={dialogImport} onOpenChange={v => { setDialogImport(v); if (!v) { setCsvPreview([]); setCsvFile(null); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Importar Extrato Caju — Fatura {selectedFatura?.competencia}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">Arquivo CSV exportado do sistema Caju</p>
              <Input type="file" accept=".csv" onChange={handleCsvChange} className="max-w-xs mx-auto" />
              {loadingCsv && <p className="text-xs text-muted-foreground mt-2">Processando...</p>}
            </div>

            {csvPreview.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{csvPreview.length} transações para importar</p>
                  <Badge variant="outline">{csvPreview.filter(t => !t.plano_conta_id).length} sem classificação</Badge>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Portador</TableHead>
                        <TableHead className="text-xs">Estabelecimento</TableHead>
                        <TableHead className="text-xs text-right">Valor</TableHead>
                        <TableHead className="text-xs">MCC</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.slice(0, 20).map((t, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{new Date(t.data_transacao).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-xs">{t.portador}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{t.estabelecimento}</TableCell>
                          <TableCell className="text-xs text-right">{fmtMoeda(t.valor)}</TableCell>
                          <TableCell className="text-xs">{t.mcc || "—"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-xs">{t.status_transacao}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {csvPreview.length > 20 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">
                            +{csvPreview.length - 20} transações adicionais
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Após importar, classifique cada transação com o plano de contas e centro de custo correspondente.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogImport(false); setCsvPreview([]); setCsvFile(null); }}>
              Cancelar
            </Button>
            <Button
              disabled={csvPreview.length === 0 || mutConfirmarImport.isPending}
              onClick={() => mutConfirmarImport.mutate(csvPreview)}
            >
              {mutConfirmarImport.isPending ? "Importando..." : `Importar ${csvPreview.length} transações`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG CLASSIFICAR TRANSAÇÃO */}
      <Dialog open={!!classifDialog} onOpenChange={v => !v && setClassifDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Classificar Transação</DialogTitle>
          </DialogHeader>
          {classifDialog && (
            <div className="space-y-3">
              <div className="text-sm">
                <p className="font-medium">{classifDialog.estabelecimento || "Estabelecimento"}</p>
                <p className="text-muted-foreground">{fmtMoeda(classifDialog.valor)} — {new Date(classifDialog.data_transacao).toLocaleDateString("pt-BR")}</p>
                {classifDialog.portador && <p className="text-xs text-muted-foreground">Portador: {classifDialog.portador}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Plano de Contas</label>
                <Select value={classifPlano} onValueChange={setClassifPlano}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                  <SelectContent>
                    {planos.filter((p: any) => p.permiteLancamento).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.descricao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Centro de Custo</label>
                <Select value={classifCC} onValueChange={setClassifCC}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {centros.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassifDialog(null)}>Cancelar</Button>
            <Button
              disabled={!classifPlano || mutClassificar.isPending}
              onClick={() => mutClassificar.mutate({ id: classifDialog!.id, plano_conta_id: classifPlano, centro_custo_id: classifCC || null })}
            >
              Salvar Classificação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
