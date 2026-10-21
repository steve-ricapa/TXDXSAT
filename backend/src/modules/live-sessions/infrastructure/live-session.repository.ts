import { Prisma } from "../../../generated/prisma/client.ts";
import { prisma, type DatabaseClient } from "../../../shared/database/prisma.ts";
import type {
  AnswerRecord,
  LeaderboardEntry,
  LiveSessionStatus,
  PlayerSnapshot,
  QuizDetail,
  QuizQuestion,
  QuizSummary,
  QuestionType,
} from "../domain/types.ts";
import type { LiveSessionStore, NewQuestionInput } from "../application/ports.ts";
import type { BankDetail, BankSummary, CreateQuestionBankInput, QuestionBankModule } from "../domain/bank.types.ts";

const TYPE_TO_PRISMA: Record<QuestionType, "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_SELECT" | "OPEN_TEXT" | "CLOSEST_TO"> = {
  multiple_choice: "MULTIPLE_CHOICE",
  true_false: "TRUE_FALSE",
  multi_select: "MULTI_SELECT",
  open_text: "OPEN_TEXT",
  closest_to: "CLOSEST_TO",
};

const TYPE_FROM_PRISMA: Record<string, QuestionType> = {
  MULTIPLE_CHOICE: "multiple_choice",
  TRUE_FALSE: "true_false",
  MULTI_SELECT: "multi_select",
  OPEN_TEXT: "open_text",
  CLOSEST_TO: "closest_to",
};

export interface NewQuizInput {
  title: string;
  description: string | null;
  tenantId: string | null;
  createdById: string | null;
  origin: "STANDARD" | "MIXED";
  questions: NewQuestionInput[];
}

export interface SessionRow {
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

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

/** JSON array of `string | null` (per-answer images). */
function jsonNullableArray(value: unknown): (string | null)[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (item === null || item === undefined ? null : String(item)));
}

/** Prisma `create` payload for a question (shared by create + update). */
function questionCreateData(q: NewQuestionInput, index: number) {
  return {
    orderIndex: index,
    type: TYPE_TO_PRISMA[q.type],
    text: q.text,
    options: (q.options ?? []) as Prisma.InputJsonValue,
    correctIndex: q.correctIndex ?? null,
    correctIndices: (q.correctIndices ?? undefined) as Prisma.InputJsonValue,
    correctText: q.correctText ?? null,
    rangeMin: q.rangeMin ?? null,
    rangeMax: q.rangeMax ?? null,
    correctNumber: q.correctNumber ?? null,
    explanation: q.explanation ?? null,
    imageUrl: q.imageUrl ?? null,
    optionImages: (q.optionImages ?? undefined) as Prisma.InputJsonValue,
    baseScore: q.baseScore ?? 500,
    timeSec: q.timeSec ?? 20,
  };
}

function mapQuestion(row: {
  id: string;
  orderIndex: number;
  type: string;
  text: string;
  options: unknown;
  correctIndex: number | null;
  correctIndices: unknown;
  correctText: string | null;
  rangeMin: number | null;
  rangeMax: number | null;
  correctNumber: number | null;
  explanation: string | null;
  imageUrl: string | null;
  optionImages: unknown;
  baseScore: number;
  timeSec: number;
}): QuizQuestion {
  return {
    id: row.id,
    orderIndex: row.orderIndex,
    type: TYPE_FROM_PRISMA[row.type] ?? "multiple_choice",
    text: row.text,
    options: jsonArray(row.options),
    correctIndex: row.correctIndex,
    correctIndices: Array.isArray(row.correctIndices)
      ? (row.correctIndices as unknown[]).map((n) => Number(n))
      : [],
    correctText: row.correctText,
    rangeMin: row.rangeMin,
    rangeMax: row.rangeMax,
    correctNumber: row.correctNumber,
    explanation: row.explanation,
    imageUrl: row.imageUrl,
    optionImages: jsonNullableArray(row.optionImages),
    baseScore: row.baseScore,
    timeSec: row.timeSec,
  };
}

