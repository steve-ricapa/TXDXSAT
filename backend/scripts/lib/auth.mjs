/**
 * Shared auth helper for the dev/test scripts.
 *
 * The API is login-only, so every authoring script must present a bearer token.
 * Credentials come from the environment (or the bootstrap defaults) and can be
 * bypassed entirely by exporting `TXDXSAT_TOKEN`.
 */

const DEFAULT_EMAIL = "admin@txdxsat.local";
const DEFAULT_PASSWORD = "change-me-superadmin";

/** Log in and return an opaque session token. */
export async function getToken(apiBase, options = {}) {
  if (process.env.TXDXSAT_TOKEN) return process.env.TXDXSAT_TOKEN;

  const email = options.email ?? process.env.SUPERADMIN_EMAIL ?? DEFAULT_EMAIL;
  const password = options.password ?? process.env.SUPERADMIN_PASSWORD ?? DEFAULT_PASSWORD;

  const response = await fetch(`${apiBase.replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `login failed (${response.status}) for ${email}: ${JSON.stringify(body)}. ` +
        `Set SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD or TXDXSAT_TOKEN.`,
    );
  }
  return body.token;
}

/** `Authorization` header for a token (empty object when no token). */
export function bearer(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
