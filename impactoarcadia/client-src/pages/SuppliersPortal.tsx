import { useState } from "react";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  Building2, FileText, Plus, Edit, Eye, RefreshCw, CheckCircle, XCircle,
  AlertTriangle, Calendar, Clock, Star, Award, Shield, BarChart3, Upload
} from "lucide-react";

type TabType = "dashboard" | "suppliers" | "homologation" | "documents" | "alerts";

interface Supplier {
  id: number;
  code: string;
  name: string;
  cnpj: string;
  category: string;
  segment: string;
  homologationStatus: string;
  homologationDate?: string;
  homologationExpiry?: string;
  qualityScore: number;
  certifications: string[];
  lastAuditDate?: string;
  nextAuditDate?: string;
  blockedForPurchase: boolean;
  blockReason?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface HomologationProcess {
  id: number;
  supplierId: number;
  supplierName: string;
  requestDate: string;
  status: string;
  stage: string;
  progress: number;
  responsible: string;
  notes?: string;
}

interface SupplierDocument {
  id: number;
  supplierId: number;
  supplierName: string;
  documentType: string;
  fileName: string;
  uploadDate: string;
  expiryDate?: string;
  status: string;
}

interface SupplierAlert {
  id: number;
  type: string;
  severity: string;
  supplierId: number;
  supplierName: string;
  message: string;
  createdAt: string;
  resolved: boolean;
}

const mockSuppliers: Supplier[] = [
  { id: 1, code: "FOR-001", name: "Laboratório Análises Ambientais Ltda", cnpj: "12.345.678/0001-90", category: "Laboratório", segment: "Análises Químicas", homologationStatus: "approved", homologationDate: "2024-06-15", homologationExpiry: "2026-06-15", qualityScore: 95, certifications: ["ISO 17025", "INMETRO"], lastAuditDate: "2025-06-01", nextAuditDate: "2026-06-01", blockedForPurchase: false, contactName: "Ana Costa", contactEmail: "ana@labambiental.com.br", contactPhone: "(11) 3456-7890" },
  { id: 2, code: "FOR-002", name: "Sondagem Brasil S.A.", cnpj: "98.765.432/0001-10", category: "Sondagem", segment: "Perfuração", homologationStatus: "approved", homologationDate: "2024-03-20", homologationExpiry: "2026-03-20", qualityScore: 88, certifications: ["ISO 9001"], lastAuditDate: "2025-03-15", nextAuditDate: "2026-03-15", blockedForPurchase: false, contactName: "Carlos Mendes", contactEmail: "carlos@sondagembrasil.com", contactPhone: "(11) 2345-6789" },
  { id: 3, code: "FOR-003", name: "Transporte Ambiental Express", cnpj: "11.222.333/0001-44", category: "Transporte", segment: "Logística", homologationStatus: "pending", qualityScore: 0, certifications: [], blockedForPurchase: true, blockReason: "Aguardando homologação", contactName: "Maria Oliveira", contactEmail: "maria@transporte.com", contactPhone: "(11) 9876-5432" },
  { id: 4, code: "FOR-004", name: "Equipamentos de Campo Ltda", cnpj: "55.666.777/0001-88", category: "Equipamentos", segment: "Locação", homologationStatus: "expired", homologationDate: "2022-01-10", homologationExpiry: "2024-01-10", qualityScore: 72, certifications: ["ISO 9001"], lastAuditDate: "2023-12-01", blockedForPurchase: true, blockReason: "Homologação vencida", contactName: "Pedro Santos", contactEmail: "pedro@equipcampo.com", contactPhone: "(11) 8765-4321" },
  { id: 5, code: "FOR-005", name: "Consultoria Geo-Ambiental", cnpj: "33.444.555/0001-22", category: "Consultoria", segment: "Assessoria Técnica", homologationStatus: "approved", homologationDate: "2025-01-05", homologationExpiry: "2027-01-05", qualityScore: 92, certifications: ["ISO 9001", "ISO 14001"], lastAuditDate: "2025-01-02", nextAuditDate: "2026-01-02", blockedForPurchase: false, contactName: "Julia Fernandes", contactEmail: "julia@geoconsult.com", contactPhone: "(11) 7654-3210" },
];

const mockHomologations: HomologationProcess[] = [
  { id: 1, supplierId: 3, supplierName: "Transporte Ambiental Express", requestDate: "2025-12-01", status: "em_andamento", stage: "Análise Documental", progress: 40, responsible: "João Silva", notes: "Aguardando documentos de segurança" },
  { id: 2, supplierId: 4, supplierName: "Equipamentos de Campo Ltda", requestDate: "2025-12-15", status: "em_andamento", stage: "Auditoria", progress: 70, responsible: "Maria Santos" },
];

const mockDocuments: SupplierDocument[] = [
  { id: 1, supplierId: 1, supplierName: "Laboratório Análises Ambientais Ltda", documentType: "Certificado ISO 17025", fileName: "iso17025_lab.pdf", uploadDate: "2024-06-10", expiryDate: "2026-06-10", status: "válido" },
  { id: 2, supplierId: 1, supplierName: "Laboratório Análises Ambientais Ltda", documentType: "Acreditação INMETRO", fileName: "inmetro_lab.pdf", uploadDate: "2024-06-10", expiryDate: "2026-06-10", status: "válido" },
  { id: 3, supplierId: 2, supplierName: "Sondagem Brasil S.A.", documentType: "Certificado ISO 9001", fileName: "iso9001_sondagem.pdf", uploadDate: "2024-03-15", expiryDate: "2026-03-15", status: "válido" },
  { id: 4, supplierId: 4, supplierName: "Equipamentos de Campo Ltda", documentType: "Certificado ISO 9001", fileName: "iso9001_equip.pdf", uploadDate: "2022-01-05", expiryDate: "2024-01-05", status: "vencido" },
  { id: 5, supplierId: 5, supplierName: "Consultoria Geo-Ambiental", documentType: "Contrato de Prestação de Serviços", fileName: "contrato_consultoria.pdf", uploadDate: "2025-01-02", status: "válido" },
];

const mockAlerts: SupplierAlert[] = [
  { id: 1, type: "homologation_expiry", severity: "high", supplierId: 4, supplierName: "Equipamentos de Campo Ltda", message: "Homologação vencida há mais de 365 dias", createdAt: "2025-01-15", resolved: false },
  { id: 2, type: "audit_pending", severity: "medium", supplierId: 2, supplierName: "Sondagem Brasil S.A.", message: "Auditoria programada para 15/03/2026", createdAt: "2026-01-10", resolved: false },
  { id: 3, type: "document_expiry", severity: "medium", supplierId: 4, supplierName: "Equipamentos de Campo Ltda", message: "Certificado ISO 9001 vencido", createdAt: "2024-01-10", resolved: false },
  { id: 4, type: "quality_score", severity: "low", supplierId: 4, supplierName: "Equipamentos de Campo Ltda", message: "Score de qualidade abaixo de 75 pontos", createdAt: "2025-06-01", resolved: false },
];

export default function SuppliersPortal() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showHomologationDialog, setShowHomologationDialog] = useState(false);
  const { toast } = useToast();

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      approved: "bg-green-500",
      pending: "bg-yellow-500",
      expired: "bg-red-500",
      blocked: "bg-gray-500",
      em_andamento: "bg-blue-500",
      válido: "bg-green-500",
      vencido: "bg-red-500",
    };
    const labels: Record<string, string> = {
      approved: "Aprovado",
      pending: "Pendente",
      expired: "Vencido",
      blocked: "Bloqueado",
      em_andamento: "Em Andamento",
      válido: "Válido",
      vencido: "Vencido",
    };
    return (
      <Badge className={`${colors[status] || "bg-gray-500"} text-white`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      high: "bg-red-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
    };
    const labels: Record<string, string> = {
      high: "Alta",
      medium: "Média",
      low: "Baixa",
    };
    return (
      <Badge className={`${colors[severity] || "bg-gray-500"} text-white`}>
        {labels[severity] || severity}
      </Badge>
    );
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-yellow-600";
    if (score > 0) return "text-red-600";
    return "text-gray-400";
  };

  const approvedSuppliers = mockSuppliers.filter(s => s.homologationStatus === "approved").length;
  const pendingSuppliers = mockSuppliers.filter(s => s.homologationStatus === "pending").length;
  const expiredSuppliers = mockSuppliers.filter(s => s.homologationStatus === "expired").length;
  const unresolvedAlerts = mockAlerts.filter(a => !a.resolved).length;

  return (
    <BrowserFrame>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-indigo-600" />
              Portal de Fornecedores
            </h1>
            <p className="text-muted-foreground">Homologação, documentos e gestão de qualidade ISO 17025</p>
          </div>
          <Button variant="outline" data-testid="btn-refresh-suppliers">
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard"><BarChart3 className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
            <TabsTrigger value="suppliers" data-testid="tab-suppliers"><Building2 className="h-4 w-4 mr-1" /> Fornecedores</TabsTrigger>
            <TabsTrigger value="homologation" data-testid="tab-homologation"><Award className="h-4 w-4 mr-1" /> Homologação</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents"><FileText className="h-4 w-4 mr-1" /> Documentos</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts"><AlertTriangle className="h-4 w-4 mr-1" /> Alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="kpi-approved-suppliers">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Homologados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{approvedSuppliers}</div>
                  <p className="text-xs text-muted-foreground">fornecedores ativos</p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-pending-suppliers">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    Pendentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{pendingSuppliers}</div>
                  <p className="text-xs text-muted-foreground">em homologação</p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-expired-suppliers">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Vencidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{expiredSuppliers}</div>
                  <p className="text-xs text-muted-foreground">requer renovação</p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-alerts">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Alertas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{unresolvedAlerts}</div>
                  <p className="text-xs text-muted-foreground">não resolvidos</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Processos de Homologação</CardTitle>
                  <CardDescription>Homologações em andamento</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockHomologations.map(h => (
                      <div key={h.id} className="border rounded-lg p-3" data-testid={`homologation-progress-${h.id}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">{h.supplierName}</p>
                          {getStatusBadge(h.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">Etapa: {h.stage}</p>
                        <Progress value={h.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">{h.progress}% concluído</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ranking de Qualidade</CardTitle>
                  <CardDescription>Top fornecedores por score</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockSuppliers
                      .filter(s => s.qualityScore > 0)
                      .sort((a, b) => b.qualityScore - a.qualityScore)
                      .slice(0, 5)
                      .map((supplier, index) => (
                      <div key={supplier.id} className="flex items-center justify-between border-b pb-2" data-testid={`quality-rank-${supplier.id}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground">{index + 1}°</span>
                          <div>
                            <p className="font-medium">{supplier.name}</p>
                            <p className="text-sm text-muted-foreground">{supplier.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className={`h-4 w-4 ${getQualityScoreColor(supplier.qualityScore)}`} />
                          <span className={`text-lg font-bold ${getQualityScoreColor(supplier.qualityScore)}`}>
                            {supplier.qualityScore}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cadastro de Fornecedores</h2>
              <Button onClick={() => setShowSupplierDialog(true)} data-testid="btn-new-supplier">
                <Plus className="h-4 w-4 mr-2" /> Novo Fornecedor
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Certificações</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockSuppliers.map((supplier) => (
                      <TableRow key={supplier.id} data-testid={`supplier-row-${supplier.id}`}>
                        <TableCell className="font-medium">{supplier.code}</TableCell>
                        <TableCell>{supplier.name}</TableCell>
                        <TableCell>{supplier.cnpj}</TableCell>
                        <TableCell><Badge variant="outline">{supplier.category}</Badge></TableCell>
                        <TableCell>{getStatusBadge(supplier.homologationStatus)}</TableCell>
                        <TableCell>
                          <span className={`font-bold ${getQualityScoreColor(supplier.qualityScore)}`}>
                            {supplier.qualityScore > 0 ? supplier.qualityScore : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {supplier.certifications.slice(0, 2).map((cert, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{cert}</Badge>
                            ))}
                            {supplier.certifications.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{supplier.certifications.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" data-testid={`btn-view-supplier-${supplier.id}`}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-edit-supplier-${supplier.id}`}><Edit className="h-4 w-4" /></Button>
                            {supplier.homologationStatus !== "approved" && (
                              <Button variant="ghost" size="icon" data-testid={`btn-homologate-supplier-${supplier.id}`}><Award className="h-4 w-4" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="homologation" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Processos de Homologação</h2>
              <Button onClick={() => setShowHomologationDialog(true)} data-testid="btn-new-homologation">
                <Plus className="h-4 w-4 mr-2" /> Iniciar Homologação
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {mockHomologations.map((homologation) => (
                <Card key={homologation.id} data-testid={`homologation-card-${homologation.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{homologation.supplierName}</CardTitle>
                        <CardDescription>Solicitado em {new Date(homologation.requestDate).toLocaleDateString("pt-BR")}</CardDescription>
                      </div>
                      {getStatusBadge(homologation.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Etapa Atual</p>
                          <p className="font-medium">{homologation.stage}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                          <p className="font-medium">{homologation.responsible}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Progresso</p>
                          <div className="flex items-center gap-2">
                            <Progress value={homologation.progress} className="flex-1 h-2" />
                            <span className="text-sm font-medium">{homologation.progress}%</span>
                          </div>
                        </div>
                      </div>
                      {homologation.notes && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Observações</p>
                          <p className="text-sm">{homologation.notes}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid={`btn-edit-homologation-${homologation.id}`}><Edit className="h-3 w-3 mr-1" /> Editar</Button>
                        <Button size="sm" data-testid={`btn-advance-homologation-${homologation.id}`}><CheckCircle className="h-3 w-3 mr-1" /> Avançar Etapa</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Documentos de Fornecedores</h2>
              <Button data-testid="btn-upload-document">
                <Upload className="h-4 w-4 mr-2" /> Upload Documento
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Tipo de Documento</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Upload</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockDocuments.map((doc) => (
                      <TableRow key={doc.id} data-testid={`document-row-${doc.id}`}>
                        <TableCell className="font-medium">{doc.supplierName}</TableCell>
                        <TableCell>{doc.documentType}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {doc.fileName}
                          </div>
                        </TableCell>
                        <TableCell>{new Date(doc.uploadDate).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>{getStatusBadge(doc.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" data-testid={`btn-view-document-${doc.id}`}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-edit-document-${doc.id}`}><Edit className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Alertas e Notificações</h2>
              <Badge variant="outline">{unresolvedAlerts} não resolvidos</Badge>
            </div>

            <div className="space-y-3">
              {mockAlerts.map((alert) => (
                <Card key={alert.id} className={alert.severity === "high" ? "border-red-200 bg-red-50" : alert.severity === "medium" ? "border-yellow-200 bg-yellow-50" : ""} data-testid={`alert-card-${alert.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`h-5 w-5 mt-0.5 ${alert.severity === "high" ? "text-red-500" : alert.severity === "medium" ? "text-yellow-500" : "text-blue-500"}`} />
                        <div>
                          <p className="font-medium">{alert.message}</p>
                          <p className="text-sm text-muted-foreground mt-1">Fornecedor: {alert.supplierName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Criado em {new Date(alert.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(alert.severity)}
                        {!alert.resolved && (
                          <Button size="sm" variant="outline" data-testid={`btn-resolve-alert-${alert.id}`}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Resolver
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Fornecedor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplierName">Razão Social *</Label>
                  <Input id="supplierName" placeholder="Nome do fornecedor" data-testid="input-supplier-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplierCnpj">CNPJ *</Label>
                  <Input id="supplierCnpj" placeholder="00.000.000/0001-00" data-testid="input-supplier-cnpj" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplierCategory">Categoria</Label>
                  <Select>
                    <SelectTrigger data-testid="select-supplier-category"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Laboratório">Laboratório</SelectItem>
                      <SelectItem value="Sondagem">Sondagem</SelectItem>
                      <SelectItem value="Transporte">Transporte</SelectItem>
                      <SelectItem value="Equipamentos">Equipamentos</SelectItem>
                      <SelectItem value="Consultoria">Consultoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplierSegment">Segmento</Label>
                  <Input id="supplierSegment" placeholder="Ex: Análises Químicas" data-testid="input-supplier-segment" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName">Nome do Contato</Label>
                <Input id="contactName" placeholder="Nome do contato principal" data-testid="input-contact-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">E-mail</Label>
                  <Input id="contactEmail" type="email" placeholder="email@fornecedor.com" data-testid="input-contact-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Telefone</Label>
                  <Input id="contactPhone" placeholder="(11) 0000-0000" data-testid="input-contact-phone" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSupplierDialog(false)} data-testid="btn-cancel-supplier">Cancelar</Button>
              <Button onClick={() => { setShowSupplierDialog(false); toast({ title: "Fornecedor cadastrado", description: "O fornecedor foi adicionado e aguarda homologação." }); }} data-testid="btn-save-supplier">Cadastrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showHomologationDialog} onOpenChange={setShowHomologationDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Iniciar Processo de Homologação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="homologationSupplier">Fornecedor</Label>
                <Select>
                  <SelectTrigger data-testid="select-homologation-supplier"><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger>
                  <SelectContent>
                    {mockSuppliers.filter(s => s.homologationStatus !== "approved").map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="homologationResponsible">Responsável</Label>
                <Input id="homologationResponsible" placeholder="Nome do responsável" data-testid="input-homologation-responsible" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homologationNotes">Observações</Label>
                <Textarea id="homologationNotes" placeholder="Requisitos especiais, documentos necessários..." data-testid="input-homologation-notes" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHomologationDialog(false)} data-testid="btn-cancel-homologation">Cancelar</Button>
              <Button onClick={() => { setShowHomologationDialog(false); toast({ title: "Homologação iniciada", description: "O processo de homologação foi iniciado com sucesso." }); }} data-testid="btn-start-homologation">Iniciar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </BrowserFrame>
  );
}
