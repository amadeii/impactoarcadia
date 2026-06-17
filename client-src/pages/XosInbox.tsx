import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import {
  MessageSquare, ArrowLeft, Search, MoreVertical, Send, Phone,
  Mail, Bot, Clock, Check, CheckCheck, Paperclip,
  Smile, Mic, Plus, Star, Archive, Trash2, Tag, Users, StickyNote,
  Zap, ArrowRightLeft, ChevronDown, Pin, X, Calendar, Settings,
  QrCode, Loader2, RefreshCw, LogOut, Wifi, WifiOff, Smartphone,
  BarChart3, MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import QRCode from "qrcode";

interface Conversation {
  id: number;
  contact_id: number;
  contact_name: string;
  contact_email: string;
  contact_avatar: string;
  contact_whatsapp: string;
  channel: string;
  status: string;
  priority: string;
  subject: string;
  last_message: string;
  messages_count: number;
  queue_id: number | null;
  queue_name: string | null;
  queue_color: string | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: number;
  conversation_id: number;
  direction: string;
  sender_type: string;
  sender_name: string;
  content: string;
  content_type: string;
  attachments: any;
  read_at: string;
  delivered_at: string;
  created_at: string;
}

interface Queue {
  id: number;
  name: string;
  color: string;
  users_count: number;
  open_conversations: number;
}

interface InternalNote {
  id: number;
  content: string;
  user_name: string;
  is_pinned: boolean;
  created_at: string;
}

interface QuickMessage {
  id: number;
  shortcode: string;
  title: string;
  content: string;
}

interface WhatsAppStatus {
  status: "disconnected" | "connecting" | "qr_pending" | "connected";
  qrCode: string | null;
  phoneNumber: string | null;
}

interface WhatsAppTicket {
  id: number;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  contact: {
    id: number;
    whatsappId: string;
    name: string | null;
    pushName: string | null;
    phoneNumber: string | null;
  } | null;
  lastMessage: string | null;
  lastMessageFromMe: boolean;
}

interface WhatsAppMessage {
  id: number;
  messageId: string;
  body: string | null;
  fromMe: number;
  messageType: string;
  status: string | null;
  timestamp: string;
}

interface EmailAccount {
  id: number;
  email: string;
  displayName: string | null;
  provider: string;
  status: string;
}

interface EmailMessage {
  id: number;
  subject: string;
  fromAddress: string;
  fromName: string | null;
  snippet: string | null;
  isRead: number;
  isStarred: number;
  receivedAt: string | null;
}

type SidebarView = "conversations" | "channels";

export default function XosInbox() {
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterQueue, setFilterQueue] = useState<string>("all");
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [transferQueueId, setTransferQueueId] = useState<string>("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [sidebarView, setSidebarView] = useState<SidebarView>("conversations");
  const [showConnectEmailDialog, setShowConnectEmailDialog] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: "", password: "", provider: "gmail" });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [selectedWhatsAppTicket, setSelectedWhatsAppTicket] = useState<number | null>(null);
  const [whatsappInput, setWhatsappInput] = useState("");

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/xos/conversations"],
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/xos/conversations", selectedConversation?.id, "messages"],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const res = await fetch(`/api/xos/conversations/${selectedConversation.id}/messages`);
      return res.json();
    },
    enabled: !!selectedConversation,
  });

  const { data: queues = [] } = useQuery<Queue[]>({
    queryKey: ["/api/xos/queues"],
  });

  const { data: notes = [] } = useQuery<InternalNote[]>({
    queryKey: ["/api/xos/notes", { conversationId: selectedConversation?.id }],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const res = await fetch(`/api/xos/notes?conversationId=${selectedConversation.id}`);
      return res.json();
    },
    enabled: !!selectedConversation,
  });

  const { data: quickMessages = [] } = useQuery<QuickMessage[]>({
    queryKey: ["/api/xos/quick-messages"],
  });

  const { data: whatsappStatus, isLoading: loadingWhatsapp, refetch: refetchWhatsapp } = useQuery<WhatsAppStatus>({
    queryKey: ["whatsapp-status"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    refetchInterval: isPolling ? 3000 : false,
  });

  const { data: whatsappTickets = [], refetch: refetchTickets } = useQuery<WhatsAppTicket[]>({
    queryKey: ["whatsapp-tickets"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/tickets", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
    enabled: whatsappStatus?.status === "connected",
    refetchInterval: 10000,
  });

  const { data: ticketMessages = [], refetch: refetchTicketMessages } = useQuery<WhatsAppMessage[]>({
    queryKey: ["ticket-messages", selectedWhatsAppTicket],
    queryFn: async () => {
      if (!selectedWhatsAppTicket) return [];
      const res = await fetch(`/api/whatsapp/tickets/${selectedWhatsAppTicket}/messages`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedWhatsAppTicket,
    refetchInterval: 5000,
  });

  const { data: emailAccounts = [] } = useQuery<EmailAccount[]>({
    queryKey: ["email-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/email/accounts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch email accounts");
      return res.json();
    },
  });

  useEffect(() => {
    if (whatsappStatus?.status === "connected") {
      setIsPolling(false);
      setQrDataUrl(null);
    } else if (whatsappStatus?.status === "qr_pending" && whatsappStatus.qrCode) {
      QRCode.toDataURL(whatsappStatus.qrCode).then(setQrDataUrl);
    }
  }, [whatsappStatus]);

  const connectWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/whatsapp/connect", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to connect");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.status === "qr_pending" && data.qrCode) {
        QRCode.toDataURL(data.qrCode).then(setQrDataUrl);
        setIsPolling(true);
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
    onError: () => toast.error("Erro ao conectar WhatsApp"),
  });

  const disconnectWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to disconnect");
    },
    onSuccess: () => {
      setIsPolling(false);
      setQrDataUrl(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      toast.success("WhatsApp desconectado");
    },
  });

  const connectEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/email/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailForm),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to connect email");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
      setShowConnectEmailDialog(false);
      setEmailForm({ email: "", password: "", provider: "gmail" });
      toast.success("Email conectado com sucesso!");
    },
    onError: () => toast.error("Erro ao conectar email. Verifique as credenciais."),
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: number; message: string }) => {
      const res = await fetch(`/api/whatsapp/tickets/${ticketId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send message");
    },
    onSuccess: () => {
      setWhatsappInput("");
      refetchTicketMessages();
      queryClient.invalidateQueries({ queryKey: ["whatsapp-tickets"] });
    },
    onError: () => toast.error("Erro ao enviar mensagem"),
  });

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/xos/notes", {
        conversationId: selectedConversation?.id,
        content,
        userName: "Atendente"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xos/notes"] });
      setNewNoteContent("");
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (queueId: string) => {
      return apiRequest("PUT", `/api/xos/conversations/${selectedConversation?.id}/transfer`, { 
        queueId: parseInt(queueId) 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xos/conversations"] });
      setShowTransferDialog(false);
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async (data: { content: string; scheduledAt: string }) => {
      return apiRequest("POST", "/api/xos/scheduled-messages", {
        conversationId: selectedConversation?.id,
        contactId: selectedConversation?.contact_id,
        content: data.content,
        scheduledAt: data.scheduledAt,
      });
    },
    onSuccess: () => {
      setShowScheduleDialog(false);
      setMessageText("");
      setScheduleDate("");
    },
  });

  const getChannelIcon = (channel: string) => {
    const icons: Record<string, any> = {
      whatsapp: MessageSquare,
      email: Mail,
      chat: MessageSquare,
      phone: Phone,
      bot: Bot,
    };
    return icons[channel] || MessageSquare;
  };

  const getChannelColor = (channel: string) => {
    const colors: Record<string, string> = {
      whatsapp: "bg-green-100 text-green-700",
      email: "bg-blue-100 text-blue-700",
      chat: "bg-indigo-100 text-indigo-700",
      phone: "bg-orange-100 text-orange-700",
      bot: "bg-purple-100 text-purple-700",
    };
    return colors[channel] || "bg-gray-100 text-gray-700";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-yellow-100 text-yellow-800",
      pending: "bg-orange-100 text-orange-800",
      resolved: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getQueueColorClass = (color: string) => {
    const colors: Record<string, string> = {
      green: "bg-green-500",
      blue: "bg-blue-500",
      yellow: "bg-yellow-500",
      purple: "bg-purple-500",
      red: "bg-red-500",
      orange: "bg-orange-500",
    };
    return colors[color] || "bg-slate-500";
  };

  const applyFilters = (convs: Conversation[]) => {
    return convs.filter((c) => {
      if (filterChannel !== "all" && c.channel !== filterChannel) return false;
      if (filterQueue !== "all" && c.queue_id?.toString() !== filterQueue) return false;
      return true;
    });
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return "agora";
    if (hours < 24) return `${hours}h`;
    if (hours < 48) return "ontem";
    return d.toLocaleDateString("pt-BR");
  };

  const handleQuickMessageSelect = (qm: QuickMessage) => {
    setMessageText(qm.content);
    setShowQuickMessages(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "/" && messageText === "") {
      e.preventDefault();
      setShowQuickMessages(true);
    }
  };

  const handleSendWhatsApp = () => {
    if (!whatsappInput.trim() || !selectedWhatsAppTicket) return;
    sendWhatsAppMutation.mutate({ ticketId: selectedWhatsAppTicket, message: whatsappInput.trim() });
  };

  const getContactDisplayName = (ticket: WhatsAppTicket) => {
    if (!ticket.contact) return "Desconhecido";
    return ticket.contact.name || ticket.contact.pushName || ticket.contact.phoneNumber || ticket.contact.whatsappId;
  };

  const whatsappConversations: Conversation[] = whatsappTickets.map((ticket) => ({
    id: 10000 + ticket.id,
    contact_id: ticket.contact?.id || 0,
    contact_name: getContactDisplayName(ticket),
    contact_email: "",
    contact_avatar: "",
    contact_whatsapp: ticket.contact?.phoneNumber || "",
    channel: "whatsapp",
    status: ticket.status,
    priority: ticket.unreadCount > 0 ? "high" : "normal",
    subject: "WhatsApp",
    last_message: ticket.lastMessage || "",
    messages_count: ticket.unreadCount,
    queue_id: null,
    queue_name: null,
    queue_color: null,
    created_at: ticket.createdAt,
    updated_at: ticket.lastMessageAt || ticket.createdAt,
  }));

  const sampleConversations: Conversation[] = [
    {
      id: 1, contact_id: 1, contact_name: "João Silva", contact_email: "joao@empresa.com",
      contact_avatar: "", contact_whatsapp: "11999991111", channel: "whatsapp",
      status: "open", priority: "high", subject: "Dúvida sobre preços",
      last_message: "Olá, gostaria de saber mais sobre os planos do Arcádia Suite",
      messages_count: 5, queue_id: 1, queue_name: "Vendas", queue_color: "green",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: 2, contact_id: 2, contact_name: "Maria Santos", contact_email: "maria@startup.com",
      contact_avatar: "", contact_whatsapp: "21988882222", channel: "email",
      status: "open", priority: "normal", subject: "Proposta comercial",
      last_message: "Segue em anexo a proposta que solicitou na última reunião",
      messages_count: 3, queue_id: 1, queue_name: "Vendas", queue_color: "green",
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 3, contact_id: 3, contact_name: "Carlos Oliveira", contact_email: "carlos@industria.com",
      contact_avatar: "", contact_whatsapp: "31977773333", channel: "chat",
      status: "pending", priority: "normal", subject: "Suporte técnico",
      last_message: "Estou com uma dúvida sobre a integração com o ERPNext",
      messages_count: 8, queue_id: 2, queue_name: "Suporte", queue_color: "blue",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  const sampleMessages: Message[] = [
    { id: 1, conversation_id: 1, direction: "inbound", sender_type: "contact", sender_name: "João Silva",
      content: "Olá! Estou interessado no Arcádia Suite para minha empresa.",
      content_type: "text", attachments: null, read_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(), created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, conversation_id: 1, direction: "outbound", sender_type: "agent", sender_name: "Atendente",
      content: "Olá João! Seja bem-vindo. Ficarei feliz em ajudá-lo.",
      content_type: "text", attachments: null, read_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(), created_at: new Date(Date.now() - 3500000).toISOString() },
  ];

  const sampleNotes: InternalNote[] = [
    { id: 1, content: "Cliente pediu desconto de 15%", user_name: "Ana", is_pinned: true, created_at: new Date(Date.now() - 7200000).toISOString() },
  ];

  const sampleQueues: Queue[] = queues.length > 0 ? queues : [
    { id: 1, name: "Vendas", color: "green", users_count: 3, open_conversations: 12 },
    { id: 2, name: "Suporte", color: "blue", users_count: 5, open_conversations: 8 },
    { id: 3, name: "Financeiro", color: "yellow", users_count: 2, open_conversations: 4 },
    { id: 4, name: "Pós-Venda", color: "purple", users_count: 2, open_conversations: 3 },
  ];

  const sampleQuickMessages: QuickMessage[] = quickMessages.length > 0 ? quickMessages : [
    { id: 1, shortcode: "/preco", title: "Tabela de Preços", content: "Segue nossa tabela de preços atualizada." },
    { id: 2, shortcode: "/horario", title: "Horário", content: "Atendimento: segunda a sexta, 9h às 18h." },
    { id: 3, shortcode: "/obrigado", title: "Agradecimento", content: "Obrigado pelo contato!" },
  ];

  const allConversations = [...(conversations.length > 0 ? conversations : sampleConversations), ...whatsappConversations];
  const displayConversations = applyFilters(allConversations);
  const displayMessages = messages.length > 0 ? messages : (selectedConversation ? sampleMessages : []);
  const displayNotes = notes.length > 0 ? notes : (selectedConversation ? sampleNotes : []);
  const displayQueues = sampleQueues;
  const displayQuickMessages = sampleQuickMessages;

  const totalWhatsAppUnread = whatsappTickets.reduce((acc, t) => acc + t.unreadCount, 0);

  const channels = [
    { id: "whatsapp", name: "WhatsApp", icon: Smartphone, color: "bg-green-500", connected: whatsappStatus?.status === "connected", count: totalWhatsAppUnread },
    { id: "email", name: "Email", icon: Mail, color: "bg-blue-500", count: emailAccounts.length },
  ];

  return (
    <BrowserFrame>
      <div className="h-[calc(100vh-48px)] flex flex-col bg-slate-100">
        <header className="bg-white border-b shadow-sm px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/xos">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Inbox</h1>
                  <p className="text-xs text-slate-500">Central de Atendimento Omnichannel</p>
                </div>
              </div>
            </div>

          <div className="flex items-center gap-3">
            {whatsappStatus?.status === "connected" && (
              <Badge variant="outline" className="gap-1.5 text-green-600 border-green-300">
                <Wifi className="h-3 w-3" />
                WhatsApp Conectado
              </Badge>
            )}
            {displayQueues.map((q) => (
              <Badge key={q.id} variant="outline" className="gap-1.5 cursor-pointer hover:bg-slate-100"
                onClick={() => setFilterQueue(filterQueue === q.id.toString() ? "all" : q.id.toString())}>
                <span className={`w-2 h-2 rounded-full ${getQueueColorClass(q.color)}`} />
                {q.name} ({q.open_conversations})
              </Badge>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 bg-white border-r flex flex-col">
          <div className="p-2 border-b">
            <Tabs value={sidebarView} onValueChange={(v) => setSidebarView(v as SidebarView)} className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="conversations" className="text-xs gap-1" data-testid="tab-conversations">
                  <MessageSquare className="h-3 w-3" /> Conversas
                </TabsTrigger>
                <TabsTrigger value="channels" className="text-xs gap-1" data-testid="tab-channels">
                  <Settings className="h-3 w-3" /> Canais
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {sidebarView === "conversations" && (
            <>
              <div className="p-3 border-b space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="Buscar conversas..." className="pl-10" data-testid="input-search" />
                </div>
                <div className="flex gap-2">
                  <Tabs value={filterChannel} onValueChange={setFilterChannel} className="w-full">
                    <TabsList className="w-full grid grid-cols-4">
                      <TabsTrigger value="all" className="text-xs" data-testid="filter-all">Todos</TabsTrigger>
                      <TabsTrigger value="whatsapp" className="text-xs" data-testid="filter-whatsapp">WhatsApp</TabsTrigger>
                      <TabsTrigger value="email" className="text-xs" data-testid="filter-email">Email</TabsTrigger>
                      <TabsTrigger value="chat" className="text-xs" data-testid="filter-chat">Chat</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-slate-500 mr-1">Filas:</span>
                  {displayQueues.map((q) => (
                    <Badge 
                      key={q.id} 
                      variant={filterQueue === q.id.toString() ? "default" : "outline"} 
                      className={`gap-1 cursor-pointer text-xs py-0.5 ${filterQueue === q.id.toString() ? '' : 'hover:bg-slate-100'}`}
                      onClick={() => setFilterQueue(filterQueue === q.id.toString() ? "all" : q.id.toString())}
                      data-testid={`filter-queue-${q.id}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${getQueueColorClass(q.color)}`} />
                      {q.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {displayConversations.map((conv) => {
                    const ChannelIcon = getChannelIcon(conv.channel);
                    const isSelected = selectedConversation?.id === conv.id;
                    
                    return (
                      <div
                        key={conv.id}
                        onClick={() => {
                          setSelectedConversation(conv);
                          if (conv.channel === "whatsapp" && conv.id >= 10000) {
                            setSelectedWhatsAppTicket(conv.id - 10000);
                          } else {
                            setSelectedWhatsAppTicket(null);
                          }
                        }}
                        className={`p-3 cursor-pointer transition-colors hover:bg-slate-50 ${
                          isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                        }`}
                        data-testid={`conversation-${conv.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarFallback className="bg-gradient-to-br from-slate-500 to-slate-600 text-white">
                                {conv.contact_name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {conv.queue_color && (
                              <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getQueueColorClass(conv.queue_color)}`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-slate-800 truncate">{conv.contact_name}</p>
                              <span className="text-xs text-slate-400">{formatTime(conv.updated_at)}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`p-1 rounded ${getChannelColor(conv.channel)}`}>
                                <ChannelIcon className="h-3 w-3" />
                              </span>
                              <p className="text-sm text-slate-500 truncate">{conv.last_message}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{conv.status}</Badge>
                              {conv.priority === "high" && (
                                <Badge variant="destructive" className="text-xs">Urgente</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          {sidebarView === "channels" && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                <div className="text-xs font-medium text-slate-500 uppercase mb-2">Canais Conectados</div>
                
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center text-white">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm">WhatsApp</CardTitle>
                        <CardDescription className="text-xs">
                          {whatsappStatus?.status === "connected" ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <Wifi className="h-3 w-3" /> Conectado
                            </span>
                          ) : (
                            <span className="text-slate-400 flex items-center gap-1">
                              <WifiOff className="h-3 w-3" /> Desconectado
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {whatsappStatus?.status === "connected" ? (
                      <div className="space-y-3">
                        <div className="text-sm text-slate-600">
                          Telefone: {whatsappStatus.phoneNumber || "N/A"}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                            refetchWhatsapp();
                            refetchTickets();
                            setSidebarView("conversations");
                            toast.success("Conversas sincronizadas!");
                          }}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Sincronizar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => disconnectWhatsAppMutation.mutate()}>
                            <LogOut className="h-3 w-3 mr-1" /> Desconectar
                          </Button>
                        </div>
                      </div>
                    ) : whatsappStatus?.status === "qr_pending" && qrDataUrl ? (
                      <div className="text-center space-y-3">
                        <p className="text-sm text-slate-600">Escaneie o QR Code com seu WhatsApp</p>
                        <img src={qrDataUrl} alt="QR Code" className="mx-auto w-48 h-48 rounded-lg border" />
                        <p className="text-xs text-slate-400">Aguardando conexão...</p>
                      </div>
                    ) : (
                      <Button 
                        className="w-full bg-green-500 hover:bg-green-600" 
                        onClick={() => connectWhatsAppMutation.mutate()}
                        disabled={connectWhatsAppMutation.isPending}
                      >
                        {connectWhatsAppMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <QrCode className="h-4 w-4 mr-2" />
                        )}
                        Conectar WhatsApp
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm">Email</CardTitle>
                        <CardDescription className="text-xs">
                          {emailAccounts.length > 0 ? `${emailAccounts.length} conta(s)` : "Nenhuma conta"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {emailAccounts.length > 0 ? (
                      <div className="space-y-2">
                        {emailAccounts.map((acc) => (
                          <div key={acc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                            <span>{acc.email}</span>
                            <Badge variant="outline" className="text-xs">{acc.provider}</Badge>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setShowConnectEmailDialog(true)}>
                          <Plus className="h-3 w-3 mr-1" /> Adicionar Conta
                        </Button>
                      </div>
                    ) : (
                      <Button className="w-full" onClick={() => setShowConnectEmailDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Adicionar Conta
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="opacity-60">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm">Chat Web</CardTitle>
                        <CardDescription className="text-xs">Widget para seu site</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full" disabled>
                      Em breve
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                      {selectedConversation.contact_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-slate-800">{selectedConversation.contact_name}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>{selectedConversation.contact_email || selectedConversation.contact_whatsapp}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getChannelColor(selectedConversation.channel)}`}>
                        {selectedConversation.channel}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowTransferDialog(true)} data-testid="button-transfer">
                    <ArrowRightLeft className="h-4 w-4 mr-1" /> Transferir
                  </Button>
                  <Button variant="ghost" size="icon" data-testid="button-star">
                    <Star className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Archive className="h-4 w-4 mr-2" /> Arquivar</DropdownMenuItem>
                      <DropdownMenuItem><Tag className="h-4 w-4 mr-2" /> Adicionar tag</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600"><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4 bg-slate-50">
                <div className="space-y-4 max-w-3xl mx-auto">
                  {selectedWhatsAppTicket ? (
                    ticketMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
                        data-testid={`message-${msg.id}`}
                      >
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          msg.fromMe
                            ? "bg-green-600 text-white rounded-br-sm"
                            : "bg-white shadow-sm rounded-bl-sm"
                        }`}>
                          <p className={msg.fromMe ? "text-white" : "text-slate-800"}>
                            {msg.body}
                          </p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${
                            msg.fromMe ? "text-green-200" : "text-slate-400"
                          }`}>
                            <span className="text-xs">
                              {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {msg.fromMe && <CheckCheck className="h-3 w-3" />}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    displayMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                        data-testid={`message-${msg.id}`}
                      >
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          msg.direction === "outbound"
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-white shadow-sm rounded-bl-sm"
                        }`}>
                          {msg.direction === "inbound" && (
                            <p className="text-xs font-semibold text-slate-600 mb-1">{msg.sender_name}</p>
                          )}
                          <p className={msg.direction === "outbound" ? "text-white" : "text-slate-800"}>
                            {msg.content}
                          </p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${
                            msg.direction === "outbound" ? "text-blue-200" : "text-slate-400"
                          }`}>
                            <span className="text-xs">
                              {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {msg.direction === "outbound" && (
                              msg.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="bg-white border-t p-3">
                <div className="flex items-end gap-2 max-w-3xl mx-auto">
                  <Button variant="ghost" size="icon" data-testid="button-attach">
                    <Paperclip className="h-5 w-5 text-slate-500" />
                  </Button>
                  <DropdownMenu open={showQuickMessages} onOpenChange={setShowQuickMessages}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="button-quick-messages">
                        <Zap className="h-5 w-5 text-slate-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72">
                      <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">Mensagens Rápidas</div>
                      {displayQuickMessages.map((qm) => (
                        <DropdownMenuItem key={qm.id} onClick={() => {
                          if (selectedWhatsAppTicket) {
                            setWhatsappInput(qm.content);
                          } else {
                            handleQuickMessageSelect(qm);
                          }
                        }}>
                          <div>
                            <p className="font-medium">{qm.shortcode} - {qm.title}</p>
                            <p className="text-xs text-slate-500 truncate">{qm.content}</p>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="flex-1 relative">
                    {selectedWhatsAppTicket ? (
                      <Textarea
                        placeholder="Digite sua mensagem..."
                        value={whatsappInput}
                        onChange={(e) => setWhatsappInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendWhatsApp();
                          }
                        }}
                        className="min-h-[44px] max-h-32 resize-none pr-20"
                        rows={1}
                        data-testid="input-whatsapp-message"
                      />
                    ) : (
                      <Textarea
                        placeholder="Digite sua mensagem... (/ para atalhos)"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="min-h-[44px] max-h-32 resize-none pr-20"
                        rows={1}
                        data-testid="input-message"
                      />
                    )}
                    <div className="absolute right-2 bottom-2 flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowScheduleDialog(true)}>
                        <Clock className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Smile className="h-4 w-4 text-slate-500" />
                      </Button>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" data-testid="button-audio">
                    <Mic className="h-5 w-5 text-slate-500" />
                  </Button>
                  <Button 
                    size="icon" 
                    className={`h-11 w-11 ${selectedWhatsAppTicket ? 'bg-green-500 hover:bg-green-600' : ''}`}
                    onClick={selectedWhatsAppTicket ? handleSendWhatsApp : undefined}
                    disabled={selectedWhatsAppTicket ? sendWhatsAppMutation.isPending : false}
                    data-testid="button-send"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <div className="text-center text-slate-500">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-800">Nenhuma conversa selecionada</h3>
                <p className="mt-1">Selecione uma conversa para visualizar as mensagens</p>
                {whatsappStatus?.status !== "connected" && (
                  <Button className="mt-4" variant="outline" onClick={() => setSidebarView("channels")}>
                    <Settings className="h-4 w-4 mr-2" /> Configurar Canais
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedConversation && (
          <div className="w-80 bg-white border-l flex flex-col flex-shrink-0">
            <ScrollArea className="flex-1">
              <div className="p-4">
                <div className="text-center mb-6">
                  <Avatar className="h-20 w-20 mx-auto mb-3">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-2xl">
                      {selectedConversation.contact_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-slate-800">{selectedConversation.contact_name}</h3>
                  <p className="text-sm text-slate-500">{selectedConversation.contact_email || selectedConversation.contact_whatsapp}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">Informações</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span>{selectedConversation.contact_whatsapp || "Não informado"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span>{selectedConversation.contact_email || "Não informado"}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">Status & Canal</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getStatusColor(selectedConversation.status)}>
                        {selectedConversation.status}
                      </Badge>
                      <Badge className={getChannelColor(selectedConversation.channel)}>
                        {selectedConversation.channel}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-slate-500 uppercase flex items-center gap-1">
                        <StickyNote className="h-3 w-3" /> Notas Internas
                      </p>
                    </div>
                    <div className="space-y-2 mb-3">
                      {displayNotes.map((note) => (
                        <div key={note.id} className={`p-2 rounded-lg text-sm ${note.is_pinned ? 'bg-yellow-50 border border-yellow-200' : 'bg-slate-50'}`}>
                          <div className="flex items-start justify-between">
                            <p className="text-slate-700">{note.content}</p>
                            {note.is_pinned && <Pin className="h-3 w-3 text-yellow-600 flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{note.user_name} • {formatTime(note.created_at)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Adicionar nota..." 
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        className="text-sm"
                        data-testid="input-note"
                      />
                      <Button size="sm" onClick={() => newNoteContent && createNoteMutation.mutate(newNoteContent)} disabled={!newNoteContent}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">Ações Rápidas</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="h-3 w-3 mr-1" /> Ticket
                      </Button>
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="h-3 w-3 mr-1" /> Deal
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transferir para Fila</label>
              <Select value={transferQueueId} onValueChange={setTransferQueueId}>
                <SelectTrigger data-testid="select-queue">
                  <SelectValue placeholder="Selecione uma fila" />
                </SelectTrigger>
                <SelectContent>
                  {displayQueues.map((q) => (
                    <SelectItem key={q.id} value={q.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getQueueColorClass(q.color)}`} />
                        {q.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancelar</Button>
            <Button onClick={() => transferQueueId && transferMutation.mutate(transferQueueId)} disabled={!transferQueueId}>
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Mensagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensagem</label>
              <Textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Digite a mensagem..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data e Hora</label>
              <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancelar</Button>
            <Button 
              disabled={!messageText || !scheduleDate || scheduleMutation.isPending}
              onClick={() => scheduleMutation.mutate({ content: messageText, scheduledAt: scheduleDate })}
            >
              <Calendar className="h-4 w-4 mr-1" /> {scheduleMutation.isPending ? "Agendando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConnectEmailDialog} onOpenChange={setShowConnectEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar Email</DialogTitle>
            <DialogDescription>Adicione uma conta de email para enviar e receber mensagens</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select value={emailForm.provider} onValueChange={(v) => setEmailForm({ ...emailForm, provider: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="outlook">Outlook</SelectItem>
                  <SelectItem value="imap">IMAP (Outro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email" 
                placeholder="seu@email.com" 
                value={emailForm.email}
                onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha de App</Label>
              <Input 
                type="password" 
                placeholder="Senha de aplicativo"
                value={emailForm.password}
                onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
              />
              <p className="text-xs text-slate-500">
                Para Gmail, use uma senha de app. Para outros, use sua senha normal.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnectEmailDialog(false)}>Cancelar</Button>
            <Button 
              onClick={() => connectEmailMutation.mutate()}
              disabled={!emailForm.email || !emailForm.password || connectEmailMutation.isPending}
            >
              {connectEmailMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </BrowserFrame>
  );
}
