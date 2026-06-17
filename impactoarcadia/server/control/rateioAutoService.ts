/**
 * Sprint C-E08 — Motor de Rateio Automático (Impacto ↔ SAF)
 * Ao confirmar lançamento em CC com marca_rateio=true, gera lançamentos filhos.
 */
import { pool } from "../../db/index";

export interface RateioConfig {
  id: string;
  centroCustoId: string;
  criterio: string;
  percentualImpacto: number;
  percentualSaf: number;
  observacoes: string | null;
  ativo: boolean;
}

/** Busca configuração de rateio para um CC específico */
export async function getRateioConfig(tenantId: string, centroCustoId: string): Promise<RateioConfig | null> {
  const r = await pool.query(
    `SELECT * FROM control_rateio_config WHERE tenant_id=$1 AND centro_custo_id=$2 AND ativo=true LIMIT 1`,
    [tenantId, centroCustoId]
  );
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  return {
    id: row.id,
    centroCustoId: row.centro_custo_id,
    criterio: row.criterio,
    percentualImpacto: Number(row.percentual_impacto),
    percentualSaf: Number(row.percentual_saf),
    observacoes: row.observacoes,
    ativo: row.ativo,
  };
}

/** Lista todas as configs de rateio do tenant */
export async function listRateioConfigs(tenantId: string): Promise<any[]> {
  const r = await pool.query(`
    SELECT rc.*, cc.nome AS cc_nome, cc.codigo AS cc_codigo
    FROM control_rateio_config rc
    LEFT JOIN centros_custo cc ON cc.id = rc.centro_custo_id
    WHERE rc.tenant_id = $1
    ORDER BY cc.codigo
  `, [tenantId]);
  return r.rows;
}

/** Cria ou atualiza configuração de rateio para um CC */
export async function upsertRateioConfig(tenantId: string, data: {
  centroCustoId: string;
  criterio?: string;
  percentualImpacto: number;
  percentualSaf: number;
  observacoes?: string;
  ativo?: boolean;
}): Promise<any> {
  const r = await pool.query(`
    INSERT INTO control_rateio_config
      (tenant_id, centro_custo_id, criterio, percentual_impacto, percentual_saf, observacoes, ativo)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT DO NOTHING
    RETURNING *
  `, [
    tenantId, data.centroCustoId, data.criterio ?? 'percentual',
    data.percentualImpacto, data.percentualSaf,
    data.observacoes ?? null, data.ativo ?? true,
  ]);

  if (r.rows[0]) return r.rows[0];

  // update if already exists
  const upd = await pool.query(`
    UPDATE control_rateio_config
    SET criterio=$3, percentual_impacto=$4, percentual_saf=$5,
        observacoes=$6, ativo=$7, updated_at=NOW()
    WHERE tenant_id=$1 AND centro_custo_id=$2
    RETURNING *
  `, [
    tenantId, data.centroCustoId, data.criterio ?? 'percentual',
    data.percentualImpacto, data.percentualSaf,
    data.observacoes ?? null, data.ativo ?? true,
  ]);
  return upd.rows[0];
}

/**
 * Gera lançamentos filhos de rateio a partir de um lançamento pai confirmado.
 * Retorna quantos lançamentos filhos foram gerados (0 se CC não tem rateio).
 */
