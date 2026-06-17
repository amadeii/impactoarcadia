/**
 * Arcádia Suite — Módulo Decor
 * DEC-10 — Catálogo de Tecidos, Trilhos e Sistemas
 * /decor/catalogo
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Search, Plus, Loader2, Package, AlertTriangle, CheckCircle2,
  XCircle, Clock, Home, ChevronRight, RefreshCw, Edit
} from "lucide-react";
import { Link } from "wouter";

const CATEGORIAS = [
  { value: "tecido",     label: "Tecido" },
  { value: "trilho",     label: "Trilho / Varão" },
  { value: "persiana",   label: "Persiana" },
  { value: "acessorio",  label: "Acessório" },
  { value: "servico",    label: "Serviço" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ativo:      { label: "Ativo",       color: "bg-green-500",  icon: CheckCircle2 },
  em_falta:   { label: "Em falta",    color: "bg-orange-500", icon: AlertTriangle },
  descontinuado: { label: "Descont.", color: "bg-red-500",    icon: XCircle },
  previsao:   { label: "Previsão",    color: "bg-blue-500",   icon: Clock },
};

// ─── Dialog criar/editar item ─────────────────────────────────────────────────
function ItemDialog({ open, item, onClose }: { open: boolean; item?: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({
    codigo: item?.codigo ?? "",
    nome: item?.nome ?? "",
    descricao: item?.descricao ?? "",
    categoria: item?.categoria ?? "tecido",
    colecao: item?.colecao ?? "",
    unidade: item?.unidade ?? "m",
    valor_unitario: item?.valor_unitario ?? "0",
    status_comercial: item?.status_comercial ?? "ativo",
    data_previsao: item?.data_previsao?.split("T")[0] ?? "",
    ncm: item?.ncm ?? "",
  });

  const mutation = useMutation({
    mutationFn: (body: any) => item?.id
      ? apiRequest("PATCH", `/api/modules/decor/catalogo/${item.id}`, body)
      : apiRequest("POST", "/api/modules/decor/catalogo", body),
    onSuccess: () => {
      toast({ title: item?.id ? "Item atualizado" : "Item criado" });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/catalogo/resumo"] });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/catalogo"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{item?.id ? "Editar Item" : "Novo Item do Catálogo"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Código *</Label>
            <Input value={f.codigo} onChange={e => setF(p => ({ ...p, codigo: e.target.value }))} placeholder="TC-001" data-testid="input-cat-codigo" />
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={f.categoria} onValueChange={v => setF(p => ({ ...p, categoria: v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Nome *</Label>
            <Input value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do produto" data-testid="input-cat-nome" />
          </div>
          <div>
            <Label className="text-xs">Coleção / Linha</Label>
            <Input value={f.colecao} onChange={e => setF(p => ({ ...p, colecao: e.target.value }))} placeholder="Ex: Premium, Linho..." />
          </div>
          <div>
            <Label className="text-xs">Unidade</Label>
            <Select value={f.unidade} onValueChange={v => setF(p => ({ ...p, unidade: v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="m">Metro (m)</SelectItem>
                <SelectItem value="m2">m²</SelectItem>
                <SelectItem value="un">Unidade</SelectItem>
                <SelectItem value="pc">Peça</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor unitário (R$)</Label>
            <Input type="number" step="0.01" value={f.valor_unitario} onChange={e => setF(p => ({ ...p, valor_unitario: e.target.value }))} data-testid="input-cat-valor" />
          </div>
          <div>
            <Label className="text-xs">Status comercial</Label>
            <Select value={f.status_comercial} onValueChange={v => setF(p => ({ ...p, status_comercial: v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="em_falta">Em falta</SelectItem>
                <SelectItem value="previsao">Com previsão</SelectItem>
                <SelectItem value="descontinuado">Descontinuado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {f.status_comercial === "previsao" && (
            <div>
              <Label className="text-xs">Data previsão</Label>
              <Input type="date" value={f.data_previsao} onChange={e => setF(p => ({ ...p, data_previsao: e.target.value }))} />
            </div>
          )}
          <div>
            <Label className="text-xs">NCM (fiscal)</Label>
            <Input value={f.ncm} onChange={e => setF(p => ({ ...p, ncm: e.target.value }))} placeholder="0000.00.00" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Descrição</Label>
            <Input value={f.descricao} onChange={e => setF(p => ({ ...p, descricao: e.target.value }))} placeholder="Descrição opcional..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate(f)} disabled={!f.nome || !f.codigo || mutation.isPending} data-testid="btn-cat-salvar">
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {item?.id ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card de item ─────────────────────────────────────────────────────────────
function ItemCard({ item, onEdit }: { item: any; onEdit: (i: any) => void }) {
  const cfg = STATUS_CONFIG[item.status_comercial] ?? STATUS_CONFIG["ativo"];
  const Icon = cfg.icon;
  const comprometido = parseFloat(item.metragem_comprometida ?? "0");

  return (
    <Card className="hover:shadow-sm transition-shadow" data-testid={`card-cat-${item.id}`}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Badge variant="outline" className="text-xs font-mono">{item.codigo}</Badge>
              <Badge className={`${cfg.color} text-white text-xs py-0 h-5`}>
                <Icon className="h-3 w-3 mr-1" />{cfg.label}
              </Badge>
            </div>
            <p className="font-medium text-sm truncate">{item.nome}</p>
            {item.colecao && <p className="text-xs text-muted-foreground">{item.colecao}</p>}
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => onEdit(item)} data-testid={`btn-edit-cat-${item.id}`}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="text-sm font-semibold text-green-600">
            R$ {parseFloat(item.valor_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/{item.unidade}
          </div>
          {comprometido > 0 && (
            <div className="text-xs text-orange-600 font-medium flex items-center gap-1">
              <Package className="h-3 w-3" />
              {comprometido.toFixed(2)}m comprometidos
            </div>
          )}
        </div>
        {item.data_previsao && (
          <p className="text-xs text-blue-600 mt-1">
            Previsão: {new Date(item.data_previsao).toLocaleDateString("pt-BR")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function DecorCatalogo() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [categFiltro, setCategFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const { data: catalogo, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/modules/decor/catalogo/resumo"],
    queryFn: () => apiRequest("GET", "/api/modules/decor/catalogo/resumo").then(r => r.json()),
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/modules/decor/admin/seed-catalogo"),
    onSuccess: (d: any) => {
      toast({ title: "Seed executado", description: `${d.itens_catalogo ?? 0} itens, ${d.coeficientes ?? 0} coeficientes` });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/catalogo/resumo"] });
    },
    onError: (e: any) => toast({ title: "Erro no seed", description: e.message, variant: "destructive" }),
  });

  const itens = (catalogo ?? []).filter(i => {
    if (categFiltro !== "todos" && i.categoria !== categFiltro) return false;
    if (statusFiltro !== "todos" && i.status_comercial !== statusFiltro) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return i.nome?.toLowerCase().includes(q) || i.codigo?.toLowerCase().includes(q) || i.colecao?.toLowerCase().includes(q);
    }
    return true;
  });

  const porCategoria: Record<string, any[]> = {};
  for (const item of itens) {
    const cat = item.categoria ?? "outros";
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(item);
  }

  const countEmFalta = (catalogo ?? []).filter(i => i.status_comercial === "em_falta").length;
  const countAtivos = (catalogo ?? []).filter(i => i.status_comercial === "ativo").length;

  return (
    <BrowserFrame title="Decor — Catálogo" path="/decor/catalogo">
      <div className="p-4 space-y-4">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Home className="h-4 w-4" />
          <ChevronRight className="h-3 w-3" />
          <Link href="/decor/pedidos"><span className="hover:text-foreground cursor-pointer">Decoração</span></Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Catálogo</span>
        </div>

        {/* Alertas rápidos */}
        {countEmFalta > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 text-sm text-orange-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span><strong>{countEmFalta}</strong> item(s) em falta no estoque</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, código ou coleção..." value={busca} onChange={e => setBusca(e.target.value)} data-testid="input-cat-busca" />
          </div>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={categFiltro} onChange={e => setCategFiltro(e.target.value)} data-testid="select-cat-categ">
            <option value="todos">Todas categorias</option>
            {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="gap-1" data-testid="btn-cat-seed">
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "📥"} Seed
          </Button>
          <Button onClick={() => { setEditItem(null); setShowDialog(true); }} className="gap-2" data-testid="btn-cat-novo">
            <Plus className="h-4 w-4" /> Novo Item
          </Button>
        </div>

        {/* Stats */}
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{itens.length}</span> itens exibidos ·
          <span className="text-green-600 font-medium">{countAtivos} ativos</span>
          {countEmFalta > 0 && <span className="text-orange-500 font-medium">· {countEmFalta} em falta</span>}
        </div>

        {/* Loading */}
        {isLoading && <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}

        {/* Grid por categoria */}
        {!isLoading && (
          <Tabs defaultValue="todos" className="space-y-4">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="todos" className="text-xs">Todos ({itens.length})</TabsTrigger>
              {CATEGORIAS.filter(c => porCategoria[c.value]?.length).map(c => (
                <TabsTrigger key={c.value} value={c.value} className="text-xs">
                  {c.label} ({porCategoria[c.value]?.length ?? 0})
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="todos">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {itens.map(item => (
                  <ItemCard key={item.id} item={item} onEdit={i => { setEditItem(i); setShowDialog(true); }} />
                ))}
                {itens.length === 0 && (
                  <div className="col-span-full text-center py-10 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum item no catálogo.</p>
                    <p className="text-sm mt-1">Use o botão "Seed" para carregar os itens padrão.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {CATEGORIAS.map(cat => (
              <TabsContent key={cat.value} value={cat.value}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {(porCategoria[cat.value] ?? []).map(item => (
                    <ItemCard key={item.id} item={item} onEdit={i => { setEditItem(i); setShowDialog(true); }} />
                  ))}
                  {!(porCategoria[cat.value]?.length) && (
                    <div className="col-span-full text-center py-8 text-muted-foreground text-sm">Nenhum item nesta categoria</div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        <ItemDialog open={showDialog} item={editItem} onClose={() => { setShowDialog(false); setEditItem(null); }} />
      </div>
    </BrowserFrame>
  );
}
