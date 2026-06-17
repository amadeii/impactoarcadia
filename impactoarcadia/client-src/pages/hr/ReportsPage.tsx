// Sprint RH-5 — ReportsPage: Relatório Gerencial BPO.
// Blocos: KPIs do mês, Custo por Cargo, Custo por Centro de Custo, Evolução 12m,
// Peso no DRE, Previsão próximo mês, Alertas (13°/férias vencidas).
// Filtros: cliente + competência (com navegação <prev/next>).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, BarChart3, Users, AlertTriangle, TrendingUp, Calendar, PieChart as PieIcon } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { HrTabs } from "./HrTabs";

type ClientLite = { id: string; name: string; company?: string };

type DashboardSingle = {
  competence: string;
  clienteId: string;
  byPosition: Array<{ positionId: string | null; positionName: string; headcount: number; totalGross: number; totalNet: number }>;
  byCostCenter: Array<{ ccId: string | null; ccCodigo: string | null; ccNome: string; headcount: number; totalGross: number; totalNet: number }>;
  evolution: Array<{ competence: string; totalGross: number; totalNet: number; totalInss: number; totalFgts: number; encargosEstimados: number }>;
  dre: { competence: string; folhaGross: number; folhaNet: number; custoTotalFolha: number; totalDespesasControl: number; pesoFolhaPct: number };
  forecast: { competence: string; headcount: number; totalBase: number; encargosEstimados: number; provisao13: number; provisaoFerias: number; custoTotalProjetado: number };
  alerts: {
    feriasVencidas: Array<{ employeeId: string; fullName: string; admissionDate: string; ultimaFerias: string | null; severity: string }>;
    decimo: { provisaoMensal: number; alertas: Array<{ stage: string; due: string; severity: string }> };
    geradoEm: string;
  };
};
type DashboardMulti = {
  competence: string;
  clienteId: null;
  byCompany: Array<{ clienteId: string; clienteName: string; totalGross: number; totalNet: number; totalInss: number; totalFgts: number; totalIrrf: number; encargosEstimados: number }>;
  evolution: Array<{ competence: string; totalGross: number; totalNet: number; totalInss: number; totalFgts: number; encargosEstimados: number }>;
};
type DashboardResponse = DashboardSingle | DashboardMulti;

const fmtBRL = (v: any) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v ?? 0);
  return Number.isNaN(n) ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};
