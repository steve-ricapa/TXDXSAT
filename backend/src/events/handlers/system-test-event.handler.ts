import { EventTypes, type SystemTestEventPayload } from "../contracts/event-types.ts";
import type { EventBus } from "../bus/event-bus.ts";
import type { EventHandler, HandlerContext } from "./event-handler.ts";
import type { DomainEvent } from "../contracts/domain-event.ts";

/**
 * Reference handler proving the outbox pipeline end-to-end.
 *
 * It is deliberately side-effect free (besides emitting on the ephemeral bus) so
 * it can be triggered repeatedly in any environment. Real handlers will perform
 * idempotent business work inside `context.tx`.
 */
export class SystemTestEventHandler implements EventHandler<SystemTestEventPayload> {
  readonly consumer = "system.test-event-handler";
  readonly eventTypes: readonly string[] = [EventTypes.SystemTestEvent];

  constructor(private readonly bus: EventBus) {}

  async handle(
    event: DomainEvent<SystemTestEventPayload>,
    context: HandlerContext,
  ): Promise<void> {
    const payload = event.payload as SystemTestEventPayload;

    if (payload?.simulateFailure === true) {
      throw new Error(
        `simulated handler failure for event ${event.eventId}`,
      );
    }

    context.logger.info(
      {
        eventId: event.eventId,
        eventType: event.eventType,
        tenantId: event.tenantId,
        correlationId: event.correlationId,
        message: payload?.message,
        workerId: context.workerId,
      },
      "system test event processed",
    );

    // Ephemeral fan-out for connected clients (not a durability mechanism).
    this.bus.emitDomainEvent(event as DomainEvent);
  }
}
