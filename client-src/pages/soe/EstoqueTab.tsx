import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Package2, AlertTriangle, TrendingDown, TrendingUp,
  BarChart3, Warehouse, ArrowUpDown,
  CalendarDays, MapPin, Layers, ClipboardList
} from "lucide-react";

const api = {
  get: async (url: string) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  },
  post: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data), credentials: "include",
    });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  },
};

function fmt(v: any) { return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }); }
function fmtQty(v: any) { return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 3 }); }

export function EstoqueTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subtab, setSubtab] = useState("saldos");
  const [search, setSearch] = useState("");
  const [apenasAbaixoMinimo, setApenasAbaixoMinimo] = useState(false);
  const [showMovDialog, setShowMovDialog] = useState(false);
  const [movTipo, setMovTipo] = useState<"entrada" | "saida">("entrada");
  const [movForm, setMovForm] = useState({ depositoId: "", produtoFiscalId: "", quantidade: "", custoUnitario: "", justificativa: "" });

  const { data: dashboard } = useQuery<any>({
    queryKey: ["/api/est/dashboard"],
    queryFn: () => api.get("/api/est/dashboard"),
    refetchInterval: 30000,
  });

  const { data: saldosData, isLoading: loadingSaldos } = useQuery<any>({
    queryKey: ["/api/est/saldos", search, apenasAbaixoMinimo],
    queryFn: () => api.get(`/api/est/saldos?search=${encodeURIComponent(search)}&abaixoMinimo=${apenasAbaixoMinimo}&limit=100`),
  });

  const { data: movData, isLoading: loadingMov } = useQuery<any>({
    queryKey: ["/api/est/movimentos"],
    queryFn: () => api.get("/api/est/movimentos?limit=50"),
    enabled: subtab === "movimentos",
  });

  const { data: lotesData } = useQuery<any>({
    queryKey: ["/api/est/lotes"],
    queryFn: () => api.get("/api/est/lotes?status=ativo"),
    enabled: subtab === "lotes",
  });

  const { data: depositos = [] } = useQuery<any[]>({
    queryKey: ["/api/est/depositos"],
    queryFn: () => api.get("/api/est/depositos"),
  });

  const movMutation = useMutation({
    mutationFn: (data: any) => api.post(`/api/est/movimentos/${data.tipo}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/est/saldos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/est/movimentos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/est/dashboard"] });
      setShowMovDialog(false);
      setMovForm({ depositoId: "", produtoFiscalId: "", quantidade: "", custoUnitario: "", justificativa: "" });
      toast({ title: `${movTipo === "entrada" ? "Entrada" : "Saída"} registrada com sucesso.` });
    },
    onError: (e: any) => toast({ title: "Erro ao registrar movimento", description: e.message, variant: "destructive" }),
  });

  const handleMovSubmit = () => {
    if (!movForm.depositoId || !movForm.quantidade) {
      toast({ title: "Preencha depósito e quantidade", variant: "destructive" });
      return;
    }
    movMutation.mutate({
      tipo: movTipo,
      depositoId: movForm.depositoId,
      produtoFiscalId: movForm.produtoFiscalId || undefined,
      quantidade: parseFloat(movForm.quantidade),
      custoUnitario: movForm.custoUnitario ? parseFloat(movForm.custoUnitario) : undefined,
      justificativa: movForm.justificativa || undefined,
      origemTipo: `${movTipo}_manual`,
    });
  };

  const saldos = saldosData?.data || [];
  const movimentos = movData?.data || [];
  const lotes = lotesData?.data || [];
  const resumo = dashboard?.data?.resumo || {};
  const alertas = dashboard?.data?.alertas || {};
  const alertasVencimento = alertas.lotes_vencendo || [];
  const abaixoMinimo = alertas.abaixo_minimo || [];

  const tipoMovBadge = (tipo: string) => {
    if (tipo.includes("entrada") || tipo.includes("devolucao_cliente")) {
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs"><TrendingUp className="w-3 h-3 mr-1" />Entrada</Badge>;
    }
    if (tipo.includes("saida") || tipo.includes("retirada")) {
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs"><TrendingDown className="w-3 h-3 mr-1" />Saída</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{tipo}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><Package2 className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Produtos c/ saldo</p><p className="text-2xl font-bold">{resumo.total_produtos || 0}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><BarChart3 className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-xs text-muted-foreground">Valor em estoque</p><p className="text-2xl font-bold text-emerald-700">R$ {fmt(resumo.valor_total_estoque)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-xs text-muted-foreground">Abaixo do mínimo</p><p className="text-2xl font-bold text-amber-700">{resumo.produtos_abaixo_minimo || 0}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg"><CalendarDays className="w-5 h-5 text-orange-600" /></div>
            <div><p className="text-xs text-muted-foreground">Lotes vencendo</p><p className="text-2xl font-bold text-orange-700">{alertasVencimento.length}</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Alertas */}
      {(abaixoMinimo.length > 0 || alertasVencimento.length > 0) && (
        <div className="grid md:grid-cols-2 gap-3">
          {abaixoMinimo.slice(0, 3).map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="font-medium text-amber-900">{item.produto_descricao}</span>
              <span className="text-amber-700 ml-auto">Disponível: {fmtQty(item.total_disponivel)} {item.unidade}</span>
            </div>
          ))}
          {alertasVencimento.slice(0, 3).map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
              <CalendarDays className="w-4 h-4 text-orange-600 flex-shrink-0" />
              <span className="font-medium text-orange-900">{item.produto} — Lote {item.numero_lote}</span>
              <span className="text-orange-700 ml-auto">{item.dias_restantes} dias</span>
            </div>
          ))}
        </div>
      )}

      {/* Sub-abas */}
      <Tabs value={subtab} onValueChange={setSubtab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="saldos" className="gap-1.5"><Layers className="w-3.5 h-3.5" />Saldos</TabsTrigger>
            <TabsTrigger value="movimentos" className="gap-1.5"><ArrowUpDown className="w-3.5 h-3.5" />Movimentos</TabsTrigger>
            <TabsTrigger value="lotes" className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" />Lotes</TabsTrigger>
            <TabsTrigger value="depositos" className="gap-1.5"><Warehouse className="w-3.5 h-3.5" />Depósitos</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setMovTipo("entrada"); setShowMovDialog(true); }}>
              <TrendingUp className="w-4 h-4 mr-1" />Entrada
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setMovTipo("saida"); setShowMovDialog(true); }}>
              <TrendingDown className="w-4 h-4 mr-1" />Saída
            </Button>
          </div>
        </div>

        {/* Saldos */}
        <TabsContent value="saldos" className="mt-3 space-y-3">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-10" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button size="sm" variant={apenasAbaixoMinimo ? "default" : "outline"}
              onClick={() => setApenasAbaixoMinimo(!apenasAbaixoMinimo)} className="gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />Abaixo do mínimo
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Físico</TableHead>
                    <TableHead className="text-right">Reservado</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead className="text-right">Custo médio</TableHead>
                    <TableHead className="text-right">Valor total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSaldos ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : saldos.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum produto com saldo</TableCell></TableRow>
                  ) : saldos.map((s: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{s.produto_descricao}</p>
                          <p className="text-xs text-muted-foreground font-mono">{s.produto_codigo}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(s.total_fisico)} {s.unidade}</TableCell>
                      <TableCell className="text-right font-mono text-amber-600">{fmtQty(s.total_reservado)} {s.unidade}</TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={Number(s.total_disponivel) <= Number(s.estoque_minimo || 0) && Number(s.estoque_minimo || 0) > 0 ? "text-red-600 font-semibold" : ""}>
                          {fmtQty(s.total_disponivel)} {s.unidade}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">R$ {fmt(s.custo_medio)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">R$ {fmt(s.valor_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movimentos */}
        <TabsContent value="movimentos" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Depósito</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Saldo após</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMov ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : movimentos.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum movimento registrado</TableCell></TableRow>
                  ) : movimentos.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>{tipoMovBadge(m.tipo_movimento)}</TableCell>
                      <TableCell className="text-sm">{m.produto_descricao || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.deposito_nome || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span className={Number(m.quantidade) >= 0 ? "text-green-700" : "text-red-700"}>
                          {Number(m.quantidade) >= 0 ? "+" : ""}{fmtQty(m.quantidade)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtQty(m.saldo_posterior)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lotes */}
        <TabsContent value="lotes" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotes.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum lote cadastrado</TableCell></TableRow>
                  ) : lotes.map((l: any) => {
                    const venc = l.data_validade ? new Date(l.data_validade) : null;
                    const diasRestantes = venc ? Math.floor((venc.getTime() - Date.now()) / 86400000) : null;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{l.produto_descricao}</TableCell>
                        <TableCell className="font-mono text-sm">{l.numero_lote}</TableCell>
                        <TableCell className="text-sm">
                          {venc ? (
                            <span className={diasRestantes !== null && diasRestantes <= 30 ? "text-orange-600 font-medium" : ""}>
                              {venc.toLocaleDateString("pt-BR")}
                              {diasRestantes !== null && diasRestantes <= 30 && ` (${diasRestantes}d)`}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtQty(l.saldo_lote)}</TableCell>
                        <TableCell>
                          {l.status === "ativo" ? <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Ativo</Badge>
                            : l.status === "vencido" ? <Badge className="bg-red-100 text-red-800 text-xs">Vencido</Badge>
                            : <Badge variant="outline" className="text-xs">{l.status}</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Depósitos */}
        <TabsContent value="depositos" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Padrão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(depositos as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum depósito cadastrado</TableCell></TableRow>
                  ) : (depositos as any[]).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm">{d.codigo}</TableCell>
                      <TableCell className="font-medium text-sm">{d.nome}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{d.tipo}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.cidade ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{d.cidade}/{d.uf}</span> : "—"}
                      </TableCell>
                      <TableCell>
                        {d.padrao && <Badge className="bg-blue-100 text-blue-800 text-xs">Padrão</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Movimento */}
      <Dialog open={showMovDialog} onOpenChange={setShowMovDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {movTipo === "entrada" ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
              {movTipo === "entrada" ? "Registrar Entrada" : "Registrar Saída"} Manual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Depósito *</Label>
              <Select value={movForm.depositoId} onValueChange={v => setMovForm(f => ({ ...f, depositoId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar depósito..." /></SelectTrigger>
                <SelectContent>
                  {(depositos as any[]).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.nome} ({d.codigo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade *</Label>
              <Input type="number" step="0.001" min="0.001" value={movForm.quantidade}
                onChange={e => setMovForm(f => ({ ...f, quantidade: e.target.value }))}
                placeholder="0,000" />
            </div>
            {movTipo === "entrada" && (
              <div>
                <Label>Custo unitário (R$)</Label>
                <Input type="number" step="0.01" min="0" value={movForm.custoUnitario}
                  onChange={e => setMovForm(f => ({ ...f, custoUnitario: e.target.value }))}
                  placeholder="0,00" />
              </div>
            )}
            <div>
              <Label>Justificativa</Label>
              <Input value={movForm.justificativa}
                onChange={e => setMovForm(f => ({ ...f, justificativa: e.target.value }))}
                placeholder="Motivo do ajuste..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMovDialog(false)}>Cancelar</Button>
            <Button onClick={handleMovSubmit} disabled={movMutation.isPending}
              className={movTipo === "entrada" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}>
              {movMutation.isPending ? "Registrando..." : `Registrar ${movTipo === "entrada" ? "Entrada" : "Saída"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
