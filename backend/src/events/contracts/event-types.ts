import { newId } from "../../shared/utils/id.ts";
import { currentCorrelationId } from "../../shared/middleware/request-context.ts";
import type { DomainEvent, DomainEventMetadata } from "./domain-event.ts";

/**
 * Event catalogue.
 *
 * `EventTypes` is the single source of truth for event names. `DomainEventPayloadMap`
 * binds each known event type to its payload, giving compile-time safety at both
 * publish sites (through `EventPublisher.publish`) and handler sites. The map stays
 * open (`DomainEventNameFrom` accepts any string) so modules can introduce new
 * events without editing a central union.
 */
export const EventTypes = {
  /** Technical smoke-test event used to validate the outbox pipeline. */
  SystemTestEvent: "system.test_event.v1",
  /** Emitted once a live training session's results are consolidated. */
  LiveSessionFinished: "live_session.finished.v1",
} as const;

export type SystemEventType = (typeof EventTypes)[keyof typeof EventTypes];

export interface SystemTestEventPayload {
  message: string;
  issuedBy?: string | null;
  /**
   * When true the reference handler throws, exercising retry/backoff and the
   * terminal FAILED (dead-letter) path plus manual requeue. Only meaningful for
   * the technical smoke-test event.
   */
  simulateFailure?: boolean;
}

/** Reserved for later phases — documents the intended event vocabulary. */
export interface PlannedEventPayloadMap {
  "training.assigned.v1": { trainingId: string; employeeId: string };
  "training.completed.v1": { trainingId: string; employeeId: string; score: number };
  "assessment.completed.v1": { assessmentId: string; employeeId: string; score: number };
  "certificate.issued.v1": { certificateId: string; employeeId: string };
  "laboratory.completed.v1": { laboratoryId: string; employeeId: string };
}

/** One player's final standing, embedded in the finished-session event. */
export interface LiveSessionResultEntry {
  rank: number;
  playerId: string;
  username: string;
  avatar: string;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
}

/** Payload of `live_session.finished.v1`. Durable business fact: the results. */
export interface LiveSessionFinishedPayload {
  sessionId: string;
  quizId: string;
  quizTitle: string;
  participantCount: number;
  finishedAt: string;
  leaderboard: LiveSessionResultEntry[];
}

export interface DomainEventPayloadMap {
  "system.test_event.v1": SystemTestEventPayload;
  "live_session.finished.v1": LiveSessionFinishedPayload;
}

export type KnownEventType = keyof DomainEventPayloadMap;

/** Extract the version number encoded in a `name.vN` event type. */
export type VersionOf<T extends string> =
  T extends `${string}.v${infer V extends number}` ? V : number;

/** Strongly-typed event for a known event type. */
export type TypedDomainEvent<K extends KnownEventType> = DomainEvent<
  DomainEventPayloadMap[K]
> & { eventType: K; version: VersionOf<K> };

/**
 * Build a fully-populated domain event. Plumbing fields default sensibly:
 * `eventId`/`occurredAt` are generated and `correlationId` is inherited from the
 * ambient request context when available.
 */
export function createDomainEvent<K extends string, P>(
  eventType: K,
  payload: P,
  metadata: DomainEventMetadata = {},
): DomainEvent<P> {
  const version = parseVersion(eventType);
  return {
    eventId: metadata.eventId ?? newId(),
    eventType,
    version,
    tenantId: metadata.tenantId ?? null,
    occurredAt: metadata.occurredAt ?? new Date().toISOString(),
    payload,
    correlationId: metadata.correlationId ?? currentCorrelationId(),
    causationId: metadata.causationId ?? null,
  };
}

/** Parse the trailing `.vN` of an event type; defaults to 1. */
export function parseVersion(eventType: string): number {
  const match = /\.v(\d+)$/.exec(eventType);
  return match?.[1] ? Number.parseInt(match[1], 10) : 1;
}
