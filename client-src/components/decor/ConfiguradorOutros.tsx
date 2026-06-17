/**
 * DEC-EXP-07 — ConfiguradorOutros.tsx
 * Configurador para produtos além de cortinas e persianas:
 *   tapete, papel_de_parede, double_vision, mosquiteiro, item_avulso
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calculator, MapPin, RotateCcw, Package } from "lucide-react";

const TIPOS_PRODUTO = [
  { value: "tapete",          label: "Tapete",                  icon: "🟫", unidade: "m²" },
  { value: "papel_de_parede", label: "Papel de Parede",         icon: "📄", unidade: "rolos" },
  { value: "double_vision",   label: "Double Vision",           icon: "🪟", unidade: "m²" },
  { value: "mosquiteiro",     label: "Mosquiteiro",             icon: "🕸️", unidade: "m²" },
  { value: "item_avulso",     label: "Item Avulso / Outro",     icon: "📦", unidade: "un" },
] as const;

type TipoProduto = typeof TIPOS_PRODUTO[number]["value"];

const FORMATOS_TAPETE = ["Retangular", "Redondo", "Oval", "Quadrado", "Corredor", "Personalizado"];
const MATERIAIS_TAPETE = [
  "Polipropileno", "Viscose", "Lã Natural", "Juta", "Sisal",
  "Couro Ecológico", "Pelo Alto", "Fio Cortado", "Loop",
];

interface Medicao {
  id: string; ambiente: string; largura_vao: string; altura_vao: string; quantidade_vaos: number;
}

interface AddItemPayload {
  tipoProduto: string; produto: string; ambiente?: string;
  largura: number; altura: number; comprimento?: number; quantidade: number;
  valorUnitario: number; valorMaoObra: number; metragemTecido?: number; coeficiente?: number;
  sistema?: string; referenciaProduto?: string; formatoTapete?: string; observacaoTecnica?: string;
}

interface Props {
  medicoes?: Medicao[];
  onAddItem?: (item: AddItemPayload) => void;
  compact?: boolean;
}

function calcularTapete(l: number, c: number) {
  const area = Math.round(l * c * 100) / 100;
  return { area, descricao: `${l.toFixed(2)}m × ${c.toFixed(2)}m = ${area.toFixed(2)} m²` };
}

function calcularPapelDeParede(l: number, h: number, lr: number, cr: number, perda: number) {
  const areaTotal = l * h;
  const areaUtil  = lr * cr * (1 - perda / 100);
  const qtdRolos  = Math.ceil(areaTotal / areaUtil);
  return {
    qtdRolos,
    areaTotal: Math.round(areaTotal * 100) / 100,
    areaUtil:  Math.round(areaUtil  * 100) / 100,
    descricao: `Parede ${l}m × ${h}m = ${areaTotal.toFixed(2)} m² · Rolo: ${areaUtil.toFixed(2)} m² útil → ${qtdRolos} rolos`,
  };
}

function calcularM2(l: number, a: number) {
  return Math.round((l + 0.03) * (a + 0.05) * 1000) / 1000;
}

export function ConfiguradorOutros({ medicoes = [], onAddItem, compact = false }: Props) {
  const [tipo, setTipo]               = useState<TipoProduto>("tapete");
  const [ambienteSel, setAmbienteSel] = useState("");
  const [nome, setNome]               = useState("");
  const [referencia, setReferencia]   = useState("");
  const [largura, setLargura]         = useState("");
  const [altura, setAltura]           = useState("");
  const [comprimento, setComprimento] = useState("");
  const [quantidade, setQuantidade]   = useState("1");
  const [formato, setFormato]         = useState("Retangular");
  const [material, setMaterial]       = useState("");
  const [valorUnit, setValorUnit]     = useState("");
  const [valorMaoObra, setValorMaoObra] = useState("");
  const [observacao, setObservacao]   = useState("");
  const [larguraRolo, setLarguraRolo]       = useState("0.53");
  const [comprimentoRolo, setComprimentoRolo] = useState("10");
  const [perdaPerc, setPerdaPerc]     = useState("10");

  const tipoConfig = TIPOS_PRODUTO.find(t => t.value === tipo)!;

  const handleSelecionarAmbiente = (id: string) => {
    setAmbienteSel(id);
    if (id === "__manual__") return;
    const m = medicoes.find(m => m.id === id);
    if (m) {
      setLargura(parseFloat(m.largura_vao).toFixed(3));
      setAltura(parseFloat(m.altura_vao).toFixed(3));
    }
  };

  const ambiente = ambienteSel && ambienteSel !== "__manual__"
    ? medicoes.find(m => m.id === ambienteSel)?.ambiente ?? ""
    : "";

  const larg  = parseFloat(largura) || 0;
  const alt   = parseFloat(altura)  || 0;
  const comp  = parseFloat(comprimento) || 0;
  const qtd   = parseFloat(quantidade) || 1;
  const vUnit = parseFloat(valorUnit) || 0;
  const vMO   = parseFloat(valorMaoObra) || 0;

  let calculo: { label: string; valor: string } | null = null;
  let metragem = 0;

  if (tipo === "tapete" && larg > 0 && comp > 0) {
    const { area, descricao } = calcularTapete(larg, comp);
    metragem = area * qtd;
    calculo  = { label: "Área", valor: descricao };
  } else if (tipo === "papel_de_parede" && larg > 0 && alt > 0) {
    const res = calcularPapelDeParede(larg, alt, parseFloat(larguraRolo), parseFloat(comprimentoRolo), parseFloat(perdaPerc));
    metragem  = res.areaTotal;
    calculo   = { label: "Cálculo", valor: res.descricao };
  } else if (["double_vision", "mosquiteiro"].includes(tipo) && larg > 0 && alt > 0) {
    metragem = calcularM2(larg, alt) * qtd;
    calculo  = { label: "Área total", valor: `${metragem.toFixed(3)} m²` };
  }

  const valorTotal = (vUnit * qtd) + vMO;

  const handleLimpar = () => {
    setNome(""); setReferencia(""); setLargura(""); setAltura(""); setComprimento("");
    setQuantidade("1"); setFormato("Retangular"); setMaterial(""); setValorUnit(""); setValorMaoObra(""); setObservacao(""); setAmbienteSel("");
  };

  const handleAdd = () => {
    if (!onAddItem) return;
    onAddItem({
      tipoProduto: tipo, produto: nome || tipoConfig.label, ambiente: ambiente || undefined,
      largura: larg, altura: alt, comprimento: comp > 0 ? comp : undefined, quantidade: qtd,
      coeficiente: 1, metragemTecido: metragem > 0 ? metragem : undefined,
      valorUnitario: vUnit, valorMaoObra: vMO, sistema: tipo,
      referenciaProduto: referencia || undefined,
      formatoTapete: tipo === "tapete" ? formato : undefined,
      observacaoTecnica: observacao || undefined,
    });
    handleLimpar();
  };

  const podeAdicionar = !!onAddItem && (
    (tipo === "item_avulso"     && nome.length > 0 && vUnit > 0) ||
    (tipo === "tapete"          && larg > 0 && comp > 0 && vUnit > 0) ||
    (tipo === "papel_de_parede" && larg > 0 && alt > 0 && vUnit > 0) ||
    (["double_vision", "mosquiteiro"].includes(tipo) && larg > 0 && alt > 0 && vUnit > 0)
  );

  return (
    <Card>
      {!compact && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" /> Outros Produtos
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleLimpar} className="h-7 px-2 text-xs text-muted-foreground">
              <RotateCcw className="h-3 w-3 mr-1" /> Limpar
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className={compact ? "p-0" : ""}>
        <div className="space-y-3">

          {/* Tipo */}
          <div>
            <Label className="text-xs font-medium">Tipo de produto *</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {TIPOS_PRODUTO.map(t => (
                <button key={t.value} onClick={() => { setTipo(t.value); handleLimpar(); }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    tipo === t.value
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-muted-foreground border-gray-200 hover:border-emerald-400 dark:bg-gray-900 dark:text-gray-200"
                  }`}
                  data-testid={`btn-tipo-${t.value}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ambiente */}
          {medicoes.length > 0 && (
            <div>
              <Label className="text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3 text-green-600" /> Selecionar ambiente
              </Label>
              <Select value={ambienteSel || "__manual__"} onValueChange={handleSelecionarAmbiente}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Digitar manualmente..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">Digitar manualmente</SelectItem>
                  {medicoes.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.ambiente} — {parseFloat(m.largura_vao).toFixed(2)} × {parseFloat(m.altura_vao).toFixed(2)} m
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Nome e referência */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{tipo === "item_avulso" ? "Descrição *" : "Nome / Modelo"}</Label>
              <Input className="h-8 text-sm" value={nome} onChange={e => setNome(e.target.value)}
                placeholder={
                  tipo === "tapete"          ? "Ex: Tapete Bali 140×200" :
                  tipo === "papel_de_parede" ? "Ex: Texturizado Cinza"   :
                  tipo === "item_avulso"     ? "Descrição do produto *"  : tipoConfig.label
                }
                data-testid="input-outros-nome" />
            </div>
            <div>
              <Label className="text-xs">Referência / Código</Label>
              <Input className="h-8 text-sm" value={referencia} onChange={e => setReferencia(e.target.value)}
                placeholder="SKU, código..." data-testid="input-outros-ref" />
            </div>
          </div>

          {/* Formato e material tapete */}
          {tipo === "tapete" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Formato</Label>
                <Select value={formato} onValueChange={setFormato}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMATOS_TAPETE.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Material</Label>
                <Select value={material} onValueChange={setMaterial}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{MATERIAIS_TAPETE.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Dimensões */}
          {tipo !== "item_avulso" && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Largura (m) *</Label>
                <Input type="number" step="0.01" min="0.1" className="h-8 text-sm"
                  value={largura} onChange={e => { setLargura(e.target.value); setAmbienteSel(""); }}
                  placeholder="2.00" data-testid="input-outros-largura" />
              </div>
              {tipo === "tapete" ? (
                <div>
                  <Label className="text-xs">Comprimento (m) *</Label>
                  <Input type="number" step="0.01" min="0.1" className="h-8 text-sm"
                    value={comprimento} onChange={e => setComprimento(e.target.value)}
                    placeholder="3.00" data-testid="input-outros-comprimento" />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Altura (m) *</Label>
                  <Input type="number" step="0.01" min="0.1" className="h-8 text-sm"
                    value={altura} onChange={e => { setAltura(e.target.value); setAmbienteSel(""); }}
                    placeholder="2.70" data-testid="input-outros-altura" />
                </div>
              )}
              <div>
                <Label className="text-xs">Qtd</Label>
                <Input type="number" step="1" min="1" className="h-8 text-sm"
                  value={quantidade} onChange={e => setQuantidade(e.target.value)}
                  data-testid="input-outros-qtd" />
              </div>
            </div>
          )}

          {/* Parâmetros papel de parede */}
          {tipo === "papel_de_parede" && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-2">
              <p className="text-xs font-medium text-blue-700">Parâmetros do rolo</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Largura rolo (m)</Label>
                  <Input type="number" step="0.01" className="h-7 text-sm"
                    value={larguraRolo} onChange={e => setLarguraRolo(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Compr. rolo (m)</Label>
                  <Input type="number" step="0.1" className="h-7 text-sm"
                    value={comprimentoRolo} onChange={e => setComprimentoRolo(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Perda / Emenda (%)</Label>
                  <Input type="number" step="1" min="0" max="30" className="h-7 text-sm"
                    value={perdaPerc} onChange={e => setPerdaPerc(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Valores */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">
                Valor {tipoConfig.unidade === "rolos" ? "por rolo (R$)" : tipoConfig.unidade === "un" ? "unitário (R$)" : "por m² (R$)"}
              </Label>
              <Input type="number" step="0.01" min="0" className="h-8 text-sm"
                value={valorUnit} onChange={e => setValorUnit(e.target.value)}
                placeholder="0,00" data-testid="input-outros-valor-unit" />
            </div>
            <div>
              <Label className="text-xs">Mão de obra (R$)</Label>
              <Input type="number" step="0.01" min="0" className="h-8 text-sm"
                value={valorMaoObra} onChange={e => setValorMaoObra(e.target.value)}
                placeholder="0,00" data-testid="input-outros-mao-obra" />
            </div>
          </div>

          {/* Item avulso — só quantidade */}
          {tipo === "item_avulso" && (
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" step="1" min="1" className="h-8 text-sm"
                value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
          )}

          {/* Resultado */}
          {calculo && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{calculo.label}</span>
                {tipo === "papel_de_parede" && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    {Math.ceil((larg * alt) / (parseFloat(larguraRolo) * parseFloat(comprimentoRolo) * (1 - parseFloat(perdaPerc) / 100)))} rolos
                  </Badge>
                )}
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">{calculo.valor}</p>
              {(vUnit > 0 || vMO > 0) && (
                <div className="pt-2 border-t border-emerald-200 grid grid-cols-3 gap-2 text-sm">
                  {vUnit > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Produto</p>
                      <p className="font-semibold text-emerald-700">R$ {(vUnit * qtd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  {vMO > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Mão de obra</p>
                      <p className="font-semibold text-orange-600">R$ {vMO.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-bold text-green-700">R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Item avulso — subtotal simples */}
          {tipo === "item_avulso" && vUnit > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{qtd}× R$ {vUnit.toFixed(2)}</span>
              <span className="font-bold text-green-700">R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Observação */}
          <div>
            <Label className="text-xs">Observação técnica</Label>
            <Textarea rows={2} className="text-sm resize-none" value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder={
                tipo === "tapete"          ? "Instalação, colagem, limpeza..." :
                tipo === "papel_de_parede" ? "Tipo de parede, cola, preparo..."   :
                "Observações para produção/instalação..."
              }
              data-testid="input-outros-obs" />
          </div>

          {onAddItem && (
            <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleAdd} disabled={!podeAdicionar}
              data-testid="btn-outros-add">
              + Adicionar {tipoConfig.label} ao orçamento
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
