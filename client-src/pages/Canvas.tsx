import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  ChevronLeft, Home, Lightbulb, Users, Target, Briefcase, 
  Sparkles, TrendingUp, DollarSign, Loader2, Save, ArrowLeft,
  Building2, FileText, CheckCircle2, AlertCircle, Layers
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface CanvasBlock {
  id: number;
  projectId: number;
  blockType: string;
  level: string;
  title: string | null;
  content: string | null;
  notes: string | null;
  score: number;
  synthesis: string | null;
}

interface Project {
  id: number;
  name: string;
  clientId: number | null;
  tenantId: number;
  projectType: string;
  status: string;
}

interface Client {
  id: number;
  name: string;
  segment?: string;
}

const CANVAS_LEVELS = [
  { id: "intencao", label: "Intenção", description: "O que pretendemos fazer" },
  { id: "evidencias", label: "Evidências", description: "O que temos de concreto" },
  { id: "sistemico", label: "Sistêmico", description: "Como está organizado" },
  { id: "transformacao", label: "Transformação", description: "O que queremos mudar" },
];

const CANVAS_BLOCK_TYPES = [
  { key: "key_partners", title: "Parceiros-Chave", icon: Users, description: "Quem são os principais parceiros e fornecedores?", color: "bg-purple-50 border-purple-200" },
  { key: "key_activities", title: "Atividades-Chave", icon: Target, description: "Quais as atividades essenciais do negócio?", color: "bg-blue-50 border-blue-200" },
  { key: "key_resources", title: "Recursos-Chave", icon: Briefcase, description: "Quais recursos são necessários?", color: "bg-indigo-50 border-indigo-200" },
  { key: "value_propositions", title: "Proposta de Valor", icon: Sparkles, description: "Qual valor único entregamos aos clientes?", color: "bg-yellow-50 border-yellow-200" },
  { key: "customer_relationships", title: "Relacionamento", icon: Users, description: "Como nos relacionamos com os clientes?", color: "bg-pink-50 border-pink-200" },
  { key: "channels", title: "Canais", icon: TrendingUp, description: "Por quais canais alcançamos os clientes?", color: "bg-green-50 border-green-200" },
  { key: "customer_segments", title: "Segmentos de Clientes", icon: Users, description: "Para quem criamos valor?", color: "bg-orange-50 border-orange-200" },
  { key: "cost_structure", title: "Estrutura de Custos", icon: DollarSign, description: "Quais são os principais custos?", color: "bg-red-50 border-red-200" },
  { key: "revenue_streams", title: "Fontes de Receita", icon: DollarSign, description: "Como geramos receita?", color: "bg-emerald-50 border-emerald-200" },
];

