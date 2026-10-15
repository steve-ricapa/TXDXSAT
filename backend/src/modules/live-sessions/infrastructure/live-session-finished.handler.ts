import type { EventBus } from "../../../events/bus/event-bus.ts";
import type { DomainEvent } from "../../../events/contracts/domain-event.ts";
import {
  EventTypes,
  type LiveSessionFinishedPayload,
} from "../../../events/contracts/event-types.ts";
import type { EventHandler, HandlerContext } from "../../../events/handlers/event-handler.ts";

/**
 * Durable consumer of `live_session.finished.v1`.
 *
 * The dispatch path writes an `EventConsumption` marker in the same transaction
 * as this handler, so replays are safe. For Fase 2 the handler records the
 * consolidated result in the log stream and mirrors it on the ephemeral bus for
 * connected clients; later phases will fan this out to reporting/notifications
 * (the payload already carries the full leaderboard).
 */
export class LiveSessionFinishedHandler
  implements EventHandler<LiveSessionFinishedPayload>
{
  readonly consumer = "live-sessions.finished-handler";
  readonly eventTypes: readonly string[] = [EventTypes.LiveSessionFinished];

  constructor(private readonly bus: EventBus) {}

  async handle(
    event: DomainEvent<LiveSessionFinishedPayload>,
    context: HandlerContext,
  ): Promise<void> {
    const payload = event.payload as LiveSessionFinishedPayload;
    context.logger.info(
      {
        eventId: event.eventId,
        tenantId: event.tenantId,
        correlationId: event.correlationId,
        sessionId: payload?.sessionId,
        quizId: payload?.quizId,
        participantCount: payload?.participantCount,
        winner: payload?.leaderboard?.[0]?.username ?? null,
        workerId: context.workerId,
      },
      "live session results consolidated",
    );

    this.bus.emitDomainEvent(event as DomainEvent);
  }
}
