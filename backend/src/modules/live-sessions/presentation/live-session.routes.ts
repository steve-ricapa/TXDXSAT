import { Router } from "express";
import type { AuthenticatedRequest } from "../../auth/presentation/auth.middleware.ts";
import { UnauthorizedError } from "../../../shared/errors/app-error.ts";
import type { LiveSessionStore } from "../application/ports.ts";
import type {
  CreateLiveSessionUseCase,
  CreateQuizUseCase,
  GetQuizDetailUseCase,
  GetSessionResultsUseCase,
  ListQuizzesUseCase,
  UpdateQuizUseCase,
} from "../application/live-session.usecases.ts";

export interface LiveSessionRouterDeps {
  store: LiveSessionStore;
  createQuiz: CreateQuizUseCase;
  listQuizzes: ListQuizzesUseCase;
  getQuizDetail: GetQuizDetailUseCase;
  updateQuiz: UpdateQuizUseCase;
  createSession: CreateLiveSessionUseCase;
  getResults: GetSessionResultsUseCase;
}

/**
 * REST surface of the live-session module (mounted at `/api/v1/live`).
 *
 * Handles authoring (quizzes) and opening a session. All gameplay happens over
 * Socket.IO. `createSession` returns the host/view credentials exactly once;
 * they are never exposed on read endpoints.
 */
export function createLiveSessionRouter(deps: LiveSessionRouterDeps): Router {
  const router = Router();

  router.get("/me/results", async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) throw new UnauthorizedError();
    res.json({ results: await deps.store.getResultsForUser(user.id, user.tenantId) });
  });

  router.post("/quizzes", async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    const body = req.body ?? {};
    if (user?.role !== "SUPERADMIN" && user?.tenantId) {
      body.tenantId = user.tenantId;
    }
    const quiz = await deps.createQuiz.execute(body);
    res.status(201).json(quiz);
  });

  router.get("/quizzes", async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    let filter: { tenantId?: string | null } | undefined;
    if (user?.role === "SUPERADMIN") {
      const qTenant = req.query.tenantId;
      if (typeof qTenant === "string") {
        filter = { tenantId: qTenant === "shared" ? null : qTenant };
      }
    } else if (user?.tenantId) {
      filter = { tenantId: user.tenantId };
    }
    const quizzes = await deps.listQuizzes.execute(filter);
    res.json({ quizzes });
  });

  router.get("/quizzes/:id", async (req, res) => {
    const quiz = await deps.getQuizDetail.execute(String(req.params.id));
    res.json(quiz);
  });

  router.put("/quizzes/:id", async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    const body = req.body ?? {};
    if (user?.role !== "SUPERADMIN" && user?.tenantId) {
      body.tenantId = user.tenantId;
    }
    const quiz = await deps.updateQuiz.execute(String(req.params.id), body);
    res.json(quiz);
  });

  router.post("/sessions", async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    const body = req.body ?? {};
    if (user?.role !== "SUPERADMIN" && user?.tenantId) {
      body.tenantId = user.tenantId;
    }
    const session = await deps.createSession.execute(body);
    res.status(201).json(session);
  });

  router.get("/sessions/:id/results", async (req, res) => {
    const token = req.header("x-session-token") ?? undefined;
    const results = await deps.getResults.execute(String(req.params.id), token);
    res.json(results);
  });

  return router;
}
