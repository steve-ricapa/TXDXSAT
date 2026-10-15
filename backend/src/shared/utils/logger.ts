import pino, { type Logger, type LoggerOptions } from "pino";
import { env, isProduction } from "../config/env.ts";

/**
 * Structured JSON logger bound to stdout/stderr so the container runtime can
 * collect logs without any side-car or file handling.
 */
const options: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: { app: env.APP_NAME, version: env.APP_VERSION, env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.secret",
      "*.apiKey",
    ],
    censor: "[redacted]",
  },
};

export const logger: Logger = pino(options);

/** Create a child logger with a fixed component label. */
export function createLogger(component: string): Logger {
  return logger.child({ component });
}

export { isProduction };
