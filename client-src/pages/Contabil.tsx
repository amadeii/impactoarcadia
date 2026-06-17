import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GrupoEmpresarialSelector, GrupoBanner } from "@/components/GrupoEmpresarialSelector";
import {
  BookOpen,
  Calculator,
  FileText,
  FolderTree,
  Plus,
  Edit,
  Trash2,
  Save,
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  BarChart3,
  Download,
  Upload,
  Bot,
  Send,
  Check,
  X,
  ArrowRight,
  Building2,
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

interface ContaContabil {
  id: number;
  codigo: string;
  descricao: string;
  tipo: string;
  natureza: string;
  nivel: number;
  contaPaiId?: number;
  aceitaLancamento: number;
  status: string;
}

interface CentroCusto {
  id: number;
  codigo?: string;
  nome: string;
  status: string;
}

interface Lancamento {
  id: number;
  dataLancamento: string;
  dataCompetencia?: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  historico: string;
  valor: string;
  status: string;
}

interface Partida {
  contaId: number;
  tipo: "debito" | "credito";
  valor: number;
  historico?: string;
  centroCustoId?: number;
}

export default function Contabil() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [showContaDialog, setShowContaDialog] = useState(false);
  const [showCentroCustoDialog, setShowCentroCustoDialog] = useState(false);
  const [showLancamentoDialog, setShowLancamentoDialog] = useState(false);
  const [showManusDialog, setShowManusDialog] = useState(false);
  const [showRelatorioDialog, setShowRelatorioDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [manusCommand, setManusCommand] = useState("");
  const [manusResponse, setManusResponse] = useState<any>(null);
  const [importTexto, setImportTexto] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [partidas, setPartidas] = useState<Partida[]>([
    { contaId: 0, tipo: "debito", valor: 0 },
    { contaId: 0, tipo: "credito", valor: 0 },
  ]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["/api/contabil/stats"],
    queryFn: () => api.get("/api/contabil/stats"),
  });

  const { data: planoContas = [], isLoading: loadingContas } = useQuery({
    queryKey: ["/api/contabil/plano-contas"],
    queryFn: () => api.get("/api/contabil/plano-contas"),
  });

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["/api/contabil/centros-custo"],
    queryFn: () => api.get("/api/contabil/centros-custo"),
  });

  const { data: lancamentos = [], isLoading: loadingLancamentos } = useQuery({
    queryKey: ["/api/contabil/lancamentos"],
    queryFn: () => api.get("/api/contabil/lancamentos"),
  });

  const createContaMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/contabil/plano-contas", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/plano-contas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/stats"] });
      setShowContaDialog(false);
      setEditingItem(null);
      toast({ title: "Conta criada com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const updateContaMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/contabil/plano-contas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/plano-contas"] });
      setShowContaDialog(false);
      setEditingItem(null);
      toast({ title: "Conta atualizada!" });
    },
  });

  const deleteContaMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/contabil/plano-contas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/plano-contas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/stats"] });
      toast({ title: "Conta removida!" });
    },
  });

  const createCentroCustoMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/contabil/centros-custo", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/centros-custo"] });
      setShowCentroCustoDialog(false);
      toast({ title: "Centro de custo criado!" });
    },
  });

  const createLancamentoMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/contabil/lancamentos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/stats"] });
      setShowLancamentoDialog(false);
      setPartidas([
        { contaId: 0, tipo: "debito", valor: 0 },
        { contaId: 0, tipo: "credito", valor: 0 },
      ]);
      toast({ title: "Lançamento criado com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro: Lançamento desbalanceado", variant: "destructive" });
    },
  });

  const importarPlanoPadraoMutation = useMutation({
    mutationFn: () => api.post("/api/contabil/plano-contas/importar-padrao", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/plano-contas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/stats"] });
      toast({ title: "Plano de contas padrão importado!" });
    },
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
  });

  const importBalancoMutation = useMutation({
    mutationFn: async (data: { texto: string; dataBalanco: string; tenantId?: number }) => {
      const res = await fetch("/api/contabil/importar-balanco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.detail || "Erro ao importar balanço");
      return json;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/plano-contas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contabil/stats"] });
      toast({ title: `Importação concluída! ${result.contasCriadas} contas, ${result.lancamentosCriados} lançamentos criados.` });
    },
    onError: (error: Error) => toast({ title: error.message || "Erro ao importar balanço", variant: "destructive" }),
  });

  const filteredContas = planoContas.filter((c: ContaContabil) =>
    c.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case "ativo": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "passivo": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "patrimonio": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "receita": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "despesa": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleSaveConta = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      codigo: formData.get("codigo"),
      descricao: formData.get("descricao"),
      tipo: formData.get("tipo"),
      natureza: formData.get("natureza"),
      nivel: Number(formData.get("nivel")) || 1,
      aceitaLancamento: formData.get("aceitaLancamento") === "1" ? 1 : 0,
      status: "ativo",
    };

    if (editingItem) {
      updateContaMutation.mutate({ id: editingItem.id, data });
    } else {
      createContaMutation.mutate(data);
    }
  };

  const handleSaveLancamento = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const totalDebitos = partidas.filter(p => p.tipo === "debito").reduce((acc, p) => acc + p.valor, 0);
    const totalCreditos = partidas.filter(p => p.tipo === "credito").reduce((acc, p) => acc + p.valor, 0);
    
    if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
      toast({ title: "Erro: Débitos e Créditos devem ser iguais", variant: "destructive" });
      return;
    }

    const data = {
      dataLancamento: formData.get("dataLancamento"),
      dataCompetencia: formData.get("dataCompetencia") || formData.get("dataLancamento"),
      tipoDocumento: formData.get("tipoDocumento"),
      numeroDocumento: formData.get("numeroDocumento"),
      historico: formData.get("historico"),
      partidas: partidas.filter(p => p.contaId > 0 && p.valor > 0),
    };

    createLancamentoMutation.mutate(data);
  };

  const addPartida = () => {
    setPartidas([...partidas, { contaId: 0, tipo: "debito", valor: 0 }]);
  };

  const removePartida = (index: number) => {
    if (partidas.length > 2) {
      setPartidas(partidas.filter((_, i) => i !== index));
    }
  };

  const updatePartida = (index: number, field: keyof Partida, value: any) => {
    const newPartidas = [...partidas];
    newPartidas[index] = { ...newPartidas[index], [field]: value };
    setPartidas(newPartidas);
  };

  const totalDebitos = partidas.filter(p => p.tipo === "debito").reduce((acc, p) => acc + Number(p.valor || 0), 0);
  const totalCreditos = partidas.filter(p => p.tipo === "credito").reduce((acc, p) => acc + Number(p.valor || 0), 0);
  const diferenca = totalDebitos - totalCreditos;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Arcádia Contábil</h1>
              <p className="text-muted-foreground">Motor de Contabilidade</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GrupoEmpresarialSelector />
            <Button variant="outline" onClick={() => setShowManusDialog(true)} data-testid="btn-manus">
              <Bot className="h-4 w-4 mr-2" />
              Manus AI
            </Button>
            <Button variant="outline" onClick={() => setShowRelatorioDialog(true)} data-testid="btn-relatorios">
              <BarChart3 className="h-4 w-4 mr-2" />
              Relatórios
            </Button>
          </div>
        </div>

        <GrupoBanner />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-contas">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contas Cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-total-contas">{stats?.totalContas || 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-centros-custo">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Centros de Custo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-centros-custo">{stats?.totalCentrosCusto || 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-lancamentos">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lançamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-lancamentos">{stats?.totalLancamentos || 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-periodo">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Período Atual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-periodo">{new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="plano" data-testid="tab-plano">Plano de Contas</TabsTrigger>
            <TabsTrigger value="lancamentos" data-testid="tab-lancamentos">Lançamentos</TabsTrigger>
            <TabsTrigger value="centros" data-testid="tab-centros">Centros de Custo</TabsTrigger>
            <TabsTrigger value="sped" data-testid="tab-sped">SPED ECD</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Ações Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => setShowLancamentoDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Lançamento Manual
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                    setManusCommand("Gerar DRE do mês atual");
                    setShowManusDialog(true);
                  }}>
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar DRE
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                    setManusCommand("Gerar Balanço Patrimonial");
                    setShowManusDialog(true);
                  }}>
                    <PieChart className="h-4 w-4 mr-2" />
                    Gerar Balanço Patrimonial
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                    setManusCommand("Gerar Balancete de Verificação");
                    setShowManusDialog(true);
                  }}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Gerar Balancete
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Integrações Automáticas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                    setManusCommand("Contabilizar todas as NF-e do mês automaticamente");
                    setShowManusDialog(true);
                  }}>
                    <FileText className="h-4 w-4 mr-2" />
                    Integrar NF-e (Fisco)
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                    setManusCommand("Contabilizar folha de pagamento do mês");
                    setShowManusDialog(true);
                  }}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Integrar Folha (People)
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                    setManusCommand("Gerar lançamentos de depreciação do mês");
                    setShowManusDialog(true);
                  }}>
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Lançar Depreciação
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Últimos Lançamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Histórico</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lancamentos.slice(0, 5).map((l: Lancamento) => (
                      <TableRow key={l.id}>
                        <TableCell>{new Date(l.dataLancamento).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{l.numeroDocumento || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{l.historico}</TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {Number(l.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={l.status === "ativo" ? "default" : "secondary"}>{l.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {lancamentos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum lançamento registrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plano" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar conta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-conta"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => importarPlanoPadraoMutation.mutate()} data-testid="btn-importar-padrao">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Padrão
                </Button>
                <Button variant="outline" onClick={() => setShowImportDialog(true)} data-testid="btn-importar-balanco">
                  <FileText className="h-4 w-4 mr-2" />
                  Importar Balanço
                </Button>
                <Button onClick={() => { setEditingItem(null); setShowContaDialog(true); }} data-testid="btn-nova-conta">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Conta
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Natureza</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Aceita Lanç.</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingContas ? (
                      <TableRow>
                        <TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell>
                      </TableRow>
                    ) : filteredContas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhuma conta cadastrada. Clique em "Importar Padrão" para começar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContas.map((c: ContaContabil) => (
                        <TableRow key={c.id} data-testid={`row-conta-${c.id}`}>
                          <TableCell className="font-mono">{c.codigo}</TableCell>
                          <TableCell className="font-medium" style={{ paddingLeft: `${(c.nivel - 1) * 20}px` }}>
                            {c.descricao}
                          </TableCell>
                          <TableCell>
                            <Badge className={getTipoColor(c.tipo)}>{c.tipo}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{c.natureza}</Badge>
                          </TableCell>
                          <TableCell>{c.nivel}</TableCell>
                          <TableCell>
                            {c.aceitaLancamento === 1 ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingItem(c); setShowContaDialog(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteContaMutation.mutate(c.id)}>
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

          <TabsContent value="lancamentos" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Lançamentos Contábeis</h3>
              <Button onClick={() => setShowLancamentoDialog(true)} data-testid="btn-novo-lancamento">
                <Plus className="h-4 w-4 mr-2" />
                Novo Lançamento
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Histórico</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingLancamentos ? (
                      <TableRow>
                        <TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell>
                      </TableRow>
                    ) : lancamentos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum lançamento registrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      lancamentos.map((l: Lancamento) => (
                        <TableRow key={l.id} data-testid={`row-lancamento-${l.id}`}>
                          <TableCell>{new Date(l.dataLancamento).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>{l.dataCompetencia ? new Date(l.dataCompetencia).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "-"}</TableCell>
                          <TableCell>
                            {l.tipoDocumento && <Badge variant="outline" className="mr-1">{l.tipoDocumento}</Badge>}
                            {l.numeroDocumento || "-"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{l.historico}</TableCell>
                          <TableCell className="text-right font-medium">
                            R$ {Number(l.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={l.status === "ativo" ? "default" : "secondary"}>{l.status}</Badge>
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

          <TabsContent value="centros" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Centros de Custo</h3>
              <Button onClick={() => setShowCentroCustoDialog(true)} data-testid="btn-novo-centro">
                <Plus className="h-4 w-4 mr-2" />
                Novo Centro de Custo
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {centrosCusto.length === 0 ? (
                <Card className="col-span-3">
                  <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                    Nenhum centro de custo cadastrado
                  </CardContent>
                </Card>
              ) : (
                centrosCusto.map((cc: CentroCusto) => (
                  <Card key={cc.id} data-testid={`centro-${cc.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{cc.nome}</CardTitle>
                        <Badge variant={cc.status === "ativo" ? "default" : "secondary"}>{cc.status}</Badge>
                      </div>
                      <CardDescription>Código: {cc.codigo || "-"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="sped" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  SPED ECD - Escrituração Contábil Digital
                </CardTitle>
                <CardDescription>Geração de arquivo SPED para transmissão à Receita Federal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ano</Label>
                    <Select defaultValue="2024">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2023">2023</SelectItem>
                        <SelectItem value="2022">2022</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select defaultValue="G">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="G">G - Livro Diário Geral</SelectItem>
                        <SelectItem value="R">R - Livro Diário Resumido</SelectItem>
                        <SelectItem value="A">A - Livro Diário Auxiliar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" data-testid="btn-gerar-sped">
                    <Download className="h-4 w-4 mr-2" />
                    Gerar Arquivo SPED ECD
                  </Button>
                  <Button variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Validar
                  </Button>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-semibold">Registros do SPED ECD</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="p-2 border rounded">
                      <p className="font-mono font-bold">I050</p>
                      <p className="text-muted-foreground">Plano de Contas</p>
                    </div>
                    <div className="p-2 border rounded">
                      <p className="font-mono font-bold">I150</p>
                      <p className="text-muted-foreground">Saldos Periódicos</p>
                    </div>
                    <div className="p-2 border rounded">
                      <p className="font-mono font-bold">I200</p>
                      <p className="text-muted-foreground">Lançamentos</p>
                    </div>
                    <div className="p-2 border rounded">
                      <p className="font-mono font-bold">J100</p>
                      <p className="text-muted-foreground">Balanço</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showContaDialog} onOpenChange={setShowContaDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Conta" : "Nova Conta Contábil"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveConta}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input name="codigo" defaultValue={editingItem?.codigo} required placeholder="1.1.01.001" data-testid="input-conta-codigo" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nível</Label>
                    <Input name="nivel" type="number" defaultValue={editingItem?.nivel || 1} min="1" max="5" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input name="descricao" defaultValue={editingItem?.descricao} required data-testid="input-conta-descricao" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select name="tipo" defaultValue={editingItem?.tipo || "ativo"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="passivo">Passivo</SelectItem>
                        <SelectItem value="patrimonio">Patrimônio Líquido</SelectItem>
                        <SelectItem value="receita">Receita</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Natureza</Label>
                    <Select name="natureza" defaultValue={editingItem?.natureza || "devedora"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="devedora">Devedora</SelectItem>
                        <SelectItem value="credora">Credora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Aceita Lançamento</Label>
                  <Select name="aceitaLancamento" defaultValue={editingItem?.aceitaLancamento === 1 ? "1" : "0"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Sim</SelectItem>
                      <SelectItem value="0">Não (conta sintética)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setShowContaDialog(false)}>Cancelar</Button>
                <Button type="submit" data-testid="btn-salvar-conta">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showCentroCustoDialog} onOpenChange={setShowCentroCustoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Centro de Custo</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createCentroCustoMutation.mutate({
                nome: formData.get("nome"),
                codigo: formData.get("codigo"),
                status: "ativo",
              });
            }}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input name="nome" required data-testid="input-centro-nome" />
                </div>
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input name="codigo" data-testid="input-centro-codigo" />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" data-testid="btn-salvar-centro">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showLancamentoDialog} onOpenChange={setShowLancamentoDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Novo Lançamento Contábil</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveLancamento}>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Data Lançamento *</Label>
                    <Input name="dataLancamento" type="date" required defaultValue={new Date().toISOString().split("T")[0]} data-testid="input-lanc-data" />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Competência</Label>
                    <Input name="dataCompetencia" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo Documento</Label>
                    <Select name="tipoDocumento">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NF">NF - Nota Fiscal</SelectItem>
                        <SelectItem value="REC">REC - Recibo</SelectItem>
                        <SelectItem value="CTR">CTR - Contrato</SelectItem>
                        <SelectItem value="GRF">GRF - Guia Recolhimento</SelectItem>
                        <SelectItem value="OUT">OUT - Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nº Documento</Label>
                    <Input name="numeroDocumento" data-testid="input-lanc-numero" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Histórico *</Label>
                  <Textarea name="historico" required placeholder="Descrição do lançamento..." data-testid="input-lanc-historico" />
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Partidas (Débito e Crédito)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addPartida}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Partida
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {partidas.map((p, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Select value={p.tipo} onValueChange={(v) => updatePartida(index, "tipo", v)}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="debito">Débito</SelectItem>
                            <SelectItem value="credito">Crédito</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={p.contaId.toString()} onValueChange={(v) => updatePartida(index, "contaId", Number(v))}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione a conta" />
                          </SelectTrigger>
                          <SelectContent>
                            {planoContas.filter((c: ContaContabil) => c.aceitaLancamento === 1).map((c: ContaContabil) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.codigo} - {c.descricao}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-32"
                          placeholder="Valor"
                          value={p.valor || ""}
                          onChange={(e) => updatePartida(index, "valor", Number(e.target.value))}
                        />
                        {partidas.length > 2 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removePartida(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <span className="text-sm text-muted-foreground">Total Débitos:</span>
                      <span className="ml-2 font-bold">R$ {totalDebitos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Total Créditos:</span>
                      <span className="ml-2 font-bold">R$ {totalCreditos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Diferença:</span>
                      <span className={`ml-2 font-bold ${Math.abs(diferenca) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                        R$ {Math.abs(diferenca).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        {Math.abs(diferenca) < 0.01 && <Check className="inline h-4 w-4 ml-1" />}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setShowLancamentoDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={Math.abs(diferenca) > 0.01} data-testid="btn-salvar-lancamento">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Lançamento
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showManusDialog} onOpenChange={setShowManusDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Manus AI - Assistente Contábil
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Comando para o Manus</Label>
                <Textarea
                  value={manusCommand}
                  onChange={(e) => setManusCommand(e.target.value)}
                  placeholder="Ex: Gerar DRE do período de janeiro a dezembro de 2024"
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
                    "Gerar DRE do mês atual",
                    "Gerar Balanço Patrimonial do período",
                    "Contabilizar NF-e número 12345",
                    "Lançar folha de pagamento da competência 01/2024",
                    "Gerar SPED ECD do ano 2024",
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

        <Dialog open={showRelatorioDialog} onOpenChange={setShowRelatorioDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Relatórios Contábeis</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-20 flex flex-col" data-testid="btn-relatorio-dre">
                <TrendingUp className="h-6 w-6 mb-1" />
                <span>DRE</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col" data-testid="btn-relatorio-balanco">
                <PieChart className="h-6 w-6 mb-1" />
                <span>Balanço</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col" data-testid="btn-relatorio-balancete">
                <BarChart3 className="h-6 w-6 mb-1" />
                <span>Balancete</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col" data-testid="btn-relatorio-razao">
                <BookOpen className="h-6 w-6 mb-1" />
                <span>Razão</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Importar Balanço Patrimonial</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="font-semibold text-blue-800 mb-2">Como usar:</p>
                <ol className="list-decimal list-inside text-blue-700 space-y-1">
                  <li>Faça upload do PDF do balanço ou cole o texto manualmente</li>
                  <li>Informe a data do balanço</li>
                  <li>Clique em "Importar" para criar contas e lançamentos</li>
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data do Balanço</Label>
                  <Input
                    type="date"
                    id="dataBalanco"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    data-testid="input-data-balanco"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Empresa (Tenant)</Label>
                  <Input
                    type="text"
                    id="empresaBalanco"
                    placeholder="ID do tenant (opcional)"
                    data-testid="input-tenant-balanco"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Upload do PDF do Balanço</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    id="pdfBalanco"
                    data-testid="input-pdf-balanco"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const formData = new FormData();
                        formData.append("pdf", file);
                        try {
                          const res = await fetch("/api/contabil/extrair-pdf", {
                            method: "POST",
                            body: formData,
                          });
                          const data = await res.json();
                          if (data.success) {
                            setImportTexto(data.texto);
                            toast({ title: `PDF processado: ${data.paginas} página(s)` });
                          } else {
                            toast({ title: "Erro ao processar PDF", variant: "destructive" });
                          }
                        } catch (err) {
                          toast({ title: "Erro ao enviar PDF", variant: "destructive" });
                        }
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Ou cole o texto manualmente abaixo</p>
              </div>

              <div className="space-y-2">
                <Label>Texto do Balanço Patrimonial</Label>
                <Textarea
                  placeholder="Texto extraído do PDF aparecerá aqui, ou cole manualmente..."
                  className="min-h-[200px] font-mono text-xs"
                  value={importTexto}
                  onChange={(e) => setImportTexto(e.target.value)}
                  data-testid="textarea-balanco"
                />
              </div>

              {importResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">Resultado da Importação:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Contas criadas: <strong>{importResult.contasCriadas}</strong></div>
                    <div>Lançamentos: <strong>{importResult.lancamentosCriados}</strong></div>
                    {importResult.resumo && (
                      <>
                        <div>Total Débitos: <strong>{importResult.resumo.totalDebito?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
                        <div>Total Créditos: <strong>{importResult.resumo.totalCredito?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowImportDialog(false); setImportTexto(""); setImportResult(null); }}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    const dataBalanco = (document.getElementById("dataBalanco") as HTMLInputElement)?.value;
                    const tenantId = (document.getElementById("empresaBalanco") as HTMLInputElement)?.value;
                    importBalancoMutation.mutate({
                      texto: importTexto,
                      dataBalanco: dataBalanco || new Date().toISOString().split("T")[0],
                      tenantId: tenantId ? Number(tenantId) : undefined,
                    });
                  }}
                  disabled={!importTexto.trim() || importBalancoMutation.isPending}
                  data-testid="btn-processar-balanco"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importBalancoMutation.isPending ? "Processando..." : "Importar e Criar Abertura"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
