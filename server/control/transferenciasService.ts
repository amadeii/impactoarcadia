// Sprint C7 — G4 Transferência entre contas.
// Operação atômica: gera 2 movimentações (saída + entrada) em uma única
// transação. Se qualquer etapa falhar, rollback automático garante que
// o saldo de NENHUMA conta seja alterado.
// Sprint C7 — G5 Saldo inicial: utilitário para registrar mov tipo='entrada'
// origem='saldo_inicial' (idempotente — atualiza se já existir).

import { db } from "../db";
import { contasBancarias, movimentacoesBancarias } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

function asNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(String(v));
}

export interface TransferenciaInput {
  origemId: string;
  destinoId: string;
  valor: number;
  data: string;        // 'YYYY-MM-DD'
  descricao: string;
}

export interface TransferenciaResult {
  ok: true;
  valor: number;
  movSaidaId: string;
  movEntradaId: string;
  saldoOrigemApos: string;
  saldoDestinoApos: string;
}

export async function transferirEntreContas(
  tenantId: string,
  clienteId: string,
  userId: string | null,
  input: TransferenciaInput,
): Promise<TransferenciaResult> {
  if (input.origemId === input.destinoId) {
    throw new Error("Origem e destino não podem ser a mesma conta");
  }
  if (!Number.isFinite(input.valor) || input.valor <= 0) {
    throw new Error("Valor deve ser maior que zero");
  }
  if (!input.data) {
    throw new Error("Data da transferência é obrigatória");
  }

  return await db.transaction(async (tx) => {
    // 1. Lock + valida origem
    const origemRows = await tx.execute<any>(sql`
      SELECT id, banco, cliente_id, saldo_atual
      FROM contas_bancarias
      WHERE id = ${input.origemId} AND tenant_id = ${tenantId}
      FOR UPDATE
    `);
    const origem: any = (origemRows as any).rows?.[0] ?? (origemRows as any)[0];
    if (!origem) throw new Error("Conta de origem não encontrada");
    if (origem.cliente_id !== clienteId) throw new Error("Conta de origem pertence a outro cliente");

    // 2. Lock + valida destino
    const destinoRows = await tx.execute<any>(sql`
      SELECT id, banco, cliente_id, saldo_atual
      FROM contas_bancarias
      WHERE id = ${input.destinoId} AND tenant_id = ${tenantId}
      FOR UPDATE
    `);
    const destino: any = (destinoRows as any).rows?.[0] ?? (destinoRows as any)[0];
    if (!destino) throw new Error("Conta de destino não encontrada");
    if (destino.cliente_id !== clienteId) throw new Error("Conta de destino pertence a outro cliente");

    const valor = asNum(input.valor);

    // 3. Debita origem
    const updOrigem = await tx.execute<any>(sql`
      UPDATE contas_bancarias
      SET saldo_atual = COALESCE(saldo_atual, 0) - ${valor}
      WHERE id = ${input.origemId} AND tenant_id = ${tenantId}
      RETURNING saldo_atual
    `);
    const saldoOrigem = String((updOrigem as any).rows?.[0]?.saldo_atual ?? (updOrigem as any)[0]?.saldo_atual ?? "0");

    // 4. Credita destino
    const updDestino = await tx.execute<any>(sql`
      UPDATE contas_bancarias
      SET saldo_atual = COALESCE(saldo_atual, 0) + ${valor}
      WHERE id = ${input.destinoId} AND tenant_id = ${tenantId}
      RETURNING saldo_atual
    `);
    const saldoDestino = String((updDestino as any).rows?.[0]?.saldo_atual ?? (updDestino as any)[0]?.saldo_atual ?? "0");

    // 5. Insere movimentação de saída na origem
    const [movSaida] = await tx
      .insert(movimentacoesBancarias)
      .values({
        tenantId,
        contaBancariaId: input.origemId,
        lancamentoId: null,
        data: input.data,
        tipo: "saida",
        origem: "transferencia",
        descricao: `Transferência para ${destino.banco}: ${input.descricao}`,
        valor: String(valor),
        saldoApos: saldoOrigem,
      } as any)
      .returning({ id: movimentacoesBancarias.id });

    // 6. Insere movimentação de entrada no destino
    const [movEntrada] = await tx
      .insert(movimentacoesBancarias)
      .values({
        tenantId,
        contaBancariaId: input.destinoId,
        lancamentoId: null,
        data: input.data,
        tipo: "entrada",
        origem: "transferencia",
        descricao: `Transferência de ${origem.banco}: ${input.descricao}`,
        valor: String(valor),
        saldoApos: saldoDestino,
      } as any)
      .returning({ id: movimentacoesBancarias.id });

    return {
      ok: true,
      valor,
      movSaidaId: movSaida.id,
      movEntradaId: movEntrada.id,
      saldoOrigemApos: saldoOrigem,
      saldoDestinoApos: saldoDestino,
    };
  });
}

