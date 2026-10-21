CREATE TYPE "EnrollmentStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

ALTER TABLE "users" ADD COLUMN "enrollment_status" "EnrollmentStatus" NOT NULL DEFAULT 'APPROVED';

CREATE TABLE "enrollment_invites" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "created_by_id" UUID NOT NULL,
  "max_uses" INTEGER NOT NULL DEFAULT 100,
  "uses" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enrollment_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "enrollment_invites_token_hash_key" ON "enrollment_invites"("token_hash");
CREATE INDEX "enrollment_invites_tenant_id_created_at_idx" ON "enrollment_invites"("tenant_id", "created_at");
ALTER TABLE "enrollment_invites" ADD CONSTRAINT "enrollment_invites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrollment_invites" ADD CONSTRAINT "enrollment_invites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
