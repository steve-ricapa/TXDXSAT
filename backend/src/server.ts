import { createServer, type Server as HttpServer } from "node:http";
import { env } from "./shared/config/env.ts";
import { createLogger, logger } from "./shared/utils/logger.ts";
import { connectDatabase, disconnectDatabase } from "./shared/database/prisma.ts";
import { EventBus } from "./events/bus/event-bus.ts";
import { PrismaOutboxStore } from "./events/outbox/outbox.store.ts";
import { OutboxEventPublisher } from "./events/publishers/outbox-event-publisher.ts";
import { OutboxEventDispatcher } from "./events/dispatcher/outbox-dispatcher.ts";
import { EventHandlerRegistry } from "./events/handlers/handler-registry.ts";
import { SystemTestEventHandler } from "./events/handlers/system-test-event.handler.ts";
import { LiveSessionFinishedHandler } from "./modules/live-sessions/infrastructure/live-session-finished.handler.ts";
import { createApp } from "./app/app.ts";
import type { AppDependencies } from "./app/dependencies.ts";
import { createRealtimeServer } from "./realtime/socket.ts";
import { createLiveSessionModule } from "./modules/live-sessions/live-sessions.module.ts";
import { ensureSuperadmin } from "./modules/auth/infrastructure/bootstrap.ts";
import { ensureDemoData } from "./modules/system/infrastructure/seed-demo.ts";

/**
 * Composition root.
 *
 * This is the ONLY place that instantiates concrete infrastructure and wires it
 * together. Modules receive collaborators through their `createXModule()`
 * factory, so they stay framework-agnostic and testable.
 */
async function bootstrap(): Promise<void> {
  logger.info(
    { env: env.NODE_ENV, version: env.APP_VERSION },
    "starting TXDXSAT backend",
  );

  await connectDatabase();
  logger.info("database connection established");

  // --- Auth & Demo bootstrap -----------------------------------------------
  // Bootstrap the first superadmin independently from optional demo fixtures.
  await ensureSuperadmin(logger);
  if (env.SEED_DEMO_DATA) await ensureDemoData(logger);

  // --- Event infrastructure ------------------------------------------------
  const bus = new EventBus();
  const outboxStore = new PrismaOutboxStore();
  const publisher = new OutboxEventPublisher(outboxStore, env.DISPATCHER_MAX_ATTEMPTS);

  const registry = new EventHandlerRegistry()
    .register(new SystemTestEventHandler(bus))
    .register(new LiveSessionFinishedHandler(bus));

  const dispatcher = new OutboxEventDispatcher(outboxStore, registry, createLogger("dispatcher"), {
    intervalMs: env.DISPATCHER_INTERVAL_MS,
    batchSize: env.DISPATCHER_BATCH_SIZE,
    maxAttempts: env.DISPATCHER_MAX_ATTEMPTS,
    leaseMs: env.DISPATCHER_LEASE_MS,
    backoffMs: env.DISPATCHER_BACKOFF_MS,
    ...(env.DISPATCHER_WORKER_ID ? { workerId: env.DISPATCHER_WORKER_ID } : {}),
  });

  const deps: AppDependencies = {
    logger,
    publisher,
    dispatcher,
    outboxStore,
    bus,
  };

  // --- HTTP + realtime -----------------------------------------------------
  const app = createApp(deps);
  const httpServer: HttpServer = createServer(app);

  const corsOrigin: string[] | boolean =
    env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : env.NODE_ENV !== "production";
  const realtime = createRealtimeServer(httpServer, {
    logger: createLogger("realtime"),
    bus,
    corsOrigin,
  });

  // --- Live sessions --------------------------------------------------------
  const live = createLiveSessionModule({ logger: createLogger("live-sessions"), publisher });
  live.attachRealtime(realtime.io);
  await new Promise<void>((resolve) => {
    httpServer.listen(env.PORT, env.HOST, () => resolve());
  });
  logger.info(
    { host: env.HOST, port: env.PORT, api: env.API_PREFIX, socket: env.SOCKET_PATH },
    "http server listening",
  );

  if (env.DISPATCHER_ENABLED) {
    dispatcher.start();
  } else {
    logger.warn("dispatcher disabled by configuration; outbox will not be drained");
  }

  // --- Graceful shutdown ---------------------------------------------------
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutdown initiated");

    const timeout = setTimeout(() => {
      logger.error("shutdown timed out; forcing exit");
      process.exit(1);
    }, 10_000);
    timeout.unref();

    try {
      await dispatcher.stop();
      await realtime.close();
      await new Promise<void>((resolve, reject) =>
        httpServer.close((err) => (err ? reject(err) : resolve())),
      );
      await disconnectDatabase();
      logger.info("shutdown complete");
    } catch (error) {
      logger.error({ err: error }, "error during shutdown");
    } finally {
      clearTimeout(timeout);
      process.exit(0);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch((error: unknown) => {
  logger.error({ err: error }, "fatal error during startup");
  process.exit(1);
});
