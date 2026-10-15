import type { DomainEvent } from "../contracts/domain-event.ts";

export type OutboxStatus = "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";

/** A persisted outbox message, as stored in PostgreSQL. */
export interface OutboxMessage {
  id: string;
  eventId: string;
  eventType: string;
  version: number;
  tenantId: string | null;
  payload: unknown;
  correlationId: string | null;
  causationId: string | null;
  occurredAt: Date;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  dispatchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields required to append a new outbox message. */
export interface NewOutboxMessage {
  eventId: string;
  eventType: string;
  version: number;
  tenantId: string | null;
  payload: unknown;
  correlationId: string | null;
  causationId: string | null;
  occurredAt: Date;
  maxAttempts: number;
}

export interface OutboxStats {
  pending: number;
  processing: number;
  processed: number;
  failed: number;
  oldestPendingAt: Date | null;
}

/** Outcome of attempting to mark a message processed or schedule a retry. */
export interface FailResult {
  status: OutboxStatus;
  attempts: number;
}

/**
 * Persistence port for the transactional outbox.
 *
 * The dispatcher and publishers depend on this interface, not on Prisma. A future
 * AWS transport could provide an SQS/EventBridge-backed implementation without the
 * application layer changing.
 */
export interface OutboxStore {
  /** Append within a caller-provided transaction (atomic with business writes). */
  append(message: NewOutboxMessage, tx: unknown): Promise<OutboxMessage>;

  /** Atomically claim up to `limit` due messages for `workerId`. */
  claimBatch(workerId: string, limit: number): Promise<OutboxMessage[]>;

  markProcessed(id: string): Promise<void>;

  /** Record a failure; schedules a retry or moves to the terminal FAILED state. */
  markFailed(id: string, error: string, backoffMs: number): Promise<FailResult>;

  /** Return messages whose lease expired (crashed worker) to PENDING/FAILED. */
  recoverStaleLeases(leaseMs: number): Promise<number>;

  listFailed(limit: number): Promise<OutboxMessage[]>;

  requeueFailed(id: string): Promise<OutboxMessage | null>;

  requeueAllFailed(): Promise<number>;

  stats(): Promise<OutboxStats>;
}

/** Rebuild a domain event from its persisted form. */
export function outboxMessageToEvent(message: OutboxMessage): DomainEvent {
  return {
    eventId: message.eventId,
    eventType: message.eventType,
    version: message.version,
    tenantId: message.tenantId,
    occurredAt: message.occurredAt.toISOString(),
    payload: message.payload,
    correlationId: message.correlationId ?? message.eventId,
    causationId: message.causationId,
  };
}
