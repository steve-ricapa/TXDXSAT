import { Router } from "express";
import type { HealthService } from "../application/health.service.ts";

/** Presentation layer: maps the health report to HTTP. */
export function createHealthRouter(service: HealthService): Router {
  const router = Router();

  router.get("/health", async (_req, res) => {
    const { report, healthy } = await service.check();
    res.status(healthy ? 200 : 503).json(report);
  });

  return router;
}
