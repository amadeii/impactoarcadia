import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Package,
  Users,
  Truck,
  ShoppingCart,
  FileText,
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  Receipt,
  BookOpen,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  BarChart3,
  Building2,
  Package2,
  TrendingUp,
  Cloud,
  CloudOff,
  Database,
  Loader2,
  Target,
  Briefcase,
  Calculator,
  FolderKanban,
  UserCog,
  AlertTriangle,
  Pencil,
  Smartphone,
  Wallet,
  ExternalLink
} from "lucide-react";
import { useLocation } from "wouter";
import { useErpProfile, ErpProfile } from "@/contexts/ErpProfileContext";

type TabType = "dashboard" | "persons" | "customers" | "suppliers" | "products" | "sales" | "purchases" | "crm" | "accounting" | "projects" | "hr" | "config";

interface Customer {
  id: number;
  code: string;
  name: string;
  type: string;
  taxId: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  status: string;
  creditLimit: string;
}

interface Supplier {
  id: number;
  code: string;
  name: string;
  taxId: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  status: string;
}

interface Product {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  costPrice: string;
  salePrice: string;
  stockQty: string;
  minStock: string;
  ncm: string;
  barcode?: string;
  taxGroupId?: number;
  taxGroupName?: string;
  status: string;
  requiresSerialTracking?: boolean;
  trackingType?: string;
  defaultBrand?: string;
  defaultModel?: string;
}

interface TaxGroup {
  id: number;
  nome: string;
  ncm: string;
  cstIcms: string;
  aliqIcms: string;
}

interface SalesOrder {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName?: string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
}

interface PurchaseOrder {
  id: number;
  orderNumber: string;
  supplierId: number;
  supplierName?: string;
  orderDate: string;
  expectedDate: string;
  status: string;
  subtotal: string;
  total: string;
}

interface ERPNextStatus {
  connected: boolean;
  message: string;
  user?: string;
  url?: string;
}

interface ERPNextCustomer {
  name: string;
  customer_name: string;
  customer_type: string;
  customer_group?: string;
  territory?: string;
  tax_id?: string;
  email_id?: string;
  mobile_no?: string;
  disabled?: number;
}

interface ERPNextSupplier {
  name: string;
  supplier_name: string;
  supplier_type?: string;
  supplier_group?: string;
  tax_id?: string;
  email_id?: string;
  mobile_no?: string;
  disabled?: number;
}

interface ERPNextItem {
  name: string;
  item_code: string;
  item_name: string;
  item_group?: string;
  stock_uom?: string;
  description?: string;
  standard_rate?: number;
  valuation_rate?: number;
  disabled?: number;
}

interface ERPNextSalesOrder {
  name: string;
  customer: string;
  customer_name?: string;
  transaction_date: string;
  delivery_date?: string;
  status: string;
  grand_total: number;
  net_total: number;
}

interface ERPNextLead {
  name: string;
  lead_name: string;
  company_name?: string;
  email_id?: string;
  mobile_no?: string;
  status: string;
  source?: string;
}

interface ERPNextOpportunity {
  name: string;
  party_name: string;
  opportunity_type?: string;
  status: string;
  expected_closing?: string;
  opportunity_amount?: number;
}

interface ErpSegment {
  id: number;
  code: string;
  name: string;
  category: string;
  description?: string;
  modules?: string[];
  features?: Record<string, boolean>;
}

interface ErpConfigData {
  id?: number;
  tenantId?: number;
  segmentId?: number;
  companyName?: string;
  tradeName?: string;
  taxId?: string;
  stateRegistration?: string;
  cityRegistration?: string;
  taxRegime?: string;
  modulesCrm?: number;
  modulesSales?: number;
  modulesPurchases?: number;
  modulesStock?: number;
  modulesFinance?: number;
  modulesAccounting?: number;
  modulesProduction?: number;
  modulesProjects?: number;
  modulesHr?: number;
  modulesServiceOrder?: number;
}

const api = {
  get: async (url: string) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  },
  post: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  },
  put: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  },
  delete: async (url: string) => {
    const res = await fetch(url, { method: "DELETE", credentials: "include" });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  },
};

