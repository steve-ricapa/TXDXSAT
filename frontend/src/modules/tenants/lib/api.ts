import { api } from "@/services/api-client";

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  stats: {
    userCount: number;
    employeeCount: number;
    adminCount: number;
    quizCount: number;
    sessionCount: number;
  };
}

export interface QuestionBreakdown {
  questionId: string;
  orderIndex: number;
  text: string;
  type: string;
  explanation: string | null;
  totalAttempts: number;
  correctAttempts: number;
  accuracyRate: number;
  failRate: number;
  difficulty: "Baja" | "Media" | "Alta";
}

export interface QuizAnalytics {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  sessionCount: number;
  participantCount: number;
  avgScore: number;
  accuracyRate: number;
  questionsBreakdown: QuestionBreakdown[];
}

export interface EmployeeProgress {
  userId: string;
  name: string;
  email: string;
  sessionsCount: number;
  totalScore: number;
  avgScore: number;
  correctAnswers: number;
  incorrectAnswers: number;
  totalAnswers: number;
  accuracyRate: number;
  riskLevel: "Bajo" | "Medio" | "Alto";
  status: "Sobresaliente" | "Aprobado" | "Requiere Refuerzo";
}

export interface TenantAnalytics {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  summary: {
    totalEmployees: number;
    evaluatedEmployees: number;
    overallAccuracy: number;
    totalSessions: number;
    totalQuizzes: number;
    atRiskCount: number;
    topCount: number;
  };
  quizzes: QuizAnalytics[];
  employees: EmployeeProgress[];
  atRiskEmployees: EmployeeProgress[];
  topEmployees: EmployeeProgress[];
}

export const tenantsApi = {
  listTenants: () => api.get<{ tenants: TenantSummary[] }>("/tenants"),
  getTenantAnalytics: (tenantId: string) =>
    api.get<TenantAnalytics>(`/tenants/${tenantId}/analytics`),
};
