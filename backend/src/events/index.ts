// Contracts
export type { DomainEvent, DomainEventMetadata } from "./contracts/domain-event.ts";
export {
  EventTypes,
  createDomainEvent,
  parseVersion,
} from "./contracts/event-types.ts";
export type {
  DomainEventPayloadMap,
  KnownEventType,
  SystemEventType,
  SystemTestEventPayload,
} from "./contracts/event-types.ts";

// Outbox (persistence port + Prisma implementation)
export { PrismaOutboxStore } from "./outbox/outbox.store.ts";
export { outboxMessageToEvent } from "./outbox/outbox.types.ts";
export type {
  FailResult,
  NewOutboxMessage,
  OutboxMessage,
  OutboxStats,
  OutboxStatus,
  OutboxStore,
} from "./outbox/outbox.types.ts";

// Publishers
export type { EventPublisher, PublishOptions } from "./publishers/event-publisher.ts";
export { OutboxEventPublisher } from "./publishers/outbox-event-publisher.ts";

// Handlers
export type { EventHandler, HandlerContext } from "./handlers/event-handler.ts";
export { EventHandlerRegistry } from "./handlers/handler-registry.ts";
export { SystemTestEventHandler } from "./handlers/system-test-event.handler.ts";

// Dispatcher
export type {
  DispatchTickResult,
  DispatcherStats,
  EventDispatcher,
} from "./dispatcher/event-dispatcher.ts";
export type { OutboxDispatcherOptions } from "./dispatcher/outbox-dispatcher.ts";
export { OutboxEventDispatcher } from "./dispatcher/outbox-dispatcher.ts";

// Ephemeral in-process bus
export { BusChannels, EventBus } from "./bus/event-bus.ts";
