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
  Star, ThumbsUp, ThumbsDown, Minus, Send, Plus, Edit, Eye, RefreshCw,
  TrendingUp, TrendingDown, Users, MessageSquare, BarChart3, Calendar
} from "lucide-react";

type TabType = "dashboard" | "surveys" | "responses" | "analytics";

interface Survey {
  id: number;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  sentTo: number;
  responses: number;
  projectName?: string;
}

interface SurveyResponse {
  id: number;
  surveyId: number;
  surveyName: string;
  customerName: string;
  projectName: string;
  score: number;
  category: string;
  feedback?: string;
  respondedAt: string;
}

const mockSurveys: Survey[] = [
  { id: 1, name: "NPS Pós-Projeto Q4 2025", type: "NPS", status: "ativo", createdAt: "2025-10-01", sentTo: 25, responses: 18, projectName: "Geral" },
  { id: 2, name: "Satisfação - Monitoramento Semestral", type: "CSAT", status: "ativo", createdAt: "2025-12-01", sentTo: 12, responses: 8, projectName: "Área Industrial ABC" },
  { id: 3, name: "NPS Pós-Projeto Q3 2025", type: "NPS", status: "encerrado", createdAt: "2025-07-01", sentTo: 30, responses: 22, projectName: "Geral" },
  { id: 4, name: "Satisfação - Investigação Confirmatória", type: "CSAT", status: "encerrado", createdAt: "2025-09-15", sentTo: 5, responses: 5, projectName: "Posto XYZ" },
];

const mockResponses: SurveyResponse[] = [
  { id: 1, surveyId: 1, surveyName: "NPS Pós-Projeto Q4 2025", customerName: "Petrobras", projectName: "Monitoramento Refinaria", score: 10, category: "promotor", feedback: "Excelente atendimento e qualidade técnica. Laudos entregues no prazo.", respondedAt: "2025-12-15" },
  { id: 2, surveyId: 1, surveyName: "NPS Pós-Projeto Q4 2025", customerName: "Shell", projectName: "Investigação Posto Centro", score: 9, category: "promotor", feedback: "Equipe muito profissional. Comunicação clara durante todo o projeto.", respondedAt: "2025-12-14" },
  { id: 3, surveyId: 1, surveyName: "NPS Pós-Projeto Q4 2025", customerName: "Raízen", projectName: "Remediação Base", score: 8, category: "neutro", feedback: "Bom trabalho, mas prazo poderia ser menor.", respondedAt: "2025-12-13" },
  { id: 4, surveyId: 1, surveyName: "NPS Pós-Projeto Q4 2025", customerName: "Ipiranga", projectName: "Due Diligence Imóvel", score: 7, category: "neutro", respondedAt: "2025-12-12" },
  { id: 5, surveyId: 1, surveyName: "NPS Pós-Projeto Q4 2025", customerName: "Vale", projectName: "Licenciamento Mineração", score: 6, category: "detrator", feedback: "Atrasos na entrega dos relatórios.", respondedAt: "2025-12-11" },
  { id: 6, surveyId: 2, surveyName: "Satisfação - Monitoramento Semestral", customerName: "Área Industrial ABC", projectName: "Monitoramento Trimestral", score: 9, category: "promotor", feedback: "Equipe sempre disponível. Resultados confiáveis.", respondedAt: "2025-12-20" },
  { id: 7, surveyId: 2, surveyName: "Satisfação - Monitoramento Semestral", customerName: "Área Industrial ABC", projectName: "Monitoramento Trimestral", score: 10, category: "promotor", respondedAt: "2025-12-19" },
  { id: 8, surveyId: 2, surveyName: "Satisfação - Monitoramento Semestral", customerName: "Área Industrial ABC", projectName: "Monitoramento Trimestral", score: 8, category: "neutro", feedback: "Satisfeito com os serviços.", respondedAt: "2025-12-18" },
];

