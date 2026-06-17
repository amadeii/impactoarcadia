import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import MultiTenantSection from "@/components/MultiTenantSection";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmpresaContext } from "@/hooks/useEmpresaContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  FileText, 
  MessageSquare, 
  Calendar, 
  TrendingUp, 
  Plus, 
  Building, 
  Award, 
  DollarSign,
  Phone,
  Mail,
  ExternalLink,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  UserPlus,
  Target,
  Package,
  Filter,
  ArrowRight,
  Trash2,
  Edit,
  MoreVertical,
  Search,
  Link2,
  Zap,
  AlertCircle,
  Clock,
  Briefcase,
  Building2,
  Shield,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Partner {
  id: number;
  tenantId?: number;
  name: string;
  primaryContactName?: string;
  email?: string;
  phone?: string;
  type: string;
  tier: string;
  status: string;
  createdAt: string;
}

interface Client {
  id: number;
  tenantId?: number;
  name: string;
  tradeName?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  segment?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  notes?: string;
  status: string;
  source?: string;
  convertedFromPartnerId?: number;
  partnerId?: number;
  createdAt: string;
}

interface Contract {
  id: number;
  partnerId?: number;
  clientName: string;
  productType: string;
  monthlyValue: number;
  recurrenceType: string;
  status: string;
  startDate: string;
  endDate?: string;
}

interface Thread {
  id: number;
  channelId?: number;
  contactPhone?: string;
  contactEmail?: string;
  contactName?: string;
  status: string;
  unreadCount: number;
  lastMessageAt: string;
}

interface CrmEvent {
  id: number;
  title: string;
  description?: string;
  type: string;
  startAt: string;
  endAt?: string;
  status: string;
}

interface Stats {
  totalPartners: number;
  totalContracts: number;
  openThreads: number;
}

interface Lead {
  id: number;
  tenantId?: number;
  userId?: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  source?: string;
  status: string;
  notes?: string;
  tags?: string[];
  assignedTo?: string;
  convertedAt?: string;
  createdAt: string;
}

interface Opportunity {
  id: number;
  tenantId?: number;
  userId?: string;
  leadId?: number;
  partnerId?: number;
  stageId?: number;
  name: string;
  description?: string;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  status: string;
  lossReason?: string;
  assignedTo?: string;
  approvalStatus?: string;
  approvedAt?: string;
  approvedBy?: string;
  processCompassProjectId?: number;
  billingStatus?: string;
  createdAt: string;
}

interface Product {
  id: number;
  tenantId?: number;
  name: string;
  description?: string;
  type: string;
  category?: string;
  price: number;
  currency: string;
  unit: string;
  isActive: string;
  sku?: string;
  createdAt: string;
}

interface PipelineStage {
  id: number;
  tenantId?: number;
  name: string;
  description?: string;
  color: string;
  orderIndex: number;
  probability: number;
  createdAt: string;
}

interface SalesStats {
  leads: { total: number; new: number; qualified: number; converted: number };
  opportunities: { total: number; open: number; won: number; lost: number; totalValue: number; wonValue: number; winRate: number };
}

interface FrappeConnector {
  id: number;
  name: string;
  baseUrl: string;
  targetSystem: string;
  syncMode: string;
  status: string;
  lastSyncAt: string | null;
  errorMessage: string | null;
  hasCredentials: boolean;
}

