import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { 
  Search, Grid, Settings, FileText, Plus, Star, 
  ChevronRight, Bell, Clock, CheckSquare, 
  StickyNote, MoreHorizontal, Trash2, Pin, ExternalLink, Pencil,
  Users, Ticket, Layers, AlertCircle, Play,
  Calculator, Receipt, UserCog, Building2, Package, Wallet,
  Hash, ChevronDown, Circle, MessageSquare, Zap, Database, ArrowRight
} from "lucide-react";
const browserIcon = "/arcadia_suite_icon.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Application } from "@shared/schema";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface WorkspacePage {
  id: number;
  title: string;
  icon?: string;
  isFavorite: number;
  updatedAt: string;
}

interface QuickNote {
  id: number;
  content: string;
  isPinned: number;
  color?: string;
  updatedAt: string;
}

interface ActivityEntry {
  id: number;
  type: string;
  module: string;
  entityType: string;
  entityId: string;
  entityTitle?: string;
  description?: string;
  isRead: number;
  createdAt: string;
}

interface ProductionTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  type: string;
  storyPoints?: number;
}

interface ProductionSprint {
  id: number;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  squadName?: string;
}

interface SupportTicket {
  id: number;
  title: string;
  status: string;
  priority: string;
  category: string;
}

interface Community {
  id: number;
  name: string;
  description?: string;
  iconEmoji?: string;
  iconColor?: string;
  role?: string;
  status?: string;
}

interface CommunityChannel {
  id: number;
  name: string;
  type: string;
  description?: string;
}

interface CommunityMember {
  id: number;
  userId: string;
  username: string;
  role: string;
  status: string;
  statusMessage?: string;
}

