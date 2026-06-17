import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Crown,
  Handshake,
  Users,
  Package,
  DollarSign,
  Store,
  Plus,
  Trash2,
  Edit,
  Loader2,
  ArrowRight,
  Check,
  X,
  Shield,
  Zap,
  Network,
  Link2,
  Percent,
  RefreshCw,
  CheckCircle2,
  Award,
  Search,
  CheckCircle,
} from "lucide-react";

const MODULE_DISPLAY_LABELS: Record<string, string> = {
  crm: "XOS CRM",
  vendas: "Vendas",
  estoque: "Estoque",
  financeiro: "Financeiro",
  fisco: "Fiscal",
  rh: "RH",
  projetos: "Projetos",
  qualidade: "Qualidade",
  producao: "Produção",
  os: "Ordens de Serviço",
  logistica: "Logística",
  ordens: "Ordens de Serviço",
  bi: "Business Intelligence",
  manus: "Manus IA",
  ide: "IDE",
  whatsapp: "WhatsApp",
  retail: "Retail / PDV",
  cockpit: "Cockpit",
};

// ==========================================
// PERFIS SUB-SECTION
// ==========================================
function PerfisSubSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [perfilSearch, setPerfilSearch] = useState("");

  const { data: segments = [], isLoading } = useQuery<any[]>({
    queryKey: ["erp-segments-central"],
    queryFn: async () => {
      const res = await fetch("/api/erp/segments", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: erpConfig, refetch: refetchConfig } = useQuery<any>({
    queryKey: ["erp-config-central"],
    queryFn: async () => {
      const res = await fetch("/api/erp/config", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const applyMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`/api/erp/segments/${code}/apply`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao aplicar perfil");
      return res.json();
    },
    onSuccess: (data) => {
      refetchConfig();
      queryClient.invalidateQueries({ queryKey: ["erp-config-central"] });
      toast({ title: `Perfil "${data.segmento}" ativado`, description: `Módulos: ${data.modulosAtivados?.join(", ") || "—"}` });
    },
    onError: () => toast({ title: "Erro ao aplicar perfil", variant: "destructive" }),
  });

  const filtered = segments.filter((seg: any) =>
    !perfilSearch ||
    seg.name?.toLowerCase().includes(perfilSearch.toLowerCase()) ||
    seg.description?.toLowerCase().includes(perfilSearch.toLowerCase()) ||
    seg.category?.toLowerCase().includes(perfilSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Perfis de Segmento</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecione o perfil do negócio. O perfil ativa automaticamente os módulos correspondentes no sistema.
          </p>
        </div>
        {erpConfig?.segment_id && (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="w-3 h-3" />
            Perfil ativo
          </Badge>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-8 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Buscar perfil..."
          value={perfilSearch}
          onChange={(e) => setPerfilSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-400">
            <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{perfilSearch ? "Nenhum perfil encontrado." : "Nenhum perfil cadastrado."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((seg: any) => {
            const isAtivo = erpConfig?.segment_id === seg.id;
            const featureKeys = Object.keys(seg.features ?? {}).filter((k) => seg.features[k]);
            return (
              <Card
                key={seg.id}
                className={`relative transition-all ${isAtivo ? "border-primary ring-1 ring-primary" : "hover:border-slate-400"}`}
              >
                {isAtivo && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="default" className="text-[10px] gap-1 py-0">
                      <CheckCircle className="w-2.5 h-2.5" />
                      Ativo
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm leading-tight pr-14">{seg.name}</CardTitle>
                  <CardDescription className="text-xs">{seg.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(seg.modules ?? []).filter((m: string) => m !== "plus").length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(seg.modules as string[])
                        .filter((mod: string) => mod !== "plus")
                        .map((mod: string) => (
                          <Badge key={mod} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {MODULE_DISPLAY_LABELS[mod] ?? mod}
                          </Badge>
                        ))}
                    </div>
                  )}
                  {featureKeys.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {featureKeys.slice(0, 4).map((feat) => (
                        <span key={feat} className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{feat}</span>
                      ))}
                      {featureKeys.length > 4 && (
                        <span className="text-[10px] text-slate-400">+{featureKeys.length - 4}</span>
                      )}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant={isAtivo ? "outline" : "default"}
                    className="w-full mt-1"
                    disabled={isAtivo || applyMutation.isPending}
                    onClick={() => applyMutation.mutate(seg.code)}
                  >
                    {isAtivo ? "Perfil em uso" : applyMutation.isPending ? "Aplicando..." : "Aplicar perfil"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==========================================
// GRUPOS SUB-SECTION
// ==========================================
function GruposSubSection({ tenants }: { tenants: TenantBasic[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedGrupo, setExpandedGrupo] = useState<number | null>(null);
  const [showAddMembro, setShowAddMembro] = useState<number | null>(null);
  const [newGrupo, setNewGrupo] = useState({ tenantId: "", nome: "", descricao: "", tipo: "grupo_simples" });
  const [newMembro, setNewMembro] = useState({ empresaId: "", papel: "associada", participacao: "100" });
  const [syncingGrupoId, setSyncingGrupoId] = useState<number | null>(null);

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["admin-grupos", selectedTenantId],
    queryFn: async () => {
      const params = selectedTenantId !== "all" ? `?tenantId=${selectedTenantId}` : "";
      const res = await fetch(`/api/admin/grupos${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch grupos");
      return res.json();
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["admin-empresas", selectedTenantId],
    queryFn: async () => {
      const params = selectedTenantId !== "all" ? `?tenantId=${selectedTenantId}` : "";
      const res = await fetch(`/api/admin/empresas${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/grupos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ...data, tenantId: parseInt(data.tenantId) }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-grupos"] });
      setShowCreate(false);
      setNewGrupo({ tenantId: "", nome: "", descricao: "", tipo: "grupo_simples" });
      toast({ title: "Grupo criado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar grupo", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/grupos/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Falha ao excluir");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-grupos"] });
      toast({ title: "Grupo excluído" });
    },
  });

  const addMembroMutation = useMutation({
    mutationFn: async ({ grupoId, data }: { grupoId: number; data: any }) => {
      const res = await fetch(`/api/admin/grupos/${grupoId}/membros`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ empresaId: parseInt(data.empresaId), papel: data.papel, participacao: data.participacao }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-grupos"] });
      setShowAddMembro(null);
      setNewMembro({ empresaId: "", papel: "associada", participacao: "100" });
      toast({ title: "Membro adicionado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeMembroMutation = useMutation({
    mutationFn: async ({ grupoId, membroId }: { grupoId: number; membroId: number }) => {
      const res = await fetch(`/api/admin/grupos/${grupoId}/membros/${membroId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Falha");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-grupos"] }),
  });

  const handleSync = async (grupoId: number) => {
    setSyncingGrupoId(grupoId);
    try {
      const res = await fetch(`/api/admin/grupos/${grupoId}/sync`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Sincronizado com o Control", description: data.mensagem });
        queryClient.invalidateQueries({ queryKey: ["admin-grupos"] });
      } else {
        toast({ title: "Erro na sincronização", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSyncingGrupoId(null);
    }
  };

  const tipoLabel: Record<string, string> = { grupo_simples: "Grupo Simples", holding: "Holding", franquia: "Franquia" };
  const papelLabel: Record<string, string> = { matriz: "Matriz", associada: "Associada", filial: "Filial", cliente_externo: "Cliente Externo" };
  const papelColor: Record<string, string> = { matriz: "bg-blue-100 text-blue-700", associada: "bg-green-100 text-green-700", filial: "bg-purple-100 text-purple-700", cliente_externo: "bg-slate-100 text-slate-700" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tenants</SelectItem>
              {tenants.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-500">{grupos.length} grupo(s)</span>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-new-grupo">
          <Plus className="w-4 h-4 mr-2" />
          Novo Grupo
        </Button>
      </div>

      {/* Dialog Novo Grupo */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Novo Grupo Empresarial</CardTitle>
              <CardDescription>Define o agrupamento econômico de empresas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tenant *</Label>
                <Select value={newGrupo.tenantId} onValueChange={v => setNewGrupo({ ...newGrupo, tenantId: v })}>
                  <SelectTrigger data-testid="select-grupo-tenant"><SelectValue placeholder="Selecione o tenant" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome do Grupo *</Label>
                <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={newGrupo.nome} onChange={e => setNewGrupo({ ...newGrupo, nome: e.target.value })} placeholder="Ex: Grupo Impacto" data-testid="input-grupo-nome" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={newGrupo.tipo} onValueChange={v => setNewGrupo({ ...newGrupo, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grupo_simples">Grupo Simples</SelectItem>
                    <SelectItem value="holding">Holding</SelectItem>
                    <SelectItem value="franquia">Franquia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição</Label>
                <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={newGrupo.descricao} onChange={e => setNewGrupo({ ...newGrupo, descricao: e.target.value })} placeholder="Descrição opcional" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button onClick={() => createMutation.mutate(newGrupo)} disabled={!newGrupo.tenantId || !newGrupo.nome || createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Criar Grupo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-12">
          <Network className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-700">Nenhum grupo cadastrado</h3>
          <p className="text-slate-500 text-sm">Crie grupos para organizar empresas em estruturas econômicas</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {grupos.map((grupo: any) => (
            <Card key={grupo.id} data-testid={`card-grupo-${grupo.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 mt-0.5">
                      <Network className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{grupo.nome}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{tipoLabel[grupo.tipo] || grupo.tipo}</span>
                        {!grupo.ativo && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Inativo</span>}
                        {grupo.grupoControlId ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />Sincronizado
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSync(grupo.id)}
                            disabled={syncingGrupoId === grupo.id}
                            className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                            data-testid={`btn-sync-grupo-${grupo.id}`}
                          >
                            {syncingGrupoId === grupo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Sincronizar com Control
                          </button>
                        )}
                      </div>
                      {grupo.descricao && <p className="text-sm text-slate-500 mt-0.5">{grupo.descricao}</p>}
                      <p className="text-xs text-slate-400 mt-1">{grupo.membros?.length || 0} empresa(s) membro</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setExpandedGrupo(expandedGrupo === grupo.id ? null : grupo.id)}>
                      {expandedGrupo === grupo.id ? "Fechar" : "Ver membros"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(grupo.id)} data-testid={`button-delete-grupo-${grupo.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Membros expandido */}
                {expandedGrupo === grupo.id && (
                  <div className="mt-4 border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium">Empresas Membros</p>
                      <Button size="sm" variant="outline" onClick={() => setShowAddMembro(grupo.id)} data-testid={`button-add-membro-${grupo.id}`}>
                        <Plus className="w-3 h-3 mr-1" />Adicionar
                      </Button>
                    </div>

                    {/* Form add membro */}
                    {showAddMembro === grupo.id && (
                      <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-1">
                            <Label className="text-xs">Empresa</Label>
                            <Select value={newMembro.empresaId} onValueChange={v => setNewMembro({ ...newMembro, empresaId: v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                              <SelectContent>
                                {empresas.filter((e: any) => !grupo.membros?.find((m: any) => m.empresaId === e.id)).map((e: any) => (
                                  <SelectItem key={e.id} value={String(e.id)}>{e.razaoSocial}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Papel</Label>
                            <Select value={newMembro.papel} onValueChange={v => setNewMembro({ ...newMembro, papel: v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="matriz">Matriz</SelectItem>
                                <SelectItem value="associada">Associada</SelectItem>
                                <SelectItem value="filial">Filial</SelectItem>
                                <SelectItem value="cliente_externo">Cliente Externo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Participação %</Label>
                            <input className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs" type="number" min="0" max="100" step="0.1" value={newMembro.participacao} onChange={e => setNewMembro({ ...newMembro, participacao: e.target.value })} />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setShowAddMembro(null)}>Cancelar</Button>
                          <Button size="sm" onClick={() => addMembroMutation.mutate({ grupoId: grupo.id, data: newMembro })} disabled={!newMembro.empresaId || addMembroMutation.isPending}>
                            Confirmar
                          </Button>
                        </div>
                      </div>
                    )}

                    {grupo.membros?.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-2">Nenhuma empresa adicionada</p>
                    ) : (
                      <div className="space-y-2">
                        {grupo.membros?.map((m: any) => (
                          <div key={m.id} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${papelColor[m.papel] || 'bg-slate-100 text-slate-600'}`}>
                                {papelLabel[m.papel] || m.papel}
                              </span>
                              <div>
                                <p className="text-sm font-medium">{m.razaoSocial}</p>
                                {m.cnpj && <p className="text-xs text-slate-400">{m.cnpj}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Percent className="w-3 h-3" />{m.participacao}%
                              </span>
                              <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => removeMembroMutation.mutate({ grupoId: grupo.id, membroId: m.id })}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// TENANTS SECTION - Multi-Tenant Management
// ==========================================

interface TenantData {
  id: number;
  name: string;
  slug?: string;
  email?: string;
  phone?: string;
  plan?: string;
  status?: string;
  tenantType?: string;
  parentTenantId?: number | null;
  partnerCode?: string;
  commissionRate?: string;
  maxUsers?: number;
  maxStorageMb?: number;
  createdAt: string;
  parentTenant?: { id: number; name: string; tenantType: string } | null;
  childCount?: number;
}

interface TenantFeatures {
  ide?: boolean;
  whatsapp?: boolean;
  crm?: boolean;
  erp?: boolean;
  bi?: boolean;
  manus?: boolean;
  centralApis?: boolean;
  comunidades?: boolean;
  biblioteca?: boolean;
  retail?: boolean;
  plus?: boolean;
  fisco?: boolean;
  cockpit?: boolean;
  compass?: boolean;
  production?: boolean;
  support?: boolean;
  xosCrm?: boolean;
  [key: string]: any;
}

interface TenantPlanData {
  id: number;
  code: string;
  name: string;
  description?: string;
  tenantType: string;
  maxUsers?: number;
  maxStorageMb?: number;
  features?: TenantFeatures;
  monthlyPrice?: number;
  yearlyPrice?: number;
  trialDays?: number;
  isActive?: string;
  sortOrder?: number;
}

const MODULE_CATEGORIES = [
  {
    label: "Core",
    modules: [
      { key: "erp", label: "SOE (ERP)" },
      { key: "crm", label: "CRM" },
      { key: "bi", label: "Business Intelligence" },
    ]
  },
  {
    label: "Operacional",
    modules: [
      { key: "retail", label: "Retail (PDV)" },
      { key: "plus", label: "Plus (ERP Laravel)" },
      { key: "fisco", label: "Fiscal (NF-e/NFC-e)" },
      { key: "production", label: "Produção" },
    ]
  },
  {
    label: "Inteligência",
    modules: [
      { key: "manus", label: "Manus (IA)" },
      { key: "ide", label: "IDE" },
      { key: "cockpit", label: "Cockpit" },
    ]
  },
  {
    label: "Comunicação",
    modules: [
      { key: "whatsapp", label: "WhatsApp" },
      { key: "xosCrm", label: "XOS CRM" },
      { key: "comunidades", label: "Comunidades" },
    ]
  },
  {
    label: "Plataforma",
    modules: [
      { key: "centralApis", label: "Central APIs" },
      { key: "compass", label: "Compass" },
      { key: "support", label: "Suporte" },
      { key: "biblioteca", label: "Biblioteca" },
    ]
  },
];

interface TenantStats {
  total: number;
  byType: { master: number; partner: number; client: number };
  byStatus: { active: number; trial: number; suspended: number; cancelled: number };
}

async function fetchTenants(type?: string): Promise<TenantData[]> {
  const url = type ? `/api/admin/tenants?type=${type}` : "/api/admin/tenants";
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch tenants");
  return response.json();
}

async function fetchTenantPlans(): Promise<TenantPlanData[]> {
  const response = await fetch("/api/admin/plans", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch plans");
  return response.json();
}

async function fetchTenantStats(): Promise<TenantStats> {
  const response = await fetch("/api/admin/tenants/stats", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch stats");
  return response.json();
}

interface TenantBasic {
  id: number;
  name: string;
  tenantType?: string;
}

function EmpresasSubSection({ tenants }: { tenants: TenantBasic[] }) {
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("all");
  const [showCreateEmpresa, setShowCreateEmpresa] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<any>(null);
  const [formData, setFormData] = useState({
    tenantId: "",
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    ie: "",
    im: "",
    email: "",
    phone: "",
    tipo: "filial",
    status: "active",
    segmento: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    codigoIbge: "",
    regimeTributario: "",
    ambienteFiscal: "homologacao",
    serieNfe: 1,
    serieNfce: 1,
  });

  const { data: segmentList = [] } = useQuery<any[]>({
    queryKey: ["erp-segments-empresas"],
    queryFn: async () => {
      const res = await fetch("/api/erp/segments", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["admin-empresas", selectedTenantId],
    queryFn: async () => {
      const params = selectedTenantId !== "all" ? `?tenantId=${selectedTenantId}` : "";
      const res = await fetch(`/api/admin/empresas${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch empresas");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/admin/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, tenantId: parseInt(data.tenantId), serieNfe: Number(data.serieNfe), serieNfce: Number(data.serieNfce) }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create empresa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-empresas"] });
      setShowCreateEmpresa(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/admin/empresas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update empresa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-empresas"] });
      setEditingEmpresa(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/empresas/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete empresa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-empresas"] });
    },
  });

  const resetForm = () => {
    setFormData({
      tenantId: "", razaoSocial: "", nomeFantasia: "", cnpj: "", ie: "", im: "",
      email: "", phone: "", tipo: "filial", status: "active", segmento: "", cep: "", logradouro: "",
      numero: "", complemento: "", bairro: "", cidade: "", uf: "", codigoIbge: "",
      regimeTributario: "", ambienteFiscal: "homologacao", serieNfe: 1, serieNfce: 1,
    });
  };

  const startEdit = (emp: any) => {
    setEditingEmpresa(emp);
    setFormData({
      tenantId: emp.tenantId?.toString() || "",
      razaoSocial: emp.razaoSocial || "",
      nomeFantasia: emp.nomeFantasia || "",
      cnpj: emp.cnpj || "",
      ie: emp.ie || "",
      im: emp.im || "",
      email: emp.email || "",
      phone: emp.phone || "",
      tipo: emp.tipo || "filial",
      status: emp.status || "active",
      segmento: emp.segmento || "",
      cep: emp.cep || "",
      logradouro: emp.logradouro || "",
      numero: emp.numero || "",
      complemento: emp.complemento || "",
      bairro: emp.bairro || "",
      cidade: emp.cidade || "",
      uf: emp.uf || "",
      codigoIbge: emp.codigoIbge || "",
      regimeTributario: emp.regimeTributario || "",
      ambienteFiscal: emp.ambienteFiscal || "homologacao",
      serieNfe: emp.serieNfe || 1,
      serieNfce: emp.serieNfce || 1,
    });
  };

  const getTenantName = (tid: number) => tenants.find(t => t.id === tid)?.name || `Tenant #${tid}`;

  const showForm = showCreateEmpresa || editingEmpresa;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger className="w-[200px]" data-testid="select-empresa-tenant-filter">
              <SelectValue placeholder="Filtrar por tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tenants</SelectItem>
              {tenants.map(t => (
                <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-500">{empresas.length} empresa(s)</span>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateEmpresa(true); setEditingEmpresa(null); }} size="sm" data-testid="button-create-empresa">
          <Plus className="w-4 h-4 mr-1" /> Nova Empresa
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingEmpresa ? "Editar Empresa" : "Nova Empresa"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Tenant *</Label>
                <Select value={formData.tenantId} onValueChange={(v) => setFormData({ ...formData, tenantId: v })} disabled={!!editingEmpresa}>
                  <SelectTrigger data-testid="select-empresa-tenant">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger data-testid="select-empresa-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matriz">Matriz</SelectItem>
                    <SelectItem value="filial">Filial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="select-empresa-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Segmento / Perfil</Label>
                <Select value={formData.segmento} onValueChange={(v) => setFormData({ ...formData, segmento: v })}>
                  <SelectTrigger data-testid="select-empresa-segmento">
                    <SelectValue placeholder="Selecione o perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem perfil</SelectItem>
                    {segmentList.map((seg: any) => (
                      <SelectItem key={seg.id} value={seg.code}>{seg.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">CNPJ *</Label>
                <Input value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} placeholder="00.000.000/0000-00" data-testid="input-empresa-cnpj" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Razão Social *</Label>
                <Input value={formData.razaoSocial} onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })} placeholder="Razão Social completa" data-testid="input-empresa-razao" />
              </div>
              <div>
                <Label className="text-xs">Nome Fantasia</Label>
                <Input value={formData.nomeFantasia} onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })} placeholder="Nome Fantasia" data-testid="input-empresa-fantasia" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">IE</Label>
                <Input value={formData.ie} onChange={(e) => setFormData({ ...formData, ie: e.target.value })} placeholder="Inscrição Estadual" data-testid="input-empresa-ie" />
              </div>
              <div>
                <Label className="text-xs">IM</Label>
                <Input value={formData.im} onChange={(e) => setFormData({ ...formData, im: e.target.value })} placeholder="Inscrição Municipal" data-testid="input-empresa-im" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@empresa.com" data-testid="input-empresa-email" />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(00) 0000-0000" data-testid="input-empresa-phone" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <Label className="text-xs">CEP</Label>
                <Input value={formData.cep} onChange={(e) => setFormData({ ...formData, cep: e.target.value })} placeholder="00000-000" data-testid="input-empresa-cep" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Logradouro</Label>
                <Input value={formData.logradouro} onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })} data-testid="input-empresa-logradouro" />
              </div>
              <div>
                <Label className="text-xs">Número</Label>
                <Input value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} data-testid="input-empresa-numero" />
              </div>
              <div>
                <Label className="text-xs">Cidade</Label>
                <Input value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} data-testid="input-empresa-cidade" />
              </div>
              <div>
                <Label className="text-xs">UF</Label>
                <Input value={formData.uf} onChange={(e) => setFormData({ ...formData, uf: e.target.value })} placeholder="SP" maxLength={2} data-testid="input-empresa-uf" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Regime Tributário</Label>
                <Select value={formData.regimeTributario} onValueChange={(v) => setFormData({ ...formData, regimeTributario: v })}>
                  <SelectTrigger data-testid="select-empresa-regime">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Simples Nacional</SelectItem>
                    <SelectItem value="presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="real">Lucro Real</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ambiente Fiscal</Label>
                <Select value={formData.ambienteFiscal} onValueChange={(v) => setFormData({ ...formData, ambienteFiscal: v })}>
                  <SelectTrigger data-testid="select-empresa-ambiente">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao">Homologação</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Série NF-e</Label>
                <Input type="number" value={formData.serieNfe} onChange={(e) => setFormData({ ...formData, serieNfe: parseInt(e.target.value) || 1 })} data-testid="input-empresa-serie-nfe" />
              </div>
              <div>
                <Label className="text-xs">Série NFC-e</Label>
                <Input type="number" value={formData.serieNfce} onChange={(e) => setFormData({ ...formData, serieNfce: parseInt(e.target.value) || 1 })} data-testid="input-empresa-serie-nfce" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreateEmpresa(false); setEditingEmpresa(null); resetForm(); }} data-testid="button-cancel-empresa">
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!formData.tenantId || !formData.razaoSocial || !formData.cnpj || createMutation.isPending || updateMutation.isPending}
                onClick={() => {
                  if (editingEmpresa) {
                    const { tenantId, ...rest } = formData;
                    updateMutation.mutate({ id: editingEmpresa.id, data: { ...rest, serieNfe: Number(rest.serieNfe), serieNfce: Number(rest.serieNfce) } });
                  } else {
                    createMutation.mutate(formData);
                  }
                }}
                data-testid="button-save-empresa"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {editingEmpresa ? "Salvar" : "Criar Empresa"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : empresas.length === 0 ? (
        <div className="text-center py-12">
          <Store className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-700">Nenhuma empresa cadastrada</h3>
          <p className="text-slate-500 text-sm">Cadastre empresas (matriz/filiais) vinculadas aos tenants</p>
        </div>
      ) : (
        <div className="space-y-2">
          {empresas.map((emp: any) => (
            <Card key={emp.id} className="hover:shadow-sm transition-shadow" data-testid={`card-empresa-${emp.id}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${emp.tipo === "matriz" ? "bg-amber-100" : "bg-blue-50"}`}>
                      {emp.tipo === "matriz" ? <Building2 className="w-4 h-4 text-amber-600" /> : <Store className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{emp.nomeFantasia || emp.razaoSocial}</span>
                        <Badge variant="outline" className={emp.tipo === "matriz" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                          {emp.tipo === "matriz" ? "Matriz" : "Filial"}
                        </Badge>
                        <Badge variant="outline" className={emp.status === "active" ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-500"}>
                          {emp.status === "active" ? "Ativa" : "Inativa"}
                        </Badge>
                        {emp.segmento && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1">
                            <Award className="w-2.5 h-2.5" />
                            {emp.segmento}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span>{emp.cnpj}</span>
                        {emp.cidade && <span>{emp.cidade}/{emp.uf}</span>}
                        <span className="text-slate-400">Tenant: {getTenantName(emp.tenantId)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(emp)} data-testid={`button-edit-empresa-${emp.id}`}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => {
                      if (confirm("Deseja excluir esta empresa?")) deleteMutation.mutate(emp.id);
                    }} data-testid={`button-delete-empresa-${emp.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MultiTenantSection() {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState("tenants");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreatePlanDialog, setShowCreatePlanDialog] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantData | null>(null);
  const [editingPlan, setEditingPlan] = useState<TenantPlanData | null>(null);
  const [newTenant, setNewTenant] = useState({
    name: "",
    email: "",
    tenantType: "client",
    parentTenantId: "",
    plan: "free",
  });
  const [newPlan, setNewPlan] = useState<{
    name: string; description: string; tenantType: string; maxUsers: number;
    maxStorageMb: number; monthlyPrice: number; yearlyPrice: number; trialDays: number;
    features: TenantFeatures; code: string;
  }>({
    name: "",
    description: "",
    code: "",
    tenantType: "client",
    maxUsers: 5,
    maxStorageMb: 1000,
    monthlyPrice: 0,
    yearlyPrice: 0,
    trialDays: 14,
    features: {},
  });

  const { data: tenants = [], isLoading: loadingTenants } = useQuery({
    queryKey: ["admin-tenants", typeFilter],
    queryFn: () => fetchTenants(typeFilter === "all" ? undefined : typeFilter),
  });

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: fetchTenantPlans,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-tenant-stats"],
    queryFn: fetchTenantStats,
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: typeof newTenant) => {
      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          parentTenantId: data.parentTenantId ? parseInt(data.parentTenantId) : null,
        }),
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(err.error || "Falha ao criar tenant");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-stats"] });
      setShowCreateDialog(false);
      setNewTenant({ name: "", email: "", tenantType: "client", parentTenantId: "", plan: "free" });
      toast({ title: "Tenant criado com sucesso" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao criar tenant", description: e.message, variant: "destructive" });
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/tenants/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-stats"] });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: async (data: TenantData) => {
      const response = await fetch(`/api/admin/tenants/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update tenant");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-stats"] });
      setEditingTenant(null);
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: typeof newPlan) => {
      const response = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create plan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      setShowCreatePlanDialog(false);
      setNewPlan({ name: "", description: "", code: "", tenantType: "client", maxUsers: 5, maxStorageMb: 1000, monthlyPrice: 0, yearlyPrice: 0, trialDays: 14, features: {} });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (data: TenantPlanData) => {
      const response = await fetch(`/api/admin/plans/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update plan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      setEditingPlan(null);
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/plans/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
    },
  });

  const propagatePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/plans/${id}/propagate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to propagate");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast({ title: "Plano propagado", description: `${data.propagated} tenant(s) atualizados com os módulos do plano ${data.planCode}` });
    },
  });

  const seedPlansMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/plans/seed", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to seed plans");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast({ title: "Planos criados", description: data.message });
    },
  });

  const { toast } = useToast();

  const getTenantTypeIcon = (type?: string) => {
    switch (type) {
      case "master": return <Crown className="w-4 h-4 text-amber-500" />;
      case "partner": return <Handshake className="w-4 h-4 text-blue-500" />;
      default: return <Building2 className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTenantTypeBadge = (type?: string) => {
    switch (type) {
      case "master": return <Badge className="bg-amber-100 text-amber-700 border-amber-300">Master</Badge>;
      case "partner": return <Badge className="bg-blue-100 text-blue-700 border-blue-300">Parceiro</Badge>;
      default: return <Badge className="bg-slate-100 text-slate-700 border-slate-300">Empresa</Badge>;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-100 text-green-700 border-green-300">Ativo</Badge>;
      case "trial": return <Badge className="bg-purple-100 text-purple-700 border-purple-300">Trial</Badge>;
      case "suspended": return <Badge className="bg-red-100 text-red-700 border-red-300">Suspenso</Badge>;
      case "cancelled": return <Badge className="bg-slate-100 text-slate-500 border-slate-300">Cancelado</Badge>;
      default: return <Badge variant="outline">-</Badge>;
    }
  };

  const partnerTenants = tenants.filter(t => t.tenantType === "partner" || t.tenantType === "master");

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100">
                  <Building2 className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-slate-500">Total de Tenants</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Crown className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.byType.master}</p>
                  <p className="text-xs text-slate-500">Master</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Handshake className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.byType.partner}</p>
                  <p className="text-xs text-slate-500">Parceiros</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.byType.client}</p>
                  <p className="text-xs text-slate-500">Empresas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="tenants" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Tenants
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="commissions" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Comissões
            </TabsTrigger>
            <TabsTrigger value="empresas" className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              Empresas
            </TabsTrigger>
            <TabsTrigger value="grupos" className="flex items-center gap-2" data-testid="tab-grupos">
              <Network className="w-4 h-4" />
              Grupos
            </TabsTrigger>
            <TabsTrigger value="perfis" className="flex items-center gap-2" data-testid="tab-perfis">
              <Award className="w-4 h-4" />
              Perfis
            </TabsTrigger>
          </TabsList>

          {activeSubTab === "tenants" && (
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-tenant-type-filter">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                  <SelectItem value="partner">Parceiros</SelectItem>
                  <SelectItem value="client">Empresas</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-tenant">
                <Plus className="w-4 h-4 mr-2" />
                Novo Tenant
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="tenants">
          {loadingTenants ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid gap-3">
              {tenants.map((tenant) => (
                <Card key={tenant.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-slate-100">
                          {getTenantTypeIcon(tenant.tenantType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{tenant.name}</h3>
                            {getTenantTypeBadge(tenant.tenantType)}
                            {getStatusBadge(tenant.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                            {tenant.email && <span>{tenant.email}</span>}
                            {tenant.plan && <span>Plano: {tenant.plan}</span>}
                            {tenant.parentTenant && (
                              <span className="flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" />
                                {tenant.parentTenant.name}
                              </span>
                            )}
                            {tenant.childCount !== undefined && tenant.childCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {tenant.childCount} filhos
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingTenant(tenant)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {tenant.tenantType !== "master" && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700"
                            onClick={() => deleteTenantMutation.mutate(tenant.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {tenants.length === 0 && (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-700">Nenhum tenant encontrado</h3>
                  <p className="text-slate-500 text-sm">Clique em "Novo Tenant" para criar o primeiro</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="plans">
          <div className="flex justify-end gap-2 mb-4">
            {plans.length === 0 && (
              <Button variant="outline" onClick={() => seedPlansMutation.mutate()} disabled={seedPlansMutation.isPending}>
                {seedPlansMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                <Zap className="w-4 h-4 mr-2" />
                Gerar Planos Padrão
              </Button>
            )}
            <Button onClick={() => setShowCreatePlanDialog(true)} data-testid="button-new-plan">
              <Plus className="w-4 h-4 mr-2" />
              Novo Plano
            </Button>
          </div>
          {loadingPlans ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <Card key={plan.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{plan.tenantType}</Badge>
                        <Button variant="ghost" size="sm" title="Editar" onClick={() => setEditingPlan(plan)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" size="sm" title="Propagar para tenants"
                          onClick={() => propagatePlanMutation.mutate(plan.id)}
                          disabled={propagatePlanMutation.isPending}
                        >
                          <Zap className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Excluir"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deletePlanMutation.mutate(plan.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Mensal:</span>
                        <span className="font-medium">R$ {((plan.monthlyPrice || 0) / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Anual:</span>
                        <span className="font-medium">R$ {((plan.yearlyPrice || 0) / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Usuários:</span>
                        <span>{plan.maxUsers || 5}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Armazenamento:</span>
                        <span>{plan.maxStorageMb || 1000} MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Trial:</span>
                        <span>{plan.trialDays || 14} dias</span>
                      </div>
                    </div>
                    {plan.features && Object.keys(plan.features).length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-slate-600 mb-2">Módulos incluídos:</p>
                        <div className="flex flex-wrap gap-1">
                          {MODULE_CATEGORIES.flatMap(cat => cat.modules)
                            .filter(m => (plan.features as any)?.[m.key])
                            .map(m => (
                              <Badge key={m.key} variant="secondary" className="text-xs px-1.5 py-0">
                                {m.label}
                              </Badge>
                            ))
                          }
                          {MODULE_CATEGORIES.flatMap(cat => cat.modules).filter(m => (plan.features as any)?.[m.key]).length === 0 && (
                            <span className="text-xs text-slate-400">Nenhum módulo definido</span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {plans.length === 0 && (
                <div className="col-span-3 text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-700">Nenhum plano cadastrado</h3>
                  <p className="text-slate-500 text-sm">Os planos definem limites e features por tipo de tenant</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="commissions">
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-700">Comissões de Parceiros</h3>
            <p className="text-slate-500 text-sm">Gerencie comissões dos parceiros sobre vendas de empresas</p>
            <p className="text-slate-400 text-xs mt-2">Funcionalidade disponível quando houver parceiros e empresas cadastradas</p>
          </div>
        </TabsContent>

        <TabsContent value="empresas">
          <EmpresasSubSection tenants={tenants} />
        </TabsContent>

        <TabsContent value="grupos">
          <GruposSubSection tenants={tenants} />
        </TabsContent>

        <TabsContent value="perfis">
          <PerfisSubSection />
        </TabsContent>
      </Tabs>

      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Novo Tenant</CardTitle>
              <CardDescription>Crie um novo tenant na hierarquia</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  placeholder="Nome do tenant"
                  data-testid="input-tenant-name"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newTenant.email}
                  onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  data-testid="input-tenant-email"
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={newTenant.tenantType} onValueChange={(v) => setNewTenant({ ...newTenant, tenantType: v })}>
                  <SelectTrigger data-testid="select-tenant-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Master</SelectItem>
                    <SelectItem value="partner">Parceiro</SelectItem>
                    <SelectItem value="client">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(newTenant.tenantType === "partner" || newTenant.tenantType === "client") && (
                <div>
                  <Label>Tenant Pai</Label>
                  <Select value={newTenant.parentTenantId} onValueChange={(v) => setNewTenant({ ...newTenant, parentTenantId: v })}>
                    <SelectTrigger data-testid="select-parent-tenant">
                      <SelectValue placeholder="Selecione o tenant pai" />
                    </SelectTrigger>
                    <SelectContent>
                      {partnerTenants.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name} ({t.tenantType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Plano</Label>
                <Select value={newTenant.plan} onValueChange={(v) => setNewTenant({ ...newTenant, plan: v })}>
                  <SelectTrigger data-testid="select-tenant-plan">
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.filter(p => String(p.isActive) !== "false").map(p => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.name} - R$ {((p.monthlyPrice || 0) / 100).toFixed(2)}/mês
                      </SelectItem>
                    ))}
                    {plans.length === 0 && (
                      <>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => createTenantMutation.mutate(newTenant)}
                  disabled={!newTenant.name || createTenantMutation.isPending}
                  data-testid="button-save-tenant"
                >
                  {createTenantMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Criar Tenant
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {editingTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Editar Tenant</CardTitle>
              <CardDescription>Atualize as informações do tenant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editingTenant.name}
                  onChange={(e) => setEditingTenant({ ...editingTenant, name: e.target.value })}
                  placeholder="Nome do tenant"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editingTenant.email || ""}
                  onChange={(e) => setEditingTenant({ ...editingTenant, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select 
                  value={editingTenant.status || "active"} 
                  onValueChange={(v) => setEditingTenant({ ...editingTenant, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plano</Label>
                <Select 
                  value={editingTenant.plan || "free"} 
                  onValueChange={(v) => setEditingTenant({ ...editingTenant, plan: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.filter(p => String(p.isActive) !== "false").map(p => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.name} - R$ {((p.monthlyPrice || 0) / 100).toFixed(2)}/mês
                      </SelectItem>
                    ))}
                    {plans.length === 0 && (
                      <>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setEditingTenant(null)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => updateTenantMutation.mutate(editingTenant)}
                  disabled={!editingTenant.name || updateTenantMutation.isPending}
                >
                  {updateTenantMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showCreatePlanDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <Card className="w-full max-w-2xl mx-4">
            <CardHeader>
              <CardTitle>Novo Plano</CardTitle>
              <CardDescription>Crie um novo plano de assinatura com módulos incluídos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                    placeholder="Ex: Profissional"
                    data-testid="input-plan-name"
                  />
                </div>
                <div>
                  <Label>Código</Label>
                  <Input
                    value={newPlan.code}
                    onChange={(e) => setNewPlan({ ...newPlan, code: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                    placeholder="Ex: pro"
                    data-testid="input-plan-code"
                  />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  placeholder="Descrição do plano"
                  data-testid="input-plan-description"
                />
              </div>
              <div>
                <Label>Tipo de Tenant</Label>
                <Select value={newPlan.tenantType} onValueChange={(v) => setNewPlan({ ...newPlan, tenantType: v })}>
                  <SelectTrigger data-testid="select-plan-tenant-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Master</SelectItem>
                    <SelectItem value="partner">Parceiro</SelectItem>
                    <SelectItem value="client">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preço Mensal (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(newPlan.monthlyPrice / 100).toFixed(2)}
                    onChange={(e) => setNewPlan({ ...newPlan, monthlyPrice: Math.round(parseFloat(e.target.value || "0") * 100) })}
                    data-testid="input-plan-monthly-price"
                  />
                </div>
                <div>
                  <Label>Preço Anual (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(newPlan.yearlyPrice / 100).toFixed(2)}
                    onChange={(e) => setNewPlan({ ...newPlan, yearlyPrice: Math.round(parseFloat(e.target.value || "0") * 100) })}
                    data-testid="input-plan-yearly-price"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Máx. Usuários</Label>
                  <Input type="number" value={newPlan.maxUsers} onChange={(e) => setNewPlan({ ...newPlan, maxUsers: parseInt(e.target.value) || 5 })} />
                </div>
                <div>
                  <Label>Armazenamento (MB)</Label>
                  <Input type="number" value={newPlan.maxStorageMb} onChange={(e) => setNewPlan({ ...newPlan, maxStorageMb: parseInt(e.target.value) || 1000 })} />
                </div>
                <div>
                  <Label>Dias Trial</Label>
                  <Input type="number" value={newPlan.trialDays} onChange={(e) => setNewPlan({ ...newPlan, trialDays: parseInt(e.target.value) || 14 })} />
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Módulos Incluídos no Plano
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => {
                        const all: TenantFeatures = {};
                        MODULE_CATEGORIES.flatMap(c => c.modules).forEach(m => { all[m.key] = true; });
                        setNewPlan({ ...newPlan, features: all });
                      }}
                    >
                      <Check className="w-3 h-3 mr-1" /> Todos
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setNewPlan({ ...newPlan, features: {} })}>
                      <X className="w-3 h-3 mr-1" /> Nenhum
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {MODULE_CATEGORIES.map(cat => (
                    <div key={cat.label}>
                      <p className="text-xs font-medium text-slate-500 mb-1.5">{cat.label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {cat.modules.map(m => (
                          <div key={m.key} className="flex items-center justify-between bg-slate-50 rounded px-3 py-1.5">
                            <span className="text-sm">{m.label}</span>
                            <Switch
                              checked={!!newPlan.features[m.key]}
                              onCheckedChange={(checked) => {
                                setNewPlan({ ...newPlan, features: { ...newPlan.features, [m.key]: checked } });
                              }}
                              data-testid={`switch-plan-module-${m.key}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowCreatePlanDialog(false)}>Cancelar</Button>
                <Button 
                  onClick={() => createPlanMutation.mutate(newPlan)}
                  disabled={!newPlan.name || !newPlan.code || createPlanMutation.isPending}
                  data-testid="button-create-plan"
                >
                  {createPlanMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Criar Plano
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {editingPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <Card className="w-full max-w-2xl mx-4">
            <CardHeader>
              <CardTitle>Editar Plano</CardTitle>
              <CardDescription>Atualize as informações e módulos do plano</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    placeholder="Nome do plano"
                  />
                </div>
                <div>
                  <Label>Código</Label>
                  <Input value={editingPlan.code} disabled className="bg-slate-50" />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={editingPlan.description || ""}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  placeholder="Descrição do plano"
                />
              </div>
              <div>
                <Label>Tipo de Tenant</Label>
                <Select 
                  value={editingPlan.tenantType || "client"} 
                  onValueChange={(v) => setEditingPlan({ ...editingPlan, tenantType: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Master</SelectItem>
                    <SelectItem value="partner">Parceiro</SelectItem>
                    <SelectItem value="client">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preço Mensal (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={((editingPlan.monthlyPrice || 0) / 100).toFixed(2)}
                    onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPrice: Math.round(parseFloat(e.target.value || "0") * 100) })}
                  />
                </div>
                <div>
                  <Label>Preço Anual (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={((editingPlan.yearlyPrice || 0) / 100).toFixed(2)}
                    onChange={(e) => setEditingPlan({ ...editingPlan, yearlyPrice: Math.round(parseFloat(e.target.value || "0") * 100) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Máx. Usuários</Label>
                  <Input type="number" value={editingPlan.maxUsers || 5} onChange={(e) => setEditingPlan({ ...editingPlan, maxUsers: parseInt(e.target.value) || 5 })} />
                </div>
                <div>
                  <Label>Armazenamento (MB)</Label>
                  <Input type="number" value={editingPlan.maxStorageMb || 1000} onChange={(e) => setEditingPlan({ ...editingPlan, maxStorageMb: parseInt(e.target.value) || 1000 })} />
                </div>
                <div>
                  <Label>Dias Trial</Label>
                  <Input type="number" value={editingPlan.trialDays || 14} onChange={(e) => setEditingPlan({ ...editingPlan, trialDays: parseInt(e.target.value) || 14 })} />
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Módulos Incluídos no Plano
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => {
                        const all: TenantFeatures = {};
                        MODULE_CATEGORIES.flatMap(c => c.modules).forEach(m => { all[m.key] = true; });
                        setEditingPlan({ ...editingPlan, features: all });
                      }}
                    >
                      <Check className="w-3 h-3 mr-1" /> Todos
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingPlan({ ...editingPlan, features: {} })}>
                      <X className="w-3 h-3 mr-1" /> Nenhum
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {MODULE_CATEGORIES.map(cat => (
                    <div key={cat.label}>
                      <p className="text-xs font-medium text-slate-500 mb-1.5">{cat.label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {cat.modules.map(m => (
                          <div key={m.key} className="flex items-center justify-between bg-slate-50 rounded px-3 py-1.5">
                            <span className="text-sm">{m.label}</span>
                            <Switch
                              checked={!!(editingPlan.features as any)?.[m.key]}
                              onCheckedChange={(checked) => {
                                setEditingPlan({ ...editingPlan, features: { ...(editingPlan.features || {}), [m.key]: checked } });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setEditingPlan(null)}>Cancelar</Button>
                <Button 
                  onClick={() => updatePlanMutation.mutate(editingPlan)}
                  disabled={!editingPlan.name || updatePlanMutation.isPending}
                >
                  {updatePlanMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
