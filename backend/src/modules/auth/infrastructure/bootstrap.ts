import type { Logger } from "pino";
import { env } from "../../../shared/config/env.ts";
import { hashPassword } from "../../../shared/utils/password.ts";
import { AuthRepository } from "./auth.repository.ts";

/**
 * Bootstrap the very first SUPERADMIN.
 *
 * There is no public registration, so the platform needs one seeded operator
 * before any account can be created. This runs once at startup and is
 * idempotent:
 *   * if a user with `SUPERADMIN_EMAIL` already exists, nothing happens;
 *   * if the platform already has any user, it refuses to inject another one
 *     (so a stale env var can never resurrect a privileged account);
 *   * otherwise it creates the operator from the env values.
 *
 * Returns `true` when a superadmin was created.
 */
export async function ensureSuperadmin(logger: Logger): Promise<boolean> {
  const email = env.SUPERADMIN_EMAIL.trim().toLowerCase();
  const password = env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    logger.debug("superadmin bootstrap disabled (SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD not set)");
    return false;
  }

  const store = new AuthRepository();

  const existing = await store.findUserByEmail(email);
  if (existing) {
    logger.debug({ email }, "superadmin bootstrap skipped: account already exists");
    return false;
  }

  const userCount = await store.countUsers();
  if (userCount > 0) {
    logger.warn(
      { email },
      "superadmin bootstrap skipped: the platform already has accounts",
    );
    return false;
  }

  const user = await store.createUser({
    tenantId: null,
    email,
    passwordHash: await hashPassword(password),
    name: env.SUPERADMIN_NAME || "Super Admin",
    role: "SUPERADMIN",
  });

  logger.info({ userId: user.id, email: user.email }, "bootstrap superadmin created");
  return true;
}
