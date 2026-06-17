import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, FileText, Settings, Database, Code, Layout, Trash2, Edit, Save, X, 
  GripVertical, Eye, Puzzle, Loader2, ChevronRight, ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as Icons from "lucide-react";

const FIELD_TYPES = [
  { value: "text", label: "Texto", description: "Campo de texto curto" },
  { value: "number", label: "Número", description: "Valor numérico" },
  { value: "textarea", label: "Texto Longo", description: "Campo de texto com múltiplas linhas" },
  { value: "select", label: "Seleção", description: "Lista de opções" },
  { value: "date", label: "Data", description: "Seletor de data" },
  { value: "datetime", label: "Data/Hora", description: "Seletor de data e hora" },
  { value: "check", label: "Checkbox", description: "Sim/Não" },
  { value: "currency", label: "Moeda", description: "Valor monetário" },
  { value: "email", label: "E-mail", description: "Endereço de email" },
  { value: "phone", label: "Telefone", description: "Número de telefone" },
  { value: "link", label: "Link", description: "Referência a outro DocType" },
];

const ICON_OPTIONS = [
  "FileText", "Users", "Package", "ShoppingCart", "CreditCard", "Building", 
  "Calendar", "Clock", "Mail", "Phone", "MapPin", "Settings", "Database",
  "Folder", "File", "FileCheck", "Clipboard", "BarChart", "PieChart"
];

const COLOR_OPTIONS = [
  { value: "blue", label: "Azul", bg: "bg-blue-500" },
  { value: "green", label: "Verde", bg: "bg-green-500" },
  { value: "purple", label: "Roxo", bg: "bg-purple-500" },
  { value: "orange", label: "Laranja", bg: "bg-orange-500" },
  { value: "red", label: "Vermelho", bg: "bg-red-500" },
  { value: "teal", label: "Teal", bg: "bg-teal-500" },
];

interface DocType {
  id: number;
  name: string;
  label: string;
  module: string;
  description: string;
  icon: string;
  color: string;
  is_submittable: boolean;
  is_single: boolean;
  has_web_view: boolean;
  status: string;
}

interface Field {
  id: number;
  doctype_id: number;
  field_name: string;
  label: string;
  field_type: string;
  options?: string;
  mandatory: boolean;
  in_list_view: boolean;
  in_filter: boolean;
  sort_order: number;
  section?: string;
  placeholder?: string;
  help_text?: string;
}

