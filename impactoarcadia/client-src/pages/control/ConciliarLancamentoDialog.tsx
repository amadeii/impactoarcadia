import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input-br";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote } from "lucide-react";

interface Lancamento {
  id: string;
  tipo: "pagar" | "receber";
  descricao: string;
  valor: string;
  status: string;
  contaBancariaId?: string | null;
  dataVencimento: string;
}

interface ContaBancaria { id: string; banco: string; agencia?: string | null; conta?: string | null; ativo: boolean; }

interface Props {
  lancamento: Lancamento;
  clienteId: string;
}

export function ConciliarLancamentoDialog({ lancamento, clienteId }: Props) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [dataPagamento, setDataPagamento] = useState(today);
  const [contaBancariaId, setContaBancariaId] = useState<string>(lancamento.contaBancariaId ?? "");
  // Reseta state ao abrir/trocar lançamento — evita reaproveitar valores de cancelamento anterior
  useEffect(() => {
    if (open) {
      setDataPagamento(new Date().toISOString().slice(0, 10));
      setContaBancariaId(lancamento.contaBancariaId ?? "");
    }
  }, [open, lancamento.id, lancamento.contaBancariaId]);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: contas = [] } = useQuery<ContaBancaria[]>({
    queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"],
    enabled: open,
  });

  const conciliar = useMutation({
    mutationFn: async () => {
      if (!contaBancariaId) throw new Error("Selecione a conta bancária para conciliar");
      // Sprint C6.1: endpoint dedicado que cria movimentação no extrato e
      // atualiza o saldo da conta atomicamente (em transação).
      const r = await apiRequest("POST", `/api/control/lancamentos/${lancamento.id}/conciliar`, {
        contaBancariaId,
        dataPagamento,
      });
      return await r.json();
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "lancamentos"] });
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "overview"] });
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"] });
      qc.invalidateQueries({ queryKey: ["/api/control/contas-bancarias", contaBancariaId, "extrato"] });
      const saldo = data?.saldoAposConta ? ` — saldo da conta: R$ ${Number(data.saldoAposConta).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "";
      toast({
        title: "Lançamento conciliado",
        description: `Movimentação registrada no extrato${saldo}`,
      });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro ao conciliar", description: e?.message ?? "Falha", variant: "destructive" }),
  });

  const desconciliar = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/control/lancamentos/${lancamento.id}/desconciliar`, {});
      return await r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "lancamentos"] });
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "overview"] });
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"] });
      qc.invalidateQueries({ queryKey: ["/api/control/contas-bancarias", lancamento.contaBancariaId, "extrato"] });
      toast({ title: "Conciliação revertida", description: "Saldo da conta foi devolvido e a movimentação removida do extrato." });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro ao desconciliar", description: e?.message ?? "Falha", variant: "destructive" }),
  });

  const jaConciliado = lancamento.status === "pago";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        title="Conciliar (marcar como pago/recebido)"
        data-testid={`button-conciliar-${lancamento.id}`}
      >
        <Banknote className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{jaConciliado ? "Lançamento já conciliado" : "Conciliar lançamento"}</DialogTitle>
          <DialogDescription className="break-words">
            {jaConciliado
              ? `Já registrado no extrato. Você pode reverter ou alterar a conta e a data.`
              : `${lancamento.tipo === "pagar" ? "Marcar como pago" : "Marcar como recebido"} — ${lancamento.descricao}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground" data-testid="text-conciliar-aviso-extrato">
            Conciliar irá <strong className="text-foreground">atualizar o saldo da conta bancária</strong> e gerar uma <strong className="text-foreground">linha no extrato</strong> automaticamente.
          </div>
          <div className="space-y-1.5">
            <Label>Data do {lancamento.tipo === "pagar" ? "pagamento" : "recebimento"}</Label>
            <DateInputBR
              value={dataPagamento}
              onChange={(v) => setDataPagamento(v)}
              data-testid="input-conciliar-data"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Conta bancária *</Label>
            <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
              <SelectTrigger data-testid="select-conciliar-banco">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {contas.filter((c) => c.ativo).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.banco}{c.agencia ? ` • Ag ${c.agencia}` : ""}{c.conta ? ` • CC ${c.conta}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!contaBancariaId && (
              <p className="text-xs text-destructive" data-testid="text-conciliar-banco-obrigatorio">
                Conta bancária obrigatória — toda movimentação precisa transitar por uma conta.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-auto">
            {jaConciliado && (
              <Button
                variant="destructive"
                onClick={() => desconciliar.mutate()}
                disabled={desconciliar.isPending}
                className="w-full sm:w-auto"
                data-testid="button-conciliar-reverter"
              >
                {desconciliar.isPending ? "Revertendo..." : "Reverter conciliação"}
              </Button>
            )}
          </div>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
              data-testid="button-conciliar-cancelar"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => conciliar.mutate()}
              disabled={conciliar.isPending || !dataPagamento || !contaBancariaId}
              className="w-full sm:w-auto"
              data-testid="button-conciliar-confirmar"
            >
              {conciliar.isPending ? "Conciliando..." : jaConciliado ? "Atualizar conciliação" : "Confirmar conciliação"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
