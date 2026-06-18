/**
 * SOE-00 — eventBus.ts
 * Outbox transacional para eventos de domínio do SOE.
 *
 * PADRÃO DE USO:
 *
 *   // Dentro de uma transação existente:
 *   await publishEvent(client, {
 *     tenantId:      req.tenantId,
 *     eventType:     'sale_order.confirmed',
 *     aggregateType: 'sale_order',
 *     aggregateId:   order.id,
 *     payload:       { orderId: order.id, total: order.total_liquido, ... },
 *     createdById:   req.user?.id,
 *   });
 *   // O evento é gravado junto com a alteração de estado — mesma transação.
 *   // O worker em background processa de forma assíncrona.
 *
 * GARANTIAS:
 *   - Evento e estado são atômicos: ou os dois persistem ou nenhum.
 *   - Consumers são idempotentes: verificam idempotency_key antes de agir.
 *   - Falhas são retentadas (até max_attempts). Após isso: dead_letter.
 *   - Worker usa SELECT ... FOR UPDATE SKIP LOCKED: sem duplicação paralela.
 */

import { pool } from "../../db/index";
import type { PoolClient } from "pg";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface SoeEventInput {
  tenantId:       string;
  eventType:      string;   // ex: 'sale_order.confirmed'
  aggregateType:  string;   // ex: 'sale_order'
  aggregateId:    string;   // ID do registro de origem
  payload:        Record<string, any>;
  createdById?:   string | null;
  scheduledAt?:   Date;     // default: agora (para eventos futuros/agendados)
}

export interface SoeEvent {
  id:              string;
  tenantId:        string;
  eventType:       string;
  aggregateType:   string;
  aggregateId:     string;
  payload:         Record<string, any>;
  idempotencyKey:  string;
  status:          'pending' | 'processing' | 'processed' | 'failed' | 'dead_letter';
  attempts:        number;
  maxAttempts:     number;
  lastError:       string | null;
  scheduledAt:     Date;
  processedAt:     Date | null;
  createdById:     string | null;
  createdAt:       Date;
}

// Handler registrado para um tipo de evento
export type SoeEventHandler = (event: SoeEvent) => Promise<void>;

// ─── Registry de consumers ────────────────────────────────────────────────────

const handlers = new Map<string, SoeEventHandler[]>();

/**
 * Registra um handler para um tipo de evento.
 * Múltiplos handlers podem ser registrados para o mesmo evento_type.
 * Cada handler recebe o evento independentemente.
 *
 * @example
 *   registerHandler('purchase_invoice.approved', stockEntryHandler);
 *   registerHandler('purchase_invoice.approved', apCreationHandler);
 */
export function registerHandler(eventType: string, handler: SoeEventHandler): void {
  const existing = handlers.get(eventType) ?? [];
  handlers.set(eventType, [...existing, handler]);
}

// ─── Publicação (dentro de transação existente) ───────────────────────────────

/**
 * Publica um evento de domínio dentro de uma transação existente.
 *
 * OBRIGATÓRIO: deve ser chamado com o mesmo `client` da transação que
 * está alterando o estado da entidade. Isso garante atomicidade.
 *
 * @param client - PoolClient já em transação aberta (BEGIN já emitido)
 * @param input  - Dados do evento
 */
