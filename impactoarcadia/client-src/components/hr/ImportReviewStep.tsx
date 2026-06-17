// Sprint RH-3 — passo 2: revisão completa do preview com edição de rubricas.
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  UserPlus, Users, Loader2, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Props {
  previewId: string;
  onConfirmed: (result: { periodId: string; entryCount: number; controlTxIds: string[] }) => void;
  onCancel: () => void;
}

const fmtBRL = (v: any) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v ?? 0);
  return Number.isNaN(n) ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export function ImportReviewStep({ previewId, onConfirmed, onCancel }: Props) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [matchEdits, setMatchEdits] = useState<any[] | null>(null);

  const { data: preview, isLoading } = useQuery<any>({
    queryKey: ["/api/hr/import/preview", previewId],
    queryFn: async () => {
      const r = await fetch(`/api/hr/import/preview/${previewId}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const matches = (matchEdits ?? preview?.matchResults ?? []) as any[];
  const data = preview?.extractedData;
  const warnings = (preview?.validationErrors?.warnings ?? []) as string[];

  const stats = useMemo(() => ({
    total: matches.length,
    matched: matches.filter(m => m.matchType === "matched").length,
    auto: matches.filter(m => m.matchType === "auto_created").length,
    conflict: matches.filter(m => m.matchType === "conflict").length,
    valid: matches.filter(m => m.employeeId).length,
  }), [matches]);

  const toggle = (i: string) =>
    setExpanded(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const updateRubricValue = (mIdx: number, kind: "earnings" | "discounts", rIdx: number, value: number) => {
    const next = JSON.parse(JSON.stringify(matches));
    const items = next[mIdx].extracted[kind] || [];
    if (!items[rIdx]) return;
    items[rIdx].value = value;
    // Recalcula totais do colaborador.
    const sum = (arr: any[]) => arr.reduce((a, x) => a + Number(x.value || 0), 0);
    const c = next[mIdx].extracted;
    c.totalGross = sum(c.earnings || []);
    c.totalDiscounts = sum(c.discounts || []);
    c.netSalary = +(c.totalGross - c.totalDiscounts).toFixed(2);
    setMatchEdits(next);
  };

  const saveDraftMut = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/hr/import/preview/${previewId}`, {
        matchResults: matches,
        status: "reviewed",
      });
    },
    onSuccess: () => {
      toast({ title: "Rascunho salvo" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/import/preview", previewId] });
      setMatchEdits(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/hr/import/preview/${previewId}`, undefined),
    onSuccess: () => { toast({ title: "Importação cancelada" }); onCancel(); },
  });

  const confirmMut = useMutation({
    mutationFn: async () => {
      // Salva edições antes de confirmar.
      if (matchEdits) {
        await apiRequest("PUT", `/api/hr/import/preview/${previewId}`, {
          matchResults: matches, status: "reviewed",
        });
      }
      const r = await fetch(`/api/hr/import/preview/${previewId}/confirm`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Importação confirmada", description: `${data.entryCount} colaboradores · ${data.controlTxIds?.length || 0} lançamentos no Control` });
      onConfirmed(data);
    },
    onError: (e: any) => toast({ title: "Erro ao confirmar", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!preview) return <div className="text-center py-8 text-muted-foreground">Preview não encontrado.</div>;
  if (preview.status === "expired") {
    return (
      <Card><CardContent className="pt-6 text-center text-muted-foreground">
        <AlertCircle className="h-10 w-10 mx-auto mb-2 text-amber-600" />
        <p>Este preview expirou (TTL 2h). Refaça o upload do PDF.</p>
        <Button onClick={onCancel} className="mt-4">Voltar</Button>
      </CardContent></Card>
    );
  }

  const blockingErrors = matches.some(m => !m.employeeId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Coluna esquerda — dados extraídos */}
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{data?.companyName ?? "—"}</span>
              <Badge variant="outline" className="font-mono">{data?.cnpj ?? "—"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Competência</p><p className="font-medium" data-testid="text-review-competence">{data?.competence}</p></div>
              <div><p className="text-muted-foreground text-xs">Total Bruto</p><p className="font-medium">{fmtBRL(data?.totalGross)}</p></div>
              <div><p className="text-muted-foreground text-xs">Total Descontos</p><p className="font-medium">{fmtBRL(data?.totalDiscounts)}</p></div>
              <div><p className="text-muted-foreground text-xs">Total Líquido</p><p className="font-medium text-primary" data-testid="text-review-totalnet">{fmtBRL(data?.totalNet)}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colaboradores ({matches.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((m, idx) => {
                  const c = m.extracted;
                  const open = expanded.has(String(idx));
                  return (
                    <>
                      <TableRow
                        key={`row-${idx}`}
                        className="cursor-pointer hover-elevate"
                        onClick={() => toggle(String(idx))}
                        data-testid={`row-collab-${idx}`}
                      >
                        <TableCell>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-medium">{c.fullName}</TableCell>
                        <TableCell className="font-mono text-xs">{c.cpf}</TableCell>
                        <TableCell className="text-right">{fmtBRL(c.totalGross)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtBRL(c.netSalary)}</TableCell>
                        <TableCell>
                          {m.matchType === "matched" && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Vinculado</Badge>}
                          {m.matchType === "auto_created" && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"><UserPlus className="h-3 w-3 mr-1" />Novo</Badge>}
                          {m.matchType === "conflict" && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Conflito</Badge>}
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow key={`exp-${idx}`}>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="p-3 space-y-3">
                              {m.warnings?.length > 0 && (
                                <div className="text-xs bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-800">
                                  {m.warnings.map((w: string, i: number) => <div key={i}>⚠ {w}</div>)}
                                </div>
                              )}
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                <div><p className="text-muted-foreground">Cargo</p><p>{c.cargo}</p></div>
                                <div><p className="text-muted-foreground">Departamento</p><p>{c.department}</p></div>
                                <div><p className="text-muted-foreground">Situação</p><p>{c.situation}</p></div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold mb-1">Proventos</p>
                                <Table className="text-xs">
                                  <TableBody>
                                    {(c.earnings || []).map((r: any, ri: number) => (
                                      <TableRow key={`e-${ri}`}>
                                        <TableCell className="font-mono w-20">{r.code}</TableCell>
                                        <TableCell>{r.description}</TableCell>
                                        <TableCell className="w-24 text-right">{r.reference}</TableCell>
                                        <TableCell className="w-32">
                                          <Input
                                            type="number" step="0.01"
                                            value={r.value}
                                            onChange={(e) => updateRubricValue(idx, "earnings", ri, +e.target.value)}
                                            className="h-7 text-right text-xs"
                                            data-testid={`input-rubric-earning-${idx}-${ri}`}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              <div>
                                <p className="text-xs font-semibold mb-1">Descontos</p>
                                <Table className="text-xs">
                                  <TableBody>
                                    {(c.discounts || []).map((r: any, ri: number) => (
                                      <TableRow key={`d-${ri}`}>
                                        <TableCell className="font-mono w-20">{r.code}</TableCell>
                                        <TableCell>{r.description}</TableCell>
                                        <TableCell className="w-24 text-right">{r.reference}</TableCell>
                                        <TableCell className="w-32">
                                          <Input
                                            type="number" step="0.01"
                                            value={r.value}
                                            onChange={(e) => updateRubricValue(idx, "discounts", ri, +e.target.value)}
                                            className="h-7 text-right text-xs"
                                            data-testid={`input-rubric-discount-${idx}-${ri}`}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Coluna direita — resumo e ações */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Total</span><span className="font-medium">{stats.total}</span></div>
            <div className="flex justify-between text-green-700 dark:text-green-300"><span>Vinculados</span><span className="font-medium">{stats.matched}</span></div>
            <div className="flex justify-between text-amber-700 dark:text-amber-300"><span>Auto-criados</span><span className="font-medium" data-testid="text-stat-auto">{stats.auto}</span></div>
            <div className="flex justify-between text-red-700 dark:text-red-300"><span>Conflitos</span><span className="font-medium" data-testid="text-stat-conflict">{stats.conflict}</span></div>
          </CardContent>
        </Card>

        {warnings.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />Alertas</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1">
              {warnings.map((w, i) => <div key={i} className="text-muted-foreground">• {w}</div>)}
            </CardContent>
          </Card>
        )}

        {blockingErrors && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>Há colaboradores sem ID válido (provavelmente CPF inválido). Eles serão ignorados na confirmação.</span>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <Button
            onClick={() => confirmMut.mutate()}
            disabled={confirmMut.isPending || stats.valid === 0}
            className="w-full"
            data-testid="button-confirm"
          >
            {confirmMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirmando…</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar importação</>}
          </Button>
          <Button
            variant="outline" onClick={() => saveDraftMut.mutate()}
            disabled={saveDraftMut.isPending || !matchEdits}
            className="w-full"
            data-testid="button-save-draft"
          >
            <Save className="h-4 w-4 mr-2" /> Salvar rascunho
          </Button>
          <Button
            variant="ghost" onClick={() => cancelMut.mutate()}
            disabled={cancelMut.isPending}
            className="w-full text-muted-foreground"
            data-testid="button-cancel-import"
          >
            Cancelar e descartar
          </Button>
        </div>
      </div>
    </div>
  );
}
