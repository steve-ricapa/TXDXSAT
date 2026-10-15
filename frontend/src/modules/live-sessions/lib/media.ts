import { ApiError } from "@/services/api-client";
import { env } from "@/lib/env";

/**
 * Client side of the media module.
 *
 * Images are optimized in the browser (canvas down-scale + WebP re-encode) before
 * upload, which keeps storage and bandwidth low without a server-side image
 * library. The server still verifies the real file signature and size.
 */

export interface MediaAsset {
  id: string;
  tenantId: string | null;
  purpose: "QUESTION" | "ANSWER" | "LABORATORY";
  key: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  questionId: string | null;
  answerIndex: number | null;
  createdAt: string;
  /** Deployment-relative public URL, e.g. `/api/v1/media/<id>`. */
  url: string;
}

/**
 * Turn a stored URL into something an `<img src>` can use.
 *
 * External/data URLs pass through; deployment-relative `/api/...` paths get the
 * `/sat` base prefix.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  const base = env.basePath.replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

let webpSupport: boolean | null = null;

function supportsWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    webpSupport = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

export interface OptimizeOptions {
  /** Longest edge in pixels (default 1600). */
  maxDim?: number;
  /** Encoder quality 0..1 (default 0.82). */
  quality?: number;
}

/**
 * Down-scale and re-encode an image. Returns the original file when the browser
 * cannot decode it or the "optimized" result would be larger (small PNGs).
 */
export async function optimizeImage(file: File, options: OptimizeOptions = {}): Promise<Blob> {
  const { maxDim = 1600, quality = 0.82 } = options as any;
  if (!file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    // Nothing to gain from a tiny image that is already small on disk.
    if (scale === 1 && file.size < 200 * 1024) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const outputType = supportsWebp() ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), outputType, quality),
    );
    if (!blob) return file;
    return blob.size < file.size ? blob : file;
  } finally {
    bitmap.close?.();
  }
}

async function parseError(response: Response): Promise<never> {
  const text = await response.text().catch(() => "");
  let message = `Upload failed (${response.status})`;
  try {
    const payload = JSON.parse(text) as { error?: { message?: string; code?: string } };
    message = payload.error?.message ?? message;
  } catch {
    /* keep default */
  }
  throw new ApiError(response.status, message);
}

export interface UploadMediaOptions {
  tenantId?: string | null;
  purpose?: MediaAsset["purpose"];
  filename?: string;
}

/** Upload an image blob to the media API. */
export async function uploadMedia(blob: Blob, options: UploadMediaOptions = {}): Promise<MediaAsset> {
  const form = new FormData();
  const fallbackName = blob.type === "image/webp" ? "image.webp" : "image.jpg";
  form.append("file", blob, options.filename ?? fallbackName);
  if (options.purpose) form.append("purpose", options.purpose);
  form.append("tenantId", options.tenantId ?? "");

  const headers: Record<string, string> = {};
  if (options.tenantId) headers["x-tenant-id"] = options.tenantId;

  const response = await fetch(`${env.apiBaseUrl}/media`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!response.ok) await parseError(response);
  return (await response.json()) as MediaAsset;
}

/** List reusable assets visible in a tenant scope (shared when tenantId omitted). */
export async function listMedia(
  options: { tenantId?: string | null; purpose?: MediaAsset["purpose"] } | string | undefined = {},
): Promise<MediaAsset[]> {
  let tenantId: string | null | undefined;
  let purpose: MediaAsset["purpose"] | undefined;
  if (typeof options === "string") {
    tenantId = options;
  } else {
    tenantId = options.tenantId;
    purpose = options.purpose;
  }
  const params = new URLSearchParams();
  if (purpose) params.set("purpose", purpose);
  const query = params.toString();
  const headers: Record<string, string> = {};
  if (tenantId) headers["x-tenant-id"] = tenantId;

  const response = await fetch(`${env.apiBaseUrl}/media${query ? `?${query}` : ""}`, { headers });
  if (!response.ok) await parseError(response);
  const body = (await response.json()) as { assets: MediaAsset[] };
  return body.assets ?? [];
}

/** Delete an asset within its tenant scope. */
export async function deleteMedia(id: string, tenantId?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (tenantId) headers["x-tenant-id"] = tenantId;
  const response = await fetch(`${env.apiBaseUrl}/media/${id}`, { method: "DELETE", headers });
  if (!response.ok && response.status !== 204) await parseError(response);
}