export default function Canvas() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState("intencao");
  const [editingBlock, setEditingBlock] = useState<CanvasBlock | null>(null);
  const [blockFormData, setBlockFormData] = useState({
    title: "",
    content: "",
    notes: "",
    score: 50,
    synthesis: ""
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/compass/projects"],
    queryFn: async () => {
      const res = await fetch("/api/compass/projects", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/crm/clients"],
    queryFn: async () => {
      const res = await fetch("/api/crm/clients", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedClient = selectedProject ? clients.find(c => c.id === selectedProject.clientId) : null;

  const { data: canvasBlocks = [], isLoading: loadingBlocks } = useQuery<CanvasBlock[]>({
    queryKey: ["/api/compass/projects", selectedProjectId, "canvas"],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/compass/projects/${selectedProjectId}/canvas`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const upsertBlockMutation = useMutation({
    mutationFn: async (data: { id?: number; blockType: string; level: string; title?: string; content?: string; notes?: string; score?: number; synthesis?: string }) => {
      if (data.id) {
        const res = await fetch(`/api/compass/canvas/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Falha ao atualizar bloco");
        return res.json();
      } else {
        const res = await fetch(`/api/compass/projects/${selectedProjectId}/canvas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Falha ao criar bloco");
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compass/projects", selectedProjectId, "canvas"] });
      setEditingBlock(null);
      toast({ title: "Bloco salvo com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar bloco", description: error.message, variant: "destructive" });
    }
  });

  const getBlockData = (blockType: string): CanvasBlock | undefined => {
    return canvasBlocks.find(b => b.blockType === blockType && b.level === selectedLevel);
  };

  const getScoreLevel = (score: number) => {
    if (score >= 80) return { label: "Excelente", color: "bg-emerald-500" };
    if (score >= 60) return { label: "Bom", color: "bg-blue-500" };
    if (score >= 40) return { label: "Intermediário", color: "bg-yellow-500" };
    return { label: "Inicial", color: "bg-red-500" };
  };

  const openBlockEditor = (blockType: string) => {
    const existing = getBlockData(blockType);
    const blockInfo = CANVAS_BLOCK_TYPES.find(b => b.key === blockType);
    if (existing) {
      setEditingBlock(existing);
      setBlockFormData({
        title: existing.title || blockInfo?.title || "",
        content: existing.content || "",
        notes: existing.notes || "",
        score: existing.score || 50,
        synthesis: existing.synthesis || ""
      });
    } else {
      setEditingBlock({
        id: 0,
        projectId: selectedProjectId!,
        blockType,
        level: selectedLevel,
        title: blockInfo?.title || "",
        content: "",
        notes: "",
        score: 50,
        synthesis: ""
      });
      setBlockFormData({
        title: blockInfo?.title || "",
        content: "",
        notes: "",
        score: 50,
        synthesis: ""
      });
    }
  };

  const saveBlock = () => {
    if (!editingBlock) return;
    upsertBlockMutation.mutate({
      id: editingBlock.id || undefined,
      blockType: editingBlock.blockType,
      level: editingBlock.id ? editingBlock.level : selectedLevel,
      title: blockFormData.title,
      content: blockFormData.content,
      notes: blockFormData.notes,
      score: blockFormData.score,
      synthesis: blockFormData.synthesis
    });
  };

  const levelBlocks = canvasBlocks.filter(b => b.level === selectedLevel);

  const calculateOverallScore = () => {
    if (levelBlocks.length === 0) return 0;
    const total = levelBlocks.reduce((sum, block) => sum + (block.score || 0), 0);
    return Math.round(total / CANVAS_BLOCK_TYPES.length);
  };

  const completedBlocks = levelBlocks.filter(b => b.content && b.content.length > 0).length;

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-slate-50">
        <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/compass")} data-testid="btn-back-compass">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Business Model Canvas</h1>
            </div>
          </div>
          
          <Select value={selectedProjectId?.toString() || ""} onValueChange={(v) => setSelectedProjectId(parseInt(v))}>
            <SelectTrigger className="w-[300px]" data-testid="select-project">
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(project => {
                const client = clients.find(c => c.id === project.clientId);
                return (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{project.name}</span>
                      {client && <span className="text-muted-foreground text-xs">({client.name})</span>}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {!selectedProjectId ? (
            <div className="flex items-center justify-center h-full">
              <Card className="max-w-md text-center p-8">
                <Layers className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                <h2 className="text-xl font-semibold text-slate-700 mb-2">Selecione um Projeto</h2>
                <p className="text-slate-500">Escolha um projeto no seletor acima para visualizar e editar o Business Model Canvas</p>
              </Card>
            </div>
          ) : loadingBlocks ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6">
              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {selectedProject?.name}
                      </CardTitle>
                      <CardDescription>
                        {selectedClient?.name} • {selectedClient?.segment || "Sem segmento"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{completedBlocks}/9</div>
                        <div className="text-xs text-muted-foreground">Blocos preenchidos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{calculateOverallScore()}%</div>
                        <div className="text-xs text-muted-foreground">Score geral</div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <div className="flex flex-wrap gap-2">
                {CANVAS_LEVELS.map(level => (
                  <Button
                    key={level.id}
                    variant={selectedLevel === level.id ? "default" : "outline"}
                    onClick={() => {
                      setSelectedLevel(level.id);
                      setEditingBlock(null);
                    }}
                    className="flex-1 min-w-[120px]"
                    data-testid={`btn-level-${level.id}`}
                  >
                    <div className="text-center">
                      <div className="font-medium text-sm">{level.label}</div>
                      <div className="text-xs opacity-70 hidden sm:block">{level.description}</div>
                    </div>
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-5 gap-3">
                {CANVAS_BLOCK_TYPES.slice(0, 4).map((block) => {
                  const data = getBlockData(block.key);
                  const score = data?.score || 0;
                  const scoreInfo = getScoreLevel(score);
                  return (
                    <Card 
                      key={block.key} 
                      className={`cursor-pointer hover:shadow-md transition-shadow ${block.color} border-2`}
                      onClick={() => openBlockEditor(block.key)}
                      data-testid={`canvas-block-${block.key}`}
                    >
                      <CardContent className="p-4 min-h-[140px]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <block.icon className="h-4 w-4 text-slate-600" />
                            <span className="text-sm font-medium">{block.title}</span>
                          </div>
                          {data && <div className={`w-2 h-2 rounded-full ${scoreInfo.color}`} />}
                        </div>
                        <p className="text-xs text-slate-500 mb-2">{block.description}</p>
                        {data?.content ? (
                          <p className="text-xs text-slate-700 line-clamp-3">{data.content}</p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Clique para preencher</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                
                <Card 
                  className={`cursor-pointer hover:shadow-md transition-shadow row-span-2 ${CANVAS_BLOCK_TYPES[3].color} border-2`}
                  onClick={() => openBlockEditor("value_propositions")}
                  data-testid="canvas-block-value_propositions"
                >
                  <CardContent className="p-4 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-slate-600" />
                      <span className="text-sm font-medium">Proposta de Valor</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">O valor único que entregamos</p>
                    {getBlockData("value_propositions")?.content ? (
                      <p className="text-xs text-slate-700 flex-1">{getBlockData("value_propositions")?.content}</p>
                    ) : (
                      <p className="text-xs text-slate-400 italic flex-1">Clique para preencher</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {CANVAS_BLOCK_TYPES.slice(4, 7).filter(b => b.key !== "value_propositions").map((block) => {
                  const data = getBlockData(block.key);
                  const score = data?.score || 0;
                  const scoreInfo = getScoreLevel(score);
                  return (
                    <Card 
                      key={block.key} 
                      className={`cursor-pointer hover:shadow-md transition-shadow ${block.color} border-2`}
                      onClick={() => openBlockEditor(block.key)}
                      data-testid={`canvas-block-${block.key}`}
                    >
                      <CardContent className="p-4 min-h-[100px]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <block.icon className="h-4 w-4 text-slate-600" />
                            <span className="text-sm font-medium">{block.title}</span>
                          </div>
                          {data && <div className={`w-2 h-2 rounded-full ${scoreInfo.color}`} />}
                        </div>
                        {data?.content ? (
                          <p className="text-xs text-slate-700 line-clamp-2">{data.content}</p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Clique para preencher</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {CANVAS_BLOCK_TYPES.slice(7).map((block) => {
                  const data = getBlockData(block.key);
                  const score = data?.score || 0;
                  const scoreInfo = getScoreLevel(score);
                  return (
                    <Card 
                      key={block.key} 
                      className={`cursor-pointer hover:shadow-md transition-shadow ${block.color} border-2`}
                      onClick={() => openBlockEditor(block.key)}
                      data-testid={`canvas-block-${block.key}`}
                    >
                      <CardContent className="p-4 min-h-[100px]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <block.icon className="h-4 w-4 text-slate-600" />
                            <span className="text-sm font-medium">{block.title}</span>
                          </div>
                          {data && <div className={`w-2 h-2 rounded-full ${scoreInfo.color}`} />}
                        </div>
                        <p className="text-xs text-slate-500 mb-2">{block.description}</p>
                        {data?.content ? (
                          <p className="text-xs text-slate-700 line-clamp-2">{data.content}</p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Clique para preencher</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <Dialog open={!!editingBlock} onOpenChange={(open) => !open && setEditingBlock(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingBlock && (() => {
                  const blockInfo = CANVAS_BLOCK_TYPES.find(b => b.key === editingBlock.blockType);
                  const Icon = blockInfo?.icon || Layers;
                  return (
                    <>
                      <Icon className="h-5 w-5" />
                      {blockInfo?.title || "Bloco do Canvas"}
                    </>
                  );
                })()}
                <Badge variant="secondary" className="ml-2">
                  {CANVAS_LEVELS.find(l => l.id === (editingBlock?.id ? editingBlock.level : selectedLevel))?.label}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {CANVAS_BLOCK_TYPES.find(b => b.key === editingBlock?.blockType)?.description}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 py-4">
                <div>
                  <Label>Conteúdo Principal</Label>
                  <Textarea 
                    value={blockFormData.content}
                    onChange={(e) => setBlockFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Descreva os elementos principais deste bloco..."
                    className="mt-1 min-h-[120px]"
                    data-testid="input-block-content"
                  />
                </div>

                <div>
                  <Label>Notas e Observações</Label>
                  <Textarea 
                    value={blockFormData.notes}
                    onChange={(e) => setBlockFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Adicione notas, referências ou observações..."
                    className="mt-1 min-h-[80px]"
                    data-testid="input-block-notes"
                  />
                </div>

                <div>
                  <Label>Síntese / Conclusão</Label>
                  <Textarea 
                    value={blockFormData.synthesis}
                    onChange={(e) => setBlockFormData(prev => ({ ...prev, synthesis: e.target.value }))}
                    placeholder="Resuma os principais insights deste bloco..."
                    className="mt-1 min-h-[60px]"
                    data-testid="input-block-synthesis"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Nível de Maturidade</Label>
                    <Badge variant="outline" className={getScoreLevel(blockFormData.score).color.replace('bg-', 'text-')}>
                      {blockFormData.score}% - {getScoreLevel(blockFormData.score).label}
                    </Badge>
                  </div>
                  <Slider 
                    value={[blockFormData.score]}
                    onValueChange={(v) => setBlockFormData(prev => ({ ...prev, score: v[0] }))}
                    max={100}
                    step={5}
                    className="mt-2"
                    data-testid="slider-block-score"
                  />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setEditingBlock(null)}>
                Cancelar
              </Button>
              <Button onClick={saveBlock} disabled={upsertBlockMutation.isPending} data-testid="btn-save-canvas-block">
                {upsertBlockMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
