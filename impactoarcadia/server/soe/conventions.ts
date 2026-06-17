/**
 * SOE-00 — conventions.ts
 * Contratos e helpers transversais do Sistema Operacional Empresarial.
 *
 * Importado por todos os módulos SOE (CAD, COM, COMP, EST, FISC).
 * Nunca importar módulos de negócio aqui — este arquivo não tem dependências
 * além de pg e tipos nativos.
 *
 * CONTEÚDO:
 *   1. SoeContext         — contexto de request passado a todo serviço SOE
 *   2. SoeResult<T>       — envelope de resposta padrão
 *   3. SoeAuditFields     — campos de auditoria obrigatórios em toda tabela
 *   4. auditLog()         — grava entrada em soe_audit_log
 *   5. withTransaction()  — helper transacional com auto-rollback
 *   6. buildIdempotencyKey() — derivação padronizada de chaves
 *   7. STATUS_*           — constantes de status por domínio
 *   8. TENANT_ADAPTER     — resolução de tenant_id integer ↔ varchar
 */

import { pool } from "../../db/index";
import type { PoolClient } from "pg";

// ─── 1. Contexto de request ───────────────────────────────────────────────────

/**
 * Contexto extraído do request HTTP e passado a todo serviço SOE.
 * Construído pelo helper `soeContextFromReq` no controller.
 */
export interface SoeContext {
  tenantId:      string;   // tenant_id varchar (padrão Hub)
  userId:        string;   // user.id do usuário autenticado
  empresaId?:    string;   // empresa ativa (x-empresa-id)
  grupoId?:      string;   // grupo ativo (x-grupo-id)
  ipAddress?:    string;
  requestId?:    string;   // correlação com logs
}

/**
 * Extrai SoeContext de um request Express.
 * Uso no controller: const ctx = soeContextFromReq(req);
 */
export function soeContextFromReq(req: any): SoeContext {
  return {
    tenantId:   String(req.tenantId),
    userId:     req.user?.id ?? "system",
    empresaId:  req.activeEmpresaId ?? undefined,
    grupoId:    req.activeGrupoId ?? undefined,
    ipAddress:  req.ip ?? req.headers?.["x-forwarded-for"] ?? undefined,
    requestId:  req.headers?.["x-request-id"] ?? undefined,
  };
}

// ─── 2. Envelope de resposta ──────────────────────────────────────────────────

export type SoeResult<T> =
  | { ok: true;  data: T;      error?: never }
  | { ok: false; data?: never; error: string; code?: string };

export function ok<T>(data: T): SoeResult<T> {
  return { ok: true, data };
}

export function err(message: string, code?: string): SoeResult<never> {
  return { ok: false, error: message, code };
}

// ─── 3. Campos de auditoria ───────────────────────────────────────────────────

/**
 * Todo INSERT em tabela SOE deve incluir estes campos.
 * Uso: INSERT INTO ... (..., $soeAuditFields) VALUES (..., $soeAuditValues(ctx))
 */
export interface SoeAuditFields {
  created_by_id: string;
  updated_by_id: string;
  created_at:    Date;
  updated_at:    Date;
}

export function soeAuditValues(ctx: SoeContext): SoeAuditFields {
  const now = new Date();
  return {
    created_by_id: ctx.userId,
    updated_by_id: ctx.userId,
    created_at:    now,
    updated_at:    now,
  };
}

// ─── 4. auditLog() ────────────────────────────────────────────────────────────

export interface AuditLogInput {
  ctx:         SoeContext;
  entityType:  string;
  entityId:    string;
  action:      'created' | 'updated' | 'status_changed' | 'deleted' | string;
  beforeState?: Record<string, any> | null;
  afterState?:  Record<string, any> | null;
}

/**
 * Grava entrada na trilha de auditoria imutável.
 * Pode ser chamado dentro ou fora de uma transação.
 * Falha silenciosa — nunca lança exceção para não bloquear o fluxo principal.
 */
export async function auditLog(
  clientOrNull: PoolClient | null,
  input: AuditLogInput
): Promise<void> {
  const query = `
    INSERT INTO soe_audit_log (
      tenant_id, entity_type, entity_id, action,
      before_state, after_state,
      user_id, ip_address, request_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `;
  const params = [
    input.ctx.tenantId,
    input.entityType,
    input.entityId,
    input.action,
    input.beforeState ? JSON.stringify(input.beforeState) : null,
    input.afterState  ? JSON.stringify(input.afterState)  : null,
    input.ctx.userId,
    input.ctx.ipAddress ?? null,
    input.ctx.requestId ?? null,
  ];

  try {
    if (clientOrNull) {
      await clientOrNull.query(query, params);
    } else {
      await pool.query(query, params);
    }
  } catch (auditErr: any) {
    // Auditoria nunca bloqueia o fluxo principal
    console.error("[SOE Audit] Falha ao gravar audit_log:", auditErr.message);
  }
}

// ─── 5. withTransaction() ────────────────────────────────────────────────────

/**
 * Executa uma função dentro de uma transação com auto-rollback em caso de erro.
 * Passa o PoolClient para a função — use-o para publishEvent e auditLog.
 *
 * @example
 *   const result = await withTransaction(async (client) => {
 *     await client.query(`UPDATE sale_orders SET status='confirmed' WHERE id=$1`, [id]);
 *     await publishEvent(client, { ... });
 *     await auditLog(client, { ... });
 *     return ok(updatedOrder);
 *   });
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─── 6. buildIdempotencyKey() ────────────────────────────────────────────────

/**
 * Derivação padronizada de chaves de idempotência.
 * Formato: '{aggregateType}:{aggregateId}:{eventType}'
 * Usado pelo eventBus e por gerarLancamentoReceber / gerarLancamentoPagar.
 */
