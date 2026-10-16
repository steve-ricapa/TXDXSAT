import { Router, type NextFunction, type Request, type Response } from "express";
import { createHealthModule } from "../modules/health/health.module.ts";
import { createSystemModule } from "../modules/system/system.module.ts";
import { createMediaModule } from "../modules/media/media.module.ts";
import { createAuthModule } from "../modules/auth/auth.module.ts";
import { createLiveSessionModule } from "../modules/live-sessions/live-sessions.module.ts";
import { createTenantsModule } from "../modules/tenants/tenants.module.ts";
import type { AppDependencies } from "./dependencies.ts";

/**
 * API v1 router. Composes every feature module under a single versioned prefix.
 *
 * Adding a domain module means adding one `createXModule()` call here; modules
 * never import each other, which keeps the dependency graph acyclic.
 *
 * Guarding model:
 *   * `/health`, `/system` and the auth `login` endpoint are public;
 *   * everything else requires a valid session (Authorization: Bearer);
 *   * scope exceptions are the capability-URL image read (`GET /media/:id`) and
 *     the token-protected game results (`GET /live/sessions/:id/results`), which
 *     are reached by hosts/presenters holding a capability token.
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

  const auth = createAuthModule({ logger: deps.logger });

  const live = createLiveSessionModule({
    logger: deps.logger,
    publisher: deps.publisher,
  });

  const media = createMediaModule({ logger: deps.logger });

  const tenants = createTenantsModule();

  const { requireAuth, requireRole } = auth.middleware;

  router.use(health.router);
  router.use("/system", system.router);
  router.use("/auth", auth.router);
  router.use("/tenants", requireAuth, requireRole("ADMIN", "SUPERADMIN"), tenants.router);

  // Images: the by-id read is an unguessable capability URL used inside <img>
  // tags; listing, uploading and deleting are authoring operations.
  router.use(
    "/media",
    publicWhen((req) => req.method === "GET" && req.path !== "/" && req.path !== "", requireAuth),
    media.router,
  );

  // Only the platform superadmin can author quizzes or open sessions. Result
  // URLs keep their capability-token guard for host/presenter compatibility.
  router.use(
    "/live",
    publicWhen(
      (req) => req.method === "GET" && /^\/sessions\/[^/]+\/results\/?$/.test(req.path),
      requireAuth,
    ),
    publicWhen(
      (req) => req.method === "GET" && (/^\/sessions\/[^/]+\/results\/?$/.test(req.path) || /^\/me\/results\/?$/.test(req.path)),
      requireRole("SUPERADMIN"),
    ),
    live.router,
  );

  return router;
}

/**
 * Apply `guard` to every request except the ones matched by `isPublic`. The
 * Express mount path is stripped before the check, so `req.path` is relative to
 * the mount point.
 */
function publicWhen(
  isPublic: (req: Request) => boolean,
  guard: (req: Request, res: Response, next: NextFunction) => void,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (isPublic(req)) return next();
    guard(req, res, next);
  };
}
