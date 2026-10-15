import { Router } from "express";
import type {
  InspectOutboxUseCase,
  ListFailedEventsUseCase,
  RequeueFailedEventUseCase,
} from "../application/outbox.usecases.ts";
import type { PublishTestEventUseCase } from "../application/publish-test-event.usecase.ts";
import { currentCorrelationId } from "../../../shared/middleware/request-context.ts";

export interface SystemRouterDeps {
  publishTestEvent: PublishTestEventUseCase;
  inspectOutbox: InspectOutboxUseCase;
  listFailedEvents: ListFailedEventsUseCase;
  requeueFailedEvent: RequeueFailedEventUseCase;
}

/**
 * Operational endpoints for the event pipeline.
 *
 * These are unauthenticated in Fase 1 and exist to observe/verify the outbox.
 * Authentication and role gating are added in a later phase; until then they must
 * not be treated as a public API surface.
 */
export function createSystemRouter(deps: SystemRouterDeps): Router {
  const router = Router();

  // Publish the technical smoke-test event through the outbox.
  router.post("/test-event", async (req, res) => {
    const result = await deps.publishTestEvent.execute(req.body ?? {});
    res.status(202).json({ ...result, correlationId: currentCorrelationId() });
  });

  // Inspect outbox counters, dispatcher state and recently processed events.
  router.get("/outbox", async (_req, res) => {
    res.json(await deps.inspectOutbox.execute());
  });

  // List terminal FAILED events awaiting manual recovery.
  router.get("/outbox/failed", async (req, res) => {
    const limit = Number.parseInt(String(req.query["limit"] ?? "50"), 10);
    const events = await deps.listFailedEvents.execute(
      Number.isNaN(limit) ? 50 : limit,
    );
    res.json({ events, count: events.length });
  });

  // Requeue a single parked event.
  router.post("/outbox/:id/requeue", async (req, res) => {
    const event = await deps.requeueFailedEvent.execute(String(req.params.id));
    res.json({ event });
  });

  // Requeue every parked event (recovery after a handler bug fix).
  router.post("/outbox/requeue-failed", async (_req, res) => {
    res.json(await deps.requeueFailedEvent.executeAll());
  });

  return router;
}
