import type { Logger } from "pino";
import { EventTypes, createDomainEvent } from "../../../events/contracts/event-types.ts";
import type { LiveSessionResultEntry } from "../../../events/contracts/event-types.ts";
import { withTransaction } from "../../../shared/database/prisma.ts";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app-error.ts";
import { avatarOrDefault } from "../domain/avatars.ts";
import { ServerEvents } from "../domain/protocol.ts";
import type { ResultsPayload } from "../domain/protocol.ts";
import {
  computeSpeedBonus,
  computeStreakBonus,
  normalizeText,
  scoreClosestToGuess,
} from "../domain/scoring.ts";
import { hashSeed, invertPerm, seededShuffle } from "../domain/shuffle.ts";
import type {
  AnswerRecord,
  EnginePlayer,
  EngineSession,
  LeaderboardEntry,
  PlayerSnapshot,
  PublicQuestion,
  QuizQuestion,
} from "../domain/types.ts";
import type { DomainEventSink, GameBroadcaster, LiveSessionStore } from "./ports.ts";

export interface GameEngineOptions {
  /** Hard cap on players per session (host is on a 2 vCPU / 4 GB box). */
  maxPlayersPerSession?: number;
  speedBonusMax?: number;
  speedBonusMin?: number;
  streakEnabled?: boolean;
  streakMinimum?: number;
  streakBase?: number;
  countdownSeconds?: number;
}

export interface JoinPlayerInput {
  sessionId: string;
  username: string;
  avatar?: string | undefined;
  playerId?: string | undefined;
}

export interface JoinPlayerResult {
  session: EngineSession;
  player: EnginePlayer;
  reconnected: boolean;
}

export interface SubmitAnswerInput {
  sessionId: string;
  playerId: string;
  questionId: string;
  chosenIndex?: number | undefined;
  chosenIndices?: number[] | undefined;
  chosenText?: string | undefined;
}

const USERNAME_MAX = 24;

/**
 * Authoritative live-game engine.
 *
 * Holds the *active* state of every running session in memory for fast,
 * synchronous scoring and broadcasting, and persists critical snapshots to
 * PostgreSQL (players, per-answer results, final standings). Real-time traffic
 * is ephemeral; the durable truth is the `live_session.finished.v1` event
 * published through the transactional outbox inside the same transaction that
 * consolidates the results.
 *
 * The engine never touches Socket.IO or Prisma directly — it talks to the
 * `GameBroadcaster` and `LiveSessionStore` ports.
 */
export class GameEngine {
  private readonly sessions = new Map<string, EngineSession>();
  private readonly readonlyMaxPlayers: number;
  private readonly speedBonusMax: number;
  private readonly speedBonusMin: number;
  private readonly streakEnabled: boolean;
  private readonly streakMinimum: number;
  private readonly streakBase: number;
  private readonly countdownSeconds: number;

  constructor(
    private readonly store: LiveSessionStore,
    private readonly publisher: DomainEventSink,
    private readonly broadcaster: GameBroadcaster,
    private readonly logger: Logger,
    options: GameEngineOptions = {},
  ) {
    this.readonlyMaxPlayers = options.maxPlayersPerSession ?? 200;
    this.speedBonusMax = options.speedBonusMax ?? 200;
    this.speedBonusMin = options.speedBonusMin ?? 10;
    this.streakEnabled = options.streakEnabled ?? true;
    this.streakMinimum = options.streakMinimum ?? 2;
    this.streakBase = options.streakBase ?? 50;
    this.countdownSeconds = options.countdownSeconds ?? 3;
  }

  // --- Loading -------------------------------------------------------------

