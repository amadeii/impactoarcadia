/**
 * Arcádia Suite — Módulo Decor
 * Hub de Pedidos: /decor/pedidos
 * DEC-06 — Painel + Pedido Técnico
 * v2 — Drag & Drop Kanban + Edição Rápida + Botão Agenda
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus, Search, Loader2, Scissors, Ruler, Package, Truck,
  CheckCircle2, Clock, XCircle, AlertCircle, DollarSign,
  Wrench, Home, ChevronRight, Pencil, Calendar, GripVertical,
} from "lucide-react";
import { Link, useLocation } from "wouter";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; bgColor: string; borderColor: string }> = {
  rascunho:        { label: "Rascunho",         color: "bg-gray-500",    icon: Clock,          bgColor: "bg-gray-50 dark:bg-gray-900/30",        borderColor: "border-gray-400" },
  medicao:         { label: "Medição",           color: "bg-blue-500",    icon: Ruler,          bgColor: "bg-blue-50 dark:bg-blue-900/20",         borderColor: "border-blue-400" },
  orcamento:       { label: "Orçamento",         color: "bg-yellow-500",  icon: DollarSign,     bgColor: "bg-yellow-50 dark:bg-yellow-900/20",     borderColor: "border-yellow-400" },
  analise_tecnica: { label: "Análise Técnica",   color: "bg-purple-500",  icon: AlertCircle,    bgColor: "bg-purple-50 dark:bg-purple-900/20",     borderColor: "border-purple-400" },
  aprovado:        { label: "Aprovado",          color: "bg-indigo-500",  icon: CheckCircle2,   bgColor: "bg-indigo-50 dark:bg-indigo-900/20",     borderColor: "border-indigo-400" },
  efetivado:       { label: "Efetivado",         color: "bg-orange-500",  icon: Package,        bgColor: "bg-orange-50 dark:bg-orange-900/20",     borderColor: "border-orange-400" },
  producao:        { label: "Produção",          color: "bg-cyan-500",    icon: Scissors,       bgColor: "bg-cyan-50 dark:bg-cyan-900/20",         borderColor: "border-cyan-400" },
  instalacao:      { label: "Instalação",        color: "bg-teal-500",    icon: Wrench,         bgColor: "bg-teal-50 dark:bg-teal-900/20",         borderColor: "border-teal-400" },
  concluido:       { label: "Concluído",         color: "bg-green-500",   icon: CheckCircle2,   bgColor: "bg-green-50 dark:bg-green-900/20",       borderColor: "border-green-400" },
  cancelado:       { label: "Cancelado",         color: "bg-red-500",     icon: XCircle,        bgColor: "bg-red-50 dark:bg-red-900/20",           borderColor: "border-red-400" },
};

const STATUS_ORDER = ["rascunho","medicao","orcamento","analise_tecnica","aprovado","efetivado","producao","instalacao","concluido"];

// ─── Dialog Novo Pedido ───────────────────────────────────────────────────────
function NovoPedidoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ clienteNome: "", clienteCpf: "", enderecoObra: "", cidadeObra: "", observacoes: "" });

  const criar = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/modules/decor/pedidos", body),
    onSuccess: () => {
      toast({ title: "Pedido criado", description: "Número gerado automaticamente" });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos"] });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/stats"] });
      onClose();
      setForm({ clienteNome: "", clienteCpf: "", enderecoObra: "", cidadeObra: "", observacoes: "" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo Pedido de Cortinas</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Cliente / Contratante *</Label>
            <Input value={form.clienteNome} onChange={e => setForm(f=>({...f,clienteNome:e.target.value}))} placeholder="Nome do cliente" data-testid="input-decor-cliente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CPF/CNPJ</Label>
              <Input value={form.clienteCpf} onChange={e => setForm(f=>({...f,clienteCpf:e.target.value}))} placeholder="000.000.000-00" data-testid="input-decor-cpf" />
            </div>
            <div>
              <Label>Cidade da Obra</Label>
              <Input value={form.cidadeObra} onChange={e => setForm(f=>({...f,cidadeObra:e.target.value}))} placeholder="Cidade" data-testid="input-decor-cidade" />
            </div>
          </div>
          <div>
            <Label>Endereço da Obra</Label>
            <Input value={form.enderecoObra} onChange={e => setForm(f=>({...f,enderecoObra:e.target.value}))} placeholder="Rua, nº, bairro" data-testid="input-decor-endereco" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f=>({...f,observacoes:e.target.value}))} rows={2} placeholder="Anotações iniciais..." data-testid="input-decor-obs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => criar.mutate(form)} disabled={!form.clienteNome || criar.isPending} data-testid="btn-decor-criar-pedido">
            {criar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar Pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog Edição Rápida ─────────────────────────────────────────────────────
function EditarPedidoDialog({ pedido, open, onClose }: { pedido: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    cliente_nome:   pedido?.cliente_nome   ?? "",
    cliente_cpf:    pedido?.cliente_cpf    ?? "",
    cidade_obra:    pedido?.cidade_obra    ?? "",
    endereco_obra:  pedido?.endereco_obra  ?? "",
    vendedor_nome:  pedido?.vendedor_nome  ?? "",
    data_medicao:   pedido?.data_medicao   ? pedido.data_medicao.split("T")[0] : "",
    data_instalacao:pedido?.data_instalacao? pedido.data_instalacao.split("T")[0] : "",
    observacoes:    pedido?.observacoes    ?? "",
  });

  const salvar = useMutation({
    mutationFn: (body: any) => apiRequest("PATCH", `/api/modules/decor/pedidos/${pedido.id}`, body),
    onSuccess: () => {
      toast({ title: "Pedido atualizado" });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (!pedido) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Editar Pedido — <span className="font-mono text-sm">{pedido.numero_pedido}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cliente *</Label>
            <Input value={form.cliente_nome} onChange={e => setForm(f=>({...f,cliente_nome:e.target.value}))} placeholder="Nome do cliente" data-testid="edit-input-cliente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CPF/CNPJ</Label>
              <Input value={form.cliente_cpf} onChange={e => setForm(f=>({...f,cliente_cpf:e.target.value}))} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>Vendedor</Label>
              <Input value={form.vendedor_nome} onChange={e => setForm(f=>({...f,vendedor_nome:e.target.value}))} placeholder="Nome do vendedor" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cidade da Obra</Label>
              <Input value={form.cidade_obra} onChange={e => setForm(f=>({...f,cidade_obra:e.target.value}))} placeholder="Cidade" />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={form.endereco_obra} onChange={e => setForm(f=>({...f,endereco_obra:e.target.value}))} placeholder="Rua, nº" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data Medição</Label>
              <Input type="date" value={form.data_medicao} onChange={e => setForm(f=>({...f,data_medicao:e.target.value}))} />
            </div>
            <div>
              <Label>Data Instalação</Label>
              <Input type="date" value={form.data_instalacao} onChange={e => setForm(f=>({...f,data_instalacao:e.target.value}))} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f=>({...f,observacoes:e.target.value}))} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvar.mutate(form)} disabled={!form.cliente_nome || salvar.isPending} data-testid="btn-decor-salvar-edicao">
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card de pedido (draggable) ───────────────────────────────────────────────
function PedidoCard({
  p,
  onEdit,
  onDragStart,
}: {
  p: any;
  onEdit: (p: any) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG["rascunho"];
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, p.id)}
      className={`rounded-lg border p-3 mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none ${cfg.bgColor} group relative`}
      data-testid={`card-decor-pedido-${p.id}`}
    >
      {/* Drag handle hint */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-30 transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Botão editar */}
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit(p); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10 z-10"
        data-testid={`btn-editar-pedido-${p.id}`}
        title="Editar pedido"
      >
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* Conteúdo clicável que abre o detalhe */}
      <Link href={`/decor/pedidos/${p.id}`} onClick={e => e.stopPropagation()}>
        <div className="pl-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono font-semibold text-muted-foreground">{p.numero_pedido}</span>
            <Badge className={`${cfg.color} text-white text-xs py-0 h-5 mr-6`}>{cfg.label}</Badge>
          </div>
          <p className="font-medium text-sm truncate">{p.cliente_nome ?? "—"}</p>
          {p.cidade_obra && <p className="text-xs text-muted-foreground truncate">{p.cidade_obra}</p>}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-semibold text-green-600">
              {parseFloat(p.valor_final || "0").toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
            {p.data_instalacao && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(p.data_instalacao + "T12:00:00").toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

// ─── Coluna Kanban ────────────────────────────────────────────────────────────
function KanbanColuna({
  status,
  pedidos,
  onEdit,
  onDragStart,
  onDrop,
  highlight = false,
}: {
  status: string;
  pedidos: any[];
  onEdit: (p: any) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, toStatus: string) => void;
  highlight?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const valorTotal = pedidos.reduce((s, p) => s + parseFloat(p.valor_final || "0"), 0);

  return (
    <div
      className={`flex-1 min-w-[210px] transition-all ${highlight ? "ring-2 ring-offset-2 rounded-lg " + cfg.borderColor : ""}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { setDragOver(false); onDrop(e, status); }}
    >
      {/* Cabeçalho da coluna */}
      <div className={`flex items-center gap-2 mb-1 px-3 py-2 rounded-t-lg border-t-4 ${cfg.bgColor} ${cfg.borderColor}`}>
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-bold truncate">{cfg.label}</span>
        <Badge
          className={`ml-auto text-xs flex-shrink-0 ${cfg.color} text-white border-0`}
        >
          {pedidos.length}
        </Badge>
      </div>
      <div className="text-xs font-medium text-muted-foreground px-2 mb-2 h-4">
        {valorTotal > 0 ? valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
      </div>

      {/* Drop zone */}
      <div
        className={`min-h-[120px] rounded-b-lg transition-all p-1 ${
          dragOver
            ? `ring-2 ring-offset-1 ring-blue-400 ${cfg.bgColor} bg-opacity-70`
            : ""
        }`}
      >
        {pedidos.map(p => (
          <PedidoCard key={p.id} p={p} onEdit={onEdit} onDragStart={onDragStart} />
        ))}
        {pedidos.length === 0 && (
          <div className={`border-2 border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground transition-colors ${dragOver ? "border-blue-400 bg-blue-50/50" : ""}`}>
            {dragOver ? "⬇ Soltar aqui" : "Nenhum pedido"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function DecorPedidos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [busca, setBusca] = useState("");
  // statusFiltro: "todos" | um status específico (kanban = filtro de colunas visíveis; lista = filtro API)
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [showNovo, setShowNovo] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
  const [pedidoEditando, setPedidoEditando] = useState<any>(null);
  const draggingId = useRef<string | null>(null);

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/modules/decor/stats"],
    queryFn: () => apiRequest("GET", "/api/modules/decor/stats").then(r => r.json()),
    refetchInterval: 30000,
  });

  // Kanban sempre busca todos; lista respeita filtro
  const { data: pedidosData, isLoading } = useQuery<any>({
    queryKey: ["/api/modules/decor/pedidos", busca, viewMode === "lista" ? statusFiltro : "todos"],
    queryFn: () => {
      const params = new URLSearchParams();
      if (busca) params.set("q", busca);
      if (viewMode === "lista" && statusFiltro !== "todos") params.set("status", statusFiltro);
      params.set("limit", "200");
      return apiRequest("GET", `/api/modules/decor/pedidos?${params}`).then(r => r.json());
    },
  });

  const moverStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/modules/decor/pedidos/${id}`, { status }),
    onSuccess: (_, vars) => {
      const label = STATUS_CONFIG[vars.status]?.label ?? vars.status;
      toast({ title: `Movido para ${label}` });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos"] });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/stats"] });
    },
    onError: (e: any) => toast({ title: "Erro ao mover", description: e.message, variant: "destructive" }),
  });

  const pedidos: any[] = pedidosData?.pedidos ?? [];

  const pedidosPorStatus = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = pedidos.filter(p => p.status === s);
    return acc;
  }, {} as Record<string, any[]>);

  // Contagens locais para os pills
  const contagemLocal: Record<string, number> = {};
  pedidos.forEach(p => { contagemLocal[p.status] = (contagemLocal[p.status] ?? 0) + 1; });

  const statsPorStatus: Record<string, { total: number; valor: number }> = {};
  (stats?.por_status ?? []).forEach((s: any) => {
    statsPorStatus[s.status] = { total: parseInt(s.total), valor: parseFloat(s.valor) };
  });

  // Colunas visíveis no Kanban
  const colunasFiltradas = statusFiltro === "todos"
    ? STATUS_ORDER
    : STATUS_ORDER.filter(s => s === statusFiltro);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    draggingId.current = id;
    e.dataTransfer.setData("pedidoId", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, toStatus: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("pedidoId") || draggingId.current;
    if (!id) return;
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido || pedido.status === toStatus) return;
    moverStatus.mutate({ id, status: toStatus });
    draggingId.current = null;
  };

  return (
    <BrowserFrame title="Decor — Hub de Pedidos" path="/decor/pedidos">
      <div className="p-4 space-y-4">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Home className="h-4 w-4" />
          <ChevronRight className="h-3 w-3" />
          <span>Módulos</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Decoração — Pedidos</span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total Pedidos (ativos)</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.total_pedidos ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Pipeline Total</p>
              <p className="text-xl font-bold text-green-600">
                {(stats?.pipeline ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Em Produção</p>
              <p className="text-2xl font-bold text-cyan-600">{statsPorStatus["producao"]?.total ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Aguardando Instalação</p>
              <p className="text-2xl font-bold text-teal-600">{statsPorStatus["instalacao"]?.total ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar superior: busca + ações */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por cliente ou número..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              data-testid="input-decor-busca"
            />
          </div>
          <div className="flex gap-1 border rounded-md p-1">
            <Button size="sm" variant={viewMode === "kanban" ? "default" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setViewMode("kanban")}>Kanban</Button>
            <Button size="sm" variant={viewMode === "lista" ? "default" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setViewMode("lista")}>Lista</Button>
          </div>
          <Button
            variant="outline"
            className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => navigate("/decor/agenda")}
            data-testid="btn-agenda-instalacao"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Agenda</span>
          </Button>
          <Button onClick={() => setShowNovo(true)} className="gap-1.5" data-testid="btn-decor-novo-pedido">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Pedido</span>
          </Button>
        </div>

        {/* ── Pills de filtro por status ──────────────────────────────────────── */}
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5 min-w-max">
            {/* Pill "Todos" */}
            <button
              onClick={() => setStatusFiltro("todos")}
              data-testid="pill-status-todos"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                statusFiltro === "todos"
                  ? "bg-gray-800 text-white border-gray-800 shadow-sm"
                  : "bg-white dark:bg-gray-900 text-gray-600 border-gray-300 hover:border-gray-500"
              }`}
            >
              Todos
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                statusFiltro === "todos" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
              }`}>
                {pedidos.length || stats?.total_pedidos || 0}
              </span>
            </button>

            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5" />

            {[...STATUS_ORDER, "cancelado"].map(s => {
              const cfg = STATUS_CONFIG[s];
              const count = contagemLocal[s] ?? statsPorStatus[s]?.total ?? 0;
              const isActive = statusFiltro === s;
              const Icon = cfg.icon;
              // Extrai a cor base do Tailwind para aplicar inline
              const colorMap: Record<string, string> = {
                "bg-gray-500": "#6b7280",
                "bg-blue-500": "#3b82f6",
                "bg-yellow-500": "#eab308",
                "bg-purple-500": "#a855f7",
                "bg-indigo-500": "#6366f1",
                "bg-orange-500": "#f97316",
                "bg-cyan-500": "#06b6d4",
                "bg-teal-500": "#14b8a6",
                "bg-green-500": "#22c55e",
                "bg-red-500": "#ef4444",
              };
              const hex = colorMap[cfg.color] ?? "#6b7280";

              return (
                <button
                  key={s}
                  onClick={() => setStatusFiltro(isActive ? "todos" : s)}
                  data-testid={`pill-status-${s}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                    isActive
                      ? "text-white shadow-md scale-105 border-transparent"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:scale-105 hover:shadow-sm"
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: hex, borderColor: hex }
                      : { borderColor: `${hex}60` }
                  }
                >
                  <Icon className="h-3 w-3" style={{ color: isActive ? "white" : hex }} />
                  {cfg.label}
                  {count > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold"
                      style={
                        isActive
                          ? { backgroundColor: "rgba(255,255,255,0.25)", color: "white" }
                          : { backgroundColor: `${hex}20`, color: hex }
                      }
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* KANBAN VIEW */}
        {!isLoading && viewMode === "kanban" && (
          <div className="overflow-x-auto pb-4">
            <div
              className="flex gap-3"
              style={{ minWidth: statusFiltro === "todos" ? `${STATUS_ORDER.length * 220}px` : "100%" }}
            >
              {colunasFiltradas.map(status => (
                <KanbanColuna
                  key={status}
                  status={status}
                  pedidos={pedidosPorStatus[status] ?? []}
                  onEdit={setPedidoEditando}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  highlight={statusFiltro === status}
                />
              ))}
            </div>
          </div>
        )}

        {/* LISTA VIEW */}
        {!isLoading && viewMode === "lista" && (
          <div className="space-y-2">
            {pedidos.length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum pedido encontrado</CardContent></Card>
            )}
            {pedidos.map(p => {
              const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG["rascunho"];
              const Icon = cfg.icon;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:shadow-sm transition-shadow group"
                  data-testid={`row-decor-pedido-${p.id}`}
                >
                  <div className={`w-2.5 h-12 rounded-full ${cfg.color} flex-shrink-0`} />
                  <Link href={`/decor/pedidos/${p.id}`} className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{p.numero_pedido}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white ${cfg.color}`}
                        >
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="font-medium text-sm truncate">{p.cliente_nome ?? "—"}</p>
                      {p.cidade_obra && <p className="text-xs text-muted-foreground">{p.cidade_obra}</p>}
                    </div>
                    <div className="text-right hidden sm:block pr-2">
                      <p className="font-semibold text-sm text-green-600">
                        {parseFloat(p.valor_final || "0").toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                      {p.data_instalacao && (
                        <p className="text-xs text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {new Date(p.data_instalacao + "T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => setPedidoEditando(p)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted flex-shrink-0"
                    data-testid={`btn-editar-lista-${p.id}`}
                    title="Editar pedido"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <NovoPedidoDialog open={showNovo} onClose={() => setShowNovo(false)} />
        <EditarPedidoDialog
          pedido={pedidoEditando}
          open={!!pedidoEditando}
          onClose={() => setPedidoEditando(null)}
        />
      </div>
    </BrowserFrame>
  );
}
