-- Fase 3: locally-stored media assets + optional per-answer images.

-- AlterTable: per-answer images, parallel to the `options` array.
ALTER TABLE "questions" ADD COLUMN "option_images" JSONB;

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('QUESTION', 'ANSWER', 'LABORATORY');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "purpose" "MediaPurpose" NOT NULL DEFAULT 'QUESTION',
    "storage_key" VARCHAR(400) NOT NULL,
    "mime_type" VARCHAR(80) NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" VARCHAR(64),
    "question_id" UUID,
    "answer_index" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_tenant_id_idx" ON "media_assets"("tenant_id");

-- CreateIndex
CREATE INDEX "media_assets_purpose_idx" ON "media_assets"("purpose");

-- CreateIndex
CREATE INDEX "media_assets_question_id_idx" ON "media_assets"("question_id");