export default function Crm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showNewPartner, setShowNewPartner] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [showNewContract, setShowNewContract] = useState(false);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showNewConnector, setShowNewConnector] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showNewOpportunity, setShowNewOpportunity] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showNewStage, setShowNewStage] = useState(false);
  const [leadFilter, setLeadFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [segmentoSelecionado, setSegmentoSelecionado] = useState<string>("");

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/crm/stats"],
    enabled: !!user
  });

  const { data: partners = [] } = useQuery<Partner[]>({
    queryKey: ["/api/crm/partners"],
    enabled: !!user
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/crm/clients"],
    enabled: !!user
  });

  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/crm/contracts"],
    enabled: !!user
  });

  const { data: threads = [] } = useQuery<Thread[]>({
    queryKey: ["/api/crm/threads"],
    enabled: !!user
  });

  const { data: events = [] } = useQuery<CrmEvent[]>({
    queryKey: ["/api/crm/events"],
    enabled: !!user
  });

  const { data: googleStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/crm/google/status"],
    enabled: !!user
  });

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/crm/leads", leadFilter],
    queryFn: async () => {
      const url = leadFilter ? `/api/crm/leads?status=${leadFilter}` : "/api/crm/leads";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    enabled: !!user
  });

  const { data: opportunities = [] } = useQuery<Opportunity[]>({
    queryKey: ["/api/crm/opportunities"],
    enabled: !!user
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/crm/products"],
    enabled: !!user
  });

  const { data: pipelineStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/crm/pipeline-stages"],
    enabled: !!user
  });

  const { data: salesStats } = useQuery<SalesStats>({
    queryKey: ["/api/crm/stats/sales"],
    enabled: !!user
  });

  const { data: frappeConnectors = [] } = useQuery<FrappeConnector[]>({
    queryKey: ["/api/crm/frappe/connectors"],
    enabled: !!user
  });


  const { can } = usePermissions();
  const { empresas: empresasGrupo = [] } = useEmpresaContext();

  const isAdmin = user?.role === "admin" || (user as any)?.allowedModules?.includes("admin");
  const canAccessSettings = user?.role === "admin" || (user as any)?.allowedModules?.includes("admin") || (user as any)?.allowedModules?.includes("settings");

  // ── USR-03: estado do convite ─────────────────────────────────────
  const [settingsTab, setSettingsTab] = useState("usuarios");
  const [showConvite, setShowConvite] = useState(false);
  const [conviteForm, setConviteForm] = useState({
    name: "", email: "", username: "", password: "", perfilId: "", empresasIds: [] as number[],
  });
  const toggleConviteEmpresa = (id: number) =>
    setConviteForm(f => ({
      ...f,
      empresasIds: f.empresasIds.includes(id)
        ? f.empresasIds.filter(x => x !== id)
        : [...f.empresasIds, id],
    }));

  const { data: systemProfiles = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/profiles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/profiles", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && canAccessSettings
  });

  const { data: systemUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && canAccessSettings
  });

  // Usuários do tenant (RBAC-scoped)
  const { data: tenantUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/usuarios"],
    queryFn: async () => {
      const res = await fetch("/api/admin/usuarios", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && canAccessSettings
  });

  // Perfis RBAC
  const { data: rbacRoles = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/roles", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && canAccessSettings
  });

  // Todas as permissões disponíveis (para a matriz)
  const { data: allPermissions = [], isLoading: loadingPerms, refetch: refetchPerms } = useQuery<any[]>({
    queryKey: ["/api/admin/permissions-all"],
    queryFn: async () => {
      const res = await fetch("/api/admin/permissions-all", { credentials: "include" });
      if (!res.ok) {
        console.warn("[allPermissions] status:", res.status, await res.text().catch(() => ""));
        return [];
      }
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Estado de edição de perfil
  const [editPerfilId, setEditPerfilId] = useState<number | null>(null);
  const [editPerfilForm, setEditPerfilForm] = useState({ name: "", description: "" });
  const [editPerfilCodes, setEditPerfilCodes] = useState<Set<string>>(new Set());
  const [editPerfilTab, setEditPerfilTab] = useState<"info" | "permissoes">("info");
  const [showNovoPerfil, setShowNovoPerfil] = useState(false);
  const [novoPerfilForm, setNovoPerfilForm] = useState({ name: "", description: "" });

  // Permissões do role em edição
  const { data: rolePermCodes = [], refetch: refetchRolePerms } = useQuery<string[]>({
    queryKey: ["/api/admin/roles", editPerfilId, "permissions"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/roles/${editPerfilId}/permissions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: editPerfilId !== null,
  });

  const togglePermCode = (code: string) =>
    setEditPerfilCodes(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const openEditPerfil = (profile: any, tab: "info" | "permissoes" = "info") => {
    setEditPerfilId(profile.id);
    setEditPerfilForm({ name: profile.name, description: profile.description ?? "" });
    setEditPerfilCodes(new Set(rolePermCodes));
    setEditPerfilTab(tab);
  };

  // Sincroniza codes quando rolePermCodes chega do servidor
  const [lastSyncedRoleId, setLastSyncedRoleId] = useState<number | null>(null);
  if (editPerfilId !== null && editPerfilId !== lastSyncedRoleId && rolePermCodes.length > 0) {
    setEditPerfilCodes(new Set(rolePermCodes));
    setLastSyncedRoleId(editPerfilId);
  }

  const { data: adminStats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user && canAccessSettings
  });

  const createConnectorMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/frappe/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create connector");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/frappe/connectors"] });
      setShowNewConnector(false);
      toast({ title: "Conector criado com sucesso" });
    }
  });

  const testConnectorMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/frappe/connectors/${id}/test`, {
        method: "POST",
        credentials: "include"
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/frappe/connectors"] });
      if (data.success) {
        toast({ title: "Conexão bem-sucedida", description: `Usuário: ${data.user}` });
      } else {
        toast({ title: "Falha na conexão", description: data.error, variant: "destructive" });
      }
    }
  });

  const syncConnectorMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/frappe/connectors/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({})
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/frappe/connectors"] });
      toast({ 
        title: "Sincronização concluída", 
        description: `${data.totalSuccess} registros sincronizados${data.totalFailed > 0 ? `, ${data.totalFailed} falhas` : ""}` 
      });
    }
  });

  const deleteConnectorMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/frappe/connectors/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to delete connector");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/frappe/connectors"] });
      toast({ title: "Conector excluído" });
    }
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/users/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update user status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Status do usuário atualizado" });
    }
  });

  // ── Mutations de perfil ───────────────────────────────────────────
  const salvarPerfilMutation = useMutation({
    mutationFn: async ({ id, name, description, codes }: { id: number; name: string; description: string; codes: string[] }) => {
      await fetch(`/api/admin/roles/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const r = await fetch(`/api/admin/roles/${id}/permissions`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      if (!r.ok) throw new Error("Falha ao salvar permissões");
    },
    onSuccess: () => {
      toast({ title: "Perfil salvo com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles"] });
      setEditPerfilId(null);
      setLastSyncedRoleId(null);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const criarPerfilMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const r = await fetch("/api/admin/roles", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!r.ok) throw new Error("Falha ao criar perfil");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Perfil criado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      setShowNovoPerfil(false);
      setNovoPerfilForm({ name: "", description: "" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── CRUD de usuários ──────────────────────────────────────────────────
  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/usuarios"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
  };

  const cadastrarUsuarioMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || e.error || "Erro ao cadastrar"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Usuário cadastrado com sucesso!" });
      invalidateUsers();
      setShowConvite(false);
      setConviteForm({ name:"", email:"", username:"", password:"", perfilId:"", empresasIds:[] });
    },
    onError: (e: any) => toast({ title: "Erro ao cadastrar", description: e.message, variant: "destructive" }),
  });

  // Estado de edição de usuário
  const [editUsuario, setEditUsuario] = useState<any | null>(null);
  const [editUsuarioForm, setEditUsuarioForm] = useState({
    name: "", email: "", password: "", perfilId: "", empresasIds: [] as number[],
  });

  const abrirEditUsuario = (u: any) => {
    setEditUsuario(u);
    const empresasAtivas = (u.empresas ?? []).map((e: any) => e.id);
    setEditUsuarioForm({
      name: u.name ?? "",
      email: u.email ?? "",
      password: "",
      perfilId: u.perfil_id ? String(u.perfil_id) : "",
      empresasIds: empresasAtivas,
    });
  };

  const toggleEditEmpresa = (id: number) =>
    setEditUsuarioForm(f => ({
      ...f,
      empresasIds: f.empresasIds.includes(id)
        ? f.empresasIds.filter(x => x !== id)
        : [...f.empresasIds, id],
    }));

  const editarUsuarioMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/admin/usuarios/${editUsuario?.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || e.error || "Erro ao editar"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Usuário atualizado com sucesso!" });
      invalidateUsers();
      setEditUsuario(null);
    },
    onError: (e: any) => toast({ title: "Erro ao editar", description: e.message, variant: "destructive" }),
  });

  // Estado de confirmação de exclusão
  const [deleteUsuarioConfirm, setDeleteUsuarioConfirm] = useState<any | null>(null);

  const deletarUsuarioMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/usuarios/${userId}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || e.error || "Erro ao excluir"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Usuário removido com sucesso!" });
      invalidateUsers();
      setDeleteUsuarioConfirm(null);
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const toggleTenantUserStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const res = await fetch(`/api/admin/usuarios/${userId}/status`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Falha"); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/usuarios"] }),
    onError: (e: any) => toast({ title: "Erro ao alterar status", description: e.message, variant: "destructive" }),
  });

  const updatePartnerStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/partners/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update partner status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Status do parceiro atualizado" });
    }
  });

  const updateClientStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/clients/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update client status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Status da empresa atualizado" });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Usuário atualizado" });
    }
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats/sales"] });
      setShowNewLead(false);
      toast({ title: "Lead criado com sucesso" });
    }
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats/sales"] });
      toast({ title: "Lead atualizado" });
    }
  });

  const convertLeadMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: number; data: any }) => {
      const res = await fetch(`/api/crm/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to convert lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats/sales"] });
      toast({ title: "Lead convertido em oportunidade" });
    }
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/leads/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete lead");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats/sales"] });
      toast({ title: "Lead excluído" });
    }
  });

  const createOpportunityMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create opportunity");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats/sales"] });
      setShowNewOpportunity(false);
      toast({ title: "Oportunidade criada com sucesso" });
    }
  });

  const updateOpportunityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/crm/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update opportunity");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats/sales"] });
      toast({ title: "Oportunidade atualizada" });
    }
  });

  const moveOpportunityMutation = useMutation({
    mutationFn: async ({ id, stageId }: { id: number; stageId: number }) => {
      const res = await fetch(`/api/crm/opportunities/${id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stageId })
      });
      if (!res.ok) throw new Error("Failed to move opportunity");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: "Oportunidade movida" });
    }
  });

  const winOpportunityMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/opportunities/${id}/won`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats/sales"] });
      toast({ title: "Oportunidade ganha!" });
    }
  });

  const loseOpportunityMutation = useMutation({
    mutationFn: async ({ id, lossReason }: { id: number; lossReason?: string }) => {
      const res = await fetch(`/api/crm/opportunities/${id}/lost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lossReason })
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats/sales"] });
      toast({ title: "Oportunidade perdida" });
    }
  });

  const approveOpportunityMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/opportunities/${id}/approve`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to approve opportunity");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats/sales"] });
      toast({ title: "Oportunidade aprovada!" });
    }
  });

  const openProjectMutation = useMutation({
    mutationFn: async ({ opportunityId, tenantId, clientId }: { opportunityId: number; tenantId: number; clientId: number }) => {
      const res = await fetch(`/api/crm/opportunities/${opportunityId}/open-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId, clientId })
      });
      if (!res.ok) throw new Error("Failed to open project");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: "Projeto criado no Process Compass!" });
    }
  });

  const billOpportunityMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/opportunities/${id}/bill`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to update billing status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: "Faturamento iniciado!" });
    }
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create product");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/products"] });
      setShowNewProduct(false);
      toast({ title: "Produto criado com sucesso" });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/products/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/products"] });
      toast({ title: "Produto excluído" });
    }
  });

  const createStageMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/pipeline-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create stage");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipeline-stages"] });
      setShowNewStage(false);
      toast({ title: "Estágio criado com sucesso" });
    }
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/pipeline-stages/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete stage");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipeline-stages"] });
      toast({ title: "Estágio excluído" });
    }
  });

  const createPartnerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create partner");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      setShowNewPartner(false);
      toast({ title: "Parceiro criado com sucesso" });
    }
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create client");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      setShowNewClient(false);
      toast({ title: "Empresa criada com sucesso" });
    }
  });

  const convertPartnerToClientMutation = useMutation({
    mutationFn: async (partnerId: number) => {
      const res = await fetch(`/api/crm/partners/${partnerId}/convert-to-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to convert partner to client");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({ title: "Parceiro convertido para empresa com sucesso" });
    }
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/crm/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update client");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      setEditingClient(null);
      toast({ title: "Empresa atualizada com sucesso" });
    }
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/clients/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to delete client");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      toast({ title: "Empresa excluída com sucesso" });
    }
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create contract");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      setShowNewContract(false);
      toast({ title: "Contrato criado com sucesso" });
    }
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create event");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/events"] });
      setShowNewEvent(false);
      toast({ title: "Evento criado com sucesso" });
    }
  });

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/crm/google/auth", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to get auth URL");
      const { url } = await res.json();
      window.location.href = url;
    }
  });

  const syncGoogleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/crm/google/sync", {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to sync");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/events"] });
      toast({ title: "Eventos sincronizados" });
    }
  });

  const tierColors: Record<string, string> = {
    standard: "bg-gray-500",
    gold: "bg-yellow-500",
    platinum: "bg-blue-500",
    diamond: "bg-purple-500"
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-500",
    inactive: "bg-gray-500",
    pending: "bg-yellow-500",
    cancelled: "bg-red-500",
    open: "bg-blue-500",
    closed: "bg-gray-500"
  };

  return (
    <BrowserFrame>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-crm-title">Manager Partners</h1>
              <p className="text-muted-foreground">Gestão de parceiros, tenants e contratos</p>
            </div>
            <div className="flex gap-2">
              {googleStatus?.connected ? (
                <Button variant="outline" size="sm" onClick={() => syncGoogleMutation.mutate()} data-testid="button-sync-google">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sincronizar Google
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => connectGoogleMutation.mutate()} data-testid="button-connect-google">
                  <Calendar className="w-4 h-4 mr-2" />
                  Conectar Google Calendar
                </Button>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <ScrollArea className="w-full">
              <TabsList className="inline-flex w-auto min-w-full">
                <TabsTrigger value="dashboard" data-testid="tab-dashboard">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="leads" data-testid="tab-leads">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Leads
                </TabsTrigger>
                <TabsTrigger value="opportunities" data-testid="tab-opportunities">
                  <Target className="w-4 h-4 mr-2" />
                  Oportunidades
                </TabsTrigger>
                <TabsTrigger value="products" data-testid="tab-products">
                  <Package className="w-4 h-4 mr-2" />
                  Produtos
                </TabsTrigger>
                <TabsTrigger value="partners" data-testid="tab-partners">
                  <Users className="w-4 h-4 mr-2" />
                  Parceiros
                </TabsTrigger>
                <TabsTrigger value="contracts" data-testid="tab-contracts">
                  <FileText className="w-4 h-4 mr-2" />
                  Contratos
                </TabsTrigger>
                <TabsTrigger value="messages" data-testid="tab-messages">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Mensagens
                </TabsTrigger>
                <TabsTrigger value="calendar" data-testid="tab-calendar">
                  <Calendar className="w-4 h-4 mr-2" />
                  Agenda
                </TabsTrigger>
                <TabsTrigger value="integrations" data-testid="tab-integrations">
                  <Link2 className="w-4 h-4 mr-2" />
                  Integrações
                </TabsTrigger>
                <TabsTrigger value="settings" data-testid="tab-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </TabsTrigger>
                <TabsTrigger value="multitenant" data-testid="tab-multitenant">
                  <Building2 className="w-4 h-4 mr-2" />
                  Multi-Tenant
                </TabsTrigger>
              </TabsList>
            </ScrollArea>

            <TabsContent value="dashboard" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card data-testid="card-stat-partners">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total de Parceiros</CardTitle>
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalPartners || 0}</div>
                  </CardContent>
                </Card>

                <Card data-testid="card-stat-contracts">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Contratos Ativos</CardTitle>
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalContracts || 0}</div>
                  </CardContent>
                </Card>

                <Card data-testid="card-stat-threads">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Conversas Abertas</CardTitle>
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.openThreads || 0}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Parceiros Recentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {partners.slice(0, 5).map(partner => (
                      <div key={partner.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`row-partner-${partner.id}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${tierColors[partner.tier] || "bg-gray-500"}`} />
                          <div>
                            <p className="font-medium">{partner.name}</p>
                            <p className="text-sm text-muted-foreground">{partner.email}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="capitalize">{partner.tier}</Badge>
                      </div>
                    ))}
                    {partners.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">Nenhum parceiro cadastrado</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Contratos Recentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contracts.slice(0, 5).map(contract => (
                      <div key={contract.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`row-contract-${contract.id}`}>
                        <div>
                          <p className="font-medium">{contract.clientName}</p>
                          <p className="text-sm text-muted-foreground">{contract.productType}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">R$ {contract.monthlyValue?.toLocaleString("pt-BR")}</p>
                          <Badge variant={contract.status === "active" ? "default" : "secondary"} className="capitalize">
                            {contract.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {contracts.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">Nenhum contrato cadastrado</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sales Stats */}
              {salesStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{salesStats.leads.total}</div>
                      <p className="text-xs text-muted-foreground">{salesStats.leads.new} novos, {salesStats.leads.qualified} qualificados</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Oportunidades</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{salesStats.opportunities.open}</div>
                      <p className="text-xs text-muted-foreground">{salesStats.opportunities.won} ganhas, {salesStats.opportunities.lost} perdidas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Valor em Aberto</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">R$ {(salesStats.opportunities.totalValue / 100).toLocaleString("pt-BR")}</div>
                      <p className="text-xs text-muted-foreground">Pipeline total</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{salesStats.opportunities.winRate}%</div>
                      <p className="text-xs text-muted-foreground">Oportunidades ganhas</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* LEADS TAB */}
            <TabsContent value="leads" className="space-y-4">
              <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar leads..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-leads"
                    />
                  </div>
                  <Select value={leadFilter || "all"} onValueChange={(v) => setLeadFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-40" data-testid="select-lead-filter">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filtrar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="new">Novos</SelectItem>
                      <SelectItem value="contacted">Contatados</SelectItem>
                      <SelectItem value="qualified">Qualificados</SelectItem>
                      <SelectItem value="unqualified">Não qualificados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Dialog open={showNewLead} onOpenChange={setShowNewLead}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-lead">
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Lead
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cadastrar Lead</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target as HTMLFormElement);
                      createLeadMutation.mutate({
                        name: formData.get("name"),
                        email: formData.get("email"),
                        phone: formData.get("phone"),
                        company: formData.get("company"),
                        position: formData.get("position"),
                        source: formData.get("source"),
                        notes: formData.get("notes"),
                        status: "new"
                      });
                    }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="leadName">Nome</Label>
                          <Input id="leadName" name="name" required data-testid="input-lead-name" />
                        </div>
                        <div>
                          <Label htmlFor="leadCompany">Empresa</Label>
                          <Input id="leadCompany" name="company" data-testid="input-lead-company" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="leadEmail">Email</Label>
                          <Input id="leadEmail" name="email" type="email" data-testid="input-lead-email" />
                        </div>
                        <div>
                          <Label htmlFor="leadPhone">Telefone</Label>
                          <Input id="leadPhone" name="phone" data-testid="input-lead-phone" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="leadPosition">Cargo</Label>
                          <Input id="leadPosition" name="position" data-testid="input-lead-position" />
                        </div>
                        <div>
                          <Label htmlFor="leadSource">Origem</Label>
                          <Select name="source" defaultValue="website">
                            <SelectTrigger data-testid="select-lead-source">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="website">Website</SelectItem>
                              <SelectItem value="referral">Indicação</SelectItem>
                              <SelectItem value="linkedin">LinkedIn</SelectItem>
                              <SelectItem value="event">Evento</SelectItem>
                              <SelectItem value="other">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="leadNotes">Observações</Label>
                        <Textarea id="leadNotes" name="notes" rows={3} data-testid="input-lead-notes" />
                      </div>
                      <Button type="submit" className="w-full" disabled={createLeadMutation.isPending} data-testid="button-submit-lead">
                        Cadastrar Lead
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {leads.filter(l => !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase()) || (l.company && l.company.toLowerCase().includes(searchQuery.toLowerCase()))).map(lead => (
                  <Card key={lead.id} data-testid={`card-lead-${lead.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{lead.name}</CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`menu-lead-${lead.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateLeadMutation.mutate({ id: lead.id, data: { status: "contacted" } })}>
                              Marcar como Contatado
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateLeadMutation.mutate({ id: lead.id, data: { status: "qualified" } })}>
                              Qualificar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => convertLeadMutation.mutate({ leadId: lead.id, data: { stageId: pipelineStages[0]?.id } })}>
                              <ArrowRight className="w-4 h-4 mr-2" />
                              Converter em Oportunidade
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteLeadMutation.mutate(lead.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {lead.company && <CardDescription>{lead.company} {lead.position && `• ${lead.position}`}</CardDescription>}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {lead.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {lead.email}
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {lead.phone}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-4">
                        <Badge variant={lead.status === "qualified" ? "default" : lead.status === "new" ? "secondary" : "outline"} className="capitalize">
                          {lead.status === "new" ? "Novo" : lead.status === "contacted" ? "Contatado" : lead.status === "qualified" ? "Qualificado" : lead.status}
                        </Badge>
                        {lead.source && <span className="text-xs text-muted-foreground capitalize">{lead.source}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {leads.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="text-center py-8">
                      <UserPlus className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum lead cadastrado</p>
                      <Button variant="outline" className="mt-4" onClick={() => setShowNewLead(true)}>
                        Adicionar primeiro lead
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* OPPORTUNITIES TAB - Kanban Pipeline */}
            <TabsContent value="opportunities" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Funil de Vendas</h2>
                <div className="flex gap-2">
                  <Dialog open={showNewStage} onOpenChange={setShowNewStage}>
                    <DialogTrigger asChild>
                      <Button variant="outline" data-testid="button-new-stage">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Estágio
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Estágio do Pipeline</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target as HTMLFormElement);
                        createStageMutation.mutate({
                          name: formData.get("name"),
                          probability: Number(formData.get("probability")) || 50,
                          color: formData.get("color") || "#3b82f6",
                          orderIndex: pipelineStages.length
                        });
                      }} className="space-y-4">
                        <div>
                          <Label htmlFor="stageName">Nome do Estágio</Label>
                          <Input id="stageName" name="name" required data-testid="input-stage-name" />
                        </div>
                        <div>
                          <Label htmlFor="stageProbability">Probabilidade (%)</Label>
                          <Input id="stageProbability" name="probability" type="number" min="0" max="100" defaultValue="50" data-testid="input-stage-probability" />
                        </div>
                        <div>
                          <Label htmlFor="stageColor">Cor</Label>
                          <Input id="stageColor" name="color" type="color" defaultValue="#3b82f6" data-testid="input-stage-color" />
                        </div>
                        <Button type="submit" className="w-full" disabled={createStageMutation.isPending} data-testid="button-submit-stage">
                          Criar Estágio
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={showNewOpportunity} onOpenChange={setShowNewOpportunity}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-new-opportunity">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Oportunidade
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Oportunidade</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target as HTMLFormElement);
                        createOpportunityMutation.mutate({
                          name: formData.get("name"),
                          description: formData.get("description"),
                          value: Math.round(Number(formData.get("value")) * 100) || 0,
                          stageId: Number(formData.get("stageId")) || pipelineStages[0]?.id,
                          expectedCloseDate: formData.get("expectedCloseDate") || undefined
                        });
                      }} className="space-y-4">
                        <div>
                          <Label htmlFor="oppName">Nome da Oportunidade</Label>
                          <Input id="oppName" name="name" required data-testid="input-opp-name" />
                        </div>
                        <div>
                          <Label htmlFor="oppDescription">Descrição</Label>
                          <Textarea id="oppDescription" name="description" rows={2} data-testid="input-opp-description" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="oppValue">Valor (R$)</Label>
                            <Input id="oppValue" name="value" type="number" step="0.01" data-testid="input-opp-value" />
                          </div>
                          <div>
                            <Label htmlFor="oppStage">Estágio</Label>
                            <Select name="stageId" defaultValue={pipelineStages[0]?.id?.toString()}>
                              <SelectTrigger data-testid="select-opp-stage">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {pipelineStages.map(stage => (
                                  <SelectItem key={stage.id} value={stage.id.toString()}>{stage.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="oppClose">Previsão de Fechamento</Label>
                          <Input id="oppClose" name="expectedCloseDate" type="date" data-testid="input-opp-close" />
                        </div>
                        <Button type="submit" className="w-full" disabled={createOpportunityMutation.isPending} data-testid="button-submit-opp">
                          Criar Oportunidade
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Kanban Board */}
              <div className="flex gap-4 overflow-x-auto pb-4">
                {pipelineStages.map(stage => {
                  const stageOpps = opportunities.filter(o => o.stageId === stage.id && o.status === "open");
                  const stageValue = stageOpps.reduce((sum, o) => sum + (o.value || 0), 0);
                  return (
                    <div key={stage.id} className="flex-shrink-0 w-80">
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                            <h3 className="font-medium">{stage.name}</h3>
                            <Badge variant="secondary">{stageOpps.length}</Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">{stage.probability}%</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">R$ {(stageValue / 100).toLocaleString("pt-BR")}</p>
                        <div className="space-y-2">
                          {stageOpps.map(opp => (
                            <Card key={opp.id} className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`card-opp-${opp.id}`}>
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium text-sm">{opp.name}</p>
                                    <p className="text-lg font-bold text-primary">R$ {(opp.value / 100).toLocaleString("pt-BR")}</p>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {pipelineStages.filter(s => s.id !== stage.id).map(s => (
                                        <DropdownMenuItem key={s.id} onClick={() => moveOpportunityMutation.mutate({ id: opp.id, stageId: s.id })}>
                                          Mover para {s.name}
                                        </DropdownMenuItem>
                                      ))}
                                      <DropdownMenuItem onClick={() => winOpportunityMutation.mutate(opp.id)} className="text-green-600">
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Marcar como Ganha
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => loseOpportunityMutation.mutate({ id: opp.id })} className="text-red-600">
                                        <XCircle className="w-4 h-4 mr-2" />
                                        Marcar como Perdida
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                {opp.expectedCloseDate && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Fechamento: {new Date(opp.expectedCloseDate).toLocaleDateString("pt-BR")}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {pipelineStages.length === 0 && (
                  <Card className="w-full">
                    <CardContent className="text-center py-8">
                      <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Configure os estágios do seu funil de vendas</p>
                      <Button variant="outline" className="mt-4" onClick={() => setShowNewStage(true)}>
                        Criar primeiro estágio
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Won/Lost Opportunities */}
              {(opportunities.filter(o => o.status !== "open").length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Oportunidades Ganhas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {opportunities.filter(o => o.status === "won").slice(0, 10).map(opp => (
                        <div key={opp.id} className="p-3 border rounded-lg" data-testid={`won-opp-${opp.id}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{opp.name}</span>
                            <span className="font-bold text-green-600">R$ {(opp.value / 100).toLocaleString("pt-BR")}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {opp.approvalStatus === "pending" && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-blue-600 border-blue-600"
                                onClick={() => approveOpportunityMutation.mutate(opp.id)}
                                disabled={approveOpportunityMutation.isPending}
                                data-testid={`button-approve-${opp.id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Aprovar
                              </Button>
                            )}
                            {opp.approvalStatus === "approved" && !opp.processCompassProjectId && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="default"
                                  onClick={() => {
                                    const tenantId = opp.tenantId || 1;
                                    const clientId = clients[0]?.id;
                                    if (clientId) {
                                      openProjectMutation.mutate({ opportunityId: opp.id, tenantId, clientId });
                                    } else {
                                      toast({ title: "Cadastre uma empresa primeiro", variant: "destructive" });
                                    }
                                  }}
                                  disabled={openProjectMutation.isPending}
                                  data-testid={`button-open-project-${opp.id}`}
                                >
                                  <Briefcase className="w-4 h-4 mr-1" />
                                  Abrir Projeto
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => billOpportunityMutation.mutate(opp.id)}
                                  disabled={billOpportunityMutation.isPending}
                                  data-testid={`button-bill-${opp.id}`}
                                >
                                  <FileText className="w-4 h-4 mr-1" />
                                  Faturar
                                </Button>
                              </>
                            )}
                            {opp.processCompassProjectId && (
                              <Badge variant="secondary">
                                <Briefcase className="w-3 h-3 mr-1" />
                                Projeto #{opp.processCompassProjectId}
                              </Badge>
                            )}
                            {opp.billingStatus === "pending" && (
                              <Badge variant="outline" className="text-orange-600">
                                <FileText className="w-3 h-3 mr-1" />
                                Aguardando Fatura
                              </Badge>
                            )}
                            {opp.approvalStatus === "approved" && (
                              <Badge className="bg-green-100 text-green-700">Aprovada</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600 flex items-center gap-2">
                        <XCircle className="w-5 h-5" />
                        Oportunidades Perdidas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {opportunities.filter(o => o.status === "lost").slice(0, 5).map(opp => (
                        <div key={opp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <span>{opp.name}</span>
                          <span className="text-muted-foreground">{opp.lossReason || "Sem motivo"}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* PRODUCTS TAB */}
            <TabsContent value="products" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Catálogo de Produtos e Serviços</h2>
                <Dialog open={showNewProduct} onOpenChange={setShowNewProduct}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-product">
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Produto
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cadastrar Produto/Serviço</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target as HTMLFormElement);
                      createProductMutation.mutate({
                        name: formData.get("name"),
                        description: formData.get("description"),
                        type: formData.get("type"),
                        category: formData.get("category"),
                        price: Math.round(Number(formData.get("price")) * 100) || 0,
                        unit: formData.get("unit"),
                        sku: formData.get("sku")
                      });
                    }} className="space-y-4">
                      <div>
                        <Label htmlFor="productName">Nome</Label>
                        <Input id="productName" name="name" required data-testid="input-product-name" />
                      </div>
                      <div>
                        <Label htmlFor="productDescription">Descrição</Label>
                        <Textarea id="productDescription" name="description" rows={2} data-testid="input-product-description" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="productType">Tipo</Label>
                          <Select name="type" defaultValue="service">
                            <SelectTrigger data-testid="select-product-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="product">Produto</SelectItem>
                              <SelectItem value="service">Serviço</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="productCategory">Categoria</Label>
                          <Input id="productCategory" name="category" data-testid="input-product-category" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="productPrice">Preço (R$)</Label>
                          <Input id="productPrice" name="price" type="number" step="0.01" data-testid="input-product-price" />
                        </div>
                        <div>
                          <Label htmlFor="productUnit">Unidade</Label>
                          <Select name="unit" defaultValue="unit">
                            <SelectTrigger data-testid="select-product-unit">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unit">Unidade</SelectItem>
                              <SelectItem value="hour">Hora</SelectItem>
                              <SelectItem value="month">Mês</SelectItem>
                              <SelectItem value="project">Projeto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="productSku">SKU (opcional)</Label>
                        <Input id="productSku" name="sku" data-testid="input-product-sku" />
                      </div>
                      <Button type="submit" className="w-full" disabled={createProductMutation.isPending} data-testid="button-submit-product">
                        Cadastrar
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(product => (
                  <Card key={product.id} data-testid={`card-product-${product.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteProductMutation.mutate(product.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {product.description && <CardDescription>{product.description}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold">R$ {(product.price / 100).toLocaleString("pt-BR")}</p>
                          <p className="text-sm text-muted-foreground">por {product.unit === "unit" ? "unidade" : product.unit === "hour" ? "hora" : product.unit === "month" ? "mês" : "projeto"}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={product.type === "service" ? "default" : "secondary"} className="capitalize">
                            {product.type === "service" ? "Serviço" : "Produto"}
                          </Badge>
                          {product.category && <p className="text-xs text-muted-foreground mt-1">{product.category}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {products.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum produto ou serviço cadastrado</p>
                      <Button variant="outline" className="mt-4" onClick={() => setShowNewProduct(true)}>
                        Adicionar primeiro produto
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="partners" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Gestão de Parceiros</h2>
                <Dialog open={showNewPartner} onOpenChange={setShowNewPartner}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-partner">
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Parceiro
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cadastrar Parceiro</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target as HTMLFormElement);
                      createPartnerMutation.mutate({
                        name: formData.get("name"),
                        primaryContactName: formData.get("contactName"),
                        email: formData.get("email"),
                        phone: formData.get("phone"),
                        type: formData.get("type"),
                        tier: formData.get("tier"),
                        status: "active"
                      });
                    }} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Nome da Empresa</Label>
                        <Input id="name" name="name" required data-testid="input-partner-name" />
                      </div>
                      <div>
                        <Label htmlFor="contactName">Nome do Contato</Label>
                        <Input id="contactName" name="contactName" data-testid="input-partner-contact" />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" data-testid="input-partner-email" />
                      </div>
                      <div>
                        <Label htmlFor="phone">Telefone</Label>
                        <Input id="phone" name="phone" data-testid="input-partner-phone" />
                      </div>
                      <div>
                        <Label htmlFor="type">Tipo de Parceiro</Label>
                        <Select name="type" defaultValue="referral">
                          <SelectTrigger data-testid="select-partner-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="referral">Indicação</SelectItem>
                            <SelectItem value="solution">Solução</SelectItem>
                            <SelectItem value="technology">Tecnologia</SelectItem>
                            <SelectItem value="service">Serviço</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="tier">Nível</Label>
                        <Select name="tier" defaultValue="partner">
                          <SelectTrigger data-testid="select-partner-tier">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="partner">Parceiro</SelectItem>
                            <SelectItem value="certified">Certificado</SelectItem>
                            <SelectItem value="premier">Premier</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full" disabled={createPartnerMutation.isPending} data-testid="button-submit-partner">
                        Cadastrar
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {partners.map(partner => (
                  <Card key={partner.id} data-testid={`card-partner-${partner.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{partner.name}</CardTitle>
                        <Badge className={`${tierColors[partner.tier]} text-white capitalize`}>{partner.tier}</Badge>
                      </div>
                      <CardDescription>{partner.primaryContactName}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {partner.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {partner.email}
                        </div>
                      )}
                      {partner.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {partner.phone}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-4">
                        <Badge variant={partner.status === "active" ? "default" : "secondary"} className="capitalize">
                          {partner.status}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => convertPartnerToClientMutation.mutate(partner.id)}
                          disabled={convertPartnerToClientMutation.isPending}
                          data-testid={`button-convert-partner-${partner.id}`}
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          Converter para Empresa
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {partners.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="text-center py-8">
                      <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum parceiro cadastrado</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contracts" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Gestão de Contratos</h2>
                <Dialog open={showNewContract} onOpenChange={setShowNewContract}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-contract">
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Contrato
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cadastrar Contrato</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target as HTMLFormElement);
                      createContractMutation.mutate({
                        clientName: formData.get("clientName"),
                        productType: formData.get("productType"),
                        monthlyValue: Number(formData.get("monthlyValue")),
                        recurrenceType: formData.get("recurrenceType"),
                        startDate: formData.get("startDate"),
                        partnerId: formData.get("partnerId") ? Number(formData.get("partnerId")) : undefined,
                        status: "active"
                      });
                    }} className="space-y-4">
                      <div>
                        <Label htmlFor="clientName">Nome da Empresa</Label>
                        <Input id="clientName" name="clientName" required data-testid="input-contract-client" />
                      </div>
                      <div>
                        <Label htmlFor="productType">Tipo de Produto</Label>
                        <Select name="productType" defaultValue="erp_standard">
                          <SelectTrigger data-testid="select-contract-product">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="erp_standard">ERP Standard</SelectItem>
                            <SelectItem value="erp_professional">ERP Professional</SelectItem>
                            <SelectItem value="erp_enterprise">ERP Enterprise</SelectItem>
                            <SelectItem value="bi">Business Intelligence</SelectItem>
                            <SelectItem value="crm">CRM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="monthlyValue">Valor Mensal (R$)</Label>
                        <Input id="monthlyValue" name="monthlyValue" type="number" required data-testid="input-contract-value" />
                      </div>
                      <div>
                        <Label htmlFor="recurrenceType">Tipo de Recorrência</Label>
                        <Select name="recurrenceType" defaultValue="monthly">
                          <SelectTrigger data-testid="select-contract-recurrence">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="annual">Anual</SelectItem>
                            <SelectItem value="perpetual">Perpétuo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="startDate">Data de Início</Label>
                        <Input id="startDate" name="startDate" type="date" required data-testid="input-contract-date" />
                      </div>
                      <div>
                        <Label htmlFor="partnerId">Parceiro (opcional)</Label>
                        <Select name="partnerId">
                          <SelectTrigger data-testid="select-contract-partner">
                            <SelectValue placeholder="Selecione um parceiro" />
                          </SelectTrigger>
                          <SelectContent>
                            {partners.map(p => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full" disabled={createContractMutation.isPending} data-testid="button-submit-contract">
                        Cadastrar
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {contracts.map(contract => (
                  <Card key={contract.id} data-testid={`card-contract-${contract.id}`}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg ${statusColors[contract.status]} flex items-center justify-center text-white`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">{contract.clientName}</p>
                          <p className="text-sm text-muted-foreground">{contract.productType} - {contract.recurrenceType}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">R$ {contract.monthlyValue?.toLocaleString("pt-BR")}/mês</p>
                        <p className="text-sm text-muted-foreground">
                          Início: {new Date(contract.startDate).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <Badge variant={contract.status === "active" ? "default" : "secondary"} className="capitalize ml-4">
                        {contract.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
                {contracts.length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum contrato cadastrado</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="messages" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Conversas</h2>
              </div>

              <div className="space-y-4">
                {threads.map(thread => (
                  <Card key={thread.id} className="cursor-pointer hover:bg-muted/50 transition-colors" data-testid={`card-thread-${thread.id}`}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">{thread.contactName || thread.contactPhone || thread.contactEmail || "Contato"}</p>
                          <p className="text-sm text-muted-foreground">
                            {thread.contactPhone && <span className="mr-2">{thread.contactPhone}</span>}
                            {thread.contactEmail && <span>{thread.contactEmail}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {thread.unreadCount > 0 && (
                          <Badge variant="destructive">{thread.unreadCount}</Badge>
                        )}
                        <Badge variant={thread.status === "open" ? "default" : "secondary"} className="capitalize">
                          {thread.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(thread.lastMessageAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {threads.length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhuma conversa iniciada</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="calendar" className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold">Agenda</h2>
                  {googleStatus?.connected ? (
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Google Calendar conectado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-orange-600">
                      <XCircle className="w-3 h-3 mr-1" />
                      Google Calendar desconectado
                    </Badge>
                  )}
                </div>
                <Dialog open={showNewEvent} onOpenChange={setShowNewEvent}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-event">
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Evento
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Evento</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target as HTMLFormElement);
                      createEventMutation.mutate({
                        title: formData.get("title"),
                        description: formData.get("description"),
                        type: formData.get("type"),
                        startAt: new Date(formData.get("startAt") as string).toISOString(),
                        endAt: formData.get("endAt") ? new Date(formData.get("endAt") as string).toISOString() : undefined,
                        location: formData.get("location")
                      });
                    }} className="space-y-4">
                      <div>
                        <Label htmlFor="title">Título</Label>
                        <Input id="title" name="title" required data-testid="input-event-title" />
                      </div>
                      <div>
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea id="description" name="description" data-testid="input-event-description" />
                      </div>
                      <div>
                        <Label htmlFor="type">Tipo</Label>
                        <Select name="type" defaultValue="meeting">
                          <SelectTrigger data-testid="select-event-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="meeting">Reunião</SelectItem>
                            <SelectItem value="call">Ligação</SelectItem>
                            <SelectItem value="task">Tarefa</SelectItem>
                            <SelectItem value="reminder">Lembrete</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="startAt">Início</Label>
                        <Input id="startAt" name="startAt" type="datetime-local" required data-testid="input-event-start" />
                      </div>
                      <div>
                        <Label htmlFor="endAt">Término</Label>
                        <Input id="endAt" name="endAt" type="datetime-local" data-testid="input-event-end" />
                      </div>
                      <div>
                        <Label htmlFor="location">Local</Label>
                        <Input id="location" name="location" data-testid="input-event-location" />
                      </div>
                      <Button type="submit" className="w-full" disabled={createEventMutation.isPending} data-testid="button-submit-event">
                        Criar Evento
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {events.map(event => (
                  <Card key={event.id} data-testid={`card-event-${event.id}`}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">{event.title}</p>
                          {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{new Date(event.startAt).toLocaleDateString("pt-BR")}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(event.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {event.endAt && ` - ${new Date(event.endAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize ml-4">{event.type}</Badge>
                    </CardContent>
                  </Card>
                ))}
                {events.length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum evento agendado</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* INTEGRATIONS TAB - Frappe Arcádia */}
            <TabsContent value="integrations" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Integrações ERP</h2>
                  <p className="text-muted-foreground">Configure conexões com Frappe Arcádia</p>
                </div>
                <Dialog open={showNewConnector} onOpenChange={setShowNewConnector}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-connector">
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Conexão
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Conectar ao Frappe Arcádia</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target as HTMLFormElement);
                      createConnectorMutation.mutate({
                        name: formData.get("name"),
                        baseUrl: formData.get("baseUrl"),
                        apiKey: formData.get("apiKey"),
                        apiSecret: formData.get("apiSecret"),
                        targetSystem: formData.get("targetSystem"),
                        syncMode: "manual"
                      });
                    }} className="space-y-4">
                      <div>
                        <Label htmlFor="connName">Nome da Conexão</Label>
                        <Input id="connName" name="name" placeholder="Minha Instância Frappe" required data-testid="input-conn-name" />
                      </div>
                      <div>
                        <Label htmlFor="connUrl">URL Base do Frappe</Label>
                        <Input id="connUrl" name="baseUrl" placeholder="https://sua-instancia.erpnext.com" required data-testid="input-conn-url" />
                        <p className="text-xs text-muted-foreground mt-1">URL completa da sua instância Frappe</p>
                      </div>
                      <div>
                        <Label htmlFor="connTarget">Sistema Alvo</Label>
                        <Select name="targetSystem" defaultValue="erpnext">
                          <SelectTrigger data-testid="select-conn-target">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="erpnext">Frappe ERPNext</SelectItem>
                            <SelectItem value="crm_next">Frappe Arcádia CRM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                        <p className="text-sm font-medium">Credenciais de API</p>
                        <p className="text-xs text-muted-foreground">
                          Acesse seu Frappe, vá em Configurações do Usuário, expanda "Acesso API" e clique em "Gerar Chaves"
                        </p>
                        <div>
                          <Label htmlFor="connApiKey">API Key</Label>
                          <Input id="connApiKey" name="apiKey" required data-testid="input-conn-apikey" />
                        </div>
                        <div>
                          <Label htmlFor="connApiSecret">API Secret</Label>
                          <Input id="connApiSecret" name="apiSecret" type="password" required data-testid="input-conn-apisecret" />
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={createConnectorMutation.isPending} data-testid="button-submit-connector">
                        Criar Conexão
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {frappeConnectors.map(connector => (
                  <Card key={connector.id} data-testid={`card-connector-${connector.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connector.status === "active" ? "bg-green-100 text-green-600" : connector.status === "error" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"}`}>
                            <Zap className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{connector.name}</CardTitle>
                            <CardDescription>{connector.baseUrl}</CardDescription>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteConnectorMutation.mutate(connector.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sistema:</span>
                        <Badge variant="outline" className="capitalize">{connector.targetSystem === "erpnext" ? "ERPNext" : "Arcádia CRM"}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={connector.status === "active" ? "default" : connector.status === "error" ? "destructive" : "secondary"}>
                          {connector.status === "active" ? "Conectado" : connector.status === "error" ? "Erro" : "Inativo"}
                        </Badge>
                      </div>
                      {connector.lastSyncAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Última Sincronização:</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(connector.lastSyncAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      )}
                      {connector.errorMessage && (
                        <div className="p-2 bg-red-50 rounded text-sm text-red-600 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{connector.errorMessage}</span>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => testConnectorMutation.mutate(connector.id)}
                          disabled={testConnectorMutation.isPending}
                          data-testid={`button-test-connector-${connector.id}`}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Testar
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => syncConnectorMutation.mutate(connector.id)}
                          disabled={syncConnectorMutation.isPending || connector.status !== "active"}
                          data-testid={`button-sync-connector-${connector.id}`}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sincronizar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {frappeConnectors.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="text-center py-12">
                      <Link2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold mb-2">Nenhuma integração configurada</h3>
                      <p className="text-muted-foreground mb-4">
                        Conecte seu Arcádia CRM ao Frappe Arcádia para sincronizar leads, oportunidades e produtos.
                      </p>
                      <Button variant="outline" onClick={() => setShowNewConnector(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Configurar Primeira Conexão
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sobre a Integração Frappe</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>A integração com Frappe Arcádia permite sincronizar:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Leads</strong> → DocType "Lead" no Frappe</li>
                    <li><strong>Oportunidades</strong> → DocType "Opportunity" no Frappe</li>
                    <li><strong>Produtos</strong> → DocType "Item" no Frappe</li>
                    <li><strong>Parceiros</strong> → DocType "Supplier" no Frappe</li>
                  </ul>
                  <p className="pt-2">Para obter as credenciais de API, acesse sua instância Frappe e vá em:</p>
                  <code className="block bg-muted p-2 rounded text-xs">
                    Configurações → Usuário → [Seu Usuário] → Acesso API → Gerar Chaves
                  </code>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              {!canAccessSettings ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Settings className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-semibold mb-2">Acesso Restrito</h3>
                    <p className="text-muted-foreground">
                      Apenas administradores podem acessar as configurações do sistema.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* ── Stats cards ──────────────────────────────────── */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSettingsTab("usuarios")} data-testid="card-stat-usuarios">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{adminStats?.users?.total ?? tenantUsers.length}</div>
                          <p className="text-xs text-muted-foreground">Usuários</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSettingsTab("perfis")} data-testid="card-stat-perfis">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <Shield className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{adminStats?.profiles?.total ?? rbacRoles.length}</div>
                          <p className="text-xs text-muted-foreground">Perfis</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSettingsTab("parceiros")} data-testid="card-stat-parceiros">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Award className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{adminStats?.partners?.total ?? partners.length}</div>
                          <p className="text-xs text-muted-foreground">Parceiros</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSettingsTab("empresas")} data-testid="card-stat-empresas">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{adminStats?.clients?.total ?? clients.length}</div>
                          <p className="text-xs text-muted-foreground">Empresas</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* ── Sub-abas estilo Multi-Tenants ─────────────────── */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 border-b w-full pb-0">
                      {[
                        { key: "usuarios",  label: "Usuários",  Icon: Users },
                        { key: "perfis",    label: "Perfis",    Icon: Shield },
                        { key: "parceiros", label: "Parceiros", Icon: Award },
                        { key: "empresas",  label: "Empresas",  Icon: Building2 },
                      ].map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          data-testid={`subtab-settings-${key}`}
                          onClick={() => setSettingsTab(key)}
                          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            settingsTab === key
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                    {/* Botão contextual por sub-aba */}
                    {settingsTab === "usuarios" && (can("admin.usuarios.write") || isAdmin) && (
                      <Button size="sm" className="ml-3 flex-shrink-0" onClick={() => setShowConvite(true)} data-testid="btn-convidar-usuario">
                        <Plus className="h-4 w-4 mr-1" /> Novo Usuário
                      </Button>
                    )}
                    {settingsTab === "perfis" && (can("admin.perfis.admin") || isAdmin) && (
                      <Button size="sm" className="ml-3 flex-shrink-0" onClick={() => setShowNovoPerfil(true)} data-testid="btn-novo-perfil">
                        <Plus className="h-4 w-4 mr-1" /> Novo Perfil
                      </Button>
                    )}
                  </div>

                  {/* ── Conteúdo: Usuários ───────────────────────────── */}
                  {settingsTab === "usuarios" && (
                    <Card>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {tenantUsers.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                              <Users className="h-10 w-10 text-muted-foreground mb-3" />
                              <p className="font-medium">Nenhum usuário cadastrado</p>
                              <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Usuário" para convidar alguém.</p>
                            </div>
                          )}
                          {tenantUsers.map((u: any) => (
                            <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30" data-testid={`row-usuario-${u.id}`}>
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-primary">
                                {(u.name ?? u.username ?? "?")[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{u.name ?? u.username}</p>
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                              </div>
                              {u.tenantRole && (
                                <Badge variant="outline" className="text-xs hidden md:flex capitalize">{u.tenantRole}</Badge>
                              )}
                              {u.perfilNome && (
                                <Badge className="text-xs bg-violet-100 text-violet-700 hidden sm:flex">
                                  <Shield className="h-3 w-3 mr-1" />{u.perfilNome}
                                </Badge>
                              )}
                              <div className="flex gap-1 flex-shrink-0">
                                {u.empresas?.length > 0
                                  ? u.empresas.slice(0,1).map((e: any) => (
                                      <Badge key={e.id} variant="outline" className="text-xs">
                                        <Building2 className="h-3 w-3 mr-1" />{e.nomeFantasia ?? e.razaoSocial}
                                      </Badge>
                                    ))
                                  : <Badge variant="outline" className="text-xs text-muted-foreground">Todas</Badge>
                                }
                              </div>
                              {u.status === "active"
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
                              {(can("admin.usuarios.admin") || isAdmin) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`menu-usuario-${u.id}`}>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => abrirEditUsuario(u)}>
                                      <Edit className="h-4 w-4 mr-2" /> Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => toggleTenantUserStatusMutation.mutate({
                                        userId: u.id,
                                        status: u.status === "active" ? "inactive" : "active",
                                      })}
                                      className={u.status === "active" ? "text-amber-600" : "text-emerald-600"}
                                    >
                                      {u.status === "active" ? "Inativar" : "Reativar"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setDeleteUsuarioConfirm(u)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* ── Conteúdo: Perfis ─────────────────────────────── */}
                  {settingsTab === "perfis" && (
                    <>
                      <Card>
                        <CardContent className="p-0">
                          <div className="divide-y">
                            {rbacRoles.length === 0 && (
                              <div className="flex flex-col items-center py-16 text-center">
                                <Shield className="h-10 w-10 text-muted-foreground mb-3" />
                                <p className="text-sm text-muted-foreground">Nenhum perfil cadastrado.</p>
                              </div>
                            )}
                            {rbacRoles.map((role: any) => (
                              <div key={role.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30" data-testid={`row-perfil-${role.id}`}>
                                <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                                  <Shield className="h-4 w-4 text-violet-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">{role.name}</p>
                                    {role.is_system === 1 && <Badge variant="outline" className="text-xs">Sistema</Badge>}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">{role.description}</p>
                                </div>
                                {(can("admin.perfis.admin") || isAdmin) && (
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <Button variant="ghost" size="sm" className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                      onClick={() => openEditPerfil(role, "permissoes")}
                                      data-testid={`btn-permissoes-perfil-${role.id}`}>
                                      <Shield className="h-3.5 w-3.5 mr-1" /> Permissões
                                    </Button>
                                    <Button variant="outline" size="sm"
                                      onClick={() => openEditPerfil(role, "info")}
                                      data-testid={`btn-editar-perfil-${role.id}`}>
                                      <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* ── Dialog de edição de perfil + matriz de permissões ── */}
                      <Dialog open={editPerfilId !== null} onOpenChange={open => { if (!open) { setEditPerfilId(null); setLastSyncedRoleId(null); } }}>
                        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="dialog-editar-perfil">
                          <DialogHeader>
                            <DialogTitle>Editar Perfil — {editPerfilForm.name}</DialogTitle>
                          </DialogHeader>

                          {/* mini tab bar dentro do dialog */}
                          <div className="flex gap-1 border-b">
                            {(["info", "permissoes"] as const).map(t => (
                              <button key={t} onClick={() => setEditPerfilTab(t)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${editPerfilTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                                {t === "info" ? "Informações" : `Permissões (${editPerfilCodes.size})`}
                              </button>
                            ))}
                          </div>

                          <div className="overflow-y-auto flex-1 py-2">
                            {editPerfilTab === "info" && (
                              <div className="space-y-3 px-1">
                                <div className="space-y-1">
                                  <Label>Nome do perfil</Label>
                                  <Input value={editPerfilForm.name}
                                    onChange={e => setEditPerfilForm({ ...editPerfilForm, name: e.target.value })}
                                    data-testid="input-perfil-nome" />
                                </div>
                                <div className="space-y-1">
                                  <Label>Descrição</Label>
                                  <Textarea value={editPerfilForm.description}
                                    onChange={e => setEditPerfilForm({ ...editPerfilForm, description: e.target.value })}
                                    rows={2} data-testid="input-perfil-descricao" />
                                </div>
                              </div>
                            )}

                            {editPerfilTab === "permissoes" && (() => {
                              if (loadingPerms) return (
                                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                  <span className="text-sm">Carregando permissões…</span>
                                </div>
                              );

                              if (allPermissions.length === 0) return (
                                <div className="flex flex-col items-center py-12 gap-3 text-center">
                                  <Shield className="h-10 w-10 text-muted-foreground" />
                                  <p className="text-sm font-medium">Nenhuma permissão granular cadastrada</p>
                                  <p className="text-xs text-muted-foreground max-w-xs">
                                    Execute o seed de permissões para carregar as 85 permissões padrão do sistema.
                                  </p>
                                  <Button size="sm" variant="outline"
                                    onClick={async () => {
                                      await fetch("/api/admin/rbac/seed", { method: "POST", credentials: "include" });
                                      refetchPerms();
                                    }}>
                                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                                    Seed Permissões
                                  </Button>
                                </div>
                              );

                              // Agrupar permissões por módulo → grupo
                              const byModule: Record<string, Record<string, any[]>> = {};
                              allPermissions.forEach((p: any) => {
                                if (!byModule[p.module]) byModule[p.module] = {};
                                const grp = p.grupo ?? "Geral";
                                if (!byModule[p.module][grp]) byModule[p.module][grp] = [];
                                byModule[p.module][grp].push(p);
                              });

                              // Selecionar/deselecionar tudo por módulo
                              const allCodes = allPermissions.map((p: any) => p.code);
                              const selectedAll = allCodes.every((c: string) => editPerfilCodes.has(c));

                              return (
                                <div className="space-y-4 px-1">
                                  <div className="flex items-center justify-between pb-1">
                                    <span className="text-xs text-muted-foreground">{allPermissions.length} permissões disponíveis — {editPerfilCodes.size} selecionadas</span>
                                    <button
                                      className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                                      onClick={() => setEditPerfilCodes(selectedAll ? new Set() : new Set(allCodes))}>
                                      {selectedAll ? "Desmarcar tudo" : "Marcar tudo"}
                                    </button>
                                  </div>
                                  {Object.entries(byModule).map(([mod, grupos]) => {
                                    const modCodes = Object.values(grupos).flat().map((p: any) => p.code);
                                    const modAllSelected = modCodes.every(c => editPerfilCodes.has(c));
                                    return (
                                      <div key={mod}>
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="h-px flex-1 bg-border" />
                                          <button
                                            className="text-xs font-semibold uppercase text-muted-foreground px-2 hover:text-violet-600 transition-colors"
                                            title={modAllSelected ? "Desmarcar módulo" : "Marcar módulo"}
                                            onClick={() => setEditPerfilCodes(prev => {
                                              const next = new Set(prev);
                                              modAllSelected ? modCodes.forEach(c => next.delete(c)) : modCodes.forEach(c => next.add(c));
                                              return next;
                                            })}>
                                            {mod}
                                          </button>
                                          <div className="h-px flex-1 bg-border" />
                                        </div>
                                        {Object.entries(grupos).map(([grp, perms]) => (
                                          <div key={grp} className="mb-3">
                                            <p className="text-xs font-medium text-muted-foreground mb-1 ml-1">{grp}</p>
                                            <div className="grid grid-cols-1 gap-0.5">
                                              {(perms as any[]).map((p: any) => (
                                                <label key={p.code}
                                                  className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer hover:bg-muted/50 ${editPerfilCodes.has(p.code) ? "bg-violet-50 dark:bg-violet-950/30" : ""}`}
                                                  data-testid={`toggle-perm-${p.code}`}>
                                                  <div className="flex-1 min-w-0">
                                                    <span className="text-sm">{p.name}</span>
                                                    <span className="text-xs text-muted-foreground ml-2 font-mono">{p.code}</span>
                                                  </div>
                                                  <div className={`w-9 h-5 rounded-full flex-shrink-0 transition-colors relative ${editPerfilCodes.has(p.code) ? "bg-violet-600" : "bg-muted"}`}
                                                    onClick={() => togglePermCode(p.code)}>
                                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${editPerfilCodes.has(p.code) ? "translate-x-4" : "translate-x-0.5"}`} />
                                                  </div>
                                                </label>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          <DialogFooter className="pt-2 border-t">
                            <Button variant="outline" onClick={() => { setEditPerfilId(null); setLastSyncedRoleId(null); }}>Cancelar</Button>
                            <Button
                              disabled={salvarPerfilMutation.isPending}
                              onClick={() => salvarPerfilMutation.mutate({
                                id: editPerfilId!,
                                name: editPerfilForm.name,
                                description: editPerfilForm.description,
                                codes: Array.from(editPerfilCodes),
                              })}
                              data-testid="btn-salvar-perfil">
                              {salvarPerfilMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                              Salvar Perfil
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* ── Dialog novo perfil ── */}
                      <Dialog open={showNovoPerfil} onOpenChange={setShowNovoPerfil}>
                        <DialogContent data-testid="dialog-novo-perfil">
                          <DialogHeader><DialogTitle>Novo Perfil</DialogTitle></DialogHeader>
                          <div className="space-y-3 py-1">
                            <div className="space-y-1">
                              <Label>Nome *</Label>
                              <Input value={novoPerfilForm.name}
                                onChange={e => setNovoPerfilForm({ ...novoPerfilForm, name: e.target.value })}
                                placeholder="Ex: Analista Comercial" data-testid="input-novo-perfil-nome" />
                            </div>
                            <div className="space-y-1">
                              <Label>Descrição</Label>
                              <Textarea value={novoPerfilForm.description}
                                onChange={e => setNovoPerfilForm({ ...novoPerfilForm, description: e.target.value })}
                                rows={2} placeholder="Acesso a..." data-testid="input-novo-perfil-desc" />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowNovoPerfil(false)}>Cancelar</Button>
                            <Button disabled={criarPerfilMutation.isPending || !novoPerfilForm.name}
                              onClick={() => criarPerfilMutation.mutate(novoPerfilForm)}
                              data-testid="btn-criar-perfil">
                              {criarPerfilMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                              Criar Perfil
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}

                  {/* ── Conteúdo: Parceiros ───────────────────────────── */}
                  {settingsTab === "parceiros" && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle>Parceiros</CardTitle>
                        <CardDescription>Ative ou desative parceiros do sistema</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {partners.length === 0 && (
                            <div className="flex flex-col items-center py-16 text-center">
                              <Award className="h-10 w-10 text-muted-foreground mb-3" />
                              <p className="text-sm text-muted-foreground">Nenhum parceiro cadastrado.</p>
                            </div>
                          )}
                          {partners.map((partner) => (
                            <div key={partner.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Award className="h-4 w-4 text-amber-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{partner.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{partner.email}</p>
                              </div>
                              <Badge variant={partner.status === "active" ? "default" : "destructive"} className="flex-shrink-0">
                                {partner.status === "active" ? "Ativo" : "Inativo"}
                              </Badge>
                              <Button
                                variant="outline" size="sm" className="flex-shrink-0"
                                onClick={() => updatePartnerStatusMutation.mutate({ id: partner.id, status: partner.status === "active" ? "inactive" : "active" })}
                              >
                                {partner.status === "active" ? "Desativar" : "Ativar"}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* ── Conteúdo: Empresas ───────────────────────────── */}
                  {settingsTab === "empresas" && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle>Empresas</CardTitle>
                        <CardDescription>Ative ou desative empresas do sistema</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {clients.length === 0 && (
                            <div className="flex flex-col items-center py-16 text-center">
                              <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
                              <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
                            </div>
                          )}
                          {clients.map((client) => (
                            <div key={client.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <Building2 className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{client.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                                {client.partnerId && (
                                  <p className="text-xs text-blue-600 truncate">
                                    Parceiro: {partners.find(p => p.id === client.partnerId)?.name ?? "N/A"}
                                  </p>
                                )}
                              </div>
                              <Badge variant={client.status === "active" ? "default" : "destructive"} className="flex-shrink-0">
                                {client.status === "active" ? "Ativo" : "Inativo"}
                              </Badge>
                              <Button
                                variant="outline" size="sm" className="flex-shrink-0"
                                onClick={() => updateClientStatusMutation.mutate({ id: client.id, status: client.status === "active" ? "inactive" : "active" })}
                              >
                                {client.status === "active" ? "Desativar" : "Ativar"}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Dialog de Convite */}
                  <Dialog open={showConvite} onOpenChange={setShowConvite}>
                    <DialogContent data-testid="dialog-convidar-usuario">
                      <DialogHeader>
                        <DialogTitle>Novo Usuário</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 py-1">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Nome completo *</Label>
                            <Input value={conviteForm.name}
                              onChange={e => setConviteForm({...conviteForm, name: e.target.value})}
                              placeholder="Ex: Ana Silva" data-testid="input-usuario-nome" />
                          </div>
                          <div className="space-y-1">
                            <Label>Email *</Label>
                            <Input type="email" value={conviteForm.email}
                              onChange={e => setConviteForm({...conviteForm, email: e.target.value})}
                              placeholder="ana@empresa.com" data-testid="input-usuario-email" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Login *</Label>
                            <Input value={conviteForm.username}
                              onChange={e => setConviteForm({...conviteForm, username: e.target.value})}
                              placeholder="ana.silva" data-testid="input-usuario-username" />
                          </div>
                          <div className="space-y-1">
                            <Label>Senha inicial *</Label>
                            <Input type="password" value={conviteForm.password}
                              onChange={e => setConviteForm({...conviteForm, password: e.target.value})}
                              data-testid="input-usuario-senha" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Perfil de acesso *</Label>
                          <Select value={conviteForm.perfilId} onValueChange={v => setConviteForm({...conviteForm, perfilId: v})}>
                            <SelectTrigger data-testid="select-usuario-perfil">
                              <SelectValue placeholder="Selecione um perfil..." />
                            </SelectTrigger>
                            <SelectContent>
                              {rbacRoles.map((r: any) => (
                                <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {empresasGrupo.length > 0 && (
                          <div className="space-y-1">
                            <Label>Empresas do Usuário <span className="text-muted-foreground text-xs">(sem seleção = acesso a todas)</span></Label>
                            <div className="border rounded-lg p-3 space-y-2">
                              {empresasGrupo.map((e: any) => (
                                <div key={e.id} className="flex items-center justify-between">
                                  <span className="text-sm">{e.nomeFantasia ?? e.razaoSocial}</span>
                                  <Switch
                                    checked={conviteForm.empresasIds.includes(e.id)}
                                    onCheckedChange={() => toggleConviteEmpresa(e.id)}
                                    data-testid={`switch-empresa-${e.id}`}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConvite(false)}>Cancelar</Button>
                        <Button
                          onClick={() => cadastrarUsuarioMutation.mutate(conviteForm)}
                          disabled={cadastrarUsuarioMutation.isPending || !conviteForm.name || !conviteForm.email || !conviteForm.username || !conviteForm.perfilId}
                          data-testid="btn-salvar-convite"
                        >
                          {cadastrarUsuarioMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Cadastrar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Dialog de Edição */}
                  <Dialog open={!!editUsuario} onOpenChange={v => !v && setEditUsuario(null)}>
                    <DialogContent data-testid="dialog-editar-usuario">
                      <DialogHeader>
                        <DialogTitle>Editar Usuário</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                          {editUsuario?.username && <span>Login: <strong>{editUsuario.username}</strong></span>}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 py-1">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Nome completo</Label>
                            <Input value={editUsuarioForm.name}
                              onChange={e => setEditUsuarioForm({...editUsuarioForm, name: e.target.value})}
                              placeholder="Nome completo" data-testid="input-edit-nome" />
                          </div>
                          <div className="space-y-1">
                            <Label>Email</Label>
                            <Input type="email" value={editUsuarioForm.email}
                              onChange={e => setEditUsuarioForm({...editUsuarioForm, email: e.target.value})}
                              placeholder="email@empresa.com" data-testid="input-edit-email" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Nova senha <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                            <Input type="password" value={editUsuarioForm.password}
                              onChange={e => setEditUsuarioForm({...editUsuarioForm, password: e.target.value})}
                              placeholder="Deixe em branco para manter" data-testid="input-edit-senha" />
                          </div>
                          <div className="space-y-1">
                            <Label>Perfil de acesso</Label>
                            <Select value={editUsuarioForm.perfilId} onValueChange={v => setEditUsuarioForm({...editUsuarioForm, perfilId: v})}>
                              <SelectTrigger data-testid="select-edit-perfil">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {rbacRoles.map((r: any) => (
                                  <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {empresasGrupo.length > 0 && (
                          <div className="space-y-1">
                            <Label>Empresas do Usuário <span className="text-muted-foreground text-xs">(sem seleção = acesso a todas)</span></Label>
                            <div className="border rounded-lg p-3 space-y-2">
                              {empresasGrupo.map((e: any) => (
                                <div key={e.id} className="flex items-center justify-between">
                                  <span className="text-sm">{e.nomeFantasia ?? e.razaoSocial}</span>
                                  <Switch
                                    checked={editUsuarioForm.empresasIds.includes(e.id)}
                                    onCheckedChange={() => toggleEditEmpresa(e.id)}
                                    data-testid={`switch-edit-empresa-${e.id}`}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditUsuario(null)}>Cancelar</Button>
                        <Button
                          onClick={() => editarUsuarioMutation.mutate(editUsuarioForm)}
                          disabled={editarUsuarioMutation.isPending}
                          data-testid="btn-salvar-edicao"
                        >
                          {editarUsuarioMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Salvar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Confirmação de Exclusão */}
                  <AlertDialog open={!!deleteUsuarioConfirm} onOpenChange={v => !v && setDeleteUsuarioConfirm(null)}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O usuário <strong>{deleteUsuarioConfirm?.name}</strong> será removido do sistema.
                          {" "}Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deletarUsuarioMutation.mutate(deleteUsuarioConfirm?.id)}
                          data-testid="btn-confirmar-exclusao"
                        >
                          {deletarUsuarioMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </TabsContent>

            <TabsContent value="multitenant" className="space-y-4">
              <MultiTenantSection />
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </BrowserFrame>
  );
}
