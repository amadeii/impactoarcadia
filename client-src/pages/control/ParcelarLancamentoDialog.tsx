// Sprint C7 — G1 Parcelamento (UI).
// Cria N lançamentos vinculados a um grupo, todos com status='previsto'.
// Apresenta preview da divisão (com ajuste de centavos na última parcela)
// antes de confirmar.

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input-br";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Calendar } from "lucide-react";
import { FavorecidoPicker } from "@/components/control/FavorecidoPicker";
import { QuickCreatePessoaDialog } from "@/components/control/QuickCreatePessoaDialog";
import { addMonths, format } from "date-fns";

interface PlanoConta { id: string; codigo: string; descricao: string; permiteLancamento: boolean; }
interface CentroCusto { id: string; codigo: string; nome: string; ativo: boolean; }
interface TipoDoc { id: string; nome: string; }

interface Props {
  clienteId: string;
}

const NONE = "__none__";
const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function ParcelarLancamentoDialog({ clienteId }: Props) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tipo, setTipo] = useState<"pagar" | "receber">("pagar");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState("3");
  const [primeiroVenc, setPrimeiroVenc] = useState(new Date().toISOString().slice(0, 10));
  const [planoContaId, setPlanoContaId] = useState<string>(NONE);
  const [centroCustoId, setCentroCustoId] = useState<string>(NONE);
  const [tipoDocumentoId, setTipoDocumentoId] = useState<string>(NONE);
  const [favorecido, setFavorecido] = useState("");
  const [pessoaId, setPessoaId] = useState<string>("");
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!open) {
      setDescricao(""); setValor(""); setParcelas("3");
      setPrimeiroVenc(new Date().toISOString().slice(0, 10));
      setPlanoContaId(NONE); setCentroCustoId(NONE); setTipoDocumentoId(NONE);
      setFavorecido(""); setPessoaId(""); setObservacoes("");
    }
  }, [open]);

  const { data: planos = [] } = useQuery<PlanoConta[]>({ queryKey: ["/api/control/planos-contas"], enabled: open });
  const { data: centros = [] } = useQuery<CentroCusto[]>({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"], enabled: open });
  const { data: tiposDoc = [] } = useQuery<TipoDoc[]>({ queryKey: ["/api/control/tipos-documento"], enabled: open });

  // Preview da divisão
  const totalCents = Math.round((Number(valor) || 0) * 100);
  const n = Math.max(1, Math.min(360, parseInt(parcelas, 10) || 0));
  const valorParcelaCents = n > 0 ? Math.floor(totalCents / n) : 0;
  const ajusteCents = totalCents - valorParcelaCents * n;
  const valorParcela = valorParcelaCents / 100;
  const valorUltima = (valorParcelaCents + ajusteCents) / 100;
  const previewDatas = (() => {
    if (!primeiroVenc || n < 2) return [];
    const base = new Date(`${primeiroVenc}T12:00:00`);
    if (Number.isNaN(base.getTime())) return [];
    return Array.from({ length: Math.min(n, 6) }, (_, i) => format(addMonths(base, i), "dd/MM/yyyy"));
  })();

  const podeSubmeter = !!descricao && Number(valor) > 0 && n >= 2 && !!primeiroVenc;

  const criar = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/control/clientes/${clienteId}/lancamentos-parcelado`, {
        tipo,
        descricao,
        valor: Number(valor),
        parcelas: n,
        primeiroVencimento: primeiroVenc,
        planoContaId: planoContaId === NONE ? null : planoContaId,
        centroCustoId: centroCustoId === NONE ? null : centroCustoId,
        tipoDocumentoId: tipoDocumentoId === NONE ? null : tipoDocumentoId,
        favorecido: favorecido || null,
        pessoaId: pessoaId || null,
        observacoes: observacoes || null,
      });
      return await r.json();
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "lancamentos"] });
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "overview"] });
      toast({ title: "Parcelamento criado", description: `${r.totalCriado} parcela(s) gerada(s)` });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro ao parcelar", description: e?.message ?? "Falha", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-abrir-parcelar">
          <Layers className="h-4 w-4 mr-1" /> Parcelar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lançamento parcelado</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger data-testid="select-parcelar-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagar">A pagar</SelectItem>
                <SelectItem value="receber">A receber</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Favorecido / Pagador</Label>
            <FavorecidoPicker
              value={pessoaId || undefined}
              label={favorecido || undefined}
              onChange={(id, p) => { setPessoaId(id ?? ""); setFavorecido(p?.nomeFantasia ?? ""); }}
              onQuickCreate={() => setShowQuickCreate(true)}
              placeholder="Buscar pessoa ou empresa..."
              data-testid="favorecido-picker-parcelar"
            />
            <QuickCreatePessoaDialog
              open={showQuickCreate}
              onOpenChange={setShowQuickCreate}
              papelPadrao="fornecedor"
              onCreated={(p) => { setPessoaId(p.id); setFavorecido(p.nomeFantasia); setShowQuickCreate(false); }}
            />
          </div>

          <div className="col-span-2">
            <Label>Descrição base</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Aluguel sala 401"
              data-testid="input-parcelar-descricao"
            />
            <p className="text-xs text-muted-foreground mt-1">A numeração (1/N, 2/N…) será adicionada automaticamente em cada parcela.</p>
          </div>

          <div>
            <Label>Valor total (R$)</Label>
            <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} data-testid="input-parcelar-valor" />
          </div>

          <div>
            <Label>Nº de parcelas</Label>
            <Input type="number" min={2} max={360} value={parcelas} onChange={(e) => setParcelas(e.target.value)} data-testid="input-parcelar-qtd" />
          </div>

          <div>
            <Label>1º vencimento</Label>
            <DateInputBR value={primeiroVenc} onChange={setPrimeiroVenc} data-testid="input-parcelar-primeiro-venc" />
          </div>

          <div>
            <Label>Tipo de documento</Label>
            <Select value={tipoDocumentoId} onValueChange={setTipoDocumentoId}>
              <SelectTrigger data-testid="select-parcelar-tipo-doc"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {tiposDoc.map((t) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Plano de contas</Label>
            <Select value={planoContaId} onValueChange={setPlanoContaId}>
              <SelectTrigger data-testid="select-parcelar-plano"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {planos.filter((p) => p.permiteLancamento).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.descricao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Centro de custo</Label>
            <Select value={centroCustoId} onValueChange={setCentroCustoId}>
              <SelectTrigger data-testid="select-parcelar-centro"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {centros.filter((c) => c.ativo).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} data-testid="input-parcelar-obs" />
          </div>
        </div>

        {/* Preview */}
        {podeSubmeter && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2" data-testid="preview-parcelamento">
            <div className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Pré-visualização
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Cada parcela: <strong className="text-foreground">{formatBRL(valorParcela)}</strong></div>
              {ajusteCents !== 0 && (
                <div>Última parcela: <strong className="text-foreground">{formatBRL(valorUltima)}</strong> <span className="text-muted-foreground">(+ {formatBRL(ajusteCents / 100)} de ajuste)</span></div>
              )}
              <div className="col-span-2">Vencimentos próximos: <span className="text-foreground">{previewDatas.join(" • ")}{n > 6 ? ` (+${n - 6} mais)` : ""}</span></div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-parcelar-cancelar">Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={!podeSubmeter || criar.isPending} data-testid="button-parcelar-confirmar">
            {criar.isPending ? "Criando..." : `Criar ${n} parcelas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
