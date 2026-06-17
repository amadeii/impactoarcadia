// Sprint C9 — G7 Fluxo de Caixa Mensal.
// Matriz grupos DRE × 12 meses, célula dupla Realizado/Previsto, com cores
// indicando desempenho vs orçamento. Filtro por conta bancária.

import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp } from "lucide-react";

interface Cliente { id: string; name: string; }
interface Conta { id: string; banco: string; conta: string | null; }
interface MesCell { mes: number; realizado: number; previsto: number; }
interface FluxoRow { grupoDre: string; meses: MesCell[]; totalRealizado: number; totalPrevisto: number; }
interface FluxoMensal {
  ano: number; contaBancariaId: string | null;
  grupos: FluxoRow[];
  saldoInicialAno: number;
  saldosFinaisMes: number[];
  totaisEntradas: number[];
  totaisSaidas: number[];
}

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const TODAS = "__todas__";
const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
const formatBRLPlain = (v: number) => v === 0 ? "—" : formatBRL(v);

function corCelula(real: number, prev: number) {
  if (prev === 0) return "text-muted-foreground";
  const ratio = real / prev;
  if (ratio >= 1) return "text-emerald-600 dark:text-emerald-400 font-medium";
  if (ratio < 0.85) return "text-red-600 dark:text-red-400 font-medium";
  return "";
}

export default function FluxoCaixaMensal() {
  const [location] = useLocation();
  const clienteId = location.split('/').filter(Boolean)[1] ?? '';
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [conta, setConta] = useState<string>(TODAS);

  const { data: clientes = [] } = useQuery<Cliente[]>({ queryKey: ["/api/clients"] });
  const cliente = clientes.find((c) => c.id === clienteId);

  const { data: contas = [] } = useQuery<Conta[]>({
    queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"],
    enabled: !!clienteId,
  });

  const { data, isLoading } = useQuery<FluxoMensal>({
    queryKey: ["/api/control/clientes", clienteId, "fluxo-caixa-mensal", ano, conta],
    queryFn: async () => {
      const params = new URLSearchParams({ ano: String(ano) });
      if (conta !== TODAS) params.set("conta", conta);
      const r = await fetch(`/api/control/clientes/${clienteId}/fluxo-caixa-mensal?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Falha ao carregar fluxo");
      return r.json();
    },
    enabled: !!clienteId,
  });

  const totaisAno = useMemo(() => {
    if (!data) return { entradas: 0, saidas: 0 };
    return {
      entradas: data.totaisEntradas.reduce((s, v) => s + v, 0),
      saidas: data.totaisSaidas.reduce((s, v) => s + v, 0),
    };
  }, [data]);

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
            <TrendingUp className="h-6 w-6" /> Fluxo de Caixa Mensal — {cliente?.name ?? "..."}
          </h1>
          <p className="text-sm text-muted-foreground">Realizado × Previsto por grupo, com saldo bancário acumulado.</p>
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
            <Label className="text-xs">Conta bancária</Label>
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger className="w-56" data-testid="select-conta"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todos os bancos</SelectItem>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.banco}{c.conta ? ` · ${c.conta}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Matriz {ano}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !data ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Sem dados.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Grupo</TableHead>
                    {MESES.map((m) => (<TableHead key={m} className="w-24 text-right">{m}</TableHead>))}
                    <TableHead className="w-28 text-right">Total Ano</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Saldo inicial */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-medium">Saldo inicial</TableCell>
                    <TableCell className="text-right" colSpan={12}>{formatBRL(data.saldoInicialAno)} (1º jan)</TableCell>
                    <TableCell />
                  </TableRow>

                  {/* Grupos DRE */}
                  {data.grupos.map((g) => (
                    <TableRow key={g.grupoDre} data-testid={`row-grupo-${g.grupoDre}`}>
                      <TableCell className="font-medium">{g.grupoDre}</TableCell>
                      {g.meses.map((c) => (
                        <TableCell key={c.mes} className="text-right p-1">
                          <div className={corCelula(c.realizado, c.previsto)}>{formatBRLPlain(c.realizado)}</div>
                          <div className="text-[10px] text-muted-foreground">{c.previsto > 0 ? formatBRL(c.previsto) : "—"}</div>
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div>{formatBRLPlain(g.totalRealizado)}</div>
                        <div className="text-[10px] text-muted-foreground">{g.totalPrevisto > 0 ? formatBRL(g.totalPrevisto) : "—"}</div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Entradas */}
                  <TableRow className="bg-emerald-50 dark:bg-emerald-950/30 font-medium">
                    <TableCell className="text-emerald-700 dark:text-emerald-400">Entradas</TableCell>
                    {data.totaisEntradas.map((v, i) => (<TableCell key={i} className="text-right text-emerald-700 dark:text-emerald-400">{formatBRLPlain(v)}</TableCell>))}
                    <TableCell className="text-right text-emerald-700 dark:text-emerald-400">{formatBRL(totaisAno.entradas)}</TableCell>
                  </TableRow>
                  {/* Saídas */}
                  <TableRow className="bg-red-50 dark:bg-red-950/30 font-medium">
                    <TableCell className="text-red-700 dark:text-red-400">Saídas</TableCell>
                    {data.totaisSaidas.map((v, i) => (<TableCell key={i} className="text-right text-red-700 dark:text-red-400">{formatBRLPlain(v)}</TableCell>))}
                    <TableCell className="text-right text-red-700 dark:text-red-400">{formatBRL(totaisAno.saidas)}</TableCell>
                  </TableRow>
                  {/* Saldo final */}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Saldo final</TableCell>
                    {data.saldosFinaisMes.map((s, i) => (
                      <TableCell key={i} className={`text-right ${s < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{formatBRL(s)}</TableCell>
                    ))}
                    <TableCell className="text-right">{formatBRL(data.saldosFinaisMes[11] ?? data.saldoInicialAno)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
