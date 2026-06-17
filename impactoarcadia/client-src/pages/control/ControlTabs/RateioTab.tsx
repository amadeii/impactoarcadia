/**
 * Sprint C-E08 — Configuração do Motor de Rateio Automático
 * Visível apenas para master/partner_admin
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Settings, Zap, ArrowRight, Building2, Loader2 } from "lucide-react";

interface RateioConfig {
  id: string;
  centro_custo_id: string;
  cc_nome?: string;
  cc_codigo?: string;
  criterio: string;
  percentual_impacto: number;
  percentual_saf: number;
  observacoes?: string;
  ativo: boolean;
}

interface CentroCusto { id: string; codigo: string; nome: string; }

const fmtPct = (v: number | string) => `${Number(v).toFixed(1)}%`;

export default function RateioTab({ clienteId, tenantRole }: { clienteId: string; tenantRole?: string }) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    centroCustoId: "", criterio: "percentual",
    percentualImpacto: 60, percentualSaf: 40, observacoes: "",
  });

  const canEdit = tenantRole === "master_admin" || tenantRole === "partner_admin" || tenantRole === "admin";

  const { data: configs = [], isLoading } = useQuery<RateioConfig[]>({
    queryKey: ["/api/control/rateio-configs", clienteId],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/control/clientes/${clienteId}/rateio-configs`);
      return r.json();
    },
  });

  const { data: ccs = [] } = useQuery<CentroCusto[]>({
    queryKey: ["/api/control/centros-custo", clienteId],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/control/clientes/${clienteId}/centros-custo`);
      const data = await r.json();
      return Array.isArray(data) ? data.filter((c: any) => c.marca_rateio) : [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const r = await apiRequest("POST", `/api/control/clientes/${clienteId}/rateio-configs`, {
        centroCustoId: data.centroCustoId,
        criterio: data.criterio,
        percentualImpacto: Number(data.percentualImpacto),
        percentualSaf: Number(data.percentualSaf),
        observacoes: data.observacoes || undefined,
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Configuração de rateio salva" });
      queryClient.invalidateQueries({ queryKey: ["/api/control/rateio-configs"] });
      setShowDialog(false);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const totalImpacto = Number(form.percentualImpacto) + Number(form.percentualSaf);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" /> Motor de Rateio Automático
          </h3>
          <p className="text-sm text-muted-foreground">
            Ao confirmar lançamentos em CCs com rateio ativo, lançamentos filhos são gerados automaticamente para Impacto e SAF.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const r = await apiRequest("POST", `/api/control/clientes/${clienteId}/rateio-configs/seed-impacto`);
                  const data = await r.json();
                  toast({ title: "Seed executado", description: data.mensagem });
                  queryClient.invalidateQueries({ queryKey: ["/api/control/rateio-configs"] });
                } catch (e: any) {
                  toast({ title: "Erro no seed", description: e.message, variant: "destructive" });
                }
              }}
              data-testid="btn-seed-rateio"
            >
              <Zap className="h-4 w-4 mr-2" />
              Carregar padrão Impacto/SAF
            </Button>
            <Button onClick={() => setShowDialog(true)} data-testid="btn-new-rateio-config">
              <Plus className="h-4 w-4 mr-2" /> Nova Configuração
            </Button>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-semibold text-sm">Impacto Ambiental</p>
                <p className="text-xs text-muted-foreground">Empresa principal — recebe % do rateio</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-semibold text-sm">SAF Florestal</p>
                <p className="text-xs text-muted-foreground">Empresa associada — recebe % restante</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de configs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Configurações Ativas</CardTitle>
          <CardDescription className="text-xs">
            {ccs.length === 0
              ? "Nenhum CC com 'marca_rateio' ativo. Ative a opção nos Centros de Custo compartilhados."
              : `${ccs.length} CC(s) com rateio habilitado`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Critério</TableHead>
                  <TableHead className="text-center">Impacto</TableHead>
                  <TableHead className="text-center">SAF</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <span className="text-xs text-muted-foreground mr-1">{c.cc_codigo}</span>
                      {c.cc_nome ?? c.centro_custo_id}
                    </TableCell>
                    <TableCell className="text-sm capitalize">{c.criterio}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-blue-100 text-blue-700">{fmtPct(c.percentual_impacto)}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-green-100 text-green-700">{fmtPct(c.percentual_saf)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={c.ativo ? "bg-green-500 text-white" : "bg-gray-400 text-white"}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {configs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Nenhuma configuração. Crie a primeira acima.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog nova config */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> Configurar Rateio Automático
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Centro de Custo (com marca_rateio)</Label>
              <Select value={form.centroCustoId} onValueChange={v => setForm(f => ({ ...f, centroCustoId: v }))}>
                <SelectTrigger data-testid="select-cc-rateio">
                  <SelectValue placeholder="Selecione o CC compartilhado" />
                </SelectTrigger>
                <SelectContent>
                  {ccs.map(cc => (
                    <SelectItem key={cc.id} value={cc.id}>{cc.codigo} — {cc.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Critério de Rateio</Label>
              <Select value={form.criterio} onValueChange={v => setForm(f => ({ ...f, criterio: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual fixo</SelectItem>
                  <SelectItem value="area_m2">Área (m²)</SelectItem>
                  <SelectItem value="ramais">Ramais telefônicos</SelectItem>
                  <SelectItem value="horas">Horas trabalhadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>% Impacto</Label>
                <Input
                  type="number" min={0} max={100} step={0.1}
                  value={form.percentualImpacto}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setForm(f => ({ ...f, percentualImpacto: v, percentualSaf: +(100 - v).toFixed(1) }));
                  }}
                  data-testid="input-pct-impacto"
                />
              </div>
              <div className="space-y-2">
                <Label>% SAF</Label>
                <Input
                  type="number" min={0} max={100} step={0.1}
                  value={form.percentualSaf}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setForm(f => ({ ...f, percentualSaf: v, percentualImpacto: +(100 - v).toFixed(1) }));
                  }}
                  data-testid="input-pct-saf"
                />
              </div>
            </div>

            {/* Visualização */}
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${Math.abs(totalImpacto - 100) > 0.1 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground">Impacto</p>
                <p className="font-bold text-blue-600">{fmtPct(form.percentualImpacto)}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground">SAF</p>
                <p className="font-bold text-green-600">{fmtPct(form.percentualSaf)}</p>
              </div>
              <div className={`text-xs font-medium ${Math.abs(totalImpacto - 100) > 0.1 ? "text-red-600" : "text-green-600"}`}>
                = {totalImpacto.toFixed(1)}%
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                placeholder="Ex: Imóvel — 60/40 conforme contrato"
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.centroCustoId || Math.abs(totalImpacto - 100) > 0.1 || saveMutation.isPending}
              data-testid="btn-save-rateio-config"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
