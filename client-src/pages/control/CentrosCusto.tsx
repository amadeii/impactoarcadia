// Sprint C6 — Página de Centros de Custo dinâmicos.
// CRUD completo + import CSV + visualização de hierarquia + indicador de orçamento.

import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Plus, Pencil, Trash2, Search, Upload, Building2, FolderTree,
  Briefcase, Activity as ActivityIcon, AlertCircle, CheckCircle2, Zap,
} from "lucide-react";

interface Cliente { id: string; nome: string; }

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  tipo: "departamento" | "projeto" | "atividade";
  parentId?: string | null;
  responsavel?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  orcamentoAnual?: string | null;
  cor?: string | null;
  marcaRateio?: boolean;
  centroCustoRaiz?: boolean;
}

interface OrcamentoMes { ano: number; mes: number; utilizado: number; lancamentos: number; }

const TIPOS = [
  { value: "departamento", label: "Departamento", icon: Building2, cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
  { value: "projeto", label: "Projeto", icon: Briefcase, cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  { value: "atividade", label: "Atividade", icon: ActivityIcon, cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
];
const tipoMeta = (t: string) => TIPOS.find((x) => x.value === t) ?? TIPOS[0];

const NONE = "__none__";
const formatBRL = (v: number | string | null | undefined) => {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
};

interface FormState {
  id?: string;
  codigo: string;
  nome: string;
  descricao: string;
  tipo: "departamento" | "projeto" | "atividade";
  parentId: string | null;
  responsavel: string;
  dataInicio: string;
  dataFim: string;
  orcamentoAnual: string;
  cor: string;
  ativo: boolean;
  marcaRateio: boolean;
  centroCustoRaiz: boolean;
}
const emptyForm: FormState = {
  codigo: "", nome: "", descricao: "", tipo: "departamento", parentId: null,
  responsavel: "", dataInicio: "", dataFim: "", orcamentoAnual: "", cor: "#6366f1", ativo: true,
  marcaRateio: false,
  centroCustoRaiz: false,
};

export default function CentrosCusto() {
  const [location] = useLocation();
  const clienteId = location.split('/').filter(Boolean)[1] ?? '';
  const { toast } = useToast();

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [openForm, setOpenForm] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: clientes = [] } = useQuery<Cliente[]>({ queryKey: ["/api/clients"] });
  const cliente = clientes.find((c) => c.id === clienteId);

  const { data: ccs = [], isLoading } = useQuery<CentroCusto[]>({
    queryKey: ["/api/control/clientes", clienteId, "centros-custo"],
    enabled: !!clienteId,
  });

  // Hierarquia: ordena por código e calcula nivel (profundidade)
  const ccsAdornados = useMemo(() => {
    const byId = new Map(ccs.map((c) => [c.id, c]));
    const profundidade = (cc: CentroCusto): number => {
      let depth = 0;
      let cur = cc;
      const visited = new Set<string>();
      while (cur.parentId && !visited.has(cur.id)) {
        visited.add(cur.id);
        const parent = byId.get(cur.parentId);
        if (!parent) break;
        depth++;
        cur = parent;
        if (depth > 10) break;
      }
      return depth;
    };
    return ccs.map((c) => ({ ...c, _depth: profundidade(c) }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
  }, [ccs]);

  const ccsFiltrados = useMemo(() => {
    return ccsAdornados.filter((c) => {
      if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
      if (filtroStatus === "ativos" && !c.ativo) return false;
      if (filtroStatus === "inativos" && c.ativo) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (!c.codigo.toLowerCase().includes(q) && !c.nome.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [ccsAdornados, busca, filtroTipo, filtroStatus]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (form.id) {
        return await apiRequest("PATCH", `/api/control/centros-custo/${form.id}`, payload);
      }
      return await apiRequest("POST", `/api/control/clientes/${clienteId}/centros-custo`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"] });
      toast({ title: form.id ? "CC atualizado" : "CC criado" });
      setOpenForm(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falhou", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/control/centros-custo/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"] });
      toast({ title: "CC excluído" });
    },
    onError: (e: any) => toast({ title: "Não foi possível excluir", description: e?.message, variant: "destructive" }),
  });

  function abrirNovo() {
    setForm(emptyForm);
    setOpenForm(true);
  }
  function abrirEditar(c: CentroCusto) {
    setForm({
      id: c.id,
      codigo: c.codigo,
      nome: c.nome,
      descricao: c.descricao ?? "",
      tipo: c.tipo,
      parentId: c.parentId ?? null,
      responsavel: c.responsavel ?? "",
      dataInicio: c.dataInicio ?? "",
      dataFim: c.dataFim ?? "",
      orcamentoAnual: c.orcamentoAnual ?? "",
      cor: c.cor ?? "#6366f1",
      ativo: c.ativo,
      marcaRateio: c.marcaRateio ?? false,
      centroCustoRaiz: c.centroCustoRaiz ?? false,
    });
    setOpenForm(true);
  }

  function submitForm(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.codigo.trim() || !form.nome.trim()) {
      toast({ title: "Código e nome são obrigatórios", variant: "destructive" });
      return;
    }
    if (form.tipo === "projeto" && (!form.dataInicio || !form.dataFim)) {
      toast({ title: "Projeto exige data de início e fim", variant: "destructive" });
      return;
    }
    const payload: any = {
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      tipo: form.tipo,
      parentId: form.parentId || null,
      responsavel: form.responsavel.trim() || null,
      dataInicio: form.dataInicio || null,
      dataFim: form.dataFim || null,
      orcamentoAnual: form.orcamentoAnual ? form.orcamentoAnual : null,
      cor: form.cor,
      ativo: form.ativo,
      marcaRateio: form.marcaRateio,
      centroCustoRaiz: form.centroCustoRaiz,
    };
    saveMutation.mutate(payload);
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/control/${clienteId}`}>
            <Button variant="ghost" size="sm" data-testid="control-cc-button-voltar">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderTree className="h-6 w-6" /> Centros de Custo
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-cliente-nome">
              {cliente?.nome ?? "Carregando…"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenImport(true)} data-testid="control-cc-button-import">
            <Upload className="h-4 w-4 mr-1" /> Importar CSV
          </Button>
          <Button onClick={abrirNovo} data-testid="control-cc-button-novo">
            <Plus className="h-4 w-4 mr-1" /> Novo CC
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código ou nome…"
              className="pl-8"
              data-testid="input-busca-cc"
            />
          </div>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger data-testid="select-filtro-tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger data-testid="select-filtro-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativos">Apenas ativos</SelectItem>
              <SelectItem value="inativos">Apenas inativos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Lista</CardTitle>
            <CardDescription>{ccsFiltrados.length} de {ccs.length} centros</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : ccsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum centro de custo encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Orçamento Anual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[110px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ccsFiltrados.map((c) => {
                  const meta = tipoMeta(c.tipo);
                  const Icon = meta.icon;
                  const indent = (c as any)._depth as number;
                  return (
                    <TableRow key={c.id} data-testid={`row-cc-${c.id}`}>
                      <TableCell className="font-mono text-sm">{c.codigo}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" style={{ paddingLeft: `${indent * 16}px` }}>
                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.cor ?? "#6366f1" }} />
                          <span data-testid={`text-cc-nome-${c.id}`}>{c.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={meta.cls}>
                          <Icon className="h-3 w-3 mr-1" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{c.responsavel || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {c.dataInicio || c.dataFim ? (
                          <span>{c.dataInicio ?? "?"} → {c.dataFim ?? "?"}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{c.orcamentoAnual ? formatBRL(c.orcamentoAnual) : "—"}</TableCell>
                      <TableCell>
                        {c.ativo
                          ? <Badge variant="outline" className="text-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Ativo</Badge>
                          : <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
                        {c.marcaRateio && (
                          <Badge variant="outline" className="text-yellow-600 ml-1">
                            <Zap className="h-3 w-3 mr-1" /> Rateio
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => abrirEditar(c)} data-testid={`button-editar-cc-${c.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Excluir CC ${c.codigo} - ${c.nome}?`)) deleteMutation.mutate(c.id);
                            }}
                            data-testid={`button-excluir-cc-${c.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Código *</Label>
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} data-testid="input-cc-codigo" />
            </div>
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} data-testid="input-cc-nome" />
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                <SelectTrigger data-testid="select-cc-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>CC Pai (hierarquia)</Label>
              <Select
                value={form.parentId ?? NONE}
                onValueChange={(v) => setForm({ ...form, parentId: v === NONE ? null : v })}
              >
                <SelectTrigger data-testid="select-cc-parent"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Sem pai —</SelectItem>
                  {ccs.filter((c) => c.id !== form.id).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} data-testid="input-cc-responsavel" />
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={form.cor}
                  onChange={(e) => setForm({ ...form, cor: e.target.value })}
                  className="h-10 w-16 rounded border bg-background"
                  data-testid="input-cc-cor"
                />
                <Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="font-mono text-sm" />
              </div>
            </div>
            {form.tipo === "projeto" && (
              <>
                <div className="space-y-1">
                  <Label>Data de Início *</Label>
                  <Input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} data-testid="input-cc-data-inicio" />
                </div>
                <div className="space-y-1">
                  <Label>Data de Fim *</Label>
                  <Input type="date" value={form.dataFim} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} data-testid="input-cc-data-fim" />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label>Orçamento Anual (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.orcamentoAnual}
                onChange={(e) => setForm({ ...form, orcamentoAnual: e.target.value })}
                data-testid="input-cc-orcamento"
              />
            </div>
            <div className="col-span-2 grid grid-cols-3 gap-4 pt-2 border-t">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  id="cc-ativo"
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                  data-testid="switch-cc-ativo"
                />
                <span>
                  <span className="font-medium">Ativo</span>
                  <p className="text-xs text-muted-foreground font-normal">CC habilitado para lançamentos</p>
                </span>
              </Label>
              <Label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  id="cc-marca-rateio"
                  checked={form.marcaRateio}
                  onCheckedChange={(v) => setForm({ ...form, marcaRateio: v })}
                  data-testid="switch-marca-rateio"
                />
                <span>
                  <span className="font-medium">Rateio compartilhado</span>
                  <p className="text-xs text-muted-foreground font-normal">Impacto ↔ SAF</p>
                </span>
              </Label>
              <Label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  id="cc-raiz"
                  checked={form.centroCustoRaiz}
                  onCheckedChange={(v) => setForm({ ...form, centroCustoRaiz: v })}
                  data-testid="switch-cc-raiz"
                />
                <span>
                  <span className="font-medium">CC Raiz (agrupador)</span>
                  <p className="text-xs text-muted-foreground font-normal">Não aceita lançamentos diretos</p>
                </span>
              </Label>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} />
            </div>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-salvar-cc">
                {saveMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportDialog open={openImport} onOpenChange={setOpenImport} clienteId={clienteId!} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Import CSV — colar texto ou upload .csv. Cabeçalho:
// codigo;nome;tipo;responsavel;parentCodigo;orcamentoAnual;cor;dataInicio;dataFim
// Aceita ; ou , como separador.
// ─────────────────────────────────────────────────────────────────────────────
function ImportDialog({ open, onOpenChange, clienteId }: { open: boolean; onOpenChange: (o: boolean) => void; clienteId: string }) {
  const { toast } = useToast();
  const [csv, setCsv] = useState("");
  const [report, setReport] = useState<any | null>(null);

  const importMutation = useMutation({
    mutationFn: async (rows: any[]) =>
      await apiRequest("POST", `/api/control/clientes/${clienteId}/centros-custo/import`, { rows }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setReport(data);
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"] });
      toast({ title: `Import concluído: ${data.criados} criados, ${data.atualizados} atualizados, ${data.erros.length} erros` });
    },
    onError: (e: any) => toast({ title: "Falha no import", description: e?.message, variant: "destructive" }),
  });

  function parseCsv(text: string): any[] {
    const linhas = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (linhas.length < 2) return [];
    const sep = linhas[0].includes(";") ? ";" : ",";
    const header = linhas[0].split(sep).map((h) => h.trim());
    return linhas.slice(1).map((l) => {
      const cols = l.split(sep);
      const row: any = {};
      header.forEach((h, i) => {
        const v = (cols[i] ?? "").trim();
        if (v !== "") row[h] = v;
      });
      return row;
    });
  }

  function handleImport() {
    const rows = parseCsv(csv);
    if (rows.length === 0) {
      toast({ title: "CSV vazio ou inválido", variant: "destructive" });
      return;
    }
    setReport(null);
    importMutation.mutate(rows);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setCsv(""); setReport(null); } }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Centros de Custo (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cabeçalho aceito: <code className="text-xs">codigo;nome;tipo;responsavel;parentCodigo;orcamentoAnual;cor;dataInicio;dataFim</code>.
            Use <code>;</code> ou <code>,</code> como separador. Códigos existentes são atualizados.
          </p>
          <Textarea
            rows={10}
            placeholder={"codigo;nome;tipo;responsavel\n01;Diretoria;departamento;Ana\n02;Comercial;departamento;Bruno"}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            className="font-mono text-xs"
            data-testid="textarea-import-csv"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={handleImport} disabled={importMutation.isPending} data-testid="button-importar-csv">
              {importMutation.isPending ? "Importando…" : "Importar"}
            </Button>
          </div>
          {report && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resultado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>Criados: <strong>{report.criados}</strong> · Atualizados: <strong>{report.atualizados}</strong> · Erros: <strong>{report.erros.length}</strong></div>
                {report.erros.length > 0 && (
                  <div className="max-h-48 overflow-auto border rounded p-2 space-y-1">
                    {report.erros.map((e: any, i: number) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        <span><strong>linha {e.linha} ({e.codigo}):</strong> {e.mensagem}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