export default function DocTypeBuilder() {
  const [selectedDocType, setSelectedDocType] = useState<DocType | null>(null);
  const [showNewDocType, setShowNewDocType] = useState(false);
  const [showNewField, setShowNewField] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [newDocType, setNewDocType] = useState({
    name: "", label: "", module: "", description: "", icon: "FileText", color: "blue",
    isSubmittable: false, isSingle: false, hasWebView: true
  });
  const [newField, setNewField] = useState({
    fieldName: "", label: "", fieldType: "text", options: "", mandatory: false,
    inListView: false, inFilter: false, sortOrder: 0, section: "", placeholder: "", helpText: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: docTypes = [], isLoading } = useQuery<DocType[]>({
    queryKey: ["/api/lowcode/doctypes"],
    queryFn: async () => {
      const res = await fetch("/api/lowcode/doctypes");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const { data: fields = [] } = useQuery<Field[]>({
    queryKey: ["/api/lowcode/doctypes", selectedDocType?.id, "fields"],
    queryFn: async () => {
      if (!selectedDocType) return [];
      const res = await fetch(`/api/lowcode/doctypes/${selectedDocType.id}/fields`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedDocType
  });

  const createDocTypeMutation = useMutation({
    mutationFn: async (data: typeof newDocType) => {
      const res = await fetch("/api/lowcode/doctypes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lowcode/doctypes"] });
      setShowNewDocType(false);
      setNewDocType({ name: "", label: "", module: "", description: "", icon: "FileText", color: "blue", isSubmittable: false, isSingle: false, hasWebView: true });
      toast({ title: "DocType criado com sucesso!" });
    }
  });

  const deleteDocTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/lowcode/doctypes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lowcode/doctypes"] });
      setSelectedDocType(null);
      toast({ title: "DocType removido!" });
    }
  });

  const createFieldMutation = useMutation({
    mutationFn: async (data: typeof newField & { docTypeId: number }) => {
      const res = await fetch("/api/lowcode/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lowcode/doctypes", selectedDocType?.id, "fields"] });
      setShowNewField(false);
      setNewField({ fieldName: "", label: "", fieldType: "text", options: "", mandatory: false, inListView: false, inFilter: false, sortOrder: 0, section: "", placeholder: "", helpText: "" });
      toast({ title: "Campo adicionado!" });
    }
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/lowcode/fields/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lowcode/doctypes", selectedDocType?.id, "fields"] });
      toast({ title: "Campo removido!" });
    }
  });

  const handleCreateDocType = () => {
    if (!newDocType.name || !newDocType.label) {
      toast({ title: "Preencha nome e label", variant: "destructive" });
      return;
    }
    createDocTypeMutation.mutate(newDocType);
  };

  const handleCreateField = () => {
    if (!selectedDocType || !newField.fieldName || !newField.label) {
      toast({ title: "Preencha nome e label do campo", variant: "destructive" });
      return;
    }
    createFieldMutation.mutate({ ...newField, docTypeId: selectedDocType.id });
  };

  const groupedDocTypes = docTypes.reduce((acc, dt) => {
    const module = dt.module || "Geral";
    if (!acc[module]) acc[module] = [];
    acc[module].push(dt);
    return acc;
  }, {} as Record<string, DocType[]>);

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
            <h2 className="font-semibold text-lg">DocTypes</h2>
            <Button size="sm" onClick={() => setShowNewDocType(true)} data-testid="button-new-doctype">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Input placeholder="Buscar DocTypes..." className="h-8" data-testid="input-search-doctype" />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {Object.entries(groupedDocTypes).map(([module, doctypes]) => (
            <div key={module} className="mb-4">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase">{module}</div>
              {doctypes.map((dt) => {
                const IconComp = (Icons as any)[dt.icon] || Icons.FileText;
                return (
                  <div
                    key={dt.id}
                    onClick={() => setSelectedDocType(dt)}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedDocType?.id === dt.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100"
                    }`}
                    data-testid={`doctype-item-${dt.id}`}
                  >
                    <div className={`w-8 h-8 rounded flex items-center justify-center bg-${dt.color || "blue"}-100`}>
                      <IconComp className={`h-4 w-4 text-${dt.color || "blue"}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{dt.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{dt.name}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          ))}

          {docTypes.length === 0 && (
            <div className="text-center p-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhum DocType criado</p>
              <p className="text-xs mt-1">Clique em + para criar o primeiro</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDocType ? (
          <>
            <div className="bg-white border-b p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedDocType(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h1 className="text-xl font-semibold">{selectedDocType.label}</h1>
                    <p className="text-sm text-muted-foreground">{selectedDocType.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" data-testid="button-preview">
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600" onClick={() => deleteDocTypeMutation.mutate(selectedDocType.id)} data-testid="button-delete-doctype">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <Tabs defaultValue="fields">
                <TabsList>
                  <TabsTrigger value="fields">
                    <Layout className="h-4 w-4 mr-2" />
                    Campos
                  </TabsTrigger>
                  <TabsTrigger value="settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </TabsTrigger>
                  <TabsTrigger value="scripts">
                    <Code className="h-4 w-4 mr-2" />
                    Scripts
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="fields" className="mt-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">Campos do DocType</CardTitle>
                          <CardDescription>Defina os campos que compõem este DocType</CardDescription>
                        </div>
                        <Button onClick={() => setShowNewField(true)} data-testid="button-add-field">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Campo
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {fields.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Puzzle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>Nenhum campo definido</p>
                          <p className="text-sm mt-1">Adicione campos para definir a estrutura do DocType</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {fields.sort((a, b) => a.sort_order - b.sort_order).map((field) => (
                            <div
                              key={field.id}
                              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 group"
                              data-testid={`field-item-${field.id}`}
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{field.label}</span>
                                  {field.mandatory && <Badge variant="destructive" className="text-[10px] h-4">Obrigatório</Badge>}
                                  {field.in_list_view && <Badge variant="secondary" className="text-[10px] h-4">Lista</Badge>}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {field.field_name} • {FIELD_TYPES.find(ft => ft.value === field.field_type)?.label || field.field_type}
                                </div>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingField(field)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => deleteFieldMutation.mutate(field.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Configurações do DocType</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Nome Técnico</Label>
                          <Input value={selectedDocType.name} disabled />
                        </div>
                        <div>
                          <Label>Label</Label>
                          <Input value={selectedDocType.label} />
                        </div>
                      </div>
                      <div>
                        <Label>Descrição</Label>
                        <Textarea value={selectedDocType.description || ""} rows={3} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">Submissível</div>
                          <div className="text-xs text-muted-foreground">Requer workflow de aprovação</div>
                        </div>
                        <Switch checked={selectedDocType.is_submittable} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">Gerar Página Automaticamente</div>
                          <div className="text-xs text-muted-foreground">Cria listagem e formulário no menu</div>
                        </div>
                        <Switch checked={selectedDocType.has_web_view} />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="scripts" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Scripts e Automações</CardTitle>
                      <CardDescription>Configure scripts que rodam em eventos do DocType</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-12 text-muted-foreground">
                        <Code className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Em breve</p>
                        <p className="text-sm mt-1">Scripts personalizados estarão disponíveis em uma próxima versão</p>
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
              <Database className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium">Selecione um DocType</h3>
              <p className="text-sm mt-1">Escolha um DocType da lista ou crie um novo</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showNewDocType} onOpenChange={setShowNewDocType}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo DocType</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome Técnico *</Label>
              <Input
                data-testid="input-doctype-name"
                value={newDocType.name}
                onChange={(e) => setNewDocType(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                placeholder="ex: controle_ponto"
              />
              <p className="text-xs text-muted-foreground mt-1">Use snake_case sem espaços</p>
            </div>
            <div>
              <Label>Label (Nome de Exibição) *</Label>
              <Input
                data-testid="input-doctype-label"
                value={newDocType.label}
                onChange={(e) => setNewDocType(prev => ({ ...prev, label: e.target.value }))}
                placeholder="ex: Controle de Ponto"
              />
            </div>
            <div>
              <Label>Módulo</Label>
              <Input
                value={newDocType.module}
                onChange={(e) => setNewDocType(prev => ({ ...prev, module: e.target.value }))}
                placeholder="ex: RH, Qualidade, Comercial"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={newDocType.description}
                onChange={(e) => setNewDocType(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva a finalidade deste DocType..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ícone</Label>
                <Select value={newDocType.icon} onValueChange={(v) => setNewDocType(prev => ({ ...prev, icon: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => {
                      const IconComp = (Icons as any)[icon];
                      return (
                        <SelectItem key={icon} value={icon}>
                          <div className="flex items-center gap-2">
                            <IconComp className="h-4 w-4" />
                            {icon}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cor</Label>
                <Select value={newDocType.color} onValueChange={(v) => setNewDocType(prev => ({ ...prev, color: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color.bg}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDocType(false)}>Cancelar</Button>
            <Button onClick={handleCreateDocType} disabled={createDocTypeMutation.isPending} data-testid="button-save-doctype">
              {createDocTypeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Criar DocType
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewField} onOpenChange={setShowNewField}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Campo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome do Campo *</Label>
                <Input
                  data-testid="input-field-name"
                  value={newField.fieldName}
                  onChange={(e) => setNewField(prev => ({ ...prev, fieldName: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                  placeholder="ex: data_entrada"
                />
              </div>
              <div>
                <Label>Label *</Label>
                <Input
                  data-testid="input-field-label"
                  value={newField.label}
                  onChange={(e) => setNewField(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="ex: Data de Entrada"
                />
              </div>
            </div>
            <div>
              <Label>Tipo de Campo</Label>
              <Select value={newField.fieldType} onValueChange={(v) => setNewField(prev => ({ ...prev, fieldType: v }))}>
                <SelectTrigger data-testid="select-field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>
                      <div>
                        <div>{ft.label}</div>
                        <div className="text-xs text-muted-foreground">{ft.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newField.fieldType === "select" && (
              <div>
                <Label>Opções (uma por linha)</Label>
                <Textarea
                  value={newField.options}
                  onChange={(e) => setNewField(prev => ({ ...prev, options: e.target.value }))}
                  placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                  rows={4}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Seção</Label>
                <Input
                  value={newField.section}
                  onChange={(e) => setNewField(prev => ({ ...prev, section: e.target.value }))}
                  placeholder="ex: Dados Gerais"
                />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={newField.sortOrder}
                  onChange={(e) => setNewField(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div>
              <Label>Placeholder</Label>
              <Input
                value={newField.placeholder}
                onChange={(e) => setNewField(prev => ({ ...prev, placeholder: e.target.value }))}
                placeholder="Texto de ajuda no campo"
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newField.mandatory}
                  onCheckedChange={(c) => setNewField(prev => ({ ...prev, mandatory: c }))}
                />
                <Label className="font-normal">Obrigatório</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newField.inListView}
                  onCheckedChange={(c) => setNewField(prev => ({ ...prev, inListView: c }))}
                />
                <Label className="font-normal">Exibir na Lista</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newField.inFilter}
                  onCheckedChange={(c) => setNewField(prev => ({ ...prev, inFilter: c }))}
                />
                <Label className="font-normal">Filtro</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewField(false)}>Cancelar</Button>
            <Button onClick={handleCreateField} disabled={createFieldMutation.isPending} data-testid="button-save-field">
              {createFieldMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar Campo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
