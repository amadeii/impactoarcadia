import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { GrupoEmpresarialSelector, GrupoBanner } from "@/components/GrupoEmpresarialSelector";
import {
  Receipt,
  Calculator,
  FileText,
  Settings,
  Search,
  Plus,
  Edit,
  Trash2,
  Shield,
  TrendingUp,
  FileCheck,
  AlertCircle,
  ChevronLeft,
  Building2,
  Tag,
  ArrowUpDown,
  Save,
  X,
  Package,
  Percent,
  BookOpen,
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FiscalNcm {
  id: number;
  codigo: string;
  descricao: string;
  aliqIpi?: string;
  aliqPis?: string;
  aliqCofins?: string;
  cest?: string;
  unidadeTributavel?: string;
  exTipi?: string;
  exNcm?: string;
  createdAt: string;
  updatedAt: string;
}

interface FiscalGrupoTributacao {
  id: number;
  tenantId: number;
  nome: string;
  ncm: string;
  cest?: string;
  cfopVendaInterna: string;
  cfopVendaInterestadual: string;
  cfopDevolucaoInterna: string;
  cfopDevolucaoInterestadual: string;
  cstIcms: string;
  csosnIcms?: string;
  percIcms?: string;
  percReducaoBaseIcms?: string;
  cstPis: string;
  percPis?: string;
  cstCofins: string;
  percCofins?: string;
  cstIpi: string;
  percIpi?: string;
  percIbsUf?: string;
  percIbsMun?: string;
  percCbs?: string;
  cstIbsCbs?: string;
  observacoes?: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FiscalNaturezaOperacao {
  id: number;
  tenantId: number;
  codigo: string;
  descricao: string;
  tipo: string;
  cfopInterno: string;
  cfopInterestadual: string;
  cfopExportacao?: string;
  movimentaEstoque: boolean;
  geraFinanceiro: boolean;
  destacaIpi: boolean;
  destacaIcmsSt: boolean;
  finalidade: string;
  observacoes?: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FiscalCfop {
  id: number;
  codigo: string;
  descricao: string;
  tipo: string;
  natureza: string;
  aplicacao?: string;
  indNfe: boolean;
  indComunica: boolean;
  indTransp: boolean;
  indDevol: boolean;
  createdAt: string;
}

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

export default function Fisco() {
  const [activeTab, setActiveTab] = useState("ncm");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return (
    <BrowserFrame>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="p-6 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
              <Receipt className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Arcádia Fisco
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Motor Fiscal Centralizado - NF-e, NFC-e, SPED, Reforma Tributária
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <GrupoEmpresarialSelector />
            <Badge variant="outline" className="px-3 py-1.5 bg-green-50 text-green-700 border-green-200">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Ambiente Homologação
            </Badge>
            <Badge variant="outline" className="px-3 py-1.5 bg-blue-50 text-blue-700 border-blue-200">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              IBS/CBS Ready
            </Badge>
          </div>
        </div>
        <GrupoBanner className="mt-3" />
      </div>

      <div className="flex-1 p-6 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="mb-4 bg-white/60 dark:bg-slate-800/60 p-1 rounded-xl shadow-sm">
            <TabsTrigger value="ncm" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4" data-testid="tab-ncm">
              <Package className="h-4 w-4 mr-2" />
              NCM
            </TabsTrigger>
            <TabsTrigger value="grupos" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4" data-testid="tab-grupos">
              <Tag className="h-4 w-4 mr-2" />
              Grupos Tributários
            </TabsTrigger>
            <TabsTrigger value="natureza" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4" data-testid="tab-natureza">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Naturezas
            </TabsTrigger>
            <TabsTrigger value="cfop" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4" data-testid="tab-cfop">
              <BookOpen className="h-4 w-4 mr-2" />
              CFOPs
            </TabsTrigger>
            <TabsTrigger value="notas" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4" data-testid="tab-notas">
              <FileCheck className="h-4 w-4 mr-2" />
              Notas Fiscais
            </TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4" data-testid="tab-config">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto">
            <TabsContent value="ncm" className="h-full m-0">
              <NcmTab />
            </TabsContent>
            <TabsContent value="grupos" className="h-full m-0">
              <GruposTributariosTab />
            </TabsContent>
            <TabsContent value="natureza" className="h-full m-0">
              <NaturezaOperacaoTab />
            </TabsContent>
            <TabsContent value="cfop" className="h-full m-0">
              <CfopTab />
            </TabsContent>
            <TabsContent value="notas" className="h-full m-0">
              <NotasFiscaisTab />
            </TabsContent>
            <TabsContent value="config" className="h-full m-0">
              <ConfiguracoesTab />
            </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </BrowserFrame>
  );
}

function NcmTab() {
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [selectedNcm, setSelectedNcm] = useState<FiscalNcm | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ncms, isLoading } = useQuery<FiscalNcm[]>({
    queryKey: ["fiscal-ncm", search],
    queryFn: () => api.get(`/api/fisco/ncm?search=${search}&limit=100`),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<FiscalNcm>) =>
      selectedNcm
        ? api.put(`/api/fisco/ncm/${selectedNcm.id}`, data)
        : api.post("/api/fisco/ncm", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-ncm"] });
      toast({ title: "NCM salvo com sucesso" });
      setShowDialog(false);
      setSelectedNcm(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/fisco/ncm/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-ncm"] });
      toast({ title: "NCM excluído" });
    },
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              Tabela NCM
            </CardTitle>
            <CardDescription>
              Nomenclatura Comum do Mercosul - Classificação fiscal de produtos
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar NCM..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-ncm"
              />
            </div>
            <Button
              onClick={() => {
                setSelectedNcm(null);
                setShowDialog(true);
              }}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-add-ncm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo NCM
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20 text-center">IPI %</TableHead>
                <TableHead className="w-20 text-center">PIS %</TableHead>
                <TableHead className="w-20 text-center">COFINS %</TableHead>
                <TableHead className="w-32">CEST</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
              ) : ncms && ncms.length > 0 ? (
                ncms.map((ncm) => (
                  <TableRow key={ncm.id} data-testid={`row-ncm-${ncm.id}`}>
                    <TableCell className="font-mono font-medium">{ncm.codigo}</TableCell>
                    <TableCell className="max-w-md truncate">{ncm.descricao}</TableCell>
                    <TableCell className="text-center">{ncm.aliqIpi || "-"}</TableCell>
                    <TableCell className="text-center">{ncm.aliqPis || "-"}</TableCell>
                    <TableCell className="text-center">{ncm.aliqCofins || "-"}</TableCell>
                    <TableCell className="font-mono">{ncm.cest || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedNcm(ncm);
                            setShowDialog(true);
                          }}
                          data-testid={`button-edit-ncm-${ncm.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deleteMutation.mutate(ncm.id)}
                          data-testid={`button-delete-ncm-${ncm.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum NCM cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedNcm ? "Editar NCM" : "Novo NCM"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              saveMutation.mutate({
                codigo: formData.get("codigo") as string,
                descricao: formData.get("descricao") as string,
                aliqIpi: formData.get("aliqIpi") as string || undefined,
                aliqPis: formData.get("aliqPis") as string || undefined,
                aliqCofins: formData.get("aliqCofins") as string || undefined,
                cest: formData.get("cest") as string || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="codigo">Código NCM *</Label>
                <Input
                  id="codigo"
                  name="codigo"
                  defaultValue={selectedNcm?.codigo}
                  placeholder="0000.00.00"
                  required
                  data-testid="input-ncm-codigo"
                />
              </div>
              <div>
                <Label htmlFor="cest">CEST</Label>
                <Input
                  id="cest"
                  name="cest"
                  defaultValue={selectedNcm?.cest}
                  placeholder="00.000.00"
                  data-testid="input-ncm-cest"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="descricao">Descrição *</Label>
              <Textarea
                id="descricao"
                name="descricao"
                defaultValue={selectedNcm?.descricao}
                placeholder="Descrição do NCM"
                required
                data-testid="input-ncm-descricao"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="aliqIpi">Alíq. IPI %</Label>
                <Input
                  id="aliqIpi"
                  name="aliqIpi"
                  defaultValue={selectedNcm?.aliqIpi}
                  placeholder="0.00"
                  data-testid="input-ncm-ipi"
                />
              </div>
              <div>
                <Label htmlFor="aliqPis">Alíq. PIS %</Label>
                <Input
                  id="aliqPis"
                  name="aliqPis"
                  defaultValue={selectedNcm?.aliqPis}
                  placeholder="0.00"
                  data-testid="input-ncm-pis"
                />
              </div>
              <div>
                <Label htmlFor="aliqCofins">Alíq. COFINS %</Label>
                <Input
                  id="aliqCofins"
                  name="aliqCofins"
                  defaultValue={selectedNcm?.aliqCofins}
                  placeholder="0.00"
                  data-testid="input-ncm-cofins"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700" data-testid="button-save-ncm">
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function GruposTributariosTab() {
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState<FiscalGrupoTributacao | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: grupos, isLoading } = useQuery<FiscalGrupoTributacao[]>({
    queryKey: ["fiscal-grupos", search],
    queryFn: () => api.get(`/api/fisco/grupos-tributacao?search=${search}`),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<FiscalGrupoTributacao>) =>
      selectedGrupo
        ? api.put(`/api/fisco/grupos-tributacao/${selectedGrupo.id}`, data)
        : api.post("/api/fisco/grupos-tributacao", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-grupos"] });
      toast({ title: "Grupo tributário salvo com sucesso" });
      setShowDialog(false);
      setSelectedGrupo(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/fisco/grupos-tributacao/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-grupos"] });
      toast({ title: "Grupo excluído" });
    },
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-blue-600" />
              Grupos Tributários
            </CardTitle>
            <CardDescription>
              Padrões de tributação por NCM - Configuração de CST, CFOP e alíquotas
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar grupo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-grupos"
              />
            </div>
            <Button
              onClick={() => {
                setSelectedGrupo(null);
                setShowDialog(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-add-grupo"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Grupo
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-28">NCM</TableHead>
                <TableHead className="w-24">CST ICMS</TableHead>
                <TableHead className="w-20 text-center">ICMS %</TableHead>
                <TableHead className="w-20 text-center">PIS %</TableHead>
                <TableHead className="w-20 text-center">COFINS %</TableHead>
                <TableHead className="w-20 text-center">IBS/CBS</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
              ) : grupos && grupos.length > 0 ? (
                grupos.map((grupo) => (
                  <TableRow key={grupo.id} data-testid={`row-grupo-${grupo.id}`}>
                    <TableCell className="font-medium">{grupo.nome}</TableCell>
                    <TableCell className="font-mono">{grupo.ncm}</TableCell>
                    <TableCell>{grupo.cstIcms}</TableCell>
                    <TableCell className="text-center">{grupo.percIcms || "-"}</TableCell>
                    <TableCell className="text-center">{grupo.percPis || "-"}</TableCell>
                    <TableCell className="text-center">{grupo.percCofins || "-"}</TableCell>
                    <TableCell className="text-center">
                      {grupo.percCbs || grupo.percIbsUf ? (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700">
                          <Percent className="h-3 w-3 mr-1" />
                          Sim
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={grupo.ativo ? "default" : "secondary"}>
                        {grupo.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedGrupo(grupo);
                            setShowDialog(true);
                          }}
                          data-testid={`button-edit-grupo-${grupo.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deleteMutation.mutate(grupo.id)}
                          data-testid={`button-delete-grupo-${grupo.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum grupo tributário cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedGrupo ? "Editar Grupo Tributário" : "Novo Grupo Tributário"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              saveMutation.mutate({
                tenantId: 1,
                nome: formData.get("nome") as string,
                ncm: formData.get("ncm") as string,
                cfopVendaInterna: formData.get("cfopVendaInterna") as string || "5102",
                cfopVendaInterestadual: formData.get("cfopVendaInterestadual") as string || "6102",
                cfopDevolucaoInterna: formData.get("cfopDevolucaoInterna") as string || "1202",
                cfopDevolucaoInterestadual: formData.get("cfopDevolucaoInterestadual") as string || "2202",
                cstIcms: formData.get("cstIcms") as string,
                percIcms: formData.get("percIcms") as string || undefined,
                cstPis: formData.get("cstPis") as string || "01",
                percPis: formData.get("percPis") as string || undefined,
                cstCofins: formData.get("cstCofins") as string || "01",
                percCofins: formData.get("percCofins") as string || undefined,
                cstIpi: formData.get("cstIpi") as string || "50",
                percIpi: formData.get("percIpi") as string || undefined,
                percIbsUf: formData.get("percIbsUf") as string || undefined,
                percIbsMun: formData.get("percIbsMun") as string || undefined,
                percCbs: formData.get("percCbs") as string || undefined,
                ativo: true,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome">Nome do Grupo *</Label>
                <Input
                  id="nome"
                  name="nome"
                  defaultValue={selectedGrupo?.nome}
                  placeholder="Ex: Produtos Alimentícios"
                  required
                  data-testid="input-grupo-nome"
                />
              </div>
              <div>
                <Label htmlFor="ncm">NCM *</Label>
                <Input
                  id="ncm"
                  name="ncm"
                  defaultValue={selectedGrupo?.ncm}
                  placeholder="0000.00.00"
                  required
                  data-testid="input-grupo-ncm"
                />
              </div>
            </div>

            <Separator />
            <h4 className="font-medium text-sm">ICMS</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cstIcms">CST ICMS *</Label>
                <Select name="cstIcms" defaultValue={selectedGrupo?.cstIcms || "00"}>
                  <SelectTrigger data-testid="select-grupo-cst-icms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="00">00 - Tributada integralmente</SelectItem>
                    <SelectItem value="10">10 - Tributada com ST</SelectItem>
                    <SelectItem value="20">20 - Redução de base</SelectItem>
                    <SelectItem value="40">40 - Isenta</SelectItem>
                    <SelectItem value="41">41 - Não tributada</SelectItem>
                    <SelectItem value="60">60 - ICMS cobrado por ST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="percIcms">Alíquota ICMS %</Label>
                <Input
                  id="percIcms"
                  name="percIcms"
                  defaultValue={selectedGrupo?.percIcms}
                  placeholder="18.00"
                  data-testid="input-grupo-perc-icms"
                />
              </div>
              <div>
                <Label htmlFor="cfopVendaInterna">CFOP Venda Interna</Label>
                <Input
                  id="cfopVendaInterna"
                  name="cfopVendaInterna"
                  defaultValue={selectedGrupo?.cfopVendaInterna || "5102"}
                  data-testid="input-grupo-cfop-venda"
                />
              </div>
            </div>

            <Separator />
            <h4 className="font-medium text-sm">PIS / COFINS</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="cstPis">CST PIS</Label>
                <Input
                  id="cstPis"
                  name="cstPis"
                  defaultValue={selectedGrupo?.cstPis || "01"}
                  data-testid="input-grupo-cst-pis"
                />
              </div>
              <div>
                <Label htmlFor="percPis">Alíq. PIS %</Label>
                <Input
                  id="percPis"
                  name="percPis"
                  defaultValue={selectedGrupo?.percPis}
                  placeholder="1.65"
                  data-testid="input-grupo-perc-pis"
                />
              </div>
              <div>
                <Label htmlFor="cstCofins">CST COFINS</Label>
                <Input
                  id="cstCofins"
                  name="cstCofins"
                  defaultValue={selectedGrupo?.cstCofins || "01"}
                  data-testid="input-grupo-cst-cofins"
                />
              </div>
              <div>
                <Label htmlFor="percCofins">Alíq. COFINS %</Label>
                <Input
                  id="percCofins"
                  name="percCofins"
                  defaultValue={selectedGrupo?.percCofins}
                  placeholder="7.60"
                  data-testid="input-grupo-perc-cofins"
                />
              </div>
            </div>

            <Separator />
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">Reforma Tributária (IBS/CBS)</h4>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">Novo</Badge>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="percIbsUf">IBS UF %</Label>
                <Input
                  id="percIbsUf"
                  name="percIbsUf"
                  defaultValue={selectedGrupo?.percIbsUf}
                  placeholder="0.00"
                  data-testid="input-grupo-ibs-uf"
                />
              </div>
              <div>
                <Label htmlFor="percIbsMun">IBS Município %</Label>
                <Input
                  id="percIbsMun"
                  name="percIbsMun"
                  defaultValue={selectedGrupo?.percIbsMun}
                  placeholder="0.00"
                  data-testid="input-grupo-ibs-mun"
                />
              </div>
              <div>
                <Label htmlFor="percCbs">CBS %</Label>
                <Input
                  id="percCbs"
                  name="percCbs"
                  defaultValue={selectedGrupo?.percCbs}
                  placeholder="0.00"
                  data-testid="input-grupo-cbs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-grupo">
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function NaturezaOperacaoTab() {
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [selectedNat, setSelectedNat] = useState<FiscalNaturezaOperacao | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: naturezas, isLoading } = useQuery<FiscalNaturezaOperacao[]>({
    queryKey: ["fiscal-natureza", search],
    queryFn: () => api.get(`/api/fisco/natureza-operacao?search=${search}`),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<FiscalNaturezaOperacao>) =>
      selectedNat
        ? api.put(`/api/fisco/natureza-operacao/${selectedNat.id}`, data)
        : api.post("/api/fisco/natureza-operacao", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-natureza"] });
      toast({ title: "Natureza de operação salva com sucesso" });
      setShowDialog(false);
      setSelectedNat(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/fisco/natureza-operacao/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-natureza"] });
      toast({ title: "Natureza excluída" });
    },
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-orange-600" />
              Naturezas de Operação
            </CardTitle>
            <CardDescription>
              Configuração de operações fiscais - Venda, Devolução, Transferência
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar natureza..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-natureza"
              />
            </div>
            <Button
              onClick={() => {
                setSelectedNat(null);
                setShowDialog(true);
              }}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="button-add-natureza"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Natureza
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-24">Tipo</TableHead>
                <TableHead className="w-28">CFOP Interno</TableHead>
                <TableHead className="w-28">CFOP Interest.</TableHead>
                <TableHead className="w-20 text-center">Estoque</TableHead>
                <TableHead className="w-20 text-center">Financeiro</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
              ) : naturezas && naturezas.length > 0 ? (
                naturezas.map((nat) => (
                  <TableRow key={nat.id} data-testid={`row-natureza-${nat.id}`}>
                    <TableCell className="font-mono">{nat.codigo}</TableCell>
                    <TableCell className="font-medium">{nat.descricao}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{nat.tipo}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{nat.cfopInterno}</TableCell>
                    <TableCell className="font-mono">{nat.cfopInterestadual}</TableCell>
                    <TableCell className="text-center">
                      {nat.movimentaEstoque ? (
                        <Badge variant="default" className="bg-green-500">Sim</Badge>
                      ) : (
                        <Badge variant="secondary">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {nat.geraFinanceiro ? (
                        <Badge variant="default" className="bg-green-500">Sim</Badge>
                      ) : (
                        <Badge variant="secondary">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={nat.ativo ? "default" : "secondary"}>
                        {nat.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedNat(nat);
                            setShowDialog(true);
                          }}
                          data-testid={`button-edit-natureza-${nat.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deleteMutation.mutate(nat.id)}
                          data-testid={`button-delete-natureza-${nat.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma natureza de operação cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedNat ? "Editar Natureza" : "Nova Natureza de Operação"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              saveMutation.mutate({
                tenantId: 1,
                codigo: formData.get("codigo") as string,
                descricao: formData.get("descricao") as string,
                tipo: formData.get("tipo") as string || "saida",
                cfopInterno: formData.get("cfopInterno") as string,
                cfopInterestadual: formData.get("cfopInterestadual") as string,
                finalidade: formData.get("finalidade") as string || "1",
                movimentaEstoque: (formData.get("movimentaEstoque") as string) === "on",
                geraFinanceiro: (formData.get("geraFinanceiro") as string) === "on",
                destacaIpi: false,
                destacaIcmsSt: false,
                ativo: true,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  name="codigo"
                  defaultValue={selectedNat?.codigo}
                  placeholder="VENDA"
                  required
                  data-testid="input-natureza-codigo"
                />
              </div>
              <div>
                <Label htmlFor="tipo">Tipo *</Label>
                <Select name="tipo" defaultValue={selectedNat?.tipo || "saida"}>
                  <SelectTrigger data-testid="select-natureza-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="devolucao">Devolução</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                name="descricao"
                defaultValue={selectedNat?.descricao}
                placeholder="Venda de mercadoria"
                required
                data-testid="input-natureza-descricao"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cfopInterno">CFOP Interno *</Label>
                <Input
                  id="cfopInterno"
                  name="cfopInterno"
                  defaultValue={selectedNat?.cfopInterno}
                  placeholder="5102"
                  required
                  data-testid="input-natureza-cfop-interno"
                />
              </div>
              <div>
                <Label htmlFor="cfopInterestadual">CFOP Interestadual *</Label>
                <Input
                  id="cfopInterestadual"
                  name="cfopInterestadual"
                  defaultValue={selectedNat?.cfopInterestadual}
                  placeholder="6102"
                  required
                  data-testid="input-natureza-cfop-inter"
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="movimentaEstoque"
                  name="movimentaEstoque"
                  defaultChecked={selectedNat?.movimentaEstoque ?? true}
                />
                <Label htmlFor="movimentaEstoque">Movimenta Estoque</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="geraFinanceiro"
                  name="geraFinanceiro"
                  defaultChecked={selectedNat?.geraFinanceiro ?? true}
                />
                <Label htmlFor="geraFinanceiro">Gera Financeiro</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700" data-testid="button-save-natureza">
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CfopTab() {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");

  const { data: cfops, isLoading } = useQuery<FiscalCfop[]>({
    queryKey: ["fiscal-cfop", search, tipoFilter],
    queryFn: () => {
      let url = `/api/fisco/cfop?search=${search}`;
      if (tipoFilter !== "todos") url += `&tipo=${tipoFilter}`;
      return api.get(url);
    },
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-600" />
              Tabela CFOP
            </CardTitle>
            <CardDescription>
              Código Fiscal de Operações e Prestações
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-40" data-testid="select-cfop-tipo">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar CFOP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-cfop"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-24">Tipo</TableHead>
                <TableHead className="w-32">Natureza</TableHead>
                <TableHead className="w-20 text-center">NF-e</TableHead>
                <TableHead className="w-20 text-center">Devolução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(10)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    </TableRow>
                  ))
              ) : cfops && cfops.length > 0 ? (
                cfops.map((cfop) => (
                  <TableRow key={cfop.id} data-testid={`row-cfop-${cfop.id}`}>
                    <TableCell className="font-mono font-medium">{cfop.codigo}</TableCell>
                    <TableCell>{cfop.descricao}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cfop.tipo === "entrada" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}
                      >
                        {cfop.tipo === "entrada" ? "Entrada" : "Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{cfop.natureza}</TableCell>
                    <TableCell className="text-center">
                      {cfop.indNfe ? <Badge variant="default">Sim</Badge> : <Badge variant="secondary">Não</Badge>}
                    </TableCell>
                    <TableCell className="text-center">
                      {cfop.indDevol ? <Badge variant="default">Sim</Badge> : <Badge variant="secondary">Não</Badge>}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum CFOP encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function NotasFiscaisTab() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-emerald-600" />
          Notas Fiscais Eletrônicas
        </CardTitle>
        <CardDescription>
          Emissão, consulta e gestão de NF-e e NFC-e
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="p-6 rounded-full bg-emerald-50 w-24 h-24 mx-auto flex items-center justify-center mb-4">
            <FileCheck className="h-12 w-12 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Módulo de Notas Fiscais</h3>
          <p className="text-muted-foreground max-w-md">
            O módulo de emissão de NF-e e NFC-e está em desenvolvimento.
            Será integrado com a biblioteca nfelib (Python) para emissão e validação.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
              <AlertCircle className="h-3 w-3 mr-1" />
              Em Desenvolvimento
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfiguracoesTab() {
  const { toast } = useToast();

  return (
    <div className="grid grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Dados do Emitente
          </CardTitle>
          <CardDescription>
            Configurações da empresa para emissão de documentos fiscais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CNPJ</Label>
              <Input placeholder="00.000.000/0001-00" data-testid="input-config-cnpj" />
            </div>
            <div>
              <Label>Inscrição Estadual</Label>
              <Input placeholder="000.000.000.000" data-testid="input-config-ie" />
            </div>
          </div>
          <div>
            <Label>Razão Social</Label>
            <Input placeholder="Nome da empresa" data-testid="input-config-razao" />
          </div>
          <div>
            <Label>Nome Fantasia</Label>
            <Input placeholder="Nome fantasia" data-testid="input-config-fantasia" />
          </div>
          <Button className="w-full" onClick={() => toast({ title: "Configurações salvas" })} data-testid="button-save-emitente">
            <Save className="h-4 w-4 mr-2" />
            Salvar Dados do Emitente
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Certificado Digital
          </CardTitle>
          <CardDescription>
            Certificado A1 para assinatura de documentos fiscais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border-2 border-dashed rounded-lg text-center">
            <Shield className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Arraste o certificado .pfx ou clique para selecionar
            </p>
            <Input type="file" className="hidden" accept=".pfx,.p12" data-testid="input-certificado-file" />
            <Button variant="outline" className="mt-2">
              Selecionar Certificado
            </Button>
          </div>
          <div>
            <Label>Senha do Certificado</Label>
            <Input type="password" placeholder="••••••••" data-testid="input-certificado-senha" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="ambiente" />
              <Label htmlFor="ambiente">Ambiente Produção</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-orange-600" />
            Regime Tributário
          </CardTitle>
          <CardDescription>
            Configurações do regime tributário da empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Regime Tributário</Label>
            <Select defaultValue="3">
              <SelectTrigger data-testid="select-config-regime">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Simples Nacional</SelectItem>
                <SelectItem value="2">Simples Nacional - Excesso</SelectItem>
                <SelectItem value="3">Regime Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>CNAE Principal</Label>
            <Input placeholder="0000-0/00" data-testid="input-config-cnae" />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="reformaTrib" />
            <Label htmlFor="reformaTrib">Habilitar IBS/CBS (Reforma Tributária)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            Reforma Tributária
          </CardTitle>
          <CardDescription>
            Configurações do IBS e CBS para transição tributária
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              O Arcádia Fisco já está preparado para a Reforma Tributária brasileira.
              Configure as alíquotas do IBS (estadual e municipal) e CBS aqui.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>IBS UF (%)</Label>
              <Input placeholder="0.00" data-testid="input-config-ibs-uf" />
            </div>
            <div>
              <Label>IBS Mun. (%)</Label>
              <Input placeholder="0.00" data-testid="input-config-ibs-mun" />
            </div>
            <div>
              <Label>CBS (%)</Label>
              <Input placeholder="0.00" data-testid="input-config-cbs" />
            </div>
          </div>
          <Button variant="outline" className="w-full" data-testid="button-save-reforma">
            <Save className="h-4 w-4 mr-2" />
            Salvar Configurações IBS/CBS
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
