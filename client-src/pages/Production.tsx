import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Users, User, Layers, Clock, CheckCircle2, Circle, AlertCircle, Play, Pause, MoreHorizontal, 
  Calendar, Timer, Trash2, FolderKanban, Building2, Briefcase, FileText, Bot, Search,
  DollarSign, TrendingUp, Target, Zap, ArrowRight, Paperclip, Upload, Loader2,
  BarChart3, ChevronRight, GripVertical, Star, Flag
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Project {
  id: number;
  name: string;
  description?: string;
  type: "internal" | "external" | "compass";
  clientId?: number;
  clientName?: string;
  compassProjectId?: number;
  status: string;
  budget?: number;
  totalCost?: number;
  startDate?: string;
  endDate?: string;
}

interface Squad { 
  id: number; 
  name: string; 
  description?: string; 
  membersCount?: number; 
  color?: string;
  productOwnerId?: string;
  techLeadId?: string;
  leaderId?: string;
}
interface Collaborator { 
  id: string; 
  name: string; 
  username: string;
  email?: string; 
  phone?: string;
  collaboratorType: string; 
  hourlyRate?: string; 
  skills?: string[];
  status?: string;
}

interface ProjectMember {
  id: number;
  projectId: number;
  userId?: string;
  collaboratorId?: number;
  role: "product_owner" | "tech_lead" | "member";
  isExternal: boolean;
  assignedAt: string;
  userName?: string;
  userEmail?: string;
  userHourlyRate?: string;
  collaboratorName?: string;
  collaboratorEmail?: string;
  collaboratorHourlyRate?: string;
  collaboratorType?: string;
}

interface ExternalCollaborator {
  id: number;
  tenantId: number;
  name: string;
  email?: string;
  phone?: string;
  type: string;
  hourlyRate?: string;
  skills?: string[];
  notes?: string;
  status?: string;
}
interface Sprint { 
  id: number; 
  projectId?: number;
  projectName?: string;
  squadId?: number; 
  name: string; 
  goal?: string; 
  startDate?: string; 
  endDate?: string; 
  status: string; 
  velocity?: number;
  completedPoints?: number;
}

interface WorkItem { 
  id: number; 
  projectId?: number;
  squadId?: number; 
  sprintId?: number; 
  parentId?: number;
  code?: string;
  title: string; 
  description?: string; 
  type: string; 
  status: string; 
  priority: string; 
  storyPoints?: number;
  effortScore?: number;
  estimatedHours?: number;
  actualHours?: number;
  hourlyRate?: number;
  totalCost?: number;
  origin?: string; 
  originId?: number; 
  assigneeId?: string; 
  assigneeName?: string;
  tags?: string[];
  attachments?: { id: number; name: string; url: string }[];
}

interface Timesheet { 
  id: number; 
  workItemId?: number; 
  workItemTitle?: string;
  projectId?: number;
  sprintId?: number;
  userId: string; 
  userName?: string;
  date: string; 
  hours: number; 
  description?: string;
  hourlyRate?: number;
  totalCost?: number;
  billable?: boolean;
  status?: "draft" | "pending" | "approved" | "rejected";
  timerStartedAt?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
}

interface SquadMember {
  id: number;
  squadId: number;
  userId: string;
  memberRole?: string;
  userName?: string;
  collaboratorType?: string;
  hourlyRate?: string;
}

