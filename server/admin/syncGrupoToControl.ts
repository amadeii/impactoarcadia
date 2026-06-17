/**
 * syncGrupoToControl
 * Sincroniza um grupo do Manager Partners (tenant_grupos)
 * com o Control (grupos_empresariais + grupos_empresariais_membros).
 *
 * Fluxo:
 * 1. Busca o tenant_grupo com seus membros e empresas
 * 2. Para cada empresa membro, resolve o clienteId do Control via CNPJ
 *    (cria o client no Control se não existir)
 * 3. Faz upsert em grupos_empresariais
 * 4. Sincroniza membros em grupos_empresariais_membros
 * 5. Salva grupo_control_id de volta em tenant_grupos
 *
 * Idempotente: seguro para chamar múltiplas vezes.
 */
import { pool } from '../../db/index';

interface TenantGrupoMembro {
  id: number;
  empresa_id: number;
  papel: string;
  participacao: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  tenant_id: number;
}

export interface SyncResult {
  grupoControlId: string;
  membrosSync: number;
  membrosErro: string[];
  criado: boolean;
}

export async function syncGrupoToControl(tenantGrupoId: number): Promise<SyncResult> {
  // 1. Buscar dados do grupo
  const grupoRes = await pool.query(
    `SELECT tg.*, t.id as tenant_arcadia_id
     FROM tenant_grupos tg
     JOIN tenants t ON t.id = tg.tenant_id
     WHERE tg.id = $1`,
    [tenantGrupoId],
  );
  if (grupoRes.rows.length === 0) {
    throw new Error(`tenant_grupo ${tenantGrupoId} não encontrado`);
  }
  const grupo = grupoRes.rows[0];
  const tenantId = String(grupo.tenant_id);

  // 2. Buscar membros com dados das empresas
  const membrosRes = await pool.query<TenantGrupoMembro>(
    `SELECT
       tgm.id,
       tgm.empresa_id,
       tgm.papel,
       tgm.participacao::text,
       te.razao_social,
       te.nome_fantasia,
       te.cnpj,
       te.tenant_id
     FROM tenant_grupo_membros tgm
     JOIN tenant_empresas te ON te.id = tgm.empresa_id
     WHERE tgm.grupo_id = $1
     ORDER BY tgm.papel DESC`,
    [tenantGrupoId],
  );
  const membros = membrosRes.rows;

  const erros: string[] = [];
  const clienteIds: Array<{ clienteId: string; papel: string; participacao: string }> = [];

  // 3. Resolver clienteId do Control para cada membro
  for (const membro of membros) {
    try {
      const clienteId = await resolveOrCreateClient(tenantId, membro);
      clienteIds.push({
        clienteId,
        papel: membro.papel,
        participacao: membro.participacao ?? '100.000',
      });
    } catch (err: any) {
      erros.push(`Empresa CNPJ ${membro.cnpj}: ${err.message}`);
    }
  }

  const matrizEntry = clienteIds.find(c => c.papel === 'matriz');
  const matrizClienteId = matrizEntry?.clienteId ?? null;

  // 4. Upsert em grupos_empresariais
  let grupoControlId: string;
  let criado = false;

  if (grupo.grupo_control_id) {
    await pool.query(
      `UPDATE grupos_empresariais
       SET nome = $1, tipo = $2, descricao = $3, ativo = $4, matriz_cliente_id = $5
       WHERE id = $6 AND tenant_id = $7`,
      [grupo.nome, grupo.tipo, grupo.descricao, grupo.ativo, matrizClienteId, grupo.grupo_control_id, tenantId],
    );
    grupoControlId = grupo.grupo_control_id;
  } else {
    const res = await pool.query(
      `INSERT INTO grupos_empresariais
         (id, tenant_id, nome, tipo, matriz_cliente_id, descricao, ativo)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [tenantId, grupo.nome, grupo.tipo, matrizClienteId, grupo.descricao, grupo.ativo],
    );
    grupoControlId = res.rows[0].id;
    criado = true;

    await pool.query(
      'UPDATE tenant_grupos SET grupo_control_id = $1 WHERE id = $2',
      [grupoControlId, tenantGrupoId],
    );
  }

  // 5. Sincronizar membros (delete + reinsert — idempotente)
  await pool.query(
    'DELETE FROM grupos_empresariais_membros WHERE grupo_id = $1 AND tenant_id = $2',
    [grupoControlId, tenantId],
  );

  for (const { clienteId, papel, participacao } of clienteIds) {
    await pool.query(
      `INSERT INTO grupos_empresariais_membros
         (id, tenant_id, grupo_id, cliente_id, papel, participacao)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::numeric)
       ON CONFLICT (grupo_id, cliente_id) DO UPDATE
         SET papel = EXCLUDED.papel, participacao = EXCLUDED.participacao`,
      [tenantId, grupoControlId, clienteId, papel, participacao],
    );
  }

  return { grupoControlId, membrosSync: clienteIds.length, membrosErro: erros, criado };
}

async function resolveOrCreateClient(tenantId: string, empresa: TenantGrupoMembro): Promise<string> {
  const existing = await pool.query(
    `SELECT id FROM clients WHERE tenant_id = $1 AND cnpj = $2 LIMIT 1`,
    [tenantId, empresa.cnpj],
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE clients SET name = $1, status = 'ativo', updated_at = NOW() WHERE id = $2`,
      [empresa.nome_fantasia ?? empresa.razao_social, existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  const res = await pool.query(
    `INSERT INTO clients (id, tenant_id, name, company, cnpj, status)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ativo')
     ON CONFLICT (tenant_id, cnpj) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [tenantId, empresa.nome_fantasia ?? empresa.razao_social, empresa.razao_social, empresa.cnpj],
  );
  return res.rows[0].id;
}
