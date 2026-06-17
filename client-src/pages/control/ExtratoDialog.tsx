import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Receipt, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

function formatBRL(v: string | number) {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDateBR(d?: string | null) {
  if (!d) return "-";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

interface Movimentacao {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  origem: string;
  descricao: string;
  valor: string;
  saldoApos?: string | null;
  lancamentoId?: string | null;
  lancamentoDescricao?: string | null;
}

interface ExtratoData {
  conta: { id: string; banco: string; saldoInicial: string; saldoAtual: string };
  movimentacoes: Movimentacao[];
  totalEntradas: number;
  totalSaidas: number;
}

interface Props {
  contaId: string;
  banco: string;
}

export function ExtratoDialog({ contaId, banco }: Props) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<ExtratoData>({
    queryKey: ["/api/control/contas-bancarias", contaId, "extrato"],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        title="Ver extrato"
        data-testid={`button-extrato-${contaId}`}
      >
        <Receipt className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle data-testid="text-extrato-titulo">Extrato — {banco}</DialogTitle>
          <DialogDescription>
            Movimentações geradas por conciliação de lançamentos financeiros.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
        ) : !data ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Sem dados</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Saldo inicial</div>
                <div className="text-lg font-semibold" data-testid="text-extrato-saldo-inicial">{formatBRL(data.conta.saldoInicial)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Entradas</div>
                <div className="text-lg font-semibold text-green-600" data-testid="text-extrato-entradas">{formatBRL(data.totalEntradas)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Saídas</div>
                <div className="text-lg font-semibold text-red-600" data-testid="text-extrato-saidas">{formatBRL(data.totalSaidas)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Saldo atual</div>
                <div className="text-lg font-semibold" data-testid="text-extrato-saldo-atual">{formatBRL(data.conta.saldoAtual)}</div>
              </div>
            </div>

            <ScrollArea className="h-[50vh] border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-24">Data</TableHead>
                    <TableHead className="w-20">Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-24">Origem</TableHead>
                    <TableHead className="text-right w-32">Valor</TableHead>
                    <TableHead className="text-right w-32">Saldo após</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.movimentacoes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground" data-testid="text-extrato-vazio">
                        Nenhuma movimentação registrada nesta conta.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.movimentacoes.map((m) => (
                      <TableRow key={m.id} data-testid={`row-mov-${m.id}`}>
                        <TableCell className="text-sm">{formatDateBR(m.data)}</TableCell>
                        <TableCell>
                          {m.tipo === "entrada" ? (
                            <Badge variant="outline" className="border-green-500 text-green-600">
                              <ArrowDownCircle className="h-3 w-3 mr-1" />Entrada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-500 text-red-600">
                              <ArrowUpCircle className="h-3 w-3 mr-1" />Saída
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{m.descricao}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{m.origem}</Badge></TableCell>
                        <TableCell className={`text-right font-medium ${m.tipo === "entrada" ? "text-green-600" : "text-red-600"}`}>
                          {m.tipo === "entrada" ? "+" : "−"} {formatBRL(m.valor)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{m.saldoApos ? formatBRL(m.saldoApos) : "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
