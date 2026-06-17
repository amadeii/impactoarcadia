// Sprint C7 — G5 Saldo inicial com data (UI).
// Idempotente: re-abrir e gravar substitui o saldo inicial anterior
// (reverte saldo + remove movimentação antiga antes de inserir a nova).

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input-br";
import { Label } from "@/components/ui/label";
import { Wallet } from "lucide-react";

interface Props {
  contaId: string;
  banco: string;
  saldoAtual?: string | number;
  clienteId: string;
}

export function SaldoInicialDialog({ contaId, banco, saldoAtual, clienteId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setData(new Date().toISOString().slice(0, 10));
      setValor(String(saldoAtual ?? "0"));
    }
  }, [open, saldoAtual]);

  const salvar = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/control/contas-bancarias/${contaId}/saldo-inicial`, {
        data,
        valor: Number(valor),
      });
      return await r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control/contas-bancarias", contaId, "extrato"] });
      toast({ title: "Saldo inicial atualizado" });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Definir saldo inicial" data-testid={`button-saldo-inicial-${contaId}`}>
          <Wallet className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Saldo inicial — {banco}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Data de abertura</Label>
            <DateInputBR value={data} onChange={setData} data-testid="input-saldo-inicial-data" />
          </div>
          <div>
            <Label>Valor (R$) — pode ser negativo</Label>
            <Input
              type="number" step="0.01" value={valor}
              onChange={(e) => setValor(e.target.value)}
              data-testid="input-saldo-inicial-valor"
            />
          </div>
          <div className="rounded-md bg-muted/30 border p-3 text-xs">
            Se a conta já tem um saldo inicial, ele será substituído (operação idempotente). Movimentações posteriores não são afetadas.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={!data || valor === "" || salvar.isPending} data-testid="button-saldo-inicial-salvar">
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
