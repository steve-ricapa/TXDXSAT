import { randomBytes, randomUUID } from "node:crypto";

/** Generate a UUID v4 string. */
export function newId(): string {
  return randomUUID();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when `value` is a syntactically valid UUID. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Generate a non-predictable numeric code of `length` digits using a
 * cryptographically secure source with rejection sampling to keep the
 * distribution uniform. Used for session join PINs.
 */
export function newNumericCode(length: number): string {
  const digits = "0123456789";
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length)) {
      // Reject the biased tail (>250) so every digit is equally likely.
      if (byte < 250) out += digits[byte % 10];
      if (out.length === length) break;
    }
  }
  return out;
}
