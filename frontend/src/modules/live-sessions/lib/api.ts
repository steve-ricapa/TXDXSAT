import { api, apiRequest } from "@/services/api-client";
import type { QuestionType } from "./protocol";

export interface QuizSummary {
  id: string;
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
  questions: QuizQuestionInput[];
}

export interface QuizDetailQuestion extends QuizQuestionInput {
  id: string;
  orderIndex: number;
}

export interface QuizDetail {
  id: string;
  tenantId: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  questions: QuizDetailQuestion[];
}

export const liveApi = {
  listQuizzes: () => api.get<{ quizzes: QuizSummary[] }>("/live/quizzes"),
  getQuizDetail: (id: string) => api.get<QuizDetail>(`/live/quizzes/${id}`),
  createQuiz: (payload: QuizPayload) =>
    api.post<{ id: string; questionCount: number }>("/live/quizzes", payload),
  updateQuiz: (id: string, payload: QuizPayload) =>
    apiRequest<{ id: string; questionCount: number }>(`/live/quizzes/${id}`, {
      method: "PUT",
      body: payload,
    }),
  createSession: (quizId: string) => api.post<CreateSessionResult>("/live/sessions", { quizId }),
  getResults: (sessionId: string, token: string) =>
    api.get<PersistedResults>(`/live/sessions/${sessionId}/results`, {
      headers: { "x-session-token": token },
    }),
};
