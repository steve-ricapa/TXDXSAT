/**
 * CLI: `npm run seed:superadmin`
 *
 * Creates the first SUPERADMIN from the `SUPERADMIN_*` environment variables.
 * Idempotent and safe to run repeatedly (see `ensureSuperadmin`).
 */
import { connectDatabase, disconnectDatabase } from "../shared/database/prisma.ts";
import { logger } from "../shared/utils/logger.ts";
import { ensureSuperadmin } from "../modules/auth/infrastructure/bootstrap.ts";

async function main(): Promise<void> {
  await connectDatabase();
  try {
    const created = await ensureSuperadmin(logger);
    if (!created) {
      logger.info(
        "no superadmin was created (already configured, or SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD unset)",
      );
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "failed to seed superadmin");
  process.exitCode = 1;
});
