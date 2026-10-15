/**
 * Canonical, transport-agnostic domain event envelope.
 *
 * Business code depends only on this shape — never on Express, Socket.IO,
 * EventBridge, SQS or the outbox table. The envelope is serialised verbatim into
 * the transactional outbox and is the same object that a future AWS transport
 * (EventBridge/SQS) would carry in its message body.
 */
export interface DomainEvent<T = unknown> {
  /** Stable identity of this event occurrence (UUID). Idempotency key. */
  eventId: string;
  /** Versioned type name, e.g. `training.assigned.v1`. */
  eventType: string;
  /** Schema version of the payload (mirrors the `.vN` suffix). */
  version: number;
  /** Owning tenant (company) or `null` for platform-level events. */
  tenantId: string | null;
  /** ISO-8601 timestamp of when the fact occurred. */
  occurredAt: string;
  /** Event-specific data. */
  payload: T;
  /** Ties together all events/work produced by one logical operation. */
  correlationId: string;
  /** Optional id of the event/command that caused this one. */
  causationId?: string | null;
}

/** Metadata used to build an event without repeating plumbing fields. */
export interface DomainEventMetadata {
  tenantId?: string | null;
  correlationId?: string;
  causationId?: string | null;
  occurredAt?: string;
  eventId?: string;
}
