/**
 * Sprint C-E09 — Grupo Econômico e Consolidação
 * Acesso restrito a partner_admin ou master_admin
 */
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import {
  ArrowLeft, Building2, TrendingUp, TrendingDown,
  BarChart3, DollarSign, AlertTriangle, Loader2
} from "lucide-react";

interface DreLinha {
  grupo_dre: string;
  impacto: number;
  saf: number;
  eliminacoes: number;
  consolidado: number;
}

interface DreConsolidado {
  grupoId: string;
  grupoNome: string;
  periodo: string;
  receita_bruta: number;
  resultado: number;
  margem_pct: number | null;
  linhas: DreLinha[];
  eliminacoes_total: number;
}

interface FluxoLinha {
  mes: string;
  impacto_entrada: number;
  impacto_saida: number;
  saf_entrada: number;
  saf_saida: number;
  consolidado_liquido: number;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number | null) => v == null ? "—" : `${v.toFixed(1)}%`;

export default function GrupoConsolidado() {
  const [location] = useLocation();
  const grupoId = location.split('/').filter(Boolean)[2] ?? '';
  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState(String(currentYear));
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));

  const { data: dre, isLoading: loadingDre } = useQuery<DreConsolidado>({
    queryKey: ["/api/control/grupos", grupoId, "dre-consolidado", ano, mes],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/control/grupos/${grupoId}/dre-consolidado?ano=${ano}&mes=${mes}`);
      return r.json();
    },
    enabled: !!grupoId,
  });

  const { data: fluxo = [], isLoading: loadingFluxo } = useQuery<FluxoLinha[]>({
    queryKey: ["/api/control/grupos", grupoId, "fluxo-consolidado", ano],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/control/grupos/${grupoId}/fluxo-caixa-consolidado?ano=${ano}`);
      return r.json();
    },
    enabled: !!grupoId,
  });

  return (
    <BrowserFrame>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/control"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-purple-600" />
              {dre?.grupoNome ?? "Grupo Econômico"}
            </h1>
            <p className="text-muted-foreground text-sm">
              Visão consolidada Impacto + SAF — eliminações intercompany aplicadas
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Ano todo</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i).toLocaleString("pt-BR", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        {dre && (
          <div className="grid grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Receita Consolidada</p>
                <p className="text-xl font-bold text-green-600">{fmtBRL(dre.receita_bruta)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Resultado Líquido</p>
                <div className="flex items-center gap-1">
                  {dre.resultado >= 0
                    ? <TrendingUp className="h-4 w-4 text-green-500" />
                    : <TrendingDown className="h-4 w-4 text-red-500" />
                  }
                  <p className={`text-xl font-bold ${dre.resultado >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {fmtBRL(dre.resultado)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Margem Líquida</p>
                <p className={`text-xl font-bold ${dre.margem_pct != null && dre.margem_pct >= 0 ? "text-blue-600" : "text-red-500"}`}>
                  {fmtPct(dre.margem_pct)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" /> Eliminações
                </p>
                <p className="text-xl font-bold text-yellow-600">{fmtBRL(dre.eliminacoes_total)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="dre">
          <TabsList>
            <TabsTrigger value="dre" className="gap-1"><BarChart3 className="h-4 w-4" /> DRE Consolidado</TabsTrigger>
            <TabsTrigger value="fluxo" className="gap-1"><TrendingUp className="h-4 w-4" /> Fluxo de Caixa</TabsTrigger>
          </TabsList>

          {/* DRE */}
          <TabsContent value="dre">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">DRE Consolidado — Impacto + SAF (eliminações intercompany)</CardTitle>
                <CardDescription className="text-xs">
                  Lançamentos entre Impacto e SAF são neutralizados. Vibra aparece apenas como cliente externo.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingDre ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grupo DRE</TableHead>
                        <TableHead className="text-right">Impacto</TableHead>
                        <TableHead className="text-right">SAF</TableHead>
                        <TableHead className="text-right text-yellow-600">Eliminações</TableHead>
                        <TableHead className="text-right font-bold">Consolidado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(dre?.linhas ?? []).map((l, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium capitalize">{l.grupo_dre.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-right text-sm">{fmtBRL(l.impacto)}</TableCell>
                          <TableCell className="text-right text-sm">{fmtBRL(l.saf)}</TableCell>
                          <TableCell className="text-right text-sm text-yellow-600">
                            {l.eliminacoes !== 0 ? `(${fmtBRL(Math.abs(l.eliminacoes))})` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{fmtBRL(l.consolidado)}</TableCell>
                        </TableRow>
                      ))}
                      {(!dre?.linhas || dre.linhas.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                            Sem dados para o período selecionado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fluxo */}
          <TabsContent value="fluxo">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Fluxo de Caixa Consolidado — {ano}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingFluxo ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">Impacto Entrada</TableHead>
                        <TableHead className="text-right">Impacto Saída</TableHead>
                        <TableHead className="text-right">SAF Entrada</TableHead>
                        <TableHead className="text-right">SAF Saída</TableHead>
                        <TableHead className="text-right font-bold">Saldo Consolidado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fluxo.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell>{l.mes}</TableCell>
                          <TableCell className="text-right text-green-600">{fmtBRL(l.impacto_entrada)}</TableCell>
                          <TableCell className="text-right text-red-500">{fmtBRL(l.impacto_saida)}</TableCell>
                          <TableCell className="text-right text-green-600">{fmtBRL(l.saf_entrada)}</TableCell>
                          <TableCell className="text-right text-red-500">{fmtBRL(l.saf_saida)}</TableCell>
                          <TableCell className={`text-right font-bold ${l.consolidado_liquido >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {fmtBRL(l.consolidado_liquido)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {fluxo.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                            Sem dados para o ano selecionado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </BrowserFrame>
  );
}
