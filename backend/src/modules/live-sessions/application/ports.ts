import type { DatabaseClient } from "../../../shared/database/prisma.ts";
import type {
  AnswerRecord,
  LeaderboardEntry,
  LiveSessionStatus,
  PlayerSnapshot,
  QuizQuestion,
  QuizSummary,
} from "../domain/types.ts";

export interface SessionRecord {
  id: string;
  tenantId: string | null;
  quizId: string;
  pin: string;
  status: LiveSessionStatus;
  currentQuestionIndex: number;
  hostToken: string;
  viewToken: string;
  quizTitle: string;
}

/** Question payload accepted by `createQuiz`. */
export interface NewQuestionInput {
  type: QuizQuestion["type"];
  text: string;
  options: string[];
  correctIndex?: number | null;
  correctIndices?: number[] | null;
  correctText?: string | null;
  rangeMin?: number | null;
  rangeMax?: number | null;
  correctNumber?: number | null;
  explanation?: string | null;
  imageUrl?: string | null;
  baseScore?: number;
  timeSec?: number;
}

/**
 * Persistence port consumed by the game engine and use cases. Implemented by
 * `LiveSessionRepository` (Prisma). Keeping the engine behind this interface
 * means the domain logic has no dependency on Prisma or the database schema.
 */
export interface LiveSessionStore {
  createQuiz(input: {
    title: string;
    description: string | null;
    tenantId: string | null;
    questions: NewQuestionInput[];
  }): Promise<{ id: string; questionCount: number }>;
  listQuizzes(): Promise<QuizSummary[]>;
  getQuizTitle(quizId: string): Promise<string | null>;
  findById(id: string): Promise<SessionRecord | null>;
  findByPin(pin: string): Promise<SessionRecord | null>;
  isPinTaken(pin: string): Promise<boolean>;
  createSession(input: {
    quizId: string;
    tenantId: string | null;
    pin: string;
    hostToken: string;
    viewToken: string;
  }): Promise<SessionRecord & { questions: QuizQuestion[] }>;
  getQuizQuestions(quizId: string): Promise<QuizQuestion[]>;
  getPlayers(sessionId: string): Promise<PlayerSnapshot[]>;
  upsertPlayer(input: {
    sessionId: string;
    tenantId: string | null;
    username: string;
    avatar: string;
  }): Promise<string>;
  updatePlayerScore(playerId: string, score: number): Promise<void>;
  setParticipantCount(sessionId: string, count: number): Promise<void>;
  setStatus(
    sessionId: string,
    status: LiveSessionStatus,
    timestamps?: { startedAt?: Date; finishedAt?: Date },
  ): Promise<void>;
  setCurrentQuestionIndex(sessionId: string, index: number): Promise<void>;
  saveAnswer(sessionId: string, tenantId: string | null, record: AnswerRecord): Promise<void>;
  finalizeSession(
    input: {
      sessionId: string;
      finishedAt: Date;
      participantCount: number;
      players: Array<{ id: string; score: number }>;
    },
    tx: DatabaseClient,
  ): Promise<void>;
  getLeaderboard(sessionId: string): Promise<LeaderboardEntry[]>;
}

/**
 * Outbound realtime port. The engine emits semantic events; the socket layer
 * (presentation) maps them onto rooms. This keeps the engine free of Socket.IO.
 */
export interface GameBroadcaster {
  /** Everyone in the game: host, presenter and players. */
  toSession(sessionId: string, event: string, payload: unknown): void;
  /** Host-only control feedback. */
  toHost(sessionId: string, event: string, payload: unknown): void;
  /** A single player's private channel. */
  toPlayer(playerId: string, event: string, payload: unknown): void;
}

/** Publish a durable domain event, optionally inside a transaction. */
export interface DomainEventSink {
  publish(
    event: import("../../../events/contracts/domain-event.ts").DomainEvent,
    options?: { transaction?: DatabaseClient },
  ): Promise<void>;
}
