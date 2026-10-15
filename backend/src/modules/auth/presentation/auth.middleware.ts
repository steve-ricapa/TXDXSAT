import type { NextFunction, Request, RequestHandler, Response } from "express";
import { UnauthorizedError, ForbiddenError } from "../../../shared/errors/app-error.ts";
import type { AuthUser, UserRole } from "../domain/types.ts";
import type { AuthenticateUseCase } from "../application/auth.usecases.ts";

/** Request augmented with the authenticated principal. */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  sessionToken?: string;
}

/** Extract a bearer token from the `Authorization` header. */
export function bearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = value.trim();
  return token.length > 0 ? token : null;
}

export interface AuthMiddleware {
  /** Resolve the bearer token and attach the user; 401 when absent/invalid. */
  requireAuth: RequestHandler;
  /** Like `requireAuth` but anonymous requests continue unauthenticated. */
  optionalAuth: RequestHandler;
  /** Must run after `requireAuth`; rejects roles outside `roles`. */
  requireRole: (...roles: UserRole[]) => RequestHandler;
}

export function createAuthMiddleware(authenticate: AuthenticateUseCase): AuthMiddleware {
  const resolve = async (req: Request): Promise<AuthUser> => {
    const token = bearerToken(req);
    const user = await authenticate.execute(token);
    const authReq = req as AuthenticatedRequest;
    authReq.user = user;
    authReq.sessionToken = token ?? undefined;
    return user;
  };

  const requireAuth: RequestHandler = (req, _res, next) => {
    resolve(req).then(
      () => next(),
      (error: unknown) => next(error),
    );
  };

  const optionalAuth: RequestHandler = (req, _res, next) => {
    resolve(req).then(
      () => next(),
      (error: unknown) => {
        // Anonymous requests are fine; only invalid tokens are rejected.
        if (error instanceof UnauthorizedError) return next();
        next(error);
      },
    );
  };

  const requireRole =
    (...roles: UserRole[]): RequestHandler =>
    (req: Request, _res: Response, next: NextFunction) => {
      const user = (req as AuthenticatedRequest).user;
      if (!user) return next(new UnauthorizedError());
      if (!roles.includes(user.role)) {
        return next(new ForbiddenError("Your role is not allowed to perform this action"));
      }
      next();
    };

  return { requireAuth, optionalAuth, requireRole };
}
