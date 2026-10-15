/**
 * Live-session realtime protocol (client mirror).
 *
 * MUST stay in sync with `backend/src/modules/live-sessions/domain/protocol.ts`.
 * Event names and payload shapes are duplicated here on purpose: the frontend
 * bundle and the backend run in separate build graphs, and the wire contract is
 * the boundary between them.
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

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "multi_select"
  | "open_text"
  | "closest_to";

export type LiveSessionStatus = "WAITING" | "ACTIVE" | "FINISHED";

export interface PublicQuestion {
  index: number;
  total: number;
  questionId: string;
  type: QuestionType;
  text: string;
  options: string[];
  imageUrl: string | null;
  timeSec: number;
  endsAt: string;
  /** optionOrder[displaySlot] = original index. */
  optionOrder: number[];
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  avatar: string;
  score: number;
  streak: number;
}

export interface PlayerSnapshot {
  playerId: string;
  username: string;
  avatar: string;
  score: number;
  connected: boolean;
}

export interface SessionStatePayload {
  sessionId: string;
  pin: string;
  quizTitle: string;
  status: LiveSessionStatus;
  questionIndex: number;
  questionCount: number;
  players: PlayerSnapshot[];
  viewToken?: string;
}

export interface PlayerJoinedAckPayload {
  playerId: string;
  sessionId: string;
  username: string;
  avatar: string;
  score: number;
  reconnected: boolean;
}

export interface AnswerAckPayload {
  questionId: string;
  received: boolean;
  isCorrect: boolean;
  score: number;
  totalScore: number;
}

export interface AnswerCountPayload {
  questionId: string;
  answeredCount: number;
  playerCount: number;
}

export interface ResultsPayload {
  questionId: string;
  type: QuestionType;
  explanation: string | null;
  correctDisplayIndices: number[];
  correctText: string | null;
  correctNumber: number | null;
  distribution: number[];
  leaderboard: LeaderboardEntry[];
  answeredCount: number;
  playerCount: number;
  timedOut: boolean;
}

export interface PodiumEntry {
  rank: number;
  playerId: string;
  username: string;
  avatar: string;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
}

export interface GameEndedPayload {
  sessionId: string;
  quizTitle: string;
  participantCount: number;
  podium: PodiumEntry[];
  leaderboard: PodiumEntry[];
}

export interface GameStartedPayload {
  questionCount: number;
  countdownSeconds: number;
}

export interface ErrorPayload {
  event?: string;
  message: string;
}

export interface PlayerJoinedPayload {
  playerId: string;
  username: string;
  avatar: string;
  score: number;
  connected: boolean;
}
