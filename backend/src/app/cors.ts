import type { CorsOptions } from "cors";
import { env, isProduction } from "../shared/config/env.ts";

/**
 * CORS policy.
 *
 *  * With `CORS_ORIGINS` set, only those origins are allowed (and credentials
 *    are permitted, so a cookie-based or header-based session works).
 *  * Without it: reflect the request origin in development (convenient for the
 *    Vite dev server), and deny cross-origin in production — the SPA is served
 *    same-origin through Nginx under `/sat`, so no CORS negotiation is needed.
 *
 * Allowed request headers are listed explicitly (including `Authorization` and
 * the tenant/session headers) instead of reflecting whatever the browser asks
 * for, which keeps the policy tight and auditable.
 */

const ALLOWED_HEADERS = [
  "Content-Type",
  "Accept",
  "Authorization",
  "X-Request-Id",
  "X-Correlation-Id",
  "X-Tenant-Id",
  "X-Session-Token",
];

const ALLOWED_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

export function buildCorsOptions(): CorsOptions {
  const common: CorsOptions = {
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: ["X-Request-Id", "X-Correlation-Id"],
    maxAge: 600,
  };

  const allowed = env.CORS_ORIGINS;
  if (allowed.length > 0) {
    return { ...common, origin: allowed, credentials: true };
  }
  if (isProduction) {
    // Same-origin deployment: do not emit CORS headers at all.
    return { ...common, origin: false };
  }
  return { ...common, origin: true, credentials: true };
}
