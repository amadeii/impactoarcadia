import { useState, useMemo } from "react";
import { 
  Search, 
  Filter, 
  Plus, 
  Settings, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Building2,
  Landmark,
  ShoppingCart,
  Truck,
  FileText,
  CreditCard,
  Globe,
  Zap,
  Database,
  Lock,
  Eye,
  Play,
  Copy,
  ExternalLink,
  X,
  Code,
  BookOpen,
  Activity,
  TrendingUp,
  Shield,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

type ApiCategory = {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  color: string;
};

type ApiIntegration = {
  id: string;
  name: string;
  provider: string;
  categoryId: string;
  description: string;
  status: "active" | "configured" | "available" | "coming_soon";
  version: string;
  documentationUrl: string;
  endpoints: ApiEndpoint[];
  tags: string[];
  usageToday: number;
  usageLimit: number;
  latencyMs: number;
  uptime: number;
};

type ApiEndpoint = {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  parameters?: { name: string; type: string; required: boolean; description: string }[];
  responseExample?: string;
};

const categories: ApiCategory[] = [
  { id: "fiscal", name: "Fiscal & Tributário", icon: FileText, description: "NFe, NFSe, SEFAZ, SPED", color: "bg-blue-500" },
  { id: "banking", name: "Bancos & Pagamentos", icon: Landmark, description: "Open Banking, PIX, Boletos", color: "bg-green-500" },
  { id: "ecommerce", name: "Marketplaces", icon: ShoppingCart, description: "Mercado Livre, Amazon, Shopee", color: "bg-orange-500" },
  { id: "logistics", name: "Logística", icon: Truck, description: "Correios, transportadoras", color: "bg-purple-500" },
  { id: "crm", name: "CRM & Vendas", icon: Building2, description: "HubSpot, Pipedrive, RD Station", color: "bg-pink-500" },
  { id: "communication", name: "Comunicação", icon: Globe, description: "WhatsApp, Email, SMS", color: "bg-cyan-500" },
  { id: "data", name: "Dados & Análise", icon: Database, description: "BI, ETL, Data Lakes", color: "bg-yellow-500" },
  { id: "security", name: "Segurança", icon: Lock, description: "Auth, Certificados, Compliance", color: "bg-red-500" },
];

const integrations: ApiIntegration[] = [
  {
    id: "sefaz-nfe",
    name: "SEFAZ NFe",
    provider: "Secretaria da Fazenda",
    categoryId: "fiscal",
    description: "Emissão e consulta de Notas Fiscais Eletrônicas em todos os estados brasileiros",
    status: "available",
    version: "4.00",
    documentationUrl: "https://www.nfe.fazenda.gov.br/portal/principal.aspx",
    tags: ["NFe", "Fiscal", "Governo"],
    usageToday: 1247,
    usageLimit: 5000,
    latencyMs: 450,
    uptime: 99.8,
    endpoints: [
      { method: "POST", path: "/nfe/autorizacao", description: "Autorizar NFe na SEFAZ", parameters: [
        { name: "xml", type: "string", required: true, description: "XML da NFe assinado" },
        { name: "uf", type: "string", required: true, description: "UF de destino (SP, RJ, etc)" }
      ]},
      { method: "GET", path: "/nfe/consulta/{chave}", description: "Consultar NFe pela chave de acesso" },
      { method: "POST", path: "/nfe/cancelamento", description: "Cancelar NFe autorizada" },
      { method: "POST", path: "/nfe/inutilizacao", description: "Inutilizar numeração de NFe" },
    ]
  },
  {
    id: "sefaz-nfse",
    name: "SEFAZ NFSe",
    provider: "Prefeituras",
    categoryId: "fiscal",
    description: "Emissão de Notas Fiscais de Serviço para mais de 5.000 municípios",
    status: "available",
    version: "2.04",
    documentationUrl: "#",
    tags: ["NFSe", "Serviços", "Municipal"],
    usageToday: 523,
    usageLimit: 3000,
    latencyMs: 680,
    uptime: 98.5,
    endpoints: [
      { method: "POST", path: "/nfse/emitir", description: "Emitir NFSe" },
      { method: "GET", path: "/nfse/consulta/{numero}", description: "Consultar NFSe" },
      { method: "POST", path: "/nfse/cancelar", description: "Cancelar NFSe" },
    ]
  },
  {
    id: "sped-fiscal",
    name: "SPED Fiscal",
    provider: "Receita Federal",
    categoryId: "fiscal",
    description: "Geração e transmissão de arquivos SPED EFD ICMS/IPI",
    status: "coming_soon",
    version: "3.0",
    documentationUrl: "#",
    tags: ["SPED", "EFD", "ICMS"],
    usageToday: 0,
    usageLimit: 1000,
    latencyMs: 0,
    uptime: 0,
    endpoints: []
  },
  {
    id: "bb-openbanking",
    name: "Banco do Brasil",
    provider: "BB",
    categoryId: "banking",
    description: "Open Banking, consulta de saldos, extratos e iniciação de pagamentos",
    status: "available",
    version: "2.0",
    documentationUrl: "https://developers.bb.com.br",
    tags: ["Open Banking", "PIX", "Boleto"],
    usageToday: 892,
    usageLimit: 10000,
    latencyMs: 120,
    uptime: 99.99,
    endpoints: [
      { method: "GET", path: "/accounts/{id}/balance", description: "Consultar saldo da conta" },
      { method: "GET", path: "/accounts/{id}/transactions", description: "Listar extrato" },
      { method: "POST", path: "/pix/payments", description: "Iniciar pagamento PIX" },
      { method: "POST", path: "/boletos", description: "Gerar boleto bancário" },
    ]
  },
  {
    id: "itau-openbanking",
    name: "Itaú Unibanco",
    provider: "Itaú",
    categoryId: "banking",
    description: "APIs de Open Finance, cash management e cobrança",
    status: "available",
    version: "3.0",
    documentationUrl: "https://developer.itau.com.br",
    tags: ["Open Banking", "PIX", "Cash Management"],
    usageToday: 1456,
    usageLimit: 15000,
    latencyMs: 95,
    uptime: 99.95,
    endpoints: [
      { method: "GET", path: "/contas/{id}/saldo", description: "Consultar saldo" },
      { method: "POST", path: "/pix/cobranca", description: "Criar cobrança PIX" },
      { method: "GET", path: "/pix/cobranca/{txid}", description: "Consultar cobrança" },
    ]
  },
  {
    id: "pix-bacen",
    name: "PIX (BACEN)",
    provider: "Banco Central",
    categoryId: "banking",
    description: "API PIX do Banco Central para transações instantâneas",
    status: "available",
    version: "2.1",
    documentationUrl: "https://www.bcb.gov.br/estabilidadefinanceira/pix",
    tags: ["PIX", "Pagamentos", "Instantâneo"],
    usageToday: 3421,
    usageLimit: 50000,
    latencyMs: 45,
    uptime: 99.99,
    endpoints: [
      { method: "POST", path: "/cob", description: "Criar cobrança imediata" },
      { method: "GET", path: "/cob/{txid}", description: "Consultar cobrança" },
      { method: "POST", path: "/pix", description: "Solicitar devolução" },
    ]
  },
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    provider: "Mercado Libre",
    categoryId: "ecommerce",
    description: "Gestão de produtos, pedidos e envios no Mercado Livre",
    status: "available",
    version: "3.0",
    documentationUrl: "https://developers.mercadolivre.com.br",
    tags: ["Marketplace", "E-commerce", "Vendas"],
    usageToday: 2156,
    usageLimit: 20000,
    latencyMs: 180,
    uptime: 99.7,
    endpoints: [
      { method: "GET", path: "/items/{id}", description: "Consultar produto" },
      { method: "POST", path: "/items", description: "Criar anúncio" },
      { method: "GET", path: "/orders/{id}", description: "Consultar pedido" },
      { method: "POST", path: "/shipments", description: "Criar envio" },
    ]
  },
  {
    id: "amazon-sp",
    name: "Amazon SP-API",
    provider: "Amazon",
    categoryId: "ecommerce",
    description: "Selling Partner API para vendedores na Amazon Brasil",
    status: "available",
    version: "2023-11",
    documentationUrl: "https://developer-docs.amazon.com/sp-api",
    tags: ["Marketplace", "Internacional", "FBA"],
    usageToday: 876,
    usageLimit: 10000,
    latencyMs: 250,
    uptime: 99.9,
    endpoints: [
      { method: "GET", path: "/catalog/items/{asin}", description: "Consultar item no catálogo" },
      { method: "GET", path: "/orders", description: "Listar pedidos" },
      { method: "POST", path: "/feeds", description: "Enviar feed de produtos" },
    ]
  },
  {
    id: "shopee",
    name: "Shopee",
    provider: "Sea Limited",
    categoryId: "ecommerce",
    description: "APIs para gestão de loja, produtos e pedidos na Shopee",
    status: "configured",
    version: "2.0",
    documentationUrl: "https://open.shopee.com",
    tags: ["Marketplace", "E-commerce", "Asia"],
    usageToday: 432,
    usageLimit: 8000,
    latencyMs: 320,
    uptime: 99.5,
    endpoints: [
      { method: "GET", path: "/product/get_item_list", description: "Listar produtos" },
      { method: "GET", path: "/order/get_order_list", description: "Listar pedidos" },
    ]
  },
  {
    id: "correios",
    name: "Correios",
    provider: "ECT",
    categoryId: "logistics",
    description: "Rastreamento, cálculo de frete e geração de etiquetas",
    status: "available",
    version: "2.0",
    documentationUrl: "https://www.correios.com.br/atendimento/ferramentas/sistemas/arquivos/manual-de-implementacao-do-calculo-remoto-de-precos-e-prazos",
    tags: ["Frete", "Rastreamento", "Etiquetas"],
    usageToday: 4532,
    usageLimit: 50000,
    latencyMs: 380,
    uptime: 97.5,
    endpoints: [
      { method: "GET", path: "/preco/nacional", description: "Calcular frete nacional" },
      { method: "GET", path: "/rastro/{codigo}", description: "Rastrear objeto" },
      { method: "POST", path: "/pre-postagem", description: "Gerar pré-postagem" },
    ]
  },
  {
    id: "jadlog",
    name: "Jadlog",
    provider: "Jadlog",
    categoryId: "logistics",
    description: "Coleta, rastreamento e gestão de entregas Jadlog",
    status: "available",
    version: "1.5",
    documentationUrl: "#",
    tags: ["Transportadora", "B2B", "Express"],
    usageToday: 789,
    usageLimit: 10000,
    latencyMs: 220,
    uptime: 99.2,
    endpoints: [
      { method: "POST", path: "/coleta", description: "Agendar coleta" },
      { method: "GET", path: "/tracking/{cte}", description: "Rastrear" },
    ]
  },
  {
    id: "hubspot",
    name: "HubSpot",
    provider: "HubSpot Inc",
    categoryId: "crm",
    description: "CRM completo com marketing, vendas e atendimento",
    status: "available",
    version: "v3",
    documentationUrl: "https://developers.hubspot.com",
    tags: ["CRM", "Marketing", "Inbound"],
    usageToday: 1234,
    usageLimit: 15000,
    latencyMs: 150,
    uptime: 99.95,
    endpoints: [
      { method: "GET", path: "/crm/v3/objects/contacts", description: "Listar contatos" },
      { method: "POST", path: "/crm/v3/objects/deals", description: "Criar negócio" },
      { method: "GET", path: "/crm/v3/objects/companies", description: "Listar empresas" },
    ]
  },
  {
    id: "rdstation",
    name: "RD Station",
    provider: "Resultados Digitais",
    categoryId: "crm",
    description: "Automação de marketing e gestão de leads",
    status: "configured",
    version: "2.0",
    documentationUrl: "https://developers.rdstation.com",
    tags: ["Marketing", "Leads", "Automação"],
    usageToday: 567,
    usageLimit: 8000,
    latencyMs: 180,
    uptime: 99.8,
    endpoints: [
      { method: "POST", path: "/conversions", description: "Registrar conversão" },
      { method: "GET", path: "/contacts/{uuid}", description: "Consultar contato" },
    ]
  },
  {
    id: "whatsapp-business",
    name: "WhatsApp Business API",
    provider: "Meta",
    categoryId: "communication",
    description: "Mensagens automatizadas e atendimento via WhatsApp",
    status: "active",
    version: "18.0",
    documentationUrl: "https://developers.facebook.com/docs/whatsapp",
    tags: ["Mensagens", "Atendimento", "Chatbot"],
    usageToday: 8765,
    usageLimit: 100000,
    latencyMs: 85,
    uptime: 99.99,
    endpoints: [
      { method: "POST", path: "/messages", description: "Enviar mensagem" },
      { method: "POST", path: "/messages/template", description: "Enviar template" },
      { method: "GET", path: "/media/{id}", description: "Baixar mídia" },
    ]
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    provider: "Twilio",
    categoryId: "communication",
    description: "Envio de emails transacionais e marketing",
    status: "available",
    version: "3.0",
    documentationUrl: "https://docs.sendgrid.com",
    tags: ["Email", "Transacional", "Marketing"],
    usageToday: 2345,
    usageLimit: 50000,
    latencyMs: 120,
    uptime: 99.95,
    endpoints: [
      { method: "POST", path: "/mail/send", description: "Enviar email" },
      { method: "GET", path: "/templates", description: "Listar templates" },
    ]
  },
  {
    id: "zenvia-sms",
    name: "Zenvia SMS",
    provider: "Zenvia",
    categoryId: "communication",
    description: "Envio de SMS em massa e campanhas",
    status: "available",
    version: "2.0",
    documentationUrl: "https://zenvia.github.io/zenvia-openapi-spec",
    tags: ["SMS", "Campanhas", "OTP"],
    usageToday: 456,
    usageLimit: 10000,
    latencyMs: 200,
    uptime: 99.5,
    endpoints: [
      { method: "POST", path: "/sms", description: "Enviar SMS" },
      { method: "GET", path: "/sms/{id}/status", description: "Consultar status" },
    ]
  },
];

