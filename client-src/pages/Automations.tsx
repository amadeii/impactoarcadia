import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus,
  Play,
  Pause,
  Trash2,
  Settings,
  Clock,
  Zap,
  Webhook,
  Mail,
  MessageSquare,
  Bot,
  Database,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Calendar
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Automation {
  id: number;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfig: string | null;
  isActive: string | null;
  createdAt: string;
}

interface AutomationLog {
  id: number;
  status: string;
  result: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

const TRIGGER_TYPES = [
  { value: "schedule", label: "Agendamento", icon: Clock, description: "Executa em horários programados" },
  { value: "webhook", label: "Webhook", icon: Webhook, description: "Executa quando recebe uma requisição" },
  { value: "manual", label: "Manual", icon: Play, description: "Executa apenas quando você clicar" },
  { value: "event", label: "Evento", icon: Zap, description: "Executa quando algo acontece no sistema" },
];

const ACTION_TYPES = [
  { value: "agent_task", label: "Tarefa do Agente IA", icon: Bot, description: "Executa uma tarefa autônoma com o Agente" },
  { value: "send_notification", label: "Enviar Notificação", icon: AlertCircle, description: "Envia uma notificação interna" },
  { value: "send_email", label: "Enviar Email", icon: Mail, description: "Envia um email" },
  { value: "send_whatsapp", label: "Enviar WhatsApp", icon: MessageSquare, description: "Envia mensagem no WhatsApp" },
  { value: "erp_sync", label: "Sincronizar ERP", icon: Database, description: "Sincroniza dados com o ERP" },
  { value: "generate_report", label: "Gerar Relatório", icon: FileText, description: "Gera um relatório automático" },
  { value: "webhook", label: "Chamar Webhook", icon: Webhook, description: "Faz uma requisição HTTP" },
  { value: "database_backup", label: "Backup de Banco de Dados", icon: Database, description: "Executa backup de uma fonte de dados" },
];

async function fetchDataSources(): Promise<any[]> {
  const response = await fetch("/api/bi/data-sources", { credentials: "include" });
  if (!response.ok) return [];
  return response.json();
}

async function fetchAutomations(): Promise<Automation[]> {
  const response = await fetch("/api/automations", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch automations");
  return response.json();
}

async function createAutomation(data: any): Promise<Automation> {
  const response = await fetch("/api/automations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to create automation");
  return response.json();
}

async function deleteAutomation(id: number): Promise<void> {
  const response = await fetch(`/api/automations/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to delete automation");
}

async function toggleAutomation(id: number, isActive: boolean): Promise<void> {
  const response = await fetch(`/api/automations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive: isActive ? "true" : "false" }),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to toggle automation");
}

async function runAutomation(id: number): Promise<any> {
  const response = await fetch(`/api/automations/${id}/run`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to run automation");
  return response.json();
}

async function fetchAutomationLogs(id: number): Promise<AutomationLog[]> {
  const response = await fetch(`/api/automations/${id}/logs`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch logs");
  return response.json();
}

function CreateAutomationDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("manual");
  const [actionType, setActionType] = useState("agent_task");
  const [actionPrompt, setActionPrompt] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [selectedDataSource, setSelectedDataSource] = useState("");

  const { data: dataSources = [] } = useQuery({
    queryKey: ["data-sources"],
    queryFn: fetchDataSources,
  });

  const createMutation = useMutation({
    mutationFn: createAutomation,
    onSuccess: () => {
      setOpen(false);
      setName("");
      setDescription("");
      setTriggerType("manual");
      setActionType("agent_task");
      setActionPrompt("");
      setSelectedDataSource("");
      onCreated();
    },
  });

  const handleCreate = () => {
    if (!name.trim()) return;

    let actionConfig: any = {};
    if (actionType === "agent_task") {
      actionConfig = { prompt: actionPrompt };
    } else if (actionType === "database_backup" && selectedDataSource) {
      actionConfig = { dataSourceId: parseInt(selectedDataSource) };
    }

    createMutation.mutate({
      name,
      description,
      triggerType,
      actions: [
        {
          actionType,
          actionConfig,
        },
      ],
      schedule: triggerType === "schedule" ? { intervalMinutes: parseInt(intervalMinutes) } : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d]" data-testid="button-new-automation">
          <Plus className="w-4 h-4 mr-2" />
          Nova Automação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-[#1f334d] border-[#c89b3c]/30 text-white">
        <DialogHeader>
          <DialogTitle className="text-[#c89b3c]">Criar Nova Automação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm text-white/70 mb-1 block">Nome</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Relatório diário de vendas"
              className="bg-[#162638] border-white/20 text-white"
              data-testid="input-automation-name"
            />
          </div>
          <div>
            <label className="text-sm text-white/70 mb-1 block">Descrição (opcional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que esta automação faz..."
              className="bg-[#162638] border-white/20 text-white"
              data-testid="input-automation-description"
            />
          </div>
          <div>
            <label className="text-sm text-white/70 mb-2 block">Quando executar?</label>
            <div className="grid grid-cols-2 gap-2">
              {TRIGGER_TYPES.map((trigger) => (
                <button
                  key={trigger.value}
                  onClick={() => setTriggerType(trigger.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    triggerType === trigger.value
                      ? "border-[#c89b3c] bg-[#c89b3c]/20"
                      : "border-white/10 hover:border-white/30"
                  }`}
                  data-testid={`trigger-${trigger.value}`}
                >
                  <trigger.icon className={`w-5 h-5 mb-1 ${triggerType === trigger.value ? "text-[#c89b3c]" : "text-white/50"}`} />
                  <p className="text-sm font-medium">{trigger.label}</p>
                  <p className="text-xs text-white/50">{trigger.description}</p>
                </button>
              ))}
            </div>
          </div>
          {triggerType === "schedule" && (
            <div>
              <label className="text-sm text-white/70 mb-1 block">Intervalo (minutos)</label>
              <Input
                type="number"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(e.target.value)}
                placeholder="60"
                className="bg-[#162638] border-white/20 text-white"
                data-testid="input-interval"
              />
            </div>
          )}
          <div>
            <label className="text-sm text-white/70 mb-2 block">O que fazer?</label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger className="bg-[#162638] border-white/20 text-white" data-testid="select-action-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#162638] border-white/20">
                {ACTION_TYPES.map((action) => (
                  <SelectItem key={action.value} value={action.value} className="text-white">
                    <div className="flex items-center gap-2">
                      <action.icon className="w-4 h-4" />
                      {action.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {actionType === "agent_task" && (
            <div>
              <label className="text-sm text-white/70 mb-1 block">Instrução para o Agente</label>
              <textarea
                value={actionPrompt}
                onChange={(e) => setActionPrompt(e.target.value)}
                placeholder="Ex: Gere um relatório de vendas do dia anterior..."
                className="w-full h-24 bg-[#162638] border border-white/20 rounded-lg p-2.5 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-[#c89b3c] resize-none"
                data-testid="input-agent-prompt"
              />
            </div>
          )}
          {actionType === "database_backup" && (
            <div>
              <label className="text-sm text-white/70 mb-1 block">Fonte de Dados</label>
              <Select value={selectedDataSource} onValueChange={setSelectedDataSource}>
                <SelectTrigger className="bg-[#162638] border-white/20 text-white" data-testid="select-datasource">
                  <SelectValue placeholder="Selecione uma fonte de dados" />
                </SelectTrigger>
                <SelectContent className="bg-[#162638] border-white/20">
                  {dataSources.map((ds: any) => (
                    <SelectItem key={ds.id} value={ds.id.toString()} className="text-white">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        {ds.name} ({ds.type})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dataSources.length === 0 && (
                <p className="text-xs text-yellow-400 mt-2">
                  Nenhuma fonte de dados configurada. Acesse Insights para adicionar.
                </p>
              )}
            </div>
          )}
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createMutation.isPending}
            className="w-full bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d]"
            data-testid="button-create-automation"
          >
            {createMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" />Criar Automação</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AutomationCard({ automation, onRefresh }: { automation: Automation; onRefresh: () => void }) {
  const [showLogs, setShowLogs] = useState(false);
  const queryClient = useQueryClient();

  const { data: logs = [] } = useQuery({
    queryKey: ["automation-logs", automation.id],
    queryFn: () => fetchAutomationLogs(automation.id),
    enabled: showLogs,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAutomation(automation.id),
    onSuccess: onRefresh,
  });

  const toggleMutation = useMutation({
    mutationFn: () => toggleAutomation(automation.id, automation.isActive !== "true"),
    onSuccess: onRefresh,
  });

  const runMutation = useMutation({
    mutationFn: () => runAutomation(automation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-logs", automation.id] });
    },
  });

  const trigger = TRIGGER_TYPES.find((t) => t.value === automation.triggerType);
  const TriggerIcon = trigger?.icon || Zap;
  const isActive = automation.isActive === "true";

  return (
    <Card className="bg-[#1f334d] border-[#c89b3c]/20 hover:border-[#c89b3c]/40 transition-all" data-testid={`automation-card-${automation.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${isActive ? "bg-[#c89b3c]/20" : "bg-white/5"}`}>
              <TriggerIcon className={`w-5 h-5 ${isActive ? "text-[#c89b3c]" : "text-white/30"}`} />
            </div>
            <div>
              <h3 className="font-medium text-white">{automation.name}</h3>
              {automation.description && (
                <p className="text-sm text-white/50 mt-0.5">{automation.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-green-500/20 text-green-400" : ""}>
                  {isActive ? "Ativa" : "Inativa"}
                </Badge>
                <span className="text-xs text-white/40">{trigger?.label}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="h-8 w-8 text-white/50 hover:text-[#c89b3c] hover:bg-[#c89b3c]/10"
              title="Executar agora"
              data-testid={`run-automation-${automation.id}`}
            >
              {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleMutation.mutate()}
              className="h-8 w-8 text-white/50 hover:text-yellow-400 hover:bg-yellow-400/10"
              title={isActive ? "Pausar" : "Ativar"}
              data-testid={`toggle-automation-${automation.id}`}
            >
              {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowLogs(!showLogs)}
              className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
              title="Ver histórico"
              data-testid={`logs-automation-${automation.id}`}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${showLogs ? "rotate-90" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteMutation.mutate()}
              className="h-8 w-8 text-white/50 hover:text-red-400 hover:bg-red-400/10"
              title="Excluir"
              data-testid={`delete-automation-${automation.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {showLogs && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Histórico de Execuções</p>
            {logs.length === 0 ? (
              <p className="text-sm text-white/30">Nenhuma execução ainda</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {logs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center gap-2 text-sm">
                    {log.status === "completed" ? (
                      <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    ) : log.status === "error" ? (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-yellow-400 animate-spin shrink-0" />
                    )}
                    <span className="text-white/70 truncate flex-1">
                      {log.result || log.error || "Em execução..."}
                    </span>
                    <span className="text-xs text-white/30">
                      {new Date(log.startedAt).toLocaleString("pt-BR", { 
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" 
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Automations() {
  const queryClient = useQueryClient();

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["automations"],
    queryFn: fetchAutomations,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["automations"] });
  };

  return (
    <BrowserFrame>
      <div className="min-h-full bg-gradient-to-br from-[#f5f7fa] to-[#e8ecf1] p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-light text-[#1f334d]" style={{ fontFamily: 'Georgia, serif' }}>
                <span className="italic text-[#c89b3c]">Automações</span> Arcádia
              </h1>
              <p className="text-[#5a6c7d] text-sm mt-1">
                Configure tarefas automáticas com o poder do Agente IA
              </p>
            </div>
            <CreateAutomationDialog onCreated={handleRefresh} />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-[#1f334d] border-none">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 rounded-full bg-[#c89b3c]/20">
                  <Zap className="w-5 h-5 text-[#c89b3c]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{automations.length}</p>
                  <p className="text-xs text-white/50">Total de Automações</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#1f334d] border-none">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 rounded-full bg-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {automations.filter((a) => a.isActive === "true").length}
                  </p>
                  <p className="text-xs text-white/50">Ativas</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#1f334d] border-none">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-500/20">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {automations.filter((a) => a.triggerType === "schedule").length}
                  </p>
                  <p className="text-xs text-white/50">Agendadas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#c89b3c]" />
            </div>
          ) : automations.length === 0 ? (
            <Card className="bg-[#1f334d] border-[#c89b3c]/20">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-[#c89b3c]/20 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-[#c89b3c]" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Nenhuma automação criada</h3>
                <p className="text-white/50 text-sm mb-4">
                  Crie sua primeira automação para executar tarefas automaticamente
                </p>
                <CreateAutomationDialog onCreated={handleRefresh} />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {automations.map((automation) => (
                <AutomationCard key={automation.id} automation={automation} onRefresh={handleRefresh} />
              ))}
            </div>
          )}
        </div>
      </div>
    </BrowserFrame>
  );
}
