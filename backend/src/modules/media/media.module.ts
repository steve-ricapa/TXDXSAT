import type { Logger } from "pino";
import { env } from "../../shared/config/env.ts";
import { LocalFileStorage } from "../../shared/storage/local-file-storage.ts";
import {
  DeleteMediaUseCase,
  GetMediaUseCase,
  ListMediaUseCase,
  UploadMediaUseCase,
} from "./application/media.usecases.ts";
import { MediaRepository } from "./infrastructure/media.repository.ts";
import { createMediaRouter } from "./presentation/media.routes.ts";

export interface MediaModuleDeps {
  logger: Logger;
}

/**
 * Media module factory.
 *
 * Wires the storage adapter, the Prisma metadata store and the use cases. The
 * storage driver is selected here; adding S3 later is a one-line change plus the
 * new adapter — nothing downstream moves.
 */
export function createMediaModule(deps: MediaModuleDeps) {
  const storage = new LocalFileStorage(env.STORAGE_DIR);
  const store = new MediaRepository();

  const router = createMediaRouter({
    uploadMedia: new UploadMediaUseCase(store, storage, deps.logger),
    getMedia: new GetMediaUseCase(store, storage),
    listMedia: new ListMediaUseCase(store),
    deleteMedia: new DeleteMediaUseCase(store, storage, deps.logger),
  });

  return { router };
}
