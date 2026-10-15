import { ERROR_CODES } from "../config/constants.ts";

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface AppErrorOptions {
  code?: string;
  status?: number;
  details?: unknown;
  cause?: unknown;
}

/**
 * Base class for expected (operational) errors. Anything thrown that is *not* an
 * `AppError` is treated as unexpected and reported as a generic 500.
 *
 * Business logic must throw these instead of writing HTTP concerns; the HTTP
 * error middleware is the single place that translates them into responses.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  readonly isOperational = true;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code ?? ERROR_CODES.internal;
    this.status = options.status ?? 500;
    this.details = options.details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, { code: ERROR_CODES.validation, status: 422, details });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super(message, { code: ERROR_CODES.notFound, status: 404, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", details?: unknown) {
    super(message, { code: ERROR_CODES.unauthorized, status: 401, details });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Operation not allowed", details?: unknown) {
    super(message, { code: ERROR_CODES.forbidden, status: 403, details });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super(message, { code: ERROR_CODES.conflict, status: 409, details });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests", details?: unknown) {
    super(message, { code: ERROR_CODES.tooManyRequests, status: 429, details });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