const getStatusColor = (status: ApiIntegration["status"]) => {
  switch (status) {
    case "active": return "bg-green-500";
    case "configured": return "bg-blue-500";
    case "available": return "bg-gray-400";
    case "coming_soon": return "bg-yellow-500";
    default: return "bg-gray-400";
  }
};

const getStatusLabel = (status: ApiIntegration["status"]) => {
  switch (status) {
    case "active": return "Ativo";
    case "configured": return "Configurado";
    case "available": return "Disponível";
    case "coming_soon": return "Em breve";
    default: return status;
  }
};

const getMethodColor = (method: string) => {
  switch (method) {
    case "GET": return "bg-blue-100 text-blue-700";
    case "POST": return "bg-green-100 text-green-700";
    case "PUT": return "bg-yellow-100 text-yellow-700";
    case "DELETE": return "bg-red-100 text-red-700";
    case "PATCH": return "bg-purple-100 text-purple-700";
    default: return "bg-gray-100 text-gray-700";
  }
};

export default function CentralApis() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<ApiIntegration | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({ name: "", provider: "", description: "", priority: "normal" });

  const filteredIntegrations = useMemo(() => {
    return integrations.filter(api => {
      const matchesSearch = !searchQuery || 
        api.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        api.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        api.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        api.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = !selectedCategory || api.categoryId === selectedCategory;
      
      const matchesTab = activeTab === "all" || 
        (activeTab === "active" && (api.status === "active" || api.status === "configured")) ||
        (activeTab === "available" && api.status === "available") ||
        (activeTab === "coming_soon" && api.status === "coming_soon");

      return matchesSearch && matchesCategory && matchesTab;
    });
  }, [searchQuery, selectedCategory, activeTab]);

  const stats = useMemo(() => ({
    total: integrations.length,
    active: integrations.filter(i => i.status === "active").length,
    configured: integrations.filter(i => i.status === "configured").length,
    available: integrations.filter(i => i.status === "available").length,
    totalCalls: integrations.reduce((sum, i) => sum + i.usageToday, 0),
  }), []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                Central de APIs
              </h1>
              <p className="text-slate-600 mt-1">
                Conecte seu negócio com as principais APIs do mercado brasileiro
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" className="gap-2" data-testid="button-back-home">
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  Voltar
                </Button>
              </Link>
              <Link href="/api-hub">
                <Button variant="outline" className="gap-2 border-cyan-500 text-cyan-600 hover:bg-cyan-50" data-testid="button-api-hub">
                  <BookOpen className="h-4 w-4" />
                  API Hub
                </Button>
              </Link>
              <Button className="gap-2" data-testid="button-request-integration" onClick={() => setShowRequestDialog(true)}>
                <Plus className="h-4 w-4" />
                Solicitar Integração
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Total de APIs</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
                  </div>
                  <Database className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Ativas</p>
                    <p className="text-2xl font-bold text-green-900">{stats.active}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Configuradas</p>
                    <p className="text-2xl font-bold text-purple-900">{stats.configured}</p>
                  </div>
                  <Settings className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600 font-medium">Disponíveis</p>
                    <p className="text-2xl font-bold text-orange-900">{stats.available}</p>
                  </div>
                  <Globe className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-cyan-600 font-medium">Chamadas Hoje</p>
                    <p className="text-2xl font-bold text-cyan-900">{stats.totalCalls.toLocaleString()}</p>
                  </div>
                  <Activity className="h-8 w-8 text-cyan-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Buscar APIs, provedores, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-apis"
              />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">Todas</TabsTrigger>
                <TabsTrigger value="active" data-testid="tab-active">Ativas</TabsTrigger>
                <TabsTrigger value="available" data-testid="tab-available">Disponíveis</TabsTrigger>
                <TabsTrigger value="coming_soon" data-testid="tab-coming-soon">Em breve</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Categorias
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Button
                  variant={selectedCategory === null ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(null)}
                  data-testid="filter-all-categories"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Todas as categorias
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedCategory(cat.id)}
                    data-testid={`filter-category-${cat.id}`}
                  >
                    <div className={cn("p-1 rounded mr-2", cat.color)}>
                      <cat.icon className="h-3 w-3 text-white" />
                    </div>
                    <span className="truncate">{cat.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {integrations.filter(i => i.categoryId === cat.id).length}
                    </Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIntegrations.map((api) => {
                const category = categories.find(c => c.id === api.categoryId);
                return (
                  <Card 
                    key={api.id} 
                    className="hover:shadow-lg transition-all cursor-pointer group"
                    onClick={() => setSelectedIntegration(api)}
                    data-testid={`card-api-${api.id}`}
                  >
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {category && (
                            <div className={cn("p-2 rounded-lg", category.color)}>
                              <category.icon className="h-5 w-5 text-white" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {api.name}
                            </h3>
                            <p className="text-xs text-slate-500">{api.provider}</p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            api.status === "active" && "bg-green-50 text-green-700 border-green-200",
                            api.status === "configured" && "bg-blue-50 text-blue-700 border-blue-200",
                            api.status === "available" && "bg-gray-50 text-gray-700 border-gray-200",
                            api.status === "coming_soon" && "bg-yellow-50 text-yellow-700 border-yellow-200"
                          )}
                        >
                          {getStatusLabel(api.status)}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        {api.description}
                      </p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {api.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      {api.status !== "coming_soon" && (
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              {api.usageToday.toLocaleString()} hoje
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {api.latencyMs}ms
                            </span>
                          </div>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            {api.uptime}%
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredIntegrations.length === 0 && (
              <Card className="p-12 text-center">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">Nenhuma API encontrada</h3>
                <p className="text-slate-500">Tente ajustar os filtros ou termos de busca</p>
              </Card>
            )}
          </div>
        </div>

        <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            {selectedIntegration && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-4">
                    {(() => {
                      const cat = categories.find(c => c.id === selectedIntegration.categoryId);
                      return cat ? (
                        <div className={cn("p-3 rounded-xl", cat.color)}>
                          <cat.icon className="h-6 w-6 text-white" />
                        </div>
                      ) : null;
                    })()}
                    <div>
                      <DialogTitle className="text-xl">{selectedIntegration.name}</DialogTitle>
                      <DialogDescription className="flex items-center gap-2">
                        {selectedIntegration.provider} • Versão {selectedIntegration.version}
                        <Badge 
                          variant="outline"
                          className={cn(
                            "text-xs ml-2",
                            selectedIntegration.status === "active" && "bg-green-50 text-green-700",
                            selectedIntegration.status === "configured" && "bg-blue-50 text-blue-700",
                          )}
                        >
                          {getStatusLabel(selectedIntegration.status)}
                        </Badge>
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="overview" className="gap-2" data-testid="modal-tab-overview">
                      <Eye className="h-4 w-4" />
                      Visão Geral
                    </TabsTrigger>
                    <TabsTrigger value="endpoints" className="gap-2" data-testid="modal-tab-endpoints">
                      <Code className="h-4 w-4" />
                      Endpoints
                    </TabsTrigger>
                    <TabsTrigger value="usage" className="gap-2" data-testid="modal-tab-usage">
                      <Activity className="h-4 w-4" />
                      Uso
                    </TabsTrigger>
                  </TabsList>

                  <ScrollArea className="flex-1 mt-4">
                    <TabsContent value="overview" className="mt-0 space-y-4">
                      <p className="text-slate-600">{selectedIntegration.description}</p>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <Clock className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                            <p className="text-2xl font-bold">{selectedIntegration.latencyMs}ms</p>
                            <p className="text-xs text-slate-500">Latência média</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <Shield className="h-6 w-6 mx-auto text-green-500 mb-2" />
                            <p className="text-2xl font-bold">{selectedIntegration.uptime}%</p>
                            <p className="text-xs text-slate-500">Uptime</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <Zap className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                            <p className="text-2xl font-bold">{selectedIntegration.endpoints.length}</p>
                            <p className="text-xs text-slate-500">Endpoints</p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedIntegration.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button className="gap-2" disabled={selectedIntegration.status === "coming_soon"} data-testid="button-manage-api">
                          <Play className="h-4 w-4" />
                          {selectedIntegration.status === "active" ? "Gerenciar" : 
                           selectedIntegration.status === "configured" ? "Ativar" : 
                           selectedIntegration.status === "coming_soon" ? "Em breve" : "Configurar"}
                        </Button>
                        <Button variant="outline" className="gap-2" data-testid="button-api-docs">
                          <BookOpen className="h-4 w-4" />
                          Documentação
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="endpoints" className="mt-0 space-y-3">
                      {selectedIntegration.endpoints.length > 0 ? (
                        selectedIntegration.endpoints.map((endpoint, idx) => (
                          <Card key={idx}>
                            <CardContent className="pt-4">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge className={cn("font-mono text-xs", getMethodColor(endpoint.method))}>
                                  {endpoint.method}
                                </Badge>
                                <code className="text-sm font-mono text-slate-700">{endpoint.path}</code>
                                <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" data-testid={`button-copy-endpoint-${idx}`}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-sm text-slate-600">{endpoint.description}</p>
                              {endpoint.parameters && (
                                <div className="mt-3 space-y-1">
                                  <p className="text-xs font-medium text-slate-500">Parâmetros:</p>
                                  {endpoint.parameters.map((param, pIdx) => (
                                    <div key={pIdx} className="flex items-center gap-2 text-xs">
                                      <code className="bg-slate-100 px-1.5 py-0.5 rounded">{param.name}</code>
                                      <span className="text-slate-400">{param.type}</span>
                                      {param.required && <Badge variant="destructive" className="text-[10px] h-4">obrigatório</Badge>}
                                      <span className="text-slate-500">{param.description}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          <Code className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                          <p>Documentação de endpoints disponível em breve</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="usage" className="mt-0 space-y-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Uso Hoje</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-end justify-between mb-2">
                            <span className="text-2xl font-bold">{selectedIntegration.usageToday.toLocaleString()}</span>
                            <span className="text-sm text-slate-500">de {selectedIntegration.usageLimit.toLocaleString()}</span>
                          </div>
                          <Progress 
                            value={(selectedIntegration.usageToday / selectedIntegration.usageLimit) * 100} 
                            className="h-2"
                          />
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-slate-500">Latência média</p>
                                <p className="text-xl font-bold">{selectedIntegration.latencyMs}ms</p>
                              </div>
                              <Clock className="h-8 w-8 text-slate-300" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-slate-500">Uptime (30d)</p>
                                <p className="text-xl font-bold text-green-600">{selectedIntegration.uptime}%</p>
                              </div>
                              <TrendingUp className="h-8 w-8 text-green-300" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="bg-slate-50">
                        <CardContent className="pt-4 text-center text-slate-500 text-sm">
                          <RefreshCw className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                          Gráficos detalhados de uso disponíveis no plano Pro
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </ScrollArea>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog: Solicitar Integração */}
        <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-500" />
                Solicitar Nova Integração
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da API que você precisa integrar. Nossa equipe analisará a solicitação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nome da API *</label>
                <Input
                  data-testid="input-request-name"
                  value={requestForm.name}
                  onChange={(e) => setRequestForm({ ...requestForm, name: e.target.value })}
                  placeholder="Ex: API do Banco X, SEFAZ MG..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Provedor/Fornecedor</label>
                <Input
                  data-testid="input-request-provider"
                  value={requestForm.provider}
                  onChange={(e) => setRequestForm({ ...requestForm, provider: e.target.value })}
                  placeholder="Ex: Banco do Brasil, Prefeitura de SP..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Descrição da necessidade *</label>
                <textarea
                  data-testid="textarea-request-description"
                  value={requestForm.description}
                  onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                  placeholder="Descreva para que você precisa dessa integração..."
                  className="w-full h-24 px-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Prioridade</label>
                <select
                  data-testid="select-request-priority"
                  value={requestForm.priority}
                  onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Baixa - Pode esperar</option>
                  <option value="normal">Normal - Próximas semanas</option>
                  <option value="high">Alta - Urgente</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
                Cancelar
              </Button>
              <Button 
                data-testid="button-submit-request"
                disabled={!requestForm.name || !requestForm.description}
                onClick={() => {
                  alert(`Solicitação enviada!\n\nAPI: ${requestForm.name}\nPrioridade: ${requestForm.priority}\n\nNossa equipe entrará em contato.`);
                  setShowRequestDialog(false);
                  setRequestForm({ name: "", provider: "", description: "", priority: "normal" });
                }}
              >
                Enviar Solicitação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
