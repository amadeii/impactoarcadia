import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { 
  Loader2, ArrowLeft, Building2, RefreshCw, 
  LayoutDashboard, ShoppingCart, Package, DollarSign, 
  FileText, Users, ClipboardList, Settings, Receipt,
  Truck, CreditCard, BarChart3, ShoppingBag, Utensils,
  ChevronLeft, ChevronRight, Shield, Database, Wrench,
  Bell, Tag, Video, FileCheck, Upload, Lock, Send, Store
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ModuleItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  route: string;
  color?: string;
  adminOnly?: boolean;
}

const modules: ModuleItem[] = [
  { id: "dashboard", name: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, route: "/home", color: "text-blue-500" },
  { id: "pdv", name: "PDV", icon: <ShoppingCart className="w-4 h-4" />, route: "/frontbox", color: "text-green-500" },
  { id: "vendas", name: "Vendas", icon: <ShoppingBag className="w-4 h-4" />, route: "/vendas", color: "text-emerald-500" },
  { id: "produtos", name: "Produtos", icon: <Package className="w-4 h-4" />, route: "/produtos", color: "text-amber-500" },
  { id: "estoque", name: "Estoque", icon: <Package className="w-4 h-4" />, route: "/estoque", color: "text-orange-500" },
  { id: "clientes", name: "Clientes", icon: <Users className="w-4 h-4" />, route: "/clientes", color: "text-purple-500" },
  { id: "fornecedores", name: "Fornecedores", icon: <Truck className="w-4 h-4" />, route: "/fornecedores", color: "text-indigo-500" },
  { id: "contas-receber", name: "Contas a Receber", icon: <DollarSign className="w-4 h-4" />, route: "/conta-receber", color: "text-green-600" },
  { id: "contas-pagar", name: "Contas a Pagar", icon: <CreditCard className="w-4 h-4" />, route: "/conta-pagar", color: "text-red-500" },
  { id: "nfe", name: "NF-e", icon: <FileText className="w-4 h-4" />, route: "/nfe", color: "text-cyan-500" },
  { id: "nfce", name: "NFC-e", icon: <Receipt className="w-4 h-4" />, route: "/nfce", color: "text-teal-500" },
  { id: "pedidos", name: "Pedidos", icon: <ClipboardList className="w-4 h-4" />, route: "/pedidos-delivery", color: "text-pink-500" },
  { id: "cardapio", name: "Cardápio Digital", icon: <Utensils className="w-4 h-4" />, route: "/cardapio", color: "text-yellow-500" },
  { id: "relatorios", name: "Relatórios", icon: <BarChart3 className="w-4 h-4" />, route: "/relatorios", color: "text-blue-400" },
];

const adminModules: ModuleItem[] = [
  { id: "ibpt", name: "IBPT", icon: <Database className="w-4 h-4" />, route: "/ibpt", color: "text-blue-600", adminOnly: true },
  { id: "ticket", name: "Ticket", icon: <Receipt className="w-4 h-4" />, route: "/ticket-super", color: "text-green-600", adminOnly: true },
  { id: "config", name: "Configuração", icon: <Settings className="w-4 h-4" />, route: "/configuracao-super", color: "text-slate-500", adminOnly: true },
  { id: "notificacoes", name: "Notificações", icon: <Bell className="w-4 h-4" />, route: "/notificacao-super", color: "text-amber-500", adminOnly: true },
  { id: "etiquetas", name: "Padrões de Etiqueta", icon: <Tag className="w-4 h-4" />, route: "/padroes-etiqueta", color: "text-purple-500", adminOnly: true },
  { id: "videos", name: "Vídeos de Suporte", icon: <Video className="w-4 h-4" />, route: "/video-suporte", color: "text-red-500", adminOnly: true },
  { id: "relatorios-adm", name: "Relatórios", icon: <BarChart3 className="w-4 h-4" />, route: "/relatorios-adm", color: "text-indigo-500", adminOnly: true },
  { id: "contrato-config", name: "Config. Contrato", icon: <FileCheck className="w-4 h-4" />, route: "/contrato-config", color: "text-teal-500", adminOnly: true },
  { id: "contratos", name: "Lista de Contratos", icon: <FileText className="w-4 h-4" />, route: "/contrato-config-list", color: "text-cyan-500", adminOnly: true },
  { id: "controle-acesso", name: "Controle de Acesso", icon: <Lock className="w-4 h-4" />, route: "/controle-acesso", color: "text-rose-500", adminOnly: true },
  { id: "empresas", name: "Empresas", icon: <Building2 className="w-4 h-4" />, route: "/empresas", color: "text-violet-500", adminOnly: true },
  { id: "usuarios", name: "Usuários", icon: <Shield className="w-4 h-4" />, route: "/usuarios", color: "text-pink-500", adminOnly: true },
  { id: "emissoes", name: "Emissões", icon: <Send className="w-4 h-4" />, route: "/nfe", color: "text-orange-500", adminOnly: true },
  { id: "marketplace", name: "Delivery/Marketplace", icon: <Store className="w-4 h-4" />, route: "/config-marketplace", color: "text-emerald-500", adminOnly: true },
];

