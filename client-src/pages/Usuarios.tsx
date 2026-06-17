import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmpresaContext } from "@/hooks/useEmpresaContext";
import {
  Users, Plus, Shield, Building2, Loader2,
  CheckCircle2, XCircle, MoreVertical,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PERFIL_CORES: Record<string, string> = {
  "Administrador":       "bg-red-100 text-red-700",
  "Controller / CFO":    "bg-purple-100 text-purple-700",
  "Analista Financeiro": "bg-blue-100 text-blue-700",
  "Gerente RH":          "bg-emerald-100 text-emerald-700",
  "Analista RH":         "bg-teal-100 text-teal-700",
  "Gerente de Projetos": "bg-orange-100 text-orange-700",
  "Técnico de Campo":    "bg-amber-100 text-amber-700",
  "Consulta":            "bg-gray-100 text-gray-600",
};

export default function Usuarios() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const { empresas = [] } = useEmpresaContext();

  const [busca, setBusca] = useState("");
  const [showConvite, setShowConvite] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", username: "", password: "",
    perfilId: "", empresasIds: [] as number[],
  });

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["/api/admin/usuarios"],
    queryFn: async () => {
      const r = await fetch("/api/admin/usuarios", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: perfis = [] } = useQuery({
    queryKey: ["/api/admin/roles"],
    queryFn: async () => {
      const r = await fetch("/api/admin/roles", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const convidarMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/admin/usuarios/convidar", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Usuário convidado com sucesso!" });
      qc.invalidateQueries({ queryKey: ["/api/admin/usuarios"] });
      setShowConvite(false);
      setForm({ name:"", email:"", username:"", password:"", perfilId:"", empresasIds:[] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const r = await fetch(`/api/admin/usuarios/${userId}/status`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Falha ao atualizar status");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/usuarios"] }),
    onError: () => toast({ title: "Erro ao alterar status", variant: "destructive" }),
  });

  const filtrados = (usuarios as any[]).filter((u: any) => {
    const q = busca.toLowerCase();
    return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const toggleEmpresa = (id: number) => {
    setForm(f => ({
      ...f,
      empresasIds: f.empresasIds.includes(id)
        ? f.empresasIds.filter(x => x !== id)
        : [...f.empresasIds, id],
    }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-usuarios">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie quem acessa o sistema e o que cada um pode fazer
          </p>
        </div>
        {can("admin.usuarios.write") && (
          <Button onClick={() => setShowConvite(true)} data-testid="btn-convidar-usuario">
            <Plus className="h-4 w-4 mr-2" /> Convidar usuário
          </Button>
        )}
      </div>

      <Input
        placeholder="Buscar por nome ou email..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        data-testid="input-busca-usuario"
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_,i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : (
            <div className="divide-y">
              {filtrados.map((u: any) => (
                <div key={u.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30"
                  data-testid={`row-usuario-${u.id}`}>

                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {(u.name ?? u.username ?? "?")[0].toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" data-testid={`text-nome-${u.id}`}>{u.name ?? u.username}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>

                  <Badge className={`text-xs ${PERFIL_CORES[u.perfilNome ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
                    <Shield className="h-3 w-3 mr-1" />
                    {u.perfilNome ?? u.role ?? "Sem perfil"}
                  </Badge>

                  <div className="flex gap-1 flex-shrink-0">
                    {u.empresas?.length > 0
                      ? u.empresas.slice(0,2).map((e: any) => (
                          <Badge key={e.id} variant="outline" className="text-xs">
                            <Building2 className="h-3 w-3 mr-1" />{e.nomeFantasia ?? e.razaoSocial}
                          </Badge>
                        ))
                      : <Badge variant="outline" className="text-xs text-muted-foreground">Todas</Badge>
                    }
                  </div>

                  {u.status === "active"
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" data-testid={`status-ativo-${u.id}`} />
                    : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" data-testid={`status-inativo-${u.id}`} />}

                  {can("admin.usuarios.admin") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`menu-usuario-${u.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Editar perfil</DropdownMenuItem>
                        <DropdownMenuItem>Gerenciar empresas</DropdownMenuItem>
                        <DropdownMenuItem>Permissões individuais</DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleStatusMutation.mutate({
                            userId: u.id,
                            status: u.status === "active" ? "inactive" : "active",
                          })}
                          className={u.status === "active" ? "text-red-600" : "text-emerald-600"}
                          data-testid={`btn-toggle-status-${u.id}`}
                        >
                          {u.status === "active" ? "Desativar" : "Reativar"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}

              {filtrados.length === 0 && (
                <p className="text-sm text-muted-foreground p-8 text-center">
                  {busca ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado ainda."}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConvite} onOpenChange={setShowConvite}>
        <DialogContent data-testid="dialog-convidar-usuario">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome completo *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="Ex: Ana Silva" data-testid="input-usuario-nome" />
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input type="email" value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  placeholder="ana@empresa.com" data-testid="input-usuario-email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Usuário (login) *</Label>
                <Input value={form.username}
                  onChange={e => setForm({...form, username: e.target.value})}
                  placeholder="ana.silva" data-testid="input-usuario-username" />
              </div>
              <div className="space-y-1">
                <Label>Senha inicial *</Label>
                <Input type="password" value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  data-testid="input-usuario-senha" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Perfil de acesso *</Label>
              <Select value={form.perfilId} onValueChange={v => setForm({...form, perfilId: v})}>
                <SelectTrigger data-testid="select-usuario-perfil">
                  <SelectValue placeholder="Selecione um perfil..." />
                </SelectTrigger>
                <SelectContent>
                  {(perfis as any[]).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {empresas.length > 1 && (
              <div className="space-y-2">
                <Label>Acesso por empresa <span className="text-muted-foreground">(deixe em branco para todas)</span></Label>
                <div className="space-y-1 border rounded-md p-3">
                  {empresas.map((e: any) => (
                    <label key={e.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox"
                        checked={form.empresasIds.includes(e.id)}
                        onChange={() => toggleEmpresa(e.id)}
                        data-testid={`check-empresa-${e.id}`}
                      />
                      <span className="text-sm">{e.nomeFantasia ?? e.razaoSocial}</span>
                      {e.cnpj && <Badge variant="outline" className="text-xs">{e.cnpj}</Badge>}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvite(false)}>Cancelar</Button>
            <Button
              onClick={() => convidarMutation.mutate(form)}
              disabled={convidarMutation.isPending || !form.name || !form.email || !form.perfilId}
              data-testid="btn-salvar-convite"
            >
              {convidarMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Convidar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
