import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  ShoppingCart,
  GraduationCap,
  Store,
  FileText,
  Calculator,
  BarChart3,
  MessageSquare,
  Users,
  Bot,
  Compass,
  Wrench,
  Package,
  ClipboardCheck,
  Building,
  Beaker,
  Code,
  Layers,
  Settings,
  Star,
  ArrowRight,
  Database,
  Server,
  Terminal,
  Layout,
  Blocks,
  ThumbsUp,
  UserCircle,
  Shield,
  Zap,
  Globe,
  Briefcase,
  PenTool,
  HardDrive,
  Workflow,
} from "lucide-react";

interface AppItem {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  category: string;
  status: "active" | "coming_soon" | "beta";
  featured?: boolean;
  color: string;
}

const apps: AppItem[] = [
  // Negócios
  {
    id: "marketplace",
    name: "Marketplace",
    description: "Loja de módulos e extensões do Arcádia Suite",
    icon: <ShoppingCart className="w-8 h-8" />,
    route: "/marketplace",
    category: "negocios",
    status: "active",
    featured: true,
    color: "from-purple-500 to-pink-500",
  },
  {
    id: "retail",
    name: "Arcádia Retail",
    description: "PDV, vendas e gestão de lojas",
    icon: <Store className="w-8 h-8" />,
    route: "/retail",
    category: "negocios",
    status: "active",
    featured: true,
    color: "from-orange-500 to-red-500",
  },
  {
    id: "soe",
    name: "Arcádia SOE",
    description: "Sistema Operacional Empresarial - Kernel de negócios",
    icon: <Building className="w-8 h-8" />,
    route: "/soe",
    category: "negocios",
    status: "active",
    featured: true,
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "xos",
    name: "XOS",
    description: "Central de relacionamento, atendimento e comunicação",
    icon: <Users className="w-8 h-8" />,
    route: "/xos",
    category: "negocios",
    status: "active",
    color: "from-violet-500 to-purple-600",
  },
  // Finanças
  {
    id: "fisco",
    name: "Arcádia Fisco",
    description: "Emissão de NF-e, NFC-e e gestão fiscal",
    icon: <FileText className="w-8 h-8" />,
    route: "/fisco",
    category: "financas",
    status: "active",
    featured: true,
    color: "from-indigo-500 to-violet-500",
  },
  {
    id: "financeiro",
    name: "Control (Financeiro)",
    description: "DRE gerencial, fluxo de caixa, orçamento × realizado e conciliação bancária",
    icon: <Calculator className="w-8 h-8" />,
    route: "/control",
    category: "financas",
    status: "active",
    color: "from-emerald-500 to-teal-500",
  },
  {
    id: "contabil",
    name: "Contábil",
    description: "Lançamentos e relatórios contábeis",
    icon: <ClipboardCheck className="w-8 h-8" />,
    route: "/contabil",
    category: "financas",
    status: "active",
    color: "from-slate-500 to-zinc-500",
  },
  // Inteligência
  {
    id: "insights",
    name: "Arcádia Insights",
    description: "Business Intelligence e dashboards",
    icon: <BarChart3 className="w-8 h-8" />,
    route: "/insights",
    category: "inteligencia",
    status: "active",
    featured: true,
    color: "from-cyan-500 to-blue-500",
  },
  {
    id: "agent",
    name: "Manus AI",
    description: "Agente autônomo com inteligência artificial",
    icon: <Bot className="w-8 h-8" />,
    route: "/agent",
    category: "inteligencia",
    status: "active",
    color: "from-violet-500 to-purple-500",
  },
  {
    id: "scientist",
    name: "Scientist",
    description: "Auto-programação e análise de dados com IA",
    icon: <Beaker className="w-8 h-8" />,
    route: "/scientist",
    category: "inteligencia",
    status: "active",
    color: "from-pink-500 to-rose-500",
  },
  {
    id: "knowledge",
    name: "Knowledge Graph",
    description: "Base de conhecimento semântica",
    icon: <Layers className="w-8 h-8" />,
    route: "/knowledge",
    category: "inteligencia",
    status: "active",
    color: "from-amber-500 to-orange-500",
  },
  // Comunicação
  {
    id: "xos",
    name: "XOS",
    description: "Experience Operating System - Marketing, Vendas e Atendimento",
    icon: <Layers className="w-8 h-8" />,
    route: "/xos",
    category: "comunicacao",
    status: "active",
    featured: true,
    color: "from-blue-600 to-indigo-600",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Central de atendimento via WhatsApp",
    icon: <MessageSquare className="w-8 h-8" />,
    route: "/whatsapp",
    category: "comunicacao",
    status: "active",
    color: "from-green-500 to-emerald-500",
  },
  {
    id: "chat",
    name: "Chat Interno",
    description: "Comunicação entre equipes",
    icon: <MessageSquare className="w-8 h-8" />,
    route: "/chat",
    category: "comunicacao",
    status: "active",
    color: "from-blue-500 to-indigo-500",
  },
  // Educação
  {
    id: "lms",
    name: "Arcádia LMS",
    description: "Cursos e treinamentos online",
    icon: <GraduationCap className="w-8 h-8" />,
    route: "/lms",
    category: "educacao",
    status: "active",
    featured: true,
    color: "from-indigo-500 to-purple-500",
  },
  // Operações
  {
    id: "quality",
    name: "Qualidade ISO",
    description: "Gestão da qualidade e ISO 17025",
    icon: <ClipboardCheck className="w-8 h-8" />,
    route: "/quality",
    category: "operacoes",
    status: "active",
    color: "from-teal-500 to-cyan-500",
  },
  {
    id: "field-ops",
    name: "Operações de Campo",
    description: "Gestão de equipes em campo",
    icon: <Compass className="w-8 h-8" />,
    route: "/field-ops",
    category: "operacoes",
    status: "active",
    color: "from-lime-500 to-green-500",
  },
  {
    id: "production",
    name: "Produção",
    description: "Gestão de produção e manufatura",
    icon: <Wrench className="w-8 h-8" />,
    route: "/production",
    category: "operacoes",
    status: "active",
    color: "from-gray-500 to-slate-500",
  },
  {
    id: "suppliers",
    name: "Portal Fornecedores",
    description: "Gestão de fornecedores e homologação",
    icon: <Package className="w-8 h-8" />,
    route: "/suppliers",
    category: "operacoes",
    status: "active",
    color: "from-amber-500 to-yellow-500",
  },
  // Desenvolvimento
  {
    id: "ide",
    name: "IDE",
    description: "Ambiente de desenvolvimento integrado",
    icon: <Code className="w-8 h-8" />,
    route: "/ide",
    category: "desenvolvimento",
    status: "active",
    color: "from-slate-600 to-gray-600",
  },
  {
    id: "development",
    name: "Dev Module",
    description: "Ferramentas de desenvolvimento",
    icon: <Wrench className="w-8 h-8" />,
    route: "/development",
    category: "desenvolvimento",
    status: "active",
    color: "from-zinc-600 to-neutral-600",
  },
  // Consultoria
  {
    id: "compass",
    name: "Process Compass",
    description: "Mapeamento e otimização de processos",
    icon: <Compass className="w-8 h-8" />,
    route: "/compass",
    category: "consultoria",
    status: "active",
    color: "from-rose-500 to-pink-500",
  },
  {
    id: "support",
    name: "Suporte",
    description: "Central de suporte e tickets",
    icon: <Settings className="w-8 h-8" />,
    route: "/support",
    category: "consultoria",
    status: "active",
    color: "from-sky-500 to-blue-500",
  },
  // Administração
  {
    id: "migration",
    name: "Migração XOS",
    description: "Importação de dados de sistemas legados",
    icon: <Database className="w-8 h-8" />,
    route: "/migration",
    category: "administracao",
    status: "active",
    featured: true,
    color: "from-cyan-600 to-teal-600",
  },
  {
    id: "plus",
    name: "Arcádia Plus",
    description: "ERP completo em Laravel com NF-e, PDV e integrações",
    icon: <HardDrive className="w-8 h-8" />,
    route: "/plus",
    category: "negocios",
    status: "active",
    featured: true,
    color: "from-violet-600 to-purple-600",
  },
  {
    id: "super-admin",
    name: "Super Admin",
    description: "Painel administrativo master",
    icon: <Shield className="w-8 h-8" />,
    route: "/super-admin",
    category: "administracao",
    status: "active",
    color: "from-red-600 to-rose-600",
  },
  // APIs e Integrações
  {
    id: "api-hub",
    name: "API Hub",
    description: "Central de APIs e documentação",
    icon: <Server className="w-8 h-8" />,
    route: "/api-hub",
    category: "desenvolvimento",
    status: "active",
    color: "from-blue-600 to-indigo-600",
  },
  {
    id: "central-apis",
    name: "Central APIs",
    description: "Gerenciamento de endpoints e integrações",
    icon: <Globe className="w-8 h-8" />,
    route: "/central-apis",
    category: "desenvolvimento",
    status: "active",
    color: "from-teal-600 to-cyan-600",
  },
  {
    id: "api-tester",
    name: "API Tester",
    description: "Testador de APIs com requisições HTTP",
    icon: <Terminal className="w-8 h-8" />,
    route: "/api-tester",
    category: "desenvolvimento",
    status: "active",
    color: "from-green-600 to-emerald-600",
  },
  // Ferramentas de Desenvolvimento
  {
    id: "doctype-builder",
    name: "DocType Builder",
    description: "Construtor visual de tipos de documento",
    icon: <Blocks className="w-8 h-8" />,
    route: "/doctype-builder",
    category: "desenvolvimento",
    status: "active",
    color: "from-orange-600 to-amber-600",
  },
  {
    id: "page-builder",
    name: "Page Builder",
    description: "Construtor visual de páginas e formulários",
    icon: <Layout className="w-8 h-8" />,
    route: "/page-builder",
    category: "desenvolvimento",
    status: "active",
    color: "from-pink-600 to-rose-600",
  },
  {
    id: "engineering",
    name: "Engineering Hub",
    description: "Hub de engenharia e projetos técnicos",
    icon: <PenTool className="w-8 h-8" />,
    route: "/engineering",
    category: "desenvolvimento",
    status: "active",
    color: "from-indigo-600 to-blue-600",
  },
  // Mais Módulos de Negócios
  {
    id: "valuation",
    name: "Valuation",
    description: "Avaliação e valorização de ativos",
    icon: <Briefcase className="w-8 h-8" />,
    route: "/valuation",
    category: "financas",
    status: "active",
    color: "from-yellow-600 to-amber-600",
  },
  {
    id: "commercial-env",
    name: "Ambiente Comercial",
    description: "Gestão do ambiente comercial",
    icon: <Store className="w-8 h-8" />,
    route: "/commercial-env",
    category: "negocios",
    status: "active",
    color: "from-lime-600 to-green-600",
  },
  // Mais Operações
  {
    id: "technical",
    name: "Assistência Técnica",
    description: "Ordens de serviço e manutenção",
    icon: <Wrench className="w-8 h-8" />,
    route: "/technical",
    category: "operacoes",
    status: "active",
    color: "from-slate-600 to-gray-600",
  },
  // Mais Inteligência
  {
    id: "automations",
    name: "Automações",
    description: "Workflows e automações de processos",
    icon: <Workflow className="w-8 h-8" />,
    route: "/automations",
    category: "inteligencia",
    status: "active",
    color: "from-purple-600 to-violet-600",
  },
  {
    id: "canvas",
    name: "Canvas",
    description: "Quadros visuais e brainstorming",
    icon: <PenTool className="w-8 h-8" />,
    route: "/canvas",
    category: "inteligencia",
    status: "active",
    color: "from-rose-600 to-pink-600",
  },
  // Mais Comunicação
  {
    id: "communities",
    name: "Comunidades",
    description: "Gestão de comunidades e grupos",
    icon: <Users className="w-8 h-8" />,
    route: "/communities",
    category: "comunicacao",
    status: "active",
    color: "from-indigo-600 to-purple-600",
  },
  {
    id: "nps",
    name: "Pesquisa NPS",
    description: "Net Promoter Score e satisfação",
    icon: <ThumbsUp className="w-8 h-8" />,
    route: "/nps",
    category: "comunicacao",
    status: "active",
    color: "from-emerald-600 to-teal-600",
  },
  {
    id: "people",
    name: "Pessoas",
    description: "Cadastro unificado PF/PJ com múltiplos papéis (cliente, fornecedor, colaborador)",
    icon: <UserCircle className="w-8 h-8" />,
    route: "/pessoas",
    category: "negocios",
    status: "active",
    color: "from-blue-600 to-cyan-600",
  },
  {
    id: "hr",
    name: "RH / DP",
    description: "Folha de pagamento, cargos, ponto e importação Domínio",
    icon: <UserCircle className="w-8 h-8" />,
    route: "/hr",
    category: "negocios",
    status: "active",
    color: "from-violet-600 to-purple-600",
  },
];

