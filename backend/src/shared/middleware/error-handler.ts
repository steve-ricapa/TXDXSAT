import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ERROR_CODES } from "../config/constants.ts";
import { AppError, isAppError } from "../errors/app-error.ts";
import type { Logger } from "pino";
import { getRequestContext } from "./request-context.ts";

interface PrismaKnownError {
  code: string;
  meta?: Record<string, unknown>;
}

function asPrismaKnownError(error: unknown): PrismaKnownError | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    /^P\d{4}$/.test((error as { code: string }).code)
  ) {
    return error as PrismaKnownError;
  }
  return undefined;
}

/**
 * Single HTTP error boundary. Translates domain/validation/persistence errors
 * into the stable API error envelope:
 *   { error: { code, message, details?, requestId } }
 */
export function errorHandler(logger: Logger) {
  return (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): void => {
    const requestId = getRequestContext()?.requestId ?? null;

    if (res.headersSent) {
      logger.error({ err: error }, "error after response was sent");
      return;
    }

    if (error instanceof ZodError) {
      res.status(422).json({
        error: {
          code: ERROR_CODES.validation,
          message: "Validation failed",
          details: error.issues,
          requestId,
        },
      });
      return;
    }

    if (isAppError(error)) {
      const log = error.status >= 500 ? logger.error : logger.warn;
      log.call(logger, { err: error }, error.message);
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
          requestId,
        },
      });
      return;
    }

    const prismaError = asPrismaKnownError(error);
    if (prismaError) {
      const mapped =
        prismaError.code === "P2025"
          ? { status: 404, code: ERROR_CODES.notFound, message: "Resource not found" }
          : prismaError.code === "P2002"
            ? { status: 409, code: ERROR_CODES.conflict, message: "Resource already exists" }
            : { status: 500, code: ERROR_CODES.internal, message: "Database error" };
      logger.error({ err: error, prismaCode: prismaError.code }, mapped.message);
      res.status(mapped.status).json({
        error: { ...mapped, requestId },
      });
      return;
    }

    logger.error({ err: error }, "unhandled error");
    res.status(500).json({
      error: {
        code: ERROR_CODES.internal,
        message: "Internal server error",
        requestId,
      },
    });
  };
}

export function notFoundHandler() {
  return (req: Request, res: Response): void => {
    res.status(404).json({
      error: {
        code: ERROR_CODES.notFound,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
        requestId: getRequestContext()?.requestId ?? null,
      },
    });
  };
}

export { AppError };
