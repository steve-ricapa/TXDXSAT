import type { DatabaseClient } from "../../../shared/database/prisma.ts";
import type { MediaAssetRecord, MediaPurpose } from "../domain/types.ts";

export interface CreateMediaInput {
  tenantId: string | null;
  purpose: MediaPurpose;
  key: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  checksum: string | null;
  questionId: string | null;
  answerIndex: number | null;
}

export interface ListMediaFilter {
  tenantId: string | null;
  includeShared: boolean;
  purpose?: MediaPurpose | undefined;
  questionId?: string | undefined;
}

/**
 * Persistence port for media metadata. Implemented by the Prisma repository;
 * the use cases never touch the database directly.
 */
export interface MediaStore {
  create(input: CreateMediaInput): Promise<MediaAssetRecord>;
  findById(id: string): Promise<MediaAssetRecord | null>;
  list(filter: ListMediaFilter): Promise<MediaAssetRecord[]>;
  deleteById(id: string): Promise<void>;
  /** Attach a reference to the question/answer that consumes the asset. */
  attach(
    id: string,
    reference: { questionId: string | null; answerIndex: number | null },
    tx?: DatabaseClient,
  ): Promise<void>;
}
