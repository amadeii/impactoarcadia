import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Pencil, Trash2, ArrowDown, ArrowUp, Wallet, TrendingUp, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { HrEmployee, HrEmployeeAccountEntry } from "@shared/schema";

const CATEGORY_LABEL: Record<string, string> = {
  salario: "Salário",
  vale: "Vale",
  adiantamento: "Adiantamento",
  repasse: "Repasse",
  bonus: "Bônus",
  comissao: "Comissão",
  ferias: "Férias",
  decimo_terceiro: "13º Salário",
  desconto: "Desconto",
  ajuste: "Ajuste",
  outro: "Outro",
};

// Sugere direction default conforme a categoria escolhida.
const DEFAULT_DIRECTION: Record<string, "credit" | "debit"> = {
  salario: "credit", bonus: "credit", comissao: "credit", ferias: "credit",
  decimo_terceiro: "credit", repasse: "credit",
  vale: "debit", adiantamento: "debit", desconto: "debit",
  ajuste: "credit", outro: "credit",
};

const STATUS_COLOR: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  pago: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  conciliado: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
};

function formatBRL(v: string | number | null | undefined) {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isNaN(n) ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(v: string | null | undefined) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return y && m && d ? `${d}/${m}/${y}` : v;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonthISO = () => new Date().toISOString().slice(0, 7);

type Summary = {
  totalCredit: string; totalDebit: string; saldo: string;
  byCategory: Record<string, number>;
};

type EntryForm = {
  date: string;
  direction: "credit" | "debit";
  category: string;
  description: string;
  amount: string;
  status: string;
  paymentMethod: string;
  referenceMonth: string;
  notes: string;
};

const emptyForm = (): EntryForm => ({
  date: todayISO(),
  direction: "credit",
  category: "salario",
  description: "",
  amount: "",
  status: "pendente",
  paymentMethod: "",
  referenceMonth: currentMonthISO(),
  notes: "",
});

export default function EmployeeAccountPage() {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const { toast } = useToast();

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: employee } = useQuery<HrEmployee>({
    queryKey: ["/api/hr/employees", employeeId],
    enabled: !!employeeId,
  });

  const fetchJson = async (url: string) => {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };

  const entriesUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (filterCategory !== "all") p.set("category", filterCategory);
    if (filterStatus !== "all") p.set("status", filterStatus);
    const q = p.toString();
    return `/api/hr/employees/${employeeId}/account-entries${q ? `?${q}` : ""}`;
  }, [employeeId, filterCategory, filterStatus]);

  const { data: entries = [], isLoading } = useQuery<HrEmployeeAccountEntry[]>({
    queryKey: ["/api/hr/employees", employeeId, "account-entries", { filterCategory, filterStatus }],
    queryFn: () => fetchJson(entriesUrl),
    enabled: !!employeeId,
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["/api/hr/employees", employeeId, "account-summary"],
    queryFn: () => fetchJson(`/api/hr/employees/${employeeId}/account-summary`),
    enabled: !!employeeId,
  });

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/hr/employees", employeeId, "account-entries"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/hr/employees", employeeId, "account-summary"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        amount: form.amount,
        paymentMethod: form.paymentMethod || null,
        referenceMonth: form.referenceMonth || null,
        notes: form.notes || null,
      };
      if (editingId) {
        return apiRequest("PATCH", `/api/hr/employees/${employeeId}/account-entries/${editingId}`, payload);
      }
      return apiRequest("POST", `/api/hr/employees/${employeeId}/account-entries`, payload);
    },
    onSuccess: async () => {
      toast({ title: editingId ? "Lançamento atualizado" : "Lançamento criado" });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm());
      await invalidateAll();
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/hr/employees/${employeeId}/account-entries/${id}`, undefined),
    onSuccess: async () => {
      toast({ title: "Lançamento excluído" });
      setConfirmDelete(null);
      await invalidateAll();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (e: HrEmployeeAccountEntry) => {
    setEditingId(e.id);
    setForm({
      date: e.date,
      direction: e.direction as "credit" | "debit",
      category: e.category,
      description: e.description,
      amount: String(e.amount),
      status: e.status,
      paymentMethod: e.paymentMethod ?? "",
      referenceMonth: e.referenceMonth ?? currentMonthISO(),
      notes: e.notes ?? "",
    });
    setDialogOpen(true);
  };

  const onCategoryChange = (category: string) => {
    setForm(f => ({
      ...f,
      category,
      direction: editingId ? f.direction : (DEFAULT_DIRECTION[category] ?? f.direction),
    }));
  };

  const saldo = parseFloat(summary?.saldo ?? "0");
  const canSubmit = form.description.trim() && form.amount && parseFloat(form.amount) > 0 && form.date;

  return (
    <div className="space-y-4 p-6 max-w-6xl mx-auto">
      <Link href={`/hr/colaboradores/${employeeId}`}>
        <Button variant="ghost" size="sm" data-testid="button-voltar-colaborador">
          <ArrowLeft className="h-4 w-4 mr-2" />Voltar para o colaborador
        </Button>
      </Link>

      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-title-conta">
          <Wallet className="h-6 w-6" />
          Conta corrente — {employee?.fullName ?? "..."}
        </h1>
        <p className="text-sm text-muted-foreground">
          Vales, adiantamentos, salários, repasses e ajustes deste colaborador.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">A pagar (créditos)</div>
                <div className="text-2xl font-bold mt-1 text-green-700 dark:text-green-400" data-testid="kpi-credit">
                  {formatBRL(summary?.totalCredit)}
                </div>
              </div>
              <TrendingUp className="h-7 w-7 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Pagos / Abates (débitos)</div>
                <div className="text-2xl font-bold mt-1 text-rose-700 dark:text-rose-400" data-testid="kpi-debit">
                  {formatBRL(summary?.totalDebit)}
                </div>
              </div>
              <TrendingDown className="h-7 w-7 text-rose-600" />
            </div>
          </CardContent>
        </Card>
        <Card className={saldo >= 0 ? "border-green-500" : "border-rose-500"}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">
                  Saldo {saldo >= 0 ? "(empresa deve)" : "(colaborador deve)"}
                </div>
                <div className={`text-2xl font-bold mt-1 ${saldo >= 0 ? "text-green-700 dark:text-green-400" : "text-rose-700 dark:text-rose-400"}`} data-testid="kpi-saldo">
                  {formatBRL(Math.abs(saldo).toFixed(2))}
                </div>
              </div>
              <Wallet className={`h-7 w-7 ${saldo >= 0 ? "text-green-600" : "text-rose-600"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros + ação */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end justify-between">
          <div className="flex flex-wrap gap-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="conciliado">Conciliado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={openCreate} data-testid="button-novo-lancamento">
            <Plus className="h-4 w-4 mr-2" />Novo lançamento
          </Button>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              Nenhum lançamento ainda. Use "Novo lançamento" para registrar vales, salários e repasses.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Ref.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[100px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(e => (
                  <TableRow key={e.id} data-testid={`row-entry-${e.id}`}>
                    <TableCell className="font-mono text-xs">{formatDateBR(e.date)}</TableCell>
                    <TableCell>
                      {e.direction === "credit"
                        ? <ArrowUp className="h-4 w-4 text-green-600" />
                        : <ArrowDown className="h-4 w-4 text-rose-600" />}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{e.description}</div>
                      {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORY_LABEL[e.category] ?? e.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.referenceMonth ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[e.status]}>{e.status}</Badge>
                    </TableCell>
                    <TableCell className={`text-right font-mono font-medium ${e.direction === "credit" ? "text-green-700 dark:text-green-400" : "text-rose-700 dark:text-rose-400"}`}>
                      {e.direction === "credit" ? "+" : "−"} {formatBRL(e.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)} data-testid={`button-edit-${e.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(e.id)} data-testid={`button-delete-${e.id}`}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Novo/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} data-testid="input-data" />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={form.direction} onValueChange={(v: "credit" | "debit") => setForm({ ...form, direction: v })}>
                <SelectTrigger data-testid="select-direction"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Crédito (a pagar / a favor)</SelectItem>
                  <SelectItem value="debit">Débito (vale / pago)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={onCategoryChange}>
                <SelectTrigger data-testid="select-categoria"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Descrição *</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Vale 15/05, Salário maio, Repasse semanal..." data-testid="input-descricao" />
            </div>
            <div>
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0.01" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} data-testid="input-valor" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-status-form"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="conciliado">Conciliado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Input value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                placeholder="PIX, Dinheiro, TED..." />
            </div>
            <div>
              <Label>Mês de referência</Label>
              <Input type="month" value={form.referenceMonth}
                onChange={e => setForm({ ...form, referenceMonth: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!canSubmit || saveMutation.isPending}
              data-testid="button-confirmar-lancamento">
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O saldo será recalculado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
              data-testid="button-confirmar-exclusao">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
