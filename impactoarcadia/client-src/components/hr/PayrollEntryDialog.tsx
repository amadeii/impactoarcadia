// Sprint RH-2 — Lançamento manual de folha por colaborador. Cálculos de
// INSS / FGTS / IRRF são automáticos (com override manual via campos editáveis).
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { HrEmployee, HrPayrollEntry } from "@shared/schema";

// Tabela INSS 2024 (faixas progressivas):
const INSS_BRACKETS = [
  { up: 1412.00, rate: 0.075 },
  { up: 2666.68, rate: 0.09  },
  { up: 4000.03, rate: 0.12  },
  { up: 7786.02, rate: 0.14  },
];
const INSS_CEILING = 7786.02;

function calcInss(base: number): number {
  if (base <= 0) return 0;
  let total = 0; let prev = 0;
  const cap = Math.min(base, INSS_CEILING);
  for (const b of INSS_BRACKETS) {
    if (cap <= prev) break;
    const slice = Math.min(cap, b.up) - prev;
    total += slice * b.rate;
    prev = b.up;
    if (cap <= b.up) break;
  }
  return Math.round(total * 100) / 100;
}

// Tabela IRRF 2024:
function calcIrrf(base: number): number {
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return Math.max(0, base * 0.075 - 169.44);
  if (base <= 3751.05) return Math.max(0, base * 0.15  - 381.44);
  if (base <= 4664.68) return Math.max(0, base * 0.225 - 662.77);
  return Math.max(0, base * 0.275 - 896.00);
}

const SITUATIONS = ["Trabalhando", "Férias", "Atestado", "Afastamento", "Outros"];

const fmtIn = (v: any) => {
  if (v == null || v === "") return "0";
  return String(v);
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodId: string;
  employees: HrEmployee[];
  existingEntryIds: string[];
  editing: HrPayrollEntry | null;
};