/**
 * Persistence adapter for the live-session module. All database access lives
 * here; the engine works against these methods and never touches Prisma
 * directly.
 */
export class LiveSessionRepository implements LiveSessionStore {
  async listBanks(filter: { tenantId?: string | null; module?: QuestionBankModule }): Promise<BankSummary[]> {
    const where: Prisma.QuestionBankWhereInput = {};
    if (filter.tenantId !== undefined) {
      where.OR = [{ tenantId: filter.tenantId }, { isShared: true }];
    }
    if (filter.module) where.module = filter.module;
    const rows = await prisma.questionBank.findMany({
      where,
      orderBy: [{ module: "asc" }, { name: "asc" }],
      select: {
        id: true, tenantId: true, name: true, module: true, description: true,
        isShared: true, createdAt: true, _count: { select: { items: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      module: row.module as QuestionBankModule,
      description: row.description,
      isShared: row.isShared,
      itemCount: row._count.items,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getBank(id: string): Promise<BankDetail | null> {
    const row = await prisma.questionBank.findUnique({
      where: { id },
      include: { items: { orderBy: { orderIndex: "asc" } }, _count: { select: { items: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      module: row.module as QuestionBankModule,
      description: row.description,
      isShared: row.isShared,
      itemCount: row._count.items,
      createdAt: row.createdAt.toISOString(),
      items: row.items.map((item) => ({
        id: item.id,
        orderIndex: item.orderIndex,
        type: TYPE_FROM_PRISMA[item.type] ?? "multiple_choice",
        text: item.text,
        options: jsonArray(item.options),
        correctIndex: item.correctIndex,
        correctIndices: Array.isArray(item.correctIndices) ? item.correctIndices as number[] : null,
        correctText: item.correctText,
        rangeMin: item.rangeMin,
        rangeMax: item.rangeMax,
        correctNumber: item.correctNumber,
        explanation: item.explanation,
        imageUrl: item.imageUrl,
        optionImages: Array.isArray(item.optionImages) ? item.optionImages as (string | null)[] : null,
        baseScore: item.baseScore,
        timeSec: item.timeSec,
      })),
    };
  }

  async createBank(input: CreateQuestionBankInput): Promise<BankDetail> {
    const row = await prisma.questionBank.create({
      data: {
        tenantId: input.tenantId ?? null,
        name: input.name,
        module: input.module,
        description: input.description ?? null,
        isShared: input.isShared ?? false,
        createdById: input.createdById ?? null,
        items: {
          create: input.items.map((item, index) => ({
            ...questionCreateData(item, index),
          })),
        },
      },
      select: { id: true },
    });
    const bank = await this.getBank(row.id);
    if (!bank) throw new Error("Question bank could not be read after creation");
    return bank;
  }

  async createQuiz(input: NewQuizInput): Promise<{ id: string; questionCount: number }> {
    const quiz = await prisma.quiz.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        tenantId: input.tenantId ?? null,
        createdById: input.createdById,
        origin: input.origin,
        questions: {
          create: input.questions.map((q, index) => questionCreateData(q, index)),
        },
      },
      select: { id: true, _count: { select: { questions: true } } },
    });
    return { id: quiz.id, questionCount: quiz._count.questions };
  }

  async listQuizzes(filter?: { tenantId?: string | null }): Promise<QuizSummary[]> {
    const where: Prisma.QuizWhereInput = {};
    if (filter && filter.tenantId !== undefined) {
      if (filter.tenantId === null) {
        where.tenantId = null;
      } else {
        where.OR = [{ tenantId: filter.tenantId }, { tenantId: null }];
      }
    }

    const rows = await prisma.quiz.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenantId: true,
        createdById: true,
        createdBy: { select: { name: true } },
        origin: true,
        title: true,
        description: true,
        createdAt: true,
        _count: { select: { questions: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      createdById: row.createdById,
      creatorName: row.createdBy?.name ?? null,
      origin: row.origin as "STANDARD" | "MIXED",
      title: row.title,
      description: row.description,
      questionCount: row._count.questions,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
    const rows = await prisma.question.findMany({
      where: { quizId },
      orderBy: { orderIndex: "asc" },
    });
    return rows.map(mapQuestion);
  }

  async getQuizTitle(quizId: string): Promise<string | null> {
    const row = await prisma.quiz.findUnique({ where: { id: quizId }, select: { title: true } });
    return row?.title ?? null;
  }

  async getQuizDetail(quizId: string): Promise<QuizDetail | null> {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        tenantId: true,
        createdById: true,
        createdBy: { select: { name: true } },
        origin: true,
        title: true,
        description: true,
        createdAt: true,
      },
    });
    if (!quiz) return null;
    const questions = await this.getQuizQuestions(quizId);
    return {
      id: quiz.id,
      tenantId: quiz.tenantId,
      createdById: quiz.createdById,
      creatorName: quiz.createdBy?.name ?? null,
      origin: quiz.origin as "STANDARD" | "MIXED",
      title: quiz.title,
      description: quiz.description,
      createdAt: quiz.createdAt.toISOString(),
      questions,
    };
  }

  /** Replace a quiz's metadata and questionnaire atomically. */
  async updateQuiz(
    quizId: string,
    input: {
      title: string;
      description: string | null;
      tenantId: string | null;
      questions: NewQuestionInput[];
    },
  ): Promise<{ id: string; questionCount: number } | null> {
    const existing = await prisma.quiz.findUnique({ where: { id: quizId }, select: { id: true } });
    if (!existing) return null;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.question.deleteMany({ where: { quizId } });
      return tx.quiz.update({
        where: { id: quizId },
        data: {
          title: input.title,
          description: input.description ?? null,
          tenantId: input.tenantId ?? null,
          questions: { create: input.questions.map((q, index) => questionCreateData(q, index)) },
        },
        select: { id: true, _count: { select: { questions: true } } },
      });
    });
    return { id: updated.id, questionCount: updated._count.questions };
  }

  /** True when the PIN is currently in use by a non-finished session. */
  async isPinTaken(pin: string): Promise<boolean> {
    const row = await prisma.liveSession.findFirst({
      where: { pin, status: { not: "FINISHED" } },
      select: { id: true },
    });
    return row !== null;
  }

  async createSession(input: {
    quizId: string;
    tenantId: string | null;
    pin: string;
    hostToken: string;
    viewToken: string;
  }): Promise<SessionRow & { questions: QuizQuestion[] }> {
    const created = await prisma.liveSession.create({
      data: {
        quizId: input.quizId,
        tenantId: input.tenantId,
        pin: input.pin,
        hostToken: input.hostToken,
        viewToken: input.viewToken,
      },
      select: {
        id: true,
        tenantId: true,
        quizId: true,
        pin: true,
        status: true,
        currentQuestionIndex: true,
        hostToken: true,
        viewToken: true,
        quiz: { select: { title: true } },
      },
    });
    const questions = await this.getQuizQuestions(input.quizId);
    return {
      id: created.id,
      tenantId: created.tenantId,
      quizId: created.quizId,
      pin: created.pin,
      status: created.status as LiveSessionStatus,
      currentQuestionIndex: created.currentQuestionIndex,
      hostToken: created.hostToken,
      viewToken: created.viewToken,
      quizTitle: created.quiz.title,
      questions,
    };
  }

  async findByPin(pin: string): Promise<SessionRow | null> {
    const row = await prisma.liveSession.findFirst({
      // Keep finished sessions discoverable for participants reconnecting to
      // retrieve their final ranking. New joins are still rejected by the
      // game engine unless that account already belongs to the session.
      where: { pin },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenantId: true,
        quizId: true,
        pin: true,
        status: true,
        currentQuestionIndex: true,
        hostToken: true,
        viewToken: true,
        quiz: { select: { title: true } },
      },
    });
    return row
      ? {
          id: row.id,
          tenantId: row.tenantId,
          quizId: row.quizId,
          pin: row.pin,
          status: row.status as LiveSessionStatus,
          currentQuestionIndex: row.currentQuestionIndex,
          hostToken: row.hostToken,
          viewToken: row.viewToken,
          quizTitle: row.quiz.title,
        }
      : null;
  }

  async findById(id: string): Promise<SessionRow | null> {
    const row = await prisma.liveSession.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        quizId: true,
        pin: true,
        status: true,
        currentQuestionIndex: true,
        hostToken: true,
        viewToken: true,
        quiz: { select: { title: true } },
      },
    });
    return row
      ? {
          id: row.id,
          tenantId: row.tenantId,
          quizId: row.quizId,
          pin: row.pin,
          status: row.status as LiveSessionStatus,
          currentQuestionIndex: row.currentQuestionIndex,
          hostToken: row.hostToken,
          viewToken: row.viewToken,
          quizTitle: row.quiz.title,
        }
      : null;
  }