export async function publishEvent(
  client: PoolClient,
  input: SoeEventInput
): Promise<void> {
  const idempotencyKey = `${input.aggregateType}:${input.aggregateId}:${input.eventType}`;

  await client.query(
    `INSERT INTO soe_events (
       tenant_id, event_type, aggregate_type, aggregate_id,
       payload, idempotency_key, status, scheduled_at, created_by_id
     ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      input.tenantId,
      input.eventType,
      input.aggregateType,
      input.aggregateId,
      JSON.stringify(input.payload),
      idempotencyKey,
      input.scheduledAt ?? new Date(),
      input.createdById ?? null,
    ]
  );
}

/**
 * Versão standalone (abre e fecha transação própria).
 * Usar apenas quando não houver transação externa disponível.
 * ATENÇÃO: perde a garantia de atomicidade com o estado da entidade.
 */
export async function publishEventStandalone(input: SoeEventInput): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await publishEvent(client, input);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─── Worker de processamento ──────────────────────────────────────────────────

const WORKER_POLL_MS  = 2_000;   // polling a cada 2 segundos
const WORKER_BATCH    = 10;       // processa até 10 eventos por ciclo
const LOCK_DURATION_S = 30;       // lock pessimista de 30s por evento

let workerRunning = false;
let workerTimer: ReturnType<typeof setTimeout> | null = null;
let missingTableWarned = false;

function envFlagEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value || "").trim().toLowerCase());
}

function workerDisabledByEnv(): boolean {
  if (envFlagEnabled(process.env.DISABLE_SOE_EVENT_WORKER)) return true;

  const explicit = process.env.SOE_EVENT_WORKER_ENABLED;
  if (explicit == null || explicit === "") return false;
  return !envFlagEnabled(explicit);
}

async function soeEventsTableExists(): Promise<boolean> {
  const { rows } = await pool.query<{ table_name: string | null }>(
    "SELECT to_regclass('public.soe_events') AS table_name",
  );
  return Boolean(rows[0]?.table_name);
}

/**
 * Inicia o worker de processamento de eventos em background.
 * Deve ser chamado uma única vez no bootstrap do servidor.
 */
export function startEventWorker(): void {
  if (workerRunning) return;
  if (workerDisabledByEnv()) {
    console.log("[SOE EventWorker] Desativado por env.");
    return;
  }

  workerRunning = true;
  void soeEventsTableExists()
    .then((exists) => {
      if (!exists) {
        workerRunning = false;
        missingTableWarned = true;
        console.warn("[SOE EventWorker] Desativado: tabela public.soe_events nao existe.");
        return;
      }

      console.log("[SOE EventWorker] Iniciado.");
      scheduleNextTick();
    })
    .catch((err: any) => {
      workerRunning = false;
      console.warn("[SOE EventWorker] Desativado: falha ao verificar public.soe_events:", err.message);
    });
}

export function stopEventWorker(): void {
  workerRunning = false;
  if (workerTimer) clearTimeout(workerTimer);
  console.log("[SOE EventWorker] Parado.");
}

function scheduleNextTick(): void {
  if (!workerRunning) return;
  workerTimer = setTimeout(async () => {
    try {
      await processBatch();
    } catch (err: any) {
      console.warn("[SOE EventWorker] Ciclo ignorado:", err.message);
    }
    scheduleNextTick();
  }, WORKER_POLL_MS);
}

async function processBatch(): Promise<void> {
  const client = await pool.connect();
  try {
    // Busca e bloqueia eventos pendentes — SKIP LOCKED evita race entre workers
    const { rows } = await client.query<SoeEvent>(
      `UPDATE soe_events
       SET status       = 'processing',
           attempts     = attempts + 1,
           locked_until = NOW() + INTERVAL '${LOCK_DURATION_S} seconds'
       WHERE id IN (
         SELECT id FROM soe_events
         WHERE status IN ('pending', 'failed')
           AND scheduled_at <= NOW()
           AND (locked_until IS NULL OR locked_until < NOW())
           AND attempts < max_attempts
         ORDER BY scheduled_at ASC
         LIMIT ${WORKER_BATCH}
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
    );

    for (const row of rows) {
      await processEvent(row);
    }

    // Marcar como dead_letter os que esgotaram tentativas
    await client.query(
      `UPDATE soe_events
       SET status = 'dead_letter'
       WHERE status = 'failed'
         AND attempts >= max_attempts`
    );
  } catch (err: any) {
    if (err?.code === "42P01" || String(err?.message || "").includes("soe_events")) {
      if (!missingTableWarned) {
        console.warn("[SOE EventWorker] Desativado: tabela public.soe_events nao existe.");
        missingTableWarned = true;
      }
      workerRunning = false;
      return;
    }

    console.error("[SOE EventWorker] Erro no batch:", err.message);
  } finally {
    client.release();
  }
}

async function processEvent(event: SoeEvent): Promise<void> {
  const eventHandlers = handlers.get(event.eventType) ?? [];

  if (eventHandlers.length === 0) {
    // Nenhum handler registrado — marca como processado (não é erro)
    await markProcessed(event.id);
    return;
  }

  try {
    // Executa todos os handlers em sequência
    // Se qualquer um falhar, o evento inteiro vai para retry
    for (const handler of eventHandlers) {
      await handler(event);
    }
    await markProcessed(event.id);
  } catch (err: any) {
    await markFailed(event.id, err.message);
    console.error(
      `[SOE EventWorker] Falha no evento ${event.eventType} (${event.id}): ${err.message}`
    );
  }
}

async function markProcessed(eventId: string): Promise<void> {
  await pool.query(
    `UPDATE soe_events
     SET status = 'processed', processed_at = NOW(), locked_until = NULL
     WHERE id = $1`,
    [eventId]
  );
}

async function markFailed(eventId: string, error: string): Promise<void> {
  await pool.query(
    `UPDATE soe_events
     SET status = 'failed', last_error = $2, locked_until = NULL
     WHERE id = $1`,
    [eventId, error.slice(0, 2000)]
  );
}

// ─── Utilitários de consulta ──────────────────────────────────────────────────

/**
 * Busca eventos de domínio por entidade — útil para debug e agentes.
 */
export async function getEventsForAggregate(
  tenantId: string,
  aggregateType: string,
  aggregateId: string,
  limit = 50
): Promise<SoeEvent[]> {
  const { rows } = await pool.query(
    `SELECT * FROM soe_events
     WHERE tenant_id = $1
       AND aggregate_type = $2
       AND aggregate_id = $3
     ORDER BY created_at DESC
     LIMIT $4`,
    [tenantId, aggregateType, aggregateId, limit]
  );
  return rows;
}

/**
 * Busca eventos pendentes ou em dead_letter — para painel de observabilidade.
 */
export async function getPendingEvents(
  tenantId: string,
  status: 'pending' | 'failed' | 'dead_letter' = 'pending',
  limit = 100
): Promise<SoeEvent[]> {
  const { rows } = await pool.query(
    `SELECT * FROM soe_events
     WHERE tenant_id = $1 AND status = $2
     ORDER BY created_at ASC
     LIMIT $3`,
    [tenantId, status, limit]
  );
  return rows;
}

/**
 * Reprocessa manualmente um evento específico (útil para dead_letter).
 */
export async function replayEvent(eventId: string): Promise<void> {
  await pool.query(
    `UPDATE soe_events
     SET status = 'pending', attempts = 0, last_error = NULL, scheduled_at = NOW()
     WHERE id = $1`,
    [eventId]
  );
}
