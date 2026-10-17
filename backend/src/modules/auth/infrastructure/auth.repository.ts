import { prisma } from "../../../shared/database/prisma.ts";
import type { AuthUser, SessionRecord, UserRole, UserWithSecret } from "../domain/types.ts";
import type {
  AuthStore,
  AuthenticationLookup,
  CreateSessionRecord,
  CreateUserRecord,
  ListUsersFilter,
  UpdateUserPatch,
} from "../application/auth.ports.ts";

interface UserRow {
  id: string;
  tenantId: string | null;
  email: string;
  passwordHash: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

interface SessionRow {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapUserWithSecret(row: UserRow): UserWithSecret {
  return { ...mapUser(row), passwordHash: row.passwordHash };
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

/** Prisma adapter for the auth store. */
export class AuthRepository implements AuthStore {
  countUsers(): Promise<number> {
    return prisma.user.count();
  }

  async tenantExists(id: string): Promise<boolean> {
    return (await prisma.tenant.count({ where: { id } })) > 0;
  }

  async hasUserActivity(id: string): Promise<boolean> {
    return (await prisma.livePlayer.count({ where: { userId: id } })) > 0;
  }

  async findUserByEmail(email: string): Promise<UserWithSecret | null> {
    const row = await prisma.user.findUnique({ where: { email } });
    return row ? mapUserWithSecret(row) : null;
  }

  async findUserById(id: string): Promise<UserWithSecret | null> {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? mapUserWithSecret(row) : null;
  }

  async listUsers(filter: ListUsersFilter): Promise<AuthUser[]> {
    const rows = await prisma.user.findMany({
      where: filter.tenantId === undefined ? {} : { tenantId: filter.tenantId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(mapUser);
  }

  async createUser(input: CreateUserRecord): Promise<AuthUser> {
    const row = await prisma.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        role: input.role,
      },
    });
    return mapUser(row);
  }

  async updateUser(id: string, patch: UpdateUserPatch): Promise<AuthUser> {
    const row = await prisma.user.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.tenantId !== undefined ? { tenantId: patch.tenantId } : {}),
        ...(patch.passwordHash !== undefined ? { passwordHash: patch.passwordHash } : {}),
      },
    });
    return mapUser(row);
  }

  async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }

  countSuperadmins(): Promise<number> {
    return prisma.user.count({ where: { role: "SUPERADMIN", isActive: true } });
  }

  async touchLastLogin(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  async createSession(input: CreateSessionRecord): Promise<SessionRecord> {
    const row = await prisma.session.create({
      data: {
        userId: input.userId,
        token: input.tokenHash,
        userAgent: input.userAgent,
        ip: input.ip,
        expiresAt: input.expiresAt,
      },
    });
    return mapSession(row);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthenticationLookup | null> {
    const row = await prisma.session.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });
    if (!row) return null;
    return { session: mapSession(row), user: mapUser(row.user) };
  }

  async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    await prisma.session.updateMany({
      where: { token: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpiredSessions(before: Date): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { expiresAt: { lt: before }, revokedAt: null },
    });
    return result.count;
  }
}
