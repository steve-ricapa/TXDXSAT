import { Router } from "express";
import { createHealthModule } from "../modules/health/health.module.ts";
import { createSystemModule } from "../modules/system/system.module.ts";
import { createMediaModule } from "../modules/media/media.module.ts";
import { createLiveSessionModule } from "../modules/live-sessions/live-sessions.module.ts";
import type { AppDependencies } from "./dependencies.ts";

/**
 * API v1 router. Composes every feature module under a single versioned prefix.
 *
 * Adding a domain module means adding one `createXModule()` call here; modules
 * never import each other, which keeps the dependency graph acyclic.
 */
export function createApiRouter(deps: AppDependencies): Router {
  const router = Router();

  const health = createHealthModule({
    dispatcher: deps.dispatcher,
    logger: deps.logger,
  });

  const system = createSystemModule({
    publisher: deps.publisher,
    store: deps.outboxStore,
    dispatcher: deps.dispatcher,
    bus: deps.bus,
  });

  const live = createLiveSessionModule({
    logger: deps.logger,
    publisher: deps.publisher,
  });

  const media = createMediaModule({ logger: deps.logger });

  router.use(health.router);
  router.use("/system", system.router);
  router.use("/media", media.router);
  router.use("/live", live.router);

  return router;
}
