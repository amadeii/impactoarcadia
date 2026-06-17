import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, ChevronRight, ChevronDown, Search } from "lucide-react";

interface PlanoConta {
  id: string;
  codigo: string;
  descricao: string;
  natureza: string;
  permiteLancamento: boolean;
  nivel: number;
  ativo: boolean;
  parentId: string | null;
  naturezaDre?: string | null;
}

interface UsoConta { id: string; qtd: number; total: number; }

const NATUREZAS = [
  { value: "ativo", label: "Ativo" },
  { value: "passivo", label: "Passivo" },
  { value: "patrimonio_liquido", label: "Patrimônio Líquido" },
  { value: "receita", label: "Receita" },
  { value: "custo", label: "Custo" },
  { value: "despesa", label: "Despesa" },
  { value: "resultado", label: "Resultado" },
];

const naturezaCor: Record<string, string> = {
  ativo: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  passivo: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  patrimonio_liquido: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  receita: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  custo: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  despesa: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  resultado: "bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200",
};

const NONE = "__none__";
const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface FormState {
  id?: string;
  codigo: string;
  descricao: string;
  natureza: string;
  parentId: string | null;
  permiteLancamento: boolean;
  ativo: boolean;
  naturezaDre: string;
}

const formVazio: FormState = {
  codigo: "",
  descricao: "",
  natureza: "despesa",
  parentId: null,
  permiteLancamento: true,
  ativo: true,
  naturezaDre: "",
};

