import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";

interface Mapping { field: string; sourceColumn: string; confidence: number; }

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(/[;,\t]/).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = cells[i] ?? ""; });
    return o;
  });
  return { headers, rows };
}

export default function ImportTab({ clienteId }: { clienteId: string }) {
  const { toast } = useToast();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Mapping[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [fileName, setFileName] = useState("");

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const { headers: h, rows: r } = parseCsv(text);
    if (!h.length) { toast({ title: "Arquivo vazio ou inválido", variant: "destructive" }); return; }
    setHeaders(h); setRows(r); setPreview(null); setMapping([]);
    // Auto-detect
    detect.mutate(h);
  };

  const detect = useMutation({
    mutationFn: async (hh: string[]) => {
      const r = await apiRequest("POST", "/api/control/import/detectar", { headers: hh });
      return await r.json();
    },
    onSuccess: (data: any) => setMapping(data.mapeamento ?? []),
  });

  const previewMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/control/import/preview", { clienteId, rows, mapping });
      return await r.json();
    },
    onSuccess: (data: any) => setPreview(data),
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const executar = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/control/import/executar", { clienteId, rows, mapping });
      return await r.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `${data.importados} importados`, description: `${data.ignorados} ignorados` });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "lancamentos"] });
      setHeaders([]); setRows([]); setMapping([]); setPreview(null); setFileName("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const updateMapping = (field: string, sourceColumn: string) => {
    const ex = mapping.find((m) => m.field === field);
    if (ex) {
      setMapping(mapping.map((m) => (m.field === field ? { ...m, sourceColumn } : m)));
    } else {
      setMapping([...mapping, { field, sourceColumn, confidence: 0.5 }]);
    }
  };

  const camposObrigatorios = ["data", "valor", "descricao", "tipo"];
  const camposOpcionais = ["favorecido", "documento"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Importar Lançamentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">Selecione um arquivo CSV</p>
          <Input type="file" accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            data-testid="input-import-file"
            className="max-w-xs mx-auto" />
          {fileName && <p className="text-xs mt-2" data-testid="text-filename">{fileName} — {rows.length} linhas detectadas</p>}
        </div>

        {headers.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Mapeamento de colunas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[...camposObrigatorios, ...camposOpcionais].map((field) => {
                const m = mapping.find((mm) => mm.field === field);
                return (
                  <div key={field} className="flex items-center gap-2">
                    <span className="w-28 text-sm font-medium">
                      {field}
                      {camposObrigatorios.includes(field) && <span className="text-rose-500">*</span>}
                    </span>
                    <select
                      className="flex-1 border rounded px-2 py-1 text-sm bg-background"
                      value={m?.sourceColumn ?? ""}
                      onChange={(e) => updateMapping(field, e.target.value)}
                      data-testid={`select-mapping-${field}`}
                    >
                      <option value="">— não mapear —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {m && <Badge variant="outline" className="text-xs">{(m.confidence * 100).toFixed(0)}%</Badge>}
                  </div>
                );
              })}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => previewMut.mutate()} disabled={previewMut.isPending} data-testid="button-preview">Pré-visualizar</Button>
                <Button onClick={() => executar.mutate()} disabled={executar.isPending || !preview || preview.validos === 0} data-testid="button-importar">
                  Importar {preview?.validos ?? ""} linhas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {preview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {preview.validos} válidos
                {preview.comErro > 0 && <><AlertCircle className="h-4 w-4 text-rose-500 ml-2" />{preview.comErro} com erro</>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {preview.amostra.map((r: any, i: number) => (
                    <TableRow key={i} data-testid={`row-preview-${i}`}>
                      <TableCell>{r.tipo}</TableCell>
                      <TableCell>{r.dataVencimento}</TableCell>
                      <TableCell className="max-w-xs truncate">{r.descricao}</TableCell>
                      <TableCell>{r.valor}</TableCell>
                      <TableCell>{r._erro ? <Badge variant="destructive">erro</Badge> : <Badge>ok</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
