import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  Bot, Send, Sparkles, Database, Layout, GitBranch, 
  Code2, Loader2, CheckCircle, AlertCircle, Lightbulb,
  Wand2, FileCode, Zap, ArrowRight
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  action?: {
    type: "create_doctype" | "create_page" | "create_workflow" | "generate_code";
    status: "pending" | "executing" | "completed" | "failed";
    result?: any;
  };
}

const suggestions = [
  { icon: Database, text: "Criar um DocType para cadastro de clientes", category: "DocType" },
  { icon: Layout, text: "Criar uma página de listagem com filtros", category: "Página" },
  { icon: GitBranch, text: "Criar workflow de aprovação de documentos", category: "Workflow" },
  { icon: Code2, text: "Gerar script de validação de campos", category: "Script" },
  { icon: Zap, text: "Criar dashboard com KPIs de vendas", category: "Dashboard" },
];

export default function DevAgent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! Sou o Dev Agent, seu assistente de desenvolvimento. Posso ajudar você a:\n\n• Criar DocTypes (entidades de dados)\n• Montar Páginas visuais\n• Configurar Workflows de automação\n• Gerar Scripts personalizados\n• Construir Dashboards e Relatórios\n\nO que você gostaria de criar hoje?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (userMessage: string) => {
      const res = await fetch("/api/dev-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage,
          context: "development",
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
        })
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        action: data.action
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    },
    onError: () => {
      const errorMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
    }
  });

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    sendMessage.mutate(input);
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === "user";

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      >
        <div className={`flex items-start gap-3 max-w-[80%] ${isUser ? "flex-row-reverse" : ""}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? "bg-blue-600" : "bg-gradient-to-br from-violet-500 to-purple-600"
          }`}>
            {isUser ? (
              <span className="text-white text-sm font-medium">U</span>
            ) : (
              <Bot className="w-4 h-4 text-white" />
            )}
          </div>
          <div className={`rounded-2xl px-4 py-3 ${
            isUser 
              ? "bg-blue-600 text-white" 
              : "bg-white border shadow-sm"
          }`}>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            
            {message.action && (
              <div className={`mt-3 p-3 rounded-lg ${
                message.action.status === "completed" ? "bg-green-50 border border-green-200" :
                message.action.status === "failed" ? "bg-red-50 border border-red-200" :
                "bg-blue-50 border border-blue-200"
              }`}>
                <div className="flex items-center gap-2">
                  {message.action.status === "executing" && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  )}
                  {message.action.status === "completed" && (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                  {message.action.status === "failed" && (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">
                    {message.action.type === "create_doctype" && "Criando DocType..."}
                    {message.action.type === "create_page" && "Criando Página..."}
                    {message.action.type === "create_workflow" && "Criando Workflow..."}
                    {message.action.type === "generate_code" && "Gerando código..."}
                  </span>
                </div>
                {message.action.result && (
                  <div className="mt-2 text-xs text-gray-600">
                    {JSON.stringify(message.action.result, null, 2)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold">Dev Agent</h2>
            <p className="text-sm text-white/80">Assistente de desenvolvimento low-code</p>
          </div>
          <Badge variant="secondary" className="ml-auto bg-white/20 text-white hover:bg-white/30">
            <Sparkles className="w-3 h-3 mr-1" />
            AI Powered
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.map(renderMessage)}
        
        {isTyping && (
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border shadow-sm rounded-2xl px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </ScrollArea>

      {messages.length === 1 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-gray-600">Sugestões para começar</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestion(suggestion.text)}
                className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:bg-gray-50 hover:border-violet-300 transition-colors text-left group"
                data-testid={`dev-suggestion-${idx}`}
              >
                <div className="p-2 bg-violet-100 rounded-lg group-hover:bg-violet-200 transition-colors">
                  <suggestion.icon className="w-4 h-4 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{suggestion.text}</p>
                </div>
                <Badge variant="outline" className="text-xs">{suggestion.category}</Badge>
                <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Descreva o que você quer criar..."
            className="flex-1"
            disabled={isTyping}
            data-testid="dev-agent-input"
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isTyping}
            className="bg-violet-600 hover:bg-violet-700"
            data-testid="dev-agent-send"
          >
            {isTyping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          O Dev Agent usa IA para criar componentes automaticamente
        </p>
      </div>
    </div>
  );
}
