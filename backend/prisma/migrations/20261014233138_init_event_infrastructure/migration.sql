-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tenant_id" UUID,
    "payload" JSONB NOT NULL,
    "correlation_id" UUID,
    "causation_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 10,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" VARCHAR(120),
    "last_error" TEXT,
    "dispatched_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_consumptions" (
    "id" UUID NOT NULL,
    "consumer" VARCHAR(120) NOT NULL,
    "event_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "tenant_id" UUID,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_locked_at_idx" ON "outbox_events"("status", "locked_at");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_idx" ON "outbox_events"("tenant_id");

-- CreateIndex
CREATE INDEX "outbox_events_event_type_idx" ON "outbox_events"("event_type");

-- CreateIndex
CREATE INDEX "event_consumptions_event_id_idx" ON "event_consumptions"("event_id");

-- CreateIndex
CREATE INDEX "event_consumptions_tenant_id_idx" ON "event_consumptions"("tenant_id");

-- CreateIndex
CREATE INDEX "event_consumptions_processed_at_idx" ON "event_consumptions"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_consumptions_consumer_event_id_key" ON "event_consumptions"("consumer", "event_id");