export async function gerarRateioAutomatico(
  tenantId: string,
  lancamentoPaiId: string,
): Promise<{ gerados: number; configs: number }> {
  // Busca lançamento pai
  const lancResult = await pool.query(
    `SELECT * FROM lancamentos_financeiros WHERE id=$1 AND tenant_id=$2`,
    [lancamentoPaiId, tenantId]
  );
  const lanc = lancResult.rows[0];
  if (!lanc) throw new Error("Lançamento não encontrado");

  // Verifica se CC tem marca_rateio
  if (!lanc.centro_custo_id) return { gerados: 0, configs: 0 };

  const ccResult = await pool.query(
    `SELECT marca_rateio FROM centros_custo WHERE id=$1 AND tenant_id=$2`,
    [lanc.centro_custo_id, tenantId]
  );
  const cc = ccResult.rows[0];
  if (!cc?.marca_rateio) return { gerados: 0, configs: 0 };

  // Busca configuração
  const config = await getRateioConfig(tenantId, lanc.centro_custo_id);
  if (!config) return { gerados: 0, configs: 0 };

  // Remove rateios anteriores deste lançamento pai (idempotente)
  await pool.query(
    `DELETE FROM lancamentos_financeiros WHERE origem_rateio_id=$1 AND tenant_id=$2`,
    [lancamentoPaiId, tenantId]
  );

  const valor = Number(lanc.valor);
  const gerados: any[] = [];

  if (config.percentualImpacto > 0) {
    gerados.push({
      empresa: "impacto",
      valor: +(valor * config.percentualImpacto / 100).toFixed(2),
    });
  }
  if (config.percentualSaf > 0) {
    gerados.push({
      empresa: "saf",
      valor: +(valor * config.percentualSaf / 100).toFixed(2),
    });
  }

  for (const g of gerados) {
    await pool.query(`
      INSERT INTO lancamentos_financeiros
        (tenant_id, cliente_id, tipo, descricao, valor, data_vencimento, status,
         plano_conta_id, centro_custo_id, tipo_lancamento, origem_rateio_id, empresa_rateio,
         projeto_id, origem)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'rateio',$10,$11,$12,'automatico')
    `, [
      tenantId, lanc.cliente_id, lanc.tipo,
      `[Rateio ${g.empresa.toUpperCase()}] ${lanc.descricao}`,
      g.valor, lanc.data_vencimento, lanc.status,
      lanc.plano_conta_id, lanc.centro_custo_id,
      lancamentoPaiId, g.empresa,
      lanc.projeto_id,
    ]);
  }

  return { gerados: gerados.length, configs: 1 };
}

/** Relatório mensal de rateio */
export async function getRelatorioRateio(
  tenantId: string,
  clienteId: string,
  ano: number,
  mes: number,
): Promise<any[]> {
  const r = await pool.query(`
    SELECT
      l.empresa_rateio,
      cc.nome AS centro_custo,
      SUM(l.valor) AS total,
      COUNT(*) AS quantidade
    FROM lancamentos_financeiros l
    LEFT JOIN centros_custo cc ON cc.id = l.centro_custo_id
    WHERE l.tenant_id = $1
      AND l.cliente_id = $2
      AND l.tipo_lancamento = 'rateio'
      AND EXTRACT(YEAR FROM l.data_vencimento) = $3
      AND EXTRACT(MONTH FROM l.data_vencimento) = $4
    GROUP BY l.empresa_rateio, cc.nome
    ORDER BY l.empresa_rateio, cc.nome
  `, [tenantId, clienteId, ano, mes]);
  return r.rows;
}

/**
 * Seed dos percentuais de rateio padrão da Impacto Geologia
 * Baseado no documento: Critério de Rateio e Centros de Custo com Bases 1100
 * Executa UPSERT — seguro para rodar múltiplas vezes.
 * Requer que os CCs série 1100 já existam e tenham marca_rateio = true.
 */
