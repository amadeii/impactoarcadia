// Sprint C9 — G8 Fluxo de Caixa Diário.
// Tabela dia a dia do mês com accordion de lançamentos. Lançamentos
// previstos (sem dataPagamento) destacados em azul. Saldo acumulado
// negativo em vermelho. Navegação ← → entre meses (URL atualiza).

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface Cliente { id: string; name: string; }
interface Conta { id: string; banco: string; conta: string | null; }
interface DiaLanc { id: string; descricao: string; valor: number; tipo: string; status: string; pago: boolean; contaBancariaId: string | null; }
interface Dia { dia: number; data: string; entradas: number; saidas: number; saldoDia: number; saldoAcumulado: number; isHoje: boolean; lancamentos: DiaLanc[]; }
interface Diario { ano: number; mes: number; saldoInicial: number; dias: Dia[]; }

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const TODAS = "__todas__";
const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function parseQs(qs: string) {
  const sp = new URLSearchParams(qs.replace(/^\?/, ""));
  return { ano: Number(sp.get("ano")) || null, mes: Number(sp.get("mes")) || null };
}

export default function FluxoCaixaDiario() {
  const [location, setLocation] = useLocation();
  const clienteId = location.split('/').filter(Boolean)[1] ?? '';
  const qs = location.includes("?") ? location.slice(location.indexOf("?")) : "";
  const parsed = parseQs(qs);
  const hoje = new Date();
  const ano = parsed.ano ?? hoje.getFullYear();
  const mes = parsed.mes ?? hoje.getMonth() + 1;
  const [conta, setConta] = useState<string>(TODAS);
  const [diaAberto, setDiaAberto] = useState<number | null>(null);

  const { data: clientes = [] } = useQuery<Cliente[]>({ queryKey: ["/api/clients"] });
  const cliente = clientes.find((c) => c.id === clienteId);
  const { data: contas = [] } = useQuery<Conta[]>({
    queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"],
    enabled: !!clienteId,
  });

  const { data, isLoading } = useQuery<Diario>({
    queryKey: ["/api/control/clientes", clienteId, "fluxo-caixa-diario", ano, mes, conta],
    queryFn: async () => {
      const params = new URLSearchParams({ ano: String(ano), mes: String(mes) });
      if (conta !== TODAS) params.set("conta", conta);
      const r = await fetch(`/api/control/clientes/${clienteId}/fluxo-caixa-diario?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Falha ao carregar fluxo diário");
      return r.json();
    },
    enabled: !!clienteId,
  });

  const navegar = (delta: number) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 1) { novoMes = 12; novoAno -= 1; }
    if (novoMes > 12) { novoMes = 1; novoAno += 1; }
    setLocation(`/control/${clienteId}/fluxo-caixa-diario?ano=${novoAno}&mes=${novoMes}`);
    setDiaAberto(null);
  };

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
            <CalendarDays className="h-6 w-6" /> Fluxo de Caixa Diário — {cliente?.name ?? "..."}
          </h1>
        </div>
        <div className="flex gap-2 items-end">
          <Button variant="outline" size="sm" onClick={() => navegar(-1)} data-testid="button-mes-anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-base font-medium px-3 py-1.5">{MESES[mes - 1]} {ano}</div>
          <Button variant="outline" size="sm" onClick={() => navegar(1)} data-testid="button-mes-proximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div>
            <Label className="text-xs">Conta</Label>
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger className="w-48" data-testid="select-conta"><SelectValue /></SelectTrigger>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Saldo inicial: <span className="font-semibold">{data ? formatBRL(data.saldoInicial) : "..."}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !data ? (
            <p className="text-muted-foreground text-sm">Sem dados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Dia</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Saldo do dia</TableHead>
                  <TableHead className="text-right">Saldo acumulado</TableHead>
                  <TableHead className="w-20 text-center">Itens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dias.map((d) => {
                  const aberto = diaAberto === d.dia;
                  const negativo = d.saldoAcumulado < 0;
                  return (
                    <>
                      <TableRow
                        key={d.dia}
                        className={`cursor-pointer hover:bg-muted/50 ${d.isHoje ? "border-l-4 border-l-purple-500" : ""}`}
                        onClick={() => setDiaAberto(aberto ? null : d.dia)}
                        data-testid={`row-dia-${d.dia}`}
                      >
                        <TableCell className="font-medium">
                          {d.dia}
                          {d.isHoje && <Badge variant="default" className="ml-2 text-[10px]">Hoje</Badge>}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{d.entradas > 0 ? formatBRL(d.entradas) : "—"}</TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400">{d.saidas > 0 ? formatBRL(d.saidas) : "—"}</TableCell>
                        <TableCell className={`text-right ${d.saldoDia < 0 ? "text-red-600 dark:text-red-400" : d.saldoDia > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{formatBRL(d.saldoDia)}</TableCell>
                        <TableCell className={`text-right font-medium ${negativo ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300" : ""}`}>{formatBRL(d.saldoAcumulado)}</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">{d.lancamentos.length || ""}</TableCell>
                      </TableRow>
                      {aberto && d.lancamentos.length > 0 && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={6} className="p-3">
                            <div className="space-y-1">
                              {d.lancamentos.map((l) => (
                                <div
                                  key={l.id}
                                  className={`flex justify-between text-xs px-2 py-1 rounded ${l.pago ? "" : "bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300"}`}
                                  data-testid={`lanc-${l.id}`}
                                >
                                  <span>{l.descricao}{!l.pago && <Badge variant="outline" className="ml-2 text-[10px]">Previsto</Badge>}</span>
                                  <span className={l.tipo === "receber" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                                    {l.tipo === "receber" ? "+" : "-"}{formatBRL(l.valor)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
