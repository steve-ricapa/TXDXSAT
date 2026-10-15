import type { EventBus } from "../../events/bus/event-bus.ts";
import type { EventDispatcher } from "../../events/dispatcher/event-dispatcher.ts";
import type { OutboxStore } from "../../events/outbox/outbox.types.ts";
import type { EventPublisher } from "../../events/publishers/event-publisher.ts";
import {
  InspectOutboxUseCase,
  ListFailedEventsUseCase,
  RequeueFailedEventUseCase,
} from "./application/outbox.usecases.ts";
import { PublishTestEventUseCase } from "./application/publish-test-event.usecase.ts";
import { createSystemRouter } from "./presentation/system.routes.ts";

export interface SystemModuleDeps {
  publisher: EventPublisher;
  store: OutboxStore;
  dispatcher: EventDispatcher;
  bus: EventBus;
}

/** Composition root of the system (operations) module. */
export function createSystemModule(deps: SystemModuleDeps) {
  const useCases = {
    publishTestEvent: new PublishTestEventUseCase(deps.publisher),
    inspectOutbox: new InspectOutboxUseCase(deps.store, deps.dispatcher, deps.bus),
    listFailedEvents: new ListFailedEventsUseCase(deps.store),
    requeueFailedEvent: new RequeueFailedEventUseCase(deps.store),
  };

  return { router: createSystemRouter(useCases), useCases };
}
