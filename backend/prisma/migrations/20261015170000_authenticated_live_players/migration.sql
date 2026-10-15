ALTER TYPE "UserRole" ADD VALUE 'EMPLOYEE';

ALTER TABLE "live_players" ADD COLUMN "user_id" UUID;

CREATE UNIQUE INDEX "live_players_session_id_user_id_key" ON "live_players"("session_id", "user_id");

ALTER TABLE "live_players" ADD CONSTRAINT "live_players_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
