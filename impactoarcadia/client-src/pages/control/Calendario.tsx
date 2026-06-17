// Sprint C11 — G16 Calendário Visual de Pagamentos.
// Grade mensal 7×N com chips coloridos por dia (verde=receber, vermelho=pagar).
// Máx 3 chips visíveis por dia; "+N mais" abre popover.

import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Lanc { id: string; descricao: string; valor: string; tipo: "receber"|"pagar"; status: string; dataVencimento: string; dataPagamento?: string|null; favorecido?: string|null; }
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

export default function Calendario() {
  const [location] = useLocation();
  const clienteId = location.split('/').filter(Boolean)[1] ?? '';
  const { toast } = useToast();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [detalhe, setDetalhe] = useState<Lanc | null>(null);

  const ano = cursor.getFullYear();
  const mes = cursor.getMonth() + 1;
  const inicio = new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
  const fim = new Date(ano, mes, 0).toISOString().slice(0, 10);

  const q = useQuery<Lanc[] | { items: Lanc[] }>({
    queryKey: ["/api/control/clientes", clienteId, "lancamentos", { inicio, fim }],
    queryFn: async () => {
      const r = await fetch(`/api/control/clientes/${clienteId}/lancamentos?dataIni=${inicio}&dataFim=${fim}`, { credentials: "include" });
      if (!r.ok) throw new Error("Falha ao carregar lançamentos");
      return r.json();
    },
  });
  const items: Lanc[] = Array.isArray(q.data) ? q.data : (q.data?.items ?? []);

  const marcarPago = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/control/lancamentos/${id}/pagar`, { dataPagamento: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => {
      toast({ title: "Lançamento marcado como pago" });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "lancamentos"] });
      setDetalhe(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const porDia = useMemo(() => {
    const map = new Map<string, Lanc[]>();
    items.forEach((l) => {
      const key = (l.dataPagamento ?? l.dataVencimento).slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
    });
    return map;
  }, [items]);

  const dias = useMemo(() => {
    const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
    const totalDias = new Date(ano, mes, 0).getDate();
    const cells: { date: Date; outsideMonth: boolean }[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) {
      const d = new Date(ano, mes - 1, -primeiroDiaSemana + i + 1);
      cells.push({ date: d, outsideMonth: true });
    }
    for (let i = 1; i <= totalDias; i++) cells.push({ date: new Date(ano, mes - 1, i), outsideMonth: false });
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outsideMonth: true });
    }
    return cells;
  }, [ano, mes]);

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/control/${clienteId}`}>
          <Button variant="ghost" size="sm" data-testid="button-back"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        </Link>
        <h1 className="text-2xl font-bold flex-1" data-testid="text-page-title">Calendário de Vencimentos</h1>
        <Button variant="outline" size="sm" onClick={() => setCursor(new Date(ano, mes - 2, 1))} data-testid="button-prev-mes"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-medium px-2" data-testid="text-mes-atual">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
        <Button variant="outline" size="sm" onClick={() => setCursor(new Date(ano, mes, 1))} data-testid="button-next-mes"><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} data-testid="button-hoje">Hoje</Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground">
        {SEMANA.map((s) => <div key={s} className="text-center py-1">{s}</div>)}
      </div>

      {q.isLoading ? <Skeleton className="h-96" /> : (
        <div className="grid grid-cols-7 gap-1">
          {dias.map(({ date, outsideMonth }, i) => {
            const key = date.toISOString().slice(0, 10);
            const lancs = porDia.get(key) ?? [];
            const visiveis = lancs.slice(0, 3);
            const restantes = lancs.length - visiveis.length;
            const isHoje = key === hoje;
            return (
              <Card key={i} className={`min-h-[100px] p-2 ${outsideMonth ? "opacity-40" : ""} ${isHoje ? "ring-2 ring-primary" : ""}`} data-testid={`day-${key}`}>
                <div className="text-xs font-semibold mb-1">{date.getDate()}</div>
                <div className="space-y-1">
                  {visiveis.map((l) => (
                    <button key={l.id} onClick={() => setDetalhe(l)} className={`block w-full text-left text-[10px] truncate px-1 py-0.5 rounded ${l.tipo === "receber" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"} ${l.status === "pago" ? "border border-solid" : "border border-dotted"}`} data-testid={`chip-${l.id}`}>
                      {l.descricao}
                    </button>
                  ))}
                  {restantes > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-[10px] text-muted-foreground hover:underline" data-testid={`button-mais-${key}`}>+{restantes} mais</button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 max-h-80 overflow-y-auto">
                        <div className="space-y-1">
                          {lancs.map((l) => (
                            <button key={l.id} onClick={() => setDetalhe(l)} className="block w-full text-left p-2 hover:bg-accent rounded text-sm" data-testid={`popover-item-${l.id}`}>
                              <div className="font-medium truncate">{l.descricao}</div>
                              <div className="text-xs text-muted-foreground">{fmt(Number(l.valor))} · {l.tipo} · {l.status}</div>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{detalhe?.descricao}</DialogTitle></DialogHeader>
          {detalhe && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Tipo:</span> {detalhe.tipo}</div>
              <div><span className="text-muted-foreground">Valor:</span> <strong>{fmt(Number(detalhe.valor))}</strong></div>
              <div><span className="text-muted-foreground">Vencimento:</span> {detalhe.dataVencimento?.slice(0, 10)}</div>
              {detalhe.dataPagamento && <div><span className="text-muted-foreground">Pago em:</span> {detalhe.dataPagamento.slice(0, 10)}</div>}
              <div><span className="text-muted-foreground">Status:</span> {detalhe.status}</div>
              {detalhe.favorecido && <div><span className="text-muted-foreground">Favorecido:</span> {detalhe.favorecido}</div>}
              {detalhe.status !== "pago" && (
                <Button onClick={() => marcarPago.mutate(detalhe.id)} disabled={marcarPago.isPending} data-testid="button-marcar-pago"><CheckCircle2 className="h-4 w-4 mr-1" /> Marcar como pago</Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
