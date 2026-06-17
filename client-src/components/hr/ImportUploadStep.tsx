// Sprint RH-3 — passo 1: dropzone + classificação + invocação do parser IA.
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileText, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export interface ClassifyResult {
  docType: "extrato_mensal" | "recibo" | "ponto" | "unknown";
  competence: string | null;
  competenceLabel: string | null;
  cnpj: string | null;
  rawTextSize: number;
  sourceFile: string;
}

interface Props {
  clienteId: string;
  onPreviewReady: (previewId: string) => void;
}

const DOC_LABEL: Record<string, string> = {
  extrato_mensal: "Extrato Mensal",
  recibo: "Recibo de Pagamento",
  ponto: "Folha de Ponto",
  unknown: "Não identificado",
};

export function ImportUploadStep({ clienteId, onPreviewReady }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [classified, setClassified] = useState<ClassifyResult | null>(null);
  const [stage, setStage] = useState<"idle" | "extracting" | "parsing">("idle");

  const uploadMut = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData();
      fd.append("clienteId", clienteId);
      fd.append("file", f);
      const r = await fetch("/api/hr/import/upload", {
        method: "POST", body: fd, credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return (await r.json()) as ClassifyResult;
    },
    onSuccess: (data) => {
      setClassified(data);
      setStage("idle");
    },
    onError: (e: any) => {
      setStage("idle");
      toast({ title: "Erro na extração", description: e.message, variant: "destructive" });
    },
  });

  const previewMut = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData();
      fd.append("clienteId", clienteId);
      fd.append("file", f);
      const r = await fetch("/api/hr/import/preview", {
        method: "POST", body: fd, credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return (await r.json()) as { previewId: string; warnings: string[] };
    },
    onSuccess: (data) => {
      setStage("idle");
      if (data.warnings?.length) {
        toast({ title: "Importação concluída com avisos", description: `${data.warnings.length} alerta(s)` });
      }
      onPreviewReady(data.previewId);
    },
    onError: (e: any) => {
      setStage("idle");
      toast({ title: "Erro ao processar", description: e.message, variant: "destructive" });
    },
  });

  const handleFile = (f: File) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Apenas PDF é suportado", variant: "destructive" });
      return;
    }
    setFile(f);
    setClassified(null);
    setStage("extracting");
    uploadMut.mutate(f);
  };

  const onProcess = () => {
    if (!file) return;
    setStage("parsing");
    previewMut.mutate(file);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div
            data-testid="dropzone-pdf"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover-elevate"
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Arraste o PDF do Extrato Mensal aqui</p>
            <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar (até 25 MB)</p>
            <input
              ref={inputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              data-testid="input-file"
            />
          </div>
        </CardContent>
      </Card>

      {file && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium" data-testid="text-filename">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              {stage === "extracting" && (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Extraindo texto…
                </Badge>
              )}
            </div>

            {classified && (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo detectado</p>
                  <p className="font-medium" data-testid="text-doctype">
                    {DOC_LABEL[classified.docType]}
                    {classified.docType !== "extrato_mensal" && (
                      <AlertCircle className="inline h-4 w-4 ml-1 text-amber-600" />
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Competência</p>
                  <p className="font-medium" data-testid="text-competence">{classified.competenceLabel ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CNPJ</p>
                  <p className="font-medium font-mono text-sm" data-testid="text-cnpj">{classified.cnpj ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tamanho do texto</p>
                  <p className="font-medium" data-testid="text-textsize">{(classified.rawTextSize / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            )}

            {classified && classified.docType !== "extrato_mensal" && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Esta sprint suporta apenas <strong>Extrato Mensal</strong>. Outros tipos virão em sprints futuras.</span>
              </div>
            )}

            {classified && classified.docType === "extrato_mensal" && (
              <Button
                onClick={onProcess}
                disabled={stage === "parsing"}
                className="w-full"
                data-testid="button-process"
              >
                {stage === "parsing" ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando com IA…</>
                ) : (
                  <>Processar e gerar preview</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
