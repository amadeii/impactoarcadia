import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { FileText, RefreshCw } from "lucide-react";

interface Nfe {
  id: string; chaveNfe: string; numeroNfe: string | null; serieNfe: string | null;
  dataEmissao: string | null; valorTotal: string; fornecedorCnpj: string | null;
  fornecedorNome: string | null; statusManifestacao: string | null;
  categorizacaoIa: any;
}

const formatBRL = (v: string | number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

const corStatus: Record<string, string> = {
  ciencia: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  confirmacao: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  desconhecimento: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  nao_realizada: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
};

export default function NfeMonitorTab({ clienteId }: { clienteId: string }) {
  const { toast } = useToast();
  const [filtro, setFiltro] = useState<string>("");

  const queryKey = ["/api/control/clientes", clienteId, "nfes", filtro];
  const { data: nfes = [], isLoading } = useQuery<Nfe[]>({
    queryKey,
    queryFn: async () => {
      const url = filtro ? `/api/control/clientes/${clienteId}/nfes?status=${filtro}` : `/api/control/clientes/${clienteId}/nfes`;
      const r = await fetch(url, { credentials: "include" });
      return r.json();
    },
    enabled: !!clienteId,
  });

  const pollNow = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/control/nfe-monitor/poll-now", { clienteId });
      return await r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: `${data.nfesNovas} novas NF-e`, description: `${data.tenants} tenants polados` });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const manifestar = useMutation({
    mutationFn: async (vars: { id: string; status: string }) =>
      apiRequest("POST", `/api/control/nfes/${vars.id}/manifestar`, { status: vars.status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast({ title: "Manifestação registrada" }); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Monitor NF-e (Distribuição DFe)</CardTitle>
        <div className="flex gap-2">
          <Select value={filtro || "todos"} onValueChange={(v) => setFiltro(v === "todos" ? "" : v)}>
            <SelectTrigger className="w-44" data-testid="select-filtro-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ciencia">Ciência</SelectItem>
              <SelectItem value="confirmacao">Confirmada</SelectItem>
              <SelectItem value="desconhecimento">Desconhecimento</SelectItem>
              <SelectItem value="nao_realizada">Não realizada</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => pollNow.mutate()} disabled={pollNow.isPending} data-testid="button-poll-now">
            <RefreshCw className="h-4 w-4 mr-1" />Buscar agora
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-32" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emissão</TableHead>
                <TableHead>Nº</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Categoria IA</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nfes.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma NF-e recebida</TableCell></TableRow>
              ) : nfes.map((n) => (
                <TableRow key={n.id} data-testid={`row-nfe-${n.id}`}>
                  <TableCell className="text-xs">{n.dataEmissao ? new Date(n.dataEmissao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>{n.numeroNfe ?? "—"}/{n.serieNfe ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    <div className="text-sm">{n.fornecedorNome ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{n.fornecedorCnpj}</div>
                  </TableCell>
                  <TableCell>{formatBRL(n.valorTotal)}</TableCell>
                  <TableCell>
                    <Badge className={corStatus[n.statusManifestacao ?? ""] ?? ""} data-testid={`badge-status-${n.id}`}>
                      {n.statusManifestacao ?? "pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px]">
                    {n.categorizacaoIa?.categoriaSugerida ?? "—"}
                    {n.categorizacaoIa?.confianca && (
                      <div className="text-muted-foreground">{Math.round(n.categorizacaoIa.confianca * 100)}% conf.</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Select onValueChange={(s) => manifestar.mutate({ id: n.id, status: s })}>
                      <SelectTrigger className="w-36 h-8" data-testid={`select-manifestar-${n.id}`}><SelectValue placeholder="Manifestar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmacao">Confirmar</SelectItem>
                        <SelectItem value="desconhecimento">Desconhecimento</SelectItem>
                        <SelectItem value="nao_realizada">Não realizada</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
