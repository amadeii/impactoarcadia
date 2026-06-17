// Sprint C9 — G9 DRE com Análise Vertical (AV%) + coluna Previsto (C8).
// Mostra Realizado, AV%, Previsto e Desvio por grupo DRE. Badge vermelha
// quando |desvio| > threshold (default 15%).

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, BarChart3, AlertTriangle } from "lucide-react";

interface Cliente { id: string; name: string; }
interface DreLinha {
  grupoDre: string;
  natureza: string | null;
  realizado: number;
  previsto: number;
  avPerc: number | null;
  desvio: number;
  desvioPerc: number | null;
  alerta: boolean;
}
interface Dre {
  ano: number; mes: number | null;
  threshold: number;
  receitaBruta: number;
  totalCustos: number;
  totalDespesas: number;
  resultado: number;
  margemPerc: number | null;
  linhas: DreLinha[];
}

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function DRE() {
  const [location] = useLocation();
  const clienteId = location.split('/').filter(Boolean)[1] ?? '';
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState<string>("0"); // 0 = ano todo
  const [threshold, setThreshold] = useState(15);

  const { data: clientes = [] } = useQuery<Cliente[]>({ queryKey: ["/api/clients"] });
  const cliente = clientes.find((c) => c.id === clienteId);

  const { data, isLoading } = useQuery<Dre>({
    queryKey: ["/api/control/clientes", clienteId, "dre", ano, mes, threshold],
    queryFn: async () => {
      const p = new URLSearchParams({ ano: String(ano), threshold: String(threshold) });
      if (mes !== "0") p.set("mes", mes);
      const r = await fetch(`/api/control/clientes/${clienteId}/dre?${p}`, { credentials: "include" });
      if (!r.ok) throw new Error("Falha ao carregar DRE");
      return r.json();
    },
    enabled: !!clienteId,
  });

  return (
    <div className="p-6 space-y-4 min-h-screen bg-background">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href={`/control/${clienteId}`}>
            <Button variant="ghost" size="sm" data-testid="link-back-control">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> DRE — {cliente?.name ?? "..."}
          </h1>
          <p className="text-sm text-muted-foreground">Demonstrativo com Análise Vertical (peso de cada linha sobre a receita bruta) e comparativo com orçamento.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-24" data-testid="select-ano"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[anoAtual - 1, anoAtual, anoAtual + 1].map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-32" data-testid="select-mes"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Ano todo</SelectItem>
                {MESES.map((m, i) => (<SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Alerta {">"} %</Label>
            <Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value) || 15)} className="w-20" data-testid="input-threshold" />
          </div>
        </div>
      </div>

      {/* Cards de totais */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Receita bruta</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-semibold">{formatBRL(data.receitaBruta)}</div></CardContent></Card>
          <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Custos</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-semibold text-red-600 dark:text-red-400">{formatBRL(data.totalCustos)}</div></CardContent></Card>
          <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Despesas</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-semibold text-amber-600 dark:text-amber-400">{formatBRL(data.totalDespesas)}</div></CardContent></Card>
          <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Resultado / Margem</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-xl font-semibold ${data.resultado < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{formatBRL(data.resultado)}</div>
              <div className="text-xs text-muted-foreground">{data.margemPerc === null ? "—" : `${data.margemPerc.toFixed(1)}% AV`}</div>
            </CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Detalhamento por grupo</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !data || data.linhas.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Sem lançamentos no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo DRE</TableHead>
                  <TableHead>Natureza</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right" title="Análise Vertical = % sobre receita bruta">AV%</TableHead>
                  <TableHead className="text-right">Previsto</TableHead>
                  <TableHead className="text-right">Desvio</TableHead>
                  <TableHead className="text-right">% Desvio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.linhas.map((l) => (
                  <TableRow key={l.grupoDre} data-testid={`row-dre-${l.grupoDre}`}>
                    <TableCell className="font-medium">{l.grupoDre}</TableCell>
                    <TableCell>{l.natureza ? <Badge variant="outline">{l.natureza}</Badge> : "—"}</TableCell>
                    <TableCell className="text-right">{formatBRL(l.realizado)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground" title="Percentual em relação à Receita Bruta">
                      {l.avPerc === null ? "—" : `${l.avPerc.toFixed(1)}%`}
                    </TableCell>
                    <TableCell className="text-right text-blue-700 dark:text-blue-400">{l.previsto > 0 ? formatBRL(l.previsto) : "—"}</TableCell>
                    <TableCell className="text-right">{l.previsto > 0 ? formatBRL(l.desvio) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {l.desvioPerc === null ? "—" : (
                        <span className={l.alerta ? "text-red-600 dark:text-red-400 font-medium inline-flex items-center gap-1" : ""}>
                          {l.alerta && <AlertTriangle className="h-3 w-3" />}
                          {l.desvioPerc.toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data && (
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell colSpan={3}>Margem líquida</TableCell>
                    <TableCell className="text-right">{data.margemPerc === null ? "—" : `${data.margemPerc.toFixed(1)}%`}</TableCell>
                    <TableCell colSpan={3} className="text-right">{formatBRL(data.resultado)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
