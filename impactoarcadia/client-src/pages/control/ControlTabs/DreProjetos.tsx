/**
 * Sprint C-E06 — DRE por Projeto
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Download, BarChart3, Loader2 } from "lucide-react";

interface DreProjeto {
  projeto_id: string;
  projeto_numero: string;
  projeto_titulo: string;
  receita_bruta: number;
  deducoes: number;
  receita_liquida: number;
  custos_diretos: number;
  margem_bruta: number;
  margem_bruta_pct: number | null;
  despesas_operacionais: number;
  resultado: number;
  margem_resultado_pct: number | null;
}

interface Filtros {
  competencia: string;
  projetoId: string;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number | null) => v == null ? "—" : `${v.toFixed(1)}%`;

function exportCsv(rows: DreProjeto[]) {
  const header = ["Número","Título","Receita Bruta","Deduções","Receita Líquida","Custos","Margem Bruta","Margem%","Despesas","Resultado","Result%"];
  const lines = rows.map(r => [
    r.projeto_numero, `"${r.projeto_titulo}"`,
    r.receita_bruta, r.deducoes, r.receita_liquida,
    r.custos_diretos, r.margem_bruta, r.margem_bruta_pct ?? "",
    r.despesas_operacionais, r.resultado, r.margem_resultado_pct ?? "",
  ].join(","));
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "dre_projetos.csv"; a.click();
}

export default function DreProjetos({ clienteId }: { clienteId: string }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [filtros, setFiltros] = useState<Filtros>({ competencia: currentMonth, projetoId: "todos" });

  const params = new URLSearchParams({ competencia: filtros.competencia });
  if (filtros.projetoId !== "todos") params.set("projetoId", filtros.projetoId);

  const { data: rows = [], isLoading } = useQuery<DreProjeto[]>({
    queryKey: ["/api/control/dre-projetos", clienteId, filtros],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/control/clientes/${clienteId}/dre-projetos?${params}`);
      return r.json();
    },
  });

  const { data: projetos = [] } = useQuery<{ id: string; numero: string; titulo: string }[]>({
    queryKey: ["/api/engineering/projects"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/engineering/projects`);
      return r.json();
    },
  });

  const totais = rows.reduce((acc, r) => ({
    receita_bruta: acc.receita_bruta + r.receita_bruta,
    custos_diretos: acc.custos_diretos + r.custos_diretos,
    margem_bruta: acc.margem_bruta + r.margem_bruta,
    resultado: acc.resultado + r.resultado,
  }), { receita_bruta: 0, custos_diretos: 0, margem_bruta: 0, resultado: 0 });

  const margemTotal = totais.receita_bruta > 0
    ? (totais.margem_bruta / totais.receita_bruta * 100)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" /> DRE por Projeto
        </h3>
        <Button variant="outline" size="sm" onClick={() => exportCsv(rows)} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Competência</Label>
          <Input
            type="month" value={filtros.competencia}
            onChange={e => setFiltros(f => ({ ...f, competencia: e.target.value }))}
            className="w-36"
            data-testid="input-dre-competencia"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Projeto</Label>
          <Select value={filtros.projetoId} onValueChange={v => setFiltros(f => ({ ...f, projetoId: v }))}>
            <SelectTrigger className="w-48" data-testid="select-dre-projeto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os projetos</SelectItem>
              {projetos.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.numero} — {p.titulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs totais */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Receita Total</p>
              <p className="text-xl font-bold text-green-600">{fmtBRL(totais.receita_bruta)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Custos Diretos</p>
              <p className="text-xl font-bold text-red-500">{fmtBRL(totais.custos_diretos)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Margem Bruta</p>
              <p className="text-xl font-bold text-blue-600">{fmtBRL(totais.margem_bruta)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Margem %</p>
              <div className="flex items-center gap-1">
                {margemTotal != null && (margemTotal >= 0
                  ? <TrendingUp className="h-4 w-4 text-green-500" />
                  : <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <p className={`text-xl font-bold ${margemTotal == null ? "" : margemTotal >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {fmtPct(margemTotal)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela DRE */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Custos</TableHead>
                  <TableHead className="text-right">Margem Bruta</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.projeto_id} data-testid={`row-dre-${r.projeto_id}`}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground mr-1">{r.projeto_numero}</span>
                      <span className="font-medium">{r.projeto_titulo}</span>
                    </TableCell>
                    <TableCell className="text-right text-green-600">{fmtBRL(r.receita_bruta)}</TableCell>
                    <TableCell className="text-right text-red-500">{fmtBRL(r.custos_diretos)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(r.margem_bruta)}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={`${r.margem_bruta_pct != null && r.margem_bruta_pct >= 20 ? "bg-green-500" : r.margem_bruta_pct != null && r.margem_bruta_pct >= 10 ? "bg-yellow-500" : "bg-red-500"} text-white`}>
                        {fmtPct(r.margem_bruta_pct)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      <span className={r.resultado >= 0 ? "text-green-600" : "text-red-500"}>
                        {fmtBRL(r.resultado)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum dado para a competência selecionada. Verifique se há lançamentos vinculados a projetos.
                    </TableCell>
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
