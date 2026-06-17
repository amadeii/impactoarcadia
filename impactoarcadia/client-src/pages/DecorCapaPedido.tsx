/**
 * Arcádia Suite — Módulo Decor
 * DEC-EXP-04 — Capa Visual do Pedido (layout Cortiart)
 * Renderiza a capa completa para impressão / geração de PDF
 */
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const CGV_FALLBACK = [
  "1. O prazo de entrega padrão é de 30 dias corridos, contados a partir da data de efetivação do pedido e confirmação do pagamento de entrada.",
  "2. Atrasos ocasionados por obras no local de instalação prorrogarão automaticamente o prazo de entrega em +30 dias.",
  "3. A produção somente será iniciada após o pagamento de 50% do valor total. O saldo restante deverá ser pago no ato da instalação.",
  "4. No dia da instalação, o ambiente deverá estar limpo, com iluminação e energia disponíveis. Caso contrário, uma nova visita será agendada com custo adicional.",
  "5. Toda instalação hidráulica, elétrica ou de alvenaria necessária é de responsabilidade do cliente.",
  "6. Acordos verbais não têm validade. Todas as alterações devem ser registradas por escrito no sistema.",
  "7. Assistência técnica: agendamento em até 7 dias úteis; peças com prazo de até 30 dias.",
  "8. O cliente deve conferir todos os produtos no ato da instalação. Danos ou avarias comunicados após a conclusão da OS não serão acatados.",
  "9. Encolhimento de até 3% após lavagem é característica inerente dos tecidos naturais, não constituindo defeito de fabricação.",
];

interface Pedido {
  id: string;
  numero_pedido: string;
  status: string;
  cliente_nome?: string;
  cliente_cpf?: string;
  cliente_fone?: string;
  cliente_email?: string;
  endereco_obra?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  torre?: string;
  apartamento?: string;
  data_aniversario?: string;
  vendedor_nome?: string;
  data_instalacao?: string;
  horario_instalacao?: string;
  valor_final?: string | number;
  valor_entrada?: string | number;
  num_parcelas?: number;
  tipo_pagamento_codigo?: string;
  observacoes?: string;
  created_at?: string;
}

interface Item {
  id: string;
  ambiente?: string;
  produto?: string;
  sistema?: string;
  tipo_produto?: string;
  largura?: string | number;
  altura?: string | number;
  quantidade?: string | number;
  valor_total?: string | number;
  valor_mao_obra?: string | number;
  metragem_tecido?: string | number;
}

interface Props {
  pedido: Pedido;
  itens?: Item[];
  onClose?: () => void;
}

function fmt(v?: string | number | null): string {
  if (v === undefined || v === null || v === "") return "—";
  return String(v);
}

