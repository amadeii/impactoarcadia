// Sprint RH-3 — passo 3: tela de sucesso pós-confirmação.
import { Link } from "wouter";
import { CheckCircle2, ArrowRight, Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  result: { periodId: string; entryCount: number; controlTxIds: string[] };
  onNew: () => void;
}

export function ImportConfirmStep({ result, onNew }: Props) {
  return (
    <Card>
      <CardContent className="pt-10 pb-10 text-center space-y-4 max-w-lg mx-auto">
        <CheckCircle2 className="h-14 w-14 mx-auto text-green-600" />
        <h3 className="text-xl font-semibold">Importação concluída!</h3>
        <p className="text-muted-foreground">
          O período foi criado, aprovado e os lançamentos foram registrados no Control automaticamente.
        </p>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Card><CardContent className="pt-4 pb-4">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold" data-testid="text-result-entries">{result.entryCount}</p>
            <p className="text-xs text-muted-foreground">Colaboradores</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <Wallet className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold" data-testid="text-result-control">{result.controlTxIds.length}</p>
            <p className="text-xs text-muted-foreground">Lançamentos no Control</p>
          </CardContent></Card>
        </div>
        <div className="flex gap-2 justify-center pt-4">
          <Link href="/hr/folha">
            <Button data-testid="button-go-payroll">Ver folha <ArrowRight className="h-4 w-4 ml-1" /></Button>
          </Link>
          <Button variant="outline" onClick={onNew} data-testid="button-new-import">Nova importação</Button>
        </div>
      </CardContent>
    </Card>
  );
}
