import type { ZodType } from "zod";
import { ValidationError } from "../errors/app-error.ts";

/**
 * Parse `data` with a Zod schema, translating failures into an `AppError`.
 * Application/use-case layers call this; controllers stay thin.
 */
export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Validation failed", result.error.issues);
  }
  return result.data;
}

export type { ZodType };
