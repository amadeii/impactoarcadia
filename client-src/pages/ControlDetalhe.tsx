import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputBR, formatDateBR } from "@/components/ui/date-input-br";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, ArrowDownCircle, ArrowUpCircle, Plus, CheckCircle2, Clock, AlertTriangle, DollarSign,
  Banknote, ListTree, Building, FileSpreadsheet, Trash2, CheckSquare,
  BookOpen, Building2, Plug, Upload, Calculator, Activity, Lock, FileText, Repeat, BarChart3,
  TrendingUp, CalendarDays, Clock as ClockIcon,
  Wallet, Users, Calendar as CalendarIcon, Wand2, CreditCard, Workflow,
  SendHorizontal, Hourglass, GitMerge, FileDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import PlanoContasTab from "./control/ControlTabs/PlanoContasTab";
import GruposTab from "./control/ControlTabs/GruposTab";
import ConectoresTab from "./control/ControlTabs/ConectoresTab";
import ImportTab from "./control/ControlTabs/ImportTab";
import PainelFiscalTab from "./control/ControlTabs/PainelFiscalTab";
import FleurietTab from "./control/ControlTabs/FleurietTab";
import FechamentoTab from "./control/ControlTabs/FechamentoTab";
import NfeMonitorTab from "./control/ControlTabs/NfeMonitorTab";
import RateioTab from "./control/ControlTabs/RateioTab";
import DreProjetos from "./control/ControlTabs/DreProjetos";
import BasesReceitaTab from "./control/ControlTabs/BasesReceitaTab";
import CartaoTab from "./control/ControlTabs/CartaoTab";
import PagamentosWorkflowTab from "./control/ControlTabs/PagamentosWorkflowTab";
import { ImportLancamentosDialog } from "./control/ImportLancamentosDialog";
import { EditLancamentoDialog } from "./control/EditLancamentoDialog";
import { FavorecidoPicker } from "@/components/control/FavorecidoPicker";
import { ProjectPicker } from "@/components/control/ProjectPicker";
import { QuickCreatePessoaDialog } from "@/components/control/QuickCreatePessoaDialog";
import { ConciliarLancamentoDialog } from "./control/ConciliarLancamentoDialog";
import { ExtratoDialog } from "./control/ExtratoDialog";
import { ParcelarLancamentoDialog } from "./control/ParcelarLancamentoDialog";
import { TransferenciaDialog } from "./control/TransferenciaDialog";
import { SaldoInicialDialog } from "./control/SaldoInicialDialog";

interface Cliente { id: string; nome: string; cnpj?: string; }
interface Lancamento {
  id: string; tipo: "pagar" | "receber"; descricao: string; favorecido?: string; valor: string;
  dataVencimento: string; dataPagamento?: string; status: string; planoContaId?: string;
  centroCustoId?: string; contaBancariaId?: string; criadoPorIa?: boolean;
  // Sprint C7
  statusCalc?: string;
  numeroParcela?: number | null;
  totalParcelas?: number | null;
  origemRecorrencia?: boolean;
  // Workflow de pagamentos
  workflowStatus?: string | null;
}
interface Overview {
  aPagarVencidos: number; aPagar7d: number; aPagar30d: number;
  aReceberVencidos: number; aReceber7d: number; aReceber30d: number;
  pagoMes: number; recebidoMes: number; pendentesAprovacao: number;
  totalLancamentos: number; saldoBancarioTotal: number; totalContasBancarias: number;
}
interface PlanoConta { id: string; codigo: string; descricao: string; permiteLancamento: boolean; nivel: number; }
interface CentroCusto { id: string; codigo: string; nome: string; ativo: boolean; }
interface ContaBancaria { id: string; banco: string; agencia?: string; conta?: string; tipo: string; saldoInicial: string; saldoAtual: string; ativo: boolean; }
interface DashboardCompleto {
  contas: Array<{
    id: string; banco: string; agencia?: string | null; conta?: string | null;
    tipo: string; saldoAtual: number; saldoInicial: number; ativo: boolean;
  }>;
  topClientes: Array<{
    nome: string; pessoaId: string | null;
    total: number; qtdLancamentos: number; pmrDias: number | null;
  }>;
  topFornecedores: Array<{
    nome: string; pessoaId: string | null;
    total: number; qtdLancamentos: number;
  }>;
  orcamentoMes: {
    previsto: number; realizado: number;
    desvio: number | null; mes: number; ano: number;
  };
  alertasOrcamento?: Array<{
    grupo: string; previsto: number; realizado: number; desvio: number;
  }>;
}

const formatBRL = (v: number | string) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
};

const lancamentoFormSchema = z.object({
  tipo: z.enum(["pagar", "receber"]),
  descricao: z.string().min(1, "Obrigatório"),
  favorecido: z.string().optional(),
  pessoaId: z.string().optional(),
  projetoCodigo: z.string().optional(),
  parceiro: z.string().optional(),
  documento: z.string().optional(),
  osNumero: z.string().optional(),
  valor: z.string().min(1, "Obrigatório"),
  dataEmissao: z.string().optional(),
  dataVencimento: z.string().min(1, "Obrigatório"),
  status: z.enum(["previsto", "aprovado", "pago"]).default("previsto"),
  planoContaId: z.string().optional(),
  centroCustoId: z.string().optional(),
  contaBancariaId: z.string().min(1, "Conta bancária é obrigatória"),
  tipoDocumentoId: z.string().optional(),
  projetoId: z.string().optional(),
  observacoes: z.string().optional(),
});

const statusBadge: Record<string, { label: string; variant: any; icon: any; className?: string }> = {
  previsto: { label: "Previsto", variant: "secondary", icon: Clock },
  aprovado: { label: "Aprovado", variant: "default", icon: CheckCircle2 },
  pago: { label: "Pago", variant: "outline", icon: CheckCircle2, className: "border-emerald-500 text-emerald-700 dark:text-emerald-400" },
  vencido: { label: "Vencido", variant: "destructive", icon: AlertTriangle },
  cancelado: { label: "Cancelado", variant: "outline", icon: Clock, className: "text-muted-foreground" },
  inadimplente: { label: "Inadimplente", variant: "destructive", icon: AlertTriangle },
  // Sprint C7 — G6 status calculados virtuais
  em_dia: { label: "Em dia", variant: "outline", icon: Clock, className: "border-blue-500 text-blue-700 dark:text-blue-400" },
  vence_hoje: { label: "Vence em breve", variant: "outline", icon: AlertTriangle, className: "border-amber-500 text-amber-700 dark:text-amber-400" },
  atrasado: { label: "Vencido", variant: "destructive", icon: AlertTriangle },
};

// Badges de workflow — mapeados separadamente do status financeiro
const workflowBadge: Record<string, { label: string; icon: any; className: string }> = {
  programado: { label: "Pend. Confirmação", icon: Hourglass, className: "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950" },
  autorizado: { label: "Autorizado", icon: CheckSquare, className: "border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950" },
  pago: { label: "Pend. Conciliação", icon: GitMerge, className: "border-purple-500 text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950" },
  conciliado: { label: "Conciliado", icon: CheckCircle2, className: "border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950" },
};