function fmtMoeda(v?: string | number | null): string {
  if (v === undefined || v === null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function fmtData(v?: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("pt-BR");
  } catch { return v; }
}

function pgmLabel(codigo?: string): string {
  const map: Record<string, string> = {
    "01": "Dinheiro", "02": "Cheque", "03": "Cartão de Crédito",
    "04": "Cartão de Débito", "17": "PIX", "99": "Outros",
  };
  return codigo ? (map[codigo] ?? `Código ${codigo}`) : "—";
}

export function DecorCapaPedido({ pedido, itens = [], onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: cgvDB } = useQuery<any[]>({
    queryKey: ["/api/modules/decor/condicoes-venda"],
    queryFn: () => apiRequest("GET", "/api/modules/decor/condicoes-venda").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  const cgv: string[] = cgvDB && cgvDB.length > 0
    ? cgvDB.map((c, i) => `${i + 1}. ${c.texto}`)
    : CGV_FALLBACK;

  const handlePrint = () => window.print();

  // Agrupa itens por ambiente
  const porAmbiente: Record<string, Item[]> = {};
  for (const item of itens) {
    const amb = item.ambiente ?? "Sem ambiente";
    if (!porAmbiente[amb]) porAmbiente[amb] = [];
    porAmbiente[amb].push(item);
  }

  const totalPedido = itens.reduce((s, i) => {
    const vt = typeof i.valor_total === "string" ? parseFloat(i.valor_total) : (i.valor_total ?? 0);
    const vm = typeof i.valor_mao_obra === "string" ? parseFloat(i.valor_mao_obra) : (i.valor_mao_obra ?? 0);
    return s + (isNaN(vt) ? 0 : vt) + (isNaN(vm) ? 0 : vm);
  }, 0);

  const valorFinal = pedido.valor_final
    ? (typeof pedido.valor_final === "string" ? parseFloat(pedido.valor_final) : pedido.valor_final)
    : totalPedido;

  const valorEntrada = pedido.valor_entrada
    ? (typeof pedido.valor_entrada === "string" ? parseFloat(pedido.valor_entrada) : pedido.valor_entrada)
    : valorFinal * 0.5;

  return (
    <div className="bg-white text-black min-h-screen font-sans">
      {/* Toolbar (não impresso) */}
      <div className="print:hidden flex items-center gap-2 p-3 bg-gray-100 border-b sticky top-0 z-10">
        <Button size="sm" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
        </Button>
        <Badge variant="outline" className="text-xs">Pedido {pedido.numero_pedido}</Badge>
        {onClose && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onClose}>Fechar</Button>
        )}
      </div>

      {/* Documento A4 */}
      <div ref={printRef} className="max-w-[794px] mx-auto p-8 space-y-6 print:p-6 print:space-y-4">

        {/* Cabeçalho */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight uppercase">Cortiart</h1>
            <p className="text-xs text-gray-500">Cortinas, Persianas & Decoração</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Pedido nº</p>
            <p className="text-2xl font-bold">{pedido.numero_pedido}</p>
            <p className="text-xs text-gray-500">Data: {fmtData(pedido.created_at)}</p>
            <Badge className={`mt-1 text-xs ${pedido.status === "concluido" ? "bg-green-500" : "bg-orange-500"}`}>
              {pedido.status?.toUpperCase()}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Dados do cliente */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Cliente</p>
            <p className="font-semibold text-base">{fmt(pedido.cliente_nome)}</p>
            {pedido.cliente_cpf && <p className="text-xs text-gray-500">CPF/RG: {pedido.cliente_cpf}</p>}
            {pedido.data_aniversario && (
              <p className="text-xs text-gray-500">Aniversário: {fmtData(pedido.data_aniversario)}</p>
            )}
            {pedido.cliente_fone && <p className="text-xs text-gray-500">Tel: {pedido.cliente_fone}</p>}
            {pedido.cliente_email && <p className="text-xs text-gray-500">Email: {pedido.cliente_email}</p>}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Endereço de Instalação</p>
            <p className="text-sm">{fmt(pedido.endereco_obra)}</p>
            {(pedido.complemento || pedido.torre || pedido.apartamento) && (
              <p className="text-xs text-gray-600">
                {pedido.complemento && `${pedido.complemento} `}
                {pedido.torre && `Torre ${pedido.torre} `}
                {pedido.apartamento && `AP ${pedido.apartamento}`}
              </p>
            )}
            {pedido.bairro && (
              <p className="text-xs text-gray-600">
                {pedido.bairro} — {pedido.cidade}/{pedido.uf}
              </p>
            )}
          </div>
        </div>

        {/* Dados do pedido */}
        <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase">Vendedor</p>
            <p className="font-medium">{fmt(pedido.vendedor_nome)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Data Instalação</p>
            <p className="font-medium">{fmtData(pedido.data_instalacao)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Horário</p>
            <p className="font-medium">{fmt(pedido.horario_instalacao) || "A COMBINAR"}</p>
          </div>
        </div>

        {/* Resumo dos itens por ambiente */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
            Resumo por Ambiente
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 font-semibold text-xs uppercase border border-gray-200">Ambiente</th>
                <th className="p-2 font-semibold text-xs uppercase border border-gray-200">Produto / Sistema</th>
                <th className="p-2 font-semibold text-xs uppercase border border-gray-200 text-right">Dimensões</th>
                <th className="p-2 font-semibold text-xs uppercase border border-gray-200 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-gray-400 text-xs border border-gray-200">
                    Nenhum item configurado
                  </td>
                </tr>
              ) : itens.map((item, idx) => {
                const vt = parseFloat(String(item.valor_total ?? 0));
                const vm = parseFloat(String(item.valor_mao_obra ?? 0));
                const total = (isNaN(vt) ? 0 : vt) + (isNaN(vm) ? 0 : vm);
                const sistema = item.sistema ?? item.tipo_produto ?? item.produto ?? "—";
                return (
                  <tr key={item.id ?? idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-2 border border-gray-200">{item.ambiente ?? "—"}</td>
                    <td className="p-2 border border-gray-200">{item.produto ?? sistema}</td>
                    <td className="p-2 border border-gray-200 text-right text-xs text-gray-500">
                      {item.largura && item.altura
                        ? `${parseFloat(String(item.largura)).toFixed(2)}×${parseFloat(String(item.altura)).toFixed(2)}m`
                        : "—"}
                      {item.quantidade && Number(item.quantidade) > 1
                        ? ` (${item.quantidade}x)` : ""}
                    </td>
                    <td className="p-2 border border-gray-200 text-right font-medium">
                      {total > 0 ? `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Resumo financeiro */}
        <div className="flex justify-end">
          <div className="space-y-1 text-sm min-w-[260px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal dos itens</span>
              <span className="font-medium">{fmtMoeda(totalPedido)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>TOTAL DO PEDIDO</span>
              <span className="text-green-700">{fmtMoeda(pedido.valor_final ?? totalPedido)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Entrada (50%)</span>
              <span>{fmtMoeda(valorEntrada)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Saldo na instalação</span>
              <span>{fmtMoeda(valorFinal - (typeof valorEntrada === "number" ? valorEntrada : parseFloat(String(valorEntrada ?? 0))))}</span>
            </div>
            {pedido.tipo_pagamento_codigo && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Forma de pagamento</span>
                <span>{pgmLabel(pedido.tipo_pagamento_codigo)}</span>
              </div>
            )}
            {pedido.num_parcelas && pedido.num_parcelas > 1 && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Parcelamento</span>
                <span>{pedido.num_parcelas}x</span>
              </div>
            )}
          </div>
        </div>

        {pedido.observacoes && (
          <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
            <p className="text-xs font-semibold uppercase text-yellow-700 mb-1">Observações</p>
            <p className="text-sm text-gray-700">{pedido.observacoes}</p>
          </div>
        )}

        <Separator />

        {/* Condições Gerais de Venda */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
            Condições Gerais de Venda
          </p>
          <ol className="space-y-1">
            {cgv.map((c, i) => (
              <li key={i} className="text-xs text-gray-600 leading-relaxed">{c}</li>
            ))}
          </ol>
        </div>

        {/* Assinatura */}
        <div className="grid grid-cols-2 gap-12 pt-8 mt-4">
          <div className="text-center">
            <div className="border-t border-gray-400 pt-2">
              <p className="text-xs text-gray-500">Assinatura do Cliente</p>
              <p className="text-xs text-gray-400 mt-1">{fmt(pedido.cliente_nome)}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 pt-2">
              <p className="text-xs text-gray-500">Cortiart — Responsável</p>
              <p className="text-xs text-gray-400 mt-1">{fmt(pedido.vendedor_nome)}</p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="text-center pt-4">
          <p className="text-xs text-gray-400">
            Arcádia Suite · Gerado em {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          @page { size: A4; margin: 1cm; }
        }
      `}</style>
    </div>
  );
}

export default DecorCapaPedido;
