import { api } from "./api-client";

export interface HealthReport {
  status: "ok" | "degraded";
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  checks: { database: "up" | "down"; dispatcher: "running" | "stopped" | "disabled" };
  outbox?: {
    pending: number;
    processing: number;
    processed: number;
    failed: number;
    oldestPendingAt: string | null;
  };
}

export interface PublishTestEventResult {
  eventId: string;
  eventType: string;
  correlationId: string;
}

export interface DomainEventSummary {
  eventId: string;
  eventType: string;
  tenantId: string | null;
  occurredAt: string;
}

export interface OutboxInspection {
  stats: {
    pending: number;
    processing: number;
    processed: number;
    failed: number;
    oldestPendingAt: string | null;
  };
  dispatcher: {
    running: boolean;
    workerId: string;
    ticks: number;
    lastRunAt: string | null;
    lastError: string | null;
  };
  recentProcessed: DomainEventSummary[];
}

/** Typed access to the platform/system API surface. */
export const systemApi = {
  getHealth: () => api.get<HealthReport>("/health"),
  inspectOutbox: () => api.get<OutboxInspection>("/system/outbox"),
  publishTestEvent: (message: string) =>
    api.post<PublishTestEventResult>("/system/test-event", { message }),
};
