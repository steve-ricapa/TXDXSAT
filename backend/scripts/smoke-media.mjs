#!/usr/bin/env node
/**
 * Media/storage smoke test (Fase 3).
 *
 * Exercises the whole local-storage story against a running stack:
 *   - real image validation (signature sniffing, reject non-images);
 *   - size limit enforcement;
 *   - round-trip store/read (bytes identical);
 *   - tenant isolation on list and delete;
 *   - safe deletion.
 *
 * Usage:
 *   node scripts/smoke-media.mjs [baseUrl]
 */

import { randomUUID } from "node:crypto";
import { renderPhishingEmail } from "./lib/png.mjs";

const baseUrl = (
  process.argv[2] ??
  process.env.TXDXSAT_API ??
  "http://localhost:8080/sat/api/v1"
).replace(/\/$/, "");
const origin = new URL(baseUrl).origin;

let failures = 0;
let checks = 0;

function check(name, condition, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Convert a stored `/api/v1/media/<id>` URL into the public deployment path. */
function publicPath(url) {
  const apiPath = url.startsWith("/api/") ? url : url.replace(/^.*?(\/api\/)/, "$1");
  const prefix = new URL(baseUrl).pathname.replace(/\/api\/v1\/?$/, "");
  return `${prefix}${apiPath}`;
}

async function upload(buffer, { type = "image/png", name = "test.png", tenantId, purpose } = {}) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type }), name);
  if (purpose) form.append("purpose", purpose);
  const headers = tenantId ? { "x-tenant-id": tenantId } : {};
  const response = await fetch(`${baseUrl}/media`, { method: "POST", headers, body: form });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function main() {
  console.log(`Media smoke test against ${baseUrl}\n`);

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const png = renderPhishingEmail();

  // 1. Upload a real image for tenant A.
  const created = await upload(png, { tenantId: tenantA, purpose: "QUESTION" });
  check("upload real PNG (201)", created.status === 201, `status ${created.status}`);
  const asset = created.body;
  check("upload returns id/url/mime", Boolean(asset.id && asset.url && asset.mimeType === "image/png"));
  check("upload records dimensions", asset.width === 1200 && asset.height === 800, `${asset.width}x${asset.height}`);
  check("upload records size", asset.size === png.length);

  // 2. Read it back — bytes must match exactly.
  const direct = await fetch(`${origin}${publicPath(asset.url)}`);
  check("read image (200)", direct.status === 200, `status ${direct.status}`);
  const bytes = Buffer.from(await direct.arrayBuffer());
  check("read bytes identical", bytes.length === png.length && bytes.equals(png));
  check("read content-type", direct.headers.get("content-type") === "image/png", direct.headers.get("content-type") ?? "?");

  // 3. Listing is tenant-scoped.
  const listA = await fetch(`${baseUrl}/media?purpose=QUESTION`, { headers: { "x-tenant-id": tenantA } }).then((r) => r.json());
  const listB = await fetch(`${baseUrl}/media?purpose=QUESTION`, { headers: { "x-tenant-id": tenantB } }).then((r) => r.json());
  check("tenant A sees its asset", (listA.assets ?? []).some((a) => a.id === asset.id));
  check("tenant B does NOT see tenant A asset", !(listB.assets ?? []).some((a) => a.id === asset.id));

  // 4. Cross-tenant delete is refused.
  const forbidden = await fetch(`${baseUrl}/media/${asset.id}`, {
    method: "DELETE",
    headers: { "x-tenant-id": tenantB },
  });
  check("tenant B cannot delete tenant A asset", forbidden.status === 403 || forbidden.status === 404, `status ${forbidden.status}`);

  // 5. Non-image content is rejected (renamed file).
  const fake = await upload(Buffer.from("#!/bin/sh\necho pwned\n"), { type: "image/png", name: "evil.png", tenantId: tenantA });
  check("reject non-image payload", fake.status === 422, `status ${fake.status}`);

  // 6. Oversized image is rejected.
  const huge = Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]);
  const oversized = await upload(huge, { tenantId: tenantA });
  check("reject oversize upload", oversized.status === 422, `status ${oversized.status}`);

  // 7. Owner deletes; then it is gone.
  const removed = await fetch(`${baseUrl}/media/${asset.id}`, { method: "DELETE", headers: { "x-tenant-id": tenantA } });
  check("owner deletes asset (204)", removed.status === 204, `status ${removed.status}`);
  const after = await fetch(`${origin}${publicPath(asset.url)}`);
  check("deleted asset now 404", after.status === 404, `status ${after.status}`);

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
