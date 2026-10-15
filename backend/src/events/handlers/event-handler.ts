import type { Logger } from "pino";
import type { TransactionClient } from "../../shared/database/prisma.ts";
import type { DomainEvent } from "../contracts/domain-event.ts";

/** Ambient resources handed to every handler invocation. */
export interface HandlerContext {
  /** Transaction the handler must use for all writes. It also records the
   *  idempotency marker atomically with the handler's side effects. */
  tx: TransactionClient;
  logger: Logger;
  /** Identity of the dispatcher worker processing this event. */
  workerId: string;
}

/**
 * A subscriber to one or more event types.
 *
 * Contract: delivery is **at-least-once**. The dispatcher guarantees a handler
 * never sees the same `eventId` twice *successfully* (an `EventConsumption` row is
 * written in the same transaction as the handler's writes), but a crash after
 * commit and before the outbox row is marked PROCESSED causes a replay. Handlers
 * must therefore be idempotent.
 */
export interface EventHandler<T = unknown> {
  /** Stable consumer identity; used as the idempotency key namespace. */
  readonly consumer: string;
  /** Event types this handler subscribes to (e.g. `system.test_event.v1`). */
  readonly eventTypes: readonly string[];
  handle(event: DomainEvent<T>, context: HandlerContext): Promise<void>;
}
