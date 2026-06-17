import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { HrTabs } from "./HrTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { HrPosition, HrDepartment } from "@shared/schema";

type ClientLite = { id: string; name: string };
type CcLite = { id: string; nome: string; codigo: string };

export default function PositionsDepartmentsPage() {
  const { toast } = useToast();
  const [clienteId, setClienteId] = useState("");
  const [newPos, setNewPos] = useState({ nome: "", cboCode: "", level: "pleno" });
  const [newDept, setNewDept] = useState({ nome: "", centroCustoId: "" });

  const fetchJson = async (url: string) => {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };

  const { data: clients = [] } = useQuery<ClientLite[]>({ queryKey: ["/api/clients"] });
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
  const { data: centrosCusto = [] } = useQuery<CcLite[]>({
    queryKey: ["/api/control/clientes", clienteId, "centros-custo"],
    enabled: !!clienteId,
  });

  const createPos = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/positions", { ...newPos, clienteId }),
    onSuccess: async () => {
      setNewPos({ nome: "", cboCode: "", level: "pleno" });
      await queryClient.invalidateQueries({ queryKey: ["/api/hr/positions"] });
      toast({ title: "Cargo criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deletePos = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hr/positions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/hr/positions"] }),
  });

  const createDept = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/departments", {
      ...newDept, clienteId, centroCustoId: newDept.centroCustoId || null,
    }),
    onSuccess: async () => {
      setNewDept({ nome: "", centroCustoId: "" });
      await queryClient.invalidateQueries({ queryKey: ["/api/hr/departments"] });
      toast({ title: "Departamento criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteDept = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hr/departments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/hr/departments"] }),
  });

  return (
    <div className="space-y-4 p-6 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold" data-testid="text-title-hr">RH / DP</h1>
        <p className="text-sm text-muted-foreground">
          BPO de Folha — colaboradores, cargos e departamentos por empresa cliente
        </p>
      </header>

      <HrTabs />

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Label>Empresa cliente:</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="max-w-md" data-testid="select-cliente-cargo"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!!clienteId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cargos */}
          <Card>
            <CardHeader><CardTitle>Cargos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 p-3 border rounded">
                <Input placeholder="Nome do cargo" value={newPos.nome}
                  onChange={e => setNewPos({ ...newPos, nome: e.target.value })} data-testid="input-cargo-nome" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="CBO" value={newPos.cboCode}
                    onChange={e => setNewPos({ ...newPos, cboCode: e.target.value })} />
                  <Select value={newPos.level} onValueChange={v => setNewPos({ ...newPos, level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">Júnior</SelectItem>
                      <SelectItem value="pleno">Pleno</SelectItem>
                      <SelectItem value="senior">Sênior</SelectItem>
                      <SelectItem value="specialist">Especialista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => createPos.mutate()} disabled={!newPos.nome || createPos.isPending} data-testid="button-criar-cargo">
                  <Plus className="h-4 w-4 mr-1" />Adicionar cargo
                </Button>
              </div>
              <div className="space-y-1">
                {positions.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 border rounded" data-testid={`row-cargo-${p.id}`}>
                    <div>
                      <div className="font-medium">{p.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.cboCode ? `CBO ${p.cboCode}` : "Sem CBO"} · {p.level ?? "—"}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deletePos.mutate(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {positions.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cargo cadastrado.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Departamentos */}
          <Card>
            <CardHeader><CardTitle>Departamentos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 p-3 border rounded">
                <Input placeholder="Nome do departamento" value={newDept.nome}
                  onChange={e => setNewDept({ ...newDept, nome: e.target.value })} data-testid="input-dept-nome" />
                <Select value={newDept.centroCustoId || "none"}
                  onValueChange={v => setNewDept({ ...newDept, centroCustoId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Centro de custo (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem centro de custo</SelectItem>
                    {centrosCusto.map(cc => (
                      <SelectItem key={cc.id} value={cc.id}>{cc.codigo} — {cc.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => createDept.mutate()} disabled={!newDept.nome || createDept.isPending} data-testid="button-criar-dept">
                  <Plus className="h-4 w-4 mr-1" />Adicionar departamento
                </Button>
              </div>
              <div className="space-y-1">
                {departments.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-2 border rounded" data-testid={`row-dept-${d.id}`}>
                    <div>
                      <div className="font-medium">{d.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.centroCustoId ? `CC vinculado` : "Sem CC"}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteDept.mutate(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {departments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum departamento cadastrado.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
