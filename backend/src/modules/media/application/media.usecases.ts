import { randomUUID } from "node:crypto";
import { env } from "../../../shared/config/env.ts";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app-error.ts";
import { extensionFor, inspectImage } from "../../../shared/media/image.ts";
import { LocalFileStorage } from "../../../shared/storage/local-file-storage.ts";
import type { FileStorage } from "../../../shared/storage/file-storage.ts";
import { purposeFolder, type MediaAssetRecord, type MediaPurpose } from "../domain/types.ts";
import type { MediaStore } from "./media.ports.ts";
import type { Logger } from "pino";

/** Build the deployment-relative public URL for a stored asset. */
export function mediaPublicUrl(id: string): string {
  return `${env.STORAGE_PUBLIC_PREFIX}/${id}`;
}

export interface UploadMediaInput {
  buffer: Buffer;
  declaredMime?: string | undefined;
  tenantId?: string | null;
  purpose?: MediaPurpose | undefined;
  questionId?: string | null;
  answerIndex?: number | null;
}

/**
 * Use case: validate and persist an uploaded image.
 *
 * The declared content type is only advisory — the real format comes from the
 * byte signature. Rejecting anything that is not a real JPG/PNG/WebP is what
 * stops a renamed executable from landing in the storage volume.
 */
export class UploadMediaUseCase {
  constructor(
    private readonly store: MediaStore,
    private readonly storage: FileStorage,
    private readonly logger: Logger,
  ) {}

  async execute(input: UploadMediaInput): Promise<MediaAssetRecord> {
    const buffer = input.buffer;
    if (!buffer || buffer.length === 0) throw new ValidationError("The uploaded file is empty");
    if (buffer.length > env.STORAGE_MAX_BYTES) {
      throw new ValidationError(
        `Image exceeds the ${Math.round(env.STORAGE_MAX_BYTES / (1024 * 1024))} MB limit`,
      );
    }

    const info = inspectImage(buffer);
    if (!info) {
      throw new ValidationError("Unsupported image format. Allowed: JPG, PNG, WebP.");
    }

    const purpose: MediaPurpose = input.purpose ?? "QUESTION";
    const tenantId = input.tenantId ?? null;
    const tenantSegment = tenantId ? `tenants/${tenantId}` : "shared";
    const key = `${tenantSegment}/${purposeFolder(purpose)}/${randomUUID()}.${extensionFor(info.mime)}`;

    await this.storage.upload(buffer, key, info.mime);

    const record = await this.store.create({
      tenantId,
      purpose,
      key,
      mimeType: info.mime,
      size: buffer.length,
      width: info.width,
      height: info.height,
      checksum: LocalFileStorage.checksum(buffer),
      questionId: input.questionId ?? null,
      answerIndex: input.answerIndex ?? null,
    });

    this.logger.info(
      { mediaId: record.id, tenantId, purpose, mime: info.mime, size: buffer.length },
      "media asset stored",
    );
    return record;
  }
}

/** Use case: read the bytes for an asset id. */
export class GetMediaUseCase {
  constructor(
    private readonly store: MediaStore,
    private readonly storage: FileStorage,
  ) {}

  async execute(id: string): Promise<{ record: MediaAssetRecord; buffer: Buffer }> {
    const record = await this.store.findById(id);
    if (!record) throw new NotFoundError("Image not found");
    const buffer = await this.storage.get(record.key);
    return { record, buffer };
  }
}

/** Use case: list reusable assets within a tenant scope. */
export class ListMediaUseCase {
  constructor(private readonly store: MediaStore) {}

  async execute(filter: {
    tenantId: string | null;
    purpose?: MediaPurpose | undefined;
    questionId?: string | undefined;
  }): Promise<MediaAssetRecord[]> {
    return this.store.list({
      tenantId: filter.tenantId,
      includeShared: filter.tenantId === null,
      purpose: filter.purpose,
      questionId: filter.questionId,
    });
  }
}

/**
 * Use case: delete an asset.
 *
 * Tenant ownership is enforced here: an asset owned by tenant A can never be
 * deleted while acting as tenant B. A mismatch is reported as 404 so the API
 * does not confirm the existence of another tenant's asset.
 */
export class DeleteMediaUseCase {
  constructor(
    private readonly store: MediaStore,
    private readonly storage: FileStorage,
    private readonly logger: Logger,
  ) {}

  async execute(id: string, requestingTenant: string | null | undefined): Promise<void> {
    const record = await this.store.findById(id);
    if (!record) throw new NotFoundError("Image not found");
    assertTenantAccess(record, requestingTenant ?? null);

    await this.store.deleteById(id);
    try {
      await this.storage.delete(record.key);
    } catch (error: unknown) {
      // The DB row is the source of truth; a stranded file is logged, not fatal.
      this.logger.warn({ err: error, mediaId: id }, "failed to remove media file from storage");
    }
  }
}

/**
 * Enforce tenant ownership of a stored asset.
 *  - a shared asset (tenantId = null) is only manageable in the shared scope;
 *  - an owned asset requires the caller to present the same tenant id.
 * Violations are surfaced as 404 to avoid leaking existence across tenants.
 */
export function assertTenantAccess(record: MediaAssetRecord, requestingTenant: string | null): void {
  if (record.tenantId === null) {
    if (requestingTenant !== null) throw new NotFoundError("Image not found");
    return;
  }
  if (record.tenantId !== requestingTenant) {
    throw new ForbiddenError("This image belongs to another tenant");
  }
}
