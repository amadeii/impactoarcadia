import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Layout, Settings, Eye, Trash2, Edit, Save, Loader2, 
  ChevronRight, ArrowLeft, Grid, List, PieChart, Table, FormInput,
  FileText, BarChart2, Gauge, Calendar, Move
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WIDGET_TYPES = [
  { value: "kpi", label: "KPI Card", icon: Gauge, description: "Cartão de indicador" },
  { value: "chart", label: "Gráfico", icon: BarChart2, description: "Gráfico de dados" },
  { value: "table", label: "Tabela", icon: Table, description: "Tabela de dados" },
  { value: "list", label: "Lista", icon: List, description: "Lista de registros" },
  { value: "form", label: "Formulário", icon: FormInput, description: "Formulário de entrada" },
  { value: "calendar", label: "Calendário", icon: Calendar, description: "Visualização de calendário" },
];

const PAGE_TYPES = [
  { value: "dashboard", label: "Dashboard", description: "Página com widgets e KPIs" },
  { value: "list", label: "Lista", description: "Listagem de registros de um DocType" },
  { value: "form", label: "Formulário", description: "Formulário de um DocType" },
  { value: "report", label: "Relatório", description: "Relatório com filtros" },
  { value: "page", label: "Página Customizada", description: "Página livre com widgets" },
];

interface Page {
  id: number;
  name: string;
  title: string;
  route: string;
  page_type: string;
  module: string;
  icon: string;
  layout: any;
  status: string;
}

interface Widget {
  id: string;
  type: string;
  title: string;
  config: any;
  position: { x: number; y: number; w: number; h: number };
}

