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
import {
  Droplets, MapPin, FileText, Plus, Edit, Eye, RefreshCw, CheckCircle,
  AlertTriangle, Calendar, Beaker, Target, Ruler, Activity, BarChart3
} from "lucide-react";

type TabType = "dashboard" | "wells" | "sampling-plans" | "methods" | "equipment";

interface Well {
  id: number;
  code: string;
  type: string;
  depth: number;
  diameter: number;
  coordinates: { lat: number; lng: number };
  installedDate: string;
  status: string;
  projectName: string;
  lastSampling?: string;
  nextSampling?: string;
}

interface SamplingPlan {
  id: number;
  code: string;
  projectName: string;
  wells: string[];
  parameters: string[];
  frequency: string;
  startDate: string;
  endDate?: string;
  status: string;
  responsible: string;
}

interface AnalyticalMethod {
  id: number;
  code: string;
  name: string;
  parameter: string;
  technique: string;
  lod: string;
  loq: string;
  unit: string;
  accredited: boolean;
}

interface FieldEquipment {
  id: number;
  code: string;
  name: string;
  type: string;
  serialNumber: string;
  calibrationDate: string;
  nextCalibration: string;
  status: string;
  location: string;
}

const mockWells: Well[] = [
  { id: 1, code: "PM-01", type: "Monitoramento", depth: 15, diameter: 50, coordinates: { lat: -23.5505, lng: -46.6333 }, installedDate: "2024-03-15", status: "ativo", projectName: "Área Industrial ABC", lastSampling: "2025-12-01", nextSampling: "2026-03-01" },
  { id: 2, code: "PM-02", type: "Monitoramento", depth: 12, diameter: 50, coordinates: { lat: -23.5510, lng: -46.6340 }, installedDate: "2024-03-16", status: "ativo", projectName: "Área Industrial ABC", lastSampling: "2025-12-01", nextSampling: "2026-03-01" },
  { id: 3, code: "PM-03", type: "Monitoramento", depth: 18, diameter: 50, coordinates: { lat: -23.5515, lng: -46.6335 }, installedDate: "2024-03-17", status: "inativo", projectName: "Área Industrial ABC" },
  { id: 4, code: "PP-01", type: "Piezômetro", depth: 8, diameter: 32, coordinates: { lat: -23.5520, lng: -46.6338 }, installedDate: "2024-05-20", status: "ativo", projectName: "Posto Combustíveis XYZ", lastSampling: "2025-11-15", nextSampling: "2026-02-15" },
  { id: 5, code: "PB-01", type: "Bombeamento", depth: 25, diameter: 100, coordinates: { lat: -23.5525, lng: -46.6345 }, installedDate: "2024-07-10", status: "em_remediacao", projectName: "Remediação Área Contaminada" },
];

const mockSamplingPlans: SamplingPlan[] = [
  { id: 1, code: "PA-2025-001", projectName: "Área Industrial ABC", wells: ["PM-01", "PM-02", "PM-03"], parameters: ["BTEX", "PAH", "Metais", "VOC"], frequency: "Trimestral", startDate: "2025-01-01", status: "ativo", responsible: "João Silva" },
  { id: 2, code: "PA-2025-002", projectName: "Posto Combustíveis XYZ", wells: ["PP-01"], parameters: ["BTEX", "PAH", "TPH"], frequency: "Semestral", startDate: "2025-06-01", status: "ativo", responsible: "Maria Santos" },
  { id: 3, code: "PA-2025-003", projectName: "Remediação Área Contaminada", wells: ["PB-01"], parameters: ["BTEX", "Ferro Total", "Sulfato", "COD", "OD"], frequency: "Mensal", startDate: "2025-03-01", endDate: "2026-03-01", status: "ativo", responsible: "Carlos Oliveira" },
];

const mockMethods: AnalyticalMethod[] = [
  { id: 1, code: "EPA 8260C", name: "VOCs por GC-MS", parameter: "VOC", technique: "GC-MS Purge & Trap", lod: "0.5", loq: "1.0", unit: "µg/L", accredited: true },
  { id: 2, code: "EPA 8270D", name: "SVOCs por GC-MS", parameter: "PAH", technique: "GC-MS", lod: "1.0", loq: "2.0", unit: "µg/L", accredited: true },
  { id: 3, code: "EPA 8015D", name: "TPH por GC-FID", parameter: "TPH", technique: "GC-FID", lod: "10", loq: "50", unit: "µg/L", accredited: true },
  { id: 4, code: "EPA 6010D", name: "Metais por ICP-OES", parameter: "Metais", technique: "ICP-OES", lod: "0.1", loq: "0.5", unit: "mg/L", accredited: true },
  { id: 5, code: "SMEWW 5530C", name: "BTEX por GC-FID", parameter: "BTEX", technique: "GC-FID Headspace", lod: "0.5", loq: "1.0", unit: "µg/L", accredited: true },
];

