import { EventEmitter } from "node:events";
import type { DomainEvent } from "../contracts/domain-event.ts";

/**
 * Lightweight, strongly-typed, in-process publish/subscribe channel.
 *
 * Scope: **ephemeral, non-durable** notifications only — e.g. broadcasting a
 * "leaderboard changed" hint to connected Socket.IO clients, or invalidating a
 * cache. It is intentionally NOT the delivery mechanism for business events:
 * an in-memory emitter loses messages on restart and cannot fan out across
 * instances. Durable business events always go through the transactional outbox.
 */
export class EventBus {
  private readonly emitter = new EventEmitter({ captureRejections: false });

  constructor() {
    // Realtime fan-out can have many transient subscribers per socket.
    this.emitter.setMaxListeners(0);
  }

  /** Subscribe to a channel. Returns an unsubscribe function. */
  on<T = unknown>(
    channel: string,
    listener: (payload: T) => void,
  ): () => void {
    const wrapped = (payload: T) => listener(payload);
    this.emitter.on(channel, wrapped as (value: unknown) => void);
    return () => this.emitter.off(channel, wrapped as (value: unknown) => void);
  }

  /** Publish a payload to all subscribers of `channel`. Never throws. */
  emit<T = unknown>(channel: string, payload: T): void {
    this.emitter.emit(channel, payload);
  }

  /** Publish a domain event that has been durably processed. */
  emitDomainEvent(event: DomainEvent): void {
    this.emit(`domain:${event.eventType}`, event);
    this.emit("domain:*", event);
  }
}

/** Well-known ephemeral channels. */
export const BusChannels = {
  domainEventProcessed: "domain:*",
} as const;
