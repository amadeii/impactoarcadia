import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, Play, Pause, Trash2, Settings, GitBranch, 
  Mail, MessageSquare, Database, Clock, Zap, 
  FileText, Users, Bell, ArrowRight, Save,
  CheckCircle, XCircle, AlertTriangle
} from "lucide-react";

interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "delay";
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  nextNodes: string[];
}

interface Workflow {
  id: number;
  name: string;
  description: string;
  status: "active" | "inactive" | "draft";
  nodes: WorkflowNode[];
  createdAt: string;
}

const nodeTypes = {
  triggers: [
    { type: "trigger", subtype: "new_record", name: "Novo Registro", icon: Database, color: "bg-green-500" },
    { type: "trigger", subtype: "schedule", name: "Agendamento", icon: Clock, color: "bg-blue-500" },
    { type: "trigger", subtype: "webhook", name: "Webhook", icon: Zap, color: "bg-purple-500" },
    { type: "trigger", subtype: "form_submit", name: "Formulário Enviado", icon: FileText, color: "bg-orange-500" },
  ],
  actions: [
    { type: "action", subtype: "send_email", name: "Enviar Email", icon: Mail, color: "bg-red-500" },
    { type: "action", subtype: "send_whatsapp", name: "Enviar WhatsApp", icon: MessageSquare, color: "bg-green-600" },
    { type: "action", subtype: "create_record", name: "Criar Registro", icon: Database, color: "bg-blue-600" },
    { type: "action", subtype: "update_record", name: "Atualizar Registro", icon: Database, color: "bg-indigo-500" },
    { type: "action", subtype: "notify", name: "Notificar Usuário", icon: Bell, color: "bg-yellow-500" },
    { type: "action", subtype: "assign_user", name: "Atribuir a Usuário", icon: Users, color: "bg-pink-500" },
  ],
  conditions: [
    { type: "condition", subtype: "if_else", name: "Se/Senão", icon: GitBranch, color: "bg-gray-500" },
  ],
  delays: [
    { type: "delay", subtype: "wait", name: "Aguardar", icon: Clock, color: "bg-gray-400" },
  ]
};

