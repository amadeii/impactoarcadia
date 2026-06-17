// Sprint C10 — G13 Carteiras corporativas (Caju etc.).
// Lista contas tipo='carteira' com saldo, pendentes e gasto do mês.
// Permite criar nova carteira via formulário inline.

import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Wallet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CarteiraResumo { id: string; apelido: string|null; banco: string; responsavelId: string|null; saldoAtual: number; pendentes: number; totalGastoMes: number; }
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Carteiras() {
  const [location] = useLocation();
  const clienteId = location.split('/').filter(Boolean)[1] ?? '';
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ apelido: "", responsavel: "", saldoInicial: "0" });

  const q = useQuery<{ carteiras: CarteiraResumo[] }>({
    queryKey: ["/api/control/clientes", clienteId, "carteiras"],
  });

  const criar = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/control/clientes/${clienteId}/contas-bancarias`, {
        banco: form.apelido || "Carteira",
        apelido: form.apelido || null,
        tipo: "carteira",
        saldoInicial: form.saldoInicial,
        ativo: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "carteiras"] });
      toast({ title: "Carteira criada" });
      setOpen(false);
      setForm({ apelido: "", responsavel: "", saldoInicial: "0" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Link href={`/control/${clienteId}`}>
          <Button variant="ghost" size="sm" data-testid="button-back"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        </Link>
        <h1 className="text-2xl font-bold flex-1" data-testid="text-page-title">Carteiras Corporativas</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-nova-carteira"><Plus className="h-4 w-4 mr-1" /> Nova Carteira</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Carteira</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Apelido</Label>
                <Input value={form.apelido} onChange={(e) => setForm((f) => ({ ...f, apelido: e.target.value }))} placeholder="Ex.: Caju - Amanda" data-testid="input-apelido" />
              </div>
              <div>
                <Label>Responsável</Label>
                <Input value={form.responsavel} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do colaborador" data-testid="input-responsavel" />
              </div>
              <div>
                <Label>Saldo Inicial</Label>
                <Input type="number" step="0.01" value={form.saldoInicial} onChange={(e) => setForm((f) => ({ ...f, saldoInicial: e.target.value }))} data-testid="input-saldo-inicial" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => criar.mutate()} disabled={criar.isPending || !form.apelido} data-testid="button-confirmar-criar">Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {q.isLoading ? <Skeleton className="h-32" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(q.data?.carteiras ?? []).map((c) => (
            <Card key={c.id} data-testid={`card-carteira-${c.id}`}>
              <CardHeader className="pb-2 flex flex-row items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{c.apelido || c.banco}</CardTitle>
                {c.pendentes > 0 && <Badge variant="secondary" className="ml-auto" data-testid={`badge-pendentes-${c.id}`}>{c.pendentes} pendente(s)</Badge>}
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Saldo atual</span><span className="font-mono font-semibold" data-testid={`text-saldo-${c.id}`}>{fmt(c.saldoAtual)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gasto no mês</span><span className="font-mono" data-testid={`text-gasto-${c.id}`}>{fmt(c.totalGastoMes)}</span></div>
              </CardContent>
            </Card>
          ))}
          {(q.data?.carteiras ?? []).length === 0 && (
            <Card className="col-span-full"><CardContent className="text-center py-8 text-muted-foreground">Nenhuma carteira cadastrada. Crie uma para gerenciar cartões corporativos (Caju, etc.).</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}
