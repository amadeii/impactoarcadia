// Sprint RH-2 — PayrollPage: lista períodos, abre detalhe, KPIs, ações de status.
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, ChevronLeft, ChevronRight, Wallet, FileCheck, FileX, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { HrPayrollPeriod, HrPayrollEntry, HrEmployee } from "@shared/schema";
import { HrTabs } from "./HrTabs";
import { PayrollEntryDialog } from "@/components/hr/PayrollEntryDialog";
import { ExportButton } from "@/components/hr/ExportButton";

type ClientLite = { id: string; name: string; company?: string };

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", reviewed: "Revisado", approved: "Aprovado", exported: "Exportado",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  reviewed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  exported: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
};

const fmtBRL = (v: any) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v ?? 0);
  return Number.isNaN(n) ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

function competenceLabel(c: string) {
  const [y, m] = c.split("-");
  return `${m}/${y}`;
}

function shiftCompetence(c: string, delta: number): string {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function todayCompetence(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const fetchJson = async (url: string) => {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

export default function PayrollPage() {
  const { toast } = useToast();
  const [clienteId, setClienteId] = useState<string>("");
  const [competence, setCompetence] = useState<string>(todayCompetence());
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HrPayrollEntry | null>(null);

  const { data: clients = [] } = useQuery<ClientLite[]>({ queryKey: ["/api/clients"] });

  const periodsUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (clienteId) p.set("clienteId", clienteId);
    p.set("competence", competence);
    return `/api/hr/payroll?${p.toString()}`;
  }, [clienteId, competence]);

  const { data: periods = [], isLoading: loadingPeriods } = useQuery<HrPayrollPeriod[]>({
    queryKey: ["/api/hr/payroll", { clienteId, competence }],
    queryFn: () => fetchJson(periodsUrl),
    enabled: !!clienteId,
  });

  const period = periods[0]; // unique(clienteId, competence)
  const periodId = period?.id ?? null;

  const { data: detail } = useQuery<{ period: HrPayrollPeriod; entries: HrPayrollEntry[] }>({
    queryKey: ["/api/hr/payroll", periodId],
    queryFn: () => fetchJson(`/api/hr/payroll/${periodId}`),
    enabled: !!periodId,
  });

  const { data: employees = [] } = useQuery<HrEmployee[]>({
    queryKey: ["/api/hr/employees", { clienteId, status: "active" }],
    queryFn: () => fetchJson(`/api/hr/employees?clienteId=${clienteId}&status=active`),
    enabled: !!clienteId,
  });

  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map(e => [e.id, e])),
    [employees],
  );

  const invalidatePayroll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/hr/payroll"] });
  };

  const createPeriod = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/payroll", { clienteId, competence }),
    onSuccess: () => { invalidatePayroll(); toast({ title: "Período criado" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "review" | "approve" | "revert" }) =>
      apiRequest("POST", `/api/hr/payroll/${id}/${action}`, {}),
    onSuccess: (_, vars) => {
      invalidatePayroll();
      toast({ title: vars.action === "approve" ? "Aprovado — lançamentos gerados no Control" : vars.action === "review" ? "Revisado" : "Reversão concluída" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteEntry = useMutation({
    mutationFn: (entryId: string) => apiRequest("DELETE", `/api/hr/payroll/${periodId}/entries/${entryId}`, {}),
    onSuccess: () => { invalidatePayroll(); toast({ title: "Lançamento removido" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const isEditable = period && (period.status === "draft" || period.status === "reviewed");
  const entries = detail?.entries ?? [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Folha de Pagamento</h1>
        <p className="text-sm text-muted-foreground">Gestão mensal da folha — geração automática no Control ao aprovar.</p>
      </div>
      <HrTabs />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px]">
          <label className="text-xs font-medium text-muted-foreground">Empresa</label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger data-testid="select-cliente"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setCompetence(shiftCompetence(competence, -1))} data-testid="btn-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-4 py-2 border rounded-md min-w-[120px] text-center font-medium" data-testid="text-competence">
            {competenceLabel(competence)}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCompetence(shiftCompetence(competence, 1))} data-testid="btn-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {clienteId && !period && !loadingPeriods && (
          <Button onClick={() => createPeriod.mutate()} disabled={createPeriod.isPending} data-testid="btn-create-period">
            <Plus className="h-4 w-4 mr-1" /> Abrir folha {competenceLabel(competence)}
          </Button>
        )}
      </div>

      {!clienteId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione uma empresa para visualizar a folha.</CardContent></Card>
      ) : loadingPeriods ? (
        <Skeleton className="h-64" />
      ) : !period ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma folha aberta para {competenceLabel(competence)}.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Período {competenceLabel(period.competence)}</h2>
              <Badge className={STATUS_COLOR[period.status]} data-testid={`badge-status-${period.status}`}>
                {STATUS_LABEL[period.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {period.status === "draft" && (
                <Button variant="outline" onClick={() => transition.mutate({ id: period.id, action: "review" })} disabled={transition.isPending} data-testid="btn-review">
                  <FileCheck className="h-4 w-4 mr-1" /> Marcar como revisado
                </Button>
              )}
              {period.status === "reviewed" && (
                <Button onClick={() => transition.mutate({ id: period.id, action: "approve" })} disabled={transition.isPending} data-testid="btn-approve">
                  <FileCheck className="h-4 w-4 mr-1" /> Aprovar e gerar Control
                </Button>
              )}
              {period.status === "approved" && (
                <Button variant="outline" onClick={() => transition.mutate({ id: period.id, action: "revert" })} disabled={transition.isPending} data-testid="btn-revert">
                  <RotateCcw className="h-4 w-4 mr-1" /> Reverter aprovação
                </Button>
              )}
              {(period.status === "approved" || period.status === "exported") && (
                <ExportButton periodId={period.id} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Kpi label="Total Bruto" value={fmtBRL(period.totalGross)} testId="kpi-bruto" />
            <Kpi label="Total Líquido" value={fmtBRL(period.totalNet)} testId="kpi-liquido" />
            <Kpi label="INSS" value={fmtBRL(period.totalInssEmployee)} testId="kpi-inss" />
            <Kpi label="FGTS" value={fmtBRL(period.totalFgts)} testId="kpi-fgts" />
            <Kpi label="IRRF" value={fmtBRL(period.totalIrrf)} testId="kpi-irrf" />
            <Kpi label="Colaboradores" value={String(entries.length)} testId="kpi-colab" />
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-medium">Lançamentos</h3>
                {isEditable && (
                  <Button size="sm" onClick={() => { setEditingEntry(null); setEntryDialogOpen(true); }} data-testid="btn-add-entry">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar colaborador
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Descontos</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="text-right">INSS</TableHead>
                    <TableHead className="text-right">FGTS</TableHead>
                    <TableHead className="text-right">IRRF</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum lançamento ainda.</TableCell></TableRow>
                  ) : entries.map(e => {
                    const emp = employeeMap[e.employeeId];
                    return (
                      <TableRow key={e.id} data-testid={`row-entry-${e.id}`}>
                        <TableCell className="font-medium">{emp?.fullName ?? e.employeeId.slice(0, 8)}</TableCell>
                        <TableCell><Badge variant="outline">{e.situation}</Badge></TableCell>
                        <TableCell className="text-right">{fmtBRL(e.totalGross)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(e.totalDiscounts)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtBRL(e.netSalary)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmtBRL(e.inssValue)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmtBRL(e.fgtsValue)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmtBRL(e.irrfValue)}</TableCell>
                        <TableCell className="text-right">
                          {isEditable && (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setEditingEntry(e); setEntryDialogOpen(true); }} data-testid={`btn-edit-${e.id}`}>Editar</Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteEntry.mutate(e.id)} data-testid={`btn-delete-${e.id}`}>
                                <FileX className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {period.status === "approved" && Array.isArray(period.controlTxIds) && (period.controlTxIds as any).length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{(period.controlTxIds as any).length}</span> lançamento(s) gerado(s) no Control (status "previsto") — visíveis no módulo Arcádia Control da empresa.
                </p>
              </CardContent>
            </Card>
          )}

          <PayrollEntryDialog
            open={entryDialogOpen}
            onOpenChange={setEntryDialogOpen}
            periodId={period.id}
            employees={employees}
            existingEntryIds={entries.map(e => e.employeeId)}
            editing={editingEntry}
          />
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold mt-1" data-testid={testId}>{value}</div>
      </CardContent>
    </Card>
  );
}
