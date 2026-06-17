import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  Code,
  Wand2,
  TrendingUp,
  Lightbulb,
  Play,
  Copy,
  Loader2,
  Sparkles,
  BarChart3,
  Zap,
  FileCode,
  RefreshCw,
  Database,
  MessageSquare,
  GitBranch,
  Clock,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe,
  Navigation
} from "lucide-react";

export default function Scientist() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("knowledge");
  const [analysisGoal, setAnalysisGoal] = useState("");
  const [automationTask, setAutomationTask] = useState("");
  const [patternData, setPatternData] = useState("");
  const [generatedCode, setGeneratedCode] = useState<any>(null);
  const [detectedPatterns, setDetectedPatterns] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [expandedInteraction, setExpandedInteraction] = useState<number | null>(null);

  const { data: learningStats, refetch: refetchStats } = useQuery({
    queryKey: ["learning-stats"],
    queryFn: async () => {
      const res = await fetch("/api/learning/stats");
      if (!res.ok) throw new Error("Erro ao carregar estatísticas");
      return res.json();
    }
  });

  const { data: interactions, refetch: refetchInteractions } = useQuery({
    queryKey: ["learning-interactions"],
    queryFn: async () => {
      const res = await fetch("/api/learning/interactions?limit=30");
      if (!res.ok) throw new Error("Erro ao carregar interações");
      return res.json();
    }
  });

  const { data: savedPatterns, refetch: refetchPatterns } = useQuery({
    queryKey: ["learning-patterns"],
    queryFn: async () => {
      const res = await fetch("/api/learning/patterns");
      if (!res.ok) throw new Error("Erro ao carregar padrões");
      return res.json();
    }
  });

  const { data: savedCodes, refetch: refetchCodes } = useQuery({
    queryKey: ["learning-codes"],
    queryFn: async () => {
      const res = await fetch("/api/learning/codes");
      if (!res.ok) throw new Error("Erro ao carregar códigos");
      return res.json();
    }
  });

  const generateAnalysisMutation = useMutation({
    mutationFn: async (goal: string) => {
      const res = await fetch("/api/manus/scientist/generate-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal })
      });
      if (!res.ok) throw new Error("Erro ao gerar código");
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedCode(data);
      toast({ title: "Código gerado!", description: `Template: ${data.template_used}` });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao gerar código", variant: "destructive" });
    }
  });

  const generateAutomationMutation = useMutation({
    mutationFn: async (task: string) => {
      const res = await fetch("/api/manus/scientist/generate-automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_description: task })
      });
      if (!res.ok) throw new Error("Erro ao gerar automação");
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedCode(data);
      toast({ title: "Automação gerada!", description: `Tipo: ${data.type}` });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao gerar automação", variant: "destructive" });
    }
  });

  const detectPatternsMutation = useMutation({
    mutationFn: async (data: string) => {
      const res = await fetch("/api/manus/scientist/detect-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: JSON.parse(data) })
      });
      if (!res.ok) throw new Error("Erro ao detectar padrões");
      return res.json();
    },
    onSuccess: (data) => {
      setDetectedPatterns(data);
      toast({ title: "Padrões detectados!", description: `${data.patterns?.length || 0} padrões encontrados` });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao detectar padrões", variant: "destructive" });
    }
  });

  const suggestImprovementsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/manus/scientist/suggest-improvements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: "general" })
      });
      if (!res.ok) throw new Error("Erro ao buscar sugestões");
      return res.json();
    },
    onSuccess: (data) => {
      setSuggestions(data);
      toast({ title: "Sugestões carregadas!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao buscar sugestões", variant: "destructive" });
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Código copiado para a área de transferência" });
  };

  return (
    <BrowserFrame>
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#1a2942] to-[#0d1f35] p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Módulo Cientista</h1>
              <p className="text-white/60">Inteligência Central - Auto-Programação com IA</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-white/10 border-none flex-wrap">
              <TabsTrigger value="knowledge" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500">
                <Database className="w-4 h-4 mr-2" />
                Base de Conhecimento
              </TabsTrigger>
              <TabsTrigger value="analysis" className="data-[state=active]:bg-purple-500">
                <BarChart3 className="w-4 h-4 mr-2" />
                Análise de Dados
              </TabsTrigger>
              <TabsTrigger value="automation" className="data-[state=active]:bg-purple-500">
                <Zap className="w-4 h-4 mr-2" />
                Automação
              </TabsTrigger>
              <TabsTrigger value="patterns" className="data-[state=active]:bg-purple-500">
                <TrendingUp className="w-4 h-4 mr-2" />
                Padrões
              </TabsTrigger>
              <TabsTrigger value="suggestions" className="data-[state=active]:bg-purple-500">
                <Lightbulb className="w-4 h-4 mr-2" />
                Sugestões
              </TabsTrigger>
            </TabsList>

            <TabsContent value="knowledge" className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-8 h-8 text-purple-400" />
                      <div>
                        <p className="text-2xl font-bold text-white">{learningStats?.totalInteractions || 0}</p>
                        <p className="text-xs text-white/60">Interações Aprendidas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <GitBranch className="w-8 h-8 text-blue-400" />
                      <div>
                        <p className="text-2xl font-bold text-white">{learningStats?.totalPatterns || 0}</p>
                        <p className="text-xs text-white/60">Padrões Detectados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Code className="w-8 h-8 text-green-400" />
                      <div>
                        <p className="text-2xl font-bold text-white">{learningStats?.totalCodes || 0}</p>
                        <p className="text-xs text-white/60">Códigos Gerados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Brain className="w-8 h-8 text-amber-400" />
                      <div>
                        <p className="text-2xl font-bold text-white">
                          {learningStats?.bySource ? Object.values(learningStats.bySource).reduce((a: number, b: any) => a + Number(b || 0), 0) : 0}
                        </p>
                        <p className="text-xs text-white/60">Total por Fontes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-lg flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-purple-400" />
                        Interações Recentes
                      </CardTitle>
                      <Button size="sm" variant="ghost" onClick={() => refetchInteractions()} className="text-white/60">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    <CardDescription className="text-white/50">
                      Perguntas e respostas do chat e agente Manus
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-2">
                        {interactions?.map((interaction: any) => {
                          const isExpanded = expandedInteraction === interaction.id;
                          const isNavigation = interaction.source === 'navigation';
                          const metadata = interaction.metadata || {};
                          
                          return (
                            <div 
                              key={interaction.id} 
                              className="bg-white/5 rounded-lg border border-white/10 hover:border-purple-500/30 transition-colors cursor-pointer"
                              onClick={() => setExpandedInteraction(isExpanded ? null : interaction.id)}
                            >
                              <div className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-white/40" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-white/40" />
                                  )}
                                  <Badge className={`text-xs ${
                                    interaction.source === 'agent_chat' ? 'bg-purple-500/20 text-purple-300' :
                                    interaction.source === 'manus_agent' ? 'bg-blue-500/20 text-blue-300' :
                                    interaction.source === 'navigation' ? 'bg-cyan-500/20 text-cyan-300' :
                                    'bg-green-500/20 text-green-300'
                                  }`}>
                                    {interaction.source === 'agent_chat' ? 'Chat' : 
                                     interaction.source === 'manus_agent' ? 'Manus' : 
                                     interaction.source === 'navigation' ? 'navigation' : interaction.source}
                                  </Badge>
                                  {interaction.toolsUsed?.length > 0 && (
                                    <Badge variant="outline" className="text-xs text-white/50 border-white/20">
                                      {interaction.toolsUsed.length} ferramentas
                                    </Badge>
                                  )}
                                  <span className="text-xs text-white/40 ml-auto flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(interaction.createdAt).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                                <p className="text-sm text-white/80 line-clamp-2 mb-1">
                                  {isNavigation && metadata.action ? (
                                    <>Navegação: {metadata.action} em <span className="text-purple-300">{metadata.module || 'módulo'}</span></>
                                  ) : (
                                    interaction.question
                                  )}
                                </p>
                                {!isExpanded && (
                                  <p className="text-xs text-white/50 line-clamp-1">
                                    {isNavigation ? JSON.stringify(metadata).substring(0, 80) + '...' : interaction.answer?.substring(0, 100) + '...'}
                                  </p>
                                )}
                              </div>
                              
                              {isExpanded && (
                                <div className="px-3 pb-3 border-t border-white/10 mt-0">
                                  <div className="pt-3 space-y-3">
                                    {isNavigation ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm">
                                          <Navigation className="w-4 h-4 text-cyan-400" />
                                          <span className="text-white/70">Ação:</span>
                                          <span className="text-white">{metadata.action || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                          <Globe className="w-4 h-4 text-cyan-400" />
                                          <span className="text-white/70">Módulo:</span>
                                          <span className="text-white">{metadata.module || interaction.question}</span>
                                        </div>
                                        {metadata.url && (
                                          <div className="flex items-center gap-2 text-sm">
                                            <ExternalLink className="w-4 h-4 text-cyan-400" />
                                            <span className="text-white/70">URL:</span>
                                            <a 
                                              href={metadata.url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="text-cyan-400 hover:underline truncate max-w-[200px]"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {metadata.url}
                                            </a>
                                          </div>
                                        )}
                                        {metadata.domain && (
                                          <div className="flex items-center gap-2 text-sm">
                                            <Globe className="w-4 h-4 text-cyan-400" />
                                            <span className="text-white/70">Domínio:</span>
                                            <span className="text-white">{metadata.domain}</span>
                                          </div>
                                        )}
                                        {metadata.appName && (
                                          <div className="flex items-center gap-2 text-sm">
                                            <span className="text-white/70">App:</span>
                                            <span className="text-white">{metadata.appName}</span>
                                          </div>
                                        )}
                                        {metadata.route && (
                                          <div className="flex items-center gap-2 text-sm">
                                            <span className="text-white/70">Rota:</span>
                                            <span className="text-white font-mono text-xs bg-white/10 px-2 py-0.5 rounded">{metadata.route}</span>
                                          </div>
                                        )}
                                        <div className="text-xs text-white/40 mt-2">
                                          {metadata.timestamp && new Date(metadata.timestamp).toLocaleString('pt-BR')}
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div>
                                          <p className="text-xs text-white/50 mb-1">Pergunta:</p>
                                          <p className="text-sm text-white/90 bg-white/5 p-2 rounded">{interaction.question}</p>
                                        </div>
                                        {interaction.answer && (
                                          <div>
                                            <p className="text-xs text-white/50 mb-1">Resposta:</p>
                                            <p className="text-sm text-white/80 bg-white/5 p-2 rounded max-h-32 overflow-y-auto">{interaction.answer}</p>
                                          </div>
                                        )}
                                        {interaction.toolsUsed?.length > 0 && (
                                          <div>
                                            <p className="text-xs text-white/50 mb-1">Ferramentas usadas:</p>
                                            <div className="flex flex-wrap gap-1">
                                              {interaction.toolsUsed.map((tool: string, i: number) => (
                                                <Badge key={i} variant="outline" className="text-xs text-white/60 border-white/20">
                                                  {tool}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {interaction.feedback && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-white/50">Feedback:</span>
                                            {interaction.feedback === 'positive' ? (
                                              <ThumbsUp className="w-4 h-4 text-green-400" />
                                            ) : (
                                              <ThumbsDown className="w-4 h-4 text-red-400" />
                                            )}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {(!interactions || interactions.length === 0) && (
                          <p className="text-white/50 text-center py-8">Nenhuma interação registrada ainda</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-lg flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-blue-400" />
                        Padrões Aprendidos
                      </CardTitle>
                      <Button size="sm" variant="ghost" onClick={() => refetchPatterns()} className="text-white/60">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    <CardDescription className="text-white/50">
                      Correlações, tendências e anomalias detectadas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-2">
                        {savedPatterns?.map((pattern: any) => (
                          <div key={pattern.id} className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-blue-500/30 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={`text-xs ${
                                pattern.patternType === 'correlation' ? 'bg-blue-500/20 text-blue-300' :
                                pattern.patternType === 'trend' ? 'bg-green-500/20 text-green-300' :
                                pattern.patternType === 'anomaly' ? 'bg-red-500/20 text-red-300' :
                                'bg-purple-500/20 text-purple-300'
                              }`}>
                                {pattern.patternType}
                              </Badge>
                              {pattern.confidence && (
                                <span className="text-xs text-white/50">
                                  Confiança: {parseFloat(pattern.confidence).toFixed(0)}%
                                </span>
                              )}
                              <span className="text-xs text-white/40 ml-auto">
                                Usado {pattern.usageCount}x
                              </span>
                            </div>
                            <p className="text-sm font-medium text-white/90">{pattern.name}</p>
                            {pattern.description && (
                              <p className="text-xs text-white/50 mt-1">{pattern.description}</p>
                            )}
                          </div>
                        ))}
                        {(!savedPatterns || savedPatterns.length === 0) && (
                          <p className="text-white/50 text-center py-8">Nenhum padrão detectado ainda</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <FileCode className="w-5 h-5 text-green-400" />
                      Códigos Gerados e Reutilizáveis
                    </CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => refetchCodes()} className="text-white/60">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <CardDescription className="text-white/50">
                    Scripts e automações criados pelo Cientista prontos para reutilização
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="grid grid-cols-3 gap-3">
                      {savedCodes?.map((code: any) => (
                        <div key={code.id} className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-green-500/30 transition-colors">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="text-xs bg-green-500/20 text-green-300">
                              {code.codeType}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-white/50 border-white/20">
                              {code.language}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-white/90">{code.name}</p>
                          <p className="text-xs text-white/50 mt-1">Usado {code.usageCount}x</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2 w-full text-green-400 hover:bg-green-500/10"
                            onClick={() => copyToClipboard(code.code)}
                          >
                            <Copy className="w-3 h-3 mr-1" /> Copiar
                          </Button>
                        </div>
                      ))}
                      {(!savedCodes || savedCodes.length === 0) && (
                        <p className="text-white/50 text-center py-8 col-span-3">Nenhum código gerado ainda</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Code className="w-5 h-5 text-purple-400" />
                    Gerador de Código de Análise
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Descreva o que você quer analisar e a IA gerará o código Python
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-white/80">Objetivo da Análise</label>
                    <Textarea
                      value={analysisGoal}
                      onChange={(e) => setAnalysisGoal(e.target.value)}
                      placeholder="Ex: Agregar vendas por região e calcular totais mensais"
                      className="bg-white/5 border-white/20 text-white min-h-[100px]"
                      data-testid="input-analysis-goal"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-purple-300 border-purple-500/50">agregar</Badge>
                    <Badge variant="outline" className="text-blue-300 border-blue-500/50">filtrar</Badge>
                    <Badge variant="outline" className="text-green-300 border-green-500/50">transformar</Badge>
                    <Badge variant="outline" className="text-yellow-300 border-yellow-500/50">prever</Badge>
                    <Badge variant="outline" className="text-pink-300 border-pink-500/50">relatório</Badge>
                  </div>
                  <Button
                    onClick={() => generateAnalysisMutation.mutate(analysisGoal)}
                    disabled={!analysisGoal || generateAnalysisMutation.isPending}
                    className="bg-gradient-to-r from-purple-500 to-pink-500"
                    data-testid="button-generate-analysis"
                  >
                    {generateAnalysisMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4 mr-2" />
                    )}
                    Gerar Código
                  </Button>
                </CardContent>
              </Card>

              {generatedCode && (
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white flex items-center gap-2">
                        <FileCode className="w-5 h-5 text-green-400" />
                        Código Gerado
                        {generatedCode.template_used && (
                          <Badge className="bg-purple-500/20 text-purple-300">
                            {generatedCode.template_used}
                          </Badge>
                        )}
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(generatedCode.code)}
                        className="border-white/20"
                        data-testid="button-copy-code"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar
                      </Button>
                    </div>
                    {generatedCode.usage && (
                      <CardDescription className="text-white/60">
                        {generatedCode.usage}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <pre className="bg-black/50 p-4 rounded-lg text-sm text-green-300 font-mono overflow-x-auto">
                        {generatedCode.code}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="automation" className="space-y-4">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Gerador de Automação
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Descreva a tarefa a automatizar e receba código pronto
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-white/80">Descrição da Tarefa</label>
                    <Textarea
                      value={automationTask}
                      onChange={(e) => setAutomationTask(e.target.value)}
                      placeholder="Ex: Enviar email de notificação quando um pedido for concluído"
                      className="bg-white/5 border-white/20 text-white min-h-[100px]"
                      data-testid="input-automation-task"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-blue-300 border-blue-500/50">email</Badge>
                    <Badge variant="outline" className="text-green-300 border-green-500/50">API</Badge>
                    <Badge variant="outline" className="text-yellow-300 border-yellow-500/50">arquivo</Badge>
                    <Badge variant="outline" className="text-purple-300 border-purple-500/50">agendamento</Badge>
                  </div>
                  <Button
                    onClick={() => generateAutomationMutation.mutate(automationTask)}
                    disabled={!automationTask || generateAutomationMutation.isPending}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500"
                    data-testid="button-generate-automation"
                  >
                    {generateAutomationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Gerar Automação
                  </Button>
                </CardContent>
              </Card>

              {generatedCode && generatedCode.type && (
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white flex items-center gap-2">
                        <FileCode className="w-5 h-5 text-yellow-400" />
                        Automação Gerada
                        <Badge className="bg-yellow-500/20 text-yellow-300">
                          {generatedCode.type}
                        </Badge>
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(generatedCode.code)}
                        className="border-white/20"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar
                      </Button>
                    </div>
                    {generatedCode.requires && (
                      <CardDescription className="text-white/60">
                        Dependências: {generatedCode.requires.join(", ")}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <pre className="bg-black/50 p-4 rounded-lg text-sm text-yellow-300 font-mono overflow-x-auto">
                        {generatedCode.code}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="patterns" className="space-y-4">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    Detecção de Padrões
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Cole seus dados em JSON para análise automática de padrões
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-white/80">Dados (JSON)</label>
                    <Textarea
                      value={patternData}
                      onChange={(e) => setPatternData(e.target.value)}
                      placeholder='[{"mes": "jan", "vendas": 1000}, {"mes": "fev", "vendas": 1200}]'
                      className="bg-white/5 border-white/20 text-white min-h-[150px] font-mono text-sm"
                      data-testid="input-pattern-data"
                    />
                  </div>
                  <Button
                    onClick={() => detectPatternsMutation.mutate(patternData)}
                    disabled={!patternData || detectPatternsMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-cyan-500"
                    data-testid="button-detect-patterns"
                  >
                    {detectPatternsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <TrendingUp className="w-4 h-4 mr-2" />
                    )}
                    Detectar Padrões
                  </Button>
                </CardContent>
              </Card>

              {detectedPatterns && (
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">Padrões Encontrados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {detectedPatterns.patterns?.map((pattern: any, i: number) => (
                        <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/10">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`
                              ${pattern.type === 'trend' ? 'bg-green-500/20 text-green-300' : ''}
                              ${pattern.type === 'correlation' ? 'bg-blue-500/20 text-blue-300' : ''}
                              ${pattern.type === 'outlier' ? 'bg-red-500/20 text-red-300' : ''}
                            `}>
                              {pattern.type}
                            </Badge>
                            <span className="text-white/60 text-sm">
                              Confiança: {(pattern.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-white/80">{pattern.description}</p>
                        </div>
                      ))}
                      {(!detectedPatterns.patterns || detectedPatterns.patterns.length === 0) && (
                        <p className="text-white/60 text-center py-4">Nenhum padrão significativo encontrado</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="suggestions" className="space-y-4">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    Sugestões de Melhoria
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    O sistema aprende com o uso e sugere melhorias baseadas no histórico
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => suggestImprovementsMutation.mutate()}
                    disabled={suggestImprovementsMutation.isPending}
                    className="bg-gradient-to-r from-amber-500 to-orange-500"
                    data-testid="button-get-suggestions"
                  >
                    {suggestImprovementsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Buscar Sugestões
                  </Button>
                </CardContent>
              </Card>

              {suggestions && (
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">Sugestões Baseadas no Uso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {suggestions.suggestions?.map((suggestion: any, i: number) => (
                        <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/10">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`
                              ${suggestion.priority === 'high' ? 'bg-red-500/20 text-red-300' : ''}
                              ${suggestion.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : ''}
                              ${suggestion.priority === 'low' ? 'bg-green-500/20 text-green-300' : ''}
                            `}>
                              {suggestion.priority}
                            </Badge>
                            <Badge variant="outline" className="text-white/60 border-white/20">
                              {suggestion.type}
                            </Badge>
                          </div>
                          <p className="text-white/80">{suggestion.description}</p>
                        </div>
                      ))}
                      {(!suggestions.suggestions || suggestions.suggestions.length === 0) && (
                        <p className="text-white/60 text-center py-4">Nenhuma sugestão disponível ainda</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </BrowserFrame>
  );
}
