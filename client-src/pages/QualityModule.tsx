import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Beaker, FileText, AlertTriangle, ClipboardList, Users, MapPin,
  Plus, Search, Edit, Trash2, RefreshCw, CheckCircle, XCircle, Clock,
  Building2, FlaskConical, FileCheck, GraduationCap, Loader2, Eye,
  Upload, Download, FileUp, BookOpen, Calendar, UserCheck, Award
} from "lucide-react";

type TabType = "dashboard" | "samples" | "lab-reports" | "rnc" | "documents" | "field-forms" | "training" | "suppliers";

interface Sample {
  id: number;
  sampleCode: string;
  sampleType: string;
  collectionDate: string;
  collectionLocation: string;
  collectionResponsible: string;
  laboratoryId?: number;
  status: string;
  projectId?: number;
}

interface LabReport {
  id: number;
  sampleId: number;
  reportNumber: string;
  laboratoryId?: number;
  issueDate: string;
  status: string;
  conclusion?: string;
}

interface NonConformity {
  id: number;
  rncNumber: string;
  title: string;
  description: string;
  type: string;
  severity: string;
  status: string;
  detectedAt: string;
  detectedBy: string;
  dueDate?: string;
}

interface QualityDocument {
  id: number;
  documentCode: string;
  title: string;
  type: string;
  category: string;
  version: string;
  status: string;
  effectiveDate?: string;
}

interface FieldForm {
  id: number;
  formCode: string;
  formType: string;
  title: string;
  collectionDate: string;
  location: string;
  status: string;
}

interface Training {
  id: number;
  employeeId: string;
  trainingName: string;
  trainingType: string;
  completedDate: string;
  expiryDate: string;
  status: string;
}

interface HomologatedSupplier {
  id: number;
  code: string;
  name: string;
  certifications: string[];
  qualityScore: number;
  homologationStatus: string;
  homologationExpiry: string;
}

interface DashboardData {
  samples: { total: number };
  nonConformities: { open: number };
  expenses: { pending: number; totalPending: number };
  documents: { active: number };
  trainings: { expiringSoon: number };
}

const api = {
  get: async (url: string) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  },
  post: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  },
  put: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  },
};

const statusColors: Record<string, string> = {
  coletada: "bg-blue-500",
  enviada: "bg-yellow-500",
  em_analise: "bg-orange-500",
  resultado_recebido: "bg-purple-500",
  aprovada: "bg-green-500",
  reprovada: "bg-red-500",
  aberta: "bg-red-500",
  em_tratamento: "bg-yellow-500",
  pendente_verificacao: "bg-orange-500",
  fechada: "bg-green-500",
  vigente: "bg-green-500",
  em_revisao: "bg-yellow-500",
  obsoleto: "bg-gray-500",
  rascunho: "bg-gray-400",
  preenchido: "bg-blue-500",
  revisado: "bg-purple-500",
  aprovado: "bg-green-500",
  pendente: "bg-yellow-500",
  em_andamento: "bg-blue-500",
  concluido: "bg-green-500",
  vencido: "bg-red-500",
  approved: "bg-green-500",
  pending: "bg-yellow-500",
  expired: "bg-red-500",
  blocked: "bg-red-700",
};

