import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * Prisma 7 no longer reads `env("DATABASE_URL")` from `schema.prisma`, nor does it
 * auto-load `.env`. The connection string is resolved here and consumed by both the
 * Prisma CLI (migrations, studio) and, at runtime, by the `@prisma/adapter-pg` driver
 * adapter configured in `src/shared/database/prisma.ts`.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
