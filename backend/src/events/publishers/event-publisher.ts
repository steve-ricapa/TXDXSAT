import type { DatabaseClient } from "../../shared/database/prisma.ts";
import type { DomainEvent } from "../contracts/domain-event.ts";

export interface PublishOptions {
  /**
   * When provided, the outbox row is written inside this transaction, making the
   * event atomic with the business change. When omitted the event is still
   * persisted durably, just not coupled to a surrounding transaction.
   */
  transaction?: DatabaseClient;
  /** Override the retry budget recorded on the outbox row. */
  maxAttempts?: number;
}

/**
 * Application-facing port for publishing domain events.
 *
 * Business code depends on this interface only. The current implementation
 * persists to the PostgreSQL transactional outbox; a future AWS implementation
 * (EventBridge/SQS) can satisfy the same contract.
 */
export interface EventPublisher {
  publish<T>(event: DomainEvent<T>, options?: PublishOptions): Promise<void>;
}
