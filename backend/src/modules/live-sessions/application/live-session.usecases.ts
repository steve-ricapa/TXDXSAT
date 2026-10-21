import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ForbiddenError, NotFoundError, ValidationError } from "../../../shared/errors/app-error.ts";
import { parseOrThrow } from "../../../shared/middleware/validate.ts";
import { isUuid, newNumericCode } from "../../../shared/utils/id.ts";
import { QUESTION_TYPES } from "../domain/types.ts";
import type { QuizDetail, QuizSummary } from "../domain/types.ts";
import { QUESTION_BANK_MODULES, type ComposeQuizInput, type CreateQuestionBankInput, type QuestionBankModule } from "../domain/bank.types.ts";
import type { LiveSessionStore, NewQuestionInput, QuestionBankRepo, QuestionComposer } from "./ports.ts";

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
  origin: z.enum(["STANDARD", "MIXED"]).default("STANDARD"),
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

  async execute(input: CreateQuizInput, createdById: string | null = null): Promise<{ id: string; questionCount: number }> {
    const data = parseOrThrow(createQuizSchema, input);
    return this.store.createQuiz({
      title: data.title,
      description: data.description ?? null,
      tenantId: data.tenantId ?? null,
      createdById,
      origin: data.origin,
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

  async execute(filter?: { tenantId?: string | null }): Promise<QuizSummary[]> {
    return this.store.listQuizzes(filter);
  }
}

const mixCompanyQuizzesSchema = z.object({
  quizIds: z.array(z.string().uuid()).min(2).max(10),
  questionCount: z.number().int().min(2).max(100),
  timeSec: z.number().int().min(5).max(120).nullable().optional(),
});

/** Build an editable copy; source quizzes and their question timers are untouched. */
export class MixCompanyQuizzesUseCase {
  constructor(private readonly store: LiveSessionStore) {}

  async execute(input: unknown, tenantId: string | null) {
    if (!tenantId) throw new ForbiddenError("Tu cuenta no tiene organización asignada");
    const data = parseOrThrow(mixCompanyQuizzesSchema, input);
    if (new Set(data.quizIds).size !== data.quizIds.length) {
      throw new ValidationError("Selecciona cuestionarios diferentes");
    }
    if (data.questionCount < data.quizIds.length) {
      throw new ValidationError("El total debe permitir al menos una pregunta de cada cuestionario");
    }

    const sources = await Promise.all(data.quizIds.map((id) => this.store.getQuizDetail(id)));
    if (sources.some((quiz) => !quiz || quiz.tenantId !== tenantId)) {
      throw new ForbiddenError("Solo puedes mezclar cuestionarios de tu organización");
    }
    const validSources = sources.filter((quiz): quiz is NonNullable<typeof quiz> => quiz !== null);
    if (validSources.some((quiz) => quiz.questions.length === 0)) {
      throw new ValidationError("Todos los cuestionarios deben tener preguntas");
    }

    const shuffled = <T>(items: T[]): T[] => {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j] as T, result[i] as T];
      }
      return result;
    };
    const pools = validSources.map((quiz) => shuffled(quiz.questions));
    const available = pools.reduce((sum, pool) => sum + pool.length, 0);
    if (data.questionCount > available) {
      throw new ValidationError(`Solo hay ${available} preguntas disponibles entre los cuestionarios seleccionados`);
    }
    // Take one from each source before filling the remainder at random.
    const chosen = pools.map((pool) => pool.shift()!);
    const remaining = shuffled(pools.flat()).slice(0, data.questionCount - chosen.length);
    const questions = shuffled([...chosen, ...remaining]).map((question) => ({
      type: question.type,
      text: question.text,
      options: [...question.options],
      correctIndex: question.correctIndex,
      correctIndices: question.correctIndices ? [...question.correctIndices] : null,
      correctText: question.correctText,
      rangeMin: question.rangeMin,
      rangeMax: question.rangeMax,
      correctNumber: question.correctNumber,
      explanation: question.explanation,
      imageUrl: question.imageUrl,
      optionImages: question.optionImages ? [...question.optionImages] : null,
      baseScore: question.baseScore,
      timeSec: data.timeSec ?? question.timeSec,
    }));
    return { questions, sourceTitles: validSources.map((quiz) => quiz.title) };
  }
}

const bankQuestionSchema = questionSchema;
const createBankSchema = z.object({
  tenantId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(160),
  module: z.enum(QUESTION_BANK_MODULES),
  description: z.string().max(2000).nullable().optional(),
  isShared: z.boolean().optional(),
  items: z.array(bankQuestionSchema).min(1).max(500),
});

const composeSchema = z.object({
  totalMax: z.number().int().min(1).max(100).default(20),
  mix: z.array(z.object({ bankId: z.string().uuid(), count: z.number().int().min(0).max(100) })).min(1).max(20),
});

export class ListQuestionBanksUseCase {
  constructor(private readonly banks: QuestionBankRepo) {}
  execute(filter: { tenantId?: string | null; module?: QuestionBankModule }) {
    return this.banks.listBanks(filter);
  }
}

export class GetQuestionBankUseCase {
  constructor(private readonly banks: QuestionBankRepo) {}
  async execute(id: string) {
    if (!isUuid(id)) throw new NotFoundError("Question bank not found");
    const bank = await this.banks.getBank(id);
    if (!bank) throw new NotFoundError("Question bank not found");
    return bank;
  }
}

export class CreateQuestionBankUseCase {
  constructor(private readonly banks: QuestionBankRepo) {}
  async execute(input: unknown): Promise<ReturnType<QuestionBankRepo["createBank"]> extends Promise<infer T> ? T : never> {
    const data = parseOrThrow(createBankSchema, input);
    return this.banks.createBank(data as CreateQuestionBankInput);
  }
}

export class ComposeQuizFromBanksUseCase {
  constructor(private readonly composer: QuestionComposer) {}
  async execute(input: unknown, tenantId: string | null, isSuperAdmin: boolean) {
    const data = parseOrThrow(composeSchema, input) as ComposeQuizInput;
    const questions = await this.composer.compose(data, tenantId, isSuperAdmin);
    if (!questions.length) throw new NotFoundError("No questions available in selected banks");
    return { questions };
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