const fmtPct = (v: any) => {
  const n = Number(v ?? 0);
  return `${n.toFixed(1)}%`;
};
function competenceLabel(c: string) {
  const [y, m] = c.split("-");
  return `${m}/${y}`;
}
function shiftCompetence(c: string, delta: number): string {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function todayCompetence(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const SEVERITY_COLOR: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  high: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

export default function ReportsPage() {
  const [competence, setCompetence] = useState<string>(todayCompetence());
  const [clienteId, setClienteId] = useState<string>("");

  const { data: clients = [] } = useQuery<ClientLite[]>({ queryKey: ["/api/clients"] });

  const { data: dash, isLoading } = useQuery<DashboardResponse>({
    queryKey: ["/api/hr/reports/dashboard", clienteId || "_all", competence],
    queryFn: async () => {
      const url = `/api/hr/reports/dashboard?competence=${competence}${clienteId ? `&clienteId=${clienteId}` : ""}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const isSingle = !!clienteId && dash && (dash as DashboardSingle).byPosition !== undefined;
  const single = isSingle ? (dash as DashboardSingle) : null;
  const multi = !isSingle && dash ? (dash as DashboardMulti) : null;

  const evolutionChartData = useMemo(() => {
    const evo = (single?.evolution || multi?.evolution || []);
    return evo.map(e => ({
      mes: competenceLabel(e.competence),
      Bruto: e.totalGross,
      Líquido: e.totalNet,
      Encargos: e.encargosEstimados,
    }));
  }, [single, multi]);

  const positionChartData = useMemo(() => {
    return (single?.byPosition || []).slice(0, 8).map(p => ({
      cargo: p.positionName.length > 20 ? p.positionName.slice(0, 18) + "…" : p.positionName,
      Bruto: p.totalGross,
      Líquido: p.totalNet,
    }));
  }, [single]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-6 w-6" /> Relatório Gerencial BPO
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Custo de folha por empresa, cargo e centro de custo · evolução 12 meses · peso no DRE · previsão e alertas
          </p>
        </div>
      </div>
      <HrTabs />

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Cliente</span>
            <Select value={clienteId || "_all"} onValueChange={(v) => setClienteId(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-[280px]" data-testid="select-cliente">
                <SelectValue placeholder="Todas as empresas (consolidado)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas as empresas (consolidado)</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Competência</span>
            <div className="inline-flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCompetence(c => shiftCompetence(c, -1))} data-testid="button-prev-month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-base font-semibold tabular-nums w-20 text-center" data-testid="text-competence">
                {competenceLabel(competence)}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCompetence(c => shiftCompetence(c, 1))} data-testid="button-next-month">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCompetence(todayCompetence())} data-testid="button-today">
                Hoje
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      )}

      {/* CONSOLIDADO MULTI-EMPRESA */}
      {!isLoading && multi && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Custo por Empresa — {competenceLabel(competence)}</CardTitle>
            </CardHeader>
            <CardContent>
              {multi.byCompany.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-empty-companies">
                  Nenhuma folha aprovada para esta competência. Aprove ou exporte uma folha para ver o relatório.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">INSS</TableHead>
                      <TableHead className="text-right">FGTS</TableHead>
                      <TableHead className="text-right">Encargos est.</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {multi.byCompany.map(c => (
                      <TableRow key={c.clienteId} data-testid={`row-empresa-${c.clienteId}`}>
                        <TableCell className="font-medium">{c.clienteName}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBRL(c.totalGross)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBRL(c.totalInss)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBRL(c.totalFgts)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBRL(c.encargosEstimados)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmtBRL(c.totalNet)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <EvolutionCard data={evolutionChartData} />
        </>
      )}

      {/* VISÃO POR CLIENTE */}
      {!isLoading && single && (
        <>
          {/* KPIs do mês */}
          <div className="grid grid-cols-4 gap-3">
            <Kpi label="Bruto da folha" value={fmtBRL(sumGross(single))} icon={<Users className="h-4 w-4" />} testId="kpi-gross" />
            <Kpi label="Custo total c/ encargos" value={fmtBRL(single.dre.custoTotalFolha)} icon={<TrendingUp className="h-4 w-4" />} testId="kpi-cost" />
            <Kpi label="Peso no DRE" value={fmtPct(single.dre.pesoFolhaPct)} icon={<PieIcon className="h-4 w-4" />} testId="kpi-dre" hint={`Despesas Control: ${fmtBRL(single.dre.totalDespesasControl)}`} />
            <Kpi label={`Previsão ${competenceLabel(single.forecast.competence)}`} value={fmtBRL(single.forecast.custoTotalProjetado)} icon={<Calendar className="h-4 w-4" />} testId="kpi-forecast" hint={`${single.forecast.headcount} ativos`} />
          </div>

          {/* Custo por cargo + por CC */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custo por Cargo</CardTitle>
              </CardHeader>
              <CardContent>
                {single.byPosition.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-empty-positions">Sem dados nesta competência.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cargo</TableHead>
                        <TableHead className="text-right">Headcount</TableHead>
                        <TableHead className="text-right">Bruto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {single.byPosition.map((p, i) => (
                        <TableRow key={p.positionId || i} data-testid={`row-cargo-${i}`}>
                          <TableCell className="font-medium">{p.positionName}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.headcount}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtBRL(p.totalGross)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custo por Centro de Custo</CardTitle>
              </CardHeader>
              <CardContent>
                {single.byCostCenter.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-empty-cc">Sem dados nesta competência.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CC</TableHead>
                        <TableHead className="text-right">Headcount</TableHead>
                        <TableHead className="text-right">Bruto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {single.byCostCenter.map((c, i) => (
                        <TableRow key={c.ccId || `cc-${i}`} data-testid={`row-cc-${i}`}>
                          <TableCell className="font-medium">
                            {c.ccCodigo ? <span className="font-mono text-xs mr-2">{c.ccCodigo}</span> : null}
                            {c.ccNome}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{c.headcount}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtBRL(c.totalGross)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Gráfico cargos */}
          {positionChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top cargos — Bruto vs Líquido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72" data-testid="chart-positions">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={positionChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cargo" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => fmtBRL(v)} tick={{ fontSize: 11 }} width={90} />
                      <Tooltip formatter={(v: any) => fmtBRL(v)} />
                      <Legend />
                      <Bar dataKey="Bruto" fill="#2563eb" />
                      <Bar dataKey="Líquido" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <EvolutionCard data={evolutionChartData} />

          {/* Previsão + DRE */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Previsão {competenceLabel(single.forecast.competence)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Salários (base)" value={fmtBRL(single.forecast.totalBase)} />
                <Row label="Encargos estimados (28%)" value={fmtBRL(single.forecast.encargosEstimados)} />
                <Row label="Provisão 13° (1/12)" value={fmtBRL(single.forecast.provisao13)} />
                <Row label="Provisão Férias (1/12 + 1/3)" value={fmtBRL(single.forecast.provisaoFerias)} />
                <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                  <span>Custo total projetado</span>
                  <span className="tabular-nums" data-testid="text-forecast-total">{fmtBRL(single.forecast.custoTotalProjetado)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><PieIcon className="h-4 w-4" /> Peso no DRE — {competenceLabel(single.dre.competence)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Folha (bruto)" value={fmtBRL(single.dre.folhaGross)} />
                <Row label="Folha c/ encargos" value={fmtBRL(single.dre.custoTotalFolha)} />
                <Row label="Despesas Control (CP)" value={fmtBRL(single.dre.totalDespesasControl)} />
                <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                  <span>Peso da folha</span>
                  <span className="tabular-nums" data-testid="text-dre-weight">{fmtPct(single.dre.pesoFolhaPct)}</span>
                </div>
                {single.dre.totalDespesasControl === 0 && (
                  <p className="text-xs text-muted-foreground">Sem despesas registradas no Control para esta competência.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alertas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alertas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">13° Salário</h3>
                  <span className="text-xs text-muted-foreground">Provisão mensal: {fmtBRL(single.alerts.decimo.provisaoMensal)}</span>
                </div>
                {single.alerts.decimo.alertas.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-13">Nenhum alerta de 13° agora.</p>
                ) : (
                  <ul className="space-y-1">
                    {single.alerts.decimo.alertas.map((a, i) => (
                      <li key={i} className="flex items-center justify-between text-sm" data-testid={`alert-13-${i}`}>
                        <span>{a.stage}</span>
                        <Badge className={SEVERITY_COLOR[a.severity] || ""}>Vence {a.due}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Férias vencidas ({single.alerts.feriasVencidas.length})</h3>
                {single.alerts.feriasVencidas.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-vacation">Nenhum colaborador com férias vencidas.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Admissão</TableHead>
                        <TableHead>Última férias</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {single.alerts.feriasVencidas.map(f => (
                        <TableRow key={f.employeeId} data-testid={`row-vacation-${f.employeeId}`}>
                          <TableCell className="font-medium">{f.fullName}</TableCell>
                          <TableCell>{f.admissionDate}</TableCell>
                          <TableCell>{f.ultimaFerias ? competenceLabel(f.ultimaFerias) : "—"}</TableCell>
                          <TableCell><Badge className={SEVERITY_COLOR.high}>Vencida</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function sumGross(d: DashboardSingle): number {
  return d.byPosition.reduce((acc, p) => acc + Number(p.totalGross || 0), 0);
}

function Kpi({ label, value, icon, hint, testId }: { label: string; value: string; icon: React.ReactNode; hint?: string; testId: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}{label}</div>
        <div className="text-2xl font-bold tabular-nums" data-testid={testId}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function EvolutionCard({ data }: { data: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Evolução 12 meses</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-empty-evolution">Sem histórico nesta janela.</p>
        ) : (
          <div className="h-72" data-testid="chart-evolution">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmtBRL(v)} tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v: any) => fmtBRL(v)} />
                <Legend />
                <Line type="monotone" dataKey="Bruto" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="Líquido" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="Encargos" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
