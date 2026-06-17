/**
 * Arcádia Suite — Módulo Decor
 * DEC-05 / DEC-EXP-03 — Configurador Técnico de Cortinas (Wave expandido)
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";
import {
  Calculator, AlertCircle, Loader2, Package, MapPin, RotateCcw,
  ChevronDown, ChevronUp, Settings2
} from "lucide-react";

interface ConfigResult {
  sistema: string; largura: number; altura: number; quantidade: number;
  faixa: string; coeficiente: number; metragem_unidade: number; metragem_total: number;
}

interface CatalogoItem {
  id: number; codigo: string; nome: string; categoria: string;
  colecao?: string; unidade: string; valor_unitario: string; status_comercial: string;
}

interface Medicao {
  id: string; ambiente: string; largura_vao: string;
  altura_vao: string; quantidade_vaos: number; observacoes?: string;
}

const SISTEMAS = [
  { value: "wave",                label: "Cortina Wave" },
  { value: "xale",                label: "Cortina Xale / Drapeado" },
  { value: "blackout_tecido",     label: "Blackout em Tecido" },
  { value: "blackout_rolo",       label: "Blackout Rolo" },
  { value: "dupla_wave_blackout", label: "Dupla (Wave + Blackout)" },
  { value: "trilho_simples",      label: "Trilho Simples" },
  { value: "persiana_horizontal", label: "Persiana Horizontal" },
  { value: "persiana_vertical",   label: "Persiana Vertical" },
  { value: "painel_japones",      label: "Painel Japonês" },
];

interface Props {
  onAddItem?: (item: {
    tipoProduto: string; produto: string; sistema: string; tecido?: string; ambiente?: string;
    largura: number; altura: number; quantidade: number; coeficiente: number;
    metragemTecido: number; valorUnitario: number; valorMaoObra: number;
    // Wave / Técnico
    divisaoA?: number; divisaoB?: number; modeloCortina?: string;
    tecidoCodigo?: string; tecidoLado?: string; tecidoForroCodigo?: string;
    tecidoForroLadoA?: string; tecidoForroLadoB?: string;
    barraCodigo?: string; barraObservacao?: string; barraMedida?: string; barraDetalhes?: string;
    altForro?: number; trilhoTipo?: string; trilhoMedida?: number;
    cortineiroTipo?: string; cortineiroFixacao?: string; altPisoTetoFolga?: number;
  }) => void;
  compact?: boolean;
  medicoes?: Medicao[];
}

export function ConfiguradorCortina({ onAddItem, compact = false, medicoes = [] }: Props) {
  // Básicos
  const [ambienteSel, setAmbienteSel] = useState("");
  const [sistema, setSistema] = useState("");
  const [tecidoSel, setTecidoSel] = useState("");
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorMaoObra, setValorMaoObra] = useState("0");
  const [resultado, setResultado] = useState<ConfigResult | null>(null);
  const [calculando, setCalculando] = useState(false);

  // Modo Técnico (Wave expandido)
  const [modoTecnico, setModoTecnico] = useState(false);
  const [divisaoA, setDivisaoA] = useState("");
  const [divisaoB, setDivisaoB] = useState("");
  const [modeloCortina, setModeloCortina] = useState("");
  const [tecidoCodigo, setTecidoCodigo] = useState("");
  const [tecidoLado, setTecidoLado] = useState("padrao");
  const [tecidoForroCodigo, setTecidoForroCodigo] = useState("");
  const [tecidoForroLadoA, setTecidoForroLadoA] = useState("");
  const [tecidoForroLadoB, setTecidoForroLadoB] = useState("");
  const [barraCodigo, setBarraCodigo] = useState("");
  const [barraObservacao, setBarraObservacao] = useState("");
  const [barraMedida, setBarraMedida] = useState("");
  const [barraDetalhes, setBarraDetalhes] = useState("");
  const [altForro, setAltForro] = useState("");
  const [trilhoTipo, setTrilhoTipo] = useState("");
  const [trilhoMedida, setTrilhoMedida] = useState("");
  const [cortineiroTipo, setCortineiroTipo] = useState("");
  const [cortineiroFixacao, setCortineiroFixacao] = useState("");
  const [altPisoTetoFolga, setAltPisoTetoFolga] = useState("");

  const { data: catalogo } = useQuery<CatalogoItem[]>({
    queryKey: ["/api/modules/decor/catalogo", "tecido"],
    queryFn: () => apiRequest("GET", "/api/modules/decor/catalogo?categoria=tecido").then(r => r.json()),
    enabled: !compact,
  });

  const tecidoSelecionado = catalogo?.find(c => c.id.toString() === tecidoSel || c.codigo === tecidoSel);

  const handleSelecionarAmbiente = (medicaoId: string) => {
    const val = medicaoId === "__manual__" ? "" : medicaoId;
    setAmbienteSel(val);
    if (!val) return;
    const m = medicoes.find(m => m.id === val);
    if (m) {
      setLargura(parseFloat(m.largura_vao).toString());
      setAltura(parseFloat(m.altura_vao).toString());
      setQuantidade(m.quantidade_vaos.toString());
    }
  };

  const handleLimpar = () => {
    setAmbienteSel(""); setSistema(""); setTecidoSel(""); setLargura("");
    setAltura(""); setQuantidade("1"); setValorMaoObra("0"); setResultado(null);
    setDivisaoA(""); setDivisaoB(""); setModeloCortina(""); setTecidoCodigo("");
    setTecidoLado("padrao"); setTecidoForroCodigo(""); setTecidoForroLadoA("");
    setTecidoForroLadoB(""); setBarraCodigo(""); setBarraObservacao(""); setBarraMedida("");
    setBarraDetalhes(""); setAltForro(""); setTrilhoTipo(""); setTrilhoMedida("");
    setCortineiroTipo(""); setCortineiroFixacao(""); setAltPisoTetoFolga("");
  };

  useEffect(() => {
    if (!sistema || !largura || !altura) { setResultado(null); return; }
    const l = parseFloat(largura), a = parseFloat(altura);
    if (isNaN(l) || isNaN(a) || l <= 0 || a <= 0) { setResultado(null); return; }
    const timeout = setTimeout(async () => {
      setCalculando(true);
      try {
        const res = await apiRequest("POST", "/api/modules/decor/calcular-cortina", {
          sistema, largura: l, altura: a, quantidade: parseFloat(quantidade) || 1,
        });
        setResultado(await res.json());
      } catch { setResultado(null); }
      finally { setCalculando(false); }
    }, 400);
    return () => clearTimeout(timeout);
  }, [sistema, largura, altura, quantidade]);

  const valorTecidoUn = tecidoSelecionado ? parseFloat(tecidoSelecionado.valor_unitario) : 0;
  const valorTecidoTotal = resultado ? Math.round(resultado.metragem_total * valorTecidoUn * 100) / 100 : 0;
  const maoObraNum = parseFloat(valorMaoObra) || 0;
  const valorTotal = valorTecidoTotal + maoObraNum;
  const ambienteSelecionado = medicoes.find(m => m.id === ambienteSel);

  const handleAdd = () => {
    if (!resultado || !onAddItem) return;
    onAddItem({
      tipoProduto: sistema,
      produto: tecidoSelecionado?.nome ?? SISTEMAS.find(s => s.value === sistema)?.label ?? sistema,
      sistema,
      tecido: tecidoSelecionado?.codigo,
      ambiente: ambienteSelecionado?.ambiente,
      largura: resultado.largura, altura: resultado.altura, quantidade: resultado.quantidade,
      coeficiente: resultado.coeficiente, metragemTecido: resultado.metragem_total,
      valorUnitario: valorTecidoTotal, valorMaoObra: maoObraNum,
      // Wave técnico
      divisaoA: divisaoA ? parseFloat(divisaoA) : undefined,
      divisaoB: divisaoB ? parseFloat(divisaoB) : undefined,
      modeloCortina: modeloCortina || undefined,
      tecidoCodigo: tecidoCodigo || tecidoSelecionado?.codigo,
      tecidoLado: tecidoLado || undefined,
      tecidoForroCodigo: tecidoForroCodigo || undefined,
      tecidoForroLadoA: tecidoForroLadoA || undefined,
      tecidoForroLadoB: tecidoForroLadoB || undefined,
      barraCodigo: barraCodigo || undefined,
      barraObservacao: barraObservacao || undefined,
      barraMedida: barraMedida || undefined,
      barraDetalhes: barraDetalhes || undefined,
      altForro: altForro ? parseFloat(altForro) : undefined,
      trilhoTipo: trilhoTipo || undefined,
      trilhoMedida: trilhoMedida ? parseFloat(trilhoMedida) : undefined,
      cortineiroTipo: cortineiroTipo || undefined,
      cortineiroFixacao: cortineiroFixacao || undefined,
      altPisoTetoFolga: altPisoTetoFolga ? parseFloat(altPisoTetoFolga) : undefined,
    });
  };

  const isWave = sistema.includes("wave") || sistema === "dupla_wave_blackout";

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      {!compact && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="h-4 w-4 text-blue-500" /> Configurador de Cortinas
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleLimpar} className="h-7 px-2 text-xs text-muted-foreground">
              <RotateCcw className="h-3 w-3 mr-1" /> Limpar
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className={compact ? "p-0" : ""}>
        <div className="space-y-3">

          {/* Seletor de ambiente medido */}
          {medicoes.length > 0 && (
            <div>
              <Label className="text-xs font-medium flex items-center gap-1">
                <MapPin className="h-3 w-3 text-green-600" /> Selecionar ambiente medido
              </Label>
              <Select value={ambienteSel || "__manual__"} onValueChange={handleSelecionarAmbiente}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-conf-ambiente">
                  <SelectValue placeholder="Escolha um ambiente para preencher as dimensões..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">Digitar manualmente</SelectItem>
                  {medicoes.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.ambiente} — {parseFloat(m.largura_vao).toFixed(2)}m × {parseFloat(m.altura_vao).toFixed(2)}m
                      {m.quantidade_vaos > 1 && ` (${m.quantidade_vaos} vãos)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ambienteSelecionado && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <strong>{ambienteSelecionado.ambiente}</strong>
                  {ambienteSelecionado.observacoes && <span className="text-muted-foreground"> · {ambienteSelecionado.observacoes}</span>}
                </p>
              )}
            </div>
          )}

          {medicoes.length > 0 && <Separator />}

          {/* Sistema */}
          <div>
            <Label className="text-xs">Sistema / Tipo *</Label>
            <Select value={sistema} onValueChange={setSistema}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-conf-sistema">
                <SelectValue placeholder="Selecione o sistema..." />
              </SelectTrigger>
              <SelectContent>
                {SISTEMAS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Tecido */}
          {!compact && catalogo && catalogo.length > 0 && (
            <div>
              <Label className="text-xs">Tecido (catálogo)</Label>
              <Select value={tecidoSel} onValueChange={setTecidoSel}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-conf-tecido">
                  <SelectValue placeholder="Selecionar do catálogo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum / Digitar manualmente</SelectItem>
                  {catalogo.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()} disabled={c.status_comercial !== "ativo"}>
                      {c.nome} {c.status_comercial !== "ativo" && `(${c.status_comercial})`}
                      {" — "}R$ {parseFloat(c.valor_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/m
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tecidoSelecionado?.status_comercial === "em_falta" && (
                <p className="text-xs text-orange-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Este tecido está em falta — verifique previsão de chegada
                </p>
              )}
            </div>
          )}

          {/* Dimensões */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Largura (m) *</Label>
              <Input type="number" step="0.01" min="0.1" className="h-8 text-sm" value={largura}
                onChange={e => { setLargura(e.target.value); setAmbienteSel(""); }}
                placeholder="ex: 2.50" data-testid="input-conf-largura" />
            </div>
            <div>
              <Label className="text-xs">Altura (m) *</Label>
              <Input type="number" step="0.01" min="0.1" className="h-8 text-sm" value={altura}
                onChange={e => { setAltura(e.target.value); setAmbienteSel(""); }}
                placeholder="ex: 2.70" data-testid="input-conf-altura" />
            </div>
            <div>
              <Label className="text-xs">Qtd (vãos)</Label>
              <Input type="number" step="1" min="1" className="h-8 text-sm" value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                placeholder="1" data-testid="input-conf-qtd" />
            </div>
          </div>

          {/* Resultado do cálculo */}
          {calculando && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
              <Loader2 className="h-3 w-3 animate-spin" /> Calculando...
            </div>
          )}

          {resultado && !calculando && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Resultado do cálculo</span>
                <Badge variant="outline" className="text-xs ml-auto">Coef: {resultado.coeficiente}×</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Metragem por vão</p>
                  <p className="font-semibold">{resultado.metragem_unidade.toFixed(3)} m</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Metragem total ({resultado.quantidade}x)</p>
                  <p className="font-bold text-blue-700 dark:text-blue-300">{resultado.metragem_total.toFixed(3)} m</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valores</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Valor tecido/m (R$)</Label>
                    <Input type="number" step="0.01" min="0" className="h-7 text-sm"
                      value={valorTecidoUn > 0 ? valorTecidoUn : ""}
                      onChange={() => {}}
                      placeholder={tecidoSelecionado ? undefined : "Selecione tecido"}
                      readOnly={!!tecidoSelecionado}
                      data-testid="input-conf-valor-tecido"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mão de obra (R$)</Label>
                    <Input type="number" step="0.01" min="0" className="h-7 text-sm"
                      value={valorMaoObra} onChange={e => setValorMaoObra(e.target.value)}
                      placeholder="0,00" data-testid="input-conf-mao-obra"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm pt-1">
                  {valorTecidoUn > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Tecido total</p>
                      <p className="font-semibold text-blue-700">R$ {valorTecidoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  {maoObraNum > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Mão de obra</p>
                      <p className="font-semibold text-orange-600">R$ {maoObraNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  {(valorTecidoUn > 0 || maoObraNum > 0) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Total item</p>
                      <p className="font-bold text-green-700">R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Faixa: {resultado.faixa.replace("_", " ")} · {resultado.largura}m × {resultado.altura}m</p>
            </div>
          )}

          {/* ═══ MODO TÉCNICO — Campos Wave/Avançado ══════════════════════════ */}
          <Collapsible open={modoTecnico} onOpenChange={setModoTecnico}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full text-xs gap-2 border-dashed"
                data-testid="btn-modo-tecnico">
                <Settings2 className="h-3 w-3 text-purple-500" />
                {modoTecnico ? "Ocultar" : "Exibir"} campos técnicos Wave
                {modoTecnico ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-4 p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-100 dark:border-purple-900">

                {/* Divisão dos painéis */}
                <div>
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Divisão dos Painéis</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Painel A (m)</Label>
                      <Input type="number" step="0.001" className="h-8 text-sm"
                        value={divisaoA} onChange={e => setDivisaoA(e.target.value)}
                        placeholder="ex: 1.15" data-testid="input-wave-divisao-a" />
                    </div>
                    <div>
                      <Label className="text-xs">Painel B (m)</Label>
                      <Input type="number" step="0.001" className="h-8 text-sm"
                        value={divisaoB} onChange={e => setDivisaoB(e.target.value)}
                        placeholder="ex: 1.15" data-testid="input-wave-divisao-b" />
                    </div>
                  </div>
                  {divisaoA && divisaoB && (
                    <p className="text-xs text-blue-600 mt-1">
                      Total = {(parseFloat(divisaoA) + parseFloat(divisaoB)).toFixed(3)}m
                    </p>
                  )}
                </div>

                <Separator />

                {/* Modelo e tecido */}
                <div>
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Modelo e Tecido</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Modelo</Label>
                      <Select value={modeloCortina} onValueChange={setModeloCortina}>
                        <SelectTrigger className="h-8 text-sm" data-testid="select-wave-modelo">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wave_maior">Wave Maior</SelectItem>
                          <SelectItem value="wave_menor">Wave Menor</SelectItem>
                          <SelectItem value="xale">Xale / Drapeado</SelectItem>
                          <SelectItem value="blackout">Blackout</SelectItem>
                          <SelectItem value="duplo">Duplo (Wave + Blackout)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Código do tecido</Label>
                      <Input className="h-8 text-sm" value={tecidoCodigo}
                        onChange={e => setTecidoCodigo(e.target.value)}
                        placeholder="ex: 10009" data-testid="input-wave-tecido-codigo" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-xs">Lado do tecido</Label>
                    <Select value={tecidoLado} onValueChange={setTecidoLado}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="padrao">Padrão</SelectItem>
                        <SelectItem value="avesso">Avesso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Forro */}
                <div>
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Forro</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Código forro</Label>
                      <Input className="h-8 text-sm" value={tecidoForroCodigo}
                        onChange={e => setTecidoForroCodigo(e.target.value)}
                        placeholder="código" data-testid="input-wave-forro-codigo" />
                    </div>
                    <div>
                      <Label className="text-xs">Lado A</Label>
                      <Input className="h-8 text-sm" value={tecidoForroLadoA}
                        onChange={e => setTecidoForroLadoA(e.target.value)}
                        placeholder="A / Padrão" data-testid="input-wave-forro-lado-a" />
                    </div>
                    <div>
                      <Label className="text-xs">Lado B</Label>
                      <Input className="h-8 text-sm" value={tecidoForroLadoB}
                        onChange={e => setTecidoForroLadoB(e.target.value)}
                        placeholder="B / Avesso" data-testid="input-wave-forro-lado-b" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-xs">Altura do forro (m)</Label>
                    <Input type="number" step="0.001" className="h-8 text-sm"
                      value={altForro} onChange={e => setAltForro(e.target.value)}
                      placeholder="ex: 2.50" data-testid="input-wave-alt-forro" />
                  </div>
                </div>

                <Separator />

                {/* Barra */}
                <div>
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Barra</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Código da barra</Label>
                      <Input className="h-8 text-sm" value={barraCodigo}
                        onChange={e => setBarraCodigo(e.target.value)}
                        placeholder="ex: 10009" data-testid="input-wave-barra-codigo" />
                    </div>
                    <div>
                      <Label className="text-xs">Observação</Label>
                      <Select value={barraObservacao} onValueChange={setBarraObservacao}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Tipo..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exata">Exata</SelectItem>
                          <SelectItem value="dobrada">Dobrada</SelectItem>
                          <SelectItem value="arredondada">Arredondada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Label className="text-xs">Medida da barra</Label>
                      <Input className="h-8 text-sm" value={barraMedida}
                        onChange={e => setBarraMedida(e.target.value)}
                        placeholder="ex: 50CM" data-testid="input-wave-barra-medida" />
                    </div>
                    <div>
                      <Label className="text-xs">Detalhes</Label>
                      <Input className="h-8 text-sm" value={barraDetalhes}
                        onChange={e => setBarraDetalhes(e.target.value)}
                        placeholder="ex: LISA" data-testid="input-wave-barra-detalhes" />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Metais e Trilho */}
                <div>
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Metais / Trilho</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Tipo de trilho</Label>
                      <Select value={trilhoTipo} onValueChange={setTrilhoTipo}>
                        <SelectTrigger className="h-8 text-sm" data-testid="select-wave-trilho">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trilho_suisso">Trilho Suíço</SelectItem>
                          <SelectItem value="trilho_wave">Trilho Wave</SelectItem>
                          <SelectItem value="trilho_simples">Trilho Simples</SelectItem>
                          <SelectItem value="varão">Varão</SelectItem>
                          <SelectItem value="semaforo">Semáforo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Medida do trilho (m)</Label>
                      <Input type="number" step="0.001" className="h-8 text-sm"
                        value={trilhoMedida} onChange={e => setTrilhoMedida(e.target.value)}
                        placeholder="ex: 2.250" data-testid="input-wave-trilho-medida" />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Cortineiro */}
                <div>
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Cortineiro / Instalação</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Tipo de cortineiro</Label>
                      <Select value={cortineiroTipo} onValueChange={setCortineiroTipo}>
                        <SelectTrigger className="h-8 text-sm" data-testid="select-wave-cortineiro">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gesso">Gesso</SelectItem>
                          <SelectItem value="madeira">Madeira</SelectItem>
                          <SelectItem value="drywall">Drywall</SelectItem>
                          <SelectItem value="concreto">Concreto</SelectItem>
                          <SelectItem value="sem_cortineiro">Sem cortineiro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Tipo de fixação</Label>
                      <Select value={cortineiroFixacao} onValueChange={setCortineiroFixacao}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proporcional">Proporcional</SelectItem>
                          <SelectItem value="fixo">Fixo</SelectItem>
                          <SelectItem value="expandido">Expandido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-xs">Folga piso-teto (cm)</Label>
                    <Input type="number" step="0.1" className="h-8 text-sm"
                      value={altPisoTetoFolga} onChange={e => setAltPisoTetoFolga(e.target.value)}
                      placeholder="ex: 0.5" data-testid="input-wave-folga" />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {onAddItem && resultado && (
            <Button size="sm" className="w-full" onClick={handleAdd} data-testid="btn-conf-add-item">
              + Adicionar item ao orçamento
              {(divisaoA || modeloCortina || trilhoTipo) && (
                <Badge variant="secondary" className="ml-2 text-xs">Wave</Badge>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
