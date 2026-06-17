import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useRoute, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save, TrendingUp, History, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { HrEmployee, HrPosition, HrDepartment, HrSalaryHistory } from "@shared/schema";

type ClientLite = { id: string; name: string };
type EmployeeWithHistory = HrEmployee & { salaryHistory: HrSalaryHistory[] };

const REASON_LABEL: Record<string, string> = {
  admissao: "Admissão",
  reajuste: "Reajuste",
  promocao: "Promoção",
  acordo: "Acordo coletivo",
  outro: "Outro",
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

function getQueryClienteId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("clienteId") ?? "";
}

export default function EmployeeFormPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEditing = !!params.id;
  const { toast } = useToast();

  const [form, setForm] = useState({
    clienteId: getQueryClienteId(),
    employeeCode: "",
    fullName: "",
    cpf: "",
    rg: "",
    ctpsNumber: "",
    ctpsSeries: "",
    admissionDate: new Date().toISOString().slice(0, 10),
    positionId: "",
    departmentId: "",
    workLocation: "",
    employmentType: "clt",
    baseSalary: "",
    monthlyHours: 220,
    cboCode: "",
    pisPasep: "",
  });

  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [newSalary, setNewSalary] = useState({
    salary: "", effectiveDate: new Date().toISOString().slice(0, 10),
    reason: "reajuste", notes: "",
  });

  const { data: clients = [] } = useQuery<ClientLite[]>({ queryKey: ["/api/clients"] });

  const { data: employee } = useQuery<EmployeeWithHistory>({
    queryKey: ["/api/hr/employees", params.id],
    enabled: isEditing,
  });

  useEffect(() => {
    if (employee) {
      setForm({
        clienteId: employee.clienteId,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        cpf: employee.cpf,
        rg: employee.rg ?? "",
        ctpsNumber: employee.ctpsNumber ?? "",
        ctpsSeries: employee.ctpsSeries ?? "",
        admissionDate: employee.admissionDate,
        positionId: employee.positionId,
        departmentId: employee.departmentId ?? "",
        workLocation: employee.workLocation ?? "",
        employmentType: employee.employmentType,
        baseSalary: employee.baseSalary,
        monthlyHours: employee.monthlyHours,
        cboCode: employee.cboCode ?? "",
        pisPasep: employee.pisPasep ?? "",
      });
    }
  }, [employee]);

  const fetchJson = async (url: string) => {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };

  const { data: positions = [] } = useQuery<HrPosition[]>({
    queryKey: ["/api/hr/positions", form.clienteId],
    queryFn: () => fetchJson(`/api/hr/positions?clienteId=${form.clienteId}`),
    enabled: !!form.clienteId,
  });

  const { data: departments = [] } = useQuery<HrDepartment[]>({
    queryKey: ["/api/hr/departments", form.clienteId],
    queryFn: () => fetchJson(`/api/hr/departments?clienteId=${form.clienteId}`),
    enabled: !!form.clienteId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        departmentId: form.departmentId || null,
        rg: form.rg || null,
        ctpsNumber: form.ctpsNumber || null,
        ctpsSeries: form.ctpsSeries || null,
        workLocation: form.workLocation || null,
        cboCode: form.cboCode || null,
        pisPasep: form.pisPasep || null,
        monthlyHours: Number(form.monthlyHours) || 220,
      };
      if (isEditing) {
        // Em edição, baseSalary é ignorado pelo backend (use o botão de reajuste).
        return apiRequest("PATCH", `/api/hr/employees/${params.id}`, payload);
      }
      return apiRequest("POST", "/api/hr/employees", payload);
    },
    onSuccess: async () => {
      toast({ title: isEditing ? "Colaborador atualizado" : "Colaborador cadastrado" });
      await queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      setLocation("/hr/colaboradores");
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const salaryMutation = useMutation({
    mutationFn: async () => apiRequest("PUT", `/api/hr/employees/${params.id}/salary`, newSalary),
    onSuccess: async () => {
      toast({ title: "Reajuste registrado" });
      setSalaryDialogOpen(false);
      setNewSalary({ salary: "", effectiveDate: new Date().toISOString().slice(0, 10), reason: "reajuste", notes: "" });
      await queryClient.invalidateQueries({ queryKey: ["/api/hr/employees", params.id] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) =>
      apiRequest("PUT", `/api/hr/employees/${params.id}/status`, {
        status,
        terminationDate: status === "terminated" ? new Date().toISOString().slice(0, 10) : undefined,
      }),
    onSuccess: async () => {
      toast({ title: "Status atualizado" });
      await queryClient.invalidateQueries({ queryKey: ["/api/hr/employees", params.id] });
    },
  });

  const canSubmit = !!form.clienteId && !!form.fullName && !!form.cpf && !!form.employeeCode
    && !!form.positionId && !!form.admissionDate && !!form.baseSalary;

  return (
    <div className="space-y-4 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <Link href="/hr/colaboradores">
          <Button variant="ghost" size="sm" data-testid="button-voltar">
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
        </Link>
        {isEditing && (
          <Link href={`/hr/colaboradores/${params.id}/conta-corrente`}>
            <Button variant="outline" size="sm" data-testid="button-conta-corrente">
              <Wallet className="h-4 w-4 mr-2" />Conta corrente
            </Button>
          </Link>
        )}
      </div>

      <h1 className="text-2xl font-bold" data-testid="text-title-form">
        {isEditing ? `Colaborador: ${employee?.fullName ?? ""}` : "Novo colaborador"}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Dados Pessoais */}
          <Card>
            <CardHeader><CardTitle>Dados Pessoais</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Empresa cliente *</Label>
                <Select value={form.clienteId} onValueChange={v => setForm({ ...form, clienteId: v })} disabled={isEditing}>
                  <SelectTrigger data-testid="select-cliente-form"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Código interno *</Label>
                <Input value={form.employeeCode} onChange={e => setForm({ ...form, employeeCode: e.target.value })} data-testid="input-codigo" />
              </div>
              <div className="md:col-span-2">
                <Label>Nome completo *</Label>
                <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} data-testid="input-nome" />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" data-testid="input-cpf" />
              </div>
              <div>
                <Label>RG</Label>
                <Input value={form.rg} onChange={e => setForm({ ...form, rg: e.target.value })} />
              </div>
              <div>
                <Label>CTPS — número</Label>
                <Input value={form.ctpsNumber} onChange={e => setForm({ ...form, ctpsNumber: e.target.value })} />
              </div>
              <div>
                <Label>CTPS — série</Label>
                <Input value={form.ctpsSeries} onChange={e => setForm({ ...form, ctpsSeries: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          {/* Vínculo */}
          <Card>
            <CardHeader><CardTitle>Vínculo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Tipo de vínculo *</Label>
                <Select value={form.employmentType} onValueChange={v => setForm({ ...form, employmentType: v })}>
                  <SelectTrigger data-testid="select-vinculo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clt">CLT</SelectItem>
                    <SelectItem value="pj">PJ</SelectItem>
                    <SelectItem value="apprentice">Jovem Aprendiz</SelectItem>
                    <SelectItem value="intern">Estagiário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de admissão *</Label>
                <Input type="date" value={form.admissionDate}
                  onChange={e => setForm({ ...form, admissionDate: e.target.value })} data-testid="input-admissao" />
              </div>
              <div>
                <Label>Cargo *</Label>
                <Select value={form.positionId} onValueChange={v => setForm({ ...form, positionId: v })}>
                  <SelectTrigger data-testid="select-cargo-form"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {positions.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Departamento</Label>
                <Select value={form.departmentId || "none"} onValueChange={v => setForm({ ...form, departmentId: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="select-departamento-form"><SelectValue placeholder="Sem departamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem departamento</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Local de trabalho</Label>
                <Input value={form.workLocation} onChange={e => setForm({ ...form, workLocation: e.target.value })} placeholder="Ex: Ateliê, Loja Shopping..." />
              </div>
            </CardContent>
          </Card>

          {/* Remuneração */}
          <Card>
            <CardHeader><CardTitle>Remuneração</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Salário base (R$) {isEditing ? "" : "*"}</Label>
                <Input type="number" step="0.01" value={form.baseSalary}
                  onChange={e => setForm({ ...form, baseSalary: e.target.value })}
                  disabled={isEditing}
                  data-testid="input-salario" />
                {isEditing && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Use o botão "Registrar reajuste" para alterar.
                  </p>
                )}
              </div>
              <div>
                <Label>Horas mensais</Label>
                <Input type="number" value={form.monthlyHours}
                  onChange={e => setForm({ ...form, monthlyHours: parseInt(e.target.value || "0") })} />
              </div>
            </CardContent>
          </Card>

          {/* CBO/Fiscal */}
          <Card>
            <CardHeader><CardTitle>CBO / Fiscal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Código CBO</Label>
                <Input value={form.cboCode} onChange={e => setForm({ ...form, cboCode: e.target.value })} placeholder="763210" />
              </div>
              <div>
                <Label>PIS/PASEP</Label>
                <Input value={form.pisPasep} onChange={e => setForm({ ...form, pisPasep: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2 justify-end">
            <Link href="/hr/colaboradores">
              <Button variant="outline" data-testid="button-cancelar">Cancelar</Button>
            </Link>
            <Button onClick={() => saveMutation.mutate()} disabled={!canSubmit || saveMutation.isPending}
              data-testid="button-salvar">
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Salvando..." : (isEditing ? "Atualizar" : "Cadastrar")}
            </Button>
          </div>
        </div>

        {/* Lateral — só em edição */}
        {isEditing && employee && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Status atual</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Badge className="text-sm">{employee.status}</Badge>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("active")}>Ativar</Button>
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("vacation")}>Férias</Button>
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("leave")}>Afastar</Button>
                  <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate("terminated")}>Desligar</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />Histórico salarial
                </CardTitle>
                <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-novo-reajuste"><TrendingUp className="h-4 w-4 mr-1" />Reajuste</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Registrar reajuste</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Novo salário (R$)</Label>
                        <Input type="number" step="0.01" value={newSalary.salary}
                          onChange={e => setNewSalary({ ...newSalary, salary: e.target.value })}
                          data-testid="input-novo-salario" />
                      </div>
                      <div>
                        <Label>Vigência</Label>
                        <Input type="date" value={newSalary.effectiveDate}
                          onChange={e => setNewSalary({ ...newSalary, effectiveDate: e.target.value })} />
                      </div>
                      <div>
                        <Label>Motivo</Label>
                        <Select value={newSalary.reason} onValueChange={v => setNewSalary({ ...newSalary, reason: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reajuste">Reajuste</SelectItem>
                            <SelectItem value="promocao">Promoção</SelectItem>
                            <SelectItem value="acordo">Acordo coletivo</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Observações</Label>
                        <Textarea value={newSalary.notes}
                          onChange={e => setNewSalary({ ...newSalary, notes: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSalaryDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={() => salaryMutation.mutate()} disabled={!newSalary.salary || salaryMutation.isPending}
                        data-testid="button-confirmar-reajuste">
                        Confirmar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {employee.salaryHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum registro.</p>
                  ) : employee.salaryHistory.map(h => (
                    <div key={h.id} className="flex items-center justify-between p-2 rounded border" data-testid={`hist-${h.id}`}>
                      <div>
                        <div className="text-sm font-medium">{formatBRL(h.salary)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateBR(h.effectiveDate)} · {REASON_LABEL[h.reason] ?? h.reason}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
