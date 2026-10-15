import { Prisma } from "../../generated/prisma/client.ts";
import { prisma, type TransactionClient } from "../../shared/database/prisma.ts";
import type { DatabaseClient } from "../../shared/database/prisma.ts";
import type {
  FailResult,
  NewOutboxMessage,
  OutboxMessage,
  OutboxStats,
  OutboxStatus,
  OutboxStore,
} from "./outbox.types.ts";

/** Snake_case row returned by raw SQL against `outbox_events`. */
interface OutboxRow {
  id: string;
  event_id: string;
  event_type: string;
  version: number;
  tenant_id: string | null;
  payload: unknown;
  correlation_id: string | null;
  causation_id: string | null;
  occurred_at: Date;
  status: string;
  attempts: number;
  max_attempts: number;
  available_at: Date;
  locked_at: Date | null;
  locked_by: string | null;
  last_error: string | null;
  dispatched_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: OutboxRow): OutboxMessage {
  return {
    id: row.id,
    eventId: row.event_id,
    eventType: row.event_type,
    version: row.version,
    tenantId: row.tenant_id,
    payload: row.payload,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    occurredAt: row.occurred_at,
    status: row.status as OutboxStatus,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    availableAt: row.available_at,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    lastError: row.last_error,
    dispatchedAt: row.dispatched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * PostgreSQL implementation of the outbox store.
 *
 * Claiming uses `FOR UPDATE SKIP LOCKED` so that, even with several dispatcher
 * instances, no two workers ever receive the same message — the lock is
 * transactional and released when the claim UPDATE commits. Leases enable
 * recovery when a worker dies mid-processing.
 */
export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly db: typeof prisma = prisma) {}

  async append(
    message: NewOutboxMessage,
    tx: DatabaseClient,
  ): Promise<OutboxMessage> {
    const client = tx as TransactionClient;
    const created = await client.outboxEvent.create({
      data: {
        eventId: message.eventId,
        eventType: message.eventType,
        version: message.version,
        tenantId: message.tenantId,
        payload: message.payload as Prisma.InputJsonValue,
        correlationId: message.correlationId,
        causationId: message.causationId,
        occurredAt: message.occurredAt,
        maxAttempts: message.maxAttempts,
      },
    });
    return {
      id: created.id,
      eventId: created.eventId,
      eventType: created.eventType,
      version: created.version,
      tenantId: created.tenantId,
      payload: created.payload,
      correlationId: created.correlationId,
      causationId: created.causationId,
      occurredAt: created.occurredAt,
      status: created.status,
      attempts: created.attempts,
      maxAttempts: created.maxAttempts,
      availableAt: created.availableAt,
      lockedAt: created.lockedAt,
      lockedBy: created.lockedBy,
      lastError: created.lastError,
      dispatchedAt: created.dispatchedAt,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async claimBatch(workerId: string, limit: number): Promise<OutboxMessage[]> {
    const rows = await this.db.$queryRaw<OutboxRow[]>(Prisma.sql`
      UPDATE outbox_events AS o
      SET status = 'PROCESSING',
          locked_at = now(),
          locked_by = ${workerId},
          attempts = o.attempts + 1,
          updated_at = now()
      WHERE o.id IN (
        SELECT id
        FROM outbox_events
        WHERE status = 'PENDING'
          AND available_at <= now()
        ORDER BY available_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING o.*
    `);
    return rows.map(mapRow);
  }

  async markProcessed(id: string): Promise<void> {
    await this.db.$executeRaw`
      UPDATE outbox_events
      SET status = 'PROCESSED',
          dispatched_at = now(),
          locked_at = NULL,
          locked_by = NULL,
          last_error = NULL,
          updated_at = now()
      WHERE id = ${id}::uuid
    `;
  }

  async markFailed(
    id: string,
    error: string,
    backoffMs: number,
  ): Promise<FailResult> {
    const nextAvailableAt = new Date(Date.now() + backoffMs);
    const rows = await this.db.$queryRaw<
      Array<{ status: string; attempts: number }>
    >(Prisma.sql`
      UPDATE outbox_events
      SET status = (CASE
              WHEN attempts >= max_attempts THEN 'FAILED'
              ELSE 'PENDING'
            END)::"OutboxStatus",
          available_at = CASE
              WHEN attempts >= max_attempts THEN available_at
              ELSE ${nextAvailableAt}
            END,
          last_error = ${error},
          locked_at = NULL,
          locked_by = NULL,
          updated_at = now()
      WHERE id = ${id}::uuid
      RETURNING status::text AS status, attempts
    `);
    const row = rows[0];
    return {
      status: (row?.status as OutboxStatus) ?? "FAILED",
      attempts: row?.attempts ?? 0,
    };
  }

  async recoverStaleLeases(leaseMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - leaseMs);
    const rows = await this.db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE outbox_events
      SET status = (CASE
              WHEN attempts >= max_attempts THEN 'FAILED'
              ELSE 'PENDING'
            END)::"OutboxStatus",
          last_error = COALESCE(last_error, 'processing lease expired'),
          locked_at = NULL,
          locked_by = NULL,
          updated_at = now()
      WHERE status = 'PROCESSING'
        AND locked_at IS NOT NULL
        AND locked_at < ${cutoff}
      RETURNING id
    `);
    return rows.length;
  }

  async listFailed(limit: number): Promise<OutboxMessage[]> {
    const rows = await this.db.$queryRaw<OutboxRow[]>(Prisma.sql`
      SELECT * FROM outbox_events
      WHERE status = 'FAILED'
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `);
    return rows.map(mapRow);
  }

  async requeueFailed(id: string): Promise<OutboxMessage | null> {
    const rows = await this.db.$queryRaw<OutboxRow[]>(Prisma.sql`
      UPDATE outbox_events
      SET status = 'PENDING',
          attempts = 0,
          available_at = now(),
          last_error = NULL,
          locked_at = NULL,
          locked_by = NULL,
          updated_at = now()
      WHERE id = ${id}::uuid AND status = 'FAILED'
      RETURNING *
    `);
    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async requeueAllFailed(): Promise<number> {
    const result = await this.db.$executeRaw`
      UPDATE outbox_events
      SET status = 'PENDING',
          attempts = 0,
          available_at = now(),
          last_error = NULL,
          locked_at = NULL,
          locked_by = NULL,
          updated_at = now()
      WHERE status = 'FAILED'
    `;
    return Number(result);
  }

  async stats(): Promise<OutboxStats> {
    const rows = await this.db.$queryRaw<
      Array<{ status: string; count: bigint; oldest_pending: Date | null }>
    >(Prisma.sql`
      SELECT
        status::text AS status,
        COUNT(*)::bigint AS count,
        MIN(CASE WHEN status = 'PENDING' THEN created_at END) AS oldest_pending
      FROM outbox_events
      GROUP BY status
    `);
    const stats: OutboxStats = {
      pending: 0,
      processing: 0,
      processed: 0,
      failed: 0,
      oldestPendingAt: null,
    };
    for (const row of rows) {
      const count = Number(row.count);
      if (row.status === "PENDING") stats.pending = count;
      else if (row.status === "PROCESSING") stats.processing = count;
      else if (row.status === "PROCESSED") stats.processed = count;
      else if (row.status === "FAILED") stats.failed = count;
      if (row.oldest_pending) stats.oldestPendingAt = row.oldest_pending;
    }
    return stats;
  }
}
