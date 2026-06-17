import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input-br";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Split } from "lucide-react";
import { RateioCcDialog } from "@/components/control/RateioCcDialog";
import LancamentoAnexos from "@/components/control/LancamentoAnexos";
import { FavorecidoPicker } from "@/components/control/FavorecidoPicker";
import { ProjectPicker } from "@/components/control/ProjectPicker";
import { QuickCreatePessoaDialog } from "@/components/control/QuickCreatePessoaDialog";

interface Lancamento {
  id: string;
  tipo: "pagar" | "receber";
  descricao: string;
  favorecido?: string | null;
  documento?: string | null;
  valor: string;
  dataEmissao?: string | null;
  dataVencimento: string;
  dataPagamento?: string | null;
  status: string;
  planoContaId?: string | null;
  centroCustoId?: string | null;
  contaBancariaId?: string | null;
  tipoDocumentoId?: string | null;
  observacoes?: string | null;
  projetoId?: string | null;
  osNumero?: string | null;
  pessoaId?: string | null;
  // CTL-02
  projetoCodigo?: string | null;
  parceiro?: string | null;
  tipoRecorrenciaAr?: string | null;
}

interface PlanoConta { id: string; codigo: string; descricao: string; permiteLancamento: boolean; }
interface CentroCusto { id: string; codigo: string; nome: string; ativo: boolean; marcaRateio?: boolean; centroCustoRaiz?: boolean; }
interface ContaBancaria { id: string; banco: string; agencia?: string | null; conta?: string | null; ativo: boolean; }
interface TipoDoc { id: string; nome: string; }

interface Props {
  lancamento: Lancamento;
  clienteId: string;
}

const NONE = "__none__";