export default function ControlDetalhe() {
  const [location, navigate] = useLocation();
  const clienteId = location.split('/').filter(Boolean)[1] ?? '';
  const { toast } = useToast();
  const [tab, setTab] = useState("dashboard");
  const [dashMeses, setDashMeses] = useState(1);
  const [openLanc, setOpenLanc] = useState(false);
  const [showQuickCreatePessoa, setShowQuickCreatePessoa] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroCampoData, setFiltroCampoData] = useState<"vencimento" | "emissao" | "pagamento">("vencimento");
  const [filtroDataIni, setFiltroDataIni] = useState<string>("");
  const [filtroDataFim, setFiltroDataFim] = useState<string>("");
  const [filtroBusca, setFiltroBusca] = useState<string>("");
  // Paginação da tabela de lançamentos
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const { data: crmCliente } = useQuery<{ id: number; razaoSocial: string; nomeFantasia?: string | null; cnpj?: string } | undefined>({
    queryKey: ["/api/admin/empresas", clienteId],
    queryFn: async () => {
      if (!clienteId) return undefined;
      const r = await fetch(`/api/admin/empresas/${clienteId}`, { credentials: "include" });
      if (!r.ok) return undefined;
      return r.json();
    },
    enabled: !!clienteId,
  });
  const cliente: Cliente | undefined = crmCliente
    ? { id: String(crmCliente.id), nome: crmCliente.nomeFantasia || crmCliente.razaoSocial, cnpj: crmCliente.cnpj }
    : undefined;

  const { data: overview, isLoading: loadingOv } = useQuery<Overview>({
    queryKey: ["/api/control/clientes", clienteId, "overview"],
    enabled: !!clienteId,
  });
  const { data: lancamentos = [], isLoading: loadingLanc } = useQuery<Lancamento[]>({
    queryKey: ["/api/control/clientes", clienteId, "lancamentos", filtroTipo, filtroStatus, filtroCampoData, filtroDataIni, filtroDataFim, filtroBusca],
    enabled: !!clienteId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtroTipo !== "todos") params.set("tipo", filtroTipo);
      if (filtroStatus !== "todos") params.set("status", filtroStatus);
      if (filtroDataIni) params.set("dataIni", filtroDataIni);
      if (filtroDataFim) params.set("dataFim", filtroDataFim);
      if (filtroCampoData) params.set("campoData", filtroCampoData);
      if (filtroBusca.trim()) params.set("q", filtroBusca.trim());
      const r = await fetch(`/api/control/clientes/${clienteId}/lancamentos?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Falha ao carregar lançamentos");
      return r.json();
    },
  });

  // Totais consultados (do resultado da query atual)
  const totaisConsulta = (() => {
    let aPagar = 0, aReceber = 0;
    for (const l of lancamentos) {
      const v = parseFloat(l.valor) || 0;
      if (l.tipo === "pagar") aPagar += v; else aReceber += v;
    }
    return { aPagar, aReceber, saldo: aReceber - aPagar, qtd: lancamentos.length };
  })();

  const limparFiltros = () => {
    setFiltroTipo("todos");
    setFiltroStatus("todos");
    setFiltroCampoData("vencimento");
    setFiltroDataIni("");
    setFiltroDataFim("");
    setFiltroBusca("");
    setCurrentPage(1);
  };

  // Paginação: fatia da página atual
  const totalPages = Math.max(1, Math.ceil(lancamentos.length / pageSize));
  const lancamentosPage = lancamentos.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Exportação ────────────────────────────────────────────────────────────
  const exportRows = () =>
    lancamentos.map((l) => ({
      Vencimento: formatDateBR(l.dataVencimento),
      Tipo: l.tipo === "pagar" ? "Pagar" : "Receber",
      Descrição: l.descricao,
      Favorecido: l.parceiro || "",
      Valor: parseFloat(l.valor) || 0,
      Status: (l.statusCalc || l.status),
      "Plano de Contas": l.planoContaId || "",
      Documento: l.documento || "",
    }));

  const exportCSV = () => {
    const rows = exportRows();
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(";"),
      ...rows.map((r) =>
        headers.map((h) => {
          const v = String((r as any)[h] ?? "").replace(/"/g, '""');
          return `"${v}"`;
        }).join(";")
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `lancamentos_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportXLSX = () => {
    const rows = exportRows();
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    // Formatação de largura das colunas
    ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 40 }, { wch: 25 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `lancamentos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    const rows = exportRows();
    if (!rows.length) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Lançamentos</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:16px;}
      h2{margin-bottom:8px;font-size:14px;}
      p{margin:0 0 12px;color:#555;font-size:10px;}
      table{width:100%;border-collapse:collapse;}
      th{background:#1e293b;color:#fff;padding:5px 7px;text-align:left;font-size:10px;}
      td{padding:4px 7px;border-bottom:1px solid #e2e8f0;font-size:10px;}
      tr:nth-child(even) td{background:#f8fafc;}
      .pagar{color:#c2410c;} .receber{color:#15803d;}
      .neg{color:#dc2626;} .pos{color:#16a34a;}
      tfoot td{font-weight:bold;border-top:2px solid #1e293b;padding-top:6px;}
    </style></head><body>
    <h2>Lançamentos Financeiros</h2>
    <p>Gerado em ${new Date().toLocaleString("pt-BR")} · ${rows.length} registro(s)</p>
    <table>
      <thead><tr>
        <th>Vencimento</th><th>Tipo</th><th>Descrição</th><th>Favorecido</th>
        <th style="text-align:right">Valor</th><th>Status</th>
      </tr></thead>
      <tbody>${rows.map((r) => `
        <tr>
          <td>${r.Vencimento}</td>
          <td class="${r.Tipo === "Pagar" ? "pagar" : "receber"}">${r.Tipo}</td>
          <td>${r.Descrição}</td>
          <td>${r.Favorecido}</td>
          <td style="text-align:right">${formatBRL(r.Valor)}</td>
          <td>${r.Status}</td>
        </tr>`).join("")}
      </tbody>
      <tfoot><tr>
        <td colspan="4">Total</td>
        <td style="text-align:right">${formatBRL(totaisConsulta.aReceber - totaisConsulta.aPagar)}</td>
        <td></td>
      </tr></tfoot>
    </table>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };
  const { data: planosContas = [] } = useQuery<PlanoConta[]>({ queryKey: ["/api/control/planos-contas"] });
  const { data: centros = [] } = useQuery<CentroCusto[]>({
    queryKey: ["/api/control/clientes", clienteId, "centros-custo"], enabled: !!clienteId,
  });
  const { data: contas = [] } = useQuery<ContaBancaria[]>({
    queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"], enabled: !!clienteId,
  });
  const { data: tiposDoc = [] } = useQuery<{ id: string; nome: string }[]>({
    queryKey: ["/api/control/tipos-documento"],
  });
  const { data: relatorio } = useQuery<any>({
    queryKey: ["/api/control/clientes", clienteId, "relatorio-pagamentos"],
    enabled: !!clienteId && tab === "relatorio",
  });

  const { data: dashCompleto, isLoading: loadingDash } = useQuery<DashboardCompleto>({
    queryKey: ["/api/control/clientes", clienteId, "dashboard-completo", dashMeses],
    queryFn: async () => {
      const r = await fetch(
        `/api/control/clientes/${clienteId}/dashboard-completo?meses=${dashMeses}`,
        { credentials: "include" }
      );
      if (!r.ok) throw new Error("Falha ao carregar dashboard");
      return r.json();
    },
    enabled: !!clienteId && tab === "dashboard",
    staleTime: 60_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId] });
  };

  // ───── Form lançamento
  const form = useForm<z.infer<typeof lancamentoFormSchema>>({
    resolver: zodResolver(lancamentoFormSchema),
    defaultValues: {
      tipo: "pagar", descricao: "", favorecido: "", pessoaId: "",
      projetoCodigo: "", parceiro: "",
      documento: "", osNumero: "", valor: "",
      dataEmissao: "", dataVencimento: new Date().toISOString().slice(0, 10),
      status: "previsto", planoContaId: "", centroCustoId: "",
      contaBancariaId: "", tipoDocumentoId: "", projetoId: "", observacoes: "",
    },
  });
  const createLanc = useMutation({
    mutationFn: async (vals: any) => apiRequest("POST", `/api/control/clientes/${clienteId}/lancamentos`, vals),
    onSuccess: () => {
      toast({ title: "Lançamento criado" });
      setOpenLanc(false);
      form.reset();
      invalidateAll();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
  const aprovarLanc = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/control/lancamentos/${id}/aprovar`),
    onSuccess: () => { toast({ title: "Aprovado" }); invalidateAll(); },
  });
  const pagarLanc = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/control/lancamentos/${id}/pagar`),
    onSuccess: () => { toast({ title: "Pagamento registrado" }); invalidateAll(); },
  });
  const deleteLanc = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/control/lancamentos/${id}`),
    onSuccess: () => { toast({ title: "Excluído" }); invalidateAll(); },
  });
  const programarLanc = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/control/lancamentos/${id}/programar`),
    onSuccess: () => { toast({ title: "Enviado para programação", description: "Aguardando confirmação do Diretor Financeiro" }); invalidateAll(); },
    onError: (e: any) => toast({ title: "Erro ao programar", description: e.message, variant: "destructive" }),
  });

  if (!cliente) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 pt-3 pb-0 space-y-2" data-testid="page-control-detalhe">
      {/* ── Cabeçalho compacto: breadcrumb + título + ações em uma linha ── */}
      <div className="flex items-center gap-2 min-w-0" data-testid="header-control">
        {/* Voltar */}
        <Link href="/control">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        {/* Título + breadcrumb empilhados */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground leading-none mb-0.5">
            <Link href="/" className="hover:text-foreground transition-colors">Suite</Link>
            <span>/</span>
            <Link href="/control" className="hover:text-foreground transition-colors">Control</Link>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold leading-tight truncate" data-testid="text-cliente-nome">{cliente.nome}</h1>
            {cliente.cnpj && <span className="text-xs text-muted-foreground shrink-0">CNPJ {cliente.cnpj}</span>}
          </div>
        </div>

        {/* Ações primárias sempre visíveis */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href={`/control/${clienteId}/centros-custo`}>
            <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="button-control-centros-custo">
              <Building className="h-3.5 w-3.5 mr-1" /> Centros de Custo
            </Button>
          </Link>
          <Link href={`/control/${clienteId}/recorrencias`}>
            <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="button-control-recorrencias">
              <Repeat className="h-3.5 w-3.5 mr-1" /> Recorrências
            </Button>
          </Link>
          <Link href={`/control/${clienteId}/orcamento`}>
            <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="button-control-orcamento">
              <BarChart3 className="h-3.5 w-3.5 mr-1" /> Orçamento
            </Button>
          </Link>

          {/* Relatórios e ferramentas no dropdown "Mais" */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="button-control-mais">
                Mais ▾
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/control/${clienteId}/fluxo-caixa-mensal`} className="flex items-center gap-2 cursor-pointer">
                  <TrendingUp className="h-3.5 w-3.5" /> FC Mensal
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/control/${clienteId}/fluxo-caixa-diario`} className="flex items-center gap-2 cursor-pointer">
                  <CalendarDays className="h-3.5 w-3.5" /> FC Diário
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/control/${clienteId}/dre`} className="flex items-center gap-2 cursor-pointer">
                  <BarChart3 className="h-3.5 w-3.5" /> DRE
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/control/${clienteId}/pivot`} className="flex items-center gap-2 cursor-pointer">
                  <Users className="h-3.5 w-3.5" /> Pivot
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/control/${clienteId}/calendario`} className="flex items-center gap-2 cursor-pointer">
                  <CalendarIcon className="h-3.5 w-3.5" /> Calendário
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/control/${clienteId}/setup`} className="flex items-center gap-2 cursor-pointer">
                  <Wand2 className="h-3.5 w-3.5" /> Setup
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="overflow-x-auto pb-1">
        <TabsList className="flex w-max min-w-full">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard"><DollarSign className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="lancamentos" data-testid="tab-lancamentos"><ListTree className="h-4 w-4 mr-1" />Lançamentos</TabsTrigger>
          <TabsTrigger value="contas" data-testid="tab-contas"><Banknote className="h-4 w-4 mr-1" />Contas Bancárias</TabsTrigger>
          <TabsTrigger value="centros" data-testid="tab-centros"><Building className="h-4 w-4 mr-1" />Centros de Custo</TabsTrigger>
          <TabsTrigger value="relatorio" data-testid="tab-relatorio"><FileSpreadsheet className="h-4 w-4 mr-1" />Relatório</TabsTrigger>
          <TabsTrigger value="plano-contas" data-testid="tab-plano-contas"><BookOpen className="h-4 w-4 mr-1" />Plano de Contas</TabsTrigger>
          <TabsTrigger value="grupos" data-testid="tab-grupos"><Building2 className="h-4 w-4 mr-1" />Grupos</TabsTrigger>
          <TabsTrigger value="conectores" data-testid="tab-conectores"><Plug className="h-4 w-4 mr-1" />Conectores</TabsTrigger>
          <TabsTrigger value="import" data-testid="tab-import"><Upload className="h-4 w-4 mr-1" />Import</TabsTrigger>
          <TabsTrigger value="painel-fiscal" data-testid="tab-painel-fiscal"><Calculator className="h-4 w-4 mr-1" />Painel Fiscal</TabsTrigger>
          <TabsTrigger value="fleuriet" data-testid="tab-fleuriet"><Activity className="h-4 w-4 mr-1" />Fleuriet</TabsTrigger>
          <TabsTrigger value="fechamento" data-testid="tab-fechamento"><Lock className="h-4 w-4 mr-1" />Fechamento</TabsTrigger>
          <TabsTrigger value="nfe-monitor" data-testid="tab-nfe-monitor"><FileText className="h-4 w-4 mr-1" />NF-e</TabsTrigger>
          <TabsTrigger value="bases-receita" data-testid="tab-bases-receita"><TrendingUp className="h-4 w-4 mr-1" />Bases</TabsTrigger>
          <TabsTrigger value="dre-projetos" data-testid="tab-dre-projetos"><BarChart3 className="h-4 w-4 mr-1" />DRE Proj.</TabsTrigger>
          <TabsTrigger value="rateio" data-testid="tab-rateio"><Wand2 className="h-4 w-4 mr-1" />Rateio</TabsTrigger>
        </TabsList>
        </div>

        {/* DASHBOARD — CTL-07 */}
        <TabsContent value="dashboard" className="space-y-4">

          {/* ── Filtro de período ──────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Visão financeira</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Período:</span>
              <Select value={String(dashMeses)} onValueChange={(v) => setDashMeses(Number(v))}>
                <SelectTrigger className="w-36 h-8" data-testid="select-dash-periodo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Mês atual</SelectItem>
                  <SelectItem value="3">Últimos 3 meses</SelectItem>
                  <SelectItem value="6">Últimos 6 meses</SelectItem>
                  <SelectItem value="12">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── KPIs existentes (mantidos) ──────────────────────────────── */}
          {loadingOv ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-pagar-vencidos">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3 text-destructive" /> A pagar vencidos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-destructive">{formatBRL(overview?.aPagarVencidos || 0)}</div>
                  </CardContent>
                </Card>
                <Card data-testid="card-pagar-7d">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <ArrowDownCircle className="h-3 w-3 text-orange-500" /> A pagar 7 dias
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{formatBRL(overview?.aPagar7d || 0)}</div>
                  </CardContent>
                </Card>
                <Card data-testid="card-receber-vencidos">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3 text-amber-500" /> A receber vencidos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-amber-600 dark:text-amber-400">{formatBRL(overview?.aReceberVencidos || 0)}</div>
                  </CardContent>
                </Card>
                <Card data-testid="card-receber-7d">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <ArrowUpCircle className="h-3 w-3 text-emerald-500" /> A receber 7 dias
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{formatBRL(overview?.aReceber7d || 0)}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-pago-mes">
                  <CardHeader className="pb-2"><CardDescription className="text-xs">Pago no mês</CardDescription></CardHeader>
                  <CardContent><div className="text-xl font-medium">{formatBRL(overview?.pagoMes || 0)}</div></CardContent>
                </Card>
                <Card data-testid="card-recebido-mes">
                  <CardHeader className="pb-2"><CardDescription className="text-xs">Recebido no mês</CardDescription></CardHeader>
                  <CardContent><div className="text-xl font-medium">{formatBRL(overview?.recebidoMes || 0)}</div></CardContent>
                </Card>
                <Card data-testid="card-saldo-bancario">
                  <CardHeader className="pb-2"><CardDescription className="text-xs">Saldo bancário ({overview?.totalContasBancarias || 0} contas)</CardDescription></CardHeader>
                  <CardContent><div className="text-xl font-medium">{formatBRL(overview?.saldoBancarioTotal || 0)}</div></CardContent>
                </Card>
                <Card data-testid="card-pendentes">
                  <CardHeader className="pb-2"><CardDescription className="text-xs">Pendentes de aprovação</CardDescription></CardHeader>
                  <CardContent><div className="text-xl font-medium">{overview?.pendentesAprovacao || 0}</div></CardContent>
                </Card>
              </div>

              <PmpPmrCards clienteId={clienteId} />
            </>
          )}

          {/* ── SEÇÃO NOVA: Saldos por Conta Bancária ──────────────────── */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Banknote className="h-4 w-4" /> Saldos por Conta
            </h3>
            {loadingDash ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : !dashCompleto?.contas?.length ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma conta ativa. Configure no{" "}
                <button
                  className="underline text-primary"
                  onClick={() => navigate(`/control/${clienteId}/setup`)}
                >
                  Setup
                </button>.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dashCompleto.contas.map((conta) => {
                  const variacao = conta.saldoAtual - conta.saldoInicial;
                  const tipoCor = ({
                    cc:               "border-l-blue-500",
                    cp:               "border-l-purple-500",
                    investimento:     "border-l-green-500",
                    cartao_corporativo:"border-l-orange-500",
                  } as Record<string, string>)[conta.tipo] ?? "border-l-slate-400";
                  return (
                    <Card key={conta.id} className={`border-l-4 ${tipoCor}`} data-testid={`card-conta-${conta.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{conta.banco}</p>
                            {(conta.agencia || conta.conta) && (
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                {[conta.agencia, conta.conta].filter(Boolean).join(" • ")}
                              </p>
                            )}
                            <Badge variant="outline" className="text-xs mt-1 capitalize">
                              {conta.tipo === "cc" ? "Conta corrente"
                                : conta.tipo === "cp" ? "Poupança"
                                : conta.tipo === "investimento" ? "Investimento"
                                : conta.tipo === "cartao_corporativo" ? "Cartão corporativo"
                                : conta.tipo}
                            </Badge>
                          </div>
                          <div className="text-right ml-3">
                            <p className="font-semibold text-sm">{formatBRL(conta.saldoAtual)}</p>
                            {variacao !== 0 && (
                              <p className={`text-xs ${variacao >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                                {variacao >= 0 ? "+" : ""}{formatBRL(variacao)}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── SEÇÃO NOVA: Card Orçamento do Mês ──────────────────────── */}
          {dashCompleto?.orcamentoMes && (
            <Card data-testid="card-orcamento-mes">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Orçamento — {new Date(dashCompleto.orcamentoMes.ano, dashCompleto.orcamentoMes.mes - 1)
                    .toLocaleString("pt-BR", { month: "long", year: "numeric" })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashCompleto.orcamentoMes.previsto === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Orçamento não configurado para este mês.{" "}
                    <button className="underline text-primary" onClick={() => setTab("relatorio")}>
                      Configurar orçamento
                    </button>
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Previsto</p>
                        <p className="font-semibold">{formatBRL(dashCompleto.orcamentoMes.previsto)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Realizado</p>
                        <p className="font-semibold">{formatBRL(dashCompleto.orcamentoMes.realizado)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Desvio</p>
                        <p className={`font-semibold ${
                          dashCompleto.orcamentoMes.desvio === null ? "" :
                          dashCompleto.orcamentoMes.desvio > 10 ? "text-destructive" :
                          dashCompleto.orcamentoMes.desvio > 0 ? "text-amber-600" :
                          "text-emerald-600"
                        }`}>
                          {dashCompleto.orcamentoMes.desvio === null
                            ? "—"
                            : `${dashCompleto.orcamentoMes.desvio >= 0 ? "+" : ""}${dashCompleto.orcamentoMes.desvio.toFixed(1)}%`}
                        </p>
                      </div>
                    </div>
                    {dashCompleto.orcamentoMes.previsto > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>0%</span>
                          <span>{Math.min(
                            dashCompleto.orcamentoMes.realizado / dashCompleto.orcamentoMes.previsto * 100,
                            150
                          ).toFixed(0)}% utilizado</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              dashCompleto.orcamentoMes.desvio !== null && dashCompleto.orcamentoMes.desvio > 10
                                ? "bg-destructive" : "bg-primary"
                            }`}
                            style={{
                              width: `${Math.min(
                                dashCompleto.orcamentoMes.realizado / dashCompleto.orcamentoMes.previsto * 100,
                                100
                              )}%`
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {(dashCompleto.alertasOrcamento?.length ?? 0) > 0 && (
                      <div className="border-t pt-3 mt-3 space-y-1" data-testid="section-alertas-orcamento">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Grupos com desvio &gt;10%
                        </p>
                        {dashCompleto.alertasOrcamento!.map((a) => (
                          <div key={a.grupo} className="flex items-center justify-between text-xs" data-testid={`alerta-grupo-${a.grupo}`}>
                            <span className="font-medium truncate max-w-[140px]" title={a.grupo}>{a.grupo}</span>
                            <span className={`font-semibold ${a.desvio > 0 ? "text-destructive" : "text-emerald-600"}`}>
                              {a.desvio >= 0 ? "+" : ""}{a.desvio.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── SEÇÃO NOVA: Top Clientes e Fornecedores ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Clientes */}
            <Card data-testid="card-top-clientes">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                  Top Clientes — por recebimento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingDash ? (
                  <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                ) : !dashCompleto?.topClientes?.length ? (
                  <p className="text-sm text-muted-foreground p-4">Nenhum recebimento no período.</p>
                ) : (
                  <div className="divide-y">
                    {dashCompleto.topClientes.map((c, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30" data-testid={`row-top-cliente-${idx}`}>
                        <span className="text-xs text-muted-foreground w-5 font-mono">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.qtdLancamentos} recebimento{c.qtdLancamentos !== 1 ? "s" : ""}
                            {c.pmrDias !== null && ` · PMR ${c.pmrDias.toFixed(0)}d`}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-emerald-600 whitespace-nowrap">{formatBRL(c.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Fornecedores */}
            <Card data-testid="card-top-fornecedores">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-orange-500" />
                  Top Fornecedores — por pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingDash ? (
                  <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                ) : !dashCompleto?.topFornecedores?.length ? (
                  <p className="text-sm text-muted-foreground p-4">Nenhum pagamento no período.</p>
                ) : (
                  <div className="divide-y">
                    {dashCompleto.topFornecedores.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30" data-testid={`row-top-fornecedor-${idx}`}>
                        <span className="text-xs text-muted-foreground w-5 font-mono">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.qtdLancamentos} pagamento{f.qtdLancamentos !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-orange-600 whitespace-nowrap">{formatBRL(f.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        {/* LANÇAMENTOS */}
        <TabsContent value="lancamentos" className="space-y-4">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Tipo</span>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-36" data-testid="select-filtro-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pagar">A pagar</SelectItem>
                  <SelectItem value="receber">A receber</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-36" data-testid="select-filtro-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="previsto">Previsto</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Período por</span>
              <Select value={filtroCampoData} onValueChange={(v) => setFiltroCampoData(v as "vencimento" | "emissao" | "pagamento")}>
                <SelectTrigger className="w-36" data-testid="select-filtro-campo-data"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vencimento">Vencimento</SelectItem>
                  <SelectItem value="emissao">Emissão</SelectItem>
                  <SelectItem value="pagamento">Pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">De</span>
              <DateInputBR value={filtroDataIni} onChange={(v) => setFiltroDataIni(v)}
                className="w-40" data-testid="input-filtro-data-ini" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Até</span>
              <DateInputBR value={filtroDataFim} onChange={(v) => setFiltroDataFim(v)}
                className="w-40" data-testid="input-filtro-data-fim" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className="text-xs text-muted-foreground">Buscar</span>
              <Input placeholder="Descrição, favorecido ou documento..."
                value={filtroBusca} onChange={(e) => setFiltroBusca(e.target.value)}
                data-testid="input-filtro-busca" />
            </div>
            <Button variant="outline" size="sm" onClick={limparFiltros} data-testid="button-limpar-filtros">Limpar</Button>
            <div className="ml-auto flex gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-workflow-pgtos">
                    <Workflow className="h-4 w-4 mr-1" />Workflow Pgtos
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
                  <SheetHeader className="mb-4">
                    <SheetTitle className="flex items-center gap-2">
                      <Workflow className="h-4 w-4" /> Workflow de Pagamentos
                    </SheetTitle>
                  </SheetHeader>
                  <PagamentosWorkflowTab clienteId={clienteId!} />
                </SheetContent>
              </Sheet>
              <ImportLancamentosDialog clienteId={clienteId!} />
              <ParcelarLancamentoDialog clienteId={clienteId!} />
              <Dialog open={openLanc} onOpenChange={setOpenLanc}>
                <DialogTrigger asChild>
                  <Button data-testid="button-novo-lancamento"><Plus className="h-4 w-4 mr-1" />Novo Lançamento</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0">
                  <DialogHeader className="px-6 pt-6 pb-2 shrink-0"><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((v) => createLanc.mutate({
                        ...v,
                        dataEmissao: v.dataEmissao || null,
                        dataPagamento: (v as any).dataPagamento || null,
                      }))} className="flex flex-col flex-1 min-h-0">
                    <div className="overflow-y-auto flex-1 px-6 py-2 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="tipo" render={({ field }) => (
                          <FormItem><FormLabel>Tipo</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger data-testid="select-tipo"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="pagar">A pagar</SelectItem>
                                <SelectItem value="receber">A receber</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="status" render={({ field }) => (
                          <FormItem><FormLabel>Status inicial</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="previsto">Previsto</SelectItem>
                                <SelectItem value="aprovado">Aprovado</SelectItem>
                                <SelectItem value="pago">Pago</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="descricao" render={({ field }) => (
                        <FormItem><FormLabel>Descrição</FormLabel>
                          <FormControl><Input {...field} data-testid="input-descricao" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                      {/* Favorecido com picker semântico */}
                      <div className="space-y-1">
                        <Label>Favorecido / Pagador</Label>
                        <FavorecidoPicker
                          value={form.watch("pessoaId") || undefined}
                          label={form.watch("favorecido") || undefined}
                          onChange={(pessoaId, pessoa) => {
                            form.setValue("pessoaId", pessoaId ?? "");
                            form.setValue("favorecido", pessoa?.nomeFantasia ?? "");
                          }}
                          onQuickCreate={() => setShowQuickCreatePessoa(true)}
                          placeholder="Buscar fornecedor, cliente ou empresa..."
                          data-testid="favorecido-picker-novo"
                        />
                        <QuickCreatePessoaDialog
                          open={showQuickCreatePessoa}
                          onOpenChange={setShowQuickCreatePessoa}
                          papelPadrao="fornecedor"
                          onCreated={(pessoa) => {
                            form.setValue("pessoaId", pessoa.id);
                            form.setValue("favorecido", pessoa.nomeFantasia);
                            setShowQuickCreatePessoa(false);
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <FormField control={form.control} name="documento" render={({ field }) => (
                          <FormItem><FormLabel>Documento</FormLabel>
                            <FormControl><Input {...field} placeholder="NF, boleto..." data-testid="input-documento" /></FormControl>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="osNumero" render={({ field }) => (
                          <FormItem><FormLabel>Nº OS / Contrato</FormLabel>
                            <FormControl><Input {...field} placeholder="Ex.: OS-2024-001" data-testid="input-os-numero" /></FormControl>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="valor" render={({ field }) => (
                          <FormItem><FormLabel>Valor (R$)</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} data-testid="input-valor" /></FormControl>
                            <FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="dataEmissao" render={({ field }) => (
                          <FormItem><FormLabel>Emissão</FormLabel>
                            <FormControl>
                              <DateInputBR
                                value={field.value ?? ""}
                                onChange={(v) => field.onChange(v)}
                                data-testid="input-data-emissao"
                              />
                            </FormControl>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="dataVencimento" render={({ field }) => (
                          <FormItem><FormLabel>Vencimento *</FormLabel>
                            <FormControl>
                              <DateInputBR
                                value={field.value ?? ""}
                                onChange={(v) => field.onChange(v)}
                                data-testid="input-data-vencimento"
                              />
                            </FormControl>
                            <FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <FormField control={form.control} name="planoContaId" render={({ field }) => (
                          <FormItem><FormLabel>Plano de Conta</FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger data-testid="select-plano-conta"><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                              <SelectContent className="max-h-60">
                                {planosContas.filter((p) => p.permiteLancamento).map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.descricao}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="centroCustoId" render={({ field }) => (
                          <FormItem><FormLabel>Centro de Custo</FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger data-testid="select-centro-custo"><SelectValue placeholder="(opcional)" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {centros.map((c) => (<SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>))}
                              </SelectContent>
                            </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="contaBancariaId" render={({ field }) => {
                          const contasAtivas = contas.filter((c) => c.ativo);
                          const semContas = contasAtivas.length === 0;
                          return (
                            <FormItem><FormLabel>Conta Bancária *</FormLabel>
                              <Select value={field.value || ""} onValueChange={field.onChange} disabled={semContas}>
                                <FormControl><SelectTrigger data-testid="select-conta-bancaria"><SelectValue placeholder={semContas ? "Cadastre uma conta na aba Contas Bancárias" : "Selecione..."} /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {contasAtivas.map((c) => (<SelectItem key={c.id} value={c.id}>{c.banco} {c.conta || ""}</SelectItem>))}
                                </SelectContent>
                              </Select>
                              {semContas && <p className="text-xs text-destructive mt-1">Sem contas ativas — cadastre uma na aba Contas Bancárias antes de lançar.</p>}
                              <FormMessage />
                            </FormItem>
                          );
                        }} />
                      </div>
                      {/* Tipo de documento + Projeto */}
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="tipoDocumentoId" render={({ field }) => (
                          <FormItem><FormLabel>Tipo de documento</FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger data-testid="select-tipo-doc-novo"><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {tiposDoc.map((t) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}
                              </SelectContent>
                            </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <div className="space-y-1">
                          <Label>Projeto</Label>
                          <ProjectPicker
                            value={form.watch("projetoId") || undefined}
                            label={undefined}
                            onChange={(projetoId) => form.setValue("projetoId", projetoId ?? "")}
                            placeholder="Vincular a um projeto..."
                          />
                        </div>
                      </div>

                      <FormField control={form.control} name="observacoes" render={({ field }) => (
                        <FormItem><FormLabel>Observações</FormLabel>
                          <FormControl><Textarea {...field} rows={2} data-testid="input-observacoes" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                    </div>
                      <DialogFooter className="px-6 py-4 border-t shrink-0">
                        <Button type="button" variant="outline" onClick={() => setOpenLanc(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createLanc.isPending} data-testid="button-salvar-lancamento">
                          {createLanc.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingLanc ? (
                <div className="p-6 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : lancamentos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum lançamento. Use "Novo Lançamento" para começar.
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lancamentosPage.map((l) => {
                      // Sprint C7 — G6: prioriza status calculado virtual sobre o persistido
                      const effectiveStatus = l.statusCalc || l.status;
                      const sb = statusBadge[effectiveStatus] || statusBadge.previsto;
                      const Icon = sb.icon;
                      return (
                        <TableRow key={l.id} data-testid={`row-lanc-${l.id}`}>
                          <TableCell className="text-sm whitespace-nowrap">{formatDateBR(l.dataVencimento)}</TableCell>
                          <TableCell>
                            {l.tipo === "pagar"
                              ? <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 text-sm"><ArrowDownCircle className="h-3 w-3" />Pagar</span>
                              : <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm"><ArrowUpCircle className="h-3 w-3" />Receber</span>}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{l.descricao}</div>
                            {l.favorecido && <div className="text-xs text-muted-foreground">{l.favorecido}</div>}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {l.criadoPorIa && <Badge variant="outline" className="text-xs">IA</Badge>}
                              {l.numeroParcela && l.totalParcelas && (
                                <Badge variant="outline" className="text-xs" data-testid={`badge-parcela-${l.id}`}>
                                  Parcela {l.numeroParcela}/{l.totalParcelas}
                                </Badge>
                              )}
                              {l.origemRecorrencia && (
                                <Badge variant="outline" className="text-xs gap-1" data-testid={`badge-recorrencia-${l.id}`}>
                                  <Repeat className="h-3 w-3" /> Recorrente
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatBRL(l.valor)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={sb.variant} className={`gap-1 ${sb.className ?? ""}`} data-testid={`badge-status-${l.id}`}>
                                <Icon className="h-3 w-3" />{sb.label}
                              </Badge>
                              {l.workflowStatus && workflowBadge[l.workflowStatus] && (() => {
                                const wb = workflowBadge[l.workflowStatus!];
                                const WbIcon = wb.icon;
                                return (
                                  <Badge variant="outline" className={`gap-1 text-xs ${wb.className}`} data-testid={`badge-workflow-${l.id}`}>
                                    <WbIcon className="h-3 w-3" />{wb.label}
                                  </Badge>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <EditLancamentoDialog lancamento={l as any} clienteId={clienteId!} />
                              {l.status !== "cancelado" && (
                                <ConciliarLancamentoDialog lancamento={l as any} clienteId={clienteId!} />
                              )}
                              {l.status === "previsto" && (
                                <Button size="sm" variant="ghost" title="Aprovar" onClick={() => aprovarLanc.mutate(l.id)} data-testid={`button-aprovar-${l.id}`}>
                                  <CheckSquare className="h-4 w-4" />
                                </Button>
                              )}
                              {/* Enviar para programação de pagamento */}
                              {l.tipo === "pagar" && l.status !== "pago" && l.status !== "cancelado" && !l.workflowStatus && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Enviar para programação de pagamento"
                                  onClick={() => programarLanc.mutate(l.id)}
                                  disabled={programarLanc.isPending}
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  data-testid={`button-programar-${l.id}`}
                                >
                                  <SendHorizontal className="h-4 w-4" />
                                </Button>
                              )}
                              {l.status !== "pago" && l.status !== "cancelado" && (
                                <Button size="sm" variant="ghost" title="Marcar como pago/recebido (rápido)" onClick={() => pagarLanc.mutate(l.id)} data-testid={`button-pagar-${l.id}`}>
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" title="Excluir" onClick={() => deleteLanc.mutate(l.id)} data-testid={`button-deletar-${l.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
            {lancamentos.length > 0 && (
              <div className="border-t px-4 py-2 bg-muted/30 flex items-center gap-3 text-xs flex-wrap" data-testid="footer-lancamentos">
                {/* Totais */}
                <span className="text-muted-foreground" data-testid="footer-totais-consulta">
                  <strong className="text-foreground">{totaisConsulta.qtd}</strong> lançs.
                </span>
                <span className="text-muted-foreground hidden sm:inline">Pagar: <strong className="text-orange-600 dark:text-orange-400" data-testid="text-total-pagar">{formatBRL(totaisConsulta.aPagar)}</strong></span>
                <span className="text-muted-foreground hidden sm:inline">Receber: <strong className="text-emerald-600 dark:text-emerald-400" data-testid="text-total-receber">{formatBRL(totaisConsulta.aReceber)}</strong></span>
                <span className="text-muted-foreground">Saldo: <strong className={totaisConsulta.saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"} data-testid="text-total-saldo">{formatBRL(totaisConsulta.saldo)}</strong></span>

                {/* Espaçador */}
                <span className="flex-1" />

                {/* Exportar */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 px-2 gap-1 text-xs" data-testid="button-exportar" disabled={lancamentos.length === 0}>
                      <FileDown className="h-3 w-3" /> Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-xs">
                    <DropdownMenuItem onClick={exportXLSX} data-testid="export-xlsx">
                      <FileSpreadsheet className="mr-2 h-3.5 w-3.5 text-emerald-600" /> Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportCSV} data-testid="export-csv">
                      <FileText className="mr-2 h-3.5 w-3.5 text-blue-600" /> CSV (.csv)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={exportPDF} data-testid="export-pdf">
                      <FileDown className="mr-2 h-3.5 w-3.5 text-red-600" /> PDF (imprimir)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Paginação inline */}
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground hidden md:inline">Exibir</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="h-6 w-16 text-xs py-0" data-testid="select-page-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  {totalPages > 1 && (
                    <>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} data-testid="button-page-first">«</Button>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} data-testid="button-page-prev">‹</Button>
                      <span className="text-muted-foreground whitespace-nowrap">{currentPage}/{totalPages}</span>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} data-testid="button-page-next">›</Button>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} data-testid="button-page-last">»</Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* CONTAS BANCÁRIAS — com sub-views Cartão e Carteiras */}
        <TabsContent value="contas">
          <ContasBancariasComSubView clienteId={clienteId!} contas={contas} />
        </TabsContent>

        {/* CENTROS DE CUSTO */}
        <TabsContent value="centros">
          <CentrosCustoTab clienteId={clienteId!} centros={centros} />
        </TabsContent>

        {/* RELATÓRIO */}
        <TabsContent value="relatorio" className="space-y-4">
          {!relatorio ? <Skeleton className="h-32" /> : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card><CardHeader className="pb-2"><CardDescription>Total a pagar</CardDescription></CardHeader>
                  <CardContent><div className="text-xl font-semibold text-orange-600 dark:text-orange-400">{formatBRL(relatorio.totalPagar)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardDescription>Total a receber</CardDescription></CardHeader>
                  <CardContent><div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{formatBRL(relatorio.totalReceber)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardDescription>Saldo líquido projetado</CardDescription></CardHeader>
                  <CardContent><div className={`text-xl font-semibold ${relatorio.saldoLiquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>{formatBRL(relatorio.saldoLiquido)}</div></CardContent></Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Próximos 7 dias — pagamentos e recebimentos</CardTitle>
                  <CardDescription>De {relatorio.dataIni} até {relatorio.dataFim}</CardDescription>
                </CardHeader>
                <CardContent>
                  {relatorio.lancamentos.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">Sem lançamentos no período.</div>
                  ) : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Vencimento</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {relatorio.lancamentos.map((l: any) => (
                          <TableRow key={l.id}>
                            <TableCell className="text-sm">{formatDateBR(l.dataVencimento)}</TableCell>
                            <TableCell><Badge variant="outline">{l.tipo}</Badge></TableCell>
                            <TableCell className="text-sm">{l.descricao}</TableCell>
                            <TableCell className="text-right">{formatBRL(l.valor)}</TableCell>
                            <TableCell><Badge variant="secondary">{l.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* SPRINTS 4 + 5 — Tabs novas */}
        <TabsContent value="plano-contas">
          <PlanoContasTab clienteId={clienteId!} />
        </TabsContent>
        <TabsContent value="grupos">
          <GruposTab clienteId={clienteId!} />
        </TabsContent>
        <TabsContent value="conectores">
          <ConectoresTab clienteId={clienteId!} />
        </TabsContent>
        <TabsContent value="import">
          <ImportTab clienteId={clienteId!} />
        </TabsContent>
        <TabsContent value="painel-fiscal">
          <PainelFiscalTab clienteId={clienteId!} />
        </TabsContent>
        <TabsContent value="fleuriet">
          <FleurietTab clienteId={clienteId!} />
        </TabsContent>
        <TabsContent value="fechamento">
          <FechamentoTab clienteId={clienteId!} />
        </TabsContent>
        <TabsContent value="nfe-monitor">
          <NfeMonitorTab clienteId={clienteId!} />
        </TabsContent>
        <TabsContent value="bases-receita">
          <BasesReceitaTab clienteId={clienteId!} />
        </TabsContent>
        <TabsContent value="dre-projetos">
          <DreProjetos clienteId={clienteId!} />
        </TabsContent>
        <TabsContent value="rateio">
          <RateioTab clienteId={clienteId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────── Sub-componentes

// Wrapper que unifica Contas Bancárias + Cartão Corporativo + Carteiras em sub-views
function ContasBancariasComSubView({ clienteId, contas }: { clienteId: string; contas: ContaBancaria[] }) {
  const [subView, setSubView] = useState<"contas" | "cartao" | "carteiras">("contas");
  return (
    <div className="space-y-4">
      {/* Sub-nav */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={subView === "contas" ? "default" : "outline"}
          size="sm"
          onClick={() => setSubView("contas")}
          data-testid="btn-subview-contas"
        >
          <Banknote className="h-4 w-4 mr-1" /> Contas Bancárias
        </Button>
        <Button
          variant={subView === "cartao" ? "default" : "outline"}
          size="sm"
          onClick={() => setSubView("cartao")}
          data-testid="btn-subview-cartao"
        >
          <CreditCard className="h-4 w-4 mr-1" /> Cartão Corporativo
        </Button>
        <Link href={`/control/${clienteId}/carteiras`}>
          <Button
            variant={subView === "carteiras" ? "default" : "outline"}
            size="sm"
            data-testid="btn-subview-carteiras"
          >
            <Wallet className="h-4 w-4 mr-1" /> Carteiras
          </Button>
        </Link>
      </div>

      {subView === "contas" && <ContasBancariasTab clienteId={clienteId} contas={contas} />}
      {subView === "cartao" && <CartaoTab clienteId={clienteId} />}
    </div>
  );
}

// Sprint C7: ContasBancariasTab agora expõe TransferenciaDialog (nova) e
// SaldoInicialDialog (em cada linha).
function ContasBancariasTab({ clienteId, contas }: { clienteId: string; contas: ContaBancaria[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const form = useForm({
    defaultValues: { banco: "", agencia: "", conta: "", tipo: "cc", saldoInicial: "0" },
  });
  const create = useMutation({
    mutationFn: async (v: any) => apiRequest("POST", `/api/control/clientes/${clienteId}/contas-bancarias`, v),
    onSuccess: () => {
      toast({ title: "Conta criada" });
      setOpen(false); form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "overview"] });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar conta", description: e?.message ?? "Tente novamente", variant: "destructive" });
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/control/contas-bancarias/${id}`),
    onSuccess: () => {
      toast({ title: "Conta removida" });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "overview"] });
    },
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div><CardTitle className="text-base">Contas Bancárias</CardTitle></div>
        <div className="flex gap-2">
        {contas.filter((c) => c.ativo).length >= 2 && (
          <TransferenciaDialog clienteId={clienteId} />
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" data-testid="button-nova-conta-bancaria"><Plus className="h-4 w-4 mr-1" />Nova</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Conta Bancária</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-3">
                <FormField control={form.control} name="banco" render={({ field }) => (
                  <FormItem><FormLabel>Banco *</FormLabel><FormControl><Input {...field} required data-testid="input-banco" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="agencia" render={({ field }) => (
                    <FormItem><FormLabel>Agência</FormLabel><FormControl><Input {...field} data-testid="input-agencia" /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="conta" render={({ field }) => (
                    <FormItem><FormLabel>Conta</FormLabel><FormControl><Input {...field} data-testid="input-conta" /></FormControl></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="tipo" render={({ field }) => (
                    <FormItem><FormLabel>Tipo</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger data-testid="select-tipo-conta"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="cc">Conta Corrente</SelectItem>
                          <SelectItem value="poupanca">Poupança</SelectItem>
                          <SelectItem value="caixa">Caixa</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="saldoInicial" render={({ field }) => (
                    <FormItem><FormLabel>Saldo inicial (R$)</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-saldo-inicial" /></FormControl></FormItem>
                  )} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending} data-testid="button-salvar-conta-bancaria">{create.isPending ? "Salvando..." : "Salvar"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {contas.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma conta bancária cadastrada.</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Banco</TableHead><TableHead>Ag/Cc</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Saldo Atual</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {contas.map((c) => (
                <TableRow key={c.id} data-testid={`row-conta-${c.id}`}>
                  <TableCell className="font-medium">{c.banco}</TableCell>
                  <TableCell className="text-sm">{c.agencia || "-"} / {c.conta || "-"}</TableCell>
                  <TableCell><Badge variant="outline">{c.tipo}</Badge></TableCell>
                  <TableCell className="text-right" data-testid={`text-saldo-conta-${c.id}`}>{formatBRL(c.saldoAtual)}</TableCell>
                  <TableCell className="text-right">
                    <SaldoInicialDialog contaId={c.id} banco={c.banco} saldoAtual={(c as any).saldoInicial} clienteId={clienteId} />
                    <ExtratoDialog contaId={c.id} banco={c.banco} />
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(c.id)} data-testid={`button-remover-conta-${c.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function CentrosCustoTab({ clienteId, centros }: { clienteId: string; centros: CentroCusto[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const form = useForm({ defaultValues: { codigo: "", nome: "", descricao: "" } });
  const create = useMutation({
    mutationFn: async (v: any) => apiRequest("POST", `/api/control/clientes/${clienteId}/centros-custo`, { tipo: "departamento", ...v }),
    onSuccess: () => {
      toast({ title: "Centro de custo criado" });
      setOpen(false); form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"] });
    },
    onError: (e: any) => toast({ title: "Erro ao criar CC", description: e?.message ?? "Falhou", variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/control/centros-custo/${id}`),
    onSuccess: () => {
      toast({ title: "Centro removido" });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"] });
    },
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div><CardTitle className="text-base">Centros de Custo</CardTitle></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" data-testid="button-novo-centro"><Plus className="h-4 w-4 mr-1" />Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Centro de Custo</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <FormField control={form.control} name="codigo" render={({ field }) => (
                    <FormItem><FormLabel>Código *</FormLabel><FormControl><Input {...field} required data-testid="input-codigo-centro" /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="nome" render={({ field }) => (
                    <FormItem className="col-span-2"><FormLabel>Nome *</FormLabel><FormControl><Input {...field} required data-testid="input-nome-centro" /></FormControl></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="descricao" render={({ field }) => (
                  <FormItem><FormLabel>Descrição</FormLabel><FormControl><Textarea {...field} rows={2} data-testid="input-descricao-centro" /></FormControl></FormItem>
                )} />
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending} data-testid="button-salvar-centro">{create.isPending ? "Salvando..." : "Salvar"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {centros.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Nenhum centro de custo cadastrado.</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {centros.map((c) => (
                <TableRow key={c.id} data-testid={`row-centro-${c.id}`}>
                  <TableCell className="font-medium">{c.codigo}</TableCell>
                  <TableCell>{c.nome}</TableCell>
                  <TableCell>{c.ativo ? <Badge variant="outline">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => remove.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ────────── Sprint C9 — G10: cards PMP/PMR no Dashboard
function PmpPmrCards({ clienteId }: { clienteId: string }) {
  const [openModal, setOpenModal] = useState(false);
  const { data } = useQuery<{ pmp: number | null; pmr: number | null; status: string; countPagar: number; countReceber: number }>({
    queryKey: ["/api/control/clientes", clienteId, "pmp-pmr"],
    enabled: !!clienteId,
  });
  const { data: hist } = useQuery<{ historico: Array<{ label: string; pmp: number | null; pmr: number | null }> }>({
    queryKey: ["/api/control/clientes", clienteId, "pmp-pmr", "historico"],
    queryFn: async () => {
      const r = await fetch(`/api/control/clientes/${clienteId}/pmp-pmr/historico?meses=6`, { credentials: "include" });
      if (!r.ok) throw new Error("Falha");
      return r.json();
    },
    enabled: openModal,
  });

  const fmt = (v: number | null) => v === null ? "—" : `${v.toFixed(0)} dias`;
  const statusBadge = data?.status === "saudavel"
    ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Saudável</Badge>
    : data?.status === "pressao"
    ? <Badge variant="destructive">Pressão de caixa</Badge>
    : data?.status === "neutro"
    ? <Badge variant="outline">Neutro</Badge>
    : <Badge variant="outline">Sem dados</Badge>;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-pmp" className="cursor-pointer hover:bg-muted/30" onClick={() => setOpenModal(true)}>
          <CardHeader className="pb-2"><CardDescription className="text-xs flex items-center gap-1"><ClockIcon className="h-3 w-3" />PMP — Prazo Médio Pagamento</CardDescription></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{fmt(data?.pmp ?? null)}</div>
            <div className="text-xs text-muted-foreground">{data?.countPagar ?? 0} CP no mês</div>
          </CardContent>
        </Card>
        <Card data-testid="card-pmr" className="cursor-pointer hover:bg-muted/30" onClick={() => setOpenModal(true)}>
          <CardHeader className="pb-2"><CardDescription className="text-xs flex items-center gap-1"><ClockIcon className="h-3 w-3" />PMR — Prazo Médio Recebimento</CardDescription></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{fmt(data?.pmr ?? null)}</div>
            <div className="text-xs text-muted-foreground">{data?.countReceber ?? 0} CR no mês</div>
          </CardContent>
        </Card>
        <Card data-testid="card-pmp-pmr-status">
          <CardHeader className="pb-2"><CardDescription className="text-xs">Status PMP × PMR</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <div>{statusBadge}</div>
            <div className="text-xs text-muted-foreground">
              {data?.status === "saudavel" && "Recebe antes de pagar."}
              {data?.status === "pressao" && "Paga antes de receber — risco de caixa."}
              {data?.status === "neutro" && "Equilíbrio entre prazos."}
              {(!data || data.status === "indisponivel") && "Sem lançamentos com data de emissão e pagamento no período."}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>PMP × PMR — últimos 6 meses</DialogTitle></DialogHeader>
          {!hist ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">PMP</TableHead><TableHead className="text-right">PMR</TableHead><TableHead className="text-right">Δ</TableHead></TableRow></TableHeader>
              <TableBody>
                {hist.historico.map((h) => {
                  const delta = (h.pmp !== null && h.pmr !== null) ? h.pmp - h.pmr : null;
                  return (
                    <TableRow key={h.label} data-testid={`row-hist-${h.label}`}>
                      <TableCell className="font-medium">{h.label}</TableCell>
                      <TableCell className="text-right">{h.pmp === null ? "—" : `${h.pmp.toFixed(0)}d`}</TableCell>
                      <TableCell className="text-right">{h.pmr === null ? "—" : `${h.pmr.toFixed(0)}d`}</TableCell>
                      <TableCell className={`text-right ${delta !== null && delta > 0 ? "text-emerald-600 dark:text-emerald-400" : delta !== null && delta < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                        {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(0)}d`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