export function PayrollEntryDialog({ open, onOpenChange, periodId, employees, existingEntryIds, editing }: Props) {
  const { toast } = useToast();
  const isEdit = !!editing;
  const [employeeId, setEmployeeId] = useState<string>("");
  const [situation, setSituation] = useState<string>("Trabalhando");
  const [salaryBase, setSalaryBase] = useState<string>("0");
  const [proventos, setProventos] = useState<string>("0");
  const [outrosDescontos, setOutrosDescontos] = useState<string>("0");
  const [overrideInss, setOverrideInss] = useState<string>("");
  const [overrideFgts, setOverrideFgts] = useState<string>("");
  const [overrideIrrf, setOverrideIrrf] = useState<string>("");

  // Reset / hydrate ao abrir
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEmployeeId(editing.employeeId);
      setSituation(editing.situation ?? "Trabalhando");
      setSalaryBase(fmtIn(editing.salaryBase));
      const prov = Math.max(0, Number(editing.totalGross) - Number(editing.salaryBase));
      setProventos(prov.toFixed(2));
      const outros = Math.max(0, Number(editing.totalDiscounts) - Number(editing.inssValue) - Number(editing.irrfValue));
      setOutrosDescontos(outros.toFixed(2));
      setOverrideInss(fmtIn(editing.inssValue));
      setOverrideFgts(fmtIn(editing.fgtsValue));
      setOverrideIrrf(fmtIn(editing.irrfValue));
    } else {
      setEmployeeId(""); setSituation("Trabalhando");
      setSalaryBase("0"); setProventos("0"); setOutrosDescontos("0");
      setOverrideInss(""); setOverrideFgts(""); setOverrideIrrf("");
    }
  }, [open, editing]);

  // Quando trocar o colaborador num novo lançamento, pré-preenche o salário base.
  useEffect(() => {
    if (isEdit || !employeeId) return;
    const emp = employees.find(e => e.id === employeeId);
    if (emp) setSalaryBase(fmtIn(emp.baseSalary));
  }, [employeeId, employees, isEdit]);

  const availableEmployees = useMemo(() => {
    if (isEdit) return employees;
    return employees.filter(e => !existingEntryIds.includes(e.id));
  }, [employees, existingEntryIds, isEdit]);

  const calc = useMemo(() => {
    const base = Number(salaryBase) || 0;
    const prov = Number(proventos) || 0;
    const gross = base + prov;
    const inss = overrideInss !== "" ? Number(overrideInss) : calcInss(gross);
    const irrfBase = Math.max(0, gross - inss);
    const irrf = overrideIrrf !== "" ? Number(overrideIrrf) : calcIrrf(irrfBase);
    const fgts = overrideFgts !== "" ? Number(overrideFgts) : Math.round(gross * 0.08 * 100) / 100;
    const outros = Number(outrosDescontos) || 0;
    const totalDiscounts = inss + irrf + outros;
    const net = Math.max(0, gross - totalDiscounts);
    return { gross, inss, fgts, irrf, irrfBase, totalDiscounts, net };
  }, [salaryBase, proventos, outrosDescontos, overrideInss, overrideFgts, overrideIrrf]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        employeeId,
        salaryBase: (Number(salaryBase) || 0).toFixed(2),
        totalGross: calc.gross.toFixed(2),
        totalDiscounts: calc.totalDiscounts.toFixed(2),
        netSalary: calc.net.toFixed(2),
        inssBase: calc.gross.toFixed(2),
        inssValue: calc.inss.toFixed(2),
        fgtsBase: calc.gross.toFixed(2),
        fgtsValue: calc.fgts.toFixed(2),
        irrfBase: calc.irrfBase.toFixed(2),
        irrfValue: calc.irrf.toFixed(2),
        situation,
      };
      if (isEdit) {
        return apiRequest("PUT", `/api/hr/payroll/${periodId}/entries/${editing!.id}`, body);
      }
      return apiRequest("POST", `/api/hr/payroll/${periodId}/entries`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/payroll"] });
      toast({ title: isEdit ? "Lançamento atualizado" : "Lançamento criado" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lançamento" : "Adicionar colaborador na folha"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Colaborador</Label>
            <Select value={employeeId} onValueChange={setEmployeeId} disabled={isEdit}>
              <SelectTrigger data-testid="select-employee"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {availableEmployees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Situação</Label>
              <Select value={situation} onValueChange={setSituation}>
                <SelectTrigger data-testid="select-situation"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SITUATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Salário base</Label>
              <Input type="number" step="0.01" value={salaryBase} onChange={e => setSalaryBase(e.target.value)} data-testid="input-salary" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <Label className="text-green-700 dark:text-green-400">Outros proventos</Label>
              <Input type="number" step="0.01" value={proventos} onChange={e => setProventos(e.target.value)} data-testid="input-proventos" />
              <p className="text-xs text-muted-foreground mt-1">Horas extras, adicional noturno, comissões…</p>
            </div>
            <div>
              <Label className="text-red-700 dark:text-red-400">Outros descontos</Label>
              <Input type="number" step="0.01" value={outrosDescontos} onChange={e => setOutrosDescontos(e.target.value)} data-testid="input-outros-desc" />
              <p className="text-xs text-muted-foreground mt-1">Vale-transporte, plano de saúde, faltas…</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div>
              <Label>INSS (override)</Label>
              <Input type="number" step="0.01" placeholder={calc.inss.toFixed(2)} value={overrideInss} onChange={e => setOverrideInss(e.target.value)} data-testid="input-inss" />
            </div>
            <div>
              <Label>IRRF (override)</Label>
              <Input type="number" step="0.01" placeholder={calc.irrf.toFixed(2)} value={overrideIrrf} onChange={e => setOverrideIrrf(e.target.value)} data-testid="input-irrf" />
            </div>
            <div>
              <Label>FGTS (override)</Label>
              <Input type="number" step="0.01" placeholder={calc.fgts.toFixed(2)} value={overrideFgts} onChange={e => setOverrideFgts(e.target.value)} data-testid="input-fgts" />
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Bruto</div>
              <div className="font-semibold" data-testid="calc-gross">{fmt(calc.gross)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Descontos</div>
              <div className="font-semibold text-red-600 dark:text-red-400" data-testid="calc-discounts">{fmt(calc.totalDiscounts)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Líquido</div>
              <div className="font-semibold text-green-700 dark:text-green-400" data-testid="calc-net">{fmt(calc.net)}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!employeeId || save.isPending} data-testid="btn-save-entry">
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
