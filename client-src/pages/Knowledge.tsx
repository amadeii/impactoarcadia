import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Network,
  Plus,
  Search,
  Database,
  GitBranch,
  CircleDot,
  ArrowRight,
  Loader2,
  Trash2,
  Eye,
  FileText,
  User,
  Building2,
  Package,
  Sparkles
} from "lucide-react";

interface GraphNode {
  id: number;
  type: string;
  label: string;
  properties: Record<string, any>;
  tenantId?: number;
  createdAt?: string;
}

interface GraphEdge {
  id: number;
  sourceId: number;
  targetId: number;
  type: string;
  properties?: Record<string, any>;
  weight?: number;
}

export default function Knowledge() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("nodes");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddNodeDialog, setShowAddNodeDialog] = useState(false);
  const [showAddEdgeDialog, setShowAddEdgeDialog] = useState(false);
  const [newNode, setNewNode] = useState({ type: "entity", label: "", properties: "{}" });
  const [newEdge, setNewEdge] = useState({ sourceId: "", targetId: "", type: "related_to", weight: "1" });

  const { data: nodes = [], isLoading: nodesLoading } = useQuery<GraphNode[]>({
    queryKey: ["/api/graph/nodes"],
  });

  const { data: edges = [], isLoading: edgesLoading } = useQuery<GraphEdge[]>({
    queryKey: ["/api/graph/edges"],
  });

  const addNodeMutation = useMutation({
    mutationFn: async (node: typeof newNode) => {
      const res = await fetch("/api/graph/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...node,
          properties: JSON.parse(node.properties)
        })
      });
      if (!res.ok) throw new Error("Erro ao criar nó");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graph/nodes"] });
      setShowAddNodeDialog(false);
      setNewNode({ type: "entity", label: "", properties: "{}" });
      toast({ title: "Nó criado!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar nó", variant: "destructive" });
    }
  });

  const addEdgeMutation = useMutation({
    mutationFn: async (edge: typeof newEdge) => {
      const res = await fetch("/api/graph/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: parseInt(edge.sourceId),
          targetId: parseInt(edge.targetId),
          type: edge.type,
          weight: parseFloat(edge.weight)
        })
      });
      if (!res.ok) throw new Error("Erro ao criar relação");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graph/edges"] });
      setShowAddEdgeDialog(false);
      setNewEdge({ sourceId: "", targetId: "", type: "related_to", weight: "1" });
      toast({ title: "Relação criada!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar relação", variant: "destructive" });
    }
  });

  const semanticSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch("/api/manus/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: `Buscar semanticamente: ${query}`,
          tools: ["semantic_search"]
        })
      });
      if (!res.ok) throw new Error("Erro na busca");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Busca concluída", description: `${data.results?.length || 0} resultados` });
    }
  });

  const getNodeIcon = (type: string) => {
    switch (type) {
      case "person": return <User className="w-4 h-4" />;
      case "company": return <Building2 className="w-4 h-4" />;
      case "document": return <FileText className="w-4 h-4" />;
      case "product": return <Package className="w-4 h-4" />;
      default: return <CircleDot className="w-4 h-4" />;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case "person": return "bg-blue-500/20 text-blue-300 border-blue-500/50";
      case "company": return "bg-purple-500/20 text-purple-300 border-purple-500/50";
      case "document": return "bg-green-500/20 text-green-300 border-green-500/50";
      case "product": return "bg-yellow-500/20 text-yellow-300 border-yellow-500/50";
      default: return "bg-gray-500/20 text-gray-300 border-gray-500/50";
    }
  };

  const filteredNodes = nodes.filter(node =>
    node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <BrowserFrame>
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#1a2942] to-[#0d1f35] p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl">
                <Network className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Grafo de Conhecimento</h1>
                <p className="text-white/60">Todos os dados do negócio conectados</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-cyan-300 border-cyan-500/50">
                {nodes.length} nós
              </Badge>
              <Badge variant="outline" className="text-blue-300 border-blue-500/50">
                {edges.length} relações
              </Badge>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no grafo..."
                className="pl-10 bg-white/5 border-white/20 text-white"
                data-testid="input-search-graph"
              />
            </div>
            <Button
              onClick={() => semanticSearchMutation.mutate(searchQuery)}
              disabled={!searchQuery || semanticSearchMutation.isPending}
              className="bg-gradient-to-r from-cyan-500 to-blue-500"
              data-testid="button-semantic-search"
            >
              {semanticSearchMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Busca Semântica
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-white/10 border-none">
              <TabsTrigger value="nodes" className="data-[state=active]:bg-cyan-500">
                <CircleDot className="w-4 h-4 mr-2" />
                Nós ({nodes.length})
              </TabsTrigger>
              <TabsTrigger value="edges" className="data-[state=active]:bg-cyan-500">
                <GitBranch className="w-4 h-4 mr-2" />
                Relações ({edges.length})
              </TabsTrigger>
              <TabsTrigger value="visualization" className="data-[state=active]:bg-cyan-500">
                <Network className="w-4 h-4 mr-2" />
                Visualização
              </TabsTrigger>
            </TabsList>

            <TabsContent value="nodes" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Nós do Grafo</h2>
                <Dialog open={showAddNodeDialog} onOpenChange={setShowAddNodeDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-cyan-500 hover:bg-cyan-600" data-testid="button-add-node">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Nó
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1a2942] border-white/20">
                    <DialogHeader>
                      <DialogTitle className="text-white">Novo Nó</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm text-white/80">Tipo</label>
                        <Select value={newNode.type} onValueChange={(v) => setNewNode({ ...newNode, type: v })}>
                          <SelectTrigger className="bg-white/5 border-white/20 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="entity">Entidade</SelectItem>
                            <SelectItem value="person">Pessoa</SelectItem>
                            <SelectItem value="company">Empresa</SelectItem>
                            <SelectItem value="document">Documento</SelectItem>
                            <SelectItem value="product">Produto</SelectItem>
                            <SelectItem value="process">Processo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-white/80">Rótulo</label>
                        <Input
                          value={newNode.label}
                          onChange={(e) => setNewNode({ ...newNode, label: e.target.value })}
                          placeholder="Nome do nó"
                          className="bg-white/5 border-white/20 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-white/80">Propriedades (JSON)</label>
                        <Textarea
                          value={newNode.properties}
                          onChange={(e) => setNewNode({ ...newNode, properties: e.target.value })}
                          placeholder='{"chave": "valor"}'
                          className="bg-white/5 border-white/20 text-white font-mono text-sm"
                        />
                      </div>
                      <Button
                        onClick={() => addNodeMutation.mutate(newNode)}
                        disabled={!newNode.label || addNodeMutation.isPending}
                        className="w-full bg-cyan-500"
                      >
                        {addNodeMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Criar Nó
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {nodesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredNodes.map((node) => (
                    <Card key={node.id} className="bg-white/5 border-white/10 hover:border-cyan-500/50 transition-colors">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${getNodeColor(node.type)}`}>
                              {getNodeIcon(node.type)}
                            </div>
                            <div>
                              <h3 className="text-white font-medium">{node.label}</h3>
                              <p className="text-white/60 text-sm">ID: {node.id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getNodeColor(node.type)}>
                              {node.type}
                            </Badge>
                            <Button size="sm" variant="ghost" className="text-white/60 hover:text-white">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {node.properties && Object.keys(node.properties).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(node.properties).slice(0, 3).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-white/60 border-white/20">
                                  {key}: {String(value).slice(0, 20)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {filteredNodes.length === 0 && (
                    <div className="text-center py-12 text-white/60">
                      <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum nó encontrado</p>
                      <p className="text-sm">Adicione nós ao grafo de conhecimento</p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="edges" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Relações</h2>
                <Dialog open={showAddEdgeDialog} onOpenChange={setShowAddEdgeDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-500 hover:bg-blue-600" data-testid="button-add-edge">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Relação
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1a2942] border-white/20">
                    <DialogHeader>
                      <DialogTitle className="text-white">Nova Relação</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm text-white/80">Nó de Origem</label>
                        <Select value={newEdge.sourceId} onValueChange={(v) => setNewEdge({ ...newEdge, sourceId: v })}>
                          <SelectTrigger className="bg-white/5 border-white/20 text-white">
                            <SelectValue placeholder="Selecione o nó de origem" />
                          </SelectTrigger>
                          <SelectContent>
                            {nodes.map((node) => (
                              <SelectItem key={node.id} value={String(node.id)}>
                                {node.label} ({node.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-white/80">Tipo de Relação</label>
                        <Select value={newEdge.type} onValueChange={(v) => setNewEdge({ ...newEdge, type: v })}>
                          <SelectTrigger className="bg-white/5 border-white/20 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="related_to">Relacionado a</SelectItem>
                            <SelectItem value="belongs_to">Pertence a</SelectItem>
                            <SelectItem value="works_at">Trabalha em</SelectItem>
                            <SelectItem value="owns">Possui</SelectItem>
                            <SelectItem value="created">Criou</SelectItem>
                            <SelectItem value="mentions">Menciona</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-white/80">Nó de Destino</label>
                        <Select value={newEdge.targetId} onValueChange={(v) => setNewEdge({ ...newEdge, targetId: v })}>
                          <SelectTrigger className="bg-white/5 border-white/20 text-white">
                            <SelectValue placeholder="Selecione o nó de destino" />
                          </SelectTrigger>
                          <SelectContent>
                            {nodes.map((node) => (
                              <SelectItem key={node.id} value={String(node.id)}>
                                {node.label} ({node.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-white/80">Peso (0-1)</label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={newEdge.weight}
                          onChange={(e) => setNewEdge({ ...newEdge, weight: e.target.value })}
                          className="bg-white/5 border-white/20 text-white"
                        />
                      </div>
                      <Button
                        onClick={() => addEdgeMutation.mutate(newEdge)}
                        disabled={!newEdge.sourceId || !newEdge.targetId || addEdgeMutation.isPending}
                        className="w-full bg-blue-500"
                      >
                        {addEdgeMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Criar Relação
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {edgesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {edges.map((edge) => {
                    const sourceNode = nodes.find(n => n.id === edge.sourceId);
                    const targetNode = nodes.find(n => n.id === edge.targetId);
                    return (
                      <Card key={edge.id} className="bg-white/5 border-white/10 hover:border-blue-500/50 transition-colors">
                        <CardContent className="py-4">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 flex-1">
                              <div className={`p-2 rounded-lg ${getNodeColor(sourceNode?.type || 'entity')}`}>
                                {getNodeIcon(sourceNode?.type || 'entity')}
                              </div>
                              <span className="text-white font-medium">{sourceNode?.label || `ID ${edge.sourceId}`}</span>
                            </div>
                            <div className="flex items-center gap-2 text-white/60">
                              <ArrowRight className="w-4 h-4" />
                              <Badge variant="outline" className="border-blue-500/50 text-blue-300">
                                {edge.type}
                              </Badge>
                              <ArrowRight className="w-4 h-4" />
                            </div>
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <span className="text-white font-medium">{targetNode?.label || `ID ${edge.targetId}`}</span>
                              <div className={`p-2 rounded-lg ${getNodeColor(targetNode?.type || 'entity')}`}>
                                {getNodeIcon(targetNode?.type || 'entity')}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {edges.length === 0 && (
                    <div className="text-center py-12 text-white/60">
                      <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma relação encontrada</p>
                      <p className="text-sm">Conecte nós para criar relações</p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="visualization" className="space-y-4">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Network className="w-5 h-5 text-cyan-400" />
                    Visualização do Grafo
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Representação visual das conexões entre entidades
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px] bg-black/30 rounded-lg flex items-center justify-center border border-white/10">
                    <div className="text-center text-white/60">
                      <Network className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">Visualização Interativa</p>
                      <p className="text-sm">
                        {nodes.length} nós e {edges.length} relações no grafo
                      </p>
                      <p className="text-xs mt-2">
                        Use as abas acima para gerenciar nós e relações
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="py-4 text-center">
                    <div className="text-3xl font-bold text-cyan-400">{nodes.length}</div>
                    <div className="text-white/60 text-sm">Nós</div>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="py-4 text-center">
                    <div className="text-3xl font-bold text-blue-400">{edges.length}</div>
                    <div className="text-white/60 text-sm">Relações</div>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="py-4 text-center">
                    <div className="text-3xl font-bold text-purple-400">
                      {new Set(nodes.map(n => n.type)).size}
                    </div>
                    <div className="text-white/60 text-sm">Tipos</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </BrowserFrame>
  );
}
