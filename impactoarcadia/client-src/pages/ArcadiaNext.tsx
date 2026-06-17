import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Brain,
  Truck,
  Building2,
  Target,
  Briefcase,
  Calculator,
  FolderKanban,
  UserCog,
  Database,
  Pencil
} from "lucide-react";

type ModuleType = "dashboard" | "persons" | "customers" | "suppliers" | "products" | "sales" | "financial" | "reports" | "crm" | "purchases" | "stock" | "accounting" | "projects" | "hr" | "doctypes";

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
  taxGroupId?: number;
  taxGroupName?: string;
  status: string;
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

interface TaxGroup {
  id: number;
  nome: string;
  ncm: string;
  cstIcms: string;
  aliqIcms: string;
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
      credentials: "include"
    });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  },
  put: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include"
    });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  },
  delete: async (url: string) => {
    const res = await fetch(url, { method: "DELETE", credentials: "include" });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  }
};

function DashboardModule({ tenantId }: { tenantId: number }) {
  const { data: stats = { customers: 0, suppliers: 0, products: 0, salesOrders: 0, purchaseOrders: 0 } } = useQuery({
    queryKey: ["/api/soe/stats", tenantId],
    queryFn: () => api.get(`/api/soe/stats?tenantId=${tenantId}`)
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/soe/customers", tenantId],
    queryFn: () => api.get(`/api/soe/customers?tenantId=${tenantId}`)
  });

  const { data: salesOrders = [] } = useQuery<SalesOrder[]>({
    queryKey: ["/api/soe/sales-orders", tenantId],
    queryFn: () => api.get(`/api/soe/sales-orders?tenantId=${tenantId}`)
  });

  const totalRevenue = salesOrders
    .filter(o => o.status === "confirmed" || o.status === "delivered")
    .reduce((acc, o) => acc + parseFloat(o.total || "0"), 0);

  const kpis = [
    { label: "Clientes", value: stats.customers || customers.length, icon: <Users className="h-5 w-5" />, change: 12, trend: "up" as const },
    { label: "Produtos", value: stats.products, icon: <Package className="h-5 w-5" />, change: 5, trend: "up" as const },
    { label: "Pedidos", value: stats.salesOrders || salesOrders.length, icon: <ShoppingCart className="h-5 w-5" />, change: 8, trend: "up" as const },
    { label: "Faturamento", value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: <DollarSign className="h-5 w-5" />, change: 15, trend: "up" as const }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">Visão geral do seu negócio</p>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Sistema Ativo
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <Card key={idx} data-testid={`kpi-card-${idx}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-primary/10 rounded-lg">{kpi.icon}</div>
                <div className={`flex items-center text-sm ${kpi.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                  {kpi.trend === "up" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {kpi.change}%
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Inteligência Arcádia
            </CardTitle>
            <CardDescription>Insights automáticos do seu negócio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Crescimento detectado</p>
                  <p className="text-sm text-blue-700">Suas vendas aumentaram 15% este mês</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Atenção ao estoque</p>
                  <p className="text-sm text-amber-700">3 produtos abaixo do estoque mínimo</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Últimos Pedidos
            </CardTitle>
            <CardDescription>Pedidos recentes</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[180px]">
              {salesOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">{order.customerName || `Cliente #${order.customerId}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">R$ {parseFloat(order.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <Badge variant={order.status === "confirmed" ? "default" : order.status === "pending" ? "secondary" : "outline"}>
                      {order.status === "confirmed" ? "Confirmado" : order.status === "pending" ? "Pendente" : order.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {salesOrders.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Nenhum pedido cadastrado</p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface Person {
  id: number;
  fullName: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  state: string;
  status: string;
  roles: string[];
}

function PersonsModule({ tenantId }: { tenantId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Person | null>(null);
  const [formRoles, setFormRoles] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState("active");

  const { data: persons = [], isLoading, refetch } = useQuery<Person[]>({
    queryKey: ["/api/soe/persons", tenantId, roleFilter],
    queryFn: () => api.get(`/api/soe/persons?tenantId=${tenantId}&role=${roleFilter}`)
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/soe/persons", { ...data, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/persons"] });
      setShowDialog(false);
      setEditingItem(null);
      toast({ title: "Pessoa criada com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao criar pessoa", variant: "destructive" })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/soe/persons/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/persons"] });
      setShowDialog(false);
      setEditingItem(null);
      toast({ title: "Pessoa atualizada!" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/soe/persons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/persons"] });
      toast({ title: "Pessoa excluída!" });
    }
  });

  const filtered = persons.filter(p => 
    p.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    p.cpfCnpj?.includes(search) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const openDialog = (person: Person | null) => {
    setEditingItem(person);
    setFormRoles(person?.roles || []);
    setFormStatus(person?.status || "active");
    setShowDialog(true);
  };

  const toggleRole = (role: string) => {
    setFormRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      ...Object.fromEntries(formData),
      roles: formRoles,
      status: formStatus
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      customer: "bg-blue-100 text-blue-800",
      supplier: "bg-green-100 text-green-800",
      employee: "bg-purple-100 text-purple-800",
      technician: "bg-orange-100 text-orange-800",
      partner: "bg-pink-100 text-pink-800"
    };
    const labels: Record<string, string> = {
      customer: "Cliente",
      supplier: "Fornecedor",
      employee: "Colaborador",
      technician: "Técnico",
      partner: "Parceiro"
    };
    return (
      <span key={role} className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[role] || "bg-gray-100 text-gray-800"}`}>
        {labels[role] || role}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pessoas</h2>
          <p className="text-muted-foreground">Cadastro unificado de clientes, fornecedores e colaboradores</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh-persons">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => openDialog(null)} data-testid="btn-add-person">
            <Plus className="w-4 h-4 mr-2" />
            Nova Pessoa
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF/CNPJ, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-persons"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-role-filter">
                <SelectValue placeholder="Filtrar por papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="customer">Clientes</SelectItem>
                <SelectItem value="supplier">Fornecedores</SelectItem>
                <SelectItem value="employee">Colaboradores</SelectItem>
                <SelectItem value="technician">Técnicos</SelectItem>
                <SelectItem value="partner">Parceiros</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Papéis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((person) => (
                  <TableRow key={person.id} data-testid={`person-row-${person.id}`}>
                    <TableCell>
                      <div className="font-medium">{person.fullName}</div>
                      <div className="text-sm text-muted-foreground">{person.email}</div>
                    </TableCell>
                    <TableCell>{person.cpfCnpj || "-"}</TableCell>
                    <TableCell>
                      <div>{person.phone || "-"}</div>
                      {person.whatsapp && <div className="text-xs text-green-600">{person.whatsapp}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {person.roles?.map(role => getRoleBadge(role))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={person.status === "active" ? "default" : "secondary"}>
                        {person.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(person)} data-testid={`btn-edit-person-${person.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(person.id)} data-testid={`btn-delete-person-${person.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma pessoa encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Pessoa" : "Nova Pessoa"}</DialogTitle>
            <DialogDescription>
              Uma pessoa pode ter múltiplos papéis no sistema
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome Completo *</Label>
                <Input name="fullName" defaultValue={editingItem?.fullName} required />
              </div>
              <div>
                <Label>CPF/CNPJ</Label>
                <Input name="cpfCnpj" defaultValue={editingItem?.cpfCnpj} />
              </div>
              <div>
                <Label>Email</Label>
                <Input name="email" type="email" defaultValue={editingItem?.email} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input name="phone" defaultValue={editingItem?.phone} />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input name="whatsapp" defaultValue={editingItem?.whatsapp} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input name="city" defaultValue={editingItem?.city} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input name="state" defaultValue={editingItem?.state} />
              </div>
            </div>

            <div>
              <Label>Papéis</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {["customer", "supplier", "employee", "technician", "partner"].map(role => (
                  <Button
                    key={role}
                    type="button"
                    variant={formRoles.includes(role) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleRole(role)}
                  >
                    {{customer: "Cliente", supplier: "Fornecedor", employee: "Colaborador", technician: "Técnico", partner: "Parceiro"}[role]}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button type="submit">{editingItem ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchasesModule({ tenantId }: { tenantId: number }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Compras</h2>
        <p className="text-muted-foreground">Gerenciamento de pedidos de compra</p>
      </div>
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Módulo de compras em desenvolvimento
        </CardContent>
      </Card>
    </div>
  );
}

function CustomersModule({ tenantId }: { tenantId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Customer | null>(null);
  const [formType, setFormType] = useState("PF");
  const [formStatus, setFormStatus] = useState("active");

  const { data: customers = [], isLoading, refetch } = useQuery<Customer[]>({
    queryKey: ["/api/soe/customers", tenantId],
    queryFn: () => api.get(`/api/soe/customers?tenantId=${tenantId}`)
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/soe/customers", { ...data, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soe/stats"] });
      setShowDialog(false);
      setEditingItem(null);
      toast({ title: "Cliente criado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao criar cliente", variant: "destructive" })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/soe/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/customers"] });
      setShowDialog(false);
      setEditingItem(null);
      toast({ title: "Cliente atualizado!" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/soe/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soe/stats"] });
      toast({ title: "Cliente excluído!" });
    }
  });

  const filtered = customers.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase()) ||
    c.taxId?.includes(search)
  );

  const openDialog = (customer: Customer | null) => {
    setEditingItem(customer);
    setFormType(customer?.type || "PF");
    setFormStatus(customer?.status || "active");
    setShowDialog(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      ...Object.fromEntries(formData),
      type: formType,
      status: formStatus
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clientes</h2>
          <p className="text-muted-foreground">Gerenciamento de clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh-customers">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => openDialog(null)} data-testid="btn-add-customer">
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-customers"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((customer) => (
                  <TableRow key={customer.id} data-testid={`customer-row-${customer.id}`}>
                    <TableCell className="font-medium">{customer.code}</TableCell>
                    <TableCell>{customer.name}</TableCell>
                    <TableCell>{customer.taxId}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{customer.city}/{customer.state}</TableCell>
                    <TableCell>
                      <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                        {customer.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(customer)} data-testid={`btn-edit-customer-${customer.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(customer.id)} data-testid={`btn-delete-customer-${customer.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription>Preencha os dados do cliente</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input id="code" name="code" defaultValue={editingItem?.code} required data-testid="input-customer-code" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" defaultValue={editingItem?.name} required data-testid="input-customer-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger data-testid="select-customer-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PF">Pessoa Física</SelectItem>
                    <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">CPF/CNPJ</Label>
                <Input id="taxId" name="taxId" defaultValue={editingItem?.taxId} data-testid="input-customer-taxid" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={editingItem?.email} data-testid="input-customer-email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" defaultValue={editingItem?.phone} data-testid="input-customer-phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" name="city" defaultValue={editingItem?.city} data-testid="input-customer-city" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input id="state" name="state" defaultValue={editingItem?.state} data-testid="input-customer-state" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditLimit">Limite de Crédito</Label>
                <Input id="creditLimit" name="creditLimit" type="number" step="0.01" defaultValue={editingItem?.creditLimit} data-testid="input-customer-creditlimit" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger data-testid="select-customer-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} data-testid="btn-cancel-customer">Cancelar</Button>
              <Button type="submit" data-testid="btn-save-customer">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SuppliersModule({ tenantId }: { tenantId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [formStatus, setFormStatus] = useState("active");

  const { data: suppliers = [], isLoading, refetch } = useQuery<Supplier[]>({
    queryKey: ["/api/soe/suppliers", tenantId],
    queryFn: () => api.get(`/api/soe/suppliers?tenantId=${tenantId}`)
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/soe/suppliers", { ...data, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soe/stats"] });
      setShowDialog(false);
      setEditingItem(null);
      toast({ title: "Fornecedor criado com sucesso!" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/soe/suppliers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/suppliers"] });
      setShowDialog(false);
      setEditingItem(null);
      toast({ title: "Fornecedor atualizado!" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/soe/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soe/stats"] });
      toast({ title: "Fornecedor excluído!" });
    }
  });

  const filtered = suppliers.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase())
  );

  const openDialog = (supplier: Supplier | null) => {
    setEditingItem(supplier);
    setFormStatus(supplier?.status || "active");
    setShowDialog(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      ...Object.fromEntries(formData),
      status: formStatus
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Fornecedores</h2>
          <p className="text-muted-foreground">Gerenciamento de fornecedores</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh-suppliers">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => openDialog(null)} data-testid="btn-add-supplier">
            <Plus className="w-4 h-4 mr-2" />
            Novo Fornecedor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar fornecedores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-suppliers"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((supplier) => (
                  <TableRow key={supplier.id} data-testid={`supplier-row-${supplier.id}`}>
                    <TableCell className="font-medium">{supplier.code}</TableCell>
                    <TableCell>{supplier.name}</TableCell>
                    <TableCell>{supplier.taxId}</TableCell>
                    <TableCell>{supplier.phone}</TableCell>
                    <TableCell>{supplier.city}/{supplier.state}</TableCell>
                    <TableCell>
                      <Badge variant={supplier.status === "active" ? "default" : "secondary"}>
                        {supplier.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(supplier)} data-testid={`btn-edit-supplier-${supplier.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(supplier.id)} data-testid={`btn-delete-supplier-${supplier.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum fornecedor encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input id="code" name="code" defaultValue={editingItem?.code} required data-testid="input-supplier-code" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" defaultValue={editingItem?.name} required data-testid="input-supplier-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">CNPJ</Label>
                <Input id="taxId" name="taxId" defaultValue={editingItem?.taxId} data-testid="input-supplier-taxid" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={editingItem?.email} data-testid="input-supplier-email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" defaultValue={editingItem?.phone} data-testid="input-supplier-phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" name="city" defaultValue={editingItem?.city} data-testid="input-supplier-city" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input id="state" name="state" defaultValue={editingItem?.state} data-testid="input-supplier-state" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger data-testid="select-supplier-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} data-testid="btn-cancel-supplier">Cancelar</Button>
              <Button type="submit" data-testid="btn-save-supplier">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductsModule({ tenantId }: { tenantId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [formUnit, setFormUnit] = useState("UN");
  const [formStatus, setFormStatus] = useState("active");
  const [formTaxGroup, setFormTaxGroup] = useState("");

  const { data: products = [], isLoading, refetch } = useQuery<Product[]>({
    queryKey: ["/api/soe/products", tenantId],
    queryFn: () => api.get(`/api/soe/products?tenantId=${tenantId}`)
  });

  const { data: taxGroups = [] } = useQuery<TaxGroup[]>({
    queryKey: ["/api/fisco/grupos-tributacao", tenantId],
    queryFn: () => api.get(`/api/fisco/grupos-tributacao?tenantId=${tenantId}`)
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/soe/products", { ...data, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soe/stats"] });
      setShowDialog(false);
      setEditingItem(null);
      toast({ title: "Produto criado com sucesso!" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/soe/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/products"] });
      setShowDialog(false);
      setEditingItem(null);
      toast({ title: "Produto atualizado!" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/soe/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soe/stats"] });
      toast({ title: "Produto excluído!" });
    }
  });

  const filtered = products.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase())
  );

  const openDialog = (product: Product | null) => {
    setEditingItem(product);
    setFormUnit(product?.unit || "UN");
    setFormStatus(product?.status || "active");
    setFormTaxGroup(product?.taxGroupId?.toString() || "");
    setShowDialog(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      ...Object.fromEntries(formData),
      unit: formUnit,
      status: formStatus,
      taxGroupId: formTaxGroup ? parseInt(formTaxGroup) : null
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Produtos</h2>
          <p className="text-muted-foreground">Catálogo de produtos e estoque</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh-products">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => openDialog(null)} data-testid="btn-add-product">
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-products"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço Venda</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>NCM</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((product) => (
                  <TableRow key={product.id} data-testid={`product-row-${product.id}`}>
                    <TableCell className="font-medium">{product.code}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>R$ {parseFloat(product.salePrice || "0").toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={parseFloat(product.stockQty || "0") <= parseFloat(product.minStock || "0") ? "text-red-600 font-medium" : ""}>
                        {product.stockQty} {product.unit}
                      </span>
                    </TableCell>
                    <TableCell>{product.ncm}</TableCell>
                    <TableCell>
                      <Badge variant={product.status === "active" ? "default" : "secondary"}>
                        {product.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(product)} data-testid={`btn-edit-product-${product.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(product.id)} data-testid={`btn-delete-product-${product.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input id="code" name="code" defaultValue={editingItem?.code} required data-testid="input-product-code" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" defaultValue={editingItem?.name} required data-testid="input-product-name" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" name="description" defaultValue={editingItem?.description} data-testid="input-product-description" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input id="category" name="category" defaultValue={editingItem?.category} data-testid="input-product-category" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unidade</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger data-testid="select-product-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">Unidade</SelectItem>
                    <SelectItem value="KG">Quilograma</SelectItem>
                    <SelectItem value="LT">Litro</SelectItem>
                    <SelectItem value="MT">Metro</SelectItem>
                    <SelectItem value="CX">Caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPrice">Preço de Custo</Label>
                <Input id="costPrice" name="costPrice" type="number" step="0.01" defaultValue={editingItem?.costPrice} data-testid="input-product-costprice" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salePrice">Preço de Venda</Label>
                <Input id="salePrice" name="salePrice" type="number" step="0.01" defaultValue={editingItem?.salePrice} data-testid="input-product-saleprice" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stockQty">Estoque Atual</Label>
                <Input id="stockQty" name="stockQty" type="number" step="0.01" defaultValue={editingItem?.stockQty} data-testid="input-product-stockqty" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Estoque Mínimo</Label>
                <Input id="minStock" name="minStock" type="number" step="0.01" defaultValue={editingItem?.minStock} data-testid="input-product-minstock" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ncm">NCM</Label>
                <Input id="ncm" name="ncm" defaultValue={editingItem?.ncm} data-testid="input-product-ncm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxGroupId">Grupo Tributário</Label>
                <Select value={formTaxGroup} onValueChange={setFormTaxGroup}>
                  <SelectTrigger data-testid="select-product-taxgroup">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {taxGroups.map(g => (
                      <SelectItem key={g.id} value={g.id.toString()}>{g.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger data-testid="select-product-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} data-testid="btn-cancel-product">Cancelar</Button>
              <Button type="submit" data-testid="btn-save-product">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SalesModule({ tenantId }: { tenantId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<SalesOrder | null>(null);
  const [formCustomerId, setFormCustomerId] = useState("");

  const { data: salesOrders = [], isLoading, refetch } = useQuery<SalesOrder[]>({
    queryKey: ["/api/soe/sales-orders", tenantId],
    queryFn: () => api.get(`/api/soe/sales-orders?tenantId=${tenantId}`)
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/soe/customers", tenantId],
    queryFn: () => api.get(`/api/soe/customers?tenantId=${tenantId}`)
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/soe/sales-orders", { ...data, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soe/stats"] });
      setShowDialog(false);
      setEditingItem(null);
      setFormCustomerId("");
      toast({ title: "Pedido criado com sucesso!" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/soe/sales-orders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soe/stats"] });
      setShowDialog(false);
      setEditingItem(null);
      setFormCustomerId("");
      toast({ title: "Pedido atualizado!" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/soe/sales-orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soe/stats"] });
      toast({ title: "Pedido excluído!" });
    }
  });

  const confirmMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/soe/sales-orders/${id}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soe/sales-orders"] });
      toast({ title: "Pedido confirmado!" });
    }
  });

  const filtered = salesOrders.filter(o => 
    o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
    o.customerName?.toLowerCase().includes(search.toLowerCase())
  );

  const openDialog = (order: SalesOrder | null) => {
    setEditingItem(order);
    setFormCustomerId(order?.customerId?.toString() || "");
    setShowDialog(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      ...Object.fromEntries(formData),
      customerId: formCustomerId ? parseInt(formCustomerId) : null
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed": return <Badge className="bg-green-100 text-green-800">Confirmado</Badge>;
      case "pending": return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case "cancelled": return <Badge className="bg-red-100 text-red-800">Cancelado</Badge>;
      case "delivered": return <Badge className="bg-blue-100 text-blue-800">Entregue</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vendas</h2>
          <p className="text-muted-foreground">Pedidos de venda</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh-sales">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => openDialog(null)} data-testid="btn-add-sale">
            <Plus className="w-4 h-4 mr-2" />
            Novo Pedido
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pedidos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-sales"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => (
                  <TableRow key={order.id} data-testid={`sale-row-${order.id}`}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{order.customerName || `Cliente #${order.customerId}`}</TableCell>
                    <TableCell>{new Date(order.orderDate).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('pt-BR') : '-'}</TableCell>
                    <TableCell>R$ {parseFloat(order.total || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">
                      {order.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => confirmMutation.mutate(order.id)} data-testid={`btn-confirm-sale-${order.id}`}>
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Confirmar
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openDialog(order)} data-testid={`btn-edit-sale-${order.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(order.id)} data-testid={`btn-delete-sale-${order.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Pedido" : "Novo Pedido de Venda"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="orderNumber">Número do Pedido</Label>
                <Input id="orderNumber" name="orderNumber" placeholder="PV-001" defaultValue={editingItem?.orderNumber} required data-testid="input-sale-number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerId">Cliente</Label>
                <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                  <SelectTrigger data-testid="select-sale-customer">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orderDate">Data do Pedido</Label>
                  <Input id="orderDate" name="orderDate" type="date" defaultValue={editingItem?.orderDate?.split('T')[0] || new Date().toISOString().split('T')[0]} required data-testid="input-sale-date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">Data de Entrega</Label>
                  <Input id="deliveryDate" name="deliveryDate" type="date" defaultValue={editingItem?.deliveryDate?.split('T')[0] || ""} data-testid="input-sale-delivery" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subtotal">Subtotal</Label>
                  <Input id="subtotal" name="subtotal" type="number" step="0.01" defaultValue={editingItem?.subtotal || "0"} data-testid="input-sale-subtotal" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount">Desconto</Label>
                  <Input id="discount" name="discount" type="number" step="0.01" defaultValue={editingItem?.discount || "0"} data-testid="input-sale-discount" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total">Total</Label>
                  <Input id="total" name="total" type="number" step="0.01" defaultValue={editingItem?.total || "0"} data-testid="input-sale-total" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} data-testid="btn-cancel-sale">Cancelar</Button>
              <Button type="submit" data-testid="btn-save-sale">{editingItem ? "Salvar" : "Criar Pedido"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinancialModule() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Financeiro</h2>
        <p className="text-muted-foreground">Contas a pagar e receber</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">R$ 0,00</p>
                <p className="text-sm text-muted-foreground">A Receber</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <Receipt className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">R$ 0,00</p>
                <p className="text-sm text-muted-foreground">A Pagar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">R$ 0,00</p>
                <p className="text-sm text-muted-foreground">Saldo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Módulo em Desenvolvimento</CardTitle>
          <CardDescription>Use o módulo Fisco para emissão de notas fiscais</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">O módulo financeiro completo está em desenvolvimento. Enquanto isso, você pode usar o Arcádia Fisco para emissão de documentos fiscais.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsModule() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Relatórios</h2>
        <p className="text-muted-foreground">Análises e relatórios do sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Relatório de Clientes</p>
                <p className="text-sm text-muted-foreground">Lista completa de clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Relatório de Vendas</p>
                <p className="text-sm text-muted-foreground">Vendas por período</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Package className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-medium">Relatório de Estoque</p>
                <p className="text-sm text-muted-foreground">Posição de estoque</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Dashboard Analítico</p>
                <p className="text-sm text-muted-foreground">Indicadores de desempenho</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-lg">
                <Receipt className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="font-medium">Relatório Fiscal</p>
                <p className="text-sm text-muted-foreground">Notas fiscais emitidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-100 rounded-lg">
                <Brain className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <p className="font-medium">Insights com IA</p>
                <p className="text-sm text-muted-foreground">Análises inteligentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ArcadiaNext() {
  const { user } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleType>("dashboard");
  const tenantId = (user as any)?.tenantId || 1;

  const modules = [
    { id: "dashboard" as ModuleType, label: "Dashboard", icon: LayoutDashboard },
    { id: "persons" as ModuleType, label: "Pessoas", icon: Users },
    { id: "products" as ModuleType, label: "Produtos", icon: Package },
    { id: "sales" as ModuleType, label: "Vendas", icon: ShoppingCart },
    { id: "purchases" as ModuleType, label: "Compras", icon: Truck },
    { id: "financial" as ModuleType, label: "Financeiro", icon: DollarSign },
    { id: "reports" as ModuleType, label: "Relatórios", icon: BarChart3 }
  ];

  return (
    <BrowserFrame>
      <div className="flex h-full">
        <aside className="w-64 border-r bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2 px-2 py-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Arcádia SOE</h1>
              <p className="text-xs text-muted-foreground">Gestão Empresarial</p>
            </div>
          </div>

          <Separator className="my-4" />

          {modules.map((module) => (
            <Button
              key={module.id}
              variant={activeModule === module.id ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveModule(module.id)}
              data-testid={`nav-${module.id}`}
            >
              <module.icon className="w-4 h-4 mr-2" />
              {module.label}
            </Button>
          ))}
        </aside>

        <main className="flex-1 p-6 overflow-auto">
          {activeModule === "dashboard" && <DashboardModule tenantId={tenantId} />}
          {activeModule === "persons" && <PersonsModule tenantId={tenantId} />}
          {activeModule === "customers" && <CustomersModule tenantId={tenantId} />}
          {activeModule === "suppliers" && <SuppliersModule tenantId={tenantId} />}
          {activeModule === "products" && <ProductsModule tenantId={tenantId} />}
          {activeModule === "sales" && <SalesModule tenantId={tenantId} />}
          {activeModule === "purchases" && <PurchasesModule tenantId={tenantId} />}
          {activeModule === "financial" && <FinancialModule />}
          {activeModule === "reports" && <ReportsModule />}
        </main>
      </div>
    </BrowserFrame>
  );
}
