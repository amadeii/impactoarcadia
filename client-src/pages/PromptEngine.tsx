import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Bot, Plus, Save, Play, Trash2, ChevronRight, ChevronLeft,
  User, Target, ListOrdered, BookOpen, Layout, MessageSquare,
  Shield, CheckCircle, Circle, AlertCircle,
  Sparkles, Copy, FileText, Search, X,
  ArrowLeft, Clock, Send, RotateCcw, Wand2,
  Edit3, Settings2, Thermometer, Hash, Tag, Lightbulb,
  Paperclip, History, ImageIcon, FileCode, AtSign, Trash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Agent {
  id: string; slug?: string; name: string; description?: string; role?: string;
  avatar?: string; color?: string; domain?: string; tone?: string;
  isBuiltin?: boolean; scope?: string; capabilities?: string[]; exampleQuestions?: string[];
}
interface Attachment {
  name: string; mimeType: string; data: string;
  textContent?: string; preview?: string;
}
interface ChatMsg {
  role: "user" | "assistant"; content: string; ts: number; durationMs?: number;
  attachments?: Array<{ name: string; mimeType: string; preview?: string }>;
  delegatedAgent?: { name: string; avatar?: string; color?: string };
}
interface Persona { id: string; name: string; role?: string; systemPrompt?: string; tone?: string; domain?: string; avatar?: string; color?: string; }
interface RoteiroStep { text: string; order: number; }
interface ModeloSaida { format?: string; example?: string; maxLength?: string; }
interface PromptData {
  id?: string; name: string; description?: string; status?: string;
  personaId?: string; objetivo?: string; roteiro?: RoteiroStep[];
  modeloSaida?: ModeloSaida; publico?: string; tom?: string;
  contexto?: string; restricoes?: string; gates?: Record<string, boolean>;
  gateScore?: number; compiledPrompt?: string; usageCount?: number;
}
interface Template { id: string; name: string; description?: string; category?: string; icon?: string; promptData: any; }

// ─── Constants ────────────────────────────────────────────────────────────────
const GATES = [
  { key: "persona",     label: "Persona",        required: true,  icon: User,        description: "Quem é o agente?" },
  { key: "objetivo",    label: "Objetivo",        required: true,  icon: Target,      description: "O que deve alcançar?" },
  { key: "roteiro",     label: "Roteiro",         required: true,  icon: ListOrdered, description: "Quais são os passos?" },
  { key: "modeloSaida", label: "Modelo de Saída", required: true,  icon: Layout,      description: "Qual é o formato?" },
  { key: "publico",     label: "Público-Alvo",    required: false, icon: User,        description: "Para quem é dirigido?" },
  { key: "tom",         label: "Tom",             required: false, icon: MessageSquare, description: "Qual é o estilo?" },
  { key: "contexto",    label: "Contexto",        required: false, icon: BookOpen,    description: "Qual é o cenário?" },
  { key: "nome",        label: "Nome",            required: false, icon: FileText,    description: "Prompt nomeado?" },
];
const TOM_OPTIONS = ["Formal","Técnico","Amigável","Persuasivo","Empático","Analítico","Direto","Criativo"];
const FORMATO_OPTIONS = ["Texto livre","Bullet points","Lista numerada","Tabela","JSON","Email","Relatório","Código"];
const SECTIONS: Record<string, { label: string; icon: any; color: string }> = {
  objetivo:    { label: "Objetivo",        icon: Target,        color: "text-blue-500" },
  persona:     { label: "Persona",         icon: Bot,           color: "text-purple-500" },
  roteiro:     { label: "Roteiro",         icon: ListOrdered,   color: "text-green-500" },
  modeloSaida: { label: "Modelo de Saída", icon: Layout,        color: "text-orange-500" },
  publico:     { label: "Público-Alvo",    icon: User,          color: "text-pink-500" },
  tom:         { label: "Tom",             icon: MessageSquare, color: "text-teal-500" },
  contexto:    { label: "Contexto",        icon: BookOpen,      color: "text-indigo-500" },
  restricoes:  { label: "Restrições",      icon: Shield,        color: "text-red-500" },
};

