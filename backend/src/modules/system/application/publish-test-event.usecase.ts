import { z } from "zod";
import { EventTypes, createDomainEvent } from "../../../events/contracts/event-types.ts";
import type { SystemTestEventPayload } from "../../../events/contracts/event-types.ts";
import type { EventPublisher } from "../../../events/publishers/event-publisher.ts";
import { parseOrThrow } from "../../../shared/middleware/validate.ts";
import { isUuid } from "../../../shared/utils/id.ts";

export const publishTestEventSchema = z.object({
  message: z.string().min(1).max(500).default("hello from TXDXSAT"),
  tenantId: z.string().uuid().nullish(),
  simulateFailure: z.boolean().optional(),
  maxAttempts: z.coerce.number().int().min(1).max(20).optional(),
});

export type PublishTestEventInput = z.input<typeof publishTestEventSchema>;

export interface PublishTestEventResult {
  eventId: string;
  eventType: string;
  correlationId: string;
}

/**
 * Use case: publish the technical smoke-test event through the outbox.
 * Exercises the full publish → persist → dispatch → consume path.
 */
export class PublishTestEventUseCase {
  constructor(private readonly publisher: EventPublisher) {}

  async execute(input: PublishTestEventInput): Promise<PublishTestEventResult> {
    const data = parseOrThrow(publishTestEventSchema, input);

    const payload: SystemTestEventPayload = {
      message: data.message,
      issuedBy: "api:system",
      ...(data.simulateFailure !== undefined
        ? { simulateFailure: data.simulateFailure }
        : {}),
    };

    const event = createDomainEvent(EventTypes.SystemTestEvent, payload, {
      tenantId: isUuid(data.tenantId) ? data.tenantId : null,
    });

    await this.publisher.publish(event, {
      ...(data.maxAttempts !== undefined ? { maxAttempts: data.maxAttempts } : {}),
    });

    return {
      eventId: event.eventId,
      eventType: event.eventType,
      correlationId: event.correlationId,
    };
  }
}
