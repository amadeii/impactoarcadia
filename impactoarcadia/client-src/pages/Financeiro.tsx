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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Wallet,
  Building2,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  CreditCard,
  Banknote,
  CalendarDays,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  Settings,
  PiggyBank,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TabType = "dashboard" | "payables" | "receivables" | "accounts" | "transactions" | "settings";

interface BankAccount {
  id: number;
  code: string;
  name: string;
  bankCode: string;
  bankName: string;
  agency: string;
  accountNumber: string;
  accountType: string;
  initialBalance: string;
  currentBalance: string;
  isActive: boolean;
}

interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  type: string;
  fee: string;
  daysToReceive: number;
  isActive: boolean;
}

interface PaymentPlan {
  id: number;
  code: string;
  name: string;
  installments: number;
  intervalDays: number;
  firstDueDays: number;
  discountPercent: string;
  interestPercent: string;
  isActive: boolean;
}

interface Category {
  id: number;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface Payable {
  id: number;
  documentNumber: string;
  supplierName: string;
  description: string;
  issueDate: string;
  dueDate: string;
  originalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  status: string;
}

interface Receivable {
  id: number;
  documentNumber: string;
  customerName: string;
  description: string;
  issueDate: string;
  dueDate: string;
  originalAmount: string;
  receivedAmount: string;
  remainingAmount: string;
  status: string;
}

interface Transaction {
  id: number;
  bankAccountId: number;
  type: string;
  amount: string;
  balanceAfter: string;
  transactionDate: string;
  description: string;
}

interface Dashboard {
  totalBalance: number;
  bankAccounts: number;
  totalPayables: number;
  payablesCount: number;
  overduePayables: number;
  totalReceivables: number;
  receivablesCount: number;
  overdueReceivables: number;
  projectedBalance: number;
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
  },
};

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num || 0);
};

const formatDate = (date: string) => {
  if (!date) return "-";
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
};

const getStatusBadge = (status: string) => {
  const styles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "outline", label: "Pendente" },
    partial: { variant: "secondary", label: "Parcial" },
    paid: { variant: "default", label: "Pago" },
    received: { variant: "default", label: "Recebido" },
    overdue: { variant: "destructive", label: "Vencido" },
    cancelled: { variant: "secondary", label: "Cancelado" },
  };
  const style = styles[status] || styles.pending;
  return <Badge variant={style.variant}>{style.label}</Badge>;
};

