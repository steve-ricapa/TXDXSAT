import type { Logger } from "pino";
import type { EventPublisher } from "../../events/publishers/event-publisher.ts";
import { AuthenticateUseCase } from "../auth/application/auth.usecases.ts";
import { AuthRepository } from "../auth/infrastructure/auth.repository.ts";
import type { DatabaseClient } from "../../shared/database/prisma.ts";
import type { DomainEvent } from "../../events/contracts/domain-event.ts";
import { GameEngine, type GameEngineOptions } from "./application/game-engine.ts";
import {
  CreateLiveSessionUseCase,
  CreateQuizUseCase,
  GetQuizDetailUseCase,
  GetSessionResultsUseCase,
  ListQuizzesUseCase,
  UpdateQuizUseCase,
} from "./application/live-session.usecases.ts";
import type { GameBroadcaster } from "./application/ports.ts";
import { LiveSessionRepository } from "./infrastructure/live-session.repository.ts";
import { SocketGameBroadcaster } from "./infrastructure/socket-broadcaster.ts";
import { registerLiveSessionSocketHandlers } from "./presentation/live-session.socket.ts";
import { createLiveSessionRouter } from "./presentation/live-session.routes.ts";

export interface LiveSessionModuleDeps {
  logger: Logger;
  publisher: EventPublisher;
}

export interface LiveSessionModuleConfig {
  engine?: GameEngineOptions;
}

/**
 * Deferred broadcaster: the engine is created immediately, but Socket.IO is
 * attached later (because the app/HTTP are wired before `io` exists). The
 * adapter fills in the target once `attachRealtime` runs.
 */
class DeferredBroadcaster implements GameBroadcaster {
  private target: GameBroadcaster | null = null;

  setTarget(target: GameBroadcaster): void {
    this.target = target;
  }

  toSession(sessionId: string, event: string, payload: unknown): void {
    this.target?.toSession(sessionId, event, payload);
  }

  toHost(sessionId: string, event: string, payload: unknown): void {
    this.target?.toHost(sessionId, event, payload);
  }

  toPlayer(playerId: string, event: string, payload: unknown): void {
    this.target?.toPlayer(playerId, event, payload);
  }
}

/** Minimal sink to satisfy the engine's DomainEventSink contract. */
class PublisherSink {
  constructor(private readonly publisher: EventPublisher) {}

  publish(
    event: DomainEvent,
    options?: { transaction?: DatabaseClient },
  ): Promise<void> {
    return this.publisher.publish(event, options);
  }
}

/**
 * Composition root for the `live-sessions` module.
 *
 * Returns the REST router, the in-memory game engine, and an `attachRealtime`
 * function that wires Socket.IO and the broadcaster. Everything is built from
 * explicit dependencies; no singletons are imported by the domain/presentation.
 */
export function createLiveSessionModule(
  deps: LiveSessionModuleDeps,
  config: LiveSessionModuleConfig = {},
) {
  const repository = new LiveSessionRepository();
  const deferred = new DeferredBroadcaster();
  const sink = new PublisherSink(deps.publisher);
  const engine = new GameEngine(repository, sink, deferred, deps.logger, config.engine ?? {});

  const useCases = {
    store: repository,
    createQuiz: new CreateQuizUseCase(repository),
    listQuizzes: new ListQuizzesUseCase(repository),
    getQuizDetail: new GetQuizDetailUseCase(repository),
    updateQuiz: new UpdateQuizUseCase(repository),
    createSession: new CreateLiveSessionUseCase(repository),
    getResults: new GetSessionResultsUseCase(repository),
  };

  const router = createLiveSessionRouter(useCases);

  return {
    router,
    engine,
    attachRealtime: (io: import("socket.io").Server) => {
      const broadcaster = new SocketGameBroadcaster(io);
      deferred.setTarget(broadcaster);
      registerLiveSessionSocketHandlers(io, engine, deps.logger, new AuthenticateUseCase(new AuthRepository()));
    },
  };
}