export default function WorkflowBuilder() {
  const queryClient = useQueryClient();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ name: "", description: "" });
  const [draggedNode, setDraggedNode] = useState<any>(null);

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ["/api/lowcode/workflows"],
    queryFn: async () => {
      const res = await fetch("/api/lowcode/workflows");
      if (!res.ok) return [];
      return res.json();
    }
  });

  const createWorkflow = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await fetch("/api/lowcode/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, nodes: [], status: "draft" })
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lowcode/workflows"] });
      setSelectedWorkflow(data);
      setNodes([]);
      setShowNewDialog(false);
      setNewWorkflow({ name: "", description: "" });
    }
  });

  const saveWorkflow = useMutation({
    mutationFn: async () => {
      if (!selectedWorkflow) return;
      const res = await fetch(`/api/lowcode/workflows/${selectedWorkflow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lowcode/workflows"] });
    }
  });

  const handleDragStart = (e: React.DragEvent, nodeType: any) => {
    setDraggedNode(nodeType);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNode) return;

    const canvas = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - canvas.left;
    const y = e.clientY - canvas.top;

    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: draggedNode.type,
      name: draggedNode.name,
      config: { subtype: draggedNode.subtype },
      position: { x, y },
      nextNodes: []
    };

    setNodes([...nodes, newNode]);
    setDraggedNode(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const deleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  };

  const getNodeIcon = (node: WorkflowNode) => {
    const allNodes = [...nodeTypes.triggers, ...nodeTypes.actions, ...nodeTypes.conditions, ...nodeTypes.delays];
    const found = allNodes.find(n => n.subtype === node.config.subtype);
    return found || { icon: Zap, color: "bg-gray-500" };
  };

  return (
    <div className="h-full flex bg-gray-50">
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Workflow Builder</h2>
          <p className="text-sm text-gray-500">Automações visuais</p>
        </div>

        <div className="p-4 border-b">
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button className="w-full" data-testid="btn-new-workflow">
                <Plus className="w-4 h-4 mr-2" />
                Novo Workflow
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Workflow</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input 
                    value={newWorkflow.name}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                    placeholder="Nome do workflow"
                    data-testid="input-workflow-name"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea 
                    value={newWorkflow.description}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                    placeholder="Descreva o que este workflow faz"
                    data-testid="input-workflow-description"
                  />
                </div>
                <Button 
                  onClick={() => createWorkflow.mutate(newWorkflow)}
                  className="w-full"
                  data-testid="btn-create-workflow"
                >
                  Criar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase">Meus Workflows</h3>
            {workflows.map((wf) => (
              <div
                key={wf.id}
                onClick={() => {
                  setSelectedWorkflow(wf);
                  setNodes(wf.nodes || []);
                }}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedWorkflow?.id === wf.id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
                }`}
                data-testid={`workflow-item-${wf.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{wf.name}</span>
                  <Badge variant={wf.status === "active" ? "default" : "secondary"}>
                    {wf.status === "active" ? "Ativo" : wf.status === "draft" ? "Rascunho" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">{wf.description}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedWorkflow ? (
          <>
            <div className="bg-white border-b p-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{selectedWorkflow.name}</h2>
                <p className="text-sm text-gray-500">{selectedWorkflow.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => saveWorkflow.mutate()} data-testid="btn-save-workflow">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
                <Button variant="outline" data-testid="btn-test-workflow">
                  <Play className="w-4 h-4 mr-2" />
                  Testar
                </Button>
                <Button data-testid="btn-activate-workflow">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Ativar
                </Button>
              </div>
            </div>

            <div className="flex-1 flex">
              <div className="w-56 bg-white border-r p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Gatilhos</h3>
                <div className="space-y-2 mb-4">
                  {nodeTypes.triggers.map((node) => (
                    <div
                      key={node.subtype}
                      draggable
                      onDragStart={(e) => handleDragStart(e, node)}
                      className="p-2 bg-gray-50 rounded-lg cursor-move hover:bg-gray-100 flex items-center gap-2"
                    >
                      <div className={`p-1.5 rounded ${node.color}`}>
                        <node.icon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm">{node.name}</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Ações</h3>
                <div className="space-y-2 mb-4">
                  {nodeTypes.actions.map((node) => (
                    <div
                      key={node.subtype}
                      draggable
                      onDragStart={(e) => handleDragStart(e, node)}
                      className="p-2 bg-gray-50 rounded-lg cursor-move hover:bg-gray-100 flex items-center gap-2"
                    >
                      <div className={`p-1.5 rounded ${node.color}`}>
                        <node.icon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm">{node.name}</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Condições</h3>
                <div className="space-y-2 mb-4">
                  {nodeTypes.conditions.map((node) => (
                    <div
                      key={node.subtype}
                      draggable
                      onDragStart={(e) => handleDragStart(e, node)}
                      className="p-2 bg-gray-50 rounded-lg cursor-move hover:bg-gray-100 flex items-center gap-2"
                    >
                      <div className={`p-1.5 rounded ${node.color}`}>
                        <node.icon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm">{node.name}</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Tempo</h3>
                <div className="space-y-2">
                  {nodeTypes.delays.map((node) => (
                    <div
                      key={node.subtype}
                      draggable
                      onDragStart={(e) => handleDragStart(e, node)}
                      className="p-2 bg-gray-50 rounded-lg cursor-move hover:bg-gray-100 flex items-center gap-2"
                    >
                      <div className={`p-1.5 rounded ${node.color}`}>
                        <node.icon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm">{node.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div 
                className="flex-1 bg-gray-100 relative overflow-auto"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                style={{ 
                  backgroundImage: "radial-gradient(circle, #ddd 1px, transparent 1px)",
                  backgroundSize: "20px 20px"
                }}
              >
                {nodes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <Zap className="w-12 h-12 mx-auto mb-2" />
                      <p>Arraste os blocos da esquerda para criar seu workflow</p>
                    </div>
                  </div>
                )}

                {nodes.map((node, index) => {
                  const nodeInfo = getNodeIcon(node);
                  const Icon = nodeInfo.icon;
                  return (
                    <div
                      key={node.id}
                      className={`absolute bg-white rounded-lg shadow-lg p-3 cursor-pointer border-2 ${
                        selectedNode?.id === node.id ? "border-blue-500" : "border-transparent"
                      }`}
                      style={{ left: node.position.x, top: node.position.y, minWidth: 150 }}
                      onClick={() => setSelectedNode(node)}
                      data-testid={`workflow-node-${node.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded ${nodeInfo.color}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{node.name}</p>
                          <p className="text-xs text-gray-500">{node.type}</p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedNode && (
                <div className="w-72 bg-white border-l p-4">
                  <h3 className="font-semibold mb-4">Configurar: {selectedNode.name}</h3>
                  
                  {selectedNode.config.subtype === "send_email" && (
                    <div className="space-y-4">
                      <div>
                        <Label>Para</Label>
                        <Input placeholder="email@exemplo.com" />
                      </div>
                      <div>
                        <Label>Assunto</Label>
                        <Input placeholder="Assunto do email" />
                      </div>
                      <div>
                        <Label>Mensagem</Label>
                        <Textarea placeholder="Corpo do email" />
                      </div>
                    </div>
                  )}

                  {selectedNode.config.subtype === "send_whatsapp" && (
                    <div className="space-y-4">
                      <div>
                        <Label>Número</Label>
                        <Input placeholder="+55 11 99999-9999" />
                      </div>
                      <div>
                        <Label>Mensagem</Label>
                        <Textarea placeholder="Mensagem do WhatsApp" />
                      </div>
                    </div>
                  )}

                  {selectedNode.config.subtype === "schedule" && (
                    <div className="space-y-4">
                      <div>
                        <Label>Frequência</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">A cada hora</SelectItem>
                            <SelectItem value="daily">Diariamente</SelectItem>
                            <SelectItem value="weekly">Semanalmente</SelectItem>
                            <SelectItem value="monthly">Mensalmente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Horário</Label>
                        <Input type="time" />
                      </div>
                    </div>
                  )}

                  {selectedNode.config.subtype === "new_record" && (
                    <div className="space-y-4">
                      <div>
                        <Label>DocType</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customers">Clientes</SelectItem>
                            <SelectItem value="products">Produtos</SelectItem>
                            <SelectItem value="orders">Pedidos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedNode.config.subtype === "wait" && (
                    <div className="space-y-4">
                      <div>
                        <Label>Aguardar</Label>
                        <div className="flex gap-2">
                          <Input type="number" placeholder="5" className="w-20" />
                          <Select>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Unidade" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="minutes">Minutos</SelectItem>
                              <SelectItem value="hours">Horas</SelectItem>
                              <SelectItem value="days">Dias</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button className="w-full mt-4" onClick={() => setSelectedNode(null)}>
                    Aplicar
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <GitBranch className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum workflow selecionado</h3>
              <p>Crie um novo workflow ou selecione um existente</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
