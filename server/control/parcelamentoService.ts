// Sprint C7 — G1 Parcelamento.
// Materializa N lançamentos vinculados a um único grupo. Vencimentos
// avançam mês a mês a partir de `primeiroVencimento`. Ajuste de
// centavos é colocado na ÚLTIMA parcela para que SUM(parcelas) = valorTotal
// exatamente. Alterações no grupo só propagam para parcelas em aberto
// ('previsto') — pagas/aprovadas/canceladas ficam intactas.

import { db } from "../db";
import {
  gruposParcelamento,
  lancamentosFinanceiros,
  type GrupoParcelamento,
} from "@shared/schema";
import { addMonths, format } from "date-fns";
import { and, eq } from "drizzle-orm";

export interface CriarParceladoInput {
  tipo: "pagar" | "receber";
  descricao: string;
  valor: number;            // valor TOTAL (será dividido em N)
  parcelas: number;         // N parcelas
  primeiroVencimento: string; // 'YYYY-MM-DD'
  planoContaId?: string | null;
  centroCustoId?: string | null;
  tipoDocumentoId?: string | null;
  favorecido?: string | null;
  documento?: string | null;
  observacoes?: string | null;
}

export async function criarLancamentoParcelado(
  tenantId: string,
  clienteId: string,
  userId: string | null,
  input: CriarParceladoInput,
): Promise<{ grupo: GrupoParcelamento; lancamentos: Array<{ id: string }> }> {
  if (!Number.isInteger(input.parcelas) || input.parcelas < 2) {
    throw new Error("Número de parcelas deve ser >= 2");
  }
  if (input.parcelas > 360) {
    throw new Error("Limite máximo é 360 parcelas");
  }
  if (!Number.isFinite(input.valor) || input.valor <= 0) {
    throw new Error("Valor total deve ser maior que zero");
  }
  const valorParcelaCents = Math.floor((input.valor * 100) / input.parcelas);
  const valorParcela = valorParcelaCents / 100;
  const valorTotalCents = Math.round(input.valor * 100);
  const ajusteCents = valorTotalCents - valorParcelaCents * input.parcelas;
  const valorUltimaParcela = (valorParcelaCents + ajusteCents) / 100;

  const primeiraData = new Date(`${input.primeiroVencimento}T12:00:00`);
  if (Number.isNaN(primeiraData.getTime())) {
    throw new Error("Data do primeiro vencimento inválida");
  }

  return await db.transaction(async (tx) => {
    const [grupo] = await tx
      .insert(gruposParcelamento)
      .values({
        tenantId,
        clienteId,
        tipo: input.tipo,
        descricao: input.descricao,
        totalParcelas: input.parcelas,
        valorTotal: String(input.valor),
        planoContaId: input.planoContaId ?? null,
        centroCustoId: input.centroCustoId ?? null,
        tipoDocumentoId: input.tipoDocumentoId ?? null,
        favorecido: input.favorecido ?? null,
        observacoes: input.observacoes ?? null,
        criadoPor: userId,
      })
      .returning();

    const valuesToInsert = Array.from({ length: input.parcelas }, (_, i) => {
      const venc = addMonths(primeiraData, i);
      const isUltima = i === input.parcelas - 1;
      const valorDessaParcela = isUltima ? valorUltimaParcela : valorParcela;
      return {
        tenantId,
        clienteId,
        tipo: input.tipo,
        descricao: `${input.descricao} (${i + 1}/${input.parcelas})`,
        favorecido: input.favorecido ?? null,
        documento: input.documento ?? null,
        valor: String(valorDessaParcela),
        dataVencimento: format(venc, "yyyy-MM-dd"),
        status: "previsto",
        planoContaId: input.planoContaId ?? null,
        centroCustoId: input.centroCustoId ?? null,
        tipoDocumentoId: input.tipoDocumentoId ?? null,
        observacoes: input.observacoes ?? null,
        origem: "manual" as const,
        grupoParcelamentoId: grupo.id,
        numeroParcela: i + 1,
        totalParcelas: input.parcelas,
        criadoPor: userId,
      };
    });

    const lancamentos = await tx
      .insert(lancamentosFinanceiros)
      .values(valuesToInsert as any)
      .returning({ id: lancamentosFinanceiros.id });

    return { grupo, lancamentos };
  });
}

/**
 * Propaga alterações para as parcelas em aberto ('previsto') do grupo.
 * Não toca em parcelas pagas, aprovadas ou canceladas.
 */
export async function alterarGrupoParcelamento(
  tenantId: string,
  grupoId: string,
  changes: {
    descricao?: string;
    planoContaId?: string | null;
    centroCustoId?: string | null;
    tipoDocumentoId?: string | null;
    favorecido?: string | null;
  },
): Promise<{ ok: true; parcelasAfetadas: number }> {
  const setObj: Record<string, any> = {};
  if (changes.planoContaId !== undefined) setObj.planoContaId = changes.planoContaId;
  if (changes.centroCustoId !== undefined) setObj.centroCustoId = changes.centroCustoId;
  if (changes.tipoDocumentoId !== undefined) setObj.tipoDocumentoId = changes.tipoDocumentoId;
  if (changes.favorecido !== undefined) setObj.favorecido = changes.favorecido;

  return await db.transaction(async (tx) => {
    // Atualiza o grupo (descricao + metadados estruturais)
    const grupoUpdates: Record<string, any> = {};
    if (changes.descricao !== undefined) grupoUpdates.descricao = changes.descricao;
    if (changes.planoContaId !== undefined) grupoUpdates.planoContaId = changes.planoContaId;
    if (changes.centroCustoId !== undefined) grupoUpdates.centroCustoId = changes.centroCustoId;
    if (changes.tipoDocumentoId !== undefined) grupoUpdates.tipoDocumentoId = changes.tipoDocumentoId;
    if (changes.favorecido !== undefined) grupoUpdates.favorecido = changes.favorecido;
    if (Object.keys(grupoUpdates).length > 0) {
      await tx
        .update(gruposParcelamento)
        .set(grupoUpdates)
        .where(and(eq(gruposParcelamento.id, grupoId), eq(gruposParcelamento.tenantId, tenantId)));
    }

    if (Object.keys(setObj).length === 0) {
      return { ok: true as const, parcelasAfetadas: 0 };
    }

    // Atualiza apenas parcelas EM ABERTO (previsto)
    const result = await tx
      .update(lancamentosFinanceiros)
      .set({ ...setObj, updatedAt: new Date() })
      .where(
        and(
          eq(lancamentosFinanceiros.grupoParcelamentoId, grupoId),
          eq(lancamentosFinanceiros.tenantId, tenantId),
          eq(lancamentosFinanceiros.status, "previsto"),
        ),
      )
      .returning({ id: lancamentosFinanceiros.id });

    return { ok: true as const, parcelasAfetadas: result.length };
  });
}
