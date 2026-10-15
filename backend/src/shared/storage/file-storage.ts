/**
 * Storage port (hexagonal).
 *
 * The application only ever talks to this interface. Today it is backed by a
 * Docker volume via `LocalFileStorage`; migrating to S3 later means writing one
 * new adapter and changing the composition root — no controller or use case
 * changes. `key` is always an internal, server-generated, relative path
 * (e.g. `tenants/<uuid>/questions/<uuid>.png`), never client input.
 */
export interface StoredObject {
  key: string;
  size: number;
}

export interface FileStorage {
  /** Persist `file` under `key`; returns the stored key. */
  upload(file: Buffer, key: string, contentType: string): Promise<string>;
  /** Read an object by key. Throws if it does not exist. */
  get(key: string): Promise<Buffer>;
  /** Remove an object by key. Idempotent (missing keys are ignored). */
  delete(key: string): Promise<void>;
  /** True when an object exists for `key`. */
  exists(key: string): Promise<boolean>;
  /** Size/metadata without reading the whole object, or null if absent. */
  stat(key: string): Promise<StoredObject | null>;
}

/**
 * Validate a storage key. Rejects anything that could escape the storage root:
 * absolute paths, drive letters, `..` segments, backslashes and NUL bytes.
 */
export function assertSafeKey(key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("Storage key must be a non-empty string");
  }
  if (key.length > 400) throw new Error("Storage key is too long");
  if (key.includes("\0")) throw new Error("Storage key contains a NUL byte");
  if (key.includes("\\")) throw new Error("Storage key must use forward slashes");
  if (key.startsWith("/")) throw new Error("Storage key must be relative");
  if (/^[a-zA-Z]:/.test(key)) throw new Error("Storage key must not be a drive path");
  const segments = key.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("Storage key contains an invalid path segment");
  }
  if (!/^[a-zA-Z0-9._/-]+$/.test(key)) {
    throw new Error("Storage key contains unsupported characters");
  }
  return key;
}
