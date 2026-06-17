import { useState, useEffect } from "react";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Store, ShoppingCart, Wrench, Package, Users, BarChart3, 
  Plus, Search, Smartphone, ArrowRightLeft, ClipboardList,
  DollarSign, Clock, AlertTriangle, CheckCircle, XCircle,
  Truck, FileText, Settings, RefreshCw, Trash2, Edit, 
  GripVertical, ListChecks, FileCheck, ExternalLink, UserPlus, User, CreditCard,
  Lock, RefreshCcw, X, Loader2, ShoppingBag, FileBarChart, Percent, Tag, Banknote, Gift, Printer,
  Target, Calendar, Headphones, Upload, List, FileSpreadsheet,
  ClipboardCheck, Circle
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil } from "lucide-react";
import TradeInForm from "@/components/TradeInForm";


interface DashboardStats {
  devicesInStock: number;
  openServiceOrders: number;
  todaySalesTotal: number;
  todaySalesCount: number;
  pendingEvaluations: number;
}

interface ActivityFeedItem {
  id: number;
  activityType: string;
  entityType?: string;
  entityId?: number;
  title: string;
  description?: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
  metadata?: any;
}

interface MobileDevice {
  id: number;
  imei: string;
  brand: string;
  model: string;
  color?: string;
  storage?: string;
  condition: string;
  sellingPrice?: string;
  purchasePrice?: string;
  acquisitionType?: string;
  acquisitionCost?: string;
  status: string;
  storeId?: number;
}

interface ServiceOrder {
  id: number;
  orderNumber: string;
  imei: string;
  brand?: string;
  model?: string;
  customerName: string;
  customerPhone?: string;
  issueDescription: string;
  status: string;
  priority: string;
  totalCost?: string;
  isInternal?: boolean;
  origin?: string;
  serviceType?: string;
  deviceId?: number;
  createdAt: string;
}

interface DeviceEvaluation {
  id: number;
  imei: string;
  brand: string;
  model: string;
  customerName?: string;
  overallCondition?: string;
  estimatedValue?: string;
  evaluationDate?: string;
  maintenanceOrderId?: number;
  status: string;
  createdAt: string;
}

interface ChecklistTemplate {
  id: number;
  name: string;
  description?: string;
  deviceCategory: string;
  isActive: boolean;
  items?: ChecklistItem[];
}

interface ChecklistItem {
  id: number;
  templateId: number;
  category: string;
  itemName: string;
  itemDescription?: string;
  evaluationType: string;
  options?: string;
  impactOnValue?: string;
  isRequired: boolean;
  displayOrder: number;
}

interface PaymentMethod {
  id: number;
  name: string;
  type: string;
  brand?: string;
  feePercent?: string;
  fixedFee?: string;
  installmentsMax?: number;
  daysToReceive?: number;
  isActive: boolean;
}

interface Seller {
  id: number;
  code?: string;
  name: string;
  email?: string;
  phone?: string;
  storeId?: number;
  personId?: number;
  commissionPlanId?: number;
  hireDate?: string;
  isActive: boolean;
}

interface CommissionPlan {
  id: number;
  name: string;
  description?: string;
  type: string;
  baseValue?: string;
  basePercent?: string;
  isActive: boolean;
}

interface PriceTable {
  id: number;
  name: string;
  code?: string;
  description?: string;
  customerType?: string;
  discountPercent?: string;
  markupPercent?: string;
  validFrom?: string;
  validTo?: string;
  isDefault: boolean;
  isActive: boolean;
}

interface Promotion {
  id: number;
  name: string;
  description?: string;
  type: string;
  discountValue?: string;
  discountPercent?: string;
  applyTo?: string;
  minQuantity?: number;
  validFrom?: string;
  validTo?: string;
  isActive: boolean;
}

