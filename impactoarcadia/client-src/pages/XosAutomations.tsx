import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Zap, ArrowLeft, Search, Plus, MoreVertical, Play, Pause, Clock,
  Mail, MessageSquare, Bell, UserPlus, ShoppingCart, Calendar,
  GitBranch, ArrowRight, Settings, Trash2, Copy, Edit2, CheckCircle,
  AlertCircle, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface Automation {
  id: number;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: any;
  actions: any[];
  conditions: any;
  is_active: boolean;
  execution_count: number;
  last_executed_at: string;
  created_at: string;
}

export default function XosAutomations() {
  const [isNewAutomationOpen, setIsNewAutomationOpen] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState("");

  const { data: automations = [] } = useQuery<Automation[]>({
    queryKey: ["/api/xos/automations"],
    queryFn: async () => {
      const res = await fetch("/api/xos/automations");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const sampleAutomations: Automation[] = [
    {
      id: 1,
      name: "Boas-vindas Novo Lead",
      description: "Envia email de boas-vindas quando um novo lead é criado",
      trigger_type: "contact_created",
      trigger_config: { type: "lead" },
      actions: [
        { type: "send_email", template: "welcome_lead" },
        { type: "notify", channel: "slack" },
      ],
      conditions: { lead_status: "new" },
      is_active: true,
      execution_count: 245,
      last_executed_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 2592000000).toISOString(),
    },
    {
      id: 2,
      name: "Follow-up Proposta",
      description: "Agenda follow-up 3 dias após envio de proposta",
      trigger_type: "deal_stage_changed",
      trigger_config: { stage: "proposal" },
      actions: [
        { type: "wait", days: 3 },
        { type: "create_activity", activity_type: "call" },
        { type: "notify", assignee: true },
      ],
      conditions: {},
      is_active: true,
      execution_count: 89,
      last_executed_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date(Date.now() - 1296000000).toISOString(),
    },
    {
      id: 3,
      name: "Alerta SLA Ticket",
      description: "Notifica quando ticket está próximo do SLA",
      trigger_type: "ticket_sla_warning",
      trigger_config: { warning_threshold: 2 },
      actions: [
        { type: "notify", channel: "email" },
        { type: "notify", channel: "slack" },
        { type: "escalate", to: "manager" },
      ],
      conditions: {},
      is_active: true,
      execution_count: 32,
      last_executed_at: new Date(Date.now() - 7200000).toISOString(),
      created_at: new Date(Date.now() - 604800000).toISOString(),
    },
    {
      id: 4,
      name: "Reengajamento Inativo",
      description: "Envia campanha para clientes inativos há 30 dias",
      trigger_type: "scheduled",
      trigger_config: { cron: "0 9 * * 1" },
      actions: [
        { type: "segment", query: { inactive_days: 30 } },
        { type: "send_email", template: "reengagement" },
      ],
      conditions: {},
      is_active: false,
      execution_count: 5,
      last_executed_at: new Date(Date.now() - 604800000).toISOString(),
      created_at: new Date(Date.now() - 1728000000).toISOString(),
    },
  ];

  const displayAutomations = automations.length > 0 ? automations : sampleAutomations;

  const triggers = [
    { id: "contact_created", name: "Novo Contato", icon: UserPlus, description: "Quando um contato é criado" },
    { id: "deal_created", name: "Novo Negócio", icon: ShoppingCart, description: "Quando um deal é criado" },
    { id: "deal_stage_changed", name: "Mudança de Estágio", icon: GitBranch, description: "Quando deal muda de estágio" },
    { id: "deal_won", name: "Negócio Fechado", icon: CheckCircle, description: "Quando deal é ganho" },
    { id: "ticket_created", name: "Novo Ticket", icon: AlertCircle, description: "Quando ticket é aberto" },
    { id: "ticket_sla_warning", name: "Alerta SLA", icon: Clock, description: "Quando SLA está próximo" },
    { id: "message_received", name: "Mensagem Recebida", icon: MessageSquare, description: "Quando recebe mensagem" },
    { id: "scheduled", name: "Agendamento", icon: Calendar, description: "Em horário específico" },
  ];

  const actions = [
    { id: "send_email", name: "Enviar Email", icon: Mail },
    { id: "send_whatsapp", name: "Enviar WhatsApp", icon: MessageSquare },
    { id: "notify", name: "Notificar", icon: Bell },
    { id: "create_activity", name: "Criar Atividade", icon: Calendar },
    { id: "wait", name: "Aguardar", icon: Clock },
    { id: "update_field", name: "Atualizar Campo", icon: Edit2 },
  ];

  const getTriggerInfo = (triggerType: string) => {
    return triggers.find((t) => t.id === triggerType) || triggers[0];
  };

  const stats = {
    total: displayAutomations.length,
    active: displayAutomations.filter((a) => a.is_active).length,
    executions: displayAutomations.reduce((sum, a) => sum + a.execution_count, 0),
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
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-2 rounded-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Automações</h1>
                <p className="text-xs text-slate-500">Workflows Automáticos</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Buscar automações..." className="w-64 pl-10" data-testid="input-search" />
            </div>

            <Dialog open={isNewAutomationOpen} onOpenChange={setIsNewAutomationOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-automation">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Automação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Criar Automação</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-sm text-slate-500 mb-4">Escolha o gatilho que vai iniciar a automação:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {triggers.map((trigger) => (
                      <Card
                        key={trigger.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedTrigger === trigger.id ? "ring-2 ring-violet-500 bg-violet-50" : ""
                        }`}
                        onClick={() => setSelectedTrigger(trigger.id)}
                        data-testid={`trigger-${trigger.id}`}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-violet-100">
                            <trigger.icon className="h-5 w-5 text-violet-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{trigger.name}</p>
                            <p className="text-xs text-slate-500">{trigger.description}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {selectedTrigger && (
                    <Button className="w-full mt-4" data-testid="button-continue">
                      Continuar
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card data-testid="stat-total">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
                </div>
                <Zap className="h-8 w-8 text-slate-400" />
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
          <Card className="bg-violet-50 border-violet-200" data-testid="stat-executions">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-violet-700">Execuções</p>
                  <p className="text-3xl font-bold text-violet-800">{stats.executions}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-violet-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {displayAutomations.map((automation) => {
            const triggerInfo = getTriggerInfo(automation.trigger_type);
            const TriggerIcon = triggerInfo.icon;

            return (
              <Card key={automation.id} className="hover:shadow-md transition-shadow" data-testid={`automation-${automation.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${automation.is_active ? "bg-violet-100" : "bg-gray-100"}`}>
                        <TriggerIcon className={`h-6 w-6 ${automation.is_active ? "text-violet-600" : "text-gray-400"}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-800">{automation.name}</h3>
                          <Badge variant={automation.is_active ? "default" : "secondary"}>
                            {automation.is_active ? "Ativa" : "Pausada"}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">{automation.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {automation.execution_count} execuções
                          </div>
                          {automation.last_executed_at && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Última: {new Date(automation.last_executed_at).toLocaleDateString("pt-BR")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg">
                        <span className="text-xs text-slate-500">
                          {triggerInfo.name}
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-500">
                          {automation.actions?.length || 0} ações
                        </span>
                      </div>

                      <Switch checked={automation.is_active} />

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Edit2 className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem><Copy className="h-4 w-4 mr-2" /> Duplicar</DropdownMenuItem>
                          <DropdownMenuItem><Settings className="h-4 w-4 mr-2" /> Configurar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {displayAutomations.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Zap className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-800">Nenhuma automação criada</h3>
              <p className="text-slate-500 mt-1">Automatize tarefas repetitivas e ganhe produtividade</p>
              <Button className="mt-4" onClick={() => setIsNewAutomationOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Automação
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
