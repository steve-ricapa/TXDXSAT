#!/usr/bin/env node
/**
 * Auth + endpoint smoke test.
 *
 * Exercises the login-only auth model (no registration) and the guard policy of
 * the whole API against a running stack:
 *   - public endpoints stay public (health, image read by capability URL);
 *   - authoring endpoints require a session and reject anonymous access;
 *   - only SUPERADMIN can manage accounts; ADMINs get 403;
 *   - login/logout, session revocation, deactivation and validation errors;
 *   - malformed bodies are client errors (4xx), not 500s;
 *   - CORS preflight does not error and follows the configured policy.
 *
 * Usage:
 *   node scripts/smoke-auth.mjs [baseUrl]
 *   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node scripts/smoke-auth.mjs
 */

const baseUrl = (
  process.argv[2] ??
  process.env.TXDXSAT_API ??
  "http://localhost:8080/sat/api/v1"
).replace(/\/$/, "");
const origin = new URL(baseUrl).origin;

const adminEmail = process.env.SUPERADMIN_EMAIL ?? "admin@txdxsat.local";
const adminPassword = process.env.SUPERADMIN_PASSWORD ?? "change-me-superadmin";

let checks = 0;
let failures = 0;

function check(name, condition, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function req(method, path, { token, body, headers = {}, rawBody } = {}) {
  const finalHeaders = { Accept: "application/json", ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  let payload;
  if (rawBody !== undefined) {
    payload = rawBody;
    finalHeaders["Content-Type"] ??= "application/json";
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    finalHeaders["Content-Type"] = "application/json";
  }
  const response = await fetch(`${baseUrl}${path}`, { method, headers: finalHeaders, body: payload });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, headers: response.headers, text, json };
}

async function main() {
  console.log(`Auth/endpoint smoke test -> ${baseUrl}\n`);

  // --- 1. Public endpoints ------------------------------------------------
  const health = await req("GET", "/health");
  check("GET /health is public (200)", health.status === 200, `got ${health.status}`);

  // --- 2. Login validation ------------------------------------------------
  const badLogin = await req("POST", "/auth/login", {
    body: { email: adminEmail, password: "definitely-wrong" },
  });
  check("login with wrong password -> 401", badLogin.status === 401, `got ${badLogin.status}`);

  const missingFields = await req("POST", "/auth/login", { body: { email: adminEmail } });
  check("login without password -> 422", missingFields.status === 422, `got ${missingFields.status}`);

  const login = await req("POST", "/auth/login", { body: { email: adminEmail, password: adminPassword } });
  check("login with valid credentials -> 200", login.status === 200, `got ${login.status}`);
  const token = login.json?.token;
  check("login returns a token", typeof token === "string" && token.length > 20);
  check("login returns the superadmin profile", login.json?.user?.role === "SUPERADMIN");
  check("login sets lastLoginAt", Boolean(login.json?.user?.lastLoginAt));
  check("login never leaks the password hash", !("passwordHash" in (login.json?.user ?? {})));

  if (typeof token !== "string") {
    console.log("\nCannot continue without a token.");
    process.exit(1);
  }

  // --- 3. Session resolution ---------------------------------------------
  const me = await req("GET", "/auth/me", { token });
  check("GET /auth/me with token -> 200", me.status === 200, `got ${me.status}`);
  check("GET /auth/me returns the same user", me.json?.user?.email === login.json?.user?.email);

  check("GET /auth/me without token -> 401", (await req("GET", "/auth/me")).status === 401);
  check(
    "GET /auth/me with junk token -> 401",
    (await req("GET", "/auth/me", { token: "not-a-real-token" })).status === 401,
  );

  // --- 4. Authorization (role) -------------------------------------------
  check("GET /auth/users without token -> 401", (await req("GET", "/auth/users")).status === 401);

  const users = await req("GET", "/auth/users", { token });
  check("GET /auth/users as superadmin -> 200", users.status === 200, `got ${users.status}`);
  check("GET /auth/users returns an array", Array.isArray(users.json?.users));

  // --- 5. Account creation (superadmin only) ------------------------------
  const newEmail = `smoke+${Date.now()}@txdxsat.local`;
  const weak = await req("POST", "/auth/users", {
    token,
    body: { email: newEmail, password: "short", name: "Smoke Admin", role: "ADMIN" },
  });
  check("create user with weak password -> 422", weak.status === 422, `got ${weak.status}`);

  const created = await req("POST", "/auth/users", {
    token,
    body: { email: newEmail, password: "smoke-password-123", name: "Smoke Admin", role: "ADMIN" },
  });
  check("create user as superadmin -> 201", created.status === 201, `got ${created.status}`);
  const createdId = created.json?.user?.id;
  check("created user has role ADMIN", created.json?.user?.role === "ADMIN");

  const duplicate = await req("POST", "/auth/users", {
    token,
    body: { email: newEmail, password: "smoke-password-123", name: "Dup", role: "ADMIN" },
  });
  check("create duplicate email -> 409", duplicate.status === 409, `got ${duplicate.status}`);

  const registerAttempt = await req("POST", "/auth/register", {
    body: { email: "nope@txdxsat.local", password: "whatever-12345", name: "Nope" },
  });
  check(
    "POST /auth/register does not exist (404, no self-registration)",
    registerAttempt.status === 404,
    `got ${registerAttempt.status}`,
  );

  // --- 6. Role enforcement on the new ADMIN ------------------------------
  const adminLogin = await req("POST", "/auth/login", {
    body: { email: newEmail, password: "smoke-password-123" },
  });
  check("new admin can log in -> 200", adminLogin.status === 200, `got ${adminLogin.status}`);
  const adminToken = adminLogin.json?.token;

  const forbidden = await req("GET", "/auth/users", { token: adminToken });
  check("ADMIN cannot list users -> 403", forbidden.status === 403, `got ${forbidden.status}`);

  const forbiddenCreate = await req("POST", "/auth/users", {
    token: adminToken,
    body: { email: `x+${Date.now()}@txdxsat.local`, password: "smoke-password-123", name: "X" },
  });
  check("ADMIN cannot create users -> 403", forbiddenCreate.status === 403, `got ${forbiddenCreate.status}`);

  // --- 7. Deactivation revokes access ------------------------------------
  const deactivate = await req("PATCH", `/auth/users/${createdId}`, {
    token,
    body: { isActive: false },
  });
  check("deactivate user -> 200", deactivate.status === 200, `got ${deactivate.status}`);
  check("deactivated user cannot log in -> 403", (await req("POST", "/auth/login", {
    body: { email: newEmail, password: "smoke-password-123" },
  })).status === 403);

  const reactivate = await req("PATCH", `/auth/users/${createdId}`, { token, body: { isActive: true } });
  check("reactivate user -> 200", reactivate.status === 200, `got ${reactivate.status}`);
  check(
    "reactivated user can log in again -> 200",
    (await req("POST", "/auth/login", { body: { email: newEmail, password: "smoke-password-123" } }))
      .status === 200,
  );

  const badUuid = await req("PATCH", "/auth/users/not-a-uuid", { token, body: { isActive: false } });
  check("PATCH user with bad id -> 404", badUuid.status === 404, `got ${badUuid.status}`);

  // --- 8. Protected authoring endpoints ----------------------------------
  check("GET /live/quizzes without token -> 401", (await req("GET", "/live/quizzes")).status === 401);
  const quizzes = await req("GET", "/live/quizzes", { token });
  check("GET /live/quizzes with token -> 200", quizzes.status === 200, `got ${quizzes.status}`);

  check("GET /media without token -> 401", (await req("GET", "/media")).status === 401);
  const media = await req("GET", "/media", { token });
  check("GET /media with token -> 200", media.status === 200, `got ${media.status}`);

  // Image read is a capability URL: public even without a token.
  const firstAsset = media.json?.assets?.[0];
  if (firstAsset) {
    const image = await fetch(`${baseUrl}/media/${firstAsset.id}`);
    check(
      `GET /media/:id is public (${image.status}, ${image.headers.get("content-type")})`,
      image.status === 200,
      `got ${image.status}`,
    );
  } else {
    console.log("  SKIP  GET /media/:id (no stored assets yet)");
  }

  // --- 9. Robustness ------------------------------------------------------
  const malformed = await req("POST", "/auth/login", { rawBody: "{not valid json" });
  check("malformed JSON -> 400 (not 500)", malformed.status === 400, `got ${malformed.status}`);

  const unknown = await req("GET", "/does-not-exist", { token });
  check("unknown route -> 404", unknown.status === 404, `got ${unknown.status}`);

  // --- 10. CORS -----------------------------------------------------------
  // Same-origin production deployment: preflight must never error. When an
  // explicit allow-list is configured, the provided Origin must be echoed.
  const preflight = await req("OPTIONS", "/auth/login", {
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type, authorization",
    },
  });
  check("CORS preflight does not error (status < 500)", preflight.status < 500, `got ${preflight.status}`);
  const allowOrigin = preflight.headers.get("access-control-allow-origin");
  if (allowOrigin) {
    check("CORS preflight echoes the allowed origin", allowOrigin === origin, `got ${allowOrigin}`);
    check(
      "CORS preflight allows the Authorization header",
      (preflight.headers.get("access-control-allow-headers") ?? "")
        .toLowerCase()
        .includes("authorization"),
    );
  } else {
    console.log("  INFO  no Access-Control-Allow-Origin (same-origin / CORS disabled) — expected in production");
  }

  // --- 11. Cleanup: deletion revokes the account --------------------------
  const del = await req("DELETE", `/auth/users/${createdId}`, { token });
  check("delete user -> 204", del.status === 204, `got ${del.status}`);
  check(
    "deleted user can no longer log in -> 401",
    (await req("POST", "/auth/login", { body: { email: newEmail, password: "smoke-password-123" } }))
      .status === 401,
  );

  // --- 12. Logout revokes the session ------------------------------------
  const logout = await req("POST", "/auth/logout", { token });
  check("logout -> 204", logout.status === 204, `got ${logout.status}`);
  check("revoked token is rejected -> 401", (await req("GET", "/auth/me", { token })).status === 401);

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
