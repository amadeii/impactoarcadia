import { useState } from "react";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Users, Calendar, ClipboardCheck, Plus, Edit, Eye,
  RefreshCw, CheckCircle, Car, Hotel, AlertTriangle, Truck, BarChart3
} from "lucide-react";

type TabType = "dashboard" | "scheduling" | "teams" | "pt" | "lodging" | "vehicles";

interface FieldTeam {
  id: number;
  name: string;
  leader?: string;
  members?: string[];
  status: string;
  currentProject?: string;
}

interface FieldSchedule {
  id: number;
  projectName: string;
  location: string;
  startDate: string;
  endDate: string;
  teamId?: number;
  teamName?: string;
  status: string;
  activities?: string[];
}

interface WorkPermit {
  id: number;
  permitNumber: string;
  projectName: string;
  type: string;
  validFrom: string;
  validUntil: string;
  status: string;
  responsiblePerson?: string;
}

interface Lodging {
  id: number;
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  guests?: string[];
  totalCost?: number;
  status: string;
}

const statusColors: Record<string, string> = {
  ativo: "bg-green-500",
  pendente: "bg-yellow-500",
  concluido: "bg-blue-500",
  cancelado: "bg-red-500",
  em_campo: "bg-green-600",
  disponivel: "bg-blue-400",
  manutencao: "bg-orange-500",
  aprovada: "bg-green-500",
  aguardando: "bg-yellow-500",
  expirada: "bg-gray-500",
  confirmada: "bg-green-500",
  reservada: "bg-blue-500",
};

const mockTeams: FieldTeam[] = [
  { id: 1, name: "Equipe Alfa", leader: "Carlos Silva", members: ["João", "Maria", "Pedro"], status: "em_campo", currentProject: "Monitoramento CETESB - Área 12" },
  { id: 2, name: "Equipe Beta", leader: "Ana Souza", members: ["Lucas", "Fernanda"], status: "disponivel" },
  { id: 3, name: "Equipe Gamma", leader: "Roberto Lima", members: ["Marcos", "Julia", "André", "Paula"], status: "em_campo", currentProject: "Investigação Confirmatória - Cliente XYZ" },
];

const mockSchedules: FieldSchedule[] = [
  { id: 1, projectName: "Monitoramento CETESB - Área 12", location: "São Paulo, SP", startDate: "2026-01-20", endDate: "2026-01-24", teamId: 1, teamName: "Equipe Alfa", status: "ativo", activities: ["Coleta de água", "Medição de nível", "Purga de poços"] },
  { id: 2, projectName: "Investigação Confirmatória - Cliente XYZ", location: "Campinas, SP", startDate: "2026-01-22", endDate: "2026-01-28", teamId: 3, teamName: "Equipe Gamma", status: "ativo", activities: ["Sondagens", "Instalação de poços", "Coleta de amostras"] },
  { id: 3, projectName: "Auditoria Ambiental - Empresa ABC", location: "Santos, SP", startDate: "2026-02-01", endDate: "2026-02-03", status: "pendente", activities: ["Vistoria técnica", "Entrevistas", "Análise documental"] },
];

const mockPermits: WorkPermit[] = [
  { id: 1, permitNumber: "PT-2026-001", projectName: "Monitoramento CETESB - Área 12", type: "Trabalho em Altura", validFrom: "2026-01-20", validUntil: "2026-01-24", status: "aprovada", responsiblePerson: "Carlos Silva" },
  { id: 2, permitNumber: "PT-2026-002", projectName: "Investigação Confirmatória - Cliente XYZ", type: "Espaço Confinado", validFrom: "2026-01-22", validUntil: "2026-01-28", status: "aprovada", responsiblePerson: "Roberto Lima" },
  { id: 3, permitNumber: "PT-2026-003", projectName: "Auditoria Ambiental - Empresa ABC", type: "Trabalho a Quente", validFrom: "2026-02-01", validUntil: "2026-02-03", status: "aguardando", responsiblePerson: "Ana Souza" },
];

