/**
 * Auth module domain types.
 *
 * Direct accounts are provisioned by a SUPERADMIN; invited employees may
 * request registration but cannot access the platform until approved. Roles:
 *   * `SUPERADMIN` — platform operator; may create/manage every account.
 *   * `ADMIN`      — company administrator (optionally bound to a tenant).
 *   * `EMPLOYEE`   — company participant, always bound to a tenant.
 *
 * Nothing here knows about Prisma, Express or bcrypt.
 */

export const USER_ROLES = ["SUPERADMIN", "ADMIN", "EMPLOYEE"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/** Public projection of a user — never contains the password hash. */
export interface AuthUser {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  enrollmentStatus: "APPROVED" | "PENDING" | "REJECTED";
  lastLoginAt: string | null;
  createdAt: string;
}

/** Internal projection used by the login flow (adds the secret). */
export interface UserWithSecret extends AuthUser {
  passwordHash: string;
}

/** A persisted, opaque login session. */
export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
}

/** A verified session together with its owner. */
export interface AuthenticatedSession {
  session: SessionRecord;
  user: AuthUser;
}
