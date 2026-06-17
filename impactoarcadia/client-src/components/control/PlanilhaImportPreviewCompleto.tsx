/**
 * PlanilhaImportPreviewCompleto — CTL-IMPORT-01
 * Preview da importação completa: cadastros + lançamentos AR/AP + saldos
 */
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Banknote, Users, Building2, FileText, BarChart3,
  TrendingUp, TrendingDown, Wallet, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  try { return new Date(s + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return s; }
};

function StatusBadge({ s }: { s: string }) {
  if (s === "recebido" || s === "pago")
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 text-xs">{s}</Badge>;
  if (s === "previsto")
    return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 text-xs">{s}</Badge>;
  return <Badge variant="secondary" className="text-xs">{s}</Badge>;
}

interface LancamentoImport {
  tipo: "receber" | "pagar";
  data_documento: string | null;
  documento: string | null;
  plano_conta: string | null;
  projeto: string | null;
  conta_bancaria: string | null;
  cliente_fornecedor: string | null;
  descricao: string | null;
  valor: number;
  numero_parcela: string | null;
  vencimento: string | null;
  liquidacao: string | null;
  status: string;
}

interface Preview {
  bancos: { nome: string; tipo: string; saldo: number }[];
  clientes: { nome: string; cnpj?: string }[];
  fornecedores: { nome: string; cnpj?: string }[];
  planosContas: { codigo: string; descricao: string; tipo: string }[];
  saldosIniciais: { conta: string; saldo: number }[];
  lancamentosReceber: LancamentoImport[];
  lancamentosPagar:   LancamentoImport[];
  sheetsFound?: string[];
  stats: {
    totalBancos: number; totalClientes: number; totalFornecedores: number;
    totalPlanosContas: number; totalMetas: number;
  };
  statsLanc: {
    totalReceber: number; totalPagar: number; totalSaldos: number;
    valorReceber: number; valorPagar: number;
  };
}

