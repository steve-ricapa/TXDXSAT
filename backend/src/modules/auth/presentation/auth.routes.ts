import { Router, type Request, type RequestHandler, type Response } from "express";
import type { AuthenticatedRequest } from "./auth.middleware.ts";
import type { AuthMiddleware } from "./auth.middleware.ts";
import { NotFoundError, UnauthorizedError } from "../../../shared/errors/app-error.ts";
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
 * There is no registration endpoint: accounts are created exclusively by a
 * SUPERADMIN through `POST /users`.
 */
export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const { requireAuth, requireRole } = deps.middleware;
  const superadminOnly: RequestHandler[] = [requireAuth, requireRole("SUPERADMIN")];

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
