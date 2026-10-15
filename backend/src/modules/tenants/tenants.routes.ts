import { Router, type Request, type Response } from "express";
import { prisma } from "../../shared/database/prisma.ts";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../shared/errors/app-error.ts";
import type { AuthenticatedRequest } from "../auth/presentation/auth.middleware.ts";

export function createTenantsRouter(): Router {
  const router = Router();

  function currentUser(req: Request) {
    const user = (req as AuthenticatedRequest).user;
    if (!user) throw new UnauthorizedError();
    return user;
  }

  // GET /api/v1/tenants - list tenants accessible to current user
  router.get("/", async (req: Request, res: Response) => {
    const user = currentUser(req);

    if (user.role === "SUPERADMIN") {
      const rows = await prisma.tenant.findMany({
        orderBy: { name: "asc" },
      });

      const tenantsWithStats = await Promise.all(
        rows.map(async (t) => {
          const [userCount, employeeCount, quizCount, sessionCount] = await Promise.all([
            prisma.user.count({ where: { tenantId: t.id } }),
            prisma.user.count({ where: { tenantId: t.id, role: "EMPLOYEE" } }),
            prisma.quiz.count({ where: { tenantId: t.id } }),
            prisma.liveSession.count({ where: { tenantId: t.id } }),
          ]);
          return {
            id: t.id,
            name: t.name,
            slug: t.slug,
            createdAt: t.createdAt.toISOString(),
            stats: {
              userCount,
              employeeCount,
              adminCount: userCount - employeeCount,
              quizCount,
              sessionCount,
            },
          };
        }),
      );

      return res.json({ tenants: tenantsWithStats });
    }

    // Tenant ADMIN: return only their tenant
    if (!user.tenantId) {
      return res.json({ tenants: [] });
    }

    const t = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!t) return res.json({ tenants: [] });

    const [userCount, employeeCount, quizCount, sessionCount] = await Promise.all([
      prisma.user.count({ where: { tenantId: t.id } }),
      prisma.user.count({ where: { tenantId: t.id, role: "EMPLOYEE" } }),
      prisma.quiz.count({ where: { tenantId: t.id } }),
      prisma.liveSession.count({ where: { tenantId: t.id } }),
    ]);

    return res.json({
      tenants: [
        {
          id: t.id,
          name: t.name,
          slug: t.slug,
          createdAt: t.createdAt.toISOString(),
          stats: {
            userCount,
            employeeCount,
            adminCount: userCount - employeeCount,
            quizCount,
            sessionCount,
          },
        },
      ],
    });
  });

  // GET /api/v1/tenants/:id/analytics - complete real analytics for the tenant
  router.get("/:id/analytics", async (req: Request, res: Response) => {
    const user = currentUser(req);
    const tenantId = String(req.params.id);

    // Authorization check: Superadmin or Admin of this tenant
    if (user.role !== "SUPERADMIN" && user.tenantId !== tenantId) {
      throw new ForbiddenError("No tienes permisos para ver las métricas de esta organización");
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundError("Organización no encontrada");

    // 1. All employees of this tenant
    const employees = await prisma.user.findMany({
      where: { tenantId, role: "EMPLOYEE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    // 2. All finished sessions for this tenant
    const sessions = await prisma.liveSession.findMany({
      where: { tenantId, status: "FINISHED" },
      orderBy: { finishedAt: "desc" },
    });
    const sessionIds = sessions.map((s) => s.id);

    // 3. All players and answers in these sessions
    const players = await prisma.livePlayer.findMany({
      where: { sessionId: { in: sessionIds } },
    });

    const answers = await prisma.liveAnswer.findMany({
      where: { sessionId: { in: sessionIds } },
    });

    // 4. Quizzes assigned to this tenant
    const tenantQuizzes = await prisma.quiz.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    const quizIds = tenantQuizzes.map((q) => q.id);

    const questions = await prisma.question.findMany({
      where: { quizId: { in: quizIds } },
      orderBy: { orderIndex: "asc" },
    });

    // Compute employee performance metrics
    const employeeMetrics = employees.map((emp) => {
      const empPlayers = players.filter((p) => p.userId === emp.id);
      const playerIds = empPlayers.map((p) => p.id);
      const sessionsCount = empPlayers.length;
      const totalScore = empPlayers.reduce((acc, p) => acc + p.score, 0);
      const avgScore = sessionsCount > 0 ? Math.round(totalScore / sessionsCount) : 0;

      const empAnswers = answers.filter((a) => playerIds.includes(a.playerId));
      const totalAnswers = empAnswers.length;
      const correctAnswers = empAnswers.filter((a) => a.isCorrect).length;
      const incorrectAnswers = totalAnswers - correctAnswers;
      const accuracyRate = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

      let riskLevel: "Bajo" | "Medio" | "Alto" = "Bajo";
      let status: "Sobresaliente" | "Aprobado" | "Requiere Refuerzo" = "Aprobado";

      if (accuracyRate >= 80) {
        riskLevel = "Bajo";
        status = "Sobresaliente";
      } else if (accuracyRate >= 60) {
        riskLevel = "Medio";
        status = "Aprobado";
      } else {
        riskLevel = "Alto";
        status = "Requiere Refuerzo";
      }

      return {
        userId: emp.id,
        name: emp.name,
        email: emp.email,
        sessionsCount,
        totalScore,
        avgScore,
        correctAnswers,
        incorrectAnswers,
        totalAnswers,
        accuracyRate,
        riskLevel,
        status,
      };
    });

    // Sort employees: highest score first
    const employeesSortedByScore = [...employeeMetrics].sort((a, b) => b.totalScore - a.totalScore);
    const atRiskEmployees = employeeMetrics.filter((e) => e.accuracyRate < 60 || e.riskLevel === "Alto");
    const topEmployees = employeeMetrics.filter((e) => e.accuracyRate >= 80);

    // Compute Quizzes Performance
    const quizAnalytics = tenantQuizzes.map((quiz) => {
      const quizQuestions = questions.filter((q) => q.quizId === quiz.id);
      const quizSessions = sessions.filter((s) => s.quizId === quiz.id);
      const quizSessionIds = quizSessions.map((s) => s.id);

      const quizPlayers = players.filter((p) => quizSessionIds.includes(p.sessionId));
      const quizAnswers = answers.filter((a) => quizSessionIds.includes(a.sessionId));

      const uniqueParticipants = new Set(quizPlayers.map((p) => p.userId ?? p.id)).size;
      const totalScore = quizPlayers.reduce((acc, p) => acc + p.score, 0);
      const avgScore = quizPlayers.length > 0 ? Math.round(totalScore / quizPlayers.length) : 0;

      const totalQuizAnswers = quizAnswers.length;
      const correctQuizAnswers = quizAnswers.filter((a) => a.isCorrect).length;
      const accuracyRate = totalQuizAnswers > 0 ? Math.round((correctQuizAnswers / totalQuizAnswers) * 100) : 0;

      // Question-level accuracy breakdown:
      const questionsBreakdown = quizQuestions.map((q) => {
        const answersForQ = quizAnswers.filter((a) => a.questionId === q.id);
        const totalAttempts = answersForQ.length;
        const correctAttempts = answersForQ.filter((a) => a.isCorrect).length;
        const qAccuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
        const failRate = 100 - qAccuracy;

        return {
          questionId: q.id,
          orderIndex: q.orderIndex,
          text: q.text,
          type: q.type,
          explanation: q.explanation,
          totalAttempts,
          correctAttempts,
          accuracyRate: qAccuracy,
          failRate,
          difficulty: qAccuracy < 50 ? ("Alta" as const) : qAccuracy < 75 ? ("Media" as const) : ("Baja" as const),
        };
      });

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quizQuestions.length,
        sessionCount: quizSessions.length,
        participantCount: uniqueParticipants,
        avgScore,
        accuracyRate,
        questionsBreakdown,
      };
    });

    // Global summary
    const totalAnswersAcrossTenant = employeeMetrics.reduce((acc, e) => acc + e.totalAnswers, 0);
    const correctAnswersAcrossTenant = employeeMetrics.reduce((acc, e) => acc + e.correctAnswers, 0);
    const overallAccuracy =
      totalAnswersAcrossTenant > 0 ? Math.round((correctAnswersAcrossTenant / totalAnswersAcrossTenant) * 100) : 0;

    return res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      summary: {
        totalEmployees: employees.length,
        evaluatedEmployees: employeeMetrics.filter((e) => e.sessionsCount > 0).length,
        overallAccuracy,
        totalSessions: sessions.length,
        totalQuizzes: tenantQuizzes.length,
        atRiskCount: atRiskEmployees.length,
        topCount: topEmployees.length,
      },
      quizzes: quizAnalytics,
      employees: employeesSortedByScore,
      atRiskEmployees,
      topEmployees,
    });
  });

  return router;
}
