// Sprint RH-2 — Folha de ponto manual (versão MVP).
// Lista folhas existentes por empresa/colaborador e permite criar/editar
// uma nova folha com totais agregados. O grid diário detalhado fica para RH-3
// quando o parser do Domínio começar a popular os registros automaticamente.
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { HrTimesheetPeriod, HrEmployee } from "@shared/schema";
import { HrTabs } from "./HrTabs";

type ClientLite = { id: string; name: string; company?: string };

const fetchJson = async (url: string) => {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

function formatDateBR(v: string | null | undefined) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return y && m && d ? `${d}/${m}/${y}` : v;
}

export default function TimesheetPage() {
  const { toast } = useToast();
  const [clienteId, setClienteId] = useState<string>("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: clients = [] } = useQuery<ClientLite[]>({ queryKey: ["/api/clients"] });

  const { data: employees = [] } = useQuery<HrEmployee[]>({
    queryKey: ["/api/hr/employees", { clienteId, status: "active" }],
    queryFn: () => fetchJson(`/api/hr/employees?clienteId=${clienteId}&status=active`),
    enabled: !!clienteId,
  });

  const empMap = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees]);

  const tsUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (clienteId) p.set("clienteId", clienteId);
    if (employeeFilter !== "all") p.set("employeeId", employeeFilter);
    return `/api/hr/timesheet?${p.toString()}`;
  }, [clienteId, employeeFilter]);

  const { data: rows = [], isLoading } = useQuery<HrTimesheetPeriod[]>({
    queryKey: ["/api/hr/timesheet", { clienteId, employeeFilter }],
    queryFn: () => fetchJson(tsUrl),
    enabled: !!clienteId,
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Folha de Ponto</h1>
        <p className="text-sm text-muted-foreground">Apontamento manual de horas trabalhadas, faltas e banco de horas.</p>
      </div>
      <HrTabs />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px]">
          <label className="text-xs font-medium text-muted-foreground">Empresa</label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger data-testid="select-cliente"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {clienteId && (
          <>
            <div className="min-w-[220px]">
              <label className="text-xs font-medium text-muted-foreground">Colaborador</label>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger data-testid="select-employee-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setCreateOpen(true)} disabled={employees.length === 0} data-testid="btn-add-timesheet">
              <Plus className="h-4 w-4 mr-1" /> Nova folha
            </Button>
          </>
        )}
      </div>

      {!clienteId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione uma empresa.</CardContent></Card>
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma folha de ponto registrada.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Previstas</TableHead>
                  <TableHead className="text-right">Trabalhadas</TableHead>
                  <TableHead className="text-right">Faltas</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Banco</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} data-testid={`row-ts-${r.id}`}>
                    <TableCell className="font-medium">{empMap[r.employeeId]?.fullName ?? r.employeeId.slice(0, 8)}</TableCell>
                    <TableCell>{formatDateBR(r.periodStart)} → {formatDateBR(r.periodEnd)}</TableCell>
                    <TableCell className="text-right">{Number(r.scheduledHours).toFixed(1)}h</TableCell>
                    <TableCell className="text-right">{Number(r.workedHours).toFixed(1)}h</TableCell>
                    <TableCell className="text-right">{Number(r.absenceHours).toFixed(1)}h</TableCell>
                    <TableCell className="text-right">{Number(r.overtimeHours).toFixed(1)}h</TableCell>
                    <TableCell className="text-right">
                      <span className={Number(r.bankBalance) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {Number(r.bankBalance) >= 0 ? "+" : ""}{Number(r.bankBalance).toFixed(1)}h
                      </span>
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CreateTimesheetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        clienteId={clienteId}
        employees={employees}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/hr/timesheet"] });
          toast({ title: "Folha de ponto criada" });
        }}
      />
    </div>
  );
}

function CreateTimesheetDialog({
  open, onOpenChange, clienteId, employees, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  clienteId: string; employees: HrEmployee[]; onSaved: () => void;
}) {
  const { toast } = useToast();
  const today = new Date();
  const firstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().slice(0, 10);

  const [employeeId, setEmployeeId] = useState("");
  const [periodStart, setPeriodStart] = useState(firstDay);
  const [periodEnd, setPeriodEnd] = useState(lastDay);
  const [scheduled, setScheduled] = useState("220");
  const [worked, setWorked] = useState("220");
  const [absence, setAbsence] = useState("0");
  const [overtime, setOvertime] = useState("0");
  const [absentDays, setAbsentDays] = useState("0");

  const bankBalance = (Number(overtime) || 0) - (Number(absence) || 0);

  const save = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/timesheet", {
      clienteId, employeeId, periodStart, periodEnd,
      source: "manual",
      scheduledHours: scheduled, workedHours: worked,
      absenceHours: absence, overtimeHours: overtime,
      bankBalance: bankBalance.toFixed(2), absentDays: Number(absentDays) || 0,
      entries: [],
    }),
    onSuccess: () => { onSaved(); onOpenChange(false); setEmployeeId(""); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova folha de ponto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Colaborador</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger data-testid="select-ts-employee"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Início</Label><Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Previstas (h)</Label><Input type="number" step="0.5" value={scheduled} onChange={e => setScheduled(e.target.value)} /></div>
            <div><Label>Trabalhadas (h)</Label><Input type="number" step="0.5" value={worked} onChange={e => setWorked(e.target.value)} /></div>
            <div><Label>Faltas (h)</Label><Input type="number" step="0.5" value={absence} onChange={e => setAbsence(e.target.value)} /></div>
            <div><Label>Extras (h)</Label><Input type="number" step="0.5" value={overtime} onChange={e => setOvertime(e.target.value)} /></div>
            <div><Label>Dias faltantes</Label><Input type="number" value={absentDays} onChange={e => setAbsentDays(e.target.value)} /></div>
            <div>
              <Label>Banco de horas</Label>
              <div className="px-3 py-2 border rounded-md bg-muted/50 text-sm">
                {bankBalance >= 0 ? "+" : ""}{bankBalance.toFixed(1)}h
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!employeeId || save.isPending} data-testid="btn-save-ts">
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
