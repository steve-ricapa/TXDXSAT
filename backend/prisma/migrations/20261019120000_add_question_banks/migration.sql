CREATE TYPE "QuestionBankModule" AS ENUM ('PHISHING', 'INTERNET_SECURITY', 'MALICIOUS_EMAILS');

CREATE TABLE "question_banks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "module" "QuestionBankModule" NOT NULL,
    "description" TEXT,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "question_bank_items" (
    "id" UUID NOT NULL,
    "bank_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "correct_index" INTEGER,
    "correct_indices" JSONB,
    "correct_text" TEXT,
    "range_min" INTEGER,
    "range_max" INTEGER,
    "correct_number" INTEGER,
    "explanation" TEXT,
    "image_url" TEXT,
    "option_images" JSONB,
    "base_score" INTEGER NOT NULL DEFAULT 500,
    "time_sec" INTEGER NOT NULL DEFAULT 20,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "question_bank_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "question_banks_tenant_id_idx" ON "question_banks"("tenant_id");
CREATE INDEX "question_banks_module_idx" ON "question_banks"("module");
CREATE INDEX "question_banks_is_shared_idx" ON "question_banks"("is_shared");
CREATE UNIQUE INDEX "question_bank_items_bank_id_order_index_key" ON "question_bank_items"("bank_id", "order_index");
CREATE INDEX "question_bank_items_bank_id_idx" ON "question_bank_items"("bank_id");

ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_bank_items" ADD CONSTRAINT "question_bank_items_bank_id_fkey"
  FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
