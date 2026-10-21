import { Prisma } from "../../../generated/prisma/client.ts";
import { prisma, withTransaction } from "../../../shared/database/prisma.ts";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../../shared/errors/app-error.ts";
import { parseOrThrow } from "../../../shared/middleware/validate.ts";
import { generateToken, hashToken } from "../../../shared/utils/token.ts";
import { hashPassword } from "../../../shared/utils/password.ts";
import { z } from "zod";
import type { AuthUser } from "../domain/types.ts";
import { emailSchema, passwordSchema } from "./auth.usecases.ts";

const createInviteSchema = z.object({
  tenantId: z.string().uuid().optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
  maxUses: z.number().int().min(1).max(500).default(100),
});
const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: passwordSchema,
});

function tenantFor(actor: AuthUser, requested?: string): string {
  if (actor.role === "SUPERADMIN") {
    if (!requested) throw new ValidationError("Selecciona una organización");
    return requested;
  }
  if (actor.role !== "ADMIN" || !actor.tenantId) throw new ForbiddenError("No tienes una organización asignada");
  if (requested && requested !== actor.tenantId) throw new ForbiddenError("No puedes gestionar otra organización");
  return actor.tenantId;
}

function inviteView(invite: { id: string; tenantId: string; maxUses: number; uses: number; expiresAt: Date; revokedAt: Date | null; createdAt: Date }) {
  return {
    id: invite.id,
    tenantId: invite.tenantId,
    maxUses: invite.maxUses,
    uses: invite.uses,
    expiresAt: invite.expiresAt.toISOString(),
    revokedAt: invite.revokedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    isAvailable: !invite.revokedAt && invite.expiresAt > new Date() && invite.uses < invite.maxUses,
  };
}

export async function createEnrollmentInvite(actor: AuthUser, input: unknown) {
  const parsed = parseOrThrow(createInviteSchema, input);
  const tenantId = tenantFor(actor, parsed.tenantId);
  if (!await prisma.tenant.count({ where: { id: tenantId } })) throw new NotFoundError("Organización no encontrada");
  const token = generateToken();
  const invite = await prisma.enrollmentInvite.create({
    data: {
      tenantId,
      createdById: actor.id,
      tokenHash: hashToken(token),
      maxUses: parsed.maxUses,
      expiresAt: new Date(Date.now() + parsed.expiresInDays * 86_400_000),
    },
  });
  return { invite: inviteView(invite), token };
}

export async function listEnrollmentInvites(actor: AuthUser, requested?: string) {
  const tenantId = tenantFor(actor, requested);
  const invites = await prisma.enrollmentInvite.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 });
  return invites.map(inviteView);
}

export async function revokeEnrollmentInvite(actor: AuthUser, id: string) {
  const existing = await prisma.enrollmentInvite.findUnique({ where: { id }, select: { tenantId: true } });
  if (!existing) throw new NotFoundError("Invitación no encontrada");
  const tenantId = tenantFor(actor, existing.tenantId);
  const result = await prisma.enrollmentInvite.updateMany({ where: { id, tenantId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!result.count) throw new NotFoundError("Invitación no encontrada");
}

async function activeInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw new NotFoundError("Esta invitación no está disponible");
  const invite = await prisma.enrollmentInvite.findUnique({ where: { tokenHash: hashToken(token) }, include: { tenant: true } });
  if (!invite || invite.revokedAt || invite.expiresAt <= new Date() || invite.uses >= invite.maxUses) {
    throw new NotFoundError("Esta invitación expiró o fue desactivada");
  }
  return invite;
}

export async function getEnrollmentInvite(token: string) {
  const invite = await activeInvite(token);
  return { organization: invite.tenant.name, expiresAt: invite.expiresAt.toISOString() };
}

export async function registerFromInvite(token: string, input: unknown) {
  const parsed = parseOrThrow(registerSchema, input);
  const invite = await activeInvite(token);
  if (await prisma.user.count({ where: { email: parsed.email } })) throw new ConflictError("Ya existe una cuenta con ese correo");
  const passwordHash = await hashPassword(parsed.password);
  try {
    await withTransaction(async (tx) => {
      const updated = await tx.enrollmentInvite.updateMany({
        where: { id: invite.id, revokedAt: null, expiresAt: { gt: new Date() }, uses: { lt: invite.maxUses } },
        data: { uses: { increment: 1 } },
      });
      if (!updated.count) throw new ValidationError("Esta invitación ya no está disponible");
      await tx.user.create({ data: {
        tenantId: invite.tenantId,
        name: parsed.name,
        email: parsed.email,
        passwordHash,
        role: "EMPLOYEE",
        isActive: false,
        enrollmentStatus: "PENDING",
      } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Ya existe una cuenta con ese correo");
    }
    throw error;
  }
  return { message: "Solicitud enviada. Un administrador de la organización debe aprobar tu cuenta." };
}

export async function listPendingEnrollments(actor: AuthUser, requested?: string) {
  const tenantId = tenantFor(actor, requested);
  const users = await prisma.user.findMany({
    where: { tenantId, role: "EMPLOYEE", enrollmentStatus: "PENDING" },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }));
}

export async function listTenantEmployees(actor: AuthUser, requested?: string) {
  const tenantId = tenantFor(actor, requested);
  const users = await prisma.user.findMany({
    where: { tenantId, role: "EMPLOYEE" },
    select: { id: true, name: true, email: true, isActive: true, enrollmentStatus: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }));
}

export async function decideEnrollment(actor: AuthUser, userId: string, decision: "approve" | "reject") {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
  if (!target?.tenantId) throw new NotFoundError("Solicitud pendiente no encontrada");
  const tenantId = tenantFor(actor, target.tenantId);
  const result = await prisma.user.updateMany({
    where: { id: userId, tenantId, role: "EMPLOYEE", enrollmentStatus: decision === "approve" ? { in: ["PENDING", "REJECTED"] } : "PENDING" },
    data: decision === "approve"
      ? { enrollmentStatus: "APPROVED", isActive: true }
      : { enrollmentStatus: "REJECTED", isActive: false },
  });
  if (!result.count) throw new NotFoundError("Solicitud pendiente no encontrada");
}