export default function QualityModule() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSampleDialog, setShowSampleDialog] = useState(false);
  const [showRncDialog, setShowRncDialog] = useState(false);
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [showDocViewDialog, setShowDocViewDialog] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<QualityDocument | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingFileUrl, setViewingFileUrl] = useState<string | null>(null);
  const [showTrainingDialog, setShowTrainingDialog] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [showTrainingViewDialog, setShowTrainingViewDialog] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  
  const sampleTrainings = [
    { id: 1, employeeName: "João Silva", employeeId: "emp-001", trainingName: "Amostragem de Água Subterrânea", trainingType: "Técnico", completedDate: "2025-10-15", expiryDate: "2026-10-15", status: "valid", instructor: "Dr. Roberto Lima", workload: 16 },
    { id: 2, employeeName: "Maria Santos", employeeId: "emp-002", trainingName: "NR-35 Trabalho em Altura", trainingType: "Segurança", completedDate: "2025-08-20", expiryDate: "2026-08-20", status: "valid", instructor: "SENAI", workload: 8 },
    { id: 3, employeeName: "Carlos Oliveira", employeeId: "emp-003", trainingName: "Operação de Sondas", trainingType: "Técnico", completedDate: "2024-12-10", expiryDate: "2025-12-10", status: "expiring", instructor: "Técnico Sr. Paulo", workload: 40 },
    { id: 4, employeeName: "Ana Costa", employeeId: "emp-004", trainingName: "ISO 17025 - Requisitos", trainingType: "Qualidade", completedDate: "2024-06-05", expiryDate: "2025-06-05", status: "expired", instructor: "Bureau Veritas", workload: 24 },
  ];

  const { data: dashboard, isLoading: loadingDashboard } = useQuery<DashboardData>({
    queryKey: ["/api/quality/dashboard"],
    queryFn: () => api.get("/api/quality/dashboard"),
  });

  const { data: samples = [], refetch: refetchSamples } = useQuery<Sample[]>({
    queryKey: ["/api/quality/samples"],
    queryFn: async () => {
      const res = await api.get("/api/quality/samples");
      return res.data || [];
    },
  });

  const { data: labReports = [] } = useQuery<LabReport[]>({
    queryKey: ["/api/quality/lab-reports"],
    queryFn: async () => {
      const res = await api.get("/api/quality/lab-reports");
      return res.data || [];
    },
  });

  const { data: nonConformities = [], refetch: refetchRnc } = useQuery<NonConformity[]>({
    queryKey: ["/api/quality/non-conformities"],
    queryFn: async () => {
      const res = await api.get("/api/quality/non-conformities");
      return res.data || [];
    },
  });

  const { data: documents = [], refetch: refetchDocs } = useQuery<QualityDocument[]>({
    queryKey: ["/api/quality/documents"],
    queryFn: async () => {
      const res = await api.get("/api/quality/documents");
      return res.data || [];
    },
  });

  const { data: fieldForms = [] } = useQuery<FieldForm[]>({
    queryKey: ["/api/quality/field-forms"],
    queryFn: async () => {
      const res = await api.get("/api/quality/field-forms");
      return res.data || [];
    },
  });

  const { data: trainings = [] } = useQuery<Training[]>({
    queryKey: ["/api/quality/training-matrix"],
    queryFn: async () => {
      const res = await api.get("/api/quality/training-matrix");
      return res.data || [];
    },
  });

  const { data: homologatedSuppliers = [] } = useQuery<HomologatedSupplier[]>({
    queryKey: ["/api/quality/homologated-suppliers"],
    queryFn: async () => {
      const res = await api.get("/api/quality/homologated-suppliers");
      return res.data || [];
    },
  });

  const createSampleMutation = useMutation({
    mutationFn: (data: Partial<Sample>) => api.post("/api/quality/samples", data),
    onSuccess: () => {
      toast({ title: "Amostra criada com sucesso" });
      refetchSamples();
      setShowSampleDialog(false);
    },
    onError: () => toast({ title: "Erro ao criar amostra", variant: "destructive" }),
  });

  const createRncMutation = useMutation({
    mutationFn: (data: Partial<NonConformity>) => api.post("/api/quality/non-conformities", data),
    onSuccess: () => {
      toast({ title: "RNC criada com sucesso" });
      refetchRnc();
      setShowRncDialog(false);
    },
    onError: () => toast({ title: "Erro ao criar RNC", variant: "destructive" }),
  });

  const createDocMutation = useMutation({
    mutationFn: (data: Partial<QualityDocument>) => api.post("/api/quality/documents", data),
    onSuccess: () => {
      toast({ title: "Documento criado com sucesso" });
      refetchDocs();
      setShowDocDialog(false);
    },
    onError: () => toast({ title: "Erro ao criar documento", variant: "destructive" }),
  });

  const createTrainingMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/quality/training-matrix", data),
    onSuccess: () => {
      toast({ title: "Treinamento registrado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/quality/training-matrix"] });
      setShowTrainingDialog(false);
      setEditingTraining(null);
    },
    onError: () => toast({ title: "Erro ao registrar treinamento", variant: "destructive" }),
  });

  const getStatusBadge = (status: string) => {
    const color = statusColors[status] || "bg-gray-500";
    const label = status.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
    return <Badge className={`${color} text-white`}>{label}</Badge>;
  };

  const filteredSamples = samples.filter(s => 
    s.sampleCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.collectionLocation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRnc = nonConformities.filter(r =>
    r.rncNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDocs = documents.filter(d =>
    d.documentCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <BrowserFrame>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Beaker className="h-6 w-6 text-green-600" />
              Gestão da Qualidade - ISO 17025
            </h1>
            <p className="text-muted-foreground">
              Controle de amostras, laudos, documentos e conformidade
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList className="h-12 flex-wrap">
            <TabsTrigger value="dashboard" className="gap-2" data-testid="tab-quality-dashboard">
              <ClipboardList className="h-4 w-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="samples" className="gap-2" data-testid="tab-samples">
              <FlaskConical className="h-4 w-4" /> Amostras
            </TabsTrigger>
            <TabsTrigger value="lab-reports" className="gap-2" data-testid="tab-lab-reports">
              <FileCheck className="h-4 w-4" /> Laudos
            </TabsTrigger>
            <TabsTrigger value="rnc" className="gap-2" data-testid="tab-rnc">
              <AlertTriangle className="h-4 w-4" /> RNC
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2" data-testid="tab-qms-docs">
              <FileText className="h-4 w-4" /> Documentos QMS
            </TabsTrigger>
            <TabsTrigger value="field-forms" className="gap-2" data-testid="tab-field-forms">
              <MapPin className="h-4 w-4" /> Formulários Campo
            </TabsTrigger>
            <TabsTrigger value="training" className="gap-2" data-testid="tab-training">
              <GraduationCap className="h-4 w-4" /> Treinamentos
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-2" data-testid="tab-homologation">
              <Building2 className="h-4 w-4" /> Homologação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {loadingDashboard ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Amostras</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">{dashboard?.samples?.total || 0}</div>
                    <p className="text-xs text-muted-foreground">Total cadastradas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">RNC Abertas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">{dashboard?.nonConformities?.open || 0}</div>
                    <p className="text-xs text-muted-foreground">Pendentes tratamento</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Documentos Vigentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{dashboard?.documents?.active || 0}</div>
                    <p className="text-xs text-muted-foreground">QMS ativos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Treinamentos Vencendo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">{dashboard?.trainings?.expiringSoon || 0}</div>
                    <p className="text-xs text-muted-foreground">Próximos 30 dias</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Despesas Pendentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-yellow-600">{dashboard?.expenses?.pending || 0}</div>
                    <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Últimas Amostras</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Local</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {samples.slice(0, 5).map((sample) => (
                        <TableRow key={sample.id}>
                          <TableCell className="font-medium">{sample.sampleCode}</TableCell>
                          <TableCell>{sample.sampleType}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{sample.collectionLocation}</TableCell>
                          <TableCell>{getStatusBadge(sample.status)}</TableCell>
                        </TableRow>
                      ))}
                      {samples.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Nenhuma amostra cadastrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">RNC Abertas</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Severidade</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nonConformities.filter(r => r.status === "aberta").slice(0, 5).map((rnc) => (
                        <TableRow key={rnc.id}>
                          <TableCell className="font-medium">{rnc.rncNumber}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{rnc.title}</TableCell>
                          <TableCell>
                            <Badge variant={rnc.severity === "critica" ? "destructive" : rnc.severity === "alta" ? "destructive" : "secondary"}>
                              {rnc.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(rnc.status)}</TableCell>
                        </TableRow>
                      ))}
                      {nonConformities.filter(r => r.status === "aberta").length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Nenhuma RNC aberta
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="samples" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar amostras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                  data-testid="search-samples"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchSamples()}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
                </Button>
                <Button onClick={() => { setEditingItem(null); setShowSampleDialog(true); }} data-testid="btn-new-sample">
                  <Plus className="h-4 w-4 mr-2" /> Nova Amostra
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data Coleta</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSamples.map((sample) => (
                      <TableRow key={sample.id}>
                        <TableCell className="font-medium">{sample.sampleCode}</TableCell>
                        <TableCell>{sample.sampleType}</TableCell>
                        <TableCell>{sample.collectionDate ? new Date(sample.collectionDate).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{sample.collectionLocation}</TableCell>
                        <TableCell>{sample.collectionResponsible}</TableCell>
                        <TableCell>{getStatusBadge(sample.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingItem(sample); setShowSampleDialog(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSamples.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhuma amostra encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lab-reports" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Laudos Laboratoriais</h2>
              <Button data-testid="btn-new-report">
                <Plus className="h-4 w-4 mr-2" /> Novo Laudo
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Amostra</TableHead>
                      <TableHead>Laboratório</TableHead>
                      <TableHead>Data Emissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.reportNumber}</TableCell>
                        <TableCell>#{report.sampleId}</TableCell>
                        <TableCell>Lab {report.laboratoryId}</TableCell>
                        <TableCell>{report.issueDate ? new Date(report.issueDate).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>{getStatusBadge(report.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {labReports.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum laudo cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rnc" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar RNC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
              <Button onClick={() => { setEditingItem(null); setShowRncDialog(true); }} data-testid="btn-new-rnc">
                <Plus className="h-4 w-4 mr-2" /> Nova RNC
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Detectado em</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRnc.map((rnc) => (
                      <TableRow key={rnc.id}>
                        <TableCell className="font-medium">{rnc.rncNumber}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{rnc.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rnc.type?.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rnc.severity === "critica" || rnc.severity === "alta" ? "destructive" : "secondary"}>
                            {rnc.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{rnc.detectedAt ? new Date(rnc.detectedAt).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>{getStatusBadge(rnc.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredRnc.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhuma não conformidade encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
              <Button onClick={() => { setEditingItem(null); setShowDocDialog(true); }} data-testid="btn-new-doc">
                <Plus className="h-4 w-4 mr-2" /> Novo Documento
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Documentos do Sistema de Gestão
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Versão</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDocs.map((doc) => (
                          <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-medium">{doc.documentCode}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{doc.title}</TableCell>
                            <TableCell>{doc.type}</TableCell>
                            <TableCell>{doc.version}</TableCell>
                            <TableCell>{getStatusBadge(doc.status)}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => { setSelectedDoc(doc); setShowDocViewDialog(true); }}
                                data-testid={`btn-read-doc-${doc.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => { setEditingItem(doc); setShowDocDialog(true); }}
                                data-testid={`btn-edit-doc-${doc.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  if (confirm("Tem certeza que deseja excluir este documento?")) {
                                    toast({ title: "Documento excluído", description: `${doc.documentCode} foi removido.` });
                                  }
                                }}
                                data-testid={`btn-delete-doc-${doc.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredDocs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Nenhum documento encontrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-blue-600" />
                      Caixa de Leitura
                    </CardTitle>
                    <CardDescription>Documentos para leitura obrigatória</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" data-testid="reading-doc-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">POP-001</span>
                        <Badge variant="outline" className="text-xs">Novo</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Procedimento de Amostragem de Água</p>
                    </div>
                    <div className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" data-testid="reading-doc-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">IT-015</span>
                        <Badge variant="outline" className="text-xs">Atualizado</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Instrução Técnica - Monitoramento</p>
                    </div>
                    <div className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" data-testid="reading-doc-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">FT-057</span>
                        <Badge variant="secondary" className="text-xs">Pendente</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Formulário de Treinamento</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Categorias de Documentos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer">
                      <span className="text-sm">Procedimentos (POP)</span>
                      <Badge variant="secondary">12</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer">
                      <span className="text-sm">Instruções Técnicas (IT)</span>
                      <Badge variant="secondary">8</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer">
                      <span className="text-sm">Formulários (FT)</span>
                      <Badge variant="secondary">25</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer">
                      <span className="text-sm">Manuais (MQ)</span>
                      <Badge variant="secondary">3</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer">
                      <span className="text-sm">Políticas (PL)</span>
                      <Badge variant="secondary">5</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="field-forms" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Formulários de Campo</h2>
              <Button data-testid="btn-new-field-form">
                <Plus className="h-4 w-4 mr-2" /> Novo Formulário
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Plano de Amostragem</CardTitle>
                  <CardDescription>PA - Planejamento de coleta de amostras</CardDescription>
                </CardHeader>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Plano de Trabalho (PT)</CardTitle>
                  <CardDescription>Orientações para equipe de campo</CardDescription>
                </CardHeader>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Monitoramento de Poços</CardTitle>
                  <CardDescription>Ficha de medição e coleta</CardDescription>
                </CardHeader>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Ficha de Campo</CardTitle>
                  <CardDescription>Registro geral de atividades</CardDescription>
                </CardHeader>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Checklist Equipamentos</CardTitle>
                  <CardDescription>Verificação de equipamentos</CardDescription>
                </CardHeader>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Relatório Fotográfico</CardTitle>
                  <CardDescription>Documentação visual de campo</CardDescription>
                </CardHeader>
              </Card>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fieldForms.map((form) => (
                      <TableRow key={form.id}>
                        <TableCell className="font-medium">{form.formCode}</TableCell>
                        <TableCell>{form.formType}</TableCell>
                        <TableCell>{form.title}</TableCell>
                        <TableCell>{form.collectionDate ? new Date(form.collectionDate).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{form.location}</TableCell>
                        <TableCell>{getStatusBadge(form.status)}</TableCell>
                      </TableRow>
                    ))}
                    {fieldForms.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum formulário de campo cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Matriz de Treinamentos (FT-57)</h2>
                <p className="text-sm text-muted-foreground">Controle de competência técnica conforme ISO 17025</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" data-testid="btn-training-calendar">
                  <Calendar className="h-4 w-4 mr-2" /> Agenda
                </Button>
                <Button onClick={() => { setEditingTraining(null); setShowTrainingDialog(true); }} data-testid="btn-new-training">
                  <Plus className="h-4 w-4 mr-2" /> Novo Treinamento
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">12</p>
                      <p className="text-xs text-muted-foreground">Colaboradores</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Award className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">45</p>
                      <p className="text-xs text-muted-foreground">Treinamentos Válidos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">8</p>
                      <p className="text-xs text-muted-foreground">Vencendo em 30 dias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">3</p>
                      <p className="text-xs text-muted-foreground">Vencidos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Registro de Treinamentos</CardTitle>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar colaborador ou treinamento..." className="w-64" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Treinamento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data Conclusão</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(trainings.length === 0 ? sampleTrainings : trainings).map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.employeeName || t.employeeId}</TableCell>
                          <TableCell>{t.trainingName}</TableCell>
                          <TableCell><Badge variant="outline">{t.trainingType}</Badge></TableCell>
                          <TableCell>{t.completedDate ? new Date(t.completedDate).toLocaleDateString("pt-BR") : "-"}</TableCell>
                          <TableCell>{t.expiryDate ? new Date(t.expiryDate).toLocaleDateString("pt-BR") : "-"}</TableCell>
                          <TableCell>
                            {t.status === "valid" && <Badge className="bg-green-500">Válido</Badge>}
                            {t.status === "expiring" && <Badge className="bg-yellow-500">Vencendo</Badge>}
                            {t.status === "expired" && <Badge className="bg-red-500">Vencido</Badge>}
                            {t.status === "scheduled" && <Badge className="bg-blue-500">Agendado</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => { setSelectedTraining(t); setShowTrainingViewDialog(true); }}
                              data-testid={`btn-view-training-${t.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => { setEditingTraining(t); setShowTrainingDialog(true); }}
                              data-testid={`btn-edit-training-${t.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                                      </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Fornecedores Homologados - ISO 17025</h2>
              <Button data-testid="btn-homologate">
                <Plus className="h-4 w-4 mr-2" /> Homologar Fornecedor
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Certificações</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {homologatedSuppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.code}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {s.certifications?.map((c, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${s.qualityScore >= 80 ? 'bg-green-500' : s.qualityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${s.qualityScore}%` }}
                              />
                            </div>
                            <span className="text-sm">{s.qualityScore}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{s.homologationExpiry ? new Date(s.homologationExpiry).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>{getStatusBadge(s.homologationStatus)}</TableCell>
                      </TableRow>
                    ))}
                    {homologatedSuppliers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum fornecedor homologado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showSampleDialog} onOpenChange={setShowSampleDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Amostra" : "Nova Amostra"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createSampleMutation.mutate({
                sampleCode: formData.get("sampleCode") as string,
                sampleType: formData.get("sampleType") as string,
                collectionLocation: formData.get("collectionLocation") as string,
                collectionResponsible: formData.get("collectionResponsible") as string,
                status: "coletada",
              });
            }}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sampleCode">Código da Amostra *</Label>
                    <Input id="sampleCode" name="sampleCode" placeholder="AM-2026-001" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sampleType">Tipo</Label>
                    <Select name="sampleType" defaultValue="agua">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agua">Água</SelectItem>
                        <SelectItem value="solo">Solo</SelectItem>
                        <SelectItem value="sedimento">Sedimento</SelectItem>
                        <SelectItem value="efluente">Efluente</SelectItem>
                        <SelectItem value="ar">Ar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collectionLocation">Local de Coleta</Label>
                  <Input id="collectionLocation" name="collectionLocation" placeholder="Ponto A1 - Poço PM-01" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collectionResponsible">Responsável pela Coleta</Label>
                  <Input id="collectionResponsible" name="collectionResponsible" placeholder="Nome do técnico" />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowSampleDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={createSampleMutation.isPending}>
                  {createSampleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showRncDialog} onOpenChange={setShowRncDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Não Conformidade</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createRncMutation.mutate({
                rncNumber: `RNC-${Date.now()}`,
                title: formData.get("title") as string,
                description: formData.get("description") as string,
                type: formData.get("type") as string,
                severity: formData.get("severity") as string,
                detectedBy: formData.get("detectedBy") as string,
                status: "aberta",
              });
            }}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input id="title" name="title" placeholder="Descrição resumida da NC" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo</Label>
                    <Select name="type" defaultValue="nao_conformidade">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao_conformidade">Não Conformidade</SelectItem>
                        <SelectItem value="acao_corretiva">Ação Corretiva</SelectItem>
                        <SelectItem value="oportunidade_melhoria">Oportunidade de Melhoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="severity">Severidade</Label>
                    <Select name="severity" defaultValue="media">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" name="description" placeholder="Descreva a não conformidade em detalhes..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="detectedBy">Detectado por</Label>
                  <Input id="detectedBy" name="detectedBy" placeholder="Nome de quem identificou" />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowRncDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={createRncMutation.isPending}>
                  {createRncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar RNC
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showDocDialog} onOpenChange={(open) => { setShowDocDialog(open); if (!open) { setEditingItem(null); setSelectedFile(null); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Documento" : "Novo Documento QMS"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              if (editingItem) {
                toast({ title: "Documento atualizado", description: `${formData.get("documentCode")} foi atualizado com sucesso.` });
              } else {
                createDocMutation.mutate({
                  documentCode: formData.get("documentCode") as string,
                  title: formData.get("title") as string,
                  type: formData.get("type") as string,
                  category: formData.get("category") as string,
                  version: "01",
                  status: "vigente",
                });
              }
              setShowDocDialog(false);
              setEditingItem(null);
            }}>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="documentCode">Código *</Label>
                    <Input 
                      id="documentCode" 
                      name="documentCode" 
                      placeholder="FT-01, PG-01, IT-01" 
                      defaultValue={editingItem?.documentCode || ""}
                      required 
                      data-testid="input-doc-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo</Label>
                    <Select name="type" defaultValue={editingItem?.type || "formulario"}>
                      <SelectTrigger data-testid="select-doc-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formulario">Formulário (FT)</SelectItem>
                        <SelectItem value="procedimento">Procedimento (POP)</SelectItem>
                        <SelectItem value="instrucao">Instrução Técnica (IT)</SelectItem>
                        <SelectItem value="manual">Manual (MQ)</SelectItem>
                        <SelectItem value="politica">Política (PL)</SelectItem>
                        <SelectItem value="registro">Registro (RG)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="version">Versão</Label>
                    <Input 
                      id="version" 
                      name="version" 
                      placeholder="01" 
                      defaultValue={editingItem?.version || "01"}
                      data-testid="input-doc-version"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input 
                    id="title" 
                    name="title" 
                    placeholder="Nome do documento" 
                    defaultValue={editingItem?.title || ""}
                    required 
                    data-testid="input-doc-title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select name="category" defaultValue={editingItem?.category || "qualidade"}>
                      <SelectTrigger data-testid="select-doc-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qualidade">Qualidade</SelectItem>
                        <SelectItem value="operacional">Operacional</SelectItem>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                        <SelectItem value="administrativo">Administrativo</SelectItem>
                        <SelectItem value="seguranca">Segurança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" defaultValue={editingItem?.status || "vigente"}>
                      <SelectTrigger data-testid="select-doc-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rascunho">Rascunho</SelectItem>
                        <SelectItem value="em_revisao">Em Revisão</SelectItem>
                        <SelectItem value="vigente">Vigente</SelectItem>
                        <SelectItem value="obsoleto">Obsoleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Anexar Arquivo</Label>
                  {selectedFile ? (
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{selectedFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(selectedFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => document.getElementById('doc-file-input')?.click()}
                    >
                      <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Arraste um arquivo ou clique para selecionar
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, DOC, DOCX, XLS, XLSX (máx. 10MB)
                      </p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="mt-3"
                        onClick={(e) => { e.stopPropagation(); document.getElementById('doc-file-input')?.click(); }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Selecionar Arquivo
                      </Button>
                    </div>
                  )}
                  <input 
                    id="doc-file-input"
                    type="file" 
                    className="hidden" 
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        toast({ title: "Arquivo selecionado", description: file.name });
                      }
                    }}
                    data-testid="input-doc-file"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observations">Observações</Label>
                  <Textarea 
                    id="observations" 
                    name="observations" 
                    placeholder="Observações sobre o documento..."
                    rows={3}
                    data-testid="input-doc-observations"
                  />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => { setShowDocDialog(false); setEditingItem(null); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createDocMutation.isPending} data-testid="btn-save-doc">
                  {createDocMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editingItem ? "Salvar Alterações" : "Criar Documento"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showDocViewDialog} onOpenChange={setShowDocViewDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {selectedDoc?.documentCode} - {selectedDoc?.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium">{selectedDoc?.type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Categoria:</span>
                  <p className="font-medium">{selectedDoc?.category}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Versão:</span>
                  <p className="font-medium">{selectedDoc?.version}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium">{selectedDoc?.status}</p>
                </div>
              </div>
              {viewingFileUrl ? (
                <div className="border rounded-lg overflow-hidden min-h-[500px]">
                  <iframe 
                    src={viewingFileUrl} 
                    className="w-full h-[500px]"
                    title="Visualizador de documento"
                  />
                </div>
              ) : (
                <div className="border rounded-lg p-8 min-h-[400px] bg-muted/30 flex flex-col items-center justify-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Visualizador de documento
                  </p>
                  <p className="text-sm text-muted-foreground text-center mt-1">
                    Selecione um documento da Caixa de Leitura ou anexe um arquivo para visualizar.
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => document.getElementById('view-file-input')?.click()}
                      data-testid="btn-open-local-doc"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Abrir Arquivo Local
                    </Button>
                  </div>
                  <input 
                    id="view-file-input"
                    type="file" 
                    className="hidden" 
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setViewingFileUrl(url);
                      }
                    }}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDocViewDialog(false); setViewingFileUrl(null); }}>
                Fechar
              </Button>
              <Button onClick={() => { setShowDocViewDialog(false); setEditingItem(selectedDoc); setShowDocDialog(true); }} data-testid="btn-edit-from-view">
                <Edit className="h-4 w-4 mr-2" />
                Editar Documento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showTrainingDialog} onOpenChange={(open) => { setShowTrainingDialog(open); if (!open) setEditingTraining(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                {editingTraining ? "Editar Treinamento" : "Novo Treinamento"}
              </DialogTitle>
              <DialogDescription>
                Registre treinamentos e competências dos colaboradores conforme FT-57
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const completedDate = formData.get("completedDate") as string | null;
              const expiryDate = formData.get("expiryDate") as string | null;
              const workload = formData.get("workload") as string | null;
              createTrainingMutation.mutate({
                employeeId:   formData.get("employee") as string,
                trainingName: formData.get("trainingName") as string,
                trainingType: formData.get("trainingType") as string,
                provider:     formData.get("instructor") as string || undefined,
                hours:        workload ? Number(workload) : undefined,
                completedDate: completedDate || undefined,
                expiryDate:    expiryDate || undefined,
                status:       formData.get("status") as string || "pendente",
              });
            }}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee">Colaborador *</Label>
                    <Select name="employee" defaultValue={editingTraining?.employeeId}>
                      <SelectTrigger data-testid="select-training-employee">
                        <SelectValue placeholder="Selecionar colaborador" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="emp-001">João Silva - Técnico Ambiental</SelectItem>
                        <SelectItem value="emp-002">Maria Santos - Eng. Ambiental</SelectItem>
                        <SelectItem value="emp-003">Carlos Oliveira - Operador Sonda</SelectItem>
                        <SelectItem value="emp-004">Ana Costa - Coord. Qualidade</SelectItem>
                        <SelectItem value="emp-005">Pedro Lima - Técnico Laboratório</SelectItem>
                        <SelectItem value="emp-006">Fernanda Souza - Geóloga</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Sincronizado com HRM</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trainingType">Tipo de Treinamento *</Label>
                    <Select name="trainingType" defaultValue={editingTraining?.trainingType}>
                      <SelectTrigger data-testid="select-training-type">
                        <SelectValue placeholder="Selecionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                        <SelectItem value="seguranca">Segurança</SelectItem>
                        <SelectItem value="qualidade">Qualidade</SelectItem>
                        <SelectItem value="normativo">Normativo</SelectItem>
                        <SelectItem value="operacional">Operacional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trainingName">Nome do Treinamento *</Label>
                  <Input 
                    id="trainingName" 
                    name="trainingName" 
                    defaultValue={editingTraining?.trainingName}
                    placeholder="Ex: Amostragem de Água Subterrânea"
                    required
                    data-testid="input-training-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="completedDate">Data de Conclusão</Label>
                    <Input 
                      id="completedDate" 
                      name="completedDate" 
                      type="date"
                      defaultValue={editingTraining?.completedDate?.split('T')[0]}
                      data-testid="input-training-completed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Data de Validade</Label>
                    <Input 
                      id="expiryDate" 
                      name="expiryDate" 
                      type="date"
                      defaultValue={editingTraining?.expiryDate?.split('T')[0]}
                      data-testid="input-training-expiry"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">Data Agendada (Futuro)</Label>
                    <Input 
                      id="scheduledDate" 
                      name="scheduledDate" 
                      type="date"
                      data-testid="input-training-scheduled"
                    />
                    <p className="text-xs text-muted-foreground">Para treinamentos ainda não realizados</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instructor">Instrutor/Entidade</Label>
                    <Input 
                      id="instructor" 
                      name="instructor" 
                      placeholder="Nome do instrutor ou entidade"
                      data-testid="input-training-instructor"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="workload">Carga Horária (h)</Label>
                    <Input 
                      id="workload" 
                      name="workload" 
                      type="number"
                      placeholder="8"
                      data-testid="input-training-workload"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" defaultValue={editingTraining?.status || "scheduled"}>
                      <SelectTrigger data-testid="select-training-status">
                        <SelectValue placeholder="Selecionar status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Agendado</SelectItem>
                        <SelectItem value="valid">Válido</SelectItem>
                        <SelectItem value="expiring">Vencendo</SelectItem>
                        <SelectItem value="expired">Vencido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Certificado/Evidência</Label>
                  <div 
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => document.getElementById('training-file-input')?.click()}
                  >
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para anexar certificado</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG (máx. 5MB)</p>
                  </div>
                  <input 
                    id="training-file-input"
                    type="file" 
                    className="hidden" 
                    accept=".pdf,.jpg,.jpeg,.png"
                    data-testid="input-training-file"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observations">Observações</Label>
                  <Textarea 
                    id="observations" 
                    name="observations" 
                    placeholder="Observações adicionais sobre o treinamento..."
                    rows={2}
                    data-testid="input-training-observations"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowTrainingDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createTrainingMutation.isPending} data-testid="btn-save-training">
                  {createTrainingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editingTraining ? "Salvar Alterações" : "Registrar Treinamento"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showTrainingViewDialog} onOpenChange={setShowTrainingViewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Detalhes do Treinamento
              </DialogTitle>
            </DialogHeader>
            {selectedTraining && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Colaborador</span>
                    <p className="font-medium">{selectedTraining.employeeName || selectedTraining.employeeId}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Tipo</span>
                    <p className="font-medium">{selectedTraining.trainingType}</p>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Treinamento</span>
                  <p className="font-medium text-lg">{selectedTraining.trainingName}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Data Conclusão</span>
                    <p className="font-medium">{selectedTraining.completedDate ? new Date(selectedTraining.completedDate).toLocaleDateString("pt-BR") : "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Validade</span>
                    <p className="font-medium">{selectedTraining.expiryDate ? new Date(selectedTraining.expiryDate).toLocaleDateString("pt-BR") : "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Status</span>
                    <div className="mt-1">
                      {selectedTraining.status === "valid" && <Badge className="bg-green-500">Válido</Badge>}
                      {selectedTraining.status === "expiring" && <Badge className="bg-yellow-500">Vencendo</Badge>}
                      {selectedTraining.status === "expired" && <Badge className="bg-red-500">Vencido</Badge>}
                      {selectedTraining.status === "scheduled" && <Badge className="bg-blue-500">Agendado</Badge>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Instrutor/Entidade</span>
                    <p className="font-medium">{selectedTraining.instructor || "-"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Carga Horária</span>
                    <p className="font-medium">{selectedTraining.workload ? `${selectedTraining.workload}h` : "-"}</p>
                  </div>
                </div>
                <div className="border-t pt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowTrainingViewDialog(false)}>
                    Fechar
                  </Button>
                  <Button onClick={() => { setShowTrainingViewDialog(false); setEditingTraining(selectedTraining); setShowTrainingDialog(true); }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </BrowserFrame>
  );
}