export default function NPSSurvey() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [showSurveyDialog, setShowSurveyDialog] = useState(false);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null);
  const { toast } = useToast();

  const getScoreBadge = (score: number) => {
    if (score >= 9) {
      return <Badge className="bg-green-500 text-white"><ThumbsUp className="h-3 w-3 mr-1" />Promotor</Badge>;
    } else if (score >= 7) {
      return <Badge className="bg-yellow-500 text-white"><Minus className="h-3 w-3 mr-1" />Neutro</Badge>;
    } else {
      return <Badge className="bg-red-500 text-white"><ThumbsDown className="h-3 w-3 mr-1" />Detrator</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ativo: "bg-green-500",
      encerrado: "bg-gray-500",
      rascunho: "bg-yellow-500",
    };
    const labels: Record<string, string> = {
      ativo: "Ativo",
      encerrado: "Encerrado",
      rascunho: "Rascunho",
    };
    return (
      <Badge className={`${colors[status] || "bg-gray-500"} text-white`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const promoters = mockResponses.filter(r => r.score >= 9).length;
  const passives = mockResponses.filter(r => r.score >= 7 && r.score < 9).length;
  const detractors = mockResponses.filter(r => r.score < 7).length;
  const totalResponses = mockResponses.length;
  const npsScore = Math.round(((promoters - detractors) / totalResponses) * 100);

  const responseRate = mockSurveys.reduce((acc, s) => acc + s.responses, 0) / mockSurveys.reduce((acc, s) => acc + s.sentTo, 0) * 100;

  return (
    <BrowserFrame>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="h-6 w-6 text-yellow-500" />
              NPS e Pesquisa de Satisfação
            </h1>
            <p className="text-muted-foreground">Medir e melhorar a experiência do cliente</p>
          </div>
          <Button variant="outline" data-testid="btn-refresh-nps">
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard"><BarChart3 className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
            <TabsTrigger value="surveys" data-testid="tab-surveys"><Send className="h-4 w-4 mr-1" /> Pesquisas</TabsTrigger>
            <TabsTrigger value="responses" data-testid="tab-responses"><MessageSquare className="h-4 w-4 mr-1" /> Respostas</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics"><TrendingUp className="h-4 w-4 mr-1" /> Análises</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="kpi-nps-score">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    NPS Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${npsScore >= 50 ? "text-green-600" : npsScore >= 0 ? "text-yellow-600" : "text-red-600"}`}>
                    {npsScore}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {npsScore >= 70 ? "Excelente" : npsScore >= 50 ? "Muito Bom" : npsScore >= 0 ? "Bom" : "Precisa Melhorar"}
                  </p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-response-rate">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    Taxa de Resposta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{responseRate.toFixed(0)}%</div>
                  <p className="text-xs text-muted-foreground">{totalResponses} respostas recebidas</p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-promoters">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                    Promotores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{promoters}</div>
                  <p className="text-xs text-muted-foreground">{((promoters/totalResponses)*100).toFixed(0)}% do total</p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-detractors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ThumbsDown className="h-4 w-4 text-red-500" />
                    Detratores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{detractors}</div>
                  <p className="text-xs text-muted-foreground">{((detractors/totalResponses)*100).toFixed(0)}% do total</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Distribuição de Scores</CardTitle>
                  <CardDescription>Promotores vs Neutros vs Detratores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm flex items-center gap-2">
                          <ThumbsUp className="h-4 w-4 text-green-500" /> Promotores (9-10)
                        </span>
                        <span className="text-sm font-medium">{promoters}</span>
                      </div>
                      <Progress value={(promoters/totalResponses)*100} className="h-2 bg-gray-200" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm flex items-center gap-2">
                          <Minus className="h-4 w-4 text-yellow-500" /> Neutros (7-8)
                        </span>
                        <span className="text-sm font-medium">{passives}</span>
                      </div>
                      <Progress value={(passives/totalResponses)*100} className="h-2 bg-gray-200" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm flex items-center gap-2">
                          <ThumbsDown className="h-4 w-4 text-red-500" /> Detratores (0-6)
                        </span>
                        <span className="text-sm font-medium">{detractors}</span>
                      </div>
                      <Progress value={(detractors/totalResponses)*100} className="h-2 bg-gray-200" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Últimos Feedbacks</CardTitle>
                  <CardDescription>Comentários mais recentes dos clientes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockResponses.filter(r => r.feedback).slice(0, 4).map(response => (
                      <div key={response.id} className="border-b pb-2" data-testid={`feedback-${response.id}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{response.customerName}</span>
                          {getScoreBadge(response.score)}
                        </div>
                        <p className="text-sm text-muted-foreground">{response.feedback}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="surveys" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pesquisas de Satisfação</h2>
              <Button onClick={() => setShowSurveyDialog(true)} data-testid="btn-new-survey">
                <Plus className="h-4 w-4 mr-2" /> Nova Pesquisa
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Enviados</TableHead>
                      <TableHead>Respostas</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockSurveys.map((survey) => (
                      <TableRow key={survey.id} data-testid={`survey-row-${survey.id}`}>
                        <TableCell className="font-medium">{survey.name}</TableCell>
                        <TableCell><Badge variant="outline">{survey.type}</Badge></TableCell>
                        <TableCell>{survey.projectName}</TableCell>
                        <TableCell>{survey.sentTo}</TableCell>
                        <TableCell>{survey.responses}</TableCell>
                        <TableCell>{((survey.responses/survey.sentTo)*100).toFixed(0)}%</TableCell>
                        <TableCell>{getStatusBadge(survey.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" data-testid={`btn-view-survey-${survey.id}`}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-edit-survey-${survey.id}`}><Edit className="h-4 w-4" /></Button>
                            {survey.status === "ativo" && (
                              <Button variant="ghost" size="icon" data-testid={`btn-send-survey-${survey.id}`}><Send className="h-4 w-4" /></Button>
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

          <TabsContent value="responses" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Respostas Recebidas</h2>
              <Badge variant="outline">{mockResponses.length} respostas</Badge>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Pesquisa</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockResponses.map((response) => (
                      <TableRow key={response.id} data-testid={`response-row-${response.id}`}>
                        <TableCell className="font-medium">{response.customerName}</TableCell>
                        <TableCell>{response.projectName}</TableCell>
                        <TableCell>{response.surveyName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className={`h-4 w-4 ${response.score >= 9 ? "text-green-500" : response.score >= 7 ? "text-yellow-500" : "text-red-500"}`} />
                            <span className="font-bold">{response.score}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getScoreBadge(response.score)}</TableCell>
                        <TableCell>{new Date(response.respondedAt).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => { setSelectedResponse(response); setShowResponseDialog(true); }}
                            data-testid={`btn-view-response-${response.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <h2 className="text-lg font-semibold">Análises e Tendências</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Evolução do NPS
                  </CardTitle>
                  <CardDescription>Histórico trimestral</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span>Q4 2025</span>
                      <span className="text-xl font-bold text-green-600">{npsScore}</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <span>Q3 2025</span>
                      <span className="text-xl font-bold text-green-600">42</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <span>Q2 2025</span>
                      <span className="text-xl font-bold text-yellow-600">35</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Q1 2025</span>
                      <span className="text-xl font-bold text-yellow-600">28</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700">
                      <TrendingUp className="h-5 w-5" />
                      <span className="font-medium">+{npsScore - 28} pontos no ano</span>
                    </div>
                    <p className="text-sm text-green-600 mt-1">Excelente evolução!</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    NPS por Tipo de Serviço
                  </CardTitle>
                  <CardDescription>Performance por categoria</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Monitoramento</span>
                        <span className="text-sm font-bold text-green-600">72</span>
                      </div>
                      <Progress value={72} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Investigação</span>
                        <span className="text-sm font-bold text-green-600">65</span>
                      </div>
                      <Progress value={65} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Remediação</span>
                        <span className="text-sm font-bold text-yellow-600">45</span>
                      </div>
                      <Progress value={45} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Due Diligence</span>
                        <span className="text-sm font-bold text-yellow-600">52</span>
                      </div>
                      <Progress value={52} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Licenciamento</span>
                        <span className="text-sm font-bold text-yellow-600">38</span>
                      </div>
                      <Progress value={38} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Principais Pontos de Melhoria</CardTitle>
                <CardDescription>Baseado nos feedbacks dos detratores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="h-5 w-5 text-red-500" />
                      <span className="font-medium">Prazo de Entrega</span>
                    </div>
                    <p className="text-sm text-muted-foreground">30% dos detratores mencionam atrasos nas entregas</p>
                    <Button variant="outline" size="sm" className="mt-3" data-testid="btn-action-prazo">
                      Ver Ações
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="h-5 w-5 text-orange-500" />
                      <span className="font-medium">Comunicação</span>
                    </div>
                    <p className="text-sm text-muted-foreground">20% pedem mais atualizações durante os projetos</p>
                    <Button variant="outline" size="sm" className="mt-3" data-testid="btn-action-comunicacao">
                      Ver Ações
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="h-5 w-5 text-yellow-500" />
                      <span className="font-medium">Custo</span>
                    </div>
                    <p className="text-sm text-muted-foreground">15% consideram os valores acima do esperado</p>
                    <Button variant="outline" size="sm" className="mt-3" data-testid="btn-action-custo">
                      Ver Ações
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showSurveyDialog} onOpenChange={setShowSurveyDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Nova Pesquisa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="surveyName">Nome da Pesquisa *</Label>
                <Input id="surveyName" placeholder="Ex: NPS Pós-Projeto Q1 2026" data-testid="input-survey-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="surveyType">Tipo</Label>
                  <Select>
                    <SelectTrigger data-testid="select-survey-type"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NPS">NPS (0-10)</SelectItem>
                      <SelectItem value="CSAT">CSAT (1-5)</SelectItem>
                      <SelectItem value="CES">CES - Esforço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surveyProject">Projeto</Label>
                  <Input id="surveyProject" placeholder="Ex: Área Industrial ABC" data-testid="input-survey-project" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="surveyQuestion">Pergunta Principal</Label>
                <Textarea 
                  id="surveyQuestion" 
                  placeholder="Em uma escala de 0 a 10, qual a probabilidade de você recomendar nossos serviços?" 
                  data-testid="input-survey-question"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surveyTargets">Destinatários (e-mails separados por vírgula)</Label>
                <Textarea 
                  id="surveyTargets" 
                  placeholder="cliente1@email.com, cliente2@email.com" 
                  data-testid="input-survey-targets"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSurveyDialog(false)} data-testid="btn-cancel-survey">Cancelar</Button>
              <Button onClick={() => { setShowSurveyDialog(false); toast({ title: "Pesquisa criada", description: "A pesquisa foi criada e está pronta para envio." }); }} data-testid="btn-save-survey">Criar Pesquisa</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes da Resposta</DialogTitle>
            </DialogHeader>
            {selectedResponse && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Cliente</Label>
                    <p className="font-medium">{selectedResponse.customerName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Projeto</Label>
                    <p className="font-medium">{selectedResponse.projectName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Score</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className={`h-6 w-6 ${selectedResponse.score >= 9 ? "text-green-500" : selectedResponse.score >= 7 ? "text-yellow-500" : "text-red-500"}`} />
                      <span className="text-2xl font-bold">{selectedResponse.score}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Categoria</Label>
                    <div className="mt-1">{getScoreBadge(selectedResponse.score)}</div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Pesquisa</Label>
                  <p>{selectedResponse.surveyName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Data da Resposta</Label>
                  <p>{new Date(selectedResponse.respondedAt).toLocaleDateString("pt-BR")}</p>
                </div>
                {selectedResponse.feedback && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Feedback</Label>
                    <p className="mt-1 p-3 bg-muted rounded-lg">{selectedResponse.feedback}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResponseDialog(false)} data-testid="btn-close-response">Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </BrowserFrame>
  );
}