function SquadDetailContent({ 
  squad, 
  collaborators, 
  onUpdate, 
  onAddCollaborator,
  onDelete,
  onClose
}: { 
  squad: Squad; 
  collaborators: Collaborator[]; 
  onUpdate: (squad: Squad) => void; 
  onAddCollaborator: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [addingMember, setAddingMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [editName, setEditName] = useState(squad.name);
  const [editDescription, setEditDescription] = useState(squad.description || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch(`/api/production/squads/${squad.id}/members`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { setMembers(Array.isArray(data) ? data : []); setLoadingMembers(false); })
      .catch(() => setLoadingMembers(false));
  }, [squad.id]);

  const updateSquadField = async (field: string, value: string | null) => {
    const res = await fetch(`/api/production/squads/${squad.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
      credentials: "include",
    });
    if (res.ok) {
      const updated = await res.json();
      onUpdate({ ...squad, ...updated });
    }
  };

  const saveChanges = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/production/squads/${squad.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() || null }),
      credentials: "include",
    });
    if (res.ok) {
      const updated = await res.json();
      onUpdate({ ...squad, ...updated });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    await fetch(`/api/production/squads/${squad.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    onDelete();
    onClose();
  };

  const addMember = async () => {
    if (!selectedMemberId) return;
    setAddingMember(true);
    const res = await fetch(`/api/production/squads/${squad.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedMemberId, memberRole }),
      credentials: "include",
    });
    if (res.ok) {
      const newMember = await res.json();
      const collab = collaborators.find(c => c.id === selectedMemberId);
      setMembers([...members, { ...newMember, userName: collab?.name, collaboratorType: collab?.collaboratorType, hourlyRate: collab?.hourlyRate }]);
      setSelectedMemberId("");
      setMemberRole("member");
    }
    setAddingMember(false);
  };

  const removeMember = async (userId: string) => {
    await fetch(`/api/production/squads/${squad.id}/members/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    setMembers(members.filter(m => m.userId !== userId));
  };

  const availableCollabs = collaborators.filter(c => !members.some(m => m.userId === c.id));

  if (confirmDelete) {
    return (
      <div className="space-y-4 p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold">Excluir Squad</h3>
          <p className="text-sm text-slate-500 mt-2">
            Tem certeza que deseja excluir o squad "{squad.name}"? Esta ação não pode ser desfeita.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" className="flex-1" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" /> Excluir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <div>
          <Label>Nome do Squad</Label>
          <Input 
            value={editName} 
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Nome do squad"
          />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea 
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Descrição do squad..."
            rows={2}
          />
        </div>
        {(editName !== squad.name || editDescription !== (squad.description || "")) && (
          <Button onClick={saveChanges} disabled={saving || !editName.trim()} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar Alterações
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Product Owner</Label>
          <Select
            value={squad.productOwnerId || "none"}
            onValueChange={(v) => updateSquadField("productOwnerId", v === "none" ? null : v)}
          >
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não definido</SelectItem>
              {collaborators.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tech Lead</Label>
          <Select
            value={squad.techLeadId || "none"}
            onValueChange={(v) => updateSquadField("techLeadId", v === "none" ? null : v)}
          >
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não definido</SelectItem>
              {collaborators.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-2 block">Membros do Squad</Label>
        <div className="space-y-2 p-3 bg-slate-50 rounded-lg max-h-48 overflow-y-auto">
          {loadingMembers ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Nenhum membro no squad</p>
          ) : (
            members.map((member) => (
              <div key={member.userId} className="flex items-center justify-between p-2 bg-white rounded border">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium">{member.userName || member.userId}</span>
                  <Badge variant="outline" className="text-xs">
                    {member.memberRole === "po" ? "PO" : member.memberRole === "tech_lead" ? "Tech Lead" : "Membro"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">R$ {member.hourlyRate || "0"}/h</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeMember(member.userId)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-2">
        <Label className="text-xs text-slate-500">Adicionar Membro</Label>
        <div className="flex gap-2">
          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione colaborador..." /></SelectTrigger>
            <SelectContent>
              {availableCollabs.length === 0 ? (
                <SelectItem value="none" disabled>Nenhum disponível</SelectItem>
              ) : (
                availableCollabs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Select value={memberRole} onValueChange={setMemberRole}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Membro</SelectItem>
              <SelectItem value="po">PO</SelectItem>
              <SelectItem value="tech_lead">Tech Lead</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={addMember} disabled={!selectedMemberId || addingMember}>
            {addingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onAddCollaborator}>
          <Plus className="h-4 w-4 mr-2" /> Novo Colaborador
        </Button>
        <Button variant="destructive" size="icon" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Production() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<number | null>(null);
  const [selectedSprint, setSelectedSprint] = useState<number | null>(null);
  const [kanbanProjectFilter, setKanbanProjectFilter] = useState<number | null>(null);
  const [kanbanSprintFilter, setKanbanSprintFilter] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("projects");
  const [viewMode, setViewMode] = useState<"project" | "general">("project");
  
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newSquadOpen, setNewSquadOpen] = useState(false);
  const [newSprintOpen, setNewSprintOpen] = useState(false);
  const [newWorkItemOpen, setNewWorkItemOpen] = useState(false);
  const [newCollaboratorOpen, setNewCollaboratorOpen] = useState(false);
  const [squadDetailOpen, setSquadDetailOpen] = useState(false);
  const [selectedSquadForEdit, setSelectedSquadForEdit] = useState<Squad | null>(null);
  const [workItemDetailOpen, setWorkItemDetailOpen] = useState(false);
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMember, setNewMember] = useState<{ type: "internal" | "external"; userId?: string; collaboratorId?: number; role: "product_owner" | "tech_lead" | "member" }>({ type: "internal", role: "member" });
  
  // Timesheet filters
  const [timesheetFilters, setTimesheetFilters] = useState({
    startDate: "",
    endDate: "",
    status: "all",
    userId: "all",
  });

  // Backlog filters
  const [backlogFilters, setBacklogFilters] = useState({
    search: "",
    type: "all",
    priority: "all",
  });
  const [moveToSprintDialog, setMoveToSprintDialog] = useState<{ open: boolean; itemId: number | null }>({ open: false, itemId: null });
  const [selectedSprintForMove, setSelectedSprintForMove] = useState<number | null>(null);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/production/projects"],
    queryFn: async () => {
      const res = await fetch("/api/production/projects", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: compassProjects = [] } = useQuery<any[]>({
    queryKey: ["/api/compass/projects"],
    queryFn: async () => {
      const res = await fetch("/api/compass/projects", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: crmClients = [] } = useQuery<any[]>({
    queryKey: ["/api/crm/clients"],
    queryFn: async () => {
      const res = await fetch("/api/crm/clients", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: squads = [] } = useQuery<Squad[]>({
    queryKey: ["/api/production/squads"],
    queryFn: async () => {
      const res = await fetch("/api/production/squads", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: collaborators = [] } = useQuery<Collaborator[]>({
    queryKey: ["/api/production/collaborators"],
    queryFn: async () => {
      const res = await fetch("/api/production/collaborators", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: sprints = [] } = useQuery<Sprint[]>({
    queryKey: ["/api/production/sprints", viewMode === "project" ? selectedProject?.id : "all"],
    queryFn: async () => {
      let url = "/api/production/sprints";
      if (viewMode === "project" && selectedProject?.id) url += `?projectId=${selectedProject.id}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: workItems = [] } = useQuery<WorkItem[]>({
    queryKey: ["/api/production/work-items", viewMode === "project" ? selectedProject?.id : "all", viewMode === "project" ? selectedSprint : null],
    queryFn: async () => {
      let url = "/api/production/work-items";
      const params = new URLSearchParams();
      if (viewMode === "project") {
        if (selectedProject?.id) params.append("projectId", selectedProject.id.toString());
        if (selectedSprint) params.append("sprintId", selectedSprint.toString());
      }
      if (params.toString()) url += "?" + params.toString();
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allSprintItems = [] } = useQuery<WorkItem[]>({
    queryKey: ["/api/production/work-items", "all-sprints"],
    queryFn: async () => {
      const res = await fetch("/api/production/work-items", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: viewMode === "general" && activeTab === "sprints",
  });

  const { data: myTasks = [] } = useQuery<WorkItem[]>({
    queryKey: ["/api/production/my-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/production/my-tasks", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: timesheets = [] } = useQuery<Timesheet[]>({
    queryKey: ["/api/production/timesheets", selectedProject?.id],
    queryFn: async () => {
      let url = "/api/production/timesheets";
      if (selectedProject?.id) url += `?projectId=${selectedProject.id}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: projectMembers = [], refetch: refetchProjectMembers } = useQuery<ProjectMember[]>({
    queryKey: ["/api/production/projects", selectedProject?.id, "members"],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const res = await fetch(`/api/production/projects/${selectedProject.id}/members`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedProject?.id && activeTab === "squad",
  });

  const { data: externalCollaborators = [] } = useQuery<ExternalCollaborator[]>({
    queryKey: ["/api/production/external-collaborators"],
    queryFn: async () => {
      const res = await fetch("/api/production/external-collaborators", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "squad",
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: Partial<Project>) => {
      const res = await fetch("/api/production/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/projects"] });
      setNewProjectOpen(false);
      setNewProject({ name: "", description: "", type: "internal", clientId: 0, compassProjectId: 0 });
      toast({ title: "Projeto criado com sucesso" });
    },
    onError: (error) => {
      console.error("Error creating project:", error);
      toast({ title: "Erro ao criar projeto", variant: "destructive" });
    },
  });

  const createSquadMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetch("/api/production/squads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create squad");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/squads"] });
      setNewSquadOpen(false);
      toast({ title: "Squad criado com sucesso" });
    },
  });

  const createCollaboratorMutation = useMutation({
    mutationFn: async (data: { name: string; username: string; email?: string; phone?: string; collaboratorType: string; hourlyRate?: string; password?: string }) => {
      const res = await fetch("/api/production/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create collaborator");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/collaborators"] });
      setNewCollaboratorOpen(false);
      toast({ title: "Colaborador criado com sucesso" });
    },
  });

  const addProjectMemberMutation = useMutation({
    mutationFn: async (data: { userId?: string; collaboratorId?: number; role: string }) => {
      if (!selectedProject?.id) throw new Error("No project selected");
      const res = await fetch(`/api/production/projects/${selectedProject.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/projects", selectedProject?.id, "members"] });
      toast({ title: "Membro adicionado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar membro", variant: "destructive" });
    },
  });

  const removeProjectMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      if (!selectedProject?.id) throw new Error("No project selected");
      const res = await fetch(`/api/production/projects/${selectedProject.id}/members/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/projects", selectedProject?.id, "members"] });
      toast({ title: "Membro removido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao remover membro", variant: "destructive" });
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: number; role: string }) => {
      if (!selectedProject?.id) throw new Error("No project selected");
      const res = await fetch(`/api/production/projects/${selectedProject.id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/projects", selectedProject?.id, "members"] });
      toast({ title: "Papel atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar papel", variant: "destructive" });
    },
  });

  const createSprintMutation = useMutation({
    mutationFn: async (data: Partial<Sprint>) => {
      const payload = {
        ...data,
        projectId: selectedProject?.id,
        startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
      };
      const res = await fetch("/api/production/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create sprint");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/sprints"] });
      setNewSprintOpen(false);
      toast({ title: "Sprint criada com sucesso" });
    },
  });

  const createWorkItemMutation = useMutation({
    mutationFn: async (data: Partial<WorkItem>) => {
      const payload = {
        ...data,
        projectId: selectedProject?.id,
        estimatedHours: data.estimatedHours?.toString(),
        hourlyRate: data.hourlyRate?.toString(),
        totalCost: data.totalCost?.toString(),
      };
      const res = await fetch("/api/production/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create work item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/work-items"] });
      setNewWorkItemOpen(false);
      toast({ title: "Item criado com sucesso" });
    },
  });

  const updateWorkItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<WorkItem> }) => {
      const res = await fetch(`/api/production/work-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update work item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/work-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production/my-tasks"] });
    },
  });

  const logTimeMutation = useMutation({
    mutationFn: async (data: Partial<Timesheet>) => {
      const res = await fetch("/api/production/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, projectId: selectedProject?.id, date: new Date().toISOString() }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to log time");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production/work-items"] });
      toast({ title: "Tempo registrado" });
    },
  });

  const startTimerMutation = useMutation({
    mutationFn: async (data: { workItemId: number; hourlyRate: number; description?: string }) => {
      const res = await fetch("/api/production/timesheets/timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, projectId: selectedProject?.id }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to start timer");
      return res.json();
    },
    onSuccess: (entry) => {
      const startedAt = new Date(entry.timerStartedAt);
      setActiveTimer({ entryId: entry.id, workItemId: entry.workItemId, startedAt, elapsed: 0 });
      const interval = setInterval(() => {
        setActiveTimer(prev => prev ? { ...prev, elapsed: Math.floor((Date.now() - startedAt.getTime()) / 1000) } : null);
      }, 1000);
      setTimerInterval(interval);
      queryClient.invalidateQueries({ queryKey: ["/api/production/timesheets"] });
      toast({ title: "Timer iniciado" });
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const res = await fetch(`/api/production/timesheets/timer/stop/${entryId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to stop timer");
      return res.json();
    },
    onSuccess: () => {
      if (timerInterval) clearInterval(timerInterval);
      setTimerInterval(null);
      setActiveTimer(null);
      queryClient.invalidateQueries({ queryKey: ["/api/production/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production/work-items"] });
      toast({ title: "Timer parado e horas registradas" });
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const res = await fetch(`/api/production/timesheets/${entryId}/submit`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to submit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/timesheets"] });
      toast({ title: "Enviado para aprovação" });
    },
  });

  const approveTimesheetMutation = useMutation({
    mutationFn: async ({ entryId, action }: { entryId: number; action: "approve" | "reject" }) => {
      const res = await fetch(`/api/production/timesheets/${entryId}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to ${action}`);
      return res.json();
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/production/timesheets"] });
      toast({ title: action === "approve" ? "Horas aprovadas" : "Horas rejeitadas" });
    },
  });

  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    backlog: { label: "Backlog", color: "text-slate-600", bgColor: "bg-slate-100" },
    todo: { label: "A Fazer", color: "text-blue-600", bgColor: "bg-blue-100" },
    in_progress: { label: "Em Execução", color: "text-yellow-600", bgColor: "bg-yellow-100" },
    review: { label: "Revisão", color: "text-orange-600", bgColor: "bg-orange-100" },
    testing: { label: "Teste", color: "text-purple-600", bgColor: "bg-purple-100" },
    done: { label: "Finalizado", color: "text-green-600", bgColor: "bg-green-100" },
  };

  const typeIcons: Record<string, React.ReactNode> = {
    epic: <Target className="h-4 w-4 text-purple-600" />,
    story: <Layers className="h-4 w-4 text-blue-500" />,
    task: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    bug: <AlertCircle className="h-4 w-4 text-red-500" />,
    requirement: <FileText className="h-4 w-4 text-orange-500" />,
  };

  const priorityConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    low: { label: "Baixa", color: "border-l-green-400", icon: <Flag className="h-3 w-3 text-green-500" /> },
    medium: { label: "Média", color: "border-l-yellow-400", icon: <Flag className="h-3 w-3 text-yellow-500" /> },
    high: { label: "Alta", color: "border-l-orange-400", icon: <Flag className="h-3 w-3 text-orange-500" /> },
    critical: { label: "Crítica", color: "border-l-red-500", icon: <Flag className="h-3 w-3 text-red-500" /> },
  };

  const groupedWorkItems = useMemo(() => ({
    backlog: workItems.filter((w) => w.status === "backlog"),
    todo: workItems.filter((w) => w.status === "todo"),
    in_progress: workItems.filter((w) => w.status === "in_progress"),
    review: workItems.filter((w) => w.status === "review"),
    testing: workItems.filter((w) => w.status === "testing"),
    done: workItems.filter((w) => w.status === "done"),
  }), [workItems]);

  // Filtered backlog items
  const filteredBacklogItems = useMemo(() => {
    return groupedWorkItems.backlog.filter((item) => {
      if (backlogFilters.search && !item.title.toLowerCase().includes(backlogFilters.search.toLowerCase())) return false;
      if (backlogFilters.type !== "all" && item.type !== backlogFilters.type) return false;
      if (backlogFilters.priority !== "all" && item.priority !== backlogFilters.priority) return false;
      return true;
    });
  }, [groupedWorkItems.backlog, backlogFilters]);

  const { data: allKanbanItems = [] } = useQuery<WorkItem[]>({
    queryKey: ["/api/production/work-items", "kanban"],
    queryFn: async () => {
      const res = await fetch("/api/production/work-items", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "kanban",
  });

  const { data: allSprints = [] } = useQuery<Sprint[]>({
    queryKey: ["/api/production/sprints", "all"],
    queryFn: async () => {
      const res = await fetch("/api/production/sprints", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const kanbanFilteredItems = useMemo(() => {
    let items = allKanbanItems;
    if (kanbanProjectFilter) {
      items = items.filter(w => w.projectId === kanbanProjectFilter);
    }
    if (kanbanSprintFilter) {
      items = items.filter(w => w.sprintId === kanbanSprintFilter);
    }
    return items;
  }, [allKanbanItems, kanbanProjectFilter, kanbanSprintFilter]);

  const kanbanGroupedItems = useMemo(() => ({
    backlog: kanbanFilteredItems.filter((w) => w.status === "backlog"),
    todo: kanbanFilteredItems.filter((w) => w.status === "todo"),
    in_progress: kanbanFilteredItems.filter((w) => w.status === "in_progress"),
    review: kanbanFilteredItems.filter((w) => w.status === "review"),
    testing: kanbanFilteredItems.filter((w) => w.status === "testing"),
    done: kanbanFilteredItems.filter((w) => w.status === "done"),
  }), [kanbanFilteredItems]);

  const projectStats = useMemo(() => {
    const totalPoints = workItems.reduce((sum, w) => sum + (w.storyPoints || 0), 0);
    const completedPoints = workItems.filter(w => w.status === "done").reduce((sum, w) => sum + (w.storyPoints || 0), 0);
    const totalHours = workItems.reduce((sum, w) => sum + (w.actualHours || 0), 0);
    const totalCost = workItems.reduce((sum, w) => sum + (w.totalCost || 0), 0);
    return { totalPoints, completedPoints, totalHours, totalCost };
  }, [workItems]);

  // Filtered timesheets
  const filteredTimesheets = useMemo(() => {
    return timesheets.filter((entry) => {
      if (timesheetFilters.status !== "all" && entry.status !== timesheetFilters.status) return false;
      if (timesheetFilters.userId !== "all" && entry.userId !== timesheetFilters.userId) return false;
      if (timesheetFilters.startDate && entry.date < timesheetFilters.startDate) return false;
      if (timesheetFilters.endDate && entry.date > timesheetFilters.endDate) return false;
      return true;
    });
  }, [timesheets, timesheetFilters]);

  // Timesheet summary stats
  const timesheetStats = useMemo(() => {
    const totalHours = filteredTimesheets.reduce((sum, e) => sum + parseFloat(String(e.hours || 0)), 0);
    const approvedHours = filteredTimesheets.filter(e => e.status === "approved").reduce((sum, e) => sum + parseFloat(String(e.hours || 0)), 0);
    const pendingHours = filteredTimesheets.filter(e => e.status === "pending").reduce((sum, e) => sum + parseFloat(String(e.hours || 0)), 0);
    const draftHours = filteredTimesheets.filter(e => e.status === "draft").reduce((sum, e) => sum + parseFloat(String(e.hours || 0)), 0);
    const totalCost = filteredTimesheets.reduce((sum, e) => sum + parseFloat(String(e.totalCost || 0)), 0);
    const approvedCost = filteredTimesheets.filter(e => e.status === "approved").reduce((sum, e) => sum + parseFloat(String(e.totalCost || 0)), 0);
    return { totalHours, approvedHours, pendingHours, draftHours, totalCost, approvedCost };
  }, [filteredTimesheets]);

  // Unique users from timesheets for filter
  const timesheetUsers = useMemo(() => {
    const users = new Map<string, string>();
    timesheets.forEach((e) => {
      if (e.userId && e.userName) users.set(e.userId, e.userName);
    });
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
  }, [timesheets]);

  const [newProject, setNewProject] = useState({ name: "", description: "", type: "internal" as "internal" | "external" | "compass", clientId: 0, compassProjectId: 0 });
  const [newSquad, setNewSquad] = useState({ name: "", description: "" });
  const [newCollaborator, setNewCollaborator] = useState({ name: "", username: "", email: "", phone: "", collaboratorType: "programador", hourlyRate: "", password: "" });
  const [newSprint, setNewSprint] = useState({ name: "", goal: "", startDate: "", endDate: "" });
  const [newWorkItem, setNewWorkItem] = useState({ 
    title: "", description: "", type: "task", priority: "medium", 
    storyPoints: 0, effortScore: 5, estimatedHours: 0, hourlyRate: 0 
  });
  const [newTimeEntry, setNewTimeEntry] = useState({ workItemId: 0, hours: 0, description: "", hourlyRate: 0 });
  const [activeTimer, setActiveTimer] = useState<{ entryId: number; workItemId: number; startedAt: Date; elapsed: number } | null>(null);
  const [timerInterval, setTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [draggedItem, setDraggedItem] = useState<WorkItem | null>(null);

  const handleAiAssist = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    setAiResponse("");
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Você é um assistente de gestão de projetos Scrum. Ajude com a seguinte tarefa: ${aiPrompt}. Contexto: ${selectedWorkItem ? `Tarefa: ${selectedWorkItem.title} - ${selectedWorkItem.description}` : "Projeto de desenvolvimento"}`,
          conversationHistory: []
        }),
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok && data.response) {
        setAiResponse(data.response);
      } else if (data.message) {
        setAiResponse(data.message);
      } else if (data.error) {
        setAiResponse(`Erro: ${data.error}`);
      } else {
        setAiResponse("Não foi possível gerar uma resposta.");
      }
    } catch (error) {
      console.error("AI assist error:", error);
      setAiResponse("Erro ao consultar o agente de IA.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <BrowserFrame>
      <div className="flex h-full bg-slate-50">
        <aside className="w-72 border-r bg-white flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-production-title">
              <FolderKanban className="h-5 w-5 text-primary" />
              Produção
            </h2>
            <p className="text-xs text-slate-500 mt-1">Gestão de Projetos Scrum</p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase">Projetos</span>
                  <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" data-testid="button-new-project">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Projeto</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Tipo de Projeto</Label>
                          <Select value={newProject.type} onValueChange={(v: "internal" | "external" | "compass") => setNewProject({ ...newProject, type: v })}>
                            <SelectTrigger data-testid="select-project-type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="internal">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4" /> Interno
                                </div>
                              </SelectItem>
                              <SelectItem value="external">
                                <div className="flex items-center gap-2">
                                  <Briefcase className="h-4 w-4" /> Externo (Cliente)
                                </div>
                              </SelectItem>
                              <SelectItem value="compass">
                                <div className="flex items-center gap-2">
                                  <Layers className="h-4 w-4" /> Process Compass
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {newProject.type === "compass" && (
                          <div>
                            <Label>Projeto do Process Compass</Label>
                            <Select value={String(newProject.compassProjectId)} onValueChange={(v) => {
                              const proj = compassProjects.find(p => p.id === Number(v));
                              setNewProject({ 
                                ...newProject, 
                                compassProjectId: Number(v),
                                name: proj?.name || "",
                                clientId: proj?.clientId || 0
                              });
                            }}>
                              <SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
                              <SelectContent>
                                {compassProjects.filter(p => p.projectType === "programacao").map((p) => (
                                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {newProject.type === "external" && (
                          <div>
                            <Label>Cliente (CRM)</Label>
                            <Select value={newProject.clientId ? String(newProject.clientId) : ""} onValueChange={(v) => setNewProject({ ...newProject, clientId: Number(v) })}>
                              <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                              <SelectContent>
                                {crmClients.map((c: any) => (
                                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div>
                          <Label>Nome do Projeto</Label>
                          <Input 
                            value={newProject.name} 
                            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} 
                            placeholder="Ex: Arcadia Suite, Sistema ERP..."
                            data-testid="input-project-name" 
                          />
                        </div>
                        <div>
                          <Label>Descrição</Label>
                          <Textarea 
                            value={newProject.description} 
                            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} 
                            data-testid="input-project-description" 
                          />
                        </div>
                        <Button 
                          onClick={() => createProjectMutation.mutate(newProject)} 
                          className="w-full" 
                          disabled={!newProject.name}
                          data-testid="button-save-project"
                        >
                          Criar Projeto
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-1">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => { setSelectedProject(project); setActiveTab("dashboard"); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${selectedProject?.id === project.id ? "bg-primary text-primary-foreground" : "hover:bg-slate-100"}`}
                      data-testid={`project-${project.id}`}
                    >
                      {project.type === "internal" && <Building2 className="h-4 w-4 flex-shrink-0" />}
                      {project.type === "external" && <Briefcase className="h-4 w-4 flex-shrink-0" />}
                      {project.type === "compass" && <Layers className="h-4 w-4 flex-shrink-0" />}
                      <span className="truncate">{project.name}</span>
                    </button>
                  ))}
                  {projects.length === 0 && <p className="text-xs text-slate-400 text-center py-2">Nenhum projeto</p>}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase">Squads</span>
                  <Dialog open={newSquadOpen} onOpenChange={setNewSquadOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" data-testid="button-new-squad">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Squad</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nome</Label>
                          <Input value={newSquad.name} onChange={(e) => setNewSquad({ ...newSquad, name: e.target.value })} data-testid="input-squad-name" />
                        </div>
                        <div>
                          <Label>Descrição</Label>
                          <Textarea value={newSquad.description} onChange={(e) => setNewSquad({ ...newSquad, description: e.target.value })} data-testid="input-squad-description" />
                        </div>
                        <Button onClick={() => createSquadMutation.mutate(newSquad)} className="w-full" data-testid="button-save-squad">
                          Criar Squad
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="space-y-1">
                  {squads.map((squad) => (
                    <div
                      key={squad.id}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${selectedSquad === squad.id ? "bg-slate-200" : "hover:bg-slate-100"}`}
                      data-testid={`squad-${squad.id}`}
                    >
                      <button
                        onClick={() => setSelectedSquad(squad.id === selectedSquad ? null : squad.id)}
                        className="flex items-center gap-2 flex-1"
                      >
                        <Users className="h-4 w-4" />
                        {squad.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => { setSelectedSquadForEdit(squad); setSquadDetailOpen(true); }}
                        data-testid={`squad-edit-${squad.id}`}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase">Colaboradores</span>
                  <Dialog open={newCollaboratorOpen} onOpenChange={setNewCollaboratorOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" data-testid="button-new-collaborator">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Colaborador</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nome</Label>
                          <Input value={newCollaborator.name} onChange={(e) => setNewCollaborator({ ...newCollaborator, name: e.target.value })} data-testid="input-collaborator-name" />
                        </div>
                        <div>
                          <Label>Usuário (login)</Label>
                          <Input value={newCollaborator.username} onChange={(e) => setNewCollaborator({ ...newCollaborator, username: e.target.value })} data-testid="input-collaborator-username" />
                        </div>
                        <div>
                          <Label>Tipo</Label>
                          <Select value={newCollaborator.collaboratorType} onValueChange={(v) => setNewCollaborator({ ...newCollaborator, collaboratorType: v })}>
                            <SelectTrigger data-testid="select-collaborator-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tec.terceiro">Tec. Terceiro</SelectItem>
                              <SelectItem value="programador">Programador</SelectItem>
                              <SelectItem value="consultor">Consultor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Email</Label>
                            <Input value={newCollaborator.email} onChange={(e) => setNewCollaborator({ ...newCollaborator, email: e.target.value })} data-testid="input-collaborator-email" />
                          </div>
                          <div>
                            <Label>Telefone</Label>
                            <Input value={newCollaborator.phone} onChange={(e) => setNewCollaborator({ ...newCollaborator, phone: e.target.value })} data-testid="input-collaborator-phone" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Valor/Hora (R$)</Label>
                            <Input type="number" value={newCollaborator.hourlyRate} onChange={(e) => setNewCollaborator({ ...newCollaborator, hourlyRate: e.target.value })} data-testid="input-collaborator-rate" />
                          </div>
                          <div>
                            <Label>Senha</Label>
                            <Input type="password" value={newCollaborator.password} onChange={(e) => setNewCollaborator({ ...newCollaborator, password: e.target.value })} placeholder="Senha inicial" data-testid="input-collaborator-password" />
                          </div>
                        </div>
                        <Button 
                          onClick={() => createCollaboratorMutation.mutate(newCollaborator)} 
                          className="w-full" 
                          disabled={!newCollaborator.name || !newCollaborator.username}
                          data-testid="button-save-collaborator"
                        >
                          Criar Colaborador
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="space-y-1">
                  {collaborators.map((collab) => (
                    <div
                      key={collab.id}
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-slate-100 flex items-center justify-between"
                      data-testid={`collaborator-${collab.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{collab.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {collab.collaboratorType === "tec.terceiro" ? "Terceiro" : collab.collaboratorType === "programador" ? "Dev" : "Consultor"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 overflow-hidden flex flex-col">
          {selectedProject ? (
            <>
              <div className="border-b bg-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {selectedProject.type === "internal" && <Building2 className="h-5 w-5 text-blue-500" />}
                      {selectedProject.type === "external" && <Briefcase className="h-5 w-5 text-green-500" />}
                      {selectedProject.type === "compass" && <Layers className="h-5 w-5 text-purple-500" />}
                      <h1 className="text-xl font-semibold">{selectedProject.name}</h1>
                      <Badge variant="outline" className="text-xs">
                        {selectedProject.type === "internal" ? "Interno" : selectedProject.type === "external" ? "Externo" : "Process Compass"}
                      </Badge>
                    </div>
                    {selectedProject.clientName && (
                      <p className="text-sm text-slate-500 mt-1">Cliente: {selectedProject.clientName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{projectStats.completedPoints}</p>
                      <p className="text-xs text-slate-500">de {projectStats.totalPoints} pts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-500">{projectStats.totalHours.toFixed(1)}h</p>
                      <p className="text-xs text-slate-500">trabalhadas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">R$ {projectStats.totalCost.toFixed(0)}</p>
                      <p className="text-xs text-slate-500">custo total</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                    <TabsList>
                      <TabsTrigger value="dashboard" data-testid="tab-dashboard">
                        <BarChart3 className="h-4 w-4 mr-1" /> Dashboard
                      </TabsTrigger>
                      <TabsTrigger value="backlog" data-testid="tab-backlog">
                        <Layers className="h-4 w-4 mr-1" /> Backlog
                      </TabsTrigger>
                      <TabsTrigger value="sprints" data-testid="tab-sprints">
                        <Zap className="h-4 w-4 mr-1" /> Sprints
                      </TabsTrigger>
                      <TabsTrigger value="kanban" data-testid="tab-kanban">
                        <FolderKanban className="h-4 w-4 mr-1" /> Kanban
                      </TabsTrigger>
                      <TabsTrigger value="timesheet" data-testid="tab-timesheet">
                        <Clock className="h-4 w-4 mr-1" /> Timesheet
                      </TabsTrigger>
                      <TabsTrigger value="costs" data-testid="tab-costs">
                        <DollarSign className="h-4 w-4 mr-1" /> Custos
                      </TabsTrigger>
                      <TabsTrigger value="squad" data-testid="tab-squad">
                        <Users className="h-4 w-4 mr-1" /> Squad
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <Dialog open={newWorkItemOpen} onOpenChange={setNewWorkItemOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-new-work-item">
                        <Plus className="h-4 w-4 mr-1" /> Nova História/Tarefa
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Novo Item de Trabalho</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Título</Label>
                          <Input value={newWorkItem.title} onChange={(e) => setNewWorkItem({ ...newWorkItem, title: e.target.value })} data-testid="input-workitem-title" />
                        </div>
                        <div>
                          <Label>Descrição</Label>
                          <Textarea value={newWorkItem.description} onChange={(e) => setNewWorkItem({ ...newWorkItem, description: e.target.value })} rows={3} data-testid="input-workitem-description" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Tipo</Label>
                            <Select value={newWorkItem.type} onValueChange={(v) => setNewWorkItem({ ...newWorkItem, type: v })}>
                              <SelectTrigger data-testid="select-workitem-type"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="epic">Épico</SelectItem>
                                <SelectItem value="story">História</SelectItem>
                                <SelectItem value="task">Tarefa</SelectItem>
                                <SelectItem value="bug">Bug</SelectItem>
                                <SelectItem value="requirement">Requisito</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Prioridade</Label>
                            <Select value={newWorkItem.priority} onValueChange={(v) => setNewWorkItem({ ...newWorkItem, priority: v })}>
                              <SelectTrigger data-testid="select-workitem-priority"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Baixa</SelectItem>
                                <SelectItem value="medium">Média</SelectItem>
                                <SelectItem value="high">Alta</SelectItem>
                                <SelectItem value="critical">Crítica</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Story Points</Label>
                            <Select value={String(newWorkItem.storyPoints)} onValueChange={(v) => setNewWorkItem({ ...newWorkItem, storyPoints: Number(v) })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 5, 8, 13, 21].map(p => (
                                  <SelectItem key={p} value={String(p)}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Esforço (1-10)</Label>
                            <Select value={String(newWorkItem.effortScore)} onValueChange={(v) => setNewWorkItem({ ...newWorkItem, effortScore: Number(v) })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(e => (
                                  <SelectItem key={e} value={String(e)}>{e}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Horas Estimadas</Label>
                            <Input 
                              type="number" 
                              value={newWorkItem.estimatedHours} 
                              onChange={(e) => setNewWorkItem({ ...newWorkItem, estimatedHours: Number(e.target.value) })} 
                            />
                          </div>
                          <div>
                            <Label>Custo/Hora (R$)</Label>
                            <Input 
                              type="number" 
                              value={newWorkItem.hourlyRate} 
                              onChange={(e) => setNewWorkItem({ ...newWorkItem, hourlyRate: Number(e.target.value) })} 
                            />
                          </div>
                        </div>
                        <Button 
                          onClick={() => createWorkItemMutation.mutate({ ...newWorkItem, status: "backlog" })} 
                          className="w-full"
                          disabled={!newWorkItem.title}
                          data-testid="button-save-workitem"
                        >
                          Criar Item
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" size="sm" onClick={() => setAiAssistOpen(true)}>
                    <Bot className="h-4 w-4 mr-1" /> Agente IA
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {activeTab === "dashboard" && (
                  <div className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Dashboard do Projeto</h2>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <Card className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Layers className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{workItems.length}</p>
                            <p className="text-xs text-slate-500">Itens Totais</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{groupedWorkItems.done.length}</p>
                            <p className="text-xs text-slate-500">Concluídos</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-yellow-100 rounded-lg">
                            <Play className="h-5 w-5 text-yellow-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{groupedWorkItems.in_progress.length}</p>
                            <p className="text-xs text-slate-500">Em Andamento</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <Layers className="h-5 w-5 text-slate-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{groupedWorkItems.backlog.length}</p>
                            <p className="text-xs text-slate-500">No Backlog</p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      <Card className="p-4">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Star className="h-5 w-5 text-yellow-500" /> Story Points
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Total de Pontos</span>
                            <span className="font-bold text-lg">{projectStats.totalPoints}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Pontos Concluídos</span>
                            <span className="font-bold text-lg text-green-600">{projectStats.completedPoints}</span>
                          </div>
                          <Progress value={projectStats.totalPoints > 0 ? (projectStats.completedPoints / projectStats.totalPoints) * 100 : 0} className="h-2" />
                          <p className="text-xs text-slate-500 text-center">
                            {projectStats.totalPoints > 0 ? Math.round((projectStats.completedPoints / projectStats.totalPoints) * 100) : 0}% concluído
                          </p>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Clock className="h-5 w-5 text-orange-500" /> Horas & Custos
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Horas Trabalhadas</span>
                            <span className="font-bold text-lg">{projectStats.totalHours.toFixed(1)}h</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Custo Total</span>
                            <span className="font-bold text-lg text-green-600">R$ {projectStats.totalCost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Horas Aprovadas</span>
                            <span className="font-bold text-lg text-blue-600">{timesheetStats.approvedHours.toFixed(1)}h</span>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <Card className="p-4">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-purple-500" /> Distribuição por Status
                        </h3>
                        <div className="space-y-2">
                          {Object.entries(statusConfig).map(([status, config]) => {
                            const count = groupedWorkItems[status as keyof typeof groupedWorkItems]?.length || 0;
                            const percentage = workItems.length > 0 ? (count / workItems.length) * 100 : 0;
                            return (
                              <div key={status} className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${config.bgColor}`} />
                                <span className="text-sm flex-1">{config.label}</span>
                                <span className="text-sm font-medium">{count}</span>
                                <div className="w-20">
                                  <Progress value={percentage} className="h-2" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>

                      <Card className="p-4">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Flag className="h-5 w-5 text-red-500" /> Prioridades
                        </h3>
                        <div className="space-y-2">
                          {Object.entries(priorityConfig).map(([priority, config]) => {
                            const count = workItems.filter(w => w.priority === priority).length;
                            return (
                              <div key={priority} className="flex items-center gap-3">
                                {config.icon}
                                <span className="text-sm flex-1">{config.label}</span>
                                <Badge variant="outline">{count}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>

                    {sprints.filter(s => s.status === "active").length > 0 && (
                      <Card className="p-4 mt-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Zap className="h-5 w-5 text-yellow-500" /> Sprint Ativa
                        </h3>
                        {sprints.filter(s => s.status === "active").map((sprint) => {
                          const sprintItems = workItems.filter(w => w.sprintId === sprint.id);
                          const sprintDone = sprintItems.filter(w => w.status === "done").length;
                          const sprintProgress = sprintItems.length > 0 ? (sprintDone / sprintItems.length) * 100 : 0;
                          return (
                            <div key={sprint.id} className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="font-medium">{sprint.name}</span>
                                <Badge variant="outline" className="bg-green-100 text-green-700">Ativa</Badge>
                              </div>
                              {sprint.goal && <p className="text-sm text-slate-600">{sprint.goal}</p>}
                              <div className="flex gap-4 text-sm text-slate-500">
                                {sprint.startDate && <span>Início: {new Date(sprint.startDate).toLocaleDateString('pt-BR')}</span>}
                                {sprint.endDate && <span>Fim: {new Date(sprint.endDate).toLocaleDateString('pt-BR')}</span>}
                              </div>
                              <Progress value={sprintProgress} className="h-2" />
                              <div className="flex justify-between text-xs text-slate-500">
                                <span>{sprintDone} de {sprintItems.length} itens concluídos</span>
                                <span>{Math.round(sprintProgress)}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </Card>
                    )}
                  </div>
                )}

                {activeTab === "backlog" && (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold">
                          {viewMode === "general" ? "Backlog Geral" : "Product Backlog"}
                        </h2>
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
                          <span className={`text-xs ${viewMode === "project" ? "font-medium" : "text-slate-500"}`}>Projeto</span>
                          <Switch 
                            checked={viewMode === "general"}
                            onCheckedChange={(checked) => setViewMode(checked ? "general" : "project")}
                          />
                          <span className={`text-xs ${viewMode === "general" ? "font-medium" : "text-slate-500"}`}>Geral</span>
                        </div>
                      </div>
                      <Badge variant="outline">{filteredBacklogItems.length} de {groupedWorkItems.backlog.length} itens</Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1 min-w-48">
                        <Input
                          placeholder="Buscar no backlog..."
                          value={backlogFilters.search}
                          onChange={(e) => setBacklogFilters({ ...backlogFilters, search: e.target.value })}
                          className="h-8"
                          data-testid="input-backlog-search"
                        />
                      </div>
                      <Select value={backlogFilters.type} onValueChange={(v) => setBacklogFilters({ ...backlogFilters, type: v })}>
                        <SelectTrigger className="h-8 w-32" data-testid="select-backlog-type">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="epic">Epic</SelectItem>
                          <SelectItem value="story">Story</SelectItem>
                          <SelectItem value="task">Task</SelectItem>
                          <SelectItem value="bug">Bug</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={backlogFilters.priority} onValueChange={(v) => setBacklogFilters({ ...backlogFilters, priority: v })}>
                        <SelectTrigger className="h-8 w-32" data-testid="select-backlog-priority">
                          <SelectValue placeholder="Prioridade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="critical">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                      {(backlogFilters.search || backlogFilters.type !== "all" || backlogFilters.priority !== "all") && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8"
                          onClick={() => setBacklogFilters({ search: "", type: "all", priority: "all" })}
                          data-testid="button-clear-backlog-filters"
                        >
                          Limpar
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {filteredBacklogItems.map((item) => (
                        <Card 
                          key={item.id} 
                          className={`p-4 border-l-4 ${priorityConfig[item.priority]?.color || "border-l-slate-200"} hover:shadow-md transition-shadow cursor-pointer`}
                          onClick={() => { setSelectedWorkItem(item); setWorkItemDetailOpen(true); }}
                          data-testid={`backlog-item-${item.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <GripVertical className="h-5 w-5 text-slate-300 mt-0.5" />
                            {typeIcons[item.type]}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.title}</span>
                                {item.code && <Badge variant="outline" className="text-xs">{item.code}</Badge>}
                                <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
                              </div>
                              {item.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.description}</p>}
                              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                {item.storyPoints && <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {item.storyPoints} pts</span>}
                                {item.effortScore && <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Esforço: {item.effortScore}/10</span>}
                                {item.estimatedHours && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {item.estimatedHours}h</span>}
                                {priorityConfig[item.priority] && (
                                  <span className="flex items-center gap-1">
                                    {priorityConfig[item.priority].icon} {priorityConfig[item.priority].label}
                                  </span>
                                )}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setMoveToSprintDialog({ open: true, itemId: item.id }); }}>
                                  <ArrowRight className="h-4 w-4 mr-2" /> Mover para Sprint
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateWorkItemMutation.mutate({ id: item.id, data: { status: "todo" } }); }}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" /> Mover para A Fazer
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={(e) => e.stopPropagation()}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Card>
                      ))}
                      {filteredBacklogItems.length === 0 && groupedWorkItems.backlog.length > 0 && (
                        <Card className="p-8 text-center">
                          <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500">Nenhum item encontrado com os filtros atuais.</p>
                        </Card>
                      )}
                      {groupedWorkItems.backlog.length === 0 && (
                        <Card className="p-8 text-center">
                          <Layers className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500">Backlog vazio. Adicione histórias e tarefas.</p>
                        </Card>
                      )}
                    </div>

                    <Dialog open={moveToSprintDialog.open} onOpenChange={(open) => setMoveToSprintDialog({ open, itemId: open ? moveToSprintDialog.itemId : null })}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Mover para Sprint</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Selecione a Sprint</Label>
                            <Select value={selectedSprintForMove?.toString() || ""} onValueChange={(v) => setSelectedSprintForMove(parseInt(v))}>
                              <SelectTrigger data-testid="select-sprint-move">
                                <SelectValue placeholder="Escolha uma sprint..." />
                              </SelectTrigger>
                              <SelectContent>
                                {allSprints.filter(s => s.status !== "closed").map((sprint) => (
                                  <SelectItem key={sprint.id} value={sprint.id.toString()}>
                                    {sprint.name} {sprint.status === "active" ? "(Ativa)" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setMoveToSprintDialog({ open: false, itemId: null })}>
                              Cancelar
                            </Button>
                            <Button 
                              onClick={() => {
                                if (moveToSprintDialog.itemId && selectedSprintForMove) {
                                  updateWorkItemMutation.mutate({ 
                                    id: moveToSprintDialog.itemId, 
                                    data: { sprintId: selectedSprintForMove, status: "todo" } 
                                  });
                                  setMoveToSprintDialog({ open: false, itemId: null });
                                  setSelectedSprintForMove(null);
                                }
                              }}
                              disabled={!selectedSprintForMove}
                              data-testid="button-confirm-move-sprint"
                            >
                              Mover
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}

                {activeTab === "sprints" && (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold">
                          {viewMode === "general" ? "Sprints - Todos os Projetos" : "Sprints"}
                        </h2>
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
                          <span className={`text-xs ${viewMode === "project" ? "font-medium" : "text-slate-500"}`}>Projeto</span>
                          <Switch 
                            checked={viewMode === "general"}
                            onCheckedChange={(checked) => setViewMode(checked ? "general" : "project")}
                          />
                          <span className={`text-xs ${viewMode === "general" ? "font-medium" : "text-slate-500"}`}>Geral</span>
                        </div>
                      </div>
                      <Dialog open={newSprintOpen} onOpenChange={setNewSprintOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Sprint</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Nova Sprint</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Nome</Label>
                              <Input value={newSprint.name} onChange={(e) => setNewSprint({ ...newSprint, name: e.target.value })} placeholder="Sprint 1" />
                            </div>
                            <div>
                              <Label>Objetivo</Label>
                              <Textarea value={newSprint.goal} onChange={(e) => setNewSprint({ ...newSprint, goal: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>Início</Label>
                                <Input type="date" value={newSprint.startDate} onChange={(e) => setNewSprint({ ...newSprint, startDate: e.target.value })} />
                              </div>
                              <div>
                                <Label>Fim</Label>
                                <Input type="date" value={newSprint.endDate} onChange={(e) => setNewSprint({ ...newSprint, endDate: e.target.value })} />
                              </div>
                            </div>
                            <Button onClick={() => createSprintMutation.mutate(newSprint)} className="w-full">Criar Sprint</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    {viewMode === "general" ? (
                      <div className="space-y-6">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                          <h3 className="font-semibold text-blue-800 mb-2">Planejador de Sprints</h3>
                          <p className="text-sm text-blue-600">Visualize e gerencie sprints de todos os projetos. Arraste tarefas do backlog geral para planejar sua semana.</p>
                        </div>
                        <div className="grid gap-4">
                          {sprints.map((sprint) => {
                            const sprintItems = allSprintItems.filter(w => w.sprintId === sprint.id);
                            const totalPoints = sprintItems.reduce((sum, w) => sum + (w.storyPoints || 0), 0);
                            return (
                              <Card key={sprint.id} className="p-4 border-l-4 border-l-blue-500">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="font-semibold">{sprint.name}</h3>
                                      {sprint.projectName && (
                                        <Badge variant="outline" className="text-xs bg-slate-50">
                                          {sprint.projectName}
                                        </Badge>
                                      )}
                                      <Badge variant={sprint.status === "active" ? "default" : "secondary"}>
                                        {sprint.status === "active" ? "Ativa" : sprint.status === "planning" ? "Planejamento" : "Concluída"}
                                      </Badge>
                                    </div>
                                    {sprint.goal && <p className="text-sm text-slate-500 mt-1">{sprint.goal}</p>}
                                    {sprint.startDate && sprint.endDate && (
                                      <div className="mt-2 text-sm text-slate-500">
                                        <Calendar className="h-4 w-4 inline mr-1" />
                                        {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="text-2xl font-bold text-blue-600">{totalPoints}</p>
                                    <p className="text-xs text-slate-500">pontos planejados</p>
                                    <p className="text-xs text-slate-400 mt-1">{sprintItems.length} tarefas</p>
                                  </div>
                                </div>
                                {sprintItems.length > 0 && (
                                  <div className="mt-3 pt-3 border-t">
                                    <div className="flex flex-wrap gap-1">
                                      {sprintItems.slice(0, 5).map(item => (
                                        <Badge key={item.id} variant="secondary" className="text-xs">
                                          {item.title.substring(0, 20)}{item.title.length > 20 ? "..." : ""}
                                        </Badge>
                                      ))}
                                      {sprintItems.length > 5 && (
                                        <Badge variant="outline" className="text-xs">+{sprintItems.length - 5} mais</Badge>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                        {sprints.length === 0 && (
                          <Card className="p-8 text-center">
                            <Zap className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500">Nenhuma sprint encontrada em nenhum projeto</p>
                          </Card>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {sprints.map((sprint) => (
                          <Card key={sprint.id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{sprint.name}</h3>
                                  <Badge variant={sprint.status === "active" ? "default" : "secondary"}>
                                    {sprint.status === "active" ? "Ativa" : sprint.status === "planning" ? "Planejamento" : "Concluída"}
                                  </Badge>
                                </div>
                                {sprint.goal && <p className="text-sm text-slate-500 mt-1">{sprint.goal}</p>}
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold">{sprint.completedPoints || 0}</p>
                                <p className="text-xs text-slate-500">pontos</p>
                              </div>
                            </div>
                            {sprint.startDate && sprint.endDate && (
                              <div className="mt-3 text-sm text-slate-500">
                                <Calendar className="h-4 w-4 inline mr-1" />
                                {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                              </div>
                            )}
                          </Card>
                        ))}
                        {sprints.length === 0 && (
                          <Card className="p-8 text-center">
                            <Zap className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500">Nenhuma sprint criada</p>
                          </Card>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "kanban" && (
                  <div className="p-6 overflow-x-auto">
                    <div className="flex items-center gap-4 mb-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm whitespace-nowrap">Projeto:</Label>
                        <Select
                          value={kanbanProjectFilter?.toString() || "all"}
                          onValueChange={(val) => setKanbanProjectFilter(val === "all" ? null : Number(val))}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Todos os projetos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os projetos</SelectItem>
                            {projects.map(p => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm whitespace-nowrap">Sprint:</Label>
                        <Select
                          value={kanbanSprintFilter?.toString() || "all"}
                          onValueChange={(val) => setKanbanSprintFilter(val === "all" ? null : Number(val))}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Todas as sprints" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas as sprints</SelectItem>
                            {allSprints.map(s => (
                              <SelectItem key={s.id} value={s.id.toString()}>
                                {s.name} {s.projectName ? `(${s.projectName})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="ml-auto text-sm text-slate-500">
                        {kanbanFilteredItems.length} itens
                      </div>
                    </div>
                    <div className="flex gap-4 min-w-max">
                      {Object.entries(statusConfig).map(([status, config]) => (
                        <div key={status} className="w-72 flex-shrink-0">
                          <div 
                            className={`${config.bgColor} rounded-lg p-3 ${draggedItem ? "ring-2 ring-primary/20" : ""}`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add("ring-2", "ring-primary");
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove("ring-2", "ring-primary");
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove("ring-2", "ring-primary");
                              if (draggedItem && draggedItem.status !== status) {
                                updateWorkItemMutation.mutate({ id: draggedItem.id, data: { status } });
                              }
                              setDraggedItem(null);
                            }}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h3 className={`font-medium text-sm ${config.color}`}>{config.label}</h3>
                              <Badge variant="secondary" className="text-xs">
                                {kanbanGroupedItems[status as keyof typeof kanbanGroupedItems]?.length || 0}
                              </Badge>
                            </div>
                            <div className="space-y-2 min-h-[200px]">
                              {(kanbanGroupedItems[status as keyof typeof kanbanGroupedItems] || []).map((item) => (
                                <Card 
                                  key={item.id} 
                                  draggable
                                  onDragStart={() => setDraggedItem(item)}
                                  onDragEnd={() => setDraggedItem(null)}
                                  className={`p-3 border-l-4 ${priorityConfig[item.priority]?.color || "border-l-slate-200"} cursor-grab hover:shadow-md transition-shadow ${draggedItem?.id === item.id ? "opacity-50" : ""}`}
                                  onClick={() => { setSelectedWorkItem(item); setWorkItemDetailOpen(true); }}
                                  data-testid={`kanban-item-${item.id}`}
                                >
                                  <div className="flex items-start gap-2 mb-2">
                                    <GripVertical className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                    {typeIcons[item.type]}
                                    <span className="text-sm font-medium flex-1 line-clamp-2">{item.title}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    {item.storyPoints && <Badge variant="outline" className="text-xs">{item.storyPoints} pts</Badge>}
                                    {item.actualHours ? (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> {item.actualHours}h
                                      </span>
                                    ) : null}
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "timesheet" && (
                  <div className="p-6">
                    <div className="grid md:grid-cols-3 gap-6">
                      <Card className="md:col-span-1 p-4">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Timer className="h-5 w-5" /> {activeTimer ? "Timer Ativo" : "Registrar Tempo"}
                        </h3>
                        
                        {activeTimer ? (
                          <div className="space-y-4">
                            <div className="text-center py-6 bg-green-50 rounded-lg border-2 border-green-200">
                              <div className="text-4xl font-mono font-bold text-green-600">
                                {String(Math.floor(activeTimer.elapsed / 3600)).padStart(2, '0')}:
                                {String(Math.floor((activeTimer.elapsed % 3600) / 60)).padStart(2, '0')}:
                                {String(activeTimer.elapsed % 60).padStart(2, '0')}
                              </div>
                              <p className="text-sm text-green-600 mt-2">
                                {workItems.find(w => w.id === activeTimer.workItemId)?.title || "Item de trabalho"}
                              </p>
                            </div>
                            <Button 
                              onClick={() => stopTimerMutation.mutate(activeTimer.entryId)} 
                              className="w-full bg-red-500 hover:bg-red-600"
                              disabled={stopTimerMutation.isPending}
                              data-testid="button-stop-timer"
                            >
                              {stopTimerMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pause className="h-4 w-4 mr-2" />}
                              Parar Timer
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <Label>Item de Trabalho</Label>
                              <Select value={String(newTimeEntry.workItemId)} onValueChange={(v) => setNewTimeEntry({ ...newTimeEntry, workItemId: Number(v) })}>
                                <SelectTrigger data-testid="select-timer-workitem"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                  {workItems.filter(w => w.status !== "done").map(w => (
                                    <SelectItem key={w.id} value={String(w.id)}>{w.title}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Custo/Hora (R$)</Label>
                              <Input 
                                type="number" 
                                value={newTimeEntry.hourlyRate} 
                                onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hourlyRate: Number(e.target.value) })} 
                                data-testid="input-timer-hourlyrate"
                              />
                            </div>
                            <div>
                              <Label>Descrição</Label>
                              <Textarea 
                                value={newTimeEntry.description} 
                                onChange={(e) => setNewTimeEntry({ ...newTimeEntry, description: e.target.value })} 
                                rows={2}
                                data-testid="input-timer-description"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Button 
                                onClick={() => startTimerMutation.mutate({ 
                                  workItemId: newTimeEntry.workItemId, 
                                  hourlyRate: newTimeEntry.hourlyRate,
                                  description: newTimeEntry.description 
                                })} 
                                className="bg-green-500 hover:bg-green-600"
                                disabled={!newTimeEntry.workItemId || startTimerMutation.isPending}
                                data-testid="button-start-timer"
                              >
                                {startTimerMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                Timer
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => logTimeMutation.mutate({ 
                                  ...newTimeEntry, 
                                  totalCost: newTimeEntry.hours * newTimeEntry.hourlyRate 
                                })} 
                                disabled={!newTimeEntry.workItemId || !newTimeEntry.hours}
                                data-testid="button-manual-log"
                              >
                                <Clock className="h-4 w-4 mr-2" /> Manual
                              </Button>
                            </div>
                            <div>
                              <Label>Horas (registro manual)</Label>
                              <Input 
                                type="number" 
                                step="0.5"
                                value={newTimeEntry.hours} 
                                onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hours: Number(e.target.value) })} 
                                data-testid="input-manual-hours"
                              />
                            </div>
                          </div>
                        )}
                      </Card>

                      <Card className="md:col-span-2 p-4">
                        <div className="grid grid-cols-4 gap-3 mb-4">
                          <div className="p-3 bg-blue-50 rounded-lg text-center">
                            <p className="text-xl font-bold text-blue-600">{timesheetStats.totalHours.toFixed(1)}h</p>
                            <p className="text-xs text-blue-600">Total</p>
                          </div>
                          <div className="p-3 bg-green-50 rounded-lg text-center">
                            <p className="text-xl font-bold text-green-600">{timesheetStats.approvedHours.toFixed(1)}h</p>
                            <p className="text-xs text-green-600">Aprovadas</p>
                          </div>
                          <div className="p-3 bg-yellow-50 rounded-lg text-center">
                            <p className="text-xl font-bold text-yellow-600">{timesheetStats.pendingHours.toFixed(1)}h</p>
                            <p className="text-xs text-yellow-600">Pendentes</p>
                          </div>
                          <div className="p-3 bg-emerald-50 rounded-lg text-center">
                            <p className="text-xl font-bold text-emerald-600">R$ {timesheetStats.approvedCost.toFixed(0)}</p>
                            <p className="text-xs text-emerald-600">Custo Aprovado</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">Período:</Label>
                            <Input 
                              type="date" 
                              value={timesheetFilters.startDate} 
                              onChange={(e) => setTimesheetFilters({ ...timesheetFilters, startDate: e.target.value })}
                              className="h-8 w-36 text-xs"
                              data-testid="input-timesheet-start-date"
                            />
                            <span className="text-xs text-slate-500">até</span>
                            <Input 
                              type="date" 
                              value={timesheetFilters.endDate} 
                              onChange={(e) => setTimesheetFilters({ ...timesheetFilters, endDate: e.target.value })}
                              className="h-8 w-36 text-xs"
                              data-testid="input-timesheet-end-date"
                            />
                          </div>
                          <Select value={timesheetFilters.status} onValueChange={(v) => setTimesheetFilters({ ...timesheetFilters, status: v })}>
                            <SelectTrigger className="h-8 w-32 text-xs" data-testid="select-timesheet-status">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="draft">Rascunho</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="approved">Aprovado</SelectItem>
                              <SelectItem value="rejected">Rejeitado</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={timesheetFilters.userId} onValueChange={(v) => setTimesheetFilters({ ...timesheetFilters, userId: v })}>
                            <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-timesheet-user">
                              <SelectValue placeholder="Colaborador" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              {timesheetUsers.map((u) => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(timesheetFilters.startDate || timesheetFilters.endDate || timesheetFilters.status !== "all" || timesheetFilters.userId !== "all") && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-xs"
                              onClick={() => setTimesheetFilters({ startDate: "", endDate: "", status: "all", userId: "all" })}
                              data-testid="button-clear-timesheet-filters"
                            >
                              Limpar filtros
                            </Button>
                          )}
                        </div>

                        <h3 className="font-semibold mb-3 flex items-center justify-between">
                          <span>Registros ({filteredTimesheets.length})</span>
                        </h3>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {filteredTimesheets.map((entry) => {
                            const statusColors: Record<string, string> = {
                              draft: "bg-slate-100 text-slate-700",
                              pending: "bg-yellow-100 text-yellow-700",
                              approved: "bg-green-100 text-green-700",
                              rejected: "bg-red-100 text-red-700",
                            };
                            const statusLabels: Record<string, string> = {
                              draft: "Rascunho",
                              pending: "Pendente",
                              approved: "Aprovado",
                              rejected: "Rejeitado",
                            };
                            return (
                              <div key={entry.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg" data-testid={`timesheet-row-${entry.id}`}>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">{entry.workItemTitle || `Item #${entry.workItemId}`}</p>
                                    <Badge variant="outline" className={statusColors[entry.status || "draft"]}>
                                      {statusLabels[entry.status || "draft"]}
                                    </Badge>
                                    {entry.timerStartedAt && (
                                      <Badge className="bg-green-500 animate-pulse">
                                        <Timer className="h-3 w-3 mr-1" /> Em andamento
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {entry.date && <span className="font-medium">{new Date(entry.date).toLocaleDateString('pt-BR')}</span>}
                                    {entry.description && <span className="ml-2">• {entry.description}</span>}
                                    {entry.userName && <span className="ml-2">• {entry.userName}</span>}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="font-semibold">{parseFloat(String(entry.hours)).toFixed(2)}h</p>
                                    {entry.totalCost && <p className="text-xs text-green-600">R$ {parseFloat(String(entry.totalCost)).toFixed(2)}</p>}
                                  </div>
                                  <div className="flex gap-1">
                                    {entry.status === "draft" && (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => submitForApprovalMutation.mutate(entry.id)}
                                        data-testid={`button-submit-${entry.id}`}
                                      >
                                        Enviar
                                      </Button>
                                    )}
                                    {entry.status === "pending" && user?.role === "admin" && (
                                      <>
                                        <Button 
                                          size="sm" 
                                          className="bg-green-500 hover:bg-green-600"
                                          onClick={() => approveTimesheetMutation.mutate({ entryId: entry.id, action: "approve" })}
                                          data-testid={`button-approve-${entry.id}`}
                                        >
                                          <CheckCircle2 className="h-3 w-3" />
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="destructive"
                                          onClick={() => approveTimesheetMutation.mutate({ entryId: entry.id, action: "reject" })}
                                          data-testid={`button-reject-${entry.id}`}
                                        >
                                          <AlertCircle className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {filteredTimesheets.length === 0 && (
                            <p className="text-center text-slate-500 py-4">Nenhum registro de tempo encontrado</p>
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                {activeTab === "costs" && (
                  <div className="p-6">
                    <div className="grid md:grid-cols-4 gap-4 mb-6">
                      <Card className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{projectStats.totalPoints}</p>
                            <p className="text-xs text-slate-500">Pontos Totais</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{projectStats.completedPoints}</p>
                            <p className="text-xs text-slate-500">Pontos Concluídos</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            <Clock className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{projectStats.totalHours.toFixed(1)}h</p>
                            <p className="text-xs text-slate-500">Horas Trabalhadas</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <DollarSign className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">R$ {projectStats.totalCost.toFixed(0)}</p>
                            <p className="text-xs text-slate-500">Custo Total</p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <Card className="p-4">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" /> Custo por Tarefa
                      </h3>
                      <div className="space-y-2">
                        {workItems.filter(w => w.totalCost || w.actualHours).map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              {typeIcons[item.type]}
                              <div>
                                <p className="font-medium text-sm">{item.title}</p>
                                <p className="text-xs text-slate-500">
                                  {item.actualHours || 0}h trabalhadas • Esforço: {item.effortScore || "-"}/10
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">R$ {item.totalCost?.toFixed(2) || "0.00"}</p>
                              {item.hourlyRate && <p className="text-xs text-slate-500">R$ {item.hourlyRate}/h</p>}
                            </div>
                          </div>
                        ))}
                        {workItems.filter(w => w.totalCost || w.actualHours).length === 0 && (
                          <p className="text-center text-slate-500 py-4">Nenhum custo registrado</p>
                        )}
                      </div>
                    </Card>
                  </div>
                )}

                {activeTab === "squad" && (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                          <Users className="h-5 w-5" /> Squad do Projeto
                        </h2>
                        <p className="text-sm text-slate-500">Gerencie a equipe e papéis do projeto</p>
                      </div>
                      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                        <DialogTrigger asChild>
                          <Button data-testid="button-add-member">
                            <Plus className="h-4 w-4 mr-1" /> Adicionar Membro
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Adicionar Membro ao Squad</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Tipo de Membro</Label>
                              <Select 
                                value={newMember.type} 
                                onValueChange={(v: "internal" | "external") => setNewMember({ ...newMember, type: v, userId: undefined, collaboratorId: undefined })}
                              >
                                <SelectTrigger data-testid="select-member-type"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="internal">Colaborador Interno (Usuário do Sistema)</SelectItem>
                                  <SelectItem value="external">Colaborador Externo (Freelancer)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {newMember.type === "internal" ? (
                              <div>
                                <Label>Colaborador</Label>
                                <Select 
                                  value={newMember.userId || ""} 
                                  onValueChange={(v) => setNewMember({ ...newMember, userId: v })}
                                >
                                  <SelectTrigger data-testid="select-internal-user"><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
                                  <SelectContent>
                                    {collaborators.filter(c => !projectMembers.some(m => m.userId === c.id)).map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        {c.name} ({c.collaboratorType})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <div>
                                <Label>Freelancer</Label>
                                <Select 
                                  value={newMember.collaboratorId?.toString() || ""} 
                                  onValueChange={(v) => setNewMember({ ...newMember, collaboratorId: parseInt(v) })}
                                >
                                  <SelectTrigger data-testid="select-external-collaborator"><SelectValue placeholder="Selecione um freelancer" /></SelectTrigger>
                                  <SelectContent>
                                    {externalCollaborators.filter(c => !projectMembers.some(m => m.collaboratorId === c.id)).map((c) => (
                                      <SelectItem key={c.id} value={c.id.toString()}>
                                        {c.name} ({c.type}) {c.hourlyRate ? `- R$ ${c.hourlyRate}/h` : ""}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            <div>
                              <Label>Papel no Projeto</Label>
                              <Select 
                                value={newMember.role} 
                                onValueChange={(v: "product_owner" | "tech_lead" | "member") => setNewMember({ ...newMember, role: v })}
                              >
                                <SelectTrigger data-testid="select-member-role"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="product_owner">Product Owner</SelectItem>
                                  <SelectItem value="tech_lead">Tech Lead</SelectItem>
                                  <SelectItem value="member">Membro</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancelar</Button>
                            <Button 
                              onClick={() => {
                                addProjectMemberMutation.mutate({
                                  userId: newMember.type === "internal" ? newMember.userId : undefined,
                                  collaboratorId: newMember.type === "external" ? newMember.collaboratorId : undefined,
                                  role: newMember.role,
                                });
                                setAddMemberOpen(false);
                                setNewMember({ type: "internal", role: "member" });
                              }}
                              disabled={!((newMember.type === "internal" && newMember.userId) || (newMember.type === "external" && newMember.collaboratorId))}
                              data-testid="button-confirm-add-member"
                            >
                              Adicionar
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mb-6">
                      <Card className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Star className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{projectMembers.filter(m => m.role === "product_owner").length}</p>
                            <p className="text-xs text-slate-500">Product Owners</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Target className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{projectMembers.filter(m => m.role === "tech_lead").length}</p>
                            <p className="text-xs text-slate-500">Tech Leads</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Users className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{projectMembers.filter(m => m.role === "member").length}</p>
                            <p className="text-xs text-slate-500">Membros</p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Membros da Equipe ({projectMembers.length})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {projectMembers.length === 0 ? (
                          <div className="text-center py-8 text-slate-500">
                            <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p>Nenhum membro adicionado ainda</p>
                            <p className="text-sm">Clique em "Adicionar Membro" para começar</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {projectMembers.map((member) => {
                              const name = member.isExternal ? member.collaboratorName : member.userName;
                              const email = member.isExternal ? member.collaboratorEmail : member.userEmail;
                              const hourlyRate = member.isExternal ? member.collaboratorHourlyRate : member.userHourlyRate;
                              const roleConfig = {
                                product_owner: { label: "Product Owner", icon: Star, color: "text-purple-600 bg-purple-100" },
                                tech_lead: { label: "Tech Lead", icon: Target, color: "text-blue-600 bg-blue-100" },
                                member: { label: "Membro", icon: User, color: "text-slate-600 bg-slate-100" },
                              };
                              const RoleIcon = roleConfig[member.role]?.icon || User;
                              
                              return (
                                <div 
                                  key={member.id} 
                                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                  data-testid={`member-row-${member.id}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${roleConfig[member.role]?.color}`}>
                                      <RoleIcon className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="font-medium flex items-center gap-2">
                                        {name || "Sem nome"}
                                        {member.isExternal && (
                                          <Badge variant="outline" className="text-xs">Externo</Badge>
                                        )}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {email || "Sem email"} {hourlyRate ? `• R$ ${hourlyRate}/h` : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Select 
                                      value={member.role} 
                                      onValueChange={(v) => updateMemberRoleMutation.mutate({ memberId: member.id, role: v })}
                                    >
                                      <SelectTrigger className="w-36 h-8" data-testid={`select-role-${member.id}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="product_owner">Product Owner</SelectItem>
                                        <SelectItem value="tech_lead">Tech Lead</SelectItem>
                                        <SelectItem value="member">Membro</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => removeProjectMemberMutation.mutate(member.id)}
                                      data-testid={`button-remove-member-${member.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FolderKanban className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-slate-600">Selecione um Projeto</h3>
                <p className="text-slate-400 mt-2">Escolha um projeto na barra lateral ou crie um novo</p>
                <Button className="mt-4" onClick={() => setNewProjectOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Novo Projeto
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={workItemDetailOpen} onOpenChange={setWorkItemDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedWorkItem && typeIcons[selectedWorkItem.type]}
              {selectedWorkItem?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedWorkItem && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge className={statusConfig[selectedWorkItem.status]?.bgColor}>
                  {statusConfig[selectedWorkItem.status]?.label}
                </Badge>
                <Badge variant="outline">{priorityConfig[selectedWorkItem.priority]?.label}</Badge>
                {selectedWorkItem.storyPoints && <Badge variant="secondary">{selectedWorkItem.storyPoints} pts</Badge>}
              </div>
              
              {selectedWorkItem.description && (
                <div>
                  <Label className="text-xs text-slate-500">Descrição</Label>
                  <p className="text-sm mt-1">{selectedWorkItem.description}</p>
                </div>
              )}

              <div>
                <Label className="text-xs text-slate-500">Sprint</Label>
                <Select
                  value={selectedWorkItem.sprintId?.toString() || "none"}
                  onValueChange={(value) => {
                    const sprintId = value === "none" ? null : parseInt(value);
                    updateWorkItemMutation.mutate({ 
                      id: selectedWorkItem.id, 
                      data: { sprintId: sprintId as any }
                    });
                    setSelectedWorkItem({ ...selectedWorkItem, sprintId: sprintId ?? undefined });
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma sprint" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem sprint (Backlog)</SelectItem>
                    {sprints.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id.toString()}>
                        {sprint.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-slate-500">Esforço</Label>
                  <p className="font-medium">{selectedWorkItem.effortScore || "-"}/10</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Horas Estimadas</Label>
                  <p className="font-medium">{selectedWorkItem.estimatedHours || "-"}h</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Horas Reais</Label>
                  <p className="font-medium">{selectedWorkItem.actualHours || "-"}h</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-slate-500">Custo/Hora</Label>
                  <p className="font-medium">R$ {selectedWorkItem.hourlyRate || "0"}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Custo Total</Label>
                  <p className="font-medium text-green-600">R$ {selectedWorkItem.totalCost?.toFixed(2) || "0.00"}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setAiPrompt(`Ajude a detalhar e planejar esta tarefa: ${selectedWorkItem.title}`);
                    setAiAssistOpen(true);
                  }}
                >
                  <Bot className="h-4 w-4 mr-2" /> Assistente IA
                </Button>
                <Button variant="outline">
                  <Paperclip className="h-4 w-4 mr-2" /> Anexar Arquivo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={aiAssistOpen} onOpenChange={setAiAssistOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Agente IA - Assistente de Tarefas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div>
              <Label>Como posso ajudar?</Label>
              <Textarea 
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Descreva o que precisa: detalhar requisitos, estimar esforço, sugerir subtarefas..."
                rows={3}
              />
            </div>
            <Button onClick={handleAiAssist} disabled={isAiLoading || !aiPrompt.trim()} className="w-full flex-shrink-0">
              {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              {isAiLoading ? "Processando..." : "Consultar Agente"}
            </Button>
            {aiResponse && (
              <Card className="p-4 bg-slate-50 flex-1 overflow-auto">
                <Label className="text-xs text-slate-500 mb-2 block">Resposta do Agente</Label>
                <div className="text-sm whitespace-pre-wrap">{aiResponse}</div>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={squadDetailOpen} onOpenChange={setSquadDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Gerenciar Squad: {selectedSquadForEdit?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedSquadForEdit && (
            <SquadDetailContent 
              squad={selectedSquadForEdit}
              collaborators={collaborators}
              onUpdate={(updated) => {
                setSelectedSquadForEdit(updated);
                queryClient.invalidateQueries({ queryKey: ["/api/production/squads"] });
              }}
              onAddCollaborator={() => setNewCollaboratorOpen(true)}
              onDelete={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/production/squads"] });
                setSelectedSquad(null);
              }}
              onClose={() => setSquadDetailOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </BrowserFrame>
  );
}
