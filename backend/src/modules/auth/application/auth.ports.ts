import type { DatabaseClient } from "../../../shared/database/prisma.ts";
import type { AuthUser, SessionRecord, UserRole, UserWithSecret } from "../domain/types.ts";

export interface CreateUserRecord {
  tenantId: string | null;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
}

export interface CreateSessionRecord {
  userId: string;
  /** SHA-256 digest of the opaque token; the raw token is never stored. */
  tokenHash: string;
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
}

export interface UpdateUserPatch {
  name?: string | undefined;
  role?: UserRole | undefined;
  isActive?: boolean | undefined;
  tenantId?: string | null | undefined;
  passwordHash?: string | undefined;
}

export interface ListUsersFilter {
  /** `undefined` = every user; `null` = platform-level (no tenant). */
  tenantId?: string | null;
}

/**
 * Persistence port for auth. Implemented by the Prisma repository; the use
 * cases and middleware never touch the database directly.
 */
export interface AuthStore {
  countUsers(): Promise<number>;
  tenantExists(id: string): Promise<boolean>;
  hasUserActivity(id: string): Promise<boolean>;

  findUserByEmail(email: string): Promise<UserWithSecret | null>;
  findUserById(id: string): Promise<UserWithSecret | null>;
  listUsers(filter: ListUsersFilter): Promise<AuthUser[]>;
  createUser(input: CreateUserRecord, tx?: DatabaseClient): Promise<AuthUser>;
  updateUser(id: string, patch: UpdateUserPatch): Promise<AuthUser>;
  deleteUser(id: string): Promise<void>;
  countSuperadmins(): Promise<number>;
  touchLastLogin(id: string): Promise<void>;

  createSession(input: CreateSessionRecord): Promise<SessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthenticationLookup | null>;
  revokeSessionByTokenHash(tokenHash: string): Promise<void>;
  revokeAllSessionsForUser(userId: string): Promise<void>;
  deleteExpiredSessions(before: Date): Promise<number>;
}

/** A session joined with its user, used to authenticate a bearer token. */
export interface AuthenticationLookup {
  session: SessionRecord;
  user: AuthUser;
}
