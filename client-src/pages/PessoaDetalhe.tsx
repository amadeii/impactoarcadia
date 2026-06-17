import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import {
  ArrowLeft, Trash2, Plus, Loader2, MapPin, Phone, Tag,
  FileText, Star, Mail, Globe, Smartphone, MessageCircle, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Pessoa, Endereco, Contato, PessoaPapel } from "@shared/schema";
import FinanceiroTab from "./FinanceiroTab";

// ─── tipos ───────────────────────────────────────────────────────────────────

type Detail = Pessoa & {
  enderecos: Endereco[];
  contatos: (Contato & { label?: string; observacao?: string })[];
  papeis: PessoaPapel[];
  grupo_id?: string | null;
};

interface PessoaGrupo { id: string; nome: string; descricao?: string; cor?: string; }

// ─── constantes ──────────────────────────────────────────────────────────────

const PAPEIS_OPTS = ["cliente", "fornecedor", "colaborador", "transportadora", "credor", "prospect", "parceiro"];

const TIPOS_CONTATO = ["telefone", "celular", "whatsapp", "email", "site"];

const CONTATO_ICON: Record<string, React.ElementType> = {
  telefone: Phone, celular: Smartphone, whatsapp: MessageCircle,
  email: Mail, site: Globe,
};

const PAPEL_COLOR: Record<string, string> = {
  cliente: "bg-blue-100 text-blue-800",
  fornecedor: "bg-green-100 text-green-800",
  colaborador: "bg-purple-100 text-purple-800",
  transportadora: "bg-amber-100 text-amber-800",
  credor: "bg-rose-100 text-rose-800",
  prospect: "bg-gray-100 text-gray-700",
  parceiro: "bg-teal-100 text-teal-800",
};

// ─── metadata fields por tipo de papel ───────────────────────────────────────

interface MetaField {
  key: string; label: string;
  type: "text" | "number" | "select" | "date";
  options?: string[];
  placeholder?: string;
}