function PersonsTab() {
  const { toast } = useToast();
  const [persons, setPersons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [formData, setFormData] = useState({
    fullName: "", cpfCnpj: "", email: "", phone: "", whatsapp: "",
    address: "", city: "", state: "", zipCode: "", notes: "", roles: [] as string[]
  });

  const loadPersons = async () => {
    try {
      setLoading(true);
      let url = "/api/erp/persons";
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (roleFilter && roleFilter !== "all") params.append("role", roleFilter);
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPersons(data);
      }
    } catch (error) {
      console.error("Error loading persons:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPersons(); }, [search, roleFilter]);

  const handleEdit = (person: any) => {
    setEditingPerson(person);
    setFormData({
      fullName: person.fullName || "",
      cpfCnpj: person.cpfCnpj || "",
      email: person.email || "",
      phone: person.phone || "",
      whatsapp: person.whatsapp || "",
      address: person.address || "",
      city: person.city || "",
      state: person.state || "",
      zipCode: person.zipCode || "",
      notes: person.notes || "",
      roles: Array.isArray(person.roles) ? (typeof person.roles[0] === 'string' ? person.roles : person.roles.map((r: any) => r.roleType || r)) : []
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      const method = editingPerson ? "PUT" : "POST";
      const url = editingPerson ? `/api/erp/persons/${editingPerson.id}` : "/api/erp/persons";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, roles: formData.roles }),
        credentials: "include"
      });

      if (res.ok) {
        toast({ title: editingPerson ? "Pessoa atualizada!" : "Pessoa cadastrada!" });
        setShowDialog(false);
        setEditingPerson(null);
        setFormData({ fullName: "", cpfCnpj: "", email: "", phone: "", whatsapp: "", address: "", city: "", state: "", zipCode: "", notes: "", roles: [] });
        loadPersons();
      } else {
        toast({ title: "Erro ao salvar pessoa", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro ao salvar pessoa", variant: "destructive" });
    }
  };

  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter(r => r !== role) : [...prev.roles, role]
    }));
  };

  const roleLabels: Record<string, string> = {
    customer: "Cliente", supplier: "Fornecedor", employee: "Funcionário",
    technician: "Técnico", partner: "Parceiro"
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar pessoas..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Filtrar por papel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="customer">Clientes</SelectItem>
              <SelectItem value="supplier">Fornecedores</SelectItem>
              <SelectItem value="employee">Funcionários</SelectItem>
              <SelectItem value="technician">Técnicos</SelectItem>
              <SelectItem value="partner">Parceiros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditingPerson(null); setFormData({ fullName: "", cpfCnpj: "", email: "", phone: "", whatsapp: "", address: "", city: "", state: "", zipCode: "", notes: "", roles: [] }); setShowDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova Pessoa
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Papéis</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : persons.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma pessoa cadastrada</TableCell></TableRow>
              ) : (
                persons.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">{person.fullName}</TableCell>
                    <TableCell>{person.cpfCnpj}</TableCell>
                    <TableCell>{person.phone || person.whatsapp}</TableCell>
                    <TableCell>{person.city}/{person.state}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {(Array.isArray(person.roles) ? person.roles : []).map((role: any, idx: number) => {
                          const roleType = typeof role === 'string' ? role : role.roleType;
                          return <Badge key={idx} variant="outline" className="text-xs">{roleLabels[roleType] || roleType}</Badge>;
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(person)}><Edit className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPerson ? "Editar Pessoa" : "Nova Pessoa"}</DialogTitle>
            <DialogDescription>Cadastro unificado de pessoas - uma pessoa pode ter múltiplos papéis</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome Completo</Label><Input value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} /></div>
              <div><Label>CPF/CNPJ</Label><Input value={formData.cpfCnpj} onChange={(e) => setFormData({...formData, cpfCnpj: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>E-mail</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
              <div><Label>Telefone</Label><Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Cidade</Label><Input value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} /></div>
              <div><Label>Estado</Label><Input value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} /></div>
              <div><Label>CEP</Label><Input value={formData.zipCode} onChange={(e) => setFormData({...formData, zipCode: e.target.value})} /></div>
            </div>
            <div>
              <Label>Papéis</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {Object.entries(roleLabels).map(([key, label]) => (
                  <Button key={key} type="button" variant={formData.roles.includes(key) ? "default" : "outline"} size="sm" onClick={() => toggleRole(key)}>{label}</Button>
                ))}
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ERP() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showSalesDialog, setShowSalesDialog] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showBatchImeiDialog, setShowBatchImeiDialog] = useState(false);
  const [selectedProductForDevices, setSelectedProductForDevices] = useState<Product | null>(null);
  const [batchImeiText, setBatchImeiText] = useState("");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { profile: erpProfile, setProfile: setErpProfile, usePlus, useERPNext } = useErpProfile();

  const tenantId = (user as any)?.tenantId || 1;

  const { data: erpnextStatus, isLoading: loadingStatus, refetch: refetchStatus } = useQuery<ERPNextStatus>({
    queryKey: ["/api/erpnext/status"],
    queryFn: () => api.get("/api/erpnext/status"),
    retry: false,
  });

  const isERPNextConnected = erpnextStatus?.connected || false;

  // Auto-switch to ERPNext if connected and no profile saved
  useEffect(() => {
    if (isERPNextConnected && !localStorage.getItem("arcadia_erp_profile")) {
      setErpProfile("erpnext");
    }
  }, [isERPNextConnected]);

  const { data: erpnextCustomers = [] } = useQuery<ERPNextCustomer[]>({
    queryKey: ["/api/erpnext/resource/Customer"],
    queryFn: async () => {
      const res = await api.get("/api/erpnext/resource/Customer?limit=100");
      return res.data || [];
    },
    enabled: useERPNext && isERPNextConnected,
  });

  const { data: erpnextSuppliers = [] } = useQuery<ERPNextSupplier[]>({
    queryKey: ["/api/erpnext/resource/Supplier"],
    queryFn: async () => {
      const res = await api.get("/api/erpnext/resource/Supplier?limit=100");
      return res.data || [];
    },
    enabled: useERPNext && isERPNextConnected,
  });

  const { data: erpnextItems = [] } = useQuery<ERPNextItem[]>({
    queryKey: ["/api/erpnext/resource/Item"],
    queryFn: async () => {
      const res = await api.get("/api/erpnext/resource/Item?limit=100");
      return res.data || [];
    },
    enabled: useERPNext && isERPNextConnected,
  });

  const { data: erpnextSalesOrders = [] } = useQuery<ERPNextSalesOrder[]>({
    queryKey: ["/api/erpnext/resource/Sales Order"],
    queryFn: async () => {
      const res = await api.get("/api/erpnext/resource/Sales%20Order?limit=100");
      return res.data || [];
    },
    enabled: useERPNext && isERPNextConnected,
  });

  const { data: erpnextLeads = [] } = useQuery<ERPNextLead[]>({
    queryKey: ["/api/erpnext/resource/Lead"],
    queryFn: async () => {
      const res = await api.get("/api/erpnext/resource/Lead?limit=100");
      return res.data || [];
    },
    enabled: useERPNext && isERPNextConnected,
  });

  const { data: erpnextOpportunities = [] } = useQuery<ERPNextOpportunity[]>({
    queryKey: ["/api/erpnext/resource/Opportunity"],
    queryFn: async () => {
      const res = await api.get("/api/erpnext/resource/Opportunity?limit=100");
      return res.data || [];
    },
    enabled: useERPNext && isERPNextConnected,
  });

  // Plus ERP Queries
  const { data: plusStats } = useQuery({
    queryKey: ["/plus/api/suite/stats"],
    queryFn: () => api.get("/plus/api/suite/stats"),
    enabled: usePlus,
  });

  const { data: plusClientes = [] } = useQuery<any[]>({
    queryKey: ["/plus/api/suite/clientes"],
    queryFn: async () => {
      const res = await api.get("/plus/api/suite/clientes");
      return res || [];
    },
    enabled: usePlus,
  });

  const { data: plusFornecedores = [] } = useQuery<any[]>({
    queryKey: ["/plus/api/suite/fornecedores"],
    queryFn: async () => {
      const res = await api.get("/plus/api/suite/fornecedores");
      return res || [];
    },
    enabled: usePlus,
  });

  const { data: plusProdutos = [] } = useQuery<any[]>({
    queryKey: ["/plus/api/suite/produtos"],
    queryFn: async () => {
      const res = await api.get("/plus/api/suite/produtos");
      return res || [];
    },
    enabled: usePlus,
  });

  const { data: plusVendas = [] } = useQuery<any[]>({
    queryKey: ["/plus/api/suite/vendas"],
    queryFn: async () => {
      const res = await api.get("/plus/api/suite/vendas");
      return res || [];
    },
    enabled: usePlus,
  });

  const { data: plusDashboard } = useQuery<any>({
    queryKey: ["/plus/api/suite/dashboard"],
    queryFn: async () => {
      const res = await api.get("/plus/api/suite/dashboard");
      return res || {};
    },
    enabled: usePlus,
  });

  const { data: plusEmpresas = [] } = useQuery<any[]>({
    queryKey: ["/plus/api/suite/empresas"],
    queryFn: async () => {
      const res = await api.get("/plus/api/suite/empresas");
      return res || [];
    },
    enabled: usePlus,
  });

  // Unified data - adapts from Plus or ERPNext to common format
  const customers: Customer[] = usePlus 
    ? (plusClientes || []).map((c: any) => ({
        id: c.id,
        code: String(c.id),
        name: c.razao_social || c.nome,
        type: c.cpf_cnpj?.length > 14 ? "PJ" : "PF",
        taxId: c.cpf_cnpj || "",
        email: c.email || "",
        phone: c.celular || c.telefone || "",
        city: c.cidade || "",
        state: c.uf || "",
        status: c.status === "ativo" ? "active" : "inactive",
        creditLimit: "0",
      }))
    : [];

  const suppliers: Supplier[] = usePlus
    ? (plusFornecedores || []).map((f: any) => ({
        id: f.id,
        code: String(f.id),
        name: f.razao_social || f.nome,
        type: f.cpf_cnpj?.length > 14 ? "PJ" : "PF",
        taxId: f.cpf_cnpj || "",
        email: f.email || "",
        phone: f.telefone || "",
        city: f.cidade || "",
        state: f.uf || "",
        status: f.status === "ativo" ? "active" : "inactive",
      }))
    : [];

  const products: Product[] = usePlus
    ? (plusProdutos || []).map((p: any) => ({
        id: p.id,
        code: p.codigo || String(p.id),
        name: p.nome,
        description: p.descricao || "",
        category: p.categoria?.nome || "Geral",
        unit: p.unidade || "UN",
        costPrice: String(p.valor_compra || 0),
        salePrice: String(p.valor_unitario || 0),
        stockQty: String(p.estoque_atual || 0),
        minStock: String(p.estoque_minimo || 0),
        ncm: p.ncm || "",
        barcode: p.codigo_barras || "",
        status: p.status ? "active" : "inactive",
      }))
    : [];

  const { data: taxGroups = [] } = useQuery<TaxGroup[]>({
    queryKey: ["/api/fisco/grupos-tributacao", tenantId],
    queryFn: () => api.get(`/api/fisco/grupos-tributacao?tenantId=${tenantId}`),
  });

  const { data: segments = [] } = useQuery<ErpSegment[]>({
    queryKey: ["/api/erp/segments"],
    queryFn: () => api.get("/api/erp/segments"),
  });

  const { data: erpConfigFromServer } = useQuery<ErpConfigData | null>({
    queryKey: ["/api/erp/config"],
    queryFn: () => api.get("/api/erp/config"),
  });

  const [erpConfigData, setErpConfigData] = useState<ErpConfigData>({
    modulesCrm: 1,
    modulesSales: 1,
    modulesPurchases: 1,
    modulesStock: 1,
    modulesFinance: 1,
    modulesAccounting: 0,
    modulesProduction: 0,
    modulesProjects: 0,
    modulesHr: 0,
    modulesServiceOrder: 0,
  });

  useEffect(() => {
    if (erpConfigFromServer) {
      setErpConfigData(erpConfigFromServer);
    }
  }, [erpConfigFromServer]);

  const selectedSegment = segments.find(s => s.id === erpConfigData?.segmentId);

  const handleSeedSegments = async () => {
    try {
      await api.post("/api/erp/segments/seed", {});
      queryClient.invalidateQueries({ queryKey: ["/api/erp/segments"] });
      toast({ title: "Segmentos carregados com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao carregar segmentos", variant: "destructive" });
    }
  };

  const handleSaveConfig = async () => {
    try {
      await api.post("/api/erp/config", erpConfigData);
      queryClient.invalidateQueries({ queryKey: ["/api/erp/config"] });
      toast({ title: "Configuração salva com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao salvar configuração", variant: "destructive" });
    }
  };

  const { data: salesOrders = [] } = useQuery<SalesOrder[]>({
    queryKey: ["/api/erp/sales-orders", tenantId],
    queryFn: () => api.get(`/api/erp/sales-orders?tenantId=${tenantId}`),
    enabled: !useERPNext,
  });

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/erp/purchase-orders", tenantId],
    queryFn: () => api.get(`/api/erp/purchase-orders?tenantId=${tenantId}`),
    enabled: !useERPNext,
  });

  const { data: stats = { customers: 0, suppliers: 0, products: 0, salesOrders: 0, purchaseOrders: 0 } } = useQuery({
    queryKey: ["/api/erp/stats", tenantId],
    queryFn: () => api.get(`/api/erp/stats?tenantId=${tenantId}`),
    enabled: !useERPNext,
  });

  const displayCustomers = useERPNext ? erpnextCustomers.length : (stats.customers || customers.length);
  const displaySuppliers = useERPNext ? erpnextSuppliers.length : (stats.suppliers || suppliers.length);
  const displayProducts = useERPNext ? erpnextItems.length : (stats.products || products.length);
  const displaySalesOrders = useERPNext ? erpnextSalesOrders.length : (stats.salesOrders || salesOrders.length);
  const displayPurchaseOrders = useERPNext ? 0 : (stats.purchaseOrders || purchaseOrders.length);

  const createCustomerMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/erp/customers", { ...data, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/stats"] });
      setShowCustomerDialog(false);
      toast({ title: "Cliente criado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao criar cliente", variant: "destructive" }),
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/erp/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/customers"] });
      setShowCustomerDialog(false);
      setEditingItem(null);
      toast({ title: "Cliente atualizado!" });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/erp/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/stats"] });
      toast({ title: "Cliente excluído!" });
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/erp/suppliers", { ...data, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/stats"] });
      setShowSupplierDialog(false);
      toast({ title: "Fornecedor criado com sucesso!" });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/erp/products", { ...data, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/stats"] });
      setShowProductDialog(false);
      setEditingProduct(null);
      toast({ title: "Produto criado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao criar produto", variant: "destructive" }),
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/erp/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/products"] });
      setShowProductDialog(false);
      setEditingProduct(null);
      toast({ title: "Produto atualizado!" });
    },
    onError: () => toast({ title: "Erro ao atualizar produto", variant: "destructive" }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/erp/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/stats"] });
      toast({ title: "Produto excluído!" });
    },
    onError: () => toast({ title: "Erro ao excluir produto", variant: "destructive" }),
  });

  const batchAddDevicesMutation = useMutation({
    mutationFn: ({ productId, devices }: { productId: number; devices: Array<{ imei: string }> }) => 
      api.post(`/api/erp/products/${productId}/devices/batch`, { devices }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/products"] });
      setShowBatchImeiDialog(false);
      setBatchImeiText("");
      setSelectedProductForDevices(null);
      toast({ 
        title: `${data.inserted} dispositivo(s) adicionado(s)!`,
        description: data.duplicates?.length > 0 ? `${data.duplicates.length} IMEI(s) duplicado(s) ignorado(s)` : undefined
      });
    },
    onError: (error: any) => toast({ 
      title: "Erro ao adicionar dispositivos", 
      description: error?.message || "Verifique os IMEIs informados",
      variant: "destructive" 
    }),
  });

  const createSalesOrderMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/erp/sales-orders", { ...data, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/stats"] });
      setShowSalesDialog(false);
      toast({ title: "Pedido de venda criado!" });
    },
  });

  const confirmSalesOrderMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/erp/sales-orders/${id}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/sales-orders"] });
      toast({ title: "Pedido confirmado! Lançamentos contábeis gerados." });
    },
  });

  const generateNfeMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/erp/sales-orders/${id}/generate-nfe`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/sales-orders"] });
      toast({ title: "NF-e gerada com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao gerar NF-e", variant: "destructive" }),
  });

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.taxId?.includes(searchTerm)
  );

  const filteredSuppliers = suppliers.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Rascunho</Badge>;
      case "confirmed": return <Badge className="bg-blue-500"><CheckCircle className="w-3 h-3 mr-1" />Confirmado</Badge>;
      case "invoiced": return <Badge className="bg-green-500"><Receipt className="w-3 h-3 mr-1" />Faturado</Badge>;
      case "delivered": return <Badge className="bg-emerald-600"><Package className="w-3 h-3 mr-1" />Entregue</Badge>;
      case "cancelled": return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelado</Badge>;
      case "active": return <Badge className="bg-green-500">Ativo</Badge>;
      case "inactive": return <Badge variant="outline">Inativo</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleSaveCustomer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      code: formData.get("code"),
      name: formData.get("name"),
      type: formData.get("type") || "company",
      taxId: formData.get("taxId"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      address: formData.get("address"),
      city: formData.get("city"),
      state: formData.get("state"),
      creditLimit: formData.get("creditLimit") || "0",
      paymentTerms: Number(formData.get("paymentTerms")) || 30,
      status: "active",
    };
    if (editingItem) {
      updateCustomerMutation.mutate({ id: editingItem.id, data });
    } else {
      createCustomerMutation.mutate(data);
    }
  };

  const handleSaveSupplier = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      code: formData.get("code"),
      name: formData.get("name"),
      taxId: formData.get("taxId"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      address: formData.get("address"),
      city: formData.get("city"),
      state: formData.get("state"),
      paymentTerms: Number(formData.get("paymentTerms")) || 30,
      status: "active",
    };
    createSupplierMutation.mutate(data);
  };

  const handleSaveProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const taxGroupIdValue = formData.get("taxGroupId");
    const trackingType = formData.get("trackingType") as string || "none";
    const data = {
      code: formData.get("code"),
      name: formData.get("name"),
      description: formData.get("description"),
      category: formData.get("category"),
      unit: formData.get("unit") || "UN",
      costPrice: formData.get("costPrice") || "0",
      salePrice: formData.get("salePrice") || "0",
      stockQty: formData.get("stockQty") || "0",
      minStock: formData.get("minStock") || "0",
      ncm: formData.get("ncm"),
      barcode: formData.get("barcode"),
      taxGroupId: taxGroupIdValue ? Number(taxGroupIdValue) : null,
      status: "active",
      requiresSerialTracking: trackingType !== "none",
      trackingType,
      defaultBrand: formData.get("defaultBrand") || null,
      defaultModel: formData.get("defaultModel") || null,
    };
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data });
    } else {
      createProductMutation.mutate(data);
    }
  };

  const handleSaveSalesOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      orderNumber: `PV-${Date.now()}`,
      customerId: Number(formData.get("customerId")),
      orderDate: new Date().toISOString(),
      deliveryDate: formData.get("deliveryDate"),
      paymentMethod: formData.get("paymentMethod"),
      notes: formData.get("notes"),
      subtotal: formData.get("subtotal") || "0",
      discount: formData.get("discount") || "0",
      tax: formData.get("tax") || "0",
      total: formData.get("total") || "0",
      status: "draft",
    };
    createSalesOrderMutation.mutate(data);
  };

  return (
    <BrowserFrame>
      <div className="h-full flex flex-col bg-background">
        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Arcádia ERP</h1>
                <p className="text-sm text-muted-foreground">Gestão Empresarial Integrada</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="erpProfile" className="text-xs font-medium">Backend:</Label>
                <Select value={erpProfile} onValueChange={(v) => setErpProfile(v as ErpProfile)}>
                  <SelectTrigger className="w-40 h-8" data-testid="select-erp-profile">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plus">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-emerald-600" />
                        Arcádia Plus
                      </div>
                    </SelectItem>
                    <SelectItem value="erpnext" disabled={!isERPNextConnected}>
                      <div className="flex items-center gap-2">
                        <Cloud className="w-3 h-3 text-blue-600" />
                        Arcádia Next {!isERPNextConnected && "(Offline)"}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {erpProfile === "plus" && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                  <Building2 className="w-3 h-3" />
                  Plus
                </Badge>
              )}
              {erpProfile === "erpnext" && isERPNextConnected && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
                  <Cloud className="w-3 h-3" />
                  Next
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => window.location.href = "/fisco"} data-testid="btn-fisco">
                <Receipt className="w-4 h-4 mr-2" />
                Fisco
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.href = "/contabil"} data-testid="btn-contabil">
                <BookOpen className="w-4 h-4 mr-2" />
                Contábil
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.href = "/hr"}>
                <Users className="w-4 h-4 mr-2" />
                RH
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="h-full flex flex-col">
            <div className="border-b px-6">
              <TabsList className="h-12">
                <TabsTrigger value="dashboard" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="persons" className="gap-2" data-testid="tab-persons">
                  <Users className="w-4 h-4" />
                  Pessoas
                </TabsTrigger>
                <TabsTrigger value="products" className="gap-2" data-testid="tab-products">
                  <Package2 className="w-4 h-4" />
                  Produtos
                </TabsTrigger>
                <TabsTrigger value="sales" className="gap-2" data-testid="tab-sales">
                  <TrendingUp className="w-4 h-4" />
                  Vendas
                </TabsTrigger>
                <TabsTrigger value="purchases" className="gap-2" data-testid="tab-purchases">
                  <ShoppingCart className="w-4 h-4" />
                  Compras
                </TabsTrigger>
                <TabsTrigger 
                  value="financial" 
                  className="gap-2" 
                  data-testid="tab-financial"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = '/control';
                  }}
                >
                  <Wallet className="w-4 h-4" />
                  Financeiro
                  <ExternalLink className="w-3 h-3 ml-1" />
                </TabsTrigger>
                {useERPNext && (
                  <TabsTrigger value="crm" className="gap-2" data-testid="tab-crm">
                    <Target className="w-4 h-4" />
                    CRM
                  </TabsTrigger>
                )}
                <TabsTrigger value="config" className="gap-2" data-testid="tab-config">
                  <UserCog className="w-4 h-4" />
                  Configuração
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 p-6">
              <TabsContent value="dashboard" className="mt-0 space-y-6">
                <div className="grid grid-cols-5 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{displayCustomers}</div>
                      {useERPNext && <p className="text-xs text-muted-foreground">ERPNext</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Fornecedores</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{displaySuppliers}</div>
                      {useERPNext && <p className="text-xs text-muted-foreground">ERPNext</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Produtos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{displayProducts}</div>
                      {useERPNext && <p className="text-xs text-muted-foreground">ERPNext</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Venda</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{displaySalesOrders}</div>
                      {useERPNext && <p className="text-xs text-muted-foreground">ERPNext</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Compra</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{displayPurchaseOrders}</div>
                    </CardContent>
                  </Card>
                </div>

                {useERPNext && erpnextLeads.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Leads (CRM)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{erpnextLeads.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Briefcase className="w-4 h-4" />
                          Oportunidades
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{erpnextOpportunities.length}</div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        Vendas Recentes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {salesOrders.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum pedido de venda registrado</p>
                      ) : (
                        <div className="space-y-2">
                          {salesOrders.slice(0, 5).map((order) => (
                            <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div>
                                <p className="font-medium">{order.orderNumber}</p>
                                <p className="text-sm text-muted-foreground">{new Date(order.orderDate).toLocaleDateString("pt-BR")}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">R$ {Number(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                                {getStatusBadge(order.status)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package2 className="w-5 h-5 text-orange-500" />
                        Produtos com Estoque Baixo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {products.filter(p => Number(p.stockQty) <= Number(p.minStock)).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum produto com estoque baixo</p>
                      ) : (
                        <div className="space-y-2">
                          {products.filter(p => Number(p.stockQty) <= Number(p.minStock)).slice(0, 5).map((product) => (
                            <div key={product.id} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-muted-foreground">{product.code}</p>
                              </div>
                              <Badge variant="destructive">{product.stockQty} {product.unit}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRight className="w-5 h-5" />
                      Integrações
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <Receipt className="w-6 h-6 text-emerald-600" />
                          <h3 className="font-semibold">Arcádia Fisco</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">Gere NF-e/NFC-e diretamente dos pedidos de venda</p>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => window.location.href = "/fisco"}>
                          Acessar Fisco
                        </Button>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <BookOpen className="w-6 h-6 text-purple-600" />
                          <h3 className="font-semibold">Arcádia Contábil</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">Lançamentos contábeis automáticos de vendas e compras</p>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => window.location.href = "/contabil"}>
                          Acessar Contábil
                        </Button>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <Users className="w-6 h-6 text-blue-600" />
                          <h3 className="font-semibold">Arcádia People</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">Gestão de colaboradores, comissões e folha de pagamento</p>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => window.location.href = "/hr"}>
                          Acessar RH
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="persons" className="mt-0 space-y-4">
                <PersonsTab />
              </TabsContent>

              <TabsContent value="customers" className="mt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar clientes..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      data-testid="input-search-customers"
                    />
                  </div>
                  <Button onClick={() => { setEditingItem(null); setShowCustomerDialog(true); }} data-testid="btn-new-customer">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Cliente
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>CNPJ/CPF</TableHead>
                          <TableHead>Cidade/UF</TableHead>
                          <TableHead>Limite</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCustomers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              Nenhum cliente cadastrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCustomers.map((customer) => (
                            <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                              <TableCell className="font-mono">{customer.code}</TableCell>
                              <TableCell className="font-medium">{customer.name}</TableCell>
                              <TableCell>{customer.taxId}</TableCell>
                              <TableCell>{customer.city}/{customer.state}</TableCell>
                              <TableCell>R$ {Number(customer.creditLimit || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell>{getStatusBadge(customer.status)}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => { setEditingItem(customer); setShowCustomerDialog(true); }}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteCustomerMutation.mutate(customer.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="suppliers" className="mt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar fornecedores..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      data-testid="input-search-suppliers"
                    />
                  </div>
                  <Button onClick={() => { setEditingItem(null); setShowSupplierDialog(true); }} data-testid="btn-new-supplier">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Fornecedor
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Cidade/UF</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSuppliers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              Nenhum fornecedor cadastrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSuppliers.map((supplier) => (
                            <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                              <TableCell className="font-mono">{supplier.code}</TableCell>
                              <TableCell className="font-medium">{supplier.name}</TableCell>
                              <TableCell>{supplier.taxId}</TableCell>
                              <TableCell>{supplier.email}</TableCell>
                              <TableCell>{supplier.city}/{supplier.state}</TableCell>
                              <TableCell>{getStatusBadge(supplier.status)}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="products" className="mt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produtos..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      data-testid="input-search-products"
                    />
                  </div>
                  <Button onClick={() => { setEditingProduct(null); setShowProductDialog(true); }} data-testid="btn-new-product">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Produto
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>NCM</TableHead>
                          <TableHead>Custo</TableHead>
                          <TableHead>Venda</TableHead>
                          <TableHead>Estoque</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              Nenhum produto cadastrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredProducts.map((product) => (
                            <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                              <TableCell className="font-mono">{product.code}</TableCell>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell>{product.ncm}</TableCell>
                              <TableCell>R$ {Number(product.costPrice || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell>R$ {Number(product.salePrice || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell>
                                <Badge variant={Number(product.stockQty) <= Number(product.minStock) ? "destructive" : "default"}>
                                  {product.stockQty} {product.unit}
                                </Badge>
                              </TableCell>
                              <TableCell>{getStatusBadge(product.status)}</TableCell>
                              <TableCell className="text-right space-x-1">
                                {product.requiresSerialTracking && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => { setSelectedProductForDevices(product); setShowBatchImeiDialog(true); }}
                                    data-testid={`btn-batch-imei-${product.id}`}
                                  >
                                    <Smartphone className="w-4 h-4 mr-1" />
                                    IMEIs
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => { setEditingProduct(product); setShowProductDialog(true); }}
                                  data-testid={`btn-edit-product-${product.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => { if (confirm(`Excluir ${product.name}?`)) deleteProductMutation.mutate(product.id); }}
                                  data-testid={`btn-delete-product-${product.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sales" className="mt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar pedidos..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      data-testid="input-search-sales"
                    />
                  </div>
                  <Button onClick={() => { setEditingItem(null); setShowSalesDialog(true); }} data-testid="btn-new-sales">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Pedido
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesOrders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Nenhum pedido de venda registrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          salesOrders.map((order) => (
                            <TableRow key={order.id} data-testid={`row-sales-${order.id}`}>
                              <TableCell className="font-mono">{order.orderNumber}</TableCell>
                              <TableCell>{order.customerName || `Cliente #${order.customerId}`}</TableCell>
                              <TableCell>{new Date(order.orderDate).toLocaleDateString("pt-BR")}</TableCell>
                              <TableCell className="font-medium">R$ {Number(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell className="text-right space-x-1">
                                {order.status === "draft" && (
                                  <Button variant="outline" size="sm" onClick={() => confirmSalesOrderMutation.mutate(order.id)}>
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Confirmar
                                  </Button>
                                )}
                                {order.status === "confirmed" && (
                                  <Button variant="outline" size="sm" onClick={() => generateNfeMutation.mutate(order.id)}>
                                    <Receipt className="w-4 h-4 mr-1" />
                                    Gerar NF-e
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="purchases" className="mt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar pedidos..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      data-testid="input-search-purchases"
                    />
                  </div>
                  <Button onClick={() => { setEditingItem(null); setShowPurchaseDialog(true); }} data-testid="btn-new-purchase">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Pedido
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Previsão</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseOrders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              Nenhum pedido de compra registrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          purchaseOrders.map((order) => (
                            <TableRow key={order.id} data-testid={`row-purchase-${order.id}`}>
                              <TableCell className="font-mono">{order.orderNumber}</TableCell>
                              <TableCell>{order.supplierName || `Fornecedor #${order.supplierId}`}</TableCell>
                              <TableCell>{new Date(order.orderDate).toLocaleDateString("pt-BR")}</TableCell>
                              <TableCell>{order.expectedDate ? new Date(order.expectedDate).toLocaleDateString("pt-BR") : "-"}</TableCell>
                              <TableCell className="font-medium">R$ {Number(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="config" className="mt-0 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Configuração do Sistema</h2>
                    <p className="text-muted-foreground">Parametrize o ERP de acordo com seu segmento de negócio</p>
                  </div>
                  <Button onClick={handleSeedSegments} variant="outline" className="gap-2" data-testid="btn-seed-segments">
                    <Database className="w-4 h-4" />
                    Carregar Segmentos Padrão
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        Dados da Empresa
                      </CardTitle>
                      <CardDescription>Informações básicas da sua empresa</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Razão Social</Label>
                          <Input
                            value={erpConfigData?.companyName || ""}
                            onChange={(e) => setErpConfigData(prev => ({ ...prev, companyName: e.target.value }))}
                            placeholder="Razão social da empresa"
                            data-testid="input-company-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nome Fantasia</Label>
                          <Input
                            value={erpConfigData?.tradeName || ""}
                            onChange={(e) => setErpConfigData(prev => ({ ...prev, tradeName: e.target.value }))}
                            placeholder="Nome fantasia"
                            data-testid="input-trade-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CNPJ</Label>
                          <Input
                            value={erpConfigData?.taxId || ""}
                            onChange={(e) => setErpConfigData(prev => ({ ...prev, taxId: e.target.value }))}
                            placeholder="00.000.000/0000-00"
                            data-testid="input-company-taxid"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Regime Tributário</Label>
                          <Select
                            value={erpConfigData?.taxRegime || "simples"}
                            onValueChange={(val) => setErpConfigData(prev => ({ ...prev, taxRegime: val }))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="simples">Simples Nacional</SelectItem>
                              <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                              <SelectItem value="lucro_real">Lucro Real</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Inscrição Estadual</Label>
                          <Input
                            value={erpConfigData?.stateRegistration || ""}
                            onChange={(e) => setErpConfigData(prev => ({ ...prev, stateRegistration: e.target.value }))}
                            placeholder="Inscrição estadual"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Inscrição Municipal</Label>
                          <Input
                            value={erpConfigData?.cityRegistration || ""}
                            onChange={(e) => setErpConfigData(prev => ({ ...prev, cityRegistration: e.target.value }))}
                            placeholder="Inscrição municipal"
                          />
                        </div>
                      </div>
                      <Button onClick={handleSaveConfig} className="w-full mt-4" data-testid="btn-save-config">
                        Salvar Configurações
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        Segmento de Negócio
                      </CardTitle>
                      <CardDescription>Escolha o perfil que melhor representa sua empresa</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Select
                        value={String(erpConfigData?.segmentId || "")}
                        onValueChange={(val) => setErpConfigData(prev => ({ ...prev, segmentId: parseInt(val) }))}
                      >
                        <SelectTrigger data-testid="select-segment">
                          <SelectValue placeholder="Selecione um segmento" />
                        </SelectTrigger>
                        <SelectContent>
                          {segments.map((seg) => (
                            <SelectItem key={seg.id} value={String(seg.id)}>
                              {seg.name} ({seg.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedSegment && (
                        <div className="p-4 bg-muted rounded-lg space-y-2">
                          <p className="font-medium">{selectedSegment.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedSegment.description}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {selectedSegment.modules?.map((mod: string) => (
                              <Badge key={mod} variant="secondary">{mod}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FolderKanban className="w-5 h-5" />
                        Módulos Ativos
                      </CardTitle>
                      <CardDescription>Habilite ou desabilite módulos conforme sua necessidade</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { key: "modulesCrm", label: "CRM", icon: Users },
                          { key: "modulesSales", label: "Vendas", icon: Receipt },
                          { key: "modulesPurchases", label: "Compras", icon: ShoppingCart },
                          { key: "modulesStock", label: "Estoque", icon: Package },
                          { key: "modulesFinance", label: "Financeiro", icon: DollarSign },
                          { key: "modulesAccounting", label: "Contabilidade", icon: BookOpen },
                          { key: "modulesProduction", label: "Produção", icon: Package2 },
                          { key: "modulesProjects", label: "Projetos", icon: FolderKanban },
                          { key: "modulesHr", label: "RH", icon: UserCog },
                          { key: "modulesServiceOrder", label: "Ordem de Serviço", icon: FileText },
                        ].map(({ key, label, icon: Icon }) => (
                          <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{label}</span>
                            </div>
                            <Switch
                              checked={erpConfigData?.[key as keyof typeof erpConfigData] === 1}
                              onCheckedChange={(checked) => setErpConfigData(prev => ({ ...prev, [key]: checked ? 1 : 0 }))}
                              data-testid={`switch-${key}`}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveCustomer}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código</Label>
                  <Input id="code" name="code" defaultValue={editingItem?.code} required data-testid="input-customer-code" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome / Razão Social</Label>
                  <Input id="name" name="name" defaultValue={editingItem?.name} required data-testid="input-customer-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select name="type" defaultValue={editingItem?.type || "company"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Pessoa Jurídica</SelectItem>
                      <SelectItem value="individual">Pessoa Física</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">CNPJ/CPF</Label>
                  <Input id="taxId" name="taxId" defaultValue={editingItem?.taxId} data-testid="input-customer-taxid" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" defaultValue={editingItem?.email} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" name="phone" defaultValue={editingItem?.phone} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input id="address" name="address" defaultValue={editingItem?.address} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" name="city" defaultValue={editingItem?.city} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">UF</Label>
                  <Input id="state" name="state" maxLength={2} defaultValue={editingItem?.state} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creditLimit">Limite de Crédito</Label>
                  <Input id="creditLimit" name="creditLimit" type="number" step="0.01" defaultValue={editingItem?.creditLimit || "0"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Prazo Pagamento (dias)</Label>
                  <Input id="paymentTerms" name="paymentTerms" type="number" defaultValue={editingItem?.paymentTerms || 30} />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowCustomerDialog(false)}>Cancelar</Button>
                <Button type="submit" data-testid="btn-save-customer">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo Fornecedor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveSupplier}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código</Label>
                  <Input id="code" name="code" required data-testid="input-supplier-code" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome / Razão Social</Label>
                  <Input id="name" name="name" required data-testid="input-supplier-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">CNPJ</Label>
                  <Input id="taxId" name="taxId" data-testid="input-supplier-taxid" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" name="phone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Prazo Pagamento (dias)</Label>
                  <Input id="paymentTerms" name="paymentTerms" type="number" defaultValue={30} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input id="address" name="address" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" name="city" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">UF</Label>
                  <Input id="state" name="state" maxLength={2} />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowSupplierDialog(false)}>Cancelar</Button>
                <Button type="submit" data-testid="btn-save-supplier">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showProductDialog} onOpenChange={(open) => { setShowProductDialog(open); if (!open) setEditingProduct(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveProduct}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código</Label>
                  <Input id="code" name="code" defaultValue={editingProduct?.code || ""} required data-testid="input-product-code" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" name="name" defaultValue={editingProduct?.name || ""} required data-testid="input-product-name" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" name="description" defaultValue={editingProduct?.description || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Input id="category" name="category" defaultValue={editingProduct?.category || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unidade</Label>
                  <Select name="unit" defaultValue={editingProduct?.unit || "UN"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UN">Unidade</SelectItem>
                      <SelectItem value="KG">Quilograma</SelectItem>
                      <SelectItem value="M">Metro</SelectItem>
                      <SelectItem value="L">Litro</SelectItem>
                      <SelectItem value="CX">Caixa</SelectItem>
                      <SelectItem value="PC">Peça</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costPrice">Preço de Custo</Label>
                  <Input id="costPrice" name="costPrice" type="number" step="0.01" defaultValue={editingProduct?.costPrice || "0"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salePrice">Preço de Venda</Label>
                  <Input id="salePrice" name="salePrice" type="number" step="0.01" defaultValue={editingProduct?.salePrice || "0"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockQty">Estoque Atual</Label>
                  <Input id="stockQty" name="stockQty" type="number" step="0.001" defaultValue={editingProduct?.stockQty || "0"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock">Estoque Mínimo</Label>
                  <Input id="minStock" name="minStock" type="number" step="0.001" defaultValue={editingProduct?.minStock || "0"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ncm">NCM</Label>
                  <Input id="ncm" name="ncm" placeholder="00000000" maxLength={8} defaultValue={editingProduct?.ncm || ""} data-testid="input-product-ncm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Código de Barras</Label>
                  <Input id="barcode" name="barcode" defaultValue={editingProduct?.barcode || ""} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="taxGroupId">Grupo Tributário</Label>
                  <Select name="taxGroupId" defaultValue={editingProduct?.taxGroupId ? String(editingProduct.taxGroupId) : undefined}>
                    <SelectTrigger data-testid="select-product-tax-group">
                      <SelectValue placeholder="Selecione um grupo tributário" />
                    </SelectTrigger>
                    <SelectContent>
                      {taxGroups.map((group) => (
                        <SelectItem key={group.id} value={String(group.id)}>
                          {group.nome} - NCM: {group.ncm || "N/A"} (ICMS: {group.aliqIcms || "0"}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Configure grupos tributários no módulo Fisco para vincular as alíquotas de impostos
                  </p>
                </div>
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h4 className="font-medium mb-3">Rastreamento Serial/IMEI</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="trackingType">Tipo de Rastreamento</Label>
                      <Select name="trackingType" defaultValue={editingProduct?.trackingType || "none"}>
                        <SelectTrigger data-testid="select-tracking-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem Rastreamento</SelectItem>
                          <SelectItem value="imei">IMEI (Celulares)</SelectItem>
                          <SelectItem value="serial">Número de Série</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="defaultBrand">Marca Padrão</Label>
                      <Input id="defaultBrand" name="defaultBrand" placeholder="Ex: Apple, Samsung" defaultValue={editingProduct?.defaultBrand || ""} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="defaultModel">Modelo Padrão</Label>
                      <Input id="defaultModel" name="defaultModel" placeholder="Ex: iPhone 15 Pro" defaultValue={editingProduct?.defaultModel || ""} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Produtos com rastreamento IMEI/Serial terão estoque calculado automaticamente pela quantidade de dispositivos cadastrados.
                  </p>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowProductDialog(false)}>Cancelar</Button>
                <Button type="submit" data-testid="btn-save-product">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showSalesDialog} onOpenChange={setShowSalesDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo Pedido de Venda</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveSalesOrder}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerId">Cliente</Label>
                  <Select name="customerId" required>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">Data de Entrega</Label>
                  <Input id="deliveryDate" name="deliveryDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
                  <Select name="paymentMethod">
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="prazo">A Prazo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total">Valor Total</Label>
                  <Input id="total" name="total" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea id="notes" name="notes" />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowSalesDialog(false)}>Cancelar</Button>
                <Button type="submit" data-testid="btn-save-sales">Salvar como Rascunho</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showBatchImeiDialog} onOpenChange={(open) => { 
          setShowBatchImeiDialog(open); 
          if (!open) { 
            setSelectedProductForDevices(null); 
            setBatchImeiText(""); 
          } 
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Entrada de IMEIs em Lote</DialogTitle>
              <DialogDescription>
                {selectedProductForDevices && (
                  <span className="text-primary font-medium">{selectedProductForDevices.name}</span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Instruções:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Informe um IMEI por linha</li>
                  <li>IMEI deve ter entre 14 e 20 dígitos</li>
                  <li>IMEIs duplicados serão ignorados automaticamente</li>
                  <li>Os dispositivos herdarão marca/modelo do produto</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="batchImei">IMEIs (um por linha)</Label>
                <Textarea 
                  id="batchImei"
                  placeholder="351234567890123&#10;352987654321001&#10;869123456789012"
                  value={batchImeiText}
                  onChange={(e) => setBatchImeiText(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                  data-testid="textarea-batch-imei"
                />
                <p className="text-xs text-muted-foreground">
                  {batchImeiText.split('\n').filter(l => l.trim().length >= 14).length} IMEI(s) válido(s) detectado(s)
                </p>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowBatchImeiDialog(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="button"
                onClick={() => {
                  if (!selectedProductForDevices) return;
                  const imeis = batchImeiText
                    .split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length >= 14)
                    .map(imei => ({ imei }));
                  if (imeis.length === 0) {
                    toast({ title: "Nenhum IMEI válido informado", variant: "destructive" });
                    return;
                  }
                  batchAddDevicesMutation.mutate({ productId: selectedProductForDevices.id, devices: imeis });
                }}
                disabled={batchAddDevicesMutation.isPending}
                data-testid="btn-submit-batch-imei"
              >
                {batchAddDevicesMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4 mr-2" />
                    Adicionar Dispositivos
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </BrowserFrame>
  );
}
