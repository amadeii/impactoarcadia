/**
 * Arcádia Suite — Módulo Decor
 * DEC-EXP-02 — Configurador Técnico de Persianas
 * Captura todos os campos da ficha de persiana (Pedido 26043)
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Blinds, MapPin, RotateCcw, Plus } from "lucide-react";

interface Medicao {
  id: string;
  ambiente: string;
  largura_vao: string;
  altura_vao: string;
  quantidade_vaos: number;
  observacoes?: string;
}

interface PersianaItem {
  tipoProduto: "persiana";
  ambiente?: string;
  fornecedorPersiana: string;
  colecaoCor: string;
  acabamento: string;
  corPecas: string;
  largura: number;
  altura: number;
  altComando: number;
  ladoALado: string;
  acionamento: string;
  tipoInstalacao: string;
  ladoComando: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

interface Props {
  onAddItem?: (item: PersianaItem) => void;
  compact?: boolean;
  medicoes?: Medicao[];
}

const FOLGA_LARGURA = 0.03;
const FOLGA_ALTURA  = 0.05;

export function ConfiguradorPersiana({ onAddItem, compact = false, medicoes = [] }: Props) {
  const [ambienteSel, setAmbienteSel] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [colecaoCor, setColecaoCor] = useState("");
  const [acabamento, setAcabamento] = useState("nivelador");
  const [corPecas, setCorPecas] = useState("");
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  const [altComando, setAltComando] = useState("1.40");
  const [ladoALado, setLadoALado] = useState("N");
  const [acionamento, setAcionamento] = useState("manual");
  const [tipoInstalacao, setTipoInstalacao] = useState("parede");
  const [ladoComando, setLadoComando] = useState("D");
  const [quantidade, setQuantidade] = useState("1");
  const [valorM2, setValorM2] = useState("");

  const handleSelecionarAmbiente = (medicaoId: string) => {
    setAmbienteSel(medicaoId === "__manual__" ? "" : medicaoId);
    if (!medicaoId || medicaoId === "__manual__") return;
    const m = medicoes.find(m => m.id === medicaoId);
    if (m) {
      setLargura(parseFloat(m.largura_vao).toString());
      setAltura(parseFloat(m.altura_vao).toString());
      setQuantidade(m.quantidade_vaos.toString());
    }
  };

  const handleLimpar = () => {
    setAmbienteSel(""); setFornecedor(""); setColecaoCor(""); setAcabamento("nivelador");
    setCorPecas(""); setLargura(""); setAltura(""); setAltComando("1.40");
    setLadoALado("N"); setAcionamento("manual"); setTipoInstalacao("parede");
    setLadoComando("D"); setQuantidade("1"); setValorM2("");
  };

  const l = parseFloat(largura) || 0;
  const a = parseFloat(altura) || 0;
  const q = parseFloat(quantidade) || 1;
  const vM2 = parseFloat(valorM2) || 0;

  const areaComFolga = (l + FOLGA_LARGURA) * (a + FOLGA_ALTURA);
  const valorUn = vM2 > 0 ? Math.round(areaComFolga * vM2 * 100) / 100 : 0;
  const valorTotal = Math.round(valorUn * q * 100) / 100;

  const canAdd = !!fornecedor && l > 0 && a > 0;
  const ambienteSelecionado = medicoes.find(m => m.id === ambienteSel);

  const handleAdd = () => {
    if (!canAdd || !onAddItem) return;
    onAddItem({
      tipoProduto: "persiana",
      ambiente: ambienteSelecionado?.ambiente,
      fornecedorPersiana: fornecedor,
      colecaoCor, acabamento, corPecas,
      largura: l, altura: a,
      altComando: parseFloat(altComando) || 0,
      ladoALado, acionamento, tipoInstalacao, ladoComando,
      quantidade: q,
      valorUnitario: valorUn,
      valorTotal,
    });
  };

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      {!compact && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Blinds className="h-4 w-4 text-purple-500" /> Configurador de Persianas
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleLimpar} className="h-7 px-2 text-xs text-muted-foreground">
              <RotateCcw className="h-3 w-3 mr-1" /> Limpar
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className={compact ? "p-0" : ""}>
        <div className="space-y-3">

          {/* Ambiente */}
          {medicoes.length > 0 && (
            <div>
              <Label className="text-xs font-medium flex items-center gap-1">
                <MapPin className="h-3 w-3 text-green-600" /> Ambiente medido
              </Label>
              <Select value={ambienteSel || "__manual__"} onValueChange={handleSelecionarAmbiente}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-pers-ambiente">
                  <SelectValue placeholder="Selecionar ambiente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">Digitar manualmente</SelectItem>
                  {medicoes.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.ambiente} — {parseFloat(m.largura_vao).toFixed(2)}m × {parseFloat(m.altura_vao).toFixed(2)}m
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ambienteSelecionado && (
                <p className="text-xs text-green-600 mt-1">📍 {ambienteSelecionado.ambiente}</p>
              )}
            </div>
          )}

          <Separator />

          {/* Fornecedor e produto */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fornecedor *</Label>
              <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)}
                placeholder="Ex: ROLLO, Hunter Douglas" className="h-8 text-sm"
                data-testid="input-pers-fornecedor" />
            </div>
            <div>
              <Label className="text-xs">Coleção / Cor</Label>
              <Input value={colecaoCor} onChange={e => setColecaoCor(e.target.value)}
                placeholder="Ex: SCREEN 05 WHITE" className="h-8 text-sm"
                data-testid="input-pers-colecao" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Acabamento</Label>
              <Select value={acabamento} onValueChange={setAcabamento}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-pers-acabamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nivelador">Nivelador</SelectItem>
                  <SelectItem value="peso">Peso</SelectItem>
                  <SelectItem value="cordao">Cordão</SelectItem>
                  <SelectItem value="sem_acabamento">Sem acabamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cor das Peças</Label>
              <Input value={corPecas} onChange={e => setCorPecas(e.target.value)}
                placeholder="Ex: BRANCAS" className="h-8 text-sm"
                data-testid="input-pers-cor-pecas" />
            </div>
          </div>

          <Separator />

          {/* Dimensões */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Largura (m) *</Label>
              <Input type="number" step="0.001" min="0.1" className="h-8 text-sm"
                value={largura} onChange={e => { setLargura(e.target.value); setAmbienteSel(""); }}
                placeholder="1.635" data-testid="input-pers-largura" />
            </div>
            <div>
              <Label className="text-xs">Altura (m) *</Label>
              <Input type="number" step="0.001" min="0.1" className="h-8 text-sm"
                value={altura} onChange={e => { setAltura(e.target.value); setAmbienteSel(""); }}
                placeholder="1.500" data-testid="input-pers-altura" />
            </div>
            <div>
              <Label className="text-xs">Qtd</Label>
              <Input type="number" step="1" min="1" className="h-8 text-sm"
                value={quantidade} onChange={e => setQuantidade(e.target.value)}
                placeholder="1" data-testid="input-pers-qtd" />
            </div>
          </div>

          {/* Detalhes técnicos */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Altura do Comando (m)</Label>
              <Input type="number" step="0.01" className="h-8 text-sm"
                value={altComando} onChange={e => setAltComando(e.target.value)}
                placeholder="1.40" data-testid="input-pers-alt-comando" />
            </div>
            <div>
              <Label className="text-xs">Acionamento</Label>
              <Select value={acionamento} onValueChange={setAcionamento}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="motorizado">Motorizado</SelectItem>
                  <SelectItem value="zigbee">Zigbee / WiFi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Tipo Instalação</Label>
              <Select value={tipoInstalacao} onValueChange={setTipoInstalacao}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parede">Parede</SelectItem>
                  <SelectItem value="teto">Teto</SelectItem>
                  <SelectItem value="gesso">Gesso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Lado Comando</Label>
              <Select value={ladoComando} onValueChange={setLadoComando}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="D">Direito</SelectItem>
                  <SelectItem value="E">Esquerdo</SelectItem>
                  <SelectItem value="C">Centro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Lado a Lado</Label>
              <Select value={ladoALado} onValueChange={setLadoALado}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="N">Não</SelectItem>
                  <SelectItem value="S">Sim</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Preço */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Valor por m² (R$)</Label>
              <Input type="number" step="0.01" min="0" className="h-8 text-sm"
                value={valorM2} onChange={e => setValorM2(e.target.value)}
                placeholder="180,00" data-testid="input-pers-valor-m2" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Área com folga</Label>
              {l > 0 && a > 0 && (
                <div className="h-8 flex items-center text-sm font-medium text-blue-600">
                  {areaComFolga.toFixed(4)} m²
                  <Badge variant="outline" className="ml-2 text-xs">+3cm/+5cm</Badge>
                </div>
              )}
            </div>
          </div>

          {/* Resultado */}
          {l > 0 && a > 0 && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg space-y-2">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Valor unitário</p>
                  <p className="font-semibold text-purple-700">
                    {valorUn > 0 ? `R$ ${valorUn.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Qtd</p>
                  <p className="font-semibold">{q}×</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-bold text-green-700">
                    {valorTotal > 0 ? `R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {fornecedor && <span>{fornecedor} · </span>}
                {colecaoCor && <span>{colecaoCor} · </span>}
                {tipoInstalacao} · Lado {ladoComando} · {acionamento}
              </p>
            </div>
          )}

          {onAddItem && canAdd && (
            <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleAdd} data-testid="btn-pers-add-item">
              <Plus className="h-4 w-4 mr-1" /> Adicionar persiana ao orçamento
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