export default function Financeiro() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showPayableDialog, setShowPayableDialog] = useState(false);
  const [showReceivableDialog, setShowReceivableDialog] = useState(false);
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false);
  const [showPaymentPlanDialog, setShowPaymentPlanDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const { data: dashboard } = useQuery<Dashboard>({
    queryKey: ["/api/financeiro/dashboard"],
    queryFn: () => api.get("/api/financeiro/dashboard"),
  });

  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/financeiro/bank-accounts"],
    queryFn: () => api.get("/api/financeiro/bank-accounts"),
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/financeiro/payment-methods"],
    queryFn: () => api.get("/api/financeiro/payment-methods"),
  });

  const { data: paymentPlans = [] } = useQuery<PaymentPlan[]>({
    queryKey: ["/api/financeiro/payment-plans"],
    queryFn: () => api.get("/api/financeiro/payment-plans"),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/financeiro/categories"],
    queryFn: () => api.get("/api/financeiro/categories"),
  });

  const { data: payables = [] } = useQuery<Payable[]>({
    queryKey: ["/api/financeiro/payables"],
    queryFn: () => api.get("/api/financeiro/payables"),
  });

  const { data: receivables = [] } = useQuery<Receivable[]>({
    queryKey: ["/api/financeiro/receivables"],
    queryFn: () => api.get("/api/financeiro/receivables"),
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/financeiro/transactions"],
    queryFn: () => api.get("/api/financeiro/transactions"),
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/financeiro/bank-accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/dashboard"] });
      setShowAccountDialog(false);
      setEditingItem(null);
      toast({ title: "Conta bancária criada!" });
    },
    onError: () => toast({ title: "Erro ao criar conta", variant: "destructive" }),
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/api/financeiro/bank-accounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/bank-accounts"] });
      setShowAccountDialog(false);
      setEditingItem(null);
      toast({ title: "Conta atualizada!" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/financeiro/bank-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/dashboard"] });
      toast({ title: "Conta excluída!" });
    },
  });

  const createPayableMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/financeiro/payables", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/payables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/dashboard"] });
      setShowPayableDialog(false);
      setEditingItem(null);
      toast({ title: "Conta a pagar criada!" });
    },
    onError: () => toast({ title: "Erro ao criar conta a pagar", variant: "destructive" }),
  });

  const createReceivableMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/financeiro/receivables", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/receivables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/dashboard"] });
      setShowReceivableDialog(false);
      setEditingItem(null);
      toast({ title: "Conta a receber criada!" });
    },
    onError: () => toast({ title: "Erro ao criar conta a receber", variant: "destructive" }),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.post(`/api/financeiro/payables/${id}/pay`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/payables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/dashboard"] });
      setShowPayDialog(false);
      setSelectedItem(null);
      toast({ title: "Pagamento registrado!" });
    },
    onError: () => toast({ title: "Erro ao registrar pagamento", variant: "destructive" }),
  });

  const receiveMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.post(`/api/financeiro/receivables/${id}/receive`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/receivables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/dashboard"] });
      setShowReceiveDialog(false);
      setSelectedItem(null);
      toast({ title: "Recebimento registrado!" });
    },
    onError: () => toast({ title: "Erro ao registrar recebimento", variant: "destructive" }),
  });

  const transferMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/financeiro/transfers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/dashboard"] });
      setShowTransferDialog(false);
      toast({ title: "Transferência realizada!" });
    },
    onError: () => toast({ title: "Erro na transferência", variant: "destructive" }),
  });

  const createPaymentMethodMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/financeiro/payment-methods", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/payment-methods"] });
      setShowPaymentMethodDialog(false);
      toast({ title: "Meio de pagamento criado!" });
    },
  });

  const createPaymentPlanMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/financeiro/payment-plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/payment-plans"] });
      setShowPaymentPlanDialog(false);
      toast({ title: "Plano de pagamento criado!" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/financeiro/categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/categories"] });
      setShowCategoryDialog(false);
      toast({ title: "Categoria criada!" });
    },
  });

  const handleSaveAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      code: formData.get("code"),
      name: formData.get("name"),
      bankCode: formData.get("bankCode"),
      bankName: formData.get("bankName"),
      agency: formData.get("agency"),
      accountNumber: formData.get("accountNumber"),
      accountType: formData.get("accountType"),
      initialBalance: formData.get("initialBalance") || "0",
    };
    if (editingItem) {
      updateAccountMutation.mutate({ id: editingItem.id, data });
    } else {
      createAccountMutation.mutate(data);
    }
  };

  const handleSavePayable = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      documentNumber: formData.get("documentNumber"),
      supplierName: formData.get("supplierName"),
      description: formData.get("description"),
      issueDate: formData.get("issueDate"),
      dueDate: formData.get("dueDate"),
      originalAmount: formData.get("originalAmount"),
      categoryId: formData.get("categoryId") ? parseInt(formData.get("categoryId") as string) : null,
    };
    createPayableMutation.mutate(data);
  };

  const handleSaveReceivable = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      documentNumber: formData.get("documentNumber"),
      customerName: formData.get("customerName"),
      description: formData.get("description"),
      issueDate: formData.get("issueDate"),
      dueDate: formData.get("dueDate"),
      originalAmount: formData.get("originalAmount"),
      categoryId: formData.get("categoryId") ? parseInt(formData.get("categoryId") as string) : null,
    };
    createReceivableMutation.mutate(data);
  };

  const handlePay = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      amount: formData.get("amount"),
      bankAccountId: parseInt(formData.get("bankAccountId") as string),
      paymentDate: formData.get("paymentDate"),
    };
    payMutation.mutate({ id: selectedItem.id, data });
  };

  const handleReceive = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      amount: formData.get("amount"),
      bankAccountId: parseInt(formData.get("bankAccountId") as string),
      receiveDate: formData.get("receiveDate"),
    };
    receiveMutation.mutate({ id: selectedItem.id, data });
  };

  const handleTransfer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      fromAccountId: parseInt(formData.get("fromAccountId") as string),
      toAccountId: parseInt(formData.get("toAccountId") as string),
      amount: formData.get("amount"),
      description: formData.get("description"),
      transferDate: formData.get("transferDate"),
    };
    transferMutation.mutate(data);
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(dashboard?.totalBalance || 0)}</div>
            <p className="text-xs text-muted-foreground">{dashboard?.bankAccounts || 0} contas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(dashboard?.totalPayables || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.payablesCount || 0} títulos pendentes
              {(dashboard?.overduePayables || 0) > 0 && (
                <span className="text-red-500 ml-1">({dashboard?.overduePayables} vencidos)</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(dashboard?.totalReceivables || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.receivablesCount || 0} títulos pendentes
              {(dashboard?.overdueReceivables || 0) > 0 && (
                <span className="text-orange-500 ml-1">({dashboard?.overdueReceivables} vencidos)</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Projetado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(dashboard?.projectedBalance || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(dashboard?.projectedBalance || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Saldo + Receber - Pagar</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Contas Bancárias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bankAccounts.slice(0, 5).map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground">{account.bankName}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${parseFloat(account.currentBalance) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(account.currentBalance)}
                    </p>
                  </div>
                </div>
              ))}
              {bankAccounts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Nenhuma conta cadastrada</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Próximos Vencimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...payables.filter(p => p.status === "pending").slice(0, 3).map(p => ({ ...p, tipo: "pagar" })),
                ...receivables.filter(r => r.status === "pending").slice(0, 3).map(r => ({ ...r, tipo: "receber" }))]
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                .slice(0, 5)
                .map((item: any, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {item.tipo === "pagar" ? (
                        <ArrowDownCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4 text-green-500" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{item.supplierName || item.customerName}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.dueDate)}</p>
                      </div>
                    </div>
                    <p className={`font-bold ${item.tipo === "pagar" ? "text-red-600" : "text-green-600"}`}>
                      {formatCurrency(item.remainingAmount)}
                    </p>
                  </div>
                ))}
              {payables.length === 0 && receivables.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Sem vencimentos pendentes</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderPayables = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Contas a Pagar</h3>
        <Button onClick={() => setShowPayableDialog(true)} data-testid="button-add-payable">
          <Plus className="h-4 w-4 mr-2" /> Nova Conta
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payables.map((item) => (
                <TableRow key={item.id} data-testid={`row-payable-${item.id}`}>
                  <TableCell className="font-medium">{item.documentNumber || "-"}</TableCell>
                  <TableCell>{item.supplierName}</TableCell>
                  <TableCell>{formatDate(item.dueDate)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.originalAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.paidAmount)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(item.remainingAmount)}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-right">
                    {item.status !== "paid" && item.status !== "cancelled" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSelectedItem(item); setShowPayDialog(true); }}
                        data-testid={`button-pay-${item.id}`}
                      >
                        <DollarSign className="h-4 w-4 mr-1" /> Pagar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {payables.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta a pagar cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderReceivables = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Contas a Receber</h3>
        <Button onClick={() => setShowReceivableDialog(true)} data-testid="button-add-receivable">
          <Plus className="h-4 w-4 mr-2" /> Nova Conta
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivables.map((item) => (
                <TableRow key={item.id} data-testid={`row-receivable-${item.id}`}>
                  <TableCell className="font-medium">{item.documentNumber || "-"}</TableCell>
                  <TableCell>{item.customerName}</TableCell>
                  <TableCell>{formatDate(item.dueDate)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.originalAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.receivedAmount)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(item.remainingAmount)}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-right">
                    {item.status !== "received" && item.status !== "cancelled" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSelectedItem(item); setShowReceiveDialog(true); }}
                        data-testid={`button-receive-${item.id}`}
                      >
                        <DollarSign className="h-4 w-4 mr-1" /> Receber
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {receivables.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta a receber cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderAccounts = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Contas Bancárias</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTransferDialog(true)} data-testid="button-transfer">
            <ArrowRightLeft className="h-4 w-4 mr-2" /> Transferência
          </Button>
          <Button onClick={() => { setEditingItem(null); setShowAccountDialog(true); }} data-testid="button-add-account">
            <Plus className="h-4 w-4 mr-2" /> Nova Conta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bankAccounts.map((account) => (
          <Card key={account.id} data-testid={`card-account-${account.id}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{account.name}</CardTitle>
                  <CardDescription>{account.bankName}</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingItem(account); setShowAccountDialog(true); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteAccountMutation.mutate(account.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Agência:</span>
                  <span>{account.agency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Conta:</span>
                  <span>{account.accountNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span>{account.accountType === "checking" ? "Corrente" : account.accountType === "savings" ? "Poupança" : "Investimento"}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Saldo Atual:</span>
                    <span className={`text-xl font-bold ${parseFloat(account.currentBalance) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(account.currentBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {bankAccounts.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma conta bancária cadastrada
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Extrato de Movimentações</h3>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{formatDate(tx.transactionDate)}</TableCell>
                  <TableCell>{tx.description || "-"}</TableCell>
                  <TableCell>
                    {tx.type === "credit" ? (
                      <Badge variant="default" className="bg-green-600">Entrada</Badge>
                    ) : (
                      <Badge variant="destructive">Saída</Badge>
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${tx.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                    {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(tx.balanceAfter)}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma movimentação registrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Meios de Pagamento</h3>
          <Button variant="outline" onClick={() => setShowPaymentMethodDialog(true)} data-testid="button-add-payment-method">
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Taxa</TableHead>
                  <TableHead>Dias p/ Receber</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentMethods.map((method) => (
                  <TableRow key={method.id}>
                    <TableCell>{method.code}</TableCell>
                    <TableCell>{method.name}</TableCell>
                    <TableCell>{method.type}</TableCell>
                    <TableCell>{method.fee}%</TableCell>
                    <TableCell>{method.daysToReceive}</TableCell>
                    <TableCell>
                      <Badge variant={method.isActive ? "default" : "secondary"}>
                        {method.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Planos de Pagamento</h3>
          <Button variant="outline" onClick={() => setShowPaymentPlanDialog(true)} data-testid="button-add-payment-plan">
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Intervalo</TableHead>
                  <TableHead>1ª Parcela</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>{plan.code}</TableCell>
                    <TableCell>{plan.name}</TableCell>
                    <TableCell>{plan.installments}x</TableCell>
                    <TableCell>{plan.intervalDays} dias</TableCell>
                    <TableCell>{plan.firstDueDays} dias</TableCell>
                    <TableCell>
                      <Badge variant={plan.isActive ? "default" : "secondary"}>
                        {plan.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Categorias de Fluxo de Caixa</h3>
          <Button variant="outline" onClick={() => setShowCategoryDialog(true)} data-testid="button-add-category">
            <Plus className="h-4 w-4 mr-2" /> Nova
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>{cat.code}</TableCell>
                    <TableCell>{cat.name}</TableCell>
                    <TableCell>
                      <Badge variant={cat.type === "income" ? "default" : "destructive"}>
                        {cat.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cat.isActive ? "default" : "secondary"}>
                        {cat.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <BrowserFrame title="Arcádia Financeiro" currentPath="/financeiro">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <PiggyBank className="h-8 w-8 text-green-600" />
            Arcádia Financeiro
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão financeira completa: contas a pagar/receber, fluxo de caixa e controle bancário
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="space-y-4">
          <TabsList className="grid grid-cols-6 w-full max-w-4xl">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="payables" data-testid="tab-payables">A Pagar</TabsTrigger>
            <TabsTrigger value="receivables" data-testid="tab-receivables">A Receber</TabsTrigger>
            <TabsTrigger value="accounts" data-testid="tab-accounts">Contas</TabsTrigger>
            <TabsTrigger value="transactions" data-testid="tab-transactions">Extrato</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">{renderDashboard()}</TabsContent>
          <TabsContent value="payables">{renderPayables()}</TabsContent>
          <TabsContent value="receivables">{renderReceivables()}</TabsContent>
          <TabsContent value="accounts">{renderAccounts()}</TabsContent>
          <TabsContent value="transactions">{renderTransactions()}</TabsContent>
          <TabsContent value="settings">{renderSettings()}</TabsContent>
        </Tabs>

        <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Conta Bancária" : "Nova Conta Bancária"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Código</Label>
                  <Input name="code" defaultValue={editingItem?.code} required />
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input name="name" defaultValue={editingItem?.name} required />
                </div>
                <div>
                  <Label>Código do Banco</Label>
                  <Input name="bankCode" defaultValue={editingItem?.bankCode} />
                </div>
                <div>
                  <Label>Nome do Banco</Label>
                  <Input name="bankName" defaultValue={editingItem?.bankName} />
                </div>
                <div>
                  <Label>Agência</Label>
                  <Input name="agency" defaultValue={editingItem?.agency} />
                </div>
                <div>
                  <Label>Número da Conta</Label>
                  <Input name="accountNumber" defaultValue={editingItem?.accountNumber} />
                </div>
                <div>
                  <Label>Tipo de Conta</Label>
                  <Select name="accountType" defaultValue={editingItem?.accountType || "checking"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Corrente</SelectItem>
                      <SelectItem value="savings">Poupança</SelectItem>
                      <SelectItem value="investment">Investimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Saldo Inicial</Label>
                  <Input name="initialBalance" type="number" step="0.01" defaultValue={editingItem?.initialBalance || "0"} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAccountDialog(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showPayableDialog} onOpenChange={setShowPayableDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Conta a Pagar</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSavePayable} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Documento</Label>
                  <Input name="documentNumber" />
                </div>
                <div>
                  <Label>Fornecedor</Label>
                  <Input name="supplierName" required />
                </div>
                <div className="col-span-2">
                  <Label>Descrição</Label>
                  <Input name="description" />
                </div>
                <div>
                  <Label>Data de Emissão</Label>
                  <Input name="issueDate" type="date" required />
                </div>
                <div>
                  <Label>Vencimento</Label>
                  <Input name="dueDate" type="date" required />
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input name="originalAmount" type="number" step="0.01" required />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select name="categoryId">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => c.type === "expense").map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowPayableDialog(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showReceivableDialog} onOpenChange={setShowReceivableDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Conta a Receber</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveReceivable} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Documento</Label>
                  <Input name="documentNumber" />
                </div>
                <div>
                  <Label>Cliente</Label>
                  <Input name="customerName" required />
                </div>
                <div className="col-span-2">
                  <Label>Descrição</Label>
                  <Input name="description" />
                </div>
                <div>
                  <Label>Data de Emissão</Label>
                  <Input name="issueDate" type="date" required />
                </div>
                <div>
                  <Label>Vencimento</Label>
                  <Input name="dueDate" type="date" required />
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input name="originalAmount" type="number" step="0.01" required />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select name="categoryId">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => c.type === "income").map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowReceivableDialog(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <form onSubmit={handlePay} className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{selectedItem.supplierName}</p>
                  <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                  <p className="text-lg font-bold mt-2">Saldo: {formatCurrency(selectedItem.remainingAmount)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor a Pagar</Label>
                    <Input name="amount" type="number" step="0.01" defaultValue={selectedItem.remainingAmount} required />
                  </div>
                  <div>
                    <Label>Data do Pagamento</Label>
                    <Input name="paymentDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div className="col-span-2">
                    <Label>Conta Bancária</Label>
                    <Select name="bankAccountId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id.toString()}>
                            {acc.name} ({formatCurrency(acc.currentBalance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowPayDialog(false)}>Cancelar</Button>
                  <Button type="submit">Confirmar Pagamento</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Recebimento</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <form onSubmit={handleReceive} className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{selectedItem.customerName}</p>
                  <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                  <p className="text-lg font-bold mt-2">Saldo: {formatCurrency(selectedItem.remainingAmount)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor Recebido</Label>
                    <Input name="amount" type="number" step="0.01" defaultValue={selectedItem.remainingAmount} required />
                  </div>
                  <div>
                    <Label>Data do Recebimento</Label>
                    <Input name="receiveDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div className="col-span-2">
                    <Label>Conta Bancária</Label>
                    <Select name="bankAccountId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id.toString()}>
                            {acc.name} ({formatCurrency(acc.currentBalance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowReceiveDialog(false)}>Cancelar</Button>
                  <Button type="submit">Confirmar Recebimento</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transferência entre Contas</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Conta de Origem</Label>
                  <Select name="fromAccountId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id.toString()}>
                          {acc.name} ({formatCurrency(acc.currentBalance)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Conta de Destino</Label>
                  <Select name="toAccountId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id.toString()}>
                          {acc.name} ({formatCurrency(acc.currentBalance)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input name="amount" type="number" step="0.01" required />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input name="transferDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>
                <div className="col-span-2">
                  <Label>Descrição</Label>
                  <Input name="description" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowTransferDialog(false)}>Cancelar</Button>
                <Button type="submit">Transferir</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showPaymentMethodDialog} onOpenChange={setShowPaymentMethodDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Meio de Pagamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const formData = new FormData(form);
              createPaymentMethodMutation.mutate({
                code: formData.get("code"),
                name: formData.get("name"),
                type: formData.get("type"),
                fee: formData.get("fee") || "0",
                daysToReceive: parseInt(formData.get("daysToReceive") as string) || 0,
              });
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Código</Label>
                  <Input name="code" required />
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input name="name" required />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select name="type" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                      <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="bank_transfer">Transferência</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="check">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Taxa (%)</Label>
                  <Input name="fee" type="number" step="0.01" defaultValue="0" />
                </div>
                <div>
                  <Label>Dias para Receber</Label>
                  <Input name="daysToReceive" type="number" defaultValue="0" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowPaymentMethodDialog(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showPaymentPlanDialog} onOpenChange={setShowPaymentPlanDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Plano de Pagamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const formData = new FormData(form);
              createPaymentPlanMutation.mutate({
                code: formData.get("code"),
                name: formData.get("name"),
                installments: parseInt(formData.get("installments") as string) || 1,
                intervalDays: parseInt(formData.get("intervalDays") as string) || 30,
                firstDueDays: parseInt(formData.get("firstDueDays") as string) || 30,
              });
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Código</Label>
                  <Input name="code" required />
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input name="name" required />
                </div>
                <div>
                  <Label>Nº de Parcelas</Label>
                  <Input name="installments" type="number" defaultValue="1" required />
                </div>
                <div>
                  <Label>Intervalo (dias)</Label>
                  <Input name="intervalDays" type="number" defaultValue="30" required />
                </div>
                <div>
                  <Label>1ª Parcela (dias)</Label>
                  <Input name="firstDueDays" type="number" defaultValue="30" required />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowPaymentPlanDialog(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const formData = new FormData(form);
              createCategoryMutation.mutate({
                code: formData.get("code"),
                name: formData.get("name"),
                type: formData.get("type"),
              });
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Código</Label>
                  <Input name="code" required />
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input name="name" required />
                </div>
                <div className="col-span-2">
                  <Label>Tipo</Label>
                  <Select name="type" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCategoryDialog(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </BrowserFrame>
  );
}
