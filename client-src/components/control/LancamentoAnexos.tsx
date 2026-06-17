/**
 * LancamentoAnexos.tsx — Panel de anexos inline
 *
 * INSTRUÇÃO DE INTEGRAÇÃO:
 *   Adicionar dentro do drawer/dialog de edição de lançamento em:
 *   client/src/pages/control/EditLancamentoDialog.tsx
 *   (ou qualquer componente que mostre detalhe de um lançamento)
 *
 *   import LancamentoAnexos from "@/components/control/LancamentoAnexos";
 *   // Dentro do Dialog, após os campos de edição:
 *   <LancamentoAnexos lancamentoId={lancamento.id} />
 */

import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient as qc } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Paperclip, Upload, Trash2, FileText, FileImage, File,
  ExternalLink, AlertCircle,
} from "lucide-react";

interface Anexo {
  id: string; tipo: string; nome_arquivo: string;
  url_storage: string; tamanho_bytes?: number;
  mime_type?: string; uploaded_por_nome?: string;
  created_at: string;
}

const TIPOS_ANEXO = [
  { value: "boleto", label: "Boleto" },
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "contrato", label: "Contrato" },
  { value: "documento", label: "Documento" },
  { value: "outro", label: "Outro" },
];

function TipoLabel({ tipo }: { tipo: string }) {
  const colors: Record<string, string> = {
    boleto: "bg-blue-100 text-blue-700",
    nota_fiscal: "bg-green-100 text-green-700",
    contrato: "bg-purple-100 text-purple-700",
    documento: "bg-gray-100 text-gray-700",
    outro: "bg-amber-100 text-amber-700",
  };
  const label = TIPOS_ANEXO.find(t => t.value === tipo)?.label || tipo;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[tipo] || colors.outro}`}>
      {label}
    </span>
  );
}

function FileIcon({ mime }: { mime?: string }) {
  if (!mime) return <File className="h-4 w-4 text-muted-foreground" />;
  if (mime.startsWith("image/")) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function fmtBytes(b?: number) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  lancamentoId: string;
  readOnly?: boolean;
}

export default function LancamentoAnexos({ lancamentoId, readOnly }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipoSelecionado, setTipoSelecionado] = useState("documento");
  const [uploading, setUploading] = useState(false);

  const { data: anexos = [], isLoading } = useQuery<Anexo[]>({
    queryKey: ["lancamento-anexos", lancamentoId],
    queryFn: () =>
      fetch(`/api/control/lancamentos/${lancamentoId}/anexos`, { credentials: "include" })
        .then(r => r.json()),
    enabled: !!lancamentoId,
  });

  const mutDelete = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/control/anexos/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lancamento-anexos", lancamentoId] });
      toast({ title: "Anexo removido" });
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Limite: 20 MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tipo", tipoSelecionado);
      const r = await fetch(`/api/control/lancamentos/${lancamentoId}/anexos`, {
        method: "POST", body: fd, credentials: "include",
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || "Erro no upload");
      }
      qc.invalidateQueries({ queryKey: ["lancamento-anexos", lancamentoId] });
      toast({ title: "Anexo adicionado", description: file.name });
      if (fileRef.current) fileRef.current.value = "";
    } catch (ex: any) {
      toast({ title: "Erro no upload", description: ex.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function abrirAnexo(url: string) {
    // Para data URIs (base64), abre em nova aba
    const w = window.open();
    if (w) {
      if (url.startsWith("data:")) {
        w.document.write(`<iframe src="${url}" width="100%" height="100%" style="border:none"></iframe>`);
      } else {
        w.location.href = url;
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Anexos</span>
        {anexos.length > 0 && (
          <Badge variant="secondary" className="text-xs">{anexos.length}</Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando anexos...</p>
      ) : anexos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
      ) : (
        <div className="space-y-1.5">
          {anexos.map(a => (
            <div key={a.id} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30 group">
              <FileIcon mime={a.mime_type} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{a.nome_arquivo}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <TipoLabel tipo={a.tipo} />
                  {a.tamanho_bytes && (
                    <span className="text-xs text-muted-foreground">{fmtBytes(a.tamanho_bytes)}</span>
                  )}
                  {a.uploaded_por_nome && (
                    <span className="text-xs text-muted-foreground">· {a.uploaded_por_nome}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizar"
                  onClick={() => abrirAnexo(a.url_storage)}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Remover"
                    onClick={() => mutDelete.mutate(a.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex gap-2 items-center pt-1">
          <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_ANEXO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}>
            <Upload className="h-3 w-3 mr-1" />
            {uploading ? "Enviando..." : "Anexar arquivo"}
          </Button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange}
            accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx,.zip,.xml" />
        </div>
      )}
      <p className="text-xs text-muted-foreground">PDF, imagens, planilhas, Word, XML · máx. 20 MB</p>
    </div>
  );
}
