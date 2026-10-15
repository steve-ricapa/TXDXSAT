import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import { HEADERS } from "../config/constants.ts";
import { isUuid, newId } from "../utils/id.ts";

/**
 * Per-request ambient context. Stored in `AsyncLocalStorage` so application and
 * domain layers can read correlation/tenant information without threading it
 * through every function signature.
 */
export interface RequestContext {
  requestId: string;
  correlationId: string;
  tenantId: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Correlation id for the current request, or a fresh id outside a request. */
export function currentCorrelationId(): string {
  return storage.getStore()?.correlationId ?? newId();
}

function readId(value: unknown): string | undefined {
  return typeof value === "string" && isUuid(value) ? value : undefined;
}

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = readId(req.header(HEADERS.requestId)) ?? newId();
  const correlationId =
    readId(req.header(HEADERS.correlationId)) ?? requestId;
  const tenantId = readId(req.header(HEADERS.tenantId)) ?? null;

  const context: RequestContext = { requestId, correlationId, tenantId };

  res.setHeader(HEADERS.requestId, requestId);
  res.setHeader(HEADERS.correlationId, correlationId);

  storage.run(context, () => next());
}