// ─── Gate Score Gauge ─────────────────────────────────────────────────────────
function GaugeScore({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";
  const bar = score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex flex-col items-center py-3">
      <div className={`text-4xl font-bold ${color}`}>{score}</div>
      <div className="text-xs text-muted-foreground mt-0.5">/ 100 — {score >= 80 ? "Excelente" : score >= 50 ? "Bom" : "Incompleto"}</div>
      <div className="w-full bg-muted rounded-full h-2 mt-2">
        <div className={`h-2 rounded-full transition-all duration-500 ${bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ─── Agent Chat Component ─────────────────────────────────────────────────────
function AgentChat({ agent, onBack, onEdit, allAgents = [] }: {
  agent: Agent; onBack: () => void; onEdit?: () => void; allAgents?: Agent[];
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  // History
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  // Files
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // @mention / delegate agent
  const [delegateAgent, setDelegateAgent] = useState<Agent | null>(null);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const agentSlug = (agent as any).slug || agent.id;

  const { data: chatHistory = [], refetch: refetchHistory } = useQuery<any[]>({
    queryKey: [`/api/prompt-engine/agents/${agentSlug}/chats`],
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Sessão de histórico ────────────────────────────────────────────────────
  const loadChat = (chat: any) => {
    setMessages(chat.messages || []);
    setCurrentChatId(chat.id);
    setShowExamples(false);
    setHistorySidebarOpen(false);
  };

  const newChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setShowExamples(true);
    setAttachments([]);
    setDelegateAgent(null);
  };

  const autoSave = async (msgs: ChatMsg[], chatId: string | null): Promise<string | null> => {
    try {
      const title = msgs.find(m => m.role === "user")?.content?.slice(0, 50) || "Conversa";
      if (chatId) {
        await apiRequest("PUT", `/api/prompt-engine/agents/chats/${chatId}`, { messages: msgs, title });
        return chatId;
      } else {
        const r = await apiRequest("POST", `/api/prompt-engine/agents/${agentSlug}/chats`, { messages: msgs, title });
        const d = await r.json();
        return d.id ?? null;
      }
    } catch { return chatId; }
  };

  // ── Upload de arquivos ────────────────────────────────────────────────────
  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => resolve((e.target?.result as string).split(",")[1]);
      r.readAsDataURL(file);
    });

  const readFileAsText = (file: File): Promise<string> =>
    new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => resolve(e.target?.result as string);
      r.readAsText(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const newAtts: Attachment[] = [];
    for (const file of Array.from(files)) {
      const data = await readFileAsBase64(file);
      const att: Attachment = { name: file.name, mimeType: file.type || "application/octet-stream", data };
      if (file.type.startsWith("image/")) {
        att.preview = `data:${file.type};base64,${data}`;
      } else if (file.type.startsWith("text/") || /\.(csv|md|txt|json|xml|sql)$/i.test(file.name)) {
        att.textContent = await readFileAsText(file);
      }
      newAtts.push(att);
    }
    setAttachments(prev => [...prev, ...newAtts]);
    e.target.value = "";
  };

  // ── @mention ───────────────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const atIdx = val.lastIndexOf("@");
    if (atIdx >= 0) {
      const afterAt = val.slice(atIdx + 1);
      if (!afterAt.includes(" ") && !afterAt.includes("\n")) {
        setMentionQuery(afterAt.toLowerCase());
        setShowMentionPicker(true);
        return;
      }
    }
    setShowMentionPicker(false);
  };

  const selectMentionAgent = (a: Agent) => {
    setDelegateAgent(a);
    const atIdx = input.lastIndexOf("@");
    setInput(atIdx >= 0 ? input.slice(0, atIdx) : input);
    setShowMentionPicker(false);
    inputRef.current?.focus();
  };

  const filteredMentionAgents = allAgents.filter(a =>
    a.id !== agent.id && a.name.toLowerCase().includes(mentionQuery)
  );

  // ── Envio ──────────────────────────────────────────────────────────────────
  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    const target = delegateAgent || agent;
    const targetSlug = (target as any).slug || target.id;
    setInput("");
    setShowExamples(false);

    const userMsg: ChatMsg = {
      role: "user", content: msg, ts: Date.now(),
      attachments: attachments.map(a => ({ name: a.name, mimeType: a.mimeType, preview: a.preview })),
    };
    const history = messages;
    const newMsgs = [...history, userMsg];
    setMessages(newMsgs);
    const sentAttachments = [...attachments];
    const sentDelegate = delegateAgent;
    setAttachments([]);
    setDelegateAgent(null);
    setLoading(true);

    try {
      const res = await apiRequest("POST", `/api/prompt-engine/agents/${targetSlug}/invoke`, {
        message: msg,
        history: history.slice(-16),
        files: sentAttachments.map(a => ({ name: a.name, mimeType: a.mimeType, data: a.data, textContent: a.textContent })),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const botMsg: ChatMsg = {
        role: "assistant", content: data.output, ts: Date.now(), durationMs: data.durationMs,
        delegatedAgent: sentDelegate ? { name: sentDelegate.name, avatar: sentDelegate.avatar, color: sentDelegate.color } : undefined,
      };
      const finalMsgs = [...newMsgs, botMsg];
      setMessages(finalMsgs);
      const savedId = await autoSave(finalMsgs, currentChatId);
      if (!currentChatId && savedId) setCurrentChatId(savedId);
      refetchHistory();
    } catch (e: any) {
      toast({ title: "Erro ao invocar agente", description: e.message, variant: "destructive" });
      setMessages(prev => [...prev, { role: "assistant", content: `Erro: ${e.message}`, ts: Date.now() }]);
    } finally { setLoading(false); }
  };

  const activeColor = delegateAgent?.color || agent.color || "#6366f1";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-background shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setHistorySidebarOpen(v => !v)} title="Histórico de conversas">
          <History className="h-4 w-4" />
        </Button>
        <span className="text-xl">{agent.avatar || "🤖"}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{agent.name}</div>
          {agent.role && <div className="text-xs text-muted-foreground truncate">{agent.role}</div>}
        </div>
        {(agent as any).isBuiltin && <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600 shrink-0">Sistema</Badge>}
        {onEdit && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-purple-600" onClick={onEdit} title="Editar">
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={newChat} title="Nova conversa">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Body — sidebar + chat */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar histórico ────────────────────────────────────────────── */}
        <div className={`flex flex-col border-r bg-muted/20 shrink-0 transition-all duration-200 ${historySidebarOpen ? "w-52" : "w-0 overflow-hidden"}`}>
          <div className="px-2 py-2 border-b shrink-0">
            <Button size="sm" className="w-full h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-700" onClick={newChat}>
              <Plus className="h-3 w-3" /> Nova conversa
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1 space-y-0.5">
              {(chatHistory as any[]).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6 px-2">Nenhuma conversa salva ainda</p>
              )}
              {(chatHistory as any[]).map((chat: any) => (
                <button key={chat.id} onClick={() => loadChat(chat)}
                  className={`w-full text-left px-2 py-2 rounded-md text-xs hover:bg-muted group flex items-start gap-1.5 ${currentChatId === chat.id ? "bg-muted font-medium" : ""}`}>
                  <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{chat.title || "Conversa"}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(chat.updatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* ── Área principal ────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4 max-w-3xl mx-auto">

              {/* Welcome */}
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">{agent.avatar || "🤖"}</div>
                  <h3 className="font-semibold text-lg mb-1">{agent.name}</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">{agent.description}</p>
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center mb-4">
                      {agent.capabilities.slice(0, 6).map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
                    </div>
                  )}
                  {agent.exampleQuestions && agent.exampleQuestions.length > 0 && (
                    <div className="space-y-2 text-left max-w-lg mx-auto">
                      <p className="text-xs text-muted-foreground font-medium text-center mb-2">Exemplos de perguntas</p>
                      {agent.exampleQuestions.slice(0, 4).map((q, i) => (
                        <button key={i} onClick={() => send(q)}
                          className="w-full text-left px-3 py-2 rounded-lg border text-xs hover:bg-muted hover:border-primary/30 transition-colors">
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  {allAgents.length > 1 && (
                    <div className="mt-5 flex flex-wrap gap-1.5 justify-center">
                      <p className="w-full text-xs text-muted-foreground mb-1">Convocar outro agente:</p>
                      {allAgents.filter(a => a.id !== agent.id).slice(0, 5).map(a => (
                        <button key={a.id} onClick={() => setDelegateAgent(a)}
                          className="flex items-center gap-1 px-2 py-1 rounded-full border text-xs hover:border-purple-400 hover:bg-purple-50 transition-colors">
                          <span>{a.avatar || "🤖"}</span><span>{a.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Mensagens */}
              {messages.map((m, i) => {
                const isUser = m.role === "user";
                const dispAgent = m.delegatedAgent || agent;
                return (
                  <div key={i} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
                        style={{ backgroundColor: m.delegatedAgent?.color || agent.color || "#6366f1", color: "white" }}>
                        {m.delegatedAgent?.avatar || agent.avatar || "🤖"}
                      </div>
                    )}
                    <div className="flex flex-col gap-1 max-w-[80%]">
                      {!isUser && m.delegatedAgent && (
                        <span className="text-[10px] text-purple-600 font-medium px-1">via {m.delegatedAgent.name}</span>
                      )}
                      {/* Anexos do usuário */}
                      {isUser && m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-end mb-1">
                          {m.attachments.map((att, ai) => (
                            <div key={ai} className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-lg px-2 py-1 text-xs">
                              {att.preview ? (
                                <img src={att.preview} alt={att.name} className="h-12 w-12 object-cover rounded" />
                              ) : (
                                <><FileCode className="h-3 w-3 text-primary" /><span className="truncate max-w-[100px]">{att.name}</span></>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 text-sm ${isUser ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                        <pre className="whitespace-pre-wrap font-sans leading-relaxed">{m.content}</pre>
                        {m.durationMs && !isUser && (
                          <p className="text-[10px] text-muted-foreground mt-1">{(m.durationMs / 1000).toFixed(1)}s</p>
                        )}
                      </div>
                    </div>
                    {isUser && (
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-sm shrink-0 mt-0.5">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: activeColor, color: "white" }}>
                    {delegateAgent?.avatar || agent.avatar || "🤖"}
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* ── Input area ──────────────────────────────────────────────────── */}
          <div className="px-4 py-3 border-t bg-background shrink-0">
            <div className="max-w-3xl mx-auto space-y-2">

              {/* Badge agente delegado */}
              {delegateAgent && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-purple-50 border-purple-200">
                  <span className="text-sm">{delegateAgent.avatar || "🤖"}</span>
                  <span className="text-xs text-purple-700 font-medium flex-1">Direcionado para: <strong>{delegateAgent.name}</strong></span>
                  <button onClick={() => setDelegateAgent(null)} className="text-purple-400 hover:text-purple-600"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}

              {/* Preview de anexos */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 rounded-lg border bg-muted/30">
                  {attachments.map((att, i) => (
                    <div key={i} className="relative group flex items-center gap-1.5 bg-background border rounded-lg px-2 py-1.5 text-xs shadow-sm">
                      {att.preview ? (
                        <img src={att.preview} alt={att.name} className="h-10 w-10 object-cover rounded" />
                      ) : (
                        <FileCode className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="truncate max-w-[80px]">{att.name}</span>
                      <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Dropdown @mention */}
              {showMentionPicker && filteredMentionAgents.length > 0 && (
                <div className="rounded-xl border bg-background shadow-lg overflow-hidden">
                  <div className="px-2.5 py-1.5 border-b bg-muted/30">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Convocar agente</p>
                  </div>
                  {filteredMentionAgents.slice(0, 6).map(a => (
                    <button key={a.id} onClick={() => selectMentionAgent(a)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-left text-sm border-b last:border-0">
                      <span className="text-base">{a.avatar || "🤖"}</span>
                      <div>
                        <div className="font-medium text-xs">{a.name}</div>
                        {a.role && <div className="text-[10px] text-muted-foreground">{a.role}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Input row */}
              <div className="flex gap-2 items-end">
                <input ref={fileInputRef} type="file" hidden multiple
                  accept="image/*,text/*,.pdf,.csv,.md,.txt,.json,.xml,.sql"
                  onChange={handleFileChange} />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()} title="Anexar arquivo">
                  <Paperclip className="h-4 w-4" />
                </Button>
                {allAgents.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-purple-600"
                    onClick={() => { setMentionQuery(""); setShowMentionPicker(v => !v); }} title="Convocar agente (@)">
                    <AtSign className="h-4 w-4" />
                  </Button>
                )}
                <div className="relative flex-1">
                  <Textarea
                    ref={inputRef}
                    className="min-h-[40px] max-h-[120px] resize-none text-sm pr-2"
                    placeholder={`Pergunte ao ${delegateAgent?.name || agent.name}… ou @ para convocar agente`}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={e => {
                      if (e.key === "Escape") { setShowMentionPicker(false); setDelegateAgent(null); }
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                    rows={1}
                  />
                </div>
                <Button size="icon" className="h-10 w-10 shrink-0"
                  style={{ backgroundColor: activeColor }}
                  onClick={() => send()} disabled={(!input.trim() && attachments.length === 0) || loading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground">
                Enter para enviar · Shift+Enter para nova linha · @ para convocar agente · 📎 para anexar arquivo
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── System Prompt Editor ─────────────────────────────────────────────────────
// Componente reutilizável: escrever/colar ou importar do Prompt Engine
function SystemPromptEditor({
  value, onChange, minHeight = "180px"
}: { value: string; onChange: (v: string) => void; minHeight?: string }) {
  const [mode, setMode] = useState<"write" | "library">("write");
  const [search, setSearch] = useState("");
  const [previewPrompt, setPreviewPrompt] = useState<any | null>(null);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);

  const { data: prompts = [] } = useQuery<any[]>({ queryKey: ["/api/prompt-engine/prompts"] });

  const filtered = prompts.filter((p: any) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const importPrompt = (p: any) => {
    const content = p.compiledPrompt || p.objetivo || "";
    onChange(content);
    setImportedFrom(p.name);
    setMode("write");
    setPreviewPrompt(null);
  };

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-purple-500" /> System Prompt
        </label>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setMode("write")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${mode === "write" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Edit3 className="h-3 w-3" /> Escrever
          </button>
          <button
            onClick={() => setMode("library")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${mode === "library" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Sparkles className="h-3 w-3" /> Prompt Engine
          </button>
        </div>
      </div>

      {/* Imported badge */}
      {importedFrom && mode === "write" && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-purple-50 border border-purple-200">
          <Sparkles className="h-3 w-3 text-purple-500 shrink-0" />
          <span className="text-xs text-purple-700 flex-1">Importado de: <strong>{importedFrom}</strong></span>
          <button onClick={() => setImportedFrom(null)} className="text-purple-400 hover:text-purple-600">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Write mode */}
      {mode === "write" && (
        <div className="space-y-1">
          <Textarea
            className={`text-sm resize-none font-mono`}
            style={{ minHeight }}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Você é um especialista em... Seu papel é... Você sempre responde em Português do Brasil..."
          />
          <p className="text-[10px] text-muted-foreground">
            {value.length.toLocaleString("pt-BR")} caracteres
            {value.length === 0 && <span className="text-red-400 ml-1">— obrigatório</span>}
          </p>
        </div>
      )}

      {/* Library mode */}
      {mode === "library" && (
        <div className="border rounded-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b bg-muted/30">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm bg-background"
                placeholder="Buscar prompt pelo nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Prompt list */}
          <ScrollArea className="h-56">
            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">
                  {prompts.length === 0 ? "Nenhum prompt desenvolvido ainda." : "Nenhum resultado para a busca."}
                </p>
                {prompts.length === 0 && (
                  <p className="text-xs mt-1 text-muted-foreground/70">
                    Acesse a aba <strong>Prompts</strong> para criar prompts no Prompt Engine.
                  </p>
                )}
              </div>
            )}
            <div className="divide-y">
              {filtered.map((p: any) => (
                <div key={p.id}
                  className={`flex items-start gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors ${previewPrompt?.id === p.id ? "bg-purple-50/60" : ""}`}
                  onClick={() => setPreviewPrompt(previewPrompt?.id === p.id ? null : p)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{p.name}</span>
                      {p.gateScore >= 80 && <span className="text-[9px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200 shrink-0">{p.gateScore}pts</span>}
                      {p.status === "published" && <Badge variant="outline" className="text-[9px] h-4 px-1 border-blue-200 text-blue-600 shrink-0">publicado</Badge>}
                    </div>
                    {p.description && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{p.description}</p>}
                    {/* Preview expandido */}
                    {previewPrompt?.id === p.id && (
                      <div className="mt-2 space-y-2">
                        <pre className="text-[10px] text-muted-foreground bg-muted p-2 rounded-lg whitespace-pre-wrap font-mono max-h-28 overflow-y-auto">
                          {p.compiledPrompt || p.objetivo || "(prompt sem conteúdo compilado)"}
                        </pre>
                        <Button size="sm" className="h-7 gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 w-full" onClick={() => importPrompt(p)}>
                          <Copy className="h-3 w-3" /> Usar este prompt como System Prompt
                        </Button>
                      </div>
                    )}
                  </div>
                  {previewPrompt?.id !== p.id && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0 hover:bg-purple-100 hover:text-purple-700"
                      onClick={(e) => { e.stopPropagation(); importPrompt(p); }}>
                      Usar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t bg-muted/20 flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3 text-yellow-500 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              Clique em um prompt para pré-visualizar · <strong>Usar</strong> para importar como system prompt do agente
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Agent Edit Modal ─────────────────────────────────────────────────────────
function AgentEditModal({ agent, onClose, onSaved }: { agent: Agent & { systemPrompt?: string; system_prompt?: string; triggerKeywords?: string[]; trigger_keywords?: string[]; preferredModel?: string; preferred_model?: string; temperature?: number; maxTokens?: number; max_tokens?: number }; onClose: () => void; onSaved: (updated: Agent) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: agent.name || "",
    description: agent.description || "",
    role: agent.role || "",
    avatar: agent.avatar || "🤖",
    color: agent.color || "#6366f1",
    tone: agent.tone || "",
    domain: agent.domain || "",
    systemPrompt: agent.systemPrompt || agent.system_prompt || "",
    preferredModel: agent.preferredModel || agent.preferred_model || "manus:chat",
    temperature: String(agent.temperature ?? 0.3),
    maxTokens: String(agent.maxTokens || agent.max_tokens || 2000),
    capabilities: (agent.capabilities || []).join("\n"),
    exampleQuestions: (agent.exampleQuestions || []).join("\n"),
    triggerKeywords: (agent.triggerKeywords || agent.trigger_keywords || []).join(", "),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        description: form.description,
        role: form.role,
        avatar: form.avatar,
        color: form.color,
        tone: form.tone,
        domain: form.domain,
        systemPrompt: form.systemPrompt,
        preferredModel: form.preferredModel,
        temperature: parseFloat(form.temperature) || 0.3,
        maxTokens: parseInt(form.maxTokens) || 2000,
        capabilities: form.capabilities.split("\n").map(s => s.trim()).filter(Boolean),
        exampleQuestions: form.exampleQuestions.split("\n").map(s => s.trim()).filter(Boolean),
        triggerKeywords: form.triggerKeywords.split(",").map(s => s.trim()).filter(Boolean),
      };
      const res = await apiRequest("PUT", `/api/prompt-engine/agents/${agent.id}`, body);
      return res.json();
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["/api/prompt-engine/agents"] });
      toast({ title: "Agente atualizado" });
      onSaved(saved);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{form.avatar}</span>
            Editar Agente — {form.name}
            {(agent as any).isBuiltin && <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600 ml-1">Sistema</Badge>}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="px-1 pb-4 space-y-5">
            {/* Identidade */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><Bot className="h-3.5 w-3.5" /> Identidade</h3>
              <div className="grid grid-cols-[80px_1fr_120px] gap-3 mb-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Avatar</label>
                  <Input className="h-9 text-xl text-center" value={form.avatar} onChange={e => set("avatar", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Nome *</label>
                  <Input className="h-9 text-sm" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Nome do agente..." />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Cor</label>
                  <div className="flex gap-2">
                    <input type="color" className="h-9 w-10 rounded border cursor-pointer" value={form.color} onChange={e => set("color", e.target.value)} />
                    <Input className="h-9 text-xs font-mono flex-1" value={form.color} onChange={e => set("color", e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Cargo / Papel</label>
                  <Input className="h-9 text-sm" value={form.role} onChange={e => set("role", e.target.value)} placeholder="Ex: Especialista ERPNext" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Domínio</label>
                  <Input className="h-9 text-sm" value={form.domain} onChange={e => set("domain", e.target.value)} placeholder="Ex: ERP, Fiscal, CRM..." />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <label className="text-xs font-medium">Descrição</label>
                <Textarea className="text-sm resize-none min-h-[60px]" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descreva o que este agente faz..." />
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <SystemPromptEditor
                value={form.systemPrompt}
                onChange={v => set("systemPrompt", v)}
                minHeight="200px"
              />
            </div>

            {/* Comportamento */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Comportamento do Modelo</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Modo Manus</label>
                  <Select value={form.preferredModel} onValueChange={v => set("preferredModel", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manus:agents">🧠 Manus Agents (padrão)</SelectItem>
                      <SelectItem value="manus:chat">⚡ Manus Chat (rápido)</SelectItem>
                      <SelectItem value="manus:analysis">🔬 Manus Analysis (preciso)</SelectItem>
                      <SelectItem value="manus:research">🔍 Manus Research (profundo)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[9px] text-muted-foreground">Todos usam o motor Manus do Arcádia Suite</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium flex items-center gap-1"><Thermometer className="h-3 w-3" /> Temperatura</label>
                  <Input className="h-9 text-sm" type="number" min="0" max="2" step="0.05" value={form.temperature} onChange={e => set("temperature", e.target.value)} />
                  <p className="text-[9px] text-muted-foreground">0 = preciso · 1 = criativo</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium flex items-center gap-1"><Hash className="h-3 w-3" /> Max Tokens</label>
                  <Input className="h-9 text-sm" type="number" min="500" max="16000" step="500" value={form.maxTokens} onChange={e => set("maxTokens", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Tom de Voz</label>
                  <Select value={form.tone} onValueChange={v => set("tone", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{["Formal","Técnico","Amigável","Persuasivo","Empático","Analítico","Direto","Criativo"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium flex items-center gap-1"><Tag className="h-3 w-3" /> Palavras-chave de ativação</label>
                  <Input className="h-9 text-sm" value={form.triggerKeywords} onChange={e => set("triggerKeywords", e.target.value)} placeholder="erp, estoque, fiscal..." />
                  <p className="text-[9px] text-muted-foreground">Separadas por vírgula</p>
                </div>
              </div>
            </div>

            {/* Capacidades e exemplos */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Capacidades</h3>
                <Textarea className="text-sm resize-none min-h-[120px]" value={form.capabilities} onChange={e => set("capabilities", e.target.value)} placeholder={"Consultas técnicas ERPNext\nDiagnóstico de problemas\nConfiguração de módulos"} />
                <p className="text-[9px] text-muted-foreground mt-1">Uma capacidade por linha</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Exemplos de Perguntas</h3>
                <Textarea className="text-sm resize-none min-h-[120px]" value={form.exampleQuestions} onChange={e => set("exampleQuestions", e.target.value)} placeholder={"Como configurar o plano de contas?\nQual o fluxo de aprovação de uma PO?"} />
                <p className="text-[9px] text-muted-foreground mt-1">Uma pergunta por linha</p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 shrink-0 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700"
            onClick={() => updateMut.mutate()} disabled={!form.name || updateMut.isPending}>
            <Save className="h-3.5 w-3.5" />
            {updateMut.isPending ? "Salvando…" : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Agent Modal ──────────────────────────────────────────────────────────
function NewAgentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (a: Agent) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", description: "", role: "", avatar: "🤖", color: "#6366f1", systemPrompt: "", tone: "Técnico", preferredModel: "manus:chat", temperature: "0.3", maxTokens: "2000", capabilities: "", exampleQuestions: "" });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const createMut = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name, description: form.description, role: form.role,
        avatar: form.avatar, color: form.color, systemPrompt: form.systemPrompt,
        tone: form.tone, preferredModel: form.preferredModel,
        temperature: parseFloat(form.temperature) || 0.3,
        maxTokens: parseInt(form.maxTokens) || 2000,
        capabilities: form.capabilities.split("\n").map(s => s.trim()).filter(Boolean),
        exampleQuestions: form.exampleQuestions.split("\n").map(s => s.trim()).filter(Boolean),
      };
      const res = await apiRequest("POST", "/api/prompt-engine/agents", body);
      return res.json();
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["/api/prompt-engine/agents"] });
      toast({ title: "Agente criado" });
      onCreated(created);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Novo Agente Especializado</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[72px_1fr_100px] gap-2">
            <div className="space-y-1"><label className="text-xs font-medium">Avatar</label><Input className="h-9 text-xl text-center" value={form.avatar} onChange={e => set("avatar", e.target.value)} /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Nome *</label><Input className="h-9 text-sm" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Analista Fiscal" /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Cor</label><input type="color" className="h-9 w-full rounded border cursor-pointer" value={form.color} onChange={e => set("color", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><label className="text-xs font-medium">Cargo / Papel</label><Input className="h-9 text-sm" value={form.role} onChange={e => set("role", e.target.value)} placeholder="Ex: Especialista Fiscal" /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Tom</label>
              <Select value={form.tone} onValueChange={v => set("tone", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{["Formal","Técnico","Amigável","Empático","Analítico","Direto"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Modo Manus</label>
              <Select value={form.preferredModel} onValueChange={v => set("preferredModel", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manus:agents">🧠 Agents (padrão)</SelectItem>
                  <SelectItem value="manus:chat">⚡ Chat (rápido)</SelectItem>
                  <SelectItem value="manus:analysis">🔬 Analysis</SelectItem>
                  <SelectItem value="manus:research">🔍 Research</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Temperatura</label>
              <Input className="h-9 text-sm" type="number" min="0" max="1" step="0.05" value={form.temperature} onChange={e => set("temperature", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Max Tokens</label>
              <Input className="h-9 text-sm" type="number" min="500" max="16000" step="500" value={form.maxTokens} onChange={e => set("maxTokens", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1"><label className="text-xs font-medium">Descrição</label><Textarea className="text-sm resize-none min-h-[50px]" value={form.description} onChange={e => set("description", e.target.value)} placeholder="O que este agente faz..." /></div>
          <SystemPromptEditor
            value={form.systemPrompt}
            onChange={v => set("systemPrompt", v)}
            minHeight="110px"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs font-medium">Capacidades (1 por linha)</label><Textarea className="text-sm resize-none min-h-[70px]" value={form.capabilities} onChange={e => set("capabilities", e.target.value)} placeholder={"Consultas técnicas\nDiagnóstico"} /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Exemplos de perguntas</label><Textarea className="text-sm resize-none min-h-[70px]" value={form.exampleQuestions} onChange={e => set("exampleQuestions", e.target.value)} placeholder={"Como fazer X?\nQual o fluxo de Y?"} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 gap-1.5" onClick={() => createMut.mutate()} disabled={!form.name || !form.systemPrompt || createMut.isPending}>
            <Plus className="h-3.5 w-3.5" />{createMut.isPending ? "Criando…" : "Criar Agente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────
function AgentCard({ agent, onClick, onEdit }: { agent: Agent; onClick: () => void; onEdit: (e: React.MouseEvent) => void }) {
  return (
    <div className="group relative">
      <button onClick={onClick} className="w-full text-left">
        <Card className="border hover:border-primary/40 hover:shadow-md transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-sm" style={{ backgroundColor: (agent.color || "#6366f1") + "22" }}>
                {agent.avatar || "🤖"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm">{agent.name}</span>
                  {agent.isBuiltin && <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-300 text-blue-600">Sistema</Badge>}
                </div>
                {agent.role && <p className="text-xs text-muted-foreground mb-1.5">{agent.role}</p>}
                {agent.description && <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>}
                {agent.capabilities && agent.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {agent.capabilities.slice(0, 3).map(c => (
                      <span key={c} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{c}</span>
                    ))}
                    {agent.capabilities.length > 3 && <span className="text-[10px] text-muted-foreground">+{agent.capabilities.length - 3}</span>}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
            </div>
          </CardContent>
        </Card>
      </button>
      {/* Edit button — aparece no hover */}
      <button onClick={onEdit}
        className="absolute top-2 right-9 opacity-0 group-hover:opacity-100 transition-opacity bg-background border rounded-md p-1.5 shadow-sm hover:border-purple-400 hover:text-purple-600"
        title="Editar agente">
        <Edit3 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Agents Tab ───────────────────────────────────────────────────────────────
function AgentsTab() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [showNewAgent, setShowNewAgent] = useState(false);
  const { data: agents = [], refetch } = useQuery<Agent[]>({ queryKey: ["/api/prompt-engine/agents"] });
  const { toast } = useToast();
  const qc = useQueryClient();

  const builtins = agents.filter((a: Agent) => (a as any).isBuiltin || a.scope === "global");
  const customs = agents.filter((a: Agent) => !(a as any).isBuiltin && a.scope !== "global");

  const handleEdit = (e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation();
    // Buscar dados completos do agente para edição
    fetch(`/api/prompt-engine/agents/${agent.id}`, { credentials: "include" })
      .then(r => r.json())
      .then(full => setEditingAgent(full))
      .catch(() => setEditingAgent(agent));
  };

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/prompt-engine/agents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/prompt-engine/agents"] }); toast({ title: "Agente excluído" }); },
  });

  if (selectedAgent) return (
    <>
      <AgentChat
        agent={selectedAgent}
        onBack={() => setSelectedAgent(null)}
        allAgents={agents}
        onEdit={() => {
          fetch(`/api/prompt-engine/agents/${selectedAgent.id}`, { credentials: "include" })
            .then(r => r.json()).then(full => setEditingAgent(full)).catch(() => setEditingAgent(selectedAgent));
        }}
      />
      {editingAgent && (
        <AgentEditModal
          agent={editingAgent as any}
          onClose={() => setEditingAgent(null)}
          onSaved={() => { setEditingAgent(null); refetch(); }}
        />
      )}
    </>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {editingAgent && (
        <AgentEditModal
          agent={editingAgent as any}
          onClose={() => setEditingAgent(null)}
          onSaved={(updated) => { setEditingAgent(null); refetch(); }}
        />
      )}
      {showNewAgent && (
        <NewAgentModal onClose={() => setShowNewAgent(false)} onCreated={(a) => { setShowNewAgent(false); refetch(); }} />
      )}

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-purple-500" /> Agentes Especializados
            </h2>
            <p className="text-sm text-muted-foreground">Agentes com conhecimento especializado. Converse e edite à vontade.</p>
          </div>
          <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 shrink-0" onClick={() => setShowNewAgent(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo Agente
          </Button>
        </div>

        {/* Oráculo NEXT destaque */}
        {builtins.filter((a: Agent) => (a as any).slug === "oraculo-next").map((agent: Agent) => (
          <div key={(agent as any).id || (agent as any).slug} className="relative group/orb">
            <button onClick={() => setSelectedAgent(agent)} className="w-full text-left">
              <div className="rounded-2xl p-5 text-white cursor-pointer hover:shadow-xl transition-all hover:scale-[1.005]" style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%)" }}>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl shrink-0">
                    {agent.avatar || "🏛️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold">{agent.name}</h3>
                      <Badge className="bg-white/20 text-white border-0 text-[10px]">Sistema</Badge>
                    </div>
                    <p className="text-blue-100 text-sm mb-3 line-clamp-2">{agent.description}</p>
                    {agent.capabilities && (
                      <div className="flex flex-wrap gap-1.5">
                        {agent.capabilities.slice(0, 5).map(c => (
                          <span key={c} className="text-xs bg-white/15 px-2 py-0.5 rounded-full">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-white/20 rounded-xl p-2 shrink-0 group-hover/orb:bg-white/30 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </button>
            {/* Edit button */}
            <button onClick={(e) => handleEdit(e, agent)}
              className="absolute top-3 right-14 opacity-0 group-hover/orb:opacity-100 transition-opacity bg-white/20 hover:bg-white/40 text-white rounded-lg p-1.5"
              title="Editar agente">
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {/* Outros agentes builtin */}
        {builtins.filter((a: Agent) => (a as any).slug !== "oraculo-next").length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outros Agentes do Sistema</h3>
            {builtins.filter((a: Agent) => (a as any).slug !== "oraculo-next").map((a: Agent) => (
              <AgentCard key={(a as any).id || (a as any).slug} agent={a}
                onClick={() => setSelectedAgent(a)}
                onEdit={(e) => handleEdit(e, a)} />
            ))}
          </div>
        )}

        {/* Agentes customizados */}
        {customs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agentes Customizados</h3>
            {customs.map((a: Agent) => (
              <AgentCard key={(a as any).id} agent={a}
                onClick={() => setSelectedAgent(a)}
                onEdit={(e) => handleEdit(e, a)} />
            ))}
          </div>
        )}

        {agents.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nenhum agente disponível</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Prompt Builder Tab ───────────────────────────────────────────────────────
function PromptBuilderTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"gates"|"compiled"|"history">("gates");
  const [activeSection, setActiveSection] = useState("objetivo");
  const [current, setCurrent] = useState<PromptData>({ name: "Novo Prompt", roteiro: [], modeloSaida: {} });
  const [isDirty, setIsDirty] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execOutput, setExecOutput] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [compiledView, setCompiledView] = useState("");
  const [searchPrompts, setSearchPrompts] = useState("");
  const [showNewPersona, setShowNewPersona] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newPersona, setNewPersona] = useState<Partial<Persona>>({ avatar: "🤖", color: "#6366f1" });

  const { data: prompts = [] } = useQuery<PromptData[]>({ queryKey: ["/api/prompt-engine/prompts"] });
  const { data: personas = [] } = useQuery<Persona[]>({ queryKey: ["/api/prompt-engine/personas"] });
  const { data: templates = [] } = useQuery<Template[]>({ queryKey: ["/api/prompt-engine/templates"] });

  const savePromptMut = useMutation({
    mutationFn: async (data: PromptData) => {
      const res = data.id ? await apiRequest("PUT", `/api/prompt-engine/prompts/${data.id}`, data) : await apiRequest("POST", "/api/prompt-engine/prompts", data);
      return res.json();
    },
    onSuccess: (saved) => { setCurrent(saved); setIsDirty(false); qc.invalidateQueries({ queryKey: ["/api/prompt-engine/prompts"] }); toast({ title: "Prompt salvo" }); },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const deletePromptMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/prompt-engine/prompts/${id}`),
    onSuccess: () => { setCurrent({ name: "Novo Prompt", roteiro: [], modeloSaida: {} }); qc.invalidateQueries({ queryKey: ["/api/prompt-engine/prompts"] }); toast({ title: "Prompt excluído" }); },
  });

  const savePersonaMut = useMutation({
    mutationFn: async (p: Partial<Persona>) => { const res = await apiRequest("POST", "/api/prompt-engine/personas", p); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/prompt-engine/personas"] }); setShowNewPersona(false); setNewPersona({ avatar: "🤖", color: "#6366f1" }); },
  });

  const update = useCallback((field: string, value: any) => { setCurrent(p => ({ ...p, [field]: value })); setIsDirty(true); }, []);
  const addStep = () => { const s = current.roteiro || []; update("roteiro", [...s, { text: "", order: s.length + 1 }]); };
  const updateStep = (idx: number, text: string) => { const s = [...(current.roteiro || [])]; s[idx] = { ...s[idx], text }; update("roteiro", s); };
  const removeStep = (idx: number) => update("roteiro", (current.roteiro || []).filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  const loadTemplate = (t: Template) => { setCurrent(p => ({ ...p, ...t.promptData, name: p.name })); setIsDirty(true); setShowTemplates(false); toast({ title: `Template "${t.name}" carregado` }); };

  const execute = async () => {
    setIsExecuting(true); setExecOutput("");
    try {
      const res = await apiRequest("POST", "/api/prompt-engine/test", { promptData: current, userMessage: testMessage || undefined });
      const data = await res.json();
      setExecOutput(data.output || ""); setCompiledView(data.compiledPrompt || ""); setRightTab("compiled");
    } catch { toast({ title: "Erro ao executar", variant: "destructive" }); } finally { setIsExecuting(false); }
  };

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!isDirty) return;
      try {
        const res = await apiRequest("POST", "/api/prompt-engine/compile", { promptData: current });
        const data = await res.json();
        setCompiledView(data.compiled || ""); setCurrent(p => ({ ...p, gates: data.gates, gateScore: data.score }));
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [current.objetivo, current.roteiro, current.personaId, current.modeloSaida, current.publico, current.tom, current.contexto, isDirty]);

  const gates = current.gates || {};
  const score = current.gateScore || 0;
  const selectedPersona = personas.find(p => p.id === current.personaId);
  const filteredPrompts = prompts.filter(p => p.name?.toLowerCase().includes(searchPrompts.toLowerCase()));

  return (
    <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <div className={`flex flex-col border-r bg-muted/30 transition-all duration-200 ${sidebarOpen ? "w-60" : "w-0 overflow-hidden"}`}>
        <div className="px-2 py-2 border-b flex gap-1.5">
          <Button size="sm" className="flex-1 gap-1.5 h-7 text-xs" onClick={() => { setCurrent({ name: "Novo Prompt", roteiro: [], modeloSaida: {} }); setIsDirty(false); }}>
            <Plus className="h-3 w-3" /> Novo
          </Button>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowTemplates(true)}>
            <Layout className="h-3 w-3" />
          </Button>
        </div>
        <div className="px-2 py-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input className="pl-6 h-7 text-xs" placeholder="Buscar..." value={searchPrompts} onChange={e => setSearchPrompts(e.target.value)} />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-2 pb-2 space-y-0.5">
            {filteredPrompts.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum prompt ainda</p>}
            {filteredPrompts.map(p => (
              <button key={p.id} onClick={() => { setCurrent(p); setIsDirty(false); }}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-muted flex items-center gap-1.5 ${current.id === p.id ? "bg-muted font-medium" : ""}`}>
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{p.name}</span>
                <span className={`text-[10px] font-medium ${p.gateScore && p.gateScore >= 80 ? "text-green-500" : p.gateScore && p.gateScore >= 50 ? "text-yellow-500" : "text-red-400"}`}>{p.gateScore ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="px-2 pt-2 border-t">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-1">Personas</p>
            {personas.map(p => (
              <button key={p.id} onClick={() => { update("personaId", p.id); setActiveSection("persona"); }}
                className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-muted flex items-center gap-1.5 mb-0.5 ${current.personaId === p.id ? "bg-muted" : ""}`}>
                <span>{p.avatar || "🤖"}</span><span className="truncate">{p.name}</span>
                {current.personaId === p.id && <CheckCircle className="h-2.5 w-2.5 text-green-500 ml-auto" />}
              </button>
            ))}
            <button onClick={() => setShowNewPersona(true)} className="w-full text-left px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5">
              <Plus className="h-3 w-3" /> Nova persona
            </button>
          </div>
        </ScrollArea>
      </div>

      {/* Main editor */}
      <div className="flex flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarOpen(v => !v)}>
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <Input className="h-7 text-sm font-medium border-none shadow-none focus-visible:ring-0 px-0 max-w-xs"
              value={current.name} onChange={e => update("name", e.target.value)} placeholder="Nome do prompt..." />
            {isDirty && <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-400">não salvo</Badge>}
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => savePromptMut.mutate(current)} disabled={savePromptMut.isPending}>
                <Save className="h-3.5 w-3.5" /> {savePromptMut.isPending ? "…" : "Salvar"}
              </Button>
              <Button size="sm" className="h-7 gap-1 text-xs bg-purple-600 hover:bg-purple-700" onClick={execute} disabled={isExecuting}>
                <Play className="h-3.5 w-3.5" /> {isExecuting ? "…" : "Executar"}
              </Button>
              {current.id && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deletePromptMut.mutate(current.id!)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>}
            </div>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Section nav */}
            <div className="flex flex-col gap-0.5 px-1 py-2 border-r bg-muted/20 w-10">
              {Object.entries(SECTIONS).map(([key, s]) => {
                const Icon = s.icon; const gateOk = gates[key];
                return (
                  <button key={key} onClick={() => setActiveSection(key)} title={s.label}
                    className={`relative flex items-center justify-center h-8 w-8 rounded-md transition-colors ${activeSection === key ? "bg-background shadow-sm" : "hover:bg-muted"}`}>
                    <Icon className={`h-3.5 w-3.5 ${activeSection === key ? s.color : "text-muted-foreground"}`} />
                    {gateOk !== undefined && <span className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${gateOk ? "bg-green-500" : "bg-red-400"}`} />}
                  </button>
                );
              })}
            </div>

            {/* Section content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Section header */}
                {SECTIONS[activeSection] && (() => {
                  const s = SECTIONS[activeSection]; const Icon = s.icon;
                  return (
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`h-4 w-4 ${s.color}`} />
                      <h2 className="font-semibold">{s.label}</h2>
                      {gates[activeSection] !== undefined && (
                        <Badge variant="outline" className={`ml-auto text-xs ${gates[activeSection] ? "border-green-400 text-green-600" : "border-red-300 text-red-500"}`}>
                          {gates[activeSection] ? "✓ ok" : "pendente"}
                        </Badge>
                      )}
                    </div>
                  );
                })()}

                {activeSection === "objetivo" && (
                  <Textarea className="min-h-[140px] text-sm resize-none" placeholder="O que este prompt deve alcançar? Seja específico e mensurável..."
                    value={current.objetivo || ""} onChange={e => update("objetivo", e.target.value)} />
                )}

                {activeSection === "persona" && (
                  <div className="space-y-3">
                    {selectedPersona ? (
                      <Card className="border-2 border-purple-200 bg-purple-50/50">
                        <CardContent className="p-3 flex items-start gap-3">
                          <span className="text-2xl">{selectedPersona.avatar || "🤖"}</span>
                          <div className="flex-1"><div className="font-medium text-sm">{selectedPersona.name}</div>{selectedPersona.role && <div className="text-xs text-muted-foreground">{selectedPersona.role}</div>}</div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => update("personaId", undefined)}><X className="h-3 w-3" /></Button>
                        </CardContent>
                      </Card>
                    ) : <p className="text-sm text-muted-foreground border-2 border-dashed rounded-lg p-4 text-center">Nenhuma persona selecionada</p>}
                    <div className="grid grid-cols-2 gap-2">
                      {personas.map(p => (
                        <button key={p.id} onClick={() => update("personaId", p.id)}
                          className={`text-left p-2 rounded-lg border text-xs hover:border-purple-400 transition-colors ${current.personaId === p.id ? "border-purple-500 bg-purple-50" : ""}`}>
                          <span className="text-base">{p.avatar || "🤖"}</span>
                          <div className="font-medium mt-1 truncate">{p.name}</div>
                          {p.role && <div className="text-muted-foreground truncate">{p.role}</div>}
                        </button>
                      ))}
                      <button onClick={() => setShowNewPersona(true)} className="p-2 rounded-lg border-2 border-dashed text-xs text-muted-foreground hover:border-purple-400 hover:text-purple-600 flex flex-col items-center justify-center gap-1">
                        <Plus className="h-4 w-4" /> Nova persona
                      </button>
                    </div>
                  </div>
                )}

                {activeSection === "roteiro" && (
                  <div className="space-y-2">
                    {(current.roteiro || []).map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold shrink-0">{idx + 1}</span>
                        <Input className="flex-1 text-sm" value={step.text} onChange={e => updateStep(idx, e.target.value)} placeholder={`Passo ${idx + 1}...`} />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 shrink-0" onClick={() => removeStep(idx)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addStep}><Plus className="h-3.5 w-3.5" /> Adicionar passo</Button>
                  </div>
                )}

                {activeSection === "modeloSaida" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Formato</label>
                      <Select value={current.modeloSaida?.format || ""} onValueChange={v => update("modeloSaida", { ...current.modeloSaida, format: v })}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>{FORMATO_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Tamanho máximo (palavras)</label>
                      <Input className="h-8 text-sm" type="number" placeholder="Ex: 500" value={current.modeloSaida?.maxLength || ""} onChange={e => update("modeloSaida", { ...current.modeloSaida, maxLength: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Exemplo de saída</label>
                      <Textarea className="min-h-[80px] text-sm resize-none" placeholder="Como deve ser a resposta ideal..." value={current.modeloSaida?.example || ""} onChange={e => update("modeloSaida", { ...current.modeloSaida, example: e.target.value })} />
                    </div>
                  </div>
                )}

                {activeSection === "publico" && (
                  <Textarea className="min-h-[120px] text-sm resize-none" placeholder="Para quem é este prompt? Ex: Executivos C-level sem formação técnica..."
                    value={current.publico || ""} onChange={e => update("publico", e.target.value)} />
                )}

                {activeSection === "tom" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {TOM_OPTIONS.map(t => (
                        <button key={t} onClick={() => update("tom", t)}
                          className={`px-3 py-2 rounded-lg text-sm border transition-colors ${current.tom === t ? "border-purple-500 bg-purple-50 text-purple-700 font-medium" : "hover:border-muted-foreground/40"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <Input className="h-8 text-sm" placeholder="Tom personalizado..." value={current.tom || ""} onChange={e => update("tom", e.target.value)} />
                  </div>
                )}

                {activeSection === "contexto" && (
                  <Textarea className="min-h-[160px] text-sm resize-none" placeholder="Contexto, background ou cenário que o agente precisa conhecer..."
                    value={current.contexto || ""} onChange={e => update("contexto", e.target.value)} />
                )}

                {activeSection === "restricoes" && (
                  <Textarea className="min-h-[120px] text-sm resize-none" placeholder="O que o agente NÃO deve fazer. Limites, proibições, regras de compliance..."
                    value={current.restricoes || ""} onChange={e => update("restricoes", e.target.value)} />
                )}

                {/* Test */}
                <div className="pt-3 border-t">
                  <div className="flex gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="Mensagem de teste (opcional)..."
                      value={testMessage} onChange={e => setTestMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") execute(); }} />
                    <Button size="sm" className="h-8 gap-1 bg-purple-600 hover:bg-purple-700" onClick={execute} disabled={isExecuting}>
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {execOutput && (
                  <Card className="border-green-200 bg-green-50/50">
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-xs text-green-700 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" /> Resultado
                        <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => { navigator.clipboard.writeText(execOutput); toast({ title: "Copiado!" }); }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <pre className="text-xs whitespace-pre-wrap font-sans">{execOutput}</pre>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-60 border-l flex flex-col bg-muted/20">
          <Tabs value={rightTab} onValueChange={v => setRightTab(v as any)} className="flex flex-col flex-1 min-h-0">
            <TabsList className="w-full rounded-none border-b h-8 bg-transparent shrink-0">
              <TabsTrigger value="gates" className="flex-1 text-xs h-7">Gates</TabsTrigger>
              <TabsTrigger value="compiled" className="flex-1 text-xs h-7">Compilado</TabsTrigger>
              <TabsTrigger value="history" className="flex-1 text-xs h-7">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="gates" className="flex-1 overflow-y-auto m-0 p-3 space-y-1">
              <GaugeScore score={score} />
              {GATES.map(g => {
                const ok = gates[g.key]; const Icon = ok ? CheckCircle : g.required ? AlertCircle : Circle;
                return (
                  <button key={g.key} onClick={() => setActiveSection(g.key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted ${activeSection === g.key ? "bg-muted" : ""}`}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${ok ? "text-green-500" : g.required ? "text-red-400" : "text-muted-foreground"}`} />
                    <div className="flex-1 text-left">
                      <div className={`font-medium ${ok ? "" : g.required ? "text-red-500" : "text-muted-foreground"}`}>{g.label}</div>
                      <div className="text-muted-foreground text-[10px]">{g.description}</div>
                    </div>
                  </button>
                );
              })}
            </TabsContent>
            <TabsContent value="compiled" className="flex-1 min-h-0 m-0 flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 border-b">
                <span className="text-xs font-medium">Compilado</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(compiledView); toast({ title: "Copiado!" }); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <pre className="p-3 text-[10px] whitespace-pre-wrap font-mono text-muted-foreground">{compiledView || "Preencha as seções..."}</pre>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="history" className="flex-1 overflow-y-auto m-0 p-3">
              {current.id ? <HistoryPanel promptId={current.id} /> : <p className="text-xs text-muted-foreground text-center py-6">Salve o prompt primeiro</p>}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Template dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Biblioteca de Templates</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
            {templates.map(t => (
              <button key={t.id} onClick={() => loadTemplate(t)} className="text-left p-3 rounded-lg border hover:border-purple-400 hover:bg-purple-50/50">
                <div className="flex items-center gap-2 mb-1"><span className="text-xl">{t.icon || "📄"}</span><Badge variant="secondary" className="text-[10px]">{t.category}</Badge></div>
                <div className="font-medium text-sm">{t.name}</div>
                {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* New persona dialog */}
      <Dialog open={showNewPersona} onOpenChange={setShowNewPersona}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Persona</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="space-y-1 w-20"><label className="text-xs font-medium">Avatar</label><Input className="h-8 text-center text-xl" value={newPersona.avatar || "🤖"} onChange={e => setNewPersona(p => ({ ...p, avatar: e.target.value }))} /></div>
              <div className="space-y-1 flex-1"><label className="text-xs font-medium">Nome *</label><Input className="h-8 text-sm" placeholder="Ex: Analista Financeiro" value={newPersona.name || ""} onChange={e => setNewPersona(p => ({ ...p, name: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><label className="text-xs font-medium">Cargo/Papel</label><Input className="h-8 text-sm" placeholder="Ex: CFO virtual" value={newPersona.role || ""} onChange={e => setNewPersona(p => ({ ...p, role: e.target.value }))} /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Tom</label>
              <Select value={newPersona.tone || ""} onValueChange={v => setNewPersona(p => ({ ...p, tone: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>{TOM_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><label className="text-xs font-medium">System prompt</label><Textarea className="min-h-[80px] text-sm resize-none" placeholder="Você é um especialista em..." value={newPersona.systemPrompt || ""} onChange={e => setNewPersona(p => ({ ...p, systemPrompt: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowNewPersona(false)}>Cancelar</Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => savePersonaMut.mutate(newPersona)} disabled={!newPersona.name || savePersonaMut.isPending}>
              {savePersonaMut.isPending ? "…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── History Panel ─────────────────────────────────────────────────────────────
function HistoryPanel({ promptId }: { promptId: string }) {
  const { data: execs = [] } = useQuery<any[]>({ queryKey: [`/api/prompt-engine/prompts/${promptId}/executions`], refetchInterval: 10000 });
  if (!execs.length) return <p className="text-xs text-muted-foreground text-center py-6">Nenhuma execução ainda</p>;
  return (
    <div className="space-y-2">
      {execs.map((e: any) => (
        <div key={e.id} className="p-2 rounded-lg border bg-background text-xs">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <Clock className="h-3 w-3" />
            <span>{new Date(e.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            {e.durationMs && <span className="ml-auto">{(e.durationMs / 1000).toFixed(1)}s</span>}
          </div>
          {e.output && <p className="text-foreground line-clamp-3">{e.output}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PromptEngine() {
  const [, navigate] = useLocation();
  const [mainTab, setMainTab] = useState("agents");

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Page header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/development")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Wand2 className="h-5 w-5 text-purple-500" />
        <span className="font-semibold text-sm">Prompt Engine</span>
        <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-300">Arcádia Suite</Badge>
        <Tabs value={mainTab} onValueChange={setMainTab} className="ml-4">
          <TabsList className="h-7 bg-muted/50">
            <TabsTrigger value="agents" className="text-xs h-6 gap-1.5 px-3">
              <Bot className="h-3.5 w-3.5" /> Agentes
            </TabsTrigger>
            <TabsTrigger value="prompts" className="text-xs h-6 gap-1.5 px-3">
              <Sparkles className="h-3.5 w-3.5" /> Prompts
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {mainTab === "agents" && <AgentsTab />}
        {mainTab === "prompts" && <PromptBuilderTab />}
      </div>
    </div>
  );
}