  /** One durable player per authenticated account and live session. */
  async upsertPlayer(input: {
    sessionId: string;
    tenantId: string | null;
    userId: string;
    username: string;
    avatar: string;
  }): Promise<string> {
    const player = await prisma.livePlayer.upsert({
      where: { sessionId_userId: { sessionId: input.sessionId, userId: input.userId } },
      create: {
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        userId: input.userId,
        username: input.username,
        avatar: input.avatar,
      },
      update: { username: input.username, avatar: input.avatar, lastSeenAt: new Date() },
      select: { id: true },
    });
    return player.id;
  }

  async updatePlayerScore(playerId: string, score: number): Promise<void> {
    await prisma.livePlayer.update({
      where: { id: playerId },
      data: { score, lastSeenAt: new Date() },
    });
  }

  async setParticipantCount(sessionId: string, count: number): Promise<void> {
    await prisma.liveSession.update({
      where: { id: sessionId },
      data: { participantCount: count },
    });
  }

  async setStatus(
    sessionId: string,
    status: LiveSessionStatus,
    timestamps: { startedAt?: Date; finishedAt?: Date } = {},
  ): Promise<void> {
    await prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        status,
        ...(timestamps.startedAt ? { startedAt: timestamps.startedAt } : {}),
        ...(timestamps.finishedAt ? { finishedAt: timestamps.finishedAt } : {}),
      },
    });
  }

  async setCurrentQuestionIndex(sessionId: string, index: number): Promise<void> {
    await prisma.liveSession.update({
      where: { id: sessionId },
      data: { currentQuestionIndex: index },
    });
  }

  /** Persist an answer. Idempotent per (playerId, questionId). */
  async saveAnswer(sessionId: string, tenantId: string | null, record: AnswerRecord): Promise<void> {
    await prisma.liveAnswer.create({
      data: {
        sessionId,
        tenantId,
        playerId: record.playerId,
        questionId: record.questionId,
        chosenIndex: record.chosenIndex,
        chosenIndices: (record.chosenIndices ?? undefined) as Prisma.InputJsonValue,
        chosenText: record.chosenText,
        isCorrect: record.isCorrect,
        score: record.score,
        answerOrder: record.answerOrder,
        answeredAt: new Date(record.answeredAt),
      },
    });
  }

  async getAnswerCounts(sessionId: string): Promise<Array<{
    playerId: string;
    correctAnswers: number;
    totalAnswers: number;
  }>> {
    const answers = await prisma.liveAnswer.findMany({
      where: { sessionId },
      select: { playerId: true, isCorrect: true },
    });
    const counts = new Map<string, { correctAnswers: number; totalAnswers: number }>();
    for (const answer of answers) {
      const count = counts.get(answer.playerId) ?? { correctAnswers: 0, totalAnswers: 0 };
      count.totalAnswers += 1;
      if (answer.isCorrect) count.correctAnswers += 1;
      counts.set(answer.playerId, count);
    }
    return [...counts].map(([playerId, count]) => ({ playerId, ...count }));
  }

  /**
   * Consolidate the final session state inside a caller-provided transaction.
   * Used together with the outbox append so the results and the
   * `live_session.finished.v1` event commit atomically.
   */
  async finalizeSession(
    input: {
      sessionId: string;
      finishedAt: Date;
      participantCount: number;
      players: Array<{ id: string; score: number }>;
    },
    tx: DatabaseClient,
  ): Promise<void> {
    const client = tx as DatabaseClient;
    for (const player of input.players) {
      await client.livePlayer.update({
        where: { id: player.id },
        data: { score: player.score, lastSeenAt: input.finishedAt },
      });
    }
    await client.liveSession.update({
      where: { id: input.sessionId },
      data: {
        status: "FINISHED",
        finishedAt: input.finishedAt,
        participantCount: input.participantCount,
      },
    });
  }

  async getLeaderboard(sessionId: string): Promise<LeaderboardEntry[]> {
    const rows = await prisma.livePlayer.findMany({
      where: { sessionId },
      orderBy: [{ score: "desc" }, { joinedAt: "asc" }],
      select: { id: true, username: true, avatar: true, score: true },
    });
    return rows.map((row, index) => ({
      rank: index + 1,
      playerId: row.id,
      username: row.username,
      avatar: row.avatar,
      score: row.score,
      streak: 0,
    }));
  }

  async getPlayers(sessionId: string): Promise<(PlayerSnapshot & { userId: string | null })[]> {
    const rows = await prisma.livePlayer.findMany({
      where: { sessionId },
      orderBy: { joinedAt: "asc" },
      select: { id: true, userId: true, username: true, avatar: true, score: true },
    });
    return rows.map((row) => ({
      playerId: row.id,
      userId: row.userId,
      username: row.username,
      avatar: row.avatar,
      score: row.score,
      connected: false,
    }));
  }

  async getResultsForUser(userId: string, _tenantId: string | null) {
    const rows = await prisma.livePlayer.findMany({
      where: { userId },
      orderBy: { joinedAt: "desc" },
      include: {
        session: {
          select: {
            id: true,
            status: true,
            finishedAt: true,
            quiz: { select: { title: true } },
          },
        },
        answers: {
          select: { isCorrect: true, score: true },
        },
      },
    });
    return rows.map((row) => {
      const totalAnswers = row.answers.length;
      const correctCount = row.answers.filter((a) => a.isCorrect).length;
      const accuracyRate = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;
      return {
        sessionId: row.session.id,
        quizTitle: row.session.quiz.title,
        status: row.session.status,
        score: row.score,
        answers: totalAnswers,
        correctCount,
        accuracyRate,
        joinedAt: row.joinedAt.toISOString(),
        finishedAt: row.session.finishedAt?.toISOString() ?? null,
      };
    });
  }

  async getResultDetailForUser(userId: string, tenantId: string | null, sessionId: string) {
    const player = await prisma.livePlayer.findFirst({
      where: { userId, sessionId, ...(tenantId ? { tenantId } : {}) },
      select: {
        score: true,
        joinedAt: true,
        session: {
          select: {
            id: true,
            status: true,
            finishedAt: true,
            quiz: {
              select: {
                title: true,
                questions: { select: { id: true, text: true, explanation: true } },
              },
            },
          },
        },
        answers: {
          orderBy: { answerOrder: "asc" },
          select: { questionId: true, answerOrder: true, isCorrect: true, score: true },
        },
      },
    });
    if (!player || player.session.status !== "FINISHED") return null;

    const questionById = new Map(player.session.quiz.questions.map((question) => [question.id, question]));
    const answers = player.answers.length;
    const correctCount = player.answers.filter((answer) => answer.isCorrect).length;
    return {
      sessionId: player.session.id,
      quizTitle: player.session.quiz.title,
      status: "FINISHED" as const,
      score: player.score,
      answers,
      correctCount,
      incorrectCount: answers - correctCount,
      accuracyRate: answers ? Math.round((correctCount / answers) * 100) : 0,
      joinedAt: player.joinedAt.toISOString(),
      finishedAt: player.session.finishedAt?.toISOString() ?? null,
      questions: player.answers.map((answer) => {
        const question = questionById.get(answer.questionId);
        return {
          questionId: answer.questionId,
          questionText: question?.text ?? null,
          explanation: question?.explanation ?? null,
          isCorrect: answer.isCorrect,
          score: answer.score,
          answerOrder: answer.answerOrder,
        };
      }),
    };
  }
}
