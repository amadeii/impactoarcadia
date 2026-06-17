import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Lock, Unlock, PlayCircle, CheckSquare } from "lucide-react";

const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function FechamentoTab({ clienteId }: { clienteId: string }) {
  const { toast } = useToast();
  const hoje = new Date();
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [mes, setMes] = useState(String(hoje.getMonth() + 1));

  const queryKey = ["/api/control/clientes", clienteId, "fechamentos", ano, mes];
  const { data: f, isLoading } = useQuery<any>({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/control/clientes/${clienteId}/fechamentos/${ano}/${mes}`, { credentials: "include" });
      if (r.status === 404) return null;
      return r.json();
    },
    enabled: !!clienteId,
  });

  const iniciar = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/control/clientes/${clienteId}/fechamentos`, { ano: Number(ano), mes: Number(mes) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast({ title: "Fechamento iniciado" }); },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const toggleItem = useMutation({
    mutationFn: async (vars: { itemId: string; done: boolean }) =>
      apiRequest("PATCH", `/api/control/fechamentos/${f.id}/checklist`, vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const concluir = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/control/fechamentos/${f.id}/concluir`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast({ title: "Fechamento concluído — período bloqueado" }); },
    onError: (e: any) => toast({ title: "Não foi possível concluir", description: e?.message, variant: "destructive" }),
  });

  const reabrir = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/control/fechamentos/${f.id}/reabrir`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast({ title: "Período reaberto" }); },
  });

  const checklist = (f?.checklist ?? []) as Array<{ id: string; label: string; done: boolean }>;
  const completos = checklist.filter((i) => i.done).length;
  const isConcluido = f?.status === "concluido";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5" />Fechamento Contábil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-40" data-testid="select-mes"><SelectValue /></SelectTrigger>
            <SelectContent>
              {meses.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-28" data-testid="select-ano"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {isLoading ? <Skeleton className="h-8 w-20" /> : !f ? (
            <Button onClick={() => iniciar.mutate()} disabled={iniciar.isPending} data-testid="button-iniciar">
              <PlayCircle className="h-4 w-4 mr-1" />Iniciar Fechamento
            </Button>
          ) : (
            <Badge data-testid="badge-status" variant={isConcluido ? "default" : "outline"}>
              {isConcluido ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
              {f.status}
            </Badge>
          )}
        </div>

        {f && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Progresso: {completos}/{checklist.length} itens
            </div>
            <div className="space-y-2">
              {checklist.map((item) => (
                <label key={item.id} className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50">
                  <Checkbox
                    checked={item.done}
                    disabled={isConcluido}
                    onCheckedChange={(v) => toggleItem.mutate({ itemId: item.id, done: !!v })}
                    data-testid={`check-${item.id}`}
                  />
                  <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              {!isConcluido ? (
                <Button onClick={() => concluir.mutate()} disabled={concluir.isPending || completos < checklist.length} data-testid="button-concluir">
                  <Lock className="h-4 w-4 mr-1" />Concluir e Bloquear
                </Button>
              ) : (
                <Button variant="outline" onClick={() => reabrir.mutate()} disabled={reabrir.isPending} data-testid="button-reabrir">
                  <Unlock className="h-4 w-4 mr-1" />Reabrir período
                </Button>
              )}
            </div>
            {isConcluido && f.observacoes && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Snapshot DRE</CardTitle></CardHeader>
                <CardContent className="text-xs">
                  <pre className="overflow-auto" data-testid="snapshot-dre">{(() => {
                    try { return JSON.stringify(JSON.parse(f.observacoes), null, 2); }
                    catch { return f.observacoes; }
                  })()}</pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
