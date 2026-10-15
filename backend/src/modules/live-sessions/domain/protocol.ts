import type { LeaderboardEntry, PlayerSnapshot, PublicQuestion, QuestionType } from "./types.ts";

/**
 * Socket.IO protocol for live sessions.
 *
 * Real-time traffic is intentionally **ephemeral**: it drives the UI but is never
 * the source of truth for business facts. The authoritative results are
 * persisted to PostgreSQL and the durable `live_session.finished.v1` domain event
 * is delivered through the transactional outbox.
 *
 * Event names + payloads are mirrored by the frontend in
 * `frontend/src/modules/live-sessions/lib/protocol.ts`.
 */

export const ClientEvents = {
  hostJoin: "host:join",
  hostStart: "host:start",
  hostNext: "host:next",
  hostReveal: "host:reveal",
  hostEnd: "host:end",
  playerJoin: "player:join",
  playerAnswer: "player:answer",
  presentJoin: "present:join",
} as const;

export const ServerEvents = {
  sessionState: "session:state",
  gameStarted: "game:started",
  gameCountdown: "game:countdown",
  gameQuestion: "game:question",
  gameAnswerCount: "game:answer-count",
  gameResults: "game:results",
  gameLeaderboard: "game:leaderboard",
  gameEnded: "game:ended",
  playerJoined: "game:player-joined",
  playerLeft: "game:player-left",
  playerJoinedAck: "player:joined",
  answerAck: "player:answer-ack",
  playerError: "player:error",
  error: "error",
} as const;

export interface SessionStatePayload {
  sessionId: string;
  pin: string;
  quizTitle: string;
  status: "WAITING" | "ACTIVE" | "FINISHED";
  questionIndex: number;
  questionCount: number;
  players: PlayerSnapshot[];
  viewToken?: string;
}

export interface PlayerJoinPayload {
  pin: string;
  username: string;
  avatar?: string;
  playerId?: string;
}

export interface PlayerJoinedAckPayload {
  playerId: string;
  sessionId: string;
  username: string;
  avatar: string;
  score: number;
  reconnected: boolean;
}

export interface AnswerSubmitPayload {
  sessionId: string;
  questionId: string;
  playerId: string;
  chosenIndex: number;
  chosenIndices?: number[];
  chosenText?: string;
}

export interface AnswerAckPayload {
  questionId: string;
  received: boolean;
  answeredCount: number;
}

export interface ResultsPayload {
  questionId: string;
  type: QuestionType;
  explanation: string | null;
  /** Correct answer(s) expressed in *display* slots (choice/multi-select). */
  correctDisplayIndices: number[];
  correctText: string | null;
  correctNumber: number | null;
  /** Votes per *display slot* (choice/multi-select). */
  distribution: number[];
  leaderboard: LeaderboardEntry[];
  /** Number of players who answered. */
  answeredCount: number;
  playerCount: number;
  /** True when the question was closed by its timer rather than the host. */
  timedOut: boolean;
}

export interface QuestionBroadcast extends PublicQuestion {}

export interface CountdownPayload {
  seconds: number;
}
