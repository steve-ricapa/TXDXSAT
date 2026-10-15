import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import type { Logger } from "pino";
import { env } from "../shared/config/env.ts";
import type { EventBus } from "../events/bus/event-bus.ts";

export interface RealtimeDeps {
  logger: Logger;
  bus: EventBus;
  corsOrigin: string[] | boolean;
}

export interface RealtimeServer {
  io: SocketServer;
  close(): Promise<void>;
}

/**
 * Socket.IO attachment point.
 *
 * Fase 1 wires transport, CORS and lifecycle only, plus an ephemeral bridge that
 * mirrors durably-processed domain events to connected clients (`domain:event`).
 * Fase 2 registers the live-session game handlers on the same server instance.
 */
export function createRealtimeServer(
  httpServer: HttpServer,
  deps: RealtimeDeps,
): RealtimeServer {
  const io = new SocketServer(httpServer, {
    path: env.SOCKET_PATH,
    serveClient: false,
    cors: { origin: deps.corsOrigin, credentials: true },
    // Behind Nginx we only need websocket + polling.
    transports: ["websocket", "polling"],
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  io.on("connection", (socket) => {
    deps.logger.debug({ socketId: socket.id }, "realtime client connected");
    socket.join("system");

    socket.on("disconnect", (reason) => {
      deps.logger.debug({ socketId: socket.id, reason }, "realtime client disconnected");
    });
  });

  // Ephemeral fan-out of processed domain events (observability/demo only).
  const unsubscribe = deps.bus.on("domain:*", (event) => {
    io.to("system").emit("domain:event", event);
  });

  return {
    io,
    async close(): Promise<void> {
      unsubscribe();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
