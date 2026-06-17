/**
 * Sprint C-E11 — Preview da Importação de Planilha
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, FileText, BarChart3, Banknote } from "lucide-react";

interface ImportPreview {
  bancos: { nome: string; tipo: string; saldo: number }[];
  clientes: { nome: string; cnpj?: string; tipo: string }[];
  fornecedores: { nome: string; cnpj?: string; tipo: string }[];
  planosContas: { codigo: string; descricao: string; tipo: string }[];
  metas: { descricao: string; valor: number; competencia: string }[];
  stats: {
    totalBancos: number; totalClientes: number; totalFornecedores: number;
    totalPlanosContas: number; totalMetas: number;
  };
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PlanilhaImportPreview({ preview }: { preview: ImportPreview }) {
  const { stats } = preview;
  const total = stats.totalBancos + stats.totalClientes + stats.totalFornecedores +
    stats.totalPlanosContas + stats.totalMetas;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { icon: Banknote, label: "Bancos", count: stats.totalBancos, color: "text-green-600" },
          { icon: Users, label: "Clientes", count: stats.totalClientes, color: "text-blue-600" },
          { icon: Building2, label: "Fornecedores", count: stats.totalFornecedores, color: "text-purple-600" },
          { icon: FileText, label: "Plano Contas", count: stats.totalPlanosContas, color: "text-orange-600" },
          { icon: BarChart3, label: "Metas", count: stats.totalMetas, color: "text-pink-600" },
        ].map(({ icon: Icon, label, count, color }) => (
          <Card key={label}>
            <CardContent className="pt-3 pb-2 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {total === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum dado reconhecido. Verifique se as abas da planilha têm nomes como "Clientes", "Fornecedores", "Bancos", "Plano de Contas".
        </p>
      )}

      {total > 0 && (
        <Tabs defaultValue="clientes">
          <TabsList>
            {stats.totalBancos > 0 && <TabsTrigger value="bancos">Bancos ({stats.totalBancos})</TabsTrigger>}
            {stats.totalClientes > 0 && <TabsTrigger value="clientes">Clientes ({stats.totalClientes})</TabsTrigger>}
            {stats.totalFornecedores > 0 && <TabsTrigger value="fornecedores">Fornecedores ({stats.totalFornecedores})</TabsTrigger>}
            {stats.totalPlanosContas > 0 && <TabsTrigger value="planos">Plano Contas ({stats.totalPlanosContas})</TabsTrigger>}
          </TabsList>

          <TabsContent value="bancos">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Saldo Inicial</TableHead></TableRow></TableHeader>
              <TableBody>
                {preview.bancos.slice(0, 10).map((b, i) => (
                  <TableRow key={i}><TableCell>{b.nome}</TableCell><TableCell className="capitalize">{b.tipo}</TableCell><TableCell className="text-right">{fmtBRL(b.saldo)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="clientes">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CNPJ/CPF</TableHead><TableHead>Tipo</TableHead></TableRow></TableHeader>
              <TableBody>
                {preview.clientes.slice(0, 10).map((c, i) => (
                  <TableRow key={i}><TableCell>{c.nome}</TableCell><TableCell className="font-mono text-sm">{c.cnpj ?? "—"}</TableCell><TableCell><Badge variant="outline">{c.tipo === "J" ? "PJ" : "PF"}</Badge></TableCell></TableRow>
                ))}
                {preview.clientes.length > 10 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">+{preview.clientes.length - 10} mais...</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="fornecedores">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CNPJ/CPF</TableHead><TableHead>Tipo</TableHead></TableRow></TableHeader>
              <TableBody>
                {preview.fornecedores.slice(0, 10).map((f, i) => (
                  <TableRow key={i}><TableCell>{f.nome}</TableCell><TableCell className="font-mono text-sm">{f.cnpj ?? "—"}</TableCell><TableCell><Badge variant="outline">{f.tipo === "J" ? "PJ" : "PF"}</Badge></TableCell></TableRow>
                ))}
                {preview.fornecedores.length > 10 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">+{preview.fornecedores.length - 10} mais...</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="planos">
            <Table>
              <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead></TableRow></TableHeader>
              <TableBody>
                {preview.planosContas.slice(0, 10).map((p, i) => (
                  <TableRow key={i}><TableCell className="font-mono">{p.codigo}</TableCell><TableCell>{p.descricao}</TableCell><TableCell className="capitalize">{p.tipo}</TableCell></TableRow>
                ))}
                {preview.planosContas.length > 10 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">+{preview.planosContas.length - 10} mais...</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
