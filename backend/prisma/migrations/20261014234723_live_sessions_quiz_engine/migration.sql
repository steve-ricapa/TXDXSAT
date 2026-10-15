-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_SELECT', 'OPEN_TEXT', 'CLOSEST_TO');

-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED');

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "language" VARCHAR(10) NOT NULL DEFAULT 'es',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
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
    "base_score" INTEGER NOT NULL DEFAULT 500,
    "time_sec" INTEGER NOT NULL DEFAULT 20,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "quiz_id" UUID NOT NULL,
    "pin" VARCHAR(6) NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'WAITING',
    "current_question_index" INTEGER NOT NULL DEFAULT -1,
    "host_token" VARCHAR(80) NOT NULL,
    "view_token" VARCHAR(80) NOT NULL,
    "participant_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_players" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "tenant_id" UUID,
    "username" VARCHAR(30) NOT NULL,
    "avatar" VARCHAR(40) NOT NULL DEFAULT 'shield',
    "score" INTEGER NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_answers" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "tenant_id" UUID,
    "player_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "chosen_index" INTEGER NOT NULL DEFAULT -1,
    "chosen_indices" JSONB,
    "chosen_text" TEXT,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "answer_order" INTEGER NOT NULL DEFAULT 0,
    "answered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quizzes_tenant_id_idx" ON "quizzes"("tenant_id");

-- CreateIndex
CREATE INDEX "questions_quiz_id_idx" ON "questions"("quiz_id");

-- CreateIndex
CREATE UNIQUE INDEX "questions_quiz_id_order_index_key" ON "questions"("quiz_id", "order_index");

-- CreateIndex
CREATE INDEX "live_sessions_pin_idx" ON "live_sessions"("pin");

-- CreateIndex
CREATE INDEX "live_sessions_tenant_id_idx" ON "live_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "live_sessions_status_idx" ON "live_sessions"("status");

-- CreateIndex
CREATE INDEX "live_players_session_id_idx" ON "live_players"("session_id");

-- CreateIndex
CREATE INDEX "live_players_tenant_id_idx" ON "live_players"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_players_session_id_username_key" ON "live_players"("session_id", "username");

-- CreateIndex
CREATE INDEX "live_answers_session_id_idx" ON "live_answers"("session_id");

-- CreateIndex
CREATE INDEX "live_answers_tenant_id_idx" ON "live_answers"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_answers_player_id_question_id_key" ON "live_answers"("player_id", "question_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_players" ADD CONSTRAINT "live_players_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_answers" ADD CONSTRAINT "live_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_answers" ADD CONSTRAINT "live_answers_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "live_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