export async function seedRateioImpacto(pool: any, clienteId: string) {
  const configsPadrao: Array<{
    codigo: string; percentualImpacto: number; percentualSaf: number;
    criterio: string; observacoes: string;
  }> = [
    { codigo: "1110", percentualImpacto: 60, percentualSaf: 40, criterio: "area_m2",    observacoes: "Aluguel e IPTU — base: m² ocupados" },
    { codigo: "1111", percentualImpacto: 60, percentualSaf: 40, criterio: "area_m2",    observacoes: "Energia elétrica — base: m² ocupados" },
    { codigo: "1112", percentualImpacto: 60, percentualSaf: 40, criterio: "area_m2",    observacoes: "Água e saneamento — base: m² ocupados" },
    { codigo: "1113", percentualImpacto: 60, percentualSaf: 40, criterio: "area_m2",    observacoes: "Condomínio — base: m² ocupados" },
    { codigo: "1120", percentualImpacto: 70, percentualSaf: 30, criterio: "ramais",     observacoes: "Telefonia — base: ramais por empresa" },
    { codigo: "1121", percentualImpacto: 70, percentualSaf: 30, criterio: "ramais",     observacoes: "Internet — base: ramais por empresa" },
    { codigo: "1122", percentualImpacto: 65, percentualSaf: 35, criterio: "percentual", observacoes: "Software e licenças — percentual fixo acordado" },
    { codigo: "1130", percentualImpacto: 65, percentualSaf: 35, criterio: "horas",      observacoes: "RH administrativo — base: horas dedicadas" },
    { codigo: "1131", percentualImpacto: 65, percentualSaf: 35, criterio: "horas",      observacoes: "Contabilidade compartilhada — base: horas" },
    { codigo: "1132", percentualImpacto: 70, percentualSaf: 30, criterio: "percentual", observacoes: "Serviços jurídicos — percentual fixo" },
    { codigo: "1140", percentualImpacto: 70, percentualSaf: 30, criterio: "horas",      observacoes: "Veículos — base: horas/km utilizados" },
    { codigo: "1141", percentualImpacto: 70, percentualSaf: 30, criterio: "horas",      observacoes: "Manutenção frota — base: horas utilizadas" },
    { codigo: "1150", percentualImpacto: 80, percentualSaf: 20, criterio: "horas",      observacoes: "Equipamentos lab — predominância Impacto" },
    { codigo: "1151", percentualImpacto: 75, percentualSaf: 25, criterio: "horas",      observacoes: "Manutenção equipamentos — base: horas uso" },
    { codigo: "1190", percentualImpacto: 60, percentualSaf: 40, criterio: "percentual", observacoes: "Despesas administrativas gerais" },
    { codigo: "1191", percentualImpacto: 60, percentualSaf: 40, criterio: "percentual", observacoes: "Material de escritório" },
    { codigo: "1192", percentualImpacto: 60, percentualSaf: 40, criterio: "percentual", observacoes: "Limpeza e conservação" },
    { codigo: "1199", percentualImpacto: 60, percentualSaf: 40, criterio: "percentual", observacoes: "Outros custos compartilhados" },
  ];

  let criados = 0;
  let atualizados = 0;
  const erros: string[] = [];

  for (const config of configsPadrao) {
    try {
      const ccResult = await pool.query(
        `SELECT id FROM centros_custo WHERE cliente_id = $1 AND codigo = $2 LIMIT 1`,
        [clienteId, config.codigo]
      );
      if (ccResult.rows.length === 0) {
        erros.push(`CC ${config.codigo} não encontrado — execute o seed série 1100 primeiro`);
        continue;
      }
      const ccId = ccResult.rows[0].id;

      const existeResult = await pool.query(
        `SELECT id FROM control_rateio_config WHERE cliente_id = $1 AND centro_custo_id = $2 LIMIT 1`,
        [clienteId, ccId]
      );

      if (existeResult.rows.length > 0) {
        await pool.query(
          `UPDATE control_rateio_config
           SET criterio = $1, percentual_impacto = $2, percentual_saf = $3,
               observacoes = $4, ativo = true, updated_at = NOW()
           WHERE cliente_id = $5 AND centro_custo_id = $6`,
          [config.criterio, config.percentualImpacto, config.percentualSaf,
           config.observacoes, clienteId, ccId]
        );
        atualizados++;
      } else {
        await pool.query(
          `INSERT INTO control_rateio_config
             (id, tenant_id, cliente_id, centro_custo_id, criterio,
              percentual_impacto, percentual_saf, observacoes, ativo, created_at)
           SELECT gen_random_uuid(), c.tenant_id, $1, $2, $3, $4, $5, $6, true, NOW()
           FROM clientes c WHERE c.id = $1`,
          [clienteId, ccId, config.criterio,
           config.percentualImpacto, config.percentualSaf, config.observacoes]
        );
        criados++;
      }

      await pool.query(
        `UPDATE centros_custo SET marca_rateio = true WHERE id = $1`,
        [ccId]
      );
    } catch (err: any) {
      erros.push(`CC ${config.codigo}: ${err.message}`);
    }
  }

  return { criados, atualizados, erros, total: configsPadrao.length };
}
