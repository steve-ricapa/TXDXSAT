/**
 * Media module domain types.
 *
 * A media asset is the *descriptor* of a stored image; the bytes live on the
 * persistent volume behind the `FileStorage` port. Nothing here knows about
 * Prisma or Express.
 */

export const MEDIA_PURPOSES = ["QUESTION", "ANSWER", "LABORATORY"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export interface MediaAssetRecord {
  id: string;
  tenantId: string | null;
  purpose: MediaPurpose;
  /** Internal relative storage path (never exposed to clients). */
  key: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  questionId: string | null;
  answerIndex: number | null;
  createdAt: string;
  /** Public, deployment-relative URL (e.g. `/api/v1/media/<id>`). */
  url: string;
}

/** Maps a purpose to its storage sub-directory. */
export function purposeFolder(purpose: MediaPurpose): string {
  switch (purpose) {
    case "QUESTION":
      return "questions";
    case "ANSWER":
      return "answers";
    case "LABORATORY":
      return "laboratories";
  }
}
