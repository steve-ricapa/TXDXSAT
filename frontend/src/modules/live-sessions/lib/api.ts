import { api, apiRequest } from "@/services/api-client";
import type { QuestionType } from "./protocol";

export interface QuizSummary {
  id: string;
  tenantId: string | null;
  createdById: string | null;
  creatorName: string | null;
  origin: "STANDARD" | "MIXED";
  title: string;
  description: string | null;
  questionCount: number;
  createdAt: string;
}

export interface CreateSessionResult {
  sessionId: string;
  pin: string;
  hostToken: string;
  viewToken: string;
  quizId: string;
  quizTitle: string;
  questionCount: number;
  paths: { join: string; play: string; host: string; present: string };
}

export interface PersistedResults {
  sessionId: string;
  quizTitle: string;
  status: "WAITING" | "ACTIVE" | "FINISHED";
  participantCount: number;
  leaderboard: Array<{
    rank: number;
    playerId: string;
    username: string;
    avatar: string;
    score: number;
    streak: number;
  }>;
}

export interface MyLiveResult {
  sessionId: string;
  quizTitle: string;
  status: "WAITING" | "ACTIVE" | "FINISHED";
  score: number;
  answers: number;
  correctCount: number;
  accuracyRate: number;
  joinedAt: string;
  finishedAt: string | null;
}

export interface MyLiveResultDetail extends MyLiveResult {
  incorrectCount: number;
  questions: Array<{
    questionId: string;
    questionText: string | null;
    explanation: string | null;
    isCorrect: boolean;
    score: number;
    answerOrder: number;
  }>;
}

export function myLiveResults(): Promise<{ results: MyLiveResult[] }> {
  return api.get("/live/me/results");
}

export function myLiveResultDetail(sessionId: string): Promise<{ result: MyLiveResultDetail }> {
  return api.get(`/live/me/results/${sessionId}`);
}

/** A question as sent to the authoring API (server validates with Zod). */
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

export interface QuizPayload {
  title: string;
  description?: string | null;
  tenantId?: string | null;
  origin?: "STANDARD" | "MIXED";
  questions: QuizQuestionInput[];
}

export interface QuizDetailQuestion extends QuizQuestionInput {
  id: string;
  orderIndex: number;
}

export interface QuizDetail {
  id: string;
  tenantId: string | null;
  createdById: string | null;
  creatorName: string | null;
  origin: "STANDARD" | "MIXED";
  title: string;
  description: string | null;
  createdAt: string;
  questions: QuizDetailQuestion[];
}

export type QuestionBankModule = "PHISHING" | "INTERNET_SECURITY" | "MALICIOUS_EMAILS";

export interface BankSummary {
  id: string;
  tenantId: string | null;
  name: string;
  module: QuestionBankModule;
  description: string | null;
  isShared: boolean;
  itemCount: number;
  createdAt: string;
}

export interface BankDetail extends BankSummary {
  items: QuizQuestionInput[];
}

export const liveApi = {
  listQuizzes: (tenantId?: string | null) =>
    api.get<{ quizzes: QuizSummary[] }>(
      tenantId ? `/live/quizzes?tenantId=${tenantId}` : "/live/quizzes",
    ),
  listCompanyQuizzes: () => api.get<{ quizzes: QuizSummary[] }>(`/live/quizzes?scope=company&refresh=${Date.now()}`),
  mixCompanyQuizzes: (payload: { quizIds: string[]; questionCount: number; timeSec?: number | null }) =>
    api.post<{ questions: QuizQuestionInput[]; sourceTitles: string[] }>("/live/quizzes/mix-company", payload),
  getQuizDetail: (id: string) => api.get<QuizDetail>(`/live/quizzes/${id}`),
  createQuiz: (payload: QuizPayload) =>
    api.post<{ id: string; questionCount: number }>("/live/quizzes", payload),
  updateQuiz: (id: string, payload: QuizPayload) =>
    apiRequest<{ id: string; questionCount: number }>(`/live/quizzes/${id}`, {
      method: "PUT",
      body: payload,
    }),
  listBanks: (module?: QuestionBankModule) =>
    api.get<{ banks: BankSummary[] }>(`/live/banks${module ? `?module=${module}` : ""}`),
  getBank: (id: string) => api.get<BankDetail>(`/live/banks/${id}`),
  createBank: (payload: {
    name: string;
    module: QuestionBankModule;
    description?: string | null;
    items: QuizQuestionInput[];
  }) => api.post<BankDetail>("/live/banks", payload),
  composeQuiz: (payload: { totalMax: number; mix: Array<{ bankId: string; count: number }> }) =>
    api.post<{ questions: QuizQuestionInput[] }>("/live/quizzes/compose", payload),
  createSession: (quizId: string, tenantId?: string | null) =>
    api.post<CreateSessionResult>("/live/sessions", { quizId, tenantId }),
  getResults: (sessionId: string, token: string) =>
    api.get<PersistedResults>(`/live/sessions/${sessionId}/results`, {
      headers: { "x-session-token": token },
    }),
};
