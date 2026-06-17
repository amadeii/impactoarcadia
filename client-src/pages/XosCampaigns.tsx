import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Target, ArrowLeft, Search, Plus, MoreVertical, Calendar, Users,
  Mail, MessageSquare, Send, BarChart3, Clock, Play, Pause, CheckCircle,
  Edit2, Copy, Trash2, Eye, TrendingUp, MousePointer, UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

interface Campaign {
  id: number;
  name: string;
  description: string;
  type: string;
  status: string;
  subject: string;
  content: string;
  scheduled_at: string;
  started_at: string;
  completed_at: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    bounced: number;
  };
  created_at: string;
}

export default function XosCampaigns() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    type: "email",
    subject: "",
    content: "",
    description: "",
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/xos/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/xos/campaigns");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const sampleCampaigns: Campaign[] = [
    {
      id: 1,
      name: "Black Friday 2025",
      description: "Campanha promocional de Black Friday com 30% de desconto",
      type: "email",
      status: "completed",
      subject: "Black Friday: 30% OFF em todos os planos!",
      content: "Aproveite nossa maior promoção do ano...",
      scheduled_at: "",
      started_at: new Date(Date.now() - 604800000).toISOString(),
      completed_at: new Date(Date.now() - 518400000).toISOString(),
      stats: { sent: 1500, delivered: 1450, opened: 580, clicked: 145, converted: 32, bounced: 50 },
      created_at: new Date(Date.now() - 864000000).toISOString(),
    },
    {
      id: 2,
      name: "Onboarding - Novos Clientes",
      description: "Sequência de emails de boas-vindas para novos clientes",
      type: "automation",
      status: "active",
      subject: "Bem-vindo ao Arcádia Suite!",
      content: "Olá! Seja bem-vindo ao Arcádia Suite...",
      scheduled_at: "",
      started_at: new Date(Date.now() - 2592000000).toISOString(),
      completed_at: "",
      stats: { sent: 320, delivered: 315, opened: 250, clicked: 120, converted: 85, bounced: 5 },
      created_at: new Date(Date.now() - 2592000000).toISOString(),
    },
    {
      id: 3,
      name: "Lançamento XOS",
      description: "Anúncio do novo módulo XOS para base de clientes",
      type: "email",
      status: "scheduled",
      subject: "Novidade: Conheça o XOS!",
      content: "Temos o prazer de anunciar o XOS...",
      scheduled_at: new Date(Date.now() + 172800000).toISOString(),
      started_at: "",
      completed_at: "",
      stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, bounced: 0 },
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 4,
      name: "WhatsApp - Abandono de Carrinho",
      description: "Recuperação de leads que não concluíram a compra",
      type: "whatsapp",
      status: "draft",
      subject: "",
      content: "Olá! Notamos que você deixou itens no carrinho...",
      scheduled_at: "",
      started_at: "",
      completed_at: "",
      stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, bounced: 0 },
      created_at: new Date(Date.now() - 43200000).toISOString(),
    },
  ];

  const displayCampaigns = campaigns.length > 0 ? campaigns : sampleCampaigns;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700",
      scheduled: "bg-blue-100 text-blue-700",
      active: "bg-green-100 text-green-700",
      paused: "bg-yellow-100 text-yellow-700",
      completed: "bg-slate-100 text-slate-700",
    };
    return colors[status] || colors.draft;
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      draft: Edit2,
      scheduled: Clock,
      active: Play,
      paused: Pause,
      completed: CheckCircle,
    };
    return icons[status] || Edit2;
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      email: Mail,
      whatsapp: MessageSquare,
      sms: Send,
      automation: TrendingUp,
    };
    return icons[type] || Mail;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      email: "bg-blue-500",
      whatsapp: "bg-green-500",
      sms: "bg-purple-500",
      automation: "bg-orange-500",
    };
    return colors[type] || colors.email;
  };

  const calculateRate = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const filteredCampaigns = displayCampaigns.filter((c) => {
    if (activeTab === "all") return true;
    return c.status === activeTab;
  });

  const stats = {
    total: displayCampaigns.length,
    active: displayCampaigns.filter((c) => c.status === "active").length,
    scheduled: displayCampaigns.filter((c) => c.status === "scheduled").length,
    totalSent: displayCampaigns.reduce((sum, c) => sum + (c.stats?.sent || 0), 0),
    totalOpened: displayCampaigns.reduce((sum, c) => sum + (c.stats?.opened || 0), 0),
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/xos">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-pink-500 to-rose-500 p-2 rounded-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Campanhas</h1>
                <p className="text-xs text-slate-500">Marketing Automation</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Buscar campanhas..." className="w-64 pl-10" data-testid="input-search" />
            </div>

            <Dialog open={isNewCampaignOpen} onOpenChange={setIsNewCampaignOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-campaign">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Campanha
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nova Campanha</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome da Campanha *</Label>
                    <Input
                      placeholder="Ex: Black Friday 2025"
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                      data-testid="input-campaign-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={newCampaign.type}
                      onValueChange={(v) => setNewCampaign({ ...newCampaign, type: v })}
                    >
                      <SelectTrigger data-testid="select-campaign-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email Marketing</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="automation">Automação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assunto</Label>
                    <Input
                      placeholder="Linha de assunto do email"
                      value={newCampaign.subject}
                      onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                      data-testid="input-campaign-subject"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      placeholder="Descreva o objetivo da campanha..."
                      value={newCampaign.description}
                      onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                      data-testid="input-campaign-description"
                    />
                  </div>
                  <Button className="w-full" disabled={!newCampaign.name} data-testid="button-save-campaign">
                    Criar Campanha
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card data-testid="stat-total">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
                </div>
                <Target className="h-8 w-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200" data-testid="stat-active">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Ativas</p>
                  <p className="text-3xl font-bold text-green-800">{stats.active}</p>
                </div>
                <Play className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200" data-testid="stat-sent">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Enviadas</p>
                  <p className="text-3xl font-bold text-blue-800">{stats.totalSent.toLocaleString()}</p>
                </div>
                <Send className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-violet-50 border-violet-200" data-testid="stat-opened">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-violet-700">Abertas</p>
                  <p className="text-3xl font-bold text-violet-800">{stats.totalOpened.toLocaleString()}</p>
                </div>
                <Eye className="h-8 w-8 text-violet-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">Todas</TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">Ativas</TabsTrigger>
            <TabsTrigger value="scheduled" data-testid="tab-scheduled">Agendadas</TabsTrigger>
            <TabsTrigger value="draft" data-testid="tab-draft">Rascunhos</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">Finalizadas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCampaigns.map((campaign) => {
            const StatusIcon = getStatusIcon(campaign.status);
            const TypeIcon = getTypeIcon(campaign.type);
            const openRate = calculateRate(campaign.stats?.opened || 0, campaign.stats?.delivered || 0);
            const clickRate = calculateRate(campaign.stats?.clicked || 0, campaign.stats?.opened || 0);

            return (
              <Card key={campaign.id} className="hover:shadow-md transition-shadow" data-testid={`campaign-${campaign.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getTypeColor(campaign.type)}`}>
                        <TypeIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">{campaign.name}</h3>
                        <p className="text-sm text-slate-500">{campaign.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(campaign.status)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {campaign.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Edit2 className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem><Copy className="h-4 w-4 mr-2" /> Duplicar</DropdownMenuItem>
                          <DropdownMenuItem><BarChart3 className="h-4 w-4 mr-2" /> Relatório</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {campaign.stats && campaign.stats.sent > 0 && (
                    <div className="space-y-3 mt-4 pt-4 border-t">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-2xl font-bold text-slate-800">{campaign.stats.sent}</p>
                          <p className="text-xs text-slate-500">Enviadas</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-800">{campaign.stats.delivered}</p>
                          <p className="text-xs text-slate-500">Entregues</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-600">{openRate}%</p>
                          <p className="text-xs text-slate-500">Taxa Abertura</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">{clickRate}%</p>
                          <p className="text-xs text-slate-500">Taxa Clique</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Abertura</span>
                          <span className="font-medium">{openRate}%</span>
                        </div>
                        <Progress value={openRate} className="h-2" />
                      </div>
                    </div>
                  )}

                  {campaign.status === "scheduled" && campaign.scheduled_at && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t text-sm text-slate-500">
                      <Calendar className="h-4 w-4" />
                      Agendada para {new Date(campaign.scheduled_at).toLocaleDateString("pt-BR")} às{" "}
                      {new Date(campaign.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}

                  {campaign.status === "draft" && (
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit2 className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button size="sm" className="flex-1">
                        <Send className="h-4 w-4 mr-2" />
                        Enviar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredCampaigns.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-800">Nenhuma campanha encontrada</h3>
              <p className="text-slate-500 mt-1">Crie sua primeira campanha para começar</p>
              <Button className="mt-4" onClick={() => setIsNewCampaignOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Campanha
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
