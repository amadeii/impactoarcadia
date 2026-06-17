// Sprint RH-4 — botão "Exportar Domínio" reutilizável.
import { useState } from "react";
import { Download } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ExportPreviewDialog } from "./ExportPreviewDialog";
import { queryClient } from "@/lib/queryClient";

interface Props extends Omit<ButtonProps, "onClick"> {
  periodId: string;
  label?: string;
}

export function ExportButton({ periodId, label = "Exportar Domínio", ...rest }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        data-testid={`button-export-${periodId}`}
        {...rest}
      >
        <Download className="h-4 w-4 mr-1" />
        {label}
      </Button>
      {open && (
        <ExportPreviewDialog
          periodId={periodId}
          open={open}
          onOpenChange={setOpen}
          onExported={() => {
            // Atualiza a lista de períodos para refletir status=exported.
            queryClient.invalidateQueries({ queryKey: ["/api/hr/payroll"] });
          }}
        />
      )}
    </>
  );
}
