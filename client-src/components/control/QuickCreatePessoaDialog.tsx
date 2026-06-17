/**
 * Sprint C-E12 — QuickCreatePessoaDialog
 * Modal mínimo para cadastro rápido inline de pessoa/empresa
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface QuickCreatePessoaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (pessoa: { id: string; nomeFantasia: string; cnpjCpf?: string }) => void;
  papelPadrao?: string;
}

export function QuickCreatePessoaDialog({
  open,
  onOpenChange,
  onCreated,
  papelPadrao = "cliente",
}: QuickCreatePessoaDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tipoPessoa, setTipoPessoa] = useState<"J" | "F">("J");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/pessoas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Erro ao cadastrar");
      }
      return res.json();
    },
    onSuccess: (pessoa) => {
      toast({ title: "Pessoa cadastrada com sucesso" });
      qc.invalidateQueries({ queryKey: ["/api/pessoas"] });
      onCreated?.(pessoa);
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao cadastrar", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      nomeFantasia: fd.get("nomeFantasia") as string,
      razaoSocial: fd.get("razaoSocial") as string || undefined,
      cnpjCpf: fd.get("cnpjCpf") as string || undefined,
      tipoPessoa,
      status: "ativo",
      papeis: [{ tipoPapel: papelPadrao }],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastro Rápido de Pessoa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipoPessoa} onValueChange={(v) => setTipoPessoa(v as "J" | "F")}>
                <SelectTrigger data-testid="quick-create-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="J">Pessoa Jurídica</SelectItem>
                  <SelectItem value="F">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomeFantasia">
                {tipoPessoa === "J" ? "Nome / Fantasia *" : "Nome *"}
              </Label>
              <Input
                id="nomeFantasia"
                name="nomeFantasia"
                placeholder={tipoPessoa === "J" ? "Ex: Petrobras S.A." : "Ex: João Silva"}
                required
                data-testid="quick-create-nome"
              />
            </div>

            {tipoPessoa === "J" && (
              <div className="space-y-2">
                <Label htmlFor="razaoSocial">Razão Social</Label>
                <Input
                  id="razaoSocial"
                  name="razaoSocial"
                  placeholder="Razão social completa"
                  data-testid="quick-create-razao-social"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="cnpjCpf">
                {tipoPessoa === "J" ? "CNPJ" : "CPF"}
              </Label>
              <Input
                id="cnpjCpf"
                name="cnpjCpf"
                placeholder={tipoPessoa === "J" ? "00.000.000/0001-00" : "000.000.000-00"}
                data-testid="quick-create-cnpj"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="quick-create-submit">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
