import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Upload, CheckCircle, XCircle, AlertTriangle,
  FileText, Eye, Stamp, Truck, Package2,
  AlertOctagon, RefreshCw
} from "lucide-react";

const api = {
  get: async (url: string) => { const r = await fetch(url, { credentials: "include" }); if (!r.ok) throw new Error("Request failed"); return r.json(); },
  post: async (url: string, data: any) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" }); if (!r.ok) throw new Error("Request failed"); return r.json(); },
};

function fmt(v: any) { return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }); }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    importado:       { label: "Importado",  cls: "bg-gray-100 text-gray-700 border-gray-200" },
    validando:       { label: "Validando",  cls: "bg-blue-100 text-blue-700 border-blue-200" },
    com_divergencia: { label: "Divergência",cls: "bg-amber-100 text-amber-700 border-amber-200" },
    aprovado:        { label: "Aprovado",   cls: "bg-green-100 text-green-700 border-green-200" },
    recusado:        { label: "Recusado",   cls: "bg-red-100 text-red-700 border-red-200" },
    estornado:       { label: "Estornado",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
  };
  const m = map[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
  return <Badge className={`text-xs ${m.cls}`}>{m.label}</Badge>;
}

function ManifBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente: "text-amber-600",
    ciencia: "text-blue-600",
    confirmacao: "text-green-600",
    desconhecimento: "text-red-600",
    nao_realizado: "text-slate-500",
  };
  return <span className={`text-xs font-medium ${map[status] || ""}`}>{status}</span>;
}

