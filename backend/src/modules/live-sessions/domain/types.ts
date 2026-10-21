/**
 * Live-session domain types.
 *
 * These are the shapes the game engine manipulates in memory. Persistence
 * (Prisma) and transport (Socket.IO) map to and from them, but the engine itself
 * depends on nothing outside this file plus the pure helpers in `scoring.ts` and
 * `shuffle.ts`.
 */

export const QUESTION_TYPES = [
  "multiple_choice",
  "true_false",
  "multi_select",
  "open_text",
  "closest_to",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const LIVE_SESSION_STATUSES = ["WAITING", "ACTIVE", "FINISHED"] as const;
export type LiveSessionStatus = (typeof LIVE_SESSION_STATUSES)[number];

/** A question as loaded from persistence and fed to the engine. */
export interface QuizQuestion {
  id: string;
  orderIndex: number;
  type: QuestionType;
  text: string;
  options: string[];
  /** Index into `options` (multiple_choice / true_false). */
  correctIndex: number | null;
  /** Correct option indices (multi_select). */
  correctIndices: number[];
  /** Correct free text (open_text). */
  correctText: string | null;
  /** Numeric range + answer (closest_to). */
  rangeMin: number | null;
  rangeMax: number | null;
  correctNumber: number | null;
  explanation: string | null;
  imageUrl: string | null;
  /** Optional per-answer images, parallel to `options` (Fase 3). */
  optionImages: (string | null)[];
  baseScore: number;
  timeSec: number;
}

export interface QuizSummary {
  id: string;
  tenantId?: string | null;
  createdById: string | null;
  creatorName: string | null;
  origin: "STANDARD" | "MIXED";
  title: string;
  description: string | null;
  questionCount: number;
  createdAt: string;
}

/** Full quiz including answers — used by the authoring editor (never players). */
export interface QuizDetail {
  id: string;
  tenantId: string | null;
  createdById: string | null;
  creatorName: string | null;
  origin: "STANDARD" | "MIXED";
  title: string;
  description: string | null;
  createdAt: string;
  questions: QuizQuestion[];
}

/** The question shape broadcast to clients — never leaks the correct answer. */
export interface PublicQuestion {
  index: number;
  total: number;
  questionId: string;
  type: QuestionType;
  text: string;
  options: string[];
  imageUrl: string | null;
  /** Optional per-answer images in *original* option order (Fase 3). */
  optionImages: (string | null)[];
  timeSec: number;
  /** Absolute ISO timestamp when the question closes. */
  endsAt: string;
  /** Shuffled answer order: `optionOrder[displaySlot] = originalIndex`. */
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

/** Per-player answer record the engine keeps for a question. */
export interface AnswerRecord {
  playerId: string;
  questionId: string;
  chosenIndex: number;
  chosenIndices: number[];
  chosenText: string | null;
  isCorrect: boolean;
  score: number;
  answerOrder: number;
  answeredAt: number;
  streak: number;
}

/** In-memory mutable state of one live game. */
export interface EngineSession {
  id: string;
  tenantId: string | null;
  quizId: string;
  quizTitle: string;
  pin: string;
  viewToken: string;
  status: LiveSessionStatus;
  currentQuestionIndex: number;
  questions: QuizQuestion[];
  players: Map<string, EnginePlayer>;
  /** Socket id -> playerId for the currently bound connection. */
  socketToPlayer: Map<string, string>;
  /** questionId -> (playerId -> AnswerRecord) for the current question. */
  answersByQuestion: Map<string, Map<string, AnswerRecord>>;
  answeredOrder: string[];
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  questionTimer: NodeJS.Timeout | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface EnginePlayer {
  id: string;
  userId: string | null;
  username: string;
  avatar: string;
  score: number;
  streak: number;
  connected: boolean;
  socketId: string | null;
  joinedAt: number;
  lastSeenAt: number;
}

export interface QuizQuestionInput {
  type: QuestionType;
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
  optionImages?: (string | null)[] | null;
  baseScore: number;
  timeSec: number;
}
