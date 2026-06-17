import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Ticket, MessageSquare, BookOpen, Bot, Send, Clock, AlertCircle, CheckCircle2, MoreHorizontal, ArrowRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface SupportTicket {
  id: number;
  title: string;
  description?: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  customerId?: number;
  customerName?: string;
}

interface Conversation {
  id: number;
  ticketId: number;
  senderType: string;
  content: string;
  createdAt: string;
}

interface KnowledgeBaseArticle {
  id: number;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

export default function Support() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newArticleOpen, setNewArticleOpen] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const { data: tickets = [] } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets"],
    queryFn: async () => {
      const res = await fetch("/api/support/tickets", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/support/tickets", selectedTicket?.id, "conversations"],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/conversations`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedTicket,
  });

  const { data: articles = [] } = useQuery<KnowledgeBaseArticle[]>({
    queryKey: ["/api/support/knowledge-base"],
    queryFn: async () => {
      const res = await fetch("/api/support/knowledge-base", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [newTicket, setNewTicket] = useState({ title: "", description: "", category: "general", priority: "medium" });
  const [newArticle, setNewArticle] = useState({ title: "", content: "", category: "", tags: "" });

  const createTicketMutation = useMutation({
    mutationFn: async (data: typeof newTicket) => {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create ticket");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setNewTicketOpen(false);
      setNewTicket({ title: "", description: "", category: "general", priority: "medium" });
      toast({ title: "Ticket criado com sucesso" });
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SupportTicket> }) => {
      const res = await fetch(`/api/support/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update ticket");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ ticketId, content }: { ticketId: number; content: string }) => {
      const res = await fetch(`/api/support/tickets/${ticketId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, senderType: "agent" }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", selectedTicket?.id, "conversations"] });
      setMessageInput("");
    },
  });

  const createArticleMutation = useMutation({
    mutationFn: async (data: typeof newArticle) => {
      const res = await fetch("/api/support/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, tags: data.tags.split(",").map((t) => t.trim()).filter(Boolean) }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create article");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/knowledge-base"] });
      setNewArticleOpen(false);
      setNewArticle({ title: "", content: "", category: "", tags: "" });
      toast({ title: "Artigo criado" });
    },
  });

  const convertToWorkItemMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const res = await fetch(`/api/support/tickets/${ticketId}/convert-to-work-item`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to convert");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Ticket convertido em item de trabalho" });
    },
  });

  const askAiMutation = useMutation({
    mutationFn: async ({ ticketId, question }: { ticketId: number; question: string }) => {
      const res = await fetch(`/api/support/tickets/${ticketId}/ai-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to get AI response");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", selectedTicket?.id, "conversations"] });
      setAiQuestion("");
    },
  });

  const handleAskAi = async () => {
    if (!selectedTicket || !aiQuestion.trim()) return;
    setIsAiLoading(true);
    try {
      await askAiMutation.mutateAsync({ ticketId: selectedTicket.id, question: aiQuestion });
    } finally {
      setIsAiLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    open: "bg-blue-100 text-blue-600",
    in_progress: "bg-yellow-100 text-yellow-700",
    waiting_customer: "bg-purple-100 text-purple-600",
    resolved: "bg-green-100 text-green-600",
    closed: "bg-slate-100 text-slate-600",
  };

  const priorityColors: Record<string, string> = {
    low: "border-l-green-400",
    medium: "border-l-yellow-400",
    high: "border-l-orange-400",
    critical: "border-l-red-500",
  };

  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress");
  const closedTickets = tickets.filter((t) => t.status === "resolved" || t.status === "closed");

  return (
    <BrowserFrame>
      <div className="flex h-full bg-slate-50">
        <aside className="w-80 border-r bg-white flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-support-title">
              <Ticket className="h-5 w-5" />
              Suporte
            </h2>
            <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-new-ticket">
                  <Plus className="h-4 w-4 mr-1" /> Novo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Ticket</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Título</Label>
                    <Input value={newTicket.title} onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })} data-testid="input-ticket-title" />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea value={newTicket.description} onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })} data-testid="input-ticket-description" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Categoria</Label>
                      <Select value={newTicket.category} onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}>
                        <SelectTrigger data-testid="select-ticket-category"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">Geral</SelectItem>
                          <SelectItem value="technical">Técnico</SelectItem>
                          <SelectItem value="billing">Faturamento</SelectItem>
                          <SelectItem value="feature">Funcionalidade</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prioridade</Label>
                      <Select value={newTicket.priority} onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}>
                        <SelectTrigger data-testid="select-ticket-priority"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="critical">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={() => createTicketMutation.mutate(newTicket)} className="w-full" data-testid="button-save-ticket">
                    Criar Ticket
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase mb-2 block">Abertos ({openTickets.length})</span>
                <div className="space-y-2">
                  {openTickets.map((ticket) => (
                    <Card
                      key={ticket.id}
                      className={`p-3 cursor-pointer border-l-4 ${priorityColors[ticket.priority]} ${selectedTicket?.id === ticket.id ? "ring-2 ring-primary" : "hover:bg-slate-50"}`}
                      onClick={() => setSelectedTicket(ticket)}
                      data-testid={`ticket-${ticket.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{ticket.title}</h4>
                          <p className="text-xs text-slate-400">#{ticket.id} · {ticket.category}</p>
                        </div>
                        <Badge className={statusColors[ticket.status]} variant="secondary">
                          {ticket.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                  {openTickets.length === 0 && <p className="text-xs text-slate-400 text-center py-2">Nenhum ticket aberto</p>}
                </div>
              </div>

              {closedTickets.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase mb-2 block">Resolvidos ({closedTickets.length})</span>
                  <div className="space-y-2">
                    {closedTickets.slice(0, 5).map((ticket) => (
                      <Card
                        key={ticket.id}
                        className={`p-3 cursor-pointer opacity-60 ${selectedTicket?.id === ticket.id ? "ring-2 ring-primary" : "hover:bg-slate-50"}`}
                        onClick={() => setSelectedTicket(ticket)}
                        data-testid={`ticket-${ticket.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{ticket.title}</h4>
                            <p className="text-xs text-slate-400">#{ticket.id}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="ticket" className="flex-1 flex flex-col">
            <div className="border-b bg-white px-4 py-2">
              <TabsList>
                <TabsTrigger value="ticket" data-testid="tab-ticket">Ticket</TabsTrigger>
                <TabsTrigger value="knowledge" data-testid="tab-knowledge">Base de Conhecimento</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="ticket" className="flex-1 overflow-hidden flex flex-col p-0">
              {!selectedTicket ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Ticket className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-600">Selecione um Ticket</h3>
                    <p className="text-sm text-slate-400">Escolha um ticket na lista para ver os detalhes</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-4 border-b bg-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">{selectedTicket.title}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={statusColors[selectedTicket.status]}>{selectedTicket.status}</Badge>
                          <span className="text-sm text-slate-400">#{selectedTicket.id} · {selectedTicket.category}</span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="h-4 w-4 mr-1" /> Ações
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => updateTicketMutation.mutate({ id: selectedTicket.id, data: { status: "in_progress" } })}>
                            <Clock className="h-4 w-4 mr-2" /> Em Andamento
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateTicketMutation.mutate({ id: selectedTicket.id, data: { status: "resolved" } })}>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Resolver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => convertToWorkItemMutation.mutate(selectedTicket.id)}>
                            <ArrowRight className="h-4 w-4 mr-2" /> Converter em Tarefa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {selectedTicket.description && (
                      <p className="text-sm text-slate-600 mt-2">{selectedTicket.description}</p>
                    )}
                  </div>

                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {conversations.map((conv) => (
                        <div
                          key={conv.id}
                          className={`flex ${conv.senderType === "customer" ? "justify-start" : "justify-end"}`}
                          data-testid={`conversation-${conv.id}`}
                        >
                          <div className={`max-w-[80%] rounded-lg p-3 ${conv.senderType === "customer" ? "bg-slate-100" : conv.senderType === "ai" ? "bg-purple-100" : "bg-primary text-primary-foreground"}`}>
                            <div className="flex items-center gap-2 mb-1">
                              {conv.senderType === "ai" && <Bot className="h-3 w-3" />}
                              <span className="text-xs opacity-75">{conv.senderType === "customer" ? "Cliente" : conv.senderType === "ai" ? "AI Agent" : "Agente"}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{conv.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="p-4 border-t bg-white space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite uma mensagem..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && messageInput.trim() && sendMessageMutation.mutate({ ticketId: selectedTicket.id, content: messageInput })}
                        data-testid="input-message"
                      />
                      <Button onClick={() => messageInput.trim() && sendMessageMutation.mutate({ ticketId: selectedTicket.id, content: messageInput })} data-testid="button-send-message">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Perguntar ao AI Agent..."
                        value={aiQuestion}
                        onChange={(e) => setAiQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAskAi()}
                        className="bg-purple-50 border-purple-200"
                        data-testid="input-ai-question"
                      />
                      <Button onClick={handleAskAi} disabled={isAiLoading} variant="secondary" className="bg-purple-100 hover:bg-purple-200" data-testid="button-ask-ai">
                        <Bot className="h-4 w-4 mr-1" /> {isAiLoading ? "..." : "AI"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="knowledge" className="flex-1 overflow-auto p-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Base de Conhecimento
                  </h2>
                  <Dialog open={newArticleOpen} onOpenChange={setNewArticleOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-new-article">
                        <Plus className="h-4 w-4 mr-1" /> Novo Artigo
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Novo Artigo</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Título</Label>
                          <Input value={newArticle.title} onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })} data-testid="input-article-title" />
                        </div>
                        <div>
                          <Label>Categoria</Label>
                          <Input value={newArticle.category} onChange={(e) => setNewArticle({ ...newArticle, category: e.target.value })} data-testid="input-article-category" />
                        </div>
                        <div>
                          <Label>Tags (separadas por vírgula)</Label>
                          <Input value={newArticle.tags} onChange={(e) => setNewArticle({ ...newArticle, tags: e.target.value })} placeholder="tag1, tag2, tag3" data-testid="input-article-tags" />
                        </div>
                        <div>
                          <Label>Conteúdo</Label>
                          <Textarea value={newArticle.content} onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })} rows={8} data-testid="input-article-content" />
                        </div>
                        <Button onClick={() => createArticleMutation.mutate(newArticle)} className="w-full" data-testid="button-save-article">
                          Criar Artigo
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {articles.length === 0 ? (
                  <Card className="p-8 text-center">
                    <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhum artigo na base de conhecimento</p>
                    <p className="text-xs text-slate-400 mt-1">Crie artigos para ajudar o AI Agent a responder melhor</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {articles.map((article) => (
                      <Card key={article.id} className="p-4" data-testid={`article-${article.id}`}>
                        <h3 className="font-medium mb-2">{article.title}</h3>
                        {article.category && <Badge variant="outline" className="mb-2">{article.category}</Badge>}
                        <p className="text-sm text-slate-600 line-clamp-3">{article.content}</p>
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {article.tags.map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </BrowserFrame>
  );
}