const mockLodging: Lodging[] = [
  { id: 1, hotelName: "Hotel Ibis São Paulo", city: "São Paulo", checkIn: "2026-01-20", checkOut: "2026-01-24", guests: ["Carlos Silva", "João", "Maria", "Pedro"], totalCost: 1200, status: "confirmada" },
  { id: 2, hotelName: "Comfort Suites Campinas", city: "Campinas", checkIn: "2026-01-22", checkOut: "2026-01-28", guests: ["Roberto Lima", "Marcos", "Julia", "André", "Paula"], totalCost: 2100, status: "confirmada" },
  { id: 3, hotelName: "Hotel Atlântico Santos", city: "Santos", checkIn: "2026-02-01", checkOut: "2026-02-03", guests: ["Ana Souza", "Lucas", "Fernanda"], totalCost: 600, status: "reservada" },
];

export default function FieldOperations() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [showPermitDialog, setShowPermitDialog] = useState(false);
  const [showLodgingDialog, setShowLodgingDialog] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const hrmEmployees = [
    { id: "emp-001", name: "João Silva", role: "Técnico Ambiental", department: "Campo" },
    { id: "emp-002", name: "Maria Santos", role: "Engenheira Ambiental", department: "Projetos" },
    { id: "emp-003", name: "Carlos Oliveira", role: "Operador de Sonda", department: "Campo" },
    { id: "emp-004", name: "Ana Costa", role: "Coordenadora de Qualidade", department: "Qualidade" },
    { id: "emp-005", name: "Pedro Lima", role: "Técnico de Laboratório", department: "Laboratório" },
    { id: "emp-006", name: "Fernanda Souza", role: "Geóloga", department: "Projetos" },
    { id: "emp-007", name: "Lucas Martins", role: "Motorista/Auxiliar", department: "Logística" },
    { id: "emp-008", name: "Julia Ferreira", role: "Técnica Ambiental", department: "Campo" },
    { id: "emp-009", name: "André Santos", role: "Hidrogeólogo", department: "Projetos" },
    { id: "emp-010", name: "Paula Ribeiro", role: "Auxiliar de Campo", department: "Campo" },
    { id: "emp-011", name: "Marcos Almeida", role: "Técnico de Segurança", department: "SST" },
    { id: "emp-012", name: "Roberto Lima", role: "Supervisor de Campo", department: "Campo" },
  ];

  const getStatusBadge = (status: string) => {
    const color = statusColors[status] || "bg-gray-500";
    const label = status.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
    return <Badge className={`${color} text-white`}>{label}</Badge>;
  };

  const teamsInField = mockTeams.filter(t => t.status === "em_campo").length;
  const activeSchedules = mockSchedules.filter(s => s.status === "ativo").length;
  const pendingPermits = mockPermits.filter(p => p.status === "aguardando").length;
  const upcomingLodging = mockLodging.filter(l => new Date(l.checkIn) >= new Date()).length;

  return (
    <BrowserFrame>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6 text-orange-600" />
              Operações de Campo
            </h1>
            <p className="text-muted-foreground">
              Programação, equipes, permissões de trabalho e logística
            </p>
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList className="h-12">
            <TabsTrigger value="dashboard" className="gap-2" data-testid="tab-field-dashboard">
              <BarChart3 className="h-4 w-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="scheduling" className="gap-2" data-testid="tab-field-scheduling">
              <Calendar className="h-4 w-4" /> Programação
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2" data-testid="tab-field-teams">
              <Users className="h-4 w-4" /> Equipes
            </TabsTrigger>
            <TabsTrigger value="pt" className="gap-2" data-testid="tab-field-pt">
              <ClipboardCheck className="h-4 w-4" /> PT (Permissões)
            </TabsTrigger>
            <TabsTrigger value="lodging" className="gap-2" data-testid="tab-field-lodging">
              <Hotel className="h-4 w-4" /> Hospedagem
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-2" data-testid="tab-field-vehicles">
              <Car className="h-4 w-4" /> Veículos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Equipes em Campo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{teamsInField}</div>
                  <p className="text-xs text-muted-foreground">de {mockTeams.length} equipes</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Campanhas Ativas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{activeSchedules}</div>
                  <p className="text-xs text-muted-foreground">em andamento</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">PTs Pendentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">{pendingPermits}</div>
                  <p className="text-xs text-muted-foreground">aguardando aprovação</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Hospedagens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">{upcomingLodging}</div>
                  <p className="text-xs text-muted-foreground">próximas reservas</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Campanhas em Andamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockSchedules.filter(s => s.status === "ativo").map((schedule) => (
                      <div key={schedule.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{schedule.projectName}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {schedule.location}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{schedule.teamName}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(schedule.startDate).toLocaleDateString("pt-BR")} - {new Date(schedule.endDate).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Status das Equipes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockTeams.map((team) => (
                      <div key={team.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${team.status === "em_campo" ? "bg-green-500" : "bg-blue-400"}`} />
                          <div>
                            <p className="font-medium text-sm">{team.name}</p>
                            <p className="text-xs text-muted-foreground">Líder: {team.leader}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(team.status)}
                          {team.currentProject && (
                            <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate">{team.currentProject}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Alertas e Pendências
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingPermits > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <ClipboardCheck className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm">{pendingPermits} Permissão(ões) de Trabalho aguardando aprovação</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Próxima campanha: Auditoria Ambiental - Empresa ABC (01/02/2026)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduling" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Programação de Campo</h2>
              <Button onClick={() => setShowScheduleDialog(true)} data-testid="btn-new-schedule">
                <Plus className="h-4 w-4 mr-2" /> Nova Campanha
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Atividades</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockSchedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">{schedule.projectName}</TableCell>
                        <TableCell>{schedule.location}</TableCell>
                        <TableCell>
                          {new Date(schedule.startDate).toLocaleDateString("pt-BR")} - {new Date(schedule.endDate).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>{schedule.teamName || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {schedule.activities?.slice(0, 2).map((act, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{act}</Badge>
                            ))}
                            {(schedule.activities?.length || 0) > 2 && (
                              <Badge variant="outline" className="text-xs">+{(schedule.activities?.length || 0) - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" data-testid={`btn-view-schedule-${schedule.id}`}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-edit-schedule-${schedule.id}`}><Edit className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Equipes de Campo</h2>
              <Button onClick={() => { setSelectedMembers([]); setShowTeamDialog(true); }} data-testid="btn-new-team">
                <Plus className="h-4 w-4 mr-2" /> Nova Equipe
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockTeams.map((team) => (
                <Card key={team.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      {getStatusBadge(team.status)}
                    </div>
                    <CardDescription>Líder: {team.leader}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Membros ({team.members?.length || 0})</p>
                        <div className="flex flex-wrap gap-1">
                          {team.members?.map((member, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{member}</Badge>
                          ))}
                        </div>
                      </div>
                      {team.currentProject && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Projeto Atual</p>
                          <p className="text-sm font-medium">{team.currentProject}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm" data-testid={`btn-edit-team-${team.id}`}><Edit className="h-3 w-3 mr-1" /> Editar</Button>
                      <Button size="sm" data-testid={`btn-view-team-${team.id}`}><Eye className="h-3 w-3 mr-1" /> Ver Detalhes</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pt" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Permissões de Trabalho (PT)</h2>
              <Button onClick={() => setShowPermitDialog(true)} data-testid="btn-new-permit">
                <Plus className="h-4 w-4 mr-2" /> Nova PT
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockPermits.map((permit) => (
                      <TableRow key={permit.id}>
                        <TableCell className="font-medium">{permit.permitNumber}</TableCell>
                        <TableCell>{permit.projectName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{permit.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(permit.validFrom).toLocaleDateString("pt-BR")} - {new Date(permit.validUntil).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>{permit.responsiblePerson}</TableCell>
                        <TableCell>{getStatusBadge(permit.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" data-testid={`btn-view-permit-${permit.id}`}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-edit-permit-${permit.id}`}><Edit className="h-4 w-4" /></Button>
                            {permit.status === "aguardando" && (
                              <Button variant="ghost" size="icon" className="text-green-600" data-testid={`btn-approve-permit-${permit.id}`}><CheckCircle className="h-4 w-4" /></Button>
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

          <TabsContent value="lodging" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Hospedagem e Logística</h2>
              <Button onClick={() => setShowLodgingDialog(true)} data-testid="btn-new-lodging">
                <Plus className="h-4 w-4 mr-2" /> Nova Reserva
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hotel</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Hóspedes</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockLodging.map((lodging) => (
                      <TableRow key={lodging.id}>
                        <TableCell className="font-medium">{lodging.hotelName}</TableCell>
                        <TableCell>{lodging.city}</TableCell>
                        <TableCell>{new Date(lodging.checkIn).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{new Date(lodging.checkOut).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {lodging.guests?.slice(0, 2).map((guest, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{guest}</Badge>
                            ))}
                            {(lodging.guests?.length || 0) > 2 && (
                              <Badge variant="outline" className="text-xs">+{(lodging.guests?.length || 0) - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lodging.totalCost?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell>{getStatusBadge(lodging.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" data-testid={`btn-view-lodging-${lodging.id}`}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-edit-lodging-${lodging.id}`}><Edit className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vehicles" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Frota e Veículos</h2>
              <Button data-testid="btn-new-vehicle">
                <Plus className="h-4 w-4 mr-2" /> Adicionar Veículo
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Toyota Hilux
                    </CardTitle>
                    {getStatusBadge("em_campo")}
                  </div>
                  <CardDescription>Placa: ABC-1234</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Km Atual:</span>
                      <span>45.230 km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Próx. Revisão:</span>
                      <span>50.000 km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Equipe:</span>
                      <span>Equipe Alfa</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Car className="h-5 w-5" />
                      VW Amarok
                    </CardTitle>
                    {getStatusBadge("em_campo")}
                  </div>
                  <CardDescription>Placa: DEF-5678</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Km Atual:</span>
                      <span>32.150 km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Próx. Revisão:</span>
                      <span>40.000 km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Equipe:</span>
                      <span>Equipe Gamma</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Car className="h-5 w-5" />
                      Fiat Toro
                    </CardTitle>
                    {getStatusBadge("disponivel")}
                  </div>
                  <CardDescription>Placa: GHI-9012</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Km Atual:</span>
                      <span>18.500 km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Próx. Revisão:</span>
                      <span>20.000 km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="text-green-600">Disponível</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Campanha de Campo</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); toast({ title: "Campanha criada com sucesso" }); setShowScheduleDialog(false); }}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Projeto *</Label>
                  <Input id="projectName" name="projectName" placeholder="Nome do projeto" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Local</Label>
                  <Input id="location" name="location" placeholder="Cidade, Estado" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Data Início</Label>
                    <Input id="startDate" name="startDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Data Fim</Label>
                    <Input id="endDate" name="endDate" type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team">Equipe</Label>
                  <Select name="team">
                    <SelectTrigger><SelectValue placeholder="Selecione a equipe" /></SelectTrigger>
                    <SelectContent>
                      {mockTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id.toString()}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activities">Atividades Planejadas</Label>
                  <Textarea id="activities" name="activities" placeholder="Uma atividade por linha..." rows={3} />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancelar</Button>
                <Button type="submit">Criar Campanha</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showPermitDialog} onOpenChange={setShowPermitDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Permissão de Trabalho</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); toast({ title: "PT criada com sucesso" }); setShowPermitDialog(false); }}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ptProject">Projeto *</Label>
                  <Input id="ptProject" name="ptProject" placeholder="Nome do projeto" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ptType">Tipo de PT</Label>
                  <Select name="ptType">
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="altura">Trabalho em Altura</SelectItem>
                      <SelectItem value="confinado">Espaço Confinado</SelectItem>
                      <SelectItem value="quente">Trabalho a Quente</SelectItem>
                      <SelectItem value="escavacao">Escavação</SelectItem>
                      <SelectItem value="eletrico">Trabalho Elétrico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="validFrom">Válida de</Label>
                    <Input id="validFrom" name="validFrom" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validUntil">Válida até</Label>
                    <Input id="validUntil" name="validUntil" type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsible">Responsável</Label>
                  <Input id="responsible" name="responsible" placeholder="Nome do responsável" />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowPermitDialog(false)}>Cancelar</Button>
                <Button type="submit">Criar PT</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showLodgingDialog} onOpenChange={setShowLodgingDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Reserva de Hospedagem</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); toast({ title: "Reserva criada com sucesso" }); setShowLodgingDialog(false); }}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hotelName">Hotel *</Label>
                  <Input id="hotelName" name="hotelName" placeholder="Nome do hotel" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" name="city" placeholder="Cidade" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="checkIn">Check-in</Label>
                    <Input id="checkIn" name="checkIn" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkOut">Check-out</Label>
                    <Input id="checkOut" name="checkOut" type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guests">Hóspedes</Label>
                  <Textarea id="guests" name="guests" placeholder="Um hóspede por linha..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalCost">Valor Total (R$)</Label>
                  <Input id="totalCost" name="totalCost" type="number" step="0.01" />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowLodgingDialog(false)}>Cancelar</Button>
                <Button type="submit">Criar Reserva</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Nova Equipe de Campo
              </DialogTitle>
              <DialogDescription>
                Crie uma equipe selecionando colaboradores do Arcádia People
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); toast({ title: "Equipe criada com sucesso" }); setShowTeamDialog(false); }}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teamName">Nome da Equipe *</Label>
                    <Input id="teamName" name="teamName" placeholder="Ex: Equipe Delta" required data-testid="input-team-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teamStatus">Status</Label>
                    <Select name="teamStatus" defaultValue="disponivel">
                      <SelectTrigger data-testid="select-team-status">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disponivel">Disponível</SelectItem>
                        <SelectItem value="em_campo">Em Campo</SelectItem>
                        <SelectItem value="ferias">Em Férias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamLeader">Líder da Equipe *</Label>
                  <Select name="teamLeader" required>
                    <SelectTrigger data-testid="select-team-leader">
                      <SelectValue placeholder="Selecionar líder (do Arcádia People)" />
                    </SelectTrigger>
                    <SelectContent>
                      {hrmEmployees.filter(e => e.role.includes("Supervisor") || e.role.includes("Coordenador") || e.role.includes("Engenhei")).map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {emp.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Sincronizado com Arcádia People (HRM)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Membros da Equipe *</Label>
                  <p className="text-xs text-muted-foreground mb-2">Selecione os colaboradores do Arcádia People</p>
                  <div className="border rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-2">
                    {hrmEmployees.map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md transition-colors">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            id={`member-${emp.id}`}
                            checked={selectedMembers.includes(emp.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMembers([...selectedMembers, emp.id]);
                              } else {
                                setSelectedMembers(selectedMembers.filter(id => id !== emp.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300"
                            data-testid={`checkbox-member-${emp.id}`}
                          />
                          <label htmlFor={`member-${emp.id}`} className="cursor-pointer">
                            <p className="font-medium text-sm">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.role} • {emp.department}</p>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedMembers.map(id => {
                        const emp = hrmEmployees.find(e => e.id === id);
                        return emp ? (
                          <Badge key={id} variant="secondary" className="text-xs">
                            {emp.name}
                            <button 
                              type="button"
                              onClick={() => setSelectedMembers(selectedMembers.filter(m => m !== id))}
                              className="ml-1 hover:text-red-500"
                            >×</button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {selectedMembers.length} membro(s) selecionado(s)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentProject">Projeto Atual</Label>
                  <Input id="currentProject" name="currentProject" placeholder="Ex: Monitoramento CETESB - Área 12" data-testid="input-team-project" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamNotes">Observações</Label>
                  <Textarea id="teamNotes" name="teamNotes" placeholder="Informações adicionais sobre a equipe..." rows={2} data-testid="input-team-notes" />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowTeamDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={selectedMembers.length === 0} data-testid="btn-save-team">
                  Criar Equipe
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </BrowserFrame>
  );
}
