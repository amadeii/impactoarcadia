import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Calculator, TrendingUp } from "lucide-react";

const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function PainelFiscalTab({ clienteId }: { clienteId: string }) {
  const [valor, setValor] = useState("10000");
  const [ano, setAno] = useState("2026");
  const [op, setOp] = useState("venda_produto");
  const [calc, setCalc] = useState<any>(null);

  const { data: painel, isLoading } = useQuery<any>({
    queryKey: ["/api/control/clientes", clienteId, "painel-fiscal", { ano }],
    queryFn: async () => {
      const r = await fetch(`/api/control/clientes/${clienteId}/painel-fiscal?ano=${ano}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!clienteId,
  });

  const calcular = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/control/ibs-cbs/calcular", {
        valor: Number(valor), ano: Number(ano), operacao: op,
      });
      return await r.json();
    },
    onSuccess: (data) => setCalc(data),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Calculadora IBS / CBS</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input type="number" placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} data-testid="input-ibs-valor" />
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger data-testid="select-ibs-ano"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={op} onValueChange={setOp}>
              <SelectTrigger data-testid="select-ibs-op"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="venda_produto">Venda de Produto</SelectItem>
                <SelectItem value="servico">Serviço</SelectItem>
                <SelectItem value="importacao">Importação</SelectItem>
                <SelectItem value="exportacao">Exportação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => calcular.mutate()} disabled={calcular.isPending} data-testid="button-calcular-ibs">Calcular</Button>
          {calc && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t">
              <Stat label="CBS" value={formatBRL(calc.cbs)} testid="stat-cbs" />
              <Stat label="IBS" value={formatBRL(calc.ibs)} testid="stat-ibs" />
              <Stat label="Total Antigo (proporcional)" value={formatBRL(calc.totalAntigo)} testid="stat-antigo" />
              <Stat label="Total Efetivo" value={formatBRL(calc.totalEfetivo)} testid="stat-efetivo" highlight />
              <div className="col-span-full text-xs space-y-1">
                {calc.observacoes?.map((o: string, i: number) => <div key={i} className="text-muted-foreground">• {o}</div>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Painel Fiscal {ano}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : painel ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Faturamento" value={formatBRL(painel.faturamentoBruto)} testid="stat-faturamento" />
              <Stat label="Tributos (novo)" value={formatBRL(painel.totalNovo)} testid="stat-novo" />
              <Stat label="Tributos (antigo)" value={formatBRL(painel.totalAntigo)} testid="stat-antigo-painel" />
              <Stat label="Carga efetiva" value={`${painel.cargaPercent ?? 0}%`} testid="stat-carga" highlight />
            </div>
          ) : <div className="text-sm text-muted-foreground">Sem dados de receita para o ano</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, testid, highlight }: { label: string; value: string; testid: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded border ${highlight ? "bg-primary/5 border-primary/30" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-base" data-testid={testid}>{value}</div>
    </div>
  );
}
