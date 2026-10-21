ALTER TABLE "quizzes" ADD COLUMN "created_by_id" UUID;
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "quizzes_created_by_id_idx" ON "quizzes"("created_by_id");
