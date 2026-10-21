import { Router, type Request, type RequestHandler, type Response } from "express";
import type { AuthenticatedRequest } from "./auth.middleware.ts";
import type { AuthMiddleware } from "./auth.middleware.ts";
import { NotFoundError, TooManyRequestsError, UnauthorizedError, ValidationError } from "../../../shared/errors/app-error.ts";
import {
  createEnrollmentInvite,
  decideEnrollment,
  getEnrollmentInvite,
  listEnrollmentInvites,
  listPendingEnrollments,
  listTenantEmployees,
  registerFromInvite,
  revokeEnrollmentInvite,
} from "../application/enrollment.ts";
import { isUuid } from "../../../shared/utils/id.ts";
import type { AuthUser } from "../domain/types.ts";
import type {
  ChangePasswordUseCase,
  CreateUserUseCase,
  DeleteUserUseCase,
  ListUsersUseCase,
  LoginUseCase,
  LogoutUseCase,
  UpdateUserUseCase,
} from "../application/auth.usecases.ts";

export interface AuthRouterDeps {
  login: LoginUseCase;
  logout: LogoutUseCase;
  listUsers: ListUsersUseCase;
  createUser: CreateUserUseCase;
  updateUser: UpdateUserUseCase;
  deleteUser: DeleteUserUseCase;
  changePassword: ChangePasswordUseCase;
  middleware: AuthMiddleware;
}

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

function currentUser(req: Request): AuthUser {
  const user = (req as AuthenticatedRequest).user;
  if (!user) throw new UnauthorizedError();
  return user;
}

function clientIp(req: Request): string | null {
  const ip = req.ip ?? req.socket.remoteAddress ?? null;
  return ip && ip.length <= 45 ? ip : null;
}

function routeId(req: Request): string {
  const id = String(req.params.id);
  if (!isUuid(id)) throw new NotFoundError("User not found");
  return id;
}

/**
 * REST surface of the auth module (mounted at `/api/v1/auth`).
 *
 * Direct account creation remains restricted to SUPERADMIN. Enrollment links
 * can only create inactive EMPLOYEE accounts pending tenant approval.
 */
export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const { requireAuth, requireRole } = deps.middleware;
  const superadminOnly: RequestHandler[] = [requireAuth, requireRole("SUPERADMIN")];
  const managerOnly: RequestHandler[] = [requireAuth, requireRole("ADMIN", "SUPERADMIN")];
  const attempts = new Map<string, { count: number; until: number }>();
  const limitRegistration: RequestHandler = (req, _res, next) => {
    const key = clientIp(req) ?? "unknown";
    const now = Date.now();
    const current = attempts.get(key);
    const nextAttempt = !current || current.until < now ? { count: 1, until: now + 15 * 60_000 } : { count: current.count + 1, until: current.until };
    attempts.set(key, nextAttempt);
    if (attempts.size > 5000) for (const [ip, value] of attempts) if (value.until < now) attempts.delete(ip);
    if (nextAttempt.count > 500) return next(new TooManyRequestsError("Demasiados intentos de registro. Espera unos minutos."));
    next();
  };

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const result = await deps.login.execute(req.body, {
        userAgent: req.header("user-agent") ?? null,
        ip: clientIp(req),
      });
      res.json(result);
    }),
  );

  router.get("/enrollment/:token", asyncHandler(async (req, res) => {
    res.json(await getEnrollmentInvite(String(req.params.token)));
  }));

  router.post("/enrollment/:token", limitRegistration, asyncHandler(async (req, res) => {
    res.status(201).json(await registerFromInvite(String(req.params.token), req.body));
  }));

  router.get("/enrollment-invites", ...managerOnly, asyncHandler(async (req, res) => {
    const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
    res.json({ invites: await listEnrollmentInvites(currentUser(req), tenantId) });
  }));

  router.post("/enrollment-invites", ...managerOnly, asyncHandler(async (req, res) => {
    res.status(201).json(await createEnrollmentInvite(currentUser(req), req.body));
  }));

  router.delete("/enrollment-invites/:id", ...managerOnly, asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!isUuid(id)) throw new ValidationError("Invitación inválida");
    await revokeEnrollmentInvite(currentUser(req), id);
    res.status(204).end();
  }));

  router.get("/enrollments/pending", ...managerOnly, asyncHandler(async (req, res) => {
    const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
    res.json({ users: await listPendingEnrollments(currentUser(req), tenantId) });
  }));

  router.get("/enrollments/users", ...managerOnly, asyncHandler(async (req, res) => {
    const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
    res.json({ users: await listTenantEmployees(currentUser(req), tenantId) });
  }));

  router.post("/enrollments/:id/decision", ...managerOnly, asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!isUuid(id) || (req.body?.decision !== "approve" && req.body?.decision !== "reject")) throw new ValidationError("Decisión inválida");
    await decideEnrollment(currentUser(req), id, req.body.decision);
    res.status(204).end();
  }));

  router.post(
    "/logout",
    requireAuth,
    asyncHandler(async (req, res) => {
      await deps.logout.execute((req as AuthenticatedRequest).sessionToken ?? null);
      res.status(204).end();
    }),
  );

  router.get(
    "/me",
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ user: currentUser(req) });
    }),
  );

  router.post(
    "/me/password",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      await deps.changePassword.execute(
        user.id,
        req.body,
        (req as AuthenticatedRequest).sessionToken ?? null,
      );
      res.status(204).end();
    }),
  );

  router.get(
    "/users",
    ...superadminOnly,
    asyncHandler(async (req, res) => {
      const raw = req.query.tenantId;
      let filter: { tenantId?: string | null } = {};
      if (typeof raw === "string") {
        if (raw === "shared") filter = { tenantId: null };
        else if (isUuid(raw)) filter = { tenantId: raw };
      }
      const users = await deps.listUsers.execute(filter);
      res.json({ users });
    }),
  );

  router.post(
    "/users",
    ...superadminOnly,
    asyncHandler(async (req, res) => {
      const user = await deps.createUser.execute(req.body);
      res.status(201).json({ user });
    }),
  );

  router.patch(
    "/users/:id",
    ...superadminOnly,
    asyncHandler(async (req, res) => {
      const user = await deps.updateUser.execute(routeId(req), req.body, currentUser(req));
      res.json({ user });
    }),
  );

  router.delete(
    "/users/:id",
    ...superadminOnly,
    asyncHandler(async (req, res) => {
      await deps.deleteUser.execute(routeId(req), currentUser(req));
      res.status(204).end();
    }),
  );

  return router;
}
