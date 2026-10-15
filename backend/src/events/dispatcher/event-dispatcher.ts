import type { OutboxStats } from "../outbox/outbox.types.ts";

/** Outcome counters for a single dispatch tick. */
export interface DispatchTickResult {
  claimed: number;
  processed: number;
  failed: number;
  duplicateSkips: number;
}

export interface DispatcherStats extends OutboxStats {
  running: boolean;
  workerId: string;
  lastRunAt: string | null;
  lastError: string | null;
  ticks: number;
}

/**
 * Transport-agnostic dispatcher port.
 *
 * The in-process `OutboxEventDispatcher` polls PostgreSQL. A future Node service
 * could implement this interface against Amazon SQS/EventBridge (long-poll +
 * delete-on-success), or be replaced entirely by Lambda invocations — application
 * and domain code never depend on the polling mechanism, only on the event
 * contracts and the `EventPublisher`/`EventHandler` ports.
 */
export interface EventDispatcher {
  /** Begin the background polling loop (idempotent). */
  start(): void;
  /** Stop the loop and await the in-flight tick. */
  stop(): Promise<void>;
  /** Process one batch synchronously; used by tests and the recovery endpoint. */
  runOnce(): Promise<DispatchTickResult>;
  stats(): Promise<DispatcherStats>;
}
