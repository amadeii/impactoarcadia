// Sprint C8 — Orçamento mensal por conta (Realizado × Previsto).
// Layout inspirado no MetaReceitas/MetaDespesas da planilha Impacto:
// linhas = contas analíticas, colunas = Jan..Dez. Edição inline com
// salvamento em lote. Aba "Comparativo" mostra Realizado × Previsto
// agregado por mês ou ano todo.

import { useState, useMemo, useRef, Fragment } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Upload, Download, AlertTriangle, BarChart3, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

interface Cliente { id: string; name: string; }
interface MatrizLinha {
  planoContaId: string;
  codigo: string;
  descricao: string;
  natureza: string;
  grupoDre: string | null;
  meses: Record<number, string>;
  detalhes: Array<{ id: string; mes: number; valor: string; centroCustoId: string | null }>;
}
interface Matriz { ano: number; contas: MatrizLinha[]; }
interface ComparativoLinha {
  planoContaId: string;
  codigo: string;
  conta: string;
  natureza: string;
  grupoDre: string | null;
  previsto: number;
  realizado: number;
  desvio: number;
  desvioPerc: number | null;
  alerta: boolean;
  threshold: number;
}
interface Comparativo { ano: number; mes: number | null; threshold: number; linhas: ComparativoLinha[]; }

const MESES_LABEL = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const formatBRL = (v?: string | number | null) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
};
const parseValor = (s: string): number => {
  if (!s) return 0;
  const norm = s.replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(norm);
  return isNaN(n) ? 0 : n;
};

const NATUREZAS_DRE = ["receita", "custo", "despesa"];

