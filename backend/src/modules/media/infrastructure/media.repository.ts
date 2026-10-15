import { prisma } from "../../../shared/database/prisma.ts";
import type { MediaAssetRecord, MediaPurpose } from "../domain/types.ts";
import type { CreateMediaInput, ListMediaFilter, MediaStore } from "../application/media.ports.ts";
import { mediaPublicUrl } from "../application/media.usecases.ts";

interface MediaRow {
  id: string;
  tenantId: string | null;
  purpose: string;
  key: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  questionId: string | null;
  answerIndex: number | null;
  createdAt: Date;
}

function mapRow(row: MediaRow): MediaAssetRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    purpose: row.purpose as MediaPurpose,
    key: row.key,
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    questionId: row.questionId,
    answerIndex: row.answerIndex,
    createdAt: row.createdAt.toISOString(),
    url: mediaPublicUrl(row.id),
  };
}

/** Prisma adapter for the media metadata store. */
export class MediaRepository implements MediaStore {
  async create(input: CreateMediaInput): Promise<MediaAssetRecord> {
    const row = await prisma.mediaAsset.create({
      data: {
        tenantId: input.tenantId,
        purpose: input.purpose,
        key: input.key,
        mimeType: input.mimeType,
        size: input.size,
        width: input.width,
        height: input.height,
        checksum: input.checksum,
        questionId: input.questionId,
        answerIndex: input.answerIndex,
      },
    });
    return mapRow(row);
  }

  async findById(id: string): Promise<MediaAssetRecord | null> {
    const row = await prisma.mediaAsset.findUnique({ where: { id } });
    return row ? mapRow(row) : null;
  }

  async list(filter: ListMediaFilter): Promise<MediaAssetRecord[]> {
    const tenantScope =
      filter.includeShared || filter.tenantId === null
        ? filter.tenantId === null
          ? { tenantId: null }
          : { OR: [{ tenantId: filter.tenantId }, { tenantId: null }] }
        : { tenantId: filter.tenantId };

    const rows = await prisma.mediaAsset.findMany({
      where: {
        ...tenantScope,
        ...(filter.purpose ? { purpose: filter.purpose } : {}),
        ...(filter.questionId ? { questionId: filter.questionId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(mapRow);
  }

  async deleteById(id: string): Promise<void> {
    await prisma.mediaAsset.delete({ where: { id } });
  }

  async attach(
    id: string,
    reference: { questionId: string | null; answerIndex: number | null },
  ): Promise<void> {
    await prisma.mediaAsset.update({
      where: { id },
      data: { questionId: reference.questionId, answerIndex: reference.answerIndex },
    });
  }
}
