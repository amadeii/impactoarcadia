import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, BarChart3, Building2 } from "lucide-react";

interface Grupo { id: string; nome: string; descricao: string | null; matrizClienteId: string | null; ativo: boolean; }
interface Membro { id: string; clienteId: string; clienteNome: string | null; cnpj: string | null; papel: string; participacao: string; }
interface Cliente { id: string; nome?: string; name?: string; }

const formatBRL = (v: number | string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

export default function GruposTab({ clienteId }: { clienteId: string }) {
  const { toast } = useToast();
  const [openNovo, setOpenNovo] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [grupoSel, setGrupoSel] = useState<string | null>(null);
  const [openMembro, setOpenMembro] = useState(false);
  const [membroCliente, setMembroCliente] = useState("");
  const [membroPapel, setMembroPapel] = useState("filial");
  const [openRateio, setOpenRateio] = useState(false);
  const [rateioValor, setRateioValor] = useState("");
  const [rateioResult, setRateioResult] = useState<any>(null);

  const { data: grupos = [], isLoading } = useQuery<Grupo[]>({ queryKey: ["/api/control/grupos"] });
  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/control/grupos", grupoSel, "membros"],
    enabled: !!grupoSel,
  });
  const { data: dre } = useQuery<any>({
    queryKey: ["/api/control/grupos", grupoSel, "dre"],
    enabled: !!grupoSel,
  });
  const { data: clientes = [] } = useQuery<Cliente[]>({ queryKey: ["/api/control/clientes"] });

  const criar = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/control/grupos", { nome: novoNome, ativo: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/grupos"] });
      setOpenNovo(false); setNovoNome("");
      toast({ title: "Grupo criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/control/grupos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/control/grupos"] }),
  });

  const addMembro = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/control/grupos/${grupoSel}/membros`, {
      clienteId: membroCliente, papel: membroPapel, participacao: "100",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/grupos", grupoSel, "membros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control/grupos", grupoSel, "dre"] });
      setOpenMembro(false); setMembroCliente("");
      toast({ title: "Membro adicionado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const removerMembro = useMutation({
    mutationFn: async (mid: string) => apiRequest("DELETE", `/api/control/grupos/${grupoSel}/membros/${mid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/grupos", grupoSel, "membros"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control/grupos", grupoSel, "dre"] });
    },
  });

  const calcRateio = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/control/grupos/${grupoSel}/rateio`, { valor: Number(rateioValor) });
      return await r.json();
    },
    onSuccess: (data) => setRateioResult(data),
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Grupos Empresariais</CardTitle>
          <Dialog open={openNovo} onOpenChange={setOpenNovo}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-novo-grupo"><Plus className="h-4 w-4 mr-1" />Novo Grupo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Grupo Empresarial</DialogTitle></DialogHeader>
              <Input placeholder="Nome do grupo" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} data-testid="input-grupo-nome" />
              <DialogFooter>
                <Button onClick={() => criar.mutate()} disabled={!novoNome || criar.isPending} data-testid="button-criar-grupo">Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {grupos.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nenhum grupo criado</TableCell></TableRow>
                ) : grupos.map((g) => (
                  <TableRow key={g.id} data-testid={`row-grupo-${g.id}`}>
                    <TableCell>{g.nome}</TableCell>
                    <TableCell><Badge variant={g.ativo ? "default" : "outline"}>{g.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => setGrupoSel(g.id)} data-testid={`button-ver-${g.id}`}>Ver</Button>
                      <Button size="sm" variant="ghost" onClick={() => remover.mutate(g.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {grupoSel && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Membros do grupo</CardTitle>
            <div className="flex gap-2">
              <Dialog open={openRateio} onOpenChange={(o) => { setOpenRateio(o); if (!o) setRateioResult(null); }}>
                <DialogTrigger asChild><Button size="sm" variant="outline" data-testid="button-rateio"><BarChart3 className="h-4 w-4 mr-1" />Rateio</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Calcular Rateio</DialogTitle></DialogHeader>
                  <Input type="number" placeholder="Valor a ratear" value={rateioValor} onChange={(e) => setRateioValor(e.target.value)} data-testid="input-rateio-valor" />
                  <Button onClick={() => calcRateio.mutate()} disabled={!rateioValor || calcRateio.isPending} data-testid="button-calcular-rateio">Calcular</Button>
                  {rateioResult && (
                    <div className="space-y-1 text-sm border rounded p-3 mt-2">
                      {rateioResult.rateios.map((r: any) => (
                        <div key={r.clienteId} className="flex justify-between" data-testid={`text-rateio-${r.clienteId}`}>
                          <span>{r.clienteId.slice(0, 8)}…</span>
                          <span>{r.percentual}% — {formatBRL(r.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <Dialog open={openMembro} onOpenChange={setOpenMembro}>
                <DialogTrigger asChild><Button size="sm" data-testid="button-add-membro"><Plus className="h-4 w-4 mr-1" />Adicionar</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Adicionar Membro</DialogTitle></DialogHeader>
                  <Select value={membroCliente} onValueChange={setMembroCliente}>
                    <SelectTrigger data-testid="select-cliente"><SelectValue placeholder="Cliente" /></SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome ?? c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={membroPapel} onValueChange={setMembroPapel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="matriz">Matriz</SelectItem>
                      <SelectItem value="filial">Filial</SelectItem>
                      <SelectItem value="controlada">Controlada</SelectItem>
                      <SelectItem value="coligada">Coligada</SelectItem>
                    </SelectContent>
                  </Select>
                  <DialogFooter><Button onClick={() => addMembro.mutate()} disabled={!membroCliente || addMembro.isPending} data-testid="button-confirmar-membro">Adicionar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Papel</TableHead><TableHead>Participação</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {membros.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.clienteNome ?? m.clienteId.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline">{m.papel}</Badge></TableCell>
                    <TableCell>{m.participacao}%</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => removerMembro.mutate(m.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {membros.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem membros</TableCell></TableRow>}
              </TableBody>
            </Table>
            {dre && (
              <Card>
                <CardHeader><CardTitle className="text-sm">DRE Consolidada do grupo (mês corrente)</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Receitas</span><span data-testid="text-dre-receitas">{formatBRL(dre.totais?.receitas ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Custos</span><span data-testid="text-dre-custos">{formatBRL(dre.totais?.custos ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Despesas</span><span data-testid="text-dre-despesas">{formatBRL(dre.totais?.despesas ?? 0)}</span></div>
                  <div className="flex justify-between font-semibold border-t pt-1"><span>Resultado</span><span data-testid="text-dre-resultado">{formatBRL(dre.totais?.resultado ?? 0)}</span></div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