/**
 * Sprint C7 — G5: define o saldo inicial da conta numa data específica.
 * Idempotente — se já existe uma movimentação origem='saldo_inicial' para
 * essa conta, ela é REVERTIDA (saldo subtraído) e a nova é gravada.
 */
export async function definirSaldoInicial(
  tenantId: string,
  contaBancariaId: string,
  userId: string | null,
  input: { data: string; valor: number },
): Promise<{ ok: true; saldoAposConta: string }> {
  return await db.transaction(async (tx) => {
    const contaRows = await tx.execute<any>(sql`
      SELECT id, saldo_atual
      FROM contas_bancarias
      WHERE id = ${contaBancariaId} AND tenant_id = ${tenantId}
      FOR UPDATE
    `);
    const conta: any = (contaRows as any).rows?.[0] ?? (contaRows as any)[0];
    if (!conta) throw new Error("Conta bancária não encontrada");

    // Reverte saldo_inicial existente (se houver) e o remove.
    const existRows = await tx.execute<any>(sql`
      SELECT id, valor, tipo
      FROM movimentacoes_bancarias
      WHERE tenant_id = ${tenantId}
        AND conta_bancaria_id = ${contaBancariaId}
        AND origem = 'saldo_inicial'
      FOR UPDATE
    `);
    const exist: any = (existRows as any).rows?.[0] ?? (existRows as any)[0];
    if (exist) {
      const valorAntigo = asNum(exist.valor);
      const ajusteReverso = exist.tipo === "entrada" ? -valorAntigo : valorAntigo;
      await tx.execute(sql`
        UPDATE contas_bancarias
        SET saldo_atual = COALESCE(saldo_atual, 0) + ${ajusteReverso}
        WHERE id = ${contaBancariaId} AND tenant_id = ${tenantId}
      `);
      await tx.execute(sql`
        DELETE FROM movimentacoes_bancarias
        WHERE id = ${exist.id} AND tenant_id = ${tenantId}
      `);
    }

    const valor = asNum(input.valor);
    // Saldo inicial sempre tipo=entrada (mesmo negativo entra como entrada com sinal)
    const tipo = valor >= 0 ? "entrada" : "saida";
    const valorAbs = Math.abs(valor);
    const ajuste = tipo === "entrada" ? valorAbs : -valorAbs;

    const updRows = await tx.execute<any>(sql`
      UPDATE contas_bancarias
      SET saldo_atual = COALESCE(saldo_atual, 0) + ${ajuste},
          saldo_inicial = ${valor}
      WHERE id = ${contaBancariaId} AND tenant_id = ${tenantId}
      RETURNING saldo_atual
    `);
    const saldoApos = String((updRows as any).rows?.[0]?.saldo_atual ?? (updRows as any)[0]?.saldo_atual ?? "0");

    await tx.insert(movimentacoesBancarias).values({
      tenantId,
      contaBancariaId,
      lancamentoId: null,
      data: input.data,
      tipo,
      origem: "saldo_inicial",
      descricao: "Saldo inicial de abertura",
      valor: String(valorAbs),
      saldoApos,
    } as any);

    return { ok: true, saldoAposConta: saldoApos };
  });
}