export function PlanilhaImportPreviewCompleto({ preview }: { preview: Preview }) {
  const { stats, statsLanc } = preview;
  const total =
    stats.totalBancos + stats.totalClientes + stats.totalFornecedores +
    stats.totalPlanosContas + statsLanc.totalReceber + statsLanc.totalPagar + statsLanc.totalSaldos;

  const summaryCards = [
    { icon: Banknote,    label: "Contas",         count: stats.totalBancos,        color: "text-green-600",  extra: "" },
    { icon: Wallet,      label: "Saldos Iniciais", count: statsLanc.totalSaldos,    color: "text-emerald-600", extra: "" },
    { icon: TrendingUp,  label: "A Receber",       count: statsLanc.totalReceber,   color: "text-blue-600",   extra: fmtBRL(statsLanc.valorReceber) },
    { icon: TrendingDown,label: "A Pagar",         count: statsLanc.totalPagar,     color: "text-red-600",    extra: fmtBRL(statsLanc.valorPagar) },
    { icon: Users,       label: "Clientes",        count: stats.totalClientes,      color: "text-indigo-600", extra: "" },
    { icon: Building2,   label: "Fornecedores",    count: stats.totalFornecedores,  color: "text-purple-600", extra: "" },
    { icon: FileText,    label: "Plano Contas",    count: stats.totalPlanosContas,  color: "text-orange-600", extra: "" },
    { icon: BarChart3,   label: "Metas",           count: stats.totalMetas,         color: "text-pink-600",   extra: "" },
  ];

  return (
    <div className="space-y-4">
      {/* Banner total */}
      <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
            {total.toLocaleString("pt-BR")} registros prontos para importação
          </p>
          <p className="text-xs text-green-600/80 dark:text-green-400/80">
            Confirme abaixo para gravar todos no sistema. A operação é idempotente — pode ser reexecutada sem duplicar.
          </p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {summaryCards.map(({ icon: Icon, label, count, color, extra }) => (
          <div key={label} className="border rounded-lg p-3 text-center">
            <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{count}</p>
            {extra && <p className="text-xs text-muted-foreground mt-0.5">{extra}</p>}
          </div>
        ))}
      </div>

      {/* Tabs de detalhe */}
      <Tabs defaultValue="receber">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="receber">
            A Receber ({statsLanc.totalReceber})
          </TabsTrigger>
          <TabsTrigger value="pagar">
            A Pagar ({statsLanc.totalPagar})
          </TabsTrigger>
          <TabsTrigger value="saldos">
            Saldos ({statsLanc.totalSaldos})
          </TabsTrigger>
          <TabsTrigger value="cadastros">
            Cadastros
          </TabsTrigger>
        </TabsList>

        {/* A Receber */}
        <TabsContent value="receber">
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Vencimento</TableHead>
                    <TableHead className="text-xs">Projeto</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs">Parcela</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.lancamentosReceber.slice(0, 200).map((l, i) => (
                    <TableRow key={i} className="text-xs">
                      <TableCell>{fmtDate(l.vencimento)}</TableCell>
                      <TableCell className="max-w-[120px] truncate" title={l.projeto ?? ""}>
                        {l.projeto?.slice(0, 18) ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate" title={l.cliente_fornecedor ?? ""}>
                        {l.cliente_fornecedor?.slice(0, 20) ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate" title={l.descricao ?? ""}>
                        {l.descricao?.slice(0, 35) ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-700">
                        {fmtBRL(l.valor)}
                      </TableCell>
                      <TableCell>{l.numero_parcela ?? "—"}</TableCell>
                      <TableCell><StatusBadge s={l.status} /></TableCell>
                    </TableRow>
                  ))}
                  {preview.lancamentosReceber.length > 200 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-2">
                        + {preview.lancamentosReceber.length - 200} registros não exibidos (serão importados)
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* A Pagar */}
        <TabsContent value="pagar">
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Vencimento</TableHead>
                    <TableHead className="text-xs">Projeto</TableHead>
                    <TableHead className="text-xs">Fornecedor</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs">Parcela</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.lancamentosPagar.slice(0, 200).map((l, i) => (
                    <TableRow key={i} className="text-xs">
                      <TableCell>{fmtDate(l.vencimento)}</TableCell>
                      <TableCell className="max-w-[120px] truncate" title={l.projeto ?? ""}>
                        {l.projeto?.slice(0, 18) ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate" title={l.cliente_fornecedor ?? ""}>
                        {l.cliente_fornecedor?.slice(0, 20) ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate" title={l.descricao ?? ""}>
                        {l.descricao?.slice(0, 35) ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-700">
                        {fmtBRL(l.valor)}
                      </TableCell>
                      <TableCell>{l.numero_parcela ?? "—"}</TableCell>
                      <TableCell><StatusBadge s={l.status} /></TableCell>
                    </TableRow>
                  ))}
                  {preview.lancamentosPagar.length > 200 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-2">
                        + {preview.lancamentosPagar.length - 200} registros não exibidos (serão importados)
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Saldos Iniciais */}
        <TabsContent value="saldos">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Conta Bancária</TableHead>
                  <TableHead className="text-xs text-right">Saldo Inicial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.saldosIniciais.map((s, i) => (
                  <TableRow key={i} className="text-sm">
                    <TableCell>{s.conta}</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={s.saldo >= 0 ? "text-green-700" : "text-red-700"}>
                        {fmtBRL(s.saldo)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Cadastros */}
        <TabsContent value="cadastros" className="space-y-3">
          {preview.bancos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Contas Bancárias ({preview.bancos.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {preview.bancos.map((b, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {b.nome} {b.saldo > 0 ? `(${fmtBRL(b.saldo)})` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {preview.clientes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Clientes ({preview.clientes.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {preview.clientes.slice(0, 30).map((c, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{c.nome.slice(0, 30)}</Badge>
                ))}
                {preview.clientes.length > 30 && (
                  <Badge variant="secondary" className="text-xs">+{preview.clientes.length - 30} mais</Badge>
                )}
              </div>
            </div>
          )}
          {preview.fornecedores.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Fornecedores ({preview.fornecedores.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {preview.fornecedores.slice(0, 20).map((f, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{f.nome.slice(0, 30)}</Badge>
                ))}
                {preview.fornecedores.length > 20 && (
                  <Badge variant="secondary" className="text-xs">+{preview.fornecedores.length - 20} mais</Badge>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Abas encontradas na planilha */}
      {preview.sheetsFound && preview.sheetsFound.length > 0 && (
        <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-600 dark:text-slate-400">
          <FileText className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">Abas encontradas na planilha: </span>
            {preview.sheetsFound.map((s, i) => (
              <Badge key={i} variant="outline" className="text-xs mr-1">{s}</Badge>
            ))}
            {statsLanc.totalReceber === 0 && statsLanc.totalPagar === 0 && (
              <p className="mt-1 text-amber-600 dark:text-amber-400 font-medium">
                ⚠ Nenhum lançamento detectado. Verifique se as abas "ContasReceber" e "ContasPagar" existem na planilha.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Aviso sobre matching */}
      <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <p>
          Os lançamentos são importados com os dados brutos da planilha (plano de conta, projeto e conta bancária como texto).
          O matching com os registros do sistema ocorre automaticamente após a importação via processo de reconciliação.
        </p>
      </div>
    </div>
  );
}
