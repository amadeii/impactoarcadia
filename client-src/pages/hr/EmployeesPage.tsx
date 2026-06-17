import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Plus, Search, Users, UserCheck, UserX, Plane, Stethoscope,
  MoreHorizontal, Pencil, Wallet, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { HrEmployee, HrPosition, HrDepartment } from "@shared/schema";
import { HrTabs } from "./HrTabs";
import { GrupoEmpresarialSelector } from "@/components/GrupoEmpresarialSelector";
import { useGrupoEmpresarial } from "@/hooks/useGrupoEmpresarial";

type ClientLite = { id: string; name: string };

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  vacation: "Férias",
  leave: "Afastado",
  terminated: "Desligado",
};

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  vacation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  leave: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  terminated: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  clt: "CLT", pj: "PJ", apprentice: "Jovem Aprendiz", intern: "Estagiário",
};

function formatBRL(v: string | number | null | undefined) {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(v: string | null | undefined) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  if (!y || !m || !d) return v;
  return `${d}/${m}/${y}`;
}

export default function EmployeesPage() {
  const { toast } = useToast();
  const [clienteId, setClienteId] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [positionId, setPositionId] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const { selectedGrupo, grupoEmpresas, clienteIds: grupoClienteIds, hasGrupo } = useGrupoEmpresarial();
  const [confirmDelete, setConfirmDelete] = useState<HrEmployee | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/hr/employees/${id}`, undefined),
    onSuccess: async () => {
      toast({ title: "Colaborador excluído" });
      setConfirmDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/hr/employees/counts"] });
    },
    onError: (e: any) => toast({
      title: "Não foi possível excluir",
      description: e.message,
      variant: "destructive",
    }),
  });

  // Lista de clientes do tenant (usado como "empresas" no contexto BPO)
  const { data: clients = [] } = useQuery<ClientLite[]>({ queryKey: ["/api/clients"] });

  const employeesUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (clienteId) params.set("clienteId", clienteId);
    if (status !== "all") params.set("status", status);
    if (departmentId !== "all") params.set("departmentId", departmentId);
    if (positionId !== "all") params.set("positionId", positionId);
    if (search.trim()) params.set("search", search.trim());
    return `/api/hr/employees?${params.toString()}`;
  }, [clienteId, status, departmentId, positionId, search]);

  // queryKey em array → invalidação parcial (["/api/hr/employees"]) atinge
  // todas variantes. queryFn explícita evita o join("/") do default fetcher,
  // que quebraria URLs com query-string.
  const fetchJson = async (url: string) => {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };

  const { data: employees = [], isLoading } = useQuery<HrEmployee[]>({
    queryKey: ["/api/hr/employees", { clienteId, status, departmentId, positionId, search }],
    queryFn: () => fetchJson(employeesUrl),
    enabled: !!clienteId,
  });

  const { data: counts } = useQuery<Record<string, number>>({
    queryKey: ["/api/hr/employees/counts", clienteId],
    queryFn: () => fetchJson(`/api/hr/employees/counts?clienteId=${clienteId}`),
    enabled: !!clienteId,
  });

  const { data: positions = [] } = useQuery<HrPosition[]>({
    queryKey: ["/api/hr/positions", clienteId],
    queryFn: () => fetchJson(`/api/hr/positions?clienteId=${clienteId}`),
    enabled: !!clienteId,
  });

  const { data: departments = [] } = useQuery<HrDepartment[]>({
    queryKey: ["/api/hr/departments", clienteId],
    queryFn: () => fetchJson(`/api/hr/departments?clienteId=${clienteId}`),
    enabled: !!clienteId,
  });

  const positionMap = useMemo(() => Object.fromEntries(positions.map(p => [p.id, p.nome])), [positions]);
  const departmentMap = useMemo(() => Object.fromEntries(departments.map(d => [d.id, d.nome])), [departments]);

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-title-hr">RH / DP</h1>
          <p className="text-sm text-muted-foreground">
            BPO de Folha — colaboradores, cargos e departamentos por empresa cliente
          </p>
        </div>
        <Link href={`/hr/colaboradores/novo${clienteId ? `?clienteId=${clienteId}` : ""}`}>
          <Button data-testid="button-novo-colaborador" disabled={!clienteId}>
            <Plus className="h-4 w-4 mr-2" />Novo colaborador
          </Button>
        </Link>
      </header>

      <HrTabs />

      {/* Seletor de empresa cliente + grupo */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <GrupoEmpresarialSelector compact />
            {hasGrupo && grupoClienteIds.length > 0 && (
              <span className="text-xs text-violet-600 font-medium">
                Filtrando por {grupoEmpresas.length} empresa{grupoEmpresas.length !== 1 ? "s" : ""} do grupo <strong>{selectedGrupo?.nome}</strong>
              </span>
            )}
            <span className="text-sm font-medium whitespace-nowrap">Empresa:</span>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger className="max-w-md" data-testid="select-cliente">
                <SelectValue placeholder="Selecione uma empresa..." />
              </SelectTrigger>
              <SelectContent>
                {(hasGrupo && grupoClienteIds.length > 0
                  ? clients.filter(c => grupoClienteIds.includes(c.id))
                  : clients
                ).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!clienteId ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          Selecione uma empresa cliente para visualizar os colaboradores.
        </CardContent></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { key: "total", label: "Ativos totais", icon: Users, color: "text-foreground" },
              { key: "active", label: "Trabalhando", icon: UserCheck, color: "text-green-600" },
              { key: "vacation", label: "Em férias", icon: Plane, color: "text-blue-600" },
              { key: "leave", label: "Afastados", icon: Stethoscope, color: "text-amber-600" },
              { key: "terminated", label: "Desligados", icon: UserX, color: "text-zinc-500" },
            ].map(k => (
              <Card key={k.key}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">{k.label}</div>
                      <div className="text-2xl font-bold mt-1" data-testid={`kpi-${k.key}`}>
                        {counts?.[k.key] ?? 0}
                      </div>
                    </div>
                    <k.icon className={`h-6 w-6 ${k.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF ou código..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-colaborador"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[160px]" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="vacation">Férias</SelectItem>
                  <SelectItem value="leave">Afastados</SelectItem>
                  <SelectItem value="terminated">Desligados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="w-[200px]" data-testid="select-departamento">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos departamentos</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={positionId} onValueChange={setPositionId}>
                <SelectTrigger className="w-[200px]" data-testid="select-cargo">
                  <SelectValue placeholder="Cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos cargos</SelectItem>
                  {positions.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : employees.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  Nenhum colaborador encontrado com os filtros atuais.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Vínculo</TableHead>
                      <TableHead>Admissão</TableHead>
                      <TableHead className="text-right">Salário base</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[60px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map(emp => (
                      <TableRow key={emp.id} className="cursor-pointer hover-elevate" data-testid={`row-emp-${emp.id}`}>
                        <TableCell className="font-mono text-xs">{emp.employeeCode}</TableCell>
                        <TableCell>
                          <Link href={`/hr/colaboradores/${emp.id}`} className="font-medium hover:underline">
                            {emp.fullName}
                          </Link>
                          <div className="text-xs text-muted-foreground">{emp.cpf}</div>
                        </TableCell>
                        <TableCell>{positionMap[emp.positionId] ?? "—"}</TableCell>
                        <TableCell>{emp.departmentId ? (departmentMap[emp.departmentId] ?? "—") : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{EMPLOYMENT_TYPE_LABEL[emp.employmentType] ?? emp.employmentType}</Badge>
                        </TableCell>
                        <TableCell>{formatDateBR(emp.admissionDate)}</TableCell>
                        <TableCell className="text-right font-mono">{formatBRL(emp.baseSalary)}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLOR[emp.status]}>{STATUS_LABEL[emp.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-actions-${emp.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <Link href={`/hr/colaboradores/${emp.id}`}>
                                <DropdownMenuItem data-testid={`menu-edit-${emp.id}`}>
                                  <Pencil className="h-4 w-4 mr-2" />Editar
                                </DropdownMenuItem>
                              </Link>
                              <Link href={`/hr/colaboradores/${emp.id}/conta-corrente`}>
                                <DropdownMenuItem data-testid={`menu-conta-${emp.id}`}>
                                  <Wallet className="h-4 w-4 mr-2" />Conta corrente
                                </DropdownMenuItem>
                              </Link>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-rose-600 focus:text-rose-700"
                                onClick={() => setConfirmDelete(emp)}
                                data-testid={`menu-delete-${emp.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o colaborador permanentemente, junto com seu histórico salarial e
              conta corrente. Se o colaborador já possuir lançamentos em folha, a operação será
              bloqueada — nesse caso, prefira <b>desligar</b> (status "Desligado") para preservar
              o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              data-testid="button-confirm-delete-employee"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