const META_FIELDS: Record<string, MetaField[]> = {
  cliente: [
    { key: "prazoMedioPagamento", label: "Prazo médio pagamento (dias)", type: "number", placeholder: "30" },
    { key: "tabelaPreco",          label: "Tabela de preço",              type: "text",   placeholder: "Tabela A" },
    { key: "vendedorPadrao",       label: "Vendedor responsável",         type: "text" },
    { key: "frequenciaCompraDias", label: "Frequência de compra (dias)",  type: "number", placeholder: "90" },
    { key: "valorMinimoPedido",    label: "Valor mínimo pedido (R$)",     type: "number" },
    { key: "segmento",             label: "Segmento",                     type: "text",   placeholder: "Indústria, Varejo..." },
  ],
  fornecedor: [
    { key: "prazoMedioPagamento", label: "Prazo médio pagamento (dias)",  type: "number", placeholder: "30" },
    { key: "tipoFornecimento",    label: "Tipo de fornecimento",          type: "text",   placeholder: "Materiais, Serviços..." },
    { key: "ratingQualidade",     label: "Rating qualidade (1-5)",        type: "number", placeholder: "5" },
    { key: "ratingPrazo",         label: "Rating prazo (1-5)",            type: "number", placeholder: "5" },
    { key: "isCritico",           label: "Fornecedor crítico",            type: "select", options: ["sim", "não"] },
    { key: "condicaoPagamento",   label: "Condição de pagamento",         type: "text",   placeholder: "30/60/90" },
  ],
  colaborador: [
    { key: "cargo",           label: "Cargo",              type: "text" },
    { key: "departamento",    label: "Departamento",        type: "text" },
    { key: "dataAdmissao",    label: "Data de admissão",    type: "date" },
    { key: "tipoContratacao", label: "Tipo de contratação", type: "select", options: ["CLT", "PJ", "Estágio", "Temporário", "Sócio"] },
    { key: "salario",         label: "Salário (R$)",        type: "number" },
    { key: "gestorId",        label: "Gestor direto",       type: "text",   placeholder: "Nome do gestor" },
  ],
  transportadora: [
    { key: "modalidade",       label: "Modalidade",                   type: "select", options: ["Rodoviário", "Aéreo", "Marítimo", "Multimodal"] },
    { key: "regiaoAtuacao",    label: "Região de atuação",            type: "text",   placeholder: "SP, MG, PR..." },
    { key: "prazoEntregaDias", label: "Prazo médio entrega (dias)",   type: "number" },
    { key: "tabelaFrete",      label: "Tabela de frete",              type: "text" },
    { key: "anttRegistro",     label: "Registro ANTT",                type: "text" },
  ],
  credor: [
    { key: "tipoCredito",        label: "Tipo de crédito",        type: "select", options: ["Empréstimo", "Financiamento", "Leasing", "Debêntures", "Outro"] },
    { key: "taxaJuros",          label: "Taxa de juros (% a.m.)", type: "number" },
    { key: "prazoMeses",         label: "Prazo (meses)",          type: "number" },
    { key: "garantia",           label: "Garantia",               type: "text" },
    { key: "vencimentoContrato", label: "Vencimento do contrato", type: "date" },
  ],
  prospect: [
    { key: "origem",        label: "Origem do lead",      type: "select", options: ["Indicação", "Site", "Evento", "Prospecção ativa", "Redes sociais", "Outro"] },
    { key: "probabilidade", label: "Probabilidade (%)",   type: "number", placeholder: "50" },
    { key: "valorEstimado", label: "Valor estimado (R$)", type: "number" },
    { key: "proximaAcao",   label: "Próxima ação",        type: "text" },
  ],
  parceiro: [
    { key: "tipoAcordo",  label: "Tipo de acordo", type: "select", options: ["Revenda", "Referência", "Integração", "Franquia", "Outro"] },
    { key: "comissao",    label: "Comissão (%)",   type: "number" },
    { key: "territorios", label: "Territórios",    type: "text" },
  ],
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function friendlyError(e: any): string {
  return e?.message ?? "Erro desconhecido";
}

function formatDoc(v?: string | null): string {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v;
}

function maskCpfCnpj(v: string, tipo: "PF" | "PJ"): string {
  const d = v.replace(/\D/g, "").slice(0, tipo === "PF" ? 11 : 14);
  if (tipo === "PF") {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function maskCep(v: string): string {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function PessoaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: p, isLoading, error } = useQuery<Detail>({
    queryKey: ["/api/pessoas", id],
    queryFn: () => apiRequest("GET", `/api/pessoas/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const inativarMut = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/pessoas/${id}`, { status: "inativo" }),
    onSuccess: () => { toast({ title: "Pessoa inativada" }); navigate("/pessoas"); },
    onError: (e: any) => toast({ title: "Erro", description: friendlyError(e), variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8"><Skeleton className="h-10 w-64 mb-4" /><Skeleton className="h-64 w-full" /></div>;
  if (error || !p) return <div className="p-8 text-muted-foreground">Pessoa não encontrada.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/pessoas" data-testid="link-back"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="font-heading text-3xl font-bold" data-testid="text-pessoa-nome">{p.nomeFantasia}</h1>
            {p.razaoSocial && p.razaoSocial !== p.nomeFantasia && (
              <p className="text-muted-foreground">{p.razaoSocial}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline">{p.tipoPessoa === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}</Badge>
              {p.cnpjCpf && <Badge variant="secondary" className="font-mono text-xs">{formatDoc(p.cnpjCpf)}</Badge>}
              <Badge variant={p.status === "ativo" ? "default" : "secondary"}>{p.status}</Badge>
              {p.papeis.filter(x => x.status === "ativo").map(x => (
                <span key={x.id} className={`text-xs px-2 py-0.5 rounded-full ${PAPEL_COLOR[x.tipoPapel] || "bg-gray-100 text-gray-700"}`} data-testid={`badge-papel-${x.tipoPapel}`}>
                  {x.tipoPapel}
                </span>
              ))}
            </div>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} data-testid="button-delete-pessoa">
          <Trash2 className="h-4 w-4 mr-2" /> Inativar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dados">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dados" data-testid="tab-dados"><FileText className="h-4 w-4 mr-2" />Dados</TabsTrigger>
          <TabsTrigger value="enderecos" data-testid="tab-enderecos"><MapPin className="h-4 w-4 mr-2" />Endereços ({p.enderecos.length})</TabsTrigger>
          <TabsTrigger value="contatos" data-testid="tab-contatos"><Phone className="h-4 w-4 mr-2" />Contatos ({p.contatos.length})</TabsTrigger>
          <TabsTrigger value="papeis" data-testid="tab-papeis"><Tag className="h-4 w-4 mr-2" />Papéis ({p.papeis.length})</TabsTrigger>
          <TabsTrigger value="financeiro" data-testid="tab-financeiro"><DollarSign className="h-4 w-4 mr-2" />Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4"><DadosTab pessoa={p} /></TabsContent>
        <TabsContent value="enderecos" className="mt-4"><EnderecosTab pessoa={p} /></TabsContent>
        <TabsContent value="contatos" className="mt-4"><ContatosTab pessoa={p} /></TabsContent>
        <TabsContent value="papeis" className="mt-4"><PapeisTab pessoa={p} /></TabsContent>
        <TabsContent value="financeiro" className="mt-4"><FinanceiroTab pessoaId={p.id} /></TabsContent>
      </Tabs>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar pessoa?</AlertDialogTitle>
            <AlertDialogDescription>A pessoa será marcada como inativa, mas o histórico será preservado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => inativarMut.mutate()} className="bg-destructive text-destructive-foreground">
              Inativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA DADOS
// ══════════════════════════════════════════════════════════════════════════════

function DadosTab({ pessoa }: { pessoa: Detail }) {
  const { toast } = useToast();
  const [tipoPessoa, setTipoPessoa] = useState<"PF" | "PJ">(pessoa.tipoPessoa as "PF" | "PJ");
  const [status, setStatus] = useState(pessoa.status);
  const [nomeFantasia, setNomeFantasia] = useState(pessoa.nomeFantasia);
  const [razaoSocial, setRazaoSocial] = useState(pessoa.razaoSocial ?? "");
  const [cnpjCpf, setCnpjCpf] = useState(pessoa.cnpjCpf ?? "");
  const [dataNascFund, setDataNascFund] = useState(pessoa.dataNascimentoFundacao ?? "");
  // FISC-01: campos separados (substitui rgIe)
  const [rg, setRg] = useState((pessoa as any).rg ?? "");
  const [ie, setIe] = useState((pessoa as any).ie ?? "");
  const [contribuinte, setContribuinte] = useState((pessoa as any).contribuinte ?? "N");
  const [consumidorFinal, setConsumidorFinal] = useState(String((pessoa as any).consumidorFinal ?? "1"));
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState(pessoa.inscricaoMunicipal ?? "");
  const [codigoExterno, setCodigoExterno] = useState(pessoa.codigoExterno ?? "");
  const [grupoId, setGrupoId] = useState((pessoa as any).grupo_id ?? "");
  const [pessoaGrupo, setPessoaGrupo] = useState(pessoa.pessoaGrupo ?? "");
  const [vendedorPadrao, setVendedorPadrao] = useState(pessoa.vendedorPadrao ?? "");
  const [categoria, setCategoria] = useState(pessoa.categoria ?? "");
  const [tabelaPreco, setTabelaPreco] = useState(pessoa.tabelaPreco ?? "");
  const [limiteCredito, setLimiteCredito] = useState(String(pessoa.limiteCredito ?? ""));
  const [periodicidade, setPeriodicidade] = useState(String(pessoa.periodicidadeVendaCompra ?? ""));
  const [valorMinimoCompra, setValorMinimoCompra] = useState(String(pessoa.valorMinimoCompra ?? ""));
  const [observacoes, setObservacoes] = useState(pessoa.observacoes ?? "");

  const { data: grupos = [] } = useQuery<PessoaGrupo[]>({
    queryKey: ["/api/pessoa-grupos"],
    queryFn: () => fetch("/api/pessoa-grupos", { credentials: "include" }).then(r => r.json()),
  });

  const mut = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/pessoas/${pessoa.id}`, {
      tipoPessoa, status, nomeFantasia,
      razaoSocial: razaoSocial || null,
      cnpjCpf: cnpjCpf.replace(/\D/g, "") || null,
      dataNascimentoFundacao: dataNascFund || null,
      // FISC-01: campos separados
      rg:              rg || null,
      ie:              ie || null,
      contribuinte:    contribuinte || "N",
      consumidorFinal: Number(consumidorFinal ?? 1),
      // Campo legado — mantido para compatibilidade
      rgIe: tipoPessoa === "PJ" ? (ie || null) : (rg || null),
      inscricaoMunicipal: inscricaoMunicipal || null,
      codigoExterno: codigoExterno || null,
      grupo_id: grupoId || null,
      pessoaGrupo: pessoaGrupo || null,
      vendedorPadrao: vendedorPadrao || null,
      categoria: categoria || null,
      tabelaPreco: tabelaPreco || null,
      limiteCredito: limiteCredito ? Number(limiteCredito) : null,
      periodicidadeVendaCompra: periodicidade ? Number(periodicidade) : null,
      valorMinimoCompra: valorMinimoCompra ? Number(valorMinimoCompra) : null,
      observacoes: observacoes || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas", pessoa.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas"] });
      toast({ title: "Dados atualizados" });
    },
    onError: (e: any) => toast({ title: "Erro", description: friendlyError(e), variant: "destructive" }),
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {/* Identificação */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identificação</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Tipo de pessoa</Label>
              <Select value={tipoPessoa} onValueChange={(v) => setTipoPessoa(v as "PF" | "PJ")}>
                <SelectTrigger data-testid="select-tipo-pessoa"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Jurídica (PJ)</SelectItem>
                  <SelectItem value="PF">Física (PF)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome / Nome fantasia *</Label>
              <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} data-testid="input-nome-fantasia" />
            </div>
            <div>
              <Label>{tipoPessoa === "PJ" ? "Razão social" : "Nome completo"}</Label>
              <Input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} data-testid="input-razao-social" />
            </div>
            <div>
              <Label>{tipoPessoa === "PJ" ? "CNPJ *" : "CPF *"}</Label>
              <Input
                value={cnpjCpf}
                onChange={e => setCnpjCpf(maskCpfCnpj(e.target.value, tipoPessoa))}
                placeholder={tipoPessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                data-testid="input-cnpj-cpf"
              />
            </div>
            <div>
              <Label>{tipoPessoa === "PJ" ? "Data de fundação" : "Data de nascimento"}</Label>
              <Input type="date" value={dataNascFund} onChange={e => setDataNascFund(e.target.value)} data-testid="input-data-nasc-fund" />
            </div>
            {/* FISC-01: RG (PF) */}
            {tipoPessoa === "PF" && (
              <div>
                <Label>RG</Label>
                <Input value={rg} onChange={e => setRg(e.target.value)} placeholder="00.000.000-0" data-testid="input-rg" />
              </div>
            )}

            {/* FISC-01: IE (PJ) */}
            {tipoPessoa === "PJ" && (
              <div>
                <Label>Inscrição Estadual (IE)</Label>
                <Input value={ie} onChange={e => setIe(e.target.value)} placeholder="Digite a IE ou ISENTO" data-testid="input-ie" />
              </div>
            )}

            {/* FISC-01: Contribuinte (PJ) */}
            {tipoPessoa === "PJ" && (
              <div>
                <Label>Contribuinte ICMS</Label>
                <Select value={contribuinte} onValueChange={setContribuinte}>
                  <SelectTrigger data-testid="select-contribuinte"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">Contribuinte</SelectItem>
                    <SelectItem value="N">Não contribuinte</SelectItem>
                    <SelectItem value="I">Isento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* FISC-01: Consumidor final */}
            <div>
              <Label>Consumidor final</Label>
              <Select value={consumidorFinal} onValueChange={setConsumidorFinal}>
                <SelectTrigger data-testid="select-consumidor-final"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Sim (B2C)</SelectItem>
                  <SelectItem value="0">Não (B2B / Revenda)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipoPessoa === "PJ" && (
              <div>
                <Label>Inscrição municipal</Label>
                <Input value={inscricaoMunicipal} onChange={e => setInscricaoMunicipal(e.target.value)} data-testid="input-inscricao-municipal" />
              </div>
            )}
          </div>
        </section>

        {/* Comercial */}
        <section className="space-y-3 pt-4 border-t">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Comercial</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Código externo / Identificador</Label>
              <Input value={codigoExterno} onChange={e => setCodigoExterno(e.target.value)} placeholder="ID no ERP, CRM ou sistema legado" data-testid="input-codigo-externo" />
            </div>
            <div>
              <Label>Grupo</Label>
              {grupos.length > 0 ? (
                <Select value={grupoId} onValueChange={setGrupoId}>
                  <SelectTrigger data-testid="select-grupo-id"><SelectValue placeholder="Selecionar grupo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {grupos.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={pessoaGrupo} onChange={e => setPessoaGrupo(e.target.value)} placeholder="Ex.: VIP, Atacado, Revenda" data-testid="input-pessoa-grupo" />
              )}
            </div>
            <div>
              <Label>Vendedor padrão</Label>
              <Input value={vendedorPadrao} onChange={e => setVendedorPadrao(e.target.value)} data-testid="input-vendedor-padrao" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={categoria} onChange={e => setCategoria(e.target.value)} data-testid="input-categoria" />
            </div>
            <div>
              <Label>Tabela de preço</Label>
              <Input value={tabelaPreco} onChange={e => setTabelaPreco(e.target.value)} data-testid="input-tabela-preco" />
            </div>
            <div>
              <Label>Limite de crédito (R$)</Label>
              <Input type="number" step="0.01" min="0" value={limiteCredito} onChange={e => setLimiteCredito(e.target.value)} data-testid="input-limite-credito" />
            </div>
            <div>
              <Label>Periodicidade compra/venda (dias)</Label>
              <Input type="number" min="0" value={periodicidade} onChange={e => setPeriodicidade(e.target.value)} data-testid="input-periodicidade" />
            </div>
            <div>
              <Label>Valor mínimo de pedido (R$)</Label>
              <Input type="number" step="0.01" min="0" value={valorMinimoCompra} onChange={e => setValorMinimoCompra(e.target.value)} data-testid="input-valor-minimo" />
            </div>
          </div>
        </section>

        {/* Observações */}
        <section className="space-y-3 pt-4 border-t">
          <Label>Observações</Label>
          <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} data-testid="input-observacoes" />
        </section>

        <Button onClick={() => mut.mutate()} disabled={mut.isPending} data-testid="button-save-dados">
          {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar alterações
        </Button>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA CONTATOS — P3: label + observacao
// ══════════════════════════════════════════════════════════════════════════════

function ContatosTab({ pessoa }: { pessoa: Detail }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/contatos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas", pessoa.id] });
      toast({ title: "Contato removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: friendlyError(e), variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-contato">
          <Plus className="h-4 w-4 mr-2" /> Novo contato
        </Button>
      </div>
      {pessoa.contatos.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum contato cadastrado.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Label</th>
                  <th className="p-3">Principal</th>
                  <th className="p-3 w-32" />
                </tr>
              </thead>
              <tbody>
                {pessoa.contatos.map(c => {
                  const Icon = CONTATO_ICON[c.tipo] ?? Phone;
                  return (
                    <tr key={c.id} className="border-b last:border-0" data-testid={`row-contato-${c.id}`}>
                      <td className="p-3"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{c.tipo}</div></td>
                      <td className="p-3 font-mono text-xs">{c.valor}</td>
                      <td className="p-3 text-xs text-muted-foreground">{c.label || "—"}</td>
                      <td className="p-3">{c.isPrincipal === 1 && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}</td>
                      <td className="p-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setOpen(true); }} data-testid={`button-edit-contato-${c.id}`}>Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => delMut.mutate(c.id)} data-testid={`button-delete-contato-${c.id}`}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      <ContatoDialog key={editing?.id ?? "new"} open={open} onOpenChange={setOpen} pessoaId={pessoa.id} editing={editing} />
    </div>
  );
}

function ContatoDialog({ open, onOpenChange, pessoaId, editing }: {
  open: boolean; onOpenChange: (v: boolean) => void; pessoaId: string; editing: any | null;
}) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState(editing?.tipo ?? "telefone");
  const [valor, setValor] = useState(editing?.valor ?? "");
  const [label, setLabel] = useState(editing?.label ?? "");
  const [observacao, setObservacao] = useState(editing?.observacao ?? "");
  const [isPrincipal, setIsPrincipal] = useState(editing?.isPrincipal === 1);

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        tipo,
        valor: valor.trim(),
        label: label.trim() || null,
        observacao: observacao.trim() || null,
        isPrincipal: isPrincipal ? 1 : 0,
      };
      if (editing) return apiRequest("PATCH", `/api/contatos/${editing.id}`, body);
      return apiRequest("POST", `/api/pessoas/${pessoaId}/contatos`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas", pessoaId] });
      toast({ title: editing ? "Contato atualizado" : "Contato criado" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: friendlyError(e), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-contato">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar contato" : "Novo contato"}</DialogTitle>
          <DialogDescription>Marcar como principal desmarca outro principal do mesmo tipo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger data-testid="select-cont-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CONTATO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label (departamento)</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Financeiro, TI, Compras..." data-testid="input-cont-label" />
            </div>
          </div>
          <div>
            <Label>Valor *</Label>
            <Input
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder={tipo === "email" ? "email@empresa.com" : tipo === "site" ? "https://..." : "(00) 00000-0000"}
              data-testid="input-cont-valor"
            />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} placeholder="Notas sobre este contato..." data-testid="input-cont-observacao" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isPrincipal} onChange={e => setIsPrincipal(e.target.checked)} data-testid="check-cont-principal" />
            Principal
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !valor.trim()} data-testid="button-save-contato">
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA PAPÉIS — P1: metadata contextual por tipo de papel
// ══════════════════════════════════════════════════════════════════════════════

function PapeisTab({ pessoa }: { pessoa: Detail }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [tipoPapel, setTipoPapel] = useState("cliente");
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [editandoPapel, setEditandoPapel] = useState<PessoaPapel | null>(null);

  const ativosTipos = new Set(pessoa.papeis.filter(p => p.status === "ativo").map(p => p.tipoPapel));
  const disponiveis = PAPEIS_OPTS.filter(t => !ativosTipos.has(t));

  function resetForm() { setMetadata({}); setTipoPapel("cliente"); setEditandoPapel(null); }

  function setMeta(key: string, value: string) {
    setMetadata(prev => ({ ...prev, [key]: value }));
  }

  const addMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/pessoas/${pessoa.id}/papeis`, {
      tipoPapel, status: "ativo", metadata,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas", pessoa.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas/counts"] });
      toast({ title: "Papel adicionado" });
      setOpen(false); resetForm();
    },
    onError: (e: any) => toast({ title: "Erro", description: friendlyError(e), variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/pessoas/${pessoa.id}/papeis/${editandoPapel!.id}`, { metadata }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas", pessoa.id] });
      toast({ title: "Papel atualizado" });
      setOpen(false); resetForm();
    },
    onError: (e: any) => toast({ title: "Erro", description: friendlyError(e), variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/papeis/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas", pessoa.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas/counts"] });
      toast({ title: "Papel removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: friendlyError(e), variant: "destructive" }),
  });

  function abrirEdicao(pa: PessoaPapel) {
    setEditandoPapel(pa);
    setTipoPapel(pa.tipoPapel);
    setMetadata((pa.metadata as Record<string, string>) ?? {});
    setOpen(true);
  }

  const camposAtivos = META_FIELDS[editandoPapel?.tipoPapel ?? tipoPapel] ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          onClick={() => { resetForm(); setOpen(true); }}
          disabled={disponiveis.length === 0}
          data-testid="button-add-papel"
        >
          <Plus className="h-4 w-4 mr-2" /> Novo papel
        </Button>
      </div>

      {pessoa.papeis.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum papel atribuído.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {pessoa.papeis.map(pa => (
            <Card key={pa.id} data-testid={`card-papel-${pa.id}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAPEL_COLOR[pa.tipoPapel] || "bg-gray-100 text-gray-700"}`}>
                      {pa.tipoPapel}
                    </span>
                    <Badge variant={pa.status === "ativo" ? "default" : "secondary"} className="text-xs">{pa.status}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEdicao(pa)} title="Editar dados do papel">
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    {pa.status === "ativo" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => delMut.mutate(pa.id)} data-testid={`button-delete-papel-${pa.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {pa.dataInicio && (
                  <p className="text-xs text-muted-foreground">Desde {new Date(pa.dataInicio).toLocaleDateString("pt-BR")}</p>
                )}
                {pa.metadata && Object.keys(pa.metadata).length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                    {Object.entries(pa.metadata as Record<string, any>)
                      .filter(([, v]) => v)
                      .slice(0, 4)
                      .map(([k, v]) => {
                        const field = (META_FIELDS[pa.tipoPapel] ?? []).find(f => f.key === k);
                        return <p key={k}><span className="font-medium">{field?.label ?? k}:</span> {String(v)}</p>;
                      })}
                    {Object.keys(pa.metadata as Record<string, any>).filter(k => (pa.metadata as any)[k]).length > 4 && (
                      <p className="text-muted-foreground/60">
                        +{Object.keys(pa.metadata as Record<string, any>).filter(k => (pa.metadata as any)[k]).length - 4} campos...
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog adicionar/editar papel */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-papel">
          <DialogHeader>
            <DialogTitle>{editandoPapel ? `Editar papel — ${editandoPapel.tipoPapel}` : "Adicionar papel"}</DialogTitle>
            <DialogDescription>
              {editandoPapel
                ? "Atualize os dados específicos deste papel."
                : "Cada pessoa pode ter no máximo 1 papel ativo de cada tipo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editandoPapel && (
              <div>
                <Label>Papel *</Label>
                <Select value={tipoPapel} onValueChange={v => { setTipoPapel(v); setMetadata({}); }}>
                  <SelectTrigger data-testid="select-tipo-papel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {disponiveis.map(t => (
                      <SelectItem key={t} value={t}>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full mr-2 ${PAPEL_COLOR[t] || "bg-gray-100 text-gray-700"}`}>{t}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {camposAtivos.length > 0 && (
              <div className="space-y-3 border-t pt-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Dados do papel</p>
                <div className="grid grid-cols-2 gap-3">
                  {camposAtivos.map(field => (
                    <div key={field.key}>
                      <Label className="text-xs">{field.label}</Label>
                      {field.type === "select" ? (
                        <Select
                          value={String(metadata[field.key] ?? "")}
                          onValueChange={v => setMeta(field.key, v)}
                        >
                          <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">—</SelectItem>
                            {field.options!.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="h-8 text-sm mt-1"
                          type={field.type}
                          value={String(metadata[field.key] ?? "")}
                          onChange={e => setMeta(field.key, e.target.value)}
                          placeholder={field.placeholder}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            <Button
              onClick={() => editandoPapel ? editMut.mutate() : addMut.mutate()}
              disabled={addMut.isPending || editMut.isPending}
              data-testid="button-save-papel"
            >
              {(addMut.isPending || editMut.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editandoPapel ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA ENDEREÇOS
// ══════════════════════════════════════════════════════════════════════════════

function EnderecosTab({ pessoa }: { pessoa: Detail }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Endereco | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/enderecos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas", pessoa.id] });
      toast({ title: "Endereço removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: friendlyError(e), variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-endereco">
          <Plus className="h-4 w-4 mr-2" /> Novo endereço
        </Button>
      </div>
      {pessoa.enderecos.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum endereço cadastrado.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pessoa.enderecos.map(e => (
            <Card key={e.id} data-testid={`card-endereco-${e.id}`}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base capitalize">{e.tipo}</CardTitle>
                  {e.isPrincipal === 1 && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(e); setOpen(true); }} data-testid={`button-edit-endereco-${e.id}`}>Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => delMut.mutate(e.id)} data-testid={`button-delete-endereco-${e.id}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>{e.logradouro}{e.numero ? `, ${e.numero}` : ""}{e.complemento ? ` — ${e.complemento}` : ""}</p>
                <p>{e.bairro}{e.bairro && (e.cidade || e.uf) ? " — " : ""}{e.cidade}{e.cidade && e.uf ? "/" : ""}{e.uf}</p>
                {e.cep && <p className="text-muted-foreground">CEP {e.cep}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <EnderecoDialog key={editing?.id ?? "new"} open={open} onOpenChange={setOpen} pessoaId={pessoa.id} editing={editing} />
    </div>
  );
}

function EnderecoDialog({ open, onOpenChange, pessoaId, editing }: {
  open: boolean; onOpenChange: (v: boolean) => void; pessoaId: string; editing: Endereco | null;
}) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState(editing?.tipo ?? "principal");
  const [logradouro, setLogradouro] = useState(editing?.logradouro ?? "");
  const [numero, setNumero] = useState(editing?.numero ?? "");
  const [complemento, setComplemento] = useState(editing?.complemento ?? "");
  const [bairro, setBairro] = useState(editing?.bairro ?? "");
  const [cidade, setCidade] = useState(editing?.cidade ?? "");
  const [uf, setUf] = useState(editing?.uf ?? "");
  const [cep, setCep] = useState(maskCep(editing?.cep ?? ""));
  const [pais, setPais] = useState(editing?.pais ?? "Brasil");
  const [isPrincipal, setIsPrincipal] = useState(editing?.isPrincipal === 1);
  const [cepLoading, setCepLoading] = useState(false);

  async function lookupCep(raw: string) {
    const d = raw.replace(/\D/g, "");
    if (d.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const data = await r.json();
      if (!data.erro) {
        setLogradouro(data.logradouro ?? logradouro);
        setBairro(data.bairro ?? bairro);
        setCidade(data.localidade ?? cidade);
        setUf(data.uf ?? uf);
      }
    } catch {}
    setCepLoading(false);
  }

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        tipo,
        logradouro: logradouro || null,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        uf: uf || null,
        cep: cep.replace(/\D/g, "") || null,
        pais: pais || "Brasil",
        isPrincipal: isPrincipal ? 1 : 0,
      };
      if (editing) return apiRequest("PATCH", `/api/enderecos/${editing.id}`, body);
      return apiRequest("POST", `/api/pessoas/${pessoaId}/enderecos`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas", pessoaId] });
      toast({ title: editing ? "Endereço atualizado" : "Endereço criado" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: friendlyError(e), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar endereço" : "Novo endereço"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["principal", "cobranca", "entrega", "outro"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>CEP</Label>
              <Input
                value={cep}
                onChange={e => { const v = maskCep(e.target.value); setCep(v); lookupCep(v); }}
                placeholder="00000-000"
              />
              {cepLoading && <p className="text-xs text-muted-foreground mt-1">Buscando CEP...</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Logradouro</Label>
              <Input value={logradouro} onChange={e => setLogradouro(e.target.value)} />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={numero} onChange={e => setNumero(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Complemento</Label><Input value={complemento} onChange={e => setComplemento(e.target.value)} /></div>
            <div><Label>Bairro</Label><Input value={bairro} onChange={e => setBairro(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Cidade</Label><Input value={cidade} onChange={e => setCidade(e.target.value)} /></div>
            <div><Label>UF</Label><Input value={uf} onChange={e => setUf(e.target.value)} maxLength={2} /></div>
          </div>
          <div><Label>País</Label><Input value={pais} onChange={e => setPais(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isPrincipal} onChange={e => setIsPrincipal(e.target.checked)} />
            Principal
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
