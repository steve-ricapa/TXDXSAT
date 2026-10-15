import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Opaque session tokens.
 *
 * A random 256-bit value is returned to the client; only its SHA-256 digest is
 * stored in the database. A database leak therefore does not expose usable
 * tokens, and lookups stay a single indexed equality check. `timingSafeEqual` is
 * used when comparing digests.
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokensEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