const categories = [
  { id: "todos", label: "Todos os Apps", icon: <Layers className="w-4 h-4" /> },
  { id: "negocios", label: "Negócios", icon: <Building className="w-4 h-4" /> },
  { id: "financas", label: "Finanças", icon: <Calculator className="w-4 h-4" /> },
  { id: "inteligencia", label: "Inteligência", icon: <Bot className="w-4 h-4" /> },
  { id: "comunicacao", label: "Comunicação", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "educacao", label: "Educação", icon: <GraduationCap className="w-4 h-4" /> },
  { id: "operacoes", label: "Operações", icon: <Wrench className="w-4 h-4" /> },
  { id: "desenvolvimento", label: "Desenvolvimento", icon: <Code className="w-4 h-4" /> },
  { id: "consultoria", label: "Consultoria", icon: <Compass className="w-4 h-4" /> },
  { id: "administracao", label: "Administração", icon: <Shield className="w-4 h-4" /> },
];

export default function AppCenter() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("todos");

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "todos" || app.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredApps = apps.filter(app => app.featured);

  return (
    <BrowserFrame>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-10">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-3">Central de Apps</h1>
              <p className="text-lg text-slate-400">Todos os aplicativos do Arcádia Suite em um só lugar</p>
            </div>

            {/* Search */}
            <div className="max-w-xl mx-auto relative">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar apps..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 py-6 text-lg bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl"
                data-testid="input-search-apps"
              />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Featured Apps */}
          {!searchTerm && activeCategory === "todos" && (
            <div className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" /> Apps em Destaque
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {featuredApps.map(app => (
                  <Card
                    key={app.id}
                    className="bg-white/5 border-white/10 hover:border-white/30 cursor-pointer transition-all hover:scale-105 group"
                    onClick={() => setLocation(app.route)}
                    data-testid={`featured-app-${app.id}`}
                  >
                    <CardContent className="p-4 text-center">
                      <div className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}>
                        {app.icon}
                      </div>
                      <h3 className="font-semibold text-white text-sm">{app.name}</h3>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="bg-white/10 border border-white/20 mb-6 flex-wrap h-auto p-2 gap-1">
              {categories.map(cat => (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="data-[state=active]:bg-white/20 text-white text-sm px-4 py-2"
                  data-testid={`category-${cat.id}`}
                >
                  {cat.icon}
                  <span className="ml-2">{cat.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeCategory} className="mt-0">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredApps.map(app => (
                  <Card
                    key={app.id}
                    className="bg-white/5 border-white/10 hover:border-white/30 cursor-pointer transition-all group overflow-hidden"
                    onClick={() => setLocation(app.route)}
                    data-testid={`app-card-${app.id}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform`}>
                          {app.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                              {app.name}
                            </h3>
                            {app.status === "beta" && (
                              <Badge className="bg-yellow-500/20 text-yellow-300 text-xs">Beta</Badge>
                            )}
                            {app.status === "coming_soon" && (
                              <Badge className="bg-slate-500/20 text-slate-300 text-xs">Em breve</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 line-clamp-2">{app.description}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <span className="text-xs text-indigo-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          Abrir <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredApps.length === 0 && (
                <div className="text-center py-20">
                  <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Nenhum app encontrado</h3>
                  <p className="text-slate-400">Tente buscar por outro termo</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-white">{apps.length}</p>
                <p className="text-sm text-slate-400">Apps Disponíveis</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-white">{categories.length - 1}</p>
                <p className="text-sm text-slate-400">Categorias</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-white">{apps.filter(a => a.status === "active").length}</p>
                <p className="text-sm text-slate-400">Apps Ativos</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}
