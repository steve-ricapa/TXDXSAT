import { hostname } from "node:os";
import type { Logger } from "pino";
import { withTransaction } from "../../shared/database/prisma.ts";
import type { EventHandlerRegistry } from "../handlers/handler-registry.ts";
import type { EventHandler } from "../handlers/event-handler.ts";
import type { OutboxMessage, OutboxStore } from "../outbox/outbox.types.ts";
import { outboxMessageToEvent } from "../outbox/outbox.types.ts";
import type {
  DispatchTickResult,
  DispatcherStats,
  EventDispatcher,
} from "./event-dispatcher.ts";

export interface OutboxDispatcherOptions {
  workerId?: string;
  intervalMs?: number;
  batchSize?: number;
  maxAttempts?: number;
  leaseMs?: number;
  backoffMs?: number;
  /** How often to sweep leases left behind by crashed workers. */
  recoveryIntervalMs?: number;
}

/**
 * Pull-based dispatcher that drains the transactional outbox.
 *
 * Guarantees:
 *  * **No lost events** — messages are only removed from the working set after a
 *    successful handler run; failures are retried with backoff up to
 *    `maxAttempts`, then parked as FAILED.
 *  * **No accidental concurrent processing** — claims use
 *    `FOR UPDATE SKIP LOCKED` plus a per-message lease; stale leases are recovered.
 *  * **At-least-once delivery** — a crash between handler commit and
 *    PROCESSED marking replays the message; consumers are idempotent because the
 *    `EventConsumption` marker commits with the handler's writes.
 */
export class OutboxEventDispatcher implements EventDispatcher {
  private readonly workerId: string;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly leaseMs: number;
  private readonly backoffMs: number;
  private readonly recoveryIntervalMs: number;

  private timer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;
  private running = false;
  private ticks = 0;
  private lastRunAt: string | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly store: OutboxStore,
    private readonly registry: EventHandlerRegistry,
    private readonly logger: Logger,
    options: OutboxDispatcherOptions = {},
  ) {
    this.workerId =
      options.workerId ?? `${hostname()}:${process.pid}:${Math.random().toString(36).slice(2, 8)}`;
    this.intervalMs = options.intervalMs ?? 1000;
    this.batchSize = options.batchSize ?? 25;
    // `maxAttempts` is persisted per-message by the publisher, so the dispatcher
    // reads it from the row rather than holding it in memory.
    this.leaseMs = options.leaseMs ?? 30_000;
    this.backoffMs = options.backoffMs ?? 5_000;
    this.recoveryIntervalMs = options.recoveryIntervalMs ?? 15_000;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref?.();

    this.recoveryTimer = setInterval(() => void this.recover(), this.recoveryIntervalMs);
    this.recoveryTimer.unref?.();

    // Kick off immediately so the first message is not delayed by one interval.
    void this.tick();

    this.logger.info(
      { workerId: this.workerId, intervalMs: this.intervalMs, batchSize: this.batchSize },
      "outbox dispatcher started",
    );
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
    this.timer = null;
    this.recoveryTimer = null;
    if (this.inFlight) await this.inFlight;
    this.logger.info({ workerId: this.workerId }, "outbox dispatcher stopped");
  }

  async runOnce(): Promise<DispatchTickResult> {
    return this.dispatchBatch();
  }

  async stats(): Promise<DispatcherStats> {
    const base = await this.store.stats();
    return {
      ...base,
      running: this.running,
      workerId: this.workerId,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
      ticks: this.ticks,
    };
  }

  /** Serialise ticks: never run two batches concurrently in one process. */
  private async tick(): Promise<void> {
    if (this.inFlight) return;
    const run = this.dispatchBatch()
      .then(() => {
        this.ticks += 1;
        this.lastRunAt = new Date().toISOString();
      })
      .catch((error: unknown) => {
        this.lastError = error instanceof Error ? error.message : String(error);
        this.logger.error({ err: error }, "dispatcher tick failed");
      })
      .finally(() => {
        this.inFlight = null;
      });
    this.inFlight = run;
    await run;
  }

  private async recover(): Promise<void> {
    try {
      const recovered = await this.store.recoverStaleLeases(this.leaseMs);
      if (recovered > 0) {
        this.logger.warn({ recovered }, "recovered stale outbox leases");
      }
    } catch (error) {
      this.logger.error({ err: error }, "lease recovery failed");
    }
  }

  private async dispatchBatch(): Promise<DispatchTickResult> {
    const messages = await this.store.claimBatch(this.workerId, this.batchSize);
    const result: DispatchTickResult = {
      claimed: messages.length,
      processed: 0,
      failed: 0,
      duplicateSkips: 0,
    };

    for (const message of messages) {
      const ok = await this.processMessage(message, result);
      if (ok) result.processed += 1;
      else result.failed += 1;
    }

    if (messages.length > 0) {
      this.logger.debug({ ...result, workerId: this.workerId }, "dispatch batch complete");
    }
    return result;
  }

  /** Returns true when the message reached a successful/terminal-dup state. */
  private async processMessage(
    message: OutboxMessage,
    result: DispatchTickResult,
  ): Promise<boolean> {
    const handlers = this.registry.handlersFor(message.eventType);

    if (handlers.length === 0) {
      this.logger.warn(
        { eventId: message.eventId, eventType: message.eventType },
        "no handler subscribed; marking processed",
      );
      await this.store.markProcessed(message.id);
      return true;
    }

    try {
      for (const handler of handlers) {
        const outcome = await this.runHandler(handler, message);
        if (outcome === "duplicate") result.duplicateSkips += 1;
      }
      await this.store.markProcessed(message.id);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const backoff = this.computeBackoff(message.attempts);
      const outcome = await this.store.markFailed(message.id, reason, backoff);
      this.logger.warn(
        {
          eventId: message.eventId,
          eventType: message.eventType,
          attempts: outcome.attempts,
          status: outcome.status,
          err: error,
        },
        outcome.status === "FAILED"
          ? "event moved to terminal FAILED after retries exhausted"
          : "event handler failed; scheduled for retry",
      );
      return false;
    }
  }

  /**
   * Execute one handler inside a transaction, writing the idempotency marker
   * atomically with the handler's own writes.
   */
  private async runHandler(
    handler: EventHandler<never>,
    message: OutboxMessage,
  ): Promise<"processed" | "duplicate"> {
    const event = outboxMessageToEvent(message);

    return withTransaction(async (tx) => {
      const existing = await tx.eventConsumption.findUnique({
        where: {
          consumer_eventId: { consumer: handler.consumer, eventId: message.eventId },
        },
        select: { id: true },
      });

      if (existing) return "duplicate";

      await handler.handle(event as never, {
        tx,
        logger: this.logger.child({ consumer: handler.consumer }),
        workerId: this.workerId,
      });

      await tx.eventConsumption.create({
        data: {
          consumer: handler.consumer,
          eventId: message.eventId,
          eventType: message.eventType,
          tenantId: message.tenantId,
        },
      });

      return "processed";
    });
  }

  /** Exponential backoff capped at 5 minutes. */
  private computeBackoff(attempts: number): number {
    const base = this.backoffMs * 2 ** Math.max(0, attempts - 1);
    return Math.min(base, 5 * 60_000);
  }
}
