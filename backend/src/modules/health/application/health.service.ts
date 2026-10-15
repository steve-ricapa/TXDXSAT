import type { Logger } from "pino";
import { pingDatabase } from "../../../shared/database/prisma.ts";
import { env } from "../../../shared/config/env.ts";
import type { EventDispatcher } from "../../../events/dispatcher/event-dispatcher.ts";

export type HealthStatus = "ok" | "degraded";

export interface HealthReport {
  status: HealthStatus;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    database: "up" | "down";
    dispatcher: "running" | "stopped" | "disabled";
  };
  outbox?: {
    pending: number;
    processing: number;
    processed: number;
    failed: number;
    oldestPendingAt: string | null;
  };
}

/**
 * Application service assembling the liveness/readiness report. It knows nothing
 * about HTTP; the controller maps it to a response and status code.
 */
export class HealthService {
  constructor(
    private readonly dispatcher: EventDispatcher,
    private readonly logger: Logger,
  ) {}

  async check(): Promise<{ report: HealthReport; healthy: boolean }> {
    const databaseUp = await pingDatabase();
    if (!databaseUp) {
      this.logger.error("health check: database unreachable");
    }

    let dispatcherState: HealthReport["checks"]["dispatcher"] = env.DISPATCHER_ENABLED
      ? "stopped"
      : "disabled";
    let outbox: HealthReport["outbox"];

    if (databaseUp) {
      const stats = await this.dispatcher.stats();
      if (env.DISPATCHER_ENABLED) {
        dispatcherState = stats.running ? "running" : "stopped";
      }
      outbox = {
        pending: stats.pending,
        processing: stats.processing,
        processed: stats.processed,
        failed: stats.failed,
        oldestPendingAt: stats.oldestPendingAt?.toISOString() ?? null,
      };
    }

    const healthy = databaseUp;
    return {
      healthy,
      report: {
        status: healthy ? "ok" : "degraded",
        service: env.APP_NAME,
        version: env.APP_VERSION,
        environment: env.NODE_ENV,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        checks: { database: databaseUp ? "up" : "down", dispatcher: dispatcherState },
        ...(outbox ? { outbox } : {}),
      },
    };
  }
}
