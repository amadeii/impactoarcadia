// Sprint C6 — Dialog reutilizável de rateio de lançamento financeiro entre múltiplos CCs.
// Validação ao vivo da soma dos percentuais.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, AlertCircle, CheckCircle2, Calculator } from "lucide-react";

interface CentroCusto { id: string; codigo: string; nome: string; ativo: boolean; }
interface RateioRow {
  id: string;
  centroCustoId: string;
  centroCustoCodigo: string;
  centroCustoNome: string;
  percentual: string;
  valorRateado: string | null;
}
interface Linha { centroCustoId: string; percentual: number; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lancamentoId: string;
  clienteId: string;
  valorTotal: number;
}

const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function RateioCcDialog({ open, onOpenChange, lancamentoId, clienteId, valorTotal }: Props) {
  const { toast } = useToast();
  const [linhas, setLinhas] = useState<Linha[]>([]);

  const { data: ccs = [] } = useQuery<CentroCusto[]>({
    queryKey: ["/api/control/clientes", clienteId, "centros-custo"],
    enabled: open && !!clienteId,
  });
  const ccsAtivos = useMemo(() => ccs.filter((c) => c.ativo), [ccs]);

  const { data: rateiosExistentes = [], isLoading } = useQuery<RateioRow[]>({
    queryKey: ["/api/control/lancamentos", lancamentoId, "rateios"],
    enabled: open && !!lancamentoId,
  });

  // Hidrata linhas ao abrir — depende de open + isLoading apenas.
  // NÃO incluir rateiosExistentes como dep: o default `= []` cria nova
  // referência a cada render antes da query resolver, gerando loop infinito.
  useEffect(() => {
    if (!open || isLoading) return;
    setLinhas(
      rateiosExistentes.length > 0
        ? rateiosExistentes.map((r) => ({
            centroCustoId: r.centroCustoId,
            percentual: Number(r.percentual),
          }))
        : []
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isLoading]);

  const soma = useMemo(() => linhas.reduce((s, l) => s + (Number(l.percentual) || 0), 0), [linhas]);
  const restante = 100 - soma;
  const valido = Math.abs(soma - 100) <= 0.01 && linhas.length > 0;
  const semCcDuplicado = new Set(linhas.map((l) => l.centroCustoId)).size === linhas.length;

  function addLinha() {
    setLinhas([...linhas, { centroCustoId: "", percentual: Math.max(0, +restante.toFixed(2)) }]);
  }
  function removeLinha(idx: number) {
    setLinhas(linhas.filter((_, i) => i !== idx));
  }
  function updLinha(idx: number, patch: Partial<Linha>) {
    setLinhas(linhas.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }
  function distribuirIgualmente() {
    if (linhas.length === 0) return;
    const p = +(100 / linhas.length).toFixed(2);
    const novas = linhas.map((l) => ({ ...l, percentual: p }));
    // Ajusta o último para garantir 100 exato
    const dif = +(100 - novas.reduce((s, l) => s + l.percentual, 0)).toFixed(2);
    novas[novas.length - 1].percentual = +(novas[novas.length - 1].percentual + dif).toFixed(2);
    setLinhas(novas);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const items = linhas
        .filter((l) => l.centroCustoId && l.percentual > 0)
        .map((l) => ({ centroCustoId: l.centroCustoId, percentual: Number(l.percentual) }));
      return await apiRequest("PUT", `/api/control/lancamentos/${lancamentoId}/rateios`, { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/lancamentos", lancamentoId, "rateios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"] });
      toast({ title: "Rateio salvo" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Falha ao salvar rateio", description: e?.message, variant: "destructive" }),
  });

  const limparMutation = useMutation({
    mutationFn: async () => await apiRequest("PUT", `/api/control/lancamentos/${lancamentoId}/rateios`, { items: [] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/lancamentos", lancamentoId, "rateios"] });
      toast({ title: "Rateio removido" });
      setLinhas([]);
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rateio entre Centros de Custo</DialogTitle>
          <DialogDescription>
            Distribua <strong>{formatBRL(valorTotal)}</strong> entre múltiplos CCs. Soma deve ser 100%.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Linhas</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={distribuirIgualmente} disabled={linhas.length === 0} data-testid="button-distribuir-igualmente">
                <Calculator className="h-4 w-4 mr-1" /> Distribuir igualmente
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={addLinha} data-testid="button-add-linha-rateio">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Carregando rateios…</div>
          ) : linhas.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded">
              Nenhum rateio. O lançamento usará o CC direto.
            </div>
          ) : (
            <div className="space-y-2">
              {linhas.map((l, idx) => {
                const valorLinha = (valorTotal * (Number(l.percentual) || 0)) / 100;
                return (
                  <div key={idx} className="grid grid-cols-[1fr_120px_140px_40px] gap-2 items-center" data-testid={`row-rateio-${idx}`}>
                    <Select value={l.centroCustoId} onValueChange={(v) => updLinha(idx, { centroCustoId: v })}>
                      <SelectTrigger data-testid={`select-rateio-cc-${idx}`}><SelectValue placeholder="Selecione o CC…" /></SelectTrigger>
                      <SelectContent>
                        {ccsAtivos.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={l.percentual}
                        onChange={(e) => updLinha(idx, { percentual: parseFloat(e.target.value) || 0 })}
                        className="pr-7"
                        data-testid={`input-rateio-pct-${idx}`}
                      />
                      <span className="absolute right-2 top-2.5 text-xs text-muted-foreground">%</span>
                    </div>
                    <div className="text-right text-sm font-mono" data-testid={`text-rateio-valor-${idx}`}>
                      {formatBRL(valorLinha)}
                    </div>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeLinha(idx)} data-testid={`button-remove-rateio-${idx}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              {!semCcDuplicado && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> CCs duplicados não são permitidos
                </span>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm">
                Total: <strong data-testid="text-rateio-total">{soma.toFixed(2)}%</strong>
                {restante !== 0 && (
                  <span className={`ml-2 text-xs ${restante < 0 ? "text-destructive" : "text-amber-600"}`}>
                    (Falta {restante.toFixed(2)}%)
                  </span>
                )}
              </div>
              {valido && semCcDuplicado && (
                <Badge variant="outline" className="text-emerald-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> 100% — pronto para salvar
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {rateiosExistentes.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => limparMutation.mutate()}
              disabled={limparMutation.isPending}
              data-testid="button-limpar-rateio"
            >
              Remover rateio
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!valido || !semCcDuplicado || saveMutation.isPending}
            data-testid="button-salvar-rateio"
          >
            {saveMutation.isPending ? "Salvando…" : "Salvar rateio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