export default function Orcamento() {
  const [location] = useLocation();
  const clienteId = location.split('/').filter(Boolean)[1] ?? '';
  const { toast } = useToast();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [filtroNatureza, setFiltroNatureza] = useState<string>("todas");
  const [pending, setPending] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRefPlanilha = useRef<HTMLInputElement>(null);

  const { data: clientes = [] } = useQuery<Cliente[]>({ queryKey: ["/api/clients"] });
  const cliente = clientes.find((c) => c.id === clienteId);

  const { data: matriz, isLoading } = useQuery<Matriz>({
    queryKey: ["/api/control/clientes", clienteId, "orcamento", ano],
    queryFn: async () => {
      const r = await fetch(`/api/control/clientes/${clienteId}/orcamento?ano=${ano}`, { credentials: "include" });
      if (!r.ok) throw new Error("Falha ao carregar orçamento");
      return r.json();
    },
    enabled: !!clienteId,
  });

  const linhas = useMemo(() => {
    if (!matriz) return [] as MatrizLinha[];
    return matriz.contas.filter((c) => filtroNatureza === "todas" || c.natureza === filtroNatureza);
  }, [matriz, filtroNatureza]);

  const totaisMes = useMemo(() => {
    const tot: Record<number, number> = {};
    linhas.forEach((l) => {
      for (let m = 1; m <= 12; m++) {
        const key = `${l.planoContaId}:${m}`;
        const valor = pending[key] !== undefined ? parseValor(pending[key]) : Number(l.meses[m] ?? 0);
        tot[m] = (tot[m] ?? 0) + valor;
      }
    });
    return tot;
  }, [linhas, pending]);

  const setCell = (planoContaId: string, mes: number, valor: string) => {
    setPending((p) => ({ ...p, [`${planoContaId}:${mes}`]: valor }));
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const items = Object.entries(pending).map(([k, v]) => {
        const [planoContaId, mesStr] = k.split(":");
        return {
          planoContaId,
          centroCustoId: null,
          ano,
          mes: Number(mesStr),
          valorPrevisto: parseValor(v),
        };
      });
      if (items.length === 0) return { ok: true, processados: 0 };
      return apiRequest("POST", `/api/control/clientes/${clienteId}/orcamento`, { items });
    },
    onSuccess: (r: any) => {
      toast({ title: "Orçamento salvo", description: `${r?.processados ?? 0} células atualizadas` });
      setPending({});
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "orcamento", ano] });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "orcamento", "comparativo"] });
    },
    onError: (e: any) => toast({ title: "Falha ao salvar", description: e?.message, variant: "destructive" }),
  });

  function exportarTemplate() {
    const cabecalho = ["codigo", "conta", ...MESES_LABEL];
    const rows = linhas.map((l) => {
      const obj: Record<string, any> = { codigo: l.codigo, conta: l.descricao };
      for (let m = 1; m <= 12; m++) obj[MESES_LABEL[m - 1]] = Number(l.meses[m] ?? 0);
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header: cabecalho });
    ws["!cols"] = cabecalho.map((c, i) => ({ wch: i === 0 ? 12 : i === 1 ? 40 : 12 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Orcamento_${ano}`);
    XLSX.writeFile(wb, `orcamento-${ano}.xlsx`);
  }

  async function importarPlanilha(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const codigosMap = new Map(matriz?.contas.map((c) => [String(c.codigo).trim(), c.planoContaId]) ?? []);
      const items: any[] = [];
      let ignoradas = 0;
      for (const r of rows) {
        const codigo = String(r.codigo ?? r.Codigo ?? r.Código ?? "").trim();
        const planoContaId = codigosMap.get(codigo);
        if (!planoContaId) { ignoradas++; continue; }
        for (let m = 1; m <= 12; m++) {
          const label = MESES_LABEL[m - 1];
          const raw = r[label] ?? r[label.toLowerCase()] ?? r[String(m)];
          if (raw === "" || raw == null) continue;
          const valor = typeof raw === "number" ? raw : parseValor(String(raw));
          items.push({ planoContaId, centroCustoId: null, ano, mes: m, valorPrevisto: valor });
        }
      }
      if (items.length === 0) {
        toast({ title: "Planilha sem linhas válidas", description: `${ignoradas} código(s) não bateram com o plano de contas`, variant: "destructive" });
        return;
      }
      await apiRequest("POST", `/api/control/clientes/${clienteId}/orcamento`, { items });
      toast({ title: "Orçamento importado", description: `${items.length} célula(s) atualizadas (${ignoradas} código(s) ignorados)` });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "orcamento", ano] });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "orcamento", "comparativo"] });
    } catch (e: any) {
      toast({ title: "Erro no import", description: e?.message, variant: "destructive" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function importarPlanilhaImpacto(file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(
        `/api/control/clientes/${clienteId}/orcamento/import-planilha?ano=${ano}`,
        { method: "POST", body: fd, credentials: "include" },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.message ?? "Falha no servidor");
      toast({
        title: "Planilha importada!",
        description: `${data.matched ?? 0} contas mapeadas · ${data.valoresUpsertados ?? 0} valores inseridos (${data.skipped ?? 0} sem correspondência)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "orcamento", ano] });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "orcamento", "comparativo"] });
    } catch (e: any) {
      toast({ title: "Erro ao importar planilha", description: e?.message, variant: "destructive" });
    } finally {
      if (fileRefPlanilha.current) fileRefPlanilha.current.value = "";
    }
  }

  const dirty = Object.keys(pending).length;

  return (
    <div className="p-6 space-y-4 min-h-screen bg-background">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href={`/control/${clienteId}`}>
            <Button variant="ghost" size="sm" data-testid="link-back-control">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Orçamento mensal — {cliente?.name ?? "..."}</h1>
          <p className="text-sm text-muted-foreground">Defina metas por conta e mês. Compare com o realizado.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => { setAno(Number(v)); setPending({}); }}>
              <SelectTrigger className="w-28" data-testid="select-ano"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importarPlanilha(f); }}
            data-testid="input-file-import"
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="button-importar-xlsx">
            <Upload className="h-4 w-4 mr-1" /> Importar XLSX
          </Button>
          <Button variant="outline" onClick={exportarTemplate} data-testid="button-exportar-template">
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <input
            ref={fileRefPlanilha}
            type="file"
            accept=".xlsm,.xlsx,.xls,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importarPlanilhaImpacto(f); }}
            data-testid="input-file-import-planilha"
          />
          <Button variant="outline" onClick={() => fileRefPlanilha.current?.click()} data-testid="button-importar-planilha-impacto">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Planilha Impacto
          </Button>
        </div>
      </div>

      <Tabs defaultValue="meta">
        <TabsList>
          <TabsTrigger value="meta" data-testid="tab-meta"><FileSpreadsheet className="h-4 w-4 mr-1" /> Metas</TabsTrigger>
          <TabsTrigger value="comparativo" data-testid="tab-comparativo"><BarChart3 className="h-4 w-4 mr-1" /> Realizado × Previsto</TabsTrigger>
        </TabsList>

        <TabsContent value="meta">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <CardTitle className="text-base">Matriz de orçamento — {ano}</CardTitle>
                <div className="flex gap-2 items-center">
                  <Select value={filtroNatureza} onValueChange={setFiltroNatureza}>
                    <SelectTrigger className="w-44" data-testid="select-natureza"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as naturezas</SelectItem>
                      {NATUREZAS_DRE.map((n) => (
                        <SelectItem key={n} value={n}>{n[0].toUpperCase() + n.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => salvar.mutate()} disabled={!dirty || salvar.isPending} data-testid="button-salvar-orcamento">
                    <Save className="h-4 w-4 mr-1" /> Salvar {dirty > 0 ? `(${dirty})` : ""}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : linhas.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma conta analítica encontrada para a natureza filtrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Código</TableHead>
                        <TableHead className="min-w-[220px]">Conta</TableHead>
                        {MESES_LABEL.map((m) => (
                          <TableHead key={m} className="w-24 text-right">{m}</TableHead>
                        ))}
                        <TableHead className="w-28 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.map((l) => {
                        let totalLinha = 0;
                        return (
                          <TableRow key={l.planoContaId} data-testid={`row-orcamento-${l.planoContaId}`}>
                            <TableCell className="font-mono">{l.codigo}</TableCell>
                            <TableCell className="truncate max-w-[260px]" title={l.descricao}>{l.descricao}</TableCell>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => {
                              const key = `${l.planoContaId}:${mes}`;
                              const persisted = Number(l.meses[mes] ?? 0);
                              const valor = pending[key] !== undefined ? pending[key] : (persisted > 0 ? String(persisted) : "");
                              const num = pending[key] !== undefined ? parseValor(pending[key]) : persisted;
                              totalLinha += num;
                              const dirtyCell = pending[key] !== undefined;
                              return (
                                <TableCell key={mes} className="p-1">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={valor}
                                    placeholder="0"
                                    onChange={(e) => setCell(l.planoContaId, mes, e.target.value)}
                                    className={`h-7 text-right text-xs px-1 ${dirtyCell ? "ring-1 ring-amber-500" : ""}`}
                                    data-testid={`input-celula-${l.planoContaId}-${mes}`}
                                  />
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right font-medium">{formatBRL(totalLinha)}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell colSpan={2}>Total geral</TableCell>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <TableCell key={m} className="text-right">{formatBRL(totaisMes[m] ?? 0)}</TableCell>
                        ))}
                        <TableCell className="text-right">{formatBRL(Object.values(totaisMes).reduce((a, b) => a + b, 0))}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparativo">
          <ComparativoView clienteId={clienteId!} ano={ano} setAno={setAno} anoAtual={anoAtual} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ComparativoView({ clienteId, ano, setAno, anoAtual }: { clienteId: string; ano: number; setAno: (n: number) => void; anoAtual: number }) {
  const [mes, setMes] = useState<string>("0");
  const [threshold, setThreshold] = useState(15);
  const [gruposColapsados, setGruposColapsados] = useState<Set<string>>(new Set());

  const toggleGrupo = (grupo: string) =>
    setGruposColapsados((prev) => {
      const next = new Set(prev);
      next.has(grupo) ? next.delete(grupo) : next.add(grupo);
      return next;
    });

  const { data, isLoading } = useQuery<Comparativo>({
    queryKey: ["/api/control/clientes", clienteId, "orcamento", "comparativo", ano, mes, threshold],
    queryFn: async () => {
      const params = new URLSearchParams({ ano: String(ano), threshold: String(threshold) });
      if (mes !== "0") params.set("mes", mes);
      const r = await fetch(`/api/control/clientes/${clienteId}/orcamento/comparativo?${params.toString()}`, { credentials: "include" });
      if (!r.ok) throw new Error("Falha ao carregar comparativo");
      return r.json();
    },
  });

  const totais = useMemo(() => {
    const linhas = data?.linhas ?? [];
    const previsto  = linhas.reduce((a, b) => a + Number(b.previsto),  0);
    const realizado = linhas.reduce((a, b) => a + Number(b.realizado), 0);
    const desvio = realizado - previsto;
    const pct = previsto === 0 ? null : (desvio / previsto) * 100;
    return { previsto, realizado, desvio, pct };
  }, [data]);

  const linhasAgrupadas = useMemo(() => {
    const linhas = data?.linhas ?? [];
    const grupos = new Map<string, ComparativoLinha[]>();
    for (const l of linhas) {
      const chave = l.grupoDre ?? l.natureza ?? "Outros";
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(l);
    }
    return grupos;
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-end flex-wrap gap-3">
          <CardTitle className="text-base">Comparativo Realizado × Previsto</CardTitle>
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs">Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
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
                  {MESES_LABEL.map((m, i) => (<SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Alerta {">"} %</Label>
              <Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value) || 15)} className="w-20" data-testid="input-threshold" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (data?.linhas?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma conta com orçamento ou realizado no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Código</TableHead>
                <TableHead>Conta / Grupo</TableHead>
                <TableHead className="text-right">Previsto</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Desvio</TableHead>
                <TableHead className="text-right">% Desvio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(linhasAgrupadas.entries()).map(([grupo, linhasGrupo]) => {
                const sub = linhasGrupo.reduce(
                  (acc, l) => ({
                    previsto:  acc.previsto  + Number(l.previsto),
                    realizado: acc.realizado + Number(l.realizado),
                    desvio:    acc.desvio    + Number(l.desvio),
                  }),
                  { previsto: 0, realizado: 0, desvio: 0 },
                );
                const subPct = sub.previsto === 0 ? null : (sub.desvio / sub.previsto) * 100;
                const temAlerta = linhasGrupo.some((l) => l.alerta);
                const colapsado = gruposColapsados.has(grupo);
                return (
                  <Fragment key={`grupo-${grupo}`}>
                    <TableRow
                      className="bg-muted/40 cursor-pointer hover:bg-muted/60 select-none"
                      onClick={() => toggleGrupo(grupo)}
                      data-testid={`row-grupo-${grupo}`}
                    >
                      <TableCell colSpan={2} className="font-semibold text-sm py-2">
                        <span className="mr-2 text-muted-foreground text-xs">{colapsado ? "▶" : "▼"}</span>
                        {grupo}
                        {temAlerta && <AlertTriangle className="h-3 w-3 text-red-500 inline ml-2" />}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatBRL(sub.previsto)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatBRL(sub.realizado)}</TableCell>
                      <TableCell className={`text-right font-semibold ${sub.desvio > 0 ? "text-amber-600" : sub.desvio < 0 ? "text-emerald-600" : ""}`}>
                        {formatBRL(sub.desvio)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {subPct === null ? "—" : `${subPct.toFixed(1)}%`}
                      </TableCell>
                    </TableRow>
                    {!colapsado && linhasGrupo.map((l) => (
                      <TableRow key={l.planoContaId} className="text-xs" data-testid={`row-comparativo-${l.planoContaId}`}>
                        <TableCell className="font-mono pl-8 text-muted-foreground">{l.codigo}</TableCell>
                        <TableCell className="pl-4">{l.conta}</TableCell>
                        <TableCell className="text-right">{formatBRL(l.previsto)}</TableCell>
                        <TableCell className="text-right">{formatBRL(l.realizado)}</TableCell>
                        <TableCell className={`text-right ${l.desvio < 0 ? "text-emerald-600 dark:text-emerald-400" : l.desvio > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                          {formatBRL(l.desvio)}
                        </TableCell>
                        <TableCell className="text-right">
                          {l.desvioPerc === null ? <span className="text-muted-foreground">—</span> : (
                            <span className={l.alerta ? "text-red-600 dark:text-red-400 font-medium inline-flex items-center gap-1" : ""}>
                              {l.alerta && <AlertTriangle className="h-3 w-3" />}
                              {l.desvioPerc.toFixed(1)}%
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">{formatBRL(totais.previsto)}</TableCell>
                <TableCell className="text-right">{formatBRL(totais.realizado)}</TableCell>
                <TableCell className="text-right">{formatBRL(totais.desvio)}</TableCell>
                <TableCell className="text-right">{totais.pct === null ? "—" : `${totais.pct.toFixed(1)}%`}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