export function ComprasTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subtab, setSubtab] = useState("entradas");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRecusarDialog, setShowRecusarDialog] = useState(false);
  const [xmlInput, setXmlInput] = useState("");
  const [selectedEntrada, setSelectedEntrada] = useState<any>(null);
  const [motivoRecusa, setMotivoRecusa] = useState("");

  const { data: dashboard } = useQuery<any>({
    queryKey: ["/api/comp/dashboard"],
    queryFn: () => api.get("/api/comp/dashboard"),
    refetchInterval: 30000,
  });

  const { data: entradasData, isLoading } = useQuery<any>({
    queryKey: ["/api/comp/entradas", filterStatus],
    queryFn: () => api.get(`/api/comp/entradas?status=${filterStatus}&limit=100`),
    enabled: subtab === "entradas",
  });

  const { data: detalhe } = useQuery<any>({
    queryKey: ["/api/comp/entradas", selectedEntrada?.id],
    queryFn: () => api.get(`/api/comp/entradas/${selectedEntrada?.id}`),
    enabled: !!selectedEntrada?.id && showDetailDialog,
  });

  const importarMutation = useMutation({
    mutationFn: (xml: string) => api.post("/api/comp/entradas/importar-xml", { xml }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/comp/entradas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/comp/dashboard"] });
      setShowImportDialog(false);
      setXmlInput("");
      if (data.ok) toast({ title: `NF-e importada — Chave: ...${data.data?.chave?.slice(-8)}` });
    },
    onError: (e: any) => toast({ title: "Erro ao importar", description: e.message, variant: "destructive" }),
  });

  const validarMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/comp/entradas/${id}/validar`, {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/comp/entradas"] });
      const r = data.data;
      if (r?.podeAprovar) {
        toast({ title: "Validação OK — NF-e pode ser aprovada." });
      } else {
        toast({ title: `Validação: ${r?.resultado?.resumo?.erros || 0} erro(s)`, variant: "destructive" });
      }
    },
  });

  const aprovarMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/comp/entradas/${id}/aprovar`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comp/entradas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/comp/dashboard"] });
      setShowDetailDialog(false);
      toast({ title: "NF-e aprovada — estoque atualizado e AP gerado." });
    },
    onError: (e: any) => toast({ title: "Erro ao aprovar", description: e.message, variant: "destructive" }),
  });

  const recusarMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      api.post(`/api/comp/entradas/${id}/recusar`, { motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comp/entradas"] });
      setShowRecusarDialog(false);
      setShowDetailDialog(false);
      setMotivoRecusa("");
      toast({ title: "NF-e recusada." });
    },
  });

  const manifestarMutation = useMutation({
    mutationFn: ({ id, tipo }: { id: string; tipo: string }) =>
      api.post(`/api/comp/entradas/${id}/manifestar`, { tipo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comp/entradas"] });
      toast({ title: "Manifestação registrada." });
    },
    onError: (e: any) => toast({ title: "Erro na manifestação", description: e.message, variant: "destructive" }),
  });

  const entradas = entradasData?.data || [];
  const resumo = dashboard?.data?.resumo || {};
  const alertas = dashboard?.data?.alertas || {};

  const openDetail = (e: any) => { setSelectedEntrada(e); setShowDetailDialog(true); };

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-lg"><Truck className="w-5 h-5 text-slate-600" /></div>
            <div><p className="text-xs text-muted-foreground">Total entradas</p><p className="text-2xl font-bold">{resumo.total_entradas || 0}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-xs text-muted-foreground">Com divergência</p><p className="text-2xl font-bold text-amber-700">{resumo.com_divergencia || 0}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Aprovadas no mês</p><p className="text-2xl font-bold text-green-700">R$ {fmt(resumo.volume_compras_mes)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><AlertOctagon className="w-5 h-5 text-red-600" /></div>
            <div><p className="text-xs text-muted-foreground">Manifest. urgente</p><p className="text-2xl font-bold text-red-700">{resumo.manifestacao_urgente || 0}</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Alertas de manifestação */}
      {(alertas.manifestacao_pendente || []).slice(0, 2).map((a: any, i: number) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm">
          <AlertOctagon className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="font-medium text-red-900">{a.fornecedor_nome}</span>
          <span className="text-red-700">NF-e sem manifestação há {a.dias_sem_manifestacao} dias</span>
          <Button size="sm" variant="outline" className="ml-auto text-xs border-red-300"
            onClick={() => manifestarMutation.mutate({ id: a.id, tipo: "ciencia" })}>
            Dar ciência
          </Button>
        </div>
      ))}

      {/* Sub-abas */}
      <Tabs value={subtab} onValueChange={setSubtab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="entradas" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Entradas</TabsTrigger>
            <TabsTrigger value="itens_sem_produto" className="gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Itens pendentes
              {alertas.itens_sem_produto > 0 && (
                <Badge className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0">{alertas.itens_sem_produto}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={() => setShowImportDialog(true)} className="gap-1.5">
            <Upload className="w-4 h-4" />Importar XML
          </Button>
        </div>

        <TabsContent value="entradas" className="mt-3 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-10" placeholder="Buscar por fornecedor ou chave..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {["", "importado", "com_divergencia", "aprovado"].map(s => (
                <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"}
                  onClick={() => setFilterStatus(s)} className="text-xs">
                  {s === "" ? "Todos" : s === "importado" ? "Importados" : s === "com_divergencia" ? "Divergência" : "Aprovados"}
                </Button>
              ))}
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>NF-e</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Manifest.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : entradas.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma NF-e de entrada registrada</TableCell></TableRow>
                  ) : entradas.map((e: any) => (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openDetail(e)}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{e.fornecedor_nome_pessoa || e.fornecedor_nome}</p>
                          <p className="text-xs text-muted-foreground font-mono">{e.fornecedor_cnpj}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{e.numero_nfe}/{e.serie_nfe}</TableCell>
                      <TableCell className="text-sm">{e.data_emissao ? new Date(e.data_emissao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-sm">R$ {fmt(e.valor_total)}</TableCell>
                      <TableCell><StatusBadge status={e.status} /></TableCell>
                      <TableCell><ManifBadge status={e.manifestacao_status} /></TableCell>
                      <TableCell className="text-right" onClick={ev => ev.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {["importado", "validando", "com_divergencia"].includes(e.status) && (
                            <Button size="sm" variant="outline" className="text-xs h-7"
                              onClick={() => validarMutation.mutate(e.id)}
                              disabled={validarMutation.isPending}>
                              <RefreshCw className="w-3 h-3 mr-1" />Validar
                            </Button>
                          )}
                          {e.status === "validando" && (
                            <Button size="sm" className="text-xs h-7 bg-green-600 hover:bg-green-700"
                              onClick={() => aprovarMutation.mutate(e.id)}
                              disabled={aprovarMutation.isPending}>
                              <CheckCircle className="w-3 h-3 mr-1" />Aprovar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openDetail(e)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="itens_sem_produto" className="mt-3">
          <div className="px-4 py-6 text-center text-muted-foreground">
            <Package2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Itens de NF-e sem produto vinculado aparecem aqui.</p>
            <p className="text-xs mt-1">Use <strong>GET /api/comp/dashboard</strong> para ver o total pendente.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Import XML */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar NF-e por XML</DialogTitle>
            <DialogDescription>Cole o conteúdo do arquivo XML da NF-e abaixo.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={xmlInput}
            onChange={e => setXmlInput(e.target.value)}
            placeholder="<?xml version='1.0' encoding='UTF-8'?>..."
            className="font-mono text-xs h-64 resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancelar</Button>
            <Button onClick={() => importarMutation.mutate(xmlInput)} disabled={importarMutation.isPending || !xmlInput.trim()}>
              {importarMutation.isPending ? "Importando..." : "Importar NF-e"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhe */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>NF-e {detalhe?.data?.numero_nfe}/{detalhe?.data?.serie_nfe}</DialogTitle>
          </DialogHeader>
          {detalhe?.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><Label className="text-xs text-muted-foreground">Fornecedor</Label><p className="font-medium">{detalhe.data.fornecedor_nome_pessoa || detalhe.data.fornecedor_nome}</p></div>
                <div><Label className="text-xs text-muted-foreground">CNPJ</Label><p className="font-mono">{detalhe.data.fornecedor_cnpj}</p></div>
                <div><Label className="text-xs text-muted-foreground">Valor total</Label><p className="font-bold text-lg">R$ {fmt(detalhe.data.valor_total)}</p></div>
                <div><Label className="text-xs text-muted-foreground">Status</Label><div className="mt-1"><StatusBadge status={detalhe.data.status} /></div></div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Itens da NF-e</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>NCM</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Vl Unit</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Produto vinculado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detalhe.data.itens || []).map((i: any) => (
                      <TableRow key={i.id}>
                        <TableCell className="text-xs">{i.descricao_xml}</TableCell>
                        <TableCell className="font-mono text-xs">{i.ncm}</TableCell>
                        <TableCell className="text-right text-xs">{Number(i.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</TableCell>
                        <TableCell className="text-right text-xs">R$ {fmt(i.valor_unitario)}</TableCell>
                        <TableCell className="text-right text-xs font-medium">R$ {fmt(i.sub_total)}</TableCell>
                        <TableCell className="text-xs">
                          {i.produto_codigo_cadastro
                            ? <span className="text-green-700">{i.produto_descricao_cadastro}</span>
                            : <Badge className="bg-amber-100 text-amber-700 text-xs">Não vinculado</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {detalhe?.data?.status === "validando" && (
              <>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setShowRecusarDialog(true)}>
                  <XCircle className="w-4 h-4 mr-1" />Recusar
                </Button>
                <Button className="bg-green-600 hover:bg-green-700"
                  onClick={() => aprovarMutation.mutate(selectedEntrada?.id)}
                  disabled={aprovarMutation.isPending}>
                  <CheckCircle className="w-4 h-4 mr-1" />{aprovarMutation.isPending ? "Aprovando..." : "Aprovar entrada"}
                </Button>
              </>
            )}
            {detalhe?.data?.manifestacao_status === "pendente" && (
              <Button variant="outline" className="gap-1.5"
                onClick={() => manifestarMutation.mutate({ id: selectedEntrada?.id, tipo: "ciencia" })}>
                <Stamp className="w-4 h-4" />Dar ciência
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Recusar */}
      <Dialog open={showRecusarDialog} onOpenChange={setShowRecusarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar NF-e</DialogTitle>
            <DialogDescription>Informe o motivo da recusa para registro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivo *</Label>
            <Textarea value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)}
              placeholder="Descreva o motivo..." className="resize-none" rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecusarDialog(false)}>Cancelar</Button>
            <Button variant="destructive"
              onClick={() => recusarMutation.mutate({ id: selectedEntrada?.id, motivo: motivoRecusa })}
              disabled={recusarMutation.isPending || !motivoRecusa.trim()}>
              {recusarMutation.isPending ? "Recusando..." : "Confirmar recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
