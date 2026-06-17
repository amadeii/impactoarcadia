import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Building2,
  Briefcase,
  Calculator,
  Calendar,
  Clock,
  FileText,
  Search,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  ChevronLeft,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Bot,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const api = {
  async get(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Erro ao carregar dados");
    return res.json();
  },
  async post(url: string, data: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Erro ao salvar");
    return res.json();
  },
  async put(url: string, data: any) {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Erro ao atualizar");
    return res.json();
  },
  async delete(url: string) {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error("Erro ao excluir");
    return res.json();
  },
};

interface Funcionario {
  id: number;
  matricula?: string;
  nome: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  cargoId?: number;
  departamentoId?: number;
  dataAdmissao?: string;
  salario?: string;
  status: string;
}

interface Cargo {
  id: number;
  codigo?: string;
  nome: string;
  cbo?: string;
  salarioBase?: string;
  status: string;
}

interface Departamento {
  id: number;
  codigo?: string;
  nome: string;
  gerente?: string;
  status: string;
}

interface FolhaPagamento {
  id: number;
  competencia: string;
  tipo: string;
  status: string;
  totalBruto?: string;
  totalDescontos?: string;
  totalLiquido?: string;
}

interface CalculoFolha {
  proventos: { total: number };
  descontos: { total: number; inss: { valorInss: number }; irrf: { valorIrrf: number } };
  encargos: { fgts: { valorFgts: number } };
  resumo: { totalProventos: number; totalDescontos: number; totalLiquido: number; custoEmpresa: number };
}

