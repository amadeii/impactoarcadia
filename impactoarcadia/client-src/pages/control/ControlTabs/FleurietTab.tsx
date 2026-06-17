import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";

const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const diagnosticoMap: Record<string, { label: string; cor: string; Icon: any }> = {
  excelente: { label: "Excelente liquidez", cor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200", Icon: Sparkles },
  solida: { label: "Sólida", cor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200", Icon: CheckCircle2 },
  fragil: { label: "Frágil — efeito tesoura", cor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200", Icon: AlertTriangle },
  insuficiente: { label: "Insuficiência de recursos", cor: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200", Icon: AlertTriangle },
};

export default function FleurietTab({ clienteId }: { clienteId: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/control/clientes", clienteId, "fleuriet"],
    enabled: !!clienteId,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;

  const diag = diagnosticoMap[data.diagnostico] ?? diagnosticoMap.solida;
  const Icon = diag.Icon;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Activity className="h-5 w-5" />Modelo Fleuriet</span>
            <Badge className={diag.cor} data-testid="badge-diagnostico">
              <Icon className="h-3 w-3 mr-1" />{diag.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Indicador label="NCG — Necessidade de Capital de Giro" value={formatBRL(data.ncg)} testid="stat-ncg" />
            <Indicador label="CGL — Capital de Giro Líquido" value={formatBRL(data.cgl)} testid="stat-cgl" />
            <Indicador label="ST — Saldo de Tesouraria" value={formatBRL(data.saldoTesouraria)} testid="stat-st" highlight={data.efeitoTesoura} />
          </div>
          {data.observacoes?.length > 0 && (
            <div className="mt-4 space-y-1 text-sm">
              {data.observacoes.map((o: string, i: number) => <div key={i}>{o}</div>)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Composição</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Indicador label="Contas a receber" value={formatBRL(data.detalhes.contasReceber)} testid="stat-receber" />
          <Indicador label="Estoque" value={formatBRL(data.detalhes.estoque)} testid="stat-estoque" />
          <Indicador label="Disponível bancário" value={formatBRL(data.detalhes.disponivelBancario)} testid="stat-disponivel" />
          <Indicador label="Contas a pagar" value={formatBRL(data.detalhes.contasPagar)} testid="stat-pagar" />
          <Indicador label="Empréstimos CP" value={formatBRL(data.detalhes.emprestimosCp)} testid="stat-emp" />
          <Indicador label="PMR" value={`${data.detalhes.pmr} dias`} testid="stat-pmr" />
          <Indicador label="PME" value={`${data.detalhes.pme} dias`} testid="stat-pme" />
          <Indicador label="PMP" value={`${data.detalhes.pmp} dias`} testid="stat-pmp" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ciclos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Indicador label="Ciclo Operacional (PMR + PME)" value={`${data.cicloOperacional} dias`} testid="stat-ciclo-op" />
          <Indicador label="Ciclo Financeiro (− PMP)" value={`${data.cicloFinanceiro} dias`} testid="stat-ciclo-fin" />
        </CardContent>
      </Card>
    </div>
  );
}

function Indicador({ label, value, testid, highlight }: { label: string; value: string; testid: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded border ${highlight ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-base" data-testid={testid}>{value}</div>
    </div>
  );
}
