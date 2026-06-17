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
import { Plus, Plug, Trash2, Activity, RefreshCw, Search } from "lucide-react";

interface ConectorTipo {
  tipo: string; nome: string; categoria: string; descricao: string;
  campos: Array<{ key: string; label: string; type: string; required?: boolean; placeholder?: string }>;
  pronto: boolean;
}
interface Conector {
  id: string; nome: string; tipoConector: string; categoria: string; status: string;
  ativo: boolean; ultimaSincronizacao: string | null; clienteId: string | null;
}

export default function ConectoresTab({ clienteId }: { clienteId: string }) {
  const { toast } = useToast();
  const [openNovo, setOpenNovo] = useState(false);
  const [tipoSel, setTipoSel] = useState("");
  const [nomeNovo, setNomeNovo] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [logsAbertosId, setLogsAbertosId] = useState<string | null>(null);
  const [cnpjLookup, setCnpjLookup] = useState("");
  const [cnpjResult, setCnpjResult] = useState<any>(null);

  const { data: tipos = [] } = useQuery<ConectorTipo[]>({ queryKey: ["/api/control/conectores/tipos"] });
  const { data: conectores = [], isLoading } = useQuery<Conector[]>({
    queryKey: ["/api/control/conectores", { clienteId }],
    queryFn: async () => {
      const r = await fetch(`/api/control/conectores?clienteId=${clienteId}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!clienteId,
  });
  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ["/api/control/conectores", logsAbertosId, "logs"],
    enabled: !!logsAbertosId,
  });

  const tipoSelInfo = tipos.find((t) => t.tipo === tipoSel);

  const criar = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/control/conectores", {
      nome: nomeNovo, tipoConector: tipoSel, categoria: tipoSelInfo?.categoria ?? "publico",
      clienteId, ativo: true, status: "ativo", creds,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/conectores", { clienteId }] });
      setOpenNovo(false); setTipoSel(""); setNomeNovo(""); setCreds({});
      toast({ title: "Conector criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/control/conectores/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/control/conectores", { clienteId }] }),
  });

  const testar = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/control/conectores/${id}/test`);
      return await r.json();
    },
    onSuccess: (data: any) => toast({ title: data.ok ? "Conexão OK" : "Falha na conexão", description: data.message }),
  });

  const sync = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/control/conectores/${id}/sync`, {});
      return await r.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.ok ? "Sync iniciado" : "Erro", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/control/conectores", { clienteId }] });
    },
  });

  const buscarCnpj = async () => {
    try {
      const r = await fetch(`/api/control/brasil-api/cnpj/${cnpjLookup.replace(/\D/g, "")}`, { credentials: "include" });
      if (!r.ok) throw new Error("CNPJ não encontrado");
      setCnpjResult(await r.json());
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Plug className="h-5 w-5" />Conectores</CardTitle>
          <Dialog open={openNovo} onOpenChange={setOpenNovo}>
            <DialogTrigger asChild><Button size="sm" data-testid="button-novo-conector"><Plus className="h-4 w-4 mr-1" />Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Conector</DialogTitle></DialogHeader>
              <Select value={tipoSel} onValueChange={setTipoSel}>
                <SelectTrigger data-testid="select-tipo-conector"><SelectValue placeholder="Tipo de conector" /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.tipo} value={t.tipo}>
                      {t.nome} {!t.pronto && <span className="text-xs text-muted-foreground">— precisa credenciais</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Nome do conector" value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} data-testid="input-nome-conector" />
              {tipoSelInfo?.descricao && <p className="text-xs text-muted-foreground">{tipoSelInfo.descricao}</p>}
              {(tipoSelInfo?.campos ?? []).map((f) => (
                <Input key={f.key}
                  type={f.type === "password" ? "password" : "text"}
                  placeholder={f.label + (f.required ? " *" : "")}
                  value={creds[f.key] ?? ""}
                  onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })}
                  data-testid={`input-cred-${f.key}`}
                />
              ))}
              <DialogFooter>
                <Button onClick={() => criar.mutate()} disabled={!tipoSel || !nomeNovo || criar.isPending} data-testid="button-criar-conector">Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Última sync</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {conectores.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum conector</TableCell></TableRow>
                ) : conectores.map((c) => (
                  <TableRow key={c.id} data-testid={`row-conector-${c.id}`}>
                    <TableCell>{c.nome}</TableCell>
                    <TableCell><Badge variant="outline">{c.tipoConector}</Badge></TableCell>
                    <TableCell><Badge>{c.status}</Badge></TableCell>
                    <TableCell className="text-xs">{c.ultimaSincronizacao ? new Date(c.ultimaSincronizacao).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => testar.mutate(c.id)} title="Testar"><Activity className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => sync.mutate(c.id)} title="Sync"><RefreshCw className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setLogsAbertosId(c.id)}>Logs</Button>
                      <Button size="sm" variant="ghost" onClick={() => deletar.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {logsAbertosId && (
            <div className="mt-4 border rounded p-3 text-sm space-y-2">
              <div className="flex justify-between items-center">
                <strong>Logs de sincronização</strong>
                <Button size="sm" variant="ghost" onClick={() => setLogsAbertosId(null)}>×</Button>
              </div>
              {logs.length === 0 ? <div className="text-muted-foreground text-xs">Sem logs</div> : logs.map((l: any) => (
                <div key={l.id} className="flex justify-between text-xs border-b pb-1">
                  <span>{new Date(l.iniciadoEm).toLocaleString("pt-BR")}</span>
                  <Badge variant={l.status === "sucesso" ? "default" : "destructive"}>{l.status}</Badge>
                  <span>{l.itensProcessados ?? 0} itens</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-4 w-4" />BrasilAPI — Consulta CNPJ</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="00.000.000/0001-00" value={cnpjLookup} onChange={(e) => setCnpjLookup(e.target.value)} data-testid="input-cnpj-lookup" />
            <Button onClick={buscarCnpj} data-testid="button-cnpj-lookup">Consultar</Button>
          </div>
          {cnpjResult && (
            <div className="border rounded p-3 text-sm space-y-1" data-testid="cnpj-result">
              <div><strong>{cnpjResult.razao_social}</strong></div>
              <div className="text-xs text-muted-foreground">{cnpjResult.nome_fantasia}</div>
              <div className="text-xs">CNAE: {cnpjResult.cnae_fiscal} — {cnpjResult.cnae_fiscal_descricao}</div>
              <div className="text-xs">{cnpjResult.logradouro}, {cnpjResult.numero} — {cnpjResult.municipio}/{cnpjResult.uf}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
