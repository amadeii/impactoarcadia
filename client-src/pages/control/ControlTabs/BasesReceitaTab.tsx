/**
 * Sprint C-E05 — Bases de Receita por Projeto
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Target, Loader2, DollarSign, CheckCircle } from "lucide-react";

interface BaseReceita {
  id: string;
  projeto_id: string;
  projeto_numero?: string;
  projeto_titulo?: string;
  etapa: string;
  descricao: string;
  valor_previsto: number;
  competencia?: string;
  status: string;
  lancamento_id?: string;
}

interface Projeto { id: string; numero: string; titulo: string; valor_contrato?: number; }

const ETAPAS_PROJETO = [
  { value: "mobilizacao", label: "Mobilização" },
  { value: "campo", label: "Trabalho de Campo" },
  { value: "laboratorio", label: "Análises Laboratoriais" },
  { value: "relatorio", label: "Elaboração de Relatório" },
  { value: "encerramento", label: "Encerramento" },
  { value: "outro", label: "Outro" },
];

const STATUS_COLORS: Record<string, string> = {
  previsto: "bg-gray-400",
  faturado: "bg-blue-500",
  recebido: "bg-green-500",
  cancelado: "bg-red-500",
};

const fmtBRL = (v: number | string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function BasesReceitaTab({ clienteId }: { clienteId: string }) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [projetoFiltro, setProjetoFiltro] = useState("todos");
  const [form, setForm] = useState({
    projetoId: "", etapa: "mobilizacao", descricao: "",
    valorPrevisto: "", competencia: new Date().toISOString().slice(0, 7),
  });

  const { data: projetos = [] } = useQuery<Projeto[]>({
    queryKey: ["/api/engineering/projects"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/engineering/projects`);
      return r.json();
    },
  });

  const { data: bases = [], isLoading } = useQuery<BaseReceita[]>({
    queryKey: ["/api/engineering/bases-receita", clienteId, projetoFiltro],
    queryFn: async () => {
      const params = projetoFiltro !== "todos" ? `?projetoId=${projetoFiltro}` : "";
      const r = await apiRequest("GET", `/api/control/clientes/${clienteId}/bases-receita${params}`);
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const r = await apiRequest("POST",
        `/api/engineering/projects/${data.projetoId}/bases-receita`, {
          etapa: data.etapa,
          descricao: data.descricao,
          valorPrevisto: Number(data.valorPrevisto),
          competencia: data.competencia ? `${data.competencia}-01` : undefined,
        }
      );
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Base de receita criada — lançamento gerado automaticamente" });
      queryClient.invalidateQueries({ queryKey: ["/api/engineering/bases-receita"] });
      setShowDialog(false);
      setForm(f => ({ ...f, descricao: "", valorPrevisto: "" }));
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Totais por projeto
  const totalPrevisto = bases.reduce((s, b) => s + Number(b.valor_previsto), 0);
  const totalRecebido = bases.filter(b => b.status === "recebido").reduce((s, b) => s + Number(b.valor_previsto), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" /> Bases de Receita por Projeto
          </h3>
          <p className="text-sm text-muted-foreground">
            Distribua o orçamento por etapas. Cada base gera automaticamente um lançamento a receber.
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="btn-new-base-receita">
          <Plus className="h-4 w-4 mr-2" /> Nova Base
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Previsto</p>
            <p className="text-lg font-bold text-blue-600">{fmtBRL(totalPrevisto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Recebido</p>
            <p className="text-lg font-bold text-green-600">{fmtBRL(totalRecebido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-lg font-bold text-orange-500">{fmtBRL(totalPrevisto - totalRecebido)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3">
        <Label className="text-sm">Filtrar por projeto:</Label>
        <Select value={projetoFiltro} onValueChange={setProjetoFiltro}>
          <SelectTrigger className="w-56" data-testid="select-bases-projeto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os projetos</SelectItem>
            {projetos.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.numero} — {p.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Valor Previsto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lançamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bases.map(b => (
                  <TableRow key={b.id} data-testid={`row-base-${b.id}`}>
                    <TableCell className="text-sm font-mono">{b.projeto_numero ?? b.projeto_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {ETAPAS_PROJETO.find(e => e.value === b.etapa)?.label ?? b.etapa}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{b.descricao}</TableCell>
                    <TableCell className="text-sm">{b.competencia?.slice(0, 7) ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{fmtBRL(b.valor_previsto)}</TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_COLORS[b.status] ?? "bg-gray-400"} text-white text-xs`}>
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {b.lancamento_id
                        ? <CheckCircle className="h-4 w-4 text-green-500" />
                        : <span className="text-xs text-muted-foreground">—</span>
                      }
                    </TableCell>
                  </TableRow>
                ))}
                {bases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      Nenhuma base de receita. Clique em "Nova Base" para criar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog nova base */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> Nova Base de Receita
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Projeto *</Label>
              <Select value={form.projetoId} onValueChange={v => setForm(f => ({ ...f, projetoId: v }))}>
                <SelectTrigger data-testid="select-base-projeto">
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projetos.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.numero} — {p.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Etapa *</Label>
              <Select value={form.etapa} onValueChange={v => setForm(f => ({ ...f, etapa: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ETAPAS_PROJETO.map(e => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                placeholder="Ex: 1ª parcela — Campanha Semestral"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                data-testid="input-base-descricao"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor Previsto (R$) *</Label>
                <Input
                  type="number" step="0.01" placeholder="0,00"
                  value={form.valorPrevisto}
                  onChange={e => setForm(f => ({ ...f, valorPrevisto: e.target.value }))}
                  data-testid="input-base-valor"
                />
              </div>
              <div className="space-y-2">
                <Label>Competência</Label>
                <Input
                  type="month"
                  value={form.competencia}
                  onChange={e => setForm(f => ({ ...f, competencia: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded">
              Ao confirmar, um lançamento a receber com status "previsto" será gerado automaticamente vinculado ao projeto.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.projetoId || !form.descricao || !form.valorPrevisto || createMutation.isPending}
              data-testid="btn-save-base-receita"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Base de Receita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
