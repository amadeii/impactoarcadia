/**
 * CAD-01 — seed_defaults.ts
 * Seed idempotente de cadastros padrão por tenant.
 *
 * Cria, se não existirem:
 *   - Condições de pagamento padrão (À Vista, 30dd, 30/60, 30/60/90, 2×, 3×, 12×)
 *   - Tabela de preço padrão (Varejo)
 *
 * Deve ser chamado após CAD-01 migration e na criação de novos tenants.
 */

import { pool } from "../../db/index";

interface SeedCondition {
  codigo: string;
  nome: string;
  tipo: 'a_vista' | 'parcelado';
  diasVencimento?: number;
  parcelas?: Array<{ sequencia: number; dias: number; percentual: number; formaPagamento?: string }>;
  formasAceitas?: string[];
  padrao?: boolean;
}

const CONDITIONS: SeedCondition[] = [
  {
    codigo: 'AV',
    nome: 'À Vista',
    tipo: 'a_vista',
    diasVencimento: 0,
    formasAceitas: ['01', '17'],
    padrao: true,
  },
  {
    codigo: '30DD',
    nome: '30 Dias',
    tipo: 'a_vista',
    diasVencimento: 30,
    formasAceitas: ['15', '17'],
  },
  {
    codigo: '30/60',
    nome: '30/60 Dias',
    tipo: 'parcelado',
    parcelas: [
      { sequencia: 1, dias: 30, percentual: 50, formaPagamento: '15' },
      { sequencia: 2, dias: 60, percentual: 50, formaPagamento: '15' },
    ],
    formasAceitas: ['15', '17'],
  },
  {
    codigo: '30/60/90',
    nome: '30/60/90 Dias',
    tipo: 'parcelado',
    parcelas: [
      { sequencia: 1, dias: 30,  percentual: 33.34, formaPagamento: '15' },
      { sequencia: 2, dias: 60,  percentual: 33.33, formaPagamento: '15' },
      { sequencia: 3, dias: 90,  percentual: 33.33, formaPagamento: '15' },
    ],
    formasAceitas: ['15', '17'],
  },
  {
    codigo: '2X',
    nome: '2× Cartão',
    tipo: 'parcelado',
    parcelas: [
      { sequencia: 1, dias: 30, percentual: 50, formaPagamento: '03' },
      { sequencia: 2, dias: 60, percentual: 50, formaPagamento: '03' },
    ],
    formasAceitas: ['03'],
  },
  {
    codigo: '3X',
    nome: '3× Cartão',
    tipo: 'parcelado',
    parcelas: [
      { sequencia: 1, dias: 30, percentual: 33.34, formaPagamento: '03' },
      { sequencia: 2, dias: 60, percentual: 33.33, formaPagamento: '03' },
      { sequencia: 3, dias: 90, percentual: 33.33, formaPagamento: '03' },
    ],
    formasAceitas: ['03'],
  },
  {
    codigo: '12X',
    nome: '12× Cartão',
    tipo: 'parcelado',
    parcelas: Array.from({ length: 12 }, (_, i) => ({
      sequencia: i + 1,
      dias: (i + 1) * 30,
      percentual: i < 11 ? 8.34 : 8.06,
      formaPagamento: '03',
    })),
    formasAceitas: ['03'],
  },
];

export async function seedCad01Defaults(
  tenantId: string,
  userId: string = 'system'
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const cond of CONDITIONS) {
      const { rowCount } = await client.query(
        `SELECT 1 FROM soe_condicoes_pagamento WHERE tenant_id = $1 AND codigo = $2`,
        [tenantId, cond.codigo]
      );
      if (rowCount! > 0) continue;

      const { rows } = await client.query(
        `INSERT INTO soe_condicoes_pagamento
           (tenant_id, codigo, nome, tipo, dias_vencimento,
            formas_aceitas, padrao, created_by_id, updated_by_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
         RETURNING id`,
        [
          tenantId, cond.codigo, cond.nome, cond.tipo,
          cond.diasVencimento ?? 0,
          cond.formasAceitas ?? ['01', '15', '17'],
          cond.padrao ?? false,
          userId,
        ]
      );

      const condicaoId = rows[0].id;

      if (cond.parcelas?.length) {
        for (const p of cond.parcelas) {
          await client.query(
            `INSERT INTO soe_condicao_parcelas
               (condicao_pagamento_id, sequencia, dias, percentual, forma_pagamento)
             VALUES ($1,$2,$3,$4,$5)`,
            [condicaoId, p.sequencia, p.dias, p.percentual, p.formaPagamento ?? null]
          );
        }
      }

      console.log(`[CAD-01 Seed] Condição criada: ${cond.codigo} — ${cond.nome}`);
    }

    const { rowCount: tpExists } = await client.query(
      `SELECT 1 FROM soe_tabelas_preco WHERE tenant_id = $1 AND codigo = 'VAREJO'`,
      [tenantId]
    );
    if (!tpExists) {
      await client.query(
        `INSERT INTO soe_tabelas_preco
           (tenant_id, codigo, nome, descricao, tipo_cliente, canal_venda,
            padrao, created_by_id, updated_by_id)
         VALUES ($1,'VAREJO','Tabela Varejo','Tabela de preço padrão','varejo','todos',true,$2,$2)`,
        [tenantId, userId]
      );
      console.log(`[CAD-01 Seed] Tabela de preço padrão criada: VAREJO`);
    }

    await client.query("COMMIT");
    console.log(`[CAD-01 Seed] Defaults criados para tenant ${tenantId}.`);
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[CAD-01 Seed] Erro:", err.message);
    throw err;
  } finally {
    client.release();
  }
}
