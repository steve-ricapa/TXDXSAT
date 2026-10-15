import type { Logger } from "pino";
import {
  AuthenticateUseCase,
  ChangePasswordUseCase,
  CreateUserUseCase,
  DeleteUserUseCase,
  ListUsersUseCase,
  LoginUseCase,
  LogoutUseCase,
  UpdateUserUseCase,
} from "./application/auth.usecases.ts";
import { AuthRepository } from "./infrastructure/auth.repository.ts";
import { createAuthMiddleware } from "./presentation/auth.middleware.ts";
import { createAuthRouter } from "./presentation/auth.routes.ts";

export interface AuthModuleDeps {
  logger: Logger;
}

/**
 * Composition root for the `auth` module.
 *
 * Returns the REST router plus the `requireAuth`/`optionalAuth`/`requireRole`
 * middleware so other modules can be guarded without importing auth internals.
 */
export function createAuthModule(_deps: AuthModuleDeps) {
  const store = new AuthRepository();
  const authenticate = new AuthenticateUseCase(store);
  const middleware = createAuthMiddleware(authenticate);

  const router = createAuthRouter({
    login: new LoginUseCase(store),
    logout: new LogoutUseCase(store),
    listUsers: new ListUsersUseCase(store),
    createUser: new CreateUserUseCase(store),
    updateUser: new UpdateUserUseCase(store),
    deleteUser: new DeleteUserUseCase(store),
    changePassword: new ChangePasswordUseCase(store),
    middleware,
  });

  return { router, middleware, authenticate, store };
}