const mockEquipment: FieldEquipment[] = [
  { id: 1, code: "EQ-001", name: "Medidor Multiparâmetro Hanna HI98194", type: "Multiparâmetro", serialNumber: "HI-2024-0142", calibrationDate: "2025-12-01", nextCalibration: "2026-03-01", status: "calibrado", location: "Escritório" },
  { id: 2, code: "EQ-002", name: "Bomba Bailer SS", type: "Amostragem", serialNumber: "BL-2023-0089", calibrationDate: "2025-11-15", nextCalibration: "2026-02-15", status: "calibrado", location: "Campo - Área ABC" },
  { id: 3, code: "EQ-003", name: "Medidor de Nível Elétrico", type: "Nível", serialNumber: "NE-2024-0056", calibrationDate: "2025-10-20", nextCalibration: "2026-01-20", status: "vencido", location: "Escritório" },
  { id: 4, code: "EQ-004", name: "GPS Garmin GPSMAP 66i", type: "Posicionamento", serialNumber: "GP-2024-0023", calibrationDate: "2025-09-01", nextCalibration: "2026-09-01", status: "calibrado", location: "Campo - Posto XYZ" },
  { id: 5, code: "EQ-005", name: "Bomba Peristáltica Geotech", type: "Purga/Amostragem", serialNumber: "PP-2023-0178", calibrationDate: "2025-08-15", nextCalibration: "2026-02-15", status: "calibrado", location: "Manutenção" },
];

