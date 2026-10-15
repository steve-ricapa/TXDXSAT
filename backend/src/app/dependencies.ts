import type { Logger } from "pino";
import type { EventPublisher } from "../events/publishers/event-publisher.ts";
import type { EventDispatcher } from "../events/dispatcher/event-dispatcher.ts";
import type { EventBus } from "../events/bus/event-bus.ts";
import type { OutboxStore } from "../events/outbox/outbox.types.ts";

/**
 * Explicit composition root contract passed to `createApp`.
 *
 * Wiring lives only in `server.ts`; every module receives its collaborators here
 * instead of importing singletons, which keeps modules testable and free of
 * hidden dependencies.
 */
export interface AppDependencies {
  logger: Logger;
  publisher: EventPublisher;
  dispatcher: EventDispatcher;
  outboxStore: OutboxStore;
  bus: EventBus;
}

/** Subset used by the health module (kept narrow on purpose). */
export type HealthDeps = Pick<AppDependencies, "logger" | "dispatcher">;
