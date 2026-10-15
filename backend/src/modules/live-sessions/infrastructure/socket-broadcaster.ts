import type { Server as SocketServer } from "socket.io";
import type { GameBroadcaster } from "../application/ports.ts";

/** Room naming conventions for live sessions. */
export const Rooms = {
  session: (sessionId: string) => `session:${sessionId}`,
  host: (sessionId: string) => `host:${sessionId}`,
  player: (playerId: string) => `player:${playerId}`,
} as const;

/**
 * Socket.IO implementation of the engine's `GameBroadcaster` port.
 *
 * The engine publishes semantic events; this adapter is the only place that
 * knows about rooms and the wire.
 */
export class SocketGameBroadcaster implements GameBroadcaster {
  constructor(private readonly io: SocketServer) {}

  toSession(sessionId: string, event: string, payload: unknown): void {
    this.io.to(Rooms.session(sessionId)).emit(event, payload);
  }

  toHost(sessionId: string, event: string, payload: unknown): void {
    this.io.to(Rooms.host(sessionId)).emit(event, payload);
  }

  toPlayer(playerId: string, event: string, payload: unknown): void {
    this.io.to(Rooms.player(playerId)).emit(event, payload);
  }
}
