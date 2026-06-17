// Sprint C7 — G4 Transferência entre contas (UI).
// Operação atômica: registra saída na origem + entrada no destino.
// Saldos das duas contas são atualizados juntos.

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input-br";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, AlertTriangle } from "lucide-react";

interface ContaBancaria { id: string; banco: string; conta?: string | null; agencia?: string | null; saldoAtual: string; ativo: boolean; }

interface Props {
  clienteId: string;
}

const formatBRL = (v: number | string) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
};

export function TransferenciaDialog({ clienteId }: Props) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    if (!open) {
      setOrigemId(""); setDestinoId(""); setValor("");
      setData(new Date().toISOString().slice(0, 10)); setDescricao("");
    }
  }, [open]);

  const { data: contas = [] } = useQuery<ContaBancaria[]>({
    queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"],
    enabled: open,
  });
  const ativas = contas.filter((c) => c.ativo);
  const origem = ativas.find((c) => c.id === origemId);
  const destino = ativas.find((c) => c.id === destinoId);
  const valorNum = Number(valor) || 0;
  const saldoInsuficiente = origem && valorNum > Number(origem.saldoAtual);
  const podeSubmeter = !!origemId && !!destinoId && origemId !== destinoId && valorNum > 0 && !!data && !!descricao;

  const transferir = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/control/clientes/${clienteId}/transferencias`, {
        origemId, destinoId, valor: valorNum, data, descricao,
      });
      return await r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"] });
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "overview"] });
      qc.invalidateQueries({ queryKey: ["/api/control/contas-bancarias"] });
      toast({ title: "Transferência realizada", description: `${formatBRL(valorNum)} de ${origem?.banco} → ${destino?.banco}` });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro na transferência", description: e?.message ?? "Falha", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="button-abrir-transferencia">
          <ArrowRightLeft className="h-4 w-4 mr-1" /> Transferir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Transferência entre contas</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Conta de origem</Label>
            <Select value={origemId} onValueChange={setOrigemId}>
              <SelectTrigger data-testid="select-transf-origem"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {ativas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.banco}{c.conta ? ` • ${c.conta}` : ""} — {formatBRL(c.saldoAtual)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Conta de destino</Label>
            <Select value={destinoId} onValueChange={setDestinoId}>
              <SelectTrigger data-testid="select-transf-destino"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {ativas.filter((c) => c.id !== origemId).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.banco}{c.conta ? ` • ${c.conta}` : ""} — {formatBRL(c.saldoAtual)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number" step="0.01" min="0.01" value={valor}
                onChange={(e) => setValor(e.target.value)}
                data-testid="input-transf-valor"
              />
              {saldoInsuficiente && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Saldo da origem insuficiente — a conta ficará negativa.
                </p>
              )}
            </div>
            <div>
              <Label>Data</Label>
              <DateInputBR value={data} onChange={setData} data-testid="input-transf-data" />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Input
              value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Cobertura de saldo conta principal"
              data-testid="input-transf-descricao"
            />
          </div>

          <div className="rounded-md bg-muted/30 border p-3 text-xs">
            Esta operação grava 2 movimentações no extrato (saída na origem e entrada no destino) em uma única transação.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-transf-cancelar">Cancelar</Button>
          <Button onClick={() => transferir.mutate()} disabled={!podeSubmeter || transferir.isPending} data-testid="button-transf-confirmar">
            {transferir.isPending ? "Processando..." : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
