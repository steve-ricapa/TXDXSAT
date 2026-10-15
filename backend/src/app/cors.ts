import type { CorsOptions } from "cors";
import { env, isProduction } from "../shared/config/env.ts";

/**
 * CORS policy.
 *  * With `CORS_ORIGINS` set, only those origins are allowed.
 *  * Without it: reflect the request origin in development (convenient for the
 *    Vite dev server), and deny cross-origin in production (the SPA is served
 *    same-origin through Nginx under `/sat`).
 */
export function buildCorsOptions(): CorsOptions {
  const allowed = env.CORS_ORIGINS;
  if (allowed.length > 0) {
    return {
      origin: allowed,
      credentials: true,
    };
  }
  if (isProduction) {
    return { origin: false };
  }
  return { origin: true, credentials: true };
}
