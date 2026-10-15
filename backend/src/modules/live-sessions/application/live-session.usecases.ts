import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ForbiddenError, NotFoundError } from "../../../shared/errors/app-error.ts";
import { parseOrThrow } from "../../../shared/middleware/validate.ts";
import { isUuid, newNumericCode } from "../../../shared/utils/id.ts";
import { QUESTION_TYPES } from "../domain/types.ts";
import type { QuizDetail, QuizSummary } from "../domain/types.ts";
import type { LiveSessionStore, NewQuestionInput } from "./ports.ts";

/**
 * Accepts either an external http(s) URL or a deployment-relative media path
 * (`/api/v1/media/<id>`) produced by the media module.
 */
const mediaUrlSchema = z
  .string()
  .max(1000)
  .refine((value) => /^https?:\/\//i.test(value) || value.startsWith("/"), {
    message: "Must be an http(s) URL or an absolute path",
  });

const questionSchema = z
  .object({
    type: z.enum(QUESTION_TYPES),
    text: z.string().min(1).max(1000),
    options: z.array(z.string().min(1).max(300)).max(10).default([]),
    correctIndex: z.number().int().min(0).max(9).nullish(),
    correctIndices: z.array(z.number().int().min(0).max(9)).max(10).nullish(),
    correctText: z.string().max(500).nullish(),
    rangeMin: z.number().int().nullish(),
    rangeMax: z.number().int().nullish(),
    correctNumber: z.number().int().nullish(),
    explanation: z.string().max(1000).nullish(),
    imageUrl: mediaUrlSchema.nullish(),
    optionImages: z.array(mediaUrlSchema.nullable()).max(10).nullish(),
    baseScore: z.number().int().min(0).max(5000).default(500),
    timeSec: z.number().int().min(5).max(120).default(20),
  })
  .refine(
    (q) =>
      q.type === "open_text" ||
      q.type === "closest_to" ||
      q.type === "multi_select" ||
      q.options.length >= 2,
    { message: "Choice questions need at least two options", path: ["options"] },
  )
  .refine(
    (q) =>
      q.type !== "multiple_choice" && q.type !== "true_false" ? true : q.correctIndex != null,
    { message: "This question needs a correctIndex", path: ["correctIndex"] },
  );

export const createQuizSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  tenantId: z.string().uuid().nullish(),
  questions: z.array(questionSchema).min(1).max(100),
});

/** Updating a quiz replaces its questionnaire; the shape is identical. */
export const updateQuizSchema = createQuizSchema;

export type CreateQuizInput = z.input<typeof createQuizSchema>;

type ParsedQuestion = z.infer<typeof questionSchema>;

/** Normalise a validated question into the store's input shape. */
function toNewQuestions(questions: ParsedQuestion[]): NewQuestionInput[] {
  return questions.map((q) => ({
    type: q.type,
    text: q.text,
    options: q.options,
    correctIndex: q.correctIndex ?? null,
    correctIndices: q.correctIndices ?? null,
    correctText: q.correctText ?? null,
    rangeMin: q.rangeMin ?? null,
    rangeMax: q.rangeMax ?? null,
    correctNumber: q.correctNumber ?? null,
    explanation: q.explanation ?? null,
    imageUrl: q.imageUrl ?? null,
    optionImages: q.optionImages ?? null,
    baseScore: q.baseScore,
    timeSec: q.timeSec,
  }));
}

/** Use case: create a quiz with its questions. */
export class CreateQuizUseCase {
  constructor(private readonly store: LiveSessionStore) {}

  async execute(input: CreateQuizInput): Promise<{ id: string; questionCount: number }> {
    const data = parseOrThrow(createQuizSchema, input);
    return this.store.createQuiz({
      title: data.title,
      description: data.description ?? null,
      tenantId: data.tenantId ?? null,
      questions: toNewQuestions(data.questions),
    });
  }
}

/** Use case: read a quiz with its full questionnaire (authoring editor). */
export class GetQuizDetailUseCase {
  constructor(private readonly store: LiveSessionStore) {}

