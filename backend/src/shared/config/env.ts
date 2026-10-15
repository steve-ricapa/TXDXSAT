import { z } from "zod";

/**
 * Runtime configuration, validated once at process start.
 *
 * Anything the application reads from `process.env` must flow through this module
 * so that misconfiguration fails fast and the rest of the codebase depends on a
 * typed object rather than raw strings.
 */

const booleanish = z
  .string()
  .transform((value) => ["1", "true", "yes", "on"].includes(value.toLowerCase()));

const csv = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("TXDXSAT"),
  APP_VERSION: z.string().default("0.1.0"),

  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),

  API_PREFIX: z.string().startsWith("/").default("/api/v1"),
  SOCKET_PATH: z.string().startsWith("/").default("/socket.io"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  CORS_ORIGINS: csv.default([]),
  TRUST_PROXY: booleanish.default(false),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  /// Event dispatcher
  DISPATCHER_ENABLED: booleanish.default(true),
  DISPATCHER_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  DISPATCHER_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(25),
  DISPATCHER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  DISPATCHER_LEASE_MS: z.coerce.number().int().positive().default(30_000),
  DISPATCHER_BACKOFF_MS: z.coerce.number().int().positive().default(5_000),
  DISPATCHER_WORKER_ID: z.string().default(""),

  /// Media/file storage (Fase 3). Local persistent volume today; the adapter is
  /// swappable for S3 later without touching controllers or use cases.
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  STORAGE_DIR: z.string().min(1).default("storage"),
  STORAGE_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  /// Public path prefix used to build absolute media URLs stored on questions.
  STORAGE_PUBLIC_PREFIX: z.string().startsWith("/").default("/api/v1/media"),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }

  return parsed.data;
}

export const env: Env = load();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
