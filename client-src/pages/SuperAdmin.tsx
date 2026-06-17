import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Users,
  Package,
  FileText,
  Receipt,
  TrendingUp,
  Search,
  Plus,
  Eye,
  Edit,
  Crown,
  Loader2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Save,
  X,
  DollarSign
} from "lucide-react";
import { useLocation } from "wouter";

interface PlusStats {
  empresas: number;
  planos: number;
  mrr: number;
  usuarios: number;
  nfes: number;
  nfces: number;
}

interface Plano {
  id: number;
  nome: string;
  descricao: string;
  maximo_nfes: number;
  maximo_nfces: number;
  maximo_ctes: number;
  maximo_mdfes: number;
  maximo_usuarios: number;
  maximo_locais: number;
  valor: string;
  valor_implantacao: string;
  intervalo_dias: number;
  visivel_clientes: boolean;
  visivel_contadores: boolean;
  status: boolean;
  fiscal: boolean;
  modulos: string;
}

interface Empresa {
  id: number;
  nome: string;
  nome_fantasia: string | null;
  cpf_cnpj: string;
  email: string;
  celular: string | null;
  status: boolean;
  plano?: Plano;
}

interface Usuario {
  id: number;
  nome: string;
  email: string;
  login: string;
  admin: boolean;
  status: boolean;
  empresa?: Empresa;
}

