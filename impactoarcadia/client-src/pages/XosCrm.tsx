import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Users, Building2, ArrowLeft, Plus, MoreVertical, Phone, Mail, Calendar,
  DollarSign, GripVertical, ChevronDown, Filter, Search, Target, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Pipeline {
  id: number;
  name: string;
  stages: Stage[];
}

interface Stage {
  id: number;
  pipeline_id: number;
  name: string;
  color: string;
  sort_order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
}

interface Deal {
  id: number;
  title: string;
  value: number;
  status: string;
  pipeline_id: number;
  stage_id: number;
  stage_name: string;
  stage_color: string;
  contact_id: number;
  contact_name: string;
  contact_email: string;
  contact_avatar: string;
  company_id: number;
  company_name: string;
  expected_close_date: string;
  notes: string;
  created_at: string;
}

interface Contact {
  id: number;
  name: string;
  email: string;
  company: string;
}

export default function XosCrm() {
  const queryClient = useQueryClient();
  const [selectedPipeline, setSelectedPipeline] = useState<number | null>(null);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [newDeal, setNewDeal] = useState({
    title: "",
    value: "",
    contact_id: "",
    expected_close_date: "",
    notes: "",
  });
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDealDetailOpen, setIsDealDetailOpen] = useState(false);
  const [isEditDealOpen, setIsEditDealOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", company: "" });

  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ["/api/xos/pipelines"],
  });

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/xos/deals", selectedPipeline],
    queryFn: async () => {
      const params = selectedPipeline ? `?pipeline_id=${selectedPipeline}` : "";
      const response = await fetch(`/api/xos/deals${params}`);
      return response.json();
    },
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/xos/contacts"],
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/xos/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xos/deals"] });
      setIsNewDealOpen(false);
      setNewDeal({ title: "", value: "", contact_id: "", expected_close_date: "", notes: "" });
    },
  });

  const updateDealStageMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: number; stageId: number }) => {
      const res = await fetch(`/api/xos/deals/${dealId}/stage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stageId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xos/deals"] });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: number) => {
      const res = await fetch(`/api/xos/deals/${dealId}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xos/deals"] });
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async (data: { id: number; title: string; value: number; notes: string; expected_close_date: string }) => {
      const res = await fetch(`/api/xos/deals/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xos/deals"] });
      setIsEditDealOpen(false);
      setEditDeal(null);
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; phone: string; company: string }) => {
      const res = await fetch("/api/xos/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, type: "lead", source: "crm_deal" }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/xos/contacts"] });
      setNewDeal({ ...newDeal, contact_id: String(data.id) });
      setShowNewContactForm(false);
      setNewContact({ name: "", email: "", phone: "", company: "" });
    },
  });

  const handleViewDetails = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsDealDetailOpen(true);
  };

  const handleEditDeal = (deal: Deal) => {
    setEditDeal(deal);
    setIsEditDealOpen(true);
  };

  const handleDeleteDeal = (deal: Deal) => {
    if (confirm(`Excluir o negócio "${deal.title}"?`)) {
      deleteDealMutation.mutate(deal.id);
    }
  };

  const handleSaveEdit = () => {
    if (!editDeal) return;
    updateDealMutation.mutate({
      id: editDeal.id,
      title: editDeal.title,
      value: editDeal.value,
      notes: editDeal.notes || "",
      expected_close_date: editDeal.expected_close_date || "",
    });
  };

  const activePipeline = pipelines.find((p) => p.id === selectedPipeline) || pipelines[0];
  const stages = activePipeline?.stages || [];

  const getDealsByStage = useCallback(
    (stageId: number) => deals.filter((d) => d.stage_id === stageId),
    [deals]
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    if (draggedDeal && draggedDeal.stage_id !== stageId) {
      updateDealStageMutation.mutate({ dealId: draggedDeal.id, stageId });
    }
    setDraggedDeal(null);
  };

  const getStageColor = (color: string) => {
    const colors: Record<string, string> = {
      slate: "bg-slate-100 border-slate-300",
      blue: "bg-blue-100 border-blue-300",
      indigo: "bg-indigo-100 border-indigo-300",
      violet: "bg-violet-100 border-violet-300",
      green: "bg-green-100 border-green-300",
      red: "bg-red-100 border-red-300",
    };
    return colors[color] || colors.slate;
  };

  const getStageHeaderColor = (color: string) => {
    const colors: Record<string, string> = {
      slate: "bg-slate-500",
      blue: "bg-blue-500",
      indigo: "bg-indigo-500",
      violet: "bg-violet-500",
      green: "bg-green-500",
      red: "bg-red-500",
    };
    return colors[color] || colors.slate;
  };

  const handleCreateDeal = () => {
    if (!newDeal.title || !activePipeline) return;
    
    const firstStage = stages.find((s) => !s.is_won && !s.is_lost);
    if (!firstStage) return;

    createDealMutation.mutate({
      title: newDeal.title,
      value: parseFloat(newDeal.value) || 0,
      pipeline_id: activePipeline.id,
      stage_id: firstStage.id,
      contact_id: newDeal.contact_id || null,
      expected_close_date: newDeal.expected_close_date || null,
      notes: newDeal.notes || null,
    });
  };

  const calculateStageTotal = (stageId: number) => {
    return getDealsByStage(stageId).reduce((sum, deal) => sum + (deal.value || 0), 0);
  };

  const handleCardClick = (deal: Deal, e: React.MouseEvent) => {
    // Não abrir se clicar no dropdown menu
    if ((e.target as HTMLElement).closest('[role="menu"]') || 
        (e.target as HTMLElement).closest('button')) {
      return;
    }
    setSelectedDeal(deal);
    setIsDealDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/xos">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">CRM</h1>
                  <p className="text-xs text-slate-500">Pipeline de Vendas</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Buscar negócios..." className="w-64 pl-10" data-testid="input-search" />
              </div>

              <Select
                value={String(activePipeline?.id || "")}
                onValueChange={(v) => setSelectedPipeline(parseInt(v))}
              >
                <SelectTrigger className="w-48" data-testid="select-pipeline">
                  <SelectValue placeholder="Selecione pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>

              <Dialog open={isNewDealOpen} onOpenChange={setIsNewDealOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-deal">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Negócio
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Negócio</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Título *</Label>
                      <Input
                        placeholder="Ex: Proposta Comercial - Empresa X"
                        value={newDeal.title}
                        onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                        data-testid="input-deal-title"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor</Label>
                        <Input
                          type="number"
                          placeholder="0,00"
                          value={newDeal.value}
                          onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                          data-testid="input-deal-value"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Prevista</Label>
                        <Input
                          type="date"
                          value={newDeal.expected_close_date}
                          onChange={(e) => setNewDeal({ ...newDeal, expected_close_date: e.target.value })}
                          data-testid="input-deal-date"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Contato</Label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="text-blue-600 hover:text-blue-700 h-auto p-0"
                          onClick={() => setShowNewContactForm(!showNewContactForm)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {showNewContactForm ? "Cancelar" : "Novo Contato"}
                        </Button>
                      </div>
                      
                      {showNewContactForm ? (
                        <div className="space-y-3 p-3 bg-slate-50 rounded-lg border">
                          <Input
                            placeholder="Nome do contato *"
                            value={newContact.name}
                            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                            data-testid="input-new-contact-name"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Email"
                              type="email"
                              value={newContact.email}
                              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                              data-testid="input-new-contact-email"
                            />
                            <Input
                              placeholder="Telefone"
                              value={newContact.phone}
                              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                              data-testid="input-new-contact-phone"
                            />
                          </div>
                          <Input
                            placeholder="Empresa"
                            value={newContact.company}
                            onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                            data-testid="input-new-contact-company"
                          />
                          <Button 
                            type="button"
                            size="sm"
                            className="w-full"
                            onClick={() => createContactMutation.mutate(newContact)}
                            disabled={!newContact.name || createContactMutation.isPending}
                          >
                            {createContactMutation.isPending ? "Criando..." : "Criar e Vincular Contato"}
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={newDeal.contact_id}
                          onValueChange={(v) => setNewDeal({ ...newDeal, contact_id: v })}
                        >
                          <SelectTrigger data-testid="select-deal-contact">
                            <SelectValue placeholder="Selecione um contato" />
                          </SelectTrigger>
                          <SelectContent>
                            {contacts.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name} - {c.company}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Notas</Label>
                      <Textarea
                        placeholder="Observações sobre o negócio..."
                        value={newDeal.notes}
                        onChange={(e) => setNewDeal({ ...newDeal, notes: e.target.value })}
                        data-testid="input-deal-notes"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleCreateDeal}
                      disabled={!newDeal.title || createDealMutation.isPending}
                      data-testid="button-save-deal"
                    >
                      {createDealMutation.isPending ? "Salvando..." : "Criar Negócio"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="p-4 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="w-80 flex-shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
              data-testid={`column-stage-${stage.id}`}
            >
              {/* Stage Header */}
              <div className={`rounded-t-lg ${getStageHeaderColor(stage.color)} p-3`}>
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{stage.name}</span>
                    <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                      {getDealsByStage(stage.id).length}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">
                    {formatCurrency(calculateStageTotal(stage.id))}
                  </span>
                </div>
                {stage.probability > 0 && (
                  <div className="text-xs text-white/80 mt-1">
                    {stage.probability}% probabilidade
                  </div>
                )}
              </div>

              {/* Stage Content */}
              <div className={`rounded-b-lg border-2 border-t-0 ${getStageColor(stage.color)} min-h-[500px] p-2 space-y-2`}>
                {getDealsByStage(stage.id).map((deal) => (
                  <Card
                    key={deal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal)}
                    onClick={(e) => handleCardClick(deal, e)}
                    className="cursor-pointer hover:shadow-md transition-shadow bg-white active:cursor-grabbing"
                    data-testid={`card-deal-${deal.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">{deal.title}</p>
                          <p className="text-2xl font-bold text-emerald-600 mt-1">
                            {formatCurrency(deal.value)}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditDeal(deal)}>Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewDetails(deal)}>Ver detalhes</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewDetails(deal)}>Adicionar atividade</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteDeal(deal)}>Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {(deal.contact_name || deal.company_name) && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                              {(deal.contact_name || deal.company_name || "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-sm text-slate-600 truncate">
                            {deal.contact_name || deal.company_name}
                          </div>
                        </div>
                      )}

                      {deal.expected_close_date && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {new Date(deal.expected_close_date).toLocaleDateString("pt-BR")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {getDealsByStage(stage.id).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Target className="h-8 w-8 mb-2" />
                    <p className="text-sm">Nenhum negócio</p>
                    <p className="text-xs">Arraste um card aqui</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deal Detail Modal */}
      <Dialog open={isDealDetailOpen} onOpenChange={setIsDealDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Detalhes do Negócio
            </DialogTitle>
          </DialogHeader>
          {selectedDeal && (
            <div className="space-y-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-800">{selectedDeal.title}</h3>
                <Badge 
                  className="mt-2" 
                  style={{ backgroundColor: selectedDeal.stage_color || '#6366f1' }}
                >
                  {selectedDeal.stage_name}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-500 text-sm">Valor</Label>
                    <p className="text-3xl font-bold text-emerald-600">
                      {formatCurrency(selectedDeal.value)}
                    </p>
                  </div>

                  {selectedDeal.expected_close_date && (
                    <div>
                      <Label className="text-slate-500 text-sm">Data Prevista de Fechamento</Label>
                      <p className="flex items-center gap-2 text-slate-800">
                        <Calendar className="h-4 w-4" />
                        {new Date(selectedDeal.expected_close_date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label className="text-slate-500 text-sm">Status</Label>
                    <p className="text-slate-800 capitalize">{selectedDeal.status}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedDeal.contact_name && (
                    <div>
                      <Label className="text-slate-500 text-sm">Contato</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {selectedDeal.contact_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-slate-800">{selectedDeal.contact_name}</p>
                          {selectedDeal.contact_email && (
                            <p className="text-sm text-slate-500 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {selectedDeal.contact_email}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedDeal.company_name && (
                    <div>
                      <Label className="text-slate-500 text-sm">Empresa</Label>
                      <p className="flex items-center gap-2 text-slate-800">
                        <Building2 className="h-4 w-4" />
                        {selectedDeal.company_name}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label className="text-slate-500 text-sm">Criado em</Label>
                    <p className="text-slate-800">
                      {new Date(selectedDeal.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>

              {selectedDeal.notes && (
                <div>
                  <Label className="text-slate-500 text-sm">Notas</Label>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-lg mt-1">
                    {selectedDeal.notes}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setIsDealDetailOpen(false)}>
                  Fechar
                </Button>
                <Button className="flex-1" data-testid="button-edit-deal" onClick={() => { setIsDealDetailOpen(false); handleEditDeal(selectedDeal); }}>
                  Editar Negócio
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Deal Modal */}
      <Dialog open={isEditDealOpen} onOpenChange={setIsEditDealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Negócio</DialogTitle>
          </DialogHeader>
          {editDeal && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={editDeal.title}
                  onChange={(e) => setEditDeal({ ...editDeal, title: e.target.value })}
                  data-testid="input-edit-title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    type="number"
                    value={editDeal.value || ""}
                    onChange={(e) => setEditDeal({ ...editDeal, value: parseFloat(e.target.value) || 0 })}
                    data-testid="input-edit-value"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Prevista</Label>
                  <Input
                    type="date"
                    value={editDeal.expected_close_date?.split('T')[0] || ""}
                    onChange={(e) => setEditDeal({ ...editDeal, expected_close_date: e.target.value })}
                    data-testid="input-edit-date"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={editDeal.notes || ""}
                  onChange={(e) => setEditDeal({ ...editDeal, notes: e.target.value })}
                  data-testid="input-edit-notes"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsEditDealOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleSaveEdit}
                  disabled={updateDealMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {updateDealMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