export default function People() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFuncionarioDialog, setShowFuncionarioDialog] = useState(false);
  const [showCargoDialog, setShowCargoDialog] = useState(false);
  const [showDepartamentoDialog, setShowDepartamentoDialog] = useState(false);
  const [showFolhaDialog, setShowFolhaDialog] = useState(false);
  const [showCalculadoraDialog, setShowCalculadoraDialog] = useState(false);
  const [showManusDialog, setShowManusDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [manusCommand, setManusCommand] = useState("");
  const [manusResponse, setManusResponse] = useState<any>(null);
  const [calculoResult, setCalculoResult] = useState<CalculoFolha | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["/api/people/stats"],
    queryFn: () => api.get("/api/people/stats"),
  });

  const { data: funcionarios = [], isLoading: loadingFuncionarios } = useQuery({
    queryKey: ["/api/people/funcionarios"],
    queryFn: () => api.get("/api/people/funcionarios"),
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ["/api/people/cargos"],
    queryFn: () => api.get("/api/people/cargos"),
  });

  const { data: departamentos = [] } = useQuery({
    queryKey: ["/api/people/departamentos"],
    queryFn: () => api.get("/api/people/departamentos"),
  });

  const { data: folhas = [] } = useQuery({
    queryKey: ["/api/people/folhas"],
    queryFn: () => api.get("/api/people/folhas"),
  });

  const { data: tabelaInss } = useQuery({
    queryKey: ["/api/people/tabelas/inss"],
    queryFn: () => api.get("/api/people/tabelas/inss"),
  });

  const createFuncionarioMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/people/funcionarios", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people/funcionarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people/stats"] });
      setShowFuncionarioDialog(false);
      setEditingItem(null);
      toast({ title: "Funcionário cadastrado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const updateFuncionarioMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/people/funcionarios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people/funcionarios"] });
      setShowFuncionarioDialog(false);
      setEditingItem(null);
      toast({ title: "Funcionário atualizado!" });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteFuncionarioMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/people/funcionarios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people/funcionarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people/stats"] });
      toast({ title: "Funcionário removido!" });
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
  });

  const createCargoMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/people/cargos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people/cargos"] });
      setShowCargoDialog(false);
      toast({ title: "Cargo criado!" });
    },
  });

  const createDepartamentoMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/people/departamentos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people/departamentos"] });
      setShowDepartamentoDialog(false);
      toast({ title: "Departamento criado!" });
    },
  });

  const createFolhaMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/people/folhas", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people/folhas"] });
      setShowFolhaDialog(false);
      toast({ title: "Folha criada!" });
    },
  });

  const calcularFolhaMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/people/calcular/folha", data),
    onSuccess: (result) => {
      setCalculoResult(result);
      toast({ title: "Cálculo realizado!" });
    },
    onError: () => toast({ title: "Erro no cálculo", variant: "destructive" }),
  });

  const executeManusCommand = useMutation({
    mutationFn: async (command: string) => {
      const res = await fetch("/api/manus/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: command }),
      });
      return res.json();
    },
    onSuccess: (result) => {
      setManusResponse(result);
      toast({ title: "Comando executado pelo Manus!" });
    },
    onError: () => toast({ title: "Erro ao executar comando", variant: "destructive" }),
  });

  const filteredFuncionarios = funcionarios.filter((f: Funcionario) =>
    f.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.cpf?.includes(searchTerm) ||
    f.matricula?.includes(searchTerm)
  );

  const handleSaveFuncionario = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      nome: formData.get("nome"),
      cpf: formData.get("cpf"),
      email: formData.get("email"),
      telefone: formData.get("telefone"),
      matricula: formData.get("matricula"),
      cargoId: formData.get("cargoId") ? Number(formData.get("cargoId")) : null,
      departamentoId: formData.get("departamentoId") ? Number(formData.get("departamentoId")) : null,
      dataAdmissao: formData.get("dataAdmissao") ? new Date(formData.get("dataAdmissao") as string) : null,
      salario: formData.get("salario"),
      status: formData.get("status") || "ativo",
    };

    if (editingItem) {
      updateFuncionarioMutation.mutate({ id: editingItem.id, data });
    } else {
      createFuncionarioMutation.mutate(data);
    }
  };

  const handleCalcularFolha = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const salarioBase = Number(formData.get("salarioBase"));
    
    if (!salarioBase || salarioBase <= 0) {
      toast({ title: "Informe um salário válido", variant: "destructive" });
      return;
    }
    
    const data = {
      funcionarioId: 0,
      competencia: formData.get("competencia") || new Date().toISOString().slice(0, 7),
      salarioBase,
      diasTrabalhados: Number(formData.get("diasTrabalhados")) || 30,
      horasExtras50: Number(formData.get("horasExtras50")) || 0,
      horasExtras100: Number(formData.get("horasExtras100")) || 0,
      faltas: Number(formData.get("faltas")) || 0,
      dependentesIrrf: Number(formData.get("dependentesIrrf")) || 0,
    };
    calcularFolhaMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Arcádia People</h1>
              <p className="text-muted-foreground">Gestão de Recursos Humanos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowManusDialog(true)} data-testid="btn-manus">
              <Bot className="h-4 w-4 mr-2" />
              Manus AI
            </Button>
            <Button onClick={() => setShowCalculadoraDialog(true)} data-testid="btn-calculadora">
              <Calculator className="h-4 w-4 mr-2" />
              Calculadora
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-funcionarios">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Funcionários</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-total-funcionarios">{stats?.totalFuncionarios || 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-ativos">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="value-ativos">{stats?.funcionariosAtivos || 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-cargos">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cargos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-cargos">{stats?.totalCargos || 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-departamentos">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Departamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-departamentos">{stats?.totalDepartamentos || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="funcionarios" data-testid="tab-funcionarios">Funcionários</TabsTrigger>
            <TabsTrigger value="estrutura" data-testid="tab-estrutura">Estrutura</TabsTrigger>
            <TabsTrigger value="folha" data-testid="tab-folha">Folha</TabsTrigger>
            <TabsTrigger value="esocial" data-testid="tab-esocial">eSocial</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Resumo do Mês
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Folhas Processadas</span>
                      <Badge>{folhas.filter((f: FolhaPagamento) => f.status === "processada").length}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Folhas Pendentes</span>
                      <Badge variant="outline">{folhas.filter((f: FolhaPagamento) => f.status === "aberta").length}</Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span>Funcionários Ativos</span>
                      <span className="font-bold">{stats?.funcionariosAtivos || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Ações Rápidas com Manus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" onClick={() => {
                      setManusCommand("Calcular folha de pagamento do mês atual para todos os funcionários ativos");
                      setShowManusDialog(true);
                    }}>
                      <Calculator className="h-4 w-4 mr-2" />
                      Processar Folha Mensal
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => {
                      setManusCommand("Gerar relatório de férias vencidas");
                      setShowManusDialog(true);
                    }}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Verificar Férias Vencidas
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => {
                      setManusCommand("Exportar eventos eSocial do mês para transmissão");
                      setShowManusDialog(true);
                    }}>
                      <FileText className="h-4 w-4 mr-2" />
                      Gerar eSocial
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="funcionarios" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar funcionário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-funcionario"
                />
              </div>
              <Button onClick={() => { setEditingItem(null); setShowFuncionarioDialog(true); }} data-testid="btn-novo-funcionario">
                <UserPlus className="h-4 w-4 mr-2" />
                Novo Funcionário
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingFuncionarios ? (
                      <TableRow>
                        <TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell>
                      </TableRow>
                    ) : filteredFuncionarios.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum funcionário cadastrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFuncionarios.map((f: Funcionario) => (
                        <TableRow key={f.id} data-testid={`row-funcionario-${f.id}`}>
                          <TableCell>{f.matricula || "-"}</TableCell>
                          <TableCell className="font-medium">{f.nome}</TableCell>
                          <TableCell>{f.cpf || "-"}</TableCell>
                          <TableCell>{cargos.find((c: Cargo) => c.id === f.cargoId)?.nome || "-"}</TableCell>
                          <TableCell>{departamentos.find((d: Departamento) => d.id === f.departamentoId)?.nome || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={f.status === "ativo" ? "default" : "secondary"}>
                              {f.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingItem(f); setShowFuncionarioDialog(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteFuncionarioMutation.mutate(f.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="estrutura" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Cargos
                  </CardTitle>
                  <Button size="sm" onClick={() => setShowCargoDialog(true)} data-testid="btn-novo-cargo">
                    <Plus className="h-4 w-4 mr-1" />
                    Novo
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {cargos.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">Nenhum cargo cadastrado</p>
                      ) : (
                        cargos.map((c: Cargo) => (
                          <div key={c.id} className="flex items-center justify-between p-2 border rounded" data-testid={`cargo-${c.id}`}>
                            <div>
                              <p className="font-medium">{c.nome}</p>
                              <p className="text-sm text-muted-foreground">CBO: {c.cbo || "-"}</p>
                            </div>
                            <Badge variant={c.status === "ativo" ? "default" : "secondary"}>{c.status}</Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Departamentos
                  </CardTitle>
                  <Button size="sm" onClick={() => setShowDepartamentoDialog(true)} data-testid="btn-novo-departamento">
                    <Plus className="h-4 w-4 mr-1" />
                    Novo
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {departamentos.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">Nenhum departamento cadastrado</p>
                      ) : (
                        departamentos.map((d: Departamento) => (
                          <div key={d.id} className="flex items-center justify-between p-2 border rounded" data-testid={`departamento-${d.id}`}>
                            <div>
                              <p className="font-medium">{d.nome}</p>
                              <p className="text-sm text-muted-foreground">Gerente: {d.gerente || "-"}</p>
                            </div>
                            <Badge variant={d.status === "ativo" ? "default" : "secondary"}>{d.status}</Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="folha" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Folhas de Pagamento</h3>
              <Button onClick={() => setShowFolhaDialog(true)} data-testid="btn-nova-folha">
                <Plus className="h-4 w-4 mr-2" />
                Nova Folha
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Total Bruto</TableHead>
                      <TableHead>Descontos</TableHead>
                      <TableHead>Líquido</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {folhas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhuma folha processada
                        </TableCell>
                      </TableRow>
                    ) : (
                      folhas.map((f: FolhaPagamento) => (
                        <TableRow key={f.id} data-testid={`row-folha-${f.id}`}>
                          <TableCell className="font-medium">{f.competencia}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{f.tipo}</Badge>
                          </TableCell>
                          <TableCell>R$ {Number(f.totalBruto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-red-600">R$ {Number(f.totalDescontos || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-green-600 font-medium">R$ {Number(f.totalLiquido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <Badge variant={f.status === "processada" ? "default" : "secondary"}>
                              {f.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="esocial" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Eventos eSocial
                </CardTitle>
                <CardDescription>Geração e transmissão de eventos para o eSocial</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button variant="outline" className="h-20 flex flex-col" data-testid="btn-esocial-s1000">
                    <span className="font-bold">S-1000</span>
                    <span className="text-xs text-muted-foreground">Empregador</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col" data-testid="btn-esocial-s2200">
                    <span className="font-bold">S-2200</span>
                    <span className="text-xs text-muted-foreground">Admissão</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col" data-testid="btn-esocial-s2299">
                    <span className="font-bold">S-2299</span>
                    <span className="text-xs text-muted-foreground">Desligamento</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col" data-testid="btn-esocial-s1200">
                    <span className="font-bold">S-1200</span>
                    <span className="text-xs text-muted-foreground">Remuneração</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showFuncionarioDialog} onOpenChange={setShowFuncionarioDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveFuncionario}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input name="nome" defaultValue={editingItem?.nome} required data-testid="input-nome" />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input name="cpf" defaultValue={editingItem?.cpf} data-testid="input-cpf" />
                </div>
                <div className="space-y-2">
                  <Label>Matrícula</Label>
                  <Input name="matricula" defaultValue={editingItem?.matricula} data-testid="input-matricula" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input name="email" type="email" defaultValue={editingItem?.email} data-testid="input-email" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input name="telefone" defaultValue={editingItem?.telefone} data-testid="input-telefone" />
                </div>
                <div className="space-y-2">
                  <Label>Data Admissão</Label>
                  <Input name="dataAdmissao" type="date" defaultValue={editingItem?.dataAdmissao?.split("T")[0]} data-testid="input-data-admissao" />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select name="cargoId" defaultValue={editingItem?.cargoId?.toString()}>
                    <SelectTrigger data-testid="select-cargo">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {cargos.map((c: Cargo) => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select name="departamentoId" defaultValue={editingItem?.departamentoId?.toString()}>
                    <SelectTrigger data-testid="select-departamento">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {departamentos.map((d: Departamento) => (
                        <SelectItem key={d.id} value={d.id.toString()}>{d.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Salário</Label>
                  <Input name="salario" type="number" step="0.01" defaultValue={editingItem?.salario} data-testid="input-salario" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select name="status" defaultValue={editingItem?.status || "ativo"}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="afastado">Afastado</SelectItem>
                      <SelectItem value="ferias">Férias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setShowFuncionarioDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" data-testid="btn-salvar-funcionario">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showCargoDialog} onOpenChange={setShowCargoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cargo</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createCargoMutation.mutate({
                nome: formData.get("nome"),
                codigo: formData.get("codigo"),
                cbo: formData.get("cbo"),
                salarioBase: formData.get("salarioBase"),
                status: "ativo",
              });
            }}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Cargo *</Label>
                  <Input name="nome" required data-testid="input-cargo-nome" />
                </div>
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input name="codigo" data-testid="input-cargo-codigo" />
                </div>
                <div className="space-y-2">
                  <Label>CBO</Label>
                  <Input name="cbo" data-testid="input-cargo-cbo" />
                </div>
                <div className="space-y-2">
                  <Label>Salário Base</Label>
                  <Input name="salarioBase" type="number" step="0.01" data-testid="input-cargo-salario" />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" data-testid="btn-salvar-cargo">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showDepartamentoDialog} onOpenChange={setShowDepartamentoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Departamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createDepartamentoMutation.mutate({
                nome: formData.get("nome"),
                codigo: formData.get("codigo"),
                gerente: formData.get("gerente"),
                status: "ativo",
              });
            }}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Departamento *</Label>
                  <Input name="nome" required data-testid="input-departamento-nome" />
                </div>
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input name="codigo" data-testid="input-departamento-codigo" />
                </div>
                <div className="space-y-2">
                  <Label>Gerente</Label>
                  <Input name="gerente" data-testid="input-departamento-gerente" />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" data-testid="btn-salvar-departamento">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showFolhaDialog} onOpenChange={setShowFolhaDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Folha de Pagamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createFolhaMutation.mutate({
                competencia: formData.get("competencia"),
                tipo: formData.get("tipo"),
                status: "aberta",
              });
            }}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Competência (AAAA-MM) *</Label>
                  <Input name="competencia" placeholder="2024-01" required data-testid="input-folha-competencia" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select name="tipo" defaultValue="mensal">
                    <SelectTrigger data-testid="select-folha-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="adiantamento">Adiantamento</SelectItem>
                      <SelectItem value="ferias">Férias</SelectItem>
                      <SelectItem value="13_1">13º - 1ª Parcela</SelectItem>
                      <SelectItem value="13_2">13º - 2ª Parcela</SelectItem>
                      <SelectItem value="rescisao">Rescisão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" data-testid="btn-criar-folha">Criar Folha</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showCalculadoraDialog} onOpenChange={setShowCalculadoraDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Calculadora Trabalhista
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6">
              <form onSubmit={handleCalcularFolha} className="space-y-4">
                <div className="space-y-2">
                  <Label>Salário Base *</Label>
                  <Input name="salarioBase" type="number" step="0.01" required placeholder="3000.00" data-testid="input-calc-salario" />
                </div>
                <div className="space-y-2">
                  <Label>Competência</Label>
                  <Input name="competencia" placeholder="2024-01" defaultValue={new Date().toISOString().slice(0, 7)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Dias Trabalhados</Label>
                    <Input name="diasTrabalhados" type="number" defaultValue="30" />
                  </div>
                  <div className="space-y-2">
                    <Label>Faltas</Label>
                    <Input name="faltas" type="number" defaultValue="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Horas Extras 50%</Label>
                    <Input name="horasExtras50" type="number" step="0.5" defaultValue="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Horas Extras 100%</Label>
                    <Input name="horasExtras100" type="number" step="0.5" defaultValue="0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dependentes IRRF</Label>
                  <Input name="dependentesIrrf" type="number" defaultValue="0" />
                </div>
                <Button type="submit" className="w-full" data-testid="btn-calcular">
                  <Calculator className="h-4 w-4 mr-2" />
                  Calcular
                </Button>
              </form>

              <div className="space-y-4">
                <h4 className="font-semibold">Resultado</h4>
                {calculoResult ? (
                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-muted-foreground">Total Proventos</p>
                      <p className="text-xl font-bold text-green-600">
                        R$ {calculoResult.resumo.totalProventos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-muted-foreground">Total Descontos</p>
                      <p className="text-xl font-bold text-red-600">
                        R$ {calculoResult.resumo.totalDescontos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <div className="mt-2 text-xs space-y-1">
                        <p>INSS: R$ {calculoResult.descontos.inss.valorInss.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        <p>IRRF: R$ {calculoResult.descontos.irrf.valorIrrf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-muted-foreground">Líquido a Receber</p>
                      <p className="text-2xl font-bold text-blue-600">
                        R$ {calculoResult.resumo.totalLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <p className="text-muted-foreground">Custo Empresa</p>
                      <p className="font-bold">
                        R$ {calculoResult.resumo.custoEmpresa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        (Inclui FGTS R$ {calculoResult.encargos.fgts.valorFgts.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} + INSS Patronal)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    Preencha os dados e clique em Calcular
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showManusDialog} onOpenChange={setShowManusDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Manus AI - Assistente de RH
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Comando para o Manus</Label>
                <Textarea
                  value={manusCommand}
                  onChange={(e) => setManusCommand(e.target.value)}
                  placeholder="Ex: Calcular folha de pagamento para João Silva com salário de R$ 5.000"
                  rows={3}
                  data-testid="input-manus-command"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => executeManusCommand.mutate(manusCommand)}
                  disabled={!manusCommand.trim() || executeManusCommand.isPending}
                  className="flex-1"
                  data-testid="btn-executar-manus"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {executeManusCommand.isPending ? "Processando..." : "Executar"}
                </Button>
              </div>

              {manusResponse && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2">Resposta do Manus:</h4>
                  <pre className="text-sm whitespace-pre-wrap">
                    {JSON.stringify(manusResponse, null, 2)}
                  </pre>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Comandos Sugeridos:</h4>
                <div className="space-y-2">
                  {[
                    "Calcular férias para funcionário com salário de R$ 4.000 e 30 dias",
                    "Simular rescisão sem justa causa para funcionário com 2 anos de empresa",
                    "Calcular INSS e IRRF para salário de R$ 6.500",
                    "Gerar relatório de funcionários por departamento",
                  ].map((cmd, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left"
                      onClick={() => setManusCommand(cmd)}
                    >
                      {cmd}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