export default function TechnicalModule() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [showWellDialog, setShowWellDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const { toast } = useToast();

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ativo: "bg-green-500",
      inativo: "bg-gray-500",
      em_remediacao: "bg-orange-500",
      calibrado: "bg-green-500",
      vencido: "bg-red-500",
      pendente: "bg-yellow-500",
    };
    const labels: Record<string, string> = {
      ativo: "Ativo",
      inativo: "Inativo",
      em_remediacao: "Em Remediação",
      calibrado: "Calibrado",
      vencido: "Vencido",
      pendente: "Pendente",
    };
    return (
      <Badge className={`${colors[status] || "bg-gray-500"} text-white`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const activeWells = mockWells.filter(w => w.status === "ativo").length;
  const activePlans = mockSamplingPlans.filter(p => p.status === "ativo").length;
  const calibratedEquipment = mockEquipment.filter(e => e.status === "calibrado").length;
  const overdueCalibrations = mockEquipment.filter(e => e.status === "vencido").length;

  return (
    <BrowserFrame>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Beaker className="h-6 w-6 text-teal-600" />
              Módulo Técnico
            </h1>
            <p className="text-muted-foreground">Gestão de poços, planos de amostragem e métodos analíticos</p>
          </div>
          <Button variant="outline" data-testid="btn-refresh-technical">
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard"><BarChart3 className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
            <TabsTrigger value="wells" data-testid="tab-wells"><Droplets className="h-4 w-4 mr-1" /> Poços</TabsTrigger>
            <TabsTrigger value="sampling-plans" data-testid="tab-sampling-plans"><FileText className="h-4 w-4 mr-1" /> Planos</TabsTrigger>
            <TabsTrigger value="methods" data-testid="tab-methods"><Target className="h-4 w-4 mr-1" /> Métodos</TabsTrigger>
            <TabsTrigger value="equipment" data-testid="tab-equipment"><Ruler className="h-4 w-4 mr-1" /> Equipamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="kpi-active-wells">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    Poços Ativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeWells}</div>
                  <p className="text-xs text-muted-foreground">de {mockWells.length} cadastrados</p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-active-plans">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-500" />
                    Planos Ativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activePlans}</div>
                  <p className="text-xs text-muted-foreground">planos de amostragem</p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-calibrated-equipment">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Equipamentos OK
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{calibratedEquipment}</div>
                  <p className="text-xs text-muted-foreground">calibrações em dia</p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-overdue-calibrations">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Calibração Vencida
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{overdueCalibrations}</div>
                  <p className="text-xs text-muted-foreground">requer atenção</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Próximas Amostragens</CardTitle>
                  <CardDescription>Campanhas agendadas para os próximos 30 dias</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockWells.filter(w => w.nextSampling).slice(0, 5).map(well => (
                      <div key={well.id} className="flex items-center justify-between border-b pb-2" data-testid={`next-sampling-${well.id}`}>
                        <div>
                          <p className="font-medium">{well.code}</p>
                          <p className="text-sm text-muted-foreground">{well.projectName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{well.nextSampling ? new Date(well.nextSampling).toLocaleDateString("pt-BR") : "-"}</p>
                          <p className="text-xs text-muted-foreground">{well.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Alertas de Equipamentos</CardTitle>
                  <CardDescription>Calibrações vencidas ou próximas do vencimento</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockEquipment.filter(e => e.status === "vencido" || new Date(e.nextCalibration) < new Date(Date.now() + 30*24*60*60*1000)).map(eq => (
                      <div key={eq.id} className="flex items-center justify-between border-b pb-2" data-testid={`equipment-alert-${eq.id}`}>
                        <div>
                          <p className="font-medium">{eq.name}</p>
                          <p className="text-sm text-muted-foreground">{eq.code}</p>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(eq.status)}
                          <p className="text-xs text-muted-foreground mt-1">Vence: {new Date(eq.nextCalibration).toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="wells" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cadastro de Poços</h2>
              <Button onClick={() => setShowWellDialog(true)} data-testid="btn-new-well">
                <Plus className="h-4 w-4 mr-2" /> Novo Poço
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Profundidade</TableHead>
                      <TableHead>Diâmetro</TableHead>
                      <TableHead>Instalação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockWells.map((well) => (
                      <TableRow key={well.id} data-testid={`well-row-${well.id}`}>
                        <TableCell className="font-medium">{well.code}</TableCell>
                        <TableCell><Badge variant="outline">{well.type}</Badge></TableCell>
                        <TableCell>{well.projectName}</TableCell>
                        <TableCell>{well.depth}m</TableCell>
                        <TableCell>{well.diameter}mm</TableCell>
                        <TableCell>{new Date(well.installedDate).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{getStatusBadge(well.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" data-testid={`btn-view-well-${well.id}`}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-edit-well-${well.id}`}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-map-well-${well.id}`}><MapPin className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sampling-plans" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Planos de Amostragem</h2>
              <Button onClick={() => setShowPlanDialog(true)} data-testid="btn-new-sampling-plan">
                <Plus className="h-4 w-4 mr-2" /> Novo Plano
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {mockSamplingPlans.map((plan) => (
                <Card key={plan.id} data-testid={`sampling-plan-${plan.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{plan.code}</CardTitle>
                        <CardDescription>{plan.projectName}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(plan.status)}
                        <Badge variant="outline">{plan.frequency}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Poços Monitorados</p>
                        <div className="flex flex-wrap gap-1">
                          {plan.wells.map((well, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{well}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Parâmetros Analíticos</p>
                        <div className="flex flex-wrap gap-1">
                          {plan.parameters.map((param, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{param}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                        <p className="text-sm font-medium">{plan.responsible}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Início: {new Date(plan.startDate).toLocaleDateString("pt-BR")}
                          {plan.endDate && ` | Fim: ${new Date(plan.endDate).toLocaleDateString("pt-BR")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm" data-testid={`btn-edit-plan-${plan.id}`}><Edit className="h-3 w-3 mr-1" /> Editar</Button>
                      <Button size="sm" data-testid={`btn-view-plan-${plan.id}`}><Eye className="h-3 w-3 mr-1" /> Ver Detalhes</Button>
                      <Button variant="secondary" size="sm" data-testid={`btn-schedule-plan-${plan.id}`}><Calendar className="h-3 w-3 mr-1" /> Agendar Campanha</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="methods" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Métodos Analíticos</h2>
              <Button data-testid="btn-new-method">
                <Plus className="h-4 w-4 mr-2" /> Novo Método
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Parâmetro</TableHead>
                      <TableHead>Técnica</TableHead>
                      <TableHead>LOD</TableHead>
                      <TableHead>LOQ</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Acreditado</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockMethods.map((method) => (
                      <TableRow key={method.id} data-testid={`method-row-${method.id}`}>
                        <TableCell className="font-medium">{method.code}</TableCell>
                        <TableCell>{method.name}</TableCell>
                        <TableCell><Badge variant="outline">{method.parameter}</Badge></TableCell>
                        <TableCell>{method.technique}</TableCell>
                        <TableCell>{method.lod}</TableCell>
                        <TableCell>{method.loq}</TableCell>
                        <TableCell>{method.unit}</TableCell>
                        <TableCell>
                          {method.accredited ? (
                            <Badge className="bg-green-500 text-white">ISO 17025</Badge>
                          ) : (
                            <Badge variant="outline">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" data-testid={`btn-view-method-${method.id}`}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-edit-method-${method.id}`}><Edit className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Equipamentos de Campo</h2>
              <Button data-testid="btn-new-equipment">
                <Plus className="h-4 w-4 mr-2" /> Novo Equipamento
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>N° Série</TableHead>
                      <TableHead>Última Calibração</TableHead>
                      <TableHead>Próxima Calibração</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockEquipment.map((eq) => (
                      <TableRow key={eq.id} data-testid={`equipment-row-${eq.id}`}>
                        <TableCell className="font-medium">{eq.code}</TableCell>
                        <TableCell>{eq.name}</TableCell>
                        <TableCell><Badge variant="outline">{eq.type}</Badge></TableCell>
                        <TableCell>{eq.serialNumber}</TableCell>
                        <TableCell>{new Date(eq.calibrationDate).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{new Date(eq.nextCalibration).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{eq.location}</TableCell>
                        <TableCell>{getStatusBadge(eq.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" data-testid={`btn-view-equipment-${eq.id}`}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-edit-equipment-${eq.id}`}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-calibrate-equipment-${eq.id}`}><Activity className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showWellDialog} onOpenChange={setShowWellDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Poço</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wellCode">Código do Poço *</Label>
                  <Input id="wellCode" placeholder="Ex: PM-04" data-testid="input-well-code" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wellType">Tipo</Label>
                  <Select>
                    <SelectTrigger data-testid="select-well-type"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monitoramento">Monitoramento</SelectItem>
                      <SelectItem value="Piezômetro">Piezômetro</SelectItem>
                      <SelectItem value="Bombeamento">Bombeamento</SelectItem>
                      <SelectItem value="Multinível">Multinível</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wellDepth">Profundidade (m)</Label>
                  <Input id="wellDepth" type="number" placeholder="15" data-testid="input-well-depth" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wellDiameter">Diâmetro (mm)</Label>
                  <Input id="wellDiameter" type="number" placeholder="50" data-testid="input-well-diameter" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wellProject">Projeto</Label>
                <Input id="wellProject" placeholder="Nome do projeto" data-testid="input-well-project" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wellLat">Latitude</Label>
                  <Input id="wellLat" placeholder="-23.5505" data-testid="input-well-lat" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wellLng">Longitude</Label>
                  <Input id="wellLng" placeholder="-46.6333" data-testid="input-well-lng" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wellDate">Data de Instalação</Label>
                <Input id="wellDate" type="date" data-testid="input-well-date" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWellDialog(false)} data-testid="btn-cancel-well">Cancelar</Button>
              <Button onClick={() => { setShowWellDialog(false); toast({ title: "Poço cadastrado", description: "O novo poço foi adicionado com sucesso." }); }} data-testid="btn-save-well">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Plano de Amostragem</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="planCode">Código do Plano *</Label>
                  <Input id="planCode" placeholder="PA-2026-001" data-testid="input-plan-code" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planFrequency">Frequência</Label>
                  <Select>
                    <SelectTrigger data-testid="select-plan-frequency"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                      <SelectItem value="Bimestral">Bimestral</SelectItem>
                      <SelectItem value="Trimestral">Trimestral</SelectItem>
                      <SelectItem value="Semestral">Semestral</SelectItem>
                      <SelectItem value="Anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="planProject">Projeto</Label>
                <Input id="planProject" placeholder="Nome do projeto" data-testid="input-plan-project" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planWells">Poços (separar por vírgula)</Label>
                <Input id="planWells" placeholder="PM-01, PM-02, PM-03" data-testid="input-plan-wells" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planParams">Parâmetros (separar por vírgula)</Label>
                <Input id="planParams" placeholder="BTEX, PAH, Metais" data-testid="input-plan-params" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="planStart">Data Início</Label>
                  <Input id="planStart" type="date" data-testid="input-plan-start" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planEnd">Data Fim (opcional)</Label>
                  <Input id="planEnd" type="date" data-testid="input-plan-end" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="planResponsible">Responsável Técnico</Label>
                <Input id="planResponsible" placeholder="Nome do responsável" data-testid="input-plan-responsible" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPlanDialog(false)} data-testid="btn-cancel-plan">Cancelar</Button>
              <Button onClick={() => { setShowPlanDialog(false); toast({ title: "Plano criado", description: "O novo plano de amostragem foi criado com sucesso." }); }} data-testid="btn-save-plan">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </BrowserFrame>
  );
}
