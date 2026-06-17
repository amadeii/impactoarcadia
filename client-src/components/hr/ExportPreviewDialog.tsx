// Sprint RH-4 — Dialog de conferência prévia + download do ZIP.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Loader2, AlertTriangle, FileText, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface PreviewData {
  period: { id: string; competence: string; status: string; company: { name: string; cnpj: string } };
  totals: {
    collaborators: number; totalGross: number; totalDiscounts: number; totalNet: number;
    totalInss: number; totalFgts: number; totalIrrf: number;
  };
  controlTransactions: string[];
  collaborators: Array<{ id: string; code: string; name: string; cpf: string; situation: string; totalGross: number; netSalary: number }>;
  warnings: string[];
}

interface Props {
  periodId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExported?: () => void;
}

const fmtBRL = (v: any) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ExportPreviewDialog({ periodId, open, onOpenChange, onExported }: Props) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, error } = useQuery<PreviewData>({
    queryKey: ["/api/hr/export", periodId, "preview"],
    queryFn: async () => {
      const r = await fetch(`/api/hr/export/${periodId}/preview`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    enabled: open,
  });

  const downloadZip = async () => {
    setDownloading(true);
    try {
      const r = await fetch(`/api/hr/export/${periodId}`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      // Extrai filename do header.
      const cd = r.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] || `arcadia_export_${periodId}.zip`;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "Exportação concluída", description: filename });
      onExported?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="dialog-export-preview">
        <DialogHeader>
          <DialogTitle>Exportar Domínio — Conferência Prévia</DialogTitle>
          <DialogDescription>Revise os totais e a lista de colaboradores antes de gerar o pacote ZIP.</DialogDescription>
        </DialogHeader>

        {isLoading && <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

        {data && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 p-3 bg-muted/30 rounded-md">
              <div>
                <p className="font-medium" data-testid="text-export-company">{data.period.company.name}</p>
                <p className="text-xs text-muted-foreground font-mono">CNPJ: {data.period.company.cnpj || "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">Competência: <strong>{data.period.competence}</strong></p>
              </div>
              <Badge variant={data.period.status === "approved" || data.period.status === "exported" ? "default" : "outline"}>
                {data.period.status}
              </Badge>
            </div>

            {data.warnings?.length > 0 && (
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1">
                {data.warnings.map((w, i) => (
                  <div key={i} className="text-xs flex items-start gap-2 text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { l: "Colaboradores", v: data.totals.collaborators, raw: true, t: "stat-collaborators" },
                { l: "Total Bruto", v: fmtBRL(data.totals.totalGross), t: "stat-gross" },
                { l: "Total Descontos", v: fmtBRL(data.totals.totalDiscounts), t: "stat-discounts" },
                { l: "Total Líquido", v: fmtBRL(data.totals.totalNet), highlight: true, t: "stat-net" },
                { l: "INSS Empregados", v: fmtBRL(data.totals.totalInss), t: "stat-inss" },
                { l: "FGTS", v: fmtBRL(data.totals.totalFgts), t: "stat-fgts" },
                { l: "IRRF Retido", v: fmtBRL(data.totals.totalIrrf), t: "stat-irrf" },
                { l: "Lançamentos Control", v: data.controlTransactions.length, raw: true, t: "stat-control" },
              ].map((s, i) => (
                <div key={i} className="p-3 rounded-md border border-border" data-testid={s.t}>
                  <p className="text-xs text-muted-foreground">{s.l}</p>
                  <p className={`font-semibold ${s.highlight ? "text-primary" : ""}`}>{String(s.v)}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" /> Colaboradores no pacote ({data.collaborators.length})
              </p>
              <div className="border border-border rounded-md max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Cód</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="font-mono text-xs">CPF</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.collaborators.map(c => (
                      <TableRow key={c.id} data-testid={`row-export-${c.id}`}>
                        <TableCell className="font-mono text-xs">{c.code}</TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="font-mono text-xs">{c.cpf}</TableCell>
                        <TableCell className="text-right">{fmtBRL(c.totalGross)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtBRL(c.netSalary)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-md flex items-start gap-2">
              <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>O ZIP conterá 4 arquivos: <strong>extrato.pdf</strong> (visual), <strong>extrato.txt</strong> (reimportação Domínio), <strong>recibos.pdf</strong> (1 por colaborador, 2 vias) e <strong>manifesto.json</strong> (auditoria).</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloading} data-testid="button-export-cancel">
            Cancelar
          </Button>
          <Button onClick={downloadZip} disabled={isLoading || !data || downloading} data-testid="button-export-download">
            {downloading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando ZIP…</>
              : <><Download className="h-4 w-4 mr-2" /> Gerar e baixar ZIP</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