export function buildIdempotencyKey(
  aggregateType: string,
  aggregateId:   string,
  eventType:     string
): string {
  return `${aggregateType}:${aggregateId}:${eventType}`;
}

// ─── 7. Constantes de status por domínio ─────────────────────────────────────

export const STATUS_PESSOA = {
  ATIVO:     'ativo',
  INATIVO:   'inativo',
  BLOQUEADO: 'bloqueado',
} as const;

export const STATUS_SALE_ORDER = {
  RASCUNHO:      'rascunho',
  EM_APROVACAO:  'em_aprovacao',
  CONFIRMADO:    'confirmado',
  EM_SEPARACAO:  'em_separacao',
  FATURADO:      'faturado',
  CONCLUIDO:     'concluido',
  CANCELADO:     'cancelado',
} as const;

export const STATUS_SALE_QUOTE = {
  RASCUNHO: 'rascunho',
  ENVIADO:  'enviado',
  ACEITO:   'aceito',
  EXPIRADO: 'expirado',
  CANCELADO:'cancelado',
} as const;

export const STATUS_PURCHASE_INVOICE = {
  IMPORTADO:       'importado',
  VALIDANDO:       'validando',
  COM_DIVERGENCIA: 'com_divergencia',
  APROVADO:        'aprovado',
  RECUSADO:        'recusado',
  ESTORNADO:       'estornado',
} as const;

export const STATUS_FISCAL_DOC = {
  MONTADO:     'montado',
  TRANSMITIDO: 'transmitido',
  AUTORIZADO:  'autorizado',
  REJEITADO:   'rejeitado',
  CANCELADO:   'cancelado',
  INUTILIZADO: 'inutilizado',
} as const;

export const STATUS_INVENTORY_MOVEMENT = {
  ENTRADA_COMPRA:     'entrada_compra',
  SAIDA_VENDA:        'saida_venda',
  TRANSFERENCIA_SAIDA:'transferencia_saida',
  TRANSFERENCIA_ENTR: 'transferencia_entrada',
  AJUSTE_INVENTARIO:  'ajuste_inventario',
  RETIRADA:           'retirada',
  DEVOLUCAO_CLIENTE:  'devolucao_cliente',
  DEVOLUCAO_FORN:     'devolucao_fornecedor',
} as const;

export const FORMA_PAGAMENTO_SEFAZ = {
  DINHEIRO:       '01',
  CHEQUE:         '02',
  CARTAO_CREDITO: '03',
  CARTAO_DEBITO:  '04',
  CREDITO_LOJA:   '05',
  VALE_ALIM:      '10',
  VALE_REFEICAO:  '11',
  BOLETO:         '15',
  DEPOSITO:       '16',
  PIX:            '17',
  SEM_PAGAMENTO:  '90',
  OUTROS:         '99',
} as const;

// ─── 8. TENANT_ADAPTER ───────────────────────────────────────────────────────

/**
 * Tabelas legadas (customers, suppliers, products, tenants) usam tenant_id INTEGER.
 * Tabelas SOE novas usam tenant_id VARCHAR.
 *
 * Estas funções convertem entre os dois formatos sem ambiguidade.
 */
export function tenantIdToInt(tenantId: string): number {
  const n = parseInt(tenantId, 10);
  if (isNaN(n)) throw new Error(`tenant_id inválido para conversão integer: '${tenantId}'`);
  return n;
}

export function tenantIdToStr(tenantId: number | string): string {
  return String(tenantId);
}

/**
 * Verifica se um tenant_id está no formato correto para tabelas novas (VARCHAR).
 * Rejeita undefined, null, strings vazias — garante segurança nas queries.
 */
export function assertTenantId(tenantId: unknown, context = ""): string {
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
    throw new Error(
      `[SOE] tenant_id ausente ou inválido${context ? ` em ${context}` : ""}.`
    );
  }
  return tenantId;
}

// ─── 9. Tipos de papel de pessoa ─────────────────────────────────────────────

export const PAPEL_PESSOA = {
  CLIENTE:       'cliente',
  FORNECEDOR:    'fornecedor',
  COLABORADOR:   'colaborador',
  TRANSPORTADORA:'transportadora',
  CREDOR:        'credor',
  PROSPECT:      'prospect',
  PARCEIRO:      'parceiro',
} as const;

export type TipoPapel = typeof PAPEL_PESSOA[keyof typeof PAPEL_PESSOA];

// ─── 10. Validação de campos fiscais ─────────────────────────────────────────

/** Valida CNPJ (14 dígitos) */
export function isValidCnpj(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (d: string, len: number) => {
    let sum = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(d[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  return calc(d, 12) === parseInt(d[12]) && calc(d, 13) === parseInt(d[13]);
}

/** Valida CPF (11 dígitos) */
export function isValidCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (d: string, len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 || r === 11 ? 0 : r;
  };
  return calc(d, 9) === parseInt(d[9]) && calc(d, 10) === parseInt(d[10]);
}

/** Normaliza CNPJ/CPF para dígitos apenas */
export function normalizeCnpjCpf(value: string): string {
  return value.replace(/\D/g, "");
}

/** Valida NCM (8 dígitos) */
export function isValidNcm(ncm: string): boolean {
  return /^\d{8}$/.test(ncm.replace(/\D/g, ""));
}

/** Valida CFOP (4 dígitos, 1xxx–9xxx) */
export function isValidCfop(cfop: string): boolean {
  return /^[1-9]\d{3}$/.test(cfop.replace(/\D/g, ""));
}