  /** Load a session into memory (idempotent), rebuilding it from the database. */
  async ensureLoaded(sessionId: string): Promise<EngineSession> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const record = await this.store.findById(sessionId);
    if (!record) throw new NotFoundError("Live session not found");
    const questions = await this.store.getQuizQuestions(record.quizId);
    return this.buildSession(record, questions);
  }

  private buildSession(
    record: {
      id: string;
      tenantId: string | null;
      quizId: string;
      quizTitle: string;
      pin: string;
      status: EngineSession["status"];
      currentQuestionIndex: number;
      viewToken: string;
    },
    questions: QuizQuestion[],
  ): EngineSession {
    const session: EngineSession = {
      id: record.id,
      tenantId: record.tenantId,
      quizId: record.quizId,
      quizTitle: record.quizTitle,
      pin: record.pin,
      viewToken: record.viewToken,
      status: record.status,
      currentQuestionIndex: record.currentQuestionIndex,
      questions,
      players: new Map(),
      socketToPlayer: new Map(),
      answersByQuestion: new Map(),
      answeredOrder: [],
      questionStartedAt: null,
      questionEndsAt: null,
      questionTimer: null,
      startedAt: null,
      finishedAt: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /** Rehydrate persisted players into memory the first time a session is used. */
  private async hydratePlayers(session: EngineSession): Promise<void> {
    if (session.players.size > 0) return;
    const players = await this.store.getPlayers(session.id);
    for (const snapshot of players) {
      session.players.set(snapshot.playerId, {
        id: snapshot.playerId,
        username: snapshot.username,
        avatar: snapshot.avatar,
        score: snapshot.score,
        streak: 0,
        connected: false,
        socketId: null,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
      });
    }
  }

  // --- Authentication ------------------------------------------------------

  async loadForHost(sessionId: string, hostToken: string): Promise<EngineSession> {
    const session = await this.ensureLoaded(sessionId);
    const record = await this.store.findById(sessionId);
    if (!record || record.hostToken !== hostToken) {
      throw new ForbiddenError("Invalid host credentials");
    }
    await this.hydratePlayers(session);
    return session;
  }

  async loadForPresenter(sessionId: string, viewToken: string): Promise<EngineSession> {
    const session = await this.ensureLoaded(sessionId);
    const record = await this.store.findById(sessionId);
    if (!record || record.viewToken !== viewToken) {
      throw new ForbiddenError("Invalid presenter credentials");
    }
    await this.hydratePlayers(session);
    return session;
  }

  async findByPin(pin: string): Promise<EngineSession | null> {
    const record = await this.store.findByPin(pin);
    if (!record) return null;
    const session = await this.ensureLoaded(record.id);
    await this.hydratePlayers(session);
    return session;
  }

  async findById(sessionId: string): Promise<EngineSession | null> {
    const record = await this.store.findById(sessionId);
    if (!record) return null;
    const session = await this.ensureLoaded(record.id);
    await this.hydratePlayers(session);
    return session;
  }

  // --- Player lifecycle ----------------------------------------------------

  async joinPlayer(input: JoinPlayerInput): Promise<JoinPlayerResult> {
    const username = normalizeUsername(input.username);
    const avatar = input.avatar !== undefined ? avatarOrDefault(input.avatar) : undefined;

    const session = await this.ensureLoaded(input.sessionId);
    await this.hydratePlayers(session);

    if (session.status === "FINISHED") {
      throw new ConflictError("This session has already finished");
    }

    let player: EnginePlayer | undefined;
    let reconnected = false;

    if (input.playerId) {
      player = session.players.get(input.playerId);
    }
    if (!player) {
      // Reject a name already taken (case-insensitive) to avoid impersonation.
      const clash = [...session.players.values()].some(
        (p) => normalizeText(p.username) === normalizeText(username),
      );
      if (clash) throw new ConflictError("That name is already taken in this session");
      if (session.players.size >= this.readonlyMaxPlayers) {
        throw new ConflictError("This session is full");
      }
    } else {
      reconnected = true;
    }

    const persistedId = await this.store.upsertPlayer({
      sessionId: session.id,
      tenantId: session.tenantId,
      username,
      avatar: avatar ?? player?.avatar ?? "shield",
    });

    const now = Date.now();
    player = {
      id: persistedId,
      username,
      avatar: avatar ?? player?.avatar ?? "shield",
      score: player?.score ?? 0,
      streak: player?.streak ?? 0,
      connected: true,
      socketId: player?.socketId ?? null,
      joinedAt: player?.joinedAt ?? now,
      lastSeenAt: now,
    };
    session.players.set(player.id, player);

    void this.store.setParticipantCount(session.id, session.players.size).catch((error: unknown) => {
      this.logger.warn({ err: error, sessionId: session.id }, "failed to persist participant count");
    });

    this.broadcaster.toSession(session.id, ServerEvents.playerJoined, {
      playerId: player.id,
      username: player.username,
      avatar: player.avatar,
      score: player.score,
      connected: true,
    });
    this.broadcastLeaderboard(session);

    return { session, player, reconnected };
  }

  /** Bind a live socket to a player (called after `player:join`). */
  bindSocket(sessionId: string, playerId: string, socketId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const player = session.players.get(playerId);
    if (!player) return;
    if (player.socketId && player.socketId !== socketId) {
      session.socketToPlayer.delete(player.socketId);
    }
    player.socketId = socketId;
    player.connected = true;
    player.lastSeenAt = Date.now();
    session.socketToPlayer.set(socketId, playerId);
  }

  /** Resolve which player a socket belongs to for the anti-cheat guard. */
  playerForSocket(sessionId: string, socketId: string): string | null {
    return this.sessions.get(sessionId)?.socketToPlayer.get(socketId) ?? null;
  }

  /** Mark a player disconnected without dropping their score/answers. */
  handleDisconnect(socketId: string): void {
    for (const session of this.sessions.values()) {
      const playerId = session.socketToPlayer.get(socketId);
      if (!playerId) continue;
      session.socketToPlayer.delete(socketId);
      const player = session.players.get(playerId);
      if (player) {
        player.connected = false;
        player.socketId = null;
        this.broadcaster.toSession(session.id, ServerEvents.playerLeft, {
          playerId: player.id,
          username: player.username,
        });
        this.broadcastLeaderboard(session);
      }
      return;
    }
  }

  // --- Game flow -----------------------------------------------------------

  async start(sessionId: string): Promise<EngineSession> {
    const session = await this.ensureLoaded(sessionId);
    if (session.status !== "WAITING") throw new ConflictError("Session already started");
    if (session.questions.length === 0) throw new ConflictError("This quiz has no questions");

    session.status = "ACTIVE";
    session.startedAt = Date.now();
    session.currentQuestionIndex = 0;
    await this.store.setStatus(session.id, "ACTIVE", { startedAt: new Date(session.startedAt) });
    await this.store.setCurrentQuestionIndex(session.id, 0);

    this.broadcaster.toSession(session.id, ServerEvents.gameStarted, {
      questionCount: session.questions.length,
      countdownSeconds: this.countdownSeconds,
    });
    this.broadcaster.toSession(session.id, ServerEvents.gameCountdown, {
      seconds: this.countdownSeconds,
    });

    const timer = setTimeout(() => {
      if (session.status === "ACTIVE" && session.questionEndsAt === null) {
        this.sendQuestion(session);
      }
    }, this.countdownSeconds * 1000);
    timer.unref?.();
    session.questionTimer = timer;

    this.logger.info({ sessionId: session.id }, "live session started");
    return session;
  }

  /** Reveal the current question's results (host action or timer). */
  reveal(sessionId: string): EngineSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundError("Live session not loaded");
    this.closeQuestion(session, false);
    return session;
  }

  async next(sessionId: string): Promise<{ session: EngineSession; ended: boolean }> {
    const session = await this.ensureLoaded(sessionId);
    if (session.status !== "ACTIVE") throw new ConflictError("Session is not active");
    if (session.questionEndsAt !== null) {
      throw new ConflictError("Reveal the current question before advancing");
    }

    const nextIndex = session.currentQuestionIndex + 1;
    if (nextIndex >= session.questions.length) {
      await this.end(sessionId);
      return { session, ended: true };
    }

    session.currentQuestionIndex = nextIndex;
    await this.store.setCurrentQuestionIndex(session.id, nextIndex);
    this.sendQuestion(session);
    return { session, ended: false };
  }

  async end(sessionId: string): Promise<EngineSession> {
    const session = await this.ensureLoaded(sessionId);
    if (session.status === "FINISHED") return session;

    // Final reveal if a question is still open.
    if (session.questionEndsAt !== null) this.closeQuestion(session, false);
    if (session.questionTimer) {
      clearTimeout(session.questionTimer);
      session.questionTimer = null;
    }

    const finishedAt = new Date();
    session.status = "FINISHED";
    session.finishedAt = finishedAt.getTime();

    const leaderboard = this.buildLeaderboard(session);
    const participants = [...session.players.values()];
    const answersByPlayer = this.countAnswersByPlayer(session);

    // Consolidate results + durable event atomically.
    const resultEntries: LiveSessionResultEntry[] = leaderboard.map((entry) => ({
      rank: entry.rank,
      playerId: entry.playerId,
      username: entry.username,
      avatar: entry.avatar,
      score: entry.score,
      correctAnswers: answersByPlayer.get(entry.playerId)?.correct ?? 0,
      totalAnswers: answersByPlayer.get(entry.playerId)?.total ?? 0,
    }));

    await withTransaction(async (tx) => {
      await this.store.finalizeSession(
        {
          sessionId: session.id,
          finishedAt,
          participantCount: participants.length,
          players: participants.map((p) => ({ id: p.id, score: p.score })),
        },
        tx,
      );
      const event = createDomainEvent(
        EventTypes.LiveSessionFinished,
        {
          sessionId: session.id,
          quizId: session.quizId,
          quizTitle: session.quizTitle,
          participantCount: participants.length,
          finishedAt: finishedAt.toISOString(),
          leaderboard: resultEntries,
        },
        { tenantId: session.tenantId },
      );
      await this.publisher.publish(event, { transaction: tx });
    });

    this.broadcaster.toSession(session.id, ServerEvents.gameEnded, {
      sessionId: session.id,
      quizTitle: session.quizTitle,
      participantCount: participants.length,
      podium: resultEntries.slice(0, 3),
      leaderboard: resultEntries,
    });

    this.logger.info(
      { sessionId: session.id, players: participants.length },
      "live session finished",
    );
    return session;
  }

  // --- Answering -----------------------------------------------------------

  async submitAnswer(input: SubmitAnswerInput): Promise<{ session: EngineSession; record: AnswerRecord }> {
    const session = await this.ensureLoaded(input.sessionId);

    // Anti-cheat guard order (ported from the reference implementation):
    // 1) the game must be accepting answers, 2) the referenced question must be
    // the current one, 3) the player must belong to the session, 4) no duplicate.
    if (session.status !== "ACTIVE" || session.questionEndsAt === null) {
      throw new ConflictError("No question is currently open");
    }
    const question = session.questions[session.currentQuestionIndex];
    if (!question || question.id !== input.questionId) {
      throw new ConflictError("That question is not open");
    }
    const player = session.players.get(input.playerId);
    if (!player) throw new ForbiddenError("Unknown player");

    const answers = this.answersFor(session, question.id);
    if (answers.has(player.id)) throw new ConflictError("You already answered this question");

    const evaluated = this.evaluateAnswer(session, question, player, input);
    const answerOrder = answers.size + 1;

    const record: AnswerRecord = {
      playerId: player.id,
      questionId: question.id,
      chosenIndex: evaluated.chosenIndex,
      chosenIndices: evaluated.chosenIndices,
      chosenText: evaluated.chosenText,
      isCorrect: evaluated.isCorrect,
      score: evaluated.score,
      answerOrder,
      answeredAt: Date.now(),
      streak: evaluated.newStreak,
    };

    answers.set(player.id, record);
    session.answeredOrder.push(player.id);
    player.streak = evaluated.newStreak;
    if (evaluated.score > 0) {
      player.score += evaluated.score;
      void this.store.updatePlayerScore(player.id, player.score).catch((error: unknown) => {
        this.logger.warn({ err: error, playerId: player.id }, "failed to persist score");
      });
    }

    void this.store.saveAnswer(session.id, session.tenantId, record).catch((error: unknown) => {
      this.logger.warn({ err: error, playerId: player.id }, "failed to persist answer");
    });

    this.broadcaster.toSession(session.id, ServerEvents.gameAnswerCount, {
      questionId: question.id,
      answeredCount: answers.size,
      playerCount: session.players.size,
    });

    return { session, record };
  }

  private evaluateAnswer(
    session: EngineSession,
    question: QuizQuestion,
    player: EnginePlayer,
    input: SubmitAnswerInput,
  ): {
    isCorrect: boolean;
    score: number;
    chosenIndex: number;
    chosenIndices: number[];
    chosenText: string | null;
    newStreak: number;
  } {
    const answers = this.answersFor(session, question.id);
    const correctBefore = [...answers.values()].filter((a) => a.isCorrect).length;
    const totalPlayers = Math.max(session.players.size, 1);
    const optionOrder = this.optionOrderFor(session, question);

    let isCorrect = false;
    let raw = 0;
    let chosenIndex = -1;
    const chosenIndices: number[] = [];
    let chosenText: string | null = null;

    switch (question.type) {
      case "multiple_choice":
      case "true_false": {
        const slot = Number(input.chosenIndex);
        if (!Number.isInteger(slot) || slot < 0 || slot >= question.options.length) {
          throw new ValidationError("Invalid answer option");
        }
        chosenIndex = slot;
        const original = optionOrder[slot] ?? -1;
        isCorrect = original === question.correctIndex;
        if (isCorrect) {
          raw = question.baseScore + this.speedBonus(correctBefore, totalPlayers);
        }
        break;
      }
      case "multi_select": {
        const slots = Array.isArray(input.chosenIndices) ? input.chosenIndices : [];
        for (const slot of slots) {
          if (!Number.isInteger(slot) || slot < 0 || slot >= question.options.length) {
            throw new ValidationError("Invalid answer option");
          }
          chosenIndices.push(slot);
        }
        const chosenOriginals = new Set(chosenIndices.map((slot) => optionOrder[slot] ?? -1));
        const correct = new Set(question.correctIndices);
        isCorrect =
          chosenOriginals.size === correct.size &&
          [...correct].every((index) => chosenOriginals.has(index));
        if (isCorrect) {
          raw = question.baseScore + this.speedBonus(correctBefore, totalPlayers);
        }
        break;
      }
      case "open_text": {
        chosenText = typeof input.chosenText === "string" ? input.chosenText.slice(0, 500) : "";
        isCorrect =
          normalizeText(chosenText) === normalizeText(question.correctText ?? "") &&
          normalizeText(chosenText).length > 0;
        if (isCorrect) {
          raw = question.baseScore + this.speedBonus(correctBefore, totalPlayers);
        }
        break;
      }
      case "closest_to": {
        const guess = Number(input.chosenText);
        if (!Number.isFinite(guess)) throw new ValidationError("Invalid numeric guess");
        chosenText = String(guess);
        const min = question.rangeMin ?? 0;
        const max = question.rangeMax ?? 100;
        const correct = question.correctNumber ?? 0;
        const scored = scoreClosestToGuess(
          guess,
          correct,
          min,
          max,
          question.baseScore,
          correctBefore,
          totalPlayers,
          this.speedBonusMax,
          this.speedBonusMin,
        );
        isCorrect = scored.isCorrect;
        raw = scored.score;
        // Guard against a misconfigured range producing NaN.
        if (!Number.isFinite(raw)) raw = 0;
        break;
      }
    }

    const newStreak = isCorrect ? player.streak + 1 : 0;
    const streakBonus = computeStreakBonus(
      newStreak,
      this.streakEnabled,
      this.streakMinimum,
      this.streakBase,
    );
    const score = Math.max(0, Math.round(raw + (isCorrect ? streakBonus : 0)));
    return { isCorrect, score, chosenIndex, chosenIndices, chosenText, newStreak };
  }

  private speedBonus(correctBefore: number, totalPlayers: number): number {
    return computeSpeedBonus(correctBefore, totalPlayers, this.speedBonusMax, this.speedBonusMin);
  }

  // --- Broadcasting / snapshots -------------------------------------------

  private sendQuestion(session: EngineSession): void {
    const question = session.questions[session.currentQuestionIndex];
    if (!question) return;
    const timeSec = question.timeSec;
    session.questionStartedAt = Date.now();
    session.questionEndsAt = session.questionStartedAt + timeSec * 1000;
    session.answersByQuestion.set(question.id, new Map());

    this.broadcaster.toSession(session.id, ServerEvents.gameQuestion, this.publicQuestion(session, question));

    if (session.questionTimer) clearTimeout(session.questionTimer);
    const timer = setTimeout(() => this.closeQuestion(session, true), timeSec * 1000 + 250);
    timer.unref?.();
    session.questionTimer = timer;
  }

  private closeQuestion(session: EngineSession, timedOut: boolean): void {
    if (session.questionEndsAt === null) return; // already closed
    const question = session.questions[session.currentQuestionIndex];
    if (session.questionTimer) {
      clearTimeout(session.questionTimer);
      session.questionTimer = null;
    }
    session.questionEndsAt = null;
    session.questionStartedAt = null;
    if (!question) return;

    const results = this.buildResults(session, question, timedOut);
    this.broadcaster.toSession(session.id, ServerEvents.gameResults, results);
    this.broadcaster.toSession(session.id, ServerEvents.gameLeaderboard, results.leaderboard);
  }

  private buildResults(
    session: EngineSession,
    question: QuizQuestion,
    timedOut: boolean,
  ): ResultsPayload {
    const answers = this.answersFor(session, question.id);
    const optionOrder = this.optionOrderFor(session, question);
    const distribution = new Array<number>(question.options.length).fill(0);
    if (question.type === "multiple_choice" || question.type === "true_false") {
      for (const record of answers.values()) {
        if (record.chosenIndex >= 0 && record.chosenIndex < distribution.length) {
          distribution[record.chosenIndex] = (distribution[record.chosenIndex] ?? 0) + 1;
        }
      }
    } else if (question.type === "multi_select") {
      for (const record of answers.values()) {
        for (const slot of record.chosenIndices) {
          if (slot >= 0 && slot < distribution.length) {
            distribution[slot] = (distribution[slot] ?? 0) + 1;
          }
        }
      }
    }

    const inverse = invertPerm(optionOrder);
    const correctDisplayIndices =
      question.type === "multi_select"
        ? question.correctIndices.map((index) => inverse[index] ?? -1).filter((index) => index >= 0)
        : question.correctIndex !== null
          ? [inverse[question.correctIndex] ?? -1].filter((index) => index >= 0)
          : [];

    return {
      questionId: question.id,
      type: question.type,
      explanation: question.explanation,
      correctDisplayIndices,
      correctText: question.correctText,
      correctNumber: question.correctNumber,
      distribution,
      leaderboard: this.buildLeaderboard(session),
      answeredCount: answers.size,
      playerCount: session.players.size,
      timedOut,
    };
  }

  private broadcastLeaderboard(session: EngineSession): void {
    this.broadcaster.toSession(session.id, ServerEvents.gameLeaderboard, this.buildLeaderboard(session));
  }

  /** Public question + the deterministic option order for the current session. */
  publicQuestion(session: EngineSession, question: QuizQuestion): PublicQuestion {
    const endsAt = new Date(session.questionEndsAt ?? Date.now()).toISOString();
    return {
      index: session.currentQuestionIndex,
      total: session.questions.length,
      questionId: question.id,
      type: question.type,
      text: question.text,
      options: question.options,
      imageUrl: question.imageUrl,
      optionImages: question.optionImages,
      timeSec: question.timeSec,
      endsAt,
      optionOrder: this.optionOrderFor(session, question),
    };
  }

  /** The currently open question, or null — used to catch up reconnecting players. */
  getOpenQuestion(session: EngineSession): PublicQuestion | null {
    if (session.status !== "ACTIVE" || session.questionEndsAt === null) return null;
    const question = session.questions[session.currentQuestionIndex];
    return question ? this.publicQuestion(session, question) : null;
  }

  getState(session: EngineSession, options: { includeViewToken?: boolean } = {}): {
    sessionId: string;
    pin: string;
    quizTitle: string;
    status: EngineSession["status"];
    questionIndex: number;
    questionCount: number;
    players: PlayerSnapshot[];
    viewToken?: string;
  } {
    return {
      sessionId: session.id,
      pin: session.pin,
      quizTitle: session.quizTitle,
      status: session.status,
      questionIndex: session.currentQuestionIndex,
      questionCount: session.questions.length,
      players: [...session.players.values()].map((player) => ({
        playerId: player.id,
        username: player.username,
        avatar: player.avatar,
        score: player.score,
        connected: player.connected,
      })),
      ...(options.includeViewToken ? { viewToken: session.viewToken } : {}),
    };
  }

  /** Snapshot of the in-memory leaderboard for a loaded session. */
  getLeaderboard(sessionId: string): LeaderboardEntry[] {
    const session = this.sessions.get(sessionId);
    return session ? this.buildLeaderboard(session) : [];
  }

  private buildLeaderboard(session: EngineSession): LeaderboardEntry[] {
    return [...session.players.values()]
      .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
      .map((player, index) => ({
        rank: index + 1,
        playerId: player.id,
        username: player.username,
        avatar: player.avatar,
        score: player.score,
        streak: player.streak,
      }));
  }

  // --- Helpers -------------------------------------------------------------

  private answersFor(session: EngineSession, questionId: string): Map<string, AnswerRecord> {
    let map = session.answersByQuestion.get(questionId);
    if (!map) {
      map = new Map();
      session.answersByQuestion.set(questionId, map);
    }
    return map;
  }

  private optionOrderFor(session: EngineSession, question: QuizQuestion): number[] {
    if (question.options.length <= 1) {
      return question.options.map((_, index) => index);
    }
    return seededShuffle(question.options.length, hashSeed(`${session.id}:${question.id}`));
  }

  private countAnswersByPlayer(session: EngineSession): Map<string, { correct: number; total: number }> {
    const totals = new Map<string, { correct: number; total: number }>();
    for (const answers of session.answersByQuestion.values()) {
      for (const record of answers.values()) {
        const entry = totals.get(record.playerId) ?? { correct: 0, total: 0 };
        entry.total += 1;
        if (record.isCorrect) entry.correct += 1;
        totals.set(record.playerId, entry);
      }
    }
    return totals;
  }

  /** Detach finished sessions after a grace period to bound memory. */
  dispose(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.questionTimer) clearTimeout(session.questionTimer);
    this.sessions.delete(sessionId);
  }
}

function normalizeUsername(raw: string): string {
  const username = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (username.length === 0) throw new ValidationError("Name is required");
  if (username.length > USERNAME_MAX) {
    throw new ValidationError(`Name must be at most ${USERNAME_MAX} characters`);
  }
  return username;
}
