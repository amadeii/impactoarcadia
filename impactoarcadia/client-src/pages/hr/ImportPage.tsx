// Sprint RH-3 — página de importação Domínio com stepper de 3 passos.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Upload, Eye, CheckCircle2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { HrTabs } from "./HrTabs";
import { ImportUploadStep } from "@/components/hr/ImportUploadStep";
import { ImportReviewStep } from "@/components/hr/ImportReviewStep";
import { ImportConfirmStep } from "@/components/hr/ImportConfirmStep";

type Step = 1 | 2 | 3;
type ConfirmResult = { periodId: string; entryCount: number; controlTxIds: string[] };
type ClientLite = { id: string; name: string; company?: string };

const STEPS: { num: Step; label: string; icon: any }[] = [
  { num: 1, label: "Upload", icon: Upload },
  { num: 2, label: "Revisão", icon: Eye },
  { num: 3, label: "Conclusão", icon: CheckCircle2 },
];

export default function ImportPage() {
  const [clienteId, setClienteId] = useState<string>("");
  const [step, setStep] = useState<Step>(1);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);

  const { data: clients = [] } = useQuery<ClientLite[]>({ queryKey: ["/api/clients"] });

  const reset = () => {
    setStep(1); setPreviewId(null); setResult(null);
  };

  return (
    <div className="p-6 space-y-4">
      <HrTabs />
      <div>
        <h2 className="text-2xl font-bold">Importação Domínio</h2>
        <p className="text-sm text-muted-foreground">
          Envie o Extrato Mensal em PDF e a IA extrai e prepara o período de folha automaticamente.
        </p>
      </div>

      <div className="flex items-center gap-3 max-w-md">
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger data-testid="select-cliente"><SelectValue placeholder="Selecione a empresa cliente" /></SelectTrigger>
          <SelectContent>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 py-4 border-b border-border">
        {STEPS.map((s, i) => {
          const done = step > s.num;
          const active = step === s.num;
          const Icon = done ? Check : s.icon;
          return (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center border-2 text-sm",
                  done && "bg-primary border-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-border text-muted-foreground",
                )}
                data-testid={`step-indicator-${s.num}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className={cn("text-sm", active && "font-medium")}>{s.label}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-border mx-2" />}
            </div>
          );
        })}
      </div>

      {!clienteId && (
        <div className="text-sm text-muted-foreground p-8 text-center bg-muted/30 rounded-md">
          Selecione uma empresa cliente para começar.
        </div>
      )}

      {clienteId && step === 1 && (
        <ImportUploadStep
          clienteId={clienteId}
          onPreviewReady={(id) => { setPreviewId(id); setStep(2); }}
        />
      )}

      {clienteId && step === 2 && previewId && (
        <ImportReviewStep
          previewId={previewId}
          onConfirmed={(r) => { setResult(r); setStep(3); }}
          onCancel={reset}
        />
      )}

      {clienteId && step === 3 && result && (
        <ImportConfirmStep result={result} onNew={reset} />
      )}
    </div>
  );
}
