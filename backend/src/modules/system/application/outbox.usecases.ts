import type { EventDispatcher } from "../../../events/dispatcher/event-dispatcher.ts";
import type { EventBus } from "../../../events/bus/event-bus.ts";
import type { OutboxStore } from "../../../events/outbox/outbox.types.ts";
import type { OutboxMessage } from "../../../events/outbox/outbox.types.ts";
import { NotFoundError } from "../../../shared/errors/app-error.ts";

export interface OutboxInspection {
  stats: Awaited<ReturnType<OutboxStore["stats"]>>;
  dispatcher: {
    running: boolean;
    workerId: string;
    ticks: number;
    lastRunAt: string | null;
    lastError: string | null;
  };
  /** Recently processed events observed on the ephemeral bus (for demo/ops). */
  recentProcessed: DomainEventSummary[];
}

export interface DomainEventSummary {
  eventId: string;
  eventType: string;
  tenantId: string | null;
  occurredAt: string;
}

const MAX_RECENT = 20;

/**
 * Use case: operational view of the outbox plus a rolling window of events the
 * local dispatcher has processed. Handy for verifying the pipeline end-to-end
 * and for a future ops dashboard.
 */
export class InspectOutboxUseCase {
  private readonly recent: DomainEventSummary[] = [];

  constructor(
    private readonly store: OutboxStore,
    private readonly dispatcher: EventDispatcher,
    bus: EventBus,
  ) {
    bus.on("domain:*", (event) => {
      const e = event as { eventId?: string; eventType?: string; tenantId?: string | null; occurredAt?: string };
      if (!e.eventId || !e.eventType) return;
      this.recent.unshift({
        eventId: e.eventId,
        eventType: e.eventType,
        tenantId: e.tenantId ?? null,
        occurredAt: e.occurredAt ?? new Date().toISOString(),
      });
      if (this.recent.length > MAX_RECENT) this.recent.length = MAX_RECENT;
    });
  }

  async execute(): Promise<OutboxInspection> {
    const [stats, dispatcherStats] = await Promise.all([
      this.store.stats(),
      this.dispatcher.stats(),
    ]);
    return {
      stats,
      dispatcher: {
        running: dispatcherStats.running,
        workerId: dispatcherStats.workerId,
        ticks: dispatcherStats.ticks,
        lastRunAt: dispatcherStats.lastRunAt,
        lastError: dispatcherStats.lastError,
      },
      recentProcessed: [...this.recent],
    };
  }
}

/** Use case: list parked (terminal FAILED) events. */
export class ListFailedEventsUseCase {
  constructor(private readonly store: OutboxStore) {}

  async execute(limit = 50): Promise<OutboxMessage[]> {
    return this.store.listFailed(Math.min(Math.max(limit, 1), 200));
  }
}

/** Use case: manually requeue a parked event (recovery mechanism). */
export class RequeueFailedEventUseCase {
  constructor(private readonly store: OutboxStore) {}

  async execute(id: string): Promise<OutboxMessage> {
    const requeued = await this.store.requeueFailed(id);
    if (!requeued) throw new NotFoundError("Failed event not found");
    return requeued;
  }

  async executeAll(): Promise<{ requeued: number }> {
    const requeued = await this.store.requeueAllFailed();
    return { requeued };
  }
}
