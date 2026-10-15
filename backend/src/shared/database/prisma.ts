import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../generated/prisma/client.ts";
import { env, isProduction } from "../config/env.ts";

/**
 * PostgreSQL access via Prisma 7.
 *
 * Prisma 7 uses a JavaScript driver-adapter architecture (no Rust query engine).
 * `@prisma/adapter-pg` owns the connection pool and is fed the validated
 * connection string. The generated client lives under `src/generated/prisma`.
 */
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  // Keep the pool small: three containers share a 2 vCPU / 4 GB host.
  max: isProduction ? 10 : 5,
});

export const prisma = new PrismaClient({
  adapter,
  log: isProduction
    ? [{ emit: "event", level: "error" }]
    : [
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
      ],
});

export type PrismaClientType = typeof prisma;

/**
 * A Prisma client scoped to an interactive transaction. Repositories accept this
 * type so callers can compose multiple writes (and outbox appends) atomically.
 */
export type TransactionClient = Prisma.TransactionClient;

/** Anything that can perform queries: the root client or a transaction client. */
export type DatabaseClient = PrismaClientType | TransactionClient;

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/** Lightweight connectivity probe used by the health endpoint. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Run `fn` inside a single PostgreSQL transaction. Use this whenever a business
 * change and its outbox event(s) must commit atomically.
 */
export function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn);
}