export default function PageBuilder() {
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [showNewPage, setShowNewPage] = useState(false);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [newPage, setNewPage] = useState({
    name: "", title: "", route: "", pageType: "dashboard", module: "", icon: "Layout"
  });
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pages = [], isLoading } = useQuery<Page[]>({
    queryKey: ["/api/lowcode/pages"],
    queryFn: async () => {
      const res = await fetch("/api/lowcode/pages");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const { data: docTypes = [] } = useQuery({
    queryKey: ["/api/lowcode/doctypes"],
    queryFn: async () => {
      const res = await fetch("/api/lowcode/doctypes");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const createPageMutation = useMutation({
    mutationFn: async (data: typeof newPage) => {
      const res = await fetch("/api/lowcode/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lowcode/pages"] });
      setShowNewPage(false);
      setNewPage({ name: "", title: "", route: "", pageType: "dashboard", module: "", icon: "Layout" });
      toast({ title: "Página criada com sucesso!" });
    }
  });

  const handleCreatePage = () => {
    if (!newPage.name || !newPage.title || !newPage.route) {
      toast({ title: "Preencha nome, título e rota", variant: "destructive" });
      return;
    }
    createPageMutation.mutate(newPage);
  };

  const handleAddWidget = (type: string) => {
    const widgetType = WIDGET_TYPES.find(w => w.value === type);
    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type,
      title: widgetType?.label || "Widget",
      config: {},
      position: { x: 0, y: widgets.length, w: 6, h: 4 }
    };
    setWidgets([...widgets, newWidget]);
    setShowWidgetPicker(false);
  };

  const handleRemoveWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  const groupedPages = pages.reduce((acc, page) => {
    const module = page.module || "Geral";
    if (!acc[module]) acc[module] = [];
    acc[module].push(page);
    return acc;
  }, {} as Record<string, Page[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex bg-slate-50">
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Páginas</h2>
            <Button size="sm" onClick={() => setShowNewPage(true)} data-testid="button-new-page">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Input placeholder="Buscar páginas..." className="h-8" data-testid="input-search-page" />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {Object.entries(groupedPages).map(([module, pageList]) => (
            <div key={module} className="mb-4">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase">{module}</div>
              {pageList.map((page) => {
                const pageType = PAGE_TYPES.find(pt => pt.value === page.page_type);
                return (
                  <div
                    key={page.id}
                    onClick={() => setSelectedPage(page)}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedPage?.id === page.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100"
                    }`}
                    data-testid={`page-item-${page.id}`}
                  >
                    <div className="w-8 h-8 rounded flex items-center justify-center bg-slate-100">
                      <Layout className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{page.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{page.route}</div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{pageType?.label}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          ))}

          {pages.length === 0 && (
            <div className="text-center p-8 text-muted-foreground">
              <Layout className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma página criada</p>
              <p className="text-xs mt-1">Clique em + para criar a primeira</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedPage ? (
          <>
            <div className="bg-white border-b p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedPage(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h1 className="text-xl font-semibold">{selectedPage.title}</h1>
                    <p className="text-sm text-muted-foreground">{selectedPage.route}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" data-testid="button-preview-page">
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>
                  <Button size="sm" data-testid="button-save-layout">
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Layout
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <Tabs defaultValue="layout">
                <TabsList>
                  <TabsTrigger value="layout">
                    <Grid className="h-4 w-4 mr-2" />
                    Layout
                  </TabsTrigger>
                  <TabsTrigger value="settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="layout" className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Widgets da Página</h3>
                    <Button onClick={() => setShowWidgetPicker(true)} data-testid="button-add-widget">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Widget
                    </Button>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 rounded-lg min-h-[500px] p-4 bg-white">
                    {widgets.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <Grid className="h-16 w-16 mb-4 opacity-30" />
                        <p className="font-medium">Área de Layout</p>
                        <p className="text-sm mt-1">Adicione widgets para construir a página</p>
                        <Button variant="outline" className="mt-4" onClick={() => setShowWidgetPicker(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Widget
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-12 gap-4">
                        {widgets.map((widget) => {
                          const WidgetIcon = WIDGET_TYPES.find(w => w.value === widget.type)?.icon || FileText;
                          return (
                            <div
                              key={widget.id}
                              className="col-span-6 bg-slate-50 border rounded-lg p-4 relative group"
                              data-testid={`widget-${widget.id}`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Move className="h-4 w-4 text-muted-foreground cursor-grab" />
                                <WidgetIcon className="h-4 w-4 text-blue-500" />
                                <span className="font-medium text-sm">{widget.title}</span>
                              </div>
                              <div className="h-24 bg-slate-100 rounded flex items-center justify-center text-muted-foreground text-sm">
                                Preview do Widget
                              </div>
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600" onClick={() => handleRemoveWidget(widget.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Configurações da Página</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Nome Técnico</Label>
                          <Input value={selectedPage.name} disabled />
                        </div>
                        <div>
                          <Label>Título</Label>
                          <Input value={selectedPage.title} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Rota</Label>
                          <Input value={selectedPage.route} />
                        </div>
                        <div>
                          <Label>Módulo</Label>
                          <Input value={selectedPage.module || ""} />
                        </div>
                      </div>
                      <div>
                        <Label>Tipo de Página</Label>
                        <Select value={selectedPage.page_type}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAGE_TYPES.map((pt) => (
                              <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Layout className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium">Selecione uma Página</h3>
              <p className="text-sm mt-1">Escolha uma página da lista ou crie uma nova</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showNewPage} onOpenChange={setShowNewPage}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Página</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome Técnico *</Label>
              <Input
                data-testid="input-page-name"
                value={newPage.name}
                onChange={(e) => setNewPage(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                placeholder="ex: dashboard_vendas"
              />
            </div>
            <div>
              <Label>Título *</Label>
              <Input
                data-testid="input-page-title"
                value={newPage.title}
                onChange={(e) => setNewPage(prev => ({ ...prev, title: e.target.value }))}
                placeholder="ex: Dashboard de Vendas"
              />
            </div>
            <div>
              <Label>Rota *</Label>
              <Input
                data-testid="input-page-route"
                value={newPage.route}
                onChange={(e) => setNewPage(prev => ({ ...prev, route: e.target.value }))}
                placeholder="ex: /app/vendas"
              />
            </div>
            <div>
              <Label>Tipo de Página</Label>
              <Select value={newPage.pageType} onValueChange={(v) => setNewPage(prev => ({ ...prev, pageType: v }))}>
                <SelectTrigger data-testid="select-page-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>
                      <div>
                        <div>{pt.label}</div>
                        <div className="text-xs text-muted-foreground">{pt.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Módulo</Label>
              <Input
                value={newPage.module}
                onChange={(e) => setNewPage(prev => ({ ...prev, module: e.target.value }))}
                placeholder="ex: Vendas, RH, Qualidade"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPage(false)}>Cancelar</Button>
            <Button onClick={handleCreatePage} disabled={createPageMutation.isPending} data-testid="button-create-page">
              {createPageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Criar Página
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWidgetPicker} onOpenChange={setShowWidgetPicker}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Widget</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {WIDGET_TYPES.map((widget) => {
              const IconComp = widget.icon;
              return (
                <div
                  key={widget.value}
                  onClick={() => handleAddWidget(widget.value)}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-colors"
                  data-testid={`widget-type-${widget.value}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <IconComp className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{widget.label}</div>
                      <div className="text-xs text-muted-foreground">{widget.description}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
