import { Router, type NextFunction, type Request, type Response } from "express";
import multer, { MulterError } from "multer";
import { env } from "../../../shared/config/env.ts";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.ts";
import { isUuid } from "../../../shared/utils/id.ts";
import { MEDIA_PURPOSES, type MediaPurpose } from "../domain/types.ts";
import type {
  DeleteMediaUseCase,
  GetMediaUseCase,
  ListMediaUseCase,
  UploadMediaUseCase,
} from "../application/media.usecases.ts";

export interface MediaRouterDeps {
  uploadMedia: UploadMediaUseCase;
  getMedia: GetMediaUseCase;
  listMedia: ListMediaUseCase;
  deleteMedia: DeleteMediaUseCase;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.STORAGE_MAX_BYTES, files: 1, fields: 20 },
});

/** Translate a multer failure into an operational (4xx) error. */
function toUploadError(error: unknown): unknown {
  if (error instanceof MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return new ValidationError(
        `Image exceeds the ${Math.round(env.STORAGE_MAX_BYTES / (1024 * 1024))} MB limit`,
      );
    }
    return new ValidationError(`Upload rejected: ${error.message}`);
  }
  return error;
}

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

/** Resolve the tenant scope from header, query or body (""/absent = shared). */
function tenantFromRequest(req: Request): string | null {
  const raw =
    req.header("x-tenant-id") ??
    (typeof req.query.tenantId === "string" ? req.query.tenantId : undefined) ??
    (typeof req.body?.tenantId === "string" ? req.body.tenantId : undefined);
  if (raw === undefined || raw === null || raw === "") return null;
  if (!isUuid(raw)) throw new ValidationError("tenantId must be a UUID");
  return raw;
}

function parsePurpose(value: unknown): MediaPurpose {
  if (value === undefined || value === null || value === "") return "QUESTION";
  if (typeof value === "string" && (MEDIA_PURPOSES as readonly string[]).includes(value)) {
    return value as MediaPurpose;
  }
  throw new ValidationError(`purpose must be one of: ${MEDIA_PURPOSES.join(", ")}`);
}

/**
 * REST surface of the media module (mounted at `/api/v1/media`).
 *
 * Upload/delete/list are tenant-scoped. Reads are capability URLs keyed by an
 * unguessable UUID so they can be embedded directly in `<img>` tags (which cannot
 * carry headers) — see docs/storage.md for the rationale and the migration
 * path to signed URLs.
 */
export function createMediaRouter(deps: MediaRouterDeps): Router {
  const router = Router();

  router.post(
    "/",
    (req, res, next) => {
      upload.single("file")(req, res, (error: unknown) => {
        if (error) return next(toUploadError(error));
        next();
      });
    },
    asyncHandler(async (req, res) => {
      const file = req.file;
      if (!file) throw new ValidationError("No file part named 'file' was provided");
      const answerIndexRaw = req.body?.answerIndex;
      const record = await deps.uploadMedia.execute({
        buffer: file.buffer,
        declaredMime: file.mimetype,
        tenantId: tenantFromRequest(req),
        purpose: parsePurpose(req.body?.purpose),
        questionId: typeof req.body?.questionId === "string" && req.body.questionId
          ? req.body.questionId
          : null,
        answerIndex:
          answerIndexRaw === undefined || answerIndexRaw === "" || answerIndexRaw === null
            ? null
            : Number(answerIndexRaw),
      });
      res.status(201).json(record);
    }),
  );

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const tenantId = tenantFromRequest(req);
      const purpose = req.query.purpose ? parsePurpose(req.query.purpose) : undefined;
      const assets = await deps.listMedia.execute({ tenantId, purpose });
      res.json({ assets });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      if (!isUuid(id)) throw new NotFoundError("Image not found");
      const { record, buffer } = await deps.getMedia.execute(id);
      res.setHeader("Content-Type", record.mimeType);
      res.setHeader("Content-Length", String(buffer.length));
      // Immutable: the id content never changes. `private` keeps shared caches
      // from retaining tenant images.
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      res.send(buffer);
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      if (!isUuid(id)) throw new NotFoundError("Image not found");
      await deps.deleteMedia.execute(id, tenantFromRequest(req));
      res.status(204).end();
    }),
  );

  return router;
}
