// Sprint C10 — G12 Pivot Cliente × Mês (e Fornecedor × Mês).
// Tabela ordenada por total decrescente, busca, alerta de concentração
// (top-3 > 60%), drill-down via modal e exportação XLSX.

import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, AlertTriangle, Search } from "lucide-react";
import { useExercicio } from "@/hooks/useExercicio";
import * as XLSX from "xlsx";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface PivotRow { pessoa: string; meses: number[]; total: number; percentual: number; }
interface PivotResp { ano: number; tipo: "receber"|"pagar"; rows: PivotRow[]; totalGeral: number; totaisMensais: number[]; top3Concentracao: number; alertaConcentracao: boolean; }

export default function PivotCarteira() {
  const [location] = useLocation();
  const clienteId = location.split('/').filter(Boolean)[1] ?? '';
  const { ano, setAno } = useExercicio();
  const [tipo, setTipo] = useState<"receber"|"pagar">("receber");
  const [busca, setBusca] = useState("");
  const [drill, setDrill] = useState<PivotRow | null>(null);

  const exerciciosQ = useQuery<{ anos: number[] }>({
    queryKey: ["/api/control/clientes", clienteId, "exercicios"],
  });

  const endpoint = tipo === "receber" ? "pivot-clientes" : "pivot-fornecedores";
  const pivotQ = useQuery<PivotResp>({
    queryKey: ["/api/control/clientes", clienteId, endpoint, { ano }],
    queryFn: async () => {
      const r = await fetch(`/api/control/clientes/${clienteId}/${endpoint}?ano=${ano}`, { credentials: "include" });
      if (!r.ok) throw new Error("Falha ao carregar pivot");
      return r.json();
    },
  });

  const filtered = useMemo(() => {
    const rows = pivotQ.data?.rows ?? [];
    if (!busca.trim()) return rows;
    const q = busca.toLowerCase();
    return rows.filter((r) => r.pessoa.toLowerCase().includes(q));
  }, [pivotQ.data, busca]);

  const exportar = () => {
    if (!pivotQ.data) return;
    const headers = ["Pessoa", ...MESES, "Total", "%"];
    const aoa: any[][] = [headers];
    filtered.forEach((r) => aoa.push([r.pessoa, ...r.meses.map((v) => +v.toFixed(2)), +r.total.toFixed(2), r.percentual]));
    aoa.push(["TOTAL", ...pivotQ.data.totaisMensais.map((v) => +v.toFixed(2)), +pivotQ.data.totalGeral.toFixed(2), 100]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tipo === "receber" ? "Clientes" : "Fornecedores");
    XLSX.writeFile(wb, `pivot_${tipo}_${ano}.xlsx`);
  };

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Link href={`/control/${clienteId}`}>
          <Button variant="ghost" size="sm" data-testid="button-back"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        </Link>
        <h1 className="text-2xl font-bold flex-1" data-testid="text-page-title">Pivot {tipo === "receber" ? "Clientes" : "Fornecedores"} × Mês</h1>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-32" data-testid="select-ano"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(exerciciosQ.data?.anos ?? [ano]).map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={tipo === "receber" ? "default" : "outline"} size="sm" onClick={() => setTipo("receber")} data-testid="button-tipo-receber">Receitas</Button>
        <Button variant={tipo === "pagar" ? "default" : "outline"} size="sm" onClick={() => setTipo("pagar")} data-testid="button-tipo-pagar">Compras</Button>
        <Button variant="outline" size="sm" onClick={exportar} data-testid="button-export-xlsx"><Download className="h-4 w-4 mr-1" /> XLSX</Button>
      </div>

      {pivotQ.data?.alertaConcentracao && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 rounded-md text-red-800 dark:text-red-300" data-testid="alert-concentracao">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">Concentração de receita:</span> Top-3 representam {pivotQ.data.top3Concentracao}% do total.
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome..." className="pl-8" data-testid="input-busca" />
        </div>
        <span className="text-sm text-muted-foreground" data-testid="text-total-linhas">{filtered.length} linhas · Total {fmt(pivotQ.data?.totalGeral ?? 0)}</span>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {pivotQ.isLoading ? <Skeleton className="h-64 m-4" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background min-w-[200px]">Pessoa</TableHead>
                  {MESES.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}
                  <TableHead className="text-right font-bold">Total</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, idx) => (
                  <TableRow key={r.pessoa + idx} data-testid={`row-pivot-${idx}`}>
                    <TableCell className="sticky left-0 bg-background font-medium cursor-pointer hover:underline" onClick={() => setDrill(r)} data-testid={`link-drill-${idx}`}>{r.pessoa}</TableCell>
                    {r.meses.map((v, i) => <TableCell key={i} className="text-right tabular-nums">{v > 0 ? fmt(v) : "—"}</TableCell>)}
                    <TableCell className="text-right font-bold tabular-nums">{fmt(r.total)}</TableCell>
                    <TableCell className="text-right">
                      {idx < 3 && pivotQ.data!.alertaConcentracao
                        ? <Badge variant="destructive">{r.percentual}%</Badge>
                        : <span className="text-muted-foreground">{r.percentual}%</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-6">Nenhum lançamento pago em {ano}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!drill} onOpenChange={(v) => !v && setDrill(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{drill?.pessoa}</DialogTitle></DialogHeader>
          {drill && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-4 gap-2">
                {drill.meses.map((v, i) => v > 0 && (
                  <div key={i} className="border rounded p-2">
                    <div className="text-xs text-muted-foreground">{MESES[i]}/{ano}</div>
                    <div className="font-mono">{fmt(v)}</div>
                  </div>
                ))}
              </div>
              <div className="font-bold pt-2 border-t">Total: {fmt(drill.total)} ({drill.percentual}%)</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