async function fetchStats(): Promise<PlusStats> {
  const response = await fetch("/plus/api/suite/stats", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch stats");
  return response.json();
}

async function fetchPlanos(): Promise<Plano[]> {
  const response = await fetch("/plus/api/suite/planos", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch planos");
  return response.json();
}

async function fetchEmpresas(): Promise<Empresa[]> {
  const response = await fetch("/plus/api/suite/empresas", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch empresas");
  return response.json();
}

async function fetchUsuarios(): Promise<Usuario[]> {
  const response = await fetch("/plus/api/suite/usuarios", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch usuarios");
  return response.json();
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

function StatCard({ title, value, icon: Icon, color, subtitle }: { 
  title: string; 
  value: number | string; 
  icon: any; 
  color: string;
  subtitle?: string;
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdmin() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [empresaSearch, setEmpresaSearch] = useState("");
  const [planoSearch, setPlanoSearch] = useState("");
  const [showPlanoModal, setShowPlanoModal] = useState(false);
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [planoForm, setPlanoForm] = useState({
    nome: '',
    descricao: '',
    maximo_nfes: 100,
    maximo_nfces: 500,
    maximo_ctes: 0,
    maximo_mdfes: 0,
    maximo_usuarios: 5,
    maximo_locais: 1,
    valor: '',
    valor_implantacao: '0',
    status: true,
  });

  const [empresaForm, setEmpresaForm] = useState({
    nome: '',
    nome_fantasia: '',
    cpf_cnpj: '',
    email: '',
    celular: '',
    plano_id: '',
    status: true,
  });

  const { data: stats, isLoading: loadingStats, error: statsError } = useQuery({
    queryKey: ["plus-stats"],
    queryFn: fetchStats,
  });

  const { data: planos = [], isLoading: loadingPlanos } = useQuery({
    queryKey: ["plus-planos"],
    queryFn: fetchPlanos,
  });

  const { data: empresas = [], isLoading: loadingEmpresas } = useQuery({
    queryKey: ["plus-empresas"],
    queryFn: fetchEmpresas,
  });

  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery({
    queryKey: ["plus-usuarios"],
    queryFn: fetchUsuarios,
  });

  const createPlanoMutation = useMutation({
    mutationFn: async (data: typeof planoForm) => {
      const response = await fetch("/plus/api/suite/planos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Falha ao criar plano");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plus-planos"] });
      queryClient.invalidateQueries({ queryKey: ["plus-stats"] });
      setShowPlanoModal(false);
      setPlanoForm({ nome: '', descricao: '', maximo_nfes: 100, maximo_nfces: 500, maximo_ctes: 0, maximo_mdfes: 0, maximo_usuarios: 5, maximo_locais: 1, valor: '', valor_implantacao: '0', status: true });
      toast({ title: "Plano criado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao criar plano", variant: "destructive" }),
  });

  const updatePlanoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Plano> }) => {
      const response = await fetch(`/plus/api/suite/planos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Falha ao atualizar plano");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plus-planos"] });
      setShowPlanoModal(false);
      setEditingPlano(null);
      toast({ title: "Plano atualizado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao atualizar plano", variant: "destructive" }),
  });

  const deletePlanoMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/plus/api/suite/planos/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Falha ao remover plano");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plus-planos"] });
      queryClient.invalidateQueries({ queryKey: ["plus-stats"] });
      toast({ title: "Plano removido com sucesso" });
    },
    onError: () => toast({ title: "Erro ao remover plano", variant: "destructive" }),
  });

  const createEmpresaMutation = useMutation({
    mutationFn: async (data: typeof empresaForm) => {
      const payload = {
        nome: data.nome,
        nome_fantasia: data.nome_fantasia || null,
        cpf_cnpj: data.cpf_cnpj,
        email: data.email,
        celular: data.celular || null,
        plano_id: data.plano_id ? parseInt(data.plano_id) : null,
        status: data.status,
      };
      const response = await fetch("/plus/api/suite/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Falha ao criar empresa");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plus-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["plus-stats"] });
      setShowEmpresaModal(false);
      setEmpresaForm({ nome: '', nome_fantasia: '', cpf_cnpj: '', email: '', celular: '', plano_id: '', status: true });
      toast({ title: "Empresa criada com sucesso" });
    },
    onError: () => toast({ title: "Erro ao criar empresa", variant: "destructive" }),
  });

  const updateEmpresaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof empresaForm }) => {
      const payload = {
        nome: data.nome,
        nome_fantasia: data.nome_fantasia || null,
        cpf_cnpj: data.cpf_cnpj,
        email: data.email,
        celular: data.celular || null,
        plano_id: data.plano_id ? parseInt(data.plano_id) : null,
        status: data.status,
      };
      const response = await fetch(`/plus/api/suite/empresas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Falha ao atualizar empresa");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plus-empresas"] });
      setShowEmpresaModal(false);
      setEditingEmpresa(null);
      toast({ title: "Empresa atualizada com sucesso" });
    },
    onError: () => toast({ title: "Erro ao atualizar empresa", variant: "destructive" }),
  });

  const deleteEmpresaMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/plus/api/suite/empresas/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Falha ao remover empresa");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plus-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["plus-stats"] });
      toast({ title: "Empresa removida com sucesso" });
    },
    onError: () => toast({ title: "Erro ao remover empresa", variant: "destructive" }),
  });

  const handleEditPlano = (plano: Plano) => {
    setEditingPlano(plano);
    setPlanoForm({
      nome: plano.nome,
      descricao: plano.descricao || '',
      maximo_nfes: plano.maximo_nfes,
      maximo_nfces: plano.maximo_nfces,
      maximo_ctes: plano.maximo_ctes,
      maximo_mdfes: plano.maximo_mdfes,
      maximo_usuarios: plano.maximo_usuarios,
      maximo_locais: plano.maximo_locais,
      valor: plano.valor,
      valor_implantacao: plano.valor_implantacao || '0',
      status: plano.status,
    });
    setShowPlanoModal(true);
  };

  const handleEditEmpresa = (empresa: Empresa) => {
    setEditingEmpresa(empresa);
    setEmpresaForm({
      nome: empresa.nome,
      nome_fantasia: empresa.nome_fantasia || '',
      cpf_cnpj: empresa.cpf_cnpj,
      email: empresa.email,
      celular: empresa.celular || '',
      plano_id: empresa.plano?.id?.toString() || '',
      status: empresa.status,
    });
    setShowEmpresaModal(true);
  };

  const handleSavePlano = () => {
    if (editingPlano) {
      updatePlanoMutation.mutate({ id: editingPlano.id, data: planoForm });
    } else {
      createPlanoMutation.mutate(planoForm);
    }
  };

  const handleSaveEmpresa = () => {
    if (editingEmpresa) {
      updateEmpresaMutation.mutate({ id: editingEmpresa.id, data: empresaForm });
    } else {
      createEmpresaMutation.mutate(empresaForm);
    }
  };

  const filteredEmpresas = empresas.filter(e => 
    e.nome.toLowerCase().includes(empresaSearch.toLowerCase()) ||
    e.cpf_cnpj.includes(empresaSearch)
  );

  const filteredPlanos = planos.filter(p =>
    p.nome.toLowerCase().includes(planoSearch.toLowerCase())
  );

  const totalRecorrente = planos.reduce((sum, p) => sum + parseFloat(p.valor || '0'), 0);

  return (
    <BrowserFrame>
      <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Crown className="h-8 w-8 text-amber-500" />
                Super Admin
              </h1>
              <p className="text-muted-foreground mt-1">
                Gerenciamento de Empresas, Planos e Usuários do Arcádia Plus
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setLocation("/plus")}
              className="flex items-center gap-2"
              data-testid="btn-open-plus"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Plus
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white dark:bg-slate-800 p-1 shadow-sm">
              <TabsTrigger value="dashboard" className="flex items-center gap-2" data-testid="tab-dashboard">
                <TrendingUp className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="empresas" className="flex items-center gap-2" data-testid="tab-empresas">
                <Building2 className="h-4 w-4" />
                Empresas
              </TabsTrigger>
              <TabsTrigger value="planos" className="flex items-center gap-2" data-testid="tab-planos">
                <Package className="h-4 w-4" />
                Planos
              </TabsTrigger>
              <TabsTrigger value="usuarios" className="flex items-center gap-2" data-testid="tab-usuarios">
                <Users className="h-4 w-4" />
                Usuários
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
              {loadingStats ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : statsError ? (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-6 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">Erro ao carregar estatísticas. Verifique se o Plus está rodando.</span>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <StatCard
                      title="MRR"
                      value={formatCurrency(stats?.mrr || 0)}
                      icon={DollarSign}
                      color="bg-emerald-500"
                      subtitle="Receita Recorrente"
                    />
                    <StatCard
                      title="Empresas"
                      value={stats?.empresas || 0}
                      icon={Building2}
                      color="bg-blue-500"
                      subtitle="Clientes ativos"
                    />
                    <StatCard
                      title="Planos"
                      value={stats?.planos || 0}
                      icon={Package}
                      color="bg-purple-500"
                      subtitle="Planos ativos"
                    />
                    <StatCard
                      title="Usuários"
                      value={stats?.usuarios || 0}
                      icon={Users}
                      color="bg-green-500"
                      subtitle="Total cadastrados"
                    />
                    <StatCard
                      title="NF-e"
                      value={stats?.nfes || 0}
                      icon={FileText}
                      color="bg-orange-500"
                      subtitle="Notas emitidas"
                    />
                    <StatCard
                      title="NFC-e"
                      value={stats?.nfces || 0}
                      icon={Receipt}
                      color="bg-pink-500"
                      subtitle="Cupons emitidos"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          Últimas Empresas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[300px]">
                          {loadingEmpresas ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                          ) : empresas.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">Nenhuma empresa cadastrada</p>
                          ) : (
                            <div className="space-y-3">
                              {empresas.slice(0, 5).map((empresa) => (
                                <div
                                  key={empresa.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                                  data-testid={`empresa-row-${empresa.id}`}
                                >
                                  <div>
                                    <p className="font-medium">{empresa.nome}</p>
                                    <p className="text-sm text-muted-foreground">{empresa.cpf_cnpj}</p>
                                  </div>
                                  <Badge variant={empresa.status ? "default" : "secondary"}>
                                    {empresa.status ? "Ativo" : "Inativo"}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          Planos Disponíveis
                        </CardTitle>
                        <CardDescription>
                          Receita potencial: {formatCurrency(totalRecorrente)}/mês
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[300px]">
                          {loadingPlanos ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                          ) : planos.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">Nenhum plano cadastrado</p>
                          ) : (
                            <div className="space-y-3">
                              {planos.map((plano) => (
                                <div
                                  key={plano.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                                  data-testid={`plano-row-${plano.id}`}
                                >
                                  <div>
                                    <p className="font-medium">{plano.nome}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {plano.maximo_nfes} NF-e | {plano.maximo_nfces} NFC-e | {plano.maximo_usuarios} usuários
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-green-600">{formatCurrency(plano.valor)}</p>
                                    <p className="text-xs text-muted-foreground">/mês</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="empresas" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou CNPJ..."
                    value={empresaSearch}
                    onChange={(e) => setEmpresaSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-empresa"
                  />
                </div>
                <Button 
                  className="flex items-center gap-2" 
                  data-testid="btn-nova-empresa"
                  onClick={() => {
                    setEditingEmpresa(null);
                    setEmpresaForm({ nome: '', nome_fantasia: '', cpf_cnpj: '', email: '', celular: '', plano_id: '', status: true });
                    setShowEmpresaModal(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Nova Empresa
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <table className="w-full">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                        <tr>
                          <th className="text-left p-4 font-medium">Empresa</th>
                          <th className="text-left p-4 font-medium">CNPJ/CPF</th>
                          <th className="text-left p-4 font-medium">Email</th>
                          <th className="text-left p-4 font-medium">Plano</th>
                          <th className="text-left p-4 font-medium">Status</th>
                          <th className="text-right p-4 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingEmpresas ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                            </td>
                          </tr>
                        ) : filteredEmpresas.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                              Nenhuma empresa encontrada
                            </td>
                          </tr>
                        ) : (
                          filteredEmpresas.map((empresa) => (
                            <tr key={empresa.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800">
                              <td className="p-4">
                                <div>
                                  <p className="font-medium">{empresa.nome}</p>
                                  {empresa.nome_fantasia && (
                                    <p className="text-sm text-muted-foreground">{empresa.nome_fantasia}</p>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 font-mono text-sm">{empresa.cpf_cnpj}</td>
                              <td className="p-4">{empresa.email}</td>
                              <td className="p-4">
                                {empresa.plano ? (
                                  <Badge variant="outline">{empresa.plano.nome}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-4">
                                <Badge variant={empresa.status ? "default" : "secondary"}>
                                  {empresa.status ? "Ativo" : "Inativo"}
                                </Badge>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    data-testid={`btn-edit-empresa-${empresa.id}`}
                                    onClick={() => handleEditEmpresa(empresa)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-red-500 hover:text-red-700"
                                    data-testid={`btn-delete-empresa-${empresa.id}`}
                                    onClick={() => {
                                      if (confirm('Tem certeza que deseja remover esta empresa?')) {
                                        deleteEmpresaMutation.mutate(empresa.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="planos" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar plano..."
                    value={planoSearch}
                    onChange={(e) => setPlanoSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-plano"
                  />
                </div>
                <Button 
                  className="flex items-center gap-2" 
                  data-testid="btn-novo-plano"
                  onClick={() => {
                    setEditingPlano(null);
                    setPlanoForm({ nome: '', descricao: '', maximo_nfes: 100, maximo_nfces: 500, maximo_ctes: 0, maximo_mdfes: 0, maximo_usuarios: 5, maximo_locais: 1, valor: '', valor_implantacao: '0', status: true });
                    setShowPlanoModal(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Novo Plano
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loadingPlanos ? (
                  <div className="col-span-3 flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : filteredPlanos.length === 0 ? (
                  <div className="col-span-3 text-center py-12 text-muted-foreground">
                    Nenhum plano encontrado
                  </div>
                ) : (
                  filteredPlanos.map((plano) => (
                    <Card key={plano.id} className="hover:shadow-lg transition-shadow" data-testid={`card-plano-${plano.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl">{plano.nome}</CardTitle>
                          <Badge variant={plano.status ? "default" : "secondary"}>
                            {plano.status ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <CardDescription>{plano.descricao}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-green-600">{formatCurrency(plano.valor)}</span>
                          <span className="text-muted-foreground">/mês</span>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">NF-e</span>
                            <span className="font-medium">{plano.maximo_nfes.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">NFC-e</span>
                            <span className="font-medium">{plano.maximo_nfces.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">CT-e</span>
                            <span className="font-medium">{plano.maximo_ctes.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">MDF-e</span>
                            <span className="font-medium">{plano.maximo_mdfes.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Usuários</span>
                            <span className="font-medium">{plano.maximo_usuarios}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Locais</span>
                            <span className="font-medium">{plano.maximo_locais}</span>
                          </div>
                        </div>

                        {parseFloat(plano.valor_implantacao || '0') > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-sm text-muted-foreground">
                              Implantação: {formatCurrency(plano.valor_implantacao)}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1" 
                            data-testid={`btn-edit-plano-${plano.id}`}
                            onClick={() => handleEditPlano(plano)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700"
                            data-testid={`btn-delete-plano-${plano.id}`}
                            onClick={() => {
                              if (confirm('Tem certeza que deseja remover este plano?')) {
                                deletePlanoMutation.mutate(plano.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="usuarios" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Usuários do Sistema
                  </CardTitle>
                  <CardDescription>
                    {usuarios.length} usuário(s) cadastrado(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <table className="w-full">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                        <tr>
                          <th className="text-left p-4 font-medium">Nome</th>
                          <th className="text-left p-4 font-medium">Email</th>
                          <th className="text-left p-4 font-medium">Login</th>
                          <th className="text-left p-4 font-medium">Empresa</th>
                          <th className="text-left p-4 font-medium">Tipo</th>
                          <th className="text-left p-4 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingUsuarios ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                            </td>
                          </tr>
                        ) : usuarios.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                              Nenhum usuário encontrado
                            </td>
                          </tr>
                        ) : (
                          usuarios.map((usuario) => (
                            <tr key={usuario.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800">
                              <td className="p-4 font-medium">{usuario.nome}</td>
                              <td className="p-4">{usuario.email}</td>
                              <td className="p-4 font-mono text-sm">{usuario.login}</td>
                              <td className="p-4">
                                {usuario.empresa ? (
                                  <span>{usuario.empresa.nome}</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-4">
                                {usuario.admin ? (
                                  <Badge className="bg-amber-500">
                                    <Crown className="h-3 w-3 mr-1" />
                                    Admin
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Usuário</Badge>
                                )}
                              </td>
                              <td className="p-4">
                                <Badge variant={usuario.status ? "default" : "secondary"}>
                                  {usuario.status ? "Ativo" : "Inativo"}
                                </Badge>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showPlanoModal} onOpenChange={setShowPlanoModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPlano ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label htmlFor="plano-nome">Nome</Label>
              <Input
                id="plano-nome"
                value={planoForm.nome}
                onChange={(e) => setPlanoForm({...planoForm, nome: e.target.value})}
                placeholder="Nome do plano"
                data-testid="input-plano-nome"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="plano-descricao">Descrição</Label>
              <Textarea
                id="plano-descricao"
                value={planoForm.descricao}
                onChange={(e) => setPlanoForm({...planoForm, descricao: e.target.value})}
                placeholder="Descrição do plano"
                data-testid="input-plano-descricao"
              />
            </div>
            <div>
              <Label htmlFor="plano-valor">Valor Mensal (R$)</Label>
              <Input
                id="plano-valor"
                type="number"
                step="0.01"
                value={planoForm.valor}
                onChange={(e) => setPlanoForm({...planoForm, valor: e.target.value})}
                placeholder="99.90"
                data-testid="input-plano-valor"
              />
            </div>
            <div>
              <Label htmlFor="plano-implantacao">Valor Implantação (R$)</Label>
              <Input
                id="plano-implantacao"
                type="number"
                step="0.01"
                value={planoForm.valor_implantacao}
                onChange={(e) => setPlanoForm({...planoForm, valor_implantacao: e.target.value})}
                placeholder="0"
                data-testid="input-plano-implantacao"
              />
            </div>
            <div>
              <Label htmlFor="plano-nfes">Máximo NF-e</Label>
              <Input
                id="plano-nfes"
                type="number"
                value={planoForm.maximo_nfes}
                onChange={(e) => setPlanoForm({...planoForm, maximo_nfes: parseInt(e.target.value) || 0})}
                data-testid="input-plano-nfes"
              />
            </div>
            <div>
              <Label htmlFor="plano-nfces">Máximo NFC-e</Label>
              <Input
                id="plano-nfces"
                type="number"
                value={planoForm.maximo_nfces}
                onChange={(e) => setPlanoForm({...planoForm, maximo_nfces: parseInt(e.target.value) || 0})}
                data-testid="input-plano-nfces"
              />
            </div>
            <div>
              <Label htmlFor="plano-usuarios">Máximo Usuários</Label>
              <Input
                id="plano-usuarios"
                type="number"
                value={planoForm.maximo_usuarios}
                onChange={(e) => setPlanoForm({...planoForm, maximo_usuarios: parseInt(e.target.value) || 1})}
                data-testid="input-plano-usuarios"
              />
            </div>
            <div>
              <Label htmlFor="plano-locais">Máximo Locais</Label>
              <Input
                id="plano-locais"
                type="number"
                value={planoForm.maximo_locais}
                onChange={(e) => setPlanoForm({...planoForm, maximo_locais: parseInt(e.target.value) || 1})}
                data-testid="input-plano-locais"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch
                id="plano-status"
                checked={planoForm.status}
                onCheckedChange={(checked) => setPlanoForm({...planoForm, status: checked})}
                data-testid="switch-plano-status"
              />
              <Label htmlFor="plano-status">Plano Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanoModal(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={handleSavePlano}
              disabled={createPlanoMutation.isPending || updatePlanoMutation.isPending}
              data-testid="btn-save-plano"
            >
              {(createPlanoMutation.isPending || updatePlanoMutation.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmpresaModal} onOpenChange={setShowEmpresaModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEmpresa ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label htmlFor="empresa-nome">Razão Social</Label>
              <Input
                id="empresa-nome"
                value={empresaForm.nome}
                onChange={(e) => setEmpresaForm({...empresaForm, nome: e.target.value})}
                placeholder="Razão social da empresa"
                data-testid="input-empresa-nome"
              />
            </div>
            <div>
              <Label htmlFor="empresa-fantasia">Nome Fantasia</Label>
              <Input
                id="empresa-fantasia"
                value={empresaForm.nome_fantasia}
                onChange={(e) => setEmpresaForm({...empresaForm, nome_fantasia: e.target.value})}
                placeholder="Nome fantasia"
                data-testid="input-empresa-fantasia"
              />
            </div>
            <div>
              <Label htmlFor="empresa-cnpj">CNPJ/CPF</Label>
              <Input
                id="empresa-cnpj"
                value={empresaForm.cpf_cnpj}
                onChange={(e) => setEmpresaForm({...empresaForm, cpf_cnpj: e.target.value})}
                placeholder="00.000.000/0001-00"
                data-testid="input-empresa-cnpj"
              />
            </div>
            <div>
              <Label htmlFor="empresa-email">Email</Label>
              <Input
                id="empresa-email"
                type="email"
                value={empresaForm.email}
                onChange={(e) => setEmpresaForm({...empresaForm, email: e.target.value})}
                placeholder="contato@empresa.com.br"
                data-testid="input-empresa-email"
              />
            </div>
            <div>
              <Label htmlFor="empresa-celular">Celular</Label>
              <Input
                id="empresa-celular"
                value={empresaForm.celular}
                onChange={(e) => setEmpresaForm({...empresaForm, celular: e.target.value})}
                placeholder="(11) 99999-9999"
                data-testid="input-empresa-celular"
              />
            </div>
            <div>
              <Label htmlFor="empresa-plano">Plano</Label>
              <Select
                value={empresaForm.plano_id}
                onValueChange={(value) => setEmpresaForm({...empresaForm, plano_id: value})}
              >
                <SelectTrigger data-testid="select-empresa-plano">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {planos.map((plano) => (
                    <SelectItem key={plano.id} value={plano.id.toString()}>
                      {plano.nome} - {formatCurrency(plano.valor)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="empresa-status"
                checked={empresaForm.status}
                onCheckedChange={(checked) => setEmpresaForm({...empresaForm, status: checked})}
                data-testid="switch-empresa-status"
              />
              <Label htmlFor="empresa-status">Empresa Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmpresaModal(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveEmpresa}
              disabled={createEmpresaMutation.isPending || updateEmpresaMutation.isPending}
              data-testid="btn-save-empresa"
            >
              {(createEmpresaMutation.isPending || updateEmpresaMutation.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BrowserFrame>
  );
}