export default function ArcadiaRetail() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [evaluations, setEvaluations] = useState<DeviceEvaluation[]>([]);
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(() => {
    const stored = localStorage.getItem("retail_empresa_id");
    return stored ? parseInt(stored) : null;
  });
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(() => {
    const stored = localStorage.getItem("retail_seller_id");
    return stored ? parseInt(stored) : null;
  });
  const [showSessionRequired, setShowSessionRequired] = useState(false);
  const [showNewDeviceDialog, setShowNewDeviceDialog] = useState(false);
  const [showNewServiceDialog, setShowNewServiceDialog] = useState(false);
  const [showEvaluationDialog, setShowEvaluationDialog] = useState(false);
  const [showTradeInForm, setShowTradeInForm] = useState(false);
  const [evalForm, setEvalForm] = useState({
    imei: "",
    cliente: "",
    cpf: "",
    personId: null as number | null,
    customerPhone: "",
    marca: "",
    modelo: "",
    cor: "",
    tela: "",
    corpo: "",
    bateria: "",
    condicaoGeral: ""
  });
  const [evalFilteredPersons, setEvalFilteredPersons] = useState<any[]>([]);
  const [showEvalClientDropdown, setShowEvalClientDropdown] = useState(false);
  const [showQuickPersonDialog, setShowQuickPersonDialog] = useState(false);
  const [quickPerson, setQuickPerson] = useState({ fullName: "", cpfCnpj: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null);
  const [showEvaluationDetailsDialog, setShowEvaluationDetailsDialog] = useState(false);
  const [approving, setApproving] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<any>(null);
  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [selectedProductForTradeIn, setSelectedProductForTradeIn] = useState<number | null>(null);
  const [matchingProducts, setMatchingProducts] = useState<any[]>([]);
  const [showNewItemDialog, setShowNewItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: "", description: "", deviceCategory: "smartphone" });
  const [newItem, setNewItem] = useState({ 
    category: "visual", 
    itemName: "", 
    itemDescription: "", 
    evaluationType: "condition",
    options: '["Perfeito","Bom","Regular","Ruim"]',
    impactOnValue: "0",
    isRequired: true,
    displayOrder: 0
  });
  
  // Person Registry States
  const [personsList, setPersonsList] = useState<any[]>([]);
  const [personSearch, setPersonSearch] = useState("");
  const [personRoleFilter, setPersonRoleFilter] = useState("all");
  const [showNewPersonDialog, setShowNewPersonDialog] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any | null>(null);
  const [viewingPerson, setViewingPerson] = useState<any | null>(null);
  const [personHistory, setPersonHistory] = useState<{sales: any[], services: any[], tradeIns: any[], credits: any[]}>({sales: [], services: [], tradeIns: [], credits: []});
  
  // Créditos e Devoluções
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  const [viewingCredits, setViewingCredits] = useState<{person: any, credits: any[], totalAvailable: number} | null>(null);
  const [returnGenerateCredit, setReturnGenerateCredit] = useState(true);
  const [returnCreditExpiration, setReturnCreditExpiration] = useState(90);
  const [newPerson, setNewPerson] = useState({
    fullName: "",
    cpfCnpj: "",
    email: "",
    phone: "",
    whatsapp: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    notes: "",
    roles: [] as string[]
  });
  
  // PDV States
  interface CartItem {
    id: string;
    type: "device" | "accessory" | "service" | "product";
    deviceId?: number;
    productId?: number;
    imei?: string;
    name: string;
    description?: string;
    code?: string;
    ncm?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    serviceOrderId?: number;
  }
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pdvCustomer, setPdvCustomer] = useState<any | null>(null);
  const [pdvSearch, setPdvSearch] = useState("");
  const [pdvProductSearch, setPdvProductSearch] = useState("");
  const [pdvProducts, setPdvProducts] = useState<any[]>([]);
  const [pdvOsSearch, setPdvOsSearch] = useState("");
  const [showImeiModal, setShowImeiModal] = useState(false);
  const [pendingDevice, setPendingDevice] = useState<MobileDevice | null>(null);
  const [imeiInput, setImeiInput] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<{method: string; amount: number}[]>([]);
  const [tradeInCredit, setTradeInCredit] = useState(0);
  const [pdvDiscount, setPdvDiscount] = useState(0);
  const [availableOs, setAvailableOs] = useState<ServiceOrder[]>([]);
  const [customerCredits, setCustomerCredits] = useState<any[]>([]);
  const [customerTotalCredit, setCustomerTotalCredit] = useState(0);
  const [useCredit, setUseCredit] = useState(false);
  const [creditAmountToUse, setCreditAmountToUse] = useState(0);
  
  const [showCashMovementDialog, setShowCashMovementDialog] = useState(false);
  const [cashMovementType, setCashMovementType] = useState<"withdrawal"|"reinforcement">("withdrawal");
  const [cashMovements, setCashMovements] = useState<any[]>([]);
  const [cashMovementAmount, setCashMovementAmount] = useState("");
  const [cashMovementReason, setCashMovementReason] = useState("");
  
  // Trade-In Alerts & Status
  const [customerTradeIns, setCustomerTradeIns] = useState<any[]>([]);
  const [showTradeInAlert, setShowTradeInAlert] = useState(false);
  
  // Manager Password
  const [showManagerPasswordModal, setShowManagerPasswordModal] = useState(false);
  const [managerPassword, setManagerPassword] = useState("");
  const [pendingManagerAction, setPendingManagerAction] = useState<{type: string; data?: any} | null>(null);
  
  // Returns/Refunds
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnSearch, setReturnSearch] = useState("");
  const [returnSales, setReturnSales] = useState<any[]>([]);
  const [selectedReturnSale, setSelectedReturnSale] = useState<any | null>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [processingReturn, setProcessingReturn] = useState(false);
  
  // Service Order Checklist View
  const [showOsChecklistModal, setShowOsChecklistModal] = useState(false);
  const [selectedOsForChecklist, setSelectedOsForChecklist] = useState<any | null>(null);
  
  // Service Order Details/Edit Modal
  const [showOsDetailsModal, setShowOsDetailsModal] = useState(false);
  const [editingServiceOrder, setEditingServiceOrder] = useState<any | null>(null);
  const [osEstimatedValue, setOsEstimatedValue] = useState("");
  const [osEvaluatedValue, setOsEvaluatedValue] = useState("");
  const [osStatus, setOsStatus] = useState("");
  const [osEvaluationStatus, setOsEvaluationStatus] = useState("");
  const [osNotes, setOsNotes] = useState("");
  const [osChecklistData, setOsChecklistData] = useState<Record<string, any>>({});
  const [osItems, setOsItems] = useState<any[]>([]);
  const [osItemSearch, setOsItemSearch] = useState("");
  const [osItemResults, setOsItemResults] = useState<any[]>([]);
  const [osItemQuantity, setOsItemQuantity] = useState(1);
  const [loadingOsItems, setLoadingOsItems] = useState(false);
  
  // Estados para Cadastros
  const [cadastroPaymentMethods, setCadastroPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cadastroSellers, setCadastroSellers] = useState<Seller[]>([]);
  const [cadastroCommissionPlans, setCadastroCommissionPlans] = useState<CommissionPlan[]>([]);
  const [cadastroPriceTables, setCadastroPriceTables] = useState<PriceTable[]>([]);
  const [cadastroPromotions, setCadastroPromotions] = useState<Promotion[]>([]);
  
  // Estados para Tipos de Produtos (Dispositivos e Acessórios)
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<any[]>([]);
  const [accessoryTypes, setAccessoryTypes] = useState<any[]>([]);
  const [editingProductType, setEditingProductType] = useState<any>(null);
  const [showProductTypeDialog, setShowProductTypeDialog] = useState(false);
  const [productTypeCategory, setProductTypeCategory] = useState<string>("device");
  
  // Estados para Depósitos e Movimentações
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [warehouseStock, setWarehouseStock] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [stockTransfers, setStockTransfers] = useState<any[]>([]);
  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [movementForm, setMovementForm] = useState<any>({ movementType: "entry", operationType: "purchase", quantity: "", serials: [] });
  const [transferForm, setTransferForm] = useState<any>({ destinationWarehouseId: "", items: [], notes: "" });
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [showLancarEstoqueDialog, setShowLancarEstoqueDialog] = useState(false);
  const [lancarEstoqueData, setLancarEstoqueData] = useState<any>({ order: null, warehouseId: "", productId: "", hasProduct: false });
  const [showNovaCompraDialog, setShowNovaCompraDialog] = useState(false);
  const [showImportarNFDialog, setShowImportarNFDialog] = useState(false);
  const [compraForm, setCompraForm] = useState<any>({ 
    supplierId: "", supplierName: "", invoiceNumber: "", invoiceDate: "", 
    warehouseId: "", notes: "", items: [] 
  });
  
  const [showPaymentMethodsDialog, setShowPaymentMethodsDialog] = useState(false);
  const [showSellersDialog, setShowSellersDialog] = useState(false);
  const [showCommissionsDialog, setShowCommissionsDialog] = useState(false);
  const [showPriceTablesDialog, setShowPriceTablesDialog] = useState(false);
  const [showPromotionsDialog, setShowPromotionsDialog] = useState(false);
  const [showCreateOsDialog, setShowCreateOsDialog] = useState(false);
  const [salesDetailData, setSalesDetailData] = useState<any[]>([]);
  const [salesDetailLoading, setSalesDetailLoading] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [reportDateTo, setReportDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [dailyCashDate, setDailyCashDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportSellerId, setReportSellerId] = useState<string>("all");
  
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [reportSubTab, setReportSubTab] = useState("os-status");
  const [reportOsByStatus, setReportOsByStatus] = useState<any[]>([]);
  const [reportOsByTech, setReportOsByTech] = useState<any[]>([]);
  const [reportSalesBySeller, setReportSalesBySeller] = useState<any[]>([]);
  const [reportMarginByImei, setReportMarginByImei] = useState<any[]>([]);
  const [reportDailyCash, setReportDailyCash] = useState<any>(null);
  const [reportStockTurnover, setReportStockTurnover] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [warrantyCache, setWarrantyCache] = useState<Record<string, boolean>>({});
  
  // Estados para Comissões
  const [commissionDashboard, setCommissionDashboard] = useState<any>(null);
  const [commissionDashboardLoading, setCommissionDashboardLoading] = useState(false);
  const [commissionMonth, setCommissionMonth] = useState(new Date().getMonth() + 1);
  const [commissionYear, setCommissionYear] = useState(new Date().getFullYear());
  const [sellerGoals, setSellerGoals] = useState<any[]>([]);
  const [storeGoals, setStoreGoals] = useState<any[]>([]);
  const [commissionClosures, setCommissionClosures] = useState<any[]>([]);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [showClosureDialog, setShowClosureDialog] = useState(false);
  const [closureCalcResult, setClosureCalcResult] = useState<any>(null);
  const [closurePeriodType, setClosurePeriodType] = useState("monthly");
  const [closureDateFrom, setClosureDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [closureDateTo, setClosureDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [closureSellerId, setClosureSellerId] = useState<string>("");
  const [closureCommissionRate, setClosureCommissionRate] = useState("5");
  
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [editingCommissionPlan, setEditingCommissionPlan] = useState<CommissionPlan | null>(null);
  const [editingPriceTable, setEditingPriceTable] = useState<PriceTable | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardStats();
    loadDevices();
    loadServiceOrders();
    loadEvaluations();
    loadChecklistTemplates();
    loadPersons();
    loadActivities();
    loadEmpresas();
    loadSellers();
  }, []);

  const loadActivities = async () => {
    try {
      const res = await fetch("/api/retail/activity-feed?limit=20", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (error) {
      console.error("Error loading activities:", error);
    }
  };
  
  const loadStockAlerts = async () => {
    try {
      const res = await fetch("/api/retail/stock-alerts", { credentials: "include" });
      if (res.ok) setStockAlerts(await res.json());
    } catch (error) {
      console.error("Error loading stock alerts:", error);
    }
  };

  const loadCashMovements = async () => {
    try {
      const res = await fetch("/api/retail/cash-movements", { credentials: "include" });
      if (res.ok) setCashMovements(await res.json());
    } catch (error) {
      console.error("Error loading cash movements:", error);
    }
  };

  const handleCreateCashMovement = async () => {
    if (!cashMovementAmount || parseFloat(cashMovementAmount) <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/retail/cash-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionId: null,
          storeId: selectedEmpresaId || 1,
          type: cashMovementType,
          amount: cashMovementAmount,
          reason: cashMovementReason
        })
      });
      if (res.ok) {
        toast({ title: cashMovementType === "withdrawal" ? "Sangria registrada!" : "Reforço registrado!" });
        setShowCashMovementDialog(false);
        setCashMovementAmount("");
        setCashMovementReason("");
        loadCashMovements();
      }
    } catch (error) {
      toast({ title: "Erro ao registrar movimentação", variant: "destructive" });
    }
  };

  const loadReportData = async (reportType: string) => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportDateFrom) params.append("dateFrom", reportDateFrom);
      if (reportDateTo) params.append("dateTo", reportDateTo);
      if (reportType === "daily-cash") params.append("date", dailyCashDate);
      
      const res = await fetch(`/api/retail/reports/${reportType}?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        switch (reportType) {
          case "os-by-status": setReportOsByStatus(data); break;
          case "os-by-technician": setReportOsByTech(data); break;
          case "sales-by-seller": setReportSalesBySeller(data); break;
          case "margin-by-imei": setReportMarginByImei(data); break;
          case "daily-cash": setReportDailyCash(data); break;
          case "stock-turnover": setReportStockTurnover(data); break;
        }
      }
    } catch (error) {
      console.error("Error loading report:", error);
    }
    setReportLoading(false);
  };

  const checkWarranty = async (imei: string) => {
    if (warrantyCache[imei] !== undefined) return;
    try {
      const res = await fetch(`/api/retail/warranties/check/${imei}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setWarrantyCache(prev => ({ ...prev, [imei]: data.hasActiveWarranty }));
      }
    } catch (error) {
      console.error("Error checking warranty:", error);
    }
  };

  const loadOsItems = async (orderId: number) => {
    try {
      setLoadingOsItems(true);
      const res = await fetch(`/api/retail/service-orders/${orderId}/items`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setOsItems(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingOsItems(false); }
  };

  const searchOsProducts = async (term: string) => {
    if (term.length < 2) { setOsItemResults([]); return; }
    try {
      const res = await fetch(`/api/soe/products?search=${encodeURIComponent(term)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setOsItemResults(Array.isArray(data) ? data.slice(0, 10) : []);
      }
    } catch (e) { console.error(e); }
  };

  const addOsItem = async (product: any) => {
    if (!editingServiceOrder) return;
    try {
      const res = await fetch(`/api/retail/service-orders/${editingServiceOrder.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId: product.id,
          itemType: "part",
          itemCode: product.code,
          itemName: product.name,
          quantity: osItemQuantity,
          unitPrice: parseFloat(product.costPrice || product.salePrice || 0),
        })
      });
      if (res.ok) {
        await loadOsItems(editingServiceOrder.id);
        setOsItemSearch("");
        setOsItemResults([]);
        setOsItemQuantity(1);
        toast({ title: "Peça adicionada!", description: product.name });
      }
    } catch (e) { toast({ title: "Erro ao adicionar peça", variant: "destructive" }); }
  };

  const removeOsItem = async (itemId: number) => {
    if (!editingServiceOrder) return;
    try {
      const res = await fetch(`/api/retail/service-orders/${editingServiceOrder.id}/items/${itemId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        await loadOsItems(editingServiceOrder.id);
        toast({ title: "Peça removida" });
      }
    } catch (e) { toast({ title: "Erro ao remover peça", variant: "destructive" }); }
  };

  useEffect(() => {
    if (activeTab === "dashboard") {
      loadStockAlerts();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "relatorios") {
      loadReportData(reportSubTab === "os-status" ? "os-by-status" : 
        reportSubTab === "os-tech" ? "os-by-technician" :
        reportSubTab === "sales-seller" ? "sales-by-seller" :
        reportSubTab === "margin-imei" ? "margin-by-imei" :
        reportSubTab === "daily-cash" ? "daily-cash" : "stock-turnover");
    }
  }, [activeTab, reportSubTab]);

  useEffect(() => {
    if (activeTab === "servicos") {
      serviceOrders.forEach(order => {
        if (order.imei) checkWarranty(order.imei);
      });
    }
  }, [activeTab, serviceOrders]);

  useEffect(() => {
    if (activeTab === "pdv") {
      loadCashMovements();
    }
  }, [activeTab]);

  // Auto-refresh activity feed every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === "dashboard") {
        loadActivities();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Carregar dados de comissões quando aba for selecionada
  useEffect(() => {
    if (activeTab === "comissoes") {
      loadCadastroSellers();
      loadCadastroCommissionPlans();
      loadCommissionDashboard();
      loadSellerGoals();
      loadStoreGoals();
      loadCommissionClosures();
    }
  }, [activeTab, commissionMonth, commissionYear]);

  // Carregar tipos de produtos quando aba Estoque for selecionada
  useEffect(() => {
    if (activeTab === "estoque") {
      loadProductTypes();
    }
  }, [activeTab]);

  // Funções de carregamento dos Cadastros
  const loadCadastroPaymentMethods = async () => {
    try {
      const res = await fetch("/api/retail/payment-methods", { credentials: "include" });
      if (res.ok) setCadastroPaymentMethods(await res.json());
    } catch (error) {
      console.error("Error loading payment methods:", error);
    }
  };

  const loadCadastroSellers = async () => {
    try {
      const res = await fetch("/api/retail/sellers", { credentials: "include" });
      if (res.ok) setCadastroSellers(await res.json());
    } catch (error) {
      console.error("Error loading sellers:", error);
    }
  };

  const loadCadastroCommissionPlans = async () => {
    try {
      const res = await fetch("/api/retail/commission-plans", { credentials: "include" });
      if (res.ok) setCadastroCommissionPlans(await res.json());
    } catch (error) {
      console.error("Error loading commission plans:", error);
    }
  };

  const loadCadastroPriceTables = async () => {
    try {
      const res = await fetch("/api/retail/price-tables", { credentials: "include" });
      if (res.ok) setCadastroPriceTables(await res.json());
    } catch (error) {
      console.error("Error loading price tables:", error);
    }
  };

  const loadCadastroPromotions = async () => {
    try {
      const res = await fetch("/api/retail/promotions", { credentials: "include" });
      if (res.ok) setCadastroPromotions(await res.json());
    } catch (error) {
      console.error("Error loading promotions:", error);
    }
  };

  const loadProductTypes = async () => {
    try {
      const res = await fetch("/api/retail/product-types", { credentials: "include" });
      if (res.ok) {
        const types = await res.json();
        setProductTypes(types);
        setDeviceTypes(types.filter((t: any) => t.category === "device"));
        setAccessoryTypes(types.filter((t: any) => t.category === "accessory"));
      }
    } catch (error) {
      console.error("Error loading product types:", error);
    }
  };

  const saveProductType = async () => {
    if (!editingProductType?.name) return;
    try {
      const method = editingProductType.id ? "PUT" : "POST";
      const url = editingProductType.id 
        ? `/api/retail/product-types/${editingProductType.id}`
        : "/api/retail/product-types";
      
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...editingProductType, category: productTypeCategory })
      });
      
      setEditingProductType(null);
      setShowProductTypeDialog(false);
      loadProductTypes();
      toast({ title: "Tipo de produto salvo!" });
    } catch (error) {
      console.error("Error saving product type:", error);
      toast({ title: "Erro ao salvar tipo de produto", variant: "destructive" });
    }
  };

  const loadWarehouses = async () => {
    try {
      const res = await fetch("/api/retail/warehouses", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data);
      }
    } catch (error) {
      console.error("Error loading warehouses:", error);
    }
  };

  const loadWarehouseStock = async (warehouseId: number) => {
    try {
      const res = await fetch(`/api/retail/warehouse-stock/${warehouseId}/summary`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setWarehouseStock(data);
      }
    } catch (error) {
      console.error("Error loading warehouse stock:", error);
    }
  };

  const loadStockMovements = async (warehouseId?: number) => {
    try {
      const url = warehouseId ? `/api/retail/stock-movements?warehouseId=${warehouseId}&limit=50` : "/api/retail/stock-movements?limit=50";
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStockMovements(data);
      }
    } catch (error) {
      console.error("Error loading stock movements:", error);
    }
  };

  const loadStockTransfers = async () => {
    try {
      const res = await fetch("/api/retail/stock-transfers", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStockTransfers(data);
      }
    } catch (error) {
      console.error("Error loading stock transfers:", error);
    }
  };

  const loadAllProducts = async () => {
    try {
      const res = await fetch("/api/soe/products", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAllProducts(data);
      }
    } catch (error) {
      console.error("Error loading products:", error);
    }
  };

  const saveStockMovement = async () => {
    if (!movementForm.productId || !movementForm.quantity || !selectedWarehouse) return;
    try {
      await fetch("/api/retail/stock-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          warehouseId: selectedWarehouse.id,
          productId: movementForm.productId,
          movementType: movementForm.movementType,
          operationType: movementForm.operationType,
          quantity: movementForm.quantity,
          unitCost: movementForm.unitCost,
          referenceNumber: movementForm.referenceNumber,
          notes: movementForm.notes,
          serials: movementForm.serials.filter((s: any) => s.imei || s.serialNumber),
        })
      });
      setShowMovementDialog(false);
      setMovementForm({ movementType: "entry", operationType: "purchase", quantity: "", serials: [] });
      loadWarehouseStock(selectedWarehouse.id);
      loadStockMovements(selectedWarehouse.id);
      toast({ title: "Movimentação registrada!" });
    } catch (error) {
      console.error("Error saving stock movement:", error);
      toast({ title: "Erro ao salvar movimentação", variant: "destructive" });
    }
  };

  const saveStockTransfer = async () => {
    if (!transferForm.destinationWarehouseId || transferForm.items.length === 0 || !selectedWarehouse) return;
    try {
      await fetch("/api/retail/stock-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceWarehouseId: selectedWarehouse.id,
          destinationWarehouseId: parseInt(transferForm.destinationWarehouseId),
          items: transferForm.items,
          notes: transferForm.notes,
        })
      });
      setShowTransferDialog(false);
      setTransferForm({ destinationWarehouseId: "", items: [], notes: "" });
      loadStockTransfers();
      toast({ title: "Transferência criada!" });
    } catch (error) {
      console.error("Error saving stock transfer:", error);
      toast({ title: "Erro ao salvar transferência", variant: "destructive" });
    }
  };

  const savePurchaseOrder = async () => {
    if (!compraForm.warehouseId || compraForm.items.length === 0) {
      toast({ title: "Preencha o depósito e adicione itens", variant: "destructive" });
      return;
    }
    try {
      for (const item of compraForm.items) {
        if (!item.productId || !item.quantity) continue;
        await fetch("/api/retail/stock-movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            warehouseId: parseInt(compraForm.warehouseId),
            productId: parseInt(item.productId),
            movementType: "entry",
            operationType: "purchase",
            quantity: item.quantity,
            unitCost: item.unitCost || "0",
            referenceNumber: compraForm.invoiceNumber,
            notes: `Fornecedor: ${compraForm.supplierName || "N/A"} | ${compraForm.notes}`,
            serials: item.serials || [],
          })
        });
      }
      setShowNovaCompraDialog(false);
      setCompraForm({ supplierId: "", supplierName: "", invoiceNumber: "", invoiceDate: "", warehouseId: "", notes: "", items: [] });
      toast({ title: "Compra registrada com sucesso!", description: `${compraForm.items.length} itens lançados no estoque` });
      if (selectedWarehouse) {
        loadWarehouseStock(selectedWarehouse.id);
        loadStockMovements(selectedWarehouse.id);
      }
    } catch (error) {
      console.error("Error saving purchase:", error);
      toast({ title: "Erro ao registrar compra", variant: "destructive" });
    }
  };

  const saveWarehouse = async () => {
    if (!editingWarehouse?.name || !editingWarehouse?.code) return;
    try {
      const method = editingWarehouse.id ? "PUT" : "POST";
      const url = editingWarehouse.id 
        ? `/api/retail/warehouses/${editingWarehouse.id}`
        : "/api/retail/warehouses";
      
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editingWarehouse)
      });
      
      setEditingWarehouse(null);
      setShowWarehouseDialog(false);
      loadWarehouses();
      toast({ title: "Depósito salvo!" });
    } catch (error) {
      console.error("Error saving warehouse:", error);
      toast({ title: "Erro ao salvar depósito", variant: "destructive" });
    }
  };

  const loadCommissionDashboard = async () => {
    setCommissionDashboardLoading(true);
    try {
      const res = await fetch(`/api/retail/commission-dashboard?month=${commissionMonth}&year=${commissionYear}`, { credentials: "include" });
      if (res.ok) setCommissionDashboard(await res.json());
    } catch (error) {
      console.error("Error loading commission dashboard:", error);
    }
    setCommissionDashboardLoading(false);
  };

  const loadSellerGoals = async () => {
    try {
      const res = await fetch(`/api/retail/seller-goals?month=${commissionMonth}&year=${commissionYear}`, { credentials: "include" });
      if (res.ok) setSellerGoals(await res.json());
    } catch (error) {
      console.error("Error loading seller goals:", error);
    }
  };

  const loadStoreGoals = async () => {
    try {
      const res = await fetch(`/api/retail/store-goals?month=${commissionMonth}&year=${commissionYear}`, { credentials: "include" });
      if (res.ok) setStoreGoals(await res.json());
    } catch (error) {
      console.error("Error loading store goals:", error);
    }
  };

  const loadCommissionClosures = async () => {
    try {
      const res = await fetch("/api/retail/commission-closures", { credentials: "include" });
      if (res.ok) setCommissionClosures(await res.json());
    } catch (error) {
      console.error("Error loading commission closures:", error);
    }
  };

  const calculateCommission = async () => {
    try {
      const res = await fetch("/api/retail/commission-closures/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sellerId: closureSellerId && closureSellerId !== "_all" ? parseInt(closureSellerId) : null,
          periodType: closurePeriodType,
          periodStart: closureDateFrom,
          periodEnd: closureDateTo,
          commissionRate: closureCommissionRate
        })
      });
      if (res.ok) {
        const result = await res.json();
        setClosureCalcResult(result);
      }
    } catch (error) {
      console.error("Error calculating commission:", error);
    }
  };

  const saveCommissionClosure = async () => {
    if (!closureCalcResult) return;
    try {
      const res = await fetch("/api/retail/commission-closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sellerId: closureSellerId && closureSellerId !== "_all" ? parseInt(closureSellerId) : null,
          periodType: closurePeriodType,
          periodStart: closureDateFrom,
          periodEnd: closureDateTo,
          totalSales: closureCalcResult.totalSales,
          totalReturns: closureCalcResult.totalReturns,
          netSales: closureCalcResult.netSales,
          commissionRate: closureCommissionRate,
          commissionAmount: closureCalcResult.commissionAmount,
          bonusAmount: closureCalcResult.bonusAmount,
          totalAmount: closureCalcResult.totalAmount,
          salesCount: closureCalcResult.salesCount,
          returnsCount: closureCalcResult.returnsCount,
          status: "closed",
          closedAt: new Date().toISOString()
        })
      });
      if (res.ok) {
        toast({ title: "Fechamento salvo", description: "O fechamento de comissão foi registrado com sucesso." });
        setShowClosureDialog(false);
        setClosureCalcResult(null);
        loadCommissionClosures();
      }
    } catch (error) {
      console.error("Error saving commission closure:", error);
    }
  };

  const saveSellerGoal = async () => {
    if (!editingGoal) return;
    try {
      const method = editingGoal.id ? "PUT" : "POST";
      const url = editingGoal.id ? `/api/retail/seller-goals/${editingGoal.id}` : "/api/retail/seller-goals";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...editingGoal,
          month: commissionMonth,
          year: commissionYear
        })
      });
      if (res.ok) {
        toast({ title: "Meta salva", description: "A meta do vendedor foi salva com sucesso." });
        setEditingGoal(null);
        setShowGoalDialog(false);
        loadSellerGoals();
        loadCommissionDashboard();
      }
    } catch (error) {
      console.error("Error saving seller goal:", error);
    }
  };

  const loadChecklistTemplates = async () => {
    try {
      const res = await fetch("/api/retail/checklist/templates", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setChecklistTemplates(data);
      }
    } catch (error) {
      console.error("Error loading checklist templates:", error);
    }
  };

  const loadPersons = async () => {
    try {
      let url = "/api/soe/persons";
      const params = new URLSearchParams();
      if (personSearch) params.append("search", personSearch);
      if (personRoleFilter && personRoleFilter !== "all") params.append("role", personRoleFilter);
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPersonsList(data);
      }
    } catch (error) {
      console.error("Error loading persons:", error);
    }
  };

  useEffect(() => {
    loadPersons();
  }, [personSearch, personRoleFilter]);

  const handleEditPerson = (person: any) => {
    setEditingPerson(person);
    setNewPerson({
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
    setShowNewPersonDialog(true);
  };
  
  const handleViewPersonHistory = async (person: any) => {
    setViewingPerson(person);
    setPersonHistory({ sales: [], services: [], tradeIns: [], credits: [] });
    try {
      const [salesRes, servicesRes, tradeInsRes, creditsRes] = await Promise.all([
        fetch(`/api/retail/persons/${person.id}/sales`, { credentials: "include" }),
        fetch(`/api/retail/persons/${person.id}/services`, { credentials: "include" }),
        fetch(`/api/retail/persons/${person.id}/trade-ins`, { credentials: "include" }),
        fetch(`/api/retail/persons/${person.id}/credits`, { credentials: "include" })
      ]);
      const [sales, services, tradeIns, credits] = await Promise.all([
        salesRes.ok ? salesRes.json() : [],
        servicesRes.ok ? servicesRes.json() : [],
        tradeInsRes.ok ? tradeInsRes.json() : [],
        creditsRes.ok ? creditsRes.json() : []
      ]);
      setPersonHistory({ sales, services, tradeIns, credits });
    } catch (error) {
      console.error("Error loading person history:", error);
    }
  };

  useEffect(() => {
    if (evalForm.cliente.length >= 2 && !evalForm.personId) {
      const filtered = personsList.filter(p => 
        p.fullName.toLowerCase().includes(evalForm.cliente.toLowerCase()) ||
        (p.cpfCnpj && p.cpfCnpj.includes(evalForm.cliente))
      );
      setEvalFilteredPersons(filtered);
      setShowEvalClientDropdown(filtered.length > 0);
    } else {
      setShowEvalClientDropdown(false);
    }
  }, [evalForm.cliente, personsList, evalForm.personId]);

  const selectEvalPerson = (person: any) => {
    setEvalForm({
      ...evalForm,
      cliente: person.fullName,
      cpf: person.cpfCnpj || "",
      personId: person.id,
      customerPhone: person.phone || ""
    });
    setShowEvalClientDropdown(false);
  };
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-eval-client-search]')) {
        setShowEvalClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickPersonSave = async () => {
    try {
      const res = await fetch("/api/soe/persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quickPerson, roles: ["customer"] }),
        credentials: "include"
      });
      if (res.ok) {
        const newPersonData = await res.json();
        toast({ title: "Cliente cadastrado!" });
        setEvalForm({
          ...evalForm,
          cliente: newPersonData.fullName,
          cpf: newPersonData.cpfCnpj || "",
          personId: newPersonData.id
        });
        setShowQuickPersonDialog(false);
        setQuickPerson({ fullName: "", cpfCnpj: "", phone: "" });
        loadPersons();
      } else {
        const errorData = await res.json();
        toast({ title: errorData.error || "Erro ao cadastrar", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro ao cadastrar cliente", variant: "destructive" });
    }
  };

  const handleApproveEvaluation = async () => {
    if (!selectedEvaluation) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/retail/evaluations/${selectedEvaluation.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: selectedProductForTradeIn })
      });
      if (res.ok) {
        const result = await res.json();
        toast({ 
          title: "Trade-In Aprovado!", 
          description: result.serviceOrder 
            ? `O.S. #${result.serviceOrder.orderNumber} criada para preparação. ${result.credit ? `Crédito de R$ ${parseFloat(result.credit.amount).toFixed(2)} gerado.` : ''}`
            : "Dispositivo encaminhado para preparação"
        });
        setShowEvaluationDetailsDialog(false);
        setSelectedEvaluation(null);
        setSelectedProductForTradeIn(null);
        setMatchingProducts([]);
        loadEvaluations();
        loadServiceOrders();
      } else {
        const errorData = await res.json();
        toast({ title: errorData.error || "Erro ao aprovar", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro ao aprovar avaliação", variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const searchMatchingProducts = async (brand: string, model: string) => {
    try {
      const res = await fetch(`/api/retail/products?search=${encodeURIComponent(brand + ' ' + model)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMatchingProducts(data);
      }
    } catch (error) {
      console.error("Error searching products:", error);
    }
  };

  const handleOpenEvaluationDetails = (evaluation: any) => {
    setSelectedEvaluation(evaluation);
    setEditingEvaluation({ ...evaluation });
    setShowEvaluationDetailsDialog(true);
    setSelectedProductForTradeIn(null);
    // Buscar produtos similares
    if (evaluation.brand && evaluation.model) {
      searchMatchingProducts(evaluation.brand, evaluation.model);
    }
  };
  
  const handleSaveEvaluation = async () => {
    if (!editingEvaluation) return;
    setSavingEvaluation(true);
    try {
      const res = await fetch(`/api/retail/evaluations/${editingEvaluation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingEvaluation),
        credentials: "include"
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedEvaluation(updated);
        toast({ title: "Avaliação salva com sucesso" });
        loadEvaluations();
      } else {
        toast({ title: "Erro ao salvar avaliação", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro ao salvar avaliação", variant: "destructive" });
    } finally {
      setSavingEvaluation(false);
    }
  };

  const handleRejectEvaluation = async (reason: string) => {
    if (!selectedEvaluation) return;
    try {
      const res = await fetch(`/api/retail/evaluations/${selectedEvaluation.id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include"
      });
      if (res.ok) {
        toast({ title: "Avaliação Rejeitada" });
        setShowEvaluationDetailsDialog(false);
        setSelectedEvaluation(null);
        loadEvaluations();
      }
    } catch (error) {
      toast({ title: "Erro ao rejeitar avaliação", variant: "destructive" });
    }
  };

  const handleCreateEvaluation = async () => {
    if (!evalForm.imei || !evalForm.marca || !evalForm.modelo || !evalForm.condicaoGeral) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    try {
      const evalRes = await fetch("/api/retail/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imei: evalForm.imei,
          brand: evalForm.marca,
          model: evalForm.modelo,
          color: evalForm.cor,
          customerName: evalForm.cliente,
          customerCpf: evalForm.cpf,
          personId: evalForm.personId,
          screenCondition: evalForm.tela,
          bodyCondition: evalForm.corpo,
          batteryHealth: evalForm.bateria ? parseInt(evalForm.bateria) : null,
          overallCondition: evalForm.condicaoGeral,
          status: "pending"
        }),
        credentials: "include"
      });
      
      if (evalRes.ok) {
        const evaluation = await evalRes.json();
        
        const orderNumber = `OS${Date.now().toString().slice(-8)}`;
        const osRes = await fetch("/api/retail/service-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderNumber,
            storeId: 1,
            imei: evalForm.imei,
            brand: evalForm.marca,
            model: evalForm.modelo,
            customerName: evalForm.cliente,
            customerPhone: evalForm.customerPhone,
            personId: evalForm.personId,
            serviceType: "diagnostic",
            issueDescription: `Avaliação de Trade-In - ${evalForm.marca} ${evalForm.modelo}`,
            origin: "device_acquisition",
            isInternal: true,
            internalType: "revision",
            sourceEvaluationId: evaluation.id,
            status: "open"
          }),
          credentials: "include"
        });
        
        if (osRes.ok) {
          toast({ title: "Avaliação e O.S. criadas com sucesso!" });
        } else {
          toast({ title: "Avaliação criada, mas erro ao criar O.S." });
        }
        
        setShowEvaluationDialog(false);
        setEvalForm({
          imei: "", cliente: "", cpf: "", personId: null, customerPhone: "", marca: "", modelo: "",
          cor: "", tela: "", corpo: "", bateria: "", condicaoGeral: ""
        });
        loadEvaluations();
        loadServiceOrders();
      } else {
        toast({ title: "Erro ao criar avaliação", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro ao criar avaliação", variant: "destructive" });
    }
  };

  const handleSavePerson = async () => {
    try {
      const personData = {
        ...newPerson,
        roles: newPerson.roles
      };
      
      let res;
      if (editingPerson) {
        res = await fetch(`/api/soe/persons/${editingPerson.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(personData),
          credentials: "include"
        });
      } else {
        res = await fetch("/api/soe/persons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(personData),
          credentials: "include"
        });
      }
      
      if (res.ok) {
        toast({ title: editingPerson ? "Pessoa atualizada!" : "Pessoa cadastrada!" });
        setShowNewPersonDialog(false);
        setEditingPerson(null);
        setNewPerson({
          fullName: "", cpfCnpj: "", email: "", phone: "", whatsapp: "",
          address: "", city: "", state: "", zipCode: "", notes: "", roles: []
        });
        loadPersons();
      } else {
        const errorData = await res.json();
        toast({ title: errorData.error || "Erro ao salvar pessoa", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error saving person:", error);
      toast({ title: "Erro ao salvar pessoa", variant: "destructive" });
    }
  };

  const togglePersonRole = (role: string) => {
    if (newPerson.roles.includes(role)) {
      setNewPerson({ ...newPerson, roles: newPerson.roles.filter(r => r !== role) });
    } else {
      setNewPerson({ ...newPerson, roles: [...newPerson.roles, role] });
    }
  };

  // Estado para preços sugeridos na aba Compras
  const [comprasPrices, setComprasPrices] = useState<Record<number, string>>({});

  // Função para abrir diálogo de lançar em estoque
  const handleLancarEstoque = (order: ServiceOrder) => {
    loadWarehouses();
    loadAllProducts();
    setLancarEstoqueData({ order, warehouseId: "", productId: "", hasProduct: false });
    setShowLancarEstoqueDialog(true);
  };
  
  // Função para confirmar lançamento em estoque
  const confirmLancarEstoque = async () => {
    const { order, warehouseId, productId, hasProduct } = lancarEstoqueData;
    if (!order || !warehouseId) {
      toast({ title: "Selecione um depósito", variant: "destructive" });
      return;
    }
    
    try {
      const acquisitionCost = parseFloat(String((order as any).estimatedValue || 0));
      const repairCost = parseFloat(String((order as any).laborCost || 0));
      const totalCost = acquisitionCost + repairCost;
      
      const priceFromState = comprasPrices[order.id];
      const sellingPrice = parseFloat(priceFromState) || (totalCost > 0 ? totalCost * 1.5 : 100);
      
      if (sellingPrice <= 0) {
        toast({ title: "Preço inválido", description: "O preço de venda deve ser maior que zero", variant: "destructive" });
        return;
      }
      
      const profitMargin = totalCost > 0 ? ((sellingPrice - totalCost) / totalCost * 100).toFixed(2) : "100.00";
      
      const deviceData = {
        imei: order.imei,
        brand: order.brand,
        model: order.model,
        color: (order as any).color || null,
        condition: "refurbished",
        status: "in_stock",
        acquisitionType: "trade_in",
        purchasePrice: String(totalCost),
        sellingPrice: String(sellingPrice),
        acquisitionCost: String(acquisitionCost),
        relatedServiceOrderId: order.id,
        suggestedPrice: String(sellingPrice),
        profitMargin: profitMargin,
        warehouseId: parseInt(warehouseId),
        productId: hasProduct && productId ? parseInt(productId) : null
      };
      
      const res = await fetch("/api/retail/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(deviceData)
      });
      
      if (res.ok) {
        const warehouseName = warehouses.find(w => w.id === parseInt(warehouseId))?.name || "Depósito";
        toast({ title: "Dispositivo lançado no estoque!", description: `${order.brand} ${order.model} adicionado em ${warehouseName}` });
        loadDevices();
        loadServiceOrders();
        setComprasPrices(prev => {
          const newPrices = { ...prev };
          delete newPrices[order.id];
          return newPrices;
        });
        setShowLancarEstoqueDialog(false);
        setLancarEstoqueData({ order: null, warehouseId: "", productId: "", hasProduct: false });
      } else {
        const error = await res.json();
        toast({ title: "Erro ao lançar em estoque", description: error.message || "Verifique os dados", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error launching to stock:", error);
      toast({ title: "Erro ao lançar em estoque", variant: "destructive" });
    }
  };

  const handleTogglePersonActive = async (personId: number, isActive: boolean) => {
    try {
      const res = await fetch(`/api/soe/persons/${personId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive })
      });
      if (res.ok) {
        toast({ title: isActive ? "Pessoa ativada!" : "Pessoa inativada!" });
        loadPersons();
      } else {
        toast({ title: "Erro ao alterar status", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error toggling person status:", error);
      toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  };

  const handleDeletePerson = async (personId: number) => {
    if (!confirm("Tem certeza que deseja excluir esta pessoa? Esta ação não pode ser desfeita.")) {
      return;
    }
    try {
      const res = await fetch(`/api/soe/persons/${personId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        toast({ title: "Pessoa excluída com sucesso!" });
        loadPersons();
      } else {
        toast({ title: "Erro ao excluir pessoa", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting person:", error);
      toast({ title: "Erro ao excluir pessoa", variant: "destructive" });
    }
  };

  // Carregar créditos do cliente
  const loadCustomerCredits = async (person: any) => {
    try {
      const res = await fetch(`/api/retail/customer-credits/${person.id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setViewingCredits({ person, credits: data.credits, totalAvailable: data.totalAvailable });
        setShowCreditsDialog(true);
      }
    } catch (error) {
      console.error("Error loading credits:", error);
      toast({ title: "Erro ao carregar créditos", variant: "destructive" });
    }
  };

  // Imprimir comprovante de crédito
  const printCreditReceipt = async (creditId: number) => {
    try {
      const res = await fetch(`/api/retail/customer-credits/${creditId}/receipt`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const receipt = data.receiptData;
        const printWindow = window.open("", "_blank", "width=400,height=600");
        if (printWindow) {
          printWindow.document.write(`
            <html>
            <head>
              <title>Comprovante de Crédito</title>
              <style>
                body { font-family: monospace; padding: 20px; max-width: 300px; margin: auto; }
                .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                .title { font-size: 16px; font-weight: bold; }
                .line { display: flex; justify-content: space-between; margin: 5px 0; }
                .amount { font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; }
                .footer { text-align: center; border-top: 2px dashed #000; padding-top: 10px; margin-top: 20px; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="title">${receipt.title}</div>
                <div>Nº ${receipt.creditNumber}</div>
              </div>
              <div class="line"><span>Cliente:</span><span>${receipt.customerName}</span></div>
              ${receipt.customerCpf ? `<div class="line"><span>CPF/CNPJ:</span><span>${receipt.customerCpf}</span></div>` : ''}
              <div class="line"><span>Origem:</span><span>${receipt.origin}</span></div>
              ${receipt.originNumber ? `<div class="line"><span>Ref:</span><span>${receipt.originNumber}</span></div>` : ''}
              <div class="amount">R$ ${parseFloat(receipt.remainingAmount).toFixed(2)}</div>
              <div class="line"><span>Valor Original:</span><span>R$ ${parseFloat(receipt.amount).toFixed(2)}</span></div>
              <div class="line"><span>Data:</span><span>${new Date(receipt.createdAt).toLocaleDateString('pt-BR')}</span></div>
              ${receipt.expiresAt ? `<div class="line"><span>Validade:</span><span>${new Date(receipt.expiresAt).toLocaleDateString('pt-BR')}</span></div>` : '<div>Válido indefinidamente</div>'}
              <div class="footer">
                <div>Apresente este comprovante</div>
                <div>para utilizar o crédito</div>
                <div style="margin-top:10px">Arcádia Retail</div>
              </div>
            </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
        }
      }
    } catch (error) {
      console.error("Error printing receipt:", error);
      toast({ title: "Erro ao gerar comprovante", variant: "destructive" });
    }
  };

  const loadTemplateDetails = async (templateId: number) => {
    try {
      const res = await fetch(`/api/retail/checklist/templates/${templateId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTemplate(data);
      }
    } catch (error) {
      console.error("Error loading template details:", error);
    }
  };

  const createTemplate = async () => {
    try {
      const res = await fetch("/api/retail/checklist/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTemplate)
      });
      if (res.ok) {
        const data = await res.json();
        setChecklistTemplates([data, ...checklistTemplates]);
        setShowNewTemplateDialog(false);
        setNewTemplate({ name: "", description: "", deviceCategory: "smartphone" });
        toast({ title: "Modelo criado com sucesso!" });
        loadTemplateDetails(data.id);
      }
    } catch (error) {
      toast({ title: "Erro ao criar modelo", variant: "destructive" });
    }
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm("Deseja excluir este modelo de checklist?")) return;
    try {
      await fetch(`/api/retail/checklist/templates/${id}`, { method: "DELETE" });
      setChecklistTemplates(checklistTemplates.filter(t => t.id !== id));
      if (selectedTemplate?.id === id) setSelectedTemplate(null);
      toast({ title: "Modelo excluído" });
    } catch (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const createChecklistItem = async () => {
    if (!selectedTemplate) return;
    try {
      const res = await fetch("/api/retail/checklist/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, templateId: selectedTemplate.id })
      });
      if (res.ok) {
        setShowNewItemDialog(false);
        setNewItem({ 
          category: "visual", itemName: "", itemDescription: "", 
          evaluationType: "condition", options: '["Perfeito","Bom","Regular","Ruim"]',
          impactOnValue: "0", isRequired: true, displayOrder: 0
        });
        loadTemplateDetails(selectedTemplate.id);
        toast({ title: "Item adicionado!" });
      }
    } catch (error) {
      toast({ title: "Erro ao adicionar item", variant: "destructive" });
    }
  };

  const updateChecklistItem = async () => {
    if (!editingItem) return;
    try {
      await fetch(`/api/retail/checklist/items/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItem)
      });
      setEditingItem(null);
      if (selectedTemplate) loadTemplateDetails(selectedTemplate.id);
      toast({ title: "Item atualizado!" });
    } catch (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const deleteChecklistItem = async (id: number) => {
    if (!confirm("Excluir este item?")) return;
    try {
      await fetch(`/api/retail/checklist/items/${id}`, { method: "DELETE" });
      if (selectedTemplate) loadTemplateDetails(selectedTemplate.id);
      toast({ title: "Item excluído" });
    } catch (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      visual: "Condição Visual",
      funcional: "Testes Funcionais",
      acessorios: "Acessórios",
      documentacao: "Documentação"
    };
    return labels[cat] || cat;
  };

  const getEvalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      condition: "Escala de Condição",
      boolean: "Sim/Não",
      percentage: "Percentual",
      text: "Texto"
    };
    return labels[type] || type;
  };

  const loadEmpresas = async () => {
    try {
      const res = await fetch("/api/soe/empresas", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEmpresas(data);
        if (data.length > 0 && !selectedEmpresaId) {
          const firstId = data[0].id;
          setSelectedEmpresaId(firstId);
          localStorage.setItem("retail_empresa_id", String(firstId));
        }
      }
    } catch (error) {
      console.error("Error loading empresas:", error);
    }
  };

  const loadSellers = async () => {
    try {
      const res = await fetch("/api/retail/sellers", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSellers(data.filter((s: any) => s.isActive !== false));
      }
    } catch (error) {
      console.error("Error loading sellers:", error);
    }
  };

  const handleSelectEmpresa = (id: string) => {
    const numId = parseInt(id);
    setSelectedEmpresaId(numId);
    localStorage.setItem("retail_empresa_id", String(numId));
  };

  const handleSelectSeller = (id: string) => {
    const numId = parseInt(id);
    setSelectedSellerId(numId);
    localStorage.setItem("retail_seller_id", String(numId));
  };

  const requireSession = (): boolean => {
    if (!selectedEmpresaId || !selectedSellerId) {
      setShowSessionRequired(true);
      return false;
    }
    return true;
  };

  const selectedEmpresa = empresas.find(e => e.id === selectedEmpresaId);
  const selectedSeller = sellers.find(s => s.id === selectedSellerId);

  const loadDashboardStats = async () => {
    try {
      const res = await fetch("/api/retail/dashboard/stats", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadDevices = async () => {
    try {
      const res = await fetch(`/api/retail/devices${searchTerm ? `?search=${searchTerm}` : ""}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (error) {
      console.error("Error loading devices:", error);
    }
  };

  const loadServiceOrders = async () => {
    try {
      const res = await fetch("/api/retail/service-orders", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setServiceOrders(data);
      }
    } catch (error) {
      console.error("Error loading service orders:", error);
    }
  };

  const loadEvaluations = async () => {
    try {
      const res = await fetch("/api/retail/evaluations", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEvaluations(data);
      }
    } catch (error) {
      console.error("Error loading evaluations:", error);
    }
  };

  const handleSearch = () => {
    loadDevices();
  };

  const formatCurrency = (value: string | number | undefined) => {
    if (!value) return "R$ 0,00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      in_stock: { variant: "default", label: "Em Estoque" },
      sold: { variant: "secondary", label: "Vendido" },
      in_service: { variant: "outline", label: "Em Serviço" },
      leased: { variant: "outline", label: "Alugado" },
      open: { variant: "default", label: "Aberta" },
      in_progress: { variant: "outline", label: "Em Andamento" },
      waiting_parts: { variant: "outline", label: "Aguardando Peças" },
      completed: { variant: "secondary", label: "Concluída" },
      cancelled: { variant: "destructive", label: "Cancelada" },
      pending: { variant: "outline", label: "Pendente" },
      in_analysis: { variant: "secondary", label: "Em Análise" },
      approved: { variant: "default", label: "Aprovado" },
      rejected: { variant: "destructive", label: "Rejeitado" },
      pending_preparation: { variant: "outline", label: "Em Preparação" }
    };
    const config = statusConfig[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getConditionBadge = (condition: string) => {
    const conditionConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      new: { variant: "default", label: "Novo" },
      refurbished: { variant: "secondary", label: "Recondicionado" },
      used: { variant: "outline", label: "Usado" },
      trade_in: { variant: "secondary", label: "Trade-In" },
      excellent: { variant: "default", label: "Excelente" },
      good: { variant: "secondary", label: "Bom" },
      fair: { variant: "outline", label: "Regular" },
      poor: { variant: "destructive", label: "Ruim" }
    };
    const config = conditionConfig[condition] || { variant: "outline" as const, label: condition };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // PDV Functions
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const cartDiscountTotal = cart.reduce((sum, item) => sum + item.discount, 0) + pdvDiscount;
  const cartTotal = cartSubtotal - cartDiscountTotal - tradeInCredit - (useCredit ? creditAmountToUse : 0);

  const addDeviceToCart = (device: MobileDevice) => {
    setPendingDevice(device);
    setImeiInput("");
    setShowImeiModal(true);
  };

  const confirmImeiAndAdd = () => {
    if (!pendingDevice) return;
    if (imeiInput !== pendingDevice.imei) {
      toast({ title: "IMEI não confere!", description: "O IMEI digitado não corresponde ao dispositivo selecionado.", variant: "destructive" });
      return;
    }
    const alreadyInCart = cart.find(item => item.imei === pendingDevice.imei);
    if (alreadyInCart) {
      toast({ title: "Dispositivo já no carrinho", variant: "destructive" });
      return;
    }
    const newItem: CartItem = {
      id: `dev-${pendingDevice.id}-${Date.now()}`,
      type: "device",
      deviceId: pendingDevice.id,
      imei: pendingDevice.imei,
      name: `${pendingDevice.brand} ${pendingDevice.model}`,
      description: `${pendingDevice.storage || ""} ${pendingDevice.color || ""} - IMEI: ${pendingDevice.imei}`,
      quantity: 1,
      unitPrice: parseFloat(pendingDevice.sellingPrice || "0"),
      discount: 0
    };
    setCart([...cart, newItem]);
    setShowImeiModal(false);
    setPendingDevice(null);
    toast({ title: "Dispositivo adicionado ao carrinho!" });
  };

  const addServiceOrderToCart = (so: ServiceOrder) => {
    const alreadyInCart = cart.find(item => item.serviceOrderId === so.id);
    if (alreadyInCart) {
      toast({ title: "O.S. já está no carrinho", variant: "destructive" });
      return;
    }
    const newItem: CartItem = {
      id: `os-${so.id}-${Date.now()}`,
      type: "service",
      serviceOrderId: so.id,
      name: `Serviço: ${so.orderNumber}`,
      description: `${so.issueDescription} - ${so.brand} ${so.model}`,
      quantity: 1,
      unitPrice: parseFloat(so.totalCost || "0"),
      discount: 0
    };
    setCart([...cart, newItem]);
    toast({ title: "O.S. adicionada ao carrinho!" });
  };

  const addProductToCart = (product: any, qty: number = 1) => {
    const existingItem = cart.find(item => item.type === "product" && item.productId === product.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === existingItem.id 
          ? { ...item, quantity: item.quantity + qty }
          : item
      ));
      toast({ title: "Quantidade atualizada no carrinho!" });
      return;
    }
    const newItem: CartItem = {
      id: `prod-${product.id}-${Date.now()}`,
      type: "product",
      productId: product.id,
      name: product.name,
      code: product.code || "",
      ncm: product.ncm || "",
      description: `${product.code} - ${product.category || ""}`,
      quantity: qty,
      unitPrice: parseFloat(product.salePrice || product.sale_price || "0"),
      discount: 0
    };
    setCart([...cart, newItem]);
    toast({ title: "Produto adicionado ao carrinho!" });
  };

  const fetchPdvProducts = async () => {
    try {
      const res = await fetch("/api/retail/pdv-products", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPdvProducts(data);
      }
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const updateItemDiscount = (itemId: string, discount: number) => {
    setCart(cart.map(item => item.id === itemId ? { ...item, discount } : item));
  };

  const selectCustomer = async (person: any) => {
    setPdvCustomer(person);
    setShowCustomerModal(false);
    toast({ title: `Cliente selecionado: ${person.fullName}` });
    
    // Buscar créditos e trade-ins do cliente
    try {
      const [creditsRes, tradeInsRes] = await Promise.all([
        fetch(`/api/retail/credits/by-person/${person.id}`, { credentials: "include" }),
        fetch(`/api/retail/customer-trade-ins/${person.id}`, { credentials: "include" })
      ]);
      
      if (creditsRes.ok) {
        const data = await creditsRes.json();
        setCustomerCredits(data.credits || []);
        setCustomerTotalCredit(data.totalAvailable || 0);
      }
      
      if (tradeInsRes.ok) {
        const data = await tradeInsRes.json();
        setCustomerTradeIns(data.tradeIns || []);
        
        // Mostrar alerta se tiver trade-ins ou créditos
        const hasApproved = data.tradeIns?.some((t: any) => t.status === "approved");
        const hasPending = data.tradeIns?.some((t: any) => t.status === "pending" || t.status === "analyzing");
        
        if (hasApproved && data.totalCredit > 0) {
          setCustomerTotalCredit(data.totalCredit);
          setShowTradeInAlert(true);
          toast({ 
            title: "Trade-In Aprovado!", 
            description: `Cliente possui R$ ${data.totalCredit.toFixed(2)} em créditos disponíveis` 
          });
        } else if (hasPending) {
          setShowTradeInAlert(true);
          toast({ 
            title: "Trade-In em Andamento", 
            description: "Cliente possui avaliação(ões) pendente(s) ou em análise" 
          });
        }
      }
    } catch (error) {
      console.error("Erro ao buscar dados do cliente:", error);
    }
  };
  
  // Função para verificar senha de gerente
  const verifyManagerPassword = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/retail/verify-manager-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, action: pendingManagerAction?.type })
      });
      return res.ok;
    } catch (error) {
      return false;
    }
  };
  
  const handleManagerPasswordSubmit = async () => {
    const authorized = await verifyManagerPassword(managerPassword);
    if (authorized) {
      setShowManagerPasswordModal(false);
      setManagerPassword("");
      
      if (pendingManagerAction?.type === "price_change" && pendingManagerAction.data) {
        // Aplicar alteração de preço
        const { itemId, newPrice } = pendingManagerAction.data;
        setCart(cart.map(item => 
          item.id === itemId ? { ...item, unitPrice: newPrice } : item
        ));
        toast({ title: "Preço alterado com autorização do gerente" });
      } else if (pendingManagerAction?.type === "discount" && pendingManagerAction.data) {
        // Aplicar desconto
        const { itemId, discount } = pendingManagerAction.data;
        setCart(cart.map(item => 
          item.id === itemId ? { ...item, discount } : item
        ));
        toast({ title: "Desconto aplicado com autorização do gerente" });
      }
      
      setPendingManagerAction(null);
    } else {
      toast({ title: "Senha incorreta", variant: "destructive" });
    }
  };
  
  const requestManagerAuthorization = (type: string, data?: any) => {
    setPendingManagerAction({ type, data });
    setShowManagerPasswordModal(true);
  };
  
  // Funções de Devolução
  const searchReturnSales = async () => {
    try {
      const params = new URLSearchParams();
      if (pdvCustomer?.id) params.append("personId", pdvCustomer.id);
      if (returnSearch) params.append("search", returnSearch);
      
      const res = await fetch(`/api/retail/sales-for-return?${params.toString()}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setReturnSales(data);
      }
    } catch (error) {
      console.error("Erro ao buscar vendas:", error);
    }
  };
  
  const processReturn = async () => {
    if (!selectedReturnSale || returnItems.length === 0) {
      toast({ title: "Selecione itens para devolução", variant: "destructive" });
      return;
    }
    
    setProcessingReturn(true);
    try {
      // Preparar itens com campos corretos
      const formattedItems = returnItems.map(item => ({
        itemCode: item.productCode || item.imei || "",
        itemName: item.itemName || item.productName || "Produto",
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || item.totalPrice || "0",
        imei: item.imei,
        deviceId: item.deviceId,
        reason: returnReason
      }));
      
      const res = await fetch("/api/retail/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          originalSaleId: selectedReturnSale.id,
          customerId: pdvCustomer?.id || selectedReturnSale.customerId,
          customerName: pdvCustomer?.fullName || selectedReturnSale.customerName,
          reason: returnReason,
          returnType: "return",
          refundMethod: "credit",
          generateCredit: returnGenerateCredit,
          creditExpirationDays: returnCreditExpiration,
          items: formattedItems
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        const creditMsg = data.credit ? ` - Crédito de R$ ${parseFloat(data.credit.amount).toFixed(2)} gerado!` : "";
        toast({ title: "Devolução processada!", description: `${data.return?.returnNumber || "Devolução registrada"}${creditMsg}` });
        setShowReturnModal(false);
        setSelectedReturnSale(null);
        setReturnItems([]);
        setReturnReason("");
        setReturnSales([]);
        
        // Atualizar créditos se gerou
        const customerId = pdvCustomer?.id || selectedReturnSale?.customerId;
        if (data.credit && customerId) {
          const creditsRes = await fetch(`/api/retail/customer-credits/${customerId}`, { credentials: "include" });
          if (creditsRes.ok) {
            const creditsData = await creditsRes.json();
            setCustomerCredits(creditsData.credits || []);
            setCustomerTotalCredit(creditsData.totalAvailable || 0);
          }
        }
        
        loadDevices();
      } else {
        const error = await res.json();
        toast({ title: error.error || "Erro ao processar devolução", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro ao processar devolução", variant: "destructive" });
    } finally {
      setProcessingReturn(false);
    }
  };
  
  const toggleReturnItem = (item: any) => {
    const exists = returnItems.find(i => i.id === item.id);
    if (exists) {
      setReturnItems(returnItems.filter(i => i.id !== item.id));
    } else {
      setReturnItems([...returnItems, item]);
    }
  };
  
  // Iniciar Análise de Trade-In
  const handleStartAnalysis = async (evaluationId: number) => {
    try {
      const res = await fetch(`/api/retail/evaluations/${evaluationId}/start-analysis`, {
        method: "PUT",
        credentials: "include"
      });
      if (res.ok) {
        toast({ title: "Avaliação em análise!" });
        loadEvaluations();
      }
    } catch (error) {
      toast({ title: "Erro ao iniciar análise", variant: "destructive" });
    }
  };

  const clearCart = () => {
    setCart([]);
    setPdvCustomer(null);
    setTradeInCredit(0);
    setPdvDiscount(0);
    setCustomerCredits([]);
    setCustomerTotalCredit(0);
    setUseCredit(false);
    setCreditAmountToUse(0);
    setPaymentMethods([]);
    setCustomerTradeIns([]);
    setShowTradeInAlert(false);
  };

  const loadAvailableOs = async () => {
    try {
      const res = await fetch("/api/retail/service-orders", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAvailableOs(data.filter((so: ServiceOrder) => 
          so.status === "awaiting_pickup" || 
          so.status === "completed" || 
          so.status === "ready_for_pickup"
        ));
      }
    } catch (error) {
      console.error("Error loading service orders:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "pdv") {
      loadDevices();
      loadAvailableOs();
      fetchPdvProducts();
    }
  }, [activeTab]);

  const printSaleOrder = (saleResult: any, cartItems: CartItem[], customer: any, empresa: any, seller: any, payments: {method: string; amount: number}[]) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const paymentLabels: Record<string, string> = {
      cash: "Dinheiro", credit: "Crédito Loja", credit_card: "Cartão de Crédito",
      debit: "Débito", debit_card: "Cartão de Débito", pix: "PIX",
      combined: "Combinado", customer_credit: "Crédito Cliente"
    };

    const itemsRows = cartItems.map((item, i) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${item.code || item.productId || item.deviceId || i + 1}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:10px">${item.ncm || '-'}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${item.name}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-family:monospace;font-size:10px">${item.imei || '-'}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${item.quantity}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">UN</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${formatCurrency(item.unitPrice)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${formatCurrency((item.unitPrice * item.quantity) - item.discount)}</td>
      </tr>
    `).join('');

    const subtotal = cartItems.reduce((s, item) => s + (item.unitPrice * item.quantity), 0);
    const totalDiscount = cartItems.reduce((s, item) => s + item.discount, 0);
    const totalFinal = parseFloat(saleResult.totalAmount || "0");

    const paymentRows = payments.length > 0 ? payments.map((pm, i) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${i + 1}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${paymentLabels[pm.method] || pm.method}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${dateStr}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${formatCurrency(pm.amount)}</td>
      </tr>
    `).join('') : `
      <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">1</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${paymentLabels[saleResult.paymentMethod] || saleResult.paymentMethod || 'Dinheiro'}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${dateStr}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${formatCurrency(totalFinal)}</td>
      </tr>
    `;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Pedido ${saleResult.saleNumber}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 2px 0; font-size: 11px; color: #555; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border: 1px solid #ddd; margin-bottom: 15px; }
  .info-cell { padding: 8px 10px; border: 1px solid #ddd; }
  .info-cell label { font-size: 10px; color: #888; display: block; margin-bottom: 2px; }
  .info-cell span { font-weight: bold; font-size: 13px; }
  .section-title { background: #f5f5f5; padding: 6px 10px; font-weight: bold; font-size: 12px; border: 1px solid #ddd; margin-top: 15px; }
  .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #ddd; }
  .customer-cell { padding: 6px 10px; border: 1px solid #ddd; font-size: 11px; }
  .customer-cell label { color: #888; font-size: 10px; margin-right: 5px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f5f5f5; padding: 6px 8px; border: 1px solid #ddd; font-size: 10px; text-transform: uppercase; }
  .totals-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0; border: 1px solid #ddd; margin-top: 0; }
  .total-cell { padding: 8px 10px; border: 1px solid #ddd; text-align: center; }
  .total-cell label { font-size: 10px; color: #888; display: block; }
  .total-cell span { font-weight: bold; font-size: 13px; }
  .warranty { font-size: 10px; line-height: 1.4; padding: 10px; border: 1px solid #ddd; margin-top: 10px; text-align: justify; }
  .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #888; }
  @media print { body { padding: 0; } }
</style></head><body>

<div class="header">
  <h1>${empresa?.nomeFantasia || empresa?.razaoSocial || 'Loja'}</h1>
  <p>${empresa?.razaoSocial || ''}</p>
  <p>CNPJ ${empresa?.cnpj || ''}</p>
  <p>${empresa?.logradouro || ''}${empresa?.numero ? ', ' + empresa.numero : ''} ${empresa?.bairro || ''} - ${empresa?.cidade || ''}${empresa?.uf ? ' - ' + empresa.uf : ''}</p>
  <p>Email: ${empresa?.email || ''} &nbsp;&nbsp; Fone: ${empresa?.phone || ''}</p>
</div>

<div class="info-grid">
  <div class="info-cell"><label>Número do Pedido</label><span>${saleResult.saleNumber}</span></div>
  <div class="info-cell"><label>Data da Emissão</label><span>${dateStr}</span></div>
  <div class="info-cell"><label>Validade Orçamento</label><span>${dateStr}</span></div>
</div>

<div class="customer-grid">
  <div class="customer-cell" style="grid-column:span 2"><label>Cliente:</label>${customer?.fullName || customer?.name || 'Consumidor'}</div>
  <div class="customer-cell"><label>CPF/CNPJ:</label>${customer?.cpfCnpj || '-'}</div>
  <div class="customer-cell"><label>Telefone:</label>${customer?.phone || customer?.celular || '-'}</div>
  <div class="customer-cell"><label>E-mail:</label>${customer?.email || '-'}</div>
  <div class="customer-cell"><label>Endereço:</label>${customer?.address || customer?.logradouro || '-'}</div>
  <div class="customer-cell"><label>Cidade:</label>${customer?.city || customer?.cidade || '-'}${customer?.state || customer?.uf ? ' - ' + (customer.state || customer.uf) : ''}</div>
  <div class="customer-cell"><label>Bairro:</label>${customer?.neighborhood || customer?.bairro || '-'}</div>
</div>

<div class="customer-grid" style="margin-top:-1px">
  <div class="customer-cell"><label>Condições:</label>${payments.length > 1 ? 'Combinado' : paymentLabels[payments[0]?.method || saleResult.paymentMethod] || 'A Vista'}</div>
  <div class="customer-cell"><label>Vendedor:</label>${seller?.name || '-'}</div>
  <div class="customer-cell"><label>Frete por conta:</label>Do Emitente</div>
  <div class="customer-cell"><label>CEP:</label>${customer?.cep || customer?.zipCode || '-'}</div>
</div>

<div class="section-title">Produtos e Serviços</div>
<table>
  <thead>
    <tr>
      <th style="width:60px">Código</th>
      <th style="width:80px">NCM</th>
      <th>Descrição</th>
      <th style="width:120px">N. Série</th>
      <th style="width:40px">Qtd.</th>
      <th style="width:35px">Un</th>
      <th style="width:95px;text-align:right">Valor Unitário</th>
      <th style="width:95px;text-align:right">Valor Total</th>
    </tr>
  </thead>
  <tbody>
    ${itemsRows}
    <tr style="font-weight:bold;background:#f9f9f9">
      <td colspan="7" style="padding:6px 8px;border:1px solid #ddd;text-align:right">Total</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${formatCurrency(subtotal - totalDiscount)}</td>
    </tr>
  </tbody>
</table>

<div class="section-title">Totais</div>
<div class="totals-grid">
  <div class="total-cell"><label>Frete</label><span>${formatCurrency(0)}</span></div>
  <div class="total-cell"><label>Desconto</label><span>${formatCurrency(totalDiscount)}</span></div>
  <div class="total-cell"><label>Total Sem Desconto</label><span>${formatCurrency(subtotal)}</span></div>
  <div class="total-cell"><label>Total Final</label><span style="color:#16a34a">${formatCurrency(totalFinal)}</span></div>
</div>

<div class="section-title">Condições de Vendas</div>
<table>
  <thead>
    <tr>
      <th style="width:60px">Nº Pagto</th>
      <th>Forma de Pagamento</th>
      <th style="width:100px">Vencimento</th>
      <th style="width:120px;text-align:right">Valor</th>
    </tr>
  </thead>
  <tbody>${paymentRows}</tbody>
</table>

<div class="section-title">Termos de Garantia</div>
<div class="warranty">
  SOBRE A GARANTIA: Garantia de acessórios de 90 dias a contar a partir da data de compra. Garantia de aparelhos Seminovos a partir da data de compra tem prazo de 3 meses para modelos abaixo do iPhone X e de 12 meses para modelos acima do iPhone 11, para aparelhos Novos 1 ano de garantia pela Apple. GARANTIA É CANCELADA automaticamente nos seguintes casos: queda, esmagamentos, sobrecargas elétricas, exposição a altas temperaturas, umidade ou líquidos, exposição a poeira ou limalha de metais ou em casos que seja constatado mau uso do aparelho, instalações, modificações ou atualizações no sistema operacional; Abertura do equipamento ou tentativa de conserto destes por terceiros que não sejam os técnicos autorizados, mesmo que para realizações de outros serviços, bem como a violação do selo/lacre de garantia. AGRADECEMOS PELA CONFIANÇA.
</div>

<div class="section-title">Observações</div>
<div class="warranty">Gerado automaticamente através do módulo PDV - Arcádia Retail</div>

<div class="footer">
  <p>Documento gerado em ${now.toLocaleString('pt-BR')} | ${empresa?.nomeFantasia || 'Arcádia Retail'}</p>
</div>

</body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const finalizeSale = async () => {
    if (!requireSession()) return;
    if (!pdvCustomer) {
      toast({ title: "Selecione um cliente", variant: "destructive" });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "Carrinho vazio", variant: "destructive" });
      return;
    }
    
    // Calcular totais com validação
    const totalCreditsUsed = tradeInCredit + (useCredit ? creditAmountToUse : 0);
    const baseTotal = cartSubtotal - cartDiscountTotal;
    const finalTotal = Math.max(0, baseTotal - totalCreditsUsed);
    
    // Validar: créditos não podem ser maiores que o valor da compra
    if (totalCreditsUsed > baseTotal) {
      toast({ title: "Créditos excedem o valor da compra", variant: "destructive" });
      return;
    }
    
    // Permitir venda com valor zero se pago integralmente com créditos
    if (finalTotal < 0) {
      toast({ title: "Total da venda inválido", variant: "destructive" });
      return;
    }
    try {
      // Determinar método de pagamento principal
      let paymentMethod = paymentMethods.length > 0 ? paymentMethods[0].method : "cash";
      if (useCredit && creditAmountToUse > 0 && finalTotal === 0) {
        paymentMethod = "customer_credit"; // Pago 100% com crédito
      }
      
      const saleData = {
        sessionId: null,
        storeId: 1,
        empresaId: selectedEmpresaId,
        sellerId: selectedSellerId,
        sellerName: selectedSeller?.name || "",
        customerId: String(pdvCustomer.id),
        personId: pdvCustomer.id,
        customerName: pdvCustomer.fullName,
        customerCpf: pdvCustomer.cpfCnpj || "",
        saleType: "direct_sale",
        subtotal: String(cartSubtotal),
        totalAmount: String(finalTotal),
        discountAmount: String(cartDiscountTotal),
        tradeInValue: String(tradeInCredit),
        creditUsed: useCredit ? String(creditAmountToUse) : "0",
        paymentMethod: paymentMethod,
        paymentMethods: paymentMethods,
        status: "completed",
        items: cart.map(item => ({
          itemType: item.type === "device" ? "device" : item.type === "service" ? "service" : "product",
          itemCode: item.deviceId ? `DEV-${item.deviceId}` : item.serviceOrderId ? `OS-${item.serviceOrderId}` : "",
          itemName: item.name,
          imei: item.imei || null,
          deviceId: item.deviceId || null,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice),
          discountAmount: String(item.discount),
          totalPrice: String((item.unitPrice * item.quantity) - item.discount)
        }))
      };
      console.log("[SALE] Enviando dados:", JSON.stringify(saleData, null, 2));
      const res = await fetch("/api/retail/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(saleData)
      });
      if (res.ok) {
        const saleResult = await res.json();
        
        // Créditos são processados atomicamente no servidor junto com a venda
        
        for (const item of cart) {
          if (item.serviceOrderId) {
            await fetch(`/api/retail/service-orders/${item.serviceOrderId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ status: "billed" })
            });
          }
        }
        printSaleOrder(saleResult, cart, pdvCustomer, selectedEmpresa, selectedSeller, paymentMethods);
        toast({ title: "Venda finalizada com sucesso!" });
        clearCart();
        setShowPaymentModal(false);
        loadDevices();
        loadDashboardStats();
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Failed to save sale");
      }
    } catch (error: any) {
      console.error("Erro ao finalizar venda:", error);
      toast({ 
        title: "Erro ao finalizar venda", 
        description: error?.message || "Verifique os dados e tente novamente",
        variant: "destructive" 
      });
    }
  };

  const handlePdvTradeIn = (tradeInData: any) => {
    setTradeInCredit(parseFloat(tradeInData.valor) || 0);
    setShowTradeInForm(false);
    toast({ title: `Trade-In de R$ ${tradeInData.valor} aplicado!` });
  };

  return (
    <BrowserFrame>
      <div className="h-full flex flex-col bg-background">
        <div className="border-b bg-muted/30 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Arcádia Retail</h1>
                <p className="text-sm text-muted-foreground">Loja e Assistência Técnica de Celulares</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-background" data-testid="session-selectors">
                <div className="flex items-center gap-1.5">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedEmpresaId ? String(selectedEmpresaId) : ""} onValueChange={handleSelectEmpresa}>
                    <SelectTrigger className="h-8 w-[180px] border-0 bg-transparent shadow-none text-sm" data-testid="select-empresa">
                      <SelectValue placeholder="Selecione a Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map(emp => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {emp.nomeFantasia || emp.razaoSocial}
                        </SelectItem>
                      ))}
                      {empresas.length === 0 && (
                        <SelectItem value="__none" disabled>Nenhuma empresa cadastrada</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-px h-6 bg-border" />
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedSellerId ? String(selectedSellerId) : ""} onValueChange={handleSelectSeller}>
                    <SelectTrigger className="h-8 w-[160px] border-0 bg-transparent shadow-none text-sm" data-testid="select-vendedor">
                      <SelectValue placeholder="Selecione o Vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {sellers.map(seller => (
                        <SelectItem key={seller.id} value={String(seller.id)}>
                          {seller.name}
                        </SelectItem>
                      ))}
                      {sellers.length === 0 && (
                        <SelectItem value="__none" disabled>Nenhum vendedor cadastrado</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { loadDashboardStats(); loadDevices(); loadServiceOrders(); loadEvaluations(); }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button size="sm" onClick={() => {
                if (requireSession()) setActiveTab("pdv");
              }}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Abrir PDV
              </Button>
            </div>
          </div>
          {(!selectedEmpresaId || !selectedSellerId) && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-800" data-testid="session-warning">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Selecione a <strong>empresa</strong> e o <strong>vendedor</strong> para iniciar as operações.</span>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">

        <Tabs value={activeTab} onValueChange={(tab) => {
          const operationalTabs = ["pdv", "servicos", "tradein", "compras"];
          if (operationalTabs.includes(tab) && (!selectedEmpresaId || !selectedSellerId)) {
            if (!requireSession()) return;
          }
          setActiveTab(tab);
          if (tab === "estoque") {
            loadWarehouses();
            loadProductTypes();
          }
        }}>
          <TabsList className="flex flex-wrap justify-start gap-1 h-auto p-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-1 text-xs px-2 py-1" data-testid="tab-dashboard">
              <BarChart3 className="h-3 w-3" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="pdv" className="flex items-center gap-1 text-xs px-2 py-1" data-testid="tab-pdv">
              <ShoppingCart className="h-3 w-3" />
              PDV
            </TabsTrigger>
            <TabsTrigger value="pessoas" className="flex items-center gap-1 text-xs px-2 py-1" data-testid="tab-pessoas">
              <Users className="h-3 w-3" />
              Pessoas
            </TabsTrigger>
            <TabsTrigger value="estoque" className="flex items-center gap-1 text-xs px-2 py-1" data-testid="tab-estoque">
              <Package className="h-3 w-3" />
              Estoque
            </TabsTrigger>
            <TabsTrigger value="servicos" className="flex items-center gap-1 text-xs px-2 py-1" data-testid="tab-servicos">
              <Wrench className="h-3 w-3" />
              Serviços
            </TabsTrigger>
            <TabsTrigger value="tradein" className="flex items-center gap-1 text-xs px-2 py-1" data-testid="tab-tradein">
              <ArrowRightLeft className="h-3 w-3" />
              Trade-In
            </TabsTrigger>
            <TabsTrigger value="compras" className="flex items-center gap-1 text-xs px-2 py-1" data-testid="tab-compras">
              <ShoppingBag className="h-3 w-3" />
              Compras
            </TabsTrigger>
            <TabsTrigger value="cadastros" className="flex items-center gap-1 text-xs px-2 py-1" data-testid="tab-cadastros">
              <ClipboardList className="h-3 w-3" />
              Cadastros
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="flex items-center gap-1 text-xs px-2 py-1" data-testid="tab-relatorios">
              <FileBarChart className="h-3 w-3" />
              Relatórios
            </TabsTrigger>
            <TabsTrigger value="comissoes" className="flex items-center gap-1 text-xs px-2 py-1" data-testid="tab-comissoes">
              <Percent className="h-3 w-3" />
              Comissões
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-1 text-xs px-2 py-1" data-testid="tab-config">
              <Settings className="h-3 w-3" />
              Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Dispositivos em Estoque</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-8 w-8 text-primary" />
                    <span className="text-3xl font-bold" data-testid="stat-devices">{stats?.devicesInStock || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Vendas Hoje</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-8 w-8 text-green-500" />
                    <div>
                      <span className="text-2xl font-bold" data-testid="stat-sales">{formatCurrency(stats?.todaySalesTotal)}</span>
                      <p className="text-xs text-muted-foreground">{stats?.todaySalesCount || 0} vendas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">OS Abertas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Wrench className="h-8 w-8 text-orange-500" />
                    <span className="text-3xl font-bold" data-testid="stat-orders">{stats?.openServiceOrders || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Trade-In Pendentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-8 w-8 text-blue-500" />
                    <span className="text-3xl font-bold" data-testid="stat-tradein">{stats?.pendingEvaluations || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-8 w-8 text-purple-500" />
                    <span className="text-2xl font-bold">
                      {stats?.todaySalesCount && stats?.todaySalesCount > 0 && stats?.todaySalesTotal
                        ? formatCurrency(stats.todaySalesTotal / stats.todaySalesCount)
                        : "R$ 0,00"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Últimas Ordens de Serviço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {serviceOrders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`order-${order.id}`}>
                        <div>
                          <p className="font-medium">{order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">{order.brand} {order.model}</p>
                          <p className="text-xs text-muted-foreground">{order.customerName}</p>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(order.status)}
                          <p className="text-sm mt-1">{formatCurrency(order.totalCost)}</p>
                        </div>
                      </div>
                    ))}
                    {serviceOrders.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">Nenhuma ordem de serviço</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5" />
                    Avaliações de Trade-In
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {evaluations.slice(0, 5).map((eval_) => (
                      <div key={eval_.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`eval-${eval_.id}`}>
                        <div>
                          <p className="font-medium">{eval_.brand} {eval_.model}</p>
                          <p className="text-sm text-muted-foreground">IMEI: {eval_.imei}</p>
                          <p className="text-xs text-muted-foreground">{eval_.customerName}</p>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(eval_.status)}
                          {eval_.overallCondition && getConditionBadge(eval_.overallCondition)}
                          <p className="text-sm font-medium mt-1">{formatCurrency(eval_.estimatedValue)}</p>
                        </div>
                      </div>
                    ))}
                    {evaluations.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">Nenhuma avaliação pendente</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {stockAlerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Produtos com Estoque Baixo
                    <Badge variant="destructive" className="ml-2">{stockAlerts.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {stockAlerts.map((product: any) => (
                      <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`stock-alert-${product.id}`}>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.code} | {product.category || "Sem categoria"}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive" data-testid={`stock-qty-${product.id}`}>
                            Estoque: {parseFloat(product.stockQty || product.stock_qty || "0").toFixed(0)}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Mín: {parseFloat(product.minStock || product.min_stock || "0").toFixed(0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Feed de Atividades
                      <Badge variant="outline" className="ml-2">
                        {activities.filter(a => !a.isRead).length} não lidas
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Acompanhe todas as atividades em tempo real (atualiza a cada 30s)
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={loadActivities} data-testid="refresh-activities">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {activities.map((activity) => (
                    <div 
                      key={activity.id} 
                      className={`flex items-start gap-3 p-3 rounded-lg border ${!activity.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                      data-testid={`activity-${activity.id}`}
                    >
                      <div className={`mt-0.5 p-1.5 rounded-full ${
                        activity.severity === 'success' ? 'bg-green-100 text-green-600' :
                        activity.severity === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                        activity.severity === 'error' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {activity.activityType === 'evaluation' ? <ArrowRightLeft className="h-4 w-4" /> :
                         activity.activityType === 'service_order' ? <Wrench className="h-4 w-4" /> :
                         activity.activityType === 'sale' ? <ShoppingCart className="h-4 w-4" /> :
                         <Clock className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{activity.title}</p>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.createdAt ? new Date(activity.createdAt).toLocaleString('pt-BR') : 'Data não disponível'}
                        </p>
                      </div>
                      {!activity.isRead && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                      )}
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma atividade registrada ainda
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pdv" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Ponto de Venda
                    </CardTitle>
                    <CardDescription className="flex items-center gap-3">
                      {selectedEmpresa && (
                        <span className="inline-flex items-center gap-1">
                          <Store className="h-3 w-3" />
                          {selectedEmpresa.nomeFantasia || selectedEmpresa.razaoSocial}
                        </span>
                      )}
                      {selectedSeller && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Vendedor: <strong>{selectedSeller.name}</strong>
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setCashMovementType("withdrawal"); setShowCashMovementDialog(true); }} data-testid="btn-sangria">
                      <Banknote className="h-4 w-4 mr-2" />
                      Sangria
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setCashMovementType("reinforcement"); setShowCashMovementDialog(true); }} data-testid="btn-reforco">
                      <Plus className="h-4 w-4 mr-2" />
                      Reforço
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowReturnModal(true)} data-testid="btn-return">
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Devolução
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowCustomerModal(true)} data-testid="btn-select-customer">
                      <Users className="h-4 w-4 mr-2" />
                      {pdvCustomer ? pdvCustomer.fullName : "Selecionar Cliente"}
                    </Button>
                    {cart.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearCart}>
                        <Trash2 className="h-4 w-4 mr-1" /> Limpar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <div className="lg:col-span-3 space-y-4">
                    <Tabs defaultValue="dispositivos" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="dispositivos">
                          <Smartphone className="h-4 w-4 mr-2" /> Dispositivos
                        </TabsTrigger>
                        <TabsTrigger value="produtos">
                          <Package className="h-4 w-4 mr-2" /> Produtos
                        </TabsTrigger>
                        <TabsTrigger value="servicos">
                          <Wrench className="h-4 w-4 mr-2" /> Faturar O.S.
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="dispositivos" className="mt-4">
                        <div className="flex gap-2 mb-4">
                          <Input 
                            placeholder="Buscar por IMEI, marca, modelo, cor, armazenamento..." 
                            value={pdvSearch}
                            onChange={(e) => setPdvSearch(e.target.value)}
                            data-testid="input-search-pdv"
                          />
                          <Button onClick={handleSearch} data-testid="btn-search-pdv">
                            <Search className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="border rounded-lg max-h-80 overflow-y-auto">
                          <div className="p-2 bg-muted/50 font-medium text-sm sticky top-0">
                            Dispositivos em Estoque ({devices.filter(d => d.status === "in_stock").length})
                          </div>
                          {devices.filter(d => d.status === "in_stock")
                            .filter(d => !pdvSearch || 
                              d.imei?.toLowerCase().includes(pdvSearch.toLowerCase()) ||
                              d.brand?.toLowerCase().includes(pdvSearch.toLowerCase()) ||
                              d.model?.toLowerCase().includes(pdvSearch.toLowerCase()) ||
                              d.color?.toLowerCase().includes(pdvSearch.toLowerCase()) ||
                              d.storage?.toLowerCase().includes(pdvSearch.toLowerCase()) ||
                              String(d.sellingPrice || (d as any).selling_price || "").includes(pdvSearch) ||
                              String(d.id).includes(pdvSearch)
                            )
                            .map((device) => (
                            <div 
                              key={device.id} 
                              className="flex items-center justify-between p-3 border-b hover:bg-muted/50"
                              data-testid={`device-${device.id}`}
                            >
                              <div className="flex-1">
                                <p className="font-medium">{device.brand} {device.model}</p>
                                <p className="text-sm text-muted-foreground">
                                  {device.storage} | {device.color} | IMEI: {device.imei}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {getConditionBadge(device.condition)}
                                  {(device as any).warehouseId && (
                                    <Badge variant="outline" className="text-xs" data-testid={`warehouse-badge-${device.id}`}>
                                      <Package className="h-3 w-3 mr-1" />
                                      {warehouses.find(w => w.id === (device as any).warehouseId)?.name || `Dep. ${(device as any).warehouseId}`}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg">{formatCurrency(device.sellingPrice)}</p>
                                <Button 
                                  size="sm" 
                                  className="mt-2" 
                                  onClick={() => addDeviceToCart(device)}
                                  disabled={cart.some(item => item.imei === device.imei)}
                                  data-testid={`btn-add-${device.id}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                                </Button>
                              </div>
                            </div>
                          ))}
                          {devices.filter(d => d.status === "in_stock").length === 0 && (
                            <p className="text-center text-muted-foreground py-8">
                              Nenhum dispositivo em estoque
                            </p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="produtos" className="mt-4">
                        <div className="flex gap-2 mb-4">
                          <Input 
                            placeholder="Buscar por nome, código, descrição, código de barras..." 
                            value={pdvProductSearch}
                            onChange={(e) => setPdvProductSearch(e.target.value)}
                            data-testid="input-search-products"
                          />
                          <Button onClick={fetchPdvProducts} variant="outline" data-testid="btn-refresh-products">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="border rounded-lg max-h-80 overflow-y-auto">
                          <div className="p-2 bg-muted/50 font-medium text-sm sticky top-0">
                            Produtos Disponíveis ({pdvProducts.filter(p => p.status === "active").length})
                          </div>
                          {pdvProducts
                            .filter(p => p.status === "active")
                            .filter(p => !pdvProductSearch || 
                              p.name?.toLowerCase().includes(pdvProductSearch.toLowerCase()) ||
                              p.code?.toLowerCase().includes(pdvProductSearch.toLowerCase()) ||
                              p.category?.toLowerCase().includes(pdvProductSearch.toLowerCase()) ||
                              p.description?.toLowerCase().includes(pdvProductSearch.toLowerCase()) ||
                              p.barcode?.toLowerCase().includes(pdvProductSearch.toLowerCase()) ||
                              p.ncm?.toLowerCase().includes(pdvProductSearch.toLowerCase())
                            )
                            .map((product) => (
                            <div 
                              key={product.id} 
                              className="flex items-center justify-between p-3 border-b hover:bg-muted/50"
                              data-testid={`product-${product.id}`}
                            >
                              <div className="flex-1">
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {product.code} | {product.category || "Sem categoria"}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    Estoque: {parseFloat(product.stockQty || product.stock_qty || "0").toFixed(0)} {product.unit || "UN"}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg">{formatCurrency(product.salePrice || product.sale_price)}</p>
                                <Button 
                                  size="sm" 
                                  className="mt-2" 
                                  onClick={() => addProductToCart(product)}
                                  data-testid={`btn-add-product-${product.id}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                                </Button>
                              </div>
                            </div>
                          ))}
                          {pdvProducts.filter(p => p.status === "active").length === 0 && (
                            <p className="text-center text-muted-foreground py-8">
                              Nenhum produto cadastrado
                            </p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="servicos" className="mt-4">
                        <div className="flex gap-2 mb-4">
                          <Input 
                            placeholder="Buscar O.S. por número ou cliente..." 
                            value={pdvOsSearch}
                            onChange={(e) => setPdvOsSearch(e.target.value)}
                            data-testid="input-search-os"
                          />
                          <Button onClick={loadAvailableOs} variant="outline">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="border rounded-lg max-h-80 overflow-y-auto">
                          <div className="p-2 bg-muted/50 font-medium text-sm sticky top-0">
                            O.S. Aguardando Faturamento ({availableOs.length})
                          </div>
                          {availableOs
                            .filter(os => !pdvOsSearch || 
                              os.orderNumber.toLowerCase().includes(pdvOsSearch.toLowerCase()) ||
                              os.customerName.toLowerCase().includes(pdvOsSearch.toLowerCase())
                            )
                            .map((os) => (
                            <div 
                              key={os.id} 
                              className="flex items-center justify-between p-3 border-b hover:bg-muted/50"
                              data-testid={`os-${os.id}`}
                            >
                              <div className="flex-1">
                                <p className="font-medium">{os.orderNumber}</p>
                                <p className="text-sm text-muted-foreground">{os.customerName}</p>
                                <p className="text-xs text-muted-foreground">{os.brand} {os.model} - {os.issueDescription}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg text-green-600">{formatCurrency(os.totalCost)}</p>
                                <Button 
                                  size="sm" 
                                  className="mt-2"
                                  onClick={() => addServiceOrderToCart(os)}
                                  disabled={cart.some(item => item.serviceOrderId === os.id)}
                                  data-testid={`btn-add-os-${os.id}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Faturar
                                </Button>
                              </div>
                            </div>
                          ))}
                          {availableOs.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">
                              Nenhuma O.S. aguardando faturamento
                            </p>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    <div className="border rounded-lg p-4 sticky top-4">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Carrinho ({cart.length} {cart.length === 1 ? "item" : "itens"})
                      </h3>
                      
                      {cart.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Carrinho vazio. Adicione produtos para iniciar a venda.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {cart.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                                {item.type === "device" && (
                                  <Badge variant="outline" className="mt-1 text-xs">
                                    <Smartphone className="h-3 w-3 mr-1" /> Celular
                                  </Badge>
                                )}
                                {item.type === "service" && (
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    <Wrench className="h-3 w-3 mr-1" /> Serviço
                                  </Badge>
                                )}
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <span className="font-bold">{formatCurrency(item.unitPrice)}</span>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => removeFromCart(item.id)}
                                  data-testid={`btn-remove-${item.id}`}
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="border-t pt-4 mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(cartSubtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Desconto:</span>
                          <span className="text-red-500">- {formatCurrency(cartDiscountTotal)}</span>
                        </div>
                        {tradeInCredit > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Trade-In:</span>
                            <span className="text-green-600">- {formatCurrency(tradeInCredit)}</span>
                          </div>
                        )}
                        {useCredit && creditAmountToUse > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Crédito:</span>
                            <span className="text-blue-600">- {formatCurrency(creditAmountToUse)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-xl border-t pt-2">
                          <span>Total:</span>
                          <span className="text-primary">{formatCurrency(cartTotal > 0 ? cartTotal : 0)}</span>
                        </div>
                        {customerTotalCredit > 0 && !useCredit && (
                          <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm" data-testid="credit-available-hint">
                            <Gift className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <span className="text-blue-700">
                              Crédito disponível: <strong>{formatCurrency(customerTotalCredit)}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 mt-4">
                        <Button 
                          variant="outline" 
                          className="flex-1" 
                          onClick={() => {
                            if (pdvCustomer) {
                              // Buscar avaliações do cliente
                              const customerEvals = evaluations.filter((e: any) => 
                                e.customerName?.toLowerCase().includes(pdvCustomer.fullName?.toLowerCase()) ||
                                e.personId === pdvCustomer.id
                              );
                              if (customerEvals.length > 0) {
                                // Abrir a primeira avaliação pendente para impressão/ajuste
                                const pendingEval = customerEvals.find((e: any) => e.status === 'pending') || customerEvals[0];
                                handleOpenEvaluationDetails(pendingEval);
                              } else {
                                setShowTradeInForm(true);
                              }
                            } else {
                              setShowTradeInForm(true);
                            }
                          }}
                          data-testid="btn-tradein-pdv"
                        >
                          <ArrowRightLeft className="h-4 w-4 mr-2" />
                          Trade-In
                        </Button>
                      </div>
                      <Button 
                        className="w-full mt-2" 
                        size="lg"
                        disabled={cart.length === 0 || !pdvCustomer}
                        onClick={() => {
                          // Pré-selecionar dinheiro como padrão
                          setPaymentMethods([{ method: "cash", amount: cartTotal }]);
                          setShowPaymentModal(true);
                        }}
                        data-testid="btn-finalizar"
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Finalizar Venda
                      </Button>
                      {!pdvCustomer && cart.length > 0 && (
                        <p className="text-xs text-center text-muted-foreground mt-2">
                          Selecione um cliente para finalizar
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pessoas" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Cadastro Unificado de Pessoas
                    </CardTitle>
                    <CardDescription>
                      Gerencie clientes, fornecedores, colaboradores e técnicos em um só lugar.
                      Uma pessoa pode ter múltiplos papéis no sistema.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => window.location.href = '/soe'}
                      data-testid="btn-goto-soe"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Arcádia SOE
                    </Button>
                    <Button onClick={() => setShowNewPersonDialog(true)} data-testid="btn-new-person">
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Pessoa
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por nome, CPF/CNPJ, telefone..." 
                      className="pl-10"
                      value={personSearch}
                      onChange={(e) => setPersonSearch(e.target.value)}
                      data-testid="input-person-search"
                    />
                  </div>
                  <Select value={personRoleFilter} onValueChange={setPersonRoleFilter}>
                    <SelectTrigger className="w-[200px]" data-testid="select-person-role">
                      <SelectValue placeholder="Filtrar por papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os papéis</SelectItem>
                      <SelectItem value="customer">Clientes</SelectItem>
                      <SelectItem value="supplier">Fornecedores</SelectItem>
                      <SelectItem value="employee">Colaboradores</SelectItem>
                      <SelectItem value="technician">Técnicos</SelectItem>
                      <SelectItem value="partner">Parceiros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Nome</th>
                        <th className="text-left p-3 font-medium">CPF/CNPJ</th>
                        <th className="text-left p-3 font-medium">Contato</th>
                        <th className="text-left p-3 font-medium">Papéis</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-right p-3 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personsList.length > 0 ? personsList.map((person: any) => (
                        <tr key={person.id} className="border-t hover:bg-muted/30" data-testid={`row-person-${person.id}`}>
                          <td className="p-3">
                            <div className="font-medium">{person.fullName}</div>
                            <div className="text-sm text-muted-foreground">{person.email}</div>
                          </td>
                          <td className="p-3">{person.cpfCnpj || "-"}</td>
                          <td className="p-3">
                            <div>{person.phone || "-"}</div>
                            {person.whatsapp && <div className="text-sm text-green-600">WhatsApp: {person.whatsapp}</div>}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1 flex-wrap">
                              {person.roles?.map((role: any) => (
                                <Badge 
                                  key={role.id || role.roleType} 
                                  variant={
                                    role.roleType === "customer" ? "default" :
                                    role.roleType === "supplier" ? "secondary" :
                                    role.roleType === "technician" ? "outline" :
                                    "default"
                                  }
                                  className="text-xs"
                                >
                                  {role.roleType === "customer" ? "Cliente" :
                                   role.roleType === "supplier" ? "Fornecedor" :
                                   role.roleType === "employee" ? "Colaborador" :
                                   role.roleType === "technician" ? "Técnico" :
                                   role.roleType === "partner" ? "Parceiro" : role.roleType}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant={person.isActive ? "default" : "destructive"}>
                              {person.isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => loadCustomerCredits(person)} data-testid={`btn-credits-person-${person.id}`} title="Ver Créditos">
                                <CreditCard className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleViewPersonHistory(person)} data-testid={`btn-view-person-${person.id}`} title="Ver Histórico">
                                <FileText className="h-4 w-4 text-blue-500" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEditPerson(person)} data-testid={`btn-edit-person-${person.id}`} title="Editar">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleTogglePersonActive(person.id, !person.isActive)} 
                                data-testid={`btn-toggle-person-${person.id}`}
                                title={person.isActive ? "Inativar" : "Ativar"}
                              >
                                {person.isActive ? <XCircle className="h-4 w-4 text-orange-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeletePerson(person.id)} 
                                data-testid={`btn-delete-person-${person.id}`}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            Nenhuma pessoa cadastrada. Clique em "Nova Pessoa" para começar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="estoque" className="space-y-6">
            {/* Depósitos */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Depósitos
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { loadWarehouses(); loadStockTransfers(); }}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Atualizar
                    </Button>
                    <Button size="sm" onClick={() => { setEditingWarehouse({}); setShowWarehouseDialog(true); }} data-testid="button-new-warehouse">
                      <Plus className="h-4 w-4 mr-1" />
                      Novo Depósito
                    </Button>
                  </div>
                </div>
                <CardDescription>Gerenciamento de depósitos, saldos e transferências de estoque</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Lista de Depósitos */}
                  <div className="space-y-2 border-r pr-4">
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Depósitos Cadastrados</h4>
                    {warehouses.length > 0 ? warehouses.map((wh: any) => (
                      <div 
                        key={wh.id} 
                        className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${selectedWarehouse?.id === wh.id ? 'bg-blue-50 border-blue-300' : ''}`}
                        onClick={() => { setSelectedWarehouse(wh); loadWarehouseStock(wh.id); loadStockMovements(wh.id); loadStockTransfers(); }}
                        data-testid={`warehouse-card-${wh.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium" data-testid={`warehouse-name-${wh.id}`}>{wh.name}</p>
                            <p className="text-xs text-muted-foreground">Código: {wh.code}</p>
                          </div>
                          <div className="flex gap-1">
                            {wh.isDefault && <Badge variant="outline" className="text-xs" data-testid={`warehouse-default-badge-${wh.id}`}>Padrão</Badge>}
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingWarehouse(wh); setShowWarehouseDialog(true); }} data-testid={`button-edit-warehouse-${wh.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {wh.type && <Badge variant="secondary" className="text-xs mt-1">{wh.type === "store" ? "Loja" : wh.type === "central" ? "Central" : wh.type}</Badge>}
                      </div>
                    )) : (
                      <p className="text-center text-muted-foreground py-4 text-sm" data-testid="text-no-warehouses">Nenhum depósito cadastrado</p>
                    )}
                  </div>
                  
                  {/* Saldo do Depósito Selecionado */}
                  <div className="col-span-2">
                    {selectedWarehouse ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium" data-testid="text-warehouse-balance-title">Saldo em: {selectedWarehouse.name}</h4>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setShowTransferDialog(true)} data-testid="button-new-transfer">
                              <ArrowRightLeft className="h-4 w-4 mr-1" />
                              Transferir
                            </Button>
                            <Button size="sm" onClick={() => setShowMovementDialog(true)} data-testid="button-new-movement">
                              <Plus className="h-4 w-4 mr-1" />
                              Movimentação
                            </Button>
                          </div>
                        </div>
                        
                        {warehouseStock.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead className="text-right">Qtd</TableHead>
                                <TableHead className="text-right">Reservado</TableHead>
                                <TableHead className="text-right">Disponível</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {warehouseStock.map((item: any) => (
                                <TableRow key={item.id}>
                                  <td className="py-2">
                                    <p className="font-medium">{item.productName}</p>
                                    <p className="text-xs text-muted-foreground">{item.productCode}</p>
                                  </td>
                                  <td className="text-right">{parseFloat(item.quantity || 0).toFixed(2)}</td>
                                  <td className="text-right text-orange-600">{parseFloat(item.reservedQuantity || 0).toFixed(2)}</td>
                                  <td className="text-right text-green-600 font-medium">{parseFloat(item.availableQuantity || 0).toFixed(2)}</td>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">Nenhum produto em estoque neste depósito</p>
                        )}
                        
                        {/* Últimas Movimentações */}
                        {stockMovements.length > 0 && (
                          <div className="mt-4">
                            <h5 className="font-medium text-sm mb-2" data-testid="title-recent-movements">Últimas Movimentações</h5>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {stockMovements.slice(0, 10).map((mov: any) => (
                                <div key={mov.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded" data-testid={`movement-row-${mov.id}`}>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={mov.movementType === "entry" ? "default" : mov.movementType === "exit" ? "destructive" : "outline"} className="text-xs">
                                      {mov.movementType === "entry" ? "Entrada" : mov.movementType === "exit" ? "Saída" : mov.movementType === "transfer_in" ? "Transf. Entrada" : mov.movementType === "transfer_out" ? "Transf. Saída" : mov.movementType}
                                    </Badge>
                                    <span>{mov.operationType}</span>
                                  </div>
                                  <span className={mov.movementType === "entry" || mov.movementType === "transfer_in" ? "text-green-600" : "text-red-600"}>
                                    {mov.movementType === "entry" || mov.movementType === "transfer_in" ? "+" : "-"}{parseFloat(mov.quantity).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Histórico de Transferências */}
                        {stockTransfers.length > 0 && (
                          <div className="mt-4">
                            <h5 className="font-medium text-sm mb-2" data-testid="title-transfers-history">Transferências</h5>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {stockTransfers.slice(0, 5).map((transfer: any) => (
                                <div key={transfer.id} className="flex items-center justify-between text-sm p-2 bg-purple-50 rounded" data-testid={`transfer-row-${transfer.id}`}>
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant={transfer.status === "completed" ? "default" : transfer.status === "in_transit" ? "secondary" : "outline"} 
                                      className="text-xs"
                                    >
                                      {transfer.status === "completed" ? "Concluída" : transfer.status === "in_transit" ? "Em Trânsito" : transfer.status === "pending" ? "Pendente" : transfer.status === "cancelled" ? "Cancelada" : transfer.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{transfer.transferNumber}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(transfer.createdAt).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mb-4 opacity-30" />
                        <p>Selecione um depósito para ver o saldo</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tipos de Dispositivos e Acessórios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipos de Dispositivos */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Smartphone className="h-5 w-5 text-blue-600" />
                      Tipos de Dispositivos
                    </CardTitle>
                    <Button size="sm" onClick={() => { setProductTypeCategory("device"); setEditingProductType({}); setShowProductTypeDialog(true); }}>
                      <Plus className="h-4 w-4 mr-1" />
                      Novo
                    </Button>
                  </div>
                  <CardDescription>Produtos com IMEI/série (celulares, tablets, smartwatches)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {deviceTypes.length > 0 ? deviceTypes.map((type: any) => (
                      <div key={type.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50">
                        <div>
                          <p className="font-medium">{type.name}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {type.ncm && <span>NCM: {type.ncm}</span>}
                            {type.cfopVendaEstadual && <span>CFOP: {type.cfopVendaEstadual}</span>}
                            {type.requiresImei && <Badge variant="outline" className="text-xs">IMEI</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setProductTypeCategory("device"); setEditingProductType(type); setShowProductTypeDialog(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={async () => {
                            if (confirm("Excluir este tipo?")) {
                              await fetch(`/api/retail/product-types/${type.id}`, { method: "DELETE", credentials: "include" });
                              loadProductTypes();
                            }
                          }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )) : (
                      <p className="text-center text-muted-foreground py-4">Nenhum tipo cadastrado</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Tipos de Acessórios */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Headphones className="h-5 w-5 text-purple-600" />
                      Tipos de Acessórios
                    </CardTitle>
                    <Button size="sm" onClick={() => { setProductTypeCategory("accessory"); setEditingProductType({}); setShowProductTypeDialog(true); }}>
                      <Plus className="h-4 w-4 mr-1" />
                      Novo
                    </Button>
                  </div>
                  <CardDescription>Produtos sem série (capas, películas, cabos, carregadores)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {accessoryTypes.length > 0 ? accessoryTypes.map((type: any) => (
                      <div key={type.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50">
                        <div>
                          <p className="font-medium">{type.name}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {type.ncm && <span>NCM: {type.ncm}</span>}
                            {type.cfopVendaEstadual && <span>CFOP: {type.cfopVendaEstadual}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setProductTypeCategory("accessory"); setEditingProductType(type); setShowProductTypeDialog(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={async () => {
                            if (confirm("Excluir este tipo?")) {
                              await fetch(`/api/retail/product-types/${type.id}`, { method: "DELETE", credentials: "include" });
                              loadProductTypes();
                            }
                          }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )) : (
                      <p className="text-center text-muted-foreground py-4">Nenhum tipo cadastrado</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Estoque de Dispositivos */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Estoque de Dispositivos
                    </CardTitle>
                    <CardDescription>Gerencie o estoque por IMEI</CardDescription>
                  </div>
                  <Button onClick={() => setShowNewDeviceDialog(true)} data-testid="btn-new-device">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Dispositivo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input 
                    placeholder="Buscar por IMEI, marca ou modelo..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    data-testid="input-search-estoque"
                  />
                  <Button onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3">IMEI</th>
                        <th className="text-left p-3">Dispositivo</th>
                        <th className="text-left p-3">Condição</th>
                        <th className="text-left p-3">Preço</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((device) => (
                        <tr key={device.id} className="border-t" data-testid={`row-device-${device.id}`}>
                          <td className="p-3 font-mono text-sm">{device.imei}</td>
                          <td className="p-3">
                            <p className="font-medium">{device.brand} {device.model}</p>
                            <p className="text-sm text-muted-foreground">{device.storage} | {device.color}</p>
                          </td>
                          <td className="p-3">{getConditionBadge(device.condition)}</td>
                          <td className="p-3 font-medium">{formatCurrency(device.sellingPrice)}</td>
                          <td className="p-3">{getStatusBadge(device.status)}</td>
                          <td className="p-3">
                            <Button variant="ghost" size="sm">
                              <ClipboardList className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {devices.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum dispositivo cadastrado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="servicos" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Ordens de Serviço
                    </CardTitle>
                    <CardDescription>Gestão de assistência técnica</CardDescription>
                  </div>
                  <Button onClick={() => setShowNewServiceDialog(true)} data-testid="btn-new-service">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova OS
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3">Número</th>
                        <th className="text-left p-3">Dispositivo</th>
                        <th className="text-left p-3">Cliente</th>
                        <th className="text-left p-3">Problema</th>
                        <th className="text-left p-3">Valor</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceOrders.map((order) => (
                        <tr 
                          key={order.id} 
                          className={`border-t ${order.isInternal ? 'bg-amber-50' : ''} hover:bg-muted/50 cursor-pointer`} 
                          data-testid={`row-order-${order.id}`}
                          onClick={() => {
                            setEditingServiceOrder(order);
                            setOsStatus(order.status || "open");
                            setOsEvaluationStatus((order as any).evaluationStatus || "pending");
                            setOsEstimatedValue(String((order as any).estimatedValue || order.totalCost || 0));
                            setOsEvaluatedValue(String((order as any).evaluatedValue || (order as any).estimatedValue || order.totalCost || 0));
                            setOsNotes((order as any).diagnosisNotes || "");
                            setOsChecklistData((order as any).checklistData || {});
                            loadOsItems(order.id);
                            setShowOsDetailsModal(true);
                          }}
                        >
                          <td className="p-3 font-mono">
                            {order.orderNumber}
                            {order.isInternal && (
                              <span className="ml-2 px-2 py-0.5 bg-amber-200 text-amber-800 text-xs rounded">Trade-In</span>
                            )}
                          </td>
                          <td className="p-3">
                            <p className="font-medium">{order.brand} {order.model}</p>
                            <p className="text-sm text-muted-foreground">IMEI: {order.imei}</p>
                            {order.imei && warrantyCache[order.imei] && (
                              <Badge variant="default" className="bg-green-600 text-white mt-1" data-testid={`warranty-badge-${order.id}`}>Em Garantia</Badge>
                            )}
                          </td>
                          <td className="p-3">
                            <p>{order.customerName}</p>
                            <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                          </td>
                          <td className="p-3 max-w-xs truncate">{order.issueDescription}</td>
                          <td className="p-3 font-medium">{formatCurrency(order.totalCost)}</td>
                          <td className="p-3">{getStatusBadge(order.status)}</td>
                          <td className="p-3 flex gap-1" onClick={(e) => e.stopPropagation()}>
                            {order.isInternal && order.status !== "completed" && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-green-600 border-green-600 hover:bg-green-50"
                                onClick={async () => {
                                  const sellingPrice = window.prompt("Preço de venda sugerido (R$):");
                                  try {
                                    const res = await fetch(`/api/retail/service-orders/${order.id}/complete-preparation`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      credentials: "include",
                                      body: JSON.stringify({ sellingPrice, notes: "Preparação concluída" })
                                    });
                                    if (res.ok) {
                                      toast({ title: "Preparação concluída!", description: "Dispositivo liberado para estoque" });
                                      loadServiceOrders();
                                      loadDevices();
                                    }
                                  } catch (error) {
                                    toast({ title: "Erro", variant: "destructive" });
                                  }
                                }}
                                data-testid={`btn-complete-prep-${order.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Concluir
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingServiceOrder(order);
                                setOsStatus(order.status || "open");
                                setOsEvaluationStatus((order as any).evaluationStatus || "pending");
                                setOsEstimatedValue(String((order as any).estimatedValue || order.totalCost || 0));
                                setOsEvaluatedValue(String((order as any).evaluatedValue || (order as any).estimatedValue || order.totalCost || 0));
                                setOsNotes((order as any).diagnosisNotes || "");
                                setOsChecklistData((order as any).checklistData || {});
                                loadOsItems(order.id);
                                setShowOsDetailsModal(true);
                              }}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {serviceOrders.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma ordem de serviço
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tradein" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRightLeft className="h-5 w-5" />
                      Avaliações de Trade-In
                    </CardTitle>
                    <CardDescription>Avalie dispositivos usados para troca</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowEvaluationDialog(true)} data-testid="btn-quick-evaluation">
                      <Plus className="h-4 w-4 mr-2" />
                      Avaliação Rápida
                    </Button>
                    <Button onClick={() => setShowTradeInForm(true)} data-testid="btn-new-evaluation">
                      <FileCheck className="h-4 w-4 mr-2" />
                      Formulário Completo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3">IMEI</th>
                        <th className="text-left p-3">Dispositivo</th>
                        <th className="text-left p-3">Cliente</th>
                        <th className="text-left p-3">Condição</th>
                        <th className="text-left p-3">Valor Estimado</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluations.map((eval_) => (
                        <tr 
                          key={eval_.id} 
                          className="border-t hover:bg-muted/50 cursor-pointer" 
                          data-testid={`row-eval-${eval_.id}`}
                          onClick={() => handleOpenEvaluationDetails(eval_)}
                        >
                          <td className="p-3 font-mono text-sm">{eval_.imei}</td>
                          <td className="p-3 font-medium">{eval_.brand} {eval_.model}</td>
                          <td className="p-3">{eval_.customerName || "-"}</td>
                          <td className="p-3">{eval_.overallCondition && getConditionBadge(eval_.overallCondition)}</td>
                          <td className="p-3 font-medium">{formatCurrency(eval_.estimatedValue)}</td>
                          <td className="p-3">{getStatusBadge(eval_.status)}</td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            {eval_.status === "pending" && (
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-green-600" 
                                  data-testid={`btn-approve-${eval_.id}`}
                                  onClick={() => handleOpenEvaluationDetails(eval_)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-600" 
                                  data-testid={`btn-reject-${eval_.id}`}
                                  onClick={() => handleOpenEvaluationDetails(eval_)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {evaluations.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma avaliação de trade-in
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transferencias" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Transferências de Estoque
                    </CardTitle>
                    <CardDescription>Movimentação entre lojas e distribuidoras</CardDescription>
                  </div>
                  <Button data-testid="btn-new-transfer">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Transferência
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma transferência registrada
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Compras/Aquisições */}
          <TabsContent value="compras" className="space-y-6">
            {/* Ações de Compra */}
            <div className="flex gap-4">
              <Button onClick={() => { loadWarehouses(); loadAllProducts(); setShowNovaCompraDialog(true); }} data-testid="button-nova-compra">
                <Plus className="h-4 w-4 mr-2" />
                Nova Compra
              </Button>
              <Button variant="outline" onClick={() => { loadWarehouses(); loadAllProducts(); setShowImportarNFDialog(true); }} data-testid="button-importar-nf">
                <FileText className="h-4 w-4 mr-2" />
                Importar NF-e
              </Button>
            </div>

            {/* Seção: OS Internas Concluídas - Prontas para Estoque */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-orange-600" />
                      Manutenções Concluídas
                    </CardTitle>
                    <CardDescription>Dispositivos com manutenção interna concluída, prontos para precificação</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-orange-600">
                    {serviceOrders.filter(o => o.isInternal && o.status === "completed").length} pendentes
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IMEI</TableHead>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead>Custo Aquisição</TableHead>
                      <TableHead>Custo Reparo</TableHead>
                      <TableHead>Custo Total</TableHead>
                      <TableHead>Preço Venda</TableHead>
                      <TableHead>Margem</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceOrders.filter(o => o.isInternal && o.status === "completed").map((order) => {
                      const acquisitionCost = parseFloat(String((order as any).estimatedValue || 0));
                      const repairCost = parseFloat(String((order as any).laborCost || 0));
                      const totalCost = acquisitionCost + repairCost;
                      const suggestedPrice = totalCost * 1.5;
                      
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">{order.imei}</TableCell>
                          <TableCell className="font-medium">{order.brand} {order.model}</TableCell>
                          <TableCell>{formatCurrency(acquisitionCost)}</TableCell>
                          <TableCell>{formatCurrency(repairCost)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(totalCost)}</TableCell>
                          <TableCell>
                            <Input 
                              type="number" 
                              className="w-28 h-8 text-sm"
                              value={comprasPrices[order.id] ?? suggestedPrice.toFixed(2)}
                              onChange={(e) => setComprasPrices(prev => ({ ...prev, [order.id]: e.target.value }))}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-green-600">
                              {totalCost > 0 ? `${(((parseFloat(comprasPrices[order.id] || String(suggestedPrice)) - totalCost) / totalCost) * 100).toFixed(0)}%` : "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-green-600"
                              onClick={() => handleLancarEstoque(order)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Lançar Estoque
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {serviceOrders.filter(o => o.isInternal && o.status === "completed").length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma manutenção concluída aguardando entrada em estoque
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Seção: Avaliações Aprovadas - Aguardando Manutenção */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                      Avaliações Aprovadas
                    </CardTitle>
                    <CardDescription>Trade-Ins aprovados aguardando criação de ordem de manutenção</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-blue-600">
                    {evaluations.filter(e => e.status === "approved" && !e.maintenanceOrderId).length} pendentes
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IMEI</TableHead>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor Estimado</TableHead>
                      <TableHead>Data Avaliação</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluations.filter(e => e.status === "approved" && !e.maintenanceOrderId).map((evaluation) => (
                      <TableRow key={evaluation.id}>
                        <TableCell className="font-mono text-sm">{evaluation.imei}</TableCell>
                        <TableCell className="font-medium">{evaluation.brand} {evaluation.model}</TableCell>
                        <TableCell>{evaluation.customerName}</TableCell>
                        <TableCell className="text-green-600 font-medium">{formatCurrency(evaluation.estimatedValue || 0)}</TableCell>
                        <TableCell>{evaluation.evaluationDate ? new Date(evaluation.evaluationDate).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedEvaluation(evaluation);
                              setShowCreateOsDialog(true);
                            }}
                          >
                            <Wrench className="h-4 w-4 mr-1" />
                            Criar OS Manutenção
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {evaluations.filter(e => e.status === "approved" && !e.maintenanceOrderId).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma avaliação aprovada aguardando manutenção
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Seção: Dispositivos Recém Adicionados ao Estoque */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-green-600" />
                      Entradas Recentes no Estoque
                    </CardTitle>
                    <CardDescription>Dispositivos adicionados ao estoque via Trade-In</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IMEI</TableHead>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead>Depósito</TableHead>
                      <TableHead>Condição</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Preço Venda</TableHead>
                      <TableHead>Margem</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.filter(d => d.acquisitionType === "trade_in").slice(0, 5).map((device) => {
                      const cost = parseFloat(String(device.purchasePrice || 0));
                      const price = parseFloat(String(device.sellingPrice || 0));
                      const margin = cost > 0 ? ((price - cost) / cost * 100).toFixed(1) : "0";
                      
                      return (
                        <TableRow key={device.id}>
                          <TableCell className="font-mono text-sm">{device.imei}</TableCell>
                          <TableCell className="font-medium">{device.brand} {device.model}</TableCell>
                          <TableCell>
                            {(device as any).warehouseId ? (
                              <Badge variant="outline" className="text-xs">
                                {warehouses.find(w => w.id === (device as any).warehouseId)?.name || "-"}
                              </Badge>
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {device.condition === "refurbished" ? "Recondicionado" : device.condition}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(cost)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(price)}</TableCell>
                          <TableCell>
                            <Badge variant={parseFloat(margin) >= 30 ? "default" : "secondary"} className={parseFloat(margin) >= 30 ? "bg-green-600" : ""}>
                              {margin}%
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(device.status)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {devices.filter(d => d.acquisitionType === "trade_in").length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum dispositivo de Trade-In no estoque
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Cadastros */}
          <TabsContent value="cadastros" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => { loadCadastroPaymentMethods(); setShowPaymentMethodsDialog(true); }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    Formas de Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Cartões, taxas e parcelas</p>
                  <Badge variant="secondary" className="mt-2">{cadastroPaymentMethods.length} cadastrados</Badge>
                </CardContent>
              </Card>
              
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => { loadCadastroSellers(); setShowSellersDialog(true); }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-5 w-5 text-green-600" />
                    Vendedores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Equipe de vendas</p>
                  <Badge variant="secondary" className="mt-2">{cadastroSellers.length} cadastrados</Badge>
                </CardContent>
              </Card>
              
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => { loadCadastroPriceTables(); setShowPriceTablesDialog(true); }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="h-5 w-5 text-orange-600" />
                    Tabelas de Preço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Preços por tipo de cliente</p>
                  <Badge variant="secondary" className="mt-2">{cadastroPriceTables.length} tabelas</Badge>
                </CardContent>
              </Card>
              
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => { loadCadastroPromotions(); setShowPromotionsDialog(true); }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Banknote className="h-5 w-5 text-red-600" />
                    Promoções
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Descontos e ofertas</p>
                  <Badge variant="secondary" className="mt-2">{cadastroPromotions.length} ativas</Badge>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Aba Relatórios */}
          <TabsContent value="relatorios" className="space-y-6">
            {/* Filtros de Relatórios */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Data Início</Label>
                    <Input 
                      type="date" 
                      className="w-40" 
                      value={reportDateFrom}
                      onChange={(e) => setReportDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data Fim</Label>
                    <Input 
                      type="date" 
                      className="w-40" 
                      value={reportDateTo}
                      onChange={(e) => setReportDateTo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vendedor</Label>
                    <Select value={reportSellerId} onValueChange={setReportSellerId}>
                      <SelectTrigger className="w-40"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {cadastroSellers.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      setSalesDetailLoading(true);
                      try {
                        const params = new URLSearchParams();
                        params.append("detailed", "true");
                        if (reportDateFrom) params.append("dateFrom", reportDateFrom);
                        if (reportDateTo) params.append("dateTo", reportDateTo);
                        if (reportSellerId && reportSellerId !== "all") params.append("soldBy", reportSellerId);
                        const res = await fetch(`/api/retail/sales?${params}`, { credentials: "include" });
                        const data = await res.json();
                        setSalesDetailData(data.sales || []);
                      } catch (err) {
                        console.error(err);
                      }
                      setSalesDetailLoading(false);
                    }}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${salesDetailLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Tabs value={reportSubTab} onValueChange={(v) => setReportSubTab(v)} className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="os-status" data-testid="tab-report-os-status">OS por Status</TabsTrigger>
                <TabsTrigger value="os-tech" data-testid="tab-report-os-tech">OS por Técnico</TabsTrigger>
                <TabsTrigger value="sales-seller" data-testid="tab-report-sales-seller">Vendas por Vendedor</TabsTrigger>
                <TabsTrigger value="margin-imei" data-testid="tab-report-margin-imei">Margem por IMEI</TabsTrigger>
                <TabsTrigger value="daily-cash" data-testid="tab-report-daily-cash">Caixa Diário</TabsTrigger>
                <TabsTrigger value="stock-turnover" data-testid="tab-report-stock-turnover">Giro de Estoque</TabsTrigger>
              </TabsList>

              <TabsContent value="os-status" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">OS por Status</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => loadReportData("os-by-status")} data-testid="btn-refresh-os-status">
                        <RefreshCw className={`h-4 w-4 mr-2 ${reportLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportOsByStatus.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">{reportLoading ? "Carregando..." : "Sem dados"}</TableCell></TableRow>
                        ) : reportOsByStatus.map((row: any, i: number) => (
                          <TableRow key={i} data-testid={`report-os-status-${i}`}>
                            <TableCell>{getStatusBadge(row.status)}</TableCell>
                            <TableCell className="text-right">{row.count}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(row.total_value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="os-tech" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">OS por Técnico</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => loadReportData("os-by-technician")} data-testid="btn-refresh-os-tech">
                        <RefreshCw className={`h-4 w-4 mr-2 ${reportLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Técnico</TableHead>
                          <TableHead className="text-right">Total OS</TableHead>
                          <TableHead className="text-right">Concluídas</TableHead>
                          <TableHead className="text-right">Em Andamento</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportOsByTech.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{reportLoading ? "Carregando..." : "Sem dados"}</TableCell></TableRow>
                        ) : reportOsByTech.map((row: any, i: number) => (
                          <TableRow key={i} data-testid={`report-os-tech-${i}`}>
                            <TableCell className="font-medium">{row.technician_name || "Não atribuído"}</TableCell>
                            <TableCell className="text-right">{row.total_os}</TableCell>
                            <TableCell className="text-right">{row.completed}</TableCell>
                            <TableCell className="text-right">{row.in_progress}</TableCell>
                            <TableCell className="text-right font-medium text-green-600">{formatCurrency(row.total_revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sales-seller" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Vendas por Vendedor</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => loadReportData("sales-by-seller")} data-testid="btn-refresh-sales-seller">
                        <RefreshCw className={`h-4 w-4 mr-2 ${reportLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendedor</TableHead>
                          <TableHead className="text-right">Total Vendas</TableHead>
                          <TableHead className="text-right">Receita Total</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                          <TableHead className="text-right">Dias Ativos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportSalesBySeller.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{reportLoading ? "Carregando..." : "Sem dados"}</TableCell></TableRow>
                        ) : reportSalesBySeller.map((row: any, i: number) => (
                          <TableRow key={i} data-testid={`report-sales-seller-${i}`}>
                            <TableCell className="font-medium">{row.sold_by || "Sem vendedor"}</TableCell>
                            <TableCell className="text-right">{row.total_sales}</TableCell>
                            <TableCell className="text-right font-medium text-green-600">{formatCurrency(row.total_revenue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.avg_ticket)}</TableCell>
                            <TableCell className="text-right">{row.active_days}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="margin-imei" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Margem por IMEI</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => loadReportData("margin-by-imei")} data-testid="btn-refresh-margin-imei">
                        <RefreshCw className={`h-4 w-4 mr-2 ${reportLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border overflow-auto max-h-[500px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead>Dispositivo</TableHead>
                            <TableHead>IMEI</TableHead>
                            <TableHead>Condição</TableHead>
                            <TableHead className="text-right">Custo</TableHead>
                            <TableHead className="text-right">Venda</TableHead>
                            <TableHead className="text-right">Margem</TableHead>
                            <TableHead className="text-right">%</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportMarginByImei.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{reportLoading ? "Carregando..." : "Sem dados"}</TableCell></TableRow>
                          ) : reportMarginByImei.map((row: any, i: number) => (
                            <TableRow key={i} data-testid={`report-margin-${i}`}>
                              <TableCell className="font-medium">{row.brand} {row.model}</TableCell>
                              <TableCell className="font-mono text-sm">{row.imei}</TableCell>
                              <TableCell>{getConditionBadge(row.condition)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.cost)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.sale_price)}</TableCell>
                              <TableCell className={`text-right font-medium ${parseFloat(row.margin) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(row.margin)}</TableCell>
                              <TableCell className="text-right">{parseFloat(row.margin_percent || 0).toFixed(1)}%</TableCell>
                              <TableCell>{getStatusBadge(row.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="daily-cash" className="mt-4 space-y-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label className="whitespace-nowrap">Data:</Label>
                        <Input 
                          type="date" 
                          value={dailyCashDate}
                          onChange={(e) => setDailyCashDate(e.target.value)}
                          className="w-44"
                          data-testid="input-daily-cash-date"
                        />
                      </div>
                      <Button onClick={() => loadReportData("daily-cash")} data-testid="btn-load-daily-cash">
                        <RefreshCw className={`h-4 w-4 mr-2 ${reportLoading ? 'animate-spin' : ''}`} />
                        Carregar
                      </Button>
                      <div className="ml-auto text-sm text-muted-foreground">
                        {reportDailyCash?.date && `Exibindo: ${new Date(reportDailyCash.date + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {reportDailyCash ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Total Vendas</p>
                          <p className="text-2xl font-bold text-green-600" data-testid="daily-cash-total">{formatCurrency(reportDailyCash.total_sales)}</p>
                          <p className="text-xs text-muted-foreground">{reportDailyCash.sale_count} vendas</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Dinheiro</p>
                          <p className="text-2xl font-bold text-emerald-700">{formatCurrency(reportDailyCash.cash_total)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Cartão</p>
                          <p className="text-2xl font-bold text-blue-600">{formatCurrency(reportDailyCash.card_total)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">PIX</p>
                          <p className="text-2xl font-bold text-purple-600">{formatCurrency(reportDailyCash.pix_total)}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Sangrias</p>
                          <p className="text-xl font-bold text-red-600">-{formatCurrency(reportDailyCash.withdrawals)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Reforços</p>
                          <p className="text-xl font-bold text-blue-600">+{formatCurrency(reportDailyCash.reinforcements)}</p>
                        </CardContent>
                      </Card>
                      <Card className="md:col-span-2">
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Saldo Caixa (Dinheiro + Reforços - Sangrias)</p>
                          <p className="text-2xl font-bold">{formatCurrency(
                            parseFloat(reportDailyCash.cash_total || 0) + 
                            parseFloat(reportDailyCash.reinforcements || 0) - 
                            parseFloat(reportDailyCash.withdrawals || 0)
                          )}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Vendas por Vendedor
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {reportDailyCash.bySeller?.length > 0 ? (
                          <div className="rounded-lg border overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Vendedor</TableHead>
                                  <TableHead className="text-center">Vendas</TableHead>
                                  <TableHead className="text-right">Dinheiro</TableHead>
                                  <TableHead className="text-right">Débito</TableHead>
                                  <TableHead className="text-right">Crédito</TableHead>
                                  <TableHead className="text-right">PIX</TableHead>
                                  <TableHead className="text-right">Combinado</TableHead>
                                  <TableHead className="text-right">Descontos</TableHead>
                                  <TableHead className="text-right font-bold">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {reportDailyCash.bySeller.map((seller: any, i: number) => (
                                  <TableRow key={i} data-testid={`seller-row-${i}`}>
                                    <TableCell className="font-medium">{seller.sold_by || "Sem vendedor"}</TableCell>
                                    <TableCell className="text-center">{seller.sale_count}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(seller.cash_total)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(seller.debit_total)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(seller.credit_total)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(seller.pix_total)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(seller.combined_total)}</TableCell>
                                    <TableCell className="text-right text-red-500">{parseFloat(seller.total_discount) > 0 ? `-${formatCurrency(seller.total_discount)}` : '-'}</TableCell>
                                    <TableCell className="text-right font-bold text-green-600">{formatCurrency(seller.total)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                              <tfoot>
                                <TableRow className="bg-muted/50 font-semibold">
                                  <TableCell>TOTAL</TableCell>
                                  <TableCell className="text-center">{reportDailyCash.sale_count}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(reportDailyCash.cash_total)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(reportDailyCash.bySeller?.reduce((s: number, r: any) => s + parseFloat(r.debit_total || 0), 0))}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(reportDailyCash.bySeller?.reduce((s: number, r: any) => s + parseFloat(r.credit_total || 0), 0))}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(reportDailyCash.pix_total)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(reportDailyCash.combined_total || 0)}</TableCell>
                                  <TableCell className="text-right text-red-500">{formatCurrency(reportDailyCash.bySeller?.reduce((s: number, r: any) => s + parseFloat(r.total_discount || 0), 0))}</TableCell>
                                  <TableCell className="text-right font-bold text-green-600">{formatCurrency(reportDailyCash.total_sales)}</TableCell>
                                </TableRow>
                              </tfoot>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-4">Nenhuma venda no período</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Listagem de Vendas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {reportDailyCash.sales?.length > 0 ? (
                          <div className="rounded-lg border overflow-auto max-h-[400px]">
                            <Table>
                              <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                  <TableHead>Venda</TableHead>
                                  <TableHead>Hora</TableHead>
                                  <TableHead>Cliente</TableHead>
                                  <TableHead>Vendedor</TableHead>
                                  <TableHead className="text-right">Subtotal</TableHead>
                                  <TableHead className="text-right">Desconto</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead>Pagamento</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {reportDailyCash.sales.map((sale: any, i: number) => (
                                  <TableRow key={i} data-testid={`sale-row-${i}`}>
                                    <TableCell className="font-mono text-sm">{sale.sale_number}</TableCell>
                                    <TableCell className="text-sm">{sale.created_at ? new Date(sale.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '-'}</TableCell>
                                    <TableCell>{sale.customer_name || "Consumidor"}</TableCell>
                                    <TableCell>{sale.sold_by || "-"}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(sale.subtotal)}</TableCell>
                                    <TableCell className="text-right text-red-500">{parseFloat(sale.discount_amount || 0) > 0 ? `-${formatCurrency(sale.discount_amount)}` : '-'}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(sale.total_amount)}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs">
                                        {sale.payment_method === 'cash' ? 'Dinheiro' : 
                                         sale.payment_method === 'credit' ? 'Crédito' :
                                         sale.payment_method === 'debit' ? 'Débito' :
                                         sale.payment_method === 'pix' ? 'PIX' :
                                         sale.payment_method === 'combined' ? 'Combinado' :
                                         sale.payment_method || '-'}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-4">Nenhuma venda registrada nesta data</p>
                        )}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="py-12">
                      <p className="text-center text-muted-foreground">{reportLoading ? "Carregando..." : "Selecione uma data e clique em Carregar para ver o movimento do dia"}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="stock-turnover" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Giro de Estoque</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => loadReportData("stock-turnover")} data-testid="btn-refresh-stock-turnover">
                        <RefreshCw className={`h-4 w-4 mr-2 ${reportLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border overflow-auto max-h-[500px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Estoque Atual</TableHead>
                            <TableHead className="text-right">Estoque Mínimo</TableHead>
                            <TableHead className="text-right">Vendas 30d</TableHead>
                            <TableHead className="text-right">Giro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportStockTurnover.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{reportLoading ? "Carregando..." : "Sem dados"}</TableCell></TableRow>
                          ) : reportStockTurnover.map((row: any, i: number) => (
                            <TableRow key={i} data-testid={`report-turnover-${i}`}>
                              <TableCell className="font-mono text-sm">{row.code}</TableCell>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell>{row.category || "-"}</TableCell>
                              <TableCell className="text-right">{parseFloat(row.current_stock || 0).toFixed(0)}</TableCell>
                              <TableCell className="text-right">{parseFloat(row.min_stock || 0).toFixed(0)}</TableCell>
                              <TableCell className="text-right">{row.sales_30d}</TableCell>
                              <TableCell className="text-right font-medium">{parseFloat(row.turnover_ratio || 0).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ========== ABA COMISSÕES ========== */}
          <TabsContent value="comissoes" className="space-y-6">
            {/* Período e Filtros */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5 text-purple-600" />
                    Gestão de Comissões
                  </CardTitle>
                  <div className="flex gap-2 items-center">
                    <Select value={commissionMonth.toString()} onValueChange={(v) => setCommissionMonth(parseInt(v))}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                          <SelectItem key={m} value={m.toString()}>
                            {new Date(2024, m-1).toLocaleString("pt-BR", { month: "long" })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={commissionYear.toString()} onValueChange={(v) => setCommissionYear(parseInt(v))}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026].map(y => (
                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => { loadCommissionDashboard(); loadSellerGoals(); loadStoreGoals(); loadCommissionClosures(); loadCadastroSellers(); }}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${commissionDashboardLoading ? 'animate-spin' : ''}`} />
                      Carregar
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* KPIs da Loja */}
            {commissionDashboard && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total Vendas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(commissionDashboard.store.totalSales)}</p>
                    <p className="text-xs text-muted-foreground">{commissionDashboard.store.salesCount} vendas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Devoluções</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-600">-{formatCurrency(commissionDashboard.store.totalReturns)}</p>
                    <p className="text-xs text-muted-foreground">{commissionDashboard.store.returnsCount} devoluções</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Vendas Líquidas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(commissionDashboard.store.netSales)}</p>
                    <p className="text-xs text-muted-foreground">Após devoluções</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Meta Loja</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(commissionDashboard.store.goalAmount)}</p>
                    <Progress value={parseFloat(commissionDashboard.store.goalPercent)} className="h-2 mt-2" />
                    <p className="text-xs text-muted-foreground mt-1">{commissionDashboard.store.goalPercent}% atingido</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Status Meta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={commissionDashboard.store.metGoal ? "default" : "secondary"} className={`text-lg px-4 py-2 ${commissionDashboard.store.metGoal ? "bg-green-600" : ""}`}>
                      {commissionDashboard.store.metGoal ? "✓ Atingida" : "Em progresso"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Metas por Vendedor */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-600" />
                      Metas por Vendedor
                    </CardTitle>
                    <Button size="sm" onClick={() => { setEditingGoal({}); setShowGoalDialog(true); }}>
                      <Plus className="h-4 w-4 mr-1" />
                      Nova Meta
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {commissionDashboard?.sellers?.length > 0 ? (
                    <div className="space-y-4">
                      {commissionDashboard.sellers.map((seller: any) => (
                        <div key={seller.sellerId} className="border rounded-lg p-4 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{seller.sellerName}</span>
                            <Badge variant={seller.metGoal ? "default" : "outline"} className={seller.metGoal ? "bg-green-600" : ""}>
                              {seller.goalPercent}%
                            </Badge>
                          </div>
                          <Progress value={Math.min(parseFloat(seller.goalPercent), 100)} className="h-2" />
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Vendas</p>
                              <p className="font-medium text-green-600">{formatCurrency(seller.totalSales)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Devoluções</p>
                              <p className="font-medium text-red-600">-{formatCurrency(seller.totalReturns)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Líquido</p>
                              <p className="font-medium">{formatCurrency(seller.netSales)}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-sm pt-2 border-t">
                            <div>
                              <span className="text-muted-foreground">Meta: </span>
                              <span className="font-medium">{formatCurrency(seller.goalAmount)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Comissão: </span>
                              <span className="font-medium text-purple-600">{formatCurrency(seller.totalCommission)}</span>
                              {seller.bonus > 0 && (
                                <Badge variant="secondary" className="ml-2 text-xs">+{formatCurrency(seller.bonus)} bônus</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Clique em "Carregar" para visualizar as metas</p>
                  )}
                </CardContent>
              </Card>

              {/* Planos de Comissão */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Percent className="h-5 w-5 text-purple-600" />
                      Planos de Comissão
                    </CardTitle>
                    <Button size="sm" onClick={() => { loadCadastroCommissionPlans(); setEditingCommissionPlan({} as any); }}>
                      <Plus className="h-4 w-4 mr-1" />
                      Novo Plano
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor Base</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cadastroCommissionPlans.map((plan: any) => (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {plan.type === "percentage" ? "Percentual" : plan.type === "fixed" ? "Valor Fixo" : "Misto"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {plan.type === "percentage" 
                              ? `${plan.baseValue}%` 
                              : formatCurrency(plan.baseValue || 0)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={plan.isActive ? "default" : "secondary"}>
                              {plan.isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setEditingCommissionPlan(plan)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={async () => {
                                  if (confirm("Excluir este plano de comissão?")) {
                                    await fetch(`/api/retail/commission-plans/${plan.id}`, { method: "DELETE", credentials: "include" });
                                    loadCadastroCommissionPlans();
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {cadastroCommissionPlans.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Nenhum plano de comissão cadastrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Fechamentos de Comissão */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-orange-600" />
                      Fechamentos de Comissão
                    </CardTitle>
                    <Button size="sm" onClick={() => { setClosureCalcResult(null); setShowClosureDialog(true); }}>
                      <Plus className="h-4 w-4 mr-1" />
                      Novo Fechamento
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {commissionClosures.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead>Líquido</TableHead>
                          <TableHead>Comissão</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionClosures.map((closure: any) => (
                          <TableRow key={closure.id}>
                            <TableCell>{cadastroSellers.find(s => s.id === closure.sellerId)?.name || "Geral"}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(closure.periodStart).toLocaleDateString("pt-BR")} - {new Date(closure.periodEnd).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>{formatCurrency(closure.netSales)}</TableCell>
                            <TableCell className="font-medium text-purple-600">{formatCurrency(closure.totalAmount)}</TableCell>
                            <TableCell>
                              <Badge variant={closure.status === "paid" ? "default" : closure.status === "closed" ? "secondary" : "outline"}>
                                {closure.status === "paid" ? "Pago" : closure.status === "closed" ? "Fechado" : "Aberto"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhum fechamento registrado</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Meta da Loja */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-green-600" />
                    Meta da Loja - {new Date(2024, commissionMonth - 1).toLocaleString("pt-BR", { month: "long" })} {commissionYear}
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={async () => {
                    const goal = storeGoals[0];
                    const newGoalAmount = prompt("Informe a meta da loja:", goal?.goalAmount || "100000");
                    if (newGoalAmount) {
                      const method = goal?.id ? "PUT" : "POST";
                      const url = goal?.id ? `/api/retail/store-goals/${goal.id}` : "/api/retail/store-goals";
                      await fetch(url, {
                        method,
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ month: commissionMonth, year: commissionYear, goalAmount: newGoalAmount })
                      });
                      loadStoreGoals();
                      loadCommissionDashboard();
                    }
                  }}>
                    <Settings className="h-4 w-4 mr-1" />
                    Definir Meta
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {storeGoals.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Progresso da Meta</span>
                      <span className="font-bold">{commissionDashboard?.store?.goalPercent || 0}%</span>
                    </div>
                    <Progress value={parseFloat(commissionDashboard?.store?.goalPercent || "0")} className="h-4" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Atual: {formatCurrency(commissionDashboard?.store?.netSales || 0)}</span>
                      <span>Meta: {formatCurrency(storeGoals[0]?.goalAmount || 0)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">Nenhuma meta definida para este período</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ListChecks className="h-5 w-5" />
                      Modelos de Checklist
                    </CardTitle>
                    <Button size="sm" onClick={() => setShowNewTemplateDialog(true)} data-testid="btn-new-template">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>Selecione para editar os itens</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {checklistTemplates.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4 text-sm">
                      Nenhum modelo cadastrado
                    </p>
                  ) : (
                    checklistTemplates.map(template => (
                      <div 
                        key={template.id} 
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedTemplate?.id === template.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}`}
                        onClick={() => loadTemplateDetails(template.id)}
                        data-testid={`template-${template.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{template.name}</p>
                            <p className="text-sm text-muted-foreground">{template.deviceCategory}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive h-8 w-8 p-0"
                            onClick={(e) => { e.stopPropagation(); deleteTemplate(template.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <ClipboardList className="h-5 w-5" />
                        {selectedTemplate ? `Itens: ${selectedTemplate.name}` : "Itens do Checklist"}
                      </CardTitle>
                      <CardDescription>
                        {selectedTemplate ? `${selectedTemplate.items?.length || 0} itens configurados` : "Selecione um modelo à esquerda"}
                      </CardDescription>
                    </div>
                    {selectedTemplate && (
                      <Button size="sm" onClick={() => setShowNewItemDialog(true)} data-testid="btn-new-item">
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Item
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!selectedTemplate ? (
                    <p className="text-center text-muted-foreground py-8">
                      Selecione um modelo de checklist para visualizar e editar seus itens
                    </p>
                  ) : selectedTemplate.items?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum item cadastrado. Clique em "Novo Item" para começar.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {["visual", "funcional", "acessorios", "documentacao"].map(category => {
                        const categoryItems = selectedTemplate.items?.filter(i => i.category === category) || [];
                        if (categoryItems.length === 0) return null;
                        return (
                          <div key={category} className="mb-4">
                            <h4 className="font-medium text-sm text-muted-foreground mb-2 uppercase tracking-wider">
                              {getCategoryLabel(category)}
                            </h4>
                            <div className="space-y-2">
                              {categoryItems.map(item => (
                                <div 
                                  key={item.id} 
                                  className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50"
                                  data-testid={`checklist-item-${item.id}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="font-medium">{item.itemName}</p>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Badge variant="outline" className="text-xs">{getEvalTypeLabel(item.evaluationType)}</Badge>
                                        {item.isRequired && <Badge variant="secondary" className="text-xs">Obrigatório</Badge>}
                                        {parseFloat(item.impactOnValue || "0") > 0 && (
                                          <span className="text-orange-600">-{item.impactOnValue}% se ruim</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => setEditingItem(item)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-destructive"
                                      onClick={() => deleteChecklistItem(item.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>


        </Tabs>
      </div>

      <Dialog open={showNewDeviceDialog} onOpenChange={setShowNewDeviceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Dispositivo</DialogTitle>
          </DialogHeader>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>IMEI *</Label>
                <Input placeholder="000000000000000" data-testid="input-imei" />
              </div>
              <div>
                <Label>IMEI 2</Label>
                <Input placeholder="000000000000000" data-testid="input-imei2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Marca *</Label>
                <Select>
                  <SelectTrigger data-testid="select-brand">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Apple">Apple</SelectItem>
                    <SelectItem value="Samsung">Samsung</SelectItem>
                    <SelectItem value="Xiaomi">Xiaomi</SelectItem>
                    <SelectItem value="Motorola">Motorola</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modelo *</Label>
                <Input placeholder="iPhone 15 Pro" data-testid="input-model" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Cor</Label>
                <Input placeholder="Preto" data-testid="input-color" />
              </div>
              <div>
                <Label>Armazenamento</Label>
                <Input placeholder="128GB" data-testid="input-storage" />
              </div>
              <div>
                <Label>RAM</Label>
                <Input placeholder="8GB" data-testid="input-ram" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Condição *</Label>
                <Select>
                  <SelectTrigger data-testid="select-condition">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Novo</SelectItem>
                    <SelectItem value="refurbished">Recondicionado</SelectItem>
                    <SelectItem value="used">Usado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preço de Venda</Label>
                <Input type="number" placeholder="0.00" data-testid="input-price" />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDeviceDialog(false)}>Cancelar</Button>
            <Button data-testid="btn-save-device">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewServiceDialog} onOpenChange={setShowNewServiceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Serviço</DialogTitle>
          </DialogHeader>
          <form className="space-y-4">
            <div>
              <Label>IMEI do Dispositivo *</Label>
              <Input placeholder="000000000000000" data-testid="input-os-imei" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Marca</Label>
                <Input placeholder="Samsung" data-testid="input-os-brand" />
              </div>
              <div>
                <Label>Modelo</Label>
                <Input placeholder="Galaxy S21" data-testid="input-os-model" />
              </div>
            </div>
            <div>
              <Label>Nome do Cliente *</Label>
              <Input placeholder="João Silva" data-testid="input-os-customer" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input placeholder="(11) 99999-9999" data-testid="input-os-phone" />
            </div>
            <div>
              <Label>Descrição do Problema *</Label>
              <Textarea placeholder="Descreva o problema relatado pelo cliente..." data-testid="input-os-problem" />
            </div>
            <div>
              <Label>Tipo de Serviço</Label>
              <Select>
                <SelectTrigger data-testid="select-service-type">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="repair">Reparo</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                  <SelectItem value="diagnostic">Diagnóstico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewServiceDialog(false)}>Cancelar</Button>
            <Button data-testid="btn-save-service">Criar OS</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEvaluationDialog} onOpenChange={setShowEvaluationDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Avaliação de Trade-In</DialogTitle>
          </DialogHeader>
          <form className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>IMEI *</Label>
                <Input 
                  placeholder="000000000000000" 
                  value={evalForm.imei}
                  onChange={(e) => setEvalForm({...evalForm, imei: e.target.value})}
                  data-testid="input-eval-imei" 
                />
              </div>
              <div className="relative" data-eval-client-search>
                <Label>Cliente</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Digite para buscar..." 
                      value={evalForm.cliente}
                      onChange={(e) => {
                        setEvalForm({...evalForm, cliente: e.target.value, personId: null});
                      }}
                      className="pl-9"
                      data-testid="input-eval-customer" 
                    />
                    {showEvalClientDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto" data-testid="dropdown-eval-customers">
                        {evalFilteredPersons.map((person) => (
                          <div
                            key={person.id}
                            className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center gap-2"
                            onClick={() => selectEvalPerson(person)}
                            data-testid={`dropdown-item-person-${person.id}`}
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium text-sm">{person.fullName}</div>
                              <div className="text-xs text-muted-foreground">{person.cpfCnpj}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => setShowQuickPersonDialog(true)}
                    title="Cadastro rápido"
                    data-testid="btn-quick-register-person"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
                {evalForm.personId && (
                  <div className="text-xs text-green-600 mt-1" data-testid="text-selected-customer">Cliente selecionado: {evalForm.cpf}</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Marca *</Label>
                <Select value={evalForm.marca} onValueChange={(v) => setEvalForm({...evalForm, marca: v})}>
                  <SelectTrigger data-testid="select-eval-brand">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Apple">Apple</SelectItem>
                    <SelectItem value="Samsung">Samsung</SelectItem>
                    <SelectItem value="Xiaomi">Xiaomi</SelectItem>
                    <SelectItem value="Motorola">Motorola</SelectItem>
                    <SelectItem value="LG">LG</SelectItem>
                    <SelectItem value="Huawei">Huawei</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modelo *</Label>
                <Input 
                  placeholder="iPhone 13" 
                  value={evalForm.modelo}
                  onChange={(e) => setEvalForm({...evalForm, modelo: e.target.value})}
                  data-testid="input-eval-model" 
                />
              </div>
              <div>
                <Label>Cor</Label>
                <Input 
                  placeholder="Preto" 
                  value={evalForm.cor}
                  onChange={(e) => setEvalForm({...evalForm, cor: e.target.value})}
                  data-testid="input-eval-color" 
                />
              </div>
            </div>
            
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Condição do Dispositivo</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tela</Label>
                  <Select value={evalForm.tela} onValueChange={(v) => setEvalForm({...evalForm, tela: v})}>
                    <SelectTrigger data-testid="select-screen">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="perfect">Perfeita</SelectItem>
                      <SelectItem value="minor_scratches">Pequenos arranhões</SelectItem>
                      <SelectItem value="cracks">Trincas</SelectItem>
                      <SelectItem value="broken">Quebrada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Corpo</Label>
                  <Select value={evalForm.corpo} onValueChange={(v) => setEvalForm({...evalForm, corpo: v})}>
                    <SelectTrigger data-testid="select-body">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="perfect">Perfeito</SelectItem>
                      <SelectItem value="minor_scratches">Pequenos arranhões</SelectItem>
                      <SelectItem value="dents">Amassados</SelectItem>
                      <SelectItem value="damaged">Danificado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Saúde da Bateria (%)</Label>
                  <Input 
                    type="number" 
                    placeholder="85" 
                    min="0" 
                    max="100" 
                    value={evalForm.bateria}
                    onChange={(e) => setEvalForm({...evalForm, bateria: e.target.value})}
                    data-testid="input-battery" 
                  />
                </div>
                <div>
                  <Label>Condição Geral *</Label>
                  <Select value={evalForm.condicaoGeral} onValueChange={(v) => setEvalForm({...evalForm, condicaoGeral: v})}>
                    <SelectTrigger data-testid="select-overall">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excelente</SelectItem>
                      <SelectItem value="good">Bom</SelectItem>
                      <SelectItem value="fair">Regular</SelectItem>
                      <SelectItem value="poor">Ruim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEvaluationDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateEvaluation} data-testid="btn-save-evaluation">Criar Avaliação + O.S.</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQuickPersonDialog} onOpenChange={setShowQuickPersonDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastro Rápido de Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome Completo *</Label>
              <Input 
                value={quickPerson.fullName}
                onChange={(e) => setQuickPerson({...quickPerson, fullName: e.target.value})}
                placeholder="Nome do cliente"
                data-testid="input-quick-fullname"
              />
            </div>
            <div>
              <Label>CPF/CNPJ *</Label>
              <Input 
                value={quickPerson.cpfCnpj}
                onChange={(e) => setQuickPerson({...quickPerson, cpfCnpj: e.target.value})}
                placeholder="000.000.000-00"
                data-testid="input-quick-cpf"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input 
                value={quickPerson.phone}
                onChange={(e) => setQuickPerson({...quickPerson, phone: e.target.value})}
                placeholder="(00) 00000-0000"
                data-testid="input-quick-phone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickPersonDialog(false)} data-testid="btn-quick-cancel">Cancelar</Button>
            <Button onClick={handleQuickPersonSave} data-testid="btn-quick-save">Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEvaluationDetailsDialog} onOpenChange={setShowEvaluationDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Detalhes da Avaliação de Trade-In
            </DialogTitle>
          </DialogHeader>
          {selectedEvaluation && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">IMEI</Label>
                  <p className="font-mono font-medium">{selectedEvaluation.imei}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Dispositivo</Label>
                  <p className="font-medium">{selectedEvaluation.brand} {selectedEvaluation.model}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Cliente</Label>
                  <p className="font-medium">{selectedEvaluation.customerName || "-"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Telefone</Label>
                  <p className="font-medium">{selectedEvaluation.customerPhone || "-"}</p>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Checklist de Avaliação</h4>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html><head><title>Avaliação Trade-In - ${selectedEvaluation.imei}</title>
                          <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0; }
                            .item { padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
                            .label { font-size: 12px; color: #666; }
                            .value { font-weight: bold; font-size: 14px; }
                            .signature { margin-top: 60px; border-top: 1px solid #333; padding-top: 10px; text-align: center; }
                            .check-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                            .check-item { display: flex; align-items: center; gap: 8px; padding: 5px; }
                            .check-ok { color: green; }
                            .check-fail { color: red; }
                            .total { font-size: 24px; text-align: right; color: green; margin-top: 20px; }
                          </style></head><body>
                          <h1>TERMO DE AVALIAÇÃO TRADE-IN</h1>
                          <div class="grid">
                            <div class="item"><div class="label">IMEI</div><div class="value">${selectedEvaluation.imei}</div></div>
                            <div class="item"><div class="label">Dispositivo</div><div class="value">${selectedEvaluation.brand} ${selectedEvaluation.model}</div></div>
                            <div class="item"><div class="label">Cor</div><div class="value">${selectedEvaluation.color || '-'}</div></div>
                            <div class="item"><div class="label">Cliente</div><div class="value">${selectedEvaluation.customerName || '-'}</div></div>
                            <div class="item"><div class="label">Data</div><div class="value">${selectedEvaluation.evaluationDate || new Date().toLocaleDateString('pt-BR')}</div></div>
                          </div>
                          <h2>Checklist de Avaliação</h2>
                          <div class="check-grid">
                            <div class="check-item"><span class="${selectedEvaluation.powerOn ? 'check-ok' : 'check-fail'}">●</span> Aparelho liga corretamente: ${selectedEvaluation.powerOn ? 'Sim' : 'Não'}${selectedEvaluation.powerOnNotes ? ` (${selectedEvaluation.powerOnNotes})` : ''}</div>
                            <div class="check-item"><span class="${!selectedEvaluation.screenIssues ? 'check-ok' : 'check-fail'}">●</span> Avarias/travamentos/toque fantasma: ${selectedEvaluation.screenIssues ? 'Sim' : 'Não'}${selectedEvaluation.screenIssuesNotes ? ` (${selectedEvaluation.screenIssuesNotes})` : ''}</div>
                            <div class="check-item"><span class="${!selectedEvaluation.screenSpots ? 'check-ok' : 'check-fail'}">●</span> Manchas na tela: ${selectedEvaluation.screenSpots ? 'Sim' : 'Não'}${selectedEvaluation.screenSpotsNotes ? ` (${selectedEvaluation.screenSpotsNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.buttonsWorking ? 'check-ok' : 'check-fail'}">●</span> Botões funcionando: ${selectedEvaluation.buttonsWorking ? 'Sim' : 'Não'}${selectedEvaluation.buttonsWorkingNotes ? ` (${selectedEvaluation.buttonsWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${!selectedEvaluation.wearMarks ? 'check-ok' : 'check-fail'}">●</span> Marcas de uso: ${selectedEvaluation.wearMarks ? 'Sim' : 'Não'}${selectedEvaluation.wearMarksNotes ? ` (${selectedEvaluation.wearMarksNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.wifiWorking ? 'check-ok' : 'check-fail'}">●</span> Wi-Fi funcionando: ${selectedEvaluation.wifiWorking ? 'Sim' : 'Não'}${selectedEvaluation.wifiWorkingNotes ? ` (${selectedEvaluation.wifiWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.simWorking ? 'check-ok' : 'check-fail'}">●</span> Chip funcionando: ${selectedEvaluation.simWorking ? 'Sim' : 'Não'}${selectedEvaluation.simWorkingNotes ? ` (${selectedEvaluation.simWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.mobileDataWorking ? 'check-ok' : 'check-fail'}">●</span> 4G/5G funcionando: ${selectedEvaluation.mobileDataWorking ? 'Sim' : 'Não'}${selectedEvaluation.mobileDataWorkingNotes ? ` (${selectedEvaluation.mobileDataWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.sensorsNfcWorking ? 'check-ok' : 'check-fail'}">●</span> Sensores/NFC funcionando: ${selectedEvaluation.sensorsNfcWorking ? 'Sim' : 'Não'}${selectedEvaluation.sensorsNfcWorkingNotes ? ` (${selectedEvaluation.sensorsNfcWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.biometricWorking ? 'check-ok' : 'check-fail'}">●</span> Face ID/Touch ID: ${selectedEvaluation.biometricWorking ? 'Sim' : 'Não'}${selectedEvaluation.biometricWorkingNotes ? ` (${selectedEvaluation.biometricWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.microphonesWorking ? 'check-ok' : 'check-fail'}">●</span> Microfones funcionando: ${selectedEvaluation.microphonesWorking ? 'Sim' : 'Não'}${selectedEvaluation.microphonesWorkingNotes ? ` (${selectedEvaluation.microphonesWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.earSpeakerWorking ? 'check-ok' : 'check-fail'}">●</span> Áudio auricular: ${selectedEvaluation.earSpeakerWorking ? 'Sim' : 'Não'}${selectedEvaluation.earSpeakerWorkingNotes ? ` (${selectedEvaluation.earSpeakerWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.loudspeakerWorking ? 'check-ok' : 'check-fail'}">●</span> Áudio alto-falante: ${selectedEvaluation.loudspeakerWorking ? 'Sim' : 'Não'}${selectedEvaluation.loudspeakerWorkingNotes ? ` (${selectedEvaluation.loudspeakerWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.chargingPortWorking ? 'check-ok' : 'check-fail'}">●</span> Entrada carregamento: ${selectedEvaluation.chargingPortWorking ? 'Sim' : 'Não'}${selectedEvaluation.chargingPortWorkingNotes ? ` (${selectedEvaluation.chargingPortWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.camerasWorking ? 'check-ok' : 'check-fail'}">●</span> Câmeras funcionando: ${selectedEvaluation.camerasWorking ? 'Sim' : 'Não'}${selectedEvaluation.camerasWorkingNotes ? ` (${selectedEvaluation.camerasWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.flashWorking ? 'check-ok' : 'check-fail'}">●</span> Flash funcionando: ${selectedEvaluation.flashWorking ? 'Sim' : 'Não'}${selectedEvaluation.flashWorkingNotes ? ` (${selectedEvaluation.flashWorkingNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.hasCharger ? 'check-ok' : 'check-fail'}">●</span> Possui carregador: ${selectedEvaluation.hasCharger ? 'Sim' : 'Não'}${selectedEvaluation.hasChargerNotes ? ` (${selectedEvaluation.hasChargerNotes})` : ''}</div>
                            <div class="check-item"><span class="${selectedEvaluation.toolsAnalysisOk ? 'check-ok' : 'check-fail'}">●</span> Análise 3uTools OK: ${selectedEvaluation.toolsAnalysisOk ? 'Sim' : 'Não'}${selectedEvaluation.toolsAnalysisNotes ? ` (${selectedEvaluation.toolsAnalysisNotes})` : ''}</div>
                          </div>
                          <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px;">
                            <strong>Saúde da Bateria:</strong> ${selectedEvaluation.batteryHealth || '-'}%
                            ${selectedEvaluation.batteryHealthNotes ? `<br><small>Obs: ${selectedEvaluation.batteryHealthNotes}</small>` : ''}
                          </div>
                          <div class="total">VALOR AVALIADO: R$ ${parseFloat(selectedEvaluation.estimatedValue || 0).toFixed(2)}</div>
                          <div class="signature">
                            <p>Assinatura do Cliente: _______________________________</p>
                            <p style="font-size: 12px; color: #666; margin-top: 5px;">${selectedEvaluation.customerName || 'Cliente'}</p>
                          </div>
                          <div class="signature">
                            <p>Assinatura do Avaliador: _______________________________</p>
                          </div>
                          </body></html>
                        `);
                        printWindow.document.close();
                        printWindow.print();
                      }
                    }}
                    data-testid="btn-print-evaluation"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
                {editingEvaluation && selectedEvaluation.status === "pending" ? (
                  <>
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                      {[
                        { key: "powerOn", notesKey: "powerOnNotes", label: "Aparelho liga corretamente", isOk: true },
                        { key: "screenIssues", notesKey: "screenIssuesNotes", label: "Avarias, travamentos ou toque fantasma", isOk: false },
                        { key: "screenSpots", notesKey: "screenSpotsNotes", label: "Manchas na tela", isOk: false },
                        { key: "buttonsWorking", notesKey: "buttonsWorkingNotes", label: "Botões funcionando", isOk: true },
                        { key: "wearMarks", notesKey: "wearMarksNotes", label: "Marcas de uso", isOk: false },
                        { key: "wifiWorking", notesKey: "wifiWorkingNotes", label: "Wi-Fi funcionando", isOk: true },
                        { key: "simWorking", notesKey: "simWorkingNotes", label: "Chip funcionando", isOk: true },
                        { key: "mobileDataWorking", notesKey: "mobileDataWorkingNotes", label: "4G/5G funcionando", isOk: true },
                        { key: "sensorsNfcWorking", notesKey: "sensorsNfcWorkingNotes", label: "Sensores funcionando / NFC", isOk: true },
                        { key: "biometricWorking", notesKey: "biometricWorkingNotes", label: "Face ID / Touch ID funcionando", isOk: true },
                        { key: "microphonesWorking", notesKey: "microphonesWorkingNotes", label: "Microfones funcionando", isOk: true },
                        { key: "earSpeakerWorking", notesKey: "earSpeakerWorkingNotes", label: "Áudio auricular funcionando", isOk: true },
                        { key: "loudspeakerWorking", notesKey: "loudspeakerWorkingNotes", label: "Áudio alto-falante funcionando", isOk: true },
                        { key: "chargingPortWorking", notesKey: "chargingPortWorkingNotes", label: "Entrada de carregamento funcionando", isOk: true },
                        { key: "camerasWorking", notesKey: "camerasWorkingNotes", label: "Câmeras funcionando / Manchas", isOk: true },
                        { key: "flashWorking", notesKey: "flashWorkingNotes", label: "Flash funcionando", isOk: true },
                        { key: "hasCharger", notesKey: "hasChargerNotes", label: "Possui carregador", isOk: true },
                        { key: "toolsAnalysisOk", notesKey: "toolsAnalysisNotes", label: "Análise pelo 3uTools OK", isOk: true },
                      ].map(item => (
                        <div key={item.key} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.label}</span>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant={editingEvaluation[item.key] === true ? (item.isOk ? "default" : "destructive") : "outline"}
                                className={`h-7 w-12 text-xs ${editingEvaluation[item.key] === true && item.isOk ? "bg-green-600 hover:bg-green-700" : ""}`}
                                onClick={() => setEditingEvaluation({...editingEvaluation, [item.key]: true})}
                              >
                                Sim
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={editingEvaluation[item.key] === false ? (item.isOk ? "destructive" : "default") : "outline"}
                                className={`h-7 w-12 text-xs ${editingEvaluation[item.key] === false && !item.isOk ? "bg-green-600 hover:bg-green-700" : ""}`}
                                onClick={() => setEditingEvaluation({...editingEvaluation, [item.key]: false})}
                              >
                                Não
                              </Button>
                            </div>
                          </div>
                          <Input
                            placeholder="Obs..."
                            className="h-8 text-xs"
                            value={editingEvaluation[item.notesKey] || ""}
                            onChange={(e) => setEditingEvaluation({...editingEvaluation, [item.notesKey]: e.target.value})}
                          />
                        </div>
                      ))}
                      
                      <div className="border rounded-lg p-3 space-y-2 bg-blue-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Saúde da Bateria</span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              className="h-8 w-20 text-center font-bold"
                              value={editingEvaluation.batteryHealth || ""}
                              onChange={(e) => setEditingEvaluation({...editingEvaluation, batteryHealth: parseInt(e.target.value) || null})}
                              placeholder="85"
                            />
                            <span className="font-bold">%</span>
                          </div>
                        </div>
                        <Input
                          placeholder="Obs..."
                          className="h-8 text-xs"
                          value={editingEvaluation.batteryHealthNotes || ""}
                          onChange={(e) => setEditingEvaluation({...editingEvaluation, batteryHealthNotes: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <Label className="text-muted-foreground text-xs">Condição Geral</Label>
                          <Select 
                            value={editingEvaluation.overallCondition || ""} 
                            onValueChange={(v) => setEditingEvaluation({...editingEvaluation, overallCondition: v})}
                          >
                            <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="excellent">Excelente</SelectItem>
                              <SelectItem value="good">Bom</SelectItem>
                              <SelectItem value="fair">Regular</SelectItem>
                              <SelectItem value="poor">Ruim</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <Label className="text-muted-foreground text-xs">Valor Estimado (R$)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            className="h-8 mt-1 text-lg font-bold text-green-600"
                            value={editingEvaluation.estimatedValue || ""} 
                            onChange={(e) => setEditingEvaluation({...editingEvaluation, estimatedValue: e.target.value})}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={handleSaveEvaluation}
                        disabled={savingEvaluation}
                      >
                        {savingEvaluation ? "Salvando..." : "Salvar Alterações"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                      {[
                        { key: "powerOn", notesKey: "powerOnNotes", label: "Aparelho liga corretamente", isOk: true },
                        { key: "screenIssues", notesKey: "screenIssuesNotes", label: "Avarias, travamentos ou toque fantasma", isOk: false },
                        { key: "screenSpots", notesKey: "screenSpotsNotes", label: "Manchas na tela", isOk: false },
                        { key: "buttonsWorking", notesKey: "buttonsWorkingNotes", label: "Botões funcionando", isOk: true },
                        { key: "wearMarks", notesKey: "wearMarksNotes", label: "Marcas de uso", isOk: false },
                        { key: "wifiWorking", notesKey: "wifiWorkingNotes", label: "Wi-Fi funcionando", isOk: true },
                        { key: "simWorking", notesKey: "simWorkingNotes", label: "Chip funcionando", isOk: true },
                        { key: "mobileDataWorking", notesKey: "mobileDataWorkingNotes", label: "4G/5G funcionando", isOk: true },
                        { key: "sensorsNfcWorking", notesKey: "sensorsNfcWorkingNotes", label: "Sensores funcionando / NFC", isOk: true },
                        { key: "biometricWorking", notesKey: "biometricWorkingNotes", label: "Face ID / Touch ID funcionando", isOk: true },
                        { key: "microphonesWorking", notesKey: "microphonesWorkingNotes", label: "Microfones funcionando", isOk: true },
                        { key: "earSpeakerWorking", notesKey: "earSpeakerWorkingNotes", label: "Áudio auricular funcionando", isOk: true },
                        { key: "loudspeakerWorking", notesKey: "loudspeakerWorkingNotes", label: "Áudio alto-falante funcionando", isOk: true },
                        { key: "chargingPortWorking", notesKey: "chargingPortWorkingNotes", label: "Entrada de carregamento funcionando", isOk: true },
                        { key: "camerasWorking", notesKey: "camerasWorkingNotes", label: "Câmeras funcionando / Manchas", isOk: true },
                        { key: "flashWorking", notesKey: "flashWorkingNotes", label: "Flash funcionando", isOk: true },
                        { key: "hasCharger", notesKey: "hasChargerNotes", label: "Possui carregador", isOk: true },
                        { key: "toolsAnalysisOk", notesKey: "toolsAnalysisNotes", label: "Análise pelo 3uTools OK", isOk: true },
                      ].map(item => {
                        const value = selectedEvaluation[item.key];
                        const notes = selectedEvaluation[item.notesKey];
                        const isGood = item.isOk ? value === true : value === false;
                        return (
                          <div key={item.key} className="flex items-start gap-2 py-1 border-b last:border-0">
                            <div className="mt-0.5">
                              {value === undefined || value === null ? 
                                <span className="text-xs text-muted-foreground">-</span> :
                                isGood ? 
                                  <CheckCircle className="h-4 w-4 text-green-500" /> : 
                                  <XCircle className="h-4 w-4 text-red-500" />}
                            </div>
                            <div className="flex-1">
                              <span className="text-xs">{item.label}</span>
                              {notes && <p className="text-xs text-muted-foreground italic">Obs: {notes}</p>}
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-2 py-2 bg-blue-50 rounded px-2">
                        <span className="text-sm font-medium">Saúde da Bateria:</span>
                        <span className="text-lg font-bold">{selectedEvaluation.batteryHealth || "-"}%</span>
                        {selectedEvaluation.batteryHealthNotes && (
                          <span className="text-xs text-muted-foreground italic ml-2">Obs: {selectedEvaluation.batteryHealthNotes}</span>
                        )}
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-muted-foreground text-xs">Condição Geral</Label>
                          <p className="text-lg">{selectedEvaluation.overallCondition && getConditionBadge(selectedEvaluation.overallCondition)}</p>
                        </div>
                        <div className="text-right">
                          <Label className="text-muted-foreground text-xs">Valor Estimado</Label>
                          <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedEvaluation.estimatedValue)}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-muted-foreground text-xs">Status Atual</Label>
                  <p className="mt-1">{getStatusBadge(selectedEvaluation.status)}</p>
                </div>
                {selectedEvaluation.rejectionReason && (
                  <div className="text-right">
                    <Label className="text-muted-foreground text-xs">Motivo Rejeição</Label>
                    <p className="text-sm text-red-600">{selectedEvaluation.rejectionReason}</p>
                  </div>
                )}
              </div>

              {selectedEvaluation.status === "pending" && (
                <div className="space-y-4 pt-4 border-t">
                  {matchingProducts.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <Label className="text-blue-800 font-medium mb-2 block">Relacionar a produto existente (opcional)</Label>
                      <p className="text-sm text-blue-600 mb-3">Produtos similares encontrados. Selecione para evitar duplicação:</p>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        <div 
                          className={`p-2 rounded border cursor-pointer transition-colors ${!selectedProductForTradeIn ? 'bg-white border-blue-400' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                          onClick={() => setSelectedProductForTradeIn(null)}
                        >
                          <span className="text-sm">Criar novo produto</span>
                        </div>
                        {matchingProducts.map((product: any) => (
                          <div 
                            key={product.id}
                            className={`p-2 rounded border cursor-pointer transition-colors ${selectedProductForTradeIn === product.id ? 'bg-blue-100 border-blue-400' : 'bg-white border-gray-200 hover:bg-blue-50'}`}
                            onClick={() => setSelectedProductForTradeIn(product.id)}
                          >
                            <span className="text-sm font-medium">{product.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">SKU: {product.sku || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      <strong>Fluxo Trade-In:</strong> Ao aprovar, será criada uma O.S. de preparação. 
                      O aparelho só ficará disponível para venda após conclusão da preparação (limpeza, teste, etiquetagem).
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={handleApproveEvaluation}
                      disabled={approving}
                      data-testid="btn-confirm-approve"
                    >
                      {approving ? (
                        <>Processando...</>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Aprovar Trade-In
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        const reason = window.prompt("Motivo da rejeição:");
                        if (reason) handleRejectEvaluation(reason);
                      }}
                      data-testid="btn-confirm-reject"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              )}

              {selectedEvaluation.status === "approved" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-700 font-medium flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Aquisição aprovada - Crédito disponível para uso no PDV
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showNewTemplateDialog} onOpenChange={setShowNewTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Modelo de Checklist</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createTemplate(); }}>
            <div>
              <Label>Nome do Modelo *</Label>
              <Input 
                placeholder="Ex: Avaliação Smartphone Padrão" 
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                data-testid="input-template-name"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea 
                placeholder="Descrição do checklist..."
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                data-testid="input-template-description"
              />
            </div>
            <div>
              <Label>Categoria de Dispositivo</Label>
              <Select 
                value={newTemplate.deviceCategory} 
                onValueChange={(v) => setNewTemplate({...newTemplate, deviceCategory: v})}
              >
                <SelectTrigger data-testid="select-device-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smartphone">Smartphone</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="laptop">Notebook</SelectItem>
                  <SelectItem value="smartwatch">Smartwatch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTemplateDialog(false)}>Cancelar</Button>
            <Button onClick={createTemplate} disabled={!newTemplate.name} data-testid="btn-save-template">
              Criar Modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewItemDialog} onOpenChange={setShowNewItemDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Item do Checklist</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createChecklistItem(); }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria *</Label>
                <Select 
                  value={newItem.category} 
                  onValueChange={(v) => setNewItem({...newItem, category: v})}
                >
                  <SelectTrigger data-testid="select-item-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visual">Condição Visual</SelectItem>
                    <SelectItem value="funcional">Testes Funcionais</SelectItem>
                    <SelectItem value="acessorios">Acessórios</SelectItem>
                    <SelectItem value="documentacao">Documentação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Avaliação</Label>
                <Select 
                  value={newItem.evaluationType} 
                  onValueChange={(v) => setNewItem({...newItem, evaluationType: v})}
                >
                  <SelectTrigger data-testid="select-eval-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="condition">Escala (Perfeito/Bom/Regular/Ruim)</SelectItem>
                    <SelectItem value="boolean">Sim/Não</SelectItem>
                    <SelectItem value="percentage">Percentual (0-100%)</SelectItem>
                    <SelectItem value="text">Texto Livre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nome do Item *</Label>
              <Input 
                placeholder="Ex: Tela (Display)" 
                value={newItem.itemName}
                onChange={(e) => setNewItem({...newItem, itemName: e.target.value})}
                data-testid="input-item-name"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea 
                placeholder="Instruções para o avaliador..."
                value={newItem.itemDescription}
                onChange={(e) => setNewItem({...newItem, itemDescription: e.target.value})}
                data-testid="input-item-description"
              />
            </div>
            {newItem.evaluationType === "condition" && (
              <div>
                <Label>Opções (JSON)</Label>
                <Input 
                  placeholder='["Perfeito","Bom","Regular","Ruim"]'
                  value={newItem.options}
                  onChange={(e) => setNewItem({...newItem, options: e.target.value})}
                  data-testid="input-item-options"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Impacto no Valor (%)</Label>
                <Input 
                  type="number"
                  placeholder="0"
                  min="0"
                  max="100"
                  value={newItem.impactOnValue}
                  onChange={(e) => setNewItem({...newItem, impactOnValue: e.target.value})}
                  data-testid="input-impact-value"
                />
                <p className="text-xs text-muted-foreground mt-1">% de desconto se condição ruim</p>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox 
                  id="required"
                  checked={newItem.isRequired}
                  onCheckedChange={(v) => setNewItem({...newItem, isRequired: v === true})}
                />
                <Label htmlFor="required">Item obrigatório</Label>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewItemDialog(false)}>Cancelar</Button>
            <Button onClick={createChecklistItem} disabled={!newItem.itemName} data-testid="btn-save-item">
              Adicionar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Item do Checklist</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); updateChecklistItem(); }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoria *</Label>
                  <Select 
                    value={editingItem.category} 
                    onValueChange={(v) => setEditingItem({...editingItem, category: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visual">Condição Visual</SelectItem>
                      <SelectItem value="funcional">Testes Funcionais</SelectItem>
                      <SelectItem value="acessorios">Acessórios</SelectItem>
                      <SelectItem value="documentacao">Documentação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Avaliação</Label>
                  <Select 
                    value={editingItem.evaluationType} 
                    onValueChange={(v) => setEditingItem({...editingItem, evaluationType: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="condition">Escala (Perfeito/Bom/Regular/Ruim)</SelectItem>
                      <SelectItem value="boolean">Sim/Não</SelectItem>
                      <SelectItem value="percentage">Percentual (0-100%)</SelectItem>
                      <SelectItem value="text">Texto Livre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Nome do Item *</Label>
                <Input 
                  value={editingItem.itemName}
                  onChange={(e) => setEditingItem({...editingItem, itemName: e.target.value})}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea 
                  value={editingItem.itemDescription || ""}
                  onChange={(e) => setEditingItem({...editingItem, itemDescription: e.target.value})}
                />
              </div>
              {editingItem.evaluationType === "condition" && (
                <div>
                  <Label>Opções (JSON)</Label>
                  <Input 
                    value={editingItem.options || '["Perfeito","Bom","Regular","Ruim"]'}
                    onChange={(e) => setEditingItem({...editingItem, options: e.target.value})}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Impacto no Valor (%)</Label>
                  <Input 
                    type="number"
                    min="0"
                    max="100"
                    value={editingItem.impactOnValue || "0"}
                    onChange={(e) => setEditingItem({...editingItem, impactOnValue: e.target.value})}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox 
                    id="edit-required"
                    checked={editingItem.isRequired}
                    onCheckedChange={(v) => setEditingItem({...editingItem, isRequired: v === true})}
                  />
                  <Label htmlFor="edit-required">Item obrigatório</Label>
                </div>
              </div>
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
            <Button onClick={updateChecklistItem} disabled={!editingItem?.itemName}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showTradeInForm && (
        <TradeInForm 
          onClose={() => setShowTradeInForm(false)}
          onSave={(data) => {
            if (activeTab === "pdv") {
              handlePdvTradeIn(data);
            } else {
              loadEvaluations();
              setShowTradeInForm(false);
            }
          }}
        />
      )}

      <Dialog open={showImeiModal} onOpenChange={setShowImeiModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Confirmar IMEI do Dispositivo
            </DialogTitle>
          </DialogHeader>
          {pendingDevice && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-semibold">{pendingDevice.brand} {pendingDevice.model}</p>
                <p className="text-sm text-muted-foreground">{pendingDevice.storage} - {pendingDevice.color}</p>
                <p className="text-lg font-bold mt-2">{formatCurrency(pendingDevice.sellingPrice)}</p>
              </div>
              <div>
                <Label>Digite ou escaneie o IMEI para confirmar *</Label>
                <Input 
                  placeholder="000000000000000"
                  value={imeiInput}
                  onChange={(e) => setImeiInput(e.target.value)}
                  autoFocus
                  data-testid="input-imei-confirm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  IMEI esperado: {pendingDevice.imei}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImeiModal(false)}>Cancelar</Button>
            <Button onClick={confirmImeiAndAdd} disabled={!imeiInput} data-testid="btn-confirm-imei">
              <CheckCircle className="h-4 w-4 mr-2" /> Confirmar e Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Selecionar Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input 
              placeholder="Buscar por nome, CPF ou telefone..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              data-testid="input-customer-search"
            />
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {personsList
                .filter(p => p.roles?.some((r: any) => r === "customer" || r.roleType === "customer"))
                .filter(p => !customerSearch || 
                  p.fullName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                  p.cpfCnpj?.includes(customerSearch) ||
                  p.phone?.includes(customerSearch)
                )
                .map((person) => (
                <div 
                  key={person.id}
                  className="flex items-center justify-between p-3 border-b hover:bg-muted/50 cursor-pointer"
                  onClick={() => selectCustomer(person)}
                  data-testid={`customer-${person.id}`}
                >
                  <div>
                    <p className="font-medium">{person.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {person.cpfCnpj} | {person.phone}
                    </p>
                  </div>
                  <Button size="sm" variant="outline">Selecionar</Button>
                </div>
              ))}
              {personsList.filter(p => p.roles?.some((r: any) => r === "customer" || r.roleType === "customer")).length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum cliente cadastrado. Cadastre primeiro na aba Pessoas.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomerModal(false)}>Fechar</Button>
            <Button onClick={() => { setShowCustomerModal(false); setShowNewPersonDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Cadastrar Novo Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Finalizar Venda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {pdvCustomer && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{pdvCustomer.fullName}</p>
                <p className="text-sm text-muted-foreground">{pdvCustomer.cpfCnpj}</p>
              </div>
            )}
            
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal ({cart.length} itens):</span>
                <span>{formatCurrency(cartSubtotal)}</span>
              </div>
              {cartDiscountTotal > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Desconto:</span>
                  <span>- {formatCurrency(cartDiscountTotal)}</span>
                </div>
              )}
              {tradeInCredit > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Trade-In:</span>
                  <span>- {formatCurrency(tradeInCredit)}</span>
                </div>
              )}
              {useCredit && creditAmountToUse > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>Crédito Cliente:</span>
                  <span>- {formatCurrency(creditAmountToUse)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xl border-t pt-2">
                <span>Total a Pagar:</span>
                <span className="text-primary">{formatCurrency(cartTotal > 0 ? cartTotal : 0)}</span>
              </div>
            </div>

            {customerTotalCredit > 0 && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-blue-800">Créditos Disponíveis</span>
                  </div>
                  <span className="font-bold text-blue-700 text-lg">
                    {formatCurrency(customerTotalCredit)}
                  </span>
                </div>
                
                {/* Breakdown por tipo de crédito */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {(() => {
                    const tradeInCredits = customerCredits.filter(c => c.origin === 'trade_in').reduce((sum, c) => sum + parseFloat(c.remainingAmount || '0'), 0);
                    const refundCredits = customerCredits.filter(c => c.origin === 'refund').reduce((sum, c) => sum + parseFloat(c.remainingAmount || '0'), 0);
                    const cashbackCredits = customerCredits.filter(c => c.origin === 'bonus' || c.origin === 'promotion' || c.origin === 'cashback').reduce((sum, c) => sum + parseFloat(c.remainingAmount || '0'), 0);
                    return (
                      <>
                        {tradeInCredits > 0 && (
                          <div className="bg-green-100 rounded p-2 text-center">
                            <div className="font-medium text-green-700">Trade-In</div>
                            <div className="text-green-800">{formatCurrency(tradeInCredits)}</div>
                          </div>
                        )}
                        {refundCredits > 0 && (
                          <div className="bg-orange-100 rounded p-2 text-center">
                            <div className="font-medium text-orange-700">Devolução</div>
                            <div className="text-orange-800">{formatCurrency(refundCredits)}</div>
                          </div>
                        )}
                        {cashbackCredits > 0 && (
                          <div className="bg-purple-100 rounded p-2 text-center">
                            <div className="font-medium text-purple-700">Cashback</div>
                            <div className="text-purple-800">{formatCurrency(cashbackCredits)}</div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="use-credit"
                      checked={useCredit}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseCredit(checked);
                        if (checked) {
                          const maxCredit = Math.min(customerTotalCredit, cartSubtotal - cartDiscountTotal - tradeInCredit);
                          setCreditAmountToUse(maxCredit);
                          if (paymentMethods.length > 0) {
                            const newTotal = cartSubtotal - cartDiscountTotal - tradeInCredit - maxCredit;
                            const totalPaid = paymentMethods.reduce((s, p) => s + p.amount, 0);
                            if (totalPaid > newTotal && paymentMethods.length === 1) {
                              setPaymentMethods([{ ...paymentMethods[0], amount: Math.max(0, newTotal) }]);
                            }
                          }
                        } else {
                          setCreditAmountToUse(0);
                          if (paymentMethods.length === 1) {
                            const newTotal = cartSubtotal - cartDiscountTotal - tradeInCredit;
                            setPaymentMethods([{ ...paymentMethods[0], amount: newTotal }]);
                          }
                        }
                      }}
                      className="h-4 w-4"
                      data-testid="checkbox-use-credit"
                    />
                    <Label htmlFor="use-credit" className="cursor-pointer font-medium">
                      Usar Créditos na Venda
                    </Label>
                  </div>
                </div>
                {useCredit && (
                  <div className="flex items-center gap-3">
                    <Label className="text-sm">Valor a usar:</Label>
                    <Input 
                      type="number"
                      value={creditAmountToUse}
                      onChange={(e) => {
                        const val = Math.min(
                          parseFloat(e.target.value) || 0,
                          customerTotalCredit,
                          cartSubtotal - cartDiscountTotal - tradeInCredit
                        );
                        setCreditAmountToUse(val);
                        if (paymentMethods.length === 1) {
                          const newTotal = cartSubtotal - cartDiscountTotal - tradeInCredit - val;
                          setPaymentMethods([{ ...paymentMethods[0], amount: Math.max(0, newTotal) }]);
                        }
                      }}
                      className="w-32"
                      step="0.01"
                      min="0"
                      max={Math.min(customerTotalCredit, cartSubtotal - cartDiscountTotal - tradeInCredit)}
                      data-testid="input-credit-amount"
                    />
                    <span className="text-sm text-muted-foreground">
                      máx: {formatCurrency(Math.min(customerTotalCredit, cartSubtotal - cartDiscountTotal - tradeInCredit))}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <Label>Formas de Pagamento</Label>
              
              {useCredit && creditAmountToUse > 0 && paymentMethods.length === 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>Crédito aplicado:</span>
                    <span>- {formatCurrency(creditAmountToUse)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-orange-600 bg-orange-50 p-2 rounded">
                    <span>Saldo a receber:</span>
                    <span>{formatCurrency(cartTotal > 0 ? cartTotal : 0)}</span>
                  </div>
                </div>
              )}

              {paymentMethods.length > 0 && (
                <div className="space-y-2 p-3 bg-muted rounded-lg">
                  {paymentMethods.map((pm, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {pm.method === "cash" && <DollarSign className="h-4 w-4" />}
                        {pm.method === "credit_card" && <CreditCard className="h-4 w-4" />}
                        {pm.method === "debit_card" && <CreditCard className="h-4 w-4" />}
                        {pm.method === "pix" && <RefreshCw className="h-4 w-4" />}
                        <span className="text-sm">
                          {pm.method === "cash" ? "Dinheiro" : 
                           pm.method === "credit_card" ? "Crédito" :
                           pm.method === "debit_card" ? "Débito" : "PIX"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number"
                          value={pm.amount}
                          onChange={(e) => {
                            const newMethods = [...paymentMethods];
                            newMethods[idx].amount = parseFloat(e.target.value) || 0;
                            setPaymentMethods(newMethods);
                          }}
                          className="w-28 text-right"
                          step="0.01"
                          min="0"
                        />
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setPaymentMethods(paymentMethods.filter((_, i) => i !== idx))}
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {useCredit && creditAmountToUse > 0 && (
                    <div className="flex justify-between text-sm pt-2 border-t text-blue-600">
                      <span>Crédito aplicado:</span>
                      <span>- {formatCurrency(creditAmountToUse)}</span>
                    </div>
                  )}
                  <div className={`flex justify-between text-sm ${!(useCredit && creditAmountToUse > 0) ? 'pt-2 border-t' : ''}`}>
                    <span>Total em pagamentos:</span>
                    <span className={paymentMethods.reduce((s, p) => s + p.amount, 0) >= (cartTotal > 0 ? cartTotal : 0) ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
                      {formatCurrency(paymentMethods.reduce((s, p) => s + p.amount, 0))}
                    </span>
                  </div>
                  {(() => {
                    const totalEffective = cartTotal > 0 ? cartTotal : 0;
                    const totalPaid = paymentMethods.reduce((s, p) => s + p.amount, 0);
                    const remaining = totalEffective - totalPaid;
                    if (remaining > 0) {
                      return (
                        <div className="flex justify-between text-sm font-semibold text-orange-600 bg-orange-50 p-2 rounded">
                          <span>Saldo a receber:</span>
                          <span>{formatCurrency(remaining)}</span>
                        </div>
                      );
                    } else if (remaining < 0) {
                      return (
                        <div className="flex justify-between text-sm font-semibold text-blue-600 bg-blue-50 p-2 rounded">
                          <span>Troco:</span>
                          <span>{formatCurrency(Math.abs(remaining))}</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex justify-between text-sm font-semibold text-green-600 bg-green-50 p-2 rounded">
                          <span>Pagamento completo</span>
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
              
              <div className="grid grid-cols-4 gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const remaining = cartTotal - paymentMethods.reduce((s, p) => s + p.amount, 0);
                    setPaymentMethods([...paymentMethods, { method: "cash", amount: remaining > 0 ? remaining : 0 }]);
                  }}
                  className="flex-col h-16 text-xs"
                >
                  <DollarSign className="h-5 w-5 mb-1" />
                  Dinheiro
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const remaining = cartTotal - paymentMethods.reduce((s, p) => s + p.amount, 0);
                    setPaymentMethods([...paymentMethods, { method: "credit_card", amount: remaining > 0 ? remaining : 0 }]);
                  }}
                  className="flex-col h-16 text-xs"
                >
                  <CreditCard className="h-5 w-5 mb-1" />
                  Crédito
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const remaining = cartTotal - paymentMethods.reduce((s, p) => s + p.amount, 0);
                    setPaymentMethods([...paymentMethods, { method: "debit_card", amount: remaining > 0 ? remaining : 0 }]);
                  }}
                  className="flex-col h-16 text-xs"
                >
                  <CreditCard className="h-5 w-5 mb-1" />
                  Débito
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const remaining = cartTotal - paymentMethods.reduce((s, p) => s + p.amount, 0);
                    setPaymentMethods([...paymentMethods, { method: "pix", amount: remaining > 0 ? remaining : 0 }]);
                  }}
                  className="flex-col h-16 text-xs"
                >
                  <RefreshCw className="h-5 w-5 mb-1" />
                  PIX
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancelar</Button>
            <Button 
              onClick={finalizeSale} 
              disabled={cartTotal > 0 && (paymentMethods.length === 0 || paymentMethods.reduce((s, p) => s + p.amount, 0) < cartTotal)}
              className="bg-green-600 hover:bg-green-700"
              data-testid="btn-confirm-sale"
            >
              <CheckCircle className="h-4 w-4 mr-2" /> Confirmar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewPersonDialog} onOpenChange={(open) => {
        setShowNewPersonDialog(open);
        if (!open) {
          setEditingPerson(null);
          setNewPerson({
            fullName: "", cpfCnpj: "", email: "", phone: "", whatsapp: "",
            address: "", city: "", state: "", zipCode: "", notes: "", roles: []
          });
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPerson ? "Editar Pessoa" : "Cadastrar Nova Pessoa"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome Completo *</Label>
                <Input 
                  placeholder="Nome completo ou razão social"
                  value={newPerson.fullName}
                  onChange={(e) => setNewPerson({...newPerson, fullName: e.target.value})}
                  data-testid="input-person-name"
                />
              </div>
              <div>
                <Label>CPF/CNPJ</Label>
                <Input 
                  placeholder="000.000.000-00"
                  value={newPerson.cpfCnpj}
                  onChange={(e) => setNewPerson({...newPerson, cpfCnpj: e.target.value})}
                  data-testid="input-person-cpf"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input 
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newPerson.email}
                  onChange={(e) => setNewPerson({...newPerson, email: e.target.value})}
                  data-testid="input-person-email"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input 
                  placeholder="(00) 00000-0000"
                  value={newPerson.phone}
                  onChange={(e) => setNewPerson({...newPerson, phone: e.target.value})}
                  data-testid="input-person-phone"
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input 
                  placeholder="(00) 00000-0000"
                  value={newPerson.whatsapp}
                  onChange={(e) => setNewPerson({...newPerson, whatsapp: e.target.value})}
                  data-testid="input-person-whatsapp"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Papéis (selecione um ou mais)</Label>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: "customer", label: "Cliente" },
                  { value: "supplier", label: "Fornecedor" },
                  { value: "employee", label: "Colaborador" },
                  { value: "technician", label: "Técnico" },
                  { value: "partner", label: "Parceiro" }
                ].map(role => (
                  <div key={role.value} className="flex items-center gap-2">
                    <Checkbox 
                      id={`role-${role.value}`}
                      checked={newPerson.roles.includes(role.value)}
                      onCheckedChange={() => togglePersonRole(role.value)}
                    />
                    <Label htmlFor={`role-${role.value}`} className="cursor-pointer">{role.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Endereço</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input 
                    placeholder="Rua, número"
                    value={newPerson.address}
                    onChange={(e) => setNewPerson({...newPerson, address: e.target.value})}
                  />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input 
                    placeholder="00000-000"
                    value={newPerson.zipCode}
                    onChange={(e) => setNewPerson({...newPerson, zipCode: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input 
                    placeholder="Cidade"
                    value={newPerson.city}
                    onChange={(e) => setNewPerson({...newPerson, city: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select 
                    value={newPerson.state}
                    onValueChange={(v) => setNewPerson({...newPerson, state: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea 
                placeholder="Observações sobre a pessoa..."
                value={newPerson.notes}
                onChange={(e) => setNewPerson({...newPerson, notes: e.target.value})}
                rows={3}
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPersonDialog(false)}>Cancelar</Button>
            <Button onClick={handleSavePerson} disabled={!newPerson.fullName}>
              {editingPerson ? "Salvar Alterações" : "Cadastrar Pessoa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Person History Dialog */}
      <Dialog open={!!viewingPerson} onOpenChange={(open) => !open && setViewingPerson(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {viewingPerson?.fullName}
            </DialogTitle>
            <DialogDescription>
              {viewingPerson?.cpfCnpj && `CPF/CNPJ: ${viewingPerson.cpfCnpj}`}
              {viewingPerson?.phone && ` | Tel: ${viewingPerson.phone}`}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="sales" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="sales" className="gap-1">
                <ShoppingCart className="h-4 w-4" />
                Vendas ({personHistory.sales.length})
              </TabsTrigger>
              <TabsTrigger value="services" className="gap-1">
                <Wrench className="h-4 w-4" />
                Serviços ({personHistory.services.length})
              </TabsTrigger>
              <TabsTrigger value="tradeins" className="gap-1">
                <RefreshCw className="h-4 w-4" />
                Trade-Ins ({personHistory.tradeIns.length})
              </TabsTrigger>
              <TabsTrigger value="credits" className="gap-1">
                <DollarSign className="h-4 w-4" />
                Créditos ({personHistory.credits.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="sales" className="mt-4">
              {personHistory.sales.length > 0 ? (
                <div className="space-y-2">
                  {personHistory.sales.map((sale: any) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{sale.saleNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{formatCurrency(sale.totalAmount)}</p>
                        <Badge variant={sale.status === "completed" ? "default" : "secondary"}>
                          {sale.status === "completed" ? "Concluída" : sale.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhuma venda registrada</p>
              )}
            </TabsContent>
            
            <TabsContent value="services" className="mt-4">
              {personHistory.services.length > 0 ? (
                <div className="space-y-2">
                  {personHistory.services.map((service: any) => (
                    <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{service.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {service.brand} {service.model} | {new Date(service.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(service.totalCost)}</p>
                        <Badge variant={service.status === "completed" ? "default" : "secondary"}>
                          {service.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhum serviço registrado</p>
              )}
            </TabsContent>
            
            <TabsContent value="tradeins" className="mt-4">
              {personHistory.tradeIns.length > 0 ? (
                <div className="space-y-2">
                  {personHistory.tradeIns.map((tradeIn: any) => (
                    <div key={tradeIn.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{tradeIn.brand} {tradeIn.model}</p>
                        <p className="text-sm font-mono text-muted-foreground">
                          IMEI: {tradeIn.imei}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{formatCurrency(tradeIn.estimatedValue)}</p>
                        <Badge variant={tradeIn.status === "approved" ? "default" : tradeIn.status === "rejected" ? "destructive" : "secondary"}>
                          {tradeIn.status === "approved" ? "Aprovado" : tradeIn.status === "rejected" ? "Rejeitado" : "Pendente"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhum trade-in registrado</p>
              )}
            </TabsContent>
            
            <TabsContent value="credits" className="mt-4">
              {personHistory.credits.length > 0 ? (
                <div className="space-y-2">
                  {personHistory.credits.map((credit: any) => (
                    <div key={credit.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{credit.description}</p>
                        <p className="text-sm text-muted-foreground">
                          Origem: {credit.origin === "trade_in" ? "Trade-In" : credit.origin} | {new Date(credit.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">
                          <span className="text-green-600">Disponível: {formatCurrency(credit.remainingAmount)}</span>
                          <span className="text-muted-foreground text-sm ml-2">/ {formatCurrency(credit.amount)}</span>
                        </p>
                        <Badge variant={credit.status === "active" ? "default" : credit.status === "used" ? "secondary" : "outline"}>
                          {credit.status === "active" ? "Ativo" : credit.status === "used" ? "Usado" : credit.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhum crédito registrado</p>
              )}
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => handleEditPerson(viewingPerson)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar Cadastro
            </Button>
            <Button onClick={() => setViewingPerson(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Trade-In Alert Dialog */}
      <Dialog open={showSessionRequired} onOpenChange={setShowSessionRequired}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Sessão Necessária
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para iniciar esta operação, selecione a empresa e o vendedor no topo da tela.
            </p>
            <div className="space-y-3">
              <div>
                <Label>Empresa</Label>
                <Select value={selectedEmpresaId ? String(selectedEmpresaId) : ""} onValueChange={handleSelectEmpresa}>
                  <SelectTrigger data-testid="modal-select-empresa">
                    <SelectValue placeholder="Selecione a Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map(emp => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.nomeFantasia || emp.razaoSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vendedor</Label>
                <Select value={selectedSellerId ? String(selectedSellerId) : ""} onValueChange={handleSelectSeller}>
                  <SelectTrigger data-testid="modal-select-vendedor">
                    <SelectValue placeholder="Selecione o Vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {sellers.map(seller => (
                      <SelectItem key={seller.id} value={String(seller.id)}>
                        {seller.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSessionRequired(false)}>Cancelar</Button>
            <Button 
              onClick={() => setShowSessionRequired(false)} 
              disabled={!selectedEmpresaId || !selectedSellerId}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTradeInAlert} onOpenChange={setShowTradeInAlert}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <AlertTriangle className="h-5 w-5" />
              Trade-In Disponível
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>O cliente <strong>{pdvCustomer?.fullName}</strong> possui trade-ins registrados:</p>
            
            {customerTradeIns.length > 0 && (
              <div className="space-y-2">
                {customerTradeIns.map((tradeIn: any) => (
                  <div key={tradeIn.id} className="border p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{tradeIn.deviceModel || tradeIn.brand}</p>
                        {tradeIn.imei && <p className="text-sm text-muted-foreground">IMEI: {tradeIn.imei}</p>}
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          tradeIn.status === "approved" ? "default" : 
                          tradeIn.status === "pending" ? "secondary" : 
                          tradeIn.status === "analyzing" ? "outline" : "destructive"
                        }>
                          {tradeIn.status === "approved" ? "Aprovado" : 
                           tradeIn.status === "pending" ? "Pendente" : 
                           tradeIn.status === "analyzing" ? "Em Análise" : "Rejeitado"}
                        </Badge>
                        {tradeIn.creditValue && (
                          <p className="text-green-600 font-bold mt-1">{formatCurrency(tradeIn.creditValue)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {customerTotalCredit > 0 && (
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <p className="text-green-800">
                  <strong>Crédito Total Disponível: {formatCurrency(customerTotalCredit)}</strong>
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Este valor pode ser utilizado como forma de pagamento nesta venda.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTradeInAlert(false)}>Fechar</Button>
            {customerTotalCredit > 0 && (
              <Button onClick={() => {
                setUseCredit(true);
                setCreditAmountToUse(Math.min(customerTotalCredit, cartTotal));
                setShowTradeInAlert(false);
                toast({ title: "Crédito aplicado na venda!" });
              }}>
                Usar Crédito na Venda
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Manager Password Modal */}
      <Dialog open={showManagerPasswordModal} onOpenChange={setShowManagerPasswordModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Autorização do Gerente
            </DialogTitle>
            <DialogDescription>
              Esta operação requer senha de gerente para continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Senha do Gerente</Label>
              <Input 
                type="password"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                placeholder="Digite a senha"
                onKeyDown={(e) => e.key === "Enter" && handleManagerPasswordSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowManagerPasswordModal(false);
              setManagerPassword("");
              setPendingManagerAction(null);
            }}>Cancelar</Button>
            <Button onClick={handleManagerPasswordSubmit}>Autorizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Return Modal */}
      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5" />
              Devolução / Troca de Mercadoria
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <Input 
                placeholder="Buscar por código da venda, cliente ou IMEI..."
                value={returnSearch}
                onChange={(e) => setReturnSearch(e.target.value)}
                className="flex-1"
              />
              <Button onClick={searchReturnSales}>
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>
            
            {/* Sales List */}
            {!selectedReturnSale && returnSales.length > 0 && (
              <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                {returnSales.map((sale: any) => (
                  <div 
                    key={sale.id} 
                    className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center"
                    onClick={() => setSelectedReturnSale(sale)}
                  >
                    <div>
                      <p className="font-medium">{sale.saleNumber}</p>
                      <p className="text-sm text-muted-foreground">{sale.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(sale.totalAmount)}</p>
                      <p className="text-sm text-muted-foreground">{new Date(sale.saleDate).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Selected Sale Items */}
            {selectedReturnSale && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-muted p-3 rounded-lg">
                  <div>
                    <p className="font-medium">Venda: {selectedReturnSale.saleNumber}</p>
                    <p className="text-sm text-muted-foreground">{selectedReturnSale.customerName}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setSelectedReturnSale(null);
                    setReturnItems([]);
                  }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="border rounded-lg divide-y">
                  <div className="p-2 bg-muted font-medium text-sm grid grid-cols-5 gap-2">
                    <span></span>
                    <span>Produto</span>
                    <span>IMEI</span>
                    <span className="text-right">Qtd</span>
                    <span className="text-right">Valor</span>
                  </div>
                  {(selectedReturnSale.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="p-2 grid grid-cols-5 gap-2 items-center hover:bg-muted/50">
                      <div>
                        <Checkbox 
                          checked={returnItems.some(i => i.id === item.id)}
                          onCheckedChange={() => toggleReturnItem(item)}
                        />
                      </div>
                      <span className="truncate">{item.itemName || item.productName}</span>
                      <span className="text-sm text-muted-foreground">{item.imei || "-"}</span>
                      <span className="text-right">{item.quantity || 1}</span>
                      <span className="text-right font-medium">{formatCurrency(item.totalPrice || item.unitPrice)}</span>
                    </div>
                  ))}
                </div>
                
                <div>
                  <Label>Motivo da Devolução</Label>
                  <Textarea 
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Descreva o motivo da devolução..."
                    rows={2}
                  />
                </div>
                
                <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={returnGenerateCredit}
                      onCheckedChange={setReturnGenerateCredit}
                      data-testid="switch-return-generate-credit"
                    />
                    <Label className="font-medium">Gerar crédito para o cliente</Label>
                  </div>
                  {returnGenerateCredit && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Label className="text-sm">Validade:</Label>
                      <Input
                        type="number"
                        className="w-20 h-8"
                        value={returnCreditExpiration}
                        onChange={(e) => setReturnCreditExpiration(parseInt(e.target.value) || 0)}
                        data-testid="input-return-credit-expiration"
                      />
                      <span className="text-sm text-muted-foreground">dias</span>
                    </div>
                  )}
                </div>
                
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-medium">
                    Total a devolver: {formatCurrency(returnItems.reduce((sum, i) => sum + parseFloat(i.totalPrice || i.unitPrice || 0), 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {returnItems.length} item(s) selecionado(s)
                  </p>
                </div>
              </div>
            )}
            
            {returnSales.length === 0 && !selectedReturnSale && (
              <p className="text-center text-muted-foreground py-8">
                Digite um código de venda, nome do cliente ou IMEI para buscar
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowReturnModal(false);
              setSelectedReturnSale(null);
              setReturnItems([]);
              setReturnReason("");
              setReturnSales([]);
              setReturnSearch("");
            }}>Cancelar</Button>
            <Button 
              onClick={processReturn} 
              disabled={!selectedReturnSale || returnItems.length === 0 || processingReturn}
            >
              {processingReturn ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
              ) : (
                <>Processar Devolução</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Service Order Details/Edit Modal */}
      <Dialog open={showOsDetailsModal} onOpenChange={setShowOsDetailsModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Gerenciar Ordem de Serviço
            </DialogTitle>
            <DialogDescription>
              {editingServiceOrder?.orderNumber} - {editingServiceOrder?.brand} {editingServiceOrder?.model}
            </DialogDescription>
          </DialogHeader>
          
          {editingServiceOrder && (
            <div className="space-y-6">
              {/* Info Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{editingServiceOrder.customerName}</p>
                  <p className="text-sm">{editingServiceOrder.customerPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IMEI</p>
                  <p className="font-mono">{editingServiceOrder.imei}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p>{editingServiceOrder.issueDescription}</p>
                </div>
              </div>
              
              {/* Status da OS */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Status da OS</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "open", label: "Aberta", color: "bg-blue-100 text-blue-800 border-blue-300" },
                    { value: "in_progress", label: "Em Andamento", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
                    { value: "waiting_parts", label: "Aguardando Peças", color: "bg-orange-100 text-orange-800 border-orange-300" },
                    { value: "completed", label: "Concluída", color: "bg-green-100 text-green-800 border-green-300" },
                    { value: "cancelled", label: "Cancelada", color: "bg-gray-100 text-gray-800 border-gray-300" },
                  ].map((status) => (
                    <Button
                      key={status.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`${osStatus === status.value ? status.color + " border-2" : ""}`}
                      onClick={() => setOsStatus(status.value)}
                    >
                      {status.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Classificação da Avaliação (apenas para Trade-In) */}
              {editingServiceOrder.isInternal && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Classificação da Avaliação</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "pending", label: "Pendente", color: "bg-gray-100 text-gray-800 border-gray-300" },
                      { value: "in_analysis", label: "Em Análise", color: "bg-blue-100 text-blue-800 border-blue-300" },
                      { value: "approved", label: "Aprovado", color: "bg-green-100 text-green-800 border-green-300" },
                      { value: "rejected", label: "Rejeitado", color: "bg-red-100 text-red-800 border-red-300" },
                    ].map((status) => (
                      <Button
                        key={status.value}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`${osEvaluationStatus === status.value ? status.color + " border-2" : ""}`}
                        onClick={() => setOsEvaluationStatus(status.value)}
                      >
                        {status.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Checklist de Avaliação */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Checklist de Avaliação
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { key: "powerOn", label: "Liga normalmente" },
                    { key: "screenOk", label: "Tela sem defeitos" },
                    { key: "touchOk", label: "Touch funcionando" },
                    { key: "buttonsOk", label: "Botões funcionando" },
                    { key: "camerasOk", label: "Câmeras funcionando" },
                    { key: "speakerOk", label: "Alto-falante OK" },
                    { key: "microphoneOk", label: "Microfone OK" },
                    { key: "chargingOk", label: "Carregamento OK" },
                    { key: "wifiOk", label: "Wi-Fi funcionando" },
                    { key: "bluetoothOk", label: "Bluetooth OK" },
                    { key: "simOk", label: "Chip funcionando" },
                    { key: "biometricOk", label: "Biometria OK" },
                    { key: "batteryOk", label: "Bateria em bom estado" },
                    { key: "sensorsOk", label: "Sensores funcionando" },
                  ].map((item) => (
                    <div 
                      key={item.key}
                      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                        osChecklistData[item.key] === true 
                          ? 'bg-green-50 border-green-300 text-green-800' 
                          : osChecklistData[item.key] === false 
                            ? 'bg-red-50 border-red-300 text-red-800' 
                            : 'bg-muted/20 border-muted'
                      }`}
                      onClick={() => {
                        setOsChecklistData(prev => ({
                          ...prev,
                          [item.key]: prev[item.key] === true ? false : prev[item.key] === false ? undefined : true
                        }));
                      }}
                      data-testid={`checklist-${item.key}`}
                    >
                      {osChecklistData[item.key] === true ? (
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : osChecklistData[item.key] === false ? (
                        <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-sm">{item.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Clique para alternar: sem avaliação → OK → com defeito</p>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor Estimado (R$)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={osEstimatedValue}
                    onChange={(e) => setOsEstimatedValue(e.target.value)}
                    placeholder="0,00"
                  />
                  <p className="text-xs text-muted-foreground">Valor inicial estimado para o serviço</p>
                </div>
                <div className="space-y-2">
                  <Label>Valor Avaliado (R$)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={osEvaluatedValue}
                    onChange={(e) => setOsEvaluatedValue(e.target.value)}
                    placeholder="0,00"
                  />
                  <p className="text-xs text-muted-foreground">Valor final após diagnóstico</p>
                </div>
              </div>
              
              {/* Observações */}
              <div className="space-y-2">
                <Label>Observações / Diagnóstico</Label>
                <Textarea 
                  value={osNotes}
                  onChange={(e) => setOsNotes(e.target.value)}
                  placeholder="Anotações sobre o diagnóstico, peças necessárias, etc."
                  rows={3}
                />
              </div>

              {/* Peças Utilizadas */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Peças Utilizadas
                </Label>
                
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input 
                      placeholder="Buscar peça pelo nome ou código..."
                      value={osItemSearch}
                      onChange={(e) => {
                        setOsItemSearch(e.target.value);
                        searchOsProducts(e.target.value);
                      }}
                      data-testid="input-os-part-search"
                    />
                    {osItemResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {osItemResults.map((product) => (
                          <div 
                            key={product.id}
                            className="p-2 hover:bg-muted cursor-pointer flex justify-between items-center text-sm"
                            onClick={() => addOsItem(product)}
                            data-testid={`os-part-result-${product.id}`}
                          >
                            <div>
                              <span className="font-medium">{product.name}</span>
                              <span className="text-muted-foreground ml-2">({product.code})</span>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground">Estoque: {product.stockQty}</span>
                              <span className="ml-2 font-medium">R$ {parseFloat(product.costPrice || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input 
                    type="number"
                    min={1}
                    value={osItemQuantity}
                    onChange={(e) => setOsItemQuantity(parseInt(e.target.value) || 1)}
                    className="w-20"
                    placeholder="Qtd"
                    data-testid="input-os-part-qty"
                  />
                </div>
                
                {loadingOsItems ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Carregando peças...
                  </div>
                ) : osItems.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2 text-left">Peça</th>
                          <th className="p-2 text-center">Qtd</th>
                          <th className="p-2 text-right">Unitário</th>
                          <th className="p-2 text-right">Total</th>
                          <th className="p-2 text-center">Status</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {osItems.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="p-2">
                              <span className="font-medium">{item.itemName}</span>
                              {item.itemCode && <span className="text-muted-foreground text-xs ml-1">({item.itemCode})</span>}
                            </td>
                            <td className="p-2 text-center">{item.quantity}</td>
                            <td className="p-2 text-right">R$ {parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                            <td className="p-2 text-right font-medium">R$ {parseFloat(item.totalPrice || 0).toFixed(2)}</td>
                            <td className="p-2 text-center">
                              <Badge variant={item.status === 'applied' ? 'default' : item.status === 'removed' ? 'destructive' : 'secondary'} className="text-xs">
                                {item.status === 'applied' ? 'Aplicada' : item.status === 'removed' ? 'Removida' : 'Pendente'}
                              </Badge>
                            </td>
                            <td className="p-2 text-center">
                              {item.status === 'pending' && (
                                <Button variant="ghost" size="sm" onClick={() => removeOsItem(item.id)} data-testid={`btn-remove-part-${item.id}`}>
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30">
                        <tr className="border-t font-semibold">
                          <td colSpan={3} className="p-2 text-right">Total Peças:</td>
                          <td className="p-2 text-right">R$ {osItems.reduce((sum, i) => sum + parseFloat(i.totalPrice || 0), 0).toFixed(2)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg bg-muted/20">
                    Nenhuma peça adicionada. Use a busca acima para adicionar peças.
                  </p>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowOsDetailsModal(false);
                setEditingServiceOrder(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={async () => {
              if (!editingServiceOrder) return;
              
              try {
                const hasChecklistEntries = Object.keys(osChecklistData).some(k => osChecklistData[k] !== undefined);
                const updateData: any = {
                  status: osStatus,
                  diagnosisNotes: osNotes,
                  estimatedValue: osEstimatedValue || "0",
                  evaluatedValue: osEvaluatedValue || "0",
                  laborCost: osEvaluatedValue || osEstimatedValue || "0",
                  partsCost: String(osItems.reduce((sum, i) => sum + parseFloat(i.totalPrice || 0), 0)),
                  checklistData: osChecklistData,
                  checklistCompletedBy: hasChecklistEntries ? "user" : null,
                };
                
                if (editingServiceOrder.isInternal) {
                  updateData.evaluationStatus = osEvaluationStatus;
                }
                
                const res = await fetch(`/api/retail/service-orders/${editingServiceOrder.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify(updateData)
                });
                
                if (res.ok) {
                  toast({ 
                    title: "OS Atualizada!", 
                    description: `Ordem ${editingServiceOrder.orderNumber} foi atualizada com sucesso.` 
                  });
                  loadServiceOrders();
                  setShowOsDetailsModal(false);
                  setEditingServiceOrder(null);
                } else {
                  throw new Error("Erro ao atualizar");
                }
              } catch (error) {
                toast({ title: "Erro ao atualizar OS", variant: "destructive" });
              }
            }}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar OS Manutenção a partir de Avaliação Aprovada */}
      <Dialog open={showCreateOsDialog} onOpenChange={setShowCreateOsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Criar Ordem de Serviço
            </DialogTitle>
            <DialogDescription>
              Criar OS de manutenção para o dispositivo avaliado
            </DialogDescription>
          </DialogHeader>
          
          {selectedEvaluation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                <div>
                  <p className="text-muted-foreground">IMEI</p>
                  <p className="font-mono font-medium">{selectedEvaluation.imei}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dispositivo</p>
                  <p className="font-medium">{selectedEvaluation.brand} {selectedEvaluation.model}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedEvaluation.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor Avaliado</p>
                  <p className="font-medium text-green-600">{formatCurrency(selectedEvaluation.estimatedValue || 0)}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Tipo de Serviço</Label>
                <select 
                  className="w-full border rounded-md p-2 text-sm"
                  id="os-service-type"
                  defaultValue="revision"
                  data-testid="select-os-service-type"
                >
                  <option value="revision">Revisão Geral</option>
                  <option value="cleaning">Limpeza</option>
                  <option value="maintenance">Manutenção</option>
                  <option value="quality_check">Controle de Qualidade</option>
                  <option value="trade_in_diagnosis">Diagnóstico Trade-In</option>
                  <option value="trade_in_maintenance">Manutenção Trade-In</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>Descrição do Serviço</Label>
                <Textarea 
                  id="os-description"
                  defaultValue={`Avaliação de Trade-In - ${selectedEvaluation.brand} ${selectedEvaluation.model}`}
                  rows={2}
                  data-testid="input-os-description"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateOsDialog(false)}>
              Cancelar
            </Button>
            <Button 
              data-testid="btn-confirm-create-os"
              onClick={async () => {
                if (!selectedEvaluation) return;
                try {
                  const serviceType = (document.getElementById("os-service-type") as HTMLSelectElement)?.value || "revision";
                  const description = (document.getElementById("os-description") as HTMLTextAreaElement)?.value || "";
                  
                  const osData = {
                    tenantId: selectedEvaluation.tenantId,
                    storeId: selectedEvaluation.storeId || retailStores[0]?.id || 1,
                    imei: selectedEvaluation.imei,
                    brand: selectedEvaluation.brand,
                    model: selectedEvaluation.model,
                    customerName: selectedEvaluation.customerName || "Cliente",
                    customerPhone: selectedEvaluation.customerPhone || "",
                    personId: selectedEvaluation.personId,
                    serviceType: "diagnostic",
                    internalType: serviceType,
                    issueDescription: description,
                    origin: "device_acquisition",
                    isInternal: true,
                    sourceEvaluationId: selectedEvaluation.id,
                    estimatedValue: selectedEvaluation.estimatedValue,
                  };
                  
                  const res = await fetch("/api/retail/service-orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(osData)
                  });
                  
                  if (res.ok) {
                    const order = await res.json();
                    await fetch(`/api/retail/evaluations/${selectedEvaluation.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ maintenanceOrderId: order.id })
                    });
                    toast({ title: "OS Criada!", description: `Ordem ${order.orderNumber} criada com sucesso.` });
                    setShowCreateOsDialog(false);
                    loadServiceOrders();
                    loadEvaluations();
                  } else {
                    const err = await res.json();
                    throw new Error(err.error || "Erro ao criar OS");
                  }
                } catch (error: any) {
                  toast({ title: "Erro ao criar OS", description: error.message, variant: "destructive" });
                }
              }}
            >
              Criar OS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Formas de Pagamento */}
      <Dialog open={showPaymentMethodsDialog} onOpenChange={setShowPaymentMethodsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              Formas de Pagamento
            </DialogTitle>
            <DialogDescription>Gerencie as formas de pagamento aceitas</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setEditingPaymentMethod({} as any)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Forma
              </Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Taxa (%)</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cadastroPaymentMethods.map((pm) => (
                  <TableRow key={pm.id}>
                    <TableCell className="font-medium">{pm.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{pm.type}</Badge>
                    </TableCell>
                    <TableCell>{pm.feePercent || 0}%</TableCell>
                    <TableCell>{pm.installmentsMax || 1}x</TableCell>
                    <TableCell>
                      <Badge variant={pm.isActive ? "default" : "secondary"}>
                        {pm.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setEditingPaymentMethod(pm)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-500"
                          onClick={async () => {
                            if (confirm("Excluir esta forma de pagamento?")) {
                              await fetch(`/api/retail/payment-methods/${pm.id}`, {
                                method: "DELETE",
                                credentials: "include"
                              });
                              loadCadastroPaymentMethods();
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {cadastroPaymentMethods.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma forma de pagamento cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Edição Forma de Pagamento */}
      <Dialog open={!!editingPaymentMethod} onOpenChange={(open) => !open && setEditingPaymentMethod(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPaymentMethod?.id ? "Editar" : "Nova"} Forma de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input 
                value={editingPaymentMethod?.name || ""}
                onChange={(e) => setEditingPaymentMethod(prev => prev ? {...prev, name: e.target.value} : null)}
                placeholder="Ex: Cartão de Crédito"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={editingPaymentMethod?.type || ""}
                  onValueChange={(v) => setEditingPaymentMethod(prev => prev ? {...prev, type: v} : null)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taxa (%)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={editingPaymentMethod?.feePercent || ""}
                  onChange={(e) => setEditingPaymentMethod(prev => prev ? {...prev, feePercent: e.target.value} : null)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máx. Parcelas</Label>
                <Input 
                  type="number"
                  value={editingPaymentMethod?.installmentsMax || 1}
                  onChange={(e) => setEditingPaymentMethod(prev => prev ? {...prev, installmentsMax: parseInt(e.target.value)} : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Taxa Fixa (R$)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={editingPaymentMethod?.fixedFee || ""}
                  onChange={(e) => setEditingPaymentMethod(prev => prev ? {...prev, fixedFee: e.target.value} : null)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={editingPaymentMethod?.isActive ?? true}
                onCheckedChange={(v) => setEditingPaymentMethod(prev => prev ? {...prev, isActive: v} : null)}
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPaymentMethod(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!editingPaymentMethod?.name) return;
              const method = editingPaymentMethod.id ? "PUT" : "POST";
              const url = editingPaymentMethod.id 
                ? `/api/retail/payment-methods/${editingPaymentMethod.id}`
                : "/api/retail/payment-methods";
              
              await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(editingPaymentMethod)
              });
              
              setEditingPaymentMethod(null);
              loadCadastroPaymentMethods();
              toast({ title: "Salvo com sucesso!" });
            }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Vendedores */}
      <Dialog open={showSellersDialog} onOpenChange={setShowSellersDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-green-600" />
              Vendedores
            </DialogTitle>
            <DialogDescription>Gerencie a equipe de vendas</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setEditingSeller({} as any)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Vendedor
              </Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Meta Mensal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cadastroSellers.map((seller) => (
                  <TableRow key={seller.id}>
                    <TableCell className="font-mono">{seller.code}</TableCell>
                    <TableCell className="font-medium">{seller.name}</TableCell>
                    <TableCell>
                      {cadastroCommissionPlans.find(cp => cp.id === seller.commissionPlanId)?.name || "Sem plano"}
                    </TableCell>
                    <TableCell>{seller.storeId || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={seller.isActive ? "default" : "secondary"}>
                        {seller.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingSeller(seller)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-500"
                          onClick={async () => {
                            if (confirm("Excluir este vendedor?")) {
                              await fetch(`/api/retail/sellers/${seller.id}`, { method: "DELETE", credentials: "include" });
                              loadCadastroSellers();
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {cadastroSellers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum vendedor cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Edição Vendedor */}
      <Dialog open={!!editingSeller} onOpenChange={(open) => !open && setEditingSeller(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSeller?.id ? "Editar" : "Novo"} Vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input 
                  value={editingSeller?.code || ""}
                  onChange={(e) => setEditingSeller(prev => prev ? {...prev, code: e.target.value} : null)}
                  placeholder="VND001"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input 
                  value={editingSeller?.name || ""}
                  onChange={(e) => setEditingSeller(prev => prev ? {...prev, name: e.target.value} : null)}
                  placeholder="Nome do vendedor"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pessoa Vinculada</Label>
              <Select 
                value={editingSeller?.personId?.toString() || ""}
                onValueChange={(v) => setEditingSeller(prev => prev ? {...prev, personId: parseInt(v)} : null)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma pessoa" /></SelectTrigger>
                <SelectContent>
                  {personsList.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plano de Comissão</Label>
              <Select 
                value={editingSeller?.commissionPlanId?.toString() || ""}
                onValueChange={(v) => setEditingSeller(prev => prev ? {...prev, commissionPlanId: parseInt(v)} : null)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {cadastroCommissionPlans.map(cp => (
                    <SelectItem key={cp.id} value={cp.id.toString()}>{cp.name} ({cp.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={editingSeller?.isActive ?? true}
                onCheckedChange={(v) => setEditingSeller(prev => prev ? {...prev, isActive: v} : null)}
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSeller(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!editingSeller?.name) return;
              const method = editingSeller.id ? "PUT" : "POST";
              const url = editingSeller.id ? `/api/retail/sellers/${editingSeller.id}` : "/api/retail/sellers";
              
              await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(editingSeller)
              });
              
              setEditingSeller(null);
              loadCadastroSellers();
              toast({ title: "Vendedor salvo!" });
            }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Comissões */}
      <Dialog open={showCommissionsDialog} onOpenChange={setShowCommissionsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-purple-600" />
              Planos de Comissão
            </DialogTitle>
            <DialogDescription>Configure os planos de comissão para vendedores</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setEditingCommissionPlan({} as any)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor Base</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cadastroCommissionPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {plan.type === "percentage" ? "Percentual" : plan.type === "fixed" ? "Fixo" : "Escalonado"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {plan.type === "percentage" ? `${plan.baseValue}%` : `R$ ${plan.baseValue}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.isActive ? "default" : "secondary"}>
                        {plan.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingCommissionPlan(plan)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-500"
                          onClick={async () => {
                            if (confirm("Excluir este plano?")) {
                              await fetch(`/api/retail/commission-plans/${plan.id}`, { method: "DELETE", credentials: "include" });
                              loadCadastroCommissionPlans();
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {cadastroCommissionPlans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum plano de comissão cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Edição Plano de Comissão */}
      <Dialog open={!!editingCommissionPlan} onOpenChange={(open) => !open && setEditingCommissionPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCommissionPlan?.id ? "Editar" : "Novo"} Plano de Comissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input 
                value={editingCommissionPlan?.name || ""}
                onChange={(e) => setEditingCommissionPlan(prev => prev ? {...prev, name: e.target.value} : null)}
                placeholder="Ex: Comissão Padrão"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={editingCommissionPlan?.type || ""}
                  onValueChange={(v) => setEditingCommissionPlan(prev => prev ? {...prev, type: v} : null)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual</SelectItem>
                    <SelectItem value="fixed">Valor Fixo</SelectItem>
                    <SelectItem value="tiered">Escalonado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor Base</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={editingCommissionPlan?.baseValue || ""}
                  onChange={(e) => setEditingCommissionPlan(prev => prev ? {...prev, baseValue: e.target.value} : null)}
                  placeholder="5.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea 
                value={editingCommissionPlan?.description || ""}
                onChange={(e) => setEditingCommissionPlan(prev => prev ? {...prev, description: e.target.value} : null)}
                placeholder="Descrição do plano..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={editingCommissionPlan?.isActive ?? true}
                onCheckedChange={(v) => setEditingCommissionPlan(prev => prev ? {...prev, isActive: v} : null)}
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCommissionPlan(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!editingCommissionPlan?.name) return;
              const method = editingCommissionPlan.id ? "PUT" : "POST";
              const url = editingCommissionPlan.id 
                ? `/api/retail/commission-plans/${editingCommissionPlan.id}`
                : "/api/retail/commission-plans";
              
              await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(editingCommissionPlan)
              });
              
              setEditingCommissionPlan(null);
              loadCadastroCommissionPlans();
              toast({ title: "Plano salvo!" });
            }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Tabelas de Preço */}
      <Dialog open={showPriceTablesDialog} onOpenChange={setShowPriceTablesDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-orange-600" />
              Tabelas de Preço
            </DialogTitle>
            <DialogDescription>Gerencie as tabelas de preço por tipo de cliente</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setEditingPriceTable({} as any)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Tabela
              </Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ajuste</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cadastroPriceTables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-mono">{table.code}</TableCell>
                    <TableCell className="font-medium">{table.name}</TableCell>
                    <TableCell>
                      <Badge variant={parseFloat(table.markupPercent || "0") >= 0 ? "default" : "destructive"}>
                        {parseFloat(table.markupPercent || "0") >= 0 ? "+" : ""}{table.markupPercent}%
                      </Badge>
                    </TableCell>
                    <TableCell>{table.isDefault ? "Padrão" : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={table.isActive ? "default" : "secondary"}>
                        {table.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingPriceTable(table)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-500"
                          onClick={async () => {
                            if (confirm("Excluir esta tabela?")) {
                              await fetch(`/api/retail/price-tables/${table.id}`, { method: "DELETE", credentials: "include" });
                              loadCadastroPriceTables();
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {cadastroPriceTables.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma tabela de preço cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Edição Tabela de Preço */}
      <Dialog open={!!editingPriceTable} onOpenChange={(open) => !open && setEditingPriceTable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPriceTable?.id ? "Editar" : "Nova"} Tabela de Preço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input 
                  value={editingPriceTable?.code || ""}
                  onChange={(e) => setEditingPriceTable(prev => prev ? {...prev, code: e.target.value} : null)}
                  placeholder="TAB001"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input 
                  value={editingPriceTable?.name || ""}
                  onChange={(e) => setEditingPriceTable(prev => prev ? {...prev, name: e.target.value} : null)}
                  placeholder="Tabela Varejo"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Markup (%)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={editingPriceTable?.markupPercent || ""}
                  onChange={(e) => setEditingPriceTable(prev => prev ? {...prev, markupPercent: e.target.value} : null)}
                  placeholder="10.00"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={editingPriceTable?.isDefault ?? false}
                  onCheckedChange={(v) => setEditingPriceTable(prev => prev ? {...prev, isDefault: v} : null)}
                />
                <Label>Tabela Padrão</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea 
                value={editingPriceTable?.description || ""}
                onChange={(e) => setEditingPriceTable(prev => prev ? {...prev, description: e.target.value} : null)}
                placeholder="Descrição da tabela..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={editingPriceTable?.isActive ?? true}
                onCheckedChange={(v) => setEditingPriceTable(prev => prev ? {...prev, isActive: v} : null)}
              />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPriceTable(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!editingPriceTable?.name) return;
              const method = editingPriceTable.id ? "PUT" : "POST";
              const url = editingPriceTable.id 
                ? `/api/retail/price-tables/${editingPriceTable.id}`
                : "/api/retail/price-tables";
              
              await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(editingPriceTable)
              });
              
              setEditingPriceTable(null);
              loadCadastroPriceTables();
              toast({ title: "Tabela salva!" });
            }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Promoções */}
      <Dialog open={showPromotionsDialog} onOpenChange={setShowPromotionsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-red-600" />
              Promoções
            </DialogTitle>
            <DialogDescription>Gerencie promoções e descontos</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setEditingPromotion({} as any)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Promoção
              </Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cadastroPromotions.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className="font-medium">{promo.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {promo.type === "percentage" ? "%" : promo.type === "fixed" ? "R$" : "Combo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {promo.type === "percentage" ? `${promo.discountValue}%` : `R$ ${promo.discountValue}`}
                    </TableCell>
                    <TableCell className="text-sm">
                      {promo.validFrom && promo.validTo 
                        ? `${new Date(promo.validFrom).toLocaleDateString("pt-BR")} - ${new Date(promo.validTo).toLocaleDateString("pt-BR")}`
                        : "Sem período"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={promo.isActive ? "default" : "secondary"}>
                        {promo.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingPromotion(promo)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-500"
                          onClick={async () => {
                            if (confirm("Excluir esta promoção?")) {
                              await fetch(`/api/retail/promotions/${promo.id}`, { method: "DELETE", credentials: "include" });
                              loadCadastroPromotions();
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {cadastroPromotions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma promoção cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Edição Promoção */}
      <Dialog open={!!editingPromotion} onOpenChange={(open) => !open && setEditingPromotion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPromotion?.id ? "Editar" : "Nova"} Promoção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input 
                value={editingPromotion?.name || ""}
                onChange={(e) => setEditingPromotion(prev => prev ? {...prev, name: e.target.value} : null)}
                placeholder="Ex: Black Friday 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={editingPromotion?.type || ""}
                  onValueChange={(v) => setEditingPromotion(prev => prev ? {...prev, type: v} : null)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual</SelectItem>
                    <SelectItem value="fixed">Valor Fixo</SelectItem>
                    <SelectItem value="bundle">Combo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor do Desconto</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={editingPromotion?.discountValue || ""}
                  onChange={(e) => setEditingPromotion(prev => prev ? {...prev, discountValue: e.target.value} : null)}
                  placeholder="10.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input 
                  type="date"
                  value={editingPromotion?.validFrom ? new Date(editingPromotion.validFrom).toISOString().split('T')[0] : ""}
                  onChange={(e) => setEditingPromotion(prev => prev ? {...prev, validFrom: e.target.value || undefined} : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input 
                  type="date"
                  value={editingPromotion?.validTo ? new Date(editingPromotion.validTo).toISOString().split('T')[0] : ""}
                  onChange={(e) => setEditingPromotion(prev => prev ? {...prev, validTo: e.target.value || undefined} : null)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea 
                value={editingPromotion?.description || ""}
                onChange={(e) => setEditingPromotion(prev => prev ? {...prev, description: e.target.value} : null)}
                placeholder="Descrição da promoção..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={editingPromotion?.isActive ?? true}
                onCheckedChange={(v) => setEditingPromotion(prev => prev ? {...prev, isActive: v} : null)}
              />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPromotion(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!editingPromotion?.name) return;
              const method = editingPromotion.id ? "PUT" : "POST";
              const url = editingPromotion.id 
                ? `/api/retail/promotions/${editingPromotion.id}`
                : "/api/retail/promotions";
              
              await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(editingPromotion)
              });
              
              setEditingPromotion(null);
              loadCadastroPromotions();
              toast({ title: "Promoção salva!" });
            }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Meta de Vendedor */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              {editingGoal?.id ? "Editar" : "Nova"} Meta de Vendedor
            </DialogTitle>
            <DialogDescription>Defina a meta de vendas para o vendedor no mês selecionado</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select 
                value={editingGoal?.sellerId?.toString() || ""}
                onValueChange={(v) => setEditingGoal((prev: any) => ({...prev, sellerId: parseInt(v)}))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um vendedor" /></SelectTrigger>
                <SelectContent>
                  {cadastroSellers.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Meta (R$)</Label>
              <Input 
                type="number"
                step="0.01"
                value={editingGoal?.goalAmount || ""}
                onChange={(e) => setEditingGoal((prev: any) => ({...prev, goalAmount: e.target.value}))}
                placeholder="Ex: 50000.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Bônus por atingir meta (R$)</Label>
              <Input 
                type="number"
                step="0.01"
                value={editingGoal?.bonus || ""}
                onChange={(e) => setEditingGoal((prev: any) => ({...prev, bonus: e.target.value}))}
                placeholder="Ex: 500.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={editingGoal?.notes || ""}
                onChange={(e) => setEditingGoal((prev: any) => ({...prev, notes: e.target.value}))}
                placeholder="Observações sobre a meta..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingGoal(null); setShowGoalDialog(false); }}>Cancelar</Button>
            <Button onClick={saveSellerGoal}>Salvar Meta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Fechamento de Comissão */}
      <Dialog open={showClosureDialog} onOpenChange={setShowClosureDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-600" />
              Fechamento de Comissão
            </DialogTitle>
            <DialogDescription>Calcule e feche as comissões do período</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Período</Label>
                <Select value={closurePeriodType} onValueChange={setClosurePeriodType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vendedor (opcional)</Label>
                <Select value={closureSellerId} onValueChange={setClosureSellerId}>
                  <SelectTrigger><SelectValue placeholder="Todos vendedores" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos vendedores</SelectItem>
                    {cadastroSellers.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input 
                  type="date"
                  value={closureDateFrom}
                  onChange={(e) => setClosureDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input 
                  type="date"
                  value={closureDateTo}
                  onChange={(e) => setClosureDateTo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Taxa Comissão (%)</Label>
                <Input 
                  type="number"
                  step="0.1"
                  value={closureCommissionRate}
                  onChange={(e) => setClosureCommissionRate(e.target.value)}
                  placeholder="5"
                />
              </div>
            </div>
            <Button onClick={calculateCommission} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Calcular Comissão
            </Button>

            {closureCalcResult && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resultado do Cálculo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Vendas</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(closureCalcResult.totalSales)}</p>
                      <p className="text-xs text-muted-foreground">{closureCalcResult.salesCount} vendas</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Devoluções (mês)</p>
                      <p className="text-lg font-bold text-red-600">-{formatCurrency(closureCalcResult.totalReturns)}</p>
                      <p className="text-xs text-muted-foreground">{closureCalcResult.returnsCount} devoluções</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vendas Líquidas</p>
                      <p className="text-lg font-bold">{formatCurrency(closureCalcResult.netSales)}</p>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Comissão ({closureCommissionRate}%)</p>
                        <p className="text-lg font-bold text-purple-600">{formatCurrency(closureCalcResult.commissionAmount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Bônus Meta</p>
                        <p className="text-lg font-bold text-blue-600">{formatCurrency(closureCalcResult.bonusAmount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total a Pagar</p>
                        <p className="text-xl font-bold text-green-700">{formatCurrency(closureCalcResult.totalAmount)}</p>
                      </div>
                    </div>
                  </div>
                  {closureCalcResult.returnsDeducted && (
                    <Badge variant="outline" className="text-orange-600">
                      ⚠ Devoluções do mês deduzidas das vendas
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowClosureDialog(false); setClosureCalcResult(null); }}>Cancelar</Button>
            <Button onClick={saveCommissionClosure} disabled={!closureCalcResult}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Registrar Fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Depósito */}
      <Dialog open={showWarehouseDialog} onOpenChange={setShowWarehouseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              {editingWarehouse?.id ? "Editar" : "Novo"} Depósito
            </DialogTitle>
            <DialogDescription>
              Configure as informações do depósito
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input 
                  value={editingWarehouse?.code || ""}
                  onChange={(e) => setEditingWarehouse((prev: any) => ({...prev, code: e.target.value}))}
                  placeholder="DEP001"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input 
                  value={editingWarehouse?.name || ""}
                  onChange={(e) => setEditingWarehouse((prev: any) => ({...prev, name: e.target.value}))}
                  placeholder="Depósito Principal"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={editingWarehouse?.type || "store"}
                  onValueChange={(v) => setEditingWarehouse((prev: any) => ({...prev, type: v}))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store">Loja</SelectItem>
                    <SelectItem value="central">Central</SelectItem>
                    <SelectItem value="transit">Trânsito</SelectItem>
                    <SelectItem value="virtual">Virtual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select 
                  value={editingWarehouse?.state || ""}
                  onValueChange={(v) => setEditingWarehouse((prev: any) => ({...prev, state: v}))}
                >
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input 
                value={editingWarehouse?.city || ""}
                onChange={(e) => setEditingWarehouse((prev: any) => ({...prev, city: e.target.value}))}
                placeholder="Cidade"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Textarea 
                value={editingWarehouse?.address || ""}
                onChange={(e) => setEditingWarehouse((prev: any) => ({...prev, address: e.target.value}))}
                placeholder="Endereço completo..."
              />
            </div>
            
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={editingWarehouse?.isDefault || false}
                  onCheckedChange={(v) => setEditingWarehouse((prev: any) => ({...prev, isDefault: v}))}
                />
                <Label>Depósito Padrão</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={editingWarehouse?.visibleToAllCompanies ?? true}
                  onCheckedChange={(v) => setEditingWarehouse((prev: any) => ({...prev, visibleToAllCompanies: v}))}
                />
                <Label>Visível para Todas Empresas</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={editingWarehouse?.allowNegativeStock || false}
                  onCheckedChange={(v) => setEditingWarehouse((prev: any) => ({...prev, allowNegativeStock: v}))}
                />
                <Label>Permitir Estoque Negativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingWarehouse(null); setShowWarehouseDialog(false); }}>Cancelar</Button>
            <Button onClick={saveWarehouse}>Salvar Depósito</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Movimentação de Estoque */}
      <Dialog open={showMovementDialog} onOpenChange={(open) => { setShowMovementDialog(open); if (open) loadAllProducts(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-green-600" />
              Nova Movimentação de Estoque
            </DialogTitle>
            <DialogDescription>
              Registre entrada ou saída de produtos no depósito: {selectedWarehouse?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg text-sm">
              <p><strong>Depósito:</strong> {selectedWarehouse?.name} ({selectedWarehouse?.code})</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Movimentação *</Label>
                <Select 
                  value={movementForm.movementType}
                  onValueChange={(v) => setMovementForm((prev: any) => ({...prev, movementType: v}))}
                  data-testid="select-movement-type"
                >
                  <SelectTrigger data-testid="trigger-movement-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entrada</SelectItem>
                    <SelectItem value="exit">Saída</SelectItem>
                    <SelectItem value="adjustment">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operação *</Label>
                <Select 
                  value={movementForm.operationType}
                  onValueChange={(v) => setMovementForm((prev: any) => ({...prev, operationType: v}))}
                  data-testid="select-operation-type"
                >
                  <SelectTrigger data-testid="trigger-operation-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">Compra de Fornecedor</SelectItem>
                    <SelectItem value="manual_entry">Entrada Manual</SelectItem>
                    <SelectItem value="trade_in">Trade-In</SelectItem>
                    <SelectItem value="sale">Venda</SelectItem>
                    <SelectItem value="devolution">Devolução</SelectItem>
                    <SelectItem value="inventory_adjustment">Ajuste de Inventário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Produto *</Label>
              <Select 
                value={movementForm.productId?.toString() || ""}
                onValueChange={(v) => setMovementForm((prev: any) => ({...prev, productId: parseInt(v)}))}
                data-testid="select-product"
              >
                <SelectTrigger data-testid="trigger-product"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {allProducts.map((prod: any) => (
                    <SelectItem key={prod.id} value={prod.id.toString()}>{prod.name} ({prod.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Quantidade *</Label>
                <Input 
                  type="number"
                  value={movementForm.quantity}
                  onChange={(e) => setMovementForm((prev: any) => ({...prev, quantity: e.target.value}))}
                  placeholder="10"
                  data-testid="input-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label>Custo Unitário</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={movementForm.unitCost || ""}
                  onChange={(e) => setMovementForm((prev: any) => ({...prev, unitCost: e.target.value}))}
                  placeholder="0.00"
                  data-testid="input-unit-cost"
                />
              </div>
              <div className="space-y-2">
                <Label>Nº Documento (NF)</Label>
                <Input 
                  value={movementForm.referenceNumber || ""}
                  onChange={(e) => setMovementForm((prev: any) => ({...prev, referenceNumber: e.target.value}))}
                  placeholder="NF-12345"
                  data-testid="input-reference"
                />
              </div>
            </div>
            
            {/* Entrada de IMEI/Série */}
            {movementForm.movementType === "entry" && parseInt(movementForm.quantity) > 0 && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Números de Série/IMEI
                  </h4>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setMovementForm((prev: any) => ({
                      ...prev, 
                      serials: [...prev.serials, { imei: "", imei2: "", serialNumber: "" }]
                    }))}
                    data-testid="button-add-serial"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Para produtos controlados por IMEI/série, informe os números individuais abaixo.
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {movementForm.serials.map((serial: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                      <Input 
                        placeholder="IMEI"
                        value={serial.imei}
                        onChange={(e) => {
                          const newSerials = [...movementForm.serials];
                          newSerials[idx].imei = e.target.value;
                          setMovementForm((prev: any) => ({...prev, serials: newSerials}));
                        }}
                        data-testid={`input-imei-${idx}`}
                      />
                      <Input 
                        placeholder="IMEI 2"
                        value={serial.imei2}
                        onChange={(e) => {
                          const newSerials = [...movementForm.serials];
                          newSerials[idx].imei2 = e.target.value;
                          setMovementForm((prev: any) => ({...prev, serials: newSerials}));
                        }}
                        data-testid={`input-imei2-${idx}`}
                      />
                      <Input 
                        placeholder="Nº Série"
                        value={serial.serialNumber}
                        onChange={(e) => {
                          const newSerials = [...movementForm.serials];
                          newSerials[idx].serialNumber = e.target.value;
                          setMovementForm((prev: any) => ({...prev, serials: newSerials}));
                        }}
                        data-testid={`input-serial-${idx}`}
                      />
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => {
                          const newSerials = movementForm.serials.filter((_: any, i: number) => i !== idx);
                          setMovementForm((prev: any) => ({...prev, serials: newSerials}));
                        }}
                        data-testid={`button-remove-serial-${idx}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={movementForm.notes || ""}
                onChange={(e) => setMovementForm((prev: any) => ({...prev, notes: e.target.value}))}
                placeholder="Observações da movimentação..."
                data-testid="textarea-movement-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMovementDialog(false)} data-testid="button-cancel-movement">Cancelar</Button>
            <Button onClick={saveStockMovement} data-testid="button-save-movement">Registrar Movimentação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Transferência entre Depósitos */}
      <Dialog open={showTransferDialog} onOpenChange={(open) => { setShowTransferDialog(open); if (open) loadAllProducts(); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-600" />
              Nova Transferência
            </DialogTitle>
            <DialogDescription>
              Transferir produtos de {selectedWarehouse?.name} para outro depósito
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-purple-50 rounded-lg text-sm">
              <p><strong>Origem:</strong> {selectedWarehouse?.name} ({selectedWarehouse?.code})</p>
            </div>
            
            <div className="space-y-2">
              <Label>Depósito Destino *</Label>
              <Select
                value={transferForm.destinationWarehouseId}
                onValueChange={(v) => setTransferForm((prev: any) => ({...prev, destinationWarehouseId: v}))}
                data-testid="select-destination-warehouse"
              >
                <SelectTrigger data-testid="trigger-destination"><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.id !== selectedWarehouse?.id).map((wh: any) => (
                    <SelectItem key={wh.id} value={wh.id.toString()}>{wh.name} ({wh.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Itens da Transferência */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Itens para Transferir</h4>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setTransferForm((prev: any) => ({
                    ...prev, 
                    items: [...prev.items, { productId: "", quantity: "" }]
                  }))}
                  data-testid="button-add-transfer-item"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Item
                </Button>
              </div>
              <div className="space-y-2">
                {transferForm.items.map((item: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                    <Select
                      value={item.productId?.toString() || ""}
                      onValueChange={(v) => {
                        const newItems = [...transferForm.items];
                        newItems[idx].productId = parseInt(v);
                        setTransferForm((prev: any) => ({...prev, items: newItems}));
                      }}
                      data-testid={`select-transfer-product-${idx}`}
                    >
                      <SelectTrigger data-testid={`trigger-transfer-product-${idx}`}><SelectValue placeholder="Produto" /></SelectTrigger>
                      <SelectContent>
                        {allProducts.map((prod: any) => (
                          <SelectItem key={prod.id} value={prod.id.toString()}>{prod.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input 
                      type="number"
                      placeholder="Quantidade"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...transferForm.items];
                        newItems[idx].quantity = e.target.value;
                        setTransferForm((prev: any) => ({...prev, items: newItems}));
                      }}
                      data-testid={`input-transfer-qty-${idx}`}
                    />
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => {
                        const newItems = transferForm.items.filter((_: any, i: number) => i !== idx);
                        setTransferForm((prev: any) => ({...prev, items: newItems}));
                      }}
                      data-testid={`button-remove-transfer-item-${idx}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {transferForm.items.length === 0 && (
                  <p className="text-center text-muted-foreground py-4 text-sm">Adicione itens para transferir</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={transferForm.notes}
                onChange={(e) => setTransferForm((prev: any) => ({...prev, notes: e.target.value}))}
                placeholder="Observações da transferência..."
                data-testid="textarea-transfer-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)} data-testid="button-cancel-transfer">Cancelar</Button>
            <Button onClick={saveStockTransfer} disabled={!transferForm.destinationWarehouseId || transferForm.items.length === 0} data-testid="button-save-transfer">
              Criar Transferência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Compra */}
      <Dialog open={showNovaCompraDialog} onOpenChange={setShowNovaCompraDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Nova Compra Manual
            </DialogTitle>
            <DialogDescription>
              Registre uma compra de fornecedor com entrada no estoque
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input 
                  value={compraForm.supplierName}
                  onChange={(e) => setCompraForm((prev: any) => ({...prev, supplierName: e.target.value}))}
                  placeholder="Nome ou razão social do fornecedor"
                  data-testid="input-supplier-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Depósito de Destino *</Label>
                <Select
                  value={compraForm.warehouseId}
                  onValueChange={(v) => setCompraForm((prev: any) => ({...prev, warehouseId: v}))}
                  data-testid="select-compra-warehouse"
                >
                  <SelectTrigger data-testid="trigger-compra-warehouse"><SelectValue placeholder="Selecione o depósito" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((wh: any) => (
                      <SelectItem key={wh.id} value={wh.id.toString()}>{wh.name} ({wh.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número da NF</Label>
                <Input 
                  value={compraForm.invoiceNumber}
                  onChange={(e) => setCompraForm((prev: any) => ({...prev, invoiceNumber: e.target.value}))}
                  placeholder="Ex: 123456"
                  data-testid="input-invoice-number"
                />
              </div>
              <div className="space-y-2">
                <Label>Data da NF</Label>
                <Input 
                  type="date"
                  value={compraForm.invoiceDate}
                  onChange={(e) => setCompraForm((prev: any) => ({...prev, invoiceDate: e.target.value}))}
                  data-testid="input-invoice-date"
                />
              </div>
            </div>
            
            {/* Itens da Compra */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Itens da Compra</h4>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setCompraForm((prev: any) => ({
                    ...prev, 
                    items: [...prev.items, { productId: "", quantity: "", unitCost: "", serials: [] }]
                  }))}
                  data-testid="button-add-compra-item"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Item
                </Button>
              </div>
              <div className="space-y-3">
                {compraForm.items.map((item: any, idx: number) => (
                  <div key={idx} className="border rounded p-3 space-y-2">
                    <div className="grid grid-cols-4 gap-2 items-end">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Produto</Label>
                        <Select
                          value={item.productId?.toString() || ""}
                          onValueChange={(v) => {
                            const newItems = [...compraForm.items];
                            newItems[idx].productId = v;
                            setCompraForm((prev: any) => ({...prev, items: newItems}));
                          }}
                          data-testid={`select-compra-product-${idx}`}
                        >
                          <SelectTrigger data-testid={`trigger-compra-product-${idx}`}><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {allProducts.map((prod: any) => (
                              <SelectItem key={prod.id} value={prod.id.toString()}>{prod.name} ({prod.code})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quantidade</Label>
                        <Input 
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...compraForm.items];
                            newItems[idx].quantity = e.target.value;
                            setCompraForm((prev: any) => ({...prev, items: newItems}));
                          }}
                          placeholder="0"
                          data-testid={`input-compra-qty-${idx}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Custo Unit.</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => {
                            const newItems = [...compraForm.items];
                            newItems[idx].unitCost = e.target.value;
                            setCompraForm((prev: any) => ({...prev, items: newItems}));
                          }}
                          placeholder="0.00"
                          data-testid={`input-compra-cost-${idx}`}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          const newItems = [...compraForm.items];
                          newItems[idx].serials = [...(newItems[idx].serials || []), { imei: "", serialNumber: "" }];
                          setCompraForm((prev: any) => ({...prev, items: newItems}));
                        }}
                        data-testid={`button-add-serial-${idx}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        IMEI/Série
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-red-500"
                        onClick={() => {
                          const newItems = compraForm.items.filter((_: any, i: number) => i !== idx);
                          setCompraForm((prev: any) => ({...prev, items: newItems}));
                        }}
                        data-testid={`button-remove-item-${idx}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {item.serials?.length > 0 && (
                      <div className="bg-muted/50 p-2 rounded space-y-1">
                        {item.serials.map((serial: any, sidx: number) => (
                          <div key={sidx} className="grid grid-cols-3 gap-2">
                            <Input 
                              placeholder="IMEI"
                              value={serial.imei}
                              onChange={(e) => {
                                const newItems = [...compraForm.items];
                                newItems[idx].serials[sidx].imei = e.target.value;
                                setCompraForm((prev: any) => ({...prev, items: newItems}));
                              }}
                              className="h-8 text-sm"
                              data-testid={`input-serial-imei-${idx}-${sidx}`}
                            />
                            <Input 
                              placeholder="Nº Série"
                              value={serial.serialNumber}
                              onChange={(e) => {
                                const newItems = [...compraForm.items];
                                newItems[idx].serials[sidx].serialNumber = e.target.value;
                                setCompraForm((prev: any) => ({...prev, items: newItems}));
                              }}
                              className="h-8 text-sm"
                              data-testid={`input-serial-num-${idx}-${sidx}`}
                            />
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                const newItems = [...compraForm.items];
                                newItems[idx].serials = newItems[idx].serials.filter((_: any, si: number) => si !== sidx);
                                setCompraForm((prev: any) => ({...prev, items: newItems}));
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {compraForm.items.length === 0 && (
                  <p className="text-center text-muted-foreground py-4 text-sm">Adicione itens para a compra</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={compraForm.notes}
                onChange={(e) => setCompraForm((prev: any) => ({...prev, notes: e.target.value}))}
                placeholder="Observações da compra..."
                data-testid="textarea-compra-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovaCompraDialog(false)} data-testid="button-cancel-compra">Cancelar</Button>
            <Button onClick={savePurchaseOrder} disabled={!compraForm.warehouseId || compraForm.items.length === 0} data-testid="button-save-compra">
              <CheckCircle className="h-4 w-4 mr-1" />
              Registrar Compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Importar NF-e */}
      <Dialog open={showImportarNFDialog} onOpenChange={setShowImportarNFDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Importar NF-e de Compra
            </DialogTitle>
            <DialogDescription>
              Carregue o XML da Nota Fiscal Eletrônica para importar os dados
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium mb-2">Arraste o arquivo XML ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground mb-4">Formatos aceitos: XML de NF-e</p>
              <Input 
                type="file" 
                accept=".xml"
                className="max-w-xs mx-auto"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    toast({ title: "Arquivo selecionado", description: file.name });
                  }
                }}
                data-testid="input-nfe-file"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Depósito de Destino *</Label>
              <Select data-testid="select-import-warehouse">
                <SelectTrigger data-testid="trigger-import-warehouse"><SelectValue placeholder="Selecione o depósito" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh: any) => (
                    <SelectItem key={wh.id} value={wh.id.toString()}>{wh.name} ({wh.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium mb-1">O que será importado:</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• Dados do fornecedor (CNPJ, razão social)</li>
                <li>• Produtos com NCM, quantidades e valores</li>
                <li>• Impostos (ICMS, PIS, COFINS, IPI)</li>
                <li>• Número e data da NF-e</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportarNFDialog(false)} data-testid="button-cancel-import">Cancelar</Button>
            <Button disabled data-testid="button-process-nfe">
              <Upload className="h-4 w-4 mr-1" />
              Processar NF-e
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Lançar em Estoque */}
      <Dialog open={showLancarEstoqueDialog} onOpenChange={setShowLancarEstoqueDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              Lançar em Estoque
            </DialogTitle>
            <DialogDescription>
              Selecione o depósito e vincule a um produto se necessário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {lancarEstoqueData.order && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <p><strong>Dispositivo:</strong> {lancarEstoqueData.order.brand} {lancarEstoqueData.order.model}</p>
                <p><strong>IMEI:</strong> {lancarEstoqueData.order.imei}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Depósito *</Label>
              <Select
                value={lancarEstoqueData.warehouseId}
                onValueChange={(v) => setLancarEstoqueData((prev: any) => ({...prev, warehouseId: v}))}
                data-testid="select-lancar-warehouse"
              >
                <SelectTrigger data-testid="trigger-lancar-warehouse">
                  <SelectValue placeholder="Selecione o depósito" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh: any) => (
                    <SelectItem key={wh.id} value={wh.id.toString()}>
                      {wh.name} ({wh.code}) {wh.isDefault ? "⭐" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="hasProduct"
                checked={lancarEstoqueData.hasProduct}
                onCheckedChange={(checked) => setLancarEstoqueData((prev: any) => ({...prev, hasProduct: !!checked}))}
                data-testid="checkbox-has-product"
              />
              <Label htmlFor="hasProduct">Vincular a um produto cadastrado</Label>
            </div>
            
            {lancarEstoqueData.hasProduct && (
              <div className="space-y-2">
                <Label>Produto Relacionado</Label>
                <Select
                  value={lancarEstoqueData.productId}
                  onValueChange={(v) => setLancarEstoqueData((prev: any) => ({...prev, productId: v}))}
                  data-testid="select-lancar-product"
                >
                  <SelectTrigger data-testid="trigger-lancar-product">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProducts.map((prod: any) => (
                      <SelectItem key={prod.id} value={prod.id.toString()}>
                        {prod.name} ({prod.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Vincular permite rastrear este dispositivo como unidade de um produto cadastrado
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLancarEstoqueDialog(false)} data-testid="button-cancel-lancar">
              Cancelar
            </Button>
            <Button onClick={confirmLancarEstoque} disabled={!lancarEstoqueData.warehouseId} data-testid="button-confirm-lancar">
              <CheckCircle className="h-4 w-4 mr-1" />
              Confirmar Lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tipo de Produto */}
      <Dialog open={showProductTypeDialog} onOpenChange={setShowProductTypeDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {productTypeCategory === "device" ? (
                <><Smartphone className="h-5 w-5 text-blue-600" /> {editingProductType?.id ? "Editar" : "Novo"} Tipo de Dispositivo</>
              ) : (
                <><Headphones className="h-5 w-5 text-purple-600" /> {editingProductType?.id ? "Editar" : "Novo"} Tipo de Acessório</>
              )}
            </DialogTitle>
            <DialogDescription>
              {productTypeCategory === "device" 
                ? "Defina as características e atributos fiscais para este tipo de dispositivo" 
                : "Defina as características e atributos fiscais para este tipo de acessório"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Informações Básicas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Tipo *</Label>
                <Input 
                  value={editingProductType?.name || ""}
                  onChange={(e) => setEditingProductType((prev: any) => ({...prev, name: e.target.value}))}
                  placeholder={productTypeCategory === "device" ? "Ex: Smartphone" : "Ex: Capa de Celular"}
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade de Medida</Label>
                <Select 
                  value={editingProductType?.unidadeMedida || "UN"}
                  onValueChange={(v) => setEditingProductType((prev: any) => ({...prev, unidadeMedida: v}))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">UN - Unidade</SelectItem>
                    <SelectItem value="PC">PC - Peça</SelectItem>
                    <SelectItem value="CX">CX - Caixa</SelectItem>
                    <SelectItem value="KIT">KIT - Kit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea 
                value={editingProductType?.description || ""}
                onChange={(e) => setEditingProductType((prev: any) => ({...prev, description: e.target.value}))}
                placeholder="Descrição do tipo de produto..."
              />
            </div>

            {/* Controle de Série/IMEI */}
            {productTypeCategory === "device" && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-medium mb-3">Controle de Identificação</h4>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={editingProductType?.requiresImei || false}
                      onCheckedChange={(v) => setEditingProductType((prev: any) => ({...prev, requiresImei: v}))}
                    />
                    <Label>Requer IMEI</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={editingProductType?.requiresSerial || false}
                      onCheckedChange={(v) => setEditingProductType((prev: any) => ({...prev, requiresSerial: v}))}
                    />
                    <Label>Requer Número de Série</Label>
                  </div>
                </div>
              </div>
            )}

            {/* Atributos Fiscais */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Atributos Fiscais Padrão
              </h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>NCM</Label>
                  <Input 
                    value={editingProductType?.ncm || ""}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, ncm: e.target.value}))}
                    placeholder="8517.12.31"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CEST</Label>
                  <Input 
                    value={editingProductType?.cest || ""}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, cest: e.target.value}))}
                    placeholder="21.053.00"
                    maxLength={9}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select 
                    value={editingProductType?.origem?.toString() || "0"}
                    onValueChange={(v) => setEditingProductType((prev: any) => ({...prev, origem: parseInt(v)}))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - Nacional</SelectItem>
                      <SelectItem value="1">1 - Estrangeira (importação direta)</SelectItem>
                      <SelectItem value="2">2 - Estrangeira (adquirida no mercado interno)</SelectItem>
                      <SelectItem value="3">3 - Nacional (conteúdo importação superior 40%)</SelectItem>
                      <SelectItem value="5">5 - Nacional (conteúdo importação inferior 40%)</SelectItem>
                      <SelectItem value="6">6 - Estrangeira (importação direta, sem similar)</SelectItem>
                      <SelectItem value="7">7 - Estrangeira (adquirida, sem similar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>CST ICMS (Regime Normal)</Label>
                  <Select 
                    value={editingProductType?.cstIcms || ""}
                    onValueChange={(v) => setEditingProductType((prev: any) => ({...prev, cstIcms: v}))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="00">00 - Tributada integralmente</SelectItem>
                      <SelectItem value="10">10 - Tributada com ST</SelectItem>
                      <SelectItem value="20">20 - Com redução de BC</SelectItem>
                      <SelectItem value="30">30 - Isenta/não tributada com ST</SelectItem>
                      <SelectItem value="40">40 - Isenta</SelectItem>
                      <SelectItem value="41">41 - Não tributada</SelectItem>
                      <SelectItem value="50">50 - Suspensão</SelectItem>
                      <SelectItem value="51">51 - Diferimento</SelectItem>
                      <SelectItem value="60">60 - ICMS cobrado anteriormente por ST</SelectItem>
                      <SelectItem value="70">70 - Com redução de BC e ST</SelectItem>
                      <SelectItem value="90">90 - Outras</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CSOSN (Simples Nacional)</Label>
                  <Select 
                    value={editingProductType?.csosn || ""}
                    onValueChange={(v) => setEditingProductType((prev: any) => ({...prev, csosn: v}))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="101">101 - Tributada com permissão de crédito</SelectItem>
                      <SelectItem value="102">102 - Tributada sem permissão de crédito</SelectItem>
                      <SelectItem value="103">103 - Isenção do ICMS para faixa de receita bruta</SelectItem>
                      <SelectItem value="201">201 - Tributada com ST e permissão de crédito</SelectItem>
                      <SelectItem value="202">202 - Tributada com ST sem permissão de crédito</SelectItem>
                      <SelectItem value="203">203 - Isenção do ICMS para faixa de receita com ST</SelectItem>
                      <SelectItem value="300">300 - Imune</SelectItem>
                      <SelectItem value="400">400 - Não tributada</SelectItem>
                      <SelectItem value="500">500 - ICMS cobrado anteriormente por ST</SelectItem>
                      <SelectItem value="900">900 - Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* CFOPs */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">CFOPs Padrão</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CFOP Venda Estadual</Label>
                  <Input 
                    value={editingProductType?.cfopVendaEstadual || "5102"}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, cfopVendaEstadual: e.target.value}))}
                    placeholder="5102"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CFOP Venda Interestadual</Label>
                  <Input 
                    value={editingProductType?.cfopVendaInterestadual || "6102"}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, cfopVendaInterestadual: e.target.value}))}
                    placeholder="6102"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CFOP Devolução Estadual</Label>
                  <Input 
                    value={editingProductType?.cfopDevolucaoEstadual || "1202"}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, cfopDevolucaoEstadual: e.target.value}))}
                    placeholder="1202"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CFOP Devolução Interestadual</Label>
                  <Input 
                    value={editingProductType?.cfopDevolucaoInterestadual || "2202"}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, cfopDevolucaoInterestadual: e.target.value}))}
                    placeholder="2202"
                    maxLength={4}
                  />
                </div>
              </div>
            </div>

            {/* Alíquotas */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">Alíquotas Padrão (%)</h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>ICMS</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={editingProductType?.aliqIcms || ""}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, aliqIcms: e.target.value}))}
                    placeholder="18.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PIS</Label>
                  <Input 
                    type="number"
                    step="0.0001"
                    value={editingProductType?.aliqPis || "0.65"}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, aliqPis: e.target.value}))}
                    placeholder="0.65"
                  />
                </div>
                <div className="space-y-2">
                  <Label>COFINS</Label>
                  <Input 
                    type="number"
                    step="0.0001"
                    value={editingProductType?.aliqCofins || "3.00"}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, aliqCofins: e.target.value}))}
                    placeholder="3.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IPI</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={editingProductType?.aliqIpi || "0"}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, aliqIpi: e.target.value}))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Reforma Tributária - IBS e CBS */}
            <div className="border rounded-lg p-4 bg-amber-50">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Reforma Tributária (IBS/CBS)
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Novos tributos que substituirão gradualmente ICMS, PIS e COFINS a partir de 2026.
              </p>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Class. Trib. IBS</Label>
                  <Input 
                    value={editingProductType?.classTribIbs || ""}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, classTribIbs: e.target.value}))}
                    placeholder="Código"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Alíquota IBS (%)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={editingProductType?.aliqIbs || ""}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, aliqIbs: e.target.value}))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Class. Trib. CBS</Label>
                  <Input 
                    value={editingProductType?.classTribCbs || ""}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, classTribCbs: e.target.value}))}
                    placeholder="Código"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Alíquota CBS (%)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={editingProductType?.aliqCbs || ""}
                    onChange={(e) => setEditingProductType((prev: any) => ({...prev, aliqCbs: e.target.value}))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch 
                checked={editingProductType?.isActive ?? true}
                onCheckedChange={(v) => setEditingProductType((prev: any) => ({...prev, isActive: v}))}
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingProductType(null); setShowProductTypeDialog(false); }}>Cancelar</Button>
            <Button onClick={saveProductType}>Salvar Tipo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Créditos do Cliente */}
      <Dialog open={showCreditsDialog} onOpenChange={setShowCreditsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-600" />
              Créditos de {viewingCredits?.person?.fullName}
            </DialogTitle>
            <DialogDescription>
              Saldo disponível para uso em compras
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-sm text-green-600">Saldo Disponível</div>
              <div className="text-3xl font-bold text-green-700">
                R$ {viewingCredits?.totalAvailable?.toFixed(2) || "0.00"}
              </div>
            </div>
            
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingCredits?.credits?.length ? viewingCredits.credits.map((credit: any) => (
                    <TableRow key={credit.id}>
                      <td className="p-3">
                        <Badge variant="outline">
                          {credit.origin === "refund" ? "Devolução" :
                           credit.origin === "trade_in" ? "Trade-In" :
                           credit.origin === "bonus" ? "Bonificação" : "Promoção"}
                        </Badge>
                        <div className="text-xs text-muted-foreground">{credit.description}</div>
                      </td>
                      <td className="p-3 text-sm">
                        {new Date(credit.createdAt).toLocaleDateString('pt-BR')}
                        {credit.expiresAt && (
                          <div className="text-xs text-orange-600">
                            Expira: {new Date(credit.expiresAt).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium">R$ {parseFloat(credit.amount).toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-green-600">R$ {parseFloat(credit.remainingAmount).toFixed(2)}</td>
                      <td className="p-3">
                        <Badge variant={credit.status === "active" ? "default" : credit.status === "used" ? "secondary" : "destructive"}>
                          {credit.status === "active" ? "Ativo" : credit.status === "used" ? "Utilizado" : "Expirado"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" onClick={() => printCreditReceipt(credit.id)} title="Imprimir Comprovante" data-testid={`btn-print-credit-${credit.id}`}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </td>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Nenhum crédito encontrado para este cliente
                      </td>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreditsDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCashMovementDialog} onOpenChange={setShowCashMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="cash-movement-title">
              {cashMovementType === "withdrawal" ? "Sangria" : "Reforço de Caixa"}
            </DialogTitle>
            <DialogDescription>
              {cashMovementType === "withdrawal" ? "Registrar retirada de dinheiro do caixa" : "Registrar entrada de dinheiro no caixa"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={cashMovementAmount}
                onChange={(e) => setCashMovementAmount(e.target.value)}
                data-testid="input-cash-movement-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                placeholder="Descreva o motivo da movimentação..."
                value={cashMovementReason}
                onChange={(e) => setCashMovementReason(e.target.value)}
                data-testid="input-cash-movement-reason"
              />
            </div>
            {cashMovements.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Movimentações Recentes</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {cashMovements.slice(0, 5).map((m: any) => (
                    <div key={m.id} className="flex justify-between text-xs p-2 bg-muted/30 rounded" data-testid={`cash-movement-${m.id}`}>
                      <span>{m.type === "withdrawal" ? "Sangria" : "Reforço"} - {m.reason || "Sem motivo"}</span>
                      <span className={m.type === "withdrawal" ? "text-red-600" : "text-green-600"}>
                        {m.type === "withdrawal" ? "-" : "+"}{formatCurrency(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCashMovementDialog(false)} data-testid="btn-cancel-cash-movement">Cancelar</Button>
            <Button onClick={handleCreateCashMovement} data-testid="btn-confirm-cash-movement">
              {cashMovementType === "withdrawal" ? "Registrar Sangria" : "Registrar Reforço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
      </div>
    </BrowserFrame>
  );
}