export default function PlanoContasTab({ clienteId }: { clienteId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroNatureza, setFiltroNatureza] = useState<string>("todas");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(formVazio);

  const { data: contas = [], isLoading } = useQuery<PlanoConta[]>({
    queryKey: ["/api/control/planos-contas"],
  });
  const { data: uso = [] } = useQuery<UsoConta[]>({
    queryKey: ["/api/control/planos-contas/uso"],
  });

  const usoPorConta = useMemo(() => {
    const m = new Map<string, UsoConta>();
    uso.forEach((u) => m.set(u.id, u));
    return m;
  }, [uso]);

  // Hierarquia: contas filhos por pai
  const filhosPorPai = useMemo(() => {
    const m = new Map<string | null, PlanoConta[]>();
    contas.forEach((c) => {
      const arr = m.get(c.parentId) ?? [];
      arr.push(c);
      m.set(c.parentId, arr);
    });
    // Ordena cada grupo pelo código
    m.forEach((arr) => arr.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })));
    return m;
  }, [contas]);

  const raizes = filhosPorPai.get(null) ?? [];

  // Filtros: busca + natureza. Quando busca, expande tudo automaticamente; sem busca, respeita expanded.
  const matches = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q && filtroNatureza === "todas") return null; // null = sem filtro
    return new Set(
      contas
        .filter((c) => {
          const okQ = !q || c.codigo.toLowerCase().includes(q) || (c.descricao || "").toLowerCase().includes(q);
          const okN = filtroNatureza === "todas" || c.natureza === filtroNatureza;
          return okQ && okN;
        })
        .map((c) => c.id),
    );
  }, [busca, filtroNatureza, contas]);

  // Inclui ancestrais dos matches (para mostrar pai dos filtrados)
  const visiveis = useMemo(() => {
    if (!matches) return null;
    const set = new Set<string>(matches);
    const byId = new Map(contas.map((c) => [c.id, c] as const));
    matches.forEach((id) => {
      let cur = byId.get(id);
      while (cur?.parentId) {
        set.add(cur.parentId);
        cur = byId.get(cur.parentId);
      }
    });
    return set;
  }, [matches, contas]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandirTudo = () => setExpanded(new Set(contas.map((c) => c.id)));
  const colapsarTudo = () => setExpanded(new Set());

  const abrirNovo = (parent?: PlanoConta) => {
    setForm({
      ...formVazio,
      parentId: parent?.id ?? null,
      natureza: parent?.natureza ?? "despesa",
    });
    setOpenForm(true);
  };

  const abrirEdicao = (c: PlanoConta) => {
    setForm({
      id: c.id,
      codigo: c.codigo,
      descricao: c.descricao,
      natureza: c.natureza,
      parentId: c.parentId,
      permiteLancamento: c.permiteLancamento,
      ativo: c.ativo,
      naturezaDre: c.naturezaDre ?? "",
    });
    setOpenForm(true);
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        codigo: form.codigo.trim(),
        descricao: form.descricao.trim(),
        natureza: form.natureza,
        parentId: form.parentId ?? null,
        permiteLancamento: form.permiteLancamento,
        ativo: form.ativo,
        naturezaDre: form.naturezaDre || null,
        nivel: form.parentId ? (contas.find((c) => c.id === form.parentId)?.nivel ?? 1) + 1 : 1,
      };
      if (form.id) {
        const r = await apiRequest("PATCH", `/api/control/planos-contas/${form.id}`, payload);
        return r.json();
      }
      const r = await apiRequest("POST", `/api/control/planos-contas`, payload);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/control/planos-contas"] });
      qc.invalidateQueries({ queryKey: ["/api/control/planos-contas/uso"] });
      toast({ title: form.id ? "Conta atualizada" : "Conta criada" });
      setOpenForm(false);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e?.message ?? "Falha", variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/control/planos-contas/${id}`);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/control/planos-contas"] });
      toast({ title: "Conta excluída" });
    },
    onError: (e: any) => toast({ title: "Não foi possível excluir", description: e?.message ?? "Falha", variant: "destructive" }),
  });

  function renderLinha(c: PlanoConta, depth: number): JSX.Element[] {
    const filhos = filhosPorPai.get(c.id) ?? [];
    const temFilhos = filhos.length > 0;
    const isExpanded = matches ? true : expanded.has(c.id); // se filtrando, expande tudo automaticamente
    const u = usoPorConta.get(c.id);
    const linhas: JSX.Element[] = [
      <TableRow key={c.id} data-testid={`row-conta-${c.id}`} className={!c.ativo ? "opacity-50" : ""}>
        <TableCell className="font-mono text-xs whitespace-nowrap">
          <div className="flex items-center" style={{ paddingLeft: depth * 16 }}>
            {temFilhos ? (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mr-1" onClick={() => toggle(c.id)}
                data-testid={`toggle-conta-${c.id}`}>
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            ) : (
              <span className="inline-block w-7" />
            )}
            <span>{c.codigo}</span>
          </div>
        </TableCell>
        <TableCell className="text-sm">
          {c.descricao}
          {!c.ativo && <Badge variant="outline" className="ml-2 text-xs">inativa</Badge>}
        </TableCell>
        <TableCell><Badge className={naturezaCor[c.natureza] ?? ""}>{c.natureza}</Badge></TableCell>
        <TableCell>{c.permiteLancamento ? <Badge variant="default">Sim</Badge> : <Badge variant="outline">Sintética</Badge>}</TableCell>
        <TableCell className="text-right text-xs whitespace-nowrap">
          {u ? (
            <div>
              <div className="font-medium" data-testid={`uso-qtd-${c.id}`}>{u.qtd} lanc.</div>
              <div className="text-muted-foreground">{formatBRL(u.total)}</div>
            </div>
          ) : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => abrirNovo(c)} title="Adicionar sub-conta"
              data-testid={`button-add-sub-${c.id}`}>
              <Plus className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => abrirEdicao(c)} title="Editar"
              data-testid={`button-editar-conta-${c.id}`}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              if (confirm(`Excluir conta ${c.codigo} — ${c.descricao}?`)) excluir.mutate(c.id);
            }} title="Excluir" data-testid={`button-excluir-conta-${c.id}`}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>,
    ];
    if (isExpanded && temFilhos) {
      filhos.forEach((f) => {
        if (visiveis && !visiveis.has(f.id)) return;
        linhas.push(...renderLinha(f, depth + 1));
      });
    }
    return linhas;
  }

  return (
    <Card data-testid="card-plano-contas">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>Plano de Contas</CardTitle>
            <CardDescription>Hierárquico, compartilhado entre as empresas do tenant. Use ▶ para expandir e ações por linha.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandirTudo} data-testid="button-expandir-tudo">Expandir tudo</Button>
            <Button variant="outline" size="sm" onClick={colapsarTudo} data-testid="button-colapsar-tudo">Recolher</Button>
            <Button onClick={() => abrirNovo()} data-testid="button-nova-conta">
              <Plus className="h-4 w-4 mr-1" />Nova conta
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por código ou descrição..." value={busca}
              onChange={(e) => setBusca(e.target.value)} className="pl-9"
              data-testid="input-busca-conta" />
          </div>
          <Select value={filtroNatureza} onValueChange={setFiltroNatureza}>
            <SelectTrigger className="w-48" data-testid="select-filtro-natureza"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as naturezas</SelectItem>
              {NATUREZAS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="overflow-y-auto max-h-[calc(100vh-280px)] rounded-b-lg">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-40">Natureza</TableHead>
                <TableHead className="w-28">Lançamento</TableHead>
                <TableHead className="text-right w-32">Uso</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {raizes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma conta cadastrada — clique em <strong>Nova conta</strong> para começar.
                  </TableCell>
                </TableRow>
              ) : (
                raizes.flatMap((c) => {
                  if (visiveis && !visiveis.has(c.id)) return [];
                  return renderLinha(c, 0);
                })
              )}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>

      {/* Form dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar conta" : "Nova conta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código*</Label>
                <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="Ex: 4.1.01" data-testid="input-form-codigo" />
              </div>
              <div>
                <Label>Natureza*</Label>
                <Select value={form.natureza} onValueChange={(v) => setForm({ ...form, natureza: v })}>
                  <SelectTrigger data-testid="select-form-natureza"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NATUREZAS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição*</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Aluguel de imóvel" data-testid="input-form-descricao" />
            </div>
            <div>
              <Label>Conta pai (opcional)</Label>
              <Select value={form.parentId ?? NONE}
                onValueChange={(v) => setForm({ ...form, parentId: v === NONE ? null : v })}>
                <SelectTrigger data-testid="select-form-parent"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value={NONE}>— (nível 1)</SelectItem>
                  {contas
                    .filter((c) => c.id !== form.id) // não pode ser pai de si mesma
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.descricao}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tag DRE/Fluxo (opcional)</Label>
              <Input value={form.naturezaDre} onChange={(e) => setForm({ ...form, naturezaDre: e.target.value })}
                placeholder="ex: EBITDA, NCG, tesouraria" data-testid="input-form-natureza-dre" />
            </div>
            <div className="flex items-center gap-6 pt-1">
              <div className="flex items-center gap-2">
                <Switch checked={form.permiteLancamento}
                  onCheckedChange={(c) => setForm({ ...form, permiteLancamento: c })}
                  data-testid="switch-form-permite" />
                <Label className="cursor-pointer">Permite lançamento (analítica)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo}
                  onCheckedChange={(c) => setForm({ ...form, ativo: c })}
                  data-testid="switch-form-ativo" />
                <Label className="cursor-pointer">Ativa</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)} data-testid="button-form-cancelar">Cancelar</Button>
            <Button onClick={() => salvar.mutate()}
              disabled={salvar.isPending || !form.codigo.trim() || !form.descricao.trim()}
              data-testid="button-form-salvar">
              {salvar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
