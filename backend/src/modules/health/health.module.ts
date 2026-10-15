import type { Logger } from "pino";
import type { EventDispatcher } from "../../events/dispatcher/event-dispatcher.ts";
import { HealthService } from "./application/health.service.ts";
import { createHealthRouter } from "./presentation/health.routes.ts";

export interface HealthModuleDeps {
  dispatcher: EventDispatcher;
  logger: Logger;
}

/** Composition root of the health module. */
export function createHealthModule(deps: HealthModuleDeps) {
  const service = new HealthService(deps.dispatcher, deps.logger);
  return { router: createHealthRouter(service), service };
}