  async execute(quizId: string): Promise<QuizDetail> {
    if (!isUuid(quizId)) throw new NotFoundError("Quiz not found");
    const quiz = await this.store.getQuizDetail(quizId);
    if (!quiz) throw new NotFoundError("Quiz not found");
    return quiz;
  }
}

/** Use case: replace a quiz's metadata and questionnaire. */
export class UpdateQuizUseCase {
  constructor(private readonly store: LiveSessionStore) {}

  async execute(quizId: string, input: unknown): Promise<{ id: string; questionCount: number }> {
    if (!isUuid(quizId)) throw new NotFoundError("Quiz not found");
    const data = parseOrThrow(updateQuizSchema, input);
    const updated = await this.store.updateQuiz(quizId, {
      title: data.title,
      description: data.description ?? null,
      tenantId: data.tenantId ?? null,
      questions: toNewQuestions(data.questions),
    });
    if (!updated) throw new NotFoundError("Quiz not found");
    return updated;
  }
}

export class ListQuizzesUseCase {
  constructor(private readonly store: LiveSessionStore) {}

  async execute(): Promise<QuizSummary[]> {
    return this.store.listQuizzes();
  }
}

export const createSessionSchema = z.object({
  quizId: z.string().uuid(),
  tenantId: z.string().uuid().nullish(),
});

export interface CreateSessionResult {
  sessionId: string;
  pin: string;
  hostToken: string;
  viewToken: string;
  quizId: string;
  quizTitle: string;
  questionCount: number;
  paths: {
    join: string;
    play: string;
    host: string;
    present: string;
  };
}

/**
 * Use case: create a live session for a quiz.
 *
 * The PIN and the two credentials are generated with a CSPRNG. `hostToken`
 * authorizes the control surface; `viewToken` authorizes the (read-only)
 * presenter view and is safe to expose on the big screen. Players never receive
 * either token.
 */
export class CreateLiveSessionUseCase {
  constructor(private readonly store: LiveSessionStore) {}

  async execute(input: unknown): Promise<CreateSessionResult> {
    const data = parseOrThrow(createSessionSchema, input);

    const title = await this.store.getQuizTitle(data.quizId);
    const questions = await this.store.getQuizQuestions(data.quizId);
    if (title === null || questions.length === 0) {
      throw new NotFoundError("Quiz not found or has no questions");
    }

    const pin = await this.allocatePin();
    const session = await this.store.createSession({
      quizId: data.quizId,
      tenantId: data.tenantId ?? null,
      pin,
      hostToken: newToken(),
      viewToken: newToken(),
    });

    return {
      sessionId: session.id,
      pin: session.pin,
      hostToken: session.hostToken,
      viewToken: session.viewToken,
      quizId: session.quizId,
      quizTitle: session.quizTitle,
      questionCount: session.questions.length,
      paths: {
        join: `/sat/live/join?pin=${session.pin}`,
        play: `/sat/live/play/${session.id}`,
        host: `/sat/live/host/${session.id}`,
        present: `/sat/live/present/${session.id}`,
      },
    };
  }

  /** Find a 6-digit PIN not currently in use by a live session. */
  private async allocatePin(): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const pin = newNumericCode(6);
      if (!(await this.store.isPinTaken(pin))) return pin;
    }
    // Extremely unlikely: 900k possible PINs against a handful of live sessions.
    throw new Error("Could not allocate a unique session PIN");
  }
}

/** Use case: read the consolidated (persisted) results of a session. */
export class GetSessionResultsUseCase {
  constructor(private readonly store: LiveSessionStore) {}

  /**
   * Results are readable with either the host or the presenter credential. This
   * keeps player data off any unauthenticated endpoint.
   */
  async execute(sessionId: string, token: string | undefined) {
    const session = await this.store.findById(sessionId);
    if (!session) throw new NotFoundError("Live session not found");
    if (token !== session.hostToken && token !== session.viewToken) {
      throw new ForbiddenError("A valid session token is required");
    }
    const leaderboard = await this.store.getLeaderboard(sessionId);
    return {
      sessionId: session.id,
      quizTitle: session.quizTitle,
      status: session.status,
      participantCount: leaderboard.length,
      leaderboard,
    };
  }
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}
