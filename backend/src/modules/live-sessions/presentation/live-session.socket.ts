import type { Server as SocketServer, Socket } from "socket.io";
import type { Logger } from "pino";
import { AppError, ForbiddenError, NotFoundError } from "../../../shared/errors/app-error.ts";
import { ClientEvents, ServerEvents } from "../domain/protocol.ts";
import type { GameEngine } from "../application/game-engine.ts";
import { Rooms } from "../infrastructure/socket-broadcaster.ts";

interface LiveSocketData {
  role?: "host" | "presenter" | "player";
  sessionId?: string;
  playerId?: string;
}

/** Register live-session Socket.IO handlers on the provided server. */
export function registerLiveSessionSocketHandlers(
  io: SocketServer,
  engine: GameEngine,
  logger: Logger,
): void {
  // Per-connection PIN brute-force guard: a socket may only fail a join a few
  // times before it is dropped. In-memory is sufficient because a reconnect
  // creates a fresh socket (and the search space is 900k PINs).
  const MAX_JOIN_ATTEMPTS = 8;
  const joinAttempts = new Map<string, number>();

  io.on("connection", (socket: Socket) => {
    const data = socket.data as LiveSocketData;

    socket.on(ClientEvents.hostJoin, async (payload: any) => {
      try {
        const sessionId = String(payload?.sessionId ?? "");
        const hostToken = String(payload?.hostToken ?? "");
        const session = await engine.loadForHost(sessionId, hostToken);

        data.role = "host";
        data.sessionId = session.id;
        await socket.join(Rooms.session(session.id));
        await socket.join(Rooms.host(session.id));

        socket.emit(ServerEvents.sessionState, engine.getState(session, { includeViewToken: true }));
        socket.emit(ServerEvents.gameLeaderboard, engine.getLeaderboard(session.id));
        const open = engine.getOpenQuestion(session);
        if (open) socket.emit(ServerEvents.gameQuestion, open);
      } catch (error: unknown) {
        sendError(socket, error, ClientEvents.hostJoin, logger);
      }
    });

    socket.on(ClientEvents.presentJoin, async (payload: any) => {
      try {
        const sessionId = String(payload?.sessionId ?? "");
        const viewToken = String(payload?.viewToken ?? "");
        const session = await engine.loadForPresenter(sessionId, viewToken);

        data.role = "presenter";
        data.sessionId = session.id;
        await socket.join(Rooms.session(session.id));

        socket.emit(ServerEvents.sessionState, engine.getState(session));
        socket.emit(ServerEvents.gameLeaderboard, engine.getLeaderboard(session.id));
        const open = engine.getOpenQuestion(session);
        if (open) socket.emit(ServerEvents.gameQuestion, open);
      } catch (error: unknown) {
        sendError(socket, error, ClientEvents.presentJoin, logger);
      }
    });

    socket.on(ClientEvents.playerJoin, async (payload: any) => {
      try {
        const pin = String(payload?.pin ?? "");
        const username = String(payload?.username ?? "");
        const avatar = payload?.avatar;
        const playerId = payload?.playerId;

        const session = await engine.findByPin(pin);
        if (!session) throw new NotFoundError("No live session with that PIN");

        const { player, reconnected } = await engine.joinPlayer({
          sessionId: session.id,
          username,
          avatar,
          playerId: playerId ? String(playerId) : undefined,
        });
        engine.bindSocket(session.id, player.id, socket.id);

        data.role = "player";
        data.sessionId = session.id;
        data.playerId = player.id;
        await socket.join(Rooms.session(session.id));
        await socket.join(Rooms.player(player.id));

        socket.emit(ServerEvents.playerJoinedAck, {
          playerId: player.id,
          sessionId: session.id,
          username: player.username,
          avatar: player.avatar,
          score: player.score,
          reconnected,
        });
        socket.emit(ServerEvents.sessionState, engine.getState(session));
        const open = engine.getOpenQuestion(session);
        if (open) socket.emit(ServerEvents.gameQuestion, open);
      } catch (error: unknown) {
        sendError(socket, error, ClientEvents.playerJoin, logger);
        if (error instanceof NotFoundError) {
          const attempts = (joinAttempts.get(socket.id) ?? 0) + 1;
          joinAttempts.set(socket.id, attempts);
          if (attempts >= MAX_JOIN_ATTEMPTS) {
            logger.warn({ socketId: socket.id }, "too many failed PIN attempts; disconnecting");
            socket.emit(ServerEvents.playerError, {
              event: ClientEvents.playerJoin,
              message: "Demasiados intentos. Vuelve a conectarte.",
            });
            socket.disconnect(true);
          }
        }
      }
    });

    socket.on(ClientEvents.hostStart, async (payload: any) => {
      try {
        const sessionId = requireHost(data, payload?.sessionId);
        await engine.start(sessionId);
      } catch (error: unknown) {
        sendError(socket, error, ClientEvents.hostStart, logger);
      }
    });

    socket.on(ClientEvents.hostReveal, async (payload: any) => {
      try {
        const sessionId = requireHost(data, payload?.sessionId);
        engine.reveal(sessionId);
      } catch (error: unknown) {
        sendError(socket, error, ClientEvents.hostReveal, logger);
      }
    });

    socket.on(ClientEvents.hostNext, async (payload: any) => {
      try {
        const sessionId = requireHost(data, payload?.sessionId);
        await engine.next(sessionId);
      } catch (error: unknown) {
        sendError(socket, error, ClientEvents.hostNext, logger);
      }
    });

    socket.on(ClientEvents.hostEnd, async (payload: any) => {
      try {
        const sessionId = requireHost(data, payload?.sessionId);
        await engine.end(sessionId);
      } catch (error: unknown) {
        sendError(socket, error, ClientEvents.hostEnd, logger);
      }
    });

    socket.on(ClientEvents.playerAnswer, async (payload: any) => {
      try {
        const sessionId = data.sessionId;
        const playerId = data.playerId;
        if (data.role !== "player" || !sessionId || !playerId) {
          throw new ForbiddenError("Only players can answer");
        }
        if (engine.playerForSocket(sessionId, socket.id) !== playerId) {
          throw new ForbiddenError("Socket is not bound to this player");
        }
        const { session, record } = await engine.submitAnswer({
          sessionId,
          playerId,
          questionId: String(payload?.questionId ?? ""),
          chosenIndex: payload?.chosenIndex,
          chosenIndices: payload?.chosenIndices,
          chosenText: payload?.chosenText,
        });
        const totalScore = session.players.get(playerId)?.score ?? 0;
        socket.emit(ServerEvents.answerAck, {
          questionId: record.questionId,
          received: true,
          isCorrect: record.isCorrect,
          score: record.score,
          totalScore,
        });
      } catch (error: unknown) {
        socket.emit(ServerEvents.playerError, {
          event: ClientEvents.playerAnswer,
          message: error instanceof AppError ? error.message : "Unexpected error",
        });
      }
    });

    socket.on("disconnect", () => {
      joinAttempts.delete(socket.id);
      engine.handleDisconnect(socket.id);
    });
  });
}

function requireHost(data: LiveSocketData, sessionId: unknown): string {
  if (data.role !== "host" || !data.sessionId) {
    throw new ForbiddenError("Only the host can control this session");
  }
  if (sessionId != null && String(sessionId) !== data.sessionId) {
    throw new ForbiddenError("Session ID does not match");
  }
  return data.sessionId;
}

function sendError(socket: Socket, error: unknown, event: string, logger: Logger): void {
  const message = error instanceof AppError ? error.message : "Unexpected error";
  socket.emit(ServerEvents.error, { event, message });
  logger.debug({ err: error, event, socketId: socket.id }, "realtime error");
}
