/**
 * Arcádia Suite — Módulo Decor
 * DEC-06 / DEC-EXP-04/05/06 — Detalhe do Pedido (11 abas)
 */
import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ConfiguradorSelector } from "@/components/decor/ConfiguradorSelector";
import { DecorCapaPedido } from "@/pages/DecorCapaPedido";
import { OsProducaoPanel } from "@/pages/DecorOsProducao";
import { OsInstalacaoPanel } from "@/pages/DecorOsInstalacao";
import {
  Home, ChevronRight, Loader2, Plus, CheckCircle2, XCircle,
  ArrowRight, Edit, DollarSign, Scissors, Wrench, ClipboardList,
  AlertCircle, Ruler, Package, Calendar, CreditCard,
  FileText, Blinds, Building2, Phone, Mail, Cake, Clock,
  Truck, ChevronDown, RefreshCw
} from "lucide-react";
import { Link } from "wouter";

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho:        { label: "Rascunho",        color: "bg-gray-500" },
  medicao:         { label: "Medição",          color: "bg-blue-500" },
  orcamento:       { label: "Orçamento",        color: "bg-yellow-500" },
  analise_tecnica: { label: "Análise Técnica",  color: "bg-purple-500" },
  aprovado:        { label: "Aprovado",         color: "bg-indigo-500" },
  efetivado:       { label: "Efetivado",        color: "bg-orange-500" },
  producao:        { label: "Produção",         color: "bg-cyan-500" },
  instalacao:      { label: "Instalação",       color: "bg-teal-500" },
  concluido:       { label: "Concluído",        color: "bg-green-500" },
  cancelado:       { label: "Cancelado",        color: "bg-red-500" },
};

const PROXIMOS_STATUS: Record<string, string[]> = {
  rascunho:        ["medicao", "cancelado"],
  medicao:         ["orcamento", "cancelado"],
  orcamento:       ["analise_tecnica", "aprovado", "cancelado"],
  analise_tecnica: ["aprovado", "medicao", "cancelado"],
  aprovado:        ["efetivado", "cancelado"],
  efetivado:       ["producao"],
  producao:        ["instalacao"],
  instalacao:      ["concluido"],
};

const FORMA_PGTO: Record<string, string> = {
  "01": "Dinheiro", "02": "Cheque", "03": "Cartão de Crédito",
  "04": "Cartão de Débito", "17": "PIX", "99": "Outros",
};

const STATUS_FORNECEDOR: Record<string, { label: string; color: string }> = {
  solicitado:  { label: "Solicitado",   color: "bg-blue-400" },
  confirmado:  { label: "Confirmado",   color: "bg-indigo-500" },
  em_producao: { label: "Em produção",  color: "bg-yellow-500" },
  enviado:     { label: "Enviado",      color: "bg-orange-500" },
  recebido:    { label: "Recebido",     color: "bg-green-500" },
  divergente:  { label: "Divergente",   color: "bg-red-500" },
};

// ─── CheckItem ────────────────────────────────────────────────────────────────
function CheckItem({ label, done, onToggle }: { label: string; done: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 w-full text-left">
      {done
        ? <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
        : <div className="h-5 w-5 rounded-full border-2 border-gray-300 flex-shrink-0" />}
      <span className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{label}</span>
    </button>
  );
}

// ─── Status OS Instalação ─────────────────────────────────────────────────────
const OS_INST_STATUS: Record<string, { label: string; color: string }> = {
  pendente:   { label: "Pendente",   color: "bg-gray-400" },
  agendada:   { label: "Agendada",   color: "bg-blue-500" },
  confirmada: { label: "Confirmada", color: "bg-indigo-500" },
  em_campo:   { label: "Em campo",   color: "bg-yellow-500" },
  concluida:  { label: "Concluída",  color: "bg-green-500" },
  reagendada: { label: "Reagendada", color: "bg-orange-400" },
  cancelada:  { label: "Cancelada",  color: "bg-red-500" },
};

