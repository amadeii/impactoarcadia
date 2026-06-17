import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Ticket, ArrowLeft, Search, Filter, Plus, MoreVertical, Clock, User,
  AlertCircle, CheckCircle, XCircle, MessageSquare, Calendar, Tag,
  ChevronDown, SortAsc, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TicketData {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  contact_id: number;
  contact_name: string;
  contact_email: string;
  assigned_to: string;
  sla_due_at: string;
  first_response_at: string;
  resolved_at: string;
  created_at: string;
  updated_at: string;
}

export default function XosTickets() {
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    category: "",
    priority: "normal",
  });

  const { data: tickets = [] } = useQuery<TicketData[]>({
    queryKey: ["/api/xos/tickets"],
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/xos/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xos/tickets"] });
      setIsNewTicketOpen(false);
      setNewTicket({ subject: "", description: "", category: "", priority: "normal" });
    },
  });

  const sampleTickets: TicketData[] = [
    {
      id: 1,
      ticket_number: "TK-001",
      subject: "Erro ao emitir NF-e",
      description: "Ao tentar emitir uma NF-e, o sistema retorna erro de certificado digital.",
      category: "Fiscal",
      priority: "high",
      status: "open",
      contact_id: 1,
      contact_name: "João Silva",
      contact_email: "joao@empresa.com",
      assigned_to: "",
      sla_due_at: new Date(Date.now() + 7200000).toISOString(),
      first_response_at: "",
      resolved_at: "",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 2,
      ticket_number: "TK-002",
      subject: "Dúvida sobre relatórios",
      description: "Preciso de ajuda para configurar um relatório personalizado de vendas.",
      category: "Relatórios",
      priority: "normal",
      status: "pending",
      contact_id: 2,
      contact_name: "Maria Santos",
      contact_email: "maria@startup.com",
      assigned_to: "",
      sla_due_at: new Date(Date.now() + 86400000).toISOString(),
      first_response_at: new Date(Date.now() - 1200000).toISOString(),
      resolved_at: "",
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: 3,
      ticket_number: "TK-003",
      subject: "Solicitação de treinamento",
      description: "Gostaríamos de agendar um treinamento para a equipe sobre o módulo ERP.",
      category: "Treinamento",
      priority: "low",
      status: "resolved",
      contact_id: 3,
      contact_name: "Carlos Oliveira",
      contact_email: "carlos@industria.com",
      assigned_to: "",
      sla_due_at: "",
      first_response_at: new Date(Date.now() - 86400000).toISOString(),
      resolved_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 172800000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  const displayTickets = tickets.length > 0 ? tickets : sampleTickets;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-yellow-100 text-yellow-800 border-yellow-300",
      pending: "bg-blue-100 text-blue-800 border-blue-300",
      in_progress: "bg-indigo-100 text-indigo-800 border-indigo-300",
      resolved: "bg-green-100 text-green-800 border-green-300",
      closed: "bg-gray-100 text-gray-800 border-gray-300",
    };
    return colors[status] || colors.open;
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      open: AlertCircle,
      pending: Clock,
      in_progress: RefreshCw,
      resolved: CheckCircle,
      closed: XCircle,
    };
    return icons[status] || AlertCircle;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: "bg-red-500 text-white",
      high: "bg-orange-500 text-white",
      normal: "bg-blue-500 text-white",
      low: "bg-gray-400 text-white",
    };
    return colors[priority] || colors.normal;
  };

  const formatTime = (date: string) => {
    if (!date) return "-";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return "Agora";
    if (hours < 24) return `${hours}h atrás`;
    if (hours < 48) return "Ontem";
    return d.toLocaleDateString("pt-BR");
  };

  const filteredTickets = displayTickets.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const stats = {
    open: displayTickets.filter((t) => t.status === "open").length,
    pending: displayTickets.filter((t) => t.status === "pending").length,
    resolved: displayTickets.filter((t) => t.status === "resolved").length,
    total: displayTickets.length,
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
              <div className="bg-gradient-to-br from-orange-500 to-red-500 p-2 rounded-lg">
                <Ticket className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Tickets</h1>
                <p className="text-xs text-slate-500">Central de Suporte e Chamados</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Buscar tickets..." className="w-64 pl-10" data-testid="input-search" />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36" data-testid="filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-36" data-testid="filter-priority">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-ticket">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Novo Ticket</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Assunto *</Label>
                    <Input
                      placeholder="Descreva brevemente o problema"
                      value={newTicket.subject}
                      onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                      data-testid="input-ticket-subject"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select
                        value={newTicket.category}
                        onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}
                      >
                        <SelectTrigger data-testid="select-ticket-category">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fiscal">Fiscal</SelectItem>
                          <SelectItem value="ERP">ERP</SelectItem>
                          <SelectItem value="Financeiro">Financeiro</SelectItem>
                          <SelectItem value="Relatórios">Relatórios</SelectItem>
                          <SelectItem value="Treinamento">Treinamento</SelectItem>
                          <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Prioridade</Label>
                      <Select
                        value={newTicket.priority}
                        onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}
                      >
                        <SelectTrigger data-testid="select-ticket-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgent">Urgente</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="low">Baixa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      placeholder="Descreva detalhadamente o problema ou solicitação..."
                      rows={4}
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                      data-testid="input-ticket-description"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createTicketMutation.mutate(newTicket)}
                    disabled={!newTicket.subject || createTicketMutation.isPending}
                    data-testid="button-save-ticket"
                  >
                    {createTicketMutation.isPending ? "Criando..." : "Criar Ticket"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-yellow-50 border-yellow-200" data-testid="stat-open">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-700">Abertos</p>
                  <p className="text-3xl font-bold text-yellow-800">{stats.open}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200" data-testid="stat-pending">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Pendentes</p>
                  <p className="text-3xl font-bold text-blue-800">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200" data-testid="stat-resolved">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Resolvidos</p>
                  <p className="text-3xl font-bold text-green-800">{stats.resolved}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200" data-testid="stat-total">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-700">Total</p>
                  <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
                </div>
                <Ticket className="h-8 w-8 text-slate-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Lista de Tickets</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="divide-y">
                    {filteredTickets.map((ticket) => {
                      const StatusIcon = getStatusIcon(ticket.status);
                      return (
                        <div
                          key={ticket.id}
                          onClick={() => setSelectedTicket(ticket)}
                          className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${
                            selectedTicket?.id === ticket.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                          }`}
                          data-testid={`ticket-${ticket.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(ticket.status)}`}>
                              <StatusIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-slate-500">{ticket.ticket_number}</span>
                                <Badge className={getPriorityColor(ticket.priority)} variant="secondary">
                                  {ticket.priority}
                                </Badge>
                                {ticket.category && (
                                  <Badge variant="outline">{ticket.category}</Badge>
                                )}
                              </div>
                              <p className="font-medium text-slate-800 truncate">{ticket.subject}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {ticket.contact_name}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(ticket.created_at)}
                                </div>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Atribuir</DropdownMenuItem>
                                <DropdownMenuItem>Alterar status</DropdownMenuItem>
                                <DropdownMenuItem>Fechar ticket</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {selectedTicket && (
            <div className="w-96 flex-shrink-0">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{selectedTicket.ticket_number}</CardTitle>
                    <Badge className={getStatusColor(selectedTicket.status)}>
                      {selectedTicket.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-2">{selectedTicket.subject}</h3>
                    <p className="text-sm text-slate-600">{selectedTicket.description}</p>
                  </div>

                  <div className="pt-4 border-t space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Solicitante</span>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-blue-100 text-blue-600">
                            {selectedTicket.contact_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{selectedTicket.contact_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Categoria</span>
                      <span className="font-medium">{selectedTicket.category || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Prioridade</span>
                      <Badge className={getPriorityColor(selectedTicket.priority)}>
                        {selectedTicket.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Criado em</span>
                      <span className="font-medium">
                        {new Date(selectedTicket.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <Button className="w-full" variant="outline">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Responder
                    </Button>
                    <Button className="w-full" variant="outline">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Resolver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
