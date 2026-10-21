import { z } from "zod";
import { env } from "../../../shared/config/env.ts";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../../shared/errors/app-error.ts";
import { parseOrThrow } from "../../../shared/middleware/validate.ts";
import { hashPassword, verifyPassword } from "../../../shared/utils/password.ts";
import { generateToken, hashToken } from "../../../shared/utils/token.ts";
import {
  USER_ROLES,
  type AuthUser,
  type UserRole,
} from "../domain/types.ts";
import type { AuthStore } from "./auth.ports.ts";

// ---------------------------------------------------------------------------
// Validation schemas (shared with the HTTP layer)
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .email("Invalid email address")
  .transform((value) => value.toLowerCase());

/** Minimum viable password policy: length and a little variety. */
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(200),
});

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(120),
  role: z.enum(USER_ROLES).default("ADMIN"),
  tenantId: z.string().uuid().nullish(),
}).refine((value) => value.role !== "EMPLOYEE" || !!value.tenantId, {
  message: "Employee accounts require a tenant ID",
  path: ["tenantId"],
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
    tenantId: z.string().uuid().nullish(),
    password: passwordSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export const listUsersQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

// ---------------------------------------------------------------------------
// Use cases
// ---------------------------------------------------------------------------

/** Use case: exchange email + password for an opaque session token. */
export class LoginUseCase {
  constructor(private readonly store: AuthStore) {}

  async execute(input: { email: string; password: string }, context: {
    userAgent: string | null;
    ip: string | null;
  }): Promise<LoginResult> {
    const parsed = parseOrThrow(loginSchema, input);
    const user = await this.store.findUserByEmail(parsed.email);

    // Always run a comparison-shaped path to avoid leaking which emails exist.
    const invalid = () => new UnauthorizedError("Invalid email or password");
    if (!user) {
      await verifyPassword(parsed.password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
      throw invalid();
    }

    const matches = await verifyPassword(parsed.password, user.passwordHash);
    if (!matches) throw invalid();
    if (user.enrollmentStatus === "PENDING") throw new ForbiddenError("Tu solicitud de registro está pendiente de aprobación");
    if (user.enrollmentStatus === "REJECTED") throw new ForbiddenError("Tu solicitud de registro fue rechazada");
    if (!user.isActive) throw new ForbiddenError("Esta cuenta está desactivada");

    const token = generateToken();
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

    const session = await this.store.createSession({
      userId: user.id,
      tokenHash: hashToken(token),
      userAgent: context.userAgent,
      ip: context.ip,
      expiresAt,
    });
    await this.store.touchLastLogin(user.id);

    const { passwordHash: _passwordHash, ...rest } = user;
    const safeUser: AuthUser = { ...rest, lastLoginAt: new Date().toISOString() };
    return { token, expiresAt: session.expiresAt, user: safeUser };
  }
}

/** Use case: resolve a bearer token into an authenticated user. */
export class AuthenticateUseCase {
  constructor(private readonly store: AuthStore) {}

  async execute(token: string | null | undefined): Promise<AuthUser> {
    if (!token) throw new UnauthorizedError();
    const lookup = await this.store.findSessionByTokenHash(hashToken(token));
    if (!lookup) throw new UnauthorizedError("Invalid or expired session");
    if (lookup.session.revokedAt) throw new UnauthorizedError("Session was revoked");
    if (new Date(lookup.session.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedError("Session expired");
    }
    if (!lookup.user.isActive) throw new ForbiddenError("This account is disabled");
    return lookup.user;
  }
}

/** Use case: revoke the session behind a bearer token. */
export class LogoutUseCase {
  constructor(private readonly store: AuthStore) {}

  async execute(token: string | null | undefined): Promise<void> {
    if (!token) return;
    await this.store.revokeSessionByTokenHash(hashToken(token));
  }
}

/** Use case: list accounts (SUPERADMIN). */
export class ListUsersUseCase {
  constructor(private readonly store: AuthStore) {}

  execute(filter: { tenantId?: string | null }): Promise<AuthUser[]> {
    return this.store.listUsers(filter);
  }
}

/**
 * Use case: create an account (SUPERADMIN only).
 *
 * Invited collaborators can also request an inactive account; only this use
 * case creates immediately active accounts.
 */
export class CreateUserUseCase {
  constructor(private readonly store: AuthStore) {}

  async execute(input: unknown): Promise<AuthUser> {
    const parsed = parseOrThrow(createUserSchema, input);
    const existing = await this.store.findUserByEmail(parsed.email);
    if (existing) throw new ConflictError("An account with that email already exists");
    if (parsed.tenantId && !await this.store.tenantExists(parsed.tenantId)) {
      throw new ValidationError("La organización seleccionada no existe");
    }

    const passwordHash = await hashPassword(parsed.password);
    return this.store.createUser({
      tenantId: parsed.tenantId ?? null,
      email: parsed.email,
      passwordHash,
      name: parsed.name,
      role: parsed.role as UserRole,
    });
  }
}

/** Use case: edit an account (SUPERADMIN only). */
export class UpdateUserUseCase {
  constructor(private readonly store: AuthStore) {}

  async execute(
    id: string,
    input: unknown,
    actor: AuthUser,
  ): Promise<AuthUser> {
    const target = await this.store.findUserById(id);
    if (!target) throw new NotFoundError("User not found");
    const patch = parseOrThrow(updateUserSchema, input);
    if (target.enrollmentStatus !== "APPROVED" &&
      (patch.isActive === true || (patch.role !== undefined && patch.role !== "EMPLOYEE") ||
        (patch.tenantId !== undefined && patch.tenantId !== target.tenantId))) {
      throw new ValidationError("Las solicitudes deben aprobarse desde Invitaciones y registros");
    }

    // A superadmin must not strand the platform without an operator, and must
    // not lock themselves out by mistake.
    if (target.role === "SUPERADMIN" && ((patch.role !== undefined && patch.role !== "SUPERADMIN") || patch.isActive === false)) {
      await this.assertNotLastSuperadmin(target.id);
      if (target.id === actor.id) {
        throw new ValidationError("You cannot demote or disable your own account");
      }
    }
    if ((patch.role ?? target.role) === "EMPLOYEE" && !(patch.tenantId !== undefined ? patch.tenantId : target.tenantId)) {
      throw new ValidationError("Employee accounts require a tenant ID");
    }
    if (patch.tenantId && !await this.store.tenantExists(patch.tenantId)) {
      throw new ValidationError("La organización seleccionada no existe");
    }

    const update: Parameters<AuthStore["updateUser"]>[1] = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.role !== undefined) update.role = patch.role as UserRole;
    if (patch.isActive !== undefined) update.isActive = patch.isActive;
    if (patch.tenantId !== undefined) update.tenantId = patch.tenantId ?? null;
    if (patch.password !== undefined) update.passwordHash = await hashPassword(patch.password);

    return this.store.updateUser(id, update);
  }

  private async assertNotLastSuperadmin(excludingId: string): Promise<void> {
    const total = await this.store.countSuperadmins();
    const target = await this.store.findUserById(excludingId);
    if (target?.role === "SUPERADMIN" && total <= 1) {
      throw new ValidationError("At least one active superadmin must remain");
    }
  }
}

/** Use case: remove an account (SUPERADMIN only). */
export class DeleteUserUseCase {
  constructor(private readonly store: AuthStore) {}

  async execute(id: string, actor: AuthUser): Promise<void> {
    const target = await this.store.findUserById(id);
    if (!target) throw new NotFoundError("User not found");
    if (target.id === actor.id) {
      throw new ValidationError("You cannot delete your own account");
    }
    if (target.role === "SUPERADMIN") {
      const total = await this.store.countSuperadmins();
      if (total <= 1) throw new ValidationError("At least one superadmin must remain");
    }
    if (await this.store.hasUserActivity(id)) {
      throw new ValidationError("No se puede eliminar una cuenta con participación en sesiones; desactívala en su lugar");
    }
    await this.store.deleteUser(id);
  }
}

/** Use case: a user changes their own password. */
export class ChangePasswordUseCase {
  constructor(private readonly store: AuthStore) {}

  async execute(
    userId: string,
    input: unknown,
    currentToken: string | null,
  ): Promise<void> {
    const parsed = parseOrThrow(changePasswordSchema, input);
    const user = await this.store.findUserById(userId);
    if (!user) throw new NotFoundError("User not found");

    const matches = await verifyPassword(parsed.currentPassword, user.passwordHash);
    if (!matches) throw new UnauthorizedError("Current password is incorrect");

    await this.store.updateUser(userId, {
      passwordHash: await hashPassword(parsed.newPassword),
    });
    // Invalidate every other session; the current token is revoked too, which
    // forces clients to log in again with the new password.
    await this.store.revokeAllSessionsForUser(userId);
    if (currentToken) await this.store.revokeSessionByTokenHash(hashToken(currentToken));
  }
}