function AgendaInstalacaoCard({
  osInstalacao,
  onVerOS,
}: {
  osInstalacao: any[];
  onVerOS: () => void;
}) {
  if (!osInstalacao || osInstalacao.length === 0) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Agenda de Instalação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhuma OS de instalação criada ainda.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={onVerOS}>
            <Clock className="h-3.5 w-3.5 mr-1" /> Criar OS Instalação
          </Button>
        </CardContent>
      </Card>
    );
  }

  // pega a OS mais relevante: primeiro em_campo, depois agendada/confirmada, senão a última
  const os =
    osInstalacao.find(o => o.status === "em_campo") ??
    osInstalacao.find(o => ["agendada", "confirmada"].includes(o.status)) ??
    osInstalacao[osInstalacao.length - 1];

  const cfg = OS_INST_STATUS[os.status] ?? { label: os.status, color: "bg-gray-400" };
  const totalOs = osInstalacao.length;

  const checklist = [
    { key: "checklist_ambiente_apto", label: "Ambiente pronto" },
    { key: "checklist_produtos_ok",   label: "Produtos OK" },
    { key: "checklist_energia_ok",    label: "Energia disponível" },
    { key: "checklist_limpeza_ok",    label: "Limpeza concluída" },
  ];
  const checkDone = checklist.filter(c => os[c.key]).length;

  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Agenda de Instalação
            {totalOs > 1 && (
              <span className="text-xs text-muted-foreground font-normal">({totalOs} OS)</span>
            )}
          </span>
          <Badge className={`${cfg.color} text-white text-xs`}>{cfg.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {os.data_agendamento ? (
            <div>
              <span className="text-muted-foreground">Data:</span>{" "}
              <strong>{new Date(os.data_agendamento + "T12:00:00").toLocaleDateString("pt-BR")}</strong>
            </div>
          ) : (
            <div className="text-muted-foreground">Data: —</div>
          )}
          {os.hora_agendamento && (
            <div>
              <span className="text-muted-foreground">Horário:</span>{" "}
              <strong>{os.hora_agendamento}</strong>
            </div>
          )}
          {os.instalador_nome && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Instalador:</span>{" "}
              <strong>{os.instalador_nome}</strong>
              {os.instalador_fone && (
                <span className="ml-2 text-muted-foreground text-xs">({os.instalador_fone})</span>
              )}
            </div>
          )}
          {os.duracao_estimada_h && (
            <div>
              <span className="text-muted-foreground">Duração est.:</span>{" "}
              {os.duracao_estimada_h}h
            </div>
          )}
          {os.regiao && (
            <div>
              <span className="text-muted-foreground">Região:</span> {os.regiao}
            </div>
          )}
        </div>

        {/* Checklist rápido */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">
            Checklist pré-instalação ({checkDone}/{checklist.length})
          </p>
          <div className="grid grid-cols-2 gap-1">
            {checklist.map(c => (
              <div key={c.key} className="flex items-center gap-1.5 text-xs">
                {os[c.key]
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  : <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                <span className={os[c.key] ? "text-muted-foreground line-through" : ""}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fotos / confirmação */}
        <div className="flex flex-wrap gap-2 text-xs">
          {os.confirmado_cliente && (
            <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
              ✓ Cliente confirmou
            </Badge>
          )}
          {os.whatsapp_enviado && (
            <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
              ✓ WhatsApp enviado
            </Badge>
          )}
          {os.foto_antes_url && (
            <Badge variant="outline" className="text-xs">📷 Foto antes</Badge>
          )}
          {os.foto_depois_url && (
            <Badge variant="outline" className="text-xs">📷 Foto depois</Badge>
          )}
        </div>

        {os.observacoes && (
          <p className="text-xs text-muted-foreground border-t pt-2">{os.observacoes}</p>
        )}

        <Button size="sm" variant="outline" className="w-full" onClick={onVerOS} data-testid="btn-ver-os-instalacao">
          <Wrench className="h-3.5 w-3.5 mr-1.5" /> Ver OS de Instalação completa
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function DecorPedidoDetalhe() {
  const [, params] = useRoute("/decor/pedidos/:id");
  const id = params?.id ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [abaAtiva, setAbaAtiva] = useState("visao-geral");
  const [showMudarStatus, setShowMudarStatus] = useState(false);
  const [novoStatus, setNovoStatus] = useState("");
  const [showEfetivar, setShowEfetivar] = useState(false);
  const [showNovaMedicao, setShowNovaMedicao] = useState(false);
  const [showNovaAnalise, setShowNovaAnalise] = useState(false);
  const [showNovoFornecedor, setShowNovoFornecedor] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: pedido, isLoading } = useQuery<any>({
    queryKey: ["/api/modules/decor/pedidos", id],
    queryFn: () => apiRequest("GET", `/api/modules/decor/pedidos/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: parcelas = [] } = useQuery<any[]>({
    queryKey: ["/api/modules/decor/pedidos", id, "parcelas"],
    queryFn: () => apiRequest("GET", `/api/modules/decor/pedidos/${id}/parcelas`).then(r => r.json()),
    enabled: !!id && abaAtiva === "financeiro",
  });

  const { data: fornecedoresPedido = [], refetch: refetchFornecedores } = useQuery<any[]>({
    queryKey: ["/api/modules/decor/pedidos", id, "fornecedores"],
    queryFn: () => apiRequest("GET", `/api/modules/decor/pedidos/${id}/fornecedores-pedido`).then(r => r.json()),
    enabled: !!id && abaAtiva === "fornecedores",
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const atualizarStatus = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/modules/decor/pedidos/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", id] }); toast({ title: "Status atualizado" }); setShowMudarStatus(false); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const efetivar = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/modules/decor/pedidos/${id}/efetivar`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", id] }); toast({ title: "Pedido efetivado!" }); setShowEfetivar(false); },
    onError: (e: any) => toast({ title: "Erro ao efetivar", description: e.message, variant: "destructive" }),
  });

  const efetivarV2 = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/modules/decor/pedidos/${id}/efetivar-v2`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", id] });
      qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", id, "parcelas"] });
      toast({ title: "Pedido efetivado!", description: "Parcelas e ARs criados." });
      setShowEfetivar(false);
    },
    onError: (e: any) => toast({ title: "Erro ao efetivar", description: e.message, variant: "destructive" }),
  });

  const novaMedicao = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/modules/decor/pedidos/${id}/medicoes`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", id] }); toast({ title: "Medição adicionada" }); setShowNovaMedicao(false); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const addItem = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/modules/decor/pedidos/${id}/itens`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", id] }); toast({ title: "Item adicionado" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => apiRequest("DELETE", `/api/modules/decor/pedidos/${id}/itens/${itemId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", id] }); toast({ title: "Item removido" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const novaAnalise = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/modules/decor/pedidos/${id}/analise-tecnica`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", id] }); toast({ title: "Análise registrada" }); setShowNovaAnalise(false); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const atualizarChecklist = useMutation({
    mutationFn: (body: any) => apiRequest("PATCH", `/api/modules/decor/pedidos/${id}/checklist`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", id] }),
  });

  const addFornecedor = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/modules/decor/pedidos/${id}/fornecedores-pedido`, body),
    onSuccess: () => { refetchFornecedores(); toast({ title: "Fornecedor adicionado" }); setShowNovoFornecedor(false); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateFornecedor = useMutation({
    mutationFn: ({ fpId, body }: { fpId: string; body: any }) =>
      apiRequest("PATCH", `/api/modules/decor/pedidos/${id}/fornecedores-pedido/${fpId}`, body),
    onSuccess: () => { refetchFornecedores(); toast({ title: "Status atualizado" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── Guards ────────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <BrowserFrame title="Carregando pedido..." path={`/decor/pedidos/${id}`}>
      <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    </BrowserFrame>
  );
  if (!pedido) return (
    <BrowserFrame title="Pedido não encontrado" path={`/decor/pedidos/${id}`}>
      <div className="p-6 text-center text-muted-foreground">Pedido não encontrado. <Link href="/decor/pedidos">Voltar à lista</Link></div>
    </BrowserFrame>
  );

  const cfg = STATUS_CONFIG[pedido.status] ?? STATUS_CONFIG["rascunho"];
  const proximos = PROXIMOS_STATUS[pedido.status] ?? [];
  const checklist = pedido.checklist ?? {};

  // handler unificado — usado pelo ConfiguradorSelector
  const handleAddItem = (item: any) => addItem.mutate({
    tipoProduto: item.tipoProduto, produto: item.produto, sistema: item.sistema,
    tecido: item.tecido, ambiente: item.ambiente,
    largura: item.largura, altura: item.altura, comprimento: item.comprimento,
    quantidade: item.quantidade, coeficiente: item.coeficiente ?? 1,
    metragemTecido: item.metragemTecido,
    valorUnitario: item.valorUnitario, valorMaoObra: item.valorMaoObra,
    // Persiana
    fornecedorPersiana: item.fornecedorPersiana, colecaoCor: item.colecaoCor,
    acabamento: item.acabamento, corPecas: item.corPecas, altComando: item.altComando,
    ladoALado: item.ladoALado, acionamento: item.acionamento,
    tipoInstalacao: item.tipoInstalacao, ladoComando: item.ladoComando,
    // Wave
    divisaoA: item.divisaoA, divisaoB: item.divisaoB, modeloCortina: item.modeloCortina,
    tecidoCodigo: item.tecidoCodigo, tecidoLado: item.tecidoLado,
    tecidoForroCodigo: item.tecidoForroCodigo, tecidoForroLadoA: item.tecidoForroLadoA,
    tecidoForroLadoB: item.tecidoForroLadoB, barraCodigo: item.barraCodigo,
    barraObservacao: item.barraObservacao, barraMedida: item.barraMedida,
    barraDetalhes: item.barraDetalhes, altForro: item.altForro,
    trilhoTipo: item.trilhoTipo, trilhoMedida: item.trilhoMedida,
    cortineiroTipo: item.cortineiroTipo, cortineiroFixacao: item.cortineiroFixacao,
    altPisoTetoFolga: item.altPisoTetoFolga,
    // DEC-EXP-07 — Outros
    referenciaProduto: item.referenciaProduto, formatoTapete: item.formatoTapete,
    observacaoTecnica: item.observacaoTecnica,
  });

  return (
    <BrowserFrame title={`${pedido.numero_pedido} — ${pedido.cliente_nome ?? "Pedido"}`} path={`/decor/pedidos/${id}`}>
      <div className="p-4 space-y-4">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          <Home className="h-4 w-4" /><ChevronRight className="h-3 w-3" />
          <Link href="/decor/pedidos"><span className="hover:text-foreground cursor-pointer">Decoração</span></Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{pedido.numero_pedido}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">{pedido.numero_pedido}</h1>
              <Badge className={`${cfg.color} text-white`}>{cfg.label}</Badge>
              {pedido.torre && <Badge variant="outline" className="text-xs">Torre {pedido.torre}</Badge>}
              {pedido.apartamento && <Badge variant="outline" className="text-xs">AP {pedido.apartamento}</Badge>}
            </div>
            <p className="text-base font-medium">{pedido.cliente_nome ?? "—"}</p>
            {pedido.vendedor_nome && <p className="text-xs text-muted-foreground">Vendedor: {pedido.vendedor_nome}</p>}
            {pedido.endereco_obra && <p className="text-sm text-muted-foreground">{pedido.endereco_obra}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setAbaAtiva("capa")} data-testid="btn-decor-capa">
              <FileText className="h-4 w-4 mr-1" /> Capa
            </Button>
            {proximos.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowMudarStatus(true)} data-testid="btn-decor-mudar-status">
                <ArrowRight className="h-4 w-4 mr-1" /> Avançar etapa
              </Button>
            )}
            {["orcamento","aprovado"].includes(pedido.status) && (
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1"
                onClick={() => setShowEfetivar(true)} data-testid="btn-decor-efetivar">
                <DollarSign className="h-4 w-4" /> Efetivar
              </Button>
            )}
          </div>
        </div>

        {/* Valores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Subtotal produtos", value: pedido.valor_subtotal, color: "text-blue-600" },
            { label: "Mão de obra",       value: pedido.valor_mao_obra, color: "text-orange-600" },
            { label: "Desconto",          value: pedido.valor_desconto, color: "text-red-500" },
            { label: "TOTAL",             value: pedido.valor_final,    color: "text-green-600" },
          ].map(v => (
            <Card key={v.label}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{v.label}</p>
                <p className={`text-lg font-bold ${v.color}`}>
                  {parseFloat(v.value || "0").toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ══ ABAS ══════════════════════════════════════════════════════════════ */}
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="visao-geral"   className="text-xs" data-testid="tab-decor-geral">📋 Geral</TabsTrigger>
            <TabsTrigger value="medicoes"      className="text-xs" data-testid="tab-decor-medicoes">📐 Medições ({pedido.medicoes?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="configurador"  className="text-xs" data-testid="tab-decor-conf">🧮 Configurador</TabsTrigger>
            <TabsTrigger value="orcamento"     className="text-xs" data-testid="tab-decor-orcamento">💰 Orçamento ({pedido.itens?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="os-producao"   className="text-xs" data-testid="tab-decor-osprod">✂️ OS Produção ({pedido.os_producao?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="os-instalacao" className="text-xs" data-testid="tab-decor-osinst">🔧 OS Instalação ({pedido.os_instalacao?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="analise"       className="text-xs" data-testid="tab-decor-analise">🔍 Análise Técnica</TabsTrigger>
            <TabsTrigger value="checklist"     className="text-xs" data-testid="tab-decor-checklist">✅ Checklist</TabsTrigger>
            <TabsTrigger value="financeiro"    className="text-xs" data-testid="tab-decor-financeiro">💳 Financeiro</TabsTrigger>
            <TabsTrigger value="capa"          className="text-xs" data-testid="tab-decor-capa">📄 Capa</TabsTrigger>
            <TabsTrigger value="fornecedores"  className="text-xs" data-testid="tab-decor-fornecedores">🏭 Fornecedores</TabsTrigger>
          </TabsList>

          {/* ── VISÃO GERAL ──────────────────────────────────────────────────── */}
          <TabsContent value="visao-geral" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Dados do Cliente</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2"><span className="text-muted-foreground w-28">Nome:</span> <span className="font-medium">{pedido.cliente_nome ?? "—"}</span></div>
                  <div className="flex items-center gap-2"><span className="text-muted-foreground w-28">CPF/CNPJ:</span> {pedido.cliente_cpf ?? "—"}</div>
                  {pedido.data_aniversario && (
                    <div className="flex items-center gap-2"><Cake className="h-3.5 w-3.5 text-pink-400" /><span>Aniversário: {new Date(pedido.data_aniversario).toLocaleDateString("pt-BR")}</span></div>
                  )}
                  {pedido.cliente_fone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-green-500" /><span>{pedido.cliente_fone}</span></div>}
                  {pedido.cliente_email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-blue-500" /><span>{pedido.cliente_email}</span></div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Endereço e Identificação</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-gray-400" /><span>{pedido.endereco_obra ?? "—"}</span></div>
                  {(pedido.torre || pedido.apartamento) && (
                    <div className="flex gap-3">
                      {pedido.torre && <Badge variant="outline">Torre {pedido.torre}</Badge>}
                      {pedido.apartamento && <Badge variant="outline">AP {pedido.apartamento}</Badge>}
                    </div>
                  )}
                  {(pedido.bairro || pedido.cidade_obra) && (
                    <div className="text-muted-foreground">{pedido.bairro && `${pedido.bairro} — `}{pedido.cidade_obra ?? ""}{pedido.uf && `/${pedido.uf}`}</div>
                  )}
                  {pedido.complemento && <div className="text-muted-foreground">{pedido.complemento}</div>}
                </CardContent>
              </Card>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Datas e Atendimento</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div><span className="text-muted-foreground">Criado em:</span> {new Date(pedido.created_at).toLocaleDateString("pt-BR")}</div>
                  <div><span className="text-muted-foreground">Vendedor:</span> <strong>{pedido.vendedor_nome ?? "—"}</strong></div>
                  <div><span className="text-muted-foreground">Medição:</span> {pedido.data_medicao ? new Date(pedido.data_medicao).toLocaleDateString("pt-BR") : "—"}</div>
                  <div><span className="text-muted-foreground">Instalação:</span> {pedido.data_instalacao ? new Date(pedido.data_instalacao).toLocaleDateString("pt-BR") : "—"}</div>
                  {pedido.horario_instalacao && (
                    <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-orange-400" /><span>Horário: {pedido.horario_instalacao}</span></div>
                  )}
                  <div><span className="text-muted-foreground">Prazo entrega:</span> {pedido.prazo_entrega_dias ?? 30} dias</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Pagamento</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  {pedido.num_parcelas && <div><span className="text-muted-foreground">Parcelas:</span> <strong>{pedido.num_parcelas}×</strong></div>}
                  {pedido.tipo_pagamento_codigo && (
                    <div><span className="text-muted-foreground">Forma:</span> {FORMA_PGTO[pedido.tipo_pagamento_codigo] ?? pedido.tipo_pagamento_codigo}</div>
                  )}
                  {pedido.data_efetivacao && <div><span className="text-muted-foreground">Efetivado em:</span> {new Date(pedido.data_efetivacao).toLocaleDateString("pt-BR")}</div>}
                </CardContent>
              </Card>
            </div>
            {pedido.observacoes && (
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
                <CardContent><p className="text-sm">{pedido.observacoes}</p></CardContent>
              </Card>
            )}

            {/* ── Bloco Agenda de Instalação ──────────────────────────────── */}
            <AgendaInstalacaoCard
              osInstalacao={pedido.os_instalacao ?? []}
              onVerOS={() => setAbaAtiva("os-instalacao")}
            />
          </TabsContent>

          {/* ── MEDIÇÕES ─────────────────────────────────────────────────────── */}
          <TabsContent value="medicoes" className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Medições por Ambiente</h3>
              <Button size="sm" onClick={() => setShowNovaMedicao(true)} data-testid="btn-decor-nova-medicao">
                <Plus className="h-4 w-4 mr-1" /> Nova Medição
              </Button>
            </div>
            {(pedido.medicoes ?? []).length === 0 && (
              <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">Nenhuma medição registrada ainda</CardContent></Card>
            )}
            {(pedido.medicoes ?? []).map((m: any) => (
              <Card key={m.id} data-testid={`card-medicao-${m.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{m.ambiente ?? "Ambiente"}</p>
                      <p className="text-sm text-muted-foreground">
                        {m.largura_vao}m × {m.altura_vao}m · {m.quantidade_vaos} vão(s)
                        {m.largura_vao && m.altura_vao && (
                          <span className="ml-2 text-blue-600 font-medium">
                            = {(parseFloat(m.largura_vao) * parseFloat(m.altura_vao) * parseInt(m.quantidade_vaos)).toFixed(2)} m²
                          </span>
                        )}
                      </p>
                    </div>
                    <Ruler className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {m.observacoes && <p className="text-xs text-muted-foreground mt-1">{m.observacoes}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── CONFIGURADOR ─────────────────────────────────────────────────── */}
          <TabsContent value="configurador" className="mt-4">
            <ConfiguradorSelector
              medicoes={pedido.medicoes ?? []}
              onAddItem={handleAddItem}
            />
          </TabsContent>

          {/* ── ORÇAMENTO ────────────────────────────────────────────────────── */}
          <TabsContent value="orcamento" className="space-y-3 mt-4">
            <h3 className="font-semibold">Itens do Orçamento</h3>
            {(pedido.itens ?? []).length === 0 && (
              <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">Nenhum item — use a aba Configurador para adicionar</CardContent></Card>
            )}
            {(pedido.itens ?? []).map((item: any) => {
              const tp = item.tipo_produto ?? "cortina";
              const isPersiana = tp === "persiana" || item.fornecedor_persiana;
              const isTapete  = tp === "tapete";
              const isPapel   = tp === "papel_de_parede";
              const isDv      = tp === "double_vision";
              const isMosq    = tp === "mosquiteiro";
              const isAvulso  = tp === "item_avulso";
              const isOutros  = isTapete || isPapel || isDv || isMosq || isAvulso;
              const tipoIcon  = isPersiana ? "🪟" : isTapete ? "🟫" : isPapel ? "📄" : isDv ? "🪟" : isMosq ? "🕸️" : isAvulso ? "📦" : "🧵";
              return (
                <Card key={item.id} data-testid={`card-item-${item.id}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className="mt-0.5 text-lg leading-none">{tipoIcon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.produto ?? item.tipo_produto ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.ambiente && <span>{item.ambiente} · </span>}
                        {/* Cortina / Wave */}
                        {!isOutros && !isPersiana && item.sistema && <span>{item.sistema} · </span>}
                        {!isOutros && item.largura && item.altura && <span>{parseFloat(item.largura).toFixed(2)}m × {parseFloat(item.altura).toFixed(2)}m · </span>}
                        {!isOutros && item.metragem_tecido && <span>{parseFloat(item.metragem_tecido).toFixed(2)} m tecido</span>}
                        {/* Persiana */}
                        {isPersiana && item.largura && item.altura && <span>{parseFloat(item.largura).toFixed(2)} × {parseFloat(item.altura).toFixed(2)}m · </span>}
                        {isPersiana && item.fornecedor_persiana && <span>{item.fornecedor_persiana}{item.colecao_cor ? ` — ${item.colecao_cor}` : ""}</span>}
                        {/* Outros */}
                        {isOutros && item.largura && <span>{parseFloat(item.largura).toFixed(2)}m{item.comprimento ? ` × ${parseFloat(item.comprimento).toFixed(2)}m` : item.altura ? ` × ${parseFloat(item.altura).toFixed(2)}m` : ""}</span>}
                        {isOutros && item.metragem_tecido && <span> · {parseFloat(item.metragem_tecido).toFixed(2)} m²</span>}
                        {isTapete && item.formato_tapete && <span> · {item.formato_tapete}</span>}
                      </p>
                      {/* Campos Wave */}
                      {item.modelo_cortina && (
                        <p className="text-xs text-blue-600">
                          {item.modelo_cortina}
                          {item.divisao_a && ` · A:${item.divisao_a}m`}
                          {item.divisao_b && ` + B:${item.divisao_b}m`}
                          {item.trilho_tipo && ` · ${item.trilho_tipo}`}
                        </p>
                      )}
                      {/* Observação técnica */}
                      {item.observacao_tecnica && (
                        <p className="text-xs text-muted-foreground italic truncate">{item.observacao_tecnica}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-green-600">
                        {parseFloat(item.valor_total || "0").toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                      <p className="text-xs text-muted-foreground">qtd: {item.quantidade}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                      onClick={() => removeItem.mutate(item.id)} data-testid={`btn-remove-item-${item.id}`}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {(pedido.itens ?? []).length > 0 && (
              <div className="flex justify-end">
                <Card className="bg-green-50 dark:bg-green-950/30 border-green-200">
                  <CardContent className="p-3 text-right">
                    <p className="text-xs text-muted-foreground">Total Geral</p>
                    <p className="text-xl font-bold text-green-700">
                      {parseFloat(pedido.valor_final || "0").toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ── OS PRODUÇÃO ──────────────────────────────────────────────────── */}
          <TabsContent value="os-producao" className="mt-4">
            <OsProducaoPanel
              pedidoId={id} pedidoStatus={pedido.status}
              onGerado={() => qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", id] })}
            />
          </TabsContent>

          {/* ── OS INSTALAÇÃO ────────────────────────────────────────────────── */}
          <TabsContent value="os-instalacao" className="mt-4">
            <OsInstalacaoPanel
              pedidoId={id} pedidoStatus={pedido.status}
              enderecoObra={pedido.endereco_obra}
              onConcluida={() => qc.invalidateQueries({ queryKey: ["/api/modules/decor/pedidos", id] })}
            />
          </TabsContent>

          {/* ── ANÁLISE TÉCNICA ──────────────────────────────────────────────── */}
          <TabsContent value="analise" className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Histórico de Análise Técnica</h3>
              <Button size="sm" onClick={() => setShowNovaAnalise(true)} data-testid="btn-decor-nova-analise">
                <Plus className="h-4 w-4 mr-1" /> Registrar Ação
              </Button>
            </div>
            {(pedido.analise_tecnica ?? []).length === 0 && (
              <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">Nenhuma análise técnica registrada</CardContent></Card>
            )}
            {(pedido.analise_tecnica ?? []).map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border" data-testid={`card-analise-${a.id}`}>
                <AlertCircle className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{a.acao}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  {a.observacao && <p className="text-sm mt-1">{a.observacao}</p>}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* ── CHECKLIST ────────────────────────────────────────────────────── */}
          <TabsContent value="checklist" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Checklist Operacional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {[
                  ["medicao_ok",                 "📐 Medição realizada"],
                  ["orcamento_aprovado",          "✅ Orçamento aprovado pelo cliente"],
                  ["pagamento_entrada",           "💵 Pagamento da entrada confirmado"],
                  ["pedido_fornecedor_persiana",  "🏭 Pedido enviado ao fornecedor de persiana"],
                  ["material_recebido",           "📦 Material (tecido/trilho) recebido"],
                  ["material_persiana_recebido",  "🪟 Persianas recebidas do fornecedor"],
                  ["nfe_fornecedor_recebida",     "🧾 NF-e da compra de persiana importada"],
                  ["producao_ok",                 "✂️ OS de produção concluída"],
                  ["etiquetas_ok",                "🏷️ Etiquetas e embalagem conferidas"],
                  ["instalacao_agendada",         "📅 Instalação agendada"],
                  ["ambiente_apto",               "🏠 Ambiente limpo com energia no dia"],
                  ["instalacao_concluida",        "🔧 Instalação concluída"],
                  ["termo_assinado",              "📝 Termo de aceite assinado"],
                  ["nfe_emitida",                 "🧾 NF-e de venda emitida"],
                  ["pagamento_saldo",             "💳 Saldo final pago"],
                ].map(([key, label]) => (
                  <CheckItem key={key} label={label} done={!!checklist[key]}
                    onToggle={() => atualizarChecklist.mutate({ [key]: !checklist[key] })} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── FINANCEIRO (novo — DEC-EXP-05) ───────────────────────────────── */}
          <TabsContent value="financeiro" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-orange-500" /> Parcelas do Pedido
              </h3>
              {["orcamento","aprovado"].includes(pedido.status) && (
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => setShowEfetivar(true)} data-testid="btn-fin-efetivar">
                  <DollarSign className="h-4 w-4 mr-1" /> Efetivar com parcelas
                </Button>
              )}
            </div>

            {parcelas.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">
                {pedido.status === "efetivado" || pedido.status === "producao" || pedido.status === "concluido"
                  ? "Nenhuma parcela registrada. Use o botão Efetivar para criar as parcelas."
                  : "Pedido ainda não efetivado. Aprove o orçamento e clique em Efetivar para criar as parcelas."}
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {parcelas.map((p: any) => (
                  <Card key={p.id} data-testid={`card-parcela-${p.id}`}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-700">
                        {p.sequencia}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Parcela {p.sequencia}/{p.total_parcelas}
                          {p.forma_pagamento && <span className="text-muted-foreground ml-2">· {FORMA_PGTO[p.forma_pagamento] ?? p.forma_pagamento}</span>}
                        </p>
                        {p.vencimento && <p className="text-xs text-muted-foreground">Vence: {new Date(p.vencimento).toLocaleDateString("pt-BR")}</p>}
                        {p.ar_status && <p className="text-xs text-blue-600">AR: {p.ar_status}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-700">
                          {parseFloat(p.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                        <Badge variant={p.status === "pago" ? "default" : "outline"} className="text-xs">
                          {p.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200">
                  <CardContent className="p-3 text-right">
                    <p className="text-xs text-muted-foreground">Total das parcelas</p>
                    <p className="text-xl font-bold text-orange-700">
                      {parcelas.reduce((s: number, p: any) => s + parseFloat(p.valor), 0)
                        .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ── CAPA (novo — DEC-EXP-04) ─────────────────────────────────────── */}
          <TabsContent value="capa" className="mt-4">
            <DecorCapaPedido
              pedido={pedido}
              itens={pedido.itens ?? []}
              onClose={() => setAbaAtiva("visao-geral")}
            />
          </TabsContent>

          {/* ── FORNECEDORES (novo — DEC-EXP-06) ─────────────────────────────── */}
          <TabsContent value="fornecedores" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-500" /> Pedidos a Fornecedores
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => refetchFornecedores()}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
                </Button>
                <Button size="sm" onClick={() => setShowNovoFornecedor(true)} data-testid="btn-novo-fornecedor">
                  <Plus className="h-4 w-4 mr-1" /> Registrar pedido a fornecedor
                </Button>
              </div>
            </div>

            {fornecedoresPedido.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">
                Nenhum pedido a fornecedor registrado. Registre o envio do pedido de persiana ao fornecedor.
              </CardContent></Card>
            ) : fornecedoresPedido.map((fp: any) => {
              const stCfg = STATUS_FORNECEDOR[fp.status] ?? { label: fp.status, color: "bg-gray-400" };
              return (
                <Card key={fp.id} data-testid={`card-fornecedor-${fp.id}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{fp.fornecedor_nome}</p>
                        {fp.ambiente && <p className="text-xs text-muted-foreground">Ambiente: {fp.ambiente}</p>}
                        {fp.produto && <p className="text-xs text-muted-foreground">Produto: {fp.produto}</p>}
                        {fp.data_envio && <p className="text-xs text-muted-foreground">Enviado em: {new Date(fp.data_envio).toLocaleDateString("pt-BR")}</p>}
                        {fp.previsao_entrega && <p className="text-xs text-blue-600">Previsão: {new Date(fp.previsao_entrega).toLocaleDateString("pt-BR")}</p>}
                      </div>
                      <Badge className={`${stCfg.color} text-white text-xs`}>{stCfg.label}</Badge>
                    </div>
                    {fp.observacoes && <p className="text-xs text-muted-foreground">{fp.observacoes}</p>}
                    <div className="flex gap-2 flex-wrap pt-1">
                      {["confirmado","em_producao","enviado","recebido"].map(s => (
                        <Button key={s} size="sm" variant={fp.status === s ? "default" : "outline"}
                          className="h-6 text-xs px-2"
                          onClick={() => updateFornecedor.mutate({ fpId: fp.id, body: { status: s } })}
                          data-testid={`btn-fp-status-${s}-${fp.id}`}>
                          {STATUS_FORNECEDOR[s]?.label ?? s}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>

      {/* ══ DIALOGS ══════════════════════════════════════════════════════════════ */}

      {/* Mudar Status */}
      <Dialog open={showMudarStatus} onOpenChange={setShowMudarStatus}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Avançar Etapa do Pedido</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Status atual: <Badge className={`${cfg.color} text-white`}>{cfg.label}</Badge></p>
            <Label>Novo status</Label>
            <Select value={novoStatus} onValueChange={setNovoStatus}>
              <SelectTrigger data-testid="select-novo-status"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {proximos.map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMudarStatus(false)}>Cancelar</Button>
            <Button onClick={() => novoStatus && atualizarStatus.mutate(novoStatus)}
              disabled={!novoStatus || atualizarStatus.isPending} data-testid="btn-confirmar-status">
              {atualizarStatus.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Efetivar */}
      <Dialog open={showEfetivar} onOpenChange={setShowEfetivar}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Efetivar Pedido — Parcelas</DialogTitle></DialogHeader>
          <EfetivarFormV2
            pedido={pedido}
            onConfirm={(body) => efetivarV2.mutate(body)}
            loading={efetivarV2.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Nova Medição */}
      <Dialog open={showNovaMedicao} onOpenChange={setShowNovaMedicao}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Medição</DialogTitle></DialogHeader>
          <MedicaoForm onSave={(body) => novaMedicao.mutate(body)} loading={novaMedicao.isPending} />
        </DialogContent>
      </Dialog>

      {/* Nova Análise */}
      <Dialog open={showNovaAnalise} onOpenChange={setShowNovaAnalise}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Ação de Análise Técnica</DialogTitle></DialogHeader>
          <AnaliseForm onSave={(body) => novaAnalise.mutate(body)} loading={novaAnalise.isPending} />
        </DialogContent>
      </Dialog>

      {/* Novo Fornecedor */}
      <Dialog open={showNovoFornecedor} onOpenChange={setShowNovoFornecedor}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Pedido ao Fornecedor</DialogTitle></DialogHeader>
          <FornecedorForm
            itens={pedido.itens ?? []}
            onSave={(body) => addFornecedor.mutate(body)}
            loading={addFornecedor.isPending}
          />
        </DialogContent>
      </Dialog>
    </BrowserFrame>
  );
}

// ─── EfetivarFormV2 ───────────────────────────────────────────────────────────
function EfetivarFormV2({ pedido, onConfirm, loading }: { pedido: any; onConfirm: (b: any) => void; loading: boolean }) {
  const [numParcelas, setNumParcelas] = useState("2");
  const [tipoPgto, setTipoPgto] = useState("01");
  const [vencBase, setVencBase] = useState(new Date().toISOString().split("T")[0]);

  const total = parseFloat(pedido.valor_final || "0");
  const n = parseInt(numParcelas) || 1;
  const valorParcela = n > 0 ? Math.round(total / n * 100) / 100 : total;

  // Gera datas de vencimento automáticas (mensal)
  const vencimentos = Array.from({ length: n }, (_, i) => {
    const d = new Date(vencBase);
    d.setMonth(d.getMonth() + i);
    return d.toISOString().split("T")[0];
  });

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/50 rounded-lg">
        <p className="text-sm">Valor total: <strong>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nº de parcelas</Label>
          <Input type="number" min="1" max="24" className="h-8 text-sm"
            value={numParcelas} onChange={e => setNumParcelas(e.target.value)}
            data-testid="input-num-parcelas" />
        </div>
        <div>
          <Label className="text-xs">Forma de pagamento</Label>
          <Select value={tipoPgto} onValueChange={setTipoPgto}>
            <SelectTrigger className="h-8 text-sm" data-testid="select-tipo-pgto"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(FORMA_PGTO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">1º vencimento</Label>
        <Input type="date" className="h-8 text-sm" value={vencBase}
          onChange={e => setVencBase(e.target.value)} data-testid="input-venc-base" />
      </div>

      <div className="space-y-1.5 max-h-52 overflow-y-auto">
        {vencimentos.map((v, i) => (
          <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
            <span className="text-muted-foreground">Parcela {i + 1}/{n}</span>
            <span className="text-xs">{new Date(v + "T00:00:00").toLocaleDateString("pt-BR")}</span>
            <span className="font-medium text-green-700">
              {valorParcela.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        ))}
      </div>

      <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        onClick={() => onConfirm({ numParcelas: n, tipoPagamentoCodigo: tipoPgto, vencimentos })}
        disabled={loading || total <= 0} data-testid="btn-confirmar-efetivar-v2">
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Confirmar — criar {n} parcela{n > 1 ? "s" : ""} e ARs
      </Button>
    </div>
  );
}

// ─── MedicaoForm ─────────────────────────────────────────────────────────────
function MedicaoForm({ onSave, loading }: { onSave: (b: any) => void; loading: boolean }) {
  const [ambiente, setAmbiente] = useState("");
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  const [qtd, setQtd] = useState("1");
  const [obs, setObs] = useState("");
  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Ambiente *</Label>
        <Input value={ambiente} onChange={e => setAmbiente(e.target.value)} placeholder="Ex: Sala, Quarto..." data-testid="input-med-ambiente" /></div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Largura (m)</Label>
          <Input type="number" step="0.01" value={largura} onChange={e => setLargura(e.target.value)} data-testid="input-med-largura" /></div>
        <div><Label className="text-xs">Altura (m)</Label>
          <Input type="number" step="0.01" value={altura} onChange={e => setAltura(e.target.value)} data-testid="input-med-altura" /></div>
        <div><Label className="text-xs">Qtd vãos</Label>
          <Input type="number" min="1" value={qtd} onChange={e => setQtd(e.target.value)} data-testid="input-med-qtd" /></div>
      </div>
      <div><Label className="text-xs">Observações</Label>
        <Textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} data-testid="input-med-obs" /></div>
      <Button className="w-full" onClick={() => onSave({ ambiente, larguraVao: parseFloat(largura), alturaVao: parseFloat(altura), quantidadeVaos: parseInt(qtd), observacoes: obs || null })}
        disabled={!ambiente || !largura || !altura || loading} data-testid="btn-salvar-medicao">
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar Medição
      </Button>
    </div>
  );
}

// ─── AnaliseForm ─────────────────────────────────────────────────────────────
function AnaliseForm({ onSave, loading }: { onSave: (b: any) => void; loading: boolean }) {
  const [acao, setAcao] = useState("enviado");
  const [obs, setObs] = useState("");
  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Ação *</Label>
        <Select value={acao} onValueChange={setAcao}>
          <SelectTrigger data-testid="select-analise-acao"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="enviado">Enviado para análise</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="retornado">Retornado com ressalvas</SelectItem>
            <SelectItem value="alteracao">Alteração solicitada</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label className="text-xs">Observação</Label>
        <Textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} data-testid="input-analise-obs" /></div>
      <Button className="w-full" onClick={() => onSave({ acao, observacao: obs || null })}
        disabled={loading} data-testid="btn-salvar-analise">
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Registrar
      </Button>
    </div>
  );
}

// ─── FornecedorForm ───────────────────────────────────────────────────────────
function FornecedorForm({ itens, onSave, loading }: { itens: any[]; onSave: (b: any) => void; loading: boolean }) {
  const [fornecedor, setFornecedor] = useState("");
  const [itemId, setItemId] = useState("");
  const [dataEnvio, setDataEnvio] = useState(new Date().toISOString().split("T")[0]);
  const [previsao, setPrevisao] = useState("");
  const [obs, setObs] = useState("");
  const persianaItens = itens.filter((i: any) => i.tipo_produto === "persiana" || i.fornecedor_persiana);
  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Fornecedor *</Label>
        <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Ex: ROLLO" data-testid="input-fp-fornecedor" /></div>
      {persianaItens.length > 0 && (
        <div><Label className="text-xs">Item de persiana</Label>
          <Select value={itemId} onValueChange={setItemId}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar item (opcional)..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {persianaItens.map((i: any) => (
                <SelectItem key={i.id} value={i.id}>{i.ambiente ?? i.produto ?? i.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Data envio</Label>
          <Input type="date" value={dataEnvio} onChange={e => setDataEnvio(e.target.value)} /></div>
        <div><Label className="text-xs">Previsão entrega</Label>
          <Input type="date" value={previsao} onChange={e => setPrevisao(e.target.value)} /></div>
      </div>
      <div><Label className="text-xs">Observações</Label>
        <Textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} /></div>
      <Button className="w-full" onClick={() => onSave({
        fornecedorNome: fornecedor, itemId: itemId || null,
        dataEnvio, previsaoEntrega: previsao || null, observacoes: obs || null,
      })} disabled={!fornecedor || loading} data-testid="btn-salvar-fornecedor">
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Registrar pedido ao fornecedor
      </Button>
    </div>
  );
}
