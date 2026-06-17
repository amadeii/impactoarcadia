import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Store,
  Search,
  Grid3X3,
  List,
  Star,
  Download,
  Check,
  Loader2,
  Package,
  Crown,
  Zap,
  FileText,
  Building2,
  BarChart3,
  MessageSquare,
  MessageCircle,
  Brain,
  GraduationCap,
  Shield,
  Compass,
  ChevronRight,
  Filter,
  TrendingUp,
  Users,
  DollarSign,
} from "lucide-react";

interface MarketplaceModule {
  id: number;
  code: string;
  name: string;
  description: string;
  longDescription: string;
  category: string;
  icon: string;
  color: string;
  price: string;
  setupFee: string;
  features: string[];
  route: string;
  version: string;
  isCore: boolean;
  isActive: boolean;
  isFeatured: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Store,
  Building2,
  BarChart3,
  MessageSquare,
  MessageCircle,
  Brain,
  GraduationCap,
  Shield,
  Compass,
  Package,
};

const colorMap: Record<string, string> = {
  blue: "from-blue-500 to-blue-600",
  green: "from-green-500 to-green-600",
  purple: "from-purple-500 to-purple-600",
  orange: "from-orange-500 to-orange-600",
  emerald: "from-emerald-500 to-emerald-600",
  cyan: "from-cyan-500 to-cyan-600",
  pink: "from-pink-500 to-pink-600",
  indigo: "from-indigo-500 to-indigo-600",
  red: "from-red-500 to-red-600",
  amber: "from-amber-500 to-amber-600",
};

const categoryLabels: Record<string, string> = {
  core: "Core",
  business: "Negócios",
  intelligence: "Inteligência",
  communication: "Comunicação",
  segment: "Segmentos",
};

