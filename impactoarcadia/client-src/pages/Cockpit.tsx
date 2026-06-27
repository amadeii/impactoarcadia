import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { type Application } from "@shared/schema";
import {
  FolderKanban,
  Layers,
  BookOpen,
  Archive,
  Hash,
  Plus,
  MoreHorizontal,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Command,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FileText,
  Star,
  Bell,
  Trash2,
  Search,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  Settings,
  Package,
  Bookmark,
  Link,
  File
} from "lucide-react";
import { DigitalClock } from "@/components/DigitalClock";

type ParaTab = "projetos" | "areas" | "recursos" | "arquivo";
type MemberStatus = "online" | "idle" | "busy" | "offline";

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

interface CommunityChannel {
  id: number;
  name: string;
  description?: string;
}

interface CommunityMember {
  id: number;
  username: string;
  role: string;
  status?: string;
}

interface Community {
  id: number;
  name: string;
  iconEmoji?: string;
}

interface CommunityDetails {
  community: Community;
  channels: CommunityChannel[];
  members: CommunityMember[];
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}m atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  return `${diffDays}d atrás`;
}

function TriadeDonutChart({ tasks }: { tasks: { importante: number; urgente: number; circunstancial: number } }) {
  const total = tasks.importante + tasks.urgente + tasks.circunstancial || 1;
  const data = [
    { label: "Importante", value: Math.round((tasks.importante / total) * 100) || 70, color: "#22c55e" },
    { label: "Urgente", value: Math.round((tasks.urgente / total) * 100) || 20, color: "#eab308" },
    { label: "Circunstancial", value: Math.round((tasks.circunstancial / total) * 100) || 10, color: "#ef4444" },
  ];

  let cumulativePercent = 0;
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24">
        <svg viewBox="-1 -1 2 2" className="w-full h-full transform -rotate-90">
          {data.map((slice, i) => {
            const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
            cumulativePercent += slice.value / 100;
            const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
            const largeArcFlag = slice.value / 100 > 0.5 ? 1 : 0;
            const pathData = [`M ${startX} ${startY}`, `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, `L 0 0`].join(" ");
            return <path key={i} d={pathData} fill={slice.color} stroke="white" strokeWidth="0.02" />;
          })}
          <circle cx="0" cy="0" r="0.55" fill="white" />
        </svg>
      </div>
      <div className="space-y-1 text-xs">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            {item.label === "Importante" && <CheckCircle2 className="w-3 h-3 text-green-500" />}
            {item.label === "Urgente" && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
            {item.label === "Circunstancial" && <AlertCircle className="w-3 h-3 text-red-500" />}
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-semibold ml-auto">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommunitiesSidebar() {
  const [expandedChannels, setExpandedChannels] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState(true);
  const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
  const [, navigate] = useLocation();

  const { data: communities = [] } = useQuery<Community[]>({
    queryKey: ["/api/communities"],
    queryFn: async () => {
      const res = await fetch("/api/communities", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: communityDetails } = useQuery<CommunityDetails>({
    queryKey: ["/api/communities", selectedCommunity],
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

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "away": return "bg-yellow-500";
      case "busy": return "bg-red-500";
      default: return "bg-slate-400";
    }
  };

  return (
    <div className="w-56 border-l bg-muted/30 flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Comunidades</span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => navigate("/communities")}>
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {communities.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma comunidade</p>
          ) : (
            <>
              <select
                value={selectedCommunity || ""}
                onChange={(e) => setSelectedCommunity(parseInt(e.target.value))}
                className="w-full text-sm bg-muted border-0 rounded px-2 py-1.5"
                data-testid="cockpit-community-selector"
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
                    <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setExpandedChannels(!expandedChannels)}>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channels</span>
                      <Plus className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </div>
                    {expandedChannels && (
                      <div className="space-y-0.5">
                        {communityDetails.channels.map((channel) => (
                          <div
                            key={channel.id}
                            onClick={() => navigate("/communities")}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-muted-foreground hover:text-foreground transition-colors text-sm"
                            data-testid={`cockpit-channel-${channel.id}`}
                          >
                            <Hash className="w-3 h-3" />
                            <span>{channel.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setExpandedTeam(!expandedTeam)}>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team</span>
                      <span className="text-xs text-muted-foreground">{communityDetails.members.length}</span>
                    </div>
                    {expandedTeam && (
                      <div className="space-y-0.5">
                        {communityDetails.members.map((member) => (
                          <div key={member.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer transition-colors" data-testid={`cockpit-member-${member.id}`}>
                            <div className="relative">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
                                style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][member.id % 5] }}
                              >
                                {member.username?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${getStatusColor(member.status)}`} />
                            </div>
                            <span className="text-sm truncate">{member.username}</span>
                            {member.role === 'owner' && (
                              <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1 rounded ml-auto">owner</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Cockpit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<ParaTab>("projetos");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [appSearch, setAppSearch] = useState("");
  
  // Modal states for PARA items
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<string>("importante");
  const [newProjectType, setNewProjectType] = useState<"personal" | "production">("personal");
  const [selectedProductionProjectId, setSelectedProductionProjectId] = useState<number | null>(null);
  const [selectedTaskProjectId, setSelectedTaskProjectId] = useState<number | null>(null);
  const [selectedTaskAreaId, setSelectedTaskAreaId] = useState<number | null>(null);
  const [selectedPersonalProject, setSelectedPersonalProject] = useState<any | null>(null);
  const [selectedArea, setSelectedArea] = useState<any | null>(null);
  const [showResourcesView, setShowResourcesView] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [taskComment, setTaskComment] = useState("");
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskCategory, setEditTaskCategory] = useState("");
  
  // Resource states
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [newResourceName, setNewResourceName] = useState("");
  const [newResourceDescription, setNewResourceDescription] = useState("");
  const [newResourceType, setNewResourceType] = useState<string>("link");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [resourceSearch, setResourceSearch] = useState("");
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [showResourceDetailModal, setShowResourceDetailModal] = useState(false);
  const [editResourceName, setEditResourceName] = useState("");
  const [editResourceDescription, setEditResourceDescription] = useState("");
  const [editResourceUrl, setEditResourceUrl] = useState("");
  const [resourceInputMode, setResourceInputMode] = useState<"url" | "file">("url");

  const { data: apps = [] } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
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

  // PARA Module queries
  const { data: paraDashboard } = useQuery<{
    projectCount: number;
    areaCount: number;
    resourceCount: number;
    pendingTaskCount: number;
    triadStats: { importante: number; urgente: number; circunstancial: number };
    recentProjects: any[];
    recentAreas: any[];
    upcomingTasks: any[];
  }>({
    queryKey: ["/api/para/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/para/dashboard", { credentials: "include" });
      if (!res.ok) return { projectCount: 0, areaCount: 0, resourceCount: 0, pendingTaskCount: 0, triadStats: { importante: 0, urgente: 0, circunstancial: 0 }, recentProjects: [], recentAreas: [], upcomingTasks: [] };
      return res.json();
    },
  });

  const { data: paraTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/para/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/para/tasks?status=pending", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: paraProjects = [] } = useQuery<any[]>({
    queryKey: ["/api/para/projects"],
    queryFn: async () => {
      const res = await fetch("/api/para/projects?status=active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: paraAreas = [] } = useQuery<any[]>({
    queryKey: ["/api/para/areas"],
    queryFn: async () => {
      const res = await fetch("/api/para/areas?status=active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: paraResources = [] } = useQuery<any[]>({
    queryKey: ["/api/para/resources"],
    queryFn: async () => {
      const res = await fetch("/api/para/resources?status=active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Buscar projetos de produção para vincular
  const { data: productionProjects = [] } = useQuery<any[]>({
    queryKey: ["/api/compass/projects"],
    queryFn: async () => {
      const res = await fetch("/api/compass/projects", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Buscar tarefas do projeto pessoal selecionado
  const { data: projectTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/para/tasks", selectedPersonalProject?.id],
    queryFn: async () => {
      if (!selectedPersonalProject?.id) return [];
      const res = await fetch(`/api/para/tasks?projectId=${selectedPersonalProject.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPersonalProject?.id,
  });

  // Buscar tarefas da área selecionada
  const { data: areaTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/para/tasks", "area", selectedArea?.id],
    queryFn: async () => {
      if (!selectedArea?.id) return [];
      const res = await fetch(`/api/para/tasks?areaId=${selectedArea.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedArea?.id,
  });

  const createParaProjectMutation = useMutation({
    mutationFn: async (data: { name: string; projectType: string; productionProjectId?: number | null }) => {
      const res = await fetch("/api/para/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar projeto");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/para/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/para/dashboard"] });
      toast({ title: "Projeto criado!" });
    },
  });

  const createParaAreaMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/para/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar área");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/para/areas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/para/dashboard"] });
      toast({ title: "Área criada!" });
    },
  });

  const createParaTaskMutation = useMutation({
    mutationFn: async (data: { title: string; triadCategory: string; projectId?: number; areaId?: number }) => {
      const res = await fetch("/api/para/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar tarefa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/para/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/para/dashboard"] });
      toast({ title: "Tarefa criada!" });
    },
  });

  const createResourceMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; type: string; url?: string }) => {
      const res = await fetch("/api/para/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar recurso");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/para/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/para/dashboard"] });
      toast({ title: "Recurso criado!" });
      setShowResourceModal(false);
      setNewResourceName("");
      setNewResourceDescription("");
      setNewResourceType("link");
      setNewResourceUrl("");
    },
  });

  const updateResourceMutation = useMutation({
    mutationFn: async (data: { id: number; name?: string; description?: string; url?: string }) => {
      const { id, ...updates } = data;
      const res = await fetch(`/api/para/resources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao atualizar recurso");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/para/resources"] });
      toast({ title: "Recurso atualizado!" });
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/para/resources/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao excluir recurso");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/para/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/para/dashboard"] });
      toast({ title: "Recurso excluído!" });
      setShowResourceDetailModal(false);
      setSelectedResource(null);
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/para/tasks/${id}/complete`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao completar tarefa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/para/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/para/dashboard"] });
      toast({ title: "Tarefa concluída!" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: { id: number; title?: string; description?: string; triadCategory?: string; status?: string }) => {
      const { id, ...updates } = data;
      const res = await fetch(`/api/para/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao atualizar tarefa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/para/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/para/dashboard"] });
      toast({ title: "Tarefa atualizada!" });
    },
  });

  const archiveTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/para/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao arquivar tarefa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/para/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/para/dashboard"] });
      toast({ title: "Tarefa arquivada!" });
      setShowTaskDetailModal(false);
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

  const handleCommandClick = () => {
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
    document.dispatchEvent(event);
  };

  const paraItems = [
    { id: "projetos" as ParaTab, icon: FolderKanban, label: "Projetos" },
    { id: "areas" as ParaTab, icon: Layers, label: "Áreas" },
    { id: "recursos" as ParaTab, icon: BookOpen, label: "Recursos" },
    { id: "arquivo" as ParaTab, icon: Archive, label: "Arquivo" },
  ];

  const filteredApps = apps.filter(app => 
    !appSearch || 
    app.name?.toLowerCase().includes(appSearch.toLowerCase()) ||
    app.category?.toLowerCase().includes(appSearch.toLowerCase())
  );

  return (
    <BrowserFrame>
      <div className="flex h-[calc(100vh-40px)] bg-background">
        <div className="w-56 border-r bg-muted/30 flex flex-col">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                </div>
                <span className="font-semibold text-sm">Arcádia Suite</span>
              </div>
              <DigitalClock />
            </div>
          </div>

          <div className="p-2 border-b">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">PARA</div>
            {paraItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition-colors ${
                    activeTab === item.id 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setActiveTab(item.id);
                    toast({ title: `${item.label}`, description: `Contexto alterado para ${item.label}` });
                  }}
                  data-testid={`para-tab-${item.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              );
            })}
          </div>

          {activeTab === "projetos" && (
            <div className="p-2 flex-1 overflow-hidden">
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Meus Projetos</span>
                <Plus className="w-3 h-3 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => {
                  setNewItemName("");
                  setShowProjectModal(true);
                }} />
              </div>
              <ScrollArea className="h-40">
                {paraProjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-2 italic">Nenhum projeto ainda</p>
                ) : (
                  paraProjects.map((project) => (
                    <div 
                      key={project.id} 
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm group ${
                        selectedPersonalProject?.id === project.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      }`}
                      onClick={() => {
                        if (project.projectType === "production" && project.productionProjectId) {
                          navigate(`/compass?project=${project.productionProjectId}`);
                        } else {
                          setSelectedPersonalProject(project);
                        }
                      }}
                      data-testid={`project-${project.id}`}
                    >
                      <div 
                        className={`w-2 h-2 rounded-full ${project.projectType === "production" ? "bg-orange-500" : "bg-blue-500"}`} 
                      />
                      <span className="truncate flex-1">{project.name}</span>
                      {project.projectType === "production" ? (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-orange-50">Prod</Badge>
                      ) : (
                        project.progress > 0 && (
                          <span className="text-[10px] text-muted-foreground">{project.progress}%</span>
                        )
                      )}
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          )}

          {activeTab === "areas" && (
            <div className="p-2 flex-1 overflow-hidden">
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Minhas Áreas</span>
                <Plus className="w-3 h-3 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => {
                  setNewItemName("");
                  setShowAreaModal(true);
                }} />
              </div>
              <ScrollArea className="h-40">
                {paraAreas.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-2 italic">Nenhuma área ainda</p>
                ) : (
                  paraAreas.map((area) => (
                    <div 
                      key={area.id} 
                      className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm ${selectedArea?.id === area.id ? "bg-muted" : ""}`}
                      onClick={() => {
                        setSelectedArea(area);
                        setSelectedPersonalProject(null);
                        setShowResourcesView(false);
                      }}
                      data-testid={`area-${area.id}`}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color || "#10b981" }} />
                      <span className="truncate flex-1">{area.name}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                        {paraTasks.filter(t => t.areaId === area.id && t.status !== "completed").length}
                      </Badge>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          )}

          {activeTab === "recursos" && (
            <div className="p-2 flex-1 overflow-hidden">
              <div 
                className="px-2 py-1.5 mb-2 rounded hover:bg-muted cursor-pointer flex items-center justify-between"
                onClick={() => { setShowResourcesView(true); setSelectedPersonalProject(null); }}
              >
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ver Todos Recursos</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="px-2 mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aplicativos ({apps.length})</span>
              </div>
              <ScrollArea className="h-20 mb-2">
                {apps.slice(0, 4).map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs"
                    onClick={() => navigate(`/app/${app.id}`)}
                    data-testid={`app-resource-${app.id}`}
                  >
                    <div className={`w-5 h-5 rounded ${app.icon?.startsWith("bg-") ? app.icon : "bg-primary"} flex items-center justify-center`}>
                      <span className="text-[10px] text-white">📱</span>
                    </div>
                    <span className="truncate flex-1">{app.name}</span>
                  </div>
                ))}
              </ScrollArea>
              <div className="px-2 mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Meus Recursos ({paraResources.length})</span>
              </div>
              <ScrollArea className="h-20">
                {paraResources.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-2 italic">Nenhum recurso ainda</p>
                ) : (
                  paraResources.map((resource) => (
                    <div key={resource.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs" data-testid={`resource-${resource.id}`}>
                      <BookOpen className="w-3 h-3 text-muted-foreground" />
                      <span className="truncate flex-1">{resource.name}</span>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          )}

          {activeTab === "arquivo" && (
            <div className="p-2 flex-1 overflow-hidden">
              <div className="px-2 mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Arquivo</span>
              </div>
              <ScrollArea className="h-40">
                <p className="text-xs text-muted-foreground px-2 py-2 italic">Itens arquivados aparecerão aqui</p>
              </ScrollArea>
            </div>
          )}

          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => {
              setNewItemName("");
              if (activeTab === "projetos") {
                setShowProjectModal(true);
              } else if (activeTab === "areas") {
                setShowAreaModal(true);
              } else if (activeTab === "recursos") {
                setShowResourceModal(true);
              }
            }} data-testid="button-new-item">
              <Plus className="w-3 h-3 mr-1" /> Novo {activeTab === "projetos" ? "Projeto" : activeTab === "areas" ? "Área" : activeTab === "recursos" ? "Recurso" : "Item"}
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="flex items-center gap-3 bg-muted/50 border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted transition-colors" onClick={handleCommandClick} data-testid="command-bar">
              <span className="text-primary font-mono text-sm">&gt;_</span>
              <span className="text-muted-foreground text-sm flex-1">Pergunte ou comande qualquer coisa...</span>
              <Badge variant="outline" className="text-xs"><Command className="w-3 h-3 mr-1" />K</Badge>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {showResourcesView ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" onClick={() => setShowResourcesView(false)} className="h-8 px-2">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold">Recursos e Referências</h2>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate("/apps")} data-testid="button-manage-apps">
                      <Settings className="w-4 h-4 mr-1" /> Gerenciar Apps
                    </Button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Aplicativos Instalados ({apps.length})
                      </h3>
                      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                        {apps.map((app) => (
                          <div
                            key={app.id}
                            className="flex flex-col items-center justify-center p-3 rounded-xl border hover:bg-muted hover:shadow-md cursor-pointer transition-all group"
                            onClick={() => navigate(`/app/${app.id}`)}
                            data-testid={`app-grid-${app.id}`}
                          >
                            <div className={`w-12 h-12 rounded-xl ${app.icon?.startsWith("bg-") ? app.icon : "bg-gradient-to-br from-primary to-blue-600"} flex items-center justify-center mb-2 group-hover:scale-105 transition-transform`}>
                              <span className="text-lg text-white">📱</span>
                            </div>
                            <span className="text-xs text-center font-medium truncate w-full">{app.name}</span>
                            <span className="text-[10px] text-muted-foreground">{app.category}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <BookOpen className="w-4 h-4" /> Meus Recursos ({paraResources.length})
                        </h3>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                            <Input
                              placeholder="Pesquisar recursos..."
                              value={resourceSearch}
                              onChange={(e) => setResourceSearch(e.target.value)}
                              className="h-7 w-48 text-xs pl-7"
                              data-testid="input-resource-search"
                            />
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowResourceModal(true)} data-testid="button-new-resource">
                            <Plus className="w-3 h-3 mr-1" /> Novo Recurso
                          </Button>
                        </div>
                      </div>
                      {paraResources.length === 0 ? (
                        <Card className="border-dashed">
                          <CardContent className="flex flex-col items-center justify-center py-8">
                            <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">Nenhum recurso cadastrado</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">Recursos são materiais de referência como artigos, vídeos, documentos</p>
                            <Button size="sm" variant="outline" className="mt-4" onClick={() => setShowResourceModal(true)} data-testid="button-create-first-resource">
                              <Plus className="w-4 h-4 mr-1" /> Criar Primeiro Recurso
                            </Button>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {paraResources
                            .filter(r => !resourceSearch || r.name.toLowerCase().includes(resourceSearch.toLowerCase()) || (r.description && r.description.toLowerCase().includes(resourceSearch.toLowerCase())))
                            .map((resource) => (
                            <Card 
                              key={resource.id} 
                              className="hover:shadow-md transition-shadow cursor-pointer" 
                              data-testid={`resource-card-${resource.id}`}
                              onClick={() => {
                                setSelectedResource(resource);
                                setEditResourceName(resource.name);
                                setEditResourceDescription(resource.description || "");
                                setEditResourceUrl(resource.url || "");
                                setShowResourceDetailModal(true);
                              }}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                  {resource.type === "link" ? <ExternalLink className="w-4 h-4 text-blue-500 mt-0.5" /> :
                                   resource.type === "document" ? <FileText className="w-4 h-4 text-orange-500 mt-0.5" /> :
                                   resource.type === "note" ? <Bookmark className="w-4 h-4 text-green-500 mt-0.5" /> :
                                   <BookOpen className="w-4 h-4 text-primary mt-0.5" />}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{resource.name}</p>
                                    {resource.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{resource.description}</p>}
                                    <p className="text-[10px] text-muted-foreground/70 mt-1 capitalize">{resource.type || "link"}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          {paraResources.filter(r => !resourceSearch || r.name.toLowerCase().includes(resourceSearch.toLowerCase()) || (r.description && r.description.toLowerCase().includes(resourceSearch.toLowerCase()))).length === 0 && (
                            <div className="col-span-full text-center py-8 text-muted-foreground">
                              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">Nenhum recurso encontrado para "{resourceSearch}"</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : selectedArea ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedArea(null)} className="h-8 px-2">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedArea.color || "#10b981" }} />
                        <h2 className="text-lg font-semibold">{selectedArea.name}</h2>
                        <Badge variant="outline" className="text-xs bg-green-50">Área</Badge>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => {
                      setNewTaskTitle("");
                      setNewTaskCategory("importante");
                      setSelectedTaskAreaId(selectedArea.id);
                      setShowTaskModal(true);
                    }} data-testid="button-add-area-task">
                      <Plus className="w-4 h-4 mr-1" /> Nova Tarefa
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <Card className="bg-green-50/50 border-green-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          Importante
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {areaTasks.filter(t => t.triadCategory === "importante" && t.status !== "completed").map(task => (
                          <div 
                            key={task.id}
                            className="p-3 bg-white rounded-lg border border-green-200 shadow-sm cursor-pointer hover:shadow-md transition-all"
                            onClick={() => { setSelectedTask(task); setShowTaskDetailModal(true); }}
                            onDoubleClick={() => completeTaskMutation.mutate(task.id)}
                            data-testid={`area-task-${task.id}`}
                          >
                            <p className="font-medium text-sm text-green-900">{task.title}</p>
                            <p className="text-green-600/70 text-xs mt-1">Clique para detalhes • 2x para concluir</p>
                          </div>
                        ))}
                        {areaTasks.filter(t => t.triadCategory === "importante" && t.status !== "completed").length === 0 && (
                          <p className="text-xs text-green-400 italic text-center py-4">Nenhuma tarefa</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-yellow-50/50 border-yellow-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-yellow-700">
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                          Urgente
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {areaTasks.filter(t => t.triadCategory === "urgente" && t.status !== "completed").map(task => (
                          <div 
                            key={task.id}
                            className="p-3 bg-white rounded-lg border border-yellow-200 shadow-sm cursor-pointer hover:shadow-md transition-all"
                            onClick={() => { setSelectedTask(task); setShowTaskDetailModal(true); }}
                            onDoubleClick={() => completeTaskMutation.mutate(task.id)}
                            data-testid={`area-task-${task.id}`}
                          >
                            <p className="font-medium text-sm text-yellow-900">{task.title}</p>
                            <p className="text-yellow-600/70 text-xs mt-1">Clique para detalhes • 2x para concluir</p>
                          </div>
                        ))}
                        {areaTasks.filter(t => t.triadCategory === "urgente" && t.status !== "completed").length === 0 && (
                          <p className="text-xs text-yellow-400 italic text-center py-4">Nenhuma tarefa</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-red-50/50 border-red-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          Circunstancial
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {areaTasks.filter(t => t.triadCategory === "circunstancial" && t.status !== "completed").map(task => (
                          <div 
                            key={task.id}
                            className="p-3 bg-white rounded-lg border border-red-200 shadow-sm cursor-pointer hover:shadow-md transition-all"
                            onClick={() => { setSelectedTask(task); setShowTaskDetailModal(true); }}
                            onDoubleClick={() => completeTaskMutation.mutate(task.id)}
                            data-testid={`area-task-${task.id}`}
                          >
                            <p className="font-medium text-sm text-red-900">{task.title}</p>
                            <p className="text-red-600/70 text-xs mt-1">Clique para detalhes • 2x para concluir</p>
                          </div>
                        ))}
                        {areaTasks.filter(t => t.triadCategory === "circunstancial" && t.status !== "completed").length === 0 && (
                          <p className="text-xs text-red-400 italic text-center py-4">Nenhuma tarefa</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {areaTasks.filter(t => t.status === "completed").length > 0 && (
                    <Card className="mt-4 bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Concluídas ({areaTasks.filter(t => t.status === "completed").length})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {areaTasks.filter(t => t.status === "completed").slice(0, 5).map(task => (
                            <Badge key={task.id} variant="outline" className="text-xs line-through text-muted-foreground">
                              {task.title}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : selectedPersonalProject ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedPersonalProject(null)} className="h-8 px-2">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <h2 className="text-lg font-semibold">{selectedPersonalProject.name}</h2>
                        <Badge variant="outline" className="text-xs bg-blue-50">Pessoal</Badge>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => {
                      setNewTaskTitle("");
                      setNewTaskCategory("importante");
                      setSelectedTaskProjectId(selectedPersonalProject.id);
                      setShowTaskModal(true);
                    }} data-testid="button-add-project-task">
                      <Plus className="w-4 h-4 mr-1" /> Nova Tarefa
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <Card className="bg-green-50/50 border-green-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          Importante
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {projectTasks.filter(t => t.triadCategory === "importante" && t.status !== "completed").map(task => (
                          <div 
                            key={task.id}
                            className="p-3 bg-white rounded-lg border border-green-200 shadow-sm cursor-pointer hover:shadow-md transition-all"
                            onClick={() => completeTaskMutation.mutate(task.id)}
                            data-testid={`project-task-${task.id}`}
                          >
                            <p className="font-medium text-sm text-green-900">{task.title}</p>
                            <p className="text-green-600/70 text-xs mt-1">Clique para concluir</p>
                          </div>
                        ))}
                        {projectTasks.filter(t => t.triadCategory === "importante" && t.status !== "completed").length === 0 && (
                          <p className="text-xs text-green-400 italic text-center py-4">Arraste ou crie tarefas</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-yellow-50/50 border-yellow-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-yellow-700">
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                          Urgente
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {projectTasks.filter(t => t.triadCategory === "urgente" && t.status !== "completed").map(task => (
                          <div 
                            key={task.id}
                            className="p-3 bg-white rounded-lg border border-yellow-200 shadow-sm cursor-pointer hover:shadow-md transition-all"
                            onClick={() => completeTaskMutation.mutate(task.id)}
                            data-testid={`project-task-${task.id}`}
                          >
                            <p className="font-medium text-sm text-yellow-900">{task.title}</p>
                            <p className="text-yellow-600/70 text-xs mt-1">Clique para concluir</p>
                          </div>
                        ))}
                        {projectTasks.filter(t => t.triadCategory === "urgente" && t.status !== "completed").length === 0 && (
                          <p className="text-xs text-yellow-400 italic text-center py-4">Arraste ou crie tarefas</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-red-50/50 border-red-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          Circunstancial
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {projectTasks.filter(t => t.triadCategory === "circunstancial" && t.status !== "completed").map(task => (
                          <div 
                            key={task.id}
                            className="p-3 bg-white rounded-lg border border-red-200 shadow-sm cursor-pointer hover:shadow-md transition-all"
                            onClick={() => completeTaskMutation.mutate(task.id)}
                            data-testid={`project-task-${task.id}`}
                          >
                            <p className="font-medium text-sm text-red-900">{task.title}</p>
                            <p className="text-red-600/70 text-xs mt-1">Clique para concluir</p>
                          </div>
                        ))}
                        {projectTasks.filter(t => t.triadCategory === "circunstancial" && t.status !== "completed").length === 0 && (
                          <p className="text-xs text-red-400 italic text-center py-4">Arraste ou crie tarefas</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {projectTasks.filter(t => t.status === "completed").length > 0 && (
                    <Card className="mt-4 bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Concluídas ({projectTasks.filter(t => t.status === "completed").length})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {projectTasks.filter(t => t.status === "completed").slice(0, 5).map(task => (
                            <Badge key={task.id} variant="outline" className="text-xs line-through text-muted-foreground">
                              {task.title}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Contexto:</span>
                <Badge variant="secondary" className="text-xs">
                  {activeTab === "projetos" && "Projetos"}
                  {activeTab === "areas" && "Áreas de Responsabilidade"}
                  {activeTab === "recursos" && "Recursos e Referências"}
                  {activeTab === "arquivo" && "Arquivo"}
                </Badge>
              </div>

              <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" /> Tríade do Tempo - Minhas Tarefas
                    </CardTitle>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                      setNewTaskTitle("");
                      setNewTaskCategory("importante");
                      setShowTaskModal(true);
                    }} data-testid="button-add-task">
                      + Nova Tarefa
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-6">
                    <TriadeDonutChart tasks={paraDashboard?.triadStats || { importante: 0, urgente: 0, circunstancial: 0 }} />
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-green-600">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          Importante ({paraDashboard?.triadStats.importante || 0})
                        </div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {paraTasks.filter(t => t.triadCategory === "importante").slice(0, 3).map(task => (
                            <div 
                              key={task.id}
                              className="p-2.5 bg-green-50 rounded-lg border border-green-200 text-xs cursor-pointer hover:bg-green-100 hover:shadow-sm transition-all group"
                              onClick={() => { setSelectedTask(task); setShowTaskDetailModal(true); }}
                              onDoubleClick={() => completeTaskMutation.mutate(task.id)}
                              data-testid={`task-importante-${task.id}`}
                            >
                              <p className="font-medium text-green-900">{task.title}</p>
                              <p className="text-green-600/70 text-[10px]">Clique para detalhes • 2x para concluir</p>
                            </div>
                          ))}
                          {paraTasks.filter(t => t.triadCategory === "importante").length === 0 && (
                            <p className="text-xs text-green-400 italic">Nenhuma tarefa</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-yellow-600">
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                          Urgente ({paraDashboard?.triadStats.urgente || 0})
                        </div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {paraTasks.filter(t => t.triadCategory === "urgente").slice(0, 3).map(task => (
                            <div 
                              key={task.id}
                              className="p-2.5 bg-yellow-50 rounded-lg border border-yellow-200 text-xs cursor-pointer hover:bg-yellow-100 hover:shadow-sm transition-all"
                              onClick={() => { setSelectedTask(task); setShowTaskDetailModal(true); }}
                              onDoubleClick={() => completeTaskMutation.mutate(task.id)}
                              data-testid={`task-urgente-${task.id}`}
                            >
                              <p className="font-medium text-yellow-900">{task.title}</p>
                              <p className="text-yellow-600/70 text-[10px]">Clique para detalhes • 2x para concluir</p>
                            </div>
                          ))}
                          {paraTasks.filter(t => t.triadCategory === "urgente").length === 0 && (
                            <p className="text-xs text-yellow-400 italic">Nenhuma tarefa</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-red-600">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          Circunstancial ({paraDashboard?.triadStats.circunstancial || 0})
                        </div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {paraTasks.filter(t => t.triadCategory === "circunstancial").slice(0, 3).map(task => (
                            <div 
                              key={task.id}
                              className="p-2.5 bg-red-50 rounded-lg border border-red-200 text-xs cursor-pointer hover:bg-red-100 hover:shadow-sm transition-all"
                              onClick={() => { setSelectedTask(task); setShowTaskDetailModal(true); }}
                              onDoubleClick={() => completeTaskMutation.mutate(task.id)}
                              data-testid={`task-circunstancial-${task.id}`}
                            >
                              <p className="font-medium text-red-900">{task.title}</p>
                              <p className="text-red-600/70 text-[10px]">Clique para detalhes • 2x para concluir</p>
                            </div>
                          ))}
                          {paraTasks.filter(t => t.triadCategory === "circunstancial").length === 0 && (
                            <p className="text-xs text-red-400 italic">Nenhuma tarefa</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:shadow-md transition-shadow cursor-pointer overflow-hidden" onClick={() => navigate("/xos")} data-testid="card-xos-quick">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                      <Layers className="w-4 h-4" /> XOS
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-blue-600 mb-3">Experience Operating System</p>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-1.5">
                      <Button size="sm" variant="outline" className="h-8 min-w-0 justify-start px-2 text-[11px] text-blue-700" onClick={(e) => { e.stopPropagation(); navigate("/xos/crm"); }} data-testid="button-xos-crm">
                        👥 CRM
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 min-w-0 justify-start px-2 text-[11px] text-blue-700" onClick={(e) => { e.stopPropagation(); navigate("/xos/inbox"); }} data-testid="button-xos-inbox">
                        💬 Inbox
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 min-w-0 justify-start px-2 text-[11px] text-blue-700" onClick={(e) => { e.stopPropagation(); navigate("/xos/tickets"); }} data-testid="button-xos-tickets">
                        🎫 Tickets
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 min-w-0 justify-start px-2 text-[11px] text-blue-700" onClick={(e) => { e.stopPropagation(); navigate("/xos/campaigns"); }} data-testid="button-xos-campaigns">
                        🎯 Campanhas
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        ✏️ Notas Rápidas
                      </CardTitle>
                      <Button size="sm" variant="default" className="h-6 text-xs" onClick={() => newNoteContent && createNoteMutation.mutate(newNoteContent)} disabled={!newNoteContent} data-testid="button-save-note">
                        + Salvar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Input 
                        placeholder="Digite uma nota rápida..." 
                        value={newNoteContent} 
                        onChange={(e) => setNewNoteContent(e.target.value)} 
                        className="h-8 text-xs" 
                        data-testid="input-new-note"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newNoteContent) {
                            createNoteMutation.mutate(newNoteContent);
                          }
                        }}
                      />
                      <ScrollArea className="h-24">
                        {notes.slice(0, 5).map((note) => (
                          <div key={note.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-muted rounded group" data-testid={`note-${note.id}`}>
                            <p className="text-xs truncate flex-1">{note.content}</p>
                            <Trash2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-pointer hover:text-red-500" onClick={() => deleteNoteMutation.mutate(note.id)} />
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Páginas Recentes
                      </CardTitle>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 text-xs"
                        onClick={() => createPageMutation.mutate()}
                        data-testid="button-new-page"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Nova
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-28">
                      <div className="space-y-1">
                        {pages.slice(0, 5).map((page) => (
                          <div key={page.id} className="flex items-center justify-between py-1.5 hover:bg-muted px-2 rounded cursor-pointer" onClick={() => navigate(`/page/${page.id}`)} data-testid={`recent-page-${page.id}`}>
                            <div className="flex items-center gap-2">
                              <FileText className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs truncate">{page.title}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{formatTimeAgo(page.updatedAt)}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Bell className="w-4 h-4" /> Atividades
                      </CardTitle>
                      {activities.filter(a => !a.isRead).length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {activities.filter(a => !a.isRead).length} nova(s)
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-28">
                      {activities.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade recente</p>
                      ) : (
                        <div className="space-y-2">
                          {activities.slice(0, 5).map((activity) => (
                            <div key={activity.id} className={`flex items-start gap-2 p-2 rounded text-xs ${!activity.isRead ? "bg-blue-50 border-l-2 border-blue-400" : "hover:bg-muted"}`} data-testid={`activity-${activity.id}`}>
                              <FileText className="w-3 h-3 text-blue-500 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className={`truncate text-[11px] ${!activity.isRead ? "font-medium text-blue-900" : ""}`}>{activity.description || activity.entityTitle}</p>
                                <p className="text-muted-foreground text-[10px]">{formatTimeAgo(activity.createdAt)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </>
            )}
            </div>
          </ScrollArea>
        </div>

        <CommunitiesSidebar />
      </div>

      {/* Modal para criar projeto */}
      <Dialog open={showProjectModal} onOpenChange={setShowProjectModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Projeto</Label>
              <div className="grid grid-cols-2 gap-3">
                <div 
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    newProjectType === "personal" 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-muted-foreground/50"
                  }`}
                  onClick={() => {
                    setNewProjectType("personal");
                    setSelectedProductionProjectId(null);
                  }}
                  data-testid="project-type-personal"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="font-medium text-sm">Pessoal</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Quadro Kanban individual com suas tarefas</p>
                </div>
                <div 
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    newProjectType === "production" 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-muted-foreground/50"
                  }`}
                  onClick={() => setNewProjectType("production")}
                  data-testid="project-type-production"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="font-medium text-sm">Produção</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Vinculado ao módulo de Produção</p>
                </div>
              </div>
            </div>

            {newProjectType === "personal" && (
              <div className="space-y-2">
                <Label htmlFor="project-name">Nome do projeto</Label>
                <Input
                  id="project-name"
                  placeholder="Ex: Organizar finanças pessoais"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  data-testid="input-project-name"
                />
              </div>
            )}

            {newProjectType === "production" && (
              <div className="space-y-2">
                <Label>Selecione o projeto de Produção</Label>
                <Select 
                  value={selectedProductionProjectId?.toString() || ""} 
                  onValueChange={(v) => {
                    setSelectedProductionProjectId(Number(v));
                    const proj = productionProjects.find((p: any) => p.id === Number(v));
                    if (proj) setNewItemName(proj.name);
                  }}
                >
                  <SelectTrigger data-testid="select-production-project">
                    <SelectValue placeholder="Selecione um projeto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {productionProjects.map((proj: any) => (
                      <SelectItem key={proj.id} value={proj.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-500" />
                          {proj.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {productionProjects.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum projeto de produção encontrado. Crie um no módulo Produção primeiro.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => {
                if (newItemName.trim()) {
                  createParaProjectMutation.mutate({
                    name: newItemName,
                    projectType: newProjectType,
                    productionProjectId: newProjectType === "production" ? selectedProductionProjectId : null
                  });
                  setShowProjectModal(false);
                  setNewItemName("");
                  setNewProjectType("personal");
                  setSelectedProductionProjectId(null);
                }
              }}
              disabled={!newItemName.trim() || (newProjectType === "production" && !selectedProductionProjectId)}
              data-testid="button-confirm-project"
            >
              Criar Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para criar área */}
      <Dialog open={showAreaModal} onOpenChange={setShowAreaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Área de Responsabilidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="area-name">Nome da área</Label>
              <Input
                id="area-name"
                placeholder="Ex: Finanças Pessoais"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newItemName.trim()) {
                    createParaAreaMutation.mutate(newItemName);
                    setShowAreaModal(false);
                  }
                }}
                data-testid="input-area-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAreaModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => {
                if (newItemName.trim()) {
                  createParaAreaMutation.mutate(newItemName);
                  setShowAreaModal(false);
                }
              }}
              disabled={!newItemName.trim()}
              data-testid="button-confirm-area"
            >
              Criar Área
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para criar recurso */}
      <Dialog open={showResourceModal} onOpenChange={setShowResourceModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Recurso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resource-name">Nome do recurso</Label>
              <Input
                id="resource-name"
                placeholder="Ex: Documentação da API"
                value={newResourceName}
                onChange={(e) => setNewResourceName(e.target.value)}
                data-testid="input-resource-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-description">Descrição (opcional)</Label>
              <Input
                id="resource-description"
                placeholder="Breve descrição do recurso"
                value={newResourceDescription}
                onChange={(e) => setNewResourceDescription(e.target.value)}
                data-testid="input-resource-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-type">Tipo de recurso</Label>
              <Select value={newResourceType} onValueChange={setNewResourceType}>
                <SelectTrigger id="resource-type" data-testid="select-resource-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">
                    <div className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-blue-500" />
                      Link / URL
                    </div>
                  </SelectItem>
                  <SelectItem value="document">
                    <div className="flex items-center gap-2">
                      <File className="w-4 h-4 text-orange-500" />
                      Documento
                    </div>
                  </SelectItem>
                  <SelectItem value="note">
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-green-500" />
                      Anotação / Bookmark
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(newResourceType === "link" || newResourceType === "document") && (
              <div className="space-y-3">
                <Label>Fonte do recurso</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant={resourceInputMode === "url" ? "default" : "outline"} 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setResourceInputMode("url")}
                  >
                    <Link className="w-4 h-4 mr-1" /> URL / Link
                  </Button>
                  <Button 
                    type="button" 
                    variant={resourceInputMode === "file" ? "default" : "outline"} 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setResourceInputMode("file")}
                  >
                    <File className="w-4 h-4 mr-1" /> Anexar Arquivo
                  </Button>
                </div>
                {resourceInputMode === "url" ? (
                  <div className="space-y-2">
                    <Label htmlFor="resource-url">URL</Label>
                    <Input
                      id="resource-url"
                      placeholder="https://exemplo.com/documento"
                      value={newResourceUrl}
                      onChange={(e) => setNewResourceUrl(e.target.value)}
                      data-testid="input-resource-url"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="resource-file">Arquivo</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="resource-file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            toast({ title: `Arquivo selecionado: ${file.name}`, description: "Upload de arquivos será implementado em breve" });
                          }
                        }}
                        data-testid="input-resource-file"
                      />
                      <label htmlFor="resource-file" className="cursor-pointer">
                        <File className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Clique para selecionar arquivo</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">PDF, DOC, XLS, imagens</p>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResourceModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => {
                if (newResourceName.trim()) {
                  createResourceMutation.mutate({
                    name: newResourceName,
                    description: newResourceDescription || undefined,
                    type: newResourceType,
                    url: newResourceUrl || undefined
                  });
                }
              }}
              disabled={!newResourceName.trim() || createResourceMutation.isPending}
              data-testid="button-confirm-resource"
            >
              {createResourceMutation.isPending ? "Criando..." : "Criar Recurso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de detalhes do recurso */}
      <Dialog open={showResourceDetailModal} onOpenChange={(open) => {
        if (!open) {
          setShowResourceDetailModal(false);
          setSelectedResource(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedResource?.type === "link" ? <ExternalLink className="w-5 h-5 text-blue-500" /> :
               selectedResource?.type === "document" ? <FileText className="w-5 h-5 text-orange-500" /> :
               selectedResource?.type === "note" ? <Bookmark className="w-5 h-5 text-green-500" /> :
               <BookOpen className="w-5 h-5 text-primary" />}
              Detalhes do Recurso
            </DialogTitle>
          </DialogHeader>
          {selectedResource && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-resource-name">Nome</Label>
                <Input
                  id="edit-resource-name"
                  value={editResourceName}
                  onChange={(e) => setEditResourceName(e.target.value)}
                  data-testid="input-edit-resource-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-resource-description">Descrição</Label>
                <Input
                  id="edit-resource-description"
                  value={editResourceDescription}
                  onChange={(e) => setEditResourceDescription(e.target.value)}
                  placeholder="Descrição do recurso"
                  data-testid="input-edit-resource-description"
                />
              </div>
              {(selectedResource.type === "link" || selectedResource.type === "document") && (
                <div className="space-y-2">
                  <Label htmlFor="edit-resource-url">URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="edit-resource-url"
                      value={editResourceUrl}
                      onChange={(e) => setEditResourceUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1"
                      data-testid="input-edit-resource-url"
                    />
                    {editResourceUrl && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/app/${selectedResource.id}`)}
                        data-testid="button-open-resource"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="capitalize">{selectedResource.type || "link"}</Badge>
                <span>Criado em {new Date(selectedResource.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => {
                if (selectedResource) {
                  deleteResourceMutation.mutate(selectedResource.id);
                }
              }}
              disabled={deleteResourceMutation.isPending}
              data-testid="button-delete-resource"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowResourceDetailModal(false)}>Cancelar</Button>
              <Button 
                onClick={() => {
                  if (selectedResource && editResourceName.trim()) {
                    updateResourceMutation.mutate({
                      id: selectedResource.id,
                      name: editResourceName,
                      description: editResourceDescription || undefined,
                      url: editResourceUrl || undefined
                    });
                    setShowResourceDetailModal(false);
                  }
                }}
                disabled={!editResourceName.trim() || updateResourceMutation.isPending}
                data-testid="button-save-resource"
              >
                {updateResourceMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para criar tarefa */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Título da tarefa</Label>
              <Input
                id="task-title"
                placeholder="Ex: Revisar relatório mensal"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                data-testid="input-task-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-category">Classificação (Tríade do Tempo)</Label>
              <Select value={newTaskCategory} onValueChange={setNewTaskCategory}>
                <SelectTrigger id="task-category" data-testid="select-task-category">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="importante">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Importante - Metas de longo prazo
                    </div>
                  </SelectItem>
                  <SelectItem value="urgente">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      Urgente - Precisa de atenção imediata
                    </div>
                  </SelectItem>
                  <SelectItem value="circunstancial">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      Circunstancial - Pode ser eliminada
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Vincular a Projeto</Label>
                <Select 
                  value={selectedTaskProjectId?.toString() || "none"} 
                  onValueChange={(v) => setSelectedTaskProjectId(v === "none" ? null : Number(v))}
                >
                  <SelectTrigger data-testid="select-task-project">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum projeto</SelectItem>
                    {paraProjects.map((proj: any) => (
                      <SelectItem key={proj.id} value={proj.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${proj.projectType === "production" ? "bg-orange-500" : "bg-blue-500"}`} />
                          {proj.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vincular a Área</Label>
                <Select 
                  value={selectedTaskAreaId?.toString() || "none"} 
                  onValueChange={(v) => setSelectedTaskAreaId(v === "none" ? null : Number(v))}
                >
                  <SelectTrigger data-testid="select-task-area">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma área</SelectItem>
                    {paraAreas.map((area: any) => (
                      <SelectItem key={area.id} value={area.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          {area.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => {
                if (newTaskTitle.trim()) {
                  createParaTaskMutation.mutate({ 
                    title: newTaskTitle, 
                    triadCategory: newTaskCategory,
                    projectId: selectedTaskProjectId ?? undefined,
                    areaId: selectedTaskAreaId ?? undefined
                  });
                  setShowTaskModal(false);
                  setNewTaskTitle("");
                  setNewTaskCategory("importante");
                  setSelectedTaskProjectId(null);
                  setSelectedTaskAreaId(null);
                }
              }}
              disabled={!newTaskTitle.trim()}
              data-testid="button-confirm-task"
            >
              Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de detalhes da tarefa */}
      <Dialog open={showTaskDetailModal} onOpenChange={(open) => {
        setShowTaskDetailModal(open);
        if (open && selectedTask) {
          setEditTaskTitle(selectedTask.title || "");
          setEditTaskDescription(selectedTask.description || "");
          setEditTaskCategory(selectedTask.triadCategory || "importante");
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-task-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                editTaskCategory === "importante" ? "bg-green-500" :
                editTaskCategory === "urgente" ? "bg-yellow-500" : "bg-red-500"
              }`} />
              <Input
                value={editTaskTitle}
                onChange={(e) => setEditTaskTitle(e.target.value)}
                className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
                data-testid="input-task-title"
              />
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Classificação</Label>
                <Select value={editTaskCategory} onValueChange={setEditTaskCategory}>
                  <SelectTrigger data-testid="select-task-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="importante">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500" /> Importante</div>
                    </SelectItem>
                    <SelectItem value="urgente">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500" /> Urgente</div>
                    </SelectItem>
                    <SelectItem value="circunstancial">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> Circunstancial</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Badge variant={selectedTask?.status === "completed" ? "default" : "outline"} className="text-sm">
                  {selectedTask?.status === "completed" ? "Concluída" : "Pendente"}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição / História</Label>
              <textarea 
                className="w-full min-h-[120px] p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Adicione detalhes, contexto ou histórico desta tarefa..."
                value={editTaskDescription}
                onChange={(e) => setEditTaskDescription(e.target.value)}
                data-testid="textarea-task-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Comentários</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Adicionar comentário..."
                  value={taskComment}
                  onChange={(e) => setTaskComment(e.target.value)}
                  data-testid="input-task-comment"
                />
                <Button size="sm" variant="outline" data-testid="button-add-comment">Enviar</Button>
              </div>
              <div className="space-y-2 mt-2 max-h-32 overflow-y-auto">
                <p className="text-xs text-muted-foreground italic">Nenhum comentário ainda</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="mb-2 block">Ações</Label>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => selectedTask?.id && archiveTaskMutation.mutate(selectedTask.id)}
                  data-testid="button-archive-task"
                >
                  <Archive className="w-3 h-3 mr-1" /> Arquivar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => {
                    toast({ title: "Funcionalidade em desenvolvimento", description: "Em breve você poderá converter tarefas em recursos" });
                  }}
                  data-testid="button-convert-resource"
                >
                  <BookOpen className="w-3 h-3 mr-1" /> Converter em Recurso
                </Button>
                {selectedTask?.status !== "completed" && (
                  <Button 
                    size="sm" 
                    className="text-xs"
                    onClick={() => {
                      if (selectedTask?.id) {
                        completeTaskMutation.mutate(selectedTask.id);
                        setShowTaskDetailModal(false);
                      }
                    }}
                    data-testid="button-complete-task"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar Concluída
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDetailModal(false)} data-testid="button-close-task-detail">Fechar</Button>
            <Button 
              onClick={() => {
                if (selectedTask?.id) {
                  updateTaskMutation.mutate({
                    id: selectedTask.id,
                    title: editTaskTitle,
                    description: editTaskDescription,
                    triadCategory: editTaskCategory
                  });
                  setShowTaskDetailModal(false);
                }
              }}
              data-testid="button-save-task"
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BrowserFrame>
  );
}
