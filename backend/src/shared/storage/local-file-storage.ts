import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { assertSafeKey, type FileStorage, type StoredObject } from "./file-storage.ts";

/**
 * Local-disk implementation of `FileStorage`, rooted at `rootDir` (by default a
 * Docker volume mounted on the backend container at `/app/storage`).
 *
 * Security properties:
 *   - the root is resolved once; every key is validated (`assertSafeKey`) and the
 *     final path is re-checked to be inside the root (defence in depth against
 *     path traversal);
 *   - files are written atomically (temp file + rename) so a crash cannot leave a
 *     partially written image behind;
 *   - the storage root is never served statically — reads go through a
 *     tenant-checked HTTP endpoint.
 */
export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = resolve(rootDir);
  }

  private pathFor(key: string): string {
    assertSafeKey(key);
    const target = resolve(join(this.root, key));
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new Error("Resolved path escapes the storage root");
    }
    return target;
  }

  async upload(file: Buffer, key: string, _contentType: string): Promise<string> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, file);
    await rename(tmp, target);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      const info = await stat(this.pathFor(key));
      return info.isFile();
    } catch {
      return false;
    }
  }

  async stat(key: string): Promise<StoredObject | null> {
    try {
      const info = await stat(this.pathFor(key));
      if (!info.isFile()) return null;
      return { key, size: info.size };
    } catch {
      return null;
    }
  }

  /** Stable checksum used for de-duplication / integrity reporting. */
  static checksum(file: Buffer): string {
    return createHash("sha256").update(file).digest("hex");
  }
}
