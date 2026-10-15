/**
 * Process-wide constants that are not environment dependent.
 */

/** HTTP headers used to propagate request correlation across the stack. */
export const HEADERS = {
  requestId: "x-request-id",
  correlationId: "x-correlation-id",
  tenantId: "x-tenant-id",
} as const;

/** Error codes surfaced to API clients (stable, machine-readable). */
export const ERROR_CODES = {
  validation: "VALIDATION_ERROR",
  notFound: "NOT_FOUND",
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  conflict: "CONFLICT",
  tooManyRequests: "TOO_MANY_REQUESTS",
  internal: "INTERNAL_ERROR",
} as const;
