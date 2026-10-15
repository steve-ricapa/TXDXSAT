import { prisma } from "../../shared/database/prisma.ts";
import type { DomainEvent } from "../contracts/domain-event.ts";
import type { NewOutboxMessage, OutboxStore } from "../outbox/outbox.types.ts";
import type { EventPublisher, PublishOptions } from "./event-publisher.ts";

/**
 * Publishes events by appending them to the transactional outbox.
 *
 * Pass `options.transaction` to make the append atomic with the business change.
 * Without it, the append still commits durably on its own connection.
 */
export class OutboxEventPublisher implements EventPublisher {
  constructor(
    private readonly store: OutboxStore,
    private readonly defaultMaxAttempts = 10,
  ) {}

  async publish<T>(
    event: DomainEvent<T>,
    options: PublishOptions = {},
  ): Promise<void> {
    const message: NewOutboxMessage = {
      eventId: event.eventId,
      eventType: event.eventType,
      version: event.version,
      tenantId: event.tenantId,
      payload: event.payload,
      correlationId: event.correlationId,
      causationId: event.causationId ?? null,
      occurredAt: new Date(event.occurredAt),
      maxAttempts: options.maxAttempts ?? this.defaultMaxAttempts,
    };

    await this.store.append(message, options.transaction ?? prisma);
  }
}
