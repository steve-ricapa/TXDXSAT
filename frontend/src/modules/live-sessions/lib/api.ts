import { api } from "@/services/api-client";

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

export const liveApi = {
  listQuizzes: () => api.get<{ quizzes: QuizSummary[] }>("/live/quizzes"),
  createSession: (quizId: string) =>
    api.post<CreateSessionResult>("/live/sessions", { quizId }),
  getResults: (sessionId: string, token: string) =>
    api.get<PersistedResults>(`/live/sessions/${sessionId}/results`, {
      headers: { "x-session-token": token },
    }),
};
