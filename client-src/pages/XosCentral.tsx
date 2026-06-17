import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { 
  Users, Building2, TrendingUp, MessageSquare, Ticket, Zap, LayoutGrid, 
  ChevronRight, PlusCircle, Filter, Search, Bell, Calendar, Target,
  BarChart3, DollarSign, Clock, AlertCircle, Phone, Mail, ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface XosStats {
  total_contacts: number;
  total_leads: number;
  total_customers: number;
  total_companies: number;
  open_deals: number;
  won_deals: number;
  pipeline_value: number;
  won_value: number;
  open_conversations: number;
  open_tickets: number;
  overdue_activities: number;
}

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  type: string;
  lead_status: string;
  source: string;
  created_at: string;
  pessoa_soe_id?: string | null;
}

interface Deal {
  id: number;
  title: string;
  value: number;
  status: string;
  stage_name: string;
  stage_color: string;
  contact_name: string;
  company_name: string;
  created_at: string;
}

interface Activity {
  id: number;
  type: string;
  title: string;
  status: string;
  priority: string;
  due_at: string;
  contact_name: string;
  deal_title: string;
}

export default function XosCentral() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: stats } = useQuery<XosStats>({
    queryKey: ["/api/xos/stats"],
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/xos/contacts"],
  });

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/xos/deals"],
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/xos/activities"],
  });

  // SOE-05: Informações do tenant (segmento)
  const { data: tenantInfo } = useQuery<{ id: string; name: string; segment: string | null; features: any }>({
    queryKey: ["/api/soe/tenant/info"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  // SOE-05: Roteamento do CRM por segmento
  const crmHref = tenantInfo?.segment === "engineering" ? "/commercial-env" : "/xos/crm";

  const modules = [
    { id: "crm", name: "CRM", icon: Users, href: crmHref, color: "bg-blue-100 text-blue-600", description: "Gestão de leads e clientes" },
    { id: "inbox", name: "Inbox", icon: MessageSquare, href: "/xos/inbox", color: "bg-green-100 text-green-600", description: "Central de atendimento" },
    { id: "tickets", name: "Tickets", icon: Ticket, href: "/xos/tickets", color: "bg-orange-100 text-orange-600", description: "Suporte e chamados" },
    { id: "automations", name: "Automações", icon: Zap, href: "/xos/automations", color: "bg-violet-100 text-violet-600", description: "Workflows automáticos" },
    { id: "campaigns", name: "Campanhas", icon: Target, href: "/xos/campaigns", color: "bg-pink-100 text-pink-600", description: "Marketing automation" },
    { id: "sites", name: "Sites", icon: LayoutGrid, href: "/xos/sites", color: "bg-cyan-100 text-cyan-600", description: "Site builder" },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-100 text-blue-800",
      contacted: "bg-indigo-100 text-indigo-800",
      qualified: "bg-violet-100 text-violet-800",
      proposal: "bg-purple-100 text-purple-800",
      won: "bg-green-100 text-green-800",
      lost: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStageColor = (color: string | null) => {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-500",
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      red: "bg-red-500",
      purple: "bg-purple-500",
      indigo: "bg-indigo-500",
      pink: "bg-pink-500",
      orange: "bg-orange-500",
      cyan: "bg-cyan-500",
      emerald: "bg-emerald-500",
      violet: "bg-violet-500",
      slate: "bg-slate-500",
    };
    return colorMap[color || 'slate'] || "bg-slate-500";
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, any> = {
      call: Phone,
      email: Mail,
      meeting: Calendar,
      task: Target,
    };
    return icons[type] || Calendar;
  };

  return (
    <BrowserFrame>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2 rounded-xl shadow-lg">
                <LayoutGrid className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  XOS
                </h1>
                <p className="text-xs text-slate-500">Experience Operating System</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Buscar contatos, deals, tickets..." 
                  className="w-80 pl-10 bg-white/80"
                  data-testid="input-search"
                />
              </div>
              <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                <Bell className="h-5 w-5" />
                {stats && stats.overdue_activities > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {stats.overdue_activities}
                  </span>
                )}
              </Button>
              <Button data-testid="button-new-contact">
                <PlusCircle className="h-4 w-4 mr-2" />
                Novo
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="contacts" data-testid="tab-contacts">Contatos</TabsTrigger>
            <TabsTrigger value="deals" data-testid="tab-deals">Negócios</TabsTrigger>
            <TabsTrigger value="activities" data-testid="tab-activities">Atividades</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white" data-testid="card-contacts">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Contatos</p>
                      <p className="text-3xl font-bold">{stats?.total_contacts || 0}</p>
                    </div>
                    <Users className="h-10 w-10 text-blue-200" />
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-blue-100">{stats?.total_leads || 0} leads</span>
                    <span>•</span>
                    <span className="text-blue-100">{stats?.total_customers || 0} clientes</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white" data-testid="card-pipeline">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-100 text-sm">Pipeline</p>
                      <p className="text-3xl font-bold">{formatCurrency(Number(stats?.pipeline_value) || 0)}</p>
                    </div>
                    <TrendingUp className="h-10 w-10 text-emerald-200" />
                  </div>
                  <div className="mt-2 text-sm text-emerald-100">
                    {stats?.open_deals || 0} negócios abertos
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white" data-testid="card-conversations">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-violet-100 text-sm">Conversas</p>
                      <p className="text-3xl font-bold">{stats?.open_conversations || 0}</p>
                    </div>
                    <MessageSquare className="h-10 w-10 text-violet-200" />
                  </div>
                  <div className="mt-2 text-sm text-violet-100">
                    atendimentos em aberto
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white" data-testid="card-tickets">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm">Tickets</p>
                      <p className="text-3xl font-bold">{stats?.open_tickets || 0}</p>
                    </div>
                    <Ticket className="h-10 w-10 text-orange-200" />
                  </div>
                  <div className="mt-2 text-sm text-orange-100">
                    chamados pendentes
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Modules Grid */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Módulos XOS</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {modules.map((mod) => (
                  <Link key={mod.id} href={mod.href}>
                    <Card className="hover:shadow-lg transition-all cursor-pointer group" data-testid={`card-module-${mod.id}`}>
                      <CardContent className="p-4 text-center">
                        <div className={`mx-auto w-12 h-12 rounded-xl ${mod.color.split(' ')[0]} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                          <mod.icon className={`h-6 w-6 ${mod.color.split(' ')[1]}`} />
                        </div>
                        <p className="font-medium text-slate-800">{mod.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{mod.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

            {/* SOE-06: Dois Eixos SOE/XOS */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Plataforma Arcádia</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 hover:shadow-md transition-shadow" data-testid="card-eixo-soe">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-blue-800">Eixo SOE</h3>
                        <p className="text-xs text-blue-600 font-medium">Sistema Operacional Empresarial</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">Cadastro unificado de pessoas, produtos, financeiro, fiscal e operações. A inteligência que governa a empresa.</p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {["Pessoas", "Produtos", "Financeiro", "Fiscal", "Compras"].map(m => (
                        <span key={m} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{m}</span>
                      ))}
                    </div>
                    <Link href="/soe">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-go-soe">
                        Acessar SOE <ArrowUpRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
                <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 hover:shadow-md transition-shadow" data-testid="card-eixo-xos">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-violet-600 p-2 rounded-lg shadow-sm">
                        <Users className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-violet-800">Eixo XOS</h3>
                        <p className="text-xs text-violet-600 font-medium">Experience Operating System</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">CRM, atendimento, automações e comunicação. A experiência do cliente que gera receita e fideliza.</p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {["CRM", "Inbox", "Tickets", "Automações", "Campanhas"].map(m => (
                        <span key={m} className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{m}</span>
                      ))}
                    </div>
                    <Link href="/xos">
                      <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" data-testid="button-go-xos">
                        Acessar XOS <ArrowUpRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Recent Items */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Contacts */}
              <Card data-testid="card-recent-contacts">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Contatos Recentes</CardTitle>
                    <Link href="/xos/crm">
                      <Button variant="ghost" size="sm">
                        Ver todos <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {contacts.slice(0, 5).map((contact) => (
                      <div key={contact.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors" data-testid={`row-contact-${contact.id}`}>
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                            {contact.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">{contact.name}</p>
                          <p className="text-sm text-slate-500 truncate">{contact.company} • {contact.position}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge className={getStatusColor(contact.lead_status)}>{contact.lead_status}</Badge>
                          {contact.pessoa_soe_id && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs border-emerald-200">SOE</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {contacts.length === 0 && (
                      <p className="text-center text-slate-500 py-4">Nenhum contato ainda</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Deals */}
              <Card data-testid="card-recent-deals">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Negócios Recentes</CardTitle>
                    <Link href="/xos/crm">
                      <Button variant="ghost" size="sm">
                        Ver todos <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {deals.slice(0, 5).map((deal) => (
                      <div key={deal.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors" data-testid={`row-deal-${deal.id}`}>
                        <div className={`w-2 h-10 rounded-full ${getStageColor(deal.stage_color)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">{deal.title}</p>
                          <p className="text-sm text-slate-500 truncate">{deal.contact_name || deal.company_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-emerald-600">{formatCurrency(deal.value)}</p>
                          <p className="text-xs text-slate-500">{deal.stage_name}</p>
                        </div>
                      </div>
                    ))}
                    {deals.length === 0 && (
                      <p className="text-center text-slate-500 py-4">Nenhum negócio ainda</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activities */}
            <Card data-testid="card-activities">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Atividades Pendentes</CardTitle>
                  <Button variant="ghost" size="sm">
                    Ver todas <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activities.slice(0, 6).map((activity) => {
                    const Icon = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg" data-testid={`row-activity-${activity.id}`}>
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <Icon className="h-4 w-4 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">{activity.title}</p>
                          <p className="text-xs text-slate-500">{activity.contact_name}</p>
                          {activity.due_at && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                              <Clock className="h-3 w-3" />
                              {new Date(activity.due_at).toLocaleDateString("pt-BR")}
                            </div>
                          )}
                        </div>
                        <Badge variant={activity.priority === "high" ? "destructive" : "secondary"} className="text-xs">
                          {activity.priority}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                {activities.length === 0 && (
                  <p className="text-center text-slate-500 py-4">Nenhuma atividade pendente</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Todos os Contatos</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filtros
                    </Button>
                    <Button size="sm">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Novo Contato
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg border transition-colors" data-testid={`row-contact-full-${contact.id}`}>
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-lg">
                          {contact.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{contact.name}</p>
                        <p className="text-sm text-slate-500">{contact.company} • {contact.position}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">{contact.email}</p>
                        <p className="text-sm text-slate-500">{contact.phone}</p>
                      </div>
                      <Badge className={getStatusColor(contact.lead_status)}>{contact.lead_status}</Badge>
                      <Badge variant="outline">{contact.source}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deals">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Pipeline de Vendas</CardTitle>
                  <Link href="/xos/crm">
                    <Button>
                      Abrir Pipeline <ArrowUpRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
                <CardDescription>Visualize e gerencie todos os seus negócios no modo Kanban</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {deals.map((deal) => (
                    <div key={deal.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg border transition-colors" data-testid={`row-deal-full-${deal.id}`}>
                      <div className={`w-2 h-12 rounded-full ${getStageColor(deal.stage_color)}`} />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{deal.title}</p>
                        <p className="text-sm text-slate-500">{deal.contact_name} • {deal.company_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-emerald-600">{formatCurrency(deal.value)}</p>
                        <p className="text-sm text-slate-500">{deal.stage_name}</p>
                      </div>
                      <Badge className={getStatusColor(deal.status)}>{deal.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activities">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Atividades</CardTitle>
                  <Button size="sm">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Nova Atividade
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activities.map((activity) => {
                    const Icon = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg border transition-colors" data-testid={`row-activity-full-${activity.id}`}>
                        <div className="p-3 bg-slate-100 rounded-lg">
                          <Icon className="h-5 w-5 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">{activity.title}</p>
                          <p className="text-sm text-slate-500">{activity.contact_name} {activity.deal_title && `• ${activity.deal_title}`}</p>
                        </div>
                        {activity.due_at && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <Calendar className="h-4 w-4" />
                            {new Date(activity.due_at).toLocaleDateString("pt-BR")}
                          </div>
                        )}
                        <Badge className={getStatusColor(activity.status)}>{activity.status}</Badge>
                        <Badge variant={activity.priority === "high" ? "destructive" : "secondary"}>
                          {activity.priority}
                        </Badge>
                      </div>
                    );
                  })}
                  {activities.length === 0 && (
                    <p className="text-center text-slate-500 py-8">Nenhuma atividade cadastrada</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
    </BrowserFrame>
  );
}