export function EditLancamentoDialog({ lancamento, clienteId }: Props) {
  const [open, setOpen] = useState(false);
  const [rateioOpen, setRateioOpen] = useState(false);
  const [form, setForm] = useState<Partial<Lancamento>>({});
  const [showQuickCreatePessoa, setShowQuickCreatePessoa] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => { if (open) setForm({ ...lancamento }); }, [open, lancamento]);

  const { data: planos = [] } = useQuery<PlanoConta[]>({ queryKey: ["/api/control/planos-contas"], enabled: open });
  const { data: centros = [] } = useQuery<CentroCusto[]>({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"], enabled: open });
  const { data: contas = [] } = useQuery<ContaBancaria[]>({ queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"], enabled: open });
  const { data: tiposDoc = [] } = useQuery<TipoDoc[]>({ queryKey: ["/api/control/tipos-documento"], enabled: open });

  const centroCustoSelecionado = centros.find((c) => c.id === form.centroCustoId);
  const ccRaizAlert = centroCustoSelecionado?.centroCustoRaiz;

  const salvar = useMutation({
    mutationFn: async () => {
      if (ccRaizAlert) throw new Error("Centro de custo raiz não permite lançamentos diretos.");
      const payload: any = {
        tipo: form.tipo,
        descricao: form.descricao,
        favorecido: form.favorecido || null,
        documento: form.documento || null,
        valor: form.valor,
        dataEmissao: form.dataEmissao || null,
        dataVencimento: form.dataVencimento,
        dataPagamento: form.dataPagamento || null,
        status: form.status,
        planoContaId: form.planoContaId || null,
        centroCustoId: form.centroCustoId || null,
        contaBancariaId: form.contaBancariaId || null,
        tipoDocumentoId: form.tipoDocumentoId || null,
        observacoes: form.observacoes || null,
        projetoId: form.projetoId || null,
        osNumero: form.osNumero || null,
        pessoaId: form.pessoaId || null,
        projetoCodigo: form.projetoCodigo || null,
        parceiro: form.parceiro || null,
        tipoRecorrenciaAr: form.tipoRecorrenciaAr || null,
      };
      const r = await apiRequest("PATCH", `/api/control/lancamentos/${lancamento.id}`, payload);
      return await r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "lancamentos"] });
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "overview"] });
      toast({ title: "Lançamento atualizado" });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e?.message ?? "Falha", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} data-testid={`button-editar-${lancamento.id}`}>
        <Pencil className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Descrição</Label>
            <Input
              value={form.descricao ?? ""}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              data-testid="input-edit-descricao"
            />
          </div>

          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as any })}>
              <SelectTrigger data-testid="select-edit-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagar">Pagar</SelectItem>
                <SelectItem value="receber">Receber</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="previsto">Previsto</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="inadimplente">Inadimplente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* C-E12: FavorecidoPicker — substitui input de texto simples */}
          <div className="col-span-2">
            <Label>Favorecido (pessoa/empresa)</Label>
            <FavorecidoPicker
              value={form.pessoaId ?? undefined}
              label={form.favorecido ?? undefined}
              onChange={(pessoaId, pessoa) => setForm({
                ...form,
                pessoaId: pessoaId ?? null,
                favorecido: pessoa?.nomeFantasia ?? form.favorecido ?? null,
              })}
              onQuickCreate={() => setShowQuickCreatePessoa(true)}
              placeholder="Buscar fornecedor, cliente ou empresa..."
              data-testid="favorecido-picker-edit"
            />
            <QuickCreatePessoaDialog
              open={showQuickCreatePessoa}
              onOpenChange={setShowQuickCreatePessoa}
              papelPadrao="fornecedor"
              onCreated={(pessoa) => {
                setForm({ ...form, pessoaId: pessoa.id, favorecido: pessoa.nomeFantasia });
                setShowQuickCreatePessoa(false);
              }}
            />
          </div>

          <div>
            <Label>Documento / NF</Label>
            <Input
              value={form.documento ?? ""}
              onChange={(e) => setForm({ ...form, documento: e.target.value })}
              data-testid="input-edit-documento"
            />
          </div>

          {/* C-E03: Número OS */}
          <div>
            <Label>Nº OS / Contrato</Label>
            <Input
              value={form.osNumero ?? ""}
              onChange={(e) => setForm({ ...form, osNumero: e.target.value })}
              placeholder="Ex.: OS-2024-001"
              data-testid="input-edit-os-numero"
            />
          </div>

          <div>
            <Label>Valor</Label>
            <Input
              type="number"
              step="0.01"
              value={form.valor ?? ""}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              data-testid="input-edit-valor"
            />
          </div>

          <div>
            <Label>Vencimento</Label>
            <DateInputBR
              value={form.dataVencimento ?? ""}
              onChange={(v) => setForm({ ...form, dataVencimento: v })}
              data-testid="input-edit-vencimento"
            />
          </div>

          <div>
            <Label>Emissão</Label>
            <DateInputBR
              value={form.dataEmissao ?? ""}
              onChange={(v) => setForm({ ...form, dataEmissao: v })}
              data-testid="input-edit-emissao"
            />
          </div>

          <div>
            <Label>Pagamento</Label>
            <DateInputBR
              value={form.dataPagamento ?? ""}
              onChange={(v) => setForm({ ...form, dataPagamento: v })}
              data-testid="input-edit-pagamento"
            />
          </div>

          <div>
            <Label>Plano de contas</Label>
            <Select
              value={form.planoContaId ?? NONE}
              onValueChange={(v) => setForm({ ...form, planoContaId: v === NONE ? null : v })}
            >
              <SelectTrigger data-testid="select-edit-plano"><SelectValue placeholder="—" /></SelectTrigger>
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
            <Select
              value={form.centroCustoId ?? NONE}
              onValueChange={(v) => setForm({ ...form, centroCustoId: v === NONE ? null : v })}
            >
              <SelectTrigger data-testid="select-edit-centro"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {centros.filter((c) => c.ativo).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigo} — {c.nome}
                    {c.centroCustoRaiz ? " ⚠ (raiz)" : ""}
                    {c.marcaRateio ? " ⟳" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ccRaizAlert && (
              <p className="text-xs text-destructive mt-1">
                ⚠ Centro de custo raiz — não permite lançamentos diretos. Use um CC filho.
              </p>
            )}
          </div>

          <div>
            <Label>Tipo de documento</Label>
            <Select
              value={form.tipoDocumentoId ?? NONE}
              onValueChange={(v) => setForm({ ...form, tipoDocumentoId: v === NONE ? null : v })}
            >
              <SelectTrigger data-testid="select-edit-tipo-doc"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {tiposDoc.map((t) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>Conta bancária</Label>
            <Select
              value={form.contaBancariaId ?? NONE}
              onValueChange={(v) => setForm({ ...form, contaBancariaId: v === NONE ? null : v })}
            >
              <SelectTrigger data-testid="select-edit-banco"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {contas.filter((c) => c.ativo).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.banco}{c.agencia ? ` • Ag ${c.agencia}` : ""}{c.conta ? ` • CC ${c.conta}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* C-E03: ProjectPicker */}
          <div className="col-span-2">
            <Label>Projeto</Label>
            <ProjectPicker
              value={form.projetoId ?? undefined}
              label={undefined}
              onChange={(projetoId) => setForm({ ...form, projetoId: projetoId ?? null })}
              placeholder="Vincular a um projeto de engenharia..."
            />
          </div>

          {/* CTL-02 — campos AR: apenas para tipo=receber */}
          {form.tipo === "receber" && (
            <>
              <div>
                <Label>Cód. Projeto (legado)</Label>
                <Input
                  value={form.projetoCodigo ?? ""}
                  onChange={(e) => setForm({ ...form, projetoCodigo: e.target.value })}
                  placeholder="Ex.: IMP23195"
                  data-testid="input-edit-projeto-codigo"
                />
              </div>
              <div>
                <Label>Parceiro / Canal</Label>
                <Input
                  value={form.parceiro ?? ""}
                  onChange={(e) => setForm({ ...form, parceiro: e.target.value })}
                  placeholder="Ex.: Vibra, Direto, SAF"
                  data-testid="input-edit-parceiro"
                />
              </div>
              <div>
                <Label>Tipo de recorrência</Label>
                <Select
                  value={form.tipoRecorrenciaAr ?? "__none__"}
                  onValueChange={(v) => setForm({ ...form, tipoRecorrenciaAr: v === "__none__" ? null : v })}
                >
                  <SelectTrigger data-testid="select-edit-tipo-rec-ar"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="Avulso">Avulso</SelectItem>
                    <SelectItem value="Parcelas">Parcelas</SelectItem>
                    <SelectItem value="Recorrente">Recorrente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={form.observacoes ?? ""}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              data-testid="input-edit-observacoes"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <LancamentoAnexos lancamentoId={lancamento.id} />
        </div>

        <DialogFooter className="flex flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setRateioOpen(true)}
            data-testid="button-edit-abrir-rateio"
            className="gap-1"
          >
            <Split className="h-4 w-4" /> Rateio CC
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-edit-cancelar">Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !!ccRaizAlert} data-testid="button-edit-salvar">
              {salvar.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <RateioCcDialog
        open={rateioOpen}
        onOpenChange={setRateioOpen}
        lancamentoId={lancamento.id}
        clienteId={clienteId}
        valorTotal={Number(form.valor ?? lancamento.valor ?? 0)}
      />
    </Dialog>
  );
}
