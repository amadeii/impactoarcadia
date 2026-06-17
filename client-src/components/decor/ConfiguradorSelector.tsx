/**
 * DEC-EXP-07 — ConfiguradorSelector.tsx
 * Seletor unificado: 🧵 Cortina · 🪟 Persiana · 📦 Outros
 */
import { useState } from "react";
import { ConfiguradorCortina } from "@/components/decor/ConfiguradorCortina";
import { ConfiguradorPersiana } from "@/components/decor/ConfiguradorPersiana";
import { ConfiguradorOutros }   from "@/components/decor/ConfiguradorOutros";

interface Medicao {
  id: string; ambiente: string; largura_vao: string; altura_vao: string; quantidade_vaos: number;
}

export interface AddItemPayload {
  tipoProduto: string; produto: string; sistema?: string; tecido?: string;
  ambiente?: string; largura: number; altura: number; comprimento?: number;
  quantidade: number; coeficiente?: number; metragemTecido?: number;
  valorUnitario: number; valorMaoObra: number;
  // Persiana
  fornecedorPersiana?: string; colecaoCor?: string; acabamento?: string;
  corPecas?: string; altComando?: number; ladoALado?: string;
  acionamento?: string; tipoInstalacao?: string; ladoComando?: string;
  // Wave
  divisaoA?: number; divisaoB?: number; modeloCortina?: string;
  tecidoCodigo?: string; tecidoLado?: string; tecidoForroCodigo?: string;
  tecidoForroLadoA?: string; tecidoForroLadoB?: string;
  barraCodigo?: string; barraObservacao?: string; barraMedida?: string; barraDetalhes?: string;
  altForro?: number; trilhoTipo?: string; trilhoMedida?: number;
  cortineiroTipo?: string; cortineiroFixacao?: string; altPisoTetoFolga?: number;
  // Outros
  referenciaProduto?: string; formatoTapete?: string; observacaoTecnica?: string;
}

interface Props {
  medicoes?: Medicao[];
  onAddItem?: (item: AddItemPayload) => void;
}

const OPCOES = [
  { id: "cortina"  as const, label: "Cortina",  icon: "🧵", desc: "Wave, Xale, Blackout, Trilho"         },
  { id: "persiana" as const, label: "Persiana",  icon: "🪟", desc: "Rolo, Horizontal, Vertical, Screen"   },
  { id: "outros"   as const, label: "Outros",    icon: "📦", desc: "Tapete, Papel de parede, Double vision" },
] as const;

type TipoConf = typeof OPCOES[number]["id"];

const COLOR_MAP: Record<TipoConf, { active: string; hover: string }> = {
  cortina:  { active: "bg-blue-600 text-white border-blue-600",      hover: "hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30" },
  persiana: { active: "bg-amber-500 text-white border-amber-500",    hover: "hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30" },
  outros:   { active: "bg-emerald-600 text-white border-emerald-600", hover: "hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" },
};

export function ConfiguradorSelector({ medicoes = [], onAddItem }: Props) {
  const [tipo, setTipo] = useState<TipoConf>("cortina");

  return (
    <div className="space-y-4">
      {/* Seletor */}
      <div className="grid grid-cols-3 gap-2">
        {OPCOES.map(op => {
          const isActive = tipo === op.id;
          const c = COLOR_MAP[op.id];
          return (
            <button key={op.id} onClick={() => setTipo(op.id)}
              data-testid={`btn-conf-tipo-${op.id}`}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                isActive ? c.active : `bg-white text-gray-700 border-gray-200 ${c.hover} dark:bg-gray-900 dark:text-gray-200`
              }`}>
              <div className="text-xl mb-1">{op.icon}</div>
              <div className="font-semibold text-sm">{op.label}</div>
              <div className={`text-xs mt-0.5 ${isActive ? "text-white/80" : "text-muted-foreground"}`}>{op.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Configurador ativo */}
      {tipo === "cortina" && (
        <ConfiguradorCortina
          medicoes={medicoes}
          onAddItem={onAddItem ? (item) => onAddItem({
            tipoProduto: item.tipoProduto, produto: item.produto, sistema: item.sistema,
            tecido: item.tecido, ambiente: item.ambiente,
            largura: item.largura, altura: item.altura, quantidade: item.quantidade,
            coeficiente: item.coeficiente, metragemTecido: item.metragemTecido,
            valorUnitario: item.valorUnitario, valorMaoObra: item.valorMaoObra,
            // Wave
            divisaoA: item.divisaoA, divisaoB: item.divisaoB, modeloCortina: item.modeloCortina,
            tecidoCodigo: item.tecidoCodigo, tecidoLado: item.tecidoLado,
            tecidoForroCodigo: item.tecidoForroCodigo, tecidoForroLadoA: item.tecidoForroLadoA,
            tecidoForroLadoB: item.tecidoForroLadoB, barraCodigo: item.barraCodigo,
            barraObservacao: item.barraObservacao, barraMedida: item.barraMedida,
            barraDetalhes: item.barraDetalhes, altForro: item.altForro,
            trilhoTipo: item.trilhoTipo, trilhoMedida: item.trilhoMedida,
            cortineiroTipo: item.cortineiroTipo, cortineiroFixacao: item.cortineiroFixacao,
            altPisoTetoFolga: item.altPisoTetoFolga,
          }) : undefined}
        />
      )}

      {tipo === "persiana" && (
        <ConfiguradorPersiana
          medicoes={medicoes}
          onAddItem={onAddItem ? (item) => onAddItem({
            tipoProduto: item.tipoProduto ?? "persiana",
            produto: item.produto, ambiente: item.ambiente,
            largura: item.largura, altura: item.altura,
            quantidade: item.quantidade ?? 1, coeficiente: 1,
            metragemTecido: item.area,
            valorUnitario: item.valorUnitario, valorMaoObra: item.valorMaoObra ?? 0,
            fornecedorPersiana: item.fornecedorPersiana, colecaoCor: item.colecaoCor,
            acabamento: item.acabamento, corPecas: item.corPecas, altComando: item.altComando,
            ladoALado: item.ladoALado, acionamento: item.acionamento,
            tipoInstalacao: item.tipoInstalacao, ladoComando: item.ladoComando,
          }) : undefined}
        />
      )}

      {tipo === "outros" && (
        <ConfiguradorOutros
          medicoes={medicoes}
          onAddItem={onAddItem ? (item) => onAddItem({
            tipoProduto: item.tipoProduto, produto: item.produto, ambiente: item.ambiente,
            largura: item.largura, altura: item.altura, comprimento: item.comprimento,
            quantidade: item.quantidade, coeficiente: item.coeficiente ?? 1,
            metragemTecido: item.metragemTecido,
            valorUnitario: item.valorUnitario, valorMaoObra: item.valorMaoObra,
            sistema: item.sistema,
            referenciaProduto: item.referenciaProduto,
            formatoTapete: item.formatoTapete, observacaoTecnica: item.observacaoTecnica,
          }) : undefined}
        />
      )}
    </div>
  );
}