export default function Marketplace() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedModule, setSelectedModule] = useState<MarketplaceModule | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: modules = [], isLoading } = useQuery<MarketplaceModule[]>({
    queryKey: ["marketplace-modules"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace/modules");
      if (!res.ok) throw new Error("Failed to fetch modules");
      return res.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["marketplace-stats"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const categories = Array.from(new Set(modules.map(m => m.category)));
  const featuredModules = modules.filter(m => m.isFeatured);
  
  const filteredModules = modules.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || Package;
    return IconComponent;
  };

  const getColorClass = (color: string) => {
    return colorMap[color] || "from-gray-500 to-gray-600";
  };

  return (
    <BrowserFrame>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-emerald-600/20 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl">
                <Store className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">Marketplace</h1>
                <p className="text-slate-400 mt-1">Descubra e ative módulos para potencializar seu negócio</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 mt-8">
              <div className="relative flex-1 min-w-[300px]">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar módulos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 py-6 bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-lg rounded-xl"
                  data-testid="input-search-modules"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className={viewMode === "grid" ? "bg-white/20" : "bg-white/5 border-white/20 text-white"}
                >
                  <Grid3X3 className="w-5 h-5" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className={viewMode === "list" ? "bg-white/20" : "bg-white/5 border-white/20 text-white"}
                >
                  <List className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className={selectedCategory === null ? "bg-white/20" : "bg-white/5 border-white/20 text-white hover:bg-white/10"}
              >
                Todos
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className={selectedCategory === cat ? "bg-white/20" : "bg-white/5 border-white/20 text-white hover:bg-white/10"}
                >
                  {categoryLabels[cat] || cat}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {featuredModules.length > 0 && !searchTerm && !selectedCategory && (
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <Star className="w-5 h-5 text-yellow-400" />
                <h2 className="text-xl font-semibold text-white">Destaques</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featuredModules.slice(0, 3).map(module => {
                  const IconComponent = getIcon(module.icon);
                  return (
                    <Card 
                      key={module.id} 
                      className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 hover:border-white/40 transition-all cursor-pointer group overflow-hidden"
                      onClick={() => setSelectedModule(module)}
                      data-testid={`featured-module-${module.code}`}
                    >
                      <div className={`h-2 bg-gradient-to-r ${getColorClass(module.color)}`} />
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className={`p-3 rounded-xl bg-gradient-to-br ${getColorClass(module.color)}`}>
                            <IconComponent className="w-6 h-6 text-white" />
                          </div>
                          <Badge className="bg-yellow-500/20 text-yellow-300 border-0">
                            <Star className="w-3 h-3 mr-1" /> Destaque
                          </Badge>
                        </div>
                        <CardTitle className="text-white mt-4">{module.name}</CardTitle>
                        <CardDescription className="text-slate-400">{module.description}</CardDescription>
                      </CardHeader>
                      <CardFooter className="flex justify-between items-center">
                        <div className="text-2xl font-bold text-white">
                          R$ {parseFloat(module.price).toFixed(2)}
                          <span className="text-sm text-slate-400 font-normal">/mês</span>
                        </div>
                        <Button size="sm" className={`bg-gradient-to-r ${getColorClass(module.color)} hover:opacity-90`}>
                          Ver Detalhes <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredModules.map(module => {
                const IconComponent = getIcon(module.icon);
                return (
                  <Card 
                    key={module.id} 
                    className="bg-white/5 border-white/10 hover:border-white/30 transition-all cursor-pointer group"
                    onClick={() => setSelectedModule(module)}
                    data-testid={`module-card-${module.code}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${getColorClass(module.color)}`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <Badge variant="secondary" className="bg-white/10 text-slate-300">
                          {categoryLabels[module.category] || module.category}
                        </Badge>
                      </div>
                      <CardTitle className="text-white mt-4 group-hover:text-blue-400 transition-colors">{module.name}</CardTitle>
                      <CardDescription className="text-slate-400 line-clamp-2">{module.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {module.features?.slice(0, 3).map((feature, i) => (
                          <Badge key={i} variant="outline" className="border-white/10 text-slate-400 text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center border-t border-white/10 pt-4">
                      <div className="text-xl font-bold text-white">
                        R$ {parseFloat(module.price).toFixed(2)}
                        <span className="text-xs text-slate-400 font-normal">/mês</span>
                      </div>
                      <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                        Detalhes <ChevronRight className="w-4 h-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredModules.map(module => {
                const IconComponent = getIcon(module.icon);
                return (
                  <Card 
                    key={module.id} 
                    className="bg-white/5 border-white/10 hover:border-white/30 transition-all cursor-pointer"
                    onClick={() => setSelectedModule(module)}
                    data-testid={`module-list-${module.code}`}
                  >
                    <CardContent className="flex items-center gap-6 py-4">
                      <div className={`p-4 rounded-xl bg-gradient-to-br ${getColorClass(module.color)}`}>
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">{module.name}</h3>
                        <p className="text-slate-400">{module.description}</p>
                        <div className="flex gap-2 mt-2">
                          {module.features?.slice(0, 4).map((feature, i) => (
                            <Badge key={i} variant="outline" className="border-white/10 text-slate-400 text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          R$ {parseFloat(module.price).toFixed(2)}
                        </div>
                        <div className="text-sm text-slate-400">por mês</div>
                      </div>
                      <Button className={`bg-gradient-to-r ${getColorClass(module.color)}`}>
                        Ativar
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {filteredModules.length === 0 && !isLoading && (
            <div className="text-center py-20">
              <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Nenhum módulo encontrado</h3>
              <p className="text-slate-400">Tente ajustar sua busca ou filtros</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedModule} onOpenChange={() => setSelectedModule(null)}>
        {selectedModule && (
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-xl bg-gradient-to-br ${getColorClass(selectedModule.color)}`}>
                  {(() => {
                    const IconComponent = getIcon(selectedModule.icon);
                    return <IconComponent className="w-8 h-8 text-white" />;
                  })()}
                </div>
                <div>
                  <DialogTitle className="text-2xl">{selectedModule.name}</DialogTitle>
                  <DialogDescription className="text-slate-400">{selectedModule.description}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-3">Funcionalidades Incluídas</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedModule.features?.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div>
                  <div className="text-sm text-slate-400">Valor Mensal</div>
                  <div className="text-3xl font-bold">
                    R$ {parseFloat(selectedModule.price).toFixed(2)}
                  </div>
                </div>
                {parseFloat(selectedModule.setupFee) > 0 && (
                  <div className="text-right">
                    <div className="text-sm text-slate-400">Taxa de Implantação</div>
                    <div className="text-xl font-semibold text-slate-300">
                      R$ {parseFloat(selectedModule.setupFee).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelectedModule(null)} className="border-slate-600 text-slate-300">
                Fechar
              </Button>
              <Button className={`bg-gradient-to-r ${getColorClass(selectedModule.color)}`}>
                <Zap className="w-4 h-4 mr-2" />
                Ativar Módulo
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </BrowserFrame>
  );
}
