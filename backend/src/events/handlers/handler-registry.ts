import type { EventHandler } from "./event-handler.ts";

/**
 * In-memory index of handlers by event type. The dispatcher resolves the
 * subscriber list for a claimed message through this registry.
 */
export class EventHandlerRegistry {
  private readonly byType = new Map<string, EventHandler<never>[]>();
  private readonly consumers = new Set<string>();

  register(handler: EventHandler): this {
    if (this.consumers.has(handler.consumer)) {
      throw new Error(`Duplicate event consumer registered: ${handler.consumer}`);
    }
    this.consumers.add(handler.consumer);

    for (const type of handler.eventTypes) {
      const list = this.byType.get(type) ?? [];
      list.push(handler as EventHandler<never>);
      this.byType.set(type, list);
    }
    return this;
  }

  registerAll(handlers: readonly EventHandler[]): this {
    for (const handler of handlers) this.register(handler);
    return this;
  }

  handlersFor(eventType: string): readonly EventHandler<never>[] {
    return this.byType.get(eventType) ?? [];
  }

  /** True when at least one handler is subscribed to `eventType`. */
  hasSubscription(eventType: string): boolean {
    return (this.byType.get(eventType)?.length ?? 0) > 0;
  }

  get size(): number {
    return this.consumers.size;
  }
}