async function fetchApplications(): Promise<Application[]> {
  const response = await fetch("/api/applications", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch applications");
  return response.json();
}

export default function Home() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const isAdmin = user?.role === "admin" || user?.role === "master";
  const [newApp, setNewApp] = useState({
    name: "",
    category: "",
    icon: "bg-blue-500",
    status: "Installed",
    url: "",
    description: "",
  });

  const { data: apps = [], isLoading: appsLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: fetchApplications,
  });

  const { data: pages = [] } = useQuery<WorkspacePage[]>({
    queryKey: ["/api/productivity/pages"],
    queryFn: async () => {
      const res = await fetch("/api/productivity/pages", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: favoritePages = [] } = useQuery<WorkspacePage[]>({
    queryKey: ["/api/productivity/pages/favorites"],
    queryFn: async () => {
      const res = await fetch("/api/productivity/pages/favorites", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: notes = [] } = useQuery<QuickNote[]>({
    queryKey: ["/api/productivity/notes"],
    queryFn: async () => {
      const res = await fetch("/api/productivity/notes", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: activities = [] } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/productivity/activity"],
    queryFn: async () => {
      const res = await fetch("/api/productivity/activity?limit=10", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/productivity/activity/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/productivity/activity/unread-count", { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
  });

  const { data: myTasks = [] } = useQuery<ProductionTask[]>({
    queryKey: ["/api/production/my-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/production/my-tasks", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: communities = [] } = useQuery<Community[]>({
    queryKey: ["communities"],
    queryFn: async () => {
      const res = await fetch("/api/communities", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
  const [communityExpanded, setCommunityExpanded] = useState(true);

  const { data: communityDetails } = useQuery<{
    id: number;
    name: string;
    channels: CommunityChannel[];
    members: CommunityMember[];
  } | null>({
    queryKey: ["community-details", selectedCommunity],
    queryFn: async () => {
      if (!selectedCommunity) return null;
      const res = await fetch(`/api/communities/${selectedCommunity}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCommunity,
  });

  useEffect(() => {
    if (communities.length > 0 && !selectedCommunity) {
      setSelectedCommunity(communities[0].id);
    }
  }, [communities, selectedCommunity]);

  const { data: activeSprint } = useQuery<ProductionSprint | null>({
    queryKey: ["/api/production/active-sprint"],
    queryFn: async () => {
      const res = await fetch("/api/production/active-sprint", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: openTickets = [] } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets/open"],
    queryFn: async () => {
      const res = await fetch("/api/support/tickets?status=open", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createPageMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/productivity/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Sem título" }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create page");
      return res.json();
    },
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ["/api/productivity/pages"] });
      navigate(`/page/${page.id}`);
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/productivity/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create note");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/productivity/notes"] });
      setNewNoteContent("");
      toast({ title: "Nota criada" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/productivity/notes/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete note");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/productivity/notes"] });
    },
  });

  const toggleNotePinMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: number; isPinned: number }) => {
      const res = await fetch(`/api/productivity/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: isPinned ? 0 : 1 }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update note");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/productivity/notes"] });
    },
  });

  const createAppMutation = useMutation({
    mutationFn: async (app: typeof newApp) => {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(app),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create application");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setIsAddDialogOpen(false);
      setNewApp({ name: "", category: "", icon: "bg-blue-500", status: "Installed", url: "", description: "" });
      toast({ title: "Aplicativo criado" });
    },
  });

  const updateAppMutation = useMutation({
    mutationFn: async (app: Application) => {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: app.name, category: app.category, icon: app.icon, status: app.status, url: app.url, description: app.description }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update application");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setIsEditDialogOpen(false);
      setEditingApp(null);
      toast({ title: "Aplicativo atualizado" });
    },
  });

  const deleteAppMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/applications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete application");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast({ title: "Aplicativo excluído" });
    },
  });

  const createCommunityMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, iconEmoji: "🏢", iconColor: "#3b82f6" }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create community");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      setSelectedCommunity(data.id);
      toast({ title: "Comunidade criada!" });
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!selectedCommunity) throw new Error("No community selected");
      const res = await fetch(`/api/communities/${selectedCommunity}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: "text" }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create channel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-details", selectedCommunity] });
      toast({ title: "Canal criado!" });
    },
  });

  useEffect(() => {
    const handleCreatePage = () => createPageMutation.mutate();
    const handleCreateNote = () => {
      const content = prompt("Nova nota rápida:");
      if (content) createNoteMutation.mutate(content);
    };
    
    window.addEventListener("create-new-page", handleCreatePage);
    window.addEventListener("create-quick-note", handleCreateNote);
    return () => {
      window.removeEventListener("create-new-page", handleCreatePage);
      window.removeEventListener("create-quick-note", handleCreateNote);
    };
  }, [createPageMutation, createNoteMutation]);

  const iconOptions = [
    "bg-blue-500", "bg-sky-400", "bg-emerald-500", "bg-indigo-500",
    "bg-purple-500", "bg-slate-800", "bg-orange-500", "bg-red-500",
    "bg-pink-500", "bg-teal-500",
  ];

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  return (
    <BrowserFrame>
      <div className="h-full w-full flex bg-slate-50">
        <aside className="w-64 border-r bg-white flex flex-col shrink-0 hidden md:flex">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <img src={browserIcon} alt="Arcadia Logo" className="w-8 h-8" />
              <span className="font-semibold text-slate-800">Arcádia Suite</span>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              {/* Comunidades estilo Discord */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setCommunityExpanded(!communityExpanded)}
                    className="flex items-center gap-1 hover:bg-slate-50 rounded px-1 py-0.5"
                    data-testid="communities-toggle"
                  >
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Comunidades
                    </span>
                    <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${communityExpanded ? '' : '-rotate-90'}`} />
                  </button>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => navigate("/communities")}
                      title="Abrir comunidades"
                      data-testid="open-communities-btn"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => {
                        const name = prompt("Nome da comunidade:");
                        if (name) createCommunityMutation.mutate(name);
                      }}
                      data-testid="add-community-btn"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                {communityExpanded && (
                  <div className="space-y-2">
                    {/* Seletor de comunidade */}
                    {communities.length === 0 ? (
                      <p className="text-xs text-slate-400 px-2">Nenhuma comunidade</p>
                    ) : (
                      <select
                        value={selectedCommunity || ""}
                        onChange={(e) => setSelectedCommunity(parseInt(e.target.value))}
                        className="w-full text-sm bg-slate-100 border-0 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500"
                        data-testid="community-selector"
                      >
                        {communities.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.iconEmoji || "🏢"} {c.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Canais */}
                    {communityDetails && (
                      <>
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1 px-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Canais</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-4 w-4" 
                              onClick={() => {
                                const name = prompt("Nome do canal:");
                                if (name) createChannelMutation.mutate(name);
                              }}
                              data-testid="add-channel-btn"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="space-y-0.5">
                            {communityDetails.channels.map((channel) => (
                              <button
                                key={channel.id}
                                className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-100 text-left text-sm text-slate-600 hover:text-slate-900 group"
                                data-testid={`channel-${channel.id}`}
                              >
                                <Hash className="h-3.5 w-3.5 text-slate-400" />
                                <span className="truncate flex-1">{channel.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Membros da equipe */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1 px-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Equipe</span>
                            <span className="text-[10px] text-slate-400">{communityDetails.members.length}</span>
                          </div>
                          <div className="space-y-0.5">
                            {communityDetails.members.slice(0, 8).map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 text-sm"
                                data-testid={`member-${member.id}`}
                              >
                                <div className="relative">
                                  <div 
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                                    style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][member.id % 5] }}
                                  >
                                    {member.username?.charAt(0).toUpperCase() || '?'}
                                  </div>
                                  <Circle 
                                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 ${
                                      member.status === 'online' ? 'text-green-500 fill-green-500' :
                                      member.status === 'away' ? 'text-yellow-500 fill-yellow-500' :
                                      member.status === 'busy' ? 'text-red-500 fill-red-500' :
                                      'text-slate-400 fill-slate-400'
                                    }`}
                                  />
                                </div>
                                <span className="truncate flex-1 text-slate-700">{member.username}</span>
                                {member.role === 'owner' && (
                                  <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">owner</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Favoritos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Favoritos</span>
                </div>
                {favoritePages.length === 0 ? (
                  <p className="text-xs text-slate-400 px-2">Nenhuma página favorita</p>
                ) : (
                  <div className="space-y-1">
                    {favoritePages.slice(0, 5).map(page => (
                      <button
                        key={page.id}
                        onClick={() => navigate(`/page/${page.id}`)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 text-left text-sm"
                        data-testid={`favorite-page-${page.id}`}
                      >
                        <span>{page.icon || "📄"}</span>
                        <span className="truncate flex-1">{page.title}</span>
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Páginas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Páginas</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => createPageMutation.mutate()}
                    data-testid="create-page-button"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {pages.length === 0 ? (
                  <p className="text-xs text-slate-400 px-2">Nenhuma página criada</p>
                ) : (
                  <div className="space-y-1">
                    {pages.slice(0, 10).map(page => (
                      <button
                        key={page.id}
                        onClick={() => navigate(`/page/${page.id}`)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 text-left text-sm group"
                        data-testid={`sidebar-page-${page.id}`}
                      >
                        <span>{page.icon || "📄"}</span>
                        <span className="truncate flex-1">{page.title}</span>
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 text-slate-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="p-3 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sm"
              onClick={() => createPageMutation.mutate()}
              data-testid="new-page-sidebar-button"
            >
              <Plus className="h-4 w-4" />
              Nova Página
            </Button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col items-center py-6 md:py-8">
              <div className="flex items-center gap-3 mb-4">
                <img src={browserIcon} alt="Arcadia Logo" className="w-12 h-12 md:hidden" />
                <h1 className="text-2xl md:text-3xl font-light text-slate-800" data-testid="text-welcome">
                  Olá, {user?.username || "Usuário"}
                </h1>
              </div>
              
              <div className="relative w-full max-w-xl">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <Input 
                  data-testid="input-search"
                  className="pl-12 h-12 rounded-full text-base shadow-sm border-slate-200 bg-white focus-visible:ring-2 focus-visible:ring-primary/20 transition-all hover:shadow-md" 
                  placeholder="Pesquisar... (⌘K)"
                  onFocus={() => {
                    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
                    document.dispatchEvent(event);
                  }}
                  readOnly
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">Pressione ⌘K para buscar em todo o sistema</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Atividade Recente
                    </h2>
                    {unreadCount && unreadCount.count > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                        {unreadCount.count} novas
                      </span>
                    )}
                  </div>
                  {activities.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhuma atividade recente</p>
                  ) : (
                    <div className="space-y-2">
                      {activities.slice(0, 5).map(activity => (
                        <div
                          key={activity.id}
                          className={`flex items-start gap-3 p-2 rounded ${!activity.isRead ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                          data-testid={`activity-${activity.id}`}
                        >
                          <div className="mt-0.5">
                            {activity.type === 'created' && <FileText className="h-4 w-4 text-green-500" />}
                            {activity.type === 'updated' && <FileText className="h-4 w-4 text-blue-500" />}
                            {activity.type === 'completed' && <CheckSquare className="h-4 w-4 text-emerald-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{activity.description || activity.entityTitle}</p>
                            <p className="text-xs text-slate-400">{formatTimeAgo(activity.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <div data-testid="section-dois-eixos">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold flex items-center gap-2 text-sm text-slate-600">
                      <Layers className="h-4 w-4" />
                      Dois Eixos Operacionais
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <Card
                      className="p-4 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 hover:shadow-md transition-shadow cursor-pointer"
                      data-testid="card-eixo-soe"
                      onClick={() => window.location.href = "/soe"}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-md bg-blue-100">
                          <Database className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-semibold text-blue-800 text-sm">Arcádia SOE</span>
                        <ArrowRight className="h-3 w-3 text-blue-400 ml-auto" />
                      </div>
                      <p className="text-xs text-blue-600 leading-relaxed">ERP canônico · Pessoas · Produtos · Vendas · Finanças · Fiscal</p>
                    </Card>
                    <Card
                      className="p-4 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 hover:shadow-md transition-shadow cursor-pointer"
                      data-testid="card-eixo-xos"
                      onClick={() => window.location.href = "/xos"}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-md bg-violet-100">
                          <Zap className="h-4 w-4 text-violet-600" />
                        </div>
                        <span className="font-semibold text-violet-800 text-sm">Arcádia XOS</span>
                        <ArrowRight className="h-3 w-3 text-violet-400 ml-auto" />
                      </div>
                      <p className="text-xs text-violet-600 leading-relaxed">Comunicação · Agentes IA · CRM · Tickets · Automação</p>
                    </Card>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold flex items-center gap-2">
                      <Grid className="h-4 w-4" />
                      Aplicativos
                    </h2>
                  </div>
                  
                  {appsLoading ? (
                    <p className="text-center py-6 text-slate-400">Carregando...</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <Card
                        className="p-3 hover:shadow-md transition-all border-slate-200 hover:border-primary/30 bg-white group relative cursor-pointer"
                        data-testid="card-module-people"
                        onClick={() => navigate("/pessoas")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white shadow-sm">
                            <UserCog className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">Pessoas</h3>
                            <p className="text-xs text-slate-400 truncate">Cadastro unificado</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary" />
                        </div>
                      </Card>

                      <Card
                        className="p-3 hover:shadow-md transition-all border-slate-200 hover:border-primary/30 bg-white group relative cursor-pointer"
                        data-testid="card-module-contabil"
                        onClick={() => navigate("/contabil")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center text-white shadow-sm">
                            <Calculator className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">Arcádia Contábil</h3>
                            <p className="text-xs text-slate-400 truncate">Contabilidade</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary" />
                        </div>
                      </Card>

                      <Card
                        className="p-3 hover:shadow-md transition-all border-slate-200 hover:border-primary/30 bg-white group relative cursor-pointer"
                        data-testid="card-module-fisco"
                        onClick={() => navigate("/fisco")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white shadow-sm">
                            <Receipt className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">Arcádia Fisco</h3>
                            <p className="text-xs text-slate-400 truncate">Fiscal & NF-e</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary" />
                        </div>
                      </Card>

                      <Card
                        className="p-3 hover:shadow-md transition-all border-slate-200 hover:border-primary/30 bg-white group relative cursor-pointer"
                        data-testid="card-module-soe"
                        onClick={() => navigate("/soe")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center text-white shadow-sm">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">Arcádia SOE</h3>
                            <p className="text-xs text-slate-400 truncate">Sistema Operacional</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary" />
                        </div>
                      </Card>

                      <Card
                        className="p-3 hover:shadow-md transition-all border-slate-200 hover:border-primary/30 bg-white group relative cursor-pointer"
                        data-testid="card-module-financeiro"
                        onClick={() => navigate("/control")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                            <Wallet className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">Control</h3>
                            <p className="text-xs text-slate-400 truncate">Gestão Financeira</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary" />
                        </div>
                      </Card>

                      {apps.map(app => (
                        <Card
                          key={app.id}
                          className="p-3 hover:shadow-md transition-all border-slate-200 hover:border-primary/30 bg-white group relative cursor-pointer"
                          data-testid={`card-app-${app.id}`}
                          onClick={() => navigate(`/app/${app.id}`)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${app.icon} flex items-center justify-center text-white shadow-sm`}>
                              <span className="text-sm font-bold">{app.name[0]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm truncate">{app.name}</h3>
                              <p className="text-xs text-slate-400 truncate">{app.category}</p>
                            </div>
                            {isAdmin && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`menu-app-${app.id}`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingApp(app); setIsEditDialogOpen(true); }} data-testid={`edit-app-${app.id}`}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive" 
                                    onClick={(e) => { e.stopPropagation(); if(confirm(`Excluir ${app.name}?`)) deleteAppMutation.mutate(app.id); }}
                                    data-testid={`delete-app-${app.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            {!isAdmin && <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary" />}
                          </div>
                        </Card>
                      ))}
                      
                      {isAdmin && (
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                          <DialogTrigger asChild>
                            <Card className="p-3 border-dashed border-2 hover:bg-slate-50 cursor-pointer flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600" data-testid="card-add-app">
                              <Plus className="h-4 w-4" />
                              <span className="text-sm">Adicionar</span>
                            </Card>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Adicionar Aplicativo</DialogTitle>
                              <DialogDescription>Crie um novo aplicativo para a suite.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input
                                  data-testid="input-app-name"
                                  value={newApp.name}
                                  onChange={(e) => setNewApp({ ...newApp, name: e.target.value })}
                                  placeholder="Nome do aplicativo"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Categoria</Label>
                                <Input
                                  data-testid="input-app-category"
                                  value={newApp.category}
                                  onChange={(e) => setNewApp({ ...newApp, category: e.target.value })}
                                  placeholder="Categoria"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Cor</Label>
                                <Select value={newApp.icon} onValueChange={(v) => setNewApp({ ...newApp, icon: v })}>
                                  <SelectTrigger data-testid="select-app-icon"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {iconOptions.map(c => (
                                      <SelectItem key={c} value={c}>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-4 h-4 rounded ${c}`} />
                                          {c.replace("bg-", "")}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>URL do Aplicativo</Label>
                                <Input
                                  data-testid="input-app-url"
                                  value={newApp.url}
                                  onChange={(e) => setNewApp({ ...newApp, url: e.target.value })}
                                  placeholder="https://exemplo.com"
                                />
                                <p className="text-xs text-slate-400">Link externo que será aberto dentro do sistema</p>
                              </div>
                              <div className="space-y-2">
                                <Label>Descrição</Label>
                                <Input
                                  data-testid="input-app-description"
                                  value={newApp.description}
                                  onChange={(e) => setNewApp({ ...newApp, description: e.target.value })}
                                  placeholder="Descrição breve do aplicativo"
                                />
                              </div>
                              <Button className="w-full" onClick={() => createAppMutation.mutate(newApp)} data-testid="button-save-app">
                                Adicionar
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  )}

                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar Aplicativo</DialogTitle>
                        <DialogDescription>Atualize os dados do aplicativo.</DialogDescription>
                      </DialogHeader>
                      {editingApp && (
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Nome</Label>
                            <Input
                              data-testid="input-edit-app-name"
                              value={editingApp.name}
                              onChange={(e) => setEditingApp({ ...editingApp, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Input
                              data-testid="input-edit-app-category"
                              value={editingApp.category}
                              onChange={(e) => setEditingApp({ ...editingApp, category: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Cor</Label>
                            <Select value={editingApp.icon} onValueChange={(v) => setEditingApp({ ...editingApp, icon: v })}>
                              <SelectTrigger data-testid="select-edit-app-icon"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {iconOptions.map(c => (
                                  <SelectItem key={c} value={c}>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-4 h-4 rounded ${c}`} />
                                      {c.replace("bg-", "")}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>URL do Aplicativo</Label>
                            <Input
                              data-testid="input-edit-app-url"
                              value={editingApp.url || ""}
                              onChange={(e) => setEditingApp({ ...editingApp, url: e.target.value })}
                              placeholder="https://exemplo.com"
                            />
                            <p className="text-xs text-slate-400">Link externo que será aberto dentro do sistema</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Descrição</Label>
                            <Input
                              data-testid="input-edit-app-description"
                              value={editingApp.description || ""}
                              onChange={(e) => setEditingApp({ ...editingApp, description: e.target.value })}
                              placeholder="Descrição breve do aplicativo"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => { setIsEditDialogOpen(false); setEditingApp(null); }}>
                              Cancelar
                            </Button>
                            <Button className="flex-1" onClick={() => updateAppMutation.mutate(editingApp)} data-testid="button-update-app">
                              Salvar
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="space-y-6">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold flex items-center gap-2">
                      <StickyNote className="h-4 w-4" />
                      Notas Rápidas
                    </h2>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <Textarea
                      placeholder="Escreva uma nota..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="resize-none text-sm"
                      rows={2}
                      data-testid="new-note-input"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!newNoteContent.trim()}
                      onClick={() => createNoteMutation.mutate(newNoteContent)}
                      data-testid="save-note-button"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Salvar Nota
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notes.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">Nenhuma nota</p>
                    ) : (
                      notes.slice(0, 5).map(note => (
                        <div
                          key={note.id}
                          className={`p-2 rounded bg-slate-50 border text-sm group relative ${note.isPinned ? 'border-yellow-200 bg-yellow-50' : 'border-slate-100'}`}
                          data-testid={`note-${note.id}`}
                        >
                          <p className="pr-8 whitespace-pre-wrap text-xs">{note.content}</p>
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleNotePinMutation.mutate({ id: note.id, isPinned: note.isPinned })}
                            >
                              <Pin className={`h-3 w-3 ${note.isPinned ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <h2 className="font-semibold flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4" />
                    Páginas Recentes
                  </h2>
                  {pages.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-slate-400 mb-2">Nenhuma página</p>
                      <Button size="sm" variant="outline" onClick={() => createPageMutation.mutate()} data-testid="create-first-page">
                        <Plus className="h-3 w-3 mr-1" /> Criar Página
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {pages.slice(0, 5).map(page => (
                        <button
                          key={page.id}
                          onClick={() => navigate(`/page/${page.id}`)}
                          className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-left text-sm"
                          data-testid={`recent-page-${page.id}`}
                        >
                          <span>{page.icon || "📄"}</span>
                          <span className="truncate flex-1">{page.title}</span>
                          <span className="text-xs text-slate-400">{formatTimeAgo(page.updatedAt)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-4" data-testid="widget-my-tasks">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-600" />
                      Minhas Tarefas
                    </h2>
                    <Button size="sm" variant="ghost" onClick={() => navigate("/production")} data-testid="link-production">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  {myTasks.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">Nenhuma tarefa atribuída</p>
                  ) : (
                    <div className="space-y-2">
                      {myTasks.slice(0, 3).map(task => (
                        <div key={task.id} className="flex items-center gap-2 p-2 rounded bg-slate-50 text-sm" data-testid={`widget-task-${task.id}`}>
                          {task.type === "story" && <Layers className="h-3.5 w-3.5 text-blue-500" />}
                          {task.type === "task" && <CheckSquare className="h-3.5 w-3.5 text-green-500" />}
                          {task.type === "bug" && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                          <span className="truncate flex-1">{task.title}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${task.status === "in_progress" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-600"}`}>
                            {task.status.replace("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-4" data-testid="widget-open-tickets">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-rose-600" />
                      Tickets Abertos
                    </h2>
                    <Button size="sm" variant="ghost" onClick={() => navigate("/support")} data-testid="link-support">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  {openTickets.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">Nenhum ticket aberto</p>
                  ) : (
                    <div className="space-y-2">
                      {openTickets.slice(0, 3).map(ticket => (
                        <div key={ticket.id} className="flex items-center gap-2 p-2 rounded bg-slate-50 text-sm" data-testid={`widget-ticket-${ticket.id}`}>
                          <Ticket className="h-3.5 w-3.5 text-rose-500" />
                          <span className="truncate flex-1">{ticket.title}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${ticket.priority === "high" || ticket.priority === "critical" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                            {ticket.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {activeSprint && (
                  <Card className="p-4 border-indigo-200 bg-indigo-50/50" data-testid="widget-active-sprint">
                    <div className="flex items-center gap-2 mb-2">
                      <Play className="h-4 w-4 text-green-600" />
                      <h2 className="font-semibold text-sm">Sprint Ativa</h2>
                    </div>
                    <p className="font-medium">{activeSprint.name}</p>
                    {activeSprint.squadName && <p className="text-xs text-slate-500">{activeSprint.squadName}</p>}
                    {activeSprint.endDate && (
                      <p className="text-xs text-slate-400 mt-1">
                        Termina em {new Date(activeSprint.endDate).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Sidebar Direita - Comunidades */}
        <aside className="w-64 border-l bg-white flex flex-col shrink-0 hidden xl:flex">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-500" />
                <span className="font-medium text-slate-800">Comunidades</span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => navigate("/communities")}
                  title="Abrir comunidades"
                  data-testid="open-communities-sidebar-btn"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    const name = prompt("Nome da comunidade:");
                    if (name) createCommunityMutation.mutate(name);
                  }}
                  data-testid="add-community-sidebar-btn"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              {communities.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Nenhuma comunidade</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      const name = prompt("Nome da comunidade:");
                      if (name) createCommunityMutation.mutate(name);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Criar Comunidade
                  </Button>
                </div>
              ) : (
                <>
                  <select
                    value={selectedCommunity || ""}
                    onChange={(e) => setSelectedCommunity(parseInt(e.target.value))}
                    className="w-full text-sm bg-slate-100 border-0 rounded px-2 py-1.5 focus:ring-2 focus:ring-indigo-500"
                    data-testid="community-sidebar-selector"
                  >
                    {communities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.iconEmoji || "🏢"} {c.name}
                      </option>
                    ))}
                  </select>

                  {communityDetails && (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Channels</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5" 
                            onClick={() => {
                              const name = prompt("Nome do canal:");
                              if (name) createChannelMutation.mutate(name);
                            }}
                            data-testid="add-channel-sidebar-btn"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="space-y-0.5">
                          {communityDetails.channels.map((channel) => (
                            <button
                              key={channel.id}
                              onClick={() => navigate("/communities")}
                              className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-100 text-left text-sm text-slate-600 hover:text-slate-900"
                              data-testid={`sidebar-channel-${channel.id}`}
                            >
                              <Hash className="h-3.5 w-3.5 text-slate-400" />
                              <span className="truncate flex-1">{channel.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Team</span>
                          <span className="text-xs text-slate-400">{communityDetails.members.length}</span>
                        </div>
                        <div className="space-y-0.5">
                          {communityDetails.members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 text-sm"
                              data-testid={`sidebar-member-${member.id}`}
                            >
                              <div className="relative">
                                <div 
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                                  style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][member.id % 5] }}
                                >
                                  {member.username?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <Circle 
                                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 ${
                                    member.status === 'online' ? 'text-green-500 fill-green-500' :
                                    member.status === 'away' ? 'text-yellow-500 fill-yellow-500' :
                                    member.status === 'busy' ? 'text-red-500 fill-red-500' :
                                    'text-slate-400 fill-slate-400'
                                  }`}
                                />
                              </div>
                              <span className="truncate flex-1 text-slate-700">{member.username}</span>
                              {member.role === 'owner' && (
                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">owner</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </BrowserFrame>
  );
}