export default function Plus() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [currentRoute, setCurrentRoute] = useState("/home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeModule, setActiveModule] = useState("dashboard");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isAdmin = user?.role === 'admin' || (user as any)?.tenantType === 'master';
  
  const visibleModules = isAdmin ? [...modules, ...adminModules] : modules;

  const iframeSrc = `/plus/auto-login?redirect=${encodeURIComponent(currentRoute)}&embedded=1`;

  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleRefresh = () => {
    setLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const navigateToModule = (module: ModuleItem) => {
    setActiveModule(module.id);
    setCurrentRoute(module.route);
    setLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = `/plus/auto-login?redirect=${encodeURIComponent(module.route)}&embedded=1`;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100" data-testid="plus-container">
      {/* Header - Tema Claro */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/")}
            className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            data-testid="button-back-suite"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar ao Suite
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Building2 className="w-3 h-3 text-white" />
            </div>
            <span className="font-medium text-sm text-slate-900">Arcádia Plus</span>
            <span className="text-xs text-slate-500">ERP Completo</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Tema Claro */}
        <div className={cn(
          "flex flex-col bg-white border-r border-slate-200 transition-all duration-300",
          sidebarCollapsed ? "w-14" : "w-52"
        )}>
          <div className="flex items-center justify-end p-2 border-b border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 h-7 w-7 p-0"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {modules.map((module) => (
                <Button
                  key={module.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateToModule(module)}
                  className={cn(
                    "w-full justify-start gap-3 text-left transition-colors",
                    sidebarCollapsed ? "px-2" : "px-3",
                    activeModule === module.id 
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                  data-testid={`button-module-${module.id}`}
                  title={sidebarCollapsed ? module.name : undefined}
                >
                  <span className={activeModule === module.id ? "text-blue-600" : module.color}>{module.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{module.name}</span>}
                </Button>
              ))}
              
              {isAdmin && (
                <>
                  <div className="my-3 mx-2 border-t border-slate-200" />
                  {!sidebarCollapsed && (
                    <div className="px-3 py-1">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Retaguarda
                      </span>
                    </div>
                  )}
                  {adminModules.map((module) => (
                    <Button
                      key={module.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateToModule(module)}
                      className={cn(
                        "w-full justify-start gap-3 text-left transition-colors",
                        sidebarCollapsed ? "px-2" : "px-3",
                        activeModule === module.id 
                          ? "bg-violet-50 text-violet-600 hover:bg-violet-100" 
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      )}
                      data-testid={`button-module-${module.id}`}
                      title={sidebarCollapsed ? module.name : undefined}
                    >
                      <span className={activeModule === module.id ? "text-violet-600" : module.color}>{module.icon}</span>
                      {!sidebarCollapsed && <span className="truncate">{module.name}</span>}
                    </Button>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Iframe Container */}
        <div className="flex-1 relative bg-slate-100">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <div className="flex items-center justify-center gap-2 text-slate-700 mb-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando {modules.find(m => m.id === activeModule)?.name || 'módulo'}...</span>
                </div>
                <p className="text-sm text-slate-500">Arcádia Plus ERP</p>
              </div>
            </div>
          )}
          
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            title="Arcádia Plus"
            data-testid="iframe-plus"
          />
        </div>
      </div>
    </div>
  );
}
